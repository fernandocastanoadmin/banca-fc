@echo off
title BANCA EL CASTANO - SERVIDOR CENTRAL MULTIEQUIPO
color 0A
cd /d "%~dp0"
echo ========================================================================
echo   INICIANDO SERVIDOR CENTRAL EN RED LOCAL (BANCA EL CASTANO)
echo   - Programa Administrativo General (Banca Macro): http://localhost:3000/banca.html
echo   - Programa Administrativo Receptor (El Castano): http://localhost:3000/admin.html
echo   - Taquilla POS: http://localhost:3000/index.html
echo ========================================================================
echo.
start "" "http://localhost:3000/banca.html"
start "" "http://localhost:3000/admin.html"
node server.js
pause
