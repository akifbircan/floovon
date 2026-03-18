/**
 * Landing Dashboard JavaScript
 * Dashboard sayfasını backend'e bağlar
 */

// Global billing period değişkeni (dashboard modal için)
window.dashboardBillingPeriod = 'monthly';

/** Profesyonel planda (id 2) yapay zeka sipariş analizi satırı */
function isYapayZekaSiparisAnalizOzellik(feature) {
    const s = String(feature || '').toLowerCase();
    return s.includes('yapay zeka') && (s.includes('sipariş') || s.includes('siparis')) && s.includes('analiz');
}

function escapeHtmlDashboard(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', async function() {
    // URL parametrelerinden tenant ve username al
    const urlParams = new URLSearchParams(window.location.search);
    const tenantCode = urlParams.get('tenant');
    const username = urlParams.get('username');
    
    // URL parametrelerini localStorage'a kaydet ve URL'yi temizle
    if (tenantCode) {
        localStorage.setItem('tenant_code', tenantCode);
    }
    if (username) {
        localStorage.setItem('username', username);
    }
    
    // URL'den parametreleri kaldır (güvenlik/privacy için)
    if (tenantCode || username) {
        const cleanUrl = window.location.pathname + (window.location.hash || '');
        window.history.replaceState({}, document.title, cleanUrl);
    }
    
    // API base URL'i belirle - config.js'den çek
    let apiBase;
    if (typeof window.getFloovonApiBase === 'function') {
        // config.js'den dinamik olarak çek
        apiBase = window.getFloovonApiBase();
    } else if (window.API_BASE_URL) {
        apiBase = window.API_BASE_URL;
    } else {
        // Fallback: localhost kontrolü
        const hostname = window.location.hostname;
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || !hostname;
        apiBase = isLocalhost 
            ? 'http://localhost:' + (localStorage.getItem('backend_port') || '3001') + '/api'
            : '/api';
    }
    
    // Tenant code'u belirle: URL'den veya localStorage'dan
    const finalTenantCode = tenantCode || localStorage.getItem('tenant_code');
    
    // API base'i global erişim için sakla (fatura indirme, iptal vb. için)
    window.dashboardApiBase = apiBase;

    // Eğer tenant code varsa, verileri yükle (hata olsa bile tab/modal listener'ları mutlaka kurulur)
    if (finalTenantCode) {
        try {
            await loadDashboardData(apiBase, finalTenantCode);
        } catch (err) {
            console.error('Dashboard veri yükleme hatası:', err);
        }
    } else {
        // Tenant code yoksa, login sayfasına yönlendir
        window.location.href = 'login.html';
        return;
    }
    
    // Tab değiştirme
    initTabs();
    
    // Modal event listener'ları (Plan Değiştir modalı dahil)
    initModalListeners();
    
    // Logout butonu
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('tenant_code');
            localStorage.removeItem('username');
            window.location.href = 'login.html';
        });
    }
    
    // Fatura indirme butonları için event delegation
    setupBillingDownloadListeners();
    
    // Console manage'den gelen plan güncellemelerini dinle
    const subscriptionChannel = new BroadcastChannel('floovon-admin-notifications');
    subscriptionChannel.onmessage = async (event) => {
        if (event.data.type === 'subscription-updated') {
            // Dashboard verilerini yeniden yükle
            const tenantCode = urlParams.get('tenant') || localStorage.getItem('tenant_code');
            if (tenantCode) {
                await loadDashboardData(apiBase, tenantCode);
            }
        }
    };
    
    // localStorage'dan plan güncellemesi kontrolü
    const checkSubscriptionUpdate = () => {
        try {
            const lastUpdate = localStorage.getItem('last_subscription_update');
            if (lastUpdate) {
                const updateData = JSON.parse(lastUpdate);
                const updateTime = new Date(updateData.updated_at);
                const now = new Date();
                // Son 5 saniye içinde güncelleme varsa dashboard'ı yenile
                if (now - updateTime < 5000) {
                    const tenantCode = urlParams.get('tenant') || localStorage.getItem('tenant_code');
                    if (tenantCode) {
                        loadDashboardData(apiBase, tenantCode);
                    }
                }
            }
        } catch (e) {
            console.warn('Subscription update kontrolü hatası:', e);
        }
    };
    
    // Periyodik olarak kontrol et (her 2 saniyede bir)
    setInterval(checkSubscriptionUpdate, 2000);
    
    // Kopyala butonları için event listener'lar
    initCopyButtons();
    
    // Login panel butonu için event listener
    const loginPanelBtn = document.getElementById('login-panel-btn');
    if (loginPanelBtn) {
        loginPanelBtn.addEventListener('click', function(e) {
            e.preventDefault();
            // Tenant code localStorage'dan al (URL parametresi kullanma - güvenlik/privacy için)
            const tenantCode = localStorage.getItem('tenant_code');
            if (tenantCode) {
                // Login sayfasına yönlendir (tenant code localStorage'da zaten var, URL'de gösterme)
                window.location.href = '/login';
            } else {
                window.location.href = '/login';
            }
        });
    }
});

/**
 * Kopyala butonları için event listener'ları başlat
 */
function initCopyButtons() {
    document.addEventListener('click', async function(e) {
        const copyBtn = e.target.closest('.copy-btn, .copy-btn-small');
        if (!copyBtn) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const copyType = copyBtn.getAttribute('data-copy');
        let textToCopy = '';
        
        switch(copyType) {
            case 'tenant-code':
                const tenantCodeEl = document.getElementById('info-tenant-code-header') || 
                                     document.getElementById('info-tenant-code');
                textToCopy = tenantCodeEl?.textContent?.trim() || '';
                break;
            case 'phone':
                const phoneEl = document.getElementById('info-phone');
                textToCopy = phoneEl?.textContent?.trim() || '';
                break;
            case 'email':
                const emailEl = document.getElementById('info-email');
                textToCopy = emailEl?.textContent?.trim() || '';
                break;
        }
        
        if (textToCopy) {
            try {
                await navigator.clipboard.writeText(textToCopy);
                // Toast bildirimi göster (eğer varsa)
                if (typeof showToast === 'function') {
                    showToast('Kopyalandı!', 'success');
                } else if (typeof createToast === 'function') {
                    createToast('success', 'Kopyalandı!');
                } else {
                    // Basit geri bildirim
                    const originalHTML = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
                    copyBtn.style.color = '#10b981';
                    setTimeout(() => {
                        copyBtn.innerHTML = originalHTML;
                        copyBtn.style.color = '';
                    }, 1500);
                }
            } catch (err) {
                console.error('Kopyalama hatası:', err);
                if (typeof showToast === 'function') {
                    showToast('Kopyalama başarısız', 'error');
                }
            }
        }
    });
}

/**
 * Fatura indirme butonları için event delegation
 */
function setupBillingDownloadListeners() {
    const billingList = document.querySelector('.billing-list');
    if (billingList) {
        // Mevcut listener'ı kaldır (eğer varsa)
        billingList.removeEventListener('click', handleBillingDownloadClick);
        // Yeni listener ekle
        billingList.addEventListener('click', handleBillingDownloadClick);
    } else {
        // Eğer billing-list henüz yoksa, biraz bekle ve tekrar dene
        setTimeout(() => {
            setupBillingDownloadListeners();
        }, 500);
    }
}

/**
 * Fatura indirme butonu click handler (event delegation)
 */
async function handleBillingDownloadClick(e) {
    const downloadBtn = e.target.closest('.billing-download-btn');
    if (!downloadBtn) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const invoiceId = downloadBtn.dataset.invoiceId;
    const tenantCode = downloadBtn.dataset.tenantCode;
    const hasPdf = downloadBtn.dataset.hasPdf === 'true';
    const faturaNo = downloadBtn.closest('.billing-item')?.querySelector('.billing-invoice-number strong')?.textContent || '';
    
    if (!hasPdf) {
        if (typeof window.createToast === 'function') {
            window.createToast('warning', 'Bu fatura için PDF mevcut değil');
        } else if (typeof createToast === 'function') {
            createToast('warning', 'Bu fatura için PDF mevcut değil');
        }
        return;
    }
    
    if (!invoiceId || !tenantCode) {
        if (typeof window.createToast === 'function') {
            window.createToast('error', 'Fatura bilgileri eksik');
        } else if (typeof createToast === 'function') {
            createToast('error', 'Fatura bilgileri eksik');
        }
        return;
    }
    
    await downloadInvoice(invoiceId, tenantCode, faturaNo);
}

/**
 * Dashboard verilerini yükle
 */
async function loadDashboardData(apiBase, tenantCode) {
    try {
        // Business profile bilgilerini çek
        const profileResponse = await fetch(`${apiBase}/public/business-profile?tenant_code=${tenantCode}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!profileResponse.ok) {
            throw new Error(`HTTP ${profileResponse.status}: ${profileResponse.statusText}`);
        }
        
        const profileResult = await profileResponse.json();
        
        if (profileResult.success && profileResult.data) {
            const data = profileResult.data;
            
            // İşletme bilgilerini doldur
            updateBusinessInfo(data);
            
            // Abonelik bilgilerini yükle
            await loadSubscriptionInfo(apiBase, tenantCode);
            
            // Fatura geçmişini yükle
            await loadBillingHistory(apiBase, tenantCode);
        }
        
    } catch (error) {
        if (typeof window.createToast === 'function') {
            window.createToast('error', 'Dashboard verileri yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.');
        } else if (typeof createToast === 'function') {
            createToast('error', 'Dashboard verileri yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.');
        }
    }
}

/**
 * İşletme bilgilerini güncelle
 */
function updateBusinessInfo(data) {
    // İşletme adı
    const businessNameElements = [
        document.getElementById('business-name'),
        document.getElementById('info-business-name'),
        document.getElementById('info-business-name-header')
    ];
    businessNameElements.forEach(el => {
        if (el && data.company_name) el.textContent = data.company_name;
    });
    
    // Tenant code
    const tenantElements = [
        document.getElementById('tenant-code'),
        document.getElementById('info-tenant-code'),
        document.getElementById('info-tenant-code-header')
    ];
    tenantElements.forEach(el => {
        if (el && data.tenant_code) el.textContent = data.tenant_code;
    });
    
    // Kullanıcı adı
    const usernameEl = document.getElementById('info-username');
    if (usernameEl && data.username) usernameEl.textContent = data.username;
    
    // E-posta (İşletme Bilgileri bölümünde) - Kullanıcının email'i
    const emailBusinessEl = document.getElementById('info-email-business');
    if (emailBusinessEl && data.user_email) emailBusinessEl.textContent = data.user_email;
    
    // İsim soyisim
    const fullNameEl = document.getElementById('info-fullname');
    if (fullNameEl && data.full_name) fullNameEl.textContent = data.full_name;
    
    // E-posta (İletişim Bilgileri bölümünde)
    const emailEl = document.getElementById('info-email');
    if (emailEl && data.email) {
        emailEl.textContent = data.email;
        // E-posta linkini ayarla
        const emailLink = document.getElementById('info-email-link');
        if (emailLink && data.email) {
            emailLink.href = `mailto:${data.email}`;
        }
    }
    
    // Telefon
    const phoneEl = document.getElementById('info-phone');
    if (phoneEl && data.phone) {
        phoneEl.textContent = data.phone;
        // Telefon linkini ayarla
        const phoneLink = document.getElementById('info-phone-link');
        if (phoneLink && data.phone) {
            const cleanPhone = data.phone.replace(/\s/g, '').replace(/[()]/g, '');
            phoneLink.href = `tel:${cleanPhone}`;
        }
    }
    
    // İl / İlçe (birleşik)
    const cityStateEl = document.getElementById('info-city-state');
    if (cityStateEl) {
        const cityText = data.city || '';
        const stateText = data.state || '';
        cityStateEl.textContent = cityText && stateText ? `${cityText} / ${stateText}` : (cityText || stateText || '-');
    }
    
    // Tenant kodu (Hesap Sahibi Bilgileri - giriş için gerekli)
    const tenantCodeHesapEl = document.getElementById('info-tenant-code-hesap');
    if (tenantCodeHesapEl && data.tenant_code) tenantCodeHesapEl.textContent = data.tenant_code;
    else if (tenantCodeHesapEl) tenantCodeHesapEl.textContent = '-';
    
    // Kullanıcı e-posta (Hesap Sahibi Bilgileri)
    const userEmailEl = document.getElementById('info-user-email');
    if (userEmailEl && data.user_email) userEmailEl.textContent = data.user_email;
    else if (userEmailEl) userEmailEl.textContent = '-';
    
    // Logo (varsa göster, yoksa gizle) - İşletme bilgilerindeki logo
    const profileAvatar = document.getElementById('profile-avatar');
    const profileAvatarImg = document.getElementById('profile-avatar-img');
    if (profileAvatar && profileAvatarImg) {
        // Backend'den gelen logo_url'i kontrol et
        if (data.logo_url && data.logo_url.trim() !== '') {
            let logoUrl = data.logo_url;
            
            // Base64 ise direkt kullan
            if (logoUrl.startsWith('data:image')) {
                profileAvatarImg.src = logoUrl;
                profileAvatar.style.display = 'flex';
            } else {
                // Logo URL'ini düzelt (getFloovonUploadUrl kullan)
                if (typeof window.getFloovonUploadUrl === 'function') {
                    logoUrl = window.getFloovonUploadUrl(data.logo_url);
                } else {
                    // Fallback: Backend base URL ekle
                    const backendBase = window.getFloovonBackendBase ? window.getFloovonBackendBase() : (window.BACKEND_BASE_URL || '');
                    if (logoUrl && !logoUrl.startsWith('http') && !logoUrl.startsWith('/')) {
                        logoUrl = backendBase + '/' + logoUrl;
                    }
                }
                
                profileAvatarImg.src = logoUrl;
                profileAvatar.style.display = 'flex';
            }
            
            // Logo yüklenemezse gizle
            profileAvatarImg.onerror = function() {
                profileAvatar.style.display = 'none';
                this.onerror = null; // Sonsuz döngüyü önle
            };
        } else {
            // Logo yoksa gizle
            profileAvatar.style.display = 'none';
        }
    }
    
    // Adres
    const addressEl = document.getElementById('info-address');
    if (addressEl && data.address) addressEl.textContent = data.address;
    else if (addressEl) addressEl.textContent = '-';
    
    // Vergi Dairesi
    const taxOfficeEl = document.getElementById('info-tax-office');
    if (taxOfficeEl && data.tax_office) taxOfficeEl.textContent = data.tax_office;
    else if (taxOfficeEl) taxOfficeEl.textContent = '-';
    
    // Vergi No
    const taxNumberEl = document.getElementById('info-tax-number');
    if (taxNumberEl && data.tax_number) taxNumberEl.textContent = data.tax_number;
    else if (taxNumberEl) taxNumberEl.textContent = '-';
    
    // Kayıt tarihi (yukarıda bağımsız gösterilecek)
    const registerDateEl = document.getElementById('info-register-date');
    if (registerDateEl && data.created_at) {
        const date = new Date(data.created_at);
        registerDateEl.textContent = date.toLocaleDateString('tr-TR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }
}

/**
 * Abonelik bilgilerini yükle
 */
async function loadSubscriptionInfo(apiBase, tenantCode) {
    try {
        const response = await fetch(`${apiBase}/public/subscription?tenant_code=${tenantCode}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.data && result.data.plan_id) {
            // Plan var - bilgileri göster
            updateSubscriptionInfo(apiBase, result.data);
            showSubscriptionCard(true);
        } else {
            // Plan yok - "Plan yok" mesajını göster
            showSubscriptionCard(false);
        }
        
    } catch (error) {
        // Hata durumunda da "Plan yok" göster
        showSubscriptionCard(false);
    }
}

/**
 * Abonelik kartını göster veya gizle
 */
function showSubscriptionCard(hasPlan) {
    const subscriptionCard = document.querySelector('.subscription-card');
    if (!subscriptionCard) return;
    
    // Plan yoksa mesajı göster, bilgileri gizle
    if (!hasPlan) {
        // Mevcut plan ID attribute'unu kaldır (modal için)
        subscriptionCard.removeAttribute('data-current-plan-id');
        subscriptionCard.removeAttribute('data-current-billing-period');
        
        // Bilgi alanlarını gizle
        const subscriptionPrice = subscriptionCard.querySelector('.subscription-price');
        const subscriptionDates = subscriptionCard.querySelector('.subscription-dates');
        const subscriptionFeatures = subscriptionCard.querySelector('.subscription-features');
        const planStatus = subscriptionCard.querySelector('.plan-status');
        
        if (subscriptionPrice) subscriptionPrice.style.display = 'none';
        if (subscriptionDates) subscriptionDates.style.display = 'none';
        if (subscriptionFeatures) subscriptionFeatures.style.display = 'none';
        if (planStatus) planStatus.style.display = 'none';
        
        // Plan adını "Plan Yok" yap
        const planNameTextEl = document.getElementById('plan-name-text');
        if (planNameTextEl) {
            planNameTextEl.textContent = 'Plan Yok';
        }
        
        // "Plan yok" mesajını göster (eğer yoksa oluştur)
        let noPlanMessage = subscriptionCard.querySelector('.no-plan-message');
        if (!noPlanMessage) {
            noPlanMessage = document.createElement('div');
            noPlanMessage.className = 'no-plan-message';
            noPlanMessage.style.cssText = 'padding: 40px 20px; text-align: center; color: #6b7280;';
            noPlanMessage.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px; opacity: 0.5;">
                    <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
                </svg>
                <p style="font-size: 16px; margin: 0 0 8px 0; font-weight: 500;">Mevcut bir planınız bulunmuyor</p>
                <p style="font-size: 14px; margin: 0; opacity: 0.8;">Bir plan seçerek aboneliğinize başlayabilirsiniz</p>
            `;
            // subscription-features'dan sonra ekle
            const subscriptionFeaturesEl = subscriptionCard.querySelector('.subscription-features');
            if (subscriptionFeaturesEl && subscriptionFeaturesEl.nextSibling) {
                subscriptionCard.insertBefore(noPlanMessage, subscriptionFeaturesEl.nextSibling);
            } else {
                subscriptionCard.appendChild(noPlanMessage);
            }
        }
        noPlanMessage.style.display = 'block';
        
        // Butonları güncelle
        const upgradeBtn = document.getElementById('upgrade-plan-btn');
        const cancelBtn = document.getElementById('cancel-plan-btn');
        
        if (upgradeBtn) {
            upgradeBtn.textContent = 'Plan Seç';
            upgradeBtn.style.display = 'block';
        }
        if (cancelBtn) {
            cancelBtn.style.display = 'none';
        }
    } else {
        // Plan varsa - bilgileri göster, mesajı gizle
        const subscriptionPrice = subscriptionCard.querySelector('.subscription-price');
        const subscriptionDates = subscriptionCard.querySelector('.subscription-dates');
        const subscriptionFeatures = subscriptionCard.querySelector('.subscription-features');
        const planStatus = subscriptionCard.querySelector('.plan-status');
        const noPlanMessage = subscriptionCard.querySelector('.no-plan-message');
        
        if (subscriptionPrice) subscriptionPrice.style.display = 'block';
        if (subscriptionDates) subscriptionDates.style.display = 'flex';
        if (subscriptionFeatures) subscriptionFeatures.style.display = 'block';
        if (planStatus) planStatus.style.display = 'flex';
        if (noPlanMessage) noPlanMessage.style.display = 'none';
        
        // Butonları güncelle
        const upgradeBtn = document.getElementById('upgrade-plan-btn');
        const cancelBtn = document.getElementById('cancel-plan-btn');
        
        if (upgradeBtn) {
            upgradeBtn.textContent = 'Planı Değiştir';
            upgradeBtn.style.display = 'block';
        }
        if (cancelBtn) {
            cancelBtn.style.display = 'block';
        }
    }
}

/**
 * Abonelik bilgilerini güncelle
 */
function updateSubscriptionInfo(apiBase, data) {
    // Plan yoksa işlem yapma
    if (!data || !data.plan_id) {
        showSubscriptionCard(false);
        return;
    }
    
    // Plan var - bilgileri göster
    showSubscriptionCard(true);
    
    // Plan adı - badge içinde
    const planNameTextEl = document.getElementById('plan-name-text');
    if (planNameTextEl && data.plan_name) {
        planNameTextEl.textContent = data.plan_name;
    }
    
    // Ödeme tipi (Aylık/Yıllık) - ÖNCE kontrol et, sonra fiyatı göster
    const pricePeriodEl = document.querySelector('.subscription-price .price-period');
    const paymentTypeEl = document.querySelector('.payment-type-info');
    
    // Eski payment type info varsa kaldır
    if (paymentTypeEl) {
        paymentTypeEl.remove();
    }
    
    // Backend'den gelen veriye göre belirle - fatura_dongusu veya billing_period kontrolü
    const faturaDongusu = data.fatura_dongusu || data.billing_period || data.billing_cycle || '';
    const isYearly = faturaDongusu === 'yearly' || faturaDongusu === 'yillik' || 
                    data.billing_period === 'yearly' || data.billing_period === 'yillik' || 
                    data.billing_cycle === 'yearly' || data.billing_cycle === 'yillik';
    
    // Plan fiyatı
    const priceAmountEl = document.querySelector('.subscription-price .price-amount');
    if (priceAmountEl) {
        let displayPrice = 0;
        if (isYearly && data.yearly_price) {
            // Yıllık plan: TOPLAM yıllık fiyatı göster
            displayPrice = data.yearly_price;
        } else if (data.monthly_price) {
            // Aylık plan: Aylık fiyatı göster
            displayPrice = data.monthly_price;
        }
        
        if (displayPrice > 0) {
            const price = formatTurkishLira(displayPrice);
            priceAmountEl.textContent = price;
        }
    }
    
    if (pricePeriodEl) {
        if (isYearly) {
            pricePeriodEl.textContent = '/yıl';
            // Ödeme tipi bilgisi ekle
            const paymentTypeDiv = document.createElement('div');
            paymentTypeDiv.className = 'payment-type-info';
            paymentTypeDiv.style.cssText = 'font-size: 14px; color: #6b7280; margin-top: 8px;';
            paymentTypeDiv.textContent = 'Yıllık Ödeme / Aylık Faturalandırılır';
            const priceContainer = document.querySelector('.subscription-price');
            if (priceContainer) {
                // Eski payment type info varsa kaldır
                const oldPaymentType = priceContainer.querySelector('.payment-type-info');
                if (oldPaymentType) oldPaymentType.remove();
                priceContainer.appendChild(paymentTypeDiv);
            }
        } else {
            pricePeriodEl.textContent = '/ay';
            // Ödeme tipi bilgisi ekle
            const paymentTypeDiv = document.createElement('div');
            paymentTypeDiv.className = 'payment-type-info';
            paymentTypeDiv.style.cssText = 'font-size: 14px; color: #6b7280; margin-top: 8px;';
            paymentTypeDiv.textContent = 'Aylık Ödeme / Aylık Faturalandırılır';
            const priceContainer = document.querySelector('.subscription-price');
            if (priceContainer) {
                // Eski payment type info varsa kaldır
                const oldPaymentType = priceContainer.querySelector('.payment-type-info');
                if (oldPaymentType) oldPaymentType.remove();
                priceContainer.appendChild(paymentTypeDiv);
            }
        }
    }
    
    // Başlangıç tarihi
    const startDateEl = document.querySelector('.subscription-dates .date-item:first-child .date-value');
    if (startDateEl && data.current_period_start) {
        const date = new Date(data.current_period_start);
        startDateEl.textContent = date.toLocaleDateString('tr-TR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }
    
    // Sonraki fatura tarihi
    const nextBillingEl = document.querySelector('.subscription-dates .date-item:last-child .date-value');
    if (nextBillingEl && data.next_payment_date) {
        const date = new Date(data.next_payment_date);
        nextBillingEl.textContent = date.toLocaleDateString('tr-TR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }
    
    // Durum badge
    const statusTextEl = document.getElementById('plan-status-text');
    const statusEl = document.querySelector('.plan-status');
    if (statusEl && data.status) {
        if (statusTextEl) {
            statusTextEl.textContent = data.status === 'active' ? 'Aktif' : 'Pasif';
        }
        statusEl.className = `plan-status ${data.status === 'active' ? 'active' : 'inactive'}`;
    }
    
    // Ödeme yöntemi bilgilerini güncelle
    if (data.payment_method) {
        updatePaymentMethod(data.payment_method);
    }
    
    // Plan özelliklerini yükle
    if (data.plan_id) {
        // Plan ID ve billing period'u sakla (modal için)
        const subscriptionCard = document.querySelector('.subscription-card');
        if (subscriptionCard) {
            subscriptionCard.setAttribute('data-current-plan-id', data.plan_id);
            // Billing period'u da sakla (yearly veya monthly)
            const billingPeriodValue = isYearly ? 'yearly' : 'monthly';
            subscriptionCard.setAttribute('data-current-billing-period', billingPeriodValue);
        }
        loadPlanFeatures(apiBase, data.plan_id);
    }
    
    // Butonları güncelle
    const upgradeBtn = document.getElementById('upgrade-plan-btn');
    const cancelBtn = document.getElementById('cancel-plan-btn');
    
    if (upgradeBtn) {
        upgradeBtn.textContent = 'Planı Değiştir';
        upgradeBtn.style.display = 'block';
    }
    if (cancelBtn) {
        // Sadece aktif abonelikler için iptal butonu göster
        if (data.status === 'active' || data.status === 'aktif') {
            cancelBtn.style.display = 'block';
        } else {
            cancelBtn.style.display = 'none';
        }
    }
}

/**
 * Ödeme yöntemi bilgilerini güncelle
 */
function updatePaymentMethod(payment) {
    if (!payment) {
        // Ödeme bilgisi yoksa kartı gizle veya placeholder göster
        const creditCardDisplay = document.getElementById('payment-display');
        if (creditCardDisplay) {
            creditCardDisplay.style.display = 'none';
        }
        return;
    }
    
    // Kart numarasının son 4 hanesi
    const cardNumberSpans = document.querySelectorAll('.card-number span');
    if (cardNumberSpans.length >= 4 && payment.last4) {
        cardNumberSpans[3].textContent = payment.last4;
    }
    
    // Son kullanma tarihi
    const cardExpiryValue = document.getElementById('card-expiry-value');
    if (cardExpiryValue && payment.expiry_month && payment.expiry_year) {
        // Yılın son 2 hanesini al (örn: 2027 -> 27)
        const yearShort = String(payment.expiry_year).slice(-2);
        // Ayı 2 haneli formatla (örn: 12 -> 12, 1 -> 01)
        const month = String(payment.expiry_month).padStart(2, '0');
        cardExpiryValue.textContent = `${month}/${yearShort}`;
    }
    
    // Kart sahibi bilgisi
    const cardHolderEl = document.getElementById('card-holder-name');
    if (cardHolderEl && payment.card_holder_name) {
        cardHolderEl.textContent = payment.card_holder_name;
    }
}

/**
 * Plan özelliklerini yükle
 */
async function loadPlanFeatures(apiBase, planId) {
    try {
        const response = await fetch(`${apiBase}/public/plans`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
            const plan = result.data.find(p => Number(p.id) === Number(planId));
            if (plan) {
                // Özellikleri parse et
                let features = [];
                if (plan.ozellikler) {
                    if (typeof plan.ozellikler === 'string') {
                        try {
                            features = JSON.parse(plan.ozellikler);
                        } catch (e) {
                            // JSON değilse, virgülle ayrılmış string olabilir
                            features = plan.ozellikler.split(',').map(f => f.trim()).filter(f => f);
                        }
                    } else if (Array.isArray(plan.ozellikler)) {
                        features = plan.ozellikler;
                    }
                }
                updatePlanFeatures(features, planId);
            }
        }
    } catch (error) {
        // Hata sessizce yok sayılıyor
    }
}

/**
 * Plan özelliklerini güncelle
 * @param {string[]} features
 * @param {number} [planId] — Profesyonel (2) için yapay zeka satırında "ÖNE ÇIKAN ÖZELLİK"
 */
function updatePlanFeatures(features, planId) {
    const featuresList = document.getElementById('plan-features-list');
    if (!featuresList) return;
    
    featuresList.innerHTML = '';
    
    if (features.length === 0) {
        featuresList.innerHTML = '<li class="feature-item">Özellik bilgisi bulunmuyor.</li>';
        return;
    }
    
    const pid = Number(planId);
    features.forEach(feature => {
        const fLower = (feature || '').toLowerCase();
        const isAiFeatured = pid === 2 && isYapayZekaSiparisAnalizOzellik(feature);
        const isPinkFeatured = fLower.includes('whatsapp') || fLower.includes('araç takip') || fLower.includes('arac takip') || fLower.includes('kampanya') || fLower.includes('çiçek sepeti') || fLower.includes('cicek sepeti') || fLower.includes('ciceksepeti');
        let badgeHtml = '';
        if (isAiFeatured) {
            badgeHtml = '<span class="feature-item-badge feature-item-badge--ai-featured">ÖNE ÇIKAN ÖZELLİK</span>';
        } else if (isPinkFeatured) {
            badgeHtml = '<span class="feature-item-badge">Öne çıkan</span>';
        }
        const safeText = escapeHtmlDashboard(feature);
        const li = document.createElement('li');
        li.className = 'feature-item';
        li.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span class="feature-item-text">${safeText}</span>
            ${badgeHtml}
        `;
        featuresList.appendChild(li);
    });
}

/**
 * Plan modal'ı için planları yükle
 */
async function loadPlansForModal(apiBase) {
    try {
        // Mevcut plan bilgisini al
        const currentPlanName = document.getElementById('plan-name-text')?.textContent || '';
        const currentPlanNameModal = document.getElementById('current-plan-name-modal');
        if (currentPlanNameModal) {
            currentPlanNameModal.textContent = currentPlanName || 'Bilinmeyen Plan';
        }
        
        // Tüm planları çek
        const response = await fetch(`${apiBase}/public/plans`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        const plansContainer = document.getElementById('plans-list-container');
        if (!plansContainer) {
            console.error('❌ plans-list-container bulunamadı!');
            return;
        }
        
        plansContainer.innerHTML = '';
        
        if (!result.success || !result.data || result.data.length === 0) {
            plansContainer.innerHTML = '<p style="padding: 20px; text-align: center; color: #6b7280;">Plan bulunamadı.</p>';
            return;
        }
        
        // Mevcut plan ID'sini ve billing period'u al (subscription bilgisinden)
        // Plan yoksa (Plan Yok durumunda) currentPlanId null olmalı
        const subscriptionCard = document.querySelector('.subscription-card');
        const planNameText = document.getElementById('plan-name-text')?.textContent || '';
        const hasActivePlan = planNameText && planNameText !== 'Plan Yok' && subscriptionCard?.hasAttribute('data-current-plan-id');
        const currentPlanId = hasActivePlan ? subscriptionCard?.dataset.currentPlanId : null;
        
        // Mevcut planın billing period'unu al - data attribute'dan direkt al
        const currentBillingPeriod = hasActivePlan && subscriptionCard?.hasAttribute('data-current-billing-period') 
            ? subscriptionCard.dataset.currentBillingPeriod 
            : null;
        
        // Billing period'a göre fiyat hesapla - ÖNCE tanımla
        const billingPeriod = window.dashboardBillingPeriod || 'monthly';
        const isYearly = billingPeriod === 'yearly' || billingPeriod === 'yillik';
        
        // formatTurkishLira fonksiyonunun tanımlı olduğundan emin ol - ÖNCE KONTROL ET
        if (typeof formatTurkishLira !== 'function') {
            console.error('❌ formatTurkishLira fonksiyonu tanımlı değil! Fallback kullanılıyor.');
            // Fallback: Basit formatlama
            window.formatTurkishLira = function(amount) {
                const lira = amount >= 100 ? (amount / 100) : amount;
                return lira.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₺';
            };
        }
        
        result.data.forEach((plan, index) => {
            try {
                // Mevcut plan kontrolü: Plan ID VE billing period eşleşmeli
                const isCurrent = hasActivePlan && currentPlanId && plan.id == currentPlanId && 
                                 currentBillingPeriod && 
                                 ((currentBillingPeriod === 'yearly' && billingPeriod === 'yearly') || 
                                  (currentBillingPeriod === 'monthly' && billingPeriod === 'monthly'));
                const planOption = document.createElement('div');
                planOption.className = `plan-option ${isCurrent ? 'current' : ''}`;
                
                let displayPrice, priceText, monthlyPrice, yearlyPrice;
                const aylikUcret = plan.aylik_ucret || 0;
                const yillikUcret = plan.yillik_ucret || 0;
                
                let priceNote = '';
                
                if (isYearly && yillikUcret > 0) {
                    // Yıllık: TOPLAM yıllık fiyatı göster (veritabanından gelen yillik_ucret)
                    displayPrice = formatTurkishLira(yillikUcret);
                    priceText = `${displayPrice}/yıl`;
                    monthlyPrice = aylikUcret;
                    yearlyPrice = yillikUcret;
                    
                    // Yıllık paket açıklaması - aylık eşdeğer fiyatı da göster
                    const monthlyEquivalentPrice = formatTurkishLira(Math.round((yillikUcret / 100) / 12 * 100));
                    const yearlyTotalPrice = formatTurkishLira(yillikUcret);
                    priceNote = `<span class="plan-price-note" style="font-size: 0.75rem; color: #6b7280; display: block; margin-top: 4px;">Yıllık ödeme: ${yearlyTotalPrice} (${monthlyEquivalentPrice}/ay eşdeğer) | Aylık olarak faturalandırılır</span>`;
                } else {
                    // Aylık: DOĞRUDAN veritabanından gelen aylik_ucret değerini göster
                    displayPrice = formatTurkishLira(aylikUcret);
                    priceText = `${displayPrice}/ay`;
                    monthlyPrice = aylikUcret;
                    yearlyPrice = yillikUcret;
                    
                    // Aylık paket açıklaması
                    const monthlyTotalPrice = formatTurkishLira(aylikUcret);
                    priceNote = `<span class="plan-price-note" style="font-size: 0.75rem; color: #6b7280; display: block; margin-top: 4px;">Aylık: ${monthlyTotalPrice} olarak faturalandırılır.</span>`;
                }
                
                // Özellikleri parse et
                let features = [];
                if (plan.ozellikler) {
                    if (typeof plan.ozellikler === 'string') {
                        try {
                            features = JSON.parse(plan.ozellikler);
                        } catch (e) {
                            // JSON değilse, virgülle ayrılmış string olabilir
                            features = plan.ozellikler.split(',').map(f => f.trim()).filter(f => f);
                        }
                    } else if (Array.isArray(plan.ozellikler)) {
                        features = plan.ozellikler;
                    }
                }
                
                planOption.innerHTML = `
                    <div class="plan-option-header">
                        <div>
                            <h4>${plan.plan_adi || 'Bilinmeyen Plan'}</h4>
                            <span class="plan-price">${priceText}</span>
                            ${priceNote}
                        </div>
                        ${isCurrent ? '<span class="current-badge">Mevcut Plan</span>' : ''}
                    </div>
                    <ul class="plan-option-features">
                        ${features.length > 0 ? features.map(f => {
                            const esc = escapeHtmlDashboard(f);
                            const aiBadge = Number(plan.id) === 2 && isYapayZekaSiparisAnalizOzellik(f)
                                ? '<span class="plan-option-feature-badge">ÖNE ÇIKAN ÖZELLİK</span>'
                                : '';
                            return `<li><span class="plan-option-feature-text">${esc}</span>${aiBadge}</li>`;
                        }).join('') : '<li>Özellik bilgisi bulunmuyor.</li>'}
                    </ul>
                    <button type="button" class="plan-select-btn ${isCurrent ? 'disabled' : ''}" ${isCurrent ? 'disabled' : ''} data-plan-id="${plan.id}" data-plan-name="${plan.plan_adi || 'Bilinmeyen Plan'}" data-monthly-price="${monthlyPrice}" data-yearly-price="${yearlyPrice}">
                        ${isCurrent ? 'Mevcut Plan' : 'Bu Plana Geç'}
                    </button>
                `;
                
                plansContainer.appendChild(planOption);
                // "Bu Plana Geç" tıklaması initModalListeners içindeki event delegation ile (#plans-list-container) yakalanıyor
            } catch (planError) {
                console.error(`❌ Plan render hatası (plan ${index}):`, planError, plan);
            }
        });
        
        const btns = plansContainer.querySelectorAll('.plan-select-btn');
        
    } catch (error) {
        console.error('❌ Planlar yüklenirken hata:', error);
        const plansContainer = document.getElementById('plans-list-container');
        if (plansContainer) {
            plansContainer.innerHTML = `<p style="color: #ef4444; padding: 20px; text-align: center;">Planlar yüklenirken bir hata oluştu: ${error.message || 'Bilinmeyen hata'}</p>`;
        }
    }
}

/**
 * Fatura geçmişini yükle
 */
async function loadBillingHistory(apiBase, tenantCode) {
    try {
        const response = await fetch(`${apiBase}/public/billing-history?tenant_code=${tenantCode}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            // result.data her zaman bir array olmalı
            const invoices = Array.isArray(result.data) ? result.data : [];
            updateBillingHistory(invoices);
            // Event delegation'ı tekrar kur
            setupBillingDownloadListeners();
        } else {
            const billingList = document.querySelector('.billing-list');
            if (billingList) {
                billingList.innerHTML = '<div style="text-align: center; padding: 32px; color: #6b7280;">Henüz fatura bulunmuyor.</div>';
            }
        }
        
    } catch (error) {
        const billingList = document.querySelector('.billing-list');
        if (billingList) {
            billingList.innerHTML = `<div style="text-align: center; padding: 32px; color: #ef4444;">
                <p>Fatura geçmişi yüklenirken bir hata oluştu.</p>
                <p style="font-size: 0.875rem; color: #6b7280; margin-top: 8px;">${error.message || 'Bilinmeyen hata'}</p>
            </div>`;
        }
    }
}

/**
 * Fatura geçmişini güncelle
 */
function updateBillingHistory(invoices) {
    const billingList = document.querySelector('.billing-list');
    if (!billingList) return;
    
    // Mevcut içeriği temizle
    billingList.innerHTML = '';
    
    if (invoices.length === 0) {
        billingList.innerHTML = '<div style="text-align: center; padding: 32px; color: #6b7280;">Henüz fatura bulunmuyor.</div>';
        return;
    }
    
    // Her fatura için item oluştur
    invoices.forEach(invoice => {
        const billingItem = document.createElement('div');
        billingItem.className = 'billing-item';
        
        // Tarih formatla - invoice_date veya date olabilir
        const invoiceDate = invoice.invoice_date || invoice.date || invoice.fatura_tarihi;
        let formattedDate = '';
        if (invoiceDate) {
            try {
                const date = new Date(invoiceDate);
                if (!isNaN(date.getTime())) {
                    formattedDate = date.toLocaleDateString('tr-TR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                }
            } catch (e) {
            }
        }
        
        // Tutar formatla - backend kuruş gönderir
        const invoiceAmount = invoice.toplam_tutar ?? invoice.amount ?? 0;
        const amount = formatTurkishLira(invoiceAmount);
        
        // Durum formatla
        const invoiceStatus = invoice.durum || invoice.status || 'pending';
        const statusClass = (invoiceStatus === 'paid' || invoiceStatus === 'odendi' || invoiceStatus === 'aktif') ? 'paid' : 'pending';
        const statusText = (invoiceStatus === 'paid' || invoiceStatus === 'odendi' || invoiceStatus === 'aktif') ? 'Ödendi' : 'Beklemede';
        
        // Plan adı ve billing period
        const planName = invoice.plan_name || invoice.plan_adi || 'Bilinmeyen Plan';
        const billingPeriod = invoice.billing_period || invoice.odeme_periyodu || 'aylik';
        // Backend'den gelen değer 'yillik' veya 'aylik' olabilir, string kontrolü yap
        const billingPeriodLower = String(billingPeriod).toLowerCase();
        const billingPeriodText = (billingPeriodLower === 'yillik' || billingPeriodLower === 'yearly') ? 'Yıllık' : 'Aylık';
        
        // Yıllık planda: yıllık toplam tutar KDV dahil (aylık x 12) badge için
        const rawKurus = Number(invoice.toplam_tutar ?? invoice.amount ?? 0) || 0;
        const yearlyBadgeHtml = (billingPeriodLower === 'yillik' || billingPeriodLower === 'yearly')
            ? `<span class="billing-yearly-badge">Yıllık: ${formatTurkishLira(rawKurus * 12)} (KDV Dahil) Aylık olarak faturalandırılır</span>`
            : '';
        
        // Fatura numarası
        const faturaNo = invoice.fatura_no || '';
        
        // Ödeme yöntemi bilgisi
        const paymentMethod = invoice.payment_method;
        let paymentMethodHtml = '';
        if (paymentMethod && paymentMethod.last4) {
            // Her zaman kart ikonu kullan
            const paymentIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>`;
            paymentMethodHtml = `
                <div class="billing-payment-method">
                    ${paymentIcon}
                    <span>Ödeme Yöntemi: ${paymentMethod.type_text || 'Kart'} •••• ${paymentMethod.last4}</span>
                </div>
            `;
        }
        
        // PDF indirme butonu (her zaman tıklanabilir; sunucu yoksa PDF'yi anında oluşturur)
        const hasPdf = true;
        const tenantCode = new URLSearchParams(window.location.search).get('tenant') || localStorage.getItem('tenant_code') || '';
        
        billingItem.innerHTML = `
            <div class="billing-item-header">
                <div class="billing-item-header-left">
                    ${faturaNo ? `<div class="billing-invoice-number">Fatura No: <strong>${faturaNo}</strong></div>` : ''}
                    <div class="billing-date">Fatura Tarihi: <strong>${formattedDate || 'Tarih belirtilmemiş'}</strong></div>
                </div>
                <div class="billing-item-header-right">
                    <span class="billing-status ${statusClass}">${statusText}</span>
                </div>
            </div>
            
            <div class="billing-item-body">
                <div class="billing-item-main">
                    <div class="billing-plan-info">
                        <div class="billing-plan-name-wrapper">
                            <div class="billing-plan-name">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                                <span>${planName}</span>
                            </div>
                            <div class="billing-period">${billingPeriodText} Abonelik</div>
                            ${yearlyBadgeHtml}
                        </div>
                        ${paymentMethodHtml}
                    </div>
                    <div class="billing-amount-section">
                        <div class="billing-amount-label">Toplam Tutar</div>
                        <div class="billing-amount">${amount}</div>
                    </div>
                </div>
            </div>
            
            <div class="billing-item-footer">
                <button class="billing-download-btn ${hasPdf ? '' : 'disabled'}" 
                        data-invoice-id="${invoice.id}" 
                        data-tenant-code="${tenantCode}"
                        data-has-pdf="${hasPdf}"
                        title="Faturayı PDF olarak indir">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" x2="12" y1="15" y2="3"/>
                    </svg>
                    <span>PDF İndir</span>
                </button>
            </div>
        `;
        
        billingList.appendChild(billingItem);
    });
}

/**
 * Fatura PDF indir
 */
async function downloadInvoice(invoiceId, tenantCode, faturaNo) {
    try {
        if (!invoiceId || !tenantCode) {
            if (typeof window.createToast === 'function') {
                window.createToast('error', 'Fatura bilgileri eksik');
            } else if (typeof createToast === 'function') {
                createToast('error', 'Fatura bilgileri eksik');
            }
            return;
        }
        
        // İndirme URL'i: dashboard ile aynı API base kullan (config/port uyumu için)
        const baseForDownload = window.dashboardApiBase
            || (typeof window.getFloovonApiBase === 'function' ? window.getFloovonApiBase() : null)
            || window.API_BASE_URL
            || (window.location.origin && (window.location.origin.startsWith('http:') || window.location.origin.startsWith('https:')) ? window.location.origin + '/api' : null)
            || ('http://localhost:' + (localStorage.getItem('backend_port') || '3001') + '/api');
        const downloadUrl = `${baseForDownload}/public/invoice/${invoiceId}/pdf?tenant_code=${encodeURIComponent(tenantCode)}`;
        
        // Toast göster (indirme başladı)
        if (typeof window.createToast === 'function') {
            window.createToast('info', 'Fatura indiriliyor...');
        } else if (typeof createToast === 'function') {
            createToast('info', 'Fatura indiriliyor...');
        }
        
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `fatura-${(faturaNo || invoiceId).replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Başarı mesajı
        setTimeout(() => {
            if (typeof window.createToast === 'function') {
                window.createToast('success', 'Fatura başarıyla indirildi');
            } else if (typeof createToast === 'function') {
                createToast('success', 'Fatura başarıyla indirildi');
            }
        }, 500);
        
    } catch (error) {
        if (typeof window.createToast === 'function') {
            window.createToast('error', 'Fatura indirilemedi: ' + (error.message || 'Bilinmeyen hata'));
        } else if (typeof createToast === 'function') {
            createToast('error', 'Fatura indirilemedi: ' + (error.message || 'Bilinmeyen hata'));
        }
    }
}

/**
 * Türk Lirası formatında sayı formatla
 */
function formatTurkishLira(amount) {
    // Eğer amount kuruş cinsindeyse (örn: 349900 = 3499.00 TL)
    const lira = amount >= 100 ? (amount / 100) : amount;
    return lira.toLocaleString('tr-TR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }) + ' ₺';
}

/**
 * Tab değiştirme
 */
function initTabs() {
    const tabButtons = document.querySelectorAll('.sidebar-nav-item');
    const tabSections = document.querySelectorAll('.content-section');
    
    if (tabButtons.length === 0) return;
    
    tabButtons.forEach((button, index) => {
        const targetTab = button.dataset.tab;
        if (!targetTab) return;
        
        button.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Tüm butonları ve section'ları deaktif et
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabSections.forEach(section => {
                section.style.display = 'none';
                section.classList.remove('active');
            });
            
            // Seçili butonu ve section'ı aktif et
            button.classList.add('active');
            const targetSection = document.getElementById(`${targetTab}-tab`);
            
            if (!targetSection) {
                console.error(`❌ Tab section bulunamadı: ${targetTab}-tab`);
                if (typeof window.createToast === 'function') {
                    window.createToast('error', `Tab section bulunamadı: ${targetTab}`);
                }
                return;
            }
            
            // subscription-tab için flex, diğerleri için block
            if (targetTab === 'subscription') {
                targetSection.style.display = 'flex';
                // Subscription tab açıldığında fatura geçmişini yeniden yükle
                const urlParams = new URLSearchParams(window.location.search);
                const tenantCode = urlParams.get('tenant') || localStorage.getItem('tenant_code');
                if (tenantCode) {
                    const isFileProtocol = window.location.protocol === 'file:';
                    const isLocalhost = window.location.hostname === 'localhost' || 
                                       window.location.hostname === '127.0.0.1' || 
                                       !window.location.hostname ||
                                       isFileProtocol;
                    const apiBase = window.API_BASE_URL || 
                        (isLocalhost
                            ? 'http://localhost:' + (localStorage.getItem('backend_port') || '3001') + '/api'
                            : '/api');
                    // Fatura geçmişini yükle
                    await loadBillingHistory(apiBase, tenantCode);
                }
            } else {
                targetSection.style.display = 'block';
            }
            targetSection.classList.add('active');
        });
    });
}

/**
 * Modal event listener'ları
 */
function initModalListeners() {
    // Modal overlay
    const modalOverlay = document.getElementById('modal-overlay');
    
    // Tüm modal kapatma butonları
    const closeButtons = document.querySelectorAll('[data-close-modal]');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });
    
    // Overlay'e tıklayınca kapat
    if (modalOverlay) {
        modalOverlay.addEventListener('click', closeAllModals);
    }
    
    
    // Cancel plan butonu
    const cancelPlanBtn = document.getElementById('cancel-plan-btn');
    if (cancelPlanBtn) {
        cancelPlanBtn.addEventListener('click', () => {
            // Textarea'yı temizle
            const cancelReasonTextarea = document.getElementById('cancel-reason');
            if (cancelReasonTextarea) {
                cancelReasonTextarea.value = '';
                cancelReasonTextarea.classList.remove('error');
            }
            openModal('cancel-plan-modal');
        });
    }
    
    // Edit payment butonu (subscription tab içinde)
    const editPaymentBtn = document.getElementById('edit-payment-btn');
    if (editPaymentBtn) {
        editPaymentBtn.addEventListener('click', async () => {
            // Ödeme yöntemi bilgilerini yükle
            const apiBase = window.dashboardApiBase || (typeof window.getFloovonApiBase === 'function' ? window.getFloovonApiBase() : window.API_BASE_URL || '/api');
            const tenantCode = new URLSearchParams(window.location.search).get('tenant') || localStorage.getItem('tenant_code');
            if (tenantCode) {
                await loadPaymentMethodForEdit(apiBase, tenantCode);
            }
            // Modal'ı aç
            openModal('payment-edit-modal');
        });
    }
    
    // Upgrade plan butonu
    const upgradePlanBtn = document.getElementById('upgrade-plan-btn');
    if (upgradePlanBtn) {
        upgradePlanBtn.addEventListener('click', async () => {
            // Planları yükle ve modal'ı aç
            const apiBase = window.dashboardApiBase || (typeof window.getFloovonApiBase === 'function' ? window.getFloovonApiBase() : window.API_BASE_URL || '/api');
            const tenantCode = new URLSearchParams(window.location.search).get('tenant') || localStorage.getItem('tenant_code');
            
            // Abonelik durumunu kontrol et
            let isCancelled = false;
            try {
                const subResponse = await fetch(`${apiBase}/public/subscription?tenant_code=${tenantCode}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include'
                });
                if (subResponse.ok) {
                    const subResult = await subResponse.json();
                    if (subResult.success && subResult.data) {
                        const status = subResult.data.status || subResult.data.durum;
                        isCancelled = status === 'iptal_talebi' || status === 'iptal_console' || status === 'iptal' || !subResult.data.plan_id;
                    } else {
                        isCancelled = true; // Plan yoksa
                    }
                }
            } catch (e) {
                // Hata durumunda varsayılan olarak "Plan Değiştir" kullan
            }
            
            // Modal başlığını güncelle
            const modalTitle = document.querySelector('#upgrade-plan-modal h3');
            if (modalTitle) {
                modalTitle.textContent = isCancelled ? 'Yeni Plan Seç' : 'Plan Değiştir';
            }
            
            // Plan yoksa toggle'ı sıfırla ve mevcut plan bilgisini temizle (Yeni Plan Seç'te hiçbir plan "Mevcut" sayılmasın)
            if (isCancelled) {
                window.dashboardBillingPeriod = 'monthly'; // Toggle'ı aylık olarak sıfırla
                const toggleMonthly = document.getElementById('dashboard-toggle-monthly');
                const toggleYearly = document.getElementById('dashboard-toggle-yearly');
                if (toggleMonthly && toggleYearly) {
                    toggleMonthly.classList.add('active');
                    toggleYearly.classList.remove('active');
                }
                // Yeni Plan Seç modunda karttaki eski plan id'yi kaldır ki tüm planlar seçilebilir olsun
                const subscriptionCard = document.querySelector('.subscription-card');
                if (subscriptionCard) {
                    subscriptionCard.removeAttribute('data-current-plan-id');
                    subscriptionCard.removeAttribute('data-current-billing-period');
                }
            }
            
            // Önce planları yükle, sonra modal'ı aç
            try {
                await loadPlansForModal(apiBase);
                // Planlar yüklendikten sonra modal'ı aç
                openModal('upgrade-plan-modal');
                const planBtns = document.querySelectorAll('#upgrade-plan-modal .plan-select-btn');
                // Kontrol: Eğer planlar yüklenmediyse hata mesajı göster
                setTimeout(() => {
                    const plansContainer = document.getElementById('plans-list-container');
                    if (plansContainer && plansContainer.children.length === 0) {
                        console.error('❌ Planlar yüklenmedi!');
                        plansContainer.innerHTML = '<p style="padding: 20px; text-align: center; color: #ef4444;">Planlar yüklenirken bir sorun oluştu. Lütfen sayfayı yenileyin.</p>';
                    }
                }, 500);
            } catch (loadError) {
                console.error('❌ Planlar yüklenirken hata:', loadError);
                // Hata olsa bile modal'ı aç ve hata mesajı göster
                openModal('upgrade-plan-modal');
                const plansContainer = document.getElementById('plans-list-container');
                if (plansContainer) {
                    plansContainer.innerHTML = `<p style="padding: 20px; text-align: center; color: #ef4444;">Planlar yüklenirken bir hata oluştu: ${loadError.message || 'Bilinmeyen hata'}</p>`;
                }
            }
        });
    }

    // Plan değiştir modalı: "Bu Plana Geç" tıklamaları – document delegation (modal dinamik yüklendiği için)
    document.addEventListener('click', async function planSwitchHandler(e) {
        const target = e.target;
        const btn = target.closest('#upgrade-plan-modal .plan-select-btn');
        if (!btn || btn.disabled) return;
        e.preventDefault();
        e.stopPropagation();
        const planId = btn.dataset.planId;
        const planName = btn.dataset.planName || 'Plan';
        const billingPeriod = window.dashboardBillingPeriod || 'monthly';
        if (!planId) return;
        await upgradePlan(planId, planName, billingPeriod);
        // Modal kapatma: onayda upgradePlan içinde closeAllModals çağrılıyor; iptalde modal açık kalsın
    });
    
    // Save profile butonu
    const saveProfileBtn = document.getElementById('save-profile-btn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async () => {
            await saveProfileInfo();
        });
    }
    
    // Profile edit modal açıldığında değerleri doldur
    const profileEditBtn = document.querySelector('.edit-button');
    if (profileEditBtn) {
        profileEditBtn.addEventListener('click', () => {
            // Mevcut değerleri modal'a kopyala
            const businessName = document.getElementById('info-business-name')?.textContent || '';
            const fullName = document.getElementById('info-fullname')?.textContent || '';
            const email = document.getElementById('info-email')?.textContent || '';
            const phone = document.getElementById('info-phone')?.textContent || '';
            const cityState = document.getElementById('info-city-state')?.textContent || '';
            const address = document.getElementById('info-address')?.textContent || '';
            const taxOffice = document.getElementById('info-tax-office')?.textContent || '';
            const taxNumber = document.getElementById('info-tax-number')?.textContent || '';
            
            // İl / İlçe'yi ayır
            let city = '';
            let district = '';
            if (cityState && cityState !== '-') {
                const parts = cityState.split(' / ');
                city = parts[0] || '';
                district = parts[1] || '';
            }
            
            document.getElementById('modal-business-name').value = businessName;
            document.getElementById('modal-fullname').value = fullName;
            document.getElementById('modal-email').value = email;
            document.getElementById('modal-phone').value = phone;
            document.getElementById('modal-city').value = city;
            document.getElementById('modal-district').value = district;
            document.getElementById('modal-address').value = address === '-' ? '' : address;
            document.getElementById('modal-tax-office').value = taxOffice === '-' ? '' : taxOffice;
            document.getElementById('modal-tax-number').value = taxNumber === '-' ? '' : taxNumber;
            
            openModal('profile-edit-modal');
        });
    }
    
    // Confirm cancel butonu
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    if (confirmCancelBtn) {
        confirmCancelBtn.addEventListener('click', async () => {
            await cancelSubscription();
        });
    }
    
    // İptal nedeni textarea validasyonu
    const cancelReasonTextarea = document.getElementById('cancel-reason');
    if (cancelReasonTextarea) {
        cancelReasonTextarea.addEventListener('blur', function() {
            if (!this.value.trim()) {
                this.classList.add('error');
            } else {
                this.classList.remove('error');
            }
        });
        
        cancelReasonTextarea.addEventListener('input', function() {
            // Kullanıcı yazmaya başladığında error class'ını kaldır
            if (this.classList.contains('error')) {
                this.classList.remove('error');
            }
        });
    }
    
    // Save payment modal butonu
    const savePaymentModalBtn = document.getElementById('save-payment-modal-btn');
    if (savePaymentModalBtn) {
        savePaymentModalBtn.addEventListener('click', async () => {
            const tenantCode = new URLSearchParams(window.location.search).get('tenant') || localStorage.getItem('tenant_code');
            if (!tenantCode) {
                if (typeof window.createToast === 'function') {
                    window.createToast('error', 'Tenant kodu bulunamadı');
                } else if (typeof createToast === 'function') {
                    createToast('error', 'Tenant kodu bulunamadı');
                } else if (typeof window.showToast === 'function') {
                    window.showToast('Tenant kodu bulunamadı', 'error');
                }
                return;
            }
            const apiBase = window.dashboardApiBase || (typeof window.getFloovonApiBase === 'function' ? window.getFloovonApiBase() : window.API_BASE_URL || '/api');
            if (!apiBase || typeof apiBase !== 'string') {
                if (typeof window.createToast === 'function') {
                    window.createToast('error', 'API bağlantı hatası');
                } else if (typeof createToast === 'function') {
                    createToast('error', 'API bağlantı hatası');
                } else if (typeof window.showToast === 'function') {
                    window.showToast('API bağlantı hatası', 'error');
                }
                return;
            }
            await savePaymentMethod(apiBase, tenantCode);
        });
    }
    
    // Save payment form butonu (subscription tab içindeki form)
    const savePaymentFormBtn = document.getElementById('save-payment-btn');
    if (savePaymentFormBtn) {
        savePaymentFormBtn.addEventListener('click', async () => {
            const tenantCode = new URLSearchParams(window.location.search).get('tenant') || localStorage.getItem('tenant_code');
            if (!tenantCode) {
                if (typeof window.createToast === 'function') {
                    window.createToast('error', 'Tenant kodu bulunamadı');
                } else if (typeof createToast === 'function') {
                    createToast('error', 'Tenant kodu bulunamadı');
                } else if (typeof window.showToast === 'function') {
                    window.showToast('Tenant kodu bulunamadı', 'error');
                }
                return;
            }
            const apiBase = window.dashboardApiBase || (typeof window.getFloovonApiBase === 'function' ? window.getFloovonApiBase() : window.API_BASE_URL || '/api');
            if (!apiBase || typeof apiBase !== 'string') {
                if (typeof window.createToast === 'function') {
                    window.createToast('error', 'API bağlantı hatası');
                } else if (typeof createToast === 'function') {
                    createToast('error', 'API bağlantı hatası');
                } else if (typeof window.showToast === 'function') {
                    window.showToast('API bağlantı hatası', 'error');
                }
                return;
            }
            await savePaymentMethod(apiBase, tenantCode, 'form');
        });
    }
    
    // Cancel payment form butonu
    const cancelPaymentFormBtn = document.getElementById('cancel-payment-btn');
    if (cancelPaymentFormBtn) {
        cancelPaymentFormBtn.addEventListener('click', () => {
            const paymentEditForm = document.getElementById('payment-edit-form');
            const paymentDisplay = document.getElementById('payment-display');
            if (paymentEditForm) paymentEditForm.style.display = 'none';
            if (paymentDisplay) paymentDisplay.style.display = 'block';
        });
    }
    
    // Kart numarası formatlaması
    const cardNumberInputs = document.querySelectorAll('#modal-card-number, #edit-card-number');
    cardNumberInputs.forEach(input => {
        input.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\s/g, '').replace(/[^0-9]/gi, '');
            let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
            if (formattedValue.length > 19) formattedValue = formattedValue.substring(0, 19);
            e.target.value = formattedValue;
        });
    });
    
    // Son kullanma tarihi ay inputu - sadece 1-12 arası rakamlar
    const expiryMonthInputs = document.querySelectorAll('#modal-expiry-month, #edit-expiry-month');
    expiryMonthInputs.forEach(input => {
        input.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            
            // İlk rakam 0 veya 1 olabilir
            if (value.length > 0) {
                const firstDigit = parseInt(value[0]);
                if (firstDigit > 1) {
                    // İlk rakam 2-9 ise, sadece 1-9 arası olabilir (01-09)
                    value = value[0];
                } else if (firstDigit === 1 && value.length > 1) {
                    // İlk rakam 1 ise, ikinci rakam 0-2 olabilir (10-12)
                    const secondDigit = parseInt(value[1]);
                    if (secondDigit > 2) {
                        value = value[0];
                    } else {
                        value = value.substring(0, 2);
                    }
                } else if (firstDigit === 0 && value.length > 1) {
                    // İlk rakam 0 ise, ikinci rakam 1-9 olabilir (01-09)
                    const secondDigit = parseInt(value[1]);
                    if (secondDigit === 0) {
                        value = value[0];
                    } else {
                        value = value.substring(0, 2);
                    }
                }
            }
            
            e.target.value = value;
        });
        
        // Paste event'i için de temizle
        input.addEventListener('paste', function(e) {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            let value = pastedText.replace(/\D/g, '');
            
            // 1-12 arası kontrolü
            const numValue = parseInt(value);
            if (numValue >= 1 && numValue <= 12) {
                e.target.value = String(numValue).padStart(2, '0');
            } else if (numValue > 12) {
                e.target.value = '12';
            } else if (value.length > 0) {
                e.target.value = value.substring(0, 2);
            }
        });
    });
}

/**
 * Ödeme yöntemi düzenle formunu doldur
 */
async function loadPaymentMethodForEdit(apiBase, tenantCode) {
    try {
        const response = await fetch(`${apiBase}/public/subscription?tenant_code=${tenantCode}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.data && result.data.payment_method) {
            const payment = result.data.payment_method;
            
            // Modal inputları doldur
            const modalCardNumber = document.getElementById('modal-card-number');
            const modalCardHolder = document.getElementById('modal-card-holder');
            const modalExpiryMonth = document.getElementById('modal-expiry-month');
            const modalExpiryYear = document.getElementById('modal-expiry-year');
            const modalCvv = document.getElementById('modal-cvv');
            
            // Kart numarası - son 4 haneyi göster, geri kalanı *
            if (modalCardNumber && payment.last4) {
                modalCardNumber.value = `**** **** **** ${payment.last4}`;
            } else if (modalCardNumber) {
                modalCardNumber.value = '';
            }
            
            // Kart sahibi
            if (modalCardHolder) {
                modalCardHolder.value = payment.card_holder_name || '';
            }
            
            // Son kullanma tarihi
            if (modalExpiryMonth && payment.expiry_month) {
                modalExpiryMonth.value = String(payment.expiry_month).padStart(2, '0');
            } else if (modalExpiryMonth) {
                modalExpiryMonth.value = '';
            }
            if (modalExpiryYear && payment.expiry_year) {
                const yearShort = String(payment.expiry_year).slice(-2);
                modalExpiryYear.value = yearShort;
            } else if (modalExpiryYear) {
                modalExpiryYear.value = '';
            }
            
            // CVV gösterilmez (güvenlik)
            if (modalCvv) {
                modalCvv.value = '';
            }
            
            // Edit form inputları da doldur
            const editCardNumber = document.getElementById('edit-card-number');
            const editCardHolder = document.getElementById('edit-card-holder');
            const editExpiryMonth = document.getElementById('edit-expiry-month');
            const editExpiryYear = document.getElementById('edit-expiry-year');
            const editCvv = document.getElementById('edit-cvv');
            
            if (editCardNumber && payment.last4) {
                editCardNumber.value = `**** **** **** ${payment.last4}`;
            } else if (editCardNumber) {
                editCardNumber.value = '';
            }
            if (editCardHolder) {
                editCardHolder.value = payment.card_holder_name || '';
            }
            if (editExpiryMonth && payment.expiry_month) {
                editExpiryMonth.value = String(payment.expiry_month).padStart(2, '0');
            } else if (editExpiryMonth) {
                editExpiryMonth.value = '';
            }
            if (editExpiryYear && payment.expiry_year) {
                const yearShort = String(payment.expiry_year).slice(-2);
                editExpiryYear.value = yearShort;
            } else if (editExpiryYear) {
                editExpiryYear.value = '';
            }
            if (editCvv) {
                editCvv.value = '';
            }
        } else {
            // Ödeme bilgisi yoksa inputları temizle
            const modalCardNumber = document.getElementById('modal-card-number');
            const modalCardHolder = document.getElementById('modal-card-holder');
            const modalExpiryMonth = document.getElementById('modal-expiry-month');
            const modalExpiryYear = document.getElementById('modal-expiry-year');
            const editCardNumber = document.getElementById('edit-card-number');
            const editCardHolder = document.getElementById('edit-card-holder');
            const editExpiryMonth = document.getElementById('edit-expiry-month');
            const editExpiryYear = document.getElementById('edit-expiry-year');
            
            if (modalCardNumber) modalCardNumber.value = '';
            if (modalCardHolder) modalCardHolder.value = '';
            if (modalExpiryMonth) modalExpiryMonth.value = '';
            if (modalExpiryYear) modalExpiryYear.value = '';
            if (editCardNumber) editCardNumber.value = '';
            if (editCardHolder) editCardHolder.value = '';
            if (editExpiryMonth) editExpiryMonth.value = '';
            if (editExpiryYear) editExpiryYear.value = '';
        }
    } catch (error) {
        // Hata sessizce yok sayılıyor
    }
}

/**
 * Modal aç (scrollbar kaymasını önlemek için padding-right uygulanır)
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById('modal-overlay');
    
    if (modal && overlay) {
        var scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = scrollbarWidth + 'px';
        }
        document.body.classList.add('modal-open');
        modal.classList.add('active');
        overlay.classList.add('active');
    }
}

/**
 * Tüm modalları kapat
 */
function closeAllModals() {
    const modals = document.querySelectorAll('.side-modal');
    const overlay = document.getElementById('modal-overlay');
    
    modals.forEach(modal => modal.classList.remove('active'));
    if (overlay) overlay.classList.remove('active');
    document.body.classList.remove('modal-open');
    document.body.style.paddingRight = '';
}

/**
 * Ödeme yöntemini kaydet/güncelle (backend'e gönder)
 */
async function savePaymentMethod(apiBase, tenantCode, source = 'modal') {
    try {
        // Tenant ID'yi al
        const tenantResponse = await fetch(`${apiBase}/public/business-profile?tenant_code=${tenantCode}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!tenantResponse.ok) {
            throw new Error('Tenant bilgisi alınamadı');
        }
        
        const tenantResult = await tenantResponse.json();
        if (!tenantResult.success || !tenantResult.data) {
            throw new Error('Tenant bilgisi bulunamadı');
        }
        
        // Mevcut ödeme yöntemini al
        const paymentResponse = await fetch(`${apiBase}/public/subscription?tenant_code=${tenantCode}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!paymentResponse.ok) {
            throw new Error('Ödeme yöntemi bilgisi alınamadı');
        }
        
        const paymentResult = await paymentResponse.json();
        if (!paymentResult.success || !paymentResult.data) {
            throw new Error('Abonelik bilgisi alınamadı');
        }
        
        const existingPayment = paymentResult.data.payment_method || null;
        const paymentId = existingPayment && existingPayment.id ? existingPayment.id : null;
        
        // Form verilerini al
        let kartSahibi, kartNumarasi, sonKullanimAyi, sonKullanimYili;
        
        if (source === 'form') {
            // Subscription tab içindeki form
            kartSahibi = document.getElementById('edit-card-holder')?.value?.trim();
            kartNumarasi = document.getElementById('edit-card-number')?.value?.replace(/\s/g, '');
            sonKullanimAyi = document.getElementById('edit-expiry-month')?.value?.trim();
            sonKullanimYili = document.getElementById('edit-expiry-year')?.value?.trim();
        } else {
            // Modal form
            kartSahibi = document.getElementById('modal-card-holder')?.value?.trim();
            kartNumarasi = document.getElementById('modal-card-number')?.value?.replace(/\s/g, '');
            sonKullanimAyi = document.getElementById('modal-expiry-month')?.value?.trim();
            sonKullanimYili = document.getElementById('modal-expiry-year')?.value?.trim();
        }
        
        // Validasyon
        if (!kartSahibi) {
            if (typeof window.createToast === 'function') {
                window.createToast('error', 'Kart sahibi adı gereklidir');
            } else if (typeof createToast === 'function') {
                createToast('error', 'Kart sahibi adı gereklidir');
            } else if (typeof window.showToast === 'function') {
                window.showToast('Kart sahibi adı gereklidir', 'error');
            }
            return;
        }
        
        if (kartNumarasi && kartNumarasi.length < 13) {
            setTimeout(() => {
                if (typeof window.createToast === 'function') {
                    window.createToast('error', 'Geçerli bir kart numarası girin');
                } else if (typeof createToast === 'function') {
                    createToast('error', 'Geçerli bir kart numarası girin');
                } else if (typeof window.createToast === 'function') {
                    window.createToast('error', 'Geçerli bir kart numarası girin');
                } else if (typeof createToast === 'function') {
                    createToast('error', 'Geçerli bir kart numarası girin');
                }
            }, 100);
            return;
        }
        
        if (sonKullanimAyi && (!sonKullanimYili || sonKullanimYili.length !== 2)) {
            setTimeout(() => {
                if (typeof window.createToast === 'function') {
                    window.createToast('error', 'Geçerli bir son kullanma tarihi girin');
                } else if (typeof createToast === 'function') {
                    createToast('error', 'Geçerli bir son kullanma tarihi girin');
                } else if (typeof window.createToast === 'function') {
                    window.createToast('error', 'Geçerli bir son kullanma tarihi girin');
                } else if (typeof createToast === 'function') {
                    createToast('error', 'Geçerli bir son kullanma tarihi girin');
                }
            }, 100);
            return;
        }
        
        // Yıl formatını düzelt (YY -> YYYY)
        let sonKullanimYiliFull = null;
        if (sonKullanimYili) {
            sonKullanimYiliFull = parseInt('20' + sonKullanimYili);
        }
        
        const payload = {
            tenant_code: tenantCode,
            kart_sahibi_adi: kartSahibi
        };
        if (kartNumarasi) payload.kart_numarasi = kartNumarasi;
        if (sonKullanimAyi) payload.son_kullanim_ayi = parseInt(sonKullanimAyi);
        if (sonKullanimYiliFull) payload.son_kullanim_yili = sonKullanimYiliFull;

        let response;
        if (paymentId) {
            response = await fetch(`${apiBase}/public/payment-method/${paymentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });
        } else {
            response = await fetch(`${apiBase}/public/payment-method`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });
        }

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error || (paymentId ? 'Ödeme yöntemi güncellenemedi' : 'Ödeme yöntemi eklenemedi'));
        }
        const updateResult = await response.json();
        if (!updateResult.success) {
            throw new Error(updateResult.error || (paymentId ? 'Ödeme yöntemi güncellenemedi' : 'Ödeme yöntemi eklenemedi'));
        }
        
        setTimeout(() => {
            if (typeof window.createToast === 'function') {
                window.createToast('success', paymentId ? 'Ödeme yöntemi güncellendi!' : 'Ödeme yöntemi eklendi!');
            } else if (typeof createToast === 'function') {
                createToast('success', paymentId ? 'Ödeme yöntemi güncellendi!' : 'Ödeme yöntemi eklendi!');
            }
        }, 100);
        
        if (source === 'form') {
            const paymentEditForm = document.getElementById('payment-edit-form');
            const paymentDisplay = document.getElementById('payment-display');
            if (paymentEditForm) paymentEditForm.style.display = 'none';
            if (paymentDisplay) paymentDisplay.style.display = 'block';
            
            // Ödeme yöntemi bilgilerini yeniden yükle
            await loadSubscriptionInfo(apiBase, tenantCode);
        } else {
            closeAllModals();
            // Ödeme yöntemi bilgilerini yeniden yükle
            await loadSubscriptionInfo(apiBase, tenantCode);
        }
        
    } catch (error) {
        // Toast göster - toast script'i yüklenene kadar bekle
        setTimeout(() => {
            if (typeof window.createToast === 'function') {
                window.createToast('error', error.message || 'Ödeme yöntemi güncellenirken bir hata oluştu');
            } else if (typeof createToast === 'function') {
                createToast('error', error.message || 'Ödeme yöntemi güncellenirken bir hata oluştu');
            }
        }, 100);
    }
}

/**
 * Profil bilgilerini kaydet
 */
async function saveProfileInfo() {
    try {
        const apiBase = window.dashboardApiBase || (typeof window.getFloovonApiBase === 'function' ? window.getFloovonApiBase() : window.API_BASE_URL || '/api');
        const tenantCode = new URLSearchParams(window.location.search).get('tenant') || localStorage.getItem('tenant_code');
        
        if (!tenantCode) {
            if (typeof createToast === 'function') {
                createToast('error', 'Tenant kodu bulunamadı');
            } else if (typeof window.showToast === 'function') {
                window.showToast('Tenant kodu bulunamadı', 'error');
            }
            return;
        }
        
        // Form verilerini al
        const businessName = document.getElementById('modal-business-name')?.value?.trim();
        const fullName = document.getElementById('modal-fullname')?.value?.trim();
        const email = document.getElementById('modal-email')?.value?.trim();
        const phone = document.getElementById('modal-phone')?.value?.trim();
        const city = document.getElementById('modal-city')?.value?.trim();
        const district = document.getElementById('modal-district')?.value?.trim();
        const address = document.getElementById('modal-address')?.value?.trim();
        const taxOffice = document.getElementById('modal-tax-office')?.value?.trim();
        const taxNumber = document.getElementById('modal-tax-number')?.value?.trim();
        
        // Validasyon
        if (!businessName) {
            if (typeof createToast === 'function') {
                createToast('error', 'İşletme adı gereklidir');
            } else if (typeof window.showToast === 'function') {
                window.showToast('İşletme adı gereklidir', 'error');
            }
            return;
        }
        
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            if (typeof createToast === 'function') {
                createToast('error', 'Geçerli bir e-posta adresi girin');
            } else if (typeof window.showToast === 'function') {
                window.showToast('Geçerli bir e-posta adresi girin', 'error');
            }
            return;
        }
        
        // Backend'e kaydet
        const response = await fetch(`${apiBase}/public/business-profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                tenant_code: tenantCode,
                company_name: businessName,
                full_name: fullName,
                email: email,
                phone: phone,
                city: city,
                state: district, // Backend'de state olarak kaydediliyor
                address: address,
                tax_office: taxOffice,
                tax_number: taxNumber
            })
        });
        
        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error || 'Profil bilgileri kaydedilemedi');
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Profil bilgileri kaydedilemedi');
        }
        
        // Toast göster - toast script'i yüklenene kadar bekle
        setTimeout(() => {
            if (typeof window.createToast === 'function') {
                window.createToast('success', 'Profil bilgileri kaydedildi!');
            } else if (typeof createToast === 'function') {
                createToast('success', 'Profil bilgileri kaydedildi!');
            }
        }, 100);
        
        // Verileri yeniden yükle
        closeAllModals();
        const reloadApiBase = window.dashboardApiBase || (typeof window.getFloovonApiBase === 'function' ? window.getFloovonApiBase() : window.API_BASE_URL || '/api');
        await loadDashboardData(reloadApiBase, tenantCode);
        
    } catch (error) {
        // Toast göster - toast script'i yüklenene kadar bekle
        setTimeout(() => {
            if (typeof window.createToast === 'function') {
                window.createToast('error', error.message || 'Profil bilgileri kaydedilirken bir hata oluştu');
            } else if (typeof createToast === 'function') {
                createToast('error', error.message || 'Profil bilgileri kaydedilirken bir hata oluştu');
            }
        }, 100);
    }
}

/**
 * Dashboard pricing toggle
 */
function toggleDashboardPricing(period) {
    // Toggle butonlarını güncelle
    document.querySelectorAll('#dashboard-toggle-monthly, #dashboard-toggle-yearly').forEach(btn => btn.classList.remove('active'));
    if (period === 'yearly') {
        document.getElementById('dashboard-toggle-yearly')?.classList.add('active');
    } else {
        document.getElementById('dashboard-toggle-monthly')?.classList.add('active');
    }
    
    // Global billing period değişkenini güncelle
    window.dashboardBillingPeriod = period;
    
    // Planları yeniden yükle
    const apiBase = window.dashboardApiBase || (typeof window.getFloovonApiBase === 'function' ? window.getFloovonApiBase() : window.API_BASE_URL || '/api');
    loadPlansForModal(apiBase);
}

/**
 * Plan yükseltme
 */
async function upgradePlan(planId, planName, billingPeriod = null) {
    try {
        const apiBase = window.dashboardApiBase || (typeof window.getFloovonApiBase === 'function' ? window.getFloovonApiBase() : window.API_BASE_URL || '/api');
        const tenantCode = new URLSearchParams(window.location.search).get('tenant') || localStorage.getItem('tenant_code');
        if (!tenantCode) {
            const msg = 'Tenant kodu bulunamadı. Lütfen giriş yapın veya dashboard\'a tenant parametresi ile girin.';
            if (typeof window.createToast === 'function') {
                window.createToast('error', msg);
            } else if (typeof createToast === 'function') {
                createToast('error', msg);
            } else if (typeof window.showToast === 'function') {
                window.showToast(msg, 'error');
            } else {
                alert(msg);
            }
            return;
        }
        
        // Mevcut plan bilgisini al (karşılaştırma için)
        const subscriptionResponse = await fetch(`${apiBase}/public/subscription?tenant_code=${tenantCode}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!subscriptionResponse.ok) {
            throw new Error('Mevcut plan bilgisi alınamadı');
        }
        
        const subscriptionResult = await subscriptionResponse.json();
        const currentPlan = subscriptionResult.success && subscriptionResult.data ? subscriptionResult.data : null;
        
        // Yeni plan bilgisini al
        const plansResponse = await fetch(`${apiBase}/public/plans`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!plansResponse.ok) {
            throw new Error('Plan bilgisi alınamadı');
        }
        
        const plansResult = await plansResponse.json();
        const newPlan = plansResult.success && plansResult.data ? plansResult.data.find(p => p.id == planId) : null;
        if (!newPlan) {
            throw new Error('Yeni plan bulunamadı');
        }
        
        // Billing period'a göre fiyat hesapla
        const billingPeriodToUse = billingPeriod || window.dashboardBillingPeriod || 'monthly';
        const isYearly = billingPeriodToUse === 'yearly' || billingPeriodToUse === 'yillik';
        
        // Mevcut plan fiyatı (aylık)
        const currentPrice = currentPlan ? (currentPlan.monthly_price || currentPlan.aylik_ucret || 0) : 0;
        
        // Yeni plan fiyatı (billing period'a göre)
        let newPrice;
        if (isYearly && newPlan.yillik_ucret) {
            // Yıllık: yıllık fiyatın aylık eşdeğeri
            newPrice = Math.round(newPlan.yillik_ucret / 12);
        } else {
            // Aylık
            newPrice = newPlan.aylik_ucret || 0;
        }
        
        // Plan karşılaştırması
        const isUpgrade = newPrice > currentPrice;
        const isDowngrade = newPrice < currentPrice;
        const priceDifference = Math.abs(newPrice - currentPrice);
        
        // Onay mesajı oluştur
        let confirmMessage = '';
        if (isUpgrade) {
            const differenceFormatted = (priceDifference / 100).toLocaleString('tr-TR', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            });
            confirmMessage = `${planName} planına geçiş yapmak üzeresiniz.\n\n` +
                           `Aylık fark: ${differenceFormatted} ₺\n` +
                           `Yeni plan hemen aktif olacaktır ve fark tutarı kartınızdan çekilecektir.\n\n` +
                           `Devam etmek istiyor musunuz?`;
        } else if (isDowngrade) {
            const currentPeriodEnd = currentPlan && currentPlan.current_period_end 
                ? new Date(currentPlan.current_period_end).toLocaleDateString('tr-TR')
                : 'dönem sonu';
            confirmMessage = `${planName} planına geçiş yapmak üzeresiniz.\n\n` +
                           `Yeni plan ${currentPeriodEnd} tarihinde aktif olacaktır.\n` +
                           `Mevcut dönem sonuna kadar eski planınız devam edecektir.\n\n` +
                           `Devam etmek istiyor musunuz?`;
        } else {
            confirmMessage = `${planName} planına geçiş yapmak üzeresiniz.\n\n` +
                           `Devam etmek istiyor musunuz?`;
        }
        
        // Kullanıcıdan onay al - Toast notification ile
        return new Promise((resolve) => {
            if (typeof window.createToastInteractive === 'function') {
                window.createToastInteractive({
                    title: 'Plan Değişikliği',
                    message: confirmMessage.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>'),
                    confirmText: 'Evet, Devam Et',
                    cancelText: 'İptal',
                    isWarning: isUpgrade || isDowngrade,
                    onConfirm: async () => {
                        // Modal'ı hemen kapat (manage sayfası ile aynı mantık)
                        closeAllModals();
                        
                        // Backend'e plan değişikliği isteği gönder (loading overlay proceedWithPlanChange içinde gösterilecek)
                        const billingPeriodToUse = billingPeriod || window.dashboardBillingPeriod || 'monthly';
                        await proceedWithPlanChange(apiBase, tenantCode, planId, planName, billingPeriodToUse);
                        resolve();
                    },
                    onCancel: () => {
                        resolve();
                    }
                });
            } else {
                // Fallback: Eğer createToastInteractive yoksa, normal toast göster ve devam et
                if (typeof window.createToast === 'function') {
                    window.createToast('info', 'Plan değişikliği için onay gerekli');
                }
                // Modal'ı hemen kapat (manage sayfası ile aynı mantık)
                closeAllModals();
                
                // Direkt devam et (loading overlay proceedWithPlanChange içinde gösterilecek)
                const billingPeriodToUse = billingPeriod || window.dashboardBillingPeriod || 'monthly';
                proceedWithPlanChange(apiBase, tenantCode, planId, planName, billingPeriodToUse).then(() => resolve());
            }
        });
    } catch (error) {
        hideSubscriptionLoading();
        if (typeof window.createToast === 'function') {
            window.createToast('error', error.message || 'Plan değişikliği yapılamadı');
        } else if (typeof createToast === 'function') {
            createToast('error', error.message || 'Plan değişikliği yapılamadı');
        } else if (typeof window.showToast === 'function') {
            window.showToast(error.message || 'Plan değişikliği yapılamadı', 'error');
        }
    }
}

/**
 * Loading overlay göster/gizle (scrollbar kayması önlenir)
 */
function showSubscriptionLoading(message = 'İşleminiz gerçekleştiriliyor, lütfen bekleyin...') {
    const overlay = document.getElementById('subscription-loading-overlay');
    const textElement = overlay?.querySelector('.subscription-loading-text');
    if (overlay) {
        if (textElement) {
            textElement.textContent = message;
        }
        var scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = scrollbarWidth + 'px';
        }
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function hideSubscriptionLoading() {
    const overlay = document.getElementById('subscription-loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    }
}

/**
 * Plan değişikliğini gerçekleştir (onay sonrası)
 */
async function proceedWithPlanChange(apiBase, tenantCode, planId, planName, billingPeriod = 'monthly') {
    try {
        // Loading overlay göster
        showSubscriptionLoading('Plan değiştiriliyor ve faturanız oluşturuluyor, lütfen bekleyin...');
        // API base URL kontrolü
        if (!apiBase || apiBase.trim() === '') {
            throw new Error('API bağlantı hatası: API base URL tanımlı değil');
        }
        
        // URL'i oluştur - apiBase zaten /api içeriyor mu kontrol et
        let requestUrl;
        if (apiBase.endsWith('/api')) {
            requestUrl = `${apiBase}/public/change-plan`;
        } else if (apiBase.endsWith('/api/')) {
            requestUrl = `${apiBase}public/change-plan`;
        } else {
            requestUrl = `${apiBase}/api/public/change-plan`;
        }
        
        // Backend'e plan değişikliği isteği gönder
        const response = await fetch(requestUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                tenant_code: tenantCode,
                plan_id: parseInt(planId),
                billing_period: billingPeriod === 'yearly' || billingPeriod === 'yillik' ? 'yearly' : 'monthly'
            })
        });
        
        if (!response.ok) {
            hideSubscriptionLoading();
            let errorMessage = 'Plan değişikliği yapılamadı';
            try {
                const errorResult = await response.json();
                errorMessage = errorResult.error || errorResult.message || errorMessage;
            } catch (e) {
                // JSON parse hatası - response text olabilir
                if (response.status === 404) {
                    errorMessage = 'Plan değiştirme endpoint\'i bulunamadı. Lütfen backend sunucusunun çalıştığından emin olun.';
                } else {
                    errorMessage = `Sunucu hatası (${response.status}): ${response.statusText}`;
                }
            }
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        if (!result.success) {
            hideSubscriptionLoading();
            throw new Error(result.error || 'Plan değişikliği yapılamadı');
        }
        
        // Loading overlay'i hemen gizle - API işlemi tamamlandı
        hideSubscriptionLoading();
        
        // Başarı mesajı oluştur - ÖNCE is_new_subscription kontrolü yapılmalı
        let successMessage = '';
        if (result.data && result.data.is_new_subscription === true) {
            // İptal edilmiş abonelikten yeni plana geçiş = YENİ ABONELİK BAŞLATILDI
            successMessage = `🎉 Yeni abonelik başlatıldı! ${planName} planına başarıyla abone oldunuz. Aboneliğiniz hemen aktif edildi.`;
        } else if (result.data && result.data.is_upgrade === true) {
            // Aktif abonelikten daha yüksek plana geçiş
            const diffFormatted = result.data.price_difference 
                ? (result.data.price_difference / 100).toLocaleString('tr-TR', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                })
                : '0,00';
            successMessage = `${planName} planına başarıyla geçiş yaptınız! Yeni plan hemen aktif oldu. Fark tutarı (${diffFormatted} ₺) kartınızdan çekildi.`;
        } else if (result.data && result.data.is_downgrade) {
            // Aktif abonelikten daha düşük plana geçiş
            const effectiveDate = result.data.effective_date 
                ? new Date(result.data.effective_date).toLocaleDateString('tr-TR')
                : 'dönem sonu';
            successMessage = `Plan değişikliği kaydedildi. ${planName} planı ${effectiveDate} tarihinde aktif olacak.`;
        } else {
            // Aynı fiyat seviyesi plan değişikliği
            successMessage = `${planName} planına başarıyla geçiş yaptınız!`;
        }
        
        // Başarı toast göster - toast script'i yüklenene kadar bekle
        setTimeout(() => {
            if (typeof window.createToast === 'function') {
                window.createToast('success', successMessage);
            } else if (typeof createToast === 'function') {
                createToast('success', successMessage);
            }
        }, 100);
        
        const reloadApiBase = window.dashboardApiBase || (typeof window.getFloovonApiBase === 'function' ? window.getFloovonApiBase() : window.API_BASE_URL || '/api');
        
        // Console sayfasını senkronize et (aynı origin'de açıksa)
        try {
            const channel = new BroadcastChannel('floovon-admin-notifications');
            channel.postMessage({ type: 'subscription-updated', tenantCode: tenantCode });
            channel.close();
        } catch (_) {}

        // Kısa bir gecikme ile verileri yeniden yükle (backend'in güncellemesi için)
        // Overlay gizlendi, veriler arka planda sessizce yenilenecek
        setTimeout(async () => {
            try {
                // Abonelik bilgilerini yeniden yükle
                await loadSubscriptionInfo(reloadApiBase, tenantCode);
                
                // Fatura geçmişini yeniden yükle (yeni fatura listeye eklensin)
                await loadBillingHistory(reloadApiBase, tenantCode);
                
                // Dashboard verilerini de yeniden yükle (plan bilgileri güncellensin)
                await loadDashboardData(reloadApiBase, tenantCode);
            } catch (reloadError) {
                // Veri yenileme hatası sessizce handle edilir (kullanıcı zaten başarı mesajı aldı)
            }
            
            // Sayfa yenileme kaldırıldı - sadece veriler güncelleniyor
        }, 500);
        
    } catch (error) {
        hideSubscriptionLoading();
        if (typeof window.createToast === 'function') {
            window.createToast('error', error.message || 'Plan değişikliği yapılırken bir hata oluştu');
        } else if (typeof window.showToast === 'function') {
            window.showToast(error.message || 'Plan değişikliği yapılırken bir hata oluştu', 'error');
        }
    }
}

/**
 * Aboneliği iptal et
 * Mantık: Abonelik durumunu "iptal_talebi" olarak işaretler
 * Kullanıcıya bilgi verir ve abonelik mevcut dönem sonuna kadar devam eder
 */
async function cancelSubscription() {
    try {
        // İptal nedenini kontrol et
        const cancelReason = document.getElementById('cancel-reason')?.value?.trim();
        if (!cancelReason) {
            if (typeof window.createToast === 'function') {
                window.createToast('error', 'Lütfen iptal nedeninizi belirtin');
            } else if (typeof createToast === 'function') {
                createToast('error', 'Lütfen iptal nedeninizi belirtin');
            } else if (typeof window.showToast === 'function') {
                window.showToast('Lütfen iptal nedeninizi belirtin', 'error');
            }
            const cancelReasonInput = document.getElementById('cancel-reason');
            if (cancelReasonInput) {
                cancelReasonInput.focus();
                cancelReasonInput.classList.add('error');
            }
            return;
        }
        
        const apiBase = window.dashboardApiBase || (typeof window.getFloovonApiBase === 'function' ? window.getFloovonApiBase() : window.API_BASE_URL || '/api');
        const tenantCode = new URLSearchParams(window.location.search).get('tenant') || localStorage.getItem('tenant_code');
        
        if (!tenantCode) {
            if (typeof window.createToast === 'function') {
                window.createToast('error', 'Tenant kodu bulunamadı');
            } else if (typeof createToast === 'function') {
                createToast('error', 'Tenant kodu bulunamadı');
            } else if (typeof window.showToast === 'function') {
                window.showToast('Tenant kodu bulunamadı', 'error');
            }
            return;
        }
        
        // Loading overlay göster
        showSubscriptionLoading('Abonelik iptal ediliyor, lütfen bekleyin...');
        
        // Backend'e iptal isteği gönder
        const response = await fetch(`${apiBase}/public/cancel-subscription`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                tenant_code: tenantCode,
                cancel_reason: cancelReason
            })
        });
        
        if (!response.ok) {
            hideSubscriptionLoading();
            const text = await response.text();
            let errMsg = 'Abonelik iptal edilemedi';
            try {
                const errorResult = JSON.parse(text);
                errMsg = errorResult.error || errMsg;
            } catch (_) {
                if (response.status === 404) errMsg = 'İptal servisi bulunamadı (404). Lütfen sayfayı yenileyin veya destek ile iletişime geçin.';
                else if (response.status >= 500) errMsg = 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.';
            }
            throw new Error(errMsg);
        }
        
        let result;
        try {
            result = await response.json();
        } catch (_) {
            hideSubscriptionLoading();
            throw new Error('Sunucu geçersiz yanıt döndü. Sayfayı yenileyip tekrar deneyin.');
        }
        if (!result || typeof result !== 'object') {
            hideSubscriptionLoading();
            throw new Error('Abonelik iptal edilemedi');
        }
        if (!result.success) {
            hideSubscriptionLoading();
            throw new Error(result.error || 'Abonelik iptal edilemedi');
        }
        
        // Loading overlay'i gizle
        hideSubscriptionLoading();
        
        // Toast göster - toast script'i yüklenene kadar bekle
        setTimeout(() => {
            if (typeof window.createToast === 'function') {
                window.createToast('success', 'Abonelik iptal talebi gönderildi! Aboneliğiniz mevcut dönem sonuna kadar devam edecektir.');
            } else if (typeof createToast === 'function') {
                createToast('success', 'Abonelik iptal talebi gönderildi! Aboneliğiniz mevcut dönem sonuna kadar devam edecektir.');
            }
        }, 100);
        
        // Modal'ı kapat ve textarea'yı temizle
        const cancelReasonTextarea = document.getElementById('cancel-reason');
        if (cancelReasonTextarea) {
            cancelReasonTextarea.value = '';
            cancelReasonTextarea.classList.remove('error');
        }
        
        closeAllModals();
        const reloadApiBase = window.dashboardApiBase || (typeof window.getFloovonApiBase === 'function' ? window.getFloovonApiBase() : window.API_BASE_URL || '/api');

        // Console sayfasını senkronize et (aynı origin'de açıksa)
        try {
            const channel = new BroadcastChannel('floovon-admin-notifications');
            channel.postMessage({ type: 'subscription-updated', tenantCode: tenantCode });
            channel.close();
        } catch (_) {}
        
        // Kısa bir gecikme ile verileri yeniden yükle (backend'in güncellemesi için)
        setTimeout(async () => {
            // Abonelik bilgilerini yeniden yükle
            await loadSubscriptionInfo(reloadApiBase, tenantCode);
            
            // Dashboard verilerini de yeniden yükle (plan bilgileri güncellensin)
            await loadDashboardData(reloadApiBase, tenantCode);
            
            // Modal başlığını güncelle (iptal sonrası "Yeni Plan Seç" olmalı)
            const modalTitle = document.querySelector('#upgrade-plan-modal h3');
            if (modalTitle) {
                modalTitle.textContent = 'Yeni Plan Seç';
            }
            
            // Sayfa yenileme kaldırıldı - sadece veriler güncelleniyor
        }, 500);
        
    } catch (error) {
        hideSubscriptionLoading();
        if (typeof window.createToast === 'function') {
            window.createToast('error', error.message || 'Abonelik iptal edilirken bir hata oluştu');
        } else if (typeof window.showToast === 'function') {
            window.showToast(error.message || 'Abonelik iptal edilirken bir hata oluştu', 'error');
        }
    }
}

