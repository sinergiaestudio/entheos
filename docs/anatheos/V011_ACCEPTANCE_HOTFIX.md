# 0.11.1-beta · acceptance-only patch

Order: PR #74 issuecomment-6558005340. Frozen parent runtime and original installer: `98b10279a6838a23d96ff82be92ac92901f990de`; original EXE SHA-256 `0765a2f6d29d4f71a829143ea2fc6164daa38d33525df0b4ee465c208ebb09cb`.

Child branch `anatheos/v011-acceptance-hotfix`, DRAFT PR targeting `anatheos/v011-unified-workstation`. Version `0.11.1-beta` is a patch identifier, not a new functional stage. No merge or production deployment. Preserve original #74 and its EXE, #73/#72/#71 and AFE #75.

## Scope

- Dispose detached viewport bars, frame/geometry/annotation references and reset selected view on close. Clear inspector for either study owner. Reject late events after workspace disposal.
- Mount expert reference controls only for the current CT, reset serial/state on binding and remove them on close/replacement. Keep original grid/all-voxel verification and renderer intact.
- Explicit manual-mask and expert-reference counts, accessible reference names/colors/opacity, compact default disclosure. Advanced import/manual editing remains available through existing menus.
- Fit MPR using physical row/column/slice spacing, without changing reformat pixels or adding interpolation. Independent acquisition-axis/index output and explicitly labelled remembered source slice. Navigation arrows act on MPR index while MPR is active.
- Keyboard/menu focus and viewport status tooltips; one scroll owner per sidebar.

Reconstruction, segmentation, seed, surface and geometric eligibility algorithms are unchanged. `app.js` changes the MPR presentation adapter, `thorax-reference.mjs` changes control mounting/reset; its verification and painting algorithms are unchanged.

## Required acceptance checks

`research/anatheos-cmr/r3/test_acceptance_hotfix.py` runs the same assertions against original 0.11 and the patch. Original must reproduce P0 close/reference/contrast/MPR failures; patched version must pass all assertions. The MPR physical-aspect oracle independently reads the SHA-pinned public DICOM headers (spacing and projected slice positions), rather than copying the presentation calculation. Captures are authentic full app screenshots at both resolutions, only Leeds and LCTSC.

The consolidated workflow retains geometry, original engine units, editor, spatial mapping, synthetic compressed ZIP close/reimport/cancellation, public real volume/MPR and texture cleanup. It now includes the original SPL provenance unit; this does not imply that the real SPL browser workflow was run. The 18 historical visual workflows remain deliberately skipped on both 0.11 branches. No claim of 20/20 historical PASS or complete browser equivalence. Responsive mobile, real hardware/GPU and Slicer remain separate gates.

Windows builds one distributable `ANATHEOS-Setup-0.11.1-beta.exe` from source. Tests verify exact 0.9/0.10 baselines, 0.10→patch, reinstall, synthetic ingestion, original public volume/MPR/layers, corrupt-update rejection, data preservation and prior-server recovery. An internal corrupt test package is deleted and never distributed. A second acceptance matrix opens the exact original 0.11 for expected failures, then applies the same patch EXE and tests the corrected state. Both retained 0.10 and 0.11 startup/recovery paths must work. Programs remain versioned under LOCALAPPDATA; projects remain outside installation. Recovery opens a retained version; it does not rewrite the current-version registry or migrate projects backwards.

All evidence is public-only. CI artefacts expire; the final delivery must include durable complete EXE, SHA-256, comparative evidence and checkpoint/unique Master Plan update. No clinical acceptance is implied by automated checks. Owner acceptance remains pending.
