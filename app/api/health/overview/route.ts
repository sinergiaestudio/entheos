import { authorizeClinicalRequest, jsonResponse, unauthorizedResponse } from "@/db/clinical";
import { getOverview } from "@/db/health-data";

export async function GET(request: Request) {
  const context = await authorizeClinicalRequest(request, ["health.read"]);
  if (!context) return unauthorizedResponse();
  try {
    return jsonResponse(await getOverview(context));
  } catch {
    return jsonResponse({ error: "No pudimos cargar tu historia clínica." }, { status: 503 });
  }
}
