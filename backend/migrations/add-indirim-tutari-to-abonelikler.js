const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../floovon_professional.db');

/**
 * tenants_abonelikler tablosuna eksik kolonları ekler
 * Purchase endpoint'inin çalışması için gerekli tüm kolonları kontrol edip ekler:
 * - aylik_ucret
 * - max_kullanici
 * - max_depolama_gb
 * - indirim_tutari
 */
async function addMissingColumnsToAbonelikler() {
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
            if (!columnNames.includes('aylik_ucret')) {
                columnsToAdd.push({
                    name: 'aylik_ucret',
                    sql: 'ALTER TABLE tenants_abonelikler ADD COLUMN aylik_ucret INTEGER'
                });
            }

            if (!columnNames.includes('max_kullanici')) {
                columnsToAdd.push({
                    name: 'max_kullanici',
                    sql: 'ALTER TABLE tenants_abonelikler ADD COLUMN max_kullanici INTEGER DEFAULT 50'
                });
            }

            if (!columnNames.includes('max_depolama_gb')) {
                columnsToAdd.push({
                    name: 'max_depolama_gb',
                    sql: 'ALTER TABLE tenants_abonelikler ADD COLUMN max_depolama_gb INTEGER DEFAULT 1000'
                });
            }

            if (!columnNames.includes('indirim_tutari')) {
                columnsToAdd.push({
                    name: 'indirim_tutari',
                    sql: 'ALTER TABLE tenants_abonelikler ADD COLUMN indirim_tutari INTEGER DEFAULT 0'
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

// Geriye uyumluluk için eski fonksiyon adını da export et
const addIndirimTutariColumn = addMissingColumnsToAbonelikler;

// Eğer doğrudan çalıştırılıyorsa
if (require.main === module) {
    addMissingColumnsToAbonelikler()
        .then(() => {
            console.log('✅ Migration tamamlandı');
            process.exit(0);
        })
        .catch((err) => {
            console.error('❌ Migration hatası:', err);
            process.exit(1);
        });
}

module.exports = addMissingColumnsToAbonelikler;
module.exports.addIndirimTutariColumn = addIndirimTutariColumn; // Geriye uyumluluk
