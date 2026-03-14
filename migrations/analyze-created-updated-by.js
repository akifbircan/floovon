/**
 * Analiz: Tüm tablolarda created_by / updated_by kolonları ve doldurulma durumu
 * sqlite3 backend'den yüklendiği için proje kökünden çalıştırılabilir.
 *
 * Çalıştırma: node migrations/analyze-created-updated-by.js
 */

const path = require('path');
const sqlite3 = require(path.resolve(__dirname, '..', 'backend', 'node_modules', 'sqlite3')).verbose();

const DB_PATH = path.resolve(__dirname, '..', 'backend', 'floovon_professional.db');

function runAnalysis() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('Veritabanı bağlantı hatası:', err.message);
                return reject(err);
            }
        });

        db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name", [], (err, tables) => {
            if (err) {
                db.close();
                return reject(err);
            }

            const results = [];
            let index = 0;

            function next() {
                if (index >= tables.length) {
                    db.close();
                    return resolve(results);
                }
                const table = tables[index].name;
                index++;

                db.all(`PRAGMA table_info(${table})`, [], (pErr, columns) => {
                    if (pErr) {
                        results.push({ table, error: pErr.message, hasCreatedBy: false, hasUpdatedBy: false });
                        return next();
                    }
                    const names = (columns || []).map((c) => c.name);
                    const hasCreatedBy = names.includes('created_by');
                    const hasUpdatedBy = names.includes('updated_by');

                    if (!hasCreatedBy && !hasUpdatedBy) {
                        results.push({ table, hasCreatedBy: false, hasUpdatedBy: false, total: null, filledCreated: null, filledUpdated: null });
                        return next();
                    }

                    const selects = ['COUNT(*) AS total'];
                    if (hasCreatedBy) selects.push("SUM(CASE WHEN created_by IS NOT NULL AND created_by != '' THEN 1 ELSE 0 END) AS filled_created");
                    if (hasUpdatedBy) selects.push("SUM(CASE WHEN updated_by IS NOT NULL AND updated_by != '' THEN 1 ELSE 0 END) AS filled_updated");

                    db.get(`SELECT ${selects.join(', ')} FROM ${table}`, [], (cErr, row) => {
                        if (cErr) {
                            results.push({ table, hasCreatedBy, hasUpdatedBy, error: cErr.message });
                        } else {
                            results.push({
                                table,
                                hasCreatedBy,
                                hasUpdatedBy,
                                total: row.total || 0,
                                filledCreated: hasCreatedBy ? (row.filled_created || 0) : null,
                                filledUpdated: hasUpdatedBy ? (row.filled_updated || 0) : null,
                            });
                        }
                        next();
                    });
                });
            }

            next();
        });
    });
}

function printReport(results) {
    const withCols = results.filter((r) => r.hasCreatedBy || r.hasUpdatedBy);
    const withoutCols = results.filter((r) => !r.hasCreatedBy && !r.hasUpdatedBy && !r.error);

    console.log('\n========== TABLOLARDA created_by / updated_by KOLON DURUMU ==========\n');

    console.log('--- Kolonu OLAN tablolar (doldurulma özeti) ---\n');
    for (const r of withCols) {
        if (r.error) {
            console.log(`${r.table}: HATA ${r.error}`);
            continue;
        }
        const total = r.total ?? 0;
        const c = r.hasCreatedBy ? (r.filledCreated ?? 0) : '-';
        const u = r.hasUpdatedBy ? (r.filledUpdated ?? 0) : '-';
        const cStr = r.hasCreatedBy ? `${c}/${total}` : 'yok';
        const uStr = r.hasUpdatedBy ? `${u}/${total}` : 'yok';
        const status = total === 0 ? '(boş tablo)' : (r.hasCreatedBy && r.filledCreated === 0 && r.hasUpdatedBy && r.filledUpdated === 0 ? ' UYARI: Hiç dolu değil' : '');
        console.log(`${r.table}: satır=${total}  created_by=${cStr}  updated_by=${uStr}${status}`);
    }

    console.log('\n--- created_by / updated_by kolonu OLMAYAN tablolar ---\n');
    withoutCols.forEach((r) => console.log(r.table));
    console.log('\nToplam: ' + withCols.length + ' tabloda kolon var, ' + withoutCols.length + ' tabloda yok.\n');
}

runAnalysis()
    .then((results) => {
        printReport(results);
        process.exit(0);
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
