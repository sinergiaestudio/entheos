@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0verificar_integridad.ps1"
if errorlevel 1 (
 echo ERROR: integridad no verificada. No continuar.
) else (
 echo Verificacion correcta. Podes iniciar ANATHEOS.
)
pause
