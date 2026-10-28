import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const zip=await readFile('/tmp/anatheos-uxn2-test.zip');
const url='http://127.0.0.1:8774/';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1360,height:920}});
 const errors=[],outside=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(!r.url().startsWith(url))outside.push(r.url())});
 await page.route('**/datasets/RTKN0668_MR_DESS.zip',route=>
  route.request().method()==='HEAD'
   ?route.fulfill({status:200,headers:{'content-type':'application/zip','content-length':String(zip.length)},body:''})
   :route.fulfill({status:200,contentType:'application/zip',body:zip}));
 await page.goto(url,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelector('#studyTitle')?.textContent==='SYNTHETIC_TEST_NOT_PATIENT',null,{timeout:20000});
 await page.locator('#b5AdvancedToggle').click();
 assert.equal(await page.locator('#segMeshMethod').inputValue(),'continuous');
 assert.equal(await page.locator('#segBuildSurface').isEnabled(),false);
 await page.locator('#segEdit').check();
 // The DICOM canvas is automatically scrolled to before painting.
 await page.locator('#scanCanvas').click({position:{x:150,y:140}});
 await page.waitForFunction(()=>!document.querySelector('#segBuildSurface').disabled,null,{timeout:20000});
 await page.locator('#segEdit').uncheck();
 await page.locator('#segBuildSurface').click();
 await page.waitForFunction(()=>document.querySelector('#surfaceLayers')?.dataset.origin==='same-study-manual'&&document.querySelectorAll('#surfaceLayers .surface-row').length>0,null,{timeout:30000});
 const label=await page.locator('#surfaceLayers .surface-select').first().innerText();
 assert.match(label,/continua.*MISMA RM.*SIN validar/);
 assert.match(await page.locator('#segMeshStatus').innerText(),/isosuperficie continua B6.2/);
 assert.match(await page.locator('#uxModelOriginDescription').innerText(),/LPS mm/);
 assert.equal(await page.locator('#surfaceCanvas').isVisible(),true);
 assert.equal(await page.locator('#uxLayerExternal').isVisible(),true);
 // A controllable 3D model must exist, not merely a status label.
 const layer=page.locator('#surfaceLayers .surface-row').first();
 await layer.locator('input[type=checkbox]').uncheck();
 assert.equal(await layer.locator('input[type=checkbox]').isChecked(),false);
 await layer.locator('input[type=checkbox]').check();
 await page.locator('#twoDButton').click();
 // Explicit alternative preserves the exact voxel-boundary fallback.
 await page.locator('#segMeshMethod').selectOption('voxel');
 assert.equal(await page.locator('#segMeshSoftness').isDisabled(),true);
 await page.locator('#segBuildSurface').click();
 await page.waitForFunction(()=>document.querySelector('#segMeshStatus')?.textContent.includes('voxel B6.1'),null,{timeout:30000});
 assert.match(await page.locator('#surfaceLayers .surface-select').first().innerText(),/Región 1.*SIN validar/);
 assert.deepEqual(errors,[]);
 assert.deepEqual(outside,[]);
 console.log('PASS B6.2: same-study synthetic DICOM painted mask -> continuous STL with real mesh/caps/provenance, fallback voxels, no external requests');
}finally{await browser.close()}
