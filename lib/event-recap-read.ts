import 'server-only';
/**
 * The ONE read behind "How it finished" and the event in numbers (Tournament admin redesign Stage 4,
 * Part 0). The finished board (`/api/admin/tournament-dashboard`) and Summary
 * (`/api/admin/tournaments/[id]/summary`) both return `recap` from this function unchanged, so the two
 * screens cannot disagree (tests/unit/event-recap.test.ts holds the definitions; its route guard holds
 * the "both routes, this function" rule).
 *
 * The standings come from the PUBLISHED readers (getTeams / getGames / getDivisions with the
 * tournament's settings — what the public Standings page ranks), never from a route's own rows; the
 * money from the raw `teams` rows, because the domain `Team` carries no payments.
 */
import { supabaseAdmin } from './supabase-admin';
import { getDivisions, getGames, getTeams } from './db';
import { computeEventRecap, type EventRecap } from './event-recap';
import type { TournamentSettings } from './types';

type RecapTournamentRow = {
  slug: string | null;
  status: string | null;
  settings: TournamentSettings | null;
  public_hidden_pages: unknown;
  fee_schedule_mode: string | null;
  deposit_amount: number | null;
  deposit_due_date: string | null;
  total_fee_amount: number | null;
  total_fee_due_date: string | null;
};

type RecapPaymentRow = { division_id: string | null; status: string | null; total_paid: number | null };

const num = (value: unknown) => (value == null ? null : Number(value));

export async function loadEventRecap(tournamentId: string, orgSlug: string): Promise<EventRecap> {
  const [tournamentRes, paymentsRes, teams, games, divisions] = await Promise.all([
    supabaseAdmin
      .from('tournaments')
      .select('slug, status, settings, public_hidden_pages, fee_schedule_mode, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date')
      .eq('id', tournamentId)
      .maybeSingle<RecapTournamentRow>(),
    supabaseAdmin
      .from('teams')
      .select('division_id, status, total_paid')
      .eq('tournament_id', tournamentId),
    getTeams(tournamentId, { admin: true }),
    getGames(tournamentId, { admin: true }),
    getDivisions(tournamentId, { admin: true }),
  ]);
  if (tournamentRes.error) throw tournamentRes.error;
  if (paymentsRes.error) throw paymentsRes.error;
  const t = tournamentRes.data;
  if (!t) throw new Error('Tournament not found');

  return computeEventRecap({
    tournament: {
      status: t.status,
      settings: t.settings,
      publicHiddenPages: t.public_hidden_pages,
      feeScheduleMode: t.fee_schedule_mode,
      fee: {
        depositAmount: num(t.deposit_amount),
        depositDueDate: t.deposit_due_date,
        totalFeeAmount: num(t.total_fee_amount),
        totalFeeDueDate: t.total_fee_due_date,
      },
    },
    divisions,
    teams,
    games,
    payments: ((paymentsRes.data ?? []) as RecapPaymentRow[]).map(p => ({
      divisionId: p.division_id,
      status: p.status,
      totalPaid: num(p.total_paid),
    })),
    publicBase: t.slug ? `/${orgSlug}/${t.slug}` : null,
  });
}
