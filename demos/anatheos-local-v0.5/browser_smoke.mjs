import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const url=process.env.ANATHEOS_V05_SMOKE_URL||'http://127.0.0.1:8774/';
function stl(dx){const b=Buffer.alloc(84+50*2);b.writeUInt32LE(2,80);const tris=[[[dx,0,0],[dx+40,0,0],[dx,40,0]],[[dx,0,20],[dx+40,0,20],[dx,40,20]]];tris.forEach((points,i)=>points.flat().forEach((v,k)=>b.writeFloatLE(v,84+i*50+12+k*4)));return b;}
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],outside=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('request',r=>{if(!r.url().startsWith(url.replace(/\/$/,'')))outside.push(r.url());});
try{
 await page.goto(url,{waitUntil:'networkidle'});
 assert.equal(await page.locator('#surfaceButton').count(),1);
 await page.locator('#surfaceSource').selectOption('spl-knee');
 await page.locator('#surfaceFile').setInputFiles([
  {name:'femur-95.stl',mimeType:'application/octet-stream',buffer:stl(0)},
  {name:'tibia-96.stl',mimeType:'application/octet-stream',buffer:stl(60)}]);
 await page.waitForFunction(()=>document.querySelectorAll('.surface-row').length===2,{timeout:12000});
 assert.equal(await page.locator('#surfaceButton').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#surfaceCanvas').isVisible(),true);
 const canvas=await page.locator('#surfaceCanvas').evaluate(el=>({width:el.width,height:el.height}));
 assert(canvas.width>200&&canvas.height>100,'No rasterized WebGL canvas');
 await page.locator('.surface-row').first.locator('button').last().click();
 assert.deepEqual(await page.locator('.surface-row input[type=checkbox]').evaluateAll(xs=>xs.map(x=>x.checked)),[true,false]);
 await page.locator('#surfaceAll').click();
 assert.deepEqual(await page.locator('.surface-row input[type=checkbox]').evaluateAll(xs=>xs.map(x=>x.checked)),[true,true]);
 await page.locator('.surface-row').first.locator('input[type=range]').fill('35');
 await page.locator('#twoDButton').click();
 assert.equal(await page.locator('#surfaceCanvas').isVisible(),false);
 await page.locator('#surfaceButton').click();
 assert.equal(await page.locator('#surfaceCanvas').isVisible(),true);
 await page.screenshot({path:'.sites-runtime/anatheos-v05-synthetic.png',fullPage:true});
 assert.deepEqual(errors,[],'Browser JS errors');
 assert.deepEqual(outside,[],'External requests');
 console.log('PASS v0.5 synthetic Chromium smoke: two distinct meshes, controls, WebGL2 canvas, mode switching, no JS errors, no outbound requests');
}finally{await browser.close();}
