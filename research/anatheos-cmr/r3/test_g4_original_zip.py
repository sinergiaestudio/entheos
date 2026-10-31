"""Original compressed ZIP import/reimport to existing G4 engines; synthetic only."""
import sys,pathlib,tempfile,threading,io,zipfile
import pydicom
from playwright.sync_api import sync_playwright,expect
ROOT=pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'research/anatheos-cmr/w1'))
from test_w1_original_zip import fixture,AppServer,Handler,APP,PREPARER
with tempfile.TemporaryDirectory() as temp:
 folder=pathlib.Path(temp);archive=folder/'synthetic.zip'
 with zipfile.ZipFile(archive,'w') as z:
  for i in range(3):
   raw,_=fixture.one('1.2.826.0.1.3680043.10.991.999',1,i,'T1')
   ds=pydicom.dcmread(io.BytesIO(raw));ds.TriggerTime=0;ds.ScanningSequence='SE';ds.RepetitionTime=500;ds.EchoTime=20;ds.SliceThickness=3
   buf=io.BytesIO();ds.save_as(buf,enforce_file_format=True);z.writestr(f'{i}.dcm',buf.getvalue())
 s=AppServer(('127.0.0.1',0),Handler);s.app_root=APP;s.jobs_root=folder/'jobs';s.jobs_root.mkdir();s.preparer=PREPARER;s.jobs={};s.jobs_lock=threading.Lock();threading.Thread(target=s.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(args=['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader']);page=browser.new_page();page.goto(f'http://127.0.0.1:{s.server_port}/')
   for attempt in range(2):
    page.set_input_files('#cmrNativeZip',str(archive));expect(page.locator('#cmrNativeSeries option')).to_have_count(1,timeout=60000)
    expect(page.locator('#cmrReconstructionAnalysis button')).to_have_count(1)
    if attempt==0:
     page.locator('#cmrNativeClose').click();expect(page.locator('#cmrNativeSeries option')).to_have_count(0);expect(page.locator('#cmrReconstructionAnalysis button')).to_have_count(0)
   page.locator('#cmrReconstructionAnalysis summary').click();page.locator('#cmrReconstructionAnalysis button').click()
   expect(page.locator('#volumeStatus')).to_contain_text('Volumen',timeout=30000);expect(page.locator('#eligibleMpr')).to_have_count(1)
   browser.close()
  print('ORIGINAL_JPEG2000_ZIP_CLOSE_REIMPORT_EXISTING_VOLUME_MPR_PASS')
 finally:
  with s.jobs_lock:jobs=list(s.jobs.values());s.jobs.clear()
  for job in jobs:job.cancel()
  s.shutdown();s.server_close()
