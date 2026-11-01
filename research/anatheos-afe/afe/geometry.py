"""AFE-01: conservative physical DICOM stack geometry. Synthetic tests only.

Coordinate system: patient LPS (mm). Voxel order is (column, row, slice).
Geometry of measured sampling locations, not inferred anatomy or scanner resolution.
No clinical identifiers or pixel content are accepted by this module.
"""
from __future__ import annotations
from dataclasses import dataclass
from math import isfinite, sqrt
from typing import Sequence

# Engineering rejection thresholds, NOT clinical accuracy or scanner tolerance claims.
_DIRECTION_TOL = 1e-4
_POSITION_TOL_MM = 0.01
_STEP_TOL_MM = 0.05
_STEP_REL_TOL = 0.01


class GeometryError(ValueError):
    """A stack is not safely representable as a regular 3D physical grid."""


def _dot(a: Sequence[float], b: Sequence[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def _norm(a: Sequence[float]) -> float:
    return sqrt(_dot(a, a))


def _sub(a: Sequence[float], b: Sequence[float]) -> tuple[float, float, float]:
    return tuple(x - y for x, y in zip(a, b))  # type: ignore[return-value]


def _cross(a: Sequence[float], b: Sequence[float]) -> tuple[float, float, float]:
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def _vector(values: Sequence[float], n: int, field: str) -> tuple[float, ...]:
    if not isinstance(values, (tuple, list)) or len(values) != n:
        raise GeometryError(f"{field}: expected {n} elements")
    if any(not isinstance(x, (int, float)) or isinstance(x, bool) or not isfinite(x) for x in values):
        raise GeometryError(f"{field}: nonfinite/non-numeric element")
    return tuple(float(x) for x in values)


@dataclass(frozen=True)
class SliceGeometry:
    """Anonymized, already-decoded frame geometry (no IDs and no image bytes)."""
    ipp_lps_mm: tuple[float, float, float]
    iop: tuple[float, float, float, float, float, float]
    spacing_row_col_mm: tuple[float, float]
    rows: int
    columns: int
    slice_thickness_mm: float
    modality: str
    acquisition_key: str  # validated by upstream ingestion; never PHI / UID
    temporal_key: str  # validated fixed temporal phase; never PHI / UID
    source_kind: str = "original"  # original | derived; no inference that derived is acquired

    def axes(self) -> tuple[tuple[float, ...], tuple[float, ...], tuple[float, float, float]]:
        _vector(self.ipp_lps_mm, 3, 'ImagePositionPatient')
        direction = _vector(self.iop, 6, 'ImageOrientationPatient')
        spacing = _vector(self.spacing_row_col_mm, 2, 'PixelSpacing')
        if min(spacing) <= 0:
            raise GeometryError('PixelSpacing must be positive')
        if (not isinstance(self.rows, int) or isinstance(self.rows, bool) or self.rows < 2
                or not isinstance(self.columns, int) or isinstance(self.columns, bool) or self.columns < 2):
            raise GeometryError('invalid Rows/Columns')
        if not isinstance(self.slice_thickness_mm, (int, float)) or not isfinite(self.slice_thickness_mm) or self.slice_thickness_mm <= 0:
            raise GeometryError('SliceThickness absent/invalid')
        if self.modality not in ('CT', 'MR'):
            raise GeometryError('unsupported modality')
        if not self.acquisition_key or not self.temporal_key or any(not isinstance(v, str) for v in (self.acquisition_key, self.temporal_key)):
            raise GeometryError('unverified acquisition/temporal context')
        if self.source_kind not in ('original', 'derived'):
            raise GeometryError('unrecognized source kind')
        row, col = direction[:3], direction[3:]
        if (abs(_dot(row, row)-1) > _DIRECTION_TOL or abs(_dot(col, col)-1) > _DIRECTION_TOL
                or abs(_dot(row, col)) > _DIRECTION_TOL):
            raise GeometryError('nonorthonormal ImageOrientationPatient')
        return row, col, _cross(row, col)


@dataclass(frozen=True)
class VolumeGeometry:
    """A column,row,slice -> patient LPS physical affine for a regular stack."""
    origin_lps_mm: tuple[float, float, float]
    column_vector_mm: tuple[float, float, float]
    row_vector_mm: tuple[float, float, float]
    slice_vector_mm: tuple[float, float, float]
    dimensions_crs: tuple[int, int, int]
    sorted_source_indices: tuple[int, ...]
    modality: str
    source_kind: str
    acquisition_thickness_mm: float = 0.
    interplane_spacing_mm: float = 0.
    gap_mm: float = 0.
    sampling_continuous: bool = True
    volume_eligible: bool = True
    interpolation_required: bool = False
    reasons: tuple[str, ...] = ()

    def voxel_to_lps(self, column: float, row: float, slice_index: float) -> tuple[float, float, float]:
        if not all(isfinite(v) for v in (column, row, slice_index)):
            raise GeometryError('nonfinite voxel coordinates')
        return tuple(self.origin_lps_mm[k] + column*self.column_vector_mm[k]
                     + row*self.row_vector_mm[k] + slice_index*self.slice_vector_mm[k]
                     for k in range(3))  # type: ignore[return-value]

    def lps_to_voxel(self, point: Sequence[float]) -> tuple[float, float, float]:
        p = _vector(point, 3, 'LPS point')
        delta = _sub(p, self.origin_lps_mm)
        # True 3x3 affine inverse, not the axis projection approximation.
        # Slight DICOM IOP rounding means accepted axes need not be perfectly orthogonal.
        a, b, c = self.column_vector_mm, self.row_vector_mm, self.slice_vector_mm
        ca, cb, cc = _cross(b,c), _cross(c,a), _cross(a,b)
        det = _dot(a, ca)
        scale = _norm(a)*_norm(b)*_norm(c)
        if not isfinite(scale) or scale <= 0 or not isfinite(det) or abs(det)/scale <= 1e-8:
            raise GeometryError('SINGULAR_AFFINE: degenerate or ill-conditioned affine')
        return (_dot(delta,ca)/det, _dot(delta,cb)/det, _dot(delta,cc)/det)

    @property
    def affine_lps(self) -> tuple[tuple[float, float, float, float], ...]:
        x,y,z,o = self.column_vector_mm,self.row_vector_mm,self.slice_vector_mm,self.origin_lps_mm
        return ((x[0],y[0],z[0],o[0]),(x[1],y[1],z[1],o[1]),
                (x[2],y[2],z[2],o[2]),(0.0,0.0,0.0,1.0))


def build_regular_grid(frames: Sequence[SliceGeometry]) -> VolumeGeometry:
    """Rejects mixed phases, irregular positions, drift and inconsistent acquisition.

    Does NOT resample, infer tissue, join different series, or validate motion.
    Input acquisition_key/temporal_key must be set only by a trusted upstream check.
    """
    if len(frames) < 3:
        raise GeometryError('at least three slices required')
    if len(frames) > 4096:
        raise GeometryError('stack exceeds configured slice limit')
    first = frames[0]
    x_axis, y_axis, raw_normal = first.axes()
    normal = tuple(v/_norm(raw_normal) for v in raw_normal)
    origin = _vector(first.ipp_lps_mm, 3, 'ImagePositionPatient')
    positions = []
    for index, frame in enumerate(frames):
        row, col, n = frame.axes()
        if (frame.modality, frame.acquisition_key, frame.temporal_key, frame.source_kind) != (first.modality, first.acquisition_key, first.temporal_key, first.source_kind):
            raise GeometryError('mixed acquisition, phase, modality or source kind')
        if frame.rows != first.rows or frame.columns != first.columns:
            raise GeometryError('mixed image dimensions')
        if any(abs(a-b) > _DIRECTION_TOL for a,b in zip(row+col, x_axis+y_axis)):
            raise GeometryError('orientation varies between frames')
        if any(abs(a-b) > _POSITION_TOL_MM for a,b in zip(frame.spacing_row_col_mm, first.spacing_row_col_mm)):
            raise GeometryError('PixelSpacing varies between frames')
        if abs(frame.slice_thickness_mm - first.slice_thickness_mm) > _STEP_TOL_MM:
            raise GeometryError('SliceThickness varies between frames')
        delta = _sub(frame.ipp_lps_mm, origin)
        along = _dot(delta, normal)
        tangential = tuple(delta[i]-along*normal[i] for i in range(3))
        if _norm(tangential) > _POSITION_TOL_MM:
            raise GeometryError('out-of-normal drift: registration/resampling required')
        positions.append((along, index))
    positions.sort()
    steps = [positions[i+1][0]-positions[i][0] for i in range(len(positions)-1)]
    if any(s <= _POSITION_TOL_MM for s in steps):
        raise GeometryError('duplicate/repeated slice positions')
    step = (positions[-1][0]-positions[0][0])/(len(positions)-1)
    if any(abs(s-step)>max(_STEP_TOL_MM,step*_STEP_REL_TOL) for s in steps):
        raise GeometryError('irregular slice spacing/missing slice')
    # Physical regularity is distinct from inferred slab continuity.
    # A constant interplane gap remains a geometrically regular grid but is
    # NOT eligible for direct continuous-volume interpretation.
    gap = max(0., step-first.slice_thickness_mm)
    discontinuous = gap > max(_STEP_TOL_MM,step*0.05)
    reasons = ('ACQUISITION_GAP_REQUIRES_INTERPOLATION',) if discontinuous else ()
    first_origin = _vector(frames[positions[0][1]].ipp_lps_mm, 3, 'ImagePositionPatient')
    dx = tuple(float(v*first.spacing_row_col_mm[1]) for v in x_axis)
    dy = tuple(float(v*first.spacing_row_col_mm[0]) for v in y_axis)
    dz = tuple(float(v*step) for v in normal)
    return VolumeGeometry(first_origin,dx,dy,dz,(first.columns,first.rows,len(frames)),
                          tuple(i for _,i in positions),first.modality,first.source_kind,
                          first.slice_thickness_mm,step,gap,not discontinuous,
                          not discontinuous,discontinuous,reasons)


def lps_to_ras(p: Sequence[float]) -> tuple[float, float, float]:
    x,y,z = _vector(p,3,'LPS point')
    return (-x,-y,z)


def ras_to_lps(p: Sequence[float]) -> tuple[float, float, float]:
    return lps_to_ras(p)


def ct_rescale_to_hu(stored_value: float, slope: float, intercept: float, modality: str, unit: str) -> float:
    """Only calls a value HU if upstream CT metadata explicitly establishes HU units."""
    if modality != 'CT' or unit != 'HU':
        raise GeometryError('HU conversion not justified by source metadata')
    if not all(isinstance(v,(int,float)) and isfinite(v) for v in (stored_value,slope,intercept)) or slope == 0:
        raise GeometryError('invalid CT rescale')
    return float(stored_value*slope+intercept)
