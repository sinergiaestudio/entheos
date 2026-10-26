/**
 * SPDX-oriented, reproducible inventory of the *installed* Cornerstone
 * runtime dependency closure and codec binaries in an ephemeral CI checkout.
 * Declared licenses / hashes are evidence for review, not legal clearance.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve, relative } from "node:path";

const root = process.cwd();
const starting = ["@cornerstonejs/core", "@cornerstonejs/metadata",
  "@cornerstonejs/utils", "@cornerstonejs/dicom-image-loader"];
function locatePackage(name, base) {
  for (let cursor = base; ; cursor = dirname(cursor)) {
    const test = join(cursor, "node_modules", name, "package.json");
    if (existsSync(test)) return test;
    if (dirname(cursor) === cursor) break;
  }
  return null;
}
const pending = starting.map(name => ({ name, from: root, kind: "root" }));
const seen = new Set();
const packages = [];
const missing = [];
while (pending.length) {
  const item = pending.shift();
  const resolved = locatePackage(item.name, item.from);
  if (!resolved) {
    missing.push({ name: item.name, from: item.kind });
    continue;
  }
  if (seen.has(resolved)) continue;
  seen.add(resolved);
  const data = JSON.parse(readFileSync(resolved, "utf8"));
  const directory = dirname(resolved);
  const noticeFiles = readdirSync(directory).filter(name =>
    /^(LICENSE|LICENCE|COPYING|NOTICE)([.-].*)?$/i.test(name)).sort();
  const declared = data.license
    ? typeof data.license === "string" ? data.license : JSON.stringify(data.license)
    : "UNDECLARED";
  packages.push({
    name: data.name, version: data.version, license: declared,
    licenseNotices: noticeFiles,
    relativePath: relative(root, directory),
  });
  for (const name of Object.keys(data.dependencies ?? {})) {
    pending.push({ name, from: directory, kind: "runtime" });
  }
  // PeerDependencies can be runtime requirements; include those installed.
  for (const name of Object.keys(data.peerDependencies ?? {})) {
    if (locatePackage(name, directory)) {
      pending.push({ name, from: directory, kind: "peer" });
    }
  }
}
function collectWasm(directory, accumulator = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const file = join(directory, entry.name);
    if (entry.isDirectory()) collectWasm(file, accumulator);
    else if (entry.isFile() && entry.name.endsWith(".wasm")) {
      const bytes = readFileSync(file);
      accumulator.push({
        relativePath: relative(root, file),
        bytes: statSync(file).size,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }
  return accumulator;
}
const binaries = [];
for (const data of packages.filter(p => p.name?.startsWith("@cornerstonejs/codec-"))) {
  binaries.push(...collectWasm(join(root, data.relativePath)));
}
const review = packages.filter(p =>
  p.license === "UNDECLARED" || /(?:^|[^a-z])(?:AGPL|GPL|LGPL|SSPL|EUPL)(?:-|[^a-z]|$)/i.test(p.license));
packages.sort((a,b)=>a.name.localeCompare(b.name));
binaries.sort((a,b)=>a.relativePath.localeCompare(b.relativePath));
const inventory = {
  note: "CI exploratory SBOM, not legal opinion or licensed product adoption",
  roots: starting, packages, missing, review, binaries,
};
const output = resolve(".sites-runtime/anatheos-cornerstone-sbom.json");
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(inventory, null, 2) + "\n");
process.stdout.write(JSON.stringify({
  totalRuntimeAndPeerPackages: packages.length,
  missingRuntimeReferences: missing,
  licensesForReview: review.map(x=>({name:x.name, license:x.license})),
  codecWasmBinaries: binaries.length,
  codecWasmTotalBytes: binaries.reduce((sum,x)=>sum+x.bytes,0),
  artifact: ".sites-runtime/anatheos-cornerstone-sbom.json",
}, null, 2)+"\n");
