/**
 * User utility functions
 * Kullanıcı ile ilgili yardımcı fonksiyonlar
 */

import { getApiBaseUrl } from '../../lib/runtime';

export interface User {
  id?: number;
  name?: string;
  ad?: string;
  profil_resmi?: string;
  profile_image?: string;
}

/**
 * Düzenleyen HTML elementi oluştur
 */
export function createDuzenleyenHTML(
  tarih: Date | string | undefined | null,
  currentUser?: User | null
): string {
  const apiBaseUrl = getApiBaseUrl();
  const backendBase = apiBaseUrl.replace('/api', '');
  
  // Avatar URL'ini al
  const avatarUrl = getUserAvatar(currentUser, backendBase);
  const defaultProfileImage = `${backendBase}/assets/profil-default.jpg`;
  
  // Tarih parse fonksiyonu
  const parseTarih = (t: Date | string | undefined | null): Date => {
    if (!t) return new Date();
    
    // Date object ise direkt dön
    if (t instanceof Date) {
      return isNaN(t.getTime()) ? new Date() : t;
    }
    
    // String ise parse et
    if (typeof t === 'string') {
      // Boş string kontrolü
      if (t.trim() === '') return new Date();
      
      // ISO 8601 formatı kontrolü
      if (t.includes('T') && (t.endsWith('Z') || t.match(/[+-]\d{2}:\d{2}$/))) {
        return new Date(t);
      }
      
      // SQL datetime formatı (2025-01-15 10:30:00)
      if (t.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/)) {
        const [datePart, timePart] = t.split(' ');
        if (datePart && timePart) {
          const [year, month, day] = datePart.split('-').map(Number);
          const timeParts = timePart.split(':');
          const hour = parseInt(timeParts[0]) || 0;
          const minute = parseInt(timeParts[1]) || 0;
          const second = parseInt(timeParts[2]) || 0;
          const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
          if (!isNaN(date.getTime())) return date;
        }
      }
      
      // Diğer formatlar için Date constructor dene
      const date = new Date(t);
      if (!isNaN(date.getTime())) return date;
    }
    
    return new Date();
  };
  
  const tarihObj = parseTarih(tarih);
  
  if (isNaN(tarihObj.getTime())) {
    return `
      <img class="duzenleyen-profil-resmi" src="${avatarUrl}" alt="${currentUser?.name || currentUser?.ad || 'Kullanıcı'}" onerror="this.onerror=null; this.src='${defaultProfileImage}';">
      <div class="duzenleme-tarih">Son Dzn: <span>Henüz düzenlenmedi</span></div>
    `;
  }
  
  const tarihStr = tarihObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  const saatStr = tarihObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  
  return `
    <img class="duzenleyen-profil-resmi" src="${avatarUrl}" alt="${currentUser?.name || currentUser?.ad || 'Kullanıcı'}" onerror="this.onerror=null; this.src='${defaultProfileImage}';">
    <div class="duzenleme-tarih">Son Dzn: <span>${tarihStr}, ${saatStr}</span></div>
  `;
}

/**
 * Kullanıcı avatar URL'ini al (internal)
 */
function getUserAvatar(user: User | null | undefined, backendBase: string): string {
  if (!user) {
    return `${backendBase}/assets/profil-default.jpg`;
  }
  const profilResmi = user.profil_resmi || (user as any).profile_image;
  if (!profilResmi) {
    return `${backendBase}/assets/profil-default.jpg`;
  }
  if (profilResmi.startsWith('http://') || profilResmi.startsWith('https://')) {
    return profilResmi;
  }
  const cleanPath = profilResmi.startsWith('/') ? profilResmi.substring(1) : profilResmi;
  if (!cleanPath.startsWith('uploads/')) {
    return `${backendBase}/uploads/${cleanPath}`;
  }
  return `${backendBase}/${cleanPath}`;
}

/**
 * Düzenleyen / profil resmi URL'i (modal vb. için export)
 */
export function getProfileImageUrl(user: { profil_resmi?: string; profile_image?: string } | null | undefined): string {
  const apiBaseUrl = getApiBaseUrl();
  const backendBase = apiBaseUrl.replace('/api', '');
  return getUserAvatar(user as User, backendBase);
}



