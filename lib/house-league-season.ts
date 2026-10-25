import { formatStoredDate, tournamentToday } from './timezone';
import { pluralize } from './utils';
import { isFinishedLeagueSeason, type HouseLeagueAccess } from './house-league-access';
import { seasonCharges, seasonPriceRange } from './league-price';
import type { LeagueSeasonStatus } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ONE HOUSE-LEAGUE SEASON, AS EVERY SCREEN NAMES IT (Club Tier Stage 9a, Parts 2–5; owner 9a·1–9a·3, Q14, Q16, Q18,
 * Q12; words `docs/projects/active/HOUSE_LEAGUE_STAGE9A_COPY.md` §2 and §7).
 *
 * The season's pages (the rail's block, the phone's strip), what is happening in it (the pill on the home, the header and
 * the public rows), which group it sits in on the home, and the order the switcher lists seasons. One home, so the rail,
 * the phone and the home can never call one season two things.
 *
 * Client-safe: no server imports.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export type SeasonPageKey = 'overview' | 'registrations' | 'teams' | 'schedule' | 'standings' | 'money' | 'notifications';

/**
 * The season's pages, in the rail's order (9a·2). Money is the old Ledger, renamed (Q18; its old path redirects). "Email
 * families" still opens the season's own composer (the old Notifications page) until 9d switches it over (owner
 * 2026-10-24, plan §0c).
 */
export const SEASON_PAGES: readonly { key: SeasonPageKey; segment: string; label: string }[] = [
  { key: 'overview', segment: '', label: 'Overview' },
  { key: 'registrations', segment: 'registrations', label: 'Registrations' },
  { key: 'teams', segment: 'teams', label: 'Teams & draft' },
  { key: 'schedule', segment: 'schedule', label: 'Schedule' },
  { key: 'standings', segment: 'standings', label: 'Standings' },
  { key: 'money', segment: 'money', label: 'Money' },
  { key: 'notifications', segment: 'notifications', label: 'Email families' },
];

/** The pages this person can open (frame F): a treasurer's is Money alone; Email families needs the people who send it. */
export function seasonPagesFor(access: Pick<HouseLeagueAccess, 'read' | 'readMoney' | 'email'>) {
  return SEASON_PAGES.filter(p => {
    if (p.key === 'money') return access.readMoney;
    if (p.key === 'notifications') return access.email;
    return access.read;
  });
}

/** The page segment a path inside a season is on ('' = the season's Overview). The old Ledger path reads as Money. */
export function seasonSegment(pathname: string): string {
  const seg = pathname.match(/\/house-league\/seasons\/[^/]+\/([^/?#]+)/)?.[1] ?? '';
  return seg === 'ledger' ? 'money' : seg;
}

/** Which of the season's pages a path is on. */
export function seasonPageAt(pathname: string): SeasonPageKey {
  const seg = seasonSegment(pathname);
  return SEASON_PAGES.find(p => p.segment === seg)?.key ?? 'overview';
}

/** A season page's address. */
export function seasonPageHref(seasonPath: string, segment: string): string {
  return segment ? `${seasonPath}/${segment}` : seasonPath;
}

// ── What is happening (the pill) ───────────────────────────────────────────────────────────────

export type SeasonTone = 'neutral' | 'green' | 'amber';
export type SeasonGroup = 'running' | 'ready' | 'past';

type Dated = {
  status: LeagueSeasonStatus | string;
  seasonStartDate?: string | null;
  seasonEndDate?: string | null;
};

const dayLabel = (value: string, today: string) => formatStoredDate(value, { withYear: !value.startsWith(today.slice(0, 4)) });
/** A stored date's day (date-only, or a timestamp's first ten characters). */
const dayOf = (v?: string | null) => v?.slice(0, 10) ?? null;

/**
 * Where an under-way season stands against the club's today: before its first day, after its last (the end day itself is
 * still playing), or playing. No start date counts as started, no end date as not yet ended.
 */
function phase(season: Dated, today: string): { kind: 'upcoming'; start: string } | { kind: 'ended'; end: string } | { kind: 'playing' } {
  const start = dayOf(season.seasonStartDate), end = dayOf(season.seasonEndDate);
  if (start && today < start) return { kind: 'upcoming', start };
  if (end && today > end) return { kind: 'ended', end };
  return { kind: 'playing' };
}

/**
 * The pill (copy §2): status decides, and on a running season the club's today against its dates picks the word. Whole
 * days, the end date inclusive; no start date counts as started, no end date as not yet ended.
 */
export function seasonState(season: Dated, today: string = tournamentToday()): { label: string; tone: SeasonTone } {
  switch (season.status) {
    case 'draft': return { label: 'Getting ready', tone: 'neutral' };
    case 'registration_open': return { label: 'Registration open', tone: 'green' };
    case 'registration_closed': return { label: 'Registration closed', tone: 'neutral' };
    case 'completed':
    case 'archived': return { label: 'Finished', tone: 'neutral' };
    default: break;
  }
  const p = phase(season, today);
  if (p.kind === 'upcoming') return { label: `Starts ${dayLabel(p.start, today)}`, tone: 'neutral' };
  if (p.kind === 'ended') return { label: `Ended ${dayLabel(p.end, today)}`, tone: 'amber' };
  return { label: 'Playing now', tone: 'green' };
}

/** True when a running season is past its last day and not yet completed (the home's "complete it" line). */
export function isPastItsEnd(season: Dated, today: string = tournamentToday()): boolean {
  return season.status === 'active' && phase(season, today).kind === 'ended';
}

/** The home's group (9a·1): status alone, never the date. */
export function seasonGroup(season: Pick<Dated, 'status'>): SeasonGroup {
  if (season.status === 'draft') return 'ready';
  if (isFinishedLeagueSeason(season)) return 'past';
  return 'running';
}

/** Newest first: by the season's first day, then by when it was made. */
function newestFirst<T extends Dated & { createdAt?: string | null }>(a: T, b: T): number {
  const ka = a.seasonStartDate ?? a.createdAt ?? '';
  const kb = b.seasonStartDate ?? b.createdAt ?? '';
  return kb.localeCompare(ka);
}

/** The switcher's order (copy §7): live seasons first, newest first; then the finished ones, newest first. */
export function orderSeasons<T extends Dated & { createdAt?: string | null }>(seasons: readonly T[]): T[] {
  const finished = (s: T) => seasonGroup(s) === 'past';
  return [...seasons.filter(s => !finished(s)).sort(newestFirst), ...seasons.filter(finished).sort(newestFirst)];
}

// ── The public side (Q14, frame E; copy §8) ──────────────────────────────────────────────────────

/** Every season the public side lists as live — taking sign-ups, closed for sign-ups, or under way — newest first. */
export function liveLeagueSeasons<T extends Dated & { createdAt?: string | null }>(seasons: readonly T[]): T[] {
  return orderSeasons(seasons.filter(s => seasonGroup(s) === 'running'));
}

/**
 * What a family reads beside a live season (copy §8): Registration open · Registration closed · Starts {date} · Playing now
 * · Final standings (a season past its last day the club has not completed yet). A finished season has no tag (its shelf
 * is the label). The admin's "Ended {date}" is the club's working word; families read "Final standings".
 */
export function publicSeasonState(season: Dated, today: string = tournamentToday()): { label: string; tone: 'ok' | 'neutral' } | null {
  if (season.status === 'registration_open') return { label: 'Registration open', tone: 'neutral' };
  if (season.status === 'registration_closed') return { label: 'Registration closed', tone: 'neutral' };
  if (season.status !== 'active') return null;
  const p = phase(season, today);
  if (p.kind === 'upcoming') return { label: `Starts ${dayLabel(p.start, today)}`, tone: 'neutral' };
  if (p.kind === 'ended') return { label: 'Final standings', tone: 'ok' };
  return { label: 'Playing now', tone: 'ok' };
}

export type PublicSeasonLink = { label: string; href: string; primary?: boolean };

/**
 * One public row's links (copy §8), beside the row's own door to the season page: Register (and the season page) while it
 * takes sign-ups; the season page while sign-ups are closed; Schedule and Standings once it is under way or done.
 * `seasonHref` is the season's public page; its sub-pages hang off it.
 */
export function publicSeasonLinks(season: Pick<Dated, 'status'>, seasonHref: string): PublicSeasonLink[] {
  if (season.status === 'registration_open') {
    return [{ label: 'Register', href: `${seasonHref}/register`, primary: true }, { label: 'Season page', href: seasonHref }];
  }
  if (season.status === 'registration_closed') return [{ label: 'Season page', href: seasonHref }];
  const both = [{ label: 'Schedule', href: `${seasonHref}/schedule` }, { label: 'Standings', href: `${seasonHref}/standings` }];
  return season.status === 'active' ? both : [...both, { label: 'Season page', href: seasonHref }];
}

/** The amber count's spoken label on Registrations (copy §7). */
export function toReviewLabel(n: number): string {
  return `${pluralize(n, 'registration')} to review`;
}

// ── The home's lines and the checklist (copy §1, §3) ───────────────────────────────────────────

/**
 * The day a stored registration open/close time names. The house-league forms store the time as typed with a Z on the end,
 * so the first ten characters ARE the club's day — never re-zone it (an early-morning close would move to the day before).
 * lib/club-home-data.ts and the status windows read it through here.
 */
export function registrationDay(v: string | null | undefined): string | null {
  return dayOf(v);
}

/**
 * A season's web address, made from its name (S1·a, F07): /{club}/league/{address}. Lowercase letters, numbers and single
 * hyphens. A name that makes no address (only symbols or emoji) is refused, never saved with an empty or odd address.
 */
export function seasonSlugFrom(name: string): string {
  return name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '-').replace(/^-|-$/g, '').slice(0, 80).replace(/-$/, '');
}
/** Why an address can't be used (copy §1 `create.err.nameReserved`), or null. */
export function seasonSlugRefusal(slug: string): string | null {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? null : 'That name can’t be used. Try another.';
}

/** The season's fee as one line (copy §3): "$165.00 per player", "Free" at 0, or null when none is set. */
export function feePerPlayerLine(fee: number | null): string | null {
  if (fee == null) return null;
  return fee === 0 ? 'Free' : `${fee.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })} per player`;
}

/** "May 31 – Aug 30, 2026" (the year once, on the last day; both when they differ), or null with no dates. */
export function seasonDates(season: Pick<Dated, 'seasonStartDate' | 'seasonEndDate'>): string | null {
  const start = dayOf(season.seasonStartDate), end = dayOf(season.seasonEndDate);
  if (!start && !end) return null;
  if (start && end) {
    const sameYear = start.slice(0, 4) === end.slice(0, 4);
    return `${formatStoredDate(start, { withYear: !sameYear })} – ${formatStoredDate(end, { withYear: true })}`;
  }
  return formatStoredDate((start ?? end)!, { withYear: true });
}

/** What the home and the checklist read off one season's summary. */
export type SeasonFacts = Dated & {
  sport: string;
  divisionCount: number;
  activeRegistrationCount: number;
  teamCount: number;
  spotCount: number | null;
  /** Required checklist steps still to do (a draft season; computed by seasonChecklist where the divisions are read). */
  checklistLeft?: number;
};

/** The one line of facts per row (copy §1): always dates · sport · divisions, then what the state counts. */
export function seasonFactsLine(f: SeasonFacts): string {
  const parts = [seasonDates(f) ?? 'Dates not set', f.sport, pluralize(f.divisionCount, 'division')];
  if (f.status === 'draft') return parts.join(' · ');
  if (f.status === 'registration_open') {
    parts.push(f.spotCount != null
      ? `${f.activeRegistrationCount} of ${pluralize(f.spotCount, 'spot')} taken`
      : pluralize(f.activeRegistrationCount, 'player'));
    return parts.join(' · ');
  }
  parts.push(pluralize(f.activeRegistrationCount, 'player'), pluralize(f.teamCount, 'team'));
  return parts.join(' · ');
}

/** Dollars as a family and a convenor read them (9b-1 copy §0): "$165", "$165.50" only with cents, **Free** at 0. */
export function dollarsLine(n: number): string {
  if (n === 0) return 'Free';
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** What the checklist reads off one division. */
export type ChecklistDivision = {
  capacity: number | null;
  bornFromYear: number | null;
  bornToYear: number | null;
  price: number | null;
  earlyPrice: number | null;
};
/** What the checklist reads off the season. */
export type ChecklistSeason = {
  registrationFee: number | null;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
  earlyBirdUntil: string | null;
  howToPay: string | null;
  waiverText: string | null;
};
export type ChecklistKey = 'ageGroups' | 'prices' | 'dates' | 'pay' | 'waiver';
export type ChecklistStep = { key: ChecklistKey; title: string; done: boolean; optional: boolean; line: string };

/** A division is set up once it has birth years (either side) and a size. */
const divisionReady = (d: ChecklistDivision) => (d.bornFromYear != null || d.bornToYear != null) && d.capacity != null && d.capacity > 0;

/**
 * The checklist before Open registration (9b-1 copy §6; owner 9b·1): age groups with birth years and a size · prices · the
 * form's dates · how to pay (only when a price is above $0) · the waiver (optional, never blocks). The same function feeds
 * the season page, the home's line and the server's refusal, so the page can never offer what the server refuses.
 */
export function seasonChecklist(season: ChecklistSeason, divisions: readonly ChecklistDivision[]): ChecklistStep[] {
  const steps: ChecklistStep[] = [];
  const unready = divisions.filter(d => !divisionReady(d)).length;
  steps.push({
    key: 'ageGroups', title: 'Age groups', optional: false, done: divisions.length > 0 && unready === 0,
    line: divisions.length === 0 ? 'Add your age groups, each with birth years and a size'
      : unready > 0 ? `${pluralize(unready, 'division')} still ${unready === 1 ? 'needs' : 'need'} birth years or a size`
      : divisions.length === 1 ? '1 division, with birth years and a size'
      : `${pluralize(divisions.length, 'division')}, each with birth years and a size`,
  });

  const range = seasonPriceRange(divisions, season);
  const early = !!dayOf(season.earlyBirdUntil) && divisions.some(d => d.earlyPrice != null);
  const priceLine = range == null ? null
    : range.low === range.high ? dollarsLine(range.low)
    : `${dollarsLine(range.low)} – ${dollarsLine(range.high)}`;
  steps.push({
    key: 'prices', title: 'Prices', optional: false, done: range != null,
    line: priceLine == null ? 'Set a price for each age group. Enter 0 if it is free.'
      : early ? `${priceLine} · early bird through ${formatStoredDate(dayOf(season.earlyBirdUntil)!)}` : priceLine,
  });

  const opens = registrationDay(season.registrationOpenAt), closes = registrationDay(season.registrationCloseAt);
  steps.push({
    key: 'dates', title: 'Registration dates', optional: false, done: !!opens && !!closes,
    line: opens && closes ? `${formatStoredDate(opens)} – ${formatStoredDate(closes)}` : 'Set when the form opens and closes',
  });

  if (seasonCharges(divisions, season)) {
    const pay = season.howToPay?.trim();
    steps.push({
      key: 'pay', title: 'How to pay', optional: false, done: !!pay,
      line: pay ? (pay.length > 60 ? `${pay.slice(0, 60).trimEnd()}…` : pay) : 'Tell families how to pay. They see it once a child is accepted.',
    });
  }

  const waiver = !!season.waiverText?.trim();
  steps.push({
    key: 'waiver', title: 'Waiver', optional: true, done: waiver,
    line: waiver ? 'On. Families agree on the form.' : 'Optional. Families sign up without one.',
  });
  return steps;
}

/** The required steps still to do. */
export function checklistLeft(steps: readonly ChecklistStep[]): ChecklistStep[] {
  return steps.filter(st => !st.optional && !st.done);
}

const FOOT_ONE: Record<Exclude<ChecklistKey, 'waiver'>, string> = {
  ageGroups: 'Add age groups to open registration.',
  prices: 'Set the prices to open registration.',
  dates: 'Set the dates to open registration.',
  pay: 'Add how to pay to open registration.',
};

/** The checklist's foot line (copy §6), only while a required step is left; null once Open registration can show. */
export function checklistFoot(steps: readonly ChecklistStep[]): string | null {
  const left = checklistLeft(steps);
  if (left.length === 0) return null;
  if (left.length === 1) return FOOT_ONE[left[0].key as Exclude<ChecklistKey, 'waiver'>];
  return `Finish ${left.length} more steps to open registration.`;
}

const LEFT_WORDS: Record<Exclude<ChecklistKey, 'waiver'>, string> = {
  ageGroups: 'age groups', prices: 'prices', dates: 'registration dates', pay: 'how to pay',
};

/** The server's refusal to open registration (copy §12 `refuse.open.checklist`), or null when every required step is done. */
export function openRegistrationRefusal(season: ChecklistSeason, divisions: readonly ChecklistDivision[]): string | null {
  const left = checklistLeft(seasonChecklist(season, divisions));
  if (left.length === 0) return null;
  if (left.length === 1 && left[0].key === 'pay') return 'Add how to pay before you open registration. At least one division has a price.';
  const words = left.map(st => LEFT_WORDS[st.key as Exclude<ChecklistKey, 'waiver'>]);
  const list = words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
  return `Registration can’t open yet. Still to do: ${list}.`;
}

/**
 * The row's second line (copy §1), only when it has something true to say. `canRun` = the person can move the season
 * (the line never names a door they don't have).
 */
export function seasonNoteLine(
  f: SeasonFacts & { registrationCloseAt?: string | null; registrationFee: number | null },
  canRun: boolean,
  today: string = tournamentToday(),
): string | null {
  if (isPastItsEnd(f, today)) return canRun ? 'Past its end date: complete it from the season page' : 'Past its end date';
  if (f.status === 'registration_open' && f.registrationCloseAt) {
    const closeDay = registrationDay(f.registrationCloseAt)!;
    const close = formatStoredDate(closeDay, { withYear: true });
    return closeDay >= today ? `Registration closes ${close}` : `Registration was set to close ${close}`;
  }
  if (f.status === 'registration_closed') return canRun ? 'Registration is closed. Start the season from its page.' : 'Registration is closed.';
  if (f.status === 'draft') {
    const left = f.checklistLeft ?? 0;
    return left ? `${pluralize(left, 'thing')} to do before registration can open` : 'Ready to open registration';
  }
  return null;
}
