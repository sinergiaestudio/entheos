@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0detener_anatheos.ps1"
if errorlevel 1 (
 echo.
 echo No se pudo cerrar automaticamente. Usa Ctrl+C en la ventana de ANATHEOS.
 pause
)
