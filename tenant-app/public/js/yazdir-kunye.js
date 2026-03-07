// yazdir-kunye.js

// #region Yardımcı Fonksiyonlar - Veri Çekme İşlemleri

// Künye arka plan şablonu (public/assets/ altında)
const FLOOVON_KUNYE_SABLON = 'sablon-siparis-kunyesi-bos.png';

// API/Backend base: index.html'de getFloovonApiBase/origin ayarlanır; yoksa origin + /api
if (typeof window.FLOOVON_API_BASE === 'undefined') {
    var o = window.location && window.location.origin ? window.location.origin : '';
    var port = window.location.port;
    if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (port === '5174' || port === '5173' || port === '5175')) {
        window.FLOOVON_API_BASE = '/api';
    } else if (typeof window.getFloovonApiBase === 'function') {
        window.FLOOVON_API_BASE = (window.getFloovonApiBase() || (o + '/api')).replace(/\/$/, '');
    } else {
        window.FLOOVON_API_BASE = (window.API_BASE_URL || (o ? o + '/api' : '/api')).replace(/\/$/, '');
    }
}
var FLOOVON_API_BASE = window.FLOOVON_API_BASE;

if (typeof window.FLOOVON_BACKEND_BASE === 'undefined') {
    var o2 = window.location && window.location.origin ? window.location.origin : '';
    var port2 = window.location.port;
    if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (port2 === '5174' || port2 === '5173' || port2 === '5175')) {
        window.FLOOVON_BACKEND_BASE = '';
    } else if (typeof window.getFloovonBackendBase === 'function') {
        window.FLOOVON_BACKEND_BASE = window.getFloovonBackendBase() || o2;
    } else {
        window.FLOOVON_BACKEND_BASE = window.BACKEND_BASE_URL || (FLOOVON_API_BASE.endsWith('/api') ? FLOOVON_API_BASE.slice(0, -4) : FLOOVON_API_BASE) || o2;
    }
}
var FLOOVON_BACKEND_BASE = window.FLOOVON_BACKEND_BASE;

// Tek merkezden telefon formatı: +90 (506) 659 35 45 (formatUtils.ts ile aynı mantık)
function formatPhoneNumberKunye(phone) {
  if (!phone) return '';
  var digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('90')) digits = digits.substring(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.substring(1);
  if (digits.length > 10) digits = digits.substring(0, 10);
  if (digits.length < 10) return String(phone).trim();
  return '+90 (' + digits.substring(0, 3) + ') ' + digits.substring(3, 6) + ' ' + digits.substring(6, 8) + ' ' + digits.substring(8, 10);
}

function resolvePrintMediaUrl(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return '';
  
  // Tenant ID'yi al
  let tenantId = null;
  if (window.userManager && typeof window.userManager.getUser === 'function') {
    const user = window.userManager.getUser();
    tenantId = user?.tenant_id || null;
  }
  if (!tenantId && window.userSession && typeof window.userSession.getTenantId === 'function') {
    tenantId = window.userSession.getTenantId();
  }
  if (!tenantId) {
    const userStr = localStorage.getItem('floovon_user') || localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        tenantId = user?.tenant_id || null;
      } catch (e) {}
    }
  }
  tenantId = tenantId || '1'; // Fallback
  
  // getFloovonUploadUrl kullan - otomatik tenant-based yapıya çevirir
  if (window.getFloovonUploadUrl) {
    // Eski path'leri tenant-based yapıya çevir
    if (pathOrUrl.includes('/uploads/print-settings/') && !pathOrUrl.includes('/uploads/tenants/')) {
      const fileName = pathOrUrl.split('/uploads/print-settings/')[1] || pathOrUrl.split('print-settings/')[1];
      pathOrUrl = `/uploads/tenants/${tenantId}/print-settings/${fileName}`;
    } else if (pathOrUrl.includes('print-settings/') && !pathOrUrl.includes('/uploads/tenants/')) {
      const fileName = pathOrUrl.split('print-settings/')[1];
      pathOrUrl = `/uploads/tenants/${tenantId}/print-settings/${fileName}`;
    }
    return window.getFloovonUploadUrl(pathOrUrl);
  }
  
  // Fallback: Eski mantık (getFloovonUploadUrl yoksa)
  // Eğer zaten tam URL ise (http:// veya https:// ile başlıyorsa)
  if (/^https?:\/\//i.test(pathOrUrl)) {
    // Eski /uploads/print-settings/ path'lerini tenant-based yapıya çevir
    if (pathOrUrl.includes('/uploads/print-settings/') && !pathOrUrl.includes('/uploads/tenants/')) {
      const fileName = pathOrUrl.split('/uploads/print-settings/')[1];
      const baseUrl = pathOrUrl.split('/uploads/')[0];
      pathOrUrl = `${baseUrl}/uploads/tenants/${tenantId}/print-settings/${fileName}`;
    }
    // Çift /uploads/uploads/ kontrolü
    pathOrUrl = pathOrUrl.replace(/\/uploads\/uploads\//g, '/uploads/');
    // Production URL'i localhost'a çevir (eğer localhost'taysak)
    const productionDomain = window.getFloovonProductionDomain ? window.getFloovonProductionDomain() : (window.FLOOVON_CONFIG?.PRODUCTION_DOMAIN || window.location.hostname);
    const hostname = window.location.hostname;
    if (pathOrUrl.includes(productionDomain)) {
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') {
        pathOrUrl = pathOrUrl.replace(`https://${productionDomain}`, 'http://localhost:3001');
        pathOrUrl = pathOrUrl.replace(`http://${productionDomain}`, 'http://localhost:3001');
      }
    }
    return pathOrUrl;
  }
  
  if (pathOrUrl.startsWith('//')) {
    return `${window.location.protocol}${pathOrUrl}`;
  }
  
  // Assets için: Yazdırma penceresinde (about:blank) relative path yüklenmeyebilir; mutlak URL kullan
  if (pathOrUrl.startsWith('/assets/') || pathOrUrl.startsWith('assets/')) {
    var assetPath = pathOrUrl.startsWith('/') ? pathOrUrl : '/' + pathOrUrl;
    return window.location.origin + assetPath;
  }
  
  // Eski /uploads/print-settings/ path'lerini tenant-based yapıya çevir
  if (pathOrUrl.includes('/uploads/print-settings/') && !pathOrUrl.includes('/uploads/tenants/')) {
    const fileName = pathOrUrl.split('/uploads/print-settings/')[1];
    pathOrUrl = `/uploads/tenants/${tenantId}/print-settings/${fileName}`;
  }
  
  // Uploads için - path'te zaten /uploads/ varsa tekrar ekleme
  if (pathOrUrl.startsWith('/uploads/')) {
    return `${FLOOVON_BACKEND_BASE}${pathOrUrl}`;
  }
  
  if (pathOrUrl.startsWith('uploads/')) {
    return `${FLOOVON_BACKEND_BASE}/${pathOrUrl}`;
  }
  
  // Eğer path /yazdirma/ ile başlıyorsa tenant-based print-settings'e çevir
  if (pathOrUrl.startsWith('/yazdirma/') || pathOrUrl.startsWith('yazdirma/')) {
    const cleanPath = pathOrUrl.replace(/^\/?yazdirma\//, '');
    return `${FLOOVON_BACKEND_BASE}/uploads/tenants/${tenantId}/print-settings/${cleanPath}`;
  }
  
  // print-settings/ ile başlıyorsa tenant-based yapıya çevir
  if (pathOrUrl.startsWith('print-settings/')) {
    return `${FLOOVON_BACKEND_BASE}/uploads/tenants/${tenantId}/print-settings/${pathOrUrl.replace('print-settings/', '')}`;
  }
  
  return pathOrUrl;
}

async function loadYazdirmaAyarlar(force = false) {
  if (!force && window.floovonYazdirmaAyarlar) return window.floovonYazdirmaAyarlar;
  
  // Sessizce fetch yap - hata durumunda sessizce return null
  // NOT: Browser'ın Network tab'ında 400 hatası görünebilir, bu normal (endpoint henüz hazır değilse)
  let response;
  try {
    // Fetch çağrısını sessizce yap - hata durumunda sessizce return null
    response = await fetch(`${FLOOVON_API_BASE}/ayarlar/yazdirma`, {
      // Sessizce handle et - hiçbir console log yazma
      method: 'GET',
      credentials: 'include',
      // Hata durumunda sessizce handle et
    }).catch(() => {
      // Network hatası, CORS hatası, vb. - sessizce return null
      return null;
    });
  } catch (fetchError) {
    // Network hatası, CORS hatası, vb. - sessizce return null
    return null;
  }
  
  // Response null ise veya hata durumu - sessizce return null
  if (!response || !response.ok) {
    // 400, 404, 500, vb. hatalar - sessizce return null (endpoint henüz hazır değilse normal)
    // NOT: Browser'ın Network tab'ında hata görünebilir, bu normal
    return null;
  }
  
  // JSON parse - hata durumunda sessizce return null
  let result;
  try {
    result = await response.json();
  } catch (jsonError) {
    // JSON parse hatası - sessizce return null
    return null;
  }
  
  if (result && result.success && result.data) {
    const data = result.data;
    window.floovonYazdirmaAyarlar = {
      ...data,
      is_active: data.is_active === undefined ? true : Boolean(data.is_active),
      logo_png_url: resolvePrintMediaUrl(data.logo_png_url || data.logo_png_path)
    };
    return window.floovonYazdirmaAyarlar;
  }
  
  return null;
}

// Sayfa yüklendiğinde sessizce yükle (hata olsa bile sessizce handle et)
// Promise rejection'ı handle et - hiçbir log yazma
// NOT: Browser'ın Network tab'ında 400 hatası görünebilir, bu normal (endpoint henüz hazır değilse)
loadYazdirmaAyarlar().catch(() => {
  // Sessizce handle et - hiçbir log yazma
});

// BroadcastChannel ile logo güncellemelerini dinle (diğer sekmelerden gelen değişiklikler için)
if (typeof BroadcastChannel !== 'undefined') {
  try {
    const logoUpdateChannel = new BroadcastChannel('floovon-print-logo-update');
    logoUpdateChannel.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'PRINT_LOGO_UPDATED') {
        // Cache'i temizle ve yeniden yükle (sessizce)
        window.floovonYazdirmaAyarlar = null;
        loadYazdirmaAyarlar(true).catch(() => {
          // Sessizce handle et - hiçbir log yazma
        });
      }
    });
  } catch (broadcastError) {
    // Sessizce handle et - hiçbir log yazma
  }
}

function extractSaatVerisi(kart, anaKart) {
  // Organizasyon kartlarında saat bilgisi farklı class'larda olabilir
  const saatSelectors = [
    '.teslim-zaman .saat',
    '.saat-veri',
    '.organizasyon-saat-veri',
    '.siparis-saat-veri',
    '.randevu-saat-veri',
    '.saat-icerik .organizasyon-saat-veri',
    '.saat-icerik .siparis-saat-veri',
    '.teslim-zaman .organizasyon-saat-veri',
    '.teslim-zaman .saat-veri',
    '.sahip-ve-zaman .organizasyon-saat-veri'
  ];
  
  const extract = (elem) => {
    if (!elem) return "";
    // Önce text node'lardan al
    const textNodes = Array.from(elem.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim() !== "")
      .map(n => n.textContent.trim())
      .join(" ");
    
    // Eğer text node yoksa, tüm text içeriğini al
    if (textNodes) {
      return textNodes;
    }
    
    // Fallback: tüm text içeriğini al
    return elem.textContent.trim();
  };
  
  // Önce sipariş kartından dene
  for (const selector of saatSelectors) {
    const elem = kart.querySelector(selector);
    if (elem) {
      const saat = extract(elem);
      if (saat) return saat;
    }
  }
  
  // Sonra ana karttan dene
  for (const selector of saatSelectors) {
    const elem = anaKart.querySelector(selector);
    if (elem) {
      const saat = extract(elem);
      if (saat) return saat;
    }
  }
  
  return "";
}

// DÜZELTILMIŞ getText fonksiyonu - her sipariş kartı için spesifik veri
function getText(kart, anaKart, selector, index = null, forceFromCard = false) {
  let el;

  if (index === null) {
    // İndeks belirtilmemişse, önce karttan al
    el = kart.querySelector(selector);

    // Eğer forceFromCard true ise veya element bulunmuşsa, ana karttan alma
    if (forceFromCard || (el && el.textContent.trim())) {
      return el?.textContent.trim() || "";
    }

    // Kart içinde bulunamadı veya boşsa, ana karttan al
    if (!el || !el.textContent.trim()) {
      el = anaKart.querySelector(selector);
    }
  } else {
    // İndeks belirtilmişse
    const kartEls = kart.querySelectorAll(selector);
    if (kartEls[index] && kartEls[index].textContent.trim()) {
      el = kartEls[index];
    } else {
      const anaKartEls = anaKart.querySelectorAll(selector);
      el = anaKartEls[index] || null;
    }
  }
  return el?.textContent.trim() || "";
}

// YENİ FONKSIYON: Telefon numarasını doğru yerden al
function getTelefonFromCard(kart, anaKart, isForTeslim = true) {
  // Sipariş kartından önce telefonu almaya çalış
  let telefon = "";

  if (isForTeslim) {
    // Teslim kişisi telefonu için önce sipariş kartındaki teslim kişisi telefonunu ara
    const teslimTelSelectors = [
      '.teslim-kisisi-telefon a',
      '#teslim-kisisi-telefon a',
      '.teslim-kisisi-telefon',
      '#teslim-kisisi-telefon'
    ];

    for (const selector of teslimTelSelectors) {
      const el = kart.querySelector(selector);
      if (el && el.textContent.trim()) {
        telefon = el.textContent.trim();
        break;
      }
    }

    // Eğer sipariş kartında bulunamadıysa ana karttan al
    if (!telefon) {
      for (const selector of teslimTelSelectors) {
        const el = anaKart.querySelector(selector);
        if (el && el.textContent.trim()) {
          telefon = el.textContent.trim();
          break;
        }
      }
    }
  } else {
    // Sipariş veren telefonu için sipariş kartındaki telefonu al
    const sipVerenTelSelectors = [
      '.siparis-veren-telefon a',
      '#siparis-veren-telefon a',
      '.siparis-veren-telefon',
      '#siparis-veren-telefon'
    ];

    for (const selector of sipVerenTelSelectors) {
      const el = kart.querySelector(selector);
      if (el && el.textContent.trim()) {
        telefon = el.textContent.trim();
        break;
      }
    }
  }

  return telefon;
}

// YENİ FONKSIYON: Teslim kişisini doğru yerden al (organizasyon kartları için özel)
function getTeslimKisiFromCard(kart, anaKart) {
  let teslimKisi = "";

  // Önce sipariş kartındaki teslim kişisini ara
  const kartTeslimSelectors = [
    '.teslim-kisisi',
    '.organizasyon-sahibi .teslim-kisisi'
  ];

  for (const selector of kartTeslimSelectors) {
    const el = kart.querySelector(selector);
    if (el && el.textContent.trim()) {
      teslimKisi = el.textContent.trim();
      break;
    }
  }

  // Eğer sipariş kartında bulunamadıysa ana karttan al
  if (!teslimKisi) {
    const anaKartTeslimSelectors = [
      '.organizasyon-sahip .teslim-kisisi',
      '.organizasyon-sahibi .teslim-kisisi',
      '.teslim-kisisi'
    ];

    for (const selector of anaKartTeslimSelectors) {
      const el = anaKart.querySelector(selector);
      if (el && el.textContent.trim()) {
        teslimKisi = el.textContent.trim();
        break;
      }
    }
  }

  return teslimKisi;
}

// #endregion

// #region İşletme Bilgileri Künyeye Dinamik Ekleme Fonksiyonları

// Ayarlar sayfasından işletme bilgilerini çekme - Backend API'den çeker, hardcoded değer yok
async function ayarlarSayfasindanIsletmeBilgileriCek() {
  // ÖNCE: Mevcut sayfa formlarından kontrol et (ayarlar sayfası açıksa veya form alanları varsa)
  // Form alanlarından direkt çek - backend API'den önce kontrol et
  const formFields = {
    logo: document.querySelector('#company-logo-img')?.src || '',
    firmaAdi: document.querySelector('#isletme-adi')?.value || '',
    telefon: document.querySelector('#isletme-telefon')?.value || '',
    whatsapp: document.querySelector('#isletme-whatsapp')?.value || '',
    website: document.querySelector('#isletme-website')?.value || '',
    il: document.querySelector('#isletme-il')?.value || '',
    ilce: document.querySelector('#isletme-ilce')?.value || '',
    adres: document.querySelector('#isletme-adres')?.value || ''
  };
  
  // Form alanlarından en az bir veri varsa, form alanlarını kullan
  const hasFormData = Object.values(formFields).some(val => val && val.trim());
  if (hasFormData) {
    const bilgiler = { ...formFields };
    applyYazdirmaLogoPreference(bilgiler);
    
    // Form alanlarından alınan veriyi localStorage'a kaydet (cache için)
    localStorage.setItem('floovon-isletme-ayarlari', JSON.stringify({
      'company-logo-src': bilgiler.logo,
      'isletme-adi': bilgiler.firmaAdi,
      'isletme-telefon': bilgiler.telefon,
      'isletme-whatsapp': bilgiler.whatsapp,
      'isletme-website': bilgiler.website,
      'isletme-il': bilgiler.il,
      'isletme-ilce': bilgiler.ilce,
      'isletme-adres': bilgiler.adres
    }));
    
    return bilgiler;
  }

  // İKİNCİ: Backend API'den çek (veritabanından - form alanları boşsa)
  try {
    const apiBase = window.getFloovonApiBase ? window.getFloovonApiBase() : (window.API_BASE_URL || FLOOVON_API_BASE);
    const response = await fetch(`${apiBase}/ayarlar/isletme`, {
      credentials: 'include', // Cookie'leri gönder (tenant ID için gerekli)
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const result = await response.json();
    
    if (result.success && result.data) {
      const data = result.data;
      const bilgiler = {
        logo: data.logo_path || '',
        firmaAdi: data.isletme_adi || '',
        telefon: data.telefon || '',
        whatsapp: data.whatsapp || '',
        website: data.website || '',
        il: data.il || '',
        ilce: data.ilce || '',
        adres: data.adres || ''
      };
      applyYazdirmaLogoPreference(bilgiler);
      
      // localStorage'a da kaydet (cache için)
      localStorage.setItem('floovon-isletme-ayarlari', JSON.stringify({
        'company-logo-src': bilgiler.logo,
        'isletme-adi': bilgiler.firmaAdi,
        'isletme-telefon': bilgiler.telefon,
        'isletme-whatsapp': bilgiler.whatsapp,
        'isletme-website': bilgiler.website,
        'isletme-il': bilgiler.il,
        'isletme-ilce': bilgiler.ilce,
        'isletme-adres': bilgiler.adres
      }));
      
      return bilgiler;
    }
  } catch (error) {
    console.warn('⚠️ Backend API\'den işletme bilgileri alınamadı:', error);
  }

  // ÜÇÜNCÜ: localStorage'dan kontrol et (fallback - sadece API ve form başarısız olursa)
  const localData = localStorage.getItem('floovon-isletme-ayarlari');
  if (localData) {
    try {
      const parsed = JSON.parse(localData);
      const bilgiler = {
        logo: parsed['company-logo-src'] || '',
        firmaAdi: parsed['isletme-adi'] || '',
        telefon: parsed['isletme-telefon'] || '',
        whatsapp: parsed['isletme-whatsapp'] || '',
        website: parsed['isletme-website'] || '',
        il: parsed['isletme-il'] || '',
        ilce: parsed['isletme-ilce'] || '',
        adres: parsed['isletme-adres'] || ''
      };
      
      // localStorage'dan alınan veri boş değilse kullan
      const hasLocalData = Object.values(bilgiler).some(val => val && val.trim());
      if (hasLocalData) {
        applyYazdirmaLogoPreference(bilgiler);
        return bilgiler;
      }
    } catch (e) {
      console.warn('⚠️ localStorage verisi parse edilemedi:', e);
    }
  }

  // Hardcoded değer yok - boş değerler döndür
  console.warn('⚠️ İşletme bilgileri bulunamadı! Lütfen Ayarlar > İşletme Ayarları sayfasından bilgileri girin ve kaydedin.');
  const bilgiler = {
    logo: '',
    firmaAdi: '',
    telefon: '',
    whatsapp: '',
    website: '',
    il: '',
    ilce: '',
    adres: ''
  };
  applyYazdirmaLogoPreference(bilgiler);
  return bilgiler;
}

function applyYazdirmaLogoPreference(bilgiler) {
  if (!bilgiler) return;
  const settings = window.floovonYazdirmaAyarlar;
  if (!settings) return;

  const isActive = settings.is_active === undefined || settings.is_active === null ? true : Boolean(settings.is_active);
  if (!isActive) return;

  // Logo sadece veritabanından (ayarlar_genel_yazdirma_ayarlari) — varsayılan logo yok
  const pngUrl = resolvePrintMediaUrl(settings.logo_png_url || settings.logo_png_path);
  if (pngUrl) {
    bilgiler.logo = pngUrl;
  }
}

// Künyeye işletme bilgilerini HTML olarak ekleme
async function kunyeyeDinamikIsletmeBilgileriEkle(kunyeTemplate) {
  const bilgiler = await ayarlarSayfasindanIsletmeBilgileriCek();
  // Logo sadece veritabanından (applyYazdirmaLogoPreference ile) — varsayılan yok

  // Tam adres oluştur
  const tamAdres = [bilgiler.adres, bilgiler.ilce, bilgiler.il]
    .filter(item => item && item.trim())
    .join(', ');

  // İşletme bilgileri HTML yapısı
  const isletmeBilgileriHTML = `
 <div class="k-isletme-bilgileri-container">

   <div class="k-isletme-detay-wrapper">
     
     <div class="k-isletme-tam-adres">${tamAdres}</div>
     <div class="k-isletme-iletisim-satiri">
       ${bilgiler.telefon ? `<span class="k-isletme-telefon-item"><i class="fa-solid fa-phone"></i>${formatPhoneNumberKunye(bilgiler.telefon)}</span>` : ''}
       ${bilgiler.whatsapp ? `<span class="k-isletme-whatsapp-item"><i class="fa-brands fa-whatsapp"></i>${formatPhoneNumberKunye(bilgiler.whatsapp)}</span>` : ''}
     </div>
     <div class="k-isletme-web-satiri">
       ${bilgiler.website ? `<span class="k-isletme-website-item"><i class="fas fa-globe"></i>${bilgiler.website}</span>` : ''}
     </div>
   </div>
      <div class="k-isletme-logo-wrapper">
     ${bilgiler.logo ? `<img class="k-isletme-logo-img" src="${bilgiler.logo}" alt="İşletme Logosu" />` : ''}
   </div>
 </div>
`;

  // Künyeye ekle
  kunyeTemplate.insertAdjacentHTML('beforeend', isletmeBilgileriHTML);
}

// Ayarlar formunu localStorage'a kaydetme (ayarlar sayfasında kullanılacak)
function isletmeAyarlariniLocalStorageaKaydet() {
  const form = document.querySelector('#isletmeForm');
  if (!form) return;

  const formData = new FormData(form);
  const dataObj = {};

  // Form verilerini al
  for (let [key, value] of formData.entries()) {
    dataObj[key] = value;
  }

  // Logo src'sini de ekle
  const logoImg = document.querySelector('#company-logo-img');
  if (logoImg && logoImg.src) {
    dataObj['company-logo-src'] = logoImg.src;
  }

  // localStorage'a kaydet
  localStorage.setItem('floovon-isletme-ayarlari', JSON.stringify(dataObj));
  console.log('İşletme ayarları localStorage\'a kaydedildi');
}

// #endregion

// #region DOM Event Listeners ve Ana Fonksiyonlar

document.addEventListener("DOMContentLoaded", function () {
  // Event listener script.js'de setupKartMenuContentButtons içinde zaten var
  // Burada tekrar eklemeye gerek yok, çift çalışmasını önlemek için kaldırıldı
  // document.querySelectorAll(".kart-siparis-kunyesi-yazdir").forEach(link => {
  //   link.addEventListener("click", function (e) {
  //     e.preventDefault();
  //     const anaKart = this.closest(".ana-kart");
  //     if (!anaKart) {
  //       console.log("→ anaKart null");
  //       return;
  //     }
  //     console.log("✓ clicked", anaKart);
  //     yazdirSiparisKunyeToplu(anaKart);
  //   });
  // });
});

// Ana künye yazdırma fonksiyonu - Güncellenmiş ve İşletme Bilgileri Dahil
async function yazdirSiparisKunyeToplu(anaKart) {
  await loadYazdirmaAyarlar();

  // React tenant-app: Logo URL doğrudan ana kartta data attribute ile geliyorsa onu kullan (öncelik)
  var logoUrlFromReact = anaKart.getAttribute('data-kunye-logo-url');
  if (logoUrlFromReact) {
    if (!window.floovonYazdirmaAyarlar) window.floovonYazdirmaAyarlar = {};
    window.floovonYazdirmaAyarlar.logo_png_url = logoUrlFromReact;
  }

  const siparisKartlari = anaKart.querySelectorAll(".siparis-kart");
  if (!siparisKartlari.length) {
    if (typeof createToast === 'function') {
      createToast('warning', 'Sipariş bulunamadı!');
    }
    return;
  }

  // İşletme bilgilerini ana pencerede çek (yeni pencerede API erişimi olmayabilir)
  const isletmeBilgileri = await ayarlarSayfasindanIsletmeBilgileriCek();
  // Künye logosu: 1) React'ın data-kunye-logo-url ile gönderdiği URL, 2) yoksa cache (floovonYazdirmaAyarlar)
  if (logoUrlFromReact && logoUrlFromReact.trim()) {
    isletmeBilgileri.logo = logoUrlFromReact.trim();
  } else {
    var settings = window.floovonYazdirmaAyarlar;
    if (settings) {
      var logoVal = settings.logo_png_url || settings.logo_png_path;
      if (logoVal) {
        var dbLogoUrl = (/^https?:\/\//i.test(logoVal)) ? logoVal : resolvePrintMediaUrl(logoVal);
        if (dbLogoUrl) isletmeBilgileri.logo = dbLogoUrl;
      }
    }
  }
  const tamAdres = [isletmeBilgileri.adres, isletmeBilgileri.ilce, isletmeBilgileri.il]
    .filter(item => item && item.trim())
    .join(', ');

  const newWindow = window.open("", "_blank");
  if (!newWindow) {
    if (typeof createToast === 'function') {
      createToast('error', 'Popup engellendi. Lütfen tarayıcınızdan izin verin.');
    }
    return;
  }

  // Base URL'yi ana pencereden al
  const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');

  // HTML içeriğini hazırla
  const contentHTML = Array.from(siparisKartlari).map((kart, idx) => {

    // Her sipariş kartı için spesifik verileri al
    const teslimKisi = getTeslimKisiFromCard(kart, anaKart);
    const teslimTel = getTelefonFromCard(kart, anaKart, true);
    const sipVerenTel = getTelefonFromCard(kart, anaKart, false);
    const sipVeren = getText(kart, anaKart, '.siparis-veren', null, true);
    const urun = getText(kart, anaKart, '.siparis-urun', null, true);

    // Ana karttan alınacak ortak veriler
    // Tarih bilgisini farklı selector'lerle dene
    let tarih = getText(anaKart, anaKart, '.teslim-zaman .tarih');
    if (!tarih || !tarih.trim()) {
      // Alternatif selector'leri dene
      const tarihEl = anaKart.querySelector('.teslim-zaman .tarih') || 
                      anaKart.querySelector('.tarih') || 
                      anaKart.querySelector('.sahip-ve-zaman .tarih') ||
                      anaKart.querySelector('.organizasyon-tarih-veri');
      if (tarihEl) {
        tarih = tarihEl.textContent.trim();
      }
    }

    const aylar = {
      "Ocak": "01", "Şubat": "02", "Mart": "03", "Nisan": "04", "Mayıs": "05", "Haziran": "06",
      "Temmuz": "07", "Ağustos": "08", "Eylül": "09", "Ekim": "10", "Kasım": "11", "Aralık": "12"
    };
    if (tarih && tarih.includes(" ")) {
      const parcalar = tarih.split(" ");
      tarih = `${parcalar[0].padStart(2, '0')}/${aylar[parcalar[1]] || "01"}/${parcalar[2]}`;
    }

    const saat = extractSaatVerisi(kart, anaKart);
    // Siyah alan metni: her zaman "Ana tür > Alt tür" (etikete gerek yok); uzun yazıda kısalt
    const anaTur = getText(anaKart, anaKart, '.kart-tur');
    const altTur = getText(anaKart, anaKart, '.kart-alt-tur');
    let kartTur = (anaTur && altTur) ? (anaTur.trim() + ' > ' + altTur.trim()) : (altTur && altTur.trim()) || (anaTur && anaTur.trim()) || 'Organizasyon';
    if (kartTur.length > 35) {
      kartTur = kartTur.slice(0, 32).trim() + '...';
    }

    const konum = getText(anaKart, anaKart, '.konum') || getText(kart, anaKart, '.mahalle');
    const acikAdres = getText(kart, anaKart, '.acik-adres');

    // QR için kimlik: öncelik sipariş kartının data-order-id'si
    const orderId = kart.getAttribute('data-order-id') || anaKart.getAttribute('data-order-id') || `ORD-${Date.now()}-${idx}`;


    // Görsel URL'ini doğru şekilde oluştur (React tenant-app: SVG şablon public/assets/ altında)
    const sablonPath = (baseUrl.endsWith('/') ? baseUrl : baseUrl + '/') + 'assets/' + (typeof FLOOVON_KUNYE_SABLON !== 'undefined' ? FLOOVON_KUNYE_SABLON : 'sablon-siparis-kunyesi-bos.png');
    const bgImageUrl = sablonPath;
    
    // İşletme bilgileri HTML'i
    const isletmeBilgileriHTML = `
      <div class="k-isletme-bilgileri-container">
        <div class="k-isletme-detay-wrapper">
          <div class="k-isletme-tam-adres">${tamAdres}</div>
          <div class="k-isletme-iletisim-satiri">
            ${isletmeBilgileri.telefon ? `<span class="k-isletme-telefon-item"><i class="fa-solid fa-phone"></i>${formatPhoneNumberKunye(isletmeBilgileri.telefon)}</span>` : ''}
            ${isletmeBilgileri.whatsapp ? `<span class="k-isletme-whatsapp-item"><i class="fa-brands fa-whatsapp"></i>${formatPhoneNumberKunye(isletmeBilgileri.whatsapp)}</span>` : ''}
          </div>
          <div class="k-isletme-web-satiri">
            ${isletmeBilgileri.website ? `<span class="k-isletme-website-item"><i class="fas fa-globe"></i>${isletmeBilgileri.website}</span>` : ''}
          </div>
        </div>
        <div class="k-isletme-logo-wrapper">
          ${isletmeBilgileri.logo ? `<img class="k-isletme-logo-img" src="${isletmeBilgileri.logo}" alt="İşletme Logosu" />` : ''}
        </div>
      </div>
    `;
    
    return `
      <div class="kunye-wrapper">
        <div class="kunye-template" data-order-id="${orderId}"
             style="transform: rotate(-90deg) scale(0.5); transform-origin: left top;">
          <img class="kunye-bg" src="${(baseUrl.endsWith('/') ? baseUrl : baseUrl + '/')}assets/${typeof FLOOVON_KUNYE_SABLON !== 'undefined' ? FLOOVON_KUNYE_SABLON : 'sablon-siparis-kunyesi-bos.png'}" />
          <div class="k-date" style="color: #000;">${tarih}</div>
          <div class="k-time" style="color: #000;">${saat}</div>
          <div class="k-siparisveren" style="color: #000;">${sipVeren}</div>
          <div class="k-karttur" style="background-color: #000; color: #fff;">${kartTur}</div>
          <div class="k-telefon" style="color: #000;">${sipVerenTel}</div>
          <div class="k-urunturu" style="color: #000;">
            <strong class="etiket" style="color: #000;">${urun}</strong>
          </div>
          <div class="k-konum" style="color: #000;">${konum}</div>
          <div class="k-adres" style="color: #000;">${acikAdres}</div>
          <div class="k-teslimkisi" style="color: #000;">${teslimKisi}</div>
          <div class="k-teslimtel" style="color: #000;">${teslimTel}</div>
          <div class="k-qrcode"></div>
          ${isletmeBilgileriHTML}
        </div>
      </div>
    `;
  }).join("");

  const isDarkMode = document.body.classList.contains('dark-mode');

   newWindow.document.write(`
 <html>
 <head>
   <title>Künye PDF</title>
   <base href="${baseUrl}/">
   <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
         crossorigin="anonymous" referrerpolicy="no-referrer" />
   <link rel="stylesheet" href="./css/style.css" />
   <link rel="stylesheet" href="./css/fonts.css" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
  <script>
    // Yeni pencerede çalışması için gerekli değişkenler ve fonksiyonlar
    (function() {
      var o = window.location.origin || '';
      let FLOOVON_API_BASE = (typeof window.getFloovonApiBase === 'function' ? window.getFloovonApiBase() : (window.API_BASE_URL || (o + '/api'))).replace(/\/$/, '');
      let FLOOVON_BACKEND_BASE = (typeof window.getFloovonBackendBase === 'function' ? window.getFloovonBackendBase() : (window.BACKEND_BASE_URL || (FLOOVON_API_BASE.endsWith('/api') ? FLOOVON_API_BASE.slice(0, -4) : FLOOVON_API_BASE) || o));
      
      window.FLOOVON_API_BASE = FLOOVON_API_BASE;
      window.FLOOVON_BACKEND_BASE = FLOOVON_BACKEND_BASE;
      
      function resolvePrintMediaUrl(pathOrUrl) {
        if (!pathOrUrl || typeof pathOrUrl !== 'string') return '';
        if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
        if (pathOrUrl.startsWith('//')) {
          return window.location.protocol + pathOrUrl;
        }
        if (pathOrUrl.startsWith('/assets/') || pathOrUrl.startsWith('assets/')) {
          return pathOrUrl.startsWith('/') ? pathOrUrl.slice(1) : pathOrUrl;
        }
        if (pathOrUrl.startsWith('/uploads/')) {
          return FLOOVON_BACKEND_BASE + pathOrUrl;
        }
        if (pathOrUrl.startsWith('uploads/')) {
          return FLOOVON_BACKEND_BASE + '/' + pathOrUrl;
        }
        return pathOrUrl;
      }
      
      window.resolvePrintMediaUrl = resolvePrintMediaUrl;
      
      async function loadYazdirmaAyarlar(force = false) {
        if (!force && window.floovonYazdirmaAyarlar) return window.floovonYazdirmaAyarlar;
        try {
          const response = await fetch(FLOOVON_API_BASE + '/ayarlar/yazdirma');
          const result = await response.json();
          if (result.success && result.data) {
            const data = result.data;
            window.floovonYazdirmaAyarlar = {
              ...data,
              is_active: data.is_active === undefined ? true : Boolean(data.is_active),
              logo_png_url: resolvePrintMediaUrl(data.logo_png_url || data.logo_png_path)
            };
            return window.floovonYazdirmaAyarlar;
          }
        } catch (error) {
          console.error('❌ Yazdırma ayarları alınamadı:', error);
        }
        return null;
      }
      
      // BroadcastChannel ile logo güncellemelerini dinle (IIFE içinde)
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const logoUpdateChannel = new BroadcastChannel('floovon-print-logo-update');
          logoUpdateChannel.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'PRINT_LOGO_UPDATED') {
              console.log('🔄 Yazdırma logosu güncellendi (IIFE), cache temizleniyor...');
              // Cache'i temizle ve yeniden yükle
              window.floovonYazdirmaAyarlar = null;
              loadYazdirmaAyarlar(true).then(() => {
                console.log('✅ Yazdırma logo cache güncellendi (IIFE)');
              }).catch(err => {
                console.error('❌ Logo cache güncelleme hatası (IIFE):', err);
              });
            }
          });
        } catch (broadcastError) {
          console.warn('⚠️ BroadcastChannel oluşturulamadı (IIFE, devam ediliyor):', broadcastError);
        }
      }
      
      async function ayarlarSayfasindanIsletmeBilgileriCek() {
        try {
          const apiBase = window.getFloovonApiBase ? window.getFloovonApiBase() : (window.API_BASE_URL || FLOOVON_API_BASE);
          const response = await fetch(apiBase + '/ayarlar/isletme');
          const result = await response.json();
          
          if (result.success && result.data) {
            const data = result.data;
            const bilgiler = {
              logo: data.logo_path || '',
              firmaAdi: data.isletme_adi || '',
              telefon: data.telefon || '',
              whatsapp: data.whatsapp || '',
              website: data.website || '',
              il: data.il || '',
              ilce: data.ilce || '',
              adres: data.adres || ''
            };
            applyYazdirmaLogoPreference(bilgiler);
            return bilgiler;
          }
        } catch (error) {
          console.warn('⚠️ Backend API\'den işletme bilgileri alınamadı:', error);
        }
        
        const localData = localStorage.getItem('floovon-isletme-ayarlari');
        if (localData) {
          try {
            const parsed = JSON.parse(localData);
            const bilgiler = {
              logo: parsed['company-logo-src'] || '',
              firmaAdi: parsed['isletme-adi'] || '',
              telefon: parsed['isletme-telefon'] || '',
              whatsapp: parsed['isletme-whatsapp'] || '',
              website: parsed['isletme-website'] || '',
              il: parsed['isletme-il'] || '',
              ilce: parsed['isletme-ilce'] || '',
              adres: parsed['isletme-adres'] || ''
            };
            applyYazdirmaLogoPreference(bilgiler);
            return bilgiler;
          } catch (e) {
            console.warn('⚠️ localStorage verisi parse edilemedi:', e);
          }
        }
        
        const bilgiler = {
          logo: '',
          firmaAdi: '',
          telefon: '',
          whatsapp: '',
          website: '',
          il: '',
          ilce: '',
          adres: ''
        };
        applyYazdirmaLogoPreference(bilgiler);
        return bilgiler;
      }
      
      function applyYazdirmaLogoPreference(bilgiler) {
        if (!bilgiler) return;
        const settings = window.floovonYazdirmaAyarlar;
        if (!settings) return;
        
        const isActive = settings.is_active === undefined || settings.is_active === null ? true : Boolean(settings.is_active);
        if (!isActive) return;
        
        // Logo sadece veritabanından — varsayılan logo yok
        const pngUrl = resolvePrintMediaUrl(settings.logo_png_url || settings.logo_png_path);
        if (pngUrl) {
          bilgiler.logo = pngUrl;
        }
      }
      
      async function kunyeyeDinamikIsletmeBilgileriEkle(kunyeTemplate) {
        await loadYazdirmaAyarlar();
        const bilgiler = await ayarlarSayfasindanIsletmeBilgileriCek();
        // Logo sadece veritabanından (applyYazdirmaLogoPreference ile)
        const tamAdres = [bilgiler.adres, bilgiler.ilce, bilgiler.il]
          .filter(item => item && item.trim())
          .join(', ');
        
        const isletmeBilgileriHTML = '<div class="k-isletme-bilgileri-container">' +
          '<div class="k-isletme-detay-wrapper">' +
          '<div class="k-isletme-tam-adres">' + tamAdres + '</div>' +
          '<div class="k-isletme-iletisim-satiri">' +
          (bilgiler.telefon ? '<span class="k-isletme-telefon-item"><i class="fa-solid fa-phone"></i>' + formatPhoneNumberKunye(bilgiler.telefon) + '</span>' : '') +
          (bilgiler.whatsapp ? '<span class="k-isletme-whatsapp-item"><i class="fa-brands fa-whatsapp"></i>' + formatPhoneNumberKunye(bilgiler.whatsapp) + '</span>' : '') +
          '</div>' +
          '<div class="k-isletme-web-satiri">' +
          (bilgiler.website ? '<span class="k-isletme-website-item"><i class="fas fa-globe"></i>' + bilgiler.website + '</span>' : '') +
          '</div>' +
          '</div>' +
          '<div class="k-isletme-logo-wrapper">' +
          (bilgiler.logo ? '<img class="k-isletme-logo-img" src="' + bilgiler.logo + '" alt="İşletme Logosu" />' : '') +
          '</div>' +
          '</div>';
        
        kunyeTemplate.insertAdjacentHTML('beforeend', isletmeBilgileriHTML);
      }
      
      window.kunyeyeDinamikIsletmeBilgileriEkle = kunyeyeDinamikIsletmeBilgileriEkle;
      window.floovonKunyeFunctionsReady = true;
    })();
  </script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>

    :root {
      --ana-renk: #2E3237;
      --white: #ffffff;
      --gray-basic: gray;
      --box-shadow-light: rgba(0,0,0,.15);
      --primary-pink: #ff3b7b;
      --full-black: #000000;
      --black-true: #000000;
    }
    body.dark-mode {
      --ana-renk: #e5e5e5;
      --white: #1D2026;
      --gray-basic: #999999;
    }
    body {
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      font-family: 'Euclid Circular B' !important;
      font-size: 18px;
      text-align: center;
      padding: 0 20px;
      background-color: var(--white);
      color: var(--ana-renk);
    }

    /* Telefon numaralarını tek satırda göster */
    .k-telefon,
    .k-teslimtel {
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      max-width: 100% !important;
    }
    
    /* Tüm telefon span'leri için */
    #teslim-kisisi-telefon,
    #siparis-veren-telefon,
    #teslim-kisisi-telefon a,
    #siparis-veren-telefon a {
      white-space: nowrap !important;
      display: inline-block !important;
    }

    .message {
      display: flex;
      flex-direction: column;
      align-items: center;
      font-size: 20px;
      line-height: 1.5;
      padding: 20px;
      border-radius: 15px;
      background-color: var(--white);
    }
    .message span { font-size: 16px; font-weight: 400; }
    .loading-icon {
      width: 48px;
      height: 48px;
      border: 4px solid var(--box-shadow-light);
      border-top: 4px solid var(--primary-pink);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 10px;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100%{ transform: rotate(360deg);} }

    /* Künye Template Stilleri - CSS'ten alındı - TAM KOPYA */
    .kunye-template {
      position: relative;
      height: min(700px, 100vh);
      aspect-ratio: 760 / 1116;
      overflow: visible;
      margin: auto;
    }

    .kunye-bg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      z-index: 0;
    }

    .kunye-template.rotated {
      transform: rotate(90deg);
      transform-origin: top left;
      width: 110mm;
      height: 75mm;
    }

    .k-date,
    .k-time,
    .k-telefon,
    .k-urunturu,
    .k-adres,
    .k-teslimkisi,
    .k-teslimtel,
    .k-karttur,
    .k-konum {
      position: absolute;
      font-size: 16px;
      color: var(--black-true);
      white-space: pre-line;
      font-weight: 500;
      text-align: left;
    }

    .k-date {
      top: 25px;
      left: 273px;
      font-size: 25px;
      font-weight: 500;
      width: 35%;
      text-align: center;
      width: 40%;
    }

    .k-time {
      top: 68px;
      left: 273px;
      font-size: 42px;
      font-weight: 600;
      width: 40%;
      text-align: center;
    }

    .k-siparisveren {
      display: none;
    }

    .k-telefon {
      top: 148px;
      right: 18px;
      color: var(--gray-basic);
      width: 100%;
      white-space: nowrap;
      text-align: right;
    }

    .k-urunturu {
      top: 192px;
      left: 118px;
      white-space: normal;
    }

    .k-urunturu .etiket {
      font-size: 20px;
      font-weight: 400;
    }

    .k-karttur {
      top: 237px;
      right: 14px;
      font-size: 16px;
      text-align: right;
      width: fit-content;
      background: var(--full-black);
      color: var(--white);
      padding: 10px 15px;
      border-radius: 5px 5px 0 5px;
    }

    .k-adres {
      top: 315px;
      left: 28px;
      width: 88%;
      font-size: 20px;
      font-weight: 500;
    }

    .k-konum {
      top: 280px;
      left: 28px;
      width: 88%;
      font-size: 24px;
      font-weight: 600;
      white-space: normal;
    }

    .k-teslimkisi {
      top: 455px;
      left: 28px;
      font-size: 20px;
      font-weight: 600;
    }

    .k-teslimtel {
      top: 485px;
      left: 28px;
      font-size: 18px;
      font-weight: 500;
    }

    .k-qrcode {
      position: absolute;
      right: 15px;
      bottom: 95px;
      width: 110px;
      height: 110px;
      display: grid;
      place-items: center;
      overflow: hidden;
      z-index: 9999;
    }

    .k-qrcode svg,
    .k-qrcode canvas {
      width: 100%;
      height: 100%;
      display: block;
    }

    /* Künyede İşletme Bilgileri Stilleri */
    .k-isletme-bilgileri-container {
      position: absolute;
      bottom: 8px;
      left: 15px;
      right: 15px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-radius: 6px;
      font-family: inherit;
      z-index: 10;
    }

    .k-isletme-logo-wrapper {
      flex-shrink: 0;
      /* REVIZE-30: Logo yüksekliği sabit, genişlik otomatik - Değiştirmek için height ve max-width değerlerini düzenleyin */
      width: auto;  /* Logo genişliği otomatik - Logo oranına göre ayarlanır */
      max-width: 200px;  /* Maksimum genişlik - İstediğiniz değeri buraya yazın */
      height: 60px;  /* Logo yüksekliği sabit - İstediğiniz değeri buraya yazın */
      border-radius: 4px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
    }

    .k-isletme-logo-img {
      width: auto;  /* Logo genişliği otomatik - Oranı korur, sıkıştırmaz */
      height: 100%;  /* Logo yüksekliği wrapper yüksekliğine eşit (60px) */
      max-width: 100%;  /* Wrapper genişliğini aşmasın */
      object-fit: contain;  /* Logo oranını korur, sıkıştırmaz */
    }

    .k-isletme-detay-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }

    .k-isletme-tam-adres {
      font-size: 12px;
      color: #000;
      line-height: 1.2;
      margin-bottom: 2px;
      word-wrap: break-word;
      text-align: left;
    }

    .k-isletme-iletisim-satiri {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 8px;
      row-gap: 0;
      font-size: 12px;
      font-weight: 600;
      color: #000;
      line-height: 1.2;
      margin: 0;
      padding: 0;
    }

    .k-isletme-telefon-item,
    .k-isletme-whatsapp-item {
      margin: 0;
      padding: 0;
    }

    .k-isletme-web-satiri {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #000;
      line-height: 1.2;
      margin: 0;
      padding: 0;
    }

    .k-isletme-telefon-item i,
    .k-isletme-whatsapp-item i,
    .k-isletme-eposta-item i,
    .k-isletme-website-item i {
      font-size: 12px;
      margin-right: 4px;
    }

  </style>
</head>
<body style="background-color: #ffffff; margin: 0; padding: 0; overflow: hidden;">
  <div id="kunyeler" style="position:absolute; left:0; top:0; visibility:visible; opacity:1;">
    ${contentHTML}
  </div>
  <div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: #ffffff; z-index: 9999; pointer-events: none;"></div>
</body>
</html>
  `);

  newWindow.document.close();

  newWindow.onload = async () => {
    // 1) QR Kodları üret
    newWindow.document.querySelectorAll(".kunye-template").forEach((tpl, i) => {
      const qrContainer = tpl.querySelector(".k-qrcode");
      if (!qrContainer) return;

      let orderId = tpl.getAttribute("data-order-id") || `ORD-${Date.now()}-${i}`;
      orderId = (orderId || "").trim();
      if (!orderId) {
        console.warn("QR atlandı: orderId boş", tpl);
        return;
      }

      qrContainer.innerHTML = "";
      new newWindow.QRCode(qrContainer, {
        text: orderId,
        width: 100,
        height: 100
      });
    });

    // İşletme bilgileri zaten HTML'de var, ek bir işlem gerekmiyor

     // 2) Görsellerin yüklenmesini bekle ve PDF üret
     const waitForImages = () => {
       return new Promise((resolve) => {
         const images = newWindow.document.querySelectorAll('img');
         
         if (images.length === 0) {
           resolve();
           return;
         }

         let loadedCount = 0;
         let errorCount = 0;
         
         const checkComplete = () => {
           if (loadedCount + errorCount >= images.length) {
             resolve();
           }
         };

         images.forEach((img, index) => {
           
           // CORS ayarı
           try {
             img.crossOrigin = 'anonymous';
           } catch (e) {
             console.warn('CORS ayarı yapılamadı:', e);
           }

           if (img.complete && img.naturalWidth > 0) {
             loadedCount++;
             checkComplete();
           } else {
             img.onload = () => {
               loadedCount++;
               checkComplete();
             };
             
             img.onerror = () => {
               console.error(`Görsel ${index + 1} yüklenemedi: ${img.src}`);
               errorCount++;
               checkComplete();
             };
           }
         });

         // 5 saniye timeout
         setTimeout(() => {
           resolve();
         }, 5000);
       });
     };

    // Görselleri bekle ve PDF oluştur
    waitForImages().then(async () => {
      // Template container'ı html2canvas için hazırla (görünür ama beyaz overlay ile kaplı)
      const kunyelerContainer = newWindow.document.getElementById('kunyeler');
      if (kunyelerContainer) {
        // Container'ı görünür tut (html2canvas için gerekli)
        kunyelerContainer.style.position = 'absolute';
        kunyelerContainer.style.left = '0';
        kunyelerContainer.style.top = '0';
        kunyelerContainer.style.visibility = 'visible';
        kunyelerContainer.style.opacity = '1';
      }
      
      // Yeni pencerenin yüklenmesini bekle (daha uzun süre)
      let retries = 0;
      const maxRetries = 10;
      const { jsPDF } = newWindow.jspdf;
      const templates = newWindow.document.querySelectorAll(".kunye-template");
      
      if (templates.length === 0) {
        console.error('❌ Hiç template bulunamadı!');
        if (typeof createToast === 'function') {
          createToast('error', 'Künye template\'leri bulunamadı!');
        }
        newWindow.close();
        return;
      }

      // Kağıt Boyutu 100x17cm (yatay) - eski sistem ile birebir
      const pdf = new jsPDF({ orientation: 'l', unit: 'mm', format: [1000, 170] });
      // Künye boyutu: 110mm x 75mm (yatay - genişlik x yükseklik)
      const kWidth = 110, kHeight = 75;
      const columns = 2;
      const offsetX = 10;
      const offsetY = (170 - kHeight * columns) / 2;

       for (let i = 0; i < templates.length; i++) {
         const tpl = templates[i];
         // PDF için tam çözünürlük: scale(0.5) kaldır, sadece rotate ile yakala (görsel bozulmasın)
         const oldTransform = tpl.style.transform;
         const oldOrigin = tpl.style.transformOrigin;
         tpl.style.transform = 'rotate(-90deg)';
         tpl.style.transformOrigin = 'left top';
         const canvas = await newWindow.html2canvas(tpl, {
           useCORS: true,
           allowTaint: true,
           scale: 2,
           logging: false,
           foreignObjectRendering: false,
           removeContainer: true,
           imageTimeout: 5000,
           backgroundColor: null
         });
         tpl.style.transform = oldTransform;
         tpl.style.transformOrigin = oldOrigin;
         const imgData = canvas.toDataURL("image/png");

        const row = Math.floor(i / columns);
        const col = i % columns;
        const x = offsetX + row * kWidth;
        const y = offsetY + col * kHeight;

        pdf.addImage(imgData, "PNG", x, y, kWidth, kHeight);
      }

      // Dinamik PDF adı
      const rawTarih = getText(anaKart, anaKart, '.teslim-zaman .tarih');
      const kartTurValue = getText(anaKart, anaKart, '.kart-tur');
      const kartEtiketValue = getText(anaKart, anaKart, '.kart-etiket');
      const kisiValue = getText(anaKart, anaKart, '.kisi-isim');

      // Organizasyon sahibi bilgisini al
      let organizasyonSahibi = '';
      if (kartTurValue && (kartTurValue === "Düğün" || kartTurValue === "Nişan" || kartTurValue === "Sünnet" || kartTurValue === "Organizasyon")) {
        // Organizasyon sahibi için farklı selector'ları dene (önce sahip-ve-zaman içinden)
        const orgSahibiSelectors = [
          '.sahip-ve-zaman .organizasyon-sahibi .teslim-kisisi',
          '.organizasyon-sahibi .teslim-kisisi',
          '.organizasyon-sahip .teslim-kisisi',
          '.sahip-ve-zaman .teslim-kisisi',
          '.organizasyon-sahibi',
          '.organizasyon-sahip'
        ];
        
        for (const selector of orgSahibiSelectors) {
          const el = anaKart.querySelector(selector);
          if (el && el.textContent.trim()) {
            organizasyonSahibi = el.textContent.trim();
            break;
          }
        }
        
        // Eğer hala bulunamadıysa, ilk sipariş kartından dene
        if (!organizasyonSahibi && siparisKartlari.length > 0) {
          const ilkKart = siparisKartlari[0];
          const teslimKisi = getTeslimKisiFromCard(ilkKart, anaKart);
          if (teslimKisi) {
            organizasyonSahibi = teslimKisi;
          }
        }
      }

      let pdfAdi = `Sipariş Künyesi - ${rawTarih} - ${kartTurValue}`;
      if (kartTurValue === "Özel Sipariş") {
        // Özel Sipariş: pdfAdi değişmeden devam eder
      } else if (kartTurValue === "Özel Gün" && kartEtiketValue && kartEtiketValue.trim()) {
        pdfAdi += ` - ${kartEtiketValue.trim()}`;
      } else if (organizasyonSahibi && (kartTurValue === "Düğün" || kartTurValue === "Nişan" || kartTurValue === "Sünnet" || kartTurValue === "Organizasyon")) {
        // Organizasyon kartları için organizasyon sahibi ekle
        pdfAdi += ` - ${organizasyonSahibi}`;
      } else if (kisiValue) {
        pdfAdi += ` - ${kisiValue}`;
      }
      pdfAdi += ".pdf";

      // PDF'i direkt indir, pencereyi hemen kapat
      pdf.save(pdfAdi);
      // Pencereyi kapat (kullanıcı görmez)
      setTimeout(() => {
        newWindow.close();
      }, 100);
     });
  };
}

// #endregion

/* ====== Opsiyonel: createQRData patch'i (varsa) ====== */
(function patchCreateQRData() {
  if (typeof createQRData !== 'function') return;
  const _orig = createQRData;
  window.createQRData = function (kart, anaKart) {
    const json = JSON.parse(_orig(kart, anaKart));
    const orderId =
      kart?.getAttribute('data-order-id') ||
      anaKart?.getAttribute('data-order-id') ||
      kart?.id || anaKart?.id || '';
    json.orderId = orderId;
    return JSON.stringify(json);
  };
})();

// React için window'a export et
if (typeof window !== 'undefined') {
  window.yazdirSiparisKunyeToplu = yazdirSiparisKunyeToplu;
}