"""CMR-R2 normalized metadata adapter. No DICOM importer, pixels, I/O, or logging.

Integrity checks ensure internal file consistency, NOT authenticity of a scanner.
All supplied metadata may be private. Never log input dictionaries or hashes.
"""
from __future__ import annotations
from dataclasses import dataclass
from math import isfinite
from collections.abc import Mapping
import hashlib
import json
import re
from .geometry import SliceGeometry, VolumeGeometry, build_regular_grid, GeometryError

SCHEMA='anatheos-cmr-r2-private-v1'
INTEGRITY_SCHEMA='anatheos-cmr-r2-integrity-v1'
HEX64=re.compile(r'^[0-9a-fA-F]{64}$')
LOCAL_ID=re.compile(r'^RM-\d{3}$')


class ContractError(GeometryError):
    """Sanitized error: do not put patient identifiers in exceptions."""
    def __init__(self,code):
        self.code=code
        super().__init__(code)


def check(ok,code):
    if not ok: raise ContractError(code)


def numeric(v):
    if v is None or isinstance(v,bool) or v=='':return None
    try:
        x=float(v)
        return x if isfinite(x) else None
    except (TypeError,ValueError,OverflowError):return None


def fingerprint(parts):
    """Derived only from previously verified acquisition/temporal tags."""
    return hashlib.sha256(repr(parts).encode('utf-8')).hexdigest()


@dataclass(frozen=True)
class AdaptedSeries:
    geometry:VolumeGeometry
    schema:str
    metadata_sha256_private:str
    source_frames:int
    validation_scope:str='metadata consistency only; motion/registration not verified'


def adapt_cmr_r2(catalog:Mapping,geometry_json_bytes:bytes,integrity:Mapping,
                 selected_id:str,decoded_shape:tuple[int,int,int])->AdaptedSeries:
    """Accepts an existing CMR catalog, raw normalized JSON, integrity manifest
    and the already-decoded NPY shape. DOES NOT verify pixel bytes or parse DICOM.
    """
    check(isinstance(selected_id,str) and bool(LOCAL_ID.fullmatch(selected_id)),'INVALID_LOCAL_SERIES')
    check(isinstance(geometry_json_bytes,bytes) and 0<len(geometry_json_bytes)<=8*1024*1024,'INVALID_GEOMETRY_BYTES')
    check(isinstance(catalog,Mapping) and isinstance(integrity,Mapping),'INVALID_MANIFESTS')
    check(catalog.get('schema')==SCHEMA and integrity.get('schema')==INTEGRITY_SCHEMA,'UNSUPPORTED_SCHEMA')
    digest=hashlib.sha256(geometry_json_bytes).hexdigest()
    check(str(integrity.get('geometria_sha256','')).lower()==digest,'GEOMETRY_HASH_MISMATCH')
    check(bool(HEX64.fullmatch(str(integrity.get('pixels_sha256','')))),'PIXEL_HASH_NOT_DECLARED')
    try: data=json.loads(geometry_json_bytes)
    except (ValueError,UnicodeError,TypeError):raise ContractError('INVALID_GEOMETRY_JSON') from None
    check(isinstance(data,dict) and data.get('schema')==SCHEMA
          and data.get('serie_local')==selected_id,'GEOMETRY_SERIES_MISMATCH')
    original=data.get('source_zip_sha256')
    check(isinstance(original,str) and bool(HEX64.fullmatch(original))
          and original==integrity.get('source_zip_sha256')
          and original==catalog.get('origen_zip_sha256_PRIVADO'),'SOURCE_HASH_CHAIN_MISMATCH')
    entries=catalog.get('series')
    check(isinstance(entries,list) and len(entries)<=1000,'INVALID_CATALOG')
    match=[x for x in entries if isinstance(x,dict) and x.get('serie_local')==selected_id]
    check(len(match)==1 and match[0].get('estado')=='preparada','SERIES_NOT_PREPARED')
    check(match[0].get('modo_seguro')=='pila_2d_revisar_3d','MODE_NOT_ELIGIBLE')
    shape=decoded_shape
    check(isinstance(shape,(tuple,list)) and len(shape)==3
          and all(type(x) is int and x>0 for x in shape) and shape[0]>=3
          and shape[1]>=2 and shape[2]>=2
          and shape[0]*shape[1]*shape[2]<=170_000_000,'INVALID_PIXEL_SHAPE')
    records=data.get('frames')
    check(isinstance(records,list) and len(records)==shape[0]
          and match[0].get('instancias')==len(records),'FRAME_COUNT_MISMATCH')
    frames=[];seen=set();identity=None;acquisition=None;temporal=None
    for record in records:
        check(isinstance(record,dict),'INVALID_FRAME')
        src=record.get('source_sha256')
        check(isinstance(src,str) and bool(HEX64.fullmatch(src)) and src not in seen,
              'FRAME_SOURCE_NOT_VERIFIED')
        seen.add(src)
        ids=tuple(record.get(k) for k in ('study_instance_uid','series_instance_uid','frame_of_reference_uid'))
        check(all(isinstance(x,str) and bool(x.strip()) for x in ids),'FRAME_IDENTIFIERS_ABSENT')
        if identity is None:identity=ids
        check(ids==identity,'MIXED_STUDY_SERIES_OR_REFERENCE')
        check(record.get('modality')=='MR','NOT_CMR_MODALITY')
        image_type=record.get('image_type')
        check(isinstance(image_type,str) and bool(image_type.strip()),'IMAGE_TYPE_UNVERIFIED')
        check(not re.search(r'PHASE|PERFUSION|DYNAMIC',image_type,re.I),'DYNAMIC_IMAGE_BLOCKED')
        tags=record.get('acquisition')
        check(isinstance(tags,dict),'ACQUISITION_TAGS_MISSING')
        check(isinstance(tags.get('scan_sequence'),str) and bool(tags.get('scan_sequence'))
              and numeric(tags.get('tr')) is not None and numeric(tags.get('te')) is not None,
              'ACQUISITION_UNVERIFIED')
        thickness=numeric(tags.get('slice_thickness'))
        check(thickness is not None and thickness>0,'THICKNESS_UNVERIFIED')
        signature=(image_type,tags.get('scan_sequence'),tags.get('sequence_variant'),
                   numeric(tags.get('tr')),numeric(tags.get('te')),numeric(tags.get('ti')),
                   numeric(tags.get('kvp')),tags.get('convolution_kernel'),
                   numeric(record.get('rescale_slope')),numeric(record.get('rescale_intercept')),
                   record.get('photometric_interpretation'))
        if acquisition is None:acquisition=signature
        check(signature==acquisition,'MIXED_ACQUISITION')
        phase=(numeric(record.get('trigger_time_ms')),numeric(record.get('temporal_position_identifier')))
        check(any(v is not None for v in phase),'TEMPORAL_UNVERIFIED')
        if temporal is None:temporal=phase
        check(phase==temporal,'MIXED_PHASES')
        source_kind='derived' if re.search(r'DERIVED|SECONDARY',image_type,re.I) else 'original'
        try:
            frames.append(SliceGeometry(
                ipp_lps_mm=tuple(record.get('image_position_patient_LPS_mm') or ()),
                iop=tuple(record.get('image_orientation_patient_LPS') or ()),
                spacing_row_col_mm=tuple(record.get('pixel_spacing_row_col_mm') or ()),
                rows=shape[1],columns=shape[2],slice_thickness_mm=thickness,
                modality='MR',acquisition_key=fingerprint(signature),
                temporal_key=fingerprint(phase),source_kind=source_kind))
        except (ValueError,TypeError):
            raise ContractError('FRAME_GEOMETRY_INVALID') from None
    return AdaptedSeries(build_regular_grid(frames),SCHEMA,digest,len(frames))
