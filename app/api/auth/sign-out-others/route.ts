import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { getSessionTwoStep } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase-server';

/**
 * SIGN OUT EVERYWHERE ELSE (Board Ready · two-step sign-in, Part 2; ask 5: one button, no device list). Every session of
 * this account but this one is ended by the sign-in service. Not a code-asking action: it only ever takes access away.
 */
export const POST = withObservability(async () => {
  const state = await getSessionTwoStep();
  if (!state?.passed) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const { error } = await (await createClient()).auth.signOut({ scope: 'others' });
  if (error) return NextResponse.json({ error: 'We couldn’t sign out your other devices. Try again.' }, { status: 502 });
  return NextResponse.json({ ok: true });
}, { route: '/api/auth/sign-out-others' });
