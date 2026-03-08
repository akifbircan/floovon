#!/bin/bash
# Sunucuda migration'ları çalıştırmak için script
#
# UYARI: Sunucu DB'nizi local ile aynı tutuyorsanız (FTP ile aynı .db atıyorsanız)
#        bu script'i deploy sırasında ÇAĞIRMAYIN. Sadece şema değişikliği yaptığınızda manuel çalıştırın.
#
# Kullanım:
#   bash scripts/run-migrations-on-server.sh
#   veya
#   ssh kullanici@sunucu "cd /path/to/backend && bash -s" < scripts/run-migrations-on-server.sh

set -e  # Hata durumunda dur

echo "🔄 Sunucuda migration'lar çalıştırılıyor..."
echo ""

# Backend dizinine git
cd "$(dirname "$0")/.." || exit 1

# Veritabanı dosyasının var olduğunu kontrol et
if [ ! -f "floovon_professional.db" ]; then
    echo "❌ Veritabanı dosyası bulunamadı: floovon_professional.db"
    exit 1
fi

# Node.js'in yüklü olduğunu kontrol et
if ! command -v node &> /dev/null; then
    echo "❌ Node.js bulunamadı!"
    exit 1
fi

# Migration'ları çalıştır
echo "📋 Migration'lar başlatılıyor..."
node run-migrations.js

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration'lar başarıyla tamamlandı!"
else
    echo ""
    echo "❌ Migration hatası oluştu!"
    exit 1
fi

