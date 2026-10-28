import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const zip=await readFile('/tmp/anatheos-uxn2-test.zip'),host='http://127.0.0.1:8774/';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1320,height:920}});
 const errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(!r.url().startsWith(host))external.push(r.url())});
 await page.route('**/datasets/RTKN0668_MR_DESS.zip',route=>route.request().method()==='HEAD'
  ?route.fulfill({status:200,headers:{'content-type':'application/zip','content-length':String(zip.length)},body:''})
  :route.fulfill({status:200,contentType:'application/zip',body:zip}));
 await page.goto(host,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelector('#studyTitle')?.textContent==='SYNTHETIC_TEST_NOT_PATIENT',null,{timeout:25000});
 await page.locator('#b5AdvancedToggle').click();
 assert.equal(await page.locator('#b7PickSeed').isEnabled(),true);
 assert.equal(await page.locator('#b7Accept').isDisabled(),true);
 await page.locator('#b7PickSeed').click();
 const canvas=page.locator('#scanCanvas'),rect=await canvas.boundingBox();
 await canvas.click({position:{x:rect.width*.5,y:rect.height*.5}});
 assert.equal(await page.locator('#b7Propose').isEnabled(),true);
 await page.locator('#b7Propose').click();
 await page.waitForFunction(()=>!document.querySelector('#b7Accept').disabled,null,{timeout:30000});
 assert.match(await page.locator('#b7Status').innerText(),/vóxeles conectados/);
 const before=await page.locator('#sliceCurrent').innerText();
 await page.locator('#next').click();assert.notEqual(await page.locator('#sliceCurrent').innerText(),before);
 await page.locator('#b7Discard').click();
 assert.equal(await page.locator('#b7Accept').isDisabled(),true);
 assert.match(await page.locator('#b7Status').innerText(),/sin modificar/);
 assert.match(await page.locator('#segCount1').innerText(),/^0 vóxeles$/);
 await page.locator('#b7Propose').click();
 await page.waitForFunction(()=>!document.querySelector('#b7Accept').disabled,null,{timeout:30000});
 await page.locator('#b7Accept').click();
 await page.waitForFunction(()=>document.querySelector('#surfaceLayers')?.dataset.origin==='same-study-manual'&&document.querySelectorAll('#surfaceLayers .surface-row').length>0,null,{timeout:45000});
 assert.match(await page.locator('#b7Status').innerText(),/Aplicados/);
 assert.match(await page.locator('#segMeshStatus').innerText(),/MISMA serie/);
 assert.match(await page.locator('#surfaceLayers .surface-select').innerText(),/MISMA RM/);
 assert.equal(await page.locator('#surfaceCanvas').isVisible(),true);
 assert.equal(await page.locator('#uxLayerExternal').isVisible(),true);
 assert.deepEqual(errors,[],JSON.stringify(errors));
 assert.deepEqual(external,[],JSON.stringify(external));
 console.log('PASS B7.1: DICOM 3D seed preview, discard with unchanged mask, explicit acceptance and same-study LPS mesh; no external data');
}finally{await browser.close()}
