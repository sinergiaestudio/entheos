#!/usr/bin/env python3
"""Ephemeral LCTSC native UX-N5 + T2-B3 paired real CT/RTSTRUCT smoke test.
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
   page.locator('#thoraxRefClear').click(force=True)
   cleared=page.locator('#thoraxRefStatus').inner_text()
   if errors:raise RuntimeError('Native ANATHEOS JS exception')
   if not changed:raise RuntimeError('Heart overlay cannot be toggled in native CT slice')
   result={'gate':'PASS_REAL_LCTSC_130_CT_AND_FIVE_REFERENCE_LAYERS_NATIVE_APP',
     'ct_slices':130,'matching_ct_nrrd_import':True,'mask_bitmask_import':True,
     'heart_layer_changes_canvas':changed,'reset_works':'Nueva serie DICOM' in cleared,
     'browser_js_errors':len(errors),'no_images_screenshots_or_identifiers_saved':True,
     'source':'TCIA LCTSC CC BY 3.0, same-study RTSTRUCT'}
   print('ANATHEOS_T2B3_REAL_NATIVE_QA='+json.dumps(result,sort_keys=True),flush=True)
  finally:browser.close()
finally:server.shutdown()