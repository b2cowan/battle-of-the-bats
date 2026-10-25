import { NextResponse } from 'next/server';
import { requirePlatformAreaApi } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { captureError } from '@/lib/observability/capture';
import { cleanPeopleQuery, PEOPLE_STATUSES, readPeoplePage } from '@/app/platform-admin/customer-users/people-rows';
import type { PersonAuthStatus } from '@/lib/platform-people-lookup';

const PEOPLE_FAILED = 'People could not be read just now. Try again in a moment.';

/**
 * The People list's search and pages (Support console Stage 2, A8) — `POST`, the words in the BODY, never the address (the
 * same reason as Find: the error catcher keeps a request's path with anything after a question mark). Every role that
 * opens People reads it; the answer is never cached.
 */
export const POST = withObservability(async (req: Request) => {
  const auth = await requirePlatformAreaApi('customer_users', 'view');
  if (auth.response) return auth.response;
  try {
    const body = (await req.json().catch(() => ({}))) as { q?: unknown; status?: unknown; page?: unknown };
    const status = PEOPLE_STATUSES.includes(body.status as PersonAuthStatus) ? (body.status as PersonAuthStatus) : null;
    const page = typeof body.page === 'number' ? body.page : 1;
    const result = await readPeoplePage({ query: cleanPeopleQuery(body.q), status, page });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    await captureError(new Error(PEOPLE_FAILED), { route: '/api/platform-admin/people', method: 'POST' });
    return NextResponse.json({ error: PEOPLE_FAILED }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}, { route: '/api/platform-admin/people' });
