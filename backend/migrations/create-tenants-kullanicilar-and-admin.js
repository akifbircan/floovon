#!/usr/bin/env node
/**
 * tenants_kullanicilar ve admin_kullanicilar tablolarını oluşturur (yoksa).
 * Uygulama eskiden kullanicilar/users ve admin_users tablolarını rename ediyordu;
 * yeni/boş DB'de bu tablolar olmadığı için doğrudan bu isimlerle oluşturuyoruz.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const dbPath = path.resolve(__dirname, '../floovon_professional.db');

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

async function createTenantsKullanicilarAndAdmin() {
    const db = new sqlite3.Database(dbPath);

    try {
        // 1. tenants_kullanicilar (yoksa oluştur; varsa kullanicilar/users'dan rename edilmiş olabilir)
        const hasTenantsKullanicilar = await get(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='tenants_kullanicilar'");
        if (!hasTenantsKullanicilar) {
            await run(db, `
                CREATE TABLE IF NOT EXISTS tenants_kullanicilar (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tenant_id INTEGER,
                    name TEXT,
                    surname TEXT,
                    email TEXT NOT NULL,
                    username TEXT,
                    phone TEXT,
                    password TEXT,
                    role TEXT DEFAULT 'Sistem Yöneticisi',
                    is_active INTEGER DEFAULT 1,
                    is_admin INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'aktif',
                    profile_image TEXT,
                    last_login DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
                )
            `);
            console.log('✅ tenants_kullanicilar tablosu oluşturuldu');
            await run(db, 'CREATE INDEX IF NOT EXISTS idx_tenants_kullanicilar_tenant_id ON tenants_kullanicilar(tenant_id)');
            await run(db, 'CREATE INDEX IF NOT EXISTS idx_tenants_kullanicilar_email ON tenants_kullanicilar(email)');
            await run(db, 'CREATE INDEX IF NOT EXISTS idx_tenants_kullanicilar_tenant_active ON tenants_kullanicilar(tenant_id, is_active)');
        } else {
            console.log('ℹ️ tenants_kullanicilar tablosu zaten mevcut');
        }

        // 2. admin_kullanicilar (yoksa oluştur)
        const hasAdminKullanicilar = await get(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='admin_kullanicilar'");
        if (!hasAdminKullanicilar) {
            await run(db, `
                CREATE TABLE IF NOT EXISTS admin_kullanicilar (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    kullaniciadi TEXT NOT NULL UNIQUE,
                    email TEXT,
                    password TEXT NOT NULL,
                    role TEXT DEFAULT 'admin',
                    profil_resmi TEXT,
                    is_active INTEGER DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ admin_kullanicilar tablosu oluşturuldu');
            await run(db, 'CREATE INDEX IF NOT EXISTS idx_admin_kullanicilar_kullaniciadi ON admin_kullanicilar(kullaniciadi)');
            // İlk kurulumda varsayılan admin (Console girişi için) – şifreyi mutlaka değiştirin
            const defaultPass = crypto.createHash('sha256').update('admin123').digest('hex');
            await run(db, `INSERT INTO admin_kullanicilar (name, kullaniciadi, email, password, role, is_active) VALUES (?, ?, ?, ?, ?, 1)`, ['Admin', 'admin', 'admin@floovon.com', defaultPass, 'admin']);
            console.log('⚠️ Varsayılan admin eklendi: kullaniciadi=admin, şifre=admin123 — İlk girişten sonra şifreyi değiştirin!');
        } else {
            console.log('ℹ️ admin_kullanicilar tablosu zaten mevcut');
        }
    } finally {
        db.close();
    }
}

if (require.main === module) {
    createTenantsKullanicilarAndAdmin()
        .then(() => {
            console.log('✅ Migration tamamlandı');
            process.exit(0);
        })
        .catch((err) => {
            console.error('❌ Migration hatası:', err);
            process.exit(1);
        });
}

module.exports = { createTenantsKullanicilarAndAdmin };
