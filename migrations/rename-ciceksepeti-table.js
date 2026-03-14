/**
 * Migration: ayarlar_ciceksepeti_ayalari (yanlış yazım) → ayarlar_ciceksepeti_ayarlari
 * Tablo eski isimle varsa yeniden adlandırır; yoksa atlar.
 *
 * Çalıştırma: node migrations/rename-ciceksepeti-table.js
 */

const path = require('path');
const sqlite3 = require(path.resolve(__dirname, '..', 'backend', 'node_modules', 'sqlite3')).verbose();

const DB_PATH = path.resolve(__dirname, '..', 'backend', 'floovon_professional.db');

const OLD_TABLE = 'ayarlar_ciceksepeti_ayalari';
const NEW_TABLE = 'ayarlar_ciceksepeti_ayarlari';

function runMigration() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, (err) => {
            if (err) {
                console.error('Veritabanı bağlantı hatası:', err.message);
                return reject(err);
            }
        });

        db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
            [OLD_TABLE],
            (err, row) => {
                if (err) {
                    db.close();
                    return reject(err);
                }
                if (!row) {
                    console.log('ℹ️', OLD_TABLE, 'tablosu yok, atlanıyor.');
                    db.close();
                    return resolve(false);
                }
                db.run(`ALTER TABLE ${OLD_TABLE} RENAME TO ${NEW_TABLE}`, (e) => {
                    if (e) {
                        console.error('❌ Yeniden adlandırma hatası:', e.message);
                        db.close();
                        return reject(e);
                    }
                    console.log('✅', OLD_TABLE, '→', NEW_TABLE);
                    db.close();
                    resolve(true);
                });
            }
        );
    });
}

runMigration()
    .then((renamed) => {
        console.log(renamed ? 'Tablo adı düzeltildi.' : 'Yapılacak değişiklik yok.');
        process.exit(0);
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
