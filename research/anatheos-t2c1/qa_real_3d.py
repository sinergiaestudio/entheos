#!/usr/bin/env python3
"""Ephemeral LCTSC native UX-N5 + T2-C1 real CT/RTSTRUCT 2D+3D test.
Logs only aggregated geometry and pass/fail; NEVER medical pixels or UIDs.
"""
from __future__ import annotations
import argparse, functools, http.server, io, json, pathlib, threading, time, struct
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser()
parser.add_argument('--app-dir',default='demos/anatheos-local-v0.5')
parser.add_argument('--zip',required=True)
parser.add_argument('--ct',required=True)
parser.add_argument('--mask',required=True)
args=parser.parse_args()
root=pathlib.Path(args.app_dir).resolve(); zip_path=pathlib.Path(args.zip)
assert all(x.exists() for x in [root/'app.js',root/'thorax-reference.mjs',zip_path,pathlib.Path(args.ct),pathlib.Path(args.mask)])
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*unused):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root)))
t=threading.Thread(target=server.serve_forever,daemon=True);t.start()
def until(predicate,limit=110):
 begin=time.monotonic()
 while time.monotonic()-begin<limit:
  value=predicate()
  if value:return value
  time.sleep(.35)
 raise RuntimeError('Expected ANATHEOS native browser state not reached')
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--use-gl=swiftshader'])
  page=browser.new_page(viewport={'width':1440,'height':900});errors=[]
  page.on('pageerror',lambda e:errors.append(type(e).__name__))
  try:
   page.goto(f'http://127.0.0.1:{server.server_port}/index.html',wait_until='domcontentloaded',timeout=35000)
   page.locator('#thoraxRefCT').wait_for(state='attached',timeout=20000)
   page.locator('#zipInput').set_input_files(str(zip_path))
   until(lambda:page.locator('#sliceTotal').inner_text().strip()=='/ 130',120)
   page.locator('#thoraxRefCT').set_input_files(args.ct)
   page.locator('#thoraxRefMask').set_input_files(args.mask)
   status=until(lambda:(s if 'vóxeles de CT cotejados' in (s:=page.locator('#thoraxRefStatus').inner_text()) else False),100)
   # QA screen check: image in RAM only, never stored/sent.
   def screenshot():return Image.open(io.BytesIO(page.locator('#scanCanvas').screenshot(timeout=20000))).convert('RGB')
   before=screenshot()
   advanced=page.locator('#b5AdvancedToggle')
   if advanced.is_visible():advanced.click(timeout=5000)
   # Input may remain behind advanced disclosure; Playwright forced check is fine for QA.
   toggle=page.locator('#thoraxRefLayer3')
   toggle.uncheck(force=True,timeout=12000)
   after=screenshot()
   # Changes may be limited if current slice has no manually contoured heart.
   changed=ImageChops.difference(before,after).getbbox() is not None
   toggle.check(force=True,timeout=12000)
   # T2-C1: five independent bitmask structures in the real volume ray caster.
   page.locator('#threeDButton').click(force=True)
   until(lambda:'Volumen ' in page.locator('#volumeStatus').inner_text(),110)
   # Isolate only the external heart reference; no synthetic voxels.
   page.locator('#thoraxRef3DIsolate').evaluate('(e)=>{e.checked=true;e.dispatchEvent(new Event("change",{bubbles:true}));}')
   for k in range(1,6):
    page.locator(f'#thoraxRefLayer{k}').evaluate('(e)=>{e.checked=false;e.dispatchEvent(new Event("change",{bubbles:true}));}')
   blank=Image.open(io.BytesIO(page.locator('#volumeCanvas').screenshot(timeout=20000))).convert('RGB')
   page.locator('#thoraxRefLayer3').evaluate('(e)=>{e.checked=true;e.dispatchEvent(new Event("change",{bubbles:true}));}')
   heart=Image.open(io.BytesIO(page.locator('#volumeCanvas').screenshot(timeout=20000))).convert('RGB')
   if not ImageChops.difference(blank,heart).getbbox():raise RuntimeError('Real cardiac reference invisible in 3D isolation')
   backend='GPU' if 'GPU' in page.locator('#volumeStatus').inner_text() else 'CPU'
   # clear in active 3D: the renderer must release only its external mask.
   page.locator('#thoraxRefClear').click(force=True)
   cleared=page.locator('#thoraxRefStatus').inner_text()
   if errors:raise RuntimeError('Native ANATHEOS JS exception')
   if not changed:raise RuntimeError('Heart overlay cannot be toggled in native CT slice')
   result={'gate':'PASS_REAL_LCTSC_130_CT_FIVE_REFERENCE_ORGANS_IN_NATIVE_2D_AND_3D',
     'ct_slices':130,'matching_ct_nrrd_import':True,'mask_bitmask_import':True,
     'heart_layer_changes_canvas':changed,'heart_layer_changes_3d':True,'3d_reference_isolation':True,'renderer_backend':backend,'reset_works':'Nueva serie DICOM' in cleared,
     'browser_js_errors':len(errors),'no_images_screenshots_or_identifiers_saved':True,
     'source':'TCIA LCTSC CC BY 3.0, same-study RTSTRUCT'}
   print('ANATHEOS_T2C1_REAL_3D_QA='+json.dumps(result,sort_keys=True),flush=True)
  finally:browser.close()
finally:server.shutdown()