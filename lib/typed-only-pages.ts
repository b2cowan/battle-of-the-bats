/**
 * THE TYPED-ONLY PAGES SEND THE WORKSPACE HOME (Retire the old tournament-only menu, step 3 — owner call 3, 2026-11-20;
 * plan `docs/projects/active/RETIRE_OLD_TOURNAMENT_ONLY_NAV_PLAN.md`).
 *
 * Six club pages have no door for a workspace whose plan does not carry them, so the only way there is a typed address or an
 * old bookmark — and each then drew a refusal inside the admin's menu (house league's was the "ask the owner" screen, the
 * Calendar's a bare "Forbidden"). For the two kinds of workspace that never have these programs, the page's layout sends
 * the person home instead, SERVER-side, before the page mounts:
 *   - a Premium Coaches Portal (a one-team workspace) → its Coaches Portal landing (`getStandaloneAdminHref`);
 *   - a tournament-only organization (Tournament, Tournament Plus) → `/admin/tournaments`, its org layout's own target.
 *
 * ⚠ A club or a league is NEVER sent: it keeps today's screen, whatever it lacks. And each test below is the page's OWN
 * refusal condition, not a broader one — a workspace that does carry the program (an add-on, a plan that grows) reaches
 * the page exactly as before. Two pages are ruled, not refusals: the club Calendar (a Premium owner saw a doorless calendar
 * of their one tournament — owner 2026-11-20, "send Premium home too") and the board (a club's idea; a Premium workspace's
 * people live on its team staff page, ruling 1R) — both only while the plan carries nothing beyond the tournament tools.
 *
 * Pure on purpose: the unit tests ask it for every plan.
 */
import { hasModuleEntitlement, isTournamentOnlyWorkspace, type EntitlementOrg } from './module-entitlements';
import { clubSchedulerOn } from './club-schedule-gate';
import { hasOrgVenueLibrary } from './plan-features';
import { isTournamentTier } from './billing-urls';
import { isTeamWorkspaceOrg } from './team-workspace-kind';

export type TypedOnlyPage = 'houseLeague' | 'calendar' | 'schedules' | 'publicSite' | 'board' | 'venues';
export type TypedOnlyOrg = EntitlementOrg & { accountKind?: string | null };

/** Where the workspace goes instead: its Coaches Portal landing, or its Tournaments page. */
export type TypedOnlyHome = 'portal' | 'tournaments';

/** The page's own "this plan has none of it" test — the condition it refused on before this step. */
const LACKS: Record<TypedOnlyPage, (org: TypedOnlyOrg) => boolean> = {
  // `useHouseLeagueAccess` → `canOpenModule`: the plan half (a cancelled org fails it too).
  houseLeague: org => !hasModuleEntitlement(org, 'module_house_league'),
  // The calendar API refuses a Tournament plan outright; a Premium workspace is ruled (above) — while its plan carries
  // nothing beyond the tournament tools (a workspace whose plan grows, e.g. a free-time grant, keeps a real calendar).
  calendar: org => isTournamentTier(org.planId) || isTournamentOnlyWorkspace(org),
  // `resolveScheduler`: League Plus and Club only, by plan id.
  schedules: org => !clubSchedulerOn(org.planId),
  // The page's "Your plan doesn't include a public site" card.
  publicSite: org => !hasModuleEntitlement(org, 'module_public_site'),
  // Ruled (1R): no board for a Premium workspace — while its plan carries nothing beyond the tournament tools.
  board: org => isTournamentOnlyWorkspace(org),
  // The page's "The Venue library isn't on your plan" card.
  venues: org => !hasOrgVenueLibrary(org.planId),
};

/** Under Organization: a tournament-only organization never reaches them (its org layout sends it on first). */
const PREMIUM_ONLY: ReadonlySet<TypedOnlyPage> = new Set(['board', 'venues']);

/** Where this page sends this workspace, or null to render it as today (every club and league). */
export function typedOnlyPageHome(page: TypedOnlyPage, org: TypedOnlyOrg): TypedOnlyHome | null {
  const premium = isTeamWorkspaceOrg(org);
  const tournamentOnly = !premium && isTournamentTier(org.planId);
  if (!premium && !tournamentOnly) return null;
  if (tournamentOnly && PREMIUM_ONLY.has(page)) return null;
  if (!LACKS[page](org)) return null;
  return premium ? 'portal' : 'tournaments';
}
