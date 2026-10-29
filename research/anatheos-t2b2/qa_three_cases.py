#!/usr/bin/env python3
"""CT-T2B2: test the same lung algorithm on 3 DIFFERENT LCTSC cases via public NBIA.
Downloads original CT/RTSTRUCT ZIPs into ephemeral memory and publishes only
aggregate anonymized metrics. Does not train a model or classify disease.
"""
import collections, gc, hashlib, importlib.util, io, json, math, pathlib
import urllib.parse, urllib.request, zipfile
import numpy as np
BASE="https://services.cancerimagingarchive.net/nbia-api/services/v1/"
LIMIT=145*1024*1024
def read_url(url,cap=LIMIT):
    req=urllib.request.Request(url,headers={"User-Agent":"ANATHEOS-3D-noncommercial-T2B2-QA/1.0"})
    with urllib.request.urlopen(req,timeout=105) as response:
        data=response.read(cap+1)
    if len(data)>cap:raise RuntimeError("Source exceeds byte cap")
    return data
def loadmodule(path,name):
    spec=importlib.util.spec_from_file_location(name,pathlib.Path(path))
    m=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m
ref=loadmodule("research/anatheos-t2b1/raster_compare.py","lctsc_reference")
candidate=loadmodule("research/anatheos-t2b/thorax_tissue_candidates.py","t2b_baseline")
def series_groups():
    series=json.loads(read_url(BASE+"getSeries?Collection=LCTSC",4_000_000))
    if not isinstance(series,list) or len(series)<100:raise RuntimeError("LCTSC series listing incomplete")
    studies=collections.defaultdict(dict)
    for entry in series:
        mod=str(entry.get("Modality",""))
        study=str(entry.get("StudyInstanceUID",""))
        if mod in ("CT","RTSTRUCT") and study:
            studies[study][mod]=entry
    paired=[v for v in studies.values() if "CT" in v and "RTSTRUCT" in v]
    if len(paired)<40:raise RuntimeError("Not enough paired CT/RTSTRUCT from TCIA")
    bysite=collections.defaultdict(list)
    for pair in paired:
        identity=str(pair["CT"].get("PatientID",""))
        site=next((name for name in ("S1","S2","S3") if "-"+name+"-" in identity),"UNK")
        count=int(pair["CT"].get("ImageCount") or 200)
        if identity.startswith("LCTSC-Train-"):
            bysite[site].append((count,pair))
    chosen=[]
    for site in ("S1","S2","S3"):
        options=sorted(bysite[site],key=lambda row:row[0])
        if options:
            chosen.append((site,options[0][1]))
    if len(chosen)<3:raise RuntimeError("Not enough publicly marked training sites to select 3 distinct cases")
    return chosen,len(paired)
def combined_zip(pair):
    memory=io.BytesIO()
    totals={}
    with zipfile.ZipFile(memory,"w",compression=zipfile.ZIP_STORED,allowZip64=False) as out:
        for mod in ("CT","RTSTRUCT"):
            uid=str(pair[mod].get("SeriesInstanceUID",""))
            if not uid or len(uid)>90:raise RuntimeError("Series locator missing")
            url=BASE+"getImage?"+urllib.parse.urlencode({"SeriesInstanceUID":uid})
            body=read_url(url,105*1024*1024 if mod=="CT" else 12*1024*1024)
            totals[mod]=len(body)
            with zipfile.ZipFile(io.BytesIO(body)) as z:
                if z.testzip() is not None:raise RuntimeError("TCIA ZIP failed CRC")
                items=[m for m in z.infolist() if not m.is_dir()]
                if len(items)>450:raise RuntimeError("Too many DICOM slices")
                for k,item in enumerate(items):
                    if item.file_size>7*1024*1024:raise RuntimeError("Unexpected DICOM member")
                    raw=z.read(item)
                    if len(raw)>132 and raw[128:132]==b"DICM":
                        out.writestr(f"{mod}/{k:04d}.dcm",raw)
    value=memory.getvalue()
    if len(value)>160*1024*1024:raise RuntimeError("Merged DICOM ZIP exceeds memory limit")
    return value,totals
def overlap(a,b):
    n=int(a.sum());m=int(b.sum())
    return None if n+m==0 else round(2*int(np.count_nonzero(a&b))/(n+m),6)
def main():
    chosen,paired_count=series_groups()
    records=[]
    for i,(site,pair) in enumerate(chosen,1):
        raw,sizes=combined_zip(pair)
        hu,ct,rt,rois,sha,step=ref.load_pair(blob_override=raw)
        refs,metadata,plane=ref.ground_truth_masks(ct,rt,rois,hu.shape)
        if metadata.get("rasterized_contours",0)<20 or plane>0.75:
            raise RuntimeError("Insufficient matching same-case contours")
        geo={"orientation":ct[0]["orient"],"positions":np.asarray([c["pos"] for c in ct]),
             "spacing":ct[0]["spacing"],"step":step}
        masks,body=candidate.candidate_layers(hu,geo)
        candidate.quality_check(masks,body,hu,geo)
        scores={name:overlap(masks[source],refs[name]) for name,source in
          [("Left_Lung","air_candidate_left"),("Right_Lung","air_candidate_right"),
           ("Heart_search_only","central_soft_tissue_search_region")]}
        if any(scores[n] is None for n in ("Left_Lung","Right_Lung")):
            raise RuntimeError("Missing expert/estimated lung masks")
        record={"site_group":site,"case_number":i,"shape_zyx":list(hu.shape),
            "same_case_reference":True,"rasterized_contours":metadata["rasterized_contours"],
            "dice_candidate_vs_expert":scores,"dicom_zip_bytes_by_modality":sizes,
            "no_patient_ids_logged":True}
        records.append(record)
        print("ANATHEOS_T2B2_MULTICASE_CASE="+json.dumps(record,sort_keys=True),flush=True)
        del raw,hu,ct,rt,refs,masks,body
        gc.collect()
    values=[r["dice_candidate_vs_expert"][n] for r in records for n in ("Left_Lung","Right_Lung")]
    aggregate={"studies_in_source":paired_count,"different_training_cases":len(records),
        "institutions":[r["site_group"] for r in records],"cases":records,
        "lung_dice_min":round(min(values),6),
        "lung_dice_mean":round(float(np.mean(values)),6),
        "lung_dice_max":round(max(values),6),
        "measure":"case-level Dice against same-case RTSTRUCT, not diagnostic validity",
        "residual_not_a_lesion_detector":True,
        "no_dicom_or_patient_identifiers_saved":True}
    print("ANATHEOS_T2B2_MULTICASE_RESULT="+json.dumps(aggregate,sort_keys=True),flush=True)
if __name__=="__main__":main()
