/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT A COACH IS TOLD WHEN THEIR CLUB CHANGES THE SEASON (Club Tier Stage 2, specimen 4).
 *
 * Before Stage 2 the club's Mark completed sent nothing: a coach found out the next time they
 * opened the portal, on a screen that had quietly become the season's closed page. The club's three
 * doors now each tell the team's staff, in the bell (event `club_season_changed`).
 *
 * ⚠ PURE (words only) so the sentences are unit-tested; the route sends them.
 * ⚠ COPY IS /marketing's — drafted 2026-09-28 to the drawing's frames, marked for review in the
 * plan's call list. The drawing's "Sep 20" is the bell row's own timestamp, not part of the body.
 * ⚠ "Came with the team" names only what ACTUALLY carried — a roll whose fee copy failed must not
 * tell the coach their fee plan is waiting.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { joinWithAnd, pluralize } from './utils';
import { FACT_LABELS, capFactList, factRow, noticeFacts, type NoticeFacts } from './notification-facts';

export type ClubSeasonAction = 'closed' | 'started' | 'reopened';

export interface ClubSeasonCarried {
  players: number;
  budgetPlan: boolean;
  feePlan: boolean;
  openingBalance: boolean;
}

export function clubSeasonNotice(p: {
  clubName: string;
  teamName: string;
  action: ClubSeasonAction;
  seasonName: string;
  /** The season a roll closed ("2026 Season"); null for a team's first season. */
  previousSeasonName?: string | null;
  carried?: ClubSeasonCarried | null;
  /** Started: the new season's tryouts are open (a first season can be created open; a roll always closes them). */
  tryoutsOpen?: boolean;
}): { title: string; body: string; facts?: NoticeFacts } {
  const { clubName, teamName, seasonName } = p;
  if (p.action === 'closed') {
    return {
      title: `${clubName} closed the ${seasonName}`,
      body: `${teamName} · Its page keeps the results, roster, practices and money.`,
    };
  }
  if (p.action === 'reopened') {
    return {
      title: `${clubName} reopened the ${seasonName}`,
      body: `${teamName} · The season is live again, and every screen is back.`,
    };
  }
  // Started (Notifications read at a glance, Stage 4; owner Q7–Q8, 2026-11-15): the one line is the team and what came
  // along (or, with nothing, the tryouts' state); opened, Came with (one line each) · Tryouts · Last season. The
  // Overview's one-time card keeps its paragraph (`clubSeasonStartedCard`). [marketing]
  const s = startedFacts(p.carried, p.tryoutsOpen === true);
  return {
    title: `${clubName} started the ${seasonName}`,
    body: `${teamName} · ${s.came || s.tryouts}`,
    facts: noticeFacts([
      factRow(FACT_LABELS.cameWith, null, { list: capFactList(s.lines, { one: 'thing', many: 'things' }, n => `and ${n} more`) }),
      factRow(FACT_LABELS.tryouts, p.tryoutsOpen ? 'Open' : 'Closed until you open them'),
      factRow(FACT_LABELS.lastSeason, p.previousSeasonName, { detail: 'kept as a record' }),
    ]),
  };
}

/** What came along with the team, as a sentence and as one line each, and the tryouts' state: only what ACTUALLY carried. */
function startedFacts(c: ClubSeasonCarried | null | undefined, tryoutsOpen: boolean): { came: string; lines: string[]; tryouts: string } {
  const parts: string[] = [];
  if (c) {
    if (c.players > 0) parts.push(pluralize(c.players, 'player'));
    if (c.budgetPlan) parts.push('the budget');
    if (c.feePlan) parts.push('the fee plan');
    if (c.openingBalance) parts.push('the opening balance');
  }
  return {
    came: parts.length === 0 ? '' : `Came with the team: ${joinWithAnd(parts)}.`,
    lines: parts.map(x => x.charAt(0).toUpperCase() + x.slice(1)),
    // ⚠ A first season can be created with tryouts open (owner Q8, 2026-11-15): never tell the coach they are closed then.
    tryouts: tryoutsOpen ? 'Tryouts are open.' : 'Tryouts are closed until you open them.',
  };
}

/**
 * The started notice without the team prefix — the bell's body after "{team} ·", and the one-time
 * "New season" card on the Overview (specimen 4, second frame), which already stands on the team.
 */
export function clubSeasonStartedCard(p: {
  clubName: string;
  seasonName: string;
  previousSeasonName?: string | null;
  carried?: ClubSeasonCarried | null;
  /** The season's tryouts are open now (a first season can be created open). */
  tryoutsOpen?: boolean;
}): { title: string; body: string } {
  const s = startedFacts(p.carried, p.tryoutsOpen === true);
  const kept = p.previousSeasonName ? ` The ${p.previousSeasonName} is kept as a record.` : '';
  return {
    title: `${p.clubName} started the ${p.seasonName}`,
    body: `${s.came ? `${s.came} ` : ''}${s.tryouts}${kept}`,
  };
}

/**
 * The one-time welcome for a coach the club invited (specimen 6, "Where she lands"): who named them,
 * as what, and that the team is already there. ⚠ The first name is the account's own (never guessed
 * from an email); with none, the line drops it rather than inventing one.
 */
export function clubWelcomeCard(p: {
  teamName: string;
  firstName: string | null;
  clubName: string;
  roleWord: string;
  namedOn: string;
  players: number;
  otherStaff: number;
}): { title: string; body: string } {
  const here: string[] = [];
  if (p.players > 0) here.push(pluralize(p.players, 'player'));
  if (p.otherStaff > 0) here.push(pluralize(p.otherStaff, 'staff', 'staff'));
  const team = here.length > 0 ? ` Your team is already here: ${joinWithAnd(here)}.` : '';
  return {
    title: p.firstName ? `Welcome to ${p.teamName}, ${p.firstName}` : `Welcome to ${p.teamName}`,
    body: `${p.clubName} named you ${p.roleWord} on ${p.namedOn}.${team}`,
  };
}
