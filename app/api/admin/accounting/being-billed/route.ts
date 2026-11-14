import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { teamIdsInScope } from '@/lib/club-team-route';
import { canOpenClubSchedules } from '@/lib/club-schedule-gate';
import { readDraftBills } from '@/lib/club-draft-bill-server';
import { isUuid } from '@/lib/utils';

/**
 * GET /api/admin/accounting/being-billed?orgSlug=[&line=] — the bills schedules haven't sent yet, by the budget line
 * they name (Club Tier Stage 13d-3, Ask 15 A): Accounting's "Being billed (draft)", the budget table's caption, New
 * allocation's warning and the read-only Fair shares window. Anyone who reads the club's books (a treasurer can't open
 * Schedules, so this is how the figures reach them); teams outside the reader's groups are counted, never named.
 * → 200 `{ bills: DraftBill[], opensSchedules }` — `opensSchedules` is the one Schedules rule (`canOpenClubSchedules`),
 * so "Open the schedule" is offered only to someone it opens for.
 */
export const GET = withObservability(async (req: Request) => {
  const gate = await resolveClubMoney(req, { scope: 'books', write: false });
  if ('error' in gate) return gate.error;
  const { ctx } = gate;
  const line = new URL(req.url).searchParams.get('line');
  if (line && !isUuid(line)) return NextResponse.json({ error: 'Pick a budget line.' }, { status: 400 });
  const bills = await readDraftBills(ctx.org.id, { lineId: line, scope: await teamIdsInScope(ctx) });
  return NextResponse.json({ bills, opensSchedules: canOpenClubSchedules({ planId: ctx.org.planId, role: ctx.role }) });
}, { route: '/api/admin/accounting/being-billed' });
