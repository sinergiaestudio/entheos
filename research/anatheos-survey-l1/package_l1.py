"""Reuse the verified L0 read-only loopback package; never publish private output."""
import pathlib,sys,tempfile,zipfile,hashlib,json,shutil,argparse
HERE=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent/'anatheos-survey'))
from package_prototype import build as base_build
def build(data,out,source_sha):
 with tempfile.TemporaryDirectory() as temp:
  temp=pathlib.Path(temp);base_build(data,temp/'base.zip',source_sha)
  with zipfile.ZipFile(temp/'base.zip') as z:z.extractall(temp/'unpack')
  old=temp/'unpack/ANATHEOS-SURVEY-L0';root=old.with_name('ANATHEOS-SURVEY-L1');old.rename(root);web=root/'web'
  shutil.copy2(HERE/'prototype-bootstrap.mjs',web/'prototype-bootstrap.mjs')
  (web/'prototype-version.json').write_text(json.dumps({'prototype':'SURVEY-BASE-L1','source_sha':source_sha,'baseline_L0':'3c925416f28658a4f49c05c58079f6789ff4c530','private_data':True,'fusion':False}))
  for p in list(root.iterdir()):
   if p.suffix in ['.py','.ps1','.cmd','.txt']:
    text=p.read_text(encoding='utf-8').replace('SURVEY-L0','SURVEY-L1').replace('SURVEY L0','SURVEY L1').replace('SURVEY-BASE L0','SURVEY-BASE L1').replace('Abrir mis planos SURVEY L0','Abrir mi volumen SURVEY L1')
    if p.suffix=='.txt':text+='\nL1: volumen EXPLORATORIO de una pila independiente de 20 planos. Elegir otra orientacion NO fusiona. Recorte/opacidad/estimacion/soporte nominal y mascara de procedencia en inspector. Nube: grupos de SENAL estadistica, NO tejidos. Ver planos originales L0 regresa a los originales. Sin fase cardiaca acreditada ni segmentacion.\n'
    p.write_text(text,encoding='utf-8');new=p.with_name(p.name.replace('SURVEY-L0','SURVEY-L1'))
    if new!=p:p.rename(new)
  (root/'LEEME.txt').write_text((root/'LEEME.txt').read_text(encoding='utf-8').replace('Abrir mis planos SURVEY L1','Abrir mi volumen SURVEY L1').replace('No hay volumen continuo, corazon solido, sincronizacion cardiaca o segmentacion.','Hay volumen de intensidad derivado; no anatomia continua adquirida, corazon solido, sincronizacion cardiaca o segmentacion.'),encoding='utf-8')
  manifest={p.relative_to(web).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in web.rglob('*') if p.is_file() and p.name!='manifest.json'};(web/'manifest.json').write_text(json.dumps(manifest,sort_keys=True))
  sums={p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*') if p.is_file() and p.name!='SHA256SUMS.json'};(root/'SHA256SUMS.json').write_text(json.dumps(sums,sort_keys=True))
  out.parent.mkdir(parents=True,exist_ok=True)
  with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
   for p in root.rglob('*'):
    if p.is_file():z.write(p,p.relative_to(root.parent))
 return {'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'source_sha':source_sha}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--data',type=pathlib.Path,required=True);p.add_argument('--out',type=pathlib.Path,required=True);p.add_argument('--source-sha',required=True);a=p.parse_args();print(json.dumps(build(a.data,a.out,a.source_sha)))
