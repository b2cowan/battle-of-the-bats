import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getAssistantInviteByToken, acceptAssistantInvite } from '@/lib/assistant-invites';
import { authAccountExistsForEmail } from '@/lib/auth-account-lookup';
import { tellInviteAccepted } from '@/lib/assistant-invite-notices';
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
      // Which of the four kinds this invite offers (mig 288) — the page says "join as {kind}".
      // NULL on an invite minted before the column existed; the page reads that as an assistant.
      staffKind: invite.staffKind,
      // The seat and the door (mig 312): a club naming a head coach must not be told "assistant".
      coachRole: invite.coachRole,
      sentBy: invite.sentBy,
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

  // Tell the people who need to know — the one helper both answer doors share (the home card too).
  await tellInviteAccepted(result, user);

  return NextResponse.json({ ok: true, orgSlug: result.orgSlug, teamId: result.teamId });
}, { route: '/api/auth/accept-assistant-invite' });
