#!/usr/bin/env node
/**
 * Tüm migration'ları çalıştırır
 * Sunucuda migration'ları manuel olarak çalıştırmak için kullanılır
 * 
 * Kullanım:
 *   node run-migrations.js
 *   veya
 *   npm run migrations
 */

const path = require('path');

console.log('🔄 Migration\'lar çalıştırılıyor...\n');

async function runMigrations() {
    try {
        // 1. Billing tablolarını oluştur
        console.log('📋 1. Billing tabloları oluşturuluyor...');
        const { createTenantsBillingTables } = require('./migrations/create-tenants-billing-tables');
        await createTenantsBillingTables();
        console.log('✅ Billing tabloları hazır\n');

        // 2. Plan özelliklerini güncelle
        console.log('📋 2. Plan özellikleri güncelleniyor...');
        const { updatePlanOzellikler } = require('./migrations/update-plan-ozellikler');
        await updatePlanOzellikler();
        console.log('✅ Plan özellikleri güncellendi\n');

        // 3. plan_adi -> plan_id migration (GEÇİCİ OLARAK DEVRE DIŞI - Syntax hatası var)
        // console.log('📋 3. plan_adi -> plan_id migration çalıştırılıyor...');
        // const { migratePlanAdiToPlanId } = require('./migrations/migrate-plan-adi-to-plan-id');
        // await migratePlanAdiToPlanId();
        // console.log('✅ plan_adi -> plan_id migration tamamlandı\n');
        console.log('⚠️  plan_adi -> plan_id migration geçici olarak devre dışı (syntax hatası düzeltilecek)\n');

        // 4. tenants_abonelikler tablosuna eksik kolonları ekle
        console.log('📋 4. tenants_abonelikler tablosuna eksik kolonlar ekleniyor...');
        const addMissingColumnsToAbonelikler = require('./migrations/add-indirim-tutari-to-abonelikler');
        await addMissingColumnsToAbonelikler();
        console.log('✅ Eksik kolonlar eklendi\n');

        // 5. Sayfa erişim izinleri tablosunu oluştur
        console.log('📋 5. Sayfa erişim izinleri tablosu oluşturuluyor...');
        const { createPagePermissionsTable } = require('./migrations/create-page-permissions-table');
        await createPagePermissionsTable();
        console.log('✅ Sayfa erişim izinleri tablosu hazır\n');

        // 6. page_permissions tablosuna tenant_id ekle
        console.log('📋 6. page_permissions tablosuna tenant_id ekleniyor...');
        const { addTenantIdToPagePermissions } = require('./migrations/add-tenant-id-to-page-permissions');
        await addTenantIdToPagePermissions();
        console.log('✅ tenant_id kolonu eklendi\n');

        // 7. Tüm tenant'lar için varsayılan izinleri ekle
        console.log('📋 7. Tüm tenant\'lar için varsayılan izinler ekleniyor...');
        const { addDefaultPermissionsForAllTenants } = require('./migrations/add-default-permissions-for-all-tenants');
        await addDefaultPermissionsForAllTenants();
        console.log('✅ Varsayılan izinler eklendi\n');

        // 8. page_permissions tablosundan profil-ayarlari kayıtlarını kaldır
        console.log('📋 8. page_permissions tablosundan profil-ayarlari kayıtları kaldırılıyor...');
        const { removeProfilAyarlariFromPagePermissions } = require('./migrations/remove-profil-ayarlari-from-page-permissions');
        await removeProfilAyarlariFromPagePermissions();
        console.log('✅ profil-ayarlari kayıtları kaldırıldı\n');

        // 9. tenants_abonelikler tablosuna iptal_nedeni ve islem_sahibi kolonlarını ekle
        console.log('📋 9. tenants_abonelikler tablosuna iptal_nedeni ve islem_sahibi kolonları ekleniyor...');
        const addIptalNedeniIslemSahibi = require('./migrations/add-iptal-nedeni-islem-sahibi-to-abonelikler');
        await addIptalNedeniIslemSahibi();
        console.log('✅ iptal_nedeni ve islem_sahibi kolonları eklendi\n');

        // 10. Çeşitli tablolara eksik kolonları ekle
        console.log('📋 10. Çeşitli tablolara eksik kolonlar ekleniyor...');
        const addMissingColumnsToVariousTables = require('./migrations/add-missing-columns-to-various-tables');
        await addMissingColumnsToVariousTables();
        console.log('✅ Eksik kolonlar eklendi\n');

        // 11. Plan sync KALDIRILDI – plan tablosuna migration dokunmaz. DB'yi sen yukleyerek yonetiyorsun.

        console.log('✅ Tüm migration\'lar başarıyla tamamlandı!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration hatası:', error);
        console.error('❌ Error stack:', error.stack);
        process.exit(1);
    }
}

// Script doğrudan çalıştırılıyorsa
if (require.main === module) {
    runMigrations();
}

module.exports = { runMigrations };
