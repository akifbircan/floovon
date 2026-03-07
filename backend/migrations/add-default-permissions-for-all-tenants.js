const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../floovon_professional.db');

/**
 * Tüm tenant'lar için varsayılan sayfa erişim izinlerini ekler
 * Her tenant'ın kendi izinlerini yönetebilmesi için
 */
async function addDefaultPermissionsForAllTenants() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Veritabanı bağlantı hatası:', err);
                return reject(err);
            }
            console.log('✅ Veritabanına bağlandı');
        });

        // Önce tüm tenant'ları al
        db.all("SELECT id FROM tenants", (err, tenants) => {
            if (err) {
                console.error('❌ Tenant listesi alınamadı:', err);
                db.close();
                return reject(err);
            }

            if (!tenants || tenants.length === 0) {
                console.warn('⚠️ Hiç tenant bulunamadı');
                db.close();
                return resolve();
            }

            console.log(`📋 ${tenants.length} tenant bulundu`);

            const pages = [
                { id: 'index', name: 'Siparişler' },
                { id: 'musteriler', name: 'Müşteriler' },
                { id: 'musteriler-cari', name: 'Müşteri Cari Hesap' },
                { id: 'partner-firmalar', name: 'Partner Firmalar' },
                { id: 'partner-firmalar-cari', name: 'Partner Firma Cari Hesap' },
                { id: 'partnerler-potansiyel', name: 'Potansiyel Partnerler' },
                { id: 'kampanya-yonetimi', name: 'Kampanya Yönetimi' },
                { id: 'raporlar', name: 'Raporlar' },
                { id: 'arsiv-siparisler', name: 'Arşiv Siparişler' },
                { id: 'ayarlar', name: 'Ayarlar' },
                { id: 'profil-ayarlari', name: 'Profil Ayarları' }
            ];

            const roles = [
                { id: 'sistem-yoneticisi', name: 'Sistem Yöneticisi' },
                { id: 'siparis-operatörü', name: 'Sipariş Operatörü' },
                { id: 'teslimat-sorumlusu', name: 'Teslimat Sorumlusu' }
            ];

            let processed = 0;
            const total = tenants.length * pages.length * roles.length;

            if (total === 0) {
                db.close();
                return resolve();
            }

            console.log(`📋 ${total} izin kaydı oluşturulacak`);

            tenants.forEach(tenant => {
                pages.forEach(page => {
                    roles.forEach(role => {
                        // Sistem yöneticisi için her zaman izinli
                        let hasAccess = 1;
                        if (role.id === 'siparis-operatörü') {
                            // Sipariş Operatörü: index, musteriler, musteriler-cari, kampanya-yonetimi
                            hasAccess = ['index', 'musteriler', 'musteriler-cari', 'kampanya-yonetimi'].includes(page.id) ? 1 : 0;
                        } else if (role.id === 'teslimat-sorumlusu') {
                            // Teslimat Sorumlusu: index, arsiv-siparisler
                            hasAccess = ['index', 'arsiv-siparisler'].includes(page.id) ? 1 : 0;
                        }

                        // Mevcut kaydı kontrol et
                        db.get(`
                            SELECT id FROM page_permissions 
                            WHERE tenant_id = ? AND role_id = ? AND page_id = ?
                        `, [tenant.id, role.id, page.id], (err, existing) => {
                            if (err) {
                                console.warn(`⚠️ Kontrol hatası: Tenant ${tenant.id}, Role ${role.id}, Page ${page.id}`, err.message);
                                processed++;
                                if (processed === total) {
                                    db.close();
                                    resolve();
                                }
                                return;
                            }

                            if (existing) {
                                // Zaten var, atla
                                processed++;
                                if (processed === total) {
                                    console.log(`✅ Varsayılan izinler kontrol edildi (${total} kayıt)`);
                                    db.close();
                                    resolve();
                                }
                                return;
                            }

                            // Yeni ekle
                            db.run(`
                                INSERT INTO page_permissions (tenant_id, role_id, page_id, has_access)
                                VALUES (?, ?, ?, ?)
                            `, [tenant.id, role.id, page.id, hasAccess], (err) => {
                                processed++;
                                if (err) {
                                    console.warn(`⚠️ İzin eklenemedi: Tenant ${tenant.id}, Role ${role.id}, Page ${page.id}`, err.message);
                                }
                                
                                if (processed === total) {
                                    console.log(`✅ Varsayılan izinler eklendi (${total} kayıt)`);
                                    db.close();
                                    resolve();
                                }
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
    addDefaultPermissionsForAllTenants()
        .then(() => {
            console.log('\n✅ Tüm tenantlar için varsayılan izinler eklendi!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('\n❌ Hata:', err);
            process.exit(1);
        });
}

module.exports = { addDefaultPermissionsForAllTenants };

