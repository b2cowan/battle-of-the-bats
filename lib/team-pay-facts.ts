import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getOrganizationBySlugForServer } from './server-organizations';
import { hasPlanFeature } from './plan-features';
import { onlinePaymentsOn } from './online-payments-switch';
import { factsFromRow, takesBankDebit, takesPayments, PAYOUTS_ACCOUNT_COLUMNS, type PayoutsAccountFacts, type PayoutsAccountRow } from './online-payment-account';
import { registrationFee, type DueDivision, type DueTeam, type DueTournament, type FeeDetails } from './registration-amount-due';
import { payOptions, type PayOptions } from './team-pay-options';
import { isOurTournamentTeam } from './club-own-tournament-team';
import { tournamentTracksPayments } from './tournament-payments-tracked';
import type { PayRefusal } from './team-pay-refusal';
import type { Organization } from './types';

/**
 * Everything a tournament team's pay page, the pay route and the payment emails need, read once (Club Tier Stage 12a).
 * `payable` is the ONE answer to "may this team pay online now?" — the route re-reads it at the moment of paying.
 */
export interface TeamPayFacts {
  teamId: string;
  teamName: string;
  teamEmail: string | null;
  teamStatus: string;
  divisionName: string | null;
  tournament: { id: string; name: string; slug: string; status: string | null; settings: unknown };
  org: Organization;
  account: PayoutsAccountFacts | null;
  fee: FeeDetails;
  totalPaid: number;
  depositPaid: number;
  options: PayOptions | null;
  /** Why the team cannot pay online right now, or null when it can. */
  refusal: PayRefusal;
  /** 12c: the club's account takes bank debit (the pay block shows the second button). */
  bankDebit: boolean;
  /** 12c: the team's latest bank debit, when it is on its way (clearing) or came back before it cleared (returned). */
  debit: TeamDebit | null;
}

export interface TeamDebit {
  state: 'clearing' | 'returned';
  totalCents: number;
  /** What the debit pays toward the entry (its total less any processing fee the team pays). */
  baseCents: number;
  last4: string | null;
  startedAt: string | null;
  returnedAt: string | null;
  reason: string | null;
  scope: 'deposit' | 'balance' | 'full';
}

export async function loadTeamPayFacts(teamId: string): Promise<TeamPayFacts | null> {
  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('id, name, email, coach_email, status, division_id, tournament_id, total_paid, deposit_paid, entry_lowered')
    .eq('id', teamId)
    .maybeSingle();
  if (!team) return null;
  const { data: t } = await supabaseAdmin
    .from('tournaments')
    .select('id, name, slug, status, org_id, settings, fee_schedule_mode, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date')
    .eq('id', team.tournament_id as string)
    .maybeSingle();
  if (!t) return null;
  const [{ data: orgRow }, { data: div }, { data: acct }, { count: unrecorded }, { data: lastDebit }] = await Promise.all([
    supabaseAdmin.from('organizations').select('slug').eq('id', t.org_id as string).maybeSingle(),
    supabaseAdmin.from('divisions').select('id, name, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date').eq('id', team.division_id as string).maybeSingle(),
    supabaseAdmin.from('org_payment_accounts').select(PAYOUTS_ACCOUNT_COLUMNS).eq('org_id', t.org_id as string).maybeSingle(),
    // A payment Stripe took that couldn't land (review 2026-10-25, M2): the record says owing, the money is taken.
    supabaseAdmin.from('online_payments').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('status', 'paid').is('landed_at', null),
    // 12c: the latest online payment, so a debit on its way (or just returned) is said on the page.
    supabaseAdmin.from('online_payments').select('status, rail, total_amount, base_amount, bank_last4, clearing_at, returned_at, return_reason, scope')
      .eq('team_id', teamId).neq('status', 'expired').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const org = orgRow?.slug ? await getOrganizationBySlugForServer(orgRow.slug as string) : null;
  if (!org) return null;

  const divisions = new Map<string, DueDivision>(div ? [[div.id as string, div as unknown as DueDivision]] : []);
  // The row itself is the DueTeam (division and the two cached figures) — read, never written.
  const fee = registrationFee(team as unknown as DueTeam, t as unknown as DueTournament, divisions);
  const account = factsFromRow(acct as PayoutsAccountRow | null);
  const totalPaid = Number(team.total_paid ?? 0);
  const depositPaid = Number(team.deposit_paid ?? 0);
  const bankDebit = takesBankDebit(account);
  const options = account ? payOptions({ totalPaid, depositPaid }, fee, account.feePayer, bankDebit) : null;
  const debit: TeamDebit | null = lastDebit && lastDebit.rail === 'bank_debit' && (lastDebit.status === 'clearing' || lastDebit.status === 'returned') ? {
    state: lastDebit.status as 'clearing' | 'returned',
    totalCents: Math.round(Number(lastDebit.total_amount) * 100), baseCents: Math.round(Number(lastDebit.base_amount) * 100), last4: (lastDebit.bank_last4 as string | null) ?? null,
    startedAt: (lastDebit.clearing_at as string | null) ?? null, returnedAt: (lastDebit.returned_at as string | null) ?? null,
    reason: (lastDebit.return_reason as string | null) ?? null, scope: lastDebit.scope as TeamDebit['scope'],
  } : null;

  let refusal: TeamPayFacts['refusal'] = null;
  if (!onlinePaymentsOn() || !hasPlanFeature(org.planId, 'online_payments')) refusal = 'switch_off';
  else if (!takesPayments(account)) refusal = 'not_taking_payments';
  else if (!tournamentTracksPayments(t.settings)) refusal = 'not_tracked';
  else if (team.status !== 'accepted') refusal = 'not_accepted';
  else if (t.status === 'completed' || t.status === 'archived') refusal = 'tournament_over';
  else if ((unrecorded ?? 0) > 0) refusal = 'unrecorded_payment';
  else if (debit?.state === 'clearing') refusal = 'clearing';
  else if (await isOurTournamentTeam(org.id, teamId)) refusal = 'our_team';
  else if (!options) refusal = 'nothing_owed';

  return {
    teamId,
    teamName: team.name as string,
    teamEmail: (team.coach_email as string | null) || (team.email as string | null) || null,
    teamStatus: team.status as string,
    divisionName: (div?.name as string | undefined) ?? null,
    tournament: { id: t.id as string, name: t.name as string, slug: t.slug as string, status: (t.status as string | null) ?? null, settings: t.settings },
    org,
    account,
    fee,
    totalPaid,
    depositPaid,
    options,
    refusal,
    bankDebit,
    debit,
  };
}
