/**
 * Chromium verification of actual Cornerstone decode (not just bundling).
 * Uses deterministic invented DICOM bytes from the existing G2b corpus.
 * No DICOM PHI, no remote endpoints, no Site/publication, no assertions
 * of full DICOM conformance or clinical suitability.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { makeSyntheticDicom } from "../../tests/fixtures/anatheos/synthetic-series.mjs";

const origin = "http://127.0.0.1:4174";
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-precise-memory-info", "--enable-webgl", "--use-gl=angle",
    "--use-angle=swiftshader"],
});
const results = [];
try {
  const page = await browser.newPage();
  const networkEvents = [];
  const consoleErrors = [];
  const workerEvents = [];
  const failedRequests = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.origin !== origin && !["data:", "blob:"].includes(url.protocol)) {
      networkEvents.push({ method: request.method(), protocol: url.protocol });
    }
  });
  page.on("pageerror", error => consoleErrors.push(error.name + ": " + error.message.slice(0,300)));
  page.on("console", msg => { if (msg.type() === "error" || msg.type() === "warning") consoleErrors.push("console." + msg.type() + ": " + msg.text().slice(0,250)); });
  page.on("worker", worker => workerEvents.push("created"));
  page.on("requestfailed", req => failedRequests.push({ origin: new URL(req.url()).origin, reason: req.failure()?.errorText }));
  await page.goto(origin + "/", { waitUntil: "networkidle", timeout: 45000 });
  for (const [name, options, expected] of [
    ["explicit-le-ct-single-frame", { scenario: 78, layer: 2 },
      { rows: 3, columns: 4, pixels: [200, 201, 202, 210, 211, 223] }],
    ["implicit-le-ct-single-frame", { scenario: 79, layer: 1,
      syntax: "1.2.840.10008.1.2" },
      { rows: 3, columns: 4, pixels: [100, 101, 102, 110, 111, 123] }],
  ]) {
    const bytes = makeSyntheticDicom(options);
    const t0 = Date.now();
    await page.locator("#local-dicom").setInputFiles({
      name: name + ".dcm",
      mimeType: "application/dicom",
      buffer: Buffer.from(bytes),
    });
    try {
      await page.waitForFunction(() => ["ok", "error"].includes(
        window.__anatheosProbe?.state), null, { timeout: 20000 });
    } catch (e) {
      const snapshot = await page.evaluate(() => ({
        state: window.__anatheosProbe,
        ui: document.getElementById("status")?.textContent?.slice(0,200),
      }));
      process.stdout.write("G2B Chromium diagnostic timeout (synthetic only): " +
        JSON.stringify({ snapshot, consoleErrors, workerEvents, failedRequests,
          blockedRemoteRequests: networkEvents.length }) + "\n");
      throw e;
    }
    const measured = await page.evaluate(() => window.__anatheosProbe);
    const report = {
      name, state: measured.state, rows: measured.rows, columns: measured.columns,
      pixelCount: measured.pixelCount, samples: measured.samples,
      slope: measured.slope, intercept: measured.intercept,
      transformedSamples: measured.transformedSamples,
      durationMs: measured.durationMs,
      elapsedWallMs: Date.now() - t0,
      heapBytes: measured.heapBytes,
      transferSyntax: measured.transferSyntax,
      imagePlane: measured.imagePlane,
    };
    results.push(report);
    assert.equal(measured.state, "ok", name + " Cornerstone browser decode failed");
    assert.equal(measured.rows, expected.rows);
    assert.equal(measured.columns, expected.columns);
    assert.equal(measured.pixelCount, expected.rows * expected.columns);
    assert.deepEqual(measured.samples, expected.pixels);
    assert.equal(measured.slope, 1);
    assert.equal(measured.intercept, -1000);
    assert.deepEqual(measured.transformedSamples, expected.pixels.map(v => v - 1000));
    assert.ok(Number.isFinite(measured.durationMs) && measured.durationMs >= 0);
    await page.locator("#clear").click();
    const afterClear = await page.evaluate(() => window.__anatheosProbe);
    assert.equal(afterClear.state, "cleared");
    assert.equal(afterClear.cleanupRequested, true);
    assert.equal(afterClear.fileReferenceRemoved, true, "FileManager still holds Blob reference");
  }
  assert.deepEqual(networkEvents, [], "unexpected external browser network request");
  // A failing console is reported, not automatically proof of decode failure.
  process.stdout.write("G2B Chromium actual decode results (synthetic only):\n" +
    JSON.stringify({ results, blockedRemoteRequests: networkEvents.length, pageErrors: consoleErrors }, null, 2) + "\n");
  assert.equal(consoleErrors.length, 0, "Chromium page errors occurred");
} finally {
  await browser.close();
}
