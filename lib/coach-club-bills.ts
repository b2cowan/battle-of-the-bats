import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { REP_ALLOCATION_SPLIT_SELECT as SPLIT_SELECT, mapRepAllocationInstallment, mapRepAllocationSplitWithInstallments, type RepAllocationSplitWithInstallments } from './db';
import { clubInstallmentLeftTeamOn, seasonReadsClubInstallment as seasonReads } from './club-money-figures';
import { fetchAll, fetchAllIn } from './supabase-paging';
import type { RepAllocationInstallment } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB BILLS A SEASON'S CASH READS (Club Tier Stage 3c, S3C-11 — owner, 2026-10-07: "the payment counting in
 * the season that's running when the money actually moved"; call 1).
 *
 * A club bill is made on a season (`rep_allocation_splits.program_year_id`) and stays there. A PAYMENT of it counts
 * in the season RUNNING WHEN IT WAS RECORDED — the coach's "We've sent it", or the club's received — whatever day
 * was typed (`rep_allocation_installments.carried_by_program_year_id`, kept by mig 318's trigger on every writer).
 * So a season's cash reads:
 *   · every installment of ITS OWN bills whose money is still the team's (the forward view: still owed), and
 *   · every installment whose money left the team WHILE IT RAN — whichever season's bill it paid.
 * A payment of an earlier season's bill made after that season closed therefore moves the RUNNING season's Cash on
 * hand and never the closed one's (its close stays a record — CLAUDE.md, "a season is live until it is closed").
 * A payment the club recorded while the team had NO running season is carried by nobody until the next season to
 * run starts (the database stamps it then), so the closed season and the club's "at close" figure never move.
 *
 * ⚠ ONE READER FOR EVERY COACH CASH READ (`check:register` holds the register and Cash on hand to the cent): the
 * register (lib/coach-register-book.ts), Cash on hand (money-summary), the season settlement pot, Budget vs. Actual
 * and its cash band. `tests/unit/club-stage3c-server-guard.test.ts` refuses a coach cash read that filters club
 * installments by their bill's season instead.
 *
 * Working season only — no `?year=` reaches here (`coach-history-endpoint-guard`); the season is the caller's own.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export interface SeasonClubBill extends RepAllocationSplitWithInstallments {
  /** How many installments the WHOLE bill has (its `installments` here are only the ones this season reads). */
  installmentCount: number;
  /** An EARLIER season's bill, read here only because this season carries a payment of it (its bill — its plan,
   *  its "still owed" — is its own season's). */
  carriedOnly: boolean;
}

function shapeSplit(s: Record<string, any>, installments: RepAllocationInstallment[], installmentCount: number, carriedOnly: boolean): SeasonClubBill {
  return {
    ...mapRepAllocationSplitWithInstallments(s, installments.sort((a, b) => a.installmentNumber - b.installmentNumber)),
    installmentCount,
    carriedOnly,
  };
}

export async function getSeasonClubBills(teamId: string, programYearId: string): Promise<SeasonClubBill[]> {
  const [ownRes, carried] = await Promise.all([
    supabaseAdmin.from('rep_allocation_splits').select(SPLIT_SELECT)
      .eq('team_id', teamId).eq('program_year_id', programYearId).order('created_at'),
    fetchAll<Record<string, any>>((a, b) => supabaseAdmin.from('rep_allocation_installments').select('*')
      .eq('carried_by_program_year_id', programYearId).order('installment_number').order('id').range(a, b)),
  ]);
  if (ownRes.error) throw ownRes.error;
  const own = (ownRes.data ?? []) as Record<string, any>[];
  const ownIds = new Set(own.map(s => s.id as string));

  // The other seasons' bills this season carries a payment of, and every installment of this season's bills.
  const otherSplitIds = [...new Set(carried.map(r => r.split_id as string).filter(id => !ownIds.has(id)))];
  const [ownInst, otherSplits, otherCounts] = await Promise.all([
    fetchAllIn<Record<string, any>>([...ownIds], (c, a, b) => supabaseAdmin.from('rep_allocation_installments').select('*')
      .in('split_id', c).order('installment_number').order('id').range(a, b)),
    otherSplitIds.length
      ? supabaseAdmin.from('rep_allocation_splits').select(SPLIT_SELECT).eq('team_id', teamId).in('id', otherSplitIds)
        .then(r => { if (r.error) throw r.error; return (r.data ?? []) as Record<string, any>[]; })
      : Promise.resolve([] as Record<string, any>[]),
    otherSplitIds.length
      ? fetchAllIn<{ split_id: string }>(otherSplitIds, (c, a, b) => supabaseAdmin.from('rep_allocation_installments').select('split_id')
        .in('split_id', c).order('id').range(a, b))
      : Promise.resolve([] as { split_id: string }[]),
  ]);

  const bySplit = new Map<string, Record<string, any>[]>();
  for (const r of ownInst) bySplit.set(r.split_id, [...(bySplit.get(r.split_id) ?? []), r]);
  const otherCount = new Map<string, number>();
  for (const r of otherCounts) otherCount.set(r.split_id, (otherCount.get(r.split_id) ?? 0) + 1);

  const read = (rows: readonly Record<string, any>[], billSeason: string) => rows
    .map(r => ({ raw: r, inst: mapRepAllocationInstallment(r) }))
    .filter(x => seasonReads({ ...x.inst, carriedByProgramYearId: x.raw.carried_by_program_year_id ?? null }, billSeason, programYearId))
    .map(x => x.inst);

  const bills = own.map(s => {
    const rows = bySplit.get(s.id) ?? [];
    return shapeSplit(s, read(rows, programYearId), rows.length, false);
  });
  for (const s of otherSplits) {
    const rows = carried.filter(r => r.split_id === s.id);
    bills.push(shapeSplit(s, rows.map(mapRepAllocationInstallment), otherCount.get(s.id) ?? rows.length, true));
  }
  return bills;
}

/**
 * THE CLUB TAB'S EARLIER BILLS (Ask 8b, S3C-05): a team's bills made on an EARLIER season that are still owed —
 * an installment whose money is still the team's — each with its season's name. No year or season parameter: the
 * read is "still owed", the same question the Overview's `upcoming-payables` lane already asks. A paid or settled
 * old bill leaves the tab and lives with its season. Each bill carries ALL its installments (the coach can say
 * "We've sent it" on the owed ones and see what was paid).
 */
export async function getEarlierSeasonOwedBills(
  teamId: string, workingSeasonId: string,
): Promise<(SeasonClubBill & { season: { id: string; name: string } })[]> {
  const { data: splits, error } = await supabaseAdmin.from('rep_allocation_splits')
    .select(`${SPLIT_SELECT}, rep_program_years ( id, name )`)
    .eq('team_id', teamId).neq('program_year_id', workingSeasonId).order('created_at');
  if (error) throw error;
  const rows = (splits ?? []) as Record<string, any>[];
  if (rows.length === 0) return [];
  const inst = await fetchAllIn<Record<string, any>>(rows.map(s => s.id), (c, a, b) => supabaseAdmin
    .from('rep_allocation_installments').select('*').in('split_id', c).order('installment_number').order('id').range(a, b));
  const bySplit = new Map<string, RepAllocationInstallment[]>();
  for (const r of inst) bySplit.set(r.split_id, [...(bySplit.get(r.split_id) ?? []), mapRepAllocationInstallment(r)]);
  return rows
    .map(s => {
      const list = bySplit.get(s.id) ?? [];
      return { ...shapeSplit(s, list, list.length, false), season: { id: s.rep_program_years?.id ?? s.program_year_id, name: s.rep_program_years?.name ?? '' } };
    })
    .filter(b => b.installments.some(i => clubInstallmentLeftTeamOn(i) === null));
}
