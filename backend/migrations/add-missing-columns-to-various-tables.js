const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../floovon_professional.db');

/**
 * Çeşitli tablolara eksik kolonları ekler:
 * - ayarlar_genel_gonderim_ayarlari.haftalik_rapor_saat (TEXT)
 * - tenants_abonelik_planlari.yillik_ucret (INTEGER)
 * - ayarlar_genel_teslimat_konumlari.mahalle (TEXT)
 * - ayarlar_genel_teslimat_konumlari.acik_adres (TEXT)
 * - tenants.address (TEXT)
 * - tenants.tax_office (TEXT)
 * - tenants.tax_number (TEXT)
 */
async function addMissingColumnsToVariousTables() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Veritabanı bağlantı hatası:', err);
                return reject(err);
            }
            console.log('✅ Veritabanına bağlandı');
        });

        const columnsToAdd = [
            {
                table: 'ayarlar_genel_gonderim_ayarlari',
                column: 'haftalik_rapor_saat',
                type: 'TEXT',
                defaultValue: '"18:00"'
            },
            {
                table: 'tenants_abonelik_planlari',
                column: 'yillik_ucret',
                type: 'INTEGER',
                defaultValue: null
            },
            {
                table: 'ayarlar_genel_teslimat_konumlari',
                column: 'mahalle',
                type: 'TEXT',
                defaultValue: null
            },
            {
                table: 'ayarlar_genel_teslimat_konumlari',
                column: 'acik_adres',
                type: 'TEXT',
                defaultValue: null
            },
            {
                table: 'tenants',
                column: 'address',
                type: 'TEXT',
                defaultValue: null
            },
            {
                table: 'tenants',
                column: 'tax_office',
                type: 'TEXT',
                defaultValue: null
            },
            {
                table: 'tenants',
                column: 'tax_number',
                type: 'TEXT',
                defaultValue: null
            }
        ];

        let completed = 0;
        const total = columnsToAdd.length;

        const checkAndAddColumn = (index) => {
            if (index >= total) {
                console.log('✅ Tüm eksik kolonlar kontrol edildi/eklendi');
                db.close();
                return resolve();
            }

            const item = columnsToAdd[index];
            
            // Tablo bilgilerini kontrol et
            db.all(`PRAGMA table_info(${item.table})`, (err, columns) => {
                if (err) {
                    console.error(`❌ ${item.table} tablosu için kolon bilgisi alınamadı:`, err);
                    completed++;
                    checkAndAddColumn(index + 1);
                    return;
                }

                const columnNames = columns.map(col => col.name.toLowerCase());
                
                if (!columnNames.includes(item.column.toLowerCase())) {
                    // Kolon yok, ekle
                    let sql = `ALTER TABLE ${item.table} ADD COLUMN ${item.column} ${item.type}`;
                    if (item.defaultValue) {
                        sql += ` DEFAULT ${item.defaultValue}`;
                    }

                    console.log(`📋 ${item.table}.${item.column} kolonu ekleniyor...`);
                    
                    db.run(sql, (err) => {
                        if (err) {
                            console.error(`❌ ${item.table}.${item.column} kolonu eklenemedi:`, err);
                            completed++;
                            checkAndAddColumn(index + 1);
                            return;
                        }
                        console.log(`✅ ${item.table}.${item.column} kolonu eklendi`);
                        completed++;
                        checkAndAddColumn(index + 1);
                    });
                } else {
                    console.log(`✅ ${item.table}.${item.column} kolonu zaten mevcut`);
                    completed++;
                    checkAndAddColumn(index + 1);
                }
            });
        };

        checkAndAddColumn(0);
    });
}

// Eğer doğrudan çalıştırılıyorsa
if (require.main === module) {
    addMissingColumnsToVariousTables()
        .then(() => {
            console.log('✅ Migration tamamlandı');
            process.exit(0);
        })
        .catch((err) => {
            console.error('❌ Migration hatası:', err);
            process.exit(1);
        });
}

module.exports = addMissingColumnsToVariousTables;

