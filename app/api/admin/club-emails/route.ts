import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { colleagueCount, colleagueGate, colleagueOptions, colleaguePreview, sendColleagueEmail, type Out } from '@/lib/club-group-email';
import { SAY } from '@/lib/club-group-email-words';

/**
 * Club Communications — the club's email to its COACHES and its BOARD (Stage 1, Session 1). ⚠ Not the tournament
 * announcements (`/api/admin/communications`): this namespace is the club's own.
 *   GET  ?orgSlug&kind=coaches|board → what the window offers this seat (groups, live counts, the pick list, Last sent).
 *   POST ?orgSlug  { action: 'count' | 'preview' | 'send', kind, group, … } → who it reaches / the email / the send.
 * Every rule is the server's (lib/club-group-email-rules.ts); no response carries an address.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const reply = (r: Out) => NextResponse.json(r.body, { status: r.ok ? 200 : r.status });

export const GET = withObservability(async (req: Request) => {
  const gate = await colleagueGate(req);
  if ('failure' in gate) return gate.failure;
  const kind = new URL(req.url).searchParams.get('kind');
  if (kind !== 'coaches' && kind !== 'board') return NextResponse.json({ error: SAY.failed, code: 'kind' }, { status: 400 });
  return reply(await colleagueOptions(gate.ctx, gate.seat, kind));
}, { route: '/api/admin/club-emails' });

export const POST = withObservability(async (req: Request) => {
  const gate = await colleagueGate(req);
  if ('failure' in gate) return gate.failure;
  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body', code: 'body' }, { status: 400 });
  }
  if (body.action === 'count') return reply(await colleagueCount(gate.ctx, gate.seat, body));
  if (body.action === 'preview') return reply(await colleaguePreview(gate.ctx, gate.seat, body));
  if (body.action === 'send') return reply(await sendColleagueEmail(gate.ctx, gate.seat, body));
  return NextResponse.json({ error: SAY.failed, code: 'action' }, { status: 400 });
}, { route: '/api/admin/club-emails' });
