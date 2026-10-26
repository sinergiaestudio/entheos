import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// G0 regression tests only. These checks do not establish authorization,
// medical validity, branch protection, or a private deployment.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(repoRoot, path), "utf8");
const indexPath = "docs/anatheos/README.md";
const index = read(indexPath);

test("G0 index links resolve to existing files inside repository", () => {
  const links = [...index.matchAll(/\]\(([^)]+)\)/g)]
    .map((match) => match[1].split("#", 1)[0])
    .filter((href) => href.endsWith(".md") && !/^https?:\/\//i.test(href));
  assert.ok(links.length >= 10, "The canonical index must link all project documents");
  for (const href of links) {
    const target = resolve(repoRoot, "docs/anatheos", href);
    const fromRoot = relative(repoRoot, target);
    assert.ok(fromRoot !== ".." && !fromRoot.startsWith(".." + sep),
      "Project documentation must not link outside the repository: " + href);
    assert.ok(existsSync(target), "Missing indexed document: " + href);
  }
});

test("G0 index contains every required governance document", () => {
  const required = [
    "PLAN_MAESTRO.md", "ARQUITECTURA_OBJETIVO.md",
    "CALIDAD_SEGURIDAD_VALIDACION.md", "REGISTRO_DECISIONES.md",
    "PROTOCOLO_GIT_Y_CHATS.md", "ESTADO.md",
    "INICIO_CHAT_DESARROLLO.md", "ANATHEOS_MILESTONES.md",
    "ANATHEOS_3D_PILOT.md", "ANATHEOS_CHATGPT_PROJECT_HANDOFF.md",
  ];
  for (const file of required) {
    assert.ok(index.includes(file), "Missing canonical index reference: " + file);
  }
});

test("G0 backlog links cover Issues 6 to 20 and the draft PR 5", () => {
  const linked = new Set([...index.matchAll(
    /https:\/\/github\.com\/sinergiaestudio\/entheos\/issues\/(\d+)/g,
  )].map((match) => Number(match[1])));
  for (let issue = 6; issue <= 20; issue += 1) {
    assert.ok(linked.has(issue), "Missing backlog link: Issue #" + issue);
  }
  assert.match(index, /https:\/\/github\.com\/sinergiaestudio\/entheos\/pull\/5/);
  assert.match(index, /PR piloto, borrador, no fusionar/i);
});

test("G0 documents preserve experimental, non-diagnostic and no-production gates", () => {
  const plan = read("docs/anatheos/PLAN_MAESTRO.md");
  const decisions = read("docs/anatheos/REGISTRO_DECISIONES.md");
  const status = read("docs/anatheos/ESTADO.md");
  assert.match(plan, /Fuera del MVP/);
  assert.match(plan, /diagn[oó]stic/i);
  assert.match(decisions, /D-002/);
  assert.match(decisions, /D-003/);
  assert.match(decisions, /D-004/);
  assert.match(decisions, /D-005/);
  assert.match(status, /Renderizado volum[eé]trico 3D\s*\|\s*NO implementado/i);
  assert.match(status, /Preview\/Site independiente\s*\|\s*NO desplegado/i);
});
