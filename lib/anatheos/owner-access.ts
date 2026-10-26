/**
 * ANATHEOS G1 — conservative local gate for the experimental module.
 *
 * These checks are in addition to the Entheos server identity provider.
 * They do NOT authenticate incoming HTTP headers or prove a private Site.
 * No ANATHEOS route may be enabled by default.
 */
export type AnatheosIdentity = Readonly<{
  email: string;
  isGlobalAdmin: boolean;
}>;

const normalizeSingleEmail = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  // A single conventional email is required; lists and control characters
  // must never authorize a pilot.
  if (normalized.length > 254 || !/^[^\s@,;]+@[^\s@,;]+$/.test(normalized)) {
    return null;
  }
  return normalized;
};

/** Explicit opt-in is required, including in local development. */
export function isAnatheosPilotEnabled(value: unknown): boolean {
  return value === "true";
}

/**
 * Authorization after a trusted server-side identity has been established.
 * The caller must verify identity provenance at the reverse-proxy boundary.
 */
export function isAnatheosOwner(
  user: AnatheosIdentity | null | undefined,
  configuredOwnerEmail: string | null | undefined,
): boolean {
  if (!user || user.isGlobalAdmin !== true) return false;
  const expected = normalizeSingleEmail(configuredOwnerEmail);
  const actual = normalizeSingleEmail(user.email);
  return expected !== null && actual === expected;
}
