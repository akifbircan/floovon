#!/usr/bin/env node
/**
 * Localhost ve sunucu veritabanı şemaları arasındaki farkları tespit eder
 * 
 * Kullanım:
 *   node scripts/check-schema-diff.js
 * 
 * Bu script, localhost'taki veritabanı şemasını analiz eder ve
 * hangi tabloların/kolonların eksik olduğunu gösterir.
 * Sunucuda çalıştırıldığında sunucudaki şemayı analiz eder.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../floovon_professional.db');

/**
 * Veritabanı şemasını analiz eder
 */
function analyzeSchema(db) {
    return new Promise((resolve, reject) => {
        db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", [], (err, tables) => {
            if (err) {
                return reject(err);
            }

            const schema = {};
            let completed = 0;
            const total = tables.length;

            if (total === 0) {
                return resolve(schema);
            }

            tables.forEach(table => {
                db.all(`PRAGMA table_info(${table.name})`, [], (err, columns) => {
                    if (err) {
                        console.error(`❌ ${table.name} tablosu için kolon bilgisi alınamadı:`, err);
                    } else {
                        schema[table.name] = {
                            columns: columns.map(col => ({
                                name: col.name,
                                type: col.type,
                                notnull: col.notnull,
                                dflt_value: col.dflt_value,
                                pk: col.pk
                            }))
                        };
                    }

                    completed++;
                    if (completed === total) {
                        resolve(schema);
                    }
                });
            });
        });
    });
}

/**
 * İki şema arasındaki farkları bulur
 */
function findDifferences(localSchema, serverSchema) {
    const differences = {
        newTables: [],
        missingTables: [],
        newColumns: {},
        missingColumns: {},
        modifiedColumns: {}
    };

    // Yeni tablolar (local'de var, sunucuda yok)
    for (const tableName in localSchema) {
        if (!serverSchema[tableName]) {
            differences.newTables.push(tableName);
        }
    }

    // Eksik tablolar (sunucuda var, local'de yok)
    for (const tableName in serverSchema) {
        if (!localSchema[tableName]) {
            differences.missingTables.push(tableName);
        }
    }

    // Kolon farkları
    for (const tableName in localSchema) {
        if (serverSchema[tableName]) {
            const localCols = localSchema[tableName].columns;
            const serverCols = serverSchema[tableName].columns;
            const localColNames = localCols.map(c => c.name.toLowerCase());
            const serverColNames = serverCols.map(c => c.name.toLowerCase());

            // Yeni kolonlar
            localCols.forEach(col => {
                if (!serverColNames.includes(col.name.toLowerCase())) {
                    if (!differences.newColumns[tableName]) {
                        differences.newColumns[tableName] = [];
                    }
                    differences.newColumns[tableName].push(col);
                }
            });

            // Eksik kolonlar
            serverCols.forEach(col => {
                if (!localColNames.includes(col.name.toLowerCase())) {
                    if (!differences.missingColumns[tableName]) {
                        differences.missingColumns[tableName] = [];
                    }
                    differences.missingColumns[tableName].push(col);
                }
            });
        }
    }

    return differences;
}

/**
 * Şemayı JSON dosyasına kaydeder
 */
function saveSchemaToFile(schema, filePath) {
    fs.writeFileSync(filePath, JSON.stringify(schema, null, 2), 'utf8');
    console.log(`✅ Şema kaydedildi: ${filePath}`);
}

/**
 * JSON dosyasından şemayı yükler
 */
function loadSchemaFromFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
}

/**
 * Farkları konsola yazdırır
 */
function printDifferences(differences) {
    console.log('\n📊 VERİTABANI ŞEMA FARKLARI\n');
    console.log('='.repeat(60));

    if (differences.newTables.length > 0) {
        console.log('\n🆕 YENİ TABLOLAR (Localhost\'ta var, sunucuda yok):');
        differences.newTables.forEach(table => {
            console.log(`   - ${table}`);
        });
    }

    if (differences.missingTables.length > 0) {
        console.log('\n⚠️  EKSİK TABLOLAR (Sunucuda var, localhost\'ta yok):');
        differences.missingTables.forEach(table => {
            console.log(`   - ${table}`);
        });
    }

    if (Object.keys(differences.newColumns).length > 0) {
        console.log('\n🆕 YENİ KOLONLAR (Localhost\'ta var, sunucuda yok):');
        for (const tableName in differences.newColumns) {
            console.log(`\n   📋 Tablo: ${tableName}`);
            differences.newColumns[tableName].forEach(col => {
                console.log(`      + ${col.name} (${col.type})`);
            });
        }
    }

    if (Object.keys(differences.missingColumns).length > 0) {
        console.log('\n⚠️  EKSİK KOLONLAR (Sunucuda var, localhost\'ta yok):');
        for (const tableName in differences.missingColumns) {
            console.log(`\n   📋 Tablo: ${tableName}`);
            differences.missingColumns[tableName].forEach(col => {
                console.log(`      - ${col.name} (${col.type})`);
            });
        }
    }

    if (differences.newTables.length === 0 && 
        differences.missingTables.length === 0 && 
        Object.keys(differences.newColumns).length === 0 && 
        Object.keys(differences.missingColumns).length === 0) {
        console.log('\n✅ Şemalar eşleşiyor! Fark yok.');
    }

    console.log('\n' + '='.repeat(60) + '\n');
}

// Ana fonksiyon
async function main() {
    const args = process.argv.slice(2);
    const mode = args[0] || 'analyze'; // analyze, compare, export

    if (!fs.existsSync(dbPath)) {
        console.error('❌ Veritabanı dosyası bulunamadı:', dbPath);
        process.exit(1);
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error('❌ Veritabanı bağlantı hatası:', err);
            process.exit(1);
        }
        console.log('✅ Veritabanına bağlandı\n');
    });

    try {
        if (mode === 'export') {
            // Şemayı JSON dosyasına kaydet
            const schema = await analyzeSchema(db);
            const outputPath = path.resolve(__dirname, '../schema-export.json');
            saveSchemaToFile(schema, outputPath);
            console.log(`\n📄 Şema bilgisi ${outputPath} dosyasına kaydedildi.`);
            console.log('   Bu dosyayı sunucuya kopyalayıp karşılaştırma yapabilirsiniz.\n');
        } else if (mode === 'compare') {
            // İki şema dosyasını karşılaştır
            const localSchemaPath = path.resolve(__dirname, '../schema-local.json');
            const serverSchemaPath = path.resolve(__dirname, '../schema-server.json');

            const localSchema = loadSchemaFromFile(localSchemaPath);
            const serverSchema = loadSchemaFromFile(serverSchemaPath);

            if (!localSchema) {
                console.error(`❌ Local şema dosyası bulunamadı: ${localSchemaPath}`);
                console.log('   Önce "node scripts/check-schema-diff.js export" komutunu çalıştırın.');
                process.exit(1);
            }

            if (!serverSchema) {
                console.error(`❌ Sunucu şema dosyası bulunamadı: ${serverSchemaPath}`);
                console.log('   Sunucuda da "node scripts/check-schema-diff.js export" komutunu çalıştırın.');
                process.exit(1);
            }

            const differences = findDifferences(localSchema, serverSchema);
            printDifferences(differences);
        } else {
            // Sadece mevcut şemayı analiz et ve göster
            const schema = await analyzeSchema(db);
            
            console.log('📊 VERİTABANI ŞEMA BİLGİSİ\n');
            console.log('='.repeat(60));
            
            for (const tableName in schema) {
                console.log(`\n📋 Tablo: ${tableName}`);
                console.log(`   Kolon sayısı: ${schema[tableName].columns.length}`);
                schema[tableName].columns.forEach(col => {
                    const pk = col.pk ? ' [PK]' : '';
                    const nn = col.notnull ? ' [NOT NULL]' : '';
                    const def = col.dflt_value ? ` [DEFAULT: ${col.dflt_value}]` : '';
                    console.log(`   - ${col.name} (${col.type})${pk}${nn}${def}`);
                });
            }
            
            console.log('\n' + '='.repeat(60));
            console.log(`\n💡 İpucu: Şemayı export etmek için:`);
            console.log(`   node scripts/check-schema-diff.js export`);
            console.log(`\n💡 İki şemayı karşılaştırmak için:`);
            console.log(`   node scripts/check-schema-diff.js compare\n`);
        }
    } catch (error) {
        console.error('❌ Hata:', error);
        process.exit(1);
    } finally {
        db.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = { analyzeSchema, findDifferences };

