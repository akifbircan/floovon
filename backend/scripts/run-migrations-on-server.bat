@echo off
REM Sunucuda migration'ları çalıştırmak için Windows batch script
REM 
REM Kullanım:
REM   scripts\run-migrations-on-server.bat

echo 🔄 Sunucuda migration'lar çalıştırılıyor...
echo.

REM Backend dizinine git
cd /d "%~dp0.."

REM Veritabanı dosyasının var olduğunu kontrol et
if not exist "floovon_professional.db" (
    echo ❌ Veritabanı dosyası bulunamadı: floovon_professional.db
    exit /b 1
)

REM Node.js'in yüklü olduğunu kontrol et
where node >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js bulunamadı!
    exit /b 1
)

REM Migration'ları çalıştır
echo 📋 Migration'lar başlatılıyor...
node run-migrations.js

if errorlevel 1 (
    echo.
    echo ❌ Migration hatası oluştu!
    exit /b 1
) else (
    echo.
    echo ✅ Migration'lar başarıyla tamamlandı!
)

