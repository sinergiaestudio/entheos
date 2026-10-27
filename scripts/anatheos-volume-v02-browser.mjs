import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { zipSync } from "fflate";
import { makeSyntheticDicom } from "../tests/fixtures/anatheos/synthetic-series.mjs";

const baseDir=resolve(".sites-runtime/anatheos-v02");
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8"};
const types={"/":"index.html","/index.html":"index.html","/app.js":"app.js",
 "/volumetric.js":"volumetric.js","/style.css":"style.css"};
const server=createServer((req,res)=>{
 const name=types[new URL(req.url,"http://localhost").pathname];
 if(!name){res.writeHead(404);res.end();return;}
 const ext=name.slice(name.lastIndexOf("."));
 res.writeHead(200,{"Content-Type":mime[ext],"Cache-Control":"no-store",
  "Content-Security-Policy":"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data: blob:; object-src 'none'"});
 res.end(readFileSync(join(baseDir,name)));
});
await new Promise(r=>server.listen(4179,"127.0.0.1",r));
const browser=await chromium.launch({headless:true,args:["--enable-unsafe-swiftshader","--enable-webgl",
 "--use-gl=angle","--use-angle=swiftshader"]});
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[],outbound=[];
 page.on("pageerror",e=>errors.push(e.message.slice(0,250)));
 page.on("request",r=>{if(!r.url().startsWith("http://127.0.0.1:4179/"))outbound.push(r.url().split(":")[0]);});
 await page.goto("http://127.0.0.1:4179/",{waitUntil:"networkidle"});
 const data={};
 for(let z=0;z<16;z++){
  data["test_dess/"+String(z).padStart(4,"0")]=makeSyntheticDicom({
   scenario:98,layer:z,position:[10,20,30+z],rows:64,columns:64,pixelSpacing:[.36,.36],
  });
 }
 const packed=zipSync(data,{level:4});
 await page.locator("#zipInput").setInputFiles({name:"RTKN0668_MR_DESS.zip",mimeType:"application/zip",buffer:Buffer.from(packed)});
 await page.waitForFunction(()=>document.getElementById("metaCount").textContent.includes("16 imágenes"),null,{timeout:45000});
 assert.equal(await page.locator("#metaMatrix").innerText(),"64 × 64");
 await page.locator("#threeDButton").click();
 await page.waitForFunction(()=>document.getElementById("volumeStatus").textContent.includes("Volumen 64"),null,{timeout:45000});
 const canvas=page.locator("#volumeCanvas");
 assert.equal(await canvas.isVisible(),true);
 const first=await canvas.evaluate(c=>({width:c.width,height:c.height,sig:c.toDataURL().slice(-1000)}));
 assert.ok(first.width>0&&first.height>0,"3D canvas has no size");
 await canvas.hover({position:{x:80,y:90}});
 await page.mouse.down();await page.mouse.move(290,200,{steps:6});await page.mouse.up();
 const second=await canvas.evaluate(c=>({sig:c.toDataURL().slice(-1000)}));
 assert.notEqual(first.sig,second.sig,"rotating volume did not change pixels");
 await page.locator("#volumeThreshold").fill("20");
 await page.locator("#volumeOpacity").fill("110");
 await page.locator("#twoDButton").click();
 assert.equal(await page.locator("#scanCanvas").isVisible(),true);
 await page.locator("#clearButton").click();
 assert.equal(await page.locator("#metaCount").innerText(),"—");
 assert.deepEqual(errors,[],"browser Javascript error");
 assert.deepEqual(outbound,[],"unexpected external request");
 console.log("ANATHEOS v0.2: PASS Chromium synthetic volume, rotated actual voxel ray caster, sliders, return 2D, clean; backend "+first.width+"x"+first.height+"; 0 outbound requests / page errors");
} finally {
 await browser.close();await new Promise(r=>server.close(r));
}
