const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../floovon_professional.db');

/**
 * Sayfa erişim izinleri tablosunu oluşturur
 * - page_permissions: Rol bazlı sayfa erişim izinleri
 */
async function createPagePermissionsTable() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Veritabanı bağlantı hatası:', err);
                return reject(err);
            }
            console.log('✅ Veritabanına bağlandı');
        });

        // page_permissions tablosu
        db.run(`
            CREATE TABLE IF NOT EXISTS page_permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role_id TEXT NOT NULL,
                page_id TEXT NOT NULL,
                has_access INTEGER DEFAULT 1,
                olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(role_id, page_id)
            )
        `, (err) => {
            if (err) {
                console.error('❌ page_permissions tablosu oluşturulamadı:', err);
                db.close();
                return reject(err);
            }
            console.log('✅ page_permissions tablosu oluşturuldu');

            // Index'ler
            db.run(`CREATE INDEX IF NOT EXISTS idx_page_permissions_role_id ON page_permissions(role_id)`, (err) => {
                if (err) {
                    console.warn('⚠️ Index oluşturulamadı:', err.message);
                }
            });

            db.run(`CREATE INDEX IF NOT EXISTS idx_page_permissions_page_id ON page_permissions(page_id)`, (err) => {
                if (err) {
                    console.warn('⚠️ Index oluşturulamadı:', err.message);
                }
            });

            // Varsayılan izinleri ekle
            insertDefaultPermissions(db, resolve, reject);
        });
    });
}

/**
 * Varsayılan sayfa erişim izinlerini ekler
 */
function insertDefaultPermissions(db, resolve, reject) {
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
    const total = pages.length * roles.length;

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

            db.run(`
                INSERT OR IGNORE INTO page_permissions (role_id, page_id, has_access)
                VALUES (?, ?, ?)
            `, [role.id, page.id, hasAccess], (err) => {
                processed++;
                if (err) {
                    console.warn(`⚠️ İzin eklenemedi: ${role.id} - ${page.id}`, err.message);
                }
                
                if (processed === total) {
                    console.log('✅ Varsayılan sayfa erişim izinleri eklendi');
                    db.close();
                    resolve();
                }
            });
        });
    });
}

// Eğer doğrudan çalıştırılıyorsa
if (require.main === module) {
    createPagePermissionsTable()
        .then(() => {
            console.log('\n✅ Sayfa erişim izinleri tablosu hazır!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('\n❌ Hata:', err);
            process.exit(1);
        });
}

module.exports = { createPagePermissionsTable };

