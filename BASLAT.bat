@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title FLOOVON Baslatici

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

echo.
echo  ============================================================
echo   FLOOVON - Backend (3001) + Tenant Panel (5174)
echo  ============================================================
echo.
echo   Acilacak pencereler:
echo     1. Backend  (3001) - API, veritabani, auth
echo     2. Panel    (5174) - React dev, hot reload
echo.
echo   Tarayici: http://localhost:5174
echo   API:      http://localhost:3001/api
echo  ============================================================
echo.

:: Proje klasorlerini kontrol et
if not exist "%ROOT%\backend\simple-server.js" (
    echo  HATA: backend\simple-server.js bulunamadi.
    echo  Dizin: %ROOT%
    pause
    exit /b 1
)
if not exist "%ROOT%\tenant-app\package.json" (
    echo  HATA: tenant-app\package.json bulunamadi.
    echo  Dizin: %ROOT%
    pause
    exit /b 1
)

:: Sadece 3001 portunda DINLEYEN process'i kapat (5174/Vite'a dokunma)
echo  [1/3] 3001 portu kontrol ediliyor...
powershell -NoProfile -Command "$p=Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue; if($p){$p|%%{Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue}}; Start-Sleep -Seconds 1"
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3001" ^| findstr "LISTENING"') do (
    if not "%%a"=="0" taskkill /F /PID %%a 2>nul
)
timeout /t 2 /nobreak >nul
echo        3001 hazir.
echo.

:: Backend penceresini ac (path icinde tirnak yok - ROOT bosluksuz olmali)
echo  [2/3] Backend baslatiliyor (yeni pencere)...
start "FLOOVON Backend (3001)" cmd /k "cd /d %ROOT%\backend && set PORT=3001 && set JWT_SECRET=floovon-secret-key && npx nodemon simple-server.js"

timeout /t 4 /nobreak >nul

:: Tenant panel (5174) penceresini ac
echo  [3/3] Tenant panel (5174) baslatiliyor (yeni pencere)...
start "FLOOVON Panel (5174)" cmd /k "cd /d %ROOT%\tenant-app && npm run dev"

echo.
echo  ============================================================
echo   Her iki sunucu acildi. Backend ve Panel pencerelerini KAPATMAYIN.
echo   Bu pencereyi kapatabilirsiniz.
echo  ============================================================
echo.
pause
