import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://seguimiento-nutricional-marcelo.arielmarcelogomez7.chatgpt.site"),
  title: {
    default: "Entheos — Tu salud en contexto",
    template: "%s · Entheos",
  },
  description:
    "Espacio privado para organizar mediciones, documentos, hábitos y antecedentes con trazabilidad de fuentes.",
  applicationName: "Entheos",
  manifest: "/manifest.webmanifest",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "es_AR",
    title: "Entheos — Tu salud en contexto",
    description: "Tu historia de salud, actividad y estudios, ordenada con fecha, fuente y contexto.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Entheos — Tu salud en contexto" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Entheos — Tu salud en contexto",
    description: "Tu historia de salud, actividad y estudios, ordenada con fecha, fuente y contexto.",
    images: ["/og.png"],
  },
  icons: {
    icon: [
      { url: "/app/icon-64.png", sizes: "64x64", type: "image/png" },
      { url: "/app/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/app/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#14221d" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
