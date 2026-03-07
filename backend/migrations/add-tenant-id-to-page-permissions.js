const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../floovon_professional.db');

/**
 * page_permissions tablosuna tenant_id kolonu ekler
 * Her tenant'ın kendi izinlerini yönetebilmesi için
 */
async function addTenantIdToPagePermissions() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Veritabanı bağlantı hatası:', err);
                return reject(err);
            }
            console.log('✅ Veritabanına bağlandı');
        });

        // Önce tablo yapısını kontrol et
        db.all("PRAGMA table_info(page_permissions)", (err, columns) => {
            if (err) {
                console.error('❌ Tablo bilgisi alınamadı:', err);
                db.close();
                return reject(err);
            }

            // tenant_id kolonu var mı kontrol et
            const hasTenantId = columns.some(col => col.name === 'tenant_id');
            
            if (hasTenantId) {
                console.log('✅ tenant_id kolonu zaten mevcut');
                db.close();
                return resolve();
            }

            // tenant_id kolonu yoksa ekle
            console.log('📋 tenant_id kolonu ekleniyor...');
            
            // SQLite'da ALTER TABLE ile kolon ekle
            db.run(`
                ALTER TABLE page_permissions 
                ADD COLUMN tenant_id INTEGER
            `, (err) => {
                if (err) {
                    console.error('❌ tenant_id kolonu eklenemedi:', err);
                    db.close();
                    return reject(err);
                }
                
                console.log('✅ tenant_id kolonu eklendi');
                
                // Index ekle
                db.run(`
                    CREATE INDEX IF NOT EXISTS idx_page_permissions_tenant_id 
                    ON page_permissions(tenant_id)
                `, (err) => {
                    if (err) {
                        console.warn('⚠️ Index oluşturulamadı:', err.message);
                    } else {
                        console.log('✅ tenant_id index eklendi');
                    }
                    
                    // UNIQUE constraint'i güncelle (role_id, page_id, tenant_id)
                    // Önce eski UNIQUE constraint'i kaldır (SQLite'da direkt kaldırılamaz, tablo yeniden oluşturulmalı)
                    // Bu yüzden yeni bir UNIQUE index oluştur
                    db.run(`
                        CREATE UNIQUE INDEX IF NOT EXISTS idx_page_permissions_unique 
                        ON page_permissions(tenant_id, role_id, page_id)
                    `, (err) => {
                        if (err) {
                            console.warn('⚠️ Unique index oluşturulamadı:', err.message);
                        } else {
                            console.log('✅ Unique index (tenant_id, role_id, page_id) eklendi');
                        }
                        
                        // Mevcut kayıtları güncelle - tüm tenant'lara kopyala
                        // Önce tüm tenant'ları al
                        db.all("SELECT id FROM tenants", (err, tenants) => {
                            if (err) {
                                console.warn('⚠️ Tenant listesi alınamadı, mevcut izinler tenant_id olmadan kalacak:', err.message);
                                db.close();
                                return resolve();
                            }
                            
                            if (!tenants || tenants.length === 0) {
                                console.warn('⚠️ Hiç tenant bulunamadı');
                                db.close();
                                return resolve();
                            }
                            
                            // Mevcut izinleri al
                            db.all("SELECT role_id, page_id, has_access FROM page_permissions WHERE tenant_id IS NULL", (err, permissions) => {
                                if (err) {
                                    console.warn('⚠️ Mevcut izinler alınamadı:', err.message);
                                    db.close();
                                    return resolve();
                                }
                                
                                if (!permissions || permissions.length === 0) {
                                    console.log('✅ Güncellenecek izin kaydı yok');
                                    db.close();
                                    return resolve();
                                }
                                
                                // Her tenant için izinleri kopyala
                                let processed = 0;
                                const total = tenants.length * permissions.length;
                                
                                if (total === 0) {
                                    db.close();
                                    return resolve();
                                }
                                
                                tenants.forEach(tenant => {
                                    permissions.forEach(perm => {
                                        db.run(`
                                            INSERT OR IGNORE INTO page_permissions (tenant_id, role_id, page_id, has_access)
                                            VALUES (?, ?, ?, ?)
                                        `, [tenant.id, perm.role_id, perm.page_id, perm.has_access], (err) => {
                                            processed++;
                                            if (err) {
                                                console.warn(`⚠️ İzin kopyalanamadı: Tenant ${tenant.id}, Role ${perm.role_id}, Page ${perm.page_id}`, err.message);
                                            }
                                            
                                            if (processed === total) {
                                                console.log(`✅ ${total} izin kaydı tenant'lara kopyalandı`);
                                                
                                                // Eski tenant_id NULL olan kayıtları sil
                                                db.run("DELETE FROM page_permissions WHERE tenant_id IS NULL", (err) => {
                                                    if (err) {
                                                        console.warn('⚠️ Eski kayıtlar silinemedi:', err.message);
                                                    } else {
                                                        console.log('✅ Eski tenant_id NULL kayıtlar silindi');
                                                    }
                                                    
                                                    db.close();
                                                    resolve();
                                                });
                                            }
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}

// Eğer doğrudan çalıştırılıyorsa
if (require.main === module) {
    addTenantIdToPagePermissions()
        .then(() => {
            console.log('\n✅ tenant_id kolonu başarıyla eklendi!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('\n❌ Hata:', err);
            process.exit(1);
        });
}

module.exports = { addTenantIdToPagePermissions };











