/**
 * Deterministic RLE Lossless DICOM Part 10 encoder used ONLY for the
 * experimental Chromium decoder bench. Every number and UID is invented.
 *
 * Produces valid DICOM RLE bitstreams (PS3.5 G.5) and an encapsulated
 * Pixel Data element with a Basic Offset Table. It does NOT provide the
 * complete IOD required for diagnostic CT or enhanced multi-frame CT.
 */
import { makeSyntheticDicom } from "../../tests/fixtures/anatheos/synthetic-series.mjs";

export const RLE_UID = "1.2.840.10008.1.2.5";
const word = (n) => [n & 255, (n >>> 8) & 255];
const dword = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];

function packBitsLiteral(values) {
  const out = [];
  for (let offset = 0; offset < values.length; offset += 128) {
    const segment = values.slice(offset, offset + 128);
    out.push(segment.length - 1, ...segment);
  }
  return out;
}

function inventedPixelArray(layer, rows, columns) {
  return Array.from({ length: rows * columns }, (_, i) =>
    layer * 100 + Math.floor(i / columns) * 10 + (i % columns));
}

function frameRle(pixels) {
  if (!pixels.length || pixels.some(n => !Number.isInteger(n) || n < 0 || n > 65535)) {
    throw Error("RLE test inputs must be unsigned 16-bit synthetic pixels");
  }
  // DICOM RLE: most significant byte-plane first, least significant second.
  const msb = packBitsLiteral(pixels.map(n => (n >>> 8) & 255));
  const lsb = packBitsLiteral(pixels.map(n => n & 255));
  const header = Array.from({ length: 64 }, () => 0);
  header.splice(0, 4, ...dword(2));
  header.splice(4, 4, ...dword(64));
  header.splice(8, 4, ...dword(64 + msb.length));
  const frame = [...header, ...msb, ...lsb];
  if (frame.length % 2) frame.push(0); // fragment item must have even length.
  return frame;
}

function item(bytes) {
  return [...word(0xfffe), ...word(0xe000), ...dword(bytes.length), ...bytes];
}

/**
 * Single/multiple encapsulated RLE frames. Classic CT SOP Class is used as
 * a synthetic parser stress case; multi-frame IOD conformance NOT claimed.
 */
export function makeSyntheticRle({ scenario = 91, layers = [2], rows = 3, columns = 4 } = {}) {
  if (!layers.length || layers.length > 8) throw Error("RLE test frame limit is 1..8");
  const oldBytes = makeSyntheticDicom({
    scenario, layer: layers[0], rows, columns, syntax: RLE_UID,
    frames: layers.length,
  });
  // Replace final native Pixel Data with encapsulated Pixel Data. The
  // preamble and File Meta Information transfer syntax remain authentic.
  const tag = [0xe0, 0x7f, 0x10, 0x00, 0x4f, 0x57, 0, 0]; // (7fe0,0010) OW
  let index = -1;
  for (let i = 0; i <= oldBytes.length - tag.length; i++) {
    if (tag.every((n, k) => oldBytes[i+k] === n)) index = i;
  }
  if (index < 132) throw Error("Synthetic native pixel data element not found");
  const frames = layers.map(layer =>
    frameRle(inventedPixelArray(layer, rows, columns)));
  const basicOffsets = [];
  let relative = 0;
  for (const frame of frames) {
    basicOffsets.push(...dword(relative));
    relative += 8 + frame.length; // offset from first fragment item tag.
  }
  const pixelElement = [
    ...word(0x7fe0), ...word(0x0010),
    0x4f, 0x42, 0, 0, ...dword(0xffffffff), // OB, undefined length
    ...item(basicOffsets),
    ...frames.flatMap(frame => item(frame)),
    ...word(0xfffe), ...word(0xe0dd), ...dword(0), // sequence delimiter
  ];
  return Uint8Array.from([...oldBytes.slice(0,index), ...pixelElement]);
}
