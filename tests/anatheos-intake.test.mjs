import assert from "node:assert/strict";
import test from "node:test";
import {
  importLocalDicom, inspectDicomHeader, DicomIntakeError, IntakeHeaderError,
  DICOM_INTAKE_LIMITS,
} from "../lib/anatheos/dicom-intake.ts";

const te = new TextEncoder();
const u16 = (n) => [n & 255, (n >>> 8) & 255];
const u32 = (n) => [...u16(n & 65535), ...u16(n >>> 16)];
const longs = new Set(["OB", "OW", "SQ", "UN"]);
function element(group, id, vr, value) {
  const data = typeof value === "string" ? [...te.encode(value)] : [...value];
  if (data.length % 2) data.push(vr === "UI" ? 0 : 32);
  return [...u16(group), ...u16(id), ...te.encode(vr),
    ...(longs.has(vr) ? [0, 0, ...u32(data.length)] : u16(data.length)), ...data];
}

/** Fully invented 2x2 Part 10 axial CT, P1A-compatible. No PHI. */
function synthetic({ layer = 0, series = "2.25.999901", syntax = "1.2.840.10008.1.2.1",
  position = [0, 0, layer], owner = "" } = {}) {
  const uid = "2.25.9999" + String(layer + 1);
  const preamble = new Uint8Array(132);
  preamble.set(te.encode("DICM"), 128);
  const fields = [
    element(0x0002, 0x0010, "UI", syntax),
    element(0x0008, 0x0018, "UI", uid),
    element(0x0008, 0x0060, "CS", "CT"),
    ...(owner ? [element(0x0010, 0x0010, "PN", owner)] : []),
    element(0x0020, 0x000d, "UI", "2.25.9999"),
    element(0x0020, 0x000e, "UI", series),
    element(0x0020, 0x0032, "DS", position.join("\\")),
    element(0x0020, 0x0037, "DS", "1\\0\\0\\0\\1\\0"),
    element(0x0028, 0x0002, "US", u16(1)),
    element(0x0028, 0x0004, "CS", "MONOCHROME2"),
    element(0x0028, 0x0010, "US", u16(2)),
    element(0x0028, 0x0011, "US", u16(2)),
    element(0x0028, 0x0030, "DS", "1\\1"),
    element(0x0028, 0x0100, "US", u16(16)),
    element(0x0028, 0x0101, "US", u16(16)),
    element(0x0028, 0x0102, "US", u16(15)),
    element(0x0028, 0x0103, "US", u16(0)),
    element(0x7fe0, 0x0010, "OW", [0, 0, 1, 0, 2, 0, 3, 0]),
  ].flat();
  return Uint8Array.from([...preamble, ...fields]);
}
function localFile(bytes, stats = { header: 0, full: 0 }, size = bytes.length) {
  return {
    name: "private-test-name-do-not-display.dcm",
    size,
    slice(begin, end) {
      return { async arrayBuffer() {
        stats.header += 1;
        return bytes.slice(begin, end).buffer;
      } };
    },
    async arrayBuffer() {
      stats.full += 1;
      return bytes.slice().buffer;
    },
  };
}

test("G2a preflight recognizes only supported Part 10 LE transfer syntaxes", () => {
  const valid = synthetic();
  assert.equal(inspectDicomHeader(valid), "1.2.840.10008.1.2.1");
  assert.throws(() => inspectDicomHeader(synthetic({ syntax: "1.2.840.10008.1.2.4.50" })),
    (error) => error instanceof IntakeHeaderError && error.code === "unsupported-syntax");
  assert.throws(() => inspectDicomHeader(new Uint8Array(148)),
    (error) => error instanceof IntakeHeaderError && error.code === "invalid-header");
});

test("G2a rejects corrupted/truncated File Meta Information safely", () => {
  const bytes = synthetic();
  const cut = bytes.slice(0, 146);
  assert.throws(() => inspectDicomHeader(cut),
    (error) => error instanceof IntakeHeaderError && error.code === "invalid-header");
});

test("G2a compressed transfer syntax is rejected before full-file buffer allocation", async () => {
  const stats = { header: 0, full: 0 };
  const result = await importLocalDicom([localFile(synthetic({
    syntax: "1.2.840.10008.1.2.4.50",
  }), stats)]);
  assert.equal(stats.header, 1);
  assert.equal(stats.full, 0);
  assert.equal(result.rejectedByReason["unsupported-syntax"], 1);
  assert.equal(result.rejectedFiles, 1);
});

test("G2a invalid byte budgets fail before reading any data", async () => {
  const stats = { header: 0, full: 0 };
  const oversized = localFile(synthetic(), stats, DICOM_INTAKE_LIMITS.maxFileBytes + 1);
  await assert.rejects(importLocalDicom([oversized]), (error) =>
    error instanceof DicomIntakeError && error.code === "budget");
  assert.equal(stats.header + stats.full, 0);
  await assert.rejects(importLocalDicom(Array(601).fill(localFile(synthetic()))), /Límite local/);
  await assert.rejects(importLocalDicom([{
    ...localFile(synthetic()), size: Number.POSITIVE_INFINITY,
  }]), /Límite local/);
});

test("G2a imports synthetics locally, sorts slice geometry and reports progress", async () => {
  const progress = [];
  const result = await importLocalDicom(
    [localFile(synthetic({ layer: 1 })), localFile(synthetic({ layer: 0 }))],
    { onProgress: (done, total) => progress.push([done, total]) },
  );
  assert.deepEqual(progress, [[1, 2], [2, 2]]);
  assert.equal(result.series.length, 1);
  assert.equal(result.series[0].volume.sliceSpacingMm, 1);
  assert.deepEqual(result.series[0].volume.slices.map((s) => s.imagePosition[2]), [0, 1]);
  assert.equal(result.rejectedFiles, 0);
});

test("G2a separates studies/series instead of merging unrelated instances", async () => {
  const input = [
    localFile(synthetic({ layer: 1, series: "2.25.999901" })),
    localFile(synthetic({ layer: 0, series: "2.25.999901" })),
    localFile(synthetic({ layer: 1, series: "2.25.999902" })),
    localFile(synthetic({ layer: 0, series: "2.25.999902" })),
  ];
  const result = await importLocalDicom(input);
  assert.equal(result.series.length, 2);
  assert.equal(result.rejectedFiles, 0);
});

test("G2a rejects unsafe geometry at series level with patient-safe labels", async () => {
  const identity = "DO_NOT_LOG_PATIENT_NAME";
  const result = await importLocalDicom([
    localFile(synthetic({ layer: 0, owner: identity })),
    localFile(synthetic({ layer: 1, position: [0.5, 0, 1], owner: identity })),
  ]);
  assert.equal(result.series.length, 0);
  assert.equal(result.rejectedFiles, 2);
  assert.equal(result.rejectedByReason["incompatible-series"], 2);
  assert.doesNotMatch(JSON.stringify(result.rejectedByReason), /DO_NOT_LOG|private-test-name/);
});

test("G2a cancellation before reading does not allocate any file buffer", async () => {
  const controller = new AbortController();
  controller.abort();
  const stats = { header: 0, full: 0 };
  await assert.rejects(importLocalDicom([localFile(synthetic(), stats)],
    { signal: controller.signal }), (error) =>
    error instanceof DicomIntakeError && error.code === "cancelled");
  assert.equal(stats.header + stats.full, 0);
});

test("G2a cooperative cancellation after first file never opens second file", async () => {
  const controller = new AbortController();
  const before = { header: 0, full: 0 };
  const after = { header: 0, full: 0 };
  const promise = importLocalDicom([
    localFile(synthetic({ layer: 0 }), before),
    localFile(synthetic({ layer: 1 }), after),
  ], { signal: controller.signal, onProgress: () => controller.abort() });
  await assert.rejects(promise, (error) =>
    error instanceof DicomIntakeError && error.code === "cancelled");
  assert.equal(before.full, 1);
  assert.equal(after.header + after.full, 0);
});

test("G2a reports sanitized reasons, not decoder exception contents", async () => {
  const bytes = synthetic();
  bytes[128] = 0; // corrupt DICM marker
  const result = await importLocalDicom([localFile(bytes)]);
  assert.equal(result.series.length, 0);
  assert.equal(result.rejectedByReason["invalid-header"], 1);
  assert.deepEqual(Object.keys(result.rejectedByReason).sort(),
    ["incompatible-series", "invalid-dicom", "invalid-header", "unsupported-syntax"]);
});
