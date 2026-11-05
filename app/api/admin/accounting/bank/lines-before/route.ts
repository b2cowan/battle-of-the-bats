import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { moveRefused, resolveClubMoney } from '@/lib/club-money-route';
import { badBankIds, linesBefore } from '@/lib/bank-club-steps';

/**
 * GET ?orgSlug=&date=YYYY-MM-DD&account=&q=&offset= — C1's "still outstanding then" picker (Ask 3): posted lines of the
 * account's books (before the club has an account, every club book) dated on or before the starting DAY, newest first,
 * searched by words or an amount, 50 at a time. Read-only, but it serves the set-up screen, so it takes the write gate.
 */
export const GET = withObservability(async (req: Request) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const url = new URL(req.url);
  const accountId = url.searchParams.get('account') || null;
  const bad = accountId ? badBankIds({ accountId }) : null;
  if (bad) return bad;
  const out = await linesBefore(r.ctx, {
    accountId, date: url.searchParams.get('date'), q: url.searchParams.get('q') ?? '',
    offset: Number(url.searchParams.get('offset') ?? 0),
  });
  if (!out.ok) return moveRefused(out);
  return NextResponse.json({ lines: out.lines, more: out.more });
}, { route: '/api/admin/accounting/bank/lines-before' });
