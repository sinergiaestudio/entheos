@echo off
setlocal
cd /d "%~dp0"
call "%~dp0DETENER_ANATHEOS.cmd"
timeout /t 2 /nobreak > nul
call "%~dp0INICIAR_ANATHEOS.cmd"
