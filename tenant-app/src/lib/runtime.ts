/**
 * Runtime Configuration
 * Port ve origin mümkün olduğunca window.location'dan (sayfa nerede açıksa oradan) türetilir.
 */

export const getApiBaseUrl = (): string => {
  // Geliştirme modunda her zaman relative /api kullan (Vite proxy: 5174 -> 3001)
  // Böylece cookie/credentials aynı origin'de kalır, 3001'e doğrudan istek olmaz
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') {
      return '/api';
    }
  }

  // Tarayıcıda sayfa zaten production domain'deyse (HTTPS), localhost kullanma – Mixed Content önle
  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    const isProductionDomain = hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '';
    if (isProductionDomain) {
      return '/api';
    }
  }

  const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
  if (envBaseUrl && String(envBaseUrl).trim()) {
    const base = String(envBaseUrl).trim().replace(/\/+$/, '');
    return base.endsWith('/api') ? base : base + '/api';
  }

  if (typeof window === 'undefined') return '/api';

  const { hostname, port, protocol } = window.location;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';

  if (isLocalhost) {
    // Sayfa 3001'de açıksa (tek port / backend static) API aynı origin'de
    if (port === '3001') {
      return `${protocol}//${hostname}:${port}/api`;
    }
    return '/api';
  }

  return '/api';
};

export const isDevelopment = (): boolean => {
  return import.meta.env.DEV;
};

export const isProduction = (): boolean => {
  return import.meta.env.PROD;
};

/**
 * Şifre sıfırlama maillerindeki linkin gideceği adres.
 * Dinamik: Sayfa nerede açıksa (window.location.origin) o kullanılır.
 * Sadece farklı bir adrese zorlamak isterseniz .env'de VITE_APP_PUBLIC_ORIGIN tanımlayın.
 */
export const getFrontendOrigin = (): string => {
  const envOrigin = import.meta.env.VITE_APP_PUBLIC_ORIGIN;
  if (envOrigin && String(envOrigin).trim()) {
    return String(envOrigin).trim().replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
};




