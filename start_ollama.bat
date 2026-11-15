@echo off
set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
title [1/4] Server NLP Ollama GPU - Kelompok 4
if not exist "%ROOT_DIR%\ollama_models" mkdir "%ROOT_DIR%\ollama_models"
taskkill /F /IM "ollama app.exe" /T 2>nul
taskkill /F /IM ollama.exe /T 2>nul
set "OLLAMA_MODELS=%ROOT_DIR%\ollama_models"
set "OLLAMA_FLASH_ATTENTION=1"
set "OLLAMA_NUM_PARALLEL=1"
set "OLLAMA_MAX_LOADED_MODELS=1"
set "OLLAMA_CMD=ollama"
where ollama >nul 2>&1
if errorlevel 1 (
    if exist "%ROOT_DIR%\apps\Ollama\ollama.exe" (
        set "OLLAMA_CMD=%ROOT_DIR%\apps\Ollama\ollama.exe"
    ) else if exist "%LocalAppData%\Programs\Ollama\ollama.exe" (
        set "OLLAMA_CMD=%LocalAppData%\Programs\Ollama\ollama.exe"
    )
)
:loop
echo Menjalankan Server NLP Ollama di GPU...
"%OLLAMA_CMD%" serve
echo Server Ollama terhenti, menyalakan ulang otomatis dalam 2 detik...
timeout /t 2 >nul
goto loop
