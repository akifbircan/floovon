/**
 * Dashboard API functions
 */

import { apiRequest } from '../../lib/api';
import type { OrganizasyonKart, Order } from './types';
import { teslimEtSiparis } from './api/siparisActions';
import { sendTeslimEdildiWhatsApp, getTeslimKisiFromKart } from './utils/whatsappMessageUtils';

// Backend response types
interface BackendOrganizasyonKart {
  id: number;
  // Kısa isimler (backend'den direkt gelebilir)
  kart_tur?: string;
  alt_tur?: string;
  kart_etiket?: string;
  mahalle?: string;
  acik_adres?: string;
  teslim_kisisi?: string;
  teslim_kisisi_telefon?: string;
  teslim_tarih?: string;
  teslim_saat?: string;
  kart_gorsel?: string;
  teslim_foto_sayisi?: number;
  siparis_sayisi?: number;
  partner_siparis_sayisi?: number;
  // Uzun isimler (backend'den organizasyon_ prefix ile gelebilir)
  organizasyon_kart_tur?: string;
  organizasyon_alt_tur?: string;
  organizasyon_kart_etiket?: string;
  organizasyon_mahalle?: string;
  organizasyon_acik_adres?: string;
  organizasyon_teslim_kisisi?: string;
  organizasyon_teslim_kisisi_telefon?: string;
  organizasyon_teslim_tarih?: string;
  organizasyon_teslim_saat?: string;
  organizasyon_davetiye_gorsel?: string;
  organizasyon_teslim_foto_sayisi?: number;
  organizasyon_toplam_siparis_sayisi?: number;
  // İlçe/il bilgileri
  organizasyon_ilce?: string;
  organizasyon_il?: string;
  ilce?: string;
  il?: string;
  organizasyon_teslimat_konumu?: string;
  [key: string]: unknown;
}

interface BackendSiparis {
  id: number | string;
  organizasyon_id?: number;
  organizasyon_kart_id?: number;
  musteri_unvan?: string;
  musteri_isim_soyisim?: string;
  /** Eski/alternatif kolon adları (veritabanı migration sonrası uyumluluk) */
  musteri_unvani?: string;
  musteri_ad_soyad?: string;
  siparis_veren?: string;
  siparis_veren_telefon?: string;
  teslim_kisisi?: string;
  teslim_kisisi_telefon?: string;
  organizasyon_teslim_kisisi?: string;
  organizasyon_teslim_kisisi_telefon?: string;
  teslim_tarih?: string;
  teslim_saat?: string;
  teslim_saati?: string;
  status?: string;
  durum?: string;
  notes?: string;
  teslim_mahalle?: string;
  mahalle?: string;
  teslim_acik_adres?: string;
  acik_adres?: string;
  siparis_urun?: string;
  urun_adi?: string;
  urun_id?: number | string;
  siparis_urun_id?: number | string;
  product_id?: number | string;
  siparis_tutari?: number;
  toplam_tutar?: number;
  odeme_yontemi?: string;
  arac_markamodel?: string;
  arac_renk?: string;
  arac_plaka?: string;
  arac_randevu_saat?: string;
  kart_sira?: number;
  partner_firma_adi?: string;
  partner_siparis_turu?: string;
  partner_firma_telefon?: string;
  urun_gorsel?: string;
  product_gorsel?: string;
  urun_yazisi?: string;
  updated_at?: string;
  updated_by?: number | string;
  updated_by_profil_resmi?: string;
  updated_by_name?: string;
  updated_by_soyad?: string;
  updated_by_ad_soyad?: string;
  ekstra_ucret?: number;
  ekstra_ucret_tutari?: number;
  ekstra_ucret_aciklama?: string;
  teslim_ilce?: string;
  teslim_il?: string;
  secilen_urun_yazi_dosyasi?: string;
  [key: string]: unknown;
}

interface GetOrganizasyonKartlariResponse {
  success: boolean;
  data: BackendOrganizasyonKart[];
  total?: number;
}

interface GetSiparisKartlariResponse {
  success: boolean;
  data: BackendSiparis[];
  total?: number;
}

/**
 * Backend kart_tur değerini frontend formatına map et
 * Backend'den gelen değerler: "Düğün", "Nişan", "Araç Süsleme", "arac-susleme", "ozel-siparis", "ozel-gun" vb.
 */
function mapKartTur(backendKartTur: string | undefined): OrganizasyonKart['kart_tur'] {
  if (!backendKartTur) return 'organizasyon';

  const tur = backendKartTur.toLowerCase().trim();

  // Slug formatı (API'den gelen)
  if (tur === 'arac-susleme' || tur === 'aracsusleme') return 'aracsusleme';
  if (tur === 'ozel-siparis' || tur === 'ozelsiparis') return 'ozelsiparis';
  if (tur === 'ozel-gun' || tur === 'ozelgun') return 'ozelgun';

  // Düğün, Nişan, Sünnet, Kesme → organizasyon
  if (tur === 'düğün' || tur === 'dugun' || tur === 'nişan' || tur === 'nisan' ||
      tur === 'sünnet' || tur === 'sunnet' || tur === 'kesme' || tur === 'kermes' ||
      tur.includes('düğün') || tur.includes('dugun') || tur.includes('nişan') || tur.includes('nisan') ||
      tur.includes('sünnet') || tur.includes('sunnet') || tur.includes('kesme') || tur.includes('kermes')) {
    return 'organizasyon';
  }

  // Araç Süsleme → aracsusleme
  if (tur === 'araç süsleme' || tur === 'arac susleme' || tur === 'araçsüsleme' ||
      tur.includes('araç') || tur.includes('arac') || tur.includes('süsleme') || tur.includes('susleme')) {
    return 'aracsusleme';
  }

  // Özel Gün → ozelgun
  if (tur === 'özel gün' || tur === 'ozel gun' || tur === 'özelgün' ||
      tur.includes('özel gün') || tur.includes('ozel gun') || tur.includes('özelgün')) {
    return 'ozelgun';
  }

  // Özel Sipariş → ozelsiparis
  if (tur === 'özel sipariş' || tur === 'ozel siparis' || tur === 'özelsipariş' ||
      tur.includes('özel sipariş') || tur.includes('ozel siparis') || tur.includes('özelsipariş')) {
    return 'ozelsiparis';
  }

  // Çiçek Sepeti → ciceksepeti (özel sipariş org kart formatı: tek teslim tarihi, siparişler kart içinde)
  if (tur === 'çiçek sepeti' || tur === 'ciceksepeti' || tur.includes('çiçek sepeti') || tur.includes('ciceksepeti')) {
    return 'ciceksepeti';
  }

  // Organizasyon türleri (Düğün, Nişan, Kermes vb.) → organizasyon
  return 'organizasyon';
}

/** Backend'den gelen kart_tur slug/raw değerini ekranda gösterilecek Türkçe etikete çevirir. Organizasyon alt türleri (Düğün, Nişan vb.) ana türde "Organizasyon" döner. */
function getKartTurDisplayLabel(backendKartTur: string | undefined): string {
  if (!backendKartTur) return 'Organizasyon';
  const tur = backendKartTur.toLowerCase().trim();
  if (tur === 'arac-susleme' || tur === 'aracsusleme') return 'Araç Süsleme';
  if (tur === 'ozel-siparis' || tur === 'ozelsiparis') return 'Özel Sipariş';
  if (tur === 'ozel-gun' || tur === 'ozelgun') return 'Özel Gün';
  if (tur === 'çiçek sepeti' || tur === 'ciceksepeti') return 'Çiçek Sepeti';
  // Organizasyon slug veya organizasyon alt türleri (Düğün, Nişan, Sünnet, Kesme vb.) → hep "Organizasyon"
  if (tur === 'organizasyon' || tur === 'dugun' || tur === 'nisan' || tur === 'sunnet' || tur === 'kesme' ||
      tur.includes('düğün') || tur.includes('nişan') || tur.includes('sünnet') || tur.includes('kesme')) {
    return 'Organizasyon';
  }
  return backendKartTur.trim();
}

/**
 * Backend organizasyon kartını UI formatına map et.
 * Organizasyon ana türünde: kart_tur_display her zaman "Organizasyon"; alt_tur backend'deki alt_tur veya eski kart_tur (Düğün/Nişan vb.).
 */
function mapOrganizasyonKart(backend: BackendOrganizasyonKart): OrganizasyonKart {
  const rawTur = backend.kart_tur || backend.organizasyon_kart_tur;
  const mappedTur = mapKartTur(rawTur);
  const isOrganizasyon = mappedTur === 'organizasyon';
  // Organizasyon kartlarında: alt_tur = backend alt_tur veya (eski veride kart_tur Düğün/Nişan ise onu alt tür say)
  const altTurRaw = backend.alt_tur || backend.organizasyon_alt_tur;
  const organizasyonAltTurNames = ['düğün', 'dugun', 'nişan', 'nisan', 'sünnet', 'sunnet', 'kesme', 'kermes'];
  const rawTurLower = (rawTur || '').toLowerCase().trim();
  const isEskiOrganizasyonAltTur = organizasyonAltTurNames.some((n) => rawTurLower === n || rawTurLower.includes(n));
  const altTur = altTurRaw || (isOrganizasyon && isEskiOrganizasyonAltTur ? (rawTur || '').trim() : undefined);

  return {
    id: backend.id,
    kart_tur: mappedTur,
    kart_tur_display: getKartTurDisplayLabel(rawTur),
    alt_tur: altTur || undefined,
    kart_etiket: backend.kart_etiket || backend.organizasyon_kart_etiket,
    mahalle: backend.mahalle || backend.organizasyon_mahalle,
    acik_adres: backend.acik_adres || backend.organizasyon_acik_adres,
    teslim_kisisi: backend.teslim_kisisi || backend.organizasyon_teslim_kisisi,
    teslim_kisisi_telefon: backend.teslim_kisisi_telefon || backend.organizasyon_teslim_kisisi_telefon,
    teslim_tarih: backend.teslim_tarih || backend.organizasyon_teslim_tarih,
    teslim_saat: backend.teslim_saat || backend.organizasyon_teslim_saat,
    kart_gorsel: backend.kart_gorsel || backend.organizasyon_davetiye_gorsel,
    teslim_foto_sayisi: backend.teslim_foto_sayisi || backend.organizasyon_teslim_foto_sayisi || 0,
    siparis_sayisi: backend.siparis_sayisi || backend.organizasyon_toplam_siparis_sayisi || 0,
    partner_siparis_sayisi: backend.partner_siparis_sayisi || 0,
    // İlçe/il bilgileri
    organizasyon_ilce: backend.organizasyon_ilce || backend.ilce,
    organizasyon_il: backend.organizasyon_il || backend.il,
    organizasyon_teslimat_konumu: (backend.organizasyon_teslimat_konumu || backend.teslimat_konumu) as string | undefined,
  };
}

/**
 * Backend siparişi UI formatına map et
 */
function mapSiparis(backend: BackendSiparis): Order {
  return {
    id: backend.id,
    organizasyon_id: backend.organizasyon_id || backend.organizasyon_kart_id,
    musteriAdi:
      backend.musteri_isim_soyisim ||
      backend.musteri_unvan ||
      (backend as any).musteri_ad_soyad ||
      (backend as any).musteri_unvani ||
      (backend as any).musteri_adi ||
      backend.siparis_veren ||
      (backend as any).customer_name ||
      'Bilinmeyen',
    musteriUnvani: backend.musteri_unvan,
    tarih: backend.teslim_tarih || (typeof backend.teslim_tarihi === 'string' ? backend.teslim_tarihi : '') || '',
    durum: (backend.durum || backend.status || 'bekliyor') as Order['durum'],
    teslimSaati: backend.teslim_saat || backend.teslim_saati || backend.arac_randevu_saat || '',
    not: backend.urun_yazisi || backend.notes,
    notes: backend.notes, // Yazi-not için ayrı alan
    telefon: backend.siparis_veren_telefon || backend.teslim_kisisi_telefon,
    mahalle: backend.teslim_mahalle || backend.mahalle,
    acikAdres: backend.teslim_acik_adres || backend.acik_adres,
    urun: backend.siparis_urun || backend.urun_adi,
    tutar: backend.siparis_tutari || backend.toplam_tutar,
    odemeYontemi: backend.odeme_yontemi,
    aracMarkaModel: backend.arac_markamodel,
    aracRenk: backend.arac_renk,
    aracPlaka: backend.arac_plaka,
    aracRandevuSaat: backend.arac_randevu_saat,
    // Ek alanlar
    kartSira: backend.kart_sira,
    partnerFirmaAdi: backend.partner_firma_adi,
    partnerSiparisTuru: (() => {
      const t = (backend.partner_siparis_turu || '').toString().toLowerCase().trim();
      if (t === 'verilen') return 'verilen' as const;
      if (t === 'alinan' || t === 'alınan' || t === 'gelen') return 'alinan' as const;
      return undefined;
    })(),
    partnerFirmaTelefon: backend.partner_firma_telefon,
    // SADECE organizasyon sahibi / teslim kişisi – siparis_teslim_kisisi_baskasi sadece WhatsApp mesajlarında kullanılır, burada asla kullanılmaz
    teslimKisisi: backend.organizasyon_teslim_kisisi || backend.teslim_kisisi,
    teslimKisisiTelefon: backend.organizasyon_teslim_kisisi_telefon || backend.teslim_kisisi_telefon,
    urunGorsel: backend.urun_gorsel || backend.product_gorsel,
    urunYazisi: backend.urun_yazisi,
    updatedAt: backend.updated_at,
    updatedBy: backend.updated_by?.toString(),
    updatedByUser: (backend.updated_by_profil_resmi != null || backend.updated_by_name != null || backend.updated_by_ad_soyad != null)
      ? { profil_resmi: backend.updated_by_profil_resmi, profile_image: backend.updated_by_profil_resmi, name: backend.updated_by_name, ad: backend.updated_by_name, surname: backend.updated_by_soyad, soyad: backend.updated_by_soyad, adSoyad: backend.updated_by_ad_soyad || [backend.updated_by_name, backend.updated_by_soyad].filter(Boolean).join(' ').trim() }
      : undefined,
    // Ödeme bilgileri (backend ekstra_ucret_tutari döner; ekstra_ucret eski/alternatif alan)
    ekstraUcret: backend.ekstra_ucret_tutari ?? backend.ekstra_ucret,
    ekstraUcretAciklama: backend.ekstra_ucret_aciklama,
    toplamTutar: backend.toplam_tutar,
    // Teslim adresi detayları
    teslimIlce: backend.teslim_ilce,
    teslimIl: backend.teslim_il,
    // Ürün ID'leri - OrderCard'da görsel yükleme için gerekli
    urunId: backend.urun_id || backend.siparis_urun_id || backend.product_id,
    secilenUrunYaziDosyasi: backend.secilen_urun_yazi_dosyasi,
  };
}

/**
 * Tüm organizasyon kartlarını getir
 * selectedWeek parametresi ile haftaya göre filtreleme yapılabilir
 */
export async function getOrganizasyonKartlari(selectedWeek?: string): Promise<OrganizasyonKart[]> {
  // ✅ KRİTİK: Tüm kartları getir - week parametresi gönderme, frontend'de filtrele
  // Backend'den her zaman tüm kartları çek, frontend'de hafta filtresi uygula
  const response = await apiRequest<GetOrganizasyonKartlariResponse>('/organizasyon-kartlar', {
    // week parametresi göndermiyoruz - backend'den tüm kartları çek
  });

  // Backend response formatı: { success: true, data: [...] } veya direkt data array
  let rawData: BackendOrganizasyonKart[] = [];

  if (response && typeof response === 'object') {
    // Eğer response.success varsa, response.data'yı kullan
    if ('success' in response && response.success && 'data' in response) {
      rawData = Array.isArray(response.data) ? response.data : [];
    }
    // Eğer direkt array ise
    else if (Array.isArray(response)) {
      rawData = response;
    }
    // Eğer response.data array ise
    else if ('data' in response && Array.isArray(response.data)) {
      rawData = response.data;
    }
  }

  if (rawData.length === 0) {
    return [];
  }

  const mapped = rawData.map(mapOrganizasyonKart);
  return mapped;
}

/**
 * Organizasyona ait siparişleri getir
 */
export async function getSiparisKartlariByOrganizasyon(
  organizasyonId: number
): Promise<Order[]> {
  const response = await apiRequest<GetSiparisKartlariResponse>(
    `/siparis-kartlar/organizasyon/${organizasyonId}`
  );

  // Response formatını kontrol et - hem { success, data } hem de direkt array olabilir
  let rawData: any[] = [];
  
  if (response && typeof response === 'object') {
    // Eğer response.success varsa, response.data'yı kullan
    if ('success' in response && response.success && 'data' in response) {
      rawData = Array.isArray(response.data) ? response.data : [];
    }
    // Eğer direkt array ise
    else if (Array.isArray(response)) {
      rawData = response;
    }
    // Eğer response.data array ise
    else if ('data' in response && Array.isArray(response.data)) {
      rawData = response.data;
    }
  }
  
  if (rawData.length === 0) {
    return [];
  }

  // Arşivlenmiş siparişleri filtrele (eski sistemdeki gibi)
  // Eski sistemde: s.arsivli === 0 || s.arsivli === false || s.arsivli === null
  const filteredData = rawData.filter((backend) => {
    const arsivli = backend.arsivli || backend.archived || backend.arsivlenmis;
    // Arşivlenmemiş siparişleri al (arsivli === 0, false, null, undefined)
    return arsivli === 0 || arsivli === false || arsivli === null || arsivli === undefined;
  });

  const mapped = filteredData.map((backend) => {
    const mapped = mapSiparis(backend);
    (mapped as any)._raw = backend;
    return mapped;
  });

  return mapped;
}

/** Detay endpoint'i kart_turu, adres, teslim_tarihi vb. döndürüyor; listeyle aynı forma çevirip map ediyoruz. */
export async function getOrganizasyonKartDetay(kartId: number): Promise<OrganizasyonKart | null> {
  try {
    const raw = await apiRequest<Record<string, unknown>>(`/organizasyon-kartlar/${kartId}`);
    if (!raw || typeof raw.id !== 'number') return null;
    const backend: BackendOrganizasyonKart = {
      id: raw.id as number,
      kart_tur: (raw.kart_tur ?? raw.kart_turu) as string | undefined,
      organizasyon_kart_tur: (raw.organizasyon_kart_tur ?? raw.kart_turu) as string | undefined,
      alt_tur: raw.alt_tur as string | undefined,
      organizasyon_alt_tur: (raw.organizasyon_alt_tur ?? raw.alt_tur) as string | undefined,
      kart_etiket: (raw.kart_etiket ?? raw.organizasyon_kart_etiket) as string | undefined,
      mahalle: (raw.mahalle ?? raw.organizasyon_mahalle) as string | undefined,
      organizasyon_mahalle: (raw.organizasyon_mahalle ?? raw.mahalle) as string | undefined,
      acik_adres: (raw.acik_adres ?? raw.adres) as string | undefined,
      organizasyon_acik_adres: (raw.organizasyon_acik_adres ?? raw.adres) as string | undefined,
      teslim_kisisi: (raw.teslim_kisisi ?? raw.organizasyon_sahibi) as string | undefined,
      organizasyon_teslim_kisisi: (raw.organizasyon_teslim_kisisi ?? raw.organizasyon_sahibi) as string | undefined,
      teslim_kisisi_telefon: (raw.teslim_kisisi_telefon ?? raw.organizasyon_sahibi_telefon) as string | undefined,
      organizasyon_teslim_kisisi_telefon: (raw.organizasyon_teslim_kisisi_telefon ?? raw.organizasyon_sahibi_telefon) as string | undefined,
      teslim_tarih: (raw.teslim_tarih ?? raw.teslim_tarihi) as string | undefined,
      organizasyon_teslim_tarih: (raw.organizasyon_teslim_tarih ?? raw.teslim_tarihi) as string | undefined,
      teslim_saat: (raw.teslim_saat ?? raw.teslim_saati) as string | undefined,
      organizasyon_teslim_saat: (raw.organizasyon_teslim_saat ?? raw.teslim_saati) as string | undefined,
      kart_gorsel: (raw.kart_gorsel ?? raw.organizasyon_davetiye_gorsel) as string | undefined,
      organizasyon_davetiye_gorsel: (raw.organizasyon_davetiye_gorsel ?? raw.kart_gorsel) as string | undefined,
      organizasyon_il: (raw.organizasyon_il ?? raw.il) as string | undefined,
      organizasyon_ilce: (raw.organizasyon_ilce ?? raw.ilce) as string | undefined,
      organizasyon_teslimat_konumu: raw.organizasyon_teslimat_konumu as string | undefined,
      organizasyon_teslim_foto_sayisi: (raw.teslim_foto_sayisi ?? raw.organizasyon_teslim_foto_sayisi) as number | undefined,
      organizasyon_toplam_siparis_sayisi: (raw.toplam_siparis_sayisi ?? raw.organizasyon_toplam_siparis_sayisi) as number | undefined,
      ...raw,
    };
    return mapOrganizasyonKart(backend);
  } catch {
    return null;
  }
}

/**
 * Organizasyon kartındaki tüm siparişleri teslim et + isteğe bağlı WhatsApp.
 * Index ve sipariş detay sayfasında aynı mantıkla kullanılır.
 */
export async function deliverAllOrdersInKart(
  kartId: number,
  orgKart: OrganizasyonKart,
  options?: { sendWhatsApp?: boolean }
): Promise<{ success: boolean; message: string; basarili: number; basarisiz: number }> {
  let siparisler: Order[] = [];
  try {
    siparisler = await getSiparisKartlariByOrganizasyon(kartId);
  } catch (e) {
    console.error('Siparişler getirilemedi:', e);
    return { success: false, message: 'Siparişler getirilemedi', basarili: 0, basarisiz: 0 };
  }
  const teslimEdilecekler = siparisler.filter((s) => (s.durum ?? (s as any).status) !== 'teslim');
  let basarili = 0;
  let basarisiz = 0;
  const kartTur = ((orgKart as any).kart_tur ?? (orgKart as any).kart_turu ?? '').toString();
  const isOzelKart = kartTur === 'ozelgun' || kartTur === 'ozelsiparis';
  const isCiceksepeti = kartTur === 'Çiçek Sepeti' || kartTur.toLowerCase().includes('ciceksepeti') || kartTur.toLowerCase().includes('çiçek sepeti');
  for (const order of teslimEdilecekler) {
    try {
      await teslimEtSiparis(order.id, isCiceksepeti ? { ciceksepeti: true } : undefined);
      if (options?.sendWhatsApp) {
        try {
          // Özel sipariş/özel gün: mesajda "teslim alan" siparişteki teslim kişisi olsun
          const teslimKisi = (isOzelKart && order.teslimKisisi && String(order.teslimKisisi).trim())
            ? String(order.teslimKisisi).trim()
            : getTeslimKisiFromKart(orgKart as any);
          await sendTeslimEdildiWhatsApp(order, orgKart, teslimKisi);
        } catch (_) {
          // WhatsApp hatası teslim işlemini başarısız sayma
        }
      }
      basarili++;
    } catch (err: any) {
      console.error('Teslim hatası:', order.id, err);
      basarisiz++;
    }
  }
  const toplam = teslimEdilecekler.length;
  const success = basarisiz === 0;
  const message = toplam === 0
    ? 'Teslim edilmemiş sipariş yok'
    : `${basarili} sipariş teslim edildi${basarisiz > 0 ? `, ${basarisiz} başarısız` : ''}`;
  return { success, message, basarili, basarisiz };
}

