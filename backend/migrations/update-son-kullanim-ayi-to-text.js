const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../floovon_professional.db');

function updateSonKullanimAyToText() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Veritabanı bağlantı hatası:', err);
                return reject(err);
            }
        });

        db.serialize(() => {
            // Önce tablo var mı kontrol et
            db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='tenants_odeme_yontemleri'", [], (err, tableRow) => {
                if (err) {
                    console.error('❌ Tablo kontrolü hatası:', err);
                    db.close();
                    return reject(err);
                }

                if (!tableRow) {
                    console.log('ℹ️ tenants_odeme_yontemleri tablosu bulunamadı, migration atlanıyor');
                    db.close();
                    return resolve();
                }

                // Kolon tipini kontrol et
                db.all("PRAGMA table_info(tenants_odeme_yontemleri)", [], (err, columns) => {
                    if (err) {
                        console.error('❌ Kolon bilgisi alınırken hata:', err);
                        db.close();
                        return reject(err);
                    }

                    const ayColumn = columns.find(col => col.name === 'son_kullanim_ayi');
                    if (!ayColumn) {
                        console.log('ℹ️ son_kullanim_ayi kolonu bulunamadı, migration atlanıyor');
                        db.close();
                        return resolve();
                    }

                    // Eğer zaten TEXT ise, migration'a gerek yok
                    if (ayColumn.type && ayColumn.type.toUpperCase() === 'TEXT') {
                        console.log('ℹ️ son_kullanim_ayi kolonu zaten TEXT tipinde, migration atlanıyor');
                        db.close();
                        return resolve();
                    }

                    // SQLite'da kolon tipini değiştirmek için yeni tablo oluşturup verileri kopyalayıp eski tabloyu silmek gerekir
                    console.log('🔄 son_kullanim_ayi kolonu TEXT tipine dönüştürülüyor...');

                    // 1. Yeni geçici tablo oluştur (son_kullanim_ayi TEXT olarak)
                    db.run(`
                        CREATE TABLE IF NOT EXISTS tenants_odeme_yontemleri_new (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            tenant_id INTEGER NOT NULL,
                            kart_tipi TEXT NOT NULL,
                            son_dort_rakam TEXT NOT NULL,
                            son_kullanim_ayi TEXT NOT NULL,
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
                            console.error('❌ Yeni tablo oluşturulurken hata:', err);
                            db.close();
                            return reject(err);
                        }

                        // 2. Mevcut verileri oku
                        db.all('SELECT * FROM tenants_odeme_yontemleri', [], (err, rows) => {
                            if (err) {
                                console.error('❌ Veriler okunurken hata:', err);
                                db.run('DROP TABLE IF EXISTS tenants_odeme_yontemleri_new', () => {
                                    db.close();
                                });
                                return reject(err);
                            }

                            // 3. Her satırı yeni tabloya ekle (ay değerini 2 haneli string formatına çevir)
                            if (rows.length === 0) {
                                // Veri yoksa, eski tabloyu sil ve yeni tabloyu orijinal isimle yeniden adlandır
                                db.run('DROP TABLE tenants_odeme_yontemleri', (err) => {
                                    if (err) {
                                        console.error('❌ Eski tablo silinirken hata:', err);
                                        db.run('DROP TABLE IF EXISTS tenants_odeme_yontemleri_new', () => {
                                            db.close();
                                        });
                                        return reject(err);
                                    }

                                    db.run('ALTER TABLE tenants_odeme_yontemleri_new RENAME TO tenants_odeme_yontemleri', (err) => {
                                        if (err) {
                                            console.error('❌ Tablo yeniden adlandırılırken hata:', err);
                                            db.close();
                                            return reject(err);
                                        }

                                        console.log('✅ son_kullanim_ayi kolonu TEXT tipine dönüştürüldü (veri yoktu)');
                                        db.close();
                                        return resolve();
                                    });
                                });
                                return;
                            }

                            let inserted = 0;
                            rows.forEach((row) => {
                                // Ay değerini 2 haneli string formatına çevir (01, 02, ..., 12)
                                const ayValue = row.son_kullanim_ayi;
                                let ayFormatted;
                                if (typeof ayValue === 'number') {
                                    ayFormatted = String(ayValue).padStart(2, '0');
                                } else if (typeof ayValue === 'string') {
                                    const ayNum = parseInt(ayValue);
                                    ayFormatted = isNaN(ayNum) ? ayValue : String(ayNum).padStart(2, '0');
                                } else {
                                    ayFormatted = '01'; // Varsayılan değer
                                }

                                db.run(`
                                    INSERT INTO tenants_odeme_yontemleri_new 
                                    (id, tenant_id, kart_tipi, son_dort_rakam, son_kullanim_ayi, son_kullanim_yili, 
                                     kart_sahibi_adi, varsayilan_mi, aktif_mi, olusturma_tarihi, guncelleme_tarihi)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                `, [
                                    row.id, row.tenant_id, row.kart_tipi, row.son_dort_rakam,
                                    ayFormatted, row.son_kullanim_yili, row.kart_sahibi_adi,
                                    row.varsayilan_mi, row.aktif_mi, row.olusturma_tarihi, row.guncelleme_tarihi
                                ], (err) => {
                                    if (err) {
                                        console.error('❌ Veri eklenirken hata:', err);
                                        db.run('DROP TABLE IF EXISTS tenants_odeme_yontemleri_new', () => {
                                            db.close();
                                        });
                                        return reject(err);
                                    }

                                    inserted++;
                                    if (inserted === rows.length) {
                                        // Tüm veriler eklendi, eski tabloyu sil
                                        db.run('DROP TABLE tenants_odeme_yontemleri', (err) => {
                                            if (err) {
                                                console.error('❌ Eski tablo silinirken hata:', err);
                                                db.run('DROP TABLE IF EXISTS tenants_odeme_yontemleri_new', () => {
                                                    db.close();
                                                });
                                                return reject(err);
                                            }

                                            // Yeni tabloyu orijinal isimle yeniden adlandır
                                            db.run('ALTER TABLE tenants_odeme_yontemleri_new RENAME TO tenants_odeme_yontemleri', (err) => {
                                                if (err) {
                                                    console.error('❌ Tablo yeniden adlandırılırken hata:', err);
                                                    db.close();
                                                    return reject(err);
                                                }

                                                console.log(`✅ son_kullanim_ayi kolonu TEXT tipine dönüştürüldü ve ${rows.length} kayıt güncellendi (01, 02, ..., 12 formatı)`);
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
}

if (require.main === module) {
    updateSonKullanimAyToText()
        .then(() => {
            console.log('✅ Migration tamamlandı');
            process.exit(0);
        })
        .catch((err) => {
            console.error('❌ Migration hatası:', err);
            process.exit(1);
        });
}

module.exports = updateSonKullanimAyToText;
