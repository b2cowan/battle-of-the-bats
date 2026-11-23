/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE WORDS OF A TEAM MOVE — every sentence a coach or a club reads about bringing a coach's own
 * team into a club (Club Tier Stage 2, specimen 9, Ask 2). Pure and client-safe: the club's page,
 * the coach's page, the bells and the server's refusals all read from here.
 *
 * ⚖ THE COACH'S OWN SUBSCRIPTION (owner ruling 2026-09-28): it is cancelled the moment the move
 * completes, with no refund and no proration — and **the words never mention a refund, a credit,
 * proration or money back**. They say only that the coach won't be charged again.
 * `tests/unit/team-move-words.test.ts` holds that rule over this file and every screen that shows
 * the move. Polished by /marketing 2026-09-29 (page names ruled as drawn); canon: PRICING_PAGE_COPY.md.
 *
 * ⚖ NARROWED 2026-11-19 (owner ruling (a), `CLUB_ON_SALE_PAGES_PLAN.md`): the rule above is superseded
 * for ONE sentence at ONE place — where the coach says yes, they are told their own plan ends today and the
 * unused part is not refunded. That sentence lives only in `lib/team-move-carve-out.ts`. Everywhere else,
 * including this file, the rule stands, and the test fails if a refund word appears outside the carve-out.
 *
 * ⚖ "EVERYTHING COMES WITH IT" is a promise about a club that can receive a team, so the page ledes and the
 * Settings and Plan & billing entries show it only while Club is open for sale (ruling (c)). A request that is
 * already waiting keeps its "What comes with the team" column whatever the sale state: it is what the coach is
 * about to agree to move.
 *
 * ⚠ NEVER A PRONOUN FOR THE COACH. The drawing said "his own Coaches Portal"; the product does not
 * guess anyone's pronouns, so a sentence names the coach or says "their".
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** The club page's name and its rail entry (drawn; /marketing's to rule on). */
import { possessive } from './utils.ts';
import { JOIN_A_CLUB_TITLE } from './join-a-club-title.ts';

export const BRING_IN_PAGE_TITLE = 'Bring in a coach’s team';
/** The coach's page's name (portal Settings row, billing nudge and the page itself) — spelled in its own tiny module so the strip stays light. */
export { JOIN_A_CLUB_TITLE };

/** What the move carries, in the drawing's words — one sentence both sides read. */
export const WHAT_COMES_WITH_THE_TEAM =
  'Everything it built: its seasons, roster, schedule and results, practices, lineups, attendance, awards, ' +
  'player development, tryouts, documents and money records, and its staff with what each of them can open.';

export const CANT_BE_UNDONE = 'The move can’t be undone.';

// ── The club's page ───────────────────────────────────────────────────────────────────────────────

export function clubPageLede(clubName: string, promiseComesWithIt = true): string {
  const first = `A coach who already runs a team on their own FieldLogicHQ Coaches Portal can bring it into ${clubName}.`;
  // The promise is shown only while Club is open for sale (ruling (c), 2026-11-19).
  return promiseComesWithIt
    ? `${first} Everything the team built comes with it, and it becomes one of the club’s teams.`
    : `${first} It becomes one of the club’s teams.`;
}

/** The pointer for the other case — a NEW coach for a team the club already has (J4-034). */
export const CLUB_NEW_COACH_POINTER_LEAD = 'Adding a new coach to a team you already have? Use';
export const CLUB_NEW_COACH_POINTER_LINK = 'Invite a coach';
export const CLUB_NEW_COACH_POINTER_TAIL = 'on that team’s page.';

export const CLUB_REQUEST_FORM_TITLE = 'Ask a coach to bring in their team';
export const CLUB_REQUEST_FIELD = 'The coach’s email';
export const CLUB_REQUEST_HINT = 'They answer from their own portal. Nothing moves until you both say yes.';

/** "What it costs the club" — a team place, never a price (Premium is included up to the cap). */
export function clubCostLine(p: { planLabel: string; placesAfter: number | null; limit: number | null }): string {
  const included = `Included in your ${p.planLabel} plan.`;
  if (p.limit == null || p.placesAfter == null) return included;
  // At the cap the readout would say "16 of 15": say what is true instead, and Approve opens the
  // team-cap window (the move up, or archive a team).
  if (p.placesAfter > p.limit) return `${included} All ${p.limit} of your team places are in use, so make room first.`;
  return `${included} It takes one of your team places: ${p.placesAfter} of ${p.limit} after.`;
}

/** "{Coach}'s own plan" — the ruling's sentence. */
export function coachPlanLineForClub(coachName: string): string {
  return `${coachName} won’t be charged for their own Coaches Portal again. Billing for it stops the moment the move completes.`;
}

export function clubAfterLine(p: { coachName: string; teamName: string; clubName: string }): string {
  return `${p.coachName} keeps coaching ${p.teamName}, now as a ${p.clubName} team. ` +
    `From then on, the club starts and closes its seasons. ${CANT_BE_UNDONE}`;
}

export function clubCardTitle(teamName: string, clubName: string): string {
  return `${teamName} wants to join ${clubName}`;
}

export function openTournamentLineForClub(coachName: string, tournamentName: string): string {
  return `${possessive(coachName)} own tournament, ${tournamentName}, is still open. It stays with their own portal and ` +
    'doesn’t move, so the move waits until it’s finished or archived.';
}

export function clubApproveButton(teamName: string): string {
  return `Approve and bring in ${teamName}`;
}

export function clubMovedNotice(p: { teamName: string; slugChangedTo?: string | null }): string {
  const base = `${p.teamName} is now one of your teams.`;
  return p.slugChangedTo
    ? `${base} Its web address ends in /${p.slugChangedTo}, because another of your teams already used its old one.`
    : base;
}

// ── The coach's page ──────────────────────────────────────────────────────────────────────────────

export function coachPageLede(teamName: string, promiseComesWithIt = true): string {
  return promiseComesWithIt
    ? `If your club runs on FieldLogicHQ, it can bring ${teamName} in. Everything the team built comes with it, ` +
      'and you keep coaching it as one of the club’s teams.'
    : `If your club runs on FieldLogicHQ, it can bring ${teamName} in, and you keep coaching it as one of the club’s teams.`;
}
export const COACH_REQUEST_FORM_TITLE = 'Ask a club to bring in your team';
export const COACH_REQUEST_FIELD = 'The club’s web address or contact email';
export const COACH_REQUEST_HINT = 'The club answers from its own admin. Nothing moves until you both say yes.';

export function coachCardTitle(clubName: string, teamName: string): string {
  return `${clubName} wants to bring in ${teamName}`;
}

/** "What it costs you" — the ruling's sentence, to the coach. */
export const COACH_PLAN_LINE =
  'You won’t be charged for your own Coaches Portal again. Billing for it stops the moment the move completes.';

export function coachAfterLine(p: { teamName: string; clubName: string }): string {
  return `You keep coaching ${p.teamName}, now as a ${p.clubName} team. ${p.clubName} starts and closes your seasons ` +
    `from then on, and your staff keep what each of them can open. ${CANT_BE_UNDONE}`;
}

export function openTournamentLineForCoach(tournamentName: string): string {
  return `Your own tournament, ${tournamentName}, is still open. It stays with your own portal and doesn’t move, ` +
    'so finish or archive it first.';
}

export function coachApproveButton(clubName: string): string {
  return `Approve and join ${clubName}`;
}

// ── The confirmation window (both sides) ─────────────────────────────────────────────────────────

export function confirmTitle(teamName: string, clubName: string): string {
  return `Bring ${teamName} into ${clubName}?`;
}
export const CONFIRM_BODY_CLUB = `${CANT_BE_UNDONE} Type the team’s name to confirm.`;
export const CONFIRM_BODY_COACH = `${CANT_BE_UNDONE} Type your team’s name to confirm.`;
export const CONFIRM_FIELD = 'Team name';

/** The typed confirmation, compared the forgiving way: case, and extra spaces, don't matter. */
export function normalizeTeamNameForConfirm(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}
export function teamNameConfirmed(typed: string | null | undefined, teamName: string): boolean {
  const want = normalizeTeamNameForConfirm(teamName);
  return want.length > 0 && normalizeTeamNameForConfirm(typed) === want;
}

// ── Where a request stands (both sides' lists) ───────────────────────────────────────────────────

export type MoveHistoryState = 'moved' | 'declined' | 'withdrawn' | 'retired_link';

export function historyLine(state: MoveHistoryState, p: { clubName: string; date: string }): string {
  switch (state) {
    case 'moved': return `Joined ${p.clubName} · ${p.date}`;
    case 'declined': return `Declined · ${p.date}`;
    case 'withdrawn': return `Withdrawn · ${p.date}`;
    // The Basic visibility link (retired, B12). Its rows stay as history.
    case 'retired_link': return `Visibility link, no longer used · ${p.date}`;
  }
}

// ── Refusals (the server's words; the screens show them as they come) ────────────────────────────

export const REFUSAL = {
  confirmMismatch: 'Type the team’s name exactly as it’s shown to confirm.',
  notWaiting: 'This request isn’t waiting on you any more. Refresh to see where it stands.',
  alreadyMoved: 'This team has already moved into a club.',
  notAClub: 'Only a club can bring in a coach’s team.',
  noRepTeams: 'This club’s plan doesn’t include rep teams, so it can’t bring in a team.',
  workspaceClosed: 'That coach’s own portal is closed, so its team can’t move.',
  otherClubOpen: 'That team already has a request open with another club. It has to be answered or withdrawn first.',
  coachOtherClubOpen: 'Your team already has a request open with another club. Withdraw it first, or wait for the answer.',
  noOwnTeam: (email: string) =>
    `${email} doesn’t run a team on their own Coaches Portal. To add a new coach to one of your teams, use Invite a coach on that team’s page.`,
  clubNotFound: 'We couldn’t find a club with that web address or contact email.',
  notYourOwnOrg: 'Choose a club, not your own portal.',
  coachAtClubCap: (clubName: string) =>
    `${clubName} has no team place left on its plan right now. It needs to make room first — nothing has moved.`,
  openTournament: 'The coach’s own tournament is still open. The move waits until it’s finished or archived.',
  libraryNameClash: (items: string) =>
    `The team has two ${items} with the same name. Rename one of them in the team’s settings, then try again — nothing has moved.`,
  ledgerConflict: 'This club already holds a money ledger for this team, so it can’t move in. Contact us — nothing has moved.',
  holdsOtherTeams: 'That portal holds more than one team, so it can’t move this way. Contact us — nothing has moved.',
  moveFailed: 'The move couldn’t finish, and nothing moved. Try again, or contact us if it keeps happening.',
  retired: 'That step is no longer part of bringing a team into a club. Refresh the page.',
} as const;

// ── The bells ─────────────────────────────────────────────────────────────────────────────────────

export function bellClubAsked(p: { clubName: string; teamName: string }): { title: string; body: string } {
  return {
    title: `${p.clubName} wants to bring ${p.teamName} into the club`,
    body: `Nothing moves until you say yes. Review it on ${JOIN_A_CLUB_TITLE}.`,
  };
}

export function bellCoachAsked(p: { coachName: string; teamName: string; clubName: string }): { title: string; body: string } {
  return {
    title: `${p.coachName} wants to bring ${p.teamName} into ${p.clubName}`,
    body: `Nothing moves until you say yes. Review it on ${BRING_IN_PAGE_TITLE}.`,
  };
}

/** To the team's staff, now in the club. */
export function bellMovedForStaff(p: { teamName: string; clubName: string }): { title: string; body: string } {
  return {
    title: `${p.teamName} is now a ${p.clubName} team`,
    body: `Everything came with it. ${p.clubName} starts and closes your seasons from now on.`,
  };
}

/** To the club's owner and admins, when the coach gave the second yes. */
export function bellMovedForClub(p: { teamName: string; clubName: string; coachName: string }): { title: string; body: string } {
  return {
    title: `${p.teamName} joined ${p.clubName}`,
    body: `${p.coachName} said yes, and ${p.teamName} is now one of your teams.`,
  };
}

export function bellCoachDeclined(p: { coachName: string; teamName: string; clubName: string }): { title: string; body: string } {
  return {
    title: `${p.coachName} declined to bring ${p.teamName} into ${p.clubName}`,
    body: 'Nothing moved.',
  };
}

export function bellClubDeclined(p: { clubName: string; teamName: string }): { title: string; body: string } {
  return {
    title: `${p.clubName} declined to bring in ${p.teamName}`,
    body: 'Nothing moved. Your team stays on your own portal.',
  };
}
