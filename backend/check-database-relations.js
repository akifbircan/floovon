/**
 * Veritabanı İlişki Kontrol Scripti
 * siparis_kartlar ve organizasyon_kartlar tablolarını karşılaştırır
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'floovon_professional.db');

// Promise wrapper for sqlite3
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

async function checkDatabase() {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error('❌ Veritabanı açılamadı:', err);
            process.exit(1);
        }
    });

    console.log('🔍 Veritabanı İlişki Kontrolü Başlatılıyor...\n');

    try {
        // 1. Genel İstatistikler
        console.log('=== 1. GENEL İSTATİSTİKLER ===');
        const stats = await queryOne(db, `
            SELECT 
                COUNT(*) as toplam_siparis,
                COUNT(CASE WHEN organizasyon_kart_id IS NULL THEN 1 END) as null_organizasyon_kart_id,
                COUNT(CASE WHEN organizasyon_kart_id IS NOT NULL THEN 1 END) as var_organizasyon_kart_id
            FROM siparis_kartlar
            WHERE status = 'aktif' 
                AND COALESCE(CAST(arsivli AS INTEGER), 0) = 0
        `);

console.log(`Toplam Aktif Sipariş: ${stats.toplam_siparis}`);
console.log(`Organizasyon Kartı NULL Olan: ${stats.null_organizasyon_kart_id}`);
console.log(`Organizasyon Kartı VAR Olan: ${stats.var_organizasyon_kart_id}`);
console.log('');

        // 2. Organizasyon Kartları ve Sipariş Sayıları
        console.log('=== 2. ORGANİZASYON KARTLARI VE SİPARİŞ SAYILARI ===');
        const orgKartlari = await query(db, `
            SELECT 
                ok.id as org_kart_id,
                ok.organizasyon_kart_tur as kart_tur,
                ok.organizasyon_kart_etiket as etiket,
                COUNT(sk.id) as siparis_sayisi,
                GROUP_CONCAT(sk.id) as siparis_ids
            FROM organizasyon_kartlar ok
            LEFT JOIN siparis_kartlar sk ON ok.id = sk.organizasyon_kart_id 
                AND sk.status = 'aktif' 
                AND COALESCE(CAST(sk.arsivli AS INTEGER), 0) = 0
            WHERE ok.organizasyon_status = 'aktif' 
                AND ok.is_active = 1 
                AND COALESCE(CAST(ok.arsivli AS INTEGER), 0) = 0
            GROUP BY ok.id
            ORDER BY ok.id
        `);

console.log(`Toplam Organizasyon Kartı: ${orgKartlari.length}`);
orgKartlari.forEach(org => {
    console.log(`  ID: ${org.org_kart_id} | Tür: ${org.kart_tur || 'N/A'} | Etiket: ${org.etiket || 'N/A'} | Sipariş Sayısı: ${org.siparis_sayisi}`);
    if (org.siparis_sayisi === 0) {
        console.log(`    ⚠️  Bu kartta sipariş yok!`);
    }
});
console.log('');

        // 3. Organizasyon Kartı NULL Olan Siparişler
        console.log('=== 3. ORGANİZASYON KARTI NULL OLAN SİPARİŞLER ===');
        const nullOrgSiparisler = await query(db, `
            SELECT 
                sk.id,
                sk.musteri_unvan,
                sk.musteri_isim_soyisim,
                sk.siparis_urun,
                sk.organizasyon_kart_id,
                sk.teslim_tarih,
                sk.created_at
            FROM siparis_kartlar sk
            WHERE sk.organizasyon_kart_id IS NULL
                AND sk.status = 'aktif'
                AND COALESCE(CAST(sk.arsivli AS INTEGER), 0) = 0
            ORDER BY sk.created_at DESC
            LIMIT 20
        `);

console.log(`NULL organizasyon_kart_id olan sipariş sayısı: ${nullOrgSiparisler.length}`);
if (nullOrgSiparisler.length > 0) {
    console.log('İlk 20 sipariş:');
    nullOrgSiparisler.forEach(siparis => {
        console.log(`  ID: ${siparis.id} | Müşteri: ${siparis.musteri_unvan || siparis.musteri_isim_soyisim || 'N/A'} | Ürün: ${siparis.siparis_urun || 'N/A'} | Tarih: ${siparis.teslim_tarih || 'N/A'}`);
    });
}
console.log('');

        // 4. Kart Türlerine Göre Dağılım
        console.log('=== 4. KART TÜRLERİNE GÖRE DAĞILIM ===');
        const kartTurleri = await query(db, `
            SELECT 
                ok.organizasyon_kart_tur as kart_tur,
                COUNT(DISTINCT ok.id) as kart_sayisi,
                COUNT(sk.id) as toplam_siparis_sayisi
            FROM organizasyon_kartlar ok
            LEFT JOIN siparis_kartlar sk ON ok.id = sk.organizasyon_kart_id 
                AND sk.status = 'aktif' 
                AND COALESCE(CAST(sk.arsivli AS INTEGER), 0) = 0
            WHERE ok.organizasyon_status = 'aktif' 
                AND ok.is_active = 1 
                AND COALESCE(CAST(ok.arsivli AS INTEGER), 0) = 0
            GROUP BY ok.organizasyon_kart_tur
            ORDER BY ok.organizasyon_kart_tur
        `);

kartTurleri.forEach(tur => {
    console.log(`  ${tur.kart_tur || 'N/A'}: ${tur.kart_sayisi} kart, ${tur.toplam_siparis_sayisi} sipariş`);
});
console.log('');

        // 5. Organizasyon Kartı Var Ama Siparişi Olmayan Kartlar
        console.log('=== 5. SİPARİŞİ OLMAYAN ORGANİZASYON KARTLARI ===');
        const siparisizKartlar = await query(db, `
            SELECT 
                ok.id,
                ok.organizasyon_kart_tur,
                ok.organizasyon_kart_etiket,
                ok.organizasyon_teslim_tarih
            FROM organizasyon_kartlar ok
            LEFT JOIN siparis_kartlar sk ON ok.id = sk.organizasyon_kart_id 
                AND sk.status = 'aktif' 
                AND COALESCE(CAST(sk.arsivli AS INTEGER), 0) = 0
            WHERE ok.organizasyon_status = 'aktif' 
                AND ok.is_active = 1 
                AND COALESCE(CAST(ok.arsivli AS INTEGER), 0) = 0
                AND sk.id IS NULL
            ORDER BY ok.id
        `);

console.log(`Siparişi olmayan organizasyon kartı sayısı: ${siparisizKartlar.length}`);
if (siparisizKartlar.length > 0) {
    console.log('Siparişi olmayan kartlar:');
    siparisizKartlar.forEach(kart => {
        console.log(`  ID: ${kart.id} | Tür: ${kart.organizasyon_kart_tur || 'N/A'} | Etiket: ${kart.organizasyon_kart_etiket || 'N/A'} | Tarih: ${kart.organizasyon_teslim_tarih || 'N/A'}`);
    });
}
console.log('');

        // 6. Organizasyon Kartına Bağlı Olmayan Siparişlerin Kart Türü Analizi
        console.log('=== 6. NULL SİPARİŞLERİN DETAYLI ANALİZİ ===');
        const nullSiparisDetay = await query(db, `
            SELECT 
                sk.id,
                sk.musteri_unvan,
                sk.musteri_isim_soyisim,
                sk.siparis_urun,
                sk.teslim_tarih,
                sk.created_at,
                sk.arac_markamodel,
                sk.arac_randevu_saat
            FROM siparis_kartlar sk
            WHERE sk.organizasyon_kart_id IS NULL
                AND sk.status = 'aktif'
                AND COALESCE(CAST(sk.arsivli AS INTEGER), 0) = 0
            ORDER BY sk.created_at DESC
        `);

        console.log(`Toplam NULL sipariş: ${nullSiparisDetay.length}`);
        if (nullSiparisDetay.length > 0) {
            // Araç süsleme, özel gün, özel sipariş olup olmadığını kontrol et
            const aracSusleme = nullSiparisDetay.filter(s => s.arac_markamodel || s.arac_randevu_saat);
            console.log(`  Araç bilgisi olan (Araç Süsleme olabilir): ${aracSusleme.length}`);
            
            nullSiparisDetay.slice(0, 10).forEach(siparis => {
                const tip = siparis.arac_markamodel || siparis.arac_randevu_saat ? 'Araç Süsleme?' : 'Normal';
                console.log(`  ID: ${siparis.id} | Müşteri: ${siparis.musteri_unvan || siparis.musteri_isim_soyisim || 'N/A'} | Tip: ${tip} | Tarih: ${siparis.teslim_tarih || 'N/A'}`);
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

checkDatabase();

