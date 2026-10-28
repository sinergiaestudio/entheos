import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox']});
const page=await browser.newPage({viewport:{width:1350,height:870}});
const errors=[],requests=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('request',req=>{if(!req.url().startsWith('http://127.0.0.1:8774/'))requests.push(req.url())});
try{
 await page.goto('http://127.0.0.1:8774/',{waitUntil:'networkidle'});
 assert.equal(await page.locator('#surfaceHelpOverlay').isVisible(),false);
 await page.locator('#surfaceButton').click();
 assert.equal(await page.locator('#surfaceHelpOverlay').isVisible(),true);
 assert.match(await page.locator('#surfaceHelpOverlay').innerText(),/Preparar y ver atlas SPL/);
 assert.equal(await page.locator('#surfaceAll').isEnabled(),false);
 assert.equal(await page.locator('#surfaceReset').isEnabled(),false);
 assert.equal(await page.locator('#surfaceClear').isEnabled(),false);
 assert.equal(await page.locator('#volumeControls').isVisible(),false);
 assert.equal(await page.locator('#surfaceButton').getAttribute('aria-pressed'),'true');
 await page.locator('#twoDButton').click();
 assert.equal(await page.locator('#surfaceHelpOverlay').isVisible(),false);
 assert.equal(await page.locator('#scanCanvas').isVisible(),true);
 await page.locator('#surfaceButton').click();
 assert.equal(await page.locator('#surfaceHelpOverlay').isVisible(),true);
 // Make an invented 3-facet tetrahedron in the browser test only, not in the
 // distributed medical reference package.
 const textSTL='solid demo\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid demo\n';
 await page.locator('#surfaceFile').setInputFiles({name:'synthetic.stl',mimeType:'application/octet-stream',buffer:Buffer.from(textSTL)});
 await page.waitForFunction(()=>document.querySelectorAll('.surface-row').length===1);
 assert.equal(await page.locator('#surfaceHelpOverlay').isVisible(),false);
 assert.equal(await page.locator('#surfaceAll').isEnabled(),true);
 assert.equal(await page.locator('#surfaceClear').isEnabled(),true);
 await page.locator('#surfaceManual summary').click();
 await page.locator('#surfaceClear').click();
 assert.equal(await page.locator('#surfaceHelpOverlay').isVisible(),true);
 assert.equal(await page.locator('#surfaceAll').isEnabled(),false);
 assert.deepEqual(errors,[]);
 assert.deepEqual(requests,[]);
 console.log('PASS B4: no-model guidance, disabled irrelevant controls, 2D/STL state, synthetic surface, clear, no outbound browser requests');
} finally {await browser.close()}
