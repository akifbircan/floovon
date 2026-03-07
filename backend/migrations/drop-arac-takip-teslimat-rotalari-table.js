/**
 * Migration: arac_takip_teslimat_rotalari tablosunu kaldır
 * Bu tablo artık kullanılmıyor, yerine arac_takip_teslimatlar kullanılıyor
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '..', 'floovon_professional.db');

async function dropAracTakipTeslimatRotalariTable() {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(dbPath)) {
            console.error('❌ Veritabanı dosyası bulunamadı:', dbPath);
            reject(new Error('Database file not found'));
            return;
        }

        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
            if (err) {
                console.error('❌ Veritabanı bağlantı hatası:', err);
                reject(err);
                return;
            }

            console.log('✅ Veritabanına bağlandı');
            
            // Önce tablonun var olup olmadığını kontrol et
            db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name='arac_takip_teslimat_rotalari'`, [], (err, rows) => {
                if (err) {
                    console.error('❌ Tablo kontrolü hatası:', err.message);
                    db.close();
                    reject(err);
                    return;
                }

                if (rows.length === 0) {
                    console.log('⚠️  arac_takip_teslimat_rotalari tablosu bulunamadı, zaten silinmiş olabilir');
                    db.close();
                    resolve();
                    return;
                }

                // Önce kayıt sayısını kontrol et
                db.get(`SELECT COUNT(*) as count FROM arac_takip_teslimat_rotalari`, [], (err, result) => {
                    if (err) {
                        console.warn('⚠️  Kayıt sayısı kontrol edilemedi:', err.message);
                    } else {
                        console.log(`ℹ️  Tabloda ${result.count} kayıt var`);
                    }

                    // Index'leri sil
                    db.all(`SELECT name FROM sqlite_master WHERE type='index' AND sql LIKE '%arac_takip_teslimat_rotalari%'`, [], (err, indexes) => {
                        if (err) {
                            console.warn('⚠️  Index kontrolü hatası:', err.message);
                        } else if (indexes.length > 0) {
                            console.log(`ℹ️  ${indexes.length} index bulundu, siliniyor...`);
                            indexes.forEach((idx) => {
                                db.run(`DROP INDEX IF EXISTS ${idx.name}`, (indexErr) => {
                                    if (indexErr) {
                                        console.warn(`⚠️  Index ${idx.name} silinemedi:`, indexErr.message);
                                    } else {
                                        console.log(`✅ Index ${idx.name} silindi`);
                                    }
                                });
                            });
                        }

                        // Tabloyu sil
                        db.run(`DROP TABLE IF EXISTS arac_takip_teslimat_rotalari`, (err) => {
                            if (err) {
                                console.error('❌ Tablo silme hatası:', err.message);
                                db.close();
                                reject(err);
                                return;
                            }

                            console.log('✅ arac_takip_teslimat_rotalari tablosu başarıyla silindi');

                            db.close((closeErr) => {
                                if (closeErr) {
                                    console.error('❌ Veritabanı kapatma hatası:', closeErr);
                                    reject(closeErr);
                                } else {
                                    console.log('✅ Migration tamamlandı!');
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

// Script olarak çalıştırılıyorsa
if (require.main === module) {
    dropAracTakipTeslimatRotalariTable()
        .then(() => {
            console.log('🎉 Tablo başarıyla silindi!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Migration hatası:', error);
            process.exit(1);
        });
}

module.exports = { dropAracTakipTeslimatRotalariTable };
