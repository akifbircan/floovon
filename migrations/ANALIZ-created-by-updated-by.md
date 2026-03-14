# created_by / updated_by Detaylı Analiz Raporu

**Tarih:** 2025-03-08  
**Veritabanı:** `backend/floovon_professional.db`  
**Analiz scripti:** `migrations/analyze-created-by-updated-by.js`

---

## 1. Özet

| Kategori | Sayı | Açıklama |
|----------|------|----------|
| **Toplam tablo** | 47 | Veritabanındaki tüm tablolar |
| **Hem created_by hem updated_by olan** | 26 | Kolonlar mevcut |
| **Sadece biri olan** | 0 | Tüm tablolarda ya ikisi de var ya hiç yok |
| **Hiç olmayan** | 21 | Bu tablolarda kolon yok |

---

## 2. Kolonu Olan 26 Tabloda Doldurulma Durumu

Migration (akifbircan temizliği) sonrası gerçek veri:

| Tablo | Satır | created_by dolu | updated_by dolu | Durum |
|-------|-------|-----------------|-----------------|--------|
| **ayarlar_gonderim_iletisim_kisileri** | 3 | 3 (%100) | 3 (%100) | ✅ Kod yazıyor |
| **ayarlar_gonderim_rapor_ayarlari** | 1 | 1 (%100) | 1 (%100) | ✅ Kod yazıyor |
| **siparisler** | 17 | 1 (%5.9) | 3 (%17.6) | ✅ Kod yazıyor (eski kayıtlar boş) |
| **teknik_destek_kayitlari** | 45 | 12 (%26.7) | 12 (%26.7) | ✅ Kod yazıyor (eski kayıtlar boş) |
| **urunler** | 19 | 5 (%26.3) | 5 (%26.3) | ⚠️ Kod **yazmıyor** (eski manuel veri) |
| **araclar** | 6 | 0 | 0 | ❌ Kod yazmıyor |
| **ayarlar_ciceksepeti_ayarlari** | 1 | 0 | 0 | ❌ Kod yazmıyor |
| **ayarlar_genel_isletme_ayarlari** | 3 | 0 | 0 | ❌ Kod yazmıyor |
| **ayarlar_genel_konum_ayarlari** | 1 | 0 | 0 | ❌ Kod yazmıyor |
| **ayarlar_genel_teslimat_konumlari** | 4 | 0 | 0 | ❌ Kod yazmıyor |
| **ayarlar_genel_yazdirma_ayarlari** | 6 | 0 | 0 | ❌ Kod yazmıyor |
| **bildirimler** | 34 | 0 | 0 | ❌ Kod yazmıyor (farklı kolon: kullanici_adi) |
| **kampanyalar** | 6 | 0 | 0 | ❌ Kod yazmıyor |
| **musteri_faturalar** | 35 | 0 | 0 | ❌ Kod yazmıyor |
| **musteri_tahsilatlar** | 5 | 0 | 0 | ❌ Kod yazmıyor |
| **musteriler** | 29 | 0 | 0 | ❌ Kod yazmıyor |
| **organizasyon_alt_turleri** | 18 | 0 | 0 | ❌ Kod yazmıyor |
| **organizasyon_etiketleri** | 21 | 0 | 0 | ❌ Kod yazmıyor |
| **organizasyon_kartlar** | 17 | 0 | 0 | ✅ Kod yazıyor (migration sonrası temiz) |
| **organizasyon_siparisler_ciceksepeti** | 2 | 0 | 0 | ✅ Kod yazıyor (yeni kayıtlar dolu olacak) |
| **organizasyon_turleri** | 4 | 0 | 0 | ❌ Kod yazmıyor |
| **partner_cari_hareketler** | 12 | 0 | 0 | ❌ Kod yazmıyor |
| **partner_firmalar** | 4 | 0 | 0 | ❌ Kod yazmıyor |
| **sicak_satislar** | 11 | 0 | 0 | ❌ Kod yazmıyor |
| **tenants** | 4 | 0 | 0 | ❌ Kod yazmıyor (kayıt konsol/admin) |
| **urunler_kategoriler** | 8 | 0 | 0 | ❌ Kod yazmıyor |

---

## 3. Kod Tarafında created_by / updated_by Yazılan Yerler

Backend’de **getCurrentUsername(req)** ile oturum kullanıcısı alınıp yazılan tablolar:

| Tablo | INSERT | UPDATE | Dosya / endpoint |
|-------|--------|--------|-------------------|
| **siparisler** | ✅ created_by, updated_by | ✅ updated_by | simple-server.js (POST/PUT sipariş) |
| **organizasyon_kartlar** | ✅ created_by, updated_by | ❌ (sadece bazı alanlar) | simple-server.js, siparis-kartlar.js |
| **ayarlar_gonderim_rapor_ayarlari** | ✅ | ✅ updated_by | simple-server.js |
| **ayarlar_gonderim_iletisim_kisileri** | ✅ | ✅ updated_by | simple-server.js |
| **teknik_destek_kayitlari** | ✅ created_by, updated_by | - | simple-server.js |
| **organizasyon_siparisler_ciceksepeti** | ✅ (test-order, accept-order) | ❌ | simple-server.js |

Diğer **26 tabloda kolon var ama kod hiç yazmıyor**: musteriler, musteri_faturalar, musteri_tahsilatlar, kampanyalar, urunler, urunler_kategoriler, araclar, partner_firmalar, sicak_satislar, bildirimler, organizasyon_etiketleri, organizasyon_turleri, organizasyon_alt_turleri, ayarlar_genel_* (isletme, konum, yazdirma, teslimat_konumlari, ciceksepeti), tenants.

---

## 4. Kolonu Olmayan 21 Tablo – Olması Gerekir mi?

| Tablo | Açıklama | Öneri |
|-------|----------|--------|
| **admin_bildirimler** | `created_by_user` (INTEGER) kullanıyor, isim farklı | created_by/updated_by eklemeye gerek yok |
| **admin_kullanicilar** | Admin panel kullanıcıları | İsteğe bağlı (audit için eklenebilir) |
| **araclar_gps_konum_takip** | GPS log | İsteğe bağlı |
| **araclar_takip** | Araç takip kayıtları | İsteğe bağlı (kim ekledi bilgisi faydalı olabilir) |
| **araclar_takip_teslimatlar** | Teslimat rotaları | İsteğe bağlı |
| **ayarlar_gonderim_mesaj_sablonlari** | Mesaj şablonları | Tenant iş verisi; eklenebilir |
| **musteri_raporlari** | Rapor kayıtları | İsteğe bağlı |
| **partner_cari_hareketler_yeni** | Boş / yeni yapı | İleride kullanılırsa eklenebilir |
| **partner_siparisler** | Boş | İleride kullanılırsa eklenebilir |
| **proje_kullanim_hata_logs** | Hata logları | user_id var; created_by ayrıca gerekmez |
| **refresh_tokens** | Auth token | Gerekmez |
| **sifre_sifirlama_tokenlari** | Şifre sıfırlama | Gerekmez |
| **tenants_abonelik_planlari** | Plan tanımları | Sistem tablosu; isteğe bağlı |
| **tenants_abonelikler** | Abonelikler | Sistem; isteğe bağlı |
| **tenants_faturalar** | Faturalar | Sistem; isteğe bağlı |
| **tenants_kullanicilar** | Tenant kullanıcıları | Kim ekledi/düzenledi için eklenebilir |
| **tenants_kullanimlar** | Kullanım istatistikleri | Gerekmez |
| **tenants_logs** | Aktivite logları | Zaten “kim yaptı” bilgisi var |
| **tenants_odeme_yontemleri** | Ödeme yöntemleri | İsteğe bağlı |
| **tenants_sayfa_izinleri** | Sayfa izinleri | İsteğe bağlı |
| **whatsapp_baglantilar_logs** | WhatsApp log | İsteğe bağlı |

---

## 5. Sonuç ve Öneriler

### 5.1 Veri yazılıyor mu?

- **Evet, tutarlı yazılan tablolar:**  
  `siparisler`, `organizasyon_kartlar`, `ayarlar_gonderim_rapor_ayarlari`, `ayarlar_gonderim_iletisim_kisileri`, `teknik_destek_kayitlari`, `organizasyon_siparisler_ciceksepeti`.  
  Yeni kayıt ve güncellemelerde oturum kullanıcısı yazılıyor; eski kayıtlar migration ile temizlendiği için çoğu boş görünüyor.

- **Kolon var ama kod yazmıyor (hepsi boş):**  
  musteriler, musteri_faturalar, musteri_tahsilatlar, kampanyalar, urunler, urunler_kategoriler, araclar, partner_firmalar, sicak_satislar, bildirimler, organizasyon_etiketleri, organizasyon_turleri, organizasyon_alt_turleri, ayarlar_genel_* tabloları, tenants.  
  Bu tablolarda created_by/updated_by **şu an öylece duruyor**; hiçbir INSERT/UPDATE bu alanları set etmiyor.

### 5.2 Tüm tablolarda bu iki kolon var mı?

- **Hayır.** 47 tablonun 26’sında hem `created_by` hem `updated_by` var, 21’inde hiç yok.

### 5.3 Olması gerekli mi?

- **İş verisi (tenant tarafı) tabloları:**  
  Müşteri, fatura, tahsilat, kampanya, ürün, araç, partner, sıcak satış, ayarlar, organizasyon türü/etiket vb. için “kim ekledi / kim güncelledi” tutmak istiyorsanız bu tablolarda **created_by ve updated_by olması mantıklı**.  
  Şu an kolonlar **var ama kullanılmıyor**; ya bu tablolar için de INSERT/UPDATE’lere `getCurrentUsername(req)` ile yazma eklenmeli ya da kolonlar kaldırılmalı (genelde yazmak tercih edilir).

- **Sistem / log tabloları:**  
  tenants_*, admin_*, logs, tokens vb. için zorunlu değil; ihtiyaca göre eklenebilir.

### 5.4 Yapılabilecekler (kısa)

1. **Kolon var ama yazılmıyor:**  
   Musteriler, musteri_faturalar, musteri_tahsilatlar, kampanyalar, urunler, urunler_kategoriler, araclar, partner_firmalar, sicak_satislar, organizasyon_etiketleri, organizasyon_turleri, organizasyon_alt_turleri, ayarlar_genel_* (isletme, konum, yazdirma, teslimat_konumlari, ciceksepeti) ve (isteğe bağlı) tenants için INSERT/UPDATE noktalarına `created_by` / `updated_by` set eden kod eklenebilir.

2. **bildirimler:**  
  Zaten `kullanici_adi` ile “kim” bilgisi var; created_by/updated_by’ı da doldurmak isterseniz aynı değer yazılabilir veya kolonlar bırakılabilir.

3. **Kolonu olmayan tablolar:**  
  Tenant iş verisi olanlar (örn. ayarlar_gonderim_mesaj_sablonlari, tenants_kullanicilar) için ileride audit isterseniz created_by/updated_by eklenebilir; diğerleri için gerek yok.

Bu rapor, `analyze-created-by-updated-by.js` çıktısı ve backend grep ile oluşturuldu.
