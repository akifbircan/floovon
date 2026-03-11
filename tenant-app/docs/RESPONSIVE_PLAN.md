# Tenant App – Tablet, Notebook, Telefon Yatay/Dikey Responsive Planı

## Mevcut durum (özet)

| Aralık | Kullanım | Dosyalar |
|--------|----------|----------|
| **≤767px** | Mobil (tek breakpoint) | `mobile-pages.css`, `mobile-index.css`, `layout-custom.css`, Header/Customers/Campaigns/Partners `useIsMobile` (767) |
| **768–1023px** | Tablet (sadece sağ panel slide-out) | `right-panel.css` |
| **≥1024px** | Masaüstü | `right-panel.css`, `layout-custom.css` |
| **640px, 480px, 600px** | Dağınık kullanım | Bazı modallar, dashboard, login |

**Eksikler:** Telefon yatay, tablet dikey/yatay için ayrı davranış yok; notebook (1024–1280) için özel düzen yok.

---

## Önerilen breakpoint standardı

Tek yerde tanımlanacak (CSS değişkeni veya `_breakpoints.scss` / `breakpoints.ts`):

| Ad | Min width | Max width | Amaç |
|----|-----------|-----------|------|
| **phone** | 0 | 575 | Telefon dikey (küçük) |
| **phone-wide** | 576 | 767 | Telefon yatay / büyük telefon dikey |
| **tablet** | 768 | 1023 | Tablet dikey ve yatay |
| **notebook** | 1024 | 1279 | Küçük laptop / notebook |
| **desktop** | 1280 | — | Masaüstü |

İsteğe bağlı: **Telefon yatay** için `max-height` ile ayrı kural (örn. `width ≥ 576 && height ≤ 500` → yatay telefon).

---

## Yapılacaklar (sırayla)

### Faz 1 – Altyapı
1. **Breakpoint tek kaynak**
   - `src/styles/_breakpoints.css` veya `src/constants/breakpoints.ts`: `PHONE = 576`, `TABLET = 768`, `NOTEBOOK = 1024`, `DESKTOP = 1280` (veya mevcut 767’yi koruyup sadece yeni aralıklar ekle).
   - JS’te `useIsMobile()` → 767 kalsın veya 576’ya inilsin; `useIsTablet()`, `useIsNotebook()` eklenebilir (isteğe bağlı).
2. **CSS’te ortak medya sorguları**
   - Örn. `@media (max-width: 575px)` → telefon, `(min-width: 576px) and (max-width: 767px)` → telefon yatay, `(min-width: 768px) and (max-width: 1023px)` → tablet, `(min-width: 1024px) and (max-width: 1279px)` → notebook, `(min-width: 1280px)` → desktop.
   - Mevcut `767` kullanan yerler: önce “mobil = 767” ile devam edip, tablet/notebook için **ek** medya sorguları yazmak daha az riskli.

### Faz 2 – Layout (sidebar, header, sağ panel)
3. **Sidebar**
   - 768–1023 (tablet): Sidebar açık/kapalı veya dar genişlik (sadece ikon) – mevcut 768’de açık kalıyor, tablet yatayda dar mod denenebilir.
   - 1024–1279 (notebook): Sidebar her zaman açık, gerekirse genişlik 4rem’de kalır.
4. **Header**
   - Tablet: Logo + aksiyonlar sığsın; bildirim/delivery ikonları gizlenmez.
   - Telefon yatay (576–767): Alt navbar veya header yüksekliği/ padding ayarı.
5. **Sağ panel (dashboard)**
   - Zaten 768–1023 slide-out, 1024+ sabit; notebook’ta 345px sabit kalabilir veya biraz daraltılabilir.

### Faz 3 – Sayfa sayfa (tablet / notebook / telefon yatay)
6. **Liste + detay sayfaları (Müşteriler, Partner, Kampanya)**
   - **Tablet (768–1023):** Liste tek sütun ama kartlar 2 sütun grid olabilir; detay paneli yarım ekran veya slide-over.
   - **Notebook (1024–1279):** Mevcut iki panel; tablo sütunları sıkışmasın diye min-width / scroll.
   - **Telefon yatay (576–767):** Liste tek sütun, detay modal veya yarım ekran; bottom nav görünür kalmalı.
7. **Dashboard (index)**
   - `mobile-index.css` şu an sadece 767; 768–1023 için kart grid (2 sütun), 1024–1279 için 2–3 sütun.
8. **Tablolar**
   - **Tablet:** Bazı tablolarda “kart görünümü” 768’e kadar, 768+ küçük tablo (sütun sayısı azaltılmış) veya yatay scroll.
   - **Notebook:** Tam tablo, yatay scroll gerekirse.
9. **Modallar / overlay’lar**
   - Tablet: max-width %90 veya max 560px; notebook: 600–720px.
   - Telefon yatay: Genişlik `min(90vw, 480px)` gibi.

### Faz 4 – Telefon yatay özel
10. **Portrait vs landscape**
    - `(orientation: landscape) and (max-height: 500px)` veya `(max-width: 767px) and (orientation: landscape)`: header/navbar daha ince, içerik tek sütun, CTA’lar sabit alt şerit.
11. **Bottom nav**
    - Yatayda üstte veya altta ince bar; ikon + kısa etiket.

### Faz 5 – Tutarlılık ve test
12. **Tüm sayfalar**
    - Ayarlar, Profil, Raporlar, Arşiv, Cari, Sipariş detay: her biri 576, 768, 1024, 1280’de gözden geçirilecek.
13. **Formlar**
    - Tablet: 2 sütun grid (label sol, input sağ); notebook: aynı veya daha geniş.
14. **Dışa aktar / filtre**
    - Mobilde gizlenen dışa aktar; tablet’te gösterilebilir; notebook+ tam.

---

## Dosya bazlı özet

| Dosya / alan | Yapılacak |
|--------------|-----------|
| `mobile-pages.css` | Yeni medya blokları: `576–767`, `768–1023`, `1024–1279`; mevcut 767 bloğu bölünebilir veya ayrı “tablet-pages.css” eklenir. |
| `mobile-index.css` | 768–1023 ve 1024–1279 için dashboard grid ve kart boyutları. |
| `layout-custom.css` | Sidebar/header için tablet/notebook medya sorguları. |
| `right-panel.css` | Zaten 768–1023 ve 1024+ var; notebook’ta ince ayar. |
| `modal-styles.css` / `modal-styles-important.css` | Tablet/notebook max-width ve padding. |
| `Header.tsx` | `useIsMobile` 767 veya 576; tablet’te farklı aksiyon (opsiyonel). |
| `CustomersPage.tsx`, `PartnersPage.tsx`, `CampaignsPage.tsx` | `useIsTablet` ile detay paneli yarım ekran (tablet); telefon yatayda modal kalabilir. |
| `dashboard-cards.css` | 768–1023 2 sütun, 1024–1279 2–3 sütun. |

---

## Önerilen uygulama sırası

1. Breakpoint sabitleri ve (isteğe bağlı) `tablet-pages.css` / ortak medya sorgu yapısı.
2. Layout: sidebar + header tablet/notebook.
3. Dashboard: tablet ve notebook grid.
4. Müşteriler / Partner / Kampanya: tablet liste+detay, telefon yatay.
5. Tablolar: tablet “compact table” veya kart geçişi.
6. Modallar: tablet/notebook genişlik.
7. Telefon yatay (orientation + max-height).
8. Tüm sayfalar + formlar son kontrol.

Bu plana göre önce Faz 1 (breakpoint + CSS yapısı) ile başlanabilir; sonra Faz 2–3’ten bir sayfa (örn. Müşteriler veya Dashboard) pilot seçilip tablet/notebook/yatay tek tek tamamlanabilir.
