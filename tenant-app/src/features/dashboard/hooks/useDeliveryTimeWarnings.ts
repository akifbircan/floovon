import type { OrganizasyonKart } from '../types';

/**
 * Teslim saati uyarılarını yöneten hook
 * ✅ REACT: Artık kullanılmıyor - her component kendi useDeliveryTimeWarning hook'unu kullanıyor
 * Bu hook sadece bugünün tarihindeki kartlar için kontrol yapıyordu, artık her component kendi uyarısını gösteriyor
 * 
 * @deprecated Bu hook artık kullanılmıyor. useDeliveryTimeWarning hook'unu kullanın.
 */
export function useDeliveryTimeWarnings(kartlar: OrganizasyonKart[] | null | undefined) {
  // ✅ REACT: Artık kullanılmıyor - her component kendi useDeliveryTimeWarning hook'unu kullanıyor
  // Bu hook sadece bugünün tarihindeki kartlar için kontrol yapıyordu, artık her component kendi uyarısını gösteriyor
}

