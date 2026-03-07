/**
 * package-lock.json'dan exact versiyonları çıkar
 * package.json'ı güncellemek için kullanılır
 */
const fs = require('fs');
const path = require('path');

const packageLockPath = path.join(__dirname, '..', 'package-lock.json');
const packageJsonPath = path.join(__dirname, '..', 'package.json');

// package-lock.json'ı oku
const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Root package'ın dependencies ve devDependencies'lerini al
const rootDeps = packageLock.packages[''] || {};
const allDeps = { ...rootDeps.dependencies, ...rootDeps.devDependencies };

// node_modules'den exact versiyonları çıkar
const exactVersions = {};

Object.keys(allDeps).forEach(depName => {
  const depPath = `node_modules/${depName}`;
  const depInfo = packageLock.packages[depPath];
  
  if (depInfo && depInfo.version) {
    exactVersions[depName] = depInfo.version;
  } else {
    // Nested dependency olabilir, root'tan bak
    const rootDepInfo = packageLock.packages[depName];
    if (rootDepInfo && rootDepInfo.version) {
      exactVersions[depName] = rootDepInfo.version;
    } else {
      console.warn(`⚠️  ${depName} için versiyon bulunamadı`);
    }
  }
});

// package.json'ı güncelle
let updated = false;
let updatedCount = 0;

// Dependencies
if (packageJson.dependencies) {
  Object.keys(packageJson.dependencies).forEach(depName => {
    if (exactVersions[depName]) {
      const oldVersion = packageJson.dependencies[depName];
      const newVersion = exactVersions[depName];
      
      // ^ veya ~ varsa exact yap
      if (oldVersion.startsWith('^') || oldVersion.startsWith('~')) {
        packageJson.dependencies[depName] = newVersion;
        updated = true;
        updatedCount++;
        console.log(`✅ ${depName}: ${oldVersion} → ${newVersion}`);
      } else if (oldVersion !== newVersion) {
        // Zaten exact ama farklı versiyon
        console.log(`ℹ️  ${depName}: ${oldVersion} → ${newVersion} (zaten exact ama versiyon farklı)`);
        packageJson.dependencies[depName] = newVersion;
        updated = true;
        updatedCount++;
      }
    }
  });
}

// DevDependencies
if (packageJson.devDependencies) {
  Object.keys(packageJson.devDependencies).forEach(depName => {
    if (exactVersions[depName]) {
      const oldVersion = packageJson.devDependencies[depName];
      const newVersion = exactVersions[depName];
      
      // ^ veya ~ varsa exact yap
      if (oldVersion.startsWith('^') || oldVersion.startsWith('~')) {
        packageJson.devDependencies[depName] = newVersion;
        updated = true;
        updatedCount++;
        console.log(`✅ ${depName}: ${oldVersion} → ${newVersion}`);
      } else if (oldVersion !== newVersion) {
        // Zaten exact ama farklı versiyon
        console.log(`ℹ️  ${depName}: ${oldVersion} → ${newVersion} (zaten exact ama versiyon farklı)`);
        packageJson.devDependencies[depName] = newVersion;
        updated = true;
        updatedCount++;
      }
    }
  });
}

if (updated) {
  // package.json'ı yaz
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
  console.log(`\n✅ Toplam ${updatedCount} dependency exact yapıldı`);
  console.log(`📝 package.json güncellendi`);
} else {
  console.log(`\nℹ️  Tüm dependency'ler zaten exact veya versiyon bulunamadı`);
}

// Rapor
console.log(`\n📊 RAPOR:`);
console.log(`   - Toplam dependency: ${Object.keys(packageJson.dependencies || {}).length}`);
console.log(`   - Toplam devDependency: ${Object.keys(packageJson.devDependencies || {}).length}`);
console.log(`   - Güncellenen: ${updatedCount}`);

