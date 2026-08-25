import type { Metadata } from "next";
import { HealthConnectLaunch } from "@/components/health-connect-launch";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conectar Health Connect · Entheos",
  robots: { index: false, follow: false },
};

export default async function HealthConnectLaunchPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[]; mode?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawCode = typeof params.code === "string" ? params.code : "";
  const normalizedCode = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const formattedCode = normalizedCode.length === 8 ? `${normalizedCode.slice(0, 4)}-${normalizedCode.slice(4)}` : "";
  const requestedMode = typeof params.mode === "string" ? params.mode : "";
  const mode = formattedCode ? "pair" : requestedMode === "sync" ? "sync" : requestedMode === "permissions" ? "permissions" : "invalid";
  const deepLink = mode === "pair"
    ? `entheos://pair?code=${encodeURIComponent(formattedCode)}`
    : mode === "sync"
      ? "entheos://sync"
      : mode === "permissions"
        ? "entheos://permissions"
        : null;

  return <HealthConnectLaunch deepLink={deepLink} mode={mode} supportCode={formattedCode || undefined} />;
}
