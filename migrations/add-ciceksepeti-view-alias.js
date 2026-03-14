/**
 * Eski tablo adı (ayarlar_ciceksepeti_ayalari) ile VIEW oluşturur.
 * Böylece bu isimle veri isteyen araçlar (örn. DB viewer) çalışır.
 *
 * Çalıştırma: node migrations/add-ciceksepeti-view-alias.js
 */

const path = require('path');
const sqlite3 = require(path.resolve(__dirname, '..', 'backend', 'node_modules', 'sqlite3')).verbose();

const DB_PATH = path.resolve(__dirname, '..', 'backend', 'floovon_professional.db');

const VIEW_NAME = 'ayarlar_ciceksepeti_ayalari';
const TABLE_NAME = 'ayarlar_ciceksepeti_ayarlari';

function run() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, (err) => {
            if (err) return reject(err);
        });

        db.run(`DROP VIEW IF EXISTS ${VIEW_NAME}`, (e1) => {
            if (e1) {
                db.close();
                return reject(e1);
            }
            db.get(
                "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
                [TABLE_NAME],
                (e2, row) => {
                    if (e2) {
                        db.close();
                        return reject(e2);
                    }
                    if (!row) {
                        console.log('ℹ️', TABLE_NAME, 'tablosu yok, VIEW oluşturulmadı.');
                        db.close();
                        return resolve(false);
                    }
                    db.run(`CREATE VIEW ${VIEW_NAME} AS SELECT * FROM ${TABLE_NAME}`, (e3) => {
                        db.close();
                        if (e3) return reject(e3);
                        console.log('✅ VIEW', VIEW_NAME, '→', TABLE_NAME);
                        resolve(true);
                    });
                }
            );
        });
    });
}

run()
    .then((ok) => {
        process.exit(0);
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
