/**
 * Migration: tenants_fatura_kalemleri tablosunu kaldır
 * Fatura kalemleri uygulama tarafında kullanılmıyor; tutarlar tenants_faturalar üzerinden gidiyor.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '..', 'floovon_professional.db');

async function dropTenantsFaturaKalemleriTable() {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(dbPath)) {
            console.log('⚠️ Veritabanı dosyası bulunamadı:', dbPath);
            resolve();
            return;
        }

        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
            if (err) {
                console.error('❌ Veritabanı bağlantı hatası:', err);
                reject(err);
                return;
            }

            db.run(`DROP TABLE IF EXISTS tenants_fatura_kalemleri`, (err) => {
                if (err) {
                    console.error('❌ Tablo silinirken hata:', err.message);
                    db.close();
                    reject(err);
                    return;
                }
                console.log('✅ tenants_fatura_kalemleri tablosu kaldırıldı (yoksa atlandı)');
                db.close((closeErr) => {
                    if (closeErr) reject(closeErr);
                    else resolve();
                });
            });
        });
    });
}

if (require.main === module) {
    dropTenantsFaturaKalemleriTable()
        .then(() => {
            console.log('🎉 Migration tamamlandı.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Migration hatası:', error);
            process.exit(1);
        });
}

module.exports = { dropTenantsFaturaKalemleriTable };
