/**
 * ANATHEOS Cornerstone G2a-B isolated browser-only experiment.
 * NOT imported by Entheos or its clinical Pilot. No DICOMweb URLs.
 * Only File objects explicitly selected by the tester.
 *
 * The ability to bundle this file is NOT proof of runtime decoding or
 * clinical geometry. Memory release depends on browser GC and decoder workers.
 */
import { init as initCore, imageLoader, cache } from "@cornerstonejs/core";
import { init as initDicomLoader, wadouri } from "@cornerstonejs/dicom-image-loader";

let initialized = false;
let lastImageId = null;
const status = document.getElementById("status");

async function initialize() {
  if (initialized) return;
  await initCore();
  initDicomLoader({ maxWebWorkers: 1 });
  initialized = true;
}

function removeImageId(imageId) {
  if (!imageId) return;
  // fileManager.add returns dicomfile:<numeric-index>; caller must release.
  const index = Number(imageId.slice("dicomfile:".length));
  try { cache.removeImageLoadObject(imageId); } catch { /* best-effort cache cleanup */ }
  if (Number.isSafeInteger(index)) wadouri.fileManager.remove(index);
}

function discard() {
  removeImageId(lastImageId);
  lastImageId = null;
  document.getElementById("local-dicom").value = "";
  status.textContent = "La referencia del visor fue retirada; la liberación efectiva de RAM no es inmediata.";
}

async function loadLocal(file) {
  if (!file || file.size > 32 * 1024 * 1024) {
    throw new Error("Elegí un único DICOM sintético de hasta 32 MiB.");
  }
  discard();
  await initialize();
  const id = wadouri.fileManager.add(file);
  lastImageId = id;
  try {
    const image = await imageLoader.loadAndCacheImage(id);
    if (lastImageId !== id) return; // stale result after explicit discard
    status.textContent = "Decodificación local del archivo seleccionado: " +
      String(image.columns) + " × " + String(image.rows) +
      ". Geometría, lateridad y decodificadores comprimidos: NO VALIDADOS.";
  } catch {
    removeImageId(id);
    if (lastImageId === id) lastImageId = null;
    throw new Error("El loader no decodificó este archivo sintético (detalles reservados a test).");
  }
}

document.getElementById("local-dicom").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  status.textContent = "Decodificando un archivo local de prueba...";
  try { await loadLocal(file); }
  catch (error) { status.textContent = error instanceof Error ? error.message : "Error de prueba"; }
});
document.getElementById("clear").addEventListener("click", discard);
window.addEventListener("beforeunload", () => removeImageId(lastImageId));
