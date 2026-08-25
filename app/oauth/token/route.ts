import { jsonResponse } from "@/db/clinical";
import { exchangeAuthorizationCode, exchangeRefreshToken } from "@/db/oauth";

export async function POST(request: Request) {
  const form = await request.formData();
  const grant = String(form.get("grant_type") || "");
  const result = grant === "authorization_code"
    ? await exchangeAuthorizationCode(form.get("code"), form.get("client_id"), form.get("redirect_uri"), form.get("code_verifier"))
    : grant === "refresh_token"
      ? await exchangeRefreshToken(form.get("refresh_token"), form.get("client_id"))
      : null;
  return result ? jsonResponse(result) : jsonResponse({ error: "invalid_grant" }, { status: 400 });
}
