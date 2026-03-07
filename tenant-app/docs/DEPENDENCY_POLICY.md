# Dependency Management Policy

## 🎯 Amaç

Tenant React uygulamasının "yarın bir gün paket güncellendi bozuldu" riskini minimize etmek için bağımlılık yönetimi politikası.

## 📋 Kurallar

### 1. Versiyon Kilitleme

- **Tüm sürümler exact olmalı**: `package.json` içinde `^` ve `~` kullanılmaz
- **Lockfile zorunlu**: `package-lock.json` commit edilmelidir
- **Reproducible builds**: `npm ci` kullanılarak aynı versiyonlar yüklenmelidir

### 2. Güncelleme Politikası

#### Major Updates
- **Changelog okunmalı**: Breaking changes kontrol edilmeli
- **Staging'de test edilmeli**: Production'a geçmeden önce staging'de test edilmeli
- **Manuel onay gerekli**: Major update'ler için explicit onay alınmalı

#### Minor/Patch Updates
- **Test + Build**: Güncelleme sonrası `npm run build` ve `npm run lint` çalıştırılmalı
- **Typecheck**: `npm run typecheck` hatasız olmalı
- **Staging'de test**: Production'a geçmeden önce staging'de test edilmeli

#### Güncelleme Sıklığı
- **Aylık değil**: Otomatik aylık güncelleme yapılmaz
- **İhtiyaç olunca**: Sadece gerektiğinde güncelleme yapılır
- **6 ayda bir planlı review**: Yılda 2 kez dependency review yapılır

### 3. Güncelleme Süreci

1. **Outdated kontrol**: `npm run check:deps` ile güncel olmayan paketleri listele
2. **Staging branch**: Güncellemeler staging branch'inde yapılır
3. **Test**: Build, lint, typecheck ve manuel test
4. **PR review**: Code review sonrası merge
5. **Production**: Staging'de sorunsuz çalışıyorsa production'a geç

### 4. Script'ler

- `npm run check:deps`: Güncel olmayan paketleri listeler
- `npm run update:patch`: Patch güncellemeleri için bilgilendirme (manuel onaylı)
- `npm run typecheck`: TypeScript type kontrolü
- `npm run build`: Production build testi
- `npm run lint`: ESLint kontrolü

### 5. Node.js Versiyonu

- **.nvmrc dosyası**: Node.js versiyonu `.nvmrc` dosyasında belirtilir
- **engines field**: `package.json` içinde `engines` field'ı zorunludur
- **Versiyon uyumu**: Tüm geliştiriciler aynı Node.js versiyonunu kullanmalıdır

## ⚠️ Dikkat Edilmesi Gerekenler

1. **Lockfile commit edilmeli**: `package-lock.json` git'e commit edilmelidir
2. **npm ci kullan**: Development'ta `npm install` yerine `npm ci` kullanılmalıdır
3. **Breaking changes**: Major update'lerde breaking changes kontrol edilmelidir
4. **Security updates**: Security update'ler önceliklidir
5. **Peer dependencies**: Peer dependency uyarıları dikkate alınmalıdır

## 📝 Örnek Güncelleme Senaryosu

```bash
# 1. Outdated paketleri kontrol et
npm run check:deps

# 2. Staging branch'ine geç
git checkout staging

# 3. Paketi güncelle (örnek: axios)
npm install axios@1.13.5 --save-exact

# 4. Test et
npm run typecheck
npm run lint
npm run build

# 5. Manuel test yap
npm run dev

# 6. Commit ve PR oluştur
git add package.json package-lock.json
git commit -m "chore: update axios to 1.13.5"
git push origin staging
```

## 🔒 Versiyon Kilitleme Örnekleri

✅ **Doğru**:
```json
{
  "dependencies": {
    "react": "18.3.1",
    "axios": "1.13.5"
  }
}
```

❌ **Yanlış**:
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "axios": "~1.13.5"
  }
}
```




































