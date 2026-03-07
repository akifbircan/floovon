/**
 * Abonelik planlarının özelliklerini güncelle
 * Mevcut kayıtları projeye uygun özelliklerle günceller
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'floovon_professional.db');

function updatePlanOzellikler() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Veritabanına bağlanılamadı:', err.message);
                return reject(err);
            }
            console.log('✅ Veritabanına bağlanıldı');
        });

        // Plan özelliklerini güncelle
        const planOzellikler = {
            'basic': JSON.stringify([
                '10 kullanıcıya kadar',
                '100 GB depolama alanı',
                'Temel sipariş ve müşteri yönetimi'
            ]),
            'pro_kurumsal': JSON.stringify([
                '50 kullanıcıya kadar',
                '1000 GB depolama alanı',
                'Gelişmiş raporlama ve API erişimi'
            ]),
            'enterprise': JSON.stringify([
                '200 kullanıcıya kadar',
                '5000 GB depolama alanı',
                '7/24 öncelikli destek ve özel entegrasyonlar'
            ])
        };

        // Her plan için güncelleme yap
        const planKodlari = Object.keys(planOzellikler);
        let completed = 0;
        let errors = 0;

        planKodlari.forEach((planKodu) => {
            db.run(
                `UPDATE tenants_abonelik_planlari 
                 SET ozellikler = ?, guncelleme_tarihi = CURRENT_TIMESTAMP 
                 WHERE plan_kodu = ?`,
                [planOzellikler[planKodu], planKodu],
                function(err) {
                    if (err) {
                        console.error(`❌ ${planKodu} planı güncellenirken hata:`, err.message);
                        errors++;
                    } else {
                        if (this.changes > 0) {
                            console.log(`✅ ${planKodu} planı güncellendi (${this.changes} kayıt)`);
                        } else {
                            console.log(`⚠️ ${planKodu} planı bulunamadı veya zaten güncel`);
                        }
                    }
                    
                    completed++;
                    if (completed === planKodlari.length) {
                        db.close((err) => {
                            if (err) {
                                console.error('❌ Veritabanı kapatılırken hata:', err.message);
                                return reject(err);
                            }
                            console.log('✅ Plan özellikleri güncelleme tamamlandı');
                            if (errors > 0) {
                                console.warn(`⚠️ ${errors} plan güncellenirken hata oluştu`);
                            }
                            resolve();
                        });
                    }
                }
            );
        });
    });
}

// Script doğrudan çalıştırılırsa
if (require.main === module) {
    updatePlanOzellikler()
        .then(() => {
            console.log('✅ Migration tamamlandı');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Migration hatası:', error);
            process.exit(1);
        });
}

module.exports = { updatePlanOzellikler };

