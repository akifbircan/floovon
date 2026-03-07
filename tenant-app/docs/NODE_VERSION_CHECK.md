# Node.js Versiyon Kontrolü

## ⚠️ ÖNEMLİ: Production Sunucu Versiyonu Kontrolü

Bu proje şu anda **Node.js 22.20.0** kullanıyor (`.nvmrc` ve `package.json` engines).

### Production Sunucu Kontrolü Gerekli

**Yapılması gerekenler:**

1. **Production sunucuda Node.js versiyonunu kontrol edin:**
   ```bash
   node --version
   ```

2. **Eğer production sunucu farklı bir versiyon kullanıyorsa:**
   - Production sunucu versiyonunu `.nvmrc` dosyasına yazın
   - `package.json` içindeki `engines.node` field'ını production versiyonuna güncelleyin
   - CI workflow'daki `node-version` matrix'ini güncelleyin

3. **Örnek:**
   - Production sunucu: Node.js 20.18.0 kullanıyorsa
   - `.nvmrc`: `20.18.0` olmalı
   - `package.json` engines: `"node": ">=20.18.0"`
   - CI workflow: `node-version: [20.18.0]`

### Neden Önemli?

- Farklı Node.js versiyonları farklı davranışlar gösterebilir
- Production'da beklenmeyen hatalar oluşabilir
- Build süreçleri farklı sonuçlar verebilir

### Kontrol Komutu

Production sunucuda çalıştırın:
```bash
node --version
npm --version
```

Sonuçları `.nvmrc` ve `package.json` dosyalarına yansıtın.




































