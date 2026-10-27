@echo off
setlocal
cd /d "%~dp0"
title ANATHEOS 3D - Demo Local v0.1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor_local.ps1"
if errorlevel 1 (
 echo.
 echo No se pudo iniciar el servidor. Abrir index.html directamente como alternativa.
 pause
)
