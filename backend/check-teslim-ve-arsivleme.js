/**
 * Teslim Edildi ve Arşivleme İşlemlerinde Veri Silme Kontrolü
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

function queryOne(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

async function checkTeslimVeArsivleme() {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error('❌ Veritabanı açılamadı:', err);
            process.exit(1);
        }
    });

    console.log('🔍 Teslim Edildi ve Arşivleme İşlemlerinde Veri Silme Kontrolü\n');

    try {
        // 1. Status = 'teslim' olan siparişlerin verilerini kontrol et
        console.log('=== 1. STATUS = "TESLİM" OLAN SİPARİŞLER ===');
        const teslimSiparisler = await query(db, `
            SELECT 
                sk.id,
                sk.status,
                sk.musteri_unvan,
                sk.musteri_isim_soyisim,
                sk.siparis_urun,
                sk.urun_yazisi,
                sk.siparis_tutari,
                sk.teslim_tarih,
                sk.updated_at,
                sk.arsivleme_tarih,
                sk.arsivleme_sebebi
            FROM siparis_kartlar sk
            WHERE sk.status = 'teslim'
                AND sk.status = 'aktif'
            ORDER BY sk.updated_at DESC
            LIMIT 10
        `);

        console.log(`Status = 'teslim' olan sipariş sayısı: ${teslimSiparisler.length}`);
        if (teslimSiparisler.length > 0) {
            teslimSiparisler.forEach(siparis => {
                const hasData = siparis.musteri_unvan || siparis.musteri_isim_soyisim || siparis.siparis_urun || siparis.urun_yazisi;
                console.log(`  ID: ${siparis.id} | Veri Var: ${hasData ? 'EVET' : 'HAYIR'} | Müşteri: ${siparis.musteri_unvan || siparis.musteri_isim_soyisim || 'NULL'} | Ürün: ${siparis.siparis_urun || siparis.urun_yazisi || 'NULL'} | Güncellenme: ${siparis.updated_at || 'NULL'}`);
            });
        }

        // 2. Arşivlenmiş siparişlerin verilerini kontrol et
        console.log('\n=== 2. ARŞİVLENMİŞ SİPARİŞLER ===');
        const arsivlenmisSiparisler = await query(db, `
            SELECT 
                sk.id,
                sk.status,
                sk.musteri_unvan,
                sk.musteri_isim_soyisim,
                sk.siparis_urun,
                sk.urun_yazisi,
                sk.siparis_tutari,
                sk.arsivleme_tarih,
                sk.arsivleme_sebebi,
                sk.updated_at
            FROM siparis_kartlar sk
            WHERE COALESCE(CAST(sk.arsivli AS INTEGER), 0) = 1
            ORDER BY sk.arsivleme_tarih DESC
            LIMIT 10
        `);

        console.log(`Arşivlenmiş sipariş sayısı: ${arsivlenmisSiparisler.length}`);
        if (arsivlenmisSiparisler.length > 0) {
            arsivlenmisSiparisler.forEach(siparis => {
                const hasData = siparis.musteri_unvan || siparis.musteri_isim_soyisim || siparis.siparis_urun || siparis.urun_yazisi;
                console.log(`  ID: ${siparis.id} | Veri Var: ${hasData ? 'EVET' : 'HAYIR'} | Müşteri: ${siparis.musteri_unvan || siparis.musteri_isim_soyisim || 'NULL'} | Ürün: ${siparis.siparis_urun || siparis.urun_yazisi || 'NULL'} | Arşivleme: ${siparis.arsivleme_tarih || 'NULL'} | Sebep: ${siparis.arsivleme_sebebi || 'NULL'}`);
            });
        }

        // 3. Arşivleme sebebi "Teslim Edildi" olan siparişlerin verilerini kontrol et
        console.log('\n=== 3. ARŞİVLEME SEBEBİ "TESLİM EDİLDİ" OLAN SİPARİŞLER ===');
        const teslimEdildiArsivlenmis = await query(db, `
            SELECT 
                sk.id,
                sk.musteri_unvan,
                sk.musteri_isim_soyisim,
                sk.siparis_urun,
                sk.urun_yazisi,
                sk.siparis_tutari,
                sk.arsivleme_tarih,
                sk.arsivleme_sebebi,
                sk.updated_at
            FROM siparis_kartlar sk
            WHERE COALESCE(CAST(sk.arsivli AS INTEGER), 0) = 1
                AND (sk.arsivleme_sebebi LIKE '%teslim%' OR sk.arsivleme_sebebi LIKE '%Teslim%')
            ORDER BY sk.arsivleme_tarih DESC
            LIMIT 10
        `);

        console.log(`Arşivleme sebebi "Teslim Edildi" olan sipariş sayısı: ${teslimEdildiArsivlenmis.length}`);
        if (teslimEdildiArsivlenmis.length > 0) {
            teslimEdildiArsivlenmis.forEach(siparis => {
                const hasData = siparis.musteri_unvan || siparis.musteri_isim_soyisim || siparis.siparis_urun || siparis.urun_yazisi;
                console.log(`  ID: ${siparis.id} | Veri Var: ${hasData ? 'EVET' : 'HAYIR'} | Müşteri: ${siparis.musteri_unvan || siparis.musteri_isim_soyisim || 'NULL'} | Ürün: ${siparis.siparis_urun || siparis.urun_yazisi || 'NULL'} | Arşivleme: ${siparis.arsivleme_tarih || 'NULL'}`);
            });
        }

        // 4. Verileri NULL olan ama arşivlenmiş siparişler
        console.log('\n=== 4. VERİLERİ NULL OLAN ARŞİVLENMİŞ SİPARİŞLER ===');
        const nullVeriliArsivlenmis = await query(db, `
            SELECT 
                sk.id,
                sk.arsivleme_tarih,
                sk.arsivleme_sebebi,
                sk.updated_at
            FROM siparis_kartlar sk
            WHERE COALESCE(CAST(sk.arsivli AS INTEGER), 0) = 1
                AND sk.musteri_unvan IS NULL
                AND sk.musteri_isim_soyisim IS NULL
                AND sk.siparis_urun IS NULL
                AND sk.urun_yazisi IS NULL
            ORDER BY sk.arsivleme_tarih DESC
        `);

        console.log(`Verileri NULL olan arşivlenmiş sipariş sayısı: ${nullVeriliArsivlenmis.length}`);
        if (nullVeriliArsivlenmis.length > 0) {
            console.log('Bu siparişler:');
            nullVeriliArsivlenmis.forEach(siparis => {
                console.log(`  ID: ${siparis.id} | Arşivleme: ${siparis.arsivleme_tarih || 'NULL'} | Sebep: ${siparis.arsivleme_sebebi || 'NULL'} | Güncellenme: ${siparis.updated_at || 'NULL'}`);
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

checkTeslimVeArsivleme();

