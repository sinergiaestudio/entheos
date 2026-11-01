#!/usr/bin/env python3
"""AFE-02A deterministic synthetic PLY exports + resource and analytic metrics.
External environment: stdlib Python; no medical images or GPU.
"""
import argparse,hashlib,json,math,os,platform,statistics,sys,time,tracemalloc
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from afe.geometry import VolumeGeometry
from afe.points import PointSource,fingerprint,extract_mask
from afe.point_io import export_ply

def grid(n):
    c,s=math.cos(math.radians(25)),math.sin(math.radians(25))
    return VolumeGeometry((15.,-17.,62.),(.5*c,.5*s,0.),(-.7*s,.7*c,0.),
              (0.,0.,1.2),(n,n,n),tuple(range(n)),'MR','original')

def mask_of(g,kind):
    n=g.dimensions_crs[0];h=(n-1)*.5;mask=bytearray(n**3)
    d=n*.13;R=n*.2
    for k in range(n):
        z=(k-h)*1.2
        for j in range(n):
            y=(j-h)*.7
            for i in range(n):
                x=(i-h)*.5;r=math.hypot(x,y);rad=math.sqrt(x*x+y*y+z*z)
                if kind=='sphere':hit=rad<=R
                elif kind=='ellipsoid':hit=(x/(R*.8))**2+(y/(R*1.15))**2+(z/(R*1.45))**2<=1
                elif kind=='cylinder':hit=r<=d and abs(z)<=R
                elif kind=='tube':hit=d*.6<=r<=d and abs(z)<=R
                elif kind=='cavity':hit=R*.45<=rad<=R
                else:raise ValueError(kind)
                mask[(k*n+j)*n+i]=bool(hit)
    return mask

def analytic_face_error(p,n,kind):
    h=(n-1)*.5;i,j,k=p.voxel_crs
    x=(i-h)*.5;y=(j-h)*.7;z=(k-h)*1.2
    R=n*.2;d=n*.13;r=math.hypot(x,y);rad=math.sqrt(x*x+y*y+z*z)
    if kind=='sphere':return abs(rad-R)
    if kind=='ellipsoid':return R*1.45*abs(math.sqrt((x/(R*.8))**2+(y/(R*1.15))**2+(z/(R*1.45))**2)-1)
    if kind=='cylinder':return min(abs(r-d),abs(abs(z)-R))
    if kind=='tube':return min(abs(r-d),abs(r-d*.6),abs(abs(z)-R))
    if kind=='cavity':return min(abs(rad-R),abs(rad-R*.45))
    raise ValueError(kind)

def measure(n,kind,method,stride,out):
    g=grid(n);mask=mask_of(g,kind)
    digest=hashlib.sha256(f'AFE02A-synth:{n}:{kind}'.encode()).hexdigest()
    source=PointSource(digest,'synthetic',fingerprint(g),'SYNTHETIC_VALIDATED',
                       hashlib.sha256(mask).hexdigest(),fingerprint(g))
    tracemalloc.start();start=time.perf_counter()
    points=extract_mask(g,mask,source,method=method,stride=stride)
    ms=1000*(time.perf_counter()-start)
    peak=tracemalloc.get_traced_memory()[1];tracemalloc.stop()
    a=g.affine_lps
    numeric=[math.dist(p.lps_mm,tuple(sum(a[r][c]*p.voxel_crs[c] for c in range(3))+a[r][3] for r in range(3))) for p in points]
    analytic=[analytic_face_error(p,n,kind) for p in points] if method=='faces' else []
    result={'shape':kind,'n':n,'voxels':n**3,'method':method,'stride':stride,
            'points':len(points),'density':len(points)/(n**3),
            'wall_ms':round(ms,3),'tracemalloc_peak_bytes':peak,
            'numeric_max_mm':max(numeric,default=0),
            'analytic_max_mm':max(analytic) if analytic else None,
            'analytic_mean_mm':statistics.fmean(analytic) if analytic else None,
            'analytic_p95_mm':sorted(analytic)[math.ceil(.95*len(analytic))-1] if analytic else None}
    assert result['numeric_max_mm']<1e-8
    if analytic:assert max(analytic)<2*math.sqrt(.5**2+.7**2+1.2**2)
    if out and points:
        meta=export_ply(points,g,source,out/f'{kind}-n{n}-{method}-s{stride}',method=method,stride=stride)
        result['ply_sha256']=meta['ply_sha256'];result['ply_bytes']=meta['ply_bytes']
    return result

def main():
    p=argparse.ArgumentParser();p.add_argument('--out',required=True,type=Path);args=p.parse_args()
    args.out.mkdir(parents=True,exist_ok=True)
    cases=[]
    for n in (24,32,48,64):
        for method,stride in (('centers',1),('faces',1),('faces',8),('adaptive',8)):
            cases.append(measure(n,'sphere',method,stride,args.out if n==32 else None))
    for kind in ('ellipsoid','cylinder','tube','cavity'):
        cases.append(measure(32,kind,'faces',1,args.out))
    data={'schema':'afe02a-phantom-benchmark-v1','python':platform.python_version(),
       'platform':platform.platform(),'cpu_count':os.cpu_count(),
       'environment':'stdlib, single process, no GPU, no parallelism',
       'memory_scope':'tracemalloc Python allocations, not OS RSS',
       'time_scope':'wall-clock extraction, excludes phantom creation/file writing',
       'engineering_numeric_tolerance_mm':1e-8,
       'digital_analytic_bound_mm':2*math.sqrt(.5**2+.7**2+1.2**2),
       'cases':cases}
    (args.out/'benchmark.json').write_text(json.dumps(data,indent=2,sort_keys=True))
    print('AFE02A_BENCHMARK_PASS',len(cases),'cases',len(list(args.out.glob('*.ply'))),'PLY')
    for x in cases:
        if x['n']==32:print('AFE02A_METRIC',json.dumps(x,sort_keys=True))

if __name__=='__main__':main()
