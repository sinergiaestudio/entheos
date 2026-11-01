# AFE checkpoint — AFE-00 / first AFE-01A microloop

- **Date:** 2026-11-01, America/Argentina/Buenos_Aires.
- **State:** implementation and synthetic local tests, pending branch CI and independent public/Slicer/Windows QA.
- **Repository:** sinergiaestudio/entheos; branch `experiment/anatheos-afe-engine`.
- **Frozen parent:** `f1f34e32c4fffc39d30ba88623cdba0a6509f853` (PR #73). Separate active PR #74 and production/main untouched.
- **HEAD:** record final commit SHA and actual CI in PR/checkpoint supplement after GitHub write; do not infer a successful workflow before readback.
- **Issue references:** #6 governance, #10 spatial, #12 3D; use existing work, no duplicate issue.
- **Files:** `research/anatheos-afe/**` plus dedicated `.github/workflows/anatheos-afe-synthetic.yml` only.
- **Local evidence:** Python standard-library unittest 26/26 PASS with synthetic-only records. No third-party packages installed. No DICOM files or UIDs uploaded. Full test inventory in TEST_MATRIX.md.
- **Drive:** folder `06 · AFE · Motor anatómico` exists. Backup status PENDING until real file upload, readback, and SHA-256 verification. The existing protocol file alone is not a code backup.
- **Master Plan:** NO SINCRONIZADO until safe simultaneous edit verified; proposed delta in PR/checkpoint.
- **Risks:** baseline PR #73 unmerged, audit no 3D Slicer independent comparison; no production data; conservative gaps/drift gate excludes some valid acquisitions; testing on Windows physical not run.
- **Next loop:** validate exact metadata adapter and independently cross-check affine/orientation against current JS and public reference with source/hash/license.
