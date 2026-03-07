/**
 * Arşivlenmiş siparişlerin verilerini kontrol et
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

async function checkArchivedSiparis() {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error('❌ Veritabanı açılamadı:', err);
            process.exit(1);
        }
    });

    console.log('🔍 Arşivlenmiş Siparişlerin Veri Kontrolü\n');

    try {
        // Arşivlenmiş siparişler
        const arsivlenmisSiparisler = await query(db, `
            SELECT 
                sk.id,
                sk.organizasyon_kart_id,
                sk.musteri_unvan,
                sk.musteri_isim_soyisim,
                sk.siparis_urun,
                sk.urun_yazisi,
                sk.teslim_tarih,
                sk.siparis_tutari,
                sk.arsivleme_tarih,
                sk.arsivleme_sebebi,
                sk.created_at,
                sk.updated_at
            FROM siparis_kartlar sk
            WHERE COALESCE(CAST(sk.arsivli AS INTEGER), 0) = 1
            ORDER BY sk.arsivleme_tarih DESC
            LIMIT 20
        `);

        console.log(`Toplam arşivlenmiş sipariş (ilk 20): ${arsivlenmisSiparisler.length}\n`);
        
        arsivlenmisSiparisler.forEach((siparis, index) => {
            console.log(`\n--- Arşivlenmiş Sipariş ${index + 1} (ID: ${siparis.id}) ---`);
            console.log(`Organizasyon Kart ID: ${siparis.organizasyon_kart_id || 'NULL'}`);
            console.log(`Müşteri Unvan: ${siparis.musteri_unvan || 'NULL'}`);
            console.log(`Müşteri İsim: ${siparis.musteri_isim_soyisim || 'NULL'}`);
            console.log(`Sipariş Ürün: ${siparis.siparis_urun || 'NULL'}`);
            console.log(`Ürün Yazısı: ${siparis.urun_yazisi ? (siparis.urun_yazisi.substring(0, 50) + '...') : 'NULL'}`);
            console.log(`Teslim Tarih: ${siparis.teslim_tarih || 'NULL'}`);
            console.log(`Sipariş Tutarı: ${siparis.siparis_tutari || 'NULL'}`);
            console.log(`Arşivleme Tarih: ${siparis.arsivleme_tarih || 'NULL'}`);
            console.log(`Arşivleme Sebebi: ${siparis.arsivleme_sebebi || 'NULL'}`);
            console.log(`Oluşturulma: ${siparis.created_at || 'NULL'}`);
            console.log(`Güncellenme: ${siparis.updated_at || 'NULL'}`);
        });

        // Arşivlenmiş ama verileri NULL olan siparişler
        console.log('\n\n=== ARŞİVLENMİŞ AMA VERİLERİ NULL OLAN SİPARİŞLER ===');
        const nullVeriliArsivlenmis = await query(db, `
            SELECT 
                sk.id,
                sk.organizasyon_kart_id,
                sk.arsivleme_tarih,
                sk.arsivleme_sebebi,
                sk.created_at,
                sk.updated_at
            FROM siparis_kartlar sk
            WHERE COALESCE(CAST(sk.arsivli AS INTEGER), 0) = 1
                AND sk.musteri_unvan IS NULL
                AND sk.musteri_isim_soyisim IS NULL
                AND sk.siparis_urun IS NULL
            ORDER BY sk.arsivleme_tarih DESC
        `);

        console.log(`Arşivlenmiş ama verileri NULL olan sipariş sayısı: ${nullVeriliArsivlenmis.length}`);
        if (nullVeriliArsivlenmis.length > 0) {
            console.log('\nBu siparişler:');
            nullVeriliArsivlenmis.forEach(siparis => {
                console.log(`  ID: ${siparis.id} | Org Kart ID: ${siparis.organizasyon_kart_id || 'NULL'} | Arşivleme: ${siparis.arsivleme_tarih || 'NULL'} | Sebep: ${siparis.arsivleme_sebebi || 'NULL'}`);
            });
        }

        // Aktif ama verileri NULL olan siparişler (daha önce arşivlenmiş olabilir)
        console.log('\n\n=== AKTİF AMA VERİLERİ NULL OLAN SİPARİŞLER (ARŞİV GEÇMİŞİ VAR MI?) ===');
        const aktifNullVerili = await query(db, `
            SELECT 
                sk.id,
                sk.organizasyon_kart_id,
                sk.arsivleme_tarih,
                sk.arsivleme_sebebi,
                sk.created_at,
                sk.updated_at
            FROM siparis_kartlar sk
            WHERE sk.status = 'aktif'
                AND COALESCE(CAST(sk.arsivli AS INTEGER), 0) = 0
                AND sk.musteri_unvan IS NULL
                AND sk.musteri_isim_soyisim IS NULL
                AND sk.siparis_urun IS NULL
            ORDER BY sk.updated_at DESC
        `);

        console.log(`Aktif ama verileri NULL olan sipariş sayısı: ${aktifNullVerili.length}`);
        if (aktifNullVerili.length > 0) {
            console.log('\nBu siparişler (arşiv geçmişi var mı kontrol ediliyor):');
            aktifNullVerili.forEach(siparis => {
                const arsivGecmisi = siparis.arsivleme_tarih ? 'VAR (Arşivlenmiş ve geri yüklenmiş olabilir)' : 'YOK';
                console.log(`  ID: ${siparis.id} | Org Kart ID: ${siparis.organizasyon_kart_id || 'NULL'} | Arşiv Geçmişi: ${arsivGecmisi} | Güncellenme: ${siparis.updated_at || 'NULL'}`);
            });
        }

        db.close((err) => {
            if (err) {
                console.error('❌ Veritabanı kapatılırken hata:', err);
            } else {
                console.log('\n✅ Kontrol tamamlandı!');
            }
        });
    } catch (error) {
        console.error('❌ Hata:', error);
        db.close();
        process.exit(1);
    }
}

checkArchivedSiparis();

