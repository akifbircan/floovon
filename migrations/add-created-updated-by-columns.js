/**
 * Migration: Kolonu olmayan tablolara created_by ve updated_by (TEXT) ekler.
 * admin_bildirimler atlanır (created_by_user kullanıyor).
 *
 * Çalıştırma: node migrations/add-created-updated-by-columns.js
 */

const path = require('path');
const sqlite3 = require(path.resolve(__dirname, '..', 'backend', 'node_modules', 'sqlite3')).verbose();

const DB_PATH = path.resolve(__dirname, '..', 'backend', 'floovon_professional.db');

const TABLES_WITHOUT_COLUMNS = [
    'admin_kullanicilar', 'araclar_gps_konum_takip', 'araclar_takip', 'araclar_takip_teslimatlar',
    'ayarlar_gonderim_mesaj_sablonlari', 'musteri_raporlari', 'partner_cari_hareketler_yeni',
    'partner_siparisler', 'proje_kullanim_hata_logs', 'refresh_tokens', 'sifre_sifirlama_tokenlari',
    'tenants_abonelik_planlari', 'tenants_abonelikler', 'tenants_faturalar', 'tenants_kullanicilar',
    'tenants_kullanimlar', 'tenants_logs', 'tenants_odeme_yontemleri', 'tenants_sayfa_izinleri',
    'whatsapp_baglantilar_logs'
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
            if (index >= TABLES_WITHOUT_COLUMNS.length) {
                db.close();
                return resolve(added);
            }
            const table = TABLES_WITHOUT_COLUMNS[index++];
            db.all(`PRAGMA table_info(${table})`, [], (pErr, columns) => {
                if (pErr) {
                    console.warn('⚠️', table, pErr.message);
                    return next();
                }
                const names = (columns || []).map((c) => c.name);
                const hasCreatedBy = names.includes('created_by');
                const hasUpdatedBy = names.includes('updated_by');

                let done = 0;
                const expect = (hasCreatedBy ? 0 : 1) + (hasUpdatedBy ? 0 : 1);
                if (expect === 0) {
                    return next();
                }

                function checkDone() {
                    done++;
                    if (done >= expect) next();
                }

                if (!hasCreatedBy) {
                    db.run(`ALTER TABLE ${table} ADD COLUMN created_by TEXT`, (e) => {
                        if (e) console.warn('⚠️', table, 'created_by', e.message);
                        else { added.push({ table, column: 'created_by' }); console.log('+', table, 'created_by'); }
                        checkDone();
                    });
                } else checkDone();
                if (!hasUpdatedBy) {
                    db.run(`ALTER TABLE ${table} ADD COLUMN updated_by TEXT`, (e) => {
                        if (e) console.warn('⚠️', table, 'updated_by', e.message);
                        else { added.push({ table, column: 'updated_by' }); console.log('+', table, 'updated_by'); }
                        checkDone();
                    });
                } else checkDone();
            });
        }

        console.log('Eksik kolonlar ekleniyor...');
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
