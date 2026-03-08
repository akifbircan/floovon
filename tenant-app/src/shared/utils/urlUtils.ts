/**
 * URL utility functions
 * React utility fonksiyonları - eski JS'teki getFloovonUploadUrl, getFloovonBackendBase yerine
 */

import { getApiBaseUrl } from '../../lib/runtime';

/**
 * Upload URL'ini oluştur
 * Eski JS'teki getFloovonUploadUrl yerine
 */
export function getUploadUrl(path: string | null | undefined): string {
  if (!path) return '';
  
  let cleanPath = path.trim();
  // Veritabanında localhost ile kayıtlı tam URL'leri mevcut siteye çevir (Mixed Content / CORS önleme)
  if (cleanPath.startsWith('http://localhost:') || cleanPath.startsWith('https://localhost:') ||
      cleanPath.startsWith('http://127.0.0.1:') || cleanPath.startsWith('https://127.0.0.1:')) {
    try {
      const u = new URL(cleanPath);
      cleanPath = u.pathname; // Sadece path kısmını kullan, aşağıda backend base ile birleştirilecek
    } catch {
      // Parse hatası olursa aşağıdaki relative path işlemine bırak
    }
  } else if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
    // Aynı origin ise relative yap; değilse olduğu gibi bırak
    if (typeof window !== 'undefined') {
      try {
        const u = new URL(cleanPath);
        if (u.origin === window.location.origin) {
          cleanPath = u.pathname;
        } else {
          return cleanPath;
        }
      } catch {
        return cleanPath;
      }
    } else {
      return cleanPath;
    }
  }
  
  // Backend base URL'ini al
  const backendBase = getBackendBaseUrl();
  
  // ✅ DÜZELTME: Path normalizasyonu
  // Backend'den gelen path'ler genellikle şu formatta olabilir:
  // - "uploads/tenants/1/organizations/2/davetiye-gorseli/..."
  // - "/uploads/tenants/1/organizations/2/davetiye-gorseli/..."
  // - "/api/uploads/tenants/1/organizations/2/davetiye-gorseli/..."
  // - "tenants/1/organizations/2/davetiye-gorseli/..."
  
  // /api/uploads/ -> /uploads/
  if (cleanPath.startsWith('/api/uploads/')) {
    cleanPath = cleanPath.substring(4); // "/uploads/..." kalır
  }
  // uploads/ (başında / yok) -> /uploads/
  else if (cleanPath.startsWith('uploads/') && !cleanPath.startsWith('/uploads/')) {
    cleanPath = `/${cleanPath}`;
  }
  // tenants/ ile başlıyorsa (uploads/ yok) -> /uploads/ ekle
  else if (cleanPath.startsWith('tenants/') || cleanPath.startsWith('/tenants/')) {
    if (!cleanPath.startsWith('/')) {
      cleanPath = `/uploads/${cleanPath}`;
    } else {
      cleanPath = `/uploads${cleanPath}`;
    }
  }
  // /uploads/ ile başlamıyorsa ve / ile başlıyorsa, /uploads/ ekle
  else if (!cleanPath.startsWith('/uploads/') && cleanPath.startsWith('/')) {
    // Zaten / ile başlıyor, /uploads/ ekle
    cleanPath = `/uploads${cleanPath}`;
  }
  // Hiçbiri değilse /uploads/ ekle
  else if (!cleanPath.startsWith('/uploads/') && !cleanPath.startsWith('/')) {
    cleanPath = `/uploads/${cleanPath}`;
  }
  
  // uploads/uploads/ gibi tekrarları temizle (tüm tekrarları temizle)
  while (cleanPath.includes('/uploads/uploads/')) {
    cleanPath = cleanPath.replace('/uploads/uploads/', '/uploads/');
  }
  
  // Eğer path hala /api/uploads/ ile başlıyorsa, /api kısmını kaldır
  if (cleanPath.startsWith('/api/uploads/')) {
    cleanPath = cleanPath.substring(4); // "/uploads/..." kalır
  }
  
  // Backend base URL'i /api ile bitiyorsa, /api'yi kaldır
  let finalBase = backendBase;
  if (finalBase.endsWith('/api')) {
    finalBase = finalBase.substring(0, finalBase.length - 4);
  }
  
  return `${finalBase}${cleanPath}`;
}

/**
 * Backend base URL'ini al
 * Eski JS'teki getFloovonBackendBase yerine
 */
export function getBackendBaseUrl(): string {
  // API base URL'ini al (örn: /api veya http://localhost:3001/api)
  const apiBase = getApiBaseUrl();
  
  // Eğer /api ile bitiyorsa, /api kısmını kaldır
  if (apiBase.endsWith('/api')) {
    return apiBase.substring(0, apiBase.length - 4);
  }
  
  // Eğer zaten backend base URL ise (örn: http://localhost:3001), direkt döndür
  // Vite dev server'da /api proxy kullanılıyorsa, boş string döndür (relative path)
  if (apiBase === '/api') {
    return '';
  }
  
  return apiBase;
}

