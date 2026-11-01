"""Synthetic CMR-R2 adapter tests; no real study, UID, or pixel file."""
import hashlib
import json
import unittest
from copy import deepcopy
from afe.cmr_adapter import adapt_cmr_r2, ContractError, SCHEMA, INTEGRITY_SCHEMA


def sha(x):return hashlib.sha256(str(x).encode()).hexdigest()


def fixtures(step=1,thickness=1,mode='pila_2d_revisar_3d'):
    frames=[]
    for i in range(4):
        frames.append(dict(
            study_instance_uid='SYNTHETIC-STUDY',series_instance_uid='SYNTHETIC-SERIES',
            frame_of_reference_uid='SYNTHETIC-FRAME',modality='MR',image_type='ORIGINAL\\PRIMARY',
            source_sha256=sha('synthetic frame '+str(i)),
            image_position_patient_LPS_mm=[10.,20.,30.+step*i],
            image_orientation_patient_LPS=[1.,0.,0.,0.,1.,0.],
            pixel_spacing_row_col_mm=[2.,3.],trigger_time_ms=0.,
            temporal_position_identifier=1,photometric_interpretation='MONOCHROME2',
            rescale_slope=1.,rescale_intercept=0.,
            acquisition={'scan_sequence':'SE','sequence_variant':'NONE','tr':500.,
                         'te':20.,'ti':None,'slice_thickness':thickness,
                         'slice_spacing':step,'kvp':None,'convolution_kernel':None}))
    zhash=sha('synthetic original ZIP, never patient data')
    catalog={'schema':SCHEMA,'origen_zip_sha256_PRIVADO':zhash,
             'series':[{'serie_local':'RM-001','estado':'preparada','modo_seguro':mode,'instancias':4}]}
    geom={'schema':SCHEMA,'serie_local':'RM-001','source_zip_sha256':zhash,'frames':frames}
    manifest={'schema':INTEGRITY_SCHEMA,'source_zip_sha256':zhash,'pixels_sha256':sha('synthetic pixels')}
    return catalog,geom,manifest


def execute(catalog,geom,manifest,shape=(4,12,16)):
    raw=json.dumps(geom,sort_keys=True,separators=(',',':')).encode()
    integrity=deepcopy(manifest)
    if 'geometria_sha256' not in integrity:
        integrity['geometria_sha256']=hashlib.sha256(raw).hexdigest()
    return adapt_cmr_r2(catalog,raw,integrity,'RM-001',shape)


class AdapterTests(unittest.TestCase):
    def reject(self,code,change):
        cat,geo,manifest=fixtures()
        change(cat,geo,manifest)
        with self.assertRaises(ContractError) as e:
            execute(cat,geo,manifest)
        self.assertEqual(e.exception.code,code)

    def test_normalized_metadata_affine(self):
        result=execute(*fixtures())
        self.assertEqual(result.geometry.dimensions_crs,(16,12,4))
        self.assertEqual(result.geometry.voxel_to_lps(2,3,1),(16.,26.,31.))
        self.assertEqual(result.validation_scope,'metadata consistency only; motion/registration not verified')
        self.assertNotIn('STUDY',str(result))  # no identifying values returned

    def test_sorted_reversed_source(self):
        c,g,m=fixtures();g['frames'].reverse()
        self.assertEqual(execute(c,g,m).geometry.sorted_source_indices,(3,2,1,0))

    def test_regular_grid_gapped_not_volume(self):
        result=execute(*fixtures(step=2,thickness=1))
        self.assertTrue(result.geometry.interpolation_required)
        self.assertFalse(result.geometry.volume_eligible)

    def test_missing_sequence(self):
        self.reject('ACQUISITION_UNVERIFIED',lambda c,g,m:g['frames'][0]['acquisition'].update(scan_sequence=None))

    def test_mixed_sequence(self):
        self.reject('MIXED_ACQUISITION',lambda c,g,m:g['frames'][1]['acquisition'].update(te=30.))

    def test_missing_temporal_markers(self):
        self.reject('TEMPORAL_UNVERIFIED',lambda c,g,m:[f.update(trigger_time_ms=None,temporal_position_identifier=None) for f in g['frames']])

    def test_temporal_mix(self):
        self.reject('MIXED_PHASES',lambda c,g,m:g['frames'][2].update(temporal_position_identifier=2))

    def test_dynamic_mode(self):
        self.reject('MODE_NOT_ELIGIBLE',lambda c,g,m:c['series'][0].update(modo_seguro='cine_provisional'))

    def test_dynamic_image_type(self):
        self.reject('DYNAMIC_IMAGE_BLOCKED',lambda c,g,m:[f.update(image_type='DYNAMIC\\PRIMARY') for f in g['frames']])

    def test_missing_frame_hash(self):
        self.reject('FRAME_SOURCE_NOT_VERIFIED',lambda c,g,m:g['frames'][1].update(source_sha256=None))

    def test_duplicate_frame_hash(self):
        self.reject('FRAME_SOURCE_NOT_VERIFIED',lambda c,g,m:g['frames'][1].update(source_sha256=g['frames'][0]['source_sha256']))

    def test_frame_reference_mismatch(self):
        self.reject('MIXED_STUDY_SERIES_OR_REFERENCE',lambda c,g,m:g['frames'][2].update(frame_of_reference_uid='OTHER-SYNTHETIC'))

    def test_missing_reference(self):
        self.reject('FRAME_IDENTIFIERS_ABSENT',lambda c,g,m:g['frames'][0].update(series_instance_uid=''))

    def test_catalog_mismatch(self):
        self.reject('SERIES_NOT_PREPARED',lambda c,g,m:c['series'][0].update(estado='bloqueada'))

    def test_source_manifest_mismatch(self):
        self.reject('SOURCE_HASH_CHAIN_MISMATCH',lambda c,g,m:m.update(source_zip_sha256=sha('different')))

    def test_geometry_hash_tamper(self):
        c,g,m=fixtures()
        m['geometria_sha256']=sha('not the actual geometry')
        with self.assertRaisesRegex(ContractError,'GEOMETRY_HASH_MISMATCH'):
            execute(c,g,m)

    def test_size_mismatch(self):
        c,g,m=fixtures()
        with self.assertRaisesRegex(ContractError,'FRAME_COUNT_MISMATCH'):
            execute(c,g,m,shape=(3,12,16))

    def test_derived_not_original(self):
        c,g,m=fixtures()
        for frame in g['frames']:frame['image_type']='DERIVED\\SECONDARY'
        self.assertEqual(execute(c,g,m).geometry.source_kind,'derived')

    def test_geometry_no_automatic_claim(self):
        c,g,m=fixtures()
        result=execute(c,g,m)
        self.assertNotIn('motion verified',result.validation_scope)
        self.assertEqual(result.geometry.reasons,())


if __name__=='__main__': unittest.main()
