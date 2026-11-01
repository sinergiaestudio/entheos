# ANATHEOS Anatomical Field Engine (AFE)

Experimental, non-diagnostic geometry engine **within** Entheos. NOT a second application, viewer, service, deployment, or clinical product.

## Reproducibility (Python 3.11+, standard library only)

From `research/anatheos-afe/`:

```bash
python -m unittest discover -s tests -v
python -m compileall -q afe tests
```

These commands run on **synthetic metadata only**. No DICOM files, pixels, patient identifiers, study UIDs or secrets are needed. Current implementation: conservative DICOM frame geometry, sorting, affine voxel (column,row,slice) to LPS mm, LPS/RAS and guarded CT-to-HU operation. No DICOM parser in AFE: ingestion belongs to CMR; no point cloud/mesh/segmentation in AFE yet. Original/derived provenance is kept as source_kind; CT-derived HUs require explicit validated metadata.

## Governance / origin

- Frozen parent SHA: `f1f34e32c4fffc39d30ba88623cdba0a6509f853` (0.10 PR #73, not Windows EXE code release reference). This is a **dependency**; no modifications were made to PR #73.
- Parent PR: https://github.com/sinergiaestudio/entheos/pull/73 ; contemporaneous separate UX PR: https://github.com/sinergiaestudio/entheos/pull/74
- Governing issues: #6 (coordination), #10 (spatial), #12 (3D); no duplicate issue created.
- AFE owns only `research/anatheos-afe/**` and the dedicated synthetic CI workflow. No `main`, D1/R2, production, installer, existing viewer, CMR or owner pilot modifications.
- No paid APIs/infra, no private clinical data in repository or CI. Do not infer medical accuracy from synthetic passing tests.

See `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/TEST_MATRIX.md`, `docs/INTEGRATION_CONTRACT.md` and `docs/CHECKPOINT.md`. Sources of truth: GitHub for code/CI, the pre-existing private Drive Master Plan for program coordination.
