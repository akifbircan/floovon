// siparis-form-core.js
// ============================================================================
// SİPARİŞ FORM CORE - Form Açma, Kapama, Temizleme, Dosya İşlemleri
// ============================================================================
// TAŞINDI: script.js'den (2026-02-08)
// İçerik: openSiparisForm, fillOrganizasyonBilgileri, closeSiparisForm,
//   kaydetSiparisForm, setupFileInputEvents, handleFileUpload (form-içi),
//   clearFileInputsInForm, clearSiparisForm, closeSiparisFormWithoutCheck,
//   setupYeniKartEventListeners, debugButonlar
// ============================================================================

// Mevcut formları kullanarak sipariş formu aç
function openSiparisForm(kartTuru, organizasyonId, organizasyonData, isEditMode = false, siparisVerileri = null, orderId = null, kartSayacBilgileri = null) {
    // Dinamik overlay ve container oluştur - overlay'i silme, sadece container'ı yenile
    let overlay = document.querySelector('.overlay-yeni-siparis-container');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'overlay-yeni-siparis-container';
        overlay.style.display = 'none';
        // Z-index CSS'de tanımlı (.overlay-yeni-siparis-container)
        document.body.appendChild(overlay);

    }
    
    // Mevcut container'ı tamamen sil ve yeniden oluştur
    let existingContainer = overlay.querySelector('.yeni-siparis-container');
    if (existingContainer) {
        existingContainer.remove();
    }
    let yeniSiparisContainer = document.createElement('div');
    yeniSiparisContainer.className = 'yeni-siparis-container';
    yeniSiparisContainer.style.display = 'none';
    
    overlay.appendChild(yeniSiparisContainer);
    
    // Overlay'i göster
    overlay.style.display = 'flex';
    
    // Scroll pozisyonunu sıfırla (form her açıldığında en üstten başlamalı)
    overlay.scrollTop = 0;
    
    // Yeni sipariş container'ını göster
    yeniSiparisContainer.style.display = 'block';
    
    // Dinamik form sistemi kullan - targetContainer kontrolü yok!
    if (typeof window !== 'undefined' && window.renderSiparisForm) {
        // Kart türünü doğru formata çevir
        let formType = kartTuru;
        if (kartTuru === 'Araç Süsleme') {
            formType = 'aracSusleme';
        } else if (kartTuru === 'Özel Sipariş') {
            formType = 'ozelSiparis';
        } else if (kartTuru === 'Özel Gün') {
            formType = 'ozelGun';
        } else if (kartTuru === 'Organizasyon Kartı' || kartTuru === 'Düğün' || kartTuru === 'Nişan' || kartTuru === 'Sünnet') {
            formType = 'organizasyon';
        }
        // Dinamik form oluştur
        window.renderSiparisForm(formType, yeniSiparisContainer);
        
        // Form render edildikten sonra file input'ları temizle (sadece yeni form için, edit modunda değil)
        // Not: container içinde henüz edit mode set edilmemiş olabilir, bu yüzden form render sonrası kontrol et
        setTimeout(() => {
            const hasEditMode = yeniSiparisContainer.querySelector('[data-edit-mode="true"]');
            if (!hasEditMode) {
                // Sadece yeni form için temizle
            }
        }, 0);
        
        // Şimdilik tüm formlar için dosya temizleme işlemini kapatıyoruz
        if (false) {
            setTimeout(() => {
                clearFileInputsInForm(yeniSiparisContainer);
            }, 100);
            
            // Daha agresif temizleme - birden fazla kez
            setTimeout(() => {
                clearFileInputsInForm(yeniSiparisContainer);
            }, 300);
            
            setTimeout(() => {
                clearFileInputsInForm(yeniSiparisContainer);
            }, 500);
        }
        
        // Form oluşturulduktan sonra targetContainer'ı bul
        let actualTargetContainer = null;
        switch(kartTuru) {
            case 'Organizasyon':
            case 'Düğün':
            case 'Nişan':
            case 'Sünnet':
                actualTargetContainer = yeniSiparisContainer.querySelector('.container-organizasyon');
                break;
            case 'Araç Süsleme':
                actualTargetContainer = yeniSiparisContainer.querySelector('.container-aracsusleme');
                break;
            case 'Özel Sipariş':
                actualTargetContainer = yeniSiparisContainer.querySelector('.container-ozelsiparis');
                break;
            case 'Özel Gün':
                actualTargetContainer = yeniSiparisContainer.querySelector('.container-ozelgun');
                break;
            default:
                actualTargetContainer = yeniSiparisContainer.querySelector('.container-organizasyon');
        }
        
        if (actualTargetContainer) {
            // Organizasyon bilgilerini doldur - kartSayacBilgileri varsa kullan, yoksa null ile devam et
            if (!kartSayacBilgileri && typeof window.getOrganizasyonKartSayacBilgileri === 'function') {
                kartSayacBilgileri = window.getOrganizasyonKartSayacBilgileri(organizasyonId);
            }
            // Hemen doldur - asenkron bekleme yok
            fillOrganizasyonBilgileri(actualTargetContainer, organizasyonData, kartTuru, kartSayacBilgileri);
            
            // Eğer fonksiyon yüklenmemişse, arka planda yüklenince tekrar doldur
            if (!kartSayacBilgileri && typeof window.getOrganizasyonKartSayacBilgileri !== 'function') {
                const waitForFunction = (attempts = 0) => {
                    if (typeof window.getOrganizasyonKartSayacBilgileri === 'function') {
                        const updatedKartSayacBilgileri = window.getOrganizasyonKartSayacBilgileri(organizasyonId);
                        // Sadece sayaç bilgilerini güncelle (form zaten doldurulmuş)
                        if (updatedKartSayacBilgileri) {
                            // Sayaç bilgilerini güncelle
                            const sayacElements = actualTargetContainer.querySelectorAll('[data-sayac-bilgisi]');
                            // Gerekirse burada sayaç bilgilerini güncelleyebilirsiniz
                        }
                    } else if (attempts < 20) {
                        setTimeout(() => waitForFunction(attempts + 1), 100);
                    }
                };
                waitForFunction();
            }
        
        // Sipariş formunda etiketleri yükle - grup_id'ye göre filtrele
        setTimeout(() => {
            let grupId = null;
            if (actualTargetContainer.classList.contains('container-organizasyon')) {
                grupId = 1; // Organizasyon
            } else if (actualTargetContainer.classList.contains('container-ozelgun')) {
                grupId = 2; // Özel Gün
            } else if (actualTargetContainer.classList.contains('container-ozelsiparis')) {
                grupId = 3; // Özel Sipariş
            } else if (actualTargetContainer.classList.contains('container-aracsusleme')) {
                grupId = 4; // Araç Süsleme
            }
            
            // Etiketleri yükle
            if (typeof loadOrganizasyonTurleriToRadioButtons === 'function') {
                loadOrganizasyonTurleriToRadioButtons(null, grupId);
            }
            if (typeof loadOrganizasyonEtiketleriToRadioButtons === 'function') {
                loadOrganizasyonEtiketleriToRadioButtons(null, grupId);
            }
        }, 300); // Form render edildikten sonra
        
        // Lightbox event listener'larını yenile
        if (typeof refreshGalleryImageEvents === 'function') {
            setTimeout(() => refreshGalleryImageEvents(), 300);
        }
        
        // Araç süsleme formu için özel doldurma (sadece düzenleme modunda)
        if (kartTuru === 'Araç Süsleme' && isEditMode) {
            // Form yüklendikten sonra doldur - global sipariş verilerini kullan
            setTimeout(() => {
                const globalSiparisVerileri = window.tumSiparisVerileri || siparisVerileri;
                if (globalSiparisVerileri) {
                    fillAracSuslemeKartForm(actualTargetContainer, globalSiparisVerileri, organizasyonId);
                } else {
                    // Sadece düzenleme modunda uyarı ver (yeni form açılırken normal)
                    console.warn('⚠️ Araç süsleme formu için sipariş verileri bulunamadı (düzenleme modu)');
                }
            }, 1000);
        }
        
        // ✅ REVIZE-17: Ürün fiyatı input'unu disabled yap (değiştirilemez)
        setTimeout(() => {
            const urunFiyatInput = actualTargetContainer.querySelector('#urunfiyat');
            if (urunFiyatInput) {
                urunFiyatInput.disabled = true;
                // Disabled görünümü için CSS class ekle (isteğe bağlı)
                urunFiyatInput.classList.add('disabled-input');
            }
        }, 100);
        
        // Form event listener'larını kur (asenkron - form açıldıktan sonra)
        // ★★★ KRİTİK: setupSiparisFormEventListeners fonksiyonunun yüklenmesini bekle
        setTimeout(() => {
            if (typeof window.setupSiparisFormEventListeners === 'function') {
                console.log('✅ setupSiparisFormEventListeners çağrılıyor...');
                window.setupSiparisFormEventListeners(actualTargetContainer, organizasyonId);
            } else if (typeof setupSiparisFormEventListeners === 'function') {
                console.log('✅ setupSiparisFormEventListeners çağrılıyor...');
                setupSiparisFormEventListeners(actualTargetContainer, organizasyonId);
            } else {
                // Fonksiyon henüz yüklenmemiş, bekle veya manuel kur
                const waitForFunction = (attempts = 0) => {
                    if (typeof window.setupSiparisFormEventListeners === 'function') {
                        console.log('✅ setupSiparisFormEventListeners çağrılıyor (bekleme sonrası)...');
                        window.setupSiparisFormEventListeners(actualTargetContainer, organizasyonId);
                    } else if (typeof setupSiparisFormEventListeners === 'function') {
                        console.log('✅ setupSiparisFormEventListeners çağrılıyor (bekleme sonrası)...');
                        setupSiparisFormEventListeners(actualTargetContainer, organizasyonId);
                    } else if (attempts < 50) {
                        setTimeout(() => waitForFunction(attempts + 1), 100);
                    } else {
                        console.warn('⚠️ setupSiparisFormEventListeners bulunamadı, manuel event listener kuruluyor...');
                        // Timeout - manuel event listener kur
                        setupManualFormEventListeners(actualTargetContainer);
                    }
                };
                waitForFunction();
            }
        }, 300);
        
        // Manuel event listener kurma fonksiyonu (fallback)
        function setupManualFormEventListeners(container) {
            const overlay = document.querySelector('.overlay-yeni-siparis-container');
            
            // Vazgeç butonları (container içinde)
            container.addEventListener('click', (e) => {
                if (e.target.closest('.btn-vazgec, .btn-vazgeç')) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof window.closeSiparisForm === 'function') {
                        window.closeSiparisForm();
                    } else if (typeof closeSiparisForm === 'function') {
                        closeSiparisForm();
                    }
                }
            });
            
            // Kapat butonu (overlay seviyesinde)
            if (overlay) {
                overlay.addEventListener('click', (e) => {
                    if (e.target.closest('.btn-close-form, .icon-btn-kapat, .close-form')) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (typeof window.closeSiparisForm === 'function') {
                            window.closeSiparisForm();
                        } else if (typeof closeSiparisForm === 'function') {
                            closeSiparisForm();
                        }
                    }
                });
            }
        }
        
        // Hemen manuel event listener'ları da kur (güvenlik için)
        setupManualFormEventListeners(actualTargetContainer);
        
        // Form değişiklik takibini başlat
        if (window.formChangeTracker) {
            // Form container'a benzersiz ID ata
            const formId = `siparis-form-${Date.now()}`;
            actualTargetContainer.setAttribute('data-form-id', formId);
            // Önce varsa eski takibi temizle
            window.formChangeTracker.untrackForm(formId);
            
            // Yeni takibi başlat
            window.formChangeTracker.trackForm(actualTargetContainer);
        } else {
            // formChangeTracker bulunamadı, sessizce devam et
        }
        
        // Düzenleme modu ise form alanlarını doldur
        if (isEditMode && siparisVerileri) {
            // Container'a edit mode attribute'larını ekle
            actualTargetContainer.setAttribute('data-edit-mode', 'true');
            actualTargetContainer.setAttribute('data-order-id', orderId);
            actualTargetContainer.setAttribute('data-organizasyon-id', organizasyonId);
            
            // Seçili dosya bilgisini de ekle
            if (siparisVerileri.secilen_urun_yazi_dosyasi) {
                actualTargetContainer.setAttribute('data-secilen-urun-yazi-dosyasi', siparisVerileri.secilen_urun_yazi_dosyasi);
            }
            
            // fillSiparisFormFields çağrısı kaldırıldı - 800ms sonra çağrılacak
            
            // Profil resmini yükle (form doldurulduktan sonra, birden fazla deneme)
            // ★★★ KRİTİK: loadFormProfilResmi fonksiyonunun yüklenmesini bekle
            const loadProfilResmi = (delay) => {
                setTimeout(() => {
                    if (typeof window.loadFormProfilResmi === 'function') {
                        window.loadFormProfilResmi(actualTargetContainer);
                    } else if (typeof loadFormProfilResmi === 'function') {
                        loadFormProfilResmi(actualTargetContainer);
                    }
                }, delay);
            };
            loadProfilResmi(200);
            loadProfilResmi(600);
            loadProfilResmi(1200);
            
            // Form doldurulduktan SONRA mask'ları kur ki değerler düzgün görünsün
            if (typeof setupFormMasks === 'function') setupFormMasks(actualTargetContainer);
            
            // Form başlığını güncelle
            const formTitle = actualTargetContainer.closest('.yeni-siparis-container').querySelector('.baslik');
            if (formTitle) {
                formTitle.textContent = 'Sipariş Düzenle';
            }
            
            // Butonu GÜNCELLE yap
            const kaydetBtn = actualTargetContainer.querySelector('.btn-kaydet, .btn-siparis-ekle');
            if (kaydetBtn) {
                kaydetBtn.textContent = 'GÜNCELLE';
            }
            
        } else {
            // Yeni ekleme modu - organizasyon ID'yi ekle
            actualTargetContainer.setAttribute('data-organizasyon-id', organizasyonId);
            actualTargetContainer.removeAttribute('data-edit-mode');
            actualTargetContainer.removeAttribute('data-order-id');
            
            // Profil resmini yükle (template render edildikten sonra, birden fazla deneme)
            // ★★★ KRİTİK: loadFormProfilResmi fonksiyonunun yüklenmesini bekle
            const loadProfilResmi = (delay) => {
                setTimeout(() => {
                    if (typeof window.loadFormProfilResmi === 'function') {
                        window.loadFormProfilResmi(actualTargetContainer);
                    } else if (typeof loadFormProfilResmi === 'function') {
                        loadFormProfilResmi(actualTargetContainer);
                    }
                }, delay);
            };
            loadProfilResmi(200);
            loadProfilResmi(600);
            loadProfilResmi(1200);
            
            // Yeni sipariş modunda da mask'ları kur
            if (typeof setupFormMasks === 'function') setupFormMasks(actualTargetContainer);
            
            // ℹ️ NOT: Tarih ve saat input'ları artık renderSiparisForm fonksiyonunda otomatik doldurulmaktadır
            // Butonu SİPARİŞ EKLE / KAYDET yap
            const kaydetBtn = actualTargetContainer.querySelector('.btn-kaydet, .btn-siparis-ekle');
            if (kaydetBtn) {
                // Buton metni template'de zaten doğru (SİPARİŞ EKLE veya KAYDET)
                kaydetBtn.removeAttribute('data-edit-mode');
            }
        }
        
        // Form validasyonunu kur (HTML5 native validasyon için)
        setTimeout(() => {
            const form = actualTargetContainer.closest('form') || actualTargetContainer.querySelector('form');
            if (form && typeof setupFormValidasyon === 'function') {
                setupFormValidasyon(form);
            }
        }, 100);
        
        // Müşteri ve ürün dropdown'larını güncelle - clickdropdown.js'den sonra çalışsın
        setTimeout(() => {
            // Radio button ID'lerini unique yap (duplicate ID sorunu)
            const timestamp = Date.now();
            const radioButtons = actualTargetContainer.querySelectorAll('input[type="radio"][id^="ut-"]');
            radioButtons.forEach((radio, index) => {
                const oldId = radio.id;
                const newId = `${oldId}-${timestamp}-${index}`;
                const label = actualTargetContainer.querySelector(`label[for="${oldId}"]`);
                
                radio.id = newId;
                if (label) label.setAttribute('for', newId);
            });
            
            // ★★★ KRİTİK: Önce dropdown setup fonksiyonlarını çağır (ürün listesi yüklenmesi için)
            if (typeof setupMusteriDropdownForContainer === 'function') {
                console.log('✅ setupMusteriDropdownForContainer çağrılıyor...');
                setupMusteriDropdownForContainer(actualTargetContainer);
            }
            if (typeof setupUrunDropdownForContainer === 'function') {
                console.log('✅ setupUrunDropdownForContainer çağrılıyor...');
                setupUrunDropdownForContainer(actualTargetContainer);
                
                // ★★★ KRİTİK: setupUrunDropdownForContainer çağrıldıktan sonra urunVerileriYuklendi event'ini tetikle
                // Eğer urunVerileri zaten yüklüyse, dropdown'ları hemen doldur
                // Birden fazla kez tetikle (ürün listesi yüklenene kadar)
                let urunEventAttempts = 0;
                const urunEventInterval = setInterval(() => {
                    urunEventAttempts++;
                    if (typeof window.urunVerileri !== 'undefined' && window.urunVerileri && Object.keys(window.urunVerileri).length > 0) {
                        console.log('✅ urunVerileri mevcut, urunVerileriYuklendi event\'i tetikleniyor...', Object.keys(window.urunVerileri).length, 'ürün');
                        if (typeof window.dispatchEvent === 'function') {
                            window.dispatchEvent(new CustomEvent('urunVerileriYuklendi'));
                        }
                        clearInterval(urunEventInterval);
                    } else if (urunEventAttempts >= 30) {
                        console.warn('⚠️ urunVerileri henüz yüklenmemiş (30 deneme sonrası)');
                        clearInterval(urunEventInterval);
                    }
                }, 200);
            }
            if (typeof setupPartnerDropdownForContainer === 'function') {
                setupPartnerDropdownForContainer(actualTargetContainer);
            }
            if (typeof setupPartnerSiparisiCheckboxForContainer === 'function') {
                setupPartnerSiparisiCheckboxForContainer(actualTargetContainer);
            }
            
            // Müşteri ve ürün dropdown'larını güncelle (tüm sayfadaki dropdown'ları günceller)
            // ★★★ KRİTİK: updateMusteriDropdowns ve updateUrunDropdowns fonksiyonlarının yüklenmesini bekle
            const updateDropdowns = () => {
                if (typeof window.updateMusteriDropdowns === 'function') {
                    window.updateMusteriDropdowns();
                } else if (typeof updateMusteriDropdowns === 'function') {
                    updateMusteriDropdowns();
                }
                
                if (typeof window.updateUrunDropdowns === 'function') {
                    console.log('✅ updateUrunDropdowns çağrılıyor...');
                    window.updateUrunDropdowns();
                } else if (typeof updateUrunDropdowns === 'function') {
                    console.log('✅ updateUrunDropdowns çağrılıyor...');
                    updateUrunDropdowns();
                }
            };
            
            // İlk güncelleme - hemen
            updateDropdowns();
            
            // İkinci güncelleme - DOM'a eklendikten sonra (200ms sonra)
            setTimeout(() => {
                console.log('✅ İkinci dropdown güncelleme çağrılıyor...');
                updateDropdowns();
                
                // urunVerileriYuklendi event'ini tetikle (eğer ürün verileri yüklüyse)
                if (typeof window.urunVerileri !== 'undefined' && window.urunVerileri && Object.keys(window.urunVerileri).length > 0) {
                    console.log('✅ urunVerileriYuklendi event\'i tetikleniyor...');
                    if (typeof window.dispatchEvent === 'function') {
                        window.dispatchEvent(new CustomEvent('urunVerileriYuklendi'));
                    }
                }
            }, 200);
            
            // İkinci güncelleme - DOM'a eklendikten sonra (200ms sonra)
            setTimeout(() => {
                updateDropdowns();
            }, 200);
            
            // Yeni oluşturulan genel dropdown'ları (il-ilçe-mahalle) başlat
            // ★★★ KRİTİK: setupGenelAcilirListe fonksiyonunun yüklenmesini bekle
            if (typeof window.setupGenelAcilirListe === 'function') {
                window.setupGenelAcilirListe();
            } else if (typeof setupGenelAcilirListe === 'function') {
                setupGenelAcilirListe();
            } else {
                // Fonksiyon henüz yüklenmemiş, bekle
                const waitForSetupGenelAcilirListe = (attempts = 0) => {
                    if (typeof window.setupGenelAcilirListe === 'function') {
                        window.setupGenelAcilirListe();
                    } else if (typeof setupGenelAcilirListe === 'function') {
                        setupGenelAcilirListe();
                    } else if (attempts < 30) {
                        setTimeout(() => waitForSetupGenelAcilirListe(attempts + 1), 100);
                    } else {
                        console.warn('⚠️ setupGenelAcilirListe yüklenemedi (timeout)');
                    }
                };
                waitForSetupGenelAcilirListe();
            }
            
            // Ürün dosya dropdown'larını kur (container scope'unda)
            if (typeof setupUrunDosyaDropdowns === 'function') setupUrunDosyaDropdowns(actualTargetContainer);
            
            // "+YENİ TÜR EKLE" butonuna event listener ekle
            const yeniTurBtn = actualTargetContainer.querySelector('.btn-yeni-tur');
            if (yeniTurBtn) {
                yeniTurBtn.addEventListener('click', async () => {
                    await showYeniTurPopup();
                });
            }
            
            // "+YENİ ETİKET EKLE" butonuna event listener ekle
            const yeniEtiketBtn = actualTargetContainer.querySelector('.btn-yeni-etiket');
            if (yeniEtiketBtn) {
                yeniEtiketBtn.addEventListener('click', async () => {
                    await showYeniEtiketPopup();
                });
            }
        }, 500);
        
        // Düzenleme modunda form alanlarını doldur
        if (isEditMode && orderId && siparisVerileri) {
            // ★★★ KRİTİK: fillSiparisFormFields fonksiyonunun yüklenmesini bekle
            const fillFormFields = async () => {
                // Fonksiyon yüklenene kadar bekle
                const waitForFunction = async (attempts = 0) => {
                    if (typeof window.fillSiparisFormFields === 'function') {
                        await window.fillSiparisFormFields(actualTargetContainer, siparisVerileri, orderId, organizasyonData);
                        
                        // Form doldurulduktan SONRA başlangıç değerlerini güncelle
                        if (window.formChangeTracker) {
                            const formId = actualTargetContainer.getAttribute('data-form-id');
                            if (formId) {
                                setTimeout(() => {
                                    window.formChangeTracker.resetInitialValues(formId);
                                }, 100);
                            }
                        }
                    } else if (typeof fillSiparisFormFields === 'function') {
                        await fillSiparisFormFields(actualTargetContainer, siparisVerileri, orderId, organizasyonData);
                        
                        // Form doldurulduktan SONRA başlangıç değerlerini güncelle
                        if (window.formChangeTracker) {
                            const formId = actualTargetContainer.getAttribute('data-form-id');
                            if (formId) {
                                setTimeout(() => {
                                    window.formChangeTracker.resetInitialValues(formId);
                                }, 100);
                            }
                        }
                    } else if (attempts < 50) {
                        setTimeout(() => waitForFunction(attempts + 1), 100);
                    } else {
                        console.error('❌ fillSiparisFormFields fonksiyonu yüklenemedi (timeout)');
                    }
                };
                await waitForFunction();
            };
            
            // Form render edildikten sonra doldur - daha uzun bekleme süresi (ürün listesi yüklenmesi için)
            // ★★★ KRİTİK: setupUrunDropdownForContainer ve updateUrunDropdowns çalıştıktan sonra doldur
            setTimeout(() => {
                console.log('🔄 Form doldurma işlemi başlatılıyor...');
                fillFormFields();
            }, 1200);
        }
        
    } else {
        console.warn('⚠️ Oluşturulan form container bulunamadı');
    }
        
    } else {
        console.warn('⚠️ renderSiparisForm fonksiyonu bulunamadı, bekleniyor...');
        // renderSiparisForm yüklenene kadar bekle (max 5 saniye)
        let attempts = 0;
        const maxAttempts = 50; // 50 * 100ms = 5 saniye
        const checkInterval = setInterval(() => {
            attempts++;
            if (typeof window.renderSiparisForm === 'function') {
                clearInterval(checkInterval);
                // Formu tekrar aç
                openSiparisForm(kartTuru, organizasyonId, organizasyonData, isEditMode, siparisVerileri, orderId, kartSayacBilgileri);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.error('❌ renderSiparisForm fonksiyonu yüklenemedi');
                if (typeof createToast === 'function') {
                    createToast('error', 'Form yüklenemedi. Lütfen sayfayı yenileyin.');
                }
            }
        }, 100);
    }
}

// Organizasyon bilgilerini form alanlarına doldur
function fillOrganizasyonBilgileri(container, organizasyonData, kartTuru = null, kartSayacBilgileri = null) {
    if (!organizasyonData) {
        console.warn('⚠️ Organizasyon verisi boş, doldurma atlanıyor.');
        return;
    }
    
    // Kart türünü güncelle
    const orgTur = container.querySelector('.org-tur');
    if (orgTur && organizasyonData.kart_turu) {
        orgTur.textContent = organizasyonData.kart_turu;
    }
    
    // Kart etiketini güncelle
    const kartEtiketEl = container.querySelector('.org-turu-band .left .kart-etiket');
    if (kartEtiketEl && organizasyonData.kart_etiket) {
        // Türkçe karakter desteği için toLocaleUpperCase kullan (büyük "İ" için)
        kartEtiketEl.textContent = organizasyonData.kart_etiket.toLocaleUpperCase('tr-TR');
    }
    
    // Konum alanını kart türüne göre güncelle
    const konum = container.querySelector('.konum');
    if (konum) {
        if (kartTuru === 'Özel Gün') {
            // Özel Gün kartlarında organizasyon_alt_tur kullan
            if (organizasyonData.alt_tur) {
                konum.textContent = organizasyonData.alt_tur;
            }
        } else if (organizasyonData.organizasyon_teslimat_konumu) {
            // Teslimat konumu varsa onu göster
            konum.textContent = organizasyonData.organizasyon_teslimat_konumu;
        } else if (organizasyonData.mahalle) {
            // Mahalle ID'sini mahalle ismine dönüştür
            let mahalle = organizasyonData.mahalle;
            if (typeof mahalle === 'string' && mahalle.includes('-')) {
                mahalle = convertMahalleIdToName(mahalle);
            }
            konum.textContent = mahalle;
        }
    }
    
    // Adres bilgisini güncelle - teslimat konumu varsa mahalle bilgisini önüne ekle
    const acikAdres = container.querySelector('.acik-adres');
    if (acikAdres) {
        let acikAdresText = organizasyonData.adres || organizasyonData.acik_adres || '';
        
        // Teslimat konumu varsa mahalle bilgisini önüne ekle
        if (organizasyonData.organizasyon_teslimat_konumu && organizasyonData.mahalle && acikAdresText) {
            let mahalleAdi = organizasyonData.mahalle;
            if (typeof mahalleAdi === 'string' && mahalleAdi.includes('-')) {
                mahalleAdi = convertMahalleIdToName(mahalleAdi);
            }
            acikAdresText = `${mahalleAdi}, ${acikAdresText}`;
        }
        
        acikAdres.textContent = acikAdresText;
    }
    
    // Organizasyon sahibi bilgilerini güncelle
    const teslimKisisi = container.querySelector('.teslim-kisisi');
    if (teslimKisisi && organizasyonData.organizasyon_sahibi) {
        teslimKisisi.textContent = organizasyonData.organizasyon_sahibi;
    }
    
    const teslimKisisiTelefon = container.querySelector('.teslim-kisisi-telefon a');
    if (teslimKisisiTelefon && organizasyonData.organizasyon_sahibi_telefon) {
        // Telefon numarasını formatla (+90 (XXX) XXX XX XX)
        const phoneRaw = organizasyonData.organizasyon_sahibi_telefon;
        const formattedPhone = typeof window.formatPhoneNumber === 'function' 
            ? window.formatPhoneNumber(phoneRaw) 
            : phoneRaw;
        teslimKisisiTelefon.textContent = formattedPhone;
        // Tel linki için normalize edilmiş telefon (905066593545 formatı)
        const phoneDigits = phoneRaw.replace(/\D/g, '');
        let phoneHref = '#';
        if (phoneDigits.length === 12 && phoneDigits.startsWith('90')) {
            phoneHref = `tel:+${phoneDigits}`;
        } else if (phoneDigits.length >= 10) {
            const normalized = phoneDigits.length === 10 ? '90' + phoneDigits : (phoneDigits.length === 11 && phoneDigits.startsWith('0') ? '90' + phoneDigits.substring(1) : '90' + phoneDigits.substring(phoneDigits.length - 10));
            phoneHref = `tel:+${normalized}`;
        }
        teslimKisisiTelefon.href = phoneHref;
    }
    
    // Teslim tarihini güncelle - formlardaki .teslim-zaman .tarih alanlarına
    const tarih = container.querySelector('.teslim-zaman .tarih');
    if (tarih && organizasyonData.organizasyon_teslim_tarih) {
        tarih.textContent = formatDate(organizasyonData.organizasyon_teslim_tarih);

    } else if (tarih && organizasyonData.teslim_tarihi) {
        // Fallback: eski alan adı
        tarih.textContent = formatDate(organizasyonData.teslim_tarihi);

    }
    
    // Teslim saatini güncelle
    const saat = container.querySelector('.teslim-zaman .saat');
    if (saat && organizasyonData.teslim_saati) {
        saat.textContent = `Saat ${organizasyonData.teslim_saati}`;
    }
    
    // Gizli organizasyon ID'sini ayarla
    const hiddenOrgIdInput = container.querySelector('input[name="organizasyon-id"]');
    if (hiddenOrgIdInput) {
        hiddenOrgIdInput.value = organizasyonData.id;
    }
    
    // Davetiye görselini güncelle
    const gorselImg = container.querySelector('[data-dynamic-gorsel]');
    if (gorselImg) {
        // Önce organizasyon_davetiye_gorsel kontrol et, yoksa kart_gorsel kontrol et
        const davetiyeGorsel = organizasyonData.organizasyon_davetiye_gorsel || organizasyonData.kart_gorsel;
        
        if (davetiyeGorsel) {
            const backendBase = window.getFloovonBackendBase ? window.getFloovonBackendBase() : (window.BACKEND_BASE_URL || '');
            // Path helper kullan - çift path sorununu önler
            const gorselPath = window.getFloovonUploadUrl ? window.getFloovonUploadUrl(davetiyeGorsel) : `${backendBase}/uploads/${davetiyeGorsel}`;
            const kartGorseli = gorselImg.closest('.kart-gorseli');
            const placeholder = kartGorseli ? kartGorseli.querySelector('.gorsel-placeholder') : null;
            
            // Görsel yüklendiğinde has-image class'ını ekle ve placeholder'ı gizle
            const showImage = function() {
                if (kartGorseli) {
                    kartGorseli.classList.add('has-image');
                    if (placeholder) {
                        placeholder.style.display = 'none';
                    }
                }
            };
            
            // Görsel yüklenirken hata olursa
            gorselImg.onerror = function() {
                console.error('❌ Kart görseli yüklenemedi:', gorselPath);
                if (kartGorseli) {
                    kartGorseli.classList.remove('has-image');
                    if (placeholder) {
                        placeholder.style.display = 'flex';
                    }
                }
            };
            
            // Görsel yüklendiğinde class ekle
            gorselImg.onload = showImage;
            
            // Görseli set et
            gorselImg.src = gorselPath;
            // Agresif kontrol: görseli set ettikten sonra kısa aralıklarla kontrol et
            const checkImageLoaded = function() {
                if (gorselImg.complete && gorselImg.naturalHeight > 0) {
                    showImage();
                    return true;
                }
                return false;
            };
            
            // SetTimeout ile görseli set ettikten sonra kontrol et
            setTimeout(function() {
                if (checkImageLoaded()) {
                    return; // Görsel zaten yüklü, işlem tamamlandı
                }
                
                // Hala yüklenmediyse, kısa aralıklarla kontrol et (maksimum 10 kez, toplam 1 saniye)
                let checkCount = 0;
                const maxChecks = 10;
                const checkInterval = setInterval(function() {
                    checkCount++;
                    if (checkImageLoaded() || checkCount >= maxChecks) {
                        clearInterval(checkInterval);
                        if (checkCount >= maxChecks) {
                            console.warn('⚠️ Görsel yüklenemedi (timeout)');
                        }
                    }
                }, 100);
            }, 50); // 50ms sonra ilk kontrol
        } else {
            // Görseli güncellemeden bırak (template'deki sabit görsel gözüksün)
            // has-image class'ını kaldır ve placeholder'ı göster
            const kartGorseli = gorselImg.closest('.kart-gorseli');
            if (kartGorseli) {
                kartGorseli.classList.remove('has-image');
                const placeholder = kartGorseli.querySelector('.gorsel-placeholder');
                if (placeholder) {
                    placeholder.style.display = 'flex';
                }
            }
        }
    }
    
    const sayacSpan = container.querySelector('.toplam-siparis .siparis-sayisi');
    const maxSpan = container.querySelector('.toplam-siparis .max-siparis');
    if (sayacSpan && maxSpan) {
        let teslimEdilen = kartSayacBilgileri?.teslimEdilen;
        let toplam = kartSayacBilgileri?.toplam;

        if (typeof teslimEdilen === 'string') {
            teslimEdilen = Number(teslimEdilen);
        }
        if (typeof toplam === 'string') {
            toplam = Number(toplam);
        }

        if (teslimEdilen == null || Number.isNaN(teslimEdilen)) {
            teslimEdilen = 0;
        }

        if (toplam == null || Number.isNaN(toplam)) {
            const parsedToplam = organizasyonData?.toplam_siparis_sayisi != null
                ? Number(organizasyonData.toplam_siparis_sayisi)
                : null;
            toplam = Number.isNaN(parsedToplam) ? 0 : parsedToplam;
        }

        sayacSpan.textContent = teslimEdilen;
        maxSpan.textContent = toplam;
    }

    const partnerButon = container.querySelector('.btn-partner-siparis-ekle.partner-siparisler');
    const partnerSpan = partnerButon?.querySelector('.partner-siparis-sayisi');
    if (partnerSpan) {
        let partnerSayisi = kartSayacBilgileri?.partnerSayisi;
        if (typeof partnerSayisi === 'string') {
            partnerSayisi = Number(partnerSayisi);
        }

        if (partnerSayisi == null || Number.isNaN(partnerSayisi)) {
            const parsedPartner = organizasyonData?.partner_siparis_sayisi != null
                ? Number(organizasyonData.partner_siparis_sayisi)
                : null;
            partnerSayisi = Number.isNaN(parsedPartner) || parsedPartner == null ? 0 : parsedPartner;
        }

        partnerSpan.textContent = partnerSayisi;
    }
}

// Sipariş formunu kapat
function closeSiparisForm() {
    const overlay = document.querySelector('.overlay-yeni-siparis-container');
    const form = document.querySelector('.yeni-siparis-container');
    if (overlay && form) {
        // Form değişiklik kontrolü
        // ✅ Tüm form ID'lerini kontrol et, 'siparis-form' yerine gerçek ID'yi bul
        let hasChanges = false;
        let formId = null;
        
        if (window.formChangeTracker) {
            // Form içinde data-form-id attribute'u olan elementi bul
            // Önce container içinde ara
            const formElement = form.querySelector('.container[data-form-id]');
            
            // Bulunamazsa doğrudan form içinde ara
            const formElementAlt = !formElement ? form.querySelector('[data-form-id]') : formElement;
            
            if (formElementAlt) {
                formId = formElementAlt.getAttribute('data-form-id');
                hasChanges = window.formChangeTracker.hasChanges(formId);
            }
            
            // Eğer bulunamadıysa, tüm form ID'lerini kontrol et
            if (!hasChanges && formId === null) {
                // Tüm takip edilen formları kontrol et
                const allForms = window.formChangeTracker.getTrackedForms ? window.formChangeTracker.getTrackedForms() : [];
                for (const id of allForms) {
                    if (window.formChangeTracker.hasChanges(id)) {
                        hasChanges = true;
                        formId = id;
                        break;
                    }
                }
            }
        } else {
            // formChangeTracker bulunamadı, sessizce devam et
        }
        
        if (hasChanges && formId) {
            // Değişiklik var, onay al
            window.formChangeTracker.confirmBeforeClose(
                formId,
                async () => {
                    // Kullanıcı "Evet, Kaydet" dedi
                    // Formu kaydet
                    const container = document.querySelector('.yeni-siparis-container .container');
                    if (container) {
                        const organizasyonId = container.getAttribute('data-organizasyon-id');
                        const isEditMode = container.getAttribute('data-edit-mode') === 'true';
                        const orderId = container.getAttribute('data-order-id');
                        
                        // Kayıt işlemini başlat
                        const kayitBasarili = (typeof handleSiparisFormSubmit === 'function') ? await handleSiparisFormSubmit(container, organizasyonId, isEditMode, orderId) : false;
                        
                        // Eğer kayıt başarılı olmadıysa (validasyon hatası vb.), form açık kalmalı
                        // Form kapatma işlemi başarılı kayıt sonrası handleSiparisFormSubmit içinde yapılıyor
                    }
                },
                () => {
                    // Kullanıcı "Hayır, Kaydetme" dedi
                    // Formu kapat
                    closeSiparisFormWithoutCheck();
                }
            );
        } else {
            // Değişiklik yok, direkt kapat
            closeSiparisFormWithoutCheck();
        }
    }
}

// Form kaydetme fonksiyonu
async function kaydetSiparisForm() {
    const container = document.querySelector('.yeni-siparis-container .container');
    if (!container) {
        console.error('❌ Form container bulunamadı');
        return;
    }
    
    const organizasyonId = container.getAttribute('data-organizasyon-id');
    const isEditMode = container.getAttribute('data-edit-mode') === 'true';
    const orderId = container.getAttribute('data-order-id');
    // Form submit işleyicisini çağır
    if (typeof handleSiparisFormSubmit === 'function') await handleSiparisFormSubmit(container, organizasyonId, isEditMode, orderId);
}

// ESC tuşu ile form kapatma
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Açık olan formu kontrol et
        const overlay = document.querySelector('.overlay-yeni-siparis-container');
        if (overlay && overlay.style.display === 'flex') {
            // ESC tuşu ile formu kapat
            closeSiparisForm();
        }
    }
});

// File input için event listener'ları kur
function setupFileInputEvents(fileInput, uploadArea) {
    // ❌ DEVRE DIŞI: Global event delegation kullanıldığı için bu fonksiyon boş bırakıldı
    // Birden fazla event listener çakışmasını önlemek için

    return;
}

// Dosya yükleme işlemi (form-içi versiyon - ÖNEMLİ: Global handleFileUpload ile çakışmaması için _formHandleFileUpload olarak yeniden adlandırıldı)
function _formHandleFileUpload(fileInput, uploadArea) {
    const file = fileInput.files[0];
    if (!file) return;
    
    // Dosya bilgilerini göster
    const fileName = file.name;
    const fileSize = (file.size / 1024 / 1024).toFixed(2) + ' MB';
    
    const fileLabel = uploadArea.querySelector('.file-label');
    const removeButton = uploadArea.querySelector('.remove-button');
    const icon = uploadArea.querySelector('.icon-kart-dosya-yukle-alan');
    
    // Eğer orijinal text yoksa kaydet
    if (fileLabel && !fileLabel.getAttribute('data-original-text')) {
        fileLabel.setAttribute('data-original-text', fileLabel.textContent);
    }
    
    // Görsel dosyası ise önizleme göster
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const imgSrc = e.target.result;
            
            // Eğer kart görseli ise veya davetiye görseli ise tam önizleme göster
            const isDavetiyeGorseli = fileInput.name === 'davetiye-gorseli';
            if (uploadArea.classList.contains('kart-gorseli') || isDavetiyeGorseli) {
                // Mevcut önizlemeyi temizle
                const existingPreview = uploadArea.querySelector('.preview-container');
                if (existingPreview) {
                    existingPreview.remove();
                }
                
                // Yeni önizleme container'ı oluştur
                const previewContainer = document.createElement('div');
                previewContainer.className = 'preview-container kart-gorsel';
                previewContainer.setAttribute('data-lightbox-grup', 'resim');
                previewContainer.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 5px;
                    overflow: hidden;
                    cursor: pointer;
                `;
                
                const img = document.createElement('img');
                img.src = imgSrc;
                img.alt = 'Yüklenen görsel';
                img.style.cssText = `
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    border-radius: 5px;
                `;
                previewContainer.appendChild(img);
                uploadArea.appendChild(previewContainer);
                
                // Icon ve label'ı gizle
                if (icon) icon.style.display = 'none';
                if (fileLabel) fileLabel.style.display = 'none';
                
                // Upload area'ya pozisyon ekle
                uploadArea.style.position = 'relative';
                uploadArea.style.borderColor = 'transparent';
                uploadArea.style.borderStyle = 'solid';
                
                // Remove button'u göster ve konumlandır (sadece file input varsa)
                if (removeButton && uploadArea.querySelector('.file-input')) {
                    removeButton.style.cssText = 'position: absolute; top: 8px; right: 8px; background-color: var(--auto-color-4-50c71d); color: var(--white); border: none; border-radius: 3px; padding: 5px 10px; cursor: pointer; font-size: 12px; opacity: 0; transition: opacity 0.3s ease; z-index: 20; display: block;';
                    
                    // Hover efekti
                    const showButton = () => removeButton.style.opacity = '1';
                    const hideButton = () => removeButton.style.opacity = '0';
                    uploadArea.addEventListener('mouseenter', showButton);
                    uploadArea.addEventListener('mouseleave', hideButton);
                }
            } else {
                // Kompakt önizleme (küçük resim + dosya adı)
                const existingCompact = uploadArea.querySelector('.compact-preview-img');
                if (existingCompact) {
                    existingCompact.remove();
                }
                
                const compactImg = document.createElement('img');
                compactImg.className = 'compact-preview-img';
                compactImg.src = imgSrc;
                compactImg.alt = 'Yüklenen görsel';
                
                if (icon) {
                    icon.style.display = 'none';
                    uploadArea.insertBefore(compactImg, fileLabel);
                }
                
                // Dosya adını güncelle
                if (fileLabel) {
                    const truncatedName = formatFileNameShort(fileName, 30);
                    fileLabel.innerHTML = `Seçilen: <span style="word-break: break-all;">${truncatedName}</span>`;
                    fileLabel.style.display = '';
                }
                
                if (removeButton) {
                    removeButton.style.display = 'inline';
                }
            }
        };
        reader.readAsDataURL(file);
    } else {
        // Görsel değilse sadece dosya adını göster
        if (fileLabel) {
            const truncatedName = formatFileNameShort(fileName, 30);
            fileLabel.innerHTML = `Seçilen: <span style="word-break: break-all;">${truncatedName}</span>`;
            fileLabel.style.display = '';
        }
        if (removeButton) {
            removeButton.style.display = 'inline';
        }
    }
}

// Form içindeki file input'ları temizle (template render sonrası)
function clearFileInputsInForm(formContainer) {
    // Tüm file input'ları bul
    const allFileInputs = formContainer.querySelectorAll('input[type="file"]');
    allFileInputs.forEach((fileInput, index) => {
        // File input'u yeniden oluştur
        const newFileInput = fileInput.cloneNode(true);
        newFileInput.value = '';
        
        // Eski input'u yeni ile değiştir
        fileInput.parentNode.replaceChild(newFileInput, fileInput);
        
        // Upload area'yı bul
        const uploadArea = newFileInput.closest('.dosya-yukle-alan');
        if (uploadArea) {
            // setupFileInputEvents kaldırıldı - sadece setupFileUploadListeners kullanılıyor
            // setupFileInputEvents(newFileInput, uploadArea);
            
            // Dosya önizleme alanlarını temizle
            const previews = uploadArea.querySelectorAll('.file-preview, .image-preview');
            previews.forEach(preview => {
                preview.innerHTML = '';
                preview.style.display = 'none';
            });
            
            // Dosya bilgi alanlarını temizle
            const fileInfos = uploadArea.querySelectorAll('.file-info, .file-name');
            fileInfos.forEach(info => {
                info.textContent = '';
                info.style.display = 'none';
            });
            
            // Dosya yükleme metnini sıfırla
            const uploadTexts = uploadArea.querySelectorAll('.upload-text, .file-upload-text');
            uploadTexts.forEach(text => {
                text.textContent = 'Dosya seçmek için tıklayın veya sürükleyin';
            });
            
            // Drag over class'ını kaldır
            uploadArea.classList.remove('drag-over', 'dragover');
        }
    });
}

// Global erişim için window'a ekle
if (typeof window !== 'undefined') {
    window.clearFileInputsInForm = clearFileInputsInForm;
}

// Form alanlarını temizle
function clearSiparisForm() {
    const overlay = document.querySelector('.overlay-yeni-siparis-container');
    const form = document.querySelector('.yeni-siparis-container');
    
    if (overlay && form) {
        // Tüm input'ları temizle
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            if (input.type === 'radio' || input.type === 'checkbox') {
                input.checked = false;
            } else if (input.type === 'file') {
                input.value = '';
                // File input için özel temizleme
                if (input.files) {
                    input.files = null;
                }
            } else {
                input.value = '';
            }
        });
        
        // Radio button gruplarını temizle (özellikle ödeme yöntemi)
        const radioGroups = form.querySelectorAll('input[type="radio"]');
        radioGroups.forEach(radio => {
            radio.checked = false;
        });
        
        // Checkbox'ları temizle
        const checkboxes = form.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // Özel alanları temizle
        const containers = form.querySelectorAll('.container');
        containers.forEach(container => {
            // Müşteri seçimi temizle
            const musteriInputs = container.querySelectorAll('input[name*="musteri"], input[name*="siparis-veren"]');
            musteriInputs.forEach(input => {
                input.value = '';
            });
            
            // Ürün dosya dropdown'larını temizle
            const dropdowns = container.querySelectorAll('.musteri-urun-dosya-dropdown');
            dropdowns.forEach(dropdown => {
                const selectedFile = dropdown.querySelector('.selected-file');
                const fileCount = dropdown.querySelector('.file-count');
                if (selectedFile) {
                    selectedFile.textContent = 'Dosya seçin';
                    selectedFile.style.display = 'none';
                }
                if (fileCount) {
                    fileCount.textContent = '0';
                    fileCount.style.display = 'none';
                }
                
                // Hidden input'u temizle
                const hiddenInput = dropdown.querySelector('input[type="hidden"]');
                if (hiddenInput) {
                    hiddenInput.value = '';
                }
                
                // Dropdown'u kapat
                dropdown.classList.remove('open');
            });
            
            // Dosya yükleme alanlarını temizle
            const fileUploadAreas = container.querySelectorAll('.dosya-yukle-alan');
            fileUploadAreas.forEach(area => {
                const fileInput = area.querySelector('input[type="file"]');
                if (fileInput) {
                    // File input'u yeniden oluştur (güvenlik nedeniyle value değiştirilemez)
                    const newFileInput = fileInput.cloneNode(true);
                    newFileInput.value = '';
                    
                    // Eski input'u yeni ile değiştir
                    fileInput.parentNode.replaceChild(newFileInput, fileInput);
                    
                    // Yeni input için event listener'ları yeniden kur
                    setupFileInputEvents(newFileInput, area);
                }
                
                // Dosya önizleme alanlarını temizle
                const previews = area.querySelectorAll('.file-preview, .image-preview');
                previews.forEach(preview => {
                    preview.innerHTML = '';
                    preview.style.display = 'none';
                });
                
                // Dosya bilgi alanlarını temizle
                const fileInfos = area.querySelectorAll('.file-info, .file-name');
                fileInfos.forEach(info => {
                    info.textContent = '';
                    info.style.display = 'none';
                });
                
                // Dosya yükleme metnini sıfırla
                const uploadTexts = area.querySelectorAll('.upload-text, .file-upload-text');
                uploadTexts.forEach(text => {
                    text.textContent = 'Dosya seçmek için tıklayın veya sürükleyin';
                });
            });
            
            // Tarih ve saat alanlarını temizle
            const dateInputs = container.querySelectorAll('input[type="date"]');
            dateInputs.forEach(input => {
                input.value = '';
            });
            
            const timeInputs = container.querySelectorAll('input[type="time"]');
            timeInputs.forEach(input => {
                input.value = '';
            });
            
            // Açılır listeleri temizle
            const acilirListeler = container.querySelectorAll('.wrapper-acilirliste');
            acilirListeler.forEach(liste => {
                const selectedValue = liste.querySelector('.selected-value');
                if (selectedValue) {
                    selectedValue.textContent = liste.getAttribute('data-placeholder') || 'Seçin';
                }
                
                // Hidden input'u temizle
                const hiddenInput = liste.querySelector('input[type="hidden"]');
                if (hiddenInput) {
                    hiddenInput.value = '';
                }
            });
        });
        
        // Form değişikliklerini sıfırla
        if (window.formChangeTracker) {
            window.formChangeTracker.resetChanges('siparis-form');
        }
    }
}

// Form değişiklik kontrolü olmadan kapat
function closeSiparisFormWithoutCheck() {
    const overlay = document.querySelector('.overlay-yeni-siparis-container');
    const form = document.querySelector('.yeni-siparis-container');
    
    if (overlay && form) {
        // Form kapatılmadan önce, sipariş formu mu ve başarıyla kaydedildi mi kontrol et
        const container = form.querySelector('.container');
        const organizasyonId = container?.getAttribute('data-organizasyon-id');
        const isSiparisForm = container && (
            container.classList.contains('container-organizasyon') || 
            container.classList.contains('container-aracsusleme') || 
            container.classList.contains('container-ozelsiparis') || 
            container.classList.contains('container-ozelgun')
        );
        
        // Scroll pozisyonunu sıfırla (form kapandığında scroll en üste dönmeli)
        overlay.scrollTop = 0;
        
        overlay.style.display = 'none';
        form.style.display = 'none';
        
        // Form alanlarını temizle
        clearSiparisForm();
        
        // Eğer sipariş formu kapatıldıysa ve başarıyla kaydedildiyse event tetikle
        // (handleSiparisFormSubmit içinde zaten event tetikleniyor, burada sadece form kapatıldığını işaretle)
        if (isSiparisForm && form.dataset.submitted === 'true') {
            form.dataset.submitted = 'false';
        }
    }
}

// Yeni kart oluştur butonları için event listener'ları kur
function setupYeniKartEventListeners() {
    // Mevcut event listener'ları kaldır
    $('body').off('click', '.btn-yeni-kart-ekle');
    
    // Yeni event listener'ı kur
    $('body').on('click', '.btn-yeni-kart-ekle', function (e) {
        e.stopPropagation();
        const overlay = document.querySelector('.overlay-yeni-kart-container');
        const form = document.querySelector('.yeni-kart-container');
        
        if (!overlay || !form) {
            console.warn('⚠️ Yeni kart formu elementleri bulunamadı');
            createToast('error', 'Yeni kart formu bulunamadı!');
            return;
        }
        
        // Düzenleme modunu temizle (yeni kart oluşturma modu)
        resetKartFormEditMode();
        
        // Formu göster
        overlay.style.display = 'flex';
        form.style.display = 'block';
        
        // Default tab'ı aç
        const defaultTab = document.getElementById('defaultOpen');
        if (defaultTab) {
            defaultTab.click();
        }
        
        // Form validasyonunu yenile (eğer fonksiyon varsa)
        if (typeof refreshFormValidation === 'function') {
            refreshFormValidation();
        }
        
        // Dropdown'ları hemen başlat ve konum bilgilerini yükle
        // ★★★ KRİTİK: setupGenelAcilirListe fonksiyonunun yüklenmesini bekle
        if (typeof window.setupGenelAcilirListe === 'function') {
            window.setupGenelAcilirListe();
        } else if (typeof setupGenelAcilirListe === 'function') {
            setupGenelAcilirListe();
        } else {
            // Fonksiyon henüz yüklenmemiş, bekle
            const waitForSetupGenelAcilirListe = (attempts = 0) => {
                if (typeof window.setupGenelAcilirListe === 'function') {
                    window.setupGenelAcilirListe();
                } else if (typeof setupGenelAcilirListe === 'function') {
                    setupGenelAcilirListe();
                } else if (attempts < 30) {
                    setTimeout(() => waitForSetupGenelAcilirListe(attempts + 1), 100);
                } else {
                    console.warn('⚠️ setupGenelAcilirListe yüklenemedi (timeout)');
                }
            };
            waitForSetupGenelAcilirListe();
        }
        
        // İl dropdown'ını hemen yüklemeye başlat
        const ilWrapper = document.querySelector('#form-yeni-organizasyon-kart .wrapper-acilirliste[data-type="il"]');
        if (ilWrapper && typeof window.loadProvinceList === 'function') {
            window.loadProvinceList(ilWrapper);
        }
        
        // Konum ayarlarından İl ve İlçe'yi otomatik doldur
        // Direkt çağır - setTimeout gereksiz
        if (typeof otoDoldurKonumBilgileri === 'function') {
            otoDoldurKonumBilgileri();
        } else if (typeof window.otoDoldurKonumBilgileri === 'function') {
            window.otoDoldurKonumBilgileri();
        } else {
            console.error('❌ jQuery: otoDoldurKonumBilgileri fonksiyonu bulunamadı!');
        }
        
    });
    
}

// Debug: Butonları kontrol et
function debugButonlar() {
    // Sipariş kart butonları
    const siparisKartIconlar = document.querySelectorAll('.siparis-kart-icon');
    siparisKartIconlar.forEach((icon, index) => {
        const tooltip = icon.getAttribute('data-tooltip');
        const arsivle = icon.getAttribute('data-siparis-arsivle');
    });
    
    // Yeni sipariş ekle butonları
    const yeniSiparisButonlar = document.querySelectorAll('.btn-yeni-siparis-ekle');
    // Yeni kart oluştur butonları
    const yeniKartButonlar = document.querySelectorAll('.btn-yeni-kart-ekle');
}


// ============================================================================
// Window Exports
// ============================================================================
window.openSiparisForm = openSiparisForm;
window.fillOrganizasyonBilgileri = fillOrganizasyonBilgileri;
window.closeSiparisForm = closeSiparisForm;
window.kaydetSiparisForm = kaydetSiparisForm;
window.clearSiparisForm = clearSiparisForm;
window.closeSiparisFormWithoutCheck = closeSiparisFormWithoutCheck;
window.setupYeniKartEventListeners = setupYeniKartEventListeners;
window.debugButonlar = debugButonlar;
window.clearFileInputsInForm = clearFileInputsInForm;
