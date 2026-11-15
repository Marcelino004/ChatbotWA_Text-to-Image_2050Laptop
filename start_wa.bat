@echo off
set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
title [4/4] WhatsApp Bridge - Kelompok 4
set "TEMP=%ROOT_DIR%\cache\temp"
set "TMP=%ROOT_DIR%\cache\temp"
set "PUPPETEER_CACHE_DIR=%ROOT_DIR%\cache\puppeteer"
cd /d "%ROOT_DIR%\wa_bridge"
node bridge.js
pause
