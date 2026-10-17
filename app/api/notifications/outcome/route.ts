import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { doorOutcome } from '@/lib/needs-attention';

/**
 * THE DOORS' OUTCOME (Needs attention clears itself, A5 — owner 2026-10-16). A page that opens an ask or a request from
 * its link — the schedule's `?answer=`, Payment requests' `?request=` — asks here when what it was opened for is no
 * longer waiting, and says the exact outcome in its note instead of guessing.
 *
 * Read only through the caller's OWN notification about that ask or request (`doorOutcome`): someone who was never
 * told about it gets 404, so this reads nothing a person couldn't already read in their bell.
 *
 *   GET ?handBackId=<uuid>  →  an ask, by its hand-back
 *   GET ?requestId=<uuid>   →  a request (a coach's, or an ask's)
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = withObservability(async (req: Request) => {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const handBackId = url.searchParams.get('handBackId') ?? undefined;
  const requestId = url.searchParams.get('requestId') ?? undefined;
  const id = handBackId ?? requestId;
  if (!id || !UUID_RE.test(id) || (handBackId && requestId)) {
    return NextResponse.json({ error: 'Name one ask or one request.' }, { status: 400 });
  }

  const outcome = await doorOutcome(user.id, handBackId ? { handBackId } : { requestId });
  if (!outcome.found) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json(outcome);
}, { route: '/api/notifications/outcome' });
