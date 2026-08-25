import { HealthApp } from "@/components/health-app";
import { ensureClinicalIdentity } from "@/db/clinical";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function PrivateHealthPage({
  searchParams,
}: {
  searchParams: Promise<{ integration?: string | string[]; result?: string | string[] }>;
}) {
  const params = await searchParams;
  const integrationResult = params.integration === "intervals" && typeof params.result === "string"
    ? params.result
    : null;
  const user = await requireChatGPTUser("/app");
  const identity = await ensureClinicalIdentity(user.email, user.displayName);
  if (!identity) redirect("/?access=suspended");
  const identityKey = await clientIdentityKey(user.email);

  return <HealthApp displayName={user.displayName} identityKey={identityKey} isGlobalAdmin={user.isGlobalAdmin} initialIntegrationResult={integrationResult} />;
}

async function clientIdentityKey(email: string) {
  const bytes = new TextEncoder().encode(email.trim().toLocaleLowerCase("en-US"));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
