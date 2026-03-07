@echo off
chcp 65001 >nul
setlocal
cd /d "D:\FLOOVON"
echo ========================================
echo  Degisiklikleri GitHub'a gonder (push)
echo ========================================
git add -A
git status
echo.
set /p MSG="Commit mesaji (bos birakirsan: guncel): "
if "%MSG%"=="" set MSG=guncel
git commit -m "%MSG%"
if errorlevel 1 (
    echo Commit atlandi veya hata.
) else (
    git push origin main
)
echo.
echo Bitti. Sunucudaki dosyalar HENUZ guncellenmedi - sunucuya deploy icin 13 numarali bat'i calistirin.
pause
