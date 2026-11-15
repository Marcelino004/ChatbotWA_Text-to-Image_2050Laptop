@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

title Setup Otomatis - Kelompok 4 AI Image Generator Bot
echo ========================================================================
echo   SETUP OTOMATIS - KELOMPOK 4 AI IMAGE GENERATOR BOT (WHATSAPP + N8N)
echo ========================================================================
echo.

rem 1. Buat folder runtime lokal jika belum ada
for %%D in (
    "cache\temp"
    "cache\pip"
    "cache\npm"
    "cache\puppeteer"
    "n8n_data"
    "ollama_models"
) do (
    if not exist "%ROOT_DIR%\%%~D" mkdir "%ROOT_DIR%\%%~D"
)

set "TEMP=%ROOT_DIR%\cache\temp"
set "TMP=%ROOT_DIR%\cache\temp"
set "npm_config_cache=%ROOT_DIR%\cache\npm"
set "PUPPETEER_CACHE_DIR=%ROOT_DIR%\cache\puppeteer"
set "N8N_USER_FOLDER=%ROOT_DIR%\n8n_data"
set "OLLAMA_MODELS=%ROOT_DIR%\ollama_models"

rem 2. Cek Node.js, Git, Python 3.10, dan Ollama
echo [1/6] Memeriksa prasyarat sistem...
set "MISSING_TOOLS=0"

set "NODE_EXE="
where node >nul 2>&1 && set "NODE_EXE=node"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" (
    set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
)
if not defined NODE_EXE (
    echo   [X] Node.js LTS belum terpasang.
    set "MISSING_TOOLS=1"
) else (
    echo   [OK] Node.js terdeteksi.
)

set "GIT_EXE="
where git >nul 2>&1 && set "GIT_EXE=git"
if not defined GIT_EXE if exist "%ProgramFiles%\Git\cmd\git.exe" (
    set "GIT_EXE=%ProgramFiles%\Git\cmd\git.exe"
    set "PATH=%ProgramFiles%\Git\cmd;%PATH%"
)
if not defined GIT_EXE (
    echo   [X] Git belum terpasang.
    set "MISSING_TOOLS=1"
) else (
    echo   [OK] Git terdeteksi.
)

set "PYTHON310_EXE="
if exist "%ROOT_DIR%\apps\Python310\python.exe" set "PYTHON310_EXE=%ROOT_DIR%\apps\Python310\python.exe"
if not defined PYTHON310_EXE (
    where py >nul 2>&1
    if not errorlevel 1 (
        for /f "delims=" %%P in ('py -3.10 -c "import sys; print(sys.executable)" 2^>nul') do set "PYTHON310_EXE=%%P"
    )
)
if not defined PYTHON310_EXE if exist "%LocalAppData%\Programs\Python\Python310\python.exe" set "PYTHON310_EXE=%LocalAppData%\Programs\Python\Python310\python.exe"
if not defined PYTHON310_EXE if exist "C:\Python310\python.exe" set "PYTHON310_EXE=C:\Python310\python.exe"
if not defined PYTHON310_EXE (
    where python >nul 2>&1
    if not errorlevel 1 (
        python -c "import sys; sys.exit(0 if sys.version_info[:2]==(3,10) else 1)" >nul 2>&1
        if not errorlevel 1 (
            for /f "delims=" %%P in ('where python') do if not defined PYTHON310_EXE set "PYTHON310_EXE=%%P"
        )
    )
)
if not defined PYTHON310_EXE (
    echo   [X] Python 3.10 belum terpasang ^(wajib Python 3.10 untuk Stable Diffusion WebUI^).
    set "MISSING_TOOLS=1"
) else (
    echo   [OK] Python 3.10: !PYTHON310_EXE!
)

set "OLLAMA_EXE="
where ollama >nul 2>&1 && set "OLLAMA_EXE=ollama"
if not defined OLLAMA_EXE if exist "%ROOT_DIR%\apps\Ollama\ollama.exe" set "OLLAMA_EXE=%ROOT_DIR%\apps\Ollama\ollama.exe"
if not defined OLLAMA_EXE if exist "%LocalAppData%\Programs\Ollama\ollama.exe" set "OLLAMA_EXE=%LocalAppData%\Programs\Ollama\ollama.exe"
if not defined OLLAMA_EXE (
    echo   [X] Ollama belum terpasang.
    set "MISSING_TOOLS=1"
) else (
    echo   [OK] Ollama terdeteksi.
)

if "%MISSING_TOOLS%"=="1" (
    echo.
    echo Beberapa prasyarat belum terpasang.
    where winget >nul 2>&1
    if not errorlevel 1 (
        choice /C YN /M "Install prasyarat yang kurang secara otomatis via winget sekarang?"
        if errorlevel 2 goto :manual_prereqs
        if not defined NODE_EXE winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
        if not defined GIT_EXE winget install -e --id Git.Git --accept-source-agreements --accept-package-agreements
        if not defined PYTHON310_EXE winget install -e --id Python.Python.3.10 --accept-source-agreements --accept-package-agreements
        if not defined OLLAMA_EXE winget install -e --id Ollama.Ollama --accept-source-agreements --accept-package-agreements
        echo.
        echo Prasyarat selesai diinstall. Tutup jendela ini lalu jalankan ulang SETUP.bat agar PATH terbaca.
        pause
        exit /b 1
    )
:manual_prereqs
    echo Silakan install manual terlebih dahulu:
    echo   - Node.js LTS : https://nodejs.org/
    echo   - Git         : https://git-scm.com/downloads
    echo   - Python 3.10 : https://www.python.org/downloads/release/python-3106/
    echo   - Ollama      : https://ollama.com/download
    echo Setelah terpasang, jalankan ulang SETUP.bat.
    pause
    exit /b 1
)

rem 3. Install dependensi WhatsApp Bridge
echo.
echo [2/6] Menyiapkan dependensi WhatsApp Bridge...
if exist "%ROOT_DIR%\wa_bridge\node_modules\whatsapp-web.js" (
    echo   [OK] node_modules wa_bridge sudah ada.
) else (
    cd /d "%ROOT_DIR%\wa_bridge"
    call npm install
    if errorlevel 1 (
        echo   [GAGAL] npm install pada wa_bridge gagal.
        pause
        exit /b 1
    )
)

rem 4. Install dependensi n8n
echo.
echo [3/6] Menyiapkan dependensi n8n...
if exist "%ROOT_DIR%\n8n_app\node_modules\.bin\n8n.cmd" (
    echo   [OK] node_modules n8n_app sudah ada.
) else (
    cd /d "%ROOT_DIR%\n8n_app"
    call npm install
    if errorlevel 1 (
        echo   [GAGAL] npm install pada n8n_app gagal.
        pause
        exit /b 1
    )
)

rem 5. Impor & aktifkan workflow n8n jika database lokal belum ada
echo.
echo [4/6] Menyiapkan workflow n8n...
if exist "%ROOT_DIR%\n8n_data\.n8n\database.sqlite" (
    echo   [OK] Database n8n lokal sudah ada ^(tidak ditimpa^).
) else (
    echo   Mengimpor dan mengaktifkan workflows\pipeline-sains-data.json ...
    cd /d "%ROOT_DIR%\n8n_app"
    call ".\node_modules\.bin\n8n.cmd" import:workflow --input="%ROOT_DIR%\workflows\pipeline-sains-data.json"
    if errorlevel 1 (
        echo   [PERINGATAN] Gagal impor otomatis. Anda bisa impor manual workflows\pipeline-sains-data.json lewat UI n8n.
    ) else (
        call ".\node_modules\.bin\n8n.cmd" publish:workflow --id=kelompok4-aigen-bot
        echo   [OK] Workflow n8n berhasil diimpor dan diaktifkan!
    )
)

rem 6. Unduh model Ollama qwen2.5:1.5b ke ollama_models jika belum ada
echo.
echo [5/6] Memeriksa model LLM Ollama ^(qwen2.5:1.5b^)...
if exist "%ROOT_DIR%\ollama_models\manifests\registry.ollama.ai\library\qwen2.5\1.5b" (
    echo   [OK] Model qwen2.5:1.5b sudah tersedia.
) else (
    echo   Menyiapkan server sementara Ollama untuk mengunduh qwen2.5:1.5b ...
    taskkill /F /IM "ollama app.exe" /T >nul 2>&1
    taskkill /F /IM ollama.exe /T >nul 2>&1
    start "" /B "%OLLAMA_EXE%" serve >nul 2>&1
    timeout /t 4 /nobreak >nul
    "%OLLAMA_EXE%" pull qwen2.5:1.5b
    set "PULL_ERR=!errorlevel!"
    taskkill /F /IM ollama.exe /T >nul 2>&1
    if not "!PULL_ERR!"=="0" (
        echo   [GAGAL] Gagal mengunduh qwen2.5:1.5b. Pastikan koneksi internet aktif lalu jalankan ulang SETUP.bat.
        pause
        exit /b 1
    )
    echo   [OK] Model qwen2.5:1.5b siap!
)

rem 7. Siapkan Stable Diffusion WebUI + checkpoint DreamShaper 8
echo.
echo [6/6] Menyiapkan Stable Diffusion WebUI dan model DreamShaper 8...
if exist "%ROOT_DIR%\stable-diffusion-webui\launch.py" (
    echo   [OK] Folder stable-diffusion-webui sudah ada.
) else (
    echo   Mengkloning AUTOMATIC1111 stable-diffusion-webui ^(v1.10.1^)...
    git clone --branch v1.10.1 --depth 1 https://github.com/AUTOMATIC1111/stable-diffusion-webui.git "%ROOT_DIR%\stable-diffusion-webui"
    if errorlevel 1 (
        echo   [GAGAL] Clone stable-diffusion-webui gagal.
        pause
        exit /b 1
    )
)

if not exist "%ROOT_DIR%\stable-diffusion-webui\webui-user.bat" (
    (
        echo @echo off
        echo set "ROOT_DIR=%%~dp0.."
        echo set "TEMP=%%ROOT_DIR%%\cache\temp"
        echo set "TMP=%%ROOT_DIR%%\cache\temp"
        echo set "PIP_CACHE_DIR=%%ROOT_DIR%%\cache\pip"
        echo set "PIP_NO_BUILD_ISOLATION=1"
        echo set "STABLE_DIFFUSION_REPO=https://github.com/w-e-w/stablediffusion.git"
        echo set "PYTHON=!PYTHON310_EXE!"
        echo set "GIT="
        echo set "VENV_DIR=%%~dp0venv"
        echo set "COMMANDLINE_ARGS=--api --medvram --xformers --no-half-vae --opt-split-attention"
        echo call webui.bat
    ) > "%ROOT_DIR%\stable-diffusion-webui\webui-user.bat"
    echo   [OK] webui-user.bat dibuat otomatis.
)

if not exist "%ROOT_DIR%\stable-diffusion-webui\config.json" (
    (
        echo {
        echo     "sd_model_checkpoint": "dreamshaper_8.safetensors"
        echo }
    ) > "%ROOT_DIR%\stable-diffusion-webui\config.json"
)

set "SD_MODELS_DIR=%ROOT_DIR%\stable-diffusion-webui\models\Stable-diffusion"
if not exist "%SD_MODELS_DIR%" mkdir "%SD_MODELS_DIR%"
if exist "%SD_MODELS_DIR%\dreamshaper_8.safetensors" (
    echo   [OK] Checkpoint dreamshaper_8.safetensors sudah tersedia.
) else (
    echo   Mengunduh dreamshaper_8.safetensors ^(~2.1 GB^) dari HuggingFace...
    curl.exe -L --fail -C - --progress-bar -o "%SD_MODELS_DIR%\dreamshaper_8.safetensors.part" "https://huggingface.co/digiplay/DreamShaper_8/resolve/main/dreamshaper_8.safetensors"
    if errorlevel 1 (
        echo   [GAGAL] Unduhan dreamshaper_8.safetensors terhenti. Jalankan ulang SETUP.bat untuk melanjutkan ^(resume^).
        pause
        exit /b 1
    )
    move /Y "%SD_MODELS_DIR%\dreamshaper_8.safetensors.part" "%SD_MODELS_DIR%\dreamshaper_8.safetensors" >nul
    echo   [OK] dreamshaper_8.safetensors berhasil diunduh!
)

echo.
echo ========================================================================
echo   SETUP SELESAI!
echo   Langkah berikutnya:
echo   1. Jalankan JALANKAN_SEMUA.bat
echo   2. Tunggu 4 jendela terminal aktif ^(jendela Stable Diffusion pertama kali
echo      akan mengunduh dependensi PyTorch/venv beberapa menit^).
echo   3. Scan QR Code WhatsApp yang muncul di jendela [4/4] WhatsApp Bridge.
echo ========================================================================
echo.
if /i not "%~1"=="--from-launcher" pause
exit /b 0
