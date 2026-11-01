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


## AFE-ADR-0003 — General inverse for accepted near-orthonormal DICOM bases
- **Date:** 2026-11-01.
- **Problem:** projection-based LPS→voxel causes cross-axis errors when accepted IOP is not mathematically orthogonal.
- **Alternatives:** require exact orthogonality; approximate projections; invert 3×3 affine by matrix algorithm.
- **Decision:** use scalar triple-product inverse with relative determinant >1e-8, reject singular/ill-conditioned. Normalize only normal for slice placement. Test large coordinates, nonorthogonal accepted IOP and degeneracy.
- **Reason/consequence:** exact algebraic inverse for arbitrary invertible affine, no silent leakage. Numerical precision limited by floating point and source IOP. Gate 1e-8 is software engineering safeguard, not clinical accuracy.
- **Review:** independent Slicer and public data mandatory before promoting precision claims.

## AFE-ADR-0004 — Regularity does not imply contiguous acquired slab
- **Date:** 2026-11-01.
- **Problem:** a constant but nonzero gap was rejected as geometric irregularity, conflating plane placement and tissue coverage.
- **Alternatives:** always reject; silently interpolate; distinguish regular physical grid from eligibility for direct continuous volume.
- **Decision:** return regular affine if positions form valid uniform grid. Track measured step, declared thickness, gap, continuity flag, volume eligibility, interpolation requirement and reason code. Never interpolate automatically. Reject irregular spacing separately.
- **Consequences:** formerly failing regular-gap test now passes geometry but fails continuous-volume eligibility. Thickness is not proof of true acquisition footprint. Any downstream resampling requires another ADR and provenance.
- **Review:** source-specific acquisition QA and external 3D Slicer.

## AFE-ADR-0005 — CMR-R2 read-only source contract and validation limits
- **Date:** 2026-11-01.
- **Problem:** free-form acquisition/phase labels cannot establish that a series is safely one coherent stack.
- **Alternatives:** trust caller-provided keys; create another DICOM loader; reuse CMR catalog/geometry/integrity with strict checks.
- **Decision:** `afe/cmr_adapter.py` consumes existing normalized CMR-R2 schema (not pixels), compares schema and source integrity chain, validates complete and consistent identity/acquisition/temporal metadata, blocks dynamic modes, creates internal hashed discriminators. No second importer.
- **Consequences:** some valid MR stacks lacking timing tags are rejected (fail-closed). Internal consistency cannot authenticate original study nor verify pixel hashes; upstream must provide trusted/verified bytes and privacy protections.
- **Review:** integration and eventual evidentiary trust model require Direction approval; this adapter is not yet wired into ANATHEOS.

## AFE-ADR-0006 — Preserve independent JS implementation and record discrepancy
- **Date:** 2026-11-01.
- **Problem:** existing JS lpsToPixel uses orthogonal projection while near-orthonormal IOP is allowed. Synthetic accepted rounded-skew fixture shows up to 0.0062 voxel discrepancy.
- **Alternatives:** patch protected PR #73/#74; reject all rounded IOP; keep AFE exact inverse and register verified discrepancy.
- **Decision:** leave JS unchanged, measure against independent analytic forward coordinates and AFE, publish reproducible fixtures and explicit tolerance. In exact-orthonormal samples JS inverse error is 7.105e-15 vox; accepted-skew sample up to 0.0062 vox (edge classification can differ). Forward LPS result equals analytic within printed double precision on this fixture.
- **Consequences:** do not share that inverse behavior as an agreed future contract without direction/revalidation. This is not evidence of a clinical misregistration or an authorized change to UI.
- **Review:** architecture/integration gate and independent Slicer before declaring issue closed.
