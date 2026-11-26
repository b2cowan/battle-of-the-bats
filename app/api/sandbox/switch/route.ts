import { NextResponse } from 'next/server';

/**
 * The tournament demo's session swap, RETIRED (owner ruling 2026-11-25). It replaced a signed-in
 * visitor's session with the demo account's; it now refuses every request with 410 Gone and touches
 * no session. Phase 3 deletes it.
 */
export const dynamic = 'force-dynamic';

export function POST() {
  return NextResponse.json({ error: 'The live demos have been retired.' }, { status: 410 });
}
