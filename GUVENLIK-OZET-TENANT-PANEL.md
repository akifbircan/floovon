# Floovon – Tenant Panel Güvenlik Özeti

Bu dosya, tenant panel (tenant-app) ve ilgili API’ler için yapılan güvenlik incelemesinin özetidir. Projeyi satışa hazırlarken dikkate almanız için hazırlanmıştır.

---

## Güçlü Yönler (İyi Uygulamalar)

### 1. Tenant izolasyonu
- **Tenant ID client’tan alınmıyor:** `getTenantId()` fonksiyonu `X-Tenant-ID` ve `X-User-ID` header’larına **güvenmiyor**; yorumlarda “client manipüle edebilir” diye belirtilmiş.
- Tenant ID **sadece** HttpOnly cookie’deki `floovon_user_id` ile veritabanından (`tenants_kullanicilar.tenant_id`) türetiliyor. Yani bir kullanıcı sadece kendi tenant’ının verisine erişebilir.

### 2. URL’de tenant ID geçen endpoint’ler
- `/api/tenants/:tenantId/customers/:customerId/faturalar` ve tahsilatlar benzeri route’larda **URL’deki tenantId ile giriş yapan kullanıcının tenant_id’si karşılaştırılıyor.** Eşleşmezse **403** ve güvenlik log’u (manipülasyon denemesi) var. Bu, tenant’lar arası yetkisiz erişimi (IDOR) engelliyor.

### 3. Oturum ve cookie
- Tenant girişinde `floovon_user_id` **HttpOnly** cookie ile set ediliyor; JavaScript ile okunamaz (XSS ile çalınması zor).
- `sameSite: 'Lax'` kullanılıyor; production’da `secure: true` (HTTPS) panel domain’i için ayarlanıyor.

### 4. Şifre
- Kayıt ve girişte **bcrypt** kullanılıyor; şifreler hash’lenerek saklanıyor.

### 5. Sorgularda tenant filtresi
- Tenant’a özel veriler (müşteriler, siparişler, upload’lar vb.) için **her zaman** `req.tenantId` / `getTenantId(req)` kullanılıyor; veriler tenant_id ile filtreleniyor. Böylece yanlış tenant’ın verisi dönmüyor.

---

## Dikkat Edilmesi / İyileştirme Önerileri

### 1. Test endpoint’leri (önemli)
- **`/api/test-partner-db`** – `req.query.tenant_id` kullanıyor, kimlik doğrulama yok.
- **`/api/test-fix-partner-kodu`** – Aynı şekilde korumasız.
- **`/api/test-smtp`** – Test amaçlı, korumasız.

**Öneri:** Canlı (production) ortamda bu endpoint’leri **tamamen kapatın** veya sadece belirli IP / admin auth ile açın. Örn. `if (process.env.NODE_ENV === 'production') return res.status(404).send();` veya route’u sadece development’ta register edin.

### 2. GET /api/tenants
- Bu endpoint **requireAuth** kullanmıyor; herhangi biri tenant listesini (id, name) alabiliyor.
- Eğer bu API sadece giriş yapmış tenant panelinde kullanılıyorsa, **requireAuth** (veya mevcut auth middleware’iniz) ekleyin. Böylece sadece oturum açmış kullanıcılar tenant listesini görebilir.

### 3. Public endpoint’ler (tenant_code ile)
- `/api/public/invoice/:invoiceId/pdf`, `/api/public/subscription`, `/api/public/billing-history` vb. **tenant_code** (veya tenant_id) ile erişiliyor; auth yok (bilinçli: fatura linki, landing sayfası vb.).
- Erişim, **tenant_code bilmeye** bağlı. **tenant_code**’ların tahmin edilebilir olmaması önemli (örn. sıralı sayı yerine rastgele/benzersiz kod). Mevcut `tenants_no` yapınız zaten buna uygunsa ek işlem gerekmez.

### 4. Token formatı
- Tenant login’de dönen token şu an `'dummy-token-' + Date.now()` formatında; asıl oturum **cookie** ile yönetiliyor. Bu, cookie tabanlı tasarım için sorun değil.
- İleride isterseniz **JWT** (imzalı, süre sınırlı) kullanabilirsiniz; mevcut yapı satış için kritik bir zafiyet oluşturmuyor.

### 5. Genel öneriler (satış öncesi)
- **HTTPS:** Canlıda tüm trafik HTTPS üzerinden olmalı (zaten cookie `secure` production’da kullanılıyor).
- **Rate limiting:** Login ve şifre sıfırlama gibi endpoint’lere brute-force’a karşı rate limit eklenmesi iyi olur.
- **Başlıklar:** `X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Content-Security-Policy` gibi güvenlik header’ları (express middleware ile) eklenebilir.

---

## Özet Tablo

| Konu | Durum | Not |
|------|--------|-----|
| Tenant ID kaynağı | İyi | Sadece cookie + DB; client’a güvenilmiyor |
| URL’de tenantId kullanımı | İyi | Karşılaştırma var, 403 + log |
| Şifre saklama | İyi | Bcrypt |
| Oturum cookie | İyi | HttpOnly, SameSite, production’da Secure |
| Test endpoint’leri | Risk | Production’da kapatılmalı |
| GET /api/tenants | İyileştirilebilir | Auth ile korunabilir |
| Public API (tenant_code) | Kabul edilebilir | tenant_code gizliliği önemli |

---

Bu özet, mevcut kod incelemesine dayanır. Tam kapsamlı bir güvenlik denetimi için penetrasyon testi veya bağımsız bir güvenlik incelemesi düşünülebilir.
