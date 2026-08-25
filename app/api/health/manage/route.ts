import { authorizeClinicalRequest, cleanText, finiteNumber, jsonResponse, sameOrigin, unauthorizedResponse, validDate, writeAudit } from "@/db/clinical";
import { env } from "cloudflare:workers";

type Payload = Record<string, unknown>;

async function contextFor(request: Request) {
  return authorizeClinicalRequest(request, ["observations.write"]);
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return jsonResponse({ error: "Solicitud no permitida." }, { status: 403 });
  const context = await contextFor(request);
  if (!context) return unauthorizedResponse("observations.write", request);
  const payload = await request.json().catch(() => ({})) as Payload;
  const type = cleanText(payload.type, 40);
  const id = cleanText(payload.id, 100);
  if (!type || !id) return jsonResponse({ error: "Registro no válido." }, { status: 400 });
  const now = new Date().toISOString();

  if (type === "clinical_fact") {
    const existing = await owned("clinical_facts", id, context.patientId, context.organizationId);
    if (!existing) return jsonResponse({ error: "Dato clínico no encontrado." }, { status: 404 });
    const categories = ["condition", "medication", "allergy", "family_history", "procedure", "vaccination", "habit", "risk", "treatment", "other"];
    const statuses = ["active", "inactive", "resolved", "historical", "suspected"];
    const category = categories.includes(String(payload.category)) ? String(payload.category) : "other";
    const status = statuses.includes(String(payload.status)) ? String(payload.status) : "active";
    const title = cleanText(payload.title, 180);
    if (!title) return jsonResponse({ error: "Agregá un nombre o descripción breve." }, { status: 400 });
    const effectiveAt = validDate(payload.effectiveAt);
    const endAt = validDate(payload.endAt);
    await env.DB.batch([
      env.DB.prepare(`UPDATE clinical_facts SET category = ?, title = ?, details = ?, dose = ?, schedule = ?,
        status = ?, effective_at = ?, end_at = ?, version = version + 1, updated_at = ?
        WHERE id = ? AND patient_id = ? AND organization_id = ? AND deleted_at IS NULL`)
        .bind(category, title, cleanText(payload.details, 2000) || null, cleanText(payload.dose, 120) || null,
          cleanText(payload.schedule, 200) || null, status, effectiveAt, endAt, now, id, context.patientId, context.organizationId),
      env.DB.prepare(`UPDATE timeline_events SET title = ?, description = ?, effective_at = COALESCE(?, effective_at),
        version = version + 1, updated_at = ? WHERE source_id = ? AND patient_id = ? AND organization_id = ? AND deleted_at IS NULL`)
        .bind(`${factCategoryLabel(category)}: ${title}`, cleanText(payload.details, 2000) || null,
          effectiveAt ? `${effectiveAt}T12:00:00.000Z` : null, now, id, context.patientId, context.organizationId),
    ]);
    await writeAudit(context, "update", "clinical_fact", id, { source: "patient", status });
    return jsonResponse({ ok: true, id });
  }

  if (type === "lab_result") {
    const existing = await owned("lab_results", id, context.patientId, context.organizationId);
    if (!existing) return jsonResponse({ error: "Resultado no encontrado." }, { status: 404 });
    const analyte = cleanText(payload.analyte, 160);
    const resultText = cleanText(payload.resultText, 120);
    if (!analyte || !resultText) return jsonResponse({ error: "Completá indicador y resultado." }, { status: 400 });
    const flag = ["low", "normal", "high"].includes(String(payload.flag)) ? String(payload.flag) : null;
    await env.DB.prepare(`UPDATE lab_results SET analyte = ?, result_text = ?, result_numeric = ?, unit = ?,
      reference_range = ?, flag = ?, method = ?, verification_status = 'patient_corrected', updated_at = ?
      WHERE id = ? AND patient_id = ? AND organization_id = ? AND deleted_at IS NULL`)
      .bind(analyte, resultText, finiteNumber(payload.resultNumeric, -1000000, 1000000), cleanText(payload.unit, 40) || null,
        cleanText(payload.referenceRange, 120) || null, flag, cleanText(payload.method, 120) || null,
        now, id, context.patientId, context.organizationId).run();
    await writeAudit(context, "update", "lab_result", id, { source: "patient" });
    return jsonResponse({ ok: true, id });
  }

  if (type === "document") {
    const existing = await owned("document_references", id, context.patientId, context.organizationId);
    if (!existing) return jsonResponse({ error: "Documento no encontrado." }, { status: 404 });
    const displayName = cleanText(payload.displayName, 200);
    if (!displayName) return jsonResponse({ error: "Indicá un nombre visible." }, { status: 400 });
    const documentType = cleanText(payload.documentType, 60) || "otro";
    const studyDate = validDate(payload.studyDate);
    const description = cleanText(payload.description, 1500) || null;
    await env.DB.batch([
      env.DB.prepare(`UPDATE document_references SET display_name = ?, document_type = ?, study_date = ?,
        institution = ?, description = ?, version = version + 1, updated_at = ?
        WHERE id = ? AND patient_id = ? AND organization_id = ? AND deleted_at IS NULL`)
        .bind(displayName, documentType, studyDate, cleanText(payload.institution, 180) || null, description,
          now, id, context.patientId, context.organizationId),
      env.DB.prepare(`UPDATE timeline_events SET title = ?, description = ?, effective_at = COALESCE(?, effective_at),
        version = version + 1, updated_at = ? WHERE source_id = ? AND patient_id = ? AND organization_id = ? AND deleted_at IS NULL`)
        .bind(displayName, description, studyDate ? `${studyDate}T12:00:00.000Z` : null,
          now, id, context.patientId, context.organizationId),
    ]);
    await writeAudit(context, "update", "document_reference", id, { source: "patient", documentType });
    return jsonResponse({ ok: true, id });
  }

  return jsonResponse({ error: "Tipo de registro no admitido." }, { status: 400 });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return jsonResponse({ error: "Solicitud no permitida." }, { status: 403 });
  const context = await contextFor(request);
  if (!context) return unauthorizedResponse("observations.write", request);
  const payload = await request.json().catch(() => ({})) as Payload;
  const type = cleanText(payload.type, 40);
  const id = cleanText(payload.id, 100);
  const now = new Date().toISOString();
  const table = type === "clinical_fact" ? "clinical_facts" : type === "lab_result" ? "lab_results" : type === "document" ? "document_references" : "";
  if (!table || !id) return jsonResponse({ error: "Registro no válido." }, { status: 400 });
  const existing = await owned(table, id, context.patientId, context.organizationId);
  if (!existing) return jsonResponse({ error: "Registro no encontrado." }, { status: 404 });

  await env.DB.prepare(`UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ? AND patient_id = ? AND organization_id = ? AND deleted_at IS NULL`)
    .bind(now, now, id, context.patientId, context.organizationId).run();
  if (type === "clinical_fact" || type === "document") {
    await env.DB.prepare(`UPDATE timeline_events SET deleted_at = ?, updated_at = ?
      WHERE source_id = ? AND patient_id = ? AND organization_id = ? AND deleted_at IS NULL`)
      .bind(now, now, id, context.patientId, context.organizationId).run();
  }
  if (type === "lab_result") {
    const panelId = String((existing as Record<string, unknown>).panel_id || "");
    if (panelId) {
      const remaining = await env.DB.prepare("SELECT COUNT(*) AS count FROM lab_results WHERE panel_id = ? AND deleted_at IS NULL").bind(panelId).first<{ count: number }>();
      if (!remaining?.count) await env.DB.prepare("UPDATE lab_panels SET deleted_at = ?, updated_at = ? WHERE id = ? AND patient_id = ?").bind(now, now, panelId, context.patientId).run();
    }
  }
  await writeAudit(context, "delete", table, id, { source: "patient", status: "soft_deleted" });
  return jsonResponse({ ok: true, id });
}

async function owned(table: string, id: string, patientId: string, organizationId: string) {
  const allowed = new Set(["clinical_facts", "lab_results", "document_references"]);
  if (!allowed.has(table)) return null;
  return env.DB.prepare(`SELECT * FROM ${table} WHERE id = ? AND patient_id = ? AND organization_id = ? AND deleted_at IS NULL`)
    .bind(id, patientId, organizationId).first<Record<string, unknown>>();
}

function factCategoryLabel(value: string) {
  return ({ condition: "Antecedente o condición", medication: "Medicación", allergy: "Alergia", family_history: "Antecedente familiar", procedure: "Procedimiento", vaccination: "Vacunación", habit: "Hábito", risk: "Factor de riesgo", treatment: "Tratamiento", other: "Dato clínico" } as Record<string, string>)[value] || "Dato clínico";
}
