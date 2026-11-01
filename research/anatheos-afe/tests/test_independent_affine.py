"""Independent Gauss-Jordan affine oracle. All inputs synthetic; no patient data."""
import math
import random
import unittest
from afe.geometry import SliceGeometry,build_regular_grid,GeometryError,lps_to_ras

# Predeclared engineering thresholds: inverse 1e-8 voxel, world 1e-8 mm.
MAX_WORLD_MM=1e-8
MAX_INDEX_VOX=1e-8

def independent_inverse(m):
    a=[[float(m[i][j]) for j in range(3)]+[float(i==j) for j in range(3)] for i in range(3)]
    for k in range(3):
        piv=max(range(k,3),key=lambda i:abs(a[i][k]))
        if abs(a[piv][k])<1e-15:raise ValueError('reference singular')
        a[piv],a[k]=a[k],a[piv]
        div=a[k][k];a[k]=[v/div for v in a[k]]
        for j in range(3):
            if j!=k:
                n=a[j][k];a[j]=[x-n*y for x,y in zip(a[j],a[k])]
    return [row[3:] for row in a]

def grid(theta,skew,sx,sy,sz,rev=False):
    c=math.cos(theta);s=math.sin(theta)
    axes=(c,s,0.,-s+skew*c,c+skew*s,0.)
    f=[SliceGeometry((321.5,-187.125,978.25+k*sz),axes,
       (sy,sx),19,27,sz,'MR','synthetic-acquisition','synthetic-phase') for k in range(5)]
    return build_regular_grid(f[::-1] if rev else f)

class IndependentAffineTests(unittest.TestCase):
    def test_100_affines_1000_points(self):
        rng=random.Random(0xAFE01C);mm=[];vox=[]
        for iteration in range(100):
            g=grid(rng.uniform(-math.pi,math.pi),rng.uniform(-9e-5,9e-5),
                   rng.choice((.15,.3,.78,2.7)),rng.choice((.2,1.2,3.2)),
                   rng.choice((.55,1.6,5.)),bool(iteration%2))
            a=g.affine_lps
            ref=independent_inverse([r[:3] for r in a[:3]])
            for j in range(10):
                p=(rng.uniform(0,26),rng.uniform(0,18),rng.uniform(0,4)) if j>3 else (
                  26. if j&1 else 0.,18. if j&2 else 0.,float(j))
                expected=[sum(a[r][k]*p[k] for k in range(3))+a[r][3] for r in range(3)]
                got=g.voxel_to_lps(*p);back=g.lps_to_voxel(expected)
                independent=[sum(ref[i][k]*(expected[k]-a[k][3]) for k in range(3)) for i in range(3)]
                mm.append(max(abs(got[k]-expected[k]) for k in range(3)))
                vox.append(max(max(abs(back[k]-p[k]) for k in range(3)),
                               max(abs(back[k]-independent[k]) for k in range(3))))
                self.assertEqual(lps_to_ras(got),(-got[0],-got[1],got[2]))
        self.assertEqual(len(vox),1000)
        self.assertLess(max(mm),MAX_WORLD_MM)
        self.assertLess(max(vox),MAX_INDEX_VOX)
        print('AFE01C_GAUSS_JORDAN_PASS samples=1000 max_world_mm=%.12g max_inverse_voxel=%.12g p95_voxel=%.12g'%(
            max(mm),max(vox),sorted(vox)[949]))

    def test_singular_reference_rejected(self):
        with self.assertRaises(ValueError):
            independent_inverse([[1,2,3],[2,4,6],[0,0,0]])

    def test_mixed_orientation_rejected(self):
        f=[SliceGeometry((0.,0.,float(i)),(1.,0.,0.,0.,1.,0.),(1.,1.),
           10,10,1.,'CT','a','t') for i in range(4)]
        f[2]=SliceGeometry((0.,0.,2.),(0.,1.,0.,-1.,0.,0.),(1.,1.),10,10,1.,'CT','a','t')
        with self.assertRaisesRegex(GeometryError,'orientation varies'):build_regular_grid(f)

    def test_skew_edges_inverse(self):
        for alpha in (-9e-5,-5e-5,0.,5e-5,9e-5):
            g=grid(.9,alpha,.21,1.6,2.2,True)
            for p in ((0,0,0),(26,18,4),(3.4,7.9,1.1)):
                q=g.lps_to_voxel(g.voxel_to_lps(*p))
                self.assertLess(max(abs(p[i]-q[i]) for i in range(3)),1e-9)
