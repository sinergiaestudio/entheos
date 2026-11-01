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


## AFE-01B reproducibility (added 2026-11-01)

From this directory, Python 3.11+ (stdlib) and Node 20+ required:

```sh
python -m compileall -q afe tests
python -m unittest discover -s tests -v
PYTHONPATH=. python tests/make_crosscheck_fixtures.py /tmp/afe-crosscheck.json
node tests/crosscheck_existing.mjs /tmp/afe-crosscheck.json
```

The Node test imports the **existing unchanged** `demos/anatheos-local-v0.5/spatial-reference.mjs`; execution must be in the repository checkout. Synthetic Part10 test uses the existing CMR-R1 metadata-only parser; no second DICOM importer. Full AFE-01B synthetic suite: 57 unit tests + 5 analytic/JS comparison scenarios with 20 measured points, run and verified in GitHub Actions on SHA `17d11e19799b14fbd71251032f2201cb9ea60371`. Updated status on PR #75 after subsequent commits. See docs/TEST_MATRIX.md and numbered ADRs. Independent external-tool Slicer and public-source dataset QA have NOT RUN.


## AFE-01C · QA independently constrained
- Run: python -m unittest discover -s tests -v ; node tests/skew_sweep_existing.mjs
- Mandatory: distinction between 3D Slicer real DICOM import and external VTK-only numeric matrix oracle. VTK success is NOT Slicer success.
- Public original hash/metadata audit and external Slicer comparison scripts: tools/prepare_public_case.py and tools/slicer_compare.py; instructions, fixed thresholds, licenses and honest per-source execution matrix in docs/PUBLIC_CASES.md. They are not a second DICOM importer or integrated into ANATHEOS.
- Current gate: original public DICOM and Slicer NOT RUN in this environment. All anatomical reconstruction and AFE-02 blocked.


## AFE-01D · Execute official native Slicer and public originals
Runnable experiment CI (no installed viewer): .github/workflows/anatheos-afe01d-real-slicer.yml; Linux ubuntu-24.04, native official 3D Slicer 5.12.4 SHA512 official and xvfb. DICOM URLs pinned with ZIP byte size and SHA256, copies transient and license-limited. Matrix comparator research/anatheos-afe/tools/slicer_compare.py reads native MRML, 27 corners/interiors, inverse and norms. Metadata QA uses existing CMR-R1 MR parser and existing ANATHEOS T2-B1 pydicom QA dependency for CT; neither alters CMR-R3 or production. See docs/REAL_SLICER_AFE01D.md, ADR0009/0010. Real execution PASSED in run 41316484907. Temporal evidence still absent; retain spatial-only status.
