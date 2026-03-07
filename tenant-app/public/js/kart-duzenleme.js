/**
 * Kart Duzenleme Sistemi
 * script.js dosyasindan tasindi (2026-02-07)
 * - setupKartiDuzenleDelegated, editOrganizationCardWithData
 * - fillOrganizationEditForm, fillOrganizasyonKartForm
 * - fillOzelGunKartForm, fillOzelSiparisKartForm, fillAracSuslemeKartForm
 * - updateKartEtiketGorsel
 */
// #region Kart Menu Content - Kartı Düzenle
function setupKartiDuzenleDelegated() {
    document.body.addEventListener('click', async function (e) {
        const button = e.target.closest('.karti-duzenle');
        if (!button) return;

        const item = button.closest('.item');
        const overlay = document.querySelector('.overlay-yeni-kart-container');
        const formContainer = document.querySelector('.yeni-kart-container');
        const menu = button.closest('.kart-menu-content');

        // Menu'yu kapat
        if (menu) {
            menu.style.display = 'none';
        }

        if (!item || !overlay || !formContainer) {
            console.error('❌ Overlay veya form container bulunamadı!', {
                item: !!item,
                overlay: !!overlay,
                formContainer: !!formContainer
            });
            return;
        }

        // Overlay'i body'ye taşı (eğer değilse)
        if (overlay.parentElement !== document.body) {
            document.body.appendChild(overlay);
        }

        // Organizasyon ID'sini al
        const organizasyonId = item.getAttribute('data-organizasyon-id');
        if (!organizasyonId) {
            console.error('❌ Organizasyon ID bulunamadı');
            return;
        }

                // Ana kartın türünü belirle - 5 ORGANİZASYON TİPİ
                const anaKart = item.querySelector('.ana-kart');
                let formType = 'organizasyon-kart';
                
                if (anaKart) {
                    // 1. ÇİÇEK SEPETİ
                    if (anaKart.classList.contains('ciceksepeti-kart')) {
                        formType = 'ciceksepeti-kart';
                    }
                    // 2. ARAÇ SÜSLEME
                    else if (anaKart.classList.contains('aracsusleme')) {
                        formType = 'aracsusleme-kart';
                    }
                    // 3. ÖZEL SİPARİŞ
                    else if (anaKart.classList.contains('ozelsiparis')) {
                        formType = 'ozelsiparis-kart';
                    }
                    // 4. ÖZEL GÜN
                    else if (anaKart.classList.contains('ozelgun')) {
                        formType = 'ozelgun-kart';
                    }
                    // 5. ORGANİZASYON (Düğün, Nişan, Sünnet, vb.)
                    else {
                        formType = 'organizasyon-kart';
                    }
                }

        // ✅ ÖNEMLİ: Önce cache'e bak, varsa oradan al (anında açılır)
        let organizasyonData = null;
        let fromCache = false;
        
        if (window.organizasyonKartlariCache) {
            const cachedData = window.organizasyonKartlariCache.get(organizasyonId);
            if (cachedData && cachedData.detailCachedAt) {
                // Cache'de detay verileri var, kullan
                organizasyonData = cachedData;
                fromCache = true;
            }
        }
        
        // Cache'de yoksa backend'den çek
        if (!fromCache) {
            try {
                const response = await (window.floovonFetch || window.floovonFetchStandard || fetch)(`/api/organizasyon-kartlar/${organizasyonId}`);
                
                let result;
                if (window.floovonFetch || window.floovonFetchStandard) {
                    // floovonFetch zaten JSON parse ediyor
                    if (!response || !response.success) {
                        console.warn('⚠️ Organizasyon verisi çekilemedi, varsayılan form açılıyor');
                        // Hata durumunda varsayılan formu aç
                        overlay.style.display = 'block';
                        formContainer.style.display = 'block';
                        const targetTabBtn = document.querySelector(`.tab button[onclick*='${formType}']`);
                        targetTabBtn?.click();
                        return;
                    }
                    result = response;
                } else {
                    if (!response.ok) {
                        console.warn('⚠️ Organizasyon verisi çekilemedi, varsayılan form açılıyor');
                        // Hata durumunda varsayılan formu aç
                        overlay.style.display = 'block';
                        formContainer.style.display = 'block';
                        const targetTabBtn = document.querySelector(`.tab button[onclick*='${formType}']`);
                        targetTabBtn?.click();
                        return;
                    }
                    result = await response.json();
                    if (!result.success) {
                        console.warn('⚠️ Organizasyon verisi başarısız, varsayılan form açılıyor');
                        // Hata durumunda varsayılan formu aç
                        overlay.style.display = 'block';
                        formContainer.style.display = 'block';
                        const targetTabBtn = document.querySelector(`.tab button[onclick*='${formType}']`);
                        targetTabBtn?.click();
                        return;
                    }
                }
                
                organizasyonData = result.data;
                
                // Cache'e kaydet (bir sonraki açılışta anında yüklensin)
                if (window.organizasyonKartlariCache && organizasyonData) {
                    const cachedData = window.organizasyonKartlariCache.get(organizasyonId) || {};
                    window.organizasyonKartlariCache.set(organizasyonId, {
                        ...cachedData,
                        ...organizasyonData,
                        detailCachedAt: Date.now()
                    });
                }
            } catch (error) {
                console.error('❌ Organizasyon verileri alınırken hata:', error);
                // Hata durumunda varsayılan formu aç
                overlay.style.display = 'block';
                formContainer.style.display = 'block';
                const targetTabBtn = document.querySelector(`.tab button[onclick*='${formType}']`);
                targetTabBtn?.click();
                return;
            }
        }
        
        if (!organizasyonData) {
            console.warn('⚠️ Organizasyon verisi bulunamadı, varsayılan form açılıyor');
            // Veri yoksa varsayılan formu aç
            overlay.style.display = 'block';
            formContainer.style.display = 'block';
            const targetTabBtn = document.querySelector(`.tab button[onclick*='${formType}']`);
            targetTabBtn?.click();
            return;
        }
            // Formu aç - overlay ve form container'ı doğru şekilde göster
            if (overlay) {
                overlay.classList.remove('hidden');
                overlay.classList.add('show');
                overlay.style.display = 'flex';
            }
            if (formContainer) {
                formContainer.classList.remove('hidden');
                formContainer.classList.add('show');
                formContainer.style.display = 'block';
            }
            document.body.style.overflow = 'hidden';
            
            // Doğru tab'ı aç
            const targetTabBtn = document.querySelector(`.tab button[onclick*='${formType}']`);
            if (targetTabBtn) {
                targetTabBtn.click();
                
                // Diğer tab'ları gizle (sadece aktif olanı göster) - HEMEN yap, setTimeout yok
                const allTabButtons = formContainer.querySelectorAll('.tab .tablinks');
                allTabButtons.forEach(btn => {
                    if (btn !== targetTabBtn) {
                        btn.style.display = 'none';
                    } else {
                        btn.style.display = ''; // Aktif tab'ı göster
                    }
                });
            }
            
            // Form başlıklarını değiştir
            // 1. header-alan .baslik -> Her zaman "Kartı Düzenle"
            const headerBaslik = formContainer.querySelector('.header-alan .baslik');
            if (headerBaslik) {
                headerBaslik.textContent = 'Kartı Düzenle';
            }
            
            // 2. kart-baslik -> Kart tipine göre
            const kartBaslik = formContainer.querySelector('.kart-baslik');
            if (kartBaslik) {
                let yeniBaslik = 'Kartı Düzenle';
                if (formType === 'organizasyon-kart' || formType === 'dugun-kart' || formType === 'nisan-kart' || formType === 'sunnet-kart') {
                    yeniBaslik = 'Organizasyon Kartı Düzenle';
                } else if (formType === 'aracsusleme-kart') {
                    yeniBaslik = 'Araç Süsleme Kartı Düzenle';
                } else if (formType === 'ozelsiparis-kart') {
                    yeniBaslik = 'Özel Sipariş Kartı Düzenle';
                } else if (formType === 'ozelgun-kart') {
                    yeniBaslik = 'Özel Gün Kartı Düzenle';
                }
                kartBaslik.textContent = yeniBaslik;
            }
            
            // 3. Açıklama satırını güncelle
            const aciklamaSatir = formContainer.querySelector('.tablinks.active .aciklamasatir');
            if (aciklamaSatir) {
                let aciklama = 'Mevcut kartınızı düzenleyin';
                if (formType === 'organizasyon-kart' || formType === 'dugun-kart' || formType === 'nisan-kart' || formType === 'sunnet-kart') {
                    aciklama = 'Mevcut organizasyon kartınızı düzenleyin';
                } else if (formType === 'aracsusleme-kart') {
                    aciklama = 'Mevcut araç süsleme kartınızı düzenleyin';
                } else if (formType === 'ozelsiparis-kart') {
                    aciklama = 'Mevcut özel sipariş kartınızı düzenleyin';
                } else if (formType === 'ozelgun-kart') {
                    aciklama = 'Mevcut özel gün kartınızı düzenleyin';
                }
                aciklamaSatir.textContent = aciklama;
            }
            
            // Butonu GÜNCELLE yap
            const kaydetBtn = formContainer.querySelector('.btn-kart-olustur, .btn-kaydet');
            if (kaydetBtn) {
                kaydetBtn.textContent = 'GÜNCELLE';
                kaydetBtn.setAttribute('data-edit-mode', 'true');
                kaydetBtn.setAttribute('data-organization-id', organizasyonId);
                // Güncelleme modunda data-toast özelliğini kaldır (yanlış toast mesajı gösterilmesin)
                kaydetBtn.removeAttribute('data-toast');
            }
            
            // ✅ ÖNEMLİ: editOrganizationCardWithData fonksiyonunu kullan (cache'den veri geldiyse anında açılır)
            editOrganizationCardWithData(organizasyonId, formType, organizasyonData);
    });
}

// Organizasyon kartı düzenleme formunu aç (veri ile)
function editOrganizationCardWithData(organizasyonId, formType, orgData) {
    // Düzenleme modu flag'ini set et
    window.isEditMode = true;
    
    // Form container'ı bul
    const formContainer = document.querySelector('.yeni-kart-container');
    
    // Form tipine göre sekme aç - yedekteki gibi onclick ile
    const targetTabBtn = document.querySelector(`.tab button[onclick*='${formType}']`);
    if (targetTabBtn && formContainer) {
        // Önce tab'ı aç
        targetTabBtn.click();
        
        // ✅ Diğer tab'ları gizle (sadece aktif olanı göster) - yedekteki mantık
        // HEMEN yap, setTimeout yok - yedekteki gibi
        const allTabButtons = formContainer.querySelectorAll('.tab .tablinks');
        allTabButtons.forEach(btn => {
            if (btn !== targetTabBtn) {
                btn.style.display = 'none';
            } else {
                btn.style.display = ''; // Aktif tab'ı göster
            }
        });
        
        // ✅ HEMEN başlık ve butonları düzenleme moduna göre ayarla (form doldurma işleminden önce)
        // Böylece kullanıcı önce "Yeni Kart Oluştur" görüp sonra "Kartı Düzenle" görmeyecek
        // 1. header-alan .baslik -> Her zaman "Kartı Düzenle"
        const headerBaslik = formContainer.querySelector('.header-alan .baslik');
        if (headerBaslik) {
            headerBaslik.textContent = 'Kartı Düzenle';
        }
        
        // 2. kart-baslik -> Kart tipine göre
        const kartBaslik = formContainer.querySelector('.kart-baslik');
        if (kartBaslik) {
            let yeniBaslik = 'Kartı Düzenle';
            if (formType === 'organizasyon-kart' || formType === 'dugun-kart' || formType === 'nisan-kart' || formType === 'sunnet-kart') {
                yeniBaslik = 'Organizasyon Kartı Düzenle';
            } else if (formType === 'aracsusleme-kart') {
                yeniBaslik = 'Araç Süsleme Kartı Düzenle';
            } else if (formType === 'ozelsiparis-kart') {
                yeniBaslik = 'Özel Sipariş Kartı Düzenle';
            } else if (formType === 'ozelgun-kart') {
                yeniBaslik = 'Özel Gün Kartı Düzenle';
            }
            kartBaslik.textContent = yeniBaslik;
        }
        
        // 3. Açıklama satırını güncelle
        const aciklamaSatir = formContainer.querySelector('.tablinks.active .aciklamasatir');
        if (aciklamaSatir) {
            let aciklama = 'Mevcut kartınızı düzenleyin';
            if (formType === 'organizasyon-kart' || formType === 'dugun-kart' || formType === 'nisan-kart' || formType === 'sunnet-kart') {
                aciklama = 'Mevcut organizasyon kartınızı düzenleyin';
            } else if (formType === 'aracsusleme-kart') {
                aciklama = 'Mevcut araç süsleme kartınızı düzenleyin';
            } else if (formType === 'ozelsiparis-kart') {
                aciklama = 'Mevcut özel sipariş kartınızı düzenleyin';
            } else if (formType === 'ozelgun-kart') {
                aciklama = 'Mevcut özel gün kartınızı düzenleyin';
            }
            aciklamaSatir.textContent = aciklama;
        }
        
        // 4. Butonu GÜNCELLE yap
        const kaydetBtn = formContainer.querySelector('.btn-kart-olustur, .btn-kaydet');
        if (kaydetBtn) {
            kaydetBtn.textContent = 'GÜNCELLE';
            kaydetBtn.setAttribute('data-edit-mode', 'true');
            kaydetBtn.setAttribute('data-organization-id', organizasyonId);
            // Güncelleme modunda data-toast özelliğini kaldır (yanlış toast mesajı gösterilmesin)
            kaydetBtn.removeAttribute('data-toast');
        }
        
        // ✅ İl, ilçe ve mahalle dropdown'larını hemen yükle (form açıldığında)
        let formId = '';
        if (formType === 'ozelgun-kart') {
            formId = 'form-yeni-ozel-gun-kart';
        } else {
            formId = `form-yeni-${formType.replace('-kart', '')}-kart`;
        }
        const activeForm = formContainer.querySelector(`#${formId}, form`);
        if (activeForm) {
            // İl dropdown'larını yükle
            const ilWrappers = activeForm.querySelectorAll('.wrapper-acilirliste[data-type="il"]');
            ilWrappers.forEach(ilWrapper => {
                if (ilWrapper && typeof window.loadProvinceList === 'function') {
                    window.loadProvinceList(ilWrapper);
                }
            });
            
            // İlçe dropdown'larını yükle (eğer il seçiliyse)
            const ilceWrappers = activeForm.querySelectorAll('.wrapper-acilirliste[data-type="ilce"]');
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
            const mahalleWrappers = activeForm.querySelectorAll('.wrapper-acilirliste[data-type="mahallesemt"]');
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
    }
    
    // ✅ ÖNEMLİ: Form alanlarını HEMEN doldur (etiket yükleme işlemini bekleme)
    // Böylece kullanıcı form alanlarının hemen doldurulduğunu görür
    if (typeof fillOrganizationEditFormImmediate === 'function') {
        fillOrganizationEditFormImmediate(formType, orgData);
    }
    
    // Adres alanlarını da hemen doldur (kısa bir gecikme ile - fillAddressFields içinde setTimeout'lar var)
    const formId = formType === 'ozelgun-kart' 
        ? 'form-yeni-ozel-gun-kart' 
        : `form-yeni-${formType.replace('-kart', '')}-kart`;
    const form = document.querySelector(`#${formId}`);
    if (form && orgData && (orgData.organizasyon_il || orgData.organizasyon_ilce || orgData.mahalle)) {
        setTimeout(() => {
            const container = form.querySelector('.input-alan-container, .input-alan');
            if (container && window.fillAddressFields) {
                window.fillAddressFields(container, {
                    teslim_il: orgData.organizasyon_il,
                    teslim_ilce: orgData.organizasyon_ilce,
                    teslim_mahalle: orgData.mahalle
                });
            }
        }, 100); // Kısa bir gecikme ile adres alanlarını doldur
    }
    
    // Etiketleri yükle ve radio button'ları seç (arka planda, kullanıcı form alanlarını zaten görüyor)
    // formType'dan grup_id belirle
    let grupId = null;
    if (formType === 'organizasyon-kart' || formType === 'dugun-kart' || formType === 'nisan-kart' || formType === 'sunnet-kart') {
        grupId = 1;
    } else if (formType === 'ozelgun-kart') {
        grupId = 2;
    } else if (formType === 'ozelsiparis-kart') {
        grupId = 3;
    } else if (formType === 'aracsusleme-kart') {
        grupId = 4;
    }
    
    // ✅ OPTİMİZE: Etiketleri yükle ve radio button'ları seç (form alanları zaten dolduruldu)
    Promise.all([
        loadOrganizasyonTurleriToRadioButtons(null, grupId),
        loadOrganizasyonEtiketleriToRadioButtons(null, grupId)
    ]).then(async () => {
        // ✅ ÖNEMLİ: Etiketler yüklendikten sonra DOM'un güncellenmesi için kısa bir bekleme
        // Böylece radio button'lar DOM'a eklenmiş olur ve seçim yapılabilir
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Radio button seçimlerini yap (etiketler yüklendikten ve DOM güncellendikten sonra)
        if (typeof fillOrganizationEditFormRadioButtons === 'function') {
            fillOrganizationEditFormRadioButtons(formType, orgData);
        }
        
        // Bir kez daha dene (güvenlik için - DOM güncellemesi gecikebilir)
        setTimeout(() => {
            if (typeof fillOrganizationEditFormRadioButtons === 'function') {
                fillOrganizationEditFormRadioButtons(formType, orgData);
            }
        }, 300);
        
        // Bir kez daha dene (ekstra güvenlik - DOM güncellemesi daha da gecikebilir)
        setTimeout(() => {
            if (typeof fillOrganizationEditFormRadioButtons === 'function') {
                fillOrganizationEditFormRadioButtons(formType, orgData);
            }
        }, 600);
        
        // ✅ ÖNEMLİ: fillOrganizationEditForm içinde radio button seçimi yapılıyor
        // Ama etiketler henüz yüklenmemişse radio button'lar DOM'da yok
        // Bu yüzden fillOrganizationEditForm'u sadece görsel ve diğer alanları doldurmak için kullanmalıyız
        // Radio button seçimi zaten fillOrganizationEditFormRadioButtons içinde yapılıyor
        // Ancak fillOrganizationEditForm içinde görsel ve diğer alanlar da dolduruluyor
        // Bu yüzden fillOrganizationEditForm'u çağırmalıyız ama radio button seçimini atlamalıyız
        // Ya da fillOrganizationEditForm içinde radio button seçimi yapılmadan önce etiketlerin yüklendiğinden emin olmalıyız
        
        // Görsel ve diğer alanları doldur (radio button seçimi yapmadan)
        // fillOrganizationEditForm içinde radio button seçimi yapılıyor ama etiketler yüklendikten sonra
        // Bu yüzden fillOrganizationEditForm'u çağırabiliriz
        if (typeof fillOrganizationEditForm === 'function') {
            await fillOrganizationEditForm(formType, orgData);
        }
    }).catch(async (error) => {
        console.error('❌ Etiket yükleme hatası:', error);
        // Hata durumunda da radio button seçimlerini yapmaya çalış (retry mekanizması ile)
        setTimeout(() => {
            if (typeof fillOrganizationEditFormRadioButtons === 'function') {
                fillOrganizationEditFormRadioButtons(formType, orgData);
            }
        }, 200);
        setTimeout(() => {
            if (typeof fillOrganizationEditFormRadioButtons === 'function') {
                fillOrganizationEditFormRadioButtons(formType, orgData);
            }
        }, 500);
        if (typeof fillOrganizationEditForm === 'function') {
            await fillOrganizationEditForm(formType, orgData);
        }
    });
}

// ✅ YENİ: Input alanlarını hemen doldur (senkron - radio button'lar ve adres alanları hariç)
function fillOrganizationEditFormImmediate(formType, data) {
    let formId = '';
    if (formType === 'ozelgun-kart') {
        formId = 'form-yeni-ozel-gun-kart';
    } else {
        formId = `form-yeni-${formType.replace('-kart', '')}-kart`;
    }
    const form = document.querySelector(`#${formId}`);
    if (!form) {
        console.error('❌ Form bulunamadı:', formType);
        return;
    }

    // File input'ları temizle
    const fileInputs = form.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        try {
            const newInput = input.cloneNode(true);
            input.parentNode.replaceChild(newInput, input);
        } catch (error) {
            // Sessizce devam et
        }
    });

    // Form tipine göre input alanlarını doldur (radio button'lar ve adres alanları hariç)
    // Adres alanları fillAddressFields içindeki setTimeout'lar nedeniyle gecikme yaratıyor
    // Bu yüzden onları form gösterildikten SONRA dolduruyoruz
    if (formType === 'organizasyon-kart') {
        fillOrganizasyonKartFormInputsOnlyNoAddress(form, data);
    } else if (formType === 'ozelgun-kart') {
        fillOzelGunKartFormInputsOnlyNoAddress(form, data);
    } else if (formType === 'ozelsiparis-kart') {
        if (data) {
            fillOzelSiparisKartFormInputsOnlyNoAddress(form, data);
        }
    } else if (formType === 'aracsusleme-kart') {
        if (data) {
            fillAracSuslemeKartFormInputsOnlyNoAddress(form, data);
        }
    }
}

// ✅ YENİ: Radio button seçimlerini yap (etiketler yüklendikten sonra)
function fillOrganizationEditFormRadioButtons(formType, data) {
    let formId = '';
    if (formType === 'ozelgun-kart') {
        formId = 'form-yeni-ozel-gun-kart';
    } else {
        formId = `form-yeni-${formType.replace('-kart', '')}-kart`;
    }
    const form = document.querySelector(`#${formId}`);
    if (!form) {
        console.error('❌ Form bulunamadı:', formType);
        return;
    }

    // Form tipine göre radio button seçimlerini yap
    if (formType === 'organizasyon-kart') {
        fillOrganizasyonKartFormRadioButtonsOnly(form, data, data.id, formType);
    } else if (formType === 'ozelgun-kart') {
        fillOzelGunKartFormRadioButtonsOnly(form, data, data.id);
    } else if (formType === 'ozelsiparis-kart') {
        if (data) {
            fillOzelSiparisKartFormRadioButtonsOnly(form, data, data.id);
        }
    } else if (formType === 'aracsusleme-kart') {
        if (data) {
            fillAracSuslemeKartFormRadioButtonsOnly(form, data, data.id);
        }
    }
}

// Organizasyon formunu doldur (düzenleme modu)
async function fillOrganizationEditForm(formType, data) {
    let formId = '';
    if (formType === 'ozelgun-kart') {
        formId = 'form-yeni-ozel-gun-kart';
    } else {
        formId = `form-yeni-${formType.replace('-kart', '')}-kart`;
    }
    const form = document.querySelector(`#${formId}`);
    if (!form) {
        console.error('❌ Form bulunamadı:', formType);
        return;
    }

    // File input'ları temizle (file input'a değer atanamaz, sadece boş string ile temizlenebilir)
    // Ancak form.reset() zaten file input'ları temizler, bu yüzden burada temizlemeye gerek yok
    // Eğer form.reset() çağrılmıyorsa, file input'ları clone ederek temizleyebiliriz
    const fileInputs = form.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        try {
            // File input'ları clone ederek temizle (güvenli yöntem)
            const newInput = input.cloneNode(true);
            input.parentNode.replaceChild(newInput, input);
        } catch (error) {
            // File input temizlenemedi, sessizce devam et
        }
    });

    // Form tipine göre farklı alanları doldur - organizasyonId parametresini ekle
    if (formType === 'organizasyon-kart') {
        fillOrganizasyonKartForm(form, data, data.id, formType);
    } else if (formType === 'ozelgun-kart') {
        fillOzelGunKartForm(form, data, data.id);
    } else if (formType === 'ozelsiparis-kart') {
        if (data) {
            fillOzelSiparisKartForm(form, data, data.id);
        }
    } else if (formType === 'aracsusleme-kart') {
        if (data) {
            await fillAracSuslemeKartForm(form, data, data.id);
        }
    }

}

// Organizasyon kartı formu doldurma
function fillOrganizasyonKartForm(form, data, organizasyonId = null, formType = null) {
    // Organizasyon türü (radio button) - Hemen seç, bekleme yok
    if (data.kart_turu) {
        const selectOrganizasyonTuru = () => {
            const radioButtons = form.querySelectorAll('input[name="orgtur-etiket"]');
            if (radioButtons.length === 0) {
                return false;
            }
            
            // Mevcut tüm türleri listele
            radioButtons.forEach((radio, index) => {
                const label = radio.nextElementSibling;

            });
            
            let found = false;
            radioButtons.forEach(radio => {
                const label = radio.nextElementSibling;
                const labelText = label?.textContent.trim();
                // Türkçe karakterleri normalize et (sadece karşılaştırma için)
                const normalizeTurkishChars = (str) => {
                    return str.toUpperCase()
                        .replace(/İ/g, 'I')
                        .replace(/Ğ/g, 'G')
                        .replace(/Ü/g, 'U')
                        .replace(/Ş/g, 'S')
                        .replace(/Ö/g, 'O')
                        .replace(/Ç/g, 'C');
                };
                
                const normalizedLabelText = normalizeTurkishChars(labelText);
                const normalizedSearchText = normalizeTurkishChars(data.kart_turu);
                
                // Normalize edilmiş metinlerle karşılaştır
                if (label && normalizedLabelText === normalizedSearchText) {
                    radio.checked = true;
                    found = true;
                }
            });
            
            if (!found) {
                // Organizasyon türü bulunamadı
            }
            
            return found;
        };
        
        // ✅ ÖNEMLİ: Radio button seçimini retry mekanizması ile yap
        // Etiketler henüz yüklenmemişse radio button'lar DOM'da yok, bu yüzden retry yapmalıyız
        let turRetryCount = 0;
        const maxRetries = 5;
        const retryInterval = 200;
        
        const trySelectOrganizasyonTuru = () => {
            const found = selectOrganizasyonTuru();
            if (!found && turRetryCount < maxRetries) {
                turRetryCount++;
                setTimeout(trySelectOrganizasyonTuru, retryInterval);
            }
        };
        
        trySelectOrganizasyonTuru();
    } else {
        console.warn('⚠️ data.kart_turu boş:', data);
    }

    // Etiket (radio button) - Hemen seç, bekleme yok
    if (data.kart_etiket) {
        // Form tipine göre doğru name attribute'unu belirle
        let nameAttribute = 'organizasyon-etiketler';
        if (formType === 'ozelgun-kart') {
            nameAttribute = 'ozel-gun-etiketler';
        }
        const selectEtiket = () => {
            const etiketButtons = form.querySelectorAll(`input[name="${nameAttribute}"]`);
            if (etiketButtons.length === 0) {
                return false;
            }
            
            // Mevcut tüm etiketleri listele
            etiketButtons.forEach((radio, index) => {
                const label = radio.nextElementSibling;

            });
            
            let found = false;
            etiketButtons.forEach(radio => {
                const label = radio.nextElementSibling;
                const labelText = label?.textContent.trim();
                // Türkçe karakterleri normalize et (sadece karşılaştırma için)
                const normalizeTurkishChars = (str) => {
                    return str.toUpperCase()
                        .replace(/İ/g, 'I')
                        .replace(/Ğ/g, 'G')
                        .replace(/Ü/g, 'U')
                        .replace(/Ş/g, 'S')
                        .replace(/Ö/g, 'O')
                        .replace(/Ç/g, 'C');
                };
                
                const normalizedLabelText = normalizeTurkishChars(labelText);
                const normalizedSearchText = normalizeTurkishChars(data.kart_etiket);
                
                // Normalize edilmiş metinlerle karşılaştır
                if (label && normalizedLabelText === normalizedSearchText) {
                    radio.checked = true;
                    found = true;
                }
            });
            
            if (!found) {
                console.warn('⚠️ Etiket bulunamadı:', data.kart_etiket);
            }
            
            return found;
        };
        
        // ✅ ÖNEMLİ: Radio button seçimini retry mekanizması ile yap
        // Etiketler henüz yüklenmemişse radio button'lar DOM'da yok, bu yüzden retry yapmalıyız
        let etiketRetryCount = 0;
        const maxRetries = 5;
        const retryInterval = 200;
        
        const trySelectEtiket = () => {
            const found = selectEtiket();
            if (!found && etiketRetryCount < maxRetries) {
                etiketRetryCount++;
                setTimeout(trySelectEtiket, retryInterval);
            }
        };
        
        trySelectEtiket();
    } else {
        console.warn('⚠️ data.kart_etiket boş:', data);
    }

    // İl, İlçe, Mahalle - basit dropdown sistem kullanıyoruz
    if (data.organizasyon_il || data.organizasyon_ilce || data.mahalle) {
        const container = form.querySelector('.input-alan-container, .input-alan');
        if (container && window.fillAddressFields) {
            window.fillAddressFields(container, {
                teslim_il: data.organizasyon_il,
                teslim_ilce: data.organizasyon_ilce,
                teslim_mahalle: data.mahalle
            });
            
            // İl ve İlçe yüklendikten sonra teslimat konumlarını da yükle
            if (data.organizasyon_il && data.organizasyon_ilce && window.loadTeslimatKonumlari) {
                setTimeout(() => {
                    const teslimatKonumuWrapper = form.querySelector('.wrapper-acilirliste.genel[data-type="teslimatkonumu"]');
                    if (teslimatKonumuWrapper) {
                        // İl ve İlçe wrapper'larından ID'leri al
                        const ilWrapper = form.querySelector('.wrapper-acilirliste.genel[data-type="il"]');
                        const ilceWrapper = form.querySelector('.wrapper-acilirliste.genel[data-type="ilce"]');
                        
                        if (ilWrapper && ilceWrapper) {
                            const ilHiddenInput = ilWrapper.querySelector('input[type="hidden"]');
                            const ilceHiddenInput = ilceWrapper.querySelector('input[type="hidden"]');
                            
                            if (ilHiddenInput && ilceHiddenInput) {
                                const ilId = ilHiddenInput.value;
                                const ilceId = ilceHiddenInput.value;
                                
                                // Teslimat konumlarını yükle
                                window.loadTeslimatKonumlari(teslimatKonumuWrapper, ilId, ilceId);
                                
                                // Teslimat konumu listesi yüklendikten sonra seçili değeri ayarla
                                setTimeout(() => {
                                    if (data.organizasyon_teslimat_konumu) {
                                        const span = teslimatKonumuWrapper.querySelector('span');
                                        const hiddenInput = teslimatKonumuWrapper.querySelector('input[type="hidden"]');
                                        
                                        if (span) {
                                            span.textContent = data.organizasyon_teslimat_konumu;
                                        }
                                        
                                        if (hiddenInput) {
                                            hiddenInput.value = data.organizasyon_teslimat_konumu;
                                        }
                                    }
                                });
                            }
                        }
                    }
                });
            }
        }
    }

    // Açık adres
    const acikAdresInput = form.querySelector('textarea[name="acikadres"]');
    if (acikAdresInput && data.adres) {
        acikAdresInput.value = data.adres;
    }

    // Organizasyon sahibi
    const orgSahibiInput = form.querySelector('input[name="organizasyon-sahibi"]');
    if (orgSahibiInput && data.organizasyon_sahibi) {
        orgSahibiInput.value = data.organizasyon_sahibi;
    }

    // ✅ ORTAK YAPI: Telefon input'u - data-phone-input="standard" ile otomatik formatlanıyor
    const telefonInput = form.querySelector('input[name="orgsahibitelefon"]');
    if (telefonInput && data.organizasyon_sahibi_telefon) {
        // Telefon numarasını formatla ve doldur
        // ✅ ÖNEMLİ: Programatik value set işlemleri için setPhoneInputValue fonksiyonunu kullan
        if (typeof window.formatPhoneNumber === 'function') {
            setPhoneInputValue(telefonInput, window.formatPhoneNumber(data.organizasyon_sahibi_telefon));
        } else {
            setPhoneInputValue(telefonInput, data.organizasyon_sahibi_telefon);
        }
        // data-phone-input="standard" attribute'unu ekle (eğer yoksa) - phone-formatter.js otomatik formatlayacak
        if (!telefonInput.hasAttribute('data-phone-input')) {
            telefonInput.setAttribute('data-phone-input', 'standard');
        }
    }

    // Teslim tarihi
    const orgTarihInput = form.querySelector('input[name="teslim-tarihi"]');
    if (orgTarihInput && data.teslim_tarihi) {
        orgTarihInput.value = data.teslim_tarihi;
    }

    // Teslim saati
    const saatInput = form.querySelector('input[name="siparis-saat"]');
    if (saatInput && data.teslim_saati) {
        saatInput.value = data.teslim_saati;
    }

    // ✅ OPTİMİZE: File input'unu temizle (düzenleme modunda yeni dosya seçilebilmesi için)
    // Form açıldığında hemen temizle (setTimeout yok)
    const davetiyeFileInput = form.querySelector('input[name="davetiye-gorseli"][type="file"]');
    if (davetiyeFileInput) {
        davetiyeFileInput.value = '';
    }
    
    // Davetiye görseli - kart-gorseli alanına yükle
    if (data.kart_gorsel) {
        // Form şablonundaki kart-gorseli alanına görseli yükle
        const kartGorseli = form.querySelector('.kart-gorseli');
        if (kartGorseli) {
            const dynamicImg = kartGorseli.querySelector('img[data-dynamic-gorsel]');
            const placeholder = kartGorseli.querySelector('.gorsel-placeholder');
            
            if (dynamicImg) {
                const backendBase = window.getFloovonBackendBase ? window.getFloovonBackendBase() : (window.BACKEND_BASE_URL || (window.API_BASE_URL ? window.API_BASE_URL.replace('/api', '') : (() => {
                    return (typeof window.getFloovonProductionBase === 'function') 
                        ? window.getFloovonProductionBase() 
                        : (window.BACKEND_BASE_URL || ((typeof window.getFloovonProductionBase === 'function') 
                            ? window.getFloovonProductionBase() 
                            : (window.getFloovonBackendBase ? window.getFloovonBackendBase() : (window.BACKEND_BASE_URL || ''))));
                })()));
                // Path helper kullan - çift path sorununu önler
                const imageUrl = window.getFloovonUploadUrl ? window.getFloovonUploadUrl(data.kart_gorsel) : (data.kart_gorsel.startsWith('/uploads/') ? `${backendBase}${data.kart_gorsel}` : `${backendBase}/uploads/${data.kart_gorsel}`);
                
                // Görsel yüklendiğinde has-image class'ını ekle ve placeholder'ı gizle
                const showImage = function() {
                    kartGorseli.classList.add('has-image');
                    if (placeholder) {
                        placeholder.style.display = 'none';
                    }
                };
                
                // Görsel yüklenirken hata olursa
                dynamicImg.onerror = function() {
                    console.error('❌ Kart görseli yüklenemedi:', imageUrl);
                    kartGorseli.classList.remove('has-image');
                    if (placeholder) {
                        placeholder.style.display = 'flex';
                    }
                };
                
                // Görsel yüklendiğinde class ekle
                dynamicImg.onload = showImage;
                
                // Görseli set et
                dynamicImg.src = imageUrl;
                dynamicImg.alt = 'Davetiye görseli';
                // Agresif kontrol: görseli set ettikten sonra kısa aralıklarla kontrol et
                const checkImageLoaded = function() {
                    if (dynamicImg.complete && dynamicImg.naturalHeight > 0) {
                        showImage();
                        return true;
                    }
                    return false;
                };
                
                // SetTimeout ile görseli set ettikten sonra kontrol et
                // Cached images için hemen, yeni images için kısa bir süre sonra
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
            }
        }
        
        // Eski preview alanına da yükle (uyumluluk için)
        const previewImg = form.querySelector('.davetiye-gorseli-preview img');
        if (previewImg) {
            const backendBase = window.getFloovonBackendBase ? window.getFloovonBackendBase() : (window.BACKEND_BASE_URL || '');
            // Path helper kullan - çift path sorununu önler
            previewImg.src = window.getFloovonUploadUrl ? window.getFloovonUploadUrl(data.kart_gorsel) : (data.kart_gorsel && data.kart_gorsel.startsWith('/uploads/') ? `${backendBase}${data.kart_gorsel}` : `${backendBase}/uploads/${data.kart_gorsel}`);
            previewImg.style.display = 'block';
        }
        
        // Hidden input'a da kaydet (file input değilse)
        const hiddenInput = form.querySelector('input[name="davetiye-gorseli"]');
        if (hiddenInput && hiddenInput.type !== 'file') {
            hiddenInput.value = data.kart_gorsel;
        }
    }
}

// ✅ YENİ: Organizasyon kartı formu - Sadece input alanları (radio button'lar hariç)
function fillOrganizasyonKartFormInputsOnly(form, data) {
    // İl, İlçe, Mahalle
    if (data.organizasyon_il || data.organizasyon_ilce || data.mahalle) {
        const container = form.querySelector('.input-alan-container, .input-alan');
        if (container && window.fillAddressFields) {
            window.fillAddressFields(container, {
                teslim_il: data.organizasyon_il,
                teslim_ilce: data.organizasyon_ilce,
                teslim_mahalle: data.mahalle
            });
        }
    }

    // Açık adres
    const acikAdresInput = form.querySelector('textarea[name="acikadres"]');
    if (acikAdresInput && data.adres) {
        acikAdresInput.value = data.adres;
    }

    // Organizasyon sahibi
    const orgSahibiInput = form.querySelector('input[name="organizasyon-sahibi"]');
    if (orgSahibiInput && data.organizasyon_sahibi) {
        orgSahibiInput.value = data.organizasyon_sahibi;
    }

    // ✅ ORTAK YAPI: Telefon input'u - data-phone-input="standard" ile otomatik formatlanıyor
    const telefonInput = form.querySelector('input[name="orgsahibitelefon"]');
    if (telefonInput && data.organizasyon_sahibi_telefon) {
        // Telefon numarasını formatla ve doldur
        // ✅ ÖNEMLİ: Programatik value set işlemleri için setPhoneInputValue fonksiyonunu kullan
        if (typeof window.formatPhoneNumber === 'function') {
            setPhoneInputValue(telefonInput, window.formatPhoneNumber(data.organizasyon_sahibi_telefon));
        } else {
            setPhoneInputValue(telefonInput, data.organizasyon_sahibi_telefon);
        }
        // data-phone-input="standard" attribute'unu ekle (eğer yoksa) - phone-formatter.js otomatik formatlayacak
        if (!telefonInput.hasAttribute('data-phone-input')) {
            telefonInput.setAttribute('data-phone-input', 'standard');
        }
    }

    // Teslim tarihi
    const orgTarihInput = form.querySelector('input[name="teslim-tarihi"]');
    if (orgTarihInput && data.teslim_tarihi) {
        orgTarihInput.value = data.teslim_tarihi;
    }

    // Teslim saati
    const saatInput = form.querySelector('input[name="siparis-saat"]');
    if (saatInput && data.teslim_saati) {
        saatInput.value = data.teslim_saati;
    }
}

// ✅ YENİ: Organizasyon kartı formu - Sadece input alanları (adres ve radio button'lar hariç)
function fillOrganizasyonKartFormInputsOnlyNoAddress(form, data) {
    // Açık adres
    const acikAdresInput = form.querySelector('textarea[name="acikadres"]');
    if (acikAdresInput && data.adres) {
        acikAdresInput.value = data.adres;
    }

    // Organizasyon sahibi
    const orgSahibiInput = form.querySelector('input[name="organizasyon-sahibi"]');
    if (orgSahibiInput && data.organizasyon_sahibi) {
        orgSahibiInput.value = data.organizasyon_sahibi;
    }

    // ✅ ORTAK YAPI: Telefon input'u - data-phone-input="standard" ile otomatik formatlanıyor
    const telefonInput = form.querySelector('input[name="orgsahibitelefon"]');
    if (telefonInput && data.organizasyon_sahibi_telefon) {
        // Telefon numarasını formatla ve doldur
        // ✅ ÖNEMLİ: Programatik value set işlemleri için setPhoneInputValue fonksiyonunu kullan
        if (typeof window.formatPhoneNumber === 'function') {
            setPhoneInputValue(telefonInput, window.formatPhoneNumber(data.organizasyon_sahibi_telefon));
        } else {
            setPhoneInputValue(telefonInput, data.organizasyon_sahibi_telefon);
        }
        // data-phone-input="standard" attribute'unu ekle (eğer yoksa) - phone-formatter.js otomatik formatlayacak
        if (!telefonInput.hasAttribute('data-phone-input')) {
            telefonInput.setAttribute('data-phone-input', 'standard');
        }
    }

    // Teslim tarihi
    const orgTarihInput = form.querySelector('input[name="teslim-tarihi"]');
    if (orgTarihInput && data.teslim_tarihi) {
        orgTarihInput.value = data.teslim_tarihi;
    }

    // Teslim saati
    const saatInput = form.querySelector('input[name="siparis-saat"]');
    if (saatInput && data.teslim_saati) {
        saatInput.value = data.teslim_saati;
    }

    // Davetiye görseli
    if (data.kart_gorsel) {
        const kartGorseli = form.querySelector('.kart-gorseli');
        if (kartGorseli) {
            const dynamicImg = kartGorseli.querySelector('img[data-dynamic-gorsel]');
            const placeholder = kartGorseli.querySelector('.gorsel-placeholder');
            
            if (dynamicImg) {
                const backendBase = window.getFloovonBackendBase ? window.getFloovonBackendBase() : (window.BACKEND_BASE_URL || (window.API_BASE_URL ? window.API_BASE_URL.replace('/api', '') : ''));
                const imageUrl = window.getFloovonUploadUrl ? window.getFloovonUploadUrl(data.kart_gorsel) : (data.kart_gorsel.startsWith('/uploads/') ? `${backendBase}${data.kart_gorsel}` : `${backendBase}/uploads/${data.kart_gorsel}`);
                
                const showImage = function() {
                    kartGorseli.classList.add('has-image');
                    if (placeholder) {
                        placeholder.style.display = 'none';
                    }
                };
                
                dynamicImg.onerror = function() {
                    kartGorseli.classList.remove('has-image');
                    if (placeholder) {
                        placeholder.style.display = 'flex';
                    }
                };
                
                dynamicImg.onload = showImage;
                dynamicImg.src = imageUrl;
                dynamicImg.alt = 'Davetiye görseli';
            }
        }
    }
}

// ✅ YENİ: Organizasyon kartı formu - Sadece radio button seçimleri
function fillOrganizasyonKartFormRadioButtonsOnly(form, data, organizasyonId = null, formType = null) {
    // Organizasyon türü (radio button)
    if (data.kart_turu) {
        const radioButtons = form.querySelectorAll('input[name="orgtur-etiket"]');
        if (radioButtons.length > 0) {
            const normalizeTurkishChars = (str) => {
                return str.toUpperCase()
                    .replace(/İ/g, 'I')
                    .replace(/Ğ/g, 'G')
                    .replace(/Ü/g, 'U')
                    .replace(/Ş/g, 'S')
                    .replace(/Ö/g, 'O')
                    .replace(/Ç/g, 'C');
            };
            
            const normalizedSearchText = normalizeTurkishChars(data.kart_turu);
            
            radioButtons.forEach(radio => {
                const label = radio.nextElementSibling;
                const labelText = label?.textContent.trim();
                const normalizedLabelText = normalizeTurkishChars(labelText);
                
                if (label && normalizedLabelText === normalizedSearchText) {
                    radio.checked = true;
                }
            });
        }
    }

    // Etiket (radio button)
    if (data.kart_etiket) {
        let nameAttribute = 'organizasyon-etiketler';
        if (formType === 'ozelgun-kart') {
            nameAttribute = 'ozel-gun-etiketler';
        }
        const etiketButtons = form.querySelectorAll(`input[name="${nameAttribute}"]`);
        if (etiketButtons.length > 0) {
            const normalizeTurkishChars = (str) => {
                return str.toUpperCase()
                    .replace(/İ/g, 'I')
                    .replace(/Ğ/g, 'G')
                    .replace(/Ü/g, 'U')
                    .replace(/Ş/g, 'S')
                    .replace(/Ö/g, 'O')
                    .replace(/Ç/g, 'C');
            };
            
            const normalizedSearchText = normalizeTurkishChars(data.kart_etiket);
            
            etiketButtons.forEach(radio => {
                const label = radio.nextElementSibling;
                const labelText = label?.textContent.trim();
                const normalizedLabelText = normalizeTurkishChars(labelText);
                
                if (label && normalizedLabelText === normalizedSearchText) {
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        }
    }
}

// Özel Gün kartı formu doldurma
function fillOzelGunKartForm(form, data, organizasyonId = null) {
    // Özel gün türü (radio button) - organizasyon_alt_tur kullanıyor - Geliştirilmiş retry mekanizması
    if (data.alt_tur) {
        const selectOzelGunTuru = () => {
            // Türkçe karakterleri normalize et
            const normalizeTurkishChars = (str) => {
                return str.toUpperCase()
                    .replace(/İ/g, 'I')
                    .replace(/Ğ/g, 'G')
                    .replace(/Ü/g, 'U')
                    .replace(/Ş/g, 'S')
                    .replace(/Ö/g, 'O')
                    .replace(/Ç/g, 'C');
            };
            
            const searchValue = normalizeTurkishChars(data.alt_tur);

            let found = false;
            
            // Özel gün türlerini radio button'lardan ara
            const radioButtons = form.querySelectorAll('input[name="orgtur-etiket"]');
            if (radioButtons.length > 0) {
                // Mevcut tüm türleri listele
                radioButtons.forEach((radio, index) => {
                    const label = radio.nextElementSibling;

                });
                
                radioButtons.forEach(radio => {
                    const label = radio.nextElementSibling;
                    const labelText = label?.textContent.trim();
                    const normalizedLabelText = normalizeTurkishChars(labelText);
                    if (label && normalizedLabelText === searchValue) {
                        radio.checked = true;
                        found = true;
                    }
                });
            } else {
                // Eski yöntem - sabit ID'lerle arama
                // Anneler Günü
                if (searchValue.includes('ANNELER')) {
                    const radio = form.querySelector('#orgtur-anneler-gunu');
                    if (radio) {
                        radio.checked = true;
                        found = true;
                    }
                }
                // Sevgililer Günü
                else if (searchValue.includes('SEVGILILER')) {
                    const radio = form.querySelector('#orgtur-sevgililer-gunu');
                    if (radio) {
                        radio.checked = true;
                        found = true;
                    }
                }
                // Kadınlar Günü
                else if (searchValue.includes('KADINLAR') || searchValue.includes('KADIN')) {
                    const radio = form.querySelector('#orgtur-kadinlar-gunu');
                    if (radio) {
                        radio.checked = true;
                        found = true;
                    }
                }
                // Öğretmenler Günü
                else if (searchValue.includes('OGRETMENLER')) {
                    const radio = form.querySelector('#orgtur-ogretmenler-gunu');
                    if (radio) {
                        radio.checked = true;
                        found = true;
                    }
                }
            }
            
            if (!found) {
                // Özel gün türü bulunamadı
            }
            
            return found;
        };
        
        // ✅ OPTİMİZE: Hemen seç, retry yok
        selectOzelGunTuru();
    }

    // Etiket (radio button) - Geliştirilmiş retry mekanizması
    if (data.kart_etiket) {
        const selectEtiket = () => {
            const etiketButtons = form.querySelectorAll('input[name="ozel-gun-etiketler"]');
            if (etiketButtons.length === 0) {
                return false;
            }
            
            // Türkçe karakterleri normalize et
            const normalizeTurkishChars = (str) => {
                return str.toUpperCase()
                    .replace(/İ/g, 'I')
                    .replace(/Ğ/g, 'G')
                    .replace(/Ü/g, 'U')
                    .replace(/Ş/g, 'S')
                    .replace(/Ö/g, 'O')
                    .replace(/Ç/g, 'C');
            };
            
            const searchEtiket = normalizeTurkishChars(data.kart_etiket);

            let found = false;
            
            etiketButtons.forEach(radio => {
                const label = radio.nextElementSibling;
                if (label) {
                    const labelText = normalizeTurkishChars(label.textContent.trim());
                    if (labelText === searchEtiket) {
                        radio.checked = true;
                        found = true;
                    }
                }
            });
            
            if (!found) {
                // Özel gün etiketi bulunamadı
            }
            
            return found;
        };
        
        // ✅ OPTİMİZE: Hemen seç, retry yok
        selectEtiket();
    }

    // Teslim tarihi
    const ozelGunTarihInput = form.querySelector('input[name="teslim-tarihi"]');
    if (ozelGunTarihInput && data.teslim_tarihi) {
        ozelGunTarihInput.value = data.teslim_tarihi;
    }

    // İl, İlçe, Mahalle
    if (data.organizasyon_il || data.organizasyon_ilce || data.mahalle) {
        const container = form.querySelector('.input-alan-container, .input-alan');
        if (container && window.fillAddressFields) {
            window.fillAddressFields(container, {
                teslim_il: data.organizasyon_il,
                teslim_ilce: data.organizasyon_ilce,
                teslim_mahalle: data.mahalle
            });
        }
    }

    // Açık adres
    const acikAdresInput = form.querySelector('textarea[name="acikadres"]');
    if (acikAdresInput && data.adres) {
        acikAdresInput.value = data.adres;
    }

    // Organizasyon sahibi
    const orgSahibiInput = form.querySelector('input[name="organizasyon-sahibi"]');
    if (orgSahibiInput && data.organizasyon_sahibi) {
        orgSahibiInput.value = data.organizasyon_sahibi;
    }

    // ✅ ORTAK YAPI: Telefon input'u - data-phone-input="standard" ile otomatik formatlanıyor
    const telefonInput = form.querySelector('input[name="orgsahibitelefon"]');
    if (telefonInput && data.organizasyon_sahibi_telefon) {
        // Telefon numarasını formatla ve doldur
        // ✅ ÖNEMLİ: Programatik value set işlemleri için setPhoneInputValue fonksiyonunu kullan
        if (typeof window.formatPhoneNumber === 'function') {
            setPhoneInputValue(telefonInput, window.formatPhoneNumber(data.organizasyon_sahibi_telefon));
        } else {
            setPhoneInputValue(telefonInput, data.organizasyon_sahibi_telefon);
        }
        // data-phone-input="standard" attribute'unu ekle (eğer yoksa) - phone-formatter.js otomatik formatlayacak
        if (!telefonInput.hasAttribute('data-phone-input')) {
            telefonInput.setAttribute('data-phone-input', 'standard');
        }
    }

    // Teslim tarihi
    const tarihInput = form.querySelector('input[name="teslim-tarihi"]');
    if (tarihInput && data.teslim_tarihi) {
        tarihInput.value = data.teslim_tarihi;
    }

    // Teslim saati
    const saatInput = form.querySelector('input[name="siparis-saat"]');
    if (saatInput && data.teslim_saati) {
        saatInput.value = data.teslim_saati;
    }

    // ✅ OPTİMİZE: File input'unu temizle (düzenleme modunda yeni dosya seçilebilmesi için)
    // Hemen temizle, setTimeout yok
    const davetiyeFileInputOzelGun = form.querySelector('input[name="davetiye-gorseli"][type="file"]');
    if (davetiyeFileInputOzelGun) {
        davetiyeFileInputOzelGun.value = '';
    }
    
    // Davetiye görseli
    if (data.kart_gorsel) {
        const previewImg = form.querySelector('.davetiye-gorseli-preview img');
        if (previewImg) {
            const backendBase = window.getFloovonBackendBase ? window.getFloovonBackendBase() : (window.BACKEND_BASE_URL || '');
            // Path helper kullan - çift path sorununu önler
            previewImg.src = window.getFloovonUploadUrl ? window.getFloovonUploadUrl(data.kart_gorsel) : (data.kart_gorsel && data.kart_gorsel.startsWith('/uploads/') ? `${backendBase}${data.kart_gorsel}` : `${backendBase}/uploads/${data.kart_gorsel}`);
            previewImg.style.display = 'block';
        }
        
        // Hidden input'a da kaydet (file input değilse)
        const hiddenInput = form.querySelector('input[name="davetiye-gorseli"]');
        if (hiddenInput && hiddenInput.type !== 'file') {
            hiddenInput.value = data.kart_gorsel;
        }
    }
    
    // Başlık ve açıklamayı güncelle
    const kartBaslik = form.querySelector('.kart-baslik');
    if (kartBaslik) {
        kartBaslik.textContent = 'Özel Gün Kartı Düzenle';
    }
    
    const aciklamaSatir = form.closest('.yeni-kart-container')?.querySelector('.tablinks.active .aciklamasatir');
    if (aciklamaSatir) {
        aciklamaSatir.textContent = 'Mevcut özel gün kartınızı düzenleyin';
    }
    
    // Butonu GÜNCELLE yap ve edit mode attribute'larını ekle
    const kaydetBtn = form.querySelector('.btn-kart-olustur');
    if (kaydetBtn) {
        kaydetBtn.textContent = 'GÜNCELLE';
        if (organizasyonId) {
            kaydetBtn.setAttribute('data-edit-mode', 'true');
            kaydetBtn.setAttribute('data-organization-id', organizasyonId);
        }
        // Güncelleme modunda data-toast özelliğini kaldır (yanlış toast mesajı gösterilmesin)
        kaydetBtn.removeAttribute('data-toast');
    }
}

// Kart-etiket görselini güncelle (form ve ana kart üzerinde)
function updateKartEtiketGorsel(form, etiketMetni, organizasyonId = null) {
    if (!etiketMetni) return;
    
    // Form içindeki kart-etiket alanını güncelle
    let kartEtiketEl = form.querySelector('.kart-etiket');
    if (!kartEtiketEl) {
        kartEtiketEl = form.querySelector('.org-turu-band .left .kart-etiket');
    }
    if (!kartEtiketEl) {
        const formContainer = form.closest('.yeni-kart-container') || form.closest('.container-organizasyon');
        if (formContainer) {
            kartEtiketEl = formContainer.querySelector('.kart-etiket') || formContainer.querySelector('.org-turu-band .left .kart-etiket');
        }
    }
    if (kartEtiketEl) {
        kartEtiketEl.textContent = etiketMetni.toLocaleUpperCase('tr-TR');
        kartEtiketEl.style.display = '';
    }
    
    // Ana kart üzerindeki kart-etiket alanını güncelle (index sayfasındaki organizasyon kartı)
    if (organizasyonId) {
        const anaKart = document.querySelector(`[data-organization-id="${organizasyonId}"]`) ||
                       document.querySelector(`.item[data-organization-id="${organizasyonId}"] .ana-kart`);
        if (anaKart) {
            const kartEtiketAnaKart = anaKart.querySelector('.kart-etiket');
            if (kartEtiketAnaKart) {
                kartEtiketAnaKart.textContent = etiketMetni.toLocaleUpperCase('tr-TR');
                kartEtiketAnaKart.style.display = '';
            }
        }
    }
}

// ✅ YENİ: Özel Gün kartı formu - Sadece input alanları (radio button'lar hariç)
function fillOzelGunKartFormInputsOnly(form, data) {
    // Teslim tarihi
    const ozelGunTarihInput = form.querySelector('input[name="teslim-tarihi"]');
    if (ozelGunTarihInput && data.teslim_tarihi) {
        ozelGunTarihInput.value = data.teslim_tarihi;
    }

    // İl, İlçe, Mahalle
    if (data.organizasyon_il || data.organizasyon_ilce || data.mahalle) {
        const container = form.querySelector('.input-alan-container, .input-alan');
        if (container && window.fillAddressFields) {
            window.fillAddressFields(container, {
                teslim_il: data.organizasyon_il,
                teslim_ilce: data.organizasyon_ilce,
                teslim_mahalle: data.mahalle
            });
        }
    }

    // Açık adres
    const acikAdresInput = form.querySelector('textarea[name="acikadres"]');
    if (acikAdresInput && data.adres) {
        acikAdresInput.value = data.adres;
    }
}

// ✅ YENİ: Özel Gün kartı formu - Sadece input alanları (adres ve radio button'lar hariç)
function fillOzelGunKartFormInputsOnlyNoAddress(form, data) {
    // Teslim tarihi
    const ozelGunTarihInput = form.querySelector('input[name="teslim-tarihi"]');
    if (ozelGunTarihInput && data.teslim_tarihi) {
        ozelGunTarihInput.value = data.teslim_tarihi;
    }

    // Açık adres
    const acikAdresInput = form.querySelector('textarea[name="acikadres"]');
    if (acikAdresInput && data.adres) {
        acikAdresInput.value = data.adres;
    }
}

// ✅ YENİ: Özel Gün kartı formu - Sadece radio button seçimleri
function fillOzelGunKartFormRadioButtonsOnly(form, data, organizasyonId = null) {
    // Özel gün türü (radio button)
    if (data.alt_tur) {
        const normalizeTurkishChars = (str) => {
            return str.toUpperCase()
                .replace(/İ/g, 'I')
                .replace(/Ğ/g, 'G')
                .replace(/Ü/g, 'U')
                .replace(/Ş/g, 'S')
                .replace(/Ö/g, 'O')
                .replace(/Ç/g, 'C');
        };
        
        const searchValue = normalizeTurkishChars(data.alt_tur);
        const radioButtons = form.querySelectorAll('input[name="orgtur-etiket"]');
        
        if (radioButtons.length > 0) {
            radioButtons.forEach(radio => {
                const label = radio.nextElementSibling;
                const labelText = label?.textContent.trim();
                const normalizedLabelText = normalizeTurkishChars(labelText);
                if (label && normalizedLabelText === searchValue) {
                    radio.checked = true;
                }
            });
        }
    }

    // Etiket (radio button)
    if (data.kart_etiket) {
        const etiketButtons = form.querySelectorAll('input[name="ozel-gun-etiketler"]');
        if (etiketButtons.length > 0) {
            const normalizeTurkishChars = (str) => {
                return str.toUpperCase()
                    .replace(/İ/g, 'I')
                    .replace(/Ğ/g, 'G')
                    .replace(/Ü/g, 'U')
                    .replace(/Ş/g, 'S')
                    .replace(/Ö/g, 'O')
                    .replace(/Ç/g, 'C');
            };
            
            const searchEtiket = normalizeTurkishChars(data.kart_etiket);
            
            etiketButtons.forEach(radio => {
                const label = radio.nextElementSibling;
                if (label) {
                    const labelText = normalizeTurkishChars(label.textContent.trim());
                    if (labelText === searchEtiket) {
                        radio.checked = true;
                        radio.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            });
        }
    }
}

// Özel Sipariş kartı formu doldurma
function fillOzelSiparisKartForm(form, data, organizasyonId = null) {
    // Özel sipariş türü (radio button) - Geliştirilmiş retry mekanizması
    if (data.kart_turu) {
        const selectOzelSiparisTuru = () => {
            const radioButtons = form.querySelectorAll('input[name="orgtur-etiket"]');
            if (radioButtons.length === 0) {
                return false;
            }
            
            // Mevcut tüm türleri listele
            radioButtons.forEach((radio, index) => {
                const label = radio.nextElementSibling;

            });
            
            // Türkçe karakterleri normalize et
            const normalizeTurkishChars = (str) => {
                return str.toUpperCase()
                    .replace(/İ/g, 'I')
                    .replace(/Ğ/g, 'G')
                    .replace(/Ü/g, 'U')
                    .replace(/Ş/g, 'S')
                    .replace(/Ö/g, 'O')
                    .replace(/Ç/g, 'C');
            };
            
            const searchValue = normalizeTurkishChars(data.kart_turu);

            let found = false;
            
            radioButtons.forEach(radio => {
                const label = radio.nextElementSibling;
                const labelText = label?.textContent.trim();
                const normalizedLabelText = normalizeTurkishChars(labelText);
                if (label && normalizedLabelText === searchValue) {
                    radio.checked = true;
                    found = true;
                }
            });
            
            if (!found) {
                console.warn('⚠️ Özel sipariş türü bulunamadı:', data.kart_turu);
            }
            
            return found;
        };
        
        // Hemen seç, bekleme yok
        selectOzelSiparisTuru();
        
        // Eğer bulunamadıysa, çok kısa bir süre sonra tekrar dene (sadece 1 kez)
            setTimeout(() => {
            const radioButtons = form.querySelectorAll('input[name="orgtur-etiket"]');
            if (radioButtons.length > 0) {
                const checked = form.querySelector('input[name="orgtur-etiket"]:checked');
                if (!checked) {
                selectOzelSiparisTuru();
        }
            }
        }, 10);
    }
    
    // Etiket (radio button) - Geliştirilmiş retry mekanizması
    if (data.kart_etiket) {
        const selectEtiket = () => {
            // Önce özel sipariş etiketlerini ara, yoksa organizasyon etiketlerine bak
            let etiketButtons = form.querySelectorAll('input[name="ozel-siparis-etiketler"]');
            if (etiketButtons.length === 0) {
                etiketButtons = form.querySelectorAll('input[name="organizasyon-etiketler"]');
            }
            if (etiketButtons.length === 0) {
                return false;
            }
            
            // Türkçe karakterleri normalize et
            const normalizeTurkishChars = (str) => {
                return str.toUpperCase()
                    .replace(/İ/g, 'I')
                    .replace(/Ğ/g, 'G')
                    .replace(/Ü/g, 'U')
                    .replace(/Ş/g, 'S')
                    .replace(/Ö/g, 'O')
                    .replace(/Ç/g, 'C');
            };
            
            const searchEtiket = normalizeTurkishChars(data.kart_etiket);

            let found = false;
            
            let selectedLabel = null;
            etiketButtons.forEach(radio => {
                const label = radio.nextElementSibling;
                const labelText = label?.textContent.trim();
                const normalizedLabelText = normalizeTurkishChars(labelText);
                // Normalize edilmiş metinlerle karşılaştır
                if (label && normalizedLabelText === searchEtiket) {
                    radio.checked = true;
                    found = true;
                    selectedLabel = labelText;
                    // Trigger change event to update form display
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
            
            if (!found) {
                console.warn('⚠️ Özel sipariş etiketi bulunamadı:', data.kart_etiket);
            } else if (selectedLabel) {
                // Etiket seçildikten sonra form içindeki ve ana kart üzerindeki kart-etiket alanlarını güncelle
                updateKartEtiketGorsel(form, selectedLabel, organizasyonId);
            }
            
            return found;
        };
        
        // Hemen seç, bekleme yok
        selectEtiket();
        
        // Eğer bulunamadıysa, çok kısa bir süre sonra tekrar dene (sadece 1 kez)
            setTimeout(() => {
            let etiketButtons = form.querySelectorAll('input[name="ozel-siparis-etiketler"]');
            if (etiketButtons.length === 0) {
                etiketButtons = form.querySelectorAll('input[name="organizasyon-etiketler"]');
            }
            if (etiketButtons.length > 0) {
                let checked = form.querySelector('input[name="ozel-siparis-etiketler"]:checked');
                if (!checked) {
                    checked = form.querySelector('input[name="organizasyon-etiketler"]:checked');
                }
                if (!checked) {
                const result = selectEtiket();
                if (result && data.kart_etiket) {
                    updateKartEtiketGorsel(form, data.kart_etiket, organizasyonId);
                }
        }
            }
        }, 10);
    }
    
    // Teslim tarihi
    const ozelSiparisTarihInput = form.querySelector('input[name="teslim-tarihi"]');
    if (ozelSiparisTarihInput && data.teslim_tarihi) {
        ozelSiparisTarihInput.value = data.teslim_tarihi;
    }

    // İl, İlçe, Mahalle
    if (data.organizasyon_il || data.organizasyon_ilce || data.mahalle) {
        const container = form.querySelector('.input-alan-container, .input-alan');
        if (container && window.fillAddressFields) {
            window.fillAddressFields(container, {
                teslim_il: data.organizasyon_il,
                teslim_ilce: data.organizasyon_ilce,
                teslim_mahalle: data.mahalle
            });
        }
    }

    // Açık adres
    const acikAdresInput = form.querySelector('textarea[name="acikadres"]');
    if (acikAdresInput && data.adres) {
        acikAdresInput.value = data.adres;
    }
    
    // Başlık ve açıklamayı güncelle
    const kartBaslik = form.querySelector('.kart-baslik');
    if (kartBaslik) {
        kartBaslik.textContent = 'Özel Sipariş Kartı Düzenle';
    }
    
    const aciklamaSatir = form.closest('.yeni-kart-container')?.querySelector('.tablinks.active .aciklamasatir');
    if (aciklamaSatir) {
        aciklamaSatir.textContent = 'Mevcut özel sipariş kartınızı düzenleyin';
    }
    
    // Butonu GÜNCELLE yap ve edit mode attribute'larını ekle
    const kaydetBtn = form.querySelector('.btn-kart-olustur');
    if (kaydetBtn) {
        kaydetBtn.textContent = 'GÜNCELLE';
        if (organizasyonId) {
            kaydetBtn.setAttribute('data-edit-mode', 'true');
            kaydetBtn.setAttribute('data-organization-id', organizasyonId);
        }
        // Güncelleme modunda data-toast özelliğini kaldır (yanlış toast mesajı gösterilmesin)
        kaydetBtn.removeAttribute('data-toast');
    }
}

// ✅ YENİ: Özel Sipariş kartı formu - Sadece input alanları (radio button'lar hariç)
function fillOzelSiparisKartFormInputsOnly(form, data) {
    // Teslim tarihi
    const ozelSiparisTarihInput = form.querySelector('input[name="teslim-tarihi"]');
    if (ozelSiparisTarihInput && data.teslim_tarihi) {
        ozelSiparisTarihInput.value = data.teslim_tarihi;
    }

    // İl, İlçe, Mahalle
    if (data.organizasyon_il || data.organizasyon_ilce || data.mahalle) {
        const container = form.querySelector('.input-alan-container, .input-alan');
        if (container && window.fillAddressFields) {
            window.fillAddressFields(container, {
                teslim_il: data.organizasyon_il,
                teslim_ilce: data.organizasyon_ilce,
                teslim_mahalle: data.mahalle
            });
    }
    }

    // Açık adres
    const acikAdresInput = form.querySelector('textarea[name="acikadres"]');
    if (acikAdresInput && data.adres) {
        acikAdresInput.value = data.adres;
    }
}

// ✅ YENİ: Özel Sipariş kartı formu - Sadece input alanları (adres ve radio button'lar hariç)
function fillOzelSiparisKartFormInputsOnlyNoAddress(form, data) {
    // Teslim tarihi
    const ozelSiparisTarihInput = form.querySelector('input[name="teslim-tarihi"]');
    if (ozelSiparisTarihInput && data.teslim_tarihi) {
        ozelSiparisTarihInput.value = data.teslim_tarihi;
    }

    // Açık adres
    const acikAdresInput = form.querySelector('textarea[name="acikadres"]');
    if (acikAdresInput && data.adres) {
        acikAdresInput.value = data.adres;
    }
}

// ✅ YENİ: Özel Sipariş kartı formu - Sadece radio button seçimleri
function fillOzelSiparisKartFormRadioButtonsOnly(form, data, organizasyonId = null) {
    // Özel sipariş türü (radio button)
    if (data.kart_turu) {
        const normalizeTurkishChars = (str) => {
            return str.toUpperCase()
                .replace(/İ/g, 'I')
                .replace(/Ğ/g, 'G')
                .replace(/Ü/g, 'U')
                .replace(/Ş/g, 'S')
                .replace(/Ö/g, 'O')
                .replace(/Ç/g, 'C');
        };
        
        const searchValue = normalizeTurkishChars(data.kart_turu);
        const radioButtons = form.querySelectorAll('input[name="orgtur-etiket"]');
        
        if (radioButtons.length > 0) {
            radioButtons.forEach(radio => {
                const label = radio.nextElementSibling;
                const labelText = label?.textContent.trim();
                const normalizedLabelText = normalizeTurkishChars(labelText);
                if (label && normalizedLabelText === searchValue) {
                    radio.checked = true;
                }
            });
        }
    }

    // Etiket (radio button)
    if (data.kart_etiket) {
        let etiketButtons = form.querySelectorAll('input[name="ozel-siparis-etiketler"]');
        if (etiketButtons.length === 0) {
            etiketButtons = form.querySelectorAll('input[name="organizasyon-etiketler"]');
        }
        
        if (etiketButtons.length > 0) {
            const normalizeTurkishChars = (str) => {
                return str.toUpperCase()
                    .replace(/İ/g, 'I')
                    .replace(/Ğ/g, 'G')
                    .replace(/Ü/g, 'U')
                    .replace(/Ş/g, 'S')
                    .replace(/Ö/g, 'O')
                    .replace(/Ç/g, 'C');
            };
            
            const searchEtiket = normalizeTurkishChars(data.kart_etiket);
            let selectedLabel = null;
            
            etiketButtons.forEach(radio => {
                const label = radio.nextElementSibling;
                const labelText = label?.textContent.trim();
                const normalizedLabelText = normalizeTurkishChars(labelText);
                
                if (label && normalizedLabelText === searchEtiket) {
                    radio.checked = true;
                    selectedLabel = labelText;
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
            
            if (selectedLabel && organizasyonId) {
                updateKartEtiketGorsel(form, selectedLabel, organizasyonId);
            }
        }
    }
}

// Araç Süsleme kartı formu doldurma
async function fillAracSuslemeKartForm(form, data, organizasyonId = null) {
    // Null kontrolü
    if (!data) {
        console.warn('⚠️ fillAracSuslemeKartForm: data parametresi null veya undefined');
        return;
    }
    
    // Araç süsleme türü (radio button) - Geliştirilmiş retry mekanizması
    if (data.kart_turu) {
        const selectAracSuslemeTuru = (showWarning = false) => {
            const radioButtons = form.querySelectorAll('input[name="orgtur-etiket"]');
            if (radioButtons.length === 0) {
                // Radio butonları henüz render edilmemiş olabilir - uyarı gösterme (zararsız)
                return false;
            }
            
            // Türkçe karakterleri normalize et
            const normalizeTurkishChars = (str) => {
                return str.toUpperCase()
                    .replace(/İ/g, 'I')
                    .replace(/Ğ/g, 'G')
                    .replace(/Ü/g, 'U')
                    .replace(/Ş/g, 'S')
                    .replace(/Ö/g, 'O')
                    .replace(/Ç/g, 'C');
            };
            
            const searchValue = normalizeTurkishChars(data.kart_turu);

            let found = false;
            
            radioButtons.forEach(radio => {
                const label = radio.nextElementSibling;
                const labelText = label?.textContent.trim();
                const normalizedLabelText = normalizeTurkishChars(labelText);
                if (label && normalizedLabelText === searchValue) {
                    radio.checked = true;
                    found = true;
                }
            });
            
            // Uyarı kaldırıldı - zararsız durum
            
            return found;
        };
        
        // Hemen seç, bekleme yok (uyarı gösterme)
        selectAracSuslemeTuru(false);
        
        // Eğer bulunamadıysa, kısa bir süre sonra tekrar dene
        setTimeout(() => {
            const radioButtons = form.querySelectorAll('input[name="orgtur-etiket"]');
            if (radioButtons.length > 0) {
                const checked = form.querySelector('input[name="orgtur-etiket"]:checked');
                if (!checked) {
                    selectAracSuslemeTuru(false);
                }
            }
        }, 10);
        
        // Form tamamen yüklendikten sonra (500ms) tekrar dene
        setTimeout(() => {
            const radioButtons = form.querySelectorAll('input[name="orgtur-etiket"]');
            if (radioButtons.length > 0) {
                const checked = form.querySelector('input[name="orgtur-etiket"]:checked');
                if (!checked) {
                    selectAracSuslemeTuru(false);
                }
            }
        }, 500);
    }
    
    // Etiket (radio button) - Geliştirilmiş retry mekanizması
    if (data.kart_etiket) {
        const selectEtiket = (showWarning = false) => {
            const etiketButtons = form.querySelectorAll('input[name="arac-susleme-etiketler"]');
            if (etiketButtons.length === 0) {
                // Radio butonları henüz render edilmemiş olabilir - uyarı gösterme (zararsız)
                return false;
            }
            
            // Türkçe karakterleri normalize et
            const normalizeTurkishChars = (str) => {
                return str.toUpperCase()
                    .replace(/İ/g, 'I')
                    .replace(/Ğ/g, 'G')
                    .replace(/Ü/g, 'U')
                    .replace(/Ş/g, 'S')
                    .replace(/Ö/g, 'O')
                    .replace(/Ç/g, 'C');
            };
            
            const searchEtiket = normalizeTurkishChars(data.kart_etiket);

            let found = false;
            
            etiketButtons.forEach(radio => {
                const label = radio.nextElementSibling;
                const labelText = label?.textContent.trim();
                const normalizedLabelText = normalizeTurkishChars(labelText);
                // Normalize edilmiş metinlerle karşılaştır
                if (label && normalizedLabelText === searchEtiket) {
                    radio.checked = true;
                    found = true;
                }
            });
            
            // Uyarı kaldırıldı - zararsız durum
            
            return found;
        };
        
        // Hemen seç, bekleme yok (uyarı gösterme)
        selectEtiket(false);
        
        // Eğer bulunamadıysa, kısa bir süre sonra tekrar dene
        setTimeout(() => {
            const etiketButtons = form.querySelectorAll('input[name="arac-susleme-etiketler"]');
            if (etiketButtons.length > 0) {
                const checked = form.querySelector('input[name="arac-susleme-etiketler"]:checked');
                if (!checked) {
                    selectEtiket(false);
                }
            }
        }, 10);
        
        // Form tamamen yüklendikten sonra (500ms) tekrar dene
        setTimeout(() => {
            const etiketButtons = form.querySelectorAll('input[name="arac-susleme-etiketler"]');
            if (etiketButtons.length > 0) {
                const checked = form.querySelector('input[name="arac-susleme-etiketler"]:checked');
                if (!checked) {
                    selectEtiket(false);
                }
            }
        }, 500);
    }
    
    // Müşteri bilgileri
    const musteriUnvanInput = form.querySelector('#musteriunvan');
    if (musteriUnvanInput && data.musteri_unvan) {
        musteriUnvanInput.value = data.musteri_unvan;
    }
    
    const musteriAdSoyadInput = form.querySelector('#musteriadsoyad');
    if (musteriAdSoyadInput && data.musteri_isim_soyisim) {
        musteriAdSoyadInput.value = data.musteri_isim_soyisim;
    }
    
    const musteriTelefonInput = form.querySelector('#musteritelefon');
    if (musteriTelefonInput && data.siparis_veren_telefon) {
        const telefonDegeri = data.siparis_veren_telefon;
        if (typeof window.formatPhoneNumber === 'function') {
            setPhoneInputValue(musteriTelefonInput, window.formatPhoneNumber(telefonDegeri));
        } else {
            setPhoneInputValue(musteriTelefonInput, telefonDegeri);
        }
        // ✅ ORTAK YAPI: data-phone-input="standard" attribute'unu ekle - phone-formatter.js otomatik formatlayacak
        if (!musteriTelefonInput.hasAttribute('data-phone-input')) {
            musteriTelefonInput.setAttribute('data-phone-input', 'standard');
        }
    }
    
    // Ürün yazısı - Önce data.urun_yazisi varsa direkt kullan (siparisnotalan gibi), yoksa müşteri ID'den backend'den çek
    const urunYazisiTextarea = form.querySelector('textarea[name="urun_yazisi"]');
    if (urunYazisiTextarea) {
        // Önce data.urun_yazisi varsa direkt kullan (siparisnotalan gibi)
        if (data.urun_yazisi) {
            urunYazisiTextarea.value = data.urun_yazisi;
        } else {
            // data.urun_yazisi yoksa, müşteri ID varsa backend'den müşterinin musteri_urun_yazisi değerini çek
            let musteriId = data.musteri_id || data.customer_id || data.siparis_veren_id;
            if (!musteriId) {
                const musteriIdInput = form.querySelector('input[name="musteri-id"]');
                if (musteriIdInput && musteriIdInput.value) {
                    musteriId = musteriIdInput.value;
                }
            }
            // Müşteri ID bulunamazsa, müşteri unvanından ID'yi bulmayı dene
            if (!musteriId && data.musteri_unvan && window.musteriVerileri) {
                const musteri = window.musteriVerileri.find(m => m.unvan === data.musteri_unvan);
                if (musteri && musteri.id) {
                    musteriId = musteri.id;
                }
            }
            
            if (musteriId) {
                try {
                    const API_BASE_URL = window.getFloovonApiBase ? window.getFloovonApiBase() : (window.API_BASE_URL || '/api');
                    const fetchFn = window.floovonFetch || window.floovonFetchStandard || fetch;
                    const musteriResponse = await fetchFn(`${API_BASE_URL}/customers/${musteriId}`);
                    if (musteriResponse && musteriResponse.ok) {
                        const musteriResult = typeof musteriResponse.json === 'function' ? await musteriResponse.json() : musteriResponse;
                        if (musteriResult && (musteriResult.data || musteriResult)) {
                            const musteriData = musteriResult.data || musteriResult;
                            const musteriUrunYazisi = musteriData.musteri_urun_yazisi || musteriData.urunYazisi || '';
                            if (musteriUrunYazisi) {
                                urunYazisiTextarea.value = musteriUrunYazisi;
                            }
                        }
                    }
                } catch (error) {
                    console.warn('⚠️ Müşteri ürün yazısı yüklenemedi:', error);
                }
            }
        }
    }
    
    // Ürün fiyatı
    const urunFiyatInput = form.querySelector('#urunfiyat');
    if (urunFiyatInput && data.siparis_tutari) {
        // ✅ DÜZELTME: Backend'den gelen değer number olabilir (99.5) veya string olabilir ("99.5")
        // ÖNEMLİ: setTLInputValue number bekliyor, string değil
        let fiyatNumeric;
        if (typeof data.siparis_tutari === 'number') {
            fiyatNumeric = data.siparis_tutari;
        } else {
            // String ise parse et
            fiyatNumeric = (typeof window.parseTL === 'function') 
                ? window.parseTL(String(data.siparis_tutari)) 
                : parseFloat(String(data.siparis_tutari).replace(/[^\d.]/g, '')) || 0;
        }
        
        // ✅ YENİ: Ortak TL formatter utility kullanılıyor
        if (typeof window.setTLInputValue === 'function') {
            window.setTLInputValue(urunFiyatInput, fiyatNumeric);
        } else {
            // Fallback
            const fiyatStr = String(fiyatNumeric).replace(/\./g, ',');
            urunFiyatInput.value = fiyatStr + ' TL';
        }
    }
    
    // Sipariş ürün açıklaması
    const siparisUrunAciklamaInput = form.querySelector('#siparisurunaciklama');
    if (siparisUrunAciklamaInput && data.siparis_urun_aciklama) {
        siparisUrunAciklamaInput.value = data.siparis_urun_aciklama;
    }
    
    // Ekstra ücretlendirme açıklaması
    const ekstraUcretAciklamaInput = form.querySelector('#ekstraucretaciklama');
    if (ekstraUcretAciklamaInput && data.ekstra_ucret_aciklama) {
        ekstraUcretAciklamaInput.value = data.ekstra_ucret_aciklama;
    }
    
    // Ekstra ücretlendirme tutarı
    const ekstraUcretTutariInput = form.querySelector('#ekstraucrettutar');
    if (ekstraUcretTutariInput && data.ekstra_ucret_tutari) {
        // ✅ DÜZELTME: Backend'den gelen değer number olabilir (99.5) veya string olabilir ("99.5")
        // ÖNEMLİ: setTLInputValue number bekliyor, string değil
        let ekstraUcretNumeric;
        if (typeof data.ekstra_ucret_tutari === 'number') {
            ekstraUcretNumeric = data.ekstra_ucret_tutari;
        } else {
            // String ise parse et
            ekstraUcretNumeric = (typeof window.parseTL === 'function') 
                ? window.parseTL(String(data.ekstra_ucret_tutari)) 
                : parseFloat(String(data.ekstra_ucret_tutari).replace(/[^\d.]/g, '')) || 0;
        }
        
        // ✅ YENİ: Ortak TL formatter utility kullanılıyor
        if (typeof window.setTLInputValue === 'function') {
            window.setTLInputValue(ekstraUcretTutariInput, ekstraUcretNumeric);
        } else {
            // Fallback
            const ekstraUcretStr = String(ekstraUcretNumeric).replace(/\./g, ',');
            ekstraUcretTutariInput.value = ekstraUcretStr + ' TL';
        }
    }
    
    // Comment/Ekstra not
    const commentTextarea = form.querySelector('#siparisnotalan');
    if (commentTextarea && data.notes) {
        commentTextarea.value = data.notes;
    }
    
    // Ödeme yöntemi
    if (data.odeme_yontemi) {
        const odemeYontemi = data.odeme_yontemi;
        let radioId = '';
        
        switch(odemeYontemi) {
            case 'NAKİT':
                radioId = 'ut-nakit';
                break;
            case 'HAVALE/EFT':
                radioId = 'ut-havaleeft';
                break;
            case 'POS':
                radioId = 'ut-kredikarti';
                break;
            case 'CARİ HESAP':
            case 'MÜŞTERİ CARİ HESAP':
            case 'cari':
            case 'cari hesap':
            default:
                radioId = 'ut-cari';
                break;
        }
        
        const radioButton = form.querySelector(`#${radioId}`);
        if (radioButton) {
            radioButton.checked = true;
        }
    }
    
    // Araç bilgileri alanları (Araç Süsleme için önemli!)
    const aracMarkaModel = form.querySelector('.arac-marka-model, input[name="arac-marka-model"]');
    if (aracMarkaModel && data.arac_markamodel) {
        aracMarkaModel.value = data.arac_markamodel;
    } else {
    }
    
    const aracRenk = form.querySelector('.arac-renk, input[name="arac-renk"]');
    if (aracRenk && data.arac_renk) {
        aracRenk.value = data.arac_renk;
    } else {
    }
    
    const aracPlaka = form.querySelector('.arac-plaka, input[name="arac-plaka"]');
    if (aracPlaka && data.arac_plaka) {
        aracPlaka.value = data.arac_plaka;
    } else {
    }
    
    // Araç randevu saati (Araç Süsleme için önemli!)
    const aracRandevuSaatInput = form.querySelector('#arac-randevu-saat, input[name="arac-randevu-saat"]');
    if (aracRandevuSaatInput && data.arac_randevu_saat) {
        aracRandevuSaatInput.value = data.arac_randevu_saat;
    } else {
    }
    
    // Randevu tarihi
    const aracSuslemeTarihInput = form.querySelector('input[name="teslim-tarihi"]');
    if (aracSuslemeTarihInput && data.teslim_tarihi) {
        aracSuslemeTarihInput.value = data.teslim_tarihi;
    }
    
    // Başlık ve açıklamayı güncelle
    const kartBaslik = form.querySelector('.kart-baslik');
    if (kartBaslik) {
        kartBaslik.textContent = 'Araç Süsleme Kartı Düzenle';
    }
    
    const aciklamaSatir = form.closest('.yeni-kart-container')?.querySelector('.tablinks.active .aciklamasatir');
    if (aciklamaSatir) {
        aciklamaSatir.textContent = 'Mevcut araç süsleme kartınızı düzenleyin';
    }
    
    // Butonu GÜNCELLE yap ve edit mode attribute'larını ekle
    const kaydetBtn = form.querySelector('.btn-kart-olustur');
    if (kaydetBtn) {
        kaydetBtn.textContent = 'GÜNCELLE';
        if (organizasyonId) {
            kaydetBtn.setAttribute('data-edit-mode', 'true');
            kaydetBtn.setAttribute('data-organization-id', organizasyonId);
        }
        // Güncelleme modunda data-toast özelliğini kaldır (yanlış toast mesajı gösterilmesin)
        kaydetBtn.removeAttribute('data-toast');
    }
}

// ✅ YENİ: Araç Süsleme kartı formu - Sadece input alanları (adres ve radio button'lar hariç)
async function fillAracSuslemeKartFormInputsOnlyNoAddress(form, data) {
    // Müşteri bilgileri
    const musteriUnvanInput = form.querySelector('#musteriunvan');
    if (musteriUnvanInput && data.musteri_unvan) {
        musteriUnvanInput.value = data.musteri_unvan;
    }
    
    const musteriAdSoyadInput = form.querySelector('#musteriadsoyad');
    if (musteriAdSoyadInput && data.musteri_isim_soyisim) {
        musteriAdSoyadInput.value = data.musteri_isim_soyisim;
    }
    
    const musteriTelefonInput = form.querySelector('#musteritelefon');
    if (musteriTelefonInput && data.siparis_veren_telefon) {
        setPhoneInputValue(musteriTelefonInput, data.siparis_veren_telefon);
    }
    
    // Ürün yazısı - Önce data.urun_yazisi varsa direkt kullan
    const urunYazisiTextarea = form.querySelector('textarea[name="urun_yazisi"]');
    if (urunYazisiTextarea && data.urun_yazisi) {
        urunYazisiTextarea.value = data.urun_yazisi;
    }
    
    // Ürün fiyatı
    const urunFiyatInput = form.querySelector('#urunfiyat');
    if (urunFiyatInput && data.siparis_tutari) {
        let fiyatNumeric;
        if (typeof data.siparis_tutari === 'number') {
            fiyatNumeric = data.siparis_tutari;
        } else {
            fiyatNumeric = (typeof window.parseTL === 'function') 
                ? window.parseTL(String(data.siparis_tutari)) 
                : parseFloat(String(data.siparis_tutari).replace(/[^\d.]/g, '')) || 0;
    }
    
        if (typeof window.setTLInputValue === 'function') {
            window.setTLInputValue(urunFiyatInput, fiyatNumeric);
        } else {
            const fiyatStr = String(fiyatNumeric).replace(/\./g, ',');
            urunFiyatInput.value = fiyatStr + ' TL';
        }
    }
    
    // Sipariş ürün açıklaması
    const siparisUrunAciklamaInput = form.querySelector('#siparisurunaciklama');
    if (siparisUrunAciklamaInput && data.siparis_urun_aciklama) {
        siparisUrunAciklamaInput.value = data.siparis_urun_aciklama;
    }
    
    // Ekstra ücretlendirme açıklaması
    const ekstraUcretAciklamaInput = form.querySelector('#ekstraucretaciklama');
    if (ekstraUcretAciklamaInput && data.ekstra_ucret_aciklama) {
        ekstraUcretAciklamaInput.value = data.ekstra_ucret_aciklama;
    }
    
    // Ekstra ücretlendirme tutarı
    const ekstraUcretTutariInput = form.querySelector('#ekstraucrettutar');
    if (ekstraUcretTutariInput && data.ekstra_ucret_tutari) {
        let ekstraUcretNumeric;
        if (typeof data.ekstra_ucret_tutari === 'number') {
            ekstraUcretNumeric = data.ekstra_ucret_tutari;
        } else {
            ekstraUcretNumeric = (typeof window.parseTL === 'function') 
                ? window.parseTL(String(data.ekstra_ucret_tutari)) 
                : parseFloat(String(data.ekstra_ucret_tutari).replace(/[^\d.]/g, '')) || 0;
        }
        
        if (typeof window.setTLInputValue === 'function') {
            window.setTLInputValue(ekstraUcretTutariInput, ekstraUcretNumeric);
        } else {
            const ekstraUcretStr = String(ekstraUcretNumeric).replace(/\./g, ',');
            ekstraUcretTutariInput.value = ekstraUcretStr + ' TL';
        }
    }
    
    // Comment/Ekstra not
    const commentTextarea = form.querySelector('#siparisnotalan');
    if (commentTextarea && data.notes) {
        commentTextarea.value = data.notes;
    }
    
    // Ödeme yöntemi (radio button ama input gibi davranıyor)
    if (data.odeme_yontemi) {
        const odemeYontemi = data.odeme_yontemi;
        let radioId = '';
        
        switch(odemeYontemi) {
            case 'NAKİT':
                radioId = 'ut-nakit';
                break;
            case 'HAVALE/EFT':
                radioId = 'ut-havaleeft';
                break;
            case 'POS':
                radioId = 'ut-kredikarti';
                break;
            case 'CARİ HESAP':
            case 'MÜŞTERİ CARİ HESAP':
            case 'cari':
            case 'cari hesap':
            default:
                radioId = 'ut-cari';
                break;
        }
        
        const radioButton = form.querySelector(`#${radioId}`);
        if (radioButton) {
            radioButton.checked = true;
        }
    }
    
    // Araç bilgileri
    const aracMarkaModel = form.querySelector('.arac-marka-model, input[name="arac-marka-model"]');
    if (aracMarkaModel && data.arac_markamodel) {
        aracMarkaModel.value = data.arac_markamodel;
    }
    
    const aracRenk = form.querySelector('.arac-renk, input[name="arac-renk"]');
    if (aracRenk && data.arac_renk) {
        aracRenk.value = data.arac_renk;
    }
    
    const aracPlaka = form.querySelector('.arac-plaka, input[name="arac-plaka"]');
    if (aracPlaka && data.arac_plaka) {
        aracPlaka.value = data.arac_plaka;
    }
    
    // Araç randevu saati
    const aracRandevuSaatInput = form.querySelector('#arac-randevu-saat, input[name="arac-randevu-saat"]');
    if (aracRandevuSaatInput && data.arac_randevu_saat) {
        aracRandevuSaatInput.value = data.arac_randevu_saat;
    }
    
    // Randevu tarihi
    const aracSuslemeTarihInput = form.querySelector('input[name="teslim-tarihi"]');
    if (aracSuslemeTarihInput && data.teslim_tarihi) {
        aracSuslemeTarihInput.value = data.teslim_tarihi;
    }
}

// ✅ YENİ: Araç Süsleme kartı formu - Sadece radio button seçimleri
function fillAracSuslemeKartFormRadioButtonsOnly(form, data, organizasyonId = null) {
    // Araç süsleme türü (radio button)
    if (data.kart_turu) {
        const normalizeTurkishChars = (str) => {
            return str.toUpperCase()
                .replace(/İ/g, 'I')
                .replace(/Ğ/g, 'G')
                .replace(/Ü/g, 'U')
                .replace(/Ş/g, 'S')
                .replace(/Ö/g, 'O')
                .replace(/Ç/g, 'C');
        };
        
        const searchValue = normalizeTurkishChars(data.kart_turu);
        const radioButtons = form.querySelectorAll('input[name="orgtur-etiket"]');
        
        if (radioButtons.length > 0) {
            radioButtons.forEach(radio => {
                const label = radio.nextElementSibling;
                const labelText = label?.textContent.trim();
                const normalizedLabelText = normalizeTurkishChars(labelText);
                if (label && normalizedLabelText === searchValue) {
                    radio.checked = true;
                }
            });
        }
    }

    // Etiket (radio button)
    if (data.kart_etiket) {
        const etiketButtons = form.querySelectorAll('input[name="arac-susleme-etiketler"]');
        if (etiketButtons.length > 0) {
            const normalizeTurkishChars = (str) => {
                return str.toUpperCase()
                    .replace(/İ/g, 'I')
                    .replace(/Ğ/g, 'G')
                    .replace(/Ü/g, 'U')
                    .replace(/Ş/g, 'S')
                    .replace(/Ö/g, 'O')
                    .replace(/Ç/g, 'C');
            };
            
            const searchEtiket = normalizeTurkishChars(data.kart_etiket);
            
            etiketButtons.forEach(radio => {
                const label = radio.nextElementSibling;
                const labelText = label?.textContent.trim();
                const normalizedLabelText = normalizeTurkishChars(labelText);
                
                if (label && normalizedLabelText === searchEtiket) {
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        }
    }
}

// === INIT: Bu dosya dinamik yüklendiğinde DOMContentLoaded zaten geçmiş olabilir ===
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
        setupKartiDuzenleDelegated();
    });
} else {
    setupKartiDuzenleDelegated();
}
// #endregion Kart Menu Content - Kartı Düzenle

// Global fonksiyonlar
window.setupKartiDuzenleDelegated = setupKartiDuzenleDelegated;
window.editOrganizationCardWithData = editOrganizationCardWithData;
window.fillOrganizationEditForm = fillOrganizationEditForm;
window.fillOrganizasyonKartForm = fillOrganizasyonKartForm;
window.fillOzelGunKartForm = fillOzelGunKartForm;
window.fillOzelSiparisKartForm = fillOzelSiparisKartForm;
window.fillAracSuslemeKartForm = fillAracSuslemeKartForm;
window.updateKartEtiketGorsel = updateKartEtiketGorsel;
