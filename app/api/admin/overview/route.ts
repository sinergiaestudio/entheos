import { authorizeClinicalRequest, cleanText, jsonResponse, sameOrigin, unauthorizedResponse, writeAudit } from "@/db/clinical";
import { getProviderConfigurationSummary } from "@/db/provider-config";
import { env } from "cloudflare:workers";

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  status: string;
  last_login_at: string | null;
  created_at: string;
  patient_id: string | null;
  documents_count: number;
  laboratory_count: number;
  observations_count: number;
  records_count: number;
};

type IntegrationLaunchRow = {
  connections: number;
  active_connections: number;
  last_successful_sync: string | null;
};

async function adminContext(request: Request) {
  const context = await authorizeClinicalRequest(request, ["health.read"]);
  return context?.isGlobalAdmin ? context : null;
}

export async function GET(request: Request) {
  const context = await adminContext(request);
  if (!context) return unauthorizedResponse("admin.read", request);

  const [users, audits, intervalsConfiguration, intervalsLaunch] = await Promise.all([
    env.DB.prepare(`SELECT u.id, u.email, u.display_name, u.status, u.last_login_at, u.created_at,
      p.id AS patient_id,
      (SELECT COUNT(*) FROM document_references d WHERE d.patient_id = p.id AND d.deleted_at IS NULL) AS documents_count,
      (SELECT COUNT(*) FROM lab_results l WHERE l.patient_id = p.id AND l.deleted_at IS NULL) AS laboratory_count,
      (SELECT COUNT(*) FROM observations o WHERE o.patient_id = p.id AND o.deleted_at IS NULL) AS observations_count,
      ((SELECT COUNT(*) FROM weight_entries w WHERE w.patient_id = p.id AND w.deleted_at IS NULL) +
       (SELECT COUNT(*) FROM blood_pressure_readings b WHERE b.patient_id = p.id AND b.deleted_at IS NULL) +
       (SELECT COUNT(*) FROM activity_sessions a WHERE a.patient_id = p.id AND a.deleted_at IS NULL) +
       (SELECT COUNT(*) FROM sleep_entries s WHERE s.patient_id = p.id AND s.deleted_at IS NULL) +
       (SELECT COUNT(*) FROM symptom_entries y WHERE y.patient_id = p.id AND y.deleted_at IS NULL) +
       (SELECT COUNT(*) FROM clinical_facts f WHERE f.patient_id = p.id AND f.deleted_at IS NULL)) AS records_count
      FROM users u
      LEFT JOIN patient_profiles p ON p.owner_user_id = u.id AND p.deleted_at IS NULL
      ORDER BY COALESCE(u.last_login_at, u.created_at) DESC`).all<UserRow>(),
    env.DB.prepare(`SELECT a.id, a.action, a.entity_type, a.outcome, a.occurred_at,
      u.display_name, u.email
      FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.occurred_at DESC LIMIT 120`).all<Record<string, unknown>>(),
    getProviderConfigurationSummary("intervals_icu"),
    env.DB.prepare(`SELECT
      COUNT(*) AS connections,
      SUM(CASE WHEN status IN ('active', 'degraded') AND revoked_at IS NULL THEN 1 ELSE 0 END) AS active_connections,
      MAX(last_success_at) AS last_successful_sync
      FROM integration_connections WHERE provider = 'intervals_icu'`)
      .first<IntegrationLaunchRow>(),
  ]);

  const userRows = users.results;
  return jsonResponse({
    stats: {
      users: userRows.length,
      activeUsers: userRows.filter((user) => user.status === "active").length,
      documents: userRows.reduce((sum, user) => sum + Number(user.documents_count || 0), 0),
      records: userRows.reduce((sum, user) => sum + Number(user.records_count || 0) + Number(user.laboratory_count || 0) + Number(user.observations_count || 0), 0),
    },
    users: userRows,
    audits: audits.results,
    providers: [intervalsConfiguration],
    launch: {
      intervalsConnections: Number(intervalsLaunch?.connections || 0),
      activeIntervalsConnections: Number(intervalsLaunch?.active_connections || 0),
      lastIntervalsSync: intervalsLaunch?.last_successful_sync || null,
    },
    policies: [
      { title: "Identidad", value: "ChatGPT obligatorio", detail: "No existe registro ni contraseña propios de Entheos." },
      { title: "Aislamiento", value: "Un espacio por cuenta", detail: "Toda consulta clínica se filtra en servidor por paciente y organización." },
      { title: "Documentos", value: "Almacenamiento privado", detail: "Los originales no son públicos y se entregan sólo a la persona autenticada." },
      { title: "Bajas", value: "Suspensión reversible", detail: "El administrador puede interrumpir accesos sin destruir la historia." },
      { title: "Trazabilidad", value: "Auditoría global", detail: "Se registra la acción y su resultado sin copiar el contenido clínico al log." },
      { title: "IA", value: "Desactivada", detail: "No se generan ni aplican propuestas clínicas automáticas en esta etapa." },
    ],
    generatedAt: new Date().toISOString(),
  });
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return jsonResponse({ error: "Solicitud no permitida." }, { status: 403 });
  const context = await adminContext(request);
  if (!context) return unauthorizedResponse("admin.write", request);
  const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
  const userId = cleanText(payload.userId, 80);
  const status = cleanText(payload.status, 20);
  if (!userId || !["active", "suspended"].includes(status)) return jsonResponse({ error: "Cambio no válido." }, { status: 400 });
  if (userId === context.userId && status !== "active") return jsonResponse({ error: "No podés suspender tu propia cuenta administradora." }, { status: 409 });

  const target = await env.DB.prepare("SELECT id, status FROM users WHERE id = ?").bind(userId).first<{ id: string; status: string }>();
  if (!target) return jsonResponse({ error: "Usuario no encontrado." }, { status: 404 });
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET status = ?, updated_at = ? WHERE id = ?").bind(status, now, userId),
    env.DB.prepare("UPDATE memberships SET status = ?, updated_at = ? WHERE user_id = ?").bind(status === "active" ? "active" : "suspended", now, userId),
  ]);
  await writeAudit(context, "admin_update", "user_access", userId, { status });
  return jsonResponse({ ok: true, userId, status });
}
