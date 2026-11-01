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


## AFE-01B supplementary checkpoint — 2026-11-01

- **State:** coded; 57 synthetic unittest PASS, 5 scenarios/20 independent analytic vs original JS cross-check points PASS; first crosscheck CI failure due PYTHONPATH reproduced/fixed. Latest tested code SHA `17d11e19799b14fbd71251032f2201cb9ea60371` (AFE & general CI SUCCESS). Documentation commit and its final CI must be verified externally; self-referential HEAD cannot be embedded in its own immutable git commit.
- **New modules:** `afe/cmr_adapter.py`, `tests/test_cmr_adapter.py`, `tests/test_part10_phantoms.py`, `tests/make_crosscheck_fixtures.py`, `tests/crosscheck_existing.mjs`. Modified: `afe/geometry.py`, `tests/test_geometry.py`, dedicated workflow, docs only. Current #75 stays draft.
- **Numerical maxima:** Python/JS forward vs analytic 0 mm; AFE inverse 1.4210854715202004e-14 vox; JS inverse exact-orthogonal 7.105427357601002e-15 vox; JS rounded-skew inverse 0.006199999999999761 vox. Not a clinical accuracy assessment.
- **ADRs:** 0003 through 0006 added. Existing #6/#10/#12 referenced; #74 was checked at `98b10279a6838a23d96ff82be92ac92901f990de` before this cycle. No main/PR #74 shared edits or deployment.
- **Drive:** NEW post-final-HEAD ZIP backup + SHA-256 and restoration test required before declaring AFE-01B complete. Record exact link and hash in PR #75 checkpoint/Drive supplemental note.
- **Plan Maestro:** AFE-00 incremental entry appended with revision guard and verified, no edits to other fronts. AFE-01B status intentionally stays in own PR/checkpoint until audited.
- **Open gates:** external DICOM conformance, real licensed Leeds/LCTSC independent QA, 3D Slicer, Windows physical, source-authenticated timing/motion, integration approval; AFE-02 not started.


## AFE-01C (2026-11-01) · Checkpoint de ejecución parcial, pendiente de Slicer
Dirección aprobó AFE-01B en SHA 3524462f16b4e7f9db802969d2e74c0cbefe0427. AFE-01C incorporó Gauss-Jordan (100 matrices/1000 puntos), VTK opcional local (15 matrices/60 puntos), barrido JS (320 configuraciones/1600 puntos), verificador público de ZIP original/hash y script Slicer DICOM/MRML; sin tocar visor ni CMR. Nueva discrepancia máxima JS 2.2568 voxel bajo anisotropía+IOP skew aceptada. ADR 0007/0008 documentadas. Resultado original Leeds: NOT RUN; LCTSC: NOT RUN; Slicer: NOT RUN. Se requiere seguir este checkpoint con SHA final/CI/ZIP privado verificable; no declarar cierre AFE-01 ni iniciar AFE-02.
