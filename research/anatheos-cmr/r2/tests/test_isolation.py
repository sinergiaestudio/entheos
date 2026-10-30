#!/usr/bin/env python3
"""Synthetic failed series must not prevent processing the other DICOM series."""
from pathlib import Path
import json,sys,tempfile,zipfile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from preparar_todas_las_series import main as ingest
from test_r2_e2e import one
with tempfile.TemporaryDirectory() as d:
  base=Path(d);src=base/'study.zip';out=base/'private'
  with zipfile.ZipFile(src,'w') as z:
    for n in range(1,25):
      z.writestr(f'series/{n}.dcm',one('1.2.826.0.1.3680043.10.991.999',n,0,
           'EJE CORTO' if n<20 else 'PSIR_TFE_BH',corrupt=(n==13))[0])
  rc=ingest(['--entrada',str(src),'--destino',str(out),'--esperar-series','24','--esperar-imagenes','24'])
  cat=json.loads((out/'catalogo_local_privado.json').read_text())
  assert rc==1 and cat['series_detectadas']==24 and cat['series_preparadas']==23
  assert (out/'RM-013').exists() is False and (out/'RM-014').exists()
  assert not (out/'.RM-013.processing').exists()
  assert not (out/'RM-013'/'pixels_original_decoded.npy').exists()
  print('ANATHEOS_CMR_R2_ISOLATION_QA=PASS: 23/24 completed, failure isolated')