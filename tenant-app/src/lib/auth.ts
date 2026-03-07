/**
 * Auth utilities
 * Token ve user bilgilerini yönetir
 */

export interface User {
  id: number;
  email?: string;
  name?: string; // DB: name
  surname?: string; // DB: surname
  ad?: string; // Türkçe ad alanı (isim)
  telefon?: string; // DB: phone
  role?: string; // DB: role
  tenant_id: number;
  profil_resmi?: string; // Profil resmi URL'i (DB: profile_image)
  profile_image?: string; // DB'den gelen profil resmi
  // Eski yapıyla uyumluluk için (backend mapping yapıyor)
  isim?: string; // name -> isim
  soyisim?: string; // surname -> soyisim
  kullaniciadi?: string; // username -> kullaniciadi
  yetki?: string; // role -> yetki
  username?: string; // DB: username
}

export interface AuthTokens {
  token: string;
  refreshToken?: string;
}

/**
 * Token'ı localStorage'dan al
 */
export const getToken = (): string | null => {
  return localStorage.getItem('floovon_token') || localStorage.getItem('token');
};

/**
 * Token'ı localStorage'a kaydet
 */
export const setToken = (token: string): void => {
  localStorage.setItem('floovon_token', token);
};

/**
 * User bilgisini localStorage'dan al
 */
export const getUser = (): User | null => {
  const userStr = localStorage.getItem('floovon_user');
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr) as User;
  } catch {
    return null;
  }
};

/**
 * User bilgisini localStorage'a kaydet
 */
export const setUser = (user: User): void => {
  localStorage.setItem('floovon_user', JSON.stringify(user));
  if (user.tenant_id) {
    localStorage.setItem('floovon_tenant_id', user.tenant_id.toString());
  }
};

/**
 * Tenant ID'yi al
 */
export const getTenantId = (): number | null => {
  const tenantIdStr = localStorage.getItem('floovon_tenant_id');
  if (!tenantIdStr) return null;
  
  const tenantId = parseInt(tenantIdStr, 10);
  return isNaN(tenantId) ? null : tenantId;
};

/**
 * Tüm auth bilgilerini temizle (logout)
 */
export const clearAuth = (): void => {
  localStorage.removeItem('floovon_token');
  localStorage.removeItem('token');
  localStorage.removeItem('floovon_user');
  localStorage.removeItem('floovon_user_id');
  localStorage.removeItem('user_id');
  localStorage.removeItem('floovon_tenant_id');
  localStorage.removeItem('remembered_tenant_code');
};

/**
 * Kullanıcı authenticated mı?
 */
export const isAuthenticated = (): boolean => {
  return !!getToken();
};

