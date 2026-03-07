/**
 * Test Verilerini Sıfırla
 * 
 * Bu script test için tüm organizasyon kartlarını ve sipariş kartlarını
 * aktif duruma getirir (arşivlenmemiş, teslim edilmemiş).
 * 
 * Kullanım:
 *   node scripts/reset-test-data.js
 * 
 * Veya Windows'ta:
 *   reset-test-data.bat
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Veritabanı dosya yolu
const dbPath = path.resolve(__dirname, '../floovon_professional.db');

/**
 * Veritabanını aç
 */
function openDb(dbPath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(db);
      }
    });
  });
}

/**
 * Veritabanını kapat
 */
function closeDb(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * SQL sorgusu çalıştır (Promise wrapper)
 */
function runQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

/**
 * SQL sorgusu çalıştır ve sonuçları getir (Promise wrapper)
 */
function getQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

/**
 * Test verilerini sıfırla
 */
async function resetTestData() {
  console.log('🔄 Test verileri sıfırlanıyor...\n');
  
  // Veritabanı dosyasının var olup olmadığını kontrol et
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Veritabanı dosyası bulunamadı: ${dbPath}`);
    process.exit(1);
  }
  
  console.log(`📁 Veritabanı: ${dbPath}\n`);
  
  let db;
  
  try {
    // Veritabanını aç
    db = await openDb(dbPath);
    console.log('✅ Veritabanı bağlantısı açıldı\n');
    
    // 1. Organizasyon kartlarını sıfırla
    console.log('📋 Organizasyon kartları sıfırlanıyor...');
    const orgResult = await runQuery(
      db,
      `UPDATE organizasyon_kartlar 
       SET arsivli = 0, 
           arsivleme_sebebi = NULL,
           arsivleme_tarih = NULL
       WHERE arsivli = 1 OR arsivli IS NULL OR arsivli = '1' OR arsivleme_sebebi IS NOT NULL`
    );
    console.log(`   ✅ ${orgResult.changes} organizasyon kartı aktif duruma getirildi\n`);
    
    // 2. Sipariş kartlarını sıfırla
    console.log('📋 Sipariş kartları sıfırlanıyor...');
    
    // Önce teslim_edildi kolonunun var olup olmadığını kontrol et
    let hasTeslimEdildiColumn = false;
    try {
      const columns = await getQuery(
        db,
        `PRAGMA table_info(siparis_kartlar)`
      );
      hasTeslimEdildiColumn = columns.some(col => col.name === 'teslim_edildi');
    } catch (error) {
      console.warn('   ⚠️ Kolon kontrolü yapılamadı, devam ediliyor...');
    }
    
    // Sipariş kartlarını sıfırla - teslim_edildi kolonu varsa onu da sıfırla
    let siparisSql = `UPDATE siparis_kartlar 
       SET status = 'aktif',
           arsivli = 0,
           arsivleme_sebebi = NULL,
           arsivleme_tarih = NULL`;
    
    if (hasTeslimEdildiColumn) {
      siparisSql += `,
           teslim_edildi = 0,
           teslim_edildi_tarih = NULL`;
    }
    
    siparisSql += `
       WHERE status != 'aktif' 
          OR arsivli = 1 
          OR arsivli IS NULL 
          OR arsivli = '1' 
          OR arsivleme_sebebi IS NOT NULL`;
    
    if (hasTeslimEdildiColumn) {
      siparisSql += `
          OR teslim_edildi = 1
          OR teslim_edildi IS NULL
          OR teslim_edildi = '1'`;
    }
    
    const siparisResult = await runQuery(db, siparisSql);
    console.log(`   ✅ ${siparisResult.changes} sipariş kartı aktif duruma getirildi\n`);
    
    // 3. Sonuçları kontrol et
    console.log('🔍 Sonuçlar kontrol ediliyor...\n');
    
    const aktifOrgCount = await getQuery(
      db,
      `SELECT COUNT(*) as count 
       FROM organizasyon_kartlar 
       WHERE (arsivli = 0 OR arsivli IS NULL) 
         AND (arsivleme_sebebi IS NULL OR arsivleme_sebebi = '')`
    );
    
    const arsivliOrgCount = await getQuery(
      db,
      `SELECT COUNT(*) as count 
       FROM organizasyon_kartlar 
       WHERE arsivli = 1`
    );
    
    const aktifSiparisCount = await getQuery(
      db,
      `SELECT COUNT(*) as count 
       FROM siparis_kartlar 
       WHERE status = 'aktif' 
         AND (arsivli = 0 OR arsivli IS NULL) 
         AND (arsivleme_sebebi IS NULL OR arsivleme_sebebi = '')`
    );
    
    const arsivliSiparisCount = await getQuery(
      db,
      `SELECT COUNT(*) as count 
       FROM siparis_kartlar 
       WHERE arsivli = 1 OR status != 'aktif'`
    );
    
    console.log('📊 Özet:');
    console.log(`   ✅ Aktif organizasyon kartları: ${aktifOrgCount[0].count}`);
    console.log(`   📦 Arşivli organizasyon kartları: ${arsivliOrgCount[0].count}`);
    console.log(`   ✅ Aktif sipariş kartları: ${aktifSiparisCount[0].count}`);
    console.log(`   📦 Arşivli/teslim edilmiş sipariş kartları: ${arsivliSiparisCount[0].count}\n`);
    
    console.log('✅ Test verileri başarıyla sıfırlandı!\n');
    
  } catch (error) {
    console.error('❌ Hata:', error);
    console.error('❌ Hata detayları:', error.message);
    if (error.stack) {
      console.error('❌ Stack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    // Veritabanını kapat
    if (db) {
      await closeDb(db);
      console.log('✅ Veritabanı bağlantısı kapatıldı');
    }
  }
}

// Script'i çalıştır
if (require.main === module) {
  resetTestData()
    .then(() => {
      console.log('\n✅ İşlem tamamlandı!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ İşlem başarısız:', error);
      process.exit(1);
    });
}

module.exports = { resetTestData };

