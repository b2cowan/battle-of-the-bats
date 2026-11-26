/**
 * THE CLUB'S SPONSORSHIPS — THE RULES (Board Ready Stage 6, Part 1). Pure and client-safe: the screens, the routes and the
 * public pages' loaders ask these same answers.
 *
 * Rulings (owner 2026-11-22, plan BOARD_READY_PLAN.md §5 Stage 6):
 *   · ask 1 — ONE record: a business is kept once and has PLACES (a kind, which one, a last day). A paid deal whose package
 *     has the logo switch on IS a place (Part 2); a typed place is set on the Sponsors tab.
 *   · ask 5 — a place shows through its last day (inclusive, the club's day: `placeShowing`), then leaves.
 *   · ask 6 — a package names its kind of place; each deal picks which one.
 *   · ask 7 — an open offer holds its place: a package is Full when every place is paid, invoiced or offered.
 *   · ask 11 — 20 is the home strip's limit only; the list holds up to 100.
 *   · owner 2026-11-22 (Part 1's question): a TEAM place shows on the About page only — there is no public team page.
 *   · ask 9 — the GST/HST number is checked for its form (9 digits, RT, 4 digits).
 */
import { checkEmail, checkLink } from './site-field-checks';
import { isCalendarDate } from './timezone';
import { SPONSORSHIPS_WORDS as W } from './club-sponsorships-words';

export type SponsorPlaceKind = 'club' | 'division' | 'team' | 'tournament';
export const SPONSOR_PLACE_KINDS: readonly SponsorPlaceKind[] = ['club', 'division', 'team', 'tournament'];

/** The list holds up to 100 (ask 11); the database's trigger holds the same number. */
export const SPONSOR_LIST_MAX = 100;
/** The home strip's limit (ask 11): the club places, in the list's order. */
export const HOME_STRIP_MAX = 20;
export const SPONSOR_NAME_MAX = 80;
export const PACKAGE_NAME_MAX = 80;
export const PACKAGE_ITEMS_MAX = 20;
export const PACKAGE_ITEM_MAX = 120;
export const PACKAGE_PRICE_MAX = 1_000_000;
export const PACKAGE_HOW_MANY_MAX = 999;
export const PACKAGE_DOCUMENT_MAX_BYTES = 8 * 1024 * 1024;
export const PAYMENT_DUE_MAX = 120;

export interface SponsorPlace {
  id: string;
  kind: SponsorPlaceKind;
  /** The division, team or tournament; null for the club. */
  targetId: string | null;
  /** The last day it shows (YYYY-MM-DD, inclusive), or null for no last day. */
  endsOn: string | null;
  source: 'typed' | 'deal';
  dealId: string | null;
}

/** What a public page shows of a sponsor: the name, the logo, the link. Nothing else ever leaves the server. */
export interface PublicSponsor { id: string; name: string; logoUrl?: string; link?: string }

export interface ClubSponsor {
  id: string;
  name: string;
  logoUrl: string | null;
  link: string | null;
  position: number;
  places: SponsorPlace[];
}

/** Every division, team and tournament of the club, each marked `live` when a new place may be put on it. */
export interface PlaceTargets {
  /** `seasonId` (Part 4a): Offer again tells last year's season from this year's by it, never by a name two seasons can share. */
  divisions: { id: string; name: string; seasonId: string; seasonName: string; live: boolean }[];
  teams: { id: string; name: string; divisionName: string; seasonId: string; seasonName: string; live: boolean }[];
  tournaments: { id: string; name: string; live: boolean }[];
}

export interface PackageItem { id: string; text: string }

export interface SponsorshipPackage {
  id: string;
  name: string;
  price: number;
  placeKind: SponsorPlaceKind;
  howMany: number | null;
  showsUntil: string | null;
  logoOnSite: boolean;
  items: PackageItem[];
  document: { name: string; size: number } | null;
  archivedAt: string | null;
}

export interface SponsorshipSettings {
  registered: boolean;
  /** Stored without spaces: 812345678RT0001. */
  gstHstNumber: string | null;
  etransferTo: string | null;
  chequesPayableTo: string | null;
  paymentDueDays: number;
  contactName: string | null;
  contactEmail: string | null;
  /** org_public_site_content.mailing_address — the one column the offer email's foot and every invoice read. */
  mailingAddress: string | null;
}

export const EMPTY_SETTINGS: SponsorshipSettings = {
  registered: false, gstHstNumber: null, etransferTo: null, chequesPayableTo: null, paymentDueDays: 30,
  contactName: null, contactEmail: null, mailingAddress: null,
};

type Ok<T> = { ok: true; value: T } | { ok: false; error: string };

// ── When a sponsor shows ────────────────────────────────────────────────────────────────────────────

/**
 * A place shows through its last day: a whole DAY, inclusive, so it is there at 11:59 p.m. and gone at midnight. `today`
 * is the club's calendar day (YYYY-MM-DD, `tournamentToday`); a place with no last day never lapses.
 */
export const placeShowing = (p: Pick<SponsorPlace, 'endsOn'>, today: string): boolean => !p.endsOn || today <= p.endsOn;

/** A sponsor is "Showing" when one of its places shows; with no place at all it shows nowhere. */
export const sponsorShowing = (s: Pick<ClubSponsor, 'places'>, today: string): boolean => s.places.some(p => placeShowing(p, today));

/** A sponsor that came from a deal can't be removed here (round 1 tab 8). */
export const sponsorHasDeal = (s: Pick<ClubSponsor, 'places'>): boolean => s.places.some(p => p.source === 'deal');

/** The home strip: every sponsor with a club place showing, in the list's order, at most 20 (ask 11). */
export function homeStrip<T extends Pick<ClubSponsor, 'places' | 'position'>>(list: readonly T[], today: string): T[] {
  return [...list]
    .filter(s => s.places.some(p => p.kind === 'club' && placeShowing(p, today)))
    .sort((a, b) => a.position - b.position)
    .slice(0, HOME_STRIP_MAX);
}

/** How many club places show today, the Sponsors tab's "Showing N of 20 places on your home page." */
export const homePlacesShowing = (list: readonly Pick<ClubSponsor, 'places'>[], today: string): number =>
  list.filter(s => s.places.some(p => p.kind === 'club' && placeShowing(p, today))).length;

/** The latest last day among a sponsor's places (null = one of them has none), for its caption. */
export function lastDayOf(s: Pick<ClubSponsor, 'places'>): string | null {
  if (!s.places.length || s.places.some(p => !p.endsOn)) return null;
  return s.places.map(p => p.endsOn!).sort().at(-1) ?? null;
}

// ── The GST/HST number ──────────────────────────────────────────────────────────────────────────────

const GST_FORM = /^\d{9}RT\d{4}$/;
/** What was typed, without spaces or dashes, upper-cased: "81234 5678 rt0001" → "812345678RT0001". */
export const normalizeGstNumber = (raw: string): string => raw.replace(/[\s-]/g, '').toUpperCase();
export const isGstNumber = (raw: string): boolean => GST_FORM.test(normalizeGstNumber(raw));
/** "812345678RT0001" → "81234 5678 RT0001", the way the drawing writes it. */
export function formatGstNumber(stored: string): string {
  const n = normalizeGstNumber(stored);
  return GST_FORM.test(n) ? `${n.slice(0, 5)} ${n.slice(5, 9)} ${n.slice(9)}` : stored;
}

// ── Packages ────────────────────────────────────────────────────────────────────────────────────────

/** "1,000.00", "$1000", "1000" → 1000; null when it isn't money. */
export function parsePrice(raw: unknown): number | null {
  const s = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim().replace(/^\$/, '').replace(/,/g, '') : '';
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Math.round(Number(s) * 100) / 100;
  return n <= PACKAGE_PRICE_MAX ? n : null;
}

export interface PackageInput {
  name: string;
  price: number;
  placeKind: SponsorPlaceKind;
  howMany: number | null;
  showsUntil: string | null;
  logoOnSite: boolean;
  items: PackageItem[];
}

const newItemId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `i${Math.random().toString(36).slice(2)}`);

/** A package as typed (the create window, or one field changed in the record window merged over the stored one). */
export function parsePackageInput(b: Record<string, unknown>): Ok<PackageInput> {
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name || name.length > PACKAGE_NAME_MAX) return { ok: false, error: W.pkg.errName };
  const price = parsePrice(b.price);
  if (price == null) return { ok: false, error: W.pkg.errPrice };
  const placeKind = SPONSOR_PLACE_KINDS.find(k => k === b.placeKind);
  if (!placeKind) return { ok: false, error: W.say.failed };
  let howMany: number | null = null;
  if (b.howMany !== null && b.howMany !== undefined && b.howMany !== '') {
    const n = typeof b.howMany === 'number' ? b.howMany : Number(String(b.howMany).trim());
    if (!Number.isInteger(n) || n < 1 || n > PACKAGE_HOW_MANY_MAX) return { ok: false, error: W.pkg.errHowMany };
    howMany = n;
  }
  const until = typeof b.showsUntil === 'string' ? b.showsUntil.trim() : '';
  if (until && !isCalendarDate(until)) return { ok: false, error: W.sponsor.errLastDay };
  const rawItems = Array.isArray(b.items) ? b.items : [];
  if (rawItems.length > PACKAGE_ITEMS_MAX) return { ok: false, error: W.pkg.errItems };
  const items: PackageItem[] = [];
  for (const it of rawItems) {
    const r = (it ?? {}) as Record<string, unknown>;
    const text = typeof r.text === 'string' ? r.text.trim() : '';
    if (!text || text.length > PACKAGE_ITEM_MAX) return { ok: false, error: W.pkg.errItem };
    const id = typeof r.id === 'string' && /^[\w-]{1,64}$/.test(r.id) ? r.id : newItemId();
    items.push({ id, text });
  }
  return { ok: true, value: { name, price, placeKind, howMany, showsUntil: until || null, logoOnSite: b.logoOnSite !== false, items } };
}

/** What has taken a package's places (Part 2 counts the deals: paid, invoiced and offered — ask 7). */
export interface PackageTaken { paid: number; invoiced: number; offered: number }
export const NOTHING_TAKEN: PackageTaken = { paid: 0, invoiced: 0, offered: 0 };
export const takenCount = (t: PackageTaken): number => t.paid + t.invoiced + t.offered;
/** Full = every place is paid, invoiced or offered (ask 7). No limit is never full. */
export const packageFull = (p: Pick<SponsorshipPackage, 'howMany'>, t: PackageTaken): boolean => p.howMany != null && takenCount(t) >= p.howMany;

// ── Sponsors ────────────────────────────────────────────────────────────────────────────────────────

export interface TypedPlaceInput { id?: string; kind: SponsorPlaceKind; targetId: string | null; endsOn: string | null }
export interface SponsorInput { name: string; link: string | null; logoUrl: string | null; places: TypedPlaceInput[] }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A sponsor as typed: its name, link and logo, and its TYPED places (a deal's place is the deal's, never sent here). */
export function parseSponsorInput(b: Record<string, unknown>): Ok<SponsorInput> {
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name || name.length > SPONSOR_NAME_MAX) return { ok: false, error: W.sponsor.errName };
  const link = checkLink(b.link);
  if (!link.ok) return { ok: false, error: W.sponsor.errLink };
  const logoUrl = typeof b.logoUrl === 'string' && b.logoUrl.trim() ? b.logoUrl.trim() : null;
  const raw = Array.isArray(b.places) ? b.places : [];
  if (raw.length > 50) return { ok: false, error: W.say.failed };
  const places: TypedPlaceInput[] = [];
  const seen = new Set<string>();
  for (const p of raw) {
    const r = (p ?? {}) as Record<string, unknown>;
    const kind = SPONSOR_PLACE_KINDS.find(k => k === r.kind);
    if (!kind) return { ok: false, error: W.say.failed };
    const targetId = kind === 'club' ? null : typeof r.targetId === 'string' && UUID.test(r.targetId) ? r.targetId : null;
    if (kind !== 'club' && !targetId) return { ok: false, error: W.sponsor.errTarget };
    const endsOn = typeof r.endsOn === 'string' && r.endsOn.trim() ? r.endsOn.trim() : null;
    if (endsOn && !isCalendarDate(endsOn)) return { ok: false, error: W.sponsor.errLastDay };
    const key = `${kind}:${targetId ?? ''}`;
    if (seen.has(key)) return { ok: false, error: W.sponsor.errTwice };
    seen.add(key);
    places.push({ ...(typeof r.id === 'string' && UUID.test(r.id) ? { id: r.id } : {}), kind, targetId, endsOn });
  }
  return { ok: true, value: { name, link: link.value, logoUrl, places } };
}

// ── Invoice details ─────────────────────────────────────────────────────────────────────────────────

const optText = (raw: unknown, max: number): string | null | false => {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') return false;
  const t = raw.trim();
  if (!t) return null;
  return t.length <= max ? t : false;
};

/** One or more Invoice details fields, as typed. Only the keys present change. */
export function parseSettingsPatch(b: Record<string, unknown>, current: SponsorshipSettings): Ok<SponsorshipSettings> {
  const next = { ...current };
  if ('mailingAddress' in b) {
    const v = optText(b.mailingAddress, 300);
    if (v === false) return { ok: false, error: W.invoice.errMailing };
    next.mailingAddress = v;
  }
  if ('gstHstNumber' in b) {
    const raw = typeof b.gstHstNumber === 'string' ? b.gstHstNumber : '';
    if (!raw.trim()) next.gstHstNumber = null;
    else if (!isGstNumber(raw)) return { ok: false, error: W.invoice.errNumber };
    else next.gstHstNumber = normalizeGstNumber(raw);
  }
  if ('registered' in b) next.registered = b.registered === true;
  if (next.registered && !next.gstHstNumber) return { ok: false, error: W.invoice.errNumberNeeded };
  for (const key of ['etransferTo', 'contactEmail'] as const) {
    if (!(key in b)) continue;
    const e = checkEmail(b[key]);
    if (!e.ok) return { ok: false, error: W.invoice.errEmail };
    next[key] = e.value;
  }
  for (const key of ['chequesPayableTo', 'contactName'] as const) {
    if (!(key in b)) continue;
    const v = optText(b[key], 120);
    if (v === false) return { ok: false, error: W.say.failed };
    next[key] = v;
  }
  if ('paymentDueDays' in b) {
    const raw = typeof b.paymentDueDays === 'number' ? String(b.paymentDueDays) : String(b.paymentDueDays ?? '').trim();
    const n = /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isInteger(n) || n < 0 || n > PAYMENT_DUE_MAX) return { ok: false, error: W.invoice.errDue };
    next.paymentDueDays = n;
  }
  return { ok: true, value: next };
}

/** The checklist's first row is done once a mailing address is set — the one fact an offer waits on (ask 13). */
export const invoiceDetailsDone = (s: Pick<SponsorshipSettings, 'mailingAddress'>): boolean => !!s.mailingAddress;
