"""0.11 shared study lifecycle and accessible workstation, synthetic only."""
import json,pathlib,tempfile,threading
from http.server import ThreadingHTTPServer
from playwright.sync_api import sync_playwright,expect
from test_native import Handler,synth

def command(page,menu,label):
 page.locator('#stationToolbar').get_by_role('button',name=menu,exact=False).click()
 page.locator('.station-menu:popover-open').get_by_role('menuitem',name=label,exact=True).click()

def main():
 with tempfile.TemporaryDirectory() as t:
  folder=pathlib.Path(t);synth(folder)
  server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
  try:
   with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']);errors=[]
    page=browser.new_page(viewport={'width':1366,'height':768});page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(f'http://127.0.0.1:{server.server_port}/');page.set_input_files('#cmrNativeFolder',str(folder))
    expect(page.locator('body')).to_have_attribute('data-study-owner','cmr')
    expect(page.locator('#studyTitle')).to_have_text('Estudio DICOM');expect(page.locator('#seriesList button')).to_have_count(2)
    expect(page.locator('#studySubtitle')).to_contain_text('66 imágenes')
    for width,height in [(1366,768),(1920,1080)]:
     page.set_viewport_size({'width':width,'height':height})
     for n in [1,2,3,4,1,4]:
      command(page,'Vistas',f'{n} ventana'+('s' if n>1 else ''))
      expect(page.locator('.spatial-pane')).to_have_count(n)
      for canvas in page.locator('.spatial-pane canvas').all():
       expect(canvas).to_be_visible();box=canvas.bounding_box();assert box['height']>100 and box['width']>100
      assert page.evaluate('document.documentElement.scrollHeight<=innerHeight+1')
     pane=page.locator('.spatial-pane').nth(1);pane.locator('canvas').click()
     page.locator('#stationViewControls select').first.select_option('RM-002')
     expect(pane.locator('p')).to_contain_text('RM-002')
     command(page,'Vistas','1 ventana');command(page,'Vistas','4 ventanas');expect(page.locator('.spatial-pane p').nth(1)).to_contain_text('RM-002')
     canvas=page.locator('.spatial-pane canvas').first;canvas.click(button='right')
     expect(page.locator('[aria-label="Acciones de la vista"]')).to_be_visible()
     expect(page.locator('[aria-label="Acciones de la vista"]').get_by_role('menuitem',name='Volumen 3D',exact=True)).to_be_disabled()
     page.keyboard.press('Escape');expect(page.locator('[aria-label="Acciones de la vista"]')).to_be_hidden()
     page.locator('#viewerRoot').focus();page.keyboard.press('Shift+F10');expect(page.locator('[aria-label="Acciones de la vista"]')).to_be_visible();page.keyboard.press('Escape')
     command(page,'Vistas','Ampliar vista seleccionada');assert page.locator('.spatial-pane:visible').count()==1
     command(page,'Vistas','Ampliar vista seleccionada');assert page.locator('.spatial-pane:visible').count()==4
    command(page,'Vistas','Pantalla completa');page.wait_for_function('()=>!!document.fullscreenElement')
    page.locator('.spatial-pane canvas').first.click(button='right');expect(page.locator('[aria-label="Acciones de la vista"]')).to_be_visible();page.keyboard.press('Escape')
    if page.evaluate('!!document.fullscreenElement'):page.evaluate('document.exitFullscreen()')
    # Cine uses the selected eligible temporal view, not a hidden second canvas.
    page.locator('#seriesList button').nth(1).click();expect(page.locator('.spatial-pane p').first).to_contain_text('RM-002')
    command(page,'Navegación','Cine compatible');page.wait_for_function("()=>!document.querySelector('.spatial-pane p').textContent.includes('fotograma 1.')")
    command(page,'Navegación','Cine compatible')
    command(page,'Archivo','Cerrar estudio');expect(page.locator('#studyTitle')).to_have_text('Sin estudio cargado');expect(page.locator('.spatial-pane')).to_have_count(0)
    page.set_input_files('#cmrNativeFolder',str(folder));expect(page.locator('#studyTitle')).to_have_text('Estudio DICOM')
    tri=b'solid synthetic\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid synthetic\n'
    page.set_input_files('#surfaceFile',{'name':'synthetic.stl','mimeType':'application/octet-stream','buffer':tri});expect(page.locator('#surfaceCanvas')).to_be_visible();expect(page.locator('#cmrNativePanel')).to_be_hidden();expect(page.locator('#surfaceLayers')).to_have_attribute('data-origin','external');expect(page.locator('#uxLayerExternal')).to_be_visible()
    command(page,'Reconstrucción','Cortes 2D');expect(page.locator('.spatial-pane canvas').first).to_be_visible();expect(page.locator('#uxLayerExternal')).to_be_hidden()
    assert not errors,errors
    page.screenshot(path='/tmp/anatheos-v011-synthetic.png')
    browser.close()
   print('V011_SHARED_STATE_LAYOUT_CONTEXT_LIFECYCLE_PASS')
  finally:server.shutdown();server.server_close()
if __name__=='__main__':main()
