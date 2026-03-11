// #region Çiçeksepeti Toast + Modal Integration
/** Sipariş kartı / detay popup ile aynı format: +90 (5XX) XXX XX XX */
function formatPhoneForDisplay(phone) {
    if (!phone) return '';
    var digits = String(phone).replace(/\D/g, '');
    if (digits.startsWith('90')) digits = digits.substring(2);
    if (digits.length === 0) return '';
    if (digits.length === 11 && digits.startsWith('0')) digits = digits.substring(1);
    if (digits.length > 10) digits = digits.substring(0, 10);
    if (digits.length === 0) return '';
    if (digits.length >= 10) return '+90 (' + digits.substring(0, 3) + ') ' + digits.substring(3, 6) + ' ' + digits.substring(6, 8) + ' ' + digits.substring(8, 10);
    var formatted = '+90 (' + digits.substring(0, Math.min(3, digits.length));
    if (digits.length >= 3) {
        formatted += ') ' + digits.substring(3, Math.min(6, digits.length));
        if (digits.length >= 6) {
            formatted += ' ' + digits.substring(6, Math.min(8, digits.length));
            if (digits.length >= 8) formatted += ' ' + digits.substring(8, Math.min(10, digits.length));
        }
    }
    return formatted;
}

class CiceksepetiFloovonIntegration {
    constructor() {
        this.pendingOrders = []; // Onay bekleyen siparişler
        this.currentModalOrder = null; // Modal'da görüntülenen sipariş
        this.audioContext = null; // Audio context'i önceden oluştur
        this.audioUnlocked = false; // PWA/mobil: ilk dokunuşta ses kilidi açılsın
        this.reminderTimer = null; // Hatırlatma zamanlayıcısı
        this.testOrderInterval = null; // Test sipariş interval referansı
        this.testOrderTimeout = null; // Test sipariş timeout referansı
        this.init();
    }
    
    init() {
        // Audio context'i ilk kullanıcı etkileşiminde hazırla
        this.initAudioContext();
        // PWA/mobil: ilk dokunuşta ses çalınabilsin diye kilidi aç (bir kez)
        var self = this;
        function onceUnlock() {
            if (!self.audioUnlocked) {
                self.unlockAudio();
                self.audioUnlocked = true;
            }
        }
        document.addEventListener('click', onceUnlock, { once: true });
        document.addEventListener('touchstart', onceUnlock, { once: true });
        
        // Toast container'ın var olduğundan emin ol; popup sadece index'te
        this.ensureToastContainer();
        var container = document.getElementById('ciceksepetiToastContainer');
        if (container) container.style.display = this.isIndexPage() ? 'flex' : 'none';
        
        // Buton görünürlüğünü kontrol et
        this.updateButtonVisibility();
        
        // Test bildirimi ayarını kontrol et ve başlat (sadece index'te interval başlar)
        this.startTestOrdersIfEnabled();
        
        // localStorage değişikliklerini dinle (ayarlar sayfasından güncelleme için)
        window.addEventListener('storage', (e) => {
            if (e.key === 'ciceksepeti_test_bildirimi') {
                this.updateButtonVisibility();
                this.startTestOrdersIfEnabled();
            }
        });
        
        // Aynı sekmede localStorage değişikliklerini dinle (custom event)
        window.addEventListener('ciceksepetiTestBildirimiChanged', () => {
            this.updateButtonVisibility();
            this.startTestOrdersIfEnabled();
        });
        
        window.addEventListener('ciceksepetiRouteChange', (e) => {
            var pathname = (e && e.detail && e.detail.pathname) || (window.location && window.location.pathname) || '';
            var isIndex = pathname === '' || pathname === '/' || pathname === '/index' || pathname === '/index.html';
            var container = document.getElementById('ciceksepetiToastContainer');
            if (container) container.style.display = isIndex ? 'flex' : 'none';
            this.startTestOrdersIfEnabled();
            if (isIndex && this.pendingOrders.length > 0) this.updateToast();
        });
        
        // Document-level delegation: toast’taki sipariş satırına tıklanınca modal açılsın (React/script fark etmez)
        document.addEventListener('click', function ciceksepetiToastOrderClick(e) {
            var item = e.target.closest('.ciceksepeti-toast-order-item');
            if (!item) return;
            var orderId = item.getAttribute('data-order-id');
            if (!orderId) return;
            if (!self.pendingOrders.some(function(o) { return o.siparisNo === orderId; })) return;
            e.preventDefault();
            e.stopPropagation();
            self.showOrderDetails(orderId);
        });
    }
    
    updateButtonVisibility() {
        // Buton görünürlüğünü test bildirimi ayarına göre güncelle
        const button = document.querySelector('.ciceksepeti-integration-btn');
        if (button) {
            const testBildirimiValue = localStorage.getItem('ciceksepeti_test_bildirimi');
            const testBildirimiEnabled = testBildirimiValue === 'true';
            
            if (testBildirimiEnabled) {
                button.classList.add('show');
            } else {
                button.classList.remove('show');
            }
        }
    }
    
    isIndexPage() {
        var path = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname.replace(/\/$/, '') || '/' : '';
        return path === '' || path === '/';
    }
    
    ensureToastContainer() {
        // Toast container'ın var olduğundan emin ol
        let container = document.getElementById('ciceksepetiToastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'ciceksepetiToastContainer';
            container.className = 'ciceksepeti-toast-container';
            var root = document.getElementById('root');
            (root || document.body).appendChild(container);
        }
    }
    
    startTestOrdersIfEnabled() {
        // Önce mevcut interval ve timeout'ları temizle
        if (this.testOrderInterval) {
            clearInterval(this.testOrderInterval);
            this.testOrderInterval = null;
        }
        if (this.testOrderTimeout) {
            clearTimeout(this.testOrderTimeout);
            this.testOrderTimeout = null;
        }
        
        // Test bildirimi ayarını kontrol et; popup sadece index (anasayfa) sayfasında gösterilir
        const testBildirimiValue = localStorage.getItem('ciceksepeti_test_bildirimi');
        const testBildirimiEnabled = testBildirimiValue === 'true';
        if (!testBildirimiEnabled) {
            // Kapalıysa test siparişlerini listeden çıkar ve toast'ı anında güncelle (index’e dönünce boş görünsün)
            this.pendingOrders = this.pendingOrders.filter(function(o) { return !o.isTest; });
            this.updateToast(true);
            return;
        }
        if (!this.isIndexPage()) return;
        
        {
            // Toast container'ın var olduğundan emin ol
            this.ensureToastContainer();
            
            // İlk test siparişi (1.5 saniye sonra)
            this.testOrderTimeout = setTimeout(() => {
                this.simulateNewOrder();
            }, 1500);
            
            // Periyodik sipariş simülasyonu (15 saniyede bir, %60 ihtimalle)
            this.testOrderInterval = setInterval(() => {
                if (Math.random() < 0.6) {
                    this.simulateNewOrder();
                }
            }, 15000);
        }
    }
    
    initAudioContext() {
        // Sayfa ilk tıklandığında audio context'i hazırla
        document.addEventListener('click', () => {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
        }, { once: true });
        document.addEventListener('touchstart', () => {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
        }, { once: true });
    }

    /** PWA/mobil: Tarayıcı ilk kullanıcı etkileşiminden sonra ses çalsın diye kilidi açar */
    unlockAudio() {
        try {
            var a = new Audio("/assets/sounds/sound-12.mp3");
            a.volume = 0;
            a.play().then(function() { a.pause(); }).catch(function() {});
        } catch (e) {}
    }

    /** Telefon bildirim çubuğunda bildirim gösterir (izin verilmişse). PWA/uygulama açık veya arka plandayken çalışır. */
    showSystemNotification(title, body) {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
        try {
            var icon = (window.BACKEND_BASE_URL || window.location.origin || '') + '/favicon.ico';
            var n = new Notification(title, { body: body || '', icon: icon });
            n.onclick = function() {
                n.close();
                window.focus();
            };
            setTimeout(function() { n.close(); }, 8000);
        } catch (e) {}
    }

    /** Bildirim izni ister; ayarlar sayfasından veya ilk siparişte çağrılabilir. */
    requestNotificationPermission(callback) {
        if (typeof Notification === 'undefined') {
            if (callback) callback('unsupported');
            return Promise.resolve('unsupported');
        }
        if (Notification.permission === 'granted') {
            if (callback) callback('granted');
            return Promise.resolve('granted');
        }
        if (Notification.permission === 'denied') {
            if (callback) callback('denied');
            return Promise.resolve('denied');
        }
        return Notification.requestPermission().then(function(p) {
            if (callback) callback(p);
            return p;
        });
    }
    
    // playNotificationSound() {
    //     try {
    //         if (this.audioContext && this.audioContext.state === 'running') {
    //             this.playWebAudioBeep();
    //         } else if (this.audioContext && this.audioContext.state === 'suspended') {
    //             // Suspended durumundaysa resume et
    //             this.audioContext.resume().then(() => {
    //                 this.playWebAudioBeep();
    //             });
    //         } else {
    //             // Audio context yoksa oluştur ve çal
    //             this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    //             this.playWebAudioBeep();
    //         }
    //     } catch (error) {
    //         console.log('Ses çalınamadı:', error);
    //         // Ses çalamazsa güçlü vibrasyon
    //         if (navigator.vibrate) {
    //             navigator.vibrate([300, 150, 300, 150, 300, 150, 300]);
    //         }
    //         // Alternatif görsel uyarı
    //         this.showVisualAlert();
    //     }
    // }

    playNotificationSound() {
    try {
        const audio = new Audio("/assets/sounds/sound-12.mp3"); // sipariş gelince sesli uyarı (tenant-app public)
        audio.volume = 0.9; // ses seviyesi
        audio.play().catch(err => {
            // console.warn("Bildirim sesi oynatılamadı:", err);
        });
    } catch (error) {
        // console.log("Ses çalınamadı:", error);
        if (navigator.vibrate) {
            navigator.vibrate([300, 150, 300]);
        }
    }
}

    
    playWebAudioBeep() {
        if (!this.audioContext) return;
        
        // Daha sert ve uyarıcı ses profili
        const beepSequence = [
            { freq: 1200, duration: 0.15, volume: 0.3 },
            { freq: 900, duration: 0.15, volume: 0.25 },
            { freq: 1400, duration: 0.2, volume: 0.35 },
            { freq: 1000, duration: 0.25, volume: 0.3 }
        ];
        
        beepSequence.forEach((beep, index) => {
            setTimeout(() => {
                try {
                    const oscillator = this.audioContext.createOscillator();
                    const gainNode = this.audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(this.audioContext.destination);
                    
                    oscillator.frequency.setValueAtTime(beep.freq, this.audioContext.currentTime);
                    oscillator.type = 'square'; // Daha sert ses için square wave
                    
                    // Daha yüksek başlangıç volume
                    gainNode.gain.setValueAtTime(beep.volume, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + beep.duration);
                    
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + beep.duration);
                } catch (err) {
                    // console.log('Oscillator hatası:', err);
                }
            }, index * 200); // Daha hızlı ardışık sesler
        });
    }
    
    // Manuel sipariş kontrolü için fonksiyon
    openModal() {
        // Önce mevcut toast'ı kapat
        this.closeToast();
        
        // Loading durumu göster
        this.showCheckingToast();
        
        // 2-3 saniye sonra sonucu göster
        setTimeout(() => {
            if (this.pendingOrders.length > 0) {
                // Mevcut bekleyen siparişleri göster
                this.updateToast();
                // console.log('Bekleyen siparişler gösterildi');
            } else {
                // Yeni sipariş kontrolü yap
                this.checkForNewOrders();
            }
        }, 2500);
    }
    
    showCheckingToast() {
        const container = document.getElementById('ciceksepetiToastContainer');
        if (!container) return;
        
        // Mevcut toast'ı kaldır
        const existingToast = container.querySelector('.ciceksepeti-toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        const checkingToast = document.createElement('div');
        checkingToast.className = 'ciceksepeti-toast ciceksepeti-checking-toast';
        
        checkingToast.innerHTML = `
            <div class="ciceksepeti-toast-header">
                <img src="assets/cicek-sepeti/cicek-sepeti.svg" alt="Çiçeksepeti" class="ciceksepeti-toast-logo">
                <button class="ciceksepeti-toast-close"><i class="icon-btn-kapat"></i></button>
            </div>
            <div class="ciceksepeti-checking-content">
                <div class="ciceksepeti-checking-spinner"></div>
                <div class="ciceksepeti-checking-text">
                    <div class="checking-title">Siparişler kontrol ediliyor...</div>
                    <div class="checking-subtitle">Çiçeksepeti üzerinden yeni gelen siparişler araştırılıyor</div>
                </div>
            </div>
        `;
        
        container.appendChild(checkingToast);
        
        // Event listener ekle
        const closeBtn = checkingToast.querySelector('.ciceksepeti-toast-close');
        closeBtn.addEventListener('click', () => {
            checkingToast.remove();
        });
        
        // Animasyon
        setTimeout(() => {
            checkingToast.classList.add('show');
        }, 100);
    }
    
    checkForNewOrders() {
        // %60 ihtimal ile yeni sipariş oluştur, %40 ihtimal ile boş sonuç
        if (Math.random() < 0.6) {
            // 1-2 yeni sipariş oluştur
            const orderCount = Math.random() < 0.7 ? 1 : 2;
            
            for (let i = 0; i < orderCount; i++) {
                setTimeout(() => {
                    this.simulateNewOrder();
                }, i * 500);
            }
            
            // console.log(`${orderCount} yeni sipariş bulundu ve eklendi`);
        } else {
            // Boş sonuç göster
            this.showNoOrdersFound();
        }
    }
    
    showNoOrdersFound() {
        const container = document.getElementById('ciceksepetiToastContainer');
        if (!container) return;
        
        // Checking toast'ı kaldır
        const checkingToast = container.querySelector('.ciceksepeti-checking-toast');
        if (checkingToast) {
            checkingToast.remove();
        }
        
        const noOrdersToast = document.createElement('div');
        noOrdersToast.className = 'ciceksepeti-toast ciceksepeti-no-orders-toast';
        
        noOrdersToast.innerHTML = `
            <div class="ciceksepeti-toast-header">
                <img src="assets/cicek-sepeti/cicek-sepeti.svg" alt="Çiçeksepeti" class="ciceksepeti-toast-logo">
                <button class="ciceksepeti-toast-close"><i class="icon-btn-kapat"></i></button>
            </div>
            <div class="ciceksepeti-no-orders-content">
                <div class="no-orders-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="no-orders-text">
                    <div class="no-orders-title">Yeni sipariş bulunamadı</div>
                    <div class="no-orders-subtitle">Çiçeksepeti üzerinden henüz yeni gelen sipariş yok</div>
                </div>
            </div>
        `;
        
        container.appendChild(noOrdersToast);
        
        // Event listener ekle
        const closeBtn = noOrdersToast.querySelector('.ciceksepeti-toast-close');
        closeBtn.addEventListener('click', () => {
            noOrdersToast.remove();
        });
        
        // Animasyon
        setTimeout(() => {
            noOrdersToast.classList.add('show');
        }, 100);
        
        // 5 saniye sonra otomatik kapat
        setTimeout(() => {
            if (noOrdersToast.parentNode) {
                noOrdersToast.classList.add('hide');
                setTimeout(() => {
                    noOrdersToast.remove();
                }, 400);
            }
        }, 45000);
    }
    
    getRandomLocation() {
        const locations = [
            { il: 'İstanbul', ilce: 'Kadıköy', mahalle: 'Moda' },
            { il: 'İstanbul', ilce: 'Beşiktaş', mahalle: 'Ortaköy' },
            { il: 'İstanbul', ilce: 'Şişli', mahalle: 'Nişantaşı' },
            { il: 'İstanbul', ilce: 'Beyoğlu', mahalle: 'Galata' },
            { il: 'İstanbul', ilce: 'Üsküdar', mahalle: 'Çengelköy' },
            { il: 'Ankara', ilce: 'Çankaya', mahalle: 'Kızılay' },
            { il: 'Ankara', ilce: 'Keçiören', mahalle: 'Etlik' },
            { il: 'İzmir', ilce: 'Konak', mahalle: 'Alsancak' },
            { il: 'İzmir', ilce: 'Karşıyaka', mahalle: 'Bostanlı' },
            { il: 'Bursa', ilce: 'Osmangazi', mahalle: 'Çekirge' }
        ];
        return locations[Math.floor(Math.random() * locations.length)];
    }
    
    simulateNewOrder(forceShow) {
        if (!forceShow && !this.isIndexPage()) return;
        const location = this.getRandomLocation();
        const mockOrder = {
            isTest: true,
            siparisNo: 'CS-' + Date.now(),
            siparisVeren: this.getRandomCustomer(),
            siparisVerenTelefon: '0532 ' + Math.floor(Math.random() * 9000000 + 1000000),
            teslimKisi: this.getRandomRecipient(),
            teslimKisiTelefon: '0555 ' + Math.floor(Math.random() * 9000000 + 1000000),
            teslimAdresi: `${location.mahalle} Mah., ${location.ilce}, ${location.il}`,
            receiverCity: location.il,        // Çiçek Sepeti API parametresi
            receiverDistrict: location.ilce, // Çiçek Sepeti API parametresi
            receiverRegion: location.mahalle, // Çiçek Sepeti API parametresi
            teslimIl: location.il,            // Fallback
            teslimIlce: location.ilce,        // Fallback
            teslimMahalle: location.mahalle,   // Fallback
            urunAdi: this.getRandomProduct(),
            urunYazisi: this.getRandomMessage(),
            fiyat: Math.floor(Math.random() * 300 + 100),
            // Buraya istediğin tarihi koyabilirsin - test için bugünden 1-3 gün sonra
            teslimTarihi: this.getFutureDate(1, 3), 
            teslimSaati: this.getRandomTime(),
            kaynak: 'Çiçeksepeti',
            timestamp: Date.now()
        };
        
        this.addToPendingOrders(mockOrder);
        
        this.updateToast(forceShow);
        
        // Ses bildirimi kontrolü (PWA/mobil: ilk dokunuştan sonra çalar)
        var sesBildirimiEnabled = localStorage.getItem('ciceksepeti_ses_bildirimi') !== 'false';
        if (sesBildirimiEnabled) {
            this.playNotificationSound();
        }
        // Telefon bildirim çubuğunda göster (izin verilmişse)
        var firstOrder = this.pendingOrders[0];
        var notifTitle = 'Yeni Çiçek Sepeti siparişi';
        var notifBody = firstOrder ? ('Sipariş no: ' + (firstOrder.siparisNo || '')) : 'Yeni sipariş geldi.';
        this.showSystemNotification(notifTitle, notifBody);
    }
    
    addToPendingOrders(order) {
        this.pendingOrders.push(order);
    }
    
    updateToast(forceShow) {
        if (!forceShow && !this.isIndexPage()) return;
        let container = document.getElementById('ciceksepetiToastContainer');
        if (!container) {
            this.ensureToastContainer();
            container = document.getElementById('ciceksepetiToastContainer');
            if (!container) return;
        }
        
        // Mevcut toast'ı kaldır
        const existingToast = container.querySelector('.ciceksepeti-toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        if (this.pendingOrders.length === 0) return;
        
        const toast = this.createToast();
        container.appendChild(toast);
        
        // Animasyon için timeout
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
    }
    
    createToast() {
        const toast = document.createElement('div');
        toast.className = 'ciceksepeti-toast';
        
        const orderItems = this.pendingOrders.map(order => `
            <div class="ciceksepeti-toast-order-item" data-order-id="${order.siparisNo}">
                <div class="ciceksepeti-order-content">
                    <div class="ciceksepeti-order-title">Yeni sipariş geldi!</div>
                    <div class="ciceksepeti-order-info">
                        <div class="info-line">
                            <span class="info-label">Teslim Zamanı:</span>
                            <span class="info-value">${this.formatShortDate(order.teslimTarihi)}, Saat ${order.teslimSaati}</span>
                        </div>
                        <div class="info-line">
                            <span class="info-label">Sipariş Ürün:</span>
                            <span class="info-value">${order.urunAdi}</span>
                        </div>
                    </div>
                </div>
                <div class="ciceksepeti-status-indicator"></div>
            </div>
        `).join('');
        
        toast.innerHTML = `
            <div class="ciceksepeti-toast-header">
                <img src="assets/cicek-sepeti/cicek-sepeti.svg" alt="Çiçeksepeti" class="ciceksepeti-toast-logo">
                <button class="ciceksepeti-toast-close"><i class="icon-btn-kapat"></i></button>
            </div>
            <div class="ciceksepeti-toast-title">Çiçeksepeti üzerinden gelen siparişler:</div>
            <div class="ciceksepeti-toast-subtitle">Siparişleri onaylamak veya reddetmek için sipariş detayını görüntüleyin</div>
            <div class="ciceksepeti-toast-orders">
                ${orderItems}
            </div>
        `;
        
        // Event listener'ları ekle
        const closeBtn = toast.querySelector('.ciceksepeti-toast-close');
        closeBtn.addEventListener('click', () => this.closeToast());
        
        const orderItemElements = toast.querySelectorAll('.ciceksepeti-toast-order-item');
        orderItemElements.forEach(item => {
            item.addEventListener('click', (e) => {
                const orderId = e.currentTarget.getAttribute('data-order-id');
                this.showOrderDetails(orderId);
            });
        });
        
        return toast;
    }
    
    showOrderDetails(siparisNo) {
        const order = this.pendingOrders.find(o => o.siparisNo === siparisNo);
        if (!order) return;
        
        this.currentModalOrder = order;
        const modal = document.getElementById('ciceksepetiModal');
        if (!modal) {
            console.warn('ciceksepetiModal bulunamadı');
            return;
        }
        
        // Yeni HTML yapısına göre verileri doldur (element yoksa atla)
        const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text || '-'; };
        const setSrc = (id, src) => { const el = document.getElementById(id); if (el) el.src = src || ''; };
        setText('modal-siparis-no', order.siparisNo);
        setText('modal-teslim-tarih', this.formatLongDate(order.teslimTarihi) + ', Saat ' + (order.teslimSaati || ''));
        setSrc('modal-urun-image', '/assets/cicek-sepeti/sp-urun-ciceksepeti.png');
        setText('modal-urun-name', order.urunAdi);
        setText('modal-urun-price', (order.fiyat != null ? order.fiyat : '') + ' TL');
        setText('modal-siparis-veren', order.siparisVeren);
        setText('modal-siparis-veren-tel', order.siparisVerenTelefon ? (typeof window.formatPhoneNumber === 'function' ? window.formatPhoneNumber(order.siparisVerenTelefon) : formatPhoneForDisplay(order.siparisVerenTelefon)) : '-');
        setText('modal-teslim-il', order.receiverCity || order.teslimIl || 'Belirtilmemiş');
        setText('modal-teslim-ilce', order.receiverDistrict || order.teslimIlce || 'Belirtilmemiş');
        setText('modal-teslim-mahalle', order.receiverRegion || order.teslimMahalle || 'Belirtilmemiş');
        setText('modal-teslim-kisi', order.teslimKisi || 'Belirtilmemiş');
        setText('modal-teslim-kisi-tel', order.teslimKisiTelefon ? (typeof window.formatPhoneNumber === 'function' ? window.formatPhoneNumber(order.teslimKisiTelefon) : formatPhoneForDisplay(order.teslimKisiTelefon)) : 'Belirtilmemiş');
        setText('modal-teslim-adres', order.teslimAdresi || 'Belirtilmemiş');
        setText('modal-siparis-notu', order.urunYazisi);
        
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.classList.add('show');
            // Modal açıldıktan sonra butonlara event listener ekle
            this.setupModalEventListeners();
        }, 100);
    }
    
    setupModalEventListeners() {
        const modal = document.getElementById('ciceksepetiModal');
        if (!modal) return;
        
        // Önceki event listener'ları temizle
        const onaylaBtn = modal.querySelector('#ciceksepetiOnayla');
        const reddetBtn = modal.querySelector('#ciceksepetiReddet');
        const closeBtn = modal.querySelector('#ciceksepetiModalKapat');
        
        if (onaylaBtn) {
            // Önceki listener'ı kaldır
            onaylaBtn.removeEventListener('click', this.handleApproveClick);
            // Yeni listener ekle
            this.handleApproveClick = () => {
                this.approveCiceksepetiOrder();
            };
            onaylaBtn.addEventListener('click', this.handleApproveClick);
        }
        
        if (reddetBtn) {
            // Önceki listener'ı kaldır
            reddetBtn.removeEventListener('click', this.handleRejectClick);
            // Yeni listener ekle
            this.handleRejectClick = () => {
                this.rejectCiceksepetiOrder();
            };
            reddetBtn.addEventListener('click', this.handleRejectClick);
        }
        
        if (closeBtn) {
            // Önceki listener'ı kaldır
            closeBtn.removeEventListener('click', this.handleCloseClick);
            // Yeni listener ekle
            this.handleCloseClick = () => {
                this.closeCiceksepetiModal();
            };
            closeBtn.addEventListener('click', this.handleCloseClick);
        }
        
        // Modal overlay'e tıklanınca kapat
        const overlay = modal.querySelector('.modal-overlay');
        if (overlay) {
            overlay.replaceWith(overlay.cloneNode(true));
            modal.querySelector('.modal-overlay').addEventListener('click', () => {
                this.closeCiceksepetiModal();
            });
        }
    }
    
    async approveCiceksepetiOrder() {
        if (!this.currentModalOrder) return;
        if (this._approveInProgress) return;
        this._approveInProgress = true;
        try {
            // Önce siparişi test-order ile kaydet
            const orderData = {
                siparis_no: this.currentModalOrder.siparisNo,
                siparis_veren: this.currentModalOrder.siparisVeren,
                siparis_veren_telefon: this.currentModalOrder.siparisVerenTelefon,
                teslim_kisi: this.currentModalOrder.teslimKisi,
                teslim_kisi_telefon: this.currentModalOrder.teslimKisiTelefon,
                teslim_adresi: this.currentModalOrder.teslimAdresi,
                receiverCity: this.currentModalOrder.receiverCity,        // Çiçek Sepeti API parametresi
                receiverDistrict: this.currentModalOrder.receiverDistrict, // Çiçek Sepeti API parametresi
                receiverRegion: this.currentModalOrder.receiverRegion,     // Çiçek Sepeti API parametresi
                teslim_il: this.currentModalOrder.teslimIl,               // Fallback
                teslim_ilce: this.currentModalOrder.teslimIlce,           // Fallback
                teslim_mahalle: this.currentModalOrder.teslimMahalle,      // Fallback
                urun_adi: this.currentModalOrder.urunAdi,
                urun_yazisi: this.currentModalOrder.urunYazisi,
                fiyat: this.currentModalOrder.fiyat,
                teslim_tarihi: this.currentModalOrder.teslimTarihi,
                teslim_saati: this.currentModalOrder.teslimSaati
            };
            
            // 1. Adım: Siparişi ciceksepeti_orders tablosuna kaydet
            const apiBase = (typeof window.getFloovonApiBase === 'function') ? window.getFloovonApiBase() : (window.API_BASE_URL || (window.location.origin ? window.location.origin + '/api' : '/api'));
            const testResponse = await fetch(`${apiBase}/ciceksepeti/test-order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(orderData)
            });
            
            if (!testResponse.ok) {
                console.error('❌ Test sipariş kaydedilemedi:', testResponse.status);
                this.showApprovalErrorMessage();
                return;
            }
            
            // 2. Adım: Siparişi organizasyon_kartlar tablosuna kaydet
            const acceptResponse = await fetch(`${apiBase}/ciceksepeti/accept-order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ siparis_no: this.currentModalOrder.siparisNo })
            });
            
            if (acceptResponse.ok) {
                const result = await acceptResponse.json();
                console.log('✅ Çiçek Sepeti siparişi hem ciceksepeti_orders hem de organizasyon_kartlar tablosuna kaydedildi:', result);
                
                // Başarı mesajı göster
                this.showApprovalSuccessMessage();
                
                // Pending listesinden kaldır
                this.pendingOrders = this.pendingOrders.filter(
                    order => order.siparisNo !== this.currentModalOrder.siparisNo
                );
                
                // Modal'ı kapat
                this.closeCiceksepetiModal();
                
                // Toast'ı güncelle (eğer başka bekleyen sipariş varsa)
                this.updateToast();
                
                // Eğer tüm siparişler onaylandıysa hatırlatma zamanlayıcısını durdur
                if (this.pendingOrders.length === 0) {
                    this.stopReminderTimer();
                }
                
                // Kartları yeniden yükle (sayfa yenileme yerine) - organizasyon ID ile odaklan
                setTimeout(async () => {
                    // Backend response yapısına göre organizasyon_id'yi al (her iki formatı da kontrol et)
                    let organizasyonId = null;
                    if (result.data && result.data.organizasyon_id) {
                        organizasyonId = result.data.organizasyon_id;
                    } else if (result.organizasyon_id) {
                        organizasyonId = result.organizasyon_id;
                    }
                    
                    console.log('📍 Focus edilecek organizasyon ID:', organizasyonId);
                    console.log('📍 Backend response:', result);
                    
                    if (organizasyonId && typeof window.loadDynamicCards === 'function') {
                        await window.loadDynamicCards(organizasyonId);
                    } else if (typeof window.loadDynamicCards === 'function') {
                        // Fallback: organizasyon ID yoksa normal yükle
                        console.warn('⚠️ Organizasyon ID bulunamadı, kartlar normal yüklenecek');
                        await window.loadDynamicCards();
                    }
                }, 500);
                
            } else {
                console.error('❌ Organizasyon kartı oluşturulamadı:', acceptResponse.status);
                this.showApprovalErrorMessage();
            }
            
        } catch (error) {
            console.error('❌ Sipariş onaylama hatası:', error);
            this.showApprovalErrorMessage();
        } finally {
            this._approveInProgress = false;
        }
    }
    
    rejectCiceksepetiOrder() {
        if (!this.currentModalOrder) return;
        var self = this;
        if (typeof window.createToastInteractive === 'function') {
            window.createToastInteractive({
                message: 'Bu siparişi reddetmek istediğinize emin misiniz?',
                confirmText: 'Evet',
                cancelText: 'Hayır',
                onConfirm: function() { self.confirmRejectOrder(); },
                onCancel: function() {}
            });
        } else {
            if (window.confirm('Bu siparişi reddetmek istediğinize emin misiniz?')) {
                this.confirmRejectOrder();
            }
        }
    }
    
    confirmRejectOrder() {
        if (!this.currentModalOrder) return;
        
        // Pending listesinden kaldır
        this.pendingOrders = this.pendingOrders.filter(
            order => order.siparisNo !== this.currentModalOrder.siparisNo
        );
        
        // Ana modal'ı kapat
        this.closeCiceksepetiModal();
        
        // Toast'ı güncelle (eğer başka bekleyen sipariş varsa)
        this.updateToast();
        
        // Eğer tüm siparişler işlendiyse hatırlatma zamanlayıcısını durdur
        if (this.pendingOrders.length === 0) {
            this.stopReminderTimer();
        }
        
        // Başarı mesajı: uygulamanın toast sistemi
        if (typeof window.createToast === 'function') {
            window.createToast('info', 'Sipariş reddedildi. Kabul edilmedi.');
        }
    }
    
    cancelRejectOrder() {
        // createToastInteractive kullanıldığında iptal zaten toast tarafından kapatılır
    }
    
    showRejectSuccessMessage() {
        if (typeof window.createToast === 'function') {
            window.createToast('info', 'Sipariş reddedildi. Kabul edilmedi.');
        }
    }
    
    showApprovalSuccessMessage() {
        if (typeof window.createToast === 'function') {
            window.createToast('success', 'Sipariş başarıyla onaylandı.');
        }
    }
    
    showApprovalErrorMessage() {
        if (typeof window.createToast === 'function') {
            window.createToast('error', 'Sipariş onaylanırken hata oluştu. Lütfen tekrar deneyin.');
        }
    }
    
    addToCiceksepetiCard(order) {
        const itemsContainer = document.getElementById('itemsContainer');
        if (!itemsContainer) return;
        
        const orderDate = this.formatLongDate(order.teslimTarihi);
        let ciceksepetiKart = this.findOrCreateCiceksepetiCard(orderDate);
        
        if (ciceksepetiKart) {
            this.addOrderToExistingCard(ciceksepetiKart, order);
            
            // Sayaçları güncelle
            this.updateCardCounters(ciceksepetiKart);
        }
        
        // Boş mesajı gizle
        const emptyMessage = document.querySelector('.empty-message');
        if (emptyMessage) {
            emptyMessage.style.display = 'none';
        }
    }
    
    findOrCreateCiceksepetiCard(targetDate) {
        const itemsContainer = document.getElementById('itemsContainer');
        const items = itemsContainer.querySelectorAll('.item');
        
        // Mevcut çiçeksepeti kartlarını kontrol et
        for (let item of items) {
            const kartTur = item.querySelector('.kart-tur');
            const tarihElem = item.querySelector('.teslim-zaman .tarih');
            
            if (kartTur && tarihElem) {
                const kartTurText = kartTur.textContent.trim() || kartTur.alt || '';
                const kartTarihi = tarihElem.textContent.trim();
                
                if ((kartTurText === 'Çiçek Sepeti' || kartTur.querySelector('img[alt="Çiçek Sepeti"]')) && 
                    kartTarihi === targetDate) {
                    return item.querySelector('.ana-kart');
                }
            }
        }
        
        // Yoksa yeni kart oluştur
        return this.createCiceksepetiCard(targetDate);
    }
    
    createCiceksepetiCard(targetDate) {
        const itemsContainer = document.getElementById('itemsContainer');
        const kartId = `ciceksepeti-kart-${Date.now()}`;
        
        const kartHTML = `
            <div class="item ciceksepeti-yeni-kart" style="transform: scale(0.8); opacity: 0;">
                <div class="ana-kart ciceksepeti-kart" id="${kartId}">
                    <div class="kart-header">
                        <div class="kart-header-sol">
                            <div class="kart-tur">
                                <span class="kart-tur-text" style="display: none;">Çiçek Sepeti</span>
                                <img src="assets/cicek-sepeti/cicek-sepeti.svg" alt="Çiçek Sepeti">
                            </div>
                        </div>
                        <div class="kart-header-sag">
                            <div class="sirala-menu">
                                <button class="siparis-kart-filtrele-buton" data-tooltip="Siparişleri Sırala">
                                    <i class="fas fa-sort-amount-down"></i>
                                </button>
                                <div class="filtre-menu-content">
                                    <div class="liste-baslik">Siparişleri Sırala</div>
                                    <hr>
                                    <button class="sirala-kart-alfabetik"><i class="fas fa-sort-alpha-down"></i>Alfabetik</button>
                                </div>
                            </div>
                            <div class="kart-menu">
                                <button class="kart-menu-buton" data-tooltip="Kart Ayarları">
                                    <i class="icon-hamburger-menu"></i>
                                </button>
                                <div class="kart-menu-content">
                                    <div class="liste-baslik">Kart Ayarları</div>
                                    <hr>
                                    <a href="#" class="kart-siparis-kunyesi-yazdir"><i class="icon-kart-menu-kunye-yazdir"></i>Sipariş künyesi yazdır</a>
                                    <a href="#" class="buton wp-listesi-paylas" data-plan-feature="whatsapp">
                                        <i class="icon-kart-menu-whatsapp-listesi"></i>
                                        Whatsapp listesi paylaş
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="kart-header-alt-satir alt-satir-ciceksepeti">
                        <div class="alt-satir-sol">
                            <a href="./siparis-kart-detay.html" data-tooltip="Sipariş Detayları">
                                <div class="toplam-siparisler">
                                    <i class="icon-toplam-siparis"></i>0/0
                                </div>
                            </a>
                        </div>
                        <div class="kart-aciklama">
                            Çiçeksepeti siparişleri için sipariş kartları üzerindeki
                            <span>teslim saatini dikkate alınız</span>
                        </div>
                    </div>
                    <div class="teslim-zaman">
                        <div class="tarih">${targetDate}</div>
                    </div>
                    <div class="sk-kart-alan ciceksepeti-siparis-alani">
                        <!-- Siparişler buraya eklenecek -->
                    </div>
                </div>
            </div>
        `;
        
        itemsContainer.insertAdjacentHTML('afterbegin', kartHTML);
        
        // Yeni kart için event listener'ları ekle
        const yeniKartElement = document.getElementById(kartId);
        if (yeniKartElement) this.attachCardEventListeners(yeniKartElement);
        
        // Animasyon
        setTimeout(() => {
            const yeniKart = itemsContainer.querySelector('.ciceksepeti-yeni-kart');
            if (yeniKart) {
                yeniKart.style.transition = 'all 0.5s ease';
                yeniKart.style.transform = 'scale(1)';
                yeniKart.style.opacity = '1';
                
                setTimeout(() => {
                    yeniKart.classList.remove('ciceksepeti-yeni-kart');
                }, 500);
            }
        }, 100);
        
        return document.getElementById(kartId);
    }
    
    attachCardEventListeners(kartElement) {
        // Sıralama menüsü toggle
        const filtreleButon = kartElement.querySelector('.siparis-kart-filtrele-buton');
        const filtreleMenu = kartElement.querySelector('.filtre-menu-content');
        
        if (filtreleButon && filtreleMenu) {
            filtreleButon.addEventListener('click', (e) => {
                e.stopPropagation();
                // Diğer açık menüleri kapat
                document.querySelectorAll('.filtre-menu-content').forEach(menu => {
                    if (menu !== filtreleMenu) {
                        menu.style.display = 'none';
                    }
                });
                // Bu menüyü toggle yap
                filtreleMenu.style.display = filtreleMenu.style.display === 'block' ? 'none' : 'block';
            });
        }
        
        // Alfabetik sıralama
        const alfabetikButon = kartElement.querySelector('.sirala-kart-alfabetik');
        if (alfabetikButon) {
            alfabetikButon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.sortCardAlphabetically(kartElement);
                filtreleMenu.style.display = 'none';
            });
        }
        
        // Kart menüsü toggle
        const kartMenuButon = kartElement.querySelector('.kart-menu-buton');
        const kartMenu = kartElement.querySelector('.kart-menu-content');
        
        if (kartMenuButon && kartMenu) {
            kartMenuButon.addEventListener('click', (e) => {
                e.stopPropagation();
                // Diğer açık menüleri kapat
                document.querySelectorAll('.kart-menu-content').forEach(menu => {
                    if (menu !== kartMenu) {
                        menu.style.display = 'none';
                    }
                });
                // Bu menüyü toggle yap
                kartMenu.style.display = kartMenu.style.display === 'block' ? 'none' : 'block';
            });
        }
        
        // Yazdırma butonu event listener
        const yazdirButon = kartElement.querySelector('.kart-siparis-kunyesi-yazdir');
        if (yazdirButon) {
            yazdirButon.addEventListener('click', (e) => {
                e.preventDefault();
                // console.log('Çiçeksepeti yazdırma butonu tıklandı');
                if (typeof yazdirSiparisKunyeToplu === 'function') {
                    yazdirSiparisKunyeToplu(kartElement);
                } else {
                    // console.error('yazdirSiparisKunyeToplu fonksiyonu bulunamadı');
                }
            });
        }
        
        // Tümünü teslim edildi işaretle
        const tumunuTeslimButon = kartElement.querySelector('.tum-kartlari-teslim-edildi-olarak-isaretle');
        if (tumunuTeslimButon) {
            tumunuTeslimButon.addEventListener('click', (e) => {
                e.preventDefault();
                this.markAllAsDelivered(kartElement);
                kartMenu.style.display = 'none';
            });
        }
    }
    
    sortCardAlphabetically(kartElement) {
        const siparisAlani = kartElement.querySelector('.ciceksepeti-siparis-alani');
        const gruplar = Array.from(siparisAlani.querySelectorAll('.konum-grup'));
        
        // Her grup içindeki siparişleri alfabetik sırala
        gruplar.forEach(grup => {
            const siparisler = Array.from(grup.querySelectorAll('.siparis-kart'));
            siparisler.sort((a, b) => {
                const nameA = a.querySelector('.teslim-kisisi')?.textContent.trim() || '';
                const nameB = b.querySelector('.teslim-kisisi')?.textContent.trim() || '';
                return nameA.localeCompare(nameB, 'tr');
            });
            
            // Sıralanmış siparişleri yeniden ekle
            siparisler.forEach(siparis => grup.appendChild(siparis));
        });
        
        // console.log('Çiçeksepeti kartı alfabetik sıralandı');
    }
    
    markAllAsDelivered(kartElement) {
        const siparisler = kartElement.querySelectorAll('.siparis-kart');
        siparisler.forEach(siparis => {
            // Teslim edildi butonunu trigger et (mevcut sisteminizle uyumlu olması için)
            const teslimButon = siparis.querySelector('[data-tooltip="Teslim Edildi İşaretle"]');
            if (teslimButon && typeof teslimEdildiButonu === 'function') {
                teslimEdildiButonu(teslimButon);
            }
        });
        // console.log('Çiçeksepeti kartındaki tüm siparişler teslim edildi olarak işaretlendi');
    }
    
    async archiveCard(kartElement) {
        console.log('🗄️ archiveCard çağrıldı!', kartElement);
        // Kartın tarihini al
        const item = kartElement.closest('.item');
        if (!item) {
            console.error('❌ Çiçek Sepeti kartı bulunamadı');
            return;
        }
        console.log('✅ Item bulundu:', item);
        
        // Önce item'da data-organizasyon-id var mı kontrol et
        let organizasyonId = item.getAttribute('data-organizasyon-id');
        
        // Yoksa tarih ile bul
        if (!organizasyonId) {
            const tarihElem = item.querySelector('.teslim-zaman .tarih');
            if (!tarihElem) {
                console.error('❌ Kart tarihi bulunamadı');
                return;
            }
            
            const kartTarihi = tarihElem.textContent.trim();
            const tarihParse = this.parseLongDate(kartTarihi);
            if (!tarihParse) {
                console.error('❌ Tarih parse edilemedi:', kartTarihi);
                return;
            }
            
            try {
                // Backend'den bu tarihe ait Çiçek Sepeti organizasyon kartını bul
                const apiBase = (typeof window.getFloovonApiBase === 'function') ? window.getFloovonApiBase() : (window.API_BASE_URL || (window.location.origin ? window.location.origin + '/api' : '/api'));
                const url = `${apiBase}/organizasyon-kartlar/by-date?tarih=${encodeURIComponent(tarihParse)}&kart_tur=${encodeURIComponent('Çiçek Sepeti')}`;
                console.log('🔍 Organizasyon kartı aranıyor:', url);
                
                const response = await (window.floovonFetch || window.floovonFetchStandard || fetch)(url, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                console.log('📡 Organizasyon kartı arama response:', response.status, response.ok);
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('📦 Organizasyon kartı arama sonucu:', result);
                    if (result.success && result.data && result.data.length > 0) {
                        organizasyonId = result.data[0].id;
                        console.log('✅ Çiçek Sepeti organizasyon kartı bulundu:', organizasyonId);
                    } else {
                        console.warn('⚠️ Organizasyon kartı bulunamadı (boş sonuç)');
                    }
                } else {
                    const errorText = await response.text().catch(() => '');
                    console.error('❌ Organizasyon kartı arama hatası:', response.status, errorText);
                }
            } catch (error) {
                console.error('❌ Organizasyon kartı arama hatası:', error);
                console.error('❌ Hata detayı:', error.stack);
            }
        }
        
        if (!organizasyonId) {
            console.error('❌ Organizasyon kartı ID bulunamadı');
            // Fallback: Sadece DOM'dan sil
            if (confirm('Organizasyon kartı bulunamadı. Sadece görünümden kaldırılsın mı?')) {
                item.style.transition = 'all 0.5s ease';
                item.style.opacity = '0';
                item.style.transform = 'scale(0.8)';
                setTimeout(() => item.remove(), 500);
            }
            return;
        }
        
        // Arşiv sebep popup'ı göster
        if (typeof showArsivSebepPopup === 'function') {
            showArsivSebepPopup(async (sebep) => {
                await this.archiveOrganizasyonKart(organizasyonId, sebep, item);
            }, 'organizasyon');
        } else {
            // showArsivSebepPopup yoksa direkt arşivle
            if (confirm('Bu çiçeksepeti kartını arşivlemek istediğinize emin misiniz?')) {
                await this.archiveOrganizasyonKart(organizasyonId, null, item);
            }
        }
    }
    
    async archiveOrganizasyonKart(organizasyonId, sebep, itemElement) {
        try {
            const sebepTurkce = (typeof getSebepText === 'function' && sebep) ? getSebepText(sebep) : sebep;
            
            // API base URL'i al
            const apiBase = (typeof window.getFloovonApiBase === 'function') ? window.getFloovonApiBase() : (window.API_BASE_URL || (window.location.origin ? window.location.origin + '/api' : '/api'));
            
            console.log('🔄 Çiçek Sepeti kartı arşivleniyor:', { organizasyonId, sebepTurkce, apiBase });
            
            const response = await (window.floovonFetch || window.floovonFetchStandard || fetch)(`${apiBase}/organizasyon-kartlar/${organizasyonId}/archive`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ arsivleme_sebebi: sebepTurkce || 'Çiçek Sepeti kartı arşivlendi' })
            });
            
            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Bilinmeyen hata');
                console.error('❌ Arşivleme response hatası:', response.status, errorText);
                if (typeof createToast === 'function') {
                    createToast('error', `Kart arşivlenemedi (${response.status})`);
                }
                return;
            }
            
            const result = await response.json();
            console.log('📦 Arşivleme sonucu:', result);
            
            if (result && result.success) {
                if (typeof createToast === 'function') {
                    createToast('success', result.message || 'Çiçek Sepeti kartı başarıyla arşivlendi');
                }
                
                // DOM'dan kaldır
                if (itemElement) {
                    itemElement.style.transition = 'all 0.5s ease';
                    itemElement.style.opacity = '0';
                    itemElement.style.transform = 'scale(0.8)';
                    setTimeout(() => itemElement.remove(), 500);
                }
            } else {
                console.error('❌ Arşivleme başarısız:', result);
                if (typeof createToast === 'function') {
                    createToast('error', result?.message || result?.error || 'Kart arşivlenemedi');
                }
            }
        } catch (error) {
            console.error('❌ Arşivleme hatası:', error);
            if (typeof createToast === 'function') {
                createToast('error', 'Kart arşivlenirken bir hata oluştu: ' + error.message);
            }
        }
    }
    
    // Tarih parse fonksiyonu: "21 Ocak 2026 Salı" -> "2026-01-21"
    parseLongDate(longDate) {
        const aylar = {
            'Ocak': '01', 'Şubat': '02', 'Mart': '03', 'Nisan': '04',
            'Mayıs': '05', 'Haziran': '06', 'Temmuz': '07', 'Ağustos': '08',
            'Eylül': '09', 'Ekim': '10', 'Kasım': '11', 'Aralık': '12'
        };
        
        // Format: "21 Ocak 2026 Salı"
        const parts = longDate.split(' ');
        if (parts.length < 3) return null;
        
        const gun = parts[0].padStart(2, '0');
        const ay = aylar[parts[1]];
        const yil = parts[2];
        
        if (!ay) return null;
        
        return `${yil}-${ay}-${gun}`;
    }
    
    addOrderToExistingCard(kartElement, order) {
        const siparisAlani = kartElement.querySelector('.ciceksepeti-siparis-alani, .sk-kart-alan');
        if (!siparisAlani) return;
        
        // Mahalle grubunu bul veya oluştur
        const mahalle = this.getMahalleFromAddress(order.teslimAdresi);
        let mahalleGrup = this.findOrCreateMahalleGroup(siparisAlani, mahalle);
        
        const yeniSiparis = this.createOrderCard(order);
        mahalleGrup.insertAdjacentHTML('beforeend', yeniSiparis);
        
        // Yeni eklenen siparişe animasyon
        setTimeout(() => {
            const yeniSiparisElem = mahalleGrup.querySelector('.ciceksepeti-yeni-siparis');
            if (yeniSiparisElem) {
                yeniSiparisElem.style.transition = 'all 0.5s ease';
                yeniSiparisElem.style.transform = 'scale(1)';
                yeniSiparisElem.style.opacity = '1';
                
                setTimeout(() => {
                    yeniSiparisElem.classList.remove('ciceksepeti-yeni-siparis');
                }, 500);
            }
        }, 100);
        
        // Mahalle sayacını güncelle
        this.updateMahalleCounter(mahalleGrup);
    }
    
    findOrCreateMahalleGroup(siparisAlani, mahalle) {
        // Mevcut mahalle grubunu ara
        const mevcutGruplar = siparisAlani.querySelectorAll('.konum-grup');
        for (let grup of mevcutGruplar) {
            const grupMahalle = grup.querySelector('.grup-mahalle');
            if (grupMahalle && grupMahalle.textContent.trim().toUpperCase() === mahalle.toUpperCase()) {
                return grup;
            }
        }
        
        // Yoksa yeni mahalle grubu oluştur
        const yeniGrup = document.createElement('div');
        yeniGrup.className = 'konum-grup';
        yeniGrup.innerHTML = `
            <div class="grup-mahalle-baslik">
                <div class="title-wrapper">
                    <i class="uil uil-angle-down akordiyon-icon"></i>
                    <div class="grup-mahalle">${mahalle.toUpperCase()}</div>
                </div>
                <div class="grup-mahalle-sp-sayisi">0</div>
            </div>
        `;
        
        siparisAlani.appendChild(yeniGrup);
        return yeniGrup;
    }
    
    updateMahalleCounter(mahalleGrup) {
        const kartlar = mahalleGrup.querySelectorAll('.siparis-kart');
        const sayiAlani = mahalleGrup.querySelector('.grup-mahalle-sp-sayisi');
        if (sayiAlani) {
            sayiAlani.textContent = kartlar.length;
        }
    }
    
    updateCardCounters(kartElement) {
        // console.log('Sayaçlar güncelleniyor...', kartElement);
        
        // Toplam sipariş sayacını güncelle
        const siparisKartlar = kartElement.querySelectorAll('.siparis-kart');
        const toplamElem = kartElement.querySelector('.toplam-siparisler');
        
        if (toplamElem) {
            // Mevcut SiparisSayacYoneticisi sistemini kullan
            if (typeof SiparisSayacYoneticisi !== 'undefined' && SiparisSayacYoneticisi.ilkYukleme) {
                try {
                    SiparisSayacYoneticisi.ilkYukleme(kartElement);
                    // console.log('SiparisSayacYoneticisi ile güncellendi');
                } catch (error) {
                    // console.log('SiparisSayacYoneticisi hatası:', error);
                    // Fallback
                    toplamElem.innerHTML = `<i class="icon-toplam-siparis"></i>0/${siparisKartlar.length}`;
                }
            } else {
                // Fallback: Manuel sayaç güncelleme
                toplamElem.innerHTML = `<i class="icon-toplam-siparis"></i>0/${siparisKartlar.length}`;
                // console.log('Manuel sayaç güncellendi:', siparisKartlar.length);
            }
        }
        
        // Kısa beklemeden sonra diğer sistemleri tetikle (DOM güncellensin diye)
        setTimeout(() => {
            // Mahalle sayaçlarını güncelle
            if (typeof setupGrupMahalleSiparisSayaci === 'function') {
                try {
                    setupGrupMahalleSiparisSayaci();
                    // console.log('Mahalle sayaçları güncellendi');
                } catch (error) {
                    // console.log('Mahalle sayaçları hatası:', error);
                }
            }
            
            // Kart filtre sayaçlarını güncelle
            if (typeof updateKartFiltreSayaclari === 'function') {
                try {
                    updateKartFiltreSayaclari();
                    // console.log('Kart filtre sayaçları güncellendi');
                } catch (error) {
                    // console.log('Kart filtre sayaçları hatası:', error);
                }
            }
            
            // initToplamSiparisSayaclari ile entegrasyon
            if (typeof initToplamSiparisSayaclari === 'function') {
                try {
                    initToplamSiparisSayaclari();
                    // console.log('initToplamSiparisSayaclari çalıştırıldı');
                } catch (error) {
                    // console.log('initToplamSiparisSayaclari hatası:', error);
                }
            }
        }, 100);
        
        // console.log('Sayaç güncelleme tamamlandı');
    }
    
    createOrderCard(order) {
        return `
            <div class="siparis-kart ciceksepeti-siparis ciceksepeti-yeni-siparis" draggable="true" data-order-id="${order.siparisNo}" style="transform: scale(0.9); opacity: 0;">
                <div class="baslik">Teslim Edilecek Kişi</div>
                <div class="teslim-kisisi">
                    ${order.teslimKisi}
                    <i class="icon-siparis-tasi"></i>
                </div>
                <div class="teslim-kisisi-telefon">
                    <i class="icon-telefon"></i>
                    <span><a href="tel:${order.teslimKisiTelefon}"${(() => {
                        const phone = order.teslimKisiTelefon || '';
                        if (!phone) return '';
                        const phoneDigits = phone.replace(/\D/g, '');
                        let normalized = '';
                        if (phoneDigits.length === 12 && phoneDigits.startsWith('90')) {
                            normalized = phoneDigits;
                        } else if (phoneDigits.length >= 10) {
                            normalized = phoneDigits.length === 10 ? '90' + phoneDigits : (phoneDigits.length === 11 && phoneDigits.startsWith('0') ? '90' + phoneDigits.substring(1) : '90' + phoneDigits.substring(phoneDigits.length - 10));
                        }
                        return normalized ? ` data-telefon="${normalized}"` : '';
                    })()}>${typeof window.formatPhoneNumber === 'function' ? window.formatPhoneNumber(order.teslimKisiTelefon) : order.teslimKisiTelefon}</a></span>
                </div>
                <div class="teslimat-konum">
                    <div class="mahalle mahalle-sirala">${this.getMahalleFromAddress(order.teslimAdresi)}</div>
                    <div class="acik-adres">${order.teslimAdresi}</div>
                </div>
                <div class="teslim-saat">
                    <div class="saat-icerik">
                        <span>Saat</span>
                        <div class="saat-veri">${order.teslimSaati}</div>
                    </div>
                </div>
                <div class="baslik">Sipariş Veren</div>
                <div class="siparis-veren">${order.siparisVeren}</div>
                <div class="siparis-veren-telefon">
                    <i class="icon-telefon"></i>
                    <span><a href="tel:${order.siparisVerenTelefon}"${(() => {
                        const phone = order.siparisVerenTelefon || '';
                        if (!phone) return '';
                        const phoneDigits = phone.replace(/\D/g, '');
                        let normalized = '';
                        if (phoneDigits.length === 12 && phoneDigits.startsWith('90')) {
                            normalized = phoneDigits;
                        } else if (phoneDigits.length >= 10) {
                            normalized = phoneDigits.length === 10 ? '90' + phoneDigits : (phoneDigits.length === 11 && phoneDigits.startsWith('0') ? '90' + phoneDigits.substring(1) : '90' + phoneDigits.substring(phoneDigits.length - 10));
                        }
                        return normalized ? ` data-telefon="${normalized}"` : '';
                    })()}>${typeof window.formatPhoneNumber === 'function' ? window.formatPhoneNumber(order.siparisVerenTelefon) : order.siparisVerenTelefon}</a></span>
                </div>
                <div class="orta-alan">
                    <div class="urun-yazisi-wrapper">
    <div class="urun-yazisi copy-text" ondblclick="copyText()" data-tooltip="${order.urunYazisi}">
        <i class="icon-urun-yazisi"></i>
        ${order.urunYazisi}
    </div>
</div>
                </div>
                <div class="siparis-urun-bilgileri">
                    <div class="urun-bilgisi">
                        <div class="urun-gorsel">
                            <img src="${this.getProductImage(order.urunAdi)}" alt="${order.urunAdi}">
                        </div>
                        <div class="siparis-urun">${order.urunAdi}</div>
                    </div>
                    <div class="fiyat-bilgisi">
                        <div class="siparis-tutari">${order.fiyat},00 TL</div>
                        <div class="odeme-yontemi">Çiçeksepeti</div>
                    </div>
                </div>
                <div class="alt-kart-alan">
                    <div class="duzenleyen">
                        <i class="fa-solid fa-gear"></i>
                        <div class="duzenleme-tarih"><span>${new Date().toLocaleDateString('tr-TR')}, ${new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute: '2-digit'})}</span></div>
                    </div>
                    <div class="kart-butonlar">
                        <div class="siparis-kart-icon" data-siparis-arsivle data-tooltip="Siparişi Arşivle">
                            <i class="icon-kart-menu-arsivle"></i>
                        </div>
                        <div class="siparis-kart-icon" data-tooltip="Teslim Edildi İşaretle" onclick="teslimEdildiButonu(this)">
                            <i class="icon-ks-tamamlandi"></i>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    closeToast() {
        const container = document.getElementById('ciceksepetiToastContainer');
        const toast = container?.querySelector('.ciceksepeti-toast');
        if (toast) {
            toast.classList.add('hide');
            setTimeout(() => {
                toast.remove();
            }, 400);
        }
        
        // Eğer henüz bekleyen siparişler varsa hatırlatma zamanlayıcısı başlat
        if (this.pendingOrders.length > 0) {
            this.startReminderTimer();
        }
    }
    
    startReminderTimer() {
        // Önceki zamanlayıcıyı temizle
        if (this.reminderTimer) {
            clearTimeout(this.reminderTimer);
        }
        
        // 3 dakika sonra yeniden göster (180000 ms)
        this.reminderTimer = setTimeout(() => {
            if (this.pendingOrders.length > 0) {
                // console.log('Hatırlatma: Onaylanmayan siparişler var, toast yeniden gösteriliyor...');
                this.updateToast();
                this.playReminderSound();
            }
        }, 180000); // 3 dakika
    }
    
    stopReminderTimer() {
        if (this.reminderTimer) {
            clearTimeout(this.reminderTimer);
            this.reminderTimer = null;
        }
    }
    
playReminderSound() {
    try {
        const audio = new Audio("/assets/sounds/sound-1.mp3"); // hatırlatma sesi (tenant-app public)
        audio.volume = 0.8; // sesi ayarla
        audio.play().catch(err => {
            // console.warn("Hatırlatma sesi oynatılamadı:", err);
        });
    } catch (error) {
        // console.log("Hatırlatma sesi çalınamadı:", error);
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }
    }
}

    
    closeCiceksepetiModal() {
        const modal = document.getElementById('ciceksepetiModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.style.display = 'none';
                this.currentModalOrder = null;
            }, 300);
        }
    }
    
    
    playWebAudioBeep() {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Daha sert ve uyarıcı ses profili
        const beepSequence = [
            { freq: 1200, duration: 0.15, volume: 0.3 },
            { freq: 900, duration: 0.15, volume: 0.25 },
            { freq: 1400, duration: 0.2, volume: 0.35 },
            { freq: 1000, duration: 0.25, volume: 0.3 }
        ];
        
        beepSequence.forEach((beep, index) => {
            setTimeout(() => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(beep.freq, audioContext.currentTime);
                oscillator.type = 'square'; // Daha sert ses için square wave
                
                // Daha yüksek başlangıç volume
                gainNode.gain.setValueAtTime(beep.volume, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + beep.duration);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + beep.duration);
            }, index * 200); // Daha hızlı ardışık sesler
        });
    }
    
    getProductImage(urunAdi) {
        const backendBase = (typeof window.getFloovonBackendBase === 'function') ? window.getFloovonBackendBase() : (window.BACKEND_BASE_URL || (window.location.origin || ''));
        // getFloovonUploadUrl otomatik olarak eski path'leri tenant-based yapıya çevirir
        const productImages = {
            'Gül Buketi': window.getFloovonUploadUrl ? window.getFloovonUploadUrl('/uploads/tenants/' + (window.userManager?.getUser()?.tenant_id || window.userSession?.getTenantId() || '1') + '/products/sp-urun-cicek-buket.png') : `${backendBase}/uploads/tenants/${window.userManager?.getUser()?.tenant_id || window.userSession?.getTenantId() || '1'}/products/sp-urun-cicek-buket.png`,
            'Lilyum Buketi': window.getFloovonUploadUrl ? window.getFloovonUploadUrl('/uploads/tenants/' + (window.userManager?.getUser()?.tenant_id || window.userSession?.getTenantId() || '1') + '/products/sp-urun-cicek-buket.png') : `${backendBase}/uploads/tenants/${window.userManager?.getUser()?.tenant_id || window.userSession?.getTenantId() || '1'}/products/sp-urun-cicek-buket.png`,
            'Karışık Buket': window.getFloovonUploadUrl ? window.getFloovonUploadUrl('/uploads/tenants/' + (window.userManager?.getUser()?.tenant_id || window.userSession?.getTenantId() || '1') + '/products/sp-urun-cicek-buket.png') : `${backendBase}/uploads/tenants/${window.userManager?.getUser()?.tenant_id || window.userSession?.getTenantId() || '1'}/products/sp-urun-cicek-buket.png`,
            'Orkide': window.getFloovonUploadUrl ? window.getFloovonUploadUrl('/uploads/tenants/' + (window.userManager?.getUser()?.tenant_id || window.userSession?.getTenantId() || '1') + '/products/sp-urun-saksi-orkide-tekli.png') : `${backendBase}/uploads/tenants/${window.userManager?.getUser()?.tenant_id || window.userSession?.getTenantId() || '1'}/products/sp-urun-saksi-orkide-tekli.png`,
            'Çelenk': window.getFloovonUploadUrl ? window.getFloovonUploadUrl('/uploads/tenants/' + (window.userManager?.getUser()?.tenant_id || window.userSession?.getTenantId() || '1') + '/products/sp-urun-celenk-standart.png') : `${backendBase}/uploads/tenants/${window.userManager?.getUser()?.tenant_id || window.userSession?.getTenantId() || '1'}/products/sp-urun-celenk-standart.png`,
            'Çikolata Buketi': window.getFloovonUploadUrl ? window.getFloovonUploadUrl('/uploads/tenants/' + (window.userManager?.getUser()?.tenant_id || window.userSession?.getTenantId() || '1') + '/products/sp-urun-cikolata-buketi.png') : `${backendBase}/uploads/tenants/${window.userManager?.getUser()?.tenant_id || window.userSession?.getTenantId() || '1'}/products/sp-urun-cikolata-buketi.png`
        };
        return productImages[urunAdi] || (window.getFloovonUploadUrl ? window.getFloovonUploadUrl('/uploads/tenants/' + (window.userManager?.getUser()?.tenant_id || window.userSession?.getTenantId() || '1') + '/products/sp-urun-cicek-buket.png') : `${backendBase}/uploads/tenants/${window.userManager?.getUser()?.tenant_id || window.userSession?.getTenantId() || '1'}/products/sp-urun-cicek-buket.png`);
    }
    
    // Tarih formatlama fonksiyonları - week picker ile uyumlu
    getFutureDate(minDays = 1, maxDays = 7) {
        // Week picker kontrolü
        const weekPicker = document.querySelector('#weekPicker');
        if (weekPicker && weekPicker.value) {
            return this.getDateFromWeekPicker(weekPicker.value);
        }
        
        // Fallback: Bu haftanın tarihlerini kullan
        return this.getCurrentWeekRandomDate();
    }
    
    // Bu haftanın rastgele bir gününü döndür
    getCurrentWeekRandomDate() {
        const today = new Date();
        const currentDay = today.getDay(); // 0=Pazar, 1=Pazartesi, ..., 6=Cumartesi
        
        // Bu haftanın Pazartesi gününü bul
        const monday = new Date(today);
        monday.setDate(today.getDate() - currentDay + 1);
        
        // Bu haftanın rastgele bir günü seç (Pazartesi-Cumartesi arası)
        const randomDay = Math.floor(Math.random() * 6); // 0-5 arası
        const targetDate = new Date(monday);
        targetDate.setDate(monday.getDate() + randomDay);
        
        return targetDate.toISOString().split('T')[0];
    }
    
    getDateFromWeekPicker(weekValue) {
        // Week picker formatı: "2025-W35" gibi
        const [year, weekNum] = weekValue.split('-W').map(Number);
        
        // Haftanın rastgele bir günü seç (Pazartesi=1, Pazar=7)
        const randomDay = Math.floor(Math.random() * 7) + 1;
        
        // ISO hafta numarasından tarih hesaplama (doğru yöntem)
        const jan4 = new Date(year, 0, 4); // ISO hafta standardı için 4 Ocak referans
        const jan4Day = jan4.getDay() || 7; // Pazartesi = 1, Pazar = 7
        const firstMonday = new Date(jan4);
        firstMonday.setDate(jan4.getDate() - jan4Day + 1);
        
        // İstenen haftanın Pazartesi gününü hesapla
        const targetMonday = new Date(firstMonday);
        targetMonday.setDate(firstMonday.getDate() + (weekNum - 1) * 7);
        
        // Rastgele günü ekle (0-6 gün sonra)
        const targetDate = new Date(targetMonday);
        targetDate.setDate(targetMonday.getDate() + randomDay - 1);
        
        return targetDate.toISOString().split('T')[0];
    }
    
    formatShortDate(dateString) {
        // Buraya istediğin formatı koyabilirsin: "01-09-2025" formatı için
        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    }
    
    formatLongDate(dateString) {
        // Mevcut uzun format fonksiyonun - düzenleyebilirsin
        const date = new Date(dateString);
        const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
        const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
        
        const day = date.getDate().toString().padStart(2, '0'); // Sıfır eklendi
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        const dayName = days[date.getDay()];
        
        return `${day} ${month} ${year} ${dayName}`;
    }
    
    getMahalleFromAddress(address) {
        return address.split(',')[0].trim();
    }
    
    getRandomTime() {
        const hours = Math.floor(Math.random() * 12) + 8;
        const minutes = ['00', '15', '30', '45'][Math.floor(Math.random() * 4)];
        return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }
    
    getRandomFullAddress() {
        const mahalleler = ['Meydan Mah.', 'Cumhuriyet Mah.', 'İzzetbey Mah.', 'Yenidoğan Mah.', 'Baraj Mah.'];
        const sokaklar = ['Atatürk Cad. No: 15/A', 'Mevlana Sk. Kadir Apt. Kat 3 Daire 5', 'İnönü Cad. Çiçek Apt. No: 8', 'Fatih Sk. No: 22/B', 'Cumhuriyet Cad. Mehmet Apt. Kat 1 Daire 2'];
        
        const mahalle = mahalleler[Math.floor(Math.random() * mahalleler.length)];
        const sokak = sokaklar[Math.floor(Math.random() * sokaklar.length)];
        
        return `${mahalle}, ${sokak} ÇUMRA`;
    }
    
    getRandomCustomer() {
        const customers = ['Ayşe Yılmaz', 'Mehmet Demir', 'Fatma Kaya', 'Ali Özkan', 'Zeynep Arslan', 'Ahmet Çelik'];
        return customers[Math.floor(Math.random() * customers.length)];
    }
    
    getRandomRecipient() {
        const recipients = ['Emine Şahin', 'Hatice Koç', 'Mustafa Kara', 'Seda Özdemir', 'Okan Yıldız', 'Berk Aydın'];
        return recipients[Math.floor(Math.random() * recipients.length)];
    }
    
    getRandomProduct() {
        const products = ['Gül Buketi', 'Lilyum Buketi', 'Karışık Buket', 'Orkide', 'Çelenk', 'Çikolata Buketi'];
        return products[Math.floor(Math.random() * products.length)];
    }
    
    getRandomMessage() {
        const messages = [
            'Doğum günün kutlu olsun canım! Daha nice mutlu senelere, sağlıklı ve huzurlu günlere...',
            'İyi ki varsın hayatımda. Sen benim için çok değerlisin, her zaman yanındayım.',
            'Mutlu yıllar dilerim sevgili arkadaşım. Bu özel günde seni düşünüyor ve en güzel dileklerimi gönderiyorum.',
            'Seni çok seviyorum anneciğim. Bu güzel çiçekler senin için, nice mutlu günlere.',
            'En içten dileklerimle... Bu özel günde mutluluğun ve huzurun daim olsun.',
            'Canım dostum, nice mutlu senelere! Hayatın hep güzel olaylarla dolu olsun.'
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }
}

// Global fonksiyonlar
function closeCiceksepetiModal() {
    if (window.ciceksepetiIntegration) {
        window.ciceksepetiIntegration.closeCiceksepetiModal();
    }
}

function approveCiceksepetiOrder() {
    if (window.ciceksepetiIntegration) {
        window.ciceksepetiIntegration.approveCiceksepetiOrder();
    }
}

function rejectCiceksepetiOrder() {
    if (window.ciceksepetiIntegration) {
        window.ciceksepetiIntegration.rejectCiceksepetiOrder();
    }
}

// Global event listener'ları ekle
document.addEventListener('click', (e) => {
    // Menülerin dışına tıklanınca kapat
    if (!e.target.closest('.sirala-menu') && !e.target.closest('.kart-menu')) {
        document.querySelectorAll('.filtre-menu-content, .kart-menu-content').forEach(menu => {
            menu.style.display = 'none';
        });
    }
    
    // Çiçeksepeti modal butonları için global event delegation (closest: buton içindeki tıklamalar da sayılır)
    if (e.target.closest && e.target.closest('#ciceksepetiOnayla')) {
        e.preventDefault();
        if (window.ciceksepetiIntegration) {
            window.ciceksepetiIntegration.approveCiceksepetiOrder();
        }
        return;
    }
    if (e.target.closest && e.target.closest('#ciceksepetiReddet')) {
        e.preventDefault();
        if (window.ciceksepetiIntegration) {
            window.ciceksepetiIntegration.rejectCiceksepetiOrder();
        }
        return;
    }
    if (e.target.closest && e.target.closest('#ciceksepetiModalKapat')) {
        e.preventDefault();
        if (window.ciceksepetiIntegration) {
            window.ciceksepetiIntegration.closeCiceksepetiModal();
        }
        return;
    }
});

// Sayfa yüklenince başlat (yedek - script.js'de zaten oluşturuluyor)
document.addEventListener('DOMContentLoaded', () => {
    // Eğer script.js'de oluşturulmamışsa burada oluştur
    if (!window.ciceksepetiIntegration) {
        window.ciceksepetiIntegration = new CiceksepetiFloovonIntegration();
    }
});
/* #endregion */