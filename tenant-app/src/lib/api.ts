/**
 * API Client - Tek Axios instance
 * Tüm API çağrıları buradan yapılacak
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getApiBaseUrl, getFrontendOrigin } from './runtime';

// Standart API Response formatı
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  errorCode?: string;
  message?: string;
  meta?: Record<string, unknown>;
}

// API Error class
export class ApiError extends Error {
  status?: number;
  errorCode?: string;
  response?: unknown;

  constructor(message: string, status?: number, errorCode?: string, response?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
    this.response = response;
  }
}

// Console override kaldırıldı - backend endpoint'leri implement edilecek

// Tek Axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Cookies için
});

// Request interceptor: Authorization header injection + tenant isolation
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // FormData gönderiminde Content-Type'ı kaldır; tarayıcı boundary ile multipart/form-data set eder
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    // Şifre sıfırlama maillerindeki linkin doğru frontend adresine gitmesi için
    // VITE_APP_PUBLIC_ORIGIN ile 3001 yerine 5174 (veya panel URL) kullanılabilir
    const frontendOrigin = getFrontendOrigin();
    if (frontendOrigin) {
      config.headers['X-Frontend-Origin'] = frontendOrigin;
    }

    // Token'ı localStorage'dan al
    const token = localStorage.getItem('floovon_token') || localStorage.getItem('token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Tenant ID'yi token'dan veya localStorage'dan al
    // TODO: Backend gerçeğine göre tenant_id'yi header/query/path olarak ekle
    const tenantId = localStorage.getItem('floovon_tenant_id');
    if (tenantId) {
      // Backend gerçeğine göre düzenlenecek:
      // config.headers['X-Tenant-ID'] = tenantId;
      // veya
      // config.params = { ...config.params, tenant_id: tenantId };
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: 401 handling + response normalization
apiClient.interceptors.response.use(
  (response) => {
    // Response normalizasyonu
    // Backend'in döndüğü format'a göre düzenlenecek
    return response;
  },
  (error: AxiosError) => {
    // 401 Unauthorized
    if (error.response?.status === 401) {
      const requestUrl = (error.config?.url || '').toString();
      const isLoginRequest = requestUrl.includes('/auth/login');

      // Login isteği (yanlış tenant/kullanıcı/şifre): sunucunun mesajını kullan, oturum temizleme/yönlendirme YAPMA
      if (isLoginRequest) {
        const data = error.response?.data as { error?: string; message?: string } | undefined;
        const serverMessage = data?.error || data?.message || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.';
        return Promise.reject(new ApiError(serverMessage, 401));
      }

      // Diğer isteklerde 401 = oturum süresi doldu
      localStorage.removeItem('floovon_token');
      localStorage.removeItem('token');
      localStorage.removeItem('floovon_user_id');
      localStorage.removeItem('user_id');
      localStorage.removeItem('floovon_tenant_id');

      window.location.href = '/login';
      return Promise.reject(new ApiError('Oturum süresi doldu', 401));
    }

    // 403 Forbidden - abonelik/tenant geçersizse anında çıkış
    if (error.response?.status === 403) {
      const data = error.response?.data as { error?: string; message?: string } | undefined;
      const serverMsg = data?.message || data?.error || '';
      const errMsg = serverMsg.toLowerCase();
      const forceLogout =
        /abonelik|aboneliğiniz|tenant|silindi|sona erdi|iptal|firma bulunamadı|oturum geçersiz/i.test(errMsg);
      if (forceLogout) {
        localStorage.removeItem('floovon_token');
        localStorage.removeItem('token');
        localStorage.removeItem('floovon_user_id');
        localStorage.removeItem('user_id');
        localStorage.removeItem('floovon_user');
        localStorage.removeItem('user');
        localStorage.removeItem('floovon_tenant_id');
        localStorage.removeItem('tenant_id');
        window.location.href = '/login';
      }
      return Promise.reject(
        new ApiError(
          serverMsg || 'Bu işlem için yetkiniz bulunmamaktadır',
          403,
          'FORBIDDEN',
          error.response.data
        )
      );
    }

    // 404 Not Found - sessizce handle et (endpoint henüz yoksa normal)
    if (error.response?.status === 404) {
      // Belirli endpoint'ler için 404 hatalarını sessizce handle et
      // Bu endpoint'ler henüz backend'de implement edilmemiş olabilir
      const silent404Endpoints = [
        '/raporlar',
        '/siparis-kartlar/arsiv',
        '/ayarlar/urun-gruplari',
        '/ayarlar/organizasyon-gruplari',
        '/ayarlar/organizasyon-turleri',
        '/ayarlar/organizasyon-etiketleri',
        '/organizasyon-kartlar/',
      ];
      
      const requestUrl = error.config?.url || '';
      const shouldSilence = silent404Endpoints.some(ep => requestUrl.includes(ep));
      
      // 404 hatasını sessizce fırlat (console'a yazma)
      // Sayfalar zaten try-catch ile handle ediyor
      const apiError = new ApiError(
        'Endpoint bulunamadı',
        404,
        'NOT_FOUND',
        error.response?.data
      );
      
      // Console'a yazma (sessizce handle et)
      // Axios'un kendi console log'larını engellemek için
      // error.config'de bir flag ekleyebiliriz ama şimdilik sessizce fırlat
      return Promise.reject(apiError);
    }

    // Diğer hatalar
    const data = error.response?.data as { message?: string; error?: string } | undefined;
    const errorMessage =
      data?.message ||
      data?.error ||
      error.message ||
      'Bir hata oluştu';
    
    const errorCode =
      (error.response?.data as { errorCode?: string })?.errorCode ||
      undefined;

    return Promise.reject(
      new ApiError(
        errorMessage,
        error.response?.status,
        errorCode,
        error.response?.data
      )
    );
  }
);

/**
 * API request wrapper
 * React Query ile kullanım için uygun format
 */
export async function apiRequest<T>(
  endpoint: string,
  options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    data?: unknown;
    params?: Record<string, unknown>;
  }
): Promise<T> {
  try {
    const response = await apiClient.request<ApiResponse<T>>({
      url: endpoint,
      method: options?.method || 'GET',
      data: options?.data,
      params: options?.params,
    });

    // Backend response formatı kontrolü
    // Backend { success: true, data: ... } dönüyorsa sadece data'yı döndür – sayfalar array/object bekliyor
    if (response.data && typeof response.data === 'object' && 'success' in response.data) {
      const apiResponse = response.data as ApiResponse<T>;
      if (apiResponse.success) {
        // data varsa payload'ı döndür (müşteri listesi, siparişler vb. doğrudan gelir)
        if (apiResponse.data !== undefined) return apiResponse.data as T;
        return response.data as T;
      }
      // success: false durumunda hata fırlat (backend bazen error, bazen message döner)
      const errMsg = (apiResponse as { message?: string; error?: string }).error
        || apiResponse.message
        || 'İstek başarısız';
      throw new ApiError(
        errMsg,
        undefined,
        apiResponse.errorCode,
        apiResponse
      );
    }
    
    // Direkt data formatındaysa (array veya object)
    return response.data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Bilinmeyen hata', undefined, undefined, error);
  }
}

// Export axios instance for direct use if needed
export { apiClient };

/**
 * Login isteği: 401 (yanlış tenant/şifre) konsola hata düşmesin diye validateStatus ile çağrılır.
 * Başarılı girişte { ok: true, data }, hatalı girişte { ok: false, message } döner.
 */
export async function loginRequest(body: {
  tenant_code: string;
  kullaniciadi: string;
  sifre: string;
}): Promise<
  | { ok: true; data: { token: string; user: unknown; tenant_id?: number } }
  | { ok: false; message: string }
> {
  try {
    const response = await apiClient.request({
      url: '/auth/login',
      method: 'POST',
      data: body,
      validateStatus: (status) => status === 200 || status === 401,
    });

    if (response.status === 401) {
      const data = response.data as { error?: string; message?: string } | undefined;
      const message =
        (data && typeof data === 'object' && (data.error || data.message)) ||
        'Geçersiz tenant kodu, kullanıcı adı veya şifre. Lütfen kontrol edin.';
      return { ok: false, message: String(message) };
    }

    // Backend: { success: true, data: { user, token } } veya { token, user } (düz)
    const raw = response.data as {
      success?: boolean;
      data?: { user?: unknown; token?: string; tenant_id?: number };
      token?: string;
      user?: unknown;
      tenant_id?: number;
    };
    const inner = raw?.data ?? raw;
    const token = inner?.token;
    const user = inner?.user;
    const tenant_id = inner?.tenant_id ?? (user as { tenant_id?: number })?.tenant_id;
    if (token && user) {
      return { ok: true, data: { token, user, tenant_id } };
    }
    const errMsg =
      (raw && typeof raw === 'object' && ((raw as { error?: string }).error ?? (raw as { message?: string }).message));
    return { ok: false, message: errMsg ? String(errMsg) : 'Giriş yanıtı geçersiz.' };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : 'Bağlantı hatası. Backend çalışıyor mu? (örn. port 3001)';
    return { ok: false, message: msg };
  }
}

