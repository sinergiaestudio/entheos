import { env } from "cloudflare:workers";
import { authorizeClinicalRequest, jsonResponse, unauthorizedResponse, writeAudit } from "@/db/clinical";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await authorizeClinicalRequest(request, ["documents.read"]);
  if (!context) return unauthorizedResponse("documents.read");
  if (!env.BUCKET) return jsonResponse({ error: "El archivo privado no está disponible." }, { status: 503 });
  const { id } = await params;
  const document = await env.DB.prepare(`SELECT id, r2_key, original_name, mime_type, size_bytes
    FROM document_references WHERE id = ? AND patient_id = ? AND organization_id = ?
    AND deleted_at IS NULL`)
    .bind(id, context.patientId, context.organizationId)
    .first<{ id: string; r2_key: string; original_name: string; mime_type: string; size_bytes: number }>();
  if (!document) return jsonResponse({ error: "Documento no encontrado." }, { status: 404 });
  const object = await env.BUCKET.get(document.r2_key);
  if (!object) return jsonResponse({ error: "El archivo original no está disponible." }, { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  const safeName = document.original_name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._ -]/g, "_").slice(0, 150) || "documento";
  const headers = new Headers();
  headers.set("content-type", document.mime_type);
  headers.set("content-length", String(document.size_bytes));
  headers.set("content-disposition", `${download ? "attachment" : "inline"}; filename="${safeName}"`);
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-security-policy", "sandbox; default-src 'none'; img-src 'self' data: blob:; style-src 'unsafe-inline'");
  void writeAudit(context, download ? "download" : "view", "document_reference", id, { source: "patient" });
  return new Response(object.body, { headers });
}
