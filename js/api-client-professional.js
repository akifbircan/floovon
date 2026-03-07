/**
 * Floovon Professional Backend API Client
 * JWT authentication ve gelişmiş özellikler ile
 */

// Sınıf çakışmasını önlemek için kontrol
if (typeof window.FloovonProfessionalAPI === 'undefined') {

class FloovonProfessionalAPI {
    constructor(baseURL = null) {
        // window.getFloovonApiBase() kullan - config.js'den gelir, localhost/production kontrolü yapar
        if (!baseURL) {
            const hostname = window.location.hostname;
            const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';
            baseURL = (typeof window.getFloovonApiBase === 'function') 
                ? window.getFloovonApiBase() 
                : (window.API_BASE_URL || (isLocalhost ? 'http://localhost:3001/api' : '/api'));
        }
        
        // Güvenlik: Production'da localhost kontrolü
        const hostname = window.location.hostname;
        const isProd = hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '';
        if (isProd && (baseURL.includes("localhost") || baseURL.includes("127.0.0.1"))) {
            throw new Error("PROD_GÜVENLİK_HATASI: Production'da localhost API yasak! baseURL: " + baseURL);
        }
        
        this.baseURL = baseURL;
        this.token = localStorage.getItem('floovon_token');
        this.refreshToken = localStorage.getItem('floovon_refresh_token');
        
        // Tenant ID'yi başlat (updateTenantId metodu ile)
        this.tenantId = null;
        this.updateTenantId();
        
        this.defaultHeaders = {
            'Content-Type': 'application/json',
        };
    }

    // Token'ı header'a ekle (her istekte tenant ID'yi güncelle)
    getAuthHeaders() {
        // Her istekte tenant ID'yi güncelle (user objesinden veya localStorage'dan)
        this.updateTenantId();
        
        const headers = { ...this.defaultHeaders };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        // NOT: X-Tenant-ID header'ı artık backend'de ignore ediliyor (güvenlik)
        // Tenant ID token'dan alınacak, bu header sadece debug için gönderiliyor
        // if (this.tenantId) {
        //     headers['X-Tenant-ID'] = this.tenantId.toString(); // GÜVENLİK: Backend ignore ediyor
        // }
        
        // NOT: X-User-ID header'ı kaldırıldı (güvenlik - client manipüle edebilir)
        // Backend zaten HttpOnly cookie'den (floovon_user_id) user ID'yi alıyor ve güvenli bir şekilde kullanıyor
        // Cookie sistemi kullanılıyor: backend/simple-server.js -> getTenantId() -> cookie'den user ID alınıyor
        
        return headers;
    }
    
    // Tenant ID'yi güncelle (user objesinden veya localStorage'dan)
    updateTenantId() {
        // ÖNCE user objesinden al (en güvenilir kaynak)
        const userStr = localStorage.getItem('floovon_user') || localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                if (user.tenant_id) {
                    this.tenantId = parseInt(user.tenant_id);
                    localStorage.setItem('floovon_tenant_id', this.tenantId.toString());
                    return;
                }
            } catch (e) {
                // Parse hatası
            }
        }
        
        // Fallback: localStorage'dan al
        const tenantId = localStorage.getItem('floovon_tenant_id');
        if (tenantId) {
            this.tenantId = parseInt(tenantId);
            return;
        }
        
        // Son çare: Token'dan decode et
        if (this.token) {
            try {
                const payload = JSON.parse(atob(this.token.split('.')[1]));
                if (payload.tenant_id) {
                    this.tenantId = parseInt(payload.tenant_id);
                    localStorage.setItem('floovon_tenant_id', this.tenantId.toString());
                    return;
                }
            } catch (e) {
                // Token decode hatası
            }
        }
        
        // Varsayılan: 1
        if (!this.tenantId) {
            this.tenantId = 1;
        }
    }

    // Token'ı güncelle
    setToken(token, tenantId = null, refreshToken = null) {
        this.token = token;
        localStorage.setItem('floovon_token', token);
        
        // Tenant ID'yi de kaydet
        if (tenantId) {
            this.tenantId = parseInt(tenantId);
            localStorage.setItem('floovon_tenant_id', this.tenantId.toString());
            
            // User objesine de ekle
            const userStr = localStorage.getItem('floovon_user') || localStorage.getItem('user');
            if (userStr) {
                try {
                    const user = JSON.parse(userStr);
                    user.tenant_id = this.tenantId;
                    localStorage.setItem('user', JSON.stringify(user));
                    localStorage.setItem('floovon_user', JSON.stringify(user));
                } catch (e) {
                    // Parse hatası
                }
            }
        } else {
            // Tenant ID verilmemişse güncelle
            this.updateTenantId();
        }
        
        if (refreshToken) {
            this.refreshToken = refreshToken;
            localStorage.setItem('floovon_refresh_token', refreshToken);
        }
    }

    // Token'ı temizle
    clearToken() {
        this.token = null;
        this.refreshToken = null;
        localStorage.removeItem('floovon_token');
        localStorage.removeItem('floovon_refresh_token');
    }

    // Genel HTTP istek fonksiyonu
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.getAuthHeaders(),
            ...options
        };

        // Custom headers varsa ekle
        if (options.headers) {
            config.headers = { ...config.headers, ...options.headers };
        }

        try {
            
            // Timeout ekle
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 saniye timeout
            
            // GET istekleri için cache busting ekle
            const isGetRequest = (config.method || 'GET').toUpperCase() === 'GET';
            let finalUrl = url;
            if (isGetRequest) {
                const separator = url.includes('?') ? '&' : '?';
                finalUrl = `${url}${separator}_t=${Date.now()}`;
            }
            
            const fetchConfig = {
                ...config,
                signal: controller.signal
            };
            
            // GET istekleri için cache'i devre dışı bırak
            if (isGetRequest) {
                fetchConfig.cache = 'no-cache';
            }
            
            let response;
            try {
                response = await fetch(finalUrl, fetchConfig);
            } catch (fetchError) {
                clearTimeout(timeoutId);
                // Network hataları (ERR_NAME_NOT_RESOLVED, ERR_NETWORK_CHANGED vb.)
                const isNetworkError = fetchError.message && (
                    fetchError.message.includes('Failed to fetch') ||
                    fetchError.message.includes('ERR_CONNECTION_REFUSED') ||
                    fetchError.message.includes('ERR_NETWORK_CHANGED') ||
                    fetchError.message.includes('ERR_NAME_NOT_RESOLVED') ||
                    fetchError.name === 'TypeError'
                );
                
                if (isNetworkError) {
                    // Network hatası için sessizce error throw et
                    const error = new Error('Backend bağlantı hatası');
                    error.isConnectionError = true;
                    error.isIgnored = true;
                    throw error;
                }
                throw fetchError;
            }
            
            clearTimeout(timeoutId);

            // 401 Unauthorized - Token yenileme dene
            if (response.status === 401 && this.refreshToken) {
                const refreshed = await this.refreshAccessToken();
                if (refreshed) {
                    // İsteği tekrar dene
                    config.headers = this.getAuthHeaders();
                    const retryResponse = await fetch(url, {
                        ...config,
                        signal: controller.signal
                    });
                    const retryData = await retryResponse.json();
                    
                    if (!retryResponse.ok) {
                        throw new Error(retryData.error || `HTTP ${retryResponse.status}: ${retryResponse.statusText}`);
                    }
                    
                    return retryData;
                }
            }

            let data;
            let responseText;
            
            // Önce response'u text olarak oku
            try {
                responseText = await response.text();
            } catch (textError) {
                console.error('❌ Response text okuma hatası:', textError);
                throw new Error(`HTTP ${response.status}: ${response.statusText} - Response okunamadı`);
            }
            
            // Sonra JSON parse etmeye çalış
            try {
                data = JSON.parse(responseText);
            } catch (jsonError) {
                // JSON parse hatası - muhtemelen HTML yanıtı geldi
                if (!response.ok) {
                    // HTML yanıtından anlamlı mesaj çıkar
                    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                    
                    // HTML içindeki <pre> tag'inden hata mesajını çıkar
                    const preMatch = responseText.match(/<pre[^>]*>(.*?)<\/pre>/is);
                    if (preMatch && preMatch[1]) {
                        errorMessage = preMatch[1].trim();
                    } else {
                        // <pre> yoksa, title veya body'den mesaj çıkar
                        const titleMatch = responseText.match(/<title[^>]*>(.*?)<\/title>/is);
                        if (titleMatch && titleMatch[1] && titleMatch[1] !== 'Error') {
                            errorMessage = titleMatch[1].trim();
                        }
                    }
                    
                    // 404 hatası için özel mesaj ve idempotent handling
                    if (response.status === 404) {
                        // Dosya silme işlemlerinde 404'ü başarı olarak döndür (idempotent)
                        const isFileDelete404 = url.includes('/files');
                        if (isFileDelete404) {
                            return { success: true, message: 'Dosya zaten silinmiş veya bulunamadı' };
                        }
                        
                        // Müşteri silme işlemlerinde 404'ü başarı olarak döndür (idempotent)
                        const isCustomerDelete404 = url.includes('/customers/') && !url.includes('/files');
                        if (isCustomerDelete404) {
                            return { success: true, message: 'Müşteri zaten silinmiş veya bulunamadı' };
                        }
                        
                        if (errorMessage.includes('Cannot DELETE') || errorMessage.includes('Cannot')) {
                            errorMessage = 'Endpoint bulunamadı veya desteklenmiyor';
                        } else {
                            errorMessage = 'Kayıt bulunamadı';
                        }
                    }
                    
                    const error = new Error(errorMessage);
                    error.status = response.status;
                    throw error;
                } else {
                    // Başarılı yanıt ama JSON değil - muhtemelen dosya silme işlemi
                    return { success: true, message: 'İşlem başarılı' };
                }
            }

            if (!response.ok) {
                const errorMessage = data.error || data.message || `HTTP ${response.status}: ${response.statusText}`;
                // 404 hataları için silme işlemlerinde idempotent olarak başarı döndür
                if (response.status === 404) {
                    // Dosya silme işlemlerinde 404'ü başarı olarak döndür (idempotent)
                    const isFileDelete404 = url.includes('/files') || 
                                           errorMessage.includes('Dosya bulunamadı') ||
                                           errorMessage.includes('dosya bulunamadı');
                    if (isFileDelete404) {
                        return { success: true, message: 'Dosya zaten silinmiş veya bulunamadı' };
                    }
                    
                    // Müşteri silme işlemlerinde 404'ü başarı olarak döndür (idempotent)
                    const isCustomerDelete404 = url.includes('/customers/') && !url.includes('/files');
                    if (isCustomerDelete404) {
                        return { success: true, message: 'Müşteri zaten silinmiş veya bulunamadı' };
                    }
                }
                // Diğer hatalar için log bas
                const logMessage = `❌ Professional API Hatası: ${errorMessage} (Status: ${response.status}, URL: ${url})`;
                console.error(logMessage);
                
                const error = new Error(errorMessage);
                error.status = response.status;
                throw error;
            }

            return data;
        } catch (error) {
            if (error.name === 'AbortError') {
                // Timeout hatası, sessizce handle et
                throw new Error('API Timeout: İstek 15 saniye içinde yanıt vermedi');
            } else if (error.message && error.message.includes('Failed to fetch')) {
                // Backend bağlantı hatası, sessizce handle et
                throw error;
            } else {
                // 404 hataları için dosya silme işlemlerinde sessizce handle et (idempotent)
                const errorMsg = error.message || error.toString() || 'Bilinmeyen hata';
                const isFileDelete404 = error.status === 404 && (
                    errorMsg.includes('Dosya') || 
                    errorMsg.includes('dosya') ||
                    errorMsg.includes('bulunamadı') ||
                    errorMsg.includes('not found')
                );
                if (!isFileDelete404) {
                    // Diğer hatalar için log bas - error message'ı düzgün göster
                    const statusInfo = error.status ? ` (Status: ${error.status})` : '';
                    console.error(`❌ Professional API Hatası: ${errorMsg}${statusInfo}`);
                }
                throw error;
            }
        }
    }

    // Token yenileme
    async refreshAccessToken() {
        try {
            const response = await fetch(`${this.baseURL}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: this.refreshToken })
            });

            if (response.ok) {
                const data = await response.json();
                this.setToken(data.token, data.refresh_token);
                return true;
            }
        } catch (error) {
            console.error('❌ Token yenileme hatası:', error);
        }

        // Token yenileme başarısız, kullanıcıyı logout yap
        this.clearToken();
        window.location.href = '/login';
        return false;
    }

    // GET isteği
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    }

    // POST isteği
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // PUT isteği
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // DELETE isteği
    async delete(endpoint, data = null) {
        const options = { method: 'DELETE' };
        if (data) {
            options.body = JSON.stringify(data);
        }
        return this.request(endpoint, options);
    }

    // File upload (generic helper for FormData uploads)
    async uploadFormData(endpoint, formData) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {};
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            return data;
        } catch (error) {
            console.error('❌ File upload hatası:', error);
            throw error;
        }
    }

    // Authentication endpoints
    async login(email, password) {
        const response = await this.post('/auth/login', { email, password });
        
        // Backend cevabını normalize et
        if (response.success && response.token && response.user) {
            this.setToken(response.token, response.refresh_token || null);
            const result = { success: true, data: { user: response.user, token: response.token } };
            return result;
        }
        return response;
    }

    async register(userData) {
        return this.post('/auth/register', userData);
    }

    async logout() {
        try {
            await this.post('/auth/logout');
        } catch (error) {
            console.warn('Logout API hatası:', error);
        } finally {
            this.clearToken();
        }
    }

    async getCurrentUser() {
        const res = await this.get('/auth/me');
        // Normalize
        if (res && res.data && res.data.user) {
            return { success: true, data: { user: res.data.user } };
        }
        return res;
    }

    // Customer endpoints
    async getCustomers(params = {}) {
        return this.get('/customers', params);
    }

    async getCustomer(id) {
        return this.get(`/customers/${id}`);
    }

    async createCustomer(customerData) {
        return this.post('/customers', customerData);
    }

    async updateCustomer(id, customerData) {
        return this.put(`/customers/${id}`, customerData);
    }

    async deleteCustomer(id) {
        return this.delete(`/customers/${id}`);
    }

    async getCustomerFiles(customerId) {
        return this.get(`/files`, { type: 'customers', entity_id: customerId });
    }

    async deleteCustomerFile(customerId, dosyaAdi) {
        // Dosya adını encode et (URL-safe)
        const encodedFileName = encodeURIComponent(dosyaAdi);
        // Backend endpoint: DELETE /customers/:id/files?fileName=...
        return this.delete(`/customers/${customerId}/files?fileName=${encodedFileName}`);
    }

    // Order endpoints
    async getOrders(params = {}) {
        return this.get('/orders', params);
    }

    async getOrder(id) {
        return this.get(`/orders/${id}`);
    }

    async createOrder(orderData) {
        return this.post('/orders', orderData);
    }

    async createSicakSatis(orderData) {
        return this.post('/sicak-satislar', orderData);
    }

    async getSicakSatislar(params = {}) {
        return this.get('/sicak-satislar', params);
    }

    async updateOrder(id, orderData) {
        return this.put(`/orders/${id}`, orderData);
    }

    async deleteOrder(id) {
        return this.delete(`/orders/${id}`);
    }

    async getOrderStats(params = {}) {
        return this.get('/orders/stats/summary', params);
    }

    // Product endpoints
    async getProducts(params = {}) {
        return this.get('/products', params);
    }

    async getProductCategories() {
        return this.get('/products/categories');
    }

    async getProduct(id) {
        return this.get(`/products/${id}`);
    }

    async createProduct(productData) {
        return this.post('/products', productData);
    }

    async updateProduct(id, productData) {
        return this.put(`/products/${id}`, productData);
    }

    async deleteProduct(id) {
        return this.delete(`/products/${id}`);
    }

    // Partner endpoints
    async getPartners(params = {}) {
        return this.get('/partners', params);
    }

    async getPartner(id) {
        return this.get(`/partners/${id}`);
    }

    async createPartner(partnerData) {
        return this.post('/partners', partnerData);
    }

    async updatePartner(id, partnerData) {
        return this.put(`/partners/${id}`, partnerData);
    }

    async deletePartner(id) {
        return this.delete(`/partners/${id}`);
    }

    // Campaign endpoints
    async getCampaigns(params = {}) {
        return this.get('/campaigns', params);
    }

    async getCampaign(id) {
        return this.get(`/campaigns/${id}`);
    }

    async createCampaign(campaignData) {
        return this.post('/campaigns', campaignData);
    }

    async updateCampaign(id, campaignData) {
        return this.put(`/campaigns/${id}`, campaignData);
    }

    async deleteCampaign(id) {
        return this.delete(`/campaigns/${id}`);
    }

    // File endpoints
    async uploadFile(file, type = 'general', entityId = null) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);
        if (entityId) {
            formData.append('entity_id', entityId);
        }
        return this.uploadFormData('/files/upload', formData);
    }

    async downloadFile(filename) {
        const url = `${this.baseURL}/files/${filename}`;
        const headers = {};
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(url, { headers });
        
        if (!response.ok) {
            throw new Error(`Dosya indirilemedi: ${response.statusText}`);
        }

        return response.blob();
    }

    async deleteFile(filename) {
        return this.delete(`/files/${filename}`);
    }

    // Settings endpoints
    async getSettings(publicOnly = false) {
        return this.get('/settings', { public_only: publicOnly });
    }

    async getSetting(key) {
        return this.get(`/settings/${key}`);
    }

    async createSetting(settingData) {
        return this.post('/settings', settingData);
    }

    async updateSetting(key, settingData) {
        return this.put(`/settings/${key}`, settingData);
    }

    async deleteSetting(key) {
        return this.delete(`/settings/${key}`);
    }

    // Health check
    async healthCheck() {
        return this.get('/health');
    }

    async detailedHealthCheck() {
        return this.get('/health/detailed');
    }

    async databaseHealthCheck() {
        return this.get('/health/database');
    }

    // Utility methods
    isAuthenticated() {
        return !!this.token;
    }

    getToken() {
        return this.token;
    }

    // Error handling
    handleError(error) {
        console.error('API Error:', error);
        
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            this.clearToken();
            window.location.href = '/login';
        }
        
        throw error;
    }
}

    // Global olarak kullanılabilir hale getir
    window.FloovonProfessionalAPI = FloovonProfessionalAPI;

    // Backward compatibility için eski API'yi de koru
    window.FloovonAPI = FloovonProfessionalAPI;

} // if (typeof window.FloovonProfessionalAPI === 'undefined') kontrolü kapatıldı

