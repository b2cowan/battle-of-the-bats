import { NextResponse } from 'next/server';
import { resolveClubTeam } from '@/lib/club-team-route';
import { getTeamStaffMembershipById } from '@/lib/coach-membership';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { requireFreshCode } from '@/lib/two-step-fresh';
import { twoStepFactsFor } from '@/lib/two-step-reset';
import { clubResetDoorFor } from '@/lib/two-step-club-reset';
import { clubResetTwoStep } from '@/lib/two-step-club-reset-run';
import { getUserDisplayName } from '@/lib/user-display';

/**
 * A COACH'S TWO-STEP RESET, from the club's team staff page person window (Board Ready · two-step sign-in, Part 3; ask A,
 * drawn and approved by the owner 2026-11-11: BOARD_READY_TWO_STEP_COACH_RESET_DRAWINGS.html). Coaches are not managed in
 * Members, so their door lives here. The SAME door, rule and run as Members (lib/two-step-club-reset.ts,
 * lib/two-step-club-reset-run.ts):
 *
 *   GET   "On since…" / "Off" and which door (`club`, `support`, `none`).
 *   POST  the reset: the rule re-applied, the viewer's code asked for, the reset, the club audit line, the coach's email.
 *
 * The page's own write gate: the club's OWNER or an ADMIN with Rep Teams (`resolveClubTeam` write). A head coach in the
 * Coaches Portal gets no reset door (A2). The rule judges the coach by their seat in THIS club (usually `coach`; an
 * owner who also coaches is never reset by the club).
 */
type Params = { params: Promise<{ teamId: string; membershipId: string }> };

async function context(req: Request, params: Params['params']) {
  const { teamId, membershipId } = await params;
  const resolved = await resolveClubTeam(req, teamId, { write: true });
  if ('error' in resolved) return { response: resolved.error } as const;
  const { ctx, team } = resolved;
  const member = await getTeamStaffMembershipById(membershipId);
  if (!member || member.teamId !== team.id || member.status !== 'active') {
    return { response: NextResponse.json({ error: 'They’re no longer on this team’s staff — refresh to see its coaches.' }, { status: 404 }) } as const;
  }
  const { data: seat, error: seatErr } = await supabaseAdmin
    .from('organization_members')
    .select('role')
    .eq('organization_id', ctx.org.id)
    .eq('user_id', member.userId)
    .maybeSingle<{ role: string }>();
  // Fails CLOSED (/review of Part 3): an unreadable seat must never read as a plain coach — an owner who also coaches would
  // look resettable. A staff member always holds a seat in the club (the coach row the staff invite writes).
  if (seatErr || !seat?.role) return { response: NextResponse.json({ error: 'We couldn’t read their seat in the club. Try again.' }, { status: 503 }) } as const;
  return { response: null, ctx, coachUserId: member.userId, seatRole: seat.role } as const;
}

export const GET = withObservability(async (req: Request, { params }: Params) => {
  const c = await context(req, params);
  if (c.response) return c.response;
  const facts = await twoStepFactsFor(c.coachUserId);
  const { data: got } = await supabaseAdmin.auth.admin.getUserById(c.coachUserId);
  const door = await clubResetDoorFor({
    org: c.ctx.org,
    viewer: { userId: c.ctx.user.id, role: c.ctx.role },
    target: { userId: c.coachUserId, email: got?.user?.email ?? null, role: c.seatRole, on: facts.on },
  });
  return NextResponse.json({ on: facts.on, since: facts.since, door });
}, { route: '/api/admin/rep-teams/teams/[teamId]/coaches/[membershipId]/two-step' });

export const POST = withObservability(async (req: Request, { params }: Params) => {
  const c = await context(req, params);
  if (c.response) return c.response;
  const { data: me } = await supabaseAdmin
    .from('organization_members')
    .select('display_name')
    .eq('organization_id', c.ctx.org.id)
    .eq('user_id', c.ctx.user.id)
    .maybeSingle<{ display_name: string | null }>();
  const result = await clubResetTwoStep({
    org: c.ctx.org,
    actor: { userId: c.ctx.user.id, role: c.ctx.role, name: me?.display_name?.trim() || getUserDisplayName(c.ctx.user) || 'An admin' },
    target: { userId: c.coachUserId, role: c.seatRole },
    askFreshCode: requireFreshCode,
  });
  if (result instanceof Response) return result;
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/rep-teams/teams/[teamId]/coaches/[membershipId]/two-step' });
