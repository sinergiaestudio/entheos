"""Optional external VTK oracle. VTK is NOT 3D Slicer; CI records SKIP if absent."""
import importlib.util
import math
import unittest
from afe.geometry import SliceGeometry,build_regular_grid
vtk_available=importlib.util.find_spec('vtk') is not None
if vtk_available:import vtk

@unittest.skipUnless(vtk_available,'VTK not installed (do not count as PASS)')
class VTKOracleTests(unittest.TestCase):
    def test_15_matrices_60_points(self):
        cases=0;points=0;worst_world=0.;worst_inverse=0.
        for theta in (0.,.21,.71,1.23,2.9):
            c=math.cos(theta);s=math.sin(theta)
            for alpha in (-.00009,0.,.00009):
                axes=(c,s,0.,-s+alpha*c,c+alpha*s,0.)
                f=[SliceGeometry((12.1,-23.4,90.+k*1.3),axes,(.7,.25),
                   64,128,1.3,'MR','synthetic','single-phase') for k in range(5)]
                g=build_regular_grid(f);m=vtk.vtkMatrix4x4()
                for i in range(4):
                    for j in range(4):m.SetElement(i,j,g.affine_lps[i][j])
                inv=vtk.vtkMatrix4x4();vtk.vtkMatrix4x4.Invert(m,inv)
                cases+=1
                for q in ((0.,0.,0.),(127.,63.,4.),(63.5,31.5,2.),(2.7,4.1,3.25)):
                    world=m.MultiplyPoint((*q,1.))
                    orig=g.voxel_to_lps(*q)
                    back=inv.MultiplyPoint(world)
                    afe=g.lps_to_voxel(world[:3])
                    worst_world=max(worst_world,max(abs(world[i]-orig[i]) for i in range(3)))
                    worst_inverse=max(worst_inverse,
                        max(abs(back[i]-q[i]) for i in range(3)),
                        max(abs(afe[i]-back[i]) for i in range(3)))
                    points+=1
        print('AFE01C_VTK_ONLY_PASS cases=%d samples=%d max_world_mm=%.12g max_inverse_voxel=%.12g'%(
            cases,points,worst_world,worst_inverse))
        self.assertEqual((cases,points),(15,60))
        self.assertLess(worst_world,1e-9)
        self.assertLess(worst_inverse,1e-9)
