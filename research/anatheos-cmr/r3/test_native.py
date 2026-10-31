#!/usr/bin/env python3
"""CMR-R3 full native ANATHEOS smoke with exclusively synthetic pixels."""
import json, pathlib, tempfile, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import numpy as np
from playwright.sync_api import sync_playwright, expect

ROOT = pathlib.Path(__file__).resolve().parents[3] / "demos" / "anatheos-local-v0.5"
SCHEMA="anatheos-cmr-r2-private-v1"
def series(folder,sid,frames,mode):
    dest=folder/sid;dest.mkdir()
    arr=np.zeros((len(frames),64,64),dtype="<u2")
    yy,xx=np.ogrid[:64,:64]
    for i in range(len(frames)):
        arr[i]=np.where((xx-32)**2+(yy-32)**2<24**2,700+i*3,30).astype("<u2")
    np.save(dest/"pixels_original_decoded.npy",arr,allow_pickle=False)
    (dest/"geometria_privada.json").write_text(json.dumps({"schema":SCHEMA,"serie_local":sid,"frames":frames}))
    return {"serie_local":sid,"estado":"preparada","instancias":len(frames),"modo_seguro":mode,"familia_probable":mode}

def frame(ori,pos,index,trigger=None):
    return {"image_orientation_patient_LPS":ori,"image_position_patient_LPS_mm":pos,
        "pixel_spacing_row_col_mm":[1,1],"photometric_interpretation":"MONOCHROME2",
        "instance_number":index,"temporal_position_identifier":None,"trigger_time_ms":trigger}

def synth(folder):
    os=[([1,0,0,0,1,0],lambda k:[0,0,k*3]),
        ([0,1,0,0,0,1],lambda k:[k*3,0,0]),
        ([1,0,0,0,0,-1],lambda k:[0,k*3,0])]
    survey=[frame(o,p(k),idx+1) for idx,(o,p,k) in enumerate(
        (o,p,k) for o,p in os for k in range(20))]
    cine=[frame([1,0,0,0,1,0],[0,0,k*4],k*3+t+1,t*40)
          for k in range(2) for t in range(3)]
    metadata=[series(folder,"RM-001",survey,"localizador_2d"),
              series(folder,"RM-002",cine,"cine_provisional")]
    (folder/"catalogo_local_privado.json").write_text(json.dumps({"schema":SCHEMA,
      "series_detectadas":2,"series_preparadas":2,"instancias_preparadas":66,"series":metadata}))
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
    def log_message(self,*args):pass
    extensions_map={**SimpleHTTPRequestHandler.extensions_map,".mjs":"text/javascript",".js":"text/javascript"}
def main():
    with tempfile.TemporaryDirectory() as temp:
        folder=pathlib.Path(temp)/"CMR_R2_PRIVATE";folder.mkdir();synth(folder)
        server=ThreadingHTTPServer(("127.0.0.1",0),Handler)
        t=threading.Thread(target=server.serve_forever,daemon=True);t.start()
        try:
            with sync_playwright() as playwright:
                browser=playwright.chromium.launch(headless=True,args=["--no-sandbox","--disable-gpu"])
                page=browser.new_page(viewport={"width":1700,"height":950})
                errors=[];page.on("pageerror",lambda e:errors.append(str(e)))
                page.goto(f"http://127.0.0.1:{server.server_port}/index.html",wait_until="domcontentloaded")
                page.wait_for_selector("#cmrNativeOpen",timeout=20000)
                page.set_input_files("#cmrNativeFolder",str(folder))
                expect(page.locator("#cmrNativePanel")).to_be_visible(timeout=25000)
                expect(page.locator("#cmrNativeOri option")).to_have_count(3,timeout=25000)
                assert page.locator("#cmrNativeCanvas").evaluate("e=>e.width")==64
                page.locator('#uxMoreViewer summary').click()
                page.wait_for_function("()=>document.querySelector('.ux-clean-menu-content').matches(':popover-open')")
                assert page.locator('#fitButton').evaluate("e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}")
                page.keyboard.press('Escape')
                assert not page.locator('#uxMoreViewer').evaluate('e=>e.open')
                assert page.locator("#cmrNativeSeries option").count()==2
                counts=[]
                for i in ["0","1","2"]:
                    page.select_option("#cmrNativeOri",i)
                    counts.append(int(page.locator("#cmrNativePlane").get_attribute("max"))+1)
                assert counts==[20,20,20],counts
                assert page.locator("#cmrNativePlay").is_disabled()
                page.locator("#cmrNativeZoom").fill("200")
                assert page.locator("#cmrNativeZoomText").inner_text()=="200 %"
                page.select_option("#cmrNativeSeries","RM-002")
                expect(page.locator("#cmrNativeOri option")).to_have_count(1,timeout=12000)
                assert page.locator("#cmrNativePlay").is_enabled()
                assert int(page.locator("#cmrNativePlane").get_attribute("max"))==1
                assert int(page.locator("#cmrNativePhase").get_attribute("max"))==2
                page.locator("#cmrNativeClose").click()
                assert page.locator("#cmrNativePanel").is_hidden()
                assert page.locator("#zipButton").count()==1
                assert not errors,errors
                print("ANATHEOS_CMR_R3_NATIVE_QA="+json.dumps({
                  "gate":"PASS_SYNTHETIC_FULL_NATIVE_APP",
                  "orientation_groups":3,"positions_per_orientation":counts,
                  "cine_phase_controls":True,"zoom_200_percent":True,
                  "existing_DICOM_import_still_present":True,
                  "no_original_medical_data":True,"javascript_errors":0
                },sort_keys=True),flush=True)
                browser.close()
        finally:server.shutdown();server.server_close()
if __name__=="__main__":main()
