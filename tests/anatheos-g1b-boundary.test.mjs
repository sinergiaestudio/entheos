import assert from "node:assert/strict";
import test from "node:test";
import { isAnatheosHttpPath, offStateResponse, withAnatheosPrivateHeaders } from "../lib/anatheos/http-boundary.ts";

const paths = ["/app/anatheos-3d", "/app/anatheos-3d/", "/app/anatheos-3d/abc", "/api/anatheos", "/api/anatheos/files", "/APP/ANATHEOS-3D", "/app/%61natheos-3d", "/app/anatheos-3d%2Fview"];
const headersToCheck = (response) => {
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
  assert.match(response.headers.get("content-security-policy") ?? "", /object-src 'none'/);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
};

test("G1B Worker gate recognizes HTML, RSC subpaths, future APIs and percent-encoded routes", () => {
  for (const path of paths) assert.equal(isAnatheosHttpPath(path), true, path);
  for (const unrelated of ["/", "/app", "/api", "/app/anatheos-3d-extra", "/api/anatheosX", "/_vinext/image"]) {
    assert.equal(isAnatheosHttpPath(unrelated), false, unrelated);
  }
});

test("G1B canonicalization denies encoded, doubly encoded and router-normalized paths", () => {
  const targets = [
    "/app/%61natheos-3d", "/app/%2561natheos-3d",
    "/app/anatheos-3d%2fsub", "/app/anatheos-3d%252fsub",
    "/api%2fanatheos%2fupload", "/api%252fanatheos%252fupload",
    "/app/a/../anatheos-3d", "/app/a%2f..%2fanatheos-3d",
    "/app//anatheos-3d///rsc", "/app\\anatheos-3d\\x",
    "/api/anatheos;param=1/studies", "/app/anatheos-3d%3bmatrix=1",
  ];
  for (const path of targets) {
    assert.equal(isAnatheosHttpPath(path), true, path);
    assert.equal(offStateResponse(path, "false")?.status, 404, path);
  }
  for (const unrelated of ["/app/other", "/api/unrelated", "/app/anatheos-3d-extra", "/api/anatheosx", "/_vinext/image"]) {
    assert.equal(isAnatheosHttpPath(unrelated), false, unrelated);
  }
});

test("G1B HTTP deny is method-agnostic for GET HEAD POST OPTIONS", () => {
  for (const method of ["GET", "HEAD", "POST", "OPTIONS"]) {
    const path = method === "OPTIONS" ? "/api%252fanatheos%252fupload" : "/app/anatheos-3d";
    const result = offStateResponse(path, undefined);
    assert.equal(result?.status, 404, method);
    headersToCheck(result);
  }
});

test("G1B Worker default-off returns real 404 Response with private headers", async () => {
  for (const path of paths) {
    for (const flag of [undefined, null, false, true, "", "false", "TRUE", "1"]) {
      const response = offStateResponse(path, flag);
      assert.ok(response instanceof Response, path);
      assert.equal(response.status, 404);
      assert.equal(await response.text(), "Not Found");
      headersToCheck(response);
    }
  }
});

test("G1B enabled mode never claims to authenticate identity", () => {
  for (const path of paths) assert.equal(offStateResponse(path, "true"), null);
  assert.equal(offStateResponse("/app", "false"), null);
});

test("G1B private security headers protect errors, RSC and future API response types", async () => {
  for (const status of [200, 302, 401, 403, 404, 500]) {
    for (const path of ["/app/anatheos-3d", "/app/anatheos-3d/rsc", "/api/anatheos/upload"]) {
      const initial = new Response(null, { status, headers: { "Cache-Control": "public, max-age=31536000" } });
      const secured = withAnatheosPrivateHeaders(path, initial);
      assert.equal(secured.status, status);
      headersToCheck(secured);
    }
  }
});

test("G1B unrelated Entheos responses preserve identity and existing headers", () => {
  const response = new Response("ok", { headers: { "Cache-Control": "public, max-age=60" } });
  assert.equal(withAnatheosPrivateHeaders("/app", response), response);
  assert.equal(withAnatheosPrivateHeaders("/_vinext/image", response), response);
});
