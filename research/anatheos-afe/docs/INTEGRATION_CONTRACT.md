# Proposed AFE ↔ ANATHEOS contract (NOT integrated)

Reference: existing private `CONTRATO_INTEGRACION_ANATHEOS.md` CMR-R2 `anatheos-cmr-r2-private-v1`, existing `anatheos_cmr_bridge.mjs` and PR #73 `eligible-volume.mjs` / `spatial-reference.mjs`.

**Input (future adapter):** approved local normalized frame geometries with checked DICOM IPP (mm LPS), IOP, row/column spacing, slice thickness, rows/columns, modality, original/derived provenance, and a validated same-study/same-series fixed acquisition+phase key. Real identifiers stay private in CMR metadata, never copied to public logs or CI.

**Current output:** `VolumeGeometry` with 4×4 column/row/slice-to-patient-LPS affine in mm, ordered source indices, modality and provenance. No image bytes are moved. Result is a geometric candidate **only**; not motion/registration validation.

**Future output (proposal, subject to ADR and approval):** versioned metadata, masked point cloud and mesh in declared LPS mm, interpolation flag, source/hash references inside protected storage, resolution/uncertainty annotations, explicit unavailable/rejected codes and a synthetic mock consumer. No network transport, app changes, production or clinical data are part of AFE-00/01A.

**Current rejection:** duplicate positions, gaps/irregular spacing, nonorthonormal/variable IOP, lateral slice drift, inconsistent pixels/acquisition/time, insufficient slices, unknown modality, invalid spacing/thickness, missing context, unsupported HU conversion. AFE does **not** assert that shared FrameOfReferenceUID alone proves registration.


## AFE-01B contract candidate (NOT integrated)

`adapt_cmr_r2(catalog, geometry_json_bytes, integrity, selected_id, decoded_shape)` takes only **already produced** `anatheos-cmr-r2-private-v1` metadata and the `anatheos-cmr-r2-integrity-v1` manifest plus an upstream verified NPY shape. It checks coherence, but does not verify pixel-file contents, authenticate DICOM bytes against the manifest or decode compressed images. A successful return yields `AdaptedSeries.geometry`, with physical affine and explicit gap metadata, not permission to display a clinical volume. It does not send any identifiers or bytes to the network. Acquisition/phase discriminators are internal hashes of inspected metadata. Never log input records, source hashes, metadata hash or private identifiers.
The caller must already have consent, a trusted local source, complete same-study/series/FrameOfReference verification, actual pixel hash verification, and appropriate safety/temporal review before using any derived geometry clinically. The shared ANATHEOS integration is still forbidden without Direction approval.
