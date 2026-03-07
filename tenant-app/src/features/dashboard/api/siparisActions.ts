/**
 * Sipariş Aksiyon API functions
 */

import { apiRequest } from '../../../lib/api';

interface SiparisActionResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

/**
 * Siparişi teslim et
 * ✅ DÜZELTME: PATCH /api/siparis-kartlar/{id}/deliver endpoint'ini kullan
 * Bu endpoint sadece teslim_edildi ve teslim_edildi_tarih alanlarını günceller
 * organizasyon_kart_id ve musteri_id alanlarını KORUR
 */
export async function teslimEtSiparis(siparisId: string | number): Promise<SiparisActionResponse> {
  const response = await apiRequest<SiparisActionResponse>(
    `/siparis-kartlar/${siparisId}/deliver`,
    {
      method: 'PATCH',
    }
  );
  if (response?.success && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('floovon-notifications-refresh'));
  }
  return response;
}

/**
 * Siparişi arşivle
 * ✅ DÜZELTME: Endpoint düzeltildi - /api/siparis-kartlar/{id}/archive (PATCH)
 */
export async function arsivleSiparis(
  siparisId: string | number, 
  sebep?: string,
  teslimBilgileri?: {
    teslim_kisisi?: string;
    teslim_turu?: 'kendisi' | 'baskasi';
    siparis_teslim_kisisi_baskasi?: string;
    teslim_imza_data?: string;
  },
  /** Çiçek Sepeti kartındaki sipariş ise true – backend sadece organizasyon_siparisler_ciceksepeti tablosunu günceller */
  ciceksepeti?: boolean
): Promise<SiparisActionResponse> {
  const requestData: any = {};
  
  if (sebep) {
    requestData.arsivleme_sebebi = sebep;
  }
  
  if (ciceksepeti === true) {
    requestData.ciceksepeti = true;
  }
  
  if (teslimBilgileri) {
    if (teslimBilgileri.teslim_kisisi) {
      requestData.teslim_kisisi = teslimBilgileri.teslim_kisisi;
    }
    if (teslimBilgileri.teslim_turu) {
      requestData.teslim_turu = teslimBilgileri.teslim_turu;
    }
    if (teslimBilgileri.siparis_teslim_kisisi_baskasi) {
      requestData.siparis_teslim_kisisi_baskasi = teslimBilgileri.siparis_teslim_kisisi_baskasi;
    }
    if (teslimBilgileri.teslim_imza_data) {
      requestData.teslim_imza_data = teslimBilgileri.teslim_imza_data;
    }
  }
  
  // ✅ DÜZELTME: Eski sistemde her zaman body gönderiliyor, boş olsa bile
  // Backend boş body'yi de kabul ediyor, o yüzden her zaman gönder
  const response = await apiRequest<SiparisActionResponse>(
    `/siparis-kartlar/${siparisId}/archive`,
    {
      method: 'PATCH',
      data: requestData, // Her zaman gönder (boş olsa bile)
    }
  );
  if (response?.success && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('floovon-notifications-refresh'));
  }
  return response;
}

/**
 * Organizasyon kartındaki tüm siparişleri teslim et
 * NOT: Backend'de bu endpoint yok, her siparişi tek tek teslim etmeliyiz
 */
export async function tumunuTeslimEt(organizasyonId: number): Promise<SiparisActionResponse> {
  try {
    // Önce organizasyon kartındaki tüm siparişleri getir
    const siparislerResponse = await apiRequest<any[]>(
      `/siparis-kartlar/organizasyon/${organizasyonId}`,
      {
        method: 'GET',
      }
    );

    if (!siparislerResponse || !Array.isArray(siparislerResponse)) {
      return {
        success: false,
        message: 'Siparişler getirilemedi',
      };
    }

    // Her siparişi tek tek teslim et
    const results = await Promise.allSettled(
      siparislerResponse.map((siparis) =>
        teslimEtSiparis(siparis.id)
      )
    );

    const basarili = results.filter((r) => r.status === 'fulfilled').length;
    const basarisiz = results.filter((r) => r.status === 'rejected').length;

    return {
      success: basarisiz === 0,
      message: `${basarili} sipariş teslim edildi${basarisiz > 0 ? `, ${basarisiz} sipariş başarısız` : ''}`,
      data: { basarili, basarisiz, toplam: siparislerResponse.length },
    };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || 'Tümünü teslim et işlemi başarısız',
    };
  }
}

/**
 * Organizasyon kartını arşivle
 * ✅ DÜZELTME: Backend endpoint'i PATCH /api/organizasyon-kartlar/:id/archive
 */
export async function arsivleOrganizasyonKart(organizasyonId: number, sebep?: string): Promise<SiparisActionResponse> {
  const response = await apiRequest<SiparisActionResponse>(
    `/organizasyon-kartlar/${organizasyonId}/archive`,
    {
      method: 'PATCH',
      data: { arsivleme_sebebi: sebep || null },
    }
  );

  return response;
}

/**
 * Siparişleri sırala
 * NOT: Backend endpoint'i yok, client-side sıralama yapılıyor
 * Bu fonksiyon artık kullanılmıyor - sıralama client-side yapılıyor
 */
export async function siralaSiparisler(
  organizasyonId: number,
  sortType: 'alfabetik' | 'tur'
): Promise<SiparisActionResponse> {
  // Backend endpoint'i yok, client-side sıralama yapılıyor
  // Bu fonksiyon geriye dönük uyumluluk için tutuluyor
  return {
    success: true,
    message: 'Sıralama client-side yapılıyor',
  };
}

/**
 * Siparişi başka bir organizasyon kartına taşı
 */
export async function tasiSiparis(
  siparisId: number,
  hedefOrganizasyonKartId: number
): Promise<SiparisActionResponse> {
  const response = await apiRequest<SiparisActionResponse>(
    `/siparis-kartlar/${siparisId}/organizasyon`,
    {
      method: 'PUT',
      data: { organizasyon_kart_id: hedefOrganizasyonKartId },
    }
  );

  return response;
}

/**
 * Kart sıra numaralarını güncelle (aynı organizasyon içinde veya farklı organizasyonlar arası taşıma sonrası)
 */
export async function updateKartSira(
  organizasyonKartId: number,
  siparisUpdates: Array<{ siparis_id: string | number; kart_sira: number }>
): Promise<SiparisActionResponse> {
  const response = await apiRequest<SiparisActionResponse>(
    `/siparis-kartlar/update-kart-sira`,
    {
      method: 'PUT',
      data: {
        organizasyon_kart_id: organizasyonKartId,
        siparis_updates: siparisUpdates,
      },
    }
  );

  return response;
}

// ========== SİPARİŞ GÜNCELLEME ==========

export interface SiparisFormData {
  organizasyon_kart_id?: number; // Optional - bazı siparişler bağımsız olabilir
  musteri_unvan?: string;
  musteri_isim_soyisim?: string;
  siparis_veren_telefon: string;
  urun_yazisi?: string;
  urun_gorsel?: string;
  siparis_urun: string;
  siparis_urun_id?: number | string;
  siparis_urun_aciklama?: string;
  siparis_tutari: number;
  odeme_yontemi: string;
  baglantili_siparisler?: string;
  ekstra_ucret_aciklama?: string;
  ekstra_ucret_tutari?: number;
  toplam_tutar?: number;
  arac_markamodel?: string;
  arac_renk?: string;
  arac_plaka?: string;
  arac_randevu_saat?: string;
  partner_firma_adi?: string;
  partner_siparis_turu?: 'verilen' | 'gelen';
  partner_firma_telefon?: string;
  teslim_kisisi?: string;
  teslim_kisisi_telefon?: string;
  teslim_il?: string;
  teslim_ilce?: string;
  teslim_mahalle?: string;
  teslim_acik_adres?: string;
  teslim_saat?: string;
  notes?: string;
  musteri_id?: number | string;
  siparis_urun_aciklama?: string;
  secilen_urun_yazi_dosyasi?: File | string;
}

/**
 * Siparişi güncelle
 */
export async function updateSiparis(
  siparisId: string | number,
  data: Partial<SiparisFormData>
): Promise<SiparisActionResponse> {
  const { secilen_urun_yazi_dosyasi, ...rest } = data;
  const formData: Partial<SiparisFormData> = {
    ...rest,
    // Mevcut dosya seçildiyse dosya adını backend'e gönder
    ...(typeof secilen_urun_yazi_dosyasi === 'string'
      ? { secilen_urun_yazi_dosyasi }
      : {}),
  };
  
  const raw = await apiRequest<{ success?: boolean; message?: string; data?: { id?: number | string }; id?: number | string }>(
    `/siparis-kartlar/${siparisId}`,
    {
      method: 'PUT',
      data: formData,
    }
  );

  const response: SiparisActionResponse = (raw && (raw as any).success === true)
    ? raw as SiparisActionResponse
    : (raw && ((raw as any).id !== undefined || ((raw as any).data && (raw as any).data.id)))
      ? { success: true, message: 'Sipariş kartı başarıyla güncellendi', data: raw }
      : { success: false, message: (raw as any)?.message || (raw as any)?.error || 'Sipariş güncellenemedi' };

  // Eğer ürün yazısı dosyası varsa, ayrıca yükle
  if (response.success && secilen_urun_yazi_dosyasi && typeof secilen_urun_yazi_dosyasi !== 'string') {
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('urun_yazisi_dosyasi', secilen_urun_yazi_dosyasi);
      await fetch(`/api/siparis-kartlar/${siparisId}/urun-yazisi-dosyasi`, {
        method: 'POST',
        body: uploadFormData,
        credentials: 'include',
      });
    } catch (error) {
      console.error('Ürün yazısı dosyası yükleme hatası:', error);
    }
  }

  return response;
}

/**
 * Yeni sipariş oluştur
 */
export async function createSiparis(
  data: SiparisFormData
): Promise<SiparisActionResponse> {
  const { secilen_urun_yazi_dosyasi, ...rest } = data;
  const formData: SiparisFormData = {
    ...rest,
    ...(typeof secilen_urun_yazi_dosyasi === 'string'
      ? { secilen_urun_yazi_dosyasi }
      : {}),
  };
  
  const raw = await apiRequest<{ success?: boolean; message?: string; data?: { id?: number | string }; id?: number | string }>(
    '/siparis-kartlar',
    {
      method: 'POST',
      data: formData,
    }
  );

  const response: SiparisActionResponse = (raw && (raw as any).success === true)
    ? raw as SiparisActionResponse
    : (raw && ((raw as any).id !== undefined || ((raw as any).data && (raw as any).data.id)))
      ? { success: true, message: 'Sipariş kartı başarıyla oluşturuldu', data: raw }
      : { success: false, message: (raw as any)?.message || (raw as any)?.error || 'Sipariş oluşturulamadı' };

  if (response.success && secilen_urun_yazi_dosyasi && typeof secilen_urun_yazi_dosyasi !== 'string') {
    try {
      const siparisId = (response.data as any)?.id ?? (raw as any)?.id;
      if (siparisId != null) {
        const uploadFormData = new FormData();
        uploadFormData.append('urun_yazisi_dosyasi', secilen_urun_yazi_dosyasi);
        await fetch(`/api/siparis-kartlar/${siparisId}/urun-yazisi-dosyasi`, {
          method: 'POST',
          body: uploadFormData,
          credentials: 'include',
        });
      }
    } catch (error) {
      console.error('Ürün yazısı dosyası yükleme hatası:', error);
    }
  }

  return response;
}


