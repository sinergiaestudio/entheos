#!/usr/bin/env python3
"""ANATHEOS · Cardiac MR metadata-only, offline, privacy-safe preflight.

Does not extract or decode PixelData, copy DICOM, export thumbnails, or send requests.
Prints only anonymous counts and generic family labels. NOT a clinical viewer.
Requires locally installed pydicom >=3.0 (installed in the earlier LCTSC venv).
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import re
import sys
import zipfile

MAX_FILES = 100_000
MAX_ZIP_MEMBER = 512 * 1024 * 1024
MAX_ZIP_UNPACKED = 80 * 1024 * 1024 * 1024
NATIVE_TS = {
    '1.2.840.10008.1.2',
    '1.2.840.10008.1.2.1',
}
# Never export raw SeriesDescription, ProtocolName, UIDs, filenames or positions.
# Categories are intentionally broad, prioritizing specificity.
FAMILY_RULES = (
    ('realce_tardio_psir', (r'PSIR', r'LGE', r'LATE.{0,10}ENHANC', r'REALCE.{0,10}TARD')),
    ('perfusion_dinamica', (r'PERFUS', r'FIRST.{0,5}PASS')),
    ('t2_stir_black_blood', (r'(?:^|\W)T2.{0,15}STIR', r'STIR.{0,15}BB')),
    ('t1_black_blood', (r'T1.{0,15}(?:TSE|BLACK|BB)', r'BLACK.{0,5}BLOOD.{0,12}T1')),
    ('inversion_look_locker', (r'LOOK.{0,5}LOCK', r'IR.{0,4}TFE.{0,4}LL', r'2BEATS')),
    ('cine_eje_corto', (r'EJE.{0,5}CORTO', r'SHORT.{0,5}AXIS', r'\bSAX\b')),
    ('cine_camaras', (r'CAMARAS?', r'CHAMBERS?', r'FALSO.{0,5}[24]C', r'\b[234]C\b', r'\b[234]CH\b')),
    ('cine_salida_y_valvulas', (r'\bTSVD\b', r'\bRVOT\b', r'\bVAL.{0,3}AORT', r'AORTIC.{0,4}VALV')),
    ('survey_localizador', (r'\bSURVEY\b', r'\bSCOUT\b', r'LOCALIZ', r'\bLOC\b')),
    ('axial_anatomica', (r'\bAX(?:IAL)?\b', r'ESTRICTO', r'\bTRANSVERS\b')),
)


def family_from_text(text: str) -> str:
    normalized = re.sub(r'\s+', ' ', str(text or '').upper().replace('_', ' '))
    for category, expressions in FAMILY_RULES:
        if any(re.search(x, normalized) for x in expressions):
            return category
    return 'otra_por_verificar'


def safe_int(value, default=0) -> int:
    try:
        val = int(value)
        return val if 0 <= val <= 100000 else default
    except (TypeError, ValueError, OverflowError):
        return default


def safe_float(value):
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError, OverflowError):
        return None


def orientation_projection(ds):
    try:
        ori = [float(x) for x in ds.ImageOrientationPatient]
        pos = [float(x) for x in ds.ImagePositionPatient]
        if len(ori) != 6 or len(pos) != 3 or not all(map(math.isfinite, ori + pos)):
            return None, None
        row = ori[:3]
        col = ori[3:]
        cross = (
            row[1]*col[2]-row[2]*col[1],
            row[2]*col[0]-row[0]*col[2],
            row[0]*col[1]-row[1]*col[0],
        )
        mag = math.sqrt(sum(x*x for x in cross))
        if abs(mag-1.0) > .02:
            return None, None
        projection = sum(a*b for a,b in zip(pos, cross))
        # Deliberately don't export patient coordinates or orientation vectors.
        return tuple(round(v, 3) for v in ori), round(projection, 1)
    except (AttributeError, TypeError, ValueError, OverflowError):
        return None, None


def extract_metadata(ds) -> dict:
    def get(name, default=None):
        return getattr(ds, name, default)
    ori, projection = orientation_projection(ds)
    tx = str(getattr(get('file_meta', None), 'TransferSyntaxUID', '') or '')
    modality = str(get('Modality','') or '')
    sopclass = str(get('SOPClassUID','') or '')
    num_frames = max(1, safe_int(get('NumberOfFrames',1), 1))
    label = family_from_text(str(get('SeriesDescription','') or '') + ' ' + str(get('ProtocolName','') or ''))
    trigger = safe_float(get('TriggerTime'))
    temporal_pos = safe_int(get('TemporalPositionIdentifier'))
    pixels = str(get('PhotometricInterpretation','') or '')
    bits = safe_int(get('BitsAllocated'))
    multi = num_frames>1 or sopclass == '1.2.840.10008.5.1.4.1.1.4.1'
    return dict(
        _study=str(get('StudyInstanceUID','') or ''),
        _series=str(get('SeriesInstanceUID','') or ''),
        _sop=str(get('SOPInstanceUID','') or ''),
        _orientation=ori, _projection=projection,
        _trigger=(round(trigger, 2) if trigger is not None else None),
        _temporal=temporal_pos if temporal_pos else None,
        modality=modality, sopclass=sopclass,
        category=label, frames=num_frames, rows=safe_int(get('Rows')),
        cols=safe_int(get('Columns')), bits=bits, photo=pixels,
        transfer=tx, compressed=bool(tx and tx not in NATIVE_TS),
        enhanced=multi, spacing=tuple(round(float(v),3) for v in get('PixelSpacing',[]) )
        if get('PixelSpacing') is not None and len(get('PixelSpacing'))==2 else None,
    )


def summarize(records:list[dict], errors:Counter, examined:int) -> dict:
    studies = {r['_study'] for r in records if r['_study']}
    grouped=defaultdict(list)
    for i, r in enumerate(records):
        key = (r['_study'] or 'study_missing',r['_series'] or f'missing_{i}')
        grouped[key].append(r)
    ordered = sorted(grouped.values(),key=lambda items:(min(x['category'] for x in items),-len(items)))
    series=[]
    for number, items in enumerate(ordered,1):
        family=Counter(x['category'] for x in items).most_common(1)[0][0]
        orientation_set={x['_orientation'] for x in items if x['_orientation'] is not None}
        positions={x['_projection'] for x in items if x['_projection'] is not None}
        triggers={x['_trigger'] for x in items if x['_trigger'] is not None}
        temporal={x['_temporal'] for x in items if x['_temporal'] is not None}
        spacing={x['spacing'] for x in items if x['spacing'] is not None}
        dimensions={(x['rows'], x['cols']) for x in items}
        syntaxes={x['transfer'] for x in items}
        compressed=any(x['compressed'] for x in items)
        enhanced=any(x['enhanced'] for x in items)
        total_frames=sum(x['frames'] for x in items)
        instance_ids=[x['_sop'] for x in items if x['_sop']]
        duplicates=len(instance_ids)-len(set(instance_ids))
        spatial_steps=[]
        if len(positions)>1:
            sorted_positions=sorted(positions)
            spatial_steps=[round(b-a,3) for a,b in zip(sorted_positions,sorted_positions[1:])]
        regular=len(spatial_steps)>0 and max(spatial_steps)-min(spatial_steps)<0.15
        # Important: absence of timing metadata does NOT demonstrate static imaging.
        temporal_evidence=(len(triggers)>1 or len(temporal)>1 or
                         len(positions)<len(items) and len(positions)>0 or enhanced)
        dynamic_family=family.startswith('cine_') or family=='perfusion_dinamica'
        multiple_orient=len(orientation_set)>1
        geometry_check= 'suficiente_para_revisar' if len(orientation_set)==1 and positions and len(spacing)==1 else 'incompleta_o_mixta'
        simple_viewer=('1.2.840.10008.1.2.1' in syntaxes or '1.2.840.10008.1.2' in syntaxes) and (
            len(syntaxes)==1 and not compressed and not enhanced and
            all(x['bits']==16 and x['photo'] in ('MONOCHROME1','MONOCHROME2') for x in items))
        if compressed or enhanced:
            recommendation='requiere_decodificador_o_multiframe'
        elif dynamic_family or temporal_evidence:
            recommendation='visor_cine_o_4d_antes_de_reconstruir'
        elif geometry_check!='suficiente_para_revisar' or multiple_orient:
            recommendation='revisar_orientacion_y_espaciado'
        elif len(positions)>1 and regular:
            recommendation='candidato_volumen_3d_revisar_anatomia'
        else:
            recommendation='revisar_conjunto_de_imagenes_2d'
        series.append({
            'serie_local': f'RM-{number:03d}',
            'familia_probable': family,
            'instancias': len(items), 'fotogramas_declarados': total_frames,
            'identificadores_sop_duplicados': duplicates,
            'matrices': [{'filas':a,'columnas':b} for a,b in sorted(dimensions)],
            'formatos_transferencia': [
                'sin_compresion_LE' if x in NATIVE_TS else 'comprimida_o_no_compatible' for x in sorted(syntaxes)
            ],
            'frames_multiframe_o_enhanced': enhanced,
            'posiciones_espaciales_distintas': len(positions),
            'triggers_distintos': len(triggers),
            'posiciones_temporales_distintas': len(temporal),
            'evidencia_temporal': temporal_evidence,
            'espaciado_espacial_regular_aproximado': regular,
            'orientaciones_distintas': len(orientation_set),
            'geometria': geometry_check,
            'lectura_pixel_actual_preliminar': bool(simple_viewer),
            'ruta_tecnica': recommendation,
        })
    return {
        'esquema':'anatheos-cmr-preflight-v1',
        'fecha_utc':datetime.now(timezone.utc).strftime('%Y-%m-%d'),
        'privacidad':'Solo metadatos agregados; no contiene nombres, UIDs, rutas, descripciones originales, ni pixeles.',
        'es_una_revision_clinica':False,
        'informe_basado_en_archivos_reales':True,
        'archivos_examinados':examined,
        'instancias_dicom_reconocidas':len(records),
        'estudios_distintos_detectados':len(studies) or None,
        'series_detectadas':len(series),
        'errores_y_archivos_omitidos':dict(errors),
        'series':series,
        'advertencias':[
            'El numero de fotogramas DICOM no equivale necesariamente a cortes espaciales.',
            'No combinar cine, perfusion y PSIR sin identificar planos, tiempos y fases.',
            'La compatibilidad de la lectura de pixeles es preliminar, no una prueba de decodificacion.',
            'Las series MR no utilizan la escala HU de tomografia; una mascara de TC no es transferible por defecto.',
            'El informe no detecta ni caracteriza quistes ni tumores.'
        ],
    }


def walk_paths(input_path:Path, errors:Counter):
    examined=0
    if input_path.is_file():
        if not zipfile.is_zipfile(input_path):
            raise ValueError('Se necesita un ZIP con DICOM o una carpeta de DICOM.')
        with zipfile.ZipFile(input_path) as archive:
            members=[x for x in archive.infolist() if not x.is_dir()]
            if len(members)>MAX_FILES or sum(x.file_size for x in members)>MAX_ZIP_UNPACKED:
                raise ValueError('El ZIP supera los limites de seguridad. Dividir en series.')
            for info in members:
                examined+=1
                if info.flag_bits&1:
                    errors['archivo_cifrado_omitido']+=1;continue
                if info.file_size > MAX_ZIP_MEMBER:
                    errors['archivo_muy_grande_omitido']+=1;continue
                try:
                    with archive.open(info) as stream:
                        yield stream
                except (OSError, RuntimeError, EOFError, zipfile.BadZipFile):
                    errors['archivo_ilegible_omitido']+=1
    elif input_path.is_dir():
        for file in input_path.rglob('*'):
            if not file.is_file():continue
            examined+=1
            if examined>MAX_FILES:raise ValueError('Demasiados archivos. Seleccionar una carpeta por estudio.')
            if file.is_symlink():
                errors['enlace_simbolico_omitido']+=1;continue
            try:
                if file.stat().st_size>MAX_ZIP_MEMBER:
                    errors['archivo_muy_grande_omitido']+=1;continue
                with file.open('rb') as stream:
                    yield stream
            except (OSError, PermissionError):
                errors['archivo_ilegible_omitido']+=1
    else:
        raise ValueError('No encuentro el ZIP o la carpeta. Verificar la ruta.')
    errors['_files_examined']=examined


def scan(input_path:Path)->dict:
    try:
        import pydicom
        from pydicom.errors import InvalidDicomError
    except ImportError as exc:
        raise RuntimeError('Falta pydicom en este Python. Utilizar el entorno .venv de PREPARAR_MUESTRA_REAL.') from exc
    records=[];errors=Counter()
    for stream in walk_paths(input_path,errors):
        try:
            ds=pydicom.dcmread(stream,stop_before_pixels=True,force=False)
            modality=str(getattr(ds,'Modality',''))
            if modality !='MR':
                errors['omitido_no_mr_o_auxiliar']+=1;continue
            records.append(extract_metadata(ds))
        except InvalidDicomError:
            errors['omitido_no_dicom_part10']+=1
        except (OSError, ValueError, TypeError, EOFError, OverflowError, UnicodeError):
            errors['dicom_no_analizable_omitido']+=1
        except Exception:
            # Avoid emitting private content embedded in exception messages.
            errors['otro_error_de_metadatos']+=1
    examined=errors.pop('_files_examined',0)
    return summarize(records,errors,examined)


def selftest()->dict:
    assert family_from_text('EJE CORTO')=='cine_eje_corto'
    assert family_from_text('3 CAMARAS')=='cine_camaras'
    assert family_from_text('TSVD')=='cine_salida_y_valvulas'
    assert family_from_text('T1_TSE_BB')=='t1_black_blood'
    assert family_from_text('T2_STIR_BB')=='t2_stir_black_blood'
    assert family_from_text('Perfusion_shared_000')=='perfusion_dinamica'
    assert family_from_text('PSIR_TFE_BH SENSE')=='realce_tardio_psir'
    assert family_from_text('IR_TFE_LL_2beats')=='inversion_look_locker'
    class Fake:
        SeriesDescription='EJE CORTO'
        ProtocolName='cine'
        Modality='MR'
        SeriesInstanceUID='1.2.3'
        StudyInstanceUID='1.2.4'
        SOPInstanceUID='1.2.5'
        ImageOrientationPatient=[1,0,0,0,1,0]
        ImagePositionPatient=[0,0,0]
        PixelSpacing=[1.0,1.0]
        Rows=256;Columns=256;BitsAllocated=16;NumberOfFrames=1
        PhotometricInterpretation='MONOCHROME2'
        class file_meta:
            TransferSyntaxUID='1.2.840.10008.1.2.1'
    sample=extract_metadata(Fake())
    assert sample['category']=='cine_eje_corto'
    sample2=dict(sample);sample2['_sop']='1.2.6';sample2['_trigger']=35.0
    sample3=dict(sample);sample3['_sop']='1.2.7';sample3['_trigger']=70.0
    result=summarize([sample,sample2,sample3],Counter(),3)
    assert result['series_detectadas']==1
    assert result['series'][0]['ruta_tecnica']=='visor_cine_o_4d_antes_de_reconstruir'
    serial=json.dumps(result,ensure_ascii=False)
    for secret in ['1.2.3','1.2.4','1.2.5','PatientName','ImagePositionPatient']:
        assert secret not in serial, 'Sensitive identifier escaped'
    return {'estado':'PASS','ejemplos_sinteticos':3,'familias_probadas':8,
            'sin_identificadores_en_reporte':True,'sin_lectura_de_pixeles':True}


def main(argv=None):
    parser=argparse.ArgumentParser(description='Auditoria local de RM cardiaca: metadatos agregados y privacidad')
    parser.add_argument('--entrada',help='ZIP o carpeta DICOM original')
    parser.add_argument('--salida',help='Ruta de informe JSON sin identificadores')
    parser.add_argument('--auto-prueba',action='store_true',help='Test sintético sin archivos médicos ni pydicom')
    args=parser.parse_args(argv)
    if args.auto_prueba:
        print(json.dumps(selftest(),ensure_ascii=False,indent=2));return 0
    if not args.entrada or not args.salida:
        parser.error('--entrada y --salida son obligatorios sin --auto-prueba')
    try:
        report=scan(Path(args.entrada.strip().strip('"')))
        dest=Path(args.salida)
        dest.parent.mkdir(parents=True,exist_ok=True)
        if dest.exists():
            raise ValueError('Ya existe un informe con ese nombre. No se sobrescribio.')
        dest.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        print('OK: Inventario de RM cardíaca generado localmente.')
        print('Estudios:',report['estudios_distintos_detectados'],'Series:',report['series_detectadas'],
              'Instancias MR:',report['instancias_dicom_reconocidas'])
        print('El informe no incluye nombres, fechas de paciente, UIDs, rutas ni imagenes.')
        print('Revisar el JSON antes de compartirlo.')
        return 0
    except (RuntimeError,ValueError) as err:
        # Explicitly authored exceptions; never write source paths or DICOM metadata.
        print('No se completó el inventario:',str(err),file=sys.stderr)
        return 1
    except (OSError, zipfile.BadZipFile, PermissionError):
        print('No se completó: error al abrir el ZIP/carpeta o guardar el informe.',file=sys.stderr)
        return 1


if __name__=='__main__':
    sys.exit(main())