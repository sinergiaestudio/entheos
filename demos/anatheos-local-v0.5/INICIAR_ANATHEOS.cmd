@echo off
setlocal
cd /d "%~dp0"
title ANATHEOS 3D v0.5 - Local
echo.
echo ANATHEOS 3D v0.5 - Investigacion, no diagnostico
echo Este servidor responde solo a 127.0.0.1 y NO sube archivos.
echo Para detenerlo, presiona Ctrl+C o cierra esta ventana.
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor_local.ps1"
if errorlevel 1 (
  echo.
  echo ERROR: no se inicio el servidor local. Ejecuta DIAGNOSTICO_ANATHEOS.cmd
  pause
)
