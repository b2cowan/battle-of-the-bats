import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { inParallel } from './supabase-paging';
import { BILL_PENDING_STATES, billIsPending } from './club-schedule-bill';
import { teamsOnly } from './club-schedule-holders';
import { billSlotsOf, computeBill, liveSlots, loadSchedule, pricePermitOf, readClubTeams, readPrices } from './club-schedule-server';
import type { DraftBill, DraftBillTeam } from './club-draft-bill';

/**
 * THE BILLS SCHEDULES HAVE NOT SENT YET, BY LINE (Club Tier Stage 13d-3, Ask 15 A) — what Accounting's line window, its
 * budget table and New allocation read as "being billed (draft)", and the read-only Fair shares window draws.
 *
 * The figures are the schedule's OWN bill: `computeBill` over the live slots at the permit's prices, the one function the
 * schedule's page (its Bill tile), the send and a coach's review card read — never a second computation of a share.
 * "Not sent yet" is `billIsPending` (drafts and in-review schedules with a bill and no allocation); a pending bill
 * reserves nothing on its line, so nothing here feeds Allocated, Not allocated or a send's refusal.
 *
 * `scope` is the reader's teams (`teamIdsInScope`): teams outside it are folded into one counted row, never named (B11).
 */
export async function readDraftBills(orgId: string, opts: { lineId?: string | null; scope?: Set<string> | null } = {}): Promise<DraftBill[]> {
  let query = supabaseAdmin.from('club_schedules')
    .select('id, bill_line_id')
    .eq('org_id', orgId).in('state', [...BILL_PENDING_STATES]).not('bill_line_id', 'is', null).not('bill_plan', 'is', null).is('allocation_id', null);
  if (opts.lineId) query = query.eq('bill_line_id', opts.lineId);
  const { data, error } = await query.order('created_at');
  if (error) throw error;
  const rows = data ?? [];
  if (!rows.length) return [];

  const lineIds = [...new Set(rows.map(r => r.bill_line_id as string))];
  const [teams, lines] = await Promise.all([
    readClubTeams(orgId),
    supabaseAdmin.from('org_budget_lines').select('id, description').eq('org_id', orgId).in('id', lineIds),
  ]);
  if (lines.error) throw lines.error;
  const lineName = new Map((lines.data ?? []).map(l => [l.id as string, l.description as string]));
  const teamName = new Map(teams.map(t => [t.id, t.name]));
  const teamOrder = teams.map(t => t.id);
  const scope = opts.scope ?? null;
  // Drafts priced from the same permits (the price permit and the rows') read their prices once.
  const pricesOf = new Map<string, ReturnType<typeof readPrices>>();
  const pricesFor = (permitId: string | null, rowPermits: readonly (string | null | undefined)[]) => {
    const rows = [...new Set(rowPermits.filter((x): x is string => !!x))].sort();
    const key = [permitId ?? '', ...rows].join('|');
    if (!pricesOf.has(key)) pricesOf.set(key, readPrices(orgId, permitId, rows));
    return pricesOf.get(key)!;
  };

  const bills = await inParallel(rows, 4, async (r): Promise<DraftBill | null> => {
    // The query narrowed; the row as loaded decides (it may have been sent in between).
    const loaded = await loadSchedule(orgId, r.id);
    if (!loaded || !billIsPending(loaded.row) || !loaded.row.bill_line_id) return null;
    const row = loaded.row;
    const lineId = loaded.row.bill_line_id;
    const prices = await pricesFor(pricePermitOf(row), loaded.time.blocks.map(b => b.permitId));
    const { slots, assignments } = liveSlots(loaded, prices.weightOf);
    const bill = computeBill(row, billSlotsOf(slots, assignments), prices.fullHour, teamOrder);
    if (!bill) return null;
    const shares = bill.shares;
    // The teams it bills: the split's own order, or (no amount yet) the club's order over the teams that hold time.
    const billed = shares ? [...shares.shares.keys()] : teamsOnly(teamOrder).filter(t => (bill.priced.get(t) ?? 0) > 0);
    // A bill that would charge no team (no time given yet) warns nobody of a double bill: it isn't "being billed".
    if (!billed.length) return null;
    const hoursOf = (t: string) => (bill.priced.get(t) ?? 0) / 60;
    const named: DraftBillTeam[] = [];
    const other = { count: 0, hours: 0, cents: 0 };
    for (const t of billed) {
      const c = shares ? shares.shares.get(t) ?? 0 : null;
      if (scope && !scope.has(t)) {
        other.count += 1; other.hours += hoursOf(t); other.cents += c ?? 0;
        continue;
      }
      named.push({ teamId: t, name: teamName.get(t) ?? 'A team', hours: hoursOf(t), cents: c });
    }
    if (other.count) named.push({ teamId: null, name: '', hours: other.hours, cents: shares ? other.cents : null, others: other.count });
    return {
      scheduleId: row.id, name: row.name, state: row.state === 'in_review' ? 'in_review' : 'draft',
      lineId, lineName: lineName.get(lineId) ?? '',
      cents: shares?.totalCents ?? null,
      teams: named, teamCount: billed.length,
      hours: billed.reduce((n, t) => n + hoursOf(t), 0),
      hourCents: shares ? Math.round(shares.rate * 60) : null,
      plan: row.bill_plan!, payments: Math.max(1, bill.periods.length),
    };
  });
  return bills.filter((b): b is DraftBill => !!b);
}
