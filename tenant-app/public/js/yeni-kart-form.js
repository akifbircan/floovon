/**
 * Yeni Kart Formlari (Organizasyon, Arac Susleme, Ozel Gun, Ozel Siparis)
 * script.js dosyasindan tasindi (2026-02-07)
 * - slideDown, slideUp, setupYeniKartForm, setupKartFormSubmit
 * - handleOrganizasyonKartSubmit, handleAracSuslemeKartSubmit
 * - handleOzelSiparisKartSubmit, handleOzelGunKartSubmit
 * - setupSiparisFormOrganizasyon, setupSiparisFormDigerTurler
 */
//#region Formlar (Yeni Kart, Müşteri Ekle, Müşteri Düzenle, Partner Sipariş Ekle)

// ============================================================================
// ⚠️ YORUM SATIRINA ALINDI (2026-02-05)
// Bu fonksiyonlar artık js/shared/utils.js dosyasından yükleniyor.
// Sorun olursa bu yorum satırlarını kaldırarak eski haline döndürebilirsin.
// ============================================================================
/*
// Yardımcı animasyon fonksiyonları (tüm form fonksiyonları için ortak)
function slideDown(element, duration = 0) {
    if (duration === 0) {
        element.style.display = 'block';
        return;
    }
    element.style.display = 'block';
    element.style.height = '0px';
    element.style.opacity = '0';
    element.style.transition = `height ${duration}ms ease, opacity ${duration}ms ease`;
    const height = element.scrollHeight;
    setTimeout(() => {
        element.style.height = height + 'px';
        element.style.opacity = '1';
    }, 10);
    setTimeout(() => {
        element.style.height = '';
        element.style.transition = '';
    }, duration);
}

function slideUp(element, duration = 0) {
    if (duration === 0) {
        element.style.display = 'none';
        return;
    }
    element.style.height = element.offsetHeight + 'px';
    element.style.transition = `height ${duration}ms ease, opacity ${duration}ms ease`;
    setTimeout(() => {
        element.style.height = '0px';
        element.style.opacity = '0';
    }, 10);
    setTimeout(() => {
        element.style.display = 'none';
        element.style.height = '';
        element.style.opacity = '';
        element.style.transition = '';
    }, duration);
}

function isVisible(element) {
    return element && (element.style.display !== 'none' && element.offsetParent !== null);
}

function hideElements(selectors) {
    selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => el.style.display = 'none');
    });
}
*/
// ============================================================================

// #region Yeni Kart Oluştur Form Butonları

// #region Yeni Kart Oluştur - Bugünün Tarihini Date Inputlara Yaz
function setBugununTarihiYeniKartForm() {
    // Bugünün tarihini YYYY-MM-DD formatında al
    const bugun = new Date();
    const yil = bugun.getFullYear();
    const ay = String(bugun.getMonth() + 1).padStart(2, '0');
    const gun = String(bugun.getDate()).padStart(2, '0');
    const bugununTarihi = `${yil}-${ay}-${gun}`;
    
    // Tüm date inputları bul ve bugünün tarihini yaz
    const dateInputs = [
        document.getElementById('dateInput-organizasyon'),
        document.getElementById('dateInput-aracsusleme'),
        document.getElementById('dateInput-ozelgun'),
        document.getElementById('dateInput-ozelsiparis')
    ];
    
    dateInputs.forEach(input => {
        if (input) {
            input.value = bugununTarihi;
        }
    });
}
// #endregion

// #region Yeni Kart Oluştur Form Butonları
function setupYeniKartForm() {
    // Element kontrolü
    const overlay = document.querySelector('.overlay-yeni-kart-container');
    const form = document.querySelector('.yeni-kart-container');

    // Ana elementler yoksa çık
    if (!overlay || !form) {
        // console.log('Yeni kart form elementleri bu sayfada mevcut değil - atlanıyor');
        return;
    }

    // Event listener zaten eklenmişse tekrar ekleme
    if (window._yeniKartFormListenerAdded) {
        return;
    }
    window._yeniKartFormListenerAdded = true;

    // console.log('Yeni kart form sistemi başlatılıyor...');

    // Form submit handler'ını ekle
    setupKartFormSubmit();
    
    // "+YENİ TÜR EKLE" ve "+YENİ ETİKET EKLE" butonları için event listener
    // MEV mevcut TurPopup ve EtiketPopup class'ları tarafından yönetiliyor (satır 10076 ve 9820)

    // Ortadaki veya sağ paneldeki butonla formu aç
    document.addEventListener('click', function (e) {
        // Yeni müşteri ekle butonu kontrolü
        if (e.target.matches('.btn-yeni-musteri-ekle') ||
            e.target.closest('.btn-yeni-musteri-ekle')) {
            e.preventDefault();
            e.stopPropagation();

            
            // openMusteriEklemeFormu fonksiyonunu kontrol et
            if (typeof window.openMusteriEklemeFormu === 'function') {
                window.openMusteriEklemeFormu();
            } else {
                // Fonksiyon yoksa, formu manuel aç
                const overlay = document.querySelector('.overlay-yeni-musteri-container');
                const container = document.querySelector('.yeni-musteri-container:not(#container-musteri-duzenle)');
                if (overlay && container) {
                    if (typeof slideDown === 'function') {
                        slideDown(overlay, 0);
                        slideDown(container, 0);
                    } else {
                        overlay.style.display = 'block';
                        container.style.display = 'block';
                    }

                    
                    // Adres select'lerini doldur
                    setTimeout(() => {
                        if (typeof setupYeniMusteriAdresSelects === 'function') {
                            setupYeniMusteriAdresSelects();
                        }
                        // Form submit handler'ını ekle (eğer yoksa)
                        setupMusteriFormSubmit();
                    }, 100);
                } else {
                    console.error('❌ Müşteri ekleme formu bulunamadı');
                }
            }
            return;
        }
        
        // Yeni kart butonları kontrolü
        const yeniKartBtn = e.target.closest('.btn-yeni-kart-ekle, .btn-yeni-kart');
        if (yeniKartBtn || e.target.matches('.btn-yeni-kart-ekle, .btn-yeni-kart')) {
            e.preventDefault();
            e.stopPropagation();

            console.log('🔵 Yeni kart butonu tıklandı!', { target: e.target, closest: yeniKartBtn });

            // Overlay ve form'u her seferinde yeniden al (closure sorununu önlemek için)
            const currentOverlay = document.querySelector('.overlay-yeni-kart-container');
            const currentForm = document.querySelector('.yeni-kart-container');
            
            if (!currentOverlay || !currentForm) {
                console.error('❌ Yeni kart form elementleri bulunamadı!', {
                    overlay: !!currentOverlay,
                    form: !!currentForm
                });
                return;
            }
            

            // ✅ ÖNEMLİ: Yeni kart oluştur formuna geçildiğinde düzenleme modunu kapat
            // Böylece tab'lar tekrar görünür
            window.isEditMode = false;
            
            // Düzenleme modunu temizle (yeni kart oluşturma modu)
            resetKartFormEditMode();

            // Overlay'i body'ye taşı (eğer değilse)
            if (currentOverlay.parentElement !== document.body) {
                document.body.appendChild(currentOverlay);
            }

            // Formu göster - class-based yaklaşım
            currentOverlay.classList.remove('hidden');
            currentOverlay.classList.add('show');
            currentForm.classList.remove('hidden');
            currentForm.classList.add('show');
            document.body.style.overflow = 'hidden'; // Scroll'u engelle

            // Form açıldığında tüm error state'lerini temizle
            const allForms = currentForm.querySelectorAll('form');
            allForms.forEach(f => clearFormErrors(f));
            
            // Mahalle placeholder'ını doğru ayarla
            setTimeout(() => {
                const mahalleWrapper = currentForm.querySelector('.wrapper-acilirliste[data-type="mahallesemt"]');
                if (mahalleWrapper) {
                    const mahalleSpan = mahalleWrapper.querySelector('.acilirliste span');
                    if (mahalleSpan && !mahalleWrapper.querySelector('.hidden-veri').value) {
                        mahalleSpan.textContent = 'Mahalle/Semt Seçiniz';
                    }
                }
            }, 100);

            // Default tab'ı aç - openCity fonksiyonunu kullan (etiket yükleme mantığı içinde)
            const defaultTab = document.getElementById('defaultOpen');
            if (defaultTab && typeof window.openCity === 'function') {
                // openCity fonksiyonunu çağır (etiket yükleme mantığı içinde)
                const event = { currentTarget: defaultTab };
                window.openCity(event, 'organizasyon-kart');
            } else if (defaultTab) {
                // Fallback: direkt click
                defaultTab.click();
            }

            // Form validasyonunu yenile (eğer fonksiyon varsa)
            if (typeof refreshFormValidation === 'function') {
                refreshFormValidation();
            }

            // Dropdown'ları hemen başlat ve konum bilgilerini yükle
            setupGenelAcilirListe();
            
            // ✅ İl, ilçe ve mahalle dropdown'larını hemen yüklemeye başlat (tüm formlar için)
            const ilWrappers = currentForm.querySelectorAll('.wrapper-acilirliste[data-type="il"]');
            ilWrappers.forEach(ilWrapper => {
                if (ilWrapper && typeof window.loadProvinceList === 'function') {
                    window.loadProvinceList(ilWrapper);
                }
            });
            
            // ✅ İlçe dropdown'larını da hemen yükle (eğer il seçiliyse)
            const ilceWrappers = currentForm.querySelectorAll('.wrapper-acilirliste[data-type="ilce"]');
            ilceWrappers.forEach(ilceWrapper => {
                // Aynı form içindeki il dropdown'ını bul
                const parentContainer = ilceWrapper.closest('form, .input-alan-container, .input-alan');
                const ilWrapper = parentContainer?.querySelector('.wrapper-acilirliste[data-type="il"]');
                if (ilWrapper && typeof window.loadDistrictList === 'function') {
                    const ilInput = ilWrapper.querySelector('input[type="hidden"]');
                    const ilId = ilInput?.getAttribute('data-id') || ilInput?.dataset.id || ilInput?.value;
                    if (ilId) {
                        // İl seçiliyse ilçe listesini yükle
                        window.loadDistrictList(ilceWrapper, ilId);
                    }
                }
            });
            
            // ✅ Mahalle dropdown'larını da hemen yükle (eğer ilçe seçiliyse)
            const mahalleWrappers = currentForm.querySelectorAll('.wrapper-acilirliste[data-type="mahallesemt"]');
            mahalleWrappers.forEach(mahalleWrapper => {
                // Aynı form içindeki ilçe dropdown'ını bul
                const parentContainer = mahalleWrapper.closest('form, .input-alan-container, .input-alan');
                const ilceWrapper = parentContainer?.querySelector('.wrapper-acilirliste[data-type="ilce"]');
                if (ilceWrapper && typeof window.loadNeighborhoodList === 'function') {
                    const ilceInput = ilceWrapper.querySelector('input[type="hidden"]');
                    const ilceId = ilceInput?.getAttribute('data-id') || ilceInput?.dataset.id || ilceInput?.value;
                    if (ilceId) {
                        // İlçe seçiliyse mahalle listesini yükle
                        window.loadNeighborhoodList(mahalleWrapper, ilceId);
                    }
                }
            });
            
            // Konum ayarlarından İl ve İlçe'yi otomatik doldur
            // Direkt çağır - setTimeout gereksiz
            const func = window.otoDoldurKonumBilgileri || otoDoldurKonumBilgileri;
            if (typeof func === 'function') {
                func();
            } else {
                console.error('❌ otoDoldurKonumBilgileri fonksiyonu bulunamadı!');
            }
            
            // Diğer işlemler için kısa bir timeout
            setTimeout(() => {
                // Bugünün tarihini date inputlara yaz
                setBugununTarihiYeniKartForm();
                
                // Aktif sekmenin ID'sini bul ve grup_id belirle
                let grupId = null;
                const allTabContents = currentForm.querySelectorAll('.tabcontent');
                for (const tab of allTabContents) {
                    const style = window.getComputedStyle(tab);
                    if (style.display !== 'none') {
                        const tabId = tab.id;
                        if (tabId === 'organizasyon-kart') {
                            grupId = 1;
                        } else if (tabId === 'ozelgun-kart') {
                            grupId = 2;
                        } else if (tabId === 'ozelsiparis-kart') {
                            grupId = 3;
                        } else if (tabId === 'aracsusleme-kart') {
                            grupId = 4;
                        }
                        break;
                    }
                }
                
                // Organizasyon türleri ve etiketlerini backend'den yükle
                // ÖNEMLİ: Her sekme için kendi grup ID'sine göre etiketleri yükle
                if (typeof loadOrganizasyonTurleriToRadioButtons === 'function') {
                    loadOrganizasyonTurleriToRadioButtons(null, grupId);
                }
                // Tüm sekmeler için kendi grup ID'lerine göre etiketleri yükle
                if (typeof loadAllTabsEtiketleri === 'function') {
                    loadAllTabsEtiketleri();
                }
                
                // Form değişiklik takibini başlat
                const activeForm = currentForm.querySelector('form');
                if (activeForm && window.formChangeTracker) {
                    window.formChangeTracker.trackForm(activeForm);
                } else {
                    console.error('❌ Form veya Form Change Tracker bulunamadı!');
                }
            }, 100);
        }

        // Overlay'e tıklanınca formu kapat
        if (e.target.matches('.overlay-yeni-kart-container')) {
            closeYeniKartForm();
        }

        // Kapatma butonları (sadece yeni kart formunda)
        const currentOverlayForClose = document.querySelector('.overlay-yeni-kart-container');
        if ((e.target.matches('.btn-close-form') ||
            e.target.matches('.btn-vazgec') ||
            e.target.closest('.btn-close-form') ||
            e.target.closest('.btn-vazgec')) &&
            currentOverlayForClose && currentOverlayForClose.contains(e.target)) {
            closeYeniKartForm();
        }
    });

    // console.log('Yeni kart form sistemi başarıyla başlatıldı');
}

// ✅ Global erişim için window'a ekle (modül tarafından çağrılacak)
if (typeof window !== 'undefined') {
    window.setupYeniKartForm = setupYeniKartForm;
}

// Form edit mode'unu temizle
function resetKartFormEditMode() {
    const formContainer = document.querySelector('.yeni-kart-container');
    if (!formContainer) return;
    
    // ✅ ÖNEMLİ: Düzenleme modundaysa sıfırlama yapma!
    if (window.isEditMode) {
        return;
    }
    
    // Düzenleme modu flag'ini temizle
    window.isEditMode = false;
    // Form başlığını sıfırla
    // 1. header-alan .baslik -> "Yeni Kart Oluştur"
    const headerBaslik = formContainer.querySelector('.header-alan .baslik');
    if (headerBaslik) {
        headerBaslik.textContent = 'Yeni Kart Oluştur';
        headerBaslik.removeAttribute('data-edit-mode');
        headerBaslik.removeAttribute('data-organization-id');
    }
    
    // 2. kart-baslik -> Orijinal başlıklara dön
    const kartBaslik = formContainer.querySelector('.kart-baslik');
    if (kartBaslik) {
        const formType = formContainer.querySelector('form')?.id;
        if (formType?.includes('organizasyon')) {
            kartBaslik.textContent = 'Organizasyon Kartı Oluştur';
        } else if (formType?.includes('arac')) {
            kartBaslik.textContent = 'Araç Süsleme Kartı Oluştur';
        } else if (formType?.includes('ozel-siparis')) {
            kartBaslik.textContent = 'Özel Sipariş Kartı Oluştur';
        } else if (formType?.includes('ozel-gun')) {
            kartBaslik.textContent = 'Özel Gün Kartı Oluştur';
        }
    }
    
    // 3. Açıklama satırını orijinal haline dön
    const aciklamaSatir = formContainer.querySelector('.tablinks.active .aciklamasatir');
    if (aciklamaSatir) {
        const formType = formContainer.querySelector('form')?.id;
        if (formType?.includes('organizasyon')) {
            aciklamaSatir.textContent = 'Düğün, nişan, açılış, yemek vb. organizasyonlar için kart oluşturun.';
        } else if (formType?.includes('arac')) {
            aciklamaSatir.textContent = 'Gelin arabası vb. araç süslemeleri için kart oluşturun.';
        } else if (formType?.includes('ozel-siparis')) {
            aciklamaSatir.textContent = 'Kişilere ait (buket vb.) özel siparişler için kart oluşturun.';
        } else if (formType?.includes('ozel-gun')) {
            aciklamaSatir.textContent = 'Anneler Günü vb. özel gün organizasyonları için kart oluşturun.';
        }
    }
    
    // ✅ TÜM butonları KART OLUŞTUR yap ve edit mode attribute'larını temizle
    // Birden fazla form olduğu için tüm butonları temizle
    const kaydetBtns = formContainer.querySelectorAll('.btn-kart-olustur, .btn-kaydet');
    kaydetBtns.forEach(kaydetBtn => {
        if (kaydetBtn) {
            kaydetBtn.textContent = 'KART OLUŞTUR';
            kaydetBtn.removeAttribute('data-edit-mode');
            kaydetBtn.removeAttribute('data-organization-id');
        }
    });
    
    // Tüm tab'ları tekrar göster
    const allTabButtons = formContainer.querySelectorAll('.tab .tablinks');
    allTabButtons.forEach(btn => {
        btn.style.display = '';
    });
    
    // TÜM FORMLARI TEMİZLE
    const allForms = formContainer.querySelectorAll('form');
    allForms.forEach(form => {
        form.reset();
        // Error state'lerini temizle
        clearFormErrors(form);
    });
    
    // TÜM DROPDOWN'LARI TEMİZLE
    const allDropdowns = formContainer.querySelectorAll('.wrapper-acilirliste');
    allDropdowns.forEach(dropdown => {
        const span = dropdown.querySelector('.acilirliste span');
        const hiddenInput = dropdown.querySelector('input[type="hidden"]');
        
        if (span) {
            // Mahalle alanı için özel placeholder
            const dataType = dropdown.getAttribute('data-type');
            if (dataType === 'mahallesemt') {
                span.textContent = 'Mahalle/Semt Seçiniz';
            } else {
                span.textContent = span.getAttribute('data-original-text') || span.getAttribute('data-placeholder') || 'Seçiniz';
            }
        }
        if (hiddenInput) {
            hiddenInput.value = '';
            hiddenInput.removeAttribute('data-id');
            hiddenInput.removeAttribute('data-name');
        }
    });
    
    // TÜM TEXT INPUT'LARI TEMİZLE
    const allTextInputs = formContainer.querySelectorAll('input[type="text"], input[type="tel"], textarea');
    allTextInputs.forEach(input => {
        input.value = '';
    });
    
    // TÜM RADIO/CHECKBOX'LARI TEMİZLE
    const allRadios = formContainer.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    allRadios.forEach(radio => {
        radio.checked = false;
    });
    
    // Form temizlendikten sonra tarih inputlarına bugünün tarihini tekrar yaz
    setTimeout(() => {
        setBugununTarihiYeniKartForm();
    }, 50);
}

// Yeni kart formunu kapat (form değişiklik kontrolü ile)
function closeYeniKartForm() {
    const overlay = document.querySelector('.overlay-yeni-kart-container');
    const form = document.querySelector('.yeni-kart-container');
    if (overlay && form) {
        // Aktif formu bul
        const activeForm = form.querySelector('form');
        const formId = activeForm ? activeForm.id : 'yeni-kart-form';
        // Form değişiklik kontrolü
        if (window.formChangeTracker && window.formChangeTracker.hasChanges(formId)) {
            // Değişiklik var, onay al
            window.formChangeTracker.confirmBeforeClose(
                formId,
                async () => {
                    // Kullanıcı "Evet, Kaydet" dedi
                    // Formu kaydet
                    if (activeForm) {
                        activeForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                    }
                    
                    // Formu kapat
                    closeYeniKartFormWithoutCheck();
                },
                () => {
                    // Kullanıcı "Hayır, Kaydetme" dedi
                    // Formu kapat
                    closeYeniKartFormWithoutCheck();
                }
            );
        } else {
            // Değişiklik yok, direkt kapat
            closeYeniKartFormWithoutCheck();
        }
    } else {
        console.error('❌ Overlay veya form bulunamadı!');
    }
}

// Form error state'lerini temizle
function clearFormErrors(form) {
    if (!form) return;
    
    // Tüm error class'larını kaldır
    form.querySelectorAll('.input-error, .radio-error').forEach(el => {
        el.classList.remove('input-error', 'radio-error');
    });
    
    // Custom validity'yi temizle
    form.querySelectorAll('input, textarea, select').forEach(field => {
        field.setCustomValidity('');
    });
    
    // Mahalle placeholder'ını doğru ayarla (eğer değer yoksa)
    const mahalleWrapper = form.querySelector('.wrapper-acilirliste[data-type="mahallesemt"]');
    if (mahalleWrapper) {
        const mahalleHidden = mahalleWrapper.querySelector('.hidden-veri');
        const mahalleSpan = mahalleWrapper.querySelector('.acilirliste span');
        if (mahalleHidden && !mahalleHidden.value && mahalleSpan) {
            mahalleSpan.textContent = 'Mahalle/Semt Seçiniz';
        }
    }
}

// Yeni oluşturulan karta scroll yap ve highlight ekle
function scrollToCardAndHighlight(organizasyonId) {
    if (!organizasyonId) {
        console.warn('⚠️ Organizasyon ID bulunamadı, scroll yapılamıyor');
        return;
    }
    
    // Kart elementini bul (.item elementi data-organizasyon-id'ye sahip)
    const kartElement = document.querySelector(`.item[data-organizasyon-id="${organizasyonId}"]`);
    
    if (!kartElement) {
        console.warn(`⚠️ Organizasyon ID ${organizasyonId} için kart bulunamadı, tekrar deneniyor...`);
        // Birkaç saniye sonra tekrar dene (kartlar henüz render olmamış olabilir)
        setTimeout(() => {
            const retryElement = document.querySelector(`.item[data-organizasyon-id="${organizasyonId}"]`);
            if (retryElement) {
                scrollToCardAndHighlight(organizasyonId);
            } else {
                console.warn(`⚠️ Organizasyon ID ${organizasyonId} için kart hala bulunamadı`);
            }
        }, 1000);
        return;
    }
    
    // Scroll yap - smooth scroll ile
    kartElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'nearest'
    });
    
    // Highlight efekti ekle - ana-kart elementine ekle
    const anaKart = kartElement.querySelector('.ana-kart');
    if (anaKart) {
        // Önce mevcut border'ı temizle
        anaKart.style.border = '';
        anaKart.classList.add('highlight-border');
        
        // Animasyon süresi: 1s * 3 tekrar = 3 saniye + 300ms transition = 3.3 saniye
        setTimeout(() => {
            anaKart.classList.remove('highlight-border');
            // Border'ı tamamen kaldır - inline style ile override et
            anaKart.style.border = 'none';
            // Bir sonraki frame'de style'ı temizle ki normal CSS geçerli olsun
            requestAnimationFrame(() => {
                anaKart.style.border = '';
            });
        }, 3300);
    }
}

// Sipariş kartına highlight efekti ekle
function highlightSiparisKart(siparisId) {
    if (!siparisId) {
        console.warn('⚠️ Sipariş ID bulunamadı, highlight yapılamıyor');
        return;
    }
    
    // Sipariş ID'yi normalize et (ORD-32 -> 32 veya sadece 32)
    const normalizedId = String(siparisId).replace('ORD-', '').trim();
    
    // Sipariş kartını bul - data-order-id attribute'u ile
    const siparisKart = document.querySelector(`.siparis-kart[data-order-id="${normalizedId}"], .siparis-kart[data-order-id="ORD-${normalizedId}"]`);
    
    if (!siparisKart) {
        console.warn(`⚠️ Sipariş ID ${normalizedId} için kart bulunamadı, tekrar deneniyor...`);
        // Birkaç saniye sonra tekrar dene (kartlar henüz render olmamış olabilir)
        setTimeout(() => {
            const retryKart = document.querySelector(`.siparis-kart[data-order-id="${normalizedId}"], .siparis-kart[data-order-id="ORD-${normalizedId}"]`);
            if (retryKart) {
                highlightSiparisKart(siparisId);
            } else {
                console.warn(`⚠️ Sipariş ID ${normalizedId} için kart hala bulunamadı`);
            }
        }, 1000);
        return;
    }
    
    // Sipariş kartına scroll yap (organizasyon kartı içinde görünür hale getir)
    siparisKart.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'nearest'
    });
    
    // Highlight efekti ekle
    siparisKart.style.border = '';
    siparisKart.classList.add('highlight-border');
    
    // Animasyon süresi: 1s * 3 tekrar = 3 saniye + 300ms transition = 3.3 saniye
    setTimeout(() => {
        siparisKart.classList.remove('highlight-border');
        // Border'ı tamamen kaldır
        siparisKart.style.border = 'none';
        // Bir sonraki frame'de style'ı temizle
        requestAnimationFrame(() => {
            siparisKart.style.border = '';
        });
    }, 3300);
}

// Yeni kart formunu kapat (kontrol olmadan)
function closeYeniKartFormWithoutCheck() {
    const overlay = document.querySelector('.overlay-yeni-kart-container');
    const form = document.querySelector('.yeni-kart-container');
    
    if (overlay && form) {
        // Form kapatılmadan önce, sipariş formu mu kontrol et
        const activeForm = form.querySelector('form');
        const formId = activeForm ? activeForm.id : 'yeni-kart-form';
        const isSiparisForm = formId && (
            formId.includes('siparis') || 
            formId.includes('organizasyon') || 
            formId.includes('aracsusleme') || 
            formId.includes('ozelsiparis') || 
            formId.includes('ozelgun')
        );
        
        // Form kapatılmadan önce error state'lerini temizle
        if (activeForm) {
            clearFormErrors(activeForm);
        }
        
        // Modal'ı kapat - class-based yaklaşım
        overlay.classList.remove('show');
        overlay.classList.add('hidden');
        form.classList.remove('show');
        form.classList.add('hidden');
        document.body.style.overflow = ''; // Scroll'u geri aç
        resetKartFormEditMode();
        
        // Form değişiklik takibini sıfırla
        if (window.formChangeTracker) {
            window.formChangeTracker.resetChanges(formId);
        }
        
        // Eğer sipariş formu kapatıldıysa ve başarıyla kaydedildiyse event tetikle
        if (isSiparisForm && form.dataset.submitted === 'true') {
            // Custom event tetikle
            window.dispatchEvent(new CustomEvent('siparisEklendi', {
                detail: { formId: formId }
            }));
            
            // localStorage'a da kaydet (diğer tab'lar için)
            try {
                localStorage.setItem('siparisEklendi', JSON.stringify({
                    formId: formId,
                    timestamp: Date.now()
                }));
            } catch (e) {
                console.error('❌ localStorage yazma hatası:', e);
            }
            
            // Flag'i temizle
            form.dataset.submitted = 'false';
        }
    }
}

// Form içindeki file input'ları temizle
function clearFormFileInputs(form) {
    const fileInputs = form.querySelectorAll('input[type="file"]');
    fileInputs.forEach((fileInput, index) => {
        try {
            // File input'u tamamen yeniden oluştur
            const newFileInput = fileInput.cloneNode(true);
            newFileInput.value = '';
            
            // Eski input'u yeni ile değiştir
            fileInput.parentNode.replaceChild(newFileInput, fileInput);
            
            // Upload area'yı bul ve temizle
            const uploadArea = newFileInput.closest('.dosya-yukle-alan');
            if (uploadArea) {
                // Dosya önizleme alanlarını temizle
                const previews = uploadArea.querySelectorAll('.file-preview, .image-preview, .kart-gorsel, .preview-container, .compact-preview-img');
                previews.forEach(preview => {
                    preview.innerHTML = '';
                    preview.style.display = 'none';
                });
                
                // Dosya bilgi alanlarını temizle
                const fileInfos = uploadArea.querySelectorAll('.file-info, .file-name, .file-size, .file-details');
                fileInfos.forEach(info => {
                    info.textContent = '';
                    info.style.display = 'none';
                });
                
                // Dosya yükleme metnini sıfırla
                const uploadTexts = uploadArea.querySelectorAll('.upload-text, .file-upload-text, .upload-message, .file-label');
                uploadTexts.forEach(text => {
                    if (text.classList.contains('file-label')) {
                        text.textContent = 'Davetiye görselini bu alana sürükleyin veya tıklayın';
                    } else {
                        text.textContent = 'Dosya seçmek için tıklayın veya sürükleyin';
                    }
                });
                
                // Remove button'u gizle
                const removeButtons = uploadArea.querySelectorAll('.remove-button');
                removeButtons.forEach(btn => {
                    btn.style.display = 'none';
                });
                
                // Drag over class'ını kaldır
                uploadArea.classList.remove('drag-over', 'dragover');
                
                // Upload area'nın kendisini de temizle
                uploadArea.classList.remove('has-file', 'file-selected');
            }
            
        } catch (error) {
            console.warn('⚠️ File input temizlenemedi:', error.message);
        }
    });
}

// Yeni kart form submit handler
function setupKartFormSubmit() {
    const forms = document.querySelectorAll('#form-yeni-organizasyon-kart, #form-yeni-aracsusleme-kart, #form-yeni-ozelsiparis-kart, #form-yeni-ozel-gun-kart');
    
    forms.forEach(form => {
        if (!form) return;
        
        // Event listener zaten eklendiyse atla
        if (form.dataset.submitHandlerAdded === 'true') {
            return;
        }
        form.dataset.submitHandlerAdded = 'true';
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            e.stopPropagation(); // Event propagation'ı durdur
            // ÖNCE VALIDATION KONTROLÜ YAP!
            // Tüm error'ları temizle
            form.querySelectorAll('.input-error, .radio-error').forEach(el => {
                el.classList.remove('input-error', 'radio-error');
                el.removeAttribute('data-required-error');
            });
            
            // Hidden input'ların custom validity'sini temizle (yeniden kontrol için)
            form.querySelectorAll('.hidden-veri[required]').forEach(field => {
                field.setCustomValidity('');
            });

            const validation = validateRequiredFields(form);

            if (!validation.isValid) {
                console.warn(`🚫 Form geçersiz! [${form.id}]`);
                console.warn('🚫 İlk geçersiz element:', validation.firstInvalidElement);
                console.warn('🚫 Tüm required alanlar:', form.querySelectorAll("input[required], textarea[required], select[required], .hidden-veri[required]"));
                focusFirstInvalidElement(validation.firstInvalidElement);
                return; // Form submit'ini durdur - KESINLIKLE!
            }
            
            // Validation geçtiyse devam et
            try {
                const formId = form.id;
                
                // ✅ ÖNEMLİ: Edit mode kontrolünü handleOrganizasyonKartSubmit çağrılmadan ÖNCE yap!
                // Çünkü form submit edildikten sonra buton bilgileri değişebilir
                const kaydetBtn = form.querySelector('.btn-kaydet, .btn-kart-olustur');
                const isEditModeBeforeSubmit = kaydetBtn && kaydetBtn.getAttribute('data-edit-mode') === 'true';
                const organizasyonIdBeforeSubmit = kaydetBtn ? kaydetBtn.getAttribute('data-organization-id') : null;
                const butonTextBeforeSubmit = kaydetBtn?.textContent?.trim() || '';
                const isGuncelleButonuBeforeSubmit = butonTextBeforeSubmit === 'GÜNCELLE' || butonTextBeforeSubmit.includes('GÜNCELLE');
                
                // ✅ ÖNEMLİ: Güncelleme modundaysa data-toast attribute'unu kaldır (yanlış toast mesajı gösterilmesin)
                if (kaydetBtn && (isEditModeBeforeSubmit || isGuncelleButonuBeforeSubmit || organizasyonIdBeforeSubmit)) {
                    kaydetBtn.removeAttribute('data-toast');
                }
                
                // ✅ ÖNEMLİ: Eğer buton text'i "KART OLUŞTUR" ise kesinlikle yeni kart oluşturma modu!
                // Bu kontrolü en başta yap ki düzenleme modundan sonra yeni kart oluşturma moduna geçildiğinde
                // yanlışlıkla güncelleme yapılmasın
                const isKartOlusturButonu = butonTextBeforeSubmit === 'KART OLUŞTUR' || butonTextBeforeSubmit.includes('KART OLUŞTUR');
                
                if (isKartOlusturButonu) {
                    // Buton text'i "KART OLUŞTUR" ise kesinlikle yeni kart oluşturma modu
                    // Attribute'ları da temizle (güvenlik için)
                    if (kaydetBtn) {
                        kaydetBtn.removeAttribute('data-edit-mode');
                        kaydetBtn.removeAttribute('data-organization-id');
                    }
                    // window.isEditMode flag'ini de temizle
                    window.isEditMode = false;
                }
                
                // ✅ ÖNEMLİ: Eğer organizasyonId varsa VE (isEditMode true VEYA buton text'i GÜNCELLE), bu kesinlikle güncelleme!
                // Ama buton text'i "KART OLUŞTUR" ise veya window.isEditMode false ise kesinlikle yeni kart oluşturma modu
                const isActuallyEditModeBeforeSubmit = !isKartOlusturButonu && 
                    window.isEditMode !== false && // window.isEditMode false ise kesinlikle yeni kart oluşturma modu
                    ((organizasyonIdBeforeSubmit && (isEditModeBeforeSubmit || isGuncelleButonuBeforeSubmit)) || (isEditModeBeforeSubmit && organizasyonIdBeforeSubmit));
                
                let result;
                
                // Form türüne göre işlem yap
                if (formId === 'form-yeni-organizasyon-kart') {
                    result = await handleOrganizasyonKartSubmit(form);
                } else if (formId === 'form-yeni-aracsusleme-kart') {
                    result = await handleAracSuslemeKartSubmit(form);
                } else if (formId === 'form-yeni-ozelsiparis-kart') {
                    result = await handleOzelSiparisKartSubmit(form);
                } else if (formId === 'form-yeni-ozel-gun-kart') {
                    result = await handleOzelGunKartSubmit(form);
                }
                
                if (result && result.success) {
                    
                    // ✅ Toast mesajını sadece bir kez göster - güncelleme modunda sadece güncelleme mesajı
                    // ✅ ÖNEMLİ: Submit'ten ÖNCE aldığımız bilgileri kullan!
                    if (isActuallyEditModeBeforeSubmit) {
                        // Güncelleme modunda - sadece güncelleme mesajı
                        createToast('success', 'Kart başarıyla güncellendi!');
                    } else {
                        // Yeni kart oluşturma modunda - oluşturma mesajı
                        createToast('success', 'Kart başarıyla oluşturuldu!');
                    }
                    
                    // Yeni kart oluşturulduğunda result.data.id'yi kullan
                    const targetOrganizasyonId = result.organizasyonId || (result.data?.id ? String(result.data.id) : null);
                    
                    // Form değişikliklerini sıfırla
                    if (window.formChangeTracker) {
                        window.formChangeTracker.resetChanges(form.id);
                    }
                    
                    // Formu temizle VE edit mode'u sıfırla
                    form.reset();
                    // Error state'lerini temizle
                    clearFormErrors(form);
                    resetKartFormEditMode();
                    
                    // File input'ları manuel olarak temizle
                    const fileInputs = form.querySelectorAll('input[type="file"]');
                    fileInputs.forEach(input => {
                        input.value = '';
                        // Upload area'yı temizle
                        const uploadArea = input.closest('.dosya-yukle-alan');
                        if (uploadArea) {
                            // Önizleme görsellerini temizle
                            const previews = uploadArea.querySelectorAll('.file-preview, .image-preview, .kart-gorsel, .preview-container, .compact-preview-img');
                            previews.forEach(preview => {
                                preview.innerHTML = '';
                                preview.style.display = 'none';
                            });
                            
                            const fileLabel = uploadArea.querySelector('.file-label');
                            if (fileLabel) {
                                fileLabel.textContent = 'Davetiye görselini bu alana sürükleyin veya tıklayın';
                            }
                            const removeBtn = uploadArea.querySelector('.remove-button');
                            if (removeBtn) {
                                removeBtn.style.display = 'none';
                            }
                        }
                    });
                    
                    // Formu kapat - closeYeniKartFormWithoutCheck fonksiyonunu kullan
                    // Bu fonksiyon hem class'ları günceller hem de diğer temizlik işlemlerini yapar
                    closeYeniKartFormWithoutCheck();
                    
                    // ✅ CACHE'I TEMİZLE: Kart güncellendi, cache'i temizle
                    if (window.organizasyonKartlariCache && targetOrganizasyonId) {
                        clearOrganizasyonCache(targetOrganizasyonId);
                    }
                    
                    // Kartları yeniden yükle ve güncellenen/yeni oluşturulan karta scroll yap
                    setTimeout(async () => {
                        if (typeof window.loadDynamicCards === 'function') {
                            await window.loadDynamicCards();
                            
                            // ✅ Hem yeni kart oluşturulduğunda hem de kart güncellendiğinde scroll ve highlight efekti
                            // isActuallyEditModeBeforeSubmit kontrolü yapılmadan önce targetOrganizasyonId kontrolü yapılıyor
                            if (targetOrganizasyonId) {
                                setTimeout(() => {
                                    scrollToCardAndHighlight(targetOrganizasyonId);
                                }, 500); // Kartların render olması için kısa bir bekleme
                            }
                        } else {
                            console.error('❌ loadDynamicCards fonksiyonu bulunamadı!');
                        }
                    }, 1000);
                    
                    // Organizasyon formuysa, türleri tekrar yükle
                    if (form.id === 'form-yeni-organizasyon-kart') {
                        setTimeout(async () => {
                            const turler = await loadOrganizasyonTurleri();
                            createOrganizasyonTuruRadioButtons(turler, '#form-yeni-organizasyon-kart .label-kapsayici-org-tipler:first-of-type');
                        }, 100);
                    }
                }
                
            } catch (error) {
                console.error('❌ Kart oluşturma hatası:', error);
                createToast('error', 'Kart oluşturulamadı: ' + error.message);
            }
        });
    });
}

// Dinamik organizasyon türlerini yükle
async function loadOrganizasyonTurleri() {
    try {
        // floovonFetch kullan - header'ları otomatik ekler, apiBase'i otomatik ekler
        // Eğer floovonFetch yoksa, getFloovonApiBase() kullanarak tam URL oluştur
        const fetchFn = window.floovonFetch || window.floovonFetchStandard;
        let result;
        if (fetchFn) {
            // floovonFetch zaten { success, data } formatında bir obje döndürüyor
            result = await fetchFn(`/api/organizasyon-kartlar`);
        } else {
            // Fallback: getFloovonApiBase() kullan
            const apiBase = (typeof window.getFloovonApiBase === 'function') 
                ? window.getFloovonApiBase() 
                : (window.API_BASE_URL || (window.location.origin ? window.location.origin + '/api' : '/api'));
            const url = `${apiBase}/organizasyon-kartlar`;
            const token = localStorage.getItem('floovon_token') || localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            // ✅ DÜZELTME: credentials: 'include' eklendi (cookie auth için)
            const response = await fetch(url, { 
                headers,
                credentials: 'include' // Cookie auth için gerekli
            });
            
            // ✅ DÜZELTME: Response status kontrolü eklendi
            if (!response.ok) {
                if (response.status === 401) {
                    console.warn('⚠️ Yetkilendirme hatası - token geçersiz veya süresi dolmuş olabilir');
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            result = await response.json();
        }
        
        // Response formatını kontrol et
        if (!result || (result.success === false)) {
            throw new Error('API hatası: ' + (result?.message || 'Bilinmeyen hata'));
        }
        
        // Data'yı al (floovonFetch kullanıldığında result.data, fallback'te result olabilir)
        const data = result.data || result;
        
        // Eğer data bir array değilse veya boşsa, fallback döndür
        if (!Array.isArray(data) || data.length === 0) {
            return ['Düğün', 'Sünnet', 'Nişan', 'Açılış', 'Etkinlik', 'Kermes', 'Cenaze'];
        }
        
        // Benzersiz organizasyon türlerini çıkar
        const uniqueTurler = [...new Set(data.map(kart => kart.organizasyon_kart_tur || kart.kart_tur).filter(tur => tur))];
        
        // Eğer hiç tür bulunamadıysa, fallback döndür
        if (uniqueTurler.length === 0) {
            return ['Düğün', 'Sünnet', 'Nişan', 'Açılış', 'Etkinlik', 'Kermes', 'Cenaze'];
        }
        
        return uniqueTurler;
    } catch (error) {
        // ✅ DÜZELTME: Hata mesajını sadece console.warn ile göster (kullanıcıyı rahatsız etme)
        // Backend bağlantı hatası, fallback değerleri döndür
        return ['Düğün', 'Sünnet', 'Nişan', 'Açılış', 'Etkinlik', 'Kermes', 'Cenaze']; // Fallback
    }
}

// Organizasyon türü radio buttonlarını dinamik oluştur
function createOrganizasyonTuruRadioButtons(turler, containerSelector) {
    const container = document.querySelector(containerSelector);
    
    if (!container) {
        return; // Sessizce çık, bu sayfa için bu element yok
    }
    
    // Mevcut radio buttonları temizle (ilk yeni tür ekle butonunu koru)
    const yeniTurButon = container.querySelector('.btn-yeni-tur');
    container.innerHTML = '';
    
    // Her tür için radio button oluştur
    turler.forEach(tur => {
        const radioGroup = document.createElement('div');
        radioGroup.className = 'radio-group';
        
        const id = `orgtur-${tur.toLowerCase().replace(/\s+/g, '-').replace(/[çğıöşü]/g, match => {
            const map = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u' };
            return map[match] || match;
        })}`;
        
        // İlk radio button'a required ekle (tarayıcının default tooltip'i için)
        const isFirst = turler.indexOf(tur) === 0;
        
        radioGroup.innerHTML = `
            <input type="radio" name="orgtur-etiket" id="${id}" ${isFirst ? 'required' : ''}>
            <label for="${id}" class="orglabel">${tur}</label>
        `;
        
        const input = radioGroup.querySelector('input[type="radio"]');
        
        // Radio button seçildiğinde error'ı temizle
        if (input) {
            input.addEventListener('change', function() {
                if (this.checked) {
                    const wrapper = container.closest('[data-required-radio]');
                    if (wrapper) {
                        wrapper.classList.remove('radio-error', 'input-error');
                    }
                }
            });
        }
        
        container.appendChild(radioGroup);
    });
    
    // Yeni tür ekle butonunu geri ekle
    if (yeniTurButon) {
        container.appendChild(yeniTurButon);
    }
    
}

// Organizasyon kartı form verilerini topla ve backend'e gönder
async function handleOrganizasyonKartSubmit(form) {
    // Edit mode kontrolü - ÖNCELİKLE kontrol et!
    const kaydetBtn = form.querySelector('.btn-kaydet, .btn-kart-olustur');
    const isEditMode = kaydetBtn && kaydetBtn.getAttribute('data-edit-mode') === 'true';
    const organizasyonId = kaydetBtn ? kaydetBtn.getAttribute('data-organization-id') : null;

    
    const formData = new FormData(form);
    
    // Seçili organizasyon türünü bul
    const selectedOrgTur = form.querySelector('input[name="orgtur-etiket"]:checked');
    const kart_tur = selectedOrgTur ? selectedOrgTur.nextElementSibling?.textContent.replace(/\s+/g, ' ').trim() : null;
    
    // Seçili etiketi bul
    const selectedEtiket = form.querySelector('input[name="organizasyon-etiketler"]:checked');
    const kart_etiket = selectedEtiket ? selectedEtiket.nextElementSibling?.textContent.replace(/\s+/g, ' ').trim() : null;
    
    // İl, İlçe, Mahalle - hidden input'lardan direkt value al (artık hepsi isim)
    const ilInput = form.querySelector('input[name="il"]');
    const ilceInput = form.querySelector('input[name="ilce"]');
    const mahalleInput = form.querySelector('input[name="mahallesemt"]');
    
    const il = ilInput ? ilInput.value : '';
    const ilce = ilceInput ? ilceInput.value : '';
    const mahalle = mahalleInput ? mahalleInput.value : '';
    const teslimat_konumu = formData.get('teslimatkonumu') || '';
    
    // Davetiye görseli (dosya input)
    const davetiyeGorselInput = form.querySelector('input[name="davetiye-gorseli"]');
    const davetiye_gorsel = davetiyeGorselInput && davetiyeGorselInput.files.length > 0 ? davetiyeGorselInput.files[0] : null;
    
    // Form verilerini hazırla
    const data = {
        kart_tur: kart_tur,
        kart_etiket: kart_etiket,
        il: il,
        ilce: ilce,
        mahalle: mahalle,
        acik_adres: formData.get('acikadres'),
        teslim_kisisi: formData.get('organizasyon-sahibi'),
        teslim_kisisi_telefon: (() => {
            const telefonDegeri = formData.get('orgsahibitelefon');
            if (telefonDegeri && typeof window.cleanPhoneForDatabase === 'function') {
                return window.cleanPhoneForDatabase(telefonDegeri);
            }
            return telefonDegeri;
        })(),
        teslim_tarih: formData.get('teslim-tarihi'),
        teslim_saat: formData.get('siparis-saat'),
        davetiye_gorsel: null, // Dosya ayrı yüklenecek
        teslimat_konumu: teslimat_konumu // Veritabanı kolon adı ile uyumlu
    };
    // Validasyon
    if (!data.kart_tur) {
        createToast('warning', 'Lütfen organizasyon türünü seçin!');
        return { success: false };
    }
    
    if (!data.teslim_tarih) {
        createToast('warning', 'Lütfen teslim tarihini seçin!');
        return { success: false };
    }
    
    if (!data.teslim_kisisi) {
        createToast('warning', 'Lütfen organizasyon sahibi bilgisini girin!');
        return { success: false };
    }
    
    // Backend'e request gönder (POST veya PUT)
    try {
        let response;
        
        if (isEditMode && organizasyonId) {
            // Güncelleme modu - PUT request
            response = await window.floovonBackend.makeRequest(`/organizasyon-kartlar/${organizasyonId}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            
            // ✅ CACHE'I TEMİZLE: Kart güncellendi, cache'i temizle
            if (response.success && window.organizasyonKartlariCache) {
                clearOrganizasyonCache(organizasyonId);
            }
            
            // Sync broadcast - diğer tab'lara bildir
            if (response.success && window.syncManager) {
                window.syncManager.broadcast('ORGANIZASYON_UPDATED', {
                    organizasyonId: organizasyonId,
                    organizasyonData: response.data
                });
            }
        } else {
            // Yeni oluşturma modu - POST request
            response = await window.floovonBackend.makeRequest('/organizasyon-kartlar', {
            method: 'POST',
            body: JSON.stringify(data)
        });
            
            // Sync broadcast - diğer tab'lara bildir
            if (response.success && window.syncManager) {
                window.syncManager.broadcast('ORGANIZASYON_CREATED', {
                    organizasyonId: response.data?.id,
                    organizasyonData: response.data
                });
            }
        }
        
        // Eğer davetiye görseli seçildiyse, ayrıca yükle
        const targetId = organizasyonId || response.data?.id;
        if (response.success && targetId && davetiye_gorsel) {
            try {
                const formData = new FormData();
                formData.append('davetiye_gorsel', davetiye_gorsel);
                
                const apiBase = (typeof window.getFloovonApiBase === 'function') 
            ? window.getFloovonApiBase() 
            : (window.API_BASE_URL || ((typeof window.getFloovonApiBase === 'function') 
                ? window.getFloovonApiBase() 
                : (window.getFloovonApiBase ? window.getFloovonApiBase() : (window.API_BASE_URL || '/api'))));
                const uploadResult = await (window.floovonFetch || window.floovonFetchStandard || fetch)(`/api/organizasyon-kartlar/${targetId}/davetiye-gorseli`, {
                    method: 'POST',
                    body: formData
                });
                
                // floovonFetch zaten JSON parse ediyor, tekrar parse etmeye gerek yok
                // Eğer standart fetch kullanılıyorsa, response'u kontrol et
                if (uploadResult && typeof uploadResult.json === 'function') {
                    const parsedResult = await uploadResult.json();
                    if (!parsedResult.success) {
                        console.error('❌ Davetiye görseli yükleme hatası:', parsedResult);
                    }
                } else if (!uploadResult || !uploadResult.success) {
                    console.error('❌ Davetiye görseli yükleme hatası:', uploadResult);
                }
            } catch (uploadError) {
                console.error('❌ Davetiye görseli yükleme hatası:', uploadError);
            }
        }
        
        // ✅ ÖNEMLİ: Response'a isEditMode bilgisini ekle - toast mesajı için
        if (response.success) {
            response.isEditMode = isEditMode && organizasyonId ? true : false;
            response.organizasyonId = organizasyonId;
        }
        
        return response;
        
    } catch (error) {
        console.error('❌ Backend isteği başarısız:', error);
        throw error;
    }
}

// Araç Süsleme kartı handler
async function handleAracSuslemeKartSubmit(form) {
    // Edit mode kontrolü
    const kaydetBtn = form.querySelector('.btn-kaydet, .btn-kart-olustur');
    const isEditMode = kaydetBtn && kaydetBtn.getAttribute('data-edit-mode') === 'true';
    const organizasyonId = kaydetBtn ? kaydetBtn.getAttribute('data-organization-id') : null;

    
    const formData = new FormData(form);
    
    // Form alanlarından veri topla
    const teslimTarih = formData.get('teslim-tarihi');
    const teslimSaat = formData.get('teslim-saati') || null;
    const mahalle = formData.get('mahallesemt') || null;
    const acikAdres = formData.get('acik-adres') || null;
    const teslimKisisi = formData.get('teslim-kisisi') || null;
    const teslimKisisiTelefon = formData.get('teslim-kisisi-telefon') || null;
    
    const data = {
        kart_tur: 'Araç Süsleme',
        kart_etiket: 'Araç Süsleme Randevusu',
        mahalle: mahalle,
        acik_adres: acikAdres,
        teslim_kisisi: teslimKisisi,
        teslim_kisisi_telefon: teslimKisisiTelefon,
        teslim_tarih: teslimTarih,
        teslim_saat: teslimSaat,
        kart_gorsel: null
    };
    if (!data.teslim_tarih) {
        createToast('warning', 'Lütfen randevu tarihini seçin!');
        return { success: false };
    }
    
    try {
        let response;
        
        if (isEditMode && organizasyonId) {
            // Güncelleme modu - PUT request
            response = await window.floovonBackend.makeRequest(`/organizasyon-kartlar/${organizasyonId}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        } else {
            // Yeni oluşturma modu - POST request
            response = await window.floovonBackend.makeRequest('/organizasyon-kartlar', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }
        
        return response;
    } catch (error) {
        console.error('❌ Backend isteği başarısız:', error);
        throw error;
    }
}

// Özel Sipariş kartı handler
async function handleOzelSiparisKartSubmit(form) {
    // Edit mode kontrolü
    const kaydetBtn = form.querySelector('.btn-kaydet, .btn-kart-olustur');
    const isEditMode = kaydetBtn && kaydetBtn.getAttribute('data-edit-mode') === 'true';
    const organizasyonId = kaydetBtn ? kaydetBtn.getAttribute('data-organization-id') : null;

    
    const formData = new FormData(form);
    
    // Seçili etiketi bul - Özel Sipariş için doğru name attribute'u kullan
    let selectedEtiket = form.querySelector('input[name="ozel-siparis-etiketler"]:checked');
    if (!selectedEtiket) {
        // Fallback: Eski name attribute'u dene
        selectedEtiket = form.querySelector('input[name="organizasyon-etiketler"]:checked');
    }
    const kart_etiket = selectedEtiket ? selectedEtiket.nextElementSibling?.textContent.replace(/\s+/g, ' ').trim() : null;
    
    const data = {
        kart_tur: 'Özel Sipariş',
        kart_etiket: kart_etiket,
        mahalle: null,
        acik_adres: null,
        teslim_kisisi: null,
        teslim_kisisi_telefon: null,
        teslim_tarih: formData.get('teslim-tarihi'),
        teslim_saat: null,
        kart_gorsel: null
    };
    if (!data.teslim_tarih) {
        createToast('warning', 'Lütfen teslim tarihini seçin!');
        return { success: false };
    }
    
    try {
        let response;
        
        if (isEditMode && organizasyonId) {
            // Güncelleme modu - PUT request
            response = await window.floovonBackend.makeRequest(`/organizasyon-kartlar/${organizasyonId}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        } else {
            // Yeni oluşturma modu - POST request
            response = await window.floovonBackend.makeRequest('/organizasyon-kartlar', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }
        
        return response;
    } catch (error) {
        console.error('❌ Backend isteği başarısız:', error);
        throw error;
    }
}

// Özel Gün kartı handler
async function handleOzelGunKartSubmit(form) {
    // Edit mode kontrolü
    const kaydetBtn = form.querySelector('.btn-kaydet, .btn-kart-olustur');
    const isEditMode = kaydetBtn && kaydetBtn.getAttribute('data-edit-mode') === 'true';
    const organizasyonId = kaydetBtn ? kaydetBtn.getAttribute('data-organization-id') : null;

    
    const formData = new FormData(form);
    
    // Seçili özel gün türünü bul (Anneler Günü, Doğum Günü vs.) - bu alt_tur olacak
    const selectedOrgTur = form.querySelector('input[name="orgtur-etiket"]:checked');
    const alt_tur = selectedOrgTur ? selectedOrgTur.nextElementSibling?.textContent.replace(/\s+/g, ' ').trim() : null;
    
    // Seçili etiketi bul
    const selectedEtiket = form.querySelector('input[name="ozel-gun-etiketler"]:checked');
    const kart_etiket = selectedEtiket ? selectedEtiket.nextElementSibling?.textContent.replace(/\s+/g, ' ').trim() : null;
    
    // Form alanlarından veri topla
    const teslimTarih = formData.get('teslim-tarihi');
    const teslimSaat = formData.get('teslim-saati') || null;
    const mahalle = formData.get('mahallesemt') || null;
    const acikAdres = formData.get('acik-adres') || null;
    const teslimKisisi = formData.get('teslim-kisisi') || null;
    const teslimKisisiTelefon = formData.get('teslim-kisisi-telefon') || null;
    
    const data = {
        kart_tur: 'Özel Gün', // Her zaman 'Özel Gün' olarak kaydet
        kart_etiket: kart_etiket,
        alt_tur: alt_tur, // Anneler Günü, Doğum Günü vs.
        mahalle: mahalle,
        acik_adres: acikAdres,
        teslim_kisisi: teslimKisisi,
        teslim_kisisi_telefon: teslimKisisiTelefon,
        teslim_tarih: teslimTarih,
        teslim_saat: teslimSaat,
        kart_gorsel: null
    };
    if (!data.teslim_tarih) {
        createToast('warning', 'Lütfen teslim tarihini seçin!');
        return { success: false };
    }
    
    try {
        let response;
        
        if (isEditMode && organizasyonId) {
            // Güncelleme modu - PUT request
            response = await window.floovonBackend.makeRequest(`/organizasyon-kartlar/${organizasyonId}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        } else {
            // Yeni oluşturma modu - POST request
            response = await window.floovonBackend.makeRequest('/organizasyon-kartlar', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }
        
        return response;
    } catch (error) {
        console.error('❌ Backend isteği başarısız:', error);
        throw error;
    }
}

// Form türünden kart türünü belirle
function getCardTypeFromForm(form) {
    const formId = form.id;
    
    if (formId.includes('organizasyon')) return 'organizasyon';
    if (formId.includes('aracsusleme')) return 'aracsusleme';
    if (formId.includes('ozelsiparis')) return 'ozelsiparis';
    if (formId.includes('ozelgun')) return 'ozelgun';
    
    return 'organizasyon'; // Varsayılan
}

// #endregion

// #region Partner Sipariş Ekle Form - KALDIRILDI
// Eski partner sipariş formu kaldırıldı, artık yeni sipariş formunda partner sistemi kullanılıyor
// #endregion

// #endregion

// #region Yeni Sipariş Ekle Form - Organizasyon Düğün, Nişan, Açılış, Etkinlik vb.
function setupSiparisFormOrganizasyon() {
    // Gerekli elementleri kontrol et
    const overlay = document.querySelector('.overlay-yeni-siparis-container');
    const form = document.querySelector('.yeni-siparis-container');
    const organizasyonContainer = document.querySelector('.container-organizasyon');
    const btnOrganizasyon = document.getElementById('btnorganizasyon');

    if (!overlay || !form || !organizasyonContainer || !btnOrganizasyon) {
        // console.log('Sipariş form organizasyon elementleri bu sayfada mevcut değil - atlanıyor');
        return;
    }

    // console.log('Sipariş form organizasyon sistemi başlatılıyor...');

    let isFormDirty = false;

    // Form input'larını takip et
    const formInputs = document.querySelectorAll('.yeni-siparis-container input');
    formInputs.forEach(input => {
        input.addEventListener('input', function () {
            const defaultValue = this.defaultValue;
            const placeholder = this.getAttribute('placeholder');
            if (this.value !== defaultValue && this.value !== placeholder) {
                isFormDirty = true;
            }
        });
    });

    // // Sayfa kapanırken uyarı
    // window.addEventListener('beforeunload', function (e) {
    //     if (isFormDirty) {
    //         e.preventDefault();
    //         e.returnValue = "Yaptığınız değişiklikler kaydedilsin mi?";
    //         return e.returnValue;
    //     }
    // });

    // Kapatma fonksiyonu
    function closeSiparisForm() {
        slideUp(overlay, 0);
        slideUp(form, 0);
        hideElements(['.container-organizasyon', '.container-aracsusleme', '.container-ozelgun', '.container-ozelsiparis']);
        isFormDirty = false;
    }

    // Global click handler
    document.addEventListener('click', function (e) {
        // Formu aç
        if (e.target.matches('#btnorganizasyon') || e.target.closest('#btnorganizasyon')) {
            hideElements(['.container-organizasyon', '.container-aracsusleme', '.container-ozelgun', '.container-ozelsiparis']);
            slideDown(overlay, 0);
            slideDown(form, 0);
            slideDown(organizasyonContainer, 0);
            
            // Form açıldığında telefon input formatlamasını uygula - PARTNER SAYFASI GİBİ
            // ✅ NOT: Telefon formatlaması artık index.page.js'de yapılıyor
            // Bridge üzerinden çağır (modüler versiyonu kullan)
            setTimeout(() => {
                if (typeof window.setupIndexFormPhoneMask === 'function') {
                    window.setupIndexFormPhoneMask();
                }
            }, 500);
        }

        // Formu kapatma (kapat butonları) - sadece organizasyon formunda
        if ((e.target.matches('.btn-close-form') ||
            e.target.matches('.btn-vazgec') ||
            e.target.closest('.btn-close-form') ||
            e.target.closest('.btn-vazgec')) &&
            overlay.contains(e.target)) {

            if (isFormDirty && !confirm("Yaptığınız değişiklikler kaydedilsin mi?")) {
                e.preventDefault();
            } else {
                closeSiparisForm();
            }
        }
    });

    // Overlay tıklayınca kapatma devre dışı (bilerek boş bırakıldı)

    // ESC tuşu ile kapatma
    document.addEventListener('keydown', function (e) {
        if (e.key === "Escape" && isVisible(organizasyonContainer)) {
            if (isFormDirty && !confirm("Yaptığınız değişiklikler kaydedilsin mi?")) {
                e.preventDefault();
            } else {
                closeSiparisForm();
            }
        }
    });

    // console.log('Sipariş form organizasyon sistemi başarıyla başlatıldı');
    
    // Sipariş form submit handler'ını ekle
    setupSiparisFormSubmit();
}

// Sipariş form submit handler - YENİ SİSTEM
function setupSiparisFormSubmit() {
    // Yeni dinamik form sistemi kullanılıyor
    // Form submit işlemleri handleSiparisFormSubmit fonksiyonu tarafından yönetiliyor
}

// ✅ Telefon maskesini index formu için kur - Bridge (index.page.js'e taşındı)
// Index sayfası telefon formatlaması
window.setupIndexFormPhoneMask = function() {
    // TÜM telefon input'larını bul (index sayfasındaki tüm telefon inputları)
    const telefonInputs = document.querySelectorAll(
        '.telefon-input, ' +
        '#orgsahibitelefon, ' +
        '#musteriyetkilitelefon, ' +
        '#musteritelefon, ' +
        '#teslimedilecektelefon, ' +
        'input[name="orgsahibitelefon"], ' +
        'input[name="musteriyetkilitelefon"], ' +
        'input[name="musteritelefon"], ' +
        'input[name="teslim_kisisi_telefon"], ' +
        'input[type="tel"][data-phone-input="standard"]'
    );
    
    if (telefonInputs.length === 0) {
        return;
    }
    
    telefonInputs.forEach(input => {
        if (!input || input.disabled) return;
        
        // Eğer zaten formatlanmışsa, input'u clone et ve tüm attribute'ları temizle
        if (input.hasAttribute('data-phone-formatted') || input.hasAttribute('data-telefon-mask-applied')) {
            const newInput = input.cloneNode(true);
            newInput.removeAttribute('data-phone-formatted');
            newInput.removeAttribute('data-telefon-mask-applied');
            newInput.removeAttribute('data-telefon-formatted');
            if (!newInput.value || newInput.value.trim() === '' || (!newInput.value.startsWith('+90 (') && !newInput.value.match(/^\d/))) {
                newInput.value = '+90 (';
            }
            input.parentNode.replaceChild(newInput, input);
            input = newInput;
        }
        
        if (!input.hasAttribute('data-phone-input')) {
            input.setAttribute('data-phone-input', 'standard');
        }
        
        if (!input.value || input.value.trim() === '' || (!input.value.startsWith('+90 (') && !input.value.match(/^\d/))) {
            input.value = '+90 (';
        }
        
        input.removeAttribute('data-phone-formatted');
        input.removeAttribute('data-telefon-formatted');
        
        if (typeof window.setupPhoneInput === 'function') {
            window.setupPhoneInput(input);
        }
    });
};

// Input'lara focus olduğunda formatlamayı başlat
window.setupIndexFormPhoneMaskOnFocus = function() {
    const telefonInputs = document.querySelectorAll('#orgsahibitelefon, #musteriyetkilitelefon');
    telefonInputs.forEach(input => {
        if (input && !input.hasAttribute('data-focus-listener-added')) {
            input.setAttribute('data-focus-listener-added', 'true');
            input.addEventListener('focus', function() {
                if (!this.hasAttribute('data-phone-formatted') && typeof window.setupPhoneInput === 'function') {
                    if (!this.hasAttribute('data-phone-input')) {
                        this.setAttribute('data-phone-input', 'standard');
                    }
                    window.setupPhoneInput(this);
                } else if (!this.hasAttribute('data-phone-formatted') && typeof window.setupPhoneInput !== 'function') {
                    setTimeout(() => {
                        if (typeof window.setupPhoneInput === 'function' && !this.hasAttribute('data-phone-formatted')) {
                            if (!this.hasAttribute('data-phone-input')) {
                                this.setAttribute('data-phone-input', 'standard');
                            }
                            window.setupPhoneInput(this);
                        }
                    }, 100);
                }
            }, { once: false });
        }
    });
};

// Form türünden sipariş türünü belirle
function getOrderTypeFromForm(form) {
    const container = form.closest('.container-organizasyon, .container-aracsusleme, .container-ozelsiparis, .container-ozelgun');
    
    if (container.classList.contains('container-organizasyon')) return 'Organizasyon Kartı';
    if (container.classList.contains('container-aracsusleme')) return 'Araç Süsleme';
    if (container.classList.contains('container-ozelsiparis')) return 'Özel Sipariş';
    if (container.classList.contains('container-ozelgun')) return 'Özel Gün';
    
    return 'Genel'; // Varsayılan
}

// #endregion

// #region Yeni Sipariş Ekle Form - Araç Süsleme, Özel Gün, Özel Sipariş
function setupSiparisFormDigerTurler() {
    // Gerekli elementleri kontrol et
    const overlay = document.querySelector('.overlay-yeni-siparis-container');
    const form = document.querySelector('.yeni-siparis-container');
    const btnAracSusleme = document.getElementById('btnaracsusleme');
    const btnOzelSiparis = document.getElementById('btnozelsiparis');
    const btnOzelGun = document.getElementById('btnmozelgun');

    if (!overlay || !form || !btnAracSusleme || !btnOzelSiparis || !btnOzelGun) {
        // console.log('Sipariş form diğer türler elementleri bu sayfada mevcut değil - atlanıyor');
        return;
    }

    // console.log('Sipariş form diğer türler sistemi başlatılıyor...');

    function openForm(containerSelector) {
        slideDown(overlay, 0);
        slideDown(form, 0);
        const container = document.querySelector(containerSelector);
        if (container) {
            slideDown(container, 0);
        }
        
        // Form açıldığında telefon input formatlamasını uygula - PARTNER SAYFASI GİBİ
        // Form animasyonu bittikten sonra uygula
        setTimeout(() => {
            setupIndexFormPhoneMask();
        }, 500);
    }

    function closeForm() {
        slideUp(overlay, 0);
        slideUp(form, 0);
        hideElements(['.container-organizasyon', '.container-aracsusleme', '.container-ozelsiparis', '.container-ozelgun']);
    }

    // Global click handler
    document.addEventListener('click', function (e) {
        // Açma butonları
        if (e.target.matches('#btnaracsusleme') || e.target.closest('#btnaracsusleme')) {
            hideElements(['.container-organizasyon', '.container-ozelgun', '.container-ozelsiparis']);
            openForm('.container-aracsusleme');
        }

        if (e.target.matches('#btnozelsiparis') || e.target.closest('#btnozelsiparis')) {
            hideElements(['.container-organizasyon', '.container-aracsusleme', '.container-ozelgun']);
            openForm('.container-ozelsiparis');
        }

        if (e.target.matches('#btnmozelgun') || e.target.closest('#btnmozelgun')) {
            hideElements(['.container-organizasyon', '.container-aracsusleme', '.container-ozelsiparis']);
            openForm('.container-ozelgun');
        }

        // Kapatma butonları (sadece bu formlarda)
        if ((e.target.matches('.btn-close-form') ||
            e.target.matches('.btn-vazgec') ||
            e.target.closest('.btn-close-form') ||
            e.target.closest('.btn-vazgec')) &&
            overlay.contains(e.target)) {

            closeForm();
        }
    });

    // ESC ile kapatma
    document.addEventListener('keydown', function (e) {
        if (e.key === "Escape" && isVisible(overlay)) {
            closeForm();
        }
    });

    // console.log('Sipariş form diğer türler sistemi başarıyla başlatıldı');
}
// #endregion

// Güvenli başlatma fonksiyonları
async function safeSetupYeniKartForm() {
    try {
        await setupYeniKartForm();
    } catch (error) {
        console.error('Yeni kart form başlatma hatası:', error);
    }
}

// safeSetupPartnerSiparisForm fonksiyonu kaldırıldı


function safeSetupSiparisFormOrganizasyon() {
    try {
        setupSiparisFormOrganizasyon();
    } catch (error) {
        console.error('Sipariş form organizasyon başlatma hatası:', error);
    }
}

function safeSetupSiparisFormDigerTurler() {
    try {
        setupSiparisFormDigerTurler();
    } catch (error) {
        console.error('Sipariş form diğer türler başlatma hatası:', error);
    }
}


//#endregion Formlar (Yeni Kart, Müşteri Ekle, Müşteri Düzenle, Partner Sipariş Ekle)

// Global fonksiyonlar
if (typeof slideDown === "function") window.slideDown = slideDown;
if (typeof slideUp === "function") window.slideUp = slideUp;
if (typeof isVisible === "function") window.isVisible = isVisible;
if (typeof hideElements === "function") window.hideElements = hideElements;
if (typeof setBugununTarihiYeniKartForm === "function") window.setBugununTarihiYeniKartForm = setBugununTarihiYeniKartForm;
if (typeof setupYeniKartForm === "function") window.setupYeniKartForm = setupYeniKartForm;
if (typeof resetKartFormEditMode === "function") window.resetKartFormEditMode = resetKartFormEditMode;
if (typeof closeYeniKartForm === "function") window.closeYeniKartForm = closeYeniKartForm;
if (typeof clearFormErrors === "function") window.clearFormErrors = clearFormErrors;
if (typeof scrollToCardAndHighlight === "function") window.scrollToCardAndHighlight = scrollToCardAndHighlight;
if (typeof highlightSiparisKart === "function") window.highlightSiparisKart = highlightSiparisKart;
if (typeof closeYeniKartFormWithoutCheck === "function") window.closeYeniKartFormWithoutCheck = closeYeniKartFormWithoutCheck;
if (typeof clearFormFileInputs === "function") window.clearFormFileInputs = clearFormFileInputs;
if (typeof setupKartFormSubmit === "function") window.setupKartFormSubmit = setupKartFormSubmit;
if (typeof loadOrganizasyonTurleri === "function") window.loadOrganizasyonTurleri = loadOrganizasyonTurleri;
if (typeof createOrganizasyonTuruRadioButtons === "function") window.createOrganizasyonTuruRadioButtons = createOrganizasyonTuruRadioButtons;
if (typeof handleOrganizasyonKartSubmit === "function") window.handleOrganizasyonKartSubmit = handleOrganizasyonKartSubmit;
if (typeof handleAracSuslemeKartSubmit === "function") window.handleAracSuslemeKartSubmit = handleAracSuslemeKartSubmit;
if (typeof handleOzelSiparisKartSubmit === "function") window.handleOzelSiparisKartSubmit = handleOzelSiparisKartSubmit;
if (typeof handleOzelGunKartSubmit === "function") window.handleOzelGunKartSubmit = handleOzelGunKartSubmit;
if (typeof getCardTypeFromForm === "function") window.getCardTypeFromForm = getCardTypeFromForm;
if (typeof setupSiparisFormOrganizasyon === "function") window.setupSiparisFormOrganizasyon = setupSiparisFormOrganizasyon;
if (typeof setupSiparisFormSubmit === "function") window.setupSiparisFormSubmit = setupSiparisFormSubmit;
if (typeof setupSiparisFormDigerTurler === "function") window.setupSiparisFormDigerTurler = setupSiparisFormDigerTurler;
if (typeof safeSetupYeniKartForm === "function") window.safeSetupYeniKartForm = safeSetupYeniKartForm;
if (typeof safeSetupSiparisFormOrganizasyon === "function") window.safeSetupSiparisFormOrganizasyon = safeSetupSiparisFormOrganizasyon;
if (typeof safeSetupSiparisFormDigerTurler === "function") window.safeSetupSiparisFormDigerTurler = safeSetupSiparisFormDigerTurler;
if (typeof getOrderTypeFromForm === "function") window.getOrderTypeFromForm = getOrderTypeFromForm;

// === INIT: Dosya yüklendiğinde form sistemlerini başlat ===
function _yeniKartFormInit() {
    // Sayfa kontrolü: sadece index sayfasında çalış
    const currentPath = window.location.pathname;
    const pageName = (currentPath.split('/').pop() || '').replace(/\.html$/, '');
    const isIndexPage = pageName === 'index' || pageName === '' || currentPath === '/' || currentPath.endsWith('/');
    const isMusteriCariPage = pageName === 'musteriler-cari' || currentPath.includes('musteriler-cari');

    if (isIndexPage && !isMusteriCariPage) {
        // Organizasyon türlerini yükle
        if (typeof loadOrganizasyonTurleri === 'function') {
            (async () => {
                try {
                    const turler = await loadOrganizasyonTurleri();
                    if (typeof createOrganizasyonTuruRadioButtons === 'function') {
                        createOrganizasyonTuruRadioButtons(turler, '#form-yeni-organizasyon-kart .label-kapsayici-org-tipler:first-of-type');
                    }
                } catch (error) {
                    console.error('❌ Organizasyon türleri yükleme hatası:', error);
                }
            })();
        }
    }

    // Form sistemlerini başlat
    if (typeof safeSetupYeniKartForm === 'function') safeSetupYeniKartForm();
    if (typeof safeSetupSiparisFormOrganizasyon === 'function') safeSetupSiparisFormOrganizasyon();
    if (typeof safeSetupSiparisFormDigerTurler === 'function') safeSetupSiparisFormDigerTurler();
    if (typeof setupSiparisFormOrganizasyon === 'function') setupSiparisFormOrganizasyon();
    if (typeof setupSiparisFormDigerTurler === 'function') setupSiparisFormDigerTurler();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _yeniKartFormInit);
} else {
    _yeniKartFormInit();
}