"""A SHA-labelled trial ZIP, not a new installed release or an updater."""
import hashlib,json,pathlib,subprocess,zipfile
root=pathlib.Path('dist/ANATHEOS');sha=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
(root/'version.json').write_text(json.dumps({'version':'0.11.1-beta + experimental closure '+sha[:8],'source_sha':sha,'baseline':'0.11.1-beta','private_trial':True,'installer':False}),encoding='utf-8')
(root/'ABRIR-ANATHEOS.cmd').write_text('@echo off\r\ncd /d "%~dp0"\r\nANATHEOS.exe --port 18765 --open-browser\r\npause\r\n',encoding='ascii')
(root/'LEEME.txt').write_text('''ANATHEOS: prueba privada de cierre, sin instalar ni reemplazar 0.11.1.
1. Extraer TODO el ZIP y cerrar la otra aplicacion ANATHEOS.
2. Abrir ABRIR-ANATHEOS.cmd; mantener la consola abierta.
3. Archivo > Abrir ZIP DICOM o Abrir carpeta DICOM. Elegir serie; Reconstruccion 3D > Elegibilidad y motivos. Abrir Volumen 3D o MPR cuando este habilitado.

Formatos verificados: DICOM Part10 monocromo de 16 bits, Explicit/Implicit VR Little Endian por ZIP/carpeta; RM clasica JPEG2000 lossless por ZIP mediante el procesador local. Otras transferencias, Enhanced/multiframe, RGB, JPEG de pantalla, PDF o videos NO se declaran compatibles. ZIP de TC comprimida no compatible con el decodificador RM. La region corporal no determina elegibilidad: dependen de geometria, adquisicion y tiempo. No fusionar series.

SURVEY compatible: seleccionar serie y Reconstruccion 3D > Volumen + MPR. Camara orientada al paciente, MPR derivadas rotadas para superior arriba cuando esta en el plano. Inspector plegado inicialmente; opciones existentes por menus y un editor a la vez. Arrastrar gira, rueda amplia, Mayus+arrastrar mueve corte; planos ocultables. Datos medidos/nominales/estimados y NO_DATA siguen separados, sin detalle nuevo.

Datos de prueba aislados en LOCALAPPDATA/ANATHEOS-Experimental/study-import-closure/ANATHEOS. No migra, lee ni sobrescribe proyectos/configuracion de la instalacion. Importaciones temporales no equivalen a estudios guardados: conservar los originales. Cerrar consola/pestana y borrar carpeta revierte el portable; no desinstalar la version anterior. Si el puerto 18765 esta ocupado, registrar el error; no cerrar otros programas a ciegas.

No contiene datos clinicos del titular. Los ejemplos publicos conservan licencia y hashes. SPL es otro especimen y NO se aplica a Leeds. Servidor loopback, sin telemetria; cerrar estudios elimina trabajos temporales. Experimental/NO DIAGNOSTICO; cine/fusion y once subpilas privadas mantienen sus gates. Sin Authenticode; no desactivar seguridad global. Windows automatizado no equivale a aceptacion fisica o medica.
''',encoding='utf-8')
manifest={p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*') if p.is_file() and p.name!='manifest.json'}
(root/'manifest.json').write_text(json.dumps(manifest,sort_keys=True),encoding='utf-8')
# ZIP only after the same payload has passed the frozen UI tests; the workflow calls this twice.
out=pathlib.Path('dist')/f'ANATHEOS-Workstation-Private-{sha[:8]}.zip'
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 for p in root.rglob('*'):
  if p.is_file():z.write(p,pathlib.Path('ANATHEOS-Workstation-Private')/p.relative_to(root))
summary={'source_sha':sha,'file':out.name,'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'manifest_files':len(manifest),'installer':False}
pathlib.Path('dist/private-package.json').write_text(json.dumps(summary,indent=2),encoding='utf-8');print(json.dumps(summary))
