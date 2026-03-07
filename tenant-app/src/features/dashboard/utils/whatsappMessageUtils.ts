/**
 * WhatsApp mesaj oluşturma utility fonksiyonları
 * React'e taşınmış versiyon - DOM okuma yerine objeler kullanır
 */

import type { OrganizasyonKart, Order } from '../types';
import { formatPhoneNumber, formatTL, cleanPhoneForDatabase, resolveProvinceName, buildOrganizasyonLocation, resolveRecipientSuffix } from '../../../shared/utils/formatUtils';
import { apiClient } from '@/lib/api';

/**
 * Metni temizle
 */
function temizle(metin: string | null | undefined): string {
  return (metin || '').replace(/\s+/g, ' ').trim();
}

/**
 * Tarih formatını düzelt: "02 Şubat" → "2 Şubat" (başındaki 0'ı kaldır)
 */
function formatTarih(tarihStr: string): string {
  if (!tarihStr) return '';
  // Tarihin başındaki 0'ı kaldır: "02 Şubat" → "2 Şubat"
  return tarihStr.replace(/^0(\d)(\s)/, '$1$2');
}

/**
 * Adres formatını düzelt: WhatsApp'ın link olarak algılamasını engelle
 */
function formatAdres(adresStr: string): string {
  if (!adresStr) return '';
  return adresStr
    .replace(/\.(No|no|NO):/g, '. $1:')
    .replace(/\.(No|no|NO)\s/g, '. $1 ')
    .replace(/(Cad|Sok|Mah|Apt|Blok|Kat)\./gi, '$1. ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Telefon numarasını formatla
 */
function formatTelefon(rawPhone: string | null | undefined): string | null {
  if (!rawPhone) return null;
  
  // cleanPhoneForDatabase ile temizle
  const cleaned = cleanPhoneForDatabase(rawPhone);
  if (!cleaned) return null;
  
  // formatPhoneNumber ile formatla
  return formatPhoneNumber(cleaned);
}

/**
 * Sipariş bilgilerini al (eski getSiparisBilgileri ile uyumlu)
 */
function getSiparisBilgileri(siparis: Order & { urun_yazi_dosyasi?: string; yazi_dosyasi?: string }): { urun: string; fiyat: string; yazi: string } {
  const urun = temizle(siparis.urun || '');
  
  // Fiyat hesapla
  const siparisTutari = siparis.tutar || 0;
  const ekstraUcret = siparis.ekstraUcret || 0;
  const ekstraUcretAciklama = temizle(siparis.ekstraUcretAciklama || '');
  
  let fiyat = '';
  if (ekstraUcret > 0 && ekstraUcretAciklama) {
    fiyat = `(${formatTL(siparisTutari)} + ${formatTL(ekstraUcret)} ${ekstraUcretAciklama})`;
  } else if (ekstraUcret > 0) {
    fiyat = `(${formatTL(siparisTutari)} + ${formatTL(ekstraUcret)})`;
  } else if (siparisTutari > 0) {
    fiyat = `(${formatTL(siparisTutari)})`;
  }
  
  // Yazı bilgisi – ürün yazı dosyası seçilmişse sabit metin (eski yapıyla aynı)
  const yaziDosyasiSecili = !!(siparis.urun_yazi_dosyasi || (siparis as any).yazi_dosyasi);
  let yaziFormatted = '';
  if (yaziDosyasiSecili) {
    yaziFormatted = '_Ürün yazısı dosyası seçilmiş_';
  } else {
    const yazi = temizle(siparis.urunYazisi || siparis.notes || siparis.musteriAdi || '');
    yaziFormatted = yazi ? `_${yazi}_` : '';
  }
  
  return { urun, fiyat, yazi: yaziFormatted };
}

/**
 * Organizasyon kartı için WhatsApp mesajı oluştur
 */
export async function createOrganizasyonWhatsAppMessage(
  kart: OrganizasyonKart,
  siparisler: Order[]
): Promise<string> {
  // Tarih
  let tarih = '';
  if (kart.teslim_tarih) {
    const date = new Date(kart.teslim_tarih);
    const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const day = date.getDate();
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    const dayName = dayNames[date.getDay()];
    tarih = formatTarih(`${day} ${month} ${year} ${dayName}`);
  }
  
  // Mahalle ve adres
  const salon = temizle(kart.mahalle || '');
  let orgAdres = temizle(kart.acik_adres || '');
  
  // İlçe/il bilgisi – karttan al (eski yapıyla uyumlu)
  const ilceIl = [kart.organizasyon_ilce, kart.organizasyon_il].filter(Boolean).join('/').trim() || '';
  
  // İlçe/il bilgisi varsa açık adres sonuna ekle
  if (orgAdres && ilceIl) {
    if (!orgAdres.endsWith(ilceIl) && !orgAdres.endsWith(`, ${ilceIl}`)) {
      orgAdres = `${orgAdres}, ${ilceIl}`;
    }
  } else if (ilceIl && !orgAdres) {
    orgAdres = ilceIl;
  }
  
  // Adres satırı
  let orgAdresSatiri = '';
  if (salon && orgAdres) {
    orgAdresSatiri = `*${formatAdres(salon)}*\n${formatAdres(orgAdres)}`;
  } else if (salon) {
    orgAdresSatiri = `*${formatAdres(salon)}*`;
  } else if (orgAdres) {
    orgAdresSatiri = formatAdres(orgAdres);
  } else if (ilceIl) {
    orgAdresSatiri = ilceIl;
  }
  
  // Müşteri bilgileri
  const musteri = temizle(kart.teslim_kisisi || '');
  const musteriTel = formatTelefon(kart.teslim_kisisi_telefon || '') || '';
  
  let musteriSatiri = '';
  if (musteri && musteriTel) {
    musteriSatiri = `*${musteri}*\n${musteriTel}\n\n`;
  } else if (musteri) {
    musteriSatiri = `*${musteri}*\n\n`;
  } else if (musteriTel) {
    musteriSatiri = `${musteriTel}\n\n`;
  }
  
  // Kart türü
  const kartTur = (kart.kart_tur_display || kart.kart_tur || 'Organizasyon').toLocaleUpperCase('tr-TR');
  
  // Saat
  const saat = temizle((kart.teslim_saat || '').replace('Saat', ''));
  
  // Sipariş listesi
  // API'den ekstra ücret bilgilerini çek (eğer siparişlerde yoksa)
  const siparislerWithDetails = await Promise.all(
    siparisler.map(async (siparis) => {
      // Eğer siparişte ekstra ücret bilgisi yoksa, API'den çek
      if (!siparis.ekstraUcret && !siparis.ekstraUcretAciklama && siparis.id) {
        try {
          const response = await apiClient.get(`/siparis-kartlar/${siparis.id}`);
          if (response.data?.success && response.data?.data) {
            const siparisData = response.data.data;
            return {
              ...siparis,
              ekstraUcret: siparisData.ekstra_ucret || siparis.ekstraUcret,
              ekstraUcretAciklama: siparisData.ekstra_ucret_aciklama || siparis.ekstraUcretAciklama,
            };
          }
        } catch (error) {
          // Hata durumunda orijinal siparişi döndür
        }
      }
      return siparis;
    })
  );
  
  const siparisListesi = siparislerWithDetails.map((siparis, i) => {
    const { urun, fiyat, yazi } = getSiparisBilgileri(siparis);
    const urunVeFiyat = fiyat ? `${urun} ${fiyat}` : urun;
    return `(${i + 1}) ${urunVeFiyat}  ✉  ${yazi}`;
  });
  
  // Mesajı oluştur
  return `🎉 *${kartTur}*\n${tarih} • Saat: ${saat}\n${orgAdresSatiri}\n${musteriSatiri}Siparişler *(Toplam ${siparisListesi.length} Sipariş)*\n━━━━━━━━━━━━━━━━━━━━━━━\n${siparisListesi.join('\n')}`;
}

/**
 * Müşteri sipariş şablonu mesajı: her sipariş, müşteri + sipariş satırı formatında tek metinde birleşik
 */
export async function createOrganizasyonTemplateMessage(
  kart: OrganizasyonKart,
  siparisler: Order[]
): Promise<string> {
  if (siparisler.length === 0) {
    return createOrganizasyonWhatsAppMessage(kart, siparisler);
  }
  const bloklar = await Promise.all(
    siparisler.map((siparis) => createOrderWhatsAppMessage(siparis, kart))
  );
  return bloklar.join('\n\n━━━━━━━━━━━━━━━━━━━━━━━\n\n');
}

/**
 * Tek sipariş için WhatsApp mesajı oluştur
 */
export async function createOrderWhatsAppMessage(
  order: Order,
  organizasyonKart?: OrganizasyonKart
): Promise<string> {
  // Sipariş bilgilerini al
  const { urun, fiyat, yazi } = getSiparisBilgileri(order);
  
  // Organizasyon siparişlerinde mesajda teslim kişisi (organizasyon sahibi) gösterilir; sipariş veren (müşteri) asla kullanılmaz
  let musteri = '';
  let musteriTel = '';
  if (organizasyonKart) {
    musteri = temizle(organizasyonKart.teslim_kisisi || order.teslimKisisi || '');
    musteriTel = formatTelefon(organizasyonKart.teslim_kisisi_telefon || order.teslimKisisiTelefon || '') || '';
  } else {
    musteri = temizle(order.musteriAdi || '');
    musteriTel = formatTelefon(order.telefon || '') || '';
  }

  let musteriSatiri = '';
  if (musteri && musteriTel) {
    musteriSatiri = `*${musteri}*\n${musteriTel}\n\n`;
  } else if (musteri) {
    musteriSatiri = `*${musteri}*\n\n`;
  } else if (musteriTel) {
    musteriSatiri = `${musteriTel}\n\n`;
  }
  
  // Organizasyon kartı bilgileri varsa ekle
  let kartBilgileri = '';
  if (organizasyonKart) {
    let tarih = '';
    if (organizasyonKart.teslim_tarih) {
      const date = new Date(organizasyonKart.teslim_tarih);
      const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
      const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
      const day = date.getDate();
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      const dayName = dayNames[date.getDay()];
      tarih = formatTarih(`${day} ${month} ${year} ${dayName}`);
    }
    
    const kartTur = (organizasyonKart.kart_tur_display || organizasyonKart.kart_tur || 'Organizasyon').toLocaleUpperCase('tr-TR');
    const saat = temizle((organizasyonKart.teslim_saat || '').replace('Saat', ''));
    
    const salon = temizle(organizasyonKart.mahalle || '');
    const orgAdres = temizle(organizasyonKart.acik_adres || '');
    
    let orgAdresSatiri = '';
    if (salon && orgAdres) {
      orgAdresSatiri = `*${formatAdres(salon)}*\n${formatAdres(orgAdres)}`;
    } else if (salon) {
      orgAdresSatiri = `*${formatAdres(salon)}*`;
    } else if (orgAdres) {
      orgAdresSatiri = formatAdres(orgAdres);
    }
    
    if (tarih || orgAdresSatiri) {
      kartBilgileri = `🎉 *${kartTur}*\n`;
      if (tarih) kartBilgileri += `${tarih}`;
      if (saat) kartBilgileri += ` • Saat: ${saat}`;
      if (kartBilgileri) kartBilgileri += '\n';
      if (orgAdresSatiri) kartBilgileri += `${orgAdresSatiri}\n`;
      kartBilgileri += '\n';
    }
  }
  
  // Ürün ve fiyat bilgisi
  const urunVeFiyat = fiyat ? `${urun} ${fiyat}` : urun;
  
  // Mesajı oluştur
  let mesaj = '';
  if (kartBilgileri) {
    mesaj = `${kartBilgileri}${musteriSatiri}*Sipariş:*\n${urunVeFiyat}`;
  } else {
    mesaj = `${musteriSatiri}*Sipariş:*\n${urunVeFiyat}`;
  }
  
  if (yazi) {
    mesaj += `\n✉ ${yazi}`;
  }
  
  return mesaj;
}

/**
 * Teslim edildi mesajı oluştur (eski sistemdeki createMessage fonksiyonu)
 * Sipariş türüne göre farklı mesajlar oluşturur
 */
export function createTeslimEdildiMessage(data: {
  siparisVeren?: string;
  /** Sipariş kartından: musteri_unvan – organizasyon mesajında "Sayın X" için kullanılır */
  musteriUnvani?: string;
  musteri_unvan?: string;
  kartTipi?: string;
  kart_tur?: string;
  isAracSusleme?: boolean;
  urunAdi?: string;
  aracPlaka?: string;
  aracMarkaModel?: string;
  teslim_kisisi?: string;
  gercekTeslimAlan?: string;
  teslimKisi?: string;
  siparis_teslim_kisisi_baskasi?: string;
  siparisTeslimKisisiBaskasi?: string;
  /** Organizasyon kartından: organizasyon_teslim_kisisi – düğün/nişan mesajında "X organizasyonuna teslim" için */
  organizasyon_teslim_kisisi?: string;
  organizasyon_il?: string;
  teslim_il?: string;
  il?: string;
  organizasyon_ilce?: string;
  teslim_ilce?: string;
  ilce?: string;
  mahalle?: string;
  teslim_mahalle?: string;
  org_mahalle?: string;
  organizasyon_mahalle?: string;
  acik_adres?: string;
  teslim_acik_adres?: string;
  organizasyon_acik_adres?: string;
  org_acik_adres?: string;
  adres?: string;
  organizasyon_teslimat_konumu?: string;
  teslimat_konumu?: string;
}): string {
  // Organizasyon siparişlerinde "Sayın" için musteri_unvan (sipariş kartı), yoksa sipariş veren
  const musteriUnvan = data.musteriUnvani || data.musteri_unvan || '';
  const musteriAdi = musteriUnvan ? musteriUnvan : (data.siparisVeren || 'Müşteri');
  
  // Özel sipariş veya özel gün olup olmadığını kontrol et
  const kartTipi = (data.kartTipi || data.kart_tur || '').toLowerCase();
  const isOzelSiparis = kartTipi === 'ozelsiparis' || kartTipi === 'özel sipariş' || data.kart_tur === 'Özel Sipariş';
  const isOzelGun = kartTipi === 'ozelgun' || kartTipi === 'özel gün' || data.kart_tur === 'Özel Gün';
  const isOzelType = isOzelSiparis || isOzelGun;
  
  // Teslim alan kişi - Özel sipariş/özel gün için önce siparis_teslim_kisisi_baskasi kontrol edilmeli
  let teslimAlanKisi = '';
  if (isOzelType) {
    // ÖNEMLİ: Özel sipariş/özel gün için ÖNCE siparis_teslim_kisisi_baskasi kontrol et
    const baskasiBilgisi = data.siparis_teslim_kisisi_baskasi || data.siparisTeslimKisisiBaskasi;
    if (baskasiBilgisi && String(baskasiBilgisi).trim()) {
      teslimAlanKisi = String(baskasiBilgisi).trim();
    } else {
      teslimAlanKisi = data.teslim_kisisi || 
                      data.gercekTeslimAlan || 
                      data.teslimKisi || 
                      '';
    }
  } else {
    // Normal organizasyonlar (düğün, nişan vb.): organizasyon_teslim_kisisi organizasyon kartından kullanılır
    teslimAlanKisi = data.organizasyon_teslim_kisisi ||
                    data.teslim_kisisi ||
                    data.gercekTeslimAlan ||
                    data.teslimKisi ||
                    '';
  }
  teslimAlanKisi = teslimAlanKisi ? String(teslimAlanKisi).trim() : '';
  if (!teslimAlanKisi) {
    teslimAlanKisi = '(Teslim Kişisi)';
  }
  
  // Konum bilgisi - özel sipariş ve özel gün için açık adres her zaman dahil edilmeli
  const locationString = buildOrganizasyonLocation(data, true);
  
  const recipientSuffix = resolveRecipientSuffix(data.kartTipi || data.kart_tur);
  
  if (data.isAracSusleme) {
    const aracPlaka = (data as any).aracPlaka || (data as any).arac_plaka || 'Plaka';
    const aracModel = (data as any).aracMarkaModel || (data as any).arac_markamodel || (data as any).arac_marka_model || 'Araç';
    return `Sayın ${musteriAdi}, *${aracPlaka} plakalı ${aracModel} aracınızın süslemesi tamamlanmıştır.* Aracınızı teslim alabilirsiniz. İyi günler dileriz.`;
  } else {
    let urunAdi = data.urunAdi || 'Sipariş';
    urunAdi = urunAdi.replace(/\d+[.,]\d+/g, '').trim();
    urunAdi = urunAdi.replace(/\s+/g, ' ').trim();
    if (!urunAdi || urunAdi === '') {
      urunAdi = 'Sipariş';
    }
    
    return `Sayın ${musteriAdi}, *${urunAdi}* siparişiniz *${locationString}*, *${teslimAlanKisi}* ${recipientSuffix} teslim edilmiştir. İyi günler dileriz.`;
  }
}

/**
 * Partner'e gönderilecek mesajı oluştur (eski sistemdeki createPartnerMessage fonksiyonu)
 */
export function createPartnerMessage(
  mesajData: {
    siparisVeren?: string;
    kartTipi?: string;
    kart_tur?: string;
    isAracSusleme?: boolean;
    urunAdi?: string;
    gercekTeslimAlan?: string;
    teslim_kisisi?: string;
    teslimKisi?: string;
    /** Organizasyon kartından: organizasyon_teslim_kisisi – partner mesajında "X organizasyonuna teslim" için */
    organizasyon_teslim_kisisi?: string;
    mahalle?: string;
    teslim_mahalle?: string;
    organizasyon_mahalle?: string;
    acik_adres?: string;
    teslim_acik_adres?: string;
    organizasyon_acik_adres?: string;
    organizasyon_il?: string;
    teslim_il?: string;
    organizasyon_ilce?: string;
    teslim_ilce?: string;
  },
  siparis: any,
  partnerFirmaAdi: string
): string {
  // Müşteri kısmı: sipariş kartından musteri_unvan (unvan) kullanılır
  const musteriAdi = siparis?.musteri_unvan ||
                    mesajData.siparisVeren ||
                    siparis?.musteri_isim_soyisim ||
                    'Müşteri';

  // Partner mesajında "X organizasyonuna teslim" = organizasyon kartından organizasyon_teslim_kisisi
  let organizasyonTeslimKisisi = mesajData.organizasyon_teslim_kisisi || '';
  organizasyonTeslimKisisi = organizasyonTeslimKisisi ? String(organizasyonTeslimKisisi).trim() : '';
  if (!organizasyonTeslimKisisi) {
    const teslimAlanKisi = mesajData.gercekTeslimAlan ||
                          siparis?.teslim_kisisi ||
                          mesajData.teslim_kisisi ||
                          mesajData.teslimKisi ||
                          '';
    organizasyonTeslimKisisi = teslimAlanKisi ? String(teslimAlanKisi).trim() : '(Teslim Kişisi)';
  }
  
  // Mahalle bilgisi
  const mahalle = mesajData.mahalle || 
                 siparis?.teslim_mahalle || 
                 mesajData.teslim_mahalle || 
                 mesajData.organizasyon_mahalle || 
                 'Belirtilmemiş';
  
  // Ürün adını temizle
  let urunAdi = mesajData.urunAdi || siparis?.siparis_urun || 'Sipariş';
  urunAdi = urunAdi.replace(/\d+[.,]\d+/g, '').trim();
  urunAdi = urunAdi.replace(/\s+/g, ' ').trim();
  if (!urunAdi || urunAdi === '') {
    urunAdi = 'Sipariş';
  }
  
  const kartTipi = mesajData.kartTipi || mesajData.kart_tur || siparis?.kartTipi;
  const isAracSusleme = kartTipi === 'aracsusleme' || mesajData.isAracSusleme;
  
  // Araç süsleme için özel mesaj formatı
  if (isAracSusleme) {
    return `Merhaba ${partnerFirmaAdi}, \n\n*${musteriAdi}* müşterinize ait *${urunAdi}* süslemesi tamamlanmıştır.\n\nİş birliğiniz için teşekkür eder, iyi günler dileriz.`;
  }
  
  // Normal siparişler için mesaj formatı
  const recipientSuffix = resolveRecipientSuffix(kartTipi);
  const partnerLocation = buildOrganizasyonLocation(mesajData);
  // Eğer partnerLocation "Belirtilmemiş" ise mesajdan çıkar
  const locationPart = partnerLocation && partnerLocation !== 'Belirtilmemiş' ? `*${partnerLocation}*, ` : '';
  return `Merhaba ${partnerFirmaAdi}, \n\n*${musteriAdi}*, müşterinize ait *${urunAdi}* siparişi ${locationPart}*${organizasyonTeslimKisisi}* ${recipientSuffix} teslim edilmiştir.\n\nİş birliğiniz için teşekkür eder, iyi günler dileriz.`;
}

/**
 * Organizasyon kartından tek bir değer okur; API bazen { data: row } bazen düz row döner.
 * Backend: GET /organizasyon-kartlar/:id → organizasyon_sahibi, organizasyon_il, adres vb.
 */
function getKartVal<T = string>(kart: OrganizasyonKart & { data?: Record<string, unknown> }, ...keys: string[]): T | undefined {
  const row = kart && (kart as any).data ? (kart as any).data : kart;
  if (!row || typeof row !== 'object') return undefined;
  for (const key of keys) {
    const v = (row as any)[key];
    if (v != null && String(v).trim() !== '') return v as T;
  }
  return undefined;
}

/** Index + detay sayfası aynı kaynak: karttan teslim alan kişi adı (organizasyon_sahibi / teslim_kisisi). */
export function getTeslimKisiFromKart(orgKart: OrganizasyonKart & { data?: Record<string, unknown> }): string {
  const name = getKartVal<string>(orgKart, 'teslim_kisisi', 'organizasyon_sahibi', 'organizasyon_teslim_kisisi');
  return (name && name.trim() !== '') ? name.trim() : 'Teslim alan';
}

/**
 * Teslim edildi mesajı için ortak veri objesi (index + sipariş detay aynı veriyi kullansın).
 * orgKart: API cevabı (düz row veya { data: row }), backend alan adları: organizasyon_sahibi, organizasyon_il, adres vb.
 */
export function buildTeslimEdildiMesajData(
  order: Order,
  orgKart: OrganizasyonKart & { data?: Record<string, unknown> },
  teslimKisiOverride?: string,
  siparisTeslimKisisiBaskasi?: string
): Parameters<typeof createTeslimEdildiMessage>[0] {
  const kartTur = getKartVal(orgKart, 'kart_tur', 'kart_turu', 'organizasyon_kart_tur') || '';
  const isOzelType = kartTur === 'ozelgun' || kartTur === 'ozelsiparis';

  const orgIl = getKartVal(orgKart, 'organizasyon_il', 'il', 'teslim_il');
  const orgIlce = getKartVal(orgKart, 'organizasyon_ilce', 'ilce', 'teslim_ilce');
  const orgMahalle = getKartVal(orgKart, 'mahalle', 'organizasyon_mahalle', 'teslim_mahalle');
  const orgAcikAdres = getKartVal(orgKart, 'acik_adres', 'organizasyon_acik_adres', 'adres');
  const orgKonum = getKartVal(orgKart, 'organizasyon_teslimat_konumu', 'teslimat_konumu');
  const orgTeslimKisi = getKartVal(orgKart, 'teslim_kisisi', 'organizasyon_sahibi', 'organizasyon_teslim_kisisi');
  const teslimKisi = (teslimKisiOverride && teslimKisiOverride.trim() !== '' && teslimKisiOverride !== 'Teslim alan')
    ? teslimKisiOverride.trim()
    : (orgTeslimKisi || teslimKisiOverride || 'Teslim alan');

  const teslimIl = isOzelType ? (order.teslimIl || undefined) : (orgIl || order.teslimIl || undefined);
  const teslimIlce = isOzelType ? (order.teslimIlce || undefined) : (orgIlce || order.teslimIlce || undefined);
  const teslimMahalle = isOzelType ? (order.mahalle || undefined) : (orgMahalle || order.mahalle || undefined);
  const teslimAcikAdres = isOzelType ? (order.acikAdres || undefined) : (orgAcikAdres || order.acikAdres || undefined);

  return {
    siparisVeren: order.musteriAdi,
    musteriUnvani: order.musteriUnvani,
    musteri_unvan: order.musteriUnvani,
    kartTipi: kartTur,
    kart_tur: kartTur,
    isAracSusleme: kartTur === 'aracsusleme',
    urunAdi: order.urun,
    aracPlaka: order.aracPlaka,
    aracMarkaModel: order.aracMarkaModel,
    teslim_kisisi: teslimKisi,
    organizasyon_teslim_kisisi: orgTeslimKisi || teslimKisi,
    siparis_teslim_kisisi_baskasi: siparisTeslimKisisiBaskasi,
    siparisTeslimKisisiBaskasi: siparisTeslimKisisiBaskasi,
    organizasyon_il: orgIl || teslimIl,
    teslim_il: teslimIl || orgIl,
    organizasyon_ilce: orgIlce || teslimIlce,
    teslim_ilce: teslimIlce || orgIlce,
    mahalle: teslimMahalle || orgMahalle,
    teslim_mahalle: teslimMahalle || orgMahalle,
    organizasyon_mahalle: orgMahalle || teslimMahalle,
    acik_adres: teslimAcikAdres || orgAcikAdres,
    teslim_acik_adres: teslimAcikAdres || orgAcikAdres,
    organizasyon_acik_adres: orgAcikAdres || teslimAcikAdres,
    adres: orgAcikAdres || teslimAcikAdres,
    organizasyon_teslimat_konumu: orgKonum || undefined,
    gercekTeslimAlan: (siparisTeslimKisisiBaskasi && siparisTeslimKisisiBaskasi.trim()) ? siparisTeslimKisisiBaskasi.trim() : teslimKisi,
    teslimKisi,
  };
}

/**
 * Tek sipariş için "teslim edildi" WhatsApp mesajını gönderir (tümünü teslim + tekil teslim aynı ortak veri).
 * siparisTeslimKisisiBaskasi: İmza modalında "başkası aldı" seçilirse mesajda teslim alan olarak kullanılır.
 * fotoPath: Varsa /whatsapp/send-media ile mesaj + fotoğraf birlikte gönderilir (organizasyon teslim fotoğrafı).
 */
export async function sendTeslimEdildiWhatsApp(
  order: Order,
  orgKart: OrganizasyonKart,
  teslimKisi: string,
  siparisTeslimKisisiBaskasi?: string,
  fotoPath?: string
): Promise<void> {
  const { getApiBaseUrl } = await import('../../../lib/runtime');
  const mesajData = buildTeslimEdildiMesajData(order, orgKart as OrganizasyonKart & { data?: Record<string, unknown> }, teslimKisi, siparisTeslimKisisiBaskasi);
  const mesaj = createTeslimEdildiMessage(mesajData);
  const telefon = order.telefon || '';
  if (!telefon) return;
  const formattedPhone = telefon.replace(/\D/g, '');
  const apiBase = getApiBaseUrl();
  const token = localStorage.getItem('floovon_token') || localStorage.getItem('token');
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  if (fotoPath && fotoPath.trim()) {
    const response = await fetch(`${apiBase}/whatsapp/send-media`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        phone: formattedPhone,
        message: mesaj,
        mediaPath: fotoPath.trim(),
      }),
    });
    const result = await response.json();
    if (!response.ok || !result?.success) {
      if (response.status === 503) {
        console.warn('WhatsApp servisi hazır değil (503), teslim işlemi yine de başarılı – mesaj/foto atlanıyor.');
        return;
      }
      throw new Error(result?.message || 'WhatsApp ile fotoğraf gönderilemedi');
    }
    return;
  }

  const response = await fetch(`${apiBase}/whatsapp/send`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ phone: formattedPhone, message: mesaj }),
  });
  const result = await response.json();
  if (!response.ok || !result?.success) {
    if (response.status === 503) {
      console.warn('WhatsApp servisi hazır değil (503), teslim işlemi yine de başarılı – mesaj atlanıyor.');
      return;
    }
    throw new Error(result?.message || 'WhatsApp gönderilemedi');
  }
}

