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
 *
 * WHO SETS IT (Board Ready 4.P, owner 2026-11-21): the club's owner or an admin, on Organization › Settings ("Your
 * privacy policy", `components/admin/kit/club/PrivacyPolicyCard.tsx`), through
 * `/api/admin/org-settings/privacy-policy`, which validates with `parsePrivacyPolicyInput` below — the same scheme rule
 * the readers use, never a second one.
 */

/** The longest address the club's setting accepts. A real policy address is far shorter; this only stops a paste of a
 *  whole document. */
export const PRIVACY_POLICY_URL_MAX = 2000;

/** The setting's words (Board Ready 4.P, owner "use these words" 2026-11-21). After `/legal`'s read the owner ruled the field's
 *  label (two fields named "Web address" on one page invited a wrong paste) and the helper's middle sentence, which is Terms §4
 *  in its own words ("outside Canada, mainly in the United States"; `docs/agents/legal/CLUB_FORM_NOTICE_REMOVAL.md` addendum). */
export const PRIVACY_POLICY_WORDS = {
  title: 'Your privacy policy',
  label: 'Link to your privacy policy',
  hint: 'The web address of your club’s own privacy policy. Families see a link to it on your sign-up forms and when they accept an invitation. It is where you tell them how your club uses their information, and that FieldLogicHQ stores it outside Canada, mainly in the United States. Leave it empty for no link.',
  badScheme: 'Enter a web address that starts with https:// or http://.',
  tooLong: 'That web address is too long.',
  loadFailed: 'Your privacy policy link didn’t load. Refresh the page to try again.',
} as const;

/** http(s) and an absolute, parseable address, or null. The ONE scheme rule (readers and the setting both use it).
 *  ⚠ Written out with its `//`: Node reads `https:club.example` as `https://club.example/`, but a browser on an https
 *  page resolves the same href as a path on OUR site (/review 4.P), so a link that passed here would break. No space or
 *  control character inside (a browser strips them, so what is stored is not what opens), and no `user:password@`. */
function safeHttpUrl(raw: string): string | null {
  if (!/^https?:\/\//i.test(raw) || /[\s\u0000-\u001f\u007f]/.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password || !url.hostname) return null;
    return raw;
  } catch {
    return null; // not a parseable absolute URL
  }
}

/** Only http(s) is allowed as a link target — never `javascript:`/`data:`/etc. The value is
 *  org-controlled (the club's owner or an admin sets it on Settings), and it is
 *  rendered as an `<a href>` to families, so scheme-restricting at this single seam keeps every
 *  consent surface safe from stored-XSS by construction — including a value stored before the
 *  setting validated it. */
export function getOrgPrivacyPolicyHref(
  org: { privacyPolicyUrl?: string | null } | null | undefined,
): string | null {
  const raw = org?.privacyPolicyUrl?.trim();
  if (!raw) return null;
  return safeHttpUrl(raw);
}

/** What a save did, as the club's audit line says it — judged by what FAMILIES saw before (through the seam) and see
 *  after, so replacing an unsafe stored value that showed no link reads as "added", and clearing one is no change at
 *  all (null: nothing to log). `next` is already a parsed value (`parsePrivacyPolicyInput`). */
export function privacyLinkChange(beforeRaw: string | null, next: string | null): 'added' | 'changed' | 'removed' | null {
  const before = getOrgPrivacyPolicyHref({ privacyPolicyUrl: beforeRaw });
  if (before === next) return null;
  if (next === null) return 'removed';
  return before === null ? 'added' : 'changed';
}

/** What the club typed, checked for saving: trimmed; empty clears (null); otherwise http(s) and at most
 *  `PRIVACY_POLICY_URL_MAX` characters, or the one sentence that says why not. */
export function parsePrivacyPolicyInput(
  input: unknown,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (input === null || input === undefined) return { ok: true, value: null };
  if (typeof input !== 'string') return { ok: false, error: PRIVACY_POLICY_WORDS.badScheme };
  const raw = input.trim();
  if (!raw) return { ok: true, value: null };
  if (raw.length > PRIVACY_POLICY_URL_MAX) return { ok: false, error: PRIVACY_POLICY_WORDS.tooLong };
  const safe = safeHttpUrl(raw);
  return safe ? { ok: true, value: safe } : { ok: false, error: PRIVACY_POLICY_WORDS.badScheme };
}
