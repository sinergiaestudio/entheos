import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const url='http://127.0.0.1:8774/';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[],outbound=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(!r.url().startsWith(url))outbound.push(r.url())});
 await page.goto(url,{waitUntil:'networkidle'});
 assert.equal(await page.locator('#uxLayersPanel').isVisible(),true);
 const actual=await page.evaluate(()=>{
   const layout=document.querySelector('#uxN1Layout');
   const grid=getComputedStyle(layout);
   const bg=getComputedStyle(document.body).backgroundColor;
   const parts=['.sidebar','.workspace','.ux-layers'].map(s=>{
     const r=document.querySelector(s).getBoundingClientRect();
     return {x:r.x,width:r.width,height:r.height};
   });
   return {grid:grid.gridTemplateColumns,bg,parts};
 });
 assert.equal(actual.parts.length,3);
 assert(actual.parts[0].x<actual.parts[1].x&&actual.parts[1].x<actual.parts[2].x,JSON.stringify(actual));
 assert(actual.parts[1].width>actual.parts[0].width && actual.parts[1].width>actual.parts[2].width,JSON.stringify(actual));
 assert.match(actual.bg,/rgb\(8, 10, 12\)/);
 assert.equal(await page.locator('#uxLayerDicom').isVisible(),true);
 assert.equal(await page.locator('#uxLayerExternal').isVisible(),false);
 assert.equal(await page.locator('#uxDicomTag').innerText(),'Sin cargar');
 assert.equal(await page.locator('#uxVolumeOpacityControl').isVisible(),false);
 assert.equal(await page.locator('.surface-row').count(),0,'No invented anatomic layers');
 assert.equal(await page.locator('#segmentationPanel').isVisible(),false);
 await page.screenshot({path:'/tmp/anatheos-uxn1-empty-shell.png',fullPage:false});
 await page.locator('#surfaceButton').click();
 await page.waitForFunction(()=>document.body.dataset.b5View==='surface');
 assert.equal(await page.locator('#uxLayerExternal').isVisible(),true);
 assert.equal(await page.locator('#uxLayerDicom').isVisible(),false);
 assert.equal(await page.locator('#surfacePanel').isVisible(),true);
 await page.locator('#uxProvenanceDetails summary').click();
 assert.match(await page.locator('#uxSourceExplanation').innerText(),/otro espécimen/i);
 assert.equal(await page.locator('#surfaceLayers .surface-row').count(),0);
 const tri='solid synthetic\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid synthetic\n';
 await page.locator('#surfaceFile').setInputFiles({name:'synthetic.stl',mimeType:'application/octet-stream',buffer:Buffer.from(tri)});
 await page.waitForFunction(()=>document.querySelectorAll('#surfaceLayers .surface-row').length===1);
 const row=page.locator('#uxLayersPanel .surface-row').first();
 assert.equal(await row.isVisible(),true);
 await row.locator('input[type=checkbox]').uncheck();
 assert.equal(await row.locator('input[type=checkbox]').isChecked(),false);
 await row.locator('input[type=checkbox]').check();
 await row.locator('input[type=range]').evaluate(el=>{el.value='45';el.dispatchEvent(new Event('input',{bubbles:true}))});
 await page.locator('#twoDButton').click();
 await page.waitForFunction(()=>document.body.dataset.b5View==='slice');
 assert.equal(await page.locator('#uxLayerExternal').isVisible(),false);
 assert.equal(await page.locator('#uxLayerDicom').isVisible(),true);
 await page.locator('#b5AdvancedToggle').click();
 assert.equal(await page.locator('#segmentationPanel').isVisible(),true,'Legacy segmentation tools must remain accessible');
 await page.locator('#b5AdvancedToggle').click();
 await page.locator('#uxVolumeOpacity').evaluate(el=>{el.value='125';el.dispatchEvent(new Event('input',{bubbles:true}))});
 assert.equal(await page.locator('#volumeOpacity').inputValue(),'125');
 assert.deepEqual(errors,[],'JS errors');
 assert.deepEqual(outbound,[],'Unexpected outbound requests');
 await page.close();
 const mobile=await browser.newPage({viewport:{width:390,height:844}});
 const mobileErrors=[];
 mobile.on('pageerror',e=>mobileErrors.push(e.message));
 await mobile.goto(url,{waitUntil:'networkidle'});
 const mob=await mobile.evaluate(()=>({
  layout:getComputedStyle(document.querySelector('#uxN1Layout')).display,
  widths: [document.querySelector('.workspace'),document.querySelector('.ux-layers')].map(el=>el.getBoundingClientRect().width),
  viewport:innerWidth
 }));
 assert.equal(mob.layout,'flex',JSON.stringify(mob));
 assert(mob.widths.every(w=>w<=mob.viewport+2),JSON.stringify(mob));
 assert.equal(await mobile.locator('#uxLayersPanel').isVisible(),true);
 assert.deepEqual(mobileErrors,[]);
 console.log('PASS UX-N1: dark three-column hierarchy; real empty/mesh layers/provenance; genuine opacity binding; advanced editor preserved; mobile responsive; no outbound requests');
}finally{await browser.close()}
