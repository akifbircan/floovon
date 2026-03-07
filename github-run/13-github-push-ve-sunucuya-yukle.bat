@echo off
chcp 65001 >nul
setlocal
cd /d "D:\FLOOVON"
echo ========================================
echo  GitHub Push + Sunucuya Yukle
echo ========================================

REM 1) Commit + Push
git add -A
git status
set /p MSG="Commit mesaji (bos: guncel): "
if "%MSG%"=="" set MSG=guncel
git commit -m "%MSG%"
if errorlevel 1 (
    echo Commit atlandi veya hata. Yine de sunucu guncellemesi denenebilir.
) else (
    git push origin main
)

REM 2) Sunucu config
set CONFIG=%~dp0sunucu-config.txt
if not exist "%CONFIG%" (
    echo.
    echo [UYARI] sunucu-config.txt bulunamadi!
    echo   %CONFIG%
    echo   sunucu-config.ornek.txt dosyasini "sunucu-config.txt" olarak kopyalayip host/user/path doldurun.
    echo.
    echo Sunucuda MANUEL calistirin:
    echo   cd /home/floovon/htdocs/panel.floovon.com
    echo   git pull origin main
    echo   cd backend ^&^& npm install --omit=dev
    echo   cd ../tenant-app ^&^& npm run build
    echo   cd .. ^&^& pm2 restart floovon-backend --update-env
    goto end
)

set host=
set user=
set remotepath=
for /f "usebackq eol=# tokens=1,* delims==" %%a in ("%CONFIG%") do set "%%a=%%b"
if "%user%"=="" (
    echo sunucu-config.txt icinde user= tanimli degil.
    goto end
)
if "%host%"=="" (
    echo sunucu-config.txt icinde host= tanimli degil.
    goto end
)
if "%remotepath%"=="" (
    echo sunucu-config.txt icinde remotepath= tanimli degil.
    goto end
)

REM 3) SSH ile sunucuda komutlari calistir
echo.
echo Sunucuya baglaniliyor: %user%@%host%
echo Proje yolu: %remotepath%
echo.
set REMOTE_CMD=cd %remotepath% && git pull origin main && cd backend && npm install --omit=dev && cd ../tenant-app && npm run build && cd .. && pm2 restart floovon-backend --update-env
ssh %user%@%host% "%REMOTE_CMD%"
if errorlevel 1 (
    echo SSH veya uzak komut hata verdi. Sunucuda yukaridaki komutlari elle calistirin.
) else (
    echo.
    echo Sunucu guncellendi.
)

:end
echo.
pause
