#!/usr/bin/env node
/**
 * Localhost'taki plan verilerini export eder
 * 
 * Kullanım:
 *   node scripts/export-plans-data.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../floovon_professional.db');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('❌ Veritabanı bağlantı hatası:', err);
        process.exit(1);
    }
    console.log('✅ Veritabanına bağlandı\n');
});

console.log('📋 Plan verileri export ediliyor...\n');

db.all(`
    SELECT 
        id,
        plan_adi,
        plan_kodu,
        aylik_ucret,
        COALESCE(yillik_ucret, NULL) as yillik_ucret,
        max_kullanici,
        max_depolama_gb,
        ozellikler,
        aktif_mi,
        olusturma_tarihi,
        guncelleme_tarihi
    FROM tenants_abonelik_planlari 
    ORDER BY id ASC
`, [], (err, plans) => {
    if (err) {
        console.error('❌ Planlar alınamadı:', err);
        db.close();
        process.exit(1);
    }

    const outputPath = path.resolve(__dirname, '../plans-export.json');
    fs.writeFileSync(outputPath, JSON.stringify(plans, null, 2), 'utf8');
    
    console.log(`✅ ${plans.length} plan export edildi: ${outputPath}`);
    console.log('\n📊 Planlar:');
    plans.forEach(plan => {
        console.log(`   - ${plan.plan_adi} (${plan.plan_kodu}): ₺${plan.aylik_ucret}/ay`);
    });
    
    db.close();
    process.exit(0);
});

