import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { getSessionTwoStep } from '@/lib/api-auth';
import { lostPhoneVersion } from '@/lib/two-step-lost-phone';
import { FIELDLOGICHQ_CONTACT_EMAIL } from '@/lib/fieldlogichq-contact';

/**
 * "Lost your phone?" (drawings tab 4): which version to show. Reached from the code step, so by a session that has the
 * password but not the code (possibly a thief's). It answers only the version and our support address: never a club's
 * name, never a person.
 */
export const GET = withObservability(async () => {
  const state = await getSessionTwoStep();
  if (!state) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (!state.hasFactor) return NextResponse.json({ error: 'Two-step sign-in isn’t on for this account.' }, { status: 409 });
  return NextResponse.json({ version: await lostPhoneVersion(state.user.id, state.user.email), supportEmail: FIELDLOGICHQ_CONTACT_EMAIL });
}, { route: '/api/auth/two-step/lost-phone' });
