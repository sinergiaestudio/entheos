"""Build-time only public example download; installed application stays offline."""
import hashlib,pathlib,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[2]
DEST=ROOT/'demos/anatheos-local-v0.5/datasets/RTKN0668_MR_DESS.zip'
URL='https://archive.researchdata.leeds.ac.uk/1609/6/RTKN0668_MR_DESS.zip'
SHA='1c378e89d3a2e7aa57a1049f1fa91b9278529e544369d1071d4c453073ce951d'
def main():
 DEST.parent.mkdir(parents=True,exist_ok=True)
 if not DEST.exists():
  partial=DEST.with_suffix('.download')
  try:
   with urllib.request.urlopen(URL,timeout=90) as response, partial.open('wb') as out:
    while block:=response.read(1024*1024):out.write(block)
   assert hashlib.sha256(partial.read_bytes()).hexdigest()==SHA,'Leeds source hash mismatch'
   partial.replace(DEST)
  finally:partial.unlink(missing_ok=True)
 assert hashlib.sha256(DEST.read_bytes()).hexdigest()==SHA,'Leeds source hash mismatch'
 print('LEEDS_OFFLINE_EXAMPLE_HASH_PASS')
if __name__=='__main__':main()

def prepare_ct():
 import subprocess,sys,json
 dest=DEST.parent/'LCTSC_DICOM_TestData.zip'
 if not dest.exists():
  with urllib.request.urlopen('https://zenodo.org/records/4747795/files/LCTSC_DICOM_TestData.zip?download=1',timeout=90) as response:blob=response.read(50*1024**2+1)
  assert len(blob)<=50*1024**2
  assert hashlib.sha256(blob).hexdigest()=='0e02554ffbf80c8c7e8f0868ec527c8ec10f7c4fd5b532c715cb3d6333676e5f'
  dest.write_bytes(blob)
 assert hashlib.sha256(dest.read_bytes()).hexdigest()=='0e02554ffbf80c8c7e8f0868ec527c8ec10f7c4fd5b532c715cb3d6333676e5f'
 subprocess.run([sys.executable,str(ROOT/'research/anatheos-t2b2/multilayer_viewer/preparar_lctsc.py'),'--zip',str(dest),'--output',str(DEST.parent/'CT_EXAMPLE')],check=True)
 files=['LCTSC_DICOM_TestData.zip','CT_EXAMPLE/CT_HU_LPS.nrrd','CT_EXAMPLE/LCTSC_RT_5_ORGANOS_LPS.nrrd']
 manifest={name:hashlib.sha256((DEST.parent/name).read_bytes()).hexdigest() for name in files}
 (DEST.parent/'CT_EXAMPLE_HASHES.json').write_text(json.dumps(manifest),encoding='utf8')
 print('CT_FIVE_EXPERT_OFFLINE_SOURCE_AND_GRID_PASS')

if __name__=='__main__':prepare_ct()
