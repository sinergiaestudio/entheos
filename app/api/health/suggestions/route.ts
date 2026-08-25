import { env } from "cloudflare:workers";
import {
  authorizeClinicalRequest,
  cleanText,
  finiteNumber,
  jsonResponse,
  sameOrigin,
  unauthorizedResponse,
  writeAudit,
} from "@/db/clinical";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonResponse({ error: "Solicitud no permitida." }, { status: 403 });
  const context = await authorizeClinicalRequest(request, ["profile.write"]);
  if (!context) return unauthorizedResponse("profile.write");
  try {
    const payload = await request.json() as Record<string, unknown>;
    const title = cleanText(payload.title, 200);
    const suggestionType = cleanText(payload.suggestionType, 60) || "clinical_note";
    const proposed = payload.payload && typeof payload.payload === "object" ? payload.payload : { text: cleanText(payload.text, 12000) };
    const serialized = JSON.stringify(proposed);
    if (!title || serialized.length > 30000) throw new Error("La propuesta no tiene un formato válido.");
    const id = `ais_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO ai_suggestions
      (id, organization_id, patient_id, suggestion_type, title, payload_json, source_type,
      source_reference, model_name, confidence, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'chatgpt', ?, ?, ?, 'pending', ?, ?)`)
      .bind(id, context.organizationId, context.patientId, suggestionType, title, serialized,
        cleanText(payload.sourceReference, 500) || null, cleanText(payload.modelName, 100) || null,
        finiteNumber(payload.confidence, 0, 1), now, now).run();
    await writeAudit(context, "propose", "ai_suggestion", id, { source: "chatgpt", status: "pending" });
    return jsonResponse({ ok: true, id }, { status: 201 });
  } catch (error) {
    const invalidProposal = error instanceof Error && error.message === "La propuesta no tiene un formato válido.";
    return jsonResponse(
      { error: invalidProposal ? error.message : "No pudimos guardar la propuesta." },
      { status: invalidProposal ? 400 : 500 },
    );
  }
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return jsonResponse({ error: "Solicitud no permitida." }, { status: 403 });
  const context = await authorizeClinicalRequest(request, ["profile.write"]);
  if (!context) return unauthorizedResponse("profile.write");
  const payload = await request.json() as Record<string, unknown>;
  const id = cleanText(payload.id, 100);
  const status = cleanText(payload.status, 20);
  if (!id || !["approved", "corrected", "rejected"].includes(status)) {
    return jsonResponse({ error: "Revisión inválida." }, { status: 400 });
  }
  const suggestion = await env.DB.prepare(`SELECT id, title, payload_json FROM ai_suggestions
    WHERE id = ? AND patient_id = ? AND organization_id = ? AND status = 'pending' AND deleted_at IS NULL`)
    .bind(id, context.patientId, context.organizationId)
    .first<{ id: string; title: string; payload_json: string }>();
  if (!suggestion) return jsonResponse({ error: "La propuesta ya fue revisada o no existe." }, { status: 404 });
  const now = new Date().toISOString();
  const notes = cleanText(payload.reviewNotes, 3000) || null;
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`UPDATE ai_suggestions SET status = ?, reviewed_at = ?, reviewed_by = ?,
      review_notes = ?, updated_at = ? WHERE id = ? AND patient_id = ? AND organization_id = ?`)
      .bind(status, now, context.userId, notes, now, id, context.patientId, context.organizationId),
  ];
  if (status === "approved" || status === "corrected") {
    const eventId = `evt_${crypto.randomUUID()}`;
    const body = status === "corrected" && notes ? notes : plainProposal(suggestion.payload_json);
    statements.push(env.DB.prepare(`INSERT INTO timeline_events
      (id, organization_id, patient_id, effective_at, recorded_at, type, title, description,
      source_type, source_id, status, verification_status, visibility, relevance, tags_json,
      version, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'ai_review', ?, ?, 'ai', ?, 'active', 'patient_confirmed',
      'private', 2, '["IA revisada"]', 1, ?, ?, ?)`)
      .bind(eventId, context.organizationId, context.patientId, now, now,
        `Propuesta revisada: ${suggestion.title}`, body, id, context.userId, now, now));
  }
  await env.DB.batch(statements);
  await writeAudit(context, "review", "ai_suggestion", id, { source: "patient", status });
  return jsonResponse({ ok: true, status });
}

function plainProposal(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === "object" && parsed && "text" in parsed) return cleanText((parsed as { text?: unknown }).text, 4000);
    return cleanText(JSON.stringify(parsed, null, 2), 4000);
  } catch {
    return cleanText(value, 4000);
  }
}
