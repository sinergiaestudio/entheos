import { unzip } from "fflate";
import type { IntakeInput } from "@/lib/anatheos/dicom-intake";

const MAX_ZIP = 110 * 1024 * 1024;
const MAX_TOTAL = 320 * 1024 * 1024;
const MAX_FILE = 32 * 1024 * 1024;
type Entry = { name: string; bytes: Uint8Array };

async function entriesFromZip(source: Uint8Array, signal: AbortSignal): Promise<Entry[]> {
  if (source.byteLength > MAX_ZIP) throw new Error("ZIP_LIMIT");
  let total = 0, count = 0;
  return new Promise((resolve, reject) => {
    unzip(source, { filter(entry) {
      if (signal.aborted) return false;
      count++;
      if (count > 2500 || entry.name.startsWith("/") || entry.name.split("/").includes("..")) return false;
      if (entry.name.endsWith("/") || entry.name.includes("__MACOSX")) return false;
      if (entry.originalSize > (entry.name.endsWith(".zip") ? MAX_ZIP : MAX_FILE)) return false;
      total += entry.originalSize;
      return total <= MAX_TOTAL;
    }}, (err, files) => {
      if (signal.aborted) return reject(new Error("CANCELLED"));
      if (err || count > 2500 || total > MAX_TOTAL) return reject(new Error("ZIP_LIMIT"));
      resolve(Object.entries(files).map(([name, bytes]) => ({ name, bytes })));
    });
  });
}

export async function unpackDicomZip(file: Blob, signal: AbortSignal): Promise<IntakeInput[]> {
  if (file.size > MAX_ZIP) throw new Error("ZIP_LIMIT");
  let members = await entriesFromZip(new Uint8Array(await file.arrayBuffer()), signal);
  const zips = members.filter(x => x.name.toLowerCase().endsWith(".zip"));
  if (zips.length && members.every(x => x.name.toLowerCase().endsWith(".zip") || x.name.toLowerCase().endsWith(".txt"))) {
    const dess = zips.find(x => /MR_DESS[.]zip$/i.test(x.name));
    if (!dess) throw new Error("DESS_NOT_FOUND");
    members = await entriesFromZip(dess.bytes, signal);
  }
  const candidates = members.filter(x => x.bytes.length >= 144 && x.bytes.length <= MAX_FILE &&
    x.bytes[128] === 68 && x.bytes[129] === 73 && x.bytes[130] === 67 && x.bytes[131] === 77);
  if (!candidates.length) throw new Error("NO_DICOM");
  if (candidates.length > 600) throw new Error("ZIP_LIMIT");
  return candidates.map(item => new Blob([new Uint8Array(item.bytes).buffer]));
}

export const ZIP_ERROR_MESSAGES: Record<string, string> = {
  ZIP_LIMIT: "El ZIP excede los límites de procesamiento local.",
  CANCELLED: "Carga cancelada.",
  DESS_NOT_FOUND: "No se encontró la secuencia MR DESS en el contenedor.",
  NO_DICOM: "El ZIP no contiene instancias DICOM Part 10 compatibles.",
};
