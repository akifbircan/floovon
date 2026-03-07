const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../floovon_professional.db');

/**
 * Billing verilerini kontrol et
 */
function checkBillingData() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Veritabanı bağlantı hatası:', err);
                return reject(err);
            }
            console.log('✅ Veritabanına bağlandı\n');
        });

        db.serialize(() => {
            // 1. Tenant kontrolü
            db.get('SELECT id, name FROM tenants LIMIT 1', [], (err, tenant) => {
                if (err || !tenant) {
                    console.log('❌ Tenant bulunamadı!');
                    db.close();
                    return resolve();
                }

                const tenantId = tenant.id;
                console.log(`📋 Tenant: ${tenant.name} (ID: ${tenantId})\n`);

                // 2. Abonelik planları kontrolü
                db.all('SELECT * FROM tenants_abonelik_planlari', [], (err, plans) => {
                    if (err) {
                        console.error('❌ Planlar kontrol edilemedi:', err.message);
                    } else {
                        console.log(`📦 Abonelik Planları: ${plans.length} plan`);
                        plans.forEach(plan => {
                            console.log(`   - ${plan.plan_adi} (ID: ${plan.id}, Max Kullanıcı: ${plan.max_kullanici}, Max Depolama: ${plan.max_depolama_gb} GB, Ücret: ₺${(plan.aylik_ucret / 100).toFixed(2)})`);
                        });
                        console.log('');
                    }

                    // 3. Abonelik kontrolü
                    db.all('SELECT * FROM tenants_abonelikler WHERE tenant_id = ?', [tenantId], (err, abonelikler) => {
                        if (err) {
                            console.error('❌ Abonelikler kontrol edilemedi:', err.message);
                        } else {
                            console.log(`📋 Abonelikler: ${abonelikler.length} abonelik`);
                            abonelikler.forEach(ab => {
                                console.log(`   - ID: ${ab.id}, Plan ID: ${ab.plan_id}, Durum: ${ab.durum}, Sonraki Ödeme: ${ab.sonraki_odeme_tarihi || 'YOK'}`);
                            });
                            console.log('');
                        }

                        // 4. Kullanım kontrolü
                        db.all('SELECT * FROM tenants_kullanimlar WHERE tenant_id = ?', [tenantId], (err, kullanimlar) => {
                            if (err) {
                                console.error('❌ Kullanımlar kontrol edilemedi:', err.message);
                            } else {
                                console.log(`💾 Kullanımlar: ${kullanimlar.length} kayıt`);
                                kullanimlar.forEach(k => {
                                    const usedGB = Math.round(k.kullanilan_depolama_byte / (1024 * 1024 * 1024));
                                    const limitGB = Math.round(k.depolama_limit_byte / (1024 * 1024 * 1024));
                                    console.log(`   - Kullanıcı Sayısı: ${k.kullanici_sayisi}, Depolama: ${usedGB} GB / ${limitGB} GB`);
                                });
                                console.log('');
                            }

                            // 5. Ödeme yöntemleri kontrolü
                            db.all('SELECT * FROM tenants_odeme_yontemleri WHERE tenant_id = ?', [tenantId], (err, odemeler) => {
                                if (err) {
                                    console.error('❌ Ödeme yöntemleri kontrol edilemedi:', err.message);
                                } else {
                                    console.log(`💳 Ödeme Yöntemleri: ${odemeler.length} yöntem`);
                                    odemeler.forEach(od => {
                                        console.log(`   - ${od.kart_tipi} **** ${od.son_dort_rakam}, Son Kullanma: ${od.son_kullanim_ayi}/${od.son_kullanim_yili}, Varsayılan: ${od.varsayilan_mi ? 'Evet' : 'Hayır'}`);
                                    });
                                    console.log('');
                                }

                                // 6. Faturalar kontrolü
                                db.all('SELECT * FROM tenants_faturalar WHERE tenant_id = ?', [tenantId], (err, faturalar) => {
                                    if (err) {
                                        console.error('❌ Faturalar kontrol edilemedi:', err.message);
                                    } else {
                                        console.log(`📄 Faturalar: ${faturalar.length} fatura`);
                                        faturalar.forEach(f => {
                                            console.log(`   - ${f.fatura_no}, Tarih: ${f.fatura_tarihi}, Tutar: ₺${(f.toplam_tutar / 100).toFixed(2)}, Durum: ${f.durum}, Plan ID: ${f.plan_id || 'YOK'}`);
                                        });
                                        console.log('');
                                    }

                                    // Özet
                                    console.log('═══════════════════════════════════════');
                                    console.log('📊 ÖZET:');
                                    console.log(`   ✅ Abonelik Planları: ${plans.length} plan`);
                                    console.log(`   ${abonelikler.length > 0 ? '✅' : '❌'} Abonelikler: ${abonelikler.length} abonelik`);
                                    console.log(`   ${kullanimlar.length > 0 ? '✅' : '❌'} Kullanımlar: ${kullanimlar.length} kayıt`);
                                    console.log(`   ${odemeler.length > 0 ? '✅' : '❌'} Ödeme Yöntemleri: ${odemeler.length} yöntem`);
                                    console.log(`   ${faturalar.length > 0 ? '✅' : '❌'} Faturalar: ${faturalar.length} fatura`);
                                    console.log('═══════════════════════════════════════\n');

                                    // Eksik veriler varsa uyarı ver
                                    if (abonelikler.length === 0) {
                                        console.log('⚠️ UYARI: Bu tenant için abonelik kaydı yok!');
                                    }
                                    if (kullanimlar.length === 0) {
                                        console.log('⚠️ UYARI: Bu tenant için kullanım kaydı yok!');
                                    }
                                    if (odemeler.length === 0) {
                                        console.log('⚠️ UYARI: Bu tenant için ödeme yöntemi yok!');
                                    }

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
}

// Eğer doğrudan çalıştırılıyorsa
if (require.main === module) {
    checkBillingData()
        .then(() => {
            console.log('\n✅ Kontrol tamamlandı!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('\n❌ Hata:', err);
            process.exit(1);
        });
}

module.exports = { checkBillingData };
