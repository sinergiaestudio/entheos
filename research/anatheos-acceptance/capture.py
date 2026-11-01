"""Acceptance evidence only. No application mutation, no private inputs."""
import argparse,hashlib,json,pathlib,platform,sys,time,threading,subprocess,os,http.client
from playwright.sync_api import sync_playwright,expect
FROZEN='98b10279a6838a23d96ff82be92ac92901f990de'
SHA='0765a2f6d29d4f71a829143ea2fc6164daa38d33525df0b4ee465c208ebb09cb'
SIZES=[(1366,768),(1920,1080)]
OUT=pathlib.Path(os.environ.get('ACCEPTANCE_OUT','acceptance-output'));OUT.mkdir(parents=True,exist_ok=True)
records=[];errors=[]
def command(p,menu,label):
 p.locator('#stationToolbar').get_by_role('button',name=menu,exact=False).click()
 p.locator('.station-menu:popover-open').get_by_role('menuitem',name=label,exact=True).click()
def snap(p,name):
 p.mouse.move(1,1);p.wait_for_timeout(250)
 width,height=p.viewport_size.values();path=OUT/f'{name}-{width}x{height}.png'
 p.screenshot(path=str(path),timeout=20000,animations='disabled')
 info=p.evaluate('''()=>{const rect=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,overflow:getComputedStyle(e).overflowY}};const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'};return {title:document.querySelector('#studyTitle')?.textContent,subtitle:document.querySelector('#studySubtitle')?.textContent,mode:document.body.dataset.stationMode,owner:document.body.dataset.studyOwner,bodyClass:document.body.className,viewport:rect('#viewerRoot'),inspector:rect('#uxLayersPanel'),documentScroll:document.documentElement.scrollHeight>innerHeight+1,visibleControls:[...document.querySelectorAll('button,input,select')].filter(visible).map(e=>({id:e.id,text:(e.textContent||e.title||e.getAttribute('aria-label')||'').slice(0,100),y:Math.round(e.getBoundingClientRect().y)})),scrollOwners:[...document.querySelectorAll('body *')].filter(e=>visible(e)&&['auto','scroll'].includes(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight+2).map(e=>({id:e.id,cls:e.className,h:e.clientHeight,scroll:e.scrollHeight}))}}''')
 info.update(file=path.name,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),platform=platform.platform(),browser=p.context.browser.version,frozenRuntime=FROZEN)
 records.append(info);(OUT/'screenshots.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf8');print('CAPTURE '+path.name,flush=True)
def both(p,name):
 for w,h in SIZES:p.set_viewport_size({'width':w,'height':h});snap(p,name)
def rotated(p):
 c=p.locator('#volumeCanvas');expect(c).to_be_visible();b=c.bounding_box()
 p.mouse.move(b['x']+b['width']*.5,b['y']+b['height']*.5);p.mouse.down();p.mouse.move(b['x']+b['width']*.64,b['y']+b['height']*.56,steps=12);p.mouse.up()
def exercise(p):
 p.on('pageerror',lambda e:errors.append(str(e)))
 # Runtime requests remain local; all inputs below are fixed public packaged examples.
 external=[]
 p.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1:') else (external.append(r.request.url),r.abort())[1])
 both(p,'01-inicio')
 p.locator('#stationToolbar').get_by_role('button',name='Archivo',exact=False).click();both(p,'02-menu-archivo');p.keyboard.press('Escape')
 start=time.monotonic();command(p,'Archivo','RM de ejemplo · Leeds (offline)');expect(p.locator('#studySubtitle')).to_contain_text('144 instancias',timeout=120000)
 both(p,'03-leeds-2d')
 command(p,'Reconstrucción','Volumen 3D');expect(p.locator('#loading')).to_be_hidden(timeout=120000);expect(p.locator('#volumeStatus')).to_contain_text('384 × 384 × 144',timeout=60000)
 rotated(p);command(p,'Capas','Propiedades de volumen');both(p,'04-leeds-volumen-rotado')
 # Real user sliders; retain anatomically interpretable default intensity, show alternate opacity/clip.
 p.locator('#volumeOpacity').fill('65');p.locator('#volumeClip').fill('75');both(p,'05-leeds-opacidad-recorte')
 command(p,'Vistas','Inspector: mostrar / ocultar');command(p,'Vistas','Explorador: mostrar / ocultar');both(p,'06-leeds-laterales-plegados')
 command(p,'Vistas','Inspector: mostrar / ocultar');command(p,'Vistas','Explorador: mostrar / ocultar')
 command(p,'Reconstrucción','MPR');expect(p.locator('#eligibleMpr canvas')).to_be_visible()
 for axis,label in [('0','columna-fija'),('1','fila-fija'),('2','corte-original')]:
  p.select_option('#eligibleMpr select',axis);p.locator('#eligibleMpr input[type=range]').fill('60');both(p,'07-leeds-mpr-'+label)
 command(p,'Reconstrucción','Cortes 2D');command(p,'Vistas','4 ventanas');expect(p.locator('#nativeComparison .spatial-pane')).to_have_count(4);both(p,'08-leeds-cuatro-vistas')
 c=p.locator('#nativeComparison .spatial-pane canvas').nth(1);c.click();
 for w,h in SIZES:
  p.set_viewport_size({'width':w,'height':h});c.click(button='right');snap(p,'09-leeds-menu-contextual');p.keyboard.press('Escape')
 command(p,'Vistas','Ampliar vista seleccionada');both(p,'10-leeds-vista-ampliada');command(p,'Vistas','Ampliar vista seleccionada')
 command(p,'Archivo','Cerrar estudio');expect(p.locator('#studyTitle')).to_have_text('Sin estudio cargado');both(p,'11-cierre-limpio')
 command(p,'Archivo','TC de ejemplo · cinco capas expertas (offline)');expect(p.locator('#studySubtitle')).to_contain_text('130 instancias',timeout=120000);expect(p.locator('#thoraxRefStatus')).to_contain_text('Referencia vinculada',timeout=120000)
 command(p,'Capas','Máscaras y segmentación')
 for i in range(1,6):p.locator(f'#thoraxRefLayer{i}').check()
 p.locator('#thoraxRefColor1').scroll_into_view_if_needed();both(p,'12-tc-cinco-referencias-2d')
 p.locator('#thoraxRefColor5').scroll_into_view_if_needed();both(p,'13-tc-controles-inferiores')
 command(p,'Reconstrucción','Volumen 3D');expect(p.locator('#loading')).to_be_hidden(timeout=120000);expect(p.locator('#volumeStatus')).to_contain_text('512 × 512 × 130',timeout=60000)
 rotated(p);p.locator('#thoraxRefColor1').scroll_into_view_if_needed();both(p,'14-tc-volumen-cinco-capas')
 p.locator('#thoraxRef3DIsolate').check();both(p,'15-tc-capas-aisladas')
 for i in [1,2,4,5]:p.locator(f'#thoraxRefLayer{i}').uncheck()
 p.locator('#thoraxRefColor3').fill('#00ff00');p.locator('#thoraxRefAlpha3').fill('70');p.locator('#thoraxRefColor3').scroll_into_view_if_needed();both(p,'16-tc-corazon-color-opacidad')
 command(p,'Archivo','Cerrar estudio');both(p,'17-cierre-tc')
 (OUT/'functional.json').write_text(json.dumps({'errors':errors,'externalRequests':external,'seconds':round(time.monotonic()-start,1),'publicOnly':True,'privateInputs':False},indent=2),encoding='utf8')
 assert not errors,errors
 assert not external,external

def server_start(exe,port):
 proc=subprocess.Popen([str(exe),'--port',str(port)],stdout=open(OUT/f'server-{port}.log','w'),stderr=subprocess.STDOUT)
 for _ in range(150):
  if proc.poll() is not None:raise RuntimeError('Frozen server stopped')
  try:
   c=http.client.HTTPConnection('127.0.0.1',port,timeout=1);c.request('GET','/');r=c.getresponse();r.read();c.close()
   if r.status==200:return proc
  except OSError:pass
  time.sleep(.2)
 raise RuntimeError('Frozen server timeout')
def stop(proc):proc.terminate();proc.wait(timeout=15)
def native_install(setup):
 """Capture authentic NSIS desktop if runner supplies an interactive desktop."""
 import ctypes
 from PIL import ImageGrab
 from ctypes import wintypes
 user=ctypes.windll.user32
 CALLBACK=ctypes.WINFUNCTYPE(wintypes.BOOL,wintypes.HWND,wintypes.LPARAM)
 proc=subprocess.Popen([str(setup)])
 captured=False;completed=False
 try:
  for k in range(180):
   if proc.poll() is not None:break
   windows=[]
   @CALLBACK
   def window(hwnd,param):
    pid=wintypes.DWORD();user.GetWindowThreadProcessId(hwnd,ctypes.byref(pid))
    if pid.value==proc.pid and user.IsWindowVisible(hwnd):windows.append(hwnd)
    return True
   user.EnumWindows(window,0)
   if windows:
    hwnd=windows[0]
    if not captured and k>3:
     user.SetForegroundWindow(hwnd)
     try:ImageGrab.grab(all_screens=True).save(OUT/'00-windows-instalador-desktop.png');captured=True
     except Exception as e:print('NATIVE_SCREENSHOT_UNAVAILABLE '+type(e).__name__,flush=True)
    @CALLBACK
    def button(child,param):
     text=ctypes.create_unicode_buffer(256);user.GetWindowTextW(child,text,256)
     if user.IsWindowEnabled(child) and text.value.replace('&','').lower() in ['cerrar','close']:user.SendMessageW(child,0xF5,0,0)
     return True
    user.EnumChildWindows(hwnd,button,0)
   time.sleep(.5)
  if proc.poll() is None:raise RuntimeError('Native installer did not finish within 90 seconds')
  assert proc.returncode==0
  completed=True
 finally:
  if proc.poll() is None:proc.terminate();proc.wait(timeout=15)
 return {'nativeDesktopCaptured':captured,'completed':completed}
def windows(pw):
 import winreg
 base=pathlib.Path('baseline/ANATHEOS-Setup-0.10.0-beta.exe').resolve();setup=pathlib.Path('frozen/ANATHEOS-Setup-0.11.0-beta.exe').resolve()
 assert hashlib.sha256(setup.read_bytes()).hexdigest()==SHA
 assert hashlib.sha256(base.read_bytes()).hexdigest()=='f56ddce17f5bc3998678bfe6ad457afc08d70eb4ee0d6d8929599b48d17b6d64'
 root=pathlib.Path(os.environ['LOCALAPPDATA'])/'Programs/ANATHEOS';data=pathlib.Path(os.environ['LOCALAPPDATA'])/'ANATHEOS';(data/'projects').mkdir(parents=True,exist_ok=True)
 sentinel=data/'projects/acceptance-synthetic.txt';sentinel.write_text('preserve-011-acceptance')
 subprocess.run([str(base),'/S'],check=True,timeout=90)
 browser=pw.chromium.launch(args=['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']);page=browser.new_page(viewport={'width':1366,'height':768},device_scale_factor=1)
 old=root/'versions/0.10.0-beta/ANATHEOS.exe';proc=server_start(old,18965)
 try:page.goto('http://127.0.0.1:18965/');page.wait_for_timeout(1000);both(page,'baseline-010-inicio')
 finally:stop(proc)
 install=native_install(setup)
 exe=root/'versions/0.11.0-beta/ANATHEOS.exe';subprocess.run([str(exe),'--self-test'],check=True,timeout=30)
 assert sentinel.read_text()=='preserve-011-acceptance';assert old.is_file()
 dataset=root/'versions/0.11.0-beta/_internal/demos/anatheos-local-v0.5/datasets'
 sourceHashes={}
 for name,expected in [('RTKN0668_MR_DESS.zip','1c378e89d3a2e7aa57a1049f1fa91b9278529e544369d1071d4c453073ce951d'),('LCTSC_DICOM_TestData.zip','0e02554ffbf80c8c7e8f0868ec527c8ec10f7c4fd5b532c715cb3d6333676e5f')]:
  sourceHashes[name]=hashlib.sha256((dataset/name).read_bytes()).hexdigest();assert sourceHashes[name]==expected
 proc=server_start(exe,18966)
 try:page.goto('http://127.0.0.1:18966/');exercise(page)
 finally:stop(proc)
 # Execute the actual installed recovery shortcut; --port avoids opening an uncontrolled browser.
 shortcut=pathlib.Path(os.environ['APPDATA'])/'Microsoft/Windows/Start Menu/Programs/ANATHEOS/Recuperar 0.10.0.lnk'
 assert shortcut.is_file()
 script="$p=Join-Path $env:APPDATA 'Microsoft/Windows/Start Menu/Programs/ANATHEOS/Recuperar 0.10.0.lnk'; $s=(New-Object -ComObject WScript.Shell).CreateShortcut($p); $s.TargetPath"
 target=subprocess.check_output(['powershell','-NoProfile','-Command',script],text=True).strip();assert pathlib.Path(target)==old
 proc=server_start(pathlib.Path(target),18967)
 try:
  page.goto('http://127.0.0.1:18967/');page.wait_for_timeout(1000);both(page,'rollback-010-recuperada')
 finally:stop(proc)
 with winreg.OpenKey(winreg.HKEY_CURRENT_USER,r'Software\ANATHEOS') as key:registry={k:winreg.QueryValueEx(key,k)[0] for k in ['CurrentVersion','PreviousVersion']}
 assert registry=={'CurrentVersion':'0.11.0-beta','PreviousVersion':'0.10.0-beta'}
 assert sentinel.read_text()=='preserve-011-acceptance'
 (OUT/'windows-install-rollback.json').write_text(json.dumps({'installerSha256':SHA,'bytes':setup.stat().st_size,'packagedExamples':sourceHashes,'registryAfterRecovery':registry,'recoveryShortcutTarget':str(old),'projectsPreserved':True,'rollbackMeaning':'Starts retained 0.10; current 0.11 shortcut and registry remain unchanged. No uninstall or database rollback.',**install},indent=2),encoding='utf8');browser.close()
 print('FROZEN_INSTALL_OFFLINE_WINDOWS_VISUAL_ROLLBACK_PASS',flush=True)
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--windows',action='store_true');args=parser.parse_args()
 with sync_playwright() as pw:
  if args.windows:return windows(pw)
  from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
  repo=pathlib.Path(os.environ['ANATHEOS_REPO']);root=repo/'demos/anatheos-local-v0.5'
  class Handler(SimpleHTTPRequestHandler):
   def __init__(self,*a,**kw):super().__init__(*a,directory=str(root),**kw)
   def log_message(self,*a):pass
  server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
  try:
   b=pw.chromium.launch(args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']);p=b.new_page(viewport={'width':1366,'height':768},device_scale_factor=1);p.goto(f'http://127.0.0.1:{server.server_port}/');exercise(p);b.close()
  finally:server.shutdown();server.server_close()
if __name__=='__main__':main()
