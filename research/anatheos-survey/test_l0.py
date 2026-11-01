"""Synthetic DICOM + public pydicom MR fixture; NEVER accepts patient inputs."""
import pathlib,sys,tempfile,json,hashlib,zipfile,io,subprocess,os,time,base64,urllib.request,urllib.error
import numpy as np
from PIL import Image,ImageStat
import pydicom
from pydicom.dataset import FileDataset,FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian,MRImageStorage,generate_uid
from pydicom.data import get_testdata_file
from playwright.sync_api import sync_playwright,expect
HERE=pathlib.Path(__file__).resolve().parent;REPO=HERE.parents[1]
sys.path.insert(0,str(REPO/'research/anatheos-cmr/r2'))
from preparar_todas_las_series import frame_record,SCHEMA
from auditar_dicom_offline import parse_dicom
from package_prototype import build

def fixture(dest):
 (dest/'RM-001').mkdir(parents=True);frames=[];arrays=[];study=generate_uid();series=generate_uid();fo=generate_uid()
 # Oblique/non-square and anisotropic phantom, two overlapping groups + gaps.
 for g in range(3):
  for k in range(20):
   o=[[1,0,0,0,1,0],[0,1,0,0,0,1],[1,0,0,0,0,-1]][g];pos=[[0,0,k*3],[k*3,0,0],[0,k*5,60]][g]
   fm=FileMetaDataset();fm.TransferSyntaxUID=ExplicitVRLittleEndian;fm.MediaStorageSOPClassUID=MRImageStorage;fm.MediaStorageSOPInstanceUID=generate_uid();fm.ImplementationClassUID=generate_uid()
   ds=FileDataset('synthetic',{},file_meta=fm,preamble=b'\0'*128);ds.SOPClassUID=MRImageStorage;ds.SOPInstanceUID=fm.MediaStorageSOPInstanceUID;ds.StudyInstanceUID=study;ds.SeriesInstanceUID=series;ds.FrameOfReferenceUID=fo;ds.Modality='MR';ds.ImageType=['ORIGINAL','PRIMARY','M'];ds.ImageOrientationPatient=o;ds.ImagePositionPatient=pos;ds.PixelSpacing=[1.5,.8];ds.Rows=64;ds.Columns=96;ds.SliceThickness=4;ds.SamplesPerPixel=1;ds.PhotometricInterpretation='MONOCHROME2';ds.BitsAllocated=16;ds.BitsStored=16;ds.HighBit=15;ds.PixelRepresentation=0;ds.InstanceNumber=len(frames)+1;ds.RescaleSlope=2;ds.RescaleIntercept=-10
   y,x=np.mgrid[:64,:96];a=np.where((x-48)**2/38**2+(y-32)**2/23**2<1,600+x*8+y*2+k*3,15).astype('<u2');a[:10,:10]=1700;a[-9:,-9:]=250;ds.PixelData=a.tobytes();b=io.BytesIO();ds.save_as(b,enforce_file_format=True);raw=b.getvalue();f=frame_record(parse_dicom(raw),raw)
   assert np.array_equal(pydicom.dcmread(io.BytesIO(raw)).pixel_array,a)
   assert np.allclose(f['image_position_patient_LPS_mm'],pos);frames.append(f);arrays.append(a)
 folder=dest/'RM-001';np.save(folder/'pixels_original_decoded.npy',np.stack(arrays),allow_pickle=False)
 sourcehash=hashlib.sha256(b'synthetic-phantom-only').hexdigest();meta={'schema':SCHEMA,'serie_local':'RM-001','source_zip_sha256':sourcehash,'frames':frames};(folder/'geometria_privada.json').write_text(json.dumps(meta))
 integrity={'source_zip_sha256':sourcehash,'pixels_sha256':hashlib.sha256((folder/'pixels_original_decoded.npy').read_bytes()).hexdigest(),'geometria_sha256':hashlib.sha256((folder/'geometria_privada.json').read_bytes()).hexdigest()};(folder/'integridad_R2.json').write_text(json.dumps(integrity))
 (dest/'catalogo_local_privado.json').write_text(json.dumps({'schema':SCHEMA,'series':[{'serie_local':'RM-001','estado':'preparada','instancias':60,'modo_seguro':'localizador_2d','familia_probable':'survey_localizador'}],'series_detectadas':1,'series_preparadas':1,'instancias_preparadas':60}))

def command(page,menu,text):
 page.locator('#stationToolbar').get_by_role('button',name=menu,exact=False).click();page.locator('.station-menu:popover-open').get_by_role('menuitem',name=text,exact=True).click()
def run(package,output=None):
 if sys.platform=='win32':cmd=['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',str(package/'Start-ANATHEOS-SURVEY-L0.ps1'),'-NoBrowser']
 else:cmd=[sys.executable,str(package/'Start-ANATHEOS-SURVEY-L0.py'),'--no-browser']
 proc=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 try:
  line=proc.stdout.readline().strip();assert line.startswith('ANATHEOS_SURVEY_URL='),line;url=line.split('=',1)[1]
  for path,host in [('../not-allowed',''),('index.html','evil.example')]:
   req=urllib.request.Request(url+path,headers={'Host':host} if host else {})
   try:urllib.request.urlopen(req);raise AssertionError('Bad request accepted')
   except urllib.error.HTTPError as e:assert e.code in [403,404]
  with sync_playwright() as pw:
   browser=pw.chromium.launch(args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']);page=browser.new_page(viewport={'width':1366,'height':768});errors=[];external=[]
   page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/*',lambda route:route.continue_() if route.request.url.startswith(url) else (external.append('blocked_external'),route.abort())[1]);page.goto(url)
   page.evaluate("()=>{window.l0ResourceQA={created:0,deleted:0};for(const [m,k] of [['createTexture','created'],['deleteTexture','deleted']]){const f=WebGL2RenderingContext.prototype[m];WebGL2RenderingContext.prototype[m]=function(...a){window.l0ResourceQA[k]++;return f.apply(this,a);};}}")
   page.locator('#openSurveyPrototype').click();expect(page.locator('#originalPlaneScene')).to_have_attribute('data-loaded-planes','60',timeout=30000);expect(page.locator('#originalPlaneScene')).to_have_attribute('data-visible-planes','3');expect(page.locator('body')).to_have_attribute('data-station-mode','planes')
   expect(page.locator('#studySubtitle')).to_contain_text('60 imágenes')
   expect(page.locator('#stationL0Inspector fieldset')).to_have_count(3)
   canvas=page.locator('#originalPlaneCanvas')
   def png():return base64.b64decode(canvas.evaluate("c=>c.toDataURL('image/png')").split(',',1)[1])
   before=png();assert max(ImageStat.Stat(Image.open(io.BytesIO(before)).convert('RGB')).stddev)>4
   box=canvas.bounding_box();page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();page.mouse.move(box['x']+box['width']*.65,box['y']+box['height']*.56,steps=8);page.mouse.up();rotated=png();
   assert before!=rotated
   page.locator('#l0Opacity0').fill('20');alpha=png();assert alpha!=rotated
   page.locator('#l0Group1').uncheck();expect(page.locator('#originalPlaneScene')).to_have_attribute('data-visible-planes','2');hidden=png();assert hidden!=alpha;page.locator('#l0Group1').check()
   page.locator('#l0Slice2').fill('2');assert png()!=hidden
   page.locator('#l0Intersections').uncheck();no_intersection=png();page.locator('#l0Intersections').check();assert png()!=no_intersection
   page.locator('#l0Gaps').uncheck();no_gaps=png();page.locator('#l0Gaps').check();assert png()!=no_gaps
   page.locator('#l0SelectedOnly').uncheck();expect(page.locator('#originalPlaneScene')).to_have_attribute('data-visible-planes','60');all_frame=png();assert all_frame!=before
   if output:
    output.mkdir(parents=True,exist_ok=True)
    for w,h in [(1366,768),(1920,1080)]:
     page.set_viewport_size({'width':w,'height':h});page.screenshot(path=str(output/f'synthetic-all60-{w}x{h}.png'))
    page.locator('#l0SelectedOnly').check();page.screenshot(path=str(output/'synthetic-selected.png'))
   page.locator('#originalPlaneCanvas').focus();page.keyboard.press('Escape');expect(page.locator('#originalPlaneScene')).to_have_count(0);expect(page.locator('#stationL0Inspector')).to_have_count(0)
   command(page,'Reconstrucción','Planos originales 3D · SURVEY L0');expect(page.locator('#originalPlaneScene')).to_have_attribute('data-loaded-planes','60')
   command(page,'Archivo','Cerrar estudio');expect(page.locator('#originalPlaneScene')).to_have_count(0);expect(page.locator('#stationL0Inspector')).to_have_count(0);expect(page.locator('#studyTitle')).to_have_text('Sin estudio cargado')
   resources=page.evaluate('window.l0ResourceQA');assert resources['created']==resources['deleted'],resources
   # Public MR_small: exercise real open fixture, no patient inputs or Leeds.
   raw=pathlib.Path(get_testdata_file('MR_small.dcm')).read_bytes();ds=pydicom.dcmread(io.BytesIO(raw));a=ds.pixel_array
   f=frame_record(parse_dicom(raw),raw);f['rescale_slope']=f['rescale_slope'] if f['rescale_slope'] is not None else 1;f['rescale_intercept']=f['rescale_intercept'] if f['rescale_intercept'] is not None else 0
   # MR_small lacks optional study/FoR in some releases: preserve real pose,
   # use explicit test identity aliases only, never claim an interseries match.
   for k in ['study_instance_uid','series_instance_uid','frame_of_reference_uid']:f[k]=f[k] or 'public-fixture-'+k
   public={'id':'pydicom-public-MR-small','frames':[f],'decoded':{'dims':[1,int(ds.Rows),int(ds.Columns)],'values':a.ravel().tolist()}}
   result=page.evaluate("""async data=>{const {buildOriginalPlaneScene,planeMesh,grayTexture}=await import('./original-planes.mjs');const {SurfaceRenderer}=await import('./surface-renderer.mjs');data.decoded.pixels=new Uint16Array(data.decoded.values);const model=buildOriginalPlaneScene(data);const c=document.createElement('canvas');c.style='position:fixed;left:0;top:0;width:300px;height:300px';document.body.append(c);const r=new SurfaceRenderer(c);const p=model.planes[0],values=[...p.pixels].map(v=>v*(p.frame.rescale_slope??1)+(p.frame.rescale_intercept??0)),lo=Math.min(...values),hi=Math.max(...values);r.add({...planeMesh(p),grayPixels:grayTexture(p,(hi+lo)/2,hi-lo),width:p.cols,height:p.rows});r.draw();const bytes=c.toDataURL();const stats={planes:model.planes.length,encoded:bytes.length,image:bytes};r.dispose();c.remove();return stats;}""",public)
   assert result['planes']==1 and result['encoded']>500
   public_image=Image.open(io.BytesIO(base64.b64decode(result['image'].split(',')[1]))).convert('RGB');assert max(ImageStat.Stat(public_image).stddev)>4
   legacy=page.evaluate("""async()=>{const {SurfaceRenderer}=await import('./surface-renderer.mjs');const c=document.createElement('canvas');c.style='position:fixed;left:0;top:0;width:300px;height:300px';document.body.append(c);const r=new SurfaceRenderer(c);r.yaw=0;r.pitch=0;r.add({positions:new Float32Array([0,0,0,1,0,0,0,1,0]),normals:new Float32Array([0,0,1,0,0,1,0,0,1]),bounds:{min:[0,0,0],max:[1,1,0]}});r.draw();const result={image:c.toDataURL(),error:r.gl.getError()};r.dispose();c.remove();return result;}""")
   assert legacy['error']==0;legacy_image=Image.open(io.BytesIO(base64.b64decode(legacy['image'].split(',')[1]))).convert('RGB');assert max(ImageStat.Stat(legacy_image).stddev)>4
   assert not errors,errors;assert not external,external
   browser.close();print(json.dumps({'synthetic_dicom':60,'groups':[20,20,20],'rotation':'PASS','independent_opacity_visibility_intersection_gap_controls':'PASS','lifecycle_resources':resources,'public_fixture':'pydicom MR_small.dcm','public_sha256':hashlib.sha256(raw).hexdigest(),'public_render':'PASS','legacy_opaque_surface_render':'PASS','javascript_errors':0,'external_requests':0,'os':sys.platform,'server':'PowerShell loopback' if sys.platform=='win32' else 'Python stdlib loopback'}),flush=True)
 finally:proc.terminate();proc.communicate(timeout=10)
def main():
 with tempfile.TemporaryDirectory() as t:
  root=pathlib.Path(t);data=root/'data';fixture(data);build(data,root/'prototype.zip','synthetic-source-QA')
  with zipfile.ZipFile(root/'prototype.zip') as z:z.extractall(root/'unpacked')
  run(root/'unpacked/ANATHEOS-SURVEY-L0',pathlib.Path(os.environ['L0_QA_OUTPUT']) if os.environ.get('L0_QA_OUTPUT') else None)
if __name__=='__main__':main()
