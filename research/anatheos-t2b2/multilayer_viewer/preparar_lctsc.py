#!/usr/bin/env python3
"""Generador local CT + RTSTRUCT LCTSC a NRRD multiclase alineado en LPS.
Libre, experimental y NO diagnóstico. No usa ninguna API comercial.
No sube ni transmite datos médicos. El único download opcional es fuente pública LCTSC.
"""
import argparse, hashlib, io, json, math, pathlib, urllib.request, zipfile
import numpy as np
from skimage.draw import polygon
import pydicom

URL='https://zenodo.org/records/4747795/files/LCTSC_DICOM_TestData.zip?download=1'
MD5='e472ce41106eb881264f2acb2f2bb1ca'
LIMIT=50*1024*1024
LABELS={'lungl':1,'leftlung':1,'lungr':2,'rightlung':2,
        'heart':3,'esophagus':4,'oesophagus':4,'spinalcord':5,'cord':5}
COLORS={1:'pulmón izquierdo',2:'pulmón derecho',3:'corazón',4:'esófago',5:'médula espinal'}

def write_nrrd(path, data, dirs, origin, is_mask=False):
    if data.ndim!=3:raise ValueError('Expected ZYX')
    z,y,x=data.shape
    typ='uchar' if is_mask else 'short'
    assert data.dtype == (np.uint8 if is_mask else np.int16)
    def vec(v):return '('+','.join(f'{float(n):.9f}' for n in v)+')'
    head=(f'NRRD0005\n# ANATHEOS same-case experimental mask; not diagnostic\n'
          f'type: {typ}\ndimension: 3\nsizes: {x} {y} {z}\nspace: left-posterior-superior\n'
          f'space directions: {vec(dirs[0])} {vec(dirs[1])} {vec(dirs[2])}\n'
          f'space origin: {vec(origin)}\nencoding: raw\nendian: little\n\n')
    with open(path,'wb') as f:
        f.write(head.encode('ascii'))
        f.write(data.tobytes(order='C'))

def load_zip(blob):
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        if z.testzip() is not None:raise ValueError('CRC ZIP inválido')
        entries=[e for e in z.infolist() if not e.is_dir()]
        if len(entries)>1000 or sum(e.file_size for e in entries)>400*1024*1024:
            raise ValueError('ZIP excede límites de seguridad')
        ct=[];rt=[]
        for e in entries:
            if e.file_size>8*1024*1024:raise ValueError('Archivo DICOM excede límite')
            raw=z.read(e)
            if len(raw)<132 or raw[128:132]!=b'DICM':continue
            ds=pydicom.dcmread(io.BytesIO(raw))
            if ds.Modality=='RTSTRUCT':rt.append(ds);continue
            if ds.Modality!='CT':continue
            if str(ds.file_meta.TransferSyntaxUID) not in ('1.2.840.10008.1.2','1.2.840.10008.1.2.1'):
                raise ValueError('Compresión DICOM no soportada')
            orient=np.asarray(ds.ImageOrientationPatient,float)
            pos=np.asarray(ds.ImagePositionPatient,float)
            spacing=np.asarray(ds.PixelSpacing,float)
            normal=np.cross(orient[:3],orient[3:])
            if not np.isfinite(pos).all() or not np.isfinite(orient).all() or not np.isfinite(spacing).all():
                raise ValueError('Posición u orientación inválida')
            if min(spacing)<=0 or not .99<float(np.linalg.norm(normal))<1.01:raise ValueError('Geometría incoherente')
            rawpixel=ds.pixel_array.astype(np.float32)
            slope=float(getattr(ds,'RescaleSlope',1));intercept=float(getattr(ds,'RescaleIntercept',0))
            hu=np.clip(np.rint(rawpixel*slope+intercept),-32768,32767).astype('<i2')
            ct.append({'img':hu,'ori':orient,'pos':pos,'spacing':spacing,'normal':normal,
                       'project':float(pos@normal),'sop':str(ds.SOPInstanceUID),
                       'frame':str(getattr(ds,'FrameOfReferenceUID','')),
                       'series':str(ds.SeriesInstanceUID)})
    if len(ct)<16 or len(rt)!=1:raise ValueError('Se requiere una TC y un RTSTRUCT del mismo caso')
    if len({v['series'] for v in ct})!=1:raise ValueError('Series CT mezcladas')
    ct.sort(key=lambda v:v['project'])
    sample=ct[0]
    if any(v['img'].shape!=sample['img'].shape or
           np.max(np.abs(v['ori']-sample['ori']))>.0005 or
           np.max(np.abs(v['spacing']-sample['spacing']))>.005 for v in ct):
        raise ValueError('Geometría distinta entre cortes')
    step=np.diff([v['project'] for v in ct])
    if min(step)<=0 or max(abs(step-np.median(step)))>.05:raise ValueError('Orden o espaciamiento irregular')
    step_vector=np.median(np.diff([v['pos'] for v in ct],axis=0),axis=0)
    origins=np.asarray([v['pos'] for v in ct]);reconstruction=sample['pos']+np.arange(len(ct))[:,None]*step_vector
    if np.max(abs(origins-reconstruction))>.1:raise ValueError('Las posiciones no forman una grilla affine regular')
    vol=np.stack([v['img'] for v in ct]).astype('<i2')
    dirs=np.stack([sample['ori'][:3]*sample['spacing'][1],
                   sample['ori'][3:]*sample['spacing'][0],step_vector])
    return ct,rt[0],vol,dirs,sample['pos']

def convert_masks(ct,rt,vol):
    number_to_label={int(x.ROINumber):LABELS.get(str(x.ROIName).lower().replace(' ','').replace('_',''),0)
                     for x in rt.StructureSetROISequence}
    uid_to_index={v['sop']:i for i,v in enumerate(ct)}
    frames={v['frame'] for v in ct}
    if not any(str(x.ReferencedFrameOfReferenceUID) in frames for x in rt.StructureSetROISequence):
        raise ValueError('RTSTRUCT sin referencia espacial al estudio CT')
    result=np.zeros(vol.shape,dtype=np.uint8);count=0
    for region in rt.ROIContourSequence:
        label=number_to_label.get(int(region.ReferencedROINumber),0)
        if not label:continue
        for item in getattr(region,'ContourSequence',[]):
            if str(getattr(item,'ContourGeometricType','')) not in ('CLOSED_PLANAR','CLOSEDPLANAR_XOR'):
                continue
            points=np.asarray(item.ContourData,float).reshape(-1,3)
            if len(points)<3 or not np.isfinite(points).all():raise ValueError('Polígono inválido')
            refs=[uid_to_index[str(q.ReferencedSOPInstanceUID)] for q in getattr(item,'ContourImageSequence',[])
                  if str(q.ReferencedSOPInstanceUID) in uid_to_index]
            if refs:
                if len(set(refs))!=1:raise ValueError('Contorno asociado a varios cortes')
                k=refs[0]
            else:
                k=int(np.argmin([abs(float(np.mean((points-v['pos'])@v['normal']))) for v in ct]))
            frame=ct[k]
            if np.max(abs((points-frame['pos'])@frame['normal']))>.75:
                raise ValueError('Contorno fuera de su plano geométrico')
            diff=points-frame['pos']
            x=diff@frame['ori'][:3]/frame['spacing'][1]
            y=diff@frame['ori'][3:]/frame['spacing'][0]
            rr,cc=polygon(y,x,shape=vol.shape[1:])
            # Parity preserves nested rings. Expert labels should not overlap.
            mask=(result[k,rr,cc]==label)
            if np.any((result[k,rr,cc]!=0)&(result[k,rr,cc]!=label)):
                raise ValueError('Dos órganos de referencia se superponen en la misma celda')
            result[k,rr,cc]=np.where(mask,0,label)
            count+=1
    if count<50 or any(np.count_nonzero(result==lab)<200 for lab in COLORS):
        raise ValueError('Faltan máscaras de referencia completas')
    return result,count

def main():
    p=argparse.ArgumentParser(description='CT LCTSC -> dos NRRD alineados para ANATHEOS')
    group=p.add_mutually_exclusive_group(required=True)
    group.add_argument('--zip',help='ZIP original LCTSC_DICOM_TestData.zip')
    group.add_argument('--download-public',action='store_true',help='Descarga pública oficial de Zenodo; gratuita')
    p.add_argument('--output',default='ESTUDIO_LCTSC_LOCAL')
    args=p.parse_args()
    if args.download_public:
        req=urllib.request.Request(URL,headers={'User-Agent':'ANATHEOS-Torax-Research/1.0'})
        with urllib.request.urlopen(req,timeout=120) as resp:blob=resp.read(LIMIT+1)
        if hashlib.md5(blob).hexdigest()!=MD5:raise ValueError('MD5 del ZIP oficial incorrecto')
    else:blob=pathlib.Path(args.zip).read_bytes()
    if len(blob)>LIMIT:raise ValueError('ZIP supera el límite 50 MB')
    slices,rt,volume,dirs,origin=load_zip(blob)
    mask,contours=convert_masks(slices,rt,volume)
    target=pathlib.Path(args.output);target.mkdir(parents=True,exist_ok=True)
    write_nrrd(target/'CT_HU_LPS.nrrd',volume,dirs,origin)
    write_nrrd(target/'LCTSC_RT_5_ORGANOS_LPS.nrrd',mask,dirs,origin,True)
    info={'fuente':'LCTSC / TCIA, CC BY 3.0, DOI 10.7937/K9/TCIA.2017.3R3FVZ08',
          'sha256_zip':hashlib.sha256(blob).hexdigest(), 'ct_shape_zyx':list(volume.shape),
          'contours_rasterized':contours,'labels':COLORS,'voxel_counts':{str(k):int((mask==k).sum()) for k in COLORS},
          'origin_LPS_mm':[float(v) for v in origin],'directions_LPS_mm':dirs.tolist(),
          'interpretacion':'Contornos RT expertos del mismo caso; NO predicción ni diagnóstico'}
    (target/'MANIFIESTO_LOCAL.json').write_text(json.dumps(info,ensure_ascii=False,indent=2),encoding='utf8')
    print('EXPORTACIÓN LOCAL EXITOSA',volume.shape,'contornos:',contours,'carpeta:',target)
    print('Ningún archivo fue transmitido a terceros.')

if __name__=='__main__':main()