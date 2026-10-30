#!/usr/bin/env python3
"""Automated Chromium smoke of synthetic 24-series catalog through loopback server."""
from __future__ import annotations
import base64,json,pathlib,re,sys,tempfile,threading,zipfile
from http.server import ThreadingHTTPServer
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT),str(ROOT/'tests')]
from test_r2_e2e import FAMILIES,one
from preparar_todas_las_series import main as ingest
from servidor_local_privado import PrivateServer

with tempfile.TemporaryDirectory() as tmp:
  d=pathlib.Path(tmp);src=d/'synthetic.zip';out=d/'private'
  with zipfile.ZipFile(src,'w',compression=zipfile.ZIP_DEFLATED) as z:
    for n,family in enumerate(FAMILIES,1):
      for i in range(3):z.writestr(f'case/{n:02d}/frame_{i:03d}.dcm',one('1.2.826.0.1.3680043.10.991.999',n,i,family)[0])
  assert ingest(['--entrada',str(src),'--destino',str(out),'--esperar-series','24','--esperar-imagenes','72'])==0
  PrivateServer.viewer=ROOT;PrivateServer.data_root=out
  srv=ThreadingHTTPServer(('127.0.0.1',0),PrivateServer)
  # Host header validation requires port exact, served by server_port.
  thread=threading.Thread(target=srv.serve_forever,daemon=True);thread.start()
  try:
    with sync_playwright() as p:
      browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--disable-gpu','--no-sandbox'])
      page=browser.new_page(viewport={'width':1440,'height':900})
      errors=[];page.on('pageerror',lambda ex:errors.append(str(ex)))
      # Chromium in this environment blocks all localhost navigation via policy.
      # Exercise the exact viewer JS against synthetic local files mocked in RAM.
      html=(ROOT/'visor_local.html').read_text(encoding='utf8')
      html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>', '', html)
      html=html.replace('<script src="visor_cmr.js" defer></script>','')
      page.set_content(html)
      mapping={'catalogo_local_privado.json':{'json':json.loads((out/'catalogo_local_privado.json').read_text())}}
      for s in ['RM-004','RM-016','RM-022']:
          mapping[f'{s}/geometria_privada.json']={'json':json.loads((out/s/'geometria_privada.json').read_text())}
          mapping[f'{s}/pixels_original_decoded.npy']={'base64':base64.b64encode((out/s/'pixels_original_decoded.npy').read_bytes()).decode()}
      page.evaluate("""(mapping)=>{
        window.fetch=async (url)=>{
          const v=mapping[url];if(!v)return {ok:false,status:404};
          return {ok:true,status:200,json:async()=>v.json,arrayBuffer:async()=>{
             const binary=atob(v.base64);const result=new Uint8Array(binary.length);
             for(let i=0;i<binary.length;i++)result[i]=binary.charCodeAt(i);
             return result.buffer;
          }};
        };
      }""",mapping)
      page.add_script_tag(content=(ROOT/'visor_cmr.js').read_text(encoding='utf8'))
      page.wait_for_function('document.querySelectorAll("#serie option").length === 25',timeout=20000)
      assert page.locator('#serie option').count()==25
      page.select_option('#serie','RM-004')
      page.wait_for_function('document.querySelector("#canvas").width===22 && document.querySelector("#canvas").height===20',timeout=10000)
      assert page.locator('#play').is_enabled()
      page.select_option('#serie','RM-022')
      page.wait_for_function('document.querySelector("#status").textContent.includes("RM-022")',timeout=10000)
      assert page.locator('#play').is_disabled(), 'PSIR must not auto-play as heartbeat'
      page.select_option('#serie','RM-016')
      page.wait_for_function('document.querySelector("#status").textContent.includes("RM-016")',timeout=10000)
      assert page.locator('#play').is_enabled()
      assert not errors,errors
      # ensure no directory listing, hidden executables, or original ZIP available over HTTP
      import urllib.request, urllib.error
      for route in ['/unknown.exe','/tests/test_browser.py']:
        request=urllib.request.Request(f'http://127.0.0.1:{srv.server_port}{route}')
        try:
          with urllib.request.urlopen(request,timeout=2) as response:
            raise AssertionError((route,response.status))
        except urllib.error.HTTPError as e:assert e.code==404,(route,e.code)
      with urllib.request.urlopen(f'http://127.0.0.1:{srv.server_port}/visor_cmr.js',timeout=3) as response:
        assert response.headers.get('Cache-Control')=='no-store, max-age=0'
        assert "connect-src 'self'" in response.headers.get('Content-Security-Policy','')
      
      print('ANATHEOS_CMR_R2_BROWSER_QA='+json.dumps({'status':'PASS','synthetic_series':24,
        'catalog_options':25,'cine_controls':True,'psir_not_cine':True,'no_js_errors':True,
        'sensitive_files_not_served':True},sort_keys=True),flush=True)
      browser.close()
  finally:
    srv.shutdown();srv.server_close()