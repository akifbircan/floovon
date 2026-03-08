#!/usr/bin/env node
/**
 * page_permissions (veya tenants_sayfa_izinleri) tablosundan profil-ayarlari kayıtlarını kaldırır
 * Profil ayarları sayfası her zaman erişilebilir olmalı, izin kontrolüne tabi değil
 * Not: Migration'da tablo adı page_permissions; uygulama runtime'da tenants_sayfa_izinleri kullanabilir.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Veritabanı: sadece floovon_professional.db kullanılıyor
const DB_PATH = path.join(__dirname, '..', 'floovon_professional.db');

async function removeProfilAyarlariFromPagePermissions() {
    return new Promise((resolve, reject) => {
        console.log('🔄 page_permissions tablosundan profil-ayarlari kayıtları kaldırılıyor...');
        
        if (!fs.existsSync(DB_PATH)) {
            console.log('⚠️ Veritabanı dosyası bulunamadı:', DB_PATH);
            resolve();
            return;
        }
        const dbPath = DB_PATH;

        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Veritabanı bağlantı hatası:', err);
                reject(err);
                return;
            }
        });

        // Migration'da tablo adı page_permissions (tenants_sayfa_izinleri uygulama tarafında kullanılıyor)
        const tableName = 'page_permissions';

        db.serialize(() => {
            // Önce kaç kayıt silineceğini göster
            db.get(`SELECT COUNT(*) as count FROM ${tableName} WHERE page_id = 'profil-ayarlari'`, (err, row) => {
                if (err) {
                    if (err.message && err.message.includes('no such table')) {
                        console.warn('⚠️ Sayfa izinleri tablosu henüz yok, atlanıyor');
                        db.close();
                        resolve();
                        return;
                    }
                    console.error('❌ Kayıt sayısı sorgusu hatası:', err);
                    db.close();
                    reject(err);
                    return;
                }
                
                const count = row ? row.count : 0;
                console.log(`📊 Silinecek kayıt sayısı: ${count}`);
                
                if (count === 0) {
                    console.log('✅ profil-ayarlari kaydı bulunamadı, işlem gerekmiyor');
                    db.close();
                    resolve();
                    return;
                }
                
                // profil-ayarlari kayıtlarını sil
                db.run(`DELETE FROM ${tableName} WHERE page_id = 'profil-ayarlari'`, (err) => {
                    if (err) {
                        console.error('❌ Kayıt silme hatası:', err);
                        db.close();
                        reject(err);
                        return;
                    }
                    
                    console.log(`✅ ${count} adet profil-ayarlari kaydı başarıyla silindi`);
                    db.close();
                    resolve();
                });
            });
        });
    });
}

// Script doğrudan çalıştırılıyorsa
if (require.main === module) {
    removeProfilAyarlariFromPagePermissions()
        .then(() => {
            console.log('✅ Migration tamamlandı!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Migration hatası:', error);
            process.exit(1);
        });
}

module.exports = { removeProfilAyarlariFromPagePermissions };

