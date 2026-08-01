import 'server-only';

/**
 * Resolve the trusted base URL for links embedded in auth emails (password reset, signup
 * verification). These links carry a live, one-time Supabase token, so their host must NEVER be
 * taken straight from the request `Origin` header: `Origin` is caller-controlled on a scripted
 * (non-browser) request, so an attacker could aim a genuine-looking FieldLogicHQ email — carrying
 * the token — at a host they control and capture the token on click or on an email scanner's
 * pre-fetch.
 *
 * We therefore honor `Origin` only when it is one of our own hosts (the platform domain, its
 * subdomains, or localhost for dev); anything else falls back to the configured canonical app URL.
 * Legitimate browser requests always send an on-domain `Origin`, so this preserves the existing
 * "return to the host I started on" behavior (dev vs prod) while closing the redirect-host hole.
 */
export function resolveTrustedAppOrigin(req: Request): string {
  const fallback = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';
  const origin = req.headers.get('origin');
  if (origin && isTrustedAppOrigin(origin)) return origin;
  return fallback;
}

/**
 * Is this `Origin` header value one of OUR hosts?
 *
 * The hardened half of the check above, exposed on its own for callers that need the boolean rather
 * than a URL — e.g. a public unauthenticated endpoint deciding whether to accept a cross-origin
 * post. Stated once so the bypass-neutralizing parse can't drift between them.
 *
 * NB an absent `Origin` is NOT this function's business: callers decide what a missing header means
 * (the resolver above falls back to the canonical URL; an ingestion endpoint should keep accepting
 * it, since only a browser is obliged to send one).
 */
export function isTrustedAppOrigin(origin: string): boolean {
  try {
    // Parse via the WHATWG URL parser and compare the normalized hostname — this neutralizes the
    // usual allowlist bypasses (userinfo `@`, backslash/CRLF tricks, case, punycode) before the check.
    const host = new URL(origin).hostname;
    // We trust every subdomain of our own domain. That is safe today because no tenant/customer
    // controls a FieldLogicHQ subdomain — revisit this if custom domains or tenant-chosen subdomains
    // ever ship. `localhost` is honored for local dev only, never in a production build.
    const isLocalhostDev = host === 'localhost' && process.env.NODE_ENV !== 'production';
    return isLocalhostDev || host === 'fieldlogichq.ca' || host.endsWith('.fieldlogichq.ca');
  } catch {
    return false; // Malformed Origin is never trusted.
  }
}
