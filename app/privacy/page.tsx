import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export const metadata: Metadata = {
  title: "Privacidad · Entheos",
  description: "Política de privacidad de Entheos y sus integraciones personales de salud.",
};

export default function PrivacyPage() {
  return <main className="privacy-page">
    <article className="privacy-document">
      <Link className="landing-brand" href="/" aria-label="Volver a Entheos">
        <BrandMark />
        <span><strong>Entheos</strong><small>Tu salud en contexto</small></span>
      </Link>
      <p className="eyebrow">PRIVACIDAD E INTEGRACIONES</p>
      <h1>Tu información sigue siendo tuya.</h1>
      <p className="privacy-lead">Entheos organiza información personal de salud para uso del titular. No vende datos, no los utiliza para publicidad y no formula diagnósticos.</p>

      <section><h2>Identidad y separación</h2><p>El acceso utiliza la identidad de ChatGPT. Cada cuenta abre un espacio independiente y las autorizaciones se aplican únicamente a esa persona.</p></section>
      <section><h2>Datos almacenados</h2><p>Podemos conservar registros ingresados por la persona, documentos que suba e información importada desde servicios que autorice. Cada elemento mantiene fecha, fuente y estado de validación.</p></section>
      <section><h2>Intervals.icu</h2><p>Cuando una persona vincula Intervals.icu, Entheos solicita acceso de sólo lectura a actividades y bienestar. La credencial de acceso se cifra antes de almacenarse. Entheos no modifica ni elimina datos de Zepp o Intervals.icu.</p></section>
      <section><h2>Revocación y conservación</h2><p>La conexión puede revocarse desde Integraciones. Al desconectar una fuente se elimina la credencial guardada; los registros ya incorporados se conservan para no fragmentar el historial, salvo que la persona decida eliminarlos o restaurar un respaldo anterior.</p></section>
      <section><h2>Exportación</h2><p>La persona puede exportar sus datos en formatos portables y conservar respaldos propios. Los documentos permanecen privados dentro de su espacio.</p></section>
      <section><h2>Consultas y eliminación</h2><p>Podés exportar tu información desde Informes y respaldos, eliminar registros individuales desde sus historiales y solicitar al administrador de Entheos la eliminación integral de tu espacio.</p></section>

      <footer><span>Última actualización: 25 de agosto de 2026</span><span><Link href="/terms">Términos</Link> · <Link href="/">Volver a Entheos</Link></span></footer>
    </article>
  </main>;
}
