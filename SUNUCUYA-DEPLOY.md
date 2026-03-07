# Sunucuya deploy – adımlar

Localhost’taki değişikliklerin sunucuya yansıması için **github-run** bat’larını kullan veya elle yap.

---

## Otomatik: 13 numaralı bat (Push + Sunucu güncelleme)

1. **İlk kez:** `github-run\sunucu-config.ornek.txt` dosyasını **`sunucu-config.txt`** olarak kopyala. İçinde `host`, `user`, `remotepath` değerlerini doldur (sunucu IP/domain, SSH kullanıcı adı, proje yolu).
2. **Her deploy’da:** `github-run\13-github-push-ve-sunucuya-yukle.bat` çalıştır (veya VS Code’da görev: **TEK TIKLA: GitHub Push + Sunucuya Yukle**).
3. Bu bat: commit + push yapar, ardından SSH ile sunucuda `git pull`, `npm install`, `npm run build`, `pm2 restart` çalıştırır. **FTP ile dosya yüklemen gerekmez** – sunucu Git’ten çeker.

**Not:** Sunucuda proje **git clone** ile kurulmuş olmalı; SSH erişimin olmalı. `sunucu-config.txt` yoksa bat sadece push yapar ve sunucuda elle çalıştırman gereken komutları ekrana yazar.

---

## Elle: Sadece push (02 bat)

- `github-run\02-github-push-degiskilikleri-gonder.bat` → Sadece GitHub’a push. **Sunucu dosyaları değişmez**; sunucuda ayrıca pull/restart yapmalısın.

---

## Elle: Sunucuda yapılacaklar

SSH ile bağlan, sonra:

```bash
cd /home/floovon/htdocs/panel.floovon.com
git pull origin main
cd backend && npm install --omit=dev
cd ../tenant-app && npm run build
cd .. && pm2 restart floovon-backend --update-env
```

---

## Neden FTP’de dosyalar güncellenmiyor?

Sunucu **Git** ile güncelleniyor: `git pull` ile repo’daki dosyalar sunucuya iner. **FTP ile dosya atman gerekmez.** Eğer sen sadece 02 bat’ı (veya sadece `git push`) kullanıyorsan, GitHub’a gidiyor ama sunucu tarafında **kimse `git pull` yapmıyor**; bu yüzden FTP’de eski dosyalar görünüyor. Çözüm: **13 numaralı bat** (sunucu-config.txt ile) veya sunucuda yukarıdaki komutları elle çalıştırmak.

---

## Yeni kod çalışıyor mu?

- **https://panel.floovon.com/console** → F12 → Network → **admin/tenants** → Response Headers’ta **X-Admin-Tenants-Version: 2** var mı bak. Varsa sunucu güncel.
