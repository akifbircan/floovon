/**
 * Veritabanı verilerini yedekten aktar
 * organizasyon_kartlar ve siparis_kartlar tablolarını güncel veritabanına aktarır
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const YEDEK_DB_PATH = path.join('D:', 'FLOOVON-CURSOR-YEDEKLER', '2026-02-17', '04---YEDEK-GELEN-FLOOVON-KLASORU-YEDEGI', 'FLOOVON', 'backend', 'floovon_professional.db');
const GUNCEL_DB_PATH = path.join(__dirname, 'floovon_professional.db');

function restoreData() {
  return new Promise((resolve, reject) => {
    console.log('📦 Veritabanı aktarımı başlatılıyor...');
    console.log('Yedek DB:', YEDEK_DB_PATH);
    console.log('Güncel DB:', GUNCEL_DB_PATH);
    
    // Dosyaların varlığını kontrol et
    if (!fs.existsSync(YEDEK_DB_PATH)) {
      reject(new Error(`Yedek veritabanı bulunamadı: ${YEDEK_DB_PATH}`));
      return;
    }
    
    if (!fs.existsSync(GUNCEL_DB_PATH)) {
      reject(new Error(`Güncel veritabanı bulunamadı: ${GUNCEL_DB_PATH}`));
      return;
    }
    
    const yedekDb = new sqlite3.Database(YEDEK_DB_PATH, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        reject(err);
        return;
      }
      console.log('✅ Yedek veritabanı açıldı');
    });
    
    const guncelDb = new sqlite3.Database(GUNCEL_DB_PATH, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        yedekDb.close();
        reject(err);
        return;
      }
      console.log('✅ Güncel veritabanı açıldı');
      
      // organizasyon_kartlar verilerini aktar
      yedekDb.all('SELECT * FROM organizasyon_kartlar', [], (err, orgRows) => {
        if (err) {
          console.error('❌ organizasyon_kartlar verileri okunamadı:', err);
          yedekDb.close();
          guncelDb.close();
          reject(err);
          return;
        }
        
        console.log(`📊 ${orgRows.length} adet organizasyon_kartlar kaydı bulundu`);
        
        let orgInserted = 0;
        let orgUpdated = 0;
        let orgProcessed = 0;
        
        if (orgRows.length === 0) {
          processSiparisKartlar();
          return;
        }
        
        orgRows.forEach((row) => {
          // Mevcut kaydı kontrol et
          guncelDb.get('SELECT id FROM organizasyon_kartlar WHERE id = ?', [row.id], (err, existing) => {
            if (err) {
              console.error(`❌ Organizasyon kartı kontrol edilemedi (ID: ${row.id}):`, err);
              orgProcessed++;
              if (orgProcessed === orgRows.length) {
                console.log(`✅ organizasyon_kartlar: ${orgInserted} eklendi, ${orgUpdated} güncellendi`);
                processSiparisKartlar();
              }
              return;
            }
            
            if (existing) {
              // Kayıt varsa güncelle
              const columns = Object.keys(row).filter(k => k !== 'id');
              const values = columns.map(col => row[col]);
              values.push(row.id);
              
              const updateSql = `UPDATE organizasyon_kartlar SET ${columns.map(c => `${c} = ?`).join(', ')} WHERE id = ?`;
              
              guncelDb.run(updateSql, values, (err) => {
                if (err) {
                  console.error(`❌ Organizasyon kartı güncellenemedi (ID: ${row.id}):`, err.message);
                } else {
                  orgUpdated++;
                }
                orgProcessed++;
                if (orgProcessed === orgRows.length) {
                  console.log(`✅ organizasyon_kartlar: ${orgInserted} eklendi, ${orgUpdated} güncellendi`);
                  processSiparisKartlar();
                }
              });
            } else {
              // Kayıt yoksa ekle
              const columns = Object.keys(row);
              const values = columns.map(col => row[col]);
              
              const insertSql = `INSERT INTO organizasyon_kartlar (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
              
              guncelDb.run(insertSql, values, (err) => {
                if (err) {
                  console.error(`❌ Organizasyon kartı eklenemedi (ID: ${row.id}):`, err.message);
                } else {
                  orgInserted++;
                }
                orgProcessed++;
                if (orgProcessed === orgRows.length) {
                  console.log(`✅ organizasyon_kartlar: ${orgInserted} eklendi, ${orgUpdated} güncellendi`);
                  processSiparisKartlar();
                }
              });
            }
          });
        });
      });
      
      function processSiparisKartlar() {
        // siparis_kartlar verilerini aktar
        yedekDb.all('SELECT * FROM siparis_kartlar', [], (err, siparisRows) => {
          if (err) {
            console.error('❌ siparis_kartlar verileri okunamadı:', err);
            yedekDb.close();
            guncelDb.close();
            reject(err);
            return;
          }
          
          console.log(`📊 ${siparisRows.length} adet siparis_kartlar kaydı bulundu`);
          
          let siparisInserted = 0;
          let siparisUpdated = 0;
          let siparisProcessed = 0;
          
          if (siparisRows.length === 0) {
            console.log('✅ Veritabanı aktarımı tamamlandı!');
            yedekDb.close();
            guncelDb.close();
            resolve();
            return;
          }
          
          siparisRows.forEach((row) => {
            // Mevcut kaydı kontrol et
            guncelDb.get('SELECT id FROM siparis_kartlar WHERE id = ?', [row.id], (err, existing) => {
              if (err) {
                console.error(`❌ Sipariş kartı kontrol edilemedi (ID: ${row.id}):`, err);
                siparisProcessed++;
                if (siparisProcessed === siparisRows.length) {
                  console.log(`✅ siparis_kartlar: ${siparisInserted} eklendi, ${siparisUpdated} güncellendi`);
                  console.log('✅ Veritabanı aktarımı tamamlandı!');
                  yedekDb.close();
                  guncelDb.close();
                  resolve();
                }
                return;
              }
              
              if (existing) {
                // Kayıt varsa güncelle
                const columns = Object.keys(row).filter(k => k !== 'id');
                const values = columns.map(col => row[col]);
                values.push(row.id);
                
                const updateSql = `UPDATE siparis_kartlar SET ${columns.map(c => `${c} = ?`).join(', ')} WHERE id = ?`;
                
                guncelDb.run(updateSql, values, (err) => {
                  if (err) {
                    console.error(`❌ Sipariş kartı güncellenemedi (ID: ${row.id}):`, err.message);
                  } else {
                    siparisUpdated++;
                  }
                  siparisProcessed++;
                  if (siparisProcessed === siparisRows.length) {
                    console.log(`✅ siparis_kartlar: ${siparisInserted} eklendi, ${siparisUpdated} güncellendi`);
                    console.log('✅ Veritabanı aktarımı tamamlandı!');
                    yedekDb.close();
                    guncelDb.close();
                    resolve();
                  }
                });
              } else {
                // Kayıt yoksa ekle
                const columns = Object.keys(row);
                const values = columns.map(col => row[col]);
                
                const insertSql = `INSERT INTO siparis_kartlar (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
                
                guncelDb.run(insertSql, values, (err) => {
                  if (err) {
                    console.error(`❌ Sipariş kartı eklenemedi (ID: ${row.id}):`, err.message);
                  } else {
                    siparisInserted++;
                  }
                  siparisProcessed++;
                  if (siparisProcessed === siparisRows.length) {
                    console.log(`✅ siparis_kartlar: ${siparisInserted} eklendi, ${siparisUpdated} güncellendi`);
                    console.log('✅ Veritabanı aktarımı tamamlandı!');
                    yedekDb.close();
                    guncelDb.close();
                    resolve();
                  }
                });
              }
            });
          });
        });
      }
    });
  });
}

// Script çalıştır
restoreData()
  .then(() => {
    console.log('✅ Tüm işlemler başarıyla tamamlandı!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Hata:', error);
    process.exit(1);
  });

