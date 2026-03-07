// Admin Tenant Management JavaScript

class TenantManage {
    constructor() {
        this.isOpeningProfileSheet = false; // Profil sheet açılırken flag
        this.apiBase = window.API_BASE_URL || 
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? `http://localhost:${localStorage.getItem('backend_port') || '3001'}/api`
                : ((typeof window.getFloovonApiBase === 'function') 
                    ? window.getFloovonApiBase() 
                    : (window.API_BASE_URL || '/api')));
        
        this.adminUserId = localStorage.getItem('admin_user_id');
        this.adminToken = localStorage.getItem('admin_token');
        this.tenantId = null;
        this.tenant = null;
        this.users = [];
        this.currentEditingUser = null;
        this.currentPasswordUserId = null;
        this.searchQuery = '';
        this.invoiceSearchQuery = '';
        this.activityLogs = [];
        this.activityFilter = 'all';
        this.invoices = [];
        this.odemeYontemleri = [];
        
        // Sheet components for profile, settings, and payment
        this.sheets = {
            profile: null,
            settings: null,
            payment: null,
            upgradePlan: null,
            editPlan: null
        };
        
        this.init();
    }
    
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.admin-tenant-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            }
        });
        
        // Update tab content
        document.querySelectorAll('.admin-tenant-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        const targetContent = document.getElementById(`tab-content-${tabName}`);
        if (targetContent) {
            targetContent.classList.add('active');
        }
        
        // Billing sekmesine geçildiğinde verileri yükle
        if (tabName === 'billing') {
            this.loadBillingData();
        }
        
        // Logs sekmesine geçildiğinde logları yükle
        if (tabName === 'logs') {
            this.loadActivityLogs();
        }
        
        // Users sekmesine geçildiğinde kullanıcıları yeniden yükle
        if (tabName === 'users') {
            this.loadUsers();
        }
        
        // Settings sekmesine geçildiğinde ayarları yükle
        if (tabName === 'settings') {
            this.loadSettingsData();
        }
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
        
        // Mevcut tema durumunu kontrol et
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark-mode');
            document.body.classList.add('dark-mode');
        }
        
        this.initNotifications();
        
        // Admin giriş kontrolü
        if (!this.adminUserId || !this.adminToken) {
            window.location.href = '/console-login';
            return;
        }
        
        // Tenant ID'yi URL'den al - hem 'id' hem 'tenant_id' parametrelerini kontrol et
        const urlParams = new URLSearchParams(window.location.search);
        let tenantIdParam = urlParams.get('id') || urlParams.get('tenant_id');
        
        // GÜVENLİK: Tenant ID validasyonu - sadece sayısal değer kabul et
        if (tenantIdParam) {
            const tenantIdNum = parseInt(tenantIdParam);
            if (isNaN(tenantIdNum) || tenantIdNum <= 0) {
                console.warn('⚠️ GÜVENLİK: Geçersiz tenant ID formatı:', tenantIdParam);
                if (typeof createToast === 'function') {
                    createToast('error', 'Geçersiz tenant ID formatı');
                }
                setTimeout(() => {
                    window.location.href = '/console';
                }, 2000);
                return;
            }
            this.tenantId = tenantIdNum;
        }

        if (!this.tenantId) {
            if (typeof createToast === 'function') {
                createToast('error', 'Tenant ID bulunamadı');
            }
            setTimeout(() => {
                window.location.href = '/console';
            }, 2000);
            return;
        }
        
        this.setupEventListeners();
        this.setupSyncListeners();
        this.loadTenant();
        this.loadUsers();
        this.loadAdminUser();
        this.loadActivityLogs();
        this.loadBillingData();
    }
    
    setupSyncListeners() {
        // Cross-page update için sync event'lerini dinle
        if (window.syncManager && window.syncManager.channel) {
            window.syncManager.channel.addEventListener('message', (event) => {
                const data = event.data;
                if (data && data.type && data.senderId !== window.syncManager.getSenderId()) {
                    if (data.type === 'TENANT_CREATED' || data.type === 'TENANT_UPDATED' || data.type === 'TENANT_STATUS_CHANGED') {
                        // Eğer güncellenen tenant, şu an görüntülenen tenant ise
                        if (data.tenantId && data.tenantId === this.tenantId) {
                            this.loadTenant();
                            this.renderTenantInfo();
                            this.loadSettingsData();
                            this.loadBillingData();
                        }
                    }
                }
            });
        }
        
        // Custom event listener (fallback)
        window.addEventListener('floovon:tenants-updated', (event) => {
            const data = event.detail;
            if (data && data.tenantId && data.tenantId === this.tenantId) {
                this.loadTenant();
                this.renderTenantInfo();
                this.loadSettingsData();
                this.loadBillingData();
            }
        });
    }
    
    setupEventListeners() {
        // ✅ REVIZE-9: Tema geçiş butonu - DOM hazır olduğunda çalıştır
        this.setupThemeToggleWithRetry();
        
        // Geri butonu
        const btnBack = document.getElementById('btn-back');
        if (btnBack && !btnBack.dataset.listenerAdded) {
            btnBack.dataset.listenerAdded = 'true';
            btnBack.addEventListener('click', () => {
                window.location.href = '/console';
            });
        }
        
        // User menu toggle
        const userMenuTrigger = document.getElementById('admin-tenant-user-menu-trigger');
        const userMenuDropdown = document.getElementById('admin-tenant-user-menu-dropdown');
        if (userMenuTrigger && userMenuDropdown && !userMenuTrigger.dataset.listenerAdded) {
            userMenuTrigger.dataset.listenerAdded = 'true';
            userMenuTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                userMenuDropdown.classList.toggle('hidden');
            });
            document.addEventListener('click', (e) => {
                if (!userMenuTrigger.contains(e.target) && !userMenuDropdown.contains(e.target)) {
                    userMenuDropdown.classList.add('hidden');
                }
            });
        }
        
        // Profil butonu
        const btnProfile = document.getElementById('btn-profile');
        if (btnProfile && !btnProfile.dataset.listenerAdded) {
            btnProfile.dataset.listenerAdded = 'true';
            btnProfile.addEventListener('click', () => this.showProfileSheet());
        }
        
        // Ayarlar butonu
        const btnSettings = document.getElementById('btn-settings');
        if (btnSettings && !btnSettings.dataset.listenerAdded) {
            btnSettings.dataset.listenerAdded = 'true';
            btnSettings.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showSettingsSheet();
            });
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
                const userMenuDropdown = document.getElementById('admin-tenant-user-menu-dropdown');
                if (userMenuDropdown) {
                    userMenuDropdown.classList.add('hidden');
                }
                // AdminPanel instance'ı oluştur veya kullan
                if (!window.adminPanel && typeof AdminPanel !== 'undefined') {
                    window.adminPanel = new AdminPanel();
                }
                // Kullanıcılar popup'ını aç
                if (window.adminPanel && typeof window.adminPanel.showAdminUsersPopup === 'function') {
                    window.adminPanel.showAdminUsersPopup();
                } else {
                    console.error('AdminPanel yüklenemedi veya showAdminUsersPopup fonksiyonu bulunamadı');
                }
            });
        }
        
        // Tab navigation
        const tabs = document.querySelectorAll('.admin-tenant-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });
        
        // Yeni kullanıcı ekle butonu
        const btnAddUser = document.getElementById('btn-add-user');
        if (btnAddUser) {
            btnAddUser.addEventListener('click', () => this.showAddUserModal());
        }
        
        // Tenant bilgilerini düzenle butonu
        const btnEditTenant = document.getElementById('btn-edit-tenant');
        if (btnEditTenant) {
            btnEditTenant.addEventListener('click', () => { this.showTenantEditModal(); });
        }
        
        // Devre dışı bırak butonu
        const btnDisableTenant = document.getElementById('btn-disable-tenant');
        if (btnDisableTenant) {
            btnDisableTenant.addEventListener('click', () => this.toggleTenantStatus());
        }
        
        // Ödeme yöntemleri düzenle butonu
        const btnEditPayment = document.getElementById('btn-edit-payment');
        if (btnEditPayment) {
            btnEditPayment.addEventListener('click', () => this.showPaymentEditModal());
        }
        
        // Fatura indir butonları için event delegation
        const invoicesTbody = document.getElementById('invoices-tbody');
        if (invoicesTbody) {
            invoicesTbody.addEventListener('click', (e) => {
                const downloadBtn = e.target.closest('.admin-tenant-download-invoice-btn');
                if (downloadBtn) {
                    const invoiceId = downloadBtn.dataset.invoiceId || downloadBtn.getAttribute('data-invoice-id');
                    if (invoiceId) {
                        this.downloadInvoice(invoiceId);
                    } else {
                        // Fallback: row'dan al
                        const row = downloadBtn.closest('tr');
                        const invoiceNo = row?.querySelector('td:first-child')?.textContent?.trim();
                        if (invoiceNo) {
                            this.downloadInvoice(invoiceNo);
                        }
                    }
                }
            });
        }
        
        // Bildirimler initNotifications() ile yönetiliyor
        
        // Search input - Kullanıcılar
        const searchInput = document.getElementById('search-users');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.renderUsers();
            });
            // ESC tuşu ile arama sıfırlama
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    searchInput.value = '';
                    this.searchQuery = '';
                    this.renderUsers();
                }
            });
        }
        
        // Search input - Faturalar
        const searchInvoicesInput = document.getElementById('search-invoices');
        if (searchInvoicesInput) {
            searchInvoicesInput.addEventListener('input', (e) => {
                this.invoiceSearchQuery = e.target.value.toLowerCase();
                this.renderFaturalar();
            });
            // ESC tuşu ile arama sıfırlama
            searchInvoicesInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    searchInvoicesInput.value = '';
                    this.invoiceSearchQuery = '';
                    this.renderFaturalar();
                }
            });
        }
        
        // Settings buttons
        const btnSaveSettings = document.getElementById('btn-save-settings');
        if (btnSaveSettings) {
            btnSaveSettings.addEventListener('click', () => this.saveSettings());
        }
        
        const btnCancelSettings = document.getElementById('btn-cancel-settings');
        if (btnCancelSettings) {
            btnCancelSettings.addEventListener('click', () => this.cancelSettings());
        }
        
        // Delete tenant button
        const btnDeleteTenant = document.getElementById('btn-delete-tenant');
        if (btnDeleteTenant) {
            btnDeleteTenant.addEventListener('click', () => this.showDeleteTenantDialog());
        }
        
        // Activity filter
        const activityFilter = document.getElementById('activity-filter');
        if (activityFilter) {
            activityFilter.addEventListener('change', (e) => {
                this.activityFilter = e.target.value;
                this.renderActivityLogs();
            });
        }
        
        // Activity buttons
        const btnRefreshLogs = document.getElementById('btn-refresh-logs');
        if (btnRefreshLogs) {
            btnRefreshLogs.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Filtreleri resetle
                this.activityFilter = 'all';
                const activityFilterSelect = document.getElementById('activity-filter');
                if (activityFilterSelect) {
                    activityFilterSelect.value = 'all';
                }
                await this.loadActivityLogs(true); // Toast göster
            });
        }
        
        const btnExportLogs = document.getElementById('btn-export-logs');
        if (btnExportLogs) {
            btnExportLogs.addEventListener('click', () => this.exportActivityLogs());
        }
        
        // Password form validation
        const confirmPasswordInput = document.getElementById('confirm-password');
        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('input', () => this.validatePasswordMatch());
        }
        
        // Modal kapatma
        const modalOverlay = document.getElementById('modal-overlay');
        const modalClose = document.getElementById('modal-close');
        
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    if (this.closeModalWithCheck) {
                        this.closeModalWithCheck(false);
                    } else {
                        this.closeModal();
                    }
                }
            });
        }
        
        if (modalClose) {
            modalClose.addEventListener('click', () => {
                if (this.closeModalWithCheck) {
                    this.closeModalWithCheck(false);
                } else {
                    this.closeModal();
                }
            });
        }
        
        // Şifre modal kapatma
        const modalPasswordOverlay = document.getElementById('modal-password-overlay');
        const modalPasswordClose = document.getElementById('modal-password-close');
        
        if (modalPasswordOverlay) {
            modalPasswordOverlay.addEventListener('click', (e) => {
                if (e.target === modalPasswordOverlay) {
                    this.closePasswordModal();
                }
            });
        }
        
        if (modalPasswordClose) {
            modalPasswordClose.addEventListener('click', () => this.closePasswordModal());
        }
        
        // Form submit
        const userForm = document.getElementById('user-form');
        if (userForm) {
            userForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveUser();
            });
        }
        
        // User form save butonu (form dışında)
        const btnSaveUser = document.getElementById('btn-save');
        if (btnSaveUser) {
            btnSaveUser.addEventListener('click', () => {
                const form = document.getElementById('user-form');
                if (form && form.checkValidity()) {
                    form.dispatchEvent(new Event('submit'));
                } else if (form) {
                    form.reportValidity();
                }
            });
        }
        
        const passwordForm = document.getElementById('password-form');
        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.changePassword();
            });
        }
        
        // Password form save butonu (form dışında)
        const btnSavePassword = document.getElementById('btn-save-password');
        if (btnSavePassword) {
            btnSavePassword.addEventListener('click', () => {
                const form = document.getElementById('password-form');
                if (form && form.checkValidity()) {
                    form.dispatchEvent(new Event('submit'));
                } else if (form) {
                    form.reportValidity();
                }
            });
        }
        
        // Tenant edit form
        const tenantEditForm = document.getElementById('tenant-edit-form');
        if (tenantEditForm) {
            tenantEditForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveTenantEdit();
            });
        }
        
        // Tenant edit form save butonu (form dışında)
        const btnSaveTenantEdit = document.getElementById('btn-save-tenant-edit');
        if (btnSaveTenantEdit) {
            btnSaveTenantEdit.addEventListener('click', () => {
                const form = document.getElementById('tenant-edit-form');
                if (form && form.checkValidity()) {
                    form.dispatchEvent(new Event('submit'));
                } else if (form) {
                    form.reportValidity();
                }
            });
        }
        
        // Tenant edit modal overlay tıklama
        const modalTenantEditOverlay = document.getElementById('modal-tenant-edit-overlay');
        if (modalTenantEditOverlay) {
            modalTenantEditOverlay.addEventListener('click', (e) => {
                if (e.target === modalTenantEditOverlay) {
                    if (this.closeTenantEditModalWithCheck) {
                        this.closeTenantEditModalWithCheck(false);
                    } else {
                        this.closeTenantEditModal();
                    }
                }
            });
        }
        
        // Tenant edit modal close butonu
        const modalTenantEditClose = document.getElementById('modal-tenant-edit-close');
        if (modalTenantEditClose) {
            modalTenantEditClose.addEventListener('click', () => {
                if (this.closeTenantEditModalWithCheck) {
                    this.closeTenantEditModalWithCheck(false);
                } else {
                    this.closeTenantEditModal();
                }
            });
        }
        
        // Event delegation for user table action buttons
        const usersTbody = document.getElementById('users-tbody');
        if (usersTbody) {
            usersTbody.addEventListener('click', (e) => {
                const button = e.target.closest('button[data-action]');
                if (!button) return;
                
                const action = button.dataset.action;
                const userId = button.dataset.userId;
                
                if (!userId) {
                    console.error('❌ User ID bulunamadı!', button);
                    return;
                }
                
                // User action button tıklandı - debug log kaldırıldı
                
                if (action === 'edit') {
                    this.editUser(parseInt(userId));
                } else if (action === 'password') {
                    this.showPasswordModal(parseInt(userId));
                } else if (action === 'toggle') {
                    const user = this.users.find(u => {
                        const uId = typeof u.id === 'string' ? parseInt(u.id) : u.id;
                        return uId === parseInt(userId);
                    });
                    if (user) {
                        // Status kolonunu kontrol et (varsa), yoksa is_active'den çıkar
                        const currentStatus = user.status || (user.is_active === 1 ? 'aktif' : 'pasif');
                        const isActive = currentStatus === 'aktif';
                        // Toggle butonu tıklandı - debug log kaldırıldı
                        this.toggleUserStatus(parseInt(userId), isActive ? 0 : 1);
                    } else {
                        console.error('❌ Kullanıcı bulunamadı toggle için:', userId);
                    }
                } else if (action === 'delete') {
                    this.deleteUser(parseInt(userId));
                }
            });
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
                const userNameEl = document.getElementById('admin-user-name');
                if (userNameEl) {
                    // ✅ REVIZE-13: İsim ve soyisimi birlikte göster
                    const name = adminUser.name || '';
                    const fullName = name.trim() || adminUser.email || adminUser.username || adminUser.kullaniciadi || 'Admin';
                    userNameEl.textContent = fullName;
                }
                
                // Avatar fallback
                const avatarFallback = document.getElementById('admin-tenant-user-avatar-fallback');
                const avatarImg = document.getElementById('admin-tenant-user-avatar-img');
                if (avatarFallback) {
                    const name = adminUser.name || '';
                    const fullName = name.trim() || adminUser.email || adminUser.username || adminUser.kullaniciadi || 'A';
                    avatarFallback.textContent = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                }
                
                // Load profile image from admin_users table if profil_resmi exists
                // Check if profil_resmi is already in adminUser from localStorage
                const profileImageValue = adminUser.profil_resmi || adminUser.profile_image;
                if (profileImageValue && profileImageValue.trim() !== '') {
                    let imageUrl = profileImageValue;
                    
                    // Fix URL if needed
                    if (typeof window.getFloovonUploadUrl === 'function') {
                        imageUrl = window.getFloovonUploadUrl(imageUrl);
                    } else if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
                        const backendBase = window.getFloovonBackendBase ? window.getFloovonBackendBase() : (window.BACKEND_BASE_URL || '');
                        imageUrl = backendBase + (imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl);
                    }
                    
                    if (avatarImg && imageUrl) {
                        avatarImg.src = imageUrl + '?t=' + Date.now();
                        avatarImg.onload = () => {
                            avatarImg.classList.remove('hidden');
                            if (avatarFallback) {
                                avatarFallback.classList.add('avatar-fallback-hidden');
                                avatarFallback.classList.remove('avatar-fallback-visible');
                            }
                        };
                        avatarImg.onerror = () => {
                            avatarImg.classList.add('hidden');
                            if (avatarFallback) {
                                avatarFallback.classList.remove('avatar-fallback-hidden');
                                avatarFallback.classList.add('avatar-fallback-visible');
                            }
                        };
                    }
                }
            }
        } catch (error) {
            console.error('Admin kullanıcı bilgisi yüklenemedi:', error);
        }
    }
    
    async loadTenant() {
        try {
            const response = await fetch(`${this.apiBase}/admin/tenants/${this.tenantId}?t=${Date.now()}`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                },
                credentials: 'include', // Cookie'leri gönder
                cache: 'no-store'
            });
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    console.error('❌ Yetkilendirme hatası');
                    this.logout();
                    return;
                }
                const errorText = await response.text();
                console.error('❌ Tenant yükleme hatası:', errorText);
                throw new Error('Tenant bilgisi yüklenemedi');
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.tenant = result.data;
                
                // Eski/alternatif kolon isimlerini form alanlarına map et (düzenle formunda hepsinin dolması için)
                if (!this.tenant.name && this.tenant.firma_adi) this.tenant.name = this.tenant.firma_adi;
                if (!this.tenant.email && this.tenant.e_posta) this.tenant.email = this.tenant.e_posta;
                if (!this.tenant.phone && this.tenant.telefon) this.tenant.phone = this.tenant.telefon;
                if (!this.tenant.city && this.tenant.il) this.tenant.city = this.tenant.il;
                if (!this.tenant.state && this.tenant.ilce) this.tenant.state = this.tenant.ilce;
                
                
                // ✅ GÜVENLİK: URL'deki tenant_id ile backend'den gelen tenant_id eşleşmeli
                // Backend zaten admin kontrolü yapıyor ama yine de frontend'de de kontrol edelim
                if (this.tenant.id !== parseInt(this.tenantId)) {
                    console.warn('🚨 GÜVENLİK: URL\'deki tenant_id ile backend\'den gelen tenant_id eşleşmiyor!', {
                        urlTenantId: this.tenantId,
                        backendTenantId: this.tenant.id
                    });
                    // Güvenlik: Eşleşmiyorsa console'a yönlendir (manipülasyon denemesi olabilir)
                    if (typeof createToast === 'function') {
                        createToast('error', 'Tenant ID uyuşmazlığı tespit edildi. Yönlendiriliyorsunuz...');
                    }
                    setTimeout(() => {
                        window.location.href = '/console';
                    }, 2000);
                    return;
                }
                
                this.renderTenantInfo();
                this.loadSettingsData();
            } else {
                throw new Error(result.error || 'Tenant bilgisi yüklenemedi');
            }
        } catch (error) {
            console.error('❌ Tenant bilgisi yüklenirken hata:', error);
            if (typeof createToast === 'function') {
                createToast('error', error.message || 'Tenant bilgisi yüklenemedi');
            }
        }
    }
    
    renderTenantInfo() {
        if (!this.tenant) {
            return;
        }
        
        // console.log('🔍 renderTenantInfo çağrıldı, tenant:', this.tenant);
        
        const tenantNameEl = document.getElementById('tenant-name-display');
        const tenantStatusEl = document.getElementById('tenant-status');
        const tenantNameHeaderEl = document.getElementById('tenant-name-header');
        const tenantLocationIconEl = document.getElementById('tenant-location-icon');
        const tenantEmailIconEl = document.getElementById('tenant-email-icon');
        const tenantPhoneIconEl = document.getElementById('tenant-phone-icon');
        const tenantAvatarEl = document.getElementById('admin-tenant-avatar');
        const tenantStatusDotEl = document.getElementById('admin-tenant-status-dot');
        const registerDateEl = document.getElementById('tenant-register-date');
        const tenantPlanNameEl = document.getElementById('tenant-plan-name');
        
        // Status kolonunu kullan (tenants tablosundaki status alanı)
        const currentStatus = this.tenant.status || 'pasif';
        const isActive = currentStatus === 'aktif';
        
        if (tenantNameEl) tenantNameEl.textContent = this.tenant.name || '-';
        // Tenant ismi için karakter sınırı - sadece mobilde 25 karakter
        if (tenantNameHeaderEl) {
            const tenantName = this.tenant.name || 'Tenant Yönetimi';
            const maxLength = window.innerWidth < 640 ? 25 : tenantName.length;
            tenantNameHeaderEl.textContent = tenantName.length > maxLength 
                ? tenantName.substring(0, maxLength) + '...' 
                : tenantName;
        }
        
        // Tenant kodu göster
        const tenantCodeEl = document.getElementById('tenant-code');
        if (tenantCodeEl) {
            tenantCodeEl.textContent = this.tenant.tenants_no || '-';
        }
        
        if (tenantStatusEl) {
            tenantStatusEl.textContent = isActive ? 'Aktif' : 'Pasif';
            tenantStatusEl.className = `admin-tenant-status-badge ${isActive ? 'active' : 'inactive'}`;
        }
        
        if (tenantStatusDotEl) {
            tenantStatusDotEl.className = `admin-tenant-status-dot ${isActive ? 'active' : 'inactive'}`;
        }
        
        // Avatar rengini güncelle (pasif durumda gri)
        if (tenantAvatarEl) {
            tenantAvatarEl.className = `admin-tenant-avatar ${isActive ? '' : 'inactive'}`;
        }
        
        // Devre dışı bırak butonunu güncelle
        const btnDisableTenant = document.getElementById('btn-disable-tenant');
        if (btnDisableTenant) {
            if (isActive) {
                // Aktif durumda - kırmızı "Devre Dışı Bırak"
                btnDisableTenant.className = 'admin-tenant-action-btn admin-tenant-action-btn-disable';
                btnDisableTenant.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
                    Devre Dışı Bırak
                `;
            } else {
                // Pasif durumda - yeşil "Aktif Yap"
                btnDisableTenant.className = 'admin-tenant-action-btn admin-tenant-action-btn-activate';
                btnDisableTenant.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
                    Aktif Yap
                `;
            }
        }
        
        // Konum gösterimi - il/ilçe bilgisi tooltip olarak
        if (tenantLocationIconEl) {
            const city = this.tenant.city || '';
            const state = this.tenant.state || '';
            const locationText = city && state ? `${city}/${state}` : (city || state || '-');
            tenantLocationIconEl.setAttribute('data-tooltip', locationText);
            tenantLocationIconEl.setAttribute('title', locationText);
        }
        
        // Email gösterimi - tooltip olarak ve mailto linki
        if (tenantEmailIconEl) {
            const email = this.tenant.email || '-';
                tenantEmailIconEl.setAttribute('data-tooltip', email);
                tenantEmailIconEl.setAttribute('title', email);
                if (email && email !== '-') {
                    tenantEmailIconEl.classList.add('admin-tenant-email-icon-hoverable');
                    // Önceki event listener'ları kaldır (clone ile)
                    const newEmailIcon = tenantEmailIconEl.cloneNode(true);
                    tenantEmailIconEl.parentNode.replaceChild(newEmailIcon, tenantEmailIconEl);
                    const emailIconEl = newEmailIcon;
                // Click için mailto linki - tooltip'i engellemeden
                emailIconEl.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.location.href = `mailto:${email}`;
                });
            }
        }
        
        // Phone gösterimi - tooltip olarak ve tel linki
        if (tenantPhoneIconEl) {
            const phone = this.tenant.phone || '';
            if (phone && phone !== '-') {
                // Telefon numarasını formatla (+90 (XXX) XXX XX XX)
                const formattedPhone = typeof window.formatPhoneNumber === 'function' 
                    ? window.formatPhoneNumber(phone) 
                    : phone;
                
                // Tel linki için temiz telefon numarası (E.164 formatı: +905066593545)
                const digits = phone.replace(/\D/g, '');
                let cleanPhone = digits;
                // 12 haneli ve 90 ile başlıyorsa direkt kullan
                if (digits.length === 12 && digits.startsWith('90')) {
                    cleanPhone = digits;
                } else if (digits.length === 10) {
                    cleanPhone = '90' + digits;
                } else if (digits.length === 11 && digits.startsWith('0')) {
                    cleanPhone = '90' + digits.substring(1);
                } else if (digits.length >= 10) {
                    cleanPhone = '90' + digits.substring(digits.length - 10);
                }
                
                tenantPhoneIconEl.setAttribute('data-tooltip', formattedPhone);
                tenantPhoneIconEl.setAttribute('title', formattedPhone);
                tenantPhoneIconEl.classList.add('admin-tenant-phone-icon-hoverable');
                
                // Önceki event listener'ları kaldır (clone ile)
                const newPhoneIcon = tenantPhoneIconEl.cloneNode(true);
                tenantPhoneIconEl.parentNode.replaceChild(newPhoneIcon, tenantPhoneIconEl);
                const phoneIconEl = newPhoneIcon;
                // Click için tel linki - tooltip'i engellemeden
                phoneIconEl.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.location.href = `tel:+${cleanPhone}`;
                });
            } else {
                tenantPhoneIconEl.setAttribute('data-tooltip', '(Telefon numarası yok)');
                tenantPhoneIconEl.setAttribute('title', '(Telefon numarası yok)');
                tenantPhoneIconEl.classList.add('admin-tenant-phone-icon-default');
                tenantPhoneIconEl.classList.remove('admin-tenant-phone-icon-hoverable');
                // Tel linki ve hover efekti kaldır (telefon yoksa)
                tenantPhoneIconEl.onclick = null;
                tenantPhoneIconEl.onmouseenter = null;
                tenantPhoneIconEl.onmouseleave = null;
            }
        }
        
        // Tooltip sistemini yeniden başlat (initUnifiedTooltipSystem)
        // setTimeout ile biraz gecikme ver ki DOM güncellensin
        setTimeout(() => {
            // Önce title attribute'unu set et (her zaman çalışır)
            [tenantLocationIconEl, tenantEmailIconEl, tenantPhoneIconEl].forEach(el => {
                if (el) {
                    const tooltipText = el.getAttribute('data-tooltip');
                    if (tooltipText) {
                        el.setAttribute('title', tooltipText);
                    }
                }
            });
            
            // Sonra initUnifiedTooltipSystem'i çağır (eğer varsa)
            if (typeof window.initUnifiedTooltipSystem === 'function') {
                window.initUnifiedTooltipSystem();
            }
        }, 100);
        
        if (tenantAvatarEl) {
            const name = this.tenant.name || 'T';
            tenantAvatarEl.textContent = name.substring(0, 2).toUpperCase();
        }
        
        // Register date gösterimi - en son render edilsin, override edilmesin diye
        if (registerDateEl) {
            // Önce register_date'i kontrol et, yoksa created_at'i kullan
            let registerDate = this.tenant.register_date || this.tenant.created_at;
            
            if (registerDate) {
                try {
                    // Tarih formatını parse et (YYYY-MM-DD veya YYYY-MM-DD HH:mm:ss)
                    let date;
                    
                    // String ise parse et
                    if (typeof registerDate === 'string') {
                        // Boş string kontrolü
                        if (registerDate.trim() === '' || registerDate === 'null' || registerDate === 'undefined') {
                            console.warn('⚠️ Boş veya null string:', registerDate);
                            registerDateEl.textContent = 'Kayıt: -';
                            return;
                        }
                        
                        // Sadece tarih varsa (YYYY-MM-DD), UTC olarak parse et
                        if (registerDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                            const [year, month, day] = registerDate.split('-').map(Number);
                            date = new Date(Date.UTC(year, month - 1, day));
                            // console.log('📅 YYYY-MM-DD formatı parse edildi:', { year, month, day, date, dateString: date.toISOString() });
                        } else if (registerDate.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)) {
                            // YYYY-MM-DD HH:mm:ss formatı
                            date = new Date(registerDate);
                            // console.log('📅 YYYY-MM-DD HH:mm:ss formatı parse edildi:', date);
                        } else {
                            // Diğer formatlar için normal parse et
                            date = new Date(registerDate);
                            // console.log('📅 Diğer format parse edildi:', registerDate, '->', date);
                        }
                    } else if (registerDate instanceof Date) {
                        // Zaten Date objesi
                        date = registerDate;
                        // console.log('📅 Date objesi kullanıldı:', date);
                    } else {
                        // Number veya başka bir tip
                        date = new Date(registerDate);
                        // console.log('📅 Number/other tip parse edildi:', registerDate, '->', date);
                    }
                    
                    // Tarih geçerli mi kontrol et
                    if (date && !isNaN(date.getTime())) {
                        const formattedDate = date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                        // console.log('✅ Tarih formatlandı:', formattedDate);
                        
                        // Element'i tekrar bul (DOM güncellenmiş olabilir)
                        const registerDateElFinal = document.getElementById('tenant-register-date');
                        
                        if (registerDateElFinal) {
                            // Önce mevcut değeri kontrol et
                            // console.log('🔍 registerDateElFinal mevcut değer:', registerDateElFinal.textContent);
                            
                            // textContent ile ayarla
                            registerDateElFinal.textContent = `Kayıt: ${formattedDate}`;
                            // console.log('✅ registerDateElFinal.textContent ayarlandı:', registerDateElFinal.textContent);
                            
                            // innerHTML ile de ayarla
                            registerDateElFinal.innerHTML = `Kayıt: ${formattedDate}`;
                            // console.log('✅ registerDateElFinal.innerHTML ayarlandı:', registerDateElFinal.innerHTML);
                            
                            // setAttribute ile de dene
                            registerDateElFinal.setAttribute('data-date', formattedDate);
                            
                            // Force reflow
                            registerDateElFinal.offsetHeight;
                            
                            // Son kontrol - daha uzun bir timeout ile ve override koruması
                            setTimeout(() => {
                                const finalCheck = document.getElementById('tenant-register-date');
                                if (finalCheck) {
                                    // console.log('🔍 registerDateEl final değer (500ms sonra):', finalCheck.textContent);
                                    if (finalCheck.textContent !== `Kayıt: ${formattedDate}` && finalCheck.textContent !== formattedDate) {
                                        console.error('❌ registerDateEl değeri değişti! Başka bir kod override ediyor olabilir.');
                                        console.error('❌ Beklenen:', `Kayıt: ${formattedDate}`, 'Gerçek:', finalCheck.textContent);
                                        // Force update ve override koruması ekle
                                        finalCheck.textContent = `Kayıt: ${formattedDate}`;
                                        finalCheck.innerHTML = `Kayıt: ${formattedDate}`;
                                        finalCheck.setAttribute('data-date', formattedDate);
                                        // Bir kez daha kontrol et
                                        setTimeout(() => {
                                            const finalCheck2 = document.getElementById('tenant-register-date');
                                            if (finalCheck2 && finalCheck2.textContent !== `Kayıt: ${formattedDate}`) {
                                                console.error('❌ registerDateEl hala override ediliyor!');
                                                finalCheck2.textContent = `Kayıt: ${formattedDate}`;
                                                finalCheck2.innerHTML = `Kayıt: ${formattedDate}`;
                                            }
                                        }, 100);
                                    } else {
                                        // console.log('✅ registerDateEl değeri korundu!');
                                    }
                                } else {
                                    console.error('❌ registerDateEl elementi 500ms sonra bulunamadı!');
                                }
                            }, 500);
                        } else {
                            console.error('❌ registerDateElFinal elementi bulunamadı!');
                        }
                    } else {
                        console.warn('⚠️ Geçersiz tarih formatı:', registerDate, 'Parsed date:', date, 'isNaN:', isNaN(date.getTime()));
                        const registerDateElFinal = document.getElementById('tenant-register-date');
                        if (registerDateElFinal) {
                            registerDateElFinal.textContent = 'Kayıt: -';
                        }
                    }
                } catch (error) {
                    console.error('❌ Tarih formatlama hatası:', error, 'registerDate:', registerDate);
                    registerDateEl.textContent = 'Kayıt: -';
                }
            } else {
                console.warn('⚠️ register_date ve created_at yok!', {
                    register_date: this.tenant.register_date,
                    created_at: this.tenant.created_at
                });
                registerDateEl.textContent = 'Kayıt: -';
            }
        } else {
            console.error('❌ registerDateEl elementi bulunamadı!');
        }
        
        // Plan adı gösterimi - abonelik bilgisinden
        if (tenantPlanNameEl) {
            // Abonelik bilgisi henüz yüklenmemişse, billing data yüklendiğinde güncellenecek
            // Şimdilik abonelik varsa göster
            if (this.abonelik && this.abonelik.plan_adi) {
                tenantPlanNameEl.textContent = this.abonelik.plan_adi;
            } else {
                tenantPlanNameEl.textContent = 'Abonelik planı yok';
            }
        }
        
        // Eski kod kaldırıldı - tarih yukarıda render ediliyor, override edilmemeli
    }
    
    loadSettingsData() {
        if (this.tenant) {
            const settingsName = document.getElementById('settings-name');
            const settingsEmail = document.getElementById('settings-email');
            const settingsPhone = document.getElementById('settings-phone');
            const settingsCity = document.getElementById('settings-city');
            const settingsState = document.getElementById('settings-state');
            
            if (settingsName) settingsName.value = this.tenant.name || '';
            if (settingsEmail) settingsEmail.value = this.tenant.email || '';
            if (settingsPhone) {
                // Veritabanından E.164 formatında geliyor (+90XXXXXXXXXX) veya eski formatlar
                let phoneValue = this.tenant.phone || '';
                // Display formatına çevir (0 (5xx) xxx xx xx)
                if (phoneValue && typeof toDisplayTR === 'function') {
                    phoneValue = toDisplayTR(phoneValue);
                } else if (phoneValue && typeof toE164TR === 'function' && typeof toDisplayTR === 'function') {
                    // Eski formatları normalize et
                    const e164 = toE164TR(phoneValue);
                    phoneValue = e164 ? toDisplayTR(e164) : '+90 (';
                } else if (phoneValue && typeof window.formatPhoneNumber === 'function') {
                    // Fallback: phone-formatter.js'deki formatPhoneNumber kullan
                    phoneValue = window.formatPhoneNumber(phoneValue);
                } else if (phoneValue) {
                    // Son çare: Basit formatlama
                    const digits = phoneValue.replace(/\D/g, '');
                    if (digits.length >= 10) {
                        const last10 = digits.substring(digits.length - 10);
                        phoneValue = window.formatPhoneNumber ? window.formatPhoneNumber(last10) : `+90 (${last10.substring(0, 3)}) ${last10.substring(3, 6)} ${last10.substring(6, 8)} ${last10.substring(8, 10)}`;
                    } else {
                        phoneValue = '+90 (';
                    }
                } else {
                    phoneValue = '+90 (';
                }
                settingsPhone.value = phoneValue;
                // ✅ Console sayfaları için telefon input maskesi uygula
                if (typeof window.setupConsolePhoneInput === 'function') {
                    window.setupConsolePhoneInput(settingsPhone);
                } else if (!settingsPhone.value || settingsPhone.value.trim() === '') {
                    settingsPhone.value = '+90 (';
                }
            }
            
            // E-posta validation ekle
            if (settingsEmail && typeof validateEmailInput === 'function') {
                settingsEmail.addEventListener('blur', () => {
                    validateEmailInput(settingsEmail, true);
                });
                settingsEmail.addEventListener('input', () => {
                    hideInputError(settingsEmail);
                });
            }
            
            // İl select'ini doldur
            if (settingsCity && window.__TR_ADDR__ && window.__TR_ADDR__.provinces) {
                // Önceki event listener'ları temizle
                const newSettingsCity = settingsCity.cloneNode(true);
                settingsCity.parentNode.replaceChild(newSettingsCity, settingsCity);
                
                // İl select'ini doldur
                newSettingsCity.innerHTML = '<option value="">İl Seçiniz</option>';
                window.__TR_ADDR__.provinces.forEach(province => {
                    const option = document.createElement('option');
                    option.value = province.name;
                    option.textContent = province.name;
                    newSettingsCity.appendChild(option);
                });
                
                // Seçili değeri set et ve ilçe listesini yükle
                if (this.tenant && this.tenant.city) {
                    newSettingsCity.value = this.tenant.city;
                    
                    // İlçe listesini yükle - güncel settingsState referansını kullan
                    const currentSettingsState = document.getElementById('settings-state');
                    if (currentSettingsState) {
                        this.loadDistrictsForCity(this.tenant.city, currentSettingsState, this.tenant.state);
                    }
                }
                
                // İl değiştiğinde ilçe listesini güncelle
                newSettingsCity.addEventListener('change', (e) => {
                    const selectedCity = e.target.value;
                    const currentSettingsState = document.getElementById('settings-state');
                    if (currentSettingsState) {
                        this.loadDistrictsForCity(selectedCity, currentSettingsState);
                    }
                });
            } else if (settingsCity && (!window.__TR_ADDR__ || !window.__TR_ADDR__.provinces)) {
                // Location data henüz yüklenmemişse, yüklenene kadar bekle
                console.warn('⚠️ Location data henüz yüklenmemiş, bekleniyor...');
                settingsCity.innerHTML = '<option value="">Yükleniyor...</option>';
                
                // Bir süre sonra tekrar dene
                const checkLocationData = setInterval(() => {
                    if (window.__TR_ADDR__ && window.__TR_ADDR__.provinces) {
                        clearInterval(checkLocationData);
                        // Tekrar doldur
                        this.loadSettingsData();
                    }
                }, 500);
                
                // 10 saniye sonra timeout
                setTimeout(() => {
                    clearInterval(checkLocationData);
                    if (!window.__TR_ADDR__ || !window.__TR_ADDR__.provinces) {
                        settingsCity.innerHTML = '<option value="">Veri yüklenemedi</option>';
                        console.warn('⚠️ Location data yüklenemedi');
                    }
                }, 10000);
            }
        }
    }
    
    loadDistrictsForCity(cityName, stateSelect, selectedState = null) {
        if (!cityName || !stateSelect || !window.__TR_ADDR__) {
            if (stateSelect) {
                stateSelect.innerHTML = '<option value="">İlçe Seçiniz</option>';
            }
            return;
        }
        
        const province = window.__TR_ADDR__.provinces.find(p => p.name === cityName);
        if (!province) {
            stateSelect.innerHTML = '<option value="">İlçe Seçiniz</option>';
            return;
        }
        
        stateSelect.innerHTML = '<option value="">İlçe Seçiniz</option>';
        
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
            if (selectedState) {
                stateSelect.value = selectedState;
            }
        }
    }
    
    async loadUsers() {
        try {
            const tbody = document.getElementById('users-tbody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="6" class="loading">Yükleniyor...</td></tr>';
            }
            
            const response = await fetch(`${this.apiBase}/admin/tenants/${this.tenantId}/users?t=${Date.now()}`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                },
                credentials: 'include', // Cookie'leri gönder
                cache: 'no-store'
            });
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    console.error('❌ Yetkilendirme hatası');
                    this.logout();
                    return;
                }
                const errorText = await response.text();
                console.error('❌ Kullanıcı yükleme hatası:', errorText);
                throw new Error('Kullanıcı listesi yüklenemedi');
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.users = result.data || [];
                this.renderUsers();
                // renderTenantInfo() kaldırıldı - sadece loadTenant() içinde çağrılmalı
                // this.renderTenantInfo(); // Kullanıcı sayısını güncelle
                this.loadBillingData(); // Progress bar'ı güncelle
            } else {
                throw new Error(result.error || 'Kullanıcı listesi yüklenemedi');
            }
        } catch (error) {
            console.error('❌ Kullanıcı listesi yüklenirken hata:', error);
            if (typeof createToast === 'function') {
                createToast('error', error.message || 'Kullanıcı listesi yüklenemedi');
            }
            const tbody = document.getElementById('users-tbody');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="6" class="loading error-text">Hata: ${error.message}</td></tr>`;
            }
        }
    }
    
    renderUsers() {
        // Wait for CSS to be loaded before rendering
        if (!document.body.classList.contains('css-loaded')) {
            // CSS henüz yüklenmedi, render erteleniyor
            setTimeout(() => this.renderUsers(), 100);
            return;
        }
        
        const tbody = document.getElementById('users-tbody');
        if (!tbody) {
            return;
        }
        
        // Sadece is_active = 1 olan kullanıcıları göster (silinen kullanıcılar gösterilmez)
        const activeUsers = this.users.filter(user => {
            // is_active = 0 olanları gizle (silinen kullanıcılar)
            return user.is_active === 1 || user.is_active === true;
        });
        
        // Sonra search query ile filtrele
        let filteredUsers = activeUsers;
        if (this.searchQuery) {
            filteredUsers = activeUsers.filter(user => {
                const name = (user.name || '').toLowerCase();
                const email = (user.email || '').toLowerCase();
            const username = ((user.username || user.kullaniciadi) || '').toLowerCase();
            return name.includes(this.searchQuery) || email.includes(this.searchQuery) || username.includes(this.searchQuery);
            });
        }
        
        // Kullanıcı sayısını başlığa ekle
        const userCount = activeUsers.length;
        const titleEl = document.querySelector('#tab-content-users .admin-tenant-card-title');
        if (titleEl) {
            titleEl.innerHTML = `Organizasyon Kullanıcıları <span class="admin-tenant-code-badge">${userCount} Kullanıcı</span>`;
        }
        
        if (filteredUsers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="admin-tenant-loading">' + (this.searchQuery ? 'Eşleşen aktif kullanıcı bulunamadı' : 'Henüz aktif kullanıcı bulunmuyor') + '</td></tr>';
            return;
        }
        
        tbody.innerHTML = filteredUsers.map(user => {
            // Status kolonunu kontrol et (varsa), yoksa is_active'den çıkar
            const currentStatus = user.status || (user.is_active === 1 ? 'aktif' : 'pasif');
            const isActive = currentStatus === 'aktif';
            // Not: is_admin kolonu kaldırıldı, artık admin_users tablosunda yönetiliyor
            
            // Get user initials for avatar - name ve surname birleştir
            const fullName = (user.name || '') + ' ' + (user.surname || '');
            const displayName = fullName.trim() || user.email || user.username || user.kullaniciadi || 'U';
            const initials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            
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
                    avatarHtml = `<img src="${imageUrl}?t=${Date.now()}" alt="${displayName}" onerror="this.classList.add('hidden'); this.nextElementSibling.classList.remove('hidden');">`;
                }
            }
            // Fallback initials
            const initialsDisplayClass = profileImage ? 'hidden' : '';
            const initialsHtml = `<div class="avatar-initials ${initialsDisplayClass}">${initials}</div>`;
            
            // Get role from database (default to "Sipariş Operatörü" if not set)
            const role = user.role && user.role.trim() !== '' ? user.role : 'Sipariş Operatörü';
            
            // console.log('🔍 User role:', { userId: user.id, userName: user.name, role: user.role, finalRole: role });
            
            // Get last seen from last_login field
            let lastSeen = 'Hiç giriş yapmamış';
            if (user.last_login) {
                const lastLoginDate = new Date(user.last_login);
                const now = new Date();
                const diffMs = now - lastLoginDate;
                
                // Geçersiz tarih kontrolü
                if (!isNaN(lastLoginDate.getTime())) {
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMs / 3600000);
                    const diffDays = Math.floor(diffMs / 86400000);
                    
                    if (diffMins < 1) {
                        lastSeen = 'Şimdi';
                    } else if (diffMins < 60) {
                        lastSeen = `${diffMins} dk önce`;
                    } else if (diffHours < 24) {
                        lastSeen = `${diffHours} saat önce`;
                    } else if (diffDays < 7) {
                        lastSeen = `${diffDays} gün önce`;
                    } else {
                        // 7 günden fazla ise tarih göster
                        const tarihStr = lastLoginDate.toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                        });
                        lastSeen = tarihStr;
                    }
                }
            }
            
            // Telefon numarasını formatla
            let phoneDisplay = '-';
            const phoneValue = user.phone || user.telefon || '';
            if (phoneValue && phoneValue !== 'null' && phoneValue !== 'undefined' && phoneValue.trim() !== '') {
                if (typeof toDisplayTR === 'function') {
                    phoneDisplay = toDisplayTR(phoneValue);
                } else if (typeof window.formatPhoneNumber === 'function') {
                    phoneDisplay = window.formatPhoneNumber(phoneValue);
                } else {
                    // Basit formatlama
                    const digits = phoneValue.toString().replace(/\D/g, '');
                    if (digits.length >= 10) {
                        const last10 = digits.substring(digits.length - 10);
                        phoneDisplay = `+90 (${last10.substring(0, 3)}) ${last10.substring(3, 6)} ${last10.substring(6, 8)} ${last10.substring(8, 10)}`;
                    } else {
                        phoneDisplay = phoneValue;
                    }
                }
            }
            
            return `
            <tr>
                <td data-label="Kullanıcı">
                    <div class="admin-tenant-user-cell">
                        <div class="admin-tenant-user-avatar-small">${avatarHtml}${initialsHtml}</div>
                        <div class="admin-tenant-user-info-cell">
                            <span class="admin-tenant-username-cell">@${user.username || user.kullaniciadi || '-'}</span>
                            <span class="admin-tenant-user-name-cell">${((user.name || '') + ' ' + (user.surname || '')).trim() || '-'}</span>
                        </div>
                    </div>
                </td>
                <td data-label="E-Posta ve Telefon">
                    <div class="admin-tenant-email-phone-cell">
                        <div class="email">${user.email || '-'}</div>
                        <div class="phone">${phoneDisplay}</div>
                    </div>
                </td>
                <td data-label="Yetki">
                    <span class="admin-tenant-role-badge">${role}</span>
                </td>
                <td data-label="Durum">
                    <span class="admin-tenant-status-badge-small ${isActive ? 'active' : 'inactive'}">
                        ${isActive ? 'Aktif' : 'Pasif'}
                    </span>
                </td>
                <td data-label="Son Etkinlik">
                    <div class="admin-tenant-last-seen">
                        <svg class="admin-tenant-last-seen-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        ${lastSeen}
                    </div>
                </td>
                <td data-label="İşlemler" class="admin-tenant-table-actions-cell">
                    <div class="admin-tenant-table-actions">
                        <button class="admin-tenant-action-btn-small edit" data-user-id="${user.id}" data-action="edit">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            Düzenle
                        </button>
                        <button class="admin-tenant-action-btn-small password" data-user-id="${user.id}" data-action="password">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            Şifre Değiştir
                        </button>
                        <button class="admin-tenant-action-btn-small toggle ${isActive ? '' : 'activate'}" data-user-id="${user.id}" data-action="toggle" title="${isActive ? 'Pasif Yap' : 'Aktif Yap'}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
                            ${isActive ? 'Pasif Yap' : 'Aktif Yap'}
                        </button>
                        <button class="admin-tenant-action-btn-small delete" data-user-id="${user.id}" data-action="delete" title="Sil (is_active = 0)">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    }
    
    async deleteUser(id) {
        const user = this.users.find(u => u.id === id);
        if (!user) {
            if (typeof createToast === 'function') {
                createToast('error', 'Kullanıcı bulunamadı');
            }
            return;
        }
        
        // is_admin = 1 olan kullanıcılar silinemez (kiracının varsayılan/ana kullanıcısı)
        if (user.is_admin === 1 || user.is_admin === '1') {
            if (typeof createToast === 'function') {
                createToast('error', 'Bu kullanıcı varsayılan/ana kullanıcı olduğu için silinemez.');
            }
            return;
        }
        
        // Toast ile onay iste
        if (typeof createToastInteractive === 'function') {
            createToastInteractive({
                title: "Kullanıcıyı Sil",
                message: 'Bu kullanıcıyı silmek istediğinize emin misiniz? Kullanıcı silinecek ve tablodan kaybolacak.',
                confirmText: 'Sil',
                cancelText: 'İptal',
                isWarning: true,
                confirmButtonClass: 'toast-btn-red',
                onConfirm: async () => {
                    await this.performUserDelete(id);
                },
                onCancel: () => {}
            });
            return;
        }
        
        // Fallback: eğer createToastInteractive yoksa confirm kullan
        if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz? Kullanıcı silinecek ve tablodan kaybolacak.')) {
            return;
        }
        
        await this.performUserDelete(id);
    }
    
    async performUserDelete(id) {
        try {
            const response = await fetch(`${this.apiBase}/admin/tenants/${this.tenantId}/users/${id}`, {
                method: 'PUT',
                headers: {
                    'X-User-ID': this.adminUserId,
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    is_active: 0
                })
            });
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    this.logout();
                    return;
                }
                const errorData = await response.json();
                throw new Error(errorData.error || 'Kullanıcı silinemedi');
            }
            
            const result = await response.json();
            if (result.success) {
                // Kullanıcı listesini yeniden yükle (hemen, silinen kullanıcı tablodan kaybolsun)
                await this.loadUsers();
                
                // Aktivite loglarını da yenile
                await this.loadActivityLogs();
                
                if (typeof createToast === 'function') {
                    createToast('success', 'Kullanıcı başarıyla silindi');
                }
            } else {
                if (typeof createToast === 'function') {
                    createToast('error', result.error || 'Kullanıcı silinemedi');
                }
            }
        } catch (error) {
            if (typeof createToast === 'function') {
                createToast('error', error.message || 'Kullanıcı silinemedi');
            } else {
                if (typeof createToast === 'function') {
                    createToast('error', 'Kullanıcı silinirken bir hata oluştu: ' + error.message);
                }
            }
        }
    }
    
    showAddUserModal() {
        this.currentEditingUser = null;
        const modal = document.getElementById('modal-overlay');
        const form = document.getElementById('user-form');
        const modalTitle = document.getElementById('modal-title');
        
        if (modalTitle) {
            modalTitle.textContent = 'Yeni Kullanıcı Ekle';
        }
        
        const modalDesc = document.getElementById('modal-description');
        if (modalDesc) {
            modalDesc.textContent = 'Yeni bir kullanıcı hesabı oluşturun.';
        }
        
        const modalIcon = document.getElementById('modal-header-icon');
        if (modalIcon) {
            modalIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>';
        }
        
        if (form) {
            form.reset();
            document.getElementById('user-active').checked = true;
            // Admin yetkisi alanı kaldırıldı - artık kullanılmıyor
            // document.getElementById('user-admin').checked = false;
            document.getElementById('user-password').required = true;
            const passwordGroup = document.getElementById('password-group');
            if (passwordGroup) passwordGroup.style.display = 'block';
            
            // Telefon inputunu başlat
            const phoneEl = document.getElementById('user-phone');
            if (phoneEl) {
                // ✅ Console sayfaları için telefon input maskesi uygula
                // Önce data-phone-formatted attribute'unu kaldır (eğer varsa)
                phoneEl.removeAttribute('data-phone-formatted');
                phoneEl.removeAttribute('data-telefon-formatted');
                phoneEl.removeAttribute('pattern');
                phoneEl.removeAttribute('title');
                phoneEl.classList.remove('input-error');
                // Değeri direkt olarak "+90 (" olarak set et
                phoneEl.value = '+90 (';
                // Console sayfaları için telefon input maskesi uygula
                if (typeof window.setupConsolePhoneInput === 'function') {
                    window.setupConsolePhoneInput(phoneEl);
                }
            }
            
            // Form kontrolü için orijinal değerleri sakla
            const originalPhoneValue = phoneEl ? phoneEl.value.trim() : '';
            const originalValues = {
                firstname: '',
                lastname: '',
                kullaniciadi: '',
                email: '',
                phone: originalPhoneValue,
                password: '',
                role: '',
                isActive: true
            };
            form.dataset.originalValues = JSON.stringify(originalValues);
            
            // Form değişiklik takibi için flag
            let formHasChanges = false;
            
            // Değişiklik kontrolü fonksiyonu
            const checkFormChanges = () => {
                const firstname = document.getElementById('user-firstname').value.trim();
                const lastname = document.getElementById('user-lastname').value.trim();
                const kullaniciadi = document.getElementById('user-kullaniciadi').value.trim();
                const email = document.getElementById('user-email').value.trim();
                const phone = phoneEl ? phoneEl.value.trim() : '';
                const password = document.getElementById('user-password').value;
                const role = document.getElementById('user-role').value;
                const isActive = document.getElementById('user-active').checked;
                // Status'u kontrol et
                const currentStatus = isActive ? 'aktif' : 'pasif';
                
                formHasChanges = (
                    firstname !== originalValues.firstname ||
                    lastname !== originalValues.lastname ||
                    kullaniciadi !== originalValues.kullaniciadi ||
                    email !== originalValues.email ||
                    phone !== originalValues.phone ||
                    password !== originalValues.password ||
                    role !== originalValues.role ||
                    currentStatus !== originalValues.status
                );
            };
            
            // Input değişikliklerini dinle
            const inputs = form.querySelectorAll('input, select');
            inputs.forEach(input => {
                input.addEventListener('input', checkFormChanges);
                input.addEventListener('change', checkFormChanges);
            });
            
            // Form kapatma fonksiyonunu güncelle
            this.closeModalWithCheck = (force = false) => {
                if (!force && formHasChanges) {
                    // Değişiklik var, kullanıcıya sor
                    if (typeof createToastInteractive === 'function') {
                        createToastInteractive({
                            message: 'Değişiklikleri kaydetmek istiyor musunuz?',
                            confirmText: 'Kaydet',
                            cancelText: 'Vazgeç',
                            onConfirm: async () => {
                                // Formu kaydet
                                this.saveUser();
                            },
                            onCancel: () => {
                                // Değişiklikleri sıfırla ve kapat
                                form.reset();
                                document.getElementById('user-active').checked = true;
                                document.getElementById('user-password').required = true;
                                formHasChanges = false;
                                this.closeModal();
                            }
                        });
                    } else {
                        // Fallback: direkt kapat
                        this.closeModal();
                    }
                } else {
                    // Değişiklik yok veya zorla kapat
                    this.closeModal();
                }
            };
            
            // Email validation ekle - sadece blur ve submit'te tooltip göster
            const emailInput = document.getElementById('user-email');
            if (emailInput && typeof validateEmailInput === 'function') {
                emailInput.addEventListener('blur', () => {
                    validateEmailInput(emailInput, false);
                    if (!emailInput.validity.valid) {
                        emailInput.reportValidity();
                    }
                });
                emailInput.addEventListener('input', () => {
                    // Sadece validation yap, tooltip gösterme (yazarken tooltip çıkmasın)
                    validateEmailInput(emailInput, false);
                });
            }
            
            // Phone input formatı: +90 (5XX) XXX XX XX
            const phoneInput = document.getElementById('user-phone');
            if (phoneInput) {
                // ✅ Console sayfaları için telefon input maskesi uygula
                // data-phone-formatted attribute'unu kaldır (eğer varsa)
                phoneInput.removeAttribute('data-phone-formatted');
                phoneInput.removeAttribute('data-telefon-formatted');
                phoneInput.removeAttribute('pattern');
                phoneInput.removeAttribute('title');
                phoneInput.classList.remove('input-error');
                // Console sayfaları için telefon input maskesi uygula
                if (typeof window.setupConsolePhoneInput === 'function') {
                    window.setupConsolePhoneInput(phoneInput);
                } else if (!phoneInput.value || phoneInput.value.trim() === '') {
                    phoneInput.value = '+90 (';
                }
                
                // Telefon validation'ı temizle (modal açıldığında)
                phoneInput.setCustomValidity('');
                
                // Telefon validation ekle - sadece blur ve submit'te tooltip göster
                // Event listener'ları sadece bir kez eklemek için data attribute kullan
                if (!phoneInput.hasAttribute('data-phone-validation-added')) {
                    phoneInput.setAttribute('data-phone-validation-added', 'true');
                    
                    if (typeof validatePhoneInput === 'function') {
                        // Input değiştiğinde sadece validation yap, tooltip gösterme (yazarken tooltip çıkmasın)
                        phoneInput.addEventListener('input', () => {
                            const currentValue = phoneInput.value.trim();
                            if (currentValue && currentValue !== '+90 (' && currentValue.length > 5) {
                                // Sadece validation yap, tooltip gösterme
                                const isValid = validatePhoneInput(phoneInput, false);
                                // Validation geçerli ise custom validity'yi temizle
                                if (isValid) {
                                    phoneInput.setCustomValidity('');
                                    if (phoneInput.validity.customError) {
                                        phoneInput.setCustomValidity('');
                                    }
                                }
                            } else if (currentValue === '+90 (' || currentValue === '') {
                                // Boş veya sadece +90 ( ise validation'ı temizle
                                phoneInput.setCustomValidity('');
                            }
                        });
                        // Blur event'inde kontrol et ve tooltip göster (kullanıcı input'tan çıktığında)
                        phoneInput.addEventListener('blur', () => {
                            if (phoneInput.value && phoneInput.value !== '+90 (' && phoneInput.value.trim() !== '' && phoneInput.value.trim() !== '+90') {
                                const isValid = validatePhoneInput(phoneInput, false);
                                if (isValid) {
                                    // Validation geçerli ise custom validity'yi temizle
                                    phoneInput.setCustomValidity('');
                                    if (phoneInput.validity.customError) {
                                        phoneInput.setCustomValidity('');
                                    }
                                } else {
                                    // Validation başarısız - tooltip göster
                                    if (!phoneInput.validity.valid) {
                                        phoneInput.reportValidity();
                                    }
                                }
                            } else {
                                // Boş ise validation'ı temizle
                                phoneInput.setCustomValidity('');
                            }
                        });
                    }
                } else {
                    // Event listener zaten eklenmiş, sadece validation'ı temizle
                    phoneInput.setCustomValidity('');
                }
            }
        }
        
        if (modal) {
            modal.classList.add('active');
            // Modal açılırken html ve body overflow'u hemen engelle (yatay scroll çıkmasın)
            document.documentElement.classList.add('modal-open');
            document.body.classList.add('modal-open');
        }
    }
    
    editUser(id) {
        // editUser çağrıldı - debug log kaldırıldı
        
        // ID'yi number'a çevir (eğer string ise)
        const userId = typeof id === 'string' ? parseInt(id) : id;
        
        const user = this.users.find(u => {
            const uId = typeof u.id === 'string' ? parseInt(u.id) : u.id;
            return uId === userId;
        });
        
        // Kullanıcı bulundu - debug log kaldırıldı
        
        if (!user) {
            console.error('❌ Kullanıcı bulunamadı!', { id, userId, users: this.users });
            if (typeof createToast === 'function') {
                createToast('error', 'Kullanıcı bulunamadı');
            }
            return;
        }
        
        this.currentEditingUser = user;
        const modal = document.getElementById('modal-overlay');
        const form = document.getElementById('user-form');
        const modalTitle = document.getElementById('modal-title');
        
        // Modal elementleri - debug log kaldırıldı
        
        if (modalTitle) {
            modalTitle.textContent = 'Kullanıcı Düzenle';
        }
        
        const modalDesc = document.getElementById('modal-description');
        if (modalDesc) {
            modalDesc.textContent = 'Kullanıcı bilgilerini güncelleyin.';
        }
        
        const modalIcon = document.getElementById('modal-header-icon');
        if (modalIcon) {
            modalIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        }
        
        if (form) {
            // Modal-profile-section kaldırıldı - sadece superadmin kullanıcı düzenleme formunda olacak
            
            const kullaniciadiEl = document.getElementById('user-kullaniciadi');
            const emailEl = document.getElementById('user-email');
            const phoneEl = document.getElementById('user-phone');
            const passwordEl = document.getElementById('user-password');
            const firstNameEl = document.getElementById('user-firstname');
            const lastNameEl = document.getElementById('user-lastname');
            const activeEl = document.getElementById('user-active');
            // Admin yetkisi alanı kaldırıldı - artık kullanılmıyor
            // const adminEl = document.getElementById('user-admin');
            const roleEl = document.getElementById('user-role');
            
            if (kullaniciadiEl) kullaniciadiEl.value = user.username || user.kullaniciadi || '';
            if (emailEl) emailEl.value = user.email || '';
            if (phoneEl) {
                const phoneValue = user.phone || '';
                // Telefon numarası varsa formatla, yoksa "+90 (" yaz
                if (phoneValue && phoneValue.trim() !== '') {
                    // Önce telefon numarasını kontrol et - geçerli mi?
                    const digits = phoneValue.replace(/\D/g, '');
                    if (digits.length >= 10) {
                        // Geçerli telefon numarası var - formatla
                        if (typeof window.formatPhoneNumber === 'function') {
                            try {
                                const formatted = window.formatPhoneNumber(phoneValue);
                                // formatPhoneNumber'un döndürdüğü değeri kontrol et
                                if (formatted && formatted.trim() !== '' && formatted !== '+90 (90' && !formatted.startsWith('+90 (90') && formatted !== '+90 (') {
                                    phoneEl.value = formatted;
                                } else {
                                    // Formatlanamadıysa manuel formatla
                                    if (digits.length === 12 && digits.startsWith('90')) {
                                        const phoneDigits = digits.substring(2);
                                        phoneEl.value = `+90 (${phoneDigits.substring(0, 3)}) ${phoneDigits.substring(3, 6)} ${phoneDigits.substring(6, 8)} ${phoneDigits.substring(8, 10)}`;
                                    } else if (digits.length === 10) {
                                        phoneEl.value = `+90 (${digits.substring(0, 3)}) ${digits.substring(3, 6)} ${digits.substring(6, 8)} ${digits.substring(8, 10)}`;
                                    } else {
                                        phoneEl.value = '+90 (';
                                    }
                                }
                            } catch (e) {
                                // Hata olursa manuel formatla
                                if (digits.length === 12 && digits.startsWith('90')) {
                                    const phoneDigits = digits.substring(2);
                                    phoneEl.value = `+90 (${phoneDigits.substring(0, 3)}) ${phoneDigits.substring(3, 6)} ${phoneDigits.substring(6, 8)} ${phoneDigits.substring(8, 10)}`;
                                } else if (digits.length === 10) {
                                    phoneEl.value = `+90 (${digits.substring(0, 3)}) ${digits.substring(3, 6)} ${digits.substring(6, 8)} ${digits.substring(8, 10)}`;
                                } else {
                                    phoneEl.value = '+90 (';
                                }
                            }
                        } else {
                            // formatPhoneNumber yoksa manuel formatla
                            if (digits.length === 12 && digits.startsWith('90')) {
                                const phoneDigits = digits.substring(2);
                                phoneEl.value = `+90 (${phoneDigits.substring(0, 3)}) ${phoneDigits.substring(3, 6)} ${phoneDigits.substring(6, 8)} ${phoneDigits.substring(8, 10)}`;
                            } else if (digits.length === 10) {
                                phoneEl.value = `+90 (${digits.substring(0, 3)}) ${digits.substring(3, 6)} ${digits.substring(6, 8)} ${digits.substring(8, 10)}`;
                            } else {
                                phoneEl.value = '+90 (';
                            }
                        }
                    } else {
                        // Geçersiz telefon numarası - boş bırak
                        phoneEl.value = '+90 (';
                    }
                } else {
                    // Telefon numarası yoksa "+90 (" yaz
                    phoneEl.value = '+90 (';
                }
                // ✅ Console sayfalarında phone-formatter kullanılmıyor - Kendi validation yapısı var
                // data-phone-formatted attribute'unu kaldır (eğer varsa)
                phoneEl.removeAttribute('data-phone-formatted');
                phoneEl.removeAttribute('data-telefon-formatted');
                phoneEl.removeAttribute('pattern');
                phoneEl.removeAttribute('title');
                phoneEl.classList.remove('input-error');
                
                // Telefon validation'ı temizle (modal açıldığında)
                phoneEl.setCustomValidity('');
                
                // Telefon validation ekle - Diğer modallardaki gibi
                // Event listener'ları sadece bir kez eklemek için data attribute kullan
                if (!phoneEl.hasAttribute('data-phone-validation-added')) {
                    phoneEl.setAttribute('data-phone-validation-added', 'true');
                    
                    if (typeof validatePhoneInput === 'function') {
                        // Input değiştiğinde hata mesajını temizle ve validation'ı kontrol et
                        phoneEl.addEventListener('input', () => {
                            const currentValue = phoneEl.value.trim();
                            if (currentValue && currentValue !== '+90 (' && currentValue.length > 5) {
                                // Sadece validation yap, tooltip gösterme (yazarken tooltip çıkmasın)
                                const isValid = validatePhoneInput(phoneEl, false);
                                // Validation geçerli ise custom validity'yi temizle
                                if (isValid) {
                                    phoneEl.setCustomValidity('');
                                    if (phoneEl.validity.customError) {
                                        phoneEl.setCustomValidity('');
                                    }
                                }
                            } else if (currentValue === '+90 (' || currentValue === '') {
                                // Boş veya sadece +90 ( ise validation'ı temizle
                                phoneEl.setCustomValidity('');
                            }
                            if (typeof hideInputError === 'function') {
                                hideInputError(phoneEl);
                            }
                        });
                        // Blur event'inde kontrol et (kullanıcı input'tan çıktığında)
                        phoneEl.addEventListener('blur', () => {
                            if (phoneEl.value && phoneEl.value !== '+90 (' && phoneEl.value.trim() !== '' && phoneEl.value.trim() !== '+90') {
                                const isValid = validatePhoneInput(phoneEl, false);
                                if (isValid) {
                                    // Validation geçerli ise custom validity'yi temizle
                                    phoneEl.setCustomValidity('');
                                    if (phoneEl.validity.customError) {
                                        phoneEl.setCustomValidity('');
                                    }
                                } else {
                                    // Validation başarısız - tooltip göster
                                    if (!phoneEl.validity.valid) {
                                        phoneEl.reportValidity();
                                    }
                                }
                            } else {
                                // Boş ise validation'ı temizle
                                phoneEl.setCustomValidity('');
                            }
                        });
                    }
                } else {
                    // Event listener zaten eklenmiş, sadece validation'ı temizle
                    phoneEl.setCustomValidity('');
                }
            }
            if (passwordEl) {
                passwordEl.value = ''; // Şifre gösterilmez
                passwordEl.required = false; // Düzenlemede şifre opsiyonel
            }
            
            // Backend'den name ve surname ayrı kolonlar olarak geliyor
            // Eğer name ve surname ayrıysa direkt kullan, yoksa eski fullname yapısını parse et
            let firstName = '';
            let lastName = '';
            if (user.name && user.surname) {
                // Yeni yapı: name ve surname ayrı kolonlar
                firstName = user.name || '';
                lastName = user.surname || '';
            } else if (user.name && !user.surname) {
                // Eski yapı: name içinde fullname var, parse et
                const nameParts = user.name.trim().split(' ');
                firstName = nameParts[0] || '';
                lastName = nameParts.slice(1).join(' ') || '';
            }
            
            if (firstNameEl) firstNameEl.value = firstName;
            if (lastNameEl) lastNameEl.value = lastName;
            
            // Toggle butonu status'a göre set et
            if (activeEl) {
                const currentStatus = user.status || (user.is_active === 1 ? 'aktif' : 'pasif');
                activeEl.checked = currentStatus === 'aktif';
            }
            // Admin yetkisi alanı kaldırıldı - artık kullanılmıyor
            // if (adminEl) adminEl.checked = user.is_admin === 1;
            if (roleEl) {
                // Rol değerini ayarla
                let userRole = user.role;
                
                // Eğer user.role yoksa veya boşsa, users array'inden bul
                if (!userRole || userRole === null || userRole === undefined || String(userRole).trim() === '') {
                    const foundUser = this.users.find(u => {
                        const uId = typeof u.id === 'string' ? parseInt(u.id) : u.id;
                        const userIdNum = typeof userId === 'string' ? parseInt(userId) : userId;
                        return uId === userIdNum;
                    });
                    if (foundUser && foundUser.role) {
                        userRole = foundUser.role;
                    } else {
                        userRole = 'Sipariş Operatörü';
                    }
                }
                
                // Select'in value'sunu ayarla - Teslimat Sorumlusu -> Sipariş Sorumlusu gösterim uyumu
                const roleForSelect = (userRole === 'Teslimat Sorumlusu') ? 'Sipariş Sorumlusu' : userRole;
                setTimeout(() => {
                    roleEl.value = roleForSelect;
                    if (roleEl.value !== roleForSelect) {
                        setTimeout(() => { roleEl.value = roleForSelect; }, 50);
                    }
                }, 100);
            }
            
            // Şifre grubunu gizle
            const passwordGroup = document.getElementById('password-group');
            if (passwordGroup) {
                passwordGroup.classList.add('hidden');
            }
            
            // Form kontrolü için orijinal değerleri sakla
            // Backend'den name ve surname ayrı kolonlar olarak geliyor
            let originalFirstName = '';
            let originalLastName = '';
            if (user.name && user.surname) {
                // Yeni yapı: name ve surname ayrı kolonlar
                originalFirstName = user.name || '';
                originalLastName = user.surname || '';
            } else if (user.name && !user.surname) {
                // Eski yapı: name içinde fullname var, parse et
                const nameParts = user.name.trim().split(' ');
                originalFirstName = nameParts[0] || '';
                originalLastName = nameParts.slice(1).join(' ') || '';
            }
            
            // Status'u al (status varsa onu kullan, yoksa is_active'den çıkar)
            const originalStatus = user.status || (user.is_active === 1 ? 'aktif' : 'pasif');
            
            // Telefon değerini al
            const originalPhoneValue = phoneEl ? phoneEl.value.trim() : '';
            
            const originalValues = {
                firstname: originalFirstName,
                lastname: originalLastName,
                kullaniciadi: user.username || user.kullaniciadi || '',
                username: user.username || user.kullaniciadi || '',
                email: user.email || '',
                phone: originalPhoneValue,
                password: '',
                role: user.role || '',
                status: originalStatus // Status kullan
            };
            form.dataset.originalValues = JSON.stringify(originalValues);
            
            // Form değişiklik takibi için flag
            let formHasChanges = false;
            
            // Değişiklik kontrolü fonksiyonu
            const checkFormChanges = () => {
                const firstname = firstNameEl ? firstNameEl.value.trim() : '';
                const lastname = lastNameEl ? lastNameEl.value.trim() : '';
                const kullaniciadi = kullaniciadiEl ? kullaniciadiEl.value.trim() : '';
                const email = emailEl ? emailEl.value.trim() : '';
                const phone = phoneEl ? phoneEl.value.trim() : '';
                const password = passwordEl ? passwordEl.value : '';
                const role = roleEl ? roleEl.value : '';
                const isActive = activeEl ? activeEl.checked : false;
                
                formHasChanges = (
                    firstname !== originalValues.firstname ||
                    lastname !== originalValues.lastname ||
                    kullaniciadi !== originalValues.kullaniciadi ||
                    email !== originalValues.email ||
                    phone !== originalValues.phone ||
                    password !== originalValues.password ||
                    role !== originalValues.role ||
                    isActive !== originalValues.isActive
                );
            };
            
            // Input değişikliklerini dinle
            if (firstNameEl) {
                firstNameEl.addEventListener('input', checkFormChanges);
                firstNameEl.addEventListener('change', checkFormChanges);
            }
            if (lastNameEl) {
                lastNameEl.addEventListener('input', checkFormChanges);
                lastNameEl.addEventListener('change', checkFormChanges);
            }
            if (kullaniciadiEl) {
                kullaniciadiEl.addEventListener('input', checkFormChanges);
                kullaniciadiEl.addEventListener('change', checkFormChanges);
            }
            if (emailEl) {
                emailEl.addEventListener('input', checkFormChanges);
                emailEl.addEventListener('change', checkFormChanges);
            }
            if (passwordEl) {
                passwordEl.addEventListener('input', checkFormChanges);
                passwordEl.addEventListener('change', checkFormChanges);
            }
            if (roleEl) {
                roleEl.addEventListener('change', checkFormChanges);
            }
            if (activeEl) {
                activeEl.addEventListener('change', checkFormChanges);
            }
            // ✅ Telefon input'una da form değişiklik takibi ekle
            if (phoneEl) {
                phoneEl.addEventListener('input', checkFormChanges);
                phoneEl.addEventListener('change', checkFormChanges);
            }
            
            // Form kapatma fonksiyonunu güncelle
            this.closeModalWithCheck = (force = false) => {
                if (!force && formHasChanges) {
                    // Değişiklik var, kullanıcıya sor
        if (typeof createToastInteractive === 'function') {
            createToastInteractive({
                            message: 'Değişiklikleri kaydetmek istiyor musunuz?',
                            confirmText: 'Kaydet',
                            cancelText: 'Vazgeç',
                            onConfirm: async () => {
                                // Formu kaydet
                                this.saveUser();
                            },
                            onCancel: () => {
                                // Değişiklikleri sıfırla ve kapat
                                if (firstNameEl) firstNameEl.value = originalValues.firstname;
                                if (lastNameEl) lastNameEl.value = originalValues.lastname;
                                if (kullaniciadiEl) kullaniciadiEl.value = originalValues.kullaniciadi;
                                if (emailEl) emailEl.value = originalValues.email;
                                if (passwordEl) passwordEl.value = '';
                                if (roleEl) roleEl.value = originalValues.role;
                                if (activeEl) activeEl.checked = originalValues.isActive;
                                formHasChanges = false;
                                this.closeModal();
                            }
                        });
                    } else {
                        // Fallback: direkt kapat
                        this.closeModal();
                    }
                } else {
                    // Değişiklik yok veya zorla kapat
                    this.closeModal();
                }
            };
        }
        
        if (modal) {
            modal.classList.add('active');
            // Modal açılırken html ve body overflow'u hemen engelle (yatay scroll çıkmasın)
            document.documentElement.classList.add('modal-open');
            document.body.classList.add('modal-open');
            
            // Modal açıldı - debug log kaldırıldı
        } else {
            console.error('❌ Modal elementi bulunamadı!');
        }
    }
    
    closeModal() {
        // Clear all input error tooltips
        if (typeof clearAllInputErrors === 'function') {
            clearAllInputErrors();
        }
        
        const modal = document.getElementById('modal-overlay');
        if (modal) {
            modal.classList.remove('active');
        }
        // Modal kapandığında body overflow'u geri yükle
        // Eğer başka aktif modal yoksa
        const hasActiveModal = document.querySelector('.modal-overlay.active');
        if (!hasActiveModal) {
            document.documentElement.classList.remove('modal-open');
            document.body.classList.remove('modal-open');
        }
        this.currentEditingUser = null;
        const form = document.getElementById('user-form');
        if (form) {
            form.reset();
            document.getElementById('user-password').required = true; // Reset
            const passwordGroup = document.getElementById('password-group');
            if (passwordGroup) passwordGroup.style.display = 'block';
        }
        
        // Reset modal header
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) {
            modalTitle.textContent = 'Yeni Kullanıcı Ekle';
        }
        const modalDesc = document.getElementById('modal-description');
        if (modalDesc) {
            modalDesc.textContent = 'Yeni bir kullanıcı hesabı oluşturun.';
        }
        const modalIcon = document.getElementById('modal-header-icon');
        if (modalIcon) {
            modalIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>';
        }
    }
    
    showPasswordModal(userId) {
        this.currentPasswordUserId = userId;
        const user = this.users.find(u => u.id === userId);
        const modal = document.getElementById('modal-password-overlay');
        const form = document.getElementById('password-form');
        
        if (form) {
            form.reset();
            // Form değişiklik takibi için orijinal değerleri sakla
            this.passwordFormOriginalValues = {
                newPassword: '',
                confirmPassword: ''
            };
            this.passwordFormHasChanges = false;
            
            // Form değişiklik kontrolü
            const newPasswordEl = document.getElementById('new-password');
            const confirmPasswordEl = document.getElementById('confirm-password');
            
            const checkPasswordFormChanges = () => {
                const newPassword = newPasswordEl ? newPasswordEl.value : '';
                const confirmPassword = confirmPasswordEl ? confirmPasswordEl.value : '';
                
                this.passwordFormHasChanges = 
                    newPassword !== this.passwordFormOriginalValues.newPassword ||
                    confirmPassword !== this.passwordFormOriginalValues.confirmPassword;
            };
            
            if (newPasswordEl) {
                newPasswordEl.addEventListener('input', checkPasswordFormChanges);
                newPasswordEl.addEventListener('change', checkPasswordFormChanges);
            }
            
            if (confirmPasswordEl) {
                confirmPasswordEl.addEventListener('input', checkPasswordFormChanges);
                confirmPasswordEl.addEventListener('change', checkPasswordFormChanges);
            }
        }
        
        // Update modal description with user name and surname
        if (user) {
            const passwordDesc = document.getElementById('password-modal-description');
            if (passwordDesc) {
                const fullName = ((user.name || '') + ' ' + (user.surname || '')).trim() || '-';
                passwordDesc.textContent = `${fullName} için yeni şifre belirleyin.`;
            }
        }
        
        if (modal) {
            modal.classList.add('active');
            // Modal açılırken html ve body overflow'u hemen engelle (yatay scroll çıkmasın)
            document.documentElement.classList.add('modal-open');
            document.body.classList.add('modal-open');
        }
    }
    
    closePasswordModal(force = false) {
        // Clear all input error tooltips
        if (typeof clearAllInputErrors === 'function') {
            clearAllInputErrors();
        }
        
        // Form değişiklik kontrolü
        if (!force && this.passwordFormHasChanges) {
            // Değişiklik var, kullanıcıya sor
            if (typeof createToastInteractive === 'function') {
                createToastInteractive({
                    message: 'Değişiklikleri kaydetmek istiyor musunuz?',
                    confirmText: 'Kaydet',
                    cancelText: 'Vazgeç',
                    onConfirm: async () => {
                        // Formu kaydet
                        await this.changePassword();
                    },
                    onCancel: () => {
                        // Değişiklikleri sıfırla ve kapat
                        const form = document.getElementById('password-form');
                        if (form) {
                            form.reset();
                        }
                        this.passwordFormHasChanges = false;
                        this.passwordFormOriginalValues = {
                            newPassword: '',
                            confirmPassword: ''
                        };
                        this.closePasswordModal(true);
                    }
                });
                return;
            }
        }
        
        // Değişiklik yok veya zorla kapat
        const modal = document.getElementById('modal-password-overlay');
        if (modal) {
            modal.classList.remove('active');
            // Modal kapandığında body overflow'u geri yükle
            // Eğer başka aktif modal yoksa
            const hasActiveModal = document.querySelector('.modal-overlay.active');
            if (!hasActiveModal) {
                document.documentElement.classList.remove('modal-open');
                document.body.classList.remove('modal-open');
            }
        }
        this.currentPasswordUserId = null;
        const form = document.getElementById('password-form');
        if (form) {
            form.reset();
        }
        const errorMsg = document.getElementById('password-match-error');
        if (errorMsg) {
            errorMsg.classList.remove('show');
        }
        
        // Form değişiklik takibini sıfırla
        this.passwordFormHasChanges = false;
        this.passwordFormOriginalValues = {
            newPassword: '',
            confirmPassword: ''
        };
    }
    
    togglePasswordVisibility(inputId, buttonId) {
        const input = document.getElementById(inputId);
        const button = document.getElementById(buttonId);
        if (!input || !button) return;
        
        const eyeIcon = button.querySelector('.eye-icon');
        const eyeOffIcon = button.querySelector('.eye-off-icon');
        
        if (input.type === 'password') {
            input.type = 'text';
            if (eyeIcon) {
                eyeIcon.classList.add('eye-icon-hidden');
                eyeIcon.classList.remove('eye-icon-visible');
            }
            if (eyeOffIcon) {
                eyeOffIcon.classList.remove('eye-off-icon-hidden');
                eyeOffIcon.classList.add('eye-off-icon-visible');
            }
        } else {
            input.type = 'password';
            if (eyeIcon) {
                eyeIcon.classList.remove('eye-icon-hidden');
                eyeIcon.classList.add('eye-icon-visible');
            }
            if (eyeOffIcon) {
                eyeOffIcon.classList.add('eye-off-icon-hidden');
                eyeOffIcon.classList.remove('eye-off-icon-visible');
            }
        }
    }
    
    async saveUser() {
        // btnSave'i önce tanımla (erken return'lerde kullanılabilir)
        const btnSave = document.getElementById('btn-save');
        
        const firstname = document.getElementById('user-firstname').value.trim();
        const lastname = document.getElementById('user-lastname').value.trim();
        const kullaniciadi = document.getElementById('user-kullaniciadi').value.trim();
        const email = document.getElementById('user-email').value.trim();
        const phoneEl = document.getElementById('user-phone');
        const phoneValue = phoneEl ? phoneEl.value.trim() : '';
        const password = document.getElementById('user-password').value;
        const role = document.getElementById('user-role').value;
        const isActive = document.getElementById('user-active').checked;
        // Admin yetkisi alanı kaldırıldı - artık kullanılmıyor
        // const isAdmin = document.getElementById('user-admin').checked;
        
        if (!firstname || !lastname || !kullaniciadi || !email) {
            if (typeof createToast === 'function') {
                createToast('warning', 'Lütfen tüm zorunlu alanları doldurunuz');
            }
            return;
        }
        
        // ✅ Telefon numarası kontrolü - Console panel'deki gibi required kontrolü ile
        let cleanPhone = null;
        // Telefon inputu varsa validation yap
        if (phoneEl && typeof validatePhoneInput === 'function') {
            // ✅ Required field kontrolü - Console panel'deki gibi
            if (!phoneValue || phoneValue === '+90 (' || phoneValue.trim() === '' || phoneValue === '+90') {
                // Required field boş - validation göster
                phoneEl.setCustomValidity('Telefon numarası gereklidir! +90 (XXX) XXX XX XX formatında yazınız.');
                phoneEl.reportValidity();
                phoneEl.focus();
                if (btnSave) {
                    btnSave.disabled = false;
                    btnSave.textContent = 'Kaydet';
                }
                return;
            }
            
            // Telefon numarası var ama format/eksik kontrolü
            const isValid = validatePhoneInput(phoneEl, false);
            if (!isValid) {
                // Validation başarısız - tooltip göster
                validatePhoneInput(phoneEl, true);
                phoneEl.focus();
                if (btnSave) {
                    btnSave.disabled = false;
                    btnSave.textContent = 'Kaydet';
                }
                return; // Validation başarısız, kaydetme
            } else {
                // Validation geçerli - custom validity'yi temizle
                phoneEl.setCustomValidity('');
            }
            
            // Telefon numarasını E.164 formatına çevir (+90XXXXXXXXXX)
            if (typeof toE164TR === 'function') {
                cleanPhone = toE164TR(phoneValue);
            } else {
                // Fallback: manuel normalize
                const digits = phoneValue.replace(/\D/g, '');
                if (digits.length === 12 && digits.startsWith('90')) {
                    cleanPhone = digits;
                } else if (digits.length === 10) {
                    cleanPhone = '90' + digits;
                } else if (digits.length === 11 && digits.startsWith('0')) {
                    cleanPhone = '90' + digits.substring(1);
                } else if (digits.length >= 10) {
                    // Son 10 haneyi al
                    const last10 = digits.substring(digits.length - 10);
                    if (last10.length === 10) {
                        cleanPhone = '90' + last10;
                    }
                }
            }
        }
                    
        // E-posta format kontrolü - form submit'te tooltip göster
        const emailInput = document.getElementById('user-email');
        if (!validateEmailInput(emailInput, false)) {
            if (emailInput) {
                emailInput.focus();
                emailInput.reportValidity(); // Form submit'te tooltip göster
            }
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.textContent = 'Kaydet';
            }
            return;
        }
        
        // Yeni kullanıcı için şifre zorunlu
        if (!this.currentEditingUser && !password) {
            if (typeof createToast === 'function') {
                createToast('warning', 'Lütfen şifre giriniz');
            }
            return;
        }
        
        // Backend'e name ve surname ayrı kolonlar olarak gönder
        const nameValue = firstname || null;
        const surnameValue = lastname || null;
        
        if (btnSave) {
            btnSave.disabled = true;
            btnSave.textContent = 'Kaydediliyor...';
        }
        
        try {
            const url = this.currentEditingUser
                ? `${this.apiBase}/admin/tenants/${this.tenantId}/users/${this.currentEditingUser.id}`
                : `${this.apiBase}/admin/tenants/${this.tenantId}/users`;
            
            const method = this.currentEditingUser ? 'PUT' : 'POST';
            
            const roleSelect = document.getElementById('user-role');
            const role = roleSelect ? roleSelect.value : null;
            
            // Status'u kontrol et - sadece değişiklik varsa gönder
            const currentStatus = isActive ? 'aktif' : 'pasif';
            // originalValues'u form elementinden al
            const form = document.getElementById('user-form');
            let originalStatus = 'aktif'; // Default
            if (form && form.dataset.originalValues) {
                try {
                    const originalValues = JSON.parse(form.dataset.originalValues);
                    originalStatus = originalValues.status || 'aktif';
                } catch (e) {
                    console.warn('⚠️ originalValues parse edilemedi:', e);
                }
            }
            
            const body = {
                name: nameValue,
                surname: surnameValue,
                kullaniciadi: kullaniciadi,
                username: kullaniciadi, // Backend için
                email: email,
                // Toggle butonu status kullanmalı, is_active değil
                // Sadece status değiştiyse gönder (yeni kullanıcı için her zaman gönder)
                ...(this.currentEditingUser ? (currentStatus !== originalStatus && { status: currentStatus }) : { status: currentStatus }),
                // is_active de gönder (yeni kullanıcı için her zaman, düzenlemede sadece değiştiyse)
                ...(this.currentEditingUser ? (currentStatus !== originalStatus && { is_active: isActive ? 1 : 0 }) : { is_active: isActive ? 1 : 0 }),
                // is_admin kolonu kaldırıldı - artık kullanılmıyor
                // is_admin: isAdmin ? 1 : 0,
                role: role || null
            };
            
            // Telefon numarasını ekle - her zaman gönder (değiştirilmişse)
            // Eğer telefon inputu "+90 (" veya boşsa, telefon numarasını null gönder (sil)
            if (cleanPhone) {
                body.phone = cleanPhone;
            } else {
                // Telefon numarası yok veya silinmiş - null gönder
                body.phone = null;
            }
            
            // Şifre sadece yeni kullanıcı veya değiştirilmişse ekle
            if (password) {
                body.password = password;
            }
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include', // Cookie'leri gönder
                body: JSON.stringify(body)
            });
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    this.logout();
                    return;
                }
                const errorData = await response.json();
                throw new Error(errorData.error || 'Kullanıcı kaydedilemedi');
            }
            
            const result = await response.json();
            if (result.success) {
                // Backend'den gelen güncellenmiş kullanıcı bilgilerini this.users array'ine ekle/güncelle
                if (result.data) {
                    const updatedUser = result.data;
                    if (this.currentEditingUser) {
                        // Güncelleme: mevcut kullanıcıyı bul ve güncelle
                        const index = this.users.findIndex(u => {
                            const uId = typeof u.id === 'string' ? parseInt(u.id) : u.id;
                            const userId = typeof updatedUser.id === 'string' ? parseInt(updatedUser.id) : updatedUser.id;
                            return uId === userId;
                        });
                        if (index !== -1) {
                            this.users[index] = updatedUser;
                        }
                    } else {
                        // Yeni ekleme: array'e ekle
                        this.users.push(updatedUser);
                    }
                }
                
                // Kullanıcı listesini yenile (tabloyu güncelle) - ÖNCE loadUsers çağrılmalı
                await this.loadUsers();
                
                if (typeof createToast === 'function') {
                    createToast('success', this.currentEditingUser ? 'Kullanıcı güncellendi' : 'Kullanıcı eklendi');
                }
                
                // Backend'den bildirim oluşturuldu mu kontrol et
                if (result.notificationCreated) {
                    // Badge'i anında güncelle
                    if (typeof this.updateNotificationBadge === 'function') {
                        await this.updateNotificationBadge();
                    }
                    
                    // Bildirim sayısını güncelle (BroadcastChannel) - diğer sayfalar için
                    if (this.notificationChannel) {
                        this.notificationChannel.postMessage({
                            type: 'notification-updated'
                        });
                    }
                }
                
                if (this.closeModalWithCheck) {
                    this.closeModalWithCheck(true); // force close after save
        } else {
                    this.closeModal();
                }
                
                // Aktivite loglarını yenile (log kaydı oluşturulduktan sonra)
                await this.loadActivityLogs();
            }
        } catch (error) {
            console.error('Kullanıcı kaydedilirken hata:', error);
            if (typeof createToast === 'function') {
                createToast('error', error.message || 'Kullanıcı kaydedilemedi');
            }
        } finally {
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.textContent = 'Kaydet';
            }
        }
    }
    
    async changePassword() {
        const password = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        if (!password || !confirmPassword) {
            if (typeof createToast === 'function') {
                createToast('warning', 'Lütfen şifre alanlarını doldurunuz');
            }
            return;
        }
        
        if (password !== confirmPassword) {
            if (typeof createToast === 'function') {
                createToast('warning', 'Şifreler eşleşmiyor');
            }
            return;
        }
        
        const btnSave = document.getElementById('btn-save-password');
        if (btnSave) {
            btnSave.disabled = true;
            btnSave.textContent = 'Kaydediliyor...';
        }
        
        try {
            const response = await fetch(`${this.apiBase}/admin/tenants/${this.tenantId}/users/${this.currentPasswordUserId}/password`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include', // Cookie'leri gönder
                body: JSON.stringify({
                    password: password
                })
            });
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    this.logout();
                    return;
                }
                const errorData = await response.json();
                throw new Error(errorData.error || 'Şifre değiştirilemedi');
            }
            
            const result = await response.json();
            if (result.success) {
                if (typeof createToast === 'function') {
                    createToast('success', 'Şifre değiştirildi');
                }
                // Form değişiklik takibini sıfırla ve modalı kapat
                this.passwordFormHasChanges = false;
                this.passwordFormOriginalValues = {
                    newPassword: '',
                    confirmPassword: ''
                };
                this.closePasswordModal(true);
            }
        } catch (error) {
            console.error('Şifre değiştirilirken hata:', error);
            if (typeof createToast === 'function') {
                createToast('error', error.message || 'Şifre değiştirilemedi');
            }
        } finally {
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.textContent = 'Kaydet';
            }
        }
    }
    
    async toggleUserStatus(userId, newStatus) {
        // NOT: Bu fonksiyon users tablosundaki "status" kolonunu günceller (aktif/pasif)
        // Sil butonu ile karıştırılmamalı - sil butonu is_active'i 0 yapar ve kullanıcı tablodan kaybolur
        // Bu buton ise status kolonunu günceller, kullanıcı tabloda kalır
        
        // Kullanıcıyı bul
        const user = this.users.find(u => u.id === userId);
        if (!user) {
            if (typeof createToast === 'function') {
                createToast('error', 'Kullanıcı bulunamadı');
            }
            return;
        }
        
        // Status değerini belirle (1 = aktif, 0 = pasif)
        const statusValue = newStatus === 1 ? 'aktif' : 'pasif';
        
        // Not: is_admin kolonu kaldırıldı, artık admin_users tablosunda yönetiliyor
        // Tenant kullanıcıları için superadmin kontrolü gerekli değil
        
        const statusText = statusValue;
        
        // Toast ile onay iste
        if (typeof createToastInteractive === 'function') {
            createToastInteractive({
                message: `Bu kullanıcıyı ${statusText} yapmak istediğinize emin misiniz?`,
                confirmText: statusText === 'aktif' ? 'Aktif Yap' : 'Pasif Yap',
                cancelText: 'İptal',
                onConfirm: async () => {
                    await this.performUserStatusToggle(userId, statusValue, statusText);
                },
                onCancel: () => {}
            });
            return;
        }
        
        // Fallback: eğer createToastInteractive yoksa confirm kullan
        if (!confirm(`Bu kullanıcıyı ${statusText} yapmak istediğinize emin misiniz?`)) {
            return;
        }
        
        await this.performUserStatusToggle(userId, statusValue, statusText);
    }
    
    async performUserStatusToggle(userId, statusValue, statusText) {
        try {
            const response = await fetch(`${this.apiBase}/admin/tenants/${this.tenantId}/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'X-User-ID': this.adminUserId,
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include', // Cookie'leri gönder
                body: JSON.stringify({
                    status: statusValue  // status kolonunu güncelle, is_active değil
                })
            });
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    this.logout();
                    return;
                }
                
                const errorData = await response.json();
                const errorMessage = errorData.error || 'Kullanıcı durumu değiştirilemedi';
                
                // 400 Bad Request - Superadmin kontrolü gibi beklenen hatalar için warning göster
                if (response.status === 400 && errorMessage.includes('Superadmin')) {
                    console.warn('⚠️', errorMessage);
                } else {
                }
                
                throw new Error(errorMessage);
            }
            
            const result = await response.json();
            if (result.success) {
                // Kullanıcı listesini yeniden yükle (status değiştiği için)
                await this.loadUsers();
                
                if (typeof createToast === 'function') {
                    createToast('success', `Kullanıcı ${statusText} yapıldı`);
                }
                
                // Backend'den bildirim oluşturuldu mu kontrol et
                if (result.notificationCreated) {
                    // Badge'i anında güncelle
                    if (typeof this.updateNotificationBadge === 'function') {
                        await this.updateNotificationBadge();
                    }
                    
                    // Bildirim sayısını güncelle (BroadcastChannel) - diğer sayfalar için
                    if (this.notificationChannel) {
                        this.notificationChannel.postMessage({
                            type: 'notification-updated'
                        });
                    }
                }
            }
        } catch (error) {
            // Superadmin kontrolü gibi beklenen hatalar için warning, diğerleri için error
            if (error.message && error.message.includes('Superadmin')) {
                console.warn('⚠️', error.message);
                if (typeof createToast === 'function') {
                    createToast('warning', error.message);
                }
            } else {
                if (typeof createToast === 'function') {
                    createToast('error', error.message || 'Kullanıcı durumu değiştirilemedi');
                }
            }
        }
    }
    
    showSuperadminWarning() {
            if (typeof createToast === 'function') {
            createToast('warning', 'Superadmin kullanıcılar pasif yapılamaz!');
        } else {
            if (typeof createToast === 'function') {
                createToast('error', 'Superadmin kullanıcılar pasif yapılamaz!');
            }
        }
    }
    
    validatePasswordMatch() {
        const password = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const errorMsg = document.getElementById('password-match-error');
        
        if (confirmPassword && password !== confirmPassword) {
            if (errorMsg) {
                errorMsg.classList.add('show');
            }
        } else {
            if (errorMsg) {
                errorMsg.classList.remove('show');
            }
        }
    }
    
    async saveSettings() {
        const name = document.getElementById('settings-name').value.trim();
        const email = document.getElementById('settings-email').value.trim();
        const phoneInput = document.getElementById('settings-phone');
        let phone = phoneInput ? phoneInput.value.trim() : '';
        
        // Telefon validation kontrolü
        if (phone && phone !== '+90 (' && phone.trim() !== '' && phone.trim() !== '+90') {
            if (phoneInput && typeof validatePhoneInput === 'function') {
                const isValid = validatePhoneInput(phoneInput, false);
                if (!isValid) {
                    // Validation başarısız - tooltip göster
                    if (phoneInput) {
                        phoneInput.focus();
                        phoneInput.reportValidity(); // Native tooltip'i göster
                    }
                    return;
                } else {
                    // Validation geçerli - custom validity'yi temizle
                    phoneInput.setCustomValidity('');
                    if (phoneInput.validity.customError) {
                        phoneInput.setCustomValidity('');
                    }
                }
            }
        }
        
        // Telefon numarasını E.164 formatına çevir (+90XXXXXXXXXX)
        if (phone && typeof toE164TR === 'function') {
            phone = toE164TR(phone);
        } else if (phone) {
            // Fallback: manuel normalize
            const digits = phone.replace(/\D/g, '');
            if (digits.length === 10) {
                phone = '+90' + digits;
            } else if (digits.length === 11 && digits.startsWith('0')) {
                phone = '+90' + digits.substring(1);
            } else if (digits.length >= 10) {
                phone = '+90' + digits.substring(digits.length - 10);
            } else {
                phone = null;
            }
        }
        const city = document.getElementById('settings-city')?.value || '';
        const state = document.getElementById('settings-state')?.value || '';
        
        if (!name || !email) {
            if (typeof createToast === 'function') {
                createToast('warning', 'Lütfen organizasyon adı ve e-posta alanlarını doldurunuz');
            }
            return;
        }
        
        // E-posta format kontrolü
        const emailInput = document.getElementById('settings-email');
        if (!validateEmailInput(emailInput, true)) {
            if (emailInput) {
                emailInput.focus();
            }
            return;
        }
        
        const btnSave = document.getElementById('btn-save-settings');
        if (btnSave) {
            btnSave.disabled = true;
            // Buton metni değişmeyecek
        }
        
        try {
            const response = await fetch(`${this.apiBase}/admin/tenants/${this.tenantId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    name: name,
                    email: email,
                    phone: phone,
                    city: city,
                    state: state
                })
            });
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    this.logout();
                    return;
                }
                const errorData = await response.json();
                throw new Error(errorData.error || 'Ayarlar kaydedilemedi');
            }
            
            const result = await response.json();
            if (result.success) {
                // tenants_no değerini koru (backend'den gelmeyebilir)
                const currentTenantsNo = this.tenant?.tenants_no;
                this.tenant = { ...this.tenant, ...result.data };
                if (currentTenantsNo && !this.tenant.tenants_no) {
                    this.tenant.tenants_no = currentTenantsNo;
                }
                
                // Tüm ilgili alanları güncelle
                this.renderTenantInfo();
                this.loadSettingsData();
                this.loadBillingData();
                
                // Cross-page update için broadcast et
                if (window.syncManager) {
                    window.syncManager.broadcast('TENANT_UPDATED', {
                        tenantId: this.tenantId,
                        tenantData: result.data
                    });
                }
                
                // Show success message
                const successMsg = document.getElementById('settings-success-message');
                if (successMsg) {
                    successMsg.style.display = 'flex';
                    setTimeout(() => {
                        successMsg.style.display = 'none';
                    }, 3000);
                }
                
                if (typeof createToast === 'function') {
                    createToast('success', 'Değişiklikler kaydedildi');
                }
            }
        } catch (error) {
            console.error('Ayarlar kaydedilirken hata:', error);
            if (typeof createToast === 'function') {
                createToast('error', error.message || 'Ayarlar kaydedilemedi');
            }
        } finally {
            if (btnSave) {
                btnSave.disabled = false;
                // Buton metni değişmeyecek
            }
        }
    }
    
    cancelSettings() {
        // Ayarları tenant verileriyle yeniden yükle
        this.loadSettingsData();
    }
    
    async showDeleteTenantDialog() {
        const tenantName = this.tenant?.name || 'Bu tenant';
        
        // Toast interactive kullan (sheet yerine)
        if (typeof createToastInteractive === 'function') {
            createToastInteractive({
                title: "Tenant'ı Sil",
                message: `"${tenantName}" tenant'ı silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve tüm kullanıcılar erişimini kaybedecek.`,
                confirmText: 'Sil',
                cancelText: 'İptal',
                isWarning: true,
                confirmButtonClass: 'toast-btn-red',
                onConfirm: async () => {
                    await this.deleteTenant();
                },
                onCancel: () => {}
            });
            return;
        }
        
        // Fallback: eğer createToastInteractive yoksa confirm kullan
        if (!confirm(`"${tenantName}" tenant'ı silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve tüm kullanıcılar erişimini kaybedecek.`)) {
            return;
        }
        await this.deleteTenant();
    }
    
    async deleteTenant() {
        if (!this.tenantId) {
            if (typeof createToast === 'function') {
                createToast('error', 'Tenant ID bulunamadı');
            }
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/admin/tenants/${this.tenantId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    is_active: 0
                })
            });
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    this.logout();
                    return;
                }
                const errorData = await response.json();
                throw new Error(errorData.error || 'Tenant silinemedi');
            }
            
            const result = await response.json();
            if (result.success) {
                if (typeof createToast === 'function') {
                    createToast('success', 'Tenant başarıyla silindi!');
                }
                
                // Cross-page update için broadcast et
                if (window.syncManager) {
                    window.syncManager.broadcast('TENANT_STATUS_CHANGED', {
                        tenantId: this.tenantId,
                        isActive: 0
                    });
                }
                
                // Badge'i anında güncelle (önce direkt güncelle)
                if (typeof this.updateNotificationBadge === 'function') {
                    await this.updateNotificationBadge();
                }
                
                // Bildirim sayısını güncelle (BroadcastChannel) - diğer sayfalar için
                if (this.notificationChannel) {
                    this.notificationChannel.postMessage({
                        type: 'notification-updated'
                    });
                }
                
                // Console sayfasına yönlendir
                setTimeout(() => {
                    window.location.href = '/console';
                }, 1500);
            } else {
                throw new Error(result.error || 'Tenant silinemedi');
            }
        } catch (error) {
            console.error('Tenant silinirken hata:', error);
            if (typeof createToast === 'function') {
                createToast('error', error.message || 'Tenant silinemedi');
            }
        }
    }
    
    async loadActivityLogs(showToast = false) {
        const btnRefreshLogs = document.getElementById('btn-refresh-logs');
        const originalContent = btnRefreshLogs?.innerHTML;
        
        try {
            // Buton durumunu güncelle (loading state)
            if (btnRefreshLogs) {
                btnRefreshLogs.disabled = true;
                btnRefreshLogs.style.opacity = '0.6';
                btnRefreshLogs.style.cursor = 'wait';
            }
            
            const response = await fetch(`${this.apiBase}/admin/tenants/${this.tenantId}/logs?limit=100&t=${Date.now()}`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                },
                credentials: 'include',
                cache: 'no-store'
            });
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    console.error('❌ Yetkilendirme hatası');
                    this.logout();
                    return;
                }
                const errorText = await response.text();
                console.error('❌ Aktivite logları yükleme hatası:', errorText);
                throw new Error('Aktivite logları yüklenemedi');
            }
            
            const result = await response.json();
            
            if (result.success) {
                // Backend'den gelen veriyi frontend formatına dönüştür
                this.activityLogs = (result.data || []).map(log => {
                    // created_at'i time formatına çevir
                    let time = '';
                    if (log.created_at) {
                        try {
                            const date = new Date(log.created_at);
                            const now = new Date();
                            const diffMs = now - date;
                            const diffMins = Math.floor(diffMs / 60000);
                            const diffHours = Math.floor(diffMs / 3600000);
                            const diffDays = Math.floor(diffMs / 86400000);
                            
                            if (diffMins < 1) {
                                time = 'Az önce';
                            } else if (diffMins < 60) {
                                time = `${diffMins} dakika önce`;
                            } else if (diffHours < 24) {
                                time = `${diffHours} saat önce`;
                            } else if (diffDays < 7) {
                                time = `${diffDays} gün önce`;
                            } else {
                                time = date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                            }
                        } catch (e) {
                            time = log.created_at;
                        }
                    }
                    
                    return {
                        id: log.id,
                        user: log.user_name || 'Sistem', // user_name -> user
                        action: log.action || '',
                        type: log.target_type || 'genel', // target_type -> type
                        target: log.target_name || null, // target_name -> target
                        time: time,
                        created_at: log.created_at
                    };
                });
                this.renderActivityLogs();
                
                // Başarı toast'ı göster (sadece showToast true ise)
                if (showToast && typeof createToast === 'function') {
                    createToast('success', 'Aktivite kayıtları yenilendi');
                }
            } else {
                throw new Error(result.error || 'Aktivite logları yüklenemedi');
            }
        } catch (error) {
            console.error('❌ Aktivite logları yüklenirken hata:', error);
            // Hata durumunda boş liste göster
            this.activityLogs = [];
            this.renderActivityLogs();
            
            // Hata toast'ı göster (sadece showToast true ise)
            if (showToast && typeof createToast === 'function') {
                createToast('error', 'Aktivite kayıtları yüklenirken bir hata oluştu');
            }
        } finally {
            // Buton durumunu geri yükle
            if (btnRefreshLogs) {
                btnRefreshLogs.disabled = false;
                btnRefreshLogs.style.opacity = '1';
                btnRefreshLogs.style.cursor = 'pointer';
                if (originalContent) {
                    btnRefreshLogs.innerHTML = originalContent;
                }
            }
        }
    }
    
    renderActivityLogs() {
        const logsList = document.getElementById('activity-logs-list');
        if (!logsList) {
            console.warn('⚠️ activity-logs-list elementi bulunamadı!');
            return;
        }
        
        const filteredLogs = this.activityFilter === 'all'
            ? this.activityLogs 
            : this.activityLogs.filter(log => log.type === this.activityFilter);
        
        if (filteredLogs.length === 0) {
            logsList.innerHTML = `
                <div class="admin-tenant-empty-state">
                    <div class="admin-tenant-empty-state-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"></path><path d="m19 9-5 5-4-4-3 3"></path></svg>
                    </div>
                    <p class="admin-tenant-empty-state-text">Bu kategoride kayıt bulunamadı.</p>
                </div>
            `;
            return;
        }
        
        const getActivityIcon = (type) => {
            const icons = {
                user: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
                system: '<circle cx="12" cy="12" r="3"></circle><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>',
                file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline>',
                security: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>',
                billing: '<rect width="20" height="14" x="2" y="5" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line>',
                auth: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>',
                settings: '<circle cx="12" cy="12" r="3"></circle><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>'
            };
            return icons[type] || '<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>';
        };
        
        const getActivityTypeLabel = (type) => {
            const labels = {
                // Backend'den gelen target_type değerleri
                siparis: 'Sipariş İşlemleri',
                musteri: 'Müşteri İşlemleri',
                urun: 'Ürün İşlemleri',
                fatura: 'Fatura İşlemleri',
                file: 'Dosya İşlemleri',
                kullanici: 'Kullanıcı İşlemleri',
                user: 'Kullanıcı İşlemleri',
                genel: 'Genel İşlemler',
                // Diğer tipler
                system: 'Sistem',
                security: 'Güvenlik',
                billing: 'Ödeme',
                auth: 'Oturum',
                settings: 'Ayarlar'
            };
            // Eğer type null veya undefined ise "Genel İşlemler" döndür
            if (!type) return 'Genel İşlemler';
            // Type'ı küçük harfe çevir ve label'ı bul
            return labels[type.toLowerCase()] || type;
        };
        
        logsList.innerHTML = filteredLogs.map(log => `
            <div class="admin-tenant-activity-log-item">
                <div class="admin-tenant-activity-icon type-${log.type}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${getActivityIcon(log.type)}</svg>
                </div>
                <div class="admin-tenant-activity-content">
                    <div class="admin-tenant-activity-text">
                        <span class="admin-tenant-activity-user">${log.user}</span>
                        <span class="admin-tenant-activity-action">${log.action}</span>
                        ${log.target ? `<span class="admin-tenant-activity-target">${log.target}</span>` : ''}
                    </div>
                    <div class="admin-tenant-activity-time">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        ${log.time}
                    </div>
                </div>
                <span class="admin-tenant-activity-badge">${getActivityTypeLabel(log.type)}</span>
            </div>
        `).join('');
    }
    
    exportActivityLogs() {
        try {
            // Filtrelenmiş logları al
            const filteredLogs = this.activityFilter === 'all' 
                ? this.activityLogs 
                : this.activityLogs.filter(log => log.type === this.activityFilter);
            
            if (!filteredLogs || filteredLogs.length === 0) {
                if (typeof createToast === 'function') {
                    createToast('warning', 'Dışa aktarılacak aktivite kaydı bulunamadı');
                }
                return;
            }
            
            // Type label fonksiyonu
            const getActivityTypeLabel = (type) => {
                const labels = {
                    siparis: 'Sipariş İşlemleri',
                    musteri: 'Müşteri İşlemleri',
                    urun: 'Ürün İşlemleri',
                    fatura: 'Fatura İşlemleri',
                    file: 'Dosya İşlemleri',
                    kullanici: 'Kullanıcı İşlemleri',
                    user: 'Kullanıcı İşlemleri',
                    genel: 'Genel İşlemler',
                    system: 'Sistem',
                    security: 'Güvenlik',
                    billing: 'Ödeme',
                    auth: 'Oturum',
                    settings: 'Ayarlar'
                };
                if (!type) return 'Genel İşlemler';
                return labels[type.toLowerCase()] || type;
            };
            
            // HTML tablosu oluştur
            const table = document.createElement('table');
            table.setAttribute('data-title', 'Aktivite Kayıtları');
            table.style.borderCollapse = 'collapse';
            table.style.width = '100%';
            
            // Tablo başlığı
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const headers = ['Kullanıcı', 'İşlem', 'Hedef', 'Tür', 'Tarih/Saat'];
            headers.forEach(headerText => {
                const th = document.createElement('th');
                th.textContent = headerText;
                th.style.border = '1px solid #ddd';
                th.style.padding = '8px';
                th.style.backgroundColor = '#f8fafc';
                th.style.fontWeight = '600';
                th.style.textAlign = 'left';
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);
            
            // Tablo gövdesi
            const tbody = document.createElement('tbody');
            filteredLogs.forEach(log => {
                const row = document.createElement('tr');
                
                // Kullanıcı
                const cellUser = document.createElement('td');
                cellUser.textContent = log.user || '-';
                cellUser.style.border = '1px solid #ddd';
                cellUser.style.padding = '8px';
                row.appendChild(cellUser);
                
                // İşlem
                const cellAction = document.createElement('td');
                cellAction.textContent = log.action || '-';
                cellAction.style.border = '1px solid #ddd';
                cellAction.style.padding = '8px';
                row.appendChild(cellAction);
                
                // Hedef
                const cellTarget = document.createElement('td');
                cellTarget.textContent = log.target || '-';
                cellTarget.style.border = '1px solid #ddd';
                cellTarget.style.padding = '8px';
                row.appendChild(cellTarget);
                
                // Tür
                const cellType = document.createElement('td');
                cellType.textContent = getActivityTypeLabel(log.type);
                cellType.style.border = '1px solid #ddd';
                cellType.style.padding = '8px';
                row.appendChild(cellType);
                
                // Tarih/Saat
                const cellTime = document.createElement('td');
                cellTime.textContent = log.time || '-';
                cellTime.style.border = '1px solid #ddd';
                cellTime.style.padding = '8px';
                row.appendChild(cellTime);
                
                tbody.appendChild(row);
            });
            table.appendChild(tbody);
            
            // Excel export - defaultExcelHandler kullan
            if (typeof defaultExcelHandler === 'function') {
                defaultExcelHandler(table);
                if (typeof createToast === 'function') {
                    createToast('success', 'Aktivite kayıtları Excel formatında indirildi');
                }
            } else {
                // Fallback: Basit Excel export
                const tableTitle = 'Aktivite Kayıtları';
                const fileName = `${tableTitle} - ${new Date().toLocaleDateString('tr-TR')}.xls`;
                
                const blob = new Blob(['\ufeff' + table.outerHTML], {
                    type: 'application/vnd.ms-excel'
                });
                
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = fileName;
                a.click();
                
                if (typeof createToast === 'function') {
                    createToast('success', 'Aktivite kayıtları Excel formatında indirildi');
                }
            }
        } catch (error) {
            console.error('❌ Aktivite kayıtları dışa aktarma hatası:', error);
            if (typeof createToast === 'function') {
                createToast('error', 'Aktivite kayıtları dışa aktarılırken bir hata oluştu');
            }
        }
    }
    
    async loadBillingData() {
        try {
            // Abonelik bilgilerini yükle
            await this.loadAbonelikData();
            
            // Kullanım bilgilerini yükle
            await this.loadKullanimData();
            
            // Ödeme yöntemlerini yükle
            await this.loadOdemeYontemleri();
            
            // Faturaları yükle
            await this.loadFaturalar();
            
            // UI'ı güncelle
            this.renderBillingTab();
        } catch (error) {
            console.error('❌ Billing verileri yüklenirken hata:', error);
        }
    }
    
    async loadAbonelikData() {
        try {
            const response = await fetch(`${this.apiBase}/admin/tenants/${this.tenantId}/abonelik?t=${Date.now()}`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                },
                credentials: 'include',
                cache: 'no-store'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.data) {
                this.abonelik = result.data.abonelik;
                this.kullanim = result.data.kullanim;
                
                // Eğer max_kullanici yoksa uyarı ver
                if (!this.abonelik?.max_kullanici) {
                    /*
                    console.error('❌ max_kullanici veritabanından gelmedi!', {
                        abonelik: this.abonelik,
                        planId: this.abonelik?.plan_id
                    });
                    */
                }
            } else {
                this.abonelik = null;
                this.kullanim = null;
            }
        } catch (error) {
            console.error('❌ Abonelik verileri yüklenirken hata:', error);
            this.abonelik = null;
            this.kullanim = null;
        }
    }
    
    async loadKullanimData() {
        try {
            const response = await fetch(`${this.apiBase}/admin/tenants/${this.tenantId}/kullanim?t=${Date.now()}`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                },
                credentials: 'include',
                cache: 'no-store'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.data) {
                this.kullanim = result.data;
            } else {
                this.kullanim = null;
            }
        } catch (error) {
            console.error('❌ Kullanım verileri yüklenirken hata:', error);
            this.kullanim = null;
        }
    }
    
    async loadOdemeYontemleri() {
        try {
            const response = await fetch(`${this.apiBase}/admin/tenants/${this.tenantId}/odeme-yontemleri?t=${Date.now()}`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                },
                credentials: 'include',
                cache: 'no-store'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.data) {
                this.odemeYontemleri = result.data || [];
            } else {
                console.warn('⚠️ Ödeme yöntemi bulunamadı:', result);
                this.odemeYontemleri = [];
            }
        } catch (error) {
            console.error('❌ Ödeme yöntemleri yüklenirken hata:', error);
            this.odemeYontemleri = [];
        }
    }
    
    async loadFaturalar() {
        try {
            // Limit'i artırdık - tüm faturaları göster (landing dashboard gibi)
            const response = await fetch(`${this.apiBase}/admin/tenants/${this.tenantId}/faturalar?limit=1000&t=${Date.now()}`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                },
                credentials: 'include',
                cache: 'no-store'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.data) {
                this.invoices = result.data || [];
            } else {
                this.invoices = [];
            }
        } catch (error) {
            console.error('❌ Faturalar yüklenirken hata:', error);
            this.invoices = [];
        }
    }
    
    renderBillingTab() {
        // Billing sekmesini bul
        const billingTab = document.getElementById('tab-content-billing');
        const isBillingActive = billingTab && billingTab.classList.contains('active');
        
        // Sekme aktif değilse bile render et (veriler hazır olduğunda)
        // Çünkü kullanıcı sekme değiştirdiğinde veriler hazır olmalı
        // Ama sekme aktif değilse, elementler bulunamayabilir, o yüzden dikkatli ol
        
        // Aktif abonelik kontrolü
        const hasActiveSubscription = this.abonelik && this.abonelik.plan_adi && this.abonelik.durum === 'aktif';
        
        // Kullanıcı sayısı ve progress bar - VERİTABANINDAN
        // Kullanıcı sayısını users tablosundan dinamik olarak al - SADECE AKTİF KULLANICILAR (is_active = 1)
        const activeUsersCount = this.users?.filter(user => user.is_active === 1 || user.is_active === true).length || 0;
        const usersCountEl = document.getElementById('billing-users-count');
        const usersLimitEl = document.getElementById('billing-users-limit');
        const usersProgressEl = document.getElementById('billing-users-progress');
        
        // max_kullanici artık JOIN ile plan tablosundan geliyor
        const maxUsers = this.abonelik?.max_kullanici || 0;
        
        if (usersCountEl) {
            usersCountEl.textContent = activeUsersCount;
        }
        
        if (usersLimitEl) {
            if (hasActiveSubscription) {
                usersLimitEl.textContent = maxUsers || '-';
            } else {
                usersLimitEl.innerHTML = '<span class="admin-tenant-empty-value">Plan seçimi sonrası güncellenecektir</span>';
            }
        }
        
        if (usersProgressEl) {
            const progress = maxUsers > 0 ? (activeUsersCount / maxUsers) * 100 : 0;
            usersProgressEl.style.width = `${Math.min(progress, 100)}%`;
        }
        
        // Veriler yoksa default değerler zaten gösteriliyor
        
        // Depolama bilgileri - VERİTABANINDAN
        const storageUsedEl = document.getElementById('billing-storage-used');
        const storageLimitEl = document.getElementById('billing-storage-limit');
        const storageProgressEl = document.getElementById('billing-storage-progress');
        
        if (this.kullanim && this.kullanim.kullanilan_depolama_byte !== undefined && this.kullanim.depolama_limit_byte !== undefined) {
            // Byte'ları önce MB'ye çevir
            const storageUsedMB = this.kullanim.kullanilan_depolama_byte / (1024 * 1024);
            const storageLimitMB = this.kullanim.depolama_limit_byte / (1024 * 1024);
            
            // Kullanılan değer için: 1000 MB'den küçükse MB, büyükse GB göster
            let storageUsedDisplay, storageUsedUnit;
            if (storageUsedMB < 1024) {
                storageUsedDisplay = Math.round(storageUsedMB);
                storageUsedUnit = 'MB';
            } else {
                const storageUsedGB = storageUsedMB / 1024;
                if (storageUsedGB >= 1000) {
                    storageUsedDisplay = Math.round((storageUsedGB / 1024) * 10) / 10;
                    storageUsedUnit = 'TB';
                } else {
                    storageUsedDisplay = Math.round(storageUsedGB * 10) / 10;
                    storageUsedUnit = 'GB';
                }
            }
            
            // Limit için: 1000 MB'den küçükse MB, büyükse GB, 1000 GB'den büyükse TB göster
            let storageLimitDisplay, storageLimitUnit;
            if (storageLimitMB < 1024) {
                storageLimitDisplay = Math.round(storageLimitMB);
                storageLimitUnit = 'MB';
            } else {
                const storageLimitGB = storageLimitMB / 1024;
                if (storageLimitGB >= 1000) {
                    storageLimitDisplay = Math.round((storageLimitGB / 1024) * 10) / 10;
                    storageLimitUnit = 'TB';
                } else {
                    storageLimitDisplay = Math.round(storageLimitGB * 10) / 10;
                    storageLimitUnit = 'GB';
                }
            }
            
            // Progress hesaplama için MB cinsinden değerleri kullan
            const storageProgress = storageLimitMB > 0 ? (storageUsedMB / storageLimitMB) * 100 : 0;
            const isStorageExceeded = storageProgress > 100;
            
            if (storageUsedEl) {
                storageUsedEl.textContent = storageUsedDisplay;
                // Limit aşıldıysa kırmızı yap
                if (isStorageExceeded) {
                    storageUsedEl.classList.add('storage-exceeded');
                    storageUsedEl.classList.remove('storage-normal');
                } else {
                    storageUsedEl.classList.remove('storage-exceeded');
                    storageUsedEl.classList.add('storage-normal');
                }
            }
            
            if (storageLimitEl) {
                if (hasActiveSubscription) {
                    storageLimitEl.textContent = storageLimitDisplay;
                    // Limit aşıldıysa kırmızı yap
                    if (isStorageExceeded) {
                        storageLimitEl.classList.add('storage-exceeded');
                        storageLimitEl.classList.remove('storage-normal');
                    } else {
                        storageLimitEl.classList.remove('storage-exceeded');
                        storageLimitEl.classList.add('storage-normal');
                    }
                } else {
                    storageLimitEl.innerHTML = '<span class="admin-tenant-empty-value">Plan seçimi sonrası güncellenecektir</span>';
                }
            }
            
            // Unit'leri güncelle
            const storageUsedUnitEl = document.getElementById('billing-storage-used-unit');
            const storageLimitUnitEl = document.getElementById('billing-storage-limit-unit');
            
            if (storageUsedUnitEl) {
                storageUsedUnitEl.textContent = ` ${storageUsedUnit}`;
                // Limit aşıldıysa kırmızı yap
                if (isStorageExceeded) {
                    storageUsedUnitEl.classList.add('storage-exceeded');
                    storageUsedUnitEl.classList.remove('storage-normal');
                } else {
                    storageUsedUnitEl.classList.remove('storage-exceeded');
                    storageUsedUnitEl.classList.add('storage-normal');
                }
            }
            
            if (storageLimitUnitEl) {
                // Plan yoksa unit'i gösterme
                if (hasActiveSubscription) {
                    storageLimitUnitEl.textContent = ` ${storageLimitUnit}`;
                    // Limit aşıldıysa kırmızı yap
                    if (isStorageExceeded) {
                        storageLimitUnitEl.classList.add('storage-exceeded');
                        storageLimitUnitEl.classList.remove('storage-normal');
                    } else {
                        storageLimitUnitEl.classList.remove('storage-exceeded');
                        storageLimitUnitEl.classList.add('storage-normal');
                    }
                } else {
                    storageLimitUnitEl.textContent = '';
                }
            }
            
            if (storageProgressEl) {
                storageProgressEl.style.width = `${Math.min(storageProgress, 100)}%`;
                // Limit aşıldıysa progress bar'ı kırmızı yap
                if (isStorageExceeded) {
                    storageProgressEl.style.backgroundColor = '#ef4444';
                } else {
                    storageProgressEl.style.backgroundColor = '';
                }
            }
            
            // Limit aşımı uyarısı ve "Planı Yükselt" butonu ekle/kaldır
            const storageStatContainer = storageProgressEl?.parentElement?.parentElement;
            if (storageStatContainer) {
                // Mevcut uyarı mesajını kaldır
                const existingWarning = storageStatContainer.querySelector('.admin-tenant-storage-warning');
                if (existingWarning) {
                    existingWarning.remove();
                }
                
                // Limit aşıldıysa uyarı mesajı ve buton ekle
                if (isStorageExceeded) {
                    const warningDiv = document.createElement('div');
                    warningDiv.className = 'admin-tenant-storage-warning';
                    warningDiv.innerHTML = `
                        <div class="admin-tenant-storage-warning-container">
                            <svg class="admin-tenant-storage-warning-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                                <path d="M12 9v4"></path>
                                <path d="M12 17h.01"></path>
                            </svg>
                            <div class="admin-tenant-storage-warning-content">
                                <p class="admin-tenant-storage-warning-title">
                                    Depolama limiti aşıldı
                                </p>
                                <p class="admin-tenant-storage-warning-text">
                                    Mevcut kullanım, plan limitini aştı. Yeni dosya yüklenemez. Lütfen planı yükseltin.
                                </p>
                                <button type="button" class="admin-tenant-upgrade-plan-btn">
                                    Planı Değiştir
                                </button>
                            </div>
                        </div>
                    `;
                    storageStatContainer.appendChild(warningDiv);
                    
                    // "Planı Yükselt" butonuna event listener ekle (event delegation kullan)
                    const upgradeBtn = warningDiv.querySelector('.admin-tenant-upgrade-plan-btn');
                    if (upgradeBtn) {
                        // Önceki event listener'ları temizle (clone ile)
                        const newBtn = upgradeBtn.cloneNode(true);
                        upgradeBtn.parentNode.replaceChild(newBtn, upgradeBtn);
                        
                        // Event listener ekle
                        newBtn.addEventListener('click', async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            // Plan yükseltme modalını aç
                            try {
                                if (this.sheets.upgradePlan) {
                                    // Sheet zaten varsa aç
                                    if (!this.sheets.upgradePlan.parentNode) {
                                        document.body.appendChild(this.sheets.upgradePlan);
                                    }
                                    this.sheets.upgradePlan.update(true);
                                } else {
                                    // Upgrade plan sheet'i oluştur
                                    await this.createUpgradePlanSheet();
                                    if (this.sheets.upgradePlan) {
                                        if (!this.sheets.upgradePlan.parentNode) {
                                            document.body.appendChild(this.sheets.upgradePlan);
                                        }
                                        this.sheets.upgradePlan.update(true);
                                    }
                                }
                            } catch (error) {
                                console.error('❌ Plan yükseltme modalı açılırken hata:', error);
                                if (typeof createToast === 'function') {
                                    createToast('error', 'Plan yükseltme modalı açılamadı');
                                }
                            }
                        });
                    }
                }
            }
        } else {
            // Veriler yoksa default değerler göster
            if (storageUsedEl) {
                storageUsedEl.textContent = '0';
            }
            if (storageLimitEl) {
                if (hasActiveSubscription) {
                    storageLimitEl.textContent = '0';
                } else {
                    storageLimitEl.innerHTML = '<span class="admin-tenant-empty-value">Plan seçimi sonrası güncellenecektir</span>';
                }
            }
            // Unit'i de gizle plan yoksa
            const storageLimitUnitElDefault = document.getElementById('billing-storage-limit-unit');
            if (storageLimitUnitElDefault) {
                if (hasActiveSubscription) {
                    storageLimitUnitElDefault.textContent = ' MB';
                } else {
                    storageLimitUnitElDefault.textContent = '';
                }
            }
            if (storageProgressEl) {
                storageProgressEl.style.width = '0%';
            }
        }
        
        // Sonraki ödeme tarihi - VERİTABANINDAN
        const nextPaymentDateEl = document.getElementById('billing-next-payment-date');
        const nextPaymentDaysEl = document.getElementById('billing-next-payment-days');
        
        if (this.abonelik && this.abonelik.sonraki_odeme_tarihi) {
            if (nextPaymentDateEl) {
                const date = new Date(this.abonelik.sonraki_odeme_tarihi);
                const formattedDate = date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                nextPaymentDateEl.textContent = formattedDate;
            }
            
            if (nextPaymentDaysEl) {
                const daysLeft = Math.ceil((new Date(this.abonelik.sonraki_odeme_tarihi) - new Date()) / (1000 * 60 * 60 * 24));
                nextPaymentDaysEl.textContent = `${daysLeft} gün kaldı`;
            }
        } else {
            if (nextPaymentDateEl) {
                if (hasActiveSubscription) {
                    nextPaymentDateEl.textContent = '-';
                } else {
                    nextPaymentDateEl.innerHTML = '<span class="admin-tenant-empty-value">Plan seçimi sonrası güncellenecektir</span>';
                }
            }
            if (nextPaymentDaysEl) {
                if (hasActiveSubscription) {
                    nextPaymentDaysEl.textContent = '-';
                } else {
                    nextPaymentDaysEl.innerHTML = '<span class="admin-tenant-empty-value">Plan seçimi sonrası güncellenecektir</span>';
                }
            }
        }
        
        // Plan adı - Yeni ID'lerle
        if (hasActiveSubscription) {
            // Plan badge - header'daki badge (Mevcut Abonelik kartındaki)
            const planBadge = document.getElementById('plan-badge-display');
            if (planBadge) {
                // Shield ikonu ile plan adını göster
                planBadge.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.94a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.5 6.24-3.34a1.5 1.5 0 0 1 1.52 0C14.5 3.5 17 5 19 5a1 1 0 0 1 1 1z"></path></svg>
                    ${this.abonelik.plan_adi}
                `;
            }
            
            // Plan name - plan detaylarındaki isim
            const planName = document.getElementById('plan-name-display');
            if (planName) {
                planName.textContent = this.abonelik.plan_adi;
                
                // Billing period bilgisini ekle (aylık/yıllık)
                const billingPeriod = this.abonelik.fatura_dongusu || 'aylik';
                const billingPeriodText = billingPeriod === 'yillik' ? 'Yıllık' : 'Aylık';
                
                // Eğer element yoksa oluştur
                let billingPeriodEl = document.getElementById('plan-billing-period-display');
                if (!billingPeriodEl) {
                    billingPeriodEl = document.createElement('div');
                    billingPeriodEl.id = 'plan-billing-period-display';
                    billingPeriodEl.className = 'admin-tenant-plan-billing-period';
                    planName.parentNode.insertBefore(billingPeriodEl, planName.nextSibling);
                }
                
                // plan-billing-period-display'i göster
                billingPeriodEl.style.display = '';
                
                // Plan detayları bilgilerini topla - async olarak plan bilgisini yükle
                this.loadPlanDetailsForBilling(billingPeriodEl, billingPeriod, billingPeriodText).catch(err => {
                    console.error('❌ Plan detayları yüklenirken hata:', err);
                });
            }
            
            // Tenant info meta'daki plan adı (üst kısımdaki)
            const tenantPlanNameEl = document.getElementById('tenant-plan-name');
            if (tenantPlanNameEl) {
                tenantPlanNameEl.textContent = this.abonelik.plan_adi;
            }
            
            // Abonelik varsa admin-tenant-no-subscription-message'ı kaldır
            const planDetailsContainer = document.querySelector('.admin-tenant-plan-details');
            if (planDetailsContainer) {
                const existingMessage = planDetailsContainer.querySelector('.admin-tenant-no-subscription-message');
                if (existingMessage) {
                    existingMessage.remove();
                }
            }
            
            // Plan özellikleri - ozellikler kolonundan
            const planFeaturesEl = document.getElementById('plan-features-display');
            if (planFeaturesEl) {
                try {
                    let ozelliklerArray = [];
                    
                    // ozellikler verisini al
                    if (this.abonelik && this.abonelik.ozellikler) {
                        let ozellikler = this.abonelik.ozellikler;
                        
                        // Eğer string ise, JSON veya virgülle ayrılmış string olabilir
                        if (typeof ozellikler === 'string') {
                            const trimmed = ozellikler.trim();
                            
                            if (trimmed.length === 0) {
                                ozelliklerArray = [];
                            } else if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                                // JSON formatı
                                try {
                                    const parsed = JSON.parse(trimmed);
                                    if (Array.isArray(parsed)) {
                                        ozelliklerArray = parsed;
                                    } else if (typeof parsed === 'object' && parsed !== null) {
                                        // Object ise key'leri array'e çevir
                                        ozelliklerArray = Object.keys(parsed).filter(key => parsed[key] === true || parsed[key] === 'true');
                                    }
                                } catch (e) {
                                    console.warn('⚠️ Özellikler JSON parse edilemedi:', e);
                                    ozelliklerArray = [];
                                }
                            } else {
                                // Virgülle ayrılmış string
                                ozelliklerArray = trimmed.split(',').map(s => s.trim()).filter(s => s.length > 0);
                            }
                        } else if (Array.isArray(ozellikler)) {
                            ozelliklerArray = ozellikler;
                        } else if (typeof ozellikler === 'object' && ozellikler !== null) {
                            // Object ise key'leri array'e çevir
                            ozelliklerArray = Object.keys(ozellikler).filter(key => ozellikler[key] === true || ozellikler[key] === 'true');
                        }
                        
                        // ozellikler array ise ve boş değilse göster
                        if (ozelliklerArray.length > 0) {
                            planFeaturesEl.innerHTML = ozelliklerArray.map(ozellik => {
                                // XSS koruması için HTML escape
                                const escapedOzellik = ozellik.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
                                return `
                                    <div class="admin-tenant-plan-feature-item">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="admin-tenant-plan-feature-icon">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                        <span>${escapedOzellik}</span>
                                    </div>
                                `;
                            }).join('');
                        } else {
                            planFeaturesEl.innerHTML = '<div class="admin-tenant-plan-feature-item"><span>Özellik bilgisi bulunmuyor.</span></div>';
                        }
                    } else {
                        planFeaturesEl.innerHTML = '<div class="admin-tenant-plan-feature-item"><span>Özellik bilgisi bulunmuyor.</span></div>';
                    }
                } catch (error) {
                    console.error('❌ Plan özellikleri yüklenirken hata:', error);
                    planFeaturesEl.innerHTML = '<div class="admin-tenant-plan-feature-item"><span>Özellik bilgisi yüklenemedi.</span></div>';
                }
            }
        } else {
            // Abonelik yoksa "Abonelik planı yok" göster (ikon ile)
            // Plan badge - header'daki badge (Mevcut Abonelik kartındaki)
            const planBadge = document.getElementById('plan-badge-display');
            if (planBadge) {
                planBadge.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="admin-tenant-no-subscription-icon"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    Abonelik planı yok
                `;
                planBadge.classList.add('admin-tenant-no-subscription-badge');
            }
            
            // Plan name - plan detaylarındaki isim
            const planName = document.getElementById('plan-name-display');
            if (planName) {
                planName.textContent = 'Abonelik planı yok';
            }
            
            // plan-billing-period-display'i gizle (plan iptal edildiğinde)
            const billingPeriodEl = document.getElementById('plan-billing-period-display');
            if (billingPeriodEl) {
                billingPeriodEl.style.display = 'none';
            }
            
            // Plan özellikleri alanını temizle (CSS ile gizlenecek)
            const planFeaturesEl = document.getElementById('plan-features-display');
            if (planFeaturesEl) {
                planFeaturesEl.innerHTML = '';
            }
            
            // admin-tenant-no-subscription-message'ı admin-tenant-plan-features DIŞINDA göster
            // plan-features-display'in parent'ı olan admin-tenant-plan-details içinde ama plan-features-display dışında
            const planDetailsContainer = document.querySelector('.admin-tenant-plan-details');
            if (planDetailsContainer) {
                // Önce mevcut mesajı kaldır
                const existingMessage = planDetailsContainer.querySelector('.admin-tenant-no-subscription-message');
                if (existingMessage) {
                    existingMessage.remove();
                }
                
                // Yeni mesajı ekle (plan-features-display'den sonra)
                const noSubscriptionMessage = document.createElement('div');
                noSubscriptionMessage.className = 'admin-tenant-no-subscription-message';
                noSubscriptionMessage.innerHTML = `
                        <p>Organizasyona ait aktif bir abonelik planı bulunmamaktadır.</p>
                        <p>Yeni bir plan tanımlayabilirsiniz.</p>
                `;
                
                // plan-features-display'den sonra ekle
                if (planFeaturesEl && planFeaturesEl.parentNode) {
                    planFeaturesEl.parentNode.insertBefore(noSubscriptionMessage, planFeaturesEl.nextSibling);
                } else {
                    planDetailsContainer.appendChild(noSubscriptionMessage);
                }
            }
            
            // Tenant info meta'daki plan adı (üst kısımdaki)
            const tenantPlanNameEl = document.getElementById('tenant-plan-name');
            if (tenantPlanNameEl) {
                tenantPlanNameEl.textContent = 'Abonelik planı yok';
            }
            
            // Plan stats alanlarını temizle (plan iptal edildiğinde)
            const planStatsStorage = document.getElementById('plan-stats-storage');
            const planStatsPercent = document.getElementById('plan-stats-percent');
            const planProgressBar = document.getElementById('plan-progress-bar-display');
            
            if (planStatsStorage) {
                planStatsStorage.textContent = '0 / 0 MB';
            }
            if (planStatsPercent) {
                planStatsPercent.textContent = '0%';
            }
            if (planProgressBar) {
                planProgressBar.style.width = '0%';
            }
        }
        
        // Plan yükseltme ve iptal butonlarına event listener ekle ve görünürlüğünü ayarla
        this.setupPlanActionButtons();
        this.updatePlanActionButtonsVisibility(hasActiveSubscription);
        
        // Plan detayları - Progress bar ve stats (sadece aktif abonelik varsa)
        if (hasActiveSubscription && this.kullanim && this.kullanim.kullanilan_depolama_byte !== undefined && this.abonelik) {
            // Byte'ları önce MB'ye çevir
            const storageUsedMB = this.kullanim.kullanilan_depolama_byte / (1024 * 1024);
            const storageLimitMB = this.kullanim.depolama_limit_byte / (1024 * 1024);
            
            // Kullanılan değer için: 1000 MB'den küçükse MB, büyükse GB göster
            let storageUsedDisplay, storageUsedUnit;
            if (storageUsedMB < 1024) {
                storageUsedDisplay = Math.round(storageUsedMB);
                storageUsedUnit = 'MB';
            } else {
                const storageUsedGB = storageUsedMB / 1024;
                if (storageUsedGB >= 1000) {
                    storageUsedDisplay = Math.round((storageUsedGB / 1024) * 10) / 10;
                    storageUsedUnit = 'TB';
                } else {
                    storageUsedDisplay = Math.round(storageUsedGB * 10) / 10;
                    storageUsedUnit = 'GB';
                }
            }
            
            // Limit için: 1000 MB'den küçükse MB, büyükse GB, 1000 GB'den büyükse TB göster
            let storageLimitDisplay, storageLimitUnit;
            if (storageLimitMB < 1024) {
                storageLimitDisplay = Math.round(storageLimitMB);
                storageLimitUnit = 'MB';
            } else {
                const storageLimitGB = storageLimitMB / 1024;
                if (storageLimitGB >= 1000) {
                    storageLimitDisplay = Math.round((storageLimitGB / 1024) * 10) / 10;
                    storageLimitUnit = 'TB';
                } else {
                    storageLimitDisplay = Math.round(storageLimitGB * 10) / 10;
                    storageLimitUnit = 'GB';
                }
            }
            
            // Progress hesaplama için MB cinsinden değerleri kullan
            const storageProgress = storageLimitMB > 0 ? (storageUsedMB / storageLimitMB) * 100 : 0;
            
            // Plan progress bar
            const planProgressBar = document.getElementById('plan-progress-bar-display');
            if (planProgressBar) {
                planProgressBar.style.width = `${Math.min(storageProgress, 100)}%`;
            }
            
            // Plan stats
            const planStatsStorage = document.getElementById('plan-stats-storage');
            const planStatsPercent = document.getElementById('plan-stats-percent');
            
            if (planStatsStorage) {
                planStatsStorage.textContent = `${storageUsedDisplay} ${storageUsedUnit} / ${storageLimitDisplay} ${storageLimitUnit}`;
            }
            
            if (planStatsPercent) {
                planStatsPercent.textContent = `${Math.round(storageProgress)}%`;
            }
        }
        
        // Ödeme yöntemi - Yeni ID'lerle
        const cardEl = document.getElementById('payment-card-display');
        const expiryEl = document.getElementById('payment-expiry-display');
        
        if (this.odemeYontemleri && this.odemeYontemleri.length > 0) {
            const defaultPayment = this.odemeYontemleri.find(p => p.varsayilan_mi === 1) || this.odemeYontemleri[0];
            
            if (defaultPayment) {
                if (cardEl) {
                    cardEl.textContent = `${defaultPayment.kart_tipi || 'Kart'} **** ${defaultPayment.son_dort_rakam || ''}`;
                }
                
                if (expiryEl) {
                    expiryEl.textContent = `Son kullanma: ${String(defaultPayment.son_kullanim_ayi || '').padStart(2, '0')}/${String(defaultPayment.son_kullanim_yili || '').slice(-2)}`;
                }
            }
        } else {
            // Ödeme yöntemi yoksa mesaj göster
            if (cardEl) {
                cardEl.textContent = 'Ödeme sistemi tanımlanmadı';
                cardEl.style.color = 'var(--color-text-secondary,rgb(143, 158, 180))';
                cardEl.style.fontStyle = 'normal';
                cardEl.style.fontWeight = '500';
            }
            if (expiryEl) {
                expiryEl.textContent = '';
            }
        }
        
        // Fatura özeti alanlarını doldur
        this.renderInvoiceSummary();
        
        // Fatura geçmişi
        this.renderFaturalar();
    }
    
    renderInvoiceSummary() {
        // Fatura özeti elementlerini bul
        const planPriceEl = document.getElementById('invoice-plan-price');
        const taxEl = document.getElementById('invoice-tax');
        const totalPriceEl = document.getElementById('invoice-total-price');
        
        // Abonelik yoksa veya plan yoksa varsayılan değerleri göster
        if (!this.abonelik || !this.abonelik.plan_id) {
            if (planPriceEl) planPriceEl.textContent = '₺0 / ay';
            if (taxEl) taxEl.textContent = '₺0';
            if (totalPriceEl) totalPriceEl.textContent = '₺0';
            return;
        }
        
        // Plan fiyatını hesapla (billing period'a göre)
        let planPriceInKurus = 0;
        const billingPeriod = this.abonelik.fatura_dongusu || 'aylik';
        
        if (billingPeriod === 'yillik') {
            // Yıllık paket: Yıllık fiyatı 12'ye bölerek aylık eşdeğer fiyatı göster
            if (this.abonelik.yillik_ucret) {
                planPriceInKurus = Math.round(this.abonelik.yillik_ucret / 12);
            } else if (this.abonelik.aylik_ucret) {
                planPriceInKurus = this.abonelik.aylik_ucret;
            }
        } else {
            // Aylık paket: Aylık fiyatı göster
            if (this.abonelik.aylik_ucret) {
                planPriceInKurus = this.abonelik.aylik_ucret;
            }
        }
        
        // Plan fiyatını TL'ye çevir
        const planPriceInTL = planPriceInKurus / 100;
        
        // KDV hesapla (%20)
        const taxInTL = planPriceInTL * 0.20;
        
        // Toplam (plan fiyatı + KDV)
        const totalInTL = planPriceInTL + taxInTL;
        
        // Formatla ve göster
        const formatPrice = (price) => {
            return price.toLocaleString('tr-TR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        };
        
        if (planPriceEl) {
            planPriceEl.textContent = `₺${formatPrice(planPriceInTL)} / ${billingPeriod === 'yillik' ? 'ay' : 'ay'}`;
        }
        
        if (taxEl) {
            taxEl.textContent = `₺${formatPrice(taxInTL)}`;
        }
        
        if (totalPriceEl) {
            totalPriceEl.textContent = `₺${formatPrice(totalInTL)}`;
        }
    }
    
    async loadPlanDetailsForBilling(billingPeriodEl, billingPeriod, billingPeriodText) {
        // Plan detayları bilgilerini topla
        // Yıllık ise yıllık fiyatın aylık eşdeğerini göster, aylık ise aylık fiyatı göster
        let planPrice = '-';
        let planPriceLabel = 'Aylık Ücret:';
        
        if (billingPeriod === 'yillik') {
            // Yıllık paket: Plan bilgisinden yıllık fiyatı al ve 12'ye böl
            if (this.abonelik.plan_id) {
                try {
                    const planResponse = await fetch(`${this.apiBase}/admin/tenants/${this.tenantId}/abonelik/planlar`, {
                        headers: {
                            'Authorization': `Bearer ${this.adminToken}`,
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include'
                    });
                    
                    if (planResponse.ok) {
                        const planResult = await planResponse.json();
                        if (planResult.success && planResult.data) {
                            const currentPlan = planResult.data.find(p => p.id == this.abonelik.plan_id);
                            if (currentPlan && currentPlan.yillik_ucret) {
                                // Yıllık fiyatı 12'ye bölerek aylık eşdeğer fiyatı göster
                                const yillikUcretValue = currentPlan.yillik_ucret / 100;
                                const aylikEsdeger = yillikUcretValue / 12;
                                planPrice = aylikEsdeger.toLocaleString('tr-TR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                });
                                planPriceLabel = 'Aylık Ücret (Yıllık Paket):';
                            } else if (this.abonelik.aylik_ucret) {
                                planPrice = (this.abonelik.aylik_ucret / 100).toLocaleString('tr-TR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                });
                            }
                        }
                    }
                } catch (error) {
                    console.warn('⚠️ Plan bilgisi yüklenemedi, aylık fiyat kullanılıyor:', error);
                    if (this.abonelik.aylik_ucret) {
                        planPrice = (this.abonelik.aylik_ucret / 100).toLocaleString('tr-TR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        });
                    }
                }
            } else if (this.abonelik.aylik_ucret) {
                planPrice = (this.abonelik.aylik_ucret / 100).toLocaleString('tr-TR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            }
                } else {
            // Aylık paket: Aylık fiyatı göster
            if (this.abonelik.aylik_ucret) {
                planPrice = (this.abonelik.aylik_ucret / 100).toLocaleString('tr-TR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            }
        }
        
        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            try {
                const date = new Date(dateStr);
                return date.toLocaleDateString('tr-TR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            } catch (e) {
                return dateStr;
            }
        };
        
        const abonelikBaslangic = formatDate(this.abonelik.mevcut_donem_baslangic || this.abonelik.olusturma_tarihi);
        const abonelikBitis = formatDate(this.abonelik.mevcut_donem_bitis);
        const sonrakiOdeme = formatDate(this.abonelik.sonraki_odeme_tarihi);
        
        // Plan detayları HTML'i oluştur
        billingPeriodEl.innerHTML = `
            <div class="plan-billing-row">
                <span class="plan-billing-label">Ödeme Dönemi:</span>
                <span class="plan-billing-value">${billingPeriodText}</span>
            </div>
            <div class="plan-billing-row">
                <span class="plan-billing-label">${planPriceLabel}</span>
                <span class="plan-billing-value">${planPrice} TL</span>
            </div>
            <div class="plan-billing-row">
                <span class="plan-billing-label">Abonelik Başlangıç:</span>
                <span class="plan-billing-value">${abonelikBaslangic}</span>
            </div>
            <div class="plan-billing-row">
                <span class="plan-billing-label">Dönem Bitiş:</span>
                <span class="plan-billing-value">${abonelikBitis}</span>
            </div>
            <div class="plan-billing-row">
                <span class="plan-billing-label">Sonraki Ödeme:</span>
                <span class="plan-billing-value">${sonrakiOdeme}</span>
            </div>
        `;
    }
    
    renderFaturalar() {
        const tbody = document.getElementById('invoices-tbody');
        if (!tbody) {
            return;
        }
        
        if (!this.invoices || this.invoices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="admin-tenant-loading">Fatura bulunamadı</td></tr>';
            return;
        }
        
        // En son fatura en üstte: tarih ve id'ye göre azalan sıra (backend DESC olsa da client tarafında garanti)
        const sortedInvoices = [...(this.invoices || [])].sort((a, b) => {
            const dateA = a.fatura_tarihi ? new Date(a.fatura_tarihi).getTime() : 0;
            const dateB = b.fatura_tarihi ? new Date(b.fatura_tarihi).getTime() : 0;
            if (dateB !== dateA) return dateB - dateA;
            return (b.id || 0) - (a.id || 0);
        });

        // Arama sorgusuna göre filtrele
        let filteredInvoices = sortedInvoices;
        if (this.invoiceSearchQuery) {
            filteredInvoices = sortedInvoices.filter(invoice => {
                const faturaNo = (invoice.fatura_no || '').toLowerCase();
                const planAdi = (invoice.plan_adi || '').toLowerCase();
                const durum = (invoice.durum || '').toLowerCase();
                // Tutar formatlanmış haliyle de karşılaştır
                const tutarSayi = (invoice.toplam_tutar || 0).toString();
                const tutarFormatli = (invoice.toplam_tutar / 100).toLocaleString('tr-TR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                    useGrouping: true
                }).toLowerCase();
                // Tarih hem formatlanmış hem de ham değerle karşılaştır
                const tarihFormatli = invoice.fatura_tarihi ? new Date(invoice.fatura_tarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }).toLowerCase() : '';
                const tarihHam = invoice.fatura_tarihi ? invoice.fatura_tarihi.toLowerCase() : '';
                
                return faturaNo.includes(this.invoiceSearchQuery) ||
                       planAdi.includes(this.invoiceSearchQuery) ||
                       durum.includes(this.invoiceSearchQuery) ||
                       tutarSayi.includes(this.invoiceSearchQuery) ||
                       tutarFormatli.includes(this.invoiceSearchQuery) ||
                       tarihFormatli.includes(this.invoiceSearchQuery) ||
                       tarihHam.includes(this.invoiceSearchQuery);
            });
        }
        
        if (filteredInvoices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="admin-tenant-loading">' + (this.invoiceSearchQuery ? 'Arama sonucu bulunamadı' : 'Fatura bulunamadı') + '</td></tr>';
            return;
        }
        
        tbody.innerHTML = filteredInvoices.map(invoice => {
            const date = new Date(invoice.fatura_tarihi);
            const formattedDate = date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const amount = (invoice.toplam_tutar / 100).toLocaleString('tr-TR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
                useGrouping: true
            });
            const statusClass = invoice.durum === 'odendi' ? 'active' : '';
            const statusText = invoice.durum === 'odendi' ? 'Ödendi' : invoice.durum === 'beklemede' ? 'Beklemede' : invoice.durum;
            
            // Ödeme dönemi bilgisi - fatura_dongusu'ndan al
            const billingPeriod = invoice.fatura_dongusu || invoice.billing_period || invoice.odeme_periyodu || 'aylik';
            const billingPeriodLower = String(billingPeriod).toLowerCase().trim();
            const odemeDonemi = (billingPeriodLower === 'yillik' || billingPeriodLower === 'yearly' || billingPeriodLower === 'yıllık') ? 'Yıllık' : 'Aylık';
            
            return `
                <tr>
                    <td data-label="Fatura No">${invoice.fatura_no}</td>
                    <td data-label="Tarih">${formattedDate}</td>
                    <td data-label="Plan"><span class="admin-tenant-role-badge">${invoice.plan_adi || '-'}</span></td>
                    <td data-label="Ödeme Dönemi"><span class="admin-tenant-role-badge">${odemeDonemi}</span></td>
                    <td data-label="Tutar" class="admin-tenant-invoice-amount">₺${amount}</td>
                    <td data-label="Durum">
                        <span class="admin-tenant-status-badge-small ${statusClass}">
                            ${statusClass === 'active' ? '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="admin-tenant-status-icon"><path d="M20 6 9 17l-5-5"></path></svg>' : ''}
                            ${statusText}
                        </span>
                    </td>
                    <td data-label="İşlem">
                        <button type="button" class="admin-tenant-download-invoice-btn" data-invoice-id="${invoice.fatura_no}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            PDF İndir
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    // Eski mock data kodu (artık kullanılmıyor)
    oldLoadBillingData() {
        // Update user count in billing
        const usersCount = this.users.length;
        const usersCountEl = document.getElementById('billing-users-count');
        const usersProgressEl = document.getElementById('billing-users-progress');
        
        if (usersCountEl) {
            usersCountEl.textContent = usersCount;
        }
        
        if (usersProgressEl) {
            const progress = (usersCount / 50) * 100;
            usersProgressEl.style.width = `${Math.min(progress, 100)}%`;
        }
        
        // Eski mock data kodu - artık kullanılmıyor
    }
    
    // Eski renderInvoices fonksiyonu - artık renderFaturalar kullanılıyor
    oldRenderInvoices() {
        const invoicesTbody = document.getElementById('invoices-tbody');
        if (!invoicesTbody) return;
        
        invoicesTbody.innerHTML = this.invoices.map(invoice => `
            <tr>
                <td class="admin-tenant-invoice-id">${invoice.id}</td>
                <td>${invoice.date}</td>
                <td><span class="admin-tenant-role-badge">${invoice.plan}</span></td>
                <td class="admin-tenant-invoice-amount">${invoice.amount}</td>
                <td>
                    <span class="admin-tenant-status-badge-small active">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="admin-tenant-status-icon"><path d="M20 6 9 17l-5-5"></path></svg>
                        ${invoice.status}
                    </span>
                </td>
                <td>
                    <button type="button" class="admin-tenant-download-invoice-btn" data-action="download-invoice" data-invoice-id="${invoice.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        PDF İndir
                    </button>
                </td>
            </tr>
        `).join('');
    }
    
    async toggleTenantStatus() {
        if (!this.tenant) return;
        
        // Status kolonunu kullan (tenants tablosundaki status alanı)
        const currentStatus = this.tenant.status || 'pasif';
        const isActive = currentStatus === 'aktif';
        const newStatus = isActive ? 'pasif' : 'aktif';
        const statusText = newStatus;
        
        // Orchids'deki gibi confirm dialog
        const titleText = isActive ? "Tenant'ı Devre Dışı Bırak" : "Tenant'ı Aktif Et";
        const messageText = isActive 
            ? "Bu tenant devre dışı bırakıldığında tüm kullanıcılar erişimini kaybedecek. Bu işlemi onaylıyor musunuz?"
            : "Bu tenant aktif edildiğinde tüm kullanıcılar tekrar erişim sağlayabilecek. Bu işlemi onaylıyor musunuz?";
        const confirmButtonText = isActive ? "Devre Dışı Bırak" : "Aktif Et";
        
        if (typeof createToastInteractive === 'function') {
            createToastInteractive({
                title: titleText,
                message: messageText,
                confirmText: confirmButtonText,
                cancelText: 'İptal',
                isWarning: true,
                confirmButtonClass: isActive ? 'toast-btn-red' : 'toast-btn-green',
                onConfirm: async () => {
                    await this.performTenantStatusToggle(newStatus, statusText);
                },
                onCancel: () => {}
            });
        } else {
            if (!confirm(messageText)) {
                return;
            }
            await this.performTenantStatusToggle(newStatus, statusText);
        }
    }
    
    async performTenantStatusToggle(newStatus, statusText) {
        try {
            // Status değerini "aktif" veya "pasif" olarak gönder (status kolonunu güncelle, is_active değil)
            const statusValue = newStatus; // newStatus zaten "aktif" veya "pasif" string'i
            
            const response = await fetch(`${this.apiBase}/admin/tenants/${this.tenantId}`, {
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
                const errorData = await response.json();
                throw new Error(errorData.error || 'Tenant durumu değiştirilemedi');
            }
            
            const result = await response.json();
            if (result.success) {
                // Tenant verisini güncelle - backend'den gelen tüm verileri al
                this.tenant = { ...this.tenant, ...result.data };
                
                // Tenant verisini tam olarak yeniden yükle (tenants_no dahil tüm alanlar için)
                await this.loadTenant();
                
                // Tüm ilgili alanları güncelle
                this.renderTenantInfo();
                this.loadSettingsData();
                this.loadBillingData();
                
                // Cross-page update için broadcast et
                if (window.syncManager) {
                    window.syncManager.broadcast('TENANT_STATUS_CHANGED', {
                        tenantId: this.tenantId,
                        status: statusValue,
                        tenantData: result.data
                    });
                }
                
                if (typeof createToast === 'function') {
                    createToast('success', `Tenant ${statusText} yapıldı`);
                }
            }
        } catch (error) {
            console.error('Tenant durumu değiştirilirken hata:', error);
            if (typeof createToast === 'function') {
                createToast('error', error.message || 'Tenant durumu değiştirilemedi');
            }
        }
    }
    
    async showPaymentEditModal() {
        // Ödeme yöntemleri henüz yüklenmemişse yükle
        if (!this.odemeYontemleri || this.odemeYontemleri.length === 0) {
            await this.loadOdemeYontemleri();
        }
        
        if (!this.sheets.payment) {
            this.createPaymentSheet();
        }
        
        // Sheet'i önce DOM'a ekle, sonra animasyonla aç
        if (!this.sheets.payment.parentNode) {
            document.body.appendChild(this.sheets.payment);
        }
        
        // requestAnimationFrame ile animasyonun çalışması için bekle
        requestAnimationFrame(() => {
            this.sheets.payment.update(true);
        });
    }
    
    createPaymentSheet() {
        const { createSheet, createSheetHeader, createSheetTitle, createSheetDescription, createSheetContent, createSheetFooter, createInput, createLabel } = window.AdminComponents;
        
        const sheet = createSheet({
            id: 'payment-sheet',
            side: 'right',
            open: false,
            onClose: () => {
                this.sheets.payment.update(false);
                setTimeout(() => {
                    if (this.sheets.payment && this.sheets.payment.parentNode) {
                        this.sheets.payment.parentNode.removeChild(this.sheets.payment);
                    }
                }, 300);
            }
        });
        
        const header = document.createElement('div');
        header.className = 'modal-header';
        const headerContent = document.createElement('div');
        headerContent.className = 'modal-header-content';
        const titleIcon = document.createElement('div');
        titleIcon.className = 'modal-header-icon';
        titleIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>';
        headerContent.appendChild(titleIcon);
        const headerText = document.createElement('div');
        headerText.className = 'modal-header-text';
        const title = document.createElement('h2');
        title.textContent = 'Ödeme Yöntemini Güncelle';
        headerText.appendChild(title);
        const desc = document.createElement('p');
        desc.className = 'modal-description';
        desc.textContent = 'Kayıtlı kredi kartı bilgilerinizi güncelleyin.';
        headerText.appendChild(desc);
        headerContent.appendChild(headerText);
        header.appendChild(headerContent);
        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close';
        closeBtn.innerHTML = '×';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.onclick = () => {
            this.sheets.payment.update(false);
            setTimeout(() => {
                if (this.sheets.payment && this.sheets.payment.parentNode) {
                    this.sheets.payment.parentNode.removeChild(this.sheets.payment);
                }
            }, 300);
        };
        header.appendChild(closeBtn);
        
        const content = createSheetContent();
        
        // Ödeme yöntemi bilgilerini al
        const defaultPayment = this.odemeYontemleri && this.odemeYontemleri.length > 0 
            ? (this.odemeYontemleri.find(p => p.varsayilan_mi === 1) || this.odemeYontemleri[0])
            : null;
        
        const cardHolderValue = defaultPayment?.kart_sahibi_adi || '';
        const cardNumberValue = defaultPayment ? `**** **** **** ${defaultPayment.son_dort_rakam}` : '';
        const expiryValue = defaultPayment ? `${String(defaultPayment.son_kullanim_ayi).padStart(2, '0')}/${String(defaultPayment.son_kullanim_yili).slice(-2)}` : '';
        
        const form = document.createElement('form');
        form.id = 'payment-form';
        form.className = '';
        
        // Kart Üzerindeki İsim
        const cardHolderGroup = document.createElement('div');
        cardHolderGroup.className = 'form-group';
        const cardHolderLabel = createLabel({ children: 'Kart Üzerindeki İsim', htmlFor: 'payment-card-holder' });
        cardHolderGroup.appendChild(cardHolderLabel);
        const cardHolderInput = createInput({ 
            value: cardHolderValue, 
            placeholder: 'Kart Üzerindeki İsim'
        });
        cardHolderInput.id = 'payment-card-holder'; // ID'yi manuel olarak set et
        cardHolderInput.addEventListener('focus', (e) => e.target.select());
        cardHolderGroup.appendChild(cardHolderInput);
        form.appendChild(cardHolderGroup);
        
        // Kart Numarası
        const cardNumberGroup = document.createElement('div');
        cardNumberGroup.className = 'form-group';
        const cardNumberLabel = createLabel({ children: 'Kart Numarası', htmlFor: 'payment-card-number' });
        cardNumberGroup.appendChild(cardNumberLabel);
        const cardNumberInput = createInput({ 
            value: cardNumberValue, 
            placeholder: '**** **** **** 4242'
        });
        cardNumberInput.id = 'payment-card-number'; // ID'yi manuel olarak set et
        cardNumberInput.maxLength = 19;
        cardNumberInput.addEventListener('focus', (e) => e.target.select());
        // Kart numarası formatı için input mask (**** **** **** ****)
        cardNumberInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, ''); // Sadece rakamları al
            // 16 haneli kart numarası için format: XXXX XXXX XXXX XXXX
            if (value.length > 16) {
                value = value.substring(0, 16);
            }
            // Her 4 rakamdan sonra boşluk ekle
            let formatted = '';
            for (let i = 0; i < value.length; i++) {
                if (i > 0 && i % 4 === 0) {
                    formatted += ' ';
                }
                formatted += value[i];
            }
            e.target.value = formatted;
        });
        cardNumberInput.addEventListener('keypress', (e) => {
            // Sadece rakamları kabul et
            if (!/[0-9]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete') {
                e.preventDefault();
            }
        });
        cardNumberGroup.appendChild(cardNumberInput);
        form.appendChild(cardNumberGroup);
        
        // SKT ve CVV - Grid
        const expiryCvvGrid = document.createElement('div');
        expiryCvvGrid.className = 'grid grid-cols-2 gap-4';
        
        // SKT
        const expiryGroup = document.createElement('div');
        expiryGroup.className = 'form-group';
        const expiryLabel = createLabel({ children: 'SKT', htmlFor: 'payment-expiry' });
        expiryGroup.appendChild(expiryLabel);
        const expiryInput = createInput({ 
            placeholder: 'AA/YY',
            value: expiryValue
        });
        expiryInput.id = 'payment-expiry'; // ID'yi manuel olarak set et
        expiryInput.maxLength = 5;
        expiryInput.addEventListener('focus', (e) => e.target.select());
        // MM/YY formatı için input mask ve validation
        expiryInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, ''); // Sadece rakamları al
            // Maksimum 4 rakam (MMYY)
            if (value.length > 4) {
                value = value.substring(0, 4);
            }
            
            // Ay kontrolü - ilk 2 rakam 01-12 arası olmalı
            if (value.length >= 1) {
                const firstDigit = parseInt(value[0]);
                // İlk rakam 0 veya 1 olmalı (01-12 için)
                if (firstDigit > 1) {
                    value = value.substring(0, 0); // 2-9 ile başlayanlar geçersiz, temizle
                }
            }
            
            if (value.length >= 2) {
                const ay = parseInt(value.substring(0, 2));
                // Ay 01-12 arası olmalı
                if (ay < 1 || ay > 12) {
                    // Geçersiz ay - son rakamı kaldır (13-19 veya 00 gibi)
                    value = value.substring(0, 1);
                }
            }
            
            // 2 veya daha fazla rakam varsa "/" ekle
            if (value.length >= 2) {
                value = value.substring(0, 2) + '/' + value.substring(2, 4);
            }
            e.target.value = value;
        });
        
        // Blur event - input'tan çıkıldığında validation yap
        expiryInput.addEventListener('blur', (e) => {
            const value = e.target.value.trim();
            if (value && value.length === 5) {
                const parts = value.split('/');
                if (parts.length === 2) {
                    const ay = parseInt(parts[0]);
                    const yil = parseInt(parts[1]);
                    if (isNaN(ay) || isNaN(yil) || ay < 1 || ay > 12 || yil < 0 || yil > 99) {
                        e.target.style.borderColor = '#ef4444';
                        if (typeof createToast === 'function') {
                            createToast('error', 'Geçersiz SKT formatı! Ay 01-12, Yıl 00-99 arası olmalıdır.');
                        }
                    } else {
                        e.target.style.borderColor = '';
                    }
                }
            }
        });
        
        // Focus event - input'a girildiğinde border rengini sıfırla
        expiryInput.addEventListener('focus', (e) => {
            e.target.style.borderColor = '';
        });
        expiryInput.addEventListener('keypress', (e) => {
            // Sadece rakamları kabul et
            if (!/[0-9]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete') {
                e.preventDefault();
            }
        });
        expiryGroup.appendChild(expiryInput);
        expiryCvvGrid.appendChild(expiryGroup);
        
        // CVV
        const cvvGroup = document.createElement('div');
        cvvGroup.className = 'form-group';
        const cvvLabel = createLabel({ children: 'CVV', htmlFor: 'payment-cvv' });
        cvvGroup.appendChild(cvvLabel);
        const cvvInput = createInput({ 
            placeholder: '***',
            value: '***'
        });
        cvvInput.id = 'payment-cvv'; // ID'yi manuel olarak set et
        cvvInput.type = 'password';
        cvvInput.addEventListener('focus', (e) => e.target.select());
        cvvGroup.appendChild(cvvInput);
        expiryCvvGrid.appendChild(cvvGroup);
        
        form.appendChild(expiryCvvGrid);
        content.appendChild(form);
        
        const footer = createSheetFooter();
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn-cancel flex-1';
        cancelBtn.textContent = 'İptal';
        cancelBtn.onclick = () => {
            this.sheets.payment.update(false);
            setTimeout(() => {
                if (this.sheets.payment && this.sheets.payment.parentNode) {
                    this.sheets.payment.parentNode.removeChild(this.sheets.payment);
                }
            }, 300);
        };
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'btn-save flex-1';
        saveBtn.textContent = 'Kartı Kaydet';
        saveBtn.onclick = async () => {
            // Önce ödeme yöntemlerini yeniden yükle (güncel olması için)
            await this.loadOdemeYontemleri();
            
            // Güncel ödeme yöntemini al
            const currentPayment = this.odemeYontemleri && this.odemeYontemleri.length > 0 
                ? (this.odemeYontemleri.find(p => p.varsayilan_mi === 1) || this.odemeYontemleri[0])
                : null;
            
            if (!currentPayment || !currentPayment.id) {
                console.error('❌ Ödeme yöntemi bulunamadı:', {
                    odemeYontemleri: this.odemeYontemleri,
                    currentPayment
                });
                if (typeof createToast === 'function') {
                    createToast('error', 'Ödeme yöntemi bulunamadı');
                }
                return;
            }
            
            // Sheet içindeki inputları bul
            const sheet = this.sheets.payment;
            if (!sheet) {
                console.error('❌ Payment sheet bulunamadı');
                if (typeof createToast === 'function') {
                    createToast('error', 'Form bulunamadı');
                }
                return;
            }
            
            // Sheet DOM'a eklenmemişse ekle
            if (!sheet.parentNode) {
                document.body.appendChild(sheet);
            }
            
            // Önce form'u bul, sonra inputları form içinde ara
            const modal = sheet.querySelector('.modal');
            const form = modal ? modal.querySelector('#payment-form') : null;
            
            // Inputları bul - önce form içinde, sonra sheet içinde, sonra document içinde
            let cardHolderInput = form ? form.querySelector('#payment-card-holder') : null;
            let cardNumberInput = form ? form.querySelector('#payment-card-number') : null;
            let expiryInput = form ? form.querySelector('#payment-expiry') : null;
            
            // Eğer form içinde bulunamazsa, sheet içinde ara
            if (!cardHolderInput) {
                cardHolderInput = sheet.querySelector('#payment-card-holder');
            }
            if (!cardNumberInput) {
                cardNumberInput = sheet.querySelector('#payment-card-number');
            }
            if (!expiryInput) {
                expiryInput = sheet.querySelector('#payment-expiry');
            }
            
            // Eğer sheet içinde de bulunamazsa, document içinde ara (fallback)
            if (!cardHolderInput) {
                cardHolderInput = document.getElementById('payment-card-holder');
            }
            if (!cardNumberInput) {
                cardNumberInput = document.getElementById('payment-card-number');
            }
            if (!expiryInput) {
                expiryInput = document.getElementById('payment-expiry');
            }
            
            // Form inputları kontrol ediliyor
            if (!cardHolderInput || !expiryInput) {
                console.error('❌ Form inputları bulunamadı');
                if (typeof createToast === 'function') {
                    createToast('error', 'Form alanları bulunamadı. Lütfen sayfayı yenileyin.');
                }
                return;
            }
            
            const kartSahibiAdi = cardHolderInput.value.trim();
            let kartNumarasi = cardNumberInput?.value.trim() || '';
            const expiryValue = expiryInput.value.trim();
            
            // Başlangıç değerini al (karşılaştırma için) - currentPayment'tan hesapla
            const initialExpiryValue = currentPayment && currentPayment.son_kullanim_ayi && currentPayment.son_kullanim_yili
                ? `${String(currentPayment.son_kullanim_ayi).padStart(2, '0')}/${String(currentPayment.son_kullanim_yili).slice(-2)}`
                : '';
            
            // Eğer kart numarası "**** **** ****" formatındaysa (değiştirilmemişse), null gönder
            if (kartNumarasi.includes('****') || kartNumarasi.replace(/\s/g, '').length < 4) {
                kartNumarasi = null; // Backend mevcut değeri koruyacak
            }
            
            // SKT'yi parse et (MM/YY formatından)
            let ay = undefined;
            let yil = undefined;
            
            // Eğer expiry input'u dolu ve başlangıç değerinden farklıysa (kullanıcı değiştirmişse), parse et
            if (expiryValue && expiryValue.trim() !== '' && expiryValue !== initialExpiryValue) {
                const expiryParts = expiryValue.split('/');
                if (expiryParts.length === 2) {
                    const parsedAy = parseInt(expiryParts[0].trim());
                    const parsedYil = parseInt(expiryParts[1].trim());
                    if (!isNaN(parsedAy) && !isNaN(parsedYil) && parsedAy >= 1 && parsedAy <= 12 && parsedYil > 0) {
                        ay = parsedAy;
                        yil = parsedYil;
                        // Eğer yıl 2 haneli ise (YY formatında), 2000 ekle
                        if (yil < 100) {
                            yil = 2000 + yil;
                        }
                        
                        // SKT parse edildi
                    } else {
                        console.warn('⚠️ Geçersiz SKT formatı:', expiryValue, {
                            parsedAy,
                            parsedYil,
                            isValidAy: parsedAy >= 1 && parsedAy <= 12,
                            isValidYil: parsedYil > 0
                        });
                        // Geçersiz format - kullanıcıya uyarı göster ve kaydetmeyi durdur
                        if (typeof createToast === 'function') {
                            createToast('error', `Geçersiz SKT formatı! Ay 01-12, Yıl 00-99 arası olmalıdır. (Girilen: ${expiryValue})`);
                        }
                        // Input'u kırmızı yap
                        if (expiryInput) {
                            expiryInput.style.borderColor = '#ef4444';
                            expiryInput.focus();
                        }
                        return; // İşlemi durdur, kaydetme
                    }
                } else {
                    console.warn('⚠️ SKT formatı hatalı - "/" karakteri eksik:', expiryValue);
                    // Format hatası - kullanıcıya uyarı göster
                    if (typeof createToast === 'function') {
                        createToast('error', 'SKT formatı hatalı! Lütfen MM/YY formatında girin (örn: 12/25)');
                    }
                    // Input'u kırmızı yap
                    if (expiryInput) {
                        expiryInput.style.borderColor = '#ef4444';
                        expiryInput.focus();
                    }
                    return; // İşlemi durdur, kaydetme
                }
            }
            // Eğer expiryValue boş, undefined veya başlangıç değeriyle aynıysa, ay ve yil undefined kalır
            // Backend undefined değerleri görmezden gelir ve mevcut değerleri korur
            
            const requestBody = {
                kart_sahibi_adi: kartSahibiAdi || null,
                kart_numarasi: kartNumarasi
            };
            
            // Sadece geçerli ay ve yıl varsa ekle
            if (ay !== undefined && yil !== undefined) {
                requestBody.son_kullanim_ayi = ay;
                requestBody.son_kullanim_yili = yil;
            }
            
            // Ödeme yöntemi güncelleme - Gönderilen veriler
            
            try {
                const response = await fetch(`${this.apiBase}/admin/tenants/${this.tenantId}/odeme-yontemleri/${currentPayment.id}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${this.adminToken}`,
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify(requestBody)
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    
                    // Ödeme yöntemlerini yeniden yükle
                    await this.loadOdemeYontemleri();
                    // Billing tab'ını yeniden render et
                    this.renderBillingTab();
                    
                    if (typeof createToast === 'function') {
                        createToast('success', 'Ödeme yöntemi başarıyla güncellendi');
                    }
                    
                    this.sheets.payment.update(false);
                    setTimeout(() => {
                        if (this.sheets.payment && this.sheets.payment.parentNode) {
                            this.sheets.payment.parentNode.removeChild(this.sheets.payment);
                        }
                    }, 300);
                } else {
                    const errorMessage = result.error || result.message || 'Ödeme yöntemi güncellenemedi';
                    console.error('❌ Ödeme yöntemi güncellenemedi:', {
                        status: response.status,
                        error: errorMessage,
                        result
                    });
                    throw new Error(errorMessage);
                }
            } catch (error) {
                console.error('❌ Ödeme yöntemi güncellenirken hata:', error);
                if (typeof createToast === 'function') {
                    createToast('error', error.message || 'Ödeme yöntemi güncellenemedi');
                }
            }
        };
        footer.appendChild(cancelBtn);
        footer.appendChild(saveBtn);
        
        // Modal'ı bul ve içeriği ekle
        const modal = sheet.querySelector('.modal');
        if (modal) {
            modal.appendChild(header);
            modal.appendChild(content);
            modal.appendChild(footer);
        } else {
            console.error('❌ Modal elementi bulunamadı!');
        }
        
        this.sheets.payment = sheet;
    }
    
    setupPlanActionButtons() {
        // Plan yükseltme/seçme butonu
        const upgradeBtn = document.querySelector('.admin-tenant-plan-upgrade-btn');
        if (upgradeBtn) {
            upgradeBtn.onclick = () => {
                const hasActive = this.abonelik && this.abonelik.plan_adi && this.abonelik.durum === 'aktif';
                if (hasActive) {
                    this.showUpgradePlanSheet();
                } else {
                    this.showSelectPlanSheet();
                }
            };
        }
        
        // Abonelik iptal butonu
        const cancelBtn = document.querySelector('.admin-tenant-plan-cancel-btn');
        if (cancelBtn) {
            cancelBtn.onclick = () => this.showCancelSubscriptionSheet();
        }
    }
    
    updatePlanActionButtonsVisibility(hasActiveSubscription) {
        const upgradeBtn = document.querySelector('.admin-tenant-plan-upgrade-btn');
        const cancelBtn = document.querySelector('.admin-tenant-plan-cancel-btn');
        
        if (upgradeBtn) {
            if (hasActiveSubscription) {
                upgradeBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                    Planı Değiştir
                `;
            } else {
                upgradeBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="M12 5l7 7-7 7"></path></svg>
                    Plan Tanımla
                `;
            }
        }
        
        if (cancelBtn) {
            cancelBtn.style.display = hasActiveSubscription ? 'flex' : 'none';
        }
    }
    
    async showSelectPlanSheet() {
        // Tüm planları yükle
        try {
            const response = await fetch(`${this.apiBase}/admin/tenants/${this.tenantId}/abonelik/planlar`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Planlar yüklenemedi');
            }
            
            const result = await response.json();
            const plans = result.data || [];
            
            if (plans.length === 0) {
                if (typeof createToast === 'function') {
                    createToast('info', 'Henüz plan bulunmamaktadır.');
                }
                return;
            }
            
            // Plan tanımlama sheet'i göster
            this.createUpgradePlanSheet(plans, 'Plan Tanımla', 'Size uygun bir plan tanımlayın ve abone olun.');
        } catch (error) {
            console.error('❌ Planlar yüklenirken hata:', error);
            if (typeof createToast === 'function') {
                createToast('error', 'Planlar yüklenemedi');
            }
        }
    }
    
    async selectPlan(planId, billingPeriod = 'monthly') {
        if (typeof createToastInteractive === 'function') {
            createToastInteractive({
                title: 'Plan Tanımla',
                message: 'Bu planı tanımlamak istediğinizden emin misiniz?',
                confirmText: 'Evet, Tanımla',
                cancelText: 'İptal',
                onConfirm: async () => {
                    await this.performSelectPlan(planId, billingPeriod);
                },
                onCancel: () => {
                    if (typeof createToast === 'function') {
                        createToast('info', 'Plan tanımlama iptal edildi');
                    }
                }
            });
        } else {
            // Fallback
            if (!confirm('Bu plana abone olmak istediğinizden emin misiniz?')) {
                return;
            }
            await this.performSelectPlan(planId, billingPeriod);
        }
    }
    
    async performSelectPlan(planId, billingPeriod = 'monthly') {
        // İptal edilmiş abonelikten sonra yeni plan seçiminde fatura oluşturulması için
        // /abonelik/upgrade endpoint'ini kullan (bu endpoint hem abonelik hem fatura oluşturuyor)
        // /abonelik/create endpoint'i fatura oluşturmuyor!
        console.log('🔍 [CONSOLE MANAGE FRONTEND] performSelectPlan çağrıldı - upgrade endpoint kullanılacak:', {
            planId,
            billingPeriod,
            tenantId: this.tenantId
        });
        
        // performUpgrade fonksiyonunu kullan (aynı mantık, hem abonelik hem fatura oluşturuyor)
        await this.performUpgrade(planId, billingPeriod);
    }
    
    async showUpgradePlanSheet() {
        // Tüm planları yükle (artık filtreleme yok, tüm planları göster)
        try {
            const response = await fetch(`${this.apiBase}/admin/tenants/${this.tenantId}/abonelik/planlar`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Planlar yüklenemedi');
            }
            
            const result = await response.json();
            const plans = result.data || [];
            
            if (plans.length === 0) {
                if (typeof createToast === 'function') {
                    createToast('info', 'Henüz plan bulunmamaktadır.');
                }
                return;
            }
            
            // Tüm planları göster (filtreleme yok)
            this.createUpgradePlanSheet(plans, 'Planı Değiştir', 'Tenantın mevcut planını değiştirin. Tüm planları görüntüleyebilir ve istediğiniz planı seçebilirsiniz.');
        } catch (error) {
            console.error('❌ Planlar yüklenirken hata:', error);
            if (typeof createToast === 'function') {
                createToast('error', 'Planlar yüklenemedi');
            }
        }
    }
    
    async createUpgradePlanSheet(plans = null, titleText = null, descriptionText = null) {
        // Eğer plans gönderilmediyse, planları yükle
        if (!plans || !Array.isArray(plans) || plans.length === 0) {
            try {
                const response = await fetch(`${this.apiBase}/admin/tenants/${this.tenantId}/abonelik/planlar`, {
                    headers: {
                        'Authorization': `Bearer ${this.adminToken}`,
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include'
                });
                
                if (!response.ok) {
                    throw new Error('Planlar yüklenemedi');
                }
                
                const result = await response.json();
                plans = result.data || [];
                
                if (plans.length === 0) {
                    if (typeof createToast === 'function') {
                        createToast('info', 'Henüz plan bulunmamaktadır.');
                    }
                    return;
                }
            } catch (error) {
                console.error('❌ Planlar yüklenirken hata:', error);
                if (typeof createToast === 'function') {
                    createToast('error', 'Planlar yüklenemedi');
                }
                return;
            }
        }
        const { createSheet, createSheetHeader, createSheetTitle, createSheetDescription, createSheetContent, createSheetFooter } = window.AdminComponents;
        
        const isSelectMode = !titleText;
        const hasActive = this.abonelik && this.abonelik.plan_adi && this.abonelik.durum === 'aktif';
        const finalTitle = titleText || (isSelectMode ? 'Plan Tanımla' : 'Planı Değiştir');
        const finalDescription = descriptionText || (isSelectMode ? 'Size uygun bir plan tanımlayın ve abone olun.' : 'Mevcut planınızı değiştirin. Tüm planları görüntüleyebilir ve istediğiniz plana geçebilirsiniz.');
        
        const sheet = createSheet({
            id: 'upgrade-plan-sheet',
            side: 'right',
            open: true,
            onClose: () => {
                if (this.sheets.upgradePlan && this.sheets.upgradePlan.parentNode) {
                    this.sheets.upgradePlan.parentNode.removeChild(this.sheets.upgradePlan);
                }
            }
        });
        
        const header = document.createElement('div');
        header.className = 'modal-header';
        const headerContent = document.createElement('div');
        headerContent.className = 'modal-header-content';
        const titleIcon = document.createElement('div');
        titleIcon.className = 'modal-header-icon';
        titleIcon.innerHTML = isSelectMode 
            ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="M12 5l7 7-7 7"></path></svg>'
            : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>';
        headerContent.appendChild(titleIcon);
        const headerText = document.createElement('div');
        headerText.className = 'modal-header-text';
        const title = document.createElement('h2');
        title.textContent = finalTitle;
        headerText.appendChild(title);
        const desc = document.createElement('p');
        desc.className = 'modal-description';
        desc.textContent = finalDescription;
        headerText.appendChild(desc);
        headerContent.appendChild(headerText);
        header.appendChild(headerContent);
        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close';
        closeBtn.innerHTML = '×';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.onclick = () => {
            if (this.sheets.upgradePlan && this.sheets.upgradePlan.parentNode) {
                this.sheets.upgradePlan.parentNode.removeChild(this.sheets.upgradePlan);
            }
        };
        header.appendChild(closeBtn);
        
        const content = createSheetContent({ className: 'sheet-form-spacing-large' });
        
        // Global billing period değişkeni (console manage modal için)
        if (!window.consoleManageBillingPeriod) {
            window.consoleManageBillingPeriod = 'monthly';
        }
        
        // Mevcut plan bilgisini al
        const currentPlanId = this.abonelik?.plan_id || null;
        const currentBillingPeriod = this.abonelik?.fatura_dongusu || 'aylik'; // 'aylik' veya 'yillik'
        const normalizedCurrentBillingPeriod = currentBillingPeriod === 'yillik' ? 'yearly' : 'monthly';
        
        // Toggle ekle (modal'ın üstüne)
        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'landing-pricing-toggle';
        toggleContainer.style.cssText = 'margin-bottom: 24px; display: flex; justify-content: center;';
        
        const monthlyToggleBtn = document.createElement('button');
        monthlyToggleBtn.className = `landing-toggle-btn ${window.consoleManageBillingPeriod === 'monthly' ? 'active' : ''}`;
        monthlyToggleBtn.id = 'console-manage-toggle-monthly';
        monthlyToggleBtn.textContent = 'Aylık';
        monthlyToggleBtn.onclick = () => {
            window.consoleManageBillingPeriod = 'monthly';
            toggleConsoleManagePricing('monthly');
        };
        
        const yearlyToggleBtn = document.createElement('button');
        yearlyToggleBtn.className = `landing-toggle-btn ${window.consoleManageBillingPeriod === 'yearly' ? 'active' : ''}`;
        yearlyToggleBtn.id = 'console-manage-toggle-yearly';
        yearlyToggleBtn.innerHTML = 'Yıllık <span class="landing-toggle-discount">%20 İndirim</span>';
        yearlyToggleBtn.onclick = () => {
            window.consoleManageBillingPeriod = 'yearly';
            toggleConsoleManagePricing('yearly');
        };
        
        toggleContainer.appendChild(monthlyToggleBtn);
        toggleContainer.appendChild(yearlyToggleBtn);
        content.appendChild(toggleContainer);
        
        // Toggle fonksiyonu
        const toggleConsoleManagePricing = (period) => {
            window.consoleManageBillingPeriod = period;
            document.querySelectorAll('#console-manage-toggle-monthly, #console-manage-toggle-yearly').forEach(btn => btn.classList.remove('active'));
            if (period === 'yearly') {
                document.getElementById('console-manage-toggle-yearly')?.classList.add('active');
            } else {
                document.getElementById('console-manage-toggle-monthly')?.classList.add('active');
            }
            
            // Tüm plan kartlarını güncelle
            content.querySelectorAll('.admin-tenant-upgrade-plan-card').forEach(planCard => {
                const planId = planCard.dataset.planId;
                const priceDisplay = planCard.querySelector(`.admin-tenant-plan-price-display[data-plan-id="${planId}"]`);
                const yearlyDisplay = planCard.querySelector(`.admin-tenant-plan-yearly-display[data-plan-id="${planId}"]`);
                
                planCard.dataset.billingPeriod = period;
                
                if (period === 'yearly' && yearlyDisplay) {
                    if (priceDisplay) priceDisplay.style.display = 'none';
                    yearlyDisplay.style.display = 'block';
                } else {
                    if (priceDisplay) priceDisplay.style.display = 'block';
                    if (yearlyDisplay) yearlyDisplay.style.display = 'none';
                }
            });
        };
        
        // Plan kartları
        plans.forEach(plan => {
            const isCurrentPlan = currentPlanId && plan.id == currentPlanId;
            const planCard = document.createElement('div');
            planCard.className = `admin-tenant-upgrade-plan-card${isCurrentPlan ? ' admin-tenant-upgrade-plan-card-current' : ''}`;
            planCard.onmouseenter = () => {
                planCard.classList.add('admin-tenant-upgrade-plan-card-hover');
            };
            planCard.onmouseleave = () => {
                planCard.classList.remove('admin-tenant-upgrade-plan-card-hover');
            };
            
            // Plan kartı için relative position ekle (düzenle butonu için)
            planCard.style.position = 'relative';
            
            planCard.onclick = async (e) => {
                // Düzenle butonuna tıklanırsa plan düzenleme modalını aç
                if (e.target.closest('.admin-tenant-plan-edit-btn')) {
                    e.stopPropagation();
                    await this.openEditPlanModal(plan);
                    return;
                }
                
                // Artık "Planı Değiştir" modunda tüm planları göster, sadece upgrade değil
                if (hasActive) {
                    // Mevcut plan varsa, plan değiştirme işlemi yap (upgrade yerine change)
                    // Toggle'dan gelen billing period'u kullan (her zaman güncel)
                    const billingPeriod = window.consoleManageBillingPeriod || 'monthly';
                    this.changePlan(plan.id, billingPeriod);
                } else {
                    // Toggle'dan gelen billing period'u kullan (her zaman güncel)
                    const billingPeriod = window.consoleManageBillingPeriod || 'monthly';
                    this.selectPlan(plan.id, billingPeriod);
                }
            };
            
            // ✅ Düzenle butonu ekle (sağ üst köşe)
            const editBtn = document.createElement('button');
            editBtn.className = 'admin-tenant-plan-edit-btn';
            editBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
            `;
            editBtn.title = 'Planı Düzenle';
            editBtn.onclick = async (e) => {
                e.stopPropagation();
                await this.openEditPlanModal(plan);
            };
            planCard.appendChild(editBtn);
            
            const planName = document.createElement('h3');
            planName.className = 'admin-tenant-upgrade-plan-name';
            planName.textContent = plan.plan_adi;
            
            const planPrice = document.createElement('div');
            planPrice.className = 'admin-tenant-upgrade-plan-price';
            
            // Aylık ve yıllık ücret gösterimi - Türk Lirası formatında
            const aylikUcretValue = plan.aylik_ucret / 100;
            const yillikUcretValue = plan.yillik_ucret ? (plan.yillik_ucret / 100) : null;
            const aylikAylikUcretValue = yillikUcretValue ? (yillikUcretValue / 12) : null; // Yıllık paketin aylık eşdeğeri
            
            // Türk Lirası formatında göster (1.500,00 TL)
            const formatPrice = (price) => {
                return price.toLocaleString('tr-TR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            };
            
            const aylikFormatted = formatPrice(aylikUcretValue);
            const yillikFormatted = yillikUcretValue ? formatPrice(yillikUcretValue) : null;
            const aylikAylikFormatted = aylikAylikUcretValue ? formatPrice(aylikAylikUcretValue) : null;
            
            // Plan kartına billing period seçimi ekle
            const billingToggleId = `billing-toggle-${plan.id}`;
            planCard.dataset.planId = plan.id;
            
            // Global billing period'u kullan
            const defaultBillingPeriod = window.consoleManageBillingPeriod || (isCurrentPlan ? normalizedCurrentBillingPeriod : 'monthly');
            planCard.dataset.billingPeriod = defaultBillingPeriod;
            
            if (yillikUcretValue) {
                // Hem aylık hem yıllık ücret varsa - toggle butonları kaldırıldı, sadece fiyat gösterimi
                const monthlyDisplayStyle = defaultBillingPeriod === 'monthly' ? 'block' : 'none';
                const yearlyDisplayStyle = defaultBillingPeriod === 'yearly' ? 'block' : 'none';
                
                planPrice.innerHTML = `
                    <div>
                        <div class="admin-tenant-plan-price-display ${monthlyDisplayStyle === 'none' ? 'hidden' : ''}" data-plan-id="${plan.id}">
                            <span class="admin-tenant-plan-price-main">${aylikFormatted} TL</span>
                            <span class="admin-tenant-plan-price-period">/ay</span>
                            <div class="admin-tenant-plan-billing-info">Aylık: ${aylikFormatted} TL olarak faturalandırılır.</div>
                        </div>
                        <div class="admin-tenant-plan-yearly-display ${yearlyDisplayStyle === 'none' ? 'hidden' : ''}" data-plan-id="${plan.id}">
                            <span class="admin-tenant-plan-price-main">${yillikFormatted} TL</span>
                            <span class="admin-tenant-plan-price-period">/yıl</span>
                            <div class="admin-tenant-plan-billing-info">Yıllık ödeme: ${yillikFormatted} ₺ (${aylikAylikFormatted} ₺/ay eşdeğer) | Aylık olarak faturalandırılır</div>
                        </div>
                    </div>
                `;
            } else {
                // Sadece aylık ücret varsa
                planPrice.innerHTML = `
                    <div>
                        <span class="admin-tenant-plan-price-main">${aylikFormatted} TL</span>
                        <span class="admin-tenant-plan-price-period">/ay</span>
                        <div class="admin-tenant-plan-billing-info">Aylık: ${aylikFormatted} TL olarak faturalandırılır.</div>
                    </div>
                `;
            }
            
            const planFeatures = document.createElement('div');
            planFeatures.className = 'admin-tenant-upgrade-plan-features';
            
            let features = [];
            try {
                if (plan.ozellikler) {
                    const parsed = typeof plan.ozellikler === 'string' ? JSON.parse(plan.ozellikler) : plan.ozellikler;
                    features = Array.isArray(parsed) ? parsed : [];
                }
            } catch (e) {
                console.warn('Plan özellikleri parse edilemedi:', e);
            }
            
            if (features.length > 0) {
                features.forEach(feature => {
                    const featureItem = document.createElement('div');
                    featureItem.className = 'admin-tenant-upgrade-plan-feature-item';
                    featureItem.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="admin-tenant-upgrade-plan-feature-icon">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        <span>${feature}</span>
                    `;
                    planFeatures.appendChild(featureItem);
                });
            }
            
            planCard.appendChild(planName);
            planCard.appendChild(planPrice);
            planCard.appendChild(planFeatures);
            content.appendChild(planCard);
        });
        
        const footer = createSheetFooter();
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn-cancel flex-1';
        cancelBtn.textContent = 'İptal';
        cancelBtn.onclick = () => {
            if (this.sheets.upgradePlan && this.sheets.upgradePlan.parentNode) {
                this.sheets.upgradePlan.parentNode.removeChild(this.sheets.upgradePlan);
            }
        };
        footer.appendChild(cancelBtn);
        
        // Modal'ı bul ve içeriği ekle
        const modal = sheet.querySelector('.modal');
        if (modal) {
            modal.appendChild(header);
            modal.appendChild(content);
            modal.appendChild(footer);
        } else {
            console.error('❌ Modal elementi bulunamadı!');
        }
        
        document.body.appendChild(sheet);
        this.sheets.upgradePlan = sheet;
        
        // Sheet'i aç
        requestAnimationFrame(() => {
            sheet.update(true);
        });
    }
    
    /**
     * Plan düzenleme modalını açar
     */
    async openEditPlanModal(plan) {
        const { createSheet, createSheetHeader, createSheetTitle, createSheetDescription, createSheetContent, createSheetFooter, createInput, createLabel, createButton } = window.AdminComponents;
        
        if (!createSheet) {
            console.error('AdminComponents.createSheet not found');
            if (typeof createToast === 'function') {
                createToast('error', 'Sheet component yüklenemedi');
            }
            return;
        }
        
        // Eğer modal zaten açıksa kapat
        if (this.sheets.editPlan && this.sheets.editPlan.parentNode) {
            this.sheets.editPlan.parentNode.removeChild(this.sheets.editPlan);
        }
        
        // Backend'den güncel plan bilgilerini çek (planlar listesinden)
        let currentPlan = plan;
        try {
            const plansResponse = await fetch(`${this.apiBase}/admin/tenants/${this.tenantId}/abonelik/planlar`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (plansResponse.ok) {
                const plansResult = await plansResponse.json();
                const updatedPlans = plansResult.data || [];
                // Güncel planı bul
                const foundPlan = updatedPlans.find(p => p.id === plan.id);
                if (foundPlan) {
                    currentPlan = foundPlan;
                }
            }
        } catch (error) {
            console.warn('Güncel plan bilgileri alınamadı, mevcut plan bilgileri kullanılıyor:', error);
            // Hata olsa bile devam et, mevcut plan bilgilerini kullan
        }
        
        // Form kapatma callback'i için değişken (onClose callback'i içinde kullanılacak)
        let closePlanEditSheetCallback = null;
        
        // Sheet oluştur (onClose callback'i closePlanEditSheetCallback'i çağıracak)
        const sheet = createSheet({
            id: 'edit-plan-sheet',
            side: 'right',
            open: true,
            onClose: () => {
                // onClose callback'i closePlanEditSheetCallback'i çağırır
                if (closePlanEditSheetCallback) {
                    closePlanEditSheetCallback(false);
                }
            }
        });
        
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
        title.textContent = 'Plan Düzenle';
        headerText.appendChild(title);
        const desc = document.createElement('p');
        desc.className = 'modal-description';
        desc.textContent = `${currentPlan.plan_adi} planını düzenleyin.`;
        headerText.appendChild(desc);
        headerContent.appendChild(headerText);
        header.appendChild(headerContent);
        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close';
        closeBtn.innerHTML = '×';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.onclick = () => {
            if (closePlanEditSheetCallback) {
                closePlanEditSheetCallback(false);
            }
        };
        header.appendChild(closeBtn);
        
        const content = createSheetContent({ className: 'sheet-form-spacing-large' });
        const form = document.createElement('form');
        form.id = 'edit-plan-form';
        form.className = '';
        // Form referansını sheet'e ekle (savePlanEdit için)
        form.setAttribute('data-plan-form', 'true');
        
        // Plan Adı
        const planAdiGroup = document.createElement('div');
        planAdiGroup.className = 'form-group';
        const planAdiLabel = createLabel({ for: 'edit-plan-adi', children: 'Plan Adı' });
        const planAdiInput = createInput({
            type: 'text',
            placeholder: 'Örn: Pro Kurumsal',
            value: currentPlan.plan_adi || '',
            required: true
        });
        planAdiInput.id = 'edit-plan-adi';
        planAdiGroup.appendChild(planAdiLabel);
        planAdiGroup.appendChild(planAdiInput);
        form.appendChild(planAdiGroup);
        
        // Plan Kodu
        const planKoduGroup = document.createElement('div');
        planKoduGroup.className = 'form-group';
        const planKoduLabel = createLabel({ for: 'edit-plan-kodu', children: 'Plan Kodu' });
        const planKoduInput = createInput({
            type: 'text',
            placeholder: 'Örn: pro_kurumsal',
            value: currentPlan.plan_kodu || '',
            required: true
        });
        planKoduInput.id = 'edit-plan-kodu';
        planKoduGroup.appendChild(planKoduLabel);
        planKoduGroup.appendChild(planKoduInput);
        form.appendChild(planKoduGroup);
        
        // Aylık Ücret ve Yıllık Ücret (yan yana)
        const ucretGroupRow = document.createElement('div');
        ucretGroupRow.className = 'form-group-row';
        
        // Aylık Ücret (kuruş cinsinden)
        const aylikUcretGroup = document.createElement('div');
        aylikUcretGroup.className = 'form-group';
        const aylikUcretLabel = createLabel({ for: 'edit-plan-aylik-ucret', children: 'Aylık Ücret (₺)' });
        const aylikUcretInput = createInput({
            type: 'number',
            placeholder: 'Örn: 999.99',
            value: currentPlan.aylik_ucret ? (currentPlan.aylik_ucret / 100).toFixed(2) : '',
            required: true
        });
        aylikUcretInput.id = 'edit-plan-aylik-ucret';
        aylikUcretInput.step = '0.01';
        aylikUcretInput.min = '0';
        aylikUcretGroup.appendChild(aylikUcretLabel);
        aylikUcretGroup.appendChild(aylikUcretInput);
        ucretGroupRow.appendChild(aylikUcretGroup);
        
        // Yıllık Ücret (kuruş cinsinden)
        const yillikUcretGroup = document.createElement('div');
        yillikUcretGroup.className = 'form-group';
        const yillikUcretLabel = createLabel({ for: 'edit-plan-yillik-ucret', children: 'Yıllık Ücret (₺)' });
        const yillikUcretInput = createInput({
            type: 'number',
            placeholder: 'Örn: 9999.99',
            value: currentPlan.yillik_ucret ? (currentPlan.yillik_ucret / 100).toFixed(2) : '',
            required: false
        });
        yillikUcretInput.id = 'edit-plan-yillik-ucret';
        yillikUcretInput.step = '0.01';
        yillikUcretInput.min = '0';
        yillikUcretGroup.appendChild(yillikUcretLabel);
        yillikUcretGroup.appendChild(yillikUcretInput);
        ucretGroupRow.appendChild(yillikUcretGroup);
        
        form.appendChild(ucretGroupRow);
        
        // Max Kullanıcı ve Max Depolama (yan yana)
        const maxGroupRow = document.createElement('div');
        maxGroupRow.className = 'form-group-row';
        
        // Max Kullanıcı
        const maxKullaniciGroup = document.createElement('div');
        maxKullaniciGroup.className = 'form-group';
        const maxKullaniciLabel = createLabel({ for: 'edit-plan-max-kullanici', children: 'Maksimum Kullanıcı Sayısı' });
        const maxKullaniciInput = createInput({
            type: 'number',
            placeholder: 'Örn: 50',
            value: currentPlan.max_kullanici || '',
            required: true
        });
        maxKullaniciInput.id = 'edit-plan-max-kullanici';
        maxKullaniciInput.min = '1';
        maxKullaniciGroup.appendChild(maxKullaniciLabel);
        maxKullaniciGroup.appendChild(maxKullaniciInput);
        maxGroupRow.appendChild(maxKullaniciGroup);
        
        // Max Depolama (GB)
        const maxDepolamaGroup = document.createElement('div');
        maxDepolamaGroup.className = 'form-group';
        const maxDepolamaLabel = createLabel({ for: 'edit-plan-max-depolama', children: 'Maksimum Depolama (GB)' });
        const maxDepolamaInput = createInput({
            type: 'number',
            placeholder: 'Örn: 1000',
            value: currentPlan.max_depolama_gb || '',
            required: true
        });
        maxDepolamaInput.id = 'edit-plan-max-depolama';
        maxDepolamaInput.min = '1';
        maxDepolamaGroup.appendChild(maxDepolamaLabel);
        maxDepolamaGroup.appendChild(maxDepolamaInput);
        maxGroupRow.appendChild(maxDepolamaGroup);
        
        form.appendChild(maxGroupRow);
        
        // Özellikler (JSON array)
        const ozelliklerGroup = document.createElement('div');
        ozelliklerGroup.className = 'form-group';
        const ozelliklerLabel = createLabel({ for: 'edit-plan-ozellikler', children: 'Özellikler (Her satıra bir özellik)' });
        const ozelliklerTextarea = document.createElement('textarea');
        ozelliklerTextarea.id = 'edit-plan-ozellikler';
        ozelliklerTextarea.className = 'form-input';
        ozelliklerTextarea.placeholder = 'Örn:\nSınırsız sipariş\n7/24 destek\nÖzel tema';
        ozelliklerTextarea.rows = 12;
        ozelliklerTextarea.style.minHeight = '250px';
        
        // Mevcut özellikleri yükle
        let features = [];
        try {
            if (currentPlan.ozellikler) {
                const parsed = typeof currentPlan.ozellikler === 'string' ? JSON.parse(currentPlan.ozellikler) : currentPlan.ozellikler;
                features = Array.isArray(parsed) ? parsed : [];
            }
        } catch (e) {
            console.warn('Plan özellikleri parse edilemedi:', e);
        }
        ozelliklerTextarea.value = features.join('\n');
        
        ozelliklerGroup.appendChild(ozelliklerLabel);
        ozelliklerGroup.appendChild(ozelliklerTextarea);
        form.appendChild(ozelliklerGroup);
        
        // Plan Durumu (Aktif mi) - Form Switch yapısı
        const aktifMiGroup = document.createElement('div');
        aktifMiGroup.className = 'form-switch-group';
        
        const aktifMiItem = document.createElement('div');
        aktifMiItem.className = 'form-switch-item';
        
        const aktifMiContent = document.createElement('div');
        aktifMiContent.className = 'form-switch-content';
        
        const aktifMiLabel = document.createElement('label');
        aktifMiLabel.htmlFor = 'edit-plan-aktif';
        aktifMiLabel.className = 'form-switch-label';
        aktifMiLabel.textContent = 'Aktif';
        
        const aktifMiDescription = document.createElement('p');
        aktifMiDescription.className = 'form-switch-description';
        aktifMiDescription.textContent = 'Plan aktif olarak görüntülenir';
        
        aktifMiContent.appendChild(aktifMiLabel);
        aktifMiContent.appendChild(aktifMiDescription);
        
        const aktifMiSwitchLabel = document.createElement('label');
        aktifMiSwitchLabel.className = 'form-switch';
        
        const aktifMiInput = document.createElement('input');
        aktifMiInput.id = 'edit-plan-aktif';
        aktifMiInput.type = 'checkbox';
        aktifMiInput.name = 'aktif_mi';
        aktifMiInput.checked = currentPlan.aktif_mi === 1 || currentPlan.aktif_mi === true;
        
        const aktifMiSlider = document.createElement('span');
        aktifMiSlider.className = 'form-switch-slider';
        
        aktifMiSwitchLabel.appendChild(aktifMiInput);
        aktifMiSwitchLabel.appendChild(aktifMiSlider);
        
        aktifMiItem.appendChild(aktifMiContent);
        aktifMiItem.appendChild(aktifMiSwitchLabel);
        aktifMiGroup.appendChild(aktifMiItem);
        form.appendChild(aktifMiGroup);
        
        // Form'u direkt content'e ekle (content zaten modal-body)
        content.appendChild(form);
        
        // Orijinal değerleri sakla (form değişiklik kontrolü için)
        const originalValues = {
            plan_adi: currentPlan.plan_adi || '',
            plan_kodu: currentPlan.plan_kodu || '',
            aylik_ucret: currentPlan.aylik_ucret ? (currentPlan.aylik_ucret / 100).toFixed(2) : '',
            yillik_ucret: currentPlan.yillik_ucret ? (currentPlan.yillik_ucret / 100).toFixed(2) : '',
            max_kullanici: currentPlan.max_kullanici || '',
            max_depolama_gb: currentPlan.max_depolama_gb || '',
            ozellikler: features.join('\n'),
            aktif_mi: currentPlan.aktif_mi === 1 || currentPlan.aktif_mi === true
        };
        
        // Form değişiklik takibi için flag
        let formHasChanges = false;
        
        // Değişiklik kontrolü fonksiyonu
        const checkFormChanges = () => {
            const currentPlanAdi = planAdiInput.value.trim();
            const currentPlanKodu = planKoduInput.value.trim();
            const currentAylikUcret = aylikUcretInput.value.trim();
            const currentYillikUcret = yillikUcretInput.value.trim();
            const currentMaxKullanici = maxKullaniciInput.value.trim();
            const currentMaxDepolama = maxDepolamaInput.value.trim();
            const currentOzellikler = ozelliklerTextarea.value.trim();
            const currentAktifMi = aktifMiInput.checked;
            
            formHasChanges = (
                currentPlanAdi !== originalValues.plan_adi ||
                currentPlanKodu !== originalValues.plan_kodu ||
                currentAylikUcret !== originalValues.aylik_ucret ||
                currentYillikUcret !== originalValues.yillik_ucret ||
                currentMaxKullanici !== String(originalValues.max_kullanici) ||
                currentMaxDepolama !== String(originalValues.max_depolama_gb) ||
                currentOzellikler !== originalValues.ozellikler ||
                currentAktifMi !== originalValues.aktif_mi
            );
        };
        
        // Input değişikliklerini dinle
        const inputs = form.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.addEventListener('input', checkFormChanges);
            input.addEventListener('change', checkFormChanges);
        });
        
        // Form kapatma fonksiyonu (değişiklik kontrolü ile)
        const closePlanEditSheet = (force = false) => {
            // closePlanEditSheetCallback'i güncelle (onClose callback'i için)
            closePlanEditSheetCallback = closePlanEditSheet;
            
            if (!force && formHasChanges) {
                // Değişiklik var, kullanıcıya sor
                if (typeof createToastInteractive === 'function') {
                    createToastInteractive({
                        message: 'Değişiklikleri kaydetmek istiyor musunuz?',
                        confirmText: 'Kaydet',
                        cancelText: 'Vazgeç',
                        onConfirm: async () => {
                            // Formu kaydet
                            await this.savePlanEdit(currentPlan.id);
                        },
                        onCancel: () => {
                            // Değişiklikleri sıfırla ve kapat
                            planAdiInput.value = originalValues.plan_adi;
                            planKoduInput.value = originalValues.plan_kodu;
                            aylikUcretInput.value = originalValues.aylik_ucret;
                            yillikUcretInput.value = originalValues.yillik_ucret;
                            maxKullaniciInput.value = originalValues.max_kullanici;
                            maxDepolamaInput.value = originalValues.max_depolama_gb;
                            ozelliklerTextarea.value = originalValues.ozellikler;
                            aktifMiInput.checked = originalValues.aktif_mi;
                            formHasChanges = false;
                            if (this.sheets.editPlan && this.sheets.editPlan.parentNode) {
                                this.sheets.editPlan.parentNode.removeChild(this.sheets.editPlan);
                            }
                        }
                    });
                } else {
                    // Fallback: eğer createToastInteractive yoksa direkt kapat
                    if (this.sheets.editPlan && this.sheets.editPlan.parentNode) {
                        this.sheets.editPlan.parentNode.removeChild(this.sheets.editPlan);
                    }
                }
            } else {
                // Değişiklik yok, direkt kapat
                if (this.sheets.editPlan && this.sheets.editPlan.parentNode) {
                    this.sheets.editPlan.parentNode.removeChild(this.sheets.editPlan);
                }
            }
        };
        
        const footer = createSheetFooter();
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn-cancel flex-1';
        cancelBtn.textContent = 'İptal';
        cancelBtn.onclick = () => {
            closePlanEditSheet(false);
        };
        footer.appendChild(cancelBtn);
        
        const saveBtn = document.createElement('button');
        saveBtn.type = 'submit';
        saveBtn.className = 'btn-save flex-1';
        saveBtn.textContent = 'Kaydet';
        footer.appendChild(saveBtn);
        
        // Modal'ı bul ve içeriği ekle
        const modal = sheet.querySelector('.modal');
        if (modal) {
            modal.appendChild(header);
            modal.appendChild(content);
            modal.appendChild(footer);
        } else {
            console.error('❌ Modal elementi bulunamadı!');
        }
        
        document.body.appendChild(sheet);
        this.sheets.editPlan = sheet;
        
        // Form referansını sakla (savePlanEdit için)
        this._editPlanForm = form;
        this._editPlanFormContent = content;
        
        // closePlanEditSheet fonksiyonunu instance'a kaydet (savePlanEdit için)
        this._closePlanEditSheet = closePlanEditSheet;
        
        // closePlanEditSheetCallback'i güncelle (onClose callback'i artık çalışacak)
        closePlanEditSheetCallback = closePlanEditSheet;
        
        // Form submit event
        form.onsubmit = async (e) => {
            e.preventDefault();
            await this.savePlanEdit(currentPlan.id);
        };
        
        // Save button click event
        saveBtn.onclick = async (e) => {
            e.preventDefault();
            await this.savePlanEdit(currentPlan.id);
        };
    }
    
    /**
     * Plan düzenleme kaydetme
     */
    async savePlanEdit(planId) {
        try {
            // Form referansını kullan (eğer varsa)
            let form = this._editPlanForm;
            let content = this._editPlanFormContent;
            
            // Eğer referans yoksa, sheet içinde ara
            if (!form || !content) {
                const sheet = this.sheets.editPlan;
                if (!sheet) {
                    throw new Error('Plan düzenleme modalı bulunamadı');
                }
                
                // Sheet DOM'a eklenmemişse ekle
                if (!sheet.parentNode) {
                    document.body.appendChild(sheet);
                }
                
                // Modal'ı bul
                const modal = sheet.querySelector('.modal');
                if (!modal) {
                    throw new Error('Modal elementi bulunamadı');
                }
                
                // Form'u bul
                form = modal.querySelector('#edit-plan-form');
                if (!form) {
                    throw new Error('Form bulunamadı');
                }
                
                // Content'i form'un parent'ı olarak al
                content = form.parentElement;
            }
            
            // Form elementlerini form içinde ara
            const planAdiEl = form.querySelector('#edit-plan-adi');
            const planKoduEl = form.querySelector('#edit-plan-kodu');
            const aylikUcretEl = form.querySelector('#edit-plan-aylik-ucret');
            const yillikUcretEl = form.querySelector('#edit-plan-yillik-ucret');
            const maxKullaniciEl = form.querySelector('#edit-plan-max-kullanici');
            const maxDepolamaEl = form.querySelector('#edit-plan-max-depolama');
            const ozelliklerEl = form.querySelector('#edit-plan-ozellikler');
            const aktifMiEl = form.querySelector('#edit-plan-aktif');
            
            if (!planAdiEl || !planKoduEl || !aylikUcretEl || !maxKullaniciEl || !maxDepolamaEl || !ozelliklerEl || !aktifMiEl) {
                console.error('Form alanları bulunamadı:', {
                    planAdiEl: !!planAdiEl,
                    planKoduEl: !!planKoduEl,
                    aylikUcretEl: !!aylikUcretEl,
                    yillikUcretEl: !!yillikUcretEl,
                    maxKullaniciEl: !!maxKullaniciEl,
                    maxDepolamaEl: !!maxDepolamaEl,
                    ozelliklerEl: !!ozelliklerEl,
                    aktifMiEl: !!aktifMiEl,
                    form: !!form,
                    formHTML: form ? form.innerHTML.substring(0, 300) : 'null'
                });
                throw new Error('Form alanları bulunamadı');
            }
            
            const planAdi = planAdiEl.value.trim();
            const planKodu = planKoduEl.value.trim();
            const aylikUcret = parseFloat(aylikUcretEl.value);
            const yillikUcret = yillikUcretEl.value.trim() ? parseFloat(yillikUcretEl.value) : null;
            const maxKullanici = parseInt(maxKullaniciEl.value);
            const maxDepolama = parseInt(maxDepolamaEl.value);
            const ozelliklerText = ozelliklerEl.value.trim();
            const aktifMi = aktifMiEl.checked;
            
            // Validasyon
            if (!planAdi || !planKodu) {
                throw new Error('Plan adı ve plan kodu zorunludur');
            }
            
            if (isNaN(aylikUcret) || aylikUcret < 0) {
                throw new Error('Geçerli bir aylık ücret giriniz');
            }
            
            if (yillikUcret !== null && (isNaN(yillikUcret) || yillikUcret < 0)) {
                throw new Error('Geçerli bir yıllık ücret giriniz');
            }
            
            if (isNaN(maxKullanici) || maxKullanici < 1) {
                throw new Error('Geçerli bir maksimum kullanıcı sayısı giriniz');
            }
            
            if (isNaN(maxDepolama) || maxDepolama < 1) {
                throw new Error('Geçerli bir maksimum depolama giriniz');
            }
            
            // Özellikleri array'e çevir
            const ozellikler = ozelliklerText ? ozelliklerText.split('\n').filter(f => f.trim()).map(f => f.trim()) : [];
            
            // Aylık ve yıllık ücreti kuruş cinsine çevir
            const aylikUcretKurus = Math.round(aylikUcret * 100);
            const yillikUcretKurus = yillikUcret !== null ? Math.round(yillikUcret * 100) : null;
            
            const response = await fetch(`${this.apiBase}/admin/plans/${planId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.adminToken}`
                },
                body: JSON.stringify({
                    plan_adi: planAdi,
                    plan_kodu: planKodu,
                    aylik_ucret: aylikUcretKurus,
                    yillik_ucret: yillikUcretKurus,
                    max_kullanici: maxKullanici,
                    max_depolama_gb: maxDepolama,
                    ozellikler: ozellikler,
                    aktif_mi: aktifMi
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                if (typeof createToast === 'function') {
                    createToast('success', 'Plan başarıyla güncellendi');
                }
                
                // Modal'ı kapat (force close - kayıt başarılı olduğu için)
                if (this._closePlanEditSheet) {
                    this._closePlanEditSheet(true);
                } else if (this.sheets.editPlan && this.sheets.editPlan.parentNode) {
                    this.sheets.editPlan.parentNode.removeChild(this.sheets.editPlan);
                }
                
                // Plan listesini backend'den yeniden yükle ve upgrade plan sheet'i güncelle
                if (this.sheets.upgradePlan && this.sheets.upgradePlan.parentNode) {
                    try {
                        // Backend'den güncel planları çek
                        const plansResponse = await fetch(`${this.apiBase}/admin/tenants/${this.tenantId}/abonelik/planlar`, {
                            headers: {
                                'Authorization': `Bearer ${this.adminToken}`,
                                'Content-Type': 'application/json'
                            },
                            credentials: 'include'
                        });
                        
                        if (plansResponse.ok) {
                            const plansResult = await plansResponse.json();
                            const updatedPlans = plansResult.data || [];
                            
                            // Eski sheet'i kapat
                            if (this.sheets.upgradePlan.parentNode) {
                                this.sheets.upgradePlan.parentNode.removeChild(this.sheets.upgradePlan);
                            }
                            
                            // Yeni planlarla sheet'i yeniden oluştur
                            const hasActive = this.tenant && this.tenant.abonelik && this.tenant.abonelik.durum === 'aktif';
                            if (hasActive) {
                                await this.createUpgradePlanSheet(updatedPlans, 'Planı Değiştir', 'Mevcut planınızı değiştirin. Tüm planları görüntüleyebilir ve istediğiniz plana geçebilirsiniz.');
                            } else {
                                await this.createUpgradePlanSheet(updatedPlans, 'Plan Tanımla', 'Size uygun bir plan tanımlayın ve abone olun.');
                            }
                            
                            // Yeni sheet'i aç
                            if (this.sheets.upgradePlan) {
                                document.body.appendChild(this.sheets.upgradePlan);
                                requestAnimationFrame(() => {
                                    if (this.sheets.upgradePlan) {
                                        this.sheets.upgradePlan.update(true);
                                    }
                                });
                            }
                        }
                    } catch (error) {
                        console.error('Plan listesi yenilenirken hata:', error);
                        // Hata olsa bile sheet'i güncellemeyi dene
                        if (this.sheets.upgradePlan && this.sheets.upgradePlan.parentNode) {
                            this.sheets.upgradePlan.update(true);
                        }
                    }
                }
                
                // Kısa bir bekleme (backend'in güncellemesi için)
                await new Promise(resolve => setTimeout(resolve, 200));
                
                // Abonelik verilerini yeniden yükle (güncellenmiş plan bilgileri dahil)
                await this.loadAbonelikData();
                
                // Sayfadaki tenant bilgilerini yenile (plan bilgileri dahil)
                await this.loadTenant();
                
                // Billing sekmesini yeniden render et (plan bilgileri güncellensin)
                this.renderBillingTab();
            } else {
                throw new Error(result.error || result.message || 'Plan güncellenemedi');
            }
        } catch (error) {
            console.error('Plan güncellenirken hata:', error);
            if (typeof createToast === 'function') {
                createToast('error', error.message || 'Plan güncellenemedi');
            }
        }
    }
    
    async changePlan(planId, billingPeriod = 'monthly') {
        // Plan bilgisini al
        let planName = 'Seçilen Plan';
        let planPrice = '';
        
        try {
            const plansResponse = await fetch(`${this.apiBase}/admin/tenants/${this.tenantId}/abonelik/planlar`, {
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (plansResponse.ok) {
                const plansResult = await plansResponse.json();
                if (plansResult.success && plansResult.data) {
                    const selectedPlan = plansResult.data.find(p => p.id == planId);
                    if (selectedPlan) {
                        planName = selectedPlan.plan_adi || planName;
                        
                        // Fiyat bilgisini hesapla
                        if (billingPeriod === 'yearly' && selectedPlan.yillik_ucret) {
                            // Yıllık paket: Yıllık fiyatın aylık eşdeğeri
                            const yillikUcretValue = selectedPlan.yillik_ucret / 100;
                            const aylikEsdeger = yillikUcretValue / 12;
                            const yillikToplam = yillikUcretValue;
                            planPrice = `${aylikEsdeger.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL/ay (Yıllık ödeme: ${yillikToplam.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL/yıl)`;
                        } else if (selectedPlan.aylik_ucret) {
                            // Aylık paket
                            const aylikUcretValue = selectedPlan.aylik_ucret / 100;
                            planPrice = `${aylikUcretValue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL/ay`;
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Plan bilgisi yüklenemedi:', error);
        }
        
        // upgradeToPlan yerine changePlan kullan - aynı mantık ama isim değişti
        if (typeof createToastInteractive === 'function') {
            const message = `Tenant abonelik planını değiştirmek istediğinizden emin misiniz?\n\n` +
                          `Plan: ${planName}\n` +
                          `${planPrice ? `Fiyat: ${planPrice}\n` : ''}` +
                          `\nPlan değişikliği hemen geçerli olacaktır.`;
            
            createToastInteractive({
                title: 'Planı Değiştir',
                message: message,
                confirmText: 'Evet, Değiştir',
                cancelText: 'İptal',
                onConfirm: async () => {
                    await this.performUpgrade(planId, billingPeriod);
                },
                onCancel: () => {
                    if (typeof createToast === 'function') {
                        createToast('info', 'Plan değiştirme iptal edildi');
                    }
                }
            });
        } else {
            // Fallback
            const message = `Tenant abonelik planını değiştirmek istediğinizden emin misiniz?\n\nPlan: ${planName}\n${planPrice ? `Fiyat: ${planPrice}\n` : ''}\nPlan değişikliği hemen geçerli olacaktır.`;
            if (!confirm(message)) {
                return;
            }
            await this.performUpgrade(planId, billingPeriod);
        }
    }
    
    async upgradeToPlan(planId) {
        // Geriye uyumluluk için - changePlan'i çağır
        await this.changePlan(planId);
    }
    
    async performUpgrade(planId, billingPeriod = 'monthly') {
        try {
            console.log('🔍 [CONSOLE MANAGE FRONTEND] performUpgrade çağrıldı:', {
                planId,
                billingPeriod,
                tenantId: this.tenantId,
                apiBase: this.apiBase
            });
            
            // Sheet'i hemen kapat (kullanıcı beklemesin)
            if (this.sheets.upgradePlan && this.sheets.upgradePlan.parentNode) {
                this.sheets.upgradePlan.parentNode.removeChild(this.sheets.upgradePlan);
            }
            
            // Loading toast göster
            if (typeof createToast === 'function') {
                createToast('info', 'Plan değiştiriliyor ve faturanız oluşturuluyor, lütfen bekleyin...');
            }
            
            const requestBody = { plan_id: planId, billing_period: billingPeriod };
            console.log('🔍 [CONSOLE MANAGE FRONTEND] İstek gönderiliyor:', {
                url: `${this.apiBase}/admin/tenants/${this.tenantId}/abonelik/upgrade`,
                method: 'POST',
                body: requestBody
            });
            
            const response = await fetch(`${this.apiBase}/admin/tenants/${this.tenantId}/abonelik/upgrade`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(requestBody)
            });
            
            console.log('🔍 [CONSOLE MANAGE FRONTEND] Response alındı:', {
                status: response.status,
                ok: response.ok
            });
            
            const result = await response.json();
            console.log('🔍 [CONSOLE MANAGE FRONTEND] Response data:', result);
            
            if (response.ok && result.success) {
                if (typeof createToast === 'function') {
                    createToast('success', 'Plan başarıyla değiştirildi');
                }
                
                // Verileri yeniden yükle (paralel olarak)
                await Promise.all([
                    this.loadAbonelikData(),
                    this.loadFaturalar() // Fatura listesini de yenile
                ]);
                
                this.renderBillingTab();
                
                // Billing period bilgisini al (fatura_dongusu'ndan)
                const faturaDongusu = this.abonelik?.fatura_dongusu || 'aylik';
                const billingPeriodText = faturaDongusu === 'yillik' || faturaDongusu === 'yearly' ? 'yearly' : 'monthly';
                
                // Dashboard'ı güncelle - BroadcastChannel ile
                if (this.notificationChannel) {
                    this.notificationChannel.postMessage({
                        type: 'subscription-updated',
                        tenantId: this.tenantId,
                        planId: planId,
                        planName: result.data?.plan_name || result.data?.plan_adi || this.abonelik?.plan_adi,
                        billingPeriod: billingPeriodText,
                        faturaDongusu: faturaDongusu
                    });
                }
                
                // localStorage'ı da güncelle (dashboard için)
                try {
                    const subscriptionData = {
                        plan_id: planId,
                        plan_name: result.data?.plan_name || result.data?.plan_adi || this.abonelik?.plan_adi,
                        billing_period: billingPeriodText,
                        fatura_dongusu: faturaDongusu,
                        updated_at: new Date().toISOString()
                    };
                    localStorage.setItem('last_subscription_update', JSON.stringify(subscriptionData));
                } catch (e) {
                    console.warn('localStorage güncellenemedi:', e);
                }
            } else {
                throw new Error(result.error || 'Plan yükseltilemedi');
            }
        } catch (error) {
            console.error('❌ Plan yükseltilirken hata:', error);
            if (typeof createToast === 'function') {
                createToast('error', error.message || 'Plan yükseltilemedi');
            }
        }
    }
    
    showCancelSubscriptionSheet() {
        if (typeof createToastInteractive !== 'function') {
            // Fallback: Eğer createToastInteractive yoksa eski yöntemi kullan
            if (!confirm('Aboneliği iptal etmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
                return;
            }
            if (!confirm('Aboneliğiniz iptal edilecek. Devam etmek istiyor musunuz?')) {
                return;
            }
            this.cancelSubscription();
            return;
        }
        
        createToastInteractive({
            title: 'Aboneliği İptal Et',
            message: `
                <div class="admin-tenant-cancel-dialog-content">
                    <p class="admin-tenant-cancel-dialog-paragraph"><strong>Aboneliğiniz iptal edilecek.</strong></p>
                    <p class="admin-tenant-cancel-dialog-paragraph-subtitle">Bu işlem sonrasında:</p>
                    <ul class="admin-tenant-cancel-dialog-list">
                        <li>Mevcut dönem sonuna kadar hizmetleriniz devam edecek</li>
                        <li>Sonraki dönem için otomatik yenileme durdurulacak</li>
                        <li>Verileriniz korunacak ancak yeni özellikler kullanılamayacak</li>
                        <li>İstediğiniz zaman tekrar abone olabilirsiniz</li>
                    </ul>
                    <p class="admin-tenant-cancel-dialog-warning">Bu işlem geri alınamaz. Devam etmek istiyor musunuz?</p>
                </div>
            `,
            confirmText: 'Evet, İptal Et',
            cancelText: 'Vazgeç',
            isWarning: true,
            confirmButtonClass: 'toast-btn-danger',
            onConfirm: () => {
                this.cancelSubscription();
            },
            onCancel: () => {
                if (typeof createToast === 'function') {
                    createToast('info', 'İptal işlemi iptal edildi');
                }
            }
        });
    }
    
    async cancelSubscription() {
        try {
            const response = await fetch(`${this.apiBase}/admin/tenants/${this.tenantId}/abonelik/cancel`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                if (typeof createToast === 'function') {
                    createToast('success', 'Abonelik başarıyla iptal edildi');
                }
                
                // Verileri yeniden yükle
                await this.loadAbonelikData();
                // Abonelik iptal edildiğinde null olacak, bu yüzden renderBillingTab'ı çağır
                this.renderBillingTab();
            } else {
                throw new Error(result.error || 'Abonelik iptal edilemedi');
            }
        } catch (error) {
            console.error('❌ Abonelik iptal edilirken hata:', error);
            if (typeof createToast === 'function') {
                createToast('error', error.message || 'Abonelik iptal edilemedi');
            }
        }
    }
    
    async downloadInvoice(invoiceId) {
        // Dashboard'daki mantıkla fatura indirme
        const invoice = this.invoices.find(inv => inv.fatura_no === invoiceId || inv.id == invoiceId);
        if (!invoice) {
            if (typeof createToast === 'function') {
                createToast('error', 'Fatura bulunamadı');
            }
            return;
        }
        
        const faturaNo = invoice.fatura_no || invoiceId;
        const tenantCode = this.tenant?.tenants_no;
        
        if (!faturaNo || !tenantCode) {
            if (typeof createToast === 'function') {
                createToast('error', 'Fatura bilgileri eksik');
            }
            return;
        }
        
        // Toast göster (indirme başladı)
        if (typeof createToast === 'function') {
            createToast('info', 'Fatura indiriliyor...');
        }
        
        // API base kullan (console farklı portta olsa bile backend'e istek gitsin)
        const baseForDownload = this.apiBase
            || (typeof window !== 'undefined' && window.location && window.location.origin ? window.location.origin + '/api' : null);
        const downloadUrl = `${baseForDownload}/public/invoice/${faturaNo}/pdf?tenant_code=${encodeURIComponent(tenantCode)}`;
        
        // Yeni sekmede aç veya direkt indir (Dashboard'daki mantık)
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `fatura-${faturaNo}.html`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Başarı mesajı
        setTimeout(() => {
        if (typeof createToast === 'function') {
                createToast('success', 'Fatura başarıyla indirildi');
        }
        }, 500);
    }
    
    async downloadAllInvoices() {
        if (!this.invoices || this.invoices.length === 0) {
            if (typeof createToast === 'function') {
                createToast('warning', 'İndirilecek fatura bulunamadı');
            }
            return;
        }
        
        try {
            // Toast göster (indirme başladı)
            if (typeof createToast === 'function') {
                createToast('info', 'Tüm faturalar zip olarak hazırlanıyor...');
            }
            
            // Backend'deki zip endpoint'ini kullan - tenant'ın TÜM faturalarını zip'e paketler
            const downloadUrl = `${this.apiBase}/admin/tenants/${this.tenantId}/faturalar/zip`;
            console.log('📥 Zip indirme URL:', downloadUrl);
            console.log('📋 Listelenen faturalar:', this.invoices.length, 'adet');
            
            // GET isteği gönder - backend tenant'ın tüm faturalarını zip'e paketler
            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Bilinmeyen hata' }));
                throw new Error(errorData.error || errorData.details || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            // Zip dosyasını blob olarak al
            const blob = await response.blob();
            
            // Zip'i indir
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `faturalar-${this.tenantId}.zip`;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // URL'i temizle
            window.URL.revokeObjectURL(url);
            
            // Başarı mesajı
            if (typeof createToast === 'function') {
                createToast('success', 'Tüm faturalar başarıyla indirildi');
            }
        } catch (error) {
            console.error('❌ Tüm faturalar indirilirken hata:', error);
            if (typeof createToast === 'function') {
                createToast('error', `Faturalar indirilemedi: ${error.message}`);
            }
        }
    }
    
    logout() {
        localStorage.removeItem('admin_user');
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user_id');
        localStorage.removeItem('admin_remember_me');
        localStorage.removeItem('admin_remembered_username');
        localStorage.removeItem('admin_remembered_password');
        window.location.href = '/console-login';
    }
    
    async showTenantEditModal() {
        const modal = document.getElementById('modal-tenant-edit-overlay');
        if (!modal) {
            console.error('Tenant edit modal not found');
            return;
        }
        // Düzenle açılmadan önce güncel tenant verisini çek (e-posta/telefon dahil)
        try {
            await this.loadTenant();
        } catch (e) {
            if (typeof createToast === 'function') createToast('error', 'Tenant bilgileri yenilenemedi');
            return;
        }
        if (!this.tenant) {
            if (typeof createToast === 'function') createToast('error', 'Tenant bilgileri yüklenemedi');
            return;
        }
        // Populate form with current tenant data
        const nameInput = document.getElementById('tenant-edit-name');
        const emailInput = document.getElementById('tenant-edit-email');
        const phoneInput = document.getElementById('tenant-edit-phone');
        const citySelect = document.getElementById('tenant-edit-city');
        const stateSelect = document.getElementById('tenant-edit-state');
        
        // Temel alanları doldur
        if (nameInput) {
            nameInput.value = this.tenant.name || '';
        }
        if (emailInput) {
            emailInput.value = this.tenant.email || '';
        }
        
        // ✅ Telefon inputunu formatla - YENİ TENANT EKLE FORMUNDAKİ GİBİ BASİT YAP
        if (phoneInput) {
            // Önce mevcut formatlama attribute'larını temizle
            phoneInput.removeAttribute('data-phone-formatted');
            phoneInput.removeAttribute('data-telefon-mask-applied');
            phoneInput.removeAttribute('data-tr-phone-mask');
            phoneInput.removeAttribute('data-phone-validation-added');
            // ✅ Validation state'ini de temizle (her açılışta fresh validation için)
            phoneInput.setCustomValidity('');
            phoneInput.classList.remove('input-error');
            
            // Veritabanından telefon numarası geliyor (E.164 formatında: 90XXXXXXXXXX veya +90XXXXXXXXXX)
            let phoneValue = this.tenant.phone || '';
            
            // Display formatına çevir (+90 (5xx) xxx xx xx) - formatPhoneNumber fonksiyonunu kullan
            if (phoneValue && phoneValue.trim() !== '') {
                // formatPhoneNumber fonksiyonunu kullan (doğru formatlama için)
                if (typeof window.formatPhoneNumber === 'function') {
                    phoneValue = window.formatPhoneNumber(phoneValue);
                } else {
                    // Fallback: Manuel formatlama
                    const digits = phoneValue.replace(/\D/g, '');
                    if (digits.length === 12 && digits.startsWith('90')) {
                        const phoneDigits = digits.substring(2);
                        if (phoneDigits.length === 10) {
                            phoneValue = `+90 (${phoneDigits.substring(0, 3)}) ${phoneDigits.substring(3, 6)} ${phoneDigits.substring(6, 8)} ${phoneDigits.substring(8, 10)}`;
                        } else {
                            phoneValue = '+90 (';
                        }
                    } else if (digits.length === 10) {
                        phoneValue = `+90 (${digits.substring(0, 3)}) ${digits.substring(3, 6)} ${digits.substring(6, 8)} ${digits.substring(8, 10)}`;
                    } else {
                        phoneValue = '+90 (';
                    }
                }
            } else {
                phoneValue = '+90 (';
            }
            
            // Değeri set et
            phoneInput.value = phoneValue;
            
            // ✅ YENİ TENANT EKLE FORMUNDAKİ GİBİ - Sadece setupPhoneInput kullan
            if (typeof window.setupPhoneInput === 'function') {
                window.setupPhoneInput(phoneInput);
            } else if (typeof attachTRPhoneMask === 'function') {
                attachTRPhoneMask(phoneInput);
            }
        }
        
        // freshPhoneInput referansını phoneInput olarak güncelle (form kontrolü için)
        const freshPhoneInput = phoneInput;
        
        // Form kontrolü için orijinal değerleri sakla
        const originalValues = {
            name: this.tenant.name || '',
            email: this.tenant.email || '',
            phone: this.tenant.phone || '',
            city: this.tenant.city || '',
            state: this.tenant.state || ''
        };
        
        const form = document.getElementById('tenant-edit-form');
        if (form) {
            form.dataset.originalValues = JSON.stringify(originalValues);
            
            // Form değişiklik takibi için flag
            let formHasChanges = false;
            
            // Değişiklik kontrolü fonksiyonu
            const checkFormChanges = () => {
                const currentName = nameInput ? nameInput.value.trim() : '';
                const currentEmail = emailInput ? emailInput.value.trim() : '';
                const currentPhone = freshPhoneInput ? freshPhoneInput.value.trim() : '';
                const currentCity = citySelect ? citySelect.value : '';
                const currentState = stateSelect ? stateSelect.value : '';
                
                // Telefon numarasını E.164 formatına çevir ve karşılaştır
                let currentPhoneE164 = '';
                if (currentPhone && currentPhone !== '+90 (' && currentPhone.trim() !== '' && currentPhone.trim() !== '+90') {
                    const digits = currentPhone.replace(/\D/g, '');
                    if (digits.length >= 10) {
                        if (digits.length === 12 && digits.startsWith('90')) {
                            currentPhoneE164 = digits;
                        } else if (digits.length === 10) {
                            currentPhoneE164 = '90' + digits;
                        } else if (digits.length === 11 && digits.startsWith('0')) {
                            currentPhoneE164 = '90' + digits.substring(1);
                        } else if (digits.length >= 10) {
                            const last10 = digits.substring(digits.length - 10);
                            if (last10.length === 10) {
                                currentPhoneE164 = '90' + last10;
                            }
                        }
                    }
                }
                
                formHasChanges = (
                    currentName !== originalValues.name ||
                    currentEmail !== originalValues.email ||
                    currentPhoneE164 !== originalValues.phone ||
                    currentCity !== originalValues.city ||
                    currentState !== originalValues.state
                );
            };
            
            // Input değişikliklerini dinle
            if (nameInput) {
                nameInput.addEventListener('input', checkFormChanges);
                nameInput.addEventListener('change', checkFormChanges);
            }
            if (emailInput) {
                emailInput.addEventListener('input', checkFormChanges);
                emailInput.addEventListener('change', checkFormChanges);
            }
            if (freshPhoneInput) {
                freshPhoneInput.addEventListener('input', checkFormChanges);
                freshPhoneInput.addEventListener('change', checkFormChanges);
            }
            if (citySelect) {
                citySelect.addEventListener('change', checkFormChanges);
            }
            if (stateSelect) {
                stateSelect.addEventListener('change', checkFormChanges);
            }
            
            // Form kapatma fonksiyonunu güncelle
            this.closeTenantEditModalWithCheck = (force = false) => {
                if (!force && formHasChanges) {
                    // Değişiklik var, kullanıcıya sor
                    if (typeof createToastInteractive === 'function') {
                        createToastInteractive({
                            message: 'Değişiklikleri kaydetmek istiyor musunuz?',
                            confirmText: 'Kaydet',
                            cancelText: 'Vazgeç',
                            onConfirm: async () => {
                                // Formu kaydet
                                this.saveTenantEdit();
                            },
                            onCancel: () => {
                                // Değişiklikleri sıfırla ve kapat
                                if (nameInput) nameInput.value = originalValues.name;
                                if (emailInput) emailInput.value = originalValues.email;
                                if (freshPhoneInput) {
                                    // Telefon değerini formatlanmış haliyle set et
                                    let phoneValue = originalValues.phone || '';
                                    if (phoneValue && phoneValue.trim() !== '') {
                                        if (typeof window.formatPhoneNumber === 'function') {
                                            phoneValue = window.formatPhoneNumber(phoneValue);
                                        } else {
                                            // Fallback: Manuel formatlama
                                            const digits = phoneValue.replace(/\D/g, '');
                                            if (digits.length === 12 && digits.startsWith('90')) {
                                                const phoneDigits = digits.substring(2);
                                                if (phoneDigits.length === 10) {
                                                    phoneValue = `+90 (${phoneDigits.substring(0, 3)}) ${phoneDigits.substring(3, 6)} ${phoneDigits.substring(6, 8)} ${phoneDigits.substring(8, 10)}`;
                                                } else {
                                                    phoneValue = '+90 (';
                                                }
                                            } else if (digits.length === 10) {
                                                phoneValue = `+90 (${digits.substring(0, 3)}) ${digits.substring(3, 6)} ${digits.substring(6, 8)} ${digits.substring(8, 10)}`;
                                            } else {
                                                phoneValue = '+90 (';
                                            }
                                        }
                                    } else {
                                        phoneValue = '+90 (';
                                    }
                                    freshPhoneInput.value = phoneValue;
                                    // ✅ Console sayfaları için telefon input maskesi uygula - diğer formlardaki gibi
                                    freshPhoneInput.removeAttribute('data-phone-formatted');
                                    freshPhoneInput.removeAttribute('data-telefon-formatted');
                                    freshPhoneInput.removeAttribute('pattern');
                                    freshPhoneInput.removeAttribute('title');
                                    freshPhoneInput.classList.remove('input-error');
                                    if (typeof window.setupConsolePhoneInput === 'function') {
                                        window.setupConsolePhoneInput(freshPhoneInput);
                                    } else if (!freshPhoneInput.value || freshPhoneInput.value.trim() === '' || freshPhoneInput.value === '+90') {
                                        freshPhoneInput.value = '+90 (';
                                    }
                                }
                                if (citySelect) citySelect.value = originalValues.city;
                                if (stateSelect) stateSelect.value = originalValues.state;
                                formHasChanges = false;
                                this.closeTenantEditModal();
                            }
                        });
                    } else {
                        // Fallback: direkt kapat
                        this.closeTenantEditModal();
                    }
                } else {
                    // Değişiklik yok veya zorla kapat
                    this.closeTenantEditModal();
                }
            };
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
        
        // İl ve İlçe alanlarını doldur
        if (citySelect) {
            // Önceki event listener'ları temizle
            const newCitySelect = citySelect.cloneNode(true);
            citySelect.parentNode.replaceChild(newCitySelect, citySelect);
            
            // Location data kontrolü
            if (window.__TR_ADDR__ && window.__TR_ADDR__.provinces) {
                // İl select'ini doldur
                newCitySelect.innerHTML = '<option value="">İl Seçiniz</option>';
                window.__TR_ADDR__.provinces.forEach(province => {
                    const option = document.createElement('option');
                    option.value = province.name;
                    option.textContent = province.name;
                    newCitySelect.appendChild(option);
                });
                
                // Seçili değeri set et ve ilçe listesini yükle
                if (this.tenant && this.tenant.city) {
                    newCitySelect.value = this.tenant.city;
                    
                    // İlçe listesini yükle - güncel stateSelect referansını kullan
                    const currentStateSelect = document.getElementById('tenant-edit-state');
                    if (currentStateSelect) {
                        this.loadDistrictsForCity(this.tenant.city, currentStateSelect, this.tenant.state);
                    }
                }
                
                // İl değiştiğinde ilçe listesini güncelle
                newCitySelect.addEventListener('change', (e) => {
                    const selectedCity = e.target.value;
                    const currentStateSelect = document.getElementById('tenant-edit-state');
                    if (currentStateSelect) {
                        this.loadDistrictsForCity(selectedCity, currentStateSelect);
                    }
                });
            } else {
                // Location data henüz yüklenmemişse
                newCitySelect.innerHTML = '<option value="">Yükleniyor...</option>';
                
                // Bir süre sonra tekrar dene
                const checkLocationData = setInterval(() => {
                    if (window.__TR_ADDR__ && window.__TR_ADDR__.provinces) {
                        clearInterval(checkLocationData);
                        // Sadece il/ilçe alanlarını doldur
                        const currentCitySelect = document.getElementById('tenant-edit-city');
                        const currentStateSelect = document.getElementById('tenant-edit-state');
                        if (currentCitySelect) {
                            if (currentStateSelect) {
                                this.populateCityStateFields(currentCitySelect, currentStateSelect);
                            } else {
                                // Sadece city select'i doldur
                                this.populateCityStateFields(currentCitySelect, null);
                            }
                        }
                    }
                }, 500);
                
                // 10 saniye sonra timeout
                setTimeout(() => {
                    clearInterval(checkLocationData);
                    if (!window.__TR_ADDR__ || !window.__TR_ADDR__.provinces) {
                        newCitySelect.innerHTML = '<option value="">Veri yüklenemedi</option>';
                        console.warn('⚠️ Location data yüklenemedi');
                    }
                }, 10000);
            }
        }
        
        modal.classList.add('active');
        // Modal açılırken html ve body overflow'u hemen engelle (yatay scroll çıkmasın)
        document.documentElement.style.overflowX = 'hidden';
        document.body.style.overflow = 'hidden';
        document.body.style.overflowX = 'hidden';
        document.body.style.overflowY = 'hidden';
    }
    
    populateCityStateFields(citySelect, stateSelect) {
        if (!citySelect || !window.__TR_ADDR__ || !window.__TR_ADDR__.provinces) {
            return;
        }
        
        // Önceki event listener'ları temizle
        const newCitySelect = citySelect.cloneNode(true);
        citySelect.parentNode.replaceChild(newCitySelect, citySelect);
        
        // İl select'ini doldur
        newCitySelect.innerHTML = '<option value="">İl Seçiniz</option>';
        window.__TR_ADDR__.provinces.forEach(province => {
            const option = document.createElement('option');
            option.value = province.name;
            option.textContent = province.name;
            newCitySelect.appendChild(option);
        });
        
        // Seçili değeri set et ve ilçe listesini yükle
        if (this.tenant && this.tenant.city) {
            newCitySelect.value = this.tenant.city;
            
            // İlçe listesini yükle - güncel stateSelect referansını kullan
            // Hem tenant-edit-state hem de settings-state için çalışmalı
            const currentStateSelect = document.getElementById('tenant-edit-state') || 
                                       document.getElementById('settings-state') ||
                                       stateSelect;
            if (currentStateSelect) {
                this.loadDistrictsForCity(this.tenant.city, currentStateSelect, this.tenant.state);
            }
        }
        
        // İl değiştiğinde ilçe listesini güncelle
        newCitySelect.addEventListener('change', (e) => {
            const selectedCity = e.target.value;
            // Hem tenant-edit-state hem de settings-state için çalışmalı
            const currentStateSelect = document.getElementById('tenant-edit-state') || 
                                       document.getElementById('settings-state') ||
                                       stateSelect;
            if (currentStateSelect) {
                this.loadDistrictsForCity(selectedCity, currentStateSelect);
            }
        });
    }
    
    closeTenantEditModal() {
        // Clear all input error tooltips
        if (typeof clearAllInputErrors === 'function') {
            clearAllInputErrors();
        }
        
        const modal = document.getElementById('modal-tenant-edit-overlay');
        if (modal) {
            modal.classList.remove('active');
        }
        // Modal kapandığında body overflow'u geri yükle
        // Eğer başka aktif modal yoksa
        const hasActiveModal = document.querySelector('.modal-overlay.active');
        if (!hasActiveModal) {
            document.documentElement.classList.remove('modal-open');
            document.body.classList.remove('modal-open');
        }
        const form = document.getElementById('tenant-edit-form');
        if (form) {
            form.reset();
            // Form reset edildikten sonra telefon inputuna formatlama uygula - diğer formlardaki gibi
            const phoneInputAfterReset = document.getElementById('tenant-edit-phone');
            if (phoneInputAfterReset) {
                phoneInputAfterReset.value = '+90 (';
                // ✅ Console sayfaları için telefon input maskesi uygula
                phoneInputAfterReset.removeAttribute('data-phone-formatted');
                phoneInputAfterReset.removeAttribute('data-telefon-formatted');
                phoneInputAfterReset.removeAttribute('pattern');
                phoneInputAfterReset.removeAttribute('title');
                phoneInputAfterReset.classList.remove('input-error');
                if (typeof window.setupConsolePhoneInput === 'function') {
                    window.setupConsolePhoneInput(phoneInputAfterReset);
                }
            }
        }
    }
    
    async saveTenantEdit() {
        const nameInput = document.getElementById('tenant-edit-name');
        const emailInput = document.getElementById('tenant-edit-email');
        const phoneInput = document.getElementById('tenant-edit-phone');
        const citySelect = document.getElementById('tenant-edit-city');
        const stateSelect = document.getElementById('tenant-edit-state');
        
        if (!nameInput || !emailInput) {
            console.error('Tenant edit form inputs not found');
            return;
        }
        
        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        
        // Telefon numarasını temizle ve formatla
        let phone = null;
        const phoneValue = phoneInput ? phoneInput.value.trim() : '';
        
        // Telefon numarası varsa ve "+90 (" değilse işle
        if (phoneValue && phoneValue !== '+90 (' && phoneValue.trim() !== '' && phoneValue.trim() !== '+90') {
            const digits = phoneValue.replace(/\D/g, '');
            
            if (digits.length >= 10) {
                // E.164 formatına çevir: 90XXXXXXXXXX (önünde + olmadan, backend'in beklediği format)
                if (digits.length === 12 && digits.startsWith('90')) {
                    // Zaten 12 haneli ve 90 ile başlıyorsa
                    phone = digits;
                } else if (digits.length === 10) {
                    // 10 haneli ve 5 ile başlıyorsa
                    phone = '90' + digits;
                } else if (digits.length === 11 && digits.startsWith('0')) {
                    // 11 haneli ve 0 ile başlıyorsa
                    phone = '90' + digits.substring(1);
                } else if (digits.length >= 10) {
                    // Son 10 haneyi al
                    const last10 = digits.substring(digits.length - 10);
                    if (last10.length === 10) {
                        phone = '90' + last10;
                    }
                }
            }
        }
        
        const city = citySelect ? citySelect.value : '';
        const state = stateSelect ? stateSelect.value : '';
        
        if (!name) {
            if (typeof createToast === 'function') {
                createToast('warning', 'Lütfen organizasyon adını giriniz');
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
        
        // ✅ Telefon validation kontrolü - Console panel'deki gibi tooltip göster
        // ÖNEMLİ: Her submit'te validation state'ini temizle ve yeniden kontrol et
        if (phoneInput) {
            // Validation state'ini temizle (her submit'te fresh validation için)
            phoneInput.setCustomValidity('');
            phoneInput.classList.remove('input-error');
            
            if (typeof validatePhoneInput === 'function') {
                // Telefon numarası boş veya sadece "+90 (" ise kontrol et
                if (!phoneValue || phoneValue === '+90 (' || phoneValue.trim() === '' || phoneValue === '+90') {
                    // Required field boş - validation göster
                    phoneInput.setCustomValidity('Telefon numarası gereklidir! +90 (XXX) XXX XX XX formatında yazınız.');
                    phoneInput.reportValidity();
                    phoneInput.focus();
                    return;
                }
                
                // Telefon numarası var ama format/eksik kontrolü
                if (!validatePhoneInput(phoneInput, false)) {
                    // Tooltip göster
                    validatePhoneInput(phoneInput, true);
                    phoneInput.focus();
                    return;
                }
            }
        }
        
        try {
            const response = await fetch(`${this.apiBase}/admin/tenants/${this.tenantId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.adminToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    name: name,
                    email: email,
                    phone: phone,
                    city: city || null,
                    state: state || null
                })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                if (typeof createToast === 'function') {
                    createToast('success', 'Tenant bilgileri başarıyla güncellendi');
                }
                
                // Cross-page update için broadcast et (önce broadcast et)
                if (window.syncManager) {
                    window.syncManager.broadcast('TENANT_UPDATED', {
                        tenantId: this.tenantId,
                        tenantData: { name, email, phone: phone || null, city: city || null, state: state || null }
                    });
                }
                
                // Backend'den bildirim oluşturuldu mu kontrol et
                if (result.notificationCreated) {
                    // Badge'i anında güncelle
                    if (typeof this.updateNotificationBadge === 'function') {
                        await this.updateNotificationBadge();
                    }
                    
                    // Bildirim sayısını güncelle (BroadcastChannel) - diğer sayfalar için
                    if (this.notificationChannel) {
                        this.notificationChannel.postMessage({
                            type: 'notification-updated'
                        });
                    }
                }
                
                // Tenant verisini backend'den yeniden yükle (güncel veriyi almak için)
                await this.loadTenant();
                
                // Aktivite loglarını yenile (log kaydı oluşturulduktan sonra)
                await this.loadActivityLogs();
                
                // Modal'ı kapat
                if (this.closeTenantEditModalWithCheck) {
                    this.closeTenantEditModalWithCheck(true); // force close after save
                } else {
                    this.closeTenantEditModal();
                }
            } else {
                throw new Error(result.error || result.message || 'Tenant bilgileri güncellenemedi');
            }
        } catch (error) {
            console.error('Tenant bilgileri güncellenirken hata:', error);
            if (typeof createToast === 'function') {
                createToast('error', error.message || 'Tenant bilgileri güncellenemedi');
            }
        }
    }
    
    async showProfileSheet() {
        // Eğer zaten açılıyorsa, tekrar açma
        if (this.isOpeningProfileSheet) {
            return;
        }
        
        // Sheet zaten açıksa tekrar açma
        if (this.sheets.profile) {
            // Sheet zaten DOM'da ve aktifse, sadece güncelle
            if (document.body.contains(this.sheets.profile)) {
                if (this.sheets.profile.classList && this.sheets.profile.classList.contains('active')) {
                    return; // Zaten açık, hiçbir şey yapma
                }
            }
        }
        
        // Flag'i set et
        this.isOpeningProfileSheet = true;
        
        try {
            // Sheet yoksa oluştur
            if (!this.sheets.profile) {
                await this.createProfileSheet();
            }
            
            // Sheet'i DOM'a ekle (eğer yoksa)
            if (!document.body.contains(this.sheets.profile)) {
                document.body.appendChild(this.sheets.profile);
            }
            
            // Sheet'i aç
            this.sheets.profile.update(true);
        } finally {
            // Flag'i temizle (kısa bir gecikme ile, animasyon tamamlansın)
            setTimeout(() => {
                this.isOpeningProfileSheet = false;
            }, 300);
        }
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
        
        // Form kontrolü için callback
        let closeProfileSheetCallback = null;
        
        const sheet = createSheet({
            id: 'profile-sheet',
            side: 'right',
            open: false,
            onClose: () => {
                if (closeProfileSheetCallback) {
                    closeProfileSheetCallback(false);
                }
            }
        });
        
        // Modal Header - Console sayfasındaki gibi
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
        
        // Backend'den güncel admin user verisini çek
        const adminUser = window.AdminUserHelpers && window.AdminUserHelpers.fetchAdminUserFromBackend 
            ? await window.AdminUserHelpers.fetchAdminUserFromBackend() 
            : (window.AdminUserHelpers ? window.AdminUserHelpers.getAdminUser() : {});
        
        // Modal Body - Form içinde
        const form = document.createElement('form');
        form.id = 'profile-form';
        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        
        // Profile Section - Modal body içinde
        const profileSection = document.createElement('div');
        profileSection.className = 'modal-profile-section';
        
        // Ortak avatar oluşturma fonksiyonunu kullan (tıklama özelliği zaten içinde)
        const avatar = window.AdminUserHelpers ? window.AdminUserHelpers.createProfileAvatar(adminUser) : (() => {
            // Fallback: helper yoksa manuel oluştur
            const fallbackAvatar = document.createElement('div');
            fallbackAvatar.className = 'modal-profile-avatar';
            const fallbackDiv = document.createElement('div');
            fallbackDiv.className = 'w-full h-full flex items-center justify-center';
            const name = adminUser.name || adminUser.email || adminUser.kullaniciadi || 'A';
            fallbackDiv.textContent = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            fallbackAvatar.appendChild(fallbackDiv);
            return fallbackAvatar;
        })();
        
        // Avatar element'ine bir ID ekle ki kaydet butonunda kolayca bulabilelim
        avatar.id = 'profile-sheet-avatar';
        profileSection.appendChild(avatar);
        
        // Avatar element'ini sheet'e de sakla (kolay erişim için)
        sheet.profileAvatar = avatar;
        const profileInfo = document.createElement('div');
        profileInfo.innerHTML = `<h3 class="modal-profile-name">${adminUser.name || 'Admin'}</h3><span class="modal-profile-badge">Süper Admin</span>`;
        profileSection.appendChild(profileInfo);
        modalBody.appendChild(profileSection);
        
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
            profile_image: adminUser.profile_image || adminUser.profil_resmi || null,
            profil_resmi: adminUser.profile_image || adminUser.profil_resmi || null // Geriye uyumluluk için
        };
        
        // Form değişiklik takibi için flag
        let formHasChanges = false;
        let profileImageChanged = false; // Profil resmi değişikliği takibi
        
        // Mevcut profil resmini sakla (avatar'dan)
        let currentProfileImage = adminUser.profile_image || adminUser.profil_resmi || null;
        
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
        
        nameInput.addEventListener('input', checkFormChanges);
        nameInput.addEventListener('change', checkFormChanges);
        emailInput.addEventListener('input', checkFormChanges);
        emailInput.addEventListener('change', checkFormChanges);
        
        // Profil resmi yüklendiğinde originalValues'u güncellemek için callback
        window.updateProfileOriginalValues = (updates) => {
            if (updates.profil_resmi !== undefined) {
                // Profil resmi değiştiğini işaretle
                profileImageChanged = (updates.profil_resmi !== originalValues.profil_resmi);
                currentProfileImage = updates.profil_resmi;
                checkFormChanges(); // Değişiklik kontrolünü güncelle
            }
        };
        
        // Değişiklik kontrolü fonksiyonu
        const hasChanges = () => {
            checkFormChanges(); // Güncel durumu kontrol et
            return formHasChanges;
        };
        
        // Form kapatma fonksiyonu (değişiklik kontrolü ile)
        const closeProfileSheet = (force = false) => {
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
                            const avatar = document.querySelector('#profile-sheet .modal-profile-avatar');
                            if (avatar && avatar.pendingProfileFile) {
                                avatar.pendingProfileFile = null;
                                avatar.removeAttribute('data-pending-profile-file');
                            }
                            
                            // Profil resmi değişikliğini geri al - backend'den orijinal resmi yükle
                            if (profileImageChanged && window.AdminUserHelpers && window.AdminUserHelpers.fetchAdminUserFromBackend) {
                                window.AdminUserHelpers.fetchAdminUserFromBackend().then(updatedUser => {
                                    // Avatar'ı güncelle - orijinal resmi göster
                                    const avatarImg = document.querySelector('#profile-sheet .modal-profile-avatar img');
                                    const avatarFallback = document.querySelector('#profile-sheet .modal-profile-avatar div:not(img)');
                                    
                                    const updatedProfileImage = updatedUser.profile_image || updatedUser.profil_resmi;
                                    if (updatedProfileImage && updatedProfileImage.trim() !== '') {
                                        const imageUrl = window.AdminUserHelpers.getProfileImageUrl(updatedProfileImage);
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
                        this.sheets.profile = null;
                    }
                }, 300);
            }
        };
        
        // Callback'i ata
        closeProfileSheetCallback = closeProfileSheet;
        
        // Close button'a event listener ekle (header'da zaten var)
        const existingCloseBtn = sheet.querySelector('button[aria-label="Close"]');
        if (existingCloseBtn) {
            existingCloseBtn.addEventListener('click', () => closeProfileSheet(false));
        }
        
        const footer = createSheetFooter();
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn-cancel flex-1';
        cancelBtn.textContent = 'İptal';
        cancelBtn.onclick = () => closeProfileSheet(false);
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'btn-save flex-1';
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
            
            try {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Kaydediliyor...';
                
                const backendBase = window.getFloovonBackendBase ? window.getFloovonBackendBase() : (window.BACKEND_BASE_URL || 'http://localhost:3001');
                
                // Önce profil resmi varsa yükle
                // Avatar'ı bul - önce sheet'te saklanan referansı kontrol et, sonra selector ile bul
                let avatar = this.sheets.profile?.profileAvatar || 
                             document.getElementById('profile-sheet-avatar') ||
                             document.querySelector('.modal-profile-avatar[data-pending-profile-file="true"]') ||
                             document.querySelector('#profile-sheet-overlay .modal-profile-avatar') ||
                             document.querySelector('#profile-sheet .modal-profile-avatar') ||
                             document.querySelector('.modal-overlay.active .modal-profile-avatar');
                
                // Eğer avatar bulunamadıysa veya pendingProfileFile yoksa, tüm modal-profile-avatar elementlerini kontrol et
                if (!avatar || (!avatar.pendingProfileFile && !avatar.hasAttribute('data-pending-profile-file'))) {
                    const allAvatars = document.querySelectorAll('.modal-profile-avatar');
                    for (let av of allAvatars) {
                        if (av.pendingProfileFile || av.hasAttribute('data-pending-profile-file')) {
                            avatar = av;
                            break;
                        }
                    }
                }
                
                let profileImagePath = null;
                // Avatar bulundu ve pendingProfileFile varsa veya data attribute varsa
                if (avatar && (avatar.pendingProfileFile || avatar.hasAttribute('data-pending-profile-file'))) {
                    const formData = new FormData();
                    formData.append('profile', avatar.pendingProfileFile);
                    
                    const profileResponse = await fetch(`${backendBase}/api/admin/user/profile`, {
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
                        const headerAvatar = document.getElementById('admin-tenant-user-avatar-img');
                        const headerAvatarFallback = document.getElementById('admin-tenant-user-avatar-fallback');
                        if (headerAvatar) {
                            let imageUrl = profileImagePath;
                            if (typeof window.getFloovonUploadUrl === 'function') {
                                imageUrl = window.getFloovonUploadUrl(imageUrl);
                            } else if (typeof window.AdminUserHelpers && window.AdminUserHelpers.getProfileImageUrl) {
                                imageUrl = window.AdminUserHelpers.getProfileImageUrl(imageUrl);
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
                    
                    // Backend'den güncel veriyi çek
                    if (window.AdminUserHelpers && window.AdminUserHelpers.fetchAdminUserFromBackend) {
                        await window.AdminUserHelpers.fetchAdminUserFromBackend();
                    }
                    
                    // Modal içindeki avatar'ı güncelle
                    if (profileImagePath) {
                        const modalAvatarImg = document.querySelector('#profile-sheet .modal-profile-avatar img');
                        const modalAvatarFallback = document.querySelector('#profile-sheet .modal-profile-avatar div:not(img)');
                        
                        if (modalAvatarImg && window.AdminUserHelpers && window.AdminUserHelpers.getProfileImageUrl) {
                            const imageUrl = window.AdminUserHelpers.getProfileImageUrl(profileImagePath);
                            modalAvatarImg.src = imageUrl + '?t=' + Date.now();
                            modalAvatarImg.classList.remove('hidden');
                            if (modalAvatarFallback) modalAvatarFallback.style.display = 'none';
                        }
                    }
                    
                    // Header'daki avatar'ı da güncelle (PUT işleminden sonra, profil resmi path'i veritabanına kaydedildi)
                    const headerAvatar = document.getElementById('admin-tenant-user-avatar-img');
                    const headerAvatarFallback = document.getElementById('admin-tenant-user-avatar-fallback');
                    const finalProfileImage = profileImagePath || adminUser.profil_resmi || adminUser.profile_image;
                    if (headerAvatar && finalProfileImage) {
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
                    if (profileImagePath) {
                        originalValues.profil_resmi = profileImagePath;
                        originalValues.profile_image = profileImagePath;
                        currentProfileImage = profileImagePath;
                    }
                    profileImageChanged = false;
                    
                    // Callback'i temizle
                    delete window.updateProfileOriginalValues;
                    
                    this.sheets.profile.update(false);
                    setTimeout(() => {
                        if (this.sheets.profile && this.sheets.profile.parentNode) {
                            this.sheets.profile.parentNode.removeChild(this.sheets.profile);
                            this.sheets.profile = null;
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
        
        // Modal yapısına göre ekle - Console sayfasındaki gibi
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
        // Eğer başka bir settings modal zaten açıksa, onu kapat
        const existingSettings = document.getElementById('settings-sheet') || document.getElementById('settings-modal-overlay');
        if (existingSettings && existingSettings !== this.sheets?.settings) {
            if (existingSettings.parentNode) {
                existingSettings.parentNode.removeChild(existingSettings);
            }
        }
        
        if (!this.sheets.settings) {
            this.createSettingsSheet();
        }
        // Eğer sheet zaten DOM'da varsa, tekrar ekleme
        if (this.sheets.settings.parentNode) {
            this.sheets.settings.update(true);
            return;
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
            id: 'settings-sheet',
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
        
        // Modal yapısına göre ekle - Console sayfasındaki gibi
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
}

// Sayfa yüklendiğinde tenant yönetimini başlat
let tenantManage;
document.addEventListener('DOMContentLoaded', function() {
    // ✅ Console sayfaları için telefon input maskesi uygula
    // HTML'deki TÜM telefon input'larına console telefon maskesi uygula
    function applyPhoneFormatting() {
        const htmlPhoneInputs = document.querySelectorAll('#settings-phone, #tenant-edit-phone, #user-phone, input[type="tel"], input[name="phone"]');
        htmlPhoneInputs.forEach(input => {
            if (input) {
                // data-phone-formatted attribute'unu kaldır (eğer varsa)
                input.removeAttribute('data-phone-formatted');
                input.removeAttribute('data-telefon-formatted');
                input.removeAttribute('pattern');
                input.removeAttribute('title');
                input.classList.remove('input-error');
                // Console sayfaları için telefon input maskesi uygula
                if (typeof window.setupConsolePhoneInput === 'function') {
                    window.setupConsolePhoneInput(input);
                } else if (!input.value || input.value.trim() === '') {
                    input.value = '+90 (';
                }
            }
        });
    }
    
    // İlk yüklemede uygula
    applyPhoneFormatting();
    
    // MutationObserver ile dinamik eklenen input'ları da yakala
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) {
                    // Yeni eklenen node'da telefon input'larını ara
                    const phoneInputs = node.querySelectorAll ? node.querySelectorAll('input[type="tel"], input[name="phone"], #settings-phone, #tenant-edit-phone, #user-phone') : [];
                    // ✅ Console sayfaları için telefon input maskesi uygula
                    phoneInputs.forEach(input => {
                        if (input) {
                            // data-phone-formatted attribute'unu kaldır (eğer varsa)
                            input.removeAttribute('data-phone-formatted');
                            input.removeAttribute('data-telefon-formatted');
                            input.removeAttribute('pattern');
                            input.removeAttribute('title');
                            input.classList.remove('input-error');
                            // Console sayfaları için telefon input maskesi uygula
                            if (typeof window.setupConsolePhoneInput === 'function') {
                                window.setupConsolePhoneInput(input);
                            } else if (!input.value || input.value.trim() === '') {
                                input.value = '+90 (';
                            }
                        }
                    });
                    // Eğer node'un kendisi telefon input'u ise
                    if (node.tagName === 'INPUT' && (node.type === 'tel' || node.name === 'phone' || node.id === 'settings-phone' || node.id === 'tenant-edit-phone' || node.id === 'user-phone')) {
                        if (typeof attachTRPhoneMask === 'function' && !node.hasAttribute('data-tr-phone-mask')) {
                            attachTRPhoneMask(node);
                        }
                    }
                }
            });
        });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    try {
        tenantManage = new TenantManage();
        window.tenantManage = tenantManage; // Global erişim için
    } catch (error) {
        console.error('❌ TenantManage oluşturulurken hata:', error);
        console.error('❌ Hata stack:', error.stack);
    }
});

// ========================================================================
// 🔔 BİLDİRİMLER - TenantManage için
// ========================================================================

// TenantManage sınıfına bildirim metodlarını ekle
if (typeof TenantManage !== 'undefined') {
    TenantManage.prototype.initNotifications = function() {
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
            if (event.data.type === 'subscription-updated') {
                const match = event.data.tenantId === this.tenantId || event.data.tenantCode === (this.tenant && this.tenant.tenants_no);
                if (match) {
                    await this.loadBillingData();
                    this.renderBillingTab();
                }
            } else if (event.data.type === 'notification-updated') {
                await this.updateNotificationBadge();
                await this.loadNotifications(null, true);
                const isDropdownOpen = notificationDropdown && notificationDropdown.style.display !== 'none';
                if (isDropdownOpen) {
                    const activeFilter = document.querySelector('.notification-filter.active');
                    const filterType = activeFilter ? activeFilter.getAttribute('data-filter') : null;
                    await this.loadNotifications(filterType === 'all' ? null : filterType);
                }
            } else if (event.data.type === 'admin-profile-updated') {
                const userNameEl = document.getElementById('admin-user-name');
                if (userNameEl && event.data.name) {
                    userNameEl.textContent = event.data.name;
                }
                
                const avatarImg = document.getElementById('admin-tenant-user-avatar-img');
                const avatarFallback = document.getElementById('admin-tenant-user-avatar-fallback');
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
            
            // Mevcut durumu kontrol et - inline style'ı kontrol et
            const currentDisplay = notificationDropdown.style.display;
            const isOpen = currentDisplay === 'flex' || (currentDisplay !== 'none' && currentDisplay !== '');
            
            if (isOpen) {
                // Kapat
                notificationDropdown.style.display = 'none';
                notificationDropdown.classList.add('hidden');
            } else {
                // Aç
                notificationDropdown.style.display = 'flex';
                notificationDropdown.style.visibility = 'visible';
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
        
        // Dışarı tıklanınca kapat - setTimeout ile geciktir ki dropdown açılma event'i önce çalışsın
        setTimeout(() => {
            document.addEventListener('click', (e) => {
                // Eğer notification butonuna veya dropdown'a tıklandıysa, kapatma
                if (notificationBtn.contains(e.target) || notificationDropdown.contains(e.target)) {
                    return;
                }
                
                // Dropdown açıksa kapat
                const currentDisplay = notificationDropdown.style.display;
                const isOpen = currentDisplay === 'flex' || (currentDisplay !== 'none' && currentDisplay !== '');
                
                if (isOpen) {
                    notificationDropdown.style.display = 'none';
                    notificationDropdown.classList.add('hidden');
                }
            });
        }, 100); // 100ms gecikme ile ekle
        
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
    
    TenantManage.prototype.loadNotifications = async function(filterType = null, updateBadgesOnly = false) {
        const notificationList = document.getElementById('notification-list');
        if (!notificationList) return;
        
        try {
            let url = `${this.apiBase}/admin/notifications?limit=50`;
            if (filterType) {
                url += `&type=${filterType}`;
            }
            
            const response = await fetch(url, {
                credentials: 'include'
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
            
            // Badge güncelle
            this.updateNotificationBadge(unreadCount);
            
            // Eğer sadece badge güncellemesi isteniyorsa, render etme
            if (updateBadgesOnly) {
                // Tüm bildirimleri yükle (filtre olmadan) badge'ler için
                const allNotificationsResponse = await fetch(`${this.apiBase}/admin/notifications?limit=1000`, {
                    credentials: 'include'
                });
                if (allNotificationsResponse.ok) {
                    const allResult = await allNotificationsResponse.json();
                    if (allResult.success) {
                        const allNotifications = allResult.data || [];
                        // Filtre badge'lerini tüm bildirimlerle güncelle
                        this.updateFilterBadges(allNotifications);
                    }
                }
                return;
            }
            
            // Footer göster/gizle
            const footer = document.getElementById('notification-footer');
            if (footer) {
                footer.style.display = unreadCount > 0 ? 'block' : 'none';
            }
            
            // Bildirimleri render et
            this.renderNotifications(notifications);
            
            // Filtre butonlarına okunmamış bildirim sayısını ekle (tüm bildirimlerle)
            const allNotificationsResponse = await fetch(`${this.apiBase}/admin/notifications?limit=1000`, {
                credentials: 'include'
            });
            if (allNotificationsResponse.ok) {
                const allResult = await allNotificationsResponse.json();
                if (allResult.success) {
                    const allNotifications = allResult.data || [];
                    this.updateFilterBadges(allNotifications);
                }
            }
            
            // Kritik bildirimler için ses çal
            const criticalNotifications = notifications.filter(n => n.type === 'critical' && n.is_read === 0);
            if (criticalNotifications.length > 0) {
                this.playNotificationSound();
            }
            
        } catch (error) {
            console.error('❌ Bildirimler yüklenirken hata:', error);
            if (notificationList) {
                notificationList.innerHTML = '<div class="notification-error">Bildirimler yüklenemedi. Lütfen sayfayı yenileyin.</div>';
            }
        }
    };
    
    TenantManage.prototype.updateNotificationBadge = async function(count = null) {
        const badge = document.getElementById('notification-dot');
        if (!badge) {
            console.warn('⚠️ Badge elementi bulunamadı: #notification-dot');
            return;
        }
        
        if (count === null) {
            // Sadece sayıyı güncelle (console sayfasındaki gibi)
            try {
                const response = await fetch(`${this.apiBase}/admin/notifications?limit=1&unread_only=true`, {
                    credentials: 'include'
                });
                
                if (response.ok) {
                    const result = await response.json();
                    count = result.unread_count || 0;
                } else {
                    console.error('❌ Backend\'den count alınamadı, HTTP:', response.status);
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
    
    TenantManage.prototype.renderNotifications = function(notifications) {
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
        
        // Bildirim item'larına tıklama event'i ekle
        notificationList.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                e.stopPropagation(); // Dropdown'ın kapanmasını engelle
                const notificationId = parseInt(item.getAttribute('data-id'));
                if (notificationId && item.classList.contains('unread')) {
                    // Onay toast'ı göster
                    if (typeof createToastInteractive === 'function') {
                        createToastInteractive({
                            message: 'Bu bildirimi okundu olarak işaretlemek istiyor musunuz?',
                            confirmText: 'Evet',
                            cancelText: 'Hayır',
                            onConfirm: async (e) => {
                                if (e) e.stopPropagation(); // Dropdown'ın kapanmasını engelle
                                await this.markNotificationAsRead(notificationId);
                                item.classList.remove('unread');
                                item.querySelector('.notification-item-dot')?.remove();
                                await this.updateNotificationBadge();
                                // Filtre badge'lerini güncelle (tüm bildirimlerle)
                                await this.loadNotifications(null, true); // Tüm bildirimleri yükle ama render etme
                            },
                            onCancel: (e) => {
                                if (e) e.stopPropagation(); // Dropdown'ın kapanmasını engelle
                            }
                        });
                    } else {
                        // Fallback: Direkt işaretle
                        await this.markNotificationAsRead(notificationId);
                        item.classList.remove('unread');
                        item.querySelector('.notification-item-dot')?.remove();
                        await this.updateNotificationBadge();
                    }
                }
            });
        });
    };
    
    TenantManage.prototype.markNotificationAsRead = async function(notificationId) {
        try {
            const response = await fetch(`${this.apiBase}/admin/notifications/${notificationId}/read`, {
                method: 'PUT',
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Bildirim okundu işaretlenemedi');
            }
            
            const result = await response.json();
            
            // BroadcastChannel'a bildir (diğer sayfaları güncelle)
            if (this.notificationChannel) {
                this.notificationChannel.postMessage({
                    type: 'notification-updated'
                });
            }
            
            // Badge'i anında güncelle
            if (typeof this.updateNotificationBadge === 'function') {
                await this.updateNotificationBadge();
            }
            
            return result.success;
        } catch (error) {
            console.error('❌ Bildirim okundu işaretlenirken hata:', error);
            return false;
        }
    };
    
    TenantManage.prototype.markAllNotificationsAsRead = async function() {
        try {
            const response = await fetch(`${this.apiBase}/admin/notifications/read-all`, {
                method: 'PUT',
                credentials: 'include'
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
                
                // BroadcastChannel'a bildir (diğer sayfaları güncelle)
                if (this.notificationChannel) {
                    this.notificationChannel.postMessage({
                        type: 'notification-updated'
                    });
                }
                
                // Badge'i anında güncelle
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
    
    TenantManage.prototype.updateFilterBadges = function(notifications) {
        // Her filtre tipine göre okunmamış bildirim sayısını hesapla
        const filterTypes = ['all', 'critical', 'warning', 'info', 'system'];
        const unreadCounts = {};
        
        filterTypes.forEach(filterType => {
            if (filterType === 'all') {
                unreadCounts[filterType] = notifications.filter(n => n.is_read === 0).length;
            } else {
                unreadCounts[filterType] = notifications.filter(n => n.type === filterType && n.is_read === 0).length;
            }
        });
        
        // Filtre butonlarına badge ekle/kaldır
        filterTypes.forEach(filterType => {
            const filterBtn = document.querySelector(`.notification-filter[data-filter="${filterType}"]`);
            if (filterBtn) {
                // Mevcut badge'leri kaldır (hem eski hem yeni class ile)
                const existingBadge = filterBtn.querySelector('.console-panel-notification-filter-badge') || filterBtn.querySelector('.notification-filter-badge');
                if (existingBadge) {
                    existingBadge.remove();
                }
                
                // Okunmamış bildirim varsa badge ekle
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
    
    TenantManage.prototype.formatTimeAgo = function(dateString) {
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
    
    TenantManage.prototype.escapeHtml = function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
    
    TenantManage.prototype.playNotificationSound = function() {
        try {
            // Web Audio API ile basit bir bildirim sesi oluştur
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
}

// Sayfa yüklenmeden önce de kontrol et
if (document.readyState !== 'loading') {
    try {
        tenantManage = new TenantManage();
        window.tenantManage = tenantManage;
    } catch (error) {
        console.error('❌ TenantManage oluşturulurken hata:', error);
    }
}

// Unified Tooltip System for console-tenant-manage page
function initUnifiedTooltipSystem() {
    let tooltipEl = null, currentTarget = null;

    const POS = { TOP: "top", BOTTOM: "bottom", LEFT: "left", RIGHT: "right" };

    function findTooltipTarget(el) {
        let cur = el;
        while (cur && cur !== document.body) {
            if (cur.getAttribute && cur.hasAttribute('data-tooltip')) return cur;
            cur = cur.parentElement;
        }
        return null;
    }

    function clearTooltip() {
        if (tooltipEl?.parentNode) tooltipEl.remove();
        tooltipEl = null; currentTarget = null;
    }

    function getPreferredPosForTarget(target) {
        // İsteğe bağlı zorunlu yön: data-tooltip-pos="top|bottom|left|right"
        const forced = target.getAttribute('data-tooltip-pos');
        if (forced && [POS.TOP, POS.BOTTOM, POS.LEFT, POS.RIGHT].includes(forced)) {
            return forced;
        }
        // Varsayılan: üst
        return POS.TOP;
    }

    function applyPlacement(target, tip) {
        const rect = target.getBoundingClientRect();
        const tRect = tip.getBoundingClientRect();
        let pos = getPreferredPosForTarget(target);
        let left = 0, top = 0;

        // Konum hesapla
        const place = (p) => {
            pos = p;
            tip.classList.remove('tooltip--top', 'tooltip--bottom', 'tooltip--left', 'tooltip--right');
            tip.classList.add(`tooltip--${p}`);
            switch (p) {
                case POS.TOP:
                    left = rect.left + rect.width / 2 - tRect.width / 2;
                    top = rect.top - tRect.height - 8;
                    tip.style.transform = 'none';
                    break;
                case POS.BOTTOM:
                    left = rect.left + rect.width / 2 - tRect.width / 2;
                    top = rect.bottom + 8;
                    tip.style.transform = 'none';
                    break;
                case POS.LEFT:
                    left = rect.left - tRect.width - 12;
                    top = rect.top + rect.height / 2 - tRect.height / 2;
                    tip.style.transform = 'none';
                    break;
                case POS.RIGHT:
                    left = rect.right + 12;
                    top = rect.top + rect.height / 2 - tRect.height / 2;
                    tip.style.transform = 'none';
                    break;
            }
            // Ekran kenar koruması
            const pad = 10;
            left = Math.min(Math.max(left, pad), window.innerWidth - tRect.width - pad);
            top = Math.min(Math.max(top, pad), window.innerHeight - tRect.height - pad);
        };

        // Önce tercih edilen
        place(pos);

        // Flip mantığı: sığmıyorsa karşı yöne çevir
        const offTop = top < 10;
        const offBottom = top + tRect.height > window.innerHeight - 10;
        const offLeft = left < 10;
        const offRight = left + tRect.width > window.innerWidth - 10;

        if (pos === POS.TOP && offTop) place(POS.BOTTOM);
        else if (pos === POS.BOTTOM && offBottom) place(POS.TOP);
        else if (pos === POS.LEFT && offLeft) place(POS.RIGHT);
        else if (pos === POS.RIGHT && offRight) place(POS.LEFT);

        tip.style.left = `${left}px`;
        tip.style.top = `${top}px`;
    }

    function showTooltip(target, text) {
        if (currentTarget === target && tooltipEl) return;
        clearTooltip(); currentTarget = target;

        tooltipEl = document.createElement('div');
        tooltipEl.className = 'tooltip';
        tooltipEl.textContent = text;
        tooltipEl.style.visibility = 'hidden';
        document.body.appendChild(tooltipEl);

        // İlk ölçüm için
        const _ = tooltipEl.getBoundingClientRect();
        applyPlacement(target, tooltipEl);
        tooltipEl.style.visibility = 'visible';
    }

    // Mouse hover için (web görünümü)
    document.addEventListener('mouseover', (e) => {
        const tgt = findTooltipTarget(e.target);
        if (!tgt) return;
        const txt = tgt.getAttribute('data-tooltip');
        if (!txt || txt === '-') return;
        showTooltip(tgt, txt);
    }, true);

    document.addEventListener('mouseout', (e) => {
        const tgt = findTooltipTarget(e.target);
        if (!tgt) return;
        const rel = findTooltipTarget(e.relatedTarget);
        if (rel === tgt) return;
        clearTooltip();
    }, true);

    // Touch için (mobil görünüm)
    let touchTimeout = null;
    let touchStartTime = null;
    let touchTarget = null;
    
    document.addEventListener('touchstart', (e) => {
        const tgt = findTooltipTarget(e.target);
        if (!tgt) {
            clearTooltip();
            touchTarget = null;
            return;
        }
        const txt = tgt.getAttribute('data-tooltip');
        if (!txt || txt === '-') {
            clearTooltip();
            touchTarget = null;
            return;
        }
        
        touchTarget = tgt;
        touchStartTime = Date.now();
        
        // Kısa bir gecikme ile tooltip göster (yanlışlıkla dokunmaları önlemek için)
        touchTimeout = setTimeout(() => {
            if (touchTarget === tgt) {
                showTooltip(tgt, txt);
            }
        }, 200);
    }, true);

    document.addEventListener('touchend', (e) => {
        const touchDuration = touchStartTime ? Date.now() - touchStartTime : 0;
        
        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        
        // Eğer kısa bir dokunma ise (tap), tooltip'i göster ve bir süre tut
        if (touchTarget && touchDuration < 300) {
            const txt = touchTarget.getAttribute('data-tooltip');
            if (txt && txt !== '-') {
                showTooltip(touchTarget, txt);
                // 3 saniye sonra kapat
                setTimeout(() => {
                    clearTooltip();
                }, 3000);
            }
        } else {
            // Uzun dokunma veya kaydırma ise tooltip'i kapat
            clearTooltip();
        }
        
        touchTarget = null;
        touchStartTime = null;
    }, true);

    document.addEventListener('touchmove', () => {
        if (touchTimeout) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
        // Kaydırma yapıldığında tooltip'i kapat
        clearTooltip();
        touchTarget = null;
        touchStartTime = null;
    }, true);

    document.addEventListener('scroll', clearTooltip, true);
    window.addEventListener('resize', clearTooltip);
}

// ✅ REVIZE-9: Tema geçiş butonu setup - Retry mekanizması ile
TenantManage.prototype.setupThemeToggleWithRetry = function() {
    const self = this;
    let attempts = 0;
    const maxAttempts = 20; // Artırıldı
    
    const trySetup = function() {
        attempts++;
        const themeToggleBtn = document.getElementById('header-theme-toggle');
        
        if (themeToggleBtn) {
            self.setupThemeToggle();
        } else if (attempts < maxAttempts) {
            // DOM henüz hazır değil, tekrar dene
            setTimeout(trySetup, 100);
        } else {
            console.warn('⚠️ Tema geçiş butonu bulunamadı: #header-theme-toggle (max attempts reached)');
        }
    };
    
    // Hemen dene, eğer DOM hazırsa çalışır
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', trySetup);
    } else {
        // DOM zaten hazırsa, kısa bir gecikme ile dene (header render olması için)
        setTimeout(trySetup, 50);
    }
};

// ✅ REVIZE-9: Tema geçiş butonu setup (TenantManage class'ına ekle)
TenantManage.prototype.setupThemeToggle = function() {
    const self = this; // Context'i koru
    const themeToggleBtn = document.getElementById('header-theme-toggle');
    if (!themeToggleBtn) {
        return; // Sessizce çık, retry mekanizması zaten uyarı veriyor
    }
    
    // Eğer listener zaten eklenmişse, tekrar ekleme
    if (themeToggleBtn.dataset.themeListenerAdded === 'true') {
        return;
    }
    
    // Mevcut tema durumuna göre ikonları güncelle
    self.updateThemeIcon();
    
    // Event listener ekle (capture phase'de, önce çalışsın)
    themeToggleBtn.dataset.themeListenerAdded = 'true';
    themeToggleBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
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
        self.updateThemeIcon();
        
        // Storage event'i tetikle (diğer tab'lar için)
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'theme',
            newValue: isNowDark ? 'dark' : 'light',
            oldValue: isNowDark ? 'light' : 'dark'
        }));
        
        return false;
    }, true); // capture phase
    
    // Storage event listener (diğer tab'lardan gelen değişiklikler için) - sadece bir kere ekle
    if (!window._themeStorageListenerAdded) {
        window._themeStorageListenerAdded = true;
        window.addEventListener('storage', function(e) {
            if (e.key === 'theme') {
                const isDark = e.newValue === 'dark';
                if (isDark) {
                    document.documentElement.classList.add('dark-mode');
                    document.body.classList.add('dark-mode');
                } else {
                    document.documentElement.classList.remove('dark-mode');
                    document.body.classList.remove('dark-mode');
                }
                // Tüm tema butonlarının ikonlarını güncelle
                const allThemeButtons = document.querySelectorAll('#header-theme-toggle');
                allThemeButtons.forEach(btn => {
                    const sunIcon = btn.querySelector('.theme-icon-sun');
                    const moonIcon = btn.querySelector('.theme-icon-moon');
                    if (sunIcon && moonIcon) {
                        if (isDark) {
                            sunIcon.style.display = 'none';
                            moonIcon.style.display = 'block';
                        } else {
                            sunIcon.style.display = 'block';
                            moonIcon.style.display = 'none';
                        }
                    }
                });
            }
        });
    }
};

// ✅ REVIZE-9: Tema ikonlarını güncelle
TenantManage.prototype.updateThemeIcon = function() {
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
};

// Tooltip sistemini başlat
if (typeof window.initUnifiedTooltipSystem === 'undefined') {
    window.initUnifiedTooltipSystem = initUnifiedTooltipSystem;
}

// Sayfa yüklendiğinde tooltip sistemini başlat
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initUnifiedTooltipSystem();
    });
} else {
    initUnifiedTooltipSystem();
}

