# AFE Architecture — initial boundary audit (2026-11-01)

## Sources inspected

- PR #73 frozen HEAD `f1f34e32c4fffc39d30ba88623cdba0a6509f853`, previous baseline #72 `ea317067fb409845b3c702180c387a21fed179e9`, separate #74 active UX line.
- Live GitHub source modules: `demos/anatheos-local-v0.5/spatial-reference.mjs`, `eligible-volume.mjs`, `volumetric.js`, `mask-to-surface.mjs`, `surface-core.mjs`; CMR-R2 `preparar_todas_las_series.py`.
- Private CMR-R2 integration contract `anatheos-cmr-r2-private-v1`, existing Master Plan, issues #6/#10/#12 and direction comment on #73.

## Reuse decision (no duplication of existing viewer)

| Existing capability | Evidence / boundary | AFE action |
| --- | --- | --- |
| Frame pixel ↔ patient LPS | `spatial-reference.mjs`; original IOP, IPP, row/column spacing, coordinates and plane intersection | Retain as consumer reference; independent testable Python normalization for computational kernel, compare later against JS |
| Conservative candidate stack gating | `spatial-reference.mjs eligibility` + `eligible-volume.mjs` | Match and increase negative-case coverage, do not reinterpret acceptance as clinical |
| Raw volume + GPU view | `volumetric.js` with display R8 texture (not original pixel fidelity) | Reuse on eventual integration; AFE must not add another GPU viewer |
| Same-study mask and surfaces | `mask-to-surface.mjs`, `continuous-mask-surface.mjs`, `surface-core.mjs` | Reuse or compare; no new clinical semantics by intensity |
| Original ZIP ingest, JPEG2000 and CMR catalog | `research/anatheos-cmr/r2/` and existing Windows app | **Never duplicate**; future read-only adapter |
| Public Leeds/LCTSC fixtures and masks | pre-existing research/CI via #73/#74 | Reuse validated public artifacts after license/hash review; no datasets copied in AFE |
| Independent 3D Slicer | protocol exists; result pending | Validation gate only; not performed here |

## Layers

1. **Ingestion adapter (future, read-only)**: existing CMR-R2/R3 normalized frames; validates provenance, coordinate units, phase/acquisition signature and source rights. Raw patient metadata does not enter public logs.
2. **Physical core (implemented, Python stdlib)**: `SliceGeometry` → `build_regular_grid()` → `VolumeGeometry`; regular-grid preflight, ordered original frame indices, LPS mm physical affine and explicit LPS↔RAS. Fails closed on unsupported geometry.
3. **Point cloud (future)**: derived mask/isosurface points with physical coordinates, sampling rule, source label and uncertainty; no tissue inference from intensity.
4. **Surface/mesh (future)**: independent geometry tests and adapters to existing surface code; validate dimensions, topology, winding, and LPS/RAS before future bridge.
5. **Semantic field (future)**: versioned mask/label mapping with source/expert/algorithm and unknown state, verified same-grid alignment; no AI without audit.
6. **Visualization/UX**: **outside AFE**; remains in ANATHEOS main development; no code import into existing app until approved.

### Current input and output

Input: list of `SliceGeometry` records containing synthetic-safe numeric IPP/IOP/PixelSpacing, dimensions, SliceThickness, modality, validated opaque acquisition/temporal discriminator and `original|derived` state. Caller guarantees no mixed study/UID context and no PHI. Output: `VolumeGeometry` with sorted input indices and 4x4 LPS affine. Indexing order `(column,row,slice)`; `ImageOrientationPatient[:3]` is direction along increasing column; `IOP[3:]` along increasing row. Slice spacing comes from measured positions along the normal, not thickness. No interpolation or resampling. Derived acquisitions remain marked derived.

**Limitations:** motion and frame-of-reference cannot be validated by this bare numeric contract; a trusted upstream gate must establish eligibility. Strict tangential-drift rejection excludes gantry tilt and other regular shears. Tests are software synthetic, not scanner calibration, clinical accuracy or Slicer comparison. Tolerances are software rejection heuristics only.


## AFE-01B implementation audit — 2026-11-01

**Adapter:** `afe/cmr_adapter.py` reads only existing CMR-R2 catalog, private geometry JSON bytes, existing R2 integrity manifest and *upstream verified* NPY shape. No DICOM/NPY parser, network, filesystem or pixel read in the new adapter. Guards: schema, same prepared local-series entry, non-dynamic mode, catalog+geometry+manifest ZIP source hash equality, SHA256 of geometry bytes vs manifest, declared pixel hash, unique declared frame source hashes, same transient study/series/FrameOfReference identity, MR sequence/TR/TE/acquisition+contrast tuple, nonempty constant temporal markers and valid IPP/IOP/PixelSpacing/thickness. No raw identifiers are returned; errors use sanitized codes. Signature/phase discriminators are derived by hashing checked frame tags, never accepted from arbitrary caller strings. **Crucial limit:** hashes in a mutually editable manifest are internally consistent, not externally authenticated; neither patient IDs nor raw frame/pixel hashes were externally verified. This cannot assert original clinical authenticity or motion absence.

**Full affine inversion:** `VolumeGeometry.lps_to_voxel()` now uses scalar triple products (adjugate / determinant) and scale-normalized determinant gate 1e-8. Replaces projection, which is only valid for exactly orthogonal scaled axes. For accepted DICOM IOP dot products up to 1e-4, cross-axis leakage is demonstrable in the prior formula. The normal used for slice projection is normalized. Software thresholds do not equal measurement accuracy or clinical calibration.

**Regularity vs continuity:** `build_regular_grid` rejects duplicate positions, variable interplane intervals, slice drift and mixed geometry. Constant spacing exceeding declared SliceThickness is **retained as a regular physical grid**, with `gap_mm`, `acquisition_thickness_mm`, `interplane_spacing_mm`, `interpolation_required=True`, `volume_eligible=False`, and reason `ACQUISITION_GAP_REQUIRES_INTERPOLATION`; it does not resample. Apparent absence of gaps does not establish tissue continuity or registration. Original vs derived source remains explicit.

**Cross-check:** `tests/make_crosscheck_fixtures.py` calculates an independent analytic DICOM world equation (without using the AFE point function for its expected result), and verifies AFE inverse. `tests/crosscheck_existing.mjs` invokes existing ANATHEOS JavaScript pixelToLps/plane/lpsToPixel on the same coordinates. The JS inverse is 2D only: z/slice inverse comes exclusively from Python/analytic reference, not JS. The JS inverse's nonorthogonal projection residual is documented, not patched in protected code. Research-only synthetic fixture generation does not validate DICOM IOD completeness or clinical performance.
