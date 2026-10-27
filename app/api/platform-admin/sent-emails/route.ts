import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { captureError } from '@/lib/observability/capture';
import { takeSentEmailSearch } from '@/lib/sent-log';
import { listSentLogRows } from '@/lib/sent-log-people';
import { isSentState, looksLikeEmailAddress, SENT_LOG_FAILED, SENT_SEARCH_LIMIT } from '@/lib/sent-log-words';

/**
 * Health > Sent emails: the list, its search and its pages (Support console Stage 5, owner Q3/Q6; drawing E3; threats
 * T14-T17) — `POST /api/platform-admin/sent-emails`, body `{ to?, state?, offset? }`.
 *
 * ⚖ THE SHAPE, the same as Find's (A3; `tests/unit/support-console-stage5-sent-log-guard.test.ts`):
 *   • the `sent_log` power is the FIRST statement: a signed-out caller, a customer, a Product viewer or a disabled staff
 *     account gets 403 and nothing is read (T16);
 *   • the address rides in the BODY, never the address bar — the error catcher keeps a request's path with anything after a
 *     question mark. This handler never reads the URL, never logs and never audits the words (T14);
 *   • a search (an address was given) is counted against the staff member's daily limit in the database BEFORE anything is
 *     read (T17). Browsing the newest emails is not a search and is not counted;
 *   • an address is exact and whole: the list answers one inbox, never a partial walk of everyone's;
 *   • every failure becomes one fixed sentence before anything records it; every answer is `no-store`.
 */
const NO_STORE = { 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export const POST = withObservability(async (req: Request) => {
  const auth = await requirePlatformPower('sent_log');
  if (auth.response) return json({ error: 'Forbidden' }, auth.response.status);

  try {
    const body = (await req.json().catch(() => ({}))) as { to?: unknown; state?: unknown; offset?: unknown };
    const typed = typeof body.to === 'string' ? body.to.trim().toLowerCase() : '';
    if (typed && !looksLikeEmailAddress(typed)) return json({ error: 'Type the whole email address.' }, 400);
    const state = isSentState(body.state) ? body.state : null;
    const offset = typeof body.offset === 'number' && Number.isFinite(body.offset) && body.offset > 0 ? Math.floor(body.offset) : 0;

    if (typed && !(await takeSentEmailSearch(auth.user.id))) return json({ error: SENT_SEARCH_LIMIT }, 429);

    return json(await listSentLogRows(auth.role, { to: typed || null, state, offset }));
  } catch {
    // Never the caught error itself: a database error can echo what was typed (T14). One fixed sentence, recorded as such.
    await captureError(new Error(SENT_LOG_FAILED), { route: '/api/platform-admin/sent-emails', method: 'POST' });
    return json({ error: SENT_LOG_FAILED }, 500);
  }
}, { route: '/api/platform-admin/sent-emails' });
