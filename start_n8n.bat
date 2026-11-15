@echo off
set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
title [3/4] Server n8n - Kelompok 4
cd /d "%ROOT_DIR%"
set "TEMP=%ROOT_DIR%\cache\temp"
set "TMP=%ROOT_DIR%\cache\temp"
set "N8N_USER_FOLDER=%ROOT_DIR%\n8n_data"
set "N8N_PORT=5678"
set "N8N_PAYLOAD_SIZE_MAX=100"
set "N8N_DEFAULT_BINARY_DATA_MODE=filesystem"
set "EXECUTIONS_DATA_SAVE_ON_SUCCESS=all"
set "EXECUTIONS_DATA_SAVE_ON_ERROR=all"
set "EXECUTIONS_DATA_SAVE_MANUAL_EXECUTIONS=true"
set "npm_config_cache=%ROOT_DIR%\cache\npm"
if exist "%ROOT_DIR%\n8n_app\node_modules\.bin\n8n.cmd" (
    cd /d "%ROOT_DIR%\n8n_app"
    .\node_modules\.bin\n8n start
) else (
    npx n8n
)
pause
