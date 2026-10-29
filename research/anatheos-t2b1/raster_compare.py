#!/usr/bin/env python3
"""LCTSC T2-B1.1: rasterize same-case DICOM RTSTRUCT and score experimental masks.
Only aggregate anonymized QA leaves the process. No source DICOM or masks saved.
"""
import collections, hashlib, io, json, math, pathlib, sys, urllib.request, zipfile
import numpy as np
import scipy.ndimage as ndi
from skimage.draw import polygon
import pydicom

URL="https://zenodo.org/records/4747795/files/LCTSC_DICOM_TestData.zip?download=1"
MD5="e472ce41106eb881264f2acb2f2bb1ca"
MAX_BYTES=45*1024*1024
CANON={"lungl":"Left_Lung","leftlung":"Left_Lung","lungr":"Right_Lung",
       "rightlung":"Right_Lung","heart":"Heart","esophagus":"Esophagus",
       "oesophagus":"Esophagus","spinalcord":"Spinal_Cord","cord":"Spinal_Cord"}
NAMES=("Left_Lung","Right_Lung","Heart","Esophagus","Spinal_Cord")

def normalized_label(raw):
    return CANON.get(str(raw).lower().replace(" ","").replace("_",""),"")

def load_pair(blob_override=None):
    if blob_override is None:
        req=urllib.request.Request(URL,headers={"User-Agent":"ANATHEOS-3D-T2B1-same-case-QA/1.0"})
        with urllib.request.urlopen(req,timeout=90) as response:blob=response.read(MAX_BYTES+1)
        if len(blob)>MAX_BYTES or hashlib.md5(blob).hexdigest()!=MD5:
            raise RuntimeError("ZIP length or official Zenodo checksum failed")
    else:
        # Only public DICOM cases downloaded transiently by the multi-case benchmark.
        if len(blob_override)>160*1024*1024:raise RuntimeError("Multicase ZIP exceeds memory limit")
        blob=blob_override
    z=zipfile.ZipFile(io.BytesIO(blob))
    if z.testzip() is not None:raise RuntimeError("ZIP CRC failed")
    members=[m for m in z.infolist() if not m.is_dir()]
    if len(members)>1500 or sum(m.file_size for m in members)>550*1024*1024:
        raise RuntimeError("ZIP resource limits")
    ct=[];rt=[]
    for m in members:
        if m.file_size>6*1024*1024:raise RuntimeError("DICOM member size limit")
        raw=z.read(m)
        if len(raw)<132 or raw[128:132]!=b"DICM":continue
        ds=pydicom.dcmread(io.BytesIO(raw))
        if ds.Modality=="RTSTRUCT":rt.append(ds)
        elif ds.Modality=="CT":
            if str(ds.file_meta.TransferSyntaxUID) not in (
                "1.2.840.10008.1.2", "1.2.840.10008.1.2.1"):
                raise RuntimeError("Unsupported compressed transfer syntax")
            if int(ds.BitsAllocated)!=16 or int(ds.SamplesPerPixel)!=1:
                raise RuntimeError("Unsupported CT pixel type")
            a=np.asarray(ds.ImageOrientationPatient,dtype=np.float64)
            pos=np.asarray(ds.ImagePositionPatient,dtype=np.float64)
            spacing=np.asarray(ds.PixelSpacing,dtype=np.float64)
            normal=np.cross(a[:3],a[3:])
            if not (abs(float(np.linalg.norm(normal))-1)<0.01 and
                    abs(float(a[:3]@a[3:]))<0.01 and
                    np.isfinite(pos).all() and np.isfinite(spacing).all() and min(spacing)>0):
                raise RuntimeError("DICOM invalid geometry")
            shape=(int(ds.Rows),int(ds.Columns))
            rawpix=np.frombuffer(ds.PixelData,dtype=("<i2" if ds.PixelRepresentation else "<u2"))
            if rawpix.size!=shape[0]*shape[1]:raise RuntimeError("PixelData size mismatch")
            slope=float(getattr(ds,"RescaleSlope",1))
            intercept=float(getattr(ds,"RescaleIntercept",0))
            if not (math.isfinite(slope) and math.isfinite(intercept) and slope!=0):
                raise RuntimeError("Invalid HU transform")
            hu=np.rint(rawpix.reshape(shape).astype(np.float32)*slope+intercept)
            ct.append({"pos":pos,"orient":a,"spacing":spacing,"normal":normal,
                       "sop":str(ds.SOPInstanceUID),"frame":str(getattr(ds,"FrameOfReferenceUID","")),
                       "series":str(ds.SeriesInstanceUID),"project":float(pos@normal),
                       "pixels":np.clip(hu,-32768,32767).astype(np.int16)})
    if len(rt)!=1 or len(ct)<50:raise RuntimeError("Expected 1 RTSTRUCT and full CT")
    if len({c["series"] for c in ct})!=1:raise RuntimeError("Mixed CT series")
    ct.sort(key=lambda c:c["project"])
    first=ct[0]
    if any(c["pixels"].shape!=first["pixels"].shape or
           np.max(np.abs(c["orient"]-first["orient"]))>0.0005 or
           np.max(np.abs(c["spacing"]-first["spacing"]))>0.005 for c in ct):
        raise RuntimeError("Nonuniform series")
    gaps=np.diff([c["project"] for c in ct])
    if min(gaps)<=0 or np.max(np.abs(gaps-np.median(gaps)))>0.05:
        raise RuntimeError("Irregular slice spacing")
    frames={c["frame"] for c in ct}
    rois={int(e.ROINumber):normalized_label(e.ROIName)
          for e in getattr(rt[0],"StructureSetROISequence",[])}
    referenced={str(e.ReferencedFrameOfReferenceUID)
                for e in getattr(rt[0],"StructureSetROISequence",[])}
    if not frames.intersection(referenced):
        raise RuntimeError("RTSTRUCT does not reference CT frame")
    volume=np.stack([c["pixels"] for c in ct])
    return volume,ct,rt[0],rois,hashlib.sha256(blob).hexdigest(),float(np.median(gaps))

def ground_truth_masks(ct,rt,rois,shape):
    masks={name:np.zeros(shape,dtype=bool) for name in NAMES}
    sop_map={s["sop"]:i for i,s in enumerate(ct)}
    diagnostics=collections.Counter()
    max_mm=0.0
    for roi in getattr(rt,"ROIContourSequence",[]):
        name=rois.get(int(roi.ReferencedROINumber),"")
        if name not in masks:continue
        for contour in getattr(roi,"ContourSequence",[]):
            geometry=str(getattr(contour,"ContourGeometricType",""))
            if geometry not in ("CLOSED_PLANAR","CLOSEDPLANAR_XOR"):
                diagnostics["nonplanar_or_unhandled"]+=1
                continue
            points=np.asarray(contour.ContourData,dtype=np.float64).reshape(-1,3)
            if len(points)<3 or len(points)>20000 or not np.isfinite(points).all():
                raise RuntimeError("Invalid expert polygon")
            refs=[str(ref.ReferencedSOPInstanceUID)
                  for ref in getattr(contour,"ContourImageSequence",[])]
            known=[sop_map[s] for s in refs if s in sop_map]
            if known:
                index=known[0]
                if len(set(known))!=1:raise RuntimeError("Contour references multiple CT planes")
                diagnostics["mapped_by_reference"]+=1
            else:
                distances=[abs(float(np.mean((points-c["pos"])@c["normal"]))) for c in ct]
                index=int(np.argmin(distances))
                diagnostics["mapped_by_position"]+=1
            d=ct[index]
            residual=np.abs((points-d["pos"])@d["normal"])
            plane_error=float(np.max(residual))
            max_mm=max(max_mm,plane_error)
            if plane_error>0.75:raise RuntimeError("Expert contour is not on referenced CT plane")
            a=d["orient"][:3];b=d["orient"][3:]
            delta=points-d["pos"]
            col=delta@a / d["spacing"][1]
            row=delta@b / d["spacing"][0]
            rr,cc=polygon(row,col,shape=shape[1:])
            # Use parity for nested CLOSED_PLANAR rings; expose assumption in report.
            masks[name][index,rr,cc]^=True
            diagnostics["rasterized_contours"]+=1
    return masks,dict(diagnostics),max_mm

def dice(a,b):
    n=int(a.sum());m=int(b.sum())
    if n+m==0:return None
    return round(2*int(np.count_nonzero(a&b))/(n+m),6)

def main():
    hu,ct,rt,rois,sha,step=load_pair()
    expert,diagnostics,maxerr=ground_truth_masks(ct,rt,rois,hu.shape)
    min_counts={n:int(mask.sum()) for n,mask in expert.items()}
    if not all(min_counts[n]>500 for n in ("Left_Lung","Right_Lung","Heart")):
        raise RuntimeError("Missing essential expert organ masks")
    # Reuse T2-B0 *unchanged*; its results are only experimental HU/region candidates.
    import importlib.util
    mod=pathlib.Path("research/anatheos-t2b/thorax_tissue_candidates.py")
    spec=importlib.util.spec_from_file_location("anatheos_t2b",mod)
    original=importlib.util.module_from_spec(spec)
    sys.modules[spec.name]=original
    spec.loader.exec_module(original)
    geometry={"orientation":ct[0]["orient"],"positions":np.asarray([c["pos"] for c in ct]),
              "spacing":ct[0]["spacing"],"step":step}
    candidates,body=original.candidate_layers(hu,geometry)
    invariant=original.quality_check(candidates,body,hu,geometry)
    airL=candidates["air_candidate_left"];airR=candidates["air_candidate_right"]
    baseline={
        "left_lung_vs_air_candidate":dice(expert["Left_Lung"],airL),
        "right_lung_vs_air_candidate":dice(expert["Right_Lung"],airR),
        "heart_vs_central_search_region":dice(expert["Heart"],
            candidates["central_soft_tissue_search_region"])
    }
    # Sanity: which side is LPS patient-left? Expert left-lung centroid should have higher LPS X.
    centroids={}
    for name in ("Left_Lung","Right_Lung"):
        k, r, col=np.nonzero(expert[name])
        # sample locations to limit vectorized memory
        stride=max(1,len(k)//150000)
        k,r,col=k[::stride],r[::stride],col[::stride]
        a=ct[0]["orient"][:3];b=ct[0]["orient"][3:]
        centroids[name]=float(np.mean(
          np.asarray([ct[int(i)]["pos"][0] for i in k])+
          col*float(ct[0]["spacing"][1])*float(a[0])+
          r*float(ct[0]["spacing"][0])*float(b[0])))
    if centroids["Left_Lung"]<=centroids["Right_Lung"]:
        raise RuntimeError("LPS laterality check failed")
    output={
      "dataset":"LCTSC sample, TCIA via Zenodo 4747795; CC BY 3.0",
      "original_sha256":sha,
      "ct_shape_zyx":list(hu.shape),
      "pixel_spacing_mm":list(map(float,ct[0]["spacing"]))+[step],
      "reference_labels":min_counts,
      "rtstruct_raster_contours":diagnostics,
      "max_contour_plane_deviation_mm":round(maxerr,5),
      "laterality_LPS_verified":True,
      "experimental_baseline_Dice":baseline,
      "candidate_partition_complete":invariant["partition_complete"],
      "candidate_classes_disjoint":invariant["classes_disjoint"],
      "result_interpretation":"Dice versus same-case manual radiation OAR reference, not clinical validation",
      "residual_is_not_a_lesion_detector":True,
      "rtstruct_hole_semantics":"polygon parity; pending independent rasterizer cross-check",
      "no_medical_data_or_identifiers_saved":True
    }
    print("ANATHEOS_T2B1_RASTER_QA="+json.dumps(output,sort_keys=True),flush=True)
if __name__=="__main__":main()
