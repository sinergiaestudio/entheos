#!/usr/bin/env python3
"""Probe free TCIA/HF LCTSC case access, metadata only. No patient IDs logged."""
import collections, json, urllib.request
TARGETS={
 "TCIA_NBIA": "https://services.cancerimagingarchive.net/nbia-api/services/v1/getSeries?Collection=LCTSC",
 "HuggingFace_tree": "https://huggingface.co/api/datasets/MedOtter/LCTSC/tree/main/data?recursive=false"
}
def read_json(url):
 request=urllib.request.Request(url,headers={"User-Agent":"ANATHEOS-3D-free-research-QA/1.0","Accept":"application/json"})
 with urllib.request.urlopen(request,timeout=45) as r:
  payload=r.read(3_000_000)
 return json.loads(payload)
def run():
 results={}
 for tag,url in TARGETS.items():
  try:
   data=read_json(url)
   if tag=="TCIA_NBIA":
    if not isinstance(data,list):raise ValueError("Expected a list of series")
    modalities=collections.Counter(str(x.get("Modality","Unknown")) for x in data)
    studies=len(set(str(x.get("StudyInstanceUID","")) for x in data))
    results[tag]={"available":True,"series":len(data),
        "study_count":studies,"modalities":dict(modalities),
        "is_sufficient_for_multicase":modalities["CT"]>=3 and modalities["RTSTRUCT"]>=3}
   else:
    if not isinstance(data,list):raise ValueError("Expected file tree")
    results[tag]={"available":True,"files":len(data),
        "total_bytes":sum(int(x.get("size") or 0) for x in data),
        "file_types":dict(collections.Counter(str(x.get("path","")).split(".")[-1] for x in data))}
  except Exception as exc:
   results[tag]={"available":False,"reason_type":type(exc).__name__,
                 "http_status":getattr(exc,"code",None)}
 print("ANATHEOS_T2B2_MULTICASE_ACCESS="+json.dumps(results,sort_keys=True))
run()
