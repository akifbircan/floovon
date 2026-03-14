/**
 * Migration: Soft delete için eksik kolonları ekler.
 * - musteri_tahsilatlar: is_active (INTEGER DEFAULT 1)
 * - musteri_raporlari: is_active (INTEGER DEFAULT 1)
 * - ayarlar_genel_teslimat_konumlari: aktif (INTEGER DEFAULT 1)
 *
 * Çalıştırma: node migrations/add-soft-delete-columns.js
 */

const path = require('path');
const sqlite3 = require(path.resolve(__dirname, '..', 'backend', 'node_modules', 'sqlite3')).verbose();

const DB_PATH = path.resolve(__dirname, '..', 'backend', 'floovon_professional.db');

const ADD_COLUMNS = [
    { table: 'musteri_tahsilatlar', column: 'is_active', def: 'INTEGER DEFAULT 1' },
    { table: 'musteri_raporlari', column: 'is_active', def: 'INTEGER DEFAULT 1' },
    { table: 'ayarlar_genel_teslimat_konumlari', column: 'aktif', def: 'INTEGER DEFAULT 1' },
    { table: 'araclar_takip', column: 'is_active', def: 'INTEGER DEFAULT 1' },
];

function runMigration() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, (err) => {
            if (err) {
                console.error('Veritabanı bağlantı hatası:', err.message);
                return reject(err);
            }
        });

        let index = 0;
        const added = [];

        function next() {
            if (index >= ADD_COLUMNS.length) {
                db.close();
                return resolve(added);
            }
            const { table, column, def } = ADD_COLUMNS[index++];
            db.all(`PRAGMA table_info(${table})`, [], (pErr, columns) => {
                if (pErr) {
                    console.warn('⚠️', table, pErr.message);
                    return next();
                }
                const names = (columns || []).map((c) => c.name);
                if (names.includes(column)) {
                    return next();
                }
                db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`, (e) => {
                    if (e) {
                        console.warn('⚠️', table, column, e.message);
                    } else {
                        added.push({ table, column });
                        console.log('+', table, column);
                    }
                    next();
                });
            });
        }

        console.log('Soft delete kolonları ekleniyor...');
        next();
    });
}

runMigration()
    .then((added) => {
        console.log('Tamam. Eklenen:', added.length);
        process.exit(0);
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
