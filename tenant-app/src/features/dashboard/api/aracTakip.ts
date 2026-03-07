/**
 * Araç Takip API functions
 */

import { apiRequest } from '../../../lib/api';

interface AracTakipStartResponse {
  success: boolean;
  message?: string;
  data?: {
    arac_takip_id: number;
    baslangic_zamani: string;
  };
}

/**
 * "Teslimata Çıktım" - Araç takip başlat
 */
export async function startAracTakip(aracId?: string | number, userId?: number): Promise<AracTakipStartResponse> {
  // Eğer araç ID verilmemişse, localStorage'dan al (eski sistem uyumluluğu için)
  const selectedAracId = aracId || localStorage.getItem('secilenAracId');
  
  if (!selectedAracId) {
    throw new Error('Araç ID gerekli');
  }

  // Kullanıcı ID'sini al (userId parametresi veya localStorage'dan)
  let surucuId = userId;
  if (!surucuId) {
    // localStorage'dan user bilgisini al
    const userStr = localStorage.getItem('floovon_user') || localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        surucuId = user.id || user.user_id || user.userId;
      } catch (e) {
        // User parse hatası
      }
    }
  }

  // Kullanıcının konumunu al (navigator.geolocation)
  const getCurrentPosition = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation desteklenmiyor'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          reject(new Error('Konum alınamadı: ' + error.message));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  };

  // Konum al
  const { lat, lng } = await getCurrentPosition();

  // Backend endpoint: /api/arac-takip/:id/teslimat/baslat
  // Backend surucu_id, baslangic_konum_lat ve baslangic_konum_lng bekliyor
  const response = await apiRequest<AracTakipStartResponse>(`/arac-takip/${selectedAracId}/teslimat/baslat`, {
    method: 'POST',
    data: {
      surucu_id: surucuId, // ✅ KRİTİK: Backend surucu_id bekliyor
      baslangic_konum_lat: lat,
      baslangic_konum_lng: lng,
    },
  });

  return response;
}

/** GET /arac-takip/durum cevabı (mevcut kullanıcı teslimatta mı) */
export interface AracTakipDurumResponse {
  durum: 'teslimatta' | 'beklemede';
  arac_id?: number;
  teslimat_id?: number;
  baslangic_zamani?: string;
  plaka?: string | null;
  marka?: string | null;
  model?: string | null;
}

/**
 * Araç takip durumunu kontrol et (mobil header: teslimatta ise yeşil ikon + bilgi popup)
 */
export async function getAracTakipDurumu(): Promise<AracTakipDurumResponse> {
  const response = await apiRequest<AracTakipDurumResponse>('/arac-takip/durum');
  return response;
}

/** Teslimat tamamlama cevabı */
export interface AracTakipTamamlaResponse {
  success: boolean;
  message?: string;
}

/**
 * "Teslimatı sonlandır" – Mobil popup’tan teslimatı bitir (bitiş konumu gönderilir)
 */
export async function completeAracTakip(aracId: number): Promise<AracTakipTamamlaResponse> {
  const getCurrentPosition = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation desteklenmiyor'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }),
        (err) => reject(new Error('Konum alınamadı: ' + err.message)),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const { lat, lng } = await getCurrentPosition();

  const response = await apiRequest<AracTakipTamamlaResponse>(
    `/arac-takip/${aracId}/teslimat/tamamla`,
    {
      method: 'POST',
      data: {
        bitis_konum_lat: lat,
        bitis_konum_lng: lng,
      },
    }
  );
  return response;
}



