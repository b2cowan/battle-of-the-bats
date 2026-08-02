/**
 * lib/guardian-email.ts — ONE normalization rule for the de-facto family identity.
 *
 * Chunk D substrate (0.1). A guardian's email is how the platform recognizes a family across
 * tables that deliberately hold no account: `rep_roster_players`, `rep_tryout_registrations`,
 * `league_registrations`. Discovery G7 verified the cost of leaving it alone — the same parent
 * arrives as `J.Thompson@Gmail.com ` from the public tryout form and `j.thompson@gmail.com` from
 * the coach's roster entry, and every match-by-email feature (family links, the announcements
 * recipient dedupe, the per-family unsubscribe) then treats them as two people.
 *
 * The rule is deliberately conservative — trim + lowercase, nothing else. No dot-stripping, no
 * plus-tag removal: those are provider-specific conventions, and collapsing `a+ravens@x.com`
 * into `a@x.com` would merge two families the moment one provider disagrees with our guess.
 *
 * Every write path funnels through {@link normalizeGuardianEmail}; migration 214 backfills the
 * rows written before it existed.
 */

/** Trim + lowercase. Blank/whitespace-only in, `null` out — a blank contact is an ABSENT contact,
 *  never the empty string (which sorts and dedupes as a real value). */
export function normalizeGuardianEmail(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/** Same rule, string-in/string-out — for callers whose column is NOT NULL (league registrations). */
export function normalizeGuardianEmailRequired(value: string): string {
  return value.trim().toLowerCase();
}

/** Shape check used before we put an address on a send list. Intentionally the same permissive
 *  pattern the announcements path already used — this helper exists so the family surfaces and
 *  the announcements path can never drift on what "sendable" means. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isSendableGuardianEmail(value: string | null | undefined): boolean {
  const normalized = normalizeGuardianEmail(value);
  return normalized !== null && EMAIL_SHAPE.test(normalized);
}
