#!/bin/bash
# PM2'den backend dizinini bul

echo "🔍 PM2'den backend dizini aranıyor..."
pm2 describe floovon-backend | grep "cwd\|script path"

# VEYA daha detaylı:
pm2 show floovon-backend

