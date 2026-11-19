@echo off
chcp 65001 >nul
echo ========================================================================
echo   BANCA EL CASTANO - SIMULADOR INTERACTIVO DE TELEFONO ANDROID
echo ========================================================================
echo.

set "APP_URL=file:///%~dp0app_movil/index.html"
set "APP_URL=%APP_URL:\=/%"

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  echo [*] Abriendo App en ventana de Telefono Android con Google Chrome...
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="%APP_URL%" --window-size=460,920
  exit /b 0
)

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  echo [*] Abriendo App en ventana de Telefono Android con Microsoft Edge...
  start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="%APP_URL%" --window-size=460,920
  exit /b 0
)

start "" "%~dp0app_movil\index.html"
