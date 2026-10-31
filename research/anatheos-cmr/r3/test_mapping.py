"""Actual pointer interactions at CSS zoom/pan and device scale 1/2."""
import pathlib,tempfile,threading
from http.server import ThreadingHTTPServer
from playwright.sync_api import sync_playwright,expect
from test_native import Handler,synth

def main():
 with tempfile.TemporaryDirectory() as temp:
  folder=pathlib.Path(temp)/'fixture';folder.mkdir();synth(folder)
  server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
  try:
   with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-gpu'])
    for dpr in [1,2]:
     context=browser.new_context(viewport={'width':1920,'height':1080},device_scale_factor=dpr);page=context.new_page()
     page.goto(f'http://127.0.0.1:{server.server_port}/index.html');page.set_input_files('#cmrNativeFolder',str(folder))
     page.locator('#cmrSpatialCompare summary').click();page.select_option('[aria-label="Número de vistas"]','4');assert page.locator('.spatial-pane canvas').count()==4
     for pane_index in range(4):
      pane=page.locator('.spatial-pane').nth(pane_index);canvas=pane.locator('canvas');mode=pane.locator('label').filter(has_text='Herramienta').locator('select');zoom=pane.locator('label').filter(has_text='Zoom').locator('input')
      # Capture measured values, never pixels/screenshots or clinical records.
      page.evaluate("""()=>{window.measured=[];const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){if(String(text).endsWith(' mm'))window.measured.push(text);return original.call(this,text,...args);};}""")
      for scale in ['0.5','2','4']:
       zoom.fill(scale)
       for pan in [-12,12]:
        mode.select_option('pan');canvas.evaluate("e=>e.parentElement.scrollIntoView({block:'center'})");r=canvas.bounding_box();page.mouse.move(r['x']+r['width']/2,r['y']+r['height']/2);page.mouse.down();page.mouse.move(r['x']+r['width']/2+pan,r['y']+r['height']/2+pan);page.mouse.up()
        mode.select_option('cursor');canvas.evaluate("e=>e.parentElement.scrollIntoView({block:'center'})");r=canvas.bounding_box();page.mouse.click(r['x']+r['width']*30/64,r['y']+r['height']*35/64)
        expect(pane.locator('p')).to_contain_text('EN PLANO')
        # The marker has to land at the selected source pixel after transforms.
        color=canvas.evaluate("e=>Array.from(e.getContext('2d').getImageData(30,35,1,1).data)")
        assert color[1]>color[0],(scale,pan,dpr)
        page.evaluate('window.measured=[]');mode.select_option('measure');canvas.evaluate("e=>e.parentElement.scrollIntoView({block:'center'})");r=canvas.bounding_box()
        for x in [30,40]:page.mouse.click(r['x']+r['width']*x/64,r['y']+r['height']*35/64)
        assert '10.00 mm' in page.evaluate('window.measured')
        mode.select_option('point');canvas.evaluate("e=>e.parentElement.scrollIntoView({block:'center'})");r=canvas.bounding_box();page.mouse.click(r['x']+r['width']*30/64,r['y']+r['height']*45/64)
        ink=canvas.evaluate("e=>{const a=e.getContext('2d').getImageData(27,42,9,9).data;for(let k=0;k<a.length;k+=4)if(a[k]>a[k+1]&&a[k+1]>a[k+2])return true;return false;}")
        assert ink,(scale,pan,dpr,pane_index)
        pane.get_by_role('button',name='Borrar anotaciones').click()
     page.set_viewport_size({'width':1366,'height':768});expect(canvas).to_be_visible();mode.select_option('cursor');canvas.evaluate("e=>e.parentElement.scrollIntoView({block:'center'})");r=canvas.bounding_box();page.mouse.click(r['x']+r['width']*30/64,r['y']+r['height']*35/64);expect(pane.locator('p')).to_contain_text('EN PLANO');context.close()
    browser.close()
   print('POINTER_PIXEL_LPS_ZOOM_PAN_HIDPI_MEASUREMENT_PASS')
  finally:server.shutdown();server.server_close()
if __name__=='__main__':main()
