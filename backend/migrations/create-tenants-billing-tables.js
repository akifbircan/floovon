const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../floovon_professional.db');

/**
 * Tenant billing ve abonelik tablolarını oluşturur
 * - tenants_abonelik_planlari
 * - tenants_abonelikler
 * - tenants_kullanimlar
 * - tenants_odeme_yontemleri
 * - tenants_faturalar
 */
async function createTenantsBillingTables() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Veritabanı bağlantı hatası:', err);
                return reject(err);
            }
            console.log('✅ Veritabanına bağlandı');
        });

        // 1. tenants_abonelik_planlari tablosu
        db.run(`
            CREATE TABLE IF NOT EXISTS tenants_abonelik_planlari (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plan_adi TEXT NOT NULL UNIQUE,
                plan_kodu TEXT NOT NULL UNIQUE,
                aylik_ucret INTEGER NOT NULL,
                max_kullanici INTEGER NOT NULL DEFAULT 50,
                max_depolama_gb INTEGER NOT NULL DEFAULT 1000,
                ozellikler TEXT,
                aktif_mi INTEGER DEFAULT 1,
                olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('❌ tenants_abonelik_planlari tablosu oluşturulamadı:', err);
                db.close();
                return reject(err);
            }
            console.log('✅ tenants_abonelik_planlari tablosu oluşturuldu');

            // 2. tenants_abonelikler tablosu
            db.run(`
            CREATE TABLE IF NOT EXISTS tenants_abonelikler (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL,
                plan_id INTEGER NOT NULL,
                durum TEXT NOT NULL DEFAULT 'aktif',
                mevcut_aylik_toplam INTEGER,
                fatura_dongusu TEXT DEFAULT 'aylik',
                mevcut_donem_baslangic DATE,
                mevcut_donem_bitis DATE,
                sonraki_odeme_tarihi DATE,
                iptal_tarihi DATETIME,
                olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                FOREIGN KEY (plan_id) REFERENCES tenants_abonelik_planlari(id)
            )
            `, (err) => {
                if (err) {
                    console.error('❌ tenants_abonelikler tablosu oluşturulamadı:', err);
                    db.close();
                    return reject(err);
                }
                console.log('✅ tenants_abonelikler tablosu oluşturuldu');

                // Index'ler
                db.run(`CREATE INDEX IF NOT EXISTS idx_tenants_abonelikler_tenant_id ON tenants_abonelikler(tenant_id)`);
                db.run(`CREATE INDEX IF NOT EXISTS idx_tenants_abonelikler_durum ON tenants_abonelikler(durum)`);

                // 3. tenants_kullanimlar tablosu
                db.run(`
                    CREATE TABLE IF NOT EXISTS tenants_kullanimlar (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        tenant_id INTEGER NOT NULL UNIQUE,
                        kullanici_sayisi INTEGER DEFAULT 0,
                        kullanilan_depolama_byte INTEGER DEFAULT 0,
                        depolama_limit_byte INTEGER NOT NULL,
                        son_hesaplama_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                        guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
                    )
                `, (err) => {
                    if (err) {
                        console.error('❌ tenants_kullanimlar tablosu oluşturulamadı:', err);
                        db.close();
                        return reject(err);
                    }
                    console.log('✅ tenants_kullanimlar tablosu oluşturuldu');

                    db.run(`CREATE INDEX IF NOT EXISTS idx_tenants_kullanimlar_tenant_id ON tenants_kullanimlar(tenant_id)`);

                    // 4. tenants_odeme_yontemleri tablosu
                    db.run(`
                        CREATE TABLE IF NOT EXISTS tenants_odeme_yontemleri (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            tenant_id INTEGER NOT NULL,
                            kart_tipi TEXT NOT NULL,
                            son_dort_rakam TEXT NOT NULL,
                            son_kullanim_ayi INTEGER NOT NULL,
                            son_kullanim_yili INTEGER NOT NULL,
                            kart_sahibi_adi TEXT,
                            varsayilan_mi INTEGER DEFAULT 0,
                            aktif_mi INTEGER DEFAULT 1,
                            olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                            guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
                        )
                    `, (err) => {
                        if (err) {
                            console.error('❌ tenants_odeme_yontemleri tablosu oluşturulamadı:', err);
                            db.close();
                            return reject(err);
                        }
                        console.log('✅ tenants_odeme_yontemleri tablosu oluşturuldu');

                        db.run(`CREATE INDEX IF NOT EXISTS idx_tenants_odeme_yontemleri_tenant_id ON tenants_odeme_yontemleri(tenant_id)`);
                        db.run(`CREATE INDEX IF NOT EXISTS idx_tenants_odeme_yontemleri_varsayilan ON tenants_odeme_yontemleri(tenant_id, varsayilan_mi)`);

                        // 5. tenants_faturalar tablosu
                        db.run(`
                            CREATE TABLE IF NOT EXISTS tenants_faturalar (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                tenant_id INTEGER NOT NULL,
                                fatura_no TEXT NOT NULL UNIQUE,
                                fatura_tarihi DATE NOT NULL,
                                plan_id INTEGER,
                                abonelik_id INTEGER,
                                ara_toplam INTEGER NOT NULL,
                                kdv_tutari INTEGER DEFAULT 0,
                                toplam_tutar INTEGER NOT NULL,
                                durum TEXT NOT NULL DEFAULT 'beklemede',
                                odeme_yontemi_id INTEGER,
                                pdf_yolu TEXT,
                                odeme_tarihi DATETIME,
                                vade_tarihi DATE,
                                olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                                guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                                FOREIGN KEY (plan_id) REFERENCES tenants_abonelik_planlari(id),
                                FOREIGN KEY (abonelik_id) REFERENCES tenants_abonelikler(id),
                                FOREIGN KEY (odeme_yontemi_id) REFERENCES tenants_odeme_yontemleri(id)
                            )
                        `, (err) => {
                            if (err) {
                                console.error('❌ tenants_faturalar tablosu oluşturulamadı:', err);
                                db.close();
                                return reject(err);
                            }
                            console.log('✅ tenants_faturalar tablosu oluşturuldu');

                            db.run(`CREATE INDEX IF NOT EXISTS idx_tenants_faturalar_tenant_id ON tenants_faturalar(tenant_id)`);
                            db.run(`CREATE INDEX IF NOT EXISTS idx_tenants_faturalar_durum ON tenants_faturalar(durum)`);
                            db.run(`CREATE INDEX IF NOT EXISTS idx_tenants_faturalar_fatura_tarihi ON tenants_faturalar(fatura_tarihi DESC)`);

                            // Örnek veriler ekle
                            insertSampleData(db, resolve, reject);
                        });
                    });
                });
            });
        });
    });
}

/**
 * Örnek veriler ekle (tenants tablosu yoksa atla – ana uygulama ilk çalışmada oluşturur)
 */
function insertSampleData(db, resolve, reject) {
    // Önce tenants tablosunun var olup olmadığını kontrol et
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='tenants'", [], (errTable, row) => {
        if (errTable || !row) {
            console.log('⚠️ tenants tablosu henüz yok, örnek veriler atlanıyor (ana uygulama ilk çalışmada oluşturur)');
            db.close();
            return resolve();
        }
        // Mevcut tenant'ı kontrol et
        db.get('SELECT id FROM tenants LIMIT 1', [], (err, tenant) => {
            if (err) {
                console.error('❌ Tenant kontrolü hatası:', err);
                db.close();
                return reject(err);
            }

            if (!tenant) {
                console.log('⚠️ Henüz tenant yok, örnek veriler eklenemiyor');
                db.close();
                return resolve();
            }

        const tenantId = tenant.id;

        // Örnek verilerin zaten eklenip eklenmediğini kontrol et
        db.get('SELECT COUNT(*) as count FROM tenants_abonelik_planlari', [], (err, result) => {
            if (err) {
                console.warn('⚠️ Plan kontrolü yapılamadı:', err.message);
                db.close();
                return resolve();
            }

            // Eğer planlar zaten varsa, örnek veriler ekleme
            if (result.count > 0) {
                console.log('ℹ️ Abonelik planları zaten mevcut, örnek veriler eklenmeyecek');
                db.close();
                return resolve();
            }

            // 1. Abonelik planları ekle
            db.run(`
                INSERT INTO tenants_abonelik_planlari 
                (plan_adi, plan_kodu, aylik_ucret, max_kullanici, max_depolama_gb, ozellikler, aktif_mi)
                VALUES 
                ('Basic', 'basic', 99900, 10, 100, '["10 kullanıcıya kadar", "100 GB depolama alanı", "Temel sipariş ve müşteri yönetimi"]', 1),
                ('Pro Kurumsal', 'pro_kurumsal', 249900, 50, 1000, '["50 kullanıcıya kadar", "1000 GB depolama alanı", "Gelişmiş raporlama ve API erişimi"]', 1),
                ('Enterprise', 'enterprise', 499900, 200, 5000, '["200 kullanıcıya kadar", "5000 GB depolama alanı", "7/24 öncelikli destek ve özel entegrasyonlar"]', 1)
            `, (err) => {
                if (err) {
                    console.warn('⚠️ Abonelik planları eklenirken hata:', err.message);
                    db.close();
                    return resolve();
                }
                console.log('✅ Örnek abonelik planları eklendi');

                // 2. Tenant aboneliği ekle (Pro Kurumsal) - sadece yoksa
                db.get('SELECT id FROM tenants_abonelik_planlari WHERE plan_kodu = ?', ['pro_kurumsal'], (err, plan) => {
                    if (err || !plan) {
                        console.warn('⚠️ Plan bulunamadı, abonelik eklenemiyor');
                        db.close();
                        return resolve();
                    }

                    const planId = plan.id;
                    
                    // Bu tenant için zaten abonelik var mı kontrol et
                    db.get('SELECT id FROM tenants_abonelikler WHERE tenant_id = ?', [tenantId], (err, existingAbonelik) => {
                        if (err) {
                            console.warn('⚠️ Abonelik kontrolü yapılamadı:', err.message);
                            db.close();
                            return resolve();
                        }

                        if (existingAbonelik) {
                            console.log('ℹ️ Bu tenant için zaten abonelik mevcut, yeni abonelik eklenmeyecek');
                            db.close();
                            return resolve();
                        }

                        const nextPaymentDate = new Date();
                        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);

                        // Plan bilgilerini al (aylık ücret için)
                        db.get('SELECT aylik_ucret FROM tenants_abonelik_planlari WHERE id = ?', [planId], (err, planInfo) => {
                            if (err || !planInfo) {
                                console.warn('⚠️ Plan bilgileri alınamadı:', err?.message);
                                db.close();
                                return resolve();
                            }

                            db.run(`
                                INSERT INTO tenants_abonelikler 
                                (tenant_id, plan_id, durum, mevcut_aylik_toplam, 
                                 mevcut_donem_baslangic, mevcut_donem_bitis, sonraki_odeme_tarihi)
                                VALUES (?, ?, 'aktif', ?, 
                                        date('now', 'start of month'), date('now', '+1 month', 'start of month'), ?)
                            `, [tenantId, planId, planInfo.aylik_ucret, nextPaymentDate.toISOString().split('T')[0]], (err) => {
                                if (err) {
                                    console.warn('⚠️ Abonelik eklenirken hata:', err.message);
                                    db.close();
                                    return resolve();
                                }
                                console.log('✅ Örnek abonelik eklendi');

                                // 3. Kullanım verileri ekle - depolama limitini plan'dan al
                                db.get('SELECT max_depolama_gb FROM tenants_abonelik_planlari WHERE id = ?', [planId], (err, planStorage) => {
                                    if (err || !planStorage) {
                                        console.warn('⚠️ Plan depolama bilgisi alınamadı:', err?.message);
                                        db.close();
                                        return resolve();
                                    }

                                    const storageLimitGB = planStorage.max_depolama_gb;
                                    const storageLimitBytes = storageLimitGB * 1024 * 1024 * 1024;
                                    const storageUsedBytes = Math.round(storageLimitBytes * 0.75); // %75 kullanım

                                    db.run(`
                                        INSERT OR REPLACE INTO tenants_kullanimlar 
                                        (tenant_id, kullanici_sayisi, kullanilan_depolama_byte, depolama_limit_byte)
                                        VALUES (?, 12, ?, ?)
                                    `, [tenantId, storageUsedBytes, storageLimitBytes], (err) => {
                                        if (err) {
                                            console.warn('⚠️ Kullanım verileri eklenirken hata:', err.message);
                                        } else {
                                            console.log('✅ Örnek kullanım verileri eklendi');
                                        }

                                        // 4. Ödeme yöntemi ekle - sadece yoksa
                                        db.get('SELECT id FROM tenants_odeme_yontemleri WHERE tenant_id = ? LIMIT 1', [tenantId], (err, existingPayment) => {
                                            if (err) {
                                                console.warn('⚠️ Ödeme yöntemi kontrolü yapılamadı:', err.message);
                                                db.close();
                                                return resolve();
                                            }
                                            if (existingPayment) {
                                                console.log('ℹ️ Bu tenant için zaten ödeme yöntemi mevcut');
                                                db.close();
                                                return resolve();
                                            }

                                            db.run(`
                                            INSERT INTO tenants_odeme_yontemleri 
                                            (tenant_id, kart_tipi, son_dort_rakam, son_kullanim_ayi, son_kullanim_yili, 
                                             kart_sahibi_adi, varsayilan_mi, aktif_mi)
                                            VALUES (?, 'Visa', '4242', 12, 2027, 'Test Kullanıcı', 1, 1)
                                        `, [tenantId], (err) => {
                                            if (err) {
                                                console.warn('⚠️ Ödeme yöntemi eklenirken hata:', err.message);
                                                db.close();
                                                return resolve();
                                            }
                                            console.log('✅ Örnek ödeme yöntemi eklendi');

                                            // 5. Fatura ekle - sadece yoksa
                                            db.get('SELECT id FROM tenants_odeme_yontemleri WHERE tenant_id = ? LIMIT 1', [tenantId], (err, paymentMethod) => {
                                                if (err) {
                                                    console.warn('⚠️ Ödeme yöntemi alınamadı:', err.message);
                                                    db.close();
                                                    return resolve();
                                                }
                                                
                                                const paymentMethodId = paymentMethod ? paymentMethod.id : null;

                                                db.get('SELECT id FROM tenants_faturalar WHERE tenant_id = ? AND fatura_no = ?', [tenantId, 'INV-001'], (err, existingInvoice) => {
                                                    if (err) {
                                                        console.warn('⚠️ Fatura kontrolü yapılamadı:', err.message);
                                                        db.close();
                                                        return resolve();
                                                    }
                                                    if (existingInvoice) {
                                                        console.log('ℹ️ Bu tenant için zaten INV-001 fatura mevcut');
                                                        db.close();
                                                        return resolve();
                                                    }

                                                    // Plan ücretini plan tablosundan al
                                                    db.get('SELECT aylik_ucret FROM tenants_abonelik_planlari WHERE id = ?', [planId], (err, planPrice) => {
                                                        if (err || !planPrice) {
                                                            console.warn('⚠️ Plan ücreti alınamadı:', err?.message);
                                                            db.close();
                                                            return resolve();
                                                        }

                                                        db.run(`
                                                            INSERT INTO tenants_faturalar 
                                                            (tenant_id, fatura_no, fatura_tarihi, plan_id, ara_toplam, kdv_tutari, 
                                                             toplam_tutar, durum, odeme_yontemi_id, odeme_tarihi)
                                                            VALUES (?, 'INV-001', date('now', '-1 month'), ?, ?, 0, 
                                                                    ?, 'odendi', ?, date('now', '-1 month'))
                                                        `, [tenantId, planId, planPrice.aylik_ucret, planPrice.aylik_ucret, paymentMethodId], (err) => {
                                                            if (err) {
                                                                console.warn('⚠️ Fatura eklenirken hata:', err.message);
                                                                db.close();
                                                                return resolve();
                                                            }
                                                            console.log('✅ Örnek fatura eklendi');
                                                            db.close();
                                                            resolve();
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
                });
            });
        });
    });
    });
}

// Eğer doğrudan çalıştırılıyorsa
if (require.main === module) {
    createTenantsBillingTables()
        .then(() => {
            console.log('\n✅ Tüm billing tabloları hazır ve örnek veriler eklendi!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('\n❌ Hata:', err);
            process.exit(1);
        });
}

module.exports = { createTenantsBillingTables };
