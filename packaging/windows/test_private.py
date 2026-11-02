"""Launch the real frozen Windows executable; imports use synthetic DICOM only."""
import http.client,json,os,pathlib,subprocess,sys,tempfile,time
exe=pathlib.Path('dist/ANATHEOS/ANATHEOS.exe').resolve()
with tempfile.TemporaryDirectory() as t:
 env=os.environ.copy();env['LOCALAPPDATA']=t
 proc=subprocess.Popen([str(exe),'--port','18964'],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 try:
  ready=False
  for _ in range(120):
   if proc.poll() is not None:raise AssertionError(proc.communicate())
   try:
    c=http.client.HTTPConnection('127.0.0.1',18964,timeout=1);c.request('GET','/api/cmr/capabilities');r=c.getresponse();caps=json.loads(r.read());c.close()
    if r.status==200 and caps['original_zip'] and caps['local_only']:ready=True;break
   except (OSError,json.JSONDecodeError):pass
   time.sleep(.25)
  assert ready,'Frozen loopback service did not start'
  env['ANATHEOS_QA_URL']='http://127.0.0.1:18964/'
  subprocess.run([sys.executable,'research/anatheos-cmr/r3/test_new_studies.py'],env=env,check=True,timeout=240)
  assert not (pathlib.Path(t)/'ANATHEOS').exists(),'Trial wrote to installed application data root'
  assert (pathlib.Path(t)/'ANATHEOS-Experimental/study-import-closure/ANATHEOS').is_dir()
  print('FROZEN_WINDOWS_NEW_IMPORT_MPR_VOLUME_TEMPORAL_REJECTION_DATA_ISOLATION_PASS',flush=True)
 finally:
  subprocess.run(['taskkill','/PID',str(proc.pid),'/T','/F'],capture_output=True);proc.communicate(timeout=10)
