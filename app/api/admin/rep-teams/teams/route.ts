import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getRepTeams, createRepTeam, getNonArchivedRepTeamCount } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { teamLimitRefusal } from '@/lib/team-cap';
import { getOrgFamilyRollup, EMPTY_TEAM_FAMILY_ROLLUP } from '@/lib/family-access';
import { DEFAULT_SPORT } from '@/lib/sports';
import { loadClubBoard } from '@/lib/club-team-board';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

function slugify(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export const GET = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  const { searchParams } = url;
  const includeArchived = searchParams.get('archived') === 'true';

  // Scoped member: ignore caller ?group= and enforce their assigned group IDs
  // "Ungrouped" (`group=none`) means teams with NO group — it is not a group id. It used to go
  // straight into the uuid comparison, which failed and turned the list into a 500 + "Failed to
  // load" (Club Tier Readiness B06). It filters below instead.
  const groupParam = searchParams.get('group') || undefined;
  const ungrouped = groupParam === 'none';
  const groupFilter = ungrouped ? undefined : groupParam;
  /**
   * Chunk D 3.6 — how many families each team has actually connected, for the club.
   *
   * ONE grouped read for the whole org, not a query per row: this list already runs three
   * queries per team, and a fourth down a 30-team list is how a page starts timing out. It
   * needs only the org id, so it runs ALONGSIDE the team list rather than after it.
   */
  const [teams, familyByTeam] = await Promise.all([
    getRepTeams(ctx!.org.id, groupFilter, ctx!.repGroupIds ?? undefined),
    getOrgFamilyRollup(ctx!.org.id),
  ]);
  const visible = (includeArchived ? teams : teams.filter(t => !t.isArchived))
    .filter(t => !ungrouped || !t.groupId);

  // `?light=1` — the teams alone, for a picker (Document templates' "Applies to"): no board reads.
  if (searchParams.get('light') === '1') {
    return NextResponse.json({
      teams: visible.map(t => ({ team: { id: t.id, name: t.name, groupId: t.groupId, groupName: t.groupName, isArchived: t.isArchived } })),
    });
  }

  /**
   * THE HEALTH BOARD'S READ (Club Tier Stage 2, B08 / Ask 5) — one batched read for every team:
   * season + record, head coach, roster, next event, Documents, group. It replaced three queries a
   * team whose numbers did not mean what they seemed: the roster added up EVERY season's rows (a
   * team of 14 read 27), pending tryouts counted every season, and the season chip was simply the
   * highest year whatever its state. `activeYear`, `rosterCount` and `pendingTryouts` keep their
   * names for today's cards and now answer from the board's one rules (live season first).
   */
  const board = await loadClubBoard(ctx!.org.id, visible);
  const summaries = visible.map(team => {
    const row = board.get(team.id)!;
    // pdfLook can carry a base64 crest (~hundreds of KB per team) and nothing on the admin
    // list reads it — stripped so a many-team club's listing doesn't ship megabytes of images.
    const teamJson = { ...team, pdfLook: undefined };
    return {
      team: teamJson,
      activeYear: row.season
        ? { id: row.season.id, name: row.season.name, year: row.season.year, status: row.season.status }
        : null,
      rosterCount: row.rosterCount ?? 0,
      pendingTryouts: row.pendingTryouts,
      family: familyByTeam.get(team.id) ?? { repTeamId: team.id, ...EMPTY_TEAM_FAMILY_ROLLUP },
      board: row,
    };
  });

  return NextResponse.json({ teams: summaries });
}, { route: '/api/admin/rep-teams/teams' });

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  const body = await req.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : slugify(name);
  const sport = typeof body.sport === 'string' ? body.sport.trim() : DEFAULT_SPORT;

  if (!name || name.length > 100) {
    return NextResponse.json({ error: 'name is required and must be 100 characters or fewer' }, { status: 400 });
  }
  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  }

  // Capacity enforcement (Club Repackaging 2026-06-22): a Club / Club · Association
  // subscription includes its whole coaching staff up to the plan's team cap. All team
  // types count equally. Block creating the (cap+1)th team and prompt the next step.
  // teamLimit is the effective cap (per-org override ?? plan band default); 9999 ≈ uncapped.
  const cap = ctx!.org.teamLimit;
  if (cap < 9999) {
    const currentCount = await getNonArchivedRepTeamCount(ctx!.org.id);
    if (currentCount >= cap) {
      // Structured next step (Stage 1b): the screen offers the move up in place, or "contact us".
      return teamLimitRefusal(ctx!.org.planId, cap, currentCount);
    }
  }

  try {
    const team = await createRepTeam(ctx!.org.id, {
      name,
      slug,
      sport,
      division: body.division?.trim() || null,
      description: body.description?.trim() || null,
      color: body.color?.trim() || null,
      groupId: body.groupId || null,
    });

    // Club Repackaging (2026-06-22): the per-team "$19/team beyond 3" Stripe meter is
    // retired. A Club / Club · Association subscription includes its whole coaching staff
    // up to the plan's team cap — no per-team charge to sync. Capacity is enforced by the
    // teamLimit guard at create time (above), not billed per team.

    return NextResponse.json({ team }, { status: 201 });
  } catch (e: any) {
    if (e?.code === '23505') {
      return NextResponse.json({ error: 'A team with that slug already exists for this org' }, { status: 409 });
    }
    throw e;
  }
}, { route: '/api/admin/rep-teams/teams' });
