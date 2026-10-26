import test from "node:test";
import assert from "node:assert/strict";
import { parseDicom, buildVolume, pixelValue, windowedGray } from "../lib/anatheos/dicom.ts";

// All data are fabricated: no patient identity or clinical images.
function u16(n) { return [n & 255, (n >> 8) & 255]; }
function u32(n) { return [...u16(n & 65535), ...u16(n >>> 16)]; }
const encoder = new TextEncoder();

function element(group, id, vr, data) {
  const longVR = new Set(["OB", "OW", "SQ", "UN"]);
  const bytes = typeof data === "string" ? [...encoder.encode(data)] : [...data];
  if (bytes.length % 2) bytes.push(vr === "UI" ? 0 : 32);
  return [
    ...u16(group), ...u16(id), ...encoder.encode(vr),
    ...(longVR.has(vr) ? [0, 0, ...u32(bytes.length)] : u16(bytes.length)),
    ...bytes,
  ];
}
function makeDicom({
  z = 0, uid = "1.2.3.4", series = "1.2.3", syntax = "1.2.840.10008.1.2.1",
  spacing = "1\\1", orientation = "1\\0\\0\\0\\1\\0", position = null,
  values = [0, 100, 200, 300], signed = false, photometric = "MONOCHROME2",
} = {}) {
  const pixels = values.flatMap((value) => u16(value & 65535));
  const elements = [
    element(0x0002, 0x0010, "UI", syntax),
    element(0x0008, 0x0018, "UI", uid),
    element(0x0008, 0x0060, "CS", "CT"),
    element(0x0020, 0x000d, "UI", "1.2.3.4.5"),
    element(0x0020, 0x000e, "UI", series),
    element(0x0020, 0x0032, "DS", position ?? ("0\\0\\" + z)),
    element(0x0020, 0x0037, "DS", orientation),
    element(0x0028, 0x0002, "US", u16(1)),
    element(0x0028, 0x0004, "CS", photometric),
    element(0x0028, 0x0010, "US", u16(2)),
    element(0x0028, 0x0011, "US", u16(2)),
    element(0x0028, 0x0030, "DS", spacing),
    element(0x0028, 0x0100, "US", u16(16)),
    element(0x0028, 0x0101, "US", u16(16)),
    element(0x0028, 0x0102, "US", u16(15)),
    element(0x0028, 0x0103, "US", u16(signed ? 1 : 0)),
    element(0x0028, 0x1052, "DS", "-1000"),
    element(0x0028, 0x1053, "DS", "1"),
    element(0x0028, 0x1050, "DS", "40"),
    element(0x0028, 0x1051, "DS", "400"),
    element(0x7fe0, 0x0010, "OW", pixels),
  ];
  const preamble = new Uint8Array(132);
  preamble.set(encoder.encode("DICM"), 128);
  return new Uint8Array([...preamble, ...elements.flat()]).buffer;
}

test("reads uncompressed explicit-VR 16-bit pixel data and physical geometry", () => {
  const slice = parseDicom(makeDicom());
  assert.equal(slice.rows, 2);
  assert.equal(slice.columns, 2);
  assert.deepEqual(slice.pixelSpacing, [1, 1]);
  assert.deepEqual(slice.imagePosition, [0, 0, 0]);
  assert.equal(pixelValue(slice, 1, 1), -700);
  assert.equal(slice.windowWidth, 400);
});

test("sign-extends signed samples before applying rescale", () => {
  const slice = parseDicom(makeDicom({ signed: true, values: [-100, -20, 0, 200] }));
  assert.equal(pixelValue(slice, 0, 0), -1100);
  assert.equal(pixelValue(slice, 1, 1), -800);
});

test("sorts slices by geometric position and checks spacing", () => {
  const slices = [
    parseDicom(makeDicom({ z: 2, uid: "2" })),
    parseDicom(makeDicom({ z: 0, uid: "0" })),
    parseDicom(makeDicom({ z: 1, uid: "1" })),
  ];
  const volume = buildVolume(slices);
  assert.deepEqual(volume.slices.map((s) => s.imagePosition[2]), [0, 1, 2]);
  assert.equal(volume.sliceSpacingMm, 1);
  assert.equal(volume.axisAlignedAxial, true);
});

test("rejects gaps, duplicate UIDs and mismatched orientation", () => {
  const a = parseDicom(makeDicom({ z: 0, uid: "a" }));
  const b = parseDicom(makeDicom({ z: 1, uid: "b" }));
  const c = parseDicom(makeDicom({ z: 3, uid: "c" }));
  assert.throws(() => buildVolume([a, b, c]), /espaciado irregular/);
  assert.throws(() => buildVolume([a, a]), /duplicada/);
  assert.throws(() => buildVolume([a, parseDicom(makeDicom({
    z: 1, uid: "d", orientation: "0\\1\\0\\1\\0\\0",
  }))]), /Orientación/);
});

test("rejects compressed pixel transfer syntaxes and malformed preambles", () => {
  assert.throws(() => parseDicom(makeDicom({ syntax: "1.2.840.10008.1.2.4.50" })),
    /Transfer Syntax/);
  const invalid = makeDicom();
  new Uint8Array(invalid)[128] = 0;
  assert.throws(() => parseDicom(invalid), /preámbulo/);
});

test("windowing is bounded and can invert MONOCHROME1", () => {
  assert.equal(windowedGray(-1000, 40, 400), 0);
  assert.equal(windowedGray(1000, 40, 400), 255);
  assert.equal(windowedGray(1000, 40, 400, true), 0);
});

test("rejects absent geometry components and in-plane shifts", () => {
  assert.throws(() => parseDicom(makeDicom({
    orientation: "1\\0\\0\\0\\1\\",
  })), /Metadatos geométricos/);
  const one = parseDicom(makeDicom({ z: 0, uid: "shift-a" }));
  const two = parseDicom(makeDicom({ z: 1, uid: "shift-b", position: "1\\0\\1" }));
  assert.throws(() => buildVolume([one, two]), /Desplazamiento/);
});
