import {
  authorizeClinicalRequest,
  cleanText,
  jsonResponse,
  sameOrigin,
  unauthorizedResponse,
  writeAudit,
} from "@/db/clinical";
import {
  getProviderConfigurationSummary,
  saveProviderConfiguration,
} from "@/db/provider-config";

const INTERVALS_PROVIDER = "intervals_icu";

async function adminContext(request: Request) {
  const context = await authorizeClinicalRequest(request, ["health.read"]);
  return context?.isGlobalAdmin ? context : null;
}

export async function GET(request: Request) {
  const context = await adminContext(request);
  if (!context) return unauthorizedResponse("admin.read", request);
  return jsonResponse({ providers: [await getProviderConfigurationSummary(INTERVALS_PROVIDER)] });
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return jsonResponse({ error: "Solicitud no permitida." }, { status: 403 });
  const context = await adminContext(request);
  if (!context) return unauthorizedResponse("admin.write", request);

  const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
  const provider = cleanText(payload.provider, 60);
  const clientId = cleanText(payload.clientId, 200);
  const clientSecret = typeof payload.clientSecret === "string" ? payload.clientSecret.trim() : "";

  if (provider !== INTERVALS_PROVIDER) {
    return jsonResponse({ error: "Proveedor no permitido." }, { status: 400 });
  }
  if (!clientId || clientId.length > 200) {
    return jsonResponse({ error: "Ingresá el OAuth Client ID de Intervals.icu." }, { status: 400 });
  }
  if (clientSecret.length < 12 || clientSecret.length > 500 || /[\u0000-\u001F\u007F]/.test(clientSecret)) {
    return jsonResponse({ error: "El secreto no tiene un formato válido." }, { status: 400 });
  }

  try {
    const configuration = await saveProviderConfiguration(
      provider,
      clientId,
      clientSecret,
      context.userId,
    );
    await writeAudit(context, "provider_configured", "integration_provider", provider, {
      source: provider,
      status: "configured",
    });
    return jsonResponse({ ok: true, configuration });
  } catch {
    await writeAudit(context, "provider_configuration_failed", "integration_provider", provider, {
      source: provider,
      status: "failed",
    }, "failed");
    return jsonResponse({ error: "No pudimos guardar la configuración cifrada." }, { status: 503 });
  }
}
