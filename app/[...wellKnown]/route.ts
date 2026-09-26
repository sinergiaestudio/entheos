import { jsonResponse } from "@/db/clinical";

const scopes = ["health.read", "documents.read", "documents.write", "observations.write", "profile.write"];

export async function GET(request: Request, context: { params: Promise<{ wellKnown: string[] }> }) {
  const { wellKnown } = await context.params;
  const path = `/${wellKnown.join("/")}`;
  const origin = new URL(request.url).origin;
  if (path === "/.well-known/oauth-protected-resource") return jsonResponse({
    resource: `${origin}/mcp`, authorization_servers: [origin],
    scopes_supported: scopes, bearer_methods_supported: ["header"],
  });
  if (path === "/.well-known/oauth-authorization-server") return jsonResponse({
    issuer: origin, authorization_endpoint: `${origin}/oauth/authorize`, token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`, response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"], token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"], scopes_supported: scopes,
  });
  if (path === "/.well-known/assetlinks.json") return jsonResponse([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "app.entheos.salud",
        sha256_cert_fingerprints: ["5A:69:B5:53:4A:C4:D6:F8:1D:9F:69:BA:E1:7D:92:E1:C5:2D:08:46:47:26:39:2E:C8:1F:DE:F3:83:2C:59:2A"],
      },
    },
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "app.entheos.salud.debug",
        sha256_cert_fingerprints: ["4F:D9:6A:C6:80:B7:07:6C:DD:35:D5:57:60:E4:F0:27:E6:CA:36:DB:B2:8A:D0:04:F5:D2:07:C9:F9:E1:A0:2B"],
      },
    },
  ]);
  return jsonResponse({ error: "not_found" }, { status: 404 });
}
