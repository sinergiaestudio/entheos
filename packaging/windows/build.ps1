$ErrorActionPreference = 'Stop'
& ./demos/anatheos-local-v0.5/obtener_atlas_spl.ps1
python -m PyInstaller --noconfirm --clean --onedir --name ANATHEOS --paths research/anatheos-cmr/r2 --paths research/anatheos-cmr/w1 --hidden-import preparar_todas_las_series --hidden-import servidor_anatheos_unificado --collect-all PIL --collect-all numpy --add-data 'demos/anatheos-local-v0.5;demos/anatheos-local-v0.5' --add-data 'research/anatheos-cmr/r2;research/anatheos-cmr/r2' packaging/windows/entry.py
if ($LASTEXITCODE -ne 0) { throw 'PyInstaller failed' }
& dist/ANATHEOS/ANATHEOS.exe --self-test
if ($LASTEXITCODE -ne 0) { throw 'Frozen JPEG2000 self test failed' }
New-Item -ItemType Directory -Force dist/ANATHEOS/THIRD_PARTY | Out-Null
python packaging/windows/notices.py
'{"version":"0.10.0-beta"}' | Set-Content -Encoding ascii dist/ANATHEOS/version.json
python packaging/windows/manifest.py
& 'C:/Program Files (x86)/NSIS/makensis.exe' /DVERSION=0.10.0-beta packaging/windows/installer.nsi
if ($LASTEXITCODE -ne 0) { throw 'NSIS failed' }
Get-FileHash dist/ANATHEOS-Setup-0.10.0-beta.exe -Algorithm SHA256 | ForEach-Object { "$($_.Hash.ToLower())  ANATHEOS-Setup-0.10.0-beta.exe" } | Set-Content dist/SHA256SUMS.txt
