import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { disputeAnswerer } from './online-payment-landing';
import { invoiceWhere } from './platform-stripe-fees';
import { clubPublicContact } from './club-email-context';
import { childList } from './league-pay-words';
import { currentDispute, isDisputeOpen, type DisputeRecord, type DisputeView } from './online-payment-dispute';
import { DEBIT_NOTICE_WORDS as DW, DISPUTE_WORDS as D, SCOPE_WORDS, disputeFactsText, money } from './online-payment-words';
import { formatStoredDate } from './timezone';
import { possessive } from './utils';

/**
 * A PAYMENT'S DISPUTE, AS ONE READER'S RECORD SHOWS IT (Club Tier Stage 12d-1 Part 3; words §1.1–§1.3). One read for both
 * flows: the team's record (Payments) and the house-league record (Fee) and Registrations' Fee cell. Keyed by online
 * payment; only payments with a dispute appear. `viewer.canCopy` is the route's own answer (whoever refunds in that flow,
 * or the owner); amber and "Answer in Stripe" follow from being the answerer.
 */

type Row = {
  id: string; online_payment_id: string; stripe_dispute_id: string; status: string; reason: string | null; amount: number;
  held: number; due_by: string | null; answered: boolean; answered_at: string | null; opened_at: string; closed_at: string | null;
  stripe_fee: number | null; fee_paid_from: 'club' | 'platform' | null; lost_booked_at: string | null; won_back_at: string | null;
  opened_emailed_at: string | null;
  taken_back: { amount?: number; children?: Array<{ registrationId: string; amount: number }> } | null;
  won_back: { refused?: Array<{ registrationId: string }> } | null;
};
type Pay = {
  id: string; flow: 'tournament_team' | 'league_signup'; team_id: string | null; tournament_id: string | null; season_id: string | null;
  receipt_no: number | null; total_amount: number; paid_on: string | null; card_last4: string | null; payer_email: string | null;
  receipt_emailed_at: string | null; livemode: boolean; scope: 'deposit' | 'balance' | 'full' | null; status: string;
};
type Reg = { id: string; player_first_name: string; player_last_name: string; guardian_first_name: string | null; guardian_last_name: string | null; registered_at: string | null; division_id: string | null; season_id: string };

const day = (v: string | null | undefined, withYear = false) => (v ? formatStoredDate(v, { withYear }) : null);
const name = (first: string | null | undefined, last: string | null | undefined) => [first, last].filter(Boolean).join(' ').trim();

export async function readDisputes(p: {
  orgId: string; onlinePaymentIds: readonly string[]; viewer: { userId: string; canCopy: boolean };
}): Promise<Map<string, DisputeRecord>> {
  const out = new Map<string, DisputeRecord>();
  const ids = [...new Set(p.onlinePaymentIds)];
  if (!ids.length) return out;
  const { data: rowData, error } = await supabaseAdmin.from('online_payment_disputes')
    .select('id, online_payment_id, stripe_dispute_id, status, reason, amount, held, due_by, answered, answered_at, opened_at, closed_at, stripe_fee, fee_paid_from, lost_booked_at, won_back_at, opened_emailed_at, taken_back, won_back')
    .eq('org_id', p.orgId).in('online_payment_id', ids);
  if (error) throw error;
  const rows = (rowData ?? []) as Row[];
  if (!rows.length) return out;
  const payIds = [...new Set(rows.map(r => r.online_payment_id))];

  const [{ data: payData }, { data: refunds }, { data: items }, { data: acct }, { data: org }, answerer, contact] = await Promise.all([
    supabaseAdmin.from('online_payments')
      .select('id, flow, team_id, tournament_id, season_id, receipt_no, total_amount, paid_on, card_last4, payer_email, receipt_emailed_at, livemode, scope, status')
      .in('id', payIds),
    supabaseAdmin.from('online_payment_refunds').select('online_payment_id, succeeded_at').in('online_payment_id', payIds).eq('status', 'succeeded')
      .order('succeeded_at', { ascending: false }),
    supabaseAdmin.from('online_payment_items').select('online_payment_id, registration_id').in('online_payment_id', payIds).order('created_at'),
    supabaseAdmin.from('org_payment_accounts').select('refund_policy').eq('org_id', p.orgId).maybeSingle(),
    supabaseAdmin.from('organizations').select('name').eq('id', p.orgId).maybeSingle(),
    disputeAnswerer(p.orgId),
    clubPublicContact(p.orgId),
  ]);
  const pays = new Map(((payData ?? []) as Pay[]).map(o => [o.id, o]));
  const refundedOn = new Map<string, string>();
  for (const r of (refunds ?? []) as Array<{ online_payment_id: string; succeeded_at: string | null }>) {
    if (r.succeeded_at && !refundedOn.has(r.online_payment_id)) refundedOn.set(r.online_payment_id, r.succeeded_at);
  }
  const regIdsOf = new Map<string, string[]>();
  for (const i of (items ?? []) as Array<{ online_payment_id: string; registration_id: string | null }>) {
    if (i.registration_id) regIdsOf.set(i.online_payment_id, [...(regIdsOf.get(i.online_payment_id) ?? []), i.registration_id]);
  }
  const regIds = [...new Set([...regIdsOf.values()].flat())];
  const teamIds = [...new Set([...pays.values()].map(o => o.team_id).filter((x): x is string => !!x))];
  const [{ data: regData }, { data: teamData }] = await Promise.all([
    regIds.length
      ? supabaseAdmin.from('league_registrations')
        .select('id, player_first_name, player_last_name, guardian_first_name, guardian_last_name, registered_at, division_id, season_id').in('id', regIds)
      : Promise.resolve({ data: [] }),
    teamIds.length ? supabaseAdmin.from('teams').select('id, name, coach, registered_at, tournaments(name)').in('id', teamIds) : Promise.resolve({ data: [] }),
  ]);
  const regs = new Map(((regData ?? []) as Reg[]).map(r => [r.id, r]));
  const divIds = [...new Set([...regs.values()].map(r => r.division_id).filter((x): x is string => !!x))];
  const seasonIds = [...new Set([...regs.values()].map(r => r.season_id))];
  const [{ data: divData }, { data: seasonData }] = await Promise.all([
    divIds.length ? supabaseAdmin.from('league_divisions').select('id, name').in('id', divIds) : Promise.resolve({ data: [] }),
    seasonIds.length ? supabaseAdmin.from('league_seasons').select('id, name').in('id', seasonIds) : Promise.resolve({ data: [] }),
  ]);
  const divName = new Map(((divData ?? []) as Array<{ id: string; name: string }>).map(d => [d.id, d.name]));
  const seasonName = new Map(((seasonData ?? []) as Array<{ id: string; name: string }>).map(s => [s.id, s.name]));
  const teams = new Map(((teamData ?? []) as Array<{ id: string; name: string; coach: string | null; registered_at: string | null; tournaments: { name: string } | { name: string }[] | null }>)
    .map(t => [t.id, t]));
  const club = (org?.name as string | undefined) ?? '';
  const policy = ((acct?.refund_policy as string | null) ?? '').trim() || null;
  const firstNames = (ids: readonly string[]) => ids.map(id => regs.get(id)?.player_first_name ?? '').filter(Boolean);
  let feeWhere: 'next' | 'own' | undefined;

  for (const op of pays.values()) {
    const views: Array<DisputeView & { row: Row }> = rows.filter(r => r.online_payment_id === op.id).map(r => ({
      row: r, id: r.id, status: r.status, reason: r.reason, amount: Number(r.amount), held: Number(r.held), dueBy: r.due_by,
      answered: r.answered, answeredAt: r.answered_at, openedAt: r.opened_at, closedAt: r.closed_at,
      stripeFee: r.stripe_fee == null ? null : Number(r.stripe_fee), feePaidFrom: r.fee_paid_from,
      stripeDisputeId: r.stripe_dispute_id, lostBookedAt: r.lost_booked_at, wonBackAt: r.won_back_at, openedEmailedAt: r.opened_emailed_at,
    }));
    const cur = currentDispute(views);
    if (!cur) continue;
    const { row, ...view } = cur;
    const amount = money(Number(op.total_amount));
    const receiptNo = String(op.receipt_no ?? '');
    let forLine: string; let payerName: string | null; let registeredDay: string | null; let registeredBy: string | null;
    let signupFact: string | null; let children: string[] = []; let owesAgain = '';
    const taken = row.taken_back ?? {};
    if (op.flow === 'tournament_team') {
      const t = op.team_id ? teams.get(op.team_id) : undefined;
      const tName = t?.name ?? '';
      const tour = Array.isArray(t?.tournaments) ? t?.tournaments[0]?.name : t?.tournaments?.name;
      forLine = `${possessive(tName)} ${SCOPE_WORDS.scope[op.scope ?? 'full']}${tour ? ` for ${tour}` : ''}`;
      payerName = t?.coach?.trim() || null;
      registeredDay = day(t?.registered_at, true);
      registeredBy = payerName;
      signupFact = t?.registered_at && payerName ? D.factTeamSignup(day(t.registered_at)!, payerName) : null;
      if (row.lost_booked_at) owesAgain = DW.owesAgain(tName, money(Number(taken.amount ?? view.amount)), false);
    } else {
      const kids = (regIdsOf.get(op.id) ?? []).map(id => regs.get(id)).filter((r): r is Reg => !!r);
      const first = kids[0];
      const guardian = first ? name(first.guardian_first_name, first.guardian_last_name) : '';
      payerName = guardian || null;
      children = kids.length > 1 ? kids.map(k => k.player_first_name) : [];
      const childNames = kids.map(k => name(k.player_first_name, k.player_last_name)).join(', ');
      forLine = [childNames, first?.division_id ? divName.get(first.division_id) : null, first ? seasonName.get(first.season_id) : null]
        .filter(Boolean).join(', ') + (club ? ` with ${club}` : '');
      registeredDay = day(first?.registered_at, true);
      registeredBy = payerName;
      signupFact = first?.registered_at && payerName ? D.factSignup(day(first.registered_at)!, payerName) : null;
      if (row.lost_booked_at) {
        const lostKids = (taken.children ?? []).map(c => c.registrationId);
        const names = firstNames(lostKids);
        owesAgain = DW.owesAgain(childList(names), money((taken.children ?? []).reduce((s, c) => s + Number(c.amount), 0)), names.length > 1);
      }
    }
    const facts = [
      signupFact,
      policy ? D.factPolicy : null,
      op.receipt_emailed_at && op.payer_email ? D.factReceipt(receiptNo, op.payer_email, day(op.receipt_emailed_at)!) : null,
    ].filter((x): x is string => !!x);
    const youAnswer = answerer.ids.includes(p.viewer.userId);
    const canCopy = p.viewer.canCopy || youAnswer;
    // Stripe's answer, read once per screen and only when a fee line needs it (an extra read never takes a screen down).
    if (youAnswer && view.feePaidFrom === 'platform' && feeWhere === undefined) feeWhere = await invoiceWhere(p.orgId).catch(() => 'own' as const);
    out.set(op.id, {
      ...view,
      // What this reader may not use is never sent (/review 2026-10-27): the clipboard text carries the payer's details,
      // and the fee line is the owner's.
      stripeFee: youAnswer ? view.stripeFee : null,
      feePaidFrom: youAnswer ? view.feePaidFrom : null,
      receiptNo: op.receipt_no,
      answererName: answerer.name ?? 'The owner',
      youAnswer,
      canCopy,
      showFee: youAnswer,
      feeWhere: youAnswer && view.feePaidFrom === 'platform' ? feeWhere ?? 'own' : null,
      factsList: canCopy ? childList(facts) : '',
      factsText: !canCopy ? '' : disputeFactsText({
        test: !op.livemode, receiptNo, amount, paidDay: day(op.paid_on, true) ?? '', cardLast4: op.card_last4,
        payerName, payerEmail: op.payer_email, forLine, registeredDay, registeredBy, refundPolicy: policy,
        receiptEmailedDay: day(op.receipt_emailed_at, true), club, contactEmail: contact,
      }),
      refundedOn: op.status === 'refunded' ? refundedOn.get(op.id) ?? null : null,
      children,
      paidAgain: firstNames((row.won_back?.refused ?? []).map(r => r.registrationId)),
      owesAgain,
      book: op.flow === 'tournament_team' ? 'tournament' : 'season',
    });
  }
  return out;
}

/** House league: each registration's dispute (the newest card payment with one wins when a child paid by card twice). */
export async function readRegistrationDisputes(p: {
  orgId: string; registrationIds: readonly string[]; viewer: { userId: string; canCopy: boolean };
}): Promise<Record<string, DisputeRecord>> {
  if (!p.registrationIds.length) return {};
  // Start from the club's disputes, which are few, never from a season's registrations (/review 2026-10-27: a long id
  // list rides in the URL and fails on its length, and a select stops at 1,000 rows without an error).
  const { data: disputed, error: dErr } = await supabaseAdmin.from('online_payment_disputes').select('online_payment_id').eq('org_id', p.orgId);
  if (dErr) throw dErr;
  const payIds = [...new Set(((disputed ?? []) as Array<{ online_payment_id: string }>).map(d => d.online_payment_id))];
  if (!payIds.length) return {};
  const shown = new Set(p.registrationIds);
  const { data, error } = await supabaseAdmin.from('online_payment_items')
    .select('online_payment_id, registration_id, created_at').in('online_payment_id', payIds).order('created_at', { ascending: false });
  if (error) throw error;
  const items = ((data ?? []) as Array<{ online_payment_id: string; registration_id: string | null }>)
    .filter((i): i is { online_payment_id: string; registration_id: string } => !!i.registration_id && shown.has(i.registration_id));
  const byPay = await readDisputes({ orgId: p.orgId, onlinePaymentIds: items.map(i => i.online_payment_id), viewer: p.viewer });
  const out: Record<string, DisputeRecord> = {};
  for (const i of items) {
    const d = byPay.get(i.online_payment_id);
    if (!d) continue;
    const had = out[i.registration_id];
    // The open one first, else the newest (items arrive newest first).
    if (!had || (!isDisputeOpen(had.status) && isDisputeOpen(d.status))) out[i.registration_id] = d;
  }
  return out;
}
