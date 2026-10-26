import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isAnatheosHttpPath, offStateResponse } from "../lib/anatheos/http-boundary.ts";
const read = (path) => readFileSync(fileURLToPath(new URL("../" + path, import.meta.url)), "utf8");

test("G7+20 combined workflow checks PR and every pilot push while retaining main", () => {
  const workflow = read(".github/workflows/ci.yml");
  assert.match(workflow, /branches:\s*\[main,\s*feature\/anatheos-3d-owner-pilot\]/);
  assert.match(workflow, /^\s+pull_request:\s*$/m);
  for (const step of ["Install dependencies","Lint","Typecheck","Test production artifact","G1B local HTTP denied-access matrix (no deploy)"]) {
    assert.ok(workflow.includes("- name: " + step), "missing workflow step " + step);
  }
  assert.doesNotMatch(workflow, /\bwrangler deploy\b|\bdeploy site\b|\bcloudflare deploy\b/i);
});

test("G7+20 preservation: G1B G0 decisions, Directory audit and new protection proposal coexist", () => {
  const index = read("docs/anatheos/README.md");
  const state = read("docs/anatheos/ESTADO.md");
  const adr = read("docs/anatheos/REGISTRO_DECISIONES.md");
  for (const doc of ["G1B_HTTP_LOCAL_2026-10-26.md", "PROTECCION_RAMAS_ISSUE_20.md", "AUDITORIA_DIRECCION_2026-10-26.md"]) {
    assert.ok(index.includes(doc), "index lost " + doc);
  }
  for (const tag of ["Checkpoint POST-MERGE", "Checkpoint de ingeniería G1B", "Checkpoint de diseño #20", "Revisión G1B ampliada"]) {
    assert.ok(state.includes(tag), "historical checkpoint lost " + tag);
  }
  for (const tag of ["D-001", "D-010", "P-002", "P-008", "P-009", "P-010"]) {
    assert.ok(adr.includes(tag), "decision lost " + tag);
  }
  assert.match(state, /BLOCKED/);
});

test("G7+20 safety: decoded API and HTML paths fail closed, unrelated Entheos paths unaffected", () => {
  const blocked = [
    "/app/%2561natheos-3d", "/api%252fanatheos%252fupload",
    "/app/a%2f..%2fanatheos-3d", "/app/anatheos-3d%252Fchild",
  ];
  for (const path of blocked) {
    assert.equal(isAnatheosHttpPath(path), true, path);
    assert.equal(offStateResponse(path, false)?.status, 404, path);
  }
  for (const path of ["/", "/app", "/api/entheos", "/_vinext/image", "/app/anatheos-3d-different"]) {
    assert.equal(offStateResponse(path, false), null, path);
  }
});
