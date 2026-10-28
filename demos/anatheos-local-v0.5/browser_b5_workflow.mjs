import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8774/';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--no-sandbox']});
try {
 // No packaged DESS: normal git source checkout must remain usable, without errors.
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const jsErrors=[],external=[];
 page.on('pageerror',e=>jsErrors.push(String(e)));
 page.on('request',r=>{if(!r.url().startsWith(base))external.push(r.url());});
 await page.goto(base,{waitUntil:'networkidle'});
 assert.equal(await page.locator('#b5StudyType').innerText(),'Sin estudio');
 assert.equal(await page.locator('#studyTitle').innerText(),'Sin estudio cargado');
 assert.match(await page.locator('#b5WorkflowStatus').innerText(),/No hay RM incluida/);
 assert.equal(await page.locator('#surfacePanel').isVisible(),false);
 assert.equal(await page.locator('#segmentationPanel').isVisible(),false);
 await page.locator('#b5AdvancedToggle').click();
 assert.equal(await page.locator('#segmentationPanel').isVisible(),true);
 await page.locator('#b5AdvancedToggle').click();
 assert.equal(await page.locator('#segmentationPanel').isVisible(),false);
 await page.locator('#surfaceButton').click();
 assert.equal(await page.locator('#surfacePanel').isVisible(),true);
 assert.equal(await page.locator('#surfaceHelpOverlay').isVisible(),true);
 assert.match(await page.locator('#b5SourceNote').innerText(),/STL\/OBJ externo/);
 await page.locator('#surfaceSource').selectOption('spl-knee');
 assert.match(await page.locator('#b5SourceNote').innerText(),/OTRO especimen/);
 await page.locator('#surfaceSource').selectOption('other-unverified');
 await page.locator('#twoDButton').click();
 assert.equal(await page.locator('#surfacePanel').isVisible(),false);
 assert.equal(await page.locator('#scanCanvas').isVisible(),true);
 assert.deepEqual(jsErrors,[]);
 assert.deepEqual(external,[]);
 await page.close();

 // A present local research bundle triggers automatic GET without user clicks.
 // Deliberately return a bad ZIP as a controlled error; never commit clinical bytes.
 const mock=await browser.newPage({viewport:{width:1280,height:780}});
 const requests=[];
 mock.on('request',r=>{if(r.url().includes('RTKN0668_MR_DESS.zip'))requests.push(r.method());});
 const errors=[];
 mock.on('pageerror',e=>errors.push(String(e)));
 await mock.route('**/datasets/RTKN0668_MR_DESS.zip',async route=>{
  if(route.request().method()==='HEAD')
   return route.fulfill({status:200,headers:{'content-type':'application/zip','content-length':'128'},body:''});
  return route.fulfill({status:200,contentType:'application/zip',body:Buffer.from('deliberately invalid synthetic zip')});
 });
 await mock.goto(base,{waitUntil:'networkidle'});
 await mock.waitForFunction(()=>document.querySelector('#warnings')?.textContent?.includes('ERROR'),{timeout:15000});
 assert(requests.includes('HEAD')&&requests.includes('GET'),JSON.stringify(requests));
 assert.match(await mock.locator('#b5WorkflowStatus').innerText(),/No se pudo procesar|Procesando|Reconstruccion/);
 assert.deepEqual(errors,[]);
 await mock.close();
 console.log('PASS B5: no-DESS safe startup, contextual panels, provenance, manual overrides, automatic same-origin HEAD/GET with no clinical fixture');
} finally {await browser.close();}
