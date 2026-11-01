"""Synthetic integration into existing volume, mask/surface controls and MPR."""
import json,pathlib,tempfile,threading
from playwright.sync_api import sync_playwright,expect
from test_station import command
from test_native import Handler,series,frame,SCHEMA
from http.server import ThreadingHTTPServer

def main():
 with tempfile.TemporaryDirectory() as temp:
  folder=pathlib.Path(temp)/'fixture';folder.mkdir()
  frames=[{**frame([1,0,0,0,1,0],[0,0,k*3],k+1), 'modality':'MR','image_type':'ORIGINAL',
           'acquisition':{'scan_sequence':'SE','tr':'500','te':'20','slice_thickness':3}} for k in range(4)]
  record=series(folder,'RM-001',frames,'pila_2d_revisar_3d')
  (folder/'catalogo_local_privado.json').write_text(json.dumps({'schema':SCHEMA,'series':[record]}))
  server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
  try:
   with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-gpu']);page=browser.new_page(viewport={'width':1920,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(type(e).__name__))
    page.goto(f'http://127.0.0.1:{server.server_port}/index.html');page.set_input_files('#cmrNativeFolder',str(folder))
    command(page,'Reconstrucción','Elegibilidad y motivos')
    expect(page.locator('#cmrReconstructionAnalysis button')).to_have_count(1)
    command(page,'Reconstrucción','Volumen 3D')
    expect(page.locator('#cmrNativePanel')).to_be_hidden()
    expect(page.locator('#volumeStatus')).to_contain_text('Volumen',timeout=30000)
    expect(page.locator('#segSave')).to_be_enabled()
    command(page,'Reconstrucción','MPR')
    expect(page.locator('#eligibleMpr canvas')).to_be_visible()
    page.select_option('#eligibleMpr select','1')
    assert page.locator('#eligibleMpr canvas').evaluate('e=>e.height')==4
    assert not errors,errors
    browser.close()
   print('G4_EXISTING_VOLUME_MASK_CONTROLS_AND_MPR_PASS')
  finally:server.shutdown();server.server_close()
if __name__=='__main__':main()
