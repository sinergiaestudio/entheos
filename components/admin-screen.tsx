"use client";

import { useEffect, useState, type FormEvent } from "react";
import { EmptyState } from "./dashboard-screen";
import { Icon } from "./icons";
import { BrandMark } from "./brand-mark";
import { formatDate } from "./health-types";

type AdminUser = {
  id: string; email: string; display_name: string; status: string; last_login_at: string | null;
  created_at: string; patient_id: string | null; documents_count: number; laboratory_count: number;
  observations_count: number; records_count: number;
};
type AdminData = {
  stats: { users: number; activeUsers: number; documents: number; records: number };
  users: AdminUser[];
  audits: { id: string; action: string; entity_type: string; outcome: string; occurred_at: string; display_name: string | null; email: string | null }[];
  policies: { title: string; value: string; detail: string }[];
  providers: {
    provider: string; name: string; status: "configured" | "not_configured";
    clientIdHint: string | null; source: "environment" | "database" | null;
    configuredAt: string | null; scopes: string[];
  }[];
  launch: {
    intervalsConnections: number;
    activeIntervalsConnections: number;
    lastIntervalsSync: string | null;
  };
};

export function AdminScreen({ notify }: { notify: (message: string) => void }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProvider, setSavingProvider] = useState(false);
  const [section, setSection] = useState<"users" | "integrations" | "policy" | "activity">("users");

  async function load() {
    setLoading(true);
    const response = await fetch("/api/admin/overview", { cache: "no-store" });
    if (response.ok) setData(await response.json() as AdminData);
    else notify("No pudimos cargar la consola global.");
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/admin/overview", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<AdminData> : null)
      .then((result) => { if (active && result) setData(result); })
      .catch(() => { if (active) notify("No pudimos cargar la consola global."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [notify]);

  async function setStatus(user: AdminUser, status: "active" | "suspended") {
    const verb = status === "active" ? "reactivar" : "suspender";
    if (!window.confirm(`¿Querés ${verb} el acceso de ${user.display_name}? La información no se eliminará.`)) return;
    const response = await fetch("/api/admin/overview", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: user.id, status }) });
    const result = await response.json() as { error?: string };
    notify(response.ok ? `Acceso ${status === "active" ? "reactivado" : "suspendido"}.` : result.error || "No pudimos cambiar el acceso.");
    if (response.ok) await load();
  }

  async function saveProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const clientId = String(values.get("clientId") || "").trim();
    const clientSecret = String(values.get("clientSecret") || "").trim();
    if (!clientId || !clientSecret) {
      notify("Completá el Client ID y el secreto de Intervals.icu.");
      return;
    }
    setSavingProvider(true);
    const response = await fetch("/api/admin/provider-configurations", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "intervals_icu", clientId, clientSecret }),
    });
    const result = await response.json() as { error?: string };
    if (response.ok) {
      form.reset();
      notify("Intervals.icu quedó configurado de forma cifrada.");
      await load();
    } else {
      notify(result.error || "No pudimos guardar la integración.");
    }
    setSavingProvider(false);
  }

  if (loading && !data) return <div className="loading-screen"><BrandMark pulse /><strong>Cargando administración…</strong></div>;
  if (!data) return <EmptyState icon="shield" title="Consola no disponible" text="Esta sección está reservada al administrador global." />;

  return <div className="screen-stack admin-screen">
    <section className="screen-intro"><p className="eyebrow">ADMINISTRACIÓN GLOBAL</p><h1>Personas, integraciones y políticas</h1><p>Gestión de accesos y salud operativa del sistema. Los datos clínicos de cada persona permanecen en su espacio.</p></section>
    <section className="admin-stats">
      <article><Icon name="heart" /><span>Usuarios</span><strong>{data.stats.users}</strong><small>{data.stats.activeUsers} activos</small></article>
      <article><Icon name="timeline" /><span>Registros</span><strong>{data.stats.records.toLocaleString("es-AR")}</strong><small>estructurados y dispositivos</small></article>
      <article><Icon name="document" /><span>Documentos</span><strong>{data.stats.documents}</strong><small>originales privados</small></article>
      <article><Icon name="shield" /><span>Autenticación</span><strong>ChatGPT</strong><small>obligatoria</small></article>
    </section>
    <nav className="segmented-nav" aria-label="Áreas de administración">
      <button className={section === "users" ? "active" : ""} onClick={() => setSection("users")}>Usuarios</button>
      <button className={section === "integrations" ? "active" : ""} onClick={() => setSection("integrations")}>Integraciones</button>
      <button className={section === "policy" ? "active" : ""} onClick={() => setSection("policy")}>Política global</button>
      <button className={section === "activity" ? "active" : ""} onClick={() => setSection("activity")}>Actividad y accesos</button>
    </nav>
    {section === "users" && <section className="surface data-surface"><div className="section-heading"><div><p className="eyebrow">CUENTAS RECONOCIDAS</p><h2>{data.users.length} usuario{data.users.length === 1 ? "" : "s"}</h2></div><span className="source-chip"><i /> Sin datos clínicos visibles</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Persona</th><th>Estado</th><th>Último acceso</th><th>Registros</th><th>Documentos</th><th>Gestión</th></tr></thead><tbody>{data.users.map((user) => <tr key={user.id}><td><strong>{user.display_name}</strong><small>{user.email}</small></td><td><span className={`status-pill ${user.status}`}>{user.status === "active" ? "Activo" : "Suspendido"}</span></td><td>{formatDate(user.last_login_at || user.created_at, true)}</td><td>{(Number(user.records_count) + Number(user.laboratory_count) + Number(user.observations_count)).toLocaleString("es-AR")}<small>{Number(user.observations_count).toLocaleString("es-AR")} de dispositivos</small></td><td>{Number(user.documents_count)}</td><td>{user.status === "active" ? <button className="table-action danger" onClick={() => void setStatus(user, "suspended")}>Suspender</button> : <button className="table-action" onClick={() => void setStatus(user, "active")}>Reactivar</button>}</td></tr>)}</tbody></table></div></section>}
    {section === "integrations" && <ProviderConfiguration
      provider={data.providers.find((item) => item.provider === "intervals_icu") || null}
      launch={data.launch}
      saving={savingProvider}
      onSave={saveProvider}
    />}
    {section === "policy" && <section className="policy-grid">{data.policies.map((policy) => <article className="surface" key={policy.title}><span>{policy.title}</span><strong>{policy.value}</strong><p>{policy.detail}</p></article>)}</section>}
    {section === "activity" && <section className="surface data-surface"><div className="section-heading"><div><p className="eyebrow">TRAZABILIDAD GLOBAL</p><h2>Actividad reciente</h2></div><span className="source-chip"><i /> Sin contenido clínico</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Fecha</th><th>Persona</th><th>Acción</th><th>Entidad</th><th>Resultado</th></tr></thead><tbody>{data.audits.map((entry) => <tr key={entry.id}><td>{formatDate(entry.occurred_at, true)}</td><td><strong>{entry.display_name || "Sistema"}</strong><small>{entry.email || "—"}</small></td><td>{adminActionLabel(entry.action)}</td><td>{entry.entity_type.replaceAll("_", " ")}</td><td><span className={`status-pill ${entry.outcome === "success" ? "active" : "suspended"}`}>{entry.outcome === "success" ? "Correcto" : "Error"}</span></td></tr>)}</tbody></table></div></section>}
  </div>;
}

function adminActionLabel(value: string) {
  return ({ create: "Creación", update: "Actualización", upload: "Carga", import: "Importación", view: "Visualización", download: "Descarga", export: "Exportación", restore: "Restauración", revoke: "Revocación", migrate: "Migración", admin_update: "Gestión de acceso", create_series: "Serie creada", provider_configured: "Integración configurada", provider_configuration_failed: "Configuración fallida" } as Record<string, string>)[value] || value;
}

function ProviderConfiguration({
  provider,
  launch,
  saving,
  onSave,
}: {
  provider: AdminData["providers"][number] | null;
  launch: AdminData["launch"];
  saving: boolean;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const configured = provider?.status === "configured";
  const firstAccountReady = launch.activeIntervalsConnections > 0;
  const firstSyncReady = Boolean(launch.lastIntervalsSync);
  return <div className="admin-provider-grid">
    <section className="surface provider-config-card">
      <div className="section-heading">
        <div><p className="eyebrow">PROVEEDOR DE ACTIVIDAD Y BIENESTAR</p><h2>Intervals.icu</h2></div>
        <span className={`status-pill ${configured ? "active" : "suspended"}`}>{configured ? "Configurado" : "Pendiente"}</span>
      </div>
      <p className="provider-description">Entheos solicitará únicamente lectura de actividades y bienestar. Cada persona autoriza su propia cuenta y puede revocarla cuando quiera.</p>
      <div className="provider-config-status">
        <div><span>OAuth Client ID</span><strong>{provider?.clientIdHint || "785"}</strong></div>
        <div><span>Permisos</span><strong>ACTIVITY:READ · WELLNESS:READ</strong></div>
        <div><span>Secreto</span><strong>{configured ? "Cifrado y protegido" : "Todavía no guardado"}</strong></div>
      </div>
      <form className="provider-config-form" onSubmit={onSave} autoComplete="off">
        <label>OAuth Client ID<input name="clientId" defaultValue="785" inputMode="numeric" required maxLength={200} /></label>
        <label>Client secret<input name="clientSecret" type="password" required minLength={12} maxLength={500} autoComplete="new-password" placeholder={configured ? "Ingresá uno nuevo para reemplazarlo" : "Pegalo desde View secret"} /></label>
        <button className="primary-action" type="submit" disabled={saving}><Icon name="shield" size={18} />{saving ? "Cifrando…" : configured ? "Reemplazar configuración" : "Guardar configuración cifrada"}</button>
      </form>
      <div className="provider-security-note"><Icon name="shield" size={18} /><p><strong>El secreto no vuelve al navegador.</strong> Se cifra antes de guardarse y nunca aparece en tablas, respaldos ni registros de actividad.</p></div>
    </section>
    <section className="surface provider-checklist-card">
      <p className="eyebrow">AJUSTES REQUERIDOS EN INTERVALS.ICU</p>
      <h2>Corregí los datos de ejemplo</h2>
      <p>La captura muestra valores temporales. Reemplazalos en la administración del cliente 785.</p>
      <dl className="provider-values">
        <div><dt>Nombre</dt><dd>Entheos</dd></div>
        <div><dt>Descripción</dt><dd>Personal health history app with read-only activity and wellness imports authorized by each user.</dd></div>
        <div><dt>Sitio web</dt><dd>https://seguimiento-nutricional-marcelo.arielmarcelogomez7.chatgpt.site</dd></div>
        <div><dt>Privacidad</dt><dd>https://seguimiento-nutricional-marcelo.arielmarcelogomez7.chatgpt.site/privacy</dd></div>
        <div><dt>Redirect URL</dt><dd>https://seguimiento-nutricional-marcelo.arielmarcelogomez7.chatgpt.site/api/health/connectors/intervals/callback</dd></div>
        <div><dt>Logotipo</dt><dd>https://seguimiento-nutricional-marcelo.arielmarcelogomez7.chatgpt.site/app/icon-192.png</dd></div>
      </dl>
      <a className="secondary-action" href="https://intervals.icu/oauth/client/785" target="_blank" rel="noreferrer"><Icon name="activity" size={18} /> Abrir cliente 785</a>
    </section>
    <section className="surface launch-readiness-card">
      <div className="section-heading"><div><p className="eyebrow">SALIDA PÚBLICA</p><h2>Camino al catálogo de Intervals.icu</h2></div><span className={`status-pill ${firstSyncReady ? "active" : "pending"}`}>{firstSyncReady ? "Validación técnica lista" : "En preparación"}</span></div>
      <ol className="launch-readiness-list">
        <LaunchStep complete title="Marca y sitio público" detail="Logo, landing, privacidad y enlaces oficiales publicados." />
        <LaunchStep complete title="Aplicación OAuth registrada" detail="Cliente 785 creado con permisos de sólo lectura." />
        <LaunchStep complete={configured} title="Secreto protegido en Entheos" detail={configured ? "La credencial global está cifrada y no vuelve al navegador." : "Pegá View secret en el formulario de esta pantalla."} />
        <LaunchStep complete={firstAccountReady} title="Primera cuenta vinculada" detail={firstAccountReady ? `${launch.activeIntervalsConnections} conexión${launch.activeIntervalsConnections === 1 ? "" : "es"} activa${launch.activeIntervalsConnections === 1 ? "" : "s"}.` : "Vinculá una cuenta desde Más → Integraciones."} />
        <LaunchStep complete={firstSyncReady} title="Primera sincronización comprobada" detail={firstSyncReady ? `Última prueba correcta: ${formatDate(launch.lastIntervalsSync, true)}.` : "Debe recibirse al menos una actualización real sin errores."} />
        <LaunchStep complete={false} title="Visibilidad en el directorio" detail={firstSyncReady ? "Ya se puede solicitar a David que quite el estado oculto de Entheos." : "Se solicita después de validar la primera sincronización."} />
      </ol>
    </section>
  </div>;
}

function LaunchStep({ complete, title, detail }: { complete: boolean; title: string; detail: string }) {
  return <li className={complete ? "complete" : "pending"}><b>{complete ? "✓" : "·"}</b><span><strong>{title}</strong><small>{detail}</small></span></li>;
}
