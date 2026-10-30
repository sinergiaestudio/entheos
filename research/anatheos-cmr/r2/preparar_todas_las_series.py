#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ANATHEOS CMR-R2. Full LOCAL JPEG2000 lossless classic-MR study ingestion.

Neither source data nor reconstructed pixel buffers are transferred to the network.
Uses the audited CMR-R1 Part10 parser and Pillow JPEG2000 decoder. Never executes
files within the original ZIP. Generated data must be kept in a PRIVATE folder.
"""
from __future__ import annotations
import argparse, collections, hashlib, json, os, re, shutil, sys, time, zipfile
from pathlib import Path
import numpy as np
from PIL import features
from auditar_dicom_offline import parse_dicom, projection, numbers, numeric, family, STANDARD_MR, ENHANCED_MR
from validar_jpeg2000_local import decoder_one

SCHEMA='anatheos-cmr-r2-private-v1'
LIMIT_MEMBERS=50000
LIMIT_UNPACKED=3*1024**3
LIMIT_MEMBER=75*1024**2
LIMIT_FRAMES_PER_SERIES=10000
LIMIT_VOX_PER_SERIES=170_000_000
EXPECTED_MATRIX=None
J2K='1.2.840.10008.1.2.4.90'

def atomic_json(path,object):
    tmp=path.with_suffix(path.suffix+'.partial')
    if tmp.exists():tmp.unlink()
    try:
        with tmp.open('x',encoding='utf-8') as f:
            json.dump(object,f,ensure_ascii=False,indent=2)
        tmp.replace(path)
    finally:
        if tmp.exists():tmp.unlink()

def sha256_file(path:Path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(2**20),b''):h.update(chunk)
    return h.hexdigest()

def inspect_archive(z:zipfile.ZipFile):
    inf=[m for m in z.infolist() if not m.is_dir()]
    if len(inf)>LIMIT_MEMBERS or sum(m.file_size for m in inf)>LIMIT_UNPACKED:
        raise ValueError('ZIP excede límites de miembros o tamaño expandido')
    for m in inf:
        if m.flag_bits&1 or m.file_size>LIMIT_MEMBER:
            raise ValueError('Archivo cifrado o demasiado grande para el procesador')
        if m.compress_size and m.file_size/m.compress_size>500:
            raise ValueError('ZIP contiene miembro con expansión excesiva')
    return inf

def get_catalog(z):
    group=collections.defaultdict(list); errors=collections.Counter()
    entries=inspect_archive(z)
    for i,entry in enumerate(entries):
        try:
            with z.open(entry) as fd:
                raw=fd.read(LIMIT_MEMBER+1)
            if len(raw)>LIMIT_MEMBER:raise ValueError('too_large')
            if len(raw)<132 or raw[128:132]!=b'DICM':
                errors['auxiliary_not_dicom']+=1;continue
            metadata=parse_dicom(raw)
            if metadata.get('modality')!='MR' or metadata.get('sop_class') not in (STANDARD_MR,ENHANCED_MR):
                errors['dicom_non_mr_image']+=1;continue
            key=(metadata.get('study') or 'missing_study',metadata.get('series') or f'missing_series_{i}')
            group[key].append((entry,metadata))
        except (ValueError,TypeError,OSError,RuntimeError,OverflowError,EOFError):
            errors['metadata_error']+=1
    # EXACT same ordering as R1, including the SeriesNumber sort, with no PHI in output.
    groups=sorted(group.values(),key=lambda v:(numeric(v[0][1].get('series_number')) or 0,
        family(v[0][1]),-len(v)))
    return [(f'RM-{j:03d}',items) for j,items in enumerate(groups,1)],errors,len(entries)

def frame_record(r,raw):
    return {
      'instance_number':r.get('instance_number'),
      'source_sha256':hashlib.sha256(raw).hexdigest(),
      'sop_class':r.get('sop_class'),'transfer_syntax':r.get('ts'),
      'image_position_patient_LPS_mm':numbers(r.get('ipp'),3),
      'image_orientation_patient_LPS':numbers(r.get('iop'),6),
      'pixel_spacing_row_col_mm':numbers(r.get('spacing'),2),
      'trigger_time_ms':numeric(r.get('trigger')),
      'temporal_position_identifier':numeric(r.get('temporal_pos')),
      'image_type':r.get('image_type'),
      'rescale_slope':numeric(r.get('slope')),
      'rescale_intercept':numeric(r.get('intercept')),
      'photometric_interpretation':r.get('photo')
    }

def mode_family(fam):
    if fam.startswith('cine_') or fam=='salida_valvulas_probable':return 'cine_provisional'
    if fam=='perfusion_dinamica':return 'perfusion_temporal'
    if fam=='inversion_look_locker':return 'inversion_no_cine'
    if fam=='realce_tardio_psir':return 'psir_multicontraste_no_cine'
    if fam=='survey_localizador':return 'localizador_2d'
    return 'pila_2d_revisar_3d'

def series_statistics(items):
    positions=set();orientations=set();triggers=set();temporal=set();spacings=set()
    shapes=set();syntaxes=set()
    for _,r in items:
        o,p=projection(r)
        if o is not None:orientations.add(o)
        if p is not None:positions.add(p)
        x=numbers(r.get('spacing'),2)
        if x is not None:spacings.add(tuple(round(float(k),5) for k in x))
        t=numeric(r.get('trigger'))
        if t is not None:triggers.add(round(t,3))
        t=numeric(r.get('temporal_pos'))
        if t is not None:temporal.add(int(t))
        shapes.add((r.get('rows'),r.get('cols')))
        syntaxes.add(r.get('ts'))
    return {
      'posiciones_distintas':len(positions),
      'orientaciones_distintas':len(orientations),
      'marcadores_temporales_distintos':len(triggers),
      'identificadores_temporales_distintos':len(temporal),
      'espaciados_de_pixel_distintos':len(spacings),
      'matrices_distintas':len(shapes),
      'transferencias_distintas':len(syntaxes),
      'candidato_3d':False,
      'nota':'Estadísticas descriptivas; temporal/3D sin validación clínica.'
    }

def convert_series(z,identifier,items,dest_root,original_sha,existing_ok=False):
    folder=dest_root/identifier
    if folder.exists():
        if not existing_ok:raise ValueError('La carpeta de la serie ya existe; no se sobrescribe')
        try:
            data=json.loads((folder/'geometria_privada.json').read_text(encoding='utf-8'))
            pixels=np.load(folder/'pixels_original_decoded.npy',mmap_mode='r',allow_pickle=False)
            integrity=json.loads((folder/'integridad_R2.json').read_text(encoding='utf-8'))
            good=(data.get('source_zip_sha256')==original_sha and data.get('serie_local')==identifier
                  and integrity.get('source_zip_sha256')==original_sha
                  and integrity.get('pixels_sha256')==sha256_file(folder/'pixels_original_decoded.npy')
                  and integrity.get('geometria_sha256')==sha256_file(folder/'geometria_privada.json')
                  and len(data.get('frames',[]))==len(items) and len(pixels)==len(items)
                  and pixels.ndim==3 and pixels.dtype==np.dtype('<u2'))
            del pixels
            if good:
                return {'serie_local':identifier,'estado':'preparada','origen':'reanudada_validada',
                  'instancias':len(items),'familia_probable':family(items[0][1]),
                  'modo_seguro':mode_family(family(items[0][1]))}
        except (OSError,ValueError,KeyError,TypeError):pass
        raise ValueError('La serie existente no coincide; conservarla y elegir nueva carpeta de salida')
    if len(items)>LIMIT_FRAMES_PER_SERIES:raise ValueError('Límite de fotogramas por serie')
    shapes={(int(numeric(r.get('rows')) or 0),int(numeric(r.get('cols')) or 0)) for _,r in items}
    if len(shapes)!=1:raise ValueError('Dimensiones mixtas; hace falta separar subseries')
    height,width=next(iter(shapes))
    if height<2 or width<2 or height*width*len(items)>LIMIT_VOX_PER_SERIES:
        raise ValueError('Matriz de imágenes excede límites')
    # Do not load images until the type and transfer syntax checks have been made.
    sop_list=[r.get('sop') for _,r in items]
    if any(not value for value in sop_list) or len(set(sop_list))!=len(sop_list):
        raise ValueError('SOPInstanceUID ausente o repetido dentro de la serie')
    for _,r in items:
        if r.get('sop_class')!=STANDARD_MR or r.get('ts')!=J2K or int(numeric(r.get('frames')) or 1)!=1:
            raise ValueError('Secuencia Enhanced/multiframe o transferencia no admitida aún')
        if int(numeric(r.get('bits')) or 0)!=16 or r.get('photo') not in ('MONOCHROME1','MONOCHROME2'):
            raise ValueError('Formato de píxel no validado')
        if not r.get('pixel'):raise ValueError('Falta PixelData')
    staging=dest_root/(f'.{identifier}.processing')
    if staging.exists():shutil.rmtree(staging)
    staging.mkdir(parents=False,exist_ok=False)
    try:
        array=np.empty((len(items),height,width),dtype='<u2')
        metadata=[]
        for i,(member,r) in enumerate(items):
            with z.open(member) as fd:raw=fd.read(LIMIT_MEMBER+1)
            if len(raw)>LIMIT_MEMBER:raise ValueError('Archivo demasiado grande')
            im,_,_=decoder_one(raw,r)
            if im.shape!=(height,width) or im.dtype!=np.uint16:
                raise ValueError('Se requiere uint16 exacto, sin conversión de signo o escala')
            array[i]=im
            metadata.append(frame_record(r,raw))
        np.save(staging/'pixels_original_decoded.npy',array,allow_pickle=False)
        del array
        rec={
          'schema':SCHEMA,'serie_local':identifier,'source_zip_sha256':original_sha,
          'procedencia':'DICOM JPEG2000 lossless, orden de origen; sin resampling ni LUT aplicada',
          'frames':metadata,'warning':'DATOS MEDICOS PRIVADOS. NO PUBLICAR NI SUBIR A GITHUB.'}
        atomic_json(staging/'geometria_privada.json',rec)
        atomic_json(staging/'integridad_R2.json',{
          'schema':'anatheos-cmr-r2-integrity-v1','source_zip_sha256':original_sha,
          'pixels_sha256':sha256_file(staging/'pixels_original_decoded.npy'),
          'geometria_sha256':sha256_file(staging/'geometria_privada.json')})
        # Verify written payload before making a series visible in the catalog.
        check=np.load(staging/'pixels_original_decoded.npy',mmap_mode='r',allow_pickle=False)
        if check.shape!=(len(items),height,width) or check.dtype!=np.dtype('uint16'):
            raise ValueError('Verificación de archivo NPY falló')
        del check
        staging.replace(folder)
        return {'serie_local':identifier,'estado':'preparada','origen':'generada',
            'instancias':len(items),'familia_probable':family(items[0][1]),
            'modo_seguro':mode_family(family(items[0][1])),'matriz':[height,width]}
    finally:
        if staging.exists():shutil.rmtree(staging)

def make_catalog(records,original_sha,examined,skipped):
    return {'schema':SCHEMA,'origen_zip_sha256_PRIVADO':original_sha,
     'advertencia':'INDICE CLINICO PRIVADO. No es anonimizacion completa. No compartir.',
     'fases_y_cortes':'No confundir fotogramas temporales con volumen 3D. No fusionar series ni atribuir diagnosticos.',
     'archivos_examinados':examined,'auxiliares_y_omisiones':dict(skipped),
     'series_detectadas':len(records), 'series_preparadas':sum(x.get('estado')=='preparada' for x in records),
     'instancias_preparadas':sum(int(x.get('instancias',0)) for x in records if x.get('estado')=='preparada'),
     'series':records}

def main(argv=None):
    p=argparse.ArgumentParser(description='ANATHEOS CMR-R2: preparar localmente 24 series JPEG2000')
    p.add_argument('--entrada',required=True,help='ZIP DICOM ORIGINAL de la RM cardíaca')
    p.add_argument('--destino',required=True,help='carpeta PRIVADA de salida, distinta de la fuente')
    p.add_argument('--reanudar',action='store_true',help='verificar y conservar series existentes')
    p.add_argument('--esperar-series',type=int,default=0,help='control opcional de cantidad esperada, ej. 24')
    p.add_argument('--esperar-imagenes',type=int,default=0,help='control opcional de imágenes esperadas, ej. 1318')
    args=p.parse_args(argv)
    input_file=Path(args.entrada).resolve();output=Path(args.destino).resolve()
    if not input_file.is_file() or not zipfile.is_zipfile(input_file):
        print('ERROR: se requiere el ZIP DICOM original',file=sys.stderr);return 2
    if output==input_file.parent or input_file in output.parents or output in input_file.parents:
        print('ERROR: elegí una carpeta de salida PRIVADA e independiente del original',file=sys.stderr);return 2
    if not features.check('jpg_2000'):
        print('ERROR: el Pillow local no admite JPEG2000 lossless',file=sys.stderr);return 2
    if output.exists() and not args.reanudar:
        print('ERROR: la carpeta de salida existe; elegí otra o --reanudar',file=sys.stderr);return 2
    output.mkdir(parents=True,exist_ok=True)
    original_sha=sha256_file(input_file)
    with zipfile.ZipFile(input_file) as z:
        groups,excluded,examined=get_catalog(z)
        count=sum(len(v) for _,v in groups)
        if args.esperar_series and len(groups)!=args.esperar_series:
            print('ERROR: el número de series no coincide; no se exporta',file=sys.stderr);return 2
        if args.esperar_imagenes and count!=args.esperar_imagenes:
            print('ERROR: cantidad de imágenes distinta; no se exporta',file=sys.stderr);return 2
        print(f'Inventario local: {len(groups)} series, {count} MR, {examined} miembros (sin revelar identificadores).',flush=True)
        records=[]
        for identifier,items in groups:
            print(f'Preparando {identifier} [{len(items)} instancias]…',flush=True)
            try:
                item=convert_series(z,identifier,items,output,original_sha,existing_ok=args.reanudar)
                print(f'{identifier}: {item["estado"]} ({item["origen"]})',flush=True)
            except (ValueError,TypeError,RuntimeError,OSError,OverflowError,zipfile.BadZipFile):
                item={'serie_local':identifier,'estado':'bloqueada','instancias':len(items),
                  'familia_probable':family(items[0][1]),'modo_seguro':mode_family(family(items[0][1])),
                  'motivo_generico':'No pudo decodificarse o no pasó controles; ver DICOM local sin compartir'}
                print(f'{identifier}: BLOQUEADA; el resto continuará',flush=True)
            item.update(series_statistics(items))
            records.append(item)
            atomic_json(output/'catalogo_local_privado.json',make_catalog(records,original_sha,examined,excluded))
    summary={'schema':'anatheos-cmr-r2-sanitizado','series_detectadas':len(records),
      'series_preparadas':sum(x['estado']=='preparada' for x in records),
      'instancias_preparadas':sum(x['instancias'] for x in records if x['estado']=='preparada'),
      'errores_por_serie':sum(x['estado']!='preparada' for x in records),
      'modos_de_serie':dict(collections.Counter(x['modo_seguro'] for x in records)),
      'fuente_original_intacta':True,'no_hay_3d_ni_4d_validado':True,
      'sin_pixel_data_o_metadatos_privados_en_reporte':True}
    atomic_json(output/'resumen_sanitizado.json',summary)
    print('RESULTADO_R2='+json.dumps(summary,ensure_ascii=False,sort_keys=True),flush=True)
    return 0 if summary['errores_por_serie']==0 else 1
if __name__=='__main__':sys.exit(main())