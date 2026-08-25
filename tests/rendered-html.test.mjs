import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("the production client keeps the private clinical application behind the landing", async () => {
  const manifest = JSON.parse(await readFile(new URL("dist/client/.vite/manifest.json", root), "utf8"));
  const appFile = manifest["components/health-app.tsx"]?.file;
  assert.ok(appFile, "the clinical client entry should exist");
  const bundle = await readFile(new URL(`dist/client/${appFile}`, root), "utf8");
  const brandEntry = Object.entries(manifest).find(([key]) => key.includes("brand-mark"));
  assert.ok(brandEntry?.[1]?.file, "the shared brand mark chunk should exist");
  const brandBundle = await readFile(new URL(`dist/client/${brandEntry[1].file}`, root), "utf8");

  assert.match(bundle, /Entheos/);
  assert.match(brandBundle, /\/entheos-mark\.png/);
  assert.doesNotMatch(brandBundle, /_vinext\/image/);
  assert.match(bundle, /Tu salud en contexto/);
  assert.match(bundle, /\/api\/health\/overview/);
  assert.match(bundle, /mi-salud-private/);
  assert.match(bundle, /indexedDB/);
  assert.match(bundle, /mi-salud:theme:v11/);
  assert.match(bundle, /Historial en datos/);
  assert.match(bundle, /Intervals\.icu/);
  assert.match(bundle, /Actualizar ahora/);
  assert.match(bundle, /Sin aplicaciones puente ni códigos manuales/);
  assert.match(bundle, /ACTIVITY:READ|actividades y bienestar/i);
  assert.match(bundle, /Importar otro período/);
  assert.match(bundle, /hasta 366 días/i);
  assert.doesNotMatch(bundle, /Conectar en este teléfono/);
  assert.doesNotMatch(bundle, /Abrir Entheos y sincronizar/);
  assert.doesNotMatch(bundle, /Instalar o actualizar Entheos 1\.0\.3/);
  assert.doesNotMatch(bundle, /Ingresá el código y autorizá Health Connect/);
  assert.doesNotMatch(bundle, /Entheos Bridge/);
  assert.match(bundle, /\/api\/health\/integrations/);
  assert.match(bundle, /Zepp/);
  assert.match(bundle, /ADMINISTRACIÓN GLOBAL/i);
  assert.match(bundle, /Guardar configuración cifrada/);
  assert.match(bundle, /Camino al catálogo de Intervals\.icu/);
  assert.match(bundle, /OAuth Client ID/);
  assert.doesNotMatch(bundle, /Revisión IA/);
  assert.doesNotMatch(bundle, /Propuestas de IA/);
  assert.doesNotMatch(bundle, /\/api\/auth\/login/);
  assert.doesNotMatch(bundle, /profiles-list|Espacio familiar|Cómo querés entrar/);
});

test("authentication and indexing are enforced by the server shell", async () => {
  const server = await readFile(new URL("dist/server/index.js", root), "utf8");
  assert.match(server, /signin-with-chatgpt/);
  assert.match(server, /Entheos — Tu salud en contexto/);
  assert.match(server, /index:\s*false/);
  assert.match(server, /follow:\s*false/);
  assert.match(server, /APP_OWNER_EMAIL/);
  assert.match(server, /Ingresá con tu cuenta de ChatGPT/);
  assert.match(server, /Registrar, reunir y comprender/);
  assert.match(server, /Términos de uso/);
  assert.match(server, /sitemap\.xml/);
  assert.match(server, /Un espacio por cuenta/);
  assert.match(server, /oauth-protected-resource/);
  assert.match(server, /get_health_history/);
  assert.match(server, /get_documents_and_studies/);
  assert.doesNotMatch(server, /admin-recovery/);
});

test("Health Connect pairing and sync are server-authorized and additive", async () => {
  const server = await readFile(new URL("dist/server/index.js", root), "utf8");
  const migration = await readFile(new URL("drizzle/0005_dry_black_bird.sql", root), "utf8");
  const statusRoute = await readFile(new URL("app/api/health/connectors/health-connect/status/route.ts", root), "utf8");
  assert.match(server, /integration_connections/);
  assert.match(server, /pending_pairing/);
  assert.match(server, /pending_permissions/);
  assert.match(server, /connector_sync/);
  assert.match(server, /health_connect/);
  assert.match(server, /device_recorded/);
  assert.match(migration, /CREATE TABLE `integration_connections`/);
  assert.match(migration, /connector_token_hash/);
  assert.match(migration, /pairing_code_hash/);
  assert.match(statusRoute, /effectiveCapabilities/);
  assert.match(statusRoute, /context\.capabilities/);
  assert.doesNotMatch(migration, /\bDROP\s+(?:TABLE|COLUMN|INDEX)\b/i);
});

test("Intervals.icu OAuth stays server-side and imported records are idempotent", async () => {
  const server = await readFile(new URL("dist/server/index.js", root), "utf8");
  const source = await readFile(new URL("db/intervals.ts", root), "utf8");
  const providerConfig = await readFile(new URL("db/provider-config.ts", root), "utf8");
  const callback = await readFile(new URL("app/api/health/connectors/intervals/callback/route.ts", root), "utf8");
  const adminConfig = await readFile(new URL("app/api/admin/provider-configurations/route.ts", root), "utf8");
  const migration = await readFile(new URL("drizzle/0006_thankful_squadron_sinister.sql", root), "utf8");
  assert.match(server, /INTERVALS_CLIENT_ID/);
  assert.match(server, /INTERVALS_CLIENT_SECRET/);
  assert.match(server, /ENTHEOS_INTEGRATION_KEY/);
  assert.match(source, /ACTIVITY:READ/);
  assert.match(source, /WELLNESS:READ/);
  assert.match(source, /AES-GCM/);
  assert.match(source, /ON CONFLICT\(id\) DO UPDATE/);
  assert.match(source, /source_type/);
  assert.match(source, /intervals_icu/);
  assert.match(providerConfig, /AES-GCM/);
  assert.match(providerConfig, /provider_configurations/);
  assert.match(providerConfig, /client_secret_cipher/);
  assert.match(adminConfig, /isGlobalAdmin/);
  assert.match(adminConfig, /sameOrigin/);
  assert.doesNotMatch(adminConfig, /clientSecretCipher|client_secret_cipher/);
  assert.match(migration, /CREATE TABLE `provider_configurations`/);
  assert.doesNotMatch(migration, /\bDROP\s+(?:TABLE|COLUMN|INDEX)\b/i);
  assert.match(callback, /pairing_code_hash/);
  assert.match(callback, /pairing_expires_at/);
  assert.match(callback, /syncIntervalsConnection/);
});

test("the Android bridge requests read-only Health Connect access and protects its token", async () => {
  const manifest = await readFile(new URL("android/entheos-bridge/app/src/main/AndroidManifest.xml", root), "utf8");
  const store = await readFile(new URL("android/entheos-bridge/app/src/main/java/app/entheos/salud/SecureStore.kt", root), "utf8");
  const worker = await readFile(new URL("android/entheos-bridge/app/src/main/java/app/entheos/salud/SyncWorker.kt", root), "utf8");
  const repository = await readFile(new URL("android/entheos-bridge/app/src/main/java/app/entheos/salud/HealthConnectRepository.kt", root), "utf8");
  const activity = await readFile(new URL("android/entheos-bridge/app/src/main/java/app/entheos/salud/MainActivity.kt", root), "utf8");
  const gradle = await readFile(new URL("android/entheos-bridge/app/build.gradle.kts", root), "utf8");
  assert.match(manifest, /android\.permission\.health\.READ_STEPS/);
  assert.match(manifest, /android\.permission\.health\.READ_HEALTH_DATA_IN_BACKGROUND/);
  assert.match(manifest, /android:autoVerify="true"/);
  assert.match(manifest, /\/connect\/health-connect/);
  assert.match(manifest, /androidx\.health\.ACTION_SHOW_PERMISSIONS_RATIONALE/);
  assert.doesNotMatch(manifest, /android\.permission\.health\.WRITE_/);
  assert.match(store, /AndroidKeyStore/);
  assert.match(store, /AES\/GCM\/NoPadding/);
  assert.match(store, /history_cursor_millis/);
  assert.match(worker, /PeriodicWorkRequestBuilder<SyncWorker>\(6, TimeUnit\.HOURS\)/);
  assert.match(repository, /FEATURE_READ_HEALTH_DATA_HISTORY/);
  assert.match(repository, /Duration\.ofHours\(36\)/);
  assert.match(repository, /progressiveOrder/);
  assert.match(repository, /historyChunk/);
  assert.match(repository, /pageSize = READ_PAGE_SIZE/);
  assert.match(repository, /READ_PAGE_SIZE = 50/);
  assert.match(repository, /FIRST_RECOVERY_MILLIS = 1_600L/);
  assert.match(repository, /"degraded"/);
  assert.match(repository, /withClientRecovery/);
  assert.match(repository, /DeadObjectException/);
  assert.match(repository, /historicalBackfillSucceeded/);
  assert.match(activity, /override fun onNewIntent/);
  assert.match(activity, /Conectar con mi cuenta de Entheos/);
  assert.match(activity, /store\.cachedGrantedCapabilities\(\)/);
  assert.doesNotMatch(activity, /"interrupted", emptySet\(\)/);
  assert.match(activity, /getHealthConnectManageDataIntent/);
  assert.match(gradle, /versionCode = 4/);
  assert.match(gradle, /versionName = "1\.0\.3"/);
});

test("verified Android App Links and the one-tap launch page are shipped", async () => {
  const server = await readFile(new URL("dist/server/index.js", root), "utf8");
  const manifest = JSON.parse(await readFile(new URL("dist/client/.vite/manifest.json", root), "utf8"));
  const launchFile = manifest["components/health-connect-launch.tsx"]?.file;
  assert.ok(launchFile, "the Health Connect launch client should exist");
  const launch = await readFile(new URL(`dist/client/${launchFile}`, root), "utf8");
  assert.match(server, /assetlinks\.json/);
  assert.match(server, /app\.entheos\.salud/);
  assert.match(server, /connect\/health-connect/);
  assert.match(launch, /Conectando este teléfono/);
  assert.match(launch, /Ayuda técnica/);
  assert.match(launch, /no es tu contraseña/);
});

test("OAuth schema is additive and synthetic preview identity cleanup is narrow", async () => {
  const migration = await readFile(new URL("drizzle/0004_nifty_micromacro.sql", root), "utf8");
  assert.match(migration, /CREATE TABLE `oauth_clients`/);
  assert.match(migration, /CREATE TABLE `oauth_authorization_codes`/);
  assert.match(migration, /CREATE TABLE `oauth_refresh_tokens`/);
  assert.doesNotMatch(migration, /DELETE FROM `(?:patient_profiles|users|organizations|memberships)`\s*;/);
  assert.doesNotMatch(migration, /\bDROP\s+(?:TABLE|COLUMN|INDEX)\b/i);
});

test("the service worker cannot cache sessions, HTML, or clinical APIs", async () => {
  const worker = await readFile(new URL("dist/client/sw.js", root), "utf8");
  assert.match(worker, /SAFE_STATIC/);
  assert.match(worker, /Navigations, authentication, HTML and \/api responses deliberately remain/);
  assert.doesNotMatch(worker, /event\.request\.mode\s*===\s*["']navigate/);
  assert.doesNotMatch(worker, /\/api\/health/);
});

test("the legacy static tracker is no longer shipped", async () => {
  await assert.rejects(access(new URL("dist/client/app/index.html", root)));
  await assert.rejects(access(new URL("dist/client/app/app.js", root)));
});

test("the clinical migration is additive", async () => {
  const migration = await readFile(new URL("drizzle/0002_foamy_famine.sql", root), "utf8");
  assert.match(migration, /CREATE TABLE `patient_profiles`/);
  assert.match(migration, /CREATE TABLE `timeline_events`/);
  assert.match(migration, /CREATE TABLE `document_references`/);
  assert.doesNotMatch(migration, /\bDROP\s+(?:TABLE|COLUMN|INDEX)\b/i);
  assert.doesNotMatch(migration, /\bTRUNCATE\b/i);
});
