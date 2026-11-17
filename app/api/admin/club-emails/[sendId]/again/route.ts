import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { againColleagueEmail, colleagueGate } from '@/lib/club-group-email';
import { SAY } from '@/lib/club-group-email-words';

/**
 * "Send again to these people" (coach ask 3): the people of a sent email this seat may still pick, and its subject — for the
 * window to open with the pick filled in and the message empty. It sends NOTHING (T19).
 */
export const dynamic = 'force-dynamic';

export const GET = withObservability(async (req: Request, { params }: { params: Promise<{ sendId: string }> }) => {
  const gate = await colleagueGate(req);
  if ('failure' in gate) return gate.failure;
  const { sendId } = await params;
  if (!isUuid(sendId)) return NextResponse.json({ error: SAY.notFound, code: 'not_found' }, { status: 404 });
  const r = await againColleagueEmail(gate.ctx, gate.seat, sendId);
  return NextResponse.json(r.body, { status: r.ok ? 200 : r.status });
}, { route: '/api/admin/club-emails/[sendId]/again' });
