/**
 * Analiz: Tüm tablolarda created_by / updated_by kolonları ve dolu mu?
 * Çalıştırma: NODE_PATH=backend/node_modules node migrations/analyze-created-by-updated-by.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.resolve(__dirname, '..', 'backend', 'floovon_professional.db');

function analyze() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
            if (err) return reject(err);
        });

        db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name", [], (err, tables) => {
            if (err) {
                db.close();
                return reject(err);
            }

            const report = { tables: [], withColumns: [], withoutColumns: [], summary: {} };
            let pending = tables.length;
            if (pending === 0) {
                db.close();
                return resolve(report);
            }

            tables.forEach((t) => {
                const tableName = t.name;
                db.all(`PRAGMA table_info(${tableName})`, [], (pErr, columns) => {
                    const colNames = (columns || []).map((c) => c.name);
                    const hasCreatedBy = colNames.includes('created_by');
                    const hasUpdatedBy = colNames.includes('updated_by');
                    const entry = {
                        table: tableName,
                        has_created_by: hasCreatedBy,
                        has_updated_by: hasUpdatedBy,
                        total_rows: null,
                        created_by_filled: null,
                        updated_by_filled: null,
                        created_by_null: null,
                        updated_by_null: null,
                    };

                    if (hasCreatedBy || hasUpdatedBy) {
                        report.withColumns.push(tableName);
                    } else {
                        report.withoutColumns.push(tableName);
                    }

                    const countSql = `SELECT COUNT(*) as total,
                        ${hasCreatedBy ? 'SUM(CASE WHEN created_by IS NOT NULL AND created_by != "" THEN 1 ELSE 0 END) as cb_filled, SUM(CASE WHEN created_by IS NULL OR created_by = "" THEN 1 ELSE 0 END) as cb_null' : '0 as cb_filled, 0 as cb_null'},
                        ${hasUpdatedBy ? 'SUM(CASE WHEN updated_by IS NOT NULL AND updated_by != "" THEN 1 ELSE 0 END) as ub_filled, SUM(CASE WHEN updated_by IS NULL OR updated_by = "" THEN 1 ELSE 0 END) as ub_null' : '0 as ub_filled, 0 as ub_null'}
                    FROM ${tableName}`;
                    db.get(countSql, [], (cErr, row) => {
                        if (!cErr && row) {
                            entry.total_rows = row.total;
                            entry.created_by_filled = hasCreatedBy ? row.cb_filled : null;
                            entry.updated_by_filled = hasUpdatedBy ? row.ub_filled : null;
                            entry.created_by_null = hasCreatedBy ? row.cb_null : null;
                            entry.updated_by_null = hasUpdatedBy ? row.ub_null : null;
                        }
                        report.tables.push(entry);
                        pending--;
                        if (pending === 0) {
                            report.summary = {
                                total_tables: tables.length,
                                tables_with_created_by_or_updated_by: report.withColumns.length,
                                tables_without: report.withoutColumns.length,
                            };
                            db.close();
                            resolve(report);
                        }
                    });
                });
            });
        });
    });
}

analyze()
    .then((report) => {
        console.log(JSON.stringify(report, null, 2));
        process.exit(0);
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
