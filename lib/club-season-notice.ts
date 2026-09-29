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
}): { title: string; body: string } {
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
  const started = clubSeasonStartedCard({ clubName, seasonName, previousSeasonName: p.previousSeasonName, carried: p.carried });
  return { title: started.title, body: `${teamName} · ${started.body}` };
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
}): { title: string; body: string } {
  const parts: string[] = [];
  const c = p.carried;
  if (c) {
    if (c.players > 0) parts.push(pluralize(c.players, 'player'));
    if (c.budgetPlan) parts.push('the budget plan');
    if (c.feePlan) parts.push('the fee plan');
    if (c.openingBalance) parts.push('the opening balance');
  }
  const came = parts.length === 0 ? '' : `Came with the team: ${joinWithAnd(parts)}. `;
  const kept = p.previousSeasonName ? ` The ${p.previousSeasonName} is kept as a record.` : '';
  return {
    title: `${p.clubName} started the ${p.seasonName}`,
    body: `${came}Tryouts are closed until you open them.${kept}`,
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
