/**
 * Dashboard Types
 */

export type OrderStatus = 'bekliyor' | 'teslim' | 'iptal';

export type KartTur = 'organizasyon' | 'aracsusleme' | 'ozelgun' | 'ozelsiparis' | 'ciceksepeti';

export interface Order {
  id: string | number;
  organizasyon_id?: number;
  musteriAdi: string;
  musteriUnvani?: string; // Müşteri unvanı (bağlantılı siparişler için)
  tarih: string;
  durum: OrderStatus;
  teslimSaati: string;
  not?: string;
  notes?: string; // Yazi-not için ayrı alan
  telefon?: string;
  mahalle?: string;
  acikAdres?: string;
  urun?: string;
  urunId?: number | string; // Ürün görseli yükleme için gerekli
  tutar?: number;
  odemeYontemi?: string;
  // Araç süsleme için
  aracMarkaModel?: string;
  aracRenk?: string;
  aracPlaka?: string;
  aracRandevuSaat?: string;
  // Ek alanlar
  kartSira?: number;
  partnerFirmaAdi?: string;
  partnerSiparisTuru?: 'verilen' | 'alinan';
  /** Partner iletişim telefonu (siparişte kayıtlı; partner sayfası bozukken WhatsApp için kullanılır) */
  partnerFirmaTelefon?: string;
  teslimKisisi?: string;
  teslimKisisiTelefon?: string;
  urunGorsel?: string;
  urunYazisi?: string;
  updatedAt?: string;
  updatedBy?: string;
  // Ödeme bilgileri
  ekstraUcret?: number;
  ekstraUcretAciklama?: string;
  toplamTutar?: number;
  // Teslim adresi detayları
  teslimIlce?: string;
  teslimIl?: string;
  /** Müşteri ürün yazı dosyasından seçilen dosya adı (siparişte kayıtlı) */
  secilenUrunYaziDosyasi?: string;
  /** Arşivlendi mi (backend: 0/1 veya boolean) */
  arsivli?: number | boolean;
  /** Arşiv sebebi (örn. teslim-edildi) */
  arsiv_sebep?: string;
  [key: string]: unknown;
}

export interface OrganizasyonKart {
  id: number;
  kart_tur: KartTur;
  kart_tur_display?: string; // Veritabanından gelen orijinal değer (örn: "Düğün", "Araç Süsleme")
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
  // İlçe/il bilgileri
  organizasyon_ilce?: string;
  organizasyon_il?: string;
  /** Eski/alternatif alan adları (backend uyumluluk) */
  teslim_ilce?: string;
  teslim_il?: string;
  organizasyon_davetiye_gorsel?: string;
  /** Teslimat konumu seçilmişse kartta konum alanında bu gösterilir; açık adresin önüne mahalle eklenir */
  organizasyon_teslimat_konumu?: string;
  // İç siparişler (lazy load edilebilir)
  siparisler?: Order[];
  [key: string]: unknown;
}

/**
 * Dashboard kolonları için tip
 */
export interface DashboardColumn {
  id: string;
  title: string;
  kartTur: KartTur[];
  grouped: boolean; // Mahalle bazlı gruplu mu?
}

