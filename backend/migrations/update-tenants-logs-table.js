const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../floovon_professional.db');

/**
 * Tenants_logs tablosunu günceller
 * Yeni kolonları ekler: user_id, user_name, target_type, target_id, target_name, details, user_agent
 */
async function updateTenantsLogsTable() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Veritabanı bağlantı hatası:', err);
                return reject(err);
            }

            console.log('✅ Veritabanına bağlandı');
        });

        // Önce mevcut kolonları kontrol et
        db.all('PRAGMA table_info(tenants_logs)', [], async (err, columns) => {
            if (err) {
                console.error('❌ Tablo bilgisi alınamadı:', err);
                db.close();
                return reject(err);
            }

            const columnNames = columns.map(c => c.name);
            const columnsToAdd = [];

            // Eksik kolonları belirle
            if (!columnNames.includes('user_id')) {
                columnsToAdd.push('user_id INTEGER');
            }
            if (!columnNames.includes('user_name')) {
                columnsToAdd.push('user_name TEXT');
            }
            if (!columnNames.includes('target_type')) {
                columnsToAdd.push('target_type TEXT');
            }
            if (!columnNames.includes('target_id')) {
                columnsToAdd.push('target_id INTEGER');
            }
            if (!columnNames.includes('target_name')) {
                columnsToAdd.push('target_name TEXT');
            }
            if (!columnNames.includes('details')) {
                columnsToAdd.push('details TEXT');
            }
            if (!columnNames.includes('user_agent')) {
                columnsToAdd.push('user_agent TEXT');
            }

            if (columnsToAdd.length === 0) {
                console.log('✅ Tenants_logs tablosu zaten güncel');
                db.close();
                return resolve();
            }

            console.log(`⚠️ Tenants_logs tablosuna ${columnsToAdd.length} kolon eklenecek...`);

            // Her kolonu tek tek ekle (SQLite ALTER TABLE ADD COLUMN)
            let addedCount = 0;
            let errorCount = 0;

            columnsToAdd.forEach((columnDef, index) => {
                const columnName = columnDef.split(' ')[0];
                db.run(`ALTER TABLE tenants_logs ADD COLUMN ${columnDef}`, (err) => {
                    if (err) {
                        errorCount++;
                        console.error(`❌ Kolon eklenemedi: ${columnName}`, err.message);
                    } else {
                        addedCount++;
                        console.log(`✅ Kolon eklendi: ${columnName}`);
                    }

                    // Son kolon eklendiğinde
                    if (addedCount + errorCount === columnsToAdd.length) {
                        if (addedCount > 0) {
                            console.log(`✅ ${addedCount} kolon başarıyla eklendi`);
                        }
                        if (errorCount > 0) {
                            console.warn(`⚠️ ${errorCount} kolon eklenemedi`);
                        }

                        // Mevcut verileri migrate et (user -> user_name, type -> target_type, target -> target_name, metadata -> details)
                        migrateExistingData(db, resolve);
                    }
                });
            });
        });
    });
}

function migrateExistingData(db, resolve) {
    console.log('🔄 Mevcut veriler migrate ediliyor...');

    // Mevcut kayıtları al
    db.all('SELECT * FROM tenants_logs', [], (err, rows) => {
        if (err) {
            console.error('❌ Mevcut veriler alınamadı:', err);
            db.close();
            return resolve();
        }

        if (rows.length === 0) {
            console.log('ℹ️ Migrate edilecek veri yok');
            db.close();
            return resolve();
        }

        let migratedCount = 0;
        let errorCount = 0;

        if (rows.length === 0) {
            console.log('ℹ️ Migrate edilecek veri yok');
            db.close();
            return resolve();
        }

        rows.forEach((row, index) => {
            const updates = [];
            const values = [];

            // user -> user_name (eğer user_name boşsa)
            if (row.user && !row.user_name) {
                updates.push('user_name = ?');
                values.push(row.user);
            }

            // type -> target_type (eğer target_type boşsa)
            if (row.type && !row.target_type) {
                updates.push('target_type = ?');
                values.push(row.type);
            }

            // target -> target_name (eğer target_name boşsa ve target varsa)
            if (row.target && !row.target_name) {
                updates.push('target_name = ?');
                values.push(row.target);
            }

            // metadata -> details (eğer details boşsa)
            if (row.metadata && !row.details) {
                updates.push('details = ?');
                values.push(row.metadata);
            }

            if (updates.length === 0) {
                migratedCount++;
                // Son kayıt işlendiğinde
                if (migratedCount + errorCount === rows.length) {
                    if (migratedCount > 0) {
                        console.log(`✅ ${migratedCount} kayıt zaten güncel veya migrate edildi`);
                    }
                    if (errorCount > 0) {
                        console.warn(`⚠️ ${errorCount} kayıt migrate edilemedi`);
                    }
                    db.close();
                    resolve();
                }
            } else {
                values.push(row.id);
                db.run(
                    `UPDATE tenants_logs SET ${updates.join(', ')} WHERE id = ?`,
                    values,
                    (err) => {
                        if (err) {
                            errorCount++;
                            console.error(`❌ Kayıt ${row.id} migrate edilemedi:`, err.message);
                        } else {
                            migratedCount++;
                        }

                        // Son kayıt işlendiğinde
                        if (migratedCount + errorCount === rows.length) {
                            if (migratedCount > 0) {
                                console.log(`✅ ${migratedCount} kayıt migrate edildi`);
                            }
                            if (errorCount > 0) {
                                console.warn(`⚠️ ${errorCount} kayıt migrate edilemedi`);
                            }
                            db.close();
                            resolve();
                        }
                    }
                );
            }
        });
    });
}

// Eğer doğrudan çalıştırılıyorsa
if (require.main === module) {
    updateTenantsLogsTable()
        .then(() => {
            console.log('\n✅ Tenants_logs tablosu güncellendi!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('\n❌ Hata:', err);
            process.exit(1);
        });
}

module.exports = { updateTenantsLogsTable };

