/**
 * Başlangıç planına 3 özellik ekle (7'den 10'a çıkarmak için)
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'floovon_professional.db');

function addFeaturesToBaslangicPlan() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Veritabanına bağlanılamadı:', err.message);
                return reject(err);
            }
            console.log('✅ Veritabanına bağlanıldı');
        });

        // Önce mevcut başlangıç planını bul
        db.get('SELECT id, plan_kodu, ozellikler FROM tenants_abonelik_planlari WHERE plan_kodu = ?', ['baslangic'], (err, plan) => {
            if (err) {
                console.error('❌ Plan sorgulanırken hata:', err);
                db.close();
                return reject(err);
            }

            if (!plan) {
                console.warn('⚠️ Başlangıç planı bulunamadı (plan_kodu: baslangic)');
                db.close();
                return resolve();
            }

            // Mevcut özellikleri parse et
            let currentFeatures = [];
            if (plan.ozellikler) {
                try {
                    currentFeatures = JSON.parse(plan.ozellikler);
                } catch (e) {
                    // JSON değilse, virgülle ayrılmış string olabilir
                    currentFeatures = plan.ozellikler.split(',').map(f => f.trim()).filter(f => f);
                }
            }

            console.log(`📋 Mevcut özellikler (${currentFeatures.length} adet):`, currentFeatures);

            // Yeni özellikler ekle (eğer yoksa) - 10 özelliğe tamamlamak için
            const newFeatures = [
                'Sipariş künyesi oluşturma',
                'Müşteri kartları yönetimi',
                'Temel raporlama',
                'Sipariş durumu güncelleme',
                'Teslimat takibi'
            ];

            // Mevcut özelliklerle birleştir (duplicate kontrolü)
            newFeatures.forEach(feature => {
                if (!currentFeatures.includes(feature)) {
                    currentFeatures.push(feature);
                }
            });

            console.log(`📋 Yeni özellikler (${currentFeatures.length} adet):`, currentFeatures);

            // Veritabanını güncelle
            const updatedFeatures = JSON.stringify(currentFeatures);
            db.run(
                'UPDATE tenants_abonelik_planlari SET ozellikler = ?, guncelleme_tarihi = CURRENT_TIMESTAMP WHERE id = ?',
                [updatedFeatures, plan.id],
                (err) => {
                    if (err) {
                        console.error('❌ Plan güncellenirken hata:', err);
                        db.close();
                        return reject(err);
                    }
                    console.log(`✅ Başlangıç planı güncellendi: ${currentFeatures.length} özellik`);
                    db.close();
                    resolve();
                }
            );
        });
    });
}

// Script doğrudan çalıştırılırsa
if (require.main === module) {
    addFeaturesToBaslangicPlan()
        .then(() => {
            console.log('✅ Migration tamamlandı');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Migration hatası:', error);
            process.exit(1);
        });
}

module.exports = addFeaturesToBaslangicPlan;

