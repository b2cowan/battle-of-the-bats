import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { moveRefused, resolveClubMoney } from '@/lib/club-money-route';
import { renameFiscalYear } from '@/lib/club-fiscal-year-moves';

type Params = { params: Promise<{ key: string }> };

/**
 * PATCH /api/admin/accounting/fiscal-years/[key]?orgSlug= — rename an OPEN fiscal year (Club Tier Stage 3c, Ask 5).
 * `key` is the year's first day. Body `{ name }` (1–40 characters, trimmed). WHO: 3a's one money rule.
 * → 200 `{ year: { key, name } }`; 400 `bad_name`; 409 `name_taken` (another year has it) · `year_closed` (a closed
 * year's name never changes); 404 `not_found` (no year starts that day).
 */
export const PATCH = withObservability(async (req: Request, { params }: Params) => {
  const gate = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in gate) return gate.error;
  const { key } = await params;
  const body = await req.json().catch(() => ({}));
  const done = await renameFiscalYear(gate.ctx.org.id, key, body?.name);
  if (!done.ok) return moveRefused(done);
  return NextResponse.json({ year: done.year });
}, { route: '/api/admin/accounting/fiscal-years/[key]' });
