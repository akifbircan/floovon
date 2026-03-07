#!/usr/bin/env node
/**
 * Sunucudaki veritabanı kolonlarını kontrol eder
 * 
 * Kullanım:
 *   node scripts/check-server-db-columns.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.argv[2] || path.resolve(__dirname, '../floovon_professional.db');

console.log('🔍 Veritabanı kolonları kontrol ediliyor...');
console.log('📁 Veritabanı:', dbPath);
console.log('');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('❌ Veritabanı bağlantı hatası:', err);
        process.exit(1);
    }
    console.log('✅ Veritabanına bağlandı\n');
});

// Kontrol edilecek tablolar ve kolonlar
const checks = [
    { table: 'tenants_abonelik_planlari', column: 'yillik_ucret', type: 'INTEGER' },
    { table: 'tenants_abonelikler', column: 'iptal_nedeni', type: 'TEXT' },
    { table: 'tenants_abonelikler', column: 'islem_sahibi', type: 'TEXT' },
    { table: 'tenants_abonelikler', column: 'indirim_tutari', type: 'INTEGER' },
    { table: 'ayarlar_genel_gonderim_ayarlari', column: 'haftalik_rapor_saat', type: 'TEXT' },
    { table: 'ayarlar_genel_teslimat_konumlari', column: 'mahalle', type: 'TEXT' },
    { table: 'ayarlar_genel_teslimat_konumlari', column: 'acik_adres', type: 'TEXT' },
    { table: 'tenants', column: 'address', type: 'TEXT' },
    { table: 'tenants', column: 'tax_office', type: 'TEXT' },
    { table: 'tenants', column: 'tax_number', type: 'TEXT' }
];

let completed = 0;
const results = {
    missing: [],
    exists: []
};

checks.forEach(({ table, column, type }) => {
    db.all(`PRAGMA table_info(${table})`, [], (err, columns) => {
        if (err) {
            console.error(`❌ ${table} tablosu için kolon bilgisi alınamadı:`, err.message);
            completed++;
            if (completed === checks.length) {
                printResults();
            }
            return;
        }

        const columnNames = columns.map(col => col.name.toLowerCase());
        const exists = columnNames.includes(column.toLowerCase());

        if (exists) {
            results.exists.push({ table, column, type });
            console.log(`✅ ${table}.${column} - VAR`);
        } else {
            results.missing.push({ table, column, type });
            console.log(`❌ ${table}.${column} - YOK`);
        }

        completed++;
        if (completed === checks.length) {
            printResults();
        }
    });
});

function printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 ÖZET');
    console.log('='.repeat(60));
    
    if (results.exists.length > 0) {
        console.log(`\n✅ Mevcut kolonlar (${results.exists.length}):`);
        results.exists.forEach(({ table, column }) => {
            console.log(`   - ${table}.${column}`);
        });
    }
    
    if (results.missing.length > 0) {
        console.log(`\n❌ Eksik kolonlar (${results.missing.length}):`);
        results.missing.forEach(({ table, column, type }) => {
            console.log(`   - ${table}.${column} (${type})`);
        });
        
        console.log('\n💡 Çözüm:');
        console.log('   Sunucuda migration\'ları çalıştırın:');
        console.log('   cd /home/floovon/htdocs/panel.floovon.com/backend');
        console.log('   node run-migrations.js');
    } else {
        console.log('\n✅ Tüm kolonlar mevcut!');
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    db.close();
    process.exit(results.missing.length > 0 ? 1 : 0);
}

