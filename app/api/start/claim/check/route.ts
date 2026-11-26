import { NextResponse } from 'next/server';
import { withObservability, captureAndJson } from '@/lib/observability';
import { checkClaimCode, claimVisitorKey } from '@/lib/preview-claim-server';
import { CLAIM_WORDS } from '@/lib/preview-claim';

/**
 * POST /api/start/claim/check — the claim's code page (Club Website Track P, Session P3; T7, drawing tab 6.1). Public: the
 * person holds nothing but the printed code, and the code is asked before anyone makes an account.
 *
 * Body `{ slug, code }`. Answers 200 `{ pass }` for the right code (it carries the claim through the account step and its
 * email, bound to the club and this code, lapsing in a day), or 200 `{ state }` with `wrong` · `resting` · `claimed` ·
 * `removed` (+ `removedOn`) · `missing` · `shape`. Five wrong codes in an hour, for the club or for this visitor, rest the
 * door for an hour (counted in the database, mig 540). Nothing here writes to the club.
 */
export const POST = withObservability(async (req: Request) => {
  const body = await req.json().catch(() => ({})) as { slug?: unknown; code?: unknown };
  const slug = typeof body.slug === 'string' ? body.slug.trim().slice(0, 100) : '';
  const code = typeof body.code === 'string' ? body.code.slice(0, 40) : '';
  if (!slug) return NextResponse.json({ state: 'missing' });
  try {
    const result = await checkClaimCode(slug, code, claimVisitorKey(req));
    if (result.ok) return NextResponse.json({ pass: result.pass });
    return NextResponse.json({ state: result.state, removedOn: result.removedOn ?? null });
  } catch (err) {
    return captureAndJson(err, { error: CLAIM_WORDS.err.didNotFinish }, 500);
  }
}, { route: '/api/start/claim/check' });
