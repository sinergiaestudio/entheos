#!/usr/bin/env python3
"""ANATHEOS CMR-R1: validate real JPEG2000 DICOM frames offline with Pillow.

Optional preparation of an explicitly selected local series as an NPZ and a
private geometry JSON. This is NOT a diagnostic DICOM renderer. All original
DICOMs remain untouched. Generated pixel files are private clinical material.
Depends on free packages: Pillow (JPEG 2000 support) and numpy.
"""
import argparse, collections, hashlib, io, json, math, struct, sys, zipfile
from pathlib import Path
import numpy as np
from PIL import Image, features
from auditar_dicom_offline import parse_dicom, projection, numbers, numeric, family, STANDARD_MR, ENHANCED_MR

def unpack_encapsulated_one_frame(data,point):
    """Strictly only for single-frame encapsulated DICOM; no BOT frame guessing."""
    if point['length']!=0xffffffff:raise ValueError('pixel_not_encapsulated')
    p=point['offset'];start=p;frags=[];basic=None;closed=False
    while p+8<=len(data):
        group,element,sz=struct.unpack_from('<HHI',data,p);p+=8
        if (group,element)==(0xfffe,0xe0dd):
            if sz!=0:raise ValueError('sequence_delimiter_bad_length')
            closed=True;break
        if (group,element)!=(0xfffe,0xe000) or sz==0xffffffff or p+sz>len(data):
            raise ValueError('fragment_malformed')
        chunk=data[p:p+sz];p+=sz
        if basic is None:basic=chunk
        else:frags.append(chunk)
        if len(frags)>10000:raise ValueError('too_many_fragments')
    if not closed:raise ValueError('no_pixel_sequence_delimiter')
    if not frags:raise ValueError('no_compressed_frame')
    if len(basic)%4!=0:raise ValueError('bad_offset_table')
    # For a single frame, offsets are either empty or just a 0 value.
    if len(basic)>4 or (len(basic)==4 and basic!=b'\0\0\0\0'):
        raise ValueError('multi_frame_offsets_unsupported')
    return b''.join(frags),len(frags)

def decoder_one(data,meta):
    if meta.get('ts')!='1.2.840.10008.1.2.4.90':raise ValueError('unsupported_transfer_syntax')
    if int(numeric(meta.get('frames')) or 1)!=1:raise ValueError('multiframe_not_supported')
    payload,fragment_count=unpack_encapsulated_one_frame(data,meta['pixel'])
    # Pillow's OpenJPEG-derived decoder is independent of the DICOM metadata parser.
    with Image.open(io.BytesIO(payload)) as im:
        im.load();arr=np.asarray(im).copy()
        mode=im.mode
    if arr.ndim!=2:raise ValueError('not_monochrome_2d')
    if arr.shape!=(meta['rows'],meta['cols']):raise ValueError('shape_mismatch')
    bits=int(numeric(meta.get('bits')) or 0)
    if bits not in (8,16):raise ValueError('bits_unhandled')
    if int(meta.get('samples') or 1)!=1:raise ValueError('samples_not_one')
    if meta.get('photo') not in ('MONOCHROME1','MONOCHROME2'):raise ValueError('photo_unhandled')
    return arr,mode,fragment_count

def sorted_series(input_file):
    """Same grouping and order as sanitised inventory."""
    grp=collections.defaultdict(list);other=collections.Counter();crc=collections.Counter()
    with zipfile.ZipFile(input_file) as z:
        for info in z.infolist():
            if info.file_size>512*1024**2:other['oversize']+=1;continue
            with z.open(info) as f:data=f.read()
            if data[128:132]!=b'DICM':continue
            try:r=parse_dicom(data)
            except Exception:other['metadata_parse_error']+=1;continue
            if r.get('modality')=='MR' and r.get('sop_class') in (STANDARD_MR,ENHANCED_MR):
                grp[(r.get('study'),r.get('series'))].append((r,data))
    order=sorted(grp.values(),key=lambda v:(numeric(v[0][0].get('series_number')) or 0,family(v[0][0]),-len(v)))
    return order

def validate_file(filename,prepared_series=None,output=None):
    if not features.check('jpg_2000'):raise RuntimeError('El Pillow instalado carece de JPEG 2000')
    groups=sorted_series(filename)
    report={'esquema':'ANATHEOS-CMR-R1-J2K-qa-v1', 'pixel_data_reales':True,
       'originales_modificados':False,'datos_clinicos_en_reporte':False,'series':[]}
    selected=[]
    requested=set(prepared_series.split(',')) if prepared_series else set()
    for ii,series in enumerate(groups,1):
        identifier=f'RM-{ii:03d}';errors=collections.Counter();modes=collections.Counter();dtype=collections.Counter();fragmentos=collections.Counter();stack=[];metadata=[]
        for r,byte_stream in series:
            try:
                arr,mode,fragments=decoder_one(byte_stream,r)
                modes[mode]+=1;dtype[str(arr.dtype)]+=1;fragmentos[fragments]+=1
                if identifier in requested:
                    ori,pos=projection(r)
                    metadata.append({'instance_number':r.get('instance_number'),
                       'source_sha256':hashlib.sha256(byte_stream).hexdigest(),
                       'sop_class':r.get('sop_class'),'transfer_syntax':r.get('ts'),
                       'image_position_patient_LPS_mm':numbers(r.get('ipp'),3),
                       'image_orientation_patient_LPS':numbers(r.get('iop'),6),
                       'pixel_spacing_row_col_mm':numbers(r.get('spacing'),2),
                       'trigger_time_ms':numeric(r.get('trigger')),
                       'temporal_position_identifier':numeric(r.get('temporal_pos')),
                       'image_type':r.get('image_type'),
                       'rescale_slope':numeric(r.get('slope')),
                       'rescale_intercept':numeric(r.get('intercept')),
                       'photometric_interpretation':r.get('photo')})
                    stack.append(arr)
            except (ValueError,TypeError,OSError,RuntimeError,OverflowError) as e:
                # Class names are authored and sanitized; do not print original exception messages.
                errors[type(e).__name__]+=1
        report['series'].append({'serie_local':identifier,'instancias':len(series),
          'instancias_decodificadas':sum(modes.values()),'fallos':dict(errors),
          'modos_imagen':dict(modes),'dtype':dict(dtype),'fragmentos_por_instancia':dict(fragmentos)})
        if identifier in requested:
            if len(stack)!=len(series):raise RuntimeError('No se exportará una serie parcialmente decodificada')
            if len({tuple(x.shape) for x in stack})!=1:raise RuntimeError('Incompatibilidad de matrices')
            if output is None:raise RuntimeError('Falta carpeta de salida')
            serie_dest=Path(output)/identifier
            if serie_dest.exists():raise RuntimeError('Carpeta de serie existente. No se sobrescribe.')
            serie_dest.mkdir(parents=True,exist_ok=False)
            # Preserve source order alongside per-frame geom metadata. Do not resample / normalise.
            np.save(serie_dest/'pixels_original_decoded.npy',np.stack(stack,axis=0),allow_pickle=False)
            (serie_dest/'geometria_privada.json').write_text(json.dumps({
               'schema':'ANATHEOS-CMR-R1-private-v1','serie_local':identifier,
               'provenance':'lossless DICOM JPEG2000 source, preserving frame order','frames':metadata,
               'warning':'PRIVATE MEDICAL DATA. DO NOT COMMIT, UPLOAD OR SHARE THIS FILE.'},
               ensure_ascii=False,indent=2),encoding='utf-8')
            selected.append({'serie':identifier,'frames':len(stack),'matriz':list(stack[0].shape),'preparado':True})
    report['instancias_decodificadas_total']=sum(s['instancias_decodificadas'] for s in report['series'])
    report['instancias_total']=sum(s['instancias'] for s in report['series'])
    report['instancias_con_error']=report['instancias_total']-report['instancias_decodificadas_total']
    if selected:report['preparacion_privada']=selected
    return report

def selftest():
    fake={'ts':'1.2.840.10008.1.2.4.90','rows':2,'cols':2,'bits':16,'samples':1,'photo':'MONOCHROME2','frames':1}
    dat=np.array([[1,2],[3,400]],dtype=np.uint16)
    buf=io.BytesIO();Image.fromarray(dat).save(buf,format='JPEG2000',irreversible=False)
    code=buf.getvalue();head=lambda k:struct.pack('<HHI',0xfffe,0xe000,len(k))+k
    raw=head(b'')+head(code+(b'\0' if len(code)%2 else b''))+struct.pack('<HHI',0xfffe,0xe0dd,0)
    im,mode,n=decoder_one(raw,dict(fake,pixel={'offset':0,'length':0xffffffff}))
    assert np.array_equal(im,dat) and n==1
    return {'estado':'PASS','jp2k_lossless_roundtrip':True,'valores_pixeles_preservados':True,'matriz':[2,2]}

def main():
    p=argparse.ArgumentParser();p.add_argument('--entrada');p.add_argument('--reporte');p.add_argument('--preparar-serie');p.add_argument('--carpeta-privada');p.add_argument('--auto-prueba',action='store_true')
    x=p.parse_args()
    if x.auto_prueba:print(json.dumps(selftest()));return
    if not x.entrada or not x.reporte:p.error('Falta --entrada/--reporte')
    if Path(x.reporte).exists():p.error('El reporte ya existe; no se sobrescribe')
    if bool(x.preparar_serie)!=bool(x.carpeta_privada):p.error('Usar --preparar-serie junto con --carpeta-privada')
    result=validate_file(x.entrada,x.preparar_serie,x.carpeta_privada)
    with open(x.reporte,'x',encoding='utf-8') as f:json.dump(result,f,ensure_ascii=False,indent=2)
    print('Decodificadas',result['instancias_decodificadas_total'],'de',result['instancias_total'],'sin imágenes en el reporte')
if __name__=='__main__':main()