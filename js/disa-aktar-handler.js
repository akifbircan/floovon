// disa-aktar-handler.js - Dışa Aktarma Yazdır ve Excel'e Aktar Sistemi

// ÖNEMLİ: Dosya tekrar yüklenirse hata vermemesi için kontrol
if (typeof window.__DISA_AKTAR_HANDLER_LOADED__ !== 'undefined') {
    // Dosya zaten yüklenmiş, hiçbir şey yapma
    console.warn('⚠️ disa-aktar-handler.js zaten yüklenmiş, tekrar yükleme atlanıyor');
} else {
    window.__DISA_AKTAR_HANDLER_LOADED__ = true;
    
    // FLOOVON_API_BASE zaten tanımlıysa tekrar tanımlama (çift yükleme önleme)
    if (typeof window.FLOOVON_API_BASE === 'undefined') {
        const apiBase = (typeof window.getFloovonApiBase === 'function') ? window.getFloovonApiBase() : (window.API_BASE_URL || 'http://localhost:3001/api');
        window.FLOOVON_API_BASE = apiBase.replace(/\/$/, '');
    }
    // ÖNEMLİ: Dosya tekrar yüklenirse const hatası vermemesi için kontrol
    if (typeof window.FLOOVON_API_BASE_GLOBAL === 'undefined') {
        window.FLOOVON_API_BASE_GLOBAL = window.FLOOVON_API_BASE;
    }
    var FLOOVON_API_BASE = window.FLOOVON_API_BASE_GLOBAL;
    
    // ÖNEMLİ: FLOOVON_BACKEND_BASE de tekrar tanımlanmamalı
    if (typeof window.FLOOVON_BACKEND_BASE === 'undefined') {
        window.FLOOVON_BACKEND_BASE = FLOOVON_API_BASE.endsWith('/api') ? FLOOVON_API_BASE.slice(0, -4) : FLOOVON_API_BASE;
    }
    var FLOOVON_BACKEND_BASE = window.FLOOVON_BACKEND_BASE;

function resolvePrintLogoUrl(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (pathOrUrl.startsWith('//')) {
    return `${window.location.protocol}${pathOrUrl}`;
  }
  if (pathOrUrl.startsWith('/assets/') || pathOrUrl.startsWith('assets/')) {
    return pathOrUrl.startsWith('/') ? pathOrUrl.slice(1) : pathOrUrl;
  }
  if (pathOrUrl.startsWith('/uploads/')) {
    return `${FLOOVON_BACKEND_BASE}${pathOrUrl}`;
  }
  if (pathOrUrl.startsWith('uploads/')) {
    return `${FLOOVON_BACKEND_BASE}/${pathOrUrl}`;
  }
  return pathOrUrl;
}

async function ensureYazdirmaAyarlarYuklendi() {
  if (window.floovonYazdirmaAyarlar) return window.floovonYazdirmaAyarlar;
  try {
    const response = await fetch(`${FLOOVON_API_BASE}/ayarlar/yazdirma`);
    const result = await response.json();
    if (result.success && result.data) {
      const data = result.data;
      window.floovonYazdirmaAyarlar = {
        ...data,
        is_active: data.is_active === undefined ? true : Boolean(data.is_active),
        logo_png_url: resolvePrintLogoUrl(data.logo_png_url || data.logo_png_path)
      };
      return window.floovonYazdirmaAyarlar;
    }
  } catch (error) {
    console.error('❌ Yazdırma ayarları alınamadı:', error);
  }
  return null;
}

// getFloovonPrintLogoMarkup fonksiyonu artık script.js'de tanımlı

// Moment.js Türkçe locale'ini ayarla (eğer yüklüyse)
if (typeof moment !== 'undefined') {
    moment.locale('tr');
}

// Hafta günlerini hesaplama fonksiyonu (dinamik kartlarla uyumlu)
function getWeekDays(haftaDegeri) {
    if (!haftaDegeri || !haftaDegeri.includes('-W')) return [];

    const [yil, hafta] = haftaDegeri.split("-W").map(Number);
    const ilkGun = new Date(yil, 0, 1);
    const gunOffset = ((ilkGun.getDay() + 6) % 7); // Pazartesi'yi 0 kabul eden sistem
    const haftaninIlkGunu = new Date(yil, 0, 1 + (hafta - 1) * 7 - gunOffset);

    const gunler = [];
    for (let i = 0; i < 7; i++) {
        const gun = new Date(haftaninIlkGunu);
        gun.setDate(haftaninIlkGunu.getDate() + i);
        // Dinamik kartlarda kullanılan format: "04-10-2025"
        const day = gun.getDate().toString().padStart(2, '0');
        const month = (gun.getMonth() + 1).toString().padStart(2, '0');
        const year = gun.getFullYear();
        const formattedDate = `${day}-${month}-${year}`;
        gunler.push(formattedDate);
    }

    return gunler;
}

// #region Index Sayfadaki Sipariş Listesini Dışa Aktar > Yazdır Fonksiyonu
async function yazdirIndexSiparisleri() {
  // Moment.js kontrolü
  if (typeof moment === 'undefined') {
    console.error('❌ Moment.js yüklenmemiş, yazdırma işlemi yapılamıyor');
    if (typeof createToast === 'function') {
      createToast('error', 'Yazdırma için gerekli kütüphane yüklenmemiş');
    }
    return;
  }

  const weekPicker = document.getElementById("weekPicker");
  
  if (!weekPicker || !weekPicker.value) {
    console.warn('⚠️ weekPicker bulunamadı veya değer yok');
    return;
  }
  const selectedWeek = weekPicker.value;
  
  // getWeekDays fonksiyonunu inline olarak yaz (disa-aktar-handler-new.js'den)
  const [yil, hafta] = selectedWeek.split('-W').map(Number);
  const ilkGun = new Date(yil, 0, 1);
  const gunOffset = ((ilkGun.getDay() + 6) % 7);
  const haftaninIlkGunu = new Date(yil, 0, 1 + (hafta - 1) * 7 - gunOffset);
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
      const gun = new Date(haftaninIlkGunu);
      gun.setDate(haftaninIlkGunu.getDate() + i);
      const day = gun.getDate().toString().padStart(2, '0');
      const month = (gun.getMonth() + 1).toString().padStart(2, '0');
      const year = gun.getFullYear();
      const formattedDate = `${day}-${month}-${year}`;
      weekDays.push(formattedDate);
  }

  const haftaninIlkGunuFormatted = moment(weekDays[0], "DD-MM-YYYY").format("DD.MM.YYYY dddd");
  const haftaninSonGunuFormatted = moment(weekDays[6], "DD-MM-YYYY").format("DD.MM.YYYY dddd");

  const tarihBilgisiYazisi = `
    <span class="tarih-vurgulu">${haftaninIlkGunuFormatted}</span> ile 
    <span class="tarih-vurgulu">${haftaninSonGunuFormatted}</span> tarihleri arasındaki siparişler.
  `;

  let siparisKartlari = Array.from(document.querySelectorAll('.siparis-kart'))
    .filter(card => {
      const parentItem = card.closest('.item') || card.closest('.ana-kart');
      if (!parentItem || parentItem.style.display === 'none') return false;

      const tarihText = parentItem.querySelector('.teslim-zaman .tarih')?.innerText.trim();
      
      // Dinamik kartlarda tarih formatı farklı olabilir, normalize et
      let normalizedTarih = tarihText;
      if (tarihText && tarihText.includes(' ')) {
        // "04 Ekim 2025 Cumartesi" formatını "04-10-2025" formatına çevir
        try {
          // Türkçe ay isimlerini İngilizce'ye çevir
          const turkishMonths = {
            'Ocak': 'January', 'Şubat': 'February', 'Mart': 'March', 'Nisan': 'April',
            'Mayıs': 'May', 'Haziran': 'June', 'Temmuz': 'July', 'Ağustos': 'August',
            'Eylül': 'September', 'Ekim': 'October', 'Kasım': 'November', 'Aralık': 'December'
          };
          
          // Gün isimlerini kaldır (sadece tarih kısmını al)
          let cleanDate = tarihText.replace(/\s+(Pazartesi|Salı|Çarşamba|Perşembe|Cuma|Cumartesi|Pazar)$/, '');
          
          // Türkçe ay isimlerini İngilizce'ye çevir
          let englishDate = cleanDate;
          for (const [turkish, english] of Object.entries(turkishMonths)) {
            englishDate = englishDate.replace(turkish, english);
          }
          
          const date = new Date(englishDate);
          normalizedTarih = date.toLocaleDateString('tr-TR').replace(/\./g, '-');
        } catch (e) {
          console.warn('⚠️ Tarih parse hatası:', tarihText, e);
        }
      }
      
      const kartTurEl = parentItem.querySelector('.kart-tur');
let kartTur = "";

if (kartTurEl) {
  if (kartTurEl.querySelector("img")) {
    // img varsa alt veya src al
    kartTur = kartTurEl.querySelector("img").alt || kartTurEl.querySelector("img").src;
  } else {
    // metin varsa text al
    kartTur = kartTurEl.innerText.trim();
  }
}

      const isMatch = normalizedTarih && weekDays.includes(normalizedTarih) && kartTur !== 'Araç Süsleme';

      return isMatch;
    });

siparisKartlari.sort((a, b) => {
  const itemA = a.closest('.item') || a.closest('.ana-kart');
  const itemB = b.closest('.item') || b.closest('.ana-kart');

  const tarihA = itemA.querySelector('.tarih')?.innerText.trim() || '';
  const tarihB = itemB.querySelector('.tarih')?.innerText.trim() || '';
  
  // Tarih formatını normalize et
  let normalizedTarihA = tarihA;
  let normalizedTarihB = tarihB;
  
  if (tarihA && tarihA.includes(' ')) {
    try {
      const dateA = new Date(tarihA);
      normalizedTarihA = dateA.toLocaleDateString('tr-TR').replace(/\./g, '-');
    } catch (e) {}
  }
  
  if (tarihB && tarihB.includes(' ')) {
    try {
      const dateB = new Date(tarihB);
      normalizedTarihB = dateB.toLocaleDateString('tr-TR').replace(/\./g, '-');
    } catch (e) {}
  }

  const saatA = a.querySelector('.saat-icerik')?.innerText.replace('Saat', '').trim() || '';
  const saatB = b.querySelector('.saat-icerik')?.innerText.replace('Saat', '').trim() || '';

  const mahalleA = itemA.querySelector('.konum')?.innerText.trim().toLowerCase() ||
    a.querySelector('.mahalle')?.innerText.trim().toLowerCase() || '';
  const mahalleB = itemB.querySelector('.konum')?.innerText.trim().toLowerCase() ||
    b.querySelector('.mahalle')?.innerText.trim().toLowerCase() || '';

  // ✅ Kart türünü alırken hem text hem img kontrolü
  const kartTurAEl = itemA.querySelector('.kart-tur');
  const kartTurBEl = itemB.querySelector('.kart-tur');

  const kartTurA = kartTurAEl?.querySelector("img")?.alt?.toLowerCase() 
                || kartTurAEl?.querySelector("img")?.src?.toLowerCase() 
                || kartTurAEl?.innerText.trim().toLowerCase() 
                || '';

  const kartTurB = kartTurBEl?.querySelector("img")?.alt?.toLowerCase() 
                || kartTurBEl?.querySelector("img")?.src?.toLowerCase() 
                || kartTurBEl?.innerText.trim().toLowerCase() 
                || '';

  if (normalizedTarihA < normalizedTarihB) return -1;
  if (normalizedTarihA > normalizedTarihB) return 1;
  if (saatA < saatB) return -1;
  if (saatA > saatB) return 1;
  if (mahalleA < mahalleB) return -1;
  if (mahalleA > mahalleB) return 1;
  if (kartTurA < kartTurB) return -1;
  if (kartTurA > kartTurB) return 1;
  return 0;
});


  const currentDate = new Date().toLocaleDateString("tr-TR", {
    day: "2-digit", month: "long", year: "numeric"
  });

  const logoMarkup = await (window.getFloovonPrintLogoMarkup ? window.getFloovonPrintLogoMarkup() : '');

  let yazdirHtml = generateIndexPrintHTML(tarihBilgisiYazisi, logoMarkup, siparisKartlari);

  const printTitle = typeof moment !== 'undefined' && moment 
    ? `Sipariş Teslim Listesi – ${moment().format("DD MMMM YYYY dddd")}`
    : `Sipariş Teslim Listesi – ${new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: '2-digit' })}`;
  
  openPrintWindow(yazdirHtml, printTitle, tarihBilgisiYazisi);
}

function generateIndexPrintHTML(tarihBilgisiYazisi, logoMarkup, siparisKartlari) {
  // Moment.js kontrolü ile format yardımcı fonksiyonu
  const formatDate = (format) => {
    if (typeof moment !== 'undefined' && moment) {
      return moment().format(format);
    }
    // Fallback: Basit format
    const d = new Date();
    if (format.includes('DD MMMM YYYY dddd')) {
      return d.toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: '2-digit' });
    }
    if (format.includes('DD MMMM YYYY • HH:mm')) {
      return d.toLocaleString('tr-TR', { year: 'numeric', month: 'long', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleString('tr-TR');
  };

  let yazdirHtml = `
     <html>
<head>
<title>Sipariş Teslim Listesi – ${formatDate('DD MMMM YYYY dddd')}</title>
<style>
${getIndexPrintStyles()}
</style>
</head>
<body>
<div class="header">
<div class="logo-container">${logoMarkup || ''}</div>
<h1>Sipariş Teslim Listesi</h1>
</div>
<div class="ust-ikinci-satir">
<div class="yazdirma-ust-bilgi-alan">
Yazdırılma zamanı: ${formatDate('DD MMMM YYYY • HH:mm')}
<div class="tarih-bilgi-yazisi">
  ${tarihBilgisiYazisi}
</div>
</div>
  <div class="siparis-sayisi-box">
  <div class="siparis-sayisi-label">Toplam Sipariş Sayısı</div>
  <div class="siparis-sayisi-value">${siparisKartlari.length}</div>
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

  let oncekiGrupKey = '';
  let sira = 1;

// #region Kart Türü Yardımcı Fonksiyonu
function getKartTur(el) {
  if (!el) return '';
  const img = el.querySelector("img");
  if (img) {
    const alt = img.getAttribute("alt")?.trim() || "logo";
    const src = img.getAttribute("src")?.trim();
if (src) {
  return `<img src="${src}" alt="${alt}" />`;
}

  }
  return el.innerText.trim();
}

// #endregion

siparisKartlari.forEach((card, index) => {
  const item = card.closest('.item');
  const anaKart = item.querySelector('.ana-kart');

  const kartTur = getKartTur(item.querySelector('.kart-tur'));
  const tarih = item.querySelector('.tarih')?.innerText.replace(/\s+/g, ' ').trim() || '';
  const saat = anaKart.classList.contains('organizasyon')
    ? item.querySelector('.saat-icerik')?.innerText.replace('Saat', '').trim() || ''
    : card.querySelector('.saat-icerik')?.innerText.replace('Saat', '').trim() || '';

  const urun = card.querySelector('.siparis-urun')?.innerText.trim() || '';
  const siparisVeren = card.querySelector('.siparis-veren')?.innerText.trim() || '';
  const urunYazisi = card.querySelector('.urun-yazisi')?.innerText.trim() || '';

  let teslimEdilecekKisi = '';
  let teslimEdilenTelefon = '';

  if (anaKart.classList.contains('organizasyon')) {
    teslimEdilecekKisi = item.querySelector('.teslim-kisisi')?.innerText.trim() || '';
    teslimEdilenTelefon = item.querySelector('.teslim-kisisi-telefon a')?.textContent.trim() || '';
  } else {
    teslimEdilecekKisi = card.querySelector('.teslim-kisisi')?.innerText.trim() || '';
    teslimEdilenTelefon = card.querySelector('.teslim-kisisi-telefon a')?.textContent.trim() || '';
  }

  const teslimEdilecekKisiHtml = `
    <div>${teslimEdilecekKisi}</div>
    <div class="telefon">${teslimEdilenTelefon}</div>
  `;

  let mahalle = '', adres = '';
  if (anaKart.classList.contains('organizasyon')) {
    mahalle = item.querySelector('.konum')?.innerText.trim()
      || item.querySelector('.mahalle')?.innerText.trim()
      || '';
    adres = item.querySelector('.acik-adres')?.innerText.trim() || '';
  } else {
    mahalle = card.querySelector('.mahalle')?.innerText.trim() || '';
    adres = card.querySelector('.acik-adres')?.innerText.trim() || '';
  }

  const grupKey = `${mahalle.toLowerCase()}|${tarih}`;
  if (grupKey !== oncekiGrupKey) {
    const grupSiparisSayisi = siparisKartlari.filter(c => {
      const itm = c.closest('.item');
      const ak = itm.querySelector('.ana-kart');
      const mhl = ak.classList.contains('organizasyon')
        ? itm.querySelector('.konum')?.innerText.trim()
        || itm.querySelector('.mahalle')?.innerText.trim()
        || ''
        : c.querySelector('.mahalle')?.innerText.trim() || '';

      const trh = itm.querySelector('.tarih')?.innerText.replace(/\s+/g, ' ').trim() || '';

      return `${mhl.toLowerCase()}|${trh}` === grupKey;
    }).length;

    yazdirHtml += `
    <tbody class="page-break-group">
    <tr>
      <td colspan="9">
        <div class="grup-baslik">
          <div class="grup-info">
            <span class="grup-tarih">${tarih}</span>
            <span class="grup-separator">•</span>
            <span class="grup-mahalle">${mahalle}</span>
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

  yazdirHtml += `<tr>
    <td class="col-checkbox"><input type="checkbox" class="print-checkbox" /></td>
    <td class="col-sira-no">${sira++}</td>
    <td class="tarih col-teslim-tarihi">${tarih}</td>
    <td class="saat-icerik col-saat">${saat}</td>
    <td class="kart-tur col-kart-tur">${kartTur}</td>
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
        <span class="mahalle">${mahalle}</span>
        <span class="adres">${adres}</span>
      </div>
    </td>
  </tr>`;
});


  yazdirHtml += `
</tbody>
</table>
</body>
</html>`;

  return yazdirHtml;
}

// #endregion

// #region Index sayfası Excel Aktarım Fonksiyonu (Yazdır penceresi olmadan)
function indexExcelExport() {
  // Moment.js kontrolü
  if (typeof moment === 'undefined') {
    console.error('❌ Moment.js yüklenmemiş, Excel aktarımı yapılamıyor');
    if (typeof createToast === 'function') {
      createToast('error', 'Excel aktarımı için gerekli kütüphane yüklenmemiş');
    }
    return;
  }

  const weekPicker = document.getElementById("weekPicker");
  if (!weekPicker || !weekPicker.value) {
    console.warn('⚠️ weekPicker bulunamadı veya değer yok');
    return;
  }
  const selectedWeek = weekPicker.value;
  
  // getWeekDays fonksiyonunu inline olarak yaz (disa-aktar-handler-new.js'den)
  const [yil, hafta] = selectedWeek.split('-W').map(Number);
  const ilkGun = new Date(yil, 0, 1);
  const gunOffset = ((ilkGun.getDay() + 6) % 7);
  const haftaninIlkGunu = new Date(yil, 0, 1 + (hafta - 1) * 7 - gunOffset);
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
      const gun = new Date(haftaninIlkGunu);
      gun.setDate(haftaninIlkGunu.getDate() + i);
      const day = gun.getDate().toString().padStart(2, '0');
      const month = (gun.getMonth() + 1).toString().padStart(2, '0');
      const year = gun.getFullYear();
      const formattedDate = `${day}-${month}-${year}`;
      weekDays.push(formattedDate);
  }

  const haftaninIlkGunuFormatted = moment(weekDays[0], "DD-MM-YYYY").format("DD.MM.YYYY dddd");
  const haftaninSonGunuFormatted = moment(weekDays[6], "DD-MM-YYYY").format("DD.MM.YYYY dddd");

  const tarihBilgisiYazisi = `
    <span class="tarih-vurgulu">${haftaninIlkGunuFormatted}</span> ile 
    <span class="tarih-vurgulu">${haftaninSonGunuFormatted}</span> tarihleri arasındaki siparişler.
  `;

  const siparisKartlari = Array.from(document.querySelectorAll('.siparis-kart'))
    .filter(card => {
      const parentItem = card.closest('.item') || card.closest('.ana-kart');
      if (!parentItem || parentItem.style.display === 'none') return false;

      const tarihText = parentItem.querySelector('.teslim-zaman .tarih')?.innerText.trim();
      // Dinamik kartlarda tarih formatı farklı olabilir, normalize et
      let normalizedTarih = tarihText;
      if (tarihText && tarihText.includes(' ')) {
        // "04 Ekim 2025 Cumartesi" formatını "04-10-2025" formatına çevir
        try {
          const date = new Date(tarihText);
          normalizedTarih = date.toLocaleDateString('tr-TR').replace(/\./g, '-');
        } catch (e) {
          // Hata durumunda orijinal metni kullan
        }
      }
      
      const kartTurEl = parentItem.querySelector('.kart-tur');
      let kartTur = "";

      if (kartTurEl) {
        if (kartTurEl.querySelector("img")) {
          // img varsa alt veya src al
          kartTur = kartTurEl.querySelector("img").alt || kartTurEl.querySelector("img").src;
        } else {
          // metin varsa text al
          kartTur = kartTurEl.innerText.trim();
        }
      }

      return (
        normalizedTarih && weekDays.includes(normalizedTarih) &&
        kartTur !== 'Araç Süsleme'
      );
    });

  let yazdirHtml = generateIndexPrintHTML(tarihBilgisiYazisi, '', siparisKartlari);

  let excelHtml = yazdirHtml.replace(/<style>[\s\S]*?<\/style>/, '');

  excelHtml = excelHtml.replace(
    /<table([^>]*)>/,
    `<table$1 border="1" style="border-collapse: collapse; border: 1px solid #000;">`
  );

  excelHtml = excelHtml
    .replace(/<th([^>]*)>/g, `<th$1 style="border:1px solid #000; padding: 6px;">`)
    .replace(/<td([^>]*)>/g, `<td$1 style="border:1px solid #000; padding: 6px;">`);

  const tarihBaslik = document.querySelector(".baslik-tarih")?.innerText.trim() || '';
  const temizTarih = tarihBaslik
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]/g, '');

  const fileName = `Sipariş Teslim Listesi - ${temizTarih}.xls`;

  const blob = new Blob(['\ufeff' + excelHtml], {
    type: 'application/vnd.ms-excel'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
// #endregion

// -------------------------------------

// #region Tüm Sayfalardaki Dışa Aktar > Yazdır Fonksiyonu

// Çift yazdırmayı önlemek için flag
// ÖNEMLİ: Window'a kaydet ki tekrar yüklemede hata vermesin
if (typeof window.isHandleTablePrintRunning === 'undefined') {
    window.isHandleTablePrintRunning = false;
}
var isHandleTablePrintRunning = window.isHandleTablePrintRunning;

function handleTablePrint(yazdirBtn) {
  // NOT: Flag event listener seviyesinde set ediliyor ve kontrol ediliyor
  // Bu fonksiyon sadece yazdırma işlemini gerçekleştiriyor, flag kontrolü YOK
  // Çünkü event listener zaten flag kontrolü yapıyor ve sadece flag set edilmemişse buraya geliyor
  
  // Yakındaki tabloya veya belirtilen hedefe bakıyoruz
  // ÖNEMLİ: getAttribute kullan - dataset bazen çalışmıyor
  const targetSelector = yazdirBtn?.getAttribute('data-target') || yazdirBtn?.dataset?.target;
  let exportTarget;

  if (targetSelector) {
    exportTarget = document.querySelector(targetSelector);
  } else {
    // En yakın tabloyu bul
    exportTarget = yazdirBtn?.closest('.tablo-wrapper')?.querySelector('table') ||
      document.querySelector('table[id$="-tablo-export"]') ||
      document.querySelector('.table-responsive table') ||
      document.querySelector('table');
  }

  if (!exportTarget) {
    console.error('🚨 Yazdırma Hatası: Yazdırılacak tablo bulunamadı.');
    if (typeof createToast === 'function') {
      createToast('error', 'Yazdırılacak tablo bulunamadı.');
    }
    // Hata durumunda flag'i sıfırla
    setTimeout(() => { 
        isHandleTablePrintRunning = false;
        window.isHandleTablePrintRunning = false;
    }, 100);
    return;
  }

  const pageHandler = typeof window.getPageExportHandler === 'function'
    ? window.getPageExportHandler()
    : null;

  // Flag'i sıfırlama fonksiyonu
  const resetFlag = () => {
    setTimeout(() => {
      isHandleTablePrintRunning = false;
      window.isHandleTablePrintRunning = false;
      // Buton seviyesinde flag'i de sıfırla
      if (yazdirBtn && yazdirBtn.dataset) {
        yazdirBtn.dataset.printing = 'false';
      }
        }, 2000); // 2 saniye bekle (yazdır dialog'unun kapanması için yeterli süre)
  };
  
  if (pageHandler?.print) {
    pageHandler.print(exportTarget);
    resetFlag();
    return;
  }

  if (typeof window.defaultPrintHandler === 'function') {
    window.defaultPrintHandler(exportTarget);
    resetFlag();
    return;
  }

  // Fallback: defaultPrintHandler fonksiyonunu direkt çağır (eğer tanımlıysa)
  if (typeof defaultPrintHandler === 'function') {
    defaultPrintHandler(exportTarget);
    resetFlag();
    return;
  }

  console.error('❌ Print handler fonksiyonu bulunamadı');
  resetFlag();
}

function handleTableExcel(targetOrButton) {
  let exportTarget = null;

  if (targetOrButton instanceof HTMLElement) {
    if (targetOrButton.tagName === 'TABLE') {
      exportTarget = targetOrButton;
    } else {
      // ÖNEMLİ: getAttribute kullan - dataset bazen çalışmıyor
      const targetSelector = targetOrButton.getAttribute('data-target') || targetOrButton.dataset?.target;
      if (targetSelector) {
        exportTarget = document.querySelector(targetSelector);
      }
      if (!exportTarget) {
        exportTarget = targetOrButton.closest('.tablo-wrapper')?.querySelector('table');
      }
    }
  } else if (targetOrButton && typeof targetOrButton === 'string') {
    exportTarget = document.querySelector(targetOrButton);
  }

  if (!exportTarget) {
    exportTarget = document.querySelector('table[id$="-tablo-export"]') ||
      document.querySelector('.table-responsive table') ||
      document.querySelector('table');
  }

  if (!exportTarget) {
    console.error('🚨 Dışa Aktarım Hatası: Dışa aktarılacak tablo bulunamadı.');
    if (typeof createToast === 'function') {
      createToast('error', 'Dışa aktarılacak tablo bulunamadı.');
    }
    return;
  }

  const pageHandler = typeof window.getPageExportHandler === 'function'
    ? window.getPageExportHandler()
    : null;

  if (pageHandler?.exportExcel) {
    pageHandler.exportExcel(exportTarget);
    return;
  }

  if (typeof window.defaultExcelHandler === 'function') {
    window.defaultExcelHandler(exportTarget);
    return;
  }

  defaultExcelHandler(exportTarget);
}

async function defaultPrintHandler(content) {
  try {
    const clonedContent = content.cloneNode(true);

  // İŞLEM kolonunu kaldır
  let islemIndex = -1;
  clonedContent.querySelectorAll("th").forEach((th, idx) => {
    const metin = th.textContent.trim().toUpperCase();
    if (metin === "İŞLEM" && islemIndex === -1) {
      const parentTr = th.closest("tr");
      if (parentTr) {
        islemIndex = Array.from(parentTr.children).indexOf(th);
        th.remove();
      }
    }
  });

  if (islemIndex !== -1) {
    clonedContent.querySelectorAll("tr").forEach(tr => {
      const tds = tr.querySelectorAll("td");
      if (tds.length > islemIndex && tds[islemIndex]) {
        tds[islemIndex].remove();
      }
    });
  }

  // Kampanya Mesajı tooltip içeriklerini hücreye basma
  clonedContent.querySelectorAll('.mesaj-cell').forEach(cell => {
    const tooltipText = cell.getAttribute('data-tooltip') || '';
    cell.innerHTML = tooltipText;
  });

  const pathname = window.location.pathname;
  const tableTitle = content.getAttribute("data-title")?.trim() ||
    document.querySelector(`a[data-target="#${content.id}"]`)?.closest(".tablo-header")?.querySelector(".tablo-baslik")?.innerText?.trim() ||
    "Rapor";

  const musteriUnvani = pathname.includes("musteriler-cari")
    ? document.querySelector(".musteri-unvan")?.innerText.trim() || ""
    : "";

  // Belirli tabloların özel işlemleri
  if (content.id === "musteriler-tablo-export") {
    clonedContent.querySelectorAll(".satir-mustericarikarti").forEach(el => el.remove());
  }

  if (content.id === "musterifaturalar-tablo-export") {
    removeColumnByHeader(clonedContent, 'FATURA İŞLEMLERİ');
  }

  if (content.id === "partnerfirmalar-tablo-export") {
    clonedContent.querySelectorAll(".satir-partnercarikarti").forEach(el => el.remove());
  }

  // Sipariş detay tablosu için sadece belirli kolonları göster
  if (content.id === "siparisdetay-tablo-export") {
    const headerRow = clonedContent.querySelector("tr");
    if (!headerRow) {
      return;
    }
    
    // Organizasyon türünü tespit et
    const orgTur = document.querySelector(".org-tur")?.innerText.trim() || "";
    const orgTurLower = orgTur.toLowerCase();
    const isAracSusleme = orgTurLower.includes('araç') || orgTurLower.includes('arac') || orgTurLower.includes('süsleme') || orgTurLower.includes('susleme');
    const isOzelSiparis = orgTurLower.includes('özel sipariş') || orgTurLower.includes('ozel siparis');
    const isOzelGun = orgTurLower.includes('özel gün') || orgTurLower.includes('ozel gun');
    
    const headers = Array.from(headerRow.querySelectorAll("th"));
    
    // Class name'leri kullanarak daha güvenilir kontrol
    // Organizasyon türüne göre saat kolonunu belirle
    let allowedClasses = ["th-sp-no", "th-siparis-urun", "th-musteri-ve-urun-yazisi", "th-partner"];
    
    if (isAracSusleme) {
      // Araç süsleme için randevu saati kolonunu ekle
      allowedClasses.push("th-randevu-saati");
      // Randevu saati kolonunu görünür yap
      const randevuSaatiTh = clonedContent.querySelector(".th-randevu-saati");
      if (randevuSaatiTh) {
        randevuSaatiTh.style.display = "";
      }
      // Tüm satırlardaki randevu saati hücrelerini görünür yap
      clonedContent.querySelectorAll(".td-randevu-saati").forEach(td => {
        td.style.display = "";
      });
    } else if (isOzelSiparis || isOzelGun) {
      // Özel sipariş / Özel gün için teslim saati kolonunu ekle
      allowedClasses.push("th-teslim-saati");
      // Teslim saati kolonunu görünür yap
      const teslimSaatiTh = clonedContent.querySelector(".th-teslim-saati");
      if (teslimSaatiTh) {
        teslimSaatiTh.style.display = "";
      }
      // Tüm satırlardaki teslim saati hücrelerini görünür yap
      clonedContent.querySelectorAll(".td-teslim-saati").forEach(td => {
        td.style.display = "";
      });
    } else {
      // Organizasyon (düğün, sünnet vb.) için teslim saati kolonu YOK
      // Bu organizasyon türlerinde teslim saati kolonu gösterilmez
    }
    
    // Çiçek Sepeti siparişleri için PARTNER SİPARİŞİ kolonunu kontrol et
    const hasPartnerCells = clonedContent.querySelectorAll("td.td-partner").length > 0;
    const finalAllowedClasses = hasPartnerCells 
      ? allowedClasses 
      : allowedClasses.filter(cls => cls !== "th-partner");
    
    // Kaldırılacak kolonların class'larını belirle
    const classesToRemove = new Set();
    
    // Tüm header'ları kontrol et
    headers.forEach((th) => {
      const thClass = Array.from(th.classList).find(cls => cls.startsWith('th-'));
      if (thClass) {
        const hasAllowedClass = finalAllowedClasses.some(className => th.classList.contains(className));
        if (!hasAllowedClass) {
          // Bu kolonu kaldır
          classesToRemove.add(thClass);
        }
      }
    });
    
    // İşlem kolonunu kesinlikle kaldır
    classesToRemove.add("th-islem");
    
    // Tüm satırları al (header dahil)
    const allRows = Array.from(clonedContent.querySelectorAll("tr"));
    
    // Her satır için, kaldırılacak kolonları index'e göre kaldır
    allRows.forEach(row => {
      const cells = Array.from(row.querySelectorAll("th, td"));
      const cellsToRemove = [];
      
      cells.forEach((cell, index) => {
        // Header satırı için
        if (cell.tagName === 'TH') {
          const thClass = Array.from(cell.classList).find(cls => cls.startsWith('th-'));
          if (thClass && classesToRemove.has(thClass)) {
            cellsToRemove.push(index);
          }
        }
        // Data satırları için
        else if (cell.tagName === 'TD') {
          const tdClass = Array.from(cell.classList).find(cls => cls.startsWith('td-'));
          // id="islem" olan hücreleri de kaldır
          if (cell.id === 'islem') {
            cellsToRemove.push(index);
          } else if (tdClass) {
            const thClass = tdClass.replace('td-', 'th-');
            if (classesToRemove.has(thClass)) {
              cellsToRemove.push(index);
            }
          }
        }
      });
      
      // Sondan başa doğru kaldır (index kaymasını önlemek için)
      cellsToRemove.sort((a, b) => b - a).forEach(index => {
        if (cells[index]) {
          cells[index].remove();
        }
      });
    });
  }

  let detayEkAlanlar = getDetailExtraFields(content.id);

  const currentDate = new Date().toLocaleDateString("tr-TR", {
    day: "2-digit", month: "long", year: "numeric"
  });

  // Logo markup'ı al
  let logoMarkup = '';
  try {
    // Önce script.js'deki fonksiyonu dene
    if (typeof window.getFloovonPrintLogoMarkup === 'function') {
      logoMarkup = await window.getFloovonPrintLogoMarkup();
    } else {
      // Fallback: disa-aktar-handler.js'deki kendi fonksiyonunu kullan
      const ayarlar = await ensureYazdirmaAyarlarYuklendi();
      if (ayarlar && ayarlar.is_active !== false) {
        const logoUrl = ayarlar.logo_png_url || resolvePrintLogoUrl(ayarlar.logo_png_path);
        if (logoUrl) {
          logoMarkup = `<img src="${logoUrl}" alt="Yazdırma Logosu" style="max-height:60px; width:auto; display:block;">`;
        } else {
          console.warn('⚠️ Logo URL bulunamadı');
        }
      } else {
        console.warn('⚠️ Yazdırma logosu aktif değil veya ayarlar yüklenemedi');
      }
    }
  } catch (error) {
    console.error('❌ Logo yüklenirken hata:', error);
  }

    const tablePrintHTML = generateTablePrintHTML(tableTitle, currentDate, musteriUnvani, detayEkAlanlar, clonedContent, logoMarkup);

    openPrintWindow(tablePrintHTML, `${tableTitle} – ${currentDate}`);
  } catch (error) {
    console.error('❌ defaultPrintHandler hatası:', error);
    throw error;
  }
}

// Global erişim için window'a ekle
window.defaultPrintHandler = defaultPrintHandler;

function removeColumnByHeader(tableElement, headerText) {
  if (!tableElement) return;

  const headers = Array.from(tableElement.querySelectorAll('th'));
  if (!headers.length) return;

  const normalizedTarget = headerText.trim().toUpperCase();
  let columnIndex = -1;

  headers.some((th, idx) => {
    const normalizedHeader = th.textContent.trim().toUpperCase();
    if (normalizedHeader === normalizedTarget) {
      columnIndex = idx;
      th.remove();
      return true;
    }
    return false;
  });

  if (columnIndex === -1) return;

  tableElement.querySelectorAll('tr').forEach(tr => {
    const cells = tr.querySelectorAll('td');
    if (cells.length > columnIndex && cells[columnIndex]) {
      cells[columnIndex].remove();
    }
  });
}

function generateTablePrintHTML(tableTitle, currentDate, musteriUnvani, detayEkAlanlar, clonedContent, logoMarkup = '') {
  return `
    <html>
      <head>
        <title>${tableTitle} – ${currentDate}</title>
        <style>
        ${getTablePrintStyles()}
        .tarih-alti-not {
          margin-top: 8px;
          padding: 4px 8px;
          background-color: #fff59d;
          color: #000;
          font-size: 11px;
          font-weight: 500;
          display: inline-block;
        }
        </style>
      </head>
      <body>
        <div class="print-header">
          <div>
            <div class="title">${tableTitle}</div>
            <div class="date">Yazdırılma Tarihi: ${currentDate}</div>
            ${musteriUnvani ? `<div class="subinfo">Müşteri: ${musteriUnvani}</div>` : ""}
            ${detayEkAlanlar}
          </div>
          <div class="logo-container">
            ${logoMarkup || ''}
          </div>
        </div>
        ${clonedContent.outerHTML}
        <!-- NOT: window.print() çağrısı kaldırıldı - openPrintWindow fonksiyonu zaten print() çağırıyor -->
        <!-- Çift yazdırma sorununu önlemek için HTML içindeki print çağrısı kaldırıldı -->
      </body>
    </html>
  `;
}

function getDetailExtraFields(contentId) {
  let detayEkAlanlar = "";

  if (contentId === "satisraporlari-tablo-export") {
    const tarihAraligi = document.querySelector("#sorgu-tarih-araligi")?.innerText.trim() || "";
    const toplamIslem = document.querySelector("#toplam-islem")?.innerText.trim() || "";
    const toplamCiro = document.querySelector("#toplam-ciro")?.innerText.trim() || "";

    detayEkAlanlar = `
      ${tarihAraligi ? `<div class="subinfo"><strong>Tarih Aralığı:</strong> ${tarihAraligi}</div>` : ""}
      <div class="istatistik-bilgiler">
        ${toplamIslem ? `<div class="subinfo"><strong>Toplam İşlem: </strong> ${toplamIslem}</div>` : ""}
        ${toplamCiro ? `<div class="subinfo"><strong>Toplam Ciro: </strong> ${toplamCiro}</div>` : ""}
      </div>
    `;
  }

  if (contentId === "siparisdetay-tablo-export") {
    const orgTur = document.querySelector(".org-tur")?.innerText.trim() || "";
    const orgTurLower = orgTur.toLowerCase();
    const etiket = document.querySelector(".org-adres-bilgileri .kart-etiket")?.innerText.trim() || "";
    const konum = document.querySelector(".org-adres-bilgileri .konum")?.innerText.trim() || "";
    const acikAdres = document.querySelector(".org-adres-bilgileri .acik-adres")?.innerText.trim() || "";
    let ilceIl = document.querySelector(".org-adres-bilgileri .ilce-il")?.innerText.trim() || "";
    if (ilceIl) {
        ilceIl = ilceIl.replace(/\s*\/\s*/g, '/');
    }
    const adresBilgisi = [acikAdres, ilceIl].filter(Boolean).join(", ") || "";
    const isim = document.querySelector(".sahip-ve-zaman .isim-soyisim")?.innerText.trim() || "";
    const telefon = document.querySelector(".sahip-ve-zaman .telefon")?.innerText.trim() || "";
    const tarih = document.querySelector(".teslim-zaman .tarih")?.innerText.trim() || "";
    const saatEl = document.querySelector(".teslim-zaman .saat");
    const saatNode = saatEl ? saatEl.cloneNode(true) : null;
    if (saatNode) saatNode.querySelectorAll("span").forEach(s => s.remove());
    const saatText = saatNode ? saatNode.textContent.trim() : "";

    // Organizasyon türüne göre farklı alanlar göster
    const isAracSusleme = orgTurLower.includes('araç') || orgTurLower.includes('arac') || orgTurLower.includes('süsleme') || orgTurLower.includes('susleme');
    const isOzelSiparis = orgTurLower.includes('özel sipariş') || orgTurLower.includes('ozel siparis');
    const isOzelGun = orgTurLower.includes('özel gün') || orgTurLower.includes('ozel gun');
    const isOrganizasyon = !isAracSusleme && !isOzelSiparis && !isOzelGun;

    if (isAracSusleme) {
      // Araç Süsleme: Organizasyon Türü, Etiket, Randevu Tarihi + Not
      detayEkAlanlar = `
        ${orgTur ? `<div class="subinfo"><span class="label">Organizasyon Türü:</span><span class="value">${orgTur}</span></div>` : ""}
        ${etiket ? `<div class="subinfo"><span class="label">Etiket:</span><span class="value">${etiket}</span></div>` : ""}
        ${tarih ? `<div class="subinfo"><span class="label">Randevu Tarihi:</span><span class="value">${tarih}</span></div>` : ""}
        <div class="tarih-alti-not">Araç süsleme randevu saatleri için ilgili siparişin randevu saatini dikkate alınız.</div>
      `;
    } else if (isOzelSiparis || isOzelGun) {
      // Özel Sipariş / Özel Gün: Organizasyon Türü, Etiket, Teslim Tarihi + Not
      detayEkAlanlar = `
        ${orgTur ? `<div class="subinfo"><span class="label">Organizasyon Türü:</span><span class="value">${orgTur}</span></div>` : ""}
        ${etiket ? `<div class="subinfo"><span class="label">Etiket:</span><span class="value">${etiket}</span></div>` : ""}
        ${tarih ? `<div class="subinfo"><span class="label">Teslim Tarihi:</span><span class="value">${tarih}</span></div>` : ""}
        <div class="tarih-alti-not">Siparişlerin teslim saatleri için ilgili siparişin teslim saatini dikkate alınız.</div>
      `;
    } else {
      // Organizasyon (düğün, sünnet vb.): Tüm alanlar
      detayEkAlanlar = `
        ${orgTur ? `<div class="subinfo"><span class="label">Organizasyon Türü:</span><span class="value">${orgTur}</span></div>` : ""}
        ${etiket ? `<div class="subinfo"><span class="label">Etiket:</span><span class="value">${etiket}</span></div>` : ""}
        ${konum ? `<div class="subinfo"><span class="label">Konumu:</span><span class="value">${konum}</span></div>` : ""}
        ${adresBilgisi ? `<div class="subinfo"><span class="label">Adres:</span><span class="value">${adresBilgisi}</span></div>` : ""}
        ${isim ? `<div class="subinfo"><span class="label">Teslim Kişisi:</span><span class="value">${isim}</span></div>` : ""}
        ${telefon ? `<div class="subinfo"><span class="label">İletişim Telefonu:</span><span class="value">${telefon}</span></div>` : ""}
        ${tarih ? `<div class="subinfo"><span class="label">Teslim Tarihi:</span><span class="value">${tarih}</span></div>` : ""}
        ${saatText ? `<div class="subinfo"><span class="label">Teslim Saati:</span><span class="value">${saatText}</span></div>` : ""}
      `;
    }
  }

  if (contentId === "partneralinansiparisler-tablo-export" || 
      contentId === "partnerverilensiparisler-tablo-export" || 
      contentId === "partnerodemevetahsilat-tablo-export") {
    // Partner bilgilerini doğru selector'larla al
    const partnerUnvanEl = document.getElementById('partner-unvan-cari');
    const partnerYetkiliEl = document.getElementById('partner-yetkili-cari');
    const bakiyeEl = document.getElementById('toplam-bakiye');
    
    const partnerUnvan = partnerUnvanEl?.textContent?.trim() || "";
    const partnerYetkili = partnerYetkiliEl?.textContent?.trim() || "";
    
    // Bakiye değerini al - sumbox içindeki span'den sonraki metni al
    let bakiye = "";
    if (bakiyeEl) {
      // İlk önce tüm text içeriğini al
      const allText = bakiyeEl.textContent || bakiyeEl.innerText || "";
      // "Bakiye" kelimesini ve gereksiz boşlukları temizle
      bakiye = allText.replace(/Bakiye/gi, "").replace(/\s+/g, " ").trim();
      
      // Alternatif: Clone yapıp span'i kaldırarak sadece değeri al
      if (!bakiye || bakiye === "") {
        const clone = bakiyeEl.cloneNode(true);
        const span = clone.querySelector('span');
        if (span) {
          span.remove();
        }
        bakiye = clone.textContent?.trim() || "";
      }
    }

    detayEkAlanlar = `
      ${partnerUnvan ? `<div class="subinfo">Partner Ünvanı: ${partnerUnvan}</div>` : ""}
      ${partnerYetkili ? `<div class="subinfo">Yetkili Kişi: ${partnerYetkili}</div>` : ""}
      ${bakiye ? `<div class="subinfo">Kalan Bakiye: ${bakiye}</div>` : ""}
    `;
  }

  return detayEkAlanlar;
}

// #endregion

// #region Tüm Sayfalardaki Dışa Aktar > Excel Fonksiyonu
function defaultExcelHandler(content) {
  const clonedContent = content.cloneNode(true);

  // Kampanya Mesajı tooltip içeriklerini hücreye basma
  clonedContent.querySelectorAll('.mesaj-cell').forEach(cell => {
      const tooltipText = cell.getAttribute('data-tooltip') || '';
      cell.innerHTML = tooltipText;
  });

  // Excel için temizlik işlemleri
  let islemIndex = -1;
  clonedContent.querySelectorAll("th").forEach((th, idx) => {
      const metin = th.textContent.trim().toUpperCase();
      if (metin === "İŞLEM" && islemIndex === -1) {
          const parentTr = th.closest("tr");
          if (parentTr) {
              islemIndex = Array.from(parentTr.children).indexOf(th);
              th.remove();
          }
      }
  });

  if (islemIndex !== -1) {
      clonedContent.querySelectorAll("tr").forEach(tr => {
          const tds = tr.querySelectorAll("td");
          if (tds.length > islemIndex && tds[islemIndex]) {
              tds[islemIndex].remove();
          }
      });
  }

  const tableTitle = content.getAttribute("data-title")?.trim() || "Rapor";
  const fileName = `${tableTitle} - ${new Date().toLocaleDateString('tr-TR')}.xls`;

  const blob = new Blob(['\ufeff' + clonedContent.outerHTML], {
      type: "application/vnd.ms-excel"
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
}

// #endregion

// #region Yardımcı Fonksiyonlar ve Bağlayıcılar

function waitForExportHandlerAndBind(retryCount = 20) {
  if (typeof window.getPageExportHandler === "function") {
    bindExportButtons();
  } else if (retryCount > 0) {
    setTimeout(() => waitForExportHandlerAndBind(retryCount - 1), 100);
  } else {
    console.warn("getPageExportHandler fonksiyonu bulunamadı.");
  }
}

function bindExportButtons() {
  // NOT: Bu fonksiyon artık kullanılmıyor - initDisaAktarSistemi event delegation kullanıyor
  // Çift/üçlü yazdırma sorununu önlemek için devre dışı bırakıldı
  return;
  
  // ESKİ KOD (devre dışı):
  // document.querySelectorAll(".buton-disa-aktar a[data-action]").forEach(link => {
  //   link.addEventListener("click", function (e) {
  //     e.preventDefault();
  //     const action = this.dataset.action;
  //     const targetSelector = this.dataset.target;
  //     if (!targetSelector) return console.error('🚨 Dışa Aktarım Hatası: Hedef tablo belirtilmemiş.');
  //     const exportTarget = document.querySelector(targetSelector);
  //     if (!exportTarget) return console.error('🚨 Dışa Aktarım Hatası: Aktarılacak içerik bulunamadı.');
  //     const handler = window.getPageExportHandler?.();
  //     if (!handler) return console.error('🚨 Dışa Aktarım Hatası: Dışa aktarım tanımlı değil.');
  //     if (action === "print" && handler.print) handler.print(exportTarget);
  //     else if (action === "excel" && handler.exportExcel) handler.exportExcel(exportTarget);
  //     else console.error('🚨 Dışa Aktarım Hatası: Bu işlem tanımlı değil.');
  //   });
  // });
}

// Global erişim için window'a ekle
window.defaultPrintHandler = defaultPrintHandler;
window.defaultExcelHandler = defaultExcelHandler;
window.handleTablePrint = handleTablePrint;
window.handleTableExcel = handleTableExcel;

function openPrintWindow(htmlContent, title, extraStyle = '') {
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
  document.body.appendChild(printFrame);
  
  // extraStyle varsa htmlContent'e ekle
  if (extraStyle) {
    const styleTag = `<style>
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
    </style>`;
    // style tag'ini head içine ekle
    if (htmlContent.includes('</head>')) {
      htmlContent = htmlContent.replace('</head>', styleTag + '</head>');
    } else if (htmlContent.includes('<head>')) {
      htmlContent = htmlContent.replace('<head>', '<head>' + styleTag);
    } else {
      htmlContent = styleTag + htmlContent;
    }
  }
  
  // HTML içeriğini iframe'e yaz (document.write yerine srcdoc kullan)
  printFrame.srcdoc = htmlContent;
  
  printFrame.onload = function() {
    try {
      // Yazdırma dialog'unu aç
      setTimeout(() => {
        printFrame.contentWindow.print();
        // Yazdırma tamamlandıktan sonra iframe'i kaldır
        printFrame.contentWindow.onafterprint = () => {
          setTimeout(() => {
            if (printFrame.parentNode) {
              document.body.removeChild(printFrame);
            }
          }, 100);
        };
        // Güvenlik için timeout ile kaldır
        setTimeout(() => {
          if (printFrame.parentNode) {
            document.body.removeChild(printFrame);
          }
        }, 5000);
      }, 100);
    } catch (error) {
      console.error('❌ Yazdırma hatası:', error);
      if (printFrame.parentNode) {
        document.body.removeChild(printFrame);
      }
    }
  };
}

function getInlineLogoSvg() {
  return '';
}

function getIndexPrintStyles() {
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

.kart-tur:has(img[alt="Çiçek Sepeti"]) {
  background: #ffe6f2; /* pembe */
}

.siparis-urun {
  font-style: normal;
  color: #000;
   line-height: 12px;
}

.teslim-kisisi {
  font-style: normal;
  color: #000;
  line-height: 12px;
  font-weight: bold;    
}

.col-teslim-kisisi .telefon {
  font-weight: normal;  
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
  font-weight: italic;
  color: #878787;
  font-size: 9px;
  font-weight: 600;
  line-height: 12px;
}

.siparis-veren-wrapper .urun-yazisi {
  font-style: normal;
  color: #969696;
  font-size: 7px;
  line-height: 9px;
}
`;
}

function getTablePrintStyles() {
  return `
/* Ortak Stiller */
table {
  table-layout: auto !important;
}

/* Sayfa ve Sayfa Parametreleri Stilleri */
body {
  font-family: Arial, sans-serif;
  padding: 20px;
  color: #000;
}

.print-header {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.print-header .title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 4px;
}

.print-header .subinfo {
  font-size: 10px;
  color: #333;
  margin-bottom: 4px;
}

.subinfo {
  display: flex;
  align-items: flex-start; 
  gap: 8px; 
}

.subinfo .label {
  min-width: 90px; 
}

.subinfo .value {
  font-weight: bold;
}



.print-header .date {
  font-size: 9px;
  color: #555;
  padding-bottom: 16px;
}

/* Tüm Tablolar | Genel Tablo Stilleri */
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10px;
  table-layout: fixed;
}

th, td {
  border: 1px solid #cdcdcd;
  padding: 6px;
  vertical-align: middle;
  word-wrap: break-word;
  overflow: hidden;
}

td img {
  max-height: 50px;
  max-width: 100%;
  display: block;
}

th {
  font-size: 7px;
  color: #707070;
  text-align: left;
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

.ic-baslik {
  font-weight: 600;
  font-size: 7px;
}

.numeric-column {
  text-align: right;
}

.center-column {
  text-align: center;
}

.bakiye, .durumu, .toplamsiparis, .firmaunvan, .yetkilikisi, .partnerunvan,
.toplam-alinan-siparis, .toplam-verilen-siparis {
  font-size: 9px;
}

.partnerunvan {
  font-size: 11px;
  font-weight: 600;
}

.logo-container svg,
.logo-container img {
 height: 64px;
  width: auto;
  display: block;
  vertical-align: middle;
}

.satir-partner-bilgiler-wrapper {
display:flex;
flex-direction: column;
gap: 20px;
}


.satir-islem, .islem-ikonlar, .tooltip-icon, .duzenle-ikon, .sil-ikon {
  display: none !important;
}

/* satisraporlari-tablo-export | Satış Raporları Tablo Stilleri */
.istatistik-bilgiler {
  display: flex;
  flex-direction: column;
  padding: 0;
  margin: 0;
}

.istatistik-bilgiler .subinfo {
  display: inline-flex;
  margin-right: 20px;
}

#satisraporlari-tablo-export td:nth-child(1), #satisraporlari-tablo-export th:nth-child(1),
#satisraporlari-tablo-export td:nth-child(3), #satisraporlari-tablo-export th:nth-child(3),
#satisraporlari-tablo-export td:nth-child(6), #satisraporlari-tablo-export th:nth-child(6),
#satisraporlari-tablo-export td:nth-child(7), #satisraporlari-tablo-export th:nth-child(7),
#satisraporlari-tablo-export td:nth-child(8), #satisraporlari-tablo-export th:nth-child(8) {
  text-align: center;
}

/* İşlem kolonunu yazdırma sayfalarında gizle (son kolon genellikle işlem kolonu) */
#satisraporlari-tablo-export thead tr th:last-child,
#satisraporlari-tablo-export tbody tr td:last-child {
  display: none !important;
}

/* musteriler-tablo-export | Müşteriler Tablo Stilleri */
.musteri-kapsayici {
  padding-left: 16px;
  margin-bottom: 0;
}

.musteri-listesi-ust-satir, .musteri-listesi-alt-satir {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 6px;
}

.musteri-listesi-ust-satir > div, .musteri-listesi-alt-satir > div {
  font-size: 9px;
  min-width: 120px;
  line-height: 1.4;
}

.musteri-listesi-ust-satir, .musteri-listesi-alt-satir {
  margin: 0;
}

.musteri-listesi-ust-satir a {
  text-decoration: none;
  color: inherit;
  font-size: 6px;
}

.musteri-bilgileri-wrapper {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 5px;
}

.musteri-grubu {
  border: 1px solid #ddd;
  border-radius: 2px;
  padding: 2px 6px;
  width: fit-content;
  font-size: 9px;
  display: none;
}

.musteri-grubu span {
  font-weight: 600;
}

.musteri-tur {
  border: 1px solid #ddd;
  border-radius: 2px;
  padding: 1px 4px 0 4px;
  margin: 0;
  width: fit-content;
  font-size: 5px;
}

.orgbilgiler {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.orgetiket {
  font-weight: 700;
}

.konum {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.konum #orgadres {
  font-size: 12px;

}

#orgsahip {
font-weight:600;
}

#toplamtutar {
  font-weight: 600;
}

.satir-firmaunvan {
  width: 385px;
  max-width: 385px;
  box-sizing: border-box;
  display: inline-block;
  vertical-align: top;
}

.musteri-listesi-alt-satir .firmaunvan {
  font-weight: 700;
}

.musteri-listesi-alt-satir .satir-durumu {
  display: none;
}

/* Partner tablolarının stilleri */
#partneralinansiparisler-tablo-export, #partnerverilensiparisler-tablo-export {
  table-layout: auto;
  width: 100%;
  border-collapse: collapse;
}

#partneralinansiparisler-tablo-export th:not(:nth-child(4)),
#partnerverilensiparisler-tablo-export th:not(:nth-child(4)) {
  text-align: center;
}

#partneralinansiparisler-tablo-export td:not(:nth-child(4)),
#partnerverilensiparisler-tablo-export td:not(:nth-child(4)) {
  text-align: center;
}

#partneralinansiparisler-tablo-export .urun-alani,
#partnerverilensiparisler-tablo-export .urun-alani {
  display: flex;
  align-items: center;
}

#partnerodemevetahsilat-tablo-export .turtahsilat,
#partnerodemevetahsilat-tablo-export #tahsiltutar {
  font-weight: 600;
}

#partnerodemevetahsilat-tablo-export .turodeme,
#partnerodemevetahsilat-tablo-export #odemetutar {
  color: red;
}

/* partnerfirmalar-tablo-export | Partnerler Tablo Stilleri */
.partner-kapsayici {
  padding-left: 16px;
  margin-bottom: 8px;
}

.partner-listesi-ust-satir, .partner-listesi-alt-satir {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 6px;
}

.partner-listesi-ust-satir > div, .partner-listesi-alt-satir > div {
  font-size: 9px;
  min-width: 190px;
  line-height: 1.4;
}

.partner-listesi-ust-satir a {
  display: none;
}

.satir-iletisim-wrapper {
  display: flex;
  gap: 48px;
}

.alan-wrapper {
  display: flex;
  // flex-direction: column;
  gap: 16px;
}

.satir-siparisler-wrapper {
  display: flex;
  gap: 20px;
}

.satir-siparisler {
  border: 1px solid #cdcdcd;
  border-radius: 4px;
  padding: 5px;
  width: 100px;
  text-align: center;
}

.partnereposta, .partnertelefon {
  text-decoration: none;
  color: inherit;
}

/* musterisiparisler-tablo-export | Müşteri Cari Tablo Stilleri */
#musterisiparisler-tablo-export {
  table-layout: auto;
  width: 100%;
  border-collapse: collapse;
}



#musterisiparisler-tablo-export th,
#musterisiparisler-tablo-export td {
  text-align: center;
}

#musterisiparisler-tablo-export th:nth-child(4),
#musterisiparisler-tablo-export td:nth-child(4) {
  text-align: left;
}

#musterisiparisler-tablo-export .orgetiket {
font-weight: 700;
}

#musterisiparisler-tablo-export .btn-fatura-kes-mini {
  display: none;
}


/* musterifaturalar-tablo-export | Müşteri Faturalar Tablo Stilleri */
#musterifaturalar-tablo-export {
  table-layout: auto;
  width: 100%;
  border-collapse: collapse;
}

#musterifaturalar-tablo-export th:nth-child(3),
#musterifaturalar-tablo-export td:nth-child(3) {
  text-align: left;
}
#musterifaturalar-tablo-export th,
#musterifaturalar-tablo-export td {
  text-align: center;
}

#musterifaturalar-tablo-export .eslesme-tam {
display: none;
}

#musterifaturalar-tablo-export td:nth-child(6) {
  font-weight: 600;
}

#musterifaturalar-tablo-export .fatura-durum {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 8px;
  font-weight: 500;
}

#musterifaturalar-tablo-export .fatura-durum.kesildi {
  background-color: #d4edda;
  color: #155724;
}

#musterifaturalar-tablo-export .fatura-durum.kesilmedi {
  background-color: #f8d7da;
  color: #721c24;
}

#musterifaturalar-tablo-export .fatura-durum.taslak {
  background-color: #fff3cd;
  color: #856404;
}

#musterifaturalar-tablo-export .fatura-durum.gonderildi {
  background-color: #cce5ff;
  color: #004085;
}

/* musteritahsilatlar-tablo-export | Müşteri Tahsilatlar Tablo Stilleri */
#musteritahsilatlar-tablo-export {
  table-layout: auto;
  width: 100%;
  border-collapse: collapse;
}

#musteritahsilatlar-tablo-export th,
#musteritahsilatlar-tablo-export td {
  text-align: center;
}

#musteritahsilatlar-tablo-export td:nth-child(3) {
  font-weight: 600;
}

/* siparisdetay-tablo-export | Sipariş Detay Tablo Stilleri */
#siparisdetay-tablo-export {
  table-layout: auto;
  width: 100%;
  border-collapse: collapse;
}

#siparisdetay-tablo-export th:not(:nth-child(3)),
#siparisdetay-tablo-export td:not(:nth-child(3)) {
  text-align: center;
}

#siparisdetay-tablo-export th:nth-child(6),
#siparisdetay-tablo-export td:nth-child(6) {
  display: none;
}

#siparisdetay-tablo-export .urun-bilgileri {
  display: flex;
  align-items: center;
  text-align: left;
}

#siparisdetay-tablo-export .urun-ve-fiyat {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

#siparisdetay-tablo-export .musteri-firma {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 11px;
  font-weight: 600;
}

#siparisdetay-tablo-export .musteri-urun-yazisi {
  font-size: 9px;
  font-weight: 500;
}

/* Ürün yazısı ikonunu yazdırma sayfasında gizle */
#siparisdetay-tablo-export .musteri-urun-yazisi i,
#siparisdetay-tablo-export .musteri-urun-yazisi .icon-urun-yazisi,
#siparisdetay-tablo-export .musteri-urun-yazisi .urun-yazisi-download-btn {
  display: none !important;
}

#siparisdetay-tablo-export .urun-bilgileri .fiyat {
  font-weight: 600;
}

#siparisdetay-tablo-export .urun-bilgileri .fiyat i.uil-plus {
  font-size: 10px;
  margin-right: 2px;
}

#siparisdetay-tablo-export .partner-firma {
  font-size: 11px;
  color: var(--gri70, #666);
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

#siparisdetay-tablo-export .partner-firma .partner-siparis-etiket {
  font-size: 9px;
  font-weight: 500;
  color: var(--gri50, #999);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

/* kampanyalar-tablo-export | Kampanya Yönetimi Tablo Stilleri */
#kampanyalar-tablo-export {
  table-layout: auto;
  width: 100%;
  border-collapse: collapse;
}

#kampanyalar-tablo-export th:nth-child(4),
#kampanyalar-tablo-export th:nth-child(5),
#kampanyalar-tablo-export th:nth-child(6),
#kampanyalar-tablo-export th:nth-child(7),
#kampanyalar-tablo-export td:nth-child(4),
#kampanyalar-tablo-export td:nth-child(5),
#kampanyalar-tablo-export td:nth-child(6),
#kampanyalar-tablo-export td:nth-child(7) {
  text-align: center;
}

#kampanyalar-tablo-export th:nth-child(10),
#kampanyalar-tablo-export td:nth-child(10) {
  display: none;
}

#kampanyalar-tablo-export th:nth-child(9),
#kampanyalar-tablo-export td:nth-child(9) {
  text-align: center;
}

/* GÖNDER butonunu yazdırma sayfasında "Henüz gönderilmedi" olarak göster */
#kampanyalar-tablo-export .gonder-btn {
  font-size: 9px;
  padding: 0;
  border: none;
  background-color: transparent;
  color: #000;
  border-radius: 0;
  font-weight: bold;
  display: inline-block;
  width: auto;
  height: auto;
  min-width: auto;
  cursor: default;
  text-transform: uppercase;
}

#kampanyalar-tablo-export .gonder-btn::after {
  content: "Henüz gönderilmedi";
  font-weight: bold;
  color: #000;
}

#kampanyalar-tablo-export .gonder-btn {
  font-size: 0;
}

#kampanyalar-tablo-export .gonder-btn::after {
  font-size: 9px;
}

/* Yazdırma optimizasyonu */
@media print {
  body { margin: 0; }
  .print-header { page-break-inside: avoid; }
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; page-break-after: auto; }
  thead { display: table-header-group; }
}
`;
}

// Kolon yönetim fonksiyonları
function hideColumnByName(table, columnName) {
  const headers = table.querySelectorAll('th');
  let columnIndex = -1;

  headers.forEach((th, index) => {
    if (th.textContent.trim().toUpperCase() === columnName.toUpperCase()) {
      columnIndex = index;
      th.style.display = 'none';
    }
  });

  if (columnIndex !== -1) {
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells[columnIndex]) {
        cells[columnIndex].style.display = 'none';
      }
    });
  }
}

function setColumnWidth(table, columnName, width) {
  const headers = table.querySelectorAll('th');
  let columnIndex = -1;

  headers.forEach((th, index) => {
    if (th.textContent.trim().toUpperCase() === columnName.toUpperCase()) {
      columnIndex = index;
      th.style.width = width;
      th.style.minWidth = width;
    }
  });

  if (columnIndex !== -1) {
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells[columnIndex]) {
        cells[columnIndex].style.width = width;
        cells[columnIndex].style.minWidth = width;
      }
    });
  }
}

function setColumnAlignment(table, columnName, alignment) {
  const headers = table.querySelectorAll('th');
  let columnIndex = -1;

  headers.forEach((th, index) => {
    if (th.textContent.trim().toUpperCase() === columnName.toUpperCase()) {
      columnIndex = index;
      th.style.textAlign = alignment;
    }
  });

  if (columnIndex !== -1) {
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells[columnIndex]) {
        cells[columnIndex].style.textAlign = alignment;
      }
    });
  }
}

function hideColumnByIndex(table, columnIndex) {
  const headers = table.querySelectorAll('th');
  if (headers[columnIndex]) {
    headers[columnIndex].style.display = 'none';
  }

  const rows = table.querySelectorAll('tr');
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells[columnIndex]) {
      cells[columnIndex].style.display = 'none';
    }
  });
}

function hideColumnsByClass(table, className) {
  const headers = table.querySelectorAll(`th.${className}`);
  headers.forEach(th => {
    const columnIndex = Array.from(th.parentElement.children).indexOf(th);
    hideColumnByIndex(table, columnIndex);
  });
}

function reorderColumns(table, columnOrder) {
  const headers = Array.from(table.querySelectorAll('th'));
  const headerMap = {};

  headers.forEach((th, index) => {
    headerMap[th.textContent.trim()] = index;
  });

  const newOrder = columnOrder.map(colName => headerMap[colName]).filter(index => index !== undefined);

  if (newOrder.length === 0) return;

  const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
  const newHeaderRow = headerRow.cloneNode(false);

  newOrder.forEach(index => {
    newHeaderRow.appendChild(headers[index].cloneNode(true));
  });

  headerRow.parentNode.replaceChild(newHeaderRow, headerRow);

  const dataRows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
  dataRows.forEach(row => {
    const cells = Array.from(row.querySelectorAll('td'));
    const newRow = row.cloneNode(false);

    newOrder.forEach(index => {
      if (cells[index]) {
        newRow.appendChild(cells[index].cloneNode(true));
      }
    });

    row.parentNode.replaceChild(newRow, row);
  });
}

// #endregion

// -------------------------------------

// #region Fonksiyonları Otomatik Başlatma
// Event listener'ların tekrar eklenmesini önlemek için flag - window'a kaydet
// ÖNEMLİ: Sayfa yenilendiğinde tüm JavaScript yeniden yüklenir, bu yüzden flag de sıfırlanır
if (typeof window.__disaAktarSistemiInitialized === 'undefined') {
  window.__disaAktarSistemiInitialized = false;
}

function initDisaAktarSistemi() {
  // ÖNEMLİ: SPA yapısında sayfa geçişlerinde script'ler yeniden yüklenebilir
  // Event delegation kullanıldığı için birden fazla event listener eklenmesi sorun yaratmaz
  // Ama performans için flag kontrolü yapıyoruz - sadece bir kez ekle
  
  // Index sayfası kontrolü - eğer index sayfasıysa bu handler çalışmamalı
  const isIndexPage = window.location.pathname.includes("index.html") || 
                      window.location.pathname === '/' || 
                      window.location.pathname.endsWith('/index.html');
  
  // Index sayfasındaysa ve disa-aktar-handler-index.js yüklüyse, bu handler'ı çalıştırma
  if (isIndexPage) {
    console.log('ℹ️ Index sayfası tespit edildi, disa-aktar-handler-index.js kullanılacak');
    return;
  }
  
  // ÖNEMLİ: SPA yapısında sayfa geçişlerinde script'ler yeniden yüklenebilir
  // Event delegation kullanıldığı için birden fazla event listener eklenmesi sorun yaratmaz
  // Ama performans için flag kontrolü yapıyoruz
  // NOT: SPA geçişlerinde flag sıfırlanır, bu yüzden event listener tekrar eklenir
  
  // ÖNEMLİ: Her zaman önce eski event listener'ı kaldır (SPA geçişlerinde çift eklenmesini önlemek için)
  if (window.__disaAktarClickHandler) {
    document.removeEventListener('click', window.__disaAktarClickHandler, true);
    window.__disaAktarClickHandler = null;
  }
  
  // Flag'i sıfırla - her zaman yeni event listener ekle
  window.__disaAktarSistemiInitialized = false;
  
  // ✅ KRİTİK: Export butonlarına direkt event listener ekle (delegation yerine)
  // Bu, butonların DOM'da olup olmadığını kontrol eder ve direkt listener ekler
  function bindExportButtonsDirectly() {
    // Tüm export butonlarını bul
    const exportButtons = document.querySelectorAll('a[data-action="excel"], a[data-action="print"], button[data-action="excel"], button[data-action="print"]');
    
    exportButtons.forEach(btn => {
      // Zaten listener eklenmiş mi kontrol et
      if (btn.__exportHandlerBound) return;
      btn.__exportHandlerBound = true;
      
      const action = btn.getAttribute('data-action');
      const isPrint = action === 'print' && btn.id !== 'yazdir';
      const isExcel = action === 'excel' && btn.id !== 'excel-aktar';
      
      if (isPrint || isExcel) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          
          // Dropdown'u kapat
          const dropdown = btn.closest('.clickdropdown');
          if (dropdown) {
            dropdown.classList.remove('open');
          }
          
          if (isPrint) {
            if (typeof window.handleTablePrint === 'function') {
              window.handleTablePrint(btn);
            } else if (typeof handleTablePrint === 'function') {
              handleTablePrint(btn);
            }
          } else if (isExcel) {
            if (typeof window.handleTableExcel === 'function') {
              window.handleTableExcel(btn);
            } else if (typeof handleTableExcel === 'function') {
              handleTableExcel(btn);
            }
          }
          
          return false;
        }, true); // Capture phase'de çalış
      }
    });
  }
  
  // İlk bağlama
  bindExportButtonsDirectly();
  
  // Index sayfası yazdır ve excel butonları - Event delegation kullan (butonlar dinamik olabilir)
  const clickHandler = function(e) {
    // ✅ KRİTİK: href="javascript:void(0)" veya href="#" olan linkler için de çalışmalı
    // ÖNEMLİ: Önce data-action olan butonları kontrol et - bunlar öncelikli
    // Çünkü bunlar diğer sayfalardaki butonlar ve index sayfası kontrolünden önce işlenmeli
    
    // Diğer sayfalardaki Yazdır Butonları (data-action='print' ve id'si 'yazdir' değil)
    const printBtn = e.target.closest("a[data-action='print'], button[data-action='print']");
    if (printBtn && printBtn.id !== 'yazdir') {
      // ÖNEMLİ: Önce default davranışı engelle - sayfa yenilenmesini önle
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation(); // ✅ KRİTİK: Diğer handler'ların çalışmasını engelle
      
      // ✅ KRİTİK: Dropdown'u kapat (export işlemi başlamadan önce)
      const dropdown = printBtn.closest('.clickdropdown');
      if (dropdown) {
        dropdown.classList.remove('open');
      }
      
      // ÖNEMLİ: handleTablePrint kullan - bu fonksiyon getPageExportHandler'ı kontrol eder
      if (typeof window.handleTablePrint === 'function') {
        window.handleTablePrint(printBtn);
      } else if (typeof handleTablePrint === 'function') {
        handleTablePrint(printBtn);
      } else {
        console.error('❌ handleTablePrint fonksiyonu bulunamadı');
        if (typeof createToast === 'function') {
          createToast('error', 'Yazdırma fonksiyonu bulunamadı.');
        }
      }
      return false; // Ek güvenlik için
    }

    // Diğer sayfalardaki Excel Butonları (data-action='excel' ve id'si 'excel-aktar' değil)
    const excelActionBtn = e.target.closest("a[data-action='excel'], button[data-action='excel']");
    if (excelActionBtn && excelActionBtn.id !== 'excel-aktar') {
      // ÖNEMLİ: Önce default davranışı engelle - sayfa yenilenmesini önle
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation(); // ✅ KRİTİK: Diğer handler'ların çalışmasını engelle
      
      // ✅ KRİTİK: Dropdown'u kapat (export işlemi başlamadan önce)
      const dropdown = excelActionBtn.closest('.clickdropdown');
      if (dropdown) {
        dropdown.classList.remove('open');
      }
      
      // ÖNEMLİ: handleTableExcel kullan - bu fonksiyon getPageExportHandler'ı kontrol eder
      if (typeof window.handleTableExcel === 'function') {
        window.handleTableExcel(excelActionBtn);
      } else if (typeof handleTableExcel === 'function') {
        handleTableExcel(excelActionBtn);
      } else {
        console.error('❌ handleTableExcel fonksiyonu bulunamadı');
        if (typeof createToast === 'function') {
          createToast('error', 'Excel export fonksiyonu bulunamadı.');
        }
      }
      return false; // Ek güvenlik için
    }
    
    // NOT: Index sayfası butonları bu handler'da işlenmez
    // Index sayfası için disa-aktar-handler-index.js kullanılır
  };
  
  // Capture phase'de çalış (diğer event listener'lardan önce)
  document.addEventListener('click', clickHandler, true);
  
  // ✅ KRİTİK: MutationObserver ile dinamik eklenen butonları da yakala
  const observer = new MutationObserver(function(mutations) {
    bindExportButtonsDirectly();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Window'a kaydet ki başka yerlerden de çağrılabilsin
  window.__bindExportButtonsDirectly = bindExportButtonsDirectly;
  
  // Event listener'ı window'a kaydet ki SPA geçişlerinde kaldırılabilsin
  window.__disaAktarClickHandler = clickHandler;

  window.__disaAktarSistemiInitialized = true;
}

// Global erişim için window'a ekle
window.initDisaAktarSistemi = initDisaAktarSistemi;

// ✅ KRİTİK: Hem DOMContentLoaded hem de window.load event'lerini dinle
// DOMContentLoaded: DOM hazır olduğunda
// window.load: Tüm kaynaklar (resimler, CSS vb.) yüklendiğinde (sayfa yenilendiğinde)
function initializeExportSystem() {
  const isIndexPage = window.location.pathname.includes("index.html") || 
                      window.location.pathname === '/' || 
                      window.location.pathname.endsWith('/index.html');
  
  if (!isIndexPage) {
    // Birden fazla gecikme ile başlat (DOM'un tamamen hazır olması için)
    setTimeout(() => {
      initDisaAktarSistemi();
      // Export butonlarını direkt bağla
      if (typeof window.__bindExportButtonsDirectly === 'function') {
        window.__bindExportButtonsDirectly();
      }
    }, 100);
    setTimeout(() => {
      initDisaAktarSistemi();
      if (typeof window.__bindExportButtonsDirectly === 'function') {
        window.__bindExportButtonsDirectly();
      }
    }, 300);
    setTimeout(() => {
      initDisaAktarSistemi();
      if (typeof window.__bindExportButtonsDirectly === 'function') {
        window.__bindExportButtonsDirectly();
      }
    }, 800);
  }
}

// DOMContentLoaded Kontrolü
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    initializeExportSystem();
  });
} else {
  // DOM zaten hazırsa hemen başlat
  initializeExportSystem();
}

// ✅ KRİTİK: window.load event'ini de dinle (sayfa yenilendiğinde)
window.addEventListener('load', function() {
  initializeExportSystem();
});

// ÖNEMLİ: SPA yapısı için - sayfa geçişlerinde event listener'ı tekrar ekle
// SPA'da sayfa yüklendiğinde (floovon:pageLoaded event) flag'i sıfırla ve event listener'ı tekrar ekle
document.addEventListener('floovon:pageLoaded', function() {
  // Index sayfası kontrolü
  const isIndexPage = window.location.pathname.includes("index.html") || 
                      window.location.pathname === '/' || 
                      window.location.pathname.endsWith('/index.html');
  
  // Index sayfası değilse flag'i sıfırla ve event listener'ı tekrar ekle
  if (!isIndexPage) {
    window.__disaAktarSistemiInitialized = false;
    initializeExportSystem();
  }
});

// ÖNEMLİ: disa-aktar-handler-index.js dosyası window.initDisaAktarSistemi'yi override edebilir
// Bu durumda diğer sayfalar için event listener'ı eklemek için bir kez daha kontrol et
// Bu, disa-aktar-handler-index.js dosyası yüklendikten SONRA çalışacak
setTimeout(function() {
  const isIndexPage = window.location.pathname.includes("index.html") || 
                      window.location.pathname === '/' || 
                      window.location.pathname.endsWith('/index.html');
  
  // Index sayfası değilse event listener'ı ekle (flag kontrolü yok - her zaman ekle)
  if (!isIndexPage) {
    initDisaAktarSistemi();
  }
}, 500); // 500ms bekle ki disa-aktar-handler-index.js yüklensin
// #endregion

} // if (typeof window.__DISA_AKTAR_HANDLER_LOADED__ !== 'undefined') bloğunun kapanışı

