/**
 * organizasyon_kartlar.organizasyon_kart_tur alanındaki slug değerlerini
 * Türkçe etiketlere çevirir: arac-susleme -> Araç Süsleme, ozel-gun -> Özel Gün vb.
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../floovon_professional.db');

const SLUG_TO_TURKISH = {
  'arac-susleme': 'Araç Süsleme',
  'aracsusleme': 'Araç Süsleme',
  'ozel-siparis': 'Özel Sipariş',
  'ozelsiparis': 'Özel Sipariş',
  'ozel-gun': 'Özel Gün',
  'ozelgun': 'Özel Gün',
  'organizasyon': 'Organizasyon',
  'ciceksepeti': 'Çiçek Sepeti',
};

function toTurkish(value) {
  if (!value || typeof value !== 'string') return value;
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  return SLUG_TO_TURKISH[lower] ?? trimmed;
}

function run() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Veritabanı bağlantı hatası:', err);
        return reject(err);
      }
      console.log('✅ Veritabanına bağlandı:', dbPath);
    });

    db.all(
      'SELECT id, organizasyon_kart_tur FROM organizasyon_kartlar',
      [],
      (err, rows) => {
        if (err) {
          console.error('❌ organizasyon_kartlar okunamadı:', err);
          db.close();
          return reject(err);
        }
        if (!rows.length) {
          console.log('✅ organizasyon_kartlar tablosunda kayıt yok');
          db.close();
          return resolve();
        }

        let updated = 0;
        const runNext = (index) => {
          if (index >= rows.length) {
            console.log('\n✅ Migration tamamlandı. Güncellenen: ' + updated + '/' + rows.length);
            db.close();
            return resolve();
          }
          const row = rows[index];
          const turkce = toTurkish(row.organizasyon_kart_tur);
          const current = (row.organizasyon_kart_tur || '').trim();
          if (turkce === current || !SLUG_TO_TURKISH[current.toLowerCase()]) {
            runNext(index + 1);
            return;
          }
          db.run(
            'UPDATE organizasyon_kartlar SET organizasyon_kart_tur = ? WHERE id = ?',
            [turkce, row.id],
            (updateErr) => {
              if (updateErr) {
                console.error('ID ' + row.id + ' güncellenemedi:', updateErr);
              } else {
                updated++;
                console.log('   ID ' + row.id + ': "' + current + '" -> "' + turkce + '"');
              }
              runNext(index + 1);
            }
          );
        };
        console.log(rows.length + ' kayıt kontrol ediliyor...\n');
        runNext(0);
      }
    );
  });
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration hatası:', err);
      process.exit(1);
    });
}

module.exports = run;
