import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { coachingStaffRowRefusal } from '@/lib/board-roles';
import { requireFreshCode } from '@/lib/two-step-fresh';
import { twoStepFactsFor } from '@/lib/two-step-reset';
import { clubResetDoorFor } from '@/lib/two-step-club-reset';
import { clubResetTwoStep } from '@/lib/two-step-club-reset-run';
import { getUserDisplayName } from '@/lib/user-display';

/**
 * MEMBERS › MANAGE › TWO-STEP SIGN-IN (Board Ready · two-step sign-in, Part 3; drawings tab 6 "Manage window").
 *
 *   GET   the line the window shows ("On since Nov 12, 2026") and which door: `club` (Reset two-step sign-in…),
 *         `support` (one line, no reason given to the club) or `none`. Owners and admins only: the club sees on / off, never
 *         codes, apps or devices (ask 6).
 *   POST  the reset, through the one function both of the club's doors use (lib/two-step-club-reset.ts), which re-applies
 *         the door's rule, asks for the viewer's code (one of the five actions, ask 4), resets, writes the club audit line
 *         and emails the person.
 *
 * A coach row is managed on the team's staff page (its own door), as every Members route refuses it.
 */
type Params = { params: Promise<{ memberId: string }> };

type Target = { id: string; role: string; user_id: string; status: string; display_name: string | null };
type Ctx = NonNullable<Awaited<ReturnType<typeof getAuthContextWithRole>>>;

async function context(req: Request, params: Params['params']): Promise<{ response: Response } | { response: null; ctx: Ctx; target: Target }> {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { response: unauthorized() };
  // Owners and admins only (CLUB_RESET_VIEWER_ROLES): the club sees on / off, never codes, apps or devices.
  if (!['owner', 'admin'].includes(ctx.role)) return { response: forbidden() };
  const { memberId } = await params;
  const { data: target } = await supabaseAdmin
    .from('organization_members')
    .select('id, role, user_id, status, display_name')
    .eq('id', memberId)
    .eq('organization_id', ctx.org.id)
    .maybeSingle<{ id: string; role: string; user_id: string | null; status: string; display_name: string | null }>();
  if (!target?.user_id) return { response: NextResponse.json({ error: 'Member not found' }, { status: 404 }) };
  if (target.role === 'coach') return { response: coachingStaffRowRefusal() };
  return { response: null, ctx, target: { ...target, user_id: target.user_id } };
}

export const GET = withObservability(async (req: Request, { params }: Params) => {
  const c = await context(req, params);
  if (c.response) return c.response;
  const { ctx, target } = c;
  const facts = await twoStepFactsFor(target.user_id);
  const { data: got } = await supabaseAdmin.auth.admin.getUserById(target.user_id);
  const door = await clubResetDoorFor({
    org: ctx.org,
    viewer: { userId: ctx.user.id, role: ctx.role },
    target: { userId: target.user_id, email: got?.user?.email ?? null, role: target.role, on: facts.on },
  });
  return NextResponse.json({ on: facts.on, since: facts.since, door });
}, { route: '/api/admin/members/[memberId]/two-step' });

export const POST = withObservability(async (req: Request, { params }: Params) => {
  const c = await context(req, params);
  if (c.response) return c.response;
  const { ctx, target } = c;
  const { data: me } = await supabaseAdmin
    .from('organization_members')
    .select('display_name')
    .eq('organization_id', ctx.org.id)
    .eq('user_id', ctx.user.id)
    .maybeSingle<{ display_name: string | null }>();
  const result = await clubResetTwoStep({
    org: ctx.org,
    actor: { userId: ctx.user.id, role: ctx.role, name: me?.display_name?.trim() || getUserDisplayName(ctx.user) || 'An admin' },
    target: { userId: target.user_id, role: target.role },
    askFreshCode: requireFreshCode,
  });
  if (result instanceof Response) return result;
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/members/[memberId]/two-step' });
