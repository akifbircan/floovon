const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../floovon_professional.db');

/**
 * Localhost'tan export edilen plan verilerini sunucuya aktarır
 * 
 * Bu migration:
 * 1. plans-export.json dosyasından plan verilerini okur
 * 2. Mevcut planları günceller veya yeni planlar ekler
 * 3. plan_kodu'na göre eşleştirme yapar
 */
async function syncPlansFromLocalhost() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Veritabanı bağlantı hatası:', err);
                return reject(err);
            }
            console.log('✅ Veritabanına bağlandı');
        });

        // plans-export.json dosyasını oku
        const exportPath = path.resolve(__dirname, '../plans-export.json');
        
        if (!fs.existsSync(exportPath)) {
            console.error('❌ plans-export.json dosyası bulunamadı!');
            console.log('   Önce localhost\'ta şu komutu çalıştırın:');
            console.log('   node scripts/export-plans-data.js');
            db.close();
            return reject(new Error('Export dosyası bulunamadı'));
        }

        let plansData;
        try {
            const fileContent = fs.readFileSync(exportPath, 'utf8');
            plansData = JSON.parse(fileContent);
        } catch (error) {
            console.error('❌ Export dosyası okunamadı:', error);
            db.close();
            return reject(error);
        }

        if (!Array.isArray(plansData) || plansData.length === 0) {
            console.log('⚠️  Export dosyasında plan verisi yok');
            db.close();
            return resolve();
        }

        console.log(`📋 ${plansData.length} plan aktarılacak...\n`);

        let processed = 0;
        const total = plansData.length;

        // Önce yillik_ucret kolonunun var olduğundan emin ol
        db.all(`PRAGMA table_info(tenants_abonelik_planlari)`, [], (err, columns) => {
            if (err) {
                console.error('❌ Tablo bilgisi alınamadı:', err);
                db.close();
                return reject(err);
            }

            const columnNames = columns.map(col => col.name.toLowerCase());
            const hasYillikUcret = columnNames.includes('yillik_ucret');

            if (!hasYillikUcret) {
                console.log('📋 yillik_ucret kolonu ekleniyor...');
                db.run('ALTER TABLE tenants_abonelik_planlari ADD COLUMN yillik_ucret INTEGER', (err) => {
                    if (err) {
                        console.warn('⚠️  yillik_ucret kolonu eklenemedi (devam ediliyor):', err.message);
                    } else {
                        console.log('✅ yillik_ucret kolonu eklendi\n');
                    }
                    processPlans();
                });
            } else {
                processPlans();
            }

            function processPlans() {
                // SEÇENEK 2: ÖNCE TÜM PLANLARI TEMİZLE, SONRA LOCALHOST'TAKİ PLANLARI EKLE
                console.log('\n🗑️  TÜM PLANLAR TEMİZLENİYOR...\n');
                
                // Önce aktif abonelikleri kontrol et (uyarı için)
                db.all('SELECT DISTINCT plan_id FROM tenants_abonelikler WHERE plan_id IS NOT NULL', [], (err, activeSubscriptions) => {
                    if (!err && activeSubscriptions && activeSubscriptions.length > 0) {
                        console.warn(`⚠️  UYARI: ${activeSubscriptions.length} aktif abonelik bulundu!`);
                        console.warn(`⚠️  Bu planlar silinecek, abonelikler etkilenebilir!`);
                        console.warn(`⚠️  Devam ediliyor...\n`);
                    }
                });

                // TÜM PLANLARI SİL
                db.run('DELETE FROM tenants_abonelik_planlari', (err) => {
                    if (err) {
                        console.error('❌ Planlar silinirken hata:', err);
                        db.close();
                        return reject(err);
                    }
                    console.log('✅ Tüm planlar silindi!');
                    console.log('📋 Şimdi localhosttaki planlar ekleniyor...\n');
                    
                    // Plan sayacı
                    let processed = 0;
                    const total = plansData.length;

                    // Şimdi localhost'taki planları EKLE (tüm planlar silindi, sadece INSERT yap)
                    plansData.forEach((plan) => {
                        let insertSql;
                        let insertParams;
                        
                        if (hasYillikUcret) {
                            insertSql = `INSERT INTO tenants_abonelik_planlari (plan_adi, plan_kodu, aylik_ucret, yillik_ucret, max_kullanici, max_depolama_gb, ozellikler, aktif_mi) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
                            insertParams = [
                                plan.plan_adi,
                                plan.plan_kodu,
                                plan.aylik_ucret,
                                plan.yillik_ucret || null,
                                plan.max_kullanici,
                                plan.max_depolama_gb,
                                plan.ozellikler || null,
                                plan.aktif_mi !== undefined ? plan.aktif_mi : 1
                            ];
                        } else {
                            insertSql = `INSERT INTO tenants_abonelik_planlari (plan_adi, plan_kodu, aylik_ucret, max_kullanici, max_depolama_gb, ozellikler, aktif_mi) VALUES (?, ?, ?, ?, ?, ?, ?)`;
                            insertParams = [
                                plan.plan_adi,
                                plan.plan_kodu,
                                plan.aylik_ucret,
                                plan.max_kullanici,
                                plan.max_depolama_gb,
                                plan.ozellikler || null,
                                plan.aktif_mi !== undefined ? plan.aktif_mi : 1
                            ];
                        }

                        db.run(insertSql, insertParams, (err) => {
                            if (err) {
                                console.error(`❌ Plan eklenemedi (${plan.plan_kodu}):`, err.message);
                            } else {
                                console.log(`✅ Plan eklendi: ${plan.plan_adi} (${plan.plan_kodu})`);
                            }
                            processed++;
                            if (processed === total) {
                                console.log('\n✅ Tüm planlar aktarıldı!');
                                console.log(`📊 Toplam ${total} plan eklendi.`);
                                db.close();
                                resolve();
                            }
                        });
                    });
                });
            }
        });
    });
}

// Eğer doğrudan çalıştırılıyorsa
if (require.main === module) {
    syncPlansFromLocalhost()
        .then(() => {
            console.log('✅ Migration tamamlandı');
            process.exit(0);
        })
        .catch((err) => {
            console.error('❌ Migration hatası:', err);
            process.exit(1);
        });
}

module.exports = syncPlansFromLocalhost;

