import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { zipSync } from "fflate";
import { unpackDicomZip, ZIP_ERROR_MESSAGES } from "../lib/anatheos/site-demo-zip.ts";
import { makeSyntheticDicom } from "./fixtures/anatheos/synthetic-series.mjs";
import { parseDicom, buildVolume } from "../lib/anatheos/dicom.ts";

function makeZip(entries) {
  const archive = zipSync(entries, {level:4});
  return new Blob([Uint8Array.from(archive).buffer]);
}
const fake = (layer) => makeSyntheticDicom({scenario:96,layer});

test("Sites preview accepts original Part10 ZIP with no filename extension", async () => {
  const zip = makeZip({ "RTKN0668_MR_DESS/10001": fake(1), "RTKN0668_MR_DESS/10002": fake(2) });
  const result = await unpackDicomZip(zip,new AbortController().signal);
  assert.equal(result.length,2);
  const slices = await Promise.all(result.map(async item => parseDicom(await item.arrayBuffer())));
  const volume = buildVolume(slices);
  assert.equal(volume.slices.length,2);
  assert.equal(volume.slices[0].rows,3);
  assert.equal(volume.slices[0].columns,4);
});

test("Sites preview reads nested Leeds package A using only its MR_DESS ZIP", async () => {
  const nested = zipSync({ "RTKN0668_MR_DESS/1001": fake(1), "RTKN0668_MR_DESS/1002": fake(2) });
  const container = makeZip({
    "RTKN0668_MR_DESS.zip": nested,
    "README.txt": new TextEncoder().encode("Synthetic / no PHI"),
  });
  const result = await unpackDicomZip(container,new AbortController().signal);
  assert.equal(result.length,2);
});

test("Sites preview rejects malformed data and honours cancellation", async () => {
  const bad = makeZip({"anything.txt":new TextEncoder().encode("garbage")});
  await assert.rejects(()=>unpackDicomZip(bad,new AbortController().signal),/NO_DICOM/);
  const aborted = new AbortController(); aborted.abort();
  await assert.rejects(()=>unpackDicomZip(bad,aborted.signal),/CANCELLED/);
  assert.ok(ZIP_ERROR_MESSAGES.NO_DICOM);
});

test("Sites preview route gated by flag and owner, not a new public endpoint", () => {
  const route = readFileSync(new URL("../app/app/anatheos-3d/demo/page.tsx",import.meta.url),"utf8");
  const client = readFileSync(new URL("../components/anatheos/site-demo-client.tsx",import.meta.url),"utf8");
  assert.match(route,/isAnatheosPilotEnabled\(env[.]ANATHEOS_PILOT_ENABLED\)/);
  assert.match(route,/isAnatheosOwner\(user, env[.]APP_OWNER_EMAIL\)/);
  assert.match(route,/notFound\(\)/);
  assert.doesNotMatch(client,/\bfetch\s*\(/);
  assert.doesNotMatch(client,/\bFormData\s*\(/);
  assert.doesNotMatch(client,/\b(XMLHttpRequest|sendBeacon|uploadFile)\b/);
});
