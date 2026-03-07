@echo off
chcp 65001 >nul
setlocal
cd /d "D:\FLOOVON"
echo ========================================
echo  GitHub'dan degisiklikleri cek (pull)
echo ========================================
git pull origin main
echo.
echo Bitti. Cikis: %ERRORLEVEL%
pause
