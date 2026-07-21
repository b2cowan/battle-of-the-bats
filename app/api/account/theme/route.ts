import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { setUserTheme } from '@/lib/user-preferences';
import { isUserTheme } from '@/lib/user-theme';
import { withObservability } from '@/lib/observability';

/**
 * PATCH /api/account/theme — persist the signed-in account's Dark⇄Warm app theme (TH-1/TH-3).
 *
 * Body: { theme: 'dark' | 'warm' | null } (null clears the choice back to default). 401 if not
 * signed in. The INITIAL value is read server-side by the consumer layout (no GET round-trip);
 * the client applies the theme locally for instant feedback, and this persists it cross-device.
 */
export const PATCH = withObservability(async (req: Request) => {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  // Optional-chain so a non-object body (e.g. the literal JSON `null`) yields a clean 400, not a
  // TypeError→500. Accept an explicit theme or an explicit null (reset to default); reject the rest.
  const requested = (body as { theme?: unknown } | null)?.theme;
  if (requested !== null && !isUserTheme(requested)) {
    return NextResponse.json({ error: 'theme must be "dark", "warm", or null' }, { status: 400 });
  }

  const theme = await setUserTheme(user.id, requested);
  return NextResponse.json({ theme });
}, { route: '/api/account/theme' });
