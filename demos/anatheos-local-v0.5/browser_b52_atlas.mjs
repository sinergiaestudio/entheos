import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const root='http://127.0.0.1:8774/';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1450,height:970}});
 const errors=[],external=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('request',r=>{if(!r.url().startsWith(root))external.push(r.url());});
 let statusCount=0,prepareCount=0,assetCount=0;
 await page.route('**/api/spl/status',route=>{statusCount++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ready:false})})});
 await page.route('**/api/spl/prepare',route=>{
  prepareCount++;
  assert.equal(route.request().method(),'POST');
  assert.equal(route.request().headers()['content-type'],'application/json');
  return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,message:'Atlas temporalmente no disponible'})});
 });
 await page.goto(root,{waitUntil:'networkidle'});
 await page.locator('#surfaceButton').click();
 assert.equal(await page.locator('#surfaceAutoSPL').isVisible(),true);
 assert.equal(await page.locator('#surfaceManual').getAttribute('open'),null);
 assert.equal(await page.locator('#surfaceLayers .surface-row').count(),0);
 await page.locator('#surfaceAutoSPL').click();
 await page.waitForFunction(()=>document.querySelector('#surfaceAutoSPLStatus').textContent.includes('Atlas temporalmente no disponible'));
 assert.equal(await page.locator('#surfaceAutoSPL').isEnabled(),true);
 assert.equal(prepareCount,1);
 assert.equal(assetCount,0);
 assert.deepEqual(errors,[]);
 await page.close();

 const dir=process.env.SPL_ATLAS_TMP_DIR;
 assert(dir,'Must set SPL_ATLAS_TMP_DIR for true public SPL reference UI test');
 const real=await browser.newPage({viewport:{width:1450,height:970}});
 const jsErrors=[],offsite=[],requests=[];
 real.on('pageerror',e=>jsErrors.push(String(e)));
 real.on('request',r=>{if(!r.url().startsWith(root))offsite.push(r.url());});
 await real.route('**/api/spl/status',route=>route.fulfill({status:200,contentType:'application/json',body:'{"ready":true}'}));
 await real.route('**/api/spl/prepare',route=>{
  assert.equal(route.request().method(),'POST');
  requests.push('prepare');
  return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"ready":true}'});
 });
 for(const name of ['femur-95.stl','tibia-96.stl']){
  const bytes=await readFile(path.join(dir,name));
  await real.route('**/atlas/'+name,route=>{requests.push(name);return route.fulfill({status:200,contentType:'application/octet-stream',body:bytes})});
 }
 await real.goto(root,{waitUntil:'networkidle'});
 await real.locator('#surfaceButton').click();
 assert.match(await real.locator('#surfaceAutoSPL').innerText(),/Abrir atlas SPL guardado/);
 await real.locator('#surfaceAutoSPL').click();
 await real.waitForFunction(()=>document.querySelectorAll('#surfaceLayers .surface-row').length===2,null,{timeout:120000});
 assert.equal(await real.locator('#surfaceHelpOverlay').isVisible(),false);
 assert.equal(await real.locator('#surfaceCanvas').isVisible(),true);
 assert.deepEqual(requests,['prepare','femur-95.stl','tibia-96.stl']);
 assert.match(await real.locator('#surfaceStatus').innerText(),/SPL comprobadas por SHA-256/);
 assert.match(await real.locator('#surfaceAutoSPLStatus').innerText(),/Fémur y tibia originales SPL verificados/);
 assert.equal(await real.locator('#surfaceSource').inputValue(),'spl-knee');
 const names=await real.locator('.surface-row .surface-select').allTextContents();
 assert(names.join(' | ').includes('328.956')&&names.join(' | ').includes('266.884'));
 assert.equal(await real.locator('#surfaceManual').getAttribute('open'),null);
 assert.deepEqual(jsErrors,[]);
 assert.deepEqual(offsite,[]);
 await real.close();
 console.log('PASS B5.2 real atlas via ONE CLICK: POST deliberate, local SHA-256 of both SPL STL, two layers WebGL, explicit specimen origin, no external browser requests');
} finally{await browser.close()}
