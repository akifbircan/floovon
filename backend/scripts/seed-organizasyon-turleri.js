/**
 * Organizasyon ana türleri ve alt türlerini veritabanına seed eder.
 *
 * organizasyon_turleri: Organizasyon, Özel Gün, Özel Sipariş, Araç Süsleme
 * organizasyon_alt_turleri: Her ana türe bağlı alt türler (grup_id ile)
 *
 * Çalıştırma: node backend/scripts/seed-organizasyon-turleri.js
 * Veritabanı: backend/floovon_professional.db (veya BACKEND_DB_PATH)
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const dbPath = process.env.BACKEND_DB_PATH || path.resolve(__dirname, '../floovon_professional.db');
const TENANT_ID = 1;

if (!fs.existsSync(dbPath)) {
  console.error('❌ Veritabanı bulunamadı:', dbPath);
  process.exit(1);
}

const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

const ANA_TURLER = [
  { grup_adi: 'Organizasyon' },
  { grup_adi: 'Özel Gün' },
  { grup_adi: 'Özel Sipariş' },
  { grup_adi: 'Araç Süsleme' },
];

const ALT_TURLER = [
  { grup_ana_adi: 'Organizasyon', tur_adi: 'Düğün', sira_no: 1 },
  { grup_ana_adi: 'Organizasyon', tur_adi: 'Nişan', sira_no: 2 },
  { grup_ana_adi: 'Organizasyon', tur_adi: 'Sünnet', sira_no: 3 },
  { grup_ana_adi: 'Organizasyon', tur_adi: 'Kesme', sira_no: 4 },
  { grup_ana_adi: 'Özel Gün', tur_adi: 'Anneler Günü', sira_no: 1 },
  { grup_ana_adi: 'Özel Gün', tur_adi: 'Öğretmenler Günü', sira_no: 2 },
  { grup_ana_adi: 'Özel Gün', tur_adi: 'Sevgililer Günü', sira_no: 3 },
  { grup_ana_adi: 'Özel Sipariş', tur_adi: 'Buket Aranjmanı', sira_no: 1 },
  { grup_ana_adi: 'Özel Sipariş', tur_adi: 'Saksı Çiçek', sira_no: 2 },
  { grup_ana_adi: 'Özel Sipariş', tur_adi: 'Muhtelif', sira_no: 3 },
  { grup_ana_adi: 'Araç Süsleme', tur_adi: 'Gelin Arabası', sira_no: 1 },
  { grup_ana_adi: 'Araç Süsleme', tur_adi: 'Sünnet Arabası', sira_no: 2 },
  { grup_ana_adi: 'Araç Süsleme', tur_adi: 'Eskort Araç', sira_no: 3 },
  { grup_ana_adi: 'Araç Süsleme', tur_adi: 'Muhtelif', sira_no: 4 },
];

async function main() {
  console.log('📁 Veritabanı:', dbPath);
  console.log('📦 Organizasyon türleri seed başlıyor...\n');

  try {
    const tableTurleri = await all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='organizasyon_turleri'"
    );
    if (tableTurleri.length === 0) {
      console.error('❌ organizasyon_turleri tablosu yok. Önce migration/rename çalıştırın.');
      process.exit(1);
    }

    const columnsTurleri = await all('PRAGMA table_info(organizasyon_turleri)');
    const columnsAltTurleri = await all('PRAGMA table_info(organizasyon_alt_turleri)');
    const hasTenantTurleri = columnsTurleri.some((c) => c.name === 'tenant_id');
    const hasTenantAlt = columnsAltTurleri.some((c) => c.name === 'tenant_id');
    const hasGrupId = columnsAltTurleri.some((c) => c.name === 'grup_id');
    const hasSiraNo = columnsAltTurleri.some((c) => c.name === 'sira_no');

    if (!hasGrupId) {
      console.error('❌ organizasyon_alt_turleri tablosunda grup_id kolonu yok.');
      process.exit(1);
    }

    let idByGrupAdi = {};
    const mevcutTurler = await all(
      'SELECT id, grup_adi FROM organizasyon_turleri WHERE tenant_id = ? OR tenant_id IS NULL ORDER BY id',
      [TENANT_ID]
    );
    for (const row of mevcutTurler) {
      idByGrupAdi[row.grup_adi] = row.id;
    }

    for (const t of ANA_TURLER) {
      if (!idByGrupAdi[t.grup_adi]) {
        const sql = hasTenantTurleri
          ? `INSERT INTO organizasyon_turleri (grup_adi, tenant_id, is_active, created_at, updated_at) VALUES (?, ?, 1, datetime('now'), datetime('now'))`
          : `INSERT INTO organizasyon_turleri (grup_adi, created_at, updated_at) VALUES (?, datetime('now'), datetime('now'))`;
        const params = hasTenantTurleri ? [t.grup_adi, TENANT_ID] : [t.grup_adi];
        const r = await run(sql, params);
        idByGrupAdi[t.grup_adi] = r.lastID;
        console.log('  ✅ Ana tür eklendi:', t.grup_adi, '(id=' + r.lastID + ')');
      }
    }

    const tumTurler = await all(
      'SELECT id, grup_adi FROM organizasyon_turleri WHERE tenant_id = ? OR tenant_id IS NULL ORDER BY id',
      [TENANT_ID]
    );
    idByGrupAdi = {};
    for (const row of tumTurler) {
      idByGrupAdi[row.grup_adi] = row.id;
    }
    const grupIds = Object.values(idByGrupAdi);
    const placeholders = grupIds.map(() => '?').join(',');

    if (hasTenantAlt) {
      await run(
        `DELETE FROM organizasyon_alt_turleri WHERE grup_id IN (${placeholders}) AND (tenant_id = ? OR tenant_id IS NULL)`,
        [...grupIds, TENANT_ID]
      );
    } else {
      await run(`DELETE FROM organizasyon_alt_turleri WHERE grup_id IN (${placeholders})`, grupIds);
    }
    console.log('  🗑️ Eski alt tür kayıtları silindi.');

    for (const alt of ALT_TURLER) {
      const grupId = idByGrupAdi[alt.grup_ana_adi];
      if (!grupId) continue;
      const sira = hasSiraNo ? alt.sira_no : null;
      let sql, params;
      if (hasTenantAlt && hasSiraNo) {
        sql = `INSERT INTO organizasyon_alt_turleri (tur_adi, grup_id, sira_no, tenant_id, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))`;
        params = [alt.tur_adi, grupId, sira, TENANT_ID];
      } else if (hasTenantAlt) {
        sql = `INSERT INTO organizasyon_alt_turleri (tur_adi, grup_id, tenant_id, is_active, created_at, updated_at) VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))`;
        params = [alt.tur_adi, grupId, TENANT_ID];
      } else if (hasSiraNo) {
        sql = `INSERT INTO organizasyon_alt_turleri (tur_adi, grup_id, sira_no, is_active, created_at, updated_at) VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))`;
        params = [alt.tur_adi, grupId, sira];
      } else {
        sql = `INSERT INTO organizasyon_alt_turleri (tur_adi, grup_id, is_active, created_at, updated_at) VALUES (?, ?, 1, datetime('now'), datetime('now'))`;
        params = [alt.tur_adi, grupId];
      }
      await run(sql, params);
      console.log('  ✅ Alt tür:', alt.grup_ana_adi, '→', alt.tur_adi);
    }

    console.log('\n✅ Seed tamamlandı.');
  } catch (err) {
    console.error('❌ Hata:', err);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
