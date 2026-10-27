import assert from "node:assert/strict";
import { chromium } from "playwright";
import { zipSync } from "fflate";
import { makeSyntheticDicom } from "../tests/fixtures/anatheos/synthetic-series.mjs";

const origin="http://127.0.0.1:4178";
const browser=await chromium.launch({headless:true});
const errors=[],outbound=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  page.on("pageerror",e=>errors.push(e.name+": "+e.message.slice(0,200)));
  page.on("request",req=>{
    const url=new URL(req.url());
    if(url.origin!==origin && url.protocol!=="data:" && url.protocol!=="blob:") {
      outbound.push({method:req.method(),protocol:url.protocol});
    }
  });
  await page.goto(origin+"/anatheos-ci-preview",{waitUntil:"networkidle",timeout:45000});
  assert.ok(await page.getByText("Demo web experimental", {exact:false}).count());
  const synthetic=zipSync({
    "DESS_TEST/1001":makeSyntheticDicom({scenario:97,layer:0,position:[10,20,30]}),
    "DESS_TEST/1002":makeSyntheticDicom({scenario:97,layer:1,position:[10,20,31]}),
  });
  await page.locator("input[type=file][accept*='.zip']").setInputFiles({
    name:"RTKN0668_MR_DESS.zip",mimeType:"application/zip",buffer:Buffer.from(synthetic),
  });
  await page.getByText("2 cortes compatibles", {exact:false}).waitFor({timeout:45000});
  const canvas=page.locator("canvas[aria-label='Imagen DICOM experimental']");
  assert.equal(await canvas.count(),1);
  const metrics=await canvas.evaluate(c=>{
    const data=c.getContext("2d").getImageData(0,0,c.width,c.height).data;
    let nonBackground=0;
    for(let i=0;i<data.length;i+=4) if(data[i]!==21 && data[i]!==0)nonBackground++;
    return{width:c.width,height:c.height,nonBackground};
  });
  assert.ok(metrics.width>=200&&metrics.height>=200);
  assert.ok(metrics.nonBackground>10,"no synthetic pixels visible");
  await page.getByRole("button",{name:"+"}).click();
  await page.getByRole("button",{name:"Restablecer"}).click();
  await page.getByLabel("Corte DICOM").focus();
  await page.keyboard.press("Home");
  await page.getByText("Corte 1 / 2", {exact:false}).waitFor({timeout:5000});
  for(const label of ["Ventana","Nivel","Brillo","Contraste"]) {
    assert.equal(await page.getByRole("slider",{name:label}).count(),1);
  }
  await page.getByRole("button",{name:"Liberar"}).click();
  await page.getByText("Datos desvinculados", {exact:false}).waitFor({timeout:5000});
  assert.deepEqual(outbound,[],"external request detected");
  assert.deepEqual(errors,[],"page errors detected");
  process.stdout.write("ANATHEOS Sites preview browser smoke: PASS "+JSON.stringify({
    syntheticSlices:2,canvas:metrics,externalRequests:outbound.length,pageErrors:errors.length,
    interactions:["ZIP","slice slider","window/level sliders","zoom","reset","release"],
  })+"\n");
} finally {
  await browser.close();
}
