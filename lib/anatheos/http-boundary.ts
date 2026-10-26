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

/**
 * Defend the OFF gate even if an upstream router decodes %-escapes, merges
 * slashes, removes dot segments or treats backslashes as separators.
 * A path that looks like an ANATHEOS path after a bounded number of normalizations
 * is denied BEFORE the application sees it. This is not user authentication.
 */
export function isAnatheosHttpPath(pathname: string): boolean {
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return false;
  let path = pathname;
  const targeted = (value: string) => {
    const segments = value
      .replace(/\\/g, "/")
      .replace(/\/+/g, "/")
      .toLowerCase()
      .split("/")
      .filter(Boolean)
      .map((part) => part.split(";")[0]);
    const canonical: string[] = [];
    for (const part of segments) {
      if (part === ".") continue;
      if (part === "..") canonical.pop();
      else canonical.push(part);
    }
    const joined = "/" + canonical.join("/");
    return ["/app/anatheos-3d", "/api/anatheos"].some(
      (prefix) => joined === prefix || joined.startsWith(prefix + "/"),
    );
  };
  for (let i = 0; i < 32; i += 1) {
    if (targeted(path)) return true;
    let decoded: string;
    try {
      decoded = decodeURIComponent(path);
    } catch {
      // Malformed escapes: if the target appears literally, deny conservatively.
      return /anatheos/i.test(path);
    }
    if (decoded === path) return false;
    path = decoded;
  }
  // Too many encodings is inherently ambiguous. Preserve the OFF boundary
  // for suspicious ANATHEOS patterns without intercepting unrelated routes.
  return targeted(path) || /anatheos/i.test(path);
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
