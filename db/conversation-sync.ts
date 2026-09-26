import { env } from "cloudflare:workers";
import {
  cleanText,
  sha256,
  validDate,
  writeAudit,
  type ClinicalContext,
} from "./clinical";
import { ClinicalInputError, recordClinical } from "./health-data";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_RECORDS = 100;
const MAX_FILES = 20;

type AnyRow = Record<string, unknown>;

type OpenAIFileInput = {
  download_url?: unknown;
  file_id?: unknown;
  mime_type?: unknown;
  file_name?: unknown;
};

type DocumentMetadata = {
  file_id?: unknown;
  title?: unknown;
  document_type?: unknown;
  study_date?: unknown;
  institution?: unknown;
  professional?: unknown;
  specialty?: unknown;
  description?: unknown;
  tags?: unknown;
};

export async function syncConversationUpdate(context: ClinicalContext, args: AnyRow) {
  const approval = cleanText(args.approval, 300);
  if (!explicitEntheosApproval(approval)) {
    throw new ClinicalInputError("La actualización requiere una instrucción explícita del usuario para guardar en Entheos.");
  }

  const idempotencyKey = cleanText(args.idempotency_key, 100);
  if (!idempotencyKey) throw new ClinicalInputError("Falta la clave de idempotencia.");

  const sourceReference = cleanText(args.source_reference, 500) || "chatgpt-conversation";
  const summary = cleanText(args.summary, 4000);
  const records = Array.isArray(args.records)
    ? args.records.filter((item): item is AnyRow => Boolean(item && typeof item === "object")).slice(0, MAX_RECORDS)
    : [];
  const files = Array.isArray(args.files)
    ? args.files.filter((item): item is OpenAIFileInput => Boolean(item && typeof item === "object")).slice(0, MAX_FILES)
    : [];
  const documentMetadata = Array.isArray(args.documents)
    ? args.documents.filter((item): item is DocumentMetadata => Boolean(item && typeof item === "object")).slice(0, MAX_FILES)
    : [];

  if (!records.length && !files.length) {
    throw new ClinicalInputError("No hay datos ni archivos para guardar.");
  }

  const payloadHash = await sha256(JSON.stringify({
    sourceReference,
    summary,
    records,
    files: files.map((file) => ({
      file_id: cleanText(file.file_id, 200),
      file_name: cleanText(file.file_name, 200),
      mime_type: cleanText(file.mime_type, 120),
    })),
    documentMetadata,
  }));

  const database = env.DB;
  if (!database) throw new Error("Clinical database unavailable");

  const existing = await database.prepare(`SELECT id, entity_id, status, payload_hash
    FROM sync_events WHERE patient_id = ? AND idempotency_key = ?`)
    .bind(context.patientId, idempotencyKey)
    .first<{ id: string; entity_id: string | null; status: string; payload_hash: string | null }>();

  if (existing?.status === "completed") {
    if (existing.payload_hash && existing.payload_hash !== payloadHash) {
      throw new ClinicalInputError("La clave de idempotencia ya fue utilizada con otro contenido.");
    }
    return { ok: true, replayed: true, batchId: existing.entity_id, records: [], documents: [] };
  }
  if (existing?.status === "processing") {
    throw new ClinicalInputError("La actualización ya se está procesando.");
  }

  const syncId = existing?.id || `syn_${crypto.randomUUID()}`;
  const batchId = existing?.entity_id || `csy_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  if (existing) {
    await database.prepare(`UPDATE sync_events SET status = 'processing', payload_hash = ?, entity_id = ?
      WHERE id = ? AND patient_id = ?`)
      .bind(payloadHash, batchId, syncId, context.patientId).run();
  } else {
    await database.prepare(`INSERT INTO sync_events
      (id, organization_id, patient_id, client_id, idempotency_key, entity_type,
      entity_id, status, payload_hash, created_at)
      VALUES (?, ?, ?, 'chatgpt-mcp', ?, 'conversation_sync', ?, 'processing', ?, ?)`) 
      .bind(syncId, context.organizationId, context.patientId, idempotencyKey,
        batchId, payloadHash, now).run();
  }

  const savedRecords: unknown[] = [];
  const savedDocuments: unknown[] = [];
  try {
    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      const kind = cleanText(record.kind, 40);
      const payload = record.payload && typeof record.payload === "object"
        ? record.payload as AnyRow
        : {};
      if (!kind) throw new ClinicalInputError(`El registro ${index + 1} no tiene tipo.`);
      const result = await recordClinical(context, { ...payload, kind });
      await markRecordAsChatGPTConfirmed(context, kind, result as AnyRow, sourceReference);
      savedRecords.push({ index, kind, result });
    }

    const metadataByFile = new Map(documentMetadata.map((item) => [cleanText(item.file_id, 200), item]));
    for (let index = 0; index < files.length; index += 1) {
      const file = normalizeFileInput(files[index]);
      const metadata = metadataByFile.get(file.fileId) || documentMetadata[index] || {};
      savedDocuments.push(await saveRemoteDocument(context, file, metadata, sourceReference));
    }

    await database.prepare(`UPDATE sync_events SET status = 'completed', entity_id = ?
      WHERE id = ? AND patient_id = ?`)
      .bind(batchId, syncId, context.patientId).run();
    await writeAudit(context, "conversation_sync", "conversation_batch", batchId, {
      source: "chatgpt",
      count: savedRecords.length + savedDocuments.length,
      status: "completed",
    });
    return {
      ok: true,
      replayed: false,
      batchId,
      summary,
      sourceReference,
      records: savedRecords,
      documents: savedDocuments,
    };
  } catch (error) {
    await database.prepare(`UPDATE sync_events SET status = 'failed' WHERE id = ? AND patient_id = ?`)
      .bind(syncId, context.patientId).run().catch(() => undefined);
    await writeAudit(context, "conversation_sync", "conversation_batch", batchId, {
      source: "chatgpt",
      count: savedRecords.length + savedDocuments.length,
      status: "failed",
    }, "error").catch(() => undefined);
    throw error;
  }
}

function explicitEntheosApproval(value: string) {
  const normalized = value.toLocaleLowerCase("es-AR");
  return normalized.includes("entheos") && /(enviar|enviá|subir|subí|guardar|guardá|actualizar|actualizá|sincronizar|sincronizá|cargar|cargá)/.test(normalized);
}

function normalizeFileInput(value: OpenAIFileInput) {
  const downloadUrl = cleanText(value.download_url, 8000);
  const fileId = cleanText(value.file_id, 200);
  const mimeType = cleanText(value.mime_type, 120);
  const fileName = cleanText(value.file_name, 200) || fileId || "documento";
  if (!downloadUrl || !fileId) throw new ClinicalInputError("El archivo de ChatGPT no tiene una referencia válida.");
  const parsed = safeRemoteUrl(downloadUrl);
  if (!parsed) throw new ClinicalInputError("La URL temporal del archivo no es válida.");
  return { downloadUrl: parsed.toString(), fileId, mimeType, fileName };
}

async function saveRemoteDocument(
  context: ClinicalContext,
  file: ReturnType<typeof normalizeFileInput>,
  metadata: DocumentMetadata,
  sourceReference: string,
) {
  if (!env.BUCKET) throw new ClinicalInputError("El almacenamiento privado de documentos no está disponible.");
  const response = await fetch(file.downloadUrl, {
    method: "GET",
    redirect: "follow",
    headers: { accept: "*/*" },
  });
  if (!response.ok) throw new ClinicalInputError(`No se pudo descargar ${file.fileName} desde ChatGPT.`);
  const announcedSize = Number(response.headers.get("content-length") || 0);
  if (announcedSize > MAX_FILE_BYTES) throw new ClinicalInputError("El archivo supera el límite de 25 MB.");
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > MAX_FILE_BYTES) throw new ClinicalInputError("El archivo está vacío o supera el límite de 25 MB.");

  const originalName = safeFileName(file.fileName);
  const declaredMime = file.mimeType || response.headers.get("content-type") || "";
  const mimeType = detectMime(new Uint8Array(bytes), declaredMime, originalName);
  if (!mimeType) throw new ClinicalInputError(`El formato de ${originalName} no está admitido.`);
  const hash = await sha256(bytes);
  const existing = await env.DB.prepare(`SELECT id, display_name FROM document_references
    WHERE patient_id = ? AND organization_id = ? AND sha256 = ? AND deleted_at IS NULL`)
    .bind(context.patientId, context.organizationId, hash)
    .first<{ id: string; display_name: string }>();
  if (existing) return { duplicate: true, id: existing.id, displayName: existing.display_name };

  const id = `doc_${crypto.randomUUID()}`;
  const versionId = `dvr_${crypto.randomUUID()}`;
  const eventId = `evt_${crypto.randomUUID()}`;
  const linkId = `dln_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const displayName = cleanText(metadata.title, 200) || originalName;
  const documentType = cleanText(metadata.document_type, 60) || "otro";
  const studyDate = validDate(metadata.study_date);
  const institution = cleanText(metadata.institution, 180) || null;
  const professional = cleanText(metadata.professional, 180) || null;
  const specialty = cleanText(metadata.specialty, 120) || null;
  const description = cleanText(metadata.description, 1500) || null;
  const tags = Array.isArray(metadata.tags)
    ? metadata.tags.map((tag) => cleanText(tag, 50)).filter(Boolean).slice(0, 20)
    : [];
  const tagsJson = JSON.stringify([...new Set(["ChatGPT", documentType, ...tags])]);
  const r2Key = `patients/${context.patientId}/${id}/original`;

  await env.BUCKET.put(r2Key, bytes, {
    httpMetadata: {
      contentType: mimeType,
      contentDisposition: `inline; filename="${asciiFileName(originalName)}"`,
    },
    customMetadata: {
      sha256: hash,
      patient: context.patientId,
      document: id,
      source: "chatgpt",
      sourceReference: cleanText(sourceReference, 500),
      openaiFileId: file.fileId,
    },
  });

  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO document_references
        (id, organization_id, patient_id, r2_key, original_name, display_name, mime_type,
        size_bytes, sha256, document_type, study_date, institution, professional, specialty,
        description, tags_json, source_type, review_status, version, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'chatgpt', 'approved', 1, ?, ?, ?)`) 
        .bind(id, context.organizationId, context.patientId, r2Key, originalName, displayName,
          mimeType, bytes.byteLength, hash, documentType, studyDate, institution, professional,
          specialty, description, tagsJson, context.userId, now, now),
      env.DB.prepare(`INSERT INTO document_versions
        (id, document_id, r2_key, sha256, mime_type, size_bytes, version, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`) 
        .bind(versionId, id, r2Key, hash, mimeType, bytes.byteLength, context.userId, now),
      env.DB.prepare(`INSERT INTO timeline_events
        (id, organization_id, patient_id, effective_at, recorded_at, type, title, description,
        source_type, source_id, status, verification_status, visibility, relevance, tags_json,
        version, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'document', ?, ?, 'chatgpt', ?, 'active', 'patient_confirmed',
        'private', 2, ?, 1, ?, ?, ?)`) 
        .bind(eventId, context.organizationId, context.patientId,
          studyDate ? `${studyDate}T12:00:00.000Z` : now, now, displayName, description, id,
          tagsJson, context.userId, now, now),
      env.DB.prepare(`INSERT INTO document_event_links
        (id, organization_id, patient_id, document_id, timeline_event_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`) 
        .bind(linkId, context.organizationId, context.patientId, id, eventId, now),
    ]);
  } catch (error) {
    await env.BUCKET.delete(r2Key);
    throw error;
  }

  await writeAudit(context, "upload", "document_reference", id, {
    source: "chatgpt",
    documentType,
    status: "patient_confirmed",
  });
  return {
    duplicate: false,
    id,
    eventId,
    displayName,
    mimeType,
    sizeBytes: bytes.byteLength,
    studyDate,
  };
}

async function markRecordAsChatGPTConfirmed(
  context: ClinicalContext,
  kind: string,
  result: AnyRow,
  sourceReference: string,
) {
  const statements: D1PreparedStatement[] = [];
  const confirmed = "patient_confirmed";
  const add = (sql: string, ...values: unknown[]) => statements.push(env.DB.prepare(sql).bind(...values));
  const id = cleanText(result.id, 120);
  const eventId = cleanText(result.eventId, 120);

  if (kind === "weight" && id) add("UPDATE weight_entries SET source_type = 'chatgpt', verification_status = ? WHERE id = ? AND patient_id = ?", confirmed, id, context.patientId);
  if (kind === "activity" && id) add("UPDATE activity_sessions SET source_type = 'chatgpt', verification_status = ? WHERE id = ? AND patient_id = ?", confirmed, id, context.patientId);
  if (kind === "sleep" && id) add("UPDATE sleep_entries SET source_type = 'chatgpt', verification_status = ? WHERE id = ? AND patient_id = ?", confirmed, id, context.patientId);
  if (kind === "symptom" && id) add("UPDATE symptom_entries SET source_type = 'chatgpt', verification_status = ? WHERE id = ? AND patient_id = ?", confirmed, id, context.patientId);
  if (kind === "clinical_fact" && id) add("UPDATE clinical_facts SET source_type = 'chatgpt', verification_status = ?, source_id = ? WHERE id = ? AND patient_id = ?", confirmed, cleanText(sourceReference, 500), id, context.patientId);
  if (kind === "nutrition_day" && id) add("UPDATE nutrition_days SET source_type = 'chatgpt', verification_status = ? WHERE id = ? AND patient_id = ?", confirmed, id, context.patientId);

  if (kind === "blood_pressure") {
    const seriesId = cleanText(result.seriesId, 120);
    if (seriesId) add("UPDATE blood_pressure_readings SET source_type = 'chatgpt', verification_status = ? WHERE series_id = ? AND patient_id = ?", confirmed, seriesId, context.patientId);
  }

  if (kind === "lab_result") {
    const panelId = cleanText(result.panelId, 120);
    const resultId = cleanText(result.resultId, 120);
    if (panelId) add("UPDATE lab_panels SET verification_status = ? WHERE id = ? AND patient_id = ?", confirmed, panelId, context.patientId);
    if (resultId) add("UPDATE lab_results SET verification_status = ? WHERE id = ? AND patient_id = ?", confirmed, resultId, context.patientId);
  }

  if (eventId) add("UPDATE timeline_events SET source_type = 'chatgpt', verification_status = ? WHERE id = ? AND patient_id = ?", confirmed, eventId, context.patientId);
  if (kind === "timeline" && id) add("UPDATE timeline_events SET source_type = 'chatgpt', verification_status = ? WHERE id = ? AND patient_id = ?", confirmed, id, context.patientId);

  if (statements.length) await env.DB.batch(statements);
}

function safeRemoteUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLocaleLowerCase("en-US");
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;
    if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return null;
    const private172 = host.match(/^172\.(\d{1,3})\./);
    if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return null;
    return url;
  } catch {
    return null;
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
  if (declared.startsWith("application/json") || extension === "json") return "application/json";
  if (declared.startsWith("text/csv") || extension === "csv") return "text/csv";
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
