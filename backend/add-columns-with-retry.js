const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'floovon_professional.db');

console.log('⚠️ ÖNEMLİ: Backend sunucusunu DURDURUN (Ctrl+C) ve sonra bu scripti çalıştırın!\n');
console.log('🔍 Veritabanı yolu:', dbPath);
console.log('🔍 Dosya var mı?', fs.existsSync(dbPath));

if (!fs.existsSync(dbPath)) {
    console.error('❌ Veritabanı dosyası bulunamadı!');
    process.exit(1);
}

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error('❌ Veritabanı bağlantı hatası:', err.message);
        console.error('   ⚠️ Backend sunucusunu durdurun ve tekrar deneyin!');
        process.exit(1);
    }
    console.log('✅ Veritabanına bağlandı\n');
});

// Önce mevcut kolonları kontrol et
db.all(`PRAGMA table_info(tenants_abonelikler)`, (err, columns) => {
    if (err) {
        console.error('❌ Tablo bilgisi alınamadı:', err.message);
        db.close();
        process.exit(1);
    }

    console.log('📋 MEVCUT KOLONLAR (' + columns.length + ' adet):');
    const columnNames = [];
    columns.forEach(col => {
        console.log(`  [${col.cid}] ${col.name} (${col.type})`);
        columnNames.push(col.name.toLowerCase());
    });

    const needsIptalNedeni = !columnNames.includes('iptal_nedeni');
    const needsIslemSahibi = !columnNames.includes('islem_sahibi');

    console.log('\n🔍 Kontrol sonucu:');
    console.log('  iptal_nedeni:', needsIptalNedeni ? '❌ YOK - EKLENECEK' : '✅ VAR');
    console.log('  islem_sahibi:', needsIslemSahibi ? '❌ YOK - EKLENECEK' : '✅ VAR');

    if (!needsIptalNedeni && !needsIslemSahibi) {
        console.log('\n✅ Her iki kolon da zaten mevcut!');
        db.close();
        process.exit(0);
    }

    let completed = 0;
    const total = (needsIptalNedeni ? 1 : 0) + (needsIslemSahibi ? 1 : 0);

    const finish = () => {
        completed++;
        if (completed >= total) {
            // Final kontrol
            setTimeout(() => {
                db.all(`PRAGMA table_info(tenants_abonelikler)`, (err3, newColumns) => {
                    if (err3) {
                        console.error('❌ Final kontrol hatası:', err3.message);
                        db.close();
                        process.exit(1);
                    }
                    
                    console.log('\n📋 FINAL KOLONLAR (' + newColumns.length + ' adet):');
                    newColumns.forEach(col => {
                        const marker = (col.name === 'iptal_nedeni' || col.name === 'islem_sahibi') ? ' ⭐ YENİ' : '';
                        console.log(`  [${col.cid}] ${col.name} (${col.type})${marker}`);
                    });
                    
                    const finalNames = newColumns.map(c => c.name.toLowerCase());
                    const hasIptalNedeni = finalNames.includes('iptal_nedeni');
                    const hasIslemSahibi = finalNames.includes('islem_sahibi');
                    
                    console.log('\n✅ SONUÇ:');
                    console.log('  iptal_nedeni:', hasIptalNedeni ? '✅ EKLENDİ' : '❌ EKLENMEDİ');
                    console.log('  islem_sahibi:', hasIslemSahibi ? '✅ EKLENDİ' : '❌ EKLENMEDİ');
                    
                    if (hasIptalNedeni && hasIslemSahibi) {
                        console.log('\n🎉 BAŞARILI! Kolonlar eklendi.');
                        console.log('📌 Şimdi backend sunucusunu yeniden başlatın!');
                    } else {
                        console.log('\n⚠️ UYARI: Bazı kolonlar eklenemedi!');
                    }
                    
                    db.close();
                    process.exit(hasIptalNedeni && hasIslemSahibi ? 0 : 1);
                });
            }, 1000);
        }
    };

    if (needsIptalNedeni) {
        console.log('\n📝 iptal_nedeni kolonu ekleniyor...');
        db.run('ALTER TABLE tenants_abonelikler ADD COLUMN iptal_nedeni TEXT', (err) => {
            if (err) {
                console.error('❌ iptal_nedeni eklenemedi:', err.message);
            } else {
                console.log('✅ iptal_nedeni kolonu EKLENDİ');
            }
            finish();
        });
    }

    if (needsIslemSahibi) {
        console.log('\n📝 islem_sahibi kolonu ekleniyor...');
        db.run('ALTER TABLE tenants_abonelikler ADD COLUMN islem_sahibi TEXT', (err) => {
            if (err) {
                console.error('❌ islem_sahibi eklenemedi:', err.message);
            } else {
                console.log('✅ islem_sahibi kolonu EKLENDİ');
            }
            finish();
        });
    }
});




