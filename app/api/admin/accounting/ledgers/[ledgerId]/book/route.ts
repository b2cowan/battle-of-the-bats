import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { readBook, readBookForExport } from '@/lib/club-ledger-read';
import { LEDGER_EXPORT_COLUMNS, ledgerExportRows } from '@/lib/club-ledger';
import { canMoveClubMoney } from '@/lib/member-access';
import { isCalendarDate } from '@/lib/timezone';
import { teamIdsInScope } from '@/lib/club-team-route';

type Params = { params: Promise<{ ledgerId: string }> };

/**
 * GET /api/admin/accounting/ledgers/[ledgerId]/book?orgSlug=&from=&to=
 *
 * The Ledger tab's read (Ask 6, C14): one book, oldest first, a Starting balance before the window
 * and an Ending balance at its end, the book's Balance ALL-TIME, each line worded with its source,
 * who recorded it and what may be done with it. EVERY line in the window — every status, every type, unpaged, out
 * of a walk over every row (no 1,000-row cap): ⚖ the Ledger filters on the screen, as the coach's does (owner
 * 2026-10-09), so a tick never waits on this read and the table changes in one step.
 *
 * `&export=1` — the whole window, every status and type: one signed Amount, voids kept and marked
 * VOID, pending marked PENDING, neither in the totals (the book's own rule). Columns included.
 */
export const GET = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: false });
  if ('error' in r) return r.error;
  const { ctx } = r;
  const { ledgerId } = await params;
  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if ((from && !isCalendarDate(from)) || (to && !isCalendarDate(to))) {
    return NextResponse.json({ error: 'from and to must be dates (YYYY-MM-DD)', code: 'bad_window' }, { status: 400 });
  }

  // A team book outside the member's groups reads as not found (B11).
  const scope = await teamIdsInScope(ctx);

  if (url.searchParams.get('export') === '1') {
    const out = await readBookForExport(ctx.org.id, ctx.org.name, ledgerId, { from, to, scope });
    if (!out) return NextResponse.json({ error: 'Ledger not found' }, { status: 404 });
    const { rows, totals } = ledgerExportRows(out.lines);
    return NextResponse.json({
      ledger: out.book.ledger, window: out.book.window,
      startingBalance: out.book.startingBalance, endingBalance: out.book.endingBalance,
      columns: LEDGER_EXPORT_COLUMNS, rows, totals,
    });
  }

  const book = await readBook(ctx.org.id, ctx.org.name, ledgerId, { from, to, scope });
  if (!book) return NextResponse.json({ error: 'Ledger not found' }, { status: 404 });
  // A team's book is the coaches' — read-only from the club whoever is reading (C12).
  return NextResponse.json({ ...book, canMove: canMoveClubMoney(ctx, ctx.org) && book.ledger.kind !== 'team' });
}, { route: '/api/admin/accounting/ledgers/[ledgerId]/book' });
