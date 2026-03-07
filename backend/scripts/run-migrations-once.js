const path = require('path');
const migrations = require('../src/utils/migrations');
const dbModule = require('../src/config/database');

async function waitForDbReady(maxWaitMs = 5000) {
    const start = Date.now();
    // simple ping loop using testConnection
    while (Date.now() - start < maxWaitMs) {
        try {
            const ok = await dbModule.testConnection();
            if (ok) return true;
        } catch (_) {}
        await new Promise(r => setTimeout(r, 100));
    }
    return false;
}

(async () => {
    console.log('🚀 Migrations runner başlıyor...');
    const ready = await waitForDbReady();
    if (!ready) {
        console.error('❌ Veritabanı hazır değil (timeout)');
        process.exit(1);
    }
    try {
        await migrations.runMigrations(dbModule.manager.db);
        console.log('✅ Migrations tamamlandı');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration hatası:', err);
        process.exit(1);
    }
})();



