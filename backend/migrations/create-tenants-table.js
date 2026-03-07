const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../floovon_professional.db');

/**
 * Tenants tablosunu oluşturur ve varsayılan tenant'ları ekler
 */
async function createTenantsTable() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Veritabanı bağlantı hatası:', err);
                return reject(err);
            }

            console.log('✅ Veritabanına bağlandı');
        });

        // Tenants tablosunu oluştur
        db.run(`
            CREATE TABLE IF NOT EXISTS tenants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                domain TEXT UNIQUE,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                settings TEXT,
                UNIQUE(domain)
            )
        `, (err) => {
            if (err) {
                console.error('❌ Tenants tablosu oluşturulamadı:', err);
                db.close();
                return reject(err);
            }

            console.log('✅ Tenants tablosu oluşturuldu/kontrol edildi');

            // Varsayılan tenant'ları ekle (eğer yoksa)
            const defaultTenants = [
                { id: 1, name: 'Varsayılan Tenant', domain: 'default.floovon.com', is_active: 1 },
                { id: 2, name: 'Tenant 2', domain: 'tenant2.floovon.com', is_active: 1 },
                { id: 3, name: 'Tenant 3', domain: 'tenant3.floovon.com', is_active: 1 }
            ];

            let inserted = 0;
            let skipped = 0;

            defaultTenants.forEach((tenant, index) => {
                db.run(`
                    INSERT OR IGNORE INTO tenants (id, name, domain, is_active)
                    VALUES (?, ?, ?, ?)
                `, [tenant.id, tenant.name, tenant.domain, tenant.is_active], function(err) {
                    if (err) {
                        console.error(`❌ Tenant ${tenant.id} eklenemedi:`, err.message);
                    } else if (this.changes > 0) {
                        inserted++;
                        console.log(`✅ Tenant ${tenant.id} eklendi: ${tenant.name}`);
                    } else {
                        skipped++;
                        console.log(`⏭️  Tenant ${tenant.id} zaten var: ${tenant.name}`);
                    }

                    // Son tenant işlendiğinde kapat
                    if (index === defaultTenants.length - 1) {
                        console.log(`\n📊 Özet: ${inserted} yeni tenant eklendi, ${skipped} tenant zaten mevcuttu`);
                        db.close();
                        resolve();
                    }
                });
            });
        });
    });
}

// Eğer doğrudan çalıştırılıyorsa
if (require.main === module) {
    createTenantsTable()
        .then(() => {
            console.log('\n✅ Tenants tablosu hazır!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('\n❌ Hata:', err);
            process.exit(1);
        });
}

module.exports = { createTenantsTable };























