#!/usr/bin/env python3
"""ANATHEOS CT-T2B: non-diagnostic chest tissue candidates.
Only spatially linked input from ONE CT series. No pathology classification.
Requires numpy, scipy, pydicom. Never logs patient identifiers or DICOM UIDs.
"""
from __future__ import annotations
import argparse, hashlib, io, json, math, urllib.request, zipfile
from collections import Counter
import numpy as np
import scipy.ndimage as ndi
import pydicom

SOURCE = "https://zenodo.org/records/18225140/files/PCIR_98890234_20010101_7.zip?download=1"
SHA256 = "329e46e80bfd30be001d6b866771cd15b348aec14da588d730712d70f0d8f4fd"
LAYERS = ("air_candidate_left", "air_candidate_right", "high_attenuation_candidate",
          "central_soft_tissue_search_region", "unassigned_body_tissue")
# These are *candidate masks*, NOT validated organs, cavities, pericardium or lesions.

def load_ct_zip(blob: bytes):
    if len(blob) > 50_000_000: raise ValueError("ZIP exceeds ingestion limit")
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        if z.testzip() is not None: raise ValueError("CRC failure")
        members = [i for i in z.infolist() if not i.is_dir()]
        if len(members)>600 or sum(i.file_size for i in members)>250_000_000:
            raise ValueError("Unpacked ZIP exceeds limits")
        slices=[]
        for member in members:
            raw=z.read(member)
            if len(raw)<132 or raw[128:132]!=b"DICM":continue
            ds=pydicom.dcmread(io.BytesIO(raw))
            if ds.Modality!="CT" or str(ds.file_meta.TransferSyntaxUID) not in (
                    "1.2.840.10008.1.2","1.2.840.10008.1.2.1"):
                raise ValueError("Unsupported modality or compressed CT")
            if int(ds.SamplesPerPixel)!=1 or int(ds.BitsAllocated)!=16 or int(getattr(ds,"NumberOfFrames",1))!=1:
                raise ValueError("Unsupported pixel layout")
            shape=(int(ds.Rows),int(ds.Columns))
            dtype="<i2" if int(ds.PixelRepresentation)==1 else "<u2"
            pixels=np.frombuffer(ds.PixelData,dtype=dtype)
            if pixels.size != shape[0]*shape[1]:raise ValueError("Pixel data size differs from metadata")
            o=np.array(ds.ImageOrientationPatient,dtype=np.float64)
            ipp=np.array(ds.ImagePositionPatient,dtype=np.float64)
            pixsp=np.array(ds.PixelSpacing,dtype=np.float64)
            if not np.isfinite(o).all() or not np.isfinite(ipp).all() or not np.isfinite(pixsp).all():
                raise ValueError("Non-finite physical geometry")
            if np.min(pixsp)<=0 or len(o)!=6 or len(ipp)!=3:raise ValueError("Invalid geometry")
            norm=np.cross(o[:3],o[3:])
            if abs(float(np.linalg.norm(norm))-1)>0.01:raise ValueError("Invalid orientation")
            slope=float(getattr(ds,"RescaleSlope",1))
            intercept=float(getattr(ds,"RescaleIntercept",0))
            if not math.isfinite(slope) or not math.isfinite(intercept) or slope==0:
                raise ValueError("Invalid HU rescale")
            slices.append(dict(project=float(ipp@norm), raw=pixels.reshape(shape).copy(),
                  pos=ipp,orient=o,spacing=pixsp,slope=slope,intercept=intercept,
                  series=str(ds.SeriesInstanceUID)))
    if len(slices)<8:raise ValueError("Not enough ordered DICOM slices")
    if len({s["series"] for s in slices})!=1:raise ValueError("Multiple series in a ZIP")
    slices.sort(key=lambda s:s["project"])
    first=slices[0]
    if any(s["raw"].shape!=first["raw"].shape or
           np.max(np.abs(s["orient"]-first["orient"]))>0.0005 or
           np.max(np.abs(s["spacing"]-first["spacing"]))>0.005 for s in slices):
        raise ValueError("Inconsistent slice geometry")
    steps=np.diff([s["project"] for s in slices])
    if np.min(steps)<.01 or np.max(np.abs(steps-np.median(steps)))>.10:
        raise ValueError("Irregular or duplicate spatial positions")
    hu=np.stack([np.rint(s["raw"].astype(np.float32)*s["slope"]+s["intercept"])
              .clip(-32768,32767).astype(np.int16) for s in slices])
    return hu,dict(orientation=first["orient"],positions=np.array([s["pos"] for s in slices]),
                spacing=first["spacing"],step=float(np.median(steps)))

def remove_small_3d(mask, minimum):
    labels,n=ndi.label(mask)
    if n==0:return np.zeros_like(mask)
    counts=np.bincount(labels.ravel())
    keep=counts>=minimum;keep[0]=False
    return keep[labels]

def candidate_layers(hu, geometry):
    if hu.ndim!=3 or hu.shape[0]<3:raise ValueError("Expected 3D CT volume")
    z,y,x=hu.shape
    body=np.zeros(hu.shape,dtype=bool)
    for k in range(z):
        outer=hu[k]>-500
        outer=ndi.binary_closing(outer,structure=np.ones((5,5),dtype=bool))
        lab,n=ndi.label(outer)
        if n==0:continue
        counts=np.bincount(lab.ravel());counts[0]=0
        largest=lab==np.argmax(counts)
        body[k]=ndi.binary_fill_holes(largest)
    if np.count_nonzero(body)==0:raise ValueError("No body ROI identified")
    interior=ndi.binary_erosion(body,iterations=2)
    air=(hu < -400) & interior
    # Denoise isolated air pockets; *not* a validated lung segmenter.
    air=remove_small_3d(air,max(250,hu.size//30000))
    xgrid=np.arange(x,dtype=np.float32)[None,:]
    ygrid=np.arange(y,dtype=np.float32)[:,None]
    orient=geometry["orientation"];sp=geometry["spacing"]
    # LPS +X is patient-left; compute approximate midline from torso centroid
    # rather than assuming the DICOM columns point toward either left or right.
    k=z//2
    patient_x0=(geometry["positions"][k,0] +
                xgrid*float(sp[1])*float(orient[0])+
                ygrid*float(sp[0])*float(orient[3]))
    center=np.median(patient_x0[body[k]]) if np.any(body[k]) else np.median(patient_x0)
    lo=float(np.min(patient_x0[body[k]])) if np.any(body[k]) else float(patient_x0.min())
    hi=float(np.max(patient_x0[body[k]])) if np.any(body[k]) else float(patient_x0.max())
    halfspan=max(1.0,(hi-lo)/2)
    left=np.zeros_like(air);right=np.zeros_like(air);central=np.zeros_like(air)
    high=(hu>250)&body
    # HU thresholds can include contrast/calcification and are never "bone" ground truth.
    high=remove_small_3d(high,max(12,hu.size//1_000_000))
    for i in range(z):
        physx=(geometry["positions"][i,0]+
               xgrid*float(sp[1])*float(orient[0])+
               ygrid*float(sp[0])*float(orient[3]))
        left[i]=air[i]&(physx>=center)
        right[i]=air[i]&(physx<center)
        central_band=np.abs(physx-center) <= (.52*halfspan)
        central[i]=(body[i]&central_band&(hu[i]>-100)&(hu[i]<=250)&(~high[i])&(~air[i]))
    # Left/right: candidate air includes bronchi/trachea; not validated lung ROIs.
    # Priority order makes labels disjoint; residual is the entire unassigned body.
    central &= ~(left|right|high)
    remaining=body&~(left|right|high|central)
    return dict(zip(LAYERS,(left,right,high,central,remaining))),body

def quality_check(masks,body,hu,geometry):
    if any(m.shape!=hu.shape for m in masks.values()):raise AssertionError("Shape mismatch")
    total=np.zeros_like(body,dtype=np.uint8)
    counts={}
    for name,mask in masks.items():
        counts[name]=int(np.count_nonzero(mask))
        total+=mask.astype(np.uint8)
    if np.max(total)>1:raise AssertionError("Overlapping candidate classes")
    if not np.array_equal(total>0,body):raise AssertionError("Unassigned voxels or out-of-body assignment")
    if counts["air_candidate_left"]<1000 or counts["air_candidate_right"]<1000:
        raise AssertionError("Air components are insufficient; inspect orientation/coverage")
    return {"shape_zyx":list(hu.shape),"spacing_mm":list(map(float,geometry["spacing"]))+
            [geometry["step"]],"candidate_voxels":counts,"body_voxels":int(body.sum()),
            "partition_complete":True,"classes_disjoint":True,
            "classification_status":"EXPLORATORY, NO ANATOMICAL LABELS VALIDATED",
            "residual_interpretation":"Unassigned normal and abnormal tissues; NOT a lesion detector",
            "contains_original_images":False,"contains_patient_identifiers":False}

def selftest():
    Z,Y,X=12,96,96
    yy,xx=np.ogrid[:Y,:X]
    hu=np.full((Z,Y,X),-1024,dtype=np.int16)
    outer=(xx-48)**2/45**2+(yy-48)**2/44**2<1
    hu[:,outer]=50
    lung1=(xx-25)**2/14**2+(yy-48)**2/23**2<1
    lung2=(xx-70)**2/14**2+(yy-48)**2/23**2<1
    hu[:,lung1|lung2]=-750
    hu[:,(xx-48)**2+(yy-80)**2<6**2]=600
    geometry=dict(orientation=np.array([1.,0,0,0,1.,0]),spacing=np.array([1.,1.]),
                  positions=np.array([[0.,0.,float(i)] for i in range(Z)]),step=1.)
    masks,body=candidate_layers(hu,geometry)
    assert quality_check(masks,body,hu,geometry)["partition_complete"]
    print("ANATHEOS_T2B_SYNTHETIC_TEST=PASS",flush=True)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--source-url",default=SOURCE)
    ap.add_argument("--sha256",default=SHA256)
    ap.add_argument("--selftest",action="store_true")
    args=ap.parse_args()
    selftest()
    if args.selftest:return
    req=urllib.request.Request(args.source_url,headers={"User-Agent":"ANATHEOS-3D-T2B-noncommercial-QA/1.0"})
    with urllib.request.urlopen(req,timeout=60) as response:
        blob=response.read(50_000_001)
    digest=hashlib.sha256(blob).hexdigest()
    if digest!=args.sha256:raise ValueError("Unexpected original CT ZIP SHA256")
    hu,geom=load_ct_zip(blob)
    # Original data held only in process RAM; no DICOM, segmentation or screenshots output.
    masks,body=candidate_layers(hu,geom)
    report=quality_check(masks,body,hu,geom)
    report.update(dataset="CT-T1 PCIR torso / CC0",original_zip_sha256=digest,
                  data_handling="Ephemeral process RAM only",
                  expected_anatomy="TO BE VALIDATED against same-case expert masks")
    print("ANATHEOS_T2B_SANITIZED_RESULT="+json.dumps(report,sort_keys=True),flush=True)

if __name__=="__main__":main()
