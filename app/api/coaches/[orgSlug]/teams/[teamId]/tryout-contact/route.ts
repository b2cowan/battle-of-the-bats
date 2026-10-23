import { NextResponse } from 'next/server';
import { getOrgPublicSiteContent } from '@/lib/db';
import { resolveCoachTeamAssignment } from '@/lib/coach-route-context';
import { getActiveTeamMembership, getTeamStaffMembershipById } from '@/lib/coach-membership';
import { clearTryoutContactSetBy } from '@/lib/coach-tryout-contact-clear';
import { readTryoutContact, setTryoutContact, removeTryoutContact } from '@/lib/coach-tryout-contact';
import { checkTryoutContactEmail, ONLY_HEAD_COACH_SETS } from '@/lib/tryout-contact-rules';
import { withObservability } from '@/lib/observability';

/**
 * The head coach's tryout questions address (Club Tier Stage 4c-2 Part B, Asks 1–3) — Tryouts › Set up, the row
 * "Questions from families".
 *
 * READ: whoever holds the `tryouts` grant (a head coach, or an assistant granted tryouts — H9 reads it, "set by …").
 * WRITE (PUT / DELETE): a HEAD COACH of the team, by `coach_role` on their active membership — never the `tryouts`
 * grant, which an assistant can hold (H14). Saved only complete and valid; the sign-in address is allowed, with a note on the row (H5).
 */

type Ctx = { params: Promise<{ orgSlug: string; teamId: string }> };

/** The shared coach-route chain (a live seat on this team), plus the caller's membership for the role check. */
async function resolve(orgSlug: string, teamId: string) {
  const r = await resolveCoachTeamAssignment(orgSlug, teamId);
  if ('error' in r) return { ok: false as const, res: r.error };
  const membership = await getActiveTeamMembership(r.ctx.org.id, teamId, r.ctx.user.id);
  return { ok: true as const, ...r, membership, isHead: membership?.coachRole === 'head_coach' };
}

/** Everything the row's seven states need, from one read. */
async function view(r: Extract<Awaited<ReturnType<typeof resolve>>, { ok: true }>) {
  const [contact, site] = await Promise.all([
    readTryoutContact(r.ctx.org.id, r.team.id),
    getOrgPublicSiteContent(r.ctx.org.id).catch(() => null),
  ]);
  return {
    email: contact.email,
    setByName: contact.setter?.name ?? null,
    setByYou: !!contact.setter && contact.setter.membershipId === r.membership?.id,
    resetAt: contact.resetAt,
    canChange: r.isHead,
    clubAddress: site?.contactEmail ?? null,
    signInEmail: r.ctx.user.email ?? null,
  };
}

export const GET = withObservability(async (_req: Request, { params }: Ctx) => {
  const { orgSlug, teamId } = await params;
  const r = await resolve(orgSlug, teamId);
  if (!r.ok) return r.res;
  if (!r.assignment.capabilities.tryouts) {
    return NextResponse.json({ error: 'Only the head coach manages tryouts.' }, { status: 403 });
  }
  return NextResponse.json(await view(r));
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-contact' });

export const PUT = withObservability(async (req: Request, { params }: Ctx) => {
  const { orgSlug, teamId } = await params;
  const r = await resolve(orgSlug, teamId);
  if (!r.ok) return r.res;
  if (!r.isHead || !r.membership) return NextResponse.json({ error: ONLY_HEAD_COACH_SETS }, { status: 403 });
  const body = await req.json().catch(() => ({})) as { email?: unknown };
  const checked = checkTryoutContactEmail(body.email);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  await setTryoutContact({ orgId: r.ctx.org.id, teamId: r.team.id, membershipId: r.membership.id, email: checked.value });
  // The second check (the convergence this module family uses for the last-head race): a removal or demotion that
  // landed between the role check above and the write has already run its clear, so this write would outlive the seat.
  const seat = await getTeamStaffMembershipById(r.membership.id);
  if (!seat || seat.teamId !== r.team.id || seat.status !== 'active' || seat.coachRole !== 'head_coach') {
    await clearTryoutContactSetBy(r.team.id, r.membership.id);
    return NextResponse.json({ error: ONLY_HEAD_COACH_SETS }, { status: 403 });
  }
  return NextResponse.json(await view(r));
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-contact' });

export const DELETE = withObservability(async (_req: Request, { params }: Ctx) => {
  const { orgSlug, teamId } = await params;
  const r = await resolve(orgSlug, teamId);
  if (!r.ok) return r.res;
  if (!r.isHead) return NextResponse.json({ error: ONLY_HEAD_COACH_SETS }, { status: 403 });
  await removeTryoutContact(r.ctx.org.id, r.team.id);
  return NextResponse.json(await view(r));
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-contact' });
