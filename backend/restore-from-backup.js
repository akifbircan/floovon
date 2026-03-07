/**
 * Yedek veritabanından organizasyon_kartlar ve siparis_kartlar verilerini geri yükle
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Yedek veritabanı yolu - kullanıcıdan alınacak veya otomatik bulunacak
const yedekDbPath = process.argv[2] || null;
const mevcutDbPath = path.join(__dirname, 'floovon_professional.db');

if (!yedekDbPath || !fs.existsSync(yedekDbPath)) {
    console.error('❌ Yedek veritabanı bulunamadı!');
    console.log('Kullanım: node restore-from-backup.js <yedek-db-yolu>');
    console.log('\nÖrnek:');
    console.log('node restore-from-backup.js "D:\\FLOOVON-CURSOR-YEDEKLER\\...\\floovon_professional.db"');
    process.exit(1);
}

if (!fs.existsSync(mevcutDbPath)) {
    console.error('❌ Mevcut veritabanı bulunamadı!');
    process.exit(1);
}

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

async function restoreFromBackup() {
    console.log('🔄 Yedek veritabanından verileri geri yüklüyorum...\n');
    console.log(`Yedek DB: ${yedekDbPath}`);
    console.log(`Mevcut DB: ${mevcutDbPath}\n`);

    const yedekDb = new sqlite3.Database(yedekDbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error('❌ Yedek veritabanı açılamadı:', err);
            process.exit(1);
        }
    });

    const mevcutDb = new sqlite3.Database(mevcutDbPath, sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
            console.error('❌ Mevcut veritabanı açılamadı:', err);
            process.exit(1);
        }
    });

    try {
        // 1. Yedek veritabanından organizasyon_kartlar verilerini al
        console.log('📦 Organizasyon kartlarını yedekten alıyorum...');
        const yedekOrganizasyonKartlari = await query(yedekDb, `
            SELECT * FROM organizasyon_kartlar
            WHERE organizasyon_status = 'aktif' 
                AND is_active = 1 
                AND COALESCE(CAST(arsivli AS INTEGER), 0) = 0
        `);

        console.log(`✅ ${yedekOrganizasyonKartlari.length} organizasyon kartı bulundu`);

        // 2. Mevcut veritabanındaki organizasyon kartlarını sil (veya güncelle)
        console.log('\n🗑️  Mevcut organizasyon kartlarını temizliyorum...');
        await execute(mevcutDb, `DELETE FROM organizasyon_kartlar`);

        // 3. Yedek veritabanından organizasyon kartlarını mevcut veritabanına ekle
        console.log('💾 Organizasyon kartlarını mevcut veritabanına ekliyorum...');
        for (const kart of yedekOrganizasyonKartlari) {
            // Tüm kolonları dinamik olarak ekle
            const columns = Object.keys(kart).join(', ');
            const placeholders = Object.keys(kart).map(() => '?').join(', ');
            const values = Object.values(kart);

            await execute(mevcutDb, `
                INSERT INTO organizasyon_kartlar (${columns})
                VALUES (${placeholders})
            `, values);
        }
        console.log(`✅ ${yedekOrganizasyonKartlari.length} organizasyon kartı eklendi`);

        // 4. Yedek veritabanından siparis_kartlar verilerini al
        console.log('\n📦 Sipariş kartlarını yedekten alıyorum...');
        const yedekSiparisKartlari = await query(yedekDb, `
            SELECT * FROM siparis_kartlar
            WHERE status = 'aktif' 
                AND COALESCE(CAST(arsivli AS INTEGER), 0) = 0
        `);

        console.log(`✅ ${yedekSiparisKartlari.length} sipariş kartı bulundu`);

        // 5. Mevcut veritabanındaki sipariş kartlarını sil
        console.log('\n🗑️  Mevcut sipariş kartlarını temizliyorum...');
        await execute(mevcutDb, `DELETE FROM siparis_kartlar`);

        // 6. Yedek veritabanından sipariş kartlarını mevcut veritabanına ekle
        console.log('💾 Sipariş kartlarını mevcut veritabanına ekliyorum...');
        for (const siparis of yedekSiparisKartlari) {
            // Tüm kolonları dinamik olarak ekle
            const columns = Object.keys(siparis).join(', ');
            const placeholders = Object.keys(siparis).map(() => '?').join(', ');
            const values = Object.values(siparis);

            await execute(mevcutDb, `
                INSERT INTO siparis_kartlar (${columns})
                VALUES (${placeholders})
            `, values);
        }
        console.log(`✅ ${yedekSiparisKartlari.length} sipariş kartı eklendi`);

        console.log('\n✅ Geri yükleme tamamlandı!');
        console.log(`📊 ${yedekOrganizasyonKartlari.length} organizasyon kartı`);
        console.log(`📊 ${yedekSiparisKartlari.length} sipariş kartı`);

        yedekDb.close();
        mevcutDb.close((err) => {
            if (err) {
                console.error('❌ Veritabanı kapatılırken hata:', err);
            } else {
                console.log('\n✅ İşlem başarıyla tamamlandı!');
            }
        });
    } catch (error) {
        console.error('❌ Hata:', error);
        yedekDb.close();
        mevcutDb.close();
        process.exit(1);
    }
}

restoreFromBackup();

