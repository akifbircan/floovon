/**
 * Kullanılmayan tabloları veritabanından kaldırır:
 * - partner_cari_hareketler_yeni: Sadece migration sırasında geçici kullanılıyor; kalırsa silinir.
 * - partner_siparisler: Backend'de hiç kullanılmıyor (alınan/verilen siparişler siparisler tablosundan geliyor).
 *
 * Çalıştırma: node migrations/drop-unused-partner-tables.js
 */

const path = require('path');
const sqlite3 = require(path.resolve(__dirname, '..', 'backend', 'node_modules', 'sqlite3')).verbose();

const DB_PATH = path.resolve(__dirname, '..', 'backend', 'floovon_professional.db');

const TABLES_TO_DROP = ['partner_cari_hareketler_yeni', 'partner_siparisler'];

function run() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, (err) => {
            if (err) {
                console.error('Veritabanı bağlantı hatası:', err.message);
                return reject(err);
            }
        });

        let i = 0;
        const dropped = [];

        function next() {
            if (i >= TABLES_TO_DROP.length) {
                db.close();
                return resolve(dropped);
            }
            const table = TABLES_TO_DROP[i++];
            db.get(
                "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
                [table],
                (err, row) => {
                    if (err) {
                        db.close();
                        return reject(err);
                    }
                    if (!row) {
                        console.log('ℹ️', table, 'zaten yok, atlanıyor.');
                        return next();
                    }
                    db.run(`DROP TABLE ${table}`, (e) => {
                        if (e) {
                            console.error('❌', table, 'silinirken hata:', e.message);
                        } else {
                            dropped.push(table);
                            console.log('✅', table, 'silindi.');
                        }
                        next();
                    });
                }
            );
        }

        console.log('Kullanılmayan partner tabloları kontrol ediliyor...');
        next();
    });
}

run()
    .then((dropped) => {
        console.log('Tamam. Silinen tablo sayısı:', dropped.length);
        process.exit(0);
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
