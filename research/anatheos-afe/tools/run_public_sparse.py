#!/usr/bin/env python3
"""AFE-02A sparse ORIGINAL acquired planes only, no public masks/labels/interpolation."""
import argparse,json,math,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from afe.geometry import VolumeGeometry
from afe.points import PointSource,fingerprint,acquired_plane_samples

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--case-json',type=Path,required=True)
    parser.add_argument('--out',type=Path,required=True)
    args=parser.parse_args()
    case=json.loads(args.case_json.read_text())
    if case.get('schema')!='afe-public-geometry-v1' or case.get('geometry_status')!='ACCEPTED_SPATIAL_ONLY':
        raise ValueError('REQUIRE_PUBLIC_SPATIAL_ONLY')
    if case.get('volume_eligible') or case.get('temporal_context_verified') or case.get('interpolation_required'):
        raise ValueError('UNAUTHORIZED_CONTINUOUS_VOLUME_OR_PHASE')
    a=case['affine_lps'];dims=tuple(case['dimensions_crs'])
    order=tuple(case['sorted_source_indices'])
    if len(order)!=dims[2] or len(set(order))!=dims[2] or case['unique_verified_source_instance_count']!=dims[2]:
        raise ValueError('UNVERIFIED_SOURCE_ORDER')
    g=VolumeGeometry(tuple(a[r][3] for r in range(3)),tuple(a[r][0] for r in range(3)),
          tuple(a[r][1] for r in range(3)),tuple(a[r][2] for r in range(3)),
          dims,order,'MR' if case['case_id']=='Leeds-RTKN0668-DESS' else 'CT',
          'original',case['acquisition_thickness_mm'],case['interplane_spacing_mm'],
          case['gap_mm'],False,False,False,('SPATIAL_ONLY_NO_TEMPORAL_PROOF',))
    source=PointSource(case['original_zip_sha256'],'verified_original_sha256',
                       fingerprint(g),'ACCEPTED_SPATIAL_ONLY')
    picks=[(i,j,k) for k in (0,dims[2]//2,dims[2]-1)
                   for j in (0,dims[1]//2,dims[1]-1)
                   for i in (0,dims[0]//2,dims[0]-1)]
    points=acquired_plane_samples(g,source,picks)
    if len(points)!=27 or any(p.label!='unknown' or p.sample_kind!='acquired_plane' or
       p.voxel_crs[2]!=int(p.voxel_crs[2]) for p in points):
        raise ValueError('ORIGINAL_PLANE_GATE_REJECTED')
    residual=max(math.dist(p.lps_mm,
        [sum(a[r][col]*p.voxel_crs[col] for col in range(3))+a[r][3] for r in range(3)])
        for p in points)
    if residual>=1e-8:raise ValueError('REAL_DICOM_SAMPLE_COORDINATES_MISMATCH')
    result={'case':case['case_id'],'status':'PASS_SPATIAL_ONLY',
            'source_sha256':case['original_zip_sha256'],'dimensions_crs':dims,
            'points':len(points),'max_world_affine_residual_mm':residual,
            'max_original_ipp_residual_mm':case['max_source_ipp_residual_mm'],
            'first_last_source_frame_indices':(order[0],order[-1]),
            'label':'unknown','mask_used':False,'interpolation':False,
            'temporal_verified':False,'volume_eligible':False}
    args.out.write_text(json.dumps(result,indent=2,sort_keys=True))
    print('AFE02A_PUBLIC_ACQUIRED_PLANES_PASS',json.dumps(result,sort_keys=True))
if __name__=='__main__':main()
