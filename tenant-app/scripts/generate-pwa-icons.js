/**
 * PWA kurulumu için 192x192 ve 512x512 PNG ikonları üretir.
 * Tema rengi (#6a48b8) ile dolu kare; favicon formatına bağımlı değil.
 * Çalıştırma: node scripts/generate-pwa-icons.js (tenant-app klasöründen)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

// Floovon tema rengi
const R = 0x6a, G = 0x48, B = 0xb8, A = 255;

function createIcon(size) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      png.data[idx] = R;
      png.data[idx + 1] = G;
      png.data[idx + 2] = B;
      png.data[idx + 3] = A;
    }
  }
  return png;
}

function writePng(png, filepath) {
  return new Promise((resolve, reject) => {
    png
      .pack()
      .pipe(fs.createWriteStream(filepath))
      .on('finish', resolve)
      .on('error', reject);
  });
}

async function main() {
  try {
    await writePng(createIcon(192), path.join(publicDir, 'icon-192.png'));
    console.log('icon-192.png yazıldı');
    await writePng(createIcon(512), path.join(publicDir, 'icon-512.png'));
    console.log('icon-512.png yazıldı');
  } catch (e) {
    console.error('İkon üretilemedi:', e.message);
    process.exit(1);
  }
}

main();
