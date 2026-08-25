"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Icon } from "./icons";
import type { SaveRecord } from "./health-types";
import { localDate, localDateTime } from "./health-types";

type RegisterKind = "weight" | "pressure" | "activity" | "sleep" | "symptom" | "nutrition" | "event";

const kinds: { id: RegisterKind; label: string; icon: string; help: string }[] = [
  { id: "weight", label: "Peso", icon: "weight", help: "Peso y cintura" },
  { id: "pressure", label: "Presión", icon: "heart", help: "Hasta 3 tomas" },
  { id: "activity", label: "Actividad", icon: "activity", help: "Movimiento" },
  { id: "sleep", label: "Sueño", icon: "moon", help: "Duración y calidad" },
  { id: "symptom", label: "Síntoma", icon: "spark", help: "Cómo te sentís" },
  { id: "nutrition", label: "Alimentación", icon: "nutrition", help: "Seguimiento diario" },
  { id: "event", label: "Nota", icon: "timeline", help: "Otro evento" },
];

export function RegisterScreen({ saveRecord }: { saveRecord: SaveRecord }) {
  const [kind, setKind] = useState<RegisterKind>("weight");
  const [busy, setBusy] = useState(false);

  async function submit(payload: Record<string, unknown>, form: HTMLFormElement) {
    setBusy(true);
    const saved = await saveRecord(payload);
    setBusy(false);
    if (saved) form.reset();
  }

  return (
    <div className="screen-stack register-page">
      <section className="screen-intro">
        <p className="eyebrow">REGISTRO RÁPIDO</p>
        <h1>¿Qué querés registrar?</h1>
        <p>Elegí una opción. Todo lo que cargues quedará marcado como declarado por vos.</p>
      </section>
      <div className="register-kinds" role="tablist" aria-label="Tipos de registro">
        {kinds.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={kind === item.id} className={kind === item.id ? "active" : ""} onClick={() => setKind(item.id)}>
            <span><Icon name={item.icon} /></span><strong>{item.label}</strong><small>{item.help}</small>
          </button>
        ))}
      </div>
      <section className="surface form-surface">
        {kind === "weight" && <WeightForm busy={busy} onSubmit={submit} />}
        {kind === "pressure" && <PressureForm busy={busy} onSubmit={submit} />}
        {kind === "activity" && <ActivityForm busy={busy} onSubmit={submit} />}
        {kind === "sleep" && <SleepForm busy={busy} onSubmit={submit} />}
        {kind === "symptom" && <SymptomForm busy={busy} onSubmit={submit} />}
        {kind === "nutrition" && <NutritionForm busy={busy} onSubmit={submit} />}
        {kind === "event" && <EventForm busy={busy} onSubmit={submit} />}
      </section>
      <p className="form-footnote"><Icon name="shield" size={17} /> Esta herramienta registra y organiza información; no diagnostica ni modifica indicaciones profesionales.</p>
    </div>
  );
}

type FormProps = { busy: boolean; onSubmit: (payload: Record<string, unknown>, form: HTMLFormElement) => Promise<void> };

function WeightForm({ busy, onSubmit }: FormProps) {
  const handle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void onSubmit({ kind: "weight", effectiveAt: isoDateTime(data.get("effectiveAt")), weightKg: data.get("weightKg"), waistCm: data.get("waistCm"), scale: data.get("scale"), conditions: data.get("conditions") }, form);
  };
  return <form onSubmit={handle}><FormHeading icon="weight" title="Peso y medidas" text="La tendencia vale más que una medición aislada." /><div className="form-grid"><Field label="Fecha y hora"><input name="effectiveAt" type="datetime-local" defaultValue={localDateTime()} required /></Field><Field label="Peso" suffix="kg"><input name="weightKg" type="number" min="20" max="400" step="0.01" inputMode="decimal" required placeholder="Ej.: 80,5" /></Field><Field label="Cintura" suffix="cm" optional><input name="waistCm" type="number" min="30" max="250" step="0.1" inputMode="decimal" /></Field><Field label="Balanza" optional><input name="scale" maxLength={80} placeholder="Ej.: balanza de casa" /></Field><Field label="Condiciones de medición" optional wide><textarea name="conditions" rows={3} placeholder="Ayuno, ropa liviana, luego de entrenar…" /></Field></div><SubmitButton busy={busy} label="Guardar peso" /></form>;
}

function PressureForm({ busy, onSubmit }: FormProps) {
  const handle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const readings = [1, 2, 3].map((number) => ({ systolic: data.get(`s${number}`), diastolic: data.get(`d${number}`), pulse: data.get(`p${number}`), arm: data.get("arm"), position: data.get("position"), context: data.get("context") })).filter((item) => item.systolic && item.diastolic);
    void onSubmit({ kind: "blood_pressure", effectiveAt: isoDateTime(data.get("effectiveAt")), readings }, form);
  };
  return <form onSubmit={handle}><FormHeading icon="heart" title="Presión arterial" text="Podés registrar una, dos o tres tomas consecutivas; calcularemos el promedio sin interpretarlo clínicamente." /><div className="form-grid"><Field label="Fecha y hora" wide><input name="effectiveAt" type="datetime-local" defaultValue={localDateTime()} required /></Field></div><div className="pressure-table"><div className="pressure-head"><span>Toma</span><span>Sistólica</span><span>Diastólica</span><span>Pulso</span></div>{[1, 2, 3].map((number) => <div className="pressure-row" key={number}><strong>{number}</strong><label><input aria-label={`Sistólica toma ${number}`} name={`s${number}`} type="number" min="60" max="260" inputMode="numeric" required={number === 1} /><small>mmHg</small></label><label><input aria-label={`Diastólica toma ${number}`} name={`d${number}`} type="number" min="30" max="180" inputMode="numeric" required={number === 1} /><small>mmHg</small></label><label><input aria-label={`Pulso toma ${number}`} name={`p${number}`} type="number" min="25" max="250" inputMode="numeric" /><small>lpm</small></label></div>)}</div><div className="form-grid compact"><Field label="Brazo" optional><select name="arm" defaultValue=""><option value="">Sin especificar</option><option>Izquierdo</option><option>Derecho</option></select></Field><Field label="Posición" optional><select name="position" defaultValue="sentado"><option value="sentado">Sentado</option><option value="acostado">Acostado</option><option value="de pie">De pie</option></select></Field><Field label="Contexto" optional wide><input name="context" maxLength={120} placeholder="Reposo, estrés, ejercicio, comida, cafeína…" /></Field></div><SubmitButton busy={busy} label="Guardar mediciones" /></form>;
}

function ActivityForm({ busy, onSubmit }: FormProps) {
  const handle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void onSubmit({ kind: "activity", effectiveAt: isoDateTime(data.get("effectiveAt")), activityType: data.get("activityType"), durationMinutes: data.get("durationMinutes"), distanceKm: data.get("distanceKm"), perceivedEffort: data.get("perceivedEffort"), recovery: data.get("recovery"), comments: data.get("comments") }, form);
  };
  return <form onSubmit={handle}><FormHeading icon="activity" title="Actividad física" text="Registrá la carga y tu percepción, sin necesidad de contar calorías." /><div className="form-grid"><Field label="Fecha y hora"><input name="effectiveAt" type="datetime-local" defaultValue={localDateTime()} required /></Field><Field label="Actividad"><input name="activityType" required maxLength={100} placeholder="Funcional, caminata, elíptica…" /></Field><Field label="Duración" suffix="min"><input name="durationMinutes" type="number" min="1" max="1440" inputMode="numeric" /></Field><Field label="Distancia" suffix="km" optional><input name="distanceKm" type="number" min="0" max="1000" step="0.01" inputMode="decimal" /></Field><Field label="Esfuerzo percibido" optional><select name="perceivedEffort" defaultValue=""><option value="">Sin dato</option>{[1,2,3,4,5,6,7,8,9,10].map((value) => <option key={value} value={value}>{value}/10</option>)}</select></Field><Field label="Recuperación" optional><input name="recovery" maxLength={200} placeholder="Buena, lenta, con molestias…" /></Field><Field label="Comentarios" optional wide><textarea name="comments" rows={3} /></Field></div><SubmitButton busy={busy} label="Guardar actividad" /></form>;
}

function SleepForm({ busy, onSubmit }: FormProps) {
  const handle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void onSubmit({
      kind: "sleep",
      effectiveAt: isoDateTime(data.get("wakeAt") || data.get("effectiveAt")),
      bedtimeAt: isoOptional(data.get("bedtimeAt")),
      wakeAt: isoOptional(data.get("wakeAt")),
      hours: data.get("hours"),
      quality: data.get("quality"),
      awakenings: data.get("awakenings"),
      notes: data.get("notes"),
    }, form);
  };
  return <form onSubmit={handle}><FormHeading icon="moon" title="Sueño" text="Podés registrar horarios o solamente la duración. La calidad es tu percepción, no una evaluación médica." /><div className="form-grid"><Field label="Fecha de referencia"><input name="effectiveAt" type="datetime-local" defaultValue={localDateTime()} required /></Field><Field label="Horas dormidas" suffix="h" optional><input name="hours" type="number" min="0" max="24" step="0.25" inputMode="decimal" /></Field><Field label="Hora de acostarte" optional><input name="bedtimeAt" type="datetime-local" /></Field><Field label="Hora de levantarte" optional><input name="wakeAt" type="datetime-local" /></Field><Field label="Calidad percibida" optional><ScaleSelect name="quality" /></Field><Field label="Despertares" optional><input name="awakenings" type="number" min="0" max="100" inputMode="numeric" /></Field><Field label="Observaciones" optional wide><textarea name="notes" rows={4} placeholder="Descanso, interrupciones, siesta, cambios de rutina…" /></Field></div><SubmitButton busy={busy} label="Guardar sueño" /></form>;
}

function SymptomForm({ busy, onSubmit }: FormProps) {
  const handle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void onSubmit({ kind: "symptom", effectiveAt: isoDateTime(data.get("effectiveAt")), title: data.get("title"), bodyArea: data.get("bodyArea"), intensity: data.get("intensity"), duration: data.get("duration"), frequency: data.get("frequency"), triggers: data.get("triggers"), associatedSymptoms: data.get("associatedSymptoms"), status: data.get("status"), notes: data.get("notes") }, form);
  };
  return <form onSubmit={handle}><FormHeading icon="spark" title="Síntoma o molestia" text="Describí lo observado. Si algo te preocupa o empeora, consultá a un profesional." /><div className="form-grid"><Field label="Inicio / registro"><input name="effectiveAt" type="datetime-local" defaultValue={localDateTime()} required /></Field><Field label="Síntoma"><input name="title" maxLength={160} required placeholder="Dolor, acidez, hinchazón…" /></Field><Field label="Zona" optional><input name="bodyArea" maxLength={100} /></Field><Field label="Intensidad"><select name="intensity" defaultValue=""><option value="">Sin puntuar</option>{[0,1,2,3,4,5,6,7,8,9,10].map((value) => <option key={value} value={value}>{value}/10</option>)}</select></Field><Field label="Duración" optional><input name="duration" maxLength={100} /></Field><Field label="Frecuencia" optional><input name="frequency" maxLength={100} /></Field><Field label="Estado"><select name="status" defaultValue="active"><option value="active">Activo</option><option value="improving">Mejorando</option><option value="resolved">Resuelto</option></select></Field><Field label="Desencadenantes" optional><input name="triggers" maxLength={500} /></Field><Field label="Síntomas asociados" optional wide><input name="associatedSymptoms" maxLength={500} /></Field><Field label="Observaciones" optional wide><textarea name="notes" rows={4} /></Field></div><SubmitButton busy={busy} label="Guardar síntoma" /></form>;
}

const meals = [
  ["breakfast", "06:30", "Desayuno"], ["midmorning", "09:00", "Media mañana"],
  ["lunch", "13:00", "Almuerzo"], ["drinks", "DÍA", "Bebidas"],
  ["snack", "17:00", "Merienda"], ["dinner", "21:00", "Cena"],
];

function NutritionForm({ busy, onSubmit }: FormProps) {
  const handle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void onSubmit({
      kind: "nutrition_day", date: data.get("date"), hydration: data.get("hydration"),
      sleepHours: data.get("sleepHours"), sleepQuality: data.get("sleepQuality"), energy: data.get("energy"),
      hungerAnxiety: data.get("hungerAnxiety"), digestion: data.get("digestion"), observations: data.get("observations"),
      meals: meals.map(([mealKey, timeLabel]) => ({ mealKey, timeLabel, status: data.get(`${mealKey}Status`), structure: data.get(`${mealKey}Structure`), foods: { description: data.get(`${mealKey}Foods`) }, notes: data.get(`${mealKey}Notes`) })),
    }, form);
  };
  return <form onSubmit={handle}><FormHeading icon="nutrition" title="Seguimiento nutricional" text="Priorizamos adherencia semanal sobre perfección diaria: constancia, hidratación y organización." /><div className="nutrition-top"><Field label="Fecha"><input name="date" type="date" defaultValue={localDate()} required /></Field><Field label="Hidratación"><select name="hydration" defaultValue=""><option value="">Sin dato</option><option value="1">Baja</option><option value="2">Media</option><option value="3">Buena</option><option value="4">Excelente</option></select></Field><Field label="Sueño" suffix="h" optional><input name="sleepHours" type="number" min="0" max="24" step="0.25" /></Field><Field label="Calidad del sueño" optional><ScaleSelect name="sleepQuality" /></Field><Field label="Energía" optional><ScaleSelect name="energy" /></Field><Field label="Hambre / ansiedad" optional><ScaleSelect name="hungerAnxiety" /></Field></div><div className="meal-list">{meals.map(([key, time, title]) => <article className="meal-entry" key={key}><div className="meal-title"><span>{time}</span><strong>{title}</strong></div><select aria-label={`Cumplimiento ${title}`} name={`${key}Status`} defaultValue=""><option value="">Sin registrar</option><option value="done">Cumplido</option><option value="partial">Parcial</option><option value="replaced">Reemplazado</option><option value="missed">No realizado</option></select>{(key === "lunch" || key === "dinner") && <select aria-label={`Combinación ${title}`} name={`${key}Structure`} defaultValue=""><option value="">Combinación</option><option value="P + V">P + V</option><option value="P + V + H">P + V + H</option><option value="H + V">H + V</option><option value="Sopa + V + P">Sopa + V + P</option><option value="Otro">Otro</option></select>}<input aria-label={`Alimentos ${title}`} name={`${key}Foods`} placeholder="Alimentos usados" maxLength={300} /><input aria-label={`Observaciones ${title}`} name={`${key}Notes`} placeholder="Observación" maxLength={500} /></article>)}</div><div className="phv-legend"><span className="p">P <small>Proteínas</small></span><span className="h">H <small>Hidratos</small></span><span className="v">V <small>Verduras</small></span></div><div className="form-grid compact"><Field label="Digestión" optional><select name="digestion" defaultValue=""><option value="">Sin dato</option><option>Normal</option><option>Pesada</option><option>Hinchazón</option><option>Acidez</option><option>Otro</option></select></Field><Field label="Observaciones del día" optional wide><textarea name="observations" rows={3} /></Field></div><SubmitButton busy={busy} label="Guardar día" /></form>;
}

function EventForm({ busy, onSubmit }: FormProps) {
  const handle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void onSubmit({ kind: "timeline", effectiveAt: isoDateTime(data.get("effectiveAt")), eventType: data.get("eventType"), title: data.get("title"), description: data.get("description"), relevance: data.get("relevance"), tags: data.get("tags") }, form);
  };
  return <form onSubmit={handle}><FormHeading icon="timeline" title="Nota o evento clínico" text="Para consultas, tratamientos, cambios relevantes u observaciones que quieras ubicar en el tiempo." /><div className="form-grid"><Field label="Fecha y hora"><input name="effectiveAt" type="datetime-local" defaultValue={localDateTime()} required /></Field><Field label="Tipo"><select name="eventType" defaultValue="note"><option value="note">Nota</option><option value="consultation">Consulta</option><option value="treatment">Tratamiento</option><option value="procedure">Procedimiento</option><option value="vaccination">Vacuna</option><option value="other">Otro</option></select></Field><Field label="Título" wide><input name="title" maxLength={200} required /></Field><Field label="Descripción" optional wide><textarea name="description" rows={5} /></Field><Field label="Relevancia"><select name="relevance" defaultValue="1"><option value="1">Habitual</option><option value="2">Importante</option><option value="3">Muy relevante</option></select></Field><Field label="Etiquetas" optional><input name="tags" placeholder="Separadas por comas" /></Field></div><SubmitButton busy={busy} label="Agregar a la línea de tiempo" /></form>;
}

function FormHeading({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div className="form-heading"><span><Icon name={icon} size={26} /></span><div><h2>{title}</h2><p>{text}</p></div></div>;
}

function Field({ label, suffix, optional, wide, children }: { label: string; suffix?: string; optional?: boolean; wide?: boolean; children: ReactNode }) {
  return <label className={`field ${wide ? "wide" : ""}`}><span>{label}{optional && <small>Opcional</small>}</span><div className={suffix ? "input-suffix" : ""}>{children}{suffix && <b>{suffix}</b>}</div></label>;
}

function ScaleSelect({ name }: { name: string }) {
  return <select name={name} defaultValue=""><option value="">Sin dato</option>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value}/5</option>)}</select>;
}

function SubmitButton({ busy, label }: { busy: boolean; label: string }) {
  return <button className="primary-action submit-action" type="submit" disabled={busy}><Icon name="check" size={19} /> {busy ? "Guardando…" : label}</button>;
}

function isoDateTime(value: FormDataEntryValue | null) {
  const text = String(value || "");
  return text && Number.isFinite(new Date(text).getTime()) ? new Date(text).toISOString() : new Date().toISOString();
}

function isoOptional(value: FormDataEntryValue | null) {
  const text = String(value || "");
  return text && Number.isFinite(new Date(text).getTime()) ? new Date(text).toISOString() : null;
}
