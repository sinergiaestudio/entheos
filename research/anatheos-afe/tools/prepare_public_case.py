"""AFE-01C public ORIGINAL DICOM ZIP metadata preflight. NOT a DICOM importer.

Reuses existing CMR-R1 Part10 metadata-only parser: no pixel decoder, no new
reader, no integration. Original bytes unchanged. Never commit source or output.
Rejects unvalidated acquisition, phase and source integrity by design.
"""
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
import zipfile
from afe.geometry import SliceGeometry,build_regular_grid,GeometryError

REPO=Path(__file__).resolve().parents[3]
PARSER=REPO/'research/anatheos-cmr/r2/auditar_dicom_offline.py'
spec=importlib.util.spec_from_file_location('existing_cmr_parser',PARSER)
assert spec and spec.loader
cmr=importlib.util.module_from_spec(spec)
spec.loader.exec_module(cmr)
SOURCES={
 'Leeds-RTKN0668-DESS':('CC-BY-4.0','MR'),
 'LCTSC-CT':('CC-BY-3.0','CT'),
 'SYNTHETIC-MR-TEST':('SYNTHETIC-NO-LICENSE','MR')
}
MAX_FILES=4096;MAX_UNPACKED=4*1024**3;MAX_MEMBER=32*1024**2

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--zip',required=True,type=Path)
    p.add_argument('--expected-sha256',required=True)
    p.add_argument('--case-id',required=True,choices=tuple(SOURCES))
    p.add_argument('--license',required=True)
    p.add_argument('--output',required=True,type=Path)
    opt=p.parse_args()
    assertopt=SOURCES[opt.case_id]
    if opt.license!=assertopt[0]:raise ValueError('LICENSE_ASSERTION_MISMATCH')
    if not re.fullmatch('[0-9a-fA-F]{64}',opt.expected_sha256):
        raise ValueError('EXPECTED_SHA_MISSING')
    source_digest=hashlib.sha256()
    with opt.zip.open('rb') as f:
        for chunk in iter(lambda:f.read(1048576),b''):source_digest.update(chunk)
    if source_digest.hexdigest().lower()!=opt.expected_sha256.lower():
        raise ValueError('SOURCE_ZIP_HASH_MISMATCH')
    frames=[];members=[];hashes=[];identities=[];sops=set();acquisitions=[];times=[]
    with zipfile.ZipFile(opt.zip) as z:
        infos=[x for x in z.infolist() if not x.is_dir()]
        if len(infos)>MAX_FILES or sum(x.file_size for x in infos)>MAX_UNPACKED:
            raise ValueError('UNSAFE_ZIP_LIMIT')
        for inf in infos:
            path=Path(inf.filename)
            if (inf.flag_bits&1 or inf.file_size>MAX_MEMBER or '..' in path.parts
                or path.is_absolute() or '\\' in inf.filename):
                raise ValueError('UNSAFE_ZIP_MEMBER')
            raw=z.read(inf)
            if len(raw)<132 or raw[128:132]!=b'DICM':continue
            f=cmr.parse_dicom(raw)
            if f.get('modality') not in ('MR','CT'):continue
            if f.get('modality')!=assertopt[1]:raise ValueError('MIXED_MODALITY')
            ids=(f.get('study'),f.get('series'),f.get('for_uid'))
            if any(not x for x in ids):raise ValueError('MISSING_DICOM_IDENTITIES')
            sop=f.get('sop')
            if not sop or sop in sops:raise ValueError('DUPLICATE_SOP')
            sops.add(sop);identities.append(ids)
            acq=(f.get('image_type'),f.get('scan_sequence'),
                 f.get('sequence_variant'),f.get('tr'),f.get('te'),f.get('ti'),
                 f.get('kvp'),f.get('convolution_kernel'),
                 f.get('slope'),f.get('intercept'),f.get('photo'))
            temporal=(f.get('trigger'),f.get('temporal_pos'))
            acquisitions.append(acq);times.append(temporal)
            ipp=cmr.numbers(f.get('ipp'),3);iop=cmr.numbers(f.get('iop'),6)
            spacing=cmr.numbers(f.get('spacing'),2)
            thick=cmr.numeric(f.get('slice_thickness'))
            if ipp is None or iop is None or spacing is None or not thick or thick<=0:
                raise ValueError('INCOMPLETE_PHYSICAL_GEOMETRY')
            frames.append(SliceGeometry(tuple(ipp),tuple(iop),tuple(spacing),
                 int(f.get('rows') or 0),int(f.get('cols') or 0),thick,
                 f['modality'],hashlib.sha256(repr(acq).encode()).hexdigest(),
                 hashlib.sha256(repr(temporal).encode()).hexdigest(),
                 'derived' if 'DERIVED' in str(f.get('image_type')).upper() else 'original'))
            members.append(inf.filename);hashes.append(hashlib.sha256(raw).hexdigest())
    if len(frames)<3:raise ValueError('TOO_FEW_IMAGES')
    if len(set(identities))!=1:raise ValueError('MIXED_STUDY_SERIES_FRAME_REFERENCE')
    if len(set(acquisitions))!=1:raise ValueError('MIXED_ACQUISITION')
    if len(set(times))!=1:raise ValueError('MIXED_TEMPORAL_PHASE')
    # Temporal absence is NOT proof of same phase, even for public CT.
    time_valid=any(x is not None and str(x).strip() for x in times[0])
    try:
        geo=build_regular_grid(frames)
    except GeometryError as ex:
        print(json.dumps({'case':opt.case_id,'source_hash_verified':True,
                          'frames':len(frames),'status':'REJECTED_GEOMETRY',
                          'reason_code':'GEOMETRY_CORE_REJECTED'}))
        return 2
    # Missing temporal tags prevent phase-coherent volume claims, but not the
    # separate physical-location matrix comparison against Slicer native DICOM.
    geometry_status='ACCEPTED_SPATIAL_ONLY' if not time_valid else 'ACCEPTED'
    aff=geo.affine_lps
    axis_norms=[sum(aff[i][j]**2 for i in range(3))**.5 for j in range(3)]
    result={'schema':'afe-public-geometry-v1',
            'case_id':opt.case_id,'license':opt.license,
            'original_zip_sha256':source_digest.hexdigest(),
            'geometry_status':geometry_status,
            'temporal_context_verified':time_valid,
            'geometrically_regular':True,
            'frames':len(frames),'dimensions_crs':geo.dimensions_crs,
            'physical_axis_norms_mm':axis_norms,'affine_lps':aff,
            'interplane_spacing_mm':geo.interplane_spacing_mm,
            'acquisition_thickness_mm':geo.acquisition_thickness_mm,
            'gap_mm':geo.gap_mm,'volume_eligible':geo.volume_eligible and time_valid,
            'interpolation_required':geo.interpolation_required,
            'dicom_members':members,'sha256_by_member':hashes}
    # This private output contains only relative filenames, physical values
    # and hashes. It must still NOT be committed with real study content.
    opt.output.write_text(json.dumps(result,sort_keys=True,indent=2),encoding='utf8')
    print(json.dumps({'case':opt.case_id,'source_hash_verified':True,
                      'frames':len(frames),'status':geometry_status,
                      'dims':geo.dimensions_crs,'volume_eligible':geo.volume_eligible and time_valid}))
    return 0

if __name__=='__main__':sys.exit(main())
