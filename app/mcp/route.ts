import { authorizeClinicalRequest, jsonResponse, unauthorizedResponse } from "@/db/clinical";
import { fetchClinical, getOverview, getPatientSummary, searchClinical } from "@/db/health-data";

const protocolVersion = "2025-11-25";

export async function POST(request: Request) {
  const context = await authorizeClinicalRequest(request, ["health.read"]);
  if (!context) return unauthorizedResponse("health.read documents.read", request);
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
      serverInfo: { name: "entheos-salud-personal", version: "0.2.0" },
      instructions: "Servidor privado de lectura. Conserva fuentes y estados de validación; las propuestas de IA no son datos clínicos confirmados.",
    });
  }
  if (message.method === "tools/list") return rpcResult(message.id ?? null, { tools: toolDescriptors() });
  if (message.method === "tools/call") {
    const name = String(message.params?.name || "");
    const args = (message.params?.arguments || {}) as Record<string, unknown>;
    const origin = new URL(request.url).origin;
    try {
      if (name === "search") {
        const results = await searchClinical(context, args.query, origin);
        return rpcResult(message.id ?? null, textResult({ results }));
      }
      if (name === "fetch") {
        const item = await fetchClinical(context, args.id, origin);
        if (!item) return rpcResult(message.id ?? null, { content: [{ type: "text", text: JSON.stringify({ error: "No encontrado" }) }], isError: true });
        return rpcResult(message.id ?? null, textResult(item));
      }
      if (name === "get_patient_summary") return rpcResult(message.id ?? null, textResult(await getPatientSummary(context)));
      if (name === "get_latest_measurements") {
        const overview = await getOverview(context);
        return rpcResult(message.id ?? null, textResult({
          weight: overview.weights[0] || null,
          bloodPressure: overview.pressures[0] || null,
          generatedAt: overview.generatedAt,
        }));
      }
      if (name === "get_changes_since") {
        const cursor = Number.isFinite(Date.parse(String(args.cursor || ""))) ? Date.parse(String(args.cursor)) : 0;
        const overview = await getOverview(context);
        return rpcResult(message.id ?? null, textResult({
          history: overview.history.filter((item) => Date.parse(String(item.recorded_at)) > cursor),
          documents: overview.documents.filter((item) => Date.parse(String(item.created_at)) > cursor),
          nextCursor: overview.generatedAt,
        }));
      }
      if (name === "get_health_history") {
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
        const overview = await getOverview(context);
        return rpcResult(message.id ?? null, textResult({ documents: overview.documents, laboratory: overview.laboratory, generatedAt: overview.generatedAt }));
      }
      return rpcError(message.id ?? null, -32602, "Unknown tool");
    } catch {
      return rpcResult(message.id ?? null, { content: [{ type: "text", text: "No se pudo completar la consulta." }], isError: true });
    }
  }
  return rpcError(message.id ?? null, -32601, "Method not found");
}

export async function GET(request: Request) {
  return jsonResponse({ name: "Entheos MCP", transport: "streamable-http", authentication: "OAuth 2.1 / Bearer", protectedResource: new URL("/.well-known/oauth-protected-resource", request.url).toString(), status: "ready" });
}

function textResult(value: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

function rpcResult(id: string | number | null, result: unknown) {
  return jsonResponse({ jsonrpc: "2.0", id, result }, { headers: { "mcp-protocol-version": protocolVersion } });
}

function rpcError(id: string | number | null, code: number, message: string) {
  return jsonResponse({ jsonrpc: "2.0", id, error: { code, message } }, { status: 400 });
}

function toolDescriptors() {
  const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true };
  return [
    {
      name: "search",
      title: "Buscar en la historia clínica",
      description: "Use this when you need to find timeline events or private document references that match a query.",
      inputSchema: { type: "object", properties: { query: { type: "string", minLength: 1, maxLength: 160 } }, required: ["query"], additionalProperties: false },
      annotations: readOnly,
    },
    {
      name: "fetch",
      title: "Abrir un elemento clínico",
      description: "Use this when you need the complete authorized details for an item returned by search.",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false },
      annotations: readOnly,
    },
    {
      name: "get_patient_summary",
      title: "Obtener resumen clínico",
      description: "Use this when you need a concise current summary with provenance and validation status.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: readOnly,
    },
    {
      name: "get_latest_measurements",
      title: "Obtener últimas mediciones",
      description: "Use this when you need the latest weight and blood-pressure readings with dates and sources.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: readOnly,
    },
    {
      name: "get_changes_since",
      title: "Obtener cambios desde una fecha",
      description: "Use this when you need incremental timeline and document changes after an ISO timestamp.",
      inputSchema: { type: "object", properties: { cursor: { type: "string", format: "date-time" } }, required: ["cursor"], additionalProperties: false },
      annotations: readOnly,
    },
    {
      name: "get_health_history",
      title: "Obtener historia clínica completa",
      description: "Use this when you need the chronological health history across measurements, symptoms, clinical facts, documents, studies and nutrition.",
      inputSchema: { type: "object", properties: { since: { type: "string", format: "date-time" }, until: { type: "string", format: "date-time" }, category: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 500 } }, additionalProperties: false },
      annotations: readOnly,
    },
    {
      name: "get_documents_and_studies",
      title: "Obtener documentos y estudios",
      description: "Use this when you need the private document catalog and every structured laboratory panel and result.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: readOnly,
    },
  ];
}
