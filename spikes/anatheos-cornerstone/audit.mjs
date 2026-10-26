import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";

const root = resolve("node_modules");
const manifest = (name) => JSON.parse(readFileSync(resolve(root, name, "package.json"), "utf8"));
const direct = ["@cornerstonejs/core", "@cornerstonejs/metadata", "@cornerstonejs/utils",
  "@cornerstonejs/dicom-image-loader"];
const details = direct.map((name) => {
  const pkg = manifest(name);
  assert.equal(pkg.version, "5.13.1", name + " exact version mismatch");
  assert.equal(pkg.license, "MIT", name + " unexpected license");
  return { name, version: pkg.version, license: pkg.license };
});
const loader = manifest("@cornerstonejs/dicom-image-loader");
const codecs = Object.keys(loader.dependencies).filter((name) => name.startsWith("@cornerstonejs/codec-"));
for (const name of codecs) {
  const pkg = manifest(name);
  details.push({ name, version: pkg.version, license: pkg.license || "UNDECLARED" });
}
for (const x of details) {
  if (/^(?:GPL|AGPL|SSPL)/i.test(x.license)) {
    throw new Error("Forbidden/review-required license in " + x.name + ": " + x.license);
  }
}
function walkFiles(folder) {
  const found = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) found.push(...walkFiles(path));
    else if (entry.isFile() && /\.wasm$/i.test(entry.name)) found.push(path);
  }
  return found;
}
const wasmCounts = codecs.map(name => ({ name, wasmFiles: walkFiles(resolve(root, name)).length }));
process.stdout.write("Cornerstone isolated package manifests:\n" +
  JSON.stringify({ direct, inspectedPackages: details, wasmCounts }, null, 2) + "\n");
process.stdout.write("IMPORTANT: metadata is NOT a license audit of all transitive bundles/codec binary IP.\n");
// NOTE: this script intentionally does not certify clinical compatibility.
