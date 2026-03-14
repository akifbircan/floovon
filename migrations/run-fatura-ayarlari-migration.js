#!/usr/bin/env node
/**
 * Migration: Fatura ayarları tabloları ve veri doldurma.
 * ayarlar_fatura_fatura_ayarlari ve ayarlar_fatura_banka_hesaplari tablolarını oluşturur,
 * İşletme bilgilerinden (tenants + ayarlar_genel_isletme_ayarlari) doldurur,
 * her tenant için 3 banka kaydı ekler.
 *
 * Çalıştırma (proje kökünden): node migrations/run-fatura-ayarlari-migration.js
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.resolve(__dirname, '..', 'backend', 'node_modules', 'sqlite3')).verbose();

const DB_PATH = path.resolve(__dirname, '..', 'backend', 'floovon_professional.db');
const FATURA_AYARLARI_TABLE = 'ayarlar_fatura_fatura_ayarlari';
const FATURA_BANKA_TABLE = 'ayarlar_fatura_banka_hesaplari';

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function query(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

async function main() {
    if (!fs.existsSync(DB_PATH)) {
        console.error('❌ Veritabanı bulunamadı:', DB_PATH);
        process.exit(1);
    }
    const db = new sqlite3.Database(DB_PATH);
    try {
        console.log('🔄 Fatura migration başlıyor...\n');

        // 1. Tabloları oluştur
        console.log('📋 1. ayarlar_fatura tabloları oluşturuluyor...');
        await run(db, `
            CREATE TABLE IF NOT EXISTS ${FATURA_AYARLARI_TABLE} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL UNIQUE,
                fatura_logo_yolu TEXT,
                firma_adi TEXT,
                adres TEXT,
                il TEXT,
                ilce TEXT,
                vergi_dairesi TEXT,
                vergi_no TEXT,
                kdv_orani REAL DEFAULT 20,
                fatura_not TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await run(db, `CREATE INDEX IF NOT EXISTS idx_fatura_ayarlari_tenant ON ${FATURA_AYARLARI_TABLE}(tenant_id)`);
        await run(db, `
            CREATE TABLE IF NOT EXISTS ${FATURA_BANKA_TABLE} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL,
                banka_adi TEXT,
                iban TEXT,
                sube TEXT,
                hesap_sahibi TEXT,
                aciklama TEXT,
                sira INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await run(db, `CREATE INDEX IF NOT EXISTS idx_fatura_banka_tenant ON ${FATURA_BANKA_TABLE}(tenant_id)`);
        console.log('✅ Tablolar hazır.\n');

        // 2. Tenant'ları al ve fatura_ayarlari + banka doldur
        const tenants = await query(db, `SELECT id, fatura_logo_yolu, name, address, city, state, tax_office, tax_number FROM tenants`);
        if (!tenants || tenants.length === 0) {
            console.log('⚠️ Hiç tenant bulunamadı. Migration tamamlandı.');
            return;
        }
        const hasIsletmeTable = await query(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='ayarlar_genel_isletme_ayarlari'`);
        let updated = 0, inserted = 0, banksAdded = 0;

        for (const t of tenants) {
            let firma_adi = t.name || '';
            let adres = t.address || '';
            let il = t.state || '';
            let ilce = t.city || '';
            let vergi_dairesi = t.tax_office || '';
            let vergi_no = t.tax_number || '';
            if (hasIsletmeTable && hasIsletmeTable.length > 0) {
                const isletme = await query(db, 'SELECT isletme_adi, adres, il, ilce, vergi_dairesi, vergi_no FROM ayarlar_genel_isletme_ayarlari WHERE tenant_id = ? LIMIT 1', [t.id]);
                if (isletme && isletme.length > 0) {
                    const i = isletme[0];
                    if (i.isletme_adi) firma_adi = i.isletme_adi;
                    if (i.adres != null) adres = i.adres || '';
                    if (i.il != null) il = i.il || '';
                    if (i.ilce != null) ilce = i.ilce || '';
                    if (i.vergi_dairesi != null) vergi_dairesi = i.vergi_dairesi || '';
                    if (i.vergi_no != null) vergi_no = i.vergi_no || '';
                }
            }
            const existing = await query(db, `SELECT id FROM ${FATURA_AYARLARI_TABLE} WHERE tenant_id = ?`, [t.id]);
            if (existing && existing.length > 0) {
                await run(db, `UPDATE ${FATURA_AYARLARI_TABLE} SET firma_adi=?, adres=?, il=?, ilce=?, vergi_dairesi=?, vergi_no=?, updated_at=CURRENT_TIMESTAMP WHERE tenant_id=?`,
                    [firma_adi, adres, il, ilce, vergi_dairesi, vergi_no, t.id]);
                updated++;
            } else {
                await run(db, `INSERT INTO ${FATURA_AYARLARI_TABLE} (tenant_id, fatura_logo_yolu, firma_adi, adres, il, ilce, vergi_dairesi, vergi_no, kdv_orani) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 20)`,
                    [t.id, t.fatura_logo_yolu || null, firma_adi, adres, il, ilce, vergi_dairesi, vergi_no]);
                inserted++;
            }
            const bankCount = await query(db, `SELECT COUNT(*) AS n FROM ${FATURA_BANKA_TABLE} WHERE tenant_id = ?`, [t.id]);
            const n = (bankCount && bankCount[0] && bankCount[0].n) ? parseInt(bankCount[0].n, 10) : 0;
            if (n < 3) {
                const defaults = [
                    { banka_adi: 'Ziraat Bankası', iban: 'TR00 0000 0000 0000 0000 0000 00', sube: 'Merkez', hesap_sahibi: firma_adi || 'İşletme', aciklama: 'Ana hesap', sira: 0 },
                    { banka_adi: 'İş Bankası', iban: 'TR00 0000 0000 0000 0000 0000 01', sube: 'Merkez', hesap_sahibi: firma_adi || 'İşletme', aciklama: '', sira: 1 },
                    { banka_adi: 'Garanti BBVA', iban: 'TR00 0000 0000 0000 0000 0000 02', sube: 'Merkez', hesap_sahibi: firma_adi || 'İşletme', aciklama: '', sira: 2 }
                ];
                for (let i = n; i < 3 && i < defaults.length; i++) {
                    const d = defaults[i];
                    await run(db, `INSERT INTO ${FATURA_BANKA_TABLE} (tenant_id, banka_adi, iban, sube, hesap_sahibi, aciklama, sira) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [t.id, d.banka_adi, d.iban, d.sube, d.hesap_sahibi, d.aciklama, d.sira]);
                    banksAdded++;
                }
            }
        }

        console.log('📋 2. Fatura ayarları ve banka kayıtları işlendi.');
        console.log('   Fatura ayarları: ' + inserted + ' yeni eklendi, ' + updated + ' güncellendi.');
        console.log('   Banka kayıtları: ' + banksAdded + ' yeni eklendi.');
        console.log('\n✅ Fatura migration tamamlandı.');
    } catch (err) {
        console.error('❌ Migration hatası:', err.message);
        process.exit(1);
    } finally {
        db.close();
    }
}

main();
