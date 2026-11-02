"""Synthetic-only entrypoint; private runner may reuse run outside CI."""
import sys,pathlib,tempfile,zipfile,subprocess,base64,io,json,time,os
from PIL import Image,ImageStat
from playwright.sync_api import sync_playwright,expect
HERE=pathlib.Path(__file__).resolve().parent;sys.path.insert(0,str(HERE.parent/'anatheos-survey'));from test_l0 import fixture,command
from package_vt import build

def run(package,output=None,private=False):
 launcher=package/('Start-ANATHEOS-VISUAL-TARGET-01.ps1' if sys.platform=='win32' else 'Start-ANATHEOS-VISUAL-TARGET-01.py');args=['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',str(launcher),'-NoBrowser'] if sys.platform=='win32' else [sys.executable,str(launcher),'--no-browser'];proc=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 try:
  line=proc.stdout.readline().strip()
  if not line.startswith('ANATHEOS_SURVEY_URL='):raise AssertionError(proc.communicate(timeout=10))
  url=line.split('=',1)[1]
  with sync_playwright() as pw:
   browser=pw.chromium.launch(args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']);page=browser.new_page(viewport={'width':1366,'height':768});errors=[];external=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url) else (external.append('blocked'),r.abort())[1]);page.goto(url)
   page.evaluate("()=>{window.vtResources={textures:[0,0],buffers:[0,0],programs:[0,0],vaos:[0,0]};for(const [a,b,key]of[['createTexture','deleteTexture','textures'],['createBuffer','deleteBuffer','buffers'],['createProgram','deleteProgram','programs'],['createVertexArray','deleteVertexArray','vaos']])for(const[m,i]of[[a,0],[b,1]]){const fn=WebGL2RenderingContext.prototype[m];WebGL2RenderingContext.prototype[m]=function(...v){const r=fn.apply(this,v);if(i===0?r:v[0])window.vtResources[key][i]++;return r;};}}")
   start=time.monotonic();page.locator('#openSurveyPrototype').click()
   try:expect(page.locator('#surveyFieldScene')).to_have_attribute('data-vt-planes','false',timeout=30000)
   except Exception:
    print('VT_START_FAIL',page.locator('.spatial-pane p').all_text_contents(),errors,flush=True);raise
   load=time.monotonic()-start;canvas=page.locator('#surveyFieldCanvas');roundtrips=[]
   def png():
    t=time.monotonic();data=base64.b64decode(canvas.evaluate('c=>c.toDataURL()').split(',')[1]);roundtrips.append(time.monotonic()-t);return data
   def changed(action,label):
    before=png();action();after=png();assert before!=after,label
   def shot(name):
    print('VT_STAGE',name,flush=True)
    if output:
     output.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(output/(name+'.png')))
   assert max(ImageStat.Stat(Image.open(io.BytesIO(png())).convert('RGB')).stddev)>4
   expect(page.locator('#vtPlanes')).not_to_be_checked();page.locator('#vtCut').uncheck();box=canvas.bounding_box()
   def orbit():
    page.mouse.move(box['x']+box['width']*.5,box['y']+box['height']*.5);page.mouse.down();page.mouse.move(box['x']+box['width']*.45,box['y']+box['height']*.46,steps=2);page.mouse.up()
   changed(orbit,'volume rotates without planes')
   for w,h in [(1366,768),(1920,1080)]:page.set_viewport_size({'width':w,'height':h});shot(f'volume-no-planes-{w}x{h}')
   changed(lambda:page.locator('#vtCut').check(),'cutaway enables');page.set_viewport_size({'width':1366,'height':768})
   dims=[int(page.locator(f'#vtPosition{a}').get_attribute('max'))+1 for a in range(3)]
   for a in range(3):
    page.locator('#vtCutAxis').select_option(str(a));changed(lambda a=a:page.locator(f'#vtPosition{a}').fill(str(int(dims[a]*.62))),f'plane {a} changes central cut')
    centers=[page.locator(f'#vtMpr{k}').get_attribute('data-lps') for k in range(3)];assert len(set(centers))==1,centers;shot(f'cut-axis-{a}-1366x768')
   page.locator('#vtCutAxis').select_option('2');page.locator('#vtTool').select_option('cut');before=page.locator('#surveyFieldScene').get_attribute('data-vt-cursor');box=canvas.bounding_box();page.mouse.move(box['x']+box['width']*.5,box['y']+box['height']*.5);page.mouse.down();page.mouse.move(box['x']+box['width']*.58,box['y']+box['height']*.54,steps=2);page.mouse.up();assert page.locator('#surveyFieldScene').get_attribute('data-vt-cursor')!=before,'drag moved cut';page.locator('#vtTool').select_option('orbit')
   page.locator('#vtCutAxis').select_option('3');page.locator('#vtDisplayOptions').evaluate('n=>n.open=true');changed(lambda:page.locator('#vtAzimuth').fill('55'),'oblique normal changes cut');changed(lambda:page.locator('#vtOffset').fill('15'),'oblique physical offset changes cut');shot('oblique-cut-1366x768');page.locator('#vtOffset').fill('0');page.locator('#vtCutAxis').select_option('2')
   changed(lambda:page.locator('#vtPlanes').check(),'reference planes shown');shot('reference-planes-1366x768');page.locator('#vtPlanes').uncheck()
   page.locator('#vtCompare').check();page.locator('#l1OriginalSlice').fill('8');expect(page.locator('#vtOriginalCard')).to_be_visible();assert 'ORIGINAL DICOM' in page.locator('#vtOriginalCard').inner_text();assert page.locator('#vtMpr2').get_attribute('data-kind')=='derived';shot('original-vs-derived-1366x768')
   page.locator('#l1Pile').select_option('2');changed(lambda:page.locator('#vtAcquiredOnly').check(),'acquired-only keeps holes');shot('acquired-only-1366x768');page.locator('#vtAcquiredOnly').uncheck();changed(lambda:page.locator('#l1Estimate').uncheck(),'estimated off');page.locator('#l1Estimate').check();changed(lambda:page.locator('#l1Nominal').uncheck(),'nominal off');page.locator('#l1Nominal').check()
   page.locator('#vtPreset').select_option('1');page.get_by_role('button',name='Guardar ajuste de sesión').click();assert page.locator('#vtPreset option').count()==4
   for w,h in [(1366,768),(1920,1080)]:page.set_viewport_size({'width':w,'height':h});shot(f'cut-mpr-comparison-{w}x{h}')
   page.locator('#vtCard0>button').click();expect(page.locator('#surveyFieldScene')).to_have_class(__import__('re').compile('vt-expanded-mpr'));page.locator('#vtMpr0').focus();page.keyboard.press('Escape');assert 'vt-expanded-mpr' not in page.locator('#surveyFieldScene').get_attribute('class')
   gl_error=canvas.evaluate("c=>c.getContext('webgl2').getError()");assert gl_error==0
   canvas.focus();page.keyboard.press('Escape');expect(page.locator('#vtMprStrip')).to_have_count(0);command(page,'Reconstrucción','Volumen + MPR · VISUAL-TARGET-01');expect(page.locator('#vtMprStrip')).to_have_count(1);command(page,'Archivo','Cerrar estudio');expect(page.locator('#surveyFieldScene')).to_have_count(0);expect(page.locator('#vtMprStrip')).to_have_count(0)
   resources=page.evaluate('window.vtResources');assert all(a==b for a,b in resources.values()),resources;assert not errors,errors;assert not external,external
   result={'result':'PASS','dataset':'PRIVATE SURVEY' if private else 'synthetic DICOM','host':sys.platform,'backend':'Chromium SwiftShader','volume_no_planes_rotation':'PASS','three_MPR_linked_cut_LPS_crosshair':'PASS','cut_drag_oblique_translation':'PASS','original_vs_derived':'PASS','acquired_only_nominal_estimated_off':'PASS','display_presets':'PASS','resolutions':['1366x768','1920x1080'],'lifecycle_resources':resources,'WebGL_error':gl_error,'javascript_errors':0,'external_requests':0,'load_seconds':load,'synchronous_PNG_roundtrip_median_seconds':sorted(roundtrips)[len(roundtrips)//2],'timing_scope':'QA bridge + GPU + PNG, not pure GPU/FPS','fusion':False};print(json.dumps(result),flush=True);browser.close();return result
 finally:proc.terminate();proc.communicate(timeout=10)
def main():
 with tempfile.TemporaryDirectory() as t:
  r=pathlib.Path(t);fixture(r/'data');build(r/'data',r/'vt.zip','synthetic-QA')
  with zipfile.ZipFile(r/'vt.zip') as z:z.extractall(r/'unpack')
  run(r/'unpack/ANATHEOS-VISUAL-TARGET-01',pathlib.Path(os.environ['VT_QA_OUTPUT']) if os.environ.get('VT_QA_OUTPUT') else None)
if __name__=='__main__':main()
