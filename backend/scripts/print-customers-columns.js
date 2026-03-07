const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'floovon_professional.db');
const db = new sqlite3.Database(dbPath);

db.all("PRAGMA table_info(musteriler)", (err, rows) => {
    if (err) {
        console.error('❌ Hata:', err.message);
        process.exit(1);
    }
    console.log(rows.map(r => r.name).join(','));
    process.exit(0);
});



