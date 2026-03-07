/**
 * Kartların Teslim Tarihlerini Kontrol Et
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

async function checkKartTarihleri() {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error('❌ Veritabanı açılamadı:', err);
            process.exit(1);
        }
    });

    console.log('🔍 Kartların Teslim Tarihlerini Kontrol Ediyorum...\n');

    try {
        // Özel Sipariş, Özel Gün, Araç Süsleme kartlarının teslim tarihlerini kontrol et
        const ozelKartlar = await query(db, `
            SELECT 
                ok.id,
                ok.organizasyon_kart_tur,
                ok.organizasyon_kart_etiket,
                ok.organizasyon_teslim_tarih,
                ok.organizasyon_status,
                ok.is_active,
                ok.arsivli
            FROM organizasyon_kartlar ok
            WHERE ok.organizasyon_kart_tur IN ('Özel Sipariş', 'Özel Gün', 'Araç Süsleme')
                AND ok.organizasyon_status = 'aktif' 
                AND ok.is_active = 1 
                AND COALESCE(CAST(ok.arsivli AS INTEGER), 0) = 0
            ORDER BY ok.organizasyon_kart_tur, ok.id
        `);

        console.log(`Özel kart sayısı: ${ozelKartlar.length}\n`);
        ozelKartlar.forEach(kart => {
            const teslimTarih = kart.organizasyon_teslim_tarih || 'NULL';
            console.log(`  ID: ${kart.id} | Tür: ${kart.organizasyon_kart_tur} | Etiket: ${kart.organizasyon_kart_etiket || 'NULL'}`);
            console.log(`    Teslim Tarihi: ${teslimTarih}`);
            console.log(`    Status: ${kart.organizasyon_status}, is_active: ${kart.is_active}, arsivli: ${kart.arsivli || 'NULL'}`);
            console.log('');
        });

        // Teslim tarihi NULL olan kartlar
        const nullTarihliKartlar = await query(db, `
            SELECT 
                ok.id,
                ok.organizasyon_kart_tur,
                ok.organizasyon_kart_etiket,
                ok.organizasyon_teslim_tarih
            FROM organizasyon_kartlar ok
            WHERE ok.organizasyon_kart_tur IN ('Özel Sipariş', 'Özel Gün', 'Araç Süsleme')
                AND ok.organizasyon_status = 'aktif' 
                AND ok.is_active = 1 
                AND COALESCE(CAST(ok.arsivli AS INTEGER), 0) = 0
                AND (ok.organizasyon_teslim_tarih IS NULL OR ok.organizasyon_teslim_tarih = '')
            ORDER BY ok.organizasyon_kart_tur, ok.id
        `);

        console.log(`\n=== TESLİM TARİHİ NULL OLAN KARTLAR ===`);
        console.log(`Sayı: ${nullTarihliKartlar.length}\n`);
        if (nullTarihliKartlar.length > 0) {
            nullTarihliKartlar.forEach(kart => {
                console.log(`  ID: ${kart.id} | Tür: ${kart.organizasyon_kart_tur} | Etiket: ${kart.organizasyon_kart_etiket || 'NULL'}`);
            });
            console.log('\n⚠️  Bu kartlar frontend\'de görünmeyecek çünkü teslim_tarih yok!');
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

checkKartTarihleri();

