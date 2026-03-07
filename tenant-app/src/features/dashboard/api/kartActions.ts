/**
 * Kart Aksiyon API functions
 */

import { apiRequest } from '../../../lib/api';
import { getOrganizasyonKartDetay as getOrganizasyonKartDetayFromApi } from '../api';
import type { OrganizasyonKart } from '../types';

interface KartActionResponse {
  success: boolean;
  message?: string;
  data?: OrganizasyonKart;
}

/**
 * Organizasyon kartını güncelle
 */
export async function updateOrganizasyonKart(
  kartId: number,
  data: Partial<OrganizasyonKart>
): Promise<KartActionResponse> {
  const response = await apiRequest<KartActionResponse>(
    `/organizasyon-kartlar/${kartId}`,
    {
      method: 'PUT',
      data,
    }
  );

  return response;
}

/**
 * Organizasyon kartı detaylarını getir (listeyle aynı formatta: kart_tur, acik_adres, teslim_tarih vb.)
 */
export async function getOrganizasyonKartDetay(
  kartId: number
): Promise<OrganizasyonKart | null> {
  return getOrganizasyonKartDetayFromApi(kartId);
}



