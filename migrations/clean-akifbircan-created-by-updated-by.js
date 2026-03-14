/**
 * Migration: created_by ve updated_by kolonlarındaki "akifbircan" değerlerini temizle
 *
 * Tenant panelinde kullanılan tüm tablolarda bu kolonlar varsa,
 * değeri "akifbircan" olan kayıtları NULL yapar.
 * Yeni ekleme/güncellemelerde zaten getCurrentUsername(req) ile
 * oturum açan kullanıcı yazılıyor (simple-server.js).
 *
 * Çalıştırma: node migrations/clean-akifbircan-created-by-updated-by.js
 * (Proje kökünden: D:\FLOOVON)
 */

const path = require('path');
const sqlite3 = require(path.resolve(__dirname, '..', 'backend', 'node_modules', 'sqlite3')).verbose();

const DB_PATH = path.resolve(__dirname, '..', 'backend', 'floovon_professional.db');
const CLEAN_VALUE = 'akifbircan';

function runMigration() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, (err) => {
            if (err) {
                console.error('❌ Veritabanı bağlantı hatası:', err.message);
                return reject(err);
            }
        });

        db.serialize(() => {
            db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", [], (err, tables) => {
                if (err) {
                    console.error('❌ Tablolar alınırken hata:', err);
                    db.close();
                    return reject(err);
                }

                const tablesToCheck = (tables || []).map((t) => t.name);
                let processed = 0;
                let totalUpdated = 0;
                const updates = [];

                function processTable(index) {
                    if (index >= tablesToCheck.length) {
                        console.log('\n✅ Migration tamamlandı. Toplam güncellenen kayıt:', totalUpdated);
                        db.close();
                        return resolve({ totalUpdated, updates });
                    }

                    const tableName = tablesToCheck[index];
                    db.all(`PRAGMA table_info(${tableName})`, [], (pErr, columns) => {
                        if (pErr) {
                            console.warn('⚠️ PRAGMA hatası', tableName, pErr.message);
                            return processTable(index + 1);
                        }

                        const colNames = (columns || []).map((c) => c.name);
                        const hasCreatedBy = colNames.includes('created_by');
                        const hasUpdatedBy = colNames.includes('updated_by');

                        if (!hasCreatedBy && !hasUpdatedBy) {
                            return processTable(index + 1);
                        }

                        let done = 0;
                        const expect = (hasCreatedBy ? 1 : 0) + (hasUpdatedBy ? 1 : 0);

                        function next() {
                            done++;
                            if (done >= expect) processTable(index + 1);
                        }

                        if (hasCreatedBy) {
                            db.run(
                                `UPDATE ${tableName} SET created_by = NULL WHERE created_by = ?`,
                                [CLEAN_VALUE],
                                function (uErr) {
                                    if (uErr) {
                                        console.warn('⚠️ UPDATE created_by hatası', tableName, uErr.message);
                                    } else if (this.changes > 0) {
                                        totalUpdated += this.changes;
                                        updates.push({ table: tableName, column: 'created_by', count: this.changes });
                                        console.log(`  ${tableName}.created_by: ${this.changes} kayıt temizlendi`);
                                    }
                                    next();
                                }
                            );
                        } else {
                            next();
                        }

                        if (hasUpdatedBy) {
                            db.run(
                                `UPDATE ${tableName} SET updated_by = NULL WHERE updated_by = ?`,
                                [CLEAN_VALUE],
                                function (uErr) {
                                    if (uErr) {
                                        console.warn('⚠️ UPDATE updated_by hatası', tableName, uErr.message);
                                    } else if (this.changes > 0) {
                                        totalUpdated += this.changes;
                                        updates.push({ table: tableName, column: 'updated_by', count: this.changes });
                                        console.log(`  ${tableName}.updated_by: ${this.changes} kayıt temizlendi`);
                                    }
                                    next();
                                }
                            );
                        } else {
                            next();
                        }
                    });
                }

                console.log('🔍 Tablolar taranıyor (created_by / updated_by kolonları)...');
                processTable(0);
            });
        });
    });
}

runMigration()
    .then((result) => {
        console.log('Bitti.', result);
        process.exit(0);
    })
    .catch((err) => {
        console.error('Migration hatası:', err);
        process.exit(1);
    });
