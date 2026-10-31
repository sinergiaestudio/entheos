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
import io,pydicom,winreg

root = pathlib.Path(os.environ['LOCALAPPDATA']) / 'Programs/ANATHEOS'
data = pathlib.Path(os.environ['LOCALAPPDATA']) / 'ANATHEOS/projects'
data.mkdir(parents=True, exist_ok=True)
sentinel = data / 'synthetic-preservation.txt'
sentinel.write_text('keep')
baseline=pathlib.Path('baseline/ANATHEOS-Setup-0.9.0-beta.exe').resolve()
subprocess.run([str(baseline),'/S'],check=True)
setup = pathlib.Path('dist/ANATHEOS-Setup-0.10.0-beta.exe').resolve()
for _ in range(2):
    subprocess.run([str(setup), '/S'], check=True)
    exe = root / 'versions/0.10.0-beta/ANATHEOS.exe'
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
            ds=pydicom.dcmread(io.BytesIO(raw));ds.TriggerTime=0;ds.ScanningSequence='SE';ds.RepetitionTime=500;ds.EchoTime=20;ds.SliceThickness=3;ds.SeriesDescription='T1';ds.ProtocolName='T1';buf=io.BytesIO();ds.save_as(buf,enforce_file_format=True);raw=buf.getvalue()
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
        c = http.client.HTTPConnection('127.0.0.1', 18965)
        c.request('POST', '/api/cmr/jobs', archive.read_bytes(),
                  {'Origin': 'http://127.0.0.1:18965', 'Content-Type': 'application/zip'})
        cancel_job = json.loads(c.getresponse().read())['job_id']
        c = http.client.HTTPConnection('127.0.0.1', 18965)
        c.request('DELETE', '/api/cmr/jobs/' + cancel_job)
        assert c.getresponse().status == 200
        from playwright.sync_api import sync_playwright, expect
        with sync_playwright() as pw:
            browser = pw.chromium.launch(args=['--enable-webgl','--use-gl=angle','--use-angle=swiftshader'])
            page = browser.new_page()
            page.goto('http://127.0.0.1:18965/')
            page.set_input_files('#cmrNativeZip', str(archive))
            expect(page.locator('#cmrNativeSeries option')).to_have_count(1, timeout=60000)
            expect(page.locator('#cmrNativeCanvas')).to_be_visible()
            page.locator('#cmrNativeClose').click()
            expect(page.locator('#cmrNativePanel')).to_be_hidden()
            expect(page.locator('#cmrReconstructionAnalysis button')).to_have_count(0)
            expect(page.locator('#cmrNativeSeries option')).to_have_count(0)
            page.set_input_files('#cmrNativeZip',str(archive))
            expect(page.locator('#cmrNativeSeries option')).to_have_count(1,timeout=60000)
            page.locator('#cmrReconstructionAnalysis summary').click()
            expect(page.locator('#cmrReconstructionAnalysis button')).to_have_count(1)
            page.locator('#cmrReconstructionAnalysis button').click()
            expect(page.locator('#volumeStatus')).to_contain_text('Volumen',timeout=30000)
            page.locator('#eligibleMpr summary').click()
            expect(page.locator('#eligibleMpr canvas')).to_be_visible()
            browser.close()
    finally:
        proc.terminate()
        proc.wait(timeout=15)
print('FROZEN_ORIGINAL_JPEG2000_ZIP_IMPORT_PASS')
assert sentinel.read_text() == 'keep'
assert (root / 'versions/0.9.0-beta/ANATHEOS.exe').is_file()
subprocess.run([str(root / 'versions/0.10.0-beta/ANATHEOS.exe'), '--self-test'], check=True)
subprocess.run([str(root / 'versions/0.9.0-beta/ANATHEOS.exe'), '--self-test'], check=True)
with winreg.OpenKey(winreg.HKEY_CURRENT_USER,r'Software\ANATHEOS') as key:
    assert winreg.QueryValueEx(key,'CurrentVersion')[0]=='0.10.0-beta'
    assert winreg.QueryValueEx(key,'PreviousVersion')[0]=='0.9.0-beta'
# A deliberately corrupt test update must not activate; it is never distributed.
manifest=pathlib.Path('dist/ANATHEOS/version.json')
original=manifest.read_bytes()
try:
    manifest.write_text('{"version":"INVALID_INTERNAL_TEST"}')
    subprocess.run([r'C:/Program Files (x86)/NSIS/makensis.exe','/DVERSION=0.10.0-rejected-test','packaging/windows/installer.nsi'],check=True,stdout=subprocess.DEVNULL)
finally:
    manifest.write_bytes(original)
rejected=pathlib.Path('dist/ANATHEOS-Setup-0.10.0-rejected-test.exe').resolve()
assert subprocess.run([str(rejected),'/S']).returncode != 0
with winreg.OpenKey(winreg.HKEY_CURRENT_USER,r'Software\ANATHEOS') as key:
    assert winreg.QueryValueEx(key,'CurrentVersion')[0]=='0.10.0-beta'
    assert winreg.QueryValueEx(key,'PreviousVersion')[0]=='0.9.0-beta'
subprocess.run([str(exe),'--self-test'],check=True)
assert sentinel.read_text()=='keep'
rejected.unlink()
print('FAILED_UPDATE_REJECTED_CURRENT_AND_PREVIOUS_PRESERVED_PASS')
# Restart both the active app and its retained predecessor as actual localhost servers.
for version,port in [('0.10.0-beta',18966),('0.9.0-beta',18967)]:
    running=subprocess.Popen([str(root/f'versions/{version}/ANATHEOS.exe'),'--port',str(port)])
    try:
        ready=False
        for _ in range(100):
            try:
                conn=http.client.HTTPConnection('127.0.0.1',port,timeout=2)
                conn.request('GET','/api/cmr/capabilities')
                ready=conn.getresponse().status==200
                if ready:break
            except OSError:time.sleep(.2)
        assert ready,'Restart/previous version server failed'
    finally:
        running.terminate();running.wait(timeout=15)
print('RESTART_AND_PREVIOUS_LOCALHOST_VERSION_PASS')
print('UPGRADE_AND_PREVIOUS_VERSION_RECOVERY_PASS')
subprocess.run([str(root / 'Uninstall.exe'), '/S'], check=True)
time.sleep(3)
assert sentinel.read_text() == 'keep'
subprocess.run([str(setup), '/S'], check=True)
assert (root / 'versions/0.10.0-beta/ANATHEOS.exe').is_file()
print('WINDOWS_INSTALL_REINSTALL_DATA_PRESERVATION_PASS')
