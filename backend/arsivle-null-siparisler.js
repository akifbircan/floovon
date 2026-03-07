/**
 * Verileri NULL olan siparişleri arşivle
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'floovon_professional.db');

function execute(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes, lastID: this.lastID });
        });
    });
}

async function arsivleNullSiparisler() {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
            console.error('❌ Veritabanı açılamadı:', err);
            process.exit(1);
        }
    });

    console.log('🗑️  Verileri NULL olan siparişleri arşivliyorum...\n');

    try {
        // Verileri tamamen NULL olan siparişleri arşivle
        const result = await execute(db, `
            UPDATE siparis_kartlar 
            SET arsivli = 1,
                arsivleme_tarih = CURRENT_TIMESTAMP,
                arsivleme_sebebi = 'Veri eksikliği - tüm veriler NULL',
                updated_at = CURRENT_TIMESTAMP
            WHERE organizasyon_kart_id IS NULL
                AND status = 'aktif'
                AND COALESCE(CAST(arsivli AS INTEGER), 0) = 0
                AND musteri_unvan IS NULL
                AND musteri_isim_soyisim IS NULL
                AND siparis_urun IS NULL
                AND urun_yazisi IS NULL
        `);

        console.log(`✅ ${result.changes} sipariş arşivlendi!`);
        console.log('\n✅ Tamamlandı! Artık bu siparişler görünmeyecek.');
        console.log('💡 Yeni siparişler oluştururken organizasyon kartını seçtiğinizden emin olun!');

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

arsivleNullSiparisler();

