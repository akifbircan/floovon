#!/usr/bin/env node
/**
 * Localhost ve sunucudaki plan verilerini karşılaştırır
 * 
 * Kullanım:
 *   node scripts/check-plans-sync.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../floovon_professional.db');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('❌ Veritabanı bağlantı hatası:', err);
        process.exit(1);
    }
    console.log('✅ Veritabanına bağlandı\n');
});

console.log('📋 Plan verileri kontrol ediliyor...\n');

db.all(`
    SELECT 
        id,
        plan_adi,
        plan_kodu,
        aylik_ucret,
        COALESCE(yillik_ucret, NULL) as yillik_ucret,
        max_kullanici,
        max_depolama_gb,
        aktif_mi
    FROM tenants_abonelik_planlari 
    ORDER BY id ASC
`, [], (err, plans) => {
    if (err) {
        console.error('❌ Planlar alınamadı:', err);
        db.close();
        process.exit(1);
    }

    console.log(`✅ ${plans.length} plan bulundu:\n`);
    console.log('='.repeat(80));
    console.log('PLAN LİSTESİ');
    console.log('='.repeat(80));
    
    plans.forEach((plan, index) => {
        console.log(`\n${index + 1}. ${plan.plan_adi} (${plan.plan_kodu})`);
        console.log(`   Aylık: ₺${plan.aylik_ucret}`);
        if (plan.yillik_ucret) {
            console.log(`   Yıllık: ₺${plan.yillik_ucret}`);
        } else {
            console.log(`   Yıllık: Hesaplanacak (₺${Math.round(plan.aylik_ucret * 12 * 0.8)})`);
        }
        console.log(`   Max Kullanıcı: ${plan.max_kullanici}`);
        console.log(`   Max Depolama: ${plan.max_depolama_gb} GB`);
        console.log(`   Durum: ${plan.aktif_mi ? 'Aktif' : 'Pasif'}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Kontrol tamamlandı!');
    console.log('\n💡 Sunucudaki planları görmek için:');
    console.log('   ssh akifbircan@panel.floovon.com');
    console.log('   cd /home/floovon/htdocs/panel.floovon.com/backend');
    console.log('   node scripts/check-plans-sync.js');
    console.log('='.repeat(80) + '\n');
    
    db.close();
    process.exit(0);
});

