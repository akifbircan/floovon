/**
 * Eski CSS dosyalarından tasarım token'larını çıkaran script
 * Kullanım: node scripts/extract-design-tokens.js
 */

const fs = require('fs');
const path = require('path');

// CSS dosyalarını oku
const cssDir = path.join(__dirname, '../css');
const styleCss = fs.readFileSync(path.join(cssDir, 'style.css'), 'utf8');

// Renkleri çıkar (#hex, rgb, rgba, var(--))
const colorRegex = /(#[0-9A-Fa-f]{3,6}|rgb\([^)]+\)|rgba\([^)]+\)|var\(--[^)]+\))/g;
const colors = [...new Set(styleCss.match(colorRegex) || [])];

// Font family'leri çıkar
const fontFamilyRegex = /font-family:\s*['"]?([^'";}]+)['"]?/gi;
const fontFamilies = [...new Set([...styleCss.matchAll(fontFamilyRegex)].map(m => m[1].trim()))];

// Font size'ları çıkar
const fontSizeRegex = /font-size:\s*([^;]+);/gi;
const fontSizes = [...new Set([...styleCss.matchAll(fontSizeRegex)].map(m => m[1].trim()))];

// Spacing değerlerini çıkar (padding, margin)
const spacingRegex = /(?:padding|margin)(?:-top|-right|-bottom|-left)?:\s*([^;]+);/gi;
const spacings = [...new Set([...styleCss.matchAll(spacingRegex)].map(m => m[1].trim()))];

// Border radius değerlerini çıkar
const borderRadiusRegex = /border-radius:\s*([^;]+);/gi;
const borderRadiuses = [...new Set([...styleCss.matchAll(borderRadiusRegex)].map(m => m[1].trim()))];

// Box shadow değerlerini çıkar
const boxShadowRegex = /box-shadow:\s*([^;]+);/gi;
const boxShadows = [...new Set([...styleCss.matchAll(boxShadowRegex)].map(m => m[1].trim()))];

// Sonuçları yazdır
console.log('=== TASARIM TOKEN\'LARI ===\n');

console.log('RENKLER:');
colors.forEach(color => console.log(`  - ${color}`));

console.log('\nFONT FAMILY\'LER:');
fontFamilies.forEach(font => console.log(`  - ${font}`));

console.log('\nFONT SIZE\'LAR:');
fontSizes.slice(0, 20).forEach(size => console.log(`  - ${size}`));

console.log('\nSPACING DEĞERLERİ:');
spacings.slice(0, 20).forEach(spacing => console.log(`  - ${spacing}`));

console.log('\nBORDER RADIUS DEĞERLERİ:');
borderRadiuses.forEach(radius => console.log(`  - ${radius}`));

console.log('\nBOX SHADOW DEĞERLERİ:');
boxShadows.slice(0, 10).forEach(shadow => console.log(`  - ${shadow}`));

// Tailwind config formatında çıktı oluştur
const tailwindConfig = {
  colors: colors.reduce((acc, color, index) => {
    // Hex renkleri için isim oluştur
    if (color.startsWith('#')) {
      acc[`color-${index}`] = color;
    }
    return acc;
  }, {}),
  fontFamily: {
    euclid: ["'Euclid Circular B'", 'sans-serif'],
  },
};

console.log('\n=== TAILWIND CONFIG ÖRNEĞİ ===');
console.log(JSON.stringify(tailwindConfig, null, 2));




