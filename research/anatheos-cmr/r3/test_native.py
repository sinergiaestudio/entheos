#!/usr/bin/env python3
"""CMR-R3 full native ANATHEOS smoke with exclusively synthetic pixels."""
import json, pathlib, tempfile, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import numpy as np
from playwright.sync_api import sync_playwright, expect

ROOT = pathlib.Path(__file__).resolve().parents[3] / "demos" / "anatheos-local-v0.5"
SCHEMA="anatheos-cmr-r2-private-v1"
def series(folder,sid,frames,mode):
    frames=[{**f,"study_instance_uid":"synthetic-study","series_instance_uid":sid,"frame_of_reference_uid":"synthetic-for"} for f in frames]
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
    from test_station import main as station
    station()
if __name__=='__main__':main()
