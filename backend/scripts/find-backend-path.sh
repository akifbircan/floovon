#!/bin/bash
# Backend dizinini bulmak için yardımcı script

echo "🔍 Backend dizini aranıyor..."

# Olası yerler
POSSIBLE_PATHS=(
    "/home/akifbircan/backend"
    "/home/akifbircan/www/backend"
    "/home/akifbircan/public_html/backend"
    "/home/akifbircan/domains/*/public_html/backend"
    "/var/www/*/backend"
    "/home/akifbircan/floovon/backend"
    "/home/akifbircan/FLOOVON/backend"
)

for path in "${POSSIBLE_PATHS[@]}"; do
    if [ -d "$path" ] && [ -f "$path/package.json" ]; then
        echo "✅ Bulundu: $path"
        echo ""
        echo "Bu dizine gitmek için:"
        echo "  cd $path"
        exit 0
    fi
done

# find komutu ile ara
echo "📂 Tüm sistemde aranıyor..."
FOUND=$(find /home/akifbircan -name "package.json" -path "*/backend/*" 2>/dev/null | head -1)

if [ -n "$FOUND" ]; then
    BACKEND_DIR=$(dirname "$FOUND")
    echo "✅ Bulundu: $BACKEND_DIR"
    echo ""
    echo "Bu dizine gitmek için:"
    echo "  cd $BACKEND_DIR"
else
    echo "❌ Backend dizini bulunamadı."
    echo ""
    echo "Manuel olarak bulmak için:"
    echo "  find /home/akifbircan -name 'package.json' -type f"
fi

