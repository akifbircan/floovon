# Tenant Panel – Kullanım Haritası (Test Senaryoları)

Bu doküman, tester kullanıcıların tenant panelini **müşteri eklemeden sipariş ile ilgili tüm işlemlere** ve **tüm işlem butonlarının testine** kadar adım adım kullanması için hazırlanmıştır.

---

## 1. Giriş ve Genel Erişim

| Adım | Sayfa / Öğe | Yapılacak | Beklenen |
|------|-------------|-----------|----------|
| 1.1 | `/login` | Tenant kodu, kullanıcı adı/email, şifre ile giriş | Ana sayfaya (dashboard) yönlendirme |
| 1.2 | Header | Sol menü: Siparişler, Müşteriler, Partner, Kampanya, Raporlar, Arşiv, Ayarlar | Tüm menü öğeleri tıklanabilir (yetkiye göre) |
| 1.3 | Header | Sağ üst: Bildirim, Profil | Bildirim listesi / Profil sayfası açılır |
| 1.4 | Mobil | Alt navigasyon (Siparişler, Müşteriler, Partner, Kampanya, Raporlar, Arşiv, Ayarlar) | Mobilde aynı sayfalar açılır |

---

## 2. Ana Sayfa (Siparişler / Dashboard) – `/` veya `/siparisler`

### 2.1 Görünüm ve Filtreler

| Adım | Öğe | Yapılacak | Beklenen |
|------|-----|-----------|----------|
| 2.1.1 | Tarih filtresi | Tarih seçici ile gün/hafta değiştir | Kartlar seçilen tarihe göre güncellenir |
| 2.1.2 | Kart türü sekmeleri | Organizasyon, Araç Süsleme, Özel Sipariş, Özel Gün, Çiçek Sepeti | Sekmeye tıklanınca ilgili kartlar listelenir |
| 2.1.3 | Gruplama | Ay / Hafta / Mahalle grupları | Gruplar açılıp kapanır; sipariş kartları görünür |

### 2.2 Yeni Kart ve Yeni Sipariş (Müşteri Eklenmeden)

| Adım | Öğe | Yapılacak | Beklenen |
|------|-----|-----------|----------|
| 2.2.1 | **Yeni Kart** butonu | Tıkla | “Yeni Kart” modalı açılır |
| 2.2.2 | Yeni Kart – Sekme | Organizasyon / Araç Süsleme / Özel Sipariş / Özel Gün / Çiçek Sepeti seç | Form alanları seçilen türe göre değişir |
| 2.2.3 | Yeni Kart – Organizasyon | Tarih, saat, tür (Düğün/Nişan vb.), etiket, mahalle, konum, teslim kişisi, telefon doldur → Kaydet | Kart oluşur; listede görünür |
| 2.2.4 | Yeni Kart – Araç Süsleme | Tarih, saat, etiket vb. doldur → Kaydet | Araç Süsleme kartı oluşur |
| 2.2.5 | Yeni Kart – Özel Sipariş / Özel Gün | Tarih, etiket vb. doldur → Kaydet | İlgili kart oluşur |
| 2.2.6 | Yeni Kart – Çiçek Sepeti | Gerekli alanlar → Kaydet | Çiçek Sepeti kartı oluşur |
| 2.2.7 | **Yeni Sipariş** butonu (bir kartın üzerinde) | Tıkla | “Yeni Sipariş” modalı açılır (müşteri seçimi veya yeni müşteri ile) |
| 2.2.8 | Yeni Sipariş – Müşteri | Var olan müşteri seç veya “Yeni Müşteri” ile ekle; ürün, teslim kişisi, adres, ödeme, tutar doldur → Kaydet | Sipariş karta eklenir |

### 2.3 Kart Üzerindeki İşlem Butonları

| Adım | Öğe | Yapılacak | Beklenen |
|------|-----|-----------|----------|
| 2.3.1 | Kart menü (üç nokta / işlem ikonu) | Tıkla | Bağlam menüsü açılır |
| 2.3.2 | **Sipariş Detayları** | Tıkla | `/siparis-kart-detay/:id` sayfasına gider |
| 2.3.3 | **Kartı şuraya taşı** (alt menü) | Hedef kart seç | Sipariş seçilen karta taşınır |
| 2.3.4 | **Arşivle** | Tıkla → Arşiv sebebi seç → Onayla | Kart arşive gider; dashboard’dan kaybolur |
| 2.3.5 | Sipariş kartı (kart içindeki tek sipariş) | Sipariş satırına tıkla / menü | Sipariş düzenle / sil / taşı vb. |

### 2.4 Sipariş Kartı (Kart İçi) İşlemleri

| Adım | Öğe | Yapılacak | Beklenen |
|------|-----|-----------|----------|
| 2.4.1 | Sipariş satırı menü | Sipariş kartındaki sipariş için menü aç | Düzenle / Taşı / Arşivle vb. seçenekler |
| 2.4.2 | **Düzenle** | Tıkla | Sipariş düzenleme modalı açılır; kaydet → güncellenir |
| 2.4.3 | **Taşı** | Hedef kartı seç | Sipariş başka karta taşınır |
| 2.4.4 | **Arşivle** | Sebep seç → Onayla | Sipariş arşive gider |
| 2.4.5 | **Teslim Et** (varsa) | Tıkla → İmza / Foto (varsa) → Onayla | Sipariş teslim edildi olarak işaretlenir |
| 2.4.6 | Teslim fotoğrafları | Foto ekle / atla | Modal kapanır; teslim tamamlanır |
| 2.4.7 | İmza | İmza at → Onayla | İmza kaydedilir; teslim tamamlanır |

### 2.5 Sağ Panel (Araç Süsleme / Araç Takip)

| Adım | Öğe | Yapılacak | Beklenen |
|------|-----|-----------|----------|
| 2.5.1 | Araç listesi | Araç seç | Araç detayı / konum bilgisi (varsa) |
| 2.5.2 | Araç detay modal | Kapat / İşlem butonları | Modal kapanır veya işlem yapılır |

---

## 3. Sipariş Kart Detay Sayfası – `/siparis-kart-detay/:id`

| Adım | Öğe | Yapılacak | Beklenen |
|------|-----|-----------|----------|
| 3.1 | Sayfa açılışı | Dashboard’dan bir karta tıkla → Sipariş Detayları | Detay sayfası yüklenir |
| 3.2 | Kart bilgileri | Tarih, tür, konum, teslim kişisi vb. | Doğru veriler görünür |
| 3.3 | Sipariş listesi | Her sipariş: müşteri, ürün, tutar, teslim kişisi | Liste doğru |
| 3.4 | **Yeni Sipariş** (detay sayfasında) | Tıkla → Form doldur → Kaydet | Yeni sipariş bu karta eklenir |
| 3.5 | Sipariş düzenle | Bir siparişte Düzenle → Değiştir → Kaydet | Sipariş güncellenir |
| 3.6 | Sipariş sil / arşivle / taşı | İlgili butonlar | İşlem uygulanır |
| 3.7 | Teslim et / İmza / Foto | Butonlar (varsa) | Teslim akışı çalışır |
| 3.8 | Geri / Dashboard’a dön | Sol ok veya menüden Siparişler | Dashboard’a dönülür |

---

## 4. Arşiv Siparişler – `/arsiv-siparisler`

| Adım | Öğe | Yapılacak | Beklenen |
|------|-----|-----------|----------|
| 4.1 | Sayfa | Menüden Arşiv | Arşivlenmiş siparişler/kartlar listelenir |
| 4.2 | Tarih filtresi | Başlangıç / Bitiş tarihi seç | Listeye göre filtre uygulanır |
| 4.3 | Arama | Arama kutusuna metin yaz | Sonuçlar filtrelenir |
| 4.4 | Tablo | Ay / Hafta / Organizasyon grupları | Gruplar açılır; satırlar görünür |
| 4.5 | **Detay** butonu | Satıra tıkla | Sipariş/kart detayı veya detay sayfası |
| 4.6 | **Geri Yükle** (varsa) | Tıkla → Onayla | Kart/sipariş arşivden çıkar; dashboard’da görünür |
| 4.7 | Teslim Edildi (imza) | İmzalı satırda tooltip / tıklama | İmza görseli gösterilir |

---

## 5. Müşteriler – `/musteriler` (Sadece Listeleme / Erişim)

| Adım | Öğe | Yapılacak | Beklenen |
|------|-----|-----------|----------|
| 5.1 | Müşteri listesi | Sayfayı aç | Müşteriler listelenir (varsa) |
| 5.2 | Arama / Filtre | Arama kutusu veya filtre | Liste güncellenir |
| 5.3 | Müşteri satırı | Tıkla | Müşteri cari detay sayfasına gider |
| 5.4 | Yeni Müşteri (dashboard’dan sipariş akışında da kullanılır) | Modal üzerinden ekle | Müşteri oluşur; siparişte seçilebilir |

---

## 6. Müşteri Cari Detay – `/musteriler-cari/:id`

| Adım | Öğe | Yapılacak | Beklenen |
|------|-----|-----------|----------|
| 6.1 | Genel bilgiler | Sayfa aç | Müşteri adı, iletişim, adres vb. |
| 6.2 | Cari hareketler / Siparişler | Liste | Siparişler ve ödemeler (varsa) |
| 6.3 | Düzenle / Sil (varsa) | Butonlar | İlgili işlemler çalışır |

---

## 7. Partner Firmalar – `/partner-firmalar`

| Adım | Öğe | Yapılacak | Beklenen |
|------|-----|-----------|----------|
| 7.1 | Partner listesi | Sayfayı aç | Partnerlar listelenir |
| 7.2 | Partner ekle / düzenle | Butonlar | Modal veya form açılır |
| 7.3 | Partner cari | Partnera tıkla | `/partner-firmalar-cari/:id` açılır |
| 7.4 | Potansiyel partnerler | Menüden “Partnerler Potansiyel” (varsa) | `/partnerler-potansiyel` sayfası |

---

## 8. Kampanya Yönetimi – `/kampanya-yonetimi` (Premium)

| Adım | Öğe | Yapılacak | Beklenen |
|------|-----|-----------|----------|
| 8.1 | Kampanya listesi | Sayfayı aç | Kampanyalar listelenir |
| 8.2 | Yeni kampanya | Ekle → Form (başlık, tarih, görsel vb.) → Kaydet | Kampanya oluşur |
| 8.3 | Düzenle / Sil | İlgili butonlar | Güncelleme / silme çalışır |

---

## 9. Raporlar – `/raporlar`

| Adım | Öğe | Yapılacak | Beklenen |
|------|-----|-----------|----------|
| 9.1 | Rapor türleri | Sayfayı aç | Rapor seçenekleri görünür |
| 9.2 | Tarih / Filtre | Seç → Raporu getir | Veri yüklenir (veya “veri yok” mesajı) |
| 9.3 | İndir / Yazdır (varsa) | Butonlar | Dosya indirilir veya yazdırma açılır |

---

## 10. Ayarlar – `/ayarlar`

| Adım | Öğe | Yapılacak | Beklenen |
|------|-----|-----------|----------|
| 10.1 | Alt sekmeler | Ürünler, Ürün grupları, Organizasyon türleri, Organizasyon etiketleri vb. | Her sekme açılır |
| 10.2 | Tablo işlemleri | Ekle, Düzenle, Sil, Sıralama | CRUD ve sıra değişimi çalışır |
| 10.3 | Yazdırma / Fatura şablonu (varsa) | Ayarlar → Kaydet | Kaydedilir |
| 10.4 | Genel ayarlar (varsa) | Değiştir → Kaydet | Güncellenir |

---

## 11. Profil Ayarları – `/profil-ayarlari`

| Adım | Öğe | Yapılacak | Beklenen |
|------|-----|-----------|----------|
| 11.1 | Profil bilgisi | Ad, email, profil fotoğrafı | Görüntülenir / düzenlenir |
| 11.2 | Şifre değiştir | Eski / yeni şifre → Kaydet | Şifre güncellenir |
| 11.3 | Yetkiler (admin ise) | Sayfa yetkileri (varsa) | Kaydedilir |

---

## 12. Hata ve Erişim Kontrolleri

| Adım | Öğe | Yapılacak | Beklenen |
|------|-----|-----------|----------|
| 12.1 | Yetkisiz sayfa | Yetkisiz bir sayfaya URL ile git | 403 veya login’e yönlendirme |
| 12.2 | Olmayan sayfa | `/olmayan-sayfa` | 404 sayfası |
| 12.3 | Oturum süresi dolunca | Token süresi bitince API çağrısı | 401; login sayfasına yönlendirme |
| 12.4 | Ağ hatası | Sunucu kapalıyken işlem | Uygun hata mesajı (ve mümkünse log) |

---

## Özet Kontrol Listesi (Tüm İşlem Butonları)

- [ ] Giriş / Çıkış
- [ ] Yeni Kart (Organizasyon, Araç Süsleme, Özel Sipariş, Özel Gün, Çiçek Sepeti)
- [ ] Yeni Sipariş (karttan ve detay sayfasından)
- [ ] Sipariş Düzenle
- [ ] Sipariş Taşı (menüden “Kartı şuraya taşı” ve sipariş bazlı taşı)
- [ ] Kart Arşivle
- [ ] Sipariş Arşivle
- [ ] Teslim Et (imza / foto)
- [ ] Arşiv: Detay, Geri Yükle
- [ ] Müşteri: Listele, Detay, Yeni Müşteri (modal)
- [ ] Partner: Listele, Ekle, Düzenle, Cari
- [ ] Kampanya: Ekle, Düzenle, Sil (premium)
- [ ] Raporlar: Filtrele, İndir/Yazdır (varsa)
- [ ] Ayarlar: Tüm alt sekmelerde CRUD
- [ ] Profil: Bilgi güncelle, şifre değiştir

Bu harita, müşteri eklemeden sipariş tarafındaki tüm akışları ve butonları kapsar. Test sırasında her adımda hata alınırsa (ekran mesajı, console, ağ hatası) kaydedilmesi önerilir.

---

## Hata takibi (proje_kullanim_hata_logs)

Panelde kullanıcıların karşılaştığı **frontend** (yakalanmamış exception, unhandled rejection) ve **API** (4xx/5xx) hataları otomatik olarak backend'e gönderilir ve `proje_kullanim_hata_logs` tablosuna yazılır. Böylece sunucu ortamındaki hataları kullanıcıdan tek tek sormadan inceleyebilirsiniz.

- **Tablo:** `proje_kullanim_hata_logs` (tenant_id, user_id, source, error_message, error_stack, url, http_status, endpoint, user_agent, created_at)
- **Kaynak:** `source = 'frontend'` (sayfa hataları) veya `source = 'api'` (API cevap hataları)
- Logları görmek için veritabanında `SELECT * FROM proje_kullanim_hata_logs ORDER BY created_at DESC` veya benzeri bir sorgu kullanılabilir.
