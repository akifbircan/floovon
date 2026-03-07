# Action Contract System - Implementation Plan

## Overview
Merkezi aksiyon yönetim sistemi: Tüm tenant panel aksiyonları (WhatsApp, Yazdır, Arşiv, QR, Araç Takip, vb.) tek bir standartla yönetilecek.

## Phase 1: Action Contract Documentation (ZORUNLU)
**Klasör:** `docs/action-contract/`

### 14 Sayfa için Contract Çıkarılacak:
1. `dashboard.md` - Dashboard sayfası aksiyonları
2. `siparis-kart-detay.md` - Sipariş detay sayfası
3. `organizasyon-kart-detay.md` - Organizasyon kart detay
4. `arac-takip.md` - Araç takip sayfası
5. `cari-musteri.md` - Müşteri cari sayfası
6. `cari-partner.md` - Partner cari sayfası
7. `kampanya.md` - Kampanya yönetimi
8. `arsiv.md` - Arşiv sayfası
9. `potansiyel-partner.md` - Potansiyel partner sayfası
10. `urun-yonetimi.md` - Ürün yönetimi
11. `kullanici-yonetimi.md` - Kullanıcı yönetimi
12. `ayarlar.md` - Ayarlar sayfası
13. `raporlar.md` - Raporlar sayfası
14. `bildirimler.md` - Bildirimler sayfası

### Contract Şablonu:
```markdown
# [Sayfa Adı] Action Contract

## Sayfa Özeti
[Sayfa hakkında kısa açıklama]

## Aksiyon Listesi

### [Aksiyon Adı]
- **actionKey**: `[unique-key]`
- **UI Tetikleyici**: [buton/ikon/menu konumu]
- **Gerekli Input**: [orderId, customerId, vb.]
- **Endpoint**: `[METHOD] /api/[path]`
- **Success Sonucu**: [toast, modal kapanır, liste refetch, highlight]
- **Error Sonucu**: [error toast + hata kodu]
- **Yetki/Rol**: [hangi roller erişebilir]
- **Loading Davranışı**: [disable, spinner]
- **Notlar**: [warning desteği, özel durumlar]
```

## Phase 2: Action Registry (TEK MERKEZ)
**Klasör:** `src/features/actions/`

### Dosyalar:
- `actionRegistry.ts` - actionKey → handler mapping
- `actionTypes.ts` - ActionContext types
- `useAction.ts` - UI hook: `runAction(actionKey, payload)`
- `actionGuards.ts` - rol/izin kontrol yardımcıları
- `actionUi.ts` - standart toast, confirm modal, error normalize

### Kural:
UI tarafında hiçbir yerde doğrudan endpoint çağrısı yapılmayacak. Tüm aksiyonlar `runAction()` ile tetiklenecek.

## Phase 3-14: Feature Pipelines
Her feature için ayrı klasör ve modüller oluşturulacak:
- WhatsApp Pipeline (`src/features/whatsapp/`)
- Print Pipeline (`src/features/print/`)
- Archive Pipeline (`src/features/archive/`)
- Move/Sort (`src/features/dashboard/move-sort/`)
- QR Pipeline (`src/features/qr/`)
- Vehicle Tracking (`src/features/vehicle-tracking/`)
- Cari (`src/features/cari/`)
- Campaigns (`src/features/campaigns/`)

## Phase 15: Ortak Standartlar
- UI Standard Components (ConfirmModal, Toast, ErrorBoundary, EmptyState, LoadingSkeleton)
- Error Normalize (tek format)
- Test Checklist

## Implementation Order
1. ✅ Action Contract Documentation (14 sayfa)
2. ✅ Action Registry Core (actionRegistry.ts, actionTypes.ts, useAction.ts)
3. ✅ Action Guards & UI Helpers
4. ✅ WhatsApp Pipeline
5. ✅ Print Pipeline
6. ✅ Archive Pipeline
7. ✅ Move/Sort
8. ✅ QR Pipeline
9. ✅ Vehicle Tracking
10. ✅ Cari
11. ✅ Campaigns
12. ✅ Ortak Standartlar
13. ✅ Test & Refactor




