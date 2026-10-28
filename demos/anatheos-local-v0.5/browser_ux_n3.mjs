import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const base='http://127.0.0.1:8774/';
const synthetic=await readFile('/tmp/anatheos-uxn2-test.zip');
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:800,height:650}});
 const errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(!r.url().startsWith(base))external.push(r.url())});
 await page.route('**/datasets/RTKN0668_MR_DESS.zip',route=>
  route.request().method()==='HEAD'?
   route.fulfill({status:200,headers:{'content-type':'application/zip','content-length':String(synthetic.length)},body:''}):
   route.fulfill({status:200,contentType:'application/zip',body:synthetic})
 );
 await page.goto(base,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelector('#studyTitle')?.textContent==='SYNTHETIC_TEST_NOT_PATIENT');
 assert.equal(await page.locator('#uxRenderMaterials').isVisible(),false);
 await page.locator('#threeDButton').click();
 await page.waitForFunction(()=>document.querySelector('#volumeStatus')?.textContent.includes('Volumen 32') && !document.querySelector('#volumeCanvas').hidden,null,{timeout:60000});
 assert.equal(await page.locator('#uxRenderMaterials').isVisible(),true);
 assert.equal(await page.locator('#volumeStyle').inputValue(),'original');
 await page.locator('#volumeQuality').evaluate(el=>{el.value='60';el.dispatchEvent(new Event('input',{bubbles:true}))});
 assert.equal(await page.locator('#volumeQuality').inputValue(),'60');
 const fingerprint=()=>page.locator('#volumeCanvas').evaluate(c=>c.toDataURL('image/png'));
 const gray=await fingerprint();
 assert(gray.length>2000,'Expected nonempty volume image');
 await page.locator('#uxVolumeStyle').selectOption('relief');
 assert.equal(await page.locator('#volumeStyle').inputValue(),'relief');
 assert.match(await page.locator('#uxStyleNote').innerText(),/no identifica tejidos/);
 const relief=await fingerprint();
 assert.notEqual(relief,gray,'Relief must alter actual WebGL image');
 await page.locator('#uxVolumeStyle').selectOption('amber');
 assert.equal(await page.locator('#volumeStyle').inputValue(),'amber');
 assert.match(await page.locator('#uxStyleNote').innerText(),/No representa huesos segmentados/);
 const amber=await fingerprint();
 assert.notEqual(amber,gray,'Amber preset must change actual image');
 assert.notEqual(amber,relief,'Amber must be distinct from relief');
 await page.locator('#uxVolumeLighting').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}))});
 assert.equal(await page.locator('#volumeLighting').inputValue(),'0');
 const noLight=await fingerprint();
 assert.notEqual(amber,noLight,'Light strength must affect pixels');
 await page.locator('#b5AdvancedToggle').click();
 await page.locator('#volumeStyle').selectOption('original');
 assert.equal(await page.locator('#uxVolumeStyle').inputValue(),'original');
 const restored=await fingerprint();
 assert.equal(restored,gray,'Original preset must restore same pixels');
 await page.locator('#b5AdvancedToggle').click();
 await page.locator('#mixedButton').click();
 await page.waitForFunction(()=>document.querySelector('#viewerRoot').dataset.uxMode==='mixed');
 assert.equal(await page.locator('#uxRenderMaterials').isVisible(),true);
 await page.locator('#uxVolumeStyle').selectOption('amber');
 assert.equal(await page.locator('#scanCanvas').isVisible(),true);
 assert.equal(await page.locator('#volumeCanvas').isVisible(),true);
 assert.notEqual(await fingerprint(),gray);
 await page.locator('#twoDButton').click();
 assert.equal(await page.locator('#uxRenderMaterials').isVisible(),false);
 assert.equal(await page.locator('#studyTitle').innerText(),'SYNTHETIC_TEST_NOT_PATIENT');
 assert.deepEqual(errors,[],JSON.stringify(errors));
 assert.deepEqual(external,[],JSON.stringify(external));
 console.log('PASS UX-N3: real WebGL pixel differences, lighting, original restoration, mixed mode, no network');
}finally{await browser.close()}