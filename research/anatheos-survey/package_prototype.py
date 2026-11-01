"""Build an isolated read-only prototype. Private data never goes to the repo/CI."""
import argparse,pathlib,json,hashlib,shutil,zipfile,tempfile,collections
def build(data,out,source_sha):
 here=pathlib.Path(__file__).resolve().parent;repo=here.parents[1];app=repo/'demos/anatheos-local-v0.5'
 catalog=json.loads((data/'catalogo_local_privado.json').read_text());assert len(catalog['series'])==1
 rec=catalog['series'][0];sid=rec['serie_local'];assert rec['modo_seguro']=='localizador_2d' and rec['instancias']==60 and sid.startswith('RM-') and len(sid)==6
 geo=json.loads((data/sid/'geometria_privada.json').read_text());assert len(geo['frames'])==60
 groups=collections.Counter(tuple(round(v,6) for v in f['image_orientation_patient_LPS']) for f in geo['frames']);assert sorted(groups.values())==[20,20,20]
 integrity=json.loads((data/sid/'integridad_R2.json').read_text())
 for name,key in [('geometria_privada.json','geometria_sha256'),('pixels_original_decoded.npy','pixels_sha256')]:assert hashlib.sha256((data/sid/name).read_bytes()).hexdigest()==integrity[key]
 out.parent.mkdir(parents=True,exist_ok=True)
 with tempfile.TemporaryDirectory() as temp:
  root=pathlib.Path(temp)/'ANATHEOS-SURVEY-L0';web=root/'web';web.mkdir(parents=True)
  for p in app.iterdir():
   if p.is_file() and p.suffix in ['.html','.mjs','.js','.css']:shutil.copy2(p,web/p.name)
  shutil.copy2(here/'prototype-bootstrap.mjs',web/'prototype-bootstrap.mjs')
  index=web/'index.html';index.write_text(index.read_text().replace('</body>','<script type="module" src="prototype-bootstrap.mjs"></script></body>'))
  private=web/'survey-data';(private/sid).mkdir(parents=True)
  shutil.copy2(data/'catalogo_local_privado.json',private/'catalogo_local_privado.json')
  for name in ['geometria_privada.json','pixels_original_decoded.npy','integridad_R2.json']:shutil.copy2(data/sid/name,private/sid/name)
  (web/'prototype-version.json').write_text(json.dumps({'prototype':'SURVEY-BASE-L0','source_sha':source_sha,'baseline':'bb86f776afc97eed49c692d8dd7a92aec3a2d9c3','private_data':True}))
  manifest={p.relative_to(web).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in web.rglob('*') if p.is_file()};(web/'manifest.json').write_text(json.dumps(manifest,sort_keys=True))
  for name in ['Start-ANATHEOS-SURVEY-L0.ps1','Start-ANATHEOS-SURVEY-L0.py']:shutil.copy2(here/name,root/name)
  (root/'ABRIR-SURVEY-L0.cmd').write_bytes(b'@echo off\r\ncd /d "%~dp0"\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-ANATHEOS-SURVEY-L0.ps1"\r\npause\r\n')
  (root/'LEEME.txt').write_text('ANATHEOS SURVEY-BASE L0 - PROTOTIPO PRIVADO\n\n1. Extraer todo el ZIP en una carpeta local privada.\n2. Doble clic en ABRIR-SURVEY-L0.cmd (PowerShell de Windows, no necesita Python ni administrador).\n3. En la misma estacion: Abrir mis planos SURVEY L0. Arrastrar para girar; rueda para zoom; controles por orientacion a la derecha. Desmarcar Solo corte seleccionado para mostrar los 60 planos. Escape vuelve a 2D.\n\nNo abrir index.html directamente: los modulos necesitan el servidor local. Cerrar la ventana de consola detiene el prototipo; borrar la carpeta es el rollback. No reemplaza ni modifica ANATHEOS 0.11.1, proyectos o estudios.\n\nContiene datos medicos PRIVADOS. No reenviar ni subir a GitHub/CI/nube publica. Servidor ligado exclusivamente a 127.0.0.1, puerto automatico, sin escritura/ingesta nueva de ZIP. No hay volumen continuo, corazon solido, sincronizacion cardiaca o segmentacion. Los planos conservan posiciones originales; la transparencia es una aproximacion visual.\n\nLa distribucion es experimental sin firma Authenticode. Comparar el SHA-256 del ZIP con el informe antes de ejecutar. No desactivar seguridad global si Windows o una politica institucional bloquea scripts: registrar ese bloqueo.\n',encoding='utf-8')
  files={p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*') if p.is_file()};(root/'SHA256SUMS.json').write_text(json.dumps(files,sort_keys=True))
  with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
   for p in root.rglob('*'):
    if p.is_file():z.write(p,p.relative_to(root.parent))
 return {'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'source_sha':source_sha}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--data',type=pathlib.Path,required=True);p.add_argument('--out',type=pathlib.Path,required=True);p.add_argument('--source-sha',required=True);a=p.parse_args();print(json.dumps(build(a.data,a.out,a.source_sha)))
