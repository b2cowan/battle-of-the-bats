/**
 * Privacy-policy link "pipe" — the single forward-compatible seam the consent gate (and any
 * other consent surface) uses to link to an org's privacy policy.
 *
 * Today an org can store an external `privacyPolicyUrl`; when none is set this returns null and
 * the consent UI renders WITHOUT a link (a complete, honest consent statement on its own).
 *
 * When the in-platform org privacy page ships with the League/Club public website, wire it HERE
 * (e.g. fall back to a platform route like `/${org.slug}/privacy` when org content exists) so
 * every consent surface lights up at once — no other file needs to change.
 */
/** Only http(s) is allowed as a link target — never `javascript:`/`data:`/etc. The value is
 *  org-controlled (today operator-only; a future admin UI will let tenants set it), and it is
 *  rendered as an `<a href>` to families, so scheme-restricting at this single seam keeps every
 *  consent surface safe from stored-XSS by construction. */
export function getOrgPrivacyPolicyHref(
  org: { privacyPolicyUrl?: string | null } | null | undefined,
): string | null {
  const raw = org?.privacyPolicyUrl?.trim();
  if (!raw) return null;
  try {
    const protocol = new URL(raw).protocol;
    return protocol === 'https:' || protocol === 'http:' ? raw : null;
  } catch {
    return null; // not a parseable absolute URL
  }
}
