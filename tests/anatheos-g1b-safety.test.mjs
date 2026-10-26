import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { requireLoopbackOrigin } from "../scripts/anatheos-loopback-smoke.mjs";

test("G1B local probe forbids remote production URLs and DNS hostnames", () => {
  assert.equal(requireLoopbackOrigin("http://127.0.0.1:3000"), "http://127.0.0.1:3000");
  for (const bad of [
    "https://127.0.0.1", "http://localhost:3000", "http://example.com",
    "https://production.example.invalid", "http://127.0.0.1:3000@external.invalid",
    "http://127.0.0.1:3000/app", "ftp://127.0.0.1",
  ]) {
    assert.throws(() => requireLoopbackOrigin(bad), /Only a literal HTTP loopback origin/);
  }
});

test("G1B opt-in local smoke script has a no-network self-test", () => {
  const script = fileURLToPath(new URL("../scripts/anatheos-loopback-smoke.mjs", import.meta.url));
  const out = execFileSync(process.execPath, [script, "--self-test"], { encoding: "utf8" });
  assert.match(out, /PASS: only literal HTTP loopback is allowed; no request made/);
});
