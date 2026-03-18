/**
 * Arac Takip Sistemi
 * script.js'ten tasindi (2026-02-07)
 * - initTeslimatTakip: Mobil teslimat takip
 * - Reverse Geocoding: Koordinatlari adrese cevir
 * - loadVehicleList: Web arac listesi
 * - Arac Takip Sistemi: GPS card, live map, vehicle detail, modal
 */
// Lucide Van ikonu (index araç takip alanı ile aynı)
var LUCIDE_VAN_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-van vehicle-tracking-lucide-icon" aria-hidden="true"><path d="M13 6v5a1 1 0 0 0 1 1h6.102a1 1 0 0 1 .712.298l.898.91a1 1 0 0 1 .288.702V17a1 1 0 0 1-1 1h-3"></path><path d="M5 18H3a1 1 0 0 1-1-1V8a2 2 0 0 1 2-2h12c1.1 0 2.1.8 2.4 1.8l1.176 4.2"></path><path d="M9 18h5"></path><circle cx="16" cy="18" r="2"></circle><circle cx="7" cy="18" r="2"></circle></svg>';
var LUCIDE_VAN_ICON_16 = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-van vehicle-tracking-lucide-icon" aria-hidden="true"><path d="M13 6v5a1 1 0 0 0 1 1h6.102a1 1 0 0 1 .712.298l.898.91a1 1 0 0 1 .288.702V17a1 1 0 0 1-1 1h-3"></path><path d="M5 18H3a1 1 0 0 1-1-1V8a2 2 0 0 1 2-2h12c1.1 0 2.1.8 2.4 1.8l1.176 4.2"></path><path d="M9 18h5"></path><circle cx="16" cy="18" r="2"></circle><circle cx="7" cy="18" r="2"></circle></svg>';
var LUCIDE_VAN_ICON_32 = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-van vehicle-tracking-lucide-icon" style="opacity:0.3" aria-hidden="true"><path d="M13 6v5a1 1 0 0 0 1 1h6.102a1 1 0 0 1 .712.298l.898.91a1 1 0 0 1 .288.702V17a1 1 0 0 1-1 1h-3"></path><path d="M5 18H3a1 1 0 0 1-1-1V8a2 2 0 0 1 2-2h12c1.1 0 2.1.8 2.4 1.8l1.176 4.2"></path><path d="M9 18h5"></path><circle cx="16" cy="18" r="2"></circle><circle cx="7" cy="18" r="2"></circle></svg>';
// #region Araç Takip Wrapper Web ve Mobil Alanları

//#region Mobilde Araç Takip İçin "Teslimata Çıktım Butonu"
function initTeslimatTakip() {
    // TeslimatTakip sınıfı
    class TeslimatTakip {
        constructor() {
            this.durum = 'beklemede';
            this.baslangicZamani = null;
            this.watchId = null;
            this.sureInterval = null;
            this.sonKonum = null;
            this.aracId = null;
            this.surucuId = null;
            this.teslimatId = null;
            this.konumGondermeInterval = null;
            // loadFromLocalStorage artık async, await kullanmadan çağırıyoruz
            this.loadFromLocalStorage().then(() => {
                this.loadAraclarToDropdown(); // Araçları dropdown'a yükle
                this.updateUI();
            });
        }

        // LocalStorage'dan mevcut teslimat bilgilerini yükle ve backend'den doğrula
        async loadFromLocalStorage() {
            const kaydedilmisVeri = localStorage.getItem('teslimatDurum');
            if (kaydedilmisVeri) {
                try {
                    const veri = JSON.parse(kaydedilmisVeri);
                    if (veri.durum === 'aktif' && veri.aracId) {
                        // Backend'den bu araç için aktif teslimat var mı kontrol et
                        try {
                            const API_BASE_URL = window.getFloovonApiBase ? window.getFloovonApiBase() : (window.API_BASE_URL || '/api');
                            const response = await fetch(`${API_BASE_URL}/arac-takip/guncel-konumlar`);
                            const backendData = await response.json();
                            
                            if (backendData.success && backendData.data && backendData.data.length > 0) {
                                // Bu araç için aktif teslimat var mı kontrol et
                                const aktifArac = backendData.data.find(arac => {
                                    const aracId = arac.id || arac.arac_id;
                                    const durum = arac.durum || '';
                                    return aracId == veri.aracId && durum === 'teslimatta';
                                });
                                
                                if (aktifArac) {
                                    // Backend'de aktif teslimat var, LocalStorage'daki veriyi kullan
                                    this.durum = veri.durum;
                                    this.baslangicZamani = veri.baslangicZamani ? new Date(veri.baslangicZamani) : null;
                                    this.aracId = veri.aracId;
                                    this.surucuId = veri.surucuId;
                                    this.teslimatId = veri.teslimatId;
                                    // GPS takibini yeniden başlat - kullanıcı etkileşimi sonrasına ertele
                                    // Violation hatası önlemek için setTimeout ile ertele
                                    setTimeout(() => {
                                        // Kullanıcı sayfayı görüntülediğinde GPS çağrısı yap
                                        if (document.visibilityState === 'visible') {
                                            this.devamEt();
                                        } else {
                                            // Sayfa görünür olduğunda çağır
                                            const visibilityHandler = () => {
                                                if (document.visibilityState === 'visible') {
                                                    this.devamEt();
                                                    document.removeEventListener('visibilitychange', visibilityHandler);
                                                }
                                            };
                                            document.addEventListener('visibilitychange', visibilityHandler);
                                        }
                                    }, 1000); // 1 saniye bekle
                                } else {
                                    // Backend'de aktif teslimat yok, LocalStorage'ı temizle
                                    localStorage.removeItem('teslimatDurum');
                                    this.durum = 'beklemede';
                                }
                            } else {
                                // Backend'de aktif teslimat yok, LocalStorage'ı temizle
                                localStorage.removeItem('teslimatDurum');
                                this.durum = 'beklemede';
                            }
                        } catch (error) {
                            console.error('❌ Backend kontrol hatası:', error);
                            // Hata durumunda LocalStorage'ı temizle (güvenli tarafta kal)
                            localStorage.removeItem('teslimatDurum');
                            this.durum = 'beklemede';
                        }
                    }
                } catch (e) {
                    console.error('LocalStorage veri okuma hatası:', e);
                    localStorage.removeItem('teslimatDurum');
                }
            }

            // Araç bilgisini al
            if (!this.aracId) this.aracId = localStorage.getItem('secilenAracId');
            
            // Sürücü ID'yi oturum sahibinden al (artık sürücüler tablosu kullanılmıyor)
            if (!this.surucuId) {
                if (window.userSession && window.userSession.getUser) {
                    const currentUser = window.userSession.getUser();
                    this.surucuId = currentUser ? (currentUser.id || 1) : 1;
                } else {
                    this.surucuId = 1; // Fallback
                }
            }
        }

        // Araçları dropdown'a yükle
        async loadAraclarToDropdown() {
            try {
                // floovonFetch kullan - header'ları otomatik ekler, apiBase'i otomatik ekler
                // Eğer floovonFetch yoksa, getFloovonApiBase() kullanarak tam URL oluştur
                const fetchFn = window.floovonFetch || window.floovonFetchStandard;
                let response;
                let data;
                
                // Önce aktif_only=true ile dene
                if (fetchFn) {
                    response = await fetchFn(`/api/araclar?aktif_only=true`);
                } else {
                    // Fallback: getFloovonApiBase() kullan
                    const apiBase = (typeof window.getFloovonApiBase === 'function') 
                        ? window.getFloovonApiBase() 
                        : (window.API_BASE_URL || (window.location.origin ? window.location.origin + '/api' : '/api'));
                    const url = `${apiBase}/araclar?aktif_only=true`;
                    const token = localStorage.getItem('floovon_token');
                    const headers = { 'Content-Type': 'application/json' };
                    if (token) headers['Authorization'] = `Bearer ${token}`;
                    // ✅ DÜZELTME: Cookie'leri gönder (credentials: 'include')
                    response = await fetch(url, { 
                        headers,
                        credentials: 'include' // Cookie'leri gönder
                    });
                }
                
                // Response kontrolü - 400 Bad Request gibi hataları handle et
                if (response && typeof response.status !== 'undefined' && response.status === 400) {
                    // Backend bu query parameter'ı desteklemiyor veya tenant ID bulunamadı, aktif_only olmadan tekrar dene
                    if (fetchFn) {
                        response = await fetchFn(`/api/araclar`);
                    } else {
                        const apiBase = (typeof window.getFloovonApiBase === 'function') 
                            ? window.getFloovonApiBase() 
                            : (window.API_BASE_URL || (window.location.origin ? window.location.origin + '/api' : '/api'));
                        const url = `${apiBase}/araclar`;
                        const token = localStorage.getItem('floovon_token');
                        const headers = { 'Content-Type': 'application/json' };
                        if (token) headers['Authorization'] = `Bearer ${token}`;
                        // ✅ DÜZELTME: Cookie'leri gönder (credentials: 'include')
                        response = await fetch(url, { 
                            headers,
                            credentials: 'include' // Cookie'leri gönder
                        });
                    }
                    // İkinci deneme de başarısız olursa sessizce atla (hata mesajı gösterme)
                    if (response && typeof response.status !== 'undefined' && response.status === 400) {
                        return; // Sessizce çık, hata mesajı gösterme
                    }
                }
                
                // floovonFetch kullanıldığında response zaten parse edilmiş oluyor
                data = (response && typeof response.json === 'function') ? await response.json() : response;

                if (!data || !data.success) {
                    // Sessizce atla - kritik değil
                    return;
                }
                
                // Eğer aktif_only desteklenmiyorsa, frontend'de filtrele (aktif olanları al)
                let araclar = data.data || [];
                if (araclar.length > 0 && araclar[0].hasOwnProperty('aktif')) {
                    araclar = araclar.filter(arac => arac.aktif === true || arac.aktif === 1);
                }

                const dropdown = document.getElementById('aracSecim');
                if (!dropdown) return;

                dropdown.innerHTML = '<option value="">Araç seçiniz...</option>';

                araclar.forEach(arac => {
                    const option = document.createElement('option');
                    option.value = arac.id;
                    option.textContent = `${arac.plaka} - ${arac.marka || ''} ${arac.model || ''}`.trim();
                    // Artık surucu_id kullanılmıyor, oturum sahibi sürücü olacak
                    dropdown.appendChild(option);
                });

                // Daha önce seçilmiş araç varsa onu seç
                const secilenAracId = localStorage.getItem('secilenAracId');
                if (secilenAracId) {
                    dropdown.value = secilenAracId;
                }

                // Dropdown değişikliğini dinle
                dropdown.addEventListener('change', (e) => {
                    this.aracId = e.target.value;
                    // Sürücü ID'yi oturum sahibinden al
                    if (window.userSession && window.userSession.getUser) {
                        const currentUser = window.userSession.getUser();
                        this.surucuId = currentUser ? (currentUser.id || 1) : 1;
                    } else {
                        this.surucuId = 1;
                    }
                    
                    // LocalStorage'a kaydet
                    if (this.aracId) {
                        localStorage.setItem('secilenAracId', this.aracId);
                    } else {
                        localStorage.removeItem('secilenAracId');
                    }
                });
            } catch (error) {
                console.error('Araçlar yüklenirken hata:', error);
            }
        }

        // Teslimatı devam ettir (sayfa yenilendiğinde)
        devamEt() {
            if (!navigator.geolocation) {
                console.error('🚨 GPS Hatası: Bu cihaz GPS desteklemiyor!');
                return;
            }

            const options = {
                enableHighAccuracy: false, // true yapmak daha yavaş ve timeout'a neden olabilir
                timeout: 60000, // 60 saniye - GPS timeout sorununu çözmek için daha uzun süre
                maximumAge: 60000 // 60 saniye önceden alınmış konumu kabul et (daha hızlı yanıt için)
            };

            this.watchId = navigator.geolocation.watchPosition(
                (pos) => this.konumGuncelle(pos),
                (error) => this.gpsHatasi(error),
                options
            );

            this.sureSayaciniBaslat();
            this.konumGondermeBaslat();
        }

        toggleTeslimat() {
            if (this.durum === 'beklemede') {
                this.teslimatBaslat();
            } else if (this.durum === 'aktif') {
                this.teslimatTamamla();
            }
        }

        async teslimatBaslat() {
            return new Promise((resolve, reject) => {
                this.showLoading(true);

                // Araç seçimi kontrolü
                if (!this.aracId) {
                    createToast({
                        message: 'Lütfen önce bir araç seçin!',
                        type: 'warning',
                        position: 'center'
                    });
                    this.showLoading(false);
                    reject(new Error('Araç seçilmedi'));
                    return;
                }

                if (!navigator.geolocation) {
                    console.error('🚨 GPS Hatası: Bu cihaz GPS desteklemiyor!');
                    createToast({
                        message: 'GPS desteklenmiyor!',
                        type: 'error',
                        position: 'center'
                    });
                    this.showLoading(false);
                    reject(new Error('GPS desteklenmiyor'));
                    return;
                }

                const options = {
                    enableHighAccuracy: false, // true yapmak daha yavaş ve timeout'a neden olabilir
                    timeout: 60000, // 60 saniye - GPS timeout sorununu çözmek için daha uzun süre
                    maximumAge: 60000 // 60 saniye önceden alınmış konumu kabul et (daha hızlı yanıt için)
                };

                // GPS test modu kontrolü
                const isGPSTestMode = window.mockGPS && window.mockGPS.active;
                
                // Önce GPS izni kontrolü yap (test modu değilse)
                if (!isGPSTestMode && document.hidden) {
                    // Sekme arka plandaysa uyarı ver
                    createToast({
                        message: 'GPS konum almak için bu sekmeyi aktif tutun!',
                        type: 'warning',
                        position: 'center'
                    });
                    this.showLoading(false);
                    reject(new Error('Sekme arka planda'));
                    return;
                }
                
                // Tarayıcının kendi izin mesajını göstermesi için direkt getCurrentPosition çağır
                // İlk çağrıda tarayıcı otomatik olarak izin dialog'unu gösterir
                // Eğer izin daha önce reddedilmişse, tarayıcı mesaj göstermez ve hata callback'i çalışır
                // Bu durumda kullanıcıya açık bir mesaj gösteririz
                navigator.geolocation.getCurrentPosition(
                async (position) => {
                    try {
                        // Sürücü ID'yi oturum sahibinden al (her zaman güncel olsun)
                        let surucuId = this.surucuId;
                        if (window.userSession && window.userSession.getUser) {
                            const currentUser = window.userSession.getUser();
                            surucuId = currentUser ? (currentUser.id || 1) : 1;
                        } else {
                            surucuId = 1;
                        }
                        this.surucuId = surucuId;
                        
                        // Backend'e teslimat başlatma isteği gönder - floovonFetch kullan
                        const API_BASE_URL = window.getFloovonApiBase ? window.getFloovonApiBase() : (window.API_BASE_URL || '/api');
                        const data = await (window.floovonFetch || fetch)(`${API_BASE_URL}/arac-takip/${this.aracId}/teslimat/baslat`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                surucu_id: surucuId,
                                baslangic_konum_lat: position.coords.latitude,
                                baslangic_konum_lng: position.coords.longitude
                            })
                        });

                        // floovonFetch zaten JSON parse ediyor, kontrol et
                        if (!data || !data.success) {
                            throw new Error(data?.error || data?.message || 'Teslimat başlatılamadı');
                        }

                        this.teslimatId = data.data.id;
                        this.durum = 'aktif';
                        this.baslangicZamani = new Date();
                        this.sonKonum = position;

                        // LocalStorage'a kaydet
                        this.anaSayfaGuncelle();

                        // GPS izlemeyi başlat
                        this.watchId = navigator.geolocation.watchPosition(
                            (pos) => this.konumGuncelle(pos),
                            (error) => this.gpsHatasi(error),
                            options
                        );

                        this.sureSayaciniBaslat();
                        this.konumGondermeBaslat();
                        this.showLoading(false);
                        this.updateUI();

                        // Araç listesini güncelle (web görünümde aktif görünmesi için)
                        if (typeof loadVehicleList === 'function') {
                            // Backend'de durum güncellensin diye biraz bekle
                            setTimeout(() => {
                                loadVehicleList();
                            }, 1000); // 1 saniye bekle ki backend'de durum kesinlikle güncellensin
                        }
                        resolve(data);
                    } catch (error) {
                        console.error('Teslimat başlatma hatası:', error);
                        createToast({
                            message: 'Teslimat başlatılırken hata: ' + error.message,
                            type: 'error',
                            position: 'center'
                        });
                        this.showLoading(false);
                        reject(error);
                    }
                },
                (error) => {
                    this.showLoading(false);
                    
                    // GPS hatası durumunda kullanıcıya açık bilgi ver
                    let hataMesaji = '';
                    let hataDetay = '';
                    let hataBaslik = '';
                    
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            hataBaslik = '📍 Konum İzni Gerekli';
                            hataMesaji = 'Konum izni verilmedi veya reddedildi!';
                            hataDetay = 'Teslimat takibi için konum izni gereklidir.\n\nLütfen:\n1. Tarayıcı ayarlarından bu site için konum izni verin\n2. Cihazınızda konum servisini açın\n3. Sayfayı yenileyip tekrar deneyin';
                            this.durum = 'beklemede';
                            this.anaSayfaGuncelle();
                            break;
                        case error.POSITION_UNAVAILABLE:
                            hataBaslik = '📍 Konum Servisi Kapalı';
                            hataMesaji = 'Konum bilgisi alınamıyor!';
                            hataDetay = 'Cihazınızda konum servisi kapalı görünüyor.\n\nLütfen:\n1. Cihaz ayarlarından konum servisini açın\n2. İnternet bağlantınızı kontrol edin\n3. Tekrar deneyin';
                            this.durum = 'beklemede';
                            this.anaSayfaGuncelle();
                            break;
                        case error.TIMEOUT:
                            hataBaslik = '⏱️ Konum Alma Zaman Aşımı';
                            hataMesaji = 'Konum alınamadı!';
                            hataDetay = 'Konum bilgisi alınırken zaman aşımı oluştu.\n\nLütfen:\n1. Konum servisinin açık olduğundan emin olun\n2. İnternet bağlantınızı kontrol edin\n3. Tekrar deneyin';
                            this.durum = 'beklemede';
                            this.anaSayfaGuncelle();
                            // Popup'ı kapat
                            if (typeof closeAracTakipModal === 'function') {
                                closeAracTakipModal();
                            }
                            break;
                        default:
                            hataBaslik = '❌ Konum Hatası';
                            hataMesaji = 'Konum alınamadı!';
                            hataDetay = 'Bilinmeyen bir hata oluştu.\n\nLütfen:\n1. Konum servisini açın\n2. Tarayıcı izinlerini kontrol edin\n3. Tekrar deneyin';
                            this.durum = 'beklemede';
                            this.anaSayfaGuncelle();
                    }
                    
                    console.error('❌ GPS Hatası:', error.code, hataMesaji, error);
                    this.gpsHatasi(error);
                    
                    // Daha anlaşılır ve görsel bir hata mesajı göster
                    // Tarayıcı kendi izin mesajını göstermediği için biz gösteriyoruz
                    createToast({
                        message: `${hataBaslik}\n\n${hataMesaji}\n\n${hataDetay}`,
                        type: 'error',
                        position: 'center',
                        duration: 10000 // 10 saniye göster - kullanıcının okuması için daha uzun
                    });
                    
                    // Promise'i reject et
                    // Popup'ı kapat
                    if (typeof closeAracTakipModal === 'function') {
                        closeAracTakipModal();
                    }
                    reject(new Error(hataMesaji));
                },
                options
            );
            });
        }

        teslimatTamamla() {
            const sure = this.gecenSureyiHesapla();
            
            // Toast göster ve kullanıcı onayını bekle
            createToastInteractive({
                message: `Teslimatı tamamlamak istediğinizden emin misiniz?\nSüre: ${sure}`,
                confirmText: 'Evet',
                cancelText: 'Hayır',
                onConfirm: async () => {
                    try {
                        // Backend'e teslimat tamamlama isteği gönder
                        const API_BASE_URL = window.getFloovonApiBase ? window.getFloovonApiBase() : (window.API_BASE_URL || '/api');
                        const response = await fetch(`${API_BASE_URL}/arac-takip/${this.aracId}/teslimat/tamamla`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                bitis_konum_lat: this.sonKonum?.coords.latitude,
                                bitis_konum_lng: this.sonKonum?.coords.longitude,
                                toplam_sure: this.getTotalMinutes()
                            })
                        });

                        const data = await response.json();

                        if (!data.success) {
                            throw new Error(data.error || 'Teslimat tamamlanamadı');
                        }

                        this.durum = 'tamamlandi';

                        if (this.watchId) {
                            navigator.geolocation.clearWatch(this.watchId);
                            this.watchId = null;
                        }

                        if (this.sureInterval) {
                            clearInterval(this.sureInterval);
                            this.sureInterval = null;
                        }

                        if (this.konumGondermeInterval) {
                            clearInterval(this.konumGondermeInterval);
                            this.konumGondermeInterval = null;
                        }

                        // Backend'den durumu kontrol et - araç durumu güncellenmiş mi?
                        try {
                            const checkResponse = await fetch(`${API_BASE_URL}/arac-takip/guncel-konumlar`);
                            if (checkResponse.ok) {
                                const checkData = await checkResponse.json();
                                if (checkData.success && checkData.data) {
                                    const arac = checkData.data.find(a => (a.id || a.arac_id) == this.aracId);
                                    if (arac) {
                                        const durum = arac.durum || '';
                                        if (durum !== 'teslimatta' && durum !== 'devam-ediyor') {
                                        }
                                    }
                                }
                            }
                        } catch (checkError) {
                            console.warn('⚠️ Backend durum kontrolü hatası:', checkError);
                        }
                        
                        // LocalStorage'ı temizle
                        localStorage.removeItem('teslimatDurum');
                        
                        // Durumu beklemede yap
                        this.durum = 'beklemede';
                        this.aracId = null;
                        this.surucuId = null;
                        this.teslimatId = null;
                        this.sonKonum = null;
                        this.baslangicZamani = null;
                        this.guncelKonum = null;

                        this.updateUI();
                        this.anaSayfaGuncelle();
                        
                        // Storage event tetikle - web sayfasını anında güncelle
                        window.dispatchEvent(new StorageEvent('storage', {
                            key: 'teslimatDurum',
                            newValue: null
                        }));
                        
                        // Manuel olarak updateCardUI çağır - web sayfasını anında güncelle
                        if (typeof window.updateCardUI === 'function') {
                            window.updateCardUI({
                                durum: 'beklemede',
                                baslangicZamani: null,
                                sonKonum: null,
                                plaka: null,
                                surucuAdi: null,
                                marka: null,
                                model: null
                            });
                        }
                        
                        // Mobil butonu gri yap
                        const mobileAracTakipBtn = document.getElementById('mobileAracTakipBtn');
                        if (mobileAracTakipBtn) {
                            mobileAracTakipBtn.classList.remove('active');
                        }
                        // Başarı toast mesajı kaldırıldı - kullanıcı istemedi
                        
                        // Araç listesini güncelle (web görünümde aktif görünmemesi için)
                        if (typeof loadVehicleList === 'function') {
                            setTimeout(() => {
                                loadVehicleList();
                            }, 500);
                        }
                        
                        // Modal'ı kapat - teslimat tamamlandı, popup açılmasın
                        closeAracTakipModal();
                        
                        setTimeout(() => {
                            this.sifirla();
                        }, 1000);
                    } catch (error) {
                        console.error('Teslimat tamamlama hatası:', error);
                        createToast({
                            message: 'Teslimat tamamlanırken hata: ' + error.message,
                            type: 'error',
                            position: 'center'
                        });
                    }
                },
                onCancel: () => {
                }
            });
        }

        getTotalMinutes() {
            if (!this.baslangicZamani) return 0;
            const fark = new Date() - this.baslangicZamani;
            return Math.floor(fark / 60000);
        }

        async konumGuncelle(position) {
            this.sonKonum = position;
            // Konum adını backend'den al (reverse geocoding)
            if (position && position.coords) {
                try {
                    // Backend'den konum adını al - floovonFetch kullan
                    const API_BASE_URL = window.getFloovonApiBase ? window.getFloovonApiBase() : (window.API_BASE_URL || '/api');
                    const locationData = await (window.floovonFetch || fetch)(`${API_BASE_URL}/arac-takip/${this.aracId}/konum`);
                    // floovonFetch zaten JSON parse ediyor, kontrol et
                    if (locationData && locationData.success && locationData.data && locationData.data.konum_adi) {
                        // Konum adı varsa kullan
                        this.guncelKonum = locationData.data.konum_adi;
                    } else {
                        // Yoksa koordinat göster
                        this.guncelKonum = `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
                    }
                } catch (error) {
                    // Hata durumunda koordinat göster
                    this.guncelKonum = `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
                }
            }
            this.anaSayfaGuncelle();
        }

        // Konumları backend'e düzenli olarak gönder (30 saniyede bir)
        konumGondermeBaslat() {
            this.konumGondermeInterval = setInterval(async () => {
                if (this.sonKonum && this.durum === 'aktif') {
                    await this.konumBackendGonder();
                }
            }, 30000); // 30 saniye

            // İlk konumu hemen gönder
            if (this.sonKonum) {
                this.konumBackendGonder();
            }
        }

        async konumBackendGonder() {
            try {
                const API_BASE_URL = window.getFloovonApiBase ? window.getFloovonApiBase() : (window.API_BASE_URL || '/api');
                const response = await fetch(`${API_BASE_URL}/arac-takip/${this.aracId}/konum`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        latitude: this.sonKonum.coords.latitude,
                        longitude: this.sonKonum.coords.longitude,
                        hiz: this.sonKonum.coords.speed ? (this.sonKonum.coords.speed * 3.6).toFixed(2) : 0, // m/s'den km/h'ye çevir
                        yon: this.sonKonum.coords.heading || null,
                        // yukseklik ve dogruluk artık kullanılmıyor, backend'de işlenmiyor
                        // surucu_id artık gönderilmiyor, backend oturum sahibinden user_id'yi alacak
                        konum_adi: this.guncelKonum || `${this.sonKonum.coords.latitude.toFixed(4)}, ${this.sonKonum.coords.longitude.toFixed(4)}`
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                } else {
                    console.error('GPS konum kaydetme hatası:', data.error);
                }
            } catch (error) {
                console.error('GPS konum gönderme hatası:', error);
            }
        }

        gpsHatasi(error) {
            let mesaj = 'GPS hatası: ';
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    mesaj += 'Konum izni reddedildi.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    mesaj += 'Konum bilgisi alınamıyor (konum servisi kapalı olabilir).';
                    break;
                case error.TIMEOUT:
                    mesaj += 'Zaman aşımı.';
                    break;
                default:
                    mesaj += 'Bilinmeyen hata.';
                    break;
            }
            // Console'a yaz
            console.warn('⚠️ GPS Hatası:', mesaj, error);
        }

        sureSayaciniBaslat() {
            this.sureInterval = setInterval(() => this.updateUI(), 1000);
        }

        gecenSureyiHesapla() {
            if (!this.baslangicZamani) return '00:00';

            const simdi = new Date();
            const fark = simdi - this.baslangicZamani;
            const dakika = Math.floor(fark / 60000);
            const saat = Math.floor(dakika / 60);
            const kalanDakika = dakika % 60;

            return saat > 0 ? `${saat}:${kalanDakika.toString().padStart(2, '0')}` : `${dakika} dakika`;
        }

        async anaSayfaGuncelle() {
            // Araç ve sürücü bilgilerini al
            const API_BASE_URL = window.getFloovonApiBase ? window.getFloovonApiBase() : (window.API_BASE_URL || '/api');
            let plaka = null;
            let surucuAdi = null;
            let marka = null;
            let model = null;
            
            // Önce localStorage'dan mevcut bilgileri al
            const stored = localStorage.getItem('teslimatDurum');
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    plaka = parsed.plaka || null;
                    // surucuAdi artık LocalStorage'dan alınmıyor, her zaman oturum sahibinden alınacak
                    marka = parsed.marka || null;
                    model = parsed.model || null;
                } catch (e) {
                    console.error('LocalStorage parse hatası:', e);
                }
            }
            
            // Araç bilgisini al
            if (this.aracId && !plaka) {
                // Önce dropdown'dan kontrol et
                const aracSelect = document.getElementById('aracTakipModalSelect') || document.getElementById('aracSecim');
                if (aracSelect && aracSelect.value === this.aracId) {
                    const selectedOption = aracSelect.selectedOptions[0];
                    if (selectedOption) {
                        plaka = selectedOption.textContent.split(' - ')[0];
                    }
                } else {
                    // Backend'den araç bilgisini al
                    try {
                        const aracResponse = await fetch(`${API_BASE_URL}/araclar/${this.aracId}`);
                        const aracData = await aracResponse.json();
                        if (aracData.success && aracData.data) {
                            plaka = aracData.data.plaka || null;
                            marka = aracData.data.marka || null;
                            model = aracData.data.model || null;
                        }
                    } catch (error) {
                        console.warn('⚠️ Araç bilgisi alınamadı:', error);
                    }
                }
            }
            
            // Eğer marka/model yoksa backend'den tekrar al
            if (this.aracId && (!marka || !model)) {
                try {
                    const aracResponse = await fetch(`${API_BASE_URL}/araclar/${this.aracId}`);
                    const aracData = await aracResponse.json();
                    if (aracData.success && aracData.data) {
                        if (!marka) marka = aracData.data.marka || null;
                        if (!model) model = aracData.data.model || null;
                    }
                } catch (error) {
                    console.warn('⚠️ Araç marka/model bilgisi alınamadı:', error);
                }
            }
            
            // Sürücü bilgisini al - Oturum sahibinden (artık sürücüler tablosu kullanılmıyor)
            // Her zaman oturum sahibinden al, LocalStorage'daki eski veriyi kullanma
            try {
                let userId = this.surucuId;
                // UserSession'dan kullanıcı bilgisini al
                if (window.userSession && window.userSession.getUser) {
                    const currentUser = window.userSession.getUser();
                    if (currentUser) {
                        userId = currentUser.id || userId || 1;
                    }
                }
                
                const userResponse = await fetch(`${API_BASE_URL}/auth/me?id=${userId || 1}`);
                const userData = await userResponse.json();
                if (userData.success && userData.data) {
                    // Ad ve soyadı birleştir
                    if (userData.data.name && userData.data.surname) {
                        surucuAdi = `${userData.data.name} ${userData.data.surname}`;
                    } else if (userData.data.isim && userData.data.soyisim) {
                        surucuAdi = `${userData.data.isim} ${userData.data.soyisim}`;
                    } else if (userData.data.name) {
                        surucuAdi = userData.data.name;
                    } else if (userData.data.isim) {
                        surucuAdi = userData.data.isim;
                    } else if (userData.data.kullaniciadi) {
                        surucuAdi = userData.data.kullaniciadi;
                    } else {
                        surucuAdi = 'Sürücü';
                    }
                } else {
                    surucuAdi = 'Sürücü';
                }
            } catch (error) {
                console.warn('⚠️ Sürücü bilgisi alınamadı:', error);
                surucuAdi = 'Sürücü';
            }
            
            const veri = {
                durum: this.durum,
                baslangicZamani: this.baslangicZamani,
                aracId: this.aracId,
                surucuId: this.surucuId,
                teslimatId: this.teslimatId,
                plaka: plaka,
                surucuAdi: surucuAdi,
                marka: marka,
                model: model,
                guncelKonum: this.guncelKonum || null,
                sonKonum: this.sonKonum ? {
                    lat: this.sonKonum.coords.latitude,
                    lng: this.sonKonum.coords.longitude,
                    speed: this.sonKonum.coords.speed
                } : null
            };

            localStorage.setItem('teslimatDurum', JSON.stringify(veri));

            // mobileAracTakipBtn durumunu güncelle
            const mobileAracTakipBtn = document.getElementById('mobileAracTakipBtn');
            if (mobileAracTakipBtn) {
                if (this.durum === 'aktif') {
                    mobileAracTakipBtn.classList.add('active');
                } else {
                    mobileAracTakipBtn.classList.remove('active');
                }
            }
            
            // Kart UI'ını güncelle
            if (typeof window.updateCardUI === 'function') {
                window.updateCardUI(veri);
            }

            // Manuel storage event tetikle
            window.dispatchEvent(new StorageEvent('storage', {
                key: 'teslimatDurum',
                newValue: JSON.stringify(veri)
            }));
        }

        updateUI() {
            const btn = document.getElementById('teslimatBtn');
            const badge = document.getElementById('durumBadge');
            const info = document.getElementById('teslimatInfo');

            // Mobil modal kullanılıyorsa bu elementler olmayabilir
            if (!btn || !badge || !info) {
                // Mobil modal için UI güncellemesi yapılmıyor, sadece console log
                return;
            }

            switch (this.durum) {
                case 'beklemede':
                    badge.className = 'durum-badge durum-beklemede';
                    badge.innerHTML = '<i class="fa-solid fa-clock"></i> Beklemede';
                    btn.className = 'teslimat-btn btn-baslat';
                    btn.innerHTML = '<i class="fa-solid fa-play"></i> <span>Teslimata Çıktım</span>';
                    btn.disabled = false;
                    info.classList.add('hidden');
                    break;

                case 'aktif':
                    badge.className = 'durum-badge durum-aktif pulse';
                    badge.innerHTML = '<i class="fa-solid fa-location-dot"></i> Aktif';
                    btn.className = 'teslimat-btn btn-tamamla';
                    btn.innerHTML = '<i class="fa-solid fa-check"></i> <span>Teslimatı Tamamla</span>';
                    btn.disabled = false;
                    info.classList.remove('hidden');

                    if (this.baslangicZamani) {
                        document.getElementById('baslangicZamani').textContent =
                            this.baslangicZamani.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                    }
                    document.getElementById('gecenSure').textContent = this.gecenSureyiHesapla();
                    
                    // Konum bilgisini dinamik olarak al
                    const sonKonumEl = document.getElementById('sonKonum');
                    if (sonKonumEl) {
                        if (this.sonKonum && this.sonKonum.coords) {
                            // GPS'ten gelen gerçek konum bilgisini kullan
                            const lat = this.sonKonum.coords.latitude;
                            const lng = this.sonKonum.coords.longitude;
                            // Backend'den konum adını al veya koordinat göster
                            sonKonumEl.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                        } else {
                            sonKonumEl.textContent = 'Konum alınıyor...';
                        }
                    }
                    break;

                case 'tamamlandi':
                    badge.className = 'durum-badge durum-tamamlandi';
                    badge.innerHTML = '<i class="fa-solid fa-check-circle"></i> Tamamlandı';
                    btn.className = 'teslimat-btn btn-disabled';
                    btn.innerHTML = '<i class="fa-solid fa-check"></i> <span>Tamamlandı</span>';
                    btn.disabled = true;
                    break;
            }
        }

        showLoading(show) {
            const btn = document.getElementById('teslimatBtn');
            if (!btn) {
                // Buton yoksa (mobil modal kullanılıyorsa) sadece console log
                if (show) {
                } else {
                }
                return;
            }
            
            if (show) {
                btn.innerHTML = '<div class="loading-spinner"></div> <span>GPS BAĞLANIYOR</span>';
                btn.disabled = true;
            } else {
                btn.disabled = false;
            }
        }

        sifirla() {
            this.durum = 'beklemede';
            this.baslangicZamani = null;
            this.sonKonum = null;
            if (this.watchId) navigator.geolocation.clearWatch(this.watchId);
            if (this.sureInterval) clearInterval(this.sureInterval);

            this.updateUI();
            this.anaSayfaGuncelle();

            localStorage.removeItem('teslimatDurum');
        }
    }

    // Global değişken tanımla
    if (!window.teslimatTakip) {
        window.teslimatTakip = new TeslimatTakip();
    }

    // Global fonksiyon tanımla
    window.toggleTeslimat = function () {
        window.teslimatTakip.toggleTeslimat();
    }

    // Data-action ile teslimat toggle - Event delegation ile optimize edildi
    document.addEventListener('click', function(e) {
        if (e.target.closest('[data-action="toggle-teslimat"]')) {
            e.preventDefault();
            e.stopPropagation();
            window.teslimatTakip.toggleTeslimat();
        }
    });
}
//#endregion

// #region Reverse Geocoding - Koordinatları adrese çevir
// Reverse geocoding için rate limiting
const geocodingCache = new Map();
const geocodingQueue = [];
let geocodingInProgress = false;
const GEOCODING_DELAY = 1000; // 1 saniye bekleme (Nominatim rate limit: 1 istek/saniye)
const GEOCODING_CACHE_DURATION = 5 * 60 * 1000; // 5 dakika cache

/**
 * Koordinatları adrese çevir (Nominatim API kullanarak)
 * Rate limiting ve cache ile optimize edilmiş
 */
async function getAddressFromCoordinates(lat, lng) {
    try {
        // Koordinatların geçerli olduğundan emin ol
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
            return null;
        }
        
        // Cache kontrolü
        const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
        const cached = geocodingCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < GEOCODING_CACHE_DURATION) {
            return cached.address;
        }
        
        // Rate limiting için queue sistemi
        return new Promise((resolve) => {
            geocodingQueue.push({ lat, lng, resolve, cacheKey });
            processGeocodingQueue();
        });
    } catch (error) {
        return null;
    }
}

// Geocoding queue işleme fonksiyonu
async function processGeocodingQueue() {
    if (geocodingInProgress || geocodingQueue.length === 0) {
        return;
    }
    
    geocodingInProgress = true;
    
    while (geocodingQueue.length > 0) {
        const { lat, lng, resolve, cacheKey } = geocodingQueue.shift();
        
        try {
            // Backend proxy kullan (CORS sorunu için)
            // floovonFetch URL'e _t ekliyor, bu yüzden encodeURIComponent kullan
            const API_BASE_URL = window.getFloovonApiBase ? window.getFloovonApiBase() : (window.API_BASE_URL || '/api');
            // Backend hem 'lon' hem 'lng' kabul ediyor, ama 'lng' kullan (standart)
            const geocodingUrl = `${API_BASE_URL}/geocoding/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&zoom=18`;
            const response = await (window.floovonFetch || fetch)(geocodingUrl);
            
            if (!response || !response.success) {
                // Rate limit veya hata durumunda cache'e null kaydet ve devam et
                geocodingCache.set(cacheKey, { address: null, timestamp: Date.now() });
                resolve(null);
                // Hata durumunda daha uzun bekle
                await new Promise(r => setTimeout(r, GEOCODING_DELAY * 2));
                continue;
            }
            
            // floovonFetch zaten JSON parse ediyor
            const data = response.data || response;
            let address = null;
            
            // Backend'den gelen formatlanmış adresi kullan
            if (data && data.address) {
                address = data.address;
            } else if (data && data.raw && data.raw.address) {
                // Eğer raw data varsa formatla (fallback)
                const addr = data.raw.address;
                let addressParts = [];
                
                if (addr.road) addressParts.push(addr.road);
                if (addr.house_number) addressParts.push(addr.house_number);
                if (addr.neighbourhood || addr.suburb) addressParts.push(addr.neighbourhood || addr.suburb);
                if (addr.city || addr.town || addr.village) addressParts.push(addr.city || addr.town || addr.village);
                
                if (addressParts.length > 0) {
                    address = addressParts.join(', ');
                } else if (data.raw.display_name) {
                    address = data.raw.display_name.split(',')[0] + ', ' + (addr.city || addr.town || addr.village || '');
                }
            } else if (data && data.display_name) {
                // Eski format desteği
                address = data.display_name;
            }
            
            // Cache'e kaydet
            geocodingCache.set(cacheKey, { address, timestamp: Date.now() });
            resolve(address);
            
            // Rate limiting: Her istekten sonra bekle
            if (geocodingQueue.length > 0) {
                await new Promise(r => setTimeout(r, GEOCODING_DELAY));
            }
        } catch (error) {
            // Hata durumunda null döndür ve cache'e kaydet (kısa süreli)
            geocodingCache.set(cacheKey, { address: null, timestamp: Date.now() });
            resolve(null);
            // Hata durumunda daha uzun bekle
            await new Promise(r => setTimeout(r, GEOCODING_DELAY * 2));
        }
    }
    
    geocodingInProgress = false;
}

/**
 * İki koordinat arasındaki mesafeyi hesapla (Haversine formülü)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Dünya yarıçapı (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Mesafe (km)
}

/**
 * Teslimata başladığından itibaren kat edilen toplam mesafeyi hesapla
 */
/**
 * Teslimata başladığından itibaren kat edilen toplam mesafeyi hesapla
 * SADECE O TESLİMAT için kaydedilen konumlar kullanılır
 * @param {string|number} aracId - Araç ID
 * @param {string} baslangicZamani - Teslimat başlangıç zamanı (ISO string)
 * @param {string|number} teslimatId - Teslimat ID (opsiyonel, varsa kullanılır)
 * @returns {Promise<number>} - Toplam mesafe (km)
 */
async function calculateTotalDistance(aracId, baslangicZamani, teslimatId = null) {
    try {
        if (!aracId || !baslangicZamani) {
            return 0;
        }
        
        const API_BASE_URL = window.getFloovonApiBase ? window.getFloovonApiBase() : (window.API_BASE_URL || '/api');
        
        // Backend'den SADECE bu teslimat için kaydedilen konumları al
        // Teslimat ID varsa onu kullan, yoksa başlangıç zamanından itibaren filtrele
        let url = `/api/arac-takip/${aracId}/gecmis?baslangic=${baslangicZamani}&limit=1000`;
        if (teslimatId) {
            url += `&teslimat_id=${teslimatId}`;
        }
        // floovonFetch kullan - otomatik /api/ prefix ve header yönetimi
        const response = await (window.floovonFetch || fetch)(url);
        const data = (response && typeof response.json === 'function') ? await response.json() : response;
        if (!data.success || !data.data || data.data.length < 2) {
            // Eğer konum yoksa veya tek konum varsa mesafe 0
            return 0;
        }
        
        // GPS konumlarını zaman sırasına göre sırala (en eski en başta)
        const konumlar = data.data.sort((a, b) => {
            const zamanA = new Date(a.kayit_zamani || a.created_at || a.timestamp || 0);
            const zamanB = new Date(b.kayit_zamani || b.created_at || b.timestamp || 0);
            return zamanA - zamanB;
        });
        
        // Başlangıç zamanından önceki konumları filtrele (güvenlik için)
        const baslangicTarihi = new Date(baslangicZamani);

        const filtrelenmisKonumlar = konumlar.filter(konum => {
            const konumZamani = new Date(konum.kayit_zamani || konum.created_at || konum.timestamp || 0);
            const gecerli = konumZamani >= baslangicTarihi;
            if (!gecerli) {

            }
            return gecerli;
        });


        
        if (filtrelenmisKonumlar.length < 2) {
            return 0;
        }
        
        let toplamMesafe = 0;
        
        // Her ardışık konum çifti arasındaki mesafeyi hesapla
        for (let i = 1; i < filtrelenmisKonumlar.length; i++) {
            const onceki = filtrelenmisKonumlar[i - 1];
            const simdiki = filtrelenmisKonumlar[i];
            
            const lat1 = onceki.latitude || onceki.enlem;
            const lon1 = onceki.longitude || onceki.boylam;
            const lat2 = simdiki.latitude || simdiki.enlem;
            const lon2 = simdiki.longitude || simdiki.boylam;
            
            if (lat1 && lon1 && lat2 && lon2 && 
                !isNaN(lat1) && !isNaN(lon1) && !isNaN(lat2) && !isNaN(lon2)) {
                const mesafe = calculateDistance(lat1, lon1, lat2, lon2);
                toplamMesafe += mesafe;

            }
        }
        
        const sonuc = Math.round(toplamMesafe * 100) / 100; // 2 ondalık basamak
        return sonuc;
    } catch (error) {
        console.error('❌ Toplam mesafe hesaplama hatası:', error);
        return 0;
    }
}
//#endregion

// #region Web tarafında araç listesini dinamik olarak yükle

// truncateText → utils.js (2026-02-05)
// Fallback: truncateText fonksiyonu tanımlı değilse tanımla
if (typeof window.truncateText !== 'function') {
    window.truncateText = function(text, maxLength) {
        if (typeof maxLength === 'undefined') maxLength = 35;
        if (!text) return text;
        var hasEmoji = text.indexOf('📍') !== -1;
        var cleanText = text.replace(/📍\s*/g, '').trim();
        if (cleanText.length <= maxLength) return text;
        var truncated = cleanText.substring(0, maxLength) + '...';
        return hasEmoji ? '📍 ' + truncated : truncated;
    };
}
var truncateText = window.truncateText;

// loadVehicleList için debounce ve loading kontrolü
let loadVehicleListTimeout = null;
let loadVehicleListLoading = false;

async function loadVehicleList() {
    // Eğer zaten yükleme devam ediyorsa, yeni çağrıyı iptal et
    if (loadVehicleListLoading) {
        return;
    }
    
    // Debounce: Eğer son çağrıdan 500ms geçmediyse bekle
    if (loadVehicleListTimeout) {
        clearTimeout(loadVehicleListTimeout);
    }
    
    return new Promise((resolve) => {
        loadVehicleListTimeout = setTimeout(async () => {
            loadVehicleListLoading = true;
            try {
        const API_BASE_URL = window.getFloovonApiBase ? window.getFloovonApiBase() : (window.API_BASE_URL || '/api');
        // Sürücü adını oturum sahibinden al (sadece aktif araçlar için)
        let aktifSurucuAdi = 'Henüz sürücü atanmadı';
        try {
            if (window.userSession && window.userSession.getUser) {
                const currentUser = window.userSession.getUser();
                if (currentUser) {
                    const userId = currentUser.id || 1;
                    // floovonFetch kullan - otomatik CORS ve hata yönetimi
                    const userData = await (window.floovonFetch || fetch)(`/api/auth/me?id=${userId}`);
                    if (userData.success && userData.data) {
                        // Ad ve soyadı birleştir
                        if (userData.data.name && userData.data.surname) {
                            aktifSurucuAdi = `${userData.data.name} ${userData.data.surname}`;
                        } else if (userData.data.isim && userData.data.soyisim) {
                            aktifSurucuAdi = `${userData.data.isim} ${userData.data.soyisim}`;
                        } else if (userData.data.name) {
                            aktifSurucuAdi = userData.data.name;
                        } else if (userData.data.isim) {
                            aktifSurucuAdi = userData.data.isim;
                        } else if (userData.data.kullaniciadi) {
                            aktifSurucuAdi = userData.data.kullaniciadi;
                        } else {
                            aktifSurucuAdi = 'Sürücü';
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Sürücü bilgisi alınamadı:', error);
        }
        
        try {
            // floovonFetch kullan - otomatik header ve error handling
            const response = await (window.floovonFetch || window.floovonFetchStandard || fetch)(`/api/arac-takip/guncel-konumlar`);
            
            // floovonFetch kullanıldığında response zaten parse edilmiş
            const data = (response && typeof response.json === 'function') ? await response.json() : response;

            if (!data || !data.success) {
                console.warn('⚠️ Araç listesi yüklenemedi:', data);
                return;
            }
            
            // araclar tablosundan is_active bilgilerini al ve birleştir
            try {
                const aracResponse = await (window.floovonFetch || window.floovonFetchStandard || fetch)(`/api/araclar`);
                const aracData = (aracResponse && typeof aracResponse.json === 'function') ? await aracResponse.json() : aracResponse;
                
                if (aracData && aracData.success && aracData.data && Array.isArray(aracData.data)) {
                    // arac_id'ye göre is_active bilgilerini birleştir
                    const aracMap = {};
                    aracData.data.forEach(arac => {
                        const aracId = arac.id || arac.arac_id;
                        if (aracId) {
                            aracMap[aracId] = {
                                is_active: arac.is_active
                            };
                        }
                    });
                    
                    // data.data içindeki her araca is_active bilgisini ekle
                    if (data.data && Array.isArray(data.data)) {
                        data.data.forEach(arac => {
                            const aracId = arac.arac_id || arac.id;
                            if (aracId && aracMap[aracId]) {
                                // araclar tablosundaki is_active bilgisini kullan
                                if (aracMap[aracId].is_active !== undefined) {
                                    arac.is_active = aracMap[aracId].is_active;
                                }
                            }
                        });
                    }
                    
                }
            } catch (error) {
                console.warn('⚠️ araclar tablosundan is_active bilgisi alınamadı:', error);
            }
            
            // Plakası olmayan veya is_active = 0 olan araçları filtrele
            if (data.data && Array.isArray(data.data)) {
                data.data = data.data.filter(arac => {
                    // Plaka kontrolü
                    const plaka = arac.plaka || '';
                    if (!plaka || plaka.trim() === '' || plaka === 'Plaka yok') {
                        console.warn('⚠️ Plakası olmayan araç filtrelendi:', arac);
                        return false;
                    }
                    
                    // is_active kontrolü - eğer is_active 0, false, '0' ise filtrele
                    if (arac.is_active !== undefined && arac.is_active !== null) {
                        const isActiveValue = arac.is_active;
                        if (isActiveValue === 0 || isActiveValue === false || isActiveValue === '0' || isActiveValue === 'false') {
                            console.warn('⚠️ is_active = 0 olan araç filtrelendi:', { plaka: arac.plaka, is_active: arac.is_active });
                            return false;
                        }
                    }
                    
                    return true;
                });
            }

        const vehicleListContainer = document.querySelector('#multiVehicle .vehicle-list');
        if (!vehicleListContainer) {
            return;
        }

        // React SPA: liste VehicleTrackingArea ile yönetiliyor — innerHTML ile ezme.
        // Aksi halde tıklanınca açılan detay popup DOM bozulması / yarış ile anında kapanıyor.
        if (vehicleListContainer.getAttribute('data-react-vehicle-list') === 'true') {
            return;
        }

        // Toplam araç sayısını multi-title-count'a ekle
        const toplamAracSayisi = data.data ? data.data.length : 0;
        const multiTitleCount = document.getElementById('multiTitleCount');
        if (multiTitleCount) {
            multiTitleCount.textContent = `${toplamAracSayisi} Araç`;
        }
        
        // multi-title sadece "Araç Takibi" olmalı (img ve sayı ekleme)
        const multiTitle = document.querySelector('#multiVehicle .multi-title');
        if (multiTitle) {
            // Sadece metni güncelle, img ekleme (img zaten multi-title-icon içinde)
            multiTitle.textContent = 'Araç Takibi';
        }

        // Aktif araç sayısını güncelle - hem 'teslimatta' durumu hem de is_active kontrolü yap
        const aktifAracSayisi = data.data ? data.data.filter(arac => {
            const durum = (arac.durum || arac.arac_durum || '').toString().toLowerCase().trim();
            const isActiveFromDB = arac.is_active !== undefined ? (arac.is_active === 1 || arac.is_active === true || arac.is_active === '1') : true;
            return durum === 'teslimatta' && isActiveFromDB;
        }).length : 0;
        const activeVehiclesCount = document.getElementById('activeVehiclesCount');
        const activeVehiclesInfo = document.querySelector('.active-vehicles-info');
        if (activeVehiclesCount) {
            activeVehiclesCount.textContent = `${aktifAracSayisi} Aktif`;
            // Aktif araç varsa yeşil renk için class ekle/kaldır
            if (activeVehiclesInfo) {
                if (aktifAracSayisi > 0) {
                    activeVehiclesInfo.classList.add('has-active');
                } else {
                    activeVehiclesInfo.classList.remove('has-active');
                }
            }
        }

        // Araç listesini temizle
        vehicleListContainer.innerHTML = '';

        // Eğer araç yoksa mesaj göster
        if (!data.data || data.data.length === 0) {
            // Başlığı güncelle - 0 araç
            const multiTitleCount = document.getElementById('multiTitleCount');
            if (multiTitleCount) {
                multiTitleCount.textContent = '0 Araç';
            }
            const multiTitle = document.querySelector('#multiVehicle .multi-title');
            if (multiTitle) {
                multiTitle.textContent = 'Araç Takibi';
            }
            vehicleListContainer.innerHTML = `
                <div class="no-vehicle-message">
                    <span class="no-vehicle-message__icon">${LUCIDE_VAN_ICON_32}</span>
                    <p class="no-vehicle-message__text">
                        Herhangi bir araç eklenmemiş. Araç eklemek için Ayarlar > Araç Takip ayarlarından yeni araç ekleyebilirsiniz.
                    </p>
                </div>
            `;
            return;
        }

        // Araçları sırala - aktif olanlar üstte, beklemede olanlar altta
        const sortedAraclar = [...(data.data || [])].sort((a, b) => {
            const durumA = (a.durum || a.arac_durum || '').toString().toLowerCase().trim();
            const durumB = (b.durum || b.arac_durum || '').toString().toLowerCase().trim();
            const isActiveFromDBA = a.is_active !== undefined ? (a.is_active === 1 || a.is_active === true || a.is_active === '1') : true;
            const isActiveFromDBB = b.is_active !== undefined ? (b.is_active === 1 || b.is_active === true || b.is_active === '1') : true;
            const isActiveA = durumA === 'teslimatta' && isActiveFromDBA;
            const isActiveB = durumB === 'teslimatta' && isActiveFromDBB;
            
            // Aktif olanlar üstte (return -1), pasif olanlar altta (return 1)
            if (isActiveA && !isActiveB) return -1;
            if (!isActiveA && isActiveB) return 1;
            return 0; // Aynı durumda sıralama değişmez
        });
        
        // Araçları listele - sıralanmış liste ile
        sortedAraclar.forEach(arac => {
            // Plaka kontrolü - eğer plaka yoksa bu aracı atla (çift kontrol)
            const plaka = arac.plaka || '';
            if (!plaka || plaka.trim() === '' || plaka === 'Plaka yok') {
                console.warn('⚠️ Plakası olmayan araç atlandı (forEach):', arac);
                return; // Bu aracı atla
            }
            
            // Backend'den gelen durum kontrolü - sadece 'teslimatta' durumunu kontrol et
            // Backend'de araç durumu 'teslimatta' ise aktif, değilse pasif
            const durum = (arac.durum || arac.arac_durum || '').toString().toLowerCase().trim();
            
            // is_active kontrolü - eğer is_active 0, false, '0', null ise araç pasif
            let isActiveFromDB = true; // Varsayılan olarak true (eski veriler için)
            if (arac.is_active !== undefined && arac.is_active !== null) {
                const isActiveValue = arac.is_active;
                // 0, false, '0', 'false', null -> pasif
                if (isActiveValue === 0 || isActiveValue === false || isActiveValue === '0' || isActiveValue === 'false') {
                    isActiveFromDB = false;
                } else if (isActiveValue === 1 || isActiveValue === true || isActiveValue === '1' || isActiveValue === 'true') {
                    isActiveFromDB = true;
                }
            }
            
            // Hem durum hem de is_active kontrolü yap - SADECE durum='teslimatta' VE is_active=1 ise aktif
            const isActive = durum === 'teslimatta' && isActiveFromDB;
            const durumClass = isActive ? 'status-active' : 'status-inactive';
            const durumText = isActive ? 'Aktif' : 'Beklemede';
            
            // Debug: Eğer is_active=1 ama durum='teslimatta' değilse logla
            if (isActiveFromDB && durum !== 'teslimatta') {
                // Araç is_active=1 ama durum teslimatta değil (normal durum, log gerekmez)
            }
            
            // Debug: Eğer araç aktif görünüyorsa ama is_active 0 ise logla
            if (isActive && !isActiveFromDB) {
                console.error('❌ HATA: Araç aktif görünüyor ama is_active = 0!', {
                    plaka: arac.plaka,
                    durum: arac.durum,
                    is_active: arac.is_active,
                    isActiveFromDB: isActiveFromDB,
                    isActive: isActive
                });
            }
            
            // Debug için logla - sadece aktif araçlar için
            if (isActive) {
            } else {
            }
            
            // Konum bilgisini düzgün göster - HER ZAMAN ADRES GÖSTER
            let konumText = 'Teslimatta değil';
            let needsAddressLookup = false;
            if (isActive) {
                // Backend'den gelen konum bilgisini kontrol et
                // Eğer konum_adi varsa ve koordinat formatında değilse kullan
                const konumAdi = arac.konum_adi || '';
                // Koordinat formatlarını kontrol et: "41.0004, 28.7996" veya "41.0004,28.7996" veya "41.0004° K, 28.7996° D"
                const isKoordinatFormat = /^\d+\.?\d*\s*,\s*\d+\.?\d*$/.test(konumAdi) || /^\d+\.?\d*\s*°/.test(konumAdi) || /^\d+\.?\d*,\s*\d+\.?\d*$/.test(konumAdi);
                
                if (konumAdi && !isKoordinatFormat) {
                    // Backend'den gelen konum_adi koordinat değilse direkt kullan
                    konumText = `📍 ${konumAdi}`;
                } else if (arac.konum_lat && arac.konum_lng) {
                    // Koordinatlar varsa MUTLAKA adrese çevir
                    konumText = '📍 Konum alınıyor...';
                    needsAddressLookup = true;
                } else {
                    konumText = '📍 Konum alınıyor...';
                }
            }

            const vehicleItem = document.createElement('div');
            vehicleItem.className = 'vehicle-item';
            vehicleItem.setAttribute('data-arac-id', arac.id || arac.arac_id || '');
            vehicleItem.setAttribute('data-plaka', arac.plaka || '');
            vehicleItem.setAttribute('data-durum', durum); // Durum bilgisini data attribute olarak ekle
            // Konum bilgilerini data attribute olarak ekle
            if (arac.konum_lat) vehicleItem.setAttribute('data-konum-lat', arac.konum_lat);
            if (arac.konum_lng) vehicleItem.setAttribute('data-konum-lng', arac.konum_lng);
            // Sadece aktif araçlara tıklanabilir yap
            if (isActive) {
                vehicleItem.style.cursor = 'pointer';
                vehicleItem.onclick = () => selectVehicle(arac.plaka);
            } else {
                vehicleItem.style.cursor = 'default';
                vehicleItem.onclick = null; // Beklemede araçlara tıklama devre dışı
            }
            // Sürücü bilgisini duruma göre ayarla: sadece aktif araçlar için oturum sahibi, beklemede olanlar için "Henüz sürücü atanmadı"
            const surucuBilgisi = isActive ? aktifSurucuAdi : 'Henüz sürücü atanmadı';
            
            vehicleItem.innerHTML = `
                <div class="vehicle-main-info">
                    <div class="vehicle-plate">
                        <div class="plate-icon">${LUCIDE_VAN_ICON}</div>
                        <span class="plate-number">${arac.plaka || 'Plaka yok'}</span>
                    </div>
                    <div class="vehicle-status ${durumClass}">${durumText}</div>
                </div>
                <div class="vehicle-driver">${surucuBilgisi}</div>
                <div class="vehicle-location" >${truncateText(konumText)}</div>
            `;

            vehicleListContainer.appendChild(vehicleItem);
            
            // DOM'a eklendikten SONRA adresi al ve güncelle
            if (needsAddressLookup && arac.konum_lat && arac.konum_lng) {
                (async () => {
                    try {
                        const address = await getAddressFromCoordinates(parseFloat(arac.konum_lat), parseFloat(arac.konum_lng));
                        if (address) {
                            const locationElement = vehicleItem.querySelector('.vehicle-location');
                            if (locationElement) {
                                locationElement.textContent = truncateText(`📍 ${address}`);
                            }
                        }
                        // Adres alınamazsa sessizce devam et (rate limiting nedeniyle)
                    } catch (error) {
                        // Hata durumunda sessizce devam et
                    }
                })();
            }
        });
        
        } catch (innerError) {
            console.error('❌ Araç listesi render hatası:', innerError);
        }
            } catch (error) {
                console.error('❌ Araç listesi yükleme hatası:', error);
            } finally {
                loadVehicleListLoading = false;
                resolve();
            }
        }, 1000); // 1000ms debounce (500ms'den artırıldı - sonsuz döngüyü önlemek için)
    });
}

// Tek araç görünümü kaldırıldı - artık kullanılmıyor
async function showSingleVehicleView(vehicle) {
    // Single vehicle kaldırıldı, bu fonksiyon artık kullanılmıyor
    console.warn('⚠️ showSingleVehicleView fonksiyonu kaldırıldı, artık kullanılmıyor');
    return;
}

// Çoklu araç görünümünü göster
function showMultiVehicleView() {
    const multiVehicle = document.getElementById('multiVehicle');
    const reklamArea = document.getElementById('baslangicPaketReklam');
    // Eğer reklam alanı görünüyorsa (başlangıç paketi), araç takip alanını gösterme
    if (reklamArea && !reklamArea.classList.contains('baslangic-paket-reklam-hidden')) {
        return; // Başlangıç paketi kullanılıyor, araç takip alanını gösterme
    }
    if (multiVehicle && !multiVehicle.classList.contains('hidden')) {
        multiVehicle.style.display = 'flex';
    }
}

// Çoklu araç listesini doldur
function populateMultiVehicleList(vehicles) {
    // Başlangıç paketi kontrolü
    const reklamArea = document.getElementById('baslangicPaketReklam');
    if (reklamArea && !reklamArea.classList.contains('baslangic-paket-reklam-hidden')) {
        return; // Başlangıç paketi kullanılıyor, araç takip alanını gösterme
    }
    
    const vehicleListContainer = document.querySelector('#multiVehicle .vehicle-list');
    if (!vehicleListContainer) {
        return;
    }

    // Sürücü adını oturum sahibinden al (sadece aktif araçlar için)
    const API_BASE_URL = window.getFloovonApiBase ? window.getFloovonApiBase() : (window.API_BASE_URL || '/api');
    let aktifSurucuAdi = 'Henüz sürücü atanmadı';
    try {
        if (window.userSession && window.userSession.getUser) {
            const currentUser = window.userSession.getUser();
            if (currentUser) {
                const userId = currentUser.id || 1;
                // Async olmadığı için burada direkt alınamaz, aşağıda her araç için kontrol edilecek
                aktifSurucuAdi = 'Sürücü'; // Geçici değer
            }
        }
    } catch (error) {
        console.warn('⚠️ Sürücü bilgisi alınamadı:', error);
    }

    // Aktif araç sayısını güncelle
    const aktifAracSayisi = vehicles.filter(arac => arac.durum === 'teslimatta').length;
    const aktifSayiSpan = document.querySelector('.active-vehicles-info .vehicles-info span');
    if (aktifSayiSpan) {
        aktifSayiSpan.textContent = aktifAracSayisi;
    }

    // Araç listesini temizle
    vehicleListContainer.innerHTML = '';

    // Araçları sırala - aktif olanlar üstte, beklemede olanlar altta
    const sortedVehicles = [...vehicles].sort((a, b) => {
        const durumA = a.durum || '';
        const durumB = b.durum || '';
        const isActiveA = durumA === 'teslimatta';
        const isActiveB = durumB === 'teslimatta';
        
        // Aktif olanlar üstte (return -1), pasif olanlar altta (return 1)
        if (isActiveA && !isActiveB) return -1;
        if (!isActiveA && isActiveB) return 1;
        return 0; // Aynı durumda sıralama değişmez
    });
    
    // Araçları listele - sıralanmış liste ile
    sortedVehicles.forEach(arac => {
        const durum = arac.durum || '';
        const isActive = durum === 'teslimatta';
        const durumClass = isActive ? 'status-active' : 'status-inactive';
        const durumText = isActive ? 'Aktif' : 'Beklemede';
        // Konum bilgisini düzgün göster
        let konumText = 'Teslimatta değil';
        if (isActive) {
            konumText = arac.konum_adi || (arac.latitude && arac.longitude ? 'Konum alınıyor...' : 'Konum alınıyor...');
        }
        
        // Sürücü bilgisini duruma göre ayarla: sadece aktif araçlar için oturum sahibi, beklemede olanlar için "Henüz sürücü atanmadı"
        const surucuBilgisi = isActive ? aktifSurucuAdi : 'Henüz sürücü atanmadı';

        const vehicleItem = document.createElement('div');
        vehicleItem.className = 'vehicle-item';
        vehicleItem.setAttribute('data-arac-id', arac.id || arac.arac_id || '');
        vehicleItem.setAttribute('data-plaka', arac.plaka || '');
        vehicleItem.setAttribute('data-durum', durum); // Durum bilgisini data attribute olarak ekle
        // Sadece aktif araçlara tıklanabilir yap
        if (isActive) {
            vehicleItem.style.cursor = 'pointer';
            vehicleItem.onclick = () => selectVehicle(arac.plaka);
        } else {
            vehicleItem.style.cursor = 'default';
            vehicleItem.onclick = null; // Beklemede araçlara tıklama devre dışı
        }
        vehicleItem.innerHTML = `
            <div class="vehicle-main-info">
                <div class="vehicle-plate">
                    <div class="plate-icon">${LUCIDE_VAN_ICON}</div>
                    <span class="plate-number">${arac.plaka}</span>
                </div>
                <div class="vehicle-status ${durumClass}">${durumText}</div>
            </div>
            <div class="vehicle-driver">${surucuBilgisi}</div>
            <div class="vehicle-location">${truncateText(konumText)}</div>
        `;

        vehicleListContainer.appendChild(vehicleItem);
    });
}

// Boş araç listesi mesajı göster
function showEmptyVehicleList() {
    const vehicleListContainer = document.querySelector('#multiVehicle .vehicle-list');
    if (!vehicleListContainer) return;

    vehicleListContainer.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--ana-renk); opacity: 0.6;">
            <span style="display: block; margin-bottom: 10px;">${LUCIDE_VAN_ICON}</span>
            <div>Henüz teslimatta olan araç bulunmuyor</div>
        </div>
    `;

    const aktifSayiSpan = document.querySelector('.active-vehicles-info .vehicles-info span');
    if (aktifSayiSpan) {
        aktifSayiSpan.textContent = '0';
    }
}

// Mini haritayı güncelle
function updateMiniMap(lat, lng) {
    const mapContainer = document.querySelector('.map-thumbnail');
    if (!mapContainer || typeof L === 'undefined') return;

    // Mevcut haritayı temizle - overlay div'lerini de kaldır
    mapContainer.innerHTML = '';

    // Yeni harita oluştur
    const mapDiv = document.createElement('div');
    mapDiv.id = 'miniMapContainer';
    mapDiv.style.width = '100%';
    mapDiv.style.height = '100%';
    mapDiv.style.borderRadius = '8px';
    mapDiv.style.position = 'relative';
    mapDiv.style.zIndex = '1';
    mapContainer.appendChild(mapDiv);

    // Leaflet haritası oluştur - sadece geçerli koordinatlar varsa
    if (!lat || !lng) {
        console.warn('⚠️ Harita için geçerli koordinat bulunamadı');
        return;
    }
    
    const map = L.map('miniMapContainer', {
        zoomControl: false,
        attributionControl: false
    }).setView([lat, lng], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: false,
        maxZoom: 19
    }).addTo(map);

    // Araç marker'ı ekle
    if (lat && lng) {
        L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'vehicle-marker-custom',
                html: '<div style="width: 16px; height: 16px; background: #ff4757; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            })
        }).addTo(map);
    }
    
    // Harita boyutunu düzelt - container görünür olduktan sonra
    setTimeout(() => {
        if (map) {
            map.invalidateSize();
        }
    }, 100);
}

// Detay modal haritasını güncelle
// Global harita instance'ını sakla
let detailMapInstance = null;

function updateDetailMap(lat, lng) {
    const mapContainer = document.querySelector('#vehicleDetailOverlay .map-container');
    if (!mapContainer || typeof L === 'undefined') {
        console.warn('⚠️ Detay modal harita container bulunamadı veya Leaflet yüklenmemiş');
        return;
    }
    
    // Koordinatları sayıya çevir (string ise)
    lat = parseFloat(lat);
    lng = parseFloat(lng);
    
    // Koordinatların geçerli olduğundan emin ol
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        console.error('❌ Geçersiz koordinatlar:', { lat, lng });
        return;
    }
    
    // Koordinatların mantıklı aralıkta olduğundan emin ol (Türkiye: ~36-42°K, ~26-45°D)
    if (lat < 35 || lat > 43 || lng < 25 || lng > 46) {
        console.error('❌ Koordinatlar Türkiye sınırları dışında:', { lat, lng });
        return;
    }

    // Eğer önceki harita varsa kaldır
    if (detailMapInstance) {
        detailMapInstance.remove();
        detailMapInstance = null;
    }

    // Container'ı tamamen temizle (overlay, route, marker div'lerini de kaldır)
    mapContainer.innerHTML = '';

    // Yeni harita div'i oluştur
    const mapDiv = document.createElement('div');
    mapDiv.id = 'detailMapContainer';
    mapDiv.style.width = '100%';
    mapDiv.style.height = '100%';
    mapDiv.style.position = 'absolute';
    mapDiv.style.top = '0';
    mapDiv.style.left = '0';
    mapDiv.style.zIndex = '1';
    mapContainer.appendChild(mapDiv);

    // Leaflet haritası oluştur - DOĞRU KOORDİNATLARLA
    // Koordinatların doğru olduğundan emin ol - debug için logla
    if (lat < 35 || lat > 43 || lng < 25 || lng > 46) {
        console.error('❌ Koordinatlar Türkiye sınırları dışında - harita gösterilmeyecek:', { lat, lng });
        return;
    }
    
    const map = L.map('detailMapContainer', {
        zoomControl: true,
        attributionControl: false
    }).setView([lat, lng], 15); // Daha yakın zoom seviyesi
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: false,
        maxZoom: 19
    }).addTo(map);

    // Araç marker'ı ekle - DOĞRU KOORDİNATLARLA
    L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'vehicle-marker-detail',
            html: '<div style="width: 24px; height: 24px; background: #ff4757; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.5);"></div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        })
    }).addTo(map);
    
    // Harita instance'ını sakla
    detailMapInstance = map;


    // Harita boyutunu düzelt - modal açıldıktan sonra
    setTimeout(() => {
        if (map) {
            map.invalidateSize();
            // Haritayı tekrar merkeze al - DOĞRU KOORDİNATLARLA
            map.setView([lat, lng], 15);

        }
    }, 300);
}

// Araç listesini 30 saniyede bir güncelle
// Global interval ID'yi sakla
let vehicleListUpdateInterval = null;
let vehicleListInitialized = false; // Çift başlatmayı engellemek için

function startVehicleListUpdate() {
    // Başlangıç paketi kontrolü
    const reklamArea = document.getElementById('baslangicPaketReklam');
    if (reklamArea && !reklamArea.classList.contains('baslangic-paket-reklam-hidden')) {
        // Başlangıç paketi kullanılıyor, araç takip güncellemesini durdur
        if (vehicleListUpdateInterval) {
            clearInterval(vehicleListUpdateInterval);
            vehicleListUpdateInterval = null;
        }
        return;
    }
    
    // Eğer zaten başlatılmışsa, sadece interval'ı temizle ve yeniden başlat
    if (vehicleListUpdateInterval) {
        clearInterval(vehicleListUpdateInterval);
        vehicleListUpdateInterval = null;
    }
    
    // İlk yükleme - debounce mekanizması içinde yapılacak
    loadVehicleList().catch(err => console.error('❌ loadVehicleList hatası:', err));
    
    // 5 saniyede bir güncelle (gerçek zamanlı güncelleme)
    // Debounce zaten loadVehicleList içinde var, burada direkt çağırabiliriz
    vehicleListUpdateInterval = setInterval(() => {
        // Başlangıç paketi kontrolü - interval içinde de kontrol et
        const reklamAreaCheck = document.getElementById('baslangicPaketReklam');
        if (reklamAreaCheck && !reklamAreaCheck.classList.contains('hidden')) {
            clearInterval(vehicleListUpdateInterval);
            vehicleListUpdateInterval = null;
            return;
        }
        // Debounce kontrolü loadVehicleList içinde yapılıyor
        loadVehicleList().catch(err => console.error('❌ loadVehicleList hatası:', err));
    }, 5000);

}

// Sayfa yüklendiğinde araç listesini yükle
function initVehicleList() {
    // Çift başlatmayı engelle
    if (vehicleListInitialized) {
        return;
    }
    
    const multiVehicle = document.querySelector('#multiVehicle');
    if (multiVehicle) {
        // Eğer reklam alanı görünüyorsa (başlangıç paketi), araç takip alanını gösterme
        const reklamArea = document.getElementById('baslangicPaketReklam');
        if (reklamArea && !reklamArea.classList.contains('hidden')) {
            return; // Başlangıç paketi kullanılıyor, araç takip alanını gösterme
        }
        // multiVehicle'i görünür yap
        multiVehicle.style.display = 'flex';
        vehicleListInitialized = true;
        startVehicleListUpdate();
    } else {
        // Element henüz yoksa, biraz bekle ve tekrar dene
        setTimeout(() => {
            // Çift başlatmayı tekrar kontrol et
            if (vehicleListInitialized) {
                return;
            }
            const retryMultiVehicle = document.querySelector('#multiVehicle');
            if (retryMultiVehicle) {
                retryMultiVehicle.style.display = 'flex';
                vehicleListInitialized = true;
                startVehicleListUpdate();
            }
        }, 500);
    }
}
//#endregion


//#endregion

// ================ ARAC TAKIP SISTEMI - BOLUM 2 ================

//#region Araç Takip Sistemi

// ================== TEK ARAÇ KART GÜNCELLEMESİ ==================


//  GPS Minimal Card - Tek araç alanını günceller

function initGPSMinimalCard() {
    // Single vehicle kaldırıldı - artık sadece multiVehicle kullanılıyor
    // Bu fonksiyon artık gerekli değil ama geriye dönük uyumluluk için boş bırakıldı
    window.updateCardUI = async function (data) {
        // Single vehicle kaldırıldı, sadece multiVehicle kullanılıyor
        // Araç listesi loadVehicleList() fonksiyonu tarafından güncelleniyor
    };

    // LocalStorage'dan ve backend'den veri okuma ve kart güncelleme
    async function updateCardFromStorage() {
        try {
            // Önce LocalStorage'dan kontrol et
            const teslimatData = localStorage.getItem('teslimatDurum');
            let data = null;

            if (teslimatData) {
                data = JSON.parse(teslimatData);
                
                // Eğer aktif teslimat varsa, backend'den güncel veriyi çek
                if (data.durum === 'aktif' && data.aracId && data.aracId !== 'null' && data.aracId !== '') {
                    try {
                        const API_BASE_URL = window.getFloovonApiBase ? window.getFloovonApiBase() : (window.API_BASE_URL || '/api');
                        const response = await fetch(`${API_BASE_URL}/arac-takip/guncel-konumlar`);
                        
                        if (response.ok) {
                            const backendData = await response.json();
                            if (backendData.success && backendData.data) {
                                // Aktif teslimatı bul
                                const aktifArac = backendData.data.find(arac => 
                                    arac.arac_id == data.aracId && arac.durum === 'teslimatta'
                                );
                                
                                if (aktifArac && aktifArac.latitude && aktifArac.longitude) {
                                    // Backend'den gelen verilerle güncelle
                                    data.sonKonum = {
                                        lat: aktifArac.latitude,
                                        lng: aktifArac.longitude,
                                        speed: aktifArac.hiz ? aktifArac.hiz / 3.6 : null // km/h'yi m/s'ye çevir
                                    };
                                    data.guncelKonum = aktifArac.konum_adi || 'Konum alınıyor...';
                                    data.plaka = aktifArac.plaka || data.plaka;
                                    // surucuAdi artık backend'den değil, oturum sahibinden alınacak (anaSayfaGuncelle'de güncellenecek)
                                    // data.surucuAdi = aktifArac.surucu_adi || data.surucuAdi; // KALDIRILDI
                                    
                                    // LocalStorage'ı da güncelle
                                    localStorage.setItem('teslimatDurum', JSON.stringify(data));
                                }
                            }
                        }
                    } catch (error) {
                        console.warn('⚠️ Backend veri çekme hatası (LocalStorage verisi kullanılıyor):', error);
                    }
                }
                
                updateCardUI(data);
                
                // Araç kartındaki sürücü bilgisini güncelle
                const kartSurucuBilgisi = document.getElementById('kartSurucuBilgisi');
                if (kartSurucuBilgisi) {
                    // Sürücü adını oturum sahibinden al
                    (async () => {
                        try {
                            if (window.userSession && window.userSession.getUser) {
                                const currentUser = window.userSession.getUser();
                                if (currentUser) {
                                    const userId = currentUser.id || 1;
                                    const userResponse = await fetch(`${API_BASE_URL}/auth/me?id=${userId}`);
                                    const userData = await userResponse.json();
                                    if (userData.success && userData.data) {
                                        // Ad ve soyadı birleştir
                                        let surucuAdi = '';
                                        if (userData.data.name && userData.data.surname) {
                                            surucuAdi = `${userData.data.name} ${userData.data.surname}`;
                                        } else if (userData.data.isim && userData.data.soyisim) {
                                            surucuAdi = `${userData.data.isim} ${userData.data.soyisim}`;
                                        } else if (userData.data.name) {
                                            surucuAdi = userData.data.name;
                                        } else if (userData.data.isim) {
                                            surucuAdi = userData.data.isim;
                                        } else if (userData.data.kullaniciadi) {
                                            surucuAdi = userData.data.kullaniciadi;
                                        } else {
                                            surucuAdi = 'Sürücü';
                                        }
                                        kartSurucuBilgisi.textContent = surucuAdi;
                                    }
                                }
                            }
                        } catch (error) {
                            console.warn('⚠️ Sürücü bilgisi alınamadı:', error);
                        }
                    })();
                }
            } else {
                // LocalStorage'da veri yoksa, backend'den aktif teslimat kontrolü yap
                try {
                    const API_BASE_URL = window.getFloovonApiBase ? window.getFloovonApiBase() : (window.API_BASE_URL || '/api');
                    const response = await fetch(`${API_BASE_URL}/arac-takip/guncel-konumlar`);
                    
                    if (response.ok) {
                        const backendData = await response.json();
                        if (backendData.success && backendData.data && backendData.data.length > 0) {
                            // İlk aktif teslimatı al
                            const aktifArac = backendData.data.find(arac => arac.durum === 'teslimatta');
                            if (aktifArac && aktifArac.latitude && aktifArac.longitude) {
                                // Sürücü adını oturum sahibinden al (geçici olarak 'Sürücü', anaSayfaGuncelle'de güncellenecek)
                                let surucuAdiTemp = 'Sürücü';
                                if (window.userSession && window.userSession.getUser) {
                                    const currentUser = window.userSession.getUser();
                                    if (currentUser) {
                                        // Backend'den name bilgisini al (async olmadığı için geçici değer)
                                        surucuAdiTemp = 'Sürücü'; // anaSayfaGuncelle'de güncellenecek
                                    }
                                }
                                
                                data = {
                                    durum: 'aktif',
                                    aracId: aktifArac.arac_id,
                                    surucuId: aktifArac.surucu_id, // Backend'den gelen ID, ama oturum sahibi kullanılacak
                                    plaka: aktifArac.plaka,
                                    surucuAdi: surucuAdiTemp, // Geçici, anaSayfaGuncelle'de güncellenecek
                                    marka: aktifArac.marka,
                                    model: aktifArac.model,
                                    baslangicZamani: aktifArac.baslangic_zamani || new Date().toISOString(),
                                    sonKonum: {
                                        lat: aktifArac.latitude,
                                        lng: aktifArac.longitude,
                                        speed: aktifArac.hiz ? aktifArac.hiz / 3.6 : null
                                    },
                                    guncelKonum: aktifArac.konum_adi || 'Konum alınıyor...'
                                };
                                
                                // LocalStorage'a kaydet
                                localStorage.setItem('teslimatDurum', JSON.stringify(data));
                                updateCardUI(data);
                                return;
                            }
                        }
                    }
                } catch (error) {
                    console.warn('⚠️ Backend aktif teslimat kontrolü hatası:', error);
                }
                
                // Backend'den veri alınamadıysa veya aktif teslimat yoksa beklemede göster
                updateCardUI({
                    durum: 'beklemede',
                    baslangicZamani: null,
                    sonKonum: null
                });
            }
        } catch (error) {
            console.error('❌ GPS veri okuma hatası:', error);
            updateCardUI({
                durum: 'beklemede',
                baslangicZamani: null,
                sonKonum: null
            });
        }
    }

    function calculateSpeed(data) {
        if (!data.sonKonum) return '0';

        // Gerçek GPS hızını kullan
        if (data.sonKonum.speed !== undefined && data.sonKonum.speed !== null) {
            const speedKmh = Math.round(data.sonKonum.speed * 3.6); // m/s → km/h
            return speedKmh.toString();
        }

        return '0';
    }

    function getLocationText(konum) {
        // localStorage'dan güncel konum al
        const teslimatData = localStorage.getItem('teslimatDurum');
        if (teslimatData) {
            const data = JSON.parse(teslimatData);
            if (data.guncelKonum) {
                return data.guncelKonum;
            }
        }

        if (!konum) return 'Konum alınıyor...';
        return 'İş yeri civarında...';
    }

    // İlk yüklemede verileri kontrol et
    updateCardFromStorage().catch(err => console.error('❌ İlk veri yükleme hatası:', err));

    // LocalStorage değişikliklerini dinle (cross-tab)
    // Storage event listener - teslimat durumu değiştiğinde kartı güncelle
    window.addEventListener('storage', function (e) {
        if (e.key === 'teslimatDurum') {

            updateCardFromStorage().catch(err => console.error('❌ Storage event veri yükleme hatası:', err));
        }
    });
    
    // Aynı sekmede de çalışması için periyodik kontrol
    let lastStorageValue = localStorage.getItem('teslimatDurum');
    setInterval(() => {
        const currentStorageValue = localStorage.getItem('teslimatDurum');
        if (currentStorageValue !== lastStorageValue) {

            lastStorageValue = currentStorageValue;
            updateCardFromStorage().catch(err => console.error('❌ Periyodik veri yükleme hatası:', err));
        }
    }, 1000); // 1 saniyede bir kontrol et

    // Sayfa içi güncellemeler için periyodik kontrol
    setInterval(() => {
        updateCardFromStorage().catch(err => console.error('❌ Periyodik veri yükleme hatası:', err));
    }, 5000); // 5 saniyede bir güncelle
}

// ================== TEK ARAÇ MİNİ HARİTA ==================

/**
 * Tek araç alanındaki mini harita kaldırıldı - artık kullanılmıyor
 * Single vehicle görünümü kaldırıldı, sadece multiVehicle kullanılıyor
 */
function initLiveMiniMap() {
    // Single vehicle kaldırıldı, bu fonksiyon artık kullanılmıyor
    // Mini harita artık sadece detay popup'ta gösteriliyor
}

// Test verileri kaldırıldı - tüm veriler dinamik olarak backend'den geliyor

// ================== MODAL FONKSİYONLARI ==================

/**
 * Araç detay modalını göster
 */
async function showVehicleDetail(plateNumber, driverName, location, status, speed, lat, lng, lastUpdate, distance, aracBilgisi = null) {
    const modalPlateNumber = document.getElementById('modalPlateNumber');
    const modalDriverName = document.getElementById('modalDriverName');
    const detailStatus = document.getElementById('detailStatus');
    const detailSpeed = document.getElementById('detailSpeed');
    const detailLocation = document.getElementById('detailLocation');
    const detailCoords = document.getElementById('detailCoords');
    const detailLastUpdate = document.getElementById('detailLastUpdate');
    const detailDistance = document.getElementById('detailDistance');
    
    if (modalPlateNumber) {
        // Plaka ve araç bilgisini birlikte göster
        if (aracBilgisi) {
            modalPlateNumber.innerHTML = `${plateNumber || '--'}<small>${aracBilgisi}</small>`;
        } else {
            modalPlateNumber.textContent = plateNumber || '--';
        }
    }
    if (modalDriverName) modalDriverName.textContent = driverName || '--';
    if (detailStatus) {
        detailStatus.textContent = status || '--';
    if (status === 'Aktif') {
            detailStatus.className = 'detail-info-value status-active-detail';
    } else {
            detailStatus.className = 'detail-info-value status-inactive-detail';
        }
    }
    if (detailSpeed) detailSpeed.textContent = speed ? speed + ' km/h' : '--';
    
    // Eğer location koordinat formatındaysa (örn: "37.9126, 32.5157") adrese çevir
    let displayLocation = location || '--';
    if (location && (location.includes(',') || location.match(/^\d+\.\d+.*\d+\.\d+$/))) {
        // Koordinat formatında, adrese çevir
        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
            try {
                const address = await getAddressFromCoordinates(lat, lng);
                if (address) {
                    displayLocation = address;
                }
            } catch (error) {
                console.warn('⚠️ Adres alınamadı:', error);
            }
        }
    }
    
    if (detailLocation) detailLocation.textContent = displayLocation;
    if (detailCoords) {
        if (lat && lng) {
            detailCoords.textContent = `${lat.toFixed(4)}° K, ${lng.toFixed(4)}° D`;
        } else {
            detailCoords.textContent = '--';
        }
    }
    if (detailLastUpdate) detailLastUpdate.textContent = lastUpdate || '--';
    if (detailDistance) detailDistance.textContent = distance ? distance + ' km' : '--';

    const overlay = document.getElementById('vehicleDetailOverlay');
    if (overlay) {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Haritayı güncelle - sadece geçerli koordinatlar varsa
        if (lat && lng && !isNaN(lat) && !isNaN(lng) && typeof updateDetailMap === 'function') {
            // Harita güncellemesini biraz geciktir ki modal tamamen açılsın
            setTimeout(() => {
                updateDetailMap(lat, lng);
            }, 100);
        } else {
            console.warn('⚠️ Harita gösterilemedi - koordinatlar eksik veya geçersiz:', { lat, lng });
            // Koordinatlar yoksa varsayılan bir harita göster (Konya merkez)
            if (typeof updateDetailMap === 'function') {
                setTimeout(() => {
                    updateDetailMap(37.8746, 32.4932); // Konya merkez
                }, 100);
            }
        }
    }
}

// startMapAnimations fonksiyonu kaldırıldı - artık updateDetailMap kullanılıyor (dinamik)

/**
 * Modal'ı kapat
 */
function closeDetailModal(event) {
    if (!event || (event.target && (event.target.classList.contains('overlay-arac-takip-detay') || event.target.classList.contains('close-btn')))) {
        const overlay = document.getElementById('vehicleDetailOverlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
        document.body.style.overflow = 'auto';
    }
}

/**
 * TEK ARAÇ - Detay butonu (mevcut verilerle modal aç)
 */
async function showDetails() {
    // Önce backend'den aktif teslimat kontrolü yap
    let plateNumber = '--';
    let driverName = '--';
    let status = 'Beklemede';
    let speed = '0';
    let location = 'Henüz teslimat başlamadı';
    let lat = null;
    let lng = null;
    let lastUpdate = '--';
    let distance = '--';
    
    try {
        // Backend'den güncel araç durumlarını kontrol et
        const response = await fetch(`${API_BASE_URL}/arac-takip/guncel-konumlar`);
        if (response.ok) {
            const backendData = await response.json();
            if (backendData.success && backendData.data && backendData.data.length > 0) {
                // Aktif teslimatta olan araçları bul - hem durum hem de is_active kontrolü yap
                const aktifAraclar = backendData.data.filter(arac => {
                    const durum = (arac.durum || arac.arac_durum || '').toString().toLowerCase().trim();
                    const isActiveFromDB = arac.is_active !== undefined ? (arac.is_active === 1 || arac.is_active === true || arac.is_active === '1') : true;
                    return durum === 'teslimatta' && isActiveFromDB;
                });
                
                if (aktifAraclar.length > 0) {
                    // LocalStorage'dan araç ID'sini al
                    const teslimatData = localStorage.getItem('teslimatDurum');
                    let localAracId = null;
                    
                    if (teslimatData) {
                        try {
                            const localData = JSON.parse(teslimatData);
                            localAracId = localData.aracId;
                        } catch (e) {
                            console.error('LocalStorage veri okuma hatası:', e);
                        }
                    }
                    
                    // Eğer LocalStorage'da araç ID varsa onu kullan, yoksa ilk aktif aracı kullan
                    const aktifArac = localAracId 
                        ? aktifAraclar.find(arac => arac.arac_id == localAracId)
                        : aktifAraclar[0];
                    
                    if (aktifArac) {
                        plateNumber = aktifArac.plaka || '--';
                        // Sürücü adını oturum sahibinden al (async)
                        driverName = '--';
                        try {
                            if (window.userSession && window.userSession.getUser) {
                                const currentUser = window.userSession.getUser();
                                if (currentUser) {
                                    const userId = currentUser.id || 1;
                                    const userResponse = await fetch(`${API_BASE_URL}/auth/me?id=${userId}`);
                                    const userData = await userResponse.json();
                                    if (userData.success && userData.data) {
                                        // Ad ve soyadı birleştir
                                        if (userData.data.name && userData.data.surname) {
                                            driverName = `${userData.data.name} ${userData.data.surname}`;
                                        } else if (userData.data.isim && userData.data.soyisim) {
                                            driverName = `${userData.data.isim} ${userData.data.soyisim}`;
                                        } else if (userData.data.name) {
                                            driverName = userData.data.name;
                                        } else if (userData.data.isim) {
                                            driverName = userData.data.isim;
                                        } else if (userData.data.kullaniciadi) {
                                            driverName = userData.data.kullaniciadi;
                                        } else {
                                            driverName = 'Sürücü';
                                        }
                                    }
                                }
                            }
                        } catch (error) {
                            console.warn('⚠️ Sürücü bilgisi alınamadı:', error);
                        }
                        status = 'Aktif';
                        
                        // Backend'den son konum bilgisini al
                        try {
                            const konumResponse = await fetch(`${API_BASE_URL}/arac-takip/${aktifArac.arac_id}/konum`);
                            if (konumResponse.ok) {
                                const konumData = await konumResponse.json();
                                if (konumData.success && konumData.data) {
                                    const loc = konumData.data;
                                    lat = loc.enlem || loc.latitude;
                                    lng = loc.boylam || loc.longitude;
                                    speed = loc.hiz ? Math.round(loc.hiz).toString() : '0';
                                    location = loc.konum_adi || 'Konum alınıyor...';
                                    
                                    // Son güncelleme zamanını hesapla - TÜM OLASI ALANLARI KONTROL ET
                                    // Öncelik sırası: kayit_zamani > timestamp > son_guncelleme > guncelleme_zamani
                                    const zamanField = loc.kayit_zamani || loc.timestamp || loc.son_guncelleme || loc.guncelleme_zamani || 
                                                     loc.created_at || loc.updated_at || loc.zaman || 
                                                     loc.kayit_tarihi || loc.guncelleme_tarihi || loc.son_guncelleme_zamani;
                                    if (zamanField) {
                                        let kayitTarihi;
                                        const dateStr = String(zamanField);
                                        
                                        // ISO format kontrolü (T veya Z içeriyorsa ISO format)
                                        if (dateStr.includes('T') || dateStr.includes('Z') || dateStr.includes('+') || dateStr.includes('-') && dateStr.match(/^\d{4}-\d{2}-\d{2}T/)) {
                                            // ISO format - direkt parse et
                                            kayitTarihi = new Date(dateStr);
                                        } else {
                                            // SQLite datetime formatı: "YYYY-MM-DD HH:MM:SS"
                                            // SQLite CURRENT_TIMESTAMP yerel saat dilimini kullanır, direkt parse et
                                            const parts = dateStr.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
                                            if (parts) {
                                                // Yıl, Ay (0-11), Gün, Saat, Dakika, Saniye
                                                // SQLite datetime'ı yerel saat dilimi olarak yorumla
                                                kayitTarihi = new Date(
                                                    parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]),
                                                    parseInt(parts[4]), parseInt(parts[5]), parseInt(parts[6])
                                                );
                                            } else {
                                                kayitTarihi = new Date(dateStr); // Fallback
                                            }
                                        }
                                        
                                        if (isNaN(kayitTarihi.getTime())) {
                                            console.warn('⚠️ Geçersiz tarih:', zamanField, 'Backend verisi:', loc);
                                            lastUpdate = '--';
                                        } else {
                                            const gecenSure = Math.floor((new Date() - kayitTarihi) / 1000 / 60);
                                            if (gecenSure < 0) {
                                                console.warn('⚠️ Gelecekteki tarih:', zamanField, 'Hesaplanan:', kayitTarihi, 'Şimdi:', new Date());
                                                lastUpdate = '--';
                                            } else if (gecenSure < 1) {
                                                lastUpdate = 'Az önce';
                                            } else if (gecenSure < 60) {
                                                lastUpdate = `${gecenSure} dk önce`;
                                            } else {
                                                const saat = Math.floor(gecenSure / 60);
                                                const dakika = gecenSure % 60;
                                                if (dakika > 0) {
                                                    lastUpdate = `${saat}s ${dakika}dk önce`;
                                                } else {
                                                    lastUpdate = `${saat} saat önce`;
                                                }
                                            }
                                        }
                                    } else {
                                        console.warn('⚠️ Kayıt zamanı bulunamadı. Backend verisi:', loc);
                                        console.warn('⚠️ Mevcut alanlar:', Object.keys(loc));
                                        lastUpdate = '--';
                                    }
                                }
                            }
                        } catch (error) {
                            console.error('Konum bilgisi alınamadı:', error);
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.warn('⚠️ Backend aktif teslimat kontrolü hatası:', error);
    }
    
    // Eğer backend'den veri alınamadıysa, LocalStorage'dan al
    if (plateNumber === '--') {
        const teslimatData = localStorage.getItem('teslimatDurum');
        if (teslimatData) {
            try {
                const veri = JSON.parse(teslimatData);
                plateNumber = veri.plaka || '--';
                // Sürücü adını LocalStorage'dan değil, oturum sahibinden al
                // driverName = veri.surucuAdi || '--'; // KALDIRILDI
                status = veri.durum === 'aktif' ? 'Aktif' : (veri.durum === 'tamamlandi' ? 'Tamamlandı' : 'Beklemede');
                
                if (veri.sonKonum) {
                    lat = veri.sonKonum.lat;
                    lng = veri.sonKonum.lng;
                    if (veri.sonKonum.speed) {
                        speed = (veri.sonKonum.speed * 3.6).toFixed(0); // m/s'den km/h'ye çevir
                    }
                }
                
                location = veri.guncelKonum || 'Konum alınıyor...';
                
                // Son güncelleme zamanını hesapla
                if (veri.baslangicZamani) {
                    const gecenSure = Math.floor((new Date() - new Date(veri.baslangicZamani)) / 1000 / 60);
                    if (gecenSure < 1) {
                        lastUpdate = 'Az önce';
                    } else if (gecenSure < 60) {
                        lastUpdate = `${gecenSure} dk önce`;
                    } else {
                        const saat = Math.floor(gecenSure / 60);
                        lastUpdate = `${saat} saat önce`;
                    }
                }
            } catch (e) {
                console.error('LocalStorage veri okuma hatası:', e);
            }
        }
    }
    
    // Eğer hala veri yoksa, karttan al
    if (plateNumber === '--') {
        const kartAracBilgisi = document.getElementById('kartAracBilgisi');
        const kartDurum = document.getElementById('kartDurum');
        const kartHiz = document.getElementById('kartHiz');
        const kartKonum = document.getElementById('kartKonum');
        
        if (kartAracBilgisi) {
            const plakaEl = kartAracBilgisi.querySelector('.arac-plaka');
            if (plakaEl) {
                plateNumber = plakaEl.textContent || '--';
            } else {
                // Eski format için fallback
                plateNumber = kartAracBilgisi.textContent || '--';
            }
        }
        // Sürücü bilgisini karttan değil, oturum sahibinden alacağız (aşağıda)
        if (kartDurum) status = kartDurum.textContent || 'Beklemede';
        if (kartHiz) speed = kartHiz.textContent.replace(' km/h', '') || '0';
        if (kartKonum) location = kartKonum.textContent.replace('📍 ', '') || 'Henüz teslimat başlamadı';
    }
    
    // Sürücü adını oturum sahibinden al (her zaman)
    if (driverName === '--' || !driverName || driverName === 'Henüz sürücü atanmadı') {
        try {
            if (window.userSession && window.userSession.getUser) {
                const currentUser = window.userSession.getUser();
                if (currentUser) {
                    const userId = currentUser.id || 1;
                    // floovonFetch kullan - otomatik CORS ve hata yönetimi
                    const userData = await (window.floovonFetch || fetch)(`/api/auth/me?id=${userId}`);
                    if (userData.success && userData.data) {
                        driverName = userData.data.name || userData.data.isim || userData.data.kullaniciadi || 'Sürücü';
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Sürücü bilgisi alınamadı:', error);
        }
    }
    
    // Araç bilgisini backend'den al (marka-model için)
    let aracBilgisi = null;
    if (plateNumber && plateNumber !== '--') {
        try {
            // LocalStorage'dan araç ID'sini al
            const teslimatData = localStorage.getItem('teslimatDurum');
            if (teslimatData) {
                const veri = JSON.parse(teslimatData);
                if (veri.aracId) {
                    const aracResponse = await fetch(`${API_BASE_URL}/araclar/${veri.aracId}`);
                    const aracData = await aracResponse.json();
                    if (aracData.success && aracData.data) {
                        const marka = aracData.data.marka || '';
                        const model = aracData.data.model || '';
                        if (marka || model) {
                            aracBilgisi = `${marka} ${model}`.trim();
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Araç bilgisi alınamadı:', error);
        }
    }

    showVehicleDetail(plateNumber, driverName, location, status, speed, lat, lng, lastUpdate, distance, aracBilgisi);
}

/**
 * ÇOKLU ARAÇ - Item'a tıklayınca modal aç
 */
async function selectVehicle(plateNumber) {
    const vehicleItems = document.querySelectorAll('.vehicle-item');
    let selectedVehicle = null;

    vehicleItems.forEach(item => {
        const plateElement = item.querySelector('.plate-number');
        if (plateElement && plateElement.textContent.trim() === plateNumber.trim()) {
            // Durum kontrolü - sadece aktif araçlar için detay popup açılabilir
            const durum = item.getAttribute('data-durum') || '';
            const isActive = durum === 'teslimatta';
            
            if (!isActive) {
                createToast({
                    message: 'Bu araç şu anda teslimatta değil. Detay görüntülemek için araç teslimata çıkmalı.',
                    type: 'info',
                    position: 'center'
                });
                return;
            }
            
            // Sürücü adını vehicle-driver'dan değil, oturum sahibinden alacağız (aşağıda)
            const location = item.querySelector('.vehicle-location')?.textContent.replace('📍', '').trim() || '--';
            const statusElement = item.querySelector('.vehicle-status');
            const status = statusElement?.textContent || 'Beklemede';
            
            // data-arac-id attribute'undan araç ID'sini al
            const aracId = item.getAttribute('data-arac-id');
            const konumLat = item.getAttribute('data-konum-lat');
            const konumLng = item.getAttribute('data-konum-lng');
            
            selectedVehicle = {
                plateNumber,
                driverName: '--', // Geçici, aşağıda oturum sahibinden alınacak
                location,
                status,
                aracId,
                konum_lat: konumLat ? parseFloat(konumLat) : null,
                konum_lng: konumLng ? parseFloat(konumLng) : null
            };
        }
    });

    if (!selectedVehicle) {
        console.warn('⚠️ Seçilen araç bulunamadı veya beklemede:', plateNumber);
        return;
    }

    // Backend'den güncel konum bilgisini al
    let lat = null;
    let lng = null;
    let speed = '0';
    let lastUpdate = '--';
    let distance = '--';
    let konumAdi = selectedVehicle.location;
    
    if (selectedVehicle.aracId) {
        try {
            const response = await fetch(`${API_BASE_URL}/arac-takip/${selectedVehicle.aracId}/konum`);
            const locationData = await response.json();
            
            if (locationData.success && locationData.data) {
                const loc = locationData.data;
                // Koordinatları doğru al - önce latitude/longitude, sonra enlem/boylam
                lat = loc.latitude || loc.enlem || loc.lat;
                lng = loc.longitude || loc.boylam || loc.lng || loc.lon;
                // Koordinatları sayıya çevir
                lat = lat ? parseFloat(lat) : null;
                lng = lng ? parseFloat(lng) : null;
                speed = loc.hiz ? Math.round(loc.hiz).toString() : '0';
                konumAdi = loc.konum_adi || konumAdi;
                // Son güncelleme zamanını hesapla - TÜM OLASI ALANLARI KONTROL ET
                // Öncelik sırası: kayit_zamani > timestamp > son_guncelleme > guncelleme_zamani
                const kayitZamani = loc.kayit_zamani || loc.timestamp || loc.son_guncelleme || loc.guncelleme_zamani || 
                                   loc.created_at || loc.updated_at || loc.zaman || 
                                   loc.kayit_tarihi || loc.guncelleme_tarihi || loc.son_guncelleme_zamani;
                
                if (kayitZamani) {
                    let kayitTarihi;
                    const dateStr = String(kayitZamani);
                    
                    // ISO format kontrolü (T veya Z içeriyorsa ISO format)
                    if (dateStr.includes('T') || dateStr.includes('Z') || dateStr.includes('+') || dateStr.includes('-') && dateStr.match(/^\d{4}-\d{2}-\d{2}T/)) {
                        // ISO format - direkt parse et
                        kayitTarihi = new Date(dateStr);
                    } else {
                        // SQLite datetime formatı: "YYYY-MM-DD HH:MM:SS"
                        // SQLite CURRENT_TIMESTAMP UTC+0 olarak kaydeder, ama biz Türkiye saati (UTC+3) olarak yorumlamalıyız
                        const parts = dateStr.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
                        if (parts) {
                            // Yıl, Ay (0-11), Gün, Saat, Dakika, Saniye
                            // SQLite datetime'ı UTC+0 olarak kaydeder, Türkiye saati (UTC+3) için 3 saat ekle
                            const utcDate = new Date(Date.UTC(
                                parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]),
                                parseInt(parts[4]), parseInt(parts[5]), parseInt(parts[6])
                            ));
                            // UTC+3 (Türkiye saati) için 3 saat ekle
                            kayitTarihi = new Date(utcDate.getTime() + (3 * 60 * 60 * 1000));
                        } else {
                            // Fallback - direkt parse et
                            kayitTarihi = new Date(dateStr);
                        }
                    }
                    
                    const simdi = new Date();
                    
                    // Tarih geçerli mi kontrol et
                    if (isNaN(kayitTarihi.getTime())) {
                        console.warn('⚠️ Geçersiz tarih:', kayitZamani, 'Backend verisi:', loc);
                        lastUpdate = '--';
                    } else {
                        const gecenSureSaniye = Math.floor((simdi - kayitTarihi) / 1000);

                        
                        if (gecenSureSaniye < 0) {
                            // Gelecekteki bir tarih - muhtemelen yanlış veri
                            console.warn('⚠️ Gelecekteki tarih:', kayitZamani, 'Hesaplanan:', kayitTarihi, 'Şimdi:', simdi);
                            lastUpdate = '--';
                        } else if (gecenSureSaniye < 60) {
                            lastUpdate = 'Az önce';
                        } else if (gecenSureSaniye < 3600) {
                            const dakika = Math.floor(gecenSureSaniye / 60);
                            lastUpdate = `${dakika} dk önce`;
                        } else {
                            const saat = Math.floor(gecenSureSaniye / 3600);
                            const dakika = Math.floor((gecenSureSaniye % 3600) / 60);
                            if (dakika > 0) {
                                lastUpdate = `${saat}s ${dakika}dk önce`;
                            } else {
                                lastUpdate = `${saat} saat önce`;
                            }
                        }
                    }
                } else {
                    // Debug: Backend'den gelen tüm veriyi göster
                    console.warn('⚠️ Kayıt zamanı bulunamadı. Backend verisi:', loc);
                    console.warn('⚠️ Mevcut alanlar:', Object.keys(loc));
                    lastUpdate = '--';
                }
                
                // Eğer koordinatlar yoksa, backend'den gelen veriyi kullan
                if (!lat || !lng) {
                    console.warn('⚠️ Koordinatlar bulunamadı, backend verisi:', loc);
                }
            } else {
                console.warn('⚠️ Backend\'den konum verisi alınamadı');
            }
        } catch (error) {
            console.error('❌ Araç konum bilgisi alınamadı:', error);
        }
    }
    
    // Eğer konum adı yoksa ama koordinatlar varsa, adresi al
    if (!konumAdi || konumAdi === '--' || konumAdi === 'Konum alınıyor...') {
        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
            try {
                const address = await getAddressFromCoordinates(lat, lng);
                if (address) {
                    konumAdi = address;
                }
            } catch (error) {
                console.warn('⚠️ Adres alınamadı:', error);
            }
        }
    }
    
    // Koordinatları sayıya çevir
    lat = lat ? parseFloat(lat) : null;
    lng = lng ? parseFloat(lng) : null;
    
    // Koordinatların geçerli olduğundan emin ol
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        console.warn('⚠️ Geçersiz koordinatlar:', { lat, lng });
        // Backend'den gelen veriyi kontrol et
        if (selectedVehicle.konum_lat && selectedVehicle.konum_lng) {
            lat = parseFloat(selectedVehicle.konum_lat);
            lng = parseFloat(selectedVehicle.konum_lng);
        }
    }
    
    // Kat edilen mesafeyi hesapla - SADECE bu teslimat için (teslimata başladığı andan şu ana kadar)
    if (selectedVehicle.aracId) {
        try {
            // LocalStorage'dan teslimat bilgilerini al
            const teslimatData = localStorage.getItem('teslimatDurum');
            if (teslimatData) {
                const veri = JSON.parse(teslimatData);
                // Sadece aynı araç ve aktif teslimat için mesafe hesapla
                if (veri.baslangicZamani && veri.aracId == selectedVehicle.aracId && veri.durum === 'aktif') {
                    // Teslimat ID varsa onu kullan (daha doğru filtreleme için)
                    const toplamMesafe = await calculateTotalDistance(
                        selectedVehicle.aracId, 
                        veri.baslangicZamani,
                        veri.teslimatId || null
                    );

                    if (toplamMesafe > 0) {
                        distance = toplamMesafe.toFixed(2);
                    } else {
                        distance = '0.00';
                    }
                } else {
                    distance = '0.00';
                }
            } else {
                distance = '0.00';
            }
        } catch (error) {
            console.error('❌ Mesafe hesaplama hatası:', error);
            distance = '0.00';
        }
    } else {
        distance = '0.00';
    }
    
    // Sürücü adını oturum sahibinden al (her zaman)
    let driverName = selectedVehicle.driverName;
    if (!driverName || driverName === '--' || driverName === 'Henüz sürücü atanmadı') {
        try {
            if (window.userSession && window.userSession.getUser) {
                const currentUser = window.userSession.getUser();
                if (currentUser) {
                    const userId = currentUser.id || 1;
                    // floovonFetch kullan - otomatik CORS ve hata yönetimi
                    const userData = await (window.floovonFetch || fetch)(`/api/auth/me?id=${userId}`);
                    if (userData.success && userData.data) {
                        // Ad ve soyadı birleştir
                        if (userData.data.name && userData.data.surname) {
                            driverName = `${userData.data.name} ${userData.data.surname}`;
                        } else if (userData.data.isim && userData.data.soyisim) {
                            driverName = `${userData.data.isim} ${userData.data.soyisim}`;
                        } else if (userData.data.name) {
                            driverName = userData.data.name;
                        } else if (userData.data.isim) {
                            driverName = userData.data.isim;
                        } else if (userData.data.kullaniciadi) {
                            driverName = userData.data.kullaniciadi;
                        } else {
                            driverName = 'Sürücü';
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Sürücü bilgisi alınamadı:', error);
        }
    }
    
    // Araç bilgisini backend'den al (marka-model için)
    let aracBilgisi = null;
    if (selectedVehicle.aracId) {
        try {
            const aracResponse = await fetch(`${API_BASE_URL}/araclar/${selectedVehicle.aracId}`);
            const aracData = await aracResponse.json();
            if (aracData.success && aracData.data) {
                const marka = aracData.data.marka || '';
                const model = aracData.data.model || '';
                if (marka || model) {
                    aracBilgisi = `${marka} ${model}`.trim();
                }
            }
        } catch (error) {
            console.warn('⚠️ Araç bilgisi alınamadı:', error);
        }
    }

    showVehicleDetail(
        selectedVehicle.plateNumber,
        driverName,
        konumAdi || 'Konum bilgisi yok',
        selectedVehicle.status,
        speed,
        lat,
        lng,
        lastUpdate,
        distance,
        aracBilgisi // Araç bilgisini ekle
    );
}

/**
 * Haritada takip et
 */
function trackVehicle() {
    const plateNumber = document.getElementById('modalPlateNumber').textContent;
    alert(`${plateNumber} plakalı araç haritada takip ediliyor...`);
    closeDetailModal();
}

// ================== AKTİF ARAÇ SAYACI ==================

/**
 * Aktif araç sayısını hesapla ve güncelle
 */
function updateActiveVehicleCount() {
    const activeVehicles = document.querySelectorAll('.vehicle-item .status-active');
    const activeCount = activeVehicles.length;

    const countSpan = document.querySelector('.active-vehicles-info span');
    if (countSpan) {
        countSpan.textContent = activeCount;
    }

    // console.log(`Aktif araç sayısı: ${activeCount}`);
    return activeCount;
}

// ================== EVENT LISTENERS ==================
// DOMContentLoaded dosya sonundaki init bloğuna taşındı

// ================== GLOBAL FONKSİYONLAR ==================

window.showVehicleDetail = showVehicleDetail;
window.closeDetailModal = closeDetailModal;
window.showDetails = showDetails;
window.selectVehicle = selectVehicle;
window.trackVehicle = trackVehicle;
window.updateActiveVehicleCount = updateActiveVehicleCount;

// Mobil Araç Takip Modal Fonksiyonları
// Modal oluşturma fonksiyonu
function createAracTakipModal() {
    // Modal zaten varsa oluşturma
    if (document.getElementById('aracTakipModal')) {
        return;
    }
    
    const modalHTML = `
        <div id="aracTakipModal" class="arac-takip-modal-overlay" onclick="if(event.target.id === 'aracTakipModal') closeAracTakipModal()">
            <div class="arac-takip-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Araç Takip</h3>
                    <button class="close-btn" onclick="closeAracTakipModal()">&times;</button>
                </div>
                <div id="aracTakipModalContent" class="modal-content">
                    <!-- İçerik dinamik olarak yüklenecek -->
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

async function openAracTakipModal() {
    // Modal yoksa oluştur
    createAracTakipModal();
    
    const modal = document.getElementById('aracTakipModal');
    const modalContent = document.getElementById('aracTakipModalContent');
    
    if (!modal || !modalContent) {
        console.error('❌ Araç takip modal elementi oluşturulamadı');
        return;
    }
    
    // ÖNCE LocalStorage'dan kontrol et (daha hızlı)
    let isActive = false;
    let teslimatInfo = null;
    
    const teslimatData = localStorage.getItem('teslimatDurum');
    if (teslimatData) {
        try {
            const localData = JSON.parse(teslimatData);
            // LocalStorage'da aktif teslimat varsa ve aracId varsa, direkt aktif göster
            if (localData.durum === 'aktif' && localData.aracId && localData.aracId !== 'null' && localData.aracId !== '') {
                isActive = true;
                teslimatInfo = localData;
            }
        } catch (e) {
            console.error('LocalStorage veri okuma hatası:', e);
        }
    }
    
    // Backend'den de kontrol et (doğrulama için)
    // ÖNEMLİ: Backend kontrolü yapılıyor - eğer backend'de aktif teslimat yoksa LocalStorage'ı temizle
    try {
        const response = await fetch(`${API_BASE_URL}/arac-takip/guncel-konumlar`);
        if (response.ok) {
            const backendData = await response.json();
            if (backendData.success && backendData.data && backendData.data.length > 0) {
                // Backend'de aktif teslimatta olan araçları bul - sadece 'teslimatta' durumunu kontrol et
                const aktifAraclar = backendData.data.filter(arac => {
                    const durum = arac.durum || '';
                    return durum === 'teslimatta';
                });
                
                if (teslimatInfo && teslimatInfo.aracId) {
                    // LocalStorage'daki araç ID ile backend'deki aktif araçları eşleştir
                    const aktifArac = aktifAraclar.find(arac => (arac.id || arac.arac_id) == teslimatInfo.aracId);
                    
                    if (aktifArac) {
                        // Backend'de aktif teslimat var, LocalStorage'daki veriyi kullan
                        teslimatInfo.plaka = aktifArac.plaka || teslimatInfo.plaka;
                        // Sürücü adını backend'den değil, oturum sahibinden alacağız (aşağıda surucuAdi değişkeninde)
                        // teslimatInfo.surucuAdi artık backend'den gelmeyecek
                        isActive = true;
                    } else {
                        // Backend'de bu araç aktif değil - LocalStorage'ı temizle
                        console.log('⚠️ Backend\'de aktif teslimat yok, LocalStorage temizleniyor...');
                        localStorage.removeItem('teslimatDurum');
                        isActive = false;
                        teslimatInfo = null;
                    }
                } else if (aktifAraclar.length === 0 && isActive) {
                    // Backend'de aktif teslimat yok ama LocalStorage'da var - LocalStorage'ı temizle
                    console.log('⚠️ Backend\'de aktif teslimat yok, LocalStorage temizleniyor...');
                    localStorage.removeItem('teslimatDurum');
                    isActive = false;
                    teslimatInfo = null;
                } else if (aktifAraclar.length === 0 && !isActive) {
                    // Backend'de aktif teslimat yok ve LocalStorage'da da yok - zaten temiz
                }
            } else {
                // Backend'den veri gelmedi - LocalStorage'ı kontrol et, eğer varsa temizle
                if (isActive) {
                    console.warn('⚠️ Backend\'den veri gelmedi ama LocalStorage\'da aktif teslimat var - LocalStorage temizleniyor');
                    localStorage.removeItem('teslimatDurum');
                    isActive = false;
                    teslimatInfo = null;
                }
            }
        } else {
            // Backend yanıt vermedi - LocalStorage'ı kontrol et
            if (isActive) {
                console.warn('⚠️ Backend yanıt vermedi ama LocalStorage\'da aktif teslimat var - LocalStorage temizleniyor');
                localStorage.removeItem('teslimatDurum');
                isActive = false;
                teslimatInfo = null;
            }
        }
    } catch (error) {
        console.warn('⚠️ Backend aktif teslimat kontrolü hatası:', error);
        // Backend hatası durumunda - eğer LocalStorage'da aktif teslimat varsa temizle
        if (isActive) {
            console.warn('⚠️ Backend hatası nedeniyle LocalStorage temizleniyor');
            localStorage.removeItem('teslimatDurum');
            isActive = false;
            teslimatInfo = null;
        }
    }
    
    // Kullanıcı bilgilerini al (sürücü bilgisi için) - Oturum sahibinden
    let surucuAdi = 'Sürücü';
    let surucuId = null;
    try {
        // UserSession'dan kullanıcı bilgisini al
        if (window.userSession && window.userSession.getUser) {
            const currentUser = window.userSession.getUser();
            if (currentUser) {
                surucuId = currentUser.id || null;
                // Backend'den name bilgisini al
                // floovonFetch kullan - otomatik CORS ve hata yönetimi
                const userData = await (window.floovonFetch || fetch)(`/api/auth/me?id=${surucuId || 1}`);
                if (userData.success && userData.data) {
                    // Ad ve soyadı birleştir
                    if (userData.data.name && userData.data.surname) {
                        surucuAdi = `${userData.data.name} ${userData.data.surname}`;
                    } else if (userData.data.isim && userData.data.soyisim) {
                        surucuAdi = `${userData.data.isim} ${userData.data.soyisim}`;
                    } else if (userData.data.name) {
                        surucuAdi = userData.data.name;
                    } else if (userData.data.isim) {
                        surucuAdi = userData.data.isim;
                    } else if (userData.data.kullaniciadi) {
                        surucuAdi = userData.data.kullaniciadi;
                    } else {
                        surucuAdi = 'Sürücü';
                    }
                    surucuId = userData.data.id || userData.data.user_id || surucuId || null;
                }
            }
        } else {
            // UserSession yoksa direkt backend'den al
            // floovonFetch kullan - otomatik CORS ve hata yönetimi
            const userData = await (window.floovonFetch || fetch)(`/api/auth/me?id=1`);
            if (userData.success && userData.data) {
                // Ad ve soyadı birleştir
                if (userData.data.name && userData.data.surname) {
                    surucuAdi = `${userData.data.name} ${userData.data.surname}`;
                } else if (userData.data.isim && userData.data.soyisim) {
                    surucuAdi = `${userData.data.isim} ${userData.data.soyisim}`;
                } else if (userData.data.name) {
                    surucuAdi = userData.data.name;
                } else if (userData.data.isim) {
                    surucuAdi = userData.data.isim;
                } else if (userData.data.kullaniciadi) {
                    surucuAdi = userData.data.kullaniciadi;
                } else {
                    surucuAdi = 'Sürücü';
                }
                surucuId = userData.data.id || userData.data.user_id || null;
            }
        }
    } catch (error) {
        console.warn('⚠️ Kullanıcı bilgisi alınamadı:', error);
    }
    
    // Araçları backend'den yükle
    let araclar = [];
    try {
        // floovonFetch kullan - otomatik /api/ prefix ve header yönetimi
        // Önce aktif_only=true ile dene
        let aracResponse = await (window.floovonFetch || window.floovonFetchStandard || fetch)(`/api/araclar?aktif_only=true`);
        
        // Response kontrolü - 400 Bad Request gibi hataları handle et
        if (aracResponse && typeof aracResponse.status !== 'undefined' && aracResponse.status === 400) {
            // Backend bu query parameter'ı desteklemiyor, aktif_only olmadan tekrar dene
            aracResponse = await (window.floovonFetch || window.floovonFetchStandard || fetch)(`/api/araclar`);
        }
        
        if (aracResponse && typeof aracResponse.status !== 'undefined' && aracResponse.status >= 400) {
            // Hala hata varsa, araç listesi boş kalacak ama modal açılmaya devam edecek
            araclar = [];
        }
        
        const aracData = (aracResponse && typeof aracResponse.json === 'function') ? await aracResponse.json() : aracResponse;
        if (aracData && aracData.success && aracData.data) {
            araclar = aracData.data;
            // Eğer aktif_only desteklenmiyorsa, frontend'de filtrele (aktif olanları al)
            if (araclar.length > 0 && araclar[0].hasOwnProperty('aktif')) {
                araclar = araclar.filter(arac => arac.aktif === true || arac.aktif === 1);
            }
        }
    } catch (error) {
        // Sessizce logla - kritik değil, sayfa çalışmaya devam eder
        console.warn('⚠️ Araçlar yüklenemedi (kritik değil):', error.message || error);
    }
    
    // Mobil buton durumunu güncelle - teslimat yoksa gri olmalı
    const mobileAracTakipBtn = document.getElementById('mobileAracTakipBtn');
    if (mobileAracTakipBtn) {
        if (isActive && teslimatInfo) {
            mobileAracTakipBtn.classList.add('active');
        } else {
            mobileAracTakipBtn.classList.remove('active');
        }
    }
    
    // Backend kontrolünün tamamlanmasını bekle (popup içeriği doğru gösterilsin)
    // Backend kontrolü async olduğu için, içerik oluşturulmadan önce kontrol edildiğinden emin ol
    
    // Modal içeriğini oluştur
    if (isActive && teslimatInfo) {
        // Aktif teslimat varsa - süre bilgileri göster
        const gecenSure = teslimatInfo.baslangicZamani 
            ? Math.floor((new Date() - new Date(teslimatInfo.baslangicZamani)) / 1000 / 60)
            : 0;
        const saat = Math.floor(gecenSure / 60);
        const dakika = gecenSure % 60;
        const sureText = saat > 0 ? `${saat}s ${dakika} dk` : `${dakika} dk`;
        
        // Araç bilgisini backend'den al (marka-model)
        let aracBilgisiText = '';
        if (teslimatInfo.aracId) {
            try {
                const aracResponse = await fetch(`${API_BASE_URL}/araclar/${teslimatInfo.aracId}`);
                const aracData = await aracResponse.json();
                if (aracData.success && aracData.data) {
                    const marka = aracData.data.marka || '';
                    const model = aracData.data.model || '';
                    if (marka || model) {
                        aracBilgisiText = `${marka} ${model}`.trim();
                    }
                }
            } catch (error) {
                console.warn('⚠️ Araç bilgisi alınamadı:', error);
            }
        }
        
        modalContent.innerHTML = `
            <div class="modal-content-center">
                <div class="modal-info-group">
                    <div class="modal-info-label">Araç</div>
                    <div class="modal-info-value">${teslimatInfo.plaka || '--'}${aracBilgisiText ? `<br><small style="font-size: 0.85em; opacity: 0.8;">${aracBilgisiText}</small>` : ''}</div>
                </div>
                <div class="modal-info-group">
                    <div class="modal-info-label">Sürücü</div>
                    <div class="modal-info-value-small">${surucuAdi}</div>
                </div>
                <div class="modal-sure-box">
                    <div class="modal-sure-label">Teslimat Süresi</div>
                    <div class="modal-sure-value">${sureText}</div>
                </div>
             <!--  <div class="modal-info-group">
                    <div class="modal-info-label">Durum</div>
                    <div class="modal-durum-badge">Aktif</div>
                </div> -->
                <button id="teslimatTamamlaBtn" class="btn-teslimata-ciktim btn-stop" onclick="teslimatTamamla()">
                    <i class="fa-solid fa-stop"></i> Teslimatı Tamamla
                </button>
            </div>
        `;
    } else {
        // Teslimat yoksa - araç seçimi göster
        // Artık surucu_id kullanılmıyor, oturum sahibi sürücü olacak
        const aracOptions = araclar.map(arac => 
            `<option value="${arac.id}">${arac.plaka} - ${arac.marka || ''} ${arac.model || ''}`.trim() + `</option>`
        ).join('');
        
        modalContent.innerHTML = `
            <div class="modal-info-group">
                <label class="modal-label">
                    <span class="plate-icon" style="display: inline-flex; vertical-align: middle;">${LUCIDE_VAN_ICON_16}</span> Araç Seçiniz
                </label>
                <select id="aracTakipModalSelect" class="modal-select">
                    <option value="">Araç seçiniz...</option>
                    ${aracOptions}
                </select>
            </div>
            
            <div class="modal-info-group">
                <label class="modal-label">
                    <i class="fa-solid fa-user"></i> Sürücü
                </label>
                <input type="text" class="modal-input" value="${surucuAdi}" disabled>
            </div>
            
            <button id="teslimataCiktimBtn" class="btn-teslimata-ciktim btn-start" onclick="teslimataCiktimBaslat()">
                <i class="fa-solid fa-play"></i> TESLİMATA ÇIKTIM
            </button>
        `;
        
        // Araç seçimi değiştiğinde sürücü ID'sini güncelle
        const aracSelect = document.getElementById('aracTakipModalSelect');
        if (aracSelect) {
            aracSelect.addEventListener('change', (e) => {
                const selectedOption = e.target.selectedOptions[0];
                // Artık surucu_id kullanılmıyor, oturum sahibi sürücü olacak
                localStorage.setItem('secilenAracId', e.target.value);
            });
        }
    }
    modal.style.display = 'flex';
    // Modal'ın görünür olduğundan emin ol
    setTimeout(() => {
        if (modal.style.display !== 'flex' && modal.style.display !== 'block') {
            console.warn('⚠️ Modal display düzgün ayarlanmamış, tekrar ayarlanıyor...');
            modal.style.display = 'flex';
        }
    }, 100);
}

function closeAracTakipModal() {
    const modal = document.getElementById('aracTakipModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Teslimata çıktım butonuna tıklanınca
async function teslimataCiktimBaslat() {
    const aracSelect = document.getElementById('aracTakipModalSelect');
    if (!aracSelect || !aracSelect.value) {
        createToast('warning', 'Lütfen önce bir araç seçin!');
        return;
    }
    
    const aracId = aracSelect.value;
    
    // Kullanıcı bilgilerini al - Oturum sahibinden (sürücü bilgisi için)
    // Artık sürücüler tablosu kullanılmıyor, sadece oturum sahibi sürücü olacak
    const API_BASE_URL = window.getFloovonApiBase ? window.getFloovonApiBase() : (window.API_BASE_URL || '/api');
    let surucuId = null;
    let surucuAdi = 'Sürücü';
    try {
        // UserSession'dan kullanıcı bilgisini al
        if (window.userSession && window.userSession.getUser) {
            const currentUser = window.userSession.getUser();
            if (currentUser) {
                const userId = currentUser.id || 1;
                surucuId = userId;
                // Backend'den name bilgisini al
                const userResponse = await fetch(`${API_BASE_URL}/auth/me?id=${userId}`);
                const userData = await userResponse.json();
                if (userData.success && userData.data) {
                    // Ad ve soyadı birleştir
                    if (userData.data.name && userData.data.surname) {
                        surucuAdi = `${userData.data.name} ${userData.data.surname}`;
                    } else if (userData.data.isim && userData.data.soyisim) {
                        surucuAdi = `${userData.data.isim} ${userData.data.soyisim}`;
                    } else if (userData.data.name) {
                        surucuAdi = userData.data.name;
                    } else if (userData.data.isim) {
                        surucuAdi = userData.data.isim;
                    } else if (userData.data.kullaniciadi) {
                        surucuAdi = userData.data.kullaniciadi;
                    } else {
                        surucuAdi = 'Sürücü';
                    }
                    surucuId = userData.data.id || userData.data.user_id || userId || null;
                }
            }
        } else {
            // UserSession yoksa direkt backend'den al
            const userResponse = await fetch(`${API_BASE_URL}/auth/me?id=1`);
            const userData = await userResponse.json();
            if (userData.success && userData.data) {
                // Ad ve soyadı birleştir
                if (userData.data.name && userData.data.surname) {
                    surucuAdi = `${userData.data.name} ${userData.data.surname}`;
                } else if (userData.data.isim && userData.data.soyisim) {
                    surucuAdi = `${userData.data.isim} ${userData.data.soyisim}`;
                } else if (userData.data.name) {
                    surucuAdi = userData.data.name;
                } else if (userData.data.isim) {
                    surucuAdi = userData.data.isim;
                } else if (userData.data.kullaniciadi) {
                    surucuAdi = userData.data.kullaniciadi;
                } else {
                    surucuAdi = 'Sürücü';
                }
                surucuId = userData.data.id || userData.data.user_id || 1;
            }
        }
    } catch (error) {
        console.warn('⚠️ Kullanıcı bilgisi alınamadı:', error);
        surucuId = 1; // Fallback
    }
    
    // TeslimatTakip sınıfını kullanarak teslimat başlat
    if (!window.teslimatTakip) {
        // Eğer instance yoksa oluştur
        if (typeof initTeslimatTakip === 'function') {
            initTeslimatTakip();
        } else {
            console.error('❌ initTeslimatTakip fonksiyonu bulunamadı');
            createToast('error', 'Teslimat sistemi başlatılamadı');
            return;
        }
    }
    
    if (window.teslimatTakip) {
        window.teslimatTakip.aracId = aracId;
        window.teslimatTakip.surucuId = surucuId;
        
        // GPS izni kontrolü
        if (!navigator.geolocation) {
            createToast('error', 'GPS desteklenmiyor!');
            return;
        }
        
        // GPS izni iste
        try {
            await window.teslimatTakip.teslimatBaslat();
            
            // LocalStorage'a kaydedildiğinden emin ol - anaSayfaGuncelle() içinde kaydediliyor
            // Biraz bekle ki LocalStorage'a kayıt tamamlansın
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // LocalStorage'dan kontrol et - kaydedildi mi?
            const teslimatData = localStorage.getItem('teslimatDurum');
            if (teslimatData) {
                try {
                    const veri = JSON.parse(teslimatData);
                    if (veri.durum === 'aktif' && veri.aracId) {
                    }
                } catch (e) {
                    console.error('LocalStorage kontrol hatası:', e);
                }
            }
            
            // Modal içeriğini güncelle - teslimat başlatıldı, "teslimatı tamamla" popup'ı göster
            // NOT: Modal otomatik açılmıyor, kullanıcı istediğinde açabilir
            // openAracTakipModal() fonksiyonu LocalStorage'dan kontrol edip doğru içeriği gösterecek
            
            // Modal'ı kapat (kullanıcı istediğinde tekrar açabilir)
            closeAracTakipModal();
            
            // Butonu yeşil yap
            const mobileAracTakipBtn = document.getElementById('mobileAracTakipBtn');
            if (mobileAracTakipBtn) {
                mobileAracTakipBtn.classList.add('active');
            }
            
            // SAYFA YENİLEMEDEN ARAÇ LİSTESİNİ GÜNCELLE - HEMEN!
            if (typeof loadVehicleList === 'function') {
                // İlk güncelleme hemen
                loadVehicleList();

                
                // Backend'de durum güncellensin diye 2 saniye sonra tekrar güncelle
                setTimeout(() => {
                    loadVehicleList();

                }, 2000);
            }
            
            // Toast mesajı kaldırıldı - kullanıcı istemedi
        } catch (error) {
            console.error('❌ Teslimat başlatma hatası:', error);
            createToast('error', 'Teslimat başlatılamadı: ' + (error.message || 'Bilinmeyen hata'));
            // GPS timeout veya hata durumunda popup'ı kapat
            if (typeof closeAracTakipModal === 'function') {
                closeAracTakipModal();
            } else if (typeof window.closeAracTakipModal === 'function') {
                window.closeAracTakipModal();
            }
        }
    } else {
        console.error('❌ TeslimatTakip instance bulunamadı');
        createToast('error', 'Teslimat sistemi başlatılamadı');
    }
}

// Teslimat tamamla butonuna tıklanınca
async function teslimatTamamla() {
    if (window.teslimatTakip) {
        // teslimatTakip.teslimatTamamla() içinde zaten createToastInteractive var
        // Bu fonksiyon toast gösterir ve kullanıcı "Evet" dediğinde onConfirm callback'i çağrılır
        // await etme, çünkü createToastInteractive Promise döndürmüyor - sadece toast gösterir
        window.teslimatTakip.teslimatTamamla();
        
        // İşlemler teslimatTakip.teslimatTamamla() içindeki onConfirm callback'inde yapılıyor
        // Burada hiçbir şey yapmaya gerek yok - toast onaylandığında işlemler otomatik yapılacak
    }
}

// Global fonksiyonlar
window.openAracTakipModal = openAracTakipModal;
window.closeAracTakipModal = closeAracTakipModal;
window.teslimataCiktimBaslat = teslimataCiktimBaslat;
window.teslimatTamamla = teslimatTamamla;

//#endregion Araç Takip Sistemi

// === INIT: DOMContentLoaded kontrolü ===
// Bu dosya dinamik yüklendiğinde DOMContentLoaded zaten geçmiş olabilir
function _aracTakipInit() {
    // Sayfa kontrolü: sadece index sayfasında çalış
    const currentPath = window.location.pathname;
    const pageName = (currentPath.split('/').pop() || '').replace(/\.html$/, '');
    const isIndexPage = pageName === 'index' || pageName === '' || currentPath === '/' || currentPath.endsWith('/');
    const isMusteriCariPage = pageName === 'musteriler-cari' || currentPath.includes('musteriler-cari');

    if (isIndexPage && !isMusteriCariPage) {
        // Mobil teslimat takip sistemini başlat
        if (typeof initTeslimatTakip === 'function') initTeslimatTakip();
        // Web araç listesini başlat
        if (typeof initVehicleList === 'function') initVehicleList();
        if (typeof updateActiveVehicleCount === 'function') updateActiveVehicleCount();
    }
    // ESC tuşu ile modal kapat (tüm sayfalarda geçerli)
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            if (typeof closeDetailModal === 'function') closeDetailModal();
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _aracTakipInit);
} else {
    _aracTakipInit();
}
