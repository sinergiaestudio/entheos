import assert from "node:assert/strict";
import { chromium } from "playwright";
import { zipSync } from "fflate";
import { makeSyntheticDicom } from "./fixtures/anatheos/synthetic-series.mjs";

const origin="http://127.0.0.1:8770";
const browser=await chromium.launch({headless:true,args:["--enable-unsafe-swiftshader","--use-gl=angle","--use-angle=swiftshader"]});
const errors=[],external=[];
try{
  const page=await browser.newPage({viewport:{width:1550,height:950}});
  page.on("pageerror",error=>errors.push(error.name+": "+error.message.slice(0,200)));
  page.on("request",request=>{
    const url=new URL(request.url());
    if(url.origin!==origin && url.protocol!=="data:" && url.protocol!=="blob:"){
      external.push({method:request.method(),protocol:url.protocol});
    }
  });
  await page.goto(origin+"/",{waitUntil:"networkidle",timeout:45000});
  const regular=await page.locator("#viewerRoot").boundingBox();
  assert.ok(regular.height>=440,"v0.3 initial viewer too short");
  await page.locator("#focusButton").click();
  const focus=await page.locator("#viewerRoot").boundingBox();
  assert.ok(focus.width>regular.width,"focus mode did not expand viewport");
  assert.ok(focus.height>regular.height,"focus mode did not increase viewer height");
  await page.locator("#focusButton").click();
  await page.locator("#fullscreenButton").click();
  await page.waitForFunction(()=>Boolean(document.fullscreenElement));
  await page.locator("#exitFullscreenViewer").click();
  await page.waitForFunction(()=>!document.fullscreenElement);

  const synthetic=zipSync({
    "SYNTHETIC_DESS/001":makeSyntheticDicom({scenario:98,layer:0,position:[10,20,30]}),
    "SYNTHETIC_DESS/002":makeSyntheticDicom({scenario:98,layer:1,position:[10,20,31]})
  });
  await page.locator("#zipInput").setInputFiles({name:"synthetic-dicom.zip",
    mimeType:"application/zip",buffer:Buffer.from(synthetic)});
  await page.waitForFunction(()=>document.getElementById("metaCount").textContent.includes("2 imágenes"),null,{timeout:20000});
  await page.locator("#threeDButton").click();
  await page.waitForFunction(()=>document.getElementById("volumeStatus").textContent.includes("Volumen 4 × 3 × 2"),null,{timeout:25000});
  assert.equal(await page.evaluate(()=>state.volumeRenderer.prepared.output.length),24);
  await page.locator("#volumeClip").fill("45");
  await page.locator("#volumeClip").dispatchEvent("input");
  assert.equal(await page.evaluate(()=>state.volumeRenderer.clip),.45);
  await page.locator("#volumePalette").selectOption("tint");
  assert.equal(await page.evaluate(()=>state.volumeRenderer.palette),1);
  await page.locator("#focusButton").click();
  await page.locator("#volumeClipHUD").fill("85");
  await page.locator("#volumeClipHUD").dispatchEvent("input");
  assert.equal(await page.evaluate(()=>state.volumeRenderer.clip),.85);
  await page.locator("#volumePaletteHUD").selectOption("gray");
  assert.equal(await page.evaluate(()=>state.volumeRenderer.palette),0);
  const angle=await page.evaluate(()=>state.volumeRenderer.yaw);
  const box=await page.locator("#volumeCanvas").boundingBox();
  await page.mouse.move(box.x+box.width*.50,box.y+box.height*.50);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width*.58,box.y+box.height*.55,{steps:2});
  await page.mouse.up();
  assert.notEqual(await page.evaluate(()=>state.volumeRenderer.yaw),angle);
  await page.screenshot({path:".sites-runtime/anatheos-v03-synthetic-preview.png"});
  await page.locator("#focusButton").click();
  await page.locator("#twoDButton").click();
  assert.ok(await page.locator("#scanCanvas").isVisible());
  await page.locator("#clearButton").click();
  assert.equal(await page.locator("#metaCount").innerText(),"—");
  assert.deepEqual(external,[],"Unexpected external browser requests");
  assert.deepEqual(errors,[],"Unexpected JS page errors");
  process.stdout.write("ANATHEOS v0.3 Chromium PASS: "+JSON.stringify({
    slices:2,shape:[4,3,2],initialViewer:regular,focusViewer:focus,
    controls:["fullscreen","focus","depth","palette","rotation","2d","release"],
    externalRequests:external.length,pageErrors:errors.length
  })+"\n");
}finally{await browser.close();}
