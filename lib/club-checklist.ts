import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { planCarriesModule, type EntitlementOrg } from './module-entitlements';
import { memberDisplayName } from './member-names';
import { roleLabel } from './member-access';
import { tournamentToday } from './timezone';
import { listTeamsWithActiveHeadCoach } from './coach-membership';

/**
 * THE CLUB'S SETUP CHECKLIST, computed on the server (A11; Stage 1 specimen 10).
 *
 * Five steps, each with a REAL done condition read from the club's own data, and a door to the screen
 * that does the job. Before this the checklist was half-built: three steps had no button, the
 * accounting step could never be done, a rep club was asked to create a house-league season, and
 * Families was absent.
 *
 *   1 board    — at least one other ACTIVE Admin or Treasurer (the work isn't all the owner's)
 *   2 teams    — at least one active (non-archived) rep team
 *   3 coaches  — every active team has an active HEAD coach (team staff memberships, the access truth
 *                since 2026-08-16 — never the per-season projection); "n of m", naming the gaps
 *   4 public   — a tagline is saved on the public page
 *   5 budget   — the club budget has at least one line for the current budget year (the calendar
 *                year until Stage 3c's club year, D2)
 *   families   — present (a Club inclusion), never a step that can be "done"
 *
 * House league and tournaments are two optional lines, never steps, for a club that runs neither.
 * Session 2's checklist screen renders this; the door for step 3 opens the first uncovered team's
 * Coaches page (Stage 2's "Invite a coach" door replaces it, ruling D10).
 */

export type ChecklistStepKey = 'board' | 'teams' | 'coaches' | 'public' | 'budget';

export type ChecklistStep = {
  key: ChecklistStepKey;
  done: boolean;
  /** Where the step's button goes (an admin path under /{org}/admin). */
  href: string;
  /** The facts the step's line states. Plain data — the screen writes the sentence. */
  detail: Record<string, unknown>;
};

export type ClubChecklist = {
  steps: ChecklistStep[];
  doneCount: number;
  totalSteps: number;
  allDone: boolean;
  families: { available: boolean; href: string };
  optional: {
    houseLeague: { runs: boolean; href: string };
    tournaments: { hosts: boolean; href: string };
  };
};

type Org = EntitlementOrg & { id: string; slug: string };

export async function computeClubChecklist(org: Org): Promise<ClubChecklist> {
  const base = `/${org.slug}/admin`;
  const budgetYear = Number(tournamentToday().slice(0, 4));

  const [boardRes, teamsRes, covered, siteRes, budgetRes, seasonsRes, tournamentsRes] = await Promise.all([
    supabaseAdmin.from('organization_members').select('user_id, role')
      .eq('organization_id', org.id).eq('status', 'active').in('role', ['admin', 'treasurer'])
      .order('accepted_at', { ascending: true }),
    supabaseAdmin.from('rep_teams').select('id, name')
      .eq('org_id', org.id).eq('is_archived', false).order('name', { ascending: true }),
    // The access truth, through the module that owns it (the projection guard allows no other door).
    listTeamsWithActiveHeadCoach(org.id),
    supabaseAdmin.from('org_public_site_content').select('tagline').eq('org_id', org.id).maybeSingle(),
    supabaseAdmin.from('org_budget_lines').select('id', { count: 'exact', head: true })
      .eq('org_id', org.id).eq('season_year', budgetYear),
    supabaseAdmin.from('league_seasons').select('id', { count: 'exact', head: true })
      .eq('org_id', org.id).neq('status', 'archived'),
    supabaseAdmin.from('tournaments').select('id', { count: 'exact', head: true })
      .eq('org_id', org.id).neq('status', 'archived'),
  ]);
  const failed = [boardRes, teamsRes, siteRes, budgetRes, seasonsRes, tournamentsRes].find(r => r.error);
  // A read that failed is not a step that is "not done" — the screen must not tell an owner a
  // finished step is waiting. Throw, and let the route answer an error the screen can show.
  if (failed?.error) throw failed.error;

  const board = boardRes.data ?? [];
  const boardNames = await Promise.all(board.slice(0, 3).map(async m => ({
    name: await memberDisplayName(org.id, m.user_id as string),
    role: roleLabel(m.role as string),
  })));

  const teams = (teamsRes.data ?? []) as { id: string; name: string }[];
  const uncovered = teams.filter(t => !covered.has(t.id));

  // Step 3's door: the first uncovered team's CURRENT season Coaches page (its newest open year).
  let coachesHref = `${base}/rep-teams`;
  if (uncovered.length > 0) {
    const { data: year } = await supabaseAdmin.from('rep_program_years').select('id')
      .eq('team_id', uncovered[0].id).in('status', ['draft', 'active'])
      .order('year', { ascending: false }).limit(1).maybeSingle();
    if (year?.id) coachesHref = `${base}/rep-teams/teams/${uncovered[0].id}/program-years/${year.id}/coaches`;
  }

  const tagline = (siteRes.data?.tagline as string | null | undefined)?.trim() ?? '';

  const steps: ChecklistStep[] = [
    {
      key: 'board',
      done: board.length > 0,
      href: `${base}/org/members`,
      detail: { joined: boardNames, count: board.length },
    },
    {
      key: 'teams',
      done: teams.length > 0,
      href: `${base}/rep-teams`,
      detail: { activeTeams: teams.length },
    },
    {
      key: 'coaches',
      done: teams.length > 0 && uncovered.length === 0,
      href: coachesHref,
      detail: {
        withHeadCoach: teams.length - uncovered.length,
        activeTeams: teams.length,
        missing: uncovered.map(t => t.name),
      },
    },
    {
      key: 'public',
      done: tagline.length > 0,
      href: `${base}/public-site`,
      detail: { hasTagline: tagline.length > 0 },
    },
    {
      key: 'budget',
      done: (budgetRes.count ?? 0) > 0,
      href: `${base}/accounting/budget`,
      detail: { budgetYear, lines: budgetRes.count ?? 0 },
    },
  ];
  const doneCount = steps.filter(s => s.done).length;

  return {
    steps,
    doneCount,
    totalSteps: steps.length,
    allDone: doneCount === steps.length,
    families: { available: planCarriesModule(org, 'module_families'), href: `${base}/families` },
    optional: {
      houseLeague: { runs: (seasonsRes.count ?? 0) > 0, href: `${base}/house-league` },
      tournaments: { hosts: (tournamentsRes.count ?? 0) > 0, href: `${base}/tournaments` },
    },
  };
}
