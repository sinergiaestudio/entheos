@echo off
setlocal
cd /d "%~dp0"
echo ANATHEOS experimental - ZIP DICOM original - uso local
echo El primer inicio descarga dependencias libres en una carpeta aislada.
echo Se requiere Python 3.11 o superior e Internet solo para esa instalacion inicial.
echo El estudio clinico no se envia a Internet.
where py >nul 2>nul
if errorlevel 1 (
  echo Falta Python para Windows. Instala Python 3.11+ desde python.org.
  pause
  exit /b 1
)
if not exist "%~dp0.runtime-w1\Scripts\python.exe" (
  py -3 -m venv "%~dp0.runtime-w1"
  if errorlevel 1 goto failed
)
"%~dp0.runtime-w1\Scripts\python.exe" -c "import numpy; import PIL; from PIL import features; assert features.check('jpg_2000')" >nul 2>nul
if errorlevel 1 (
  "%~dp0.runtime-w1\Scripts\python.exe" -m pip install --disable-pip-version-check "numpy==2.2.6" "Pillow==11.3.0"
  if errorlevel 1 goto failed
)
"%~dp0.runtime-w1\Scripts\python.exe" "%~dp0research\anatheos-cmr\w1\servidor_anatheos_unificado.py" --open-browser
if errorlevel 1 goto failed
exit /b 0
:failed
echo No se pudo iniciar ANATHEOS W1. No se modificaron estudios originales.
pause
exit /b 1
