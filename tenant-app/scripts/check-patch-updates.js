/**
 * Patch/Minor güncellemeleri kontrol et
 * Major update'leri filtreler
 */
const { execSync } = require('child_process');

console.log('⚠️  Patch/Minor güncellemeleri kontrol ediliyor (Major update yapılmaz)...\n');

try {
  const output = execSync('npm outdated --json', { encoding: 'utf8' });
  const outdated = JSON.parse(output);
  
  const patchMinor = [];
  const major = [];
  
  Object.keys(outdated).forEach(pkg => {
    const info = outdated[pkg];
    const currentMajor = info.current.split('.')[0];
    const wantedMajor = info.wanted.split('.')[0];
    const latestMajor = info.latest.split('.')[0];
    
    // Major update varsa listele ama öner
    if (latestMajor !== currentMajor) {
      major.push({
        name: pkg,
        current: info.current,
        latest: info.latest,
        major: latestMajor
      });
    } else if (info.wanted !== info.current) {
      // Patch/Minor update
      patchMinor.push({
        name: pkg,
        current: info.current,
        wanted: info.wanted,
        latest: info.latest
      });
    }
  });
  
  if (patchMinor.length > 0) {
    console.log('📦 Patch/Minor güncellenebilir paketler:');
    patchMinor.forEach(pkg => {
      console.log(`   ${pkg.name}: ${pkg.current} → ${pkg.wanted} (latest: ${pkg.latest})`);
    });
    console.log('\n💡 Güncellemek için: npm update <package> --save-exact');
  } else {
    console.log('✅ Patch/Minor güncelleme yok');
  }
  
  if (major.length > 0) {
    console.log('\n⚠️  Major güncellemeler mevcut (bu script ile güncellenmez):');
    major.forEach(pkg => {
      console.log(`   ${pkg.name}: ${pkg.current} → ${pkg.latest} (Major v${pkg.major})`);
    });
    console.log('\n💡 Major update için: DEPENDENCY_POLICY.md dosyasına bakın');
  }
  
} catch (error) {
  if (error.status === 1) {
    // npm outdated exit code 1 = outdated packages var (normal)
    console.log('ℹ️  Güncelleme kontrolü tamamlandı');
  } else {
    console.error('❌ Hata:', error.message);
    process.exit(1);
  }
}




































