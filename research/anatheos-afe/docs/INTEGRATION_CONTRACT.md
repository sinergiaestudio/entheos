# Proposed AFE ↔ ANATHEOS contract (NOT integrated)

Reference: existing private `CONTRATO_INTEGRACION_ANATHEOS.md` CMR-R2 `anatheos-cmr-r2-private-v1`, existing `anatheos_cmr_bridge.mjs` and PR #73 `eligible-volume.mjs` / `spatial-reference.mjs`.

**Input (future adapter):** approved local normalized frame geometries with checked DICOM IPP (mm LPS), IOP, row/column spacing, slice thickness, rows/columns, modality, original/derived provenance, and a validated same-study/same-series fixed acquisition+phase key. Real identifiers stay private in CMR metadata, never copied to public logs or CI.

**Current output:** `VolumeGeometry` with 4×4 column/row/slice-to-patient-LPS affine in mm, ordered source indices, modality and provenance. No image bytes are moved. Result is a geometric candidate **only**; not motion/registration validation.

**Future output (proposal, subject to ADR and approval):** versioned metadata, masked point cloud and mesh in declared LPS mm, interpolation flag, source/hash references inside protected storage, resolution/uncertainty annotations, explicit unavailable/rejected codes and a synthetic mock consumer. No network transport, app changes, production or clinical data are part of AFE-00/01A.

**Current rejection:** duplicate positions, gaps/irregular spacing, nonorthonormal/variable IOP, lateral slice drift, inconsistent pixels/acquisition/time, insufficient slices, unknown modality, invalid spacing/thickness, missing context, unsupported HU conversion. AFE does **not** assert that shared FrameOfReferenceUID alone proves registration.
