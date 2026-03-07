/**
 * Eksik Kartları Kontrol Et
 * Özel Sipariş, Özel Gün, Araç Süsleme kartlarının durumunu kontrol et
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

async function checkMissingKartlar() {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error('❌ Veritabanı açılamadı:', err);
            process.exit(1);
        }
    });

    console.log('🔍 Eksik Kartları Kontrol Ediyorum...\n');

    try {
        // 1. Tüm organizasyon kartlarını listele
        console.log('=== 1. TÜM ORGANİZASYON KARTLARI ===');
        const tumKartlar = await query(db, `
            SELECT 
                ok.id,
                ok.organizasyon_kart_tur,
                ok.organizasyon_kart_etiket,
                ok.organizasyon_status,
                ok.is_active,
                ok.arsivli,
                ok.organizasyon_teslim_tarih,
                COUNT(sk.id) as siparis_sayisi
            FROM organizasyon_kartlar ok
            LEFT JOIN siparis_kartlar sk ON ok.id = sk.organizasyon_kart_id 
                AND sk.status = 'aktif' 
                AND COALESCE(CAST(sk.arsivli AS INTEGER), 0) = 0
            GROUP BY ok.id
            ORDER BY ok.organizasyon_kart_tur, ok.id
        `);

        console.log(`Toplam organizasyon kartı: ${tumKartlar.length}\n`);
        tumKartlar.forEach(kart => {
            const durum = `Status: ${kart.organizasyon_status || 'NULL'}, is_active: ${kart.is_active}, arsivli: ${kart.arsivli || 'NULL'}`;
            console.log(`  ID: ${kart.id} | Tür: ${kart.organizasyon_kart_tur || 'NULL'} | Etiket: ${kart.organizasyon_kart_etiket || 'NULL'} | ${durum} | Sipariş: ${kart.siparis_sayisi}`);
        });

        // 2. Özel Sipariş, Özel Gün, Araç Süsleme kartlarını detaylı kontrol et
        console.log('\n=== 2. ÖZEL SİPARİŞ, ÖZEL GÜN, ARAÇ SÜSLEME KARTLARI ===');
        const ozelKartlar = await query(db, `
            SELECT 
                ok.id,
                ok.organizasyon_kart_tur,
                ok.organizasyon_kart_etiket,
                ok.organizasyon_status,
                ok.is_active,
                ok.arsivli,
                ok.organizasyon_teslim_tarih,
                ok.created_at,
                ok.updated_at,
                COUNT(sk.id) as siparis_sayisi
            FROM organizasyon_kartlar ok
            LEFT JOIN siparis_kartlar sk ON ok.id = sk.organizasyon_kart_id 
                AND sk.status = 'aktif' 
                AND COALESCE(CAST(sk.arsivli AS INTEGER), 0) = 0
            WHERE ok.organizasyon_kart_tur IN ('Özel Sipariş', 'Özel Gün', 'Araç Süsleme')
            GROUP BY ok.id
            ORDER BY ok.organizasyon_kart_tur, ok.id
        `);

        console.log(`Özel kart sayısı: ${ozelKartlar.length}\n`);
        ozelKartlar.forEach(kart => {
            const durum = `Status: ${kart.organizasyon_status || 'NULL'}, is_active: ${kart.is_active}, arsivli: ${kart.arsivli || 'NULL'}`;
            const aktifMi = (kart.organizasyon_status === 'aktif' || !kart.organizasyon_status) 
                && (kart.is_active === 1 || !kart.is_active) 
                && ((kart.arsivli === 0 || !kart.arsivli || kart.arsivli === '0' || kart.arsivli === ''));
            console.log(`  ID: ${kart.id} | Tür: ${kart.organizasyon_kart_tur} | Etiket: ${kart.organizasyon_kart_etiket || 'NULL'}`);
            console.log(`    ${durum}`);
            console.log(`    Aktif mi? ${aktifMi ? 'EVET' : 'HAYIR'}`);
            console.log(`    Sipariş Sayısı: ${kart.siparis_sayisi}`);
            console.log(`    Oluşturulma: ${kart.created_at || 'NULL'}`);
            console.log(`    Güncellenme: ${kart.updated_at || 'NULL'}`);
            console.log('');
        });

        // 3. Frontend'in beklediği sorgu ile karşılaştır
        console.log('\n=== 3. FRONTEND SORGUSU İLE KARŞILAŞTIRMA ===');
        const frontendSorgusu = await query(db, `
            SELECT 
                ok.id,
                ok.organizasyon_kart_tur,
                ok.organizasyon_kart_etiket,
                ok.organizasyon_status,
                ok.is_active,
                ok.arsivli,
                COUNT(sk.id) as siparis_sayisi
            FROM organizasyon_kartlar ok
            LEFT JOIN siparis_kartlar sk ON ok.id = sk.organizasyon_kart_id 
                AND sk.status = 'aktif' 
                AND COALESCE(CAST(sk.arsivli AS INTEGER), 0) = 0
            WHERE ok.organizasyon_status = 'aktif' 
                AND ok.is_active = 1 
                AND COALESCE(CAST(ok.arsivli AS INTEGER), 0) = 0
            GROUP BY ok.id
            ORDER BY ok.organizasyon_kart_tur, ok.id
        `);

        console.log(`Frontend sorgusu sonucu: ${frontendSorgusu.length} kart\n`);
        frontendSorgusu.forEach(kart => {
            console.log(`  ID: ${kart.id} | Tür: ${kart.organizasyon_kart_tur || 'NULL'} | Etiket: ${kart.organizasyon_kart_etiket || 'NULL'} | Sipariş: ${kart.siparis_sayisi}`);
        });

        // 4. Frontend'de görünmeyen kartları bul
        console.log('\n=== 4. FRONTEND\'DE GÖRÜNMEYEN KARTLAR ===');
        const gorunmeyenKartlar = await query(db, `
            SELECT 
                ok.id,
                ok.organizasyon_kart_tur,
                ok.organizasyon_kart_etiket,
                ok.organizasyon_status,
                ok.is_active,
                ok.arsivli,
                ok.organizasyon_teslim_tarih
            FROM organizasyon_kartlar ok
            WHERE ok.organizasyon_kart_tur IN ('Özel Sipariş', 'Özel Gün', 'Araç Süsleme')
                AND (
                    ok.organizasyon_status != 'aktif' 
                    OR ok.organizasyon_status IS NULL
                    OR ok.is_active != 1
                    OR ok.is_active IS NULL
                    OR COALESCE(CAST(ok.arsivli AS INTEGER), 0) != 0
                )
            ORDER BY ok.organizasyon_kart_tur, ok.id
        `);

        console.log(`Frontend'de görünmeyen özel kart sayısı: ${gorunmeyenKartlar.length}\n`);
        if (gorunmeyenKartlar.length > 0) {
            gorunmeyenKartlar.forEach(kart => {
                console.log(`  ID: ${kart.id} | Tür: ${kart.organizasyon_kart_tur} | Etiket: ${kart.organizasyon_kart_etiket || 'NULL'}`);
                console.log(`    Status: ${kart.organizasyon_status || 'NULL'} (beklenen: 'aktif')`);
                console.log(`    is_active: ${kart.is_active} (beklenen: 1)`);
                console.log(`    arsivli: ${kart.arsivli || 'NULL'} (beklenen: 0 veya NULL)`);
                console.log('');
            });
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

checkMissingKartlar();

