import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden, repGroupScopeGuard } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRepTeam, getRepProgramYear, getRepTeamCoaches } from '@/lib/db';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

/**
 * ONE SEASON'S STAFF RECORD — read-only (the past-season page reads who coached that season).
 *
 * ⚖ Its writes are RETIRED (Club Tier Stage 2, session 3 — session 1's retire list): the assign and
 * remove that lived here could only name someone already an active club member, sent nothing,
 * refused everyone between seasons, and removed a team's last head coach without asking. A club
 * names and removes coaches on the TEAM's Coaches page (`…/teams/[teamId]/coaches`), which works in
 * every season and asks. Retired, not copied.
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ teamId: string; yearId: string }> },) => {
  const orgSlug = new URL(_req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  const { teamId, yearId } = await params;
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx!.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const groupErr = repGroupScopeGuard(ctx!, team.groupId);
  if (groupErr) return groupErr;

  const programYear = await getRepProgramYear(yearId);
  if (!programYear || programYear.teamId !== team.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const coaches = await getRepTeamCoaches(programYear.id);

  // Enrich with display names from org members
  const userIds = coaches.map(c => c.userId);
  const memberRows = userIds.length > 0
    ? (await supabaseAdmin
        .from('organization_members')
        .select('user_id, display_name')
        .eq('organization_id', ctx!.org.id)
        .in('user_id', userIds)).data ?? []
    : [];

  const { data: usersData } = userIds.length > 0
    ? await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    : { data: { users: [] } };

  const memberMap = new Map(memberRows.map(m => [m.user_id, m.display_name]));
  const emailMap = new Map((usersData?.users ?? []).map(u => [u.id, u.email ?? '']));

  const enriched = coaches.map(c => ({
    ...c,
    displayName: memberMap.get(c.userId) ?? null,
    email: emailMap.get(c.userId) ?? '',
  }));

  return NextResponse.json({ coaches: enriched });
}, { route: '/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/coaches' });
