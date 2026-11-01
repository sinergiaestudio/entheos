"""AFE-02A synthetic only: analytic shape checks and hard provenance/geometry gates."""
import hashlib,math,tempfile,unittest,json
from pathlib import Path
from afe.geometry import VolumeGeometry,lps_to_ras
from afe.points import PointSource,PointError,extract_mask,acquired_plane_samples,fingerprint
from afe.point_io import export_ply

def grid(n=25,rev=False):
    c,s=math.cos(.37),math.sin(.37)
    return VolumeGeometry((14.,-28.,42.),(.5*c,.5*s,0.),(-.7*s,.7*c,0.),
          (0.,0.,1.2),(n,n,n),tuple(reversed(range(n))) if rev else tuple(range(n)),'MR','original')

def evidence(g,mask,**kwargs):
    h=hashlib.sha256(b'AFE02A:synth:v1').hexdigest()
    return PointSource(h,'synthetic',fingerprint(g),'SYNTHETIC_VALIDATED',
                       hashlib.sha256(mask).hexdigest(),fingerprint(g),**kwargs)

def phantom(g,kind):
    n=g.dimensions_crs[0];h=(n-1)/2.;m=bytearray(n**3)
    for k in range(n):
        for j in range(n):
            for i in range(n):
                x=(i-h)*.5;y=(j-h)*.7;z=(k-h)*1.2;r=math.hypot(x,y);d=math.sqrt(x*x+y*y+z*z)
                if kind=='sphere':hit=d<=5
                elif kind=='ellipsoid':hit=(x/4)**2+(y/6)**2+(z/7)**2<=1
                elif kind=='cylinder':hit=r<=4 and abs(z)<=6
                elif kind=='tube':hit=2<=r<=4 and abs(z)<=6
                elif kind=='cavity':hit=2<=d<=6
                else:raise ValueError(kind)
                m[(k*n+j)*n+i]=bool(hit)
    return m

class AFEPointTests(unittest.TestCase):
    def test_five_analytic_phantoms(self):
        g=grid()
        for kind in ('sphere','ellipsoid','cylinder','tube','cavity'):
            with self.subTest(kind=kind):
                m=phantom(g,kind);e=evidence(g,m)
                inside=extract_mask(g,m,e,method='centers')
                faces=extract_mask(g,m,e,method='faces')
                self.assertGreater(len(inside),50);self.assertGreater(len(faces),50)
                self.assertTrue(all(p.label=='unknown' for p in inside+faces))
                self.assertTrue(all(p.state=='derived' and 0<=p.face_id<6 for p in faces))
                for q in inside+faces:
                    i,j,k=q.voxel_crs
                    oracle=tuple(g.origin_lps_mm[a]+i*g.column_vector_mm[a]+
                                 j*g.row_vector_mm[a]+k*g.slice_vector_mm[a] for a in range(3))
                    self.assertLess(math.dist(oracle,q.lps_mm),1e-9)
                    self.assertEqual(lps_to_ras(q.lps_mm),(-q.lps_mm[0],-q.lps_mm[1],q.lps_mm[2]))
                diag=math.sqrt(.5**2+.7**2+1.2**2)
                for q in faces:
                    i,j,k=q.voxel_crs;x=(i-12)*.5;y=(j-12)*.7;z=(k-12)*1.2
                    r=math.hypot(x,y);d=math.sqrt(x*x+y*y+z*z)
                    if kind=='sphere':dist=abs(d-5)
                    elif kind=='ellipsoid':dist=7*abs(math.sqrt((x/4)**2+(y/6)**2+(z/7)**2)-1)
                    elif kind=='cylinder':dist=min(abs(r-4),abs(abs(z)-6))
                    elif kind=='tube':dist=min(abs(r-2),abs(r-4),abs(abs(z)-6))
                    else:dist=min(abs(d-2),abs(d-6))
                    self.assertLessEqual(dist,2*diag)
    def test_repeatable_downsampling(self):
        g=grid();m=phantom(g,'sphere');e=evidence(g,m)
        full=extract_mask(g,m,e,method='faces')
        sparse=extract_mask(g,m,e,method='faces',stride=4)
        self.assertEqual(sparse,extract_mask(g,m,e,method='faces',stride=4))
        self.assertEqual(len(sparse),math.ceil(len(full)/4))
    def test_adaptive_small_boundary(self):
        g=grid(15);m=bytearray(15**3);m[0]=1
        for k in range(4,11):
            for j in range(4,11):
                for i in range(4,11):m[(k*15+j)*15+i]=1
        e=evidence(g,m)
        ordinary=extract_mask(g,m,e,method='centers',stride=20)
        adaptive=extract_mask(g,m,e,method='adaptive',stride=20)
        self.assertGreater(len(adaptive),len(ordinary))
        self.assertIn((0.,0.,0.),[q.voxel_crs for q in adaptive])
    def test_original_reverse_and_lateral(self):
        g=grid(5,True);m=bytearray(125);m[0]=1;m[100]=1
        pts=extract_mask(g,m,evidence(g,m))
        self.assertEqual([p.source_frame_index for p in pts],[4,0])
        self.assertLess(lps_to_ras(pts[0].lps_mm)[0],0)
    def test_public_original_planes_no_interpolation(self):
        g=grid(144);h=hashlib.sha256(b'public-source').hexdigest()
        e=PointSource(h,'public_sha_verified',fingerprint(g),'ACCEPTED_SPATIAL_ONLY')
        p=acquired_plane_samples(g,e,[(0,0,0),(143,143,143)])
        self.assertEqual([q.source_frame_index for q in p],[0,143])
        self.assertTrue(all(q.label=='unknown' and q.sample_kind=='acquired_plane' for q in p))
        with self.assertRaisesRegex(PointError,'NOT_ACQUIRED_GRID_COORDINATE'):
            acquired_plane_samples(g,e,[(1,1,.5)])
        with self.assertRaisesRegex(PointError,'MASK_GATE_REQUIRES'):
            extract_mask(g,bytearray(1),e)
    def test_safe_rejection_caps_hash_and_labels(self):
        g=grid(4);m=bytearray(64);m[0]=1;e=evidence(g,m)
        bad=PointSource(e.source_sha256,'synthetic','0'*64,'SYNTHETIC_VALIDATED',
                        e.mask_source_sha256,e.mask_geometry_sha256)
        with self.assertRaisesRegex(PointError,'GEOMETRY_SOURCE_MISMATCH'):extract_mask(g,m,bad)
        with self.assertRaisesRegex(PointError,'MASK_BYTES_SHA_MISMATCH'):extract_mask(g,bytearray(64),e)
        with self.assertRaisesRegex(PointError,'MASK_DIMENSIONS_MISMATCH'):extract_mask(g,m[:-1],e)
        with self.assertRaisesRegex(PointError,'ANATOMICAL_LABEL_GATE_NOT_APPROVED'):
            extract_mask(g,m,evidence(g,m,label='liver'))
        with self.assertRaisesRegex(PointError,'LABEL_OR_CONFIDENCE_NOT_CALIBRATED'):
            extract_mask(g,m,evidence(g,m,calibrated_confidence=.98))
        m[2]=2
        with self.assertRaisesRegex(PointError,'MASK_NOT_BINARY'):extract_mask(g,m,e)
        solid=bytearray([1]*64);same=evidence(g,solid)
        with self.assertRaisesRegex(PointError,'POINT_MEMORY_LIMIT'):
            extract_mask(g,solid,same,max_points=2)
        with self.assertRaisesRegex(PointError,'CANCELLED_NO_PARTIAL_OUTPUT'):
            extract_mask(g,solid,same,cancel=lambda:True)
        with self.assertRaisesRegex(PointError,'VOXEL_MEMORY_LIMIT'):
            extract_mask(grid(200),bytearray(1),evidence(grid(200),bytearray(1)))
    def test_export_ply_recovery(self):
        g=grid(5);m=bytearray(125);m[0]=m[124]=1;e=evidence(g,m)
        pts=extract_mask(g,m,e,method='faces')
        with tempfile.TemporaryDirectory() as tmp:
            stem=Path(tmp)/'points'
            result=export_ply(pts,g,e,stem,method='faces',stride=1)
            content=stem.with_suffix('.ply').read_bytes()
            self.assertEqual(hashlib.sha256(content).hexdigest(),result['ply_sha256'])
            self.assertEqual(len(content.decode().split('end_header\n',1)[1].splitlines()),len(pts))
            self.assertEqual(json.loads(stem.with_suffix('.json').read_text())['point_count'],len(pts))
            with self.assertRaisesRegex(PointError,'NO_OVERWRITE_EXISTING_EXPORT'):
                export_ply(pts,g,e,stem,method='faces',stride=1)
