#!/usr/bin/env python3
"""ANATHEOS CMR-R1: pure-Python, offline, metadata-only DICOM Part10 ZIP auditor.

No dependencies; does not execute embedded software, write original images,
read pixel values, extract files, upload data or emit PHI/UIDs/paths.
This is a conservative preflight, NOT a fully compliant DICOM decoder.
Copyright 2026. MIT licensed for this implementation.
"""
from __future__ import annotations
import argparse, collections, hashlib, io, json, math, os, re, struct, sys, zipfile
from pathlib import Path

MAX_MEMBERS=100000
MAX_TOTAL=80*1024**3
MAX_FILE=512*1024**2
MAX_ELEMENTS=50000
MAX_DEPTH=24
ENHANCED_MR='1.2.840.10008.5.1.4.1.1.4.1'
STANDARD_MR='1.2.840.10008.5.1.4.1.1.4'
GSPS='1.2.840.10008.5.1.4.1.1.11.1'
RAW_MR='1.2.840.10008.5.1.4.1.1.66'
NATIVE={'1.2.840.10008.1.2','1.2.840.10008.1.2.1','1.2.840.10008.1.2.2'}
TAGS={
 (0x0002,0x0010):'ts', (0x0008,0x0008):'image_type',
 (0x0008,0x0016):'sop_class', (0x0008,0x0018):'sop',
 (0x0008,0x0060):'modality',(0x0008,0x103E):'description',
 (0x0018,0x0020):'scan_sequence',(0x0018,0x0021):'sequence_variant',
 (0x0018,0x0022):'scan_options',(0x0018,0x0023):'acq_type',
 (0x0018,0x0050):'slice_thickness',(0x0018,0x0088):'slice_spacing',
 (0x0018,0x0080):'tr',(0x0018,0x0081):'te',(0x0018,0x0082):'ti',
 (0x0018,0x1030):'protocol',(0x0018,0x1060):'trigger',
 (0x0018,0x1062):'nominal_interval', (0x0018,0x1090):'cardiac_images',
 (0x0020,0x000D):'study',(0x0020,0x000E):'series',
 (0x0020,0x0011):'series_number',(0x0020,0x0013):'instance_number',(0x0020,0x0032):'ipp',
 (0x0020,0x0037):'iop',(0x0020,0x0052):'for_uid',
 (0x0020,0x0100):'temporal_pos', (0x0020,0x1041):'slice_location',
 (0x0028,0x0002):'samples',(0x0028,0x0004):'photo',
 (0x0028,0x0008):'frames',(0x0028,0x0010):'rows',
 (0x0028,0x0011):'cols',(0x0028,0x0030):'spacing',
 (0x0028,0x0100):'bits',(0x0028,0x0101):'bits_stored',
 (0x0028,0x0103):'signed',(0x0028,0x1052):'intercept',
 (0x0028,0x1053):'slope',(0x0028,0x1054):'rescale_type',
}
SQ_TAGS={(0x5200,0x9229),(0x5200,0x9230),(0x0020,0x9111),(0x0020,0x9113),
 (0x0020,0x9116),(0x0028,0x9110),(0x0018,0x9118)}
LONG_VR={b'OB',b'OD',b'OF',b'OL',b'OV',b'OW',b'SQ',b'UC',b'UR',b'UT',b'UN',b'SV',b'UV'}
NUM_VR={b'US':('H',2),b'SS':('h',2),b'UL':('I',4),b'SL':('i',4),b'FL':('f',4),b'FD':('d',8)}

class ParseProblem(Exception): pass

def parse_dicom(payload:bytes)->dict:
    if payload[128:132]!=b'DICM':raise ParseProblem('no_part10')
    f=io.BytesIO(payload);n=len(payload);f.seek(132);d={};elements=0;ts=None;pixel=None
    endian='<';explicit=True;stage='meta';seqs=[]
    while f.tell()+8<=n:
        elements+=1
        if elements>MAX_ELEMENTS:raise ParseProblem('demasiados_elementos')
        start=f.tell();a=f.read(4)
        group,elem=struct.unpack(endian+'HH',a)
        if stage=='meta' and group!=2:
            stage='dataset'
            if ts=='1.2.840.10008.1.2':explicit=False
            elif ts=='1.2.840.10008.1.2.2':endian='>'
            elif ts not in ('1.2.840.10008.1.2.1','1.2.840.10008.1.2', '1.2.840.10008.1.2.2'):
                # Encapsulated transfer syntaxes still use Explicit VR Little Endian tags.
                explicit=True
            f.seek(start);continue
        if group==0xFFFE:
            sz=struct.unpack(endian+'I',f.read(4))[0]
            if sz==0xffffffff:raise ParseProblem('item_indefinido_no_soportado')
            if f.tell()+sz>n:raise ParseProblem('item_fuera_del_archivo')
            f.seek(sz,1);continue
        if explicit:
            vr=f.read(2)
            if vr in LONG_VR:
                f.read(2);sz=struct.unpack(endian+'I',f.read(4))[0]
            elif vr in NUM_VR or (len(vr)==2 and all(65<=c<=90 for c in vr)):
                sz=struct.unpack(endian+'H',f.read(2))[0]
            else:raise ParseProblem('vr_invalido')
        else:
            vr=b'UN';sz=struct.unpack(endian+'I',f.read(4))[0]
        tag=(group,elem)
        if tag in SQ_TAGS: seqs.append('%04X%04X'%tag)
        if tag==(0x7fe0,0x0010) or tag==(0x7fe0,0x0008) or tag==(0x7fe0,0x0009):
            pixel={'offset':f.tell(),'length':sz,'vr':vr.decode('ascii','replace')}
            break
        if sz==0xffffffff:
            # Deliberately stop rather than guess location of subsequent tags.
            # Top-level compressed pixels are handled by pixel marker above.
            d['undefined_sequence_seen']=True
            break
        if f.tell()+sz>n:raise ParseProblem('longitud_fuera_del_archivo')
        if tag in TAGS and sz<=32768:
            val=f.read(sz)
            if vr in NUM_VR and sz in (2,4,8):
                d[TAGS[tag]]=struct.unpack(endian+NUM_VR[vr][0],val)[0]
            else:d[TAGS[tag]]=val.decode('ascii','replace').strip('\x00 \t\r\n')
            if tag==(0x0002,0x0010):ts=d['ts']
        else:f.seek(sz,1)
    d['ts']=ts or d.get('ts','')
    d['pixel']=pixel
    d['size']=n
    d['sq_seen']=sorted(set(seqs))
    d['metadata_complete']=not d.get('undefined_sequence_seen',False)
    if pixel and pixel['length']!=0xffffffff and pixel['offset']+pixel['length']>n:
        raise ParseProblem('pixel_truncado')
    return d

def numbers(v,required):
    try:
        vals=[float(x) for x in str(v).split('\\')]
        if len(vals)!=required or not all(map(math.isfinite,vals)):return None
        return vals
    except (ValueError, TypeError):return None

def projection(rec):
    ori=numbers(rec.get('iop'),6);pos=numbers(rec.get('ipp'),3)
    if ori is None or pos is None:return None,None
    r,c=ori[:3],ori[3:]
    dot=sum(a*b for a,b in zip(r,c)); nr=sum(x*x for x in r);nc=sum(x*x for x in c)
    if abs(dot)>.02 or abs(nr-1)>.02 or abs(nc-1)>.02:return None,None
    norm=(r[1]*c[2]-r[2]*c[1],r[2]*c[0]-r[0]*c[2],r[0]*c[1]-r[1]*c[0])
    return tuple(round(x,4) for x in ori),round(sum(a*b for a,b in zip(pos,norm)),3)

def family(rec):
    t=re.sub(r'\W+',' ',str(rec.get('description',''))+' '+str(rec.get('protocol',''))).upper()
    if re.search(r'PSIR|\bLGE\b|LATE ENHANC',t):return 'realce_tardio_psir'
    if re.search(r'PERFUS|FIRST PASS',t):return 'perfusion_dinamica'
    if re.search(r'T2.*STIR|STIR.*BB',t):return 't2_stir_black_blood'
    if re.search(r'T1.*(TSE|BLACK|BB)',t):return 't1_black_blood'
    if re.search(r'LOOK LOCK|IR TFE LL|2BEATS',t):return 'inversion_look_locker'
    if re.search(r'EJE CORTO|SHORT AXIS|\bSAX\b',t):return 'cine_eje_corto_probable'
    if re.search(r'CAMARAS|CHAMBERS|\b[234]C\b|\b[234]CH\b',t):
        for chamber in (2,3,4):
            if re.search(rf'\b{chamber}\s*(?:C|CH|CAMARA|CAMARAS|CHAMBER|CHAMBERS)\b',t):
                return f'cine_{chamber}_camaras'
        return 'cine_camaras_probable'
    if re.search(r'\bTSVD\b|\bRVOT\b|VAL AORT|AORTIC VALV',t):return 'salida_valvulas_probable'
    if re.search(r'SURVEY|SCOUT|LOCALIZ',t):return 'survey_localizador'
    if re.search(r'AX ESTRICTO|AXIAL|TRANSVERS',t):return 'axial_anatomica'
    return 'otra_por_verificar'

def numeric(v):
    try:
        if v is None:return None
        x=float(str(v));return x if math.isfinite(x) else None
    except (ValueError,TypeError):return None

def summarise(recs,counts,integrity,archive_size):
    studies={r.get('study') for r in recs if r.get('study')}
    grp=collections.defaultdict(list)
    for i,r in enumerate(recs):grp[(r.get('study') or 'missing_study',r.get('series') or f'missing_series_{i}')].append(r)
    # Stable series numbers within this exact archive, no sensitive series descriptors.
    groups=sorted(grp.values(),key=lambda v:(numeric(v[0].get('series_number')) or 0, family(v[0]), -len(v)))
    out=[]
    for idx,it in enumerate(groups,1):
        fam=collections.Counter(family(r) for r in it).most_common(1)[0][0]
        positions=set();orientations=set();spacings=set();trigger=set();temporal=set();inst_num=[]
        for r in it:
            o,p=projection(r)
            if o is not None:orientations.add(o)
            if p is not None:positions.add(p)
            s=numbers(r.get('spacing'),2)
            if s is not None:spacings.add(tuple(round(x,5) for x in s))
            t=numeric(r.get('trigger'))
            if t is not None:trigger.add(round(t,3))
            t=numeric(r.get('temporal_pos'))
            if t is not None:temporal.add(int(t))
            q=numeric(r.get('instance_number'))
            if q is not None and q>=0 and q.is_integer():inst_num.append(int(q))
        ds={(r.get('rows'),r.get('cols')) for r in it}
        pix={r.get('photo') for r in it}
        bits={numeric(r.get('bits')) for r in it}
        tran={r.get('ts','') for r in it}
        missing_pix=sum(r.get('pixel') is None for r in it)
        uid=[r.get('sop') for r in it if r.get('sop')]
        hashes=[r['_sha256'] for r in it]
        per_frame=sum(int(numeric(r.get('frames')) or 1) for r in it)
        enhanced=any(r.get('sop_class')==ENHANCED_MR or (numeric(r.get('frames')) or 1)>1 or '52009230' in r.get('sq_seen',[]) for r in it)
        img_num_gap=None
        if inst_num:
            nums=sorted(set(inst_num));img_num_gap=(nums[-1]-nums[0]+1)-len(nums)
        sorted_pos=sorted(positions)
        steps=[round(b-a,3) for a,b in zip(sorted_pos,sorted_pos[1:])]
        regular=len(steps)>0 and all(abs(x-steps[0])<.15 for x in steps) and steps[0]>.0001
        temporal_evidence=(len(trigger)>1 or len(temporal)>1 or (len(positions)>0 and len(positions)<len(it)) or enhanced)
        compressed=any(x not in NATIVE for x in tran)
        all_native=all(x in NATIVE for x in tran)
        simple_view=all_native and not enhanced and missing_pix==0 and bits=={16.0} and pix.issubset({'MONOCHROME1','MONOCHROME2'})
        dynamic_fam=fam.startswith('cine_') or fam in {'perfusion_dinamica','inversion_look_locker'}
        valid_volume=(simple_view and not dynamic_fam and not temporal_evidence and len(orientations)==1 and len(spacings)==1 and len(positions)>1 and len(positions)==len(it) and regular and len(ds)==1 and len(steps)>0)
        if missing_pix: route='revisar_no_pixel_data'
        elif enhanced:route='requiere_multiframe_y_dimension_indices'
        elif compressed:route='requiere_decodificador_transfer_syntax'
        elif dynamic_fam or temporal_evidence:route='visor_2d_cine_temporal'
        elif valid_volume:route='candidato_3d_tras_validacion_geometrica'
        else:route='visor_2d_revisar_geometria'
        out.append({
         'id':f'RM-{idx:03d}','familia_probable':fam,'instancias':len(it),
         'fotogramas_declarados':per_frame, 'matrices':[list(a) for a in sorted(ds,key=str)],
         'bits_allocated':sorted(bits,key=str),'photometric':sorted(x or '' for x in pix),
         'transfer_syntax_clases':sorted(set('nativa_implicit_LE' if x=='1.2.840.10008.1.2' else 'nativa_explicit_LE' if x=='1.2.840.10008.1.2.1' else 'nativa_big_endian' if x=='1.2.840.10008.1.2.2' else 'JPEG2000_lossless' if x=='1.2.840.10008.1.2.4.90' else 'comprimida_o_desconocida' for x in tran)),
         'enhanced_o_multiframe':enhanced,'posiciones_distintas':len(positions),
         'orientaciones_distintas':len(orientations),'pixel_spacing_distintos':len(spacings),
         'espaciado_mm': [list(x) for x in sorted(spacings)],
         'espaciado_entre_posiciones_mm_aprox': {'min':min(steps),'max':max(steps)} if steps else None,
         'triggers_distintos':len(trigger),'posiciones_temporales_distintas':len(temporal),
         'trigger_range_ms': [min(trigger),max(trigger)] if trigger else None,
         'evidencia_temporal':temporal_evidence,'cantidad_de_archivos_sin_pixel_data':missing_pix,
         'uids_sop_repetidos':len(uid)-len(set(uid)),
         'serie_numero_dicom':it[0].get('series_number'),
         'archivos_duplicados_binarios':len(hashes)-len(set(hashes)),
         'gaps_en_instance_number_no_concluyentes':img_num_gap,
         'geometria_3d_regular_candidata':valid_volume,
         'pixel_16bits_nativo_visor_preliminar':simple_view,
         'ruta_anatheos':route,'verificacion_de_pixel_data':'longitud_sin_decodificar'
        })
    return {'esquema':'ANATHEOS-CMR-R1-metadata-v1',
       'privacidad':'Reporte agregado: no incluye nombres, UIDs, rutas, descripciones originales, fechas clinicas ni coordenadas absolutas.',
       'inspeccion_píxeles':False,'archivo_zip_bytes':archive_size,
       'miembros_zip':integrity['total'],'crc_zip_ok':integrity['crc_ok'],
       'integridad_semantica_dicom':'preliminar_sin_decodificacion_de_pixeles',
       'dicom_part10_firma':counts['dicom_part10_firma'],'archivos_auxiliares':counts['auxiliares'],
       'dicom_mr_imagenes_analizadas':len(recs), 'estudios_distintos':len(studies),
       'series_detectadas':len(out),'modalidades_detectadas':dict(counts['modalidades']),
       'errores_y_exclusiones':dict(counts['errores']),
       'advertencias':['Las instancias NO equivalen necesariamente a imágenes, cortes o fases.',
       'Una geometria aparentemente regular no demuestra un volumen anatómico válido.',
       'No se inspeccionó contenido de píxeles ni se verificó información personal quemada.',
       'Las series Enhanced requieren análisis de Functional Groups por fotograma.',
       'Los gaps en InstanceNumber NO demuestran pérdida de archivos.'],
       'series':out}

def audit_zip(input_path:Path):
    if not zipfile.is_zipfile(input_path):raise ValueError('El archivo no es ZIP.')
    counts={'modalidades':collections.Counter(),'errores':collections.Counter(),'dicom_part10_firma':0,'auxiliares':0}
    recs=[];seen_study=set();total=0
    with zipfile.ZipFile(input_path) as z:
        members=z.infolist()
        if len(members)>MAX_MEMBERS:raise ValueError('Demasiados miembros ZIP.')
        if sum(x.file_size for x in members)>MAX_TOTAL:raise ValueError('ZIP demasiado grande.')
        if any(x.flag_bits & 1 for x in members):counts['errores']['archivos_cifrados_no_leidos']+=sum(bool(x.flag_bits&1) for x in members)
        crc_ok=True
        for info in members:
            if info.is_dir():continue
            if info.flag_bits & 1:continue
            if info.file_size>MAX_FILE:
                counts['errores']['miembro_supera_limite']+=1;continue
            try:
                with z.open(info) as f:data=f.read(MAX_FILE+1)
                if len(data)>MAX_FILE:raise ValueError('archivo_grande')
            except (OSError,RuntimeError,zipfile.BadZipFile,EOFError,ValueError):
                counts['errores']['crc_o_lectura_incorrecta']+=1;crc_ok=False;continue
            if data[128:132]!=b'DICM':counts['auxiliares']+=1;continue
            counts['dicom_part10_firma']+=1
            try:r=parse_dicom(data)
            except ParseProblem as e:counts['errores']['dicom_'+str(e)]+=1;continue
            modality=r.get('modality') or 'sin_modalidad'
            counts['modalidades'][modality if modality in {'MR','CT','US','XA','CR','DX','SR','SEG','RTSTRUCT'} else 'otra_o_sin_modalidad']+=1
            if modality!='MR':continue
            if r.get('sop_class') not in (STANDARD_MR,ENHANCED_MR):
                if r.get('sop_class')==GSPS:counts['errores']['objetos_gsps_no_imagen']+=1
                elif r.get('sop_class')==RAW_MR:counts['errores']['objetos_raw_data_no_imagen']+=1
                else:counts['errores']['objetos_mr_otros_no_imagen']+=1
                continue
            r['_sha256']=hashlib.sha256(data).hexdigest();recs.append(r)
        integrity={'total':len(members),'crc_ok':crc_ok}
    return summarise(recs,counts,integrity,input_path.stat().st_size)

def selftest():
    def part10(**k):
        def e(tag,vr,value):
            b=value if isinstance(value,bytes) else str(value).encode('ascii')
            if len(b)%2:b+=b' '
            if vr in ('OW','OB','SQ'):return struct.pack('<HH2s2sI',*tag,vr.encode(),b'\0\0',len(b))+b
            return struct.pack('<HH2sH',*tag,vr.encode(),len(b))+b
        b=b'\0'*128+b'DICM'+e((2,0x10),'UI','1.2.840.10008.1.2.1')
        b+=e((8,0x60),'CS','MR')+e((8,0x103E),'LO',k.get('name','EJE CORTO'))
        b+=e((0x20,0x0d),'UI','1.2.3.4')+e((0x20,0x0e),'UI','1.2.3.5')+e((8,0x18),'UI',k.get('sop','1.2.3.6'))
        b+=e((0x28,0x10),'US',struct.pack('<H',8))+e((0x28,0x11),'US',struct.pack('<H',8))
        b+=e((0x28,0x100),'US',struct.pack('<H',16))+e((0x28,0x04),'CS','MONOCHROME2')
        b+=e((0x20,0x32),'DS','0\\0\\0')+e((0x20,0x37),'DS','1\\0\\0\\0\\1\\0')+e((0x28,0x30),'DS','1\\1')
        b+=e((0x18,0x1060),'DS',k.get('trigger','20'))
        b+=e((0x7fe0,0x0010),'OW',b'\0'*128)
        return b
    a=parse_dicom(part10());b=parse_dicom(part10(sop='1.2.3.7',trigger='40'))
    assert a['modality']=='MR' and a['rows']==8 and a['cols']==8 and a['pixel']
    assert family(a)=='cine_eje_corto_probable'
    a['_sha256']='a';b['_sha256']='b'
    s=summarise([a,b],{'modalidades':collections.Counter({'MR':2}),'errores':collections.Counter(),'dicom_part10_firma':2,'auxiliares':0},{'total':2,'crc_ok':True},0)
    assert s['series_detectadas']==1 and s['series'][0]['evidencia_temporal']
    assert s['series'][0]['ruta_anatheos']=='visor_2d_cine_temporal'
    t=json.dumps(s)
    assert not any(x in t for x in ['1.2.3.4','1.2.3.5','1.2.3.6','ImagePositionPatient'])
    return {'estado':'PASS','dicom_sinteticos':2,'privacidad_reporte':True,'es_metadatos_sin_decodificacion':True}

def main():
    p=argparse.ArgumentParser(description='ANATHEOS · auditoría local ZIP DICOM Part10, sin dependencias')
    p.add_argument('--entrada',help='ZIP original')
    p.add_argument('--salida',help='informe JSON sanitizado (no sobrescribe)')
    p.add_argument('--auto-prueba',action='store_true')
    a=p.parse_args()
    if a.auto_prueba:print(json.dumps(selftest(),ensure_ascii=False));return
    if not a.entrada or not a.salida:p.error('Se requieren --entrada y --salida')
    try:
        dest=Path(a.salida)
        if dest.exists():raise ValueError('La salida ya existe; no se sobrescribe.')
        report=audit_zip(Path(a.entrada))
        dest.parent.mkdir(parents=True,exist_ok=True)
        with dest.open('x',encoding='utf-8') as f:json.dump(report,f,ensure_ascii=False,indent=2)
        print('OK. DICOM MR:',report['dicom_mr_imagenes_analizadas'],'Series:',report['series_detectadas'])
        print('El reporte no incluye rutas, UIDs ni descripciones originales. Revisar antes de compartir.')
    except (ValueError,OSError,zipfile.BadZipFile):
        print('Error de entrada/salida o ZIP. No se publicaron detalles clínicos.',file=sys.stderr)
        sys.exit(1)
if __name__=='__main__':main()