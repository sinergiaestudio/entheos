import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const mcp = readFileSync(new URL("../app/mcp/route.ts", import.meta.url), "utf8");
const oauth = readFileSync(new URL("../db/oauth.ts", import.meta.url), "utf8");
const sync = readFileSync(new URL("../db/conversation-sync.ts", import.meta.url), "utf8");

test("MCP exposes an explicit non-destructive Entheos write tool", () => {
  assert.match(mcp, /name: "send_to_entheos"/);
  assert.match(mcp, /readOnlyHint: false/);
  assert.match(mcp, /destructiveHint: false/);
  assert.match(mcp, /idempotentHint: true/);
});

test("MCP declares ChatGPT file parameters with the required shape", () => {
  assert.match(mcp, /"openai\/fileParams": \["files"\]/);
  assert.match(mcp, /download_url/);
  assert.match(mcp, /file_id/);
  assert.match(mcp, /required: \["download_url", "file_id"\]/);
});

test("OAuth supports separated read and write scopes", () => {
  for (const scope of ["health.read", "documents.read", "documents.write", "observations.write", "profile.write"]) {
    assert.match(oauth, new RegExp(scope.replace(".", "\\.")));
  }
});

test("Conversation sync enforces approval, idempotency and document hashing", () => {
  assert.match(sync, /explicitEntheosApproval/);
  assert.match(sync, /idempotency_key/);
  assert.match(sync, /payloadHash/);
  assert.match(sync, /sha256\(bytes\)/);
  assert.match(sync, /patient_confirmed/);
});
