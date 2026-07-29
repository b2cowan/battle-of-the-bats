import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getCoachOnboardingPrefs, setCoachOnboardingPrefs } from '@/lib/user-preferences';
import { withObservability } from '@/lib/observability';

/**
 * The signed-in coach's Premium-portal onboarding preferences (Quiet Mode Phase C2).
 *
 * Deliberately NOT org- or team-scoped, and so deliberately NOT under /api/coaches/[orgSlug]/…:
 * both preferences are facts about the COACH, not about a team. A coach with three teams dismisses
 * the tour once, and it stays dismissed on every device. Auth is "signed in" — there is nothing
 * here to gate on a coaching assignment, and a stray read returns two booleans about the caller's
 * own account.
 *
 * GET   → { tourDismissed, hintsOff }
 * PATCH { tourDismissed?, hintsOff? } → 204. Each field is optional and only the ones sent are
 *         written, so the tour control and the hints control can't clobber one another. No body:
 *         the client has already applied the choice optimistically and never reads a response, so
 *         re-selecting the row just to echo it would be a second round-trip nobody consumes.
 */
export const GET = withObservability(async () => {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  return NextResponse.json(await getCoachOnboardingPrefs(user.id));
}, { route: '/api/coaches/onboarding-preferences' });

export const PATCH = withObservability(async (req: Request) => {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  // Optional-chain so a non-object body (including the literal JSON `null`) is a clean 400 rather
  // than a TypeError → 500, matching the account-theme route's handling.
  const raw = (body as { tourDismissed?: unknown; hintsOff?: unknown } | null) ?? {};
  const patch: { tourDismissed?: boolean; hintsOff?: boolean } = {};
  if (raw.tourDismissed !== undefined) {
    if (typeof raw.tourDismissed !== 'boolean') {
      return NextResponse.json({ error: 'tourDismissed must be a boolean' }, { status: 400 });
    }
    patch.tourDismissed = raw.tourDismissed;
  }
  if (raw.hintsOff !== undefined) {
    if (typeof raw.hintsOff !== 'boolean') {
      return NextResponse.json({ error: 'hintsOff must be a boolean' }, { status: 400 });
    }
    patch.hintsOff = raw.hintsOff;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Send tourDismissed and/or hintsOff.' }, { status: 400 });
  }

  await setCoachOnboardingPrefs(user.id, patch);
  return new NextResponse(null, { status: 204 });
}, { route: '/api/coaches/onboarding-preferences' });
