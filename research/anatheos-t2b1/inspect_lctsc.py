#!/usr/bin/env python3
"""ANATHEOS T2-B1: ephemeral de-identified CT/RTSTRUCT LCTSC pair preflight."""
import collections, hashlib, io, json, math, urllib.request, zipfile
import pydicom
URL='https://zenodo.org/records/4747795/files/LCTSC_DICOM_TestData.zip?download=1'
MD5='e472ce41106eb881264f2acb2f2bb1ca'
def run():
 req=urllib.request.Request(URL,headers={'User-Agent':'ANATHEOS-3D-noncommercial-LCTSC-preflight/1.0'})
 with urllib.request.urlopen(req,timeout=75) as r: data=r.read(45*1024*1024+1)
 if len(data)>45*1024*1024: raise ValueError('Download limit exceeded')
 if hashlib.md5(data).hexdigest()!=MD5: raise ValueError('Official Zenodo MD5 mismatch')
 with zipfile.ZipFile(io.BytesIO(data)) as z:
  if z.testzip() is not None: raise ValueError('CRC mismatch')
  entries=[m for m in z.infolist() if not m.is_dir()]
  if len(entries)>2000 or sum(m.file_size for m in entries)>600*1024*1024:raise ValueError('Unpacked size limit')
  modalities=collections.Counter(); ct=[]; rt=[];aux=0
  for entry in entries:
   if entry.file_size>8*1024*1024:raise ValueError('DICOM member size limit')
   raw=z.read(entry)
   if len(raw)<132 or raw[128:132]!=b'DICM':aux+=1;continue
   ds=pydicom.dcmread(io.BytesIO(raw),stop_before_pixels=True)
   modality=str(getattr(ds,'Modality','Unknown'));modalities[modality]+=1
   if modality=='CT':
    orientation=[float(x) for x in ds.ImageOrientationPatient]
    position=[float(x) for x in ds.ImagePositionPatient]
    spacing=[float(x) for x in ds.PixelSpacing]
    values=orientation+position+spacing+[float(getattr(ds,'RescaleSlope',1)),float(getattr(ds,'RescaleIntercept',0))]
    if not all(math.isfinite(x) for x in values) or min(spacing)<=0:raise ValueError('Invalid geometric values')
    if int(ds.BitsAllocated)!=16 or int(ds.SamplesPerPixel)!=1:raise ValueError('Unexpected pixel format')
    ct.append({'series':str(ds.SeriesInstanceUID),'frame':str(getattr(ds,'FrameOfReferenceUID','')),
      'sop':str(ds.SOPInstanceUID),'shape':[int(ds.Rows),int(ds.Columns)],
      'spacing':spacing,'pos':position,'orient':orientation,
      'syntax':str(ds.file_meta.TransferSyntaxUID)})
   if modality=='RTSTRUCT':
    rois=collections.Counter()
    frames=set()
    contour_sops=set();contours=0
    for roi in getattr(ds,'StructureSetROISequence',[]):
     n=str(getattr(roi,'ROIName','')).lower().replace(' ','').replace('_','')
     label={'lungl':'Left_Lung','leftlung':'Left_Lung','lungr':'Right_Lung','rightlung':'Right_Lung',
       'heart':'Heart','esophagus':'Esophagus','oesophagus':'Esophagus',
       'spinalcord':'Spinal_Cord','cord':'Spinal_Cord'}.get(n,'Other_or_Unmapped')
     rois[label]+=1;frames.add(str(getattr(roi,'ReferencedFrameOfReferenceUID','')))
    for roi in getattr(ds,'ROIContourSequence',[]):
     for c in getattr(roi,'ContourSequence',[]):
      contours+=1
      for image in getattr(c,'ContourImageSequence',[]):contour_sops.add(str(image.ReferencedSOPInstanceUID))
    rt.append({'rois':dict(rois),'frames':frames,'refs':contour_sops,'contours':contours})
  byseries=collections.defaultdict(list)
  for c in ct:byseries[c['series']].append(c)
  ct_frames={c['frame'] for c in ct};ct_sops={c['sop'] for c in ct}
  summaries=[]
  for vals in byseries.values():
   first=vals[0];a=first['orient'][:3];b=first['orient'][3:]
   normal=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
   p=sorted(sum(x*y for x,y in zip(c['pos'],normal)) for c in vals)
   steps=[q-r for r,q in zip(p,p[1:])]
   summaries.append({'count':len(vals),'shape':first['shape'],'spacing':first['spacing'],
     'step_mm_range':[round(min(steps),5),round(max(steps),5)] if steps else [],
     'transfer_syntax':first['syntax']})
  matched=sum(len(s['refs']&ct_sops) for s in rt)
  result={'case':'CT-T2B1','source':'Zenodo 4747795 CC BY 3.0 original TCIA LCTSC',
    'original_zip_sha256':hashlib.sha256(data).hexdigest(),'zenodo_md5_verified':True,
    'download_bytes':len(data),'zip_entries':len(entries),'non_dicom_members':aux,
    'modalities':dict(modalities),'ct_series':summaries,
    'ct_images':len(ct),'rtstruct_count':len(rt),'roi_labels':[x['rois'] for x in rt],
    'contours_per_rtstruct':[x['contours'] for x in rt],
    'rtstruct_matches_any_ct_frame':any(bool(s['frames']&ct_frames) for s in rt),
    'same_case_contour_references':matched,
    'gate':'PAIRED_REFERENCE_AVAILABLE' if matched>0 and ct and rt else 'PAIRING_NOT_YET_ESTABLISHED',
    'no_original_data_retained':True,'patient_identifiers_logged':False}
  print('ANATHEOS_T2B1_SANITIZED_RESULT='+json.dumps(result,sort_keys=True),flush=True)
run()
