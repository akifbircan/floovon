/**
 * ============================================================================
 * FLOOVON API CONFIGURATION - TEK MERKEZ YÖNETİM NOKTASI
 * ============================================================================
 * 
 * ⚠️ ÖNEMLİ: Tüm API bağlantıları bu dosyadan yönetilir!
 * 
 * Domain değiştirmek için sadece aşağıdaki PRODUCTION_DOMAIN değerini değiştirin.
 * Tüm proje otomatik olarak yeni domain'i kullanacaktır.
 * 
 * ============================================================================
 */

(function() {
    'use strict';

    // ========================================================================
    // ⚙️ PRODUCTION DOMAIN AYARI - BURAYI DEĞİŞTİRİN
    // ========================================================================
    // Production domain'inizi buraya yazın (protokol ve /api olmadan)
    // Örnek: 'panel.floovon.com'
    // Örnek: 'api.yourdomain.com'
    // Örnek: 'your-backend.railway.app'
    const PRODUCTION_DOMAIN = 'panel.floovon.com';
    // ========================================================================

    // Production/Development ortamını otomatik algıla
    // file:// protokolü veya localhost/127.0.0.1 ise development modu
    const isFileProtocol = window.location.protocol === 'file:';
    const hostname = window.location.hostname || '';
    const port = window.location.port || '';
    
    // Localhost kontrolü: localhost, 127.0.0.1, boş hostname veya 5501 portu (Live Server)
    // NOT: Live Server portu (5501) development modunda sayılır, backend 3001'de çalışır
    const isLocalhost = hostname === 'localhost' || 
                       hostname === '127.0.0.1' ||
                       hostname === '' ||
                       port === '5501' || // Live Server portu (frontend)
                       port === '5500' || // Live Server alternatif portu (frontend)
                       window.location.port === '5501' ||
                       window.location.port === '5500';
    
    // Production kontrolü: HTTPS veya HTTP protokolü VE localhost değil
    // Not: HTTPS tercih edilir ama HTTP sunucuları için de destek var
    const isProduction = !isFileProtocol && 
                        !isLocalhost && 
                        (window.location.protocol === 'https:' || window.location.protocol === 'http:');

    // API Base URL - Production'da relative path kullan (/api), development'ta localhost
    let API_BASE_URL;
    
    if (isProduction) {
        // Production: Relative path kullan (Nginx reverse proxy üzerinden gidecek)
        // ASLA localhost kullanma - fail-fast kontrolü
        API_BASE_URL = "/api";
        
        // Güvenlik: Production'da localhost içeren URL varsa hata ver
        if (API_BASE_URL.includes("localhost") || API_BASE_URL.includes("127.0.0.1")) {
            throw new Error("PROD_GÜVENLİK_HATASI: Production'da localhost API yasak! API_BASE_URL: " + API_BASE_URL);
        }
    } else {
        // Development: localhost kullan (local'de 3001 portu)
        // ÖNEMLİ: localhost için HER ZAMAN HTTP kullan (HTTPS localhost'ta çalışmaz)
        let port = localStorage.getItem('backend_port') || '3001';
        // 3000 portunu 3001'e zorla (yanlış port kullanımını önle)
        if (port === '3000') {
            port = '3001';
            localStorage.setItem('backend_port', '3001');
        }
        API_BASE_URL = `http://localhost:${port}/api`;
    }

    // Backend Base URL (uploads için kullanılır - /api olmadan)
    // Production'da relative path, development'ta localhost
    const BACKEND_BASE_URL = isProduction ? '' : API_BASE_URL.replace('/api', '');
    
    // Production domain helper fonksiyonları
    window.getFloovonProductionDomain = function() {
        return (window.FLOOVON_CONFIG && window.FLOOVON_CONFIG.PRODUCTION_DOMAIN) || PRODUCTION_DOMAIN;
    };
    
    window.getFloovonProductionBase = function() {
        const domain = window.getFloovonProductionDomain();
        return `https://${domain}`;
    };

    // Global olarak erişilebilir yap
    window.API_BASE_URL = API_BASE_URL;
    window.BACKEND_BASE_URL = BACKEND_BASE_URL; // Uploads için
    // Debug flag - Production'da false, development'ta true
    // localStorage'dan override edilebilir: localStorage.setItem('FLOOVON_DEBUG', 'true')
    const DEBUG_FLAG = !isProduction || localStorage.getItem('FLOOVON_DEBUG') === 'true';
    
    window.FLOOVON_CONFIG = {
        API_BASE_URL: API_BASE_URL,
        BACKEND_BASE_URL: BACKEND_BASE_URL,
        PRODUCTION_DOMAIN: PRODUCTION_DOMAIN,
        IS_PRODUCTION: isProduction,
        DEBUG: DEBUG_FLAG,
        VERSION: '1.0.0'
    };
    
    // Global debug helper
    window.FLOOVON_DEBUG = DEBUG_FLAG;

    // Helper fonksiyonlar - Tüm projede kullanılabilir
    // API Base URL tek noktadan belirlenir:
    // - Production: "/api"
    // - Development: "http://localhost:3001/api"
    window.getFloovonApiBase = function() {
        // window.API_BASE_URL config.js tarafından set edilmiş olmalı
        if (window.API_BASE_URL) {
            // Production'da localhost kontrolü (güvenlik)
            const hostname = window.location.hostname || '';
            const port = window.location.port || '';
            const isProd = hostname !== 'localhost' && 
                          hostname !== '127.0.0.1' && 
                          hostname !== '' &&
                          port !== '5501' && 
                          port !== '5500';
            if (isProd && (window.API_BASE_URL.includes("localhost") || window.API_BASE_URL.includes("127.0.0.1"))) {
                throw new Error("PROD_GÜVENLİK_HATASI: Production'da localhost API yasak! API_BASE_URL: " + window.API_BASE_URL);
            }
            return window.API_BASE_URL;
        }
        
        // Fallback: Eğer window.API_BASE_URL yoksa, tekrar hesapla
        const isFileProtocol = window.location.protocol === 'file:';
        const fallbackHostname = window.location.hostname || '';
        const fallbackPort = window.location.port || '';
        const isLocalhost = fallbackHostname === 'localhost' || 
                           fallbackHostname === '127.0.0.1' ||
                           fallbackHostname === '' ||
                           fallbackPort === '5501' ||
                           fallbackPort === '5500';
        const isProd = !isFileProtocol && !isLocalhost && (window.location.protocol === 'https:' || window.location.protocol === 'http:');
        
        if (isProd) {
            // Production: Relative path
            return "/api";
        } else {
            // Development: localhost
            let port = localStorage.getItem('backend_port') || '3001';
            if (port === '3000') {
                port = '3001';
                localStorage.setItem('backend_port', '3001');
            }
            return `http://localhost:${port}/api`;
        }
    };

    // Backend'den gelen URL'leri düzelt (localhost <-> production URL dönüşümü)
    // PRODUCTION'DA: Tüm localhost URL'lerini relative path'e çevir
    window.fixBackendUrl = function(url) {
        if (!url || typeof url !== 'string') return url;
        
        const hostname = window.location.hostname;
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';
        
        // Localhost modunda ise production URL'lerini localhost URL'ine çevir
        if (isLocalhost) {
            // Production domain'ini (config.js'den gelen PRODUCTION_DOMAIN) localhost'a çevir
            // Tüm production domain'lerini (https:// veya http:// ile başlayan ve localhost değil) localhost'a çevir
            if (url.match(/^https?:\/\/(?!localhost|127\.0\.0\.1)[^\/]+/)) {
                const port = localStorage.getItem('backend_port') || '3001';
                // Production domain'ini localhost'a çevir (dinamik - config.js'den gelen PRODUCTION_DOMAIN veya başka production domain)
                url = url.replace(/^https?:\/\/(?!localhost|127\.0\.0\.1)[^\/]+/g, `http://localhost:${port}`);
            }
        }
        // Production modunda ise localhost URL'lerini relative path'e çevir
        else if (isProduction) {
            // Eğer URL localhost:3001, localhost:3000 veya 127.0.0.1:3001 içeriyorsa, relative path'e çevir
            if (url.includes('localhost:3001') || url.includes('localhost:3000') || url.includes('127.0.0.1:3001')) {
                // Full URL'den sadece pathname'i al (relative path yap)
                try {
                    const urlObj = new URL(url);
                    url = urlObj.pathname + (urlObj.search || '') + (urlObj.hash || '');
                } catch (e) {
                    // URL parse hatası, regex ile path'i çıkar
                    const pathMatch = url.match(/https?:\/\/[^\/]+(\/.*)/);
                    if (pathMatch) {
                        url = pathMatch[1];
                    } else {
                        // Fallback: localhost kısmını kaldır
                        url = url.replace(/https?:\/\/localhost:300[01]/g, '');
                        url = url.replace(/https?:\/\/127\.0\.0\.1:300[01]/g, '');
                    }
                }
            }
            // Production domain içeren URL'leri de relative path'e çevir (güvenlik)
            else if (url.includes(PRODUCTION_DOMAIN)) {
                try {
                    const urlObj = new URL(url);
                    url = urlObj.pathname + (urlObj.search || '') + (urlObj.hash || '');
                } catch (e) {
                    // URL parse hatası, regex ile path'i çıkar
                    const pathMatch = url.match(/https?:\/\/[^\/]+(\/.*)/);
                    if (pathMatch) {
                        url = pathMatch[1];
                    }
                }
            }
        }
        
        return url;
    };

    // Backend'den gelen tüm objelerdeki URL'leri otomatik düzelt
    window.fixBackendData = function(data) {
        if (!data) return data;
        
        // Eğer string ise direkt düzelt
        if (typeof data === 'string') {
            return window.fixBackendUrl(data);
        }
        
        // Eğer array ise her elemanı düzelt
        if (Array.isArray(data)) {
            return data.map(item => window.fixBackendData(item));
        }
        
        // Eğer object ise tüm URL alanlarını düzelt
        if (typeof data === 'object') {
            const fixed = { ...data };
            const urlFields = ['profil_resmi', 'product_gorsel', 'urun_gorsel', 'product_image', 'logo', 'gorsel', 'kart_gorsel', 'urun_resmi', 'partner_logo', 'logo_url', 'image', 'img', 'photo', 'avatar'];
            
            for (const key in fixed) {
                if (urlFields.includes(key) || key.includes('_url') || key.includes('_gorsel') || key.includes('_resmi') || key.includes('_image')) {
                    if (typeof fixed[key] === 'string' && fixed[key].trim() !== '') {
                        fixed[key] = window.fixBackendUrl(fixed[key]);
                    }
                } else if (typeof fixed[key] === 'object') {
                    fixed[key] = window.fixBackendData(fixed[key]);
                }
            }
            
            return fixed;
        }
        
        return data;
    };

    window.getFloovonBackendBase = function() {
        return window.BACKEND_BASE_URL || BACKEND_BASE_URL;
    };

    // ========================================================================
    // 🖼️ UPLOAD PATH HELPER - Çift path sorununu önler
    // ========================================================================
    // Backend'den gelen path zaten /uploads/ ile başlıyorsa tekrar eklemez
    // Kullanım: getFloovonUploadUrl('/uploads/tenants/1/...') veya getFloovonUploadUrl('products/image.jpg')
    window.getFloovonUploadUrl = function(path) {
        if (!path || typeof path !== 'string') return '';
        
        // ÖNCE: Eğer path localhost URL'si içeriyorsa, fixBackendUrl ile düzelt
        // Bu, backend'den gelen localhost URL'lerini production'da relative path'e çevirir
        if (typeof window.fixBackendUrl === 'function') {
            path = window.fixBackendUrl(path);
        }
        
        // Backend base URL'i al
        let backendBase = window.getFloovonBackendBase ? window.getFloovonBackendBase() : (window.BACKEND_BASE_URL || '');
        
        // Production'da backendBase boş string olmalı (relative path kullanılır)
        // NOT: Production domain ekleme - relative path'ler için backendBase boş string kalmalı
        // Full URL'ler için fixBackendUrl zaten düzeltiyor
        
        // Tam URL ise (https://...), localhost URL'lerini production URL'lerine çevir
        if (path.startsWith('http://') || path.startsWith('https://')) {
            // Önce pathname'i al (tenant-based dönüşüm için)
            let pathname = path;
            try {
                const urlObj = new URL(path);
                pathname = urlObj.pathname;
            } catch (e) {
                // URL parse hatası, regex ile pathname'i çıkar
                const pathMatch = path.match(/https?:\/\/[^\/]+(\/.*)/);
                if (pathMatch) {
                    pathname = pathMatch[1];
                }
            }
            
            // Localhost URL'lerini production URL'lerine çevir (fixBackendUrl dinamik olarak yapar)
            // fixBackendUrl tüm production domain'lerini (config.js'den gelen PRODUCTION_DOMAIN dahil) localhost'a çevirir
            if (typeof window.fixBackendUrl === 'function') {
                const fixedUrl = window.fixBackendUrl(path);
                // Eğer fixBackendUrl pathname döndürdüyse, path'i güncelle
                if (!fixedUrl.startsWith('http://') && !fixedUrl.startsWith('https://')) {
                    path = fixedUrl;
                } else {
                    // Full URL döndü, pathname'i al ve tenant-based dönüşüm yap
                try {
                        const fixedUrlObj = new URL(fixedUrl);
                        path = fixedUrlObj.pathname;
                } catch (e) {
                        // URL parse hatası, pathname'i kullan
                        path = pathname;
                }
                }
            } else {
                // fixBackendUrl yoksa, sadece pathname'i al
                path = pathname;
            }
        }
        
        // Tenant ID'yi al
        let tenantId = null;
        if (window.userManager && typeof window.userManager.getUser === 'function') {
            const user = window.userManager.getUser();
            tenantId = user?.tenant_id || null;
        }
        if (!tenantId && window.userSession && typeof window.userSession.getTenantId === 'function') {
            tenantId = window.userSession.getTenantId();
        }
        if (!tenantId) {
            const userStr = localStorage.getItem('floovon_user') || localStorage.getItem('user');
            if (userStr) {
                try {
                    const user = JSON.parse(userStr);
                    tenantId = user?.tenant_id || null;
                } catch (e) {}
            }
        }
        tenantId = tenantId || '1'; // Fallback
        
        // ESKİ PATH'LERİ TENANT-BASED YAPIYA ÇEVİR
        // Eski /uploads/profiles/ -> /uploads/tenants/<tenantId>/profiles/
        if (path.includes('/uploads/profiles/') && !path.includes('/uploads/tenants/')) {
            const parts = path.split('/uploads/profiles/');
            if (parts.length > 1) {
                const rest = parts[1];
                path = `/uploads/tenants/${tenantId}/profiles/${rest}`;
            }
        }
        // Eski /uploads/customers/ -> /uploads/tenants/<tenantId>/customers/
        if (path.includes('/uploads/customers/') && !path.includes('/uploads/tenants/')) {
            const parts = path.split('/uploads/customers/');
            if (parts.length > 1) {
                const rest = parts[1];
                path = `/uploads/tenants/${tenantId}/customers/${rest}`;
            }
        }
        // Eski /uploads/organizations/ -> /uploads/tenants/<tenantId>/organizations/
        if (path.includes('/uploads/organizations/') && !path.includes('/uploads/tenants/')) {
            const parts = path.split('/uploads/organizations/');
            if (parts.length > 1) {
                const rest = parts[1];
                path = `/uploads/tenants/${tenantId}/organizations/${rest}`;
            }
        }
        // Eski /uploads/kampanyalar/ -> /uploads/tenants/<tenantId>/campaigns/
        if (path.includes('/uploads/kampanyalar/') && !path.includes('/uploads/tenants/')) {
            const parts = path.split('/uploads/kampanyalar/');
            if (parts.length > 1) {
                const rest = parts[1];
                path = `/uploads/tenants/${tenantId}/campaigns/${rest}`;
            }
        }
        // Eski /uploads/products/ -> /uploads/tenants/<tenantId>/products/
        if (path.includes('/uploads/products/') && !path.includes('/uploads/tenants/')) {
            const parts = path.split('/uploads/products/');
            if (parts.length > 1) {
                const rest = parts[1];
                path = `/uploads/tenants/${tenantId}/products/${rest}`;
            }
        }
        // Eski products/ (başında /uploads/ yok) -> /uploads/tenants/<tenantId>/products/
        if (path.startsWith('products/') && !path.includes('/uploads/tenants/')) {
            path = `/uploads/tenants/${tenantId}/products/${path.replace('products/', '')}`;
        }
        // Eski /uploads/print-settings/ -> /uploads/tenants/<tenantId>/print-settings/
        if (path.includes('/uploads/print-settings/') && !path.includes('/uploads/tenants/')) {
            const parts = path.split('/uploads/print-settings/');
            if (parts.length > 1) {
                const rest = parts[1];
                path = `/uploads/tenants/${tenantId}/print-settings/${rest}`;
            }
        }
        // Eski print-settings/ (başında /uploads/ yok) -> /uploads/tenants/<tenantId>/print-settings/
        if (path.startsWith('print-settings/') && !path.includes('/uploads/tenants/')) {
            path = `/uploads/tenants/${tenantId}/print-settings/${path.replace('print-settings/', '')}`;
        }
        // Eski /uploads/partner-firmalar/ -> /uploads/tenants/<tenantId>/partners/
        if (path.includes('/uploads/partner-firmalar/') && !path.includes('/uploads/tenants/')) {
            const parts = path.split('/uploads/partner-firmalar/');
            if (parts.length > 1) {
                const rest = parts[1];
                path = `/uploads/tenants/${tenantId}/partners/${rest}`;
            }
        }
        // Eski /uploads/general/logos/ -> /uploads/tenants/<tenantId>/company/logos/
        if (path.includes('/uploads/general/logos/') && !path.includes('/uploads/tenants/')) {
            const parts = path.split('/uploads/general/logos/');
            if (parts.length > 1) {
                const rest = parts[1];
                path = `/uploads/tenants/${tenantId}/company/logos/${rest}`;
            }
        }
        // Eski general/logos/ (başında /uploads/ yok) -> /uploads/tenants/<tenantId>/company/logos/
        if (path.startsWith('general/logos/') && !path.includes('/uploads/tenants/')) {
            path = `/uploads/tenants/${tenantId}/company/logos/${path.replace('general/logos/', '')}`;
        }
        // Eski company/logos/ (başında /uploads/ yok) -> /uploads/tenants/<tenantId>/company/logos/
        if (path.startsWith('company/logos/') && !path.includes('/uploads/tenants/')) {
            path = `/uploads/tenants/${tenantId}/company/logos/${path.replace('company/logos/', '')}`;
        }
        // Eski /uploads/partner-firmalar/ -> /uploads/tenants/<tenantId>/partners/
        if (path.includes('/uploads/partner-firmalar/') && !path.includes('/uploads/tenants/')) {
            const parts = path.split('/uploads/partner-firmalar/');
            if (parts.length > 1) {
                const rest = parts[1];
                path = `/uploads/tenants/${tenantId}/partners/${rest}`;
            }
        }
        // Eski partner-firmalar/ (başında /uploads/ yok) -> /uploads/tenants/<tenantId>/partners/
        if (path.startsWith('partner-firmalar/') && !path.includes('/uploads/tenants/')) {
            path = `/uploads/tenants/${tenantId}/partners/${path.replace('partner-firmalar/', '')}`;
        }
        
        // Path zaten /uploads/ ile başlıyorsa
        if (path.startsWith('/uploads/')) {
            // Production'da /api prefix'i ekleme, direkt /uploads kullan (Nginx reverse proxy ayarlı)
            // Development'ta backendBase ekle
            let finalUrl;
            if (backendBase) {
                finalUrl = `${backendBase}${path}`;
            } else {
                finalUrl = path;
            }
            
            // Localhost URL'lerini production URL'lerine çevir (fixBackendUrl gibi)
            if (typeof window.fixBackendUrl === 'function') {
                finalUrl = window.fixBackendUrl(finalUrl);
            }
            
            return finalUrl;
        }
        // Path uploads/ ile başlıyorsa (başında / yok), / ekle
        if (path.startsWith('uploads/')) {
            if (backendBase) {
                return `${backendBase}/${path}`;
            }
            return `/${path}`;
        }
        // Path zaten tenants/ ile başlıyorsa (backend'den gelen format), /uploads/ ekle
        if (path.startsWith('tenants/') || path.startsWith('/tenants/')) {
            const cleanPath = path.startsWith('/') ? path : `/${path}`;
            const uploadPath = `/uploads${cleanPath}`;
            // Production'da backendBase boş string, direkt path döndür
            // Development'ta backendBase ekle
            if (backendBase) {
                return `${backendBase}${uploadPath}`;
            }
            return uploadPath;
        }
        // Assets için olduğu gibi döndür
        if (path.startsWith('/assets/') || path.startsWith('assets/')) {
            return path.startsWith('/') ? path : `/${path}`;
        }
        // Diğer durumlarda /uploads/ ekle (tenant-based yapıya)
        return `${backendBase}/uploads/tenants/${tenantId}/${path}`;
    };

    // ========================================================================
    // 🔧 ORTAK FETCH HELPER FONKSİYONU - TÜM API ÇAĞRILARI İÇİN
    // ========================================================================
    // Bu fonksiyon tüm API çağrılarında kullanılmalı:
    // - API base URL window.getFloovonApiBase() üzerinden alınır
    // - Token ve user ID header'larını otomatik ekler
    // - Response status kontrolü yapar
    // ========================================================================
    window.floovonFetch = async function(endpoint, options = {}) {
        // API base URL'i TEK noktadan al (window.getFloovonApiBase)
        // Host/protocol kontrolü burada YAPILMAZ - getFloovonApiBase içinde yapılır
        // Fallback yok - getFloovonApiBase zorunlu
        if (typeof window.getFloovonApiBase !== 'function') {
            throw new Error('window.getFloovonApiBase fonksiyonu bulunamadı! config.js yüklenmiş olmalı.');
        }
        const apiBase = window.getFloovonApiBase();
        
        // Debug: URL oluşturma kontrolü (sadece development'ta - şimdilik kapalı)
        // if (window.FLOOVON_DEBUG) {
        //     console.log('🔍 floovonFetch: apiBase =', apiBase, 'endpoint =', endpoint, 'window.API_BASE_URL =', window.API_BASE_URL);
        // }
        
        // Token'ı al (localStorage'dan)
        const token = localStorage.getItem('floovon_token');
        
        // User ID'yi al (localStorage'dan - backend cookie'den de alabilir ama şimdilik localStorage)
        let userId = null;
        
        // UserManager varsa onu kullan (en güvenilir kaynak)
        if (window.userManager && typeof window.userManager.getUser === 'function') {
            const user = window.userManager.getUser();
            if (user && user.id) {
                    userId = user.id.toString();
                }
        }
        
        // userId yoksa localStorage'dan al
        if (!userId) {
            // ÖNCE user objesinden al
            const userStr = localStorage.getItem('floovon_user') || localStorage.getItem('user');
            if (userStr) {
                try {
                    const user = JSON.parse(userStr);
                    if (user.id) {
                        userId = user.id.toString();
                    }
                } catch (e) {
                    // Parse hatası
                }
            }
            
            // Fallback: localStorage'dan direkt al
            if (!userId) {
                userId = localStorage.getItem('floovon_user_id') || localStorage.getItem('user_id');
            }
        }
        
        // Header'ları hazırla
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };
        
        // Token header'ını ekle
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        // NOT: X-User-ID header'ı backend'de artık IGNORE ediliyor (güvenlik - client manipüle edebilir)
        // User ID backend'de cookie'den alınacak (HttpOnly cookie manipüle edilemez)
        // X-User-ID header'ı sadece bilgi amaçlı gönderilebilir ama backend ignore eder
        // if (userId) {
        //     headers['X-User-ID'] = userId.toString(); // GÜVENLİK: Backend ignore ediyor, cookie kullanıyor
        // }
        
        // FormData ise Content-Type'ı kaldır (browser otomatik ekleyecek)
        if (options.body instanceof FormData) {
            delete headers['Content-Type'];
        }
        
        // URL'i oluştur - GET istekleri için cache busting ekle
        let url;
        if (endpoint.startsWith('http')) {
            url = endpoint; // Absolute URL
            } else {
            // Relative endpoint - apiBase'i absolute URL'ye çevir (eğer relative ise)
            let absoluteApiBase = apiBase;
            
            // Eğer apiBase relative ise (/api), absolute URL'ye çevir
            if (!apiBase.startsWith('http')) {
                // Development modunda localhost:3001 kullan
                const hostname = window.location.hostname || '';
                const port = window.location.port || '';
                const isLocalhost = hostname === 'localhost' || 
                                   hostname === '127.0.0.1' ||
                                   hostname === '' ||
                                   port === '5501' ||
                                   port === '5500' ||
                                   window.location.port === '5501' ||
                                   window.location.port === '5500';
                
                if (isLocalhost) {
                    // Development: localhost:3001 kullan (backend portu)
                    // ÖNEMLİ: window.location.origin kullanma (5501 portu olabilir)
                    // Her zaman backend portunu (3001) kullan
                    const backendPort = localStorage.getItem('backend_port') || '3001';
                    // hostname localhost veya 127.0.0.1 olabilir, her ikisini de destekle
                    const backendHost = hostname === '127.0.0.1' ? '127.0.0.1' : 'localhost';
                    absoluteApiBase = `http://${backendHost}:${backendPort}${apiBase}`;
                } else {
                    // Production: Current origin kullan
                    absoluteApiBase = `${window.location.origin}${apiBase}`;
                }
            }
            
            if (endpoint.startsWith('/api/')) {
                // /api/ ile başlıyorsa, endpoint'ten /api'yi çıkar ve apiBase'e ekle
                const endpointWithoutApi = endpoint.substring(4); // "/api/" -> "/"
                url = `${absoluteApiBase}${endpointWithoutApi}`;
        } else {
                url = `${absoluteApiBase}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
            }
        }
        
        // GET istekleri için cache busting ekle (veritabanı değişikliklerinin görünmesi için)
        if ((options.method || 'GET').toUpperCase() === 'GET') {
            const separator = url.includes('?') ? '&' : '?';
            url = `${url}${separator}_t=${Date.now()}`;
        }
        
        // GÜVENLİK: Production'da localhost URL'leri engelle
        // Development'ta 5501 portunu 3001'e çevir (eğer hala varsa)
        if (url.includes('localhost:5501') || url.includes('127.0.0.1:5501')) {
            const hostname = window.location.hostname || '';
            const port = window.location.port || '';
            const isProd = hostname !== 'localhost' && 
                          hostname !== '127.0.0.1' && 
                          hostname !== '' &&
                          port !== '5501' && 
                          port !== '5500';
            if (isProd) {
                throw new Error(`GÜVENLİK HATASI: Production'da localhost:5501 URL'si kullanılamaz! URL: ${url}`);
            }
            // Development'ta 5501 portunu 3001'e çevir
            const backendPort = localStorage.getItem('backend_port') || '3001';
            url = url.replace(/localhost:5501/g, `localhost:${backendPort}`);
            url = url.replace(/127\.0\.0\.1:5501/g, `127.0.0.1:${backendPort}`);
            if (window.FLOOVON_DEBUG) {
                console.log('🔧 floovonFetch: URL düzeltildi (5501 -> 3001):', url);
            }
        }
        
        // Debug: URL kontrolü (sadece development'ta - şimdilik kapalı)
        // if (window.FLOOVON_DEBUG) {
        //     console.log('🔍 floovonFetch: Final URL =', url, 'apiBase =', apiBase);
        // }
        
        try {
            // GET istekleri için cache'i devre dışı bırak
            const fetchOptions = {
                ...options,
                headers: headers,
                credentials: 'include' // Cookie'leri gönder (HttpOnly cookie için gerekli)
            };
            
            // cache: 'no-cache' kullanma - browser otomatik Cache-Control header'ı ekliyor ve CORS hatasına neden oluyor
            // Bunun yerine URL'e timestamp ekliyoruz (zaten yukarıda yapılıyor)
            
            let response;
            try {
                response = await fetch(url, fetchOptions);
            } catch (fetchError) {
                // Network hataları (ERR_CONNECTION_REFUSED, ERR_NETWORK_CHANGED, ERR_NAME_NOT_RESOLVED, ERR_INTERNET_DISCONNECTED, ERR_FAILED vb.)
                // Hem localhost hem production'da backend çalışmıyorsa veya internet bağlantısı yoksa normal, sessizce handle et
                const isNetworkError = (fetchError.message && (
                    fetchError.message.includes('Failed to fetch') ||
                    fetchError.message.includes('ERR_CONNECTION_REFUSED') ||
                    fetchError.message.includes('ERR_NETWORK_CHANGED') ||
                    fetchError.message.includes('ERR_NAME_NOT_RESOLVED') ||
                    fetchError.message.includes('ERR_INTERNET_DISCONNECTED') ||
                    fetchError.message.includes('ERR_FAILED') ||
                    fetchError.name === 'TypeError'
                )) || (fetchError.code && (
                    fetchError.code === 'ERR_INTERNET_DISCONNECTED' ||
                    fetchError.code === 'ERR_FAILED'
                ));
                
                if (isNetworkError) {
                    // Network hatası için sessizce error throw et (caller handle edecek)
                    const error = new Error('Backend bağlantı hatası');
                    error.isConnectionError = true;
                    error.isIgnored = true;
                    throw error;
                }
                throw fetchError;
            }
            
            // Response status kontrolü
            if (!response.ok) {
                const errorText = await response.text();
                
                // 502 Bad Gateway için özel kontrol - HTML response geldiyse "API down" mesajı üret
                if (response.status === 502) {
                    // HTML response kontrolü (502 genellikle nginx'ten gelir ve HTML döner)
                    const isHtmlResponse = errorText.trim().startsWith('<!DOCTYPE') || errorText.trim().startsWith('<html');
                    if (isHtmlResponse) {
                        const error = new Error('API servisi şu anda kullanılamıyor (502 Bad Gateway)');
                        error.status = 502;
                        error.isApiDown = true;
                        throw error;
                    }
                    // JSON response ise normal işle
                    let errorData;
                    try {
                        errorData = JSON.parse(errorText);
                    } catch (e) {
                        errorData = { error: 'API servisi şu anda kullanılamıyor (502 Bad Gateway)' };
                    }
                    const error = new Error(errorData.error || errorData.message || 'API servisi şu anda kullanılamıyor (502 Bad Gateway)');
                    error.status = 502;
                    error.isApiDown = true;
                    throw error;
                }
                
                // 404 ve 501 hataları için console.error yazma (endpoint backend'de olmayabilir veya henüz implement edilmemiş, normal durum)
                if (response.status !== 404 && response.status !== 501) {
                    console.error('❌ Response hatası:', response.status, errorText);
                }
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    errorData = { error: errorText || `HTTP ${response.status}: ${response.statusText}` };
                }
                const error = new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
                error.status = response.status; // Status'u error objesine ekle
                throw error;
            }
            
            // JSON response'u parse et
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                try {
                    const result = await response.json();
                    return result;
                } catch (parseError) {
                    // JSON parse hatası - HTML response gelmiş olabilir (404/502/login page)
                    const text = await response.text();
                    // Index dışı sayfalarda bu hatayı sessizce yok say
                    const currentPath = window.location.pathname;
                    const fileName = currentPath.split('/').pop() || '';
                    const pageName = fileName.replace(/\.html$/, '');
                    const isIndexPage = pageName === 'index' || fileName === '' || currentPath === '/' || currentPath.endsWith('/');
                    
                    if (!isIndexPage) {
                        // Index dışı sayfalarda sessizce devam et
                        return { success: false, error: 'Beklenmeyen yanıt formatı', data: null };
                    }
                    
                    // Index sayfasında log'la
                    console.warn('⚠️ JSON parse hatası (HTML response alındı):', parseError.message);
                    return { success: false, error: 'Beklenmeyen yanıt formatı', data: text };
                }
            } else {
                // JSON değilse text olarak döndür
                const text = await response.text();
                // Index dışı sayfalarda HTML response'ları sessizce yok say
                const currentPath = window.location.pathname;
                const fileName = currentPath.split('/').pop() || '';
                const pageName = fileName.replace(/\.html$/, '');
                const isIndexPage = pageName === 'index' || fileName === '' || currentPath === '/' || currentPath.endsWith('/');
                
                if (!isIndexPage && (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html'))) {
                    // Index dışı sayfalarda HTML response'ları sessizce yok say
                    return { success: false, error: 'Beklenmeyen yanıt formatı', data: null };
                }
                
                return { success: true, data: text };
            }
        } catch (error) {
            // Network error (Failed to fetch, ERR_NETWORK_CHANGED vb) durumunda status'u 0 veya null yap
            if (error.status === undefined) {
                // Network error kontrolü
                if (error.message && (
                    error.message.includes('Failed to fetch') ||
                    error.message.includes('NetworkError') ||
                    error.message.includes('ERR_NETWORK_CHANGED') ||
                    error.message.includes('Network request failed')
                )) {
                    error.status = 0; // Network error için 0 kullan
                } else {
                    error.status = null; // Diğer hatalar için null
                }
            }
            // 404, 501, 502 ve network error (0) için console.error yazma (normal durumlar veya beklenen hatalar)
            const isIgnorableError = (error.status === 404 || error.status === 501 || error.status === 502 || error.status === 0) || (error.message && (
                error.message.includes('404') || 
                error.message.includes('501') ||
                error.message.includes('502') ||
                error.message.includes('Bad Gateway') ||
                error.message.includes('Not Implemented') ||
                error.message.includes('Failed to fetch') ||
                error.message.includes('ERR_NETWORK_CHANGED') ||
                error.message.includes('Cannot GET') ||
                error.message.includes('Cannot POST') ||
                error.message.includes('Cannot PUT') ||
                error.message.includes('Cannot DELETE')
            ));
            if (!isIgnorableError) {
                console.error('❌ API çağrısı hatası:', error);
            }
            throw error;
        }
    };

    // TODO: MutationObserver sistemi geçici kabul edilmiştir, ileride kaldırılacak.
    // DOM'a eklenen tüm img src'lerini otomatik düzelt (MutationObserver + setter override)
    if (isProduction && typeof window.fixBackendUrl === 'function') {
        const fixImageSrc = function(img) {
            if (img && img.src) {
                // Eğer URL zaten full URL ise ve production domain içeriyorsa, getFloovonUploadUrl çağırma
                const isFullUrl = img.src.startsWith('http://') || img.src.startsWith('https://');
                const currentHostname = window.location.hostname;
                const isLocalhost = currentHostname === 'localhost' || currentHostname === '127.0.0.1' || currentHostname === '';
                const productionDomain = (window.FLOOVON_CONFIG && window.FLOOVON_CONFIG.PRODUCTION_DOMAIN) || 
                                       (typeof window.getFloovonProductionDomain === 'function' ? window.getFloovonProductionDomain() : '');
                const isProductionUrl = isFullUrl && (
                    (productionDomain && img.src.includes(productionDomain)) || 
                    (!isLocalhost && img.src.includes(currentHostname))
                );
                
                // Eski path'leri tenant-based path'e çevir (localhost veya production URL'leri)
                let fixed = window.fixBackendUrl(img.src);
                
                // Eğer upload path'i ise ve henüz full URL değilse, getFloovonUploadUrl kullan
                if (!isProductionUrl && typeof window.getFloovonUploadUrl === 'function' && 
                    (fixed.includes('/uploads/') || fixed.includes('uploads/'))) {
                    // Full URL'den pathname'i al
                    let path = fixed;
                    if (fixed.startsWith('http://') || fixed.startsWith('https://')) {
                        try {
                            const urlObj = new URL(fixed);
                            path = urlObj.pathname;
                        } catch (e) {
                            // URL parse hatası, path'i olduğu gibi kullan
                        }
                    }
                    // getFloovonUploadUrl ile tenant-based path'e çevir
                    const tenantPath = window.getFloovonUploadUrl(path);
                    if (tenantPath && tenantPath !== path) {
                        // getFloovonUploadUrl zaten full URL döndürüyor, direkt kullan
                        fixed = tenantPath;
                    }
                }
                
                if (fixed !== img.src) {
                    // setAttribute kullanarak src'yi güncelle (setter'ı bypass et)
                    img.setAttribute('src', fixed);
                }
            }
        };

        // IMG elementlerinin src setter'ını override et
        const originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src') || 
                                      Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'src');
        
        if (originalSrcDescriptor && originalSrcDescriptor.set) {
            Object.defineProperty(HTMLImageElement.prototype, 'src', {
                get: originalSrcDescriptor.get,
                set: function(value) {
                    if (!value || typeof value !== 'string') {
                        originalSrcDescriptor.set.call(this, value);
                        return;
                    }
                    
                    // Eğer URL zaten full URL ise ve production domain içeriyorsa, getFloovonUploadUrl çağırma
                    // (getFloovonUploadUrl zaten full URL döndürüyor, tekrar çağırmaya gerek yok)
                    const isFullUrl = value.startsWith('http://') || value.startsWith('https://');
                    const currentHostname = window.location.hostname;
                    const isLocalhost = currentHostname === 'localhost' || currentHostname === '127.0.0.1' || currentHostname === '';
                    const productionDomain = (window.FLOOVON_CONFIG && window.FLOOVON_CONFIG.PRODUCTION_DOMAIN) || 
                                           (typeof window.getFloovonProductionDomain === 'function' ? window.getFloovonProductionDomain() : '');
                    const isProductionUrl = isFullUrl && (
                        (productionDomain && value.includes(productionDomain)) || 
                        (!isLocalhost && value.includes(currentHostname))
                    );
                    
                    let fixed = window.fixBackendUrl(value);
                    
                    // Eğer upload path'i ise ve henüz full URL değilse, getFloovonUploadUrl kullan
                    if (!isProductionUrl && typeof window.getFloovonUploadUrl === 'function' && 
                        (fixed.includes('/uploads/') || fixed.includes('uploads/'))) {
                        // Full URL'den pathname'i al
                        let path = fixed;
                        if (fixed.startsWith('http://') || fixed.startsWith('https://')) {
                            try {
                                const urlObj = new URL(fixed);
                                path = urlObj.pathname;
                            } catch (e) {
                                // URL parse hatası, path'i olduğu gibi kullan
                            }
                        }
                        // getFloovonUploadUrl ile tenant-based path'e çevir
                        const tenantPath = window.getFloovonUploadUrl(path);
                        if (tenantPath && tenantPath !== path) {
                            // getFloovonUploadUrl zaten full URL döndürüyor, direkt kullan
                            fixed = tenantPath;
                        }
                    }
                    
                    originalSrcDescriptor.set.call(this, fixed);
                },
                configurable: true
            });
        }

        // Mevcut tüm img'leri kontrol et
        const checkAllImages = function() {
            document.querySelectorAll('img').forEach(fixImageSrc);
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', checkAllImages);
        } else {
            checkAllImages();
        }

        // Link href'lerini düzelt
        const fixLinkHref = function(link) {
            if (link && link.href) {
                const fixed = window.fixBackendUrl(link.href);
                if (fixed !== link.href) {
                    link.setAttribute('href', fixed);
                }
            }
        };

        // Mevcut tüm linkleri kontrol et
        const checkAllLinks = function() {
            document.querySelectorAll('a[href]').forEach(fixLinkHref);
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', checkAllLinks);
        } else {
            checkAllLinks();
        }

        // Yeni eklenen img ve link'leri izle
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) { // Element node
                        if (node.tagName === 'IMG') {
                            fixImageSrc(node);
                        }
                        if (node.tagName === 'A' && node.hasAttribute('href')) {
                            fixLinkHref(node);
                        }
                        // İçindeki img ve link'leri de kontrol et
                        if (node.querySelectorAll) {
                            node.querySelectorAll('img').forEach(fixImageSrc);
                            node.querySelectorAll('a[href]').forEach(fixLinkHref);
                        }
                    }
                });
            });
        });

        // Observer'ı başlat
        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['src']
            });
        } else {
            document.addEventListener('DOMContentLoaded', function() {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['src']
                });
            });
        }
    }

    // Backward compatibility için
    if (typeof window.__resolveFloovonBackendBase !== 'function') {
        window.__resolveFloovonBackendBase = function() {
            return window.FLOOVON_CONFIG.BACKEND_BASE_URL;
        };
    }

    if (typeof window.__resolveFloovonApiBase !== 'function') {
        window.__resolveFloovonApiBase = function() {
            return window.FLOOVON_CONFIG.API_BASE_URL;
        };
    }

    // ========================================================================
    // 📍 CARİ ENDPOINT HELPER FONKSİYONLARI
    // ========================================================================
    // Tenant-based endpoint standardı: /api/tenants/:tenantId/customers/:customerId/...
    // Tenant ID localStorage'dan alınır: floovon_tenant_id
    
    /**
     * localStorage'dan tenant ID'yi alır
     * @returns {string|null} Tenant ID veya null
     */
    window.getTenantId = function() {
        try {
            return localStorage.getItem('floovon_tenant_id');
        } catch (e) {
            console.warn('Tenant ID alınamadı:', e);
            return null;
        }
    };

    /**
     * Müşteri faturaları endpoint'ini döndürür (GET)
     * @param {number|string} customerId - Müşteri ID
     * @returns {string} Endpoint path (tenant-based)
     */
    window.getCustomerFaturalarEndpoint = function(customerId) {
        const tenantId = window.getTenantId();
        if (!tenantId) {
            console.warn('Tenant ID bulunamadı, endpoint oluşturulamıyor');
            return `/api/customers/${customerId}/faturalar`; // Fallback (eski format)
        }
        return `/api/tenants/${tenantId}/customers/${customerId}/faturalar`;
    };

    /**
     * Müşteri tahsilatları endpoint'ini döndürür (GET)
     * @param {number|string} customerId - Müşteri ID
     * @returns {string} Endpoint path (tenant-based)
     */
    window.getCustomerTahsilatlarEndpoint = function(customerId) {
        const tenantId = window.getTenantId();
        if (!tenantId) {
            console.warn('Tenant ID bulunamadı, endpoint oluşturulamıyor');
            return `/api/customers/${customerId}/tahsilatlar`; // Fallback (eski format)
        }
        return `/api/tenants/${tenantId}/customers/${customerId}/tahsilatlar`;
    };

    /**
     * Müşteri fatura oluşturma endpoint'ini döndürür (POST)
     * @param {number|string} customerId - Müşteri ID
     * @returns {string} Endpoint path (tenant-based)
     */
    window.getCustomerFaturaCreateEndpoint = function(customerId) {
        const tenantId = window.getTenantId();
        if (!tenantId) {
            console.warn('Tenant ID bulunamadı, endpoint oluşturulamıyor');
            return `/api/customers/${customerId}/faturalar`; // Fallback (eski format)
        }
        return `/api/tenants/${tenantId}/customers/${customerId}/faturalar`;
    };

    /**
     * Müşteri tahsilat oluşturma endpoint'ini döndürür (POST)
     * @param {number|string} customerId - Müşteri ID
     * @returns {string} Endpoint path (tenant-based)
     */
    window.getCustomerTahsilatCreateEndpoint = function(customerId) {
        const tenantId = window.getTenantId();
        if (!tenantId) {
            console.warn('Tenant ID bulunamadı, endpoint oluşturulamıyor');
            return `/api/customers/${customerId}/tahsilatlar`; // Fallback (eski format)
        }
        return `/api/tenants/${tenantId}/customers/${customerId}/tahsilatlar`;
    };

    /**
     * Müşteri tahsilat güncelleme endpoint'ini döndürür (PUT)
     * @param {number|string} customerId - Müşteri ID
     * @param {number|string} tahsilatId - Tahsilat ID
     * @returns {string} Endpoint path (tenant-based)
     */
    window.getCustomerTahsilatUpdateEndpoint = function(customerId, tahsilatId) {
        const tenantId = window.getTenantId();
        if (!tenantId) {
            console.warn('Tenant ID bulunamadı, endpoint oluşturulamıyor');
            return `/api/customers/${customerId}/tahsilatlar/${tahsilatId}`; // Fallback (eski format)
        }
        return `/api/tenants/${tenantId}/customers/${customerId}/tahsilatlar/${tahsilatId}`;
    };

})();


