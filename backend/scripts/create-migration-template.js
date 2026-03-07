#!/usr/bin/env node
/**
 * Yeni migration dosyası oluşturma template'i
 * 
 * Kullanım:
 *   node scripts/create-migration-template.js migration-adi
 * 
 * Örnek:
 *   node scripts/create-migration-template.js add-yeni-kolon-to-tablo
 */

const fs = require('fs');
const path = require('path');

const migrationName = process.argv[2];

if (!migrationName) {
    console.error('❌ Migration adı belirtilmedi!');
    console.log('\nKullanım:');
    console.log('  node scripts/create-migration-template.js migration-adi');
    console.log('\nÖrnek:');
    console.log('  node scripts/create-migration-template.js add-yeni-kolon-to-tablo');
    process.exit(1);
}

// Dosya adını oluştur
const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0].replace('T', '-');
const fileName = `${migrationName}.js`;
const filePath = path.resolve(__dirname, '../migrations', fileName);

// Template içeriği
const template = `const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../floovon_professional.db');

/**
 * [MIGRATION AÇIKLAMASI]
 * 
 * Bu migration şunları yapar:
 * - [Yapılacak değişiklik 1]
 * - [Yapılacak değişiklik 2]
 */
async function ${migrationName.replace(/-/g, '_')}() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Veritabanı bağlantı hatası:', err);
                return reject(err);
            }
            console.log('✅ Veritabanına bağlandı');
        });

        db.serialize(() => {
            // TODO: Migration kodunu buraya yazın
            
            // Örnek: Tablo bilgilerini kontrol et
            // db.all(\`PRAGMA table_info(tablo_adi)\`, (err, columns) => {
            //     if (err) {
            //         console.error('❌ Tablo bilgisi alınamadı:', err);
            //         db.close();
            //         return reject(err);
            //     }
            //     
            //     const columnNames = columns.map(col => col.name);
            //     
            //     // Kolon kontrolü
            //     if (!columnNames.includes('yeni_kolon')) {
            //         db.run('ALTER TABLE tablo_adi ADD COLUMN yeni_kolon TEXT', (err) => {
            //             if (err) {
            //                 console.error('❌ Kolon eklenemedi:', err);
            //                 db.close();
            //                 return reject(err);
            //             }
            //             console.log('✅ Kolon eklendi');
            //             db.close();
            //             resolve();
            //         });
            //     } else {
            //         console.log('✅ Kolon zaten mevcut');
            //         db.close();
            //         resolve();
            //     }
            // });
            
            // Geçici olarak başarılı dönüş
            console.log('⚠️  Migration henüz implement edilmedi!');
            db.close();
            resolve();
        });
    });
}

// Eğer doğrudan çalıştırılıyorsa
if (require.main === module) {
    ${migrationName.replace(/-/g, '_')}()
        .then(() => {
            console.log('✅ Migration tamamlandı');
            process.exit(0);
        })
        .catch((err) => {
            console.error('❌ Migration hatası:', err);
            process.exit(1);
        });
}

module.exports = ${migrationName.replace(/-/g, '_')};
`;

// Dosyayı oluştur
try {
    fs.writeFileSync(filePath, template, 'utf8');
    console.log(`✅ Migration dosyası oluşturuldu: ${filePath}`);
    console.log(`\n📝 Şimdi bu dosyayı düzenleyip migration kodunu yazabilirsiniz.`);
    console.log(`\n💡 Migration'ı test etmek için:`);
    console.log(`   node migrations/${fileName}`);
    console.log(`\n💡 Migration'ı run-migrations.js'e eklemek için:`);
    console.log(`   backend/run-migrations.js dosyasını açıp yeni migration'ı ekleyin.\n`);
} catch (error) {
    console.error('❌ Dosya oluşturulurken hata:', error);
    process.exit(1);
}

