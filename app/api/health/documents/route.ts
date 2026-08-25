import { env } from "cloudflare:workers";
import {
  authorizeClinicalRequest,
  cleanText,
  jsonResponse,
  sameOrigin,
  sha256,
  unauthorizedResponse,
  validDate,
  writeAudit,
} from "@/db/clinical";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonResponse({ error: "Solicitud no permitida." }, { status: 403 });
  const context = await authorizeClinicalRequest(request, ["documents.write"]);
  if (!context) return unauthorizedResponse("documents.write");
  if (!env.BUCKET) return jsonResponse({ error: "El archivo privado no está disponible." }, { status: 503 });

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonResponse({ error: "Seleccioná un archivo." }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      return jsonResponse({ error: "El archivo debe pesar menos de 25 MB." }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const mimeType = detectMime(new Uint8Array(bytes), file.type, file.name);
    if (!mimeType) {
      return jsonResponse({ error: "Formato no admitido. Usá PDF, imagen, DICOM, ZIP, CSV, JSON o texto." }, { status: 415 });
    }
    const hash = await sha256(bytes);
    const existing = await env.DB.prepare(`SELECT id, display_name FROM document_references
      WHERE patient_id = ? AND organization_id = ? AND sha256 = ? AND deleted_at IS NULL`)
      .bind(context.patientId, context.organizationId, hash)
      .first<{ id: string; display_name: string }>();
    if (existing) {
      return jsonResponse({ error: "Este archivo ya está guardado.", duplicate: existing }, { status: 409 });
    }

    const id = `doc_${crypto.randomUUID()}`;
    const versionId = `dvr_${crypto.randomUUID()}`;
    const eventId = `evt_${crypto.randomUUID()}`;
    const linkId = `dln_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const originalName = safeFileName(file.name);
    const displayName = cleanText(form.get("title"), 200) || originalName;
    const documentType = cleanText(form.get("documentType"), 60) || "otro";
    const studyDate = validDate(form.get("studyDate"));
    const institution = cleanText(form.get("institution"), 180) || null;
    const description = cleanText(form.get("description"), 1500) || null;
    const r2Key = `patients/${context.patientId}/${id}/original`;

    await env.BUCKET.put(r2Key, bytes, {
      httpMetadata: { contentType: mimeType, contentDisposition: `inline; filename="${asciiFileName(originalName)}"` },
      customMetadata: { sha256: hash, patient: context.patientId, document: id },
    });

    try {
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO document_references
          (id, organization_id, patient_id, r2_key, original_name, display_name, mime_type,
          size_bytes, sha256, document_type, study_date, institution, description, tags_json,
          source_type, review_status, version, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 'patient', 'pending', 1, ?, ?, ?)`)
          .bind(id, context.organizationId, context.patientId, r2Key, originalName, displayName,
            mimeType, file.size, hash, documentType, studyDate, institution, description,
            context.userId, now, now),
        env.DB.prepare(`INSERT INTO document_versions
          (id, document_id, r2_key, sha256, mime_type, size_bytes, version, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`)
          .bind(versionId, id, r2Key, hash, mimeType, file.size, context.userId, now),
        env.DB.prepare(`INSERT INTO timeline_events
          (id, organization_id, patient_id, effective_at, recorded_at, type, title, description,
          source_type, source_id, status, verification_status, visibility, relevance, tags_json,
          version, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'document', ?, ?, 'patient', ?, 'active', 'pending', 'private',
          2, ?, 1, ?, ?, ?)`)
          .bind(eventId, context.organizationId, context.patientId,
            studyDate ? `${studyDate}T12:00:00.000Z` : now, now, displayName, description, id,
            JSON.stringify([documentType]), context.userId, now, now),
        env.DB.prepare(`INSERT INTO document_event_links
          (id, organization_id, patient_id, document_id, timeline_event_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`)
          .bind(linkId, context.organizationId, context.patientId, id, eventId, now),
      ]);
    } catch (error) {
      await env.BUCKET.delete(r2Key);
      throw error;
    }

    await writeAudit(context, "upload", "document_reference", id, { source: "patient", documentType });
    return jsonResponse({ ok: true, document: { id, displayName, mimeType, sizeBytes: file.size, studyDate } }, { status: 201 });
  } catch {
    return jsonResponse({ error: "No pudimos guardar el archivo. No se modificó la historia clínica." }, { status: 400 });
  }
}

function detectMime(bytes: Uint8Array, declared: string, name: string): string | null {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (starts(0x25, 0x50, 0x44, 0x46)) return "application/pdf";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  const box = String.fromCharCode(...bytes.slice(4, 12));
  if (box.startsWith("ftyp") && /(heic|heix|hevc|mif1)/i.test(box)) return "image/heic";
  if (bytes.length > 132 && String.fromCharCode(...bytes.slice(128, 132)) === "DICM") return "application/dicom";
  if (starts(0x50, 0x4b, 0x03, 0x04)) return "application/zip";
  const extension = name.toLowerCase().split(".").pop() || "";
  if (declared === "application/json" || extension === "json") return "application/json";
  if (declared === "text/csv" || extension === "csv") return "text/csv";
  if (declared.startsWith("text/plain") || extension === "txt") return "text/plain";
  return null;
}

function safeFileName(value: string) {
  const cleaned = cleanText(value, 180).replace(/[\\/:*?"<>|]/g, "-");
  return cleaned || "documento";
}

function asciiFileName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._ -]/g, "_").slice(0, 150) || "documento";
}
