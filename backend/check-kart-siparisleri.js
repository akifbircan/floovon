/**
 * Organizasyon kartlarına bağlı siparişleri kontrol et
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

async function checkKartSiparisleri() {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error('❌ Veritabanı açılamadı:', err);
            process.exit(1);
        }
    });

    console.log('🔍 Organizasyon Kartlarına Bağlı Siparişleri Kontrol Ediyorum...\n');

    try {
        // Özel Sipariş, Özel Gün, Araç Süsleme kartlarına bağlı siparişler
        const kartlar = await query(db, `
            SELECT 
                ok.id as kart_id,
                ok.organizasyon_kart_tur,
                ok.organizasyon_kart_etiket
            FROM organizasyon_kartlar ok
            WHERE ok.organizasyon_kart_tur IN ('Özel Sipariş', 'Özel Gün', 'Araç Süsleme')
                AND ok.organizasyon_status = 'aktif' 
                AND ok.is_active = 1 
                AND COALESCE(CAST(ok.arsivli AS INTEGER), 0) = 0
            ORDER BY ok.id
        `);

        console.log(`Kontrol edilecek kart sayısı: ${kartlar.length}\n`);

        for (const kart of kartlar) {
            const siparisler = await query(db, `
                SELECT 
                    sk.id,
                    sk.organizasyon_kart_id,
                    sk.musteri_unvan,
                    sk.musteri_isim_soyisim,
                    sk.siparis_urun,
                    sk.status,
                    sk.arsivli,
                    sk.is_active
                FROM siparis_kartlar sk
                WHERE sk.organizasyon_kart_id = ?
                    AND sk.status = 'aktif'
                    AND COALESCE(CAST(sk.arsivli AS INTEGER), 0) = 0
                    AND (sk.is_active = 1 OR sk.is_active IS NULL)
                ORDER BY sk.id
            `, [kart.kart_id]);

            console.log(`\n=== Kart ID: ${kart.kart_id} (${kart.organizasyon_kart_tur}) ===`);
            console.log(`Etiket: ${kart.organizasyon_kart_etiket || 'NULL'}`);
            console.log(`Sipariş Sayısı: ${siparisler.length}`);
            
            if (siparisler.length > 0) {
                siparisler.forEach(siparis => {
                    const musteri = siparis.musteri_unvan || siparis.musteri_isim_soyisim || 'NULL';
                    const urun = siparis.siparis_urun || 'NULL';
                    console.log(`  Sipariş ID: ${siparis.id} | Müşteri: ${musteri} | Ürün: ${urun} | Status: ${siparis.status} | Arşivli: ${siparis.arsivli || 'NULL'} | is_active: ${siparis.is_active || 'NULL'}`);
                });
            } else {
                console.log(`  ⚠️  Bu kartta sipariş yok!`);
            }
        }

        db.close((err) => {
            if (err) {
                console.error('❌ Veritabanı kapatılırken hata:', err);
            } else {
                console.log('\n✅ Kontrol tamamlandı!');
            }
        });
    } catch (error) {
        console.error('❌ Hata:', error);
        db.close();
        process.exit(1);
    }
}

checkKartSiparisleri();

