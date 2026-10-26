import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isAnatheosOwner, isAnatheosPilotEnabled } from "../lib/anatheos/owner-access.ts";
import { importLocalDicom, DicomIntakeError } from "../lib/anatheos/dicom-intake.ts";
import { corpusCases } from "./fixtures/anatheos/synthetic-series.mjs";

function asFile(bytes, stats = { preflight: 0, full: 0 }) {
  return {
    size: bytes.byteLength,
    slice(begin, end) {
      return { async arrayBuffer() {
        stats.preflight += 1;
        return bytes.slice(begin, end).buffer;
      } };
    },
    async arrayBuffer() {
      stats.full += 1;
      return bytes.slice().buffer;
    },
  };
}
const owner = { email: "owner@example.invalid", isGlobalAdmin: true };

/**
 * Test harness only: reflects independent server guard and local client phases.
 * Not an HTTP/Sites origin or spoofed-header authentication test.
 */
async function guardedLocalImport({ flag, identity, expectedOwner, files, options }) {
  if (!isAnatheosPilotEnabled(flag) || !isAnatheosOwner(identity, expectedOwner)) {
    return { allowed: false };
  }
  return { allowed: true, result: await importLocalDicom(files, options) };
}

test("G25 fail-closed owner predicate prevents invoking local decoder", async () => {
  const probe = { preflight: 0, full: 0 };
  const files = corpusCases.axialAnisotropic.slices.map((bytes) => asFile(bytes, probe));
  for (const [flag, identity, configured] of [
    [undefined, owner, owner.email],
    ["false", owner, owner.email],
    ["true", null, owner.email],
    ["true", { email: owner.email, isGlobalAdmin: false }, owner.email],
    ["true", { email: "third@example.invalid", isGlobalAdmin: true }, owner.email],
    ["true", owner, ""],
  ]) {
    const actual = await guardedLocalImport({
      flag, identity, expectedOwner: configured, files,
    });
    assert.equal(actual.allowed, false);
  }
  assert.equal(probe.preflight, 0);
  assert.equal(probe.full, 0);
});

test("G25 authorized synthetic selection integrates corpus, geometry and sanitized rejection counts", async () => {
  const selected = [
    ...corpusCases.axialAnisotropic.slices,
    ...corpusCases.oblique.slices,
    ...corpusCases.irregularGap.slices,
    ...corpusCases.jpegMarker.slices,
  ];
  const files = selected.map((bytes) => asFile(bytes));
  const progress = [];
  const actual = await guardedLocalImport({
    flag: "true", identity: owner, expectedOwner: "OWNER@EXAMPLE.INVALID", files,
    options: { onProgress: (done, total) => progress.push([done, total]) },
  });
  assert.equal(actual.allowed, true);
  assert.equal(actual.result.series.length, 2);
  assert.deepEqual(actual.result.series.map((entry) => entry.volume.slices.length), [3, 3]);
  assert.deepEqual(actual.result.series.map((entry) => entry.volume.axisAlignedAxial), [true, false]);
  assert.equal(actual.result.rejectedByReason["unsupported-syntax"], 1);
  assert.equal(actual.result.rejectedByReason["incompatible-series"], 3);
  assert.equal(actual.result.rejectedFiles, 4);
  assert.deepEqual(progress[0], [1, 10]);
  assert.deepEqual(progress.at(-1), [10, 10]);
  assert.equal(progress.length, 10);
  assert.doesNotMatch(JSON.stringify(actual.result.rejectedByReason), /[a-z]+@example\.invalid/);
});

test("G25 cancel selection during first synthetic import and reopen a clean selection", async () => {
  const signal = new AbortController();
  const first = { preflight: 0, full: 0 };
  const second = { preflight: 0, full: 0 };
  const staleFiles = corpusCases.axialAnisotropic.slices.slice(0, 2).map((bytes, index) =>
    asFile(bytes, index === 0 ? first : second));
  await assert.rejects(
    guardedLocalImport({
      flag: "true", identity: owner, expectedOwner: owner.email, files: staleFiles,
      options: { signal: signal.signal, onProgress: () => signal.abort() },
    }),
    (error) => error instanceof DicomIntakeError && error.code === "cancelled",
  );
  assert.equal(first.full, 1);
  assert.equal(second.preflight + second.full, 0, "stale selection must not continue reading next file");
  const next = await guardedLocalImport({
    flag: "true", identity: owner, expectedOwner: owner.email,
    files: corpusCases.reversedNormal.slices.map((bytes) => asFile(bytes)),
  });
  assert.equal(next.result.series.length, 1);
  assert.ok(Math.abs(next.result.series[0].volume.sliceSpacingMm - 5) < 1e-8);
  assert.equal(next.result.rejectedFiles, 0);
});

test("G25 owner page applies server-side feature flag and identity checks in order", () => {
  const src = readFileSync(fileURLToPath(new URL("../app/app/anatheos-3d/page.tsx", import.meta.url)), "utf8");
  const off = src.indexOf("if (!isAnatheosPilotEnabled(env.ANATHEOS_PILOT_ENABLED)) notFound()");
  const requireUser = src.indexOf("await requireChatGPTUser");
  const ownerMatch = src.indexOf("if (!isAnatheosOwner(user, env.APP_OWNER_EMAIL)) notFound()");
  assert.ok(off >= 0 && requireUser > off && ownerMatch > requireUser);
  const intakeUi = readFileSync(fileURLToPath(new URL("../components/anatheos/dicom-browser.tsx", import.meta.url)), "utf8");
  assert.match(intakeUi, /importLocalDicom\(/);
  assert.match(intakeUi, /cancelImport/);
  assert.doesNotMatch(intakeUi, /fetch\(|XMLHttpRequest|FormData/);
});

test("G25 preserve all four workstream docs, Direction audit, and proposals without closing gates", () => {
  const read = (path) => readFileSync(fileURLToPath(new URL("../" + path, import.meta.url)), "utf8");
  const index = read("docs/anatheos/README.md");
  const status = read("docs/anatheos/ESTADO.md");
  const adr = read("docs/anatheos/REGISTRO_DECISIONES.md");
  for (const title of ["Auditoría reproducible G0", "Laboratorio G1",
    "Corpus de referencia G2b", "Loader DICOM G2a", "Auditorías independientes de dirección"]) {
    assert.ok(index.includes(title), "lost README section: " + title);
  }
  for (const tag of ["Checkpoint de auditoría G0", "Checkpoint G1A",
    "Checkpoint G2b-A", "Checkpoint G2a-A", "Checkpoint de integración propuesta"]) {
    assert.ok(status.includes(tag), "lost status: " + tag);
  }
  for (const ref of ["D-001", "D-009", "P-002", "P-008", "P-009"]) {
    assert.ok(adr.includes(ref), "lost ADR: " + ref);
  }
  for (const doc of ["AUDITORIA_DIRECCION_2026-10-26.md","AUDITORIA_G0_2026-10-26.md",
    "CORPUS_DICOM_SINTETICO.md", "LAB_G1_LOCAL.md", "DECODIFICADOR_G2A.md"]) {
    assert.match(index + status, new RegExp(doc.replaceAll(".", "\\.")));
  }
});
