"use client";

import { useState } from "react";
import { Icon } from "./icons";
import type { Overview } from "./health-types";
import { formatDate, sourceLabel } from "./health-types";

export function DashboardScreen({
  data,
  onRegister,
  migration,
  onMigrate,
  migrating,
}: {
  data: Overview;
  onRegister: () => void;
  migration: { available: boolean; profileName?: string; incompleteAttempt?: boolean } | null;
  onMigrate: (legacyPassword: string) => void;
  migrating: boolean;
}) {
  const [confirmMigration, setConfirmMigration] = useState(false);
  const latestWeight = data.weights[0];
  const latestPressure = data.pressures[0];
  const latestSleep = data.sleeps[0];
  const weekStart = Date.parse(data.generatedAt) - 7 * 86400000;
  const weeklyActivities = data.activities.filter((item) => Date.parse(item.effective_at) >= weekStart);
  const activityMinutes = weeklyActivities.reduce((total, item) => total + Number(item.duration_minutes || 0), 0);
  const nutritionDays = data.nutrition.days.filter((item) => Date.parse(`${item.date}T12:00:00`) >= weekStart);
  const adherence = nutritionDays.length
    ? Math.round(nutritionDays.reduce((total, item) => total + Number(item.adherence || 0), 0) / nutritionDays.length)
    : null;
  const deviceObservations = data.devices.observations;
  const latestDevice = deviceObservations[0];
  const firstName = (data.profile?.display_name || data.user.displayName).split(" ")[0];

  return (
    <div className="screen-stack">
      <section className="welcome-strip">
        <div>
          <p className="eyebrow">HISTORIA CLÍNICA PERSONAL</p>
          <h1>Buen día, {firstName}.</h1>
          <p>Tu salud, reunida con fuentes visibles y sin confundir observaciones con diagnósticos.</p>
        </div>
        <button className="primary-action" type="button" onClick={onRegister}>
          <Icon name="plus" size={20} /> Registrar ahora
        </button>
      </section>

      {(migration?.available || migration?.incompleteAttempt) && (
        <section className="migration-card" aria-live="polite">
          <div className="migration-icon"><Icon name="nutrition" /></div>
          <div>
            <strong>{migration.incompleteAttempt ? "La migración anterior quedó incompleta." : "Encontramos tu seguimiento anterior."}</strong>
            <p>{migration.incompleteAttempt ? "Por seguridad no se repetirá automáticamente: revisá la línea de tiempo y el respaldo antes de continuar." : `Podemos integrar el ciclo nutricional de ${migration.profileName || "tu perfil"} sin borrar la copia original.`}</p>
          </div>
          {!migration.incompleteAttempt && (confirmMigration ? <form className="migration-confirm" onSubmit={(event) => { event.preventDefault(); const password = new FormData(event.currentTarget).get("legacyPassword"); if (password) onMigrate(String(password)); }}><label><span>Contraseña del perfil anterior</span><input name="legacyPassword" type="password" autoComplete="current-password" minLength={4} maxLength={128} required autoFocus /></label><div><button type="button" onClick={() => setConfirmMigration(false)}>Cancelar</button><button type="submit" className="secondary-action" disabled={migrating}>{migrating ? "Integrando…" : "Confirmar e integrar"}</button></div></form> : <button type="button" className="secondary-action" onClick={() => setConfirmMigration(true)} disabled={migrating}>Integrar ahora</button>)}
        </section>
      )}

      <section className="metric-grid" aria-label="Resumen actual">
        <MetricCard icon="weight" tone="green" label="Peso actual" value={latestWeight ? `${number(latestWeight.weight_kg)} kg` : "Sin registro"} detail={latestWeight ? formatDate(latestWeight.effective_at) : "Registrar peso"} />
        <MetricCard icon="heart" tone="terracotta" label="Presión reciente" value={latestPressure ? `${latestPressure.systolic}/${latestPressure.diastolic}` : "Sin registro"} detail={latestPressure ? `${formatDate(latestPressure.effective_at)} · mmHg` : "Hasta 3 tomas"} />
        <MetricCard icon="activity" tone="blue" label="Actividad · 7 días" value={`${activityMinutes} min`} detail={`${weeklyActivities.length} sesión${weeklyActivities.length === 1 ? "" : "es"}`} />
        <MetricCard icon="moon" tone="blue" label="Sueño reciente" value={latestSleep?.hours !== null && latestSleep?.hours !== undefined ? `${number(latestSleep.hours)} h` : "Sin registro"} detail={latestSleep ? `${formatDate(latestSleep.effective_at)}${latestSleep.quality ? ` · calidad ${latestSleep.quality}/5` : ""}` : "Duración y calidad"} />
        <MetricCard icon="nutrition" tone="amber" label="Adherencia semanal" value={adherence === null ? "Sin datos" : `${adherence}%`} detail={`${nutritionDays.length} día${nutritionDays.length === 1 ? "" : "s"} registrado${nutritionDays.length === 1 ? "" : "s"}`} />
        <MetricCard icon="activity" tone="green" label="Aplicaciones y dispositivos" value={deviceObservations.length ? `${deviceObservations.length} datos` : "Sin importar"} detail={latestDevice ? `${deviceLabel(latestDevice.code)} · ${formatDate(latestDevice.effective_at)}` : "Conectar desde Integraciones"} />
      </section>

      <section className="dashboard-columns">
        <article className="surface chart-surface">
          <div className="section-heading">
            <div><p className="eyebrow">TENDENCIAS</p><h2>Evolución reciente</h2></div>
            <span className="source-chip"><i /> Fuentes identificadas</span>
          </div>
          <div className="chart-block">
            <div className="chart-label"><span>Peso</span><strong>{latestWeight ? `${number(latestWeight.weight_kg)} kg` : "—"}</strong></div>
            <Sparkline values={[...data.weights].reverse().slice(-12).map((item) => item.weight_kg)} color="var(--health-green)" />
          </div>
          <div className="chart-block">
            <div className="chart-label"><span>Presión arterial</span><strong>{latestPressure ? `${latestPressure.systolic}/${latestPressure.diastolic}` : "—"}</strong></div>
            <DualSparkline
              high={[...data.pressures].reverse().slice(-16).map((item) => item.systolic)}
              low={[...data.pressures].reverse().slice(-16).map((item) => item.diastolic)}
            />
          </div>
        </article>

        <article className="surface clinical-now">
          <div className="section-heading">
            <div><p className="eyebrow">ESTADO ACTUAL</p><h2>Resumen clínico</h2></div>
            <Icon name="shield" />
          </div>
          <p className="clinical-summary">{data.profile?.clinical_summary || "Todavía no agregaste un resumen clínico personal. Podés completarlo desde Perfil."}</p>
          <dl className="current-list">
            <div><dt>Síntomas activos</dt><dd>{data.symptoms.filter((item) => item.status !== "resolved").length}</dd></div>
            <div><dt>Antecedentes activos</dt><dd>{data.facts.filter((item) => item.status === "active").length}</dd></div>
            <div><dt>Documentos</dt><dd>{data.documents.length}</dd></div>
            <div><dt>Laboratorios</dt><dd>{data.laboratory.panels.length}</dd></div>
            <div><dt>Datos de dispositivos</dt><dd>{deviceObservations.length}</dd></div>
          </dl>
        </article>
      </section>

      <section className="surface recent-surface">
        <div className="section-heading">
          <div><p className="eyebrow">ÚLTIMOS CAMBIOS</p><h2>Línea de tiempo</h2></div>
          <span>{data.history.length} registros</span>
        </div>
        {data.history.length ? (
          <div className="compact-timeline">
            {data.history.slice(0, 5).map((event) => (
              <article key={`${event.category}:${event.id}`}>
                <span className={`event-dot type-${event.type}`} />
                <div><strong>{event.title}</strong><p>{event.description || "Sin observaciones adicionales."}</p><small>{sourceLabel(event.source_type, event.verification_status)}</small></div>
                <time>{formatDate(event.effective_at)}</time>
              </article>
            ))}
          </div>
        ) : <EmptyState icon="timeline" title="Tu línea de tiempo comienza acá" text="Cada registro o documento quedará relacionado con su fecha y su fuente." />}
      </section>
    </div>
  );
}

function MetricCard({ icon, tone, label, value, detail }: { icon: string; tone: string; label: string; value: string; detail: string }) {
  return <article className={`metric-card tone-${tone}`}><span className="metric-icon"><Icon name={icon} /></span><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></article>;
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="chart-empty">Se necesitan dos registros para mostrar una tendencia.</div>;
  const points = linePoints(values);
  return <svg className="sparkline" viewBox="0 0 320 82" preserveAspectRatio="none" aria-label="Gráfico de tendencia"><path className="chart-grid" d="M0 20H320M0 42H320M0 64H320"/><polyline points={points} fill="none" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke"/></svg>;
}

function DualSparkline({ high, low }: { high: number[]; low: number[] }) {
  if (high.length < 2) return <div className="chart-empty">Se necesitan dos registros para mostrar una tendencia.</div>;
  const all = [...high, ...low];
  return <svg className="sparkline" viewBox="0 0 320 82" preserveAspectRatio="none" aria-label="Gráfico de presión sistólica y diastólica"><path className="chart-grid" d="M0 20H320M0 42H320M0 64H320"/><polyline points={linePoints(high, Math.min(...all), Math.max(...all))} fill="none" stroke="var(--terracotta)" strokeWidth="3" vectorEffect="non-scaling-stroke"/><polyline points={linePoints(low, Math.min(...all), Math.max(...all))} fill="none" stroke="var(--water-blue)" strokeWidth="3" vectorEffect="non-scaling-stroke"/></svg>;
}

function linePoints(values: number[], minValue = Math.min(...values), maxValue = Math.max(...values)) {
  const span = maxValue - minValue || 1;
  return values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * 320},${72 - ((value - minValue) / span) * 60}`).join(" ");
}

export function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div className="empty-state"><span><Icon name={icon} size={30} /></span><strong>{title}</strong><p>{text}</p></div>;
}

function number(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value);
}

function deviceLabel(code: string) {
  return ({
    heart_rate_bpm: "Frecuencia cardíaca", resting_heart_rate_bpm: "Pulso en reposo",
    hrv_ms: "Variabilidad cardíaca", steps: "Pasos", spo2_percent: "Oxígeno", stress_score: "Estrés",
    sleep_duration_minutes: "Sueño", sleep_quality_score: "Calidad de sueño", weight_kg: "Peso",
    systolic_blood_pressure_mmhg: "Presión sistólica", diastolic_blood_pressure_mmhg: "Presión diastólica",
  } as Record<string, string>)[code] || code.replaceAll("_", " ");
}
