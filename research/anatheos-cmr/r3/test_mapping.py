"""Actual pointer interactions at CSS zoom/pan and device scale 1/2."""
import pathlib,tempfile,threading
from http.server import ThreadingHTTPServer
from playwright.sync_api import sync_playwright,expect
from test_native import Handler,synth
from test_station import command

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
     command(page,'Vistas','4 ventanas');assert page.locator('.spatial-pane canvas').count()==4
     for pane_index in range(4):
      pane=page.locator('.spatial-pane').nth(pane_index);canvas=pane.locator('canvas');canvas.click();mode=page.locator('#stationViewControls label').filter(has_text='Herramienta').locator('select');zoom=page.locator('#stationViewControls label').filter(has_text='Zoom').locator('input')
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
        page.evaluate('window.measured=[]');mode.select_option('measure');canvas.evaluate("e=>{window.actualClicks=[];e.onclickCapture?.();const handler=event=>{const r=e.getBoundingClientRect();window.actualClicks.push([(event.clientX-r.left)*e.width/r.width,(event.clientY-r.top)*e.height/r.height]);};e.addEventListener('click',handler,{capture:true});e.onclickCapture=()=>e.removeEventListener('click',handler,{capture:true});}");canvas.evaluate("e=>e.parentElement.scrollIntoView({block:'center'})");r=canvas.bounding_box()
        for x in [30,40]:page.mouse.click(r['x']+r['width']*x/64,r['y']+r['height']*35/64)
        actual=page.evaluate('Math.hypot(window.actualClicks[0][0]-window.actualClicks[1][0],window.actualClicks[0][1]-window.actualClicks[1][1])');assert any(abs(float(x.split()[0])-actual)<.011 for x in page.evaluate('window.measured')),(scale,pan,dpr,pane_index,actual,page.evaluate('window.measured'))
        mode.select_option('point');canvas.evaluate("e=>e.parentElement.scrollIntoView({block:'center'})");r=canvas.bounding_box();page.mouse.click(r['x']+r['width']*30/64,r['y']+r['height']*36/64)
        ink=canvas.evaluate("e=>{const a=e.getContext('2d').getImageData(27,33,9,9).data;for(let k=0;k<a.length;k+=4)if(a[k]>a[k+1]&&a[k+1]>a[k+2])return true;return false;}")
        assert ink,(scale,pan,dpr,pane_index)
        page.locator('#stationViewControls').get_by_role('button',name='Borrar anotaciones').click()
     page.set_viewport_size({'width':1366,'height':768});expect(canvas).to_be_visible();mode.select_option('cursor');canvas.evaluate("e=>e.parentElement.scrollIntoView({block:'center'})");r=canvas.bounding_box();page.mouse.click(r['x']+r['width']*30/64,r['y']+r['height']*35/64);expect(pane.locator('p')).to_contain_text('EN PLANO');context.close()
    browser.close()
   print('POINTER_PIXEL_LPS_ZOOM_PAN_HIDPI_MEASUREMENT_PASS')
  finally:server.shutdown();server.server_close()
if __name__=='__main__':main()
