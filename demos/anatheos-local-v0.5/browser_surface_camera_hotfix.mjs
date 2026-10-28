import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const url='http://127.0.0.1:8774/';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[],outbound=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(!r.url().startsWith(url))outbound.push(r.url())});
 await page.goto(url,{waitUntil:'networkidle'});
 await page.locator('#surfaceButton').click();
 // No DICOM or external STL is needed: generate two synthetic quads entirely
 // within browser memory to assert depth order and resize without any clinical asset.
 const result=await page.evaluate(async()=>{
  const {SurfaceRenderer,surfaceOrbitDrag,surfaceViewport}=await import('/surface-renderer.mjs');
  const cv=document.createElement('canvas');
  cv.style.cssText='display:block;width:320px;height:320px';
  document.querySelector('#viewerRoot').append(cv);
  const r=new SurfaceRenderer(cv);r.yaw=0;r.pitch=0;r.zoom=1.2;
  const quad=z=>{
   const p=new Float32Array([
    -.5,-.5,z,.5,-.5,z,.5,.5,z,
    -.5,-.5,z,.5,.5,z,-.5,.5,z
   ]);
   const n=new Float32Array(Array.from({length:6},()=>[0,0,-1]).flat());
   return {positions:p,normals:n,triangles:2,bounds:{min:[-.5,-.5,z],max:[.5,.5,z]},sourceFormat:'synthetic-test-only'};
  };
  const front=r.add(quad(-.3)),back=r.add(quad(.3));
  front.color='#ff0000';back.color='#00ff00';
  const sample=()=>{
   r.draw();const gl=r.gl,pixel=new Uint8Array(4);
   gl.readPixels(Math.floor(cv.width/2),Math.floor(cv.height/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
   return [...pixel];
  };
  const opaque=sample();
  front.visible=false;
  const background=sample();
  front.visible=true;front.opacity=.45;
  const transparent=sample();
  const oldBounds={width:cv.getBoundingClientRect().width,height:cv.getBoundingClientRect().height};
  cv.style.width='600px';cv.style.height='300px';
  r.draw();
  const resized={width:cv.width,height:cv.height,rectWidth:cv.getBoundingClientRect().width,rectHeight:cv.getBoundingClientRect().height,aspect:cv.width/cv.height};
  const glStatus={depth:r.gl.isEnabled(r.gl.DEPTH_TEST),cull:r.gl.isEnabled(r.gl.CULL_FACE),blend:r.gl.isEnabled(r.gl.BLEND)};
  const orbit=surfaceOrbitDrag(0,0,40,20);
  const vp=surfaceViewport(600,300,window.devicePixelRatio);
  r.dispose();cv.remove();
  return {opaque,background,transparent,oldBounds,resized,glStatus,orbit,vp};
 });
 assert(result.opaque[0]>result.opaque[1],JSON.stringify(result));
 assert(result.background[1]>result.background[0],JSON.stringify(result));
 assert(result.transparent[0]>result.background[0]&&result.transparent[1]>0,JSON.stringify(result));
 assert.equal(result.resized.aspect,2);
 assert.equal(result.resized.width/result.resized.rectWidth,result.resized.height/result.resized.rectHeight);
 assert.equal(result.glStatus.depth,true);
 assert.equal(result.glStatus.cull,false);
 assert.equal(result.glStatus.blend,false);
 assert(result.orbit.yaw<0&&result.orbit.pitch<0);
 
 // The actual ANATHEOS surface canvas must respond to focus/fullscreen/size
 // changes without a window resize event or introducing nonuniform stretching.
 const originalCanvas=page.locator('#surfaceCanvas');
 const syntheticSTL=Buffer.alloc(84+50);
 syntheticSTL.writeUInt32LE(1,80);
 [[0,0,0],[25,0,0],[0,25,0]].flat().forEach((x,i)=>syntheticSTL.writeFloatLE(x,84+12+i*4));
 await page.locator('#surfaceManual summary').click();
 await page.locator('#surfaceSource').selectOption('other-unverified');
 await page.locator('#surfaceFile').setInputFiles({name:'synthetic_plane.stl',mimeType:'application/octet-stream',buffer:syntheticSTL});
 await page.waitForFunction(()=>document.querySelector('#surfaceCanvas')?.width>100);
 const canvasSizes=async()=>originalCanvas.evaluate(c=>{const b=c.getBoundingClientRect();return {css:[b.width,b.height],backing:[c.width,c.height],dpr:Math.min(devicePixelRatio||1,1.5)}});
 const sizes=await canvasSizes();
 assert(Math.abs(sizes.backing[0]/sizes.backing[1]-sizes.css[0]/sizes.css[1])<.005);
 await page.locator('#focusButton').click();
 await page.waitForFunction(()=>{
  const c=document.querySelector('#surfaceCanvas'),r=c.getBoundingClientRect();
  return Math.abs(c.width/c.height-r.width/r.height)<.005&&c.width>100;
 });
 const focus=await canvasSizes();
 assert(focus.css[0]>sizes.css[0],JSON.stringify({sizes,focus}));
 await page.locator('#focusButton').click();
 // Force an aspect change without window resize, handled via ResizeObserver.
 await page.locator('#viewerRoot').evaluate(el=>{el.style.width='790px';el.style.height='450px'});
 await page.waitForFunction(()=>{
  const c=document.querySelector('#surfaceCanvas'),r=c.getBoundingClientRect();
  return Math.abs(c.width/c.height-r.width/r.height)<.005&&Math.abs(c.width-r.width*Math.min(devicePixelRatio||1,1.5))<3;
 });
 await page.locator('#viewerRoot').evaluate(el=>{el.style.width='';el.style.height=''});
 await page.locator('#fullscreenButton').click();
 await page.waitForTimeout(350);
 const fullscreenActive=await page.evaluate(()=>Boolean(document.fullscreenElement));
 if(fullscreenActive){
  await page.waitForFunction(()=>{
   const c=document.querySelector('#surfaceCanvas'),r=c.getBoundingClientRect();
   return Math.abs(c.width/c.height-r.width/r.height)<.005&&c.width>100;
  });
  await page.evaluate(()=>document.exitFullscreen());
 }
 assert.deepEqual(errors,[],JSON.stringify(errors));
 assert.deepEqual(outbound,[],JSON.stringify(outbound));
 console.log('PASS surface hotfix: 3D pixel depth-tested opaque and alpha, camera drag directions, resize/expanded aspect with actual WebGL, no remote data, fullscreen='+fullscreenActive);
}finally{await browser.close()}
