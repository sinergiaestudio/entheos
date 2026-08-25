import { Icon } from "@/components/icons";
import { BrandMark } from "@/components/brand-mark";
import Link from "next/link";
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const user = await getChatGPTUser();

  return (
    <main className="public-landing">
      <nav className="landing-nav" aria-label="Navegación de portada">
        <a className="landing-brand" href="#inicio" aria-label="Entheos, inicio">
          <BrandMark />
          <span><strong>Entheos</strong><small>Tu salud en contexto</small></span>
        </a>
        <div className="landing-nav-links"><a href="#organiza">Qué organiza</a><a href="#funciona">Cómo funciona</a><a href="#integraciones">Integraciones</a></div>
        {user ? <Link className="landing-nav-action" href="/app">Ir a mi espacio</Link> : <a className="landing-nav-action" href={chatGPTSignInPath("/app")}>Ingresar</a>}
      </nav>

      <section className="landing-hero" id="inicio">
        <div className="landing-copy">
          <p className="eyebrow">TU SALUD, ORDENADA Y CON FUENTE</p>
          <h1>Una historia clínica que podés comprender y llevar con vos.</h1>
          <p className="landing-lead">Reuní mediciones, hábitos, laboratorios y documentos en un solo lugar. Cada dato conserva su fecha, procedencia y estado de validación.</p>
          <div className="landing-access-card">
            {user ? (
              <>
                <span className="landing-avatar">{initials(user.displayName)}</span>
                <div><small>Cuenta reconocida</small><strong>{user.displayName}</strong><span>{user.isGlobalAdmin ? "Administrador global" : "Espacio personal"}</span></div>
                <Link className="primary-action" href="/app"><Icon name="shield" size={18} /> Continuar</Link>
                <a className="quiet-link" href={chatGPTSignOutPath("/")}>No soy {firstName(user.displayName)}</a>
              </>
            ) : (
              <>
                <span className="landing-access-icon"><Icon name="shield" size={25} /></span>
                <div><small>Acceso protegido</small><strong>Ingresá con tu cuenta de ChatGPT</strong><span>No creamos ni guardamos otra contraseña.</span></div>
                <a className="primary-action" href={chatGPTSignInPath("/app")}><Icon name="shield" size={18} /> Ingresar con ChatGPT</a>
              </>
            )}
          </div>
          <p className="landing-fineprint"><Icon name="check" size={16} /> Cada familiar necesita su propia cuenta de ChatGPT y sólo puede ver su espacio. <Link href="/privacy">Privacidad</Link></p>
        </div>

        <div className="landing-preview" aria-label="Vista resumida de la aplicación">
          <div className="preview-top"><span>Resumen personal</span><b>Actualizado</b></div>
          <div className="preview-person"><span className="preview-heart"><Icon name="heart" size={24} /></span><div><small>Historia clínica</small><strong>Todo en contexto</strong></div></div>
          <div className="preview-metrics">
            <article><Icon name="heart" size={18} /><span>Presión</span><strong>Historial</strong><i /></article>
            <article><Icon name="spark" size={18} /><span>Laboratorio</span><strong>Tendencias</strong><i /></article>
            <article><Icon name="activity" size={18} /><span>Integraciones</span><strong>Con fuente</strong><i /></article>
          </div>
          <div className="preview-document"><Icon name="document" size={22} /><div><strong>Documentos y estudios</strong><small>Originales privados y organizados</small></div><span>→</span></div>
        </div>
      </section>

      <section className="landing-principles" id="organiza">
        <article><span><Icon name="timeline" /></span><h2>Historial sintético</h2><p>Tablas, filtros y exportaciones pensados para miles de registros.</p></article>
        <article><span><Icon name="document" /></span><h2>Originales vinculados</h2><p>Estudios, resultados y archivos conservan la relación con su fuente.</p></article>
        <article><span><Icon name="shield" /></span><h2>Separación por persona</h2><p>La identidad de ChatGPT abre únicamente el espacio de esa cuenta.</p></article>
      </section>

      <section className="landing-how" id="funciona">
        <div className="landing-section-copy"><p className="eyebrow">UN RECORRIDO SIMPLE</p><h2>Registrar, reunir y comprender.</h2><p>Entheos no reemplaza el criterio profesional. Ordena la información para que puedas verla completa, reconocer tendencias y compartir un informe claro.</p></div>
        <ol>
          <li><b>1</b><div><strong>Ingresá con ChatGPT</strong><span>No hay otra contraseña ni una lista pública de usuarios.</span></div></li>
          <li><b>2</b><div><strong>Sumá datos y documentos</strong><span>Cada registro conserva fecha, fuente y estado de validación.</span></div></li>
          <li><b>3</b><div><strong>Consultá tu historia</strong><span>Tablas, filtros, tendencias y exportaciones en un mismo espacio.</span></div></li>
        </ol>
      </section>

      <section className="landing-integration" id="integraciones">
        <div className="landing-integration-mark"><span>Z</span><i>→</i><span>icu</span><i>→</i><BrandMark /></div>
        <div><p className="eyebrow">INTEGRACIONES CON TRAZABILIDAD</p><h2>Zepp llega a Entheos a través de Intervals.icu.</h2><p>La autorización es individual y de sólo lectura. Entheos conserva la fuente original, evita duplicados y permite desconectar el servicio cuando quieras.</p></div>
        <Link className="secondary-action" href="/privacy">Cómo protegemos tus datos</Link>
      </section>

      <footer className="landing-footer"><a className="landing-brand" href="#inicio"><BrandMark compact /><span><strong>Entheos</strong><small>Tu salud en contexto</small></span></a><p>Organización personal de salud. No realiza diagnósticos ni reemplaza atención profesional.</p><nav aria-label="Información legal"><Link href="/privacy">Privacidad</Link><Link href="/terms">Términos</Link><a href="#inicio">Volver arriba</a></nav></footer>
    </main>
  );
}

function initials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || "esta persona";
}
