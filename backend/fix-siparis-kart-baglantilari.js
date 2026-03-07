/**
 * NULL organizasyon_kart_id olan siparişleri doğru kartlara bağla
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'floovon_professional.db');

function query(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function execute(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes, lastID: this.lastID });
        });
    });
}

async function fixSiparisKartBaglantilari() {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
            console.error('❌ Veritabanı açılamadı:', err);
            process.exit(1);
        }
    });

    console.log('🔧 Sipariş-Kart Bağlantılarını Düzeltiyorum...\n');

    try {
        // NULL organizasyon_kart_id olan siparişler
        const nullSiparisler = await query(db, `
            SELECT 
                sk.id,
                sk.teslim_tarih,
                sk.created_at
            FROM siparis_kartlar sk
            WHERE sk.organizasyon_kart_id IS NULL
                AND sk.status = 'aktif'
                AND COALESCE(CAST(sk.arsivli AS INTEGER), 0) = 0
            ORDER BY sk.id
        `);

        console.log(`NULL organizasyon_kart_id olan sipariş sayısı: ${nullSiparisler.length}\n`);

        if (nullSiparisler.length === 0) {
            console.log('✅ Düzeltilecek sipariş yok!');
            db.close();
            return;
        }

        // Her sipariş için en uygun kartı bul (teslim tarihine göre)
        for (const siparis of nullSiparisler) {
            if (!siparis.teslim_tarih) {
                console.log(`⚠️  Sipariş ID ${siparis.id}: Teslim tarihi yok, atlanıyor`);
                continue;
            }

            // Aynı teslim tarihine sahip kartları bul
            const uygunKartlar = await query(db, `
                SELECT 
                    ok.id,
                    ok.organizasyon_kart_tur,
                    ok.organizasyon_kart_etiket,
                    ok.organizasyon_teslim_tarih,
                    COUNT(sk2.id) as mevcut_siparis_sayisi
                FROM organizasyon_kartlar ok
                LEFT JOIN siparis_kartlar sk2 ON ok.id = sk2.organizasyon_kart_id 
                    AND sk2.status = 'aktif' 
                    AND COALESCE(CAST(sk2.arsivli AS INTEGER), 0) = 0
                WHERE ok.organizasyon_status = 'aktif' 
                    AND ok.is_active = 1 
                    AND COALESCE(CAST(ok.arsivli AS INTEGER), 0) = 0
                    AND ok.organizasyon_teslim_tarih = ?
                GROUP BY ok.id
                ORDER BY mevcut_siparis_sayisi ASC, ok.id ASC
                LIMIT 1
            `, [siparis.teslim_tarih]);

            if (uygunKartlar.length > 0) {
                const kart = uygunKartlar[0];
                console.log(`✅ Sipariş ID ${siparis.id} → Kart ID ${kart.id} (${kart.organizasyon_kart_tur}) - Tarih: ${siparis.teslim_tarih}`);
                
                // Siparişi karta bağla
                await execute(db, `
                    UPDATE siparis_kartlar 
                    SET organizasyon_kart_id = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [kart.id, siparis.id]);
            } else {
                console.log(`⚠️  Sipariş ID ${siparis.id}: Uygun kart bulunamadı (Tarih: ${siparis.teslim_tarih})`);
            }
        }

        console.log('\n✅ Düzeltme tamamlandı!');
        
        // Sonuçları kontrol et
        const sonuc = await query(db, `
            SELECT 
                ok.id as kart_id,
                ok.organizasyon_kart_tur,
                COUNT(sk.id) as siparis_sayisi
            FROM organizasyon_kartlar ok
            LEFT JOIN siparis_kartlar sk ON ok.id = sk.organizasyon_kart_id 
                AND sk.status = 'aktif' 
                AND COALESCE(CAST(sk.arsivli AS INTEGER), 0) = 0
            WHERE ok.organizasyon_kart_tur IN ('Özel Sipariş', 'Özel Gün', 'Araç Süsleme')
                AND ok.organizasyon_status = 'aktif' 
                AND ok.is_active = 1 
                AND COALESCE(CAST(ok.arsivli AS INTEGER), 0) = 0
            GROUP BY ok.id
            ORDER BY ok.id
        `);

        console.log('\n=== DÜZELTME SONRASI DURUM ===');
        sonuc.forEach(kart => {
            console.log(`Kart ID ${kart.kart_id} (${kart.organizasyon_kart_tur}): ${kart.siparis_sayisi} sipariş`);
        });

        db.close((err) => {
            if (err) {
                console.error('❌ Veritabanı kapatılırken hata:', err);
            }
        });
    } catch (error) {
        console.error('❌ Hata:', error);
        db.close();
        process.exit(1);
    }
}

fixSiparisKartBaglantilari();

