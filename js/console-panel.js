// Admin Panel JavaScript
// Bu dosya admin panel tasarımını kullanır ve mevcut backend API'lerini kullanır

class AdminPanel {
    constructor() {
        this.apiBase = window.API_BASE_URL || 
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? `http://localhost:${localStorage.getItem('backend_port') || '3001'}/api`
                : ((typeof window.getFloovonApiBase === 'function') 
                    ? window.getFloovonApiBase() 
                    : (window.API_BASE_URL || '/api')));
        
        // Admin authentication bilgilerini localStorage'dan al (init'te cookie kontrolü yapılacak)
        this.adminUserId = localStorage.getItem('admin_user_id');
        this.adminToken = localStorage.getItem('admin_token');
        this.tenants = [];
        this.adminUsers = []; // ✅ REVIZE-8: Superadmin kullanıcıları listesi
        this.adminUsersSearchQuery = ''; // ✅ REVIZE-8: Superadmin kullanıcıları arama sorgusu
        this.currentEditingAdminUser = null; // ✅ REVIZE-8: Düzenlenen superadmin kullanıcı
        this.stats = {
            total_tenants: 0,
            active_tenants: 0,
            total_users: 0,
            admin_users: 0
        };
        this.searchQuery = '';
        this.sheets = {
            addTenant: null,
            profile: null,
            settings: null,
            editTenant: null,
            addAdminUser: null, // ✅ REVIZE-8: Yeni superadmin kullanıcı ekleme sheet'i
            editAdminUser: null // ✅ REVIZE-8: Superadmin kullanıcı düzenleme sheet'i
        };
        
        this.init();
    }
    
    init() {
        // Tema senkronizasyonu için storage event listener
        window.addEventListener('storage', (e) => {
            if (e.key === 'theme') {
                const isDark = e.newValue === 'dark';
                if (isDark) {
                    document.documentElement.classList.add('dark-mode');
                    document.body.classList.add('dark-mode');
                } else {
                    document.documentElement.classList.remove('dark-mode');
                    document.body.classList.remove('dark-mode');
                }
            }
        });
        
        // Admin giriş kontrolü - localStorage ve cookie kontrolü
        let adminUserId = localStorage.getItem('admin_user_id');
        let adminToken = localStorage.getItem('admin_token');
        
        // Eğer localStorage'da yoksa cookie'den al
        if (!adminUserId || !adminToken) {
            adminUserId = adminUserId || this.getCookie('floovon_admin_user_id');
            adminToken = adminToken || this.getCookie('floovon_admin_token');
            
            // Cookie'den geldiyse localStorage'a kaydet
            if (adminUserId && !localStorage.getItem('admin_user_id')) {
                localStorage.setItem('admin_user_id', adminUserId);
            }
            if (adminToken && !localStorage.getItem('admin_token')) {
                localStorage.setItem('admin_token', adminToken);
            }
        }
        
        if (!adminUserId || !adminToken) {
            window.location.href = '/console-login';
            return;
        }
        
        this.adminUserId = adminUserId;
        this.adminToken = adminToken;
        
        this.setupEventListeners();
        this.setupSyncListeners();
        this.initNotifications();
        this.loadStats();
        this.loadTenants();
        this.loadAdminUser();
        // ✅ REVIZE-8: Superadmin kullanıcılarını yükle
        this.loadAdminUsers();
    }
    
    setupSyncListeners() {
        // Cross-page update için sync event'lerini dinle
        if (window.syncManager && window.syncManager.channel) {
            window.syncManager.channel.addEventListener('message', async (event) => {
                const data = event.data;
                if (data && data.type && data.senderId !== window.syncManager.getSenderId()) {
                    if (data.type === 'TENANT_CREATED' || data.type === 'TENANT_UPDATED' || data.type === 'TENANT_STATUS_CHANGED') {
                        // Tenant listesini ve istatistikleri yenile
                        await this.loadTenants();
                        await this.loadStats();
                    }
                }
            });
        }
        
        // Custom event listener (fallback)
        // ✅ Tenant güncellendiğinde sadece stats güncelle, listeyi yenileme (titreme olmasın)
        window.addEventListener('floovon:tenants-updated', async (event) => {
            // Eğer tenant data varsa, sadece o tenant'ı güncelle (tüm listeyi yenileme)
            if (event.detail && event.detail.tenantData) {
                const updatedTenant = event.detail.tenantData;
                const tenantIndex = this.tenants.findIndex(t => t.id === updatedTenant.id);
                if (tenantIndex !== -1) {
                    // Tenant'ı güncelle
                    this.tenants[tenantIndex] = { ...this.tenants[tenantIndex], ...updatedTenant };
                    // Sadece render et (yeniden fetch yapma)
                    this.renderTenants();
                }
            }
            // Stats'ı güncelle
            await this.loadStats();
        });
        
        // Stats update event listener
        window.addEventListener('floovon:stats-update-required', async () => {
            await this.loadStats();
        });
    }
    
    setupEventListeners() {
        // ✅ REVIZE-9: Tema geçiş butonu
        this.setupThemeToggle();
        
        // User menu toggle
        const userMenuTrigger = document.getElementById('user-menu-trigger');
        const userMenu = document.getElementById('user-menu');
        if (userMenuTrigger && userMenu) {
            userMenuTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                userMenu.classList.toggle('hidden');
            });
            document.addEventListener('click', (e) => {
                if (!userMenuTrigger.contains(e.target) && !userMenu.contains(e.target)) {
                    userMenu.classList.add('hidden');
                }
            });
        }
        
        // Close dropdown menus when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('[id^="dropdown-menu-"]') && !e.target.closest('[id^="dropdown-content-"]')) {
                document.querySelectorAll('[id^="dropdown-content-"]').forEach(menu => {
                    menu.classList.add('hidden');
                });
            }
        });
        
        // Yeni tenant ekle butonu
        const btnAddTenant = document.getElementById('btn-add-tenant');
        if (btnAddTenant) {
            btnAddTenant.addEventListener('click', () => this.showAddTenantSheet());
        }
        
        // Search input
        const searchInput = document.getElementById('search-tenants');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.renderTenants();
            });
            // ESC tuşu ile arama sıfırlama
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    searchInput.value = '';
                    this.searchQuery = '';
                    this.renderTenants();
                }
            });
        }
        
        
        // Profile button - sadece console sayfasında çalışsın, tenant-manage sayfasında TenantManage class'ı yönetiyor
        const btnProfile = document.getElementById('btn-profile');
        if (btnProfile) {
            // Eğer sayfa console-tenant-manage ise, bu listener'ı ekleme (TenantManage yönetiyor)
            const isTenantManagePage = document.body.classList.contains('console-tenant-manage-page') || 
                                       window.location.pathname.includes('console-tenant-manage');
            if (!isTenantManagePage) {
                btnProfile.addEventListener('click', () => this.showProfileSheet());
            }
        }
        
        // Settings button - sadece console sayfasında çalışsın, tenant-manage sayfasında TenantManage class'ı yönetiyor
        const btnSettings = document.getElementById('btn-settings');
        if (btnSettings && !btnSettings.dataset.listenerAdded) {
            // Eğer sayfa console-tenant-manage ise, bu listener'ı ekleme (TenantManage yönetiyor)
            if (document.querySelector('.console-tenant-manage-page')) {
                return;
            }
            btnSettings.dataset.listenerAdded = 'true';
            btnSettings.addEventListener('click', () => this.showSettingsSheet());
        }
        
        // Çıkış butonu
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', () => this.logout());
        }
        
        // ✅ REVIZE-8: Kullanıcılar menu item
        const btnAdminUsers = document.getElementById('btn-admin-users');
        if (btnAdminUsers) {
            btnAdminUsers.addEventListener('click', () => {
                // User menu dropdown'ı kapat
                const userMenu = document.getElementById('user-menu');
                if (userMenu) {
                    userMenu.classList.add('hidden');
                }
                // Kullanıcılar popup'ını aç
                this.showAdminUsersPopup();
            });
        }
    }
    
    // ✅ REVIZE-9: Tema geçiş butonu setup
    setupThemeToggle() {
        const themeToggleBtn = document.getElementById('header-theme-toggle');
        if (!themeToggleBtn) {
            return;
        }
        
        // Mevcut tema durumuna göre ikonları güncelle
        this.updateThemeIcon();
        
        // Event listener ekle
        themeToggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const body = document.body;
            const isNowDark = body.classList.toggle('dark-mode');
            document.documentElement.classList.toggle('dark-mode', isNowDark);
            localStorage.setItem('theme', isNowDark ? 'dark' : 'light');
            
            // appSettings'i güncelle
            try {
                const appSettingsStr = localStorage.getItem('app_settings');
                if (appSettingsStr) {
                    const appSettings = JSON.parse(appSettingsStr);
                    appSettings.darkMode = isNowDark;
                    localStorage.setItem('app_settings', JSON.stringify(appSettings));
                }
            } catch (error) {
                console.error('App settings güncellenirken hata:', error);
            }
            
            // İkonları güncelle
            this.updateThemeIcon();
            
            // Storage event'i tetikle (diğer tab'lar için)
            window.dispatchEvent(new StorageEvent('storage', {
                key: 'theme',
                newValue: isNowDark ? 'dark' : 'light',
                oldValue: isNowDark ? 'light' : 'dark'
            }));
        });
        
        // Storage event listener (diğer tab'lardan gelen değişiklikler için)
        window.addEventListener('storage', (e) => {
            if (e.key === 'theme') {
                const isDark = e.newValue === 'dark';
                if (isDark) {
                    document.documentElement.classList.add('dark-mode');
                    document.body.classList.add('dark-mode');
                } else {
                    document.documentElement.classList.remove('dark-mode');
                    document.body.classList.remove('dark-mode');
                }
                this.updateThemeIcon();
            }
        });
    }
    
    // ✅ REVIZE-9: Tema ikonlarını güncelle
    updateThemeIcon() {
        const themeToggleBtn = document.getElementById('header-theme-toggle');
        if (!themeToggleBtn) {
            return;
        }
        
        const isDark = document.body.classList.contains('dark-mode');
        const sunIcon = themeToggleBtn.querySelector('.theme-icon-sun');
        const moonIcon = themeToggleBtn.querySelector('.theme-icon-moon');
        
        if (sunIcon && moonIcon) {
            if (isDark) {
                sunIcon.style.display = 'none';
                moonIcon.style.display = 'block';
            } else {
                sunIcon.style.display = 'block';
                moonIcon.style.display = 'none';
            }
        }
    }
    
    async loadAdminUser() {
        try {
            // Backend'den güncel veriyi çek
            let adminUser;
            if (window.AdminUserHelpers && window.AdminUserHelpers.fetchAdminUserFromBackend) {
                adminUser = await window.AdminUserHelpers.fetchAdminUserFromBackend();
            } else {
                const adminUserStr = localStorage.getItem('admin_user');
                adminUser = adminUserStr ? JSON.parse(adminUserStr) : {};
            }
            
            if (adminUser) {
                const userNameEl = document.getElementById('user-name');
                const userAvatarEl = document.getElementById('user-avatar');
                const userAvatarImg = document.getElementById('user-avatar-img');
                const userAvatarFallback = document.getElementById('user-avatar-fallback');
                const welcomeTitleEl = document.getElementById('console-welcome-title');
                
                // ✅ REVIZE-8: Hoş geldin mesajını güncelle
                if (welcomeTitleEl) {
                    const name = adminUser.name || '';
                    // İsim ve soyisim ayrı ayrı (eğer varsa)
                    const nameParts = name.split(' ');
                    const firstName = nameParts[0] || '';
                    const lastName = nameParts.slice(1).join(' ') || '';
                    
                    if (firstName || lastName) {
                        const fullName = `${firstName}${lastName ? ' ' + lastName : ''}`;
                        welcomeTitleEl.innerHTML = `Hoş Geldin, <span class="console-welcome-name">${this.escapeHtml(fullName)}</span>`;
                    } else {
                        welcomeTitleEl.textContent = 'Hoş Geldiniz 👋';
                    }
                }
                
                if (userNameEl) {
                    // ✅ REVIZE-13: İsim ve soyisimi birlikte göster
                    const name = adminUser.name || '';
                    const surname = adminUser.surname || '';
                    const fullName = `${name}${surname ? ' ' + surname : ''}`.trim() || adminUser.email || adminUser.kullaniciadi || 'Admin';
                    userNameEl.textContent = fullName;
                    
                    // Avatar initials
                    if (userAvatarFallback) {
                        const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                        userAvatarFallback.textContent = initials;
                    }
                    
                    // Avatar image - Load from users table profil_resmi
                    if (userAvatarImg && adminUser.profil_resmi && adminUser.profil_resmi.trim() !== '') {
                        let imageUrl = adminUser.profil_resmi;
                        
                        // Fix URL if needed
                        if (typeof window.getFloovonUploadUrl === 'function') {
                            imageUrl = window.getFloovonUploadUrl(imageUrl);
                        } else if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
                            const backendBase = window.getFloovonBackendBase ? window.getFloovonBackendBase() : (window.BACKEND_BASE_URL || '');
                            imageUrl = backendBase + (imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl);
                        }
                        
                        // imageUrl boş veya geçersizse görseli yükleme
                        if (imageUrl && imageUrl.trim() !== '' && imageUrl !== '/') {
                            userAvatarImg.src = imageUrl + '?t=' + Date.now();
                        }
                        userAvatarImg.onload = () => {
                            userAvatarImg.classList.remove('hidden');
                            userAvatarImg.classList.add('block');
                            if (userAvatarFallback) {
                                userAvatarFallback.classList.remove('block');
                                userAvatarFallback.classList.add('hidden');
                            }
                        };
                        userAvatarImg.onerror = () => {
                            userAvatarImg.classList.remove('block');
                            userAvatarImg.classList.add('hidden');
                            if (userAvatarFallback) {
                                userAvatarFallback.classList.remove('hidden');
                                userAvatarFallback.classList.add('block');
                            }
                        };
                    }
                    
                }
            }
        } catch (error) {
            console.error('Admin kullanıcı bilgisi yüklenemedi:', error);
        }
    }
    
    async loadStats() {
        try {
            const response = await fetch(`${this.apiBase}/admin/stats`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    this.logout();
                    return;
                }
                throw new Error('İstatistikler yüklenemedi');
            }
            
            const result = await response.json();
            if (result.success) {
                this.stats = result.data;
                this.renderStats();
            }
        } catch (error) {
            console.error('İstatistikler yüklenirken hata:', error);
            if (typeof createToast === 'function') {
                createToast('error', 'İstatistikler yüklenemedi');
            }
        }
    }
    
    renderStats() {
        const statsGrid = document.getElementById('stats-grid');
        if (!statsGrid) return;
        
        const statsData = [
            {
                title: 'Toplam Tenant',
                value: String(this.stats.total_tenants || 0),
                icon: 'globe',
                color: 'text-blue-500',
                bg: 'bg-blue-50',
                description: 'Kayıtlı tüm organizasyonlar'
            },
            {
                title: 'Aktif Tenant',
                value: String(this.stats.active_tenants || 0),
                icon: 'activity',
                color: 'text-emerald-500',
                bg: 'bg-emerald-50',
                description: 'Şu an aktif olanlar'
            },
            {
                title: 'Toplam Kullanıcı',
                value: String(this.stats.total_users || 0),
                icon: 'users',
                color: 'text-violet-500',
                bg: 'bg-violet-50',
                description: 'Sistemdeki toplam hesap'
            },
            {
                title: 'Admin Kullanıcı',
                value: String(this.stats.admin_users || 0),
                icon: 'shield',
                color: 'text-amber-500',
                bg: 'bg-amber-50',
                description: 'Tam yetkili yöneticiler'
            }
        ];
        
        statsGrid.innerHTML = statsData.map(stat => `
            <div>
              <div class="admin-stat-card">
                <div class="admin-stat-card-content">
                  <div class="admin-stat-card-header">
                    <div>
                      <p class="admin-stat-card-title">${stat.title}</p>
                      <h3 class="admin-stat-card-value">${stat.value}</h3>
                      <p class="admin-stat-card-description">${stat.description}</p>
                    </div>
                    <div class="admin-stat-card-icon ${stat.bg}">
                      ${this.getIconSVG(stat.icon, `admin-stat-icon ${stat.color}`)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
        `).join('');
    }
    
    getIconSVG(iconName, className = 'w-5 h-5') {
        // Lucide React icon'larının SVG path'leri
        const icons = {
            // Stats icons
            globe: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' + className + '"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>',
            activity: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' + className + '"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>',
            users: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' + className + '"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
            shield: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' + className + '"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="M9 12l2 2 4-4"></path></svg>',
            shieldCheck: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' + className + '"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="M9 12l2 2 4-4"></path></svg>',
            // Header icons
            layoutDashboard: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' + className + '"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
            search: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' + className + '"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>',
            bell: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' + className + '"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
            user: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' + className + '"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
            settings: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' + className + '"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
            logOut: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' + className + '"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>',
            plus: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' + className + '"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
            // Table action icons
            userCheck: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' + className + '"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline></svg>',
            edit: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' + className + '"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
            moreVertical: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' + className + '"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>',
            power: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' + className + '"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>'
        };
        return icons[iconName] || '';
    }
    
    async loadTenants() {
        try {
            const tbody = document.getElementById('tenants-tbody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="7" class="p-12 text-center text-slate-400">Yükleniyor...</td></tr>';
            }
            
            const response = await fetch(`${this.apiBase}/admin/tenants`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    this.logout();
                    return;
                }
                const errorText = await response.text();
                let errorMessage = 'Tenant listesi yüklenemedi';
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.message || errorData.error || errorMessage;
                } catch (e) {
                    errorMessage = `HTTP ${response.status}: ${errorText.substring(0, 100)}`;
                }
                throw new Error(errorMessage);
            }
            
            const result = await response.json();
            if (result.success) {
                this.tenants = result.data || [];
                this.renderTenants();
            } else {
                throw new Error(result.error || result.message || 'Tenant listesi yüklenemedi');
            }
        } catch (error) {
            console.error('Tenant listesi yüklenirken hata:', error);
            const errorMsg = error.message || 'Tenant listesi yüklenemedi';
            if (typeof createToast === 'function') {
                createToast('error', errorMsg);
            }
            const tbody = document.getElementById('tenants-tbody');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="7" class="p-12 text-center text-red-500">Hata: ${errorMsg}</td></tr>`;
            }
        }
    }
    
    // Ortak fonksiyon: İptal mesajı HTML'i oluştur
    getCancelledPlanMessage(tenant) {
        if ((tenant.plan_status === 'cancelled' || tenant.plan_status === 'expired') && tenant.plan_end_date) {
            const endDate = new Date(tenant.plan_end_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);
            
            const endDateFormatted = endDate.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            
            // Bilgi ikonu SVG (yuvarlak)
            const infoIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; display: inline-block; vertical-align: middle; margin-right: 0.375rem;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
            
            // Bitiş tarihi geçmişse farklı mesaj göster
            if (endDate < today || tenant.plan_status === 'expired') {
                return `<span class="console-panel-plan-expired-text" style="max-width: 100%; word-wrap: break-word; overflow-wrap: break-word; display: flex; align-items: center;">
                    ${infoIcon}
                    <span>Abonelik ${endDateFormatted} itibariyle sonlanmıştır</span>
                </span>`;
            } else {
                return `<span class="console-panel-plan-cancelled-text" style="max-width: 100%; word-wrap: break-word; overflow-wrap: break-word; display: flex; align-items: center;">
                    ${infoIcon}
                    <span>İptal edildi: ${endDateFormatted}'da son bulacak</span>
                </span>`;
            }
        }
        return '';
    }
    
    renderTenants() {
        // Ekran genişliğine göre görünüm belirle (640px altında mobil)
        const isMobile = window.innerWidth < 640;
        const tbody = isMobile ? document.getElementById('tenants-tbody-mobile') : document.getElementById('tenants-tbody');
        if (!tbody) return;
        
        const filteredTenants = this.tenants.filter(t => {
            // Sadece silinmemiş (is_active = 1) tenantları göster - pasif tenantlar da gösterilecek
            if (!(t.is_active === 1 || t.is_active === true)) {
                return false; // Silinmiş tenantları gösterme
            }
            // Pasif tenantlar da listede gösterilecek, sadece durumları "Pasif" olarak görünecek
            
            if (!this.searchQuery || this.searchQuery.trim() === '') {
                return true; // Arama yoksa tüm tenantları göster (aktif ve pasif)
            }
            
            const query = this.searchQuery.toLowerCase();
            const name = (t.name || '').toLowerCase();
            const tenantsNo = (t.tenants_no || '').toLowerCase();
            const city = (t.city || '').toLowerCase();
            const state = (t.state || '').toLowerCase();
            
            // Organizasyon adı, tenant kodu, il veya ilçe bilgisinde arama yap
            return name.includes(query) || 
                   tenantsNo.includes(query) || 
                   city.includes(query) || 
                   state.includes(query);
        });
        
        if (filteredTenants.length === 0) {
            if (isMobile) {
                tbody.innerHTML = '<div class="p-12 text-center text-slate-400">Sonuç bulunamadı.</div>';
            } else {
                tbody.innerHTML = '<tr><td colspan="7" class="p-12 text-center text-slate-400">Sonuç bulunamadı.</td></tr>';
            }
            return;
        }
        
        // Loading mesajını kaldır
        if (isMobile) {
            const mobileLoading = document.getElementById('tenants-tbody-mobile');
            if (mobileLoading) {
                mobileLoading.innerHTML = '';
            }
        } else {
            const desktopLoading = document.getElementById('tenants-tbody');
            if (desktopLoading) {
                desktopLoading.innerHTML = '';
            }
        }
        
        if (isMobile) {
            // Mobil görünüm: Kart görünümü
            const cards = filteredTenants.map(tenant => {
                // Status kolonunu kullan (tenants tablosundaki status alanı)
                const currentStatus = tenant.status || 'pasif';
                const isActive = currentStatus === 'aktif';
                const newStatus = isActive ? 'pasif' : 'aktif';
                const initials = (tenant.name || '').substring(0, 2).toUpperCase();
                // Kullanıcı sayısı backend'den geliyor - VERİTABANINDAN DİNAMİK
                // Backend'de: SELECT COUNT(*) FROM users WHERE tenant_id = ? AND is_active = 1
                const userCount = parseInt(tenant.user_count) || 0;
                // Maksimum kullanıcı limiti - plan bilgisinden geliyor (tenant.max_users)
                // Backend'den gelen max_users'ı kontrol et (undefined, null, string olabilir, 0 geçerli değer olabilir)
                const maxUsersRaw = tenant.max_users !== undefined && tenant.max_users !== null && tenant.max_users !== '' ? tenant.max_users : null;
                const maxUsers = maxUsersRaw !== null ? parseInt(maxUsersRaw) : null;
                
                // Progress bar plana göre hesaplanıyor
                // max_users varsa ve 0'dan büyükse progress bar göster
                const progressWidth = (maxUsers !== null && !isNaN(maxUsers) && maxUsers > 0) ? Math.min((userCount / maxUsers) * 100, 100) : 0;
                
                // Kullanıcı sayısı formatı: plan bilgisi varsa "maxUsers/userCount" (örn: 10/3), yoksa sadece "userCount"
                const userCountDisplay = (maxUsers !== null && !isNaN(maxUsers) && maxUsers > 0) ? `${maxUsers}/${userCount}` : `${userCount}`;
                
                return `
            <div class="console-panel-tenant-card">
                <div class="console-panel-tenant-card-header">
                    <div class="tenant-card-header-content">
                        <div class="tenant-card-header-main">
                            <div class="tenant-card-avatar">
                                ${initials}
                            </div>
                            <div class="tenant-card-info">
                                <div class="tenant-card-code">${tenant.tenants_no || '-'}</div>
                                <div class="tenant-card-name">${tenant.name || '-'}</div>
                            </div>
                        </div>
                        <span class="tenant-card-status-badge ${isActive ? 'console-panel-table-status-active' : 'console-panel-table-status-inactive'}">
                            <span class="console-panel-table-status-dot ${isActive ? 'console-panel-table-status-dot-active' : 'console-panel-table-status-dot-inactive'}"></span>
                            ${isActive ? 'Aktif' : 'Pasif'}
                        </span>
                    </div>
                </div>
                <div class="console-panel-tenant-card-body">
                    <div class="tenant-card-location-row">
                        <span class="tenant-card-label">Konum</span>
                        <span class="tenant-card-location-value">${tenant.city || '-'}${tenant.city && tenant.state ? ' / ' : ''}${tenant.state || ''}</span>
                    </div>
                    <div class="tenant-card-users-row">
                        <span class="tenant-card-label">Kullanıcı Sayısı</span>
                        <div class="tenant-card-users-content">
                            <div class="tenant-card-progress-container">
                                <div class="tenant-card-progress-bar" data-width="${progressWidth}" style="width: ${progressWidth}%; --progress-width: ${progressWidth}%;"></div>
                            </div>
                            <span class="tenant-card-users-count">${userCountDisplay}</span>
                        </div>
                    </div>
                    <div class="tenant-card-plan-row">
                        <span class="tenant-card-label">Abonelik Paketi</span>
                        <div style="display: flex; flex-direction: column; gap: 0.25rem; max-width: 100%;">
                            <div style="display: flex; align-items: center; gap: 0.375rem; flex-wrap: wrap;">
                                ${tenant.plan_status === 'expired' ? '' : (tenant.plan_name && tenant.plan_name !== 'Abonelik Yok' ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; color: var(--console-primary);"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>` : '')}
                                <span class="tenant-card-plan-value ${tenant.plan_status === 'expired' || !tenant.plan_name || tenant.plan_name === 'Abonelik Yok' ? 'no-subscription-badge' : ''}">${tenant.plan_status === 'expired' ? 'Abonelik Yok' : (tenant.plan_name || 'Abonelik Yok')}</span>
                            </div>
                            ${this.getCancelledPlanMessage(tenant)}
                        </div>
                    </div>
                    <div class="tenant-card-actions">
                        <a href="/console-tenant-manage?tenant_id=${tenant.id}" class="console-panel-table-action-btn console-tenant-manage-btn">
                            ${this.getIconSVG('userCheck', 'console-panel-table-action-icon')}
                            Yönet
                        </a>
                        <button data-action="edit-tenant" data-tenant-id="${tenant.id}" class="console-panel-table-action-btn console-tenant-edit-btn">
                            ${this.getIconSVG('edit', 'console-panel-table-action-icon')}
                            Düzenle
                        </button>
                        <div class="console-panel-table-dropdown-container" id="dropdown-menu-${tenant.id}">
                          <button data-action="toggle-dropdown" data-tenant-id="${tenant.id}" class="console-panel-table-dropdown-toggle">
                            ${this.getIconSVG('moreVertical', 'console-panel-table-dropdown-icon')}
                          </button>
                          <div id="dropdown-content-${tenant.id}" class="tenant-dropdown-menu hidden">
                            <button data-action="toggle-status" data-tenant-id="${tenant.id}" class="console-panel-table-dropdown-item console-flex-center-gap ${isActive ? 'console-panel-table-dropdown-item-disable' : 'console-panel-table-dropdown-item-enable'}">
                              ${this.getIconSVG('power', isActive ? 'console-panel-table-dropdown-icon-red' : 'console-panel-table-dropdown-icon-green')}
                              ${isActive ? 'Devre Dışı Bırak' : 'Aktif Yap'}
                            </button>
                          </div>
                        </div>
                    </div>
                </div>
            </div>
            `;
        }).join('');
        
        tbody.innerHTML = cards;
        } else {
            // Desktop görünüm: Tablo görünümü
            const rows = filteredTenants.map(tenant => {
                // Status kolonunu kullan (tenants tablosundaki status alanı)
                const currentStatus = tenant.status || 'pasif';
                const isActive = currentStatus === 'aktif';
                const initials = (tenant.name || '').substring(0, 2).toUpperCase();
                // Kullanıcı sayısı backend'den geliyor
                const userCount = parseInt(tenant.user_count) || 0;
                // Maksimum kullanıcı limiti - plan bilgisinden geliyor (tenant.max_users)
                // Backend'den gelen max_users'ı kontrol et (undefined, null, string olabilir, 0 geçerli değer olabilir)
                const maxUsersRaw = tenant.max_users !== undefined && tenant.max_users !== null && tenant.max_users !== '' ? tenant.max_users : null;
                const maxUsers = maxUsersRaw !== null ? parseInt(maxUsersRaw) : null;
                
                // Progress bar plana göre hesaplanıyor
                // max_users varsa ve 0'dan büyükse progress bar göster
                const progressWidth = (maxUsers !== null && !isNaN(maxUsers) && maxUsers > 0) ? Math.min((userCount / maxUsers) * 100, 100) : 0;
                const location = `${tenant.city || '-'}${tenant.city && tenant.state ? ' / ' : ''}${tenant.state || ''}`;
                
                // Kullanıcı sayısı formatı: plan bilgisi varsa "maxUsers/userCount" (örn: 10/3), yoksa sadece "userCount"
                const userCountDisplay = (maxUsers !== null && !isNaN(maxUsers) && maxUsers > 0) ? `${maxUsers}/${userCount}` : `${userCount}`;
                
                return `
                <tr class="console-panel-table-row">
                    <td class="console-panel-table-cell console-panel-table-cell-id">${tenant.id}</td>
                    <td class="console-panel-table-cell">
                        <span class="console-panel-table-cell-text-code" style="font-size: 14pt;">${tenant.tenants_no || '-'}</span>
                    </td>
                    <td class="console-panel-table-cell console-panel-table-cell-name">
                        <div class="console-flex-center-gap-lg">
                            <div class="console-panel-table-tenant-avatar-initials">
                                ${initials}
                            </div>
                            <span class="console-panel-table-cell-text-medium admin-title-letter-spacing">${tenant.name || '-'}</span>
                        </div>
                    </td>
                    <td class="console-panel-table-cell console-panel-table-cell-location">
                        <span class="console-panel-table-cell-text-sm">${tenant.city || '-'}${tenant.city && tenant.state ? ' / ' : ''}${tenant.state || ''}</span>
                    </td>
                    <td class="console-panel-table-cell console-panel-table-cell-users">
                        <div class="console-flex-center-gap">
                            <div class="console-panel-table-progress-container">
                                <div class="console-panel-table-progress-fill tenant-progress-bar" data-width="${progressWidth}" style="width: ${progressWidth}%; --progress-width: ${progressWidth}%;"></div>
                            </div>
                            <span class="console-panel-table-cell-text-xs">${userCountDisplay}</span>
                        </div>
                    </td>
                    <td class="console-panel-table-cell console-panel-table-cell-plan">
                        <div style="display: flex; flex-direction: column; gap: 0.25rem; max-width: 100%;">
                            <div style="display: flex; align-items: center; gap: 0.375rem; flex-wrap: wrap;">
                                ${tenant.plan_status === 'expired' ? '' : (tenant.plan_name && tenant.plan_name !== 'Abonelik Yok' ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; color: var(--console-primary);"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>` : '')}
                                <span class="console-panel-table-cell-text-sm ${tenant.plan_status === 'expired' || !tenant.plan_name || tenant.plan_name === 'Abonelik Yok' ? 'no-subscription-badge' : ''}">${tenant.plan_status === 'expired' ? 'Abonelik Yok' : (tenant.plan_name || 'Abonelik Yok')}</span>
                            </div>
                            ${this.getCancelledPlanMessage(tenant)}
                        </div>
                    </td>
                    <td class="console-panel-table-cell console-panel-table-cell-status">
                        <span class="console-panel-table-status-badge ${isActive ? 'console-panel-table-status-active' : 'console-panel-table-status-inactive'}">
                            <span class="console-panel-table-status-dot ${isActive ? 'console-panel-table-status-dot-active' : 'console-panel-table-status-dot-inactive'}"></span>
                            ${isActive ? 'Aktif' : 'Pasif'}
                        </span>
                    </td>
                    <td class="console-panel-table-cell console-panel-table-cell-actions">
                        <div class="console-panel-table-actions">
                            <a href="/console-tenant-manage?tenant_id=${tenant.id}" class="console-panel-table-action-btn console-tenant-manage-btn">
                                ${this.getIconSVG('userCheck', 'console-panel-table-action-icon')}
                                Yönet
                            </a>
                            <button data-action="edit-tenant" data-tenant-id="${tenant.id}" class="console-panel-table-action-btn console-tenant-edit-btn">
                                ${this.getIconSVG('edit', 'console-panel-table-action-icon')}
                                Düzenle
                            </button>
                            <div class="console-panel-table-dropdown-container" id="dropdown-menu-${tenant.id}">
                              <button data-action="toggle-dropdown" data-tenant-id="${tenant.id}" class="console-panel-table-dropdown-toggle">
                                ${this.getIconSVG('moreVertical', 'console-panel-table-dropdown-icon')}
                              </button>
                              <div id="dropdown-content-${tenant.id}" class="tenant-dropdown-menu hidden">
                                <button data-action="toggle-status" data-tenant-id="${tenant.id}" class="console-panel-table-dropdown-item console-flex-center-gap ${isActive ? 'console-panel-table-dropdown-item-disable' : 'console-panel-table-dropdown-item-enable'}">
                                  ${this.getIconSVG('power', isActive ? 'console-panel-table-dropdown-icon-red' : 'console-panel-table-dropdown-icon-green')}
                                  ${isActive ? 'Devre Dışı Bırak' : 'Aktif Yap'}
                                </button>
                              </div>
                            </div>
                        </div>
                    </td>
                </tr>
                `;
            }).join('');
            
            tbody.innerHTML = rows;
        }
        
        // Event listener'ları ekle (inline onclick'ler yerine)
        const targetTbody = isMobile ? document.getElementById('tenants-tbody-mobile') : document.getElementById('tenants-tbody');
        if (targetTbody) {
            targetTbody.querySelectorAll('[data-action="edit-tenant"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const tenantId = parseInt(btn.getAttribute('data-tenant-id'));
                    if (tenantId) {
                        this.editTenant(tenantId);
                    }
                });
            });
            
            targetTbody.querySelectorAll('[data-action="toggle-dropdown"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const tenantId = parseInt(btn.getAttribute('data-tenant-id'));
                    if (tenantId) {
                        this.toggleDropdownMenu(tenantId);
                    } else {
                        console.warn('⚠️ Tenant ID bulunamadı:', btn);
                    }
                });
            });
            
            targetTbody.querySelectorAll('[data-action="toggle-status"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const tenantId = parseInt(btn.getAttribute('data-tenant-id'));
                    if (tenantId) {
                        this.openStatusDialog(tenantId);
                    }
                });
            });
        }
        
        // Progress bar width'lerini set et (CSS variable kullanarak)
        setTimeout(() => {
            tbody.querySelectorAll('.tenant-progress-bar[data-width]').forEach(bar => {
                const width = bar.getAttribute('data-width');
                // CSS variable kullan (inline style yerine)
                bar.style.setProperty('--progress-width', `${width}%`);
            });
        }, 0);
    }
    
    manageTenant(id) {
        window.location.href = `/console-tenant-manage?tenant_id=${id}`;
    }
    
    async editTenant(id) {
        const listTenant = this.tenants.find(t => t.id === id);
        if (!listTenant) {
            console.error('❌ Tenant bulunamadı:', id);
            return;
        }
        
        // Liste API’si email/phone döndürmüyor; formu doldurmak için detay API’den çek
        let tenant;
        try {
            const response = await fetch(`${this.apiBase}/admin/tenants/${id}`, {
                headers: { 'Authorization': `Bearer ${this.adminToken}` },
                cache: 'no-store'
            });
            const result = await response.json();
            if (!result.success || !result.data) {
                if (typeof createToast === 'function') createToast('error', result.error || 'Tenant bilgisi alınamadı');
                return;
            }
            tenant = result.data;
        } catch (e) {
            console.error('❌ Tenant detay çekilemedi:', e);
            if (typeof createToast === 'function') createToast('error', 'Tenant bilgisi yüklenemedi');
            return;
        }
        
        // AdminComponents kontrolü
        if (!window.AdminComponents || !window.AdminComponents.createSheet) {
            console.error('❌ AdminComponents yüklenmemiş!');
            if (typeof createToast === 'function') {
                createToast('error', 'Sayfa bileşenleri yüklenemedi. Lütfen sayfayı yenileyin.');
            }
            return;
        }
        
        if (!this.sheets.editTenant) {
            this.createEditTenantSheet();
        }
        
        if (!this.sheets.editTenant) {
            console.error('❌ Edit tenant sheet oluşturulamadı!');
            return;
        }
        
        // Sheet'i önce DOM'a ekle
        this.sheets.editTenant.dataset.tenantId = id;
        if (!document.body.contains(this.sheets.editTenant)) {
            document.body.appendChild(this.sheets.editTenant);
        }
        
        // Sheet'i aç (requestAnimationFrame ile bir sonraki frame'de aç)
        requestAnimationFrame(() => {
            if (this.sheets.editTenant && this.sheets.editTenant.update) {
                this.sheets.editTenant.update(true);
            }
            
            // Sheet açıldıktan sonra form'u doldur (tenant = API detay, email/phone dahil)
            const fillForm = () => {
                // Sheet içindeki form elementlerine eriş
                const sheetElement = this.sheets.editTenant;
                if (!sheetElement) {
                    console.warn('⚠️ Sheet elementi bulunamadı');
                    return false;
                }
                
                // Sheet içinde arama yap
                const nameInput = sheetElement.querySelector('#edit-tenant-name') || document.getElementById('edit-tenant-name');
                const emailInput = sheetElement.querySelector('#edit-tenant-email') || document.getElementById('edit-tenant-email');
                const phoneInput = sheetElement.querySelector('#edit-tenant-phone') || document.getElementById('edit-tenant-phone');
                const citySelect = sheetElement.querySelector('#edit-tenant-city') || document.getElementById('edit-tenant-city');
                const stateSelect = sheetElement.querySelector('#edit-tenant-state') || document.getElementById('edit-tenant-state');
                
                if (!nameInput || !emailInput) {
                    return false;
                }
                
                // Temel alanları doldur
                nameInput.value = tenant.name || '';
                emailInput.value = tenant.email || '';
                if (phoneInput) {
                    // Veritabanından E.164 formatında geliyor (+90XXXXXXXXXX) veya eski formatlar
                    let phoneValue = tenant.phone || '';
                    
                    // Display formatına çevir (+90 (5xx) xxx xx xx)
                    if (phoneValue) {
                        // Önce E.164 formatına normalize et
                        let e164Value = phoneValue;
                        if (typeof toE164TR === 'function' && !phoneValue.startsWith('+90')) {
                            e164Value = toE164TR(phoneValue);
                        }
                        
                        // E.164 formatını display formatına çevir
                        if (e164Value && typeof toDisplayTR === 'function') {
                            phoneValue = toDisplayTR(e164Value);
                            
                            // Eğer boş string döndüyse, direkt E.164 formatını kullan
                            if (!phoneValue && e164Value) {
                                // E.164 formatından rakamları çıkar ve manuel formatla
                                const digits = e164Value.replace(/\D/g, '');
                                if (digits.length === 12 && digits.startsWith('90')) {
                                    const phoneDigits = digits.substring(2);
                                    if (phoneDigits.length === 10) {
                                        phoneValue = `+90 (${phoneDigits.substring(0, 3)}) ${phoneDigits.substring(3, 6)} ${phoneDigits.substring(6, 8)} ${phoneDigits.substring(8, 10)}`;
                                    }
                                }
                            }
                        }
                        
                        // Hala boşsa varsayılan değer
                        if (!phoneValue) {
                            phoneValue = '+90 (';
                        }
                    } else {
                        phoneValue = '+90 (';
                    }
                    
                    // ✅ YENİ EKLE FORMUNDAKİ GİBİ - Önce formatlama attribute'larını temizle
                    phoneInput.removeAttribute('data-phone-formatted');
                    phoneInput.removeAttribute('data-telefon-mask-applied');
                    phoneInput.removeAttribute('data-tr-phone-mask');
                    // ✅ Validation state'ini de temizle (her açılışta fresh validation için)
                    phoneInput.setCustomValidity('');
                    phoneInput.classList.remove('input-error');
                    
                    // Değeri set et
                    phoneInput.value = phoneValue;
                    
                    // ✅ Sadece setupPhoneInput kullan - validation ekleme, setupPhoneInput zaten hallediyor
                    if (typeof window.setupPhoneInput === 'function') {
                        window.setupPhoneInput(phoneInput);
                    } else if (typeof attachTRPhoneMask === 'function') {
                        attachTRPhoneMask(phoneInput);
                    }
                } else {
                    // Phone input yoksa oluştur ve mask uygula - YENİ EKLE FORMUNDAKİ GİBİ
                    if (phoneInput) {
                        // Formatlama attribute'larını temizle
                        phoneInput.removeAttribute('data-phone-formatted');
                        phoneInput.removeAttribute('data-telefon-mask-applied');
                        phoneInput.removeAttribute('data-tr-phone-mask');
                        
                        phoneInput.value = '+90 (';
                        if (typeof window.setupPhoneInput === 'function') {
                            window.setupPhoneInput(phoneInput);
                        } else if (typeof attachTRPhoneMask === 'function') {
                            attachTRPhoneMask(phoneInput);
                        }
                    }
                }
                
                // City select'i doldur ve seçili değeri set et
                if (citySelect && window.__TR_ADDR__ && window.__TR_ADDR__.provinces) {
                    // Önce mevcut option'ları temizle (varsa)
                    citySelect.innerHTML = '<option value="">İl Seçiniz</option>';
                    window.__TR_ADDR__.provinces.forEach(province => {
                        const option = document.createElement('option');
                        option.value = province.name;
                        option.textContent = province.name;
                        citySelect.appendChild(option);
                    });
                    
                    // Seçili değeri set et
                    if (tenant.city) {
                        citySelect.value = tenant.city;
                        
                        // City değiştiğinde ilçe listesini yükle
                        if (stateSelect) {
                            const selectedCity = tenant.city;
                            stateSelect.innerHTML = '<option value="">İlçe Seçiniz</option>';
                            
                            const province = window.__TR_ADDR__.provinces.find(p => p.name === selectedCity);
                            if (province) {
                                // ID'yi string ve number olarak dene
                                const provinceId = province.id;
                                const districts = window.__TR_ADDR__.districtsByProv[provinceId] || 
                                                window.__TR_ADDR__.districtsByProv[String(provinceId)] ||
                                                window.__TR_ADDR__.districtsByProv[Number(provinceId)];
                                if (districts && districts.length > 0) {
                                    districts.forEach(district => {
                                        const option = document.createElement('option');
                                        option.value = district.name;
                                        option.textContent = district.name;
                                        stateSelect.appendChild(option);
                                    });
                                    // Seçili değeri set et
                                    if (tenant.state) {
                                        stateSelect.value = tenant.state;
                                    }
                                }
                            }
                        }
                    }
                } else if (citySelect && (!window.__TR_ADDR__ || !window.__TR_ADDR__.provinces)) {
                    citySelect.innerHTML = '<option value="">Yükleniyor...</option>';
                }
                
                // OriginalValues'u güncelle (form kontrolü için)
                if (sheetElement.dataset.originalValues) {
                    const originalValues = JSON.parse(sheetElement.dataset.originalValues);
                    originalValues.name = tenant.name || '';
                    originalValues.email = tenant.email || '';
                    originalValues.phone = tenant.phone || '';
                    originalValues.city = tenant.city || '';
                    originalValues.state = tenant.state || '';
                    sheetElement.dataset.originalValues = JSON.stringify(originalValues);
                }
                
                return true;
            };
            
            // Birden fazla deneme yap (sheet açılması zaman alabilir)
            let attempts = 0;
            const maxAttempts = 10;
            const tryFillForm = () => {
                attempts++;
                if (fillForm()) {
                    return;
                }
                if (attempts < maxAttempts) {
                    setTimeout(tryFillForm, 100 * attempts); // Her denemede bekleme süresini artır
                } else {
                    console.error('❌ Form doldurulamadı! (Max deneme sayısına ulaşıldı)');
                }
            };
            
            // İlk deneme
            setTimeout(tryFillForm, 100);
        });
    }
    
    createEditTenantSheet() {
        if (!window.AdminComponents || !window.AdminComponents.createSheet) {
            console.error('❌ AdminComponents.createSheet bulunamadı!');
            if (typeof createToast === 'function') {
                createToast('error', 'Sayfa bileşenleri yüklenemedi. Lütfen sayfayı yenileyin.');
            }
            return;
        }
        
        const { createSheet, createSheetHeader, createSheetTitle, createSheetDescription, createSheetContent, createSheetFooter, createInput, createLabel, createButton } = window.AdminComponents;
        
        // Form kontrolü için callback
        let closeEditTenantSheetCallback = null;
        
        const sheet = createSheet({
            id: 'edit-tenant-modal-overlay',
            side: 'right',
            open: false,
            onClose: () => {
                if (closeEditTenantSheetCallback) {
                    closeEditTenantSheetCallback(false);
                }
            }
        });
        
        if (!sheet) {
            console.error('❌ Sheet oluşturulamadı!');
            return;
        }
        
        // Modal Header - Manage sayfasındaki gibi
        const header = document.createElement('div');
        header.className = 'modal-header';
        const headerContent = document.createElement('div');
        headerContent.className = 'modal-header-content';
        const titleIcon = document.createElement('div');
        titleIcon.className = 'modal-header-icon';
        titleIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
        headerContent.appendChild(titleIcon);
        const headerText = document.createElement('div');
        headerText.className = 'modal-header-text';
        const title = document.createElement('h2');
        title.textContent = 'Tenant Düzenle';
        headerText.appendChild(title);
        const desc = document.createElement('p');
        desc.className = 'modal-description';
        desc.textContent = 'Organizasyon bilgilerini güncelleyin.';
        headerText.appendChild(desc);
        headerContent.appendChild(headerText);
        header.appendChild(headerContent);
        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close';
        closeBtn.innerHTML = '×';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.onclick = () => {
            if (closeEditTenantSheetCallback) {
                closeEditTenantSheetCallback(false);
            }
        };
        header.appendChild(closeBtn);
        
        // Modal Body - Form içinde
        const form = document.createElement('form');
        form.id = 'edit-tenant-form';
        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        
        const nameGroup = document.createElement('div');
        nameGroup.className = 'form-group';
        const nameLabel = document.createElement('label');
        nameLabel.htmlFor = 'edit-tenant-name';
        nameLabel.innerHTML = 'Organizasyon Adı <span class="text-red-500">*</span>';
        nameGroup.appendChild(nameLabel);
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.id = 'edit-tenant-name';
        nameInput.name = 'name';
        nameInput.placeholder = 'Organizasyon adı';
        nameInput.required = true;
        nameGroup.appendChild(nameInput);
        modalBody.appendChild(nameGroup);
        
        const emailGroup = document.createElement('div');
        emailGroup.className = 'form-group';
        const emailLabel = document.createElement('label');
        emailLabel.htmlFor = 'edit-tenant-email';
        emailLabel.innerHTML = 'E-posta <span class="text-red-500">*</span>';
        emailGroup.appendChild(emailLabel);
        const emailInput = document.createElement('input');
        emailInput.type = 'email';
        emailInput.id = 'edit-tenant-email';
        emailInput.name = 'email';
        emailInput.placeholder = 'info@ornek.com';
        emailInput.required = true;
        emailGroup.appendChild(emailInput);
        modalBody.appendChild(emailGroup);
        
        const phoneGroup = document.createElement('div');
        phoneGroup.className = 'form-group';
        const phoneLabel = document.createElement('label');
        phoneLabel.htmlFor = 'edit-tenant-phone';
        phoneLabel.innerHTML = 'Telefon <span class="text-red-500">*</span>';
        phoneGroup.appendChild(phoneLabel);
        const phoneInput = document.createElement('input');
        phoneInput.type = 'tel';
        phoneInput.id = 'edit-tenant-phone';
        phoneInput.name = 'phone';
        phoneInput.placeholder = '+90 (5XX) XXX XX XX';
        phoneInput.required = true;
        phoneGroup.appendChild(phoneInput);
        modalBody.appendChild(phoneGroup);
        
        // ✅ Telefon input formatı: +90 (5XX) XXX XX XX - YENİ EKLE FORMUNDAKİ GİBİ
        // Sadece setupPhoneInput kullan, clone yapma, validation ekleme - setupPhoneInput zaten hallediyor
        if (phoneInput) {
            if (typeof window.setupPhoneInput === 'function') {
                window.setupPhoneInput(phoneInput);
            } else if (typeof attachTRPhoneMask === 'function') {
                attachTRPhoneMask(phoneInput);
            }
        }
        
        // E-posta validation ekle
        if (emailInput && typeof validateEmailInput === 'function') {
            emailInput.addEventListener('blur', () => {
                validateEmailInput(emailInput, true);
            });
            emailInput.addEventListener('input', () => {
                hideInputError(emailInput);
            });
        }
        
        // City (İl) Select
        const cityGroup = document.createElement('div');
        cityGroup.className = 'form-group';
        const cityLabel = document.createElement('label');
        cityLabel.htmlFor = 'edit-tenant-city';
        cityLabel.textContent = 'İl';
        cityGroup.appendChild(cityLabel);
        const citySelect = document.createElement('select');
        citySelect.id = 'edit-tenant-city';
        citySelect.name = 'city';
        citySelect.className = 'form-input';
        const cityOptionDefault = document.createElement('option');
        cityOptionDefault.value = '';
        cityOptionDefault.textContent = 'İl Seçiniz';
        citySelect.appendChild(cityOptionDefault);
        // Populate cities from location data
        if (window.__TR_ADDR__ && window.__TR_ADDR__.provinces) {
            window.__TR_ADDR__.provinces.forEach(province => {
                const option = document.createElement('option');
                option.value = province.name;
                option.textContent = province.name;
                citySelect.appendChild(option);
            });
        }
        cityGroup.appendChild(citySelect);
        modalBody.appendChild(cityGroup);
        
        // State (İlçe) Select
        const stateGroup = document.createElement('div');
        stateGroup.className = 'form-group';
        const stateLabel = document.createElement('label');
        stateLabel.htmlFor = 'edit-tenant-state';
        stateLabel.textContent = 'İlçe';
        stateGroup.appendChild(stateLabel);
        const stateSelect = document.createElement('select');
        stateSelect.id = 'edit-tenant-state';
        stateSelect.name = 'state';
        stateSelect.className = 'form-input';
        const stateOptionDefault = document.createElement('option');
        stateOptionDefault.value = '';
        stateOptionDefault.textContent = 'İlçe Seçiniz';
        stateSelect.appendChild(stateOptionDefault);
        stateGroup.appendChild(stateSelect);
        modalBody.appendChild(stateGroup);
        
        form.appendChild(modalBody);
        
        // Update districts when city changes
        citySelect.addEventListener('change', (e) => {
            const selectedCity = e.target.value;
            if (!stateSelect) {
                console.error('❌ stateSelect bulunamadı!');
                return;
            }
            
            stateSelect.innerHTML = '<option value="">İlçe Seçiniz</option>';
            
            
            if (selectedCity && window.__TR_ADDR__ && window.__TR_ADDR__.provinces) {
                const province = window.__TR_ADDR__.provinces.find(p => p.name === selectedCity);
                
                if (province) {
                    // ID'yi string ve number olarak dene
                    const provinceId = province.id;
                    const districts = window.__TR_ADDR__.districtsByProv[provinceId] || 
                                    window.__TR_ADDR__.districtsByProv[String(provinceId)] ||
                                    window.__TR_ADDR__.districtsByProv[Number(provinceId)];
                    
                    if (districts && districts.length > 0) {
                        districts.forEach(district => {
                            const option = document.createElement('option');
                            option.value = district.name;
                            option.textContent = district.name;
                            stateSelect.appendChild(option);
                        });
                    } else {
                        console.warn('⚠️ Bu il için ilçe bulunamadı (ID:', provinceId, ')');
                    }
                } else {
                    console.warn('⚠️ İl bulunamadı:', selectedCity);
                }
            } else {
                console.warn('⚠️ Location data yüklenmemiş veya il seçilmemiş');
            }
        });
        
        // Orijinal değerleri sakla (değişiklik takibi için)
        let originalValues = {
            name: '',
            email: '',
            phone: '',
            city: '',
            state: ''
        };
        
        // Sheet'e originalValues'u kaydet (editTenant fonksiyonundan erişilebilir olması için)
        sheet.dataset.originalValues = JSON.stringify(originalValues);
        
        // Form değişiklik takibi için flag
        let formHasChanges = false;
        
        // Değişiklik kontrolü fonksiyonu
        const checkFormChanges = () => {
            // originalValues'u sheet'ten oku
            if (sheet.dataset.originalValues) {
                originalValues = JSON.parse(sheet.dataset.originalValues);
            }
            
            const currentName = nameInput.value.trim();
            const currentEmail = emailInput.value.trim();
            const currentPhone = phoneInput.value.trim();
            const currentCity = citySelect.value;
            const currentState = stateSelect.value;
            
            formHasChanges = (
                currentName !== originalValues.name ||
                currentEmail !== originalValues.email ||
                currentPhone !== originalValues.phone ||
                currentCity !== originalValues.city ||
                currentState !== originalValues.state
            );
        };
        
        // Input değişikliklerini dinle
        nameInput.addEventListener('input', checkFormChanges);
        nameInput.addEventListener('change', checkFormChanges);
        emailInput.addEventListener('input', checkFormChanges);
        emailInput.addEventListener('change', checkFormChanges);
        phoneInput.addEventListener('input', checkFormChanges);
        phoneInput.addEventListener('change', checkFormChanges);
        
        // Telefon validation ekle - önceki event listener'ları temizle
        if (phoneInput && typeof validatePhoneInput === 'function') {
            // Önceki event listener'ları kaldırmak için clone yap
            const newPhoneInput = phoneInput.cloneNode(true);
            if (phoneInput.parentNode) {
                phoneInput.parentNode.replaceChild(newPhoneInput, phoneInput);
            }
            
            // Yeni input'a event listener'ları ekle
            // Input değiştiğinde hata mesajını temizle
            newPhoneInput.addEventListener('input', () => {
                if (typeof hideInputError === 'function') {
                    hideInputError(newPhoneInput);
                }
            });
            // Blur event'inde kontrol et (kullanıcı input'tan çıktığında)
            newPhoneInput.addEventListener('blur', () => {
                validatePhoneInput(newPhoneInput, true);
            });
            
            // attachTRPhoneMask'ı yeniden uygula
            if (typeof attachTRPhoneMask === 'function') {
                attachTRPhoneMask(newPhoneInput);
            }
            
            // İlk yüklemede kontrol et (eğer değer varsa)
            if (newPhoneInput.value && newPhoneInput.value !== '+90 (' && newPhoneInput.value !== '' && newPhoneInput.value !== '0 (5') {
                setTimeout(() => {
                    validatePhoneInput(newPhoneInput, true);
                }, 100);
            }
        }
        
        citySelect.addEventListener('change', checkFormChanges);
        stateSelect.addEventListener('change', checkFormChanges);
        
        // Form kapatma fonksiyonu (değişiklik kontrolü ile)
        const closeEditTenantSheet = (force = false) => {
            // Clear all input error tooltips when closing
            if (typeof clearAllInputErrors === 'function') {
                clearAllInputErrors();
            }
            if (!force && formHasChanges) {
                // Değişiklik var, kullanıcıya sor
                if (typeof createToastInteractive === 'function') {
                    createToastInteractive({
                        message: 'Değişiklikleri kaydetmek istiyor musunuz?',
                        confirmText: 'Kaydet',
                        cancelText: 'Vazgeç',
                        onConfirm: async () => {
                            // Kaydet butonuna tıkla
                            saveBtn.click();
                        },
                        onCancel: () => {
                            // Clear all input error tooltips when closing
                            if (typeof clearAllInputErrors === 'function') {
                                clearAllInputErrors();
                            }
                            
                            // originalValues'u sheet'ten oku
                            if (sheet.dataset.originalValues) {
                                originalValues = JSON.parse(sheet.dataset.originalValues);
                            }
                            
                            // Değişiklikleri sıfırla ve kapat
                            nameInput.value = originalValues.name;
                            emailInput.value = originalValues.email;
                            phoneInput.value = originalValues.phone;
                            citySelect.value = originalValues.city;
                            stateSelect.value = originalValues.state;
                            
                            this.sheets.editTenant.update(false);
                            setTimeout(() => {
                                if (this.sheets.editTenant && this.sheets.editTenant.parentNode) {
                                    this.sheets.editTenant.parentNode.removeChild(this.sheets.editTenant);
                                    this.sheets.editTenant = null;
                                }
                            }, 300);
                        }
                    });
                } else {
                    // Interactive toast yoksa direkt kapat
                    // Clear all input error tooltips when closing
                    if (typeof clearAllInputErrors === 'function') {
                        clearAllInputErrors();
                    }
                    
                    this.sheets.editTenant.update(false);
                    setTimeout(() => {
                        if (this.sheets.editTenant && this.sheets.editTenant.parentNode) {
                            this.sheets.editTenant.parentNode.removeChild(this.sheets.editTenant);
                            this.sheets.editTenant = null;
                        }
                        // Clear all input error tooltips after modal is removed
                        if (typeof clearAllInputErrors === 'function') {
                            clearAllInputErrors();
                        }
                    }, 300);
                }
            } else {
                // Değişiklik yok veya zorla kapat
                this.sheets.editTenant.update(false);
                setTimeout(() => {
                    if (this.sheets.editTenant && this.sheets.editTenant.parentNode) {
                        this.sheets.editTenant.parentNode.removeChild(this.sheets.editTenant);
                        this.sheets.editTenant = null;
                    }
                    // Clear all input error tooltips after modal is removed
                    if (typeof clearAllInputErrors === 'function') {
                        clearAllInputErrors();
                    }
                }, 300);
            }
        };
        
        // Callback'i ata
        closeEditTenantSheetCallback = closeEditTenantSheet;
        
        // Close button'a event listener ekle
        // Close button zaten createSheetHeader içinde eklendi
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const tenantId = parseInt(this.sheets.editTenant.dataset.tenantId);
            
            // Form elementlerine güncel referanslarla eriş
            const currentNameInput = form.querySelector('#edit-tenant-name') || nameInput;
            const currentEmailInput = form.querySelector('#edit-tenant-email') || emailInput;
            const currentPhoneInput = form.querySelector('#edit-tenant-phone') || phoneInput;
            const currentCitySelect = form.querySelector('#edit-tenant-city') || citySelect;
            const currentStateSelect = form.querySelector('#edit-tenant-state') || stateSelect;
            
            const name = currentNameInput ? currentNameInput.value.trim() : '';
            const email = currentEmailInput ? currentEmailInput.value.trim() : '';
            let phone = currentPhoneInput ? currentPhoneInput.value.trim() : '';
            
            // ✅ Telefon validation kontrolü - Required field olduğu için her zaman kontrol et
            // ÖNEMLİ: Her submit'te validation state'ini temizle ve yeniden kontrol et
            if (currentPhoneInput) {
                // Validation state'ini temizle (her submit'te fresh validation için)
                currentPhoneInput.setCustomValidity('');
                currentPhoneInput.classList.remove('input-error');
                
                if (typeof validatePhoneInput === 'function') {
                    // Telefon numarası boş veya sadece "+90 (" ise kontrol et
                    if (!phone || phone === '+90 (' || phone.trim() === '' || phone === '+90') {
                        // Required field boş - validation göster
                        currentPhoneInput.setCustomValidity('Telefon numarası gereklidir! +90 (XXX) XXX XX XX formatında yazınız.');
                        currentPhoneInput.reportValidity();
                        currentPhoneInput.focus();
                        return;
                    }
                    
                    // Telefon numarası var ama format/eksik kontrolü
                    if (!validatePhoneInput(currentPhoneInput, false)) {
                        // Tooltip göster
                        validatePhoneInput(currentPhoneInput, true);
                        currentPhoneInput.focus();
                        return;
                    }
                }
            }
            
            // Telefon numarasını E.164 formatına çevir (+90XXXXXXXXXX)
            if (phone && typeof toE164TR === 'function') {
                phone = toE164TR(phone);
            } else if (phone) {
                // Fallback: manuel normalize
                const digits = phone.replace(/\D/g, '');
                if (digits.length === 10 && digits.startsWith('5')) {
                    phone = '+90' + digits;
                } else if (digits.length === 11 && digits.startsWith('0')) {
                    phone = '+90' + digits.substring(1);
                } else if (digits.length >= 10) {
                    phone = '+90' + digits.substring(digits.length - 10);
                } else {
                    phone = null;
                }
            }
            const city = currentCitySelect ? currentCitySelect.value : '';
            const state = currentStateSelect ? currentStateSelect.value : '';
            
            if (!name) {
                if (typeof createToast === 'function') {
                    createToast('warning', 'Lütfen organizasyon adını girin');
                }
                return;
            }
            this.saveTenant(tenantId, { name, email, phone, city, state });
            
            // Orijinal değerleri güncelle (artık değişiklik yok)
            originalValues = { name, email, phone, city, state };
            sheet.dataset.originalValues = JSON.stringify(originalValues);
            formHasChanges = false;
            
            this.sheets.editTenant.update(false);
            setTimeout(() => {
                if (this.sheets.editTenant && this.sheets.editTenant.parentNode) {
                    this.sheets.editTenant.parentNode.removeChild(this.sheets.editTenant);
                    this.sheets.editTenant = null;
                }
                // Clear all input error tooltips after modal is removed
                if (typeof clearAllInputErrors === 'function') {
                    clearAllInputErrors();
                }
            }, 300);
        });
        
        // Modal Footer
        const footer = document.createElement('div');
        footer.className = 'modal-footer';
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn-cancel';
        cancelBtn.textContent = 'İptal';
        cancelBtn.onclick = () => closeEditTenantSheet(false);
        const saveBtn = document.createElement('button');
        saveBtn.type = 'submit';
        saveBtn.className = 'btn-save';
        saveBtn.id = 'btn-save-tenant-edit';
        saveBtn.textContent = 'Kaydet';
        saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            form.dispatchEvent(new Event('submit'));
        });
        footer.appendChild(cancelBtn);
        footer.appendChild(saveBtn);
        
        // Modal yapısına göre ekle - Manage sayfasındaki gibi
        const modalDiv = sheet.querySelector('.modal');
        if (modalDiv) {
            modalDiv.appendChild(header);
            modalDiv.appendChild(form);
            modalDiv.appendChild(footer);
        } else {
            // Fallback: contentDiv kullan
            const contentDiv = sheet.querySelector('[id$="-content"]');
            if (contentDiv) {
                contentDiv.appendChild(header);
                contentDiv.appendChild(form);
                contentDiv.appendChild(footer);
            }
        }
        
        this.sheets.editTenant = sheet;
    }
    
    toggleDropdownMenu(tenantId) {
        const menu = document.getElementById(`dropdown-content-${tenantId}`);
        const menuButton = document.querySelector(`[data-action="toggle-dropdown"][data-tenant-id="${tenantId}"]`);
        
        if (!menu || !menuButton) {
            return;
        }
        
        const isHidden = menu.classList.contains('hidden');
        
        // Close other menus first
        document.querySelectorAll('[id^="dropdown-content-"]').forEach(m => {
            if (m.id !== `dropdown-content-${tenantId}`) {
                m.classList.add('hidden');
            }
        });
        
        if (isHidden) {
            // Menu açılacak
            const buttonRect = menuButton.getBoundingClientRect();
            
            // Menüyü body'ye taşı (scroll'dan bağımsız olması için)
            if (menu.parentElement !== document.body) {
                document.body.appendChild(menu);
            }
            
            // Menüyü görünür yap
            menu.classList.remove('hidden');
            
            // Menü boyutlarını hesapla
            const menuHeight = menu.offsetHeight || 50;
            const menuWidth = menu.offsetWidth || 150;
            
            // Menüyü butonun üstüne, sağa hizalı olarak konumlandır
            const topPosition = buttonRect.top - menuHeight - 8; // 8px margin
            const rightPosition = window.innerWidth - buttonRect.right; // Butonun sağ kenarından viewport'un sağına kadar olan mesafe
            
            // Tüm style'ları temizle
            menu.style.removeProperty('inset');
            menu.style.removeProperty('transform');
            
            // CSS variable'ları kullanarak konumlandır (inline style yerine)
            if (topPosition < 10) {
                // Aşağıda aç (yukarıda yer yoksa)
                menu.style.setProperty('--dropdown-top', 'auto');
                menu.style.setProperty('--dropdown-right', `${rightPosition}px`);
                menu.style.setProperty('--dropdown-bottom', `${window.innerHeight - buttonRect.bottom - 8}px`);
                menu.style.setProperty('--dropdown-left', 'auto');
            } else {
                // Yukarıda aç
                menu.style.setProperty('--dropdown-top', `${topPosition}px`);
                menu.style.setProperty('--dropdown-right', `${rightPosition}px`);
                menu.style.setProperty('--dropdown-bottom', 'auto');
                menu.style.setProperty('--dropdown-left', 'auto');
            }
        } else {
            // Menu kapatılacak
            menu.classList.add('hidden');
            
            // Menüyü orijinal yerine geri koy
            const dropdownContainer = document.getElementById(`dropdown-menu-${tenantId}`);
            if (dropdownContainer && menu.parentElement === document.body) {
                dropdownContainer.appendChild(menu);
            }
        }
    }
    
    openStatusDialog(tenantId) {
        const tenant = this.tenants.find(t => t.id === tenantId);
        if (!tenant) return;
        // Status kolonunu kullan (tenants tablosundaki status alanı)
        const currentStatus = tenant.status || 'pasif';
        const isActive = currentStatus === 'aktif';
        const newStatus = isActive ? 'pasif' : 'aktif';
        this.toggleTenantStatus(tenantId, newStatus);
        // Close dropdown
        const menu = document.getElementById(`dropdown-content-${tenantId}`);
        if (menu) {
            menu.classList.add('hidden');
        }
    }
    
    async toggleTenantStatus(id, newStatus) {
        const tenant = this.tenants.find(t => t.id === id);
        if (!tenant) {
            console.error('❌ Tenant bulunamadı:', id);
            return;
        }
        
        // newStatus zaten "aktif" veya "pasif" string'i
        const statusText = newStatus;
        const actionText = newStatus === 'aktif' ? 'Aktif Yap' : 'Devre Dışı Bırak';
        const titleText = newStatus === 'aktif' ? "Tenant'ı Aktif Yap" : "Tenant'ı Devre Dışı Bırak";
        
        // Eğer createToastInteractive yoksa fallback olarak confirm kullan
        if (typeof createToastInteractive !== 'function') {
            if (!confirm(`Bu tenant'ı ${statusText} yapmak istediğinize emin misiniz?`)) {
                return;
            }
            // Devam et...
        } else {
            // Interactive toast göster (görseldeki gibi)
            createToastInteractive({
                title: titleText,
                message: `"${tenant.name}" tenant'ı ${statusText} yapıldığında tüm kullanıcılar erişimini kaybedecek. Bu işlemi onaylıyor musunuz?`,
                confirmText: actionText,
                cancelText: 'İptal',
                isWarning: true,
                confirmButtonClass: newStatus === 'aktif' ? 'toast-btn-green' : 'toast-btn-red',
                onConfirm: async () => {
                    await this.performTenantStatusChange(id, newStatus);
                },
                onCancel: () => {
                    // İptal edildi, hiçbir şey yapma
                }
            });
            return; // Toast gösterildi, fonksiyon burada bitiyor
        }
        
        // Fallback için devam et
        await this.performTenantStatusChange(id, newStatus);
    }
    
    async performTenantStatusChange(id, newStatus) {
        try {
            // Status kolonunu kullan (tenants tablosundaki status alanı)
            const statusValue = newStatus; // newStatus zaten "aktif" veya "pasif" string'i
            
            const response = await fetch(`${this.apiBase}/admin/tenants/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    status: statusValue  // status kolonunu güncelle, is_active değil
                })
            });
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    this.logout();
                    return;
                }
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    errorData = { error: errorText };
                }
                throw new Error(errorData.error || 'Tenant durumu değiştirilemedi');
            }
            
            const result = await response.json();
            if (result.success) {
                // newStatus zaten "aktif" veya "pasif" string'i
                const statusText = newStatus;
                if (typeof createToast === 'function') {
                    createToast('success', `Tenant ${statusText} yapıldı`);
                }
                await this.loadTenants();
                await this.loadStats();
                
                // Cross-page update için broadcast et
                if (window.syncManager) {
                    window.syncManager.broadcast('TENANT_STATUS_CHANGED', {
                        tenantId: id,
                        status: newStatus,
                        tenantData: result.data
                    });
                }
            }
        } catch (error) {
            console.error('Tenant durumu değiştirilirken hata:', error);
            if (typeof createToast === 'function') {
                createToast('error', error.message || 'Tenant durumu değiştirilemedi');
            }
        }
    }
    
    showAddTenantSheet() {
        if (!this.sheets.addTenant) {
            this.createAddTenantSheet();
        }
        this.sheets.addTenant.update(true);
        document.body.appendChild(this.sheets.addTenant);
        
        // Form açıldıktan sonra telefon inputuna mask uygula
        setTimeout(() => {
            const phoneInput = document.getElementById('tenant-phone');
            if (phoneInput && !phoneInput.hasAttribute('data-phone-formatted') && !phoneInput.hasAttribute('data-tr-phone-mask')) {
                if (typeof window.setupPhoneInput === 'function') {
                    window.setupPhoneInput(phoneInput);
                } else if (typeof attachTRPhoneMask === 'function') {
                    attachTRPhoneMask(phoneInput);
                }
            }
        }, 100);
    }
    
    createAddTenantSheet() {
        const { createSheet, createSheetHeader, createSheetTitle, createSheetDescription, createSheetContent, createSheetFooter, createInput, createLabel, createButton } = window.AdminComponents;
        
        // Form kontrolü için callback
        let closeAddTenantSheetCallback = null;
        
        const sheet = createSheet({
            id: 'add-tenant-modal-overlay',
            side: 'right',
            open: false,
            onClose: () => {
                if (closeAddTenantSheetCallback) {
                    closeAddTenantSheetCallback(false);
                }
            }
        });
        
        // Modal Header - Manage sayfasındaki gibi
        const header = createSheetHeader({
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
            title: 'Yeni Tenant Ekle',
            description: 'Yeni bir organizasyon oluşturun.',
            onClose: () => {
                if (closeAddTenantSheetCallback) {
                    closeAddTenantSheetCallback(false);
                }
            }
        });
        
        // Modal Body
        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        
        // Form
        const form = document.createElement('form');
        form.id = 'add-tenant-form';
        
        const nameGroup = document.createElement('div');
        nameGroup.className = 'form-group';
        const nameLabel = document.createElement('label');
        nameLabel.htmlFor = 'tenant-name';
        nameLabel.innerHTML = 'Organizasyon Adı <span class="text-red-500">*</span>';
        nameGroup.appendChild(nameLabel);
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.id = 'tenant-name';
        nameInput.name = 'name';
        nameInput.placeholder = 'Organizasyon adı';
        nameInput.required = true;
        nameGroup.appendChild(nameInput);
        modalBody.appendChild(nameGroup);
        
        const emailGroup = document.createElement('div');
        emailGroup.className = 'form-group';
        const emailLabel = document.createElement('label');
        emailLabel.htmlFor = 'tenant-email';
        emailLabel.innerHTML = 'E-posta <span class="text-red-500">*</span>';
        emailGroup.appendChild(emailLabel);
        const emailInput = document.createElement('input');
        emailInput.type = 'email';
        emailInput.id = 'tenant-email';
        emailInput.name = 'email';
        emailInput.placeholder = 'info@ornek.com';
        emailInput.required = true;
        // Email validation - input sırasında kontrol et
        emailInput.addEventListener('blur', () => {
            const email = emailInput.value.trim();
            if (email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    emailInput.setCustomValidity('Lütfen geçerli bir e-posta adresi girin');
                    emailInput.reportValidity();
                    if (typeof createToast === 'function') {
                        createToast('warning', 'Lütfen geçerli bir e-posta adresi girin');
                    }
                } else {
                    emailInput.setCustomValidity('');
                }
            }
        });
        emailInput.addEventListener('input', () => {
            // Email validation'ı temizle input sırasında
            emailInput.setCustomValidity('');
        });
        emailGroup.appendChild(emailInput);
        modalBody.appendChild(emailGroup);
        
        const phoneGroup = document.createElement('div');
        phoneGroup.className = 'form-group';
        const phoneLabel = document.createElement('label');
        phoneLabel.htmlFor = 'tenant-phone';
        phoneLabel.innerHTML = 'Telefon <span class="text-red-500">*</span>';
        phoneGroup.appendChild(phoneLabel);
        const phoneInput = document.createElement('input');
        phoneInput.type = 'tel';
        phoneInput.id = 'tenant-phone';
        phoneInput.name = 'phone';
        phoneInput.placeholder = '+90 (5XX) XXX XX XX';
        phoneInput.required = true;
        phoneGroup.appendChild(phoneInput);
        modalBody.appendChild(phoneGroup);
        
        // Telefon input formatı: +90 (5XX) XXX XX XX - manage sayfasındaki gibi
        if (phoneInput) {
            if (typeof window.setupPhoneInput === 'function') {
                window.setupPhoneInput(phoneInput);
            } else if (typeof attachTRPhoneMask === 'function') {
                attachTRPhoneMask(phoneInput);
            }
        }
        
        // City (İl) Select
        const cityGroup = document.createElement('div');
        cityGroup.className = 'form-group';
        const cityLabel = document.createElement('label');
        cityLabel.htmlFor = 'tenant-city';
        cityLabel.innerHTML = 'İl <span class="text-red-500">*</span>';
        cityGroup.appendChild(cityLabel);
        const citySelect = document.createElement('select');
        citySelect.id = 'tenant-city';
        citySelect.name = 'city';
        citySelect.className = 'form-input';
        citySelect.required = true;
        const cityOptionDefault = document.createElement('option');
        cityOptionDefault.value = '';
        cityOptionDefault.textContent = 'İl Seçiniz';
        citySelect.appendChild(cityOptionDefault);
        // Populate cities from location data
        if (window.__TR_ADDR__ && window.__TR_ADDR__.provinces) {
            window.__TR_ADDR__.provinces.forEach(province => {
                const option = document.createElement('option');
                option.value = province.name;
                option.textContent = province.name;
                citySelect.appendChild(option);
            });
        }
        cityGroup.appendChild(citySelect);
        modalBody.appendChild(cityGroup);
        
        // State (İlçe) Select
        const stateGroup = document.createElement('div');
        stateGroup.className = 'form-group';
        const stateLabel = document.createElement('label');
        stateLabel.htmlFor = 'tenant-state';
        stateLabel.innerHTML = 'İlçe <span class="text-red-500">*</span>';
        stateGroup.appendChild(stateLabel);
        const stateSelect = document.createElement('select');
        stateSelect.id = 'tenant-state';
        stateSelect.name = 'state';
        stateSelect.className = 'form-input';
        stateSelect.required = true;
        const stateOptionDefault = document.createElement('option');
        stateOptionDefault.value = '';
        stateOptionDefault.textContent = 'İlçe Seçiniz';
        stateSelect.appendChild(stateOptionDefault);
        stateGroup.appendChild(stateSelect);
        modalBody.appendChild(stateGroup);
        
        // Form'u modalBody içine al
        modalBody.appendChild(form);
        
        // Update districts when city changes
        citySelect.addEventListener('change', (e) => {
            const selectedCity = e.target.value;
            if (!stateSelect) {
                console.error('❌ stateSelect bulunamadı!');
                return;
            }
            
            stateSelect.innerHTML = '<option value="">İlçe Seçiniz</option>';
            
            
            if (selectedCity && window.__TR_ADDR__ && window.__TR_ADDR__.provinces) {
                const province = window.__TR_ADDR__.provinces.find(p => p.name === selectedCity);
                
                if (province) {
                    // ID'yi string ve number olarak dene
                    const provinceId = province.id;
                    const districts = window.__TR_ADDR__.districtsByProv[provinceId] || 
                                    window.__TR_ADDR__.districtsByProv[String(provinceId)] ||
                                    window.__TR_ADDR__.districtsByProv[Number(provinceId)];
                    
                    if (districts && districts.length > 0) {
                        districts.forEach(district => {
                            const option = document.createElement('option');
                            option.value = district.name;
                            option.textContent = district.name;
                            stateSelect.appendChild(option);
                        });
                    } else {
                        console.warn('⚠️ Bu il için ilçe bulunamadı (ID:', provinceId, ')');
                    }
                } else {
                    console.warn('⚠️ İl bulunamadı:', selectedCity);
                }
            } else {
                console.warn('⚠️ Location data yüklenmemiş veya il seçilmemiş');
            }
        });
        
        // Orijinal değerleri sakla (değişiklik takibi için - yeni tenant için boş)
        let originalValues = {
            name: '',
            email: '',
            phone: '',
            city: '',
            state: ''
        };
        
        // Form değişiklik takibi için flag
        let formHasChanges = false;
        
        // Değişiklik kontrolü fonksiyonu
        const checkFormChanges = () => {
            const currentName = nameInput.value.trim();
            const currentEmail = emailInput.value.trim();
            const currentPhone = phoneInput ? phoneInput.value.trim() : '';
            const currentCity = citySelect ? citySelect.value : '';
            const currentState = stateSelect ? stateSelect.value : '';
            
            // Zorunlu alanlar kontrolü - en az bir alan doldurulmuşsa değişiklik var say
            const hasAnyValue = currentName || currentEmail || currentPhone || currentCity || currentState;
            formHasChanges = hasAnyValue && (
                currentName !== originalValues.name ||
                currentEmail !== originalValues.email ||
                currentPhone !== originalValues.phone ||
                currentCity !== originalValues.city ||
                currentState !== originalValues.state
            );
        };
        
        // Input değişikliklerini dinle
        nameInput.addEventListener('input', checkFormChanges);
        nameInput.addEventListener('change', checkFormChanges);
        emailInput.addEventListener('input', checkFormChanges);
        emailInput.addEventListener('change', checkFormChanges);
        if (phoneInput) {
            phoneInput.addEventListener('input', checkFormChanges);
            phoneInput.addEventListener('change', checkFormChanges);
            
            // Telefon validation ekle
            if (typeof validatePhoneInput === 'function') {
                // Input değiştiğinde hata mesajını temizle
                phoneInput.addEventListener('input', () => {
                    if (typeof hideInputError === 'function') {
                        hideInputError(phoneInput);
                    }
                });
                // Blur event'inde kontrol et (kullanıcı input'tan çıktığında)
                phoneInput.addEventListener('blur', () => {
                    validatePhoneInput(phoneInput, true);
                });
            }
        }
        if (citySelect) {
            citySelect.addEventListener('change', checkFormChanges);
        }
        if (stateSelect) {
            stateSelect.addEventListener('change', checkFormChanges);
        }
        
        // Form kapatma fonksiyonu (değişiklik kontrolü ile)
        const closeAddTenantSheet = (force = false) => {
            // Clear all input error tooltips when closing
            if (typeof clearAllInputErrors === 'function') {
                clearAllInputErrors();
            }
            
            if (!force && formHasChanges) {
                // Değişiklik var, kullanıcıya sor
                if (typeof createToastInteractive === 'function') {
                    createToastInteractive({
                        message: 'Değişiklikleri kaydetmek istiyor musunuz?',
                        confirmText: 'Kaydet',
                        cancelText: 'Vazgeç',
                        onConfirm: async () => {
                            // Zorunlu alanları kontrol et
                            const nameValue = nameInput.value.trim();
                            const emailValue = emailInput.value.trim();
                            const phoneValue = phoneInput ? phoneInput.value.trim() : '';
                            const cityValue = citySelect ? citySelect.value : '';
                            const stateValue = stateSelect ? stateSelect.value : '';
                            
                            if (!nameValue || !emailValue || !phoneValue || !cityValue || !stateValue) {
                                // Zorunlu alanlar eksikse uyarı göster
                                if (typeof createToast === 'function') {
                                    createToast('warning', 'Lütfen tüm zorunlu alanları doldurun');
                                }
                                return; // Form açık kalsın
                            }
                            
                            // Kaydet butonuna tıkla
                            saveBtn.click();
                        },
                        onCancel: () => {
                            // Formu sıfırla ve kapat
                            form.reset();
                            formHasChanges = false;
                            this.sheets.addTenant.update(false);
                            setTimeout(() => {
                                if (this.sheets.addTenant && this.sheets.addTenant.parentNode) {
                                    this.sheets.addTenant.parentNode.removeChild(this.sheets.addTenant);
                                    this.sheets.addTenant = null;
                                }
                            }, 300);
                        }
                    });
                } else {
                    // Interactive toast yoksa direkt kapat
                    form.reset();
                    formHasChanges = false;
                    this.sheets.addTenant.update(false);
                    setTimeout(() => {
                        if (this.sheets.addTenant && this.sheets.addTenant.parentNode) {
                            this.sheets.addTenant.parentNode.removeChild(this.sheets.addTenant);
                            this.sheets.addTenant = null;
                        }
                    }, 300);
                }
            } else {
                // Değişiklik yok veya zorla kapat
                form.reset();
                formHasChanges = false;
                this.sheets.addTenant.update(false);
                setTimeout(() => {
                    if (this.sheets.addTenant && this.sheets.addTenant.parentNode) {
                        this.sheets.addTenant.parentNode.removeChild(this.sheets.addTenant);
                        this.sheets.addTenant = null;
                    }
                }, 300);
            }
        };
        
        // Callback'i ata
        closeAddTenantSheetCallback = closeAddTenantSheet;
        
        // Close button'a event listener ekle
        // Close button zaten createSheetHeader içinde eklendi
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = nameInput.value.trim();
            const email = emailInput.value.trim();
            let phone = phoneInput ? phoneInput.value.trim() : '';
            
            // ✅ Telefon validation kontrolü - Required field olduğu için her zaman kontrol et
            if (phoneInput && typeof validatePhoneInput === 'function') {
                // Telefon numarası boş veya sadece "+90 (" ise kontrol et
                if (!phone || phone === '+90 (' || phone.trim() === '' || phone === '+90') {
                    // Required field boş - validation göster
                    phoneInput.setCustomValidity('Telefon numarası gereklidir! +90 (XXX) XXX XX XX formatında yazınız.');
                    phoneInput.reportValidity();
                    phoneInput.focus();
                    return;
                }
                
                // Telefon numarası var ama format/eksik kontrolü
                const isValid = validatePhoneInput(phoneInput, false);
                if (!isValid) {
                    // Validation başarısız - tooltip göster
                    validatePhoneInput(phoneInput, true);
                    phoneInput.focus();
                    return;
                } else {
                    // Validation geçerli - custom validity'yi temizle
                    phoneInput.setCustomValidity('');
                }
            }
            
            // Telefon numarasını E.164 formatına çevir (+90XXXXXXXXXX)
            if (phone && typeof toE164TR === 'function') {
                phone = toE164TR(phone);
            } else if (phone) {
                // Fallback: manuel normalize
                const digits = phone.replace(/\D/g, '');
                if (digits.length === 10 && digits.startsWith('5')) {
                    phone = '+90' + digits;
                } else if (digits.length === 11 && digits.startsWith('0')) {
                    phone = '+90' + digits.substring(1);
                } else if (digits.length >= 10) {
                    phone = '+90' + digits.substring(digits.length - 10);
                } else {
                    phone = null;
                }
            }
            const city = citySelect ? citySelect.value : '';
            const state = stateSelect ? stateSelect.value : '';
            
            // E-posta format kontrolü
            if (!validateEmailInput(emailInput, true)) {
                if (emailInput) {
                    emailInput.focus();
                }
                return;
            }
            
            // Telefon numarası kontrolü kaldırıldı - düz input
            
            if (!name || !email || !phone || !city || !state) {
                if (typeof createToast === 'function') {
                    createToast('warning', 'Lütfen tüm zorunlu alanları doldurun');
                }
                return;
            }
            this.saveTenant(null, { name, email, phone, city, state });
            
            // Formu sıfırla ve kapat
            form.reset();
            formHasChanges = false;
            originalValues = { name: '', email: '', phone: '', city: '', state: '' };
            
            this.sheets.addTenant.update(false);
            setTimeout(() => {
                if (this.sheets.addTenant && this.sheets.addTenant.parentNode) {
                    this.sheets.addTenant.parentNode.removeChild(this.sheets.addTenant);
                    this.sheets.addTenant = null;
                }
            }, 300);
        });
        
        // Modal Footer
        const footer = document.createElement('div');
        footer.className = 'modal-footer';
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn-cancel';
        cancelBtn.textContent = 'İptal';
        cancelBtn.onclick = () => closeAddTenantSheet(false);
        const saveBtn = document.createElement('button');
        saveBtn.type = 'submit';
        saveBtn.className = 'btn-save';
        saveBtn.textContent = 'Oluştur';
        saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            form.dispatchEvent(new Event('submit'));
        });
        footer.appendChild(cancelBtn);
        footer.appendChild(saveBtn);
        
        // Modal yapısına göre ekle - Manage sayfasındaki gibi
        const modalDiv = sheet.querySelector('.modal');
        if (modalDiv) {
            modalDiv.appendChild(header);
            modalDiv.appendChild(modalBody);
            modalDiv.appendChild(footer);
        } else {
            // Fallback: contentDiv kullan
            const contentDiv = sheet.querySelector('[id$="-content"]');
            if (contentDiv) {
                contentDiv.appendChild(header);
                contentDiv.appendChild(modalBody);
                contentDiv.appendChild(footer);
            }
        }
        
        this.sheets.addTenant = sheet;
    }
    
    async saveTenant(id, data) {
        try {
            const url = id
                ? `${this.apiBase}/admin/tenants/${id}`
                : `${this.apiBase}/admin/tenants`;
    
            const method = id ? 'PUT' : 'POST';
    
            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    name: data.name,
                    email: data.email,
                    phone: data.phone || '',
                    city: data.city || '',
                    state: data.state || '',
                    is_active: data.is_active !== undefined ? data.is_active : 1
                })
            });
    
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    this.logout();
                    return;
                }
    
                // Response body bazen boş olabiliyor; garanti parse
                let errorData = {};
                try {
                    errorData = await response.json();
                } catch (e) {}
    
                throw new Error(errorData.error || 'Tenant kaydedilemedi');
            }
    
            const result = await response.json();
    
            if (!result.success) {
                throw new Error(result.error || 'Tenant kaydedilemedi');
            }
    
            // ✅ Toast göster (sadece bir kez)
            if (typeof createToast === 'function') {
                createToast('success', id ? 'Tenant güncellendi' : 'Tenant eklendi');
            }
            
            // ✅ Custom event dispatch et (loadTenants event listener'da çağrılacak)
            // loadTenants'ı burada çağırma, event listener'da çağrılacak
            window.dispatchEvent(new CustomEvent('floovon:tenants-updated', {
                detail: { tenantId: id || result.data?.id, tenantData: result.data }
            }));
            
            // Stats'ı güncelle (liste yenilenmeden)
            await this.loadStats();
    
            // Cross-page update broadcast (varsa)
            if (window.syncManager) {
                window.syncManager.broadcast(id ? 'TENANT_UPDATED' : 'TENANT_CREATED', {
                    tenantId: id || result.data?.id,
                    tenantData: result.data
                });
            }
    
            return result.data;
        } catch (error) {
            console.error('Tenant kaydedilirken hata:', error);
            if (typeof createToast === 'function') {
                createToast('error', error.message || 'Tenant kaydedilemedi');
            }
            throw error;
        }
    }
    
    
    
    async showProfileSheet() {
        // Her açılışta yeni sheet oluştur (fresh data için)
        if (this.sheets.profile && this.sheets.profile.parentNode) {
            this.sheets.profile.parentNode.removeChild(this.sheets.profile);
        }
        await this.createProfileSheet();
        this.sheets.profile.update(true);
        document.body.appendChild(this.sheets.profile);
    }
    
    async createProfileSheet() {
        const { createSheet, createSheetHeader, createSheetTitle, createSheetDescription, createSheetContent, createSheetFooter, createInput, createLabel, createButton } = window.AdminComponents;
        
        if (!createSheet) {
            console.error('AdminComponents.createSheet not found');
            if (typeof createToast === 'function') {
                createToast('error', 'Sheet component yüklenemedi');
            }
            return;
        }
        
        // onClose callback'i önce tanımlanmalı (createSheet içinde kullanılacak)
        let closeProfileSheetCallback = null;
        
        const sheet = createSheet({
            id: 'profile-sheet',
            side: 'right',
            open: false,
            onClose: () => {
                // onClose callback'i aşağıda tanımlanacak (değişiklik kontrolü için)
                if (closeProfileSheetCallback) {
                    closeProfileSheetCallback(false);
                }
            }
        });
        
        // Modal Header - Manage sayfasındaki gibi
        const header = createSheetHeader({
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
            title: 'Profil Bilgileri',
            description: 'Kişisel bilgilerinizi görüntüleyin ve düzenleyin.',
            onClose: () => {
                if (closeProfileSheetCallback) {
                    closeProfileSheetCallback(false);
                }
            }
        });
        
        // Backend'den güncel admin user verisini çek (her açılışta fresh data)
        const adminUser = window.AdminUserHelpers && window.AdminUserHelpers.fetchAdminUserFromBackend 
            ? await window.AdminUserHelpers.fetchAdminUserFromBackend() 
            : (window.AdminUserHelpers ? window.AdminUserHelpers.getAdminUser() : {});
        
        // Form açıldığında her zaman backend'den fresh data çekildiği için
        // originalValues backend'den gelen değerlerle başlatılacak
        
        // Modal Body - Form içinde
        const form = document.createElement('form');
        form.id = 'profile-form';
        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        
        // Profile Section kaldırıldı - sadece superadmin kullanıcı düzenleme formunda olacak
        
        const nameGroup = document.createElement('div');
        nameGroup.className = 'form-group';
        const nameLabel = document.createElement('label');
        nameLabel.htmlFor = 'profile-name';
        nameLabel.textContent = 'Ad Soyad';
        nameGroup.appendChild(nameLabel);
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.id = 'profile-name';
        nameInput.name = 'name';
        nameInput.value = adminUser.name || '';
        nameInput.placeholder = 'Ad Soyad';
        nameGroup.appendChild(nameInput);
        modalBody.appendChild(nameGroup);
        
        const emailGroup = document.createElement('div');
        emailGroup.className = 'form-group';
        const emailLabel = document.createElement('label');
        emailLabel.htmlFor = 'profile-email';
        emailLabel.textContent = 'E-posta';
        emailGroup.appendChild(emailLabel);
        const emailInput = document.createElement('input');
        emailInput.type = 'email';
        emailInput.id = 'profile-email';
        emailInput.name = 'email';
        emailInput.value = adminUser.email || '';
        emailInput.placeholder = 'E-posta';
        // E-posta validation ekle
        if (emailInput && typeof validateEmailInput === 'function') {
            emailInput.addEventListener('blur', () => {
                validateEmailInput(emailInput, true);
            });
            emailInput.addEventListener('input', () => {
                hideInputError(emailInput);
            });
        }
        emailGroup.appendChild(emailInput);
        modalBody.appendChild(emailGroup);
        
        form.appendChild(modalBody);
        
        // Orijinal değerleri sakla (değişiklik takibi için) - Backend'den gelen fresh data
        const originalValues = {
            name: adminUser.name || '',
            email: adminUser.email || '',
            profil_resmi: adminUser.profil_resmi || null
        };
        
        // Form değişiklik takibi için flag
        let formHasChanges = false;
        let profileImageChanged = false; // Profil resmi değişikliği takibi
        
        // Mevcut profil resmini sakla (avatar'dan)
        let currentProfileImage = adminUser.profil_resmi || null;
        
        // Input değişikliklerini dinle
        const checkFormChanges = () => {
            const currentName = nameInput.value.trim();
            const currentEmail = emailInput.value.trim();
            formHasChanges = (
                currentName !== originalValues.name || 
                currentEmail !== originalValues.email ||
                profileImageChanged
            );
        };
        
        // Email validation - input sırasında kontrol et
        emailInput.addEventListener('blur', () => {
            const email = emailInput.value.trim();
            if (email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    emailInput.setCustomValidity('Lütfen geçerli bir e-posta adresi girin');
                    emailInput.reportValidity();
                    if (typeof createToast === 'function') {
                        createToast('warning', 'Lütfen geçerli bir e-posta adresi girin');
                    }
                } else {
                    emailInput.setCustomValidity('');
                }
            }
        });
        
        nameInput.addEventListener('input', checkFormChanges);
        nameInput.addEventListener('change', checkFormChanges);
        emailInput.addEventListener('input', () => {
            checkFormChanges();
            // Email validation'ı temizle input sırasında
            emailInput.setCustomValidity('');
        });
        emailInput.addEventListener('change', checkFormChanges);
        
        // Profil resmi yüklendiğinde originalValues'u güncellemek için callback
        window.updateProfileOriginalValues = (updates) => {
            if (updates.profil_resmi !== undefined) {
                // Profil resmi değiştiğini işaretle
                profileImageChanged = true; // pendingProfileFile varsa değişiklik var demektir
                currentProfileImage = updates.profil_resmi;
                checkFormChanges(); // Değişiklik kontrolünü güncelle
            }
        };
        
        // Avatar'daki pendingProfileFile değişikliğini dinle
        const avatarElement = document.querySelector('#profile-modal-overlay .modal-profile-avatar');
        if (avatarElement) {
            // MutationObserver ile pendingProfileFile değişikliğini izle
            const observer = new MutationObserver(() => {
                if (avatarElement.pendingProfileFile) {
                    profileImageChanged = true;
                    checkFormChanges();
                }
            });
            observer.observe(avatarElement, { attributes: true, attributeFilter: ['data-pending-profile-file'] });
        }
        
        // Değişiklik kontrolü fonksiyonu
        const hasChanges = () => {
            checkFormChanges(); // Güncel durumu kontrol et
            return formHasChanges;
        };
        
        // Form kapatma fonksiyonu (değişiklik kontrolü ile)
        const closeProfileSheet = (force = false) => {
            // Clear all input error tooltips when closing
            if (typeof clearAllInputErrors === 'function') {
                clearAllInputErrors();
            }
            
            if (!force && hasChanges()) {
                // Değişiklik var, kullanıcıya sor
                if (typeof createToastInteractive === 'function') {
                    createToastInteractive({
                        message: 'Değişiklikleri kaydetmek istiyor musunuz?',
                        confirmText: 'Kaydet',
                        cancelText: 'Vazgeç',
                        onConfirm: async () => {
                            // Kaydet butonuna tıkla
                            saveBtn.click();
                        },
                        onCancel: () => {
                            // Değişiklikleri sıfırla ve kapat
                            nameInput.value = originalValues.name;
                            emailInput.value = originalValues.email;
                            
                            // Pending profil resmi varsa temizle ve orijinal resmi göster
                            const avatar = document.querySelector('#profile-modal-overlay .modal-profile-avatar');
                            if (avatar && avatar.pendingProfileFile) {
                                avatar.pendingProfileFile = null;
                                avatar.removeAttribute('data-pending-profile-file');
                            }
                            
                            // Profil resmi değişikliğini geri al - backend'den orijinal resmi yükle
                            if (profileImageChanged && window.AdminUserHelpers && window.AdminUserHelpers.fetchAdminUserFromBackend) {
                                window.AdminUserHelpers.fetchAdminUserFromBackend().then(updatedUser => {
                                    // Avatar'ı güncelle - orijinal resmi göster
                                    const avatarImg = document.querySelector('#profile-modal-overlay .modal-profile-avatar img');
                                    const avatarFallback = document.querySelector('#profile-modal-overlay .modal-profile-avatar div:not(img)');
                                    
                                    if (updatedUser.profil_resmi && updatedUser.profil_resmi.trim() !== '') {
                                        const imageUrl = window.AdminUserHelpers.getProfileImageUrl(updatedUser.profil_resmi);
                                        if (avatarImg) {
                                            avatarImg.src = imageUrl + '?t=' + Date.now();
                                            avatarImg.classList.remove('hidden');
                                        }
                                        if (avatarFallback) avatarFallback.style.display = 'none';
                                    } else {
                                        // Profil resmi yoksa fallback göster
                                        if (avatarImg) avatarImg.classList.add('hidden');
                                        if (avatarFallback) avatarFallback.style.display = 'flex';
                                    }
                                    
                                    // localStorage'ı da güncelle
                                    localStorage.setItem('admin_user', JSON.stringify(updatedUser));
                                });
                            }
                            
                            // Profil resmi değişikliğini sıfırla
                            profileImageChanged = false;
                            currentProfileImage = originalValues.profil_resmi;
                            
                            // Callback'i temizle
                            delete window.updateProfileOriginalValues;
                            
                            this.sheets.profile.update(false);
                            setTimeout(() => {
                                if (this.sheets.profile && this.sheets.profile.parentNode) {
                                    this.sheets.profile.parentNode.removeChild(this.sheets.profile);
                                    this.sheets.profile = null;
                                }
                            }, 300);
                        }
                    });
                } else {
                    // Interactive toast yoksa direkt kapat
                    this.sheets.profile.update(false);
                    setTimeout(() => {
                        if (this.sheets.profile && this.sheets.profile.parentNode) {
                            this.sheets.profile.parentNode.removeChild(this.sheets.profile);
                            this.sheets.profile = null;
                        }
                    }, 300);
                }
            } else {
                // Değişiklik yok veya zorla kapat
                // Callback'i temizle
                delete window.updateProfileOriginalValues;
                
                this.sheets.profile.update(false);
                setTimeout(() => {
                    if (this.sheets.profile && this.sheets.profile.parentNode) {
                        this.sheets.profile.parentNode.removeChild(this.sheets.profile);
                        this.sheets.profile = null; // Sheet'i temizle - bir sonraki açılışta yeni sheet oluşturulacak
                    }
                }, 300);
            }
        };
        
        // closeProfileSheet fonksiyonunu tanımla ve callback'e ata
        closeProfileSheetCallback = closeProfileSheet;
        
        // Close button'a da event listener ekle (overlay zaten createSheet tarafından handle ediliyor)
        // Close button zaten createSheetHeader içinde eklendi
        
        // Modal Footer
        const footer = document.createElement('div');
        footer.className = 'modal-footer';
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn-cancel';
        cancelBtn.textContent = 'İptal';
        cancelBtn.onclick = () => closeProfileSheet(false);
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'btn-save';
        saveBtn.textContent = 'Kaydet';
        saveBtn.onclick = async () => {
            const name = nameInput.value.trim();
            const email = emailInput.value.trim();
            
            if (!name || !email) {
                if (typeof createToast === 'function') {
                    createToast('warning', 'Lütfen ad soyad ve e-posta alanlarını doldurun');
                }
                return;
            }
            
            // E-posta format kontrolü
            if (!validateEmailInput(emailInput, true)) {
                if (emailInput) {
                    emailInput.focus();
                }
                return;
            }
            
            try {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Kaydediliyor...';
                
                const backendBase = window.getFloovonBackendBase ? window.getFloovonBackendBase() : (window.BACKEND_BASE_URL || 'http://localhost:3001');
                
                // Önce profil resmi varsa yükle
                // Avatar'ı bul - createSheet overlay id'si ${id}-overlay formatında
                let avatar = document.querySelector('#profile-modal-overlay .modal-profile-avatar') ||
                             document.querySelector('#profile-sheet-overlay .modal-profile-avatar') ||
                             document.querySelector('.modal-overlay.active .modal-profile-avatar');
                
                // Eğer avatar bulunamadıysa, tüm modal-profile-avatar elementlerini kontrol et
                if (!avatar || !avatar.pendingProfileFile) {
                    const allAvatars = document.querySelectorAll('.modal-profile-avatar');
                    for (let av of allAvatars) {
                        if (av.pendingProfileFile) {
                            avatar = av;
                            break;
                        }
                    }
                }
                
                let profileImagePath = null;
                if (avatar && avatar.pendingProfileFile) {
                const formData = new FormData();
                formData.append('profile', avatar.pendingProfileFile);
                
                // ✅ REVIZE-8: Yeni endpoint kullan - sadece path döndürür, veritabanına yazmaz
                const profileResponse = await fetch(`${backendBase}/api/admin/users/profile-upload`, {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                });
                    
                    const profileResult = await profileResponse.json();
                    if (!profileResult.success) {
                        throw new Error(profileResult.error || 'Profil resmi yüklenemedi');
                    }
                    
                    profileImagePath = profileResult.data.path;
                    
                    // Profil resmi yüklendi, pending file'ı temizle
                    avatar.pendingProfileFile = null;
                    avatar.removeAttribute('data-pending-profile-file');
                    
                    // Header'daki avatar'ı da güncelle (hemen, profil resmi yüklendikten sonra)
                    if (profileImagePath) {
                        const headerAvatar = document.getElementById('user-avatar-img');
                        const headerAvatarFallback = document.getElementById('user-avatar-fallback');
                        if (headerAvatar) {
                            let imageUrl = profileImagePath;
                            if (typeof window.AdminUserHelpers && window.AdminUserHelpers.getProfileImageUrl) {
                                imageUrl = window.AdminUserHelpers.getProfileImageUrl(profileImagePath);
                            } else if (typeof window.getFloovonUploadUrl === 'function') {
                                imageUrl = window.getFloovonUploadUrl(profileImagePath);
                            } else if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
                                const backendBase = window.getFloovonBackendBase ? window.getFloovonBackendBase() : (window.BACKEND_BASE_URL || '');
                                imageUrl = backendBase + (imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl);
                            }
                            headerAvatar.src = imageUrl + '?t=' + Date.now();
                            headerAvatar.classList.remove('hidden');
                            headerAvatar.onload = () => {
                                if (headerAvatarFallback) {
                                    headerAvatarFallback.style.display = 'none';
                                }
                            };
                            headerAvatar.onerror = () => {
                                headerAvatar.classList.add('hidden');
                                if (headerAvatarFallback) {
                                    headerAvatarFallback.style.display = 'flex';
                                }
                            };
                        }
                    }
                }
                
                // Sonra diğer bilgileri kaydet (profil resmi path'ini sadece yüklendiyse gönder)
                const requestBody = {
                    name: name,
                    email: email
                };
                // Profil resmi yüklendiyse path'ini ekle, yoksa mevcut profil resmini koru
                if (profileImagePath) {
                    requestBody.profil_resmi = profileImagePath;
                    requestBody.profile_image = profileImagePath;
                }
                
                const response = await fetch(`${backendBase}/api/admin/user`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify(requestBody)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // localStorage'ı güncelle
                    const adminUser = JSON.parse(localStorage.getItem('admin_user') || '{}');
                    adminUser.name = name;
                    adminUser.email = email;
                    if (profileImagePath) {
                        adminUser.profil_resmi = profileImagePath;
                        adminUser.profile_image = profileImagePath; // Her iki alanı da güncelle
                    }
                    localStorage.setItem('admin_user', JSON.stringify(adminUser));
                    
                    // Backend'den güncel veriyi çek ve header'ı güncelle
                    await this.loadAdminUser();
                    
                    // Header'daki ismi de güncelle
                    const userNameEl = document.getElementById('user-name');
                    if (userNameEl) {
                        userNameEl.textContent = name;
                    }
                    
                    // Header'daki avatar'ı da güncelle (PUT işleminden sonra, profil resmi path'i veritabanına kaydedildi)
                    const finalProfileImage = profileImagePath || adminUser.profil_resmi || adminUser.profile_image;
                    if (finalProfileImage) {
                        const headerAvatar = document.getElementById('user-avatar-img');
                        const headerAvatarFallback = document.getElementById('user-avatar-fallback');
                        if (headerAvatar) {
                            let imageUrl = finalProfileImage;
                            if (typeof window.AdminUserHelpers && window.AdminUserHelpers.getProfileImageUrl) {
                                imageUrl = window.AdminUserHelpers.getProfileImageUrl(finalProfileImage);
                            } else if (typeof window.getFloovonUploadUrl === 'function') {
                                imageUrl = window.getFloovonUploadUrl(finalProfileImage);
                            } else if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
                                const backendBase = window.getFloovonBackendBase ? window.getFloovonBackendBase() : (window.BACKEND_BASE_URL || '');
                                imageUrl = backendBase + (imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl);
                            }
                            headerAvatar.src = imageUrl + '?t=' + Date.now();
                            headerAvatar.classList.remove('hidden');
                            headerAvatar.onload = () => {
                                if (headerAvatarFallback) {
                                    headerAvatarFallback.style.display = 'none';
                                }
                            };
                            headerAvatar.onerror = () => {
                                headerAvatar.classList.add('hidden');
                                if (headerAvatarFallback) {
                                    headerAvatarFallback.style.display = 'flex';
                                }
                            };
                        }
                    }
                    
                    // BroadcastChannel ile diğer sayfalara profil güncellemesini bildir
                    if (this.notificationChannel) {
                        this.notificationChannel.postMessage({
                            type: 'admin-profile-updated',
                            name: name,
                            email: email,
                            profileImage: profileImagePath || adminUser.profil_resmi
                        });
                    }
                    
                    if (typeof createToast === 'function') {
                        createToast('success', 'Profil başarıyla güncellendi');
                    }
                    
                    // Orijinal değerleri güncelle (artık değişiklik yok)
                    originalValues.name = name;
                    originalValues.email = email;
                    originalValues.profil_resmi = currentProfileImage;
                    profileImageChanged = false;
                    
                    // Callback'i temizle
                    delete window.updateProfileOriginalValues;
                    
                    // Sheet'i kapat ve temizle
                    this.sheets.profile.update(false);
                    setTimeout(() => {
                        if (this.sheets.profile && this.sheets.profile.parentNode) {
                            this.sheets.profile.parentNode.removeChild(this.sheets.profile);
                            this.sheets.profile = null; // Sheet'i temizle - bir sonraki açılışta yeni sheet oluşturulacak
                        }
                    }, 300);
                } else {
                    if (typeof createToast === 'function') {
                        createToast('error', result.error || 'Profil güncellenemedi');
                    }
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Kaydet';
                }
            } catch (error) {
                console.error('Profil güncelleme hatası:', error);
                if (typeof createToast === 'function') {
                    createToast('error', 'Profil güncellenirken bir hata oluştu');
                }
                saveBtn.disabled = false;
                saveBtn.textContent = 'Kaydet';
            }
        };
        footer.appendChild(cancelBtn);
        footer.appendChild(saveBtn);
        
        // Modal yapısına göre ekle - Manage sayfasındaki gibi
        const modalDiv = sheet.querySelector('.modal');
        if (modalDiv) {
            modalDiv.appendChild(header);
            modalDiv.appendChild(form);
            modalDiv.appendChild(footer);
        } else {
            // Fallback: contentDiv kullan
            const contentDiv = sheet.querySelector('[id$="-content"]');
            if (contentDiv) {
                contentDiv.appendChild(header);
                contentDiv.appendChild(form);
                contentDiv.appendChild(footer);
            }
        }
        
        this.sheets.profile = sheet;
    }
    
    showSettingsSheet() {
        if (!this.sheets.settings) {
            this.createSettingsSheet();
        }
        this.sheets.settings.update(true);
        document.body.appendChild(this.sheets.settings);
    }
    
    createSettingsSheet() {
        const { createSheet, createSheetHeader, createSheetTitle, createSheetDescription, createSheetContent, createSheetFooter, createInput, createLabel, createButton } = window.AdminComponents;
        
        if (!createSheet) {
            console.error('AdminComponents.createSheet not found');
            if (typeof createToast === 'function') {
                createToast('error', 'Sheet component yüklenemedi');
            }
            return;
        }
        
        const sheet = createSheet({
            id: 'settings-modal-overlay',
            side: 'right',
            open: false,
            onClose: () => {
                this.sheets.settings.update(false);
                setTimeout(() => {
                    if (this.sheets.settings && this.sheets.settings.parentNode) {
                        this.sheets.settings.parentNode.removeChild(this.sheets.settings);
                    }
                }, 300);
            }
        });
        
        const header = createSheetHeader({
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path></svg>',
            title: 'Ayarlar',
            description: 'Uygulama ayarlarını yönetin.',
            onClose: () => {
                this.sheets.settings.update(false);
                setTimeout(() => {
                    if (this.sheets.settings && this.sheets.settings.parentNode) {
                        this.sheets.settings.parentNode.removeChild(this.sheets.settings);
                    }
                }, 300);
            }
        });
        
        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        const settingsSection = document.createElement('div');
        settingsSection.className = 'space-y-4';
        
        // Get settings from localStorage or defaults
        const appSettingsStr = localStorage.getItem('app_settings');
        let appSettings = { notifications: true, darkMode: false, language: 'tr' };
        try {
            if (appSettingsStr) {
                appSettings = { ...appSettings, ...JSON.parse(appSettingsStr) };
            }
        } catch(e) {}
        
        // Bildirimler Switch
        const notificationsDiv = document.createElement('div');
        notificationsDiv.className = 'modal-settings-container';
        const notificationsLeft = document.createElement('div');
        notificationsLeft.className = 'modal-settings-left';
        const notificationsLabelDiv = document.createElement('div');
        notificationsLabelDiv.className = 'modal-form-label-wrapper';
        notificationsLabelDiv.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>';
        const notificationsLabel = document.createElement('label');
        notificationsLabel.textContent = 'Bildirimler';
        notificationsLabelDiv.appendChild(notificationsLabel);
        notificationsLeft.appendChild(notificationsLabelDiv);
        const notificationsDesc = document.createElement('p');
        notificationsDesc.className = 'modal-settings-description';
        notificationsDesc.textContent = 'E-posta ve push bildirimleri al';
        notificationsLeft.appendChild(notificationsDesc);
        notificationsDiv.appendChild(notificationsLeft);
        const notificationsSwitch = document.createElement('label');
        notificationsSwitch.className = 'modal-settings-switch';
        const notificationsInput = document.createElement('input');
        notificationsInput.type = 'checkbox';
        notificationsInput.className = 'sr-only peer';
        notificationsInput.checked = appSettings.notifications;
        notificationsInput.addEventListener('change', (e) => {
            appSettings.notifications = e.target.checked;
            localStorage.setItem('app_settings', JSON.stringify(appSettings));
        });
        const notificationsSwitchDiv = document.createElement('div');
        notificationsSwitchDiv.className = 'w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600';
        notificationsSwitch.appendChild(notificationsInput);
        notificationsSwitch.appendChild(notificationsSwitchDiv);
        notificationsDiv.appendChild(notificationsSwitch);
        settingsSection.appendChild(notificationsDiv);
        
        // Karanlık Mod Switch
        const darkModeDiv = document.createElement('div');
        darkModeDiv.className = 'modal-settings-container';
        const darkModeLeft = document.createElement('div');
        darkModeLeft.className = 'modal-settings-left';
        const darkModeLabelDiv = document.createElement('div');
        darkModeLabelDiv.className = 'modal-form-label-wrapper';
        darkModeLabelDiv.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>';
        const darkModeLabel = document.createElement('label');
        darkModeLabel.textContent = 'Karanlık Mod';
        darkModeLabelDiv.appendChild(darkModeLabel);
        darkModeLeft.appendChild(darkModeLabelDiv);
        const darkModeDesc = document.createElement('p');
        darkModeDesc.className = 'modal-settings-description';
        darkModeDesc.textContent = 'Koyu tema kullan';
        darkModeLeft.appendChild(darkModeDesc);
        darkModeDiv.appendChild(darkModeLeft);
        const darkModeSwitch = document.createElement('label');
        darkModeSwitch.className = 'modal-settings-switch';
        const darkModeInput = document.createElement('input');
        darkModeInput.type = 'checkbox';
        darkModeInput.className = 'sr-only peer';
        // Check localStorage for theme preference
        const savedTheme = localStorage.getItem('theme');
        darkModeInput.checked = savedTheme === 'dark';
        darkModeInput.addEventListener('change', (e) => {
            const isDark = e.target.checked;
            // Save theme preference
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            // Update appSettings if it exists
            if (appSettings) {
                appSettings.darkMode = isDark;
                localStorage.setItem('app_settings', JSON.stringify(appSettings));
            }
            // Toggle dark mode on html and body elements
            if (isDark) {
                document.documentElement.classList.add('dark-mode');
                document.body.classList.add('dark-mode');
            } else {
                document.documentElement.classList.remove('dark-mode');
                document.body.classList.remove('dark-mode');
            }
        });
        const darkModeSwitchDiv = document.createElement('div');
        darkModeSwitchDiv.className = 'w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600';
        darkModeSwitch.appendChild(darkModeInput);
        darkModeSwitch.appendChild(darkModeSwitchDiv);
        darkModeDiv.appendChild(darkModeSwitch);
        settingsSection.appendChild(darkModeDiv);
        
        // Dil Select - Şu an gizli, gerekirse aktif edilebilir
        // const languageDiv = document.createElement('div');
        // languageDiv.className = 'p-4 bg-slate-50 rounded-xl space-y-3';
        // const languageLabelDiv = document.createElement('div');
        // languageLabelDiv.className = 'modal-form-label-wrapper';
        // languageLabelDiv.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 text-slate-400"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
        // const languageLabel = document.createElement('label');
        // languageLabel.className = 'text-sm font-semibold';
        // languageLabel.textContent = 'Dil';
        // languageLabelDiv.appendChild(languageLabel);
        // languageDiv.appendChild(languageLabelDiv);
        // const languageSelect = document.createElement('select');
        // languageSelect.className = 'w-full h-11 px-3 bg-white border border-slate-200 rounded-lg text-sm';
        // languageSelect.value = appSettings.language;
        // languageSelect.innerHTML = '<option value="tr">Türkçe</option><option value="en">English</option>';
        // languageSelect.addEventListener('change', (e) => {
        //     appSettings.language = e.target.value;
        //     localStorage.setItem('app_settings', JSON.stringify(appSettings));
        // });
        // languageDiv.appendChild(languageSelect);
        // settingsSection.appendChild(languageDiv);
        
        modalBody.appendChild(settingsSection);
        
        // Modal Footer
        const footer = document.createElement('div');
        footer.className = 'modal-footer';
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn-cancel';
        cancelBtn.textContent = 'İptal';
        cancelBtn.onclick = () => {
            this.sheets.settings.update(false);
            setTimeout(() => {
                if (this.sheets.settings && this.sheets.settings.parentNode) {
                    this.sheets.settings.parentNode.removeChild(this.sheets.settings);
                }
            }, 300);
        };
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'btn-save';
        saveBtn.textContent = 'Kaydet';
        saveBtn.onclick = () => {
            localStorage.setItem('app_settings', JSON.stringify(appSettings));
            if (typeof createToast === 'function') {
                createToast('success', 'Ayarlar kaydedildi');
            }
            this.sheets.settings.update(false);
            setTimeout(() => {
                if (this.sheets.settings && this.sheets.settings.parentNode) {
                    this.sheets.settings.parentNode.removeChild(this.sheets.settings);
                }
            }, 300);
        };
        footer.appendChild(cancelBtn);
        footer.appendChild(saveBtn);
        
        // Modal yapısına göre ekle - Manage sayfasındaki gibi
        const modalDiv = sheet.querySelector('.modal');
        if (modalDiv) {
            modalDiv.appendChild(header);
            modalDiv.appendChild(modalBody);
            modalDiv.appendChild(footer);
        } else {
            // Fallback: contentDiv kullan
            const contentDiv = sheet.querySelector('[id$="-content"]');
            if (contentDiv) {
                contentDiv.appendChild(header);
                contentDiv.appendChild(modalBody);
                contentDiv.appendChild(footer);
            }
        }
        
        this.sheets.settings = sheet;
    }
    
    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }
    
    logout() {
        localStorage.removeItem('admin_user');
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user_id');
        // "Beni Hatırla" bilgilerini SİLME – sadece girişte işareti kaldırıp kaydedince temizlensin
        window.location.href = '/console-login';
    }
}

// Sayfa yüklendiğinde admin paneli başlat
let adminPanel;
document.addEventListener('DOMContentLoaded', function() {
    adminPanel = new AdminPanel();
    window.adminPanel = adminPanel; // Global erişim için
    
    // Tüm telefon input'larına formatlama uygula - manage sayfasındaki gibi
    function applyPhoneFormatting() {
        const phoneInputs = document.querySelectorAll('input[type="tel"], input[name="phone"], #tenant-phone, #edit-tenant-phone');
        phoneInputs.forEach(input => {
            if (input && !input.hasAttribute('data-phone-formatted') && !input.hasAttribute('data-tr-phone-mask')) {
                if (typeof window.setupPhoneInput === 'function') {
                    window.setupPhoneInput(input);
                } else if (typeof attachTRPhoneMask === 'function') {
                    attachTRPhoneMask(input);
                }
            }
        });
    }
    
    applyPhoneFormatting();
    
    // MutationObserver ile dinamik eklenen input'ları da yakala - manage sayfasındaki gibi
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) {
                    const phoneInputs = node.querySelectorAll ? node.querySelectorAll('input[type="tel"], input[name="phone"], #tenant-phone, #edit-tenant-phone') : [];
                    phoneInputs.forEach(input => {
                        if (input && !input.hasAttribute('data-phone-formatted') && !input.hasAttribute('data-tr-phone-mask')) {
                            if (typeof window.setupPhoneInput === 'function') {
                                window.setupPhoneInput(input);
                            } else if (typeof attachTRPhoneMask === 'function') {
                                attachTRPhoneMask(input);
                            }
                        }
                    });
                    if (node.tagName === 'INPUT' && (node.type === 'tel' || node.name === 'phone' || node.id === 'tenant-phone' || node.id === 'edit-tenant-phone')) {
                        if (!node.hasAttribute('data-phone-formatted') && !node.hasAttribute('data-tr-phone-mask')) {
                            if (typeof window.setupPhoneInput === 'function') {
                                window.setupPhoneInput(node);
                            } else if (typeof attachTRPhoneMask === 'function') {
                                attachTRPhoneMask(node);
                            }
                        }
                    }
                }
            });
        });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
});

// ========================================================================
// 🔔 BİLDİRİMLER - AdminPanel için
// ========================================================================

AdminPanel.prototype.initNotifications = function() {
    // Sadece console.html sayfasında çalış (console-tenant-manage.html'de çalışma)
    const isTenantManagePage = document.documentElement.classList.contains('console-tenant-manage-page') ||
                                document.body.classList.contains('console-tenant-manage-page') ||
                                window.location.pathname.includes('console-tenant-manage');
    if (isTenantManagePage) {
        return;
    }
    
    const notificationBtn = document.getElementById('notification-btn');
    const notificationDropdown = document.getElementById('notification-dropdown');
    const notificationClose = document.getElementById('notification-close');
    const notificationReadAll = document.getElementById('notification-read-all');
    const notificationFilters = document.querySelectorAll('.notification-filter');
    
    if (!notificationBtn || !notificationDropdown) {
        console.warn('⚠️ Bildirim elementleri bulunamadı');
        return;
    }
    
    // BroadcastChannel ile sayfalar arası bildirim güncellemesi
    this.notificationChannel = new BroadcastChannel('floovon-admin-notifications');
    
    this.notificationChannel.onmessage = async (event) => {
        if (event.data.type === 'notification-updated') {
            await this.updateNotificationBadge();
            await this.loadNotifications(null, true);
            const isDropdownOpen = notificationDropdown && notificationDropdown.style.display !== 'none';
            if (isDropdownOpen) {
                const activeFilter = document.querySelector('.notification-filter.active');
                const filterType = activeFilter ? activeFilter.getAttribute('data-filter') : null;
                await this.loadNotifications(filterType === 'all' ? null : filterType);
            }
        } else if (event.data.type === 'admin-profile-updated') {
            const userNameEl = document.getElementById('user-name');
            if (userNameEl && event.data.name) {
                userNameEl.textContent = event.data.name;
            }
            
            const avatarImg = document.getElementById('user-avatar-img');
            const avatarFallback = document.getElementById('user-avatar-fallback');
            if (event.data.profileImage && avatarImg) {
                let imageUrl = event.data.profileImage;
                if (typeof window.getFloovonUploadUrl === 'function') {
                    imageUrl = window.getFloovonUploadUrl(imageUrl);
                } else if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
                    const backendBase = window.getFloovonBackendBase ? window.getFloovonBackendBase() : (window.BACKEND_BASE_URL || '');
                    imageUrl = backendBase + (imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl);
                }
                avatarImg.src = imageUrl + '?t=' + Date.now();
                avatarImg.classList.remove('hidden');
                avatarImg.onload = () => {
                    if (avatarFallback) {
                        avatarFallback.style.display = 'none';
                    }
                };
                avatarImg.onerror = () => {
                    avatarImg.classList.add('hidden');
                    if (avatarFallback) {
                        avatarFallback.style.display = 'flex';
                    }
                };
            }
            
            this.loadAdminUser();
        }
    };
    
    // Dropdown aç/kapa
    notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const isOpen = notificationDropdown.style.display !== 'none' && !notificationDropdown.classList.contains('hidden');
        if (isOpen) {
            notificationDropdown.style.display = 'none';
            notificationDropdown.classList.add('hidden');
        } else {
            notificationDropdown.style.display = 'flex';
            notificationDropdown.classList.remove('hidden');
            this.loadNotifications();
        }
    });
    
    // Kapat butonu
    if (notificationClose) {
        notificationClose.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            notificationDropdown.style.display = 'none';
            notificationDropdown.classList.add('hidden');
        });
    }
    
    // Tümünü okundu işaretle
    if (notificationReadAll) {
        notificationReadAll.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.markAllNotificationsAsRead();
        });
    }
    
    // Filtre butonları
    notificationFilters.forEach(filter => {
        filter.addEventListener('click', async (e) => {
            e.stopPropagation();
            notificationFilters.forEach(f => f.classList.remove('active'));
            filter.classList.add('active');
            const filterType = filter.getAttribute('data-filter');
            await this.loadNotifications(null, true);
            await this.loadNotifications(filterType === 'all' ? null : filterType);
        });
    });
    
    // Dışarı tıklanınca kapat
    document.addEventListener('click', (e) => {
        if (!notificationDropdown.contains(e.target) && !notificationBtn.contains(e.target)) {
            notificationDropdown.style.display = 'none';
            notificationDropdown.classList.add('hidden');
        }
    });
    
    // Her 30 saniyede bir bildirim badge'ini otomatik güncelle
    setInterval(() => {
        const isDropdownOpen = notificationDropdown && notificationDropdown.style.display !== 'none';
        if (isDropdownOpen) {
            const activeFilter = document.querySelector('.notification-filter.active');
            const filterType = activeFilter ? activeFilter.getAttribute('data-filter') : null;
            this.loadNotifications(filterType === 'all' ? null : filterType);
        } else {
            this.updateNotificationBadge();
        }
    }, 30000);
    
    // İlk yükleme
    this.updateNotificationBadge();
};

AdminPanel.prototype.loadNotifications = async function(filterType = null, updateBadgesOnly = false) {
    const notificationList = document.getElementById('notification-list');
    if (!notificationList) return;
    
    try {
        let url = `${this.apiBase}/admin/notifications?limit=50`;
        if (filterType) {
            url += `&type=${filterType}`;
        }
        
        const response = await fetch(url, {
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${this.adminToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Bildirimler yüklenemedi');
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Bildirimler yüklenemedi');
        }
        
        const notifications = result.data || [];
        const unreadCount = result.unread_count || 0;
        
        this.updateNotificationBadge(unreadCount);
        
        if (updateBadgesOnly) {
            const allNotificationsResponse = await fetch(`${this.apiBase}/admin/notifications?limit=1000`, {
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                }
            });
            if (allNotificationsResponse.ok) {
                const allResult = await allNotificationsResponse.json();
                if (allResult.success) {
                    const allNotifications = allResult.data || [];
                    this.updateFilterBadges(allNotifications);
                }
            }
            return;
        }
        
        const footer = document.getElementById('notification-footer');
        if (footer) {
            footer.style.display = unreadCount > 0 ? 'block' : 'none';
        }
        
        this.renderNotifications(notifications);
        
        const allNotificationsResponse = await fetch(`${this.apiBase}/admin/notifications?limit=1000`, {
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${this.adminToken}`,
                'Content-Type': 'application/json'
            }
        });
        if (allNotificationsResponse.ok) {
            const allResult = await allNotificationsResponse.json();
            if (allResult.success) {
                const allNotifications = allResult.data || [];
                this.updateFilterBadges(allNotifications);
            }
        }
        
        const criticalNotifications = notifications.filter(n => n.type === 'critical' && n.is_read === 0);
        if (criticalNotifications.length > 0) {
            this.playNotificationSound();
        }
        
    } catch (error) {
        console.error('❌ Bildirimler yüklenirken hata:', error);
        if (notificationList) {
            notificationList.innerHTML = '<div class="notification-empty">Bildirimler yüklenemedi. Lütfen sayfayı yenileyin.</div>';
        }
    }
};

AdminPanel.prototype.updateNotificationBadge = async function(count = null) {
    const badge = document.getElementById('notification-dot');
    if (!badge) {
        console.warn('⚠️ Badge elementi bulunamadı: #notification-dot');
        return;
    }
    
    if (count === null) {
        try {
            const response = await fetch(`${this.apiBase}/admin/notifications?limit=1&unread_only=true`, {
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                count = result.unread_count || 0;
            } else {
                return;
            }
        } catch (error) {
            console.error('❌ Badge güncellenirken hata:', error);
            return;
        }
    }
    
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
};

AdminPanel.prototype.renderNotifications = function(notifications) {
    const notificationList = document.getElementById('notification-list');
    if (!notificationList) return;
    
    if (notifications.length === 0) {
        notificationList.innerHTML = '<div class="notification-empty">Henüz bildirim yok.</div>';
        return;
    }
    
    const typeIcons = {
        critical: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>',
        warning: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>',
        info: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>',
        system: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><path d="M9 9h6v6H9z"></path></svg>'
    };
    
    const typeColors = {
        critical: 'critical',
        warning: 'warning',
        info: 'info',
        system: 'system'
    };
    
    notificationList.innerHTML = notifications.map(notif => {
        const icon = typeIcons[notif.type] || typeIcons.info;
        const colorClass = typeColors[notif.type] || 'info';
        const isUnread = notif.is_read === 0;
        const timeAgo = this.formatTimeAgo(notif.created_at);
        const username = notif.created_by_username ? `@${notif.created_by_username}` : '';
        const timeDisplay = username ? `${username} • ${timeAgo}` : timeAgo;
        
        return `
            <div class="notification-item ${colorClass} ${isUnread ? 'unread' : ''}" data-id="${notif.id}">
                <div class="notification-item-icon ${colorClass}">
                    ${icon}
                </div>
                <div class="notification-item-content">
                    <div class="notification-item-title">${this.escapeHtml(notif.title)}</div>
                    <div class="notification-item-message">${this.escapeHtml(notif.message)}</div>
                    <div class="notification-item-time">${timeDisplay}</div>
                </div>
                ${isUnread ? '<div class="notification-item-dot"></div>' : ''}
            </div>
        `;
    }).join('');
    
    notificationList.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            e.stopPropagation();
            const notificationId = parseInt(item.getAttribute('data-id'));
            if (notificationId && item.classList.contains('unread')) {
                if (typeof createToastInteractive === 'function') {
                    createToastInteractive({
                        message: 'Bu bildirimi okundu olarak işaretlemek istiyor musunuz?',
                        confirmText: 'Evet',
                        cancelText: 'Hayır',
                        onConfirm: async (e) => {
                            if (e) e.stopPropagation();
                            await this.markNotificationAsRead(notificationId);
                            item.classList.remove('unread');
                            item.querySelector('.notification-item-dot')?.remove();
                            await this.updateNotificationBadge();
                            await this.loadNotifications(null, true);
                        },
                        onCancel: (e) => {
                            if (e) e.stopPropagation();
                        }
                    });
                } else {
                    await this.markNotificationAsRead(notificationId);
                    item.classList.remove('unread');
                    item.querySelector('.notification-item-dot')?.remove();
                    await this.updateNotificationBadge();
                }
            }
        });
    });
};

AdminPanel.prototype.markNotificationAsRead = async function(notificationId) {
    try {
        const response = await fetch(`${this.apiBase}/admin/notifications/${notificationId}/read`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${this.adminToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Bildirim okundu işaretlenemedi');
        }
        
        const result = await response.json();
        
        if (this.notificationChannel) {
            this.notificationChannel.postMessage({
                type: 'notification-updated'
            });
        }
        
        if (typeof this.updateNotificationBadge === 'function') {
            await this.updateNotificationBadge();
        }
        
        return result.success;
    } catch (error) {
        console.error('❌ Bildirim okundu işaretlenirken hata:', error);
        return false;
    }
};

AdminPanel.prototype.markAllNotificationsAsRead = async function() {
    try {
        const response = await fetch(`${this.apiBase}/admin/notifications/read-all`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${this.adminToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Bildirimler okundu işaretlenemedi');
        }
        
        const result = await response.json();
        
        if (result.success) {
            // Önce tüm bildirimleri yükle ve badge'leri güncelle
            await this.loadNotifications(null, true);
            
            // Aktif filtreyi koru ve bildirimleri göster
            const activeFilter = document.querySelector('.notification-filter.active');
            const filterType = activeFilter ? activeFilter.getAttribute('data-filter') : null;
            await this.loadNotifications(filterType === 'all' ? null : filterType);
            
            if (this.notificationChannel) {
                this.notificationChannel.postMessage({
                    type: 'notification-updated'
                });
            }
            
            if (typeof this.updateNotificationBadge === 'function') {
                await this.updateNotificationBadge();
            }
            
            if (typeof createToast === 'function') {
                createToast('success', 'Tüm bildirimler okundu olarak işaretlendi');
            }
        }
        
        return result.success;
    } catch (error) {
        console.error('❌ Bildirimler okundu işaretlenirken hata:', error);
        if (typeof createToast === 'function') {
            createToast('error', 'Bildirimler güncellenemedi');
        }
        return false;
    }
};

AdminPanel.prototype.updateFilterBadges = function(notifications) {
    const filterTypes = ['all', 'critical', 'warning', 'info', 'system'];
    const unreadCounts = {};
    
    filterTypes.forEach(filterType => {
        if (filterType === 'all') {
            unreadCounts[filterType] = notifications.filter(n => n.is_read === 0).length;
        } else {
            unreadCounts[filterType] = notifications.filter(n => n.type === filterType && n.is_read === 0).length;
        }
    });
    
    filterTypes.forEach(filterType => {
        const filterBtn = document.querySelector(`.notification-filter[data-filter="${filterType}"]`);
        if (filterBtn) {
            // Mevcut badge'leri kaldır (hem eski hem yeni class ile)
            const existingBadge = filterBtn.querySelector('.console-panel-notification-filter-badge') || filterBtn.querySelector('.notification-filter-badge');
            if (existingBadge) {
                existingBadge.remove();
            }
            
            if (unreadCounts[filterType] > 0) {
                const badge = document.createElement('span');
                badge.className = 'console-panel-notification-filter-badge';
                badge.style.cssText = 'position: absolute; top: 4px; right: 4px; width: 6px; height: 6px; background-color: #ef4444; border-radius: 50%;';
                filterBtn.style.position = 'relative';
                filterBtn.appendChild(badge);
            }
        }
    });
};

AdminPanel.prototype.formatTimeAgo = function(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) {
        return 'Az önce';
    } else if (diffMins < 60) {
        return `${diffMins} dakika önce`;
    } else if (diffHours < 24) {
        return `${diffHours} saat önce`;
    } else if (diffDays < 7) {
        return `${diffDays} gün önce`;
    } else {
        return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    }
};

AdminPanel.prototype.escapeHtml = function(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

AdminPanel.prototype.playNotificationSound = function() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
        console.warn('⚠️ Bildirim sesi çalınamadı:', error);
    }
};

// ✅ REVIZE-8: Superadmin kullanıcılarını yükle
AdminPanel.prototype.loadAdminUsers = async function() {
    try {
        const tbody = document.getElementById('admin-users-fullscreen-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="4" class="console-panel-table-loading">Yükleniyor...</td></tr>';
        }
        
        const response = await fetch(`${this.apiBase}/admin/users`, {
            headers: {
                'Authorization': `Bearer ${this.adminToken}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                this.logout();
                return;
            }
            const errorText = await response.text();
            let errorMessage = 'Kullanıcılar yüklenemedi';
            try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.message || errorData.error || errorMessage;
            } catch (e) {
                errorMessage = `HTTP ${response.status}: ${errorText.substring(0, 100)}`;
            }
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        if (result.success) {
            this.adminUsers = result.data || [];
            this.renderAdminUsersInPopup();
        }
    } catch (error) {
        console.error('Superadmin kullanıcıları yüklenirken hata:', error);
        const tbody = document.getElementById('admin-users-fullscreen-tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="4" class="console-panel-table-loading">Hata: ${error.message}</td></tr>`;
        }
        if (typeof createToast === 'function') {
            createToast('error', 'Kullanıcılar yüklenemedi');
        }
    }
};

// ✅ REVIZE-8: Tam sayfa kullanıcılar popup'ını göster
AdminPanel.prototype.showAdminUsersPopup = function() {
    // Eğer popup zaten varsa sadece göster
    let popup = document.getElementById('admin-users-fullscreen-popup');
    if (popup) {
        popup.classList.remove('hidden');
        // ✅ REVIZE-8: Active class'ını da ekle
        setTimeout(() => {
            popup.classList.add('active');
        }, 10);
        // Kullanıcıları yeniden yükle
        this.loadAdminUsers();
        return;
    }
    
    // Popup oluştur
    popup = document.createElement('div');
    popup.id = 'admin-users-fullscreen-popup';
    popup.className = 'admin-users-fullscreen-popup';
    popup.innerHTML = `
        <div class="admin-users-fullscreen-popup-overlay"></div>
        <div class="admin-users-fullscreen-popup-content">
            <div class="admin-users-fullscreen-popup-header">
                <div class="admin-users-fullscreen-popup-header-left">
                    <h2 class="admin-users-fullscreen-popup-title">Superadmin Kullanıcıları</h2>
                    <p class="admin-users-fullscreen-popup-subtitle">Sistemdeki tüm superadmin kullanıcıları ve yetkileri.</p>
                </div>
                <button class="admin-users-fullscreen-popup-close" onclick="window.adminPanel.closeAdminUsersPopup()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="admin-users-fullscreen-popup-body">
                <div class="admin-users-fullscreen-popup-toolbar">
                    <div class="admin-users-fullscreen-popup-search">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="admin-users-fullscreen-popup-search-icon"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>
                        <input 
                            id="admin-users-fullscreen-search"
                            type="text" 
                            placeholder="Kullanıcı ara..." 
                            class="admin-users-fullscreen-popup-search-input"
                        />
                    </div>
                    <button id="admin-users-fullscreen-add-btn" class="admin-users-fullscreen-popup-add-btn" onclick="window.adminPanel.showAddAdminUserSheet()">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Yeni Kullanıcı Ekle
                    </button>
                </div>
                <div class="admin-users-fullscreen-popup-table-wrapper">
                    <table class="console-panel-table console-panel-table-desktop">
                        <thead>
                            <tr class="console-panel-table-header-row">
                                <th class="console-panel-table-header-cell admin-title-letter-spacing">Kullanıcı</th>
                                <th class="console-panel-table-header-cell admin-title-letter-spacing">E-Posta</th>
                                <th class="console-panel-table-header-cell admin-title-letter-spacing">Son Giriş</th>
                                <th class="console-panel-table-header-cell console-panel-table-header-actions admin-title-letter-spacing" style="text-align: center;">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody id="admin-users-fullscreen-tbody">
                            <tr>
                                <td colspan="4" class="console-panel-table-loading">Yükleniyor...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    // Event listener'ları ekle
    const searchInput = popup.querySelector('#admin-users-fullscreen-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            this.adminUsersSearchQuery = e.target.value;
            this.renderAdminUsersInPopup();
        });
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                this.adminUsersSearchQuery = '';
                this.renderAdminUsersInPopup();
            }
        });
    }
    
    
    // Overlay'e tıklandığında kapat
    const overlay = popup.querySelector('.admin-users-fullscreen-popup-overlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            this.closeAdminUsersPopup();
        });
    }
    
    // ESC tuşu ile kapat
    const escHandler = (e) => {
        if (e.key === 'Escape' && !popup.classList.contains('hidden')) {
            this.closeAdminUsersPopup();
        }
    };
    document.addEventListener('keydown', escHandler);
    popup._escHandler = escHandler;
    
    // Popup'ı göster
    setTimeout(() => {
        popup.classList.add('active');
    }, 10);
    
    // Kullanıcıları yükle
    this.loadAdminUsers();
};

// ✅ REVIZE-8: Tam sayfa kullanıcılar popup'ını kapat
AdminPanel.prototype.closeAdminUsersPopup = function() {
    const popup = document.getElementById('admin-users-fullscreen-popup');
    if (popup) {
        popup.classList.remove('active');
        setTimeout(() => {
            popup.classList.add('hidden');
        }, 300);
        
        // ESC handler'ı kaldır
        if (popup._escHandler) {
            document.removeEventListener('keydown', popup._escHandler);
        }
    }
};

// ✅ REVIZE-8: Superadmin kullanıcılarını render et (popup içinde)
AdminPanel.prototype.renderAdminUsersInPopup = function() {
    const tbody = document.getElementById('admin-users-fullscreen-tbody');
    if (!tbody) return;
    
    // Sadece aktif kullanıcıları göster (is_active = 1 olanlar)
    let filteredUsers = this.adminUsers.filter(user => {
        return user.is_active === 1 || user.is_active === true;
    });
    
    // Arama sorgusu varsa filtrele
    if (this.adminUsersSearchQuery && this.adminUsersSearchQuery.trim() !== '') {
        const query = this.adminUsersSearchQuery.toLowerCase();
        filteredUsers = filteredUsers.filter(user => {
            const name = (user.name || '').toLowerCase();
            const email = (user.email || '').toLowerCase();
            const kullaniciadi = (user.kullaniciadi || '').toLowerCase();
            return name.includes(query) || email.includes(query) || kullaniciadi.includes(query);
        });
    }
    
    if (filteredUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="console-panel-table-loading">' + (this.adminUsersSearchQuery ? 'Eşleşen aktif kullanıcı bulunamadı' : 'Henüz aktif kullanıcı bulunmuyor') + '</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredUsers.map(user => {
        const lastLogin = user.last_login ? this.formatTimeAgo(user.last_login) : 'Hiç giriş yapılmamış';
        
        // ✅ REVIZE-8: Avatar gösterimi - admin-tenant-user-avatar-small class'ı ile
        const name = user.name || user.kullaniciadi || 'Bilinmeyen';
        const nameParts = name.split(' ');
        const initials = nameParts.length > 1 
            ? (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase()
            : name.charAt(0).toUpperCase();
        
        // Profil resmi kontrolü
        const profileImage = user.profil_resmi || user.profile_image;
        let avatarHtml = '';
        if (profileImage && profileImage.trim() !== '' && profileImage !== 'undefined' && profileImage !== 'null') {
            // Profil resmi varsa img tag'i kullan
            let imageUrl = profileImage;
            // Önce AdminUserHelpers kullan, yoksa getFloovonUploadUrl
            if (typeof window.AdminUserHelpers && window.AdminUserHelpers.getProfileImageUrl) {
                imageUrl = window.AdminUserHelpers.getProfileImageUrl(imageUrl);
            } else if (typeof window.getFloovonUploadUrl === 'function') {
                imageUrl = window.getFloovonUploadUrl(imageUrl);
            } else if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
                const backendBase = window.getFloovonBackendBase ? window.getFloovonBackendBase() : (window.BACKEND_BASE_URL || '');
                imageUrl = backendBase + (imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl);
            }
            if (imageUrl && imageUrl.trim() !== '' && imageUrl !== '/') {
                avatarHtml = `<img src="${imageUrl}?t=${Date.now()}" alt="${this.escapeHtml(name)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            }
        }
        // Fallback initials
        const initialsHtml = `<div style="display: ${profileImage ? 'none' : 'flex'}; width: 100%; height: 100%; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: #64748b; background: #f1f5f9; border-radius: 50%;">${initials}</div>`;
        
        return `
            <tr class="console-panel-table-row admin-users-table-row">
                <td class="console-panel-table-cell admin-users-table-cell-user" data-label="Kullanıcı">
                    <div class="admin-users-user-info">
                        <div class="admin-tenant-user-avatar-small">
                            ${avatarHtml}
                            ${initialsHtml}
                        </div>
                        <div class="admin-users-user-details">
                            <div class="admin-users-user-name">${this.escapeHtml(name)}</div>
                            <div class="admin-users-user-username">@${this.escapeHtml(user.kullaniciadi || '')}</div>
                        </div>
                    </div>
                </td>
                <td class="console-panel-table-cell admin-users-table-cell-email" data-label="E-Posta">${this.escapeHtml(user.email || '')}</td>
                <td class="console-panel-table-cell admin-users-table-cell-lastlogin" data-label="Son Giriş">${lastLogin}</td>
                <td class="console-panel-table-cell admin-users-table-cell-actions" data-label="İşlemler">
                    <div class="admin-users-actions">
                        <button class="admin-tenant-action-btn-small edit" onclick="window.adminPanel.editAdminUser(${user.id})" title="Düzenle">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button class="admin-tenant-action-btn-small delete" onclick="window.adminPanel.deleteAdminUser(${user.id})" title="Sil">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

// ✅ REVIZE-8: Superadmin kullanıcılarını render et
AdminPanel.prototype.renderAdminUsers = function() {
    // Popup içindeki tbody'yi render et
    this.renderAdminUsersInPopup();
};

// ✅ REVIZE-8: Yeni superadmin kullanıcı ekleme sheet'ini göster
AdminPanel.prototype.showAddAdminUserSheet = function() {
    if (!window.AdminComponents || !window.AdminComponents.createSheet) {
        console.error('❌ AdminComponents yüklenmemiş!');
        return;
    }
    
    if (this.sheets.addAdminUser) {
        this.sheets.addAdminUser.update(true);
        document.body.appendChild(this.sheets.addAdminUser);
        return;
    }
    
    this.createAddAdminUserSheet();
    if (this.sheets.addAdminUser) {
        this.sheets.addAdminUser.update(true);
        document.body.appendChild(this.sheets.addAdminUser);
    }
};

// ✅ REVIZE-8: Yeni superadmin kullanıcı ekleme sheet'ini oluştur
AdminPanel.prototype.createAddAdminUserSheet = function() {
    const { createSheet, createSheetHeader, createSheetTitle, createSheetDescription, createSheetContent, createSheetFooter } = window.AdminComponents;
    
    let closeAddAdminUserSheetCallback = null;
    
    const sheet = createSheet({
        id: 'add-admin-user-modal-overlay',
        side: 'right',
        open: false,
        onClose: () => {
            if (closeAddAdminUserSheetCallback) {
                closeAddAdminUserSheetCallback(false);
            }
        }
    });
    
    // Modal Header
    const header = createSheetHeader({
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
        title: 'Yeni Superadmin Kullanıcı Ekle',
        description: 'Yeni bir superadmin kullanıcı oluşturun.',
        onClose: () => {
            if (closeAddAdminUserSheetCallback) {
                closeAddAdminUserSheetCallback(false);
            }
        }
    });
    
    // Modal Body
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    
    // Form
    const form = document.createElement('form');
    form.id = 'add-admin-user-form';
    
    // Profil resmi avatar - sadece modal-profile-avatar class'ı ile
    const avatarWrapper = document.createElement('div');
    avatarWrapper.style.marginBottom = '1.5rem';
    avatarWrapper.style.display = 'flex';
    avatarWrapper.style.justifyContent = 'center';
    
    // Boş bir kullanıcı objesi oluştur (avatar için)
    const emptyUser = { name: '', email: '', kullaniciadi: '' };
    const avatar = window.AdminUserHelpers ? window.AdminUserHelpers.createProfileAvatar(emptyUser) : (() => {
        // Fallback: helper yoksa manuel oluştur
        const fallbackAvatar = document.createElement('div');
        fallbackAvatar.className = 'modal-profile-avatar';
        const fallbackDiv = document.createElement('div');
        fallbackDiv.className = 'w-full h-full flex items-center justify-center';
        fallbackDiv.textContent = 'A';
        fallbackAvatar.appendChild(fallbackDiv);
        return fallbackAvatar;
    })();
    
    avatarWrapper.appendChild(avatar);
    modalBody.appendChild(avatarWrapper);
    
    // Ad
    const nameGroup = document.createElement('div');
    nameGroup.className = 'form-group';
    const nameLabel = document.createElement('label');
    nameLabel.htmlFor = 'admin-user-name';
    nameLabel.innerHTML = 'İsim Soyisim <span class="text-red-500">*</span>';
    nameGroup.appendChild(nameLabel);
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'admin-user-name';
    nameInput.name = 'name';
    nameInput.placeholder = 'Kullanıcının adı';
    nameInput.required = true;
    nameGroup.appendChild(nameInput);
    modalBody.appendChild(nameGroup);
    
    // Kullanıcı Adı
    const kullaniciadiGroup = document.createElement('div');
    kullaniciadiGroup.className = 'form-group';
    const kullaniciadiLabel = document.createElement('label');
    kullaniciadiLabel.htmlFor = 'admin-user-kullaniciadi';
    kullaniciadiLabel.innerHTML = 'Kullanıcı Adı <span class="text-red-500">*</span>';
    kullaniciadiGroup.appendChild(kullaniciadiLabel);
    const kullaniciadiWrapper = document.createElement('div');
    kullaniciadiWrapper.className = 'input-with-prefix';
    const kullaniciadiPrefix = document.createElement('span');
    kullaniciadiPrefix.className = 'input-prefix';
    kullaniciadiPrefix.textContent = '@';
    kullaniciadiWrapper.appendChild(kullaniciadiPrefix);
    const kullaniciadiInput = document.createElement('input');
    kullaniciadiInput.type = 'text';
    kullaniciadiInput.id = 'admin-user-kullaniciadi';
    kullaniciadiInput.name = 'kullaniciadi';
    kullaniciadiInput.placeholder = 'kullanıcıadı';
    kullaniciadiInput.required = true;
    kullaniciadiWrapper.appendChild(kullaniciadiInput);
    kullaniciadiGroup.appendChild(kullaniciadiWrapper);
    modalBody.appendChild(kullaniciadiGroup);
    
    // E-posta
    const emailGroup = document.createElement('div');
    emailGroup.className = 'form-group';
    const emailLabel = document.createElement('label');
    emailLabel.htmlFor = 'admin-user-email';
    emailLabel.innerHTML = 'E-posta <span class="text-red-500">*</span>';
    emailGroup.appendChild(emailLabel);
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.id = 'admin-user-email';
    emailInput.name = 'email';
    emailInput.placeholder = 'ornek@email.com';
    emailInput.required = true;
    emailGroup.appendChild(emailInput);
    modalBody.appendChild(emailGroup);
    
    // Şifre
    const passwordGroup = document.createElement('div');
    passwordGroup.className = 'form-group';
    const passwordLabel = document.createElement('label');
    passwordLabel.htmlFor = 'admin-user-password';
    passwordLabel.innerHTML = 'Şifre <span class="text-red-500">*</span>';
    passwordGroup.appendChild(passwordLabel);
    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.id = 'admin-user-password';
    passwordInput.name = 'password';
    passwordInput.placeholder = 'Güvenli bir şifre girin';
    passwordInput.required = true;
    passwordGroup.appendChild(passwordInput);
    modalBody.appendChild(passwordGroup);
    
    form.appendChild(modalBody);
    
    // Form kapatma fonksiyonu
    const closeAddAdminUserSheet = (force = false) => {
        form.reset();
        this.sheets.addAdminUser.update(false);
        setTimeout(() => {
            if (this.sheets.addAdminUser && this.sheets.addAdminUser.parentNode) {
                this.sheets.addAdminUser.parentNode.removeChild(this.sheets.addAdminUser);
                this.sheets.addAdminUser = null;
            }
        }, 300);
    };
    
    // Callback'i ata
    closeAddAdminUserSheetCallback = closeAddAdminUserSheet;
    
    // Footer - Manuel oluştur
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn-cancel';
    cancelBtn.textContent = 'İptal';
    cancelBtn.addEventListener('click', () => {
        closeAddAdminUserSheet(false);
    });
    const submitBtn = document.createElement('button');
    submitBtn.type = 'button'; // ✅ REVIZE-8: type='button' yap, form submit'i manuel tetikle
    submitBtn.className = 'btn-save';
    submitBtn.textContent = 'Kullanıcı Ekle';
    submitBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.saveAdminUser();
    });
    footer.appendChild(cancelBtn);
    footer.appendChild(submitBtn);
    
    // Form submit handler (ekstra güvenlik için)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveAdminUser();
    });
    
    // Modal yapısına göre ekle - Console sayfasındaki gibi
    const modalDiv = sheet.querySelector('.modal');
    if (modalDiv) {
        modalDiv.appendChild(header);
        modalDiv.appendChild(form);
        modalDiv.appendChild(footer);
    } else {
        // Fallback
        sheet.appendChild(header);
        sheet.appendChild(form);
        sheet.appendChild(footer);
    }
    
    this.sheets.addAdminUser = sheet;
};

// ✅ REVIZE-8: Superadmin kullanıcı ekleme sheet'ini kapat
AdminPanel.prototype.closeAddAdminUserSheet = function() {
    if (this.sheets.addAdminUser) {
        this.sheets.addAdminUser.update(false);
        setTimeout(() => {
            if (this.sheets.addAdminUser && this.sheets.addAdminUser.parentNode) {
                this.sheets.addAdminUser.parentNode.removeChild(this.sheets.addAdminUser);
            }
        }, 300);
    }
};

// ✅ REVIZE-8: Superadmin kullanıcı kaydet
AdminPanel.prototype.saveAdminUser = async function() {
    try {
        const form = document.getElementById('add-admin-user-form');
        if (!form) return;
        
        const formData = new FormData(form);
        const name = formData.get('name');
        const kullaniciadi = formData.get('kullaniciadi');
        const email = formData.get('email');
        const password = formData.get('password');
        
        if (!name || !kullaniciadi || !email || !password) {
            if (typeof createToast === 'function') {
                createToast('error', 'Lütfen tüm zorunlu alanları doldurun');
            }
            return;
        }
        
        // Profil resmi kontrolü - avatar'dan pendingProfileFile'ı al
        // Profil bilgileri modalındaki mantıkla aynı şekilde yükle
        const backendBase = window.getFloovonBackendBase ? window.getFloovonBackendBase() : (window.BACKEND_BASE_URL || 'http://localhost:3001');
        
        // Avatar'ı bul - profil bilgileri modalındaki gibi
        let avatar = document.querySelector('#add-admin-user-modal-overlay .modal-profile-avatar') ||
                     document.querySelector('.modal-overlay.active .modal-profile-avatar');
        
        // Eğer avatar bulunamadıysa, tüm modal-profile-avatar elementlerini kontrol et
        if (!avatar || !avatar.pendingProfileFile) {
            const allAvatars = document.querySelectorAll('.modal-profile-avatar');
            for (let av of allAvatars) {
                if (av.pendingProfileFile) {
                    avatar = av;
                    break;
                }
            }
        }
        
        let profileImagePath = null;
        if (avatar && avatar.pendingProfileFile) {
            try {
                const formData = new FormData();
                formData.append('profile', avatar.pendingProfileFile);
                
                // ✅ REVIZE-8: Yeni endpoint kullan - sadece path döndürür, veritabanına yazmaz
                const profileResponse = await fetch(`${backendBase}/api/admin/users/profile-upload`, {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                });
                
                const profileResult = await profileResponse.json();
                if (!profileResult.success) {
                    throw new Error(profileResult.error || 'Profil resmi yüklenemedi');
                }
                
                profileImagePath = profileResult.data.path;
                
                // Profil resmi yüklendi, pending file'ı temizle
                avatar.pendingProfileFile = null;
                avatar.removeAttribute('data-pending-profile-file');
            } catch (profileError) {
                console.error('Profil resmi yüklenirken hata:', profileError);
                if (typeof createToast === 'function') {
                    createToast('error', profileError.message || 'Profil resmi yüklenemedi');
                }
                return;
            }
        }
        
        const body = {
            name,
            kullaniciadi,
            email,
            password,
            role: 'super_admin' // ✅ REVIZE-8: Hepsi superadmin
        };
        
        // Profil resmi yüklendiyse path'ini ekle
        if (profileImagePath) {
            body.profil_resmi = profileImagePath;
            body.profile_image = profileImagePath; // Her iki alanı da güncelle
        }
        
        console.log('📤 Ekleme body:', body);
        
        const response = await fetch(`${this.apiBase}/admin/users`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.adminToken}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = 'Kullanıcı eklenemedi';
            try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.message || errorData.error || errorMessage;
            } catch (e) {
                errorMessage = `HTTP ${response.status}: ${errorText.substring(0, 100)}`;
            }
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        if (result.success) {
            if (typeof createToast === 'function') {
                createToast('success', 'Kullanıcı başarıyla eklendi');
            }
            this.closeAddAdminUserSheet();
            await this.loadAdminUsers();
            // Popup içindeki listeyi güncelle
            this.renderAdminUsersInPopup();
        }
    } catch (error) {
        console.error('Superadmin kullanıcı eklenirken hata:', error);
        if (typeof createToast === 'function') {
            createToast('error', error.message || 'Kullanıcı eklenemedi');
        }
    }
};

// ✅ REVIZE-8: Superadmin kullanıcı düzenle
AdminPanel.prototype.editAdminUser = function(userId) {
    const user = this.adminUsers.find(u => u.id === userId);
    if (!user) {
        if (typeof createToast === 'function') {
            createToast('error', 'Kullanıcı bulunamadı');
        }
        return;
    }
    
    this.currentEditingAdminUser = user;
    this.showEditAdminUserSheet();
};

// ✅ REVIZE-8: Superadmin kullanıcı düzenleme sheet'ini göster
AdminPanel.prototype.showEditAdminUserSheet = function() {
    if (!this.currentEditingAdminUser) return;
    
    if (!window.AdminComponents || !window.AdminComponents.createSheet) {
        console.error('❌ AdminComponents yüklenmemiş!');
        return;
    }
    
    // Eğer modal zaten varsa, önce kaldır
    if (this.sheets.editAdminUser) {
        if (this.sheets.editAdminUser.parentNode) {
            this.sheets.editAdminUser.parentNode.removeChild(this.sheets.editAdminUser);
        }
        this.sheets.editAdminUser = null;
    }
    
    // Yeni modal oluştur
    this.createEditAdminUserSheet();
    if (this.sheets.editAdminUser) {
        this.sheets.editAdminUser.update(true);
        document.body.appendChild(this.sheets.editAdminUser);
    }
};

// ✅ REVIZE-8: Superadmin kullanıcı düzenleme sheet'ini oluştur
AdminPanel.prototype.createEditAdminUserSheet = function() {
    if (!this.currentEditingAdminUser) return;
    
    const user = this.currentEditingAdminUser;
    const { createSheet, createSheetHeader, createSheetTitle, createSheetDescription, createSheetContent, createSheetFooter } = window.AdminComponents;
    
    let closeEditAdminUserSheetCallback = null;
    
    const sheet = createSheet({
        id: 'edit-admin-user-modal-overlay',
        side: 'right',
        open: false,
        onClose: () => {
            if (closeEditAdminUserSheetCallback) {
                closeEditAdminUserSheetCallback(false);
            }
        }
    });
    
    // Modal Header
    const header = createSheetHeader({
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
        title: 'Kullanıcı Düzenle',
        description: 'Kullanıcı bilgilerini güncelleyin.',
        onClose: () => {
            if (closeEditAdminUserSheetCallback) {
                closeEditAdminUserSheetCallback(false);
            }
        }
    });
    
    // Modal Body
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    
    // Form
    const form = document.createElement('form');
    form.id = 'edit-admin-user-form';
    
    // Profile Section - Profil resmi değiştirme alanı
    const profileSection = document.createElement('div');
    profileSection.className = 'modal-profile-section';
    
    // Avatar oluştur - profil bilgileri modalındaki gibi
    const avatar = window.AdminUserHelpers ? window.AdminUserHelpers.createProfileAvatar(user) : (() => {
        // Fallback: helper yoksa manuel oluştur
        const fallbackAvatar = document.createElement('div');
        fallbackAvatar.className = 'modal-profile-avatar';
        
        // Profil resmi varsa img ekle
        const profileImage = user.profil_resmi || user.profile_image;
        if (profileImage && profileImage.trim() !== '' && profileImage !== 'undefined' && profileImage !== 'null') {
            const img = document.createElement('img');
            let imageUrl = profileImage;
            if (typeof window.AdminUserHelpers && window.AdminUserHelpers.getProfileImageUrl) {
                imageUrl = window.AdminUserHelpers.getProfileImageUrl(imageUrl);
            } else if (typeof window.getFloovonUploadUrl === 'function') {
                imageUrl = window.getFloovonUploadUrl(imageUrl);
            } else if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
                const backendBase = window.getFloovonBackendBase ? window.getFloovonBackendBase() : (window.BACKEND_BASE_URL || '');
                imageUrl = backendBase + (imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl);
            }
            if (imageUrl && imageUrl.trim() !== '' && imageUrl !== '/') {
                img.src = imageUrl + '?t=' + Date.now();
                img.className = 'block';
                img.onerror = () => {
                    img.classList.add('hidden');
                    const fallback = fallbackAvatar.querySelector('div');
                    if (fallback) fallback.style.display = 'flex';
                };
                img.onload = () => {
                    img.classList.remove('hidden');
                    img.classList.add('block');
                    const fallback = fallbackAvatar.querySelector('div');
                    if (fallback) fallback.style.display = 'none';
                };
                fallbackAvatar.appendChild(img);
            }
        }
        
        const fallbackDiv = document.createElement('div');
        fallbackDiv.className = 'w-full h-full flex items-center justify-center';
        const name = user.name || user.email || user.kullaniciadi || 'A';
        fallbackDiv.textContent = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        fallbackDiv.style.display = (profileImage && profileImage.trim() !== '' && profileImage !== 'undefined' && profileImage !== 'null') ? 'none' : 'flex';
        fallbackAvatar.appendChild(fallbackDiv);
        return fallbackAvatar;
    })();
    
    profileSection.appendChild(avatar);
    const profileInfo = document.createElement('div');
    profileInfo.innerHTML = `<h3 class="modal-profile-name">${user.name || 'Kullanıcı'}</h3><span class="modal-profile-badge">${user.role === 'super_admin' ? 'Süper Admin' : 'Admin'}</span>`;
    profileSection.appendChild(profileInfo);
    modalBody.appendChild(profileSection);
    
    // Ad
    const nameGroup = document.createElement('div');
    nameGroup.className = 'form-group';
    const nameLabel = document.createElement('label');
    nameLabel.htmlFor = 'edit-admin-user-name';
    nameLabel.innerHTML = 'İsim Soyisim <span class="text-red-500">*</span>';
    nameGroup.appendChild(nameLabel);
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'edit-admin-user-name';
    nameInput.name = 'name';
    nameInput.placeholder = 'Kullanıcının adı';
    nameInput.value = user.name || '';
    nameInput.required = true;
    nameGroup.appendChild(nameInput);
    modalBody.appendChild(nameGroup);
    
    // Kullanıcı Adı
    const kullaniciadiGroup = document.createElement('div');
    kullaniciadiGroup.className = 'form-group';
    const kullaniciadiLabel = document.createElement('label');
    kullaniciadiLabel.htmlFor = 'edit-admin-user-kullaniciadi';
    kullaniciadiLabel.innerHTML = 'Kullanıcı Adı <span class="text-red-500">*</span>';
    kullaniciadiGroup.appendChild(kullaniciadiLabel);
    const kullaniciadiWrapper = document.createElement('div');
    kullaniciadiWrapper.className = 'input-with-prefix';
    const kullaniciadiPrefix = document.createElement('span');
    kullaniciadiPrefix.className = 'input-prefix';
    kullaniciadiPrefix.textContent = '@';
    kullaniciadiWrapper.appendChild(kullaniciadiPrefix);
    const kullaniciadiInput = document.createElement('input');
    kullaniciadiInput.type = 'text';
    kullaniciadiInput.id = 'edit-admin-user-kullaniciadi';
    kullaniciadiInput.name = 'kullaniciadi';
    kullaniciadiInput.placeholder = 'kullanıcıadı';
    kullaniciadiInput.value = user.kullaniciadi || '';
    kullaniciadiInput.required = true;
    kullaniciadiWrapper.appendChild(kullaniciadiInput);
    kullaniciadiGroup.appendChild(kullaniciadiWrapper);
    modalBody.appendChild(kullaniciadiGroup);
    
    // E-posta
    const emailGroup = document.createElement('div');
    emailGroup.className = 'form-group';
    const emailLabel = document.createElement('label');
    emailLabel.htmlFor = 'edit-admin-user-email';
    emailLabel.innerHTML = 'E-posta <span class="text-red-500">*</span>';
    emailGroup.appendChild(emailLabel);
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.id = 'edit-admin-user-email';
    emailInput.name = 'email';
    emailInput.placeholder = 'ornek@email.com';
    emailInput.value = user.email || '';
    emailInput.required = true;
    emailGroup.appendChild(emailInput);
    modalBody.appendChild(emailGroup);
    
    // Şifre
    const passwordGroup = document.createElement('div');
    passwordGroup.className = 'form-group';
    const passwordLabel = document.createElement('label');
    passwordLabel.htmlFor = 'edit-admin-user-password';
    passwordLabel.innerHTML = 'Yeni Şifre <span class="text-red-500">*</span>';
    passwordGroup.appendChild(passwordLabel);
    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.id = 'edit-admin-user-password';
    passwordInput.name = 'password';
    passwordInput.placeholder = 'Yeni şifre girin (değiştirmek istemiyorsanız boş bırakın)';
    passwordInput.setAttribute('autocomplete', 'new-password');
    // Şifre zorunlu değil
    passwordGroup.appendChild(passwordInput);
    modalBody.appendChild(passwordGroup);
    
    form.appendChild(modalBody);
    
    // Form kapatma fonksiyonu
    const closeEditAdminUserSheet = (force = false) => {
        form.reset();
        this.sheets.editAdminUser.update(false);
        setTimeout(() => {
            if (this.sheets.editAdminUser && this.sheets.editAdminUser.parentNode) {
                this.sheets.editAdminUser.parentNode.removeChild(this.sheets.editAdminUser);
                this.sheets.editAdminUser = null;
            }
        }, 300);
        this.currentEditingAdminUser = null;
    };
    
    // Callback'i ata
    closeEditAdminUserSheetCallback = closeEditAdminUserSheet;
    
    // Footer - Manuel oluştur
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn-cancel';
    cancelBtn.textContent = 'İptal';
    cancelBtn.addEventListener('click', () => {
        closeEditAdminUserSheet(false);
    });
    const submitBtn = document.createElement('button');
    submitBtn.type = 'button'; // ✅ REVIZE-8: type='button' yap, form submit'i manuel tetikle
    submitBtn.className = 'btn-save';
    submitBtn.textContent = 'Kaydet';
    submitBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.updateAdminUser();
    });
    footer.appendChild(cancelBtn);
    footer.appendChild(submitBtn);
    
    // Form submit handler (ekstra güvenlik için)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.updateAdminUser();
    });
    
    // Modal yapısına göre ekle - Console sayfasındaki gibi
    const modalDiv = sheet.querySelector('.modal');
    if (modalDiv) {
        modalDiv.appendChild(header);
        modalDiv.appendChild(form);
        modalDiv.appendChild(footer);
    } else {
        // Fallback
        sheet.appendChild(header);
        sheet.appendChild(form);
        sheet.appendChild(footer);
    }
    
    this.sheets.editAdminUser = sheet;
};

// ✅ REVIZE-8: Superadmin kullanıcı düzenleme sheet'ini kapat
AdminPanel.prototype.closeEditAdminUserSheet = function() {
    if (this.sheets.editAdminUser) {
        this.sheets.editAdminUser.update(false);
        setTimeout(() => {
            if (this.sheets.editAdminUser && this.sheets.editAdminUser.parentNode) {
                this.sheets.editAdminUser.parentNode.removeChild(this.sheets.editAdminUser);
            }
        }, 300);
    }
    this.currentEditingAdminUser = null;
};

// ✅ REVIZE-8: Superadmin kullanıcı güncelle
AdminPanel.prototype.updateAdminUser = async function() {
    try {
        if (!this.currentEditingAdminUser) return;
        
        const form = document.getElementById('edit-admin-user-form');
        if (!form) return;
        
        const formData = new FormData(form);
        const name = formData.get('name');
        const kullaniciadi = formData.get('kullaniciadi');
        const email = formData.get('email');
        const password = formData.get('password');
        
        if (!name || !kullaniciadi || !email) {
            if (typeof createToast === 'function') {
                createToast('error', 'Lütfen tüm zorunlu alanları doldurun');
            }
            return;
        }
        
        // Profil resmi kontrolü - avatar'dan pendingProfileFile'ı al
        // Profil bilgileri modalındaki mantıkla aynı şekilde yükle
        const backendBase = window.getFloovonBackendBase ? window.getFloovonBackendBase() : (window.BACKEND_BASE_URL || 'http://localhost:3001');
        
        // Avatar'ı bul - profil bilgileri modalındaki gibi
        let avatar = document.querySelector('#edit-admin-user-modal-overlay .modal-profile-avatar') ||
                     document.querySelector('.modal-overlay.active .modal-profile-avatar');
        
        // Eğer avatar bulunamadıysa, tüm modal-profile-avatar elementlerini kontrol et
        if (!avatar || !avatar.pendingProfileFile) {
            const allAvatars = document.querySelectorAll('.modal-profile-avatar');
            for (let av of allAvatars) {
                if (av.pendingProfileFile) {
                    avatar = av;
                    break;
                }
            }
        }
        
        let profileImagePath = null;
        if (avatar && avatar.pendingProfileFile) {
            try {
                const formData = new FormData();
                formData.append('profile', avatar.pendingProfileFile);
                
                // ✅ REVIZE-8: Yeni endpoint kullan - sadece path döndürür, veritabanına yazmaz
                const profileResponse = await fetch(`${backendBase}/api/admin/users/profile-upload`, {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                });
                
                const profileResult = await profileResponse.json();
                if (!profileResult.success) {
                    throw new Error(profileResult.error || 'Profil resmi yüklenemedi');
                }
                
                profileImagePath = profileResult.data.path;
                
                // Profil resmi yüklendi, pending file'ı temizle
                avatar.pendingProfileFile = null;
                avatar.removeAttribute('data-pending-profile-file');
            } catch (profileError) {
                console.error('Profil resmi yüklenirken hata:', profileError);
                if (typeof createToast === 'function') {
                    createToast('error', profileError.message || 'Profil resmi yüklenemedi');
                }
                return;
            }
        }
        
        // Sonra diğer bilgileri kaydet
        const body = {
            name,
            kullaniciadi,
            email
        };
        
        // Şifre varsa ekle
        if (password && password.trim() !== '') {
            body.password = password;
        }
        
        // Profil resmi yüklendiyse path'ini ekle, yoksa mevcut profil resmini koru
        if (profileImagePath) {
            body.profil_resmi = profileImagePath;
            body.profile_image = profileImagePath; // Her iki alanı da güncelle
            console.log('✅ Profil resmi path eklendi:', profileImagePath);
        } else {
            console.log('⚠️ Profil resmi path yok');
        }
        
        console.log('📤 Güncelleme body:', body);
        
        const response = await fetch(`${this.apiBase}/admin/users/${this.currentEditingAdminUser.id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${this.adminToken}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = 'Kullanıcı güncellenemedi';
            try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.message || errorData.error || errorMessage;
            } catch (e) {
                errorMessage = `HTTP ${response.status}: ${errorText.substring(0, 100)}`;
            }
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        if (result.success) {
            if (typeof createToast === 'function') {
                createToast('success', 'Kullanıcı başarıyla güncellendi');
            }
            this.closeEditAdminUserSheet();
            await this.loadAdminUsers();
            // Popup içindeki listeyi güncelle
            this.renderAdminUsersInPopup();
        }
    } catch (error) {
        console.error('Superadmin kullanıcı güncellenirken hata:', error);
        if (typeof createToast === 'function') {
            createToast('error', error.message || 'Kullanıcı güncellenemedi');
        }
    }
};

// ✅ REVIZE-8: Superadmin kullanıcı sil
AdminPanel.prototype.deleteAdminUser = async function(userId) {
    try {
        const user = this.adminUsers.find(u => u.id === userId);
        if (!user) {
            if (typeof createToast === 'function') {
                createToast('error', 'Kullanıcı bulunamadı');
            }
            return;
        }
        
        // Toast interactive kullan - manage sayfasındaki gibi
        if (typeof createToastInteractive === 'function') {
            createToastInteractive({
                title: 'Kullanıcı Sil',
                message: 'Bu kullanıcıyı silmek istediğinize emin misiniz? Kullanıcı silinecek ve tablodan kaybolacak.',
                confirmText: 'Sil',
                cancelText: 'İptal',
                isWarning: true,
                confirmButtonClass: 'toast-btn-red',
                onConfirm: async () => {
                    await this.performDeleteAdminUser(userId);
                }
            });
        } else {
            // Fallback olarak confirm kullan
            if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz? Kullanıcı silinecek ve tablodan kaybolacak.')) {
                return;
            }
            await this.performDeleteAdminUser(userId);
        }
    } catch (error) {
        console.error('Superadmin kullanıcı silinirken hata:', error);
        if (typeof createToast === 'function') {
            createToast('error', error.message || 'Kullanıcı silinemedi');
        }
    }
};

// ✅ REVIZE-8: Superadmin kullanıcı silme işlemini gerçekleştir
AdminPanel.prototype.performDeleteAdminUser = async function(userId) {
    try {
        const response = await fetch(`${this.apiBase}/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${this.adminToken}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = 'Kullanıcı silinemedi';
            try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.message || errorData.error || errorMessage;
            } catch (e) {
                errorMessage = `HTTP ${response.status}: ${errorText.substring(0, 100)}`;
            }
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        if (result.success) {
            if (typeof createToast === 'function') {
                createToast('success', 'Kullanıcı başarıyla silindi');
            }
            await this.loadAdminUsers();
            // Popup içindeki listeyi güncelle
            this.renderAdminUsersInPopup();
        } else {
            if (typeof createToast === 'function') {
                createToast('error', result.error || 'Kullanıcı silinemedi');
            }
        }
    } catch (error) {
        console.error('Superadmin kullanıcı silinirken hata:', error);
        if (typeof createToast === 'function') {
            createToast('error', error.message || 'Kullanıcı silinemedi');
        }
    }
};

