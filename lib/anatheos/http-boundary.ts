/**
 * ANATHEOS G1B: HTTP boundary fail-closed on the Worker frontdoor.
 *
 * This only enforces the disabled state. It does not authenticate
 * oai-authenticated-user-email, attest to header provenance, or authorize
 * enabling the Site; G1B requires a separately audited identity upstream.
 */
const PRIVATE_HEADERS = Object.freeze({
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Content-Security-Policy": "base-uri 'self'; object-src 'none'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
});

/** Segment boundaries prevent capturing unrelated /app/anatheos-3d-foo paths. */
export function isAnatheosHttpPath(pathname: string): boolean {
  let path: string;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    // Raw URL may be malformed; block any path that resembles ANATHEOS.
    return /anatheos/i.test(pathname);
  }
  path = path.replace(/\\/g, "/").replace(/\/{2,}/g, "/").toLowerCase();
  return ["/app/anatheos-3d", "/api/anatheos"].some(
    (prefix) => path === prefix || path.startsWith(prefix + "/"),
  );
}

export function offStateResponse(pathname: string, flag: unknown): Response | null {
  if (!isAnatheosHttpPath(pathname) || flag === "true") return null;
  return new Response("Not Found", {
    status: 404,
    headers: { ...PRIVATE_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

/** Headers also apply to errors and any future subroutes with flag enabled. */
export function withAnatheosPrivateHeaders(pathname: string, response: Response): Response {
  if (!isAnatheosHttpPath(pathname)) return response;
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(PRIVATE_HEADERS)) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
