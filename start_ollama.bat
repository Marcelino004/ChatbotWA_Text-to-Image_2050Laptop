@echo off
set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
title [1/4] Server NLP Ollama GPU - Kelompok 4
taskkill /F /IM "ollama app.exe" /T 2>nul
taskkill /F /IM ollama.exe /T 2>nul
set "OLLAMA_MODELS=%ROOT_DIR%\ollama_models"
set "OLLAMA_FLASH_ATTENTION=1"
set "OLLAMA_NUM_PARALLEL=1"
set "OLLAMA_MAX_LOADED_MODELS=1"
:loop
echo Menjalankan Server NLP Ollama di GPU...
ollama serve
echo Server Ollama terhenti, menyalakan ulang otomatis dalam 2 detik...
timeout /t 2 >nul
goto loop
