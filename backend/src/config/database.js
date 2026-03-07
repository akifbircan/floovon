/**
 * Database Manager Module
 * Veritabanı bağlantısını yönetir ve singleton pattern kullanır
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Veritabanı dosya yolu - floovon_professional.db kullanılıyor
const dbPath = path.resolve(__dirname, '../../floovon_professional.db');

class DatabaseManager {
    constructor() {
        this.db = null;
        this.isReady = false;
        this.init();
    }

    init() {
        try {
            // Veritabanı dosyasının var olup olmadığını kontrol et
            if (!fs.existsSync(dbPath)) {
                console.warn('⚠️ Veritabanı dosyası bulunamadı, oluşturulacak:', dbPath);
            }

            // SQLite veritabanı bağlantısı
            this.db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
                if (err) {
                    console.error('❌ Veritabanı bağlantı hatası:', err.message);
                    this.isReady = false;
                    return;
                }
                
                console.log('✅ DatabaseManager: SQLite veritabanına bağlandı:', dbPath);
                this.isReady = true;

                // PRAGMA ayarları
                this.db.serialize(() => {
                    this.db.run('PRAGMA journal_mode = WAL;');
                    this.db.run('PRAGMA synchronous = NORMAL;');
                    this.db.run('PRAGMA cache_size = 10000;');
                    this.db.run('PRAGMA foreign_keys = ON;');
                    this.db.run('PRAGMA temp_store = MEMORY;');
                });
            });
        } catch (error) {
            console.error('❌ DatabaseManager init hatası:', error);
            this.isReady = false;
        }
    }

    // Promise wrapper for query
    query(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                return reject(new Error('Database bağlantısı yok'));
            }
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Promise wrapper for run (INSERT, UPDATE, DELETE)
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                return reject(new Error('Database bağlantısı yok'));
            }
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    // Promise wrapper for get (single row)
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                return reject(new Error('Database bağlantısı yok'));
            }
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Test connection
    async testConnection() {
        if (!this.db || !this.isReady) {
            return false;
        }
        try {
            await this.query('SELECT 1');
            return true;
        } catch (error) {
            console.error('❌ Database connection test failed:', error);
            return false;
        }
    }

    // Close connection
    close() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                return resolve();
            }
            this.db.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('✅ Database connection closed');
                    resolve();
                }
            });
        });
    }
}

// Singleton instance
let instance = null;

// Get singleton instance
function getInstance() {
    if (!instance) {
        instance = new DatabaseManager();
    }
    return instance;
}

// Export
const managerInstance = getInstance();

module.exports = {
    getInstance,
    manager: managerInstance,
    testConnection: async () => {
        return await managerInstance.testConnection();
    }
};

