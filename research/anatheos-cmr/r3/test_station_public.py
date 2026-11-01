"""Actual offline example -> existing GPU/CPU volume, controls, MPR, layouts."""
import hashlib,io,threading,time,os,pathlib
from http.server import ThreadingHTTPServer
from PIL import Image,ImageStat
from playwright.sync_api import sync_playwright,expect
from test_native import Handler
from test_station import command

def exercise(page):
 errors=[];external=[];started=time.monotonic()
 page.evaluate("""()=>{window.textureQA={create:0,drop:0};for(const [method,key] of [['createTexture','create'],['deleteTexture','drop']]){const original=WebGL2RenderingContext.prototype[method];WebGL2RenderingContext.prototype[method]=function(...args){window.textureQA[key]++;return original.apply(this,args);};}}""")
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/*',lambda route:route.continue_() if route.request.url.startswith('http://127.0.0.1:') else (external.append('external_request'),route.abort())[1])
 command(page,'Archivo','RM de ejemplo · Leeds (offline)')
 expect(page.locator('#studySubtitle')).to_contain_text('144 instancias',timeout=120000)
 command(page,'Reconstrucción','Volumen 3D');expect(page.locator('#loading')).to_be_hidden(timeout=120000)
 expect(page.locator('#volumeStatus')).to_contain_text('384 × 384 × 144',timeout=60000)
 canvas=page.locator('#volumeCanvas');expect(canvas).to_be_visible()
 before=canvas.screenshot();im=Image.open(io.BytesIO(before)).convert('RGB');assert max(ImageStat.Stat(im).stddev)>2,'Blank volume'
 box=canvas.bounding_box();page.mouse.move(box['x']+box['width']*.5,box['y']+box['height']*.5);page.mouse.down();page.mouse.move(box['x']+box['width']*.58,box['y']+box['height']*.54,steps=8);page.mouse.up()
 assert hashlib.sha256(before).digest()!=hashlib.sha256(canvas.screenshot()).digest(),'Rotation unchanged'
 command(page,'Capas','Propiedades de volumen');page.locator('#volumeOpacity').fill('65');page.locator('#volumeClip').fill('65')
 assert hashlib.sha256(before).digest()!=hashlib.sha256(canvas.screenshot()).digest(),'Volume controls unchanged'
 if os.environ.get('ANATHEOS_PUBLIC_QA_DIR'):
  folder=pathlib.Path(os.environ['ANATHEOS_PUBLIC_QA_DIR']);folder.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(folder/'leeds-volume.png'))
 for width,height in [(1366,768),(1920,1080)]:
  page.set_viewport_size({'width':width,'height':height})
  command(page,'Reconstrucción','MPR');expect(page.locator('#eligibleMpr canvas')).to_be_visible()
  for axis in ['0','1','2']:page.select_option('#eligibleMpr select',axis);assert page.locator('#eligibleMpr canvas').evaluate('e=>e.width*e.height')>0
  command(page,'Reconstrucción','Cortes 2D');expect(page.locator('#scanCanvas')).to_be_visible()
  for n in [2,3,4,1]:command(page,'Vistas',f'{n} ventana'+('s' if n>1 else ''));expect(page.locator('#nativeComparison .spatial-pane')).to_have_count(n)
  command(page,'Reconstrucción','Cortes 2D')
 assert not external,external
 command(page,'Archivo','Cerrar estudio');expect(page.locator('#studyTitle')).to_have_text('Sin estudio cargado');expect(page.locator('#nativeComparison')).to_have_count(0);expect(page.locator('#eligibleMpr')).to_have_count(0)
 assert not errors,errors
 print('LEEDS_144_OFFLINE_REAL_VOLUME_ROTATION_CONTROLS_MPR_SHARED_LAYOUT_PASS; seconds='+str(round(time.monotonic()-started,2)),flush=True)

def exercise_ct(page):
 command(page,'Archivo','TC de ejemplo · cinco capas expertas (offline)')
 expect(page.locator('#studySubtitle')).to_contain_text('130 instancias',timeout=120000)
 expect(page.locator('#thoraxRefStatus')).to_contain_text('Referencia vinculada',timeout=120000)
 expect(page.locator('#warnings')).not_to_contain_text('ERROR')
 command(page,'Capas','Máscaras y segmentación')
 expect(page.locator('#thoraxRefColor3')).to_be_visible();page.locator('#thoraxRefColor3').fill('#00ff00');page.locator('#thoraxRefAlpha3').fill('70')
 command(page,'Reconstrucción','Volumen 3D');expect(page.locator('#loading')).to_be_hidden(timeout=120000)
 expect(page.locator('#volumeStatus')).to_contain_text('512 × 512 × 130',timeout=60000)
 page.locator('#thoraxRef3DIsolate').check()
 for k in [1,2,4,5]:page.locator(f'#thoraxRefLayer{k}').uncheck()
 heart=page.locator('#volumeCanvas').screenshot();page.locator('#thoraxRefLayer3').uncheck();blank=page.locator('#volumeCanvas').screenshot()
 assert hashlib.sha256(heart).digest()!=hashlib.sha256(blank).digest(),'Heart reference invisible'
 page.locator('#thoraxRefLayer3').check();page.locator('#thoraxRefAlpha3').fill('0');zero=page.locator('#volumeCanvas').screenshot();assert zero==blank,'Zero opacity must hide isolated reference'
 command(page,'Archivo','Cerrar estudio');expect(page.locator('#thoraxRefStatus')).not_to_contain_text('Referencia vinculada');expect(page.locator('#studyTitle')).to_have_text('Sin estudio cargado')
 metrics=page.evaluate('window.textureQA');assert metrics['create']==metrics['drop'],metrics
 print('CT_130_FIVE_SAME_CASE_REFERENCES_COLOR_ALPHA_GPU_VOLUME_PASS; texture resources released='+str(metrics),flush=True)

def main():
 s=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=s.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as p:
   b=p.chromium.launch(args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']);page=b.new_page(viewport={'width':1366,'height':768});page.goto(f'http://127.0.0.1:{s.server_port}/');exercise(page);exercise_ct(page);b.close()
 finally:s.shutdown();s.server_close()
if __name__=='__main__':main()
