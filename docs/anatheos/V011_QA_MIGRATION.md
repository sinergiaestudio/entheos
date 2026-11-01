# 0.11 QA migration · successor to PR #73

Baseline: f1f34e32c4fffc39d30ba88623cdba0a6509f853, delivered 0.10 EXE unchanged.
The new consolidated workflow is `anatheos-v011-workstation.yml`.

The older cumulative UI workflows assert automatic DESS startup, always-visible
mode buttons, the old toolbar and the old mobile page layout. Those assertions
conflict with the explicitly requested workstation. They remain unchanged and
runnable on their original branches, but their jobs do not run on the exact
0.11 successor branch. This is a declared migration of functional UI coverage,
not evidence that historical UI assertions passed on 0.11. The source-only binary hygiene check is retained in the consolidated job before
public examples are fetched; security CI remains unmodified. Avoid repeating cumulative pipelines and public downloads.

Replacement coverage:

| Prior contract | Consolidated gate |
|---|---|
| Native parsing and JPEG2000 ingestion, cancel/cleanup | W1 original ZIP API + browser; frozen Windows test |
| UX-N1–N6 toolbar/layout/accessibility | station state/context/layout suite, 1366×768/1920×1080, focus/Escape/keyboard |
| Four-view geometry and cross references | synthetic geometry + pointer mapping at zoom/pan/DPR 1/2 |
| Actual intensity volumes and MPR | offline Leeds 144 and CT 130; nonblank render, rotation, clip/opacity, MPR |
| Masks, NRRD, seeds and surfaces | original unit suites + station editor workflow with reviewed seed, discard/accept and same-study meshes |
| SPL provenance and unrelated external surfaces | original provenance/geometry tests, preserved build-time hash validation, external mesh UI provenance |
| Same-case CT expert references | exact CT/NRRD validation; five layers; color/alpha/visibility/isolation in real volume |
| Windows module serving and installation | module closure verifier + exact 0.9→0.10→0.11, reinstall, corrupt rejection, previous-server restart, data retention |

No private study enters GitHub, public runners, artifacts or screenshots.
Windows CI runs on Server 2022; owner PC/GPU acceptance and independent Slicer
comparison remain separate gates. No clinical validation or cardiac 4D claim.

Acceptance hotfix 0.11.1 uses the same consolidated gate on its child PR to the
frozen 0.11 branch. The explicit skip condition covers both branches. The
hotfix adds original-SPL-provenance units and targeted red/green P0 checks;
it does not retroactively mark historical UI suites as passed. Exact original
0.11 and patched installer screenshots test close-state cleanup, CT text
contrast, source/plane readings, physical MPR aspect and available-area fit.
See V011_ACCEPTANCE_HOTFIX.md. No source or CI data from the private study.
