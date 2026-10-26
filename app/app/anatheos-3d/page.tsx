import type { Metadata } from "next";
import { AnatheosDicomBrowser } from "@/components/anatheos/dicom-browser";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ANATHEOS 3D — Piloto privado",
  description: "Área experimental privada de reconstrucción de imágenes médicas dentro de Entheos.",
  robots: { index: false, follow: false, noarchive: true },
};

const capabilities = [
  {
    step: "01",
    title: "Importación de estudios",
    detail: "Lector local inicial para DICOM Part 10 sin compresión, con geometría y agrupación de series.",
    status: "Implementación inicial, sin validación clínica",
  },
  {
    step: "02",
    title: "Reconstrucción multiplanar",
    detail: "Cortes axial y ortogonales para series alineadas con los ejes; renderizado volumétrico pendiente.",
    status: "Implementación limitada a series compatibles",
  },
  {
    step: "03",
    title: "Modelo anatómico 3D",
    detail: "Aislamiento opcional de estructuras y exportación de derivados, con referencia al estudio original.",
    status: "Pendiente de implementación",
  },
];

export default async function Anatheos3DOwnerPilotPage() {
  const user = await requireChatGPTUser("/app/anatheos-3d");

  // Fail closed: only the configured owner, never a generic authenticated user.
  if (!user.isGlobalAdmin) notFound();

  return (
    <main className="min-h-screen bg-[#f4f7f5] text-[#20342b]">
      <div className="mx-auto max-w-5xl px-5 py-10 md:py-14">
        <nav className="mb-9 flex items-center justify-between gap-4">
          <Link className="text-sm font-semibold text-[#446357] hover:underline" href="/app">
            ← Volver a Entheos
          </Link>
          <span className="rounded-full border border-[#c6d7cd] bg-white px-3 py-1 text-xs font-medium">
            Entorno privado · Experimental
          </span>
        </nav>

        <header className="mb-10 border-b border-[#cbd9d0] pb-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#527466]">
            Entheos / Laboratorio de imágenes
          </p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">ANATHEOS 3D</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#496356]">
            Plataforma experimental de reconstrucción médica tridimensional. Esta pantalla
            restringida al propietario. El piloto incluye un lector local limitado
            de cortes DICOM para exploración, sin renderizado volumétrico 3D todavía.
          </p>
        </header>

        <section aria-labelledby="estado" className="mb-10 rounded-2xl border border-[#cbd9d0] bg-white p-6">
          <h2 id="estado" className="text-lg font-semibold">Estado del piloto</h2>
          <p className="mt-2 text-sm leading-6 text-[#53675d]">
            Acceso autorizado para {user.displayName}. Los archivos seleccionados
            se procesan en la memoria del navegador y no se envían al servidor.
            Sin suscripciones ni API externas de pago.
          </p>
          <p className="mt-2 text-sm leading-6 text-[#53675d]">
            Próximo objetivo: validar la geometría y la visualización multiplanar
            con estudios públicos desidentificados, comparándolas con 3D Slicer.
          </p>
        </section>

        <div className="mb-10"><AnatheosDicomBrowser /></div>

        <section aria-labelledby="hoja-ruta">
          <h2 id="hoja-ruta" className="mb-4 text-xl font-semibold">Módulos previstos</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {capabilities.map((item) => (
              <article key={item.step} className="rounded-xl border border-[#d5e0d9] bg-white p-5">
                <div className="mb-5 text-xs font-bold tracking-widest text-[#517967]">{item.step}</div>
                <h3 className="mb-2 text-base font-semibold">{item.title}</h3>
                <p className="mb-5 text-sm leading-6 text-[#53675d]">{item.detail}</p>
                <span className="text-xs font-medium text-[#737c76]">{item.status}</span>
              </article>
            ))}
          </div>
        </section>

        <aside className="mt-10 rounded-xl border border-[#d5e0d9] p-5 text-sm leading-6 text-[#52685c]">
          Uso exploratorio. No apto para diagnóstico, interpretación clínica autónoma
          ni decisiones terapéuticas. Los estudios originales deben evaluarse por los
          profesionales tratantes.
        </aside>
      </div>
    </main>
  );
}
