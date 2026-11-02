$ErrorActionPreference = 'Stop'
python packaging/windows/prepare_examples.py
if ($LASTEXITCODE -ne 0) { throw 'Public examples integrity failed' }
& ./demos/anatheos-local-v0.5/obtener_atlas_spl.ps1
python -m PyInstaller --noconfirm --clean --onedir --name ANATHEOS --paths packaging/windows --paths research/anatheos-cmr/r2 --paths research/anatheos-cmr/w1 --hidden-import entry --hidden-import preparar_todas_las_series --hidden-import servidor_anatheos_unificado --collect-all PIL --collect-all numpy --add-data 'demos/anatheos-local-v0.5;demos/anatheos-local-v0.5' --add-data 'research/anatheos-cmr/r2;research/anatheos-cmr/r2' packaging/windows/private_entry.py
if ($LASTEXITCODE -ne 0) { throw 'Frozen build failed' }
New-Item -ItemType Directory -Force dist/ANATHEOS/THIRD_PARTY | Out-Null
python packaging/windows/notices.py
if ($LASTEXITCODE -ne 0) { throw 'License capture failed' }
python packaging/windows/package_private.py
if ($LASTEXITCODE -ne 0) { throw 'Private package failed' }
& dist/ANATHEOS/ANATHEOS.exe --self-test
if ($LASTEXITCODE -ne 0) { throw 'Frozen integrity/JPEG2000 self test failed' }
