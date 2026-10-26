import 'server-only';
import { getDivisionsForSeason } from './db';
import { supabaseAdmin } from './supabase-admin';
import { registrationReference } from './utils';
import { registrationOwes } from './league-price';
import { loadRegistrationMoneyLines } from './league-money-read';
import { lastPayment, lastRefund, receivedOf, refundedOf } from './league-money';
import type { LeagueSeason } from './types';

/**
 * WHAT A FAMILY'S STATUS PAGE SHOWS for one sign-up (Club Tier 9b-1 Part 5, 9b-2; shared since Stage 12b). Two doors
 * reach it with the same possession proof: the email and the reference (`status-lookup`), and the signed pay link
 * (`/league/{season}/status/{token}`). Both read the children of ONE sign-up — never every child under an email.
 */
export const SIGNUP_STATUS_COLUMNS =
  'id, status, player_first_name, player_last_name, division_id, waitlist_position, signup_ref, fee_amount, end_money, end_money_reason, withdraw_requested_at, ended_at';

export type SignupStatusRow = {
  id: string; status: string; player_first_name: string; player_last_name: string; division_id: string | null;
  waitlist_position: number | null; signup_ref: string | null; fee_amount: number | null; end_money: string | null;
  end_money_reason: string | null; withdraw_requested_at: string | null; ended_at: string | null;
  /** Read only by the pay link's page (the family's email for "Request sent"); never sent to the page as a column. */
  guardian_email?: string | null;
};

export interface SignupStatusRegistration {
  ref: string;
  /** The child's own code: what "Ask to withdraw" names. */
  child: string;
  status: string;
  playerFirstName: string;
  playerLastName: string;
  divisionName: string;
  waitlistPosition: number | null;
  fee: number | null;
  received: number;
  paid: boolean;
  owing: number;
  paidOn: string | null;
  refund: { amount: number; day: string; method: string | null } | null;
  kept: { amount: number; reason: string } | null;
  withdrawRequestedAt: string | null;
  endedAt: string | null;
}

export interface SignupStatus {
  registrations: SignupStatusRegistration[];
  howToPay: string | null;
  clubName: string;
  reviewFirst: boolean;
  finished: boolean;
}

/**
 * The sign-up a pay link names (Stage 12b): the anchor registration and every child signed up with it (the same
 * reference and family email), or the one registration when it has none — `null` when the link names a registration of
 * another club or season (a link opened under the wrong address is refused, never redirected).
 */
export async function signupRowsForLink(registrationId: string, at: { orgId: string; seasonId: string }): Promise<SignupStatusRow[] | null> {
  const { data: anchor } = await supabaseAdmin.from('league_registrations')
    .select(`${SIGNUP_STATUS_COLUMNS}, org_id, season_id, guardian_email`).eq('id', registrationId).maybeSingle();
  if (!anchor || anchor.org_id !== at.orgId || anchor.season_id !== at.seasonId) return null;
  if (!anchor.signup_ref) return [anchor as unknown as SignupStatusRow];
  let q = supabaseAdmin.from('league_registrations').select(`${SIGNUP_STATUS_COLUMNS}, guardian_email`)
    .eq('season_id', at.seasonId).eq('org_id', at.orgId).eq('signup_ref', anchor.signup_ref as string);
  q = anchor.guardian_email ? q.eq('guardian_email', anchor.guardian_email as string) : q.is('guardian_email', null);
  const { data, error } = await q.order('registered_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as SignupStatusRow[];
}

export async function buildSignupStatus(season: LeagueSeason, clubName: string, rows: SignupStatusRow[]): Promise<SignupStatus> {
  const [divisions, lines] = await Promise.all([
    getDivisionsForSeason(season.id),
    loadRegistrationMoneyLines(rows.map(r => String(r.id))),
  ]);
  const divisionMap = Object.fromEntries(divisions.map(d => [d.id, d.name]));
  const registrations = rows.map(r => {
    const fee = registrationOwes({ feeAmount: r.fee_amount != null ? Number(r.fee_amount) : null }, season);
    const mine = lines.get(String(r.id)) ?? [];
    const received = receivedOf(mine);
    const last = lastPayment(mine);
    const refund = lastRefund(mine);
    const ended = r.status === 'declined' || r.status === 'withdrawn';
    return {
      ref: r.signup_ref ?? registrationReference(String(r.id)),
      child: registrationReference(String(r.id)),
      status: r.status,
      playerFirstName: r.player_first_name,
      playerLastName: r.player_last_name,
      divisionName: (r.division_id && divisionMap[r.division_id]) || '—',
      waitlistPosition: r.waitlist_position ?? null,
      fee,
      received,
      paid: (fee ?? 0) > 0 && received >= (fee ?? 0),
      owing: !ended && r.status === 'active' ? Math.max(0, Math.round(((fee ?? 0) - received) * 100) / 100) : 0,
      paidOn: last?.day ?? null,
      refund: refund ? { amount: refundedOf(mine), day: refund.day, method: refund.method } : null,
      kept: ended && r.end_money === 'kept' && received > 0 ? { amount: received, reason: r.end_money_reason ?? '' } : null,
      withdrawRequestedAt: r.withdraw_requested_at ?? null,
      endedAt: r.ended_at ?? null,
    };
  });
  // The club's how-to-pay words reach the family only once a child is accepted and owes something (9b·9).
  const owes = registrations.some(r => r.status === 'active' && r.owing > 0);
  return {
    registrations,
    howToPay: owes ? season.howToPay : null,
    clubName,
    reviewFirst: !season.autoApproveUnderCapacity,
    // A finished season takes no "Ask to withdraw" (9b-2).
    finished: season.status === 'completed' || season.status === 'archived',
  };
}
