import { jsonResponse } from "@/db/clinical";
import { registerOAuthClient } from "@/db/oauth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    return jsonResponse(await registerOAuthClient(body.client_name, body.redirect_uris), { status: 201 });
  } catch {
    return jsonResponse({ error: "invalid_client_metadata" }, { status: 400 });
  }
}
