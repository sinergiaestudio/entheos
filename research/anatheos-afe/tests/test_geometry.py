"""AFE-01 synthetic-only geometry regression; Python stdlib unittest."""
import math
import unittest
from dataclasses import replace
from afe.geometry import (GeometryError, SliceGeometry, build_regular_grid,
                          lps_to_ras, ras_to_lps, ct_rescale_to_hu)


def synthetic(z, *, ipp=None, iop=(1,0,0,0,1,0), spacing=(2.,3.), thickness=1.,
              acquisition='synthetic-single-acquisition', temporal='fixed-phase', source='original'):
    return SliceGeometry(ipp_lps_mm=ipp if ipp is not None else (10.,20.,30.+z), iop=iop,
                         spacing_row_col_mm=spacing, rows=12, columns=16,
                         slice_thickness_mm=thickness, modality='CT',
                         acquisition_key=acquisition, temporal_key=temporal, source_kind=source)


class GeometryTests(unittest.TestCase):
    def setUp(self):
        self.frames = [synthetic(z) for z in range(4)]

    def bad(self, frames, fragment):
        with self.assertRaisesRegex(GeometryError, fragment):
            build_regular_grid(frames)

    def test_anisotropic_affine_and_inverse(self):
        g=build_regular_grid(self.frames)
        self.assertEqual(g.dimensions_crs,(16,12,4))
        self.assertEqual(g.voxel_to_lps(2,3,1),(16.,26.,31.))
        self.assertEqual(g.lps_to_voxel((16.,26.,31.)),(2.,3.,1.))
        self.assertEqual(g.affine_lps,((3.,0.,0.,10.),(0.,2.,0.,20.),(0.,0.,1.,30.),(0.,0.,0.,1.)))

    def test_sorted_reversed_acquisition(self):
        g=build_regular_grid(list(reversed(self.frames)))
        self.assertEqual(g.sorted_source_indices,(3,2,1,0))
        self.assertEqual(g.voxel_to_lps(0,0,0),(10.,20.,30.))

    def test_oblique_world_distance(self):
        t=math.pi/6; iop=(math.cos(t),math.sin(t),0,-math.sin(t),math.cos(t),0)
        f=[synthetic(z,iop=iop) for z in range(4)]
        g=build_regular_grid(f)
        p=g.voxel_to_lps(3.,4.,2.)
        self.assertAlmostEqual(math.dist(p,(10,20,32)),math.sqrt((3*3)**2+(4*2)**2))
        for actual,expected in zip(g.lps_to_voxel(p),(3,4,2)): self.assertAlmostEqual(actual,expected,places=10)

    def test_inverted_laterality(self):
        f=[synthetic(z,iop=(-1,0,0,0,-1,0)) for z in range(4)]
        g=build_regular_grid(f)
        self.assertEqual(g.voxel_to_lps(1,2,0),(7.,16.,30.))
        self.assertEqual(lps_to_ras(g.voxel_to_lps(1,2,0)),(-7.,-16.,30.))

    def test_ras_roundtrip(self):
        self.assertEqual(ras_to_lps(lps_to_ras((13.,-8.,42.))),(13.,-8.,42.))

    def test_duplicate_positions(self):
        self.bad(self.frames+[self.frames[-1]],'duplicate')

    def test_missing_slice_irregular(self):
        self.bad([self.frames[0],self.frames[1],self.frames[3]],'irregular')

    def test_out_of_plane_drift(self):
        f=self.frames.copy();f[2]=replace(f[2],ipp_lps_mm=(10.25,20.,32.))
        self.bad(f,'drift')

    def test_inconsistent_orientation(self):
        f=self.frames.copy();f[1]=replace(f[1],iop=(0.,1.,0.,-1.,0.,0.))
        self.bad(f,'orientation varies')

    def test_nonorthogonal_orientation(self):
        f=self.frames.copy();f[1]=replace(f[1],iop=(1.,0.,0.,0.1,1.,0.))
        self.bad(f,'nonorthonormal')

    def test_zero_spacing(self):
        f=self.frames.copy();f[1]=replace(f[1],spacing_row_col_mm=(0.,3.))
        self.bad(f,'PixelSpacing')

    def test_different_spacing(self):
        f=self.frames.copy();f[2]=replace(f[2],spacing_row_col_mm=(2.1,3.))
        self.bad(f,'PixelSpacing varies')

    def test_missing_thickness(self):
        f=self.frames.copy();f[2]=replace(f[2],slice_thickness_mm=float('nan'))
        self.bad(f,'SliceThickness')

    def test_thickness_gap(self):
        f=[replace(synthetic(z*2),slice_thickness_mm=1.) for z in range(4)]
        self.bad(f,'thickness gap')

    def test_mixed_phase(self):
        f=self.frames.copy();f[1]=replace(f[1],temporal_key='different-phase')
        self.bad(f,'mixed acquisition')

    def test_mixed_acquisition(self):
        f=self.frames.copy();f[1]=replace(f[1],acquisition_key='different-sequence')
        self.bad(f,'mixed acquisition')

    def test_missing_acquisition_proof(self):
        f=self.frames.copy();f[0]=replace(f[0],acquisition_key='')
        self.bad(f,'unverified acquisition')

    def test_mixed_dimensions(self):
        f=self.frames.copy();f[1]=replace(f[1],columns=20)
        self.bad(f,'mixed image dimensions')

    def test_invalid_modality(self):
        f=self.frames.copy();f[0]=replace(f[0],modality='US')
        self.bad(f,'unsupported modality')

    def test_no_false_original_from_derived(self):
        g=build_regular_grid([replace(f,source_kind='derived') for f in self.frames])
        self.assertEqual(g.source_kind,'derived')

    def test_mixed_source_rejected(self):
        f=self.frames.copy();f[1]=replace(f[1],source_kind='derived')
        self.bad(f,'mixed acquisition')

    def test_short_stack_rejected(self):
        self.bad(self.frames[:2],'three slices')

    def test_mr_never_claimed_hu(self):
        with self.assertRaisesRegex(GeometryError,'HU conversion'):
            ct_rescale_to_hu(100.,1.,-1024.,'MR','HU')

    def test_ct_hu_requires_explicit_unit(self):
        with self.assertRaisesRegex(GeometryError,'HU conversion'):
            ct_rescale_to_hu(100.,1.,-1024.,'CT','unknown')
        self.assertEqual(ct_rescale_to_hu(100.,2.,-1024.,'CT','HU'),-824.)

    def test_nan_position_rejected(self):
        f=self.frames.copy();f[1]=replace(f[1],ipp_lps_mm=(float('nan'),20.,31.))
        self.bad(f,'nonfinite')

    def test_fractional_voxel_roundtrip(self):
        g=build_regular_grid(self.frames)
        for p in ((.4,2.6,1.25),(12,8,-.5)):
            q=g.lps_to_voxel(g.voxel_to_lps(*p))
            for v,w in zip(q,p):self.assertAlmostEqual(v,w,places=10)


if __name__ == '__main__':
    unittest.main()
