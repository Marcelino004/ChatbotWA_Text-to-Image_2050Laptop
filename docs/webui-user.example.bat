@echo off
rem Contoh konfigurasi untuk stable-diffusion-webui\webui-user.bat
rem Letakkan file ini di folder stable-diffusion-webui\ sebagai webui-user.bat dan sesuaikan path Python Anda.

set "ROOT_DIR=%~dp0.."
set "TEMP=%ROOT_DIR%\cache\temp"
set "TMP=%ROOT_DIR%\cache\temp"
set "PIP_CACHE_DIR=%ROOT_DIR%\cache\pip"
set "PIP_NO_BUILD_ISOLATION=1"
set "STABLE_DIFFUSION_REPO=https://github.com/w-e-w/stablediffusion.git"
set "PYTHON=%ROOT_DIR%\apps\Python310\python.exe"
set "GIT="
set "VENV_DIR=%~dp0venv"
set "COMMANDLINE_ARGS=--api --medvram --xformers --no-half-vae --opt-split-attention"
call webui.bat
