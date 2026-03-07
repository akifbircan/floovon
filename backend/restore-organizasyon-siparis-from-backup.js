const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Veritabanı yolları - sadece floovon_professional.db kullanılıyor
// Yedek dosya yolu: 1. argüman veya aynı klasörde floovon_professional.db (ör. yedek kopyalandığında)
const BACKUP_DB_PATH = process.argv[2] || path.join(__dirname, 'floovon_professional.db');
const CURRENT_DB_PATH = path.join(__dirname, 'floovon_professional.db');

console.log('🔄 Organizasyon ve Sipariş Kartları Yedekten Geri Yükleme Başlatılıyor...\n');

// Yedek veritabanının varlığını kontrol et
if (!fs.existsSync(BACKUP_DB_PATH)) {
    console.error('❌ Yedek veritabanı bulunamadı:', BACKUP_DB_PATH);
    process.exit(1);
}

// Güncel veritabanının varlığını kontrol et
if (!fs.existsSync(CURRENT_DB_PATH)) {
    console.error('❌ Güncel veritabanı bulunamadı:', CURRENT_DB_PATH);
    process.exit(1);
}

// Veritabanlarını aç
const backupDb = new sqlite3.Database(BACKUP_DB_PATH, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('❌ Yedek veritabanı açılamadı:', err.message);
        process.exit(1);
    }
    console.log('✅ Yedek veritabanı açıldı:', BACKUP_DB_PATH);
});

const currentDb = new sqlite3.Database(CURRENT_DB_PATH, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error('❌ Güncel veritabanı açılamadı:', err.message);
        process.exit(1);
    }
    console.log('✅ Güncel veritabanı açıldı:', CURRENT_DB_PATH);
});

// Promise wrapper for database operations
function dbRun(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function dbAll(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function restoreData() {
    try {
        console.log('\n📊 Yedek veritabanından veri okunuyor...\n');

        // 1. ORGANIZASYON_KARTLAR tablosunu yedekten oku
        console.log('📦 organizasyon_kartlar tablosu okunuyor...');
        const backupOrganizasyonKartlar = await dbAll(backupDb, 'SELECT * FROM organizasyon_kartlar');
        console.log(`   ✅ ${backupOrganizasyonKartlar.length} organizasyon kartı bulundu`);

        // 2. SIPARIS_KARTLAR tablosunu yedekten oku
        console.log('📦 siparisler tablosu okunuyor...');
        const backupSiparisKartlar = await dbAll(backupDb, 'SELECT * FROM siparisler');
        console.log(`   ✅ ${backupSiparisKartlar.length} sipariş kartı bulundu`);

        // 3. Güncel veritabanındaki mevcut verileri kontrol et
        console.log('\n📊 Güncel veritabanındaki mevcut veriler kontrol ediliyor...');
        const currentOrganizasyonKartlar = await dbAll(currentDb, 'SELECT COUNT(*) as count FROM organizasyon_kartlar');
        const currentSiparisKartlar = await dbAll(currentDb, 'SELECT COUNT(*) as count FROM siparisler');
        console.log(`   Mevcut organizasyon kartları: ${currentOrganizasyonKartlar[0].count}`);
        console.log(`   Mevcut sipariş kartları: ${currentSiparisKartlar[0].count}`);

        // 4. Güncel veritabanındaki mevcut verileri sil
        console.log('\n🗑️  Güncel veritabanındaki mevcut veriler siliniyor...');
        await dbRun(currentDb, 'DELETE FROM siparisler');
        console.log('   ✅ siparisler tablosu temizlendi');
        await dbRun(currentDb, 'DELETE FROM organizasyon_kartlar');
        console.log('   ✅ organizasyon_kartlar tablosu temizlendi');

        // 5. Yedek verileri güncel veritabanına ekle
        console.log('\n📥 Yedek veriler güncel veritabanına aktarılıyor...\n');

        // organizasyon_kartlar için sütun isimlerini al
        if (backupOrganizasyonKartlar.length > 0) {
            const firstOrg = backupOrganizasyonKartlar[0];
            const orgColumns = Object.keys(firstOrg).join(', ');
            const orgPlaceholders = Object.keys(firstOrg).map(() => '?').join(', ');
            
            console.log(`📝 ${backupOrganizasyonKartlar.length} organizasyon kartı ekleniyor...`);
            for (const org of backupOrganizasyonKartlar) {
                const values = Object.values(org);
                await dbRun(
                    currentDb,
                    `INSERT INTO organizasyon_kartlar (${orgColumns}) VALUES (${orgPlaceholders})`,
                    values
                );
            }
            console.log(`   ✅ ${backupOrganizasyonKartlar.length} organizasyon kartı eklendi`);
        }

        // siparisler için sütun isimlerini al
        if (backupSiparisKartlar.length > 0) {
            const firstSiparis = backupSiparisKartlar[0];
            const siparisColumns = Object.keys(firstSiparis).join(', ');
            const siparisPlaceholders = Object.keys(firstSiparis).map(() => '?').join(', ');
            
            console.log(`📝 ${backupSiparisKartlar.length} sipariş kartı ekleniyor...`);
            let added = 0;
            for (const siparis of backupSiparisKartlar) {
                try {
                    const values = Object.values(siparis);
                    await dbRun(
                        currentDb,
                        `INSERT INTO siparisler (${siparisColumns}) VALUES (${siparisPlaceholders})`,
                        values
                    );
                    added++;
                    if (added % 100 === 0) {
                        console.log(`   ⏳ ${added}/${backupSiparisKartlar.length} sipariş kartı eklendi...`);
                    }
                } catch (err) {
                    console.warn(`   ⚠️  Sipariş kartı eklenirken hata (ID: ${siparis.id}):`, err.message);
                }
            }
            console.log(`   ✅ ${added}/${backupSiparisKartlar.length} sipariş kartı eklendi`);
        }

        // 6. Sonuçları kontrol et
        console.log('\n✅ Veri aktarımı tamamlandı!\n');
        const finalOrganizasyonKartlar = await dbAll(currentDb, 'SELECT COUNT(*) as count FROM organizasyon_kartlar');
        const finalSiparisKartlar = await dbAll(currentDb, 'SELECT COUNT(*) as count FROM siparisler');
        console.log('📊 Güncel veritabanındaki son durum:');
        console.log(`   Organizasyon kartları: ${finalOrganizasyonKartlar[0].count}`);
        console.log(`   Sipariş kartları: ${finalSiparisKartlar[0].count}\n`);

        // Veritabanlarını kapat
        backupDb.close((err) => {
            if (err) console.error('⚠️  Yedek veritabanı kapatılırken hata:', err.message);
        });
        
        currentDb.close((err) => {
            if (err) {
                console.error('⚠️  Güncel veritabanı kapatılırken hata:', err.message);
                process.exit(1);
            }
            console.log('✅ Veritabanları kapatıldı');
            console.log('\n🎉 İşlem başarıyla tamamlandı!');
            process.exit(0);
        });

    } catch (error) {
        console.error('\n❌ Hata oluştu:', error);
        backupDb.close();
        currentDb.close();
        process.exit(1);
    }
}

// İşlemi başlat
restoreData();







































