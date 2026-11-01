"""Existing manual masks, seed review, same-study meshes and external surfaces in new shell."""
import pathlib,subprocess,sys,tempfile,threading
from http.server import ThreadingHTTPServer
from playwright.sync_api import sync_playwright,expect
from test_native import Handler
from test_station import command

def main():
 with tempfile.TemporaryDirectory() as t:
  archive=pathlib.Path(t)/'synthetic.zip';subprocess.run([sys.executable,'demos/anatheos-local-v0.5/generate_uxn2_synthetic.py',str(archive)],check=True,stdout=subprocess.DEVNULL)
  s=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=s.serve_forever,daemon=True).start()
  try:
   with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']);page=b.new_page(viewport={'width':1366,'height':768});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{s.server_port}/');page.set_input_files('#zipInput',str(archive));expect(page.locator('#studyTitle')).to_have_text('SYNTHETIC_TEST_NOT_PATIENT')
    command(page,'Capas','Máscaras y segmentación');page.locator('#segEdit').check();page.locator('#scanCanvas').click();expect(page.locator('#segBuildSurface')).to_be_enabled();page.locator('#segEdit').uncheck();page.locator('#segBuildSurface').click();expect(page.locator('#surfaceLayers .surface-row')).to_have_count(1,timeout=45000);expect(page.locator('#surfaceCanvas')).to_be_visible();expect(page.locator('#surfaceLayers')).to_have_attribute('data-origin','same-study-manual')
    command(page,'Reconstrucción','Cortes 2D');page.once('dialog',lambda dialog:dialog.accept());page.locator('#segClearAll').click();expect(page.locator('#surfaceLayers .surface-row')).to_have_count(0)
    page.locator('#b7PickSeed').click();page.locator('#scanCanvas').click();page.locator('#b7Propose').click();expect(page.locator('#b7Accept')).to_be_enabled(timeout=30000);page.locator('#b7Discard').click();expect(page.locator('#b7Accept')).to_be_disabled();expect(page.locator('#segCount1')).to_have_text('0 vóxeles')
    page.locator('#b7Propose').click();expect(page.locator('#b7Accept')).to_be_enabled();page.locator('#b7Accept').click();expect(page.locator('#surfaceLayers .surface-row')).to_have_count(1,timeout=45000);expect(page.locator('#surfaceCanvas')).to_be_visible()
    command(page,'Reconstrucción','2D + 3D');expect(page.locator('#loading')).to_be_hidden(timeout=60000);expect(page.locator('#volumeCanvas')).to_be_visible();expect(page.locator('#scanCanvas')).to_be_visible()
    command(page,'Reconstrucción','Tres vistas: corte, volumen y máscaras');expect(page.locator('#loading')).to_be_hidden(timeout=60000);expect(page.locator('#surfaceCanvas')).to_be_visible();expect(page.locator('#scanCanvas')).to_be_visible();expect(page.locator('#volumeCanvas')).to_be_visible();
    command(page,'Archivo','Cerrar estudio');expect(page.locator('#surfaceLayers .surface-row')).to_have_count(0)
    # An external mesh stays explicitly external, never a Leeds segmentation.
    tri=b'solid synthetic\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid synthetic\n'
    page.set_input_files('#surfaceFile',{'name':'synthetic.stl','mimeType':'application/octet-stream','buffer':tri});expect(page.locator('#surfaceLayers .surface-row')).to_have_count(1);expect(page.locator('#surfaceCanvas')).to_be_visible();expect(page.locator('#surfaceLayers')).to_have_attribute('data-origin','external')
    assert not errors,errors;b.close()
   print('EXISTING_MASK_SEED_REVIEW_SAME_STUDY_SURFACES_MIXED_EXTERNAL_PROVENANCE_PASS')
  finally:s.shutdown();s.server_close()
if __name__=='__main__':main()
