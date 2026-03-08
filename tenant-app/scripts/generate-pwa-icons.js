/**
 * PWA ikonları: FLOOVON/favicon içindeki android-chrome-192x192.png ve
 * android-chrome-512x512.png -> tenant-app/public/icon-192.png, icon-512.png
 * Yeni ikon kullanacaksan favicon klasöründeki PNG'leri güncelle, sonra bu scripti çalıştır.
 * Çalıştırma: node scripts/generate-pwa-icons.js (tenant-app klasöründen)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const faviconDir = path.join(__dirname, '..', '..', 'favicon');

const files = [
  { from: 'android-chrome-192x192.png', to: 'icon-192.png' },
  { from: 'android-chrome-512x512.png', to: 'icon-512.png' },
];

function main() {
  for (const { from, to } of files) {
    const src = path.join(faviconDir, from);
    const dest = path.join(publicDir, to);
    if (!fs.existsSync(src)) {
      console.error(`Bulunamadı: ${src}`);
      process.exit(1);
    }
    fs.copyFileSync(src, dest);
    console.log(`${to} (favicon/${from} kopyalandı)`);
  }
}

main();
