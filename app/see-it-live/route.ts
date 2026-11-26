import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resolveSameHostOrigin } from '@/lib/app-origin';
import { RETIRED_DEMO_LANDING } from '@/lib/sandbox-door';

/**
 * `/see-it-live` — the tournament demo's door, SHUT (owner ruling 2026-11-25, "Both public demos are
 * RETIRED"; plan `docs/projects/active/RETIRE_PUBLIC_DEMOS_PLAN.md` Phase 1, Ask 1 ruled A).
 *
 * It signs nobody in. An old link, QR code or bookmark lands on `/pricing` with a permanent redirect and
 * the visitor's session untouched: a stranger stays signed out, a customer stays themselves. A browser
 * still holding a demo session is signed out by the proxy's exit rule when it reaches `/pricing`, which
 * is outside the sandbox (that rule stays until Phase 2 deletes the demo accounts).
 *
 * The redirect base is the host the visitor asked for (`resolveSameHostOrigin`), never a header.
 * Phase 3 deletes this file and moves the redirect into `next.config`.
 */
export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL(RETIRED_DEMO_LANDING, resolveSameHostOrigin(request)), 308);
}
