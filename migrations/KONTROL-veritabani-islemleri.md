# Veritabanı İşlemleri Kontrol Özeti

## 1. Soft delete (is_active / aktif = 0)

| Tablo / Konu | Durum | Not |
|--------------|--------|-----|
| admin_kullanicilar | ✅ | UPDATE is_active=0, updated_at (updated_at eklendi) |
| tenants_kullanicilar | ✅ | UPDATE is_active=0, updated_by |
| musteri_raporlari | ✅ | UPDATE is_active=0 |
| musteri_tahsilatlar | ✅ | 4 endpoint, hepsi UPDATE is_active=0, updated_by |
| musteriler | ✅ | UPDATE is_active=0, updated_by |
| ayarlar_gonderim_iletisim_kisileri | ✅ | UPDATE is_active=0, updated_at, updated_by (updated_by eklendi) |
| organizasyon_etiketleri | ✅ | UPDATE is_active=0, updated_by |
| ayarlar_genel_teslimat_konumlari | ✅ | UPDATE aktif=0, updated_by |
| organizasyon_alt_turleri | ✅ | UPDATE is_active=0, updated_by |
| araclar | ✅ | UPDATE is_active=0, updated_by |
| urunler_kategoriler | ✅ | UPDATE is_active=0, updated_by |
| urunler | ✅ | UPDATE is_active=0, updated_by |
| araclar_takip | ✅ | UPDATE is_active=0 (cleanup) |
| kampanyalar | ✅ | UPDATE is_active=0, updated_by |
| sicak_satislar (tekil + toplu) | ✅ | UPDATE is_active=0, updated_by |
| partner_cari_hareketler | ✅ | UPDATE is_active=0 |
| partner_firmalar | ✅ | UPDATE is_active=0, updated_by |
| **DELETE FROM (bilinçli)** | ⚠️ | Sadece `sifre_sifirlama_tokenlari` (token güvenliği) |

- Silme işlemlerinde **durum alanına "pasif" yazılmıyor**; sadece is_active/aktif kullanılıyor.

## 2. created_by / updated_by yazılan tablolar

| Tablo | INSERT | UPDATE | Not |
|-------|--------|--------|-----|
| ayarlar_ciceksepeti_ayarlari | ✅ created_by, updated_by | ✅ updated_by | Kolon yoksa ALTER ile ekleniyor |
| ayarlar_gonderim_mesaj_sablonlari | ✅ created_by, updated_by (GET + PUT) | ✅ updated_by | Zaten yazılıyordu |
| ayarlar_gonderim_iletisim_kisileri (silme) | - | ✅ updated_by | Silmede updated_by eklendi |

(Backend’de created_by/updated_by kullanan diğer tablolar önceki analizle uyumlu.)

## 3. Tablo adı: ayarlar_ciceksepeti_ayarlari

- Backend’de veri için kullanılan sabit: `CICEKSEPETI_TABLE = 'ayarlar_ciceksepeti_ayarlari'` (doğru).
- Eski isim (`ayalari`) sadece sunucu açılışında “varsa yeniden adlandır” için kullanılıyor; veri okuma/yazma yok.
- Schema dosyaları (schema-local, schema-server, schema-export): `ayarlar_ciceksepeti_ayarlari`.

## 4. Migration dosyaları

- `migrations/add-soft-delete-columns.js`: musteri_tahsilatlar, musteri_raporlari, ayarlar_genel_teslimat_konumlari, araclar_takip için is_active/aktif ekler.
- `migrations/rename-ciceksepeti-table.js`: Tablo adı `ayalari` → `ayarlari` (varsa yeniden adlandırır).

## 5. Bu kontrolde yapılan düzeltmeler

1. **admin_kullanicilar** soft delete: `updated_at = CURRENT_TIMESTAMP` eklendi.
2. **ayarlar_gonderim_iletisim_kisileri** silme: `updated_by = ?` ve `getCurrentUsername(req)` eklendi.

## 6. Tekrarlar / çakışmalar

- Aynı tabloya hem hard delete hem soft delete yazan kod yok.
- Tablo adı hem `ayalari` hem `ayarlari` ile kullanılan veri endpoint’i yok.
