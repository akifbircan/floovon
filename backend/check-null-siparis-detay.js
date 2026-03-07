/**
 * NULL organizasyon_kart_id olan siparişlerin detaylı analizi
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'floovon_professional.db');

function query(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function checkNullSiparis() {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error('❌ Veritabanı açılamadı:', err);
            process.exit(1);
        }
    });

    console.log('🔍 NULL Siparişlerin Detaylı Analizi\n');

    try {
        // Tüm kolonları göster
        const nullSiparisler = await query(db, `
            SELECT 
                sk.*
            FROM siparis_kartlar sk
            WHERE sk.organizasyon_kart_id IS NULL
                AND sk.status = 'aktif'
                AND COALESCE(CAST(sk.arsivli AS INTEGER), 0) = 0
            ORDER BY sk.id
        `);

        console.log(`Toplam NULL sipariş: ${nullSiparisler.length}\n`);
        
        nullSiparisler.forEach((siparis, index) => {
            console.log(`\n--- Sipariş ${index + 1} (ID: ${siparis.id}) ---`);
            console.log(`Müşteri Unvan: ${siparis.musteri_unvan || 'NULL'}`);
            console.log(`Müşteri İsim: ${siparis.musteri_isim_soyisim || 'NULL'}`);
            console.log(`Sipariş Ürün: ${siparis.siparis_urun || 'NULL'}`);
            console.log(`Ürün Yazısı: ${siparis.urun_yazisi || 'NULL'}`);
            console.log(`Teslim Tarih: ${siparis.teslim_tarih || 'NULL'}`);
            console.log(`Teslim Saat: ${siparis.teslim_saat || 'NULL'}`);
            console.log(`Araç Marka/Model: ${siparis.arac_markamodel || 'NULL'}`);
            console.log(`Araç Renk: ${siparis.arac_renk || 'NULL'}`);
            console.log(`Araç Plaka: ${siparis.arac_plaka || 'NULL'}`);
            console.log(`Araç Randevu Saat: ${siparis.arac_randevu_saat || 'NULL'}`);
            console.log(`Sipariş Tutarı: ${siparis.siparis_tutari || 'NULL'}`);
            console.log(`Durum: ${siparis.status || 'NULL'}`);
            console.log(`Arşivli: ${siparis.arsivli || 'NULL'}`);
            console.log(`Oluşturulma: ${siparis.created_at || 'NULL'}`);
            console.log(`Güncellenme: ${siparis.updated_at || 'NULL'}`);
        });

        // Organizasyon kartları ile eşleştirme önerisi
        console.log('\n\n=== EŞLEŞTİRME ÖNERİLERİ ===');
        
        // Teslim tarihine göre eşleştirme
        const eslesmeOnerileri = await query(db, `
            SELECT 
                sk.id as siparis_id,
                sk.teslim_tarih as siparis_tarih,
                ok.id as org_kart_id,
                ok.organizasyon_kart_tur,
                ok.organizasyon_teslim_tarih as org_tarih,
                ABS(JULIANDAY(sk.teslim_tarih) - JULIANDAY(ok.organizasyon_teslim_tarih)) as tarih_farki
            FROM siparis_kartlar sk
            CROSS JOIN organizasyon_kartlar ok
            WHERE sk.organizasyon_kart_id IS NULL
                AND sk.status = 'aktif'
                AND COALESCE(CAST(sk.arsivli AS INTEGER), 0) = 0
                AND ok.organizasyon_status = 'aktif'
                AND ok.is_active = 1
                AND COALESCE(CAST(ok.arsivli AS INTEGER), 0) = 0
                AND sk.teslim_tarih IS NOT NULL
                AND ok.organizasyon_teslim_tarih IS NOT NULL
                AND ABS(JULIANDAY(sk.teslim_tarih) - JULIANDAY(ok.organizasyon_teslim_tarih)) < 1
            ORDER BY sk.id, tarih_farki
        `);

        if (eslesmeOnerileri.length > 0) {
            console.log(`\nTarih bazlı eşleştirme önerileri: ${eslesmeOnerileri.length}`);
            eslesmeOnerileri.forEach(oner => {
                console.log(`  Sipariş ID ${oner.siparis_id} → Organizasyon Kart ID ${oner.org_kart_id} (${oner.organizasyon_kart_tur}) | Tarih Farkı: ${oner.tarih_farki.toFixed(2)} gün`);
            });
        } else {
            console.log('\nTarih bazlı eşleştirme önerisi bulunamadı.');
        }

        db.close((err) => {
            if (err) {
                console.error('❌ Veritabanı kapatılırken hata:', err);
            } else {
                console.log('\n✅ Analiz tamamlandı!');
            }
        });
    } catch (error) {
        console.error('❌ Hata:', error);
        db.close();
        process.exit(1);
    }
}

checkNullSiparis();

