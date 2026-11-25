/**
 * lib/prospect-clubs.ts — Prospect clubs, the owner's list of preview clubs, and the rules of its make window
 * (Club Website Track P, Session P2; owner rulings T2–T6, 2026-11-25; drawing Tx3So1rUqL6shn7CzM93Zr, tabs 2 and 3).
 *
 * Pure and client-safe: the screen checks a field as it is typed with the same rules the route re-checks, and the route
 * hands the database the final say (mig 536 `make_preview_club`, which re-checks the cap, the name, the address, Québec
 * and the meeting window under one lock). What a preview IS lives in `lib/preview-org.ts`.
 */
import { CANADIAN_PROVINCES } from './canadian-provinces';
import { OFFERED_SPORT_OPTIONS } from './sports';
import { addCalendarDays, daysBetweenDateStrings, formatShortWeekdayDate, orgDayKey, tournamentToday, utcToZonedInputs } from './timezone';
import { formatTime } from './utils';

/** T6: at most five open at once. */
export const OPEN_PREVIEW_CAP = 5;
/** A meeting is at most 60 days out, so a preview lives at most 90 days (tab 3). */
export const MEETING_MAX_DAYS = 60;
/** T11: removed 30 days after the meeting unless claimed. The date is never stored: it moves with the meeting. */
export const REMOVAL_AFTER_DAYS = 30;
/** The logo, as the club's own logo upload takes it (`lib/org-image-limits.ts`): no SVG in a public bucket. */
export const PREVIEW_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const PREVIEW_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const PREVIEW_NAME_MAX = 80;
export const PREVIEW_LINE_MAX = 120;

/** The provinces the window offers. Québec is listed and refused where it is picked (/legal: Club is not on sale there). */
export const PREVIEW_PROVINCES = CANADIAN_PROVINCES;
export const PREVIEW_SPORTS = OFFERED_SPORT_OPTIONS;

// ── The words (tab 3; /marketing's pass is recorded in the plan's Progress block) ───────────────────────────────────────
export const MAKE_WORDS = {
  title: 'Make a club for a meeting',
  submit: 'Make the club',
  making: 'Making the club…',
  makingLine: (name: string) => `Making ${name}: its site, the sample season and the tournament.`,
  failed: 'Nothing was made. Try again. If it fails again, look in Errors.',
  capTitle: 'Make a club for a meeting',
  cap: `${OPEN_PREVIEW_CAP} previews are open, the most allowed at once. When one is removed, you can make this one.`,
  addressHint: 'The club keeps this address if it claims the preview.',
  sourceHint: 'The address of the club’s own website or social page. Use only a logo the club published itself. The colours come from that logo.',
  lineHint: 'Write it yourself. Don’t copy the club’s own words. No names, ages or numbers.',
  meetingHint: 'The sample tournament’s first game starts at this time, Eastern time.',
  holdsTitle: 'What every preview holds',
  holds: 'A house league season (3 divisions, 12 teams), 4 rep teams, a one-day tournament on the meeting day, and 3 sample sponsors. Every name is made up. No players, families or coaches.',
  live: 'Made on the live site: unlisted, never in search, and it sends no emails of its own. Every page says it was prepared by FieldLogicHQ and is not the club’s site yet.',
  removal: (date: string) => `It will be removed on ${date}, 30 days after the meeting, unless the club claims it.`,
  youGet: 'You get a link, a QR code and a claim code for the room.',
  err: {
    name: 'Write the club’s name.',
    nameLong: `Keep the name to ${PREVIEW_NAME_MAX} characters.`,
    exists: (name: string) => `${name} already runs its own club on FieldLogicHQ, so it can’t have a preview.`,
    hasPreview: (name: string) => `${name} already has a preview.`,
    slug: 'Use 3 to 60 lowercase letters, numbers or dashes.',
    slugTaken: 'That address is taken. Try another.',
    sport: 'Pick the club’s sport.',
    province: 'Pick the club’s province.',
    quebec: 'The Club plan isn’t on sale in Québec yet, so a club there can’t have a preview.',
    logo: 'Add the club’s logo.',
    logoType: 'This file can’t be read. Use a PNG, JPG or WebP.',
    logoBig: 'This logo is over 2 MB. Use a smaller file.',
    source: 'Say where the club published this logo.',
    sourceShape: 'Use the address of the club’s own website or social page, starting with https://.',
    colour: 'Pick a colour.',
    lineLong: `Keep the line to ${PREVIEW_LINE_MAX} characters.`,
    lineNumbers: 'Leave out ages, numbers and dates.',
    meeting: 'Pick the meeting’s date and time.',
    meetingWindow: `Pick a meeting in the next ${MEETING_MAX_DAYS} days.`,
  },
} as const;

// ── The make window's fields ───────────────────────────────────────────────────────────────────────────────────────
export type MakeField = 'name' | 'slug' | 'sport' | 'province' | 'logo' | 'source' | 'primary' | 'accent' | 'line' | 'meeting';
export type MakeErrors = Partial<Record<MakeField, string>>;

export type MakeInput = {
  name: string;
  slug: string;
  sport: string;
  province: string;
  /** The logo as picked, or null; its size and type are all the rules need. */
  logo: { type: string; size: number } | null;
  source: string;
  primary: string;
  accent: string;
  line: string;
  /** The meeting as the window holds it: `YYYY-MM-DDTHH:MM`, the club's wall clock (America/Toronto). */
  meeting: string;
  /** The same meeting as a UTC instant, or null when it does not parse. */
  meetingAt: string | null;
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;

/** The field-by-field refusals the window and the route both say (the "already on FieldLogicHQ" ones need the database). */
export function makeFieldErrors(input: MakeInput, now: Date = new Date()): MakeErrors {
  const e: MakeErrors = {};
  const name = input.name.trim();
  if (!name) e.name = MAKE_WORDS.err.name;
  else if (name.length > PREVIEW_NAME_MAX) e.name = MAKE_WORDS.err.nameLong;
  const slug = input.slug.trim();
  if (!SLUG_RE.test(slug) || slug.length < 3 || slug.length > 60) e.slug = MAKE_WORDS.err.slug;
  if (!PREVIEW_SPORTS.some(s => s.id === input.sport)) e.sport = MAKE_WORDS.err.sport;
  if (input.province === 'QC') e.province = MAKE_WORDS.err.quebec;
  else if (!PREVIEW_PROVINCES.some(p => p.code === input.province)) e.province = MAKE_WORDS.err.province;
  if (!input.logo) e.logo = MAKE_WORDS.err.logo;
  else if (!(PREVIEW_LOGO_TYPES as readonly string[]).includes(input.logo.type)) e.logo = MAKE_WORDS.err.logoType;
  else if (input.logo.size > PREVIEW_LOGO_MAX_BYTES) e.logo = MAKE_WORDS.err.logoBig;
  const source = input.source.trim();
  if (!source) e.source = MAKE_WORDS.err.source;
  else if (!isWebAddress(source)) e.source = MAKE_WORDS.err.sourceShape;
  if (!HEX_RE.test(input.primary)) e.primary = MAKE_WORDS.err.colour;
  if (!HEX_RE.test(input.accent)) e.accent = MAKE_WORDS.err.colour;
  const line = input.line.trim();
  if (line.length > PREVIEW_LINE_MAX) e.line = MAKE_WORDS.err.lineLong;
  // /legal: the club's line carries no ages, numbers or dates (a claim keeps it; a number would read as the club's fact).
  else if (/\d/.test(line)) e.line = MAKE_WORDS.err.lineNumbers;
  if (!input.meetingAt) e.meeting = MAKE_WORDS.err.meeting;
  else if (!meetingInWindow(input.meetingAt, now)) e.meeting = MAKE_WORDS.err.meetingWindow;
  return e;
}

/** An http(s) address with a host (mig 535's CHECK is the backstop): never a bare word or a mail address. */
export function isWebAddress(value: string): boolean {
  if (value.length > 2000) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.includes('.');
  } catch {
    return false;
  }
}

/** T5 + tab 3: after now, and at most 60 days out. */
export function meetingInWindow(meetingAt: string, now: Date = new Date()): boolean {
  const at = Date.parse(meetingAt);
  return Number.isFinite(at) && at > now.getTime() && at <= now.getTime() + MEETING_MAX_DAYS * 86_400_000;
}

/** A club's name as its address (the same rule the start forms preview: `slugifyOrgName`). */
export function suggestedSlug(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
}

// ── The list (tab 2) ───────────────────────────────────────────────────────────────────────────────────────────────
/** A row of `organization_previews`, as the page reads it. */
export type PreviewRecord = {
  orgId: string;
  slug: string;
  name: string;
  meetingAt: string;
  madeBy: string | null;
  claimedAt: string | null;
  removedAt: string | null;
};

export type ProspectState = 'open' | 'claimed' | 'removed';

export type ProspectRow = {
  orgId: string;
  name: string;
  slug: string;
  state: ProspectState;
  /** "Tue, Dec 8 · 7:00 p.m." */
  meeting: string;
  /** "Tue, Dec 8" — the removed and claimed rows' quieter date. */
  meetingDay: string;
  /** "In 13 days" · "Today" · "13 days ago" */
  meetingWhen: string;
  /** Open: the removal date ("Thu, Jan 7") and "43 days left". Removed: the day it was removed. Claimed: null. */
  removal: { date: string; left: string | null } | null;
  /** "Claimed Nov 2" on a claimed row. */
  claimed: string | null;
  madeBy: string;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The removal day: the meeting's day (in the club's zone) plus 30. */
export function removalDay(meetingAt: string): string {
  return addCalendarDays(orgDayKey(meetingAt), REMOVAL_AFTER_DAYS);
}

/** The removal date as the window and the list say it: "Thu, Jan 7, 2027" (the window) or "Thu, Jan 7" (the list). */
export function removalDateLabel(meetingAt: string, withYear = false): string {
  const day = removalDay(meetingAt);
  return withYear ? `${formatShortWeekdayDate(day)}, ${day.slice(0, 4)}` : formatShortWeekdayDate(day);
}

function relativeMeeting(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}

function shortDate(dayKey: string): string {
  const [, m, d] = dayKey.split('-').map(Number);
  return m && d ? `${MONTHS[m - 1]} ${d}` : dayKey;
}

export function prospectRow(r: PreviewRecord, viewerId: string | null, now: Date = new Date()): ProspectRow {
  const today = tournamentToday(now);
  const meetDay = orgDayKey(r.meetingAt);
  const time = formatTime(utcToZonedInputs(r.meetingAt).time);
  const state: ProspectState = r.claimedAt ? 'claimed' : r.removedAt ? 'removed' : 'open';
  const removeDay = removalDay(r.meetingAt);
  const left = daysBetweenDateStrings(today, removeDay);
  return {
    orgId: r.orgId,
    name: r.name,
    slug: r.slug,
    state,
    meeting: `${formatShortWeekdayDate(meetDay)} · ${time}`,
    meetingDay: formatShortWeekdayDate(meetDay),
    meetingWhen: relativeMeeting(daysBetweenDateStrings(today, meetDay)),
    removal: state === 'claimed' ? null
      : state === 'removed' ? { date: formatShortWeekdayDate(orgDayKey(r.removedAt)), left: null }
      : { date: formatShortWeekdayDate(removeDay), left: left <= 0 ? 'Due for removal' : left === 1 ? '1 day left' : `${left} days left` },
    claimed: r.claimedAt ? `Claimed ${shortDate(orgDayKey(r.claimedAt))}` : null,
    // "You" while only the owner makes one (T2); the column stays so a second maker shows the day T2 changes.
    madeBy: r.madeBy && r.madeBy === viewerId ? 'You' : 'Someone else',
  };
}

const STATE_ORDER: Record<ProspectState, number> = { open: 0, claimed: 1, removed: 2 };

/** Open first (the next meeting first, then meetings already held), then claimed, then removed (newest first). */
export function prospectRows(records: readonly PreviewRecord[], viewerId: string | null, now: Date = new Date()): ProspectRow[] {
  const nowMs = now.getTime();
  return [...records]
    .sort((a, b) => {
      const sa = a.claimedAt ? 'claimed' : a.removedAt ? 'removed' : 'open';
      const sb = b.claimedAt ? 'claimed' : b.removedAt ? 'removed' : 'open';
      if (sa !== sb) return STATE_ORDER[sa] - STATE_ORDER[sb];
      const ta = Date.parse(a.meetingAt), tb = Date.parse(b.meetingAt);
      if (sa === 'open') {
        const fa = ta >= nowMs, fb = tb >= nowMs;
        if (fa !== fb) return fa ? -1 : 1;
        return fa ? ta - tb : tb - ta;
      }
      return tb - ta;
    })
    .map(r => prospectRow(r, viewerId, now));
}

export function prospectCounts(rows: readonly { state: ProspectState }[]): Record<ProspectState, number> {
  const c: Record<ProspectState, number> = { open: 0, claimed: 0, removed: 0 };
  for (const r of rows) c[r.state] += 1;
  return c;
}

/** "3 open · 1 claimed · 1 removed" (the counts a T10 reader wants: how many claim). */
export function prospectCountLine(rows: readonly { state: ProspectState }[]): string {
  const c = prospectCounts(rows);
  return `${c.open} open · ${c.claimed} claimed · ${c.removed} removed`;
}

/** The make window's refusals the database answers, by its error code (mig 536). */
export const MAKE_REFUSAL_CODES = {
  PV010: 'cap',
  PV011: 'exists',
  PV012: 'slug',
  PV013: 'quebec',
  PV014: 'meeting',
  PV015: 'hasPreview',
} as const;
