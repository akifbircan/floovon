const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../floovon_professional.db');

/**
 * Tenant activity logs tablosunu oluşturur
 * Tenant aktivite kayıtlarını tutar (sipariş, kullanıcı, müşteri işlemleri vb.)
 */
async function createTenantActivityLogsTable() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Veritabanı bağlantı hatası:', err);
                return reject(err);
            }

            console.log('✅ Veritabanına bağlandı');
        });

        // Tenant activity logs tablosunu oluştur
        db.run(`
            CREATE TABLE IF NOT EXISTS tenant_activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL,
                user_id INTEGER,
                user_name TEXT,
                action TEXT NOT NULL,
                target_type TEXT,
                target_id INTEGER,
                target_name TEXT,
                details TEXT,
                ip_address TEXT,
                user_agent TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `, (err) => {
            if (err) {
                console.error('❌ Tenant activity logs tablosu oluşturulamadı:', err);
                db.close();
                return reject(err);
            }

            console.log('✅ Tenant activity logs tablosu oluşturuldu/kontrol edildi');

            // Index'leri oluştur (performans için)
            db.run(`
                CREATE INDEX IF NOT EXISTS idx_tenant_activity_logs_tenant_id ON tenant_activity_logs(tenant_id)
            `, (err) => {
                if (err) {
                    console.warn('⚠️ Index oluşturulamadı:', err.message);
                } else {
                    console.log('✅ Index oluşturuldu: idx_tenant_activity_logs_tenant_id');
                }
            });

            db.run(`
                CREATE INDEX IF NOT EXISTS idx_tenant_activity_logs_created_at ON tenant_activity_logs(created_at DESC)
            `, (err) => {
                if (err) {
                    console.warn('⚠️ Index oluşturulamadı:', err.message);
                } else {
                    console.log('✅ Index oluşturuldu: idx_tenant_activity_logs_created_at');
                }
            });

            db.run(`
                CREATE INDEX IF NOT EXISTS idx_tenant_activity_logs_action ON tenant_activity_logs(action)
            `, (err) => {
                if (err) {
                    console.warn('⚠️ Index oluşturulamadı:', err.message);
                } else {
                    console.log('✅ Index oluşturuldu: idx_tenant_activity_logs_action');
                    db.close();
                    resolve();
                }
            });
        });
    });
}

// Eğer doğrudan çalıştırılıyorsa
if (require.main === module) {
    createTenantActivityLogsTable()
        .then(() => {
            console.log('\n✅ Tenant activity logs tablosu hazır!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('\n❌ Hata:', err);
            process.exit(1);
        });
}

module.exports = { createTenantActivityLogsTable };










