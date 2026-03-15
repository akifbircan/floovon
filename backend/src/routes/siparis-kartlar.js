/**
 * Sipariş Kartları API Routes
 * Index sayfasındaki sipariş kartları için backend işlemleri
 */

const express = require('express');
const router = express.Router();
const DatabaseManager = require('../config/database');
const logger = require('../utils/logger');

// Tüm route'ları logla
router.use((req, res, next) => {
    console.log('🔍 Siparis-kartlar route çağrıldı:', req.method, req.path);
    console.log('🔍 Full URL:', req.url);
    if (req.path === '/archived') {
        console.log('✅ /archived route\'u çağrıldı!');
    }
    next();
});

// Database instance'ını route handler'da kullanmak için getter function
async function getDb() {
    let db = DatabaseManager.getInstance();
    
    // Database hazır değilse 5 saniye bekle
    if (!db || !db.db) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        db = DatabaseManager.getInstance();
    }
    
    if (!db || !db.db) {
        throw new Error('Database bağlantısı hazır değil');
    }
    return db;
}

/**
 * siparisler/siparis_kartlar tablosundaki müşteri adı kolonlarını tespit eder.
 * Büyük/küçük harf duyarsız eşleme + tüm olası isim kolonları COALESCE ile tek değerde.
 */
async function getSiparisMusteriSelectParts(db) {
    const tables = ['siparisler', 'siparis_kartlar'];
    let tableName = null;
    let columns = [];
    for (const t of tables) {
        try {
            const info = await db.query(`PRAGMA table_info(${t})`);
            if (info && info.length > 0) {
                tableName = t;
                columns = info.map((c) => c.name);
                break;
            }
        } catch (_) {}
    }
    if (!tableName || columns.length === 0) {
        return { tableName: 'siparisler', unvanSel: 'sk.musteri_unvan', isimSel: 'sk.musteri_isim_soyisim' };
    }
    const has = (n) => columns.some((c) => String(c).toLowerCase() === n.toLowerCase());
    const col = (n) => {
        const found = columns.find((c) => String(c).toLowerCase() === n.toLowerCase());
        return found ? `sk.${found}` : null;
    };
    const unvanCols = ['musteri_unvan', 'musteri_unvani'].map(col).filter(Boolean);
    const isimCols = ['musteri_isim_soyisim', 'musteri_ad_soyad', 'siparis_veren', 'musteri_adi', 'musteri_unvan', 'musteri_unvani'].map(col).filter(Boolean);
    const unvanSel = unvanCols.length > 0 ? `COALESCE(${unvanCols.join(', ')}) AS musteri_unvan` : 'NULL AS musteri_unvan';
    const isimSel = isimCols.length > 0 ? `COALESCE(${isimCols.join(', ')}) AS musteri_isim_soyisim` : 'NULL AS musteri_isim_soyisim';
    return { tableName, unvanSel, isimSel };
}

/** API yanıtında her siparişte musteri_unvan ve musteri_isim_soyisim dolu olsun (frontend .siparis-veren için) */
function normalizeSiparisMusteri(row) {
    if (!row) return;
    const unvan = row.musteri_unvan || row.musteri_unvani || '';
    const isim = row.musteri_isim_soyisim || row.musteri_ad_soyad || row.siparis_veren || row.musteri_adi || row.musteri_unvan || row.musteri_unvani || '';
    row.musteri_unvan = unvan || isim || null;
    row.musteri_isim_soyisim = isim || unvan || null;
}

// Tüm sipariş kartlarını getir
router.get('/', async (req, res) => {
    try {
        const db = await getDb();
        const { tableName, unvanSel, isimSel } = await getSiparisMusteriSelectParts(db);

        const siparisKartlari = await db.query(`
            SELECT 
                sk.id, sk.kart_sira, sk.organizasyon_kart_id, ${unvanSel}, ${isimSel},
                sk.siparis_veren_telefon, sk.urun_yazisi, sk.secilen_urun_yazi_dosyasi, sk.siparis_urun,
                sk.siparis_urun_aciklama, sk.urun_gorsel, sk.arac_randevu_saat, sk.arac_markamodel, sk.arac_renk, sk.arac_plaka,
                sk.siparis_tutari, sk.odeme_yontemi, sk.baglantili_siparisler, sk.ekstra_ucret_aciklama,
                sk.ekstra_ucret_tutari, sk.toplam_tutar, sk.teslim_kisisi, sk.teslim_kisisi_telefon,
                sk.teslim_il, sk.teslim_ilce, sk.teslim_mahalle, sk.teslim_acik_adres, sk.teslim_saat,
                sk.teslim_tarih, sk.notes, sk.status, 
                COALESCE(CAST(sk.arsivli AS INTEGER), 0) as arsivli,
                sk.arsivleme_tarih, sk.arsivleme_sebebi,
                sk.kaydi_duzenleyen, sk.created_at,
                sk.updated_at, sk.is_active,
                sk.partner_firma_adi, sk.partner_siparis_turu,
                ok.organizasyon_kart_tur as kart_tur, ok.organizasyon_kart_etiket as kart_etiket, ok.organizasyon_davetiye_gorsel,
                ok.organizasyon_teslimat_konumu, ok.organizasyon_teslim_kisisi, ok.organizasyon_teslim_kisisi_telefon,
                ok.organizasyon_mahalle, ok.organizasyon_acik_adres,
                ok.organizasyon_teslim_kisisi, ok.organizasyon_teslim_kisisi_telefon,
                ok.organizasyon_teslim_tarih, ok.organizasyon_teslim_saat
            FROM ${tableName} sk
            LEFT JOIN organizasyon_kartlar ok ON sk.organizasyon_kart_id = ok.id
            WHERE sk.status = 'aktif' 
                AND COALESCE(CAST(sk.arsivli AS INTEGER), 0) = 0
                AND (sk.is_active = 1 OR sk.is_active IS NULL)
            ORDER BY sk.created_at DESC
        `);

        siparisKartlari.forEach(normalizeSiparisMusteri);
        logger.info(`📦 ${siparisKartlari.length} sipariş kartı getirildi`);
        
        res.json({
            success: true,
            data: siparisKartlari,
            count: siparisKartlari.length
        });
    } catch (error) {
        logger.error('❌ Sipariş kartları getirme hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Sipariş kartları getirilemedi',
            error: error.message
        });
    }
});

// Belirli bir organizasyon kartına ait siparişleri getir
router.get('/organizasyon/:organizasyonId', async (req, res) => {
    try {
        const { organizasyonId } = req.params;
        console.log('🔍 GET /organizasyon/:organizasyonId çağrıldı:', organizasyonId);
        const db = await getDb();
        const { tableName, unvanSel, isimSel } = await getSiparisMusteriSelectParts(db);

        let siparisler = await db.query(`
            SELECT 
                sk.id, sk.kart_sira, sk.siparis_kodu, sk.organizasyon_kart_id, ${unvanSel}, ${isimSel},
                sk.siparis_veren_telefon, sk.urun_yazisi, sk.secilen_urun_yazi_dosyasi, sk.siparis_urun,
                sk.siparis_urun_id, sk.siparis_urun_aciklama, sk.urun_gorsel, sk.urun_gorsel as product_gorsel,
                sk.arac_randevu_saat, sk.arac_markamodel, sk.arac_renk, sk.arac_plaka,
                sk.siparis_tutari, sk.odeme_yontemi, sk.baglantili_siparisler, sk.ekstra_ucret_aciklama,
                sk.ekstra_ucret_tutari, sk.toplam_tutar, sk.teslim_kisisi, sk.teslim_kisisi_telefon,
                sk.teslim_il, sk.teslim_ilce, sk.teslim_mahalle, sk.teslim_acik_adres, sk.teslim_saat,
                sk.teslim_tarih, sk.notes, sk.status, 
                COALESCE(CAST(sk.arsivli AS INTEGER), 0) as arsivli,
                sk.arsivleme_tarih, sk.arsivleme_sebebi,
                sk.kaydi_duzenleyen, sk.created_at,
                sk.updated_at, sk.is_active,
                ok.organizasyon_kart_tur as kart_tur, ok.organizasyon_kart_etiket as kart_etiket, ok.organizasyon_davetiye_gorsel,
                ok.organizasyon_teslimat_konumu, ok.organizasyon_teslim_kisisi, ok.organizasyon_teslim_kisisi_telefon,
                ok.organizasyon_mahalle, ok.organizasyon_acik_adres,
                ok.organizasyon_teslim_tarih, ok.organizasyon_teslim_saat,
                p.urun_adi as gercek_urun_adi
            FROM ${tableName} sk
            LEFT JOIN organizasyon_kartlar ok ON sk.organizasyon_kart_id = ok.id
            LEFT JOIN products p ON sk.siparis_urun_id = p.id AND p.tenant_id = COALESCE(sk.tenant_id, ok.tenant_id)
            WHERE sk.organizasyon_kart_id = ? 
                AND sk.status = 'aktif' 
                AND COALESCE(CAST(sk.arsivli AS INTEGER), 0) = 0
                AND (sk.is_active = 1 OR sk.is_active IS NULL)
            ORDER BY 
                CASE WHEN sk.kart_sira IS NULL OR sk.kart_sira = 0 THEN 999999 ELSE sk.kart_sira END ASC,
                sk.created_at ASC
        `, [organizasyonId]);
        
        // Duplicate kontrolü - Aynı ID'ye sahip siparişleri filtrele
        const seenIds = new Set();
        const uniqueSiparisler = [];
        const duplicateIds = [];
        
        siparisler.forEach(siparis => {
            if (!siparis.id) {
                logger.warn(`⚠️ ID'si olmayan sipariş atlandı:`, siparis);
                return;
            }
            if (seenIds.has(siparis.id)) {
                duplicateIds.push(siparis.id);
                logger.warn(`⚠️ Duplicate sipariş tespit edildi ve filtrelendi: ID ${siparis.id}`);
            } else {
                seenIds.add(siparis.id);
                uniqueSiparisler.push(siparis);
            }
        });
        
        if (duplicateIds.length > 0) {
            logger.warn(`⚠️ Backend'den ${duplicateIds.length} duplicate sipariş tespit edildi ve filtrelendi:`, [...new Set(duplicateIds)]);
            console.warn(`⚠️ [BACKEND] Organizasyon ${organizasyonId} - Duplicate sipariş ID'leri:`, [...new Set(duplicateIds)]);
        }
        
        siparisler = uniqueSiparisler;
        siparisler.forEach(normalizeSiparisMusteri);

        logger.info(`📦 ${siparisler.length} sipariş kartı getirildi (Organizasyon ID: ${organizasyonId})`);
        
        // ✅ DEBUG: Arşivli sipariş kontrolü - DETAYLI
        console.log(`🔍 [BACKEND DEBUG] Organizasyon ${organizasyonId} - İlk sipariş örneği:`, siparisler.length > 0 ? {
            id: siparisler[0].id,
            musteri: siparisler[0].musteri_unvan || siparisler[0].musteri_isim_soyisim,
            arsivli: siparisler[0].arsivli,
            arsivli_tip: typeof siparisler[0].arsivli,
            arsivli_keys: Object.keys(siparisler[0]).filter(k => k.includes('arsiv'))
        } : 'Sipariş yok');
        
        const arsivliOlanlar = siparisler.filter(s => {
            const arsivli = s.arsivli;
            return arsivli === 1 || arsivli === '1' || arsivli === true || (typeof arsivli === 'string' && arsivli.trim() === '1');
        });
        if (arsivliOlanlar.length > 0) {
            logger.error(`❌ [BACKEND] SORUN: Organizasyon ${organizasyonId}'de ${arsivliOlanlar.length} arşivli sipariş var!`, arsivliOlanlar.map(s => `ID:${s.id} (arsivli:${s.arsivli})`));
            console.error(`❌ [BACKEND] SORUN: Organizasyon ${organizasyonId}'de ${arsivliOlanlar.length} arşivli sipariş var!`, arsivliOlanlar);
        }
        logger.info(`🔍 [BACKEND] Organizasyon ${organizasyonId} - Sipariş ID'leri:`, siparisler.map(s => `${s.id}(${s.arsivli !== undefined ? s.arsivli : 'UNDEFINED'})`).join(', '));
        console.log(`🔍 [BACKEND] Organizasyon ${organizasyonId} - Sipariş ID'leri:`, siparisler.map(s => `${s.id}(${s.arsivli !== undefined ? s.arsivli : 'UNDEFINED'})`).join(', '));
        
        // Araç süsleme siparişlerini kontrol et
        const aracSuslemeSiparisler = siparisler.filter(s => s.kart_tur === 'Araç Süsleme');
        if (aracSuslemeSiparisler.length > 0) {
            console.log('🚗 Backend - Araç süsleme siparişi araç bilgileri:', {
                id: aracSuslemeSiparisler[0].id,
                arac_markamodel: aracSuslemeSiparisler[0].arac_markamodel,
                arac_renk: aracSuslemeSiparisler[0].arac_renk,
                arac_plaka: aracSuslemeSiparisler[0].arac_plaka,
                arac_randevu_saat: aracSuslemeSiparisler[0].arac_randevu_saat
            });
        }
        
        // ChatGPT'nin önerisi: "alan düşüren" map'leri temizle
        // Eğer daha önce böyle bir şey yapıyorsan kaldır:
        // const safe = data.map(({ id, ...rest }) => ({ id })); // <-- SİL!
        
        res.json({
            success: true,
            data: siparisler,
            count: siparisler.length
        });
    } catch (error) {
        logger.error('❌ Sipariş kartları getirme hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Sipariş kartları getirilemedi',
            error: error.message
        });
    }
});

// Arşivlenmiş siparişleri listele (/:id'den ÖNCE olmalı!)
router.get('/archived', async (req, res) => {
    console.log('✅ /archived endpoint\'i çağrıldı!');
    try {
        const db = await getDb();
        console.log('✅ Database bağlantısı alındı');

        const siparisler = await db.query(`
            SELECT 
                sk.id,
                sk.organizasyon_kart_id,
                sk.kart_sira,
                sk.musteri_unvan,
                sk.musteri_isim_soyisim,
                sk.siparis_veren_telefon,
                sk.urun_yazisi,
                sk.urun_gorsel,
                sk.siparis_urun,
                sk.siparis_tutari,
                sk.ekstra_ucret_aciklama,
                sk.ekstra_ucret_tutari,
                sk.toplam_tutar,
                sk.odeme_yontemi,
                sk.teslim_imza_data,
                sk.partner_firma_adi,
                sk.partner_siparis_turu,
                COALESCE(CAST(sk.arsivli AS INTEGER), 0) as arsivli,
                sk.arsivleme_tarih,
                sk.arsivleme_sebebi,
                sk.teslim_tarih,
                sk.notes,
                sk.status,
                sk.kaydi_duzenleyen,
                sk.created_at,
                sk.updated_at,
                sk.is_active,
                ok.organizasyon_kart_tur as kart_tur,
                ok.organizasyon_kart_etiket as kart_etiket,
                ok.organizasyon_davetiye_gorsel,
                ok.organizasyon_teslimat_konumu,
                ok.organizasyon_teslim_kisisi,
                ok.organizasyon_teslim_kisisi_telefon,
                ok.organizasyon_teslim_tarih,
                ok.organizasyon_teslim_saat,
                ok.organizasyon_il,
                ok.organizasyon_ilce,
                ok.organizasyon_mahalle,
                ok.organizasyon_acik_adres
            FROM siparisler sk
            LEFT JOIN organizasyon_kartlar ok ON sk.organizasyon_kart_id = ok.id
            WHERE (sk.arsivli = 1 OR sk.arsivli = '1' OR CAST(sk.arsivli AS INTEGER) = 1)
                AND sk.status = 'aktif' 
                AND (sk.is_active = 1 OR sk.is_active IS NULL)
            ORDER BY sk.arsivleme_tarih DESC, sk.id DESC
        `);

        logger.info(`✅ Arşivlenmiş siparişler listelendi: ${siparisler.length} adet`);
        
        // ✅ DEBUG: Arşivli sipariş kontrolü
        if (siparisler.length > 0) {
            logger.info(`🔍 [BACKEND] Arşivli sipariş ID'leri:`, siparisler.map(s => `${s.id}(${s.musteri_unvan || s.musteri_isim_soyisim})`).join(', '));
        } else {
            logger.warn(`⚠️ [BACKEND] Arşivli sipariş bulunamadı! Sorgu: WHERE (sk.arsivli = 1 OR sk.arsivli = '1' OR CAST(sk.arsivli AS INTEGER) = 1)`);
        }

        res.json({
            success: true,
            data: siparisler,
            count: siparisler.length
        });
    } catch (error) {
        logger.error('❌ Arşivlenmiş siparişler listeleme hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Arşivlenmiş siparişler listelenemedi',
            error: error.message
        });
    }
});

// Belirli bir sipariş kartını getir
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await getDb();
        
        const siparisKarti = await db.query(`
            SELECT 
                sk.id, sk.kart_sira, sk.siparis_kodu, sk.organizasyon_kart_id, sk.musteri_unvan, sk.musteri_isim_soyisim,
                sk.siparis_veren_telefon, sk.urun_yazisi, sk.secilen_urun_yazi_dosyasi, sk.siparis_urun,
                sk.siparis_urun_aciklama, sk.urun_gorsel, sk.arac_randevu_saat, sk.arac_markamodel, sk.arac_renk, sk.arac_plaka,
                sk.siparis_tutari, sk.odeme_yontemi, sk.baglantili_siparisler, sk.ekstra_ucret_aciklama,
                sk.ekstra_ucret_tutari, sk.toplam_tutar, sk.teslim_kisisi, sk.teslim_kisisi_telefon,
                sk.teslim_il, sk.teslim_ilce, sk.teslim_mahalle, sk.teslim_acik_adres, sk.teslim_saat,
                sk.teslim_tarih, sk.notes, sk.status, 
                COALESCE(CAST(sk.arsivli AS INTEGER), 0) as arsivli,
                sk.arsivleme_tarih, sk.arsivleme_sebebi,
                sk.kaydi_duzenleyen, sk.created_at,
                sk.updated_at, sk.is_active,
                ok.organizasyon_kart_tur as kart_tur, ok.organizasyon_kart_etiket as kart_etiket, ok.organizasyon_davetiye_gorsel,
                ok.organizasyon_teslimat_konumu, ok.organizasyon_teslim_kisisi, ok.organizasyon_teslim_kisisi_telefon,
                ok.organizasyon_mahalle, ok.organizasyon_acik_adres,
                ok.organizasyon_teslim_kisisi, ok.organizasyon_teslim_kisisi_telefon,
                ok.organizasyon_teslim_tarih, ok.organizasyon_teslim_saat
            FROM siparisler sk
            LEFT JOIN organizasyon_kartlar ok ON sk.organizasyon_kart_id = ok.id
            WHERE sk.id = ? AND sk.status = 'aktif'
        `, [id]);

        if (siparisKarti.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Sipariş kartı bulunamadı'
            });
        }

        res.json({
            success: true,
            data: siparisKarti[0]
        });
    } catch (error) {
        logger.error('❌ Sipariş kartı getirme hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Sipariş kartı getirilemedi',
            error: error.message
        });
    }
});

// Yeni sipariş kartı oluştur
router.post('/', async (req, res) => {
    try {
        const db = await getDb();
        const {
            organizasyon_kart_id,
            musteri_unvan,
            musteri_isim_soyisim,
            siparis_veren_telefon,
            urun_yazisi,
            urun_gorsel,
            siparis_urun,
            siparis_urun_id,
            siparis_tutari,
            odeme_yontemi,
            baglantili_siparisler,
            ekstra_ucret_aciklama,
            ekstra_ucret_tutari,
            arac_markamodel,
            arac_renk,
            arac_plaka,
            arac_randevu_saat,
            partner_firma_adi,
            partner_siparis_turu,
            teslim_kisisi,
            teslim_kisisi_telefon,
            teslim_il,
            teslim_ilce,
            teslim_mahalle,
            teslim_acik_adres,
            teslim_saat,
            teslim_tarih
        } = req.body;

        // Toplam tutarı hesapla
        const toplamTutar = parseFloat(siparis_tutari || 0) + parseFloat(ekstra_ucret_tutari || 0);

        const result = await db.query(`
            INSERT INTO siparisler (
                organizasyon_kart_id, musteri_unvan, musteri_isim_soyisim, siparis_veren_telefon,
                urun_yazisi, urun_gorsel, siparis_urun, siparis_urun_id, siparis_tutari,
                odeme_yontemi, baglantili_siparisler, ekstra_ucret_aciklama,
                ekstra_ucret_tutari, toplam_tutar, arac_markamodel, arac_renk, arac_plaka, arac_randevu_saat,
                partner_firma_adi, partner_siparis_turu,
                teslim_kisisi, teslim_kisisi_telefon, teslim_il, teslim_ilce, teslim_mahalle, teslim_acik_adres,
                teslim_saat, teslim_tarih,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
            organizasyon_kart_id, musteri_unvan, musteri_isim_soyisim, siparis_veren_telefon,
            urun_yazisi, urun_gorsel, siparis_urun, siparis_urun_id || null, siparis_tutari,
            odeme_yontemi, baglantili_siparisler, ekstra_ucret_aciklama,
            ekstra_ucret_tutari, toplamTutar, arac_markamodel, arac_renk, arac_plaka, arac_randevu_saat,
            partner_firma_adi || null, partner_siparis_turu || null,
            teslim_kisisi || null, teslim_kisisi_telefon || null, teslim_il || null, teslim_ilce || null,
            teslim_mahalle || null, teslim_acik_adres || null, teslim_saat || null, teslim_tarih || null
        ]);

        // Organizasyon kartındaki sipariş sayısını güncelle
        await db.query(`
            UPDATE organizasyon_kartlar SET
                toplam_siparis_sayisi = (
                    SELECT COUNT(*) FROM siparisler 
                    WHERE organizasyon_kart_id = ? 
                        AND status = 'aktif' 
                        AND COALESCE(CAST(arsivli AS INTEGER), 0) = 0
                        AND (is_active = 1 OR is_active IS NULL)
                ),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [organizasyon_kart_id, organizasyon_kart_id]);

        logger.info(`✅ Yeni sipariş kartı oluşturuldu: ID ${result.lastID}`);

        res.status(201).json({
            success: true,
            message: 'Sipariş kartı başarıyla oluşturuldu',
            data: {
                id: result.lastID,
                organizasyon_kart_id,
                musteri_unvan,
                musteri_isim_soyisim,
                siparis_veren_telefon,
                urun_yazisi,
                urun_gorsel,
                siparis_urun,
                siparis_tutari,
                odeme_yontemi,
                baglantili_siparisler
            }
        });
    } catch (error) {
        logger.error('❌ Sipariş kartı oluşturma hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Sipariş kartı oluşturulamadı',
            error: error.message
        });
    }
});

// Sipariş kartını güncelle
router.put('/:id', async (req, res) => {
    try {
        const db = await getDb();
        const { id } = req.params;
        const {
            musteri_unvan,
            musteri_isim_soyisim,
            siparis_veren_telefon,
            urun_yazisi,
            urun_gorsel,
            siparis_urun,
            siparis_urun_id,
            siparis_tutari,
            odeme_yontemi,
            baglantili_siparisler,
            ekstra_ucret_aciklama,
            ekstra_ucret_tutari,
            arac_markamodel,
            arac_renk,
            arac_plaka,
            arac_randevu_saat,
            partner_firma_adi,
            partner_siparis_turu,
            teslim_kisisi,
            teslim_kisisi_telefon,
            teslim_il,
            teslim_ilce,
            teslim_mahalle,
            teslim_acik_adres,
            teslim_saat,
            teslim_tarih
        } = req.body;

        // Toplam tutarı hesapla
        const toplamTutar = parseFloat(siparis_tutari || 0) + parseFloat(ekstra_ucret_tutari || 0);

        const result = await db.query(`
            UPDATE siparisler SET
                musteri_unvan = ?, musteri_isim_soyisim = ?, siparis_veren_telefon = ?, urun_yazisi = ?,
                urun_gorsel = ?, siparis_urun = ?, siparis_urun_id = ?, siparis_tutari = ?,
                odeme_yontemi = ?, baglantili_siparisler = ?, ekstra_ucret_aciklama = ?,
                ekstra_ucret_tutari = ?, toplam_tutar = ?, 
                arac_markamodel = ?, arac_renk = ?, arac_plaka = ?, arac_randevu_saat = ?,
                partner_firma_adi = ?, partner_siparis_turu = ?,
                teslim_kisisi = ?, teslim_kisisi_telefon = ?, teslim_il = ?, teslim_ilce = ?,
                teslim_mahalle = ?, teslim_acik_adres = ?, teslim_saat = ?, teslim_tarih = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'aktif'
        `, [
            musteri_unvan, musteri_isim_soyisim, siparis_veren_telefon, urun_yazisi, urun_gorsel,
            siparis_urun, siparis_urun_id || null, siparis_tutari, odeme_yontemi, baglantili_siparisler,
            ekstra_ucret_aciklama, ekstra_ucret_tutari, toplamTutar, 
            arac_markamodel, arac_renk, arac_plaka, arac_randevu_saat,
            partner_firma_adi || null, partner_siparis_turu || null,
            teslim_kisisi || null, teslim_kisisi_telefon || null, teslim_il || null, teslim_ilce || null,
            teslim_mahalle || null, teslim_acik_adres || null, teslim_saat || null, teslim_tarih || null,
            id
        ]);

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'Sipariş kartı bulunamadı'
            });
        }

        logger.info(`✅ Sipariş kartı güncellendi: ID ${id}`);

        res.json({
            success: true,
            message: 'Sipariş kartı başarıyla güncellendi'
        });
    } catch (error) {
        logger.error('❌ Sipariş kartı güncelleme hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Sipariş kartı güncellenemedi',
            error: error.message
        });
    }
});

// Sipariş kartını teslim edildi olarak işaretle
router.patch('/:id/deliver', async (req, res) => {
    try {
        const db = await getDb();
        const { id } = req.params;
        const siparisTable = (await getSiparisMusteriSelectParts(db)).tableName;

        const siparisBilgileri = await db.query(`
            SELECT sk.id, sk.organizasyon_kart_id, sk.musteri_unvan, sk.musteri_isim_soyisim,
                   sk.siparis_urun, sk.urun_gorsel, sk.teslim_kisisi, sk.siparis_teslim_kisisi_baskasi,
                   ok.organizasyon_kart_tur, ok.organizasyon_kart_etiket
            FROM ${siparisTable} sk
            LEFT JOIN organizasyon_kartlar ok ON sk.organizasyon_kart_id = ok.id
            WHERE sk.id = ? AND sk.status = 'aktif'
        `, [id]);
        let result = { changes: 0 };
        if (siparisBilgileri.length > 0) {
            result = await db.run(`
                UPDATE ${siparisTable} SET
                    teslim_edildi = 1,
                    teslim_edildi_tarih = CURRENT_TIMESTAMP,
                    arsivli = 1,
                    arsivleme_tarih = datetime('now', 'localtime'),
                    arsivleme_sebebi = 'Teslim Edildi',
                    teslim_imza_data = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND status = 'aktif'
            `, [id]);
        }
        if (!result || result.changes === 0) {
            const cicekExists = await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='organizasyon_siparisler_ciceksepeti'");
            if (cicekExists && cicekExists.length > 0) {
                const cicekResult = await db.run(`
                    UPDATE organizasyon_siparisler_ciceksepeti SET
                        arsivli = 1,
                        arsivleme_tarih = datetime('now', 'localtime'),
                        arsivleme_sebebi = 'Teslim Edildi',
                        updated_at = datetime('now', 'localtime')
                    WHERE id = ? AND (COALESCE(arsivli, 0) = 0)
                `, [id]);
                if (cicekResult && cicekResult.changes > 0) {
                    try {
                        await db.run(`UPDATE ${siparisTable} SET arsivli = 1, arsivleme_tarih = datetime('now', 'localtime'), arsivleme_sebebi = 'Teslim Edildi', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
                    } catch (_) {}
                    return res.json({ success: true, message: 'Sipariş kartı teslim edildi olarak işaretlendi' });
                }
            }
            return res.status(404).json({
                success: false,
                message: 'Sipariş kartı bulunamadı'
            });
        }

        // Bildirim oluştur
        try {
            // Kullanıcı adını al (cookie'den veya req'den)
            let kullaniciAdi = null;
            if (req && req.cookies && req.cookies.floovon_user_id) {
                const userId = parseInt(req.cookies.floovon_user_id);
                if (!isNaN(userId) && userId > 0) {
                    const user = await db.query(
                        'SELECT username, kullaniciadi FROM users WHERE id = ? AND is_active = 1',
                        [userId]
                    );
                    if (user.length > 0) {
                        kullaniciAdi = user[0].username || user[0].kullaniciadi;
                    }
                }
            }
            if (!kullaniciAdi && req && req.user) {
                kullaniciAdi = req.user.username || req.user.kullaniciadi;
            }

            if (kullaniciAdi && siparisBilgileri.length > 0) {
                const siparis = siparisBilgileri[0];
                // Bildirim tablosunu kontrol et
                const tableExists = await db.query(`
                    SELECT name FROM sqlite_master WHERE type='table' AND name='bildirimler'
                `);
                
                if (tableExists.length > 0) {
                    await db.query(`
                        INSERT INTO bildirimler (
                            kullanici_adi, tip, baslik, mesaj,
                            musteri_unvani, teslim_kisisi, siparis_adi, organizasyon_adi,
                            organizasyon_alt_tur, siparis_teslim_kisisi_baskasi, urun_resmi,
                            siparis_id, organizasyon_id, arsivleme_sebebi,
                            is_read, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
                    `, [
                        kullaniciAdi,
                        'teslim_edildi',
                        'Sipariş Teslim Edildi',
                        `${siparis.musteri_unvan || siparis.musteri_isim_soyisim || 'Müşteri'} siparişi teslim edildi`,
                        siparis.musteri_unvan || null,
                        siparis.teslim_kisisi || null,
                        siparis.siparis_urun || null,
                        siparis.organizasyon_kart_tur || null,
                        siparis.organizasyon_kart_etiket || null,
                        siparis.siparis_teslim_kisisi_baskasi || null,
                        siparis.urun_gorsel || null,
                        id,
                        siparis.organizasyon_kart_id || null,
                        'Teslim Edildi'
                    ]);
                    logger.info(`✅ Teslim bildirimi oluşturuldu: Sipariş ID ${id}, Kullanıcı: ${kullaniciAdi}`);
                }
            }
        } catch (bildirimError) {
            logger.error('❌ Bildirim oluşturma hatası (teslim):', bildirimError);
            // Bildirim hatası sipariş işlemini engellemesin
        }

        logger.info(`✅ Sipariş kartı teslim edildi olarak işaretlendi: ID ${id}`);

        res.json({
            success: true,
            message: 'Sipariş kartı teslim edildi olarak işaretlendi'
        });
    } catch (error) {
        logger.error('❌ Sipariş kartı teslim işaretleme hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Sipariş kartı teslim işaretlenemedi',
            error: error.message
        });
    }
});

// Sipariş kartını arşivle – siparişler/siparis_kartlar tablosuna yaz (GET listesi ile aynı tablo)
router.patch('/:id/archive', async (req, res) => {
    try {
        const db = await getDb();
        const { id } = req.params;
        const { arsivleme_sebebi } = req.body;

        const { tableName } = await getSiparisMusteriSelectParts(db);
        const siparisTable = tableName;

        // Önce sipariş kartının var olup olmadığını kontrol et ve bilgilerini al
        const mevcutSiparis = await db.query(`
            SELECT sk.id, sk.musteri_unvan, sk.musteri_isim_soyisim, sk.siparis_urun, 
                   sk.urun_gorsel, sk.teslim_kisisi, sk.siparis_teslim_kisisi_baskasi,
                   sk.organizasyon_kart_id,
                   ok.organizasyon_kart_tur, ok.organizasyon_kart_etiket
            FROM ${siparisTable} sk
            LEFT JOIN organizasyon_kartlar ok ON sk.organizasyon_kart_id = ok.id
            WHERE sk.id = ? AND sk.status = 'aktif'
        `, [id]);

        if (mevcutSiparis.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Sipariş kartı bulunamadı'
            });
        }

        const siparisBilgileri = mevcutSiparis[0];

        // UPDATE işlemini yap - arsivli = 1 olarak ayarla (siparisler/siparis_kartlar tablosuna yazıyoruz)
        const { teslim_imza_data } = req.body;
        
        logger.info('📝 [ARŞİVLEME] İmza verisi alındı:', {
            siparisId: id,
            hasImzaData: !!teslim_imza_data,
            imzaDataLength: teslim_imza_data ? teslim_imza_data.length : 0,
            imzaDataPreview: teslim_imza_data ? teslim_imza_data.substring(0, 50) + '...' : null
        });
        
        const updateResult = await db.query(`
            UPDATE ${siparisTable} SET
                arsivli = 1, 
                arsivleme_tarih = datetime('now', 'localtime'),
                arsivleme_sebebi = ?,
                teslim_imza_data = ?,
                updated_at = datetime('now', 'localtime')
            WHERE id = ? 
                AND status = 'aktif'
                AND (CAST(arsivli AS INTEGER) = 0 OR arsivli IS NULL OR arsivli = '0' OR arsivli = '')
        `, [arsivleme_sebebi || null, teslim_imza_data || null, id]);
        
        logger.info('✅ [ARŞİVLEME] Sipariş arşivlendi:', {
            siparisId: id,
            table: siparisTable,
            changes: updateResult.changes || 0,
            hasImzaData: !!teslim_imza_data
        });
        
        const kontrolSonucu = await db.query(`
            SELECT id, arsivli, status, is_active FROM ${siparisTable} WHERE id = ?
        `, [id]);
        logger.info(`🔍 UPDATE sonrası kontrol:`, kontrolSonucu[0]);
        
        logger.info(`📝 UPDATE sonucu:`, {
            siparisId: id,
            changes: updateResult?.changes,
            lastID: updateResult?.lastID,
            arsivleme_sebebi: arsivleme_sebebi || null
        });
        
        if (!updateResult || (updateResult.changes !== undefined && updateResult.changes === 0)) {
            logger.warn(`⚠️ Sipariş kartı güncellenemedi: ID ${id} - Tablo: ${siparisTable}, Changes: ${updateResult?.changes}`);
            return res.status(400).json({
                success: false,
                message: 'Sipariş kartı güncellenemedi. Sipariş zaten arşivlenmiş olabilir veya bulunamadı.',
                error: `UPDATE changes: ${updateResult?.changes || 0}`
            });
        } else {
            logger.info(`✅ Sipariş kartı başarıyla arşivlendi: ID ${id} - Tablo: ${siparisTable}, Changes: ${updateResult.changes}`);
        }

        // Organizasyon kartındaki sipariş sayısını güncelle
        const siparisKarti = await db.query(`
            SELECT organizasyon_kart_id FROM ${siparisTable} WHERE id = ?
        `, [id]);

        if (siparisKarti.length > 0) {
            await db.query(`
                UPDATE organizasyon_kartlar SET
                    toplam_siparis_sayisi = (
                        SELECT COUNT(*) FROM ${siparisTable} 
                        WHERE organizasyon_kart_id = ? 
                            AND status = 'aktif' 
                            AND COALESCE(CAST(arsivli AS INTEGER), 0) = 0
                            AND (is_active = 1 OR is_active IS NULL)
                    ),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [siparisKarti[0].organizasyon_kart_id, siparisKarti[0].organizasyon_kart_id]);
        }

        // Bildirim oluştur
        try {
            // Kullanıcı adını al (cookie'den veya req'den)
            let kullaniciAdi = null;
            if (req && req.cookies && req.cookies.floovon_user_id) {
                const userId = parseInt(req.cookies.floovon_user_id);
                if (!isNaN(userId) && userId > 0) {
                    const user = await db.query(
                        'SELECT username, kullaniciadi FROM users WHERE id = ? AND is_active = 1',
                        [userId]
                    );
                    if (user.length > 0) {
                        kullaniciAdi = user[0].username || user[0].kullaniciadi;
                    }
                }
            }
            if (!kullaniciAdi && req && req.user) {
                kullaniciAdi = req.user.username || req.user.kullaniciadi;
            }

            if (kullaniciAdi) {
                // Bildirim tablosunu kontrol et
                const tableExists = await db.query(`
                    SELECT name FROM sqlite_master WHERE type='table' AND name='bildirimler'
                `);
                
                if (tableExists.length > 0) {
                    const { teslim_kisisi, siparis_teslim_kisisi_baskasi } = req.body;
                    await db.query(`
                        INSERT INTO bildirimler (
                            kullanici_adi, tip, baslik, mesaj,
                            musteri_unvani, teslim_kisisi, siparis_adi, organizasyon_adi,
                            organizasyon_alt_tur, siparis_teslim_kisisi_baskasi, urun_resmi,
                            siparis_id, organizasyon_id, arsivleme_sebebi,
                            is_read, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
                    `, [
                        kullaniciAdi,
                        'arsivlendi',
                        'Sipariş Arşivlendi',
                        `${siparisBilgileri.musteri_unvan || siparisBilgileri.musteri_isim_soyisim || 'Müşteri'} siparişi arşivlendi`,
                        siparisBilgileri.musteri_unvan || null,
                        teslim_kisisi || siparisBilgileri.teslim_kisisi || null,
                        siparisBilgileri.siparis_urun || null,
                        siparisBilgileri.organizasyon_kart_tur || null,
                        siparisBilgileri.organizasyon_kart_etiket || null,
                        siparis_teslim_kisisi_baskasi || siparisBilgileri.siparis_teslim_kisisi_baskasi || null,
                        siparisBilgileri.urun_gorsel || null,
                        id,
                        siparisBilgileri.organizasyon_kart_id || null,
                        arsivleme_sebebi || null
                    ]);
                    logger.info(`✅ Arşivleme bildirimi oluşturuldu: Sipariş ID ${id}, Kullanıcı: ${kullaniciAdi}`);
                }
            }
        } catch (bildirimError) {
            logger.error('❌ Bildirim oluşturma hatası (arşivleme):', bildirimError);
            // Bildirim hatası sipariş işlemini engellemesin
        }

        logger.info(`✅ Sipariş kartı arşivlendi: ID ${id}`);

        res.json({
            success: true,
            message: 'Sipariş kartı başarıyla arşivlendi'
        });
    } catch (error) {
        logger.error('❌ Sipariş kartı arşivleme hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Sipariş kartı arşivlenemedi',
            error: error.message
        });
    }
});

// Sipariş kartını arşivden geri yükle
router.patch('/:id/unarchive', async (req, res) => {
    try {
        const db = await getDb();
        const { id } = req.params;
        const { tableName: siparisTable } = await getSiparisMusteriSelectParts(db);

        const mevcutSiparis = await db.query(`
            SELECT id, organizasyon_kart_id FROM ${siparisTable} 
            WHERE id = ? AND status = 'aktif' AND CAST(arsivli AS INTEGER) = 1
        `, [id]);

        if (mevcutSiparis.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Arşivlenmiş sipariş kartı bulunamadı'
            });
        }

        // UPDATE işlemini yap – geri yüklenen siparişin eski teslim imzasını temizle (tekrar teslim edildiğinde eski imza tooltip’te görünmesin)
        const updateResult = await db.query(`
            UPDATE ${siparisTable} SET
                arsivli = 0, 
                arsivleme_tarih = NULL,
                arsivleme_sebebi = NULL,
                teslim_imza_data = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'aktif'
        `, [id]);
        
        // UPDATE sonucunu kontrol et
        if (!updateResult || (updateResult.changes !== undefined && updateResult.changes === 0)) {
            logger.warn(`⚠️ Sipariş kartı geri yüklenemedi: ID ${id}`);
        }

        // Organizasyon kartındaki sipariş sayısını güncelle ve is_active'i 1 yap
        const organizasyonKartId = mevcutSiparis[0].organizasyon_kart_id;
        if (organizasyonKartId) {
            // Önce organizasyon kartının durumunu kontrol et
            const organizasyonKart = await db.query(`
                SELECT id, is_active, status, arsivli FROM organizasyon_kartlar WHERE id = ?
            `, [organizasyonKartId]);
            
            if (organizasyonKart.length > 0) {
                const orgKart = organizasyonKart[0];
                // Eğer organizasyon kartı arşivliyse (is_active=0 veya arsivli=1) ve sipariş geri yükleniyorsa
                // organizasyon kartını da aktif yap
                if (orgKart.is_active === 0 || orgKart.arsivli === 1) {
                    await db.query(`
                        UPDATE organizasyon_kartlar SET
                            is_active = 1,
                            arsivli = 0,
                            status = 'aktif',
                            arsivleme_tarih = NULL,
                            arsivleme_sebebi = NULL,
                            toplam_siparis_sayisi = (
                                SELECT COUNT(*) FROM ${siparisTable} 
                                WHERE organizasyon_kart_id = ? AND status = 'aktif' AND COALESCE(CAST(arsivli AS INTEGER), 0) = 0
                            ),
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `, [organizasyonKartId, organizasyonKartId]);
                } else {
                    await db.query(`
                        UPDATE organizasyon_kartlar SET
                            toplam_siparis_sayisi = (
                                SELECT COUNT(*) FROM ${siparisTable} 
                                WHERE organizasyon_kart_id = ? AND status = 'aktif' AND COALESCE(CAST(arsivli AS INTEGER), 0) = 0
                            ),
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `, [organizasyonKartId, organizasyonKartId]);
                }
            }
        }

        logger.info(`✅ Sipariş kartı arşivden geri yüklendi: ID ${id}`);

        res.json({
            success: true,
            message: 'Sipariş kartı başarıyla arşivden geri yüklendi'
        });
    } catch (error) {
        logger.error('❌ Sipariş kartı geri yükleme hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Sipariş kartı geri yüklenemedi',
            error: error.message
        });
    }
});


// Sipariş kartını sil
router.delete('/:id', async (req, res) => {
    try {
        const db = await getDb();
        const { id } = req.params;

        // Önce sipariş kartının organizasyon ID'sini al
        const siparisKarti = await db.query(`
            SELECT organizasyon_kart_id FROM siparisler WHERE id = ?
        `, [id]);

        if (siparisKarti.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Sipariş kartı bulunamadı'
            });
        }

        const organizasyonKartId = siparisKarti[0].organizasyon_kart_id;

        // Sipariş kartını sil
        const result = await db.query(`
            UPDATE siparisler SET
                status = 'silindi', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [id]);

        // Organizasyon kartındaki sipariş sayısını güncelle
        await db.query(`
            UPDATE organizasyon_kartlar SET
                toplam_siparis_sayisi = (
                    SELECT COUNT(*) FROM siparisler 
                    WHERE organizasyon_kart_id = ? AND status = 'aktif' 
                        AND COALESCE(CAST(arsivli AS INTEGER), 0) = 0
                ),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [organizasyonKartId, organizasyonKartId]);

        logger.info(`✅ Sipariş kartı silindi: ID ${id}`);

        res.json({
            success: true,
            message: 'Sipariş kartı başarıyla silindi'
        });
    } catch (error) {
        logger.error('❌ Sipariş kartı silme hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Sipariş kartı silinemedi',
            error: error.message
        });
    }
});

// Kart-sıra güncelleme endpoint'i
router.put('/update-kart-sira', async (req, res) => {
    try {
        const db = await getDb();
        const { organizasyon_kart_id, siparis_updates } = req.body || {};

        if (!organizasyon_kart_id || !Array.isArray(siparis_updates)) {
            return res.status(400).json({ success: false, message: 'Eksik veya hatalı parametreler' });
        }

        const parseOrderId = (rawId) => {
            if (typeof rawId === 'number') return rawId;
            if (typeof rawId !== 'string') return null;
            const match = rawId.match(/(\d+)/);
            return match ? parseInt(match[1], 10) : null;
        };

        // Geçerli güncellemeleri hazırla
        const validUpdates = siparis_updates
            .map(u => ({ id: parseOrderId(u.siparis_id), sira: parseInt(u.kart_sira, 10) || 0 }))
            .filter(u => Number.isInteger(u.id) && u.id > 0 && Number.isInteger(u.sira) && u.sira > 0);

        if (validUpdates.length === 0) {
            return res.json({ success: true, message: 'Güncellenecek kayıt yok', updated_count: 0 });
        }

        const result = await transaction(async (db) => {
            let updated = 0;
            for (const u of validUpdates) {
                const r = await db.query(
                    `UPDATE siparisler 
                     SET kart_sira = ?, updated_at = CURRENT_TIMESTAMP 
                     WHERE id = ? AND organizasyon_kart_id = ? AND status = 'aktif'`,
                    [u.sira, u.id, organizasyon_kart_id]
                );
                updated += (r.changes || 0);
            }
            return updated;
        });

        return res.json({ success: true, message: 'Sipariş kartı başarıyla güncellendi', updated_count: result });
    } catch (error) {
        console.error('❌ Kart-sıra güncelleme hatası:', error);
        return res.status(500).json({ success: false, message: 'Kart-sıra güncelleme başarısız', error: error.message });
    }
});

// DEBUG: Veritabanındaki tüm arşivli siparişleri listele (test için)
// Tüm organizasyon kartlarının tarihlerini listele (DEBUG)
router.get('/debug/all-dates', async (req, res) => {
    try {
        const db = await getDb();
        
        const allDates = await db.query(`
            SELECT 
                ok.id as organizasyon_id,
                ok.organizasyon_kart_etiket,
                ok.organizasyon_kart_tur,
                ok.organizasyon_teslim_tarih as org_teslim_tarih,
                ok.organizasyon_teslim_saat as org_teslim_saat,
                COUNT(sk.id) as siparis_sayisi,
                GROUP_CONCAT(
                    sk.id || ':' || COALESCE(sk.teslim_tarih, 'NULL') || ':' || COALESCE(sk.musteri_isim_soyisim, sk.musteri_unvan, 'Bilinmeyen'),
                    ' | '
                ) as siparisler
            FROM organizasyon_kartlar ok
            LEFT JOIN siparisler sk ON ok.id = sk.organizasyon_kart_id
            WHERE ok.status = 'aktif' 
                AND (ok.is_active = 1 OR ok.is_active IS NULL)
            GROUP BY ok.id, ok.organizasyon_kart_etiket, ok.organizasyon_kart_tur, ok.organizasyon_teslim_tarih, ok.organizasyon_teslim_saat
            ORDER BY ok.organizasyon_teslim_tarih DESC, ok.id DESC
        `);
        
        // Ayrıca tüm sipariş kartlarının tarihlerini de getir
        const allSiparisDates = await db.query(`
            SELECT 
                sk.id as siparis_id,
                sk.organizasyon_kart_id,
                sk.teslim_tarih,
                sk.teslim_saat,
                sk.musteri_isim_soyisim,
                sk.musteri_unvan,
                ok.organizasyon_kart_etiket,
                ok.organizasyon_kart_tur,
                ok.organizasyon_teslim_tarih as org_teslim_tarih
            FROM siparisler sk
            LEFT JOIN organizasyon_kartlar ok ON sk.organizasyon_kart_id = ok.id
            WHERE sk.status = 'aktif' 
                AND COALESCE(CAST(sk.arsivli AS INTEGER), 0) = 0
                AND (sk.is_active = 1 OR sk.is_active IS NULL)
            ORDER BY sk.teslim_tarih DESC, sk.id DESC
        `);
        
        logger.info(`📅 ${allDates.length} organizasyon kartı tarihi listelendi`);
        logger.info(`📦 ${allSiparisDates.length} sipariş kartı tarihi listelendi`);
        
        res.json({
            success: true,
            organizasyon_kartlari: allDates,
            siparisleri: allSiparisDates,
            summary: {
                toplam_organizasyon: allDates.length,
                toplam_siparis: allSiparisDates.length,
                tarihli_organizasyon: allDates.filter(d => d.org_teslim_tarih).length,
                tarihli_siparis: allSiparisDates.filter(s => s.teslim_tarih).length
            }
        });
    } catch (error) {
        logger.error('❌ Tarih listeleme hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Tarihler listelenemedi',
            error: error.message
        });
    }
});

router.get('/debug/archived-all', async (req, res) => {
    try {
        const db = await getDb();
        
        // Tüm arşivli siparişleri getir (filtreleme olmadan)
        const tumArsivliSiparisler = await db.query(`
            SELECT 
                sk.id,
                sk.organizasyon_kart_id,
                sk.musteri_unvan,
                sk.musteri_isim_soyisim,
                sk.siparis_urun,
                sk.arsivli,
                typeof(sk.arsivli) as arsivli_tip,
                sk.arsivleme_tarih,
                sk.arsivleme_sebebi,
                sk.status,
                sk.is_active,
                ok.organizasyon_kart_tur as kart_tur
            FROM siparisler sk
            LEFT JOIN organizasyon_kartlar ok ON sk.organizasyon_kart_id = ok.id
            WHERE sk.status = 'aktif'
            ORDER BY sk.id DESC
        `);
        
        // Arşivli olanları filtrele (frontend'de)
        const arsivliOlanlar = tumArsivliSiparisler.filter(s => {
            const arsivli = s.arsivli;
            return arsivli === 1 || arsivli === '1' || arsivli === true || (typeof arsivli === 'string' && arsivli.trim() === '1');
        });
        
        logger.info(`🔍 DEBUG: Toplam ${tumArsivliSiparisler.length} sipariş, ${arsivliOlanlar.length} tanesi arşivli`);
        
        res.json({
            success: true,
            message: 'Debug: Tüm siparişler ve arşivli olanlar',
            data: {
                toplam_siparis: tumArsivliSiparisler.length,
                arsivli_siparis_sayisi: arsivliOlanlar.length,
                arsivli_siparisler: arsivliOlanlar,
                tum_siparisler: tumArsivliSiparisler.map(s => ({
                    id: s.id,
                    musteri: s.musteri_unvan || s.musteri_isim_soyisim,
                    urun: s.siparis_urun,
                    arsivli: s.arsivli,
                    arsivli_tip: s.arsivli_tip,
                    arsivleme_tarih: s.arsivleme_tarih,
                    arsivleme_sebebi: s.arsivleme_sebebi,
                    status: s.status
                }))
            }
        });
    } catch (error) {
        logger.error('❌ Debug endpoint hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Debug endpoint hatası',
            error: error.message
        });
    }
});

module.exports = router;