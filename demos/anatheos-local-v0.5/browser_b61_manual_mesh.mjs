import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const data=await readFile('/tmp/anatheos-uxn2-test.zip'),url='http://127.0.0.1:8774/';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:920}});
 const errors=[],other=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(!r.url().startsWith(url))other.push(r.url())});
 await page.route('**/datasets/RTKN0668_MR_DESS.zip',route=>
  route.request().method()==='HEAD'
   ?route.fulfill({status:200,headers:{'content-type':'application/zip','content-length':String(data.length)},body:''})
   :route.fulfill({status:200,contentType:'application/zip',body:data}));
 await page.goto(url,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelector('#studyTitle')?.textContent==='SYNTHETIC_TEST_NOT_PATIENT',null,{timeout:30000});
 assert.equal(await page.locator('#segBuildSurface').isEnabled(),false,'No phantom anatomy before mask');
 await page.locator('#b5AdvancedToggle').click();
 await page.locator('#segEdit').check();
 const canvas=page.locator('#scanCanvas');
 const rect=await canvas.boundingBox();
 await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
 await page.mouse.down();await page.mouse.up();
 await page.waitForFunction(()=>!document.querySelector('#segBuildSurface').disabled);
 await page.locator('#segEdit').uncheck();
 await page.locator('#segBuildSurface').click();
 await page.waitForFunction(()=>document.querySelector('#surfaceLayers').dataset.origin==='same-study-manual'&&document.querySelectorAll('#surfaceLayers .surface-row').length===1,null,{timeout:40000});
 assert.equal(await page.locator('#surfaceCanvas').isVisible(),true);
 assert.equal(await page.locator('#uxLayerExternal').isVisible(),true);
 assert.match(await page.locator('#uxModelOriginTitle').innerText(),/MISMA|MANUALES/i);
 assert.match(await page.locator('#uxModelOriginDescription').innerText(),/LPS mm/);
 assert.match(await page.locator('#surfaceStatus').innerText(),/MISMA|mismo estudio|máscaras MANUALES/i);
 assert.match(await page.locator('#surfaceLayers .surface-select').innerText(),/Región 1.*SIN validar/);
 assert.equal(await page.locator('#surfaceLayers .surface-row').count(),1);
 const canvasImage=await page.locator('#surfaceCanvas').evaluate(c=>c.toDataURL('image/png'));
 assert(canvasImage.length>2500,'Must render actual geometry from synthetic marked voxels');
 // Any DICOM change clears derived meshes instead of showing outdated anatomy.
 await page.locator('#twoDButton').click();
 await page.locator('#segEdit').check();
 const rect2=await canvas.boundingBox();
 await page.mouse.move(rect2.x+rect2.width*.6,rect2.y+rect2.height*.6);
 await page.mouse.down();await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('#surfaceLayers').dataset.origin==='external');
 assert.equal(await page.locator('#surfaceLayers .surface-row').count(),0);
 assert.deepEqual(errors,[]);
 assert.deepEqual(other,[]);
 console.log('PASS B6.1: only real same-DICOM painted voxels form LPS-STL, provenance correct, 3D visible, mask edit invalidates stale surface, no external requests');
}finally{await browser.close()}