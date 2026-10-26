/**
 * ANATHEOS G2a-B — LOCAL browser-only Cornerstone decoding experiment.
 * Only a test-selected File reaches the loader. No DICOMweb / network transport.
 * It is neither a medical viewer nor an approval to use clinical DICOM.
 */
import { init as initCore, imageLoader, cache } from "@cornerstonejs/core";
import { init as initDicomLoader, wadouri } from "@cornerstonejs/dicom-image-loader";

let initialized = false;
let currentImageId = null;
let selectionGeneration = 0;
const status = document.getElementById("status");
const input = document.getElementById("local-dicom");

// Exposes only synthetic-test observations to automated Chromium runner.
// Do not publish this page or load real medical files.
window.__anatheosProbe = { state: "idle" };

async function initialize() {
  if (initialized) return;
  window.__anatheosProbe = { state: "loading", step: "core.init" };
  await initCore();
  window.__anatheosProbe = { state: "loading", step: "loader.init" };
  initDicomLoader({ maxWebWorkers: 1 });
  initialized = true;
  window.__anatheosProbe = { state: "loading", step: "initialized" };
}

function removeImageId(imageId) {
  if (!imageId) return;
  const index = Number(imageId.slice("dicomfile:".length));
  try { cache.removeImageLoadObject(imageId); } catch { /* best effort, benchmark separately */ }
  if (Number.isSafeInteger(index)) wadouri.fileManager.remove(index);
}

function discard() {
  selectionGeneration += 1;
  removeImageId(currentImageId);
  currentImageId = null;
  input.value = "";
  window.__anatheosProbe = { state: "cleared", cleanupRequested: true };
  status.textContent = "Archivo retirado del visor; la liberación de RAM y workers depende del navegador.";
}

async function decodeSelected(file) {
  if (!file || file.size > 32 * 1024 * 1024) {
    throw new Error("Únicamente DICOM sintético local de hasta 32 MiB.");
  }
  discard();
  const generation = selectionGeneration;
  window.__anatheosProbe = { state: "loading" };
  const t0 = performance.now();
  await initialize();
  if (generation !== selectionGeneration) return;
  window.__anatheosProbe = { state: "loading", step: "fileManager.add" };
  const imageId = wadouri.fileManager.add(file);
  currentImageId = imageId;
  try {
    // Disable pre-scaling so image.getPixelData() may be compared to
    // invented 16-bit source samples independently of HU rescale.
    window.__anatheosProbe = { state: "loading", step: "loadAndCacheImage" };
    const image = await imageLoader.loadAndCacheImage(imageId, { preScale: { enabled: false } });
    if (generation !== selectionGeneration) {
      removeImageId(imageId);
      return; // discard any result resolved after a cancellation request
    }
    const pixels = image.getPixelData?.();
    if (!pixels || pixels.length !== image.rows * image.columns) {
      throw new Error("No se recuperaron muestras decodificadas completas.");
    }
    const ds = image.data;
    const slope = Number(ds?.string?.("x00281053") ?? image.slope ?? 1);
    const intercept = Number(ds?.string?.("x00281052") ?? image.intercept ?? 0);
    const positions = [0, 1, 2, image.columns, image.columns + 1, pixels.length - 1];
    const samples = positions.map(index => Number(pixels[index]));
    const result = {
      state: "ok",
      rows: image.rows,
      columns: image.columns,
      pixelCount: pixels.length,
      samples,
      slope,
      intercept,
      transformedSamples: samples.map(v => v * slope + intercept),
      durationMs: Number((performance.now() - t0).toFixed(2)),
      heapBytes: performance.memory?.usedJSHeapSize ?? null,
      transferSyntax: ds?.string?.("x00020010") ?? "unavailable",
    };
    window.__anatheosProbe = result;
    status.textContent = "Cornerstone decodificó " + result.columns + " × " + result.rows +
      " píxeles locales (" + result.durationMs + " ms). NO VALIDADO CLÍNICAMENTE.";
  } catch (e) {
    removeImageId(imageId);
    if (currentImageId === imageId) currentImageId = null;
    if (generation !== selectionGeneration) return;
    // No patient labels or raw dataset data leak to logs.
    window.__anatheosProbe = {
      state: "error",
      category: "decode-error",
      errorClass: e instanceof Error ? e.name : "unknown",
      durationMs: Number((performance.now() - t0).toFixed(2)),
    };
    status.textContent = "No se pudo decodificar este DICOM sintético.";
  }
}

input.addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (file) await decodeSelected(file);
});
document.getElementById("clear").addEventListener("click", discard);
window.addEventListener("beforeunload", () => removeImageId(currentImageId));
