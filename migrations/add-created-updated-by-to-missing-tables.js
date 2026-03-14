/**
 * Migration: Kolonu olmayan tablolara created_by ve updated_by ekle
 * (admin_bildirimler hariç; o tabloda created_by_user kullanılıyor)
 *
 * Çalıştırma: node migrations/add-created-updated-by-to-missing-tables.js
 */

const path = require('path');
const sqlite3 = require(path.resolve(__dirname, '..', 'backend', 'node_modules', 'sqlite3')).verbose();

const DB_PATH = path.resolve(__dirname, '..', 'backend', 'floovon_professional.db');

const TABLES_TO_ADD = [
    'admin_kullanicilar',
    'araclar_gps_konum_takip',
    'araclar_takip',
    'araclar_takip_teslimatlar',
    'ayarlar_gonderim_mesaj_sablonlari',
    'musteri_raporlari',
    'partner_cari_hareketler_yeni',
    'partner_siparisler',
    'proje_kullanim_hata_logs',
    'refresh_tokens',
    'sifre_sifirlama_tokenlari',
    'tenants_abonelik_planlari',
    'tenants_abonelikler',
    'tenants_faturalar',
    'tenants_kullanicilar',
    'tenants_kullanimlar',
    'tenants_logs',
    'tenants_odeme_yontemleri',
    'tenants_sayfa_izinleri',
    'whatsapp_baglantilar_logs',
];

function runMigration() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, (err) => {
            if (err) {
                console.error('Veritabanı bağlantı hatası:', err.message);
                return reject(err);
            }
        });

        db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", [], (err, allTables) => {
            if (err) {
                db.close();
                return reject(err);
            }
            const existingNames = new Set((allTables || []).map((t) => t.name));
            const toProcess = TABLES_TO_ADD.filter((t) => existingNames.has(t));
            const missing = TABLES_TO_ADD.filter((t) => !existingNames.has(t));
            if (missing.length) console.log('Tablosu olmayan (atlanıyor):', missing.join(', '));

            let index = 0;
            const added = [];

            function next() {
                if (index >= toProcess.length) {
                    db.close();
                    console.log('\nToplam', added.length, 'kolon eklendi.');
                    return resolve(added);
                }
                const table = toProcess[index++];
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
                        else { console.log('  ' + table + ': created_by eklendi'); added.push(table + '.created_by'); }
                        checkDone();
                    });
                } else checkDone();

                if (!hasUpdatedBy) {
                    db.run(`ALTER TABLE ${table} ADD COLUMN updated_by TEXT`, (e) => {
                        if (e) console.warn('⚠️', table, 'updated_by', e.message);
                        else { console.log('  ' + table + ': updated_by eklendi'); added.push(table + '.updated_by'); }
                        checkDone();
                    });
                } else checkDone();
            });
            }

            console.log('Eksik tablolara created_by / updated_by ekleniyor...\n');
            next();
        });
    });
}

runMigration()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
