import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resolveSameHostOrigin } from '@/lib/app-origin';
import { RETIRED_DEMO_LANDING } from '@/lib/sandbox-door';

/**
 * `/see-it-live/coaches` — the coach demo's door, SHUT (owner ruling 2026-11-25). The twin of
 * `/see-it-live`; read that file's note. It signs nobody in and lands every visitor on `/pricing`.
 */
export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL(RETIRED_DEMO_LANDING, resolveSameHostOrigin(request)), 308);
}
