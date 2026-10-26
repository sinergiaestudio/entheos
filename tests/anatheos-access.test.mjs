import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isAnatheosOwner, isAnatheosPilotEnabled } from "../lib/anatheos/owner-access.ts";
import nextConfig from "../next.config.ts";

const OWNER = "owner@example.invalid";
const admin = (email = OWNER) => ({ email, isGlobalAdmin: true });

test("ANATHEOS pilot requires an exact true flag; missing and other values fail closed", () => {
  for (const value of [undefined, null, false, true, "", "false", "TRUE", "true ", "1", "on", 1]) {
    assert.equal(isAnatheosPilotEnabled(value), false);
  }
  assert.equal(isAnatheosPilotEnabled("true"), true);
});

test("anonymous identity, unprivileged matching owner and another account are denied", () => {
  assert.equal(isAnatheosOwner(null, OWNER), false);
  assert.equal(isAnatheosOwner(undefined, OWNER), false);
  assert.equal(isAnatheosOwner({ email: OWNER, isGlobalAdmin: false }, OWNER), false);
  assert.equal(isAnatheosOwner(admin("other@example.invalid"), OWNER), false);
});

test("ANATHEOS refuses authorization when owner configuration is missing or malformed", () => {
  for (const configured of [undefined, null, "", " ", "owner", "owner@", "@example.invalid",
    "owner@example.invalid,other@example.invalid", "owner@example.invalid\nX-Forwarded-For: x",
    "owner@example.invalid;other@example.invalid"]) {
    assert.equal(isAnatheosOwner(admin(), configured), false);
  }
});

test("a claimed administrator cannot enter with an unexpected or malformed email", () => {
  for (const email of ["other@example.invalid", "", "owner", "owner@example.invalid,another@example.invalid"]) {
    assert.equal(isAnatheosOwner(admin(email), OWNER), false);
  }
});

test("only the matching configured owner with the required server-side privilege is accepted", () => {
  assert.equal(isAnatheosOwner(admin(), OWNER), true);
  assert.equal(isAnatheosOwner(admin(" Owner@Example.Invalid "), "OWNER@example.invalid"), true);
});

test("ANATHEOS route checks feature flag before identity and owner predicate", () => {
  const page = readFileSync(fileURLToPath(new URL("../app/app/anatheos-3d/page.tsx", import.meta.url)), "utf8");
  const flagAt = page.indexOf("if (!isAnatheosPilotEnabled(env.ANATHEOS_PILOT_ENABLED)) notFound()");
  const loginAt = page.indexOf('await requireChatGPTUser("/app/anatheos-3d")');
  const ownerAt = page.indexOf("if (!isAnatheosOwner(user, env.APP_OWNER_EMAIL)) notFound()");
  assert.ok(flagAt > 0 && loginAt > flagAt && ownerAt > loginAt,
    "Owner page must gate access in the server code in fail-closed order");
});

test("ANATHEOS base and subpaths declare no-store, noindex and security headers", async () => {
  const rules = await nextConfig.headers();
  for (const source of ["/app/anatheos-3d", "/app/anatheos-3d/:path*"]) {
    const match = rules.find((rule) => rule.source === source);
    assert.ok(match, "Missing headers rule for " + source);
    const hdr = Object.fromEntries(match.headers.map(({ key, value }) => [key.toLowerCase(), value]));
    assert.match(hdr["cache-control"], /(?:^|[, ])no-store(?:[, ]|$)/i);
    assert.match(hdr["x-robots-tag"], /noindex/i);
    assert.equal(hdr["referrer-policy"], "no-referrer");
    assert.equal(hdr["x-content-type-options"], "nosniff");
  }
  assert.ok(rules.find((rule) => rule.source === "/"),
    "Pre-existing Entheos root headers must remain");
});
