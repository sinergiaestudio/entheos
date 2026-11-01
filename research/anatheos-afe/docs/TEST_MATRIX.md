# Test matrix: executable vs still pending

## Executed on 2026-11-01 (local Python, synthetic metadata ONLY)

```bash
cd research/anatheos-afe
python -m unittest discover -s tests -v
# Ran 26 tests in 0.002s — OK
```

Positive: anisotropic affine + inverse and matrix, oblique 30°, reversed acquisition, inverted LPS lateral direction, LPS/RAS roundtrip, derived-source preservation and fractional coordinate roundtrip.

Negative: repeated position, missing slice/irregular spacing, off-normal drift, changed IOP, nonorthogonality, zero/variable spacing, missing/invalid SliceThickness, acquisition-thickness gaps, mixed phase, mixed acquisition, no validated context, changed dimensions, unsupported modality, mixed source, short stack, NaN input and unjustified CT HU/MR HU.

**CI status:** pending first Actions run until an actual HEAD workflow result is read. The local 26/26 does not establish CI success.

## Not executed (do not mark PASS)

- Synthetic Part10 DICOM decoding, malformed/Enhanced DICOM, transfer syntax JPEG2000, variable frames and CMR adapter end-to-end.
- Independent JavaScript spatial-reference cross-check using same data/affine matrices.
- Public licensed Leeds/LCTSC full-stack and expert-mask geometry; SHA checks.
- 3D Slicer external orientation, distance and reconstructed anatomy evaluation.
- Windows 10/11 physical acceptance, resource benchmark, motion/registration, segmentation, Gaussian Splatting, professional/diagnostic validation.

## Acceptance policy

Reject invalid geometry loudly; preserve source frame order index mapping; never infer registered anatomy, physical resolution or tissue classes. When a gate was not run, say NOT RUN; when external files are unavailable, say BLOCKED and record why.


## Executed AFE-01B — final synthetic evidence at SHA 17d11e19799b14fbd71251032f2201cb9ea60371

- `python -m unittest discover -s tests -v`: **57 tests, all PASS** (includes 31 geometry, 19 CMR adapter, 7 Part10 in-memory phantom/parsing tests). The Part10 generator uses standard DICM preamble, Explicit VR LE metadata and basic synthetic MR pixels; conformance to the complete MR Image IOD was NOT checked with an independent validator.
- `PYTHONPATH=. python tests/make_crosscheck_fixtures.py /tmp/afe-crosscheck.json`: 5 deterministic cases, 20 points, analytic DICOM equation.
- `node tests/crosscheck_existing.mjs /tmp/afe-crosscheck.json`: Python AFE / existing unmodified JS / analytic reference **PASS**. Maximum deviations: JS forward 0 mm, AFE forward 0 mm (for chosen exactly representable/reference samples); AFE inverse 1.4210854715202004e-14 vox; JS orthonormal inverse 7.105427357601002e-15 vox; JS rounded-skew inverse 0.006199999999999761 vox; normalized plane normal difference 0.
- First interop CI iteration on `5ff263a...` FAIL: runner script did not add project directory to PYTHONPATH. Corrected in `17d11e1...`; rerun AFE CI and general CI SUCCESS. No public or private DICOM data involved.
- Safety negatives: invalid/missing geometry and hashes, mixed identity/phase/contrast, dynamic mode, invalid/missing markers, duplicate positions, irregular sample spacing, off-normal drift, singular and ill-conditioned affine, unjustified MR→HU. Regular gap returns an explicit non-eligible grid, not a fabricated continuous volume.
- **No source-independent DICOM conformance**, Slicer, public Leeds/LCTSC or Windows physical test in this loop. All numerical tolerances are research engineering thresholds. See PR #75 for final HEAD and CI after documentation-only update.
