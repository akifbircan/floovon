# Stil dosyaları konsolidasyon planı

## Amaç
Inspect’te stillerin dağınık ve çorba görünmesini önlemek; her alanın stillerini tek (veya net) dosyada toplamak.

---

## 1. MODALLAR → Tek dosya

**Hedef:** Tüm modal/overlay stilleri (yeni kart, yeni müşteri, yeni sipariş, overlay, body:has(modal) header/sidebar gizleme) **tek dosyada**, tüm breakpoint’ler aynı dosyada.

**Yapılacaklar:**
- `modal-styles-important.css` içeriği `modal-styles.css` ile birleştirilecek (override kuralları aynı dosyada, sonda).
- `header-custom.css` ve `layout-custom.css` içindeki `body:has(.overlay-yeni-...)` / `body:has(.modal-react-...)` kuralları `modal-styles.css` sonuna taşınacak.
- `modal-styles-important.css` kaldırılacak; `main.tsx`’te import silinecek.
- Modal ile ilgili olmayan bloklar (tablo scroll, sag-panel z-index) `layout-custom.css` sonuna taşındı.

**Yapıldı:** Tüm modal stilleri tek dosyada: `modal-styles.css` (base + override + yeni kart/müşteri/sipariş + input/select + mobil @media + body:has). `modal-styles-important.css` import kaldırıldı.

---

## 2. SIDEBAR → sidebar-custom.css

**Hedef:** Sidebar/nav stilleri sadece `sidebar-custom.css` ve gerekirse `css-variables.css` (değişkenler).

**Taşınacak / kontrol:** Şu an 9 dosyada geçiyor. Sidebar’a özel kurallar `sidebar-custom.css`’e toplanacak; layout/header’daki sadece “sidebar’ı gizle” gibi kurallar modal veya layout dosyasında kalabilir.

---

## 3. DASHBOARD / GRID / KARTLAR → dashboard-cards.css + dashboard-grid.css + dashboard-custom.css

**Hedef:** Grid, container, ana-kart, sipariş kartı stilleri bu üç dosyada; mobil/tablet kurallar aynı dosyaların içinde `@media` ile.

**Dağınık kaynaklar:** mobile-index, mobile-pages, tablet-notebook, layout-custom, modal-styles-important (tablo scroll), globals.  
**Yapılacak:** Dashboard/grid/kart ile ilgili tüm kurallar bu üç dosyaya taşınacak; diğer dosyalardan ilgili bloklar kaldırılacak veya yorum satırı ile “taşındı” denilecek.

---

## 4. PROFİL / AYARLAR → profil-ayarlari.css

**Hedef:** Profil, ayarlar, profil-drawer stilleri tek dosyada.

**Yapılacak:** Bu alanla ilgili kurallar `profil-ayarlari.css`’e toplanacak; modal-styles, header-custom, dashboard-cards, mobile-pages, tablet-notebook, globals, buttons-common, floovon-dashboard-codes içindeki profil/ayar stilleri buraya taşınacak.

---

## 5. HEADER → header-custom.css

**Hedef:** Header stilleri sadece `header-custom.css`; “modal açıkken header gizlensin” kuralları modallar dosyasında kalacak.

**Yapılacak:** Header’a özel tüm stiller `header-custom.css`’te toplanacak; diğer dosyalardan header kuralları buraya taşınacak.

---

## 6. TOAST → toast-override.css + css-variables (--toast-*)

**Hedef:** Toast görünümü tek yerde; değişkenler `css-variables.css`’te kalmaya devam.

**Yapılacak:** Toast stilleri `toast-override.css` ve gerekirse `ciceksepeti-toast.css` ile sınırlı; dağınık toast kuralları bu dosyalara toplanacak.

---

## 7. SAĞ PANEL / DETAY PANELİ → right-panel.css

**Hedef:** Sağ panel / page-panel-sag stilleri `right-panel.css` ve ilgili layout dosyasında.

**Yapılacak:** Sağ panel ve detay paneli stilleri `right-panel.css`’e toplanacak; dashboard-cards, mobile-pages, tablet-notebook’taki ilgili kurallar buraya taşınacak.

---

## 8. ARŞİV → arsiv-siparisler.css

**Hedef:** Arşiv sayfası stilleri `arsiv-siparisler.css`’te.

**Yapılacak:** Arşiv ile ilgili tüm kurallar bu dosyada toplanacak; diğer dosyalardan arşiv stilleri kaldırılıp buraya taşınacak.

---

## 9. SELECT / FORM ELEMANLARI → select-arrow-global.css + modal-styles (modal içi)

**Hedef:** Global select stilleri `select-arrow-global.css`; modal içi input/select/textarea modal dosyasında.

**Yapılacak:** Modal içi select/input kuralları zaten modallar dosyasında olacak; global select stilleri `select-arrow-global.css`’te kalacak.

---

## Öncelik sırası (uygulama)

1. **Modallar** – modal-styles.css + modal-styles-important birleştirme + body:has taşıma.
2. **Header/sidebar “modal açıkken”** – modallar dosyasına taşındı (adım 1).
3. **Diğer alanlar** – Plan yukarıdaki sırayla uygulanacak; her adımda ilgili dosyalar güncellenecek.

---

## Dosya yükleme sırası (main.tsx) – güncel hedef

- index.css (globals, mobile-index, mobile-pages)
- css-variables
- floovon-dashboard, floovon-dashboard-codes, login-custom
- header-custom, layout-custom
- dashboard-custom, dashboard-grid, dashboard-cards
- sidebar-custom, right-panel, tooltip
- buttons-common, profil-ayarlari
- ciceksepeti-toast, ciceksepeti-modal
- **modal-styles.css** (tek modal dosyası; siparis-modal-legacy ayrı kalabilir)
- siparis-modal-legacy
- toast-override, phone-landscape-warning, tablet-notebook
- select-arrow-global

`modal-styles-important.css` import’u kaldırılacak.
