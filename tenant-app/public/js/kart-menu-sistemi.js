// kart-menu-sistemi.js
// ============================================================================
// KART MENÜ SİSTEMİ - Kart Menü Event Listener'ları + Yardımcı Fonksiyonlar
// ============================================================================
// TAŞINDI: script.js'den (2026-02-08)
// İçerik: setupKartMenuEventListeners, setupKartMenuContentButtons,
//   setupDüzenleEventListeners, setupYeniSiparisEkleEventListeners,
//   openYeniSiparisEklemeFormu, getOrganizasyonKartSayacBilgileri,
//   loadOrganizasyonBilgileri, loadFormProfilResmi
// ============================================================================

// Kart menü event listener'larını kurma fonksiyonu
function setupKartMenuEventListeners() {
    // Mevcut event listener'ları kaldır
    $('body').off('click', '.kart-menu-buton');
    $(document).off('click.kartMenuClose');
    
    // Yeni event listener'ı kur
    $('body').on('click', '.kart-menu-buton', function () {
        const $parent = $(this).closest('.kart-menu');
        $('.kart-menu-content').not($parent.find('.kart-menu-content')).slideUp(0);
        $parent.find('.kart-menu-content').slideToggle(0);
    });
    
    // Dışarı tıklanınca tüm menüleri kapat
    $(document).on('click.kartMenuClose', function (event) {
        // Eğer tıklanan element .kart-menu içinde değilse, tüm menüleri kapat
        if (!$(event.target).closest('.kart-menu').length) {
            $('.kart-menu-content').slideUp(0);
        }
    });
    
}

// Kart menu content butonları için delegasyon sistemi
function setupKartMenuContentButtons() {
    // Mevcut event listener'ları kaldır
    $('body').off('click', '.karti-arsivle[data-organizasyon-arsivle], .kart-siparis-kunyesi-yazdir');
    
    // NOT: Düzenle butonu setupKartiDuzenleDelegated() fonksiyonunda çalışıyor
    // NOT: Kopya oluştur butonu devre dışı bırakıldı (kullanıcı isteği)
    
    // Tümünü teslim edildi işaretle butonu
    // NOT: Bu event listener DEVRE DIŞI BIRAKILDI - checkbox event listener kullanılıyor (setupTumuTeslimEdildiCheckbox)
    // Checkbox kullanıldığı için bu jQuery event listener çalışmıyor
    // İki kere toast ve imza formu açılmasını engellemek için devre dışı bırakıldı
    $('body').off('click', '#tum-kartlari-teslim-edildi-olarak-isaretle'); // Önceki event listener'ları kaldır
    
    // Event listener devre dışı - checkbox event listener kullanılıyor
    // Eğer checkbox yoksa veya checkbox event listener çalışmıyorsa aşağıdaki kodu aktif edebilirsiniz:
    /*
    $('body').on('click', '#tum-kartlari-teslim-edildi-olarak-isaretle', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        const item = $(this).closest('.item');
        const skKartAlan = item.find('.sk-kart-alan');
        if (!item.length || !skKartAlan.length) return;
        
        // Menü kapat
        const menu = $(this).closest('.kart-menu-content');
        if (menu.length) menu[0].style.display = 'none';
        
        // Önce toast göster, evet deyince WhatsApp kontrolü yap
        createToastInteractive({
            message: "Bu organizasyondaki tüm siparişleri teslim edildi olarak işaretlemek istediğinize emin misiniz?",
            confirmText: "Evet",
            cancelText: "Hayır",
            onConfirm: async () => {
                // Evet deyince WhatsApp bağlantısını kontrol et
                try {
                    const apiBase = (typeof window.getFloovonApiBase === 'function') 
            ? window.getFloovonApiBase() 
            : (window.API_BASE_URL || ((typeof window.getFloovonApiBase === 'function') 
                ? window.getFloovonApiBase() 
                : (window.getFloovonApiBase ? window.getFloovonApiBase() : (window.API_BASE_URL || '/api'))));
        const statusResponse = await fetch(`${apiBase}/whatsapp/status`);
                    const statusData = await statusResponse.json();
                    
                    const isConnected = statusData.installed && 
                                      (statusData.isReady || statusData.isAuthenticated) && 
                                      !statusData.isDisconnected;
                    
                    if (!isConnected) {
                        // WhatsApp bağlı değil, önce QR kod popup göster
                        const kartlar = skKartAlan.find('.siparis-kart');
                        if (kartlar.length > 0) {
                            // İlk siparişin telefon numarasını al
                            const firstKart = kartlar.first();
                            const telefon = firstKart.find('.teslim-kisisi-telefon')?.text().trim() || 
                                         firstKart.find('[data-telefon]')?.attr('data-telefon') || 
                                         '';
                            
                            // QR kod popup göster ve bağlantı kurulmasını bekle
                            await showWhatsAppQRCodePopupAndWait(telefon, '', async () => {
                                // Bağlantı kurulduktan sonra siparişleri işaretle (toast gösterme)
                                const kartlar = skKartAlan.find('.siparis-kart');
                                for (let i = 0; i < kartlar.length; i++) {
                                    const siparisKart = kartlar.eq(i);
                                    const teslimButon = siparisKart.find('.siparis-kart-icon[data-tooltip="Teslim Edildi İşaretle"]');
                                    
                                    if (teslimButon.length && !teslimButon.hasClass('teslim-edildi')) {
                                        // Native click event kullan
                                        const nativeButton = teslimButon[0];
                                        if (nativeButton) {
                                            nativeButton.click();
                                            // Her buton arasında kısa bir bekleme
                                            await new Promise(resolve => setTimeout(resolve, 100));
                                        }
                                    }
                                }
                                
                                createToast('success', 'Tüm siparişler teslim edildi olarak işaretlendi!');
                            });
                        }
                        return;
                    }
                } catch {
                    // Hata durumunda da QR kod popup göster
                    const kartlar = skKartAlan.find('.siparis-kart');
                    if (kartlar.length > 0) {
                        const firstKart = kartlar.first();
                        const telefon = firstKart.find('.teslim-kisisi-telefon')?.text().trim() || 
                                       firstKart.find('[data-telefon]')?.attr('data-telefon') || 
                                       '';
                        await showWhatsAppQRCodePopupAndWait(telefon, '', async () => {
                            const kartlar = skKartAlan.find('.siparis-kart');
                            for (let i = 0; i < kartlar.length; i++) {
                                const siparisKart = kartlar.eq(i);
                                const teslimButon = siparisKart.find('.siparis-kart-icon[data-tooltip="Teslim Edildi İşaretle"]');
                                
                                if (teslimButon.length && !teslimButon.hasClass('teslim-edildi')) {
                                    const nativeButton = teslimButon[0];
                                    if (nativeButton) {
                                        nativeButton.click();
                                        await new Promise(resolve => setTimeout(resolve, 100));
                                    }
                                }
                            }
                            
                            createToast('success', 'Tüm siparişler teslim edildi olarak işaretlendi!');
                        });
                    }
                    return;
                }
                
                // WhatsApp bağlıysa direkt siparişleri işaretle
                const kartlar = skKartAlan.find('.siparis-kart');
                kartlar.each(function() {
                    const siparisKart = $(this);
                    const teslimButon = siparisKart.find('.siparis-kart-icon[data-tooltip="Teslim Edildi İşaretle"]');
                    
                    if (teslimButon.length && !teslimButon.hasClass('teslim-edildi')) {
                        teslimButon.click();
                    }
                });
                
                createToast('success', 'Tüm siparişler teslim edildi olarak işaretlendi!');
            }
        });
    });
    */
    
    // Kartı arşivle butonu - arsiv-siparisler.js'deki event listener kullanılıyor, burada devre dışı
    
    // Sipariş künyesi yazdır butonu - çift çalışmayı önlemek için
    $('body').off('click', '.kart-siparis-kunyesi-yazdir').on('click', '.kart-siparis-kunyesi-yazdir', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Çift tıklamayı önle
        if ($(this).data('processing')) {
            return false;
        }
        $(this).data('processing', true);
        
        const anaKart = $(this).closest('.ana-kart');
        if (!anaKart.length) {
            console.error('❌ Ana kart bulunamadı');
            $(this).data('processing', false);
            return;
        }
        
        const self = this;
        if (typeof yazdirSiparisKunyeToplu === 'function') {
            // Async fonksiyon olduğu için Promise olarak çağır
            Promise.resolve(yazdirSiparisKunyeToplu(anaKart[0])).then(() => {
                // İşlem tamamlandıktan sonra flag'i temizle
                setTimeout(() => {
                    $(self).data('processing', false);
                }, 1000);
            }).catch(() => {
                // Hata durumunda da flag'i temizle
                setTimeout(() => {
                    $(self).data('processing', false);
                }, 1000);
            });
        } else {
            console.error('❌ yazdirSiparisKunyeToplu fonksiyonu bulunamadı');
            createToast('error', 'Yazdırma fonksiyonu bulunamadı!');
            $(self).data('processing', false);
        }
    });
    
    // WhatsApp listesi paylaş butonu - whatsapp-paylas.js içindeki event listener'a bırak
    // Bu fonksiyon zaten mevcut, burada tekrar tanımlamaya gerek yok
}

// Düzenle butonları için event listener'ları kur
function setupDüzenleEventListeners() {
    // Mevcut event listener'ları kaldır
    $('body').off('click', '.siparis-kart-icon[data-tooltip="Düzenle"]');
    $('body').off('click', '.siparis-kart-icon');
    
    // Yeni event listener'ı kur - daha geniş selector
    $('body').on('click', '.siparis-kart-icon', function (e) {
        e.stopPropagation();
        
        // Düzenle butonu kontrolü
        const tooltip = $(this).attr('data-tooltip');
        if (tooltip === 'Düzenle') {
            const siparisKart = $(this).closest('.siparis-kart')[0];
            if (!siparisKart) {
                console.warn('⚠️ Sipariş kartı bulunamadı');
                return;
            }
            
            // Sipariş ID'sini al
            const orderId = siparisKart.getAttribute('data-order-id') || siparisKart.id;
            // Ana kartı bul ve kart türünü al
            const anaKart = $(siparisKart).closest('.ana-kart')[0];
            if (!anaKart) {
                console.warn('⚠️ Ana kart bulunamadı');
                return;
            }
            
            const kartTuru = anaKart.querySelector('.kart-tur')?.textContent.trim();
            const organizasyonId = anaKart.dataset.organizasyonId;
            
            // Düzenleme formunu aç - yeni sipariş ekleme formu olarak
            if (typeof openSiparisDuzenlemeFormu === 'function') openSiparisDuzenlemeFormu(siparisKart, kartTuru, organizasyonId, orderId);
            
            return;
        }
        
        // Arşivle butonu kontrolü
        if ($(this).attr('data-siparis-arsivle')) {
            return;
        }
        
        // Teslim edildi butonu kontrolü
        if (tooltip === 'Teslim Edildi İşaretle' || tooltip === 'Süsleme Tamamlandı') {
            return;
        }
        
    });
    
}

// Yeni sipariş ekle butonları için event listener'ları kur
function setupYeniSiparisEkleEventListeners() {
    // Mevcut event listener'ları kaldır
    $('body').off('click', '.btn-yeni-siparis-ekle');
    
    // Yeni event listener'ı kur
    $('body').on('click', '.btn-yeni-siparis-ekle', function (e) {
        e.stopPropagation();
        const anaKart = $(this).closest('.ana-kart')[0];
        if (!anaKart) {
            console.warn('⚠️ Ana kart bulunamadı');
            createToast('error', 'Ana kart bulunamadı!');
            return;
        }
        
        // Kart türünü al
        const kartTuru = anaKart.querySelector('.kart-tur')?.textContent.trim();
        const organizasyonId = anaKart.dataset.organizasyonId;
        
        // Yeni sipariş ekleme formunu aç
        openYeniSiparisEklemeFormu(kartTuru, organizasyonId, anaKart);
    });
    
}

// Yeni sipariş ekleme formunu aç
function openYeniSiparisEklemeFormu(kartTuru, organizasyonId, anaKartElement = null) {
    const kartSayacBilgileri = getOrganizasyonKartSayacBilgileri(organizasyonId, anaKartElement);

    // Organizasyon bilgilerini al
    loadOrganizasyonBilgileri(organizasyonId).then(organizasyonData => {
        // Formu göster
        openSiparisForm(kartTuru, organizasyonId, organizasyonData, false, null, null, kartSayacBilgileri);
        
    }).catch(error => {
        console.error('❌ Organizasyon bilgileri yüklenemedi:', error);
        createToast('warning', 'Organizasyon bilgileri yüklenemedi, varsayılan form açılıyor...');
        
        // Varsayılan verilerle form aç
        openSiparisForm(kartTuru, organizasyonId, null, false, null, null, kartSayacBilgileri);
    });
}

function getOrganizasyonKartSayacBilgileri(organizasyonId, kartElement = null) {
    let anaKart = kartElement || null;

    if (!anaKart && organizasyonId) {
        anaKart = document.querySelector(`.ana-kart[data-organizasyon-id="${organizasyonId}"]`);
        if (!anaKart) {
            const item = document.querySelector(`.item[data-organizasyon-id="${organizasyonId}"]`);
            if (item) {
                anaKart = item.querySelector('.ana-kart');
            }
        }
    }

    if (!anaKart) {
        return null;
    }

    let teslimEdilen = null;
    let toplam = null;

    const sayacDiv = anaKart.querySelector('.toplam-siparisler');
    if (sayacDiv) {
        const matches = sayacDiv.textContent.trim().match(/(\d+)\s*\/\s*(\d+)/);
        if (matches) {
            teslimEdilen = Number(matches[1]);
            toplam = Number(matches[2]);
        }
    }

    if ((teslimEdilen === null || Number.isNaN(teslimEdilen)) ||
        (toplam === null || Number.isNaN(toplam))) {
        if (typeof window.SiparisSayacYoneticisi !== 'undefined' && window.SiparisSayacYoneticisi !== null) {
            const hesaplanan = window.SiparisSayacYoneticisi.hesaplaGercekSayilar(anaKart);
            if (teslimEdilen === null || Number.isNaN(teslimEdilen)) {
                teslimEdilen = hesaplanan?.teslimEdilen ?? teslimEdilen;
            }
            if (toplam === null || Number.isNaN(toplam)) {
                toplam = hesaplanan?.toplam ?? toplam;
            }
        }
    }

    if (toplam === null || Number.isNaN(toplam)) {
        toplam = anaKart.querySelectorAll('.siparis-kart').length || 0;
    }

    if (teslimEdilen === null || Number.isNaN(teslimEdilen)) {
        teslimEdilen = 0;
    }

    const partnerEl = anaKart.querySelector('.partner-siparis-sayisi');
    let partnerSayisi = null;
    if (partnerEl) {
        const rawText = partnerEl.textContent.trim();
        if (rawText === '') {
            partnerSayisi = 0;
        } else {
            const parsed = parseInt(rawText, 10);
            if (!Number.isNaN(parsed)) {
                partnerSayisi = parsed;
            }
        }
    }

    return {
        teslimEdilen,
        toplam,
        partnerSayisi
    };
}

// Organizasyon bilgilerini backend'den yükle
async function loadOrganizasyonBilgileri(organizasyonId) {
    try {
        const response = await (window.floovonFetch || window.floovonFetchStandard || fetch)(`/organizasyon-kartlar/${organizasyonId}`);
        
        let data;
        if (window.floovonFetch || window.floovonFetchStandard) {
            // floovonFetch zaten JSON parse ediyor ve success kontrolü yapıyor
            if (!response || !response.success) {
                console.warn('⚠️ Organizasyon bilgileri yüklenemedi, varsayılan değerler kullanılacak');
                return null;
            }
            data = response;
        } else {
            if (!response.ok) {
                console.warn('⚠️ Organizasyon bilgileri yüklenemedi, varsayılan değerler kullanılacak');
                return null;
            }
            data = await response.json();
        }
        
        return data.success ? data.data : null;
    } catch (error) {
        console.warn('⚠️ Organizasyon bilgileri yükleme hatası, varsayılan değerler kullanılacak:', error.message);
        return null;
    }
}

// Form içindeki profil resmini yükle - UserSession ile entegre edildi
async function loadFormProfilResmi(container = null) {
    try {
        // UserSession'dan kullanıcı bilgisini al
        if (!window.userSession) {
            // Kısa bir süre bekle
            await new Promise(resolve => setTimeout(resolve, 100));
            if (!window.userSession) {
                // UserSession bulunamadı, sessizce çık
                return;
            }
        }
        
        // Backend'den güncel profil resmini al (cache'lenmiş veriyi kullanma)
        let profilResmi;
        try {
            // Önce UserSession'dan deneyelim (daha hızlı)
            if (window.userSession && typeof window.userSession.getUserAvatar === 'function') {
                profilResmi = window.userSession.getUserAvatar(false); // cache'den al
                if (profilResmi && profilResmi.trim() !== '' && !profilResmi.includes('profil-default.jpg')) {
                    // UserSession'dan geçerli bir profil resmi varsa kullan
                    if (typeof window.fixBackendUrl === 'function') {
                        profilResmi = window.fixBackendUrl(profilResmi);
                    }
                } else {
                    // Backend'den güncel veriyi çek
                    let result;
                    if (window.floovonFetch) {
                        result = await window.floovonFetch(`/api/auth/me`);
                    } else {
                        const response = await fetch(`/api/auth/me`);
                        result = await response.json();
                    }
                    if (result && result.success && result.data && result.data.profil_resmi) {
                        profilResmi = result.data.profil_resmi;
                        // Backend'den gelen URL'i düzelt
                        if (typeof window.fixBackendUrl === 'function') {
                            profilResmi = window.fixBackendUrl(profilResmi);
                        }
                        // UserSession'ı güncelle
                        if (window.userSession && window.userSession.currentUser) {
                            window.userSession.currentUser.profil_resmi = profilResmi;
                        }
                    } else {
                        // Fallback: UserSession'dan al (forceRefresh)
                        profilResmi = window.userSession.getUserAvatar(true);
                        if (typeof window.fixBackendUrl === 'function' && profilResmi) {
                            profilResmi = window.fixBackendUrl(profilResmi);
                        }
                    }
                }
            } else {
                // UserSession yoksa direkt backend'den çek
                let result;
                if (window.floovonFetch) {
                    result = await window.floovonFetch(`/api/auth/me`);
                } else {
                    const response = await fetch(`/api/auth/me`);
                    result = await response.json();
                }
                if (result && result.success && result.data && result.data.profil_resmi) {
                    profilResmi = result.data.profil_resmi;
                    if (typeof window.fixBackendUrl === 'function') {
                        profilResmi = window.fixBackendUrl(profilResmi);
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Backend\'den profil resmi alınamadı, UserSession kullanılıyor:', error);
            // Fallback: UserSession'dan al
            if (window.userSession && typeof window.userSession.getUserAvatar === 'function') {
                profilResmi = window.userSession.getUserAvatar(true); // forceRefresh = true
                if (typeof window.fixBackendUrl === 'function' && profilResmi) {
                    profilResmi = window.fixBackendUrl(profilResmi);
                }
            }
            // Eğer hala profil resmi yoksa, default kullan
            if (!profilResmi || profilResmi.trim() === '') {
                let backendBaseUrl = (typeof window.getFloovonBackendBase === 'function') 
                    ? window.getFloovonBackendBase() 
                    : (window.BACKEND_BASE_URL || '');
                profilResmi = `${backendBaseUrl}/assets/profil-default.jpg`;
            }
        }
        
        // Profil resmi hala yoksa veya geçersizse default kullan
        if (!profilResmi || profilResmi.trim() === '' || profilResmi.includes('profil-default.jpg')) {
            let backendBaseUrl = (typeof window.getFloovonBackendBase === 'function') 
                ? window.getFloovonBackendBase() 
                : (window.BACKEND_BASE_URL || '');
            profilResmi = `${backendBaseUrl}/assets/profil-default.jpg`;
        }
        
        // Profil resmi URL'ini normalize et - eğer relative path ise absolute yap
        if (profilResmi && !profilResmi.startsWith('http') && !profilResmi.startsWith('//') && !profilResmi.startsWith('/assets/')) {
            // Relative path ise, backend base URL'i ekle
            let backendBaseUrl = (typeof window.getFloovonBackendBase === 'function') 
                ? window.getFloovonBackendBase() 
                : (window.BACKEND_BASE_URL || '');
            
            // Localhost kontrolü - eğer localhost'ta çalışıyorsak backend port'unu kullan
            const hostname = window.location.hostname;
            if ((hostname === 'localhost' || hostname === '127.0.0.1') && !backendBaseUrl) {
                const backendPort = localStorage.getItem('backend_port') || '3001';
                backendBaseUrl = `http://localhost:${backendPort}`;
            }
            
            if (profilResmi.startsWith('/')) {
                profilResmi = `${backendBaseUrl}${profilResmi}`;
            } else {
                profilResmi = `${backendBaseUrl}/${profilResmi}`;
            }
        }
        
        // TÜM profil resimlerini güncelle (container varsa sadece o container'da, yoksa tüm sayfada)
        let profilImages;
        if (container) {
            profilImages = container.querySelectorAll('.duzenleyen-profil-resmi');
        } else {
            profilImages = document.querySelectorAll('.duzenleyen-profil-resmi');
        }
        if (profilImages.length > 0) {
            profilImages.forEach(profilImg => {
                // Eğer resim zaten default resimse, tekrar yükleme
                if (profilImg.src && profilImg.src.includes('profil-default.jpg')) {
                    return;
                }
                
                // Eğer resim zaten gizlenmişse, tekrar yükleme
                if (profilImg.style.display === 'none') {
                    return;
                }
                
                // Error count'u closure ile her resim için ayrı tut
                let errorCount = 0;
                const maxRetries = 1; // Sadece 1 kez deneme yap
                
                // Backend base URL'i önceden al
                let backendBaseUrl;
                if (window.getFloovonBackendBase) {
                    backendBaseUrl = window.getFloovonBackendBase();
                } else if (window.BACKEND_BASE_URL) {
                    backendBaseUrl = window.BACKEND_BASE_URL;
                } else if (window.API_BASE_URL) {
                    backendBaseUrl = window.API_BASE_URL.replace('/api', '');
                } else {
                    // Fallback: getFloovonBackendBase kullan
                    backendBaseUrl = (typeof window.getFloovonBackendBase === 'function') 
                        ? window.getFloovonBackendBase() 
                        : ((typeof window.getFloovonProductionBase === 'function') 
                            ? window.getFloovonProductionBase() 
                            : (window.getFloovonBackendBase ? window.getFloovonBackendBase() : (window.BACKEND_BASE_URL || '')));
                }
                
                // Localhost kontrolü - eğer localhost'ta çalışıyorsak backend port'unu kullan
                const hostname = window.location.hostname;
                if ((hostname === 'localhost' || hostname === '127.0.0.1') && !backendBaseUrl) {
                    const backendPort = localStorage.getItem('backend_port') || '3001';
                    backendBaseUrl = `http://localhost:${backendPort}`;
                }
                
                const defaultImageUrl = `${backendBaseUrl}/assets/profil-default.jpg`;
                
                // Profil resmi URL'ini kontrol et - eğer geçersizse direkt default kullan
                if (!profilResmi || profilResmi.trim() === '' || profilResmi.includes('profil-default.jpg')) {
                    profilImg.src = defaultImageUrl;
                    return;
                }
                
                // Profil resmi URL'ini kontrol et - eğer 404 verecek bir URL ise direkt default kullan
                // Özellikle localhost'ta veya dosya yoksa direkt default kullan
                const profilResmiLower = profilResmi.toLowerCase();
                if (profilResmiLower.includes('profile_') && profilResmiLower.includes('.jpg')) {
                    // Profil resmi dosyası var gibi görünüyor, ama yine de kontrol et
                    // Error handler ile kontrol edeceğiz
                }
                
                // Eğer resim zaten aynı URL'e sahipse, tekrar yükleme
                if (profilImg.src === profilResmi || profilImg.src.endsWith(profilResmi.split('/').pop())) {
                    // Resim zaten yükleniyor veya yüklenmiş, tekrar yükleme
                    return;
                }
                
                // Error handler'ı önce set et (resim yüklenmeden önce)
                profilImg.onerror = function() {
                    errorCount++;
                    // İlk hatada direkt default resme geç ve handler'ı kaldır
                    if (errorCount === 1) {
                        // Varsayılan profil resmi - backend'den servis edilen
                        this.src = defaultImageUrl;
                        // Handler'ı kaldır ki default resim de hata verirse sonsuz döngüye girmesin
                        this.onerror = null;
                    } else {
                        // İkinci hatada resmi gizle ve handler'ı kaldır (sonsuz döngüyü önle)
                        this.style.display = 'none';
                        this.onerror = null;
                    }
                };
                
                // Profil resmini yükle
                profilImg.src = profilResmi;
            });

        } else {
            // Element bulunamadı - sessizce devam et (log gerekmiyor)
        }
        
    } catch (error) {
        console.error('❌ Form profil resmi yükleme hatası:', error);
    }
}

// ============================================================================
// Window Exports
// ============================================================================
window.setupKartMenuEventListeners = setupKartMenuEventListeners;
window.setupKartMenuContentButtons = setupKartMenuContentButtons;
window.setupDüzenleEventListeners = setupDüzenleEventListeners;
window.setupYeniSiparisEkleEventListeners = setupYeniSiparisEkleEventListeners;
window.openYeniSiparisEklemeFormu = openYeniSiparisEklemeFormu;
window.getOrganizasyonKartSayacBilgileri = getOrganizasyonKartSayacBilgileri;
window.loadOrganizasyonBilgileri = loadOrganizasyonBilgileri;
window.loadFormProfilResmi = loadFormProfilResmi;
