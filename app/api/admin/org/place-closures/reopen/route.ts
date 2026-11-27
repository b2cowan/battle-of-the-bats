import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { reopenClosures, reopenPreview } from '@/lib/place-closure-window-server';
import { closureActor, placeClosureGate as gate } from '@/lib/place-closure-route';

/**
 * REOPEN (Club Website Stage 2, K11 A; "Closed places, summarized" Session B, S5 and S6, owner 2026-11-26). One door for
 * every Reopen window, a set of closures at a time (one diamond, a park's ticked diamonds, all our fields and the places
 * closed on their own):
 *   GET  ?ids=a,b — what reopening that set does, counted on the server (a game marked twice counts once; a mark held only
 *        by a sibling in the set comes off; a house league admin gets counts, no team's name, K1).
 *   POST { ids } — stamp each (mig 539's one-closure stamp), then ONE read of whom to tell over every closure that reopened,
 *        then ONE coach send: a coach with games on two diamonds gets one email. Not all-or-nothing (the gate): a stamp that
 *        fails comes back in `failed`, and the others' coaches are still told. No game moves; the postponed house league
 *        games wait for a date and are counted for the result.
 * ⚖ K1 and K14 as the press: owner, admin, house league admin, on the places gate (404 where it fails).
 */
const MAX_IDS = 100;

function idsOf(raw: unknown): string[] | null {
  const list = typeof raw === 'string' ? raw.split(',') : Array.isArray(raw) ? raw : null;
  if (!list || !list.length || list.length > MAX_IDS || !list.every(id => isUuid(id))) return null;
  return [...new Set(list as string[])];
}

const bad = () => NextResponse.json({ error: 'The request was not understood' }, { status: 400 });

export const GET = withObservability(async (req: Request) => {
  const g = await gate(req);
  if (g.refused) return g.refused;
  const ids = idsOf(new URL(req.url).searchParams.get('ids'));
  if (!ids) return bad();
  return NextResponse.json(await reopenPreview(g.ctx.org, g.ctx.role, ids));
}, { route: '/api/admin/org/place-closures/reopen' });

export const POST = withObservability(async (req: Request) => {
  const g = await gate(req);
  if (g.refused) return g.refused;
  const { ctx } = g;
  const body = await req.json().catch(() => null) as { ids?: unknown } | null;
  const ids = idsOf(body?.ids);
  if (!ids) return bad();
  const r = await reopenClosures({ org: ctx.org, ids, actor: await closureActor(ctx) });
  if (r.refusal === 'not_found') return NextResponse.json({ error: 'Closure not found' }, { status: 404 });
  return NextResponse.json({ reopened: r.reopened, failed: r.failed, coaches: r.coaches, stillWaiting: r.stillWaiting, seasonIds: r.seasonIds });
}, { route: '/api/admin/org/place-closures/reopen' });
