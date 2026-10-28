import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const fake=await readFile('/tmp/anatheos-uxn2-test.zip'),base='http://127.0.0.1:8774/';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:920}});
 const errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(!r.url().startsWith(base))external.push(r.url())});
 await page.route('**/datasets/RTKN0668_MR_DESS.zip',route=>
  route.request().method()==='HEAD'?
    route.fulfill({status:200,headers:{'content-type':'application/zip','content-length':String(fake.length)},body:''}):
    route.fulfill({status:200,contentType:'application/zip',body:fake}));
 await page.goto(base,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelector('#studyTitle')?.textContent==='SYNTHETIC_TEST_NOT_PATIENT',null,{timeout:25000});
 assert.equal(await page.locator('#tripleButton').isEnabled(),true);
 await page.locator('#tripleButton').click();
 await page.waitForFunction(()=>document.querySelector('#viewerRoot')?.dataset.uxMode==='triple'&&
  document.querySelector('#volumeStatus')?.textContent.includes('Volumen 32'),null,{timeout:60000});
 assert.equal(await page.locator('#scanCanvas').isVisible(),true);
 assert.equal(await page.locator('#volumeCanvas').isVisible(),true);
 assert.equal(await page.locator('#triptychNoMask').isVisible(),true);
 assert.equal(await page.locator('#surfaceCanvas').isVisible(),false);
 assert.match(await page.locator('#triptychNoMask').innerText(),/atlas SPL/);
 assert.equal(await page.locator('#tripleButton').getAttribute('aria-pressed'),'true');
 const coords=await page.evaluate(()=>{
  const box=id=>{const r=document.querySelector(id).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};
  return {one:box('#scanCanvas'),two:box('#volumeCanvas'),three:box('#triptychNoMask')};
 });
 assert(coords.one.x<coords.two.x&&coords.two.x<coords.three.x,JSON.stringify(coords));
 assert(Math.abs(coords.one.w-coords.two.w)<3&&Math.abs(coords.one.w-coords.three.w)<3,JSON.stringify(coords));
 const pos=await page.locator('#triptychSlice2d').innerText();
 await page.locator('#next').click();
 await page.waitForFunction(old=>document.querySelector('#triptychSlice2d')?.textContent!==old,pos);
 const labels=await Promise.all(['triptychSlice2d','triptychSliceVolume','triptychSliceMesh'].map(id=>page.locator('#'+id).innerText()));
 assert.equal(labels[0],labels[1]);assert.equal(labels[1],labels[2]);
 // Mark and measure on actual source pixel geometry; no anatomy is inferred.
 await page.locator('#triptychPoint').click();
 const canvas=page.locator('#scanCanvas');
 await canvas.click({position:{x:canvas?65:65,y:105}});
 await page.locator('#triptychMeasure').click();
 await canvas.click({position:{x:90,y:130}});
 await canvas.click({position:{x:124,y:130}});
 assert.match(await page.locator('#triptychToolStatus').innerText(),/mm/);
 await page.locator('#triptychClearNotes').click();
 assert.match(await page.locator('#triptychToolStatus').innerText(),/sin modificar/);
 // The manual "tissue category" is a hypothesis, not an automatic label.
 await page.locator('#b5AdvancedToggle').click();
 await page.locator('#triptychTissueCategory').selectOption('menisco');
 assert.match(await page.locator('#triptychTissueStatus').innerText(),/hipótesis manual/);
 assert.match(await page.locator('#segCount1').innerText(),/^0 vóxeles/);
 await page.locator('#triptychPaint').click();
 const rect=await canvas.boundingBox();
 await canvas.click({position:{x:rect.width/2,y:rect.height/2}});
 await page.waitForFunction(()=>document.querySelector('#segMeshStatus')?.textContent.includes('MISMA serie')&&
  document.querySelector('#surfaceLayers')?.dataset.origin==='same-study-manual',null,{timeout:50000});
 assert.equal(await page.locator('#surfaceCanvas').isVisible(),true);
 assert.equal(await page.locator('#triptychNoMask').isVisible(),false);
 assert.equal(await page.locator('#scanCanvas').isVisible(),true);
 assert.equal(await page.locator('#volumeCanvas').isVisible(),true);
 assert.equal(await page.locator('#uxLayerExternal').isVisible(),true);
 assert.match(await page.locator('#uxModelOriginDescription').innerText(),/LPS mm/);
 // Subsequent 2D edits must not preserve stale previous geometry.
 await canvas.click({position:{x:rect.width*.65,y:rect.height*.6}});
 await page.waitForFunction(()=>document.querySelector('#segMeshStatus')?.textContent.includes('MISMA serie'),null,{timeout:50000});
 await page.locator('#twoDButton').click();
 assert.equal(await page.locator('#viewerRoot').getAttribute('data-ux-mode'),'slice');
 assert.equal(await page.locator('#triptychTools').isVisible(),false);
 assert.deepEqual(errors,[],JSON.stringify(errors));
 assert.deepEqual(external,[],JSON.stringify(external));
 console.log('PASS B7.2: same-study triple 2D/volume/mask mesh, synchronized slice captions, real paint/measure/point, provisional tissue and no SPL mixing');
}finally{await browser.close()}
