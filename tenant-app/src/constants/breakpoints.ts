/**
 * Responsive breakpoint sabitleri (px).
 * Dashboard yapısına göre: mobil ≤767, tablet benzeri 768–1439, masaüstü 1440+.
 */
export const BREAKPOINTS = {
  /** Mobil: max-width 767 */
  MOBILE_MAX: 767,
  /** Tablet benzeri (toggle panel, kart görünümleri): 768–1439 */
  TABLET_LIKE_MIN: 768,
  TABLET_LIKE_MAX: 1439,
  /** Masaüstü (sağ panel akışta, tam layout): 1440+ */
  DESKTOP_MIN: 1440,
} as const;

/** Telefon yatay uyarısı: landscape + kısa yükseklik (yatayda width > 767 olduğu için height ile tespit) */
export const PHONE_LANDSCAPE_MEDIA = '(orientation: landscape) and (max-height: 500px)';
