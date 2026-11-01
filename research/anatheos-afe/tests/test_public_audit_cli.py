"""Only synthetic Part10 bytes, never Leeds or LCTSC cases."""
import hashlib
import json
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch
import sys
import tempfile
import zipfile
from tools.prepare_public_case import main
from test_part10_phantoms import phantom

class PublicAuditHarnessTests(TestCase):
    def run_case(self,scenario=None):
        with tempfile.TemporaryDirectory() as base:
            root=Path(base);archive=root/'SYNTHETIC_ONLY.zip';out=root/'case.json'
            with zipfile.ZipFile(archive,'w') as z:
                for i in range(4):
                    raw=phantom(i,temporal=2 if scenario=='mixed_phase' and i==2 else 1)
                    z.writestr('SYNTHETIC_%d.dcm'%i,raw)
            sha=hashlib.sha256(archive.read_bytes()).hexdigest()
            if scenario=='wrong_digest':sha='0'*64
            args=['prepare_public_case.py','--zip',str(archive),
                  '--expected-sha256',sha,'--case-id','SYNTHETIC-MR-TEST',
                  '--license','SYNTHETIC-NO-LICENSE','--output',str(out)]
            with patch.object(sys,'argv',args):
                if scenario=='wrong_digest':
                    with self.assertRaisesRegex(ValueError,'SOURCE_ZIP_HASH_MISMATCH'):main()
                elif scenario=='mixed_phase':
                    with self.assertRaisesRegex(ValueError,'MIXED_TEMPORAL_PHASE'):main()
                else:
                    self.assertEqual(main(),0)
                    report=json.loads(out.read_text(encoding='utf8'))
                    self.assertEqual(report['frames'],4)
                    self.assertEqual(report['dimensions_crs'],[4,4,4])
                    self.assertEqual(len(report['sha256_by_member']),4)
                    self.assertTrue(report['volume_eligible'])
    def test_synthetic_happy_path(self):self.run_case()
    def test_reject_bad_source_sha(self):self.run_case('wrong_digest')
    def test_reject_mixed_phase(self):self.run_case('mixed_phase')
