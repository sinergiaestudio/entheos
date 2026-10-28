import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const host='http://127.0.0.1:8774/',synthetic=await readFile('/tmp/anatheos-uxn2-test.zip');
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(!r.url().startsWith(host))external.push(r.url())});
 await page.route('**/datasets/RTKN0668_MR_DESS.zip',route=>
  route.request().method()==='HEAD'
  ?route.fulfill({status:200,headers:{'content-type':'application/zip','content-length':String(synthetic.length)},body:''})
  :route.fulfill({status:200,contentType:'application/zip',body:synthetic}));
 await page.goto(host,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelector('#studyTitle')?.textContent==='SYNTHETIC_TEST_NOT_PATIENT',{timeout:30000});
 assert(await page.locator('body.ux-streamlined').count()===1);
 // UI must shrink chrome but keep all five underlying real modes visible.
 const widths=await page.evaluate(()=>{
  const side=document.querySelector('.sidebar').getBoundingClientRect();
  const center=document.querySelector('.workspace').getBoundingClientRect();
  const layers=document.querySelector('.ux-layers').getBoundingClientRect();
  const viewer=document.querySelector('.viewer').getBoundingClientRect();
  return {side:side.width,center:center.width,layers:layers.width,viewer:viewer.width};
 });
 assert(widths.side<=240&&widths.layers<=255&&widths.center>widths.side*2,JSON.stringify(widths));
 for(const id of ['twoDButton','threeDButton','mixedButton','tripleButton','surfaceButton','b5AdvancedToggle','focusButton','fullscreenButton']){
  assert.equal(await page.locator('#'+id).isVisible(),true,id);
 }
 // Navigation/provenance remains correct, no fictitious tissue layers.
 assert.equal(await page.locator('#uxLayerDicom').isVisible(),true);
 assert.equal(await page.locator('#uxLayerExternal').isVisible(),false);
 assert.equal(await page.locator('#uxProvenanceDetails').getAttribute('open'),null);
 assert.equal(await page.locator('#uxAppearanceDetails').getAttribute('open'),null);
 assert.equal(await page.locator('#uxStudyImport').getAttribute('open'),null);
 assert.equal(await page.locator('#zipButton').isVisible(),false);
 assert.equal(await page.locator('#fitButton').isVisible(),false);
 await page.locator('#uxStudyImport summary').click();
 assert.equal(await page.locator('#zipButton').isVisible(),true);
 assert.equal(await page.locator('#folderButton').isVisible(),true);
 assert.equal(await page.locator('#b5OpenStudy').isVisible(),true);
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#zipButton').isVisible(),false);
 await page.locator('#uxMoreViewer summary').click();
 assert.equal(await page.locator('#fitButton').isVisible(),true);
 assert.equal(await page.locator('#clearButton').isVisible(),true);
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#fitButton').isVisible(),false);
 await page.locator('#uxProvenanceDetails summary').click();
 assert.equal(await page.locator('#uxSourceExplanation').isVisible(),true);
 await page.locator('#uxProvenanceDetails summary').click();
 assert.equal(await page.locator('#uxSourceExplanation').isVisible(),false);
 // The advanced editor is only visible on explicit demand, never removed.
 assert.equal(await page.locator('#segmentationPanel').isVisible(),false);
 await page.locator('#b5AdvancedToggle').click();
 assert.equal(await page.locator('#segmentationPanel').isVisible(),true);
 assert.equal(await page.locator('#segTool').isVisible(),true);
 await page.locator('#b5AdvancedToggle').click();
 assert.equal(await page.locator('#segmentationPanel').isVisible(),false);
 // 3D style still actually drives the original GPU while inspector is closed.
 await page.locator('#threeDButton').click();
 await page.waitForFunction(()=>document.querySelector('#volumeStatus')?.textContent.includes('Volumen 32'),null,{timeout:60000});
 assert.equal(await page.locator('#uxRenderMaterials').isVisible(),false);
 await page.locator('#uxAppearanceDetails summary').click();
 assert.equal(await page.locator('#uxRenderMaterials').isVisible(),true);
 await page.locator('#uxVolumeStyle').selectOption('amber');
 assert.equal(await page.locator('#volumeStyle').inputValue(),'amber');
 await page.locator('#uxVolumeOpacity').evaluate(el=>{el.value='125';el.dispatchEvent(new Event('input',{bubbles:true}))});
 assert.equal(await page.locator('#volumeOpacity').inputValue(),'125');
 await page.locator('#uxAppearanceDetails summary').click();
 assert.equal(await page.locator('#uxRenderMaterials').isVisible(),false);
 // Three real panes and manual edit are available without duplicated chrome.
 await page.locator('#tripleButton').click();
 await page.waitForFunction(()=>document.querySelector('#viewerRoot')?.dataset.uxMode==='triple');
 for(const id of ['scanCanvas','volumeCanvas','triptychTools'])
  assert.equal(await page.locator('#'+id).isVisible(),true,id);
 assert.equal(await page.locator('#surfaceCanvas').isVisible(),false);
 assert.equal(await page.locator('#triptychNoMask').isVisible(),true);
 assert.deepEqual(errors,[],JSON.stringify(errors));
 assert.deepEqual(external,[],JSON.stringify(external));
 console.log('PASS UX-N4 visual pruning: compact 3-column workstation, accessible disclosures, study import, real 3D style, original editing and triple view intact');
}finally{await browser.close()}
