const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Yedek dosyası: argv ile verilebilir; yoksa floovon_professional.db kullanılır (tek DB kullanımı)
const BACKUP_DB_PATH = process.argv[2] || path.join(__dirname, 'floovon_professional.db');

const backupDb = new sqlite3.Database(BACKUP_DB_PATH, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('❌ Yedek veritabanı açılamadı:', err.message);
        process.exit(1);
    }
    console.log('✅ Yedek veritabanı açıldı:', BACKUP_DB_PATH);
    
    // Tüm tabloları listele
    backupDb.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (err, rows) => {
        if (err) {
            console.error('❌ Tablolar listelenirken hata:', err.message);
            backupDb.close();
            process.exit(1);
        }
        
        console.log('\n📋 Yedek veritabanındaki tablolar:');
        rows.forEach(row => {
            console.log(`   - ${row.name}`);
        });
        
        // organizasyon ve siparis ile ilgili tabloları kontrol et
        const orgTables = rows.filter(r => r.name.toLowerCase().includes('organizasyon') || r.name.toLowerCase().includes('kart'));
        const siparisTables = rows.filter(r => r.name.toLowerCase().includes('siparis') || r.name.toLowerCase().includes('order'));
        
        console.log('\n📦 Organizasyon/Kart ile ilgili tablolar:');
        orgTables.forEach(t => console.log(`   - ${t.name}`));
        
        console.log('\n📦 Sipariş ile ilgili tablolar:');
        siparisTables.forEach(t => console.log(`   - ${t.name}`));
        
        backupDb.close();
    });
});







































