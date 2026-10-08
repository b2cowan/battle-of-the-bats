import { NextResponse } from 'next/server';
import { liveSeasonOf } from '@/lib/season-live';
import { orgDayKey } from '@/lib/timezone';
import { NO_SEASON_RUNNING_WORD } from '@/lib/club-money-words';
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
 *
 * ⚖ ONLY A TEAM'S OPEN SEASON IS BILLED (Club Tier Stage 3c, S3C-09; Ask 6). Each team carries `season` — its
 * RUNNING season (draft or active, the coach's live season — `liveSeasonOf`), worded as the season's name — or
 * `season: null` with `noSeason` saying why ("No season running"). A closed season is never offered: its books
 * are a record (the create refuses one too, 409 `season_closed`). `programYears` (3a's list, read by the page
 * session 2 retires) now holds that open season only. A team with no open season carries `lastSeason` — its most
 * recent season's name and the day it was last changed (a season stores no close date: S3C-04, `updated_at`) — so
 * New allocation can say why it can't be billed ("No open season: its 2026 Season closed on Sep 20").
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
    .select('id, team_id, name, year, status, created_at, updated_at')
    .eq('org_id', ctx.org.id)
    .in('team_id', teams.map(t => t.id))
    .order('year', { ascending: false });
  if (yearsError) return captureAndJson(yearsError, { error: 'Could not load the teams’ seasons.' }, 500);

  const yearsByTeam = new Map<string, { id: string; name: string; year: number; status: string; createdAt: string; updatedAt: string | null }[]>();
  for (const y of years ?? []) {
    const list = yearsByTeam.get(y.team_id as string) ?? [];
    list.push({
      id: y.id as string, name: y.name as string, year: y.year as number, status: y.status as string,
      createdAt: y.created_at as string, updatedAt: (y.updated_at as string | null) ?? null,
    });
    yearsByTeam.set(y.team_id as string, list);
  }

  return NextResponse.json({
    teams: teams.map(t => {
      const seasons = yearsByTeam.get(t.id as string) ?? [];
      const open = liveSeasonOf(seasons);
      // The most recent season (newest year, then the newest made), when none is open.
      const last = open ? null : [...seasons].sort((a, b) => b.year - a.year || b.createdAt.localeCompare(a.createdAt))[0] ?? null;
      return {
        id: t.id as string,
        name: t.name as string,
        season: open ? { id: open.id, name: open.name } : null,
        noSeason: open ? null : NO_SEASON_RUNNING_WORD,
        lastSeason: last ? { name: last.name, closedOn: last.updatedAt ? orgDayKey(last.updatedAt) : null } : null,
        programYears: open ? [{ id: open.id, name: open.name, year: open.year, status: open.status }] : [],
      };
    }),
  });
}, { route: '/api/admin/accounting/team-options' });
