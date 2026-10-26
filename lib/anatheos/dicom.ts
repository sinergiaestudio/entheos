/**
 * ANATHEOS P1A — restricted, local-only DICOM Part 10 reader.
 * Only legacy single-frame, uncompressed, monochrome little-endian images.
 * This is an exploratory prototype, NOT a diagnostic DICOM decoder.
 * Unsupported datasets fail closed rather than being silently approximated.
 */
export type Vector3 = [number, number, number];

export type DicomSlice = {
  buffer: ArrayBuffer;
  studyUid: string;
  seriesUid: string;
  sopUid: string;
  modality: string;
  transferSyntax: string;
  rows: number;
  columns: number;
  pixelSpacing: [number, number];
  imagePosition: Vector3;
  rowDirection: Vector3;
  columnDirection: Vector3;
  bitsAllocated: 8 | 16;
  bitsStored: number;
  pixelRepresentation: 0 | 1;
  photometric: "MONOCHROME1" | "MONOCHROME2";
  pixelOffset: number;
  pixelLength: number;
  rescaleSlope: number;
  rescaleIntercept: number;
  windowCenter: number | null;
  windowWidth: number | null;
};

export type DicomVolume = {
  slices: DicomSlice[];
  sliceSpacingMm: number;
  axisAlignedAxial: boolean;
};

const EXPLICIT_LE = "1.2.840.10008.1.2.1";
const IMPLICIT_LE = "1.2.840.10008.1.2";
const LONG_VR = new Set(["OB", "OD", "OF", "OL", "OV", "OW", "SQ", "UC", "UR", "UT", "UN"]);
const tag = (group: number, element: number) => group * 65536 + element;
const dot = (a: Vector3, b: Vector3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vector3, b: Vector3): Vector3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (v: Vector3) => Math.sqrt(dot(v, v));
const almost = (a: number, b: number, tolerance = 0.0001) =>
  Math.abs(a - b) <= tolerance;

function fail(reason: string): never {
  throw new Error(reason);
}

type Element = { id: number; start: number; length: number; next: number };
function readElement(view: DataView, offset: number, explicit: boolean): Element {
  if (offset + 8 > view.byteLength) fail("Elemento DICOM truncado.");
  const group = view.getUint16(offset, true);
  const element = view.getUint16(offset + 2, true);
  let length: number;
  let start: number;
  if (explicit) {
    const vr = String.fromCharCode(view.getUint8(offset + 4), view.getUint8(offset + 5));
    if (!/^[A-Z]{2}$/.test(vr)) fail("Encabezado VR DICOM inválido.");
    if (LONG_VR.has(vr)) {
      if (offset + 12 > view.byteLength) fail("Elemento DICOM truncado.");
      length = view.getUint32(offset + 8, true);
      start = offset + 12;
    } else {
      length = view.getUint16(offset + 6, true);
      start = offset + 8;
    }
  } else {
    length = view.getUint32(offset + 4, true);
    start = offset + 8;
  }
  if (length === 0xffffffff) fail("Secuencias de longitud indefinida aún no admitidas.");
  const next = start + length;
  if (!Number.isSafeInteger(next) || next > view.byteLength || next <= offset) {
    fail("Elemento DICOM excede los límites del archivo.");
  }
  return { id: tag(group, element), start, length, next };
}

function readText(buffer: ArrayBuffer, value: Element) {
  return new TextDecoder("latin1")
    .decode(new Uint8Array(buffer, value.start, value.length))
    .replace(/\0/g, "").trim();
}

function parseNumbers(raw: string, count: number): number[] {
  const numbers = raw.split("\\").map((value) => Number(value.trim()));
  if (numbers.length !== count || numbers.some((n) => !Number.isFinite(n))) {
    fail("Metadatos geométricos incompletos o inválidos.");
  }
  return numbers;
}

function asVector(raw: string): Vector3 {
  return parseNumbers(raw, 3) as Vector3;
}

export function parseDicom(buffer: ArrayBuffer): DicomSlice {
  if (buffer.byteLength < 144) fail("Archivo demasiado pequeño para DICOM Part 10.");
  const view = new DataView(buffer);
  const magic = String.fromCharCode(...new Uint8Array(buffer, 128, 4));
  if (magic !== "DICM") fail("Se requiere un archivo DICOM Part 10 con preámbulo DICM.");

  let offset = 132;
  let syntax = "";
  while (offset < buffer.byteLength && view.getUint16(offset, true) === 0x0002) {
    const value = readElement(view, offset, true);
    if (value.id === tag(0x0002, 0x0010)) syntax = readText(buffer, value);
    offset = value.next;
  }
  if (syntax !== EXPLICIT_LE && syntax !== IMPLICIT_LE) {
    fail("Transfer Syntax no admitida: únicamente Little Endian sin compresión.");
  }

  const explicit = syntax === EXPLICIT_LE;
  const fields = new Map<number, string | number>();
  let pixelOffset = -1;
  let pixelLength = 0;

  const textualTags = new Set([
    tag(0x0020, 0x000d), tag(0x0020, 0x000e), tag(0x0008, 0x0018),
    tag(0x0008, 0x0060), tag(0x0028, 0x0004), tag(0x0028, 0x0008),
    tag(0x0028, 0x0030), tag(0x0020, 0x0032), tag(0x0020, 0x0037),
    tag(0x0028, 0x1052), tag(0x0028, 0x1053),
    tag(0x0028, 0x1050), tag(0x0028, 0x1051),
  ]);
  const shortTags = new Set([
    tag(0x0028, 0x0010), tag(0x0028, 0x0011), tag(0x0028, 0x0002),
    tag(0x0028, 0x0100), tag(0x0028, 0x0101), tag(0x0028, 0x0102),
    tag(0x0028, 0x0103),
  ]);
  let elements = 0;
  while (offset < buffer.byteLength && elements++ < 20000) {
    const value = readElement(view, offset, explicit);
    if (value.id === tag(0x7fe0, 0x0010)) {
      pixelOffset = value.start;
      pixelLength = value.length;
      break;
    }
    if (textualTags.has(value.id)) fields.set(value.id, readText(buffer, value));
    if (shortTags.has(value.id)) {
      if (value.length !== 2) fail("Longitud de atributo numérico DICOM inválida.");
      fields.set(value.id, view.getUint16(value.start, true));
    }
    offset = value.next;
  }
  if (pixelOffset < 0) fail("No se encontró Pixel Data DICOM compatible.");
  const text = (group: number, element: number) =>
    String(fields.get(tag(group, element)) ?? "");
  const number = (group: number, element: number) =>
    Number(fields.get(tag(group, element)) ?? NaN);

  const rows = number(0x0028, 0x0010);
  const columns = number(0x0028, 0x0011);
  const bitsAllocated = number(0x0028, 0x0100);
  const bitsStored = number(0x0028, 0x0101);
  const highBit = number(0x0028, 0x0102);
  const pixelRepresentation = number(0x0028, 0x0103);
  const samples = number(0x0028, 0x0002);
  const photometric = text(0x0028, 0x0004);
  const frames = text(0x0028, 0x0008);
  if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || columns < 1 ||
    rows > 4096 || columns > 4096) fail("Dimensiones de imagen fuera del rango admitido.");
  if (bitsAllocated !== 8 && bitsAllocated !== 16) fail("Solo se admiten imágenes de 8 o 16 bits.");
  if (bitsStored < 1 || bitsStored > bitsAllocated || highBit !== bitsStored - 1) {
    fail("BitsStored/HighBit no compatibles con este visor experimental.");
  }
  if (pixelRepresentation !== 0 && pixelRepresentation !== 1) fail("Pixel Representation inválida.");
  if (samples !== 1 || !["MONOCHROME1", "MONOCHROME2"].includes(photometric)) {
    fail("Solo se admiten imágenes monocromáticas de una muestra por píxel.");
  }
  if (frames && Number(frames) !== 1) fail("DICOM multiframe requiere un decodificador especializado.");
  const expectedLength = rows * columns * bitsAllocated / 8;
  if (pixelLength < expectedLength || pixelLength > expectedLength + 1) {
    fail("Pixel Data truncado o con longitud incompatible.");
  }

  const spacing = parseNumbers(text(0x0028, 0x0030), 2) as [number, number];
  const orientation = parseNumbers(text(0x0020, 0x0037), 6);
  const rowDirection = orientation.slice(0, 3) as Vector3;
  const columnDirection = orientation.slice(3, 6) as Vector3;
  const imagePosition = asVector(text(0x0020, 0x0032));
  if (spacing.some((n) => n <= 0) || !almost(norm(rowDirection), 1, 0.002) ||
    !almost(norm(columnDirection), 1, 0.002) ||
    Math.abs(dot(rowDirection, columnDirection)) > 0.002) {
    fail("Geometría DICOM inválida (espaciado u orientación).");
  }

  const studyUid = text(0x0020, 0x000d);
  const seriesUid = text(0x0020, 0x000e);
  const sopUid = text(0x0008, 0x0018);
  if (!studyUid || !seriesUid || !sopUid) fail("Identificadores DICOM obligatorios ausentes.");
  const slope = text(0x0028, 0x1053);
  const intercept = text(0x0028, 0x1052);
  const rescaleSlope = slope ? Number(slope) : 1;
  const rescaleIntercept = intercept ? Number(intercept) : 0;
  if (!Number.isFinite(rescaleSlope) || !Number.isFinite(rescaleIntercept) || rescaleSlope === 0) {
    fail("Escala de intensidades inválida.");
  }

  const optionalWindow = (group: number, element: number) => {
    const raw = text(group, element).split("\\")[0].trim();
    return raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) : null;
  };
  return {
    buffer, studyUid, seriesUid, sopUid, modality: text(0x0008, 0x0060) || "OT",
    transferSyntax: syntax, rows, columns, bitsAllocated: bitsAllocated as 8 | 16,
    bitsStored, pixelRepresentation: pixelRepresentation as 0 | 1,
    photometric: photometric as DicomSlice["photometric"],
    pixelSpacing: spacing, rowDirection, columnDirection, imagePosition,
    pixelOffset, pixelLength, rescaleSlope, rescaleIntercept,
    windowCenter: optionalWindow(0x0028, 0x1050),
    windowWidth: optionalWindow(0x0028, 0x1051),
  };
}

export function buildVolume(input: DicomSlice[]): DicomVolume {
  if (input.length < 2) fail("Se necesitan al menos dos cortes de una misma serie.");
  const reference = input[0];
  const normal = cross(reference.rowDirection, reference.columnDirection);
  const seenUids = new Set<string>();
  for (const slice of input) {
    if (slice.studyUid !== reference.studyUid || slice.seriesUid !== reference.seriesUid ||
      slice.rows !== reference.rows || slice.columns !== reference.columns ||
      slice.bitsAllocated !== reference.bitsAllocated || slice.bitsStored !== reference.bitsStored ||
      slice.pixelRepresentation !== reference.pixelRepresentation ||
      slice.photometric !== reference.photometric) {
      fail("La selección mezcla cortes incompatibles de la misma serie.");
    }
    if (seenUids.has(slice.sopUid)) fail("Instancia DICOM duplicada.");
    seenUids.add(slice.sopUid);
    if (slice.pixelSpacing.some((v, i) => !almost(v, reference.pixelSpacing[i], 0.001)) ||
      slice.rowDirection.some((v, i) => !almost(v, reference.rowDirection[i], 0.001)) ||
      slice.columnDirection.some((v, i) => !almost(v, reference.columnDirection[i], 0.001))) {
      fail("Orientación o PixelSpacing incompatible entre cortes.");
    }
  }
  const slices = [...input].sort((a, b) =>
    dot(a.imagePosition, normal) - dot(b.imagePosition, normal));
  const distances = slices.slice(1).map((slice, i) =>
    dot(slice.imagePosition, normal) - dot(slices[i].imagePosition, normal));
  const sorted = [...distances].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (median <= 0.001 || distances.some((distance) =>
    Math.abs(distance - median) > Math.max(0.15, median * 0.05))) {
    fail("Cortes repetidos, faltantes o espaciado irregular; MPR no habilitada.");
  }
  const axisAlignedAxial =
    Math.abs(reference.rowDirection[0]) > 0.999 &&
    Math.abs(reference.columnDirection[1]) > 0.999 &&
    Math.abs(normal[2]) > 0.999;
  return { slices, sliceSpacingMm: median, axisAlignedAxial };
}

export function pixelValue(slice: DicomSlice, x: number, y: number): number {
  const offset = slice.pixelOffset + (y * slice.columns + x) * (slice.bitsAllocated / 8);
  const view = new DataView(slice.buffer);
  let raw = slice.bitsAllocated === 8 ? view.getUint8(offset) : view.getUint16(offset, true);
  const mask = (1 << slice.bitsStored) - 1;
  raw &= mask;
  if (slice.pixelRepresentation === 1 && (raw & (1 << (slice.bitsStored - 1)))) {
    raw -= 1 << slice.bitsStored;
  }
  return raw * slice.rescaleSlope + slice.rescaleIntercept;
}

export function windowedGray(value: number, center: number, width: number, invert = false): number {
  const w = Math.max(1, width);
  const y = w <= 1
    ? (value > center - 0.5 ? 255 : 0)
    : Math.round(Math.max(0, Math.min(1, ((value - (center - 0.5)) / (w - 1)) + 0.5)) * 255);
  return invert ? 255 - y : y;
}
