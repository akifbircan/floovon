const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../floovon_professional.db');

/**
 * Tenants_logs tablosunu oluşturur
 * Tenant aktivite kayıtlarını tutar
 */
async function createTenantsLogsTable() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Veritabanı bağlantı hatası:', err);
                return reject(err);
            }

            console.log('✅ Veritabanına bağlandı');
        });

        // Tenants_logs tablosunu oluştur
        db.run(`
            CREATE TABLE IF NOT EXISTS tenants_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL,
                user TEXT NOT NULL,
                action TEXT NOT NULL,
                target TEXT,
                type TEXT NOT NULL,
                ip_address TEXT,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            )
        `, (err) => {
            if (err) {
                console.error('❌ Tenants_logs tablosu oluşturulamadı:', err);
                db.close();
                return reject(err);
            }

            console.log('✅ Tenants_logs tablosu oluşturuldu/kontrol edildi');

            // Index'leri oluştur (performans için)
            db.run(`
                CREATE INDEX IF NOT EXISTS idx_tenants_logs_tenant_id ON tenants_logs(tenant_id)
            `, (err) => {
                if (err) {
                    console.warn('⚠️ Index oluşturulamadı:', err.message);
                } else {
                    console.log('✅ Index oluşturuldu: idx_tenants_logs_tenant_id');
                }
            });

            db.run(`
                CREATE INDEX IF NOT EXISTS idx_tenants_logs_type ON tenants_logs(type)
            `, (err) => {
                if (err) {
                    console.warn('⚠️ Index oluşturulamadı:', err.message);
                } else {
                    console.log('✅ Index oluşturuldu: idx_tenants_logs_type');
                }
            });

            db.run(`
                CREATE INDEX IF NOT EXISTS idx_tenants_logs_created_at ON tenants_logs(created_at DESC)
            `, (err) => {
                if (err) {
                    console.warn('⚠️ Index oluşturulamadı:', err.message);
                } else {
                    console.log('✅ Index oluşturuldu: idx_tenants_logs_created_at');
                    
                    // Örnek log kayıtları ekle
                    insertSampleLogs(db, resolve);
                }
            });
        });
    });
}

function insertSampleLogs(db, resolve) {
    // Önce mevcut tenant'ı kontrol et
    db.get('SELECT id FROM tenants LIMIT 1', [], (err, tenant) => {
        if (err || !tenant) {
            console.log('⚠️ Tenant bulunamadı, örnek loglar eklenemiyor');
            db.close();
            return resolve();
        }

        const tenantId = tenant.id;
        
        // Zaten log kayıtları var mı kontrol et
        db.get('SELECT COUNT(*) as count FROM tenants_logs WHERE tenant_id = ?', [tenantId], (err, result) => {
            if (err) {
                console.warn('⚠️ Log kontrolü yapılamadı:', err.message);
                db.close();
                return resolve();
            }

            if (result.count > 0) {
                console.log('ℹ️ Bu tenant için zaten log kayıtları mevcut, yeni kayıtlar eklenmeyecek');
                db.close();
                return resolve();
            }

            // Örnek log kayıtları ekle
            const sampleLogs = [
                {
                    tenant_id: tenantId,
                    user: 'Ahmet Yılmaz',
                    action: 'Kullanıcı oluşturuldu',
                    target: 'user_123',
                    type: 'user_create',
                    ip_address: '192.168.1.100',
                    metadata: JSON.stringify({ user_id: 123, email: 'ahmet@example.com' })
                },
                {
                    tenant_id: tenantId,
                    user: 'Mehmet Demir',
                    action: 'Kullanıcı güncellendi',
                    target: 'user_456',
                    type: 'user_update',
                    ip_address: '192.168.1.101',
                    metadata: JSON.stringify({ user_id: 456, changes: ['name', 'email'] })
                },
                {
                    tenant_id: tenantId,
                    user: 'Ayşe Kaya',
                    action: 'Dosya yüklendi',
                    target: 'file_789',
                    type: 'file_upload',
                    ip_address: '192.168.1.102',
                    metadata: JSON.stringify({ file_id: 789, file_name: 'rapor.pdf', file_size: 1024000 })
                },
                {
                    tenant_id: tenantId,
                    user: 'Fatma Şahin',
                    action: 'Dosya silindi',
                    target: 'file_321',
                    type: 'file_delete',
                    ip_address: '192.168.1.103',
                    metadata: JSON.stringify({ file_id: 321, file_name: 'eski_dosya.pdf' })
                },
                {
                    tenant_id: tenantId,
                    user: 'Ali Öz',
                    action: 'Ayarlar güncellendi',
                    target: 'settings',
                    type: 'settings_update',
                    ip_address: '192.168.1.104',
                    metadata: JSON.stringify({ section: 'general', changes: ['language', 'timezone'] })
                },
                {
                    tenant_id: tenantId,
                    user: 'Zeynep Arslan',
                    action: 'Rapor oluşturuldu',
                    target: 'report_555',
                    type: 'report_create',
                    ip_address: '192.168.1.105',
                    metadata: JSON.stringify({ report_id: 555, report_type: 'monthly', period: '2025-01' })
                },
                {
                    tenant_id: tenantId,
                    user: 'Can Yıldız',
                    action: 'Kullanıcı silindi',
                    target: 'user_999',
                    type: 'user_delete',
                    ip_address: '192.168.1.106',
                    metadata: JSON.stringify({ user_id: 999, email: 'silinen@example.com' })
                },
                {
                    tenant_id: tenantId,
                    user: 'Elif Çelik',
                    action: 'Toplu işlem yapıldı',
                    target: 'bulk_operation',
                    type: 'bulk_action',
                    ip_address: '192.168.1.107',
                    metadata: JSON.stringify({ operation: 'export', item_count: 150 })
                }
            ];

            let insertedCount = 0;
            let errorCount = 0;

            sampleLogs.forEach((log, index) => {
                // Her kayıt için farklı tarih ekle (son 30 gün içinde)
                const daysAgo = sampleLogs.length - index - 1;
                const logDate = new Date();
                logDate.setDate(logDate.getDate() - daysAgo);
                const logDateStr = logDate.toISOString().replace('T', ' ').substring(0, 19);

                db.run(`
                    INSERT INTO tenants_logs 
                    (tenant_id, user, action, target, type, ip_address, metadata, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    log.tenant_id,
                    log.user,
                    log.action,
                    log.target,
                    log.type,
                    log.ip_address,
                    log.metadata,
                    logDateStr
                ], (err) => {
                    if (err) {
                        errorCount++;
                        console.warn(`⚠️ Log kaydı ${index + 1} eklenirken hata:`, err.message);
                    } else {
                        insertedCount++;
                    }

                    // Son kayıt eklendiğinde kapat
                    if (insertedCount + errorCount === sampleLogs.length) {
                        if (insertedCount > 0) {
                            console.log(`✅ ${insertedCount} örnek log kaydı eklendi`);
                        }
                        if (errorCount > 0) {
                            console.warn(`⚠️ ${errorCount} log kaydı eklenemedi`);
                        }
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
    createTenantsLogsTable()
        .then(() => {
            console.log('\n✅ Tenants_logs tablosu hazır!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('\n❌ Hata:', err);
            process.exit(1);
        });
}

module.exports = { createTenantsLogsTable };
