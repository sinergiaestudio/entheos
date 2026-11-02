"""Real file/ZIP imports across regions; generated DICOM only, no Leeds/clinical data."""
import io,json,pathlib,sys,tempfile,threading,zipfile,os
import pydicom
from pydicom.uid import ExplicitVRLittleEndian,ImplicitVRLittleEndian,CTImageStorage
from playwright.sync_api import sync_playwright,expect
from test_station import command
ROOT=pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'research/anatheos-cmr/w1'))
from test_w1_original_zip import fixture,AppServer,Handler,APP,PREPARER

def make_study(root,name,region,serial=1,compressed=False,implicit=False,temporal=False,modality='MR'):
 folder=root/name;folder.mkdir();payloads=[]
 for i in range(6):
  raw,pixels=fixture.one(f'1.2.826.0.1.3680043.10.991.{serial}99',serial,i,name)
  ds=pydicom.dcmread(io.BytesIO(raw));ds.BodyPartExamined=region;ds.ScanningSequence='SE';ds.RepetitionTime=500;ds.EchoTime=20;ds.SliceThickness=3
  ds.ImagePositionPatient=[0,0,0 if temporal else i*3];ds.TriggerTime=i*40 if temporal else 0;ds.Modality=modality
  if modality=='CT':ds.SOPClassUID=CTImageStorage;ds.KVP=120;ds.ConvolutionKernel='STANDARD';ds.RescaleIntercept=-1024;ds.RescaleSlope=1
  if not compressed:
   ds.file_meta.TransferSyntaxUID=ImplicitVRLittleEndian if implicit else ExplicitVRLittleEndian
   ds.PixelData=pixels.tobytes();ds['PixelData'].VR='OW';ds['PixelData'].is_undefined_length=False
  out=io.BytesIO();ds.save_as(out,enforce_file_format=True);payloads.append(out.getvalue());(folder/f'{i}.dcm').write_bytes(payloads[-1])
 archive=root/(name+'.zip')
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
  for i,b in enumerate(payloads):z.writestr(f'study/{i}.dcm',b)
 return folder,archive

def main():
 with tempfile.TemporaryDirectory() as t:
  root=pathlib.Path(t)
  cases=[('ABDOMEN_T1','ABDOMEN','zip',dict(serial=1)),('MEMBER_T1','KNEE','folder',dict(serial=3,implicit=True)),('HEART_DYNAMIC','HEART','zip',dict(serial=5,compressed=True,temporal=True)),('ABDOMEN_CT','ABDOMEN','zip',dict(serial=7,modality='CT'))]
  generated=[(name,kind,make_study(root,name,region,**kw),kw) for name,region,kind,kw in cases]
  s=AppServer(('127.0.0.1',0),Handler);s.app_root=APP;s.jobs_root=root/'jobs';s.jobs_root.mkdir();s.preparer=PREPARER;s.jobs={};s.jobs_lock=threading.Lock();threading.Thread(target=s.serve_forever,daemon=True).start()
  try:
   with sync_playwright() as pw:
    browser=pw.chromium.launch(args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']);page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(os.environ.get('ANATHEOS_QA_URL',f'http://127.0.0.1:{s.server_port}/'))
    results=[]
    for width,height in [(1366,768),(1920,1080)]:
     page.set_viewport_size({'width':width,'height':height})
     for name,kind,(folder,archive),kw in generated:
      if kind=='folder':page.set_input_files('#folderInput',str(folder))
      else:page.set_input_files('#zipInput',str(archive))
      owner='cmr' if kw.get('compressed') else 'native'
      expect(page.locator('body')).to_have_attribute('data-study-owner',owner,timeout=60000)
      expect(page.locator('#seriesList button')).to_have_count(1)
      if owner=='native':expect(page.locator('#seriesList button')).to_contain_text(name)
      command(page,'Vistas','4 ventanas');expect(page.locator('.spatial-pane')).to_have_count(4)
      page.locator('.spatial-pane canvas').first.click(button='right')
      entry=page.get_by_role('menu',name='Acciones de la vista').get_by_role('menuitem',name='Volumen 3D',exact=True)
      if kw.get('temporal'):expect(entry).to_be_disabled()
      else:expect(entry).to_be_enabled()
      page.keyboard.press('Escape')
      if not kw.get('temporal'):
       command(page,'Reconstrucción','Volumen 3D');expect(page.locator('#volumeStatus')).to_contain_text('Volumen',timeout=30000)
       command(page,'Reconstrucción','MPR');expect(page.locator('#eligibleMpr canvas')).to_be_visible()
       page.select_option('#eligibleMpr select','0');expect(page.locator('#eligibleMpr canvas')).to_have_attribute('data-top','S')
      assert page.evaluate('document.documentElement.scrollHeight<=innerHeight+1')
      command(page,'Archivo','Cerrar estudio');expect(page.locator('#studyTitle')).to_have_text('Sin estudio cargado')
      expect(page.locator('.spatial-pane,#eligibleMpr')).to_have_count(0)
      expect(page.locator('#stationViewControls input,#stationViewControls select')).to_have_count(0)
      results.append({'region_fixture':name,'input':kind,'owner':owner,'volume_eligible':not kw.get('temporal',False),'resolution':f'{width}x{height}'})
    assert not errors,errors;browser.close();print(json.dumps({'result':'PASS','cases':results,'javascript_errors':0,'clinical_data':False}),flush=True)
  finally:
   with s.jobs_lock:jobs=list(s.jobs.values());s.jobs.clear()
   for j in jobs:j.cancel()
   s.shutdown();s.server_close()
if __name__=='__main__':main()
