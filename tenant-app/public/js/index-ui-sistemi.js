// ========================================
// Index UI Sistemi
// TASINDI: script.js -> js/features/index-ui-sistemi.js (2026-02-08)
// setupKartHamburgerMenu, safeSetupKartHamburgerMenu,
// setupSiparisKartFiltreMenu, safeSetupSiparisKartFiltreMenu,
// openCity, setupTabNavigation
// ========================================

// #region Ana Kart Hamburger Menü
function setupKartHamburgerMenu() {
    // console.log('setupKartHamburgerMenu fonksiyonu çağrıldı');
    // jQuery kontrolü
    if (typeof $ === 'undefined') {
        return;
    }

    // Element kontrolü
    if ($('.kart-menu-buton').length === 0) {
        // console.log('Kart hamburger menü elementleri bu sayfada mevcut değil - atlanıyor');
        return;
    }

    // console.log('Kart hamburger menü sistemi başlatılıyor...');

    // Menü butonuna tıklanınca kendi menüsünü açar, diğerlerini kapatır
    // Bu event listener dinamik kartlar oluşturulduktan sonra kurulacak

    // Sayfa dışına tıklanınca tüm menüler kapanır
    $(document).on('click', function (event) {
        if (!$(event.target).closest('.kart-menu').length) {
            $('.kart-menu-content').slideUp(0);
        }
    });

    // Sipariş künyesi yazdır butonu için event listener
    // console.log('Sipariş künyesi yazdır event listener kuruldu');
    
    // Tüm click event'lerini dinle
    $('body').on('click', function(e) {
        // console.log('Body click event:', e.target, e.target.className);
        
        // Sipariş künyesi yazdır butonuna tıklanıp tıklanmadığını kontrol et
        // Sipariş künyesi yazdır butonu - setupKartMenuContentButtons içinde zaten var
        // Burada tekrar işlemeye gerek yok, çift çalışmasını önlemek için kaldırıldı
        // if ($(e.target).closest('.kart-siparis-kunyesi-yazdir').length > 0) {
        //     e.preventDefault();
        //     e.stopPropagation();
        //     
        //     const anaKart = $(e.target).closest('.ana-kart')[0];
        //     if (anaKart && typeof yazdirSiparisKunyeToplu === 'function') {
        //         yazdirSiparisKunyeToplu(anaKart);
        //     } else {
        //         console.error('yazdirSiparisKunyeToplu fonksiyonu bulunamadı veya ana kart bulunamadı');
        //     }
        // }
    });

    // Menü içindeki linke tıklanınca sadece kendi menüsünü kapat
    $('.kart-menu-content').on('click', 'a', function (e) {
        e.stopPropagation();
        const $menu = $(this).closest('.kart-menu-content');
        $menu.slideUp(0);
    });

    // console.log('Kart hamburger menü sistemi başarıyla başlatıldı');
}

// Güvenli başlatma
function safeSetupKartHamburgerMenu() {
    try {
        setupKartHamburgerMenu();
    } catch (error) {
        console.error('Kart hamburger menü başlatma hatası:', error);
    }
}
// #endregion Ana Kart Hamburger Menü




// #region Ana Kart Sipariş Kartlarını Sırala Menü Göster - Alfabetik ve Sipariş Türüne Göre

function setupSiparisKartFiltreMenu() {
    // ★★★ KRİTİK: Mevcut listener'ları kaldır (varsa)
    if (window.__siparisKartFiltreMenuHandler) {
        document.removeEventListener('click', window.__siparisKartFiltreMenuHandler, true);
    }
    if (window.__siparisKartFiltreMenuDisHandler) {
        document.removeEventListener('click', window.__siparisKartFiltreMenuDisHandler);
    }

    // Menü aç/kapat - Event delegation
    window.__siparisKartFiltreMenuHandler = function(e) {
        const filtrelButon = e.target.closest('.siparis-kart-filtrele-buton');
        if (!filtrelButon) {
            // Menü butonuna tıklanmış mı?
            const menuButton = e.target.closest('.filtre-menu-content button');
            if (menuButton) {
                e.preventDefault();
                e.stopPropagation();
                
                // Tüm menüleri kapat
                document.querySelectorAll('.filtre-menu-content').forEach(menu => {
                    menu.style.display = 'none';
                });
                
                // Sıralama işlemi
                const buttonId = menuButton.getAttribute('id');
                if (buttonId) {
                    const tur = buttonId.replace('sirala-kart-', '');
                    const item = menuButton.closest('.item');
                    
                    if (item) {
                        const handlerMap = {
                            "alfabetik": siralaAlfabetik,
                            "alfabetik-org": siralaAlfabetikOrg,
                            "tur": siralaSiparisTuru,
                            "tur-org": siralaSiparisTuruOrg,
                            "saat": siralaTeslimSaatineGore,
                            "saat-org": siralaTeslimSaatineGoreOrg
                        };
                        
                        if (handlerMap[tur]) {
                            // jQuery wrapper (eğer varsa) veya vanilla JS
                            if (typeof $ !== 'undefined') {
                                handlerMap[tur]($(item));
                            } else {
                                handlerMap[tur](item);
                            }
                        }
                    }
                }
            }
            return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        
        const siralaMenu = filtrelButon.closest('.sirala-menu');
        if (!siralaMenu) return;
        
        const menuContent = siralaMenu.querySelector('.filtre-menu-content');
        if (!menuContent) return;
        
        // Diğer menüleri kapat
        document.querySelectorAll('.filtre-menu-content').forEach(menu => {
            if (menu !== menuContent) {
                menu.style.display = 'none';
            }
        });
        
        // Kart menüsünü kapat
        const kartMenuContent = document.querySelector('.kart-menu-content');
        if (kartMenuContent) {
            kartMenuContent.style.display = 'none';
        }
        
        // Menüyü aç/kapat
        if (menuContent.style.display === 'none' || !menuContent.style.display) {
            menuContent.style.display = 'block';
        } else {
            menuContent.style.display = 'none';
        }
    };
    
    document.addEventListener('click', window.__siparisKartFiltreMenuHandler, true);

    // Dışarı tıklayınca menüyü kapat
    window.__siparisKartFiltreMenuDisHandler = function(e) {
        // Eğer tıklanan element menü içinde değilse, menüyü kapat
        if (!e.target.closest('.sirala-menu') && !e.target.closest('.filtre-menu-content')) {
            document.querySelectorAll('.filtre-menu-content').forEach(menu => {
                menu.style.display = 'none';
            });
        }
    };
    
    document.addEventListener('click', window.__siparisKartFiltreMenuDisHandler);

    // ===== Yardımcı Fonksiyonlar =====
    function yenidenSirala(item, kriter) {
        // jQuery veya vanilla JS desteği
        const isJQuery = typeof $ !== 'undefined' && item instanceof $;
        const itemEl = isJQuery ? item[0] : item;
        
        if (!itemEl) {
            console.warn('[HATA] Item elementi bulunamadı!');
            return;
        }
        
        const kartAlan = itemEl.querySelector('.sk-kart-alan');
        if (!kartAlan) {
            console.warn('[HATA] .sk-kart-alan bulunamadı!', itemEl);
            return;
        }

        const konumGruplar = Array.from(kartAlan.querySelectorAll('.konum-grup'));
        if (konumGruplar.length > 0) {
            konumGruplar.forEach(group => {
                const siparisler = Array.from(group.querySelectorAll('.siparis-kart'));
                
                const siraliKartlar = siparisler.sort((a, b) => {
                    const $a = typeof $ !== 'undefined' ? $(a) : null;
                    const $b = typeof $ !== 'undefined' ? $(b) : null;
                    return compareByKriter($a || a, $b || b, kriter);
                });
                
                siparisler.forEach(kart => kart.remove());
                siraliKartlar.forEach(kart => group.appendChild(kart));
            });

            if (kriter === 'alfabetik' || kriter === 'tur') {
                const siraliGruplar = konumGruplar.sort((a, b) => {
                    const aText = a.querySelector('.grup-mahalle')?.textContent.trim().toLowerCase() || '';
                    const bText = b.querySelector('.grup-mahalle')?.textContent.trim().toLowerCase() || '';
                    return aText.localeCompare(bText);
                });
                kartAlan.innerHTML = '';
                siraliGruplar.forEach(group => kartAlan.appendChild(group));
            }
        } else {
            const siparisler = Array.from(kartAlan.querySelectorAll('.siparis-kart'));
            const siraliKartlar = siparisler.sort((a, b) => {
                const $a = typeof $ !== 'undefined' ? $(a) : null;
                const $b = typeof $ !== 'undefined' ? $(b) : null;
                return compareByKriter($a || a, $b || b, kriter);
            });
            kartAlan.innerHTML = '';
            siraliKartlar.forEach(kart => kartAlan.appendChild(kart));
        }
    }

    function compareByKriter(a, b, kriter) {
        // jQuery veya vanilla JS desteği
        const isJQueryA = typeof $ !== 'undefined' && a instanceof $;
        const isJQueryB = typeof $ !== 'undefined' && b instanceof $;
        const aEl = isJQueryA ? a[0] : a;
        const bEl = isJQueryB ? b[0] : b;
        
        if (kriter === 'saat') {
            const saatA = getSaat(aEl, isJQueryA ? a : null);
            const saatB = getSaat(bEl, isJQueryB ? b : null);
            return saatA - saatB;
        }
        if (kriter === 'alfabetik') {
            const aText = getAlphabetikText(aEl, isJQueryA ? a : null);
            const bText = getAlphabetikText(bEl, isJQueryB ? b : null);
            return aText.localeCompare(bText);
        }
        if (kriter === 'tur') {
            const aUrun = isJQueryA ? a.find('.siparis-urun').text().trim() : (aEl.querySelector('.siparis-urun')?.textContent.trim() || '');
            const bUrun = isJQueryB ? b.find('.siparis-urun').text().trim() : (bEl.querySelector('.siparis-urun')?.textContent.trim() || '');
            return aUrun.toLowerCase().localeCompare(bUrun.toLowerCase());
        }
        return 0;
    }

    function getAlphabetikText(kartEl, $kart) {
        // Çiçek Sepeti kartları için özel kontrol
        const ciceksepetiKart = kartEl.closest('.ciceksepeti-kart');
        if (ciceksepetiKart) {
            const siparisVeren = $kart ? $kart.find('.siparis-veren').text().trim() : (kartEl.querySelector('.siparis-veren')?.textContent.trim() || '');
            if (siparisVeren) {
                return siparisVeren.toLowerCase();
            }
        }
        
        const konumGrup = kartEl.closest('.konum-grup');
        if (konumGrup) {
            const teslimKisi = $kart ? $kart.find('.teslim-kisisi').text().trim() : (kartEl.querySelector('.teslim-kisisi')?.textContent.trim() || '');
            if (teslimKisi) {
                return teslimKisi.toLowerCase();
            }
        }
        const siparisVeren = $kart ? $kart.find('.siparis-veren').text().trim() : (kartEl.querySelector('.siparis-veren')?.textContent.trim() || '');
        return siparisVeren.toLowerCase();
    }

    function getSaat(el, $el) {
        const saatText = $el ? $el.find('.saat-veri').text().trim() : (el.querySelector('.saat-veri')?.textContent.trim() || '');
        const [saat, dakika] = saatText.split(':').map(Number);
        return (isNaN(saat) ? 99 : saat) * 60 + (isNaN(dakika) ? 99 : dakika);
    }

    function siralaTeslimSaatineGore(item) {
        yenidenSirala(item, 'saat');
    }
    function siralaAlfabetik(item) {
        yenidenSirala(item, 'alfabetik');
    }
    function siralaSiparisTuru(item) {
        yenidenSirala(item, 'tur');
    }
    function siralaAlfabetikOrg(item) {
        yenidenSirala(item, 'alfabetik');
    }
    function siralaSiparisTuruOrg(item) {
        yenidenSirala(item, 'tur');
    }
    function siralaTeslimSaatineGoreOrg(item) {
        yenidenSirala(item, 'saat');
    }

}


// Güvenli başlatma
function safeSetupSiparisKartFiltreMenu() {
    try {
        setupSiparisKartFiltreMenu();
    } catch (error) {
        console.error('Sipariş kart filtre menü başlatma hatası:', error);
    }
}

// #endregion


// #region Yeni Kart Oluştur --- TABS
// ✅ KRİTİK: openCity fonksiyonunu hemen tanımla (HTML onclick için gerekli)
// HTML'de onclick="openCity(event, 'organizasyon-kart')" kullanılıyor, bu yüzden fonksiyon erken tanımlanmalı
if (!window.openCity) {
    window.openCity = function (evt, cityName) {
        // Tüm tab içeriğini gizle
        document.querySelectorAll(".tabcontent").forEach(tab => {
            tab.style.display = "none";
        });

        // Aktif sekme butonlarından "active" sınıfını kaldır
        document.querySelectorAll(".tablinks").forEach(btn => {
            btn.classList.remove("active");
        });

        // Seçilen içeriği göster
        const activeTab = document.getElementById(cityName);
        if (activeTab) activeTab.style.display = "block";

        // Tıklanan sekme butonunu aktif yap
        if (evt?.currentTarget) evt.currentTarget.classList.add("active");
        // Eğer evt bir event değilse, onclick'ten gelen event'i kullan
        else if (evt && evt.target) {
            evt.target.classList.add("active");
        }
        
        // ✅ İl, ilçe ve mahalle dropdown'larını hemen yükle (sekme değiştiğinde)
        if (activeTab) {
            // İl dropdown'larını yükle
            const ilWrappers = activeTab.querySelectorAll('.wrapper-acilirliste[data-type="il"]');
            ilWrappers.forEach(ilWrapper => {
                if (ilWrapper && typeof window.loadProvinceList === 'function') {
                    window.loadProvinceList(ilWrapper);
                }
            });
            
            // İlçe dropdown'larını yükle (eğer il seçiliyse)
            const ilceWrappers = activeTab.querySelectorAll('.wrapper-acilirliste[data-type="ilce"]');
            ilceWrappers.forEach(ilceWrapper => {
                const parentContainer = ilceWrapper.closest('form, .input-alan-container, .input-alan');
                const ilWrapper = parentContainer?.querySelector('.wrapper-acilirliste[data-type="il"]');
                if (ilWrapper && typeof window.loadDistrictList === 'function') {
                    const ilInput = ilWrapper.querySelector('input[type="hidden"]');
                    const ilId = ilInput?.getAttribute('data-id') || ilInput?.dataset.id || ilInput?.value;
                    if (ilId) {
                        window.loadDistrictList(ilceWrapper, ilId);
                    }
                }
            });
            
            // Mahalle dropdown'larını yükle (eğer ilçe seçiliyse)
            const mahalleWrappers = activeTab.querySelectorAll('.wrapper-acilirliste[data-type="mahallesemt"]');
            mahalleWrappers.forEach(mahalleWrapper => {
                const parentContainer = mahalleWrapper.closest('form, .input-alan-container, .input-alan');
                const ilceWrapper = parentContainer?.querySelector('.wrapper-acilirliste[data-type="ilce"]');
                if (ilceWrapper && typeof window.loadNeighborhoodList === 'function') {
                    const ilceInput = ilceWrapper.querySelector('input[type="hidden"]');
                    const ilceId = ilceInput?.getAttribute('data-id') || ilceInput?.dataset.id || ilceInput?.value;
                    if (ilceId) {
                        window.loadNeighborhoodList(mahalleWrapper, ilceId);
                    }
                }
            });
        }
        
        // ✅ ÖNEMLİ: Düzenleme modundaysa tab'ları gizleme mantığını koru
        // editOrganizationCard veya editOrganizationCardWithData içinde yapılan tab gizleme işlemini koru
        if (window.isEditMode) {
            const formContainer = document.querySelector('.yeni-kart-container');
            if (formContainer) {
                const allTabButtons = formContainer.querySelectorAll('.tab .tablinks');
                const activeBtn = evt?.currentTarget || (evt && evt.target) || document.querySelector(`.tab button[onclick*='${cityName}']`);
                if (activeBtn) {
                    allTabButtons.forEach(btn => {
                        if (btn !== activeBtn && btn.style.display === 'none') {
                            // Zaten gizli olan tab'ları gizli tut
                            btn.style.display = 'none';
                        } else if (btn === activeBtn) {
                            // Aktif tab'ı göster
                            btn.style.display = '';
                        }
                    });
                }
            }
        }
        
        // ✅ Yeni Kart Oluştur formundaki sekmeler için tür/etiket yükle
        // ÖNEMLİ: Düzenleme modunda etiket yükleme YAPMA - form doldurma zaten yapacak
        if (!window.isEditMode && cityName && (cityName.includes('organizasyon-kart') || cityName.includes('ozelgun-kart') || cityName.includes('ozelsiparis-kart') || cityName.includes('aracsusleme-kart'))) {
            // Sekme değiştiğinde etiketleri yükle (SADECE yeni kart oluşturma modunda)
            // cityName'den direkt grup_id belirle - tam eşleşme kontrolü
            let grupId = null;
            if (cityName === 'organizasyon-kart' || cityName.includes('organizasyon-kart')) {
                grupId = 1;
            } else if (cityName === 'ozelgun-kart' || cityName.includes('ozelgun-kart')) {
                grupId = 2;
            } else if (cityName === 'ozelsiparis-kart' || cityName.includes('ozelsiparis-kart')) {
                grupId = 3;
            } else if (cityName === 'aracsusleme-kart' || cityName.includes('aracsusleme-kart')) {
                grupId = 4;
            }
            
            // grupId belirlendiğinde etiketleri yükle
            if (grupId) {
                setTimeout(() => {
                    if (typeof window.loadOrganizasyonTurleriToRadioButtons === 'function') {
                        window.loadOrganizasyonTurleriToRadioButtons(null, grupId);
                    }
                    // ÖNEMLİ: Tüm sekmeler için kendi grup ID'lerine göre etiketleri yükle
                    // Böylece her sekme kendi etiketlerini gösterir
                    if (typeof window.loadAllTabsEtiketleri === 'function') {
                        window.loadAllTabsEtiketleri();
                    }
                }, 100); // DOM'un güncellenmesini bekle
            }
        }
    };
}

function setupTabNavigation() {
    // openCity zaten yukarıda tanımlı (satır 4213), bu fonksiyon sadece ekstra setup için kullanılıyor
    // Eğer openCity henüz tanımlı değilse (çok erken çağrılırsa), tekrar tanımla
    if (!window.openCity) {
        // Yukarıdaki tanımı tekrar kullan (fallback)
        window.openCity = function (evt, cityName) {
            // Tüm tab içeriğini gizle
            document.querySelectorAll(".tabcontent").forEach(tab => {
                tab.style.display = "none";
            });

            // Aktif sekme butonlarından "active" sınıfını kaldır
            document.querySelectorAll(".tablinks").forEach(btn => {
                btn.classList.remove("active");
            });

            // Seçilen içeriği göster
            const activeTab = document.getElementById(cityName);
            if (activeTab) activeTab.style.display = "block";

            // Tıklanan sekme butonunu aktif yap
            if (evt?.currentTarget) evt.currentTarget.classList.add("active");
            else if (evt && evt.target) {
                evt.target.classList.add("active");
            }
            
            // ✅ İl, ilçe ve mahalle dropdown'larını hemen yükle (sekme değiştiğinde)
            if (activeTab) {
                // İl dropdown'larını yükle
                const ilWrappers = activeTab.querySelectorAll('.wrapper-acilirliste[data-type="il"]');
                ilWrappers.forEach(ilWrapper => {
                    if (ilWrapper && typeof window.loadProvinceList === 'function') {
                        window.loadProvinceList(ilWrapper);
                    }
                });
                
                // İlçe dropdown'larını yükle (eğer il seçiliyse)
                const ilceWrappers = activeTab.querySelectorAll('.wrapper-acilirliste[data-type="ilce"]');
                ilceWrappers.forEach(ilceWrapper => {
                    const parentContainer = ilceWrapper.closest('form, .input-alan-container, .input-alan');
                    const ilWrapper = parentContainer?.querySelector('.wrapper-acilirliste[data-type="il"]');
                    if (ilWrapper && typeof window.loadDistrictList === 'function') {
                        const ilInput = ilWrapper.querySelector('input[type="hidden"]');
                        const ilId = ilInput?.getAttribute('data-id') || ilInput?.dataset.id || ilInput?.value;
                        if (ilId) {
                            window.loadDistrictList(ilceWrapper, ilId);
                        }
                    }
                });
                
                // Mahalle dropdown'larını yükle (eğer ilçe seçiliyse)
                const mahalleWrappers = activeTab.querySelectorAll('.wrapper-acilirliste[data-type="mahallesemt"]');
                mahalleWrappers.forEach(mahalleWrapper => {
                    const parentContainer = mahalleWrapper.closest('form, .input-alan-container, .input-alan');
                    const ilceWrapper = parentContainer?.querySelector('.wrapper-acilirliste[data-type="ilce"]');
                    if (ilceWrapper && typeof window.loadNeighborhoodList === 'function') {
                        const ilceInput = ilceWrapper.querySelector('input[type="hidden"]');
                        const ilceId = ilceInput?.getAttribute('data-id') || ilceInput?.dataset.id || ilceInput?.value;
                        if (ilceId) {
                            window.loadNeighborhoodList(mahalleWrapper, ilceId);
                        }
                    }
                });
            }
        };
    }
    
    // Data attribute ile tab navigation - Event delegation ile optimize edildi
    // Bu event listener sadece bir kez eklenmeli, bu yüzden kontrol ekle
    if (!window._tabNavigationListenerAdded) {
        window._tabNavigationListenerAdded = true;
        document.addEventListener('click', function(e) {
            if (e.target.closest('.tablinks[data-tab]')) {
                e.preventDefault();
                e.stopPropagation();
                const button = e.target.closest('.tablinks[data-tab]');
                const tabName = button.getAttribute('data-tab');
                if (tabName && typeof window.openCity === 'function') {
                    window.openCity({ currentTarget: button }, tabName);
                }
            }
        });
    }
}
// #endregion Yeni Kart Oluştur --- TABS

// ========================================
// WINDOW EXPORTS
// ========================================
window.setupKartHamburgerMenu = setupKartHamburgerMenu;
window.safeSetupKartHamburgerMenu = safeSetupKartHamburgerMenu;
window.setupSiparisKartFiltreMenu = setupSiparisKartFiltreMenu;
window.safeSetupSiparisKartFiltreMenu = safeSetupSiparisKartFiltreMenu;
window.setupTabNavigation = setupTabNavigation;
// openCity zaten window.openCity olarak tanımlı
