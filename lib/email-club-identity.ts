/**
 * lib/email-club-identity.ts — a club's face in a family email (The public face, warm: S3b; owner Asks 1–9, 2026-10-23;
 * drawn at https://claude.ai/artifact/Q77tjshN7iDMf4hGMM9HS5, words in docs/projects/active/PUBLIC_FACE_WARM_S3B_COPY.md).
 *
 * PURE and framework-free, on purpose: the dues preview and Families' "See the email" sample import it in the browser,
 * so nothing server-only may ever come in here. The server half (reading a logo's size, the club's public contact) lives
 * in lib/club-email-context.ts.
 *
 * Three jobs, each the one home for its rule:
 *   · THE BAND — the parts of the club's strip across the top of the card (`clubBand`). Colours come from
 *     `clubColourRoles()` and nothing else: this file adds no colour logic, it only decides what the email does with them.
 *   · THE SENDER NAME — "{Club} via FieldLogicHQ", cleaned for a header (`familySenderName`).
 *   · THE REPLY LINE — the one sentence that says where a reply goes (`familyReplyLine`).
 */
import { clubColourRoles } from './club-colour-roles';
import { clubInitials } from './club-site';

/** The plain facts of a club an email needs. Everything but the name is optional: a club that never chose a colour or a logo gets the defaults. */
export interface ClubEmailFacts {
  name: string;
  logoUrl?: string | null;
  /** The logo file's own size in pixels, once known (lib/club-email-context.ts measures it once and remembers it). Unknown means initials, never a squashed logo. */
  logoSize?: { width: number; height: number } | null;
  themePreset?: string | null;
  themePrimary?: string | null;
  themeAccent?: string | null;
}

export interface ClubBand {
  name: string;
  fill: string;
  onFill: string;
  /** The thin rule under the band, or null when it would only repeat the fill (or sit above the email's one lime button). */
  accent: string | null;
  initials: string;
  tileBackground: string;
  tileInk: string;
  /** Only ever a PNG or JPEG on this project's storage with a known size; otherwise null and the tile holds the initials. */
  logo: { src: string; width: number; height: number } | null;
  /** The club's ink, for the logo's alt text inside the white tile. */
  ink: string;
}

/** The longest edge of a logo inside the 44 px tile (the tile keeps 4 px round it). */
export const BAND_LOGO_EDGE = 36;

const RASTER_EXTENSION = /\.(png|jpe?g)$/i;

/** The host of this project's storage, the same test `deriveLogoDataUrl` (lib/export/resolve-pdf-settings.ts) applies: only a file we hold is ever put in an email. */
function storageHostFromEnv(): string | null {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : null;
  } catch {
    return null;
  }
}

/** True when `url` is an https file on `storageHost` whose stored name ends .png, .jpg or .jpeg. A relative stock-logo path, an SVG or a WebP is false. */
export function isEmailableLogoUrl(url: string | null | undefined, storageHost: string | null = storageHostFromEnv()): boolean {
  if (!url || !storageHost) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.host === storageHost && RASTER_EXTENSION.test(parsed.pathname);
  } catch {
    return false;
  }
}

/** Hue (0–360), saturation and lightness (0–1) of a `#rrggbb`. */
function hsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

/** A lime or yellow-green: the family of the email's one lime button, so a rule of it never sits above the button. */
export function isLimeLike(hex: string): boolean {
  const { h, s, l } = hsl(hex);
  return h >= 60 && h <= 140 && s >= 0.35 && l >= 0.4;
}

/** The band's parts for a club. Never throws: a club with no colours, no logo or an odd name still gets a readable band. */
export function clubBand(facts: ClubEmailFacts, opts: { storageHost?: string | null } = {}): ClubBand {
  // Invisible formatting characters (right-to-left overrides, zero-width marks) are dropped so a name cannot reorder what is round it.
  const name = facts.name.replace(/\p{Cf}/gu, '').trim();
  const roles = clubColourRoles(facts.themePreset, facts.themePrimary, facts.themeAccent);

  const size = facts.logoSize;
  const sizeKnown = !!size && size.width > 0 && size.height > 0;
  const usable = sizeKnown
    && isEmailableLogoUrl(facts.logoUrl, opts.storageHost === undefined ? storageHostFromEnv() : opts.storageHost);
  let logo: ClubBand['logo'] = null;
  if (usable && size && facts.logoUrl) {
    const scale = BAND_LOGO_EDGE / Math.max(size.width, size.height);
    logo = {
      src: facts.logoUrl,
      width: Math.max(1, Math.round(size.width * scale)),
      height: Math.max(1, Math.round(size.height * scale)),
    };
  }

  const accent = roles.accent.toUpperCase() === roles.fill.toUpperCase() || isLimeLike(roles.accent) ? null : roles.accent;
  return {
    name,
    fill: roles.fill,
    onFill: roles.onFill,
    accent,
    initials: clubInitials(name),
    tileBackground: roles.tile,
    tileInk: roles.tileInk,
    logo,
    ink: roles.ink,
  };
}

/** The platform's name that closes every family sender name. It is always present: a club's name is never the whole sender. */
export const FAMILY_SENDER_SUFFIX = 'via FieldLogicHQ';
/** The sender name when a club's name cannot be used at all (copy file, item 12). */
export const FAMILY_SENDER_FALLBACK = 'FieldLogicHQ';
/** The club part of a sender name is cut here, so " via FieldLogicHQ" is never the part that is lost. */
export const FAMILY_SENDER_CLUB_MAX = 48;

/**
 * The inbox's sender name for a family email: "{Club} via FieldLogicHQ" (copy item 1). The club's name is free text typed
 * by an admin and goes into a mail header, so it is cleaned first: double quotes, angle brackets, @, commas, semicolons,
 * colons and backslashes go, as do control characters and line breaks; runs of spaces collapse; the club part is capped at
 * 48 characters, ending with an ellipsis if it was cut. A name with no letter or digit left falls back to FieldLogicHQ alone.
 */
export function familySenderName(clubName: string | null | undefined): string {
  const cleaned = (clubName ?? '')
    .replace(/\p{Cf}/gu, '')
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ')
    .replace(/["<>@,;:\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!/[\p{L}\p{N}]/u.test(cleaned)) return FAMILY_SENDER_FALLBACK;
  const chars = Array.from(cleaned);
  const club = chars.length > FAMILY_SENDER_CLUB_MAX ? `${chars.slice(0, FAMILY_SENDER_CLUB_MAX - 1).join('').trimEnd()}…` : cleaned;
  return `${club} ${FAMILY_SENDER_SUFFIX}`;
}

/** What the reply line says about where a reply goes, and which address that is. */
export interface FamilyReplyPlan {
  /** The Reply-To header, or null (replies go to the verified sending address, which nobody reads). */
  replyTo: string | null;
  /** The sentence for the foot of the card (plain text; the caller escapes it for HTML). */
  line: string;
}

const EMAIL_SHAPE = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;

/** A club's public-site contact address if it looks like one, else null. */
export function usableContactEmail(value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  return EMAIL_SHAPE.test(v) ? v : null;
}

/**
 * The reply line and the Reply-To that go with it (copy items 3–5, owner Ask 4):
 *   · a message a PERSON sends replies to that person ("Reply to this email to reach Dana.");
 *   · system mail replies to the club's public-site contact when it has one ("Reply to this email to reach {Club}.");
 *   · system mail from a club with no contact says so, and sends the parent to the club.
 * The line is only ever a promise the Reply-To keeps: the contact variant is chosen by the address, never by hope.
 */
export function familyReplyPlan(p:
  | { kind: 'person'; clubName: string; senderEmail: string | null | undefined; senderName?: string | null }
  | { kind: 'system'; clubName: string; clubContact: string | null | undefined },
): FamilyReplyPlan {
  const club = p.clubName.trim() || 'the club';
  if (p.kind === 'person') {
    const replyTo = usableContactEmail(p.senderEmail);
    // A name that is an email address, or the club's own name (what the sender lookup falls back to), names nobody.
    const named = p.senderName?.trim() ?? '';
    const who = !named || named.includes('@') || named.toLowerCase() === club.toLowerCase() ? 'the sender' : named;
    return replyTo
      ? { replyTo, line: `Reply to this email to reach ${who}.` }
      : { replyTo: null, line: replyNobodyLine(club) };
  }
  const contact = usableContactEmail(p.clubContact);
  return contact
    ? { replyTo: contact, line: `Reply to this email to reach ${club}.` }
    : { replyTo: null, line: replyNobodyLine(club) };
}

function replyNobodyLine(club: string): string {
  return `Replies to this email won't reach anyone. To get in touch, contact ${club} directly.`;
}

/**
 * Whether an email's small bold line above its headline would only repeat the band (copy item 6): the org-wide emails set
 * it to the club's name. A team or season name stays.
 */
export function eyebrowRepeatsBand(eyebrow: string | null | undefined, clubName: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  return !eyebrow || norm(eyebrow) === norm(clubName);
}

/**
 * What a system email builder needs to wear a club (the seven registration emails, the tryout receipt): the club's face,
 * the reply line for its foot, and the public contact address the decline names. Built once per send by
 * lib/club-email-context.ts `systemMailFace`.
 */
export interface FamilyMailFace {
  club: ClubEmailFacts;
  /** The sentence for the foot of the card (familyReplyPlan's line). */
  replyLine: string | null;
  /** The Reply-To that sentence promises (familyReplyPlan's address), or null when replies reach nobody. */
  replyTo?: string | null;
  /** The club's public-site contact address, when it has one. */
  contact?: string | null;
}

/**
 * The quiet line that closes a banded card (copy item 2): "Sent through FieldLogicHQ, the software {Club} uses." The name
 * itself is drawn as the name line between `lead` and `tail` (lib/brand-mark.ts); the email and Families' on-screen sample
 * read these two pieces, so they cannot word it differently.
 */
export function platformLineWords(clubName: string): { lead: string; tail: string } {
  return { lead: 'Sent through ', tail: `, the software ${clubName.trim()} uses.` };
}
