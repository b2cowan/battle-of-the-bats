/**
 * OFFER AGAIN — THE RULES (Board Ready Stage 6, Part 4a; owner rulings 1A–12A, 2026-11-25, plan BOARD_READY_PLAN.md §5 Stage 6
 * "Part 4a"; drawing BOARD_READY_STAGE6_P4A_OFFER_AGAIN_DRAWINGS.html). Pure and client-safe: the batch window's read, its
 * press and one old deal's "Offer again…" (12A) all ask these same answers, so what the window says can go is what the press
 * sends (/legal 2026-11-25 must-fix 1).
 *
 *   · 2A — one row per deal offered last year that wasn't withdrawn; a row leaves when a deal holding a place this year
 *     (ruling 1A's rule, `holdsPlace`) replaces it: one held deal, one row, so a business with two deals on a package is
 *     offered both (owner 2026-11-25). Three groups: Ready, Waiting, Can't be emailed. Ticked only when it can go.
 *   · 3A — a tournament asks for this year's, pre-picked when exactly one live tournament (not last year's own) has last
 *     year's name with its year taken off; none live → waits. No series link.
 *   · 4A — the package's last day when it hasn't passed; when it has, the row asks, filled with the same day a year on.
 *   · 5A — a team is picked again: last year's division's teams first; unticked until a team is picked; no new teams → waits.
 *   · 6A — a division carries over by name (one live match, not last year's own); none → waits; two or more → asks which.
 *   · 7A — an archived package can't be emailed. 8A — every row that can go rests on "They paid us in the last 2 years",
 *     dated by the business's latest payment that still stands (worked out on the server, `paidOn`), never typed.
 *   · 9A — this year's price, last year's as a hint when different; the Charge switch copies last year's while registered.
 */
import { addCalendarDays, addCalendarMonths } from './timezone';
import { holdingDeals, emailBarFor, reasonHolds, takenOf, type ClubDeal } from './club-sponsorship-deals';
import { barSentence, DEAL_WORDS } from './club-sponsorship-deal-words';
import { fiscalYearOf, previousFiscalYear, type FiscalSetting } from './club-fiscal-year';
import { normalizeTournamentName } from './tournament-name';
import { packageFull, type PlaceTargets, type SponsorPlaceKind, type SponsorshipPackage } from './club-sponsorships';

const A = DEAL_WORDS.again;

export interface YearSpan { firstDay: string; lastDay: string; name: string }

/** The most rows one request of the batch press carries; the window posts a longer press in turns. */
export const AGAIN_MAX_ROWS = 100;

/** This fiscal year and the one before it: the two every Offer again answer is worked out from. */
export function againYears(today: string, setting: FiscalSetting): { thisYear: YearSpan; lastYear: YearSpan } {
  const thisYear = fiscalYearOf(today, setting);
  return { thisYear, lastYear: previousFiscalYear(thisYear, setting) };
}

/** A place choice in a row's picker (asks 3, 5, 6); `group` heads a team's picker (5A). */
export interface PlaceChoice { id: string; name: string; label: string; group: string | null }

/** How a row's place carries over. `pick` with `chosen` is pre-picked (a single tournament name match) and can go as it is. */
export type AgainPlace =
  | { status: 'ok'; targetId: string | null; targetName: string | null; label: string | null }
  | { status: 'pick'; choices: PlaceChoice[]; chosen: string | null; lastYear: string | null; prompt: string }
  | { status: 'wait'; why: string };

export type AgainGroup = 'ready' | 'waiting' | 'blocked';

export interface AgainRow {
  dealId: string;
  sponsorId: string;
  businessName: string;
  email: string | null;
  packageId: string;
  packageName: string;
  placeKind: SponsorPlaceKind;
  price: number;
  /** Last year's amount, only when it differs from this year's price (9A). */
  lastPrice: number | null;
  chargeTax: boolean;
  /** Last year's team, for the row's grey line (drawing tab 3: "· last year U9 Sharks"). */
  lastTeam: string | null;
  place: AgainPlace;
  /** The new deal's last day (4A). */
  endsOn: string | null;
  /** The package's own last day when it has passed: the row shows a last-day field, filled with `endsOn` (4A). */
  lastDayPassed: string | null;
  /** The business's latest payment that still stands (8A), null when none. */
  paidOn: string | null;
  group: AgainGroup;
  /** Why it waits or can't be emailed. */
  why: string | null;
  /** Ticked when the window opens (2A): it can go as it is. */
  ticked: boolean;
}

export interface AgainInput {
  today: string;
  thisYear: YearSpan;
  lastYear: YearSpan;
  clubName: string;
  deals: readonly ClubDeal[];
  packages: readonly SponsorshipPackage[];
  targets: PlaceTargets;
  contacts: readonly { id: string; email: string | null }[];
  bars: { stops: ReadonlyMap<string, { source: 'unsubscribe' | 'club'; on: string }>; family: ReadonlySet<string> };
  /** sponsorId → the day of its latest payment that still stands (`readStandingPaidOn`). */
  paidOn: ReadonlyMap<string, string>;
  registered: boolean;
}

const norm = (s: string | null | undefined) => normalizeTournamentName(s ?? '');
const choice = (x: { id: string; name: string }, label = x.name, group: string | null = null): PlaceChoice => ({ id: x.id, name: x.name, label, group });

/** A tournament's name with its year taken off ("Spring Classic 2027" → "spring classic"), for 3A's single-match pre-pick. */
export function nameWithoutYear(name: string | null | undefined): string {
  return norm((name ?? '').replace(/\b(19|20)\d{2}\b/g, ' '));
}

/** 4A: the package's last day when it hasn't passed; when it has, the same day a year on (and on, until it is today or later). */
export function lastDayFor(showsUntil: string | null, today: string): { endsOn: string | null; passed: string | null } {
  if (!showsUntil) return { endsOn: null, passed: null };
  if (showsUntil >= today) return { endsOn: showsUntil, passed: null };
  let next = addCalendarMonths(showsUntil, 12);
  while (next < today) next = addCalendarMonths(next, 12);
  return { endsOn: next, passed: showsUntil };
}

/** The one live season other than `exceptSeason`, when there is exactly one (the waiting rows' "Spring 2028 …"). */
function onlyOtherSeason(targets: PlaceTargets, exceptSeason: string | null): string | null {
  const names = new Map<string, string>();
  for (const x of [...targets.divisions, ...targets.teams]) if (x.live && x.seasonId !== exceptSeason) names.set(x.seasonId, x.seasonName);
  return names.size === 1 ? [...names.values()][0] : null;
}

/** How last year's deal's place carries over to a package of `kind` (asks 3, 5, 6). Last year's own place is never offered. */
export function resolvePlace(d: Pick<ClubDeal, 'placeKind' | 'targetId' | 'targetName'>, kind: SponsorPlaceKind, targets: PlaceTargets): AgainPlace {
  if (kind === 'club') return { status: 'ok', targetId: null, targetName: null, label: null };
  const same = d.placeKind === kind;
  const oldId = same ? d.targetId : null;
  const oldName = same ? d.targetName : null;

  if (kind === 'division') {
    const old = targets.divisions.find(x => x.id === oldId) ?? null;
    const live = targets.divisions.filter(x => x.live && x.id !== oldId);
    if (!oldName) {
      if (!live.length) return { status: 'wait', why: A.waitPlace };
      return { status: 'pick', chosen: null, lastYear: null, prompt: A.pickAnyDivision,
        choices: live.map(x => choice(x, A.divisionChoice(x.name, x.seasonName))) };
    }
    const hits = live.filter(x => norm(x.name) === norm(oldName));
    if (hits.length === 1) return { status: 'ok', targetId: hits[0].id, targetName: hits[0].name, label: A.divisionPlace(hits[0].name, hits[0].seasonName) };
    if (!hits.length) return { status: 'wait', why: A.waitDivision(onlyOtherSeason(targets, old?.seasonId ?? null), oldName) };
    return {
      status: 'pick', chosen: null, lastYear: null, prompt: A.pickDivision(oldName),
      choices: hits.map(x => choice(x, A.divisionChoice(x.name, x.seasonName))),
    };
  }

  if (kind === 'team') {
    const old = targets.teams.find(x => x.id === oldId) ?? null;
    // "Picked again once the new teams exist" (5A): a team in last year's own season is never a new team.
    const live = targets.teams.filter(x => x.live && x.id !== oldId && (!old || x.seasonId !== old.seasonId));
    if (!live.length) return { status: 'wait', why: A.waitTeams(onlyOtherSeason(targets, old?.seasonId ?? null)) };
    const firstDiv = norm(old?.divisionName);
    // Last year's division's teams first, under their own heading; every other team after, under "Other teams".
    const sameDivision = (x: { divisionName: string }) => !!firstDiv && norm(x.divisionName) === firstDiv;
    const choices = [
      ...live.filter(sameDivision).map(x => choice(x, x.name, A.teamGroup(x.divisionName, x.seasonName))),
      ...live.filter(x => !sameDivision(x)).map(x => choice(x, x.name, A.otherTeams)),
    ];
    return { status: 'pick', choices, chosen: null, lastYear: oldName ? A.lastYearPlace(oldName) : null, prompt: A.pickTeam };
  }

  // A tournament (3A).
  const live = targets.tournaments.filter(x => x.live && x.id !== oldId);
  if (!live.length) return { status: 'wait', why: A.waitTournament };
  const key = nameWithoutYear(oldName);
  const named = key ? live.filter(x => nameWithoutYear(x.name) === key) : [];
  return {
    status: 'pick', chosen: named.length === 1 ? named[0].id : null, lastYear: oldName ? A.lastYearPlace(oldName) : null, prompt: A.pickTournament,
    choices: live.map(x => choice(x)),
  };
}

/** A place the press may use for a row: what the read worked out, or a pick among the row's own choices — nothing else. */
export function placeForPress(place: AgainPlace, picked: string | null): { targetId: string | null; targetName: string | null } | null {
  if (place.status === 'ok') return { targetId: place.targetId, targetName: place.targetName };
  if (place.status === 'wait') return null;
  const id = picked ?? place.chosen;
  const hit = id ? place.choices.find(c => c.id === id) : null;
  return hit ? { targetId: hit.id, targetName: hit.name } : null;
}

/** What this package has taken today (ruling 1A's rule). */
const takenToday = (packageId: string, input: AgainInput) => takenOf(holdingDeals(input.deals, input.today, input.thisYear), packageId);

/** A deal made within this many days of the older one's last day (or later) reads as its renewal, not a second one beside it. */
const RENEWAL_WINDOW_DAYS = 90;

/**
 * Does `h`, held now, renew the older `p` of the same business and package? Anything offered this fiscal year does. Within
 * last year, only one that runs past it and was made near its end or after (a December renewal of a deal ending that month);
 * beside an older deal with no last day, only one made at least as long after it. Two bought side by side renew neither.
 */
function renews(h: ClubDeal, p: ClubDeal, thisYear: YearSpan): boolean {
  if (h.offeredOn >= thisYear.firstDay) return true;
  if (!p.endsOn) return h.offeredOn >= addCalendarDays(p.offeredOn, RENEWAL_WINDOW_DAYS);
  return !!h.endsOn && h.endsOn > p.endsOn && h.offeredOn >= addCalendarDays(p.endsOn, -RENEWAL_WINDOW_DAYS);
}

/**
 * Which of one year's deals nothing held now has replaced (2A; owner 2026-11-25). A deal holding its place today leaves its
 * own row off, and takes ONE older deal of the same business and package off with it: one it renews, the same place's name
 * first (a year in a tournament's name aside), else the oldest.
 */
export function notReplaced(olds: readonly ClubDeal[], all: readonly ClubDeal[], today: string, thisYear: YearSpan): ClubDeal[] {
  const holders = [...holdingDeals(all, today, thisYear)].sort((a, b) => a.offeredOn.localeCompare(b.offeredOn));
  const holding = new Set(holders.map(h => h.id));
  let left = olds.filter(d => d.state !== 'withdrawn' && !holding.has(d.id)).sort((a, b) => a.offeredOn.localeCompare(b.offeredOn));
  for (const h of holders) {
    const renewed = left.filter(p => p.sponsorId === h.sponsorId && p.packageId === h.packageId && p.offeredOn < h.offeredOn && renews(h, p, thisYear));
    const gone = renewed.find(p => nameWithoutYear(p.targetName) === nameWithoutYear(h.targetName)) ?? renewed[0];
    if (gone) left = left.filter(p => p !== gone);
  }
  return olds.filter(d => left.includes(d));
}

/** One old deal as Offer again sees it (the batch's row, and 12A's fill). Null when it can't be a row at all. */
function againRowOf(d: ClubDeal, input: AgainInput): AgainRow | null {
  if (d.state === 'withdrawn') return null;
  const pkg = input.packages.find(p => p.id === d.packageId);
  if (!pkg) return null;

  const contact = input.contacts.find(c => c.id === d.sponsorId) ?? null;
  const email = contact?.email ?? d.offeredTo ?? null;
  const paidOn = input.paidOn.get(d.sponsorId) ?? null;
  const place = resolvePlace(d, pkg.placeKind, input.targets);
  const last = lastDayFor(pkg.showsUntil, input.today);

  let group: AgainGroup = 'ready';
  let why: string | null = null;
  const bar = barSentence(emailBarFor(email, input.bars.stops, input.bars.family), input.clubName);
  if (pkg.archivedAt) { group = 'blocked'; why = A.archived(pkg.name); }
  else if (bar) { group = 'blocked'; why = bar; }
  else if (!email) { group = 'blocked'; why = A.noEmail; }
  // A paid deal with no payment that stands (disputed, or going back) isn't "never paid".
  else if (!paidOn) { group = 'blocked'; why = d.state === 'paid' ? A.noStandingPayment : A.neverPaid(input.lastYear.name); }
  else if (!reasonHolds('paid_recently', paidOn, input.today)) { group = 'blocked'; why = A.lapsed(paidOn); }
  else if (packageFull(pkg, takenToday(pkg.id, input))) { group = 'waiting'; why = A.waitFull; }
  else if (place.status === 'wait') { group = 'waiting'; why = place.why; }

  const lastTeam = d.placeKind === 'team' && pkg.placeKind === 'team' ? d.targetName : null;
  return {
    dealId: d.id, sponsorId: d.sponsorId, businessName: d.businessName, email, packageId: pkg.id, packageName: pkg.name,
    placeKind: pkg.placeKind, price: pkg.price, lastPrice: Math.round(d.amount * 100) !== Math.round(pkg.price * 100) ? d.amount : null,
    chargeTax: input.registered && d.chargeTax, lastTeam, place, endsOn: last.endsOn, lastDayPassed: last.passed, paidOn,
    group, why, ticked: group === 'ready' && placeForPress(place, null) != null,
  };
}

/** The deals offered in one fiscal year. */
export const offeredIn = <T extends Pick<ClubDeal, 'offeredOn'>>(deals: readonly T[], year: YearSpan): T[] =>
  deals.filter(d => d.offeredOn >= year.firstDay && d.offeredOn <= year.lastDay);

/** The batch window's rows (2A): last year's deals, in the order they were offered. */
export function againRows(input: AgainInput): AgainRow[] {
  const rows = notReplaced(offeredIn(input.deals, input.lastYear), input.deals, input.today, input.thisYear)
    .map(d => againRowOf(d, input))
    .filter((r): r is AgainRow => r != null);
  // Ticked only when it can go (2A): a package with a limit ticks as many rows as it has places left, in order.
  const left = new Map<string, number>();
  return rows.map(r => {
    const pkg = r.ticked ? input.packages.find(p => p.id === r.packageId) : undefined;
    if (!pkg || pkg.howMany == null) return r;
    const taken = takenToday(pkg.id, input);
    const places = left.get(pkg.id) ?? pkg.howMany - (taken.paid + taken.invoiced + taken.offered);
    left.set(pkg.id, places - 1);
    return places > 0 ? r : { ...r, ticked: false };
  });
}

/** The callout (11A): businesses that paid a deal last year ("sponsored you"), and how many rows can still be offered. */
export function againCallout(input: AgainInput, rows: readonly AgainRow[]): { sponsored: number; left: number } {
  const paid = new Set(offeredIn(input.deals, input.lastYear).filter(d => d.state === 'paid').map(d => d.sponsorId));
  return { sponsored: paid.size, left: rows.filter(r => r.group !== 'blocked').length };
}

/** A paid deal from an earlier fiscal year: the only kind 12A offers again from its page. */
export const isOldPaidDeal = (d: Pick<ClubDeal, 'state' | 'offeredOn'>, thisYear: Pick<YearSpan, 'firstDay'>): boolean =>
  d.state === 'paid' && d.offeredOn < thisYear.firstDay;

/** 12A: an old deal's page offers again only on a PAID deal from an earlier fiscal year whose row can be emailed — never on one
 *  whose reason has run out (/legal must-fix 5), that a deal held this year has replaced, or whose address can't be emailed.
 *  `dealYear` is the old deal's own fiscal year (its neighbours there decide which one a renewal replaced). */
export function canOfferAgainOne(d: ClubDeal, input: AgainInput, dealYear: YearSpan): AgainRow | null {
  if (!isOldPaidDeal(d, input.thisYear)) return null;
  if (!notReplaced(offeredIn(input.deals, dealYear), input.deals, input.today, input.thisYear).some(x => x.id === d.id)) return null;
  const row = againRowOf(d, input);
  return row && row.group !== 'blocked' ? row : null;
}

/** One old deal's "Offer again…" (12A): the ordinary Offer window, filled in. */
export interface OfferPrefill {
  sponsorId: string;
  packageId: string;
  targetId: string | null;
  amount: number;
  endsOn: string | null;
  chargeTax: boolean;
  /** The business's latest payment that still stands: the reason's day, worked out by the server (/legal must-fix 5). */
  paidOn: string;
  /** "Last year: U9 · Spring 2027" under Shows on. */
  lastYearPlace: string | null;
}
