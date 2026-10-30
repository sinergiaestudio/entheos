#!/usr/bin/env python3
"""Loopback-only, strict allowlist HTTP viewer for sensitive local CMR derivatives.
No file listing, absolute paths, directory traversal or cross-origin scripts.
"""
import argparse, http.server, mimetypes, pathlib, re, sys, urllib.parse

class PrivateServer(http.server.BaseHTTPRequestHandler):
    viewer=None
    data_root=None
    server_version='ANATHEOSPrivateLocal/1'
    sys_version=''
    def log_message(self,format,*args):
        # Never log requests containing possibly sensitive paths.
        pass
    def do_HEAD(self):self.serve(send_body=False)
    def do_GET(self):self.serve(send_body=True)
    def serve(self,send_body):
        hostname=self.headers.get('Host','')
        if hostname not in (f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}'):
            self.send_error(403,'Host no permitido');return
        route=urllib.parse.urlsplit(self.path)
        if route.query or route.fragment or '%' in route.path or '\\' in route.path or '\x00' in route.path:
            self.send_error(404);return
        path=route.path
        if path=='/':
            self.send_response(302);self.send_header('Location','/visor_local.html');self.send_header('Cache-Control','no-store');self.end_headers();return
        if path in ('/visor_local.html','/visor_cmr.js','/visor_cmr.css'):
            target=self.viewer/path.lstrip('/')
        elif path=='/catalogo_local_privado.json':
            target=self.data_root/'catalogo_local_privado.json'
        else:
            m=re.fullmatch(r'/RM-\d{3}/(geometria_privada\.json|pixels_original_decoded\.npy)',path)
            if not m:
                self.send_error(404);return
            target=self.data_root/path.lstrip('/')
        try:
            root=self.viewer if path in ('/visor_local.html','/visor_cmr.js','/visor_cmr.css') else self.data_root
            target=target.resolve(strict=True)
            if not target.is_relative_to(root.resolve()) or not target.is_file():
                self.send_error(404);return
            size=target.stat().st_size
            if size>500*1024*1024:self.send_error(413);return
            kind={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
                  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
                  '.npy':'application/octet-stream'}.get(target.suffix,'application/octet-stream')
            self.send_response(200)
            self.send_header('Content-Type',kind)
            self.send_header('Content-Length',str(size))
            self.send_header('Cache-Control','no-store, max-age=0')
            self.send_header('X-Content-Type-Options','nosniff')
            self.send_header('X-Frame-Options','DENY')
            self.send_header('Referrer-Policy','no-referrer')
            self.send_header('Content-Security-Policy',
              "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'")
            self.end_headers()
            if send_body:
                with target.open('rb') as f:
                    for block in iter(lambda:f.read(1024**2),b''):self.wfile.write(block)
        except (OSError,PermissionError,FileNotFoundError):
            try:self.send_error(404)
            except (BrokenPipeError,ConnectionResetError):pass
        except (BrokenPipeError,ConnectionResetError):pass

def main():
    p=argparse.ArgumentParser();p.add_argument('--datos',required=True);p.add_argument('--puerto',type=int,default=8766)
    a=p.parse_args();folder=pathlib.Path(a.datos).resolve();viewer=pathlib.Path(__file__).resolve().parent
    if not (folder/'catalogo_local_privado.json').is_file():
        p.error('No se encuentra el catálogo local R2: primero prepará los DICOM originales')
    if a.puerto<1024 or a.puerto>65535:p.error('Puerto inválido')
    PrivateServer.viewer=viewer;PrivateServer.data_root=folder
    with http.server.ThreadingHTTPServer(('127.0.0.1',a.puerto),PrivateServer) as server:
        print('ANATHEOS CMR-R2: visor PRIVADO, solo 127.0.0.1:{}'.format(a.puerto),flush=True)
        print('http://127.0.0.1:{}/visor_local.html'.format(a.puerto),flush=True)
        print('Presioná Ctrl+C para cerrar.',flush=True)
        try:server.serve_forever(poll_interval=.2)
        except KeyboardInterrupt:pass
if __name__=='__main__':main()