#!/usr/bin/env node
/**
 * Emit deterministic invented DICOM fixtures with a SHA-256 manifest.
 * Default mode prints JSON only. To export local .dcm files:
 *   node scripts/anatheos-corpus-manifest.mjs --out /tmp/anatheos-phantom
 * Refuses repository-contained directories to avoid accidental commits.
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, relative, sep, join } from "node:path";
import { fileURLToPath } from "node:url";
import { corpusCases } from "../tests/fixtures/anatheos/synthetic-series.mjs";

const repo = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = process.argv.slice(2);
if (args.length !== 0 && (args.length !== 2 || args[0] !== "--out")) {
  throw new Error("Usage: node scripts/anatheos-corpus-manifest.mjs [--out /path/outside/repo]");
}
const destination = args.length ? resolve(args[1]) : null;
if (destination) {
  const rel = relative(repo, destination);
  if (rel === "" || (rel !== ".." && !rel.startsWith(".." + sep))) {
    throw new Error("Refusing export inside the Git working tree");
  }
}

const manifest = {
  schema: "anatheos.synthetic-corpus.v1",
  provenance: "Manufactured programmatically; no persons, clinical images, or downloads",
  shaAlgorithm: "SHA-256",
  spatialReference: "DICOM patient LPS; voxel centres (column,row,slice), mm",
  cases: [],
};

for (const entry of Object.values(corpusCases)) {
  const files = [];
  for (let index = 0; index < entry.slices.length; index += 1) {
    const bytes = entry.slices[index];
    const filename = entry.caseId + "/slice-" + String(index).padStart(3, "0") + ".dcm";
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    files.push({ filename, sha256, bytes: bytes.length });
    if (destination) {
      const target = join(destination, filename);
      await mkdir(resolve(target, ".."), { recursive: true });
      await writeFile(target, bytes);
    }
  }
  manifest.cases.push({ id: entry.caseId, expectation: entry.expected,
    reference: entry.point ?? null, files });
}

const output = JSON.stringify(manifest, null, 2) + "\n";
if (destination) await writeFile(join(destination, "manifest.json"), output);
process.stdout.write(output);
