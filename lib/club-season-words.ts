/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S SEASON WINDOWS, IN WORDS (Club Tier Stage 2, specimen 3 — Ask 1 (a), owner 2026-09-28).
 *
 * The standalone head coach's *Start next season* / *Close the season* / *Reopen*, held by the club
 * for a club team. Every sentence the three windows and the team page's season cards say lives here,
 * so they are tested and /marketing reviews one file (drafted 2026-09-29 to the drawing's frames).
 *
 * ⚖ BINDING (owner 2026-08-18): unsettled money WARNS, never blocks — every warning ends by saying
 * the club can still go ahead. ⚠ COUNTS, never dollars: the club reads team money only from Stage 3
 * (D1). ⚠ The roll carries the opening balance from the team's own books at the moment it runs; the
 * window names no amount (the coach adjusts it in Team settings).
 * ⚠ PURE: words only.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { joinWithAnd, pluralize } from './utils';

export interface UnsettledCounts { familiesOwing: number; familiesWaitingToReturn: number }

/** The Start window's first line — the consequence, before anything else (season-close plan §3.2). */
export function startLead(p: { fromName: string; fromIsLive: boolean }): string {
  return p.fromIsLive
    ? `This closes the ${p.fromName}. It becomes a record that you and the team’s coaches can open any time: results, roster, practices and money. Nothing is lost, but it can’t be changed.`
    : `The ${p.fromName} stays closed, as a record. The new season starts from it.`;
}

/** The roster carry's detail: "the 14 active players". */
export function rosterCarryDetail(players: number): string {
  return players === 0 ? 'nobody is on it yet' : `the ${pluralize(players, 'active player')}`;
}

export const START_CARRIES = {
  roster: { title: 'The roster', note: 'The coach adds and removes players after.' },
  budget: { title: 'The budget plan', note: (from: string) => `The planned lines only. What was spent stays with the ${from}.` },
  fees: { title: 'The fee plan', note: (from: string) => `Amounts and installments, with due dates a year later. Paid history stays with the ${from}.` },
  balance: { title: 'The opening balance', note: (from: string) => `Whatever the team’s books hold when the ${from} closes. The coach can change it in Team settings.` },
  history: { title: 'Each returning player’s history', note: 'Linked to last season, so a player’s development record reads straight through.' },
} as const;

export const START_STAFF_NOTE =
  'The coaching staff stays, because coaches belong to the team. Starting fresh: the schedule, tryouts (closed until you open them) and player documents.';

/** The warning's lines, as counts — only the ones that are outstanding. */
export function unsettledLines(u: UnsettledCounts | null | undefined): string[] {
  if (!u) return [];
  const lines: string[] = [];
  if (u.familiesOwing > 0) lines.push(`${pluralize(u.familiesOwing, 'family', 'families')} still ${u.familiesOwing === 1 ? 'owes' : 'owe'} dues`);
  if (u.familiesWaitingToReturn > 0) lines.push(`Money is waiting to go back to ${pluralize(u.familiesWaitingToReturn, 'family', 'families')}`);
  return lines;
}

export function hasUnsettled(u: UnsettledCounts | null | undefined): boolean {
  return unsettledLines(u).length > 0;
}

/** "9U A’s 2026 books aren’t settled:" — the warning's opening, before its lines. */
export function unsettledIntro(teamName: string, seasonYear: number): string {
  return `${teamName}’s ${seasonYear} books aren’t settled:`;
}

/** The Start warning's close: who settles, why now, and that it never blocks. */
export function startWarningTail(p: { headCoachName: string | null; seasonName: string }): string {
  const who = p.headCoachName ? `${p.headCoachName} settles` : 'The team’s head coach settles';
  return `${who} these in the Coaches Portal. After the ${p.seasonName} closes they’re harder to sort out. You can still start.`;
}

/** The Start window's foot: who is told. */
export function startToldLine(headCoachName: string | null): string {
  return headCoachName ? `${headCoachName} and the team’s staff are told when it starts.` : 'The team’s staff are told when it starts.';
}

export function startButton(year: number | null): string {
  return year ? `Start the ${year} Season` : 'Start the season';
}

/** The Close window. */
export function closeTitle(seasonName: string): string {
  return `Close the ${seasonName}?`;
}
export const CLOSE_BODY =
  'This season becomes a record. Everything is kept on one page you can open any time: the results, the roster, the money and the practices.';
export const CLOSE_LATER = 'You can start a new season later; closing now doesn’t prevent it.';
/** The Close warning, one sentence, counts only, never blocking. */
export function closeWarning(u: UnsettledCounts | null | undefined): string | null {
  const parts: string[] = [];
  if (u && u.familiesOwing > 0) parts.push(`${pluralize(u.familiesOwing, 'family', 'families')} still ${u.familiesOwing === 1 ? 'owes' : 'owe'} dues`);
  if (u && u.familiesWaitingToReturn > 0) parts.push(`money is waiting to go back to ${pluralize(u.familiesWaitingToReturn, 'family', 'families')}`);
  if (parts.length === 0) return null;
  // Two independent clauses, so the drawn comma: "…owe dues, and money is waiting…".
  const sentence = parts.join(', and ');
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}. You can still close.`;
}

/** The team page's card for a team with no live season (specimen 3, middle frame). */
export function closedCardLine(p: { teamName: string; seasonName: string; recordText: string | null }): string {
  const final = p.recordText ? `Final ${p.recordText}. ` : '';
  return `${final}${p.teamName} has no season running, so its coaches see the ${p.seasonName}’s page and nothing else.`;
}
export function reopenLink(seasonName: string): string {
  return `Closed this by mistake? Reopen the ${seasonName}`;
}

/** The two-open-seasons refusal, in words (B03: a club's roll never self-heals). */
export function twoOpenTitle(teamName: string, count: number): string {
  return `${teamName} has ${count === 2 ? 'two' : count} seasons open`;
}
export function twoOpenBody(names: string[]): string {
  return `${joinWithAnd(names.map(n => `the ${n}`)).replace(/^t/, 'T')}. Close one of them before starting another. Nothing was changed.`;
}

/** A team sub-page's note while two seasons are open: which one it shows, and where that is settled
 *  (the team page refuses to guess; Roster, Schedule and Tryouts show the newer one). */
export function twoOpenPageNote(showingName: string): string {
  return `This page shows the ${showingName}, the newer one. Close one of them on the team page.`;
}

/** A brand-new team's door. */
export const FIRST_SEASON_TITLE = 'Start the first season';
export function firstSeasonLine(teamName: string): string {
  return `${teamName} has no season yet. Its first season opens its Coaches Portal: roster, schedule, tryouts and money.`;
}
