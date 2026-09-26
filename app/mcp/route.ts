import { authorizeClinicalRequest, jsonResponse, type ClinicalContext, unauthorizedResponse } from "@/db/clinical";
import { syncConversationUpdate } from "@/db/conversation-sync";
import { fetchClinical, getOverview, getPatientSummary, searchClinical } from "@/db/health-data";

const protocolVersion = "2025-11-25";
const allScopes = ["health.read", "documents.read", "documents.write", "observations.write", "profile.write"];

export async function POST(request: Request) {
  const context = await authorizeClinicalRequest(request, []);
  if (!context) return unauthorizedResponse(allScopes.join(" "), request);
  let message: { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
  try {
    message = await request.json();
  } catch {
    return rpcError(null, -32700, "Invalid JSON");
  }
  if (message.jsonrpc !== "2.0" || !message.method) return rpcError(message.id ?? null, -32600, "Invalid Request");
  if (message.method === "notifications/initialized") return new Response(null, { status: 202 });
  if (message.method === "initialize") {
    return rpcResult(message.id ?? null, {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "entheos-salud-personal", version: "0.3.0" },
      instructions: [
        "Entheos conserva procedencia, fecha clínica y estado de validación.",
        "Cuando el usuario diga expresamente Enviar, Subir, Guardar, Actualizar, Sincronizar o Cargar en Entheos, esa instrucción equivale a su aprobación para guardar de inmediato los datos clínicos confirmados y los archivos adjuntos, sin una segunda revisión dentro de Entheos.",
        "Use send_to_entheos sólo con datos declarados por el usuario o documentados en archivos; no convierta hipótesis, diagnósticos tentativos del modelo ni consejos generales en hechos clínicos.",
        "Antes de guardar una conversación extensa, consulte get_changes_since o search para evitar duplicados. Después de guardar, verifique el resultado con get_changes_since.",
      ].join(" "),
    });
  }
  if (message.method === "tools/list") return rpcResult(message.id ?? null, { tools: toolDescriptors() });
  if (message.method === "tools/call") {
    const name = String(message.params?.name || "");
    const args = (message.params?.arguments || {}) as Record<string, unknown>;
    const origin = new URL(request.url).origin;
    try {
      if (name === "search") {
        requireScopes(context, ["health.read"]);
        const results = await searchClinical(context, args.query, origin);
        return rpcResult(message.id ?? null, textResult({ results }));
      }
      if (name === "fetch") {
        requireScopes(context, ["health.read"]);
        const item = await fetchClinical(context, args.id, origin);
        if (!item) return rpcResult(message.id ?? null, errorResult("No encontrado"));
        return rpcResult(message.id ?? null, textResult(item));
      }
      if (name === "get_patient_summary") {
        requireScopes(context, ["health.read"]);
        return rpcResult(message.id ?? null, textResult(await getPatientSummary(context)));
      }
      if (name === "get_latest_measurements") {
        requireScopes(context, ["health.read"]);
        const overview = await getOverview(context);
        return rpcResult(message.id ?? null, textResult({
          weight: overview.weights[0] || null,
          bloodPressure: overview.pressures[0] || null,
          generatedAt: overview.generatedAt,
        }));
      }
      if (name === "get_changes_since") {
        requireScopes(context, ["health.read"]);
        const cursor = Number.isFinite(Date.parse(String(args.cursor || ""))) ? Date.parse(String(args.cursor)) : 0;
        const overview = await getOverview(context);
        return rpcResult(message.id ?? null, textResult({
          history: overview.history.filter((item) => Date.parse(String(item.recorded_at)) > cursor),
          documents: overview.documents.filter((item) => Date.parse(String(item.created_at)) > cursor),
          nextCursor: overview.generatedAt,
        }));
      }
      if (name === "get_health_history") {
        requireScopes(context, ["health.read"]);
        const overview = await getOverview(context);
        const since = Number.isFinite(Date.parse(String(args.since || ""))) ? Date.parse(String(args.since)) : 0;
        const until = Number.isFinite(Date.parse(String(args.until || ""))) ? Date.parse(String(args.until)) : Number.POSITIVE_INFINITY;
        const category = String(args.category || "all");
        const limit = Math.min(500, Math.max(1, Number(args.limit) || 200));
        const history = overview.history.filter((item) => {
          const time = Date.parse(String(item.effective_at));
          return time >= since && time <= until && (category === "all" || item.category === category);
        }).slice(0, limit);
        return rpcResult(message.id ?? null, textResult({ history, returned: history.length, totalAvailable: overview.history.length, generatedAt: overview.generatedAt }));
      }
      if (name === "get_documents_and_studies") {
        requireScopes(context, ["health.read", "documents.read"]);
        const overview = await getOverview(context);
        return rpcResult(message.id ?? null, textResult({ documents: overview.documents, laboratory: overview.laboratory, generatedAt: overview.generatedAt }));
      }
      if (name === "send_to_entheos") {
        requireScopes(context, ["observations.write", "documents.write"]);
        const result = await syncConversationUpdate(context, args);
        return rpcResult(message.id ?? null, textResult(result));
      }
      return rpcError(message.id ?? null, -32602, "Unknown tool");
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "No se pudo completar la operación.";
      return rpcResult(message.id ?? null, errorResult(messageText));
    }
  }
  return rpcError(message.id ?? null, -32601, "Method not found");
}

export async function GET(request: Request) {
  return jsonResponse({
    name: "Entheos MCP",
    transport: "streamable-http",
    authentication: "OAuth 2.1 / Bearer",
    protectedResource: new URL("/.well-known/oauth-protected-resource", request.url).toString(),
    status: "ready",
    capabilities: ["read", "write", "file-upload"],
  });
}

function requireScopes(context: ClinicalContext, scopes: string[]) {
  const missing = scopes.filter((scope) => !context.scopes.includes(scope));
  if (missing.length) throw new Error(`La conexión de Entheos no tiene los permisos requeridos: ${missing.join(", ")}.`);
}

function textResult(value: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true };
}

function rpcResult(id: string | number | null, result: unknown) {
  return jsonResponse({ jsonrpc: "2.0", id, result }, { headers: { "mcp-protocol-version": protocolVersion } });
}

function rpcError(id: string | number | null, code: number, message: string) {
  return jsonResponse({ jsonrpc: "2.0", id, error: { code, message } }, { status: 400 });
}

function toolDescriptors() {
  const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true };
  const writeSafe = { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true };
  const readSecurity = [{ type: "oauth2", scopes: ["health.read"] }];
  const documentReadSecurity = [{ type: "oauth2", scopes: ["health.read", "documents.read"] }];
  const writeSecurity = [{ type: "oauth2", scopes: ["observations.write", "documents.write"] }];
  const openAIFile = {
    type: "object",
    properties: {
      download_url: { type: "string" },
      file_id: { type: "string" },
      mime_type: { type: "string" },
      file_name: { type: "string" },
    },
    required: ["download_url", "file_id"],
    additionalProperties: false,
  };
  return [
    {
      name: "search",
      title: "Buscar en la historia clínica",
      description: "Use this when you need to find timeline events or private document references that match a query.",
      inputSchema: { type: "object", properties: { query: { type: "string", minLength: 1, maxLength: 160 } }, required: ["query"], additionalProperties: false },
      securitySchemes: readSecurity,
      annotations: readOnly,
      _meta: { securitySchemes: readSecurity },
    },
    {
      name: "fetch",
      title: "Abrir un elemento clínico",
      description: "Use this when you need the complete authorized details for an item returned by search.",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false },
      securitySchemes: readSecurity,
      annotations: readOnly,
      _meta: { securitySchemes: readSecurity },
    },
    {
      name: "get_patient_summary",
      title: "Obtener resumen clínico",
      description: "Use this when you need a concise current summary with provenance and validation status.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      securitySchemes: readSecurity,
      annotations: readOnly,
      _meta: { securitySchemes: readSecurity, "openai/profile": true },
    },
    {
      name: "get_latest_measurements",
      title: "Obtener últimas mediciones",
      description: "Use this when you need the latest weight and blood-pressure readings with dates and sources.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      securitySchemes: readSecurity,
      annotations: readOnly,
      _meta: { securitySchemes: readSecurity },
    },
    {
      name: "get_changes_since",
      title: "Obtener cambios desde una fecha",
      description: "Use this before and after a synchronization to avoid duplicates and verify what Entheos saved.",
      inputSchema: { type: "object", properties: { cursor: { type: "string", format: "date-time" } }, required: ["cursor"], additionalProperties: false },
      securitySchemes: readSecurity,
      annotations: readOnly,
      _meta: { securitySchemes: readSecurity },
    },
    {
      name: "get_health_history",
      title: "Obtener historia clínica completa",
      description: "Use this when you need the chronological health history across measurements, symptoms, clinical facts, documents, studies and nutrition.",
      inputSchema: { type: "object", properties: { since: { type: "string", format: "date-time" }, until: { type: "string", format: "date-time" }, category: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 500 } }, additionalProperties: false },
      securitySchemes: readSecurity,
      annotations: readOnly,
      _meta: { securitySchemes: readSecurity },
    },
    {
      name: "get_documents_and_studies",
      title: "Obtener documentos y estudios",
      description: "Use this when you need the private document catalog and every structured laboratory panel and result.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      securitySchemes: documentReadSecurity,
      annotations: readOnly,
      _meta: { securitySchemes: documentReadSecurity },
    },
    {
      name: "send_to_entheos",
      title: "Enviar información clínica a Entheos",
      description: "Use this only after the user explicitly asks to send, upload, save, update, synchronize or load information into Entheos. That explicit request is the user's approval: save the confirmed structured records and original attached files immediately, without creating an additional review step. Preserve dates and provenance, avoid duplicates, and never save model speculation as a clinical fact.",
      inputSchema: {
        type: "object",
        $defs: {
          OpenAIFile: openAIFile,
          Record: {
            type: "object",
            properties: {
              kind: {
                type: "string",
                enum: ["weight", "blood_pressure", "activity", "sleep", "symptom", "clinical_fact", "timeline", "nutrition_day", "lab_result", "profile"],
              },
              payload: { type: "object", additionalProperties: true },
            },
            required: ["kind", "payload"],
            additionalProperties: false,
          },
          Document: {
            type: "object",
            properties: {
              file_id: { type: "string" },
              title: { type: "string", maxLength: 200 },
              document_type: { type: "string", maxLength: 60 },
              study_date: { type: "string", format: "date" },
              institution: { type: "string", maxLength: 180 },
              professional: { type: "string", maxLength: 180 },
              specialty: { type: "string", maxLength: 120 },
              description: { type: "string", maxLength: 1500 },
              tags: { type: "array", items: { type: "string", maxLength: 50 }, maxItems: 20 },
            },
            required: ["file_id", "title", "document_type"],
            additionalProperties: false,
          },
        },
        properties: {
          idempotency_key: { type: "string", minLength: 8, maxLength: 100 },
          approval: { type: "string", description: "Exact or faithful quotation of the user's explicit request to save in Entheos." },
          source_reference: { type: "string", maxLength: 500 },
          summary: { type: "string", maxLength: 4000 },
          records: { type: "array", items: { $ref: "#/$defs/Record" }, maxItems: 100 },
          files: { type: "array", items: { $ref: "#/$defs/OpenAIFile" }, maxItems: 20 },
          documents: { type: "array", items: { $ref: "#/$defs/Document" }, maxItems: 20 },
        },
        required: ["idempotency_key", "approval", "source_reference", "summary", "records", "files", "documents"],
        additionalProperties: false,
      },
      securitySchemes: writeSecurity,
      annotations: writeSafe,
      _meta: {
        securitySchemes: writeSecurity,
        "openai/fileParams": ["files"],
        "openai/toolInvocation/invoking": "Guardando en Entheos…",
        "openai/toolInvocation/invoked": "Entheos actualizado",
      },
    },
  ];
}
