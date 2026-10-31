"""Real Windows installation lifecycle; never uses clinical data."""
import os
import pathlib
import subprocess
import time
import http.client
import importlib.util
import json
import sys
import tempfile
import zipfile

root = pathlib.Path(os.environ['LOCALAPPDATA']) / 'Programs/ANATHEOS'
data = pathlib.Path(os.environ['LOCALAPPDATA']) / 'ANATHEOS/projects'
data.mkdir(parents=True, exist_ok=True)
sentinel = data / 'synthetic-preservation.txt'
sentinel.write_text('keep')
setup = pathlib.Path('dist/ANATHEOS-Setup-0.9.0-beta.exe').resolve()
for _ in range(2):
    subprocess.run([str(setup), '/S'], check=True)
    exe = root / 'versions/0.9.0-beta/ANATHEOS.exe'
    subprocess.run([str(exe), '--self-test'], check=True)
    assert sentinel.read_text() == 'keep'
spec = importlib.util.spec_from_file_location('fixture', 'research/anatheos-cmr/r2/tests/test_r2_e2e.py')
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)
with tempfile.TemporaryDirectory() as temp:
    archive = pathlib.Path(temp) / 'synthetic.zip'
    with zipfile.ZipFile(archive, 'w') as z:
        for i in range(3):
            raw, _ = fixture.one('1.2.826.0.1.3680043.10.991.999', 1, i, 'SURVEY')
            z.writestr(f'{i}.dcm', raw)
    proc = subprocess.Popen([str(exe), '--port', '18965'])
    try:
        for i in range(80):
            try:
                c = http.client.HTTPConnection('127.0.0.1', 18965)
                c.request('GET', '/api/cmr/capabilities')
                assert c.getresponse().status == 200
                break
            except OSError:
                time.sleep(.25)
        c = http.client.HTTPConnection('127.0.0.1', 18965)
        c.request('POST', '/api/cmr/jobs', archive.read_bytes(),
                  {'Origin': 'http://127.0.0.1:18965', 'Content-Type': 'application/zip'})
        response = c.getresponse()
        assert response.status == 202
        job = json.loads(response.read())['job_id']
        for i in range(120):
            c = http.client.HTTPConnection('127.0.0.1', 18965)
            c.request('GET', '/api/cmr/jobs/' + job)
            state = json.loads(c.getresponse().read())
            if state['state'] in ('ready', 'failed'):
                break
            time.sleep(.25)
        assert state['state'] == 'ready', state
        c = http.client.HTTPConnection('127.0.0.1', 18965)
        c.request('GET', f'/api/cmr/jobs/{job}/data/catalogo_local_privado.json')
        assert json.loads(c.getresponse().read())['instancias_preparadas'] == 3
        c = http.client.HTTPConnection('127.0.0.1', 18965)
        c.request('DELETE', '/api/cmr/jobs/' + job)
        assert c.getresponse().status == 200
    finally:
        proc.terminate()
        proc.wait(timeout=15)
print('FROZEN_ORIGINAL_JPEG2000_ZIP_IMPORT_PASS')
subprocess.run([str(root / 'Uninstall.exe'), '/S'], check=True)
time.sleep(3)
assert sentinel.read_text() == 'keep'
subprocess.run([str(setup), '/S'], check=True)
assert (root / 'versions/0.9.0-beta/ANATHEOS.exe').is_file()
print('WINDOWS_INSTALL_REINSTALL_DATA_PRESERVATION_PASS')
