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


## AFE-01C — Pruebas y límites registrados (2026-11-01)
- Gauss-Jordan independiente, 100 matrices oblicuas/anisótropas y 1000 puntos sintéticos: ejecutado local PASS, max error voxel 1.95399252334e-13; max mundo 5.68434188608e-14 mm; criterios registrados antes de ensayo 1e-8 voxel/mm.
- VTK 9.6.2 de biblioteca **no Slicer**, 15 matrices/60 puntos: ejecutado local PASS; inverso 2.84217094304e-14 voxel, mundo 7.10542735760e-15 mm. Test opcional: en GitHub Actions sin VTK será SKIP, no PASS de Slicer.
- Barrido original JS por Gram: 320 configuraciones/1600 puntos; máximo 2.2568176657265795 voxel, medio 0.07663439360902945, p95 0.4145201884441576. Reproducción de desviación, no aprobado como equivalencia geométrica.
- Public original audit CLI: usa exclusivamente el parser CMR-R1 de metadatos; prueba sintética 4 cortes/4×4, SHA falsificado y fase mixta (rechazos); no es importador DICOM nuevo. Sin imágenes clínicas reales en GitHub.
- Prueba futura Slicer: importación DICOM original y MRML IJK↔RAS + 27 puntos, fuentes y SHA exactos; PREPARADA pero **NO EJECUTADA**. Leeds y LCTSC originales: hashes/licencias corroborados, pero **NO EJECUTADOS EN AFE-01C**. Fuente detallada docs/PUBLIC_CASES.md.


## AFE-01D · Evidencia independiente real
2026-11-01 GitHub Actions 41316484907 SUCCESS, aplicación 3D Slicer 5.12.4 verificada por SHA512 del paquete Linux oficial; importación nativa de imágenes DICOM originales Leeds 144 RM y LCTSC 130 CT, 27 puntos por serie. Resultados AFE vs MRML Slicer: Leeds max world 8.769838994876513e-12 mm, max inverse 2.4023759876461193e-11 vox, max spacing 1.2601031329495527e-14 mm; LCTSC max world 9.845568954283847e-14 mm, max inverse 1.632702903446565e-13 vox, max spacing 4.440892098500626e-16 mm. AMBOS PASS contra umbrales predeclarados 0.01 mm, 1e-4 voxel, 0.001 mm. ZIP fuentes SHA256 comprobados 1c378e... y 0e02554... exactos, no inferidos por apariencia. Resultados sanitizados en artifact 13087577789. No equivalencia clínica/píxeles/temporalidad. Rerun y matrices exportadas enriquecidas posteriores bajo nuevos SHAs se documentarán en PR #75.


## AFE-02A · Point cloud regressions and independent mathematical gates
- Python tests/test_points.py: 7 additional named tests, each testing all five shapes and thousands of source-registered points, independent homogeneous-affine oracle, analytic digital boundary upper bound, deterministic 4x stride, adaptive small-object preservation, reverse original slice order and LPS/RAS, sparse public acquired-plane constraint, malformed mask/mismatched SHA/grid/label/confidence/over-limit/cancel fail closed, and PLY + sidecar integrity/rejection of overwrite. No image/patient data.
- Numeric engineering gate before tests: <1e-8 mm physical coordinate vs independent affine; digital surface upper bound 2*sqrt(.5^2+.7^2+1.2^2) = 2.953 mm (not clinical precision; discretization surrogate only).
- Benchmark tools/run_point_phantoms.py runs 20 cases: n=24,32,48,64 sphere with centers/faces/8x decimation/adaptive, and ellipsoid/cylinder/tube/cavity face samples at n=32. Metrics include memory, wall time, surface distance, counts, density and deterministic PLY SHA. Synthetic artifacts (PLY/JSON) are for private Drive transfer, not public repo.
- Real public smoke tools/run_public_sparse.py uses only hash-checked AFE-01D cases of Leeds MR and LCTSC CT. Each selects 27 integer original acquisition positions (3x3x3). No masks, segmentation, interpolation, intensity values or anatomical label. Status remains ACCEPTED_SPATIAL_ONLY; eligible continuous volume false. AFE-01D Slicer matrix comparison remains a separate prior PASS.

## AFE-02A-H1 · CCG-2026-001 adversarial PLY exporter gate (2026-11-01)
- **Defect AFE-02A-DIR-001:** a caller could forge an immutable Sample's LPS position (+100 mm), source_frame_index (999), or state acquired_plane under centers and obtain a signed-bytes PLY/JSON. Source/hash metadata alone was not a proof of claimed geometry.
- **Remediation:** export_ply rechecks all sample CRS positions, world LPS via active affine, underlying source voxel bounds, reversed original frame order, explicit sample method/kind/state/face and source scope BEFORE creating output directories or files. Numerical software tolerances: LPS <=1e-8 mm, integer voxel/face offset <=1e-9 voxel. Not clinical claims. Reject unsupported method/stride. No masks, original DICOM or PHI added.
- **Tests in tests/test_points.py:** adversarial LPS +100 mm, frame=999, forged acquired_plane, invalid center lattice, outside grid, forbidden face ID; assert rejection and absence of output directory; valid reversed-order exposed boundary faces with PLY numeric roundtrip and original-frame readback; positive centers/adaptive/sparse acquired-plane; wrong method/stride fail-closed.
- **Important limit:** the output boundary verifies LPS↔affine↔CRS and claimed source-frame/method coherence, but does NOT re-read mask pixels to authenticate exposed-mask occupancy, nor re-open original DICOM to validate scanner-level truth. Synthetic mask byte hash check stays upstream in extract_mask; public source SHA attestation stays in preflight. Clinical geometry, surfaces, cross-series registration and deployment remain unauthorized.
- **CI status:** determine from the final HEAD's GitHub workflow run and record actual PASS/FAIL/SKIP in PR #75; a passing old workflow or previous HEAD does not count.
