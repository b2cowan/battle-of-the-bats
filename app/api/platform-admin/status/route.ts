import { NextResponse } from 'next/server';
import { requirePlatformAreaApi } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { readStatus } from '@/lib/platform-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * STATUS, READ (Support console Stage 5, owner Q1/Q3 2026-10-26). Every staff role reads it (it says nothing about any
 * customer). The power check comes before anything is read, the shared reading included (threat T2).
 *
 * The answer is verdict words, numbers and times only, and never cached by the browser: a stale page must never look
 * fresh. The providers are read at most once every 30 seconds for all staff together (lib/platform-status.ts).
 */
export const GET = withObservability(async () => {
  const auth = await requirePlatformAreaApi('status', 'view');
  if (auth.response) return auth.response;
  const answer = await readStatus();
  return NextResponse.json(answer, { headers: { 'Cache-Control': 'no-store, private' } });
}, { route: '/api/platform-admin/status' });
