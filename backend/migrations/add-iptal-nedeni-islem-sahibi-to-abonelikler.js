const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../floovon_professional.db');

/**
 * tenants_abonelikler tablosuna yeni kolonlar ekler:
 * - iptal_nedeni: TEXT - İptal nedeni (dashboard'dan iptal edildiğinde)
 * - islem_sahibi: TEXT - İşlemi kimin yaptığı ('musteri' veya 'superadmin')
 */
async function addIptalNedeniIslemSahibiToAbonelikler() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Veritabanı bağlantı hatası:', err);
                return reject(err);
            }
            console.log('✅ Veritabanına bağlandı');
        });

        // Önce mevcut kolonları kontrol et
        db.all(`PRAGMA table_info(tenants_abonelikler)`, (err, columns) => {
            if (err) {
                console.error('❌ Tablo bilgisi alınamadı:', err);
                db.close();
                return reject(err);
            }

            const columnNames = columns.map(col => col.name);
            const columnsToAdd = [];

            // Eksik kolonları tespit et
            if (!columnNames.includes('iptal_nedeni')) {
                columnsToAdd.push({
                    name: 'iptal_nedeni',
                    sql: 'ALTER TABLE tenants_abonelikler ADD COLUMN iptal_nedeni TEXT'
                });
            }

            if (!columnNames.includes('islem_sahibi')) {
                columnsToAdd.push({
                    name: 'islem_sahibi',
                    sql: 'ALTER TABLE tenants_abonelikler ADD COLUMN islem_sahibi TEXT'
                });
            }

            if (columnsToAdd.length === 0) {
                console.log('✅ Tüm kolonlar zaten mevcut');
                db.close();
                return resolve();
            }

            // Eksik kolonları sırayla ekle
            let currentIndex = 0;
            const addNextColumn = () => {
                if (currentIndex >= columnsToAdd.length) {
                    console.log('✅ Tüm eksik kolonlar eklendi');
                    db.close();
                    return resolve();
                }

                const column = columnsToAdd[currentIndex];
                console.log(`📋 ${column.name} kolonu ekleniyor...`);

                db.run(column.sql, (err) => {
                    if (err) {
                        console.error(`❌ ${column.name} kolonu eklenemedi:`, err);
                        db.close();
                        return reject(err);
                    }

                    console.log(`✅ ${column.name} kolonu eklendi`);
                    currentIndex++;
                    addNextColumn();
                });
            };

            addNextColumn();
        });
    });
}

// Eğer doğrudan çalıştırılıyorsa
if (require.main === module) {
    addIptalNedeniIslemSahibiToAbonelikler()
        .then(() => {
            console.log('✅ Migration tamamlandı');
            process.exit(0);
        })
        .catch((err) => {
            console.error('❌ Migration hatası:', err);
            process.exit(1);
        });
}

module.exports = addIptalNedeniIslemSahibiToAbonelikler;




