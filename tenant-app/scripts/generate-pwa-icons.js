/**
 * PWA ikonları: assets/logo-emblem-dark.svg -> icon-192.png, icon-512.png
 * Beyaz arka plan; Sharp ile SVG -> PNG.
 * Çalıştırma: node scripts/generate-pwa-icons.js (tenant-app klasöründen)
 */
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const svgPath = path.join(publicDir, 'assets', 'logo-emblem-dark.svg');

async function main() {
  try {
    const sizes = [192, 512];
    for (const size of sizes) {
      await sharp(svgPath)
        .resize(size, size)
        .flatten({ background: '#ffffff' })
        .png()
        .toFile(path.join(publicDir, `icon-${size}.png`));
      console.log(`icon-${size}.png yazıldı`);
    }
  } catch (e) {
    console.error('İkon üretilemedi:', e.message);
    process.exit(1);
  }
}

main();
