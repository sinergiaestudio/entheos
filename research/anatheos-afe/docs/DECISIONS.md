# Numbered Architecture Decisions

## AFE-ADR-0001 — Isolated experimental computational kernel
- **Date:** 2026-11-01.
- **Problem:** build physical/semantic 3D research without colliding with active UI 0.11, original CMR ingestion or production.
- **Alternatives:** work on #74 branch; rewrite viewer; create separate app; create isolated directory and draft PR from immutable #73 commit.
- **Decision:** isolate Python stdlib experimental kernel in `research/anatheos-afe/`, one branch `experiment/anatheos-afe-engine`, exact parent `f1f34e32c4fffc39d30ba88623cdba0a6509f853`, draft PR **to** `anatheos/v010-spatial-integration`, no deployment or auto-merge. Keep #73/#74 frozen from this front.
- **Reasons:** reuse the #73 LPS and volume contracts, avoid floating base and UI writes, implement cross-checks independent of renderer.
- **Consequences:** AFE depends on an unmerged PR #73 base; future integration needs explicit rebase/review and combined CI. Existing issues #6/#10/#12 remain authoritative.
- **Review required:** before integration, change of language/runtime or interface contract; direction authority reserved.

## AFE-ADR-0002 — Fail-closed physical coordinates and no hidden resampling
- **Date:** 2026-11-01.
- **Problem:** unstructured DICOM frames cannot automatically be assumed to form a regular anatomical 3D grid.
- **Alternatives:** simple z-index stacking; infer absent acquisition fields; interpolate irregular frames; reject until exact normalized metadata and measured regularity are present.
- **Decision:** mandatory IPP/IOP/PixelSpacing/SliceThickness, consistent dimensions, modality, source kind, validated acquisition and temporal discriminators; sort along IOP normal. Export the physical affine in LPS mm, with explicit RAS conversion; reject duplicates, gaps, variable orientation/spacing and tangential drift. No interpolation; MR intensity never labeled HU.
- **Reasons:** conservative reproducible behavior and traceability; animated, registered, tilted or irregular studies require distinct validated future path.
- **Consequences:** some valid clinical acquisitions are excluded. Software tolerances (direction 1e-4, lateral 0.01 mm, interval max[0.05 mm,1%]) do **not** imply scanner or clinical precision. AFE is not a DICOM parser or diagnostic device.
- **Review required:** when real public and Slicer evidence supports broader geometry. No relaxations merely to obtain rendered volumes.
