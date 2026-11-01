"""Minimal, syntactically valid synthetic DICOM Part 10 MR phantom tests.

Uses the EXISTING CMR-R1 parser for readback (no new production importer).
File meta, Explicit VR Little Endian, UIDs and all pixels are synthetic only.
Does not claim validation by an independent DICOM toolkit or 3D Slicer.
"""
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct
import unittest
from afe.cmr_adapter import adapt_cmr_r2,SCHEMA,INTEGRITY_SCHEMA,ContractError
from afe.geometry import GeometryError

PARSER=Path(__file__).resolve().parents[3]/'research/anatheos-cmr/r2/auditar_dicom_offline.py'
spec=importlib.util.spec_from_file_location('existing_cmr_parser',PARSER)
assert spec and spec.loader
cmr=importlib.util.module_from_spec(spec)
spec.loader.exec_module(cmr)


def element(group,tag,vr,value):
    if isinstance(value,int):
        raw=struct.pack('<I' if vr=='UL' else '<H',value)
    elif isinstance(value,bytes):
        raw=value
    else:
        raw=str(value).encode('ascii')
        if len(raw)%2:raw+=(b'\0' if vr=='UI' else b' ')
    header=struct.pack('<HH',group,tag)+vr.encode()
    if vr in ('OB','OW','SQ','UN'):
        return header+b'\0\0'+struct.pack('<I',len(raw))+raw
    return header+struct.pack('<H',len(raw))+raw


def phantom(i,step=1.25,angle=math.pi/6,temporal=1,duplicate=False):
    sop='2.25.100100'+str(i+1)
    meta_parts=[
        element(2,1,'OB',b'\0\1'),
        element(2,2,'UI','1.2.840.10008.5.1.4.1.1.4'),
        element(2,3,'UI',sop),
        element(2,16,'UI','1.2.840.10008.1.2.1'),
        element(2,18,'UI','2.25.70001')]
    meta=element(2,0,'UL',sum(map(len,meta_parts)))+b''.join(meta_parts)
    theta=angle;c=math.cos(theta);s=math.sin(theta)
    z=44.+(0 if duplicate and i==1 else i)*step
    attrs=[
        (8,8,'CS','ORIGINAL\\PRIMARY'),(8,22,'UI','1.2.840.10008.5.1.4.1.1.4'),
        (8,24,'UI',sop),(8,96,'CS','MR'),
        (24,32,'CS','SE'),(24,80,'DS','1.25'),
        (24,128,'DS','500'),(24,129,'DS','20'),
        (24,4192,'DS','0'),
        (32,13,'UI','2.25.70002'),(32,14,'UI','2.25.70003'),
        (32,50,'DS',f'11.5\\-23.25\\{z}'),
        (32,55,'DS',f'{c:.15f}\\{s:.15f}\\0\\{-s:.15f}\\{c:.15f}\\0'),
        (32,82,'UI','2.25.70004'),(32,256,'IS',str(temporal)),
        (40,16,'US',4),(40,17,'US',4),(40,48,'DS','2.5\\0.75'),
        (40,4178,'DS','0'),(40,4179,'DS','1'),
        (32736,16,'OW',struct.pack('<16H',*(i*16+n for n in range(16))))
    ]
    dataset=b''.join(element(*r) for r in attrs)
    return b'\0'*128+b'DICM'+meta+dataset


def normalized(raw):
    v=cmr.parse_dicom(raw)
    return {
        'source_sha256':hashlib.sha256(raw).hexdigest(),
        'study_instance_uid':v.get('study'),'series_instance_uid':v.get('series'),
        'frame_of_reference_uid':v.get('for_uid'),'modality':v.get('modality'),
        'image_type':v.get('image_type'),
        'image_position_patient_LPS_mm':cmr.numbers(v.get('ipp'),3),
        'image_orientation_patient_LPS':cmr.numbers(v.get('iop'),6),
        'pixel_spacing_row_col_mm':cmr.numbers(v.get('spacing'),2),
        'rescale_intercept':cmr.numeric(v.get('intercept')),
        'rescale_slope':cmr.numeric(v.get('slope')),
        'photometric_interpretation':'MONOCHROME2',
        'trigger_time_ms':cmr.numeric(v.get('trigger')),
        'temporal_position_identifier':cmr.numeric(v.get('temporal_pos')),
        'acquisition':{'scan_sequence':v.get('scan_sequence'),'tr':v.get('tr'),
                       'te':v.get('te'),'ti':v.get('ti'),
                       'slice_thickness':v.get('slice_thickness'),
                       'sequence_variant':v.get('sequence_variant')}
    }


def roundtrip(records):
    h=hashlib.sha256(b'synthetic in-memory phantom archive').hexdigest()
    geo={'schema':SCHEMA,'serie_local':'RM-001','source_zip_sha256':h,'frames':records}
    raw=json.dumps(geo,sort_keys=True).encode('utf8')
    integrity={'schema':INTEGRITY_SCHEMA,'source_zip_sha256':h,
               'geometria_sha256':hashlib.sha256(raw).hexdigest(),
               'pixels_sha256':hashlib.sha256(b'synthetic pixel array marker').hexdigest()}
    catalog={'schema':SCHEMA,'origen_zip_sha256_PRIVADO':h,
             'series':[{'serie_local':'RM-001','estado':'preparada',
                        'modo_seguro':'pila_2d_revisar_3d','instancias':len(records)}]}
    return adapt_cmr_r2(catalog,raw,integrity,'RM-001',(len(records),4,4))


class Part10PhantomTests(unittest.TestCase):
    def test_part10_parser_and_oblique_affine(self):
        rec=[normalized(phantom(i)) for i in range(4)]
        result=roundtrip(rec)
        self.assertEqual(result.geometry.dimensions_crs,(4,4,4))
        self.assertAlmostEqual(result.geometry.interplane_spacing_mm,1.25,places=10)
        p=result.geometry.voxel_to_lps(2,3,1)
        self.assertAlmostEqual(p[0],11.5+2*.75*math.cos(math.pi/6)-3*2.5*math.sin(math.pi/6),places=9)
        self.assertAlmostEqual(p[1],-23.25+2*.75*math.sin(math.pi/6)+3*2.5*math.cos(math.pi/6),places=9)
        self.assertAlmostEqual(p[2],45.25,places=9)
        for a,b in zip(result.geometry.lps_to_voxel(p),(2,3,1)):
            self.assertAlmostEqual(a,b,places=9)

    def test_part10_reversed_slice_order(self):
        rec=[normalized(phantom(i)) for i in range(4)][::-1]
        self.assertEqual(roundtrip(rec).geometry.sorted_source_indices,(3,2,1,0))

    def test_part10_duplicate_rejected(self):
        rec=[normalized(phantom(i,duplicate=True)) for i in range(4)]
        with self.assertRaisesRegex(GeometryError,'duplicate'):
            roundtrip(rec)

    def test_part10_mixed_phase_rejected(self):
        rec=[normalized(phantom(i,temporal=2 if i==2 else 1)) for i in range(4)]
        with self.assertRaisesRegex(ContractError,'MIXED_PHASES'):
            roundtrip(rec)

    def test_part10_missing_iop_rejected(self):
        rec=[normalized(phantom(i)) for i in range(4)]
        rec[1]['image_orientation_patient_LPS']=None
        with self.assertRaisesRegex(GeometryError,'ImageOrientationPatient'):
            roundtrip(rec)

    def test_bad_part10_preamble(self):
        with self.assertRaises(cmr.ParseProblem):
            cmr.parse_dicom(b'\0'*132)

    def test_part10_variable_spacing_rejected(self):
        rec=[normalized(phantom(i,step=1.25 if i<3 else 2.0)) for i in range(4)]
        with self.assertRaisesRegex(GeometryError,'irregular'):
            roundtrip(rec)


if __name__=='__main__': unittest.main()
