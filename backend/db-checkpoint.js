#!/usr/bin/env node
/**
 * SQLite WAL checkpoint: Tüm güncel veriyi .db dosyasına yazar.
 * Local'de sunucuya DB kopyalamadan ÖNCE çalıştır:
 *   node db-checkpoint.js
 * Böylece floovon_professional.db tek başına güncel olur ve kopyalayabilirsin.
 */
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.resolve(__dirname, 'floovon_professional.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('DB açılamadı:', err.message);
    process.exit(1);
  }
});

db.run('PRAGMA wal_checkpoint(FULL)', function(err) {
  if (err) {
    console.error('Checkpoint hatası:', err.message);
    db.close();
    process.exit(1);
  }
  console.log('OK: WAL checkpoint yapıldı. floovon_professional.db artık güncel; sunucuya bu dosyayı kopyalayabilirsin.');
  db.close();
});
