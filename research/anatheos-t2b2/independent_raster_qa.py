#!/usr/bin/env python3
"""CT-T2B2: independent OpenCV rasterization and objective OAR mask QA.
LCTSC sample is fetched temporarily in RAM. No patient DICOM or masks saved.
This is **not** a disease/quiste classifier or clinical validation.
"""
from __future__ import annotations
import collections, hashlib, importlib.util, json, math, pathlib, sys
import cv2
import numpy as np
from scipy import ndimage as ndi

def module(path,name):
    spec=importlib.util.spec_from_file_location(name,pathlib.Path(path))
    obj=importlib.util.module_from_spec(spec)
    sys.modules[name]=obj
    spec.loader.exec_module(obj)
    return obj

orig=module("research/anatheos-t2b1/raster_compare.py","anatheos_lctsc_reference")
t2b=module("research/anatheos-t2b/thorax_tissue_candidates.py","anatheos_original_t2b")

def independently_rasterize(ct,rt,roi_names,shape):
    """OpenCV fillPoly parity on all rings of each ROI/slice, unlike skimage polygon.
       Geometry independently checked from patient LPS coordinates to voxel indices."""
    index_by_uid={c["sop"]:k for k,c in enumerate(ct)}
    shape_2d=shape[1:]
    poly=collections.defaultdict(list)
    invalid=0;max_deviation=0.
    for region in getattr(rt,"ROIContourSequence",[]):
        name=roi_names.get(int(region.ReferencedROINumber),"")
        if name not in orig.NAMES:continue
        for item in getattr(region,"ContourSequence",[]):
            if str(getattr(item,"ContourGeometricType","")) not in ("CLOSED_PLANAR","CLOSEDPLANAR_XOR"):
                invalid+=1;continue
            points=np.asarray(item.ContourData,dtype=np.float64).reshape(-1,3)
            if len(points)<3 or not np.isfinite(points).all():
                raise RuntimeError("Invalid contours")
            refs=[index_by_uid[str(r.ReferencedSOPInstanceUID)]
                  for r in getattr(item,"ContourImageSequence",[])
                  if str(r.ReferencedSOPInstanceUID) in index_by_uid]
            if refs:
                if len(set(refs))!=1:raise RuntimeError("Contour references different slices")
                k=refs[0]
            else:
                distances=[abs(float(np.mean((points-c["pos"])@c["normal"]))) for c in ct]
                k=int(np.argmin(distances))
            sl=ct[k]
            departure=np.max(np.abs((points-sl["pos"])@sl["normal"]))
            max_deviation=max(float(departure),max_deviation)
            if departure>0.75:raise RuntimeError("Off-plane expert contour")
            # Independent LPS-to-pixel projections, cv2 rounds centers to integer.
            delta=points-sl["pos"]
            a=sl["orient"][:3];b=sl["orient"][3:]
            x=(delta@a)/sl["spacing"][1]
            y=(delta@b)/sl["spacing"][0]
            coordinates=np.column_stack((np.rint(x),np.rint(y))).astype(np.int32)
            poly[(name,k)].append(coordinates)
    out={name:np.zeros(shape,dtype=bool) for name in orig.NAMES}
    for (name,k),polygons in poly.items():
        mask=np.zeros(shape_2d,dtype=np.uint8)
        cv2.fillPoly(mask,polygons,1)
        out[name][k]=mask.astype(bool)
    return out,{"rasterized_slices":len(poly),"contour_other_geometry":invalid,
                "max_plane_error_mm":round(max_deviation,6)}

def test_cv2_holes():
    image=np.zeros((48,48),np.uint8)
    outer=np.array([[4,4],[40,4],[40,40],[4,40]],np.int32)
    inner=np.array([[17,17],[27,17],[27,27],[17,27]],np.int32)
    cv2.fillPoly(image,[outer,inner],1)
    if image[20,20] or not image[10,10]:
        raise AssertionError("CV2 parity fill did not respect hole")
    print("ANATHEOS_T2B2_SYNTHETIC_HOLE_TEST=PASS",flush=True)

def metrics(mask,truth,spacing,hd95=True):
    a=int(mask.sum());b=int(truth.sum());intersection=int(np.count_nonzero(mask&truth))
    dice=None if a+b==0 else 2*intersection/(a+b)
    precision=None if a==0 else intersection/a
    recall=None if b==0 else intersection/b
    bias=None if b==0 else (a-b)/b
    result={"dice":round(dice,6) if dice is not None else None,
            "precision":round(precision,6) if precision is not None else None,
            "recall":round(recall,6) if recall is not None else None,
            "volume_bias_ratio":round(bias,6) if bias is not None else None,
            "reference_voxels":b,"candidate_voxels":a}
    if hd95 and a>0 and b>0:
        # Crop to union bounding volume to limit RAM; one extra slice margin.
        coords=np.nonzero(mask|truth)
        slices=tuple(slice(max(0,int(np.min(c))-2),min(mask.shape[i],int(np.max(c))+3))
                     for i,c in enumerate(coords))
        x=mask[slices];y=truth[slices]
        border=np.ones((3,3,3),dtype=bool)
        xb=x^ndi.binary_erosion(x,structure=border,border_value=0)
        yb=y^ndi.binary_erosion(y,structure=border,border_value=0)
        if xb.any() and yb.any():
            to_y=ndi.distance_transform_edt(~yb,sampling=spacing)
            to_x=ndi.distance_transform_edt(~xb,sampling=spacing)
            # Bidirectional symmetric 95th percentile surface distance.
            dxy=to_y[xb];dyx=to_x[yb]
            result["hd95_mm"]=round(float(np.percentile(np.concatenate((dxy,dyx)),95)),4)
            del to_y,to_x,dxy,dyx
    return result

def main():
    test_cv2_holes()
    hu,ct,rt,rois,sha,step=orig.load_pair()
    legacy,legacy_diag,legacy_deviation=orig.ground_truth_masks(ct,rt,rois,hu.shape)
    alternate,alternate_diag=independently_rasterize(ct,rt,rois,hu.shape)
    spacing=(step,float(ct[0]["spacing"][0]),float(ct[0]["spacing"][1]))
    validation={}
    for name in orig.NAMES:
        comparison=metrics(legacy[name],alternate[name],spacing,hd95=False)
        if comparison["dice"] is None or comparison["dice"]<0.975:
            raise RuntimeError("Independent rasterizers disagree on "+name)
        validation[name]=comparison
    geo={"orientation":ct[0]["orient"],"positions":np.array([c["pos"] for c in ct]),
         "spacing":ct[0]["spacing"],"step":step}
    estimated,body=t2b.candidate_layers(hu,geo)
    t2b.quality_check(estimated,body,hu,geo)
    # Scoring against OpenCV reference avoids reusing the rasterizer from the baseline.
    observations={
        "Left_Lung":metrics(estimated["air_candidate_left"],alternate["Left_Lung"],spacing),
        "Right_Lung":metrics(estimated["air_candidate_right"],alternate["Right_Lung"],spacing),
        "Heart_candidate_central_not_segmentation":metrics(
            estimated["central_soft_tissue_search_region"],alternate["Heart"],spacing)
    }
    report={
        "dataset":"LCTSC official TCIA sample via Zenodo 4747795",
        "original_sha256":sha,"shape_zyx":list(hu.shape),
        "rasterizers":"scikit-image polygon parity vs OpenCV fillPoly multi-ring",
        "independent_rasterizer_agreement":validation,
        "experiment_vs_independent_reference":observations,
        "raster_geometry":alternate_diag,
        "candidate_heart_not_anatomical_segmentation":True,
        "residual_not_lesion_detector":True,
        "single_case_only":True,"clinical_validation":False,
        "patient_identifiers_or_image_bytes_saved":False
    }
    print("ANATHEOS_T2B2_QA="+json.dumps(report,sort_keys=True),flush=True)

if __name__=="__main__":main()
