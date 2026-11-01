"""P0 regressions: same assertions must fail on frozen 0.11 and pass on hotfix.
Only the two public, packaged example datasets are opened. No clinical fixtures.
"""
import argparse,json,pathlib,threading,os
from http.server import ThreadingHTTPServer
from playwright.sync_api import sync_playwright,expect
from test_native import Handler,ROOT
from test_station import command

def physical_ratios():
 import hashlib,zipfile,io,pydicom,numpy as np
 blob=(ROOT/'datasets/RTKN0668_MR_DESS.zip').read_bytes();assert hashlib.sha256(blob).hexdigest()=='1c378e89d3a2e7aa57a1049f1fa91b9278529e544369d1071d4c453073ce951d'
 with zipfile.ZipFile(io.BytesIO(blob)) as z:
  headers=[pydicom.dcmread(io.BytesIO(z.read(n)),stop_before_pixels=True) for n in z.namelist() if not n.endswith('/')]
 f=headers[0];normal=np.cross(np.array(f.ImageOrientationPatient[:3],float),np.array(f.ImageOrientationPatient[3:],float));positions=sorted(float(np.dot(np.array(d.ImagePositionPatient,float),normal)) for d in headers);step=float(np.median(np.diff(positions)));y=float(f.Rows)*float(f.PixelSpacing[0]);x=float(f.Columns)*float(f.PixelSpacing[1]);z=len(headers)*step
 return [y/z,x/z,x/y]

def checks(page,baseline=False,folder=None):
 results={};ratios=physical_ratios();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def check(name,fn):
  try:fn();results[name]={'pass':True}
  except (AssertionError,Exception) as e:results[name]={'pass':False,'reason':str(e)[:450]}
 def screenshot(name):
  if folder:
   folder.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(folder/(name+'.png')),timeout=20000)
 command(page,'Archivo','RM de ejemplo · Leeds (offline)');expect(page.locator('#studySubtitle')).to_contain_text('144 instancias',timeout=120000)
 command(page,'Vistas','4 ventanas')
 if not baseline:
  canvas=page.locator('#nativeComparison .spatial-pane canvas').nth(1);canvas.click();before=canvas.evaluate('e=>e.style.transform');command(page,'Herramientas','Acercar');assert canvas.evaluate('e=>e.style.transform')!=before
  command(page,'Herramientas','Desplazar');box=canvas.bounding_box();page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();page.mouse.move(box['x']+box['width']/2+12,box['y']+box['height']/2+8);page.mouse.up()
  for w,h in [(1366,768),(1920,1080)]:
   page.set_viewport_size({'width':w,'height':h});canvas.click(button='right');expect(page.get_by_role('menu',name='Acciones de la vista')).to_be_visible();screenshot(f'09-context-{w}x{h}');page.keyboard.press('Escape');expect(page.get_by_role('menu',name='Acciones de la vista')).to_be_hidden()
   command(page,'Vistas','Ampliar vista seleccionada');screenshot(f'10-focus-{w}x{h}');command(page,'Vistas','Ampliar vista seleccionada')
 command(page,'Archivo','Cerrar estudio')
 def closed():
  assert page.locator('#stationViewControls input,#stationViewControls select,#stationViewControls button').count()==0,'Inspector retains series/view controls after close'
  assert page.locator('#eligibleMpr').count()==0
  assert page.locator('#thoraxReferencePanel input').count()==0,'Reference controls still mounted without study'
 check('P0_CLOSE_NATIVE',closed)
 for w,h in [(1366,768),(1920,1080)]:page.set_viewport_size({'width':w,'height':h});screenshot(f'11-close-native-{w}x{h}')
 command(page,'Archivo','RM de ejemplo · Leeds (offline)');expect(page.locator('#studySubtitle')).to_contain_text('144 instancias',timeout=120000)
 command(page,'Reconstrucción','MPR');expect(page.locator('#eligibleMpr canvas')).to_be_visible()
 for width,height in [(1366,768),(1920,1080)]:
  page.set_viewport_size({'width':width,'height':height})
  for axis in ['0','1','2']:
   page.select_option('#eligibleMpr select',axis);page.locator('#eligibleMpr input[type=range]').fill('60')
   def fit():
    c=page.locator('#eligibleMpr canvas').bounding_box();v=page.locator('#viewerRoot').bounding_box()
    intrinsic=page.locator('#eligibleMpr canvas').evaluate('e=>[e.width,e.height,getComputedStyle(e).objectFit]')
    if intrinsic[2]=='contain':
     scale=min(c['width']/intrinsic[0],c['height']/intrinsic[1]);c={**c,'width':intrinsic[0]*scale,'height':intrinsic[1]*scale}
    assert c['width']>=v['width']*.70 or c['height']>=v['height']*.65,('MPR does not fit available image area',c,v)
    assert c['x']>=v['x'] and c['y']>=v['y'] and c['x']+c['width']<=v['x']+v['width']+1 and c['y']+c['height']<=v['y']+v['height']+1
   check(f'P0_MPR_FIT_{width}_{axis}',fit)
   def aspect():
    c=page.locator('#eligibleMpr canvas').bounding_box();intrinsic=page.locator('#eligibleMpr canvas').evaluate('e=>[e.width,e.height,getComputedStyle(e).objectFit]');ratio=c['width']/c['height'] if intrinsic[2]!='contain' else intrinsic[0]/intrinsic[1]
    assert abs(ratio-ratios[int(axis)])<.01,('MPR display must preserve DICOM physical aspect',ratio,ratios[int(axis)])
   check(f'P0_MPR_PHYSICAL_ASPECT_{width}_{axis}',aspect)
   def reading():
    text=page.locator('#mprPosition').text_content(timeout=1000);assert '61 / '+('144' if axis=='2' else '384') in text,text
    assert ['Columna fija','Fila fija','Corte original'][int(axis)] in text,text
    assert '73 / 144' in page.locator('#mprSource').text_content()
    assert not page.locator('.sliceBar').is_visible(),'Source slice slider ambiguous in MPR'
   check(f'P0_MPR_READING_{width}_{axis}',reading)
   if not baseline:
    command(page,'Navegación','Corte siguiente');expect(page.locator('#mprPosition')).to_contain_text('62 /');command(page,'Navegación','Corte anterior');expect(page.locator('#mprPosition')).to_contain_text('61 /')
   screenshot(f'07-mpr-{axis}-{width}x{height}')
 command(page,'Reconstrucción','Cortes 2D');command(page,'Archivo','TC de ejemplo · cinco capas expertas (offline)')
 expect(page.locator('#thoraxRefStatus')).to_contain_text('Referencia vinculada',timeout=120000);command(page,'Capas','Máscaras y segmentación')
 def contrast():
  ratio=page.locator('#thoraxRefLayer1').evaluate('''e=>{const l=e.closest('label'),s=l.querySelector('span');const rgb=x=>x.match(/[\\d.]+/g).slice(0,3).map(Number);const lum=a=>a.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((s,x,k)=>s+x*[.2126,.7152,.0722][k],0);const a=lum(rgb(getComputedStyle(s).color)),b=lum(rgb(getComputedStyle(l).backgroundColor));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)}''')
  assert ratio>=4.5,('CT reference text contrast below WCAG AA',ratio)
 check('P0_CT_CONTRAST',contrast)
 def semantics():
  text=page.locator('#uxN5MeshState').text_content();assert 'Referencias expertas: 5' in text and 'Máscaras manuales: 0' in text,text
 check('P0_CT_SEMANTICS',semantics)
 for width,height in [(1366,768),(1920,1080)]:
  page.set_viewport_size({'width':width,'height':height});page.locator('#thoraxRefColor1').scroll_into_view_if_needed();screenshot(f'12-ct-{width}x{height}')
  def compact():
   panel=page.locator('#uxLayersPanel');metric=panel.evaluate('e=>[e.scrollHeight,e.clientHeight]');assert metric[0]<=metric[1]*2.3,('Default CT inspector still too long',metric)
  check(f'P1_INSPECTOR_{width}',compact)
 command(page,'Archivo','Cerrar estudio');check('P0_CLOSE_CT',closed)
 for w,h in [(1366,768),(1920,1080)]:page.set_viewport_size({'width':w,'height':h});screenshot(f'17-close-ct-{w}x{h}')
 command(page,'Archivo','RM de ejemplo · Leeds (offline)');expect(page.locator('#studySubtitle')).to_contain_text('144 instancias',timeout=120000)
 def replaced():
  assert page.locator('#thoraxRefLayer1').count()==0,'Old CT reference UI survives replacement by Leeds'
  assert 'Referencias expertas: 0' in page.locator('#uxN5MeshState').text_content()
 check('P0_REPLACE_CT_LEEDS',replaced);command(page,'Archivo','Cerrar estudio')
 assert not errors,errors
 failed=[k for k,v in results.items() if not v['pass']]
 if baseline:
  for prefix in ['P0_CLOSE_NATIVE','P0_CLOSE_CT','P0_MPR_FIT','P0_MPR_READING','P0_CT_CONTRAST','P0_CT_SEMANTICS']:
   assert any(k.startswith(prefix) for k in failed),('Baseline did not reproduce required defect',prefix,results)
 else:assert not failed,json.dumps(results,indent=2)
 return results

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--baseline',action='store_true');ap.add_argument('--url');ap.add_argument('--output',default='hotfix-qa');args=ap.parse_args();folder=pathlib.Path(args.output);folder.mkdir(parents=True,exist_ok=True)
 server=None
 if not args.url:
  server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();args.url=f'http://127.0.0.1:{server.server_port}/'
 try:
  with sync_playwright() as pw:
   b=pw.chromium.launch(args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']);p=b.new_page(viewport={'width':1366,'height':768});p.goto(args.url)
   try:r=checks(p,args.baseline,folder)
   finally:b.close()
   (folder/'p0-results.json').write_text(json.dumps({'expectedFailure':args.baseline,'results':r},indent=2));print('EXPECTED_BASELINE_DEFECTS_REPRODUCED' if args.baseline else 'ACCEPTANCE_P0_P1_PASS',flush=True)
 finally:
  if server:server.shutdown();server.server_close()
if __name__=='__main__':main()
