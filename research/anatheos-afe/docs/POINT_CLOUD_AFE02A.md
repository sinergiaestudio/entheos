# AFE-02A — Contract, benchmarks and source-registered experimental point sets

Date: 2026-11-01. Direction resolution 005 (https://github.com/sinergiaestudio/entheos/pull/75#issuecomment-6559712411) approves only AFE-01-SPATIAL for verified public original Leeds MR and LCTSC CT. No clinical/temporal gate, image-intensity or mask-based labels have been approved.

## Data model AFE-POINTS-V1 and byte correspondence

A point is an immutable Sample with LPS mm (double XYZ), voxel CRS (column,row,slice, integer centers or half-offset exposed synthetic voxel faces), original input frame index from VolumeGeometry.sorted_source_indices (NEVER filename/instance-number guessing), opaque source SHA256, SHA256 fingerprint of affine/original-frame order/dimensions, state synthetic/derived/acquired_plane, sample_kind voxel_center/exposed_face/acquired_plane, face_id (-1 for centers), and anatomical label unknown. Source attestation carries provenance_method and spatial_status. The mask digest is recomputed from bytes; grid fingerprint is enforced. Labels other than unknown and any confidence field are rejected; image intensity and unit intentionally remain NULL pending verified pixel integrity/units. PLY ASCII properties double x/y/z LPS, double voxel_c/r/s, int original_frame_index, int face_id. Versioned sidecar JSON retains SHA256 of exact PLY bytes, point count, mask/source/grid hashes, affine and extraction method. Source ZIP remains authoritative; this PLY is never a volume substitute.

Two required methods:
1. centers: scan binary mask in deterministic original-grid CRS order and output physical voxel-center positions;
2. faces: every exposed 6-connected digital voxel face emits a center on a half-step grid boundary, *not* a smooth isosurface.
Third method adaptive: retains every digital-boundary voxel center, striding interiors (a tiny component cannot be silently lost due to thinning). Uniform stride reduces all eligible centers or face samples deterministically. No Gaussian splatting.

Masks may be used ONLY for scope SYNTHETIC_VALIDATED; mask_sha256 must equal the exact bytes and mask_geometry_sha256 the image fingerprint. Public Leeds/LCTSC only scope ACCEPTED_SPATIAL_ONLY, sparse *integer slice planes* explicitly acquired, without mask, derived half-slices, interpolation, labels or inferred continuity. This is not a procedure for labeling the expert LCTSC RTSTRUCT. Integration into ANATHEOS is not authorized.

## Engineering gates fixed before execution

World geometry error against separate affine multiplication <= 1e-8 mm (double precision; NOT acquisition accuracy). Boundary surrogate distance against implicit analytic sphere/ellipsoid/cylinder/tube/cavity surfaces <= 2 * sqrt(0.5²+0.7²+1.2²) = 2.953 mm for pitch 0.5/0.7/1.2 mm; this is intentionally a loose discretization upper bound, NOT medical precision or true Euclidean distance for the ellipsoid surrogate. All source and mask hashes exact, 0 unapproved labels, 0 interpolated source slices, 0 unmatched frame indices, deterministic point order/hashes. Memory limits: dense <= 2,000,000 voxels; output <= 150,000 points; uniform stride 1..4096; source bytes mask-only; cancellation at slice boundaries discards partial output; existing PLY never overwritten. These limits cap Python output allocations but not total machine RSS of input decoding: not production-scale large-volume support.

## Locally executed benchmarks (first measured cycle)

Python 3.13.5, Linux x86_64 kernel 6.18.57, 5 logical CPUs exposed, no GPU, Python stdlib single process; wall time measures extraction only (not generating phantom, metrics, or writing files); tracemalloc counts Python allocations, not full resident set. Timings fluctuate by runner load and should not be used as cross-hardware guarantees. 20 cases, 8 PLY+JSON pairs at n=32 generated and SHA256 verified. Independent analytic implicit function defines membership in an anisotropic rotated affine. All five phantoms PASS numeric and discretization gates.

| n³ voxels sphere | Method | Output points | Wall ms | Peak Python allocation bytes |
|---|---|---:|---:|---:|
| 24³ | centers | 1096 | 40.959 | 475512 |
| 24³ | faces | 816 | 44.264 | 299568 |
| 24³ | faces stride 8 | 102 | 27.433 | 36656 |
| 24³ | adaptive stride 8 | 514 | 40.856 | 188280 |
| 32³ | centers | 2624 | 87.049 | 1006608 |
| 32³ | faces | 1464 | 88.847 | 538544 |
| 32³ | faces stride 8 | 183 | 61.450 | 66688 |
| 32³ | adaptive stride 8 | 1045 | 85.903 | 384032 |
| 48³ | centers | 8880 | 315.982 | 3711672 |
| 48³ | faces | 3312 | 252.314 | 1304552 |
| 48³ | faces stride 8 | 414 | 200.813 | 151832 |
| 48³ | adaptive stride 8 | 2758 | 275.075 | 1063672 |
| 64³ | centers | 20848 | 779.480 | 8883472 |
| 64³ | faces | 5872 | 587.725 | 2407816 |
| 64³ | faces stride 8 | 734 | 477.512 | 269392 |
| 64³ | adaptive stride 8 | 5593 | 650.972 | 2289744 |

At n=32 each full face cloud and its analytic-distance surrogate:
- sphere 1464 face points, max 0.503984 mm, mean 0.141851 mm, p95 0.362026 mm.
- ellipsoid 1672, max surrogate 0.580733 mm, mean 0.172318 mm, p95 0.425805 mm.
- cylinder 872, max 0.4 mm, mean 0.211163 mm, p95 0.4 mm.
- hollow tube 1112, max 0.4 mm, mean 0.169372 mm, p95 0.4 mm.
- spherical cavity 1744, max 0.503984 mm, mean 0.141940 mm, p95 0.362026 mm.
Maximum numeric world-coordinate error among all local cases: around 3.97e-15 mm. Do NOT interpret digital boundary distances as acquisition or tissue-segmentation error.

Regression cycles: first PLY newline-count assumption failed, fixed by parsing after end_header; spatial-only mask validation initially followed input size check, moved trust check first; introduction of genuine mask byte hashing surfaced mismatches in *tests' synthetic attestation*, fixed by hashing actual mask contents rather than weakening the contract. Failures were observed and corrected; no gate tolerances changed. Existing tests 65 and point tests 7 -> 72/72 local PASS. Additional 20 benchmark cases PASS.

## Public original sparse mode

The AFE-01D metadata-only preflight independently verifies original ZIP SHA, DICOM source IDs, physical order and metadata and supplies a case JSON, then run_public_sparse.py checks scope ACCEPTED_SPATIAL_ONLY, false volume eligibility, 27 original integer-acquired positions and original source-order mapping. It never constructs a continuous surface, uses masks or image intensity, and emits only small sanitized metrics. Prior 3D Slicer 5.12.4 physical affine comparison for these cases remains separately preserved (AFE-01D); new public point sampling must not be misrepresented as another independent Slicer gate.

## Files and reproducibility

- afe/points.py: point source contract, hard caps, cancellation, three deterministic extraction modes and acquired-plane-only sampling.
- afe/point_io.py: atomic PLY and sidecar JSON export with SHA256.
- tests/test_points.py: 7 additional tests (five shape subcases and thousands of points inside each), negative gates, analytic reference and binary export.
- tools/run_point_phantoms.py: 20 benchmark cases and eight examples, no data files committed.
- tools/run_public_sparse.py: original-planar source sample probe, 27 measured locations.
- .github/workflows/anatheos-afe-synthetic.yml: existing regression, new benchmark and source-only backup artifact.
- .github/workflows/anatheos-afe01d-real-slicer.yml: actual public acquired-plane point probe after hash-verified metadata preflight; separate native Slicer run preserved.

### Residual risks and next gate proposal

Face centers approximate a cubical mask, not a smooth anatomical surface; masks in this version are synthetic only. No intensity/color, Gaussian splatting, neural inference, continuous interpolation, medical accuracy, motion control, calibrated uncertainty, or expert CT RTSTRUCT matching. AFE-ADR-0007 risk of protected JavaScript inverse remains open in issue #10. Request Direction's QA acceptance of AFE-02A; subsequent microhito should validate **same-case segmentation provenance (Study/Series/FrameOfReference/source pixel hashes, RTSTRUCT references and affine)** before any expert-anatomical label is permitted. No integration, deploy or AFE-02B automatically authorized.
