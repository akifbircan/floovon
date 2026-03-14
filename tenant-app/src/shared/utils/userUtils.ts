/**
 * User utility functions
 * Kullanıcı ile ilgili yardımcı fonksiyonlar
 */

import { getApiBaseUrl } from '../../lib/runtime';
import { formatDuzenleyenTarih } from './dateUtils';

export interface User {
  id?: number;
  name?: string;
  ad?: string;
  surname?: string;
  soyad?: string;
  adSoyad?: string;
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
  
  const formatted = formatDuzenleyenTarih(tarih);
  const adSoyad = currentUser?.adSoyad || [currentUser?.name || currentUser?.ad, currentUser?.surname || currentUser?.soyad].filter(Boolean).join(' ').trim() || (currentUser?.name || currentUser?.ad || 'Kullanıcı');
  const tooltipText = adSoyad.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  if (!formatted || formatted === '—') {
    return `
      <img class="duzenleyen-profil-resmi" src="${avatarUrl}" alt="${tooltipText}" data-tooltip="${tooltipText}" data-tooltip-pos="top" onerror="this.onerror=null; this.src='${defaultProfileImage}';">
      <div class="duzenleme-tarih">Son Dzn: <span>Henüz düzenlenmedi</span></div>
    `;
  }

  return `
    <img class="duzenleyen-profil-resmi" src="${avatarUrl}" alt="${tooltipText}" data-tooltip="${tooltipText}" data-tooltip-pos="top" onerror="this.onerror=null; this.src='${defaultProfileImage}';">
    <div class="duzenleme-tarih">Son Dzn: <span>${formatted}</span></div>
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



