/**
 * Backend Dependency Exact Version Converter
 * package-lock.json'dan exact versiyonları çıkarıp package.json'ı günceller
 */

const fs = require('fs');
const path = require('path');

const packageLockPath = path.join(__dirname, '..', 'package-lock.json');
const packageJsonPath = path.join(__dirname, '..', 'package.json');

console.log('📦 Backend Dependency Exact Version Converter\n');

// Dosyaları oku
if (!fs.existsSync(packageLockPath)) {
  console.error('❌ package-lock.json bulunamadı!');
  process.exit(1);
}

if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ package.json bulunamadı!');
  process.exit(1);
}

const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Root package'ın dependencies ve devDependencies'lerini al
const rootPackage = packageLock.packages[''] || {};
const rootDeps = rootPackage.dependencies || {};
const rootDevDeps = rootPackage.devDependencies || {};

// node_modules'den exact versiyonları al (root'ta ^ varsa)
const exactDeps = {};
const exactDevDeps = {};

Object.keys(rootDeps).forEach(depName => {
  const depPath = `node_modules/${depName}`;
  const depInfo = packageLock.packages[depPath];
  if (depInfo && depInfo.version) {
    exactDeps[depName] = depInfo.version;
  } else {
    // Root'taki versiyonu kullan (zaten exact olabilir)
    exactDeps[depName] = rootDeps[depName].replace(/^[\^~]/, '');
  }
});

Object.keys(rootDevDeps).forEach(depName => {
  const depPath = `node_modules/${depName}`;
  const depInfo = packageLock.packages[depPath];
  if (depInfo && depInfo.version) {
    exactDevDeps[depName] = depInfo.version;
  } else {
    // Root'taki versiyonu kullan (zaten exact olabilir)
    exactDevDeps[depName] = rootDevDeps[depName].replace(/^[\^~]/, '');
  }
});

console.log('📋 package-lock.json\'dan exact versiyonlar alınıyor...\n');

// Dönüşüm raporu
const report = {
  updated: [],
  alreadyExact: [],
  notFound: [],
  majorBumps: []
};

// Dependencies'i güncelle
if (packageJson.dependencies) {
  Object.keys(packageJson.dependencies).forEach(depName => {
    const currentVersion = packageJson.dependencies[depName];
    const exactVersion = exactDeps[depName];
    
    if (!exactVersion) {
      report.notFound.push({ name: depName, current: currentVersion });
      console.warn(`⚠️  ${depName}: package-lock.json'da bulunamadı (${currentVersion})`);
      return;
    }
    
    // ^ veya ~ işaretlerini kaldır
    const cleanCurrent = currentVersion.replace(/^[\^~]/, '');
    const cleanExact = exactVersion;
    
    // Major version değişikliği kontrolü
    const currentMajor = parseInt(cleanCurrent.split('.')[0]);
    const exactMajor = parseInt(cleanExact.split('.')[0]);
    
    if (currentMajor !== exactMajor) {
      report.majorBumps.push({
        name: depName,
        from: currentVersion,
        to: exactVersion,
        majorFrom: currentMajor,
        majorTo: exactMajor
      });
    }
    
    if (currentVersion.startsWith('^') || currentVersion.startsWith('~')) {
      packageJson.dependencies[depName] = exactVersion;
      report.updated.push({ name: depName, from: currentVersion, to: exactVersion });
      console.log(`✅ ${depName}: ${currentVersion} → ${exactVersion}`);
    } else if (currentVersion !== exactVersion) {
      // Zaten exact ama farklı versiyon (lockfile'dan gelen güncel versiyon)
      packageJson.dependencies[depName] = exactVersion;
      report.updated.push({ name: depName, from: currentVersion, to: exactVersion });
      console.log(`🔄 ${depName}: ${currentVersion} → ${exactVersion} (lockfile'dan güncellendi)`);
    } else {
      report.alreadyExact.push({ name: depName, version: currentVersion });
    }
  });
}

// DevDependencies'i güncelle
if (packageJson.devDependencies) {
  Object.keys(packageJson.devDependencies).forEach(depName => {
    const currentVersion = packageJson.devDependencies[depName];
    const exactVersion = exactDevDeps[depName];
    
    if (!exactVersion) {
      report.notFound.push({ name: depName, current: currentVersion });
      console.warn(`⚠️  ${depName}: package-lock.json'da bulunamadı (${currentVersion})`);
      return;
    }
    
    // ^ veya ~ işaretlerini kaldır
    const cleanCurrent = currentVersion.replace(/^[\^~]/, '');
    const cleanExact = exactVersion;
    
    // Major version değişikliği kontrolü
    const currentMajor = parseInt(cleanCurrent.split('.')[0]);
    const exactMajor = parseInt(cleanExact.split('.')[0]);
    
    if (currentMajor !== exactMajor) {
      report.majorBumps.push({
        name: depName,
        from: currentVersion,
        to: exactVersion,
        majorFrom: currentMajor,
        majorTo: exactMajor
      });
    }
    
    if (currentVersion.startsWith('^') || currentVersion.startsWith('~')) {
      packageJson.devDependencies[depName] = exactVersion;
      report.updated.push({ name: depName, from: currentVersion, to: exactVersion });
      console.log(`✅ ${depName}: ${currentVersion} → ${exactVersion}`);
    } else if (currentVersion !== exactVersion) {
      // Zaten exact ama farklı versiyon
      packageJson.devDependencies[depName] = exactVersion;
      report.updated.push({ name: depName, from: currentVersion, to: exactVersion });
      console.log(`🔄 ${depName}: ${currentVersion} → ${exactVersion} (lockfile'dan güncellendi)`);
    } else {
      report.alreadyExact.push({ name: depName, version: currentVersion });
    }
  });
}

// package.json'ı güncelle
if (report.updated.length > 0) {
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
  console.log(`\n✅ package.json güncellendi (${report.updated.length} dependency exact yapıldı)`);
} else {
  console.log(`\nℹ️  Tüm dependency'ler zaten exact`);
}

// Rapor
console.log('\n📊 DÖNÜŞÜM RAPORU:');
console.log(`   ✅ Güncellenen: ${report.updated.length}`);
console.log(`   ✓ Zaten exact: ${report.alreadyExact.length}`);
console.log(`   ⚠️  Bulunamayan: ${report.notFound.length}`);
console.log(`   🔴 Major bump: ${report.majorBumps.length}`);

if (report.majorBumps.length > 0) {
  console.log('\n⚠️  MAJOR VERSION DEĞİŞİKLİKLERİ:');
  report.majorBumps.forEach(bump => {
    console.log(`   ${bump.name}: ${bump.from} → ${bump.to} (${bump.majorFrom}.x → ${bump.majorTo}.x)`);
  });
  console.log('\n⚠️  UYARI: Major version değişiklikleri breaking change içerebilir!');
  console.log('   Test edilmeli ve gerekirse geri alınmalı.');
}

if (report.notFound.length > 0) {
  console.log('\n⚠️  PACKAGE-LOCK.JSON\'DA BULUNAMAYAN DEPENDENCY\'LER:');
  report.notFound.forEach(dep => {
    console.log(`   ${dep.name}: ${dep.current}`);
  });
}

console.log('\n📝 Sonraki adımlar:');
console.log('   1. npm ci (temiz kurulum)');
console.log('   2. npm test (varsa)');
console.log('   3. npm run build (varsa)');
console.log('   4. Server\'ı başlatıp health check yap');

