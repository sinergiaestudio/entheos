#!/usr/bin/env python3
"""Create a fully SYNTHETIC, non-patient 6-slice Part-10 DICOM ZIP in /tmp.
Not a medical-image dataset; never publish a screenshot as anatomy.
"""
from pathlib import Path
from zipfile import ZipFile, ZIP_STORED
import math,struct,sys
target=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/anatheos-uxn2-test.zip')
def tag(g,e,vr,v):
    if isinstance(v,str):v=v.encode('ascii')
    if len(v)%2:v+=b'\x00' if vr=='UI' else b' '
    head=struct.pack('<HH',g,e)+vr.encode()
    if vr in ('OB','OD','OF','OL','OV','OW','SQ','UC','UR','UT','UN'):
        return head+b'\x00\x00'+struct.pack('<I',len(v))+v
    return head+struct.pack('<H',len(v))+v
def dicom(z):
    meta=tag(0x0002,0x0010,'UI','1.2.840.10008.1.2.1')
    out=bytearray(b'\x00'*128+b'DICM'+meta)
    def a(g,e,vr,v):out.extend(tag(g,e,vr,v))
    a(0x0008,0x0060,'CS','MR')
    a(0x0008,0x103e,'LO','SYNTHETIC_TEST_NOT_PATIENT')
    a(0x0020,0x000e,'UI','1.2.826.0.1.3680043.10.987.123')
    a(0x0020,0x0013,'IS',str(z+1))
    a(0x0020,0x0032,'DS',f'0\\0\\{z}')
    a(0x0020,0x0037,'DS','1\\0\\0\\0\\1\\0')
    a(0x0028,0x0002,'US',struct.pack('<H',1))
    a(0x0028,0x0004,'CS','MONOCHROME2')
    a(0x0028,0x0010,'US',struct.pack('<H',32))
    a(0x0028,0x0011,'US',struct.pack('<H',32))
    a(0x0028,0x0030,'DS','1\\1')
    a(0x0028,0x0100,'US',struct.pack('<H',16))
    a(0x0028,0x0101,'US',struct.pack('<H',16))
    a(0x0028,0x0102,'US',struct.pack('<H',15))
    a(0x0028,0x0103,'US',struct.pack('<H',0))
    a(0x0028,0x1050,'DS','800')
    a(0x0028,0x1051,'DS','1200')
    a(0x0028,0x1052,'DS','0')
    a(0x0028,0x1053,'DS','1')
    vals=[]
    for y in range(32):
        for x in range(32):
            # Deliberately geometric, non-anatomic volume for UI testing.
            d=math.sqrt((x-16)**2+(y-16)**2+((z-2.5)*3)**2)
            vals.append(1600 if d<8 else (850 if d<11 else 200+(x*3+y*5)%90))
    a(0x7fe0,0x0010,'OW',struct.pack('<1024H',*vals))
    return bytes(out)
target.parent.mkdir(parents=True,exist_ok=True)
with ZipFile(target,'w',ZIP_STORED) as out:
    for z in range(6):out.writestr(f'SYNTHETIC_SLICE_{z:03d}.dcm',dicom(z))
print('SYNTHETIC ZIP',target,target.stat().st_size)
