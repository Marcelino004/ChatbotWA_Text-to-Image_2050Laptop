@echo off
set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
title Master Launcher - Tugas Kelompok 4 Sains Data

if not exist "%ROOT_DIR%\cache\temp" mkdir "%ROOT_DIR%\cache\temp"
if not exist "%ROOT_DIR%\n8n_data" mkdir "%ROOT_DIR%\n8n_data"
if not exist "%ROOT_DIR%\ollama_models" mkdir "%ROOT_DIR%\ollama_models"

if not exist "%ROOT_DIR%\wa_bridge\node_modules\whatsapp-web.js" goto :run_setup
if not exist "%ROOT_DIR%\n8n_app\node_modules\.bin\n8n.cmd" goto :run_setup
if not exist "%ROOT_DIR%\stable-diffusion-webui\webui-user.bat" goto :run_setup
goto :start_all

:run_setup
echo Instalasi awal belum lengkap, menjalankan SETUP.bat otomatis...
call "%ROOT_DIR%\SETUP.bat" --from-launcher
if errorlevel 1 exit /b 1

:start_all
echo Menjalankan 1/4: Server NLP Ollama GPU...
start "[1/4] Server NLP Ollama GPU" cmd /k "%ROOT_DIR%\start_ollama.bat"
timeout /t 3 /nobreak >nul
echo Menjalankan 2/4: Stable Diffusion WebUI API...
start "[2/4] Stable Diffusion WebUI" /d "%ROOT_DIR%\stable-diffusion-webui" cmd /k "%ROOT_DIR%\stable-diffusion-webui\webui-user.bat"
timeout /t 3 /nobreak >nul
echo Menjalankan 3/4: Server Workflow n8n...
start "[3/4] Server n8n" cmd /k "%ROOT_DIR%\start_n8n.bat"
timeout /t 3 /nobreak >nul
echo Menjalankan 4/4: WhatsApp Bridge...
start "[4/4] WhatsApp Bridge" cmd /k "%ROOT_DIR%\start_wa.bat"
echo Keempat server telah dijalankan!
