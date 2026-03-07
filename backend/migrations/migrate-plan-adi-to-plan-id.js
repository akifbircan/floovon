const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../floovon_professional.db');

/**
 * plan_adi kolonlarını kaldır ve plan_id kullanımına geç
 */
async function migratePlanAdiToPlanId() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Veritabanı bağlantı hatası:', err);
                return reject(err);
            }
            console.log('✅ Veritabanına bağlandı');
        });

        db.serialize(() => {
            // Önce geçici tabloları temizle
            db.run('DROP TABLE IF EXISTS tenants_faturalar_new', (err) => {
                if (err) {
                    console.warn('⚠️ Geçici tablo temizlenemedi (devam ediliyor):', err.message);
                }
            });
            db.run('DROP TABLE IF EXISTS tenants_abonelikler_new', (err) => {
                if (err) {
                    console.warn('⚠️ Geçici tablo temizlenemedi (devam ediliyor):', err.message);
                }
            });
            
            // 1. tenants_abonelikler tablosundan plan_adi kolonunu kaldır
            console.log('🔄 tenants_abonelikler tablosu güncelleniyor...');
            
            // Önce plan_adi kolonunun var olup olmadığını kontrol et
            db.get("PRAGMA table_info(tenants_abonelikler)", [], (err, columns) => {
                if (err) {
                    console.error('❌ Tablo bilgisi alınamadı:', err);
                    db.close();
                    return reject(err);
                }

                // SQLite'da kolon kaldırmak için tabloyu yeniden oluşturmak gerekir
                db.run(`
                    CREATE TABLE IF NOT EXISTS tenants_abonelikler_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        tenant_id INTEGER NOT NULL,
                        plan_id INTEGER NOT NULL,
                        durum TEXT NOT NULL DEFAULT 'aktif',
                        aylik_ucret INTEGER NOT NULL,
                        max_kullanici INTEGER NOT NULL,
                        max_depolama_gb INTEGER NOT NULL,
                        mevcut_aylik_toplam INTEGER,
                        fatura_dongusu TEXT DEFAULT 'aylik',
                        mevcut_donem_baslangic DATE,
                        mevcut_donem_bitis DATE,
                        sonraki_odeme_tarihi DATE,
                        iptal_tarihi DATETIME,
                        iptal_nedeni TEXT,
                        islem_sahibi TEXT,
                        olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                        guncelleme_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                        FOREIGN KEY (plan_id) REFERENCES tenants_abonelik_planlari(id)
                    )
                `, (err) => {
                    if (err) {
                        console.error('❌ Yeni tablo oluşturulamadı:', err);
                        db.close();
                        return reject(err);
                    }

                    // Verileri kopyala (plan_adi olmadan)
                    db.run(`
                        INSERT INTO tenants_abonelikler_new 
                        (id, tenant_id, plan_id, durum, aylik_ucret, max_kullanici, max_depolama_gb, 
                         mevcut_aylik_toplam, fatura_dongusu, mevcut_donem_baslangic, mevcut_donem_bitis, 
                         sonraki_odeme_tarihi, iptal_tarihi, iptal_nedeni, islem_sahibi, olusturma_tarihi, guncelleme_tarihi)
                        SELECT id, tenant_id, plan_id, durum, aylik_ucret, max_kullanici, max_depolama_gb,
                               mevcut_aylik_toplam, fatura_dongusu, mevcut_donem_baslangic, mevcut_donem_bitis,
                               sonraki_odeme_tarihi, iptal_tarihi, iptal_nedeni, islem_sahibi, olusturma_tarihi, guncelleme_tarihi
                        FROM tenants_abonelikler
                    `, (err) => {
                        if (err) {
                            console.error('❌ Veriler kopyalanamadı:', err);
                            db.close();
                            return reject(err);
                        }

                        // Eski tabloyu sil ve yenisini yeniden adlandır
                        db.run('DROP TABLE tenants_abonelikler', (err) => {
                            if (err) {
                                console.error('❌ Eski tablo silinemedi:', err);
                                db.close();
                                return reject(err);
                            }

                            db.run('ALTER TABLE tenants_abonelikler_new RENAME TO tenants_abonelikler', (err) => {
                                if (err) {
                                    console.error('❌ Tablo yeniden adlandırılamadı:', err);
                                    db.close();
                                    return reject(err);
                                }

                                console.log('✅ tenants_abonelikler tablosu güncellendi (plan_adi kaldırıldı)');

                                // 2. tenants_faturalar tablosunu güncelle
                                console.log('🔄 tenants_faturalar tablosu güncelleniyor...');
                                
                                // Önce plan_adi kolonunun var olup olmadığını kontrol et (tablo oluşturmadan önce)
                                db.all("PRAGMA table_info(tenants_faturalar)", [], (err, faturaColumns) => {
                                    if (err) {
                                        console.error('❌ Tablo bilgisi alınamadı:', err);
                                        db.close();
                                        return reject(err);
                                    }

                                    const hasPlanAdi = faturaColumns.some(col => col.name === 'plan_adi');
                                    const hasPlanId = faturaColumns.some(col => col.name === 'plan_id');

                                    // Eğer plan_adi yoksa ve plan_id varsa, migration gerekmiyor
                                    if (!hasPlanAdi && hasPlanId) {
                                        console.log('ℹ️ tenants_faturalar tablosu zaten plan_id kullanıyor, migration atlanıyor');
                                        db.close();
                                        return resolve();
                                    }
                                
                                    // Önce varsa eski _new tablosunu sil
                                    db.run('DROP TABLE IF EXISTS tenants_faturalar_new', (err) => {
                                        if (err) {
                                            console.warn('⚠️ Eski _new tablosu silinemedi (devam ediliyor):', err.message);
                                        }
                                    });
                                        
                                        db.run(`
                                            CREATE TABLE tenants_faturalar_new (
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
                                        console.error('❌ Yeni fatura tablosu oluşturulamadı:', err);
                                        db.close();
                                        return reject(err);
                                    }

                                    // Önce plan_adi kolonunun var olup olmadığını kontrol et
                                    db.all("PRAGMA table_info(tenants_faturalar)", [], (err, columns) => {
                                        if (err) {
                                            console.error('❌ Tablo bilgisi alınamadı:', err);
                                            db.close();
                                            return reject(err);
                                        }

                                        const hasPlanAdi = columns.some(col => col.name === 'plan_adi');
                                        const hasPlanId = columns.some(col => col.name === 'plan_id');

                                        // Eğer plan_adi yoksa ve plan_id varsa, migration gerekmiyor
                                        if (!hasPlanAdi && hasPlanId) {
                                            console.log('ℹ️ tenants_faturalar tablosu zaten plan_id kullanıyor, migration atlanıyor');
                                            // Geçici tabloyu temizle
                                            db.run('DROP TABLE IF EXISTS tenants_faturalar_new', (err) => {
                                                if (err) {
                                                    console.warn('⚠️ Geçici tablo temizlenemedi (devam ediliyor):', err.message);
                                                }
                                                db.close();
                                                return resolve();
                                            });
                                            return;
                                        }

                                        // Eğer plan_adi yoksa ve plan_id de yoksa, yeni tabloyu kullan
                                        if (!hasPlanAdi && !hasPlanId) {
                                            db.run('DROP TABLE tenants_faturalar', (err) => {
                                                if (err) {
                                                    console.error('❌ Eski fatura tablosu silinemedi:', err);
                                                    db.close();
                                                    return reject(err);
                                                }

                                                db.run('ALTER TABLE tenants_faturalar_new RENAME TO tenants_faturalar', (err) => {
                                                    if (err) {
                                                        console.error('❌ Fatura tablosu yeniden adlandırılamadı:', err);
                                                        db.close();
                                                        return reject(err);
                                                    }

                                                    console.log('✅ tenants_faturalar tablosu güncellendi (plan_id eklendi)');
                                                    db.close();
                                                    resolve();
                                                });
                                            });
                                            return;
                                        }

                                        // Mevcut faturalar için plan_id'yi bul ve güncelle
                                        db.all('SELECT id, plan_adi FROM tenants_faturalar', [], (err, faturalar) => {
                                            if (err) {
                                                console.error('❌ Faturalar alınamadı:', err);
                                                db.close();
                                                return reject(err);
                                            }

                                        let processed = 0;
                                        const total = faturalar.length;

                                        if (total === 0) {
                                            // Veri yoksa direkt kopyala
                                            db.run('DROP TABLE tenants_faturalar', (err) => {
                                                if (err) {
                                                    console.error('❌ Eski fatura tablosu silinemedi:', err);
                                                    db.close();
                                                    return reject(err);
                                                }

                                                db.run('ALTER TABLE tenants_faturalar_new RENAME TO tenants_faturalar', (err) => {
                                                    if (err) {
                                                        console.error('❌ Fatura tablosu yeniden adlandırılamadı:', err);
                                                        db.close();
                                                        return reject(err);
                                                    }

                                                    console.log('✅ tenants_faturalar tablosu güncellendi (plan_adi -> plan_id)');
                                                    db.close();
                                                    resolve();
                                                });
                                            });
                                            return;
                                        }

                                        faturalar.forEach((fatura) => {
                                            // plan_adi'ye göre plan_id bul
                                            db.get('SELECT id FROM tenants_abonelik_planlari WHERE plan_adi = ?', [fatura.plan_adi], (err, plan) => {
                                                const planId = plan ? plan.id : null;

                                                // Faturayı yeni tabloya kopyala
                                                db.run(`
                                                    INSERT INTO tenants_faturalar_new 
                                                    (id, tenant_id, fatura_no, fatura_tarihi, plan_id, abonelik_id,
                                                     ara_toplam, kdv_tutari, toplam_tutar, durum, odeme_yontemi_id,
                                                     pdf_yolu, odeme_tarihi, vade_tarihi, olusturma_tarihi, guncelleme_tarihi)
                                                    SELECT id, tenant_id, fatura_no, fatura_tarihi, ?, abonelik_id,
                                                           ara_toplam, kdv_tutari, toplam_tutar, durum, odeme_yontemi_id,
                                                           pdf_yolu, odeme_tarihi, vade_tarihi, olusturma_tarihi, guncelleme_tarihi
                                                    FROM tenants_faturalar
                                                    WHERE id = ?
                                                `, [planId, fatura.id], (err) => {
                                                    processed++;
                                                    if (err) {
                                                        console.warn(`⚠️ Fatura ${fatura.id} kopyalanamadı:`, err.message);
                                                    }

                                                    if (processed === total) {
                                                        // Eski tabloyu sil ve yenisini yeniden adlandır
                                                        db.run('DROP TABLE tenants_faturalar', (err) => {
                                                            if (err) {
                                                                console.error('❌ Eski fatura tablosu silinemedi:', err);
                                                                db.close();
                                                                return reject(err);
                                                            }

                                                            db.run('ALTER TABLE tenants_faturalar_new RENAME TO tenants_faturalar', (err) => {
                                                                if (err) {
                                                                    console.error('❌ Fatura tablosu yeniden adlandırılamadı:', err);
                                                                    db.close();
                                                                    return reject(err);
                                                                }

                                                                console.log('✅ tenants_faturalar tablosu güncellendi (plan_adi -> plan_id)');
                                                                db.close();
                                                                resolve();
                                                            });
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
        });
                                    }); // db.all callback kapanışı (111. satır)
                                }); // db.run callback kapanışı (158. satır)
                            }); // db.run DROP TABLE callback kapanışı (129. satır)
                        }); // db.all callback kapanışı (165. satır)
                    }); // db.run ALTER TABLE callback kapanışı (98. satır)
                }); // db.run DROP TABLE callback kapanışı (91. satır)
            }); // db.get callback kapanışı (36. satır)
        }); // db.serialize kapanışı (19. satır)
    }); // Promise kapanışı (10. satır)
}

// Eğer doğrudan çalıştırılıyorsa
if (require.main === module) {
    migratePlanAdiToPlanId()
        .then(() => {
            console.log('\n✅ Migration tamamlandı! plan_adi kolonları kaldırıldı ve plan_id kullanılıyor.');
            process.exit(0);
        })
        .catch((err) => {
            console.error('\n❌ Migration hatası:', err);
            process.exit(1);
        });
}

module.exports = { migratePlanAdiToPlanId };
