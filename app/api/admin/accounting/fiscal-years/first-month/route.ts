import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { moveRefused, resolveClubMoney } from '@/lib/club-money-route';
import { tournamentToday } from '@/lib/timezone';
import { setFirstMonth } from '@/lib/club-fiscal-year-moves';

/**
 * The fiscal year's FIRST MONTH (Club Tier Stage 3c, Ask 5). WHO: 3a's one money rule (`canMoveClubMoney`).
 *
 * GET ?month=9 — the PREVIEW: what the change would do, computed by the very step that makes it and rolled back, so
 * the window shows the consequence BEFORE the save (and the counts can't differ from the save's).
 * POST { month } — the change, in ONE step.
 *
 * → 200 `{ change: { mode, preview, current, next, thenFrom, moved, split, joined, movedFrom, movedTo } }`:
 *   · mode `unchanged` (already that month) · `fresh` (the club holds nothing: it just starts on the month, no short
 *     year) · `short_next` (this year keeps its months; the NEXT year is the short one, ending the month before) ·
 *     `whole_next` (the next year already starts on that month);
 *   · `moved` plan lines that moved whole to a later year's plan, `split` lines divided by their dates (one line per
 *     year, same word), `joined` lines that landed on one of the same word; `movedFrom`/`movedTo` the dates of the
 *     money that moved. Ledger lines never move.
 * Refusals: 400 `bad_month`; 409 `first_close_done` (refused once any year is closed) · `split_below_allocated`
 * (+ `line`, `allocated`, `staying`: a split would leave a line below what it bills its teams).
 */
export const GET = withObservability(async (req: Request) => {
  const gate = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in gate) return gate.error;
  const month = new URL(req.url).searchParams.get('month');
  const done = await setFirstMonth(gate.ctx.org.id, month, tournamentToday(), true);
  if (!done.ok) return moveRefused(done);
  return NextResponse.json({ change: done.change });
}, { route: '/api/admin/accounting/fiscal-years/first-month' });

export const POST = withObservability(async (req: Request) => {
  const gate = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in gate) return gate.error;
  const body = await req.json().catch(() => ({}));
  const done = await setFirstMonth(gate.ctx.org.id, body?.month, tournamentToday(), false);
  if (!done.ok) return moveRefused(done);
  return NextResponse.json({ change: done.change });
}, { route: '/api/admin/accounting/fiscal-years/first-month' });
