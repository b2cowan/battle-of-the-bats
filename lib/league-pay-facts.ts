import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getOrganizationBySlugForServer } from './server-organizations';
import { getDivisionsForSeason, getLeagueSeasonById } from './db';
import { hasPlanFeature } from './plan-features';
import { onlinePaymentsOn } from './online-payments-switch';
import { factsFromRow, takesPayments, PAYOUTS_ACCOUNT_COLUMNS, type PayoutsAccountFacts, type PayoutsAccountRow } from './online-payment-account';
import { onlineFee, splitFeeAcross, toCents, type OnlineFee } from './online-payment-fee';
import { registrationOwes } from './league-price';
import { loadRegistrationMoneyLines } from './league-money-read';
import { receivedOf } from './league-money';
import { PAY_WORDS as W } from './online-payment-words';
import { LEAGUE_PAY_WORDS as LW } from './league-pay-words';
import type { LeagueSeason, Organization } from './types';

/**
 * Everything a house-league sign-up's pay block, the pay route and the payment emails need, read once (Club Tier Stage
 * 12b). `refusal` is the ONE answer to "may this family pay online now?" — the pay route re-reads it at the moment of
 * paying, never trusting the page. Pay when accepted (Stage 9 Q1): only an accepted, live child owes; a child in review
 * or on the waitlist has nothing to pay. One fee, part payments allowed up to what is owing; no deposit (A7 is a team's).
 */
export type LeaguePayRefusal =
  | 'switch_off' | 'not_taking_payments' | 'unrecorded_payment'
  | 'ended' | 'not_accepted' | 'already_paid' | 'nothing_owed' | null;

export interface LeaguePayChild {
  registrationId: string;
  firstName: string;
  lastName: string;
  divisionName: string;
  status: string;
  /** The child's price (recorded at sign-up), or null when the season has none. */
  fee: number | null;
  receivedCents: number;
  /** What this child owes right now: an accepted, live child's price less what was received. */
  owingCents: number;
}

export interface LeaguePayShare {
  registrationId: string;
  description: string;
  amountCents: number;
  feeShareCents: number;
}

export interface LeaguePayFacts {
  org: Organization;
  season: LeagueSeason;
  /** The registration the link names. */
  anchorId: string;
  /** The sign-up's key (`online_payments.signup_key`): its reference, or the one registration's id. */
  signupKey: string;
  guardianEmail: string | null;
  children: LeaguePayChild[];
  account: PayoutsAccountFacts | null;
  owingCents: number;
  /** The fee on the whole owed total (one payment), or null when nothing is owed. */
  fee: OnlineFee | null;
  /** Each owing child's part of that payment. */
  shares: LeaguePayShare[];
  refusal: LeaguePayRefusal;
}

type RegRow = {
  id: string; org_id: string; season_id: string; status: string; player_first_name: string; player_last_name: string;
  division_id: string | null; signup_ref: string | null; guardian_email: string | null; fee_amount: number | null;
};
const REG_COLUMNS = 'id, org_id, season_id, status, player_first_name, player_last_name, division_id, signup_ref, guardian_email, fee_amount';

/** The children of the sign-up a registration belongs to (the same reference and family), oldest first. */
async function signupRows(anchor: RegRow): Promise<RegRow[]> {
  if (!anchor.signup_ref) return [anchor];
  let q = supabaseAdmin.from('league_registrations').select(REG_COLUMNS)
    .eq('season_id', anchor.season_id).eq('org_id', anchor.org_id).eq('signup_ref', anchor.signup_ref);
  // A reference is 8 random characters: the family's email keeps two families' sign-ups apart on a collision.
  q = anchor.guardian_email ? q.eq('guardian_email', anchor.guardian_email) : q.is('guardian_email', null);
  const { data, error } = await q.order('registered_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as RegRow[];
}

/** A child's share that couldn't land and is not refunded in full: the books say owing while the money is taken. */
async function hasUnrecorded(regIds: string[]): Promise<boolean> {
  if (!regIds.length) return false;
  const { data: items } = await supabaseAdmin.from('online_payment_items').select('id, amount')
    .in('registration_id', regIds).is('entry_id', null).not('land_error', 'is', null);
  const stuck = (items ?? []) as Array<{ id: string; amount: number }>;
  if (!stuck.length) return false;
  const { data: refunds } = await supabaseAdmin.from('online_payment_refunds').select('online_payment_item_id, amount, fee_refunded')
    .eq('status', 'succeeded').in('online_payment_item_id', stuck.map(i => i.id));
  const back = new Map<string, number>();
  for (const f of (refunds ?? []) as Array<{ online_payment_item_id: string; amount: number; fee_refunded: number }>) {
    back.set(f.online_payment_item_id, (back.get(f.online_payment_item_id) ?? 0) + toCents(f.amount) - toCents(f.fee_refunded));
  }
  return stuck.some(i => (back.get(i.id) ?? 0) < toCents(i.amount));
}

/** Why the family cannot pay online right now, in words (copy §11): the pay route's JSON and the page say the same. */
export function leagueRefusalMessage(f: Pick<LeaguePayFacts, 'refusal' | 'children' | 'org'>, contactEmail: string | null): string | null {
  const first = f.children[0];
  const name = first ? `${first.firstName} ${first.lastName}` : '';
  switch (f.refusal) {
    case null: return null;
    case 'switch_off': return W.error.switchOff;
    case 'not_taking_payments': return W.error.clubNotTaking(f.org.name);
    case 'unrecorded_payment': return LW.error.unrecorded(f.org.name, contactEmail);
    case 'ended': return LW.error.ended(name);
    case 'not_accepted': return LW.error.notAccepted(f.children.find(c => c.status === 'pending_review' || c.status === 'waitlisted')?.firstName ?? name);
    case 'already_paid': return f.children.length === 1 ? LW.error.alreadyPaid(name) : LW.error.nothingOwed;
    case 'nothing_owed': return LW.error.nothingOwed;
  }
}

export async function loadLeaguePayFacts(registrationId: string): Promise<LeaguePayFacts | null> {
  const { data: anchorRow } = await supabaseAdmin.from('league_registrations').select(REG_COLUMNS).eq('id', registrationId).maybeSingle();
  const anchor = anchorRow as RegRow | null;
  if (!anchor) return null;
  const [{ data: orgRow }, season, rows, { data: acct }] = await Promise.all([
    supabaseAdmin.from('organizations').select('slug').eq('id', anchor.org_id).maybeSingle(),
    getLeagueSeasonById(anchor.season_id, anchor.org_id),
    signupRows(anchor),
    supabaseAdmin.from('org_payment_accounts').select(PAYOUTS_ACCOUNT_COLUMNS).eq('org_id', anchor.org_id).maybeSingle(),
  ]);
  const org = orgRow?.slug ? await getOrganizationBySlugForServer(orgRow.slug as string) : null;
  if (!org || !season) return null;
  const regIds = rows.map(r => r.id);
  const [divisions, lines, unrecorded] = await Promise.all([
    getDivisionsForSeason(season.id), loadRegistrationMoneyLines(regIds), hasUnrecorded(regIds),
  ]);
  const divisionName = new Map(divisions.map(d => [d.id, d.name]));

  const children: LeaguePayChild[] = rows.map(r => {
    const fee = registrationOwes({ feeAmount: r.fee_amount != null ? Number(r.fee_amount) : null }, season);
    const receivedCents = toCents(receivedOf(lines.get(r.id) ?? []));
    const owingCents = r.status === 'active' ? Math.max(0, toCents(fee ?? 0) - receivedCents) : 0;
    return {
      registrationId: r.id, firstName: r.player_first_name, lastName: r.player_last_name,
      divisionName: (r.division_id && divisionName.get(r.division_id)) || '—', status: r.status, fee, receivedCents, owingCents,
    };
  });
  const account = factsFromRow(acct as PayoutsAccountRow | null);
  const owing = children.filter(c => c.owingCents > 0);
  const owingCents = owing.reduce((s, c) => s + c.owingCents, 0);
  const fee = owingCents > 0 && account ? onlineFee(owingCents, account.feePayer) : null;
  const split = fee ? splitFeeAcross(fee.feeCents, owing.map(c => c.owingCents)) : [];
  const shares: LeaguePayShare[] = owing.map((c, i) => ({
    registrationId: c.registrationId,
    description: `${c.firstName} ${c.lastName} · ${c.divisionName}`,
    amountCents: c.owingCents,
    feeShareCents: split[i] ?? 0,
  }));

  const ended = (s: string) => s === 'declined' || s === 'withdrawn';
  let refusal: LeaguePayRefusal = null;
  if (!onlinePaymentsOn() || !hasPlanFeature(org.planId, 'online_payments')) refusal = 'switch_off';
  else if (!takesPayments(account)) refusal = 'not_taking_payments';
  else if (unrecorded) refusal = 'unrecorded_payment';
  else if (owingCents <= 0) {
    if (children.every(c => ended(c.status))) refusal = 'ended';
    else if (children.some(c => c.status === 'pending_review' || c.status === 'waitlisted') && !children.some(c => c.status === 'active' && c.receivedCents > 0)) refusal = 'not_accepted';
    else if (children.some(c => c.receivedCents > 0)) refusal = 'already_paid';
    else refusal = 'nothing_owed';
  }

  return {
    org, season, anchorId: anchor.id, signupKey: anchor.signup_ref ?? anchor.id, guardianEmail: anchor.guardian_email,
    children, account, owingCents, fee, shares, refusal,
  };
}
