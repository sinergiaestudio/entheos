"""AFE-02A atomic ASCII PLY + JSON source provenance. Not a volume replacement."""
import hashlib
import json
import os
from pathlib import Path
import tempfile
from typing import Sequence
from math import dist, isfinite
from .points import Sample,PointSource,PointError,MAX_POINTS,MAX_STRIDE,FACES,_bounds
from .geometry import VolumeGeometry

# Floating-point consistency gates for software-produced points, NOT clinical tolerances.
_LATTICE_TOL_VOX = 1e-9
_AFFINE_TOL_MM = 1e-8


def _validate_export_points(points:Sequence[Sample],g:VolumeGeometry,
                            source:PointSource,method:str,stride:int)->None:
    """Recheck untrusted Sample fields against the source affine and original-frame order.

    A digest authenticates bytes, not a point's claimed position/provenance.
    Original DICOM byte attestation remains the upstream preflight responsibility.
    """
    if method not in ('centers','faces','adaptive','acquired_planes'):
        raise PointError('UNSUPPORTED_EXPORT_METHOD')
    if type(stride) is not int or not 1 <= stride <= MAX_STRIDE:
        raise PointError('INVALID_STRIDE')
    source.validate(g,method != 'acquired_planes')
    nc,nr,nz=_bounds(g,sparse=method == 'acquired_planes')
    if method=='acquired_planes' and source.spatial_status!='ACCEPTED_SPATIAL_ONLY':
        raise PointError('ACQUIRED_PLANE_REQUIRES_SPATIAL_ONLY_SOURCE')
    if not points or len(points)>MAX_POINTS:
        raise PointError('INVALID_EXPORT_POINT_COUNT')
    for p in points:
        if not isinstance(p,Sample):
            raise PointError('INVALID_SAMPLE_TYPE')
        if (p.source_sha256!=source.source_sha256 or
                p.geometry_sha256!=source.geometry_sha256 or
                p.label!='unknown'):
            raise PointError('POINT_PROVENANCE_MISMATCH')
        coords=(*p.lps_mm,*p.voxel_crs)
        if (len(p.lps_mm)!=3 or len(p.voxel_crs)!=3 or
                any(type(v) not in (float,int) or not isfinite(v) or abs(v)>=1e9
                    for v in coords)):
            raise PointError('UNSAFE_POINT_COORDINATE')
        if type(p.source_frame_index) is not int:
            raise PointError('SOURCE_FRAME_INDEX_MISMATCH')
        if method=='faces':
            if type(p.face_id) is not int or not 0<=p.face_id<len(FACES):
                raise PointError('FACE_ID_MISMATCH')
            base=tuple(v - 0.5*d for v,d in zip(p.voxel_crs,FACES[p.face_id]))
            expected_state,expected_kind='derived','exposed_face'
        else:
            if p.face_id!=-1 or type(p.face_id) is not int:
                raise PointError('FACE_ID_MISMATCH')
            base=p.voxel_crs
            expected_state,expected_kind=(('acquired_plane','acquired_plane')
                if method=='acquired_planes' else ('synthetic','voxel_center'))
        indices=tuple(round(v) for v in base)
        if any(abs(v-idx)>_LATTICE_TOL_VOX for v,idx in zip(base,indices)):
            raise PointError('POINT_NOT_ON_DECLARED_LATTICE')
        i,j,k=indices
        if not (0<=i<nc and 0<=j<nr and 0<=k<nz):
            raise PointError('POINT_OUTSIDE_SOURCE_GRID')
        if p.source_frame_index!=g.sorted_source_indices[k]:
            raise PointError('SOURCE_FRAME_INDEX_MISMATCH')
        if p.state!=expected_state or p.sample_kind!=expected_kind:
            raise PointError('POINT_METHOD_STATE_MISMATCH')
        expected=g.voxel_to_lps(*p.voxel_crs)
        if dist(expected,p.lps_mm)>_AFFINE_TOL_MM:
            raise PointError('POINT_AFFINE_LPS_MISMATCH')


def export_ply(points:Sequence[Sample],g:VolumeGeometry,source:PointSource,
               stem:Path,*,method:str,stride:int)->dict:
    # Validate every sample before touching the output directory or temporary files.
    _validate_export_points(points,g,source,method,stride)
    if not isinstance(stem,Path):stem=Path(stem)
    stem.parent.mkdir(parents=True,exist_ok=True)
    ply=stem.with_suffix('.ply');side=stem.with_suffix('.json')
    if ply.exists() or side.exists():raise PointError('NO_OVERWRITE_EXISTING_EXPORT')
    header=('ply\nformat ascii 1.0\ncomment coordinate_frame LPS_mm\n'
            f'element vertex {len(points)}\n'
            'property double x\nproperty double y\nproperty double z\n'
            'property double voxel_c\nproperty double voxel_r\nproperty double voxel_s\n'
            'property int original_frame_index\nproperty int face_id\nend_header\n')
    temporary=None
    try:
        with tempfile.NamedTemporaryFile(mode='w',encoding='ascii',dir=stem.parent,delete=False,
                                         prefix='.afe-points-',newline='\n') as w:
            temporary=Path(w.name);w.write(header)
            for p in points:
                w.write(' '.join(f'{v:.17g}' for v in (*p.lps_mm,*p.voxel_crs))+
                        f' {p.source_frame_index} {p.face_id}\n')
        payload=temporary.read_bytes();digest=hashlib.sha256(payload).hexdigest()
        provenance={'schema':'afe-points-v1','coordinate_frame':'LPS_mm',
            'source_sha256':source.source_sha256,'geometry_sha256':source.geometry_sha256,
            'mask_source_sha256':source.mask_source_sha256,'mask_geometry_sha256':source.mask_geometry_sha256,
            'provenance_method':source.provenance_method,'spatial_status':source.spatial_status,
            'label':'unknown','confidence':None,'intensity_value':None,'intensity_unit':None,
            'sampling_method':method,'stride':stride,'point_count':len(points),
            'state_set':sorted(set(p.state for p in points)),
            'dimensions_crs':g.dimensions_crs,'affine_lps':g.affine_lps,
            'ply_sha256':digest,'ply_bytes':len(payload),
            'scope':'original voxel sample sites or synthetic cubical-mask surface; NOT anatomy/diagnosis'}
        with tempfile.NamedTemporaryFile(mode='w',encoding='utf8',dir=stem.parent,
                                         delete=False,prefix='.afe-meta-') as side_temp:
            json.dump(provenance,side_temp,indent=2,sort_keys=True)
            side_path=Path(side_temp.name)
        os.replace(temporary,ply);temporary=None
        try:os.replace(side_path,side)
        except Exception:
            ply.unlink(missing_ok=True);raise
        return provenance
    finally:
        if temporary:temporary.unlink(missing_ok=True)
