"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardScreen } from "./dashboard-screen";
import { RegisterScreen } from "./register-screen";
import { DocumentsScreen, TimelineScreen } from "./timeline-documents";
import { MoreScreen } from "./more-screen";
import { AdminScreen } from "./admin-screen";
import { Icon } from "./icons";
import { BrandMark } from "./brand-mark";
import type { Overview } from "./health-types";
import {
  cachePrivateSnapshot,
  flushPrivateQueue,
  loadPrivateSnapshot,
  queuedRequestCount,
  queuePrivateRequest,
} from "@/lib/offline";

type Tab = "home" | "register" | "timeline" | "documents" | "more" | "admin";

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "Inicio", icon: "home" },
  { id: "register", label: "Registrar", icon: "plus" },
  { id: "timeline", label: "Historia", icon: "timeline" },
  { id: "documents", label: "Documentos", icon: "document" },
  { id: "more", label: "Más", icon: "menu" },
];

export function HealthApp({ displayName, identityKey, isGlobalAdmin, initialIntegrationResult = null }: { displayName: string; identityKey: string; isGlobalAdmin: boolean; initialIntegrationResult?: string | null }) {
  const [tab, setTab] = useState<Tab>(initialIntegrationResult ? "more" : "home");
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [queued, setQueued] = useState(0);
  const [notice, setNotice] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const saved = localStorage.getItem("mi-salud:theme:v11");
    return saved === "dark" ? "dark" : "light";
  });
  const [migration, setMigration] = useState<{ available: boolean; profileName?: string; incompleteAttempt?: boolean } | null>(null);
  const [migrating, setMigrating] = useState(false);

  const notify = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => current === message ? "" : current), 4200);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/health/overview", { cache: "no-store" });
      if (response.status === 401) { window.location.assign("/signin-with-chatgpt?return_to=/app"); return; }
      if (!response.ok) throw new Error("No pudimos cargar la historia clínica.");
      const overview = normalizeOverview(await response.json() as Overview);
      setData(overview);
      setOffline(false);
      await cachePrivateSnapshot(identityKey, overview);
    } catch {
      const cached = await loadPrivateSnapshot<Overview>(identityKey).catch(() => null);
      if (cached) { setData(normalizeOverview(cached)); setOffline(true); }
      else notify("No pudimos abrir la historia clínica. Revisá la conexión e intentá nuevamente.");
    } finally {
      setLoading(false);
      setQueued(await queuedRequestCount(identityKey).catch(() => 0));
    }
  }, [identityKey, notify]);

  const checkMigration = useCallback(async () => {
    try {
      const response = await fetch("/api/health/migrate", { cache: "no-store" });
      if (response.ok) setMigration(await response.json() as { available: boolean; profileName?: string; incompleteAttempt?: boolean });
    } catch { /* Migration discovery is non-blocking. */ }
  }, []);

  const recoverBaseline = useCallback(async () => {
    try {
      const response = await fetch("/api/health/recover-baseline", { method: "POST" });
      const result = await response.json() as { recovered?: boolean };
      if (response.ok && result.recovered) {
        notify("Recuperamos tu fecha de inicio, altura y peso base del seguimiento anterior.");
        await refresh();
      }
    } catch { /* La recuperación es idempotente y se reintentará en el próximo ingreso. */ }
  }, [notify, refresh]);

  useEffect(() => {
    const startup = window.setTimeout(() => {
      void refresh();
      void checkMigration();
      void recoverBaseline();
    }, 0);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(
          registrations
            .filter((registration) => new URL(registration.scope).pathname.startsWith("/app/"))
            .map((registration) => registration.unregister()),
        ))
        .then(() => navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }))
        .catch(() => undefined);
    }
    const onlineHandler = async () => {
      const result = await flushPrivateQueue(identityKey).catch(() => ({ completed: 0, remaining: 0 }));
      setQueued(result.remaining);
      if (result.completed) notify(`${result.completed} registro${result.completed === 1 ? "" : "s"} pendiente${result.completed === 1 ? "" : "s"} sincronizado${result.completed === 1 ? "" : "s"}.`);
      await refresh();
    };
    const offlineHandler = () => setOffline(true);
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    return () => {
      window.clearTimeout(startup);
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
    };
  }, [checkMigration, identityKey, notify, recoverBaseline, refresh]);

  useEffect(() => {
    if (!initialIntegrationResult) return;
    const messages: Record<string, string> = {
      connected: "Intervals.icu quedó conectado y realizó la primera actualización.",
      "connected-partial": "Intervals.icu quedó conectado; una categoría se actualizará en el próximo intento.",
      "connected-sync-pending": "Intervals.icu quedó conectado. Tocá Actualizar ahora para recibir los primeros datos.",
      cancelled: "La autorización fue cancelada; no se realizó ningún cambio.",
      expired: "La autorización venció. Podés volver a iniciar el vínculo.",
      failed: "No pudimos completar la autorización de Intervals.icu.",
      "invalid-callback": "Intervals.icu devolvió una autorización incompleta.",
      "registration-required": "Entheos todavía espera la habilitación OAuth de Intervals.icu.",
    };
    window.history.replaceState({}, "", "/app");
    const timer = window.setTimeout(() => {
      notify(messages[initialIntegrationResult] || "Revisá el estado de Intervals.icu.");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialIntegrationResult, notify]);

  async function saveRecord(payload: Record<string, unknown>) {
    if (!navigator.onLine) {
      await queuePrivateRequest(identityKey, "/api/health/record", payload);
      setQueued(await queuedRequestCount(identityKey));
      setOffline(true);
      notify("Registro guardado en este dispositivo. Se sincronizará al recuperar conexión.");
      return true;
    }
    try {
      const response = await fetch("/api/health/record", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string };
      if (!response.ok) { notify(result.error || "No pudimos guardar el registro."); return false; }
      notify("Registro guardado con su fecha y procedencia.");
      await refresh();
      return true;
    } catch {
      await queuePrivateRequest(identityKey, "/api/health/record", payload);
      setQueued(await queuedRequestCount(identityKey));
      setOffline(true);
      notify("La conexión se interrumpió; el registro quedó pendiente de sincronización.");
      return true;
    }
  }

  async function migrateLegacy(legacyPassword: string) {
    setMigrating(true);
    const response = await fetch("/api/health/migrate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ legacyPassword }),
    });
    const result = await response.json() as { importedDays?: number; error?: string };
    if (response.ok) {
      notify(`Seguimiento anterior integrado: ${result.importedDays || 0} días recuperados.`);
      setMigration({ available: false });
      await refresh();
    } else notify(result.error || "No pudimos integrar el seguimiento anterior.");
    setMigrating(false);
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("mi-salud:theme:v11", next);
  }

  return (
    <div className="health-app" data-theme={theme}>
      <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"} title={theme === "dark" ? "Modo claro" : "Modo oscuro"}>
        <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
      </button>
      <header className="app-header">
        <button type="button" className="brand" onClick={() => setTab("home")} aria-label="Ir al inicio">
          <BrandMark />
          <span><strong>Entheos</strong><small>Tu salud en contexto</small></span>
        </button>
        <div className="header-state">
          <span className={`sync-state ${offline ? "offline" : "online"}`}><i />{offline ? "Sin conexión" : "Privado y sincronizado"}{queued ? ` · ${queued} pendiente${queued === 1 ? "" : "s"}` : ""}</span>
          <span className="user-chip">{initials(data?.profile?.display_name || displayName)}</span>
        </div>
      </header>
      <aside className="desktop-nav" aria-label="Navegación principal">
        {tabs.map((item) => <NavButton key={item.id} item={item} active={tab === item.id} onClick={() => setTab(item.id)} />)}
        {isGlobalAdmin && <NavButton item={{ id: "admin", label: "Admin", icon: "shield" }} active={tab === "admin"} onClick={() => setTab("admin")} />}
      </aside>
      <main className="app-main">
        {loading && !data ? <LoadingScreen /> : data ? (
          <>
            {tab === "home" && <DashboardScreen data={data} onRegister={() => setTab("register")} migration={migration} onMigrate={(password) => void migrateLegacy(password)} migrating={migrating} />}
            {tab === "register" && <RegisterScreen saveRecord={saveRecord} />}
            {tab === "timeline" && <TimelineScreen events={data.history} onChanged={refresh} notify={notify} />}
            {tab === "documents" && <DocumentsScreen documents={data.documents} onChanged={refresh} notify={notify} />}
            {tab === "more" && <MoreScreen data={data} saveRecord={saveRecord} onChanged={refresh} notify={notify} initialView={initialIntegrationResult ? "integrations" : undefined} />}
            {tab === "admin" && isGlobalAdmin && <AdminScreen notify={notify} />}
          </>
        ) : <ErrorScreen onRetry={() => void refresh()} />}
      </main>
      <button type="button" className="register-fab" onClick={() => setTab("register")} aria-label="Registrar un dato"><Icon name="plus" size={23} /><span>Registrar</span></button>
      <nav className="bottom-nav" aria-label="Navegación principal">
        {tabs.map((item) => <NavButton key={item.id} item={item} active={tab === item.id} onClick={() => setTab(item.id)} />)}
        {isGlobalAdmin && <NavButton item={{ id: "admin", label: "Admin", icon: "shield" }} active={tab === "admin"} onClick={() => setTab("admin")} />}
      </nav>
      {notice && <div className="toast" role="status"><Icon name="check" size={18} /><span>{notice}</span></div>}
    </div>
  );
}

function NavButton({ item, active, onClick }: { item: { id: Tab; label: string; icon: string }; active: boolean; onClick: () => void }) {
  return <button type="button" className={active ? "active" : ""} aria-current={active ? "page" : undefined} onClick={onClick}><Icon name={item.icon} /><span>{item.label}</span></button>;
}

function LoadingScreen() {
  return <div className="loading-screen"><BrandMark pulse /><strong>Preparando tu historia clínica…</strong><p>Verificando identidad y recuperando tus datos privados.</p></div>;
}

function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return <div className="loading-screen"><Icon name="shield" size={42} /><strong>No pudimos abrir tu espacio</strong><p>No se cargó información clínica en esta pantalla.</p><button type="button" className="primary-action" onClick={onRetry}>Volver a intentar</button></div>;
}

function initials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function normalizeOverview(overview: Overview): Overview {
  return { ...overview, user: { ...overview.user, isGlobalAdmin: Boolean(overview.user?.isGlobalAdmin) }, devices: overview.devices || { observations: [], connection: null } };
}
