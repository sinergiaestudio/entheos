#!/usr/bin/env python3
"""SPL Knee Atlas: local-only geometric preflight. No uploads, no diagnosis.
Reads publicly licensed atlas files from a temporary local directory.
Bounding-box similarity cannot establish voxel-surface registration.
"""
import array
import gzip
import hashlib
import json
import math
import re
import struct
import sys
from pathlib import Path

LABELS = {95: ("femur", 1838598, 328956, 16447884),
          96: ("tibia", 1190880, 266884, 13344284)}
ROOT = Path(sys.argv[1]) if len(sys.argv)>1 else Path(".")
def sha(path):
    h=hashlib.sha256()
    with open(path,"rb") as f:
        for chunk in iter(lambda:f.read(1<<20),b""):h.update(chunk)
    return h.hexdigest()
def read_header(path):
    with open(path,"rb") as f:
        header=bytearray()
        for _ in range(10000):
            a=f.read(1)
            if not a:raise ValueError("NRRD header incomplete")
            header+=a
            if header.endswith(b"\n\n") or header.endswith(b"\r\n\r\n"):break
        else:raise ValueError("NRRD header too large")
    text=header.decode("ascii")
    if not text.startswith("NRRD"):raise ValueError("Not a NRRD")
    meta={}
    for line in text.splitlines():
        if ":" in line and not line.startswith("#"):
            k,v=line.split(":",1);meta[k.strip().lower()]=v.strip()
    dim=tuple(int(x) for x in meta["sizes"].split())
    vectors=[tuple(map(float,s.split(","))) for s in re.findall(r"\(([^)]+)\)",meta["space directions"])]
    origin=tuple(map(float,re.findall(r"\(([^)]+)\)",meta["space origin"])[0].split(",")))
    if len(dim)!=3 or len(vectors)!=3 or len(origin)!=3:raise ValueError("Unsupported NRRD 3D axes")
    return meta,dim,vectors,origin,len(header)

def mask_bounds(path):
    meta,dim,directions,origin,offset=read_header(path)
    assert dim==(512,512,119) and meta["space"]=="left-posterior-superior", "Unexpected atlas label geometry"
    assert meta["type"]=="short" and meta["endian"]=="little" and meta["encoding"]=="gzip", "Unexpected label encoding"
    with open(path,"rb") as f:
        f.seek(offset)
        raw=gzip.GzipFile(fileobj=f).read()
    assert len(raw)==math.prod(dim)*2,"Decompressed mask size mismatch"
    vals=array.array("h");vals.frombytes(raw)
    if sys.byteorder!="little":vals.byteswap()
    found={label:{"count":0,"min_ijk":[512,512,119],"max_ijk":[-1,-1,-1]} for label in LABELS}
    other=set();w,h,_=dim
    for i,value in enumerate(vals):
        if not value:continue
        if value not in found:other.add(value);continue
        o=found[value];o["count"]+=1
        z,t=divmod(i,w*h);y,x=divmod(t,w)
        for j,v in enumerate((x,y,z)):
            o["min_ijk"][j]=min(o["min_ijk"][j],v)
            o["max_ijk"][j]=max(o["max_ijk"][j],v)
    for label,o in found.items():
        assert o["count"]==LABELS[label][1],f"Label {label} voxel count unexpectedly changed"
        corners=[]
        for mask in range(8):
            index=[o["max_ijk"][k] if mask&(1<<k) else o["min_ijk"][k] for k in range(3)]
            corners.append([origin[j]+sum(directions[k][j]*index[k] for k in range(3)) for j in range(3)])
        o["min_lps_mm"]=[min(v[j] for v in corners) for j in range(3)]
        o["max_lps_mm"]=[max(v[j] for v in corners) for j in range(3)]
    return found,other,{"dimensions":dim,"space":meta["space"],"directions":directions,"origin":origin}

def stl_bounds(path,triangles,size_expected):
    raw=path.read_bytes();n=struct.unpack_from("<I",raw,80)[0]
    assert len(raw)==size_expected and len(raw)==84+n*50 and n==triangles,"STL binary shape or file size changed"
    lo=[float("inf")]*3;hi=[-float("inf")]*3;invalid=0
    header=raw[:80].rstrip(b"\0").decode("ascii",errors="replace")
    for i in range(n):
        xyz=struct.unpack_from("<9f",raw,84+i*50+12)
        if any(not math.isfinite(x) for x in xyz):raise ValueError("STL nonfinite value")
        for j,v in enumerate(xyz):
            lo[j%3]=min(lo[j%3],v);hi[j%3]=max(hi[j%3],v)
        u=[xyz[j+3]-xyz[j] for j in range(3)]
        v=[xyz[j+6]-xyz[j] for j in range(3)]
        cross=(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
        if sum(x*x for x in cross)<1e-16:invalid+=1
    return {"sha256":sha(path),"bytes":len(raw),"triangles":n,"degenerate":invalid,
            "header":header,"min_xyz":lo,"max_xyz":hi,"extent":[hi[j]-lo[j] for j in range(3)]}

def correspondence(mask,mesh):
    possibilities=[]
    for name,sign in (("LPS",(1,1,1)),("RAS",(-1,-1,1))):
        lower=[min(sign[j]*mesh["min_xyz"][j],sign[j]*mesh["max_xyz"][j]) for j in range(3)]
        upper=[max(sign[j]*mesh["min_xyz"][j],sign[j]*mesh["max_xyz"][j]) for j in range(3)]
        diffs=[max(abs(lower[j]-mask["min_lps_mm"][j]),abs(upper[j]-mask["max_lps_mm"][j])) for j in range(3)]
        possibilities.append({"interpretation":name,"axis_max_error_mm":diffs,"max_error_mm":max(diffs)})
    possibilities.sort(key=lambda x:x["max_error_mm"])
    return {"candidates":possibilities,"bbox_compatible_5mm":possibilities[0]["max_error_mm"]<=5,
            "geometry_registered":False,
            "note":"Bounding boxes alone do not prove registration or validate anatomical surfaces."}

def main():
    labels=ROOT/"SPLKneeAtlasLabels.nrrd"
    masks,other,geo=mask_bounds(labels)
    report={"atlas":"SPL Knee Atlas","pinned_source_commit":"a033300264aec8625a56512be3865c10cdbcb61b",
            "label_sha256":sha(labels),"geometry":geo,
            "unmapped_label_3":3 in other,"structures":{}}
    for ident,(name,_,triangles,size) in LABELS.items():
        mesh=stl_bounds(ROOT/f"{name}-{ident}.stl",triangles,size)
        report["structures"][str(ident)]={"name":name,"mask":masks[ident],
                "mesh":mesh,"correspondence":correspondence(masks[ident],mesh)}
    assert report["unmapped_label_3"],"Previously observed unknown label 3 has changed"
    print("ANATHEOS_REAL_ATLAS_PREFLIGHT_JSON="+json.dumps(report,separators=(",",":")))
    print("PASS atlas source read and geometry; final 3D Slicer alignment remains unverified")
if __name__=="__main__":main()
