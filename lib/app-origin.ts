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
/**
 * The base URL for a redirect issued DURING THIS REQUEST — i.e. "wherever the visitor already is".
 *
 * ── Why this exists, and why it is not `resolveTrustedAppOrigin` ─────────────────────────────
 *
 * The resolver above answers "what is our canonical address?", which is the right question for a
 * link that will be **embedded in an email** and clicked minutes later. It is the WRONG question for
 * a redirect the visitor follows immediately, and using it there produced a real production defect:
 *
 *   The site answers on BOTH `fieldlogichq.ca` and `www.fieldlogichq.ca`, and cookies do not span
 *   the two. A visitor who typed the apex address hit a demo door, which minted the shared demo
 *   session and set the cookie **for the host they asked for** — then redirected them to the
 *   canonical `www` host, where that cookie is not sent. They arrived anonymous and were bounced to
 *   a login page, on a product whose entire promise is "no login". (Traced live 2026-08-07.)
 *
 *   ⚠ It is not an edge case. A browser sends `Origin` on CORS requests, form POSTs and fetches —
 *   NOT on a typed address or an ordinary link. So a top-level navigation always fell through to the
 *   canonical fallback. The normal path was the broken one, which is why it survived so long.
 *
 * So: a same-request redirect must keep the visitor on the host they arrived at, or any cookie set
 * alongside it is thrown away.
 *
 * ── Why reading the request host is safe HERE ────────────────────────────────────────────────
 *
 * The attack the canonical fallback defends against is a caller-controlled host ending up inside an
 * emailed link that carries a live one-time token. None of that applies to a redirect on this
 * request: there is no token in the URL, and the session cookie is scoped to the very host being
 * redirected to — so a caller who forges a host is redirecting themselves to their own host with a
 * cookie only that host can read. It buys them nothing.
 *
 * The host is validated all the same, through the SAME predicate the email path uses, so an
 * unrecognised host falls back to canonical rather than being honoured. One rule, stated once.
 */
export function resolveSameHostOrigin(req: Request): string {
  try {
    const self = new URL(req.url).origin;
    if (isTrustedAppOrigin(self)) return self;
  } catch {
    /* unparseable request URL — fall through to the canonical answer */
  }
  return resolveTrustedAppOrigin(req);
}

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
