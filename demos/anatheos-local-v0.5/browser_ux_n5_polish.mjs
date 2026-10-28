import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const host='http://127.0.0.1:8774/';
const fake=await readFile('/tmp/anatheos-uxn2-test.zip');
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[],offsite=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(!r.url().startsWith(host))offsite.push(r.url())});
 await page.route('**/datasets/RTKN0668_MR_DESS.zip',route=>route.request().method()==='HEAD'
  ?route.fulfill({status:200,headers:{'content-type':'application/zip','content-length':String(fake.length)},body:''})
  :route.fulfill({status:200,contentType:'application/zip',body:fake}));
 await page.goto(host,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelector('#studyTitle')?.textContent==='SYNTHETIC_TEST_NOT_PATIENT',null,{timeout:30000});
 assert.equal(await page.locator('#uxN5Evidence').isVisible(),true);
 assert.equal(await page.locator('#uxN5MeshState').innerText(),'Sin máscaras');
 assert.equal(await page.locator('#uxLayerExternal').isVisible(),false);
 assert.equal(await page.locator('.surface-row').count(),0,'No synthetic/invented anatomy UI');
 assert.equal(await page.locator('#b5AdvancedToggle').isVisible(),true);
 assert.equal(await page.locator('#uxN5VolumeState').innerText(),'Disponible al abrir 3D');
 await page.locator('#threeDButton').click();
 await page.waitForFunction(()=>document.querySelector('#volumeStatus')?.textContent.includes('Volumen 32'),null,{timeout:60000});
 await page.waitForFunction(()=>document.querySelector('#uxN5VolumeState')?.textContent==='Preparado',null,{timeout:5000});
 assert.equal(await page.locator('#uxN5VolumeLed').getAttribute('data-state'),'ready');
 await page.locator('#uxAppearanceDetails summary').click();
 await page.locator('#uxVolumeStyle').selectOption('amber');
 assert.equal(await page.locator('#volumeStyle').inputValue(),'amber');
 await page.locator('#tripleButton').click();
 await page.waitForFunction(()=>document.querySelector('#viewerRoot')?.dataset.uxMode==='triple');
 await page.waitForFunction(()=>document.querySelector('#triptychNoMask')?.hidden===false||document.querySelector('#surfaceCanvas')?.hidden===false,null,{timeout:15000});
 for(const id of ['scanCanvas','volumeCanvas','triptychNoMask'])assert.equal(await page.locator('#'+id).isVisible(),true,id);
 const desktop=await page.evaluate(()=>{
  const r=id=>{const b=document.getElementById(id).getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}};
  return [r('scanCanvas'),r('volumeCanvas'),r('triptychNoMask')];
 });
 assert(desktop[0].x<desktop[1].x&&desktop[1].x<desktop[2].x,'Wide desktop uses 3 same-height columns');
 await page.setViewportSize({width:1080,height:850});
 await page.waitForTimeout(200);
 const mid=await page.evaluate(()=>{
  const r=id=>{const b=document.getElementById(id).getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}};
  return [r('scanCanvas'),r('volumeCanvas'),r('triptychNoMask'),r('viewerRoot')];
 });
 assert(Math.abs(mid[0].w-mid[1].w)<4,'At intermediate width the upper two panes are equal');
 assert(mid[1].x>mid[0].x,'Volume to right of DICOM');
 assert(mid[2].y>mid[0].y+mid[0].h-5,'Real same-study geometry in separate lower row');
 assert(mid[2].w>=mid[0].w*1.9,'Lower geometry pane gets full viewer width');
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(200);
 const mobile=await page.evaluate(()=>{
  const r=id=>{const b=document.getElementById(id).getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}};
  return [r('scanCanvas'),r('volumeCanvas'),r('triptychNoMask')];
 });
 assert(mobile[0].y<mobile[1].y&&mobile[1].y<mobile[2].y,'Mobile keeps three ordered and separate actual views');
 assert(Math.abs(mobile[0].w-mobile[2].w)<5,'Mobile uses full available width');
 // Source/provenance must remain visible when needed, and no fake tissues.
 await page.locator('#uxProvenanceDetails summary').click();
 assert.match(await page.locator('#uxSourceExplanation').innerText(),/segmentación validada/i);
 assert.deepEqual(errors,[],JSON.stringify(errors));
 assert.deepEqual(offsite,[],JSON.stringify(offsite));
 console.log('PASS UX-N5 authentic study state, no fake tissue, amber preset bound to volume, 3-wide/2+1/vertical responsive view and accessible provenance');
}finally{await browser.close()}
