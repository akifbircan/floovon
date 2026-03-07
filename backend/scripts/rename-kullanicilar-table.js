/**
 * Migration: Kullanıcı tablosu ismi
 *
 * - kullanicilar → tenants_kullanicilar
 * - users → tenants_kullanicilar (eski isimden direkt geçiş için)
 *
 * Çalıştırma: node backend/scripts/rename-kullanicilar-table.js
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
  console.log('📦 Kullanıcı tablosu ismi güncelleniyor...');

  // 1) kullanicilar → tenants_kullanicilar
  try {
    await run('ALTER TABLE kullanicilar RENAME TO tenants_kullanicilar;');
    console.log('✅ kullanicilar → tenants_kullanicilar');
  } catch (e) {
    if (e.message && e.message.includes('no such table')) {
      console.log('⚠️ kullanicilar tablosu yok, atlanıyor.');
    } else {
      throw e;
    }
  }

  // 2) users → tenants_kullanicilar (çok eski şema için)
  try {
    await run('ALTER TABLE users RENAME TO tenants_kullanicilar;');
    console.log('✅ users → tenants_kullanicilar');
  } catch (e) {
    if (e.message && e.message.includes('no such table')) {
      console.log('⚠️ users tablosu yok, atlanıyor.');
    } else if (e.message && e.message.includes('already exists')) {
      console.log('⚠️ tenants_kullanicilar zaten var, users → tenants_kullanicilar atlandı.');
    } else {
      throw e;
    }
  }

  db.close();
  console.log('✅ Kullanıcı tablosu migration tamamlandı. Backend\'i yeniden başlatabilirsiniz.');
}

main().catch((err) => {
  console.error(err);
  db.close();
  process.exit(1);
});

