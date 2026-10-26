import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { acceptLeagueCoachInvite, coachTeamPath, getLeagueCoachInviteByToken } from '@/lib/house-league-coach-invites';
import { authAccountExistsForEmail } from '@/lib/auth-account-lookup';
import { withObservability } from '@/lib/observability';

/**
 * A house-league coach's invite (Club Tier Stage 9c, Part 5). The rep invite's accept door, for a team page instead of
 * the Coaches Portal: GET previews it for the accept page (public: the coach may not be signed in yet), POST accepts it
 * for the signed-in person with the invited address.
 */
export const GET = withObservability(async (req: Request) => {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!token) return NextResponse.json({ error: 'Missing invite token.' }, { status: 400 });
  const invite = await getLeagueCoachInviteByToken(token);
  if (!invite) return NextResponse.json({ error: 'This invite link is not valid.' }, { status: 404 });
  const user = await getAuthenticatedUser();
  // As the rep invite's: the email is read off the invite row, never the query string, so this is no oracle. Fails open.
  let accountExists = false;
  if (!user && invite.status === 'pending' && !invite.expired) {
    try { accountExists = await authAccountExistsForEmail(invite.invitedEmail); } catch { accountExists = false; }
  }
  return NextResponse.json({
    invite: {
      status: invite.status, expired: invite.expired, invitedEmail: invite.invitedEmail,
      firstName: invite.firstName, lastName: invite.lastName,
      teamName: invite.teamName, orgName: invite.orgName,
    },
    signedIn: !!user,
    signedInEmail: user?.email ?? null,
    accountExists,
  });
}, { route: '/api/auth/accept-league-coach' });

export const POST = withObservability(async (req: Request) => {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === 'string' ? body.token : '';
  if (!token) return NextResponse.json({ error: 'Missing invite token.' }, { status: 400 });
  const result = await acceptLeagueCoachInvite(token, user.id, user.email ?? '');
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, path: coachTeamPath(result.orgSlug, result.seasonSlug, result.teamId) });
}, { route: '/api/auth/accept-league-coach' });
