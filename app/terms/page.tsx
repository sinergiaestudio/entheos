import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export const metadata: Metadata = {
  title: "Términos de uso",
  description: "Condiciones de uso de Entheos, una herramienta personal para organizar información de salud.",
};

export default function TermsPage() {
  return <main className="privacy-page"><article className="privacy-document">
    <Link className="landing-brand" href="/" aria-label="Volver a Entheos"><BrandMark /><span><strong>Entheos</strong><small>Tu salud en contexto</small></span></Link>
    <p className="eyebrow">TÉRMINOS DE USO</p>
    <h1>Una herramienta personal, no un servicio médico.</h1>
    <p className="privacy-lead">Al utilizar Entheos aceptás estas condiciones básicas, pensadas para proteger a cada persona y mantener claro el alcance de la aplicación.</p>
    <section><h2>Finalidad</h2><p>Entheos permite registrar, importar, ordenar y exportar información personal de salud. No diagnostica, no prescribe tratamientos y no sustituye una consulta médica, nutricional ni de emergencia.</p></section>
    <section><h2>Acceso e identidad</h2><p>El acceso utiliza una cuenta de ChatGPT. Cada identidad abre un espacio independiente. Sos responsable de proteger esa cuenta y de cerrar sesión en dispositivos compartidos.</p></section>
    <section><h2>Calidad de la información</h2><p>Los datos pueden provenir de carga manual, documentos o servicios externos. Entheos conserva la fuente y el estado de validación, pero la persona usuaria debe revisar la exactitud antes de tomar decisiones o compartir un informe.</p></section>
    <section><h2>Integraciones</h2><p>Las conexiones externas son opcionales y de sólo lectura cuando así se indica. Pueden interrumpirse, cambiar o entregar información incompleta. Desconectar una fuente revoca el acceso futuro sin alterar los datos ya incorporados.</p></section>
    <section><h2>Uso responsable</h2><p>No debés intentar acceder a espacios ajenos, interferir con el funcionamiento del servicio ni utilizar Entheos para almacenar contenido ilícito. La cuenta puede suspenderse ante abuso o riesgo operativo.</p></section>
    <section><h2>Disponibilidad y evolución</h2><p>Entheos se encuentra en evolución. Sus funciones pueden ajustarse para mejorar seguridad, claridad o compatibilidad. Antes de cambios importantes, conservá un respaldo exportado de tu información.</p></section>
    <section><h2>Privacidad</h2><p>El tratamiento de los datos, las exportaciones y las integraciones se explican en la <Link href="/privacy">política de privacidad</Link>.</p></section>
    <footer><span>Vigentes desde el 25 de agosto de 2026</span><Link href="/">Volver a Entheos</Link></footer>
  </article></main>;
}
