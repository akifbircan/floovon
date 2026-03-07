/**
 * Form Actions API functions
 * Organizasyon kartı, sipariş ve müşteri oluşturma/güncelleme işlemleri
 */

import { apiRequest, apiClient } from '../../../lib/api';
import { getApiBaseUrl } from '../../../lib/runtime';
import type { OrganizasyonKart } from '../types';

// ========== ORGANİZASYON KARTI ==========

export interface OrganizasyonKartFormData {
  kart_tur: string;
  alt_tur?: string;
  kart_etiket?: string;
  il: string;
  ilce: string;
  mahalle: string;
  acik_adres: string;
  teslim_kisisi: string;
  teslim_kisisi_telefon: string;
  teslim_tarih: string;
  teslim_saat: string;
  teslimat_konumu?: string;
  davetiye_gorsel?: File | null;
  /** true gönderilirse mevcut davetiye görseli silinir */
  davetiye_kaldir?: boolean;
}

export interface OrganizasyonKartResponse {
  success: boolean;
  message?: string;
  data?: OrganizasyonKart;
  organizasyonId?: number;
}

/**
 * Yeni organizasyon kartı oluştur
 * apiRequest backend'den sadece data döndürüyor; davetiye ve dönüş { success, data } ile uyumlu.
 */
export async function createOrganizasyonKart(
  data: OrganizasyonKartFormData
): Promise<OrganizasyonKartResponse> {
  const { davetiye_gorsel, ...formData } = data;
  
  const response = await apiRequest<{ id: number; kart_tur?: string; [key: string]: unknown }>(
    '/organizasyon-kartlar',
    {
      method: 'POST',
      data: formData,
    }
  );

  if (response?.id && davetiye_gorsel) {
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('davetiye_gorsel', davetiye_gorsel);
      const baseUrl = getApiBaseUrl();
      await fetch(`${baseUrl}/organizasyon-kartlar/${response.id}/davetiye-gorseli`, {
        method: 'POST',
        body: uploadFormData,
        credentials: 'include',
      });
    } catch (error) {
      console.error('Davetiye görseli yükleme hatası:', error);
    }
  }

  return { success: true, data: response as unknown as OrganizasyonKart };
}

/**
 * Organizasyon kartını güncelle
 * Backend { success, message, data } döndürür; tam yanıt dönmek için apiClient kullanılıyor.
 */
export async function updateOrganizasyonKart(
  kartId: number,
  data: Partial<OrganizasyonKartFormData>
): Promise<OrganizasyonKartResponse> {
  const { davetiye_gorsel, davetiye_kaldir, ...formData } = data;
  
  const response = await apiClient.request<OrganizasyonKartResponse>({
    url: `/organizasyon-kartlar/${kartId}`,
    method: 'PUT',
    data: formData,
  });

  const result = response.data as OrganizasyonKartResponse;

  // Mevcut davetiye görselini kaldır
  if (result?.success && davetiye_kaldir) {
    try {
      const baseUrl = getApiBaseUrl();
      await fetch(`${baseUrl}/organizasyon-kartlar/${kartId}/davetiye-gorseli`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Davetiye görseli kaldırma hatası:', error);
    }
  }

  // Eğer davetiye görseli varsa, ayrıca yükle
  if (result?.success && davetiye_gorsel) {
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('davetiye_gorsel', davetiye_gorsel);
      const baseUrl = getApiBaseUrl();
      await fetch(`${baseUrl}/organizasyon-kartlar/${kartId}/davetiye-gorseli`, {
        method: 'POST',
        body: uploadFormData,
        credentials: 'include',
      });
    } catch (error) {
      console.error('Davetiye görseli yükleme hatası:', error);
    }
  }

  return result;
}

// ========== TESLİMAT KONUMLARI (ayarlar_genel_teslimat_konumlari) ==========

export interface TeslimatKonumuItem {
  id?: number;
  konum_adi: string;
  il?: string;
  ilce?: string;
  mahalle?: string;
  acik_adres?: string;
  [key: string]: unknown;
}

/**
 * İl ve ilçe ile eşleşen teslimat konumlarını getirir.
 * GET /api/teslimat-konumlari?il=...&ilce=...
 */
export async function getTeslimatKonumlari(params?: {
  il?: string;
  ilce?: string;
}): Promise<TeslimatKonumuItem[]> {
  const data = await apiRequest<TeslimatKonumuItem[]>(
    '/teslimat-konumlari',
    { method: 'GET', params: params as Record<string, unknown> }
  );
  return Array.isArray(data) ? data : [];
}

// ========== KONUM AYARLARI (ayarlar_genel_konum_ayarlari – çiçekçi varsayılan il/ilçe) ==========

export interface KonumAyarlari {
  il_id?: string;
  il_adi?: string;
  ilce_id?: string;
  ilce_adi?: string;
  [key: string]: unknown;
}

/**
 * Çiçekçinin bulunduğu konumu getirir (varsayılan il/ilçe).
 * GET /api/ayarlar/konum – Yeni kart formunda il/ilçe otomatik doldurulur.
 */
export async function getKonumAyarlari(): Promise<KonumAyarlari> {
  try {
    const data = await apiRequest<KonumAyarlari>('/ayarlar/konum');
    return (data && typeof data === 'object') ? (data as KonumAyarlari) : {};
  } catch {
    return {};
  }
}

// ========== ARAÇ SÜSLEME KARTI ==========

export interface AracSuslemeKartFormData {
  teslim_tarih: string;
  alt_tur?: string;
}

export interface AracSuslemeKartResponse {
  success: boolean;
  message?: string;
  data?: OrganizasyonKart;
  organizasyonId?: number;
}

/**
 * Yeni araç süsleme kartı oluştur
 * apiRequest sadece data döndürüyor; { success, data } sarıyoruz.
 */
export async function createAracSuslemeKart(
  data: AracSuslemeKartFormData
): Promise<AracSuslemeKartResponse> {
  const response = await apiRequest<OrganizasyonKart>(
    '/organizasyon-kartlar',
    {
      method: 'POST',
      data: {
        kart_tur: 'Araç Süsleme',
        teslim_tarih: data.teslim_tarih,
        alt_tur: data.alt_tur,
      },
    }
  );
  return { success: true, data: response };
}

// ========== ÖZEL SİPARİŞ KARTI ==========

export interface OzelSiparisKartFormData {
  teslim_tarih: string;
  kart_etiket?: string;
  alt_tur?: string;
}

export interface OzelSiparisKartResponse {
  success: boolean;
  message?: string;
  data?: OrganizasyonKart;
  organizasyonId?: number;
}

/**
 * Yeni özel sipariş kartı oluştur
 */
export async function createOzelSiparisKart(
  data: OzelSiparisKartFormData
): Promise<OzelSiparisKartResponse> {
  const response = await apiRequest<OrganizasyonKart>(
    '/organizasyon-kartlar',
    {
      method: 'POST',
      data: {
        kart_tur: 'Özel Sipariş',
        teslim_tarih: data.teslim_tarih,
        kart_etiket: data.kart_etiket,
        alt_tur: data.alt_tur,
      },
    }
  );
  return { success: true, data: response };
}

// ========== ÖZEL GÜN KARTI ==========

export interface OzelGunKartFormData {
  teslim_tarih: string;
  kart_etiket?: string;
  alt_tur?: string;
}

export interface OzelGunKartResponse {
  success: boolean;
  message?: string;
  data?: OrganizasyonKart;
  organizasyonId?: number;
}

/**
 * Yeni özel gün kartı oluştur
 * Sadece kart_tur 'ozel-gun', teslim_tarih ve kart_etiket; tür/alt_tur alanı kaldırıldı.
 */
export async function createOzelGunKart(
  data: OzelGunKartFormData
): Promise<OzelGunKartResponse> {
  const response = await apiRequest<OrganizasyonKart>(
    '/organizasyon-kartlar',
    {
      method: 'POST',
      data: {
        kart_tur: 'Özel Gün',
        teslim_tarih: data.teslim_tarih,
        kart_etiket: data.kart_etiket,
        alt_tur: data.alt_tur,
      },
    }
  );
  return { success: true, data: response };
}

// ========== MÜŞTERİ ==========

export interface MusteriFormData {
  name?: string;
  musteri_unvani?: string;
  musteri_ad_soyad?: string;
  musteri_telefon: string;
  musteri_eposta?: string;
  musteri_acik_adres?: string;
  musteri_il?: string;
  musteri_ilce?: string;
  musteri_mahalle?: string;
  musteri_tipi: 'bireysel' | 'kurumsal';
  musteri_kodu?: string;
  musteri_grubu?: string;
  musteri_vergi_kimlik_numarasi?: string;
  musteri_vergi_dairesi?: string;
  musteri_urun_yazisi?: string;
  urun_yazisi_gorsel?: File | null;
}

export interface MusteriResponse {
  success: boolean;
  message?: string;
  data?: {
    id: number;
    [key: string]: unknown;
  };
  customer?: {
    id: number;
    [key: string]: unknown;
  };
  id?: number;
}

/**
 * Yeni müşteri oluştur
 */
export async function createMusteri(
  data: MusteriFormData
): Promise<MusteriResponse> {
  const { urun_yazisi_gorsel, ...formData } = data;
  
  // Önce müşteriyi oluştur
  const response = await apiRequest<MusteriResponse>(
    '/customers',
    {
      method: 'POST',
      data: formData,
    }
  );

  // Eğer ürün yazısı görseli varsa, backend'in upload-file endpoint'i ile yükle (musteri_urun_yazi_dosyalar güncellenir)
  if (response.success && (response.data?.id || response.customer?.id || response.id) && urun_yazisi_gorsel) {
    try {
      const customerId = response.data?.id || response.customer?.id || response.id;
      const customerUnvan = (formData as { musteri_unvani?: string }).musteri_unvani || (formData as { name?: string }).name || 'musteri';
      const uploadFormData = new FormData();
      uploadFormData.append('file', urun_yazisi_gorsel);

      const params = new URLSearchParams({
        customerId: String(customerId),
        customerUnvan,
        fileName: urun_yazisi_gorsel.name || 'urun-yazisi',
      });
      const uploadRes = await fetch(`/api/customers/upload-file?${params.toString()}`, {
        method: 'POST',
        body: uploadFormData,
        credentials: 'include',
      });
      if (!uploadRes.ok) {
        const errBody = await uploadRes.text();
        console.error('Ürün yazısı görseli yükleme hatası:', uploadRes.status, errBody);
      }
    } catch (error) {
      console.error('Ürün yazısı görseli yükleme hatası:', error);
    }
  }

  return response;
}

/**
 * Mevcut müşteriyi güncelle
 */
export async function updateMusteri(
  id: number,
  data: MusteriFormData
): Promise<MusteriResponse> {
  const { urun_yazisi_gorsel, ...formData } = data;

  const response = await apiRequest<MusteriResponse>(
    `/customers/${id}`,
    {
      method: 'PUT',
      data: formData,
    }
  );

  // Ürün yazısı görseli varsa, upload-file endpoint'i ile güncel listeyi al
  if (response.success && urun_yazisi_gorsel) {
    try {
      const customerId = id;
      const customerUnvan =
        (formData as { musteri_unvani?: string }).musteri_unvani ||
        (formData as { name?: string }).name ||
        'musteri';
      const uploadFormData = new FormData();
      uploadFormData.append('file', urun_yazisi_gorsel);

      const params = new URLSearchParams({
        customerId: String(customerId),
        customerUnvan,
        fileName: urun_yazisi_gorsel.name || 'urun-yazisi',
      });
      const uploadRes = await fetch(`/api/customers/upload-file?${params.toString()}`, {
        method: 'POST',
        body: uploadFormData,
        credentials: 'include',
      });
      if (!uploadRes.ok) {
        const errBody = await uploadRes.text();
        console.error('Ürün yazısı görseli yükleme hatası (güncelleme):', uploadRes.status, errBody);
      }
    } catch (error) {
      console.error('Ürün yazısı görseli yükleme hatası (güncelleme):', error);
    }
  }

  return response;
}

// ========== ORGANİZASYON TÜRLERİ VE ETİKETLER ==========

export interface OrganizasyonTuru {
  id: number;
  tur_adi: string;
  tur_tipi?: string;
  grup_id?: number | null;
}

export interface OrganizasyonEtiketi {
  id: number;
  etiket_adi: string;
  etiket_tipi?: string;
  grup_id?: number | null;
}

export interface OrganizasyonGrubu {
  id: number;
  grup_adi?: string;
  tur_adi?: string;
}

/**
 * Organizasyon türlerini getir (opsiyonel grup_id ile filtre)
 */
export async function getOrganizasyonTurleri(grupId?: number | null): Promise<OrganizasyonTuru[]> {
  try {
    const url = typeof grupId === 'number' ? `/organizasyon-turleri?grup_id=${grupId}` : '/organizasyon-turleri';
    const data = await apiRequest<OrganizasyonTuru[]>(url);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Organizasyon türleri alınamadı:', error);
    return [];
  }
}

/**
 * Organizasyon etiketlerini getir (opsiyonel grup_id ile filtre)
 * apiRequest zaten backend { success, data } içinden data'yı döndürüyor.
 */
export async function getOrganizasyonEtiketleri(grupId?: number | null): Promise<OrganizasyonEtiketi[]> {
  try {
    const url = typeof grupId === 'number' ? `/organizasyon-etiketleri?grup_id=${grupId}` : '/organizasyon-etiketleri';
    const data = await apiRequest<OrganizasyonEtiketi[]>(url);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Organizasyon etiketleri alınamadı:', error);
    return [];
  }
}

/**
 * Organizasyon gruplarını getir (sekme bazlı etiketler için grup_id eşlemesi)
 */
export async function getOrganizasyonGruplari(): Promise<OrganizasyonGrubu[]> {
  try {
    const data = await apiRequest<OrganizasyonGrubu[]>('/organizasyon-gruplari');
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Organizasyon grupları alınamadı:', error);
    return [];
  }
}

/**
 * Yeni organizasyon türü oluştur (grup_id ile hangi sekme grubuna ait olduğu belirtilir)
 * apiRequest backend'den sadece data döndürüyor; biz { success, data } olarak sarıyoruz.
 */
export async function createOrganizasyonTuru(turAdi: string, grupId?: number | null): Promise<{ success: boolean; data?: OrganizasyonTuru }> {
  const data = await apiRequest<OrganizasyonTuru>(
    '/organizasyon-turleri',
    {
      method: 'POST',
      data: { tur_adi: turAdi, grup_id: grupId ?? undefined },
    }
  );
  return { success: true, data };
}

/**
 * Yeni organizasyon etiketi oluştur (grup_id ile hangi sekme grubuna ait olduğu belirtilir)
 */
export async function createOrganizasyonEtiketi(etiketAdi: string, grupId: number | null): Promise<{ success: boolean; data?: OrganizasyonEtiketi }> {
  const data = await apiRequest<OrganizasyonEtiketi>(
    '/organizasyon-etiketleri',
    {
      method: 'POST',
      data: { etiket_adi: etiketAdi, grup_id: grupId },
    }
  );
  return { success: true, data };
}

