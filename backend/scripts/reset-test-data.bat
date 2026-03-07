@echo off
REM Test Verilerini Sıfırla - Windows Batch Script
REM Bu script test için tüm organizasyon kartlarını ve sipariş kartlarını
REM aktif duruma getirir (arşivlenmemiş, teslim edilmemiş).

echo.
echo ========================================
echo   TEST VERILERINI SIFIRLA
echo ========================================
echo.

REM Backend dizinine git
cd /d "%~dp0.."

REM Node.js scriptini çalıştır
node scripts/reset-test-data.js

REM Hata kontrolü
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Hata: Script başarısız oldu!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ✅ İşlem tamamlandı!
echo.
pause




































