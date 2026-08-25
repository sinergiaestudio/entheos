"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { EmptyState } from "./dashboard-screen";
import { Icon } from "./icons";
import type { ClinicalDocument, ClinicalHistoryItem } from "./health-types";
import { formatDate, localDate, sourceLabel } from "./health-types";

const HISTORY_PAGE_SIZE = 50;
const DOCUMENT_PAGE_SIZE = 20;

export function TimelineScreen({ events, onChanged, notify }: { events: ClinicalHistoryItem[]; onChanged: () => Promise<void>; notify: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState("");
  const [importing, setImporting] = useState(false);
  const types = useMemo(() => [...new Set(events.map((event) => event.category))].sort(), [events]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es-AR");
    return events.filter((event) => {
      const date = event.effective_at.slice(0, 10);
      const haystack = `${event.title} ${event.description || ""} ${event.tags.join(" ")} ${Object.values(event.details).join(" ")} ${sourceLabel(event.source_type, event.verification_status)}`.toLocaleLowerCase("es-AR");
      return (type === "all" || event.category === type) && (!from || date >= from) && (!to || date <= to) && (!normalized || haystack.includes(normalized));
    });
  }, [events, from, query, to, type]);
  const pages = Math.max(1, Math.ceil(filtered.length / HISTORY_PAGE_SIZE));
  const visible = filtered.slice((Math.min(page, pages) - 1) * HISTORY_PAGE_SIZE, Math.min(page, pages) * HISTORY_PAGE_SIZE);

  function updateFilter(callback: () => void) { callback(); setPage(1); }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const backup = JSON.parse(await file.text()) as Record<string, unknown>;
      const previewResponse = await fetch("/api/health/backup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "preview", backup }) });
      const preview = await previewResponse.json() as { valid?: boolean; counts?: Record<string, number>; error?: string };
      if (!previewResponse.ok || !preview.valid || !preview.counts) throw new Error(preview.error || "Respaldo incompatible.");
      const total = Object.values(preview.counts).reduce((sum, value) => sum + Number(value || 0), 0);
      if (!window.confirm(`Se reconocieron ${total.toLocaleString("es-AR")} registros. ¿Querés importarlos? Los duplicados identificables no se repetirán.`)) return;
      const response = await fetch("/api/health/backup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "apply", backup }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "No pudimos importar el respaldo.");
      notify("Datos importados y vinculados a tu historia.");
      await onChanged();
    } catch (error) { notify(error instanceof Error ? error.message : "No pudimos leer el archivo."); }
    finally { setImporting(false); }
  }

  return <div className="screen-stack">
    <section className="screen-intro"><p className="eyebrow">HISTORIA CLÍNICA COMPLETA</p><h1>Historial en datos</h1><p>{events.length.toLocaleString("es-AR")} registros disponibles. La tabla muestra 50 por página para mantener la navegación breve aun con importaciones de Zepp.</p></section>
    <section className="surface data-toolbar">
      <label className="search-field"><Icon name="search" size={19} /><input value={query} onChange={(event) => updateFilter(() => setQuery(event.target.value))} placeholder="Buscar registro, valor o fuente…" aria-label="Buscar historial" /></label>
      <label><span>Tipo</span><select value={type} onChange={(event) => updateFilter(() => setType(event.target.value))}><option value="all">Todos</option>{types.map((item) => <option value={item} key={item}>{eventTypeLabel(item)}</option>)}</select></label>
      <label><span>Desde</span><input type="date" value={from} max={to || localDate()} onChange={(event) => updateFilter(() => setFrom(event.target.value))} /></label>
      <label><span>Hasta</span><input type="date" value={to} min={from || undefined} max={localDate()} onChange={(event) => updateFilter(() => setTo(event.target.value))} /></label>
      <div className="toolbar-actions"><button className="secondary-action" type="button" onClick={() => exportHistory(filtered)}><Icon name="download" size={17} /> Exportar vista</button><label className={`secondary-action file-action ${importing ? "disabled" : ""}`}><Icon name="upload" size={17} /> {importing ? "Importando…" : "Importar JSON"}<input type="file" accept="application/json,.json" disabled={importing} onChange={(event) => void importBackup(event)} /></label></div>
    </section>
    <section className="surface data-surface">
      <div className="table-summary"><span><strong>{filtered.length.toLocaleString("es-AR")}</strong> coincidencias</span><small>Página {Math.min(page, pages)} de {pages}</small></div>
      {visible.length ? <div className="table-scroll"><table className="data-table history-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Registro</th><th>Valor / detalle</th><th>Fuente</th><th aria-label="Acciones" /></tr></thead><tbody>{visible.map((event) => {
        const key = `${event.category}:${event.id}`;
        return <tr key={key} className={expanded === key ? "expanded" : ""}><td>{formatDate(event.effective_at, true)}</td><td><span className="category-chip">{eventTypeLabel(event.category)}</span></td><td><strong>{event.title}</strong>{event.tags.length > 0 && <small>{event.tags.slice(0, 2).join(" · ")}</small>}</td><td><span className="cell-clamp">{event.description || summarizeDetails(event.details)}</span>{expanded === key && <div className="row-details">{Object.entries(event.details).map(([label, value]) => <span key={label}><b>{label.replaceAll("_", " ")}</b>{value ?? "—"}</span>)}</div>}</td><td><span className={`provenance source-${event.source_type}`}><i />{sourceLabel(event.source_type, event.verification_status)}</span></td><td><button className="icon-action" type="button" onClick={() => setExpanded(expanded === key ? "" : key)} aria-label={expanded === key ? "Contraer detalle" : "Ver detalle"}>{expanded === key ? "−" : "+"}</button></td></tr>;
      })}</tbody></table></div> : <EmptyState icon="search" title="No encontramos coincidencias" text="Probá otro período, tipo de dato o palabra." />}
      <Pagination page={Math.min(page, pages)} pages={pages} onPage={setPage} />
    </section>
  </div>;
}

export function DocumentsScreen({ documents, onChanged, notify }: { documents: ClinicalDocument[]; onChanged: () => Promise<void>; notify: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<ClinicalDocument | null>(null);
  const [editing, setEditing] = useState<ClinicalDocument | null>(null);
  const types = useMemo(() => [...new Set(documents.map((document) => document.document_type))].sort(), [documents]);
  const filtered = useMemo(() => documents.filter((document) => {
    const date = (document.study_date || document.created_at).slice(0, 10);
    const haystack = `${document.display_name} ${document.document_type} ${document.institution || ""} ${document.description || ""}`.toLocaleLowerCase("es-AR");
    return (type === "all" || document.document_type === type) && (!from || date >= from) && (!to || date <= to) && (!query.trim() || haystack.includes(query.trim().toLocaleLowerCase("es-AR")));
  }), [documents, from, query, to, type]);
  const pages = Math.max(1, Math.ceil(filtered.length / DOCUMENT_PAGE_SIZE));
  const visible = filtered.slice((Math.min(page, pages) - 1) * DOCUMENT_PAGE_SIZE, Math.min(page, pages) * DOCUMENT_PAGE_SIZE);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!navigator.onLine) { notify("Necesitás conexión para cargar archivos. El formulario no se perdió."); return; }
    setBusy(true);
    const form = event.currentTarget;
    try {
      const response = await fetch("/api/health/documents", { method: "POST", body: new FormData(form) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "No pudimos guardar el documento.");
      form.reset(); setShowUpload(false); notify("Documento original guardado en el espacio privado."); await onChanged();
    } catch (error) { notify(error instanceof Error ? error.message : "No pudimos guardar el documento."); }
    finally { setBusy(false); }
  }

  async function remove(document: ClinicalDocument) {
    if (!window.confirm(`¿Eliminar “${document.display_name}” de la historia? El original quedará retenido de forma recuperable en el archivo privado.`)) return;
    const response = await fetch("/api/health/manage", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "document", id: document.id }) });
    const result = await response.json() as { error?: string };
    notify(response.ok ? "Documento eliminado de la historia." : result.error || "No pudimos eliminarlo.");
    if (response.ok) await onChanged();
  }

  return <div className="screen-stack">
    <section className="screen-intro intro-with-action"><div><p className="eyebrow">ARCHIVO PRIVADO</p><h1>Documentos y estudios</h1><p>Originales organizados por tipo y fecha, con edición de metadatos y acceso al historial.</p></div><button className="primary-action" type="button" onClick={() => setShowUpload((value) => !value)}><Icon name={showUpload ? "close" : "plus"} size={18} />{showUpload ? "Cerrar carga" : "Agregar documento"}</button></section>
    {showUpload && <section className="surface upload-surface"><form onSubmit={upload}><div className="upload-drop"><Icon name="upload" size={30} /><div><strong>Elegí un archivo o usá la cámara</strong><p>PDF, imágenes, DICOM, ZIP, CSV, JSON o texto · hasta 25 MB</p></div><input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.dcm,.zip,.csv,.json,.txt,application/pdf,image/*" /></div><DocumentFields /><button className="primary-action submit-action" disabled={busy} type="submit"><Icon name="upload" size={19} />{busy ? "Guardando original…" : "Guardar documento"}</button></form></section>}
    <section className="surface data-toolbar document-toolbar"><label className="search-field"><Icon name="search" size={19} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Buscar documento, institución…" /></label><label><span>Tipo</span><select value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}><option value="all">Todos</option>{types.map((item) => <option key={item} value={item}>{documentTypeLabel(item)}</option>)}</select></label><label><span>Desde</span><input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></label><label><span>Hasta</span><input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></label></section>
    <section className="surface data-surface"><div className="section-heading"><div><p className="eyebrow">BIBLIOTECA CLÍNICA</p><h2>{filtered.length} documento{filtered.length === 1 ? "" : "s"}</h2></div><span className="source-chip"><i /> Acceso privado</span></div>{visible.length ? <div className="table-scroll"><table className="data-table document-table"><thead><tr><th>Fecha</th><th>Documento</th><th>Tipo</th><th>Institución</th><th>Tamaño</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{visible.map((document) => <tr key={document.id}><td>{formatDate(document.study_date || document.created_at)}</td><td><button className="table-title-button" onClick={() => setPreview(document)}><span className={`file-icon mime-${mimeClass(document.mime_type)}`}><Icon name="document" size={19} /><small>{fileLabel(document.mime_type)}</small></span><strong>{document.display_name}</strong></button></td><td>{documentTypeLabel(document.document_type)}</td><td>{document.institution || "—"}</td><td>{formatBytes(document.size_bytes)}</td><td><span className={`status-pill ${document.review_status === "pending" ? "pending" : "active"}`}>{document.review_status === "pending" ? "Pendiente" : "Original"}</span></td><td><div className="row-actions"><button onClick={() => setPreview(document)}>Ver</button><a href={`/api/health/documents/${document.id}?download=1`}>Descargar</a><button onClick={() => setEditing(document)}>Editar</button><button className="danger" onClick={() => void remove(document)}>Eliminar</button></div></td></tr>)}</tbody></table></div> : <EmptyState icon="document" title="No hay documentos en esta vista" text="Cambiá los filtros o agregá un estudio nuevo." />}<Pagination page={Math.min(page, pages)} pages={pages} onPage={setPage} /></section>
    {preview && <DocumentModal document={preview} onClose={() => setPreview(null)} />}
    {editing && <DocumentEditor document={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); notify("Documento actualizado."); await onChanged(); }} notify={notify} />}
  </div>;
}

function DocumentFields({ document }: { document?: ClinicalDocument }) {
  return <div className="form-grid compact"><label className="field"><span>Nombre visible</span><div><input name="title" required={Boolean(document)} maxLength={200} defaultValue={document?.display_name || ""} placeholder="Ej.: Laboratorio de control" /></div></label><label className="field"><span>Tipo</span><div><select name="documentType" defaultValue={document?.document_type || "laboratorio"}><option value="laboratorio">Laboratorio</option><option value="electrocardiograma">Electrocardiograma</option><option value="radiografia">Radiografía</option><option value="ecografia">Ecografía</option><option value="tomografia">Tomografía</option><option value="resonancia">Resonancia</option><option value="informe_medico">Informe médico</option><option value="receta">Receta</option><option value="plan_nutricional">Plan nutricional</option><option value="otro">Otro</option></select></div></label><label className="field"><span>Fecha del estudio <small>Opcional</small></span><div><input name="studyDate" type="date" defaultValue={document?.study_date || ""} max={localDate()} /></div></label><label className="field"><span>Institución <small>Opcional</small></span><div><input name="institution" defaultValue={document?.institution || ""} maxLength={180} /></div></label><label className="field wide"><span>Descripción <small>Opcional</small></span><div><textarea name="description" rows={3} defaultValue={document?.description || ""} maxLength={1500} /></div></label></div>;
}

function DocumentEditor({ document, onClose, onSaved, notify }: { document: ClinicalDocument; onClose: () => void; onSaved: () => Promise<void>; notify: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); const values = new FormData(event.currentTarget);
    const response = await fetch("/api/health/manage", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "document", id: document.id, displayName: values.get("title"), documentType: values.get("documentType"), studyDate: values.get("studyDate"), institution: values.get("institution"), description: values.get("description") }) });
    const result = await response.json() as { error?: string };
    if (response.ok) await onSaved(); else notify(result.error || "No pudimos actualizar el documento.");
    setBusy(false);
  }
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Editar documento"><section className="edit-modal"><header><div><small>METADATOS</small><strong>Editar documento</strong></div><button onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button></header><form onSubmit={submit}><DocumentFields document={document} /><footer><button type="button" className="secondary-action" onClick={onClose}>Cancelar</button><button type="submit" className="primary-action" disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</button></footer></form></section></div>;
}

function DocumentModal({ document, onClose }: { document: ClinicalDocument; onClose: () => void }) {
  const viewable = document.mime_type === "application/pdf" || document.mime_type.startsWith("image/") && document.mime_type !== "image/heic";
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Vista previa de ${document.display_name}`}><section className="document-modal"><header><div><strong>{document.display_name}</strong><small>Original · {sourceLabel(document.source_type, document.review_status)}</small></div><button type="button" onClick={onClose} aria-label="Cerrar vista previa"><Icon name="close" /></button></header>{viewable ? <iframe src={`/api/health/documents/${document.id}`} title={document.display_name} /> : <EmptyState icon="document" title="Vista previa no disponible" text="Este formato se conserva intacto y puede descargarse para abrirlo con una aplicación compatible." />}<footer><a className="secondary-action" href={`/api/health/documents/${document.id}?download=1`}><Icon name="download" size={18} /> Descargar original</a><button className="primary-action" type="button" onClick={onClose}>Cerrar</button></footer></section></div>;
}

function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  return <nav className="table-pagination" aria-label="Paginación"><button disabled={page <= 1} onClick={() => onPage(page - 1)}>← Anterior</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => onPage(page + 1)}>Siguiente →</button></nav>;
}

function exportHistory(events: ClinicalHistoryItem[]) {
  const rows = [["fecha", "tipo", "registro", "detalle", "fuente", "validacion"], ...events.map((event) => [event.effective_at, eventTypeLabel(event.category), event.title, event.description || summarizeDetails(event.details), event.source_type, event.verification_status])];
  download("entheos-historial-filtrado.csv", rows.map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8");
}
function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll("\"", "\"\"")}"`; }
function summarizeDetails(details: Record<string, string | number | null>) { return Object.entries(details).slice(0, 3).map(([key, value]) => `${key.replaceAll("_", " ")}: ${value ?? "—"}`).join(" · ") || "—"; }
function eventTypeLabel(value: string) { return ({ weight: "Peso", blood_pressure: "Presión arterial", activity: "Actividad", sleep: "Sueño", symptom: "Síntoma", clinical_fact: "Dato clínico", document: "Documento o estudio", laboratory: "Laboratorio", nutrition: "Nutrición", device: "Zepp y dispositivos", measurement: "Medición", note: "Nota", consultation: "Consulta", treatment: "Tratamiento", procedure: "Procedimiento", vaccination: "Vacuna" } as Record<string, string>)[value] || value; }
function documentTypeLabel(value: string) { return ({ laboratorio: "Laboratorio", electrocardiograma: "Electrocardiograma", radiografia: "Radiografía", ecografia: "Ecografía", tomografia: "Tomografía", resonancia: "Resonancia", informe_medico: "Informe médico", receta: "Receta", plan_nutricional: "Plan nutricional", otro: "Otro" } as Record<string, string>)[value] || value.replaceAll("_", " "); }
function mimeClass(mime: string) { return mime.includes("pdf") ? "pdf" : mime.startsWith("image/") ? "image" : mime.includes("zip") || mime.includes("dicom") ? "study" : "data"; }
function fileLabel(mime: string) { return mime.includes("pdf") ? "PDF" : mime.startsWith("image/") ? "IMG" : mime.includes("dicom") ? "DCM" : mime.includes("zip") ? "ZIP" : "DAT"; }
function formatBytes(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`; }
function download(name: string, content: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); }
