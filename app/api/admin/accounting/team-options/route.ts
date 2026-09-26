import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { canOpenModule } from '@/lib/member-access';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability, captureAndJson } from '@/lib/observability';

/**
 * GET /api/admin/accounting/team-options — the club's teams and their seasons, for the money
 * screens. Names and program years ONLY: no roster, no coach, no count.
 *
 * ⚖ Ask 1 (ruled 2026-09-25) — "a read of rep teams" for the treasurer means team names and
 * seasons INSIDE Accounting, with no Rep Teams door. So this is gated on ACCOUNTING, not on Rep
 * Teams. Before it existed the allocate wizard loaded its team list from the Rep Teams routes,
 * which a treasurer is refused; the 403 was swallowed and the dropdown came back empty (C03, the
 * Stage 0 probe). A Rep Teams read with an Accounting door bolted on would have handed a treasurer
 * rosters and family counts; this hands them what allocating money needs and nothing more.
 *
 * An org whose plan carries no rep teams gets an empty list, not a refusal: it has nothing to
 * allocate to, and that is an answer.
 */
export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!canOpenModule(ctx, ctx.org, 'module_accounting')) return forbidden();

  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) {
    return NextResponse.json({ teams: [] });
  }

  let teamQuery = supabaseAdmin
    .from('rep_teams')
    .select('id, name, group_id')
    .eq('org_id', ctx.org.id)
    .eq('is_archived', false)
    .order('name', { ascending: true });
  // A member scoped to rep-team groups sees only those groups' teams here too — the same scope the
  // Rep Teams routes apply. (Owner, admin and treasurer are never scoped.)
  if (ctx.repGroupIds) teamQuery = teamQuery.in('group_id', ctx.repGroupIds);

  const { data: teams, error: teamsError } = await teamQuery;
  if (teamsError) return captureAndJson(teamsError, { error: 'Could not load the club’s teams.' }, 500);
  if (!teams?.length) return NextResponse.json({ teams: [] });

  const { data: years, error: yearsError } = await supabaseAdmin
    .from('rep_program_years')
    .select('id, team_id, name, year, status')
    .eq('org_id', ctx.org.id)
    .in('team_id', teams.map(t => t.id))
    .order('year', { ascending: false });
  if (yearsError) return captureAndJson(yearsError, { error: 'Could not load the teams’ seasons.' }, 500);

  const yearsByTeam = new Map<string, { id: string; name: string; year: number; status: string }[]>();
  for (const y of years ?? []) {
    const list = yearsByTeam.get(y.team_id as string) ?? [];
    list.push({ id: y.id as string, name: y.name as string, year: y.year as number, status: y.status as string });
    yearsByTeam.set(y.team_id as string, list);
  }

  return NextResponse.json({
    teams: teams.map(t => ({
      id: t.id as string,
      name: t.name as string,
      programYears: yearsByTeam.get(t.id as string) ?? [],
    })),
  });
}, { route: '/api/admin/accounting/team-options' });
