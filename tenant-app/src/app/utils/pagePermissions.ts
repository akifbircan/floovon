/**
 * Route path -> backend page_id eşlemesi
 * Backend: index, musteriiler, musteriiler-cari, partner-firmalar, partner-firmalar-cari,
 *          partnerler-potansiyel, kampanya-yonetimi, raporlar, arsiv-siparisler, ayarlar, profil-ayarlari
 */
export const ROUTE_TO_PAGE_ID: Record<string, string> = {
  '/': 'index',
  '/siparisler': 'index',
  '/musteriler': 'musteriler',
  '/musteriler-cari': 'musteriler-cari',
  '/partner-firmalar': 'partner-firmalar',
  '/partner-firmalar-cari': 'partner-firmalar-cari',
  '/partnerler-potansiyel': 'partnerler-potansiyel',
  '/kampanya-yonetimi': 'kampanya-yonetimi',
  '/raporlar': 'raporlar',
  '/arsiv-siparisler': 'arsiv-siparisler',
  '/ayarlar': 'ayarlar',
  '/profil-ayarlari': 'profil-ayarlari',
};

/** Path'ten page_id çıkar (örn: /musteriler-cari/123 -> musteriiler-cari) */
export function getPageIdFromPath(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return 'index';
  const first = '/' + segments[0];
  if (ROUTE_TO_PAGE_ID[first]) return ROUTE_TO_PAGE_ID[first];
  if (segments[0] === 'musteriler-cari') return 'musteriler-cari';
  if (segments[0] === 'partner-firmalar-cari') return 'partner-firmalar-cari';
  if (segments[0] === 'siparis-kart-detay') return 'index';
  return null;
}
