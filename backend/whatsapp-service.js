/**
 * WhatsApp Mesaj Servisi - TEMİZ VE BASİT VERSİYON
 * 
 * Bu servis WhatsApp Web.js kütüphanesi ile mesaj gönderme işlemlerini yönetir.
 * Basit, anlaşılır ve güvenilir bir yapı hedeflenmiştir.
 */

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');

let _db = null;
/** Restart sonrası client yokken status'ta tekrar tekrar disconnect yazmamak için (tenant_id bazlı) */
let _disconnectWrittenFromDbTenantIds = new Set();

function setDatabase(db) {
    _db = db;
    if (db) console.log('✅ WhatsApp servisi DB bağlandı (whatsapp_baglantilar_logs)');
}

/** Türkiye saati (UTC+3) "YYYY-MM-DD HH:mm:ss" */
function getTurkeyTimeString() {
    const now = new Date();
    return new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
}

function insertWhatsAppConnectionLog(tenantId, eventType, opts) {
    const db = _db || (typeof global !== 'undefined' && global.db) || null;
    if (!db) {
        console.warn('⚠️ whatsapp_baglantilar_logs: DB yok, log yazılamadı');
        return Promise.resolve();
    }
    const { phone_number, user_name, session_owner_user, disconnect_reason, connection_at, disconnect_at } = opts || {};
    const turkeyNow = getTurkeyTimeString();
    const connAt = connection_at != null ? connection_at : (eventType === 'connected' ? turkeyNow : null);
    const discAt = disconnect_at != null ? disconnect_at : (eventType === 'disconnected' ? turkeyNow : null);
    const createdBy = session_owner_user || null;
    return new Promise((resolve) => {
        db.run(
            'INSERT INTO whatsapp_baglantilar_logs (tenant_id, event_type, whatsapp_phone_number, whatsapp_user_name, session_owner_user, disconnect_reason, connection_at, disconnect_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [tenantId, eventType, phone_number || null, user_name || null, session_owner_user || null, disconnect_reason || null, connAt, discAt, createdBy],
            (err) => {
                if (err) console.error('❌ whatsapp_baglantilar_logs INSERT hatası:', err.message, err);
                else {
                    console.log('✅ whatsapp_baglantilar_logs yazıldı:', eventType, 'tenant_id=', tenantId);
                    if (eventType === 'connected') _disconnectWrittenFromDbTenantIds.delete(tenantId);
                }
                resolve();
            }
        );
    });
}

/** State machine: uninitialized | initializing | qr | ready | disconnected | auth_failure */
const STATUS = {
    UNINITIALIZED: 'uninitialized',
    INITIALIZING: 'initializing',
    QR: 'qr',
    READY: 'ready',
    DISCONNECTED: 'disconnected',
    AUTH_FAILURE: 'auth_failure'
};

class WhatsAppService {
    constructor() {
        this.client = null;
        this.isReady = false;
        this.isAuthenticated = false;
        this.qrCode = null;
        this.browserSessionActive = false;
        this.lastDisconnectReason = null;
        this.connectedAt = null;
        this.phoneNumber = null;
        this.userName = null;
        this.currentTenantId = null;
        this.tenantId = null;
        this.sessionPath = null;
        this.initializing = false;
        this.destroying = false;
        this.lastDestroyTime = null;
        // WhatsAppClientManager state (tek lifecycle)
        this.status = STATUS.UNINITIALIZED;
        this.lastQr = null;
        this.lastScannedQrForDb = null; // Okutulan QR – sadece ready'de temizlenir, ready/authenticated ikisi de DB'ye yazabilsin
        this.firstQrStoredAt = null; // İlk QR'dan sonra 90 sn aynı QR dönsün (sürekli değişmesin)
        this.lastError = null;
        this.lastUpdate = null;
        this.connectedMeta = null; // { phone_number, username, tenant_id, connected_at }
        this.lastConnectedDbWriteAt = null; // is_connected=1 yazıldığı anda; disconnected bu süre içinde 0 yazmasın
        this.lastDisconnectDbWriteAt = null; // getStatus'ta kesinti yazıldığında; tekrar tekrar yazmayı sınırla
        this.lastLogoutAt = null; // Telefondan çıkış sonrası kısa süre auto-init yapılmasın, çıkış algılansın
        this.lastManualInitAt = null; // Manuel initialize sonrası kısa süre status'tan tekrar init tetiklenmesin (QR gelsin)
        this._readyHeartbeatTimer = null; // Bağlıyken telefondan çıkışı hemen algılamak için kısa aralıklı kontrol
        this._hasLoggedConnectedThisSession = false; // whatsapp_baglantilar_logs 'connected' bu oturumda yazıldı mı (getStatus yedek log için)
        this._hasLoggedDisconnectThisSession = false; // aynı kesinti için tek satır (event + status çakışmasın)
        this._hadConnectedSession = false; // bu oturumda en az bir connected log yazıldı mı (client null iken disconnect log yedek için)
        this.sessionOwnerUser = null; // Oturum sahibi (tenant kullanıcı adı: kimin oturumunda bu bağlantı yapıldı)
    }

    setSessionOwnerUser(username) {
        this.sessionOwnerUser = username || null;
    }

    _stopReadyHeartbeat() {
        if (this._readyHeartbeatTimer) {
            clearInterval(this._readyHeartbeatTimer);
            this._readyHeartbeatTimer = null;
        }
    }

    _startReadyHeartbeat() {
        this._stopReadyHeartbeat();
        const HEARTBEAT_MS = 500; // 0.5 sn – telefondan çıkış daha çabuk algılansın (WhatsApp sunucusu gecikmesi yine olabilir)
        const self = this;
        const GETSTATE_TIMEOUT_MS = 4000;
        this._readyHeartbeatTimer = setInterval(async () => {
            if (!self.client || !self.isReady) {
                self._stopReadyHeartbeat();
                return;
            }
            try {
                const state = await Promise.race([
                    self.client.getState(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('getState timeout')), GETSTATE_TIMEOUT_MS))
                ]);
                const disconnectedStates = ['UNPAIRED', 'DISCONNECTED', 'CONFLICT', 'CLOSED', 'UNLAUNCHED', 'UNPAIRED_IDLE'];
                if (state && disconnectedStates.includes(state)) {
                    console.log(`🔌 [Heartbeat] getState()=${state} – telefondan çıkış algılandı, log yazılıyor ve client temizleniyor`);
                    self._stopReadyHeartbeat();
                    self._onHeartbeatDetectedDisconnect(state);
                    return;
                }
                if (state === 'CONNECTED' || state === 'READY') {
                    try {
                        const info = self.client.info;
                        if (info && typeof info.then === 'function') await info;
                    } catch (infoErr) {
                        console.log(`🔌 [Heartbeat] client.info hata (oturum geçersiz):`, infoErr?.message);
                        self._stopReadyHeartbeat();
                        self._onHeartbeatDetectedDisconnect('CLOSED');
                    }
                }
            } catch (e) {
                if (self.client && self.isReady) {
                    console.log('🔌 [Heartbeat] getState() timeout veya hata – bağlantı kesilmiş sayılıyor:', e?.message);
                    self._stopReadyHeartbeat();
                    self._onHeartbeatDetectedDisconnect('CLOSED');
                } else {
                    console.log('⚠️ [Heartbeat] Kontrol hatası:', e?.message);
                }
            }
        }, HEARTBEAT_MS);
    }

    /** Heartbeat telefondan çıkış algıladığında: log yaz, client null yap, destroy et – arayüz hemen "bağlantı yok" görsün */
    _onHeartbeatDetectedDisconnect(reason) {
        if (!this.client) return;
        const savedTenantId = this.currentTenantId || this.tenantId || 1;
        if (!this._hasLoggedDisconnectThisSession) {
            this.logDisconnectEvent(reason || 'CLOSED');
        }
        this.lastLogoutAt = Date.now();
        this.isReady = false;
        this.isAuthenticated = false;
        this.phoneNumber = null;
        this.userName = null;
        this.connectedAt = null;
        this.lastConnectedDbWriteAt = null;
        this._hasLoggedConnectedThisSession = false;
        this.qrCode = null;
        this.lastQr = null;
        this.lastScannedQrForDb = null;
        this.status = STATUS.DISCONNECTED;
        this.lastUpdate = new Date();
        this.initializing = false;
        this.browserSessionActive = false;
        this.firstQrStoredAt = null;
        const clientToDestroy = this.client;
        this.client = null;
        this.destroying = true;
        setImmediate(async () => {
            try {
                if (clientToDestroy) {
                    try { await clientToDestroy.logout().catch(() => {}); } catch (e) { /* ignore */ }
                    try { await clientToDestroy.destroy(); } catch (e) { console.log('⚠️ [Heartbeat] destroy hatası:', e?.message); }
                    await new Promise(r => setTimeout(r, 1500));
                }
                if (this.sessionPath && fs.existsSync(this.sessionPath)) {
                    try {
                        fs.rmSync(this.sessionPath, { recursive: true, force: true });
                        fs.mkdirSync(this.sessionPath, { recursive: true, mode: 0o755 });
                    } catch (e) { /* ignore */ }
                }
                this.currentTenantId = savedTenantId;
                this.lastDisconnectReason = null;
            } finally {
                this.destroying = false;
            }
        });
    }

    /** Derive status from current state */
    _getStatusName() {
        if (this.status === STATUS.AUTH_FAILURE) return STATUS.AUTH_FAILURE;
        if (this.client && this.isReady && this.isAuthenticated) return STATUS.READY;
        if (this.initializing && !this.qrCode) return STATUS.INITIALIZING;
        if (this.qrCode) return STATUS.QR;
        if (!this.client && (this.lastDisconnectReason === 'LOGOUT' || this.lastDisconnectReason)) return STATUS.DISCONNECTED;
        if (!this.client) return STATUS.UNINITIALIZED;
        return this.status || STATUS.UNINITIALIZED;
    }

    /**
     * WhatsApp client'ı başlat
     * @param {number} tenantId - Bağlantıyı başlatan tenant ID
     */
    async initialize(tenantId = null) {
        // Idempotent: zaten ready ise tekrar init etme
        if (this.client && this.isReady && this.isAuthenticated) {
            console.log('⚠️ WhatsApp zaten ready, duplicate init atlandı.');
            return true;
        }
        // Telefondan çıkış sonrası destroy arka planda çalışıyorsa bitene kadar bekle (yeni client çakışmasın)
        if (this.destroying) {
            console.log('⏳ Destroy bitiyor, en fazla 8 sn bekleniyor...');
            let w = 0;
            while (this.destroying && w < 16) {
                await new Promise(r => setTimeout(r, 500));
                w++;
            }
        }
        // Başka bir çağrı zaten init yapıyorsa bekle (QR veya ready gelsin); kendi çağrımızda initializing'i aşağıda set edeceğiz
        if (this.initializing) {
            console.log('⚠️ WhatsApp servisi zaten initialize ediliyor, en fazla 12 sn bekleniyor...');
            let waitCount = 0;
            while (this.initializing && waitCount < 24) {
                await new Promise(resolve => setTimeout(resolve, 500));
                waitCount++;
                if (this.qrCode || (this.isReady && this.isAuthenticated)) break;
            }
            if (this.isReady && this.isAuthenticated) return true;
            if (this.qrCode) return true;
            console.log('⚠️ Bekleme süresi doldu veya init tamamlanamadı');
            return false;
        }
        
        this.initializing = true;
        this.status = STATUS.INITIALIZING;
        this.lastUpdate = new Date();
        this.lastError = null;
        this._hasLoggedConnectedThisSession = false;
        this._hasLoggedDisconnectThisSession = false;
        this._hadConnectedSession = false;

        // Tenant ID'yi kaydet
        if (tenantId) {
            this.currentTenantId = tenantId;
            this.tenantId = tenantId;
            
            // Tenant bazlı session path – GÜNCELLEMEDEN ETKİLENMESİN: önce kullanıcı/AppData yolu (backend dışı)
            const userDataRoot = process.env.APPDATA || process.env.USERPROFILE || process.env.HOME || '/tmp';
            const possiblePaths = [
                path.join(userDataRoot, 'Floovon', 'whatsapp_session', `tenant_${tenantId}`),
                path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', `.wwebjs_auth_floovon_tenant_${tenantId}`),
                path.join(__dirname, `.wwebjs_auth_tenant_${tenantId}`),
                path.join('/tmp', `.wwebjs_auth_floovon_tenant_${tenantId}`)
            ];
            
            // Yazma izni olan ilk yolu kullan (varsayılan: kullanıcı veri klasörü – güncelleme sonrası bağlantı kopyalanmasın)
            this.sessionPath = possiblePaths[0];
            try {
                // Session klasörünü oluşturmayı dene
                if (!fs.existsSync(this.sessionPath)) {
                    fs.mkdirSync(this.sessionPath, { recursive: true, mode: 0o755 });
                }
                // Bir kerelik taşıma: yeni yol boşsa, eski (backend içi) session varsa oradan kopyala – güncelleme sonrası tekrar bağlanma
                const oldPath = path.join(__dirname, `.wwebjs_auth_tenant_${tenantId}`);
                if (this.sessionPath === possiblePaths[0] && fs.existsSync(oldPath)) {
                    try {
                        const oldFiles = fs.readdirSync(oldPath);
                        const newFiles = fs.readdirSync(this.sessionPath).filter((f) => !f.startsWith('.write'));
                        if (oldFiles.length > 0 && newFiles.length === 0) {
                            const copyDir = (src, dest) => {
                                fs.mkdirSync(dest, { recursive: true });
                                for (const name of fs.readdirSync(src)) {
                                    const s = path.join(src, name);
                                    const d = path.join(dest, name);
                                    if (fs.statSync(s).isDirectory()) copyDir(s, d);
                                    else fs.copyFileSync(s, d);
                                }
                            };
                            copyDir(oldPath, this.sessionPath);
                            console.log(`✅ WhatsApp session eski konumdan taşındı: ${oldPath} → ${this.sessionPath}`);
                        }
                    } catch (copyErr) {
                        console.warn('⚠️ Session kopyalama atlandı:', copyErr?.message);
                    }
                }
                // Yazma izni testi
                const testFile = path.join(this.sessionPath, '.write_test');
                fs.writeFileSync(testFile, 'test');
                fs.unlinkSync(testFile);
            } catch (error) {
                // Yazma izni yoksa alternatif yolu dene
                console.log(`⚠️ Session klasörüne yazma izni yok (${this.sessionPath}), alternatif yol deneniyor...`);
                for (const altPath of possiblePaths.slice(1)) {
                    try {
                        if (!fs.existsSync(altPath)) {
                            fs.mkdirSync(altPath, { recursive: true, mode: 0o755 });
                        }
                        const testFile = path.join(altPath, '.write_test');
                        fs.writeFileSync(testFile, 'test');
                        fs.unlinkSync(testFile);
                        this.sessionPath = altPath;
                        console.log(`✅ Alternatif session yolu kullanılıyor: ${this.sessionPath}`);
                        break;
                    } catch (e) {
                        continue;
                    }
                }
            }
            
            console.log(`📁 WhatsApp session yolu (Tenant ${tenantId}): ${this.sessionPath}`);
        }
        // Zaten hazırsa tekrar başlatma
        if (this.client && this.isReady && this.isAuthenticated) {
            return true;
        }

        // Client var ve QR gösteriyorsa (henüz bağlı değil) – destroy etme, mevcut QR kalsın (popup kapatıp açınca hemen görünsün)
        if (this.client && !this.isReady && !this.isAuthenticated) {
            return true;
        }

        // LOGOUT sonrası veya client yok – temizlik ve yeni client
        if (this.lastDisconnectReason === 'LOGOUT' || (!this.client && !this.isReady && !this.isAuthenticated)) {
            if (this.lastDisconnectReason === 'LOGOUT') console.log('🔄 LOGOUT sonrası temizlik...');
            if (this.client) {
                try {
                    console.log('🗑️ Eski client destroy ediliyor...');
                    await this.client.destroy();
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    console.log('✅ Eski client destroy edildi');
                } catch (e) {
                    console.log('⚠️ Client destroy hatası:', e?.message);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            this.client = null;
            this.isReady = false;
            this.isAuthenticated = false;
            this.qrCode = null;
            this.lastQr = null;
            this.firstQrStoredAt = null;
            if (this.lastDisconnectReason === 'LOGOUT') {
                this.lastDisconnectReason = null;
            }
            // Session klasörünü temizle (LOGOUT veya client yok – yeni oturum için)
            if (this.sessionPath && fs.existsSync(this.sessionPath)) {
                try {
                    fs.rmSync(this.sessionPath, { recursive: true, force: true });
                    fs.mkdirSync(this.sessionPath, { recursive: true, mode: 0o755 });
                    console.log('✅ Session klasörü temizlendi – yeni QR için hazır');
                } catch (e) {
                    console.log('⚠️ Session temizleme hatası:', e?.message);
                }
            }
            console.log('✅ Temizlik tamamlandı - Yeni client oluşturulabilir');
        }

        console.log(`🚀 WhatsApp initialize başlatılıyor - Tenant ID: ${tenantId || this.currentTenantId || 'YOK'}`);
        console.log(`📁 Session path: ${this.sessionPath || 'YOK'}`);
        
        // LOGOUT sonrası session dosyasının tamamen temiz olduğundan emin ol
        // Eğer session path varsa ve içinde dosyalar varsa, LOGOUT sonrası temizlenmiş olmalı
        if (this.sessionPath && fs.existsSync(this.sessionPath)) {
            try {
                const sessionFiles = fs.readdirSync(this.sessionPath);
                if (sessionFiles.length > 0) {
                    console.log(`⚠️ UYARI: Session klasöründe ${sessionFiles.length} dosya var! LOGOUT sonrası temizlenmemiş olabilir.`);
                    console.log(`📄 Session dosyaları: ${sessionFiles.join(', ')}`);
                    // Eğer LOGOUT sonrası ise, session dosyalarını temizle
                    if (this.lastDisconnectReason === null || !this.isAuthenticated) {
                        console.log('🗑️ Session dosyaları temizleniyor (LOGOUT sonrası veya authenticated değil)...');
                        // EBUSY hatası için retry mekanizması (async olmadığı için try-catch ile)
                        let retryCount = 0;
                        const maxRetries = 3;
                        let sessionCleared = false;
                        while (retryCount < maxRetries && !sessionCleared) {
                            try {
                                fs.rmSync(this.sessionPath, { recursive: true, force: true });
                                sessionCleared = true;
                            } catch (e) {
                                retryCount++;
                                if (e.code === 'EBUSY' && retryCount < maxRetries) {
                                    console.log(`⚠️ Session dosyası kilitli, tekrar denenecek... (${retryCount}/${maxRetries})`);
                                    // Sync bekleme (kısa süre)
                                    const start = Date.now();
                                    while (Date.now() - start < retryCount * 500) {
                                        // Busy wait
                                    }
                                } else {
                                    // EBUSY hatası olsa bile devam et
                                    if (e.code === 'EBUSY') {
                                        console.log('⚠️ Session dosyası kilitli (chrome_debug.log), atlanıyor...');
                                    } else {
                                        console.log('⚠️ Session silme hatası:', e?.message);
                                    }
                                    break;
                                }
                            }
                        }
                        // Klasörü yeniden oluştur
                        try {
                            if (!fs.existsSync(this.sessionPath)) {
                                fs.mkdirSync(this.sessionPath, { recursive: true, mode: 0o755 });
                            }
                            console.log('✅ Session klasörü temizlendi ve yeniden oluşturuldu');
                        } catch (e) {
                            console.log('⚠️ Session klasörü oluşturma hatası:', e?.message);
                        }
                    }
                }
            } catch (e) {
                console.log('⚠️ Session klasörü kontrolü hatası:', e?.message);
            }
        }

        return new Promise((resolve, reject) => {
            try {
                //#region WhatsApp Client init - MUST
                console.log('📦 Yeni WhatsApp Client oluşturuluyor...');
                this.client = new Client({
                    authStrategy: new LocalAuth({
                        dataPath: this.sessionPath
                    }),
                    puppeteer: {
                        headless: true,
                        args: [
                            '--no-sandbox',
                            '--disable-setuid-sandbox',
                            '--disable-dev-shm-usage',
                            '--disable-gpu',
                            '--disable-software-rasterizer',
                            '--disable-extensions',
                            '--disable-background-networking',
                            '--disable-default-apps',
                            '--no-first-run',
                            '--disable-sync',
                            '--single-process',
                            '--disable-web-security',
                            '--disable-blink-features=AutomationControlled',
                            '--disable-features=TranslateUI',
                            '--disable-hang-monitor',
                            '--disable-client-side-phishing-detection',
                            '--metrics-recording-only',
                            '--no-default-browser-check',
                            '--disable-renderer-backgrounding',
                            '--disable-backgrounding-occluded-windows'
                        ]
                    },
                    sendSeen: false
                });
                
                //#region Debug - confirm options
                try {
                    const waPackage = require('whatsapp-web.js/package.json');
                    console.log('✅ whatsapp-web.js version:', waPackage.version);
                } catch (e) {
                    console.log('⚠️ whatsapp-web.js version bilgisi alınamadı');
                }
                console.log('✅ client.options.sendSeen:', this.client.options?.sendSeen);
                console.log('✅ puppeteer headless:', this.client.options?.puppeteer?.headless);
                //#endregion

                // Event handler'lar
                // whatsapp-web.js QR'ı ~20-30 sn'de yeniler; WhatsApp QR süresi ~60 sn – 45 sn sabit tut, sonra yenileyebilsin
                const QR_MIN_STABLE_MS = 45000; // 45 sn – okutma süresi için yeterli, süresi dolana kadar yenileme
                this.client.on('qr', (qr) => {
                    if (this.qrCode === qr) {
                        console.log('⚠️ QR kod değişmedi, tekrar kaydedilmiyor');
                        return;
                    }
                    const now = Date.now();
                    if (this.firstQrStoredAt != null && (now - this.firstQrStoredAt) < QR_MIN_STABLE_MS) {
                        console.log(`⚠️ QR yenileme atlandı (${QR_MIN_STABLE_MS / 1000} sn dolmadı), aynı QR gösterilmeye devam – okutma sırasında değişmesin`);
                        return;
                    }
                    if (this.firstQrStoredAt == null) this.firstQrStoredAt = now;
                    console.log('📱 WhatsApp QR kodu oluşturuldu (sonraki yenileme 2 dk sonra)');
                    console.log(`📁 Session yolu: ${this.sessionPath}`);
                    this.qrCode = qr;
                    this.lastQr = qr;
                    this.lastDisplayedQr = qr;
                    this.lastScannedQrForDb = qr; // ready/authenticated ikisi de yazabilsin diye sadece ready'de temizlenir
                    this.initializing = false;
                    this.status = STATUS.QR;
                    this.lastUpdate = new Date();
                    
                    // Eğer session klasörü varsa, neden QR kodu istiyor?
                    if (fs.existsSync(this.sessionPath)) {
                        const sessionFiles = fs.readdirSync(this.sessionPath);
                        if (sessionFiles.length > 0) {
                            console.log(`⚠️ UYARI: Session klasörü mevcut (${sessionFiles.length} dosya) ama QR kodu isteniyor!`);
                            console.log(`📄 Session dosyaları: ${sessionFiles.join(', ')}`);
                        }
                    }
                });

                this.client.on('ready', async () => {
                    console.log('🎉 WhatsApp ready event tetiklendi!');
                    const qrThatWasScanned = this.lastScannedQrForDb || this.lastDisplayedQr || this.qrCode || null;
                    this.lastLogoutAt = null; // Yeni bağlantı kuruldu, çıkış cooldown temizlendi
                    this.lastDisconnectDbWriteAt = null; // Yeni bağlandı, disconnect yazım sayacı sıfırlansın
                    this.lastConnectedDbWriteAt = Date.now(); // Hemen set et – status isteği erken gelse bile justConnected olsun, DB yazılsın
                    this.isReady = true;
                    this.isAuthenticated = true;
                    this.qrCode = null;
                    this.lastQr = null;
                    this.lastDisplayedQr = null;
                    this.lastScannedQrForDb = null; // DB yazıldıktan sonra temizle (authenticated zaten yazdıysa da ready doğru yazdı)
                    this.firstQrStoredAt = null;
                    this.initializing = false;
                    this.status = STATUS.READY;
                    this.lastUpdate = new Date();
                    this.connectedAt = getTurkeyTimeString();
                    this.browserSessionActive = false;

                    const tenantIdToSave = this.currentTenantId || this.tenantId || 1;

                    // client.info ile telefon numarası ve kullanıcı adını al (sadece bellek – DB yok)
                    try {
                        const info = await this.client.info;
                        this.phoneNumber = info.wid?.user || info.me?.user || info.id?.user || (info.wid && info.wid.user) || null;
                        this.userName = info.pushname || info.name || info.formattedName || null;
                        this.connectedMeta = {
                            phone_number: this.phoneNumber,
                            username: this.userName,
                            tenant_id: tenantIdToSave,
                            connected_at: this.connectedAt
                        };
                        console.log(`✅ WhatsApp bağlandı: ${this.phoneNumber} (${this.userName})`);
                        if (!this._hasLoggedConnectedThisSession) {
                            this._hasLoggedConnectedThisSession = true;
                            this._hadConnectedSession = true;
                            this._hasLoggedDisconnectThisSession = false;
                            insertWhatsAppConnectionLog(tenantIdToSave, 'connected', { phone_number: this.phoneNumber, user_name: this.userName, session_owner_user: this.sessionOwnerUser });
                        }
                    } catch (e) {
                        console.log('⚠️ [Ready] client.info ilk denemede alınamadı:', e?.message || e);
                    }
                    this.lastConnectedDbWriteAt = Date.now();

                    // User agent'ı "Floovon" olarak ayarla (cihaz adını değiştirmek için)
                    try {
                        if (this.client.pupPage) {
                            const customUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Floovon/1.0';
                            await this.client.pupPage.setUserAgent(customUserAgent);
                            console.log('✅ User agent "Floovon" olarak ayarlandı');
                        }
                    } catch (e) {
                        console.log('⚠️ User agent ayarlanamadı:', e?.message || e);
                    }

                    // client.info bazen gecikmeli; 500ms, 1.5s, 3s sonra tekrar dene (sadece bellek)
                    if (!this.phoneNumber || !this.userName) {
                        [500, 1500, 3000].forEach((ms, i) => {
                            setTimeout(async () => {
                                try {
                                    if (!this.client) return;
                                    const info = await this.client.info;
                                    if (info) {
                                        const ph = info.wid?.user || info.me?.user || info.id?.user || (info.wid && info.wid.user) || null;
                                        const un = info.pushname || info.name || info.formattedName || null;
                                        if (ph || un) {
                                            this.phoneNumber = ph || this.phoneNumber;
                                            this.userName = un || this.userName;
                                            console.log(`✅ [Ready retry ${i + 1}] phone/user: ${this.phoneNumber} (${this.userName})`);
                                        }
                                    }
                                } catch (e2) { /* ignore */ }
                            }, ms);
                        });
                    }

                    if (fs.existsSync(this.sessionPath)) {
                        const sessionFiles = fs.readdirSync(this.sessionPath);
                        console.log(`✅ Session klasörü mevcut: ${this.sessionPath}, ${sessionFiles.length} dosya`);
                    } else {
                        console.log(`⚠️ Session klasörü bulunamadı: ${this.sessionPath}`);
                    }

                    //#region Patch - disable sendSeen globally in WhatsApp Web context
                    try {
                        if (!this.client.pupPage) {
                            console.log("⚠️ pupPage not available, patch skipped");
                        } else {
                            await this.client.pupPage.evaluate(() => {
                                // En geniş kapsama: sendSeen çağrısını yut
                                // Bazı buildlerde Store yolu değişebilir; birkaç olasılığı deniyoruz.
                                const candidates = [
                                    () => window?.Store?.ReadSeen,
                                    () => window?.Store?.SendSeen,
                                    () => window?.Store?.Chat?.prototype,
                                    () => window?.Store
                                ];

                                for (const getObj of candidates) {
                                    try {
                                        const obj = getObj();
                                        if (!obj) continue;

                                        // ReadSeen.sendSeen
                                        if (obj.sendSeen && typeof obj.sendSeen === "function") {
                                            obj.sendSeen = async () => true;
                                        }

                                        // markSeen / markedUnread gibi zincirler varsa da koru
                                        if (obj.markSeen && typeof obj.markSeen === "function") {
                                            const orig = obj.markSeen;
                                            obj.markSeen = async (...args) => {
                                                try { return await orig(...args); } catch { return true; }
                                            };
                                        }
                                    } catch (_) {}
                                }
                                return true;
                            });

                            console.log("✅ sendSeen patch applied (NO-OP).");
                        }
                    } catch (e) {
                        console.log("⚠️ sendSeen patch failed:", e?.message || e);
                    }
                    //#endregion

                    this._startReadyHeartbeat();
                    console.log('✅ WhatsApp servisi hazır');
                    console.log('📊 [Ready Event] Final state - isReady:', this.isReady, ', isAuthenticated:', this.isAuthenticated);
                    resolve(true);
                });

                this.client.on('authenticated', async () => {
                    const qrThatWasScannedAuth = this.lastScannedQrForDb || this.lastDisplayedQr || this.qrCode || null;
                    this.isAuthenticated = true;
                    // lastDisplayedQr/qrCode SİLME – ready event sonra çalışırsa o da son_okutulan_qr yazabilsin
                    this.lastDisconnectDbWriteAt = null;
                    // Hemen set et: status endpoint justConnected desin, popup "Bağlantı başarılı" görsün (ready gecikse bile)
                    this.lastConnectedDbWriteAt = Date.now();
                    console.log(`✅ WhatsApp authenticated - Session kaydediliyor: ${this.sessionPath}`);
                    console.log(`📱 Tenant ID: ${this.currentTenantId}`);
                    console.log(`📁 Session path: ${this.sessionPath}`);
                    console.log(`⏳ Ready event bekleniyor...`);
                    
                    // Tenant ID'yi kaydet (eğer yoksa)
                    const tenantIdToSave = this.currentTenantId || this.tenantId || 1;
                    
                    // Kullanıcı bilgilerini almayı dene (ready event gelmeden önce)
                    try {
                        const info = await this.client.info;
                        if (info) {
                            this.phoneNumber = info.wid?.user || info.me?.user || info.id?.user || (info.wid && info.wid.user) || null;
                            this.userName = info.pushname || info.name || info.formattedName || null;
                            if (this.phoneNumber || this.userName) {
                                console.log(`✅ [Authenticated] Kullanıcı bilgileri alındı: ${this.phoneNumber} (${this.userName})`);
                            }
                        }
                    } catch (infoErr) {
                        console.log(`⚠️ [Authenticated] client.info erişilemedi:`, infoErr.message);
                    }
                    
                    this.lastConnectedDbWriteAt = Date.now();
                    // Session dosyasının kaydedildiğini kontrol et
                    setTimeout(() => {
                        if (fs.existsSync(this.sessionPath)) {
                            const sessionFiles = fs.readdirSync(this.sessionPath);
                            console.log(`✅ Session kaydedildi: ${sessionFiles.length} dosya`);
                            if (sessionFiles.length === 0) {
                                console.log(`⚠️ UYARI: Session klasörü boş! Session dosyaları kaydedilmemiş olabilir.`);
                            }
                        } else {
                            console.log(`⚠️ UYARI: Session klasörü hala yok! Yazma izni kontrol edilmeli.`);
                        }
                    }, 2000);
                    
                    // Ready event'inin gelmesini bekle (max 30 saniye)
                    // Eğer ready event gelmezse, session dosyası sorunu olabilir
                    let readyCheckCount = 0;
                    const maxReadyChecks = 6; // 30 saniye (6 * 5 saniye)
                    const readyCheckInterval = setInterval(() => {
                        readyCheckCount++;
                        if (this.isReady) {
                            clearInterval(readyCheckInterval);
                        } else if (readyCheckCount >= maxReadyChecks) {
                            clearInterval(readyCheckInterval);
                            // Ready event gelmedi - session dosyası sorunu olabilir
                            // Session dosyasını kontrol et ve gerekirse temizle
                            if (this.sessionPath && fs.existsSync(this.sessionPath)) {
                                const sessionFiles = fs.readdirSync(this.sessionPath);
                                if (sessionFiles.length === 0) {
                                    console.error('❌ UYARI: Authenticated event tetiklendi ama ready event gelmedi ve session klasörü boş!');
                                    console.error('❌ Bu durum genellikle session dosyası kaydedilemediğinde görülür.');
                                    // Session dosyası kaydedilemediyse, authenticated'i false yap
                                    this.isAuthenticated = false;
                                }
                            }
                        }
                    }, 5000); // Her 5 saniyede bir kontrol et
                });

                this.client.on('auth_failure', (msg) => {
                    console.error('❌ WhatsApp auth_failure event tetiklendi:', msg);
                    this.isAuthenticated = false;
                    this.isReady = false;
                    this.initializing = false;
                    this.qrCode = null;
                    this.lastQr = null;
                    this.lastScannedQrForDb = null;
                    this.firstQrStoredAt = null;
                    this.status = STATUS.AUTH_FAILURE;
                    this.lastError = String(msg || 'auth_failure');
                    this.lastUpdate = new Date();
                    reject(new Error('WhatsApp kimlik doğrulama başarısız: ' + msg));
                });

                this.client.on('disconnected', async (reason) => {
                    this._stopReadyHeartbeat();
                    console.log(`⚠️ WhatsApp bağlantısı kesildi: ${reason}`);
                    this.lastDisconnectReason = reason;
                    const r = String(reason || '').toUpperCase();
                    const isTransientOnly = (r === 'CONNECTION_LOST' || r === 'TIMEOUT' || r.includes('CONNECTION_LOST') || r.includes('TIMEOUT')) && r.length > 0;

                    // Her kesintide (geçici dahil) DB'ye bir satır yaz – restart sonrası kayıp olmasın; telefondan çıkış CONNECTION_LOST ile de gelebilir
                    const savedTenantId = this.currentTenantId || this.tenantId || 1;
                    const connectionAtForLog = this.connectedAt;
                    const phoneForLog = this.phoneNumber;
                    const userForLog = this.userName;
                    if (!this._hasLoggedDisconnectThisSession) {
                        this._hasLoggedDisconnectThisSession = true;
                        insertWhatsAppConnectionLog(savedTenantId, 'disconnected', { disconnect_reason: reason, phone_number: phoneForLog, user_name: userForLog, connection_at: connectionAtForLog, session_owner_user: this.sessionOwnerUser });
                    }

                    if (isTransientOnly) {
                        console.log(`⚠️ [Disconnected] Geçici kesinti (${reason}) – Session korunuyor, telefonda bağlı kalabilir`);
                        this.isReady = false;
                        this.isAuthenticated = false;
                        this.lastUpdate = new Date();
                        return;
                    }

                    this.isReady = false;
                    this.isAuthenticated = false;
                    this.qrCode = null;
                    this.lastQr = null;
                    this.lastScannedQrForDb = null;
                    this.status = STATUS.DISCONNECTED;
                    this.lastUpdate = new Date();
                    this.connectedAt = null;
                    this.connectedMeta = null;
                    this.lastConnectedDbWriteAt = null;
                    this._hasLoggedConnectedThisSession = false;

                    // Hemen state temizle – status/popup anında "çıkış" görsün, yeni QR akışı takılmasın (telefondan çıkış = buton gibi)
                    this.phoneNumber = null;
                    this.userName = null;
                    this.initializing = false;
                    this.isReady = false;
                    this.isAuthenticated = false;
                    this.lastLogoutAt = Date.now();
                    this.lastConnectedDbWriteAt = null;
                    this.browserSessionActive = false;
                    this.firstQrStoredAt = null;
                    this.qrCode = null;
                    this.lastQr = null;
                    const clientToDestroy = this.client;
                    this.client = null;

                    // Destroy arka planda – beklemeyelim ki popup açıldığında yeni init hemen başlayabilsin
                    this.destroying = true;
                    setImmediate(async () => {
                        try {
                            if (clientToDestroy) {
                                try {
                                    await clientToDestroy.logout().catch(() => {});
                                    console.log('✅ WhatsApp logout gönderildi (telefondan cihaz kaldırılacak)');
                                } catch (e) { /* ignore */ }
                                try {
                                    await clientToDestroy.destroy();
                                    console.log('✅ Client destroy edildi (arka plan)');
                                } catch (e) {
                                    console.log('⚠️ Client destroy hatası:', e?.message);
                                }
                                await new Promise(r => setTimeout(r, 1500));
                            }
                            if (!isTransientOnly) {
                                console.log('🔄 Telefondan çıkış / bağlantı sonlandı - Session siliniyor...');
                                if (this.sessionPath && fs.existsSync(this.sessionPath)) {
                                    try {
                                        fs.rmSync(this.sessionPath, { recursive: true, force: true });
                                        fs.mkdirSync(this.sessionPath, { recursive: true, mode: 0o755 });
                                        console.log('✅ Session klasörü temizlendi:', this.sessionPath);
                                    } catch (e) {
                                        console.log('⚠️ Session silme hatası:', e?.message);
                                    }
                                }
                                this.currentTenantId = savedTenantId;
                                this.lastDisconnectReason = null;
                                this.qrCode = null;
                                console.log('✅ Telefondan çıkış tamamlandı - Yeni QR için hazır');
                            } else {
                                this.currentTenantId = null;
                                setTimeout(() => {
                                    this.initialize(savedTenantId).catch(() => {});
                                }, 5000);
                            }
                        } finally {
                            this.destroying = false;
                        }
                    });
                });

                // remote_session_saved event'i LocalAuth'ta yanlış alarm üretebilir, kaldırıldı

                // Loading screen event - QR kod gösterilmeden önce
                this.client.on('loading_screen', (percent, message) => {
                    console.log(`⏳ WhatsApp yükleniyor: ${percent}% - ${message}`);
                });

                // Client error event
                this.client.on('error', (error) => {
                    const errorMessage = error?.message || error?.toString() || 'Bilinmeyen hata';
                    const errorName = error?.name || 'Error';
                    
                // ProtocolError: Target closed hatası - browser tab kapanmış veya bağlantı kesilmiş
                    if (errorMessage.includes('Protocol error') ||
                        errorMessage.includes('Target closed') ||
                        errorMessage.includes('getResponseBody') ||
                        errorName === 'ProtocolError') {
                        console.warn('⚠️ WhatsApp browser bağlantısı kesildi (ProtocolError). Client temizleniyor...');
                        this.isReady = false;
                        this.isAuthenticated = false;
                        this.qrCode = null;
                        this.initializing = false;
                        this.browserSessionActive = false;
                        if (this.client) {
                            this.client.destroy().catch(() => {});
                            this.client = null;
                        }
                        return;
                    }
                    
                    console.error('❌ WhatsApp client hatası:', error);
                    console.error('❌ Hata detayları:', {
                        message: errorMessage,
                        stack: error?.stack || 'Stack trace yok',
                        name: errorName
                    });
                    // Eğer authenticated ama ready değilse, bu ciddi bir sorun
                    if (this.isAuthenticated && !this.isReady) {
                        console.error('❌ KRİTİK: Authenticated ama ready değil! Bu durum bağlantı sorununa işaret eder.');
                        console.error('❌ Muhtemelen session dosyası kaydedilemedi veya WhatsApp Web bağlantısı kesildi.');
                    }
                    this.initializing = false;
                    // Hata durumunda reject etme, sadece logla
                    // Çünkü bazı hatalar geçici olabilir
                });

                // Client'ı başlat
                console.log('🚀 WhatsApp client initialize ediliyor...');
                
                const QR_MAX_WAIT_MS = 120000; // 2 dakika: QR gelmezse client'ı kapat, tekrar denesin
                const QR_SOFT_WAIT_MS = 25000; // 25 sn: initializing flag sıfırla (QR hâlâ gelebilir)
                
                let qrTimeout;
                let killTimeout;
                
                const clearAllTimeouts = () => {
                    if (qrTimeout) clearTimeout(qrTimeout);
                    if (killTimeout) clearTimeout(killTimeout);
                };
                
                qrTimeout = setTimeout(() => {
                    if (this.initializing && !this.qrCode) {
                        console.log('⚠️ QR kod 25 sn içinde gelmedi, initializing flag sıfırlanıyor...');
                        this.initializing = false;
                    }
                }, QR_SOFT_WAIT_MS);
                
                killTimeout = setTimeout(async () => {
                    if (this.qrCode || this.isReady) return;
                    console.error('❌ QR kod 2 dakika içinde gelmedi – client kapatılıyor, tekrar deneyin.');
                    clearAllTimeouts();
                    this.initializing = false;
                    if (this.client) {
                        try { await this.client.destroy(); } catch (e) { /* ignore */ }
                        this.client = null;
                    }
                    this.qrCode = null;
                    this.firstQrStoredAt = null;
                    reject(new Error('QR kod 2 dakika içinde gelmedi. Lütfen tekrar deneyin.'));
                }, QR_MAX_WAIT_MS);
                
                // Client'ı başlat - hataları yakala (retry yapma, kısır döngüyü önlemek için)
                this.client.initialize().then(() => {
                    console.log('✅ WhatsApp client initialize başlatıldı, QR kod bekleniyor...');
                    const qrCheckInterval = setInterval(() => {
                        if (this.qrCode) {
                            clearAllTimeouts();
                            clearInterval(qrCheckInterval);
                        }
                    }, 1000);
                    setTimeout(() => clearInterval(qrCheckInterval), QR_MAX_WAIT_MS);
                }).catch((initError) => {
                    clearAllTimeouts();
                    const errorMessage = initError?.message || initError?.toString() || '';
                    console.error('❌ WhatsApp initialize hatası:', errorMessage);
                    // Client'ı null yap ve state'i temizle
                    this.client = null;
                    this.isReady = false;
                    this.isAuthenticated = false;
                    this.qrCode = null;
                    this.initializing = false;
                    reject(initError);
                });
            } catch (error) {
                this.initializing = false;
                reject(error);
            }
        });
    }

    /**
     * Telefon numarasını WhatsApp formatına çevir
     * Örnek: "0506 659 35 45" -> "905066593545@c.us"
     * STANDART FORMAT: 12 haneli, 90 ile başlayan (örn: 905066593545)
     */
    formatPhoneNumber(phoneNumber) {
        if (!phoneNumber) {
            throw new Error('Telefon numarası boş olamaz');
        }

        // Sadece rakamları al
        const digits = phoneNumber.toString().replace(/\D/g, '');
        
        if (digits.length === 0) {
            throw new Error('Geçersiz telefon numarası');
        }

        let normalized = digits;
        
        // 11 haneli ve 0 ile başlıyorsa 0'ı kaldır ve 90 ekle
        if (digits.length === 11 && digits.startsWith('0')) {
            normalized = '90' + digits.substring(1);
        }
        // 10 haneli ve 5 ile başlıyorsa 90 ekle
        else if (digits.length === 10 && digits.startsWith('5')) {
            normalized = '90' + digits;
        }
        // 12 haneli ve 90 ile başlıyorsa direkt kullan
        else if (digits.length === 12 && digits.startsWith('90')) {
            normalized = digits;
        }
        // Diğer durumlarda son 10 rakamı al ve 90 ekle
        else if (digits.length >= 10) {
            const last10 = digits.substring(digits.length - 10);
            normalized = '90' + last10;
        }
        else {
            throw new Error('Geçersiz telefon numarası formatı');
        }
        
        // Son kontrol: 12 haneli ve 90 ile başlamalı
        if (normalized.length !== 12 || !normalized.startsWith('90')) {
            throw new Error('Telefon numarası normalize edilemedi');
        }

        // WhatsApp formatına çevir
        return `${normalized}@c.us`;
    }

    /**
     * getNumberId uyumluluk fonksiyonu (supports different whatsapp-web.js behaviors)
     * ProtocolError hatasını yakalar ve handle eder
     */
    async getNumberIdCompat(digits) {
        // A) client.getNumberId("905...")
        if (typeof this.client.getNumberId === 'function') {
            try {
                const a = await this.client.getNumberId(digits);
                if (a?._serialized) return a;
            } catch (e) {
                // ProtocolError kontrolü
                const errorMessage = e?.message || e?.toString() || '';
                if (errorMessage.includes('Protocol error') || 
                    errorMessage.includes('Target closed') || 
                    errorMessage.includes('getResponseBody') ||
                    e?.name === 'ProtocolError') {
                    throw e; // ProtocolError'ı yukarı fırlat
                }
            }

            // B) client.getNumberId("905...@c.us")
            try {
                const b = await this.client.getNumberId(`${digits}@c.us`);
                if (b?._serialized) return b;
            } catch (e) {
                // ProtocolError kontrolü
                const errorMessage = e?.message || e?.toString() || '';
                if (errorMessage.includes('Protocol error') || 
                    errorMessage.includes('Target closed') || 
                    errorMessage.includes('getResponseBody') ||
                    e?.name === 'ProtocolError') {
                    throw e; // ProtocolError'ı yukarı fırlat
                }
            }
        }

        // C) client.isRegisteredUser("905...@c.us") fallback
        if (typeof this.client.isRegisteredUser === 'function') {
            try {
                const ok = await this.client.isRegisteredUser(`${digits}@c.us`);
                if (ok) return { _serialized: `${digits}@c.us` };
            } catch (e) {
                // ProtocolError kontrolü
                const errorMessage = e?.message || e?.toString() || '';
                if (errorMessage.includes('Protocol error') || 
                    errorMessage.includes('Target closed') || 
                    errorMessage.includes('getResponseBody') ||
                    e?.name === 'ProtocolError') {
                    throw e; // ProtocolError'ı yukarı fırlat
                }
            }
        }

        return null;
    }

    /**
     * Mesaj gönder (FIXED - no getChatById, no fake msg id, no sendSeen)
     */
    async sendMessage(phoneNumber, message) {
        // Temel kontroller - ESKİ YEDEKTEKİ GİBİ: browserSessionActive kontrolü yok
        if (!this.isReady || !this.isAuthenticated) {
            throw new Error('WhatsApp servisi hazır değil. Lütfen önce bağlantıyı kurun.');
        }
        if (!this.client) {
            throw new Error('WhatsApp client başlatılmamış');
        }
        if (!phoneNumber || !message) {
            throw new Error('Telefon ve mesaj zorunlu');
        }

        // 1) Telefonu normalize et (digits)
        const digitsRaw = String(phoneNumber).replace(/\D/g, '');
        let digits = digitsRaw;

        console.log(`📱 [sendMessage] Ham numara: ${phoneNumber}, Rakamlar: ${digitsRaw}`);

        // TR normalize (senin sistem TR odaklı)
        // Önce 12 haneye normalize et
        if (digits.length === 11 && digits.startsWith('0')) {
            // 05066593545 → 905066593545
            digits = '90' + digits.slice(1);
        } else if (digits.length === 10) {
            // 5066593545 → 905066593545
            digits = '90' + digits;
        } else if (digits.length === 12 && digits.startsWith('90')) {
            // 905066593545 → olduğu gibi
            digits = digits;
        } else if (digits.length > 12 && digits.startsWith('90')) {
            // 90905066593545 gibi fazla 90 varsa, son 12 haneyi al
            // Veya fazladan 90'ı kaldır
            if (digits.startsWith('9090')) {
                // 90905066593545 → 905066593545 (ilk 90'ı kaldır)
                digits = digits.slice(2);
            } else {
                // Son 10 haneyi al ve 90 ekle
                digits = '90' + digits.slice(-10);
            }
        } else if (digits.length >= 10) {
            // Diğer durumlar için son 10 haneyi al
            digits = '90' + digits.slice(-10);
        }
        
        console.log(`📱 [sendMessage] Normalize edilmiş numara: ${digits}`);

        // 2) Numara WhatsApp'ta kayıtlı mı? (doğru kontrol)
        let numberId;
        try {
            numberId = await this.getNumberIdCompat(digits);
        } catch (getNumberError) {
            const errorMessage = getNumberError?.message || getNumberError?.toString() || 'Bilinmeyen hata';
            // ProtocolError: Target closed hatası
            if (errorMessage.includes('Protocol error') || 
                errorMessage.includes('Target closed') || 
                errorMessage.includes('getResponseBody') ||
                getNumberError?.name === 'ProtocolError') {
                console.error('❌ [sendMessage] Browser bağlantısı kesildi (ProtocolError - getNumberId). Client temizleniyor...');
                // Client'ı temizle
                this.isReady = false;
                this.isAuthenticated = false;
                if (this.client) {
                    this.client.destroy().catch(() => {});
                    this.client = null;
                }
                throw new Error('WhatsApp browser bağlantısı kesildi. Lütfen servisi yeniden başlatın.');
            }
            throw getNumberError;
        }
        if (!numberId || !numberId._serialized) {
            throw new Error(`Telefon numarası WhatsApp'ta kayıtlı değil: ${phoneNumber}`);
        }

        const chatId = numberId._serialized; // "905...@c.us"

        // 3) Mesaj gönder (TEK başarı kriteri) - sendSeen devre dışı
        console.log(`📤 [sendMessage] Mesaj gönderiliyor: ${chatId}`);
        let result;
        try {
            result = await this.client.sendMessage(chatId, message, { sendSeen: false });
            console.log(`✅ [sendMessage] Mesaj gönderildi! ID: ${result?.id?._serialized}`);
        } catch (sendError) {
            const errorMessage = sendError?.message || sendError?.toString() || 'Bilinmeyen hata';
            // ProtocolError: Target closed hatası
            if (errorMessage.includes('Protocol error') || 
                errorMessage.includes('Target closed') || 
                errorMessage.includes('getResponseBody') ||
                sendError?.name === 'ProtocolError') {
                console.error('❌ [sendMessage] Browser bağlantısı kesildi (ProtocolError). Client temizleniyor...');
                // Client'ı temizle
                this.isReady = false;
                this.isAuthenticated = false;
                if (this.client) {
                    this.client.destroy().catch(() => {});
                    this.client = null;
                }
                throw new Error('WhatsApp browser bağlantısı kesildi. Lütfen servisi yeniden başlatın.');
            }
            // Diğer hatalar
            console.error('❌ [sendMessage] Mesaj gönderme hatası:', errorMessage);
            throw sendError;
        }

        const realMessageId = result?.id?._serialized || null;
        if (!realMessageId) {
            // burada success dönmek YANLIŞ. Çünkü gerçek id alamadık.
            throw new Error('Mesaj gönderildi fakat messageId alınamadı (beklenmeyen durum).');
        }

        return {
            success: true,
            messageId: realMessageId,
            timestamp: result?.timestamp || Math.floor(Date.now() / 1000),
            phoneNumber: phoneNumber
        };
    }

    /**
     * Medya gönder (fotoğraf/dosya ile mesaj)
     */
    async sendMedia(phoneNumber, mediaPath, caption = '') {
        console.log(`📤 [sendMedia] Başlatılıyor - Tel: ${phoneNumber}, Media: ${mediaPath}`);
        console.log(`📤 [sendMedia] Durum - isReady: ${this.isReady}, isAuthenticated: ${this.isAuthenticated}, client: ${!!this.client}`);
        
        // Temel kontroller
        if (this.browserSessionActive) {
            console.log('❌ [sendMedia] Tarayıcıda WhatsApp Web açık!');
            throw new Error('Tarayıcıda WhatsApp Web açık! Lütfen kapatın.');
        }

        if (!this.isReady || !this.isAuthenticated) {
            console.log(`❌ [sendMedia] Servis hazır değil - isReady: ${this.isReady}, isAuthenticated: ${this.isAuthenticated}`);
            throw new Error('WhatsApp servisi hazır değil. Lütfen bağlantıyı kurun.');
        }

        if (!this.client) {
            console.log('❌ [sendMedia] Client yok!');
            throw new Error('WhatsApp client başlatılmamış');
        }

        // Dosya kontrolü
        let absolutePath = mediaPath;
        if (!path.isAbsolute(mediaPath)) {
            if (mediaPath.startsWith('/uploads/')) {
                absolutePath = path.join(__dirname, mediaPath.substring(1));
            } else {
                absolutePath = path.join(__dirname, mediaPath);
            }
        }
        
        console.log(`📤 [sendMedia] Dosya yolu: ${absolutePath}`);
        
        if (!fs.existsSync(absolutePath)) {
            console.log(`❌ [sendMedia] Dosya bulunamadı: ${absolutePath}`);
            throw new Error('Media dosyası bulunamadı: ' + absolutePath);
        }

        // Telefon numarasını formatla
        const formattedNumber = this.formatPhoneNumber(phoneNumber);
        console.log(`📤 [sendMedia] Formatlanmış numara: ${formattedNumber}`);

        try {
            // Medya oluştur
            const media = MessageMedia.fromFilePath(absolutePath);
            console.log(`📤 [sendMedia] Media oluşturuldu, gönderiliyor...`);
            
            // Mesajı gönder - sendSeen devre dışı
            let result;
            try {
                result = await this.client.sendMessage(formattedNumber, media, { 
                    caption: caption || undefined,
                    sendSeen: false  // Okundu bilgisi gönderme
                });
                console.log(`✅ [sendMedia] Mesaj gönderildi! ID: ${result?.id?._serialized}`);
            } catch (sendError) {
                const errorMessage = sendError?.message || sendError?.toString() || 'Bilinmeyen hata';
                // ProtocolError: Target closed hatası
                if (errorMessage.includes('Protocol error') || 
                    errorMessage.includes('Target closed') || 
                    errorMessage.includes('getResponseBody') ||
                    sendError?.name === 'ProtocolError') {
                    console.error('❌ [sendMedia] Browser bağlantısı kesildi (ProtocolError). Client temizleniyor...');
                    // Client'ı temizle
                    this.isReady = false;
                    this.isAuthenticated = false;
                    if (this.client) {
                        this.client.destroy().catch(() => {});
                        this.client = null;
                    }
                    throw new Error('WhatsApp browser bağlantısı kesildi. Lütfen servisi yeniden başlatın.');
                }
                // Diğer hatalar
                console.error('❌ [sendMedia] Mesaj gönderme hatası:', errorMessage);
                throw sendError;
            }

            return {
                success: true,
                messageId: result.id._serialized,
                timestamp: result.timestamp,
                phoneNumber: phoneNumber
            };
        } catch (error) {
            console.log(`❌ [sendMedia] HATA: ${error.message}`);
            console.log(`❌ [sendMedia] Stack: ${error.stack}`);
            throw error;
        }
    }

    /**
     * Durum bilgisini al
     */
    async getStatus() {
        let actualState = null;

        if (!this.client) {
            this.isReady = false;
            this.isAuthenticated = false;
            const st = this._getStatusName();
            return {
                status: st,
                isReady: false,
                isAuthenticated: false,
                qrCode: null,
                hasQRCode: false,
                phoneNumber: null,
                userName: null,
                connectedAt: null,
                updatedAt: this.lastUpdate ? this.lastUpdate.toISOString() : null,
                error: this.lastError || null,
                actualState: 'DISCONNECTED' // Client yok = telefondan çıkış; status endpoint buna göre DB 0 yapsın
            };
        }

        if (this.client) {
            try {
                // Client null kontrolü ve getState fonksiyonu kontrolü
                if (typeof this.client.getState === 'function') {
                    actualState = await this.client.getState();
                } else {
                    // getState fonksiyonu yoksa client muhtemelen destroy edilmiş
                    this.client = null;
                    this.isReady = false;
                    this.isAuthenticated = false;
                    return {
                        isReady: false,
                        isAuthenticated: false,
                        qrCode: null,
                        hasQRCode: false,
                        phoneNumber: null,
                        userName: null,
                        connectedAt: null
                    };
                }
                
                // Telefondan çıkış veya bağlantı yok: sadece bellek güncelle (DB yok)
                const disconnectedStates = ['UNPAIRED', 'DISCONNECTED', 'CONFLICT', 'CLOSED', 'UNLAUNCHED', 'UNPAIRED_IDLE'];
                if (actualState && disconnectedStates.includes(actualState)) {
                    this.isReady = false;
                    this.isAuthenticated = false;
                    console.log(`🔌 [WhatsApp getStatus] State: ${actualState} – bağlantı sonlandı (bellek)`);
                } else if (actualState === 'CONNECTED' || actualState === 'READY') {
                    // CONNECTED veya READY ise mutlaka hazır olmalı
                    this.isReady = true;
                    this.isAuthenticated = true;
                    
                    // Eğer phoneNumber veya userName null ise, client.info'dan almayı dene
                    if (!this.phoneNumber || !this.userName) {
                        try {
                            const info = this.client.info;
                            if (info) {
                                const resolvedInfo = (info && typeof info.then === 'function') ? await info : info;
                                if (resolvedInfo) {
                                    this.phoneNumber = resolvedInfo.wid?.user || resolvedInfo.me?.user || this.phoneNumber;
                                    this.userName = resolvedInfo.pushname || resolvedInfo.name || this.userName;
                                    if (!this.connectedAt) {
                                        const now = new Date();
                                        const turkeyOffset = 3 * 60 * 60 * 1000;
                                        const turkeyTime = new Date(now.getTime() + turkeyOffset);
                                        this.connectedAt = turkeyTime.toISOString().replace('T', ' ').substring(0, 19);
                                    }
                                }
                            }
                        } catch (infoErr) {
                            // client.info erişilemedi (sayfa henüz hazır olmayabilir)
                        }
                    }
                    // Bu oturumda henüz "connected" logu yazılmadıysa bir kez yaz (ready event kaçırıldıysa yedek)
                    if (!this._hasLoggedConnectedThisSession && (this.phoneNumber || this.userName)) {
                        this._hasLoggedConnectedThisSession = true;
                        this._hadConnectedSession = true;
                        this._hasLoggedDisconnectThisSession = false;
                        const tid = this.currentTenantId || this.tenantId || 1;
                        insertWhatsAppConnectionLog(tid, 'connected', { phone_number: this.phoneNumber, user_name: this.userName, session_owner_user: this.sessionOwnerUser });
                    }
                } else if (actualState === 'PAIRING' || actualState === 'CONNECTING') {
                    this.isAuthenticated = true;
                    const recentlyConnected = this.lastConnectedDbWriteAt && (Date.now() - this.lastConnectedDbWriteAt < 25000);
                    if (recentlyConnected) {
                        this.isReady = true;
                        if (!this.connectedAt) {
                            const now = new Date();
                            const to = 3 * 60 * 60 * 1000;
                            this.connectedAt = new Date(now.getTime() + to).toISOString().replace('T', ' ').substring(0, 19);
                        }
                        console.log(`✅ [WhatsApp getStatus] PAIRING ama az önce authenticated/ready – ready sayılıyor`);
                    } else {
                        try {
                            const info = this.client.info;
                            const resolved = (info && typeof info.then === 'function') ? await info : info;
                                    if (resolved && (resolved.wid?.user || resolved.pushname || resolved.me?.user || resolved.name || resolved.id?.user || resolved.formattedName)) {
                                this.phoneNumber = resolved.wid?.user || resolved.me?.user || resolved.id?.user || (resolved.wid && resolved.wid.user) || this.phoneNumber;
                                this.userName = resolved.pushname || resolved.name || resolved.formattedName || this.userName;
                                if (this.phoneNumber || this.userName) {
                                    this.isReady = true;
                                    if (!this.connectedAt) {
                                        const now = new Date();
                                        const to = 3 * 60 * 60 * 1000;
                                        this.connectedAt = new Date(now.getTime() + to).toISOString().replace('T', ' ').substring(0, 19);
                                    }
                                    console.log(`✅ [WhatsApp getStatus] PAIRING ama client.info alındı – ready sayılıyor (${this.phoneNumber} / ${this.userName})`);
                                } else {
                                    this.isReady = false;
                                    console.log(`⏳ [WhatsApp getStatus] Bağlantı kuruluyor (state=${actualState})`);
                                }
                            } else {
                                this.isReady = false;
                                console.log(`⏳ [WhatsApp getStatus] Bağlantı kuruluyor (state=${actualState})`);
                            }
                        } catch (e) {
                            this.isReady = false;
                            console.log(`⏳ [WhatsApp getStatus] Bağlantı kuruluyor (state=${actualState})`);
                        }
                    }
                } else {
                    // CONNECTED/READY değilse isReady ve isAuthenticated false – popup "Bağlantı kuruluyor" takılı kalmasın, QR görünsün
                    this.isReady = false;
                    this.isAuthenticated = false;
                }
            } catch (err) {
                actualState = 'CLOSED';
                // getState() hata verdi – az önce ready yazıldıysa state'i silme (geçici hata olabilir)
                const recentlyWroteConnected = this.lastConnectedDbWriteAt && (Date.now() - this.lastConnectedDbWriteAt < 60000);
                if (!recentlyWroteConnected) {
                    this.isReady = false;
                    this.isAuthenticated = false;
                    console.error(`❌ [WhatsApp getStatus] Hata (muhtemelen bağlantı kesildi):`, err.message);
                } else {
                    console.log(`⚠️ [WhatsApp getStatus] getState hata ama az önce bağlandı, state korunuyor:`, err?.message);
                }
            }
        } else {
            console.log(`⚠️ [WhatsApp getStatus] Client yok - Tenant ${this.currentTenantId}`);
            // Client yoksa, authenticated ve ready de false olmalı
            if (this.isAuthenticated || this.isReady) {
                console.log(`⚠️ [WhatsApp getStatus] Client yok ama isAuthenticated veya isReady true! Temizleniyor...`);
                this.isAuthenticated = false;
                this.isReady = false;
            }
        }

        return {
            installed: true,
            status: this._getStatusName(),
            isReady: this.isReady,
            isAuthenticated: this.isAuthenticated,
            hasQRCode: !!this.qrCode,
            qrCode: this.qrCode || null,
            initializing: this.initializing || false,
            browserSessionActive: this.browserSessionActive,
            lastDisconnectReason: this.lastDisconnectReason,
            actualState: actualState,
            connectedAt: this.connectedAt || null,
            phoneNumber: this.phoneNumber || null,
            userName: this.userName || null,
            updatedAt: this.lastUpdate ? this.lastUpdate.toISOString() : null,
            error: this.lastError || null,
            warning: this.browserSessionActive 
                ? 'Tarayıcıda WhatsApp Web açık! API mesaj gönderemez.'
                : (this.lastDisconnectReason === 'LOGOUT' 
                    ? 'Son bağlantı LOGOUT nedeniyle kesildi.'
                    : null)
        };
    }

    /** DB kullanılmıyor – no-op (telefon/kullanıcı sadece bellek + getStatus'tan dönüyor) */
    _persistPhoneUserToDb() {}

    /**
     * Manuel kesinti (API "bağlantıyı kes" / logout) için tabloya disconnected log yaz.
     * State temizlenmeden önce çağrılmalı (phoneNumber/userName okunabilsin).
     */
    logDisconnectEvent(reason) {
        if (this._hasLoggedDisconnectThisSession) return;
        this._hasLoggedDisconnectThisSession = true;
        this._hadConnectedSession = false;
        const tid = this.currentTenantId || this.tenantId || 1;
        insertWhatsAppConnectionLog(tid, 'disconnected', {
            disconnect_reason: reason || 'LOGOUT',
            phone_number: this.phoneNumber,
            user_name: this.userName,
            connection_at: this.connectedAt,
            session_owner_user: this.sessionOwnerUser
        });
        this._hasLoggedConnectedThisSession = false;
    }

    /**
     * Client yokken (restart veya telefondan çıkış sonrası) status isteğinde çağrılır.
     * DB'de bu tenant için son satır 'connected' ise bir 'disconnected' satırı yazar – böylece telefondan çıkışlar restart olsa bile loglanır.
     */
    ensureDisconnectLogFromDb(tenantId) {
        return new Promise((resolve) => {
            const db = _db || (typeof global !== 'undefined' && global.db) || null;
            if (!db) return resolve();
            if (_disconnectWrittenFromDbTenantIds.has(tenantId)) return resolve();
            db.get(
                'SELECT id, event_type, connection_at, whatsapp_phone_number, whatsapp_user_name, session_owner_user FROM whatsapp_baglantilar_logs WHERE tenant_id = ? ORDER BY id DESC LIMIT 1',
                [tenantId],
                async (err, row) => {
                    if (err || !row || row.event_type !== 'connected') return resolve();
                    if (_disconnectWrittenFromDbTenantIds.has(tenantId)) return resolve();
                    _disconnectWrittenFromDbTenantIds.add(tenantId);
                    await insertWhatsAppConnectionLog(tenantId, 'disconnected', {
                        connection_at: row.connection_at,
                        phone_number: row.whatsapp_phone_number,
                        user_name: row.whatsapp_user_name,
                        session_owner_user: row.session_owner_user,
                        disconnect_reason: 'CLOSED'
                    });
                    console.log('✅ whatsapp_baglantilar_logs: telefondan çıkış DB’den tamamlandı (tenant_id=' + tenantId + ')');
                    resolve();
                }
            );
        });
    }

    /**
     * QR kod al
     */
    getQRCode() {
        return this.qrCode;
    }

    /**
     * Servisi durdur ve temizle
     */
    async destroy() {
        // Zaten destroy ediliyorsa veya yakın zamanda destroy edildiyse, tekrar etme
        if (this.destroying) {
            console.log('⚠️ WhatsApp servisi zaten destroy ediliyor, yeni istek reddedildi');
            return;
        }
        
        // Son 5 saniye içinde destroy edildiyse, tekrar etme (kısır döngüyü önle)
        if (this.lastDestroyTime && (Date.now() - this.lastDestroyTime) < 5000) {
            console.log('⚠️ WhatsApp servisi yakın zamanda destroy edildi, yeni istek reddedildi');
            return;
        }
        
        this.destroying = true;
        this.lastDestroyTime = Date.now();
        
        try {
            console.log('🗑️ WhatsApp servisi destroy ediliyor...');
            if (this.client) {
                try {
                    // Client null kontrolü yap
                    if (this.client && typeof this.client.getState === 'function') {
                        const state = await this.client.getState().catch(() => null);
                        if (state) {
                            console.log(`📊 Client state: ${state}`);
                            if (state === 'CONNECTED' || state === 'READY') {
                                await this.client.logout().catch(() => {
                                    // Ignore
                                });
                            }
                        }
                    }
                } catch (e) {
                    console.log('⚠️ Client state kontrolü hatası:', e?.message);
                }

                // Client null kontrolü yap
                if (this.client && typeof this.client.destroy === 'function') {
                    await this.client.destroy().catch(() => {
                        // Ignore
                    });
                }
                // Browser'ın tamamen kapanması için bekle
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            if (this.sessionPath && fs.existsSync(this.sessionPath)) {
                try {
                    // EBUSY hatası için retry mekanizması
                    let retryCount = 0;
                    const maxRetries = 3;
                    while (retryCount < maxRetries) {
                        try {
                            fs.rmSync(this.sessionPath, { recursive: true, force: true });
                            console.log(`✅ Session dosyası silindi: ${this.sessionPath}`);
                            break;
                        } catch (e) {
                            retryCount++;
                            if (e.code === 'EBUSY' && retryCount < maxRetries) {
                                console.log(`⚠️ Session dosyası kilitli, ${retryCount * 1000}ms sonra tekrar denenecek...`);
                                await new Promise(resolve => setTimeout(resolve, retryCount * 1000));
                            } else {
                                // EBUSY hatası olsa bile devam et (dosya kilitli olabilir ama sorun değil)
                                if (e.code === 'EBUSY') {
                                    console.log('⚠️ Session dosyası kilitli (chrome_debug.log), atlanıyor...');
                                } else {
                                    console.log('⚠️ Session silme hatası:', e?.message);
                                }
                                break;
                            }
                        }
                    }
                } catch (e) {
                    console.log('⚠️ Session silme hatası:', e?.message);
                }
            }

            this.client = null;
            this.isReady = false;
            this.isAuthenticated = false;
            this.qrCode = null;
            this.lastQr = null;
            this.firstQrStoredAt = null; // Yeni QR’ın hemen gelmesi için throttle sıfırla
            this.connectedAt = null;
            this.phoneNumber = null;
            this.userName = null;
            this.connectedMeta = null;
            this.browserSessionActive = false;
            this.lastDisconnectReason = null;
            this.initializing = false;
            this.status = STATUS.UNINITIALIZED;
            this.lastUpdate = new Date();
            this.destroying = false;
            console.log('✅ WhatsApp servisi destroy edildi – yeni init için hazır');
        } catch (error) {
            this.destroying = false;
            console.error('❌ Destroy hatası:', error);
            this.client = null;
            this.isReady = false;
            this.isAuthenticated = false;
            this.qrCode = null;
            this.firstQrStoredAt = null;
            this.initializing = false;
        }
    }

    /**
     * Yeni karekod al: Bağlı değilken (QR/initializing) mevcut client'ı kapatıp state temizler.
     * Sonrasında initialize() çağrılmalı – yeni QR üretilir. Logout çağrılmaz (henüz bağlı değiliz).
     */
    async refreshQR() {
        if (!this.client || this.isReady) return;
        this._stopReadyHeartbeat();
        const clientToDestroy = this.client;
        this.client = null;
        this.qrCode = null;
        this.lastQr = null;
        this.lastScannedQrForDb = null;
        this.firstQrStoredAt = null;
        this.initializing = false;
        this.isReady = false;
        this.isAuthenticated = false;
        this.status = STATUS.UNINITIALIZED;
        this.lastUpdate = new Date();
        try {
            if (clientToDestroy && typeof clientToDestroy.destroy === 'function') {
                await clientToDestroy.destroy().catch(() => {});
                await new Promise(r => setTimeout(r, 1500));
            }
            if (this.sessionPath && fs.existsSync(this.sessionPath)) {
                try {
                    fs.rmSync(this.sessionPath, { recursive: true, force: true });
                    fs.mkdirSync(this.sessionPath, { recursive: true, mode: 0o755 });
                } catch (e) {
                    console.log('⚠️ refreshQR session temizleme:', e?.message);
                }
            }
        } catch (e) {
            console.log('⚠️ refreshQR:', e?.message);
        }
        console.log('✅ Yeni karekod için hazır – initialize() çağrılabilir');
    }

    /**
     * Sadece client referansını kapat (servis state zaten sıfırlanmış olacak).
     * Disconnect endpoint hemen yanıt dönebilsin diye arka planda çağrılır.
     */
    async destroyClientInBackground(clientRef) {
        if (!clientRef) {
            this.destroying = false;
            return;
        }
        try {
            this.destroying = true;
            if (typeof clientRef.logout === 'function') await clientRef.logout().catch(() => {});
            if (typeof clientRef.destroy === 'function') await clientRef.destroy().catch(() => {});
            await new Promise(r => setTimeout(r, 2000));
            if (this.sessionPath && fs.existsSync(this.sessionPath)) {
                try {
                    fs.rmSync(this.sessionPath, { recursive: true, force: true });
                    console.log('✅ Session temizlendi (arka plan):', this.sessionPath);
                } catch (e) {
                    if (e.code === 'EBUSY') console.log('⚠️ Session kilitli, atlandı');
                }
            }
        } catch (e) {
            console.warn('⚠️ destroyClientInBackground:', e?.message);
        } finally {
            this.destroying = false;
        }
    }
}

// TEK INSTANCE KURALI: Process içinde WhatsApp client asla iki kere init olmasın
let whatsappSingleton = null;

function getWhatsAppService(tenantId = null) {
    if (!whatsappSingleton) {
        whatsappSingleton = new WhatsAppService();
        console.log('✅ WhatsApp servisi singleton oluşturuldu (tek instance)');
    }
    return whatsappSingleton;
}

module.exports = {
    WhatsAppService,
    getWhatsAppService,
    setDatabase
};
