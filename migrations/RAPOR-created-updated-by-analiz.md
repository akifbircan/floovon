# created_by / updated_by Analiz Raporu

## 1. Özet

- **Kolonu olan tablo:** 26
- **Kolonu olmayan tablo:** 21
- **Veri yazılan (kod tarafında set edilen):** Sadece birkaç tabloda; çoğunda kolon var ama INSERT/UPDATE'te atanmıyor.

---

## 2. Kolonu OLAN tablolar – doldurulma durumu

| Tablo | Satır | created_by dolu | updated_by dolu | Durum |
|-------|-------|-----------------|-----------------|--------|
| ayarlar_gonderim_iletisim_kisileri | 3 | 3/3 | 3/3 | ✅ Kod yazıyor |
| ayarlar_gonderim_rapor_ayarlari | 1 | 1/1 | 1/1 | ✅ Kod yazıyor |
| siparisler | 17 | 1/17 | 3/17 | ⚠️ Kısmen (yeni kayıt/güncelleme yapan endpoint'ler yazıyor) |
| teknik_destek_kayitlari | 45 | 12/45 | 12/45 | ⚠️ Kısmen (bazı kayıtlar kodla, eskiler boş) |
| urunler | 19 | 5/19 | 5/19 | ⚠️ Kısmen |
| araclar | 6 | 0/6 | 0/6 | ❌ Kod yazmıyor |
| ayarlar_ciceksepeti_ayarlari | 1 | 0/1 | 0/1 | ❌ Kod yazmıyor |
| ayarlar_genel_isletme_ayarlari | 3 | 0/3 | 0/3 | ❌ Kod yazmıyor |
| ayarlar_genel_konum_ayarlari | 1 | 0/1 | 0/1 | ❌ Kod yazmıyor |
| ayarlar_genel_teslimat_konumlari | 4 | 0/4 | 0/4 | ❌ Kod yazmıyor |
| ayarlar_genel_yazdirma_ayarlari | 6 | 0/6 | 0/6 | ❌ Kod yazmıyor |
| bildirimler | 34 | 0/34 | 0/34 | ❌ Kod yazmıyor |
| kampanyalar | 6 | 0/6 | 0/6 | ❌ Kod yazmıyor |
| musteri_faturalar | 35 | 0/35 | 0/35 | ❌ Kod yazmıyor |
| musteri_tahsilatlar | 5 | 0/5 | 0/5 | ❌ Kod yazmıyor |
| musteriler | 29 | 0/29 | 0/29 | ❌ Kod yazmıyor |
| organizasyon_alt_turleri | 18 | 0/18 | 0/18 | ❌ Kod yazmıyor |
| organizasyon_etiketleri | 21 | 0/21 | 0/21 | ❌ Kod yazmıyor |
| organizasyon_kartlar | 17 | 0/17 | 0/17 | ❌ Kod yazmıyor (INSERT'te var ama migration sonrası hepsi NULL) |
| organizasyon_siparisler_ciceksepeti | 2 | 0/2 | 0/2 | ❌ Kod yazmıyor |
| organizasyon_turleri | 4 | 0/4 | 0/4 | ❌ Kod yazmıyor |
| partner_cari_hareketler | 12 | 0/12 | 0/12 | ❌ Kod yazmıyor |
| partner_firmalar | 4 | 0/4 | 0/4 | ❌ Kod yazmıyor |
| sicak_satislar | 11 | 0/11 | 0/11 | ❌ Kod yazmıyor |
| tenants | 4 | 0/4 | 0/4 | ❌ Kod yazmıyor |
| urunler_kategoriler | 8 | 0/8 | 0/8 | ❌ Kod yazmıyor |

---

## 3. Kolonu OLMAYAN tablolar

- admin_bildirimler *(created_by_user kullanıyor, farklı isim)*
- admin_kullanicilar
- araclar_gps_konum_takip
- araclar_takip
- araclar_takip_teslimatlar
- ayarlar_gonderim_mesaj_sablonlari
- musteri_raporlari
- partner_cari_hareketler_yeni
- partner_siparisler
- proje_kullanim_hata_logs
- refresh_tokens
- sifre_sifirlama_tokenlari
- tenants_abonelik_planlari
- tenants_abonelikler
- tenants_faturalar
- tenants_kullanicilar
- tenants_kullanimlar
- tenants_logs
- tenants_odeme_yontemleri
- tenants_sayfa_izinleri
- whatsapp_baglantilar_logs

---

## 4. Backend’de created_by / updated_by yazan yerler

Kod incelemesine göre **sadece şu tablolarda** INSERT/UPDATE ile `created_by` / `updated_by` set ediliyor:

| Tablo | Ne yazılıyor |
|-------|-------------------------------|
| siparisler | POST/PUT'ta `getCurrentUsername(req)` → created_by, updated_by |
| organizasyon_kartlar | Oluşturma/güncellemede kullaniciAdi → created_by, updated_by |
| ayarlar_gonderim_rapor_ayarlari | INSERT/UPDATE'te kullaniciAdi |
| ayarlar_gonderim_iletisim_kisileri | INSERT/UPDATE'te kullaniciAdi |
| teknik_destek_kayitlari | INSERT'te created_by, updated_by |

Diğer tablolarda kolon **var** ama INSERT/UPDATE cümlelerinde bu alanlar **yok**; bu yüzden hep boş (NULL) kalıyor.

---

## 5. “Olması gerekli mi?” değerlendirmesi

### 5.1 Kolonu var, veri yazılması mantıklı olanlar (tenant kullanıcı işlemi)

Bunlar tenant panelinde kullanıcı tarafından eklenen/güncellenen tablolar. **Kolon zaten var; eksik olan kod tarafında atama.**

- **musteriler** – Müşteri ekleme/güncelleme
- **organizasyon_kartlar** – Zaten yazılıyor (yeni kayıtlar için); eski kayıtlar migration sonrası NULL
- **organizasyon_etiketleri**, **organizasyon_turleri**, **organizasyon_alt_turleri**
- **urunler**, **urunler_kategoriler**
- **kampanyalar**
- **araclar**
- **musteri_tahsilatlar**, **musteri_faturalar**
- **partner_firmalar**, **partner_cari_hareketler**
- **sicak_satislar**
- **ayarlar_genel_*** (isletme, konum, yazdirma, teslimat_konumlari, ciceksepeti) – Ayar kayıtları
- **siparisler** – Zaten yazılıyor
- **teknik_destek_kayitlari** – Zaten yazılıyor
- **ayarlar_gonderim_rapor_ayarlari**, **ayarlar_gonderim_iletisim_kisileri** – Zaten yazılıyor

Özet: Kolon **olması gereken** yerlerde çoğunlukla **zaten var**. Sorun, birçok yerde **INSERT/UPDATE’e created_by ve updated_by eklenmemesi**.

### 5.2 Kolonu olmayan tablolar – eklenmeli mi?

- **tenants_kullanicilar**, **tenants_sayfa_izinleri**, **tenants_odeme_yontemleri**, **tenants_abonelikler**, **tenants_faturalar**, **tenants_logs**, **tenants_kullanimlar**  
  → Tenant/oturum bazlı işlem; “kim ekledi/güncelledi” takibi istersen **created_by / updated_by eklenebilir**.

- **admin_bildirimler**  
  → Zaten `created_by_user` (farklı isim) kullanılıyor; aynı mantık.

- **araclar_takip**, **araclar_takip_teslimatlar**, **araclar_gps_konum_takip**, **whatsapp_baglantilar_logs**, **proje_kullanim_hata_logs**  
  → Sistem/log kaydı; isteğe bağlı.

- **refresh_tokens**, **sifre_sifirlama_tokenlari**, **admin_kullanicilar**, **tenants_abonelik_planlari**  
  → Genelde sistem/yönetim; zorunlu değil.

- **musteri_raporlari**, **partner_cari_hareketler_yeni**, **partner_siparisler**, **ayarlar_gonderim_mesaj_sablonlari**  
  → Kullanım amacına göre; işlem sahibi takibi istersen eklenebilir.

---

## 6. Sonuç ve öneriler

1. **Veri yazılıyor mu?**  
   - **Hayır**, çoğu tabloda yazılmıyor. Sadece siparisler, organizasyon_kartlar, ayarlar_gonderim_rapor_ayarlari, ayarlar_gonderim_iletisim_kisileri, teknik_destek_kayitlari için kod tarafında atama var. Diğerlerinde kolon var ama değer atanmadığı için boş kalıyor.

2. **Tüm tablolarda bu iki kolon var mı?**  
   - **Hayır.** 26 tabloda var, 21 tabloda yok.

3. **Olması gerekli mi?**  
   - **Tenant panelinde kullanıcı işlemiyle oluşturulan/güncellenen** tablolarda (musteriler, urunler, kampanyalar, araclar, musteri_tahsilatlar, partner_firmalar, sicak_satislar, ayarlar_genel_*, organizasyon_etiketleri, organizasyon_turleri, organizasyon_alt_turleri, musteri_faturalar vb.) **olması mantıklı**. Çoğunda kolon zaten var; eksik olan **backend’de her INSERT/UPDATE’e `getCurrentUsername(req)` ile created_by ve updated_by eklenmesi**.
   - Kolonu **olmayan** tablolar için: Tenant kullanıcı işlemi olanlar (örn. tenants_kullanicilar, tenants_sayfa_izinleri) için eklenmesi isteğe bağlı; sistem/log tablolarında zorunlu değil.

**Pratik öneri:**  
Önce kolonu olan tablolarda, ilgili tüm INSERT ve UPDATE cümlelerine `created_by` / `updated_by` (ve gerekirse `getCurrentUsername(req)`) ekleyerek tutarlı doldurma sağlanabilir. İstersen sıradaki adımda hangi endpoint’lerin hangi tabloya yazdığını tek tek çıkarıp patch listesi hazırlayabilirim.
