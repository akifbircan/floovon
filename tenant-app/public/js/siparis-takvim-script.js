// siparis-takvim-script.js

// #region Konsoldaki Tüm hataları önler
window.addEventListener('error', function (e) {
    if (e.message.includes('null') || e.message.includes('undefined')) {
        e.preventDefault();
        return true;
    }
});

// Eksik fonksiyonları oluştur
if (typeof setupKartTasimaSistemi === 'undefined') {
    window.setupKartTasimaSistemi = function () { };
}

// ============================================================================
// UTILS.JS'E TAŞINDI - 2026-02-05 (safeGetElement, safeGetElementById, safeAddEventListener)
// Fallback: utils.js yüklenmemişse bu fonksiyonlar tanımlanır
// ============================================================================
if (typeof window.safeGetElement !== 'function') {
    window.safeGetElement = function(selector) {
        return document.querySelector(selector);
    };
}

if (typeof window.safeGetElementById !== 'function') {
    window.safeGetElementById = function(id) {
        return document.getElementById(id);
    };
}

if (typeof window.safeAddEventListener !== 'function') {
    window.safeAddEventListener = function(selector, event, callback) {
        var element = typeof selector === 'string' ? window.safeGetElement(selector) : selector;
    if (element) {
        element.addEventListener(event, callback);
        return true;
    }
    return false;
    };
}

// Local aliases for backward compatibility
var safeGetElement = window.safeGetElement;
var safeGetElementById = window.safeGetElementById;
var safeAddEventListener = window.safeAddEventListener;
// ============================================================================

// #endregion Konsoldaki Tüm hataları önler

// Debounce timer için global değişken (navigateWeek için)
window._navigateWeekDebounceTimer = null;

// #region siparis-takvim-script.js > TÜM FONKSİYONLAR İÇİN ORTAK DOM YAPISI

// Takvim sistemini başlat
function initTakvimSistemi() {
    // ÖNEMLİ: Sadece index sayfasında çalış
    const isIndexPage = window.location.pathname.includes("index.html") || 
                        window.location.pathname === '/' || 
                        window.location.pathname.endsWith('/index.html') ||
                        document.querySelector('.bg-alan') !== null;
    if (!isIndexPage) {
        return; // Index sayfası değilse çık
    }
    
    // ✅ KRİTİK: React SPA kontrolü - React SPA'da updateWeek ve updateSelectedWeek çağırma!
    const isReactSPA = document.querySelector('.dashboard-container') !== null ||
                       document.querySelector('.bg-alan') !== null ||
                       window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined ||
                       typeof window.__REACT_WEEK_CHANGE_CALLBACK__ === 'function';
    
    // Moment.js kontrolü - updateWeek ve updateSelectedWeek moment.js'e bağımlı
    // React SPA'da updateWeek ve updateSelectedWeek çağırma - React component'leri zaten yapıyor!
    if (!isReactSPA) {
        if (typeof moment !== 'undefined') {
            updateWeek();
            updateSelectedWeek();
        } else {
            // Moment.js yüklenene kadar bekle
            const checkMoment = setInterval(() => {
                if (typeof moment !== 'undefined') {
                    updateWeek();
                    updateSelectedWeek();
                    clearInterval(checkMoment);
                }
            }, 100);
            setTimeout(() => clearInterval(checkMoment), 10000);
        }
    }
    
    // ❌ filterItems() KALDIRILDI - Kartlar loadDynamicCards ile async yükleniyor
    // ✅ Filtreleme loadDynamicCards tamamlandıktan sonra yapılıyor
    
    // ✅ KRİTİK: React SPA'da updateItemCount ve listener'ları ekleme!
    if (!isReactSPA) {
        updateItemCount();    // Sonra kalan siparişleri say
        initWeekPickerListeners();
    } else {
        // React SPA'da sadece updateItemCount çağır (istatistikler için)
        // Ama listener'ları ekleme - React zaten yönetiyor!
        if (typeof updateItemCount === 'function') {
            updateItemCount();
        }
        // ✅ KRİTİK: React SPA'da week input listener'ları ekleme - early return!
        return; // Early return - React SPA'da week input listener'ları ekleme!
    }
    
    // Mobil ve masaüstü week input değişince kartları güncelle (sadece Vanilla JS için)
    const weekInputs = document.querySelectorAll("#weekPicker, #weekPicker2");
    weekInputs.forEach(input => {
        // Önceki event listener'ları kaldır (çift eklemeyi önle) - cloneNode kullan
        const clonedInput = input.cloneNode(true);
        input.parentNode.replaceChild(clonedInput, input);
        
        // ✅ REVIZE-18: Week input takvim popup pozisyon kontrolü
        const fixWeekInputPopupPosition = function() {
            // Tüm parent container'ların overflow ve position ayarlarını kontrol et
            const inputKapsayici = clonedInput.closest('.input-kapsayici');
            const weekWrapper = clonedInput.closest('.week-wrapper');
            const sagPanelIcerik = clonedInput.closest('.sag-panel-icerik');
            const takvimHafta = clonedInput.closest('.takvim-hafta');
            const sagPanel = clonedInput.closest('.sag-panel');
            const mainContent = clonedInput.closest('.main--content');
            const body = document.body;
            
            // Tüm parent container'ları visible yap
            const containers = [inputKapsayici, weekWrapper, sagPanelIcerik, takvimHafta, sagPanel, mainContent, body];
            containers.forEach(container => {
                if (container) {
                    container.style.overflow = 'visible';
                    // Önemli: position ayarlarını koru (relative kalmalı)
                    if (container === inputKapsayici || container === weekWrapper) {
                        container.style.position = 'relative';
                    }
                }
            });
            
            // Popup kapandıktan sonra geri yükle (sadece sag-panel ve sag-panel-icerik için)
            setTimeout(() => {
                if (sagPanelIcerik && !clonedInput.matches(':focus')) {
                    sagPanelIcerik.style.overflow = '';
                }
                if (sagPanel && !clonedInput.matches(':focus')) {
                    sagPanel.style.overflow = '';
                }
            }, 2000);
        };
        
        clonedInput.addEventListener("focus", fixWeekInputPopupPosition);
        clonedInput.addEventListener("click", fixWeekInputPopupPosition);
        
        // Input'a mousedown olduğunda da çalıştır (popup açılmadan önce)
        clonedInput.addEventListener("mousedown", function(e) {
            fixWeekInputPopupPosition();
        });
        
        // ✅ REVIZE-18: Ok ikonuna tıklandığında native week input'un kendi ok'una tıklamış gibi davran
        const okIcon = clonedInput.parentElement?.querySelector('.icon-input-week-indicator');
        if (okIcon) {
            okIcon.addEventListener("click", function(e) {
                e.preventDefault();
                e.stopPropagation();
                // Önce pozisyonu düzelt
                fixWeekInputPopupPosition();
                
                // Native week input'un kendi calendar picker'ını aç
                setTimeout(() => {
                    clonedInput.focus();
                    
                    // Modern tarayıcılarda showPicker() API'sini kullan
                    if (typeof clonedInput.showPicker === 'function') {
                        try {
                            clonedInput.showPicker();
                            return;
                        } catch (err) {
                            // showPicker() desteklenmiyorsa veya hata verirse, fallback kullan
                        }
                    }
                    
                    // Fallback: Input'un sağ tarafına (native indicator'ın olduğu yere) tıkla
                    const rect = clonedInput.getBoundingClientRect();
                    const clickX = rect.right - 18;
                    const clickY = rect.top + rect.height / 2;
                    
                    // Native indicator'ın olduğu yere programatik tıklama
                    const nativeClickEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: clickX,
                        clientY: clickY,
                        button: 0,
                        detail: 1
                    });
                    
                    clonedInput.dispatchEvent(nativeClickEvent);
                }, 10);
            });
        }
        
        clonedInput.addEventListener("blur", function() {
            // Input blur olduğunda, parent container'ların overflow ayarlarını geri yükle
            // (CSS'deki !important ayarları zaten var, bu sadece ekstra güvence)
        });
        
        clonedInput.addEventListener("change", async function (e) {
            // ✅ KRİTİK: Programatik değişiklik ise ignore et (sayfa yenilenmesini önle)
            if (this.getAttribute('data-programmatic-change') === 'true') {
                this.removeAttribute('data-programmatic-change');
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            
            // ✅ DÜZELTME: navigateWeek çalışıyorsa change event'ini ignore et (çift yüklemeyi önle)
            if (window._navigatingWeek) {
                return;
            }
            
            // ✅ KRİTİK: React SPA kontrolü - React SPA'da updateSelectedWeek çağırma!
            const isReactSPA = document.querySelector('.dashboard-container') !== null ||
                               document.querySelector('.bg-alan') !== null ||
                               window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined ||
                               typeof window.__REACT_WEEK_CHANGE_CALLBACK__ === 'function';
            
            if (isReactSPA) {
                // ✅ KRİTİK: React SPA'da sadece React state'i güncelle, hiçbir şey yapma!
                const newWeek = this.value;
                if (typeof window.__REACT_WEEK_CHANGE_CALLBACK__ === 'function') {
                    window.__REACT_WEEK_CHANGE_CALLBACK__(newWeek);
                }
                // ✅ KRİTİK: React SPA'da clickable-day-container'ı güncelleme - React zaten yapıyor!
                // ✅ KRİTİK: loadDynamicCards çağırma - React Query zaten yüklüyor!
                // ✅ KRİTİK: itemsContainer.innerHTML = '' yapma - React component'leri DOM'dan silinmemeli!
                e.preventDefault();
                e.stopPropagation();
                return false; // Early return - React SPA'da hiçbir şey yapma!
            }
            
            updateSelectedWeek();
            
            // ✅ DÜZELTME: Önce eski kartları temizle ve empty mesajı gizle (geçici olarak)
            const itemsContainer = document.getElementById('itemsContainer');
            const emptyMsg = document.querySelector('.empty-message');
            const emptySearchMsg = document.querySelector('.empty-search-message');
            
            if (itemsContainer) {
                // Eski kartları hemen temizle (yeni veriler yüklenene kadar boş görünsün)
                itemsContainer.innerHTML = '';
            }
            
            // Empty mesajlarını geçici olarak gizle
            if (emptyMsg) {
                emptyMsg.style.display = 'none';
                emptyMsg.style.visibility = 'hidden';
            }
            if (emptySearchMsg) {
                emptySearchMsg.style.display = 'none';
                emptySearchMsg.style.visibility = 'hidden';
            }
            
            // ✅ DÜZELTME: Hafta değiştiğinde kartları yeniden yükle (await ile)
            if (typeof window.loadDynamicCards === 'function' && !window.loadDynamicCardsLoading) {
                try {
                    await window.loadDynamicCards();
                    
                    // ✅ REVIZE-15: Kartlar yüklendikten sonra teslim edilen sayısını güncelle
                    // updateItemCount içinde artık teslim edilen sayısını güncellemiyoruz (flicker önlemek için)
                    if (typeof window.updateTeslimEdilenSiparisSayisi === 'function') {
                        window.updateTeslimEdilenSiparisSayisi();
                    }
                    
                    // ✅ REVIZE-17: MutationObserver zaten kontrol ediyor, burada tekrar kontrol etmeye gerek yok
                } catch (error) {
                    console.error('❌ loadDynamicCards hatası:', error);
                }
            }
            
            // Kartlar yüklendikten sonra filtreleme yap
            const waitForCards = setInterval(() => {
                if (!window.loadDynamicCardsLoading) {
                    clearInterval(waitForCards);
                    setTimeout(() => {
                        // ✅ KRİTİK: updateSelectedWeek'i tekrar çağır (hafta günlerini güncelle)
                        if (typeof window.updateSelectedWeek === 'function') {
                            window.updateSelectedWeek();
                        }
                        
                        // Kısa bir gecikme ile recheckWeekMatch çağır (weekDays güncellenmesi için)
                        setTimeout(() => {
                            recheckWeekMatch(); // ESKİ SİSTEMDEKİ GİBİ
                            updateItemCount();
                            if (typeof window.updateHeaderFilterCounts === 'function') {
                                window.updateHeaderFilterCounts(); // Header filtre sayaçlarını güncelle
                            }
                            // ✅ REVIZE-15: Teslim edilen sayısını güncelle (flicker önlemek için)
                            if (typeof window.updateTeslimEdilenSiparisSayisi === 'function') {
                                window.updateTeslimEdilenSiparisSayisi();
                            }
                            
                            // ✅ REVIZE-17: Ürün yazısı mevcut alanlarını kontrol et (GECİKME YOK - ANINDA!)
                            if (typeof window.checkUrunYazisiMevcutForAllCards === 'function') {
                                // requestAnimationFrame ile DOM güncellemesinden hemen sonra çalıştır
                                requestAnimationFrame(() => {
                                    window.checkUrunYazisiMevcutForAllCards();
                                });
                            }
                            
                            // Empty message'ı kontrol et
                            if (typeof toggleEmptyMessageIfNeeded === 'function') {
                                toggleEmptyMessageIfNeeded();
                            }
                        }, 100); // Kısa gecikme - weekDays güncellenmesi için
                    }, 0); // Gecikme yok - hemen çalıştır
                }
            }, 100);
            setTimeout(() => clearInterval(waitForCards), 5000);
        });
    });

    // ✅ KRİTİK: React SPA kontrolü - React SPA'da butonları oluşturma!
    // React component'lerinde zaten butonlar var, burada oluşturma!
    // NOT: isReactSPA zaten satır 68'de tanımlanmış, burada tekrar tanımlamaya gerek yok!
    
    // Nav Butonları Ekleme (Hem mobil hem web için) - Sadece Vanilla JS için
    if (!isReactSPA) {
        var navContainers = document.querySelectorAll('.label-container.nav');

        navContainers.forEach(function (navContainer) {
            // Eğer butonlar zaten varsa, yeniden oluşturma
            if (navContainer.querySelector('#prevWeekButton') || navContainer.querySelector('#nextWeekButton')) {
                return;
            }
            
            var prevWeekButton = document.createElement('button');
            prevWeekButton.setAttribute('id', 'prevWeekButton');
            prevWeekButton.setAttribute('type', 'button');
            prevWeekButton.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
            prevWeekButton.addEventListener('click', function () {
                navigateWeek(-1);
            });

            var nextWeekButton = document.createElement('button');
            nextWeekButton.setAttribute('id', 'nextWeekButton');
            nextWeekButton.setAttribute('type', 'button');
            nextWeekButton.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
            nextWeekButton.addEventListener('click', function () {
                navigateWeek(1);
            });

            navContainer.appendChild(prevWeekButton);
            navContainer.appendChild(nextWeekButton);
        });
    }
    
    // setupSearchBox fonksiyonunu çağır (eğer tanımlıysa)
    if (typeof setupSearchBox === 'function') {
        setupSearchBox();
    }
}

// Takvim sistemi başlatma
// Burada otomatik çağrı yapmıyoruz - index.page.js zaten çağırıyor
// Global erişim için window'a bridge ekle (geriye dönük uyumluluk için)
window.initTakvimSistemi = initTakvimSistemi;

// NOT: "Bu Haftaya Git" butonları için event listener aşağıdaki 
// "Kart Filtre Sistemi" bölümünde tanımlanmıştır (satır ~1095)
// #endregion siparis-takvim-script.js > TÜM FONKSİYONLAR İÇİN ORTAK DOM YAPISI

// ✅ Paylaşılan counter fonksiyonları artık tenant/js/shared/counters.js içinde
// Bridge'ler oluşturuldu (geriye dönük uyumluluk için)
function getSelectedWeekDays() {
    // Modül yüklenmişse direkt çağır
    if (window.__COUNTERS_MODULE_LOADED__ && typeof window.getSelectedWeekDays === 'function' && window.getSelectedWeekDays !== getSelectedWeekDays) {
        return window.getSelectedWeekDays();
    }
    
    // ✅ DÜZELTME: Önce React state'den oku (eğer varsa)
    // React SPA'da selectedWeek state'i window'a ekleniyor
    let selectedWeek = null;
    if (window.__REACT_SELECTED_WEEK__) {
        selectedWeek = window.__REACT_SELECTED_WEEK__;
    } else {
        // Fallback: DOM'dan oku
        const weekPicker = document.getElementById("weekPicker");
        selectedWeek = weekPicker?.value;
    }
    
    // Eğer hafta seçici boşsa veya geçersizse, mevcut haftayı kullan
    if (!selectedWeek || selectedWeek.trim() === '') {
        if (typeof moment !== 'undefined') {
            selectedWeek = moment().format('YYYY-[W]WW');
            // Week picker'ı da güncelle (DOM varsa)
            const weekPicker = document.getElementById("weekPicker");
            if (weekPicker) {
                weekPicker.value = selectedWeek;
            }
            const weekPicker2 = document.getElementById("weekPicker2");
            if (weekPicker2) {
                weekPicker2.value = selectedWeek;
            }
        } else {
            return [];
        }
    }
    
    // Moment.js ile hafta günlerini hesapla
    if (typeof moment === 'undefined') {
        return [];
    }
    
    try {
        const startOfWeek = moment(selectedWeek, 'YYYY-[W]WW').startOf('isoWeek');
        const days = [];
        
        for (let i = 0; i < 7; i++) {
            const day = startOfWeek.clone().add(i, 'days');
            days.push(day.format('DD MMMM YYYY dddd'));
        }
        
        return days;
    } catch (error) {
        console.warn('⚠️ getSelectedWeekDays fallback hatası:', error);
        return [];
    }
}

// Global erişim için window'a ekle
window.getSelectedWeekDays = getSelectedWeekDays;

// #region Index Sayfa – Hafta Bazlı Sipariş Kartlarını Göster (DOMContentLoaded + Week Picker)

/**
 * Hafta değeri (örneğin "2024-W27") girildiğinde, o haftaya ait Pazartesi'den Pazar'a tüm tarihleri döner.
 */
function getWeekDays(weekValue) {
    if (!weekValue || !weekValue.includes('-W')) return [];
    const startOfWeek = moment(weekValue, 'YYYY-[W]WW').startOf('isoWeek');
    const days = [];

    for (let i = 0; i < 7; i++) {
        const day = startOfWeek.clone().add(i, 'days');
        days.push(day.format('DD MMMM YYYY dddd'));
    }

    return days;
}
window.getWeekDays = getWeekDays;

// Moment.js yüklenene kadar bekle
// Global tarih formatları
let DATE_FORMAT = 'DD MMMM YYYY dddd'; // Türkçe format
let DATE_FORMAT_SHORT = 'DD-MM-YYYY'; // Kısa format

if (typeof moment !== 'undefined') {
    moment.locale('tr');
} else {
    // Moment.js yüklenene kadar bekle
    const waitForMoment = () => {
        if (typeof moment !== 'undefined') {
            moment.locale('tr');
        } else {
            setTimeout(waitForMoment, 100);
        }
    };
    waitForMoment();
}

// Global fonksiyon - script.js'den çağrılabilmesi için
function recheckWeekMatch() {
    // ✅ DÜZELTME: SPA ile index'e dönüşte sadece ilk çağrıda hafta filtresini devre dışı bırak
    // Takvim değişikliklerinde normal hafta filtresi çalışmalı
    if (window.__FLOOVON_SPA_INDEX_NAV__) {
        try {
            const itemsSpa = document.querySelectorAll('.item');
            itemsSpa.forEach((item) => {
                item.style.setProperty('display', 'flex', 'important');
                item.classList.remove('item-hidden');
            });
            const emptyMsgSpa = document.querySelector('.empty-message');
            const emptySearchMsgSpa = document.querySelector('.empty-search-message');
            if (emptyMsgSpa) emptyMsgSpa.style.display = 'none';
            if (emptySearchMsgSpa) emptySearchMsgSpa.style.display = 'none';
            // Log kaldırıldı (gereksiz)
        } catch (e) {
            console.warn('⚠️ [SPA] recheckWeekMatch override hata:', e);
        }
        // ✅ ÖNEMLİ: Flag'i false yap (sadece ilk SPA index dönüşü için geçerli)
        // Takvim değişikliklerinde normal hafta filtresi çalışacak
        window.__FLOOVON_SPA_INDEX_NAV__ = false;
        // __SPA_INDEX_MODE__ flag'ini de temizle (artık kullanılmıyor)
        window.__SPA_INDEX_MODE__ = false;
        return;
    }

    // ÖNEMLİ: Sadece index sayfasında çalış
    const isIndexPage = window.location.pathname.includes("index.html") || 
                        window.location.pathname === '/' || 
                        window.location.pathname.endsWith('/index.html') ||
                        document.querySelector('.bg-alan') !== null;
    if (!isIndexPage) {
        return; // Index sayfası değilse çık
    }
    
    if (typeof isSearching !== 'undefined' && isSearching) {
        return;
    }
    const weekInput = document.querySelector("input[type='week']");
    if (!weekInput) {
        return; // Sessizce çık, hata verme
    }

    // Moment.js kontrolü
    if (typeof moment === 'undefined') {
        console.warn('⚠️ recheckWeekMatch: moment.js henüz yüklenmedi, atlanıyor');
        return;
    }

    // ✅ DÜZELTME: Dinamik kartlar yükleniyorsa bekle
    if (window.loadDynamicCardsLoading) {
        setTimeout(() => recheckWeekMatch(), 500);
        return;
    }

    // Hafta seçici boşsa veya geçersizse, mevcut haftayı ayarla
    if (!weekInput.value || weekInput.value.trim() === '') {
        const currentWeek = moment().format('YYYY-[W]WW');
        weekInput.value = currentWeek;
        // Mobil week picker'ı da güncelle
        const weekPicker2 = document.getElementById("weekPicker2");
        if (weekPicker2) {
            weekPicker2.value = currentWeek;
        }
    }

    // ✅ KRİTİK: Önce React state'den oku, yoksa DOM'dan oku
    let selectedWeek = null;
    if (window.__REACT_SELECTED_WEEK__) {
        selectedWeek = window.__REACT_SELECTED_WEEK__;
    } else {
        selectedWeek = weekInput.value || moment().format('YYYY-[W]WW');
    }
    
    // weekInput'u da güncelle (senkronizasyon için)
    if (weekInput && selectedWeek) {
        weekInput.value = selectedWeek;
    }
    
    let weekDays = getSelectedWeekDays();
    
    // Eğer hafta günleri hala boşsa, hafta seçicisini tekrar başlat ve tekrar dene
    if (!weekDays.length) {
        // Hafta seçicisini mevcut haftaya ayarla
        const currentWeek = moment().format('YYYY-[W]WW');
        weekInput.value = currentWeek;
        const weekPicker2 = document.getElementById("weekPicker2");
        if (weekPicker2) {
            weekPicker2.value = currentWeek;
        }
        
        // Tekrar hafta günlerini al
        weekDays = getSelectedWeekDays();
        
        // Hala boşsa, tüm kartları göster (filtreleme yapma)
        if (!weekDays.length) {
            console.warn('⚠️ recheckWeekMatch: weekDays hala boş, tüm kartlar gösteriliyor. Seçili hafta:', currentWeek);
            const items = document.querySelectorAll('.item');
            items.forEach((item) => {
                item.style.setProperty('display', 'flex', 'important');
                item.classList.remove('item-hidden');
            });
            return;
        }
    }


    // ✅ DÜZELTME: Güncel kartları al
    const items = document.querySelectorAll('.item');
    if (!items || items.length === 0) {
        // Kartlar yoksa empty mesajı göster
        const emptySearchMessage = document.querySelector('.empty-search-message');
        let emptySearchElement = emptySearchMessage;
        if (!emptySearchElement) {
            emptySearchElement = document.createElement('div');
            emptySearchElement.className = 'empty-search-message';
            emptySearchElement.style.display = 'none';
            emptySearchElement.innerHTML = `
                <i class="icon-kart-yok"></i>
                <div class="message">Seçtiğiniz tarih(ler)e ait sipariş bulunamadı!<span>Lütfen farklı bir tarih seçerek tekrar deneyin.</span></div>
            `;
            const itemsContainer = document.getElementById('itemsContainer');
            if (itemsContainer && itemsContainer.parentElement) {
                itemsContainer.parentElement.insertBefore(emptySearchElement, itemsContainer);
            }
        }
        if (emptySearchElement) {
            emptySearchElement.style.display = 'flex';
            emptySearchElement.style.visibility = 'visible';
            emptySearchElement.classList.remove('hidden');
            emptySearchElement.setAttribute('style', 'display: flex !important; visibility: visible !important;');
        }
        const emptyMessage = document.querySelector('.empty-message');
        if (emptyMessage) {
            emptyMessage.style.display = 'none';
            emptyMessage.classList.add('hidden');
        }
        return; // Kartlar henüz yüklenmemiş, empty mesajı gösterdik
    }

    let visibleCount = 0;
    let hiddenCount = 0;

    items.forEach((item, index) => {
        // Tarih alanını bul: önce .teslim-zaman .tarih, sonra .tarih
        const tarihEl = item.querySelector('.teslim-zaman .tarih') || item.querySelector('.tarih');
        if (!tarihEl || !tarihEl.textContent.trim()) {
            // Tarih elementi yoksa kartı gizle
            item.style.setProperty('display', 'none', 'important');
            item.classList.add('item-hidden');
            hiddenCount++;
            return;
        }

        let tarihText = tarihEl.textContent.trim();
        // Virgülü kaldır (toLocaleDateString bazen virgül ekliyor)
        tarihText = tarihText.replace(/,/g, '').trim();
        
        // Yedeğe göre: Direkt olarak tarih metnini karşılaştır (format zaten "DD MMMM YYYY dddd")
        if (weekDays.includes(tarihText)) {
            item.style.setProperty('display', 'flex', 'important');
            item.classList.remove('item-hidden');
            visibleCount++;
            if (index < 3) {
            }
        } else {
            item.style.setProperty('display', 'none', 'important');
            item.classList.add('item-hidden');
            hiddenCount++;
            if (index < 3) {
            }
        }
    });

    // Empty message kontrolü - empty-search-message kullan
    const emptySearchMessage = document.querySelector('.empty-search-message');
    
    // empty-search-message yoksa oluştur
    let emptySearchElement = emptySearchMessage;
    if (!emptySearchElement) {
        emptySearchElement = document.createElement('div');
        emptySearchElement.className = 'empty-search-message';
        emptySearchElement.style.display = 'none';
        emptySearchElement.innerHTML = `
            <i class="icon-kart-yok"></i>
            <div class="message">Seçtiğiniz tarih(ler)e ait sipariş bulunamadı!<span>Lütfen farklı bir tarih seçerek tekrar deneyin.</span></div>
        `;
        // itemsContainer'ın öncesine ekle
        const itemsContainer = document.getElementById('itemsContainer');
        if (itemsContainer && itemsContainer.parentElement) {
            itemsContainer.parentElement.insertBefore(emptySearchElement, itemsContainer);
        }
    }
    
    // Görünür kartları DOM'dan kontrol et (visibleCount yerine gerçek durumu kontrol et)
    const actuallyVisibleItems = Array.from(items).filter(item => {
        const style = window.getComputedStyle(item);
        const isVisible = style.display !== 'none' && 
                         style.visibility !== 'hidden' && 
                         item.offsetParent !== null && 
                         !item.classList.contains('item-hidden');
        return isVisible;
    });
    
    // ✅ KRİTİK: toggleEmptyMessageIfNeeded fonksiyonunu çağır - bu empty message'ı doğru şekilde gösterir/gizler
    if (typeof toggleEmptyMessageIfNeeded === 'function') {
        toggleEmptyMessageIfNeeded();
    } else {
        // Fallback: Manuel kontrol
        const emptyMessage = document.querySelector('.empty-message');
        if (emptyMessage) {
            if (actuallyVisibleItems.length === 0) {
                emptyMessage.style.display = 'flex';
                emptyMessage.style.visibility = 'visible';
                emptyMessage.classList.remove('hidden');
            } else {
                emptyMessage.style.display = 'none';
                emptyMessage.classList.add('hidden');
            }
        }
        
        // empty-search-message'ı gizle (empty-message kullanıyoruz)
        if (emptySearchElement) {
            emptySearchElement.style.display = 'none';
            emptySearchElement.classList.add('hidden');
        }
    }
}

// Global erişim için window'a ekle (script.js'den çağrılabilmesi için)
window.recheckWeekMatch = recheckWeekMatch;

//#endregion

// ✅ GLOBAL FONKSİYON: Kartları tarihe göre filtrele (sadece seçili haftadakileri göster)
function filterItemsByDate() {
    const weekDays = getSelectedWeekDays();
    if (!weekDays.length) return;

    const kartlar = document.querySelectorAll(".items .item");
    let visibleCount = 0;

    kartlar.forEach(function (kart) {
        const tarihText = kart.querySelector(".teslim-zaman .tarih")?.textContent.trim();
        
        if (weekDays.includes(tarihText)) {
            kart.style.setProperty('display', 'flex', 'important');
            kart.classList.remove("item-hidden");
            visibleCount++;
        } else {
            kart.style.setProperty('display', 'none', 'important');
            kart.classList.add("item-hidden");
        }
    });

}

// #region Script --- Index --- Sağ Panel --- Takvim Hafta Seçim

function updateSelectedWeek() {
    // ✅ KRİTİK: React SPA kontrolü - React SPA'da sadece günleri güncelle, başka bir şey yapma!
    const isReactSPA = document.querySelector('.dashboard-container') !== null ||
                       document.querySelector('.bg-alan') !== null ||
                       window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined ||
                       typeof window.__REACT_WEEK_CHANGE_CALLBACK__ === 'function';
    
    var weekInput = document.getElementById("weekPicker");

    // Geçerli bir input yoksa durdur
    if (!weekInput || !weekInput.value) {
        // console.warn("weekPicker değeri geçersiz");
        return;
    }

    var selectedWeek = weekInput.value;

    // startDate güvenli şekilde alınır
    var startDate = getStartDate(selectedWeek);
    if (!startDate || isNaN(startDate)) {
        console.warn("Geçersiz startDate tespit edildi:", startDate);
        return;
    }

    var daysLabel = document.getElementById("daysLabel");
    var clickableDayContainer = document.getElementById("clickableDayContainer");

    // ✅ KRİTİK: React SPA'da sadece günleri güncelle, başka bir şey yapma!
    if (isReactSPA) {
        // Sadece clickable-day-container'ı güncelle
        if (clickableDayContainer && typeof getClickabledDayDetails === 'function') {
            var clickableDays = getClickabledDayDetails(startDate);
            if (clickableDays) {
                clickableDayContainer.innerHTML = clickableDays;
            }
        }
        // Ay/Yıl label'larını güncelle (sağ paneli etkilemez)
        var yearMonthText = moment(startDate).format('MMMM YYYY');
        var yearMonthLabel = document.getElementById("yearMonthLabel");
        if (yearMonthLabel) yearMonthLabel.textContent = yearMonthText;
        var yearMonthLabel2 = document.getElementById("yearMonthLabel2");
        if (yearMonthLabel2) yearMonthLabel2.textContent = yearMonthText;
        // Başka bir şey yapma - early return!
        return;
    }

    // Ay ve Yıl bilgileri (Vanilla JS için)
    var yearMonthText = moment(startDate).format('MMMM YYYY');

    var yearMonthLabel = document.getElementById("yearMonthLabel");
    if (yearMonthLabel) yearMonthLabel.textContent = yearMonthText;

    var yearMonthLabel2 = document.getElementById("yearMonthLabel2");
    if (yearMonthLabel2) yearMonthLabel2.textContent = yearMonthText;

    // Başlangıç ve bitiş tarihleri
    var startFormatted = moment(startDate).format('DD MMMM YYYY dddd');
    var endFormatted = moment(startDate).add(6, "days").format('DD MMMM YYYY dddd');

    var tarihMetniWeb = `${startFormatted} <span class="tarih-ayirici">→</span> ${endFormatted}`;
    var tarihMetniMobile = `${startFormatted} • ${endFormatted}`;

    const webTarih = document.getElementById("baslikTarihWeb");
    const mobileTarih = document.getElementById("baslikTarihMobile");
    if (webTarih) webTarih.innerHTML = tarihMetniWeb;
    if (mobileTarih) mobileTarih.textContent = tarihMetniMobile;

    // Günleri oluştur
    var clickableDays = getClickabledDayDetails(startDate);
    if (clickableDayContainer) clickableDayContainer.innerHTML = clickableDays;

    var clickableDayElements = clickableDayContainer?.querySelectorAll(".clickable-day") || [];
    clickableDayElements.forEach(function (clickableDayElement, index) {
        clickableDayElement.addEventListener("click", function () {
            var dayNumber = index + 1;
            handleDayClick(dayNumber, startDate, this);
        });
    });

    function handleDayClick(dayNumber, startDate, clickedElement) {
        var clickedDate = moment(startDate).add(dayNumber - 1, 'days').format('DD MMMM YYYY dddd');

        let matchCount = 0;

        document.querySelectorAll(".item").forEach(function (item) {
            const teslimTarihi = item.querySelector(".teslim-zaman .tarih")?.textContent.trim();
            const isMatch = (teslimTarihi === clickedDate);
            if (isMatch) {
                item.style.setProperty('display', 'flex', 'important');
                item.classList.remove("item-hidden");
                matchCount++;
            } else {
                item.style.setProperty('display', 'none', 'important');
                item.classList.add("item-hidden");
            }
        });

        // Stil güncellemesi
        document.querySelectorAll(".clickable-day").forEach(function (el) {
            el.classList.remove("secili");
        });
        clickedElement.classList.add("secili");

        const emptyMsg = document.querySelector('.empty-message');
        if (emptyMsg) {
            emptyMsg.style.display = (matchCount === 0) ? 'flex' : 'none';
        }
    }

    // ✅ KRİTİK: React SPA'da setupKartTasimaSistemi çağırma - sayfa yenilenmesine neden oluyor!
    // React SPA'da sadece günleri güncelle, başka bir şey yapma!
    if (!isReactSPA) {
        // Kart taşıma sistemi varsa yeniden başlat (sadece vanilla JS için)
        const isIndexPage = window.location.pathname.includes("index.html") || 
                            window.location.pathname === '/' || 
                            window.location.pathname.endsWith('/index.html') ||
                            document.querySelector('.bg-alan') !== null;
        
        if (isIndexPage && typeof setupKartTasimaSistemi === "function") {
            try {
                setupKartTasimaSistemi();
            } catch (err) {
                // Sessizce hata yok say
            }
        }
    }
}

// handleDayClick fonksiyonu artık updateSelectedWeek içinde tanımlı (lokal fonksiyon)
// Bu global fonksiyon onclick attribute için kullanılıyor
function handleDayClick(dayNumber, startDate, clickedElement) {
    var clickedDate = moment(startDate, 'DD-MM-YYYY').add(dayNumber - 1, 'days').format('DD MMMM YYYY dddd');

    let matchCount = 0;

    document.querySelectorAll(".item").forEach(function (item) {
        const teslimTarihi = item.querySelector(".teslim-zaman .tarih")?.textContent.trim();
        const isMatch = (teslimTarihi === clickedDate);
        if (isMatch) {
            item.style.setProperty('display', 'flex', 'important');
            item.classList.remove("item-hidden");
            matchCount++;
        } else {
            item.style.setProperty('display', 'none', 'important');
            item.classList.add("item-hidden");
        }
    });

    // Stil güncellemesi
    document.querySelectorAll(".clickable-day").forEach(function (el) {
        el.classList.remove("secili");
    });
    if (clickedElement) {
        clickedElement.classList.add("secili");
    }

    const emptyMsg = document.querySelector('.empty-message');
    if (emptyMsg) {
        emptyMsg.style.display = (matchCount === 0) ? 'flex' : 'none';
    }
}

function getStartDate(week) {
    var parts = week.split('-W');
    var year = parseInt(parts[0]);
    var weekNumber = parseInt(parts[1]);
    return moment().isoWeekYear(year).isoWeek(weekNumber).startOf('isoWeek').toDate(); // Pazartesi
}


function getClickabledDayDetails(startDate) {
    var dayDetails = "";
    for (var i = 0; i < 7; i++) {
        var currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        var dayNumber = currentDate.getDate();
        var dayShortName = getDayShortName(currentDate.getDay());
        var todayClass = currentDate.toDateString() === new Date().toDateString() ? 'today' : '';

        const formattedStartDate = moment(startDate).format('DD-MM-YYYY'); // 🔥 doğru formatta tarih

        dayDetails += `
        <div class='clickable-day ${todayClass}' onclick='handleDayClick(${i + 1}, "${formattedStartDate}", this)'>
            <span class='day-number'>${dayNumber}</span>
            <span class='day-name'>${dayShortName}</span>
        </div>`;
    }
    return dayDetails;
}

// UTILS.JS'E TAŞINDI - getDayShortName
if (typeof window.getDayShortName !== 'function') {
    window.getDayShortName = function(dayIndex) {
    var dayNames = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
        return dayNames[dayIndex] || '';
    };
}
var getDayShortName = window.getDayShortName;

function updateWeek() {
    // Eğer navigateWeek çalışıyorsa, updateWeek'i ignore et (haftayı geri alma)
    if (window._navigatingWeek) {
        return; // navigateWeek çalışırken updateWeek'i iptal et
    }
    
    // ISO hafta yılı ve hafta numarasını kullan
    var now = moment();
    var currentYear = now.isoWeekYear(); // ISO hafta yılı
    var currentWeekNumber = now.isoWeek(); // ISO hafta numarası
    var currentWeek = currentYear + '-W' + String(currentWeekNumber).padStart(2, '0');
    
    var weekInputs = document.querySelectorAll("input[type='week']");

    weekInputs.forEach(function (weekInput) {
        // Sadece boşsa veya geçersiz formattaysa bu haftaya ayarla
        // Kullanıcının seçtiği haftayı koru (farklı yıl olsa bile)
        if (!weekInput.value || weekInput.value.trim() === '') {
            // Boşsa mevcut haftayı ayarla
            weekInput.value = currentWeek;
        } else {
            // Geçerli bir değer varsa, format kontrolü yap
            var parts = weekInput.value.split('-W');
            if (parts.length !== 2 || isNaN(parseInt(parts[0])) || isNaN(parseInt(parts[1]))) {
                // Geçersiz format ise bu haftaya ayarla
                weekInput.value = currentWeek;
            }
            // Geçerli bir değer varsa, kullanıcının seçtiği haftayı koru (değiştirme)
        }
    });
    
    // ✅ KRİTİK: React SPA kontrolü - React SPA'da updateSelectedWeek çağırma!
    const isReactSPA = document.querySelector('.dashboard-container') !== null ||
                       document.querySelector('.bg-alan') !== null ||
                       window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined ||
                       typeof window.__REACT_WEEK_CHANGE_CALLBACK__ === 'function';
    
    // updateSelectedWeek çağır (tüm week input'lar güncellendikten sonra) - sadece index sayfasında ve React SPA değilse
    const isIndexPage = window.location.pathname.includes("index.html") || 
                        window.location.pathname === '/' || 
                        window.location.pathname.endsWith('/index.html') ||
                        document.querySelector('.bg-alan') !== null;
    if (isIndexPage && !isReactSPA && typeof updateSelectedWeek === 'function') {
        try {
            updateSelectedWeek();
        } catch (err) {
            // Sessizce hata yok say
        }
    }
}

// updateWeek ve updateSelectedWeek'i window'a ekle (head-component.js'den çağrılabilmesi için)
// NOT: Yedeğe göre bu fonksiyonlar lokal ama head-component.js'den çağrılabilmesi için window'a ekleniyor
window.updateSelectedWeek = updateSelectedWeek;
window.updateWeek = updateWeek;

function navigateWeek(direction) {
    // ✅ KRİTİK: React SPA kontrolü - React SPA'da navigateWeek çağrılmamalı!
    const isReactSPA = document.querySelector('.dashboard-container') !== null ||
                       document.querySelector('.bg-alan') !== null ||
                       window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined ||
                       typeof window.__REACT_WEEK_CHANGE_CALLBACK__ === 'function';
    
    if (isReactSPA) {
        console.log('🔵 [NAVIGATE] React SPA tespit edildi, navigateWeek tamamen atlanıyor - butonlar direkt React state güncelliyor');
        // Flag'i kaldır
        window._navigatingWeek = false;
        return; // Early return - React SPA'da navigateWeek hiçbir şey yapmasın!
    }
    
    console.log('🔵 [NAVIGATE] navigateWeek çağrıldı, direction:', direction);
    var weekInput = document.getElementById("weekPicker");
    if (!weekInput) {
        console.warn('⚠️ navigateWeek: weekPicker bulunamadı');
        return;
    }
    
    var currentWeek = weekInput.value;
    console.log('🔵 [NAVIGATE] Mevcut hafta:', currentWeek);
    
    // ✅ DÜZELTME: Hafta numarasını direkt artır/azalt (tarih hesaplaması yapmadan)
    if (!currentWeek || !currentWeek.includes('-W')) {
        console.warn('⚠️ navigateWeek: Geçersiz hafta değeri, bu haftaya dönülüyor');
        var newWeek = moment().format('YYYY-[W]WW');
    } else {
        // Hafta değerini parse et
        var parts = currentWeek.split('-W');
        var year = parseInt(parts[0]);
        var weekNumber = parseInt(parts[1]);
        
        console.log('🔵 [NAVIGATE] Parse edilen - Yıl:', year, 'Hafta:', weekNumber);
        
        // ✅ DÜZELTME: Hafta numarasını direkt artır/azalt
        var newWeekNumber = weekNumber + direction;
        var newYear = year;
        
        // Yıl geçişlerini kontrol et
        if (newWeekNumber < 1) {
            // Önceki yılın son haftasına git
            newYear = year - 1;
            // Önceki yılın kaç haftası olduğunu hesapla (ISO hafta yılı kullan)
            var lastWeekOfPrevYear = moment().isoWeekYear(newYear).isoWeeksInYear();
            newWeekNumber = lastWeekOfPrevYear;
            console.log('🔵 [NAVIGATE] Önceki yıla geçildi:', newYear, 'Hafta:', newWeekNumber);
        } else {
            // Mevcut yılın kaç haftası olduğunu kontrol et
            var weeksInYear = moment().isoWeekYear(year).isoWeeksInYear();
            console.log('🔵 [NAVIGATE] Yılın toplam hafta sayısı:', weeksInYear, 'Yeni hafta numarası:', newWeekNumber);
            if (newWeekNumber > weeksInYear) {
                // Sonraki yılın ilk haftasına git
                newYear = year + 1;
                newWeekNumber = 1;
                console.log('🔵 [NAVIGATE] Sonraki yıla geçildi:', newYear, 'Hafta:', newWeekNumber);
            }
        }
        
        // Yeni hafta değerini oluştur
        var newWeek = newYear + '-W' + String(newWeekNumber).padStart(2, '0');
        console.log('🔵 [NAVIGATE] Yeni hafta değeri:', newWeek);
    }
    
    // Hafta değerini korumak için bir flag set et
    window._navigatingWeek = true;
    
    // ✅ KRİTİK: change event'ini engellemek için önce flag'i set et, sonra değeri güncelle
    // Hafta değerlerini güncelle
    weekInput.value = newWeek;
    
    // ✅ KRİTİK: Programatik değişiklik olduğunu işaretle (change event'ini ignore etmek için)
    weekInput.setAttribute('data-programmatic-change', 'true');
    
    // Global erişim için window'a ekle (SPA geçişlerinde kullanılabilmesi için)
    if (typeof window.navigateWeek === 'undefined') {
        window.navigateWeek = navigateWeek;
    }
    
    // WeekPicker2'yi de güncelle
    const weekPicker2Element = document.getElementById("weekPicker2");
    if (weekPicker2Element) {
        weekPicker2Element.value = newWeek;
    }
    
    // ✅ KRİTİK: React SPA kontrolü - React SPA'da hiçbir şey yapma!
    // NOT: Bu kontrol fonksiyonun başında yapılıyor, buraya gelmemeli ama yine de kontrol ediyoruz
    const isReactSPA2 = document.querySelector('.dashboard-container') !== null ||
                       document.querySelector('.bg-alan') !== null ||
                       window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined ||
                       typeof window.__REACT_WEEK_CHANGE_CALLBACK__ === 'function';
    
    if (isReactSPA2) {
        console.log('🔵 [NAVIGATE] React SPA tespit edildi (ikinci kontrol), hiçbir şey yapılmıyor - React state zaten güncellendi');
        // Flag'i kaldır
        window._navigatingWeek = false;
        return; // Early return - React SPA'da hiçbir şey yapma!
    }
    
    // ✅ KRİTİK: React state'ini hemen güncelle (onWeekChange callback'i varsa) - Sadece Vanilla JS için
    // RightPanel.tsx'te onWeekChange prop'u setSelectedWeek'e bağlı
    // Bu sayede React state'i hemen güncellenir ve kartlar yeniden yüklenir
    if (typeof window.__REACT_WEEK_CHANGE_CALLBACK__ === 'function') {
        window.__REACT_WEEK_CHANGE_CALLBACK__(newWeek);
    }
    
    // ✅ KRİTİK: updateSelectedWeek'i sadece günleri güncellemek için çağır (Vanilla JS için)
    // Bu fonksiyon sadece takvim günlerini güncelliyor, paneli yenilemiyor
    if (typeof updateSelectedWeek === 'function') {
        console.log('🔵 [NAVIGATE] updateSelectedWeek çağrılıyor (sadece günleri güncellemek için)...');
        updateSelectedWeek();
        console.log('🔵 [NAVIGATE] updateSelectedWeek tamamlandı');
    } else {
        console.warn('⚠️ [NAVIGATE] updateSelectedWeek fonksiyonu bulunamadı');
    }
    
    // ✅ DÜZELTME: React SPA'da itemsContainer.innerHTML = '' yapma - React component'leri DOM'dan silinmemeli
    const itemsContainer = document.getElementById('itemsContainer');
    const emptyMsg = document.querySelector('.empty-message');
    const emptySearchMsg = document.querySelector('.empty-search-message');
    
    if (itemsContainer && !isReactSPA) {
        // Sadece vanilla JS kullanılıyorsa eski kartları temizle
        itemsContainer.innerHTML = '';
    }
    
    // Empty mesajlarını geçici olarak gizle
    if (emptyMsg) {
        emptyMsg.style.display = 'none';
        emptyMsg.style.visibility = 'hidden';
    }
    if (emptySearchMsg) {
        emptySearchMsg.style.display = 'none';
        emptySearchMsg.style.visibility = 'hidden';
    }
    
    // ✅ DÜZELTME: Debounce mekanizması - kullanıcı buton basmayı bıraktıktan sonra siparişleri yükle
    // Önceki timer'ı iptal et
    if (window._navigateWeekDebounceTimer) {
        clearTimeout(window._navigateWeekDebounceTimer);
    }
    
    // Yeni timer başlat - React state güncellemesini beklemek için
    window._navigateWeekDebounceTimer = setTimeout(async () => {
        console.log('🔵 [NAVIGATE] Debounce timer başladı');
        
        // React SPA kontrolü
        const itemsContainer = document.getElementById('itemsContainer');
        const isReactSPA = itemsContainer && (
            itemsContainer.querySelector('[data-reactroot]') !== null ||
            itemsContainer.querySelector('[data-react-helmet]') !== null ||
            (itemsContainer.children.length > 0 && itemsContainer.children[0].__reactInternalInstance !== undefined) ||
            window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined ||
            document.querySelector('.dashboard-container') !== null ||
            document.querySelector('.bg-alan') !== null
        );
        
        console.log('🔵 [NAVIGATE] React SPA kontrolü (timer içinde):', isReactSPA ? 'EVET' : 'HAYIR');
        
        if (isReactSPA) {
            // React SPA'da: React state güncellemesini ve render'ı beklemek için daha uzun bir gecikme
            console.log('🔵 [NAVIGATE] React SPA tespit edildi, React render bekliyor...');
            
            // ✅ KRİTİK: updateSelectedWeek çağırma - zaten yukarıda çağrıldı
            // React render'ının tamamlanması için bekle
            // ✅ DÜZELTME: Gecikmeyi artır - React Query fetch ve render tamamlanması için
            setTimeout(() => {
                console.log('🔵 [NAVIGATE] recheckWeekMatch çağrılıyor (React SPA)...');
                
                // ✅ DÜZELTME: React render'ının tamamlanmasını kontrol et
                // DOM'da kartların render edilip edilmediğini kontrol et
                const checkReactRender = () => {
                    const itemsContainer = document.getElementById('itemsContainer');
                    const hasCards = itemsContainer && (
                        itemsContainer.querySelectorAll('.item, .ana-kart, [data-kart-id]').length > 0 ||
                        itemsContainer.querySelector('.empty-message') !== null
                    );
                    
                    if (hasCards || !itemsContainer) {
                        // Kartlar render edildi veya container yok, recheckWeekMatch çağır
                        if (typeof recheckWeekMatch === 'function') {
                            recheckWeekMatch();
                        } else {
                            console.warn('⚠️ [NAVIGATE] recheckWeekMatch fonksiyonu bulunamadı');
                        }
                        if (typeof updateItemCount === 'function') {
                            updateItemCount();
                        }
                        if (typeof window.updateHeaderFilterCounts === 'function') {
                            window.updateHeaderFilterCounts();
                        }
                        
                        // ✅ REVIZE-15: Teslim edilen sayısını güncelle
                        if (typeof window.updateTeslimEdilenSiparisSayisi === 'function') {
                            window.updateTeslimEdilenSiparisSayisi();
                        }
                        
                        // Empty message'ı kontrol et
                        if (typeof toggleEmptyMessageIfNeeded === 'function') {
                            toggleEmptyMessageIfNeeded();
                        }
                        
                        // Flag'i kaldır
                        window._navigatingWeek = false;
                        console.log('🔵 [NAVIGATE] navigateWeek tamamlandı (React SPA)');
                    } else {
                        // Kartlar henüz render edilmedi, tekrar dene
                        console.log('🔵 [NAVIGATE] Kartlar henüz render edilmedi, tekrar denenecek...');
                        setTimeout(checkReactRender, 200);
                    }
                };
                
                // İlk kontrolü başlat
                checkReactRender();
            }, 800); // React Query fetch ve render için daha uzun gecikme
        } else {
            // Vanilla JS: Kartları yükle ve sonra filtrele
            console.log('🔵 [NAVIGATE] Vanilla JS modu, loadDynamicCards çağrılıyor...');
            if (typeof window.loadDynamicCards === 'function') {
                if (window.loadDynamicCardsLoading) {
                    // Yükleme devam ediyorsa, bitmesini bekle
                    const checkLoading = setInterval(async () => {
                        if (!window.loadDynamicCardsLoading) {
                            clearInterval(checkLoading);
                            try {
                                await window.loadDynamicCards();
                            } catch (error) {
                                console.error('❌ loadDynamicCards hatası:', error);
                            }
                        }
                    }, 100);
                    setTimeout(() => clearInterval(checkLoading), 5000);
                } else {
                    try {
                        await window.loadDynamicCards();
                    } catch (error) {
                        console.error('❌ loadDynamicCards hatası:', error);
                    }
                }
            }
            
            // Kartlar yüklendikten sonra recheckWeekMatch çağır
            let recheckCalled = false;
            const waitForCards = setInterval(() => {
                if (!window.loadDynamicCardsLoading) {
                    clearInterval(waitForCards);
                    if (!recheckCalled) {
                        recheckCalled = true;
                        setTimeout(() => {
                            // ✅ KRİTİK: updateSelectedWeek'i tekrar çağır (hafta günlerini güncelle)
                            if (typeof window.updateSelectedWeek === 'function') {
                                window.updateSelectedWeek();
                            }
                            
                            // Kısa bir gecikme ile recheckWeekMatch çağır (weekDays güncellenmesi için)
                            setTimeout(() => {
                                if (typeof recheckWeekMatch === 'function') {
                                    recheckWeekMatch();
                                }
                                if (typeof updateItemCount === 'function') {
                                    updateItemCount();
                                }
                                if (typeof window.updateHeaderFilterCounts === 'function') {
                                    window.updateHeaderFilterCounts();
                                }
                                
                                // ✅ REVIZE-15: Teslim edilen sayısını güncelle (flicker önlemek için)
                                if (typeof window.updateTeslimEdilenSiparisSayisi === 'function') {
                                    window.updateTeslimEdilenSiparisSayisi();
                                }
                                
                                // Empty message'ı kontrol et
                                if (typeof toggleEmptyMessageIfNeeded === 'function') {
                                    toggleEmptyMessageIfNeeded();
                                }
                                
                                // Flag'i kaldır
                                window._navigatingWeek = false;
                            }, 100);
                        }, 500);
                    }
                }
            }, 100);
            
            // Eğer kartlar zaten yüklüyse (loadDynamicCardsLoading false ise), hemen recheckWeekMatch çağır
            setTimeout(() => {
                if (!window.loadDynamicCardsLoading && !recheckCalled) {
                    recheckCalled = true;
                    // ✅ KRİTİK: updateSelectedWeek'i tekrar çağır (hafta günlerini güncelle)
                    if (typeof window.updateSelectedWeek === 'function') {
                        window.updateSelectedWeek();
                    }
                    
                    setTimeout(() => {
                        if (typeof recheckWeekMatch === 'function') {
                            recheckWeekMatch();
                        }
                        if (typeof updateItemCount === 'function') {
                            updateItemCount();
                        }
                        if (typeof window.updateHeaderFilterCounts === 'function') {
                            window.updateHeaderFilterCounts();
                        }
                        
                        // ✅ REVIZE-15: Teslim edilen sayısını güncelle
                        if (typeof window.updateTeslimEdilenSiparisSayisi === 'function') {
                            window.updateTeslimEdilenSiparisSayisi();
                        }
                        
                        // ✅ REVIZE-17: Ürün yazısı mevcut alanlarını kontrol et (gecikme yok!)
                        if (typeof window.checkUrunYazisiMevcutForAllCards === 'function') {
                            // requestAnimationFrame ile DOM güncellemesinden hemen sonra çalıştır
                            requestAnimationFrame(() => {
                                window.checkUrunYazisiMevcutForAllCards();
                            });
                        }
                        
                        // Empty message'ı kontrol et
                        if (typeof toggleEmptyMessageIfNeeded === 'function') {
                            toggleEmptyMessageIfNeeded();
                        }
                        
                        // Flag'i kaldır
                        window._navigatingWeek = false;
                    }, 100); // Kısa gecikme - weekDays güncellenmesi için
                }
            }, 200);
            
            setTimeout(() => clearInterval(waitForCards), 5000);
        }
        
        // Timer'ı temizle
        window._navigateWeekDebounceTimer = null;
    }, 100); // 100ms debounce - kullanıcı buton basmayı bıraktıktan sonra yükle
}

// #endregion Script --- Index --- Sağ Panel --- Takvim Hafta Seçim

// #region Index - Week Inputtan Seçilen 7 günlük 1 Haftalık tarih aralığına sahip olan kartları listele ve Organizasyon Türü Header Tarih Altındaki Filtrelemeler

// ÖNEMLİ: Bu bölüm kaldırıldı - Filtre sistemi aşağıdaki "Index - kart-filtreler" bölümünde birleştirildi
// Çakışan event listener'lar kaldırıldı


// ✅ Kart türünü güvenli almak için yardımcı fonksiyon
window.getKartTur = function(kart) {
    const anaKart = kart.querySelector('.ana-kart');
    if (!anaKart) return "";

    // Ana kart class'ına göre isim döndür
    if (anaKart.classList.contains('ciceksepeti-kart')) {
        return 'ÇİÇEK SEPETİ';
    } else if (anaKart.classList.contains('organizasyon') && !anaKart.classList.contains('aracsusleme') && !anaKart.classList.contains('ozelgun') && !anaKart.classList.contains('ozelsiparis')) {
        return 'ORGANİZASYON SİPARİŞLERİ';
    } else if (anaKart.classList.contains('aracsusleme')) {
        return 'ARAÇ SÜSLEME RANDEVULARI'; // DÜZELTME: RANDEVULARİ değil RANDEVULARI
    } else if (anaKart.classList.contains('ozelgun')) {
        return 'ÖZEL GÜN SİPARİŞLERİ';
    } else if (anaKart.classList.contains('ozelsiparis')) {
        return 'ÖZEL SİPARİŞLER';
    }
    
    return "";
}


// Tüm kartları gösterme işlevi (sadece seçili haftadaki kartları)
function showAllItems() {
    const weekDays = getSelectedWeekDays();
    if (!weekDays.length) {
        console.warn('⚠️ showAllItems: Hafta günleri bulunamadı');
        // Hafta günleri yoksa recheckWeekMatch çağır (o zaten hafta kontrolü yapıyor)
        if (typeof recheckWeekMatch === 'function') {
            recheckWeekMatch();
        }
        return;
    }
    
    const kartlar = document.querySelectorAll(".items .item");
    kartlar.forEach(function (kart) {
        const teslimTarihi = kart.querySelector(".teslim-zaman .tarih")?.textContent.trim();
        
        // Sadece seçili haftadaki kartları göster
        if (weekDays.includes(teslimTarihi)) {
            kart.style.setProperty('display', 'flex', 'important');
            kart.classList.remove("item-hidden");
            
            // Tooltip'leri göster
            const tooltips = kart.querySelectorAll("[data-tooltip]");
            tooltips.forEach(tooltip => {
                tooltip.style.display = "";
            });
        } else {
            kart.style.setProperty('display', 'none', 'important');
            kart.classList.add("item-hidden");
            
            // Tooltip'leri gizle
            const tooltips = kart.querySelectorAll("[data-tooltip]");
            tooltips.forEach(tooltip => {
                tooltip.style.display = "none";
            });
        }
    });
    
    // Ekstra güvenlik için recheckWeekMatch çağır
    if (typeof recheckWeekMatch === 'function') {
        recheckWeekMatch();
    }
}


// Kartları türe göre filtreleme işlevi
// ✅ REFACTORED: filterItems(filtre) → filterItemsByType(filtre) olarak yeniden adlandırıldı (2026-02-06)
function filterItemsByType(filtre) {
    const kartlar = document.querySelectorAll(".items .item");
    kartlar.forEach(function (kart) {
        const kartTur = getKartTur(kart);
        if (kartTur === filtre) {
            // Görünür yap - sadece display
            kart.style.setProperty('display', 'flex', 'important');
            kart.classList.remove("item-hidden");
            
            // Tooltip'leri göster
            const tooltips = kart.querySelectorAll("[data-tooltip]");
            tooltips.forEach(tooltip => {
                tooltip.style.display = "";
            });
        } else {
            // Gizli yap - sadece display
            kart.style.setProperty('display', 'none', 'important');
            kart.classList.add("item-hidden");
            
            // Tooltip'leri gizle
            const tooltips = kart.querySelectorAll("[data-tooltip]");
            tooltips.forEach(tooltip => {
                tooltip.style.display = "none";
            });
        }
    });
    recheckWeekMatch();
}
window.filterItemsByType = filterItemsByType;



// Kartları haftanın günlerine göre filtreleyen fonksiyon
function filterItemsByWeekDays(weekDays) {
    const items = document.querySelectorAll('.teslim-zaman');
    let foundItem = false;

    items.forEach(teslimTarihElement => {
        const kartTeslimTarihi = teslimTarihElement.querySelector('.tarih')?.textContent.trim();
        const kart = teslimTarihElement.closest(".item");
        if (!kart) return;

        if (weekDays.includes(kartTeslimTarihi)) {
            kart.style.setProperty('display', 'flex', 'important');
            kart.classList.remove("item-hidden");
            foundItem = true;
        } else {
            kart.style.setProperty('display', 'none', 'important');
            kart.classList.add("item-hidden");
        }
    });

    toggleEmptyMessageIfNeeded();

    if (typeof setupKartTasimaSistemi === "function") {
        setupKartTasimaSistemi();
    }
}

// Global erişim için
window.filterItemsByWeekDays = filterItemsByWeekDays;



// resetFilters fonksiyonu aşağıda tanımlı (satır ~1281) - Bu eski versiyon kaldırıldı


function handleDayClick(dayNumber, startDate, clickedElement) {
    var clickedDate = moment(startDate, 'DD-MM-YYYY').add(dayNumber - 1, 'days').format('DD MMMM YYYY dddd');

    let matchCount = 0;

    document.querySelectorAll(".item").forEach(function (item) {
        const teslimTarihi = item.querySelector(".teslim-zaman .tarih")?.textContent.trim();
        const isMatch = (teslimTarihi === clickedDate);
        if (isMatch) {
            item.style.setProperty('display', 'flex', 'important');
            item.classList.remove("item-hidden");
            matchCount++;
        } else {
            item.style.setProperty('display', 'none', 'important');
            item.classList.add("item-hidden");
        }
    });

    // Seçilen günü stilize et
    document.querySelectorAll(".clickable-day").forEach(function (el) {
        el.classList.remove("secili");
        el.classList.remove("today"); // 🔥 BUGÜN sınıfını da kaldır
        const dayNumberEl = el.querySelector('.day-number');
        if (dayNumberEl) dayNumberEl.style.color = ""; // stil de sıfırla
    });

    if (clickedElement) {
        clickedElement.classList.add("secili");
        const dayNumberEl = clickedElement.querySelector('.day-number');
        if (dayNumberEl) dayNumberEl.style.color = "#e91e63"; // örnek renk
    }

    // Empty message göster/gizle
    const emptyMsg = document.querySelector('.empty-message');
    if (emptyMsg) {
        emptyMsg.style.display = (matchCount === 0) ? 'flex' : 'none';
    }
}



// Tıklanan günün kartlarını gösterme veya gizleme işlevi
function filterItemsByClickedDay(dayIndex) {
    // Tıklanan günün tarihini hesapla
    var selectedWeek = document.getElementById("weekPicker").value;
    var startDate = moment(selectedWeek, 'YYYY-[W]WW').startOf('isoWeek');
    var clickedDate = startDate.clone().add(dayIndex - 1, 'days').format('DD MMMM YYYY dddd'); // dayIndex - 1

    // Kartların bulunduğu elementleri al
    var items = document.querySelectorAll(".items .item");

    items.forEach(function (item) {
        var teslimZaman = item.querySelector(".teslim-zaman .tarih").textContent.trim();
        // Eğer kartın teslim tarihi, tıklanan tarih ile aynıysa kartı göster, değilse gizle
        if (teslimZaman === clickedDate) {
            item.style.setProperty('display', 'flex', 'important');
            item.classList.remove('item-hidden');
        } else {
            item.style.setProperty('display', 'none', 'important');
            item.classList.add('item-hidden');
        }
    });
}

// #endregion Index - Week Inputtan Seçilen 7 günlük tarih aralığına sahip olan kartları listele ve Organizasyon Türü Header Tarih Altındaki Filtrelemeler

// #region Sipariş Kartları Üzerindeki Teslimat Tarihlerinin DD-MM-YYY formatlarını DD-MM-YYY dddd formatına çevir
// ============================================================================
// UTILS.JS'E TAŞINDI - 2026-02-05 (tarihFormatla)
// ============================================================================
// Fallback: utils.js yüklenmemişse
if (typeof window.tarihFormatla !== 'function') {
    window.tarihFormatla = function(tarihStr, format) {
        if (!tarihStr) return '';
    var tarihParcalari = tarihStr.split('-');
        if (tarihParcalari.length !== 3) return tarihStr;
    var gun = parseInt(tarihParcalari[0], 10);
        var ay = parseInt(tarihParcalari[1], 10) - 1;
    var yil = parseInt(tarihParcalari[2], 10);
    var tarih = new Date(yil, ay, gun);
        if (isNaN(tarih.getTime())) return tarihStr;
        return tarih.toLocaleDateString('tr-TR', format || { day: '2-digit', month: 'long', year: 'numeric' });
    };
}
var tarihFormatla = window.tarihFormatla;
// ============================================================================

// Sipariş kartları üzerindeki tarihleri çevir
var siparisTarihler = document.getElementsByClassName('tarih');
for (var i = 0; i < siparisTarihler.length; i++) {
    var siparisTarih = siparisTarihler[i].textContent;
    var formatlanmisTarih = tarihFormatla(siparisTarih, { day: '2-digit', month: 'long', year: 'numeric', weekday: 'long' });
    siparisTarihler[i].textContent = formatlanmisTarih;
}

// #endregion Sipariş Kartları Üzerindeki Teslimat Tarihlerinin DD-MM-YYY formatlarını DD-MM-YYY dddd formatına çevir

// #region Index Sipariş Kartlarını Listeleme (Item - Sipariş Kartlarını Sırala Butonu)
const filterLinks = document.querySelectorAll('.clickdropdown-content span');

filterLinks.forEach(link => {
    link.addEventListener('click', function (event) {
        event.preventDefault();
        const sortBy = this.id;
        sortItems(sortBy); // Sıralama fonksiyonunu doğrudan çağır
        if (sortBy === 'alphabetical') {
            sortCardsAlphabetically(); // Organizasyon türüne göre sıralandığında alfabetik sıralamayı gerçekleştir
        }
    });
});


const searchInput = document.getElementById('search-box');
const mobileSearchInput = document.getElementById('search-box-mobile');
// ✅ DÜZELTME: items dizisini her zaman güncel DOM'dan almalıyız
// const items = Array.from(document.querySelectorAll('.item')); // ❌ KALDIRILDI - Eski diziyi kullanıyor
const itemsContainer = document.getElementById('itemsContainer');

// items dizisini dinamik olarak alan yardımcı fonksiyon
function getCurrentItems() {
    return Array.from(document.querySelectorAll('.item'));
}



function filterItems() {
    // Element kontrolü ile güvenli erişim
    const searchInput = safeGetElementById("search-box") || safeGetElement("#search-box");
    const mobileSearchInput = safeGetElementById("search-box-mobile") || safeGetElement("#search-box-mobile");
    const weekPicker = safeGetElementById("weekPicker");

    if (!searchInput || !mobileSearchInput || !weekPicker) {
        // console.log("Filter için gerekli elementler bulunamadı - filtre atlanıyor");
        return;
    }

    const searchText = searchInput.value.toLowerCase();
    const mobileSearchText = mobileSearchInput.value.toLowerCase();
    const combinedSearch = (searchText || mobileSearchText || '').trim();

    const selectedWeek = weekPicker.value;
    const weekDays = getSelectedWeekDays();
    if (!weekDays.length) return;

    // ✅ DÜZELTME: items dizisini her zaman güncel DOM'dan al
    const items = getCurrentItems();
    if (!items || items.length === 0) {
        return;
    }

    const emptySearch = combinedSearch.length === 0;
    let visibleCount = 0;
    
    items.forEach(item => {
        if (!item) return; // Null/undefined item kontrolü

        const itemText = item.innerText ? item.innerText.toLowerCase() : '';
        const tarihElement = item.querySelector(".tarih");
        const itemTarih = tarihElement ? tarihElement.textContent.trim() : '';

        const matchesSearch = emptySearch ? true : itemText.includes(combinedSearch);
        const matchesWeek = weekDays.includes(itemTarih);

        const isVisible = matchesSearch && matchesWeek;

        // Hem item hem ana-kart için görünürlüğü ayarla - !important kullan
        if (isVisible) {
            item.style.setProperty('display', 'flex', 'important');
            item.classList.remove('item-hidden');
            visibleCount++;
        } else {
            item.style.setProperty('display', 'none', 'important');
            item.classList.add('item-hidden');
        }
        const anaKart = item.querySelector('.ana-kart');
        if (anaKart) {
            anaKart.style.display = isVisible ? "block" : "none";
        }
    });

    // Empty message kontrolü
    const emptyMessage = document.querySelector('.empty-message');
    if (emptyMessage) {
        emptyMessage.style.display = visibleCount === 0 ? 'flex' : 'none';
    }

    // recheckWeekMatch fonksiyonu varsa çağır
    if (typeof recheckWeekMatch === 'function') {
        recheckWeekMatch();
    }
}
function initWeekPickerListeners() {
    // ✅ KRİTİK: React SPA kontrolü - React SPA'da bu listener'ları ekleme!
    const isReactSPA = document.querySelector('.dashboard-container') !== null ||
                       document.querySelector('.bg-alan') !== null ||
                       window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined ||
                       typeof window.__REACT_WEEK_CHANGE_CALLBACK__ === 'function';
    
    if (isReactSPA) {
        console.log('🔵 [INIT] React SPA tespit edildi, initWeekPickerListeners atlanıyor - React zaten yönetiyor');
        return; // Early return - React SPA'da bu listener'ları ekleme!
    }
    
    const weekInputs = document.querySelectorAll("#weekPicker, #weekPicker2");

    weekInputs.forEach(weekInput => {
        weekInput.addEventListener("change", () => {
            updateSelectedWeek();   // Günleri çiz
            updateItemCount();      // Sayıları güncelle (teslim edilen hariç)
            recheckWeekMatch();     // ESKİ SİSTEMDEKİ GİBİ
            if (typeof window.updateHeaderFilterCounts === 'function') {
                window.updateHeaderFilterCounts(); // Header filtre sayaçlarını güncelle
            }
            
            // ✅ REVIZE-15: Teslim edilen sayısını güncelle (flicker önlemek için updateItemCount'tan ayrı)
            if (typeof window.updateTeslimEdilenSiparisSayisi === 'function') {
                // Kısa bir gecikme ile çağır (kartlar yüklenene kadar bekle)
                setTimeout(() => {
                    window.updateTeslimEdilenSiparisSayisi();
                }, 500);
            }
        });
    });
}






// Fonksiyon kartları alfabetik olarak sıralar
function sortCardsAlphabetically() {
    const container = document.getElementById("itemsContainer");
    const cards = Array.from(container.getElementsByClassName("item"));

    // Öncelik sırası: organizasyon > aracsusleme > ozelsiparis > ozelgun
    const turOncelikSirasi = {
        'organizasyon': 1,
        'aracsusleme': 2,
        'ozelsiparis': 3,
        'ozelgun': 4
    };

    const sortedCards = cards.sort((a, b) => {
        const aKart = a.querySelector('.ana-kart');
        const bKart = b.querySelector('.ana-kart');

        if (!aKart || !bKart) return 0;

        const aClass = Object.keys(turOncelikSirasi).find(cls => aKart.classList.contains(cls)) || 'zzz';
        const bClass = Object.keys(turOncelikSirasi).find(cls => bKart.classList.contains(cls)) || 'zzz';

        const aPriority = turOncelikSirasi[aClass] || 999;
        const bPriority = turOncelikSirasi[bClass] || 999;

        if (aPriority !== bPriority) {
            return aPriority - bPriority; // Öncelik sırasına göre sırala
        }

        // Aynı türdeyse, alfabetik sırala
        const aText = a.querySelector(".kart-tur")?.textContent.toLowerCase() || '';
        const bText = b.querySelector(".kart-tur")?.textContent.toLowerCase() || '';
        return aText.localeCompare(bText);
    });

    container.innerHTML = "";
    sortedCards.forEach(card => container.appendChild(card));
    recheckWeekMatch();
    
    // Sıralama sonrası geçmiş sipariş uyarılarını güncelle
    if (typeof guncelleGecmisSiparisUyarilari === 'function') {
        guncelleGecmisSiparisUyarilari();
    }
}


const sayiElement = safeGetElementById("sayi");
if (sayiElement) {
    sayiElement.addEventListener("click", function () {
        sortItemsByOrderCount();
    });
}

// Fonksiyon kartları sipariş sayısına göre sıralar
function sortItemsByOrderCount() {
    var container = document.getElementById("itemsContainer");
    var cards = container.getElementsByClassName("item");
    var sortedCards = Array.from(cards).sort(function (a, b) {
        var countA = a.querySelectorAll('.siparis-kart').length;
        var countB = b.querySelectorAll('.siparis-kart').length;
        return countB - countA; // Büyükten küçüğe sırala
    });
    // Sıralanmış kartları yeniden düzenle
    container.innerHTML = "";
    sortedCards.forEach(function (item) {
        container.appendChild(item);
    });
    recheckWeekMatch();
}

// Açılır menü değiştiğinde çağrılacak fonksiyon
const sortByElement = document.getElementById("sortBy");
if (sortByElement) {
    sortByElement.addEventListener("change", function () {
        var sortBy = this.value;
        if (sortBy === "alphabetical") {
            if (typeof sortCardsAlphabetically === 'function') {
                sortCardsAlphabetically();
            }
        } else if (sortBy === "sayi") {
            if (typeof sortItemsByOrderCount === 'function') {
                sortItemsByOrderCount();
            }
        }
    });
} else {
}

function sortItems(sortBy) {
    let sortedItems;

    if (!sortBy || sortBy === 'none') {
        filterItems();
        return;
    }

    // ✅ DÜZELTME: Güncel kartları al
    const items = getCurrentItems();
    if (!items || !items.length) {
        console.error('Sıralanacak kartlar bulunamadı');
        return;
    }

    sortedItems = items.slice().sort((a, b) => {
        const aValue = getItemValue(a, sortBy);
        const bValue = getItemValue(b, sortBy);
        if (aValue < bValue) return -1;
        if (aValue > bValue) return 1;
        return 0;
    });

    itemsContainer.innerHTML = '';
    sortedItems.forEach(item => {
        itemsContainer.appendChild(item);
    });

    filterItems();
    recheckWeekMatch();
    
    // Sıralama sonrası geçmiş sipariş uyarılarını güncelle
    if (typeof guncelleGecmisSiparisUyarilari === 'function') {
        guncelleGecmisSiparisUyarilari();
    }
}


function getItemValue(item, sortBy) {
    // Belirli kart alanlarına göre değeri al
    switch (sortBy) {
        case 'kart-tur':
            return item.querySelector('.kart-tur').innerText.toLowerCase();
        case 'etiket':
            return item.querySelector('.kart-etiket').innerText.toLowerCase();
        case 'konum':
            return item.querySelector('.konum').innerText.toLowerCase();
        case 'organizasyonSahibi':
            return item.querySelector('.kisi-isim').innerText.toLowerCase();

        case 'tarih':
            const tarihText = item.querySelector('.tarih')?.innerText.trim();

            // Günü (Pazartesi, Cumartesi vs.) at
            const tarihParca = tarihText?.split(" ").slice(0, 3).join(" "); // "31 Mayıs 2025"
            const parsedDate = moment(tarihParca, "DD MMMM YYYY", 'tr');

            if (!parsedDate.isValid()) {
                console.warn("Geçersiz tarih:", tarihText);
                return '';
            }

            return parsedDate.toDate().getTime();



        case 'saat':
            return item.querySelector('.teslim-saat').innerText.toLowerCase();
        default:
            return '';
    }
}

if (searchInput) {
    searchInput.addEventListener('input', filterItems);
    searchInput.addEventListener('keydown', (e)=>{
        if (e.key === 'Escape') {
            searchInput.value = '';
            if (mobileSearchInput) mobileSearchInput.value = '';
            filterItems();
        }
    });
    // Native clear (x) ve Enter/ESC sonrası tetiklenen 'search' event’i
    searchInput.addEventListener('search', ()=>{
        filterItems();
    });
}
if (mobileSearchInput) {
    mobileSearchInput.addEventListener('input', filterItems);
    mobileSearchInput.addEventListener('keydown', (e)=>{
        if (e.key === 'Escape') {
            mobileSearchInput.value = '';
            if (searchInput) searchInput.value = '';
            filterItems();
        }
    });
    mobileSearchInput.addEventListener('search', ()=>{
        filterItems();
    });
}

// Filter’ı diğer dosyalardan da çağırabilmek için global'e aktar
window.filterItems = filterItems;


// Sayfa yüklenince sadece tarih sıralaması yap, filtreleme yapma:
// ✅ DÜZELTME: Dinamik kartlar yüklenmeden önce çalışmalı, yoksa kartları temizler
// ✅ Sadece statik kartlar varsa çalışmalı (dinamik kartlar yüklenmeden önce)
window.addEventListener('load', function () {
    // Dinamik kartlar yükleniyorsa veya yüklenmişse, bu fonksiyonu çağırma
    if (window.loadDynamicCardsLoading || document.querySelectorAll('.item[data-organizasyon-id]').length > 0) {
        return;
    }
    
    // Sadece statik kartlar varsa sırala
    const staticItems = Array.from(document.querySelectorAll('.item'));
    if (staticItems.length > 0) {
        sortItemsWithoutFiltering('tarih');
    }
});

function sortItemsWithoutFiltering(sortBy) {
    // items dizisini yeniden al (güncel DOM'dan)
    const currentItems = Array.from(document.querySelectorAll('.item'));
    
    // Dinamik kartlar varsa (data-organizasyon-id attribute'u olan), bu fonksiyonu çalıştırma
    const hasDynamicCards = currentItems.some(item => item.hasAttribute('data-organizasyon-id'));
    if (hasDynamicCards) {
        return;
    }
    
    let sortedItems;

    if (!currentItems.length) return;

    sortedItems = currentItems.slice().sort((a, b) => {
        const aValue = getItemValue(a, sortBy);
        const bValue = getItemValue(b, sortBy);
        return aValue - bValue;
    });

    const itemsContainer = document.getElementById('itemsContainer');
    if (!itemsContainer) return;
    
    itemsContainer.innerHTML = '';
    sortedItems.forEach(item => itemsContainer.appendChild(item));
    
    // Sıralama sonrası geçmiş sipariş uyarılarını güncelle
    if (typeof guncelleGecmisSiparisUyarilari === 'function') {
        guncelleGecmisSiparisUyarilari();
    }
}


// #endregion

// #region Index - Filtrelerin yanına kart sayılarını yazdır
// ÖNEMLİ: Bu bölüm kaldırıldı - Event listener'lar aşağıdaki "Index - kart-filtreler" bölümüne taşındı
// Sayaç fonksiyonları global olarak tutuldu

//#endregion Index - Filtrelerin yanına kart sayılarını yazdır

// #region Index - kart-filtreler "Tüm Siparişler" Göster - Organizasyon Türü Header Tarih Altındaki Filtrelemeler

// Filtre sistemini başlat
function initFiltreSistemi() {
    // ÖNEMLİ: Sadece index sayfasında çalış
    const isIndexPage = window.location.pathname.includes("index.html") || 
                        window.location.pathname === '/' || 
                        window.location.pathname.endsWith('/index.html') ||
                        document.querySelector('.bg-alan[data-page="index"]') !== null;
    if (!isIndexPage) {
        return;
    }

    // Filtre butonlarına event listener ekle
    const kartFiltreler = document.querySelectorAll('.kart-filtreler li');
    kartFiltreler.forEach(filtre => {
        filtre.addEventListener('click', function() {
            // Önce tüm seçimleri kaldır
            kartFiltreler.forEach(f => f.classList.remove('filtre-secili'));
            // Bu filtreyi seç
            this.classList.add('filtre-secili');
            
            // Filtreleme işlemi
            if (typeof filterItems === 'function') {
                filterItems();
            }
        });
    });

    // Kart sayılarını güncelle
    if (typeof updateFilteredItemCounts === 'function') {
        updateFilteredItemCounts();
    }
    
    // Header filtre sayaçlarını güncelle
    if (typeof updateHeaderFilterCounts === 'function') {
        updateHeaderFilterCounts();
    }
    
}

// Global erişim için window'a ekle
window.initFiltreSistemi = initFiltreSistemi;

// ===== FONKSİYONLAR =====
// Not: resetFilters, filterItems, checkError, updateFilteredItemCounts fonksiyonları aşağıda global olarak tanımlanmıştır

// ===== GLOBAL FONKSİYONLAR =====

// Filtreleri sıfırla - Global fonksiyon
function resetFilters() {
    
    // Filtre stillerini sıfırla
    document.querySelectorAll(".kart-filtreler .kartin-tur-adi").forEach(filtre => {
        filtre.classList.remove("filtre-secili");
    });

    // "Tüm Siparişler" butonunu seçili yap
    const tumSiparisler = document.querySelector(".tum-siparisleri-goster");
    if (tumSiparisler) {
        tumSiparisler.classList.add("filtre-secili");
    }

    // Kartları yeniden göster - recheckWeekMatch kullan
    if (typeof recheckWeekMatch === 'function') {
        recheckWeekMatch();
    } else {
        console.warn('⚠️ recheckWeekMatch fonksiyonu bulunamadı');
    }

    // Kart sayısını güncelle
    if (typeof updateItemCount === 'function') {
        updateItemCount();
    }
    
    // Header filtre sayaçlarını güncelle
    if (typeof window.updateHeaderFilterCounts === 'function') {
        window.updateHeaderFilterCounts();
    }
    
}

// ⚠️ DUPLICATE: showAllItems fonksiyonu satır ~1115'te zaten tanımlı - Yorum satırına alındı (2026-02-05)
/*
function showAllItems() {
    const weekDays = getSelectedWeekDays();
    if (!weekDays.length) {
        console.warn('⚠️ showAllItems: Hafta günleri bulunamadı');
        return;
    }
    
    const kartlar = document.querySelectorAll(".items .item");
    kartlar.forEach(function (kart) {
        const teslimTarihi = kart.querySelector(".teslim-zaman .tarih")?.textContent.trim();
        
        // Sadece seçili haftadaki kartları göster
        if (weekDays.includes(teslimTarihi)) {
            kart.style.setProperty('display', 'flex', 'important');
            kart.classList.remove("item-hidden");
        } else {
            kart.style.setProperty('display', 'none', 'important');
            kart.classList.add("item-hidden");
        }
    });
}
*/

// Kartları türe göre filtrele - Global fonksiyon
// ⚠️ DUPLICATE: filterItems fonksiyonu satır ~1160 ve ~1351'de zaten tanımlı - Yorum satırına alındı (2026-02-05)
/*
function filterItems(filtre) {
    const weekDays = getSelectedWeekDays();
    if (!weekDays.length) return;

    const kartlar = document.querySelectorAll(".items .item");
    let matchCount = 0;

    kartlar.forEach(function (kart) {
        const teslimTarihi = kart.querySelector(".teslim-zaman .tarih")?.textContent.trim();
        const tarihUyumlu = weekDays.includes(teslimTarihi);
        
        // getKartTur fonksiyonunu kullan (ana-kart class'larını kontrol eder)
        const kartTur = window.getKartTur(kart);
        const turUyumlu = kartTur === filtre;

        if (tarihUyumlu && turUyumlu) {
            kart.style.setProperty('display', 'flex', 'important');
            kart.classList.remove("item-hidden");
            matchCount++;
        } else {
            kart.style.setProperty('display', 'none', 'important');
            kart.classList.add("item-hidden");
        }
    });
}
*/

// Hata mesajını kontrol et - Global fonksiyon
function checkError() {
    const kartlar = document.querySelectorAll(".items .item");
    let kartVarMi = false;

    kartlar.forEach(function (kart) {
        if (kart.style.display !== "none") kartVarMi = true;
    });

    const hataMesaji = document.querySelector(".empty-message");
    if (hataMesaji) {
        hataMesaji.style.display = kartVarMi ? "none" : "flex";
    }
}

// Filtre sayaçlarını güncelle - Global fonksiyon
function updateFilteredItemCounts() {
    const weekDays = getSelectedWeekDays();
    if (!weekDays.length) return;

    let kartAdetleri = {
        'ORGANİZASYON SİPARİŞLERİ': 0,
        'ARAÇ SÜSLEME RANDEVULARI': 0,
        'ÖZEL GÜN SİPARİŞLERİ': 0,
        'ÖZEL SİPARİŞLER': 0,
        'ÇİÇEK SEPETİ': 0
    };

    // Her türden kaç kart olduğunu say - getKartTur kullan (ana-kart class'larına bakıyor)
    document.querySelectorAll(".items .item").forEach(function (kart) {
        const teslimTarihi = kart.querySelector(".teslim-zaman .tarih")?.textContent.trim();

        if (!weekDays.includes(teslimTarihi)) return;

        const kartTur = window.getKartTur(kart);
        if (kartTur && kartAdetleri[kartTur] !== undefined) {
            kartAdetleri[kartTur]++;
        }
    });

    // Filtrelerdeki sayıları güncelle
    let allFiltersZero = true;
    const tumSiparisler = document.querySelector(".tum-siparisleri-goster");
    
    document.querySelectorAll(".kart-filtreler li").forEach(function (filtre) {
        // "Tüm Siparişler" butonunu atla
        if (filtre.classList.contains("tum-siparisleri-goster")) return;
        
        const turEl = filtre.querySelector(".kartin-tur-adi") || filtre;
        
        // Filtre text'ini temizle (span içeriğini çıkar) - TÜRKÇE LOCALE KULLAN
        let filtreText = turEl.textContent.trim().toLocaleUpperCase('tr-TR');
        // Sayı ve parantez içeriğini temizle
        filtreText = filtreText.replace(/\(.*?\)/g, '').replace(/\d+/g, '').trim();
        
        const kartAdeti = kartAdetleri[filtreText] || 0;
        
        // data-kart-adeti attribute'unu güncelle (CSS ::after için)
        turEl.setAttribute('data-kart-adeti', kartAdeti);
        
        // Pasif/Aktif durumu - ÖNEMLİ: pointer-events de ayarla
        if (kartAdeti === 0) {
            turEl.classList.add("filtre-pasif");
            turEl.classList.remove("filtre-aktif");
        } else {
            turEl.classList.remove("filtre-pasif");
            turEl.classList.add("filtre-aktif");
            allFiltersZero = false;
        }
    });

    // Tüm filtreler sıfırsa "Tüm Siparişler" de pasif
    if (tumSiparisler) {
        if (allFiltersZero) {
            tumSiparisler.classList.add("filtre-pasif");
            tumSiparisler.classList.remove("filtre-aktif");
        } else {
            tumSiparisler.classList.remove("filtre-pasif");
            tumSiparisler.classList.add("filtre-aktif");
        }
    }
}

// Global erişim için window'a ekle
window.resetFilters = resetFilters;
window.filterItems = filterItems;
window.checkError = checkError;
window.updateFilteredItemCounts = updateFilteredItemCounts;

//#endregion

// #region Index - Kart Alan Sol Üst - Week Input tarihini baslik-tarih alanına haftanın ilk ve son günlerininin tarihlerini yazdırma

// Global fonksiyonlar - head-component.js tarafından çağrılabilmesi için window'a ekleniyor
function getWeekDates(selectedDate) {
    var days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    var months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

    var selectedDateCopy = new Date(selectedDate);

    var firstDayOfWeek = new Date(selectedDateCopy.setDate(selectedDateCopy.getDate() - (selectedDateCopy.getDay() === 0 ? 6 : selectedDateCopy.getDay() - 1)));
    var lastDayOfWeek = new Date(selectedDateCopy.setDate(selectedDateCopy.getDate() + 6));

    var firstDay = firstDayOfWeek.getDate().toString().padStart(2, '0'); // Gün rakamını 2 haneli yap
    var firstMonth = months[firstDayOfWeek.getMonth()];
    var firstYear = firstDayOfWeek.getFullYear();
    var firstDayOfWeekName = days[firstDayOfWeek.getDay()];

    var lastDay = lastDayOfWeek.getDate().toString().padStart(2, '0'); // Gün rakamını 2 haneli yap
    var lastMonth = months[lastDayOfWeek.getMonth()];
    var lastYear = lastDayOfWeek.getFullYear();
    var lastDayOfWeekName = days[lastDayOfWeek.getDay()];

    // Virgülü tarih ve gün adı arasına ekleyelim
    return `${firstDay} ${firstMonth} ${firstYear} ${firstDayOfWeekName} <span class="tarih-ayirici">→</span> ${lastDay} ${lastMonth} ${lastYear} ${lastDayOfWeekName}`;
}

// navigateWeek fonksiyonu artık createNavButtons içinde window.navigateWeek olarak tanımlanıyor
// Bu lokal fonksiyon kaldırıldı, global window.navigateWeek kullanılıyor

// window.updateSelectedWeek ve window.updateWeek artık lokal fonksiyonlar olarak tanımlı (satır 274 ve 444)
// Bu global fonksiyonlar kaldırıldı - Yedekteki çalışan lokal fonksiyonlar kullanılıyor

// DOMContentLoaded event listener - Week input change event'i için
// NOT: Bu listener initTakvimSistemi() içinde zaten ekleniyor, bu yüzden gereksiz
// initTakvimSistemi() DOMContentLoaded geçmiş olsa bile çalıştığı için bu listener'a gerek yok




//#endregion Index - Kart Alan Sol Üst - Week Input tarihini baslik-tarih alanına haftanın ilk ve son günlerininin tarihlerini yazdırma

// #region Index - Organizasyon Sipariş Kartlarının üzerindeki teslim-saat kalan süre uyarıları
// NOT: getWeekDates fonksiyonu yukarıda (satır 1408) zaten tanımlı, bu yüzden burada tekrar tanımlanmıyor

function kalanSuresiGuncelle() {
    // Tüm .item kartlarını, .siparis-kart ve form içindeki teslim saatlerini seç
    var kartlar = document.querySelectorAll('.item, .siparis-kart');
    var formTeslimSaatler = document.querySelectorAll('form .teslim-saat');

    // Bugünün tarihi (DD-MM-YYYY formatında!)
    var bugun = moment().format('DD-MM-YYYY');

    // Her bir kart için işlem yap
    kartlar.forEach(function (kart) {
        // Kartın ana-kart'ını bul
        var anaKart = kart.closest('.ana-kart') || kart; // Eğer zaten ana-kart ise kendisi olur

        // Ana kart içerisindeki teslim tarihi
        var tarihEl = anaKart.querySelector('.teslim-zaman .tarih');
        if (!tarihEl) return;

        var kartTarihi = moment(tarihEl.textContent.trim(), ['DD-MM-YYYY', 'DD MMM YYYY', 'DD MMMMM YYYY dddd'], 'tr').format('DD-MM-YYYY');

        // Eğer bugünün tarihi değilse uyarı yazdırma (sadece sıfırla ve geç)
        if (kartTarihi !== bugun) {
            var teslimSaat = kart.querySelector('.teslim-saat');
            if (teslimSaat) {
                resetTeslimSaatWarnings(teslimSaat);
            }
            return; // diğer işlemleri yapma!
        }

        // Kart içerisindeki teslim saatini seç
        var teslimSaat = kart.querySelector('.teslim-saat');

        // Teslim saat bilgisi varsa işlem yap
        if (teslimSaat) {
            processTeslimSaat(teslimSaat);
        }
    });

    // Form içindeki teslim saatleri için işlem yap (tarih kontrolü olmadan)
    formTeslimSaatler.forEach(function (teslimSaat) {
        processTeslimSaat(teslimSaat);
    });
}

// Teslim saat uyarılarını sıfırlayan yardımcı fonksiyon
function resetTeslimSaatWarnings(teslimSaat) {
    var kalanSureUyari = teslimSaat.querySelector('.kalan-sure-uyari');
    var dahaZamanVarElementi = teslimSaat.querySelector('.daha-zaman-var');
    var sureGectiElement = teslimSaat.querySelector('.sure-gecti');

    if (kalanSureUyari) kalanSureUyari.style.display = 'none';
    if (dahaZamanVarElementi) dahaZamanVarElementi.style.display = 'none';
    if (sureGectiElement) sureGectiElement.style.display = 'none';
}

// Teslim saat işlemlerini yapan yardımcı fonksiyon
function processTeslimSaat(teslimSaat) {
    var saatIcerikElement = teslimSaat.querySelector('.saat-icerik .saat-veri') ||
        teslimSaat.querySelector('.saat-icerik');

    if (!saatIcerikElement) return;

    var saatMetni = saatIcerikElement.textContent.trim().replace('Saat', '');
    var saatParcaları = saatMetni.split(':');

    if (saatParcaları.length < 2) return;

    var teslimZamani = new Date();

    // Saati ve dakikayı tarihe ekle
    teslimZamani.setHours(parseInt(saatParcaları[0]));
    teslimZamani.setMinutes(parseInt(saatParcaları[1]));
    teslimZamani.setSeconds(0);

    // Şu anki zamanı al
    var suAn = new Date();

    // Kalan süreyi hesapla (dakika cinsinden)
    var kalanSure = Math.floor((teslimZamani.getTime() - suAn.getTime()) / (1000 * 60));

    // Uyarıları hazırla
    var kalanSureUyari = teslimSaat.querySelector('.kalan-sure-uyari');
    var dahaZamanVarElementi = teslimSaat.querySelector('.daha-zaman-var');
    var sureGectiElement = teslimSaat.querySelector('.sure-gecti');

    if (kalanSure < 0) {
        if (kalanSureUyari) kalanSureUyari.style.display = 'none';
        if (dahaZamanVarElementi) dahaZamanVarElementi.style.display = 'none';
        if (sureGectiElement) {
            sureGectiElement.style.display = 'flex';
            sureGectiElement.textContent = 'TESLİM SAATİ GEÇTİ!';
        }
    } else if (kalanSure <= 60 && kalanSure >= 0) {
        if (dahaZamanVarElementi) dahaZamanVarElementi.style.display = 'none';
        if (sureGectiElement) sureGectiElement.style.display = 'none';
        if (kalanSureUyari) {
            kalanSureUyari.style.display = 'flex';
            kalanSureUyari.innerHTML = '<i class="icon-saat"></i><span>' + kalanSure + ' DK KALDI</span>';
        }
    } else {
        if (sureGectiElement) sureGectiElement.style.display = 'none';
        if (kalanSureUyari) kalanSureUyari.style.display = 'none';
        if (dahaZamanVarElementi) {
            dahaZamanVarElementi.style.display = 'block';
            var kalanSaatler = Math.floor(kalanSure / 60);
            var kalanDakikalar = kalanSure % 60;
            var kalanSureMetni = ('0' + kalanSaatler).slice(-2) + ' SA : ' + ('0' + kalanDakikalar).slice(-2) + ' DK';
            dahaZamanVarElementi.innerHTML = '<i class="icon-saat"></i><span>' + kalanSureMetni + '</span>';
        }
    }
}

function initializePage() {
    // Sayfa yüklendiğinde mevcut haftanın tarihlerini al
    var weekInput = document.getElementById('weekPicker');
    if (!weekInput || !weekInput.valueAsDate) {
        return;
    }
    var selectedDate = weekInput.valueAsDate;
    var currentWeekDates = getWeekDates(selectedDate);
    
    // SADECE web görünümü için (baslikTarihWeb) - mobil için updateSelectedWeek() zaten çalışıyor
    // Mobil elementi (baslikTarihMobile) kesinlikle hariç tut
    var baslikDivWeb = document.getElementById('baslikTarihWeb');
    if (baslikDivWeb) {
        baslikDivWeb.innerHTML = currentWeekDates;
    }
    // Mobil element için hiçbir şey yapma - updateSelectedWeek() zaten doğru şekilde çalışıyor

    // Kalan süreyi güncelle
    kalanSuresiGuncelle();
}

// Sayfa yüklendiğinde ve her dakikanın başında kalan süreyi güncelle
// NOT: initTakvimSistemi ve initFiltreSistemi kartlar yüklendikten SONRA 
// head-component.js tarafından çağrılır, burada çağırmıyoruz!
(function initOnScriptLoad() {
    // DOM hazır mı kontrol et
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runInit);
    } else {
        // DOM zaten hazır, hemen çalıştır
        runInit();
    }
    
    function runInit() {
    initializePage();
    kalanSuresiGuncelle(); // ilk açılışta hemen çalıştır
    setInterval(kalanSuresiGuncelle, 60000); // Her dakika güncelle
        // NOT: initTakvimSistemi ve initFiltreSistemi burada çağrılmaz!
        // Kartlar loadDynamicCards ile yüklendikten sonra head-component.js tarafından çağrılır
    }
})();

//#endregion Index - Organizasyon Sipariş Kartlarının üzerindeki teslim-saat kalan süre uyarıları

// #region Organizasyon Sipariş Kartları Eğer Bugünün Tarihi değilse "Bu kartta geçmiş siparişler mevcut! Lütfen kontrol ediniz." Uyarısı Göster
function guncelleGecmisSiparisUyarilari() {
    const bugun = moment();
    let kontrolEdilenKartSayisi = 0;
    let gecmisTarihliKartSayisi = 0;

    document.querySelectorAll('.item').forEach(anaKart => {
        const tarihEl = anaKart.querySelector('.teslim-zaman .tarih');
        if (!tarihEl) {
            return; // Tarih elementi yoksa sessizce atla
        }

        const tarihText = tarihEl.textContent.trim();
        
        // Tarih boşsa sessizce atla
        if (!tarihText) {
            return;
        }
        
        // Tarihi parse et - birden fazla format dene
        let kartTarihiMoment = moment(tarihText, 'DD MMMM YYYY dddd', 'tr', true);
        if (!kartTarihiMoment.isValid()) {
            kartTarihiMoment = moment(tarihText, 'DD MMMM YYYY', 'tr', true);
        }
        if (!kartTarihiMoment.isValid()) {
            kartTarihiMoment = moment(tarihText, 'DD-MM-YYYY', true);
        }
        
        // Tarih parse edilemezse atla (debug mode'da uyarı)
        if (!kartTarihiMoment.isValid()) {
            // console.warn('⚠️ Geçersiz tarih formatı:', tarihText, 'Kart:', anaKart);
            return;
        }
        
        kontrolEdilenKartSayisi++;

        // ✅ Uyarı zaten var mı kontrol et - varsa atla (kart oluşturulurken eklenmiş olabilir)
        let uyariEl = anaKart.querySelector('.gecmis-siparis-uyari');
        if (uyariEl && uyariEl.innerHTML.trim() !== '') {
            // Uyarı zaten var ve içeriği dolu, atla
            return;
        }
        
        // Uyarı yoksa veya boşsa oluştur
        if (!uyariEl) {
            uyariEl = document.createElement('div');
            uyariEl.className = 'gecmis-siparis-uyari';
            anaKart.querySelector('.teslim-zaman')?.insertAdjacentElement('beforebegin', uyariEl);
        }

        // Tarih bugünden önceyse uyarı göster
        if (kartTarihiMoment.isBefore(bugun, 'day')) {
            uyariEl.style.display = 'block';
            uyariEl.innerHTML = `
          <div class="uyari-not" data-tooltip="Bu kartta geçmiş tarihli siparişler var, lütfen kontrol edin ve siparişlerin durumunu güncelledikten sonra kartı arşivleyin." data-tooltip-pos="bottom">
            Bu kartta geçmiş siparişler mevcut!<span>Lütfen kontrol ediniz.</span>
          </div>
        `;
            gecmisTarihliKartSayisi++;
        } else {
            uyariEl.style.display = 'none';
            uyariEl.innerHTML = ''; // Temizle
        }
    });
    
}

//#endregion

// #region Index - Kartlar Grid Container içerisinde Klavye ile doğrudan Searchbox ile arama 
let isSearching = false;

function setupSearchBox() {
    const searchBox = document.getElementById('search-box');
    const searchBoxMobile = document.getElementById('search-box-mobile');
    const allItems = Array.from(document.querySelectorAll('.item'));
    const emptyMessage = document.querySelector('.empty-message');
    const emptySearchMessage = document.querySelector('.empty-search-message');
    
    // Empty search message yoksa oluştur
    let emptySearchElement = emptySearchMessage;
    if (!emptySearchElement) {
        emptySearchElement = document.createElement('div');
        emptySearchElement.className = 'empty-search-message';
        emptySearchElement.style.display = 'none';
        emptySearchElement.innerHTML = `
            <i class="icon-kart-yok"></i>
            <div class="message">Seçtiğiniz tarih(ler)e ait sipariş bulunamadı!<span>Lütfen farklı bir tarih seçerek tekrar deneyin.</span></div>
        `;
        // itemsContainer'ın öncesine ekle
        const itemsContainer = document.getElementById('itemsContainer');
        if (itemsContainer && itemsContainer.parentElement) {
            itemsContainer.parentElement.insertBefore(emptySearchElement, itemsContainer);
        }
    }

    function getVisibleItems() {
        return allItems; // 🔧 Tüm item’lar filtrelenir, display durumuna bakılmaz
    }

    function filterBySearchBox(value) {
        const searchText = value.toLocaleLowerCase('tr-TR').trim();
        let visibleCount = 0;

        isSearching = searchText !== "";
        window.isSearching = isSearching; // Global erişim için

        if (!isSearching) {
            // Arama temizlendiğinde seçili haftanın kartlarını göster
            if (typeof recheckWeekMatch === 'function') {
                recheckWeekMatch();
            } else {
                // Fallback: Tüm item'ları göster
                const visibleItems = getVisibleItems();
                visibleItems.forEach(item => {
                    item.style.setProperty('display', 'flex', 'important');
                    item.classList.remove("item-hidden");
                });
            }
            if (emptyMessage) emptyMessage.style.display = "none";
            if (emptySearchElement) emptySearchElement.style.display = "none";
            return;
        }

        const visibleItems = getVisibleItems();

        visibleItems.forEach(item => {
            const content = item.innerText.toLocaleLowerCase('tr-TR');
            const matches = content.includes(searchText);

            if (matches) {
                item.style.setProperty('display', 'flex', 'important');
                item.classList.remove("item-hidden");
                visibleCount++;
            } else {
                item.style.setProperty('display', 'none', 'important');
                item.classList.add("item-hidden");
            }
        });

        // Arama sonucu kontrolü
        if (emptySearchElement) {
            // Arama yapıyorsa ve sonuç yoksa empty-search-message göster
            if (visibleCount === 0 && isSearching) {
                emptySearchElement.style.display = "flex";
                if (emptyMessage) emptyMessage.style.display = "none";
            } else {
                emptySearchElement.style.display = "none";
                // Normal empty-message kontrolü (sadece arama yoksa)
                if (emptyMessage && !isSearching) {
                    emptyMessage.style.display = visibleCount === 0 ? "flex" : "none";
                } else if (emptyMessage) {
                    emptyMessage.style.display = "none";
                }
            }
        } else if (emptyMessage) {
            // Fallback: empty-search-message yoksa eski davranış
            emptyMessage.style.display = visibleCount === 0 ? "flex" : "none";
        }
    }

    // Arama kutusunu temizleme fonksiyonu
    function clearSearch(inputElement) {
        if (inputElement) {
            inputElement.value = '';
            filterBySearchBox('');
        }
    }

    if (searchBox) {
        searchBox.addEventListener("input", () => filterBySearchBox(searchBox.value));
        
        // ESC tuşu ile arama sıfırlama
        searchBox.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                clearSearch(searchBox);
                // Focus searchbox içinde kalsın
            }
        });
        
        // Clear butonu (çarpı ikonu) ile arama sıfırlama
        searchBox.addEventListener("search", () => {
            // HTML5 search input'unun clear butonu için
            if (searchBox.value === '') {
                clearSearch(searchBox);
            }
        });
    }

    if (searchBoxMobile) {
        searchBoxMobile.addEventListener("input", () => filterBySearchBox(searchBoxMobile.value));
        
        // ESC tuşu ile arama sıfırlama (mobile)
        searchBoxMobile.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                clearSearch(searchBoxMobile);
                // Focus searchbox içinde kalsın
            }
        });
        
        // Clear butonu ile arama sıfırlama (mobile)
        searchBoxMobile.addEventListener("search", () => {
            if (searchBoxMobile.value === '') {
                clearSearch(searchBoxMobile);
            }
        });
    }

    function isAnyOverlayOpen() {
        const overlays = document.querySelectorAll("[class^='overlay-']");
        return Array.from(overlays).some(el => {
            return window.getComputedStyle(el).display !== "none";
        });
    }

}
// setupSearchBox sonu

// Header filtre sistemini kuran fonksiyon
function setupHeaderFilterSystem() {
    // Tüm siparişler butonu
    const tumSiparisler = document.querySelector(".tum-siparisleri-goster");
    
    // Tüm filtreleri al
    const filtreler = document.querySelectorAll(".kart-filtreler .kartin-tur-adi");
    
    // Başlangıçta TÜM SİPARİŞLER aktif, diğerleri varsayılan olarak aktif
    if (tumSiparisler) {
        tumSiparisler.classList.add("filtre-secili");
        tumSiparisler.classList.add("filtre-aktif");
    }
    
    // Diğer filtreleri başlangıçta aktif bırak (sayaçlar yüklenince güncellenecek)
    filtreler.forEach(function (f) {
        f.classList.add("filtre-aktif");
        f.classList.remove("filtre-pasif");
    });
    
    if (tumSiparisler) {
        tumSiparisler.addEventListener("click", function () {
            // Tüm filtrelerin seçili stilini kaldır
            filtreler.forEach(function (f) {
                f.classList.remove("filtre-secili");
            });
            
            // Bu butonun seçili ve aktif stilini ekle
            this.classList.add("filtre-secili");
            this.classList.add("filtre-aktif");
            
            // Tüm kartları göster
            showAllItems();
            
        });
    }
    
    // Kart türü filtreleri
    filtreler.forEach(function (filtre) {
        filtre.addEventListener("click", function () {
            const filtrelenecekTur = this.textContent.trim().toLocaleUpperCase('tr-TR'); // Türkçe locale
            
            // Tüm filtrelerin seçili stilini kaldır
            filtreler.forEach(function (f) {
                f.classList.remove("filtre-secili");
            });
            
            // Tüm siparişler butonunun seçili stilini de kaldır
            const tumSiparisler = document.querySelector(".tum-siparisleri-goster");
            if (tumSiparisler) {
                tumSiparisler.classList.remove("filtre-secili");
                tumSiparisler.classList.remove("filtre-aktif"); // Aktif class'ını da kaldır
            }
            
            // Seçilen filtrenin seçili stilini ekle
            this.classList.add("filtre-secili");
            
            // Kartları türe göre filtrele
            filterItemsByType(filtrelenecekTur);
        });
    });
    
    // Sayaçları güncelleme - loadDynamicCards() içinde yapılıyor, burada gereksiz!
}

// Header filtre sayaçlarını güncelleyen fonksiyon
function updateHeaderFilterCounts() {
    // React dashboard kullanılıyorsa sayıları React yönetir, legacy dokunmasın
    if (document.querySelector('#root')?.querySelector('.grid-container') || document.querySelector('#root')?.querySelector('.dashboard-container')) {
        return;
    }
    const filtreler = document.querySelectorAll("#kartFiltreMenu .kartin-tur-adi");
    const kartlar = document.querySelectorAll(".items .item");
    
    // Aktif hafta günlerini al
    const aktifHafta = document.querySelector("#weekPicker")?.value;
    if (!aktifHafta) return;
    const weekDays = getWeekDays(aktifHafta);
    
    filtreler.forEach(filtre => {
        const filtreTur = filtre.textContent.trim().toLocaleUpperCase('tr-TR'); // Türkçe locale
        let count = 0;

        kartlar.forEach(kart => {
            // Sadece hafta içindeki kartları say
            const teslimTarihi = kart.querySelector(".teslim-zaman .tarih")?.textContent.trim();
            if (!weekDays.includes(teslimTarihi)) return;
            
            const kartTur = getKartTur(kart);
            const anaKart = kart.querySelector('.ana-kart');
            
            if (kartTur === filtreTur) {
                count++;
            }
        });
        
        // data-kart-adeti attribute'unu li elementine yaz
        filtre.setAttribute("data-kart-adeti", count);
        
        // Pasif/Aktif durumunu ayarla
        if (count === 0) {
            filtre.classList.add("filtre-pasif");
            filtre.classList.remove("filtre-aktif");
        } else {
            filtre.classList.remove("filtre-pasif");
            filtre.classList.add("filtre-aktif");
        }
    });
}

// Sayaçları sıfırla (sayfa açılışında)
function resetHeaderFilterCounts() {
    if (document.querySelector('#root')?.querySelector('.grid-container') || document.querySelector('#root')?.querySelector('.dashboard-container')) {
        return;
    }
    const filtreler = document.querySelectorAll("#kartFiltreMenu .kartin-tur-adi");
    filtreler.forEach(filtre => {
        filtre.setAttribute("data-kart-adeti", "0");
    });
}

// Global erişim için
window.resetHeaderFilterCounts = resetHeaderFilterCounts;
window.updateHeaderFilterCounts = updateHeaderFilterCounts;

// #endregion

// #region Index.html Web ve Mobil Responsive Week Input year-month-label

function updateYearMonthLabel(weekInputId, labelId) {
    const weekInput = document.getElementById(weekInputId);
    const label = document.getElementById(labelId);

    if (!weekInput || !label) return;

    let date = weekInput.valueAsDate;

    // Eğer geçerli bir tarih yoksa (örn. input boşsa), bugünün tarihini kullan
    if (!date || isNaN(date.getTime())) {
        date = new Date();
    }

    // ISO standardına göre haftanın ilk günü Pazartesi kabul edilir
    const monday = new Date(date);
    const day = monday.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Pazartesi'ye göre fark

    monday.setDate(monday.getDate() + diff);

    const year = monday.getFullYear();
    const month = monday.toLocaleString('tr-TR', { month: 'long' });

    label.textContent = `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
}

// İlk yüklemede ve değiştiğinde hem web hem mobil için çalıştır
document.addEventListener('DOMContentLoaded', () => {
    // ✅ KRİTİK: React SPA kontrolü - React SPA'da bu listener'ları ekleme!
    const isReactSPA = document.querySelector('.dashboard-container') !== null ||
                       document.querySelector('.bg-alan') !== null ||
                       window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined ||
                       typeof window.__REACT_WEEK_CHANGE_CALLBACK__ === 'function';
    
    // React SPA'da sadece label'ları güncelle, listener ekleme
    updateYearMonthLabel('weekPicker', 'yearMonthLabel');
    updateYearMonthLabel('weekPicker2', 'yearMonthLabel2');
    
    if (isReactSPA) {
        return; // Early return - React SPA'da listener ekleme!
    }

    const webPicker = document.getElementById('weekPicker');
    if (webPicker) {
        webPicker.addEventListener('change', () =>
            updateYearMonthLabel('weekPicker', 'yearMonthLabel')
        );
    }

    const mobilePicker = document.getElementById('weekPicker2');
    if (mobilePicker) {
        mobilePicker.addEventListener('change', () =>
            updateYearMonthLabel('weekPicker2', 'yearMonthLabel2')
        );
    }
});
// #endregion Index.html Web ve Mobil Responsive Week Input year-month-label

// #region Index - Sağ Panel --- Bu haftaki toplam siparişler --- Toplam Sayılar

/**
 * TEK ve MERKEZI updateItemCount fonksiyonu 
 * Toplam organizasyon ve sipariş sayısını günceller
 */
function updateItemCount() {
    // Sayfa yeni yüklendiğinde localStorage'daki arşiv verilerini temizle
    if (window.localStorage.getItem('pageJustLoaded') !== 'false') {
        localStorage.removeItem("arsivSiparisler");
        window.localStorage.setItem('pageJustLoaded', 'false');
    }

    const weekDays = getSelectedWeekDays();

    let toplamOrganizasyon = 0;
    let toplamSiparis = 0;

    const items = document.querySelectorAll('.items .item');
    
    // KRİTİK: Eğer hiç kart yoksa, sayaçları 0 yap ve çık
    if (!items || items.length === 0) {
        const toplamOrganizasyonDiv = document.querySelector('.toplam-organizasyon-sayisi');
        const toplamSiparisKartDiv = document.querySelector('.toplam-siparis-sayisi');
        if (toplamOrganizasyonDiv) toplamOrganizasyonDiv.textContent = '0';
        if (toplamSiparisKartDiv) toplamSiparisKartDiv.textContent = '0';
        return;
    }

    items.forEach(item => {
        const anaKart = item.querySelector('.ana-kart');
        if (!anaKart) return;

        const teslimTarihiEl = item.querySelector('.teslim-zaman .tarih');
        if (!teslimTarihiEl) return;

        const teslimTarihi = teslimTarihiEl.textContent.trim();

        // KRİTİK: Kartın görünür olduğundan emin ol
        const itemStyle = window.getComputedStyle(item);
        const isVisible = itemStyle.display !== 'none' && itemStyle.visibility !== 'hidden';
        
        if (isVisible && (!weekDays.length || weekDays.includes(teslimTarihi))) {
            // Organizasyon sayısı (her item bir kez)
            toplamOrganizasyon++;

            // Sipariş sayısı — sadece benzersiz sipariş kartları
            const siparisler = anaKart.querySelectorAll('.siparis-kart:not(.archived)');
            toplamSiparis += siparisler.length;
        }
    });

    // Panel güncelle
    const toplamOrganizasyonDiv = document.querySelector('.toplam-organizasyon-sayisi');
    const toplamSiparisKartDiv = document.querySelector('.toplam-siparis-sayisi');

    if (toplamOrganizasyonDiv) toplamOrganizasyonDiv.textContent = toplamOrganizasyon;
    if (toplamSiparisKartDiv) toplamSiparisKartDiv.textContent = toplamSiparis;

    toggleEmptyMessageIfNeeded();
    updateKartFiltreSayaclari();
}
window.updateItemCount = updateItemCount;

/**
 * kart-filtreler alanındaki sayıları güncelle
 */
function updateKartFiltreSayaclari() {
    const filtreler = document.querySelectorAll(".kart-filtreler li");

    const aktifHafta = document.querySelector("#weekPicker")?.value;
    if (!aktifHafta) return;
    const weekDays = getWeekDays(aktifHafta);

    filtreler.forEach(filtre => {
        const turEl = filtre.querySelector(".kartin-tur-adi");
        const sayiEl = filtre.querySelector(".kart-sayisi");
        if (!turEl || !sayiEl) return;

        const filtreTur = turEl.textContent.trim().toUpperCase();
        let sayi = 0;

        document.querySelectorAll(".items .item").forEach(item => {
            // item gizlenmişse sayma
            if (window.getComputedStyle(item).display === "none") return;

            const kartTur = typeof window.getKartTur === 'function' ? window.getKartTur(item) : '';
            const tarihText = item.querySelector(".teslim-zaman .tarih")?.textContent.trim();

            if (kartTur === filtreTur && weekDays.includes(tarihText)) {
                sayi++;
            }
        });

        sayiEl.textContent = sayi;
        filtre.classList.toggle("filtre-pasif", sayi === 0);
    });
}
window.updateKartFiltreSayaclari = updateKartFiltreSayaclari;
// #endregion

/**
 * Tüm Kartlar Arşivlendiyse empty-message Alanını Göster
 */
function toggleEmptyMessageIfNeeded() {
    const emptyMessage = document.querySelector('.empty-message');
    const emptySearchMessage = document.querySelector('.empty-search-message');
    const backendConnectionMsg = document.querySelector('.backend-connection-message');
    const items = document.querySelectorAll('.item');

    // empty-search-message yoksa oluştur
    let emptySearchElement = emptySearchMessage;
    if (!emptySearchElement) {
        emptySearchElement = document.createElement('div');
        emptySearchElement.className = 'empty-search-message';
        emptySearchElement.style.display = 'none';
        emptySearchElement.innerHTML = `
            <i class="icon-kart-yok"></i>
            <div class="message">Seçtiğiniz tarih(ler)e ait sipariş bulunamadı!<span>Lütfen farklı bir tarih seçerek tekrar deneyin.</span></div>
        `;
        const itemsContainer = document.getElementById('itemsContainer');
        if (itemsContainer && itemsContainer.parentElement) {
            itemsContainer.parentElement.insertBefore(emptySearchElement, itemsContainer);
                }
    }

    // Backend bağlantı mesajı görünürse, empty mesajlarını gizle
    if (backendConnectionMsg) {
        const backendMsgStyle = window.getComputedStyle(backendConnectionMsg);
        if (backendMsgStyle.display === 'flex' || backendMsgStyle.display === 'block') {
            if (emptyMessage) {
                emptyMessage.style.display = 'none';
                emptyMessage.style.visibility = 'hidden';
            }
            if (emptySearchElement) {
                emptySearchElement.style.display = 'none';
                emptySearchElement.style.visibility = 'hidden';
            }
        return;
    }
    }

    // Items yoksa empty mesajı göster
    if (!items.length) {
        if (emptySearchElement) {
            emptySearchElement.style.display = 'flex';
            emptySearchElement.style.visibility = 'visible';
            emptySearchElement.classList.remove('hidden');
        }
        if (emptyMessage) {
            emptyMessage.style.display = 'none';
            emptyMessage.classList.add('hidden');
        }
        return;
    }

    // Sadece görünür kartlara bak
    const anyVisible = Array.from(items).some(item => {
        const style = window.getComputedStyle(item);
        return style.display !== 'none' && style.visibility !== 'hidden' && item.offsetParent !== null;
    });

    if (anyVisible) {
        // Görünür kart varsa tüm empty mesajlarını gizle
        if (emptyMessage) {
            emptyMessage.style.display = 'none';
            emptyMessage.classList.add('hidden');
        }
        if (emptySearchElement) {
            emptySearchElement.style.display = 'none';
            emptySearchElement.classList.add('hidden');
        }
    } else {
        // ✅ KRİTİK: Görünür kart yoksa empty-message göster (empty-search-message değil)
        if (emptyMessage) {
            emptyMessage.style.display = 'flex';
            emptyMessage.style.visibility = 'visible';
            emptyMessage.classList.remove('hidden');
        }
        // empty-search-message'ı gizle (empty-message kullanıyoruz)
        if (emptySearchElement) {
            emptySearchElement.style.display = 'none';
            emptySearchElement.classList.add('hidden');
        }
    }
}
window.toggleEmptyMessageIfNeeded = toggleEmptyMessageIfNeeded;


// Takvim sistemini başlat
window.initializeCalendarSystem = function() {
    
    // DOM hazır olduğunda çalıştır
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            updateWeek();
            updateSelectedWeek();
            // filterItems(); // ❌ OTOMATİK FİLTRELEME DEVRE DIŞI - Kartlar yüklendiğinde otomatik gizlenmesin
        });
    } else {
        updateWeek();
        updateSelectedWeek();
        // filterItems(); // ❌ OTOMATİK FİLTRELEME DEVRE DIŞI - Kartlar yüklendiğinde otomatik gizlenmesin
    }
    
};

// Nav butonları oluştur (DEVRE DIŞI - Nav butonları DOMContentLoaded içinde oluşturuluyor, yedeğe göre)
window.createNavButtons = function() {
    return; // Fonksiyonu devre dışı bırak - Nav butonları DOMContentLoaded içinde oluşturuluyor
};

// Sayfa yüklendiğinde takvim sistemini başlat
// ⚠️ NOT: HeadComponent'in waitForMomentAndStartTakvim fonksiyonu zaten bu fonksiyonları çağırıyor
// Çift çağrımı önlemek için burayı devre dışı bırakıyoruz
// if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', function() {
//         window.initializeCalendarSystem();
//         window.createNavButtons();
//     });
// } else {
//     window.initializeCalendarSystem();
//     window.createNavButtons();
// }

// #endregion

// ========== BU HAFTAYA GİT BUTONU ==========
function buHaftayaGit() {
    if (typeof moment === 'undefined') {
        alert('Takvim sistemi henüz hazır değil!');
        return;
    }
    
    const weekInput = document.getElementById('weekPicker');
    if (!weekInput) return;
    
    // Bu haftanın değerini hesapla
    const buHafta = moment().isoWeekYear() + '-W' + String(moment().isoWeek()).padStart(2, '0');
    
    // ✅ KRİTİK: Programatik değişiklik olduğunu işaretle (change event'ini ignore etmek için)
    weekInput.setAttribute('data-programmatic-change', 'true');
    
    // Week input'ları güncelle
    weekInput.value = buHafta;
    const weekPicker2 = document.getElementById('weekPicker2');
    if (weekPicker2) {
        weekPicker2.setAttribute('data-programmatic-change', 'true');
        weekPicker2.value = buHafta;
    }
    
    // ✅ KRİTİK: React SPA kontrolü - React SPA'da sadece React state güncelle!
    const isReactSPA = document.querySelector('.dashboard-container') !== null ||
                       document.querySelector('.bg-alan') !== null ||
                       window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined ||
                       typeof window.__REACT_WEEK_CHANGE_CALLBACK__ === 'function';
    
    // ✅ KRİTİK: React state'ini güncelle (navigateWeek gibi)
    if (typeof window.__REACT_WEEK_CHANGE_CALLBACK__ === 'function') {
        window.__REACT_WEEK_CHANGE_CALLBACK__(buHafta);
    }
    
    if (isReactSPA) {
        // React SPA'da sadece React state güncellendi, başka bir şey yapma!
        return; // Early return - React SPA'da başka bir şey yapma!
    }
    
    // Tarihi ve kartları güncelle (sadece Vanilla JS için)
    if (typeof updateSelectedWeek === 'function') updateSelectedWeek();
    if (typeof recheckWeekMatch === 'function') recheckWeekMatch();
    if (typeof updateItemCount === 'function') updateItemCount();
}
window.buHaftayaGit = buHaftayaGit;

// Butona listener ekle
(function() {
    function setupBuHaftaButton() {
        var buttons = document.querySelectorAll('.buHaftaButton');
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].onclick = function(e) {
                e.preventDefault();
                buHaftayaGit();
            };
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupBuHaftaButton);
    } else {
        setupBuHaftaButton();
    }
})();