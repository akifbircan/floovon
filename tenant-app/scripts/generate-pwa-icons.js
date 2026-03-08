/**
 * PWA ikonları: favicon'daki PNG'leri kopyala, masaüstü için köşeleri yuvarlat.
 * Sonuç: icon-192.png, icon-512.png (yuvarlatılmış köşeli, köşeler şeffaf).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const faviconDir = path.join(__dirname, '..', '..', 'favicon');

const files = [
  { from: 'android-chrome-192x192.png', to: 'icon-192.png', size: 192 },
  { from: 'android-chrome-512x512.png', to: 'icon-512.png', size: 512 },
];

/** Köşe yarıçapı: 0.1 = hafif yuvarlak, 0.35 = belirgin, 0.5 = neredeyse daire */
function radius(size) {
  return Math.round(size * 0.35);
}

/** Yuvarlatılmış kare SVG mask (beyaz dolgu, şeffaf dışı) */
function roundedRectSvg(size) {
  const r = radius(size);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="white"/>
</svg>`;
}

async function applyRoundedCorners(inputPath, outputPath, size) {
  const maskSvg = roundedRectSvg(size);
  await sharp(inputPath)
    .resize(size, size)
    .composite([{ input: Buffer.from(maskSvg), blend: 'dest-in' }])
    .png()
    .toFile(outputPath);
}

async function main() {
  if (!fs.existsSync(faviconDir)) {
    console.warn('PWA ikonları: favicon klasörü yok, atlanıyor.');
    return;
  }
  for (const { from, to, size } of files) {
    const src = path.join(faviconDir, from);
    const dest = path.join(publicDir, to);
    if (!fs.existsSync(src)) {
      console.warn(`PWA ikonları: ${from} bulunamadı, atlanıyor.`);
      continue;
    }
    try {
      await applyRoundedCorners(src, dest, size);
      console.log(`${to} (favicon/${from} → yuvarlatılmış köşeler)`);
    } catch (e) {
      console.warn(`${to} yuvarlatılamadı, kopyalanıyor:`, e.message);
      fs.copyFileSync(src, dest);
    }
  }
}

main();
