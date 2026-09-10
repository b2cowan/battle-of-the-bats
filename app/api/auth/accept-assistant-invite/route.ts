import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getAssistantInviteByToken, acceptAssistantInvite } from '@/lib/assistant-invites';
import { authAccountExistsForEmail } from '@/lib/auth-account-lookup';
import { getRepTeamCoaches, getActiveRepProgramYear } from '@/lib/db';
import { notify } from '@/lib/notify';
import { withObservability } from '@/lib/observability';

// GET — invite preview for the accept page (public; the invitee may not be signed in yet).
export const GET = withObservability(async (req: Request) => {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!token) return NextResponse.json({ error: 'Missing invite token.' }, { status: 400 });

  const invite = await getAssistantInviteByToken(token);
  if (!invite) return NextResponse.json({ error: 'This invite link is not valid.' }, { status: 404 });

  const user = await getAuthenticatedUser();

  // Does the INVITED email already have an account? Without this the accept page has only two
  // states — signed in, or "set up your account" — so a returning assistant who is merely signed
  // OUT is shown a create-account form and discovers the truth only after filling it in (the
  // signup call 409s and bounces them to sign-in). Answering here lets the page offer sign-in up
  // front, which is what it should have done from the start.
  //
  // ⚠ NOT an email-enumeration oracle, and stricter than the /coaches/join precedent it follows:
  // the email is read off the INVITE ROW, never from the query string, so a caller cannot probe
  // an address — they must already hold an unguessable, unexpired, single-use invite token, and
  // the page displays that email back to them anyway.
  //
  // Only asked when it can change the screen (signed out, invite still claimable), and it FAILS
  // OPEN: any error degrades to today's create-account form rather than 500ing an invite accept.
  let accountExists = false;
  if (!user && invite.status === 'pending' && !invite.expired) {
    try {
      accountExists = await authAccountExistsForEmail(invite.invitedEmail);
    } catch {
      accountExists = false;
    }
  }

  return NextResponse.json({
    invite: {
      status: invite.status,
      teamName: invite.teamName,
      orgName: invite.orgName,
      invitedByName: invite.invitedByName,
      invitedEmail: invite.invitedEmail,
      expired: invite.expired,
    },
    signedIn: !!user,
    signedInEmail: user?.email ?? null,
    accountExists,
  });
}, { route: '/api/auth/accept-assistant-invite' });

// POST — claim the invite for the signed-in user (creates the guest membership + assistant row).
export const POST = withObservability(async (req: Request) => {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === 'string' ? body.token : '';
  if (!token) return NextResponse.json({ error: 'Missing invite token.' }, { status: 400 });

  const result = await acceptAssistantInvite(token, user.id, user.email ?? '');
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  // Tell the team's head coach(es) that the assistant joined (their bell).
  try {
    const year = await getActiveRepProgramYear(result.teamId);
    if (year) {
      const coaches = await getRepTeamCoaches(year.id);
      const headUserIds = coaches.filter(c => c.coachRole === 'head_coach').map(c => c.userId);
      if (headUserIds.length > 0) {
        await notify({
          orgId: coaches[0]?.orgId ?? '',
          eventType: 'assistant_coach_joined',
          title: 'Assistant coach joined',
          body: `${user.email ?? 'An assistant coach'} accepted your invite.`,
          userIds: headUserIds,
          link: `/${result.orgSlug}/coaches/teams/${result.teamId}/settings`,
        });
      }
    }
  } catch { /* notification is best-effort */ }

  return NextResponse.json({ ok: true, orgSlug: result.orgSlug, teamId: result.teamId });
}, { route: '/api/auth/accept-assistant-invite' });
