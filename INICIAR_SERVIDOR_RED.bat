@echo off
title BANCA EL CASTANO - SERVIDOR CENTRAL MULTIEQUIPO
color 0A
cd /d "%~dp0"
echo ========================================================================
echo   INICIANDO SERVIDOR CENTRAL EN RED LOCAL (BANCA EL CASTANO)
echo ========================================================================
echo.
start "" "http://localhost:3000/admin.html"
node server.js
pause
