/* eslint-disable @next/next/no-html-link-for-pages -- the backup endpoint is an intentional file download */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { EmptyState } from "./dashboard-screen";
import { Icon } from "./icons";
import { BrandMark } from "./brand-mark";
import type { ClinicalFact, LabResult, Overview, SaveRecord } from "./health-types";
import { formatDate, localDate, sourceLabel } from "./health-types";

export type MoreView = "profile" | "laboratory" | "reports" | "integrations";

const views: { id: MoreView; label: string; icon: string }[] = [
  { id: "profile", label: "Perfil clínico", icon: "heart" },
  { id: "laboratory", label: "Laboratorio", icon: "spark" },
  { id: "reports", label: "Informes y respaldo", icon: "document" },
  { id: "integrations", label: "Integraciones", icon: "settings" },
];

export function MoreScreen({ data, saveRecord, onChanged, notify, initialView }: { data: Overview; saveRecord: SaveRecord; onChanged: () => Promise<void>; notify: (message: string) => void; initialView?: MoreView }) {
  const [view, setView] = useState<MoreView>(initialView || "profile");
  return <div className="screen-stack"><section className="screen-intro"><p className="eyebrow">MÁS HERRAMIENTAS</p><h1>Historia clínica y control</h1><p>Perfil, antecedentes, laboratorios, informes e integraciones personales.</p></section><div className="more-layout"><nav className="more-nav" aria-label="Secciones adicionales">{views.map((item) => <button type="button" key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><Icon name={item.icon} size={20} /><span>{item.label}</span></button>)}</nav><section className="more-content surface">{view === "profile" && <ProfilePanel data={data} saveRecord={saveRecord} onChanged={onChanged} notify={notify} />}{view === "laboratory" && <LaboratoryPanel data={data} saveRecord={saveRecord} onChanged={onChanged} notify={notify} />}{view === "reports" && <ReportsPanel data={data} notify={notify} onChanged={onChanged} />}{view === "integrations" && <IntegrationsPanel data={data} onChanged={onChanged} notify={notify} />}<footer className="account-footer"><div><strong>{data.profile?.display_name || data.user.displayName}</strong><span>Cuenta de ChatGPT · espacio personal</span></div><button type="button" className="signout-link" onClick={() => window.location.assign("/signout-with-chatgpt?return_to=/")}>Cerrar sesión</button></footer></section></div></div>;
}

function ProfilePanel({ data, saveRecord, onChanged, notify }: { data: Overview; saveRecord: SaveRecord; onChanged: () => Promise<void>; notify: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const profile = data.profile;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const values = new FormData(event.currentTarget);
    await saveRecord({ kind: "profile", birthDate: values.get("birthDate"), sex: values.get("sex"), heightCm: values.get("heightCm"), bloodType: values.get("bloodType"), coverage: values.get("coverage"), emergencyContact: values.get("emergencyContact"), clinicalSummary: values.get("clinicalSummary") });
    setBusy(false);
  }
  const profileSex = profile?.sex === "masculino" || profile?.sex === "femenino" || profile?.sex === "no_informar" ? profile.sex : "no_informar";
  return <div><PanelHeading kicker="FICHA PERSONAL" title="Perfil clínico" text="Los campos vacíos no se completan por inferencia. Todo queda inicialmente como declarado por vos." /><form onSubmit={submit}><div className="profile-card"><div className="profile-avatar">{initials(profile?.display_name || data.user.displayName)}</div><div><strong>{profile?.display_name || data.user.displayName}</strong><span>Paciente · espacio personal</span><small>Identidad verificada por ChatGPT</small></div></div><div className="form-grid"><Field label="Fecha de nacimiento" optional><input name="birthDate" type="date" defaultValue={profile?.birth_date || ""} max={localDate()} /></Field><Field label="Sexo" optional><select name="sex" defaultValue={profileSex}><option value="masculino">Masculino</option><option value="femenino">Femenino</option><option value="no_informar">No informar</option></select></Field><Field label="Altura" suffix="cm" optional><input name="heightCm" type="number" min="50" max="260" step="0.1" defaultValue={profile?.height_cm ?? ""} /></Field><Field label="Grupo sanguíneo" optional><input name="bloodType" defaultValue={profile?.blood_type || ""} maxLength={20} /></Field><Field label="Cobertura de salud" optional><input name="coverage" defaultValue={profile?.coverage || ""} maxLength={160} /></Field><Field label="Contacto de emergencia" optional wide><input name="emergencyContact" defaultValue={profile?.emergency_contact || ""} maxLength={240} /></Field><Field label="Resumen clínico actual" optional wide><textarea name="clinicalSummary" rows={6} defaultValue={profile?.clinical_summary || ""} placeholder="Antecedentes, hábitos, objetivos o contexto que quieras mantener visible…" /></Field></div><button className="primary-action submit-action" type="submit" disabled={busy}><Icon name="check" size={18} />{busy ? "Guardando…" : "Guardar perfil"}</button></form><ClinicalFactsPanel data={data} saveRecord={saveRecord} onChanged={onChanged} notify={notify} /></div>;
}

function ClinicalFactsPanel({ data, saveRecord, onChanged, notify }: { data: Overview; saveRecord: SaveRecord; onChanged: () => Promise<void>; notify: (message: string) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [editing, setEditing] = useState<ClinicalFact | null>(null);
  const filtered = useMemo(() => data.facts.filter((fact) => (category === "all" || fact.category === category) && (!query.trim() || `${fact.title} ${fact.details || ""} ${fact.dose || ""} ${fact.schedule || ""}`.toLocaleLowerCase("es-AR").includes(query.trim().toLocaleLowerCase("es-AR")))), [category, data.facts, query]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); setBusy(true);
    const ok = await saveRecord(factPayload(values));
    setBusy(false); if (ok) { form.reset(); setShowForm(false); }
  }
  async function remove(fact: ClinicalFact) {
    if (!window.confirm(`¿Eliminar “${fact.title}” del historial? La baja quedará auditada.`)) return;
    const response = await fetch("/api/health/manage", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "clinical_fact", id: fact.id }) });
    const result = await response.json() as { error?: string };
    notify(response.ok ? "Dato clínico eliminado." : result.error || "No pudimos eliminarlo.");
    if (response.ok) await onChanged();
  }

  return <section className="facts-section"><div className="section-heading"><div><p className="eyebrow">ANTECEDENTES E INDICADORES</p><h2>Historial estructurado</h2></div><button className="secondary-action" type="button" onClick={() => setShowForm((value) => !value)}><Icon name={showForm ? "close" : "plus"} size={17} />{showForm ? "Cerrar" : "Agregar dato"}</button></div><div className="compact-filters"><label className="search-field"><Icon name="search" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar antecedente…" /></label><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Todas las categorías</option>{factCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>{filtered.length ? <div className="table-scroll"><table className="data-table compact-table"><thead><tr><th>Desde</th><th>Categoría</th><th>Dato</th><th>Estado</th><th>Detalle</th><th>Gestión</th></tr></thead><tbody>{filtered.map((fact) => <tr key={fact.id}><td>{formatDate(fact.effective_at)}</td><td>{clinicalFactLabel(fact.category)}</td><td><strong>{fact.title}</strong><small>{sourceLabel(fact.source_type, fact.verification_status)}</small></td><td><span className={`status-pill ${fact.status === "active" ? "active" : fact.status === "resolved" ? "complete" : "pending"}`}>{clinicalFactStatus(fact.status)}</span></td><td><span className="cell-clamp">{[fact.dose, fact.schedule, fact.details].filter(Boolean).join(" · ") || "—"}</span></td><td><div className="row-actions"><button onClick={() => setEditing(fact)}>Editar</button><button className="danger" onClick={() => void remove(fact)}>Eliminar</button></div></td></tr>)}</tbody></table></div> : <EmptyState icon="heart" title="Sin datos en esta vista" text="Podés registrar antecedentes, medicación, alergias y hábitos sin inferencias automáticas." />}{showForm && <form className="inline-entry-form" onSubmit={submit}><h3>Nuevo dato clínico</h3><FactFields /><button className="primary-action submit-action" type="submit" disabled={busy}><Icon name="plus" size={18} />{busy ? "Guardando…" : "Agregar al historial"}</button></form>}{editing && <FactEditor fact={editing} onClose={() => setEditing(null)} notify={notify} onSaved={async () => { setEditing(null); await onChanged(); }} />}</section>;
}

function FactFields({ fact }: { fact?: ClinicalFact }) {
  return <div className="form-grid compact"><Field label="Categoría"><select name="category" defaultValue={fact?.category || "condition"}>{factCategories.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field><Field label="Estado"><select name="status" defaultValue={fact?.status || "active"}><option value="active">Activo</option><option value="historical">Histórico</option><option value="resolved">Resuelto</option><option value="inactive">Inactivo</option><option value="suspected">Referido / a confirmar</option></select></Field><Field label="Nombre o descripción" wide><input name="title" required maxLength={180} defaultValue={fact?.title || ""} placeholder="Escribí lo informado o recordado" /></Field><Field label="Desde" optional><input name="effectiveAt" type="date" max={localDate()} defaultValue={fact?.effective_at?.slice(0, 10) || ""} /></Field><Field label="Hasta" optional><input name="endAt" type="date" defaultValue={fact?.end_at?.slice(0, 10) || ""} /></Field><Field label="Dosis" optional><input name="dose" maxLength={120} defaultValue={fact?.dose || ""} /></Field><Field label="Frecuencia / pauta" optional><input name="schedule" maxLength={200} defaultValue={fact?.schedule || ""} /></Field><Field label="Detalles" optional wide><textarea name="details" rows={4} maxLength={2000} defaultValue={fact?.details || ""} /></Field></div>;
}

function FactEditor({ fact, onClose, onSaved, notify }: { fact: ClinicalFact; onClose: () => void; onSaved: () => Promise<void>; notify: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); const payload = factPayload(new FormData(event.currentTarget));
    const response = await fetch("/api/health/manage", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, type: "clinical_fact", id: fact.id }) });
    const result = await response.json() as { error?: string };
    if (response.ok) { notify("Dato clínico actualizado."); await onSaved(); } else notify(result.error || "No pudimos actualizarlo.");
    setBusy(false);
  }
  return <EditModal title="Editar dato clínico" onClose={onClose}><form onSubmit={submit}><FactFields fact={fact} /><ModalActions busy={busy} onClose={onClose} /></form></EditModal>;
}

function factPayload(values: FormData) { return { kind: "clinical_fact", category: values.get("category"), title: values.get("title"), status: values.get("status"), effectiveAt: values.get("effectiveAt"), endAt: values.get("endAt"), dose: values.get("dose"), schedule: values.get("schedule"), details: values.get("details") }; }

function LaboratoryPanel({ data, saveRecord, onChanged, notify }: { data: Overview; saveRecord: SaveRecord; onChanged: () => Promise<void>; notify: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [flag, setFlag] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<LabResult | null>(null);
  const [expandedPanel, setExpandedPanel] = useState("");
  const panelById = useMemo(() => Object.fromEntries(data.laboratory.panels.map((panel) => [panel.id, panel])), [data.laboratory.panels]);
  const groups = useMemo(() => {
    const map = new Map<string, LabResult[]>();
    for (const result of data.laboratory.results) { const key = result.analyte.trim().toLocaleLowerCase("es-AR"); map.set(key, [...(map.get(key) || []), result]); }
    return [...map.values()].map((results) => results.sort((a, b) => Date.parse(panelById[b.panel_id]?.effective_at || "") - Date.parse(panelById[a.panel_id]?.effective_at || ""))).filter((results) => {
      const latest = results[0];
      return (!query.trim() || latest.analyte.toLocaleLowerCase("es-AR").includes(query.trim().toLocaleLowerCase("es-AR"))) && (flag === "all" || (flag === "flagged" ? latest.flag === "high" || latest.flag === "low" : latest.flag === flag));
    }).sort((a, b) => a[0].analyte.localeCompare(b[0].analyte, "es-AR"));
  }, [data.laboratory.results, flag, panelById, query]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); setBusy(true);
    const ok = await saveRecord(labPayload(values)); setBusy(false); if (ok) { form.reset(); setShowForm(false); }
  }
  async function remove(result: LabResult) {
    if (!window.confirm(`¿Eliminar el resultado “${result.analyte}” del historial?`)) return;
    const response = await fetch("/api/health/manage", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "lab_result", id: result.id }) });
    const body = await response.json() as { error?: string };
    notify(response.ok ? "Resultado eliminado." : body.error || "No pudimos eliminarlo."); if (response.ok) await onChanged();
  }

  return <div><PanelHeading kicker="DATOS ESTRUCTURADOS" title="Laboratorio" text="Primero ves los últimos indicadores generales; después podés abrir cada estudio. El rango mostrado siempre es el informado por el laboratorio de origen." /><div className="section-heading"><div><p className="eyebrow">ÚLTIMOS DATOS GENERALES</p><h2>{groups.length} indicador{groups.length === 1 ? "" : "es"}</h2></div><button className="secondary-action" onClick={() => setShowForm((value) => !value)}><Icon name={showForm ? "close" : "plus"} size={17} />{showForm ? "Cerrar" : "Agregar resultado"}</button></div><div className="compact-filters"><label className="search-field"><Icon name="search" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar indicador…" /></label><select value={flag} onChange={(event) => setFlag(event.target.value)}><option value="all">Todos los estados</option><option value="flagged">Marcados por el informe</option><option value="normal">Dentro del rango informado</option><option value="high">Alto</option><option value="low">Bajo</option></select></div>{groups.length ? <div className="table-scroll"><table className="data-table lab-overview-table"><thead><tr><th>Indicador</th><th>Último resultado</th><th>Rango del informe</th><th>Tendencia</th><th>Fecha / fuente</th><th>Gestión</th></tr></thead><tbody>{groups.map((results) => { const latest = results[0]; const panel = panelById[latest.panel_id]; return <tr key={latest.analyte}><td><strong>{latest.analyte}</strong><small>{results.length} referencia{results.length === 1 ? "" : "s"} histórica{results.length === 1 ? "" : "s"}</small></td><td><strong className={`lab-value flag-${latest.flag || "none"}`}>{latest.result_text}{latest.unit ? ` ${latest.unit}` : ""}</strong><span className={`status-pill ${latest.flag === "high" || latest.flag === "low" ? "suspended" : "complete"}`}>{labFlagLabel(latest.flag)}</span></td><td><span>{latest.reference_range || "No informado"}</span></td><td><MiniLabTrend results={results} panelById={panelById} /></td><td>{formatDate(panel?.effective_at)}<small>{panel?.institution || sourceLabel("document", latest.verification_status)}</small></td><td><div className="row-actions"><button onClick={() => setEditing(latest)}>Editar</button><button className="danger" onClick={() => void remove(latest)}>Eliminar</button></div></td></tr>; })}</tbody></table></div> : <EmptyState icon="spark" title="Sin indicadores en esta vista" text="Cambiá el filtro o agregá un resultado estructurado." />}{showForm && <form className="inline-entry-form" onSubmit={submit}><h3>Nuevo resultado</h3><LabFields /><button className="primary-action submit-action" disabled={busy}><Icon name="plus" size={18} />{busy ? "Guardando…" : "Agregar resultado"}</button></form>}<section className="lab-study-history"><div className="section-heading"><div><p className="eyebrow">HISTORIAL DE ESTUDIOS</p><h2>{data.laboratory.panels.length} estudio{data.laboratory.panels.length === 1 ? "" : "s"}</h2></div></div>{data.laboratory.panels.length ? <div className="table-scroll"><table className="data-table compact-table"><thead><tr><th>Fecha</th><th>Estudio</th><th>Institución</th><th>Resultados</th><th>Estado</th><th /></tr></thead><tbody>{data.laboratory.panels.map((panel) => { const results = data.laboratory.results.filter((result) => result.panel_id === panel.id); const open = expandedPanel === panel.id; return <tr className={open ? "expanded" : ""} key={panel.id}><td>{formatDate(panel.effective_at)}</td><td><strong>{panel.title}</strong>{open && <div className="panel-results">{results.map((result) => <span key={result.id}><b>{result.analyte}</b>{result.result_text}{result.unit ? ` ${result.unit}` : ""}</span>)}</div>}</td><td>{panel.institution || "—"}</td><td>{results.length}</td><td><span className="status-pill complete">Estructurado</span></td><td><button className="icon-action" onClick={() => setExpandedPanel(open ? "" : panel.id)}>{open ? "−" : "+"}</button></td></tr>; })}</tbody></table></div> : <EmptyState icon="spark" title="Sin estudios" text="Los paneles de laboratorio aparecerán acá." />}</section>{editing && <LabEditor result={editing} onClose={() => setEditing(null)} notify={notify} onSaved={async () => { setEditing(null); await onChanged(); }} />}</div>;
}

function LabFields({ result }: { result?: LabResult }) {
  return <div className="form-grid compact">
    {!result && <>
      <Field label="Fecha"><input name="date" type="date" required max={localDate()} /></Field>
      <Field label="Panel / estudio"><input name="panelTitle" required maxLength={200} placeholder="Ej.: Laboratorio general" /></Field>
      <Field label="Institución" optional><input name="institution" maxLength={160} /></Field>
    </>}
    <Field label="Indicador"><input name="analyte" required maxLength={160} defaultValue={result?.analyte || ""} placeholder="Ej.: Glucosa" /></Field>
    <Field label="Resultado tal como figura"><input name="resultText" required maxLength={120} defaultValue={result?.result_text || ""} /></Field>
    <Field label="Valor numérico" optional><input name="resultNumeric" type="number" step="any" defaultValue={result?.result_numeric ?? ""} /></Field>
    <Field label="Unidad" optional><input name="unit" maxLength={40} defaultValue={result?.unit || ""} /></Field>
    <Field label="Rango del informe" optional><input name="referenceRange" maxLength={120} defaultValue={result?.reference_range || ""} /></Field>
    <Field label="Marca del informe" optional><select name="flag" defaultValue={result?.flag || ""}><option value="">Sin marca</option><option value="normal">En rango</option><option value="low">Bajo</option><option value="high">Alto</option></select></Field>
    <Field label="Método" optional><input name="method" maxLength={120} /></Field>
  </div>;
}

function LabEditor({ result, onClose, onSaved, notify }: { result: LabResult; onClose: () => void; onSaved: () => Promise<void>; notify: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); const payload = labPayload(new FormData(event.currentTarget)); const response = await fetch("/api/health/manage", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, type: "lab_result", id: result.id }) }); const body = await response.json() as { error?: string }; if (response.ok) { notify("Resultado actualizado."); await onSaved(); } else notify(body.error || "No pudimos actualizarlo."); setBusy(false); }
  return <EditModal title="Editar resultado" onClose={onClose}><form onSubmit={submit}><LabFields result={result} /><ModalActions busy={busy} onClose={onClose} /></form></EditModal>;
}
function labPayload(values: FormData) { return { kind: "lab_result", date: values.get("date"), panelTitle: values.get("panelTitle"), institution: values.get("institution"), analyte: values.get("analyte"), resultText: values.get("resultText"), resultNumeric: values.get("resultNumeric"), unit: values.get("unit"), referenceRange: values.get("referenceRange"), flag: values.get("flag"), method: values.get("method") }; }

function MiniLabTrend({ results, panelById }: { results: LabResult[]; panelById: Record<string, Overview["laboratory"]["panels"][number]> }) {
  const points = results.filter((result) => result.result_numeric !== null).map((result) => ({ value: Number(result.result_numeric), date: panelById[result.panel_id]?.effective_at || "" })).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  if (!points.length) return <span className="no-trend">Sin valor numérico</span>;
  const range = parseReferenceRange(results[0].reference_range);
  const values = points.map((point) => point.value);
  const bounds = [...values, ...(range ? [range.min, range.max] : [])];
  let min = Math.min(...bounds); let max = Math.max(...bounds); const padding = Math.max((max - min) * .18, Math.abs(max || 1) * .03); min -= padding; max += padding;
  const x = (index: number) => points.length === 1 ? 70 : 6 + index * (128 / (points.length - 1));
  const y = (value: number) => 34 - ((value - min) / (max - min || 1)) * 28;
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
  return <div className="mini-lab-trend" title={range ? `Banda: ${results[0].reference_range}` : "Sin rango numérico interpretable"}><svg viewBox="0 0 140 40" role="img" aria-label={`Tendencia de ${results[0].analyte}`}>{range && <rect x="3" y={Math.min(y(range.max), y(range.min))} width="134" height={Math.abs(y(range.min) - y(range.max)) || 2} rx="2" className="range-band" />}{points.length > 1 && <path d={path} className="trend-line" />}{points.map((point, index) => <circle key={`${point.date}:${index}`} cx={x(index)} cy={y(point.value)} r={index === points.length - 1 ? 3 : 2.2} className={range && (point.value < range.min || point.value > range.max) ? "trend-point outside" : "trend-point"} />)}</svg><small>{points.length} punto{points.length === 1 ? "" : "s"} · banda = rango del informe</small></div>;
}

function parseReferenceRange(value?: string | null) {
  if (!value) return null; const normalized = value.replaceAll(",", "."); const match = normalized.match(/(-?\d+(?:\.\d+)?)\s*(?:-|–|—|a)\s*(-?\d+(?:\.\d+)?)/i); if (match) return { min: Number(match[1]), max: Number(match[2]) }; const less = normalized.match(/(?:[<≤]|hasta\s+|menor\s+(?:que|a)\s*)(-?\d+(?:\.\d+)?)/i); if (less) return { min: 0, max: Number(less[1]) }; const more = normalized.match(/(?:[>≥]|mayor\s+(?:que|a)\s*)(-?\d+(?:\.\d+)?)/i); if (more) { const min = Number(more[1]); return { min, max: min * 1.5 || min + 1 }; } return null;
}

function ReportsPanel({ data, notify, onChanged }: { data: Overview; notify: (message: string) => void; onChanged: () => Promise<void> }) {
  const [preview, setPreview] = useState<{ backup: Record<string, unknown>; counts: Record<string, number>; warnings: string[] } | null>(null);
  const [restoring, setRestoring] = useState(false);
  async function readBackup(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; try { const backup = JSON.parse(await file.text()) as Record<string, unknown>; const response = await fetch("/api/health/backup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "preview", backup }) }); const result = await response.json() as { valid?: boolean; counts?: Record<string, number>; warnings?: string[]; error?: string }; if (!response.ok || !result.valid || !result.counts) throw new Error(result.error || "Respaldo incompatible."); setPreview({ backup, counts: result.counts, warnings: result.warnings || [] }); } catch (error) { notify(error instanceof Error ? error.message : "No pudimos leer el respaldo."); } }
  async function restore() { if (!preview) return; setRestoring(true); const response = await fetch("/api/health/backup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "apply", backup: preview.backup }) }); const result = await response.json() as { error?: string }; notify(response.ok ? "Respaldo restaurado." : result.error || "No pudimos restaurarlo."); if (response.ok) { setPreview(null); await onChanged(); } setRestoring(false); }
  return <div><PanelHeading kicker="INFORMES" title="Compartir y respaldar" text="Las opciones de salida están agrupadas en un solo menú; cada archivo conserva período, fuente y validación." /><details className="export-menu"><summary className="primary-action"><Icon name="download" size={18} /> Exportar / respaldar <span>⌄</span></summary><div><button onClick={() => window.print()}><Icon name="document" size={18} /><span><strong>Imprimir o guardar PDF</strong><small>Resumen preparado para consulta.</small></span></button><a href="/api/health/backup"><Icon name="download" size={18} /><span><strong>Respaldo completo JSON</strong><small>Para restaurar todos los datos.</small></span></a><button onClick={() => exportCsv(data)}><Icon name="download" size={18} /><span><strong>Mediciones CSV</strong><small>Compatible con Excel y planillas.</small></span></button><button onClick={() => exportMarkdown(data)}><Icon name="document" size={18} /><span><strong>Resumen de texto</strong><small>Contexto portable en formato Markdown.</small></span></button></div></details><article className="print-report" id="clinical-report"><header><div><p>ENTHEOS · TU SALUD EN CONTEXTO</p><h2>Resumen para consulta</h2></div><time>Generado: {formatDate(new Date().toISOString(), true)}</time></header><section><h3>Paciente</h3><p><strong>{data.profile?.display_name || data.user.displayName}</strong>{data.profile?.birth_date ? ` · Nacimiento ${formatDate(data.profile.birth_date)}` : ""}</p><p>{data.profile?.clinical_summary || "Sin resumen clínico declarado."}</p></section><div className="report-metrics"><div><span>Peso reciente</span><strong>{data.weights[0] ? `${data.weights[0].weight_kg} kg` : "—"}</strong></div><div><span>Presión reciente</span><strong>{data.pressures[0] ? `${data.pressures[0].systolic}/${data.pressures[0].diastolic}` : "—"}</strong></div><div><span>Sueño reciente</span><strong>{data.sleeps[0]?.hours ? `${data.sleeps[0].hours} h` : "—"}</strong></div><div><span>Actividad registrada</span><strong>{data.activities.reduce((sum, item) => sum + Number(item.duration_minutes || 0), 0)} min</strong></div><div><span>Documentos</span><strong>{data.documents.length}</strong></div><div><span>Resultados de laboratorio</span><strong>{data.laboratory.results.length}</strong></div><div><span>Datos de dispositivos</span><strong>{data.devices.observations.length}</strong></div></div><section><h3>Antecedentes, medicación y alergias declaradas</h3>{data.facts.length ? <ul className="report-facts">{data.facts.map((fact) => <li key={fact.id}><strong>{clinicalFactLabel(fact.category)}:</strong> {fact.title} · {clinicalFactStatus(fact.status)}</li>)}</ul> : <p>Sin datos estructurados declarados.</p>}</section></article><section className="restore-box"><h3>Importar un respaldo</h3><p>Primero validamos y mostramos el contenido; nada se aplica sin confirmación.</p><label className="file-button"><Icon name="upload" size={18} /> Elegir JSON<input type="file" accept="application/json,.json" onChange={(event) => void readBackup(event)} /></label>{preview && <div className="restore-preview"><strong>Contenido reconocido</strong><ul>{Object.entries(preview.counts).map(([key, value]) => <li key={key}><span>{key}</span><b>{value}</b></li>)}</ul>{preview.warnings.map((warning) => <p key={warning}>{warning}</p>)}<div><button onClick={() => setPreview(null)}>Cancelar</button><button className="primary-action" onClick={() => void restore()} disabled={restoring}>{restoring ? "Restaurando…" : "Confirmar importación"}</button></div></div>}</section></div>;
}

type ZeppImportResult = { imported: number; recognized: number; filesRead: number; duplicate?: boolean; counts?: Record<string, number>; message?: string; error?: string };
type IntegrationConnection = { id: string; provider: string; displayName: string; status: string; deviceLabel: string | null; deviceModel: string | null; capabilities: string[]; pairedAt: string | null; pairingExpiresAt: string | null; lastSeenAt: string | null; lastSyncAt: string | null; lastSuccessAt: string | null; lastErrorCode: string | null; lastErrorMessage: string | null; lastErrorAt: string | null; createdAt: string; updatedAt: string };
type IntegrationProvider = { id: string; name: string; status: "available" | "registration_required"; transport: string; capabilities: string[] };
type IntegrationResponse = { connections: IntegrationConnection[]; sources: { source: string; count: number; latest: string | null }[]; providers: IntegrationProvider[]; error?: string };
type IntervalsSyncResponse = { result?: { status: string; activities: number; wellnessDays: number; observations: number; warnings: string[] }; error?: string };

function IntegrationsPanel({ data, onChanged, notify }: { data: Overview; onChanged: () => Promise<void>; notify: (message: string) => void }) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ZeppImportResult | null>(null);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [sourceStats, setSourceStats] = useState<IntegrationResponse["sources"]>([]);
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [syncing, setSyncing] = useState(false);
  const intervals = connections.find((item) => item.provider === "intervals_icu") || null;
  const provider = providers.find((item) => item.id === "intervals_icu") || null;
  const status = connectionStatus(intervals?.status);
  const intervalsCount = sourceStats.find((item) => item.source === "intervals_icu")?.count
    || data.devices.observations.filter((item) => item.source_type === "intervals_icu").length;
  const providerReady = provider?.status === "available";
  const refreshConnections = useCallback(async () => {
    setLoadingConnections(true);
    try {
      const response = await fetch("/api/health/integrations", { cache: "no-store" });
      const body = await response.json() as IntegrationResponse;
      if (!response.ok) throw new Error(body.error || "No pudimos consultar las conexiones.");
      setConnections(body.connections || []);
      setSourceStats(body.sources || []);
      setProviders(body.providers || []);
    } catch (error) {
      notify(error instanceof Error ? error.message : "No pudimos consultar las conexiones.");
    } finally {
      setLoadingConnections(false);
    }
  }, [notify]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refreshConnections(); }, 0);
    const refreshOnFocus = () => { if (document.visibilityState === "visible") void refreshConnections(); };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [refreshConnections]);

  async function syncIntervals(oldest?: string, newest?: string) {
    if (!intervals) return;
    setSyncing(true);
    try {
      const response = await fetch("/api/health/connectors/intervals/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectionId: intervals.id, oldest, newest }),
      });
      const body = await response.json() as IntervalsSyncResponse;
      if (!response.ok || !body.result) throw new Error(body.error || "No pudimos actualizar Intervals.icu.");
      notify(`${body.result.activities} actividades y ${body.result.wellnessDays} días de bienestar actualizados.`);
      await Promise.all([refreshConnections(), onChanged()]);
    } catch (error) {
      notify(error instanceof Error ? error.message : "No pudimos actualizar Intervals.icu.");
      await refreshConnections();
    } finally {
      setSyncing(false);
    }
  }

  async function disconnectIntervals() {
    if (!intervals || !window.confirm("¿Desconectar Intervals.icu? Los datos ya importados se conservarán en tu historial.")) return;
    setSyncing(true);
    try {
      const response = await fetch("/api/health/connectors/intervals/disconnect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectionId: intervals.id }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "No pudimos desconectar Intervals.icu.");
      notify("Intervals.icu fue desconectado. El historial importado se conserva.");
      await Promise.all([refreshConnections(), onChanged()]);
    } catch (error) {
      notify(error instanceof Error ? error.message : "No pudimos desconectar Intervals.icu.");
    } finally {
      setSyncing(false);
    }
  }

  async function importZepp(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; setImporting(true); setResult(null); try { const response = await fetch("/api/health/import/zepp", { method: "POST", body: new FormData(form) }); const body = await response.json() as ZeppImportResult; setResult(body); if (!response.ok) throw new Error(body.error || "No pudimos leer la exportación."); notify(body.duplicate ? "Esta exportación ya estaba integrada." : `${body.imported} datos integrados.`); form.reset(); } catch (error) { notify(error instanceof Error ? error.message : "No pudimos actualizar la conexión."); } finally { setImporting(false); await onChanged(); } }

  return <div>
    <PanelHeading kicker="INTEGRACIONES" title="Conexiones de salud" text="Cada fuente conserva su procedencia. Una conexión sólo figura activa después de recibir datos reales." />
    <section className="device-import-card intervals-card">
      <div className="device-import-heading">
        <span className="device-logo intervals-logo">icu</span>
        <div><p className="eyebrow">CONEXIÓN WEB · FUENTE PRINCIPAL</p><h3>Intervals.icu</h3><p>Recibe desde Zepp actividades y bienestar diario, y los entrega a Entheos con autorización individual.</p></div>
        <b className={`connection-badge ${status.className}`}>{loadingConnections ? "Consultando…" : status.label}</b>
      </div>
      <div className="integration-flow" aria-label="Recorrido de los datos">
        <span><b>Z</b><small>Zepp</small></span><i>→</i><span><b className="intervals-flow-mark">icu</b><small>Intervals.icu</small></span><i>→</i><span><BrandMark compact /><small>Entheos</small></span>
      </div>
      <p className="connection-explanation"><strong>Sin aplicaciones puente ni códigos manuales.</strong> Cada persona autoriza a Entheos desde su propia cuenta de Intervals.icu y puede revocar el acceso cuando quiera.</p>
      <div className="device-stats">
        <div><strong>{intervalsCount.toLocaleString("es-AR")}</strong><span>registros recibidos</span></div>
        <div><strong>{intervals?.deviceLabel || "—"}</strong><span>cuenta vinculada</span></div>
        <div><strong>{intervals?.lastSuccessAt ? formatDate(intervals.lastSuccessAt, true) : "—"}</strong><span>última actualización</span></div>
      </div>
      <ol className="connection-state-list">
        <li className={intervals?.lastSuccessAt ? "complete" : "current"}><b>{intervals?.lastSuccessAt ? "✓" : "1"}</b><span><strong>Zepp → Intervals.icu</strong><small>{intervals?.lastSuccessAt ? "Se recibieron datos del circuito" : "Se configura una vez desde Intervals.icu"}</small></span></li>
        <li className={intervals ? "complete" : providerReady ? "current" : ""}><b>{intervals ? "✓" : "2"}</b><span><strong>Autorizar Entheos</strong><small>{intervals ? `${intervals.capabilities.length || 2} permisos de sólo lectura` : providerReady ? "Se abre el consentimiento oficial" : "Requiere habilitación del proveedor"}</small></span></li>
        <li className={intervals?.lastSuccessAt ? "complete" : intervals ? "current" : ""}><b>{intervals?.lastSuccessAt ? "✓" : "3"}</b><span><strong>Primera actualización</strong><small>{intervals?.lastSuccessAt ? `Completada ${formatDate(intervals.lastSuccessAt, true)}` : "Importará inicialmente las últimas seis semanas"}</small></span></li>
      </ol>
      {intervals?.status === "interrupted" && <div className="import-summary error"><strong>Conexión interrumpida</strong><p>{intervals.lastErrorMessage || "Volvé a autorizar la cuenta o reintentá la actualización."}</p></div>}
      {intervals?.status === "degraded" && <div className="import-summary warning"><strong>Actualización parcial</strong><p>{intervals.lastErrorMessage || "Una categoría no respondió; los demás datos fueron conservados."}</p></div>}
      {!providerReady && !intervals && <div className="provider-setup-note"><Icon name="shield" size={19} /><div><strong>Entheos ya está preparado para OAuth.</strong><p>Falta registrar la aplicación ante Intervals.icu. Mientras tanto podés crear la cuenta y vincular Zepp allí; no te pediremos claves personales.</p></div></div>}
      <div className="integration-actions">
        {intervals ? <button className="primary-action" type="button" disabled={syncing || loadingConnections} onClick={() => void syncIntervals()}><Icon name="activity" size={18} />{syncing ? "Actualizando…" : "Actualizar ahora"}</button>
          : providerReady ? <a className="primary-action" href="/api/health/connectors/intervals/authorize"><Icon name="shield" size={18} /> Vincular Intervals.icu</a>
            : <a className="primary-action" href="https://intervals.icu" target="_blank" rel="noreferrer"><Icon name="activity" size={18} /> Abrir Intervals.icu</a>}
        {intervals && <button className="quiet-danger" type="button" disabled={syncing} onClick={() => void disconnectIntervals()}>Desconectar</button>}
      </div>
      <p className="native-note"><Icon name="shield" size={18} /><span><strong>Lectura limitada.</strong> Entheos solicita únicamente actividades y bienestar. No modifica ni elimina información de Zepp o Intervals.icu.</span></p>
      <div className="capability-chips"><span>Actividades</span><span>Pasos</span><span>Sueño</span><span>FC en reposo</span></div>
      {intervals && <details className="history-sync"><summary>Importar otro período</summary><form onSubmit={(event) => { event.preventDefault(); const values = new FormData(event.currentTarget); void syncIntervals(String(values.get("oldest") || ""), String(values.get("newest") || "")); }}><label>Desde<input name="oldest" type="date" required max={localDate()} defaultValue={daysAgo(41)} /></label><label>Hasta<input name="newest" type="date" required max={localDate()} defaultValue={localDate()} /></label><button className="secondary-action" disabled={syncing}>Actualizar período</button></form><small>Hasta 366 días por actualización. Los registros repetidos se actualizan, no se duplican.</small></details>}
    </section>
    <details className="device-fallback"><summary><span><Icon name="upload" size={20} /></span><div><strong>Importación manual desde Zepp</strong><small>Respaldo por ZIP, CSV, JSON o TXT</small></div><b>⌄</b></summary><div><p>Usala si un dato no llega por Intervals.icu o para recuperar una exportación histórica.</p><form className="device-import-form" onSubmit={importZepp}><label className="device-file"><Icon name="upload" size={22} /><span><strong>Exportación de Zepp</strong><small>ZIP, CSV, JSON o TXT · hasta 25 MB</small></span><input name="file" type="file" required accept=".zip,.csv,.json,.txt,application/zip,text/csv,application/json,text/plain" /></label><button className="primary-action" type="submit" disabled={importing}>{importing ? "Importando…" : "Importar archivo"}</button></form>{result && <div className={`import-summary ${result.error ? "error" : "success"}`}><strong>{result.error ? "Importación interrumpida" : result.duplicate ? "Ya estaba importado" : `${result.imported} mediciones integradas`}</strong><p>{result.error || result.message || `${result.recognized} valores reconocidos en ${result.filesRead} archivo${result.filesRead === 1 ? "" : "s"}.`}</p></div>}</div></details>
    <section className="future-connectors"><div><p className="eyebrow">ARQUITECTURA EXTENSIBLE</p><h3>Próximas fuentes</h3><p>El mismo modelo admite nuevas conexiones sin mezclar identidades, permisos ni procedencia.</p></div><div className="future-provider-list"><span>Strava <b>Actividad</b></span><span>Fitbit <b>Próximamente</b></span><span>Apple Health <b>Requiere iOS</b></span><span>Archivo clínico <b>Disponible</b></span></div></section>
  </div>;
}

function connectionStatus(value?: string) { if (value === "active") return { label: "Activa", className: "active" }; if (value === "degraded") return { label: "Parcial", className: "pending" }; if (value === "interrupted") return { label: "Interrumpida", className: "interrupted" }; if (value === "pending_permissions") return { label: "Faltan permisos", className: "pending" }; if (value === "pending_pairing") return { label: "Esperando vínculo", className: "pending" }; return { label: "No conectada", className: "neutral" }; }
function daysAgo(days: number) { const date = new Date(); date.setDate(date.getDate() - days); const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 10); }

function EditModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}><section className="edit-modal"><header><div><small>HISTORIAL</small><strong>{title}</strong></div><button onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button></header>{children}</section></div>; }
function ModalActions({ busy, onClose }: { busy: boolean; onClose: () => void }) { return <footer><button type="button" className="secondary-action" onClick={onClose}>Cancelar</button><button type="submit" className="primary-action" disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</button></footer>; }
function PanelHeading({ kicker, title, text }: { kicker: string; title: string; text: string }) { return <div className="panel-heading"><p className="eyebrow">{kicker}</p><h2>{title}</h2><p>{text}</p></div>; }
function Field({ label, optional, suffix, wide, children }: { label: string; optional?: boolean; suffix?: string; wide?: boolean; children: ReactNode }) { return <label className={`field ${wide ? "wide" : ""}`}><span>{label}{optional && <small>Opcional</small>}</span><div className={suffix ? "input-suffix" : ""}>{children}{suffix && <b>{suffix}</b>}</div></label>; }
function initials(value: string) { return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
const factCategories: [string, string][] = [["condition", "Antecedente o condición"], ["medication", "Medicación"], ["allergy", "Alergia"], ["family_history", "Antecedente familiar"], ["procedure", "Procedimiento"], ["vaccination", "Vacunación"], ["habit", "Hábito"], ["risk", "Factor de riesgo"], ["treatment", "Tratamiento"], ["other", "Otro dato"]];
function clinicalFactLabel(value: string) { return Object.fromEntries(factCategories)[value] || "Dato clínico"; }
function clinicalFactStatus(value: string) { return ({ active: "Activo", historical: "Histórico", resolved: "Resuelto", inactive: "Inactivo", suspected: "A confirmar" } as Record<string, string>)[value] || value; }
function labFlagLabel(value?: string | null) { return value === "high" ? "Alto en el informe" : value === "low" ? "Bajo en el informe" : value === "normal" ? "En rango informado" : "Sin marca"; }
function exportCsv(data: Overview) { const rows = [["tipo", "fecha", "valor_1", "valor_2", "unidad", "fuente", "validacion"], ...data.weights.map((item) => ["peso", item.effective_at, item.weight_kg, item.waist_cm || "", "kg", item.source_type, item.verification_status]), ...data.pressures.map((item) => ["presion", item.effective_at, item.systolic, item.diastolic, "mmHg", item.source_type, item.verification_status]), ...data.activities.map((item) => ["actividad", item.effective_at, item.duration_minutes || "", item.perceived_effort || "", "min", item.source_type, item.verification_status]), ...data.sleeps.map((item) => ["sueño", item.effective_at, item.hours || "", item.quality || "", "horas", item.source_type, item.verification_status]), ...data.devices.observations.map((item) => [item.code, item.effective_at, item.value_numeric ?? item.value_text ?? "", "", item.unit || "", item.source_type, item.verification_status])]; download("entheos-mediciones.csv", rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll("\"", "\"\"")}"`).join(",")).join("\n"), "text/csv;charset=utf-8"); }
function exportMarkdown(data: Overview) { const text = [`# Entheos · Resumen clínico personal`, ``, `Generado: ${formatDate(new Date().toISOString(), true)}`, ``, `## Estado actual`, data.profile?.clinical_summary || "Sin resumen clínico declarado.", ``, `- Peso reciente: ${data.weights[0] ? `${data.weights[0].weight_kg} kg (${formatDate(data.weights[0].effective_at)})` : "sin registro"}`, `- Presión reciente: ${data.pressures[0] ? `${data.pressures[0].systolic}/${data.pressures[0].diastolic} mmHg (${formatDate(data.pressures[0].effective_at)})` : "sin registro"}`, `- Documentos: ${data.documents.length}`, `- Resultados de laboratorio: ${data.laboratory.results.length}`, `- Datos de dispositivos: ${data.devices.observations.length}`, ``, `## Antecedentes declarados`, ...(data.facts.length ? data.facts.map((fact) => `- ${clinicalFactLabel(fact.category)}: ${fact.title} (${clinicalFactStatus(fact.status)})`) : ["- Sin datos estructurados."])].join("\n"); download("entheos-resumen.md", text, "text/markdown;charset=utf-8"); }
function download(name: string, content: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); }
