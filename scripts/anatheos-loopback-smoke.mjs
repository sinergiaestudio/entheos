#!/usr/bin/env node
/**
 * ANATHEOS G1B — opt-in, loopback ONLY smoke probe for disabled pilot.
 * Use with a LOCAL server started WITHOUT ANATHEOS_PILOT_ENABLED=true.
 * Never submit credentials, clinical data, or real owner email.
 * This is NOT a proof of authenticated identity provenance in Sites.
 */
import assert from "node:assert/strict";

export function requireLoopbackOrigin(raw) {
  const candidate = new URL(raw);
  if (candidate.protocol !== "http:" ||
      !["127.0.0.1", "[::1]"].includes(candidate.hostname) ||
      candidate.username || candidate.password ||
      candidate.pathname !== "/" || candidate.search || candidate.hash) {
    throw new Error("Only a literal HTTP loopback origin is permitted.");
  }
  return candidate.origin;
}

if (process.argv[1]?.endsWith("anatheos-loopback-smoke.mjs")) {
  if (process.argv.includes("--self-test")) {
    assert.equal(requireLoopbackOrigin("http://127.0.0.1:3000"), "http://127.0.0.1:3000");
    for (const bad of ["https://127.0.0.1", "https://production.example",
      "http://example.com", "http://localhost", "http://127.0.0.1:3000/path",
      "http://127.0.0.1:3000@somewhere.invalid"]) {
      assert.throws(() => requireLoopbackOrigin(bad));
    }
    process.stdout.write("PASS: only literal HTTP loopback is allowed; no request made.\n");
  } else {
    const raw = process.argv[2] ?? "http://127.0.0.1:3000";
    const origin = requireLoopbackOrigin(raw);
    const route = new URL("/app/anatheos-3d", origin);
    // OFF state must be checked before testing forged identity in a trusted staging.
    // An untrusted header is intentionally synthetic and NEVER a real user email.
    let pass = true;
    for (const headers of [{ Accept: "text/html" }, {
      Accept: "text/html",
      "oai-authenticated-user-email": "untrusted@example.invalid",
    }]) {
      const response = await fetch(route, {
        headers, redirect: "manual", signal: AbortSignal.timeout(5000),
      });
      const cache = response.headers.get("cache-control") ?? "";
      const robots = response.headers.get("x-robots-tag") ?? "";
      const rejected = response.status === 404;
      const noStore = /(?:^|[,\s])no-store(?:$|[,\s])/i.test(cache);
      const noIndex = /noindex/i.test(robots);
      pass &&= rejected && noStore && noIndex;
      process.stdout.write(
        "G1B loopback OFF / " + (headers["oai-authenticated-user-email"] ? "forged" : "anonymous") +
        ": HTTP " + response.status + ", no-store=" + noStore + ", noindex=" + noIndex +
        ", result=" + (rejected && noStore && noIndex ? "PASS" : "FAIL") + "\n"
      );
      await response.body?.cancel();
    }
    if (!pass) process.exitCode = 1;
  }
}
