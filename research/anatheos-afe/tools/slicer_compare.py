"""AFE-01C: external 3D Slicer DICOM/MRML comparison, NOT run in CI.

Requires actual Slicer, original DICOM files and a case JSON from
prepare_public_case.py. Reference matrix is read from Slicer's own DICOM import,
NEVER built from or substituted with the candidate AFE affine.

Env: AFE_SLICER_INPUT_DIR, AFE_SLICER_AFE_JSON, AFE_SLICER_REPORT.
Launch: Slicer --no-splash --python-script tools/slicer_compare.py
Do not upload patient pixels, UIDs, private paths or images to GitHub.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import statistics

# Predeclared software-engineering criteria, NOT clinical precision.
MAX_WORLD_MM=0.01
MAX_INVERSE_VOX=1e-4
MAX_SPACING_MM=0.001
MAX_ORIENTATION_NORM_DELTA=1e-5

def point(m,q):
    return [m.MultiplyPoint([*q,1.])[i] for i in range(3)]

def afepoint(a,q):
    return [sum(a[i][k]*q[k] for k in range(3))+a[i][3] for i in range(3)]

def main():
    import slicer
    import vtk
    from DICOMLib import DICOMUtils
    input_dir=os.environ['AFE_SLICER_INPUT_DIR']
    case=json.loads(Path(os.environ['AFE_SLICER_AFE_JSON']).read_text(encoding='utf8'))
    output=Path(os.environ['AFE_SLICER_REPORT'])
    if case.get('schema')!='afe-public-geometry-v1' or case.get('geometry_status')!='ACCEPTED':
        raise ValueError('CASE_NOT_PROVEN_ELIGIBLE')
    members=case['dicom_members']; digests=case['sha256_by_member']
    if len(members)<3 or len(members)!=case['frames'] or len(digests)!=len(members):
        raise ValueError('SOURCE_COUNT_MISMATCH')
    for rel,digest in zip(members,digests):
        candidate=(Path(input_dir)/rel).resolve()
        if not candidate.is_relative_to(Path(input_dir).resolve()) or not candidate.is_file():
            raise ValueError('UNSAFE_OR_MISSING_SOURCE')
        if hashlib.sha256(candidate.read_bytes()).hexdigest()!=digest:
            raise ValueError('DICOM_SHA_MISMATCH')
    with DICOMUtils.TemporaryDICOMDatabase() as db:
        if not DICOMUtils.importDicom(input_dir,db):
            raise ValueError('SLICER_DICOM_IMPORT_FAILED')
        patients=db.patients()
        if len(patients)!=1:raise ValueError('SLICER_MULTIPATIENT_AMBIGUITY')
        loaded=DICOMUtils.loadPatientByUID(patients[0])
        volumes=[]
        for node_id in loaded:
            node=slicer.mrmlScene.GetNodeByID(node_id)
            if node is not None and node.IsA('vtkMRMLScalarVolumeNode'):
                volumes.append(node)
        if len(volumes)!=1:raise ValueError('SLICER_VOLUME_AMBIGUITY')
        v=volumes[0]
        m=vtk.vtkMatrix4x4(); inv=vtk.vtkMatrix4x4()
        v.GetIJKToRASMatrix(m);v.GetRASToIJKMatrix(inv)
        dimensions=v.GetImageData().GetDimensions()
        if list(dimensions)!=list(case['dimensions_crs']):
            raise ValueError('SLICER_DIMENSIONS_MISMATCH')
        nx,ny,nz=dimensions
        samples=[(i,j,k) for i in (0,(nx-1)/2,nx-1)
                for j in (0,(ny-1)/2,ny-1)
                for k in (0,(nz-1)/2,nz-1)]
        error_mm=[];error_vox=[]
        for q in samples:
            slicer_ras=point(m,q)
            slicer_lps=[-slicer_ras[0],-slicer_ras[1],slicer_ras[2]]
            a_lps=afepoint(case['affine_lps'],q)
            error_mm.append(math.dist(slicer_lps,a_lps))
            back=point(inv,[-a_lps[0],-a_lps[1],a_lps[2]])
            error_vox.append(math.dist(back,q))
        physical=[math.sqrt(sum(m.GetElement(r,c)**2 for r in range(3))) for c in range(3)]
        spacingerr=max(abs(physical[k]-case['physical_axis_norms_mm'][k]) for k in range(3))
        status='PASS' if (max(error_mm)<=MAX_WORLD_MM
          and max(error_vox)<=MAX_INVERSE_VOX and spacingerr<=MAX_SPACING_MM) else 'FAIL'
        metrics={'status':status,'reference':'Slicer native DICOM MRML IJK->RAS',
          'slicer_version':slicer.app.applicationVersion,
          'vtk_version':vtk.vtkVersion.GetVTKVersion(),
          'original_zip_sha256':case['original_zip_sha256'],
          'frame_count':case['frames'],'dims_crs':dimensions,
          'sample_count':len(samples),
          'max_world_mm':max(error_mm),'mean_world_mm':statistics.fmean(error_mm),
          'p95_world_mm':sorted(error_mm)[math.ceil(.95*len(error_mm))-1],
          'max_inverse_voxel':max(error_vox),'max_spacing_delta_mm':spacingerr,
          'limits':{'world_mm':MAX_WORLD_MM,'inverse_voxel':MAX_INVERSE_VOX,
                    'spacing_mm':MAX_SPACING_MM},
          'note':'Slicer DICOM import required; not clinical accuracy'}
        output.write_text(json.dumps(metrics,sort_keys=True,indent=2),encoding='utf8')
        slicer.app.exit(0 if status=='PASS' else 2)

if __name__=='__main__':
    import slicer
    try:main()
    except Exception as exc:
        # Do not leak patient data, UIDs, paths or exception content.
        print('AFE_SLICER_GATE_BLOCKED',type(exc).__name__)
        target=os.environ.get('AFE_SLICER_REPORT')
        if target:
            Path(target).write_text(json.dumps(
                {'status':'BLOCKED','error_type':type(exc).__name__}),encoding='utf8')
        slicer.app.exit(3)
