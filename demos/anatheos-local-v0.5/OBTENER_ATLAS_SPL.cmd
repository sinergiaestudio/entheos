@echo off
setlocal
cd /d "%~dp0"
echo ATENCION: esta operacion requiere Internet solo para descargar archivos PUBLICOS del atlas SPL.
echo No se suben estudios ni archivos locales. Los modelos quedan en ATLAS_SPL.
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0obtener_atlas_spl.ps1"
if errorlevel 1 (echo Error de descarga o integridad del atlas & pause)
pause
