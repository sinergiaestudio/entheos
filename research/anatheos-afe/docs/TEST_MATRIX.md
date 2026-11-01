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
