#!/usr/bin/env python3
"""ANATHEOS W1 loopback service: one-click original ZIP -> private local catalog.

The service never binds outside 127.0.0.1, never executes archive members and
stores each job below a process-owned temporary directory removed on shutdown.
It delegates DICOM/JPEG2000 validation to the audited CMR-R2 preparer.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import uuid
import webbrowser
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

MAX_UPLOAD = 3 * 1024**3
CHUNK = 1024**2
JOB_RE = re.compile(r"^[a-f0-9]{32}$")
DATA_RE = re.compile(r"^(?:catalogo_local_privado\.json|RM-\d{3}/(?:geometria_privada\.json|pixels_original_decoded\.npy))$")
STATIC_EXT = {".html", ".js", ".mjs", ".css"}
ATLAS = {
    "femur-95.stl": (16447884, "f14b53539fe5dba8cc3488f172e651f729e35b9b1f49eb7f695586c61d39b277"),
    "tibia-96.stl": (13344284, "4b74bcbfb8b344e157253471d97ab07426a72162586d7b5011ae57aeb2acc055"),
    "SPLKneeAtlasLabels.nrrd": (466136, "3f9e2b8cdf7a969a346445ec570ebb89a2e91ad2f3719e588cf20021a4895d0d"),
}


class Job:
    def __init__(self, root: pathlib.Path, preparer: pathlib.Path):
        self.id = uuid.uuid4().hex
        self.root = root / self.id
        self.root.mkdir(mode=0o700)
        self.zip_path = self.root / "source.zip"
        self.output = self.root / "prepared"
        self.preparer = preparer
        self.lock = threading.Lock()
        self.state = "uploading"
        self.progress = 0
        self.message = "Recibiendo ZIP original"
        self.error = None
        self.process: subprocess.Popen[str] | None = None
        self.cancelled = False

    def snapshot(self):
        with self.lock:
            return {"job_id": self.id, "state": self.state, "progress": self.progress,
                    "message": self.message, "error": self.error}

    def set(self, **changes):
        with self.lock:
            for key, value in changes.items():
                setattr(self, key, value)

    def run(self):
        self.set(state="processing", progress=1, message="Validando y clasificando DICOM")
        command = [sys.executable, str(self.preparer), "--entrada", str(self.zip_path),
                   "--destino", str(self.output)]
        try:
            process = subprocess.Popen(command, cwd=str(self.preparer.parent), text=True,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, bufsize=1)
            self.process = process
            prepared = 0
            assert process.stdout is not None
            for line in process.stdout:
                if self.cancelled:
                    process.terminate()
                    break
                if line.startswith("Inventario local:"):
                    self.set(progress=5, message="Catálogo detectado; decodificando series")
                elif re.match(r"^RM-\d{3}: preparada", line):
                    prepared += 1
                    self.set(progress=min(95, 5 + prepared * 3), message=f"Serie {prepared} preparada")
                elif "BLOQUEADA" in line:
                    self.set(message="Una serie incompatible fue aislada; continúa el resto")
            code = process.wait()
            self.process = None
            if self.cancelled:
                self.set(state="cancelled", progress=0, message="Importación cancelada")
            elif code == 0 and (self.output / "catalogo_local_privado.json").is_file():
                self.zip_path.unlink(missing_ok=True)
                self.set(state="ready", progress=100, message="Estudio listo para explorar")
            else:
                self.set(state="failed", error="El ZIP no pasó los controles o contiene formatos aún no soportados",
                         message="Importación incompleta")
        except (OSError, subprocess.SubprocessError):
            self.set(state="failed", error="No se pudo iniciar el decodificador local", message="Error local")

    def cancel(self):
        self.cancelled = True
        process = self.process
        if process and process.poll() is None:
            process.terminate()
        shutil.rmtree(self.root, ignore_errors=True)


class AppServer(ThreadingHTTPServer):
    daemon_threads = True
    app_root: pathlib.Path
    jobs_root: pathlib.Path
    preparer: pathlib.Path
    jobs: dict[str, Job]
    jobs_lock: threading.Lock


class Handler(BaseHTTPRequestHandler):
    server_version = "ANATHEOSW1Local/1"
    sys_version = ""

    def log_message(self, *_):
        pass

    def _host_ok(self):
        return self.headers.get("Host", "") in {
            f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"
        }

    def _send(self, status, body=b"", content_type="application/json; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data: blob:; object-src 'none'; base-uri 'none'")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, status, value):
        self._send(status, json.dumps(value, ensure_ascii=False).encode("utf-8"))

    def _route(self):
        route = urlsplit(self.path)
        if route.query or route.fragment or "%" in route.path or "\\" in route.path or "\x00" in route.path:
            return None
        return route.path

    def _job(self, job_id):
        if not JOB_RE.fullmatch(job_id):
            return None
        with self.server.jobs_lock:
            return self.server.jobs.get(job_id)

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        if not self._host_ok():
            self._send(HTTPStatus.FORBIDDEN, b"Forbidden", "text/plain"); return
        path = self._route()
        if path is None:
            self._send(HTTPStatus.NOT_FOUND); return
        if path == "/api/cmr/capabilities":
            self._json(HTTPStatus.OK, {"original_zip": True, "local_only": True, "cancel": True}); return
        if path == "/api/spl/status":
            self._json(HTTPStatus.OK, {"ready": self._atlas_ready(), "source": "SPL Knee Atlas", "clinical": False}); return
        match = re.fullmatch(r"/atlas/(femur-95\.stl|tibia-96\.stl)", path)
        if match:
            name = match.group(1)
            if not self._atlas_valid(name):
                self._send(HTTPStatus.NOT_FOUND); return
            self._file(self.server.app_root / "ATLAS_SPL" / name, "application/octet-stream"); return
        match = re.fullmatch(r"/api/cmr/jobs/([a-f0-9]{32})", path)
        if match:
            job = self._job(match.group(1))
            self._json(HTTPStatus.OK if job else HTTPStatus.NOT_FOUND, job.snapshot() if job else {"error": "job_not_found"}); return
        match = re.fullmatch(r"/api/cmr/jobs/([a-f0-9]{32})/data/(.+)", path)
        if match:
            job, relative = self._job(match.group(1)), match.group(2)
            if not job or job.snapshot()["state"] != "ready" or not DATA_RE.fullmatch(relative):
                self._send(HTTPStatus.NOT_FOUND); return
            target = (job.output / relative).resolve()
            try:
                if not target.is_relative_to(job.output.resolve()) or not target.is_file():
                    raise FileNotFoundError
                data = target.read_bytes()
            except OSError:
                self._send(HTTPStatus.NOT_FOUND); return
            kind = "application/json; charset=utf-8" if target.suffix == ".json" else "application/octet-stream"
            self._send(HTTPStatus.OK, data, kind); return
        self._serve_static(path)

    def _serve_static(self, path):
        relative = "index.html" if path == "/" else path.lstrip("/")
        if relative == "datasets/RTKN0668_MR_DESS.zip":
            self._file(self.server.app_root / relative, "application/zip"); return
        if "/" in relative or pathlib.Path(relative).suffix not in STATIC_EXT:
            self._send(HTTPStatus.NOT_FOUND); return
        target = (self.server.app_root / relative).resolve()
        kind = {".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8"}.get(target.suffix, "text/javascript; charset=utf-8")
        self._file(target, kind)

    def _file(self, target, kind):
        try:
            if not target.is_relative_to(self.server.app_root.resolve()) or not target.is_file():
                raise FileNotFoundError
            data = target.read_bytes()
        except OSError:
            self._send(HTTPStatus.NOT_FOUND); return
        self._send(HTTPStatus.OK, data, kind)

    def _atlas_valid(self, name):
        target = self.server.app_root / "ATLAS_SPL" / name
        size, expected = ATLAS[name]
        if not target.is_file() or target.stat().st_size != size:
            return False
        digest = hashlib.sha256()
        with target.open("rb") as file:
            for block in iter(lambda: file.read(CHUNK), b""):
                digest.update(block)
        return digest.hexdigest() == expected

    def _atlas_ready(self):
        return all(self._atlas_valid(name) for name in ATLAS)

    def do_POST(self):
        if self._host_ok() and self._route() == "/api/spl/prepare":
            expected = f"http://127.0.0.1:{self.server.server_port}"
            if self.headers.get("Origin") != expected or not self.headers.get("Content-Type", "").startswith("application/json") or self.headers.get("Content-Length") != "2":
                self._send(HTTPStatus.FORBIDDEN); return
            if not self._atlas_ready():
                script = self.server.app_root / "obtener_atlas_spl.ps1"
                if sys.platform != "win32" or not script.is_file():
                    self._json(HTTPStatus.SERVICE_UNAVAILABLE, {"ok": False, "message": "Atlas no disponible en este equipo"}); return
                try:
                    subprocess.run(["powershell.exe", "-NoProfile", "-File", str(script)],
                                   cwd=str(self.server.app_root), timeout=180, check=True,
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                except (OSError, subprocess.SubprocessError):
                    self._json(HTTPStatus.SERVICE_UNAVAILABLE, {"ok": False, "message": "No se pudo preparar el atlas"}); return
            self._json(HTTPStatus.OK if self._atlas_ready() else HTTPStatus.SERVICE_UNAVAILABLE,
                       {"ok": self._atlas_ready(), "ready": self._atlas_ready()}); return
        if not self._host_ok() or self._route() != "/api/cmr/jobs":
            self._send(HTTPStatus.FORBIDDEN); return
        origin = self.headers.get("Origin", "")
        expected = f"http://127.0.0.1:{self.server.server_port}"
        content_type = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        try:
            length = int(self.headers.get("Content-Length", "-1"))
        except ValueError:
            length = -1
        if origin != expected or content_type not in {"application/zip", "application/octet-stream"} or not 1 <= length <= MAX_UPLOAD:
            self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid_local_zip_request"}); return
        job = Job(self.server.jobs_root, self.server.preparer)
        remaining = length
        try:
            with job.zip_path.open("xb") as stream:
                while remaining:
                    block = self.rfile.read(min(CHUNK, remaining))
                    if not block:
                        raise OSError("incomplete upload")
                    stream.write(block); remaining -= len(block)
        except OSError:
            job.cancel(); self._json(HTTPStatus.BAD_REQUEST, {"error": "incomplete_upload"}); return
        with self.server.jobs_lock:
            self.server.jobs[job.id] = job
        threading.Thread(target=job.run, daemon=True).start()
        self._json(HTTPStatus.ACCEPTED, {"job_id": job.id, "state": "processing"})

    def do_DELETE(self):
        if not self._host_ok():
            self._send(HTTPStatus.FORBIDDEN); return
        match = re.fullmatch(r"/api/cmr/jobs/([a-f0-9]{32})", self._route() or "")
        if not match:
            self._send(HTTPStatus.NOT_FOUND); return
        with self.server.jobs_lock:
            job = self.server.jobs.pop(match.group(1), None)
        if job:
            job.cancel()
        self._json(HTTPStatus.OK, {"deleted": bool(job)})


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--open-browser", action="store_true")
    args = parser.parse_args(argv)
    if not 1024 <= args.port <= 65535:
        parser.error("Puerto inválido")
    root = pathlib.Path(__file__).resolve().parents[3]
    app = root / "demos" / "anatheos-local-v0.5"
    preparer = root / "research" / "anatheos-cmr" / "r2" / "preparar_todas_las_series.py"
    with tempfile.TemporaryDirectory(prefix="anatheos-w1-") as temp:
        server = AppServer(("127.0.0.1", args.port), Handler)
        server.app_root, server.jobs_root, server.preparer = app, pathlib.Path(temp), preparer
        server.jobs, server.jobs_lock = {}, threading.Lock()
        print(f"ANATHEOS W1 local: http://127.0.0.1:{server.server_port}/", flush=True)
        if args.open_browser:
            webbrowser.open(f"http://127.0.0.1:{server.server_port}/")
        try:
            server.serve_forever(poll_interval=.2)
        except KeyboardInterrupt:
            pass
        finally:
            with server.jobs_lock:
                jobs = list(server.jobs.values()); server.jobs.clear()
            for job in jobs:
                job.cancel()
            server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
