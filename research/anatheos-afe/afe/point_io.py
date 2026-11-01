"""AFE-02A atomic ASCII PLY + JSON source provenance. Not a volume replacement."""
import hashlib
import json
import os
from pathlib import Path
import tempfile
from typing import Sequence
from .points import Sample,PointSource,PointError,MAX_POINTS
from .geometry import VolumeGeometry

def export_ply(points:Sequence[Sample],g:VolumeGeometry,source:PointSource,
               stem:Path,*,method:str,stride:int)->dict:
    source.validate(g,method!='acquired_planes')
    if not points or len(points)>MAX_POINTS:raise PointError('INVALID_EXPORT_POINT_COUNT')
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
                if p.source_sha256!=source.source_sha256 or p.geometry_sha256!=source.geometry_sha256 or p.label!='unknown':
                    raise PointError('POINT_PROVENANCE_MISMATCH')
                if not all(abs(v)<1e9 for v in (*p.lps_mm,*p.voxel_crs)):
                    raise PointError('UNSAFE_POINT_COORDINATE')
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
