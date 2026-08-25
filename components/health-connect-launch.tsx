"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "./icons";
import { BrandMark } from "./brand-mark";

export function HealthConnectLaunch({
  deepLink,
  mode,
  supportCode,
}: {
  deepLink: string | null;
  mode: "pair" | "sync" | "permissions" | "invalid";
  supportCode?: string;
}) {
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!deepLink) return;
    if (supportCode && window.location.search) window.history.replaceState({}, "", window.location.pathname);
    const launch = window.setTimeout(() => {
      setAttempted(true);
      window.location.assign(deepLink);
    }, 280);
    return () => window.clearTimeout(launch);
  }, [deepLink, supportCode]);

  const copy = mode === "pair"
    ? { title: "Conectando este teléfono", text: "Entheos se abrirá y asociará el teléfono con tu cuenta. Después Android mostrará los permisos de Health Connect." }
    : mode === "permissions"
      ? { title: "Abriendo los permisos", text: "Entheos se abrirá para que elijas qué datos puede leer desde Health Connect." }
      : mode === "sync"
        ? { title: "Preparando la actualización", text: "Entheos se abrirá y actualizará tu historial con los datos autorizados." }
        : { title: "Este acceso ya no es válido", text: "Volvé a Integraciones e iniciá la conexión nuevamente. No se modificó ningún dato." };

  return <main className="health-launch-page"><section className="health-launch-card"><div className="health-launch-brand"><BrandMark /><span><strong>Entheos</strong><small>Health Connect</small></span></div><div className={`health-launch-icon ${mode === "invalid" ? "error" : ""}`}><Icon name={mode === "invalid" ? "close" : "activity"} size={34} /></div><h1>{copy.title}</h1><p>{copy.text}</p>{deepLink ? <><button className="primary-action health-launch-button" type="button" onClick={() => window.location.assign(deepLink)}><Icon name="activity" size={19} /> Abrir Entheos</button><small className="health-launch-hint">{attempted ? "Si la app no se abrió automáticamente, tocá el botón." : "Intentando abrir la app…"}</small><a className="health-launch-install" href="/downloads/entheos-android-prueba-v1.0.3.apk" download><Icon name="download" size={16} /> ¿No está instalada? Descargar Entheos 1.0.3</a></> : <Link className="primary-action health-launch-button" href="/app"><Icon name="settings" size={19} /> Volver a Integraciones</Link>}{supportCode && <details className="health-launch-support"><summary>Ayuda técnica</summary><p>La apertura automática transporta una credencial temporal. Sólo si soporte te la solicita, el código es:</p><code>{supportCode}</code><p>Vence en pocos minutos y no es tu contraseña.</p></details>}<Link className="quiet-link health-launch-back" href="/app">Volver a mi espacio</Link></section></main>;
}
