import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRepTeams, createRepTeam, getNonArchivedRepTeamCount } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { DEFAULT_SPORT } from '@/lib/sports';

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
  const groupFilter = searchParams.get('group') || undefined;
  const teams = await getRepTeams(ctx!.org.id, groupFilter, ctx!.repGroupIds ?? undefined);
  const visible = includeArchived ? teams : teams.filter(t => !t.isArchived);

  // Fetch summary counts per team in one query each
  const summaries = await Promise.all(visible.map(async team => {
    const [{ data: years }, { count: rosterCount }, { count: pendingCount }] = await Promise.all([
      supabaseAdmin
        .from('rep_program_years')
        .select('id, name, year, status')
        .eq('team_id', team.id)
        .order('year', { ascending: false })
        .limit(1),
      supabaseAdmin
        .from('rep_roster_players')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', team.id)
        .eq('status', 'active'),
      supabaseAdmin
        .from('rep_tryout_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', team.id)
        .eq('status', 'pending_review'),
    ]);
    const activeYear = years?.[0] ?? null;
    return { team, activeYear, rosterCount: rosterCount ?? 0, pendingTryouts: pendingCount ?? 0 };
  }));

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
      const nextStep = ctx!.org.planId === 'club'
        ? ' Upgrade to Club · Association to add up to 30 teams.'
        : ' Contact us to raise your team limit for a larger association.';
      return NextResponse.json(
        { error: `You've reached your plan's limit of ${cap} teams.${nextStep}`, code: 'team_limit_reached' },
        { status: 409 },
      );
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
