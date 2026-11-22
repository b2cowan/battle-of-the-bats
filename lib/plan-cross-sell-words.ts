import { isPlanOpen } from './plan-config';
import { moveDirection as shippedMoveDirection, type MoveDirection } from './plan-move-options';
import { START_PATH_FOR_PLAN } from './start-door';
import type { OrgPlan } from './types';

/**
 * The words a tournament organization reads about the plans above it (On-sale pages S4 Part 4). Each sentence names only a
 * plan the live gate has OPEN; closed, the sentence is not said at all. Client-safe: the gate is passed in (the onboarding
 * window reads it with `usePlanGating()`, /for-tournament-organizers with `getPlanGatingMap()`).
 */

type Gating = Partial<Record<OrgPlan, boolean>>;

const LEAGUE_CLAUSE = 'League Plus adds house league seasons';
const CLUB_CLAUSE = 'Club adds rep teams and the club’s books';

/**
 * Can an organization on `own` get `target` from its Plan & billing? A free Tournament organization STARTS any plan above it
 * (S4 Part 1); a paying one MOVES only where the move table goes (Part 2; League Plus moves nowhere at launch, walk §550 C1).
 */
function reachableFrom(own: OrgPlan, target: OrgPlan, moveDirection: (from: OrgPlan, to: OrgPlan) => MoveDirection | null): boolean {
  if (own === target) return false;
  return own === 'tournament' ? true : moveDirection(own, target) === 'up';
}

/**
 * Call 43 (owner 2026-11-21; re-ruled 2026-11-22, "only plans it can reach"): the onboarding change-plan window's added
 * sentence, after today's. It names a plan only while the plan is OPEN and the organization can REACH it from its own plan.
 * Both: "Running more than tournaments? League Plus adds house league seasons, and Club adds rep teams and the club’s
 * books."; one: that plan's clause alone; none: null (today's sentence stands alone). The window opens today only from a
 * League Plus organization's onboarding, which reaches neither, so it reads as it always has; a Tournament organization
 * given the window would read the ruled sentence. Each claim is the Facts doc's (League Plus adds house league; Club adds
 * accounting and rep teams).
 */
export function moreThanTournamentsSentence(
  gating: Gating,
  ownPlan: OrgPlan,
  moveDirection: (from: OrgPlan, to: OrgPlan) => MoveDirection | null = shippedMoveDirection,
): string | null {
  const clauses = [
    isPlanOpen(gating, 'league') && reachableFrom(ownPlan, 'league', moveDirection) ? LEAGUE_CLAUSE : null,
    isPlanOpen(gating, 'club') && reachableFrom(ownPlan, 'club', moveDirection) ? CLUB_CLAUSE : null,
  ].filter((c): c is string => !!c);
  return clauses.length ? `Running more than tournaments? ${clauses.join(', and ')}.` : null;
}

/** The two plans W71 speaks of. */
export type AlreadyRunningPlan = 'league' | 'club';
const LINE_PLAN_LABEL: Record<AlreadyRunningPlan, string> = { league: 'League Plus', club: 'Club' };

/**
 * W71 (call 44, the ruled verb "Start"): under /for-tournament-organizers' League Plus and Club cross-sells, "Already running
 * tournaments here? Start {plan} from Plan & billing. Your events, teams and staff stay where they are." The sentence promises
 * that an organization already running tournaments here gets {plan} WITHOUT a second organization, so it is said only while
 * the plan is open AND the move onto it exists: a free Tournament organization starts it on Plan & billing (S4 Part 1), a
 * paying Tournament Plus one moves to it on its own subscription (Part 2). The guard test takes the move away and the line
 * goes. "Plan & billing" links through the plan's own start door: a signed-in owner lands on their Plan & billing (S2 trap
 * D), a visitor gets the door's "Already have an account? Sign in".
 */
export function alreadyRunningTournamentsLine(
  plan: AlreadyRunningPlan,
  gating: Gating,
  moveDirection: (from: OrgPlan, to: OrgPlan) => MoveDirection | null = shippedMoveDirection,
): { before: string; link: string; after: string; href: string } | null {
  if (!isPlanOpen(gating, plan) || moveDirection('tournament_plus', plan) === null) return null;
  return {
    before: `Already running tournaments here? Start ${LINE_PLAN_LABEL[plan]} from `,
    link: 'Plan & billing',
    after: '. Your events, teams and staff stay where they are.',
    href: START_PATH_FOR_PLAN[plan],
  };
}
