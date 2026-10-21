/**
 * lib/site-field-checks.ts — THE PUBLIC SITE'S EMAIL AND LINK CHECKS (Club Tier Stage 4c-1, F05; words
 * CLUB_TIER_STAGE4C1_COPY.md §C, §D, §G, §H, §K).
 *
 * One rule for the editor and its route: a refused value says why beside the field and is NEVER saved (today a bad link
 * was thrown away while Save said "saved"). A link typed without https:// is completed and the hint says what was saved.
 * An email that could carry extra mailto: fields (?, &, %, spaces, angle brackets — a %2C is a second recipient) is
 * refused, and so is a link with a login part ("https://facebook.com@evil.com") or a backslash: both are rendered as
 * links on every public page. Pure; tested in tests/unit/club-stage4c1.test.ts.
 */
import type { ClubSocialKind } from './club-site';

export const EMAIL_MAX = 254;
export const LINK_MAX = 500;

export const BAD_EMAIL = "That doesn't look like an email address.";
export const LINK_TOO_LONG = 'That link is too long. Paste a shorter one.';

/** The social links the footer draws (`ClubSocialKind`), each refused in its own words. */
export type SocialNetwork = ClubSocialKind;

const LINK_NOUN: Record<SocialNetwork, string> = {
  instagram: 'your Instagram profile',
  facebook: 'your Facebook page',
  x: 'your X profile',
  website: 'your website',
};

/** The refusal, naming what the field wants when it is a social link. */
export function badLinkMessage(network?: SocialNetwork): string {
  return network
    ? `That isn't a web address. Paste the link to ${LINK_NOUN[network]}, starting with https://`
    : "That isn't a web address. Paste the link, starting with https://";
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

const EMAIL = /^[A-Za-z0-9.!#$'*+/=^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;

/** An email address, trimmed; blank is null (the field is optional). */
export function checkEmail(raw: unknown): Checked<string | null> {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (!v) return { ok: true, value: null };
  if (v.length > EMAIL_MAX || !EMAIL.test(v)) return { ok: false, error: BAD_EMAIL };
  return { ok: true, value: v };
}

/**
 * A web link, trimmed; blank is null. "instagram.com/club" and "http://…" are saved as https://; any other scheme
 * (javascript:, mailto:) or something that is not an address ("Lakeshore Lynx Baseball") is refused.
 */
export function checkLink(raw: unknown, network?: SocialNetwork): Checked<string | null> {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (!v) return { ok: true, value: null };
  let candidate: string;
  if (/^https:\/\//i.test(v)) candidate = 'https://' + v.slice(8);
  else if (/^http:\/\//i.test(v)) candidate = 'https://' + v.slice(7);
  else if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return { ok: false, error: badLinkMessage(network) };
  else candidate = 'https://' + v.replace(/^\/+/, '');
  if (/[\s\\]/.test(candidate)) return { ok: false, error: badLinkMessage(network) };
  let url: URL;
  try { url = new URL(candidate); } catch { return { ok: false, error: badLinkMessage(network) }; }
  if (url.protocol !== 'https:' || url.username || url.password || !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(url.hostname)) {
    return { ok: false, error: badLinkMessage(network) };
  }
  if (candidate.length > LINK_MAX) return { ok: false, error: LINK_TOO_LONG };
  return { ok: true, value: candidate };
}

/** "Saved as https://instagram.com/lakeshorelynx" — only when the saved link differs from what was typed. */
export function savedAsHint(typed: string, saved: string | null): string | null {
  return saved && saved !== typed.trim() ? `Saved as ${saved}` : null;
}

const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.ca', 'outlook.com', 'live.com', 'live.ca', 'msn.com',
  'yahoo.com', 'yahoo.ca', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'rogers.com', 'sympatico.ca', 'bell.net',
  'shaw.ca', 'telus.net', 'cogeco.ca', 'protonmail.com', 'proton.me',
]);

/** A personal-looking address (a free-mail domain): the editor nudges toward a role address and never refuses it. */
export function looksPersonalEmail(email: string | null | undefined): boolean {
  const domain = email?.split('@')[1]?.toLowerCase().trim();
  return !!domain && FREE_MAIL.has(domain);
}

export const ROLE_ADDRESS_NUDGE =
  'A role address such as registrar@ keeps working when a volunteer changes. You can use this one if you prefer.';
