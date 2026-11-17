import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { colleagueGate, finishColleagueEmail } from '@/lib/club-group-email';
import { readColleagueEmail } from '@/lib/club-group-email-read';
import { SAY } from '@/lib/club-group-email-words';

/**
 * One coach or board email (Club Communications Stage 1).
 *   GET  → its record, shaped for this reader; Not found when they may not read it (never a refusal: legal §2c).
 *   POST { action: 'finish' } → "Send to the ones it missed": who may now send to that group (ask 14), or for a board email
 *        its sender, the owner or an admin; refused once its words have been deleted (T25).
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Params = { params: Promise<{ sendId: string }> };
const notFound = () => NextResponse.json({ error: SAY.notFound, code: 'not_found' }, { status: 404 });

export const GET = withObservability(async (req: Request, { params }: Params) => {
  const gate = await colleagueGate(req);
  if ('failure' in gate) return gate.failure;
  const { sendId } = await params;
  if (!isUuid(sendId)) return notFound();
  const record = await readColleagueEmail(gate.ctx, gate.seat, sendId);
  return record ? NextResponse.json(record) : notFound();
}, { route: '/api/admin/club-emails/[sendId]' });

export const POST = withObservability(async (req: Request, { params }: Params) => {
  const gate = await colleagueGate(req);
  if ('failure' in gate) return gate.failure;
  const { sendId } = await params;
  if (!isUuid(sendId)) return notFound();
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (body?.action !== 'finish') return NextResponse.json({ error: SAY.failed, code: 'action' }, { status: 400 });
  const r = await finishColleagueEmail(gate.ctx, gate.seat, sendId);
  return NextResponse.json(r.body, { status: r.ok ? 200 : r.status });
}, { route: '/api/admin/club-emails/[sendId]' });
