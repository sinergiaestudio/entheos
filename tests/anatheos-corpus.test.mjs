import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { parseDicom, buildVolume, pixelValue } from "../lib/anatheos/dicom.ts";
import {
  corpusCases, expectedVoxelCentreLps, makeSyntheticDicom,
} from "./fixtures/anatheos/synthetic-series.mjs";

const parse = (bytes) => parseDicom(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const slices = (testCase) => testCase.slices.map(parse);
const nearly = (actual, expected, tolerance = 1e-8) => {
  assert.equal(actual.length, expected.length);
  for (let index = 0; index < expected.length; index += 1) {
    assert.ok(Math.abs(actual[index] - expected[index]) <= tolerance,
      "Coordinate " + index + ": actual=" + actual[index] + ", expected=" + expected[index]);
  }
};

test("G2b synthetic corpus contains no downloaded samples or patient-derived fixtures", () => {
  assert.deepEqual(Object.keys(corpusCases).sort(), [
    "axialAnisotropic", "gantryTilt", "implicitLE", "irregularGap",
    "jpegMarker", "multiFrame", "oblique", "reversedNormal", "twoSeries",
  ]);
  for (const data of Object.values(corpusCases)) {
    for (const bytes of data.slices) {
      assert.ok(bytes.byteLength < 4096, "Fixtures are deliberately tiny");
      assert.equal(new TextDecoder().decode(bytes.subarray(128, 132)), "DICM");
    }
  }
});

test("G2b axial anisotropic phantom orders by IPP, uses mm and preserves intensity", () => {
  const phantom = corpusCases.axialAnisotropic;
  const volume = buildVolume(slices(phantom));
  assert.deepEqual(volume.slices.map((slice) => slice.imagePosition[2]), [30, 35, 40]);
  assert.equal(volume.sliceSpacingMm, 5);
  assert.equal(volume.axisAlignedAxial, true);
  assert.deepEqual(volume.slices[0].pixelSpacing, [2, 3]);
  const [column, row, k] = phantom.point.voxel;
  nearly(expectedVoxelCentreLps(volume.slices[k], column, row),
    phantom.point.lpsMm, phantom.point.toleranceMm);
  assert.equal(pixelValue(volume.slices[k], column, row), -788);
});

test("G2b reversed normal phantom retains DICOM LPS lateral sign", () => {
  const phantom = corpusCases.reversedNormal;
  const volume = buildVolume(slices(phantom));
  assert.deepEqual(volume.slices.map((slice) => slice.imagePosition[2]), [30, 25, 20]);
  assert.equal(volume.sliceSpacingMm, 5);
  const [column, row, k] = phantom.point.voxel;
  nearly(expectedVoxelCentreLps(volume.slices[k], column, row),
    phantom.point.lpsMm, phantom.point.toleranceMm);
  assert.equal(volume.slices[0].rowDirection[0], -1);
});

test("G2b oblique phantom has predictable voxel-centre geometry but no fake axial MPR", () => {
  const phantom = corpusCases.oblique;
  const volume = buildVolume(slices(phantom));
  assert.equal(volume.axisAlignedAxial, false);
  assert.equal(volume.sliceSpacingMm, 4);
  const [column, row, k] = phantom.point.voxel;
  nearly(expectedVoxelCentreLps(volume.slices[k], column, row),
    phantom.point.lpsMm, phantom.point.toleranceMm);
});

test("G2b irregular spacing and in-plane gantry tilt fail closed", () => {
  assert.throws(() => buildVolume(slices(corpusCases.irregularGap)), /espaciado irregular/i);
  assert.throws(() => buildVolume(slices(corpusCases.gantryTilt)), /Desplazamiento/i);
});

test("G2b mixing different series is rejected rather than silently joined", () => {
  assert.throws(() => buildVolume(slices(corpusCases.twoSeries)), /mezcla cortes incompatibles/i);
});

test("G2b implicit Little Endian is actually decoded and sorted", () => {
  const volume = buildVolume(slices(corpusCases.implicitLE));
  assert.equal(volume.slices.length, 2);
  assert.equal(volume.sliceSpacingMm, 1);
  assert.equal(volume.slices[0].transferSyntax, "1.2.840.10008.1.2");
});

test("G2b compressed marker and multi-frame cannot be mistaken for supported input", () => {
  assert.throws(() => parse(corpusCases.jpegMarker.slices[0]), /Transfer Syntax no admitida/);
  assert.throws(() => parse(corpusCases.multiFrame.slices[0]), /multiframe/i);
});

test("G2b generated Part 10 samples are byte-for-byte deterministic, including SHA256", () => {
  const first = makeSyntheticDicom({ scenario: 77, layer: 1, position: [1, 2, 3] });
  const second = makeSyntheticDicom({ scenario: 77, layer: 1, position: [1, 2, 3] });
  assert.deepEqual(first, second);
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  assert.equal(hash(first), hash(second));
  assert.match(hash(first), /^[a-f0-9]{64}$/);
  assert.notEqual(hash(first), hash(makeSyntheticDicom({ scenario: 77, layer: 2, position: [1, 2, 3] })));
});
