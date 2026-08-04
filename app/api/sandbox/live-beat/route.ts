import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isDemoOrgSlug } from '@/lib/demo-org';
import { resolveDemoLiveBeat } from '@/lib/demo-tournament';

/**
 * The live beat behind the sandbox chrome's score pill.
 *
 * Answers one question — what is on the field right now, and when did the score last move? — so
 * the demo can prove it is running in the long gaps between actual score changes. See
 * `resolveDemoLiveBeat` for why that freshness reading is the point rather than the score.
 *
 * ── Why this is a route and not a prop ──────────────────────────────────────────────────────
 *
 * The org layout could resolve this once and hand it to the chrome, but the chrome outlives the
 * render: a visitor sits on the fan page for minutes at a time, and a value baked in at render
 * would freeze while its "N ago" counter kept climbing — the pill would end up lying about
 * exactly the thing it exists to prove. Polling keeps it true.
 *
 * ── Why it touches no database ──────────────────────────────────────────────────────────────
 *
 * The demo's entire state is a pure function of the clock, so the answer is computed, not read.
 * That makes this the cheapest endpoint in the app: no query, no session, nothing to rate-limit
 * beyond what the platform already does, and it stays correct even in the window where the
 * reconcile job has fallen behind — it describes what the demo SHOULD be showing, which is what
 * the visitor's own page will be showing within one tick.
 *
 * Read-only and public, exactly like the fan pages it sits above. It is gated on the demo-org
 * allow-list purely so it cannot be mistaken for a general-purpose scores endpoint.
 */
export const dynamic = 'force-dynamic';

export const GET = withObservability(async (req: Request) => {
  const slug = new URL(req.url).searchParams.get('org');
  if (!isDemoOrgSlug(slug)) {
    return NextResponse.json({ error: 'not a demo org' }, { status: 404 });
  }

  return NextResponse.json(resolveDemoLiveBeat(), {
    // The score steps on whole minutes, so a shared cache would hand a visitor a reading up to a
    // minute stale — small, but this is the one number whose freshness is the product claim.
    headers: { 'Cache-Control': 'no-store' },
  });
}, { route: '/api/sandbox/live-beat' });
