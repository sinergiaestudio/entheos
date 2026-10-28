import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const zip=await readFile('/tmp/anatheos-uxn2-test.zip'),base='http://127.0.0.1:8774/';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:920}});
 const errors=[],offsite=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',r=>{if(!r.url().startsWith(base))offsite.push(r.url())});
 await page.route('**/datasets/RTKN0668_MR_DESS.zip',route=>route.request().method()==='HEAD'
  ?route.fulfill({status:200,headers:{'content-type':'application/zip','content-length':String(zip.length)},body:''})
  :route.fulfill({status:200,contentType:'application/zip',body:zip}));
 await page.goto(base,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelector('#studyTitle')?.textContent==='SYNTHETIC_TEST_NOT_PATIENT',null,{timeout:30000});
 // Reproduce user workflow: another-specimen STL was viewed BEFORE the
 // DICOM mask. Never interpolate or superimpose that file with this DICOM.
 const syntheticSTL=Buffer.alloc(84+50);
 syntheticSTL.writeUInt32LE(1,80);
 [[0,0,0],[25,0,0],[0,25,0]].flat().forEach((n,i)=>syntheticSTL.writeFloatLE(n,84+12+i*4));
 await page.locator('#surfaceFile').setInputFiles({name:'EXTERNAL_UNRELATED_SPECIMEN.stl',mimeType:'application/octet-stream',buffer:syntheticSTL});
 await page.waitForFunction(()=>document.querySelector('#surfaceLayers')?.dataset.origin==='external'&&document.querySelectorAll('#surfaceLayers .surface-row').length===1);
 assert.match(await page.locator('#frameLabel').innerText(),/STL\/OBJ IMPORTADOS|EXTERNO/);
 await page.locator('#twoDButton').click();
 await page.locator('#b5AdvancedToggle').click();
 await page.locator('#segEdit').check();
 const canvas=page.locator('#scanCanvas');
 const first=await canvas.boundingBox();
 await canvas.click({position:{x:first.width*.50,y:first.height*.50}});
 await page.waitForFunction(()=>!document.querySelector('#segBuildSurface').disabled);
 await page.locator('#segEdit').uncheck();
 assert.match(await page.locator('#segCount1').innerText(),/vóxeles/);
 // Switching to triple MUST produce real same-study geometry autonomously,
 // with no need to clear external models or navigate advanced controls.
 await page.locator('#tripleButton').click();
 await page.waitForFunction(()=>document.querySelector('#surfaceLayers')?.dataset.origin==='same-study-manual'&&
  document.querySelectorAll('#surfaceLayers .surface-row').length===1&&
  !document.querySelector('#surfaceCanvas')?.hidden,null,{timeout:60000});
 assert.equal(await page.locator('#surfaceCanvas').isVisible(),true);
 assert.equal(await page.locator('#scanCanvas').isVisible(),true);
 assert.equal(await page.locator('#volumeCanvas').isVisible(),true);
 assert.equal(await page.locator('#triptychNoMask').isVisible(),false);
 assert.match(await page.locator('#frameLabel').innerText(),/MISMO ESTUDIO/);
 assert.doesNotMatch(await page.locator('#frameLabel').innerText(),/ATLAS SPL/);
 assert.match(await page.locator('#segMeshStatus').innerText(),/MISMA serie/);
 assert.match(await page.locator('#surfaceLayers .surface-select').first().innerText(),/MISMA RM/);
 assert.equal(await page.locator('#viewerOverlayActions').isVisible(),false,'No opacity/palette HUD over 2D knee');
 // External STL preserved, but accessible only in independent surface mode.
 await page.locator('#surfaceButton').click();
 await page.waitForFunction(()=>document.querySelector('#surfaceLayers')?.dataset.origin==='external');
 assert.match(await page.locator('#surfaceLayers .surface-select').innerText(),/EXTERNAL UNRELATED SPECIMEN/);
 assert.equal(await page.locator('#viewerRoot').getAttribute('data-ux-mode'),'slice');
 await page.locator('#tripleButton').click();
 await page.waitForFunction(()=>document.querySelector('#surfaceLayers')?.dataset.origin==='same-study-manual'&&
 !document.querySelector('#surfaceCanvas')?.hidden,null,{timeout:45000});
 // Touching the source mask invalidates the obsolete geometry, and a new
 // mesh is produced automatically after the pointer-up.
 await page.locator('#triptychPaint').click();
 const now=await canvas.boundingBox();
 await canvas.click({position:{x:now.width*.60,y:now.height*.56}});
 await page.waitForFunction(()=>document.querySelector('#segMeshStatus')?.textContent.includes('MISMA serie')&&
  document.querySelector('#surfaceLayers')?.dataset.origin==='same-study-manual',null,{timeout:45000});
 assert.equal(await page.locator('#surfaceCanvas').isVisible(),true);
 assert.deepEqual(errors,[]);
 assert.deepEqual(offsite,[]);
 console.log('PASS B7.2 recovery: previous external STL remains isolated; pre-existing DICOM mask auto-meshes in 3 panes, source-true frame label, no DICOM HUD obstruction, edit refresh');
}finally{await browser.close()}
