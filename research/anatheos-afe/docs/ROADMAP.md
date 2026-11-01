# AFE backlog and Definition of Done — 2026-11-01

Work in closed loops; every gate has code/commit, command, failures, external QA status and checkpoint. Do not duplicate the private Master Plan.

| Priority | Stage | One verifiable objective | Gate / DoD | State |
| --- | --- | --- | --- | --- |
| P0 | AFE-00 | Audit provenance, branch genealogy, unique code boundary, frozen parent | PR draft, ADR, inventory, protected paths and checkpoint; no collisions | In progress pending CI/backup verification |
| P0 | AFE-01A | Coordinate kernel from already-normalized frames | Anisotropic/oblique/reversed/LPS-RAS synthetic tests, missing/invalid frame rejects, error policy; 0 new deps | Locally tested, not publicly/clinically validated |
| P0 | AFE-01B | Trusted DICOM metadata adapter from existing CMR, negative frame/phase/gap policy | CMR contract, fixed acquisition, original/derived provenance, identity validation, test on generated Part10 without PHI | Pending |
| P0 | AFE-01C | Independent geometry comparison | Same synthetic and licensed public cases vs current JS and Slicer; physical units and laterality; documented measured differences | Pending |
| P1 | AFE-02 | Mask → physically located point cloud | sampling, density/memory ceiling, analytic sphere/cube and error summary, provenance | Pending |
| P1 | AFE-03 | Mask → surfaces and mesh | reuse existing surface code/adapters, watertight/normal/physical-volume gates, fail cases | Pending |
| P1 | AFE-04 | Labelled anatomical field | only same-study registered reference masks, distinguish expert/algorithm/unknown, alignment and Dice/HD95 on known ground truth | Pending |
| P1 | AFE-05 | Reproducible local benchmark/QA | CPU/memory/time, CT/MR public, independent Slicer, Windows physical acceptance separate | Pending |
| P2 | AFE-06 | Gaussian Splatting research | licensing/hardware/geometry comparison with source volume and mesh; measure or reject; no fabricated anatomy | Pending; needs architecture approval |
| P2 | AFE-07 | Versioned read-only bridge to existing ANATHEOS | mock consumer contracts, error/compatibility tests, Director approval; no integration or deploy | Pending; needs architecture approval |

**Risk order:** incorrect orientation/left-right > misregistration or temporal mixing > fabricated resolution > memory exhaustion > graphics/performance. Gates remain laboratory research only unless explicitly accepted elsewhere.


## AFE-01B gate update (2026-11-01)

- **Done as synthetic laboratory gate:** mathematical 3×3 affine inverse, singular/ill-conditioned rejection, separate regularity from acquisition gaps, normalized read-only CMR-R2 adapter with provenance consistency gates, in-memory Part10 examples read back through existing CMR parser, Python-vs-original-JS-vs-analytic cross-check. All 57 unittest cases and 20 spatial samples PASS on reviewed SHA `17d11e19799b14fbd71251032f2201cb9ea60371` (new HEAD after docs update requires fresh CI).
- **Not done / blocks AFE-01 completion:** externally validated DICOM IOD conformance of phantom, end-to-end CMR original pixels + independent source trust, licensed public CT/MR dataset QA and SHA/license, independent 3D Slicer, physical Windows tests and acceptable thresholds against separate implementations. No AFE-02 construction.
- **Recommendation:** retain AFE-01 open; progress next to controlled independent Slicer/Leeds or LCTSC comparison and stronger timing/provenance evidence before any point-cloud work. Do not equate 57 unit PASS with medical validation.
