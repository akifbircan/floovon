/**
 * Yedek veritabanından organizasyon_kartlar ve siparis_kartlar verilerini geri yükle
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const yedekDbPath = "D:\\FLOOVON-CURSOR-YEDEKLER\\____________________________ARSIV\\FLOOVON-YEDEK-ARSIV---20260205---02----01-NUMARALI-ARSIVE-AT-BUNLARI\\2026-02-08\\29---SPA-YAPISI-OLDUKCA-DUZGUN-CALISAN-GENEL-FLOOVON-YEDEK\\backend\\floovon_professional.db";
const mevcutDbPath = path.join(__dirname, 'floovon_professional.db');

if (!fs.existsSync(yedekDbPath)) {
    console.error('❌ Yedek veritabanı bulunamadı:', yedekDbPath);
    process.exit(1);
}

if (!fs.existsSync(mevcutDbPath)) {
    console.error('❌ Mevcut veritabanı bulunamadı:', mevcutDbPath);
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
        `);

        console.log(`✅ ${yedekOrganizasyonKartlari.length} organizasyon kartı bulundu`);

        // 2. Mevcut veritabanındaki organizasyon kartlarını sil
        console.log('\n🗑️  Mevcut organizasyon kartlarını temizliyorum...');
        await execute(mevcutDb, `DELETE FROM organizasyon_kartlar`);

        // 3. Yedek veritabanından organizasyon kartlarını mevcut veritabanına ekle
        console.log('💾 Organizasyon kartlarını mevcut veritabanına ekliyorum...');
        let eklenenKartSayisi = 0;
        for (const kart of yedekOrganizasyonKartlari) {
            try {
                // Tüm kolonları dinamik olarak ekle
                const columns = Object.keys(kart).filter(k => kart[k] !== undefined).join(', ');
                const placeholders = Object.keys(kart).filter(k => kart[k] !== undefined).map(() => '?').join(', ');
                const values = Object.values(kart).filter(v => v !== undefined);

                await execute(mevcutDb, `
                    INSERT INTO organizasyon_kartlar (${columns})
                    VALUES (${placeholders})
                `, values);
                eklenenKartSayisi++;
            } catch (error) {
                console.error(`⚠️  Kart ID ${kart.id} eklenirken hata:`, error.message);
            }
        }
        console.log(`✅ ${eklenenKartSayisi} organizasyon kartı eklendi`);

        // 4. Yedek veritabanından siparis_kartlar verilerini al
        console.log('\n📦 Sipariş kartlarını yedekten alıyorum...');
        const yedekSiparisKartlari = await query(yedekDb, `
            SELECT * FROM siparis_kartlar
        `);

        console.log(`✅ ${yedekSiparisKartlari.length} sipariş kartı bulundu`);

        // 5. Mevcut veritabanındaki sipariş kartlarını sil
        console.log('\n🗑️  Mevcut sipariş kartlarını temizliyorum...');
        await execute(mevcutDb, `DELETE FROM siparis_kartlar`);

        // 6. Yedek veritabanından sipariş kartlarını mevcut veritabanına ekle
        console.log('💾 Sipariş kartlarını mevcut veritabanına ekliyorum...');
        let eklenenSiparisSayisi = 0;
        for (const siparis of yedekSiparisKartlari) {
            try {
                // Tüm kolonları dinamik olarak ekle
                const columns = Object.keys(siparis).filter(k => siparis[k] !== undefined).join(', ');
                const placeholders = Object.keys(siparis).filter(k => siparis[k] !== undefined).map(() => '?').join(', ');
                const values = Object.values(siparis).filter(v => v !== undefined);

                await execute(mevcutDb, `
                    INSERT INTO siparis_kartlar (${columns})
                    VALUES (${placeholders})
                `, values);
                eklenenSiparisSayisi++;
            } catch (error) {
                console.error(`⚠️  Sipariş ID ${siparis.id} eklenirken hata:`, error.message);
            }
        }
        console.log(`✅ ${eklenenSiparisSayisi} sipariş kartı eklendi`);

        console.log('\n✅ Geri yükleme tamamlandı!');
        console.log(`📊 ${eklenenKartSayisi} organizasyon kartı`);
        console.log(`📊 ${eklenenSiparisSayisi} sipariş kartı`);

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

