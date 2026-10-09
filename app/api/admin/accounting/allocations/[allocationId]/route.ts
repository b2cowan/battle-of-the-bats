import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { moveRefused, resolveClubMoney } from '@/lib/club-money-route';
import { teamIdsInScope } from '@/lib/club-team-route';
import { allocationDetail, allocationYear, loadClubLoop } from '@/lib/club-money-reads';
import { editClubAllocation } from '@/lib/club-allocation-edit';
import { canMoveClubMoney } from '@/lib/member-access';
import { tournamentToday } from '@/lib/timezone';
import { loadFiscalSetting } from '@/lib/club-fiscal-year-server';
import { lockedIn } from '@/lib/club-fiscal-year';
import { ALLOCATION_WINDOW_WORDS } from '@/lib/club-money-words';

type Params = { params: Promise<{ allocationId: string }> };

/**
 * GET /api/admin/accounting/allocations/[allocationId]?orgSlug= — an allocation (its window, Stage 3d): its
 * four figures, and one bill per team (the teams that need the club first), each with its
 * installments' states and, once received or sent, the day, how, the reference and who.
 * `canMove` says whether this member may record, confirm or undo (Ask 1). `allocation.notes` is the club's own note
 * (S3D-03 — asked at create, shown nowhere until 3d).
 *
 * ⚖ Stage 3c — THE FISCAL YEAR IT COUNTS IN, AND THE LOCK. `year` = { key, name, locked }: its line's fiscal year,
 * else the year its first installment falls due in (`allocationYear`, the one rule). `canEdit`: its NAME and NOTE may
 * change (Stage 3d, Ask 3 — its terms never do, Ask 7b) — never on a bill counting in a CLOSED year; its installments
 * stay receivable whatever the year (a bill still owed is the team's debt). Each received installment carries
 * `received.locked`: its line sits in a closed year, so Undo is not offered (Ask 8d — to undo it, reopen the year).
 */
export const GET = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'loop', write: false });
  if ('error' in r) return r.error;
  const { ctx } = r;
  const { allocationId } = await params;
  const today = tournamentToday();
  const [loop, setting] = await Promise.all([
    teamIdsInScope(ctx).then(scope => loadClubLoop(ctx.org.id, scope, { allocationId })),
    loadFiscalSetting(ctx.org.id),
  ]);
  const detail = await allocationDetail(ctx.org.id, loop, allocationId, today);
  if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // The eyebrow names the budget line it came from and the year it counts in (Stage 3d).
  const firstDue = detail.teams.flatMap(t => t.installments.map(i => i.dueDate)).sort()[0] ?? null;
  const { year, budgetLineName } = await allocationYear(ctx.org.id, detail.allocation, firstDue, setting);
  const canMove = canMoveClubMoney(ctx, ctx.org);
  // A received installment whose line sits in a closed year: the year’s name, and Reopen’s (the bill room’s locked sentence).
  const teams = detail.teams.map(t => ({
    ...t,
    installments: t.installments.map(i => {
      if (!i.received) return i;
      const lockedInYear = lockedIn(i.received.on, setting, canMove);
      return { ...i, received: { ...i.received, locked: lockedInYear !== null, lockedIn: lockedInYear } };
    }),
  }));
  // The year Reopen would unlock, when this bill's year is the latest closed one (its window's locked line).
  const reopen = year.locked ? lockedIn(year.firstDay, setting, canMove)?.reopen ?? null : null;
  return NextResponse.json({
    asOf: today, canMove, canEdit: canMove && !year.locked, budgetLineName,
    year: { key: year.key, name: year.name, locked: year.locked, reopen },
    ...detail, teams,
  });
}, { route: '/api/admin/accounting/allocations/[allocationId]' });

/**
 * PATCH /api/admin/accounting/allocations/[allocationId]?orgSlug= `{ description?, notes? }` — the allocation's NAME
 * and the club's NOTE, the one change its window offers (Stage 3d, Ask 3; the Rep Teams route kept from 3a retired).
 * Whoever holds the club's accounting (3a's one money rule); every team the bill reaches inside the member's team
 * groups (B11); a bill counting in a closed fiscal year refused in the lock's own words (409 `year_closed`).
 * Its terms have no writer (Ask 7b). The rules: lib/club-allocation-edit.ts.
 */
export const PATCH = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'loop', write: true });
  if ('error' in r) return r.error;
  const { allocationId } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: ALLOCATION_WINDOW_WORDS.nothingToChange, code: 'nothing_to_change' }, { status: 400 });
  const out = await editClubAllocation(r.ctx, allocationId, body as { description?: unknown; notes?: unknown });
  if (!out.ok) return moveRefused(out);
  return NextResponse.json({ allocation: out.allocation });
}, { route: '/api/admin/accounting/allocations/[allocationId]' });
