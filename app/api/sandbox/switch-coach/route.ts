import { NextResponse } from 'next/server';

/**
 * The coach demo's session swap, RETIRED (owner ruling 2026-11-25). The twin of
 * `/api/sandbox/switch`: 410 Gone, no session touched. Phase 3 deletes it.
 */
export const dynamic = 'force-dynamic';

export function POST() {
  return NextResponse.json({ error: 'The live demos have been retired.' }, { status: 410 });
}
