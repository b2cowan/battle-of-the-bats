import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { acceptAssistantInviteById, declineClubCoachInvite } from '@/lib/assistant-invites';
import { tellClubInviteDeclined, tellInviteAccepted } from '@/lib/assistant-invite-notices';
import { withObservability } from '@/lib/observability';

/**
 * POST /api/auth/coach-invitations/[inviteId] — `{ action: 'accept' | 'decline' }` on a CLUB's coach
 * invitation, from the invitee's home page (Club Tier Stage 2, specimen 6 · 2b: "Stage 1's home-page
 * invitation card, reused … Declining tells Dana, and 10U A's row stays red").
 *
 * SECURITY: the invitation is found by id, so the proof of address is the SESSION's — the signed-in
 * account's email must be CONFIRMED and must equal the invitation's (checked inside the shared accept
 * and in the decline's own WHERE). A guessed id reaches nothing that isn't already the caller's.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ inviteId: string }> },) => {
  const { inviteId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });
  if (!user.email || !user.email_confirmed_at) {
    return NextResponse.json({ error: 'Confirm your email address first, then answer the invitation.' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.action === 'accept') {
    const result = await acceptAssistantInviteById(inviteId, user.id, user.email);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    await tellInviteAccepted(result, user);
    // Where a coach starts: the team's Overview (the season gate sends a team between seasons to
    // its closed-season page, whose note says the club manages seasons).
    return NextResponse.json({ ok: true, destination: `/${result.orgSlug}/coaches/teams/${result.teamId}` });
  }
  if (body.action === 'decline') {
    const declined = await declineClubCoachInvite(inviteId, user.email);
    if (!declined) {
      return NextResponse.json({ error: 'This invitation is no longer waiting — it may have been answered or cancelled.' }, { status: 409 });
    }
    await tellClubInviteDeclined(declined, user);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}, { route: '/api/auth/coach-invitations/[inviteId]' });
