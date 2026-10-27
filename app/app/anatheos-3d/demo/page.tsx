import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "cloudflare:workers";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { isAnatheosPilotEnabled, isAnatheosOwner } from "@/lib/anatheos/owner-access";
import { AnatheosSiteDemoClient } from "@/components/anatheos/site-demo-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "ANATHEOS 3D · Preview DESS experimental",
  description: "Visor experimental de imágenes DICOM procesadas solo en el navegador.",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function AnatheosSitesPreviewPage() {
  // This route is NOT a public preview or a production release.
  // Keep OFF until trusted identity provenance and D1/R2 isolation are proven.
  if (!isAnatheosPilotEnabled(env.ANATHEOS_PILOT_ENABLED)) notFound();
  const user = await requireChatGPTUser("/app/anatheos-3d/demo");
  if (!isAnatheosOwner(user, env.APP_OWNER_EMAIL)) notFound();
  return <AnatheosSiteDemoClient />;
}
