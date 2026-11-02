"""Isolated VT presentation package using the verified L1 loopback launcher."""
import pathlib,sys,tempfile,zipfile,json,hashlib,shutil,argparse
HERE=pathlib.Path(__file__).resolve().parent;sys.path.insert(0,str(HERE.parent/'anatheos-survey-l1'))
from package_l1 import build as base_build
def build(data,out,source_sha):
 with tempfile.TemporaryDirectory() as t:
  t=pathlib.Path(t);base_build(data,t/'l1.zip',source_sha)
  with zipfile.ZipFile(t/'l1.zip') as z:z.extractall(t/'unpack')
  root=t/'unpack/ANATHEOS-VISUAL-TARGET-01';(t/'unpack/ANATHEOS-SURVEY-L1').rename(root);web=root/'web';shutil.copy2(HERE/'prototype-bootstrap.mjs',web/'prototype-bootstrap.mjs')
  (web/'prototype-version.json').write_text(json.dumps({'prototype':'VISUAL-TARGET-01-L1.1','source_sha':source_sha,'baseline_L1':'1d05135b36aa5336db304b8ee15eac284742bfcf','private_data':True,'fusion':False,'field_L1_unchanged':True}))
  for p in list(root.iterdir()):
   if p.suffix in ['.cmd','.ps1','.py']:
    p.write_text(p.read_text(encoding='utf-8').replace('SURVEY-L1','VISUAL-TARGET-01').replace('SURVEY L1 private','VISUAL-TARGET-01 private'),encoding='utf-8');n=p.with_name(p.name.replace('SURVEY-L1','VISUAL-TARGET-01'))
    if n!=p:p.rename(n)
  (root/'LEEME.txt').write_text('ANATHEOS VISUAL-TARGET-01 / L1.1 - PRIVADO\n\n1. Extraer todo el ZIP en carpeta privada.\n2. Doble clic ABRIR-VISUAL-TARGET-01.cmd; mantener consola abierta.\n3. Pulsar Explorar volumen + MPR. Arrastrar gira; rueda amplia; seleccionar Mover plano de corte para arrastrar seccion, o usar deslizadores i/j/k y plano oblicuo.\n\nTres paneles MPR DERIVADOS abajo del volumen. Clic en imagen mueve cursor compartido; flechas mueven su corte. Ampliar/Escape. Planos 3D ocultos por defecto, activables; el volumen existe sin ellos. Recorte retira un lado y muestra cara derivada del mismo campo. Comparar con ORIGINAL DICOM muestra fuente mas cercana; la diferencia espacial se rotula. Solo adquirido conserva huecos. Opciones: color/procedencia, nominal, estimado, gamma/presets de sesion, normal/offset oblicuo y lado del corte.\n\nUna pila SURVEY a la vez, sin fusion/registro/fase comun o tejidos identificados. Campo L1 de baja resolucion sin informacion anatomica nueva. NO DIAGNOSTICO.\n\nPowerShell y navegador WebGL2, sin Python/admin/instalar sobre 0.11.1. No abrir index.html directamente. No desactivar seguridad global si una politica bloquea scripts. Datos PRIVADOS, no compartir/GitHub/CI. Servidor solo 127.0.0.1, sin escritura o envio externo. Sin firma Authenticode. Verificar SHA256 con informe. Cerrar consola/pestana y borrar carpeta es rollback; instalacion y datos previos intactos.\n',encoding='utf-8')
  (web/'manifest.json').write_text(json.dumps({p.relative_to(web).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in web.rglob('*') if p.is_file() and p.name!='manifest.json'},sort_keys=True))
  (root/'SHA256SUMS.json').write_text(json.dumps({p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*') if p.is_file() and p.name!='SHA256SUMS.json'},sort_keys=True))
  out.parent.mkdir(parents=True,exist_ok=True)
  with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
   for p in root.rglob('*'):
    if p.is_file():z.write(p,p.relative_to(root.parent))
 return {'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'source_sha':source_sha}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--data',required=True,type=pathlib.Path);p.add_argument('--out',required=True,type=pathlib.Path);p.add_argument('--source-sha',required=True);a=p.parse_args();print(json.dumps(build(a.data,a.out,a.source_sha)))
