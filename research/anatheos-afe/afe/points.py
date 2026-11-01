"""AFE-02A: physical point samples from verified synthetic masks or acquired planes.
No DICOM importer, labels, meshes, interpolated public slices or viewer.
Coordinates: column,row,slice -> patient LPS millimetres.
"""
from __future__ import annotations
from dataclasses import dataclass
from hashlib import sha256
from math import isfinite
import json
from typing import Callable, Optional, Sequence
from .geometry import VolumeGeometry, GeometryError

MAX_VOXELS=2_000_000
MAX_POINTS=150_000
MAX_STRIDE=4096
FACES=((-1,0,0),(1,0,0),(0,-1,0),(0,1,0),(0,0,-1),(0,0,1))

class PointError(ValueError):pass

def fingerprint(g:VolumeGeometry)->str:
    return sha256(json.dumps({'affine_lps':g.affine_lps,'dimensions_crs':g.dimensions_crs,
        'source_kind':g.source_kind,'sorted_source_indices':g.sorted_source_indices},
        separators=(',',':'),sort_keys=True).encode()).hexdigest()

@dataclass(frozen=True)
class PointSource:
    source_sha256:str
    provenance_method:str
    geometry_sha256:str
    spatial_status:str
    mask_source_sha256:Optional[str]=None
    mask_geometry_sha256:Optional[str]=None
    label:str='unknown'
    label_source_sha256:Optional[str]=None
    calibrated_confidence:Optional[float]=None

    def validate(self,g:VolumeGeometry,has_mask:bool)->None:
        for digest in (self.source_sha256,self.geometry_sha256):
            if not isinstance(digest,str) or len(digest)!=64 or any(c not in '0123456789abcdef' for c in digest):
                raise PointError('INVALID_SOURCE_DIGEST')
        if self.geometry_sha256!=fingerprint(g):raise PointError('GEOMETRY_SOURCE_MISMATCH')
        if self.spatial_status not in ('SYNTHETIC_VALIDATED','ACCEPTED_SPATIAL_ONLY'):
            raise PointError('UNVERIFIED_SPATIAL_STATUS')
        if not self.provenance_method or len(self.provenance_method)>96:
            raise PointError('UNVERIFIED_PROVENANCE_METHOD')
        if self.spatial_status=='ACCEPTED_SPATIAL_ONLY' and self.provenance_method=='synthetic':
            raise PointError('STATUS_PROVENANCE_CONTRADICTION')
        if has_mask:
            if self.spatial_status!='SYNTHETIC_VALIDATED':
                raise PointError('MASK_GATE_REQUIRES_VERIFIED_SYNTHETIC_SCOPE')
            if self.mask_geometry_sha256!=fingerprint(g) or not self.mask_source_sha256:
                raise PointError('MASK_SOURCE_OR_GRID_UNVERIFIED')
            if len(self.mask_source_sha256)!=64 or any(c not in '0123456789abcdef' for c in self.mask_source_sha256):
                raise PointError('MASK_SOURCE_OR_GRID_UNVERIFIED')
        if self.label!='unknown':raise PointError('ANATOMICAL_LABEL_GATE_NOT_APPROVED')
        if self.label_source_sha256 is not None or self.calibrated_confidence is not None:
            raise PointError('LABEL_OR_CONFIDENCE_NOT_CALIBRATED')

@dataclass(frozen=True)
class Sample:
    lps_mm:tuple[float,float,float]
    voxel_crs:tuple[float,float,float]
    source_frame_index:int
    source_sha256:str
    geometry_sha256:str
    state:str
    label:str
    sample_kind:str
    face_id:int=-1

def _bounds(g:VolumeGeometry,*,sparse:bool=False)->tuple[int,int,int]:
    ncol,nrow,nslice=g.dimensions_crs
    if not all(isinstance(d,int) and not isinstance(d,bool) and d>0 for d in (ncol,nrow,nslice)):
        raise PointError('INVALID_GRID_DIMS')
    if not sparse and ncol*nrow*nslice>MAX_VOXELS:raise PointError('VOXEL_MEMORY_LIMIT')
    if len(g.sorted_source_indices)!=nslice or len(set(g.sorted_source_indices))!=nslice:
        raise PointError('INVALID_SOURCE_ORDER')
    if any(not isfinite(coord) for coord in
           (*g.origin_lps_mm,*g.column_vector_mm,*g.row_vector_mm,*g.slice_vector_mm)):
        raise PointError('NONFINITE_AFFINE')
    try:g.lps_to_voxel(g.origin_lps_mm)
    except GeometryError as e:raise PointError('NONINVERTIBLE_GRID') from e
    return ncol,nrow,nslice

def extract_mask(g:VolumeGeometry,mask:Sequence[int],source:PointSource,*,
                 method:str='centers',stride:int=1,max_points:int=MAX_POINTS,
                 cancel:Optional[Callable[[],bool]]=None)->list[Sample]:
    """Deterministic scan order; centers, exposed digital voxel face centers,
    or adaptive boundary-preserving centers. No true anatomical isosurface.
    """
    source.validate(g,True)
    nc,nr,nz=_bounds(g)
    if method not in ('centers','faces','adaptive'):raise PointError('UNSUPPORTED_METHOD')
    if not isinstance(stride,int) or isinstance(stride,bool) or not 1<=stride<=MAX_STRIDE:
        raise PointError('INVALID_STRIDE')
    if not isinstance(max_points,int) or isinstance(max_points,bool) or not 0<max_points<=MAX_POINTS:
        raise PointError('INVALID_POINT_CAP')
    if not isinstance(mask,(bytes,bytearray,memoryview)):raise PointError('MASK_BYTES_REQUIRED_FOR_HASH')
    if len(mask)!=nc*nr*nz:raise PointError('MASK_DIMENSIONS_MISMATCH')
    if any(v not in (0,1) for v in mask):raise PointError('MASK_NOT_BINARY')
    if sha256(mask).hexdigest()!=source.mask_source_sha256:raise PointError('MASK_BYTES_SHA_MISMATCH')
    def offset(i,j,k):return (k*nr+j)*nc+i
    output=[];eligible=0
    for k in range(nz):
        if cancel and cancel():raise PointError('CANCELLED_NO_PARTIAL_OUTPUT')
        for j in range(nr):
            for i in range(nc):
                if not mask[offset(i,j,k)]:continue
                faces=[]
                if method in ('faces','adaptive'):
                    for face_id,(di,dj,dk) in enumerate(FACES):
                        a,b,c=i+di,j+dj,k+dk
                        if not (0<=a<nc and 0<=b<nr and 0<=c<nz) or not mask[offset(a,b,c)]:
                            faces.append((i+di*.5,j+dj*.5,k+dk*.5,face_id))
                coords=faces if method=='faces' else [(float(i),float(j),float(k),-1)]
                for a,b,c,face_id in coords:
                    keep=(method=='adaptive' and bool(faces)) or eligible%stride==0
                    if keep:
                        if len(output)>=max_points:raise PointError('POINT_MEMORY_LIMIT')
                        output.append(Sample(g.voxel_to_lps(a,b,c),(a,b,c),g.sorted_source_indices[k],
                            source.source_sha256,source.geometry_sha256,
                            'derived' if method=='faces' else 'synthetic','unknown',
                            'exposed_face' if method=='faces' else 'voxel_center',face_id))
                    eligible+=1
    return output

def acquired_plane_samples(g:VolumeGeometry,source:PointSource,
                           voxel_crs:Sequence[tuple[int,int,int]],*,max_points:int=MAX_POINTS)->list[Sample]:
    """Sparse physical locations ONLY on integer planes actually acquired."""
    nc,nr,nz=_bounds(g,sparse=True)
    source.validate(g,False)
    if source.spatial_status!='ACCEPTED_SPATIAL_ONLY':raise PointError('NOT_SPATIAL_ONLY_SOURCE')
    if len(voxel_crs)>max_points or max_points>MAX_POINTS:raise PointError('POINT_MEMORY_LIMIT')
    output=[]
    for p in voxel_crs:
        if not isinstance(p,(tuple,list)) or len(p)!=3 or not all(isinstance(v,int) and not isinstance(v,bool) for v in p):
            raise PointError('NOT_ACQUIRED_GRID_COORDINATE')
        i,j,k=p
        if not (0<=i<nc and 0<=j<nr and 0<=k<nz):raise PointError('OUTSIDE_ACQUIRED_GRID')
        output.append(Sample(g.voxel_to_lps(i,j,k),(float(i),float(j),float(k)),g.sorted_source_indices[k],
            source.source_sha256,source.geometry_sha256,'acquired_plane','unknown','acquired_plane'))
    return output
