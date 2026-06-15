import { NextRequest, NextResponse } from 'next/server';
import { getRegistrationAccountStatus } from '@/lib/basic-coach-teams';
import { withObservability } from '@/lib/observability';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Signed-out-safe: tells the /coaches/join landing whether the coach for a given tournament
 * registration ALREADY has an account, so it can offer "sign in to see {team}" instead of a
 * redundant "create account" form (the merged register+account flow already created it).
 *
 * NOT an email-enumeration oracle: the existence answer is keyed on the registration's OWN
 * stored email and only returned when the supplied `email` matches it — a caller must hold a
 * real registrationId whose email they already know. Unknown/mismatched pairs return
 * `{ accountExists: false }` so the page falls back to the normal create-account form.
 */
export const GET = withObservability(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const registrationId = url.searchParams.get('registrationId') ?? '';
    const email = url.searchParams.get('email') ?? '';

    if (!registrationId || !email) {
      return json({ accountExists: false });
    }

    const status = await getRegistrationAccountStatus({ registrationId, email });
    if (!status) {
      // Registration/email don't line up — say nothing useful (no oracle), show the normal form.
      return json({ accountExists: false });
    }

    return json({
      accountExists: status.accountExists,
      teamName: status.teamName,
    });
  } catch (error) {
    console.error('[coaches registration-account-status GET] error:', error);
    // Fail safe to the normal form rather than leaking an error path.
    return json({ accountExists: false }, 200);
  }
}, { route: '/api/coaches/registration-account-status' });
