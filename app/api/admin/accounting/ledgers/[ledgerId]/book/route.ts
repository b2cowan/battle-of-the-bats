import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { readBook, readBookForExport, type LineStatus } from '@/lib/club-ledger-read';
import { LEDGER_EXPORT_COLUMNS, ledgerExportRows, type LineType } from '@/lib/club-ledger';
import { canMoveClubMoney } from '@/lib/member-access';
import { isCalendarDate } from '@/lib/timezone';
import { teamIdsInScope } from '@/lib/club-team-route';

type Params = { params: Promise<{ ledgerId: string }> };

const STATUSES = new Set<LineStatus>(['posted', 'pending', 'void']);
const TYPES = new Set<LineType>(['expense', 'income', 'team_allocations', 'team_support', 'transfer', 'house_league_fees']);
const list = (v: string | null) => (v ? v.split(',').map(s => s.trim()).filter(Boolean) : null);

/**
 * GET /api/admin/accounting/ledgers/[ledgerId]/book?orgSlug=&from=&to=&status=&type=&category=&offset=&limit=
 *
 * The Ledger tab's read (Ask 6, C14): one book, oldest first, a Starting balance before the window
 * and an Ending balance at its end, the book's Balance ALL-TIME, each line worded with its source,
 * who recorded it and what may be done with it. Status opens on Posted + Pending (voids off the book
 * until asked); `counts` are the window's census (the export's "every entry"), `optionCounts` what ticking each
 * Status / Type choice would list given the other filters (Filter Counts D5). Paged (`limit` ≤ 500) out of a
 * walk over every row — no 1,000-row cap.
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

  const status = list(url.searchParams.get('status'))?.filter((s): s is LineStatus => STATUSES.has(s as LineStatus)) ?? null;
  const types = list(url.searchParams.get('type'))?.filter((t): t is LineType => TYPES.has(t as LineType)) ?? null;
  const categories = list(url.searchParams.get('category'));
  const book = await readBook(ctx.org.id, ctx.org.name, ledgerId, {
    from, to, status, types, categories, scope,
    offset: Number(url.searchParams.get('offset') ?? 0) || 0,
    limit: Number(url.searchParams.get('limit') ?? 100) || 100,
  });
  if (!book) return NextResponse.json({ error: 'Ledger not found' }, { status: 404 });
  // A team's book is the coaches' — read-only from the club whoever is reading (C12).
  return NextResponse.json({ ...book, canMove: canMoveClubMoney(ctx, ctx.org) && book.ledger.kind !== 'team' });
}, { route: '/api/admin/accounting/ledgers/[ledgerId]/book' });
