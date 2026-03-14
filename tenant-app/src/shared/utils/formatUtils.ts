/**
 * Format utility functions
 * Eski JS fonksiyonlarının React versiyonları
 */

import { getUploadUrl } from './urlUtils';

/**
 * Telefon numarasını formatla
 * phone-formatter.js mantığına göre: +90 (5XX) XXX XX XX
 */
export function formatPhoneNumber(phone: string | undefined | null): string {
  if (!phone) return '+90 (';
  
  let digits = phone.toString().replace(/\D/g, '');
  // +90 sabit; baştaki 90'ı çıkar ki (909) gibi tekrarlanmasın
  if (digits.startsWith('90')) {
    digits = digits.substring(2);
  }
  
  if (digits.length === 0) return '+90 (';
  
  // 11 haneli ve 0 ile başlıyorsa (örn: 05051563663), 0'ı kaldır
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.substring(1);
  }
  
  if (digits.length > 10) {
    digits = digits.substring(0, 10);
  }
  
  if (digits.length === 0) return '+90 (';
  
  if (digits.length >= 10) {
    return `+90 (${digits.substring(0, 3)}) ${digits.substring(3, 6)} ${digits.substring(6, 8)} ${digits.substring(8, 10)}`;
  }
  
  // Eksik rakamlar: kısmi format
  let formatted = '+90 (';
  formatted += digits.substring(0, Math.min(3, digits.length));
  if (digits.length >= 3) {
    formatted += ') ' + digits.substring(3, Math.min(6, digits.length));
    if (digits.length >= 6) {
      formatted += ' ' + digits.substring(6, Math.min(8, digits.length));
      if (digits.length >= 8) {
        formatted += ' ' + digits.substring(8, Math.min(10, digits.length));
      }
    }
  }
  return formatted;
}

/**
 * Telefon numarasını veritabanı için temizle
 */
export function cleanPhoneForDatabase(phone: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

/**
 * Input için sadece rakam kısmı: "5XX XXX XX XX" (prefix yok).
 * API/veritabanı değerinden veya "+90 (506)..." formatından parse eder.
 */
export function formatPhoneDisplayPart(phone: string | undefined | null): string {
  if (!phone) return '';
  let digits = phone.toString().replace(/\D/g, '');
  if (digits.startsWith('90')) digits = digits.substring(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.substring(1);
  digits = digits.substring(0, 10);
  if (digits.length === 0) return '';
  const p1 = digits.substring(0, 3);
  const p2 = digits.substring(3, 6);
  const p3 = digits.substring(6, 8);
  const p4 = digits.substring(8, 10);
  return [p1, p2, p3, p4].filter(Boolean).join(' ').trim();
}

/**
 * Türk Lirası yazım formatı: her zaman "1.250,60 TL" şeklinde
 * (binlik ayırıcı nokta, ondalık virgül, sonunda boşluk + TL)
 */
export function formatTL(amount: number | string | undefined | null): string {
  if (amount === null || amount === undefined) return '0,00 TL';
  const num = typeof amount === 'string' ? parseFloat(String(amount).replace(',', '.')) : amount;
  if (isNaN(num)) return '0,00 TL';
  const fixed = num.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${withDots},${decPart} TL`;
}

/**
 * Input value için sadece sayı kısmı (TL yok): "1.250,60"
 * Input'ta placeholder "0,00", sabit " TL" ayrı sonek olarak gösterilir.
 */
export function formatTLInputValue(amount: number | string | undefined | null): string {
  return formatTL(amount).replace(/\s*TL\s*$/i, '').trim();
}

/**
 * TL input'ta gösterilecek value: 0/boş ise "" (placeholder "0,00 TL" görünsün), değilse "1.250,60 TL"
 */
export function formatTLDisplayValue(amount: number | string | undefined | null): string {
  const num = amount === null || amount === undefined ? 0 : (typeof amount === 'number' ? amount : parseTL(amount));
  return num === 0 ? '' : formatTL(num);
}

/** Ödeme yöntemi: DB değerlerini (nakit, havale_eft, pos, cari) arayüz formatına çevirir. HAVALE/EFT, NAKİT, POS, CARİ HESAP */
export function formatOdemeYontemiDisplay(val: string | undefined | null): string {
  if (val == null || String(val).trim() === '') return '—';
  const v = String(val).toLowerCase().trim();
  if (v === 'havale_eft' || v === 'havale-eft' || v === 'havale/eft' || v === 'havale eft' || v === 'havale' || v.includes('havale') || v.includes('eft')) return 'HAVALE/EFT';
  if (v === 'nakit') return 'NAKİT';
  if (v === 'pos' || v.includes('pos') || v.includes('kredi') || v.includes('kart')) return 'POS';
  if (v === 'cari' || v.includes('cari') || v.includes('hesap')) return 'CARİ HESAP';
  return val.trim();
}

/** Ödeme yöntemini veritabanı formatına normalize eder: nakit | havale_eft | pos | cari */
export function normalizeOdemeYontemiForDb(val: string | undefined | null): 'nakit' | 'havale_eft' | 'pos' | 'cari' {
  if (val == null || String(val).trim() === '') return 'nakit';
  const v = String(val).toLowerCase().trim();
  if (v.includes('cari') || v.includes('hesap')) return 'cari';
  if (v.includes('havale') || v.includes('eft')) return 'havale_eft';
  if (v.includes('pos') || v.includes('kredi') || v.includes('kart')) return 'pos';
  return 'nakit';
}

/**
 * Tutar inputunda sadece rakam ve tek virgül (ondalık) kabul eder; anında "1.250,60" formatında gösterir.
 * Kullanım: onChange içinde setTutar(formatTutarInputLive(e.target.value))
 */
export function formatTutarInputLive(value: string): string {
  if (value === '') return '';
  const s = String(value).trim();
  const hasComma = s.includes(',');
  const parts = s.split(',');
  const intRaw = (parts[0] ?? '').replace(/\D/g, '');
  const decRaw = (parts.length > 1 ? parts.slice(1).join('') : '').replace(/\D/g, '').slice(0, 2);
  if (!hasComma) {
    if (intRaw === '') return '';
    return intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  const intPart = intRaw === '' ? '0' : intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decRaw === '' ? `${intPart},` : `${intPart},${decRaw}`;
}

/**
 * Tutar inputu onKeyDown: sadece rakam (0-9) ve tek virgül kabul eder; diğer tuşları engeller.
 * Kullanım: <input onKeyDown={(e) => formatTutarInputKeyDown(e, value)} ... />
 */
export function formatTutarInputKeyDown(
  e: { key: string; preventDefault: () => void; ctrlKey: boolean; metaKey: boolean },
  currentValue: string
): void {
  const key = e.key;
  if (key === 'Backspace' || key === 'Delete' || key === 'Tab' || key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Home' || key === 'End') return;
  if (e.ctrlKey || e.metaKey) {
    if (key === 'a' || key === 'c' || key === 'v' || key === 'x') return;
  }
  if (key.length === 1) {
    if (/\d/.test(key)) return;
    if (key === ',' && !currentValue.includes(',')) return;
  }
  e.preventDefault();
}

/**
 * "Son Etkinlik" / tablo tarih-saati: "04.03.2026 00:39" (saniye yok)
 * Girdi: "2026-03-04 00:39:42" (YYYY-MM-DD HH:mm:ss)
 * Çıktı: "04.03.2026 00:39" (DD.MM.YYYY HH:mm)
 */
export function formatSonEtkinlikDatetime(raw: string | undefined | null): string {
  if (!raw) return '';
  const s = String(raw).trim();
  if (!s) return '';

  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (match) {
    const [, y, m, d, h, min] = match;
    return `${d}.${m}.${y}${h != null && min != null ? ` ${h}:${min}` : ''}`;
  }

  const parsed = new Date(s.replace(' ', 'T'));
  if (!isNaN(parsed.getTime())) {
    const dd = String(parsed.getDate()).padStart(2, '0');
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const yyyy = parsed.getFullYear();
    const hh = String(parsed.getHours()).padStart(2, '0');
    const min = String(parsed.getMinutes()).padStart(2, '0');
    return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
  }

  return s;
}

/**
 * TL formatındaki string'i sayıya çevir ("1.234,56 TL" veya "1234,56" -> 1234.56)
 */
export function parseTL(value: string | number | undefined | null): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  let s = String(value).trim().replace(/\s*TL\s*/gi, '').replace(/[^\d,.-]/g, '');
  if (!s) return 0;
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  } else if (s.includes('.')) {
    const lastDot = s.lastIndexOf('.');
    const after = s.slice(lastDot + 1);
    if (after.length <= 2 && lastDot > 0) {
      const parts = s.split('.');
      s = (parts.length > 2 ? parts.slice(0, -1).join('') : parts[0]) + '.' + (parts[parts.length - 1] ?? '');
    } else {
      s = s.replace(/\./g, '');
    }
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * Upload URL'ini düzelt
 */
export function fixUploadUrl(path: string | undefined | null, baseUrl?: string): string {
  if (!path) return '';
  
  // Zaten tam URL ise direkt dön
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // getUploadUrl kullan - otomatik olarak doğru backend base URL'i ekler
  // Base URL parametresi varsa, onu kullan (eski davranış için uyumluluk)
  if (baseUrl) {
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    if (!cleanPath.startsWith('uploads/')) {
      return `${baseUrl}/uploads/${cleanPath}`;
    }
    return `${baseUrl}/${cleanPath}`;
  }
  
  // getUploadUrl kullan
  return getUploadUrl(path);
}

/**
 * Plaka kodu - Şehir adı eşleştirme tablosu
 */
const plateCodeToCityMap: { [key: string]: string } = {
  '01': 'Adana', '02': 'Adıyaman', '03': 'Afyonkarahisar', '04': 'Ağrı', '05': 'Amasya',
  '06': 'Ankara', '07': 'Antalya', '08': 'Artvin', '09': 'Aydın', '10': 'Balıkesir',
  '11': 'Bilecik', '12': 'Bingöl', '13': 'Bitlis', '14': 'Bolu', '15': 'Burdur',
  '16': 'Bursa', '17': 'Çanakkale', '18': 'Çankırı', '19': 'Çorum', '20': 'Denizli',
  '21': 'Diyarbakır', '22': 'Edirne', '23': 'Elazığ', '24': 'Erzincan', '25': 'Erzurum',
  '26': 'Eskişehir', '27': 'Gaziantep', '28': 'Giresun', '29': 'Gümüşhane', '30': 'Hakkari',
  '31': 'Hatay', '32': 'Isparta', '33': 'Mersin', '34': 'İstanbul', '35': 'İzmir',
  '36': 'Kars', '37': 'Kastamonu', '38': 'Kayseri', '39': 'Kırklareli', '40': 'Kırşehir',
  '41': 'Kocaeli', '42': 'Konya', '43': 'Kütahya', '44': 'Malatya', '45': 'Manisa',
  '46': 'Kahramanmaraş', '47': 'Mardin', '48': 'Muğla', '49': 'Muş', '50': 'Nevşehir',
  '51': 'Niğde', '52': 'Ordu', '53': 'Rize', '54': 'Sakarya', '55': 'Samsun',
  '56': 'Siirt', '57': 'Sinop', '58': 'Sivas', '59': 'Tekirdağ', '60': 'Tokat',
  '61': 'Trabzon', '62': 'Tunceli', '63': 'Şanlıurfa', '64': 'Uşak', '65': 'Van',
  '66': 'Yozgat', '67': 'Zonguldak', '68': 'Aksaray', '69': 'Bayburt', '70': 'Karaman',
  '71': 'Kırıkkale', '72': 'Batman', '73': 'Şırnak', '74': 'Bartın', '75': 'Ardahan',
  '76': 'Iğdır', '77': 'Yalova', '78': 'Karabük', '79': 'Kilis', '80': 'Osmaniye', '81': 'Düzce'
};

/**
 * Kelimelerin ilk harfini büyük yapar
 */
export function capitalizeWords(value: string = ''): string {
  if (!value) return '';
  return value
    .split(' ')
    .map(word => word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1).toLocaleLowerCase('tr-TR'))
    .filter(Boolean)
    .join(' ');
}

/**
 * Parantez içindeki metnin her kelimesinin ilk harfini büyük yapar.
 * Örn: "Aktaş Mah (pınarbaşı Beldesi)" → "Aktaş Mah (Pınarbaşı Beldesi)"
 */
export function capitalizeParentheticalContent(value: string = ''): string {
  if (!value) return '';
  return value.replace(/\(([^)]*)\)/g, (_, inner) => '(' + capitalizeWords(inner.trim()) + ')');
}

/**
 * Adres/konum metnini UI'da göstermek için formatlar (kelime başları + parantez içi büyük harf).
 */
export function formatAddressDisplay(value: string | undefined | null): string {
  if (!value) return '';
  return capitalizeParentheticalContent(capitalizeWords(String(value).trim()));
}

/**
 * Konum bileşenini temizler (gereksiz / ve sayıları kaldırır)
 */
function sanitizeLocationComponent(value: string = ''): string {
  if (!value) return '';
  const trimmed = value.toString().trim();
  if (trimmed.indexOf('/') === -1) return trimmed;
  const segments = trimmed.split('/');
  const lastSegment = segments[segments.length - 1].trim();
  if (/^\d+$/.test(lastSegment) && segments.length > 1) {
    return segments.slice(0, -1).map(seg => seg.trim()).filter(Boolean).join('/');
  }
  return trimmed;
}

/**
 * İl adını çözümler (plaka kodundan veya metinden)
 */
export function resolveProvinceName(value: string = ''): string {
  const sanitized = sanitizeLocationComponent(value);
  if (!sanitized) return '';
  const digitsOnly = sanitized.replace(/\D/g, '');
  if (digitsOnly && /^\d+$/.test(sanitized)) {
    const key = sanitized.padStart(2, '0');
    return plateCodeToCityMap[key] || plateCodeToCityMap[digitsOnly] || sanitized;
  }
  return capitalizeWords(sanitized);
}

/**
 * İlçe ve il bilgisini formatlı şekilde birleştirir
 * @param ilce - İlçe adı
 * @param il - İl adı
 * @returns "İlçe/İl" formatında metin
 */
export function formatIlceIlDisplay(ilce: string | undefined | null, il: string | undefined | null): string {
  const parts = [ilce, il]
    .map(part => (part || '').toString().trim())
    .filter(Boolean)
    .map(part => {
      // Plaka kodu ise resolveProvinceName ile çevir
      const resolved = resolveProvinceName(part);
      return resolved.charAt(0).toLocaleUpperCase('tr-TR') + resolved.slice(1).toLocaleLowerCase('tr-TR');
    });
  return parts.length ? parts.join('/') : '';
}

/**
 * Açık adresin sonuna ilçe/il bilgisini ekler (eğer sonunda yoksa).
 * Sadece adres zaten ", İlçe/İl" ile bitiyorsa ekleme yapılmaz.
 */
export function appendIlceIlToAddress(acikAdres: string | undefined | null, ilce: string | undefined | null, il: string | undefined | null): string {
  if (!acikAdres) {
    return formatIlceIlDisplay(ilce, il);
  }

  const ilceIlText = formatIlceIlDisplay(ilce, il);
  if (!ilceIlText) {
    return acikAdres;
  }

  const adresTrim = acikAdres.trim();
  const suffix = `, ${ilceIlText}`;
  const suffixAlt = ` ${ilceIlText}`;
  if (adresTrim.endsWith(suffix) || adresTrim.endsWith(suffixAlt) || adresTrim.endsWith(ilceIlText)) {
    return acikAdres;
  }

  return `${adresTrim}, ${ilceIlText}`;
}


/**
 * Kart tipine göre alıcı eki belirler
 */
export function resolveRecipientSuffix(kartTipi: string | undefined | null): string {
  const normalized = (kartTipi || '').toString().toLowerCase();
  if (!normalized || normalized.includes('organizasyon')) {
    return 'organizasyonuna';
  }
  return 'kişisine';
}

/**
 * Organizasyon konum bilgisini birleştirir
 */
export function buildOrganizasyonLocation(
  data: {
    organizasyon_il?: string | null;
    teslim_il?: string | null;
    il?: string | null;
    organizasyon_ilce?: string | null;
    teslim_ilce?: string | null;
    ilce?: string | null;
    mahalle?: string | null;
    teslim_mahalle?: string | null;
    org_mahalle?: string | null;
    organizasyon_mahalle?: string | null;
    acik_adres?: string | null;
    teslim_acik_adres?: string | null;
    organizasyon_acik_adres?: string | null;
    org_acik_adres?: string | null;
    adres?: string | null;
    organizasyon_teslimat_konumu?: string | null;
    teslimat_konumu?: string | null;
  },
  includeAddress: boolean = true
): string {
  const il = resolveProvinceName(data.organizasyon_il || data.teslim_il || data.il || '');
  const ilce = resolveProvinceName(data.organizasyon_ilce || data.teslim_ilce || data.ilce || '');
  const ilceIl = formatIlceIlDisplay(data.organizasyon_ilce || data.teslim_ilce || data.ilce, data.organizasyon_il || data.teslim_il || data.il);
  const mahalleRaw = (data.mahalle || data.teslim_mahalle || data.org_mahalle || data.organizasyon_mahalle || '').trim();
  const mahalle = capitalizeParentheticalContent(capitalizeWords(mahalleRaw));
  const acikAdres = (data.acik_adres || data.teslim_acik_adres || data.organizasyon_acik_adres || data.org_acik_adres || data.adres || '').trim();
  const teslimatKonumu = capitalizeParentheticalContent(capitalizeWords((data.organizasyon_teslimat_konumu || data.teslimat_konumu || '').trim()));
  const parts: string[] = [];
  
  // İl/İlçe bilgisini her zaman ekle
  if (ilceIl) {
    parts.push(ilceIl);
  }
  
  // Teslimat konumu varsa sadece il/ilçe + teslimat konumu göster
  if (teslimatKonumu) {
    parts.push(teslimatKonumu);
    return parts.filter(Boolean).length ? parts.join(', ') : 'Belirtilmemiş';
  }
  
  // Teslimat konumu yoksa mahalle ve açık adres bilgilerini ekle
  if (mahalle) {
    parts.push(mahalle);
  }
  
  if (includeAddress && acikAdres) {
    parts.push(acikAdres);
  }
  
  return parts.filter(Boolean).length ? parts.join(', ') : 'Belirtilmemiş';
}

/**
 * Yol tarifi ve Google Maps query için adres metni.
 * Teslimat konumu varsa: "Teslimat Konumu, İlçe" (örn. Sırçalı Düğün Salonu, Çumra)
 * Yoksa: "Mahalle, Açık adres, İlçe" (örn. Meydan Mah. Menekşe Sok. No:15 Çumra)
 */
export function buildAddressForMapsQuery(data: Record<string, unknown> | null | undefined): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const get = (k: string) => (data[k] ?? (data as any)[k]) as string | undefined;
  const trim = (s: string) => (s || '').trim();
  const teslimatKonumu = trim(get('organizasyon_teslimat_konumu') || get('teslimat_konumu') || '');
  const ilce = trim(get('teslim_ilce') || get('organizasyon_ilce') || get('ilce') || '');
  const mahalle = trim(get('teslim_mahalle') || get('org_mahalle') || get('mahalle') || '');
  const acikAdres = trim(get('acik_adres') || get('acikAdres') || get('org_acik_adres') || get('teslim_acik_adres') || '');
  if (teslimatKonumu) {
    return ilce ? `${teslimatKonumu}, ${ilce}` : teslimatKonumu;
  }
  const parts = [mahalle, acikAdres, ilce].filter(Boolean);
  return parts.length ? parts.join(' ') : undefined;
}


