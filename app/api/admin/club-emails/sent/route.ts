import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { colleagueGate } from '@/lib/club-group-email';
import { listColleagueEmails } from '@/lib/club-group-email-read';

/**
 * The coach and board emails this reader may read, newest first (Club Communications Stage 1). A row the reader may not read
 * is absent from the response, not hidden by the screen. Session 2 merges these with the family log into the one list.
 *   GET ?orgSlug&before=<sentAt>
 */
export const dynamic = 'force-dynamic';

export const GET = withObservability(async (req: Request) => {
  const gate = await colleagueGate(req);
  if ('failure' in gate) return gate.failure;
  const before = new URL(req.url).searchParams.get('before');
  const at = before && !Number.isNaN(Date.parse(before)) ? new Date(before).toISOString() : null;
  return NextResponse.json(await listColleagueEmails(gate.ctx, gate.seat, at));
}, { route: '/api/admin/club-emails/sent' });
