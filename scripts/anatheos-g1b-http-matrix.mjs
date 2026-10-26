#!/usr/bin/env node
/**
 * G1B real loopback HTTP smoke against the Vinext/Worker listener; flag OFF only.
 * Does not test the authentication service nor remote header provenance.
 */
import assert from "node:assert/strict";
import { requireLoopbackOrigin } from "./anatheos-loopback-smoke.mjs";

const origin = requireLoopbackOrigin(process.argv[2] ?? "http://127.0.0.1:4173");
const cases = [
  { name: "HTML anonymous", path: "/app/anatheos-3d", headers: { Accept: "text/html" } },
  { name: "HTML spoofed owner", path: "/app/anatheos-3d", headers: { Accept: "text/html", "oai-authenticated-user-email": "owner@example.invalid" } },
  { name: "HTML spoofed third-party", path: "/app/anatheos-3d", headers: { Accept: "text/html", "oai-authenticated-user-email": "third@example.invalid" } },
  { name: "HTML forged variations", path: "/app/anatheos-3d", headers: { Accept: "text/html", "OAI-AUTHENTICATED-USER-FULL-NAME": "fake" } },
  { name: "RSC anonymous", path: "/app/anatheos-3d", headers: { RSC: "1", Accept: "text/x-component" } },
  { name: "RSC forged owner", path: "/app/anatheos-3d?_rsc=g1b-local", headers: { RSC: "1", Accept: "text/x-component", "oai-authenticated-user-email": "owner@example.invalid" } },
  { name: "future API denied", path: "/api/anatheos/studies", headers: { Accept: "application/json" } },
  { name: "future API forged", path: "/api/anatheos/upload", headers: { "oai-authenticated-user-email": "owner@example.invalid" } },
  { name: "nested route", path: "/app/anatheos-3d/subroute", headers: { Accept: "text/html" } },
];

let failed = 0;
for (const scenario of cases) {
  try {
    const route = new URL(scenario.path, origin);
    assert.equal(route.origin, origin);
    const response = await fetch(route, {
      headers: scenario.headers,
      redirect: "manual",
      signal: AbortSignal.timeout(12000),
    });
    const cache = response.headers.get("cache-control") ?? "";
    const robots = response.headers.get("x-robots-tag") ?? "";
    const csp = response.headers.get("content-security-policy") ?? "";
    const security = response.headers.get("x-content-type-options") ?? "";
    const pass = response.status === 404 &&
      /(?:^|[,\s])no-store(?:$|[,\s])/i.test(cache) &&
      /noindex/i.test(robots) &&
      /object-src\s+'none'/i.test(csp) &&
      security === "nosniff";
    if (!pass) failed += 1;
    // Never print response body, identities, cookies or request URL.
    process.stdout.write("G1B HTTP OFF / " + scenario.name + ": " + (pass ? "PASS" : "FAIL") +
      " (status=" + response.status + ", no-store=" + /no-store/i.test(cache) +
      ", noindex=" + /noindex/i.test(robots) + ", csp=" + Boolean(csp) + ")\n");
    await response.body?.cancel();
  } catch {
    failed += 1;
    process.stdout.write("G1B HTTP OFF / " + scenario.name + ": FAIL (request/response error)\n");
  }
}
process.stdout.write("G1B HTTP OFF summary: " + (cases.length - failed) + " PASS / " + failed + " FAIL / 0 SKIPPED\n");
if (failed) process.exitCode = 1;
