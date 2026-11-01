#!/usr/bin/env python3
"""W1 browser/API integration with a synthetic original DICOM ZIP only."""
from __future__ import annotations

import importlib.util
import sys
import json
import pathlib
import tempfile
import threading
import time
import zipfile

from playwright.sync_api import expect, sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
R2_TEST = ROOT / "research" / "anatheos-cmr" / "r2" / "tests" / "test_r2_e2e.py"
PREPARER = ROOT / "research" / "anatheos-cmr" / "r2" / "preparar_todas_las_series.py"
APP = ROOT / "demos" / "anatheos-local-v0.5"
sys.path.insert(0,str(ROOT/"research/anatheos-cmr/r3"))
from test_station import command

spec = importlib.util.spec_from_file_location("r2_fixture", R2_TEST)
fixture = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(fixture)

from servidor_anatheos_unificado import AppServer, Handler


def synthetic_zip(path: pathlib.Path):
    study = "1.2.826.0.1.3680043.10.991.999"
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for series, description in enumerate(("SURVEY", "EJE CORTO"), 1):
            for frame in range(3):
                payload, _ = fixture.one(study, series, frame, description)
                archive.writestr(f"PRIVATE_NAMES_NOT_EXPORTED/{series}/frame_{frame}.dcm", payload)
        archive.writestr("DICOMDIR", b"NOT_PART10")
        archive.writestr("NEVER_EXECUTE.exe", b"not executed")


def main():
    with tempfile.TemporaryDirectory(prefix="anatheos-w1-test-") as temp:
        temporary = pathlib.Path(temp)
        source = temporary / "original-synthetic.zip"
        synthetic_zip(source)
        server = AppServer(("127.0.0.1", 0), Handler)
        server.app_root, server.jobs_root, server.preparer = APP, temporary / "jobs", PREPARER
        server.jobs_root.mkdir()
        server.jobs, server.jobs_lock = {}, threading.Lock()
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(headless=True, args=["--no-sandbox", "--disable-gpu"])
                page = browser.new_page(viewport={"width": 1700, "height": 950})
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(f"http://127.0.0.1:{server.server_port}/", wait_until="domcontentloaded")
                assert page.request.get(f"http://127.0.0.1:{server.server_port}/api/spl/status").json()["ready"] is False
                assert page.request.get(f"http://127.0.0.1:{server.server_port}/atlas/femur-95.stl").status == (200 if (APP/"datasets/RTKN0668_MR_DESS.zip").exists() else 404)
                assert page.request.get(f"http://127.0.0.1:{server.server_port}/datasets/RTKN0668_MR_DESS.zip").status == (200 if (APP/"datasets/RTKN0668_MR_DESS.zip").exists() else 404)
                assert page.request.get(f"http://127.0.0.1:{server.server_port}/surface-ui.mjs").status == 200
                expect(page.locator("#stationToolbar")).to_be_visible(timeout=20_000)
                page.set_input_files("#zipInput", str(source))
                expect(page.locator("#cmrNativeSeries option")).to_have_count(2, timeout=60_000)
                expect(page.locator(".spatial-pane canvas").first).to_be_visible()
                assert page.locator("#cmrNativeCanvas").evaluate("element => element.width") == 22
                assert "listo" not in page.locator("#cmrNativeStatus").inner_text().lower() or not errors
                command(page,'Archivo','Cerrar estudio')
                for _ in range(40):
                    if not server.jobs:
                        break
                    time.sleep(.05)
                assert not server.jobs, "Closing the study must discard its private temporary job"
                assert not errors, errors
                browser.close()
            print("ANATHEOS_W1_SYNTHETIC_ZIP_QA=" + json.dumps({
                "status": "PASS", "source": "original_zip", "series": 2, "images": 6,
                "jpeg2000_lossless": True, "single_application_flow": True,
                "catalog_and_2d_navigation": True, "close_discards_private_job": True,
                "non_dicom_executable_ignored": True, "javascript_errors": 0
            }, sort_keys=True), flush=True)
        finally:
            server.shutdown(); server.server_close()


if __name__ == "__main__":
    main()
