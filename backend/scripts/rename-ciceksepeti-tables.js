/**
 * Migration: ÇiçekSepeti ile ilgili tablo isimleri
 *
 * - ciceksepeti_orders / siparisler_ciceksepeti → organizasyon_siparisler_ciceksepeti
 * - ciceksepeti_settings → ayarlar_ciceksepeti_ayalari
 *
 * Çalıştırma: node backend/scripts/rename-ciceksepeti-tables.js
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const dbPath = process.env.BACKEND_DB_PATH || path.join(__dirname, '../floovon_professional.db');

if (!fs.existsSync(dbPath)) {
  console.error('Veritabanı bulunamadı:', dbPath);
  process.exit(1);
}

const db = new sqlite3.Database(dbPath);

function run(sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => (err ? reject(err) : resolve()));
  });
}

async function main() {
  console.log('📦 ÇiçekSepeti tablo isimleri güncelleniyor...');

  // 1) ciceksepeti_orders → organizasyon_siparisler_ciceksepeti
  try {
    await run('ALTER TABLE ciceksepeti_orders RENAME TO organizasyon_siparisler_ciceksepeti;');
    console.log('✅ ciceksepeti_orders → organizasyon_siparisler_ciceksepeti');
  } catch (e) {
    if (e.message && e.message.includes('no such table')) {
      console.log('⚠️ ciceksepeti_orders yok, atlanıyor.');
    } else {
      throw e;
    }
  }

  // 2) siparisler_ciceksepeti → organizasyon_siparisler_ciceksepeti
  try {
    await run('ALTER TABLE siparisler_ciceksepeti RENAME TO organizasyon_siparisler_ciceksepeti;');
    console.log('✅ siparisler_ciceksepeti → organizasyon_siparisler_ciceksepeti');
  } catch (e) {
    if (e.message && e.message.includes('no such table')) {
      console.log('⚠️ siparisler_ciceksepeti yok, atlanıyor.');
    } else {
      throw e;
    }
  }

  // 3) ciceksepeti_settings → ayarlar_ciceksepeti_ayalari
  try {
    await run('ALTER TABLE ciceksepeti_settings RENAME TO ayarlar_ciceksepeti_ayalari;');
    console.log('✅ ciceksepeti_settings → ayarlar_ciceksepeti_ayalari');
  } catch (e) {
    if (e.message && e.message.includes('no such table')) {
      console.log('⚠️ ciceksepeti_settings yok, atlanıyor.');
    } else {
      throw e;
    }
  }

  db.close();
  console.log('✅ ÇiçekSepeti migration tamamlandı. Backend\'i yeniden başlatabilirsiniz.');
}

main().catch((err) => {
  console.error(err);
  db.close();
  process.exit(1);
});

