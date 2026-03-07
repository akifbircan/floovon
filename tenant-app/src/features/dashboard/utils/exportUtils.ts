/**
 * Export utility functions
 * Excel ve Print export işlemleri için React utility fonksiyonları
 * Not: Tipler bu dosyada tanımlı (Vite 500 hatasını önlemek için ../types import edilmez)
 */
interface OrganizasyonKart {
  id: number;
  kart_tur?: string;
  kart_tur_display?: string;
  alt_tur?: string;
  mahalle?: string;
  acik_adres?: string;
  teslim_kisisi?: string;
  teslim_kisisi_telefon?: string;
  teslim_tarih?: string;
  teslim_saat?: string;
  organizasyon_ilce?: string;
  organizasyon_il?: string;
  organizasyon_teslimat_konumu?: string;
  [key: string]: unknown;
}
interface Order {
  id?: string | number;
  musteriAdi?: string;
  teslimSaati?: string;
  teslimKisisi?: string;
  teslimKisisiTelefon?: string;
  urun?: string;
  urunYazisi?: string;
  notes?: string;
  acikAdres?: string;
  teslimIlce?: string;
  teslimIl?: string;
  mahalle?: string;
  [key: string]: unknown;
}

/**
 * Hafta günlerini hesapla (moment.js yerine native Date kullan)
 * useWeekDates.ts'deki calculateWeekDates mantığını kullan
 */
export function getWeekDays(weekString: string): string[] {
  if (!weekString || !weekString.includes('-W')) return [];
  
  // Week string formatı: "2026-W07"
  const [year, week] = weekString.split('-W').map(Number);
  if (!year || !week) return [];
  
  // ISO 8601: Yılın ilk haftası, 4 Ocak'ı içeren haftadır
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay(); // 0 = Pazar, 1 = Pazartesi, ..., 6 = Cumartesi
  
  // 4 Ocak'ın bulunduğu haftanın Pazartesi gününü bul
  const daysToMonday = jan4Day === 0 ? -6 : 1 - jan4Day;
  const firstMonday = new Date(year, 0, 4 + daysToMonday);
  
  // Seçili haftanın Pazartesi günü
  const weekStart = new Date(firstMonday);
  weekStart.setDate(firstMonday.getDate() + (week - 1) * 7);
  
  // 7 günü formatla: "DD MMMM YYYY dddd"
  const days: string[] = [];
  const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    
    const dayNum = day.getDate();
    const month = monthNames[day.getMonth()];
    const yearNum = day.getFullYear();
    const dayName = dayNames[day.getDay()];
    
    days.push(`${dayNum} ${month} ${yearNum} ${dayName}`);
  }
  
  return days;
}

/**
 * Yazdırma sayfalarında kullanılacak standart tarih etiketi.
 * Tüm yazdırma sayfalarında "Yazdırma Tarihi: 03.03.2026" formatında görünür.
 */
export function getPrintDateLabel(): string {
  const d = new Date();
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `Yazdırma Tarihi: ${day}.${month}.${year}`;
}

/**
 * Sadece tarih: "DD.MM.YYYY" (başlık vb. için)
 */
export function getPrintDateDDMMYYYY(): string {
  const d = new Date();
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Tarih formatla: "DD.MM.YYYY dddd"
 */
export function formatDateForExport(date: Date): string {
  const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const dayName = dayNames[date.getDay()];
  
  return `${day.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')}.${year} ${dayName}`;
}

/**
 * Sipariş kartlarını filtrele (seçili hafta için)
 * ✅ DÜZELTME: Siparişler backend'den ayrı çekiliyor, bu yüzden her kart için siparişleri çekmeliyiz
 */
/**
 * Sipariş kartlarını filtrele (seçili hafta için)
 * ✅ DÜZELTME: Siparişler backend'den ayrı çekiliyor, bu yüzden her kart için siparişleri çekmeliyiz
 */
export async function filterOrdersForWeek(
  kartlar: OrganizasyonKart[] | null | undefined,
  selectedWeek: string | null | undefined
): Promise<Array<{ kart: OrganizasyonKart; siparis: Order }>> {
  if (!kartlar || !selectedWeek) {
    return [];
  }
  
  const weekDays = getWeekDays(selectedWeek);
  if (weekDays.length === 0) {
    return [];
  }
  
  const results: Array<{ kart: OrganizasyonKart; siparis: Order }> = [];
  
  // Her kart için siparişleri çek
  const { getSiparisKartlariByOrganizasyon } = await import('../api');
  
  // Paralel olarak tüm kartların siparişlerini çek
  const siparisPromises = kartlar.map(async (kart) => {
    // Araç Süsleme kartlarını hariç tut
    if (kart.kart_tur === 'aracsusleme') {
      return { kart, siparisler: [] };
    }
    
    // Kart tarihini formatla
    if (!kart.teslim_tarih) {
      return { kart, siparisler: [] };
    }
    
    const kartTarih = formatOrderDate(kart.teslim_tarih);
    if (!weekDays.includes(kartTarih)) {
      return { kart, siparisler: [] };
    }
    
    // Kartın siparişlerini çek
    try {
      const siparisler = await getSiparisKartlariByOrganizasyon(kart.id);
      return { kart, siparisler };
    } catch (error) {
      console.error(`❌ Kart ${kart.id} için siparişler çekilemedi:`, error);
      return { kart, siparisler: [] };
    }
  });
  
  const siparisResults = await Promise.all(siparisPromises);
  
  // Sonuçları birleştir
  siparisResults.forEach(({ kart, siparisler }) => {
    if (siparisler && siparisler.length > 0) {
      siparisler.forEach(siparis => {
        results.push({ kart, siparis });
      });
    }
  });
  
  return results;
}

/**
 * Sipariş tarihini formatla: "DD MMMM YYYY dddd"
 */
function formatOrderDate(dateString: string | undefined): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  
  const day = date.getDate();
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  const dayName = dayNames[date.getDay()];
  
  return `${day} ${month} ${year} ${dayName}`;
}

/**
 * Print HTML oluştur
 * ✅ ESKİ YAPI: Eski yapıdaki format ve stilleri kullan
 */
export async function generatePrintHTML(
  tarihBilgisiYazisi: string,
  logoMarkup: string,
  filteredOrders: Array<{ kart: OrganizasyonKart; siparis: Order }>
): Promise<string> {
  const { formatPhoneNumber, appendIlceIlToAddress } = await import('../../../shared/utils/formatUtils');
  const yazdirmaTarihi = getPrintDateLabel();
  const titleDate = getPrintDateDDMMYYYY();
  
  let html = `
     <html>
<head>
<title>Sipariş Teslim Listesi – ${titleDate}</title>
<style>
${getPrintStyles()}
</style>
</head>
<body>
<div class="header">
<div class="logo-container">${logoMarkup || ''}</div>
<h1>Sipariş Teslim Listesi</h1>
</div>
<div class="ust-ikinci-satir">
<div class="yazdirma-ust-bilgi-alan">
${yazdirmaTarihi}
<div class="tarih-bilgi-yazisi">
  ${tarihBilgisiYazisi}
</div>
</div>
  <div class="siparis-sayisi-box">
  <div class="siparis-sayisi-label">Toplam Sipariş Sayısı</div>
  <div class="siparis-sayisi-value">${filteredOrders.length}</div>
</div>
</div>

<table>
<thead>
  <tr>
  <th class="col-checkbox">Teslim</th>
  <th class="col-sira-no">#</th>      
    <th class="col-teslim-tarihi">Teslim Tarihi</th>
<th class="col-saat">Saat</th>
<th class="col-kart-tur">Sipariş Türü</th>
<th class="col-teslim-kisisi">Teslim Kişisi</th>
<th class="col-siparis-veren">Siparişi Veren</th>
<th class="col-urun">Ürün</th>
<th class="col-adres">Teslim Adresi</th>
  </tr>
</thead>
<tbody>
`;
  
  // Siparişleri grupla (mahalle + tarih)
  let oncekiGrupKey = '';
  let sira = 1;
  
  filteredOrders.forEach(({ kart, siparis }) => {
    const mahalle = kart.mahalle || '';
    const teslimatKonumu = (kart as any).organizasyon_teslimat_konumu || '';
    const isOrganizasyon = kart.kart_tur === 'organizasyon';
    const tarih = formatOrderDate(kart.teslim_tarih || '').replace(/\s+/g, ' ').trim();
    const isOzelGun = kart.kart_tur === 'ozelgun';
    const isOzelSiparis = kart.kart_tur === 'ozelsiparis';
    const grupKey = isOzelGun
      ? `${tarih}|ozelgun|${(kart.alt_tur || '').toLowerCase()}`
      : isOzelSiparis
        ? `${tarih}|ozelsiparis`
        : isOrganizasyon && teslimatKonumu
          ? `${tarih}|org|${teslimatKonumu}`
          : `${mahalle.toLowerCase()}|${tarih}`;
    const grupMahalleDisplay = isOzelGun
      ? `Özel Gün${kart.alt_tur ? ` • ${kart.alt_tur}` : ''}`
      : isOzelSiparis
        ? 'Özel Siparişler'
        : isOrganizasyon && teslimatKonumu
          ? teslimatKonumu
          : mahalle || '—';
    
    // Grup değiştiyse grup başlığı ekle
    if (grupKey !== oncekiGrupKey) {
      // Bu grubun sipariş sayısını hesapla
      const grupSiparisSayisi = filteredOrders.filter(({ kart: k }) => {
        const m = k.mahalle || '';
        const tc = (k as any).organizasyon_teslimat_konumu || '';
        const org = k.kart_tur === 'organizasyon';
        const t = formatOrderDate(k.teslim_tarih || '').replace(/\s+/g, ' ').trim();
        const og = k.kart_tur === 'ozelgun';
        const os = k.kart_tur === 'ozelsiparis';
        const gk = og ? `${t}|ozelgun|${(k.alt_tur || '').toLowerCase()}` : os ? `${t}|ozelsiparis` : org && tc ? `${t}|org|${tc}` : `${m.toLowerCase()}|${t}`;
        return gk === grupKey;
      }).length;
      
      html += `
    <tbody class="page-break-group">
    <tr>
      <td colspan="9">
        <div class="grup-baslik">
          <div class="grup-info">
            <span class="grup-tarih">${tarih}</span>
            <span class="grup-separator">•</span>
            <span class="grup-mahalle">${grupMahalleDisplay}</span>
          </div>
          <div class="grup-sayi">
            <span class="grup-sayi-label">Sipariş Sayısı:</span>
            <span class="grup-sayi-value">${grupSiparisSayisi}</span>
          </div>
        </div>
      </td>
    </tr>`;
      oncekiGrupKey = grupKey;
    }
    
    const teslimSaat = (siparis.teslimSaati || kart.teslim_saat || '').replace('Saat', '').trim();
    const kartTur = getKartTurDisplay(kart.kart_tur, kart.kart_tur_display);
    const kartTurCellHtml = getKartTurCellContentForPrint(kart.kart_tur, kart.kart_tur_display);
    const teslimKisisi = kart.teslim_kisisi || siparis.teslimKisisi || '';
    const teslimTelefonRaw = kart.teslim_kisisi_telefon || siparis.teslimKisisiTelefon || '';
    const teslimTelefon = formatPhoneNumber(teslimTelefonRaw); // ✅ Telefon numarasını formatla
    const siparisVeren = siparis.musteriAdi || '';
    const urun = siparis.urun || '';
    const urunYazisi = siparis.urunYazisi || siparis.notes || '';
    const ilce = (kart as any).organizasyon_ilce || (siparis as any).teslimIlce;
    const il = (kart as any).organizasyon_il || (siparis as any).teslimIl;
    const acikAdresRaw = kart.acik_adres || siparis.acikAdres || '';
    const adresWithIlceIl = appendIlceIlToAddress(acikAdresRaw, ilce, il);
    const isOrgWithKonum = isOrganizasyon && teslimatKonumu;
    const mahalleDisplay = isOrgWithKonum ? teslimatKonumu : (kart.mahalle || (siparis as any).mahalle || '');
    const adres = isOrgWithKonum && (mahalle || adresWithIlceIl)
      ? (mahalle ? `${mahalle}${adresWithIlceIl ? ', ' + adresWithIlceIl : ''}` : adresWithIlceIl)
      : adresWithIlceIl;
    
    const teslimEdilecekKisiHtml = `
    <div>${teslimKisisi}</div>
    <div class="telefon">${teslimTelefon}</div>
  `;
    
    html += `<tr>
    <td class="col-checkbox"><input type="checkbox" class="print-checkbox" /></td>
    <td class="col-sira-no">${sira++}</td>
    <td class="tarih col-teslim-tarihi">${tarih}</td>
    <td class="saat-icerik col-saat">${teslimSaat}</td>
    <td class="kart-tur col-kart-tur">${kartTurCellHtml}</td>
    <td class="teslim-kisisi col-teslim-kisisi">${teslimEdilecekKisiHtml}</td>
    <td class="siparis-veren col-siparis-veren">
      <div class="siparis-veren-wrapper">
        <span class="veren">${siparisVeren}</span>
        <span class="urun-yazisi">${urunYazisi}</span>
      </div>
    </td>
    <td class="siparis-urun col-urun">${urun}</td>
    <td class="col-adres">
      <div class="adres-wrapper">
        <span class="mahalle">${mahalleDisplay}</span>
        <span class="adres">${adres}</span>
      </div>
    </td>
  </tr>`;
  });

  html += `
</tbody>
</table>
</body>
</html>`;

  return html;
}

/**
 * Kart türü display değerini al (metin)
 */
function getKartTurDisplay(kartTur: string, display?: string): string {
  if (display) return display;
  const turMap: Record<string, string> = {
    'organizasyon': 'Organizasyon Siparişleri',
    'ozelgun': 'Özel Gün Siparişleri',
    'ozelsiparis': 'Özel Siparişler',
    'ciceksepeti': 'Çiçek Sepeti',
  };
  return turMap[kartTur] || kartTur;
}

/** Yazdırma tablosunda Sipariş Türü hücresi: Çiçek Sepeti için siyah logo, diğerleri metin */
function getKartTurCellContentForPrint(kartTur: string, display?: string): string {
  const normalized = (kartTur || '').toLowerCase().trim();
  const isCiceksepeti = normalized === 'ciceksepeti' || (display || '').toLowerCase().includes('çiçek sepeti');
  if (isCiceksepeti) {
    return '<img src="/assets/cicek-sepeti/cicek-sepeti.svg" alt="Çiçek Sepeti" class="print-kart-tur-ciceksepeti-logo" />';
  }
  return getKartTurDisplay(kartTur, display);
}

/**
 * Print stilleri
 * ✅ ESKİ YAPI: Eski yapıdaki getIndexPrintStyles fonksiyonundan alındı
 */
function getPrintStyles(): string {
  return `
@page {
  size: A4 portrait;
  margin: 5mm 5mm 10mm 5mm;
}

body {
  font-family: Arial, sans-serif;
  color: #333;
  padding: 10px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-container:empty {
  display: none;
}

.logo-container svg,
.logo-container img {
 height: 64px;
  width: auto;
  display: block;
  vertical-align: middle;
}


.header h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1;
  display: flex;
  align-items: center;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}

th {
  font-size: 9px;
  padding: 8px 6px;
  text-align: left;
  font-weight: 600;
  border: .5px solid #e8e8e8;
  background: #f0f0f0;
}

/* Sıralama oklarını yazdırma sayfalarında gizle */
th .sort-icon,
th .fa-sort,
th .fa-sort-up,
th .fa-sort-down,
th .fa-sort-asc,
th .fa-sort-desc,
th i.fa-sort,
th i.fas.fa-sort,
th i.fas.fa-sort-up,
th i.fas.fa-sort-down,
th i.fa-solid.fa-sort,
th i.fa-solid.fa-sort-up,
th i.fa-solid.fa-sort-down,
th .chevron,
th .arrow {
  display: none !important;
}

td {
  font-size: 9px;
  padding: 6px 5px;
  border: .5px solid #cccccc;
}

tr:nth-child(even) {
  background-color: #f9f9f9;
}

.empty-cell {
  background-color: #f2f2f2;
  color: #888;
  font-style: italic;
  text-align: center;
}

.tarih {
  font-style: normal;
  color: #000;
  text-align: center;
}

.saat-icerik {
  font-weight: bold;
  font-size: 12px;
  color: #000;
  text-align: center;
}

.kart-tur {
  font-weight: 600;
  color: #000;
    width: 90px;
  text-align: center;
  background: #dce7f9ff;
}

.kart-tur img {
  height: 20px;
  max-width: 60px;
  object-fit: contain;
  filter: brightness(0) saturate(100%);
}

/* Çiçek Sepeti: Sipariş türü kolonunda siyah logo */
.print-kart-tur-ciceksepeti-logo {
  height: 20px;
  width: auto;
  max-width: 80px;
  object-fit: contain;
  filter: brightness(0);
  vertical-align: middle;
}

.kart-tur:has(img[alt="Çiçek Sepeti"]) {
  background: #ffe6f2; /* pembe */
}

.siparis-urun {
  font-style: normal;
  color: #000;
  line-height: 11px;
}

.teslim-kisisi {
  font-style: normal;
  color: #000;
  line-height: 11px;
  font-weight: bold;
  white-space: nowrap;
}

.col-teslim-kisisi .telefon {
  font-weight: normal;
}

.col-teslim-kisisi {
  white-space: nowrap;
}

.konum, .mahalle {
  font-style: normal;
  color: #000;
}

.adres-wrapper {
  display: flex;
  flex-direction: column;
}

.adres-wrapper .mahalle {
  font-weight: bold;
  color: #000;
  font-size: 12px;
}

.adres-wrapper .adres {
  font-style: normal;
  font-size: 9px;
  line-height: 12px;
  color: #000;
  margin-top: 3px;
}

.col-checkbox {
  width: 20px;
  text-align: center;
}

.print-checkbox {
  width: 20px;
  height: 20px;
  accent-color: #000;
}

.col-sira-no {
  width: 10px !important;
  text-align: center;
}

.col-teslim-tarihi {
  width: 120px;
  text-align: center;
}

.col-saat {
  width: 40px;
  text-align: center;
}

.col-kart-tur {
  width: 90px;
  text-align: center;
}


.col-teslim-kisisi {
  width: 150px;
  max-width: 150px;
}

.col-siparis-veren {
  word-wrap: break-word;
  white-space: normal;
  width: 150px;
  max-width: 150px;
}

.col-urun {
  width: 60px;
}

.col-adres {
  width: 380px;
}

th:first-child, td:first-child {
  text-align: center;
  width: 30px;
  font-weight: bold;
}

.siparis-sayisi-box {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
  margin-top: 10px;
}

.siparis-sayisi-label {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  height: 24px;
  padding: 3px;
  border-bottom: 1px solid #000;
}

.siparis-sayisi-value {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
  color: #000;
  border: 1px solid #000;
  width: 24px;
  height: 24px;
  padding: 3px;
  border-radius: 4px;
}

.grup-baslik {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  font-weight: bold;
  margin-top: 5px;
  margin-bottom: 2px;
  padding: 6px 12px;
  background: #4c4c4c;
  border-radius: 4px;
  color: #fff;
}

.grup-bilgi {
  display: flex;
  align-items: center;
  gap: 6px;
}

.grup-separator {
  color: #999;
  font-size: 14px;
  color: #fff;
}

.grup-sayi {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #fff;
}

.grup-sayi-label {
  font-size: 11px;
  font-weight: 500;
  color: #666;
  color: #fff;
}

.grup-sayi-value {
  font-size: 11px;
  font-weight: bold;
  color: #fff;
}

.grup-tarih {
  text-align: left;
  color: #fff;
}

.grup-mahalle {
  text-align: right;
  color: #fff;
}

.ust-ikinci-satir {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.yazdirma-ust-bilgi-alan {
  display: flex;
  flex-direction: column;
  font-size: 9px;
  color: #5e5e5e;
  gap: 4px;
}

.tarih-bilgi-yazisi {
  font-size: 10px;
  color: #5e5e5e;
  padding: 5px;
  border: 1px solid #d4d4d4;
  border-radius: 5px;
}

.tarih-vurgulu {
  font-weight: 600;
  background-color: #f0f0f0;
  padding: 2px 4px;
  border-radius: 3px;
  color: #000;
}

.page-break-group {
  page-break-inside: avoid;
  break-inside: avoid;
}

.siparis-veren-wrapper {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.siparis-veren-wrapper .veren {
  font-style: normal;
  color: #878787;
  font-size: 9px;
  font-weight: 600;
  line-height: 11px;
}

.siparis-veren-wrapper .urun-yazisi {
  font-style: normal;
  color: #969696;
  font-size: 7px;
  line-height: 9px;
}
`;
}

/**
 * Tenant ID'yi localStorage'dan al (auth modülü import etmeden, döngüsel bağımlılık önleme).
 */
function getTenantId(): number {
  if (typeof window === 'undefined') return 1;
  try {
    const tid = localStorage.getItem('floovon_tenant_id');
    if (tid) {
      const n = parseInt(tid, 10);
      if (!Number.isNaN(n)) return n;
    }
    const userStr = localStorage.getItem('floovon_user');
    if (userStr) {
      const user = JSON.parse(userStr) as { tenant_id?: number };
      if (user?.tenant_id != null) return Number(user.tenant_id);
    }
  } catch (_) {}
  return 1;
}

/**
 * Yazdırma logosu URL çözümlemesi – sipariş künyesi (yazdir-kunye.js) ile aynı mantık.
 * Backend ayarlar_genel_yazdirma_ayarlari'ndan dönen logo_png_url / logo_png_path kullanılır.
 * Path'leri tenant-based /uploads/tenants/{tenantId}/print-settings/ yapısına çevirir.
 */
async function resolvePrintLogoUrl(pathOrUrl: string): Promise<string> {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return '';
  let raw = pathOrUrl.trim().replace(/\\/g, '/');
  if (!raw) return '';

  const { getApiBaseUrl } = await import('../../../lib/runtime');
  let backendBase = getApiBaseUrl().replace(/\/api\/?$/, '');
  if (!backendBase && typeof window !== 'undefined') {
    const port = localStorage.getItem('backend_port') || '3001';
    backendBase = `${window.location.protocol}//${window.location.hostname}:${port}`;
  }
  const tenantId = getTenantId();
  if (PRINT_LOGO_DEBUG) console.log('[PrintLogo] resolvePrintLogoUrl:', { raw, backendBase, tenantId });

  // Zaten tam URL ise (http/https)
  if (/^https?:\/\//i.test(raw)) {
    let out = raw;
    if (out.includes('/uploads/print-settings/') && !out.includes('/uploads/tenants/')) {
      const fileName = out.split('/uploads/print-settings/')[1]?.split('?')[0] || out.split('print-settings/')[1]?.split('?')[0];
      if (fileName) out = `${backendBase}/uploads/tenants/${tenantId}/print-settings/${fileName}`;
    }
    return out.replace(/\/uploads\/uploads\//g, '/uploads/');
  }

  if (raw.startsWith('//')) return `${typeof window !== 'undefined' ? window.location.protocol : 'https:'}${raw}`;

  // /assets/ -> same origin (uygulama asset'i)
  if (raw.startsWith('/assets/') || raw.startsWith('assets/')) {
    const assetPath = raw.startsWith('/') ? raw : '/' + raw;
    return (typeof window !== 'undefined' ? window.location.origin : '') + assetPath;
  }

  // Eski print-settings path'ini tenant-based yapıya çevir
  let path = raw;
  if (path.includes('/uploads/print-settings/') && !path.includes('/uploads/tenants/')) {
    const fileName = path.split('/uploads/print-settings/')[1] || path.split('print-settings/')[1];
    path = `/uploads/tenants/${tenantId}/print-settings/${fileName || path}`;
  }
  if (path.startsWith('/yazdirma/') || path.startsWith('yazdirma/')) {
    const cleanPath = path.replace(/^\/?yazdirma\//, '');
    path = `/uploads/tenants/${tenantId}/print-settings/${cleanPath}`;
  }
  if (path.startsWith('print-settings/')) {
    path = `/uploads/tenants/${tenantId}/print-settings/${path.replace('print-settings/', '')}`;
  }

  if (path.startsWith('/uploads/')) return `${backendBase}${path}`;
  if (path.startsWith('uploads/')) return `${backendBase}/${path}`;
  if (path.startsWith('/')) return `${backendBase}${path}`;
  return `${backendBase}/${path}`;
}

/** Backend'den gelen data içinde logo path/url alan adları (ayarlar_genel_yazdirma_ayarlari uyumu) */
const LOGO_KEYS = ['logo_png_url', 'logo_png_path', 'logo_url', 'logo'] as const;

/** true iken konsola [PrintLogo] logları yazar; sorun giderildikten sonra false yapın */
const PRINT_LOGO_DEBUG = true;

export interface PrintLogoAndFooter {
  logoMarkup: string;
  footerHtml: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Logo markup ve işletme footer'ı al – GET /api/ayarlar/yazdirma (logo + ayarlar_genel_isletme_ayarlari: adres, telefon, eposta, website).
 */
export async function getPrintLogoMarkup(): Promise<string> {
  const { logoMarkup } = await getPrintLogoAndFooter();
  return logoMarkup;
}

export async function getPrintLogoAndFooter(): Promise<PrintLogoAndFooter> {
  try {
    const { apiRequest } = await import('../../../lib/api');
    if (PRINT_LOGO_DEBUG) console.log('[PrintLogo] GET /api/ayarlar/yazdirma çağrılıyor...');
    const res = await apiRequest<Record<string, unknown> | { data?: Record<string, unknown> }>('/ayarlar/yazdirma');
    const data: Record<string, unknown> | undefined =
      res != null && typeof res === 'object' && 'data' in res && (res as { data?: unknown }).data != null
        ? (res as { data: Record<string, unknown> }).data
        : (res as Record<string, unknown>);
    if (PRINT_LOGO_DEBUG) console.log('[PrintLogo] API yanıtı (payload):', data);
    if (!data || typeof data !== 'object') {
      if (PRINT_LOGO_DEBUG) console.warn('[PrintLogo] data yok');
      return { logoMarkup: '', footerHtml: '' };
    }

    let raw = '';
    for (const key of LOGO_KEYS) {
      const v = data[key];
      if (v != null && String(v).trim()) {
        raw = String(v).trim().replace(/\\/g, '/');
        if (PRINT_LOGO_DEBUG) console.log('[PrintLogo] Kullanılan alan:', key, '→ raw:', raw);
        break;
      }
    }
    let logoMarkup = '';
    if (raw) {
      const logoUrl = await resolvePrintLogoUrl(raw);
      if (PRINT_LOGO_DEBUG) console.log('[PrintLogo] Son logo URL:', logoUrl || '(boş)');
      if (logoUrl) logoMarkup = `<img src="${logoUrl}" alt="Logo" class="print-logo" />`;
    }

    const acikAdres = (data.company_address != null ? String(data.company_address).trim() : '') || '';
    const il = (data.company_il != null ? String(data.company_il).trim() : '') || '';
    const ilce = (data.company_ilce != null ? String(data.company_ilce).trim() : '') || '';
    const ilceIl = [ilce, il].filter(Boolean).join('/');
    const adresPart = [acikAdres, ilceIl].filter(Boolean).join(', ');
    const phoneRaw = (data.company_phone != null ? String(data.company_phone).trim() : '') || '';
    const { formatPhoneNumber } = await import('../../../shared/utils/formatUtils');
    const phone = phoneRaw ? formatPhoneNumber(phoneRaw) : '';
    const email = (data.company_email != null ? String(data.company_email).trim() : '') || '';
    const web = (data.company_web != null ? String(data.company_web).trim() : '') || '';
    const parts: string[] = [];
    if (adresPart) parts.push(escapeHtml(adresPart));
    if (phone) parts.push(escapeHtml(phone));
    if (email) parts.push(escapeHtml(email));
    if (web) parts.push(escapeHtml(web));
    const footerHtml = parts.length ? parts.join(' • ') : '';

    return { logoMarkup, footerHtml };
  } catch (error) {
    console.error('❌ Logo/footer alınamadı:', error);
    return { logoMarkup: '', footerHtml: '' };
  }
}

/**
 * Kampanya listesi yazdırma HTML'i – eski kampanya-yonetimi yapısına uygun
 * Kolonlar: Kampanya Adı, Kampanya Görseli, Kampanya Mesajı, Müşteri Grubu, Başlangıç, Bitiş, Kupon Kodu, Durum, Gönderilme
 */
export function generateKampanyaPrintHTML(
  campaigns: Array<{
    ad: string;
    mesaj?: string;
    musteri_grubu?: string;
    baslangic_tarihi: string;
    bitis_tarihi: string;
    kupon_kodu?: string;
    durum?: string;
    gonderildi?: number | boolean;
    gorsel_path?: string;
    toplam_gonderilen?: number;
    basarili_gonderilen?: number;
  }>,
  logoMarkup: string,
  footerHtml: string,
  getUploadUrlFn: (path: string) => string,
  getMusteriGrubuText: (g: string) => string,
  getStatusText: (d: string) => string
): string {
  const dateLabel = getPrintDateLabel();
  const dateShort = getPrintDateDDMMYYYY();
  const formatDate = (d: string) => (d ? new Date(d).toLocaleDateString('tr-TR') : '—');
  const escape = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const thBase = 'border:1px solid #cdcdcd;padding:6px;background:#f5f5f5;font-weight:600;';
  const tdBase = 'border:1px solid #cdcdcd;padding:6px;';
  const tdCenter = 'text-align:center;vertical-align:middle;';

  const rows = campaigns.map((c) => {
    const imgUrl = c.gorsel_path ? getUploadUrlFn(c.gorsel_path).replace(/"/g, '&quot;') : '';
    const gorselHtml = imgUrl
      ? `<img src="${imgUrl}" alt="" style="max-height:50px;max-width:80px;object-fit:contain;display:block;margin:0 auto;" />`
      : '—';
    const mesaj = escape((c.mesaj || '').substring(0, 200)) + (c.mesaj && c.mesaj.length > 200 ? '...' : '');
    const gonderilme = c.gonderildi
      ? (c.toplam_gonderilen != null ? `${c.toplam_gonderilen} gönderildi` : 'Gönderildi')
      : 'Gönderilmedi';
    return `<tr>
      <td style="${tdBase}">${escape(c.ad || '')}</td>
      <td style="${tdBase}${tdCenter}">${gorselHtml}</td>
      <td style="${tdBase}font-size:8px;line-height:1.3;max-width:120px;">${mesaj || '—'}</td>
      <td style="${tdBase}${tdCenter}">${escape(getMusteriGrubuText(c.musteri_grubu || ''))}</td>
      <td style="${tdBase}${tdCenter}">${formatDate(c.baslangic_tarihi)}</td>
      <td style="${tdBase}${tdCenter}">${formatDate(c.bitis_tarihi)}</td>
      <td style="${tdBase}${tdCenter}"><code>${escape(c.kupon_kodu || '')}</code></td>
      <td style="${tdBase}${tdCenter}">${escape(getStatusText(c.durum || ''))}</td>
      <td style="${tdBase}${tdCenter}">${escape(gonderilme)}</td>
    </tr>`;
  });

  const tableHtml = `
<table style="width:100%;border-collapse:collapse;font-size:10px;" class="kampanya-print-table">
<thead>
<tr>
<th style="${thBase}">KAMPANYA ADI</th>
<th style="${thBase}${tdCenter}">KAMPANYA GÖRSELİ</th>
<th style="${thBase}">KAMPANYA MESAJI</th>
<th style="${thBase}${tdCenter}">MÜŞTERİ GRUBU</th>
<th style="${thBase}${tdCenter}">BAŞLANGIÇ TARİHİ</th>
<th style="${thBase}${tdCenter}">BİTİŞ TARİHİ</th>
<th style="${thBase}${tdCenter}">KUPON KODU</th>
<th style="${thBase}${tdCenter}">KAMPANYA DURUMU</th>
<th style="${thBase}${tdCenter}">GÖNDERİLME DURUMU</th>
</tr>
</thead>
<tbody>
${rows.join('')}
</tbody>
</table>`;

  const styles = getCariTablePrintStyles();
  const footer = footerHtml ? `<div class="print-footer">${footerHtml}</div>` : '';
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"/><title>Kampanya Listesi – ${dateShort}</title><style>${styles}</style></head><body>
<div class="print-header">
  <div class="print-header-left">
    <div class="title">Kampanya Listesi</div>
    <div class="date">${dateLabel}</div>
  </div>
  <div class="logo-container">${logoMarkup || ''}</div>
</div>
${tableHtml}
${footer}
</body></html>`;
}

/**
 * Ortak yazdırma HTML yapısı – tüm tablo yazdırmalarında kullanılır.
 * Başlık + "Yazdırma Tarihi: DD.MM.YYYY" + logo + tablo + footer.
 */
export function buildPrintHtml(
  title: string,
  logoMarkup: string,
  footerHtml: string,
  tableHeaders: string,
  rows: string
): string {
  const dateLabel = getPrintDateLabel();
  const dateShort = getPrintDateDDMMYYYY();
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8"/>
  <title>${title} – ${dateShort}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; padding: 16px; color: #333; }
    .print-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 12px; }
    .print-header-left { display: flex; align-items: center; gap: 12px; }
    .print-header-right { display: flex; align-items: center; }
    .print-logo-wrap .print-logo { height: 48px; width: auto; display: block; }
    .print-title { font-size: 18px; font-weight: bold; }
    .print-date { font-size: 11px; color: #666; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; font-size: 12px; }
    th { background: #f5f5f5; font-weight: 600; white-space: nowrap; }
    tr:nth-child(even) { background: #fafafa; }
    .print-th-center, .print-td-center { text-align: center !important; }
    .print-footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 10px 20px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #4b5563; text-align: center; background: #fff; }
    @media print {
      body { margin: 0; padding-bottom: 28px; }
      .print-header { page-break-inside: avoid; }
      .print-footer { position: fixed; bottom: 0; left: 0; right: 0; }
    }
  </style>
</head>
<body>
  <div class="print-header">
    <div class="print-header-left">
      <div>
        <div class="print-title">${title}</div>
        <div class="print-date">${dateLabel}</div>
      </div>
    </div>
    ${logoMarkup ? `<div class="print-header-right print-logo-wrap">${logoMarkup}</div>` : ''}
  </div>
  <table>
    <thead><tr>${tableHeaders}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${footerHtml ? `<div class="print-footer">${footerHtml}</div>` : ''}
</body>
</html>`;
}

/** Cari sayfaları yazdırma stilleri – eski sistem + yeni başlık yapısı */
export function getCariTablePrintStyles(): string {
  return `
body { font-family: Arial, sans-serif; padding: 20px; color: #000; }
.print-header { margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; }
.print-header-left { flex: 1; min-width: 0; }
.print-badge { display: inline-block; font-size: 10px; font-weight: 600; color: #555; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 8px; padding: 4px 10px; background: #f1f3f5; border-radius: 6px; }
.print-unvan { font-size: 18px; font-weight: 600; margin-bottom: 4px; color: #111; }
.print-yetkili { font-size: 12px; color: #333; margin-bottom: 10px; }
.print-contact { font-size: 11px; color: #555; display: flex; flex-direction: column; gap: 4px; }
.print-contact span { display: block; }
.print-contact a { color: #555; text-decoration: none; display: block; }
.print-footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 10px 20px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #4b5563; text-align: center; background: #fff; }
.print-org-cell { line-height: 1.5; }
.print-org-cell br { display: block; margin-top: 2px; }
.print-header .title { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
.print-header .subinfo { font-size: 10px; color: #333; margin-bottom: 4px; }
.print-header .date { font-size: 9px; color: #555; padding-bottom: 16px; }
.logo-container svg, .logo-container img { height: 64px; width: auto; display: block; vertical-align: middle; }
table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: auto; }
th, td { border: 1px solid #cdcdcd; padding: 6px; vertical-align: middle; word-wrap: break-word; overflow: hidden; }
th { font-size: 10px; color: #707070; text-align: left; background: #f5f5f5; font-weight: 600; white-space: nowrap; }
td img { max-height: 50px; max-width: 100%; display: block; }
@media print {
  body { margin: 0; padding-bottom: 28px; }
  .print-header { page-break-inside: avoid; }
  .print-footer { position: fixed; bottom: 0; left: 0; right: 0; }
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; page-break-after: auto; }
  thead { display: table-header-group; }
}
`;
}

export interface CariPrintHeaderOptions {
  badgeLabel: string;
  unvan: string;
  yetkili?: string;
  telefon?: string;
  eposta?: string;
  currentDate: string;
  /** En altta işletme bilgileri: Adres • Telefon • E-posta • Web (koyu gri, küçük) */
  footerHtml?: string;
}

/** Cari yazdırma HTML’i – üstte badge + unvan + yetkili + telefon/eposta (Müşteri: satırı yok) */
export function generateCariPrintHTMLWithHeader(
  opts: CariPrintHeaderOptions,
  tableContent: string,
  logoMarkup: string
): string {
  const { badgeLabel, unvan, yetkili = '', telefon = '', eposta = '', currentDate, footerHtml = '' } = opts;
  const docTitle = unvan ? `Cari – ${unvan}` : 'Cari Hesap Dökümü';
  const styles = getCariTablePrintStyles();
  const contactParts: string[] = [];
  if (telefon) contactParts.push(`<span>${telefon}</span>`);
  if (eposta) contactParts.push(`<a href="mailto:${eposta}">${eposta}</a>`);
  const contactHtml = contactParts.length ? `<div class="print-contact">${contactParts.join('')}</div>` : '';
  const footer = footerHtml ? `<div class="print-footer">${footerHtml}</div>` : '';
  const dateLabel = getPrintDateLabel();
  const dateShort = getPrintDateDDMMYYYY();
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"/><title>${docTitle} – ${dateShort}</title><style>${styles}</style></head><body>
<div class="print-header">
  <div class="print-header-left">
    <div class="print-badge">${badgeLabel}</div>
    <div class="print-unvan">${unvan || '—'}</div>
    ${yetkili ? `<div class="print-yetkili">${yetkili}</div>` : ''}
    ${contactHtml}
    <div class="date" style="margin-top:8px;">${dateLabel}</div>
  </div>
  <div class="logo-container">${logoMarkup || ''}</div>
</div>
${tableContent}
${footer}
</body></html>`;
}

/** Cari yazdırma HTML’i – eski sistemdeki print-header + tablo yapısı (geriye dönük) */
export function generateCariPrintHTML(
  tableTitle: string,
  _currentDate: string,
  subinfoHtml: string,
  tableContent: string,
  logoMarkup: string
): string {
  const styles = getCariTablePrintStyles();
  const dateLabel = getPrintDateLabel();
  const dateShort = getPrintDateDDMMYYYY();
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"/><title>${tableTitle} – ${dateShort}</title><style>${styles}</style></head><body>
<div class="print-header">
  <div>
    <div class="title">${tableTitle}</div>
    <div class="date">${dateLabel}</div>
    ${subinfoHtml}
  </div>
  <div class="logo-container">${logoMarkup || ''}</div>
</div>
${tableContent}
</body></html>`;
}

/**
 * Print penceresi aç
 * ✅ ESKİ YAPI: Gizli iframe kullanarak about:blank sorununu önle ve yeni sekme açılmasını engelle
 */
export function openPrintWindow(htmlContent: string, title: string, extraStyle: string = ''): void {
  try {
    // Gizli iframe kullanarak about:blank sorununu önle ve yeni sekme açılmasını engelle
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '-9999px';
    printFrame.style.bottom = '-9999px';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.style.opacity = '0';
    printFrame.style.visibility = 'hidden';
    printFrame.style.pointerEvents = 'none';
    printFrame.style.zIndex = '-9999';
    printFrame.setAttribute('aria-hidden', 'true');
    
    // extraStyle varsa HTML içeriğine ekle
    let finalHtmlContent = htmlContent;
    if (extraStyle) {
      const styleTag = `
        <style>
          @page {
            size: A4 portrait;
            margin: 5mm 5mm 10mm 5mm;
            @bottom-left {
              content: "${extraStyle}";
              font-family: Arial, sans-serif;
              font-size: 8px;
              color: #5e5e5e;
              margin-left: 16px;
              margin-bottom: 16px;
              border-radius: 5px;
              padding: 5px;
              width: fit-content;
            }
            @bottom-right {
              content: "Lütfen tüm sayfaları kontrol ediniz. • Sayfa: " counter(page) " / " counter(pages);
              font-family: Arial, sans-serif;
              font-size: 11px;
              color: #5e5e5e;
              margin-right: 16px;
              margin-bottom: 16px;
              border: 1px solid #5e5e5e;
              border-radius: 5px;
              padding: 5px;
              width: fit-content;
            }
          }
        </style>
      `;
      // Style'ı head içine ekle
      finalHtmlContent = finalHtmlContent.replace('</head>', styleTag + '</head>');
    }
    
    // srcdoc kullanarak document.write() yerine modern yöntem kullan
    printFrame.srcdoc = finalHtmlContent;
    document.body.appendChild(printFrame);
    
    printFrame.onload = function() {
      try {
        const win = printFrame.contentWindow;
        if (!win) return;

        const doPrint = () => {
          win.print();
          win.onafterprint = () => {
        requestAnimationFrame(() => {
              if (printFrame.parentNode) document.body.removeChild(printFrame);
                });
              };
              setTimeout(() => {
            if (printFrame.parentNode) document.body.removeChild(printFrame);
              }, 5000);
        };

        const doc = win.document;
        const imgs = doc.querySelectorAll('img');
        let pending = imgs.length;
        const timeout = setTimeout(() => {
          if (pending > 0) {
            pending = 0;
            doPrint();
          }
        }, 1500);

        if (pending === 0) {
          clearTimeout(timeout);
          requestAnimationFrame(() => requestAnimationFrame(doPrint));
          return;
        }

        imgs.forEach((img: Element) => {
          const el = img as HTMLImageElement;
          const done = () => {
            pending--;
            if (pending <= 0) {
              clearTimeout(timeout);
              requestAnimationFrame(() => requestAnimationFrame(doPrint));
            }
          };
          if (el.complete) done();
          else {
            el.onload = done;
            el.onerror = done;
          }
        });
      } catch (error: any) {
        console.error('❌ Yazdırma hatası:', error);
        if (printFrame.parentNode) document.body.removeChild(printFrame);
        throw new Error('Yazdırma işlemi başarısız: ' + (error?.message || 'Bilinmeyen hata'));
      }
    };
  } catch (error: any) {
    console.error('❌ Print window açma hatası:', error);
    throw error;
  }
}

/**
 * Excel export
 */
export async function exportToExcel(
  filteredOrders: Array<{ kart: OrganizasyonKart; siparis: Order }>,
  tarihBilgisiYazisi: string
): Promise<void> {
  try {
    const XLSX = typeof window !== 'undefined' ? (window as any).XLSX : null;
    if (!XLSX || !XLSX.utils) {
      console.error('XLSX kütüphanesi yüklü değil. index.html içinde xlsx CDN scripti olduğundan emin olun.');
      throw new Error('Excel dışa aktarımı için XLSX kütüphanesi yüklenmemiş.');
    }
    const { formatPhoneNumber } = await import('../../../shared/utils/formatUtils');
    // Excel verisi hazırla
    const data = filteredOrders.map(({ kart, siparis }, index) => {
    const tarih = formatOrderDate(kart.teslim_tarih || '');
    const teslimSaat = siparis.teslimSaati || kart.teslim_saat || '';
    const kartTur = getKartTurDisplay(kart.kart_tur, kart.kart_tur_display);
    const teslimKisisi = kart.teslim_kisisi || siparis.teslimKisisi || '';
    const teslimTelefonRaw = kart.teslim_kisisi_telefon || siparis.teslimKisisiTelefon || '';
    const teslimTelefon = formatPhoneNumber(teslimTelefonRaw);
    const siparisVeren = siparis.musteriAdi || '';
    const urun = siparis.urun || '';
    const urunYazisi = siparis.urunYazisi || siparis.notes || '';
    const mahalle = kart.mahalle || '';
    const adres = kart.acik_adres || siparis.acikAdres || '';
    
    return {
      'Sıra No': index + 1,
      'Teslim Tarihi': tarih,
      'Saat': teslimSaat,
      'Sipariş Türü': kartTur,
      'Teslim Kişisi': teslimKisisi,
      'Teslim Telefon': teslimTelefon,
      'Siparişi Veren': siparisVeren,
      'Ürün': urun,
      'Ürün Yazısı': urunYazisi,
      'Mahalle': mahalle,
      'Adres': adres,
    };
  });
  
  // Workbook oluştur
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  
  // Kolon genişliklerini ayarla
  const colWidths = [
    { wch: 10 }, // Sıra No
    { wch: 20 }, // Teslim Tarihi
    { wch: 10 }, // Saat
    { wch: 25 }, // Sipariş Türü
    { wch: 20 }, // Teslim Kişisi
    { wch: 15 }, // Teslim Telefon
    { wch: 20 }, // Siparişi Veren
    { wch: 20 }, // Ürün
    { wch: 30 }, // Ürün Yazısı
    { wch: 15 }, // Mahalle
    { wch: 40 }, // Adres
  ];
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, 'Siparişler');
    
    // Dosya adı
    const tarihBaslik = tarihBilgisiYazisi.replace(/<[^>]*>/g, '').trim();
    const temizTarih = tarihBaslik.replace(/\s+/g, '-').replace(/[^\w\-]/g, '');
    const fileName = `Sipariş Teslim Listesi - ${temizTarih}.xlsx`;
    
    // İndir
    XLSX.writeFile(wb, fileName);
  } catch (error: any) {
    console.error('❌ Excel export hatası:', error);
    throw new Error('Excel export işlemi başarısız: ' + (error?.message || 'Bilinmeyen hata'));
  }
}

/**
 * Herhangi bir tablo verisini Excel olarak indirir (müşteri, partner, cari listeleri vb.).
 * window.XLSX (index.html'de yüklü) kullanır.
 */
export function downloadTableAsExcel(data: Record<string, unknown>[], fileNameBase: string): void {
  const XLSX = typeof window !== 'undefined' ? (window as any).XLSX : null;
  if (!XLSX?.utils) {
    throw new Error('Excel dışa aktarımı için XLSX kütüphanesi yüklenmemiş.');
  }
  if (!data?.length) {
    throw new Error('Dışa aktarılacak veri yok.');
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Liste');
  const safeName = fileNameBase.replace(/[^\w\u00C0-\u024F\s\-]/gi, '').replace(/\s+/g, '-') || 'export';
  const fileName = `${safeName}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

