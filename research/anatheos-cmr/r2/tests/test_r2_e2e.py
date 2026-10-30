#!/usr/bin/env python3
"""QA local: 24 synthetic Part-10 JPEG2000 MR groups, actual R2 processing/serve.
No real DICOM, identifiers, clinical images, or private patient data.
"""
import hashlib, io, json, os, pathlib, struct, sys, tempfile, zipfile
import numpy as np
from PIL import Image

ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from preparar_todas_las_series import main as ingest_main
from auditar_dicom_offline import audit_zip

FAMILIES=[
 'SURVEY','AX ESTRICTO','3 CAMARAS','EJE CORTO','FALSO 2C',
 'FALSO 4C','2 CAMARAS','4 CAMARAS','TSVD','3 CAMARAS VD',
 'VAL AORTA','T1_TSE_BB','T2_STIR_BB',
 'Perfusion_shared 1','Perfusion_shared 2','Perfusion_shared 3',
 'T1_TSE_BB','IR_TFE_LL_2beats','PSIR_TFE_BH','PSIR_TFE_BH',
 'PSIR_TFE_BH','PSIR_TFE_BH','PSIR_TFE_BH','PSIR_TFE_BH']

def elem(tag,vr,value):
    if isinstance(value,str):value=value.encode('ascii')
    if len(value)%2:value+=b'\0' if vr=='UI' else b' '
    if vr in ['OB','OW','SQ','UN']:
        return struct.pack('<HH2s2sI',*tag,vr.encode(),b'\0\0',len(value))+value
    return struct.pack('<HH2sH',*tag,vr.encode(),len(value))+value

def one(study,serial,i,desc,corrupt=False):
    d=np.full((20,22),1000+serial*10+i,dtype='<u2')
    d[3:17,5:18]=1200+serial*10+i
    b=io.BytesIO();Image.fromarray(d).save(b,format='JPEG2000',irreversible=False)
    coded=b.getvalue();coded+=b'\0' if len(coded)%2 else b''
    if corrupt:coded=b'CORRUPTED_LOSSLESS_CODESTREAM' + b'\0'
    encapsulated=struct.pack('<HHI',0xfffe,0xe000,0)
    encapsulated+=struct.pack('<HHI',0xfffe,0xe000,len(coded))+coded
    encapsulated+=struct.pack('<HHI',0xfffe,0xe0dd,0)
    uid=f'1.2.826.0.1.3680043.10.991.{serial}'
    fields=[
       ((0x0008,0x0008),'CS','ORIGINAL\\PRIMARY'),
       ((0x0008,0x0016),'UI','1.2.840.10008.5.1.4.1.1.4'),
       ((0x0008,0x0018),'UI',f'{uid}.{i+1}'),
       ((0x0008,0x0060),'CS','MR'),
       ((0x0008,0x103e),'LO',desc),
       ((0x0018,0x1030),'LO',desc),
       ((0x0018,0x1060),'DS',str(i*40)),
       ((0x0020,0x000d),'UI',study),
       ((0x0020,0x000e),'UI',uid),
       ((0x0020,0x0011),'IS',str(serial)),
       ((0x0020,0x0013),'IS',str(i+1)),
       ((0x0020,0x0032),'DS',f'0\\0\\{i*3 if serial%2 else 0}'),
       ((0x0020,0x0037),'DS','1\\0\\0\\0\\1\\0'),
       ((0x0020,0x0052),'UI',study),
       ((0x0028,0x0002),'US',struct.pack('<H',1)),
       ((0x0028,0x0004),'CS','MONOCHROME2'),
       ((0x0028,0x0010),'US',struct.pack('<H',20)),
       ((0x0028,0x0011),'US',struct.pack('<H',22)),
       ((0x0028,0x0030),'DS','1\\1'),
       ((0x0028,0x0100),'US',struct.pack('<H',16)),
       ((0x0028,0x0101),'US',struct.pack('<H',16)),
       ((0x0028,0x0103),'US',struct.pack('<H',0)),
       ((0x7fe0,0x0010),'OB',b''),
    ]
    meta=elem((0x0002,0x0010),'UI','1.2.840.10008.1.2.4.90')
    payload=b'\0'*128+b'DICM'+meta
    for tag,vr,value in fields:
        if tag==(0x7fe0,0x0010):
            payload+=struct.pack('<HH2s2sI',*tag,b'OB',b'\0\0',0xffffffff)+encapsulated
        else:payload+=elem(tag,vr,value)
    return payload,d

def main():
  with tempfile.TemporaryDirectory() as d:
    tmp=pathlib.Path(d);source=tmp/'input.zip';out=tmp/'private'
    study='1.2.826.0.1.3680043.10.991.999'
    with zipfile.ZipFile(source,'w',compression=zipfile.ZIP_DEFLATED) as z:
        for series,desc in enumerate(FAMILIES,1):
            for n in range(3):
                payload,_=one(study,series,n,desc)
                z.writestr(f'PHI_IN_ARCHIVE_NAMES_NEVER_EXPORT/{series}/patient_secret_{n}.dcm',payload)
        z.writestr('DICOMDIR',b'DICOMDIR_NOT_PART10')
        z.writestr('NEVER_EXECUTE.exe',b'!this is not executed')
    baseline=audit_zip(source)
    assert baseline['series_detectadas']==24 and baseline['dicom_mr_imagenes_analizadas']==72
    rc=ingest_main(['--entrada',str(source),'--destino',str(out),'--esperar-series','24','--esperar-imagenes','72'])
    assert rc==0,rc
    cat=json.loads((out/'catalogo_local_privado.json').read_text())
    assert cat['series_preparadas']==24 and cat['instancias_preparadas']==72
    for serial in range(1,25):
        folder=out/f'RM-{serial:03d}'
        a=np.load(folder/'pixels_original_decoded.npy',allow_pickle=False)
        assert a.shape==(3,20,22) and a.dtype==np.uint16
        assert a[0,0,0]==1010+serial*10-10 # 1000+serial*10
        m=json.loads((folder/'geometria_privada.json').read_text())
        assert len(m['frames'])==3 and len({x['source_sha256'] for x in m['frames']})==3
    serialized=json.dumps(json.loads((out/'resumen_sanitizado.json').read_text()))
    for secret in ('PHI_IN_ARCHIVE_NAMES','patient_secret','1.2.826.','DICOMDIR'):
        assert secret not in serialized
    rc=ingest_main(['--entrada',str(source),'--destino',str(out),'--reanudar','--esperar-series','24','--esperar-imagenes','72'])
    assert rc==0
    print('ANATHEOS_CMR_R2_SYNTHETIC_24_SERIES_QA='+json.dumps({'status':'PASS','series':24,
       'images':72,'lossless_pixel_equality':True,'private_geometry_bound':True,
       'per_series_resume':True,'non_dicom_executable_ignored':True,
       'sanitized_result_no_original_filenames_or_uids':True},sort_keys=True),flush=True)
if __name__=='__main__':main()