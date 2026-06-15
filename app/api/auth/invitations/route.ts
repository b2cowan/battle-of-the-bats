import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { listPendingInvitesForUser, reconcilePendingInvitesForUser } from '@/lib/invite-reconciliation';
import { withObservability } from '@/lib/observability';

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// GET /api/auth/invitations — pending invitations for the AUTHENTICATED user.
// Reconciles by email first (so invites minted under a different identity surface),
// then lists the user_id-keyed pending rows. Keyed strictly on the session identity —
// never a client-supplied email — to prevent invite-claiming.
export const GET = withObservability(async () => {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await reconcilePendingInvitesForUser({
    id: user.id,
    email: user.email,
    emailConfirmedAt: user.email_confirmed_at,
  });

  const invitations = await listPendingInvitesForUser(user.id);
  return NextResponse.json({ ok: true, invitations });
}, { route: '/api/auth/invitations' });
