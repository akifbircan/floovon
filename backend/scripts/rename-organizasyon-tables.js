/**
 * Migration: Organizasyon tablo isimleri
 * - organizasyon_turleri (Düğün, Nişan vb.) → organizasyon_alt_turleri
 * - organizasyon_gruplari (Organizasyon, Özel Gün vb.) → organizasyon_turleri
 *
 * Çalıştırma: node backend/scripts/rename-organizasyon-tables.js
 * Veritabanı: backend/data/database.sqlite (veya BACKEND_DB_PATH)
 */

const path = require('path');
const fs = require('fs');
const dbPath = process.env.BACKEND_DB_PATH || path.join(__dirname, '../floovon_professional.db');

if (!fs.existsSync(dbPath)) {
  console.error('Veritabanı bulunamadı:', dbPath);
  process.exit(1);
}

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(dbPath);

function run(sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => (err ? reject(err) : resolve()));
  });
}

async function main() {
  console.log('📦 Tablo isimleri güncelleniyor...');
  try {
    await run('ALTER TABLE organizasyon_turleri RENAME TO organizasyon_alt_turleri;');
    console.log('✅ organizasyon_turleri → organizasyon_alt_turleri');
  } catch (e) {
    if (e.message && e.message.includes('no such table')) console.log('⚠️ organizasyon_turleri yok, atlanıyor.');
    else throw e;
  }
  try {
    await run('ALTER TABLE organizasyon_gruplari RENAME TO organizasyon_turleri;');
    console.log('✅ organizasyon_gruplari → organizasyon_turleri');
  } catch (e) {
    if (e.message && e.message.includes('no such table')) console.log('⚠️ organizasyon_gruplari yok, atlanıyor.');
    else throw e;
  }
  db.close();
  console.log('✅ Migration tamamlandı. Backend\'i yeniden başlatın.');
}

main().catch((err) => {
  console.error(err);
  db.close();
  process.exit(1);
});
