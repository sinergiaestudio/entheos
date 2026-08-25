import { authorizeClinicalRequest, jsonResponse, unauthorizedResponse } from "@/db/clinical";
import { getPatientSummary } from "@/db/health-data";

export async function GET(request: Request) {
  const context = await authorizeClinicalRequest(request, ["health.read"]);
  if (!context) return unauthorizedResponse();
  return jsonResponse(await getPatientSummary(context));
}
