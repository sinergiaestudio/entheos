"""Only synthetic DICOM + public fixture in CI. No private input argument."""
import pathlib,sys,tempfile,zipfile,subprocess,json,os,base64,io,time
from PIL import Image,ImageStat
from playwright.sync_api import sync_playwright,expect
HERE=pathlib.Path(__file__).resolve().parent;sys.path.insert(0,str(HERE.parent/'anatheos-survey'))
from test_l0 import fixture,command
from package_l1 import build

def run(package,output=None,private=False):
 launcher=package/('Start-ANATHEOS-SURVEY-L1.ps1' if sys.platform=='win32' else 'Start-ANATHEOS-SURVEY-L1.py')
 cmd=['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',str(launcher),'-NoBrowser'] if sys.platform=='win32' else [sys.executable,str(launcher),'--no-browser']
 proc=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 try:
  line=proc.stdout.readline().strip()
  if not line.startswith('ANATHEOS_SURVEY_URL='):raise AssertionError(proc.communicate(timeout=10))
  url=line.split('=',1)[1]
  with sync_playwright() as pw:
   browser=pw.chromium.launch(args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']);page=browser.new_page(viewport={'width':1366,'height':768});errors=[];external=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url) else (external.append('external'),r.abort())[1]);page.goto(url)
   page.evaluate("()=>{window.l1QA={textures:[0,0],buffers:[0,0],programs:[0,0],vaos:[0,0]};for(const [a,b,k] of [['createTexture','deleteTexture','textures'],['createBuffer','deleteBuffer','buffers'],['createProgram','deleteProgram','programs'],['createVertexArray','deleteVertexArray','vaos']])for(const [method,index] of [[a,0],[b,1]]){const f=WebGL2RenderingContext.prototype[method];WebGL2RenderingContext.prototype[method]=function(...args){const result=f.apply(this,args);if(index===0?result:args[0])window.l1QA[k][index]++;return result;};}}")
   start=time.monotonic();page.locator('#openSurveyPrototype').click();
   try:expect(page.locator('#surveyFieldScene')).to_have_attribute('data-mode','volume',timeout=15000)
   except Exception:
    print('L1_START_DIAGNOSTIC',page.locator('.spatial-pane p').all_text_contents(),page.locator('#cmrNativeStatus').text_content(),errors,flush=True);page.screenshot(path=str(pathlib.Path(tempfile.gettempdir())/'l1-diagnostic.png'));raise
   elapsed=time.monotonic()-start
   canvas=page.locator('#surveyFieldCanvas')
   roundtrips=[]
   def png():
    t=time.monotonic();result=base64.b64decode(canvas.evaluate("c=>c.toDataURL('image/png')").split(',')[1]);roundtrips.append(time.monotonic()-t);return result
   def changed(action):
    before=png();action();after=png();assert before!=after
   image=Image.open(io.BytesIO(png())).convert('RGB');assert max(ImageStat.Stat(image).stddev)>4
   # Volume is rendered with the original-plane overlay OFF, not a stack of quads.
   expect(page.locator('#l1Original')).not_to_be_checked()
   box=canvas.bounding_box()
   def rotate():
    page.mouse.move(box['x']+box['width']*.5,box['y']+box['height']*.5);page.mouse.down();page.mouse.move(box['x']+box['width']*.45,box['y']+box['height']*.46,steps=3);page.mouse.up()
   changed(rotate);changed(lambda:page.locator('#l1Clip').fill('0.65'));page.locator('#l1Clip').fill('1');changed(lambda:page.locator('#l1Opacity').fill('0.65'));page.locator('#l1Opacity').fill('1.8');changed(lambda:page.locator('#l1Confidence').uncheck());page.locator('#l1Confidence').check()
   page.locator('#l1Pile').select_option('2');expect(page.locator('#surveyFieldScene')).to_have_attribute('data-group','2');changed(lambda:page.locator('#l1Estimate').uncheck());page.locator('#l1Estimate').check();changed(lambda:page.locator('#l1Nominal').uncheck());page.locator('#l1Nominal').check();changed(lambda:page.locator('#l1MaskOnly').check());page.locator('#l1MaskOnly').uncheck();changed(lambda:page.locator('#l1Original').check());page.locator('#l1Original').uncheck()
   if output:
    output.mkdir(parents=True,exist_ok=True)
    for w,h in [(1366,768),(1920,1080)]:
     page.set_viewport_size({'width':w,'height':h});page.screenshot(path=str(output/f'{"private" if private else "synthetic"}-volume-{w}x{h}.png'));page.locator('#l1Estimate').uncheck();page.screenshot(path=str(output/f'{"private" if private else "synthetic"}-estimate-off-{w}x{h}.png'));page.locator('#l1Estimate').check()
    page.locator('#l1MaskOnly').check();page.screenshot(path=str(output/'support-mask-1920x1080.png'));page.locator('#l1MaskOnly').uncheck();page.locator('#l1Original').check();page.screenshot(path=str(output/'original-plane-overlay-1920x1080.png'));page.locator('#l1Original').uncheck()
   page.locator('#l1Mode').select_option('points');expect(page.locator('#surveyFieldScene')).to_have_attribute('data-mode','points');changed(lambda:page.locator('#l1Groups').check());changed(lambda:page.locator('#l1EstimatedPoints').check());changed(lambda:page.locator('#l1Estimate').uncheck());page.locator('#l1Estimate').check()
   if output:
    for w,h in [(1366,768),(1920,1080)]:page.set_viewport_size({'width':w,'height':h});page.screenshot(path=str(output/f'{"private" if private else "synthetic"}-signal-points-{w}x{h}.png'))
   gl_error=canvas.evaluate("c=>c.getContext('webgl2').getError()");assert gl_error==0
   stats=page.locator('#surveyFieldScene').evaluate("n=>({fieldBytes:Number(n.dataset.fieldBytes),lastDrawMs:Number(n.dataset.drawMs),points:Number(n.dataset.points)})")
   # Returning to volume must restore the original quad/program state after points.
   page.locator('#l1Mode').select_option('volume');assert max(ImageStat.Stat(Image.open(io.BytesIO(png())).convert('RGB')).stddev)>4
   canvas.focus();page.keyboard.press('Escape');expect(page.locator('#surveyFieldScene')).to_have_count(0);expect(page.locator('#surveyFieldInspector')).to_have_count(0)
   command(page,'Reconstrucción','Volumen exploratorio · SURVEY L1');expect(page.locator('#surveyFieldScene')).to_have_attribute('data-mode','volume');command(page,'Archivo','Cerrar estudio');expect(page.locator('#surveyFieldScene')).to_have_count(0);expect(page.locator('#surveyFieldInspector')).to_have_count(0)
   resources=page.evaluate('window.l1QA');assert all(v[0]==v[1] for v in resources.values()),resources;assert not errors,errors;assert not external,external
   browser.close();result={'result':'PASS','host':sys.platform,'server':'PowerShell loopback' if sys.platform=='win32' else 'Python stdlib loopback','browser':'Chromium SwiftShader','fixture':'REAL PRIVATE SURVEY' if private else 'synthetic DICOM 60/3x20','volume_without_original_planes':'PASS','rotation_clip_opacity_support_original_overlay':'PASS','estimation_and_nominal_off':'PASS','signal_cloud_groups_estimated_points':'PASS','lifecycle_resources':resources,'javascript_errors':0,'external_requests':0,'load_seconds':elapsed,'WebGL_error':gl_error,'synchronous_PNG_readback_roundtrip_seconds_median':sorted(roundtrips)[len(roundtrips)//2],'readback_note':'Includes QA bridge, GPU completion and PNG encoding; not pure GPU time or FPS',**stats};print(json.dumps(result));return result
 finally:proc.terminate();proc.communicate(timeout=10)

def main():
 with tempfile.TemporaryDirectory() as temp:
  root=pathlib.Path(temp);fixture(root/'data');build(root/'data',root/'l1.zip','synthetic-ci')
  with zipfile.ZipFile(root/'l1.zip') as z:z.extractall(root/'unpack')
  run(root/'unpack/ANATHEOS-SURVEY-L1',pathlib.Path(os.environ['L1_QA_OUTPUT']) if os.environ.get('L1_QA_OUTPUT') else None)
if __name__=='__main__':main()
