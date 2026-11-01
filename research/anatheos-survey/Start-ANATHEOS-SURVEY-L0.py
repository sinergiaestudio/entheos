"""Optional Linux/macOS QA launcher; Windows uses built-in PowerShell."""
import hashlib,json,pathlib,sys,webbrowser
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from urllib.parse import unquote,urlsplit
root=pathlib.Path(__file__).resolve().parent/'web'
manifest=json.loads((root/'manifest.json').read_text(encoding='utf-8'))
for key,digest in manifest.items():
 p=(root/key).resolve()
 if not p.is_relative_to(root.resolve()) or hashlib.sha256(p.read_bytes()).hexdigest()!=digest:raise RuntimeError('Prototype integrity failed')
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  if self.headers.get('Host')!=f'127.0.0.1:{self.server.server_port}' or self.headers.get('Sec-Fetch-Site')=='cross-site':self.send_error(403);return
  key=unquote(urlsplit(self.path).path).lstrip('/') or 'index.html'
  if key=='api/cmr/capabilities':body=b'{"local_only":true,"original_zip":false,"survey_prototype":true}';mime='application/json'
  elif key in manifest:
   p=(root/key).resolve()
   if not p.is_relative_to(root.resolve()):self.send_error(403);return
   body=p.read_bytes();mime={'.mjs':'text/javascript','.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json'}.get(p.suffix,'application/octet-stream')
  else:self.send_error(404);return
  self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Referrer-Policy','no-referrer');self.send_header('Cross-Origin-Resource-Policy','same-origin');self.send_header('Content-Security-Policy',"default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'");self.end_headers()
  if self.command!='HEAD':self.wfile.write(body)
 def do_HEAD(self):self.do_GET()
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
print(f'ANATHEOS_SURVEY_URL=http://127.0.0.1:{server.server_port}/',flush=True)
if '--no-browser' not in sys.argv:webbrowser.open(f'http://127.0.0.1:{server.server_port}/')
try:server.serve_forever()
except KeyboardInterrupt:pass
finally:server.server_close()
