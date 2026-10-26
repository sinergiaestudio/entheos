/**
 * ANATHEOS G2a-A — byte-bounded local DICOM intake and migration seam.
 *
 * This is NOT a replacement decoder: P1A remains the only pixel decoder.
 * No network calls, storage bindings or patient identifiers in diagnostics.
 * Keep limits centralized for future Cornerstone3D adapter.
 */
import { buildVolume, parseDicom, type DicomSlice, type DicomVolume } from "./dicom.ts";

export const DICOM_INTAKE_LIMITS = Object.freeze({
  maxFiles: 600,
  maxFileBytes: 32 * 1024 * 1024,
  maxTotalBytes: 320 * 1024 * 1024,
  maxHeaderBytes: 64 * 1024,
});
const TS_EXPLICIT_LE = "1.2.840.10008.1.2.1";
const TS_IMPLICIT_LE = "1.2.840.10008.1.2";
const LONG_VR = new Set(["OB", "OD", "OF", "OL", "OV", "OW", "SQ", "UC", "UR", "UT", "UN"]);

export type IntakeInput = Pick<File, "size" | "slice" | "arrayBuffer">;
export type IntakeRejection =
  | "invalid-header" | "unsupported-syntax" | "invalid-dicom" | "incompatible-series";
export type IntakeSeries = { key: string; volume: DicomVolume; modality: string };
export type IntakeResult = {
  series: IntakeSeries[];
  rejectedFiles: number;
  rejectedByReason: Record<IntakeRejection, number>;
};
export type IntakeOptions = {
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
};

/** These are controlled labels, never names, tags or exception messages from files. */
export const INTAKE_REASON_LABELS: Record<IntakeRejection, string> = {
  "invalid-header": "Cabecera DICOM inválida o incompleta",
  "unsupported-syntax": "Sintaxis de transferencia no compatible con el prototipo",
  "invalid-dicom": "Datos DICOM incompatibles o malformados",
  "incompatible-series": "Serie sin geometría volumétrica compatible",
};

export class DicomIntakeError extends Error {
  readonly code: "budget" | "cancelled";

  constructor(code: "budget" | "cancelled") {
    super(code === "budget"
      ? "Límite local: máximo 600 archivos, 32 MB por archivo y 320 MB en total."
      : "Lectura cancelada en el visor. Una lectura ya iniciada puede finalizar internamente antes de liberar memoria.");
    this.code = code;
    this.name = "DicomIntakeError";
  }
}

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DicomIntakeError("cancelled");
}

function checkBudget(files: readonly IntakeInput[]): void {
  if (files.length === 0 || files.length > DICOM_INTAKE_LIMITS.maxFiles) {
    throw new DicomIntakeError("budget");
  }
  let sum = 0;
  for (const file of files) {
    if (!Number.isSafeInteger(file.size) || file.size < 144 ||
        file.size > DICOM_INTAKE_LIMITS.maxFileBytes) {
      throw new DicomIntakeError("budget");
    }
    sum += file.size;
    if (sum > DICOM_INTAKE_LIMITS.maxTotalBytes) {
      throw new DicomIntakeError("budget");
    }
  }
}

function headerError(kind: "invalid-header" | "unsupported-syntax"): never {
  throw new IntakeHeaderError(kind);
}

export class IntakeHeaderError extends Error {
  readonly code: "invalid-header" | "unsupported-syntax";

  constructor(code: "invalid-header" | "unsupported-syntax") {
    super(INTAKE_REASON_LABELS[code]);
    this.code = code;
    this.name = "IntakeHeaderError";
  }
}

/**
 * Reads only the Part10 preamble and Group 0002 meta information.
 * Unsupported compressed syntax is rejected BEFORE reading whole pixel data.
 * Not a DICOM decoder; intentionally no raw (non-Part10) fallback.
 */
export function inspectDicomHeader(prefix: Uint8Array): string {
  if (prefix.byteLength < 144 || prefix[128] !== 68 || prefix[129] !== 73 ||
      prefix[130] !== 67 || prefix[131] !== 77) headerError("invalid-header");

  const view = new DataView(prefix.buffer, prefix.byteOffset, prefix.byteLength);
  let offset = 132;
  let syntax: string | null = null;
  let count = 0;
  while (offset < prefix.byteLength && count++ < 1024) {
    if (offset + 4 > prefix.byteLength) headerError("invalid-header");
    if (view.getUint16(offset, true) !== 0x0002) break;
    if (offset + 8 > prefix.byteLength) headerError("invalid-header");
    const id = view.getUint16(offset + 2, true);
    const vr = String.fromCharCode(view.getUint8(offset + 4), view.getUint8(offset + 5));
    if (!/^[A-Z]{2}$/.test(vr)) headerError("invalid-header");
    const long = LONG_VR.has(vr);
    const headerSize = long ? 12 : 8;
    if (offset + headerSize > prefix.byteLength) headerError("invalid-header");
    if (long && (view.getUint8(offset + 6) !== 0 || view.getUint8(offset + 7) !== 0)) {
      headerError("invalid-header");
    }
    const length = long ? view.getUint32(offset + 8, true) : view.getUint16(offset + 6, true);
    const next = offset + headerSize + length;
    if (length === 0xffffffff || !Number.isSafeInteger(next) ||
        next > prefix.byteLength || next <= offset) headerError("invalid-header");
    if (id === 0x0010) {
      if (vr !== "UI" || length < 1 || length > 128 || syntax !== null) {
        headerError("invalid-header");
      }
      syntax = new TextDecoder("latin1")
        .decode(prefix.subarray(offset + headerSize, next)).replace(/\0/g, "").trim();
    }
    offset = next;
  }
  if (count >= 1024 || syntax === null) headerError("invalid-header");
  if (syntax !== TS_EXPLICIT_LE && syntax !== TS_IMPLICIT_LE) {
    headerError("unsupported-syntax");
  }
  return syntax;
}

const emptyRejected = (): Record<IntakeRejection, number> => ({
  "invalid-header": 0,
  "unsupported-syntax": 0,
  "invalid-dicom": 0,
  "incompatible-series": 0,
});

/**
 * Serialized file reads avoid concurrent memory spikes. Signal checks happen
 * before/after each asynchronous read; Blob.arrayBuffer() itself may continue
 * internally after cancellation, so this is cooperative, NOT hard interruption.
 */
export async function importLocalDicom(
  files: readonly IntakeInput[],
  options: IntakeOptions = {},
): Promise<IntakeResult> {
  checkAbort(options.signal);
  checkBudget(files);
  const groups = new Map<string, DicomSlice[]>();
  const rejectedByReason = emptyRejected();
  let rejectedFiles = 0;
  for (let i = 0; i < files.length; i++) {
    checkAbort(options.signal);
    const file = files[i];
    let errorKind: IntakeRejection | null = null;
    try {
      const header = new Uint8Array(
        await file.slice(0, Math.min(file.size, DICOM_INTAKE_LIMITS.maxHeaderBytes)).arrayBuffer()
      );
      checkAbort(options.signal);
      inspectDicomHeader(header);
      checkAbort(options.signal);
      const parsed = parseDicom(await file.arrayBuffer());
      checkAbort(options.signal);
      const key = JSON.stringify([parsed.studyUid, parsed.seriesUid]);
      const group = groups.get(key);
      if (group) group.push(parsed);
      else groups.set(key, [parsed]);
    } catch (error) {
      if (error instanceof DicomIntakeError) throw error;
      errorKind = error instanceof IntakeHeaderError ? error.code : "invalid-dicom";
    }
    if (errorKind !== null) {
      rejectedFiles += 1;
      rejectedByReason[errorKind] += 1;
    }
    checkAbort(options.signal);
    options.onProgress?.(i + 1, files.length);
  }
  const series: IntakeSeries[] = [];
  for (const [key, input] of groups) {
    checkAbort(options.signal);
    try {
      const volume = buildVolume(input);
      series.push({ key, volume, modality: input[0].modality });
    } catch {
      rejectedFiles += input.length;
      rejectedByReason["incompatible-series"] += input.length;
    }
  }
  checkAbort(options.signal);
  series.sort((a, b) => b.volume.slices.length - a.volume.slices.length);
  return { series, rejectedFiles, rejectedByReason };
}
