"""Public source ZIP to the existing browser volume and mask controls; no exports."""
import sys,threading
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from test_native import Handler
from http.server import ThreadingHTTPServer
from playwright.sync_api import sync_playwright,expect
s=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=s.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(args=['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader']);page=b.new_page(viewport={'width':1920,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(type(e).__name__))
  for name,path,n in [('Leeds',sys.argv[1],144),('LCTSC',sys.argv[2],130)]:
   page.goto(f'http://127.0.0.1:{s.server_port}/index.html')
   page.set_input_files('#zipInput',path)
   expect(page.locator('#studySubtitle')).to_contain_text(str(n)+' instancias',timeout=120000)
   expect(page.locator('#eligibleMpr')).to_have_count(1)
   page.locator('#eligibleMpr summary').click()
   expect(page.locator('#eligibleMpr canvas')).to_be_visible()
   page.locator('#threeDButton').click()
   expect(page.locator('#volumeStatus')).to_contain_text('Volumen',timeout=60000)
   expect(page.locator('#segSave')).to_be_enabled()
   print(name+'_PUBLIC_ORIGINAL_ZIP_ELIGIBILITY_MPR_VOLUME_MASK_CONTROLS_PASS',flush=True)
  assert not errors,errors
  b.close()
finally:s.shutdown();s.server_close()
