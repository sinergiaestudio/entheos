import { env } from "cloudflare:workers";

type ProviderConfigRow = {
  provider: string;
  client_id: string;
  client_secret_cipher: string;
  status: string;
  configured_at: string;
  updated_at: string;
};

export type ProviderCredentialState = {
  ready: boolean;
  clientId: string;
  clientSecret: string;
  source: "environment" | "database" | null;
};

export type ProviderConfigurationSummary = {
  provider: string;
  name: string;
  status: "configured" | "not_configured";
  clientIdHint: string | null;
  source: "environment" | "database" | null;
  configuredAt: string | null;
  scopes: string[];
};

const INTERVALS_PROVIDER = "intervals_icu";

export async function getProviderCredentials(provider: string): Promise<ProviderCredentialState> {
  if (provider !== INTERVALS_PROVIDER) return emptyCredentials();

  const environmentClientId = env.INTERVALS_CLIENT_ID?.trim() || "";
  const environmentClientSecret = env.INTERVALS_CLIENT_SECRET?.trim() || "";
  if (environmentClientId && environmentClientSecret && encryptionAvailable()) {
    return {
      ready: true,
      clientId: environmentClientId,
      clientSecret: environmentClientSecret,
      source: "environment",
    };
  }

  if (!env.DB || !encryptionAvailable()) return emptyCredentials();
  const row = await readProviderRow(provider);
  if (!row || row.status !== "active") return emptyCredentials();

  try {
    const clientSecret = await decryptProviderSecret(provider, row.client_secret_cipher);
    if (!row.client_id.trim() || !clientSecret) return emptyCredentials();
    return {
      ready: true,
      clientId: row.client_id.trim(),
      clientSecret,
      source: "database",
    };
  } catch {
    return emptyCredentials();
  }
}

export async function getProviderConfigurationSummary(provider: string): Promise<ProviderConfigurationSummary> {
  const credentials = await getProviderCredentials(provider);
  const row = env.DB ? await readProviderRow(provider) : null;
  return {
    provider,
    name: provider === INTERVALS_PROVIDER ? "Intervals.icu" : provider,
    status: credentials.ready ? "configured" : "not_configured",
    clientIdHint: credentials.ready ? maskClientId(credentials.clientId) : null,
    source: credentials.source,
    configuredAt: credentials.source === "database" ? row?.updated_at || row?.configured_at || null : null,
    scopes: provider === INTERVALS_PROVIDER ? ["ACTIVITY:READ", "WELLNESS:READ"] : [],
  };
}

export async function saveProviderConfiguration(
  provider: string,
  clientId: string,
  clientSecret: string,
  configuredBy: string,
) {
  if (provider !== INTERVALS_PROVIDER) throw new Error("Proveedor no permitido");
  if (!env.DB) throw new Error("Base de datos no disponible");
  const now = new Date().toISOString();
  const cipher = await encryptProviderSecret(provider, clientSecret);
  await env.DB.prepare(`INSERT INTO provider_configurations
    (provider, client_id, client_secret_cipher, status, configured_by, configured_at, updated_at)
    VALUES (?, ?, ?, 'active', ?, ?, ?)
    ON CONFLICT(provider) DO UPDATE SET
      client_id = excluded.client_id,
      client_secret_cipher = excluded.client_secret_cipher,
      status = 'active',
      configured_by = excluded.configured_by,
      updated_at = excluded.updated_at`)
    .bind(provider, clientId, cipher, configuredBy, now, now)
    .run();
  return getProviderConfigurationSummary(provider);
}

async function readProviderRow(provider: string) {
  return env.DB.prepare(`SELECT provider, client_id, client_secret_cipher, status,
    configured_at, updated_at FROM provider_configurations WHERE provider = ?`)
    .bind(provider)
    .first<ProviderConfigRow>();
}

function emptyCredentials(): ProviderCredentialState {
  return { ready: false, clientId: "", clientSecret: "", source: null };
}

function encryptionAvailable() {
  return Boolean(env.ENTHEOS_INTEGRATION_KEY?.trim());
}

async function providerEncryptionKey() {
  const secret = env.ENTHEOS_INTEGRATION_KEY?.trim();
  if (!secret) throw new Error("Cifrado de integraciones no disponible");
  const material = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptProviderSecret(provider: string, value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = new TextEncoder().encode(`entheos-provider:${provider}:v1`);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData },
    await providerEncryptionKey(),
    new TextEncoder().encode(value),
  );
  return `v1.${base64Url(iv)}.${base64Url(new Uint8Array(cipher))}`;
}

async function decryptProviderSecret(provider: string, value: string) {
  const [version, ivValue, cipherValue] = value.split(".");
  if (version !== "v1" || !ivValue || !cipherValue) throw new Error("Credencial cifrada inválida");
  const additionalData = new TextEncoder().encode(`entheos-provider:${provider}:v1`);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(ivValue), additionalData },
    await providerEncryptionKey(),
    fromBase64Url(cipherValue),
  );
  return new TextDecoder().decode(plain);
}

function maskClientId(value: string) {
  const clean = value.trim();
  return clean.length <= 6 ? `••${clean.slice(-3)}` : `${clean.slice(0, 3)}••••${clean.slice(-4)}`;
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
