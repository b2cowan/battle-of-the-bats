import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { escapeHtml, sendEmail } from './email';
import { systemMailFace } from './club-email-context';
import { warmEmailButton, warmEmailDocument, warmEmailHeading, warmEmailParagraph, warmEmailSmall } from './email-envelope-warm';
import { formatStoredDate } from './timezone';
import { loadTeamPayFacts } from './team-pay-facts';
import { refusalMessage } from './team-pay-view';
import { teamPayUrl } from './team-pay-link';
import { tournamentTracksPayments } from './tournament-payments-tracked';
import { BANK_DEBIT_EMAIL_WORDS as D, DISPUTE_WORDS, ONLINE_EMAIL_WORDS as E, REFUND_BLOCK_WORDS, SCOPE_LINE, SCOPE_WORDS, cardLabel, money, receiptLabel } from './online-payment-words';
import { refundBlockHtml, type RefundBlockInput } from './online-refund-block';
import { registrationReference } from './utils';
import { stampRefundEmailed } from './online-refund-email';
import { loadLeaguePayFacts } from './league-pay-facts';
import { transactionalFamilyFooterHtml } from './family-mail-footer';
import { leaguePayUrl } from './league-pay-link';
import { LEAGUE_PAY_WORDS as LW, childList } from './league-pay-words';
import { REGS_WORDS } from './house-league-money-words';

/**
 * The payer's emails (Club Tier Stage 12a, copy §14 and §17): one receipt per payment and one email per refund, from our
 * email stack in the CLUB's name with the club's contact as reply-to. Stripe's own receipt is never asked for (no
 * `receipt_email`, `lib/stripe-connect.ts`). A test-mode payment says so in the subject and the body.
 */

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? '';

type OnlineForEmail = {
  id: string; org_id: string; flow: 'tournament_team' | 'league_signup'; team_id: string | null; scope: 'deposit' | 'balance' | 'full'; payer_email: string | null;
  base_amount: number; fee_amount: number; total_amount: number; fee_payer: 'family' | 'club'; livemode: boolean;
  card_brand: string | null; card_last4: string | null; receipt_no: number | null; paid_on: string | null;
  rail: 'card' | 'bank_debit'; bank_last4: string | null; clearing_at: string | null;
};
const ONLINE_EMAIL_COLUMNS =
  'id, org_id, flow, team_id, scope, payer_email, base_amount, fee_amount, total_amount, fee_payer, livemode, card_brand, card_last4, receipt_no, paid_on, rail, bank_last4, clearing_at';

/**
 * The receipt's total line: the card, or (12c) the bank debit's account and the day it cleared, then the two dates.
 */
function totalLines(op: OnlineForEmail): string[] {
  const total = money(Number(op.total_amount));
  const paidOn = formatStoredDate(op.paid_on);
  if (op.rail !== 'bank_debit') return [warmEmailParagraph(escapeHtml(E.receiptTotal(total, cardLabel(op.card_brand, op.card_last4), paidOn)))];
  return [
    warmEmailParagraph(escapeHtml(D.receiptTotalBank(total, op.bank_last4, paidOn))),
    op.clearing_at ? warmEmailParagraph(escapeHtml(D.receiptBankDates(formatStoredDate(op.clearing_at), paidOn))) : '',
  ];
}

/** Claims the receipt (so two webhook deliveries send one), then sends it; a failed send releases the claim for a retry. */
export async function sendOnlineReceiptOnce(onlinePaymentId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from('online_payments')
    .update({ receipt_emailed_at: new Date().toISOString() })
    .eq('id', onlinePaymentId)
    .is('receipt_emailed_at', null)
    .in('status', ['paid', 'partly_refunded', 'refunded'])
    .select(ONLINE_EMAIL_COLUMNS)
    .maybeSingle();
  const op = data as OnlineForEmail | null;
  if (!op?.payer_email) return;
  try {
    // A house-league payment (12b) has its own receipt: one line per child, in the season's words.
    if (op.flow === 'league_signup') await sendLeagueReceipt(op);
    else if (op.team_id) await sendReceipt(op);
  } catch (err) {
    await supabaseAdmin.from('online_payments').update({ receipt_emailed_at: null }).eq('id', op.id);
    console.error('[online-payment-receipt] the receipt was not sent:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * A house-league family's receipt (Stage 12b, copy §10; drawn k3): one line per child the payment covered
 * ("{child} · {season} · {division} · {amount}"), the fee only when the family paid it, the total, a waitlisted
 * sibling's "we'll email you a link to pay", and the status page (their pay link) as "View your receipt".
 */
async function sendLeagueReceipt(op: OnlineForEmail): Promise<void> {
  const { data: items } = await supabaseAdmin.from('online_payment_items')
    .select('registration_id, description, amount').eq('online_payment_id', op.id).order('created_at');
  const rows = (items ?? []) as Array<{ registration_id: string | null; description: string; amount: number }>;
  const anchor = rows.find(r => r.registration_id)?.registration_id;
  const facts = anchor ? await loadLeaguePayFacts(anchor) : null;
  if (!facts) return;
  const face = await systemMailFace({
    id: facts.org.id, name: facts.org.name, logoUrl: facts.org.logoUrl ?? null,
    themePreset: facts.org.themePreset ?? null, themePrimary: facts.org.themePrimary ?? null, themeAccent: facts.org.themeAccent ?? null,
  });
  const receiptNo = receiptLabel(op.receipt_no ?? '');
  const test = !op.livemode;
  const link = leaguePayUrl(appUrl(), { orgSlug: facts.org.slug, seasonSlug: facts.season.slug, registrationId: anchor! });
  const lines = [
    warmEmailHeading(escapeHtml(E.receiptNumber(receiptNo))),
    warmEmailParagraph(escapeHtml(E.receiptThanks(facts.org.name, null))),
    ...rows.map(r => {
      const [child, division] = r.description.split(' · ');
      return warmEmailParagraph(escapeHtml(LW.receiptEmailLine(child ?? r.description, facts.season.name, division ?? '', money(Number(r.amount)))));
    }),
    op.fee_payer === 'family' && Number(op.fee_amount) > 0 ? warmEmailParagraph(escapeHtml(E.receiptFee(money(Number(op.fee_amount))))) : '',
    ...totalLines(op),
    ...facts.children.filter(c => c.status === 'waitlisted').map(c => warmEmailParagraph(escapeHtml(LW.receiptWaitlisted(`${c.firstName} ${c.lastName}`)))),
    link ? warmEmailButton(E.viewReceipt, link) : '',
    warmEmailSmall(escapeHtml(E.questions(facts.org.name, face?.contact ?? null))),
    test ? warmEmailSmall(escapeHtml(E.testNote)) : '',
  ];
  const subject = `${test ? E.testPrefix : ''}${E.receiptSubject(receiptNo, facts.org.name)}`;
  const result = await sendEmail(op.payer_email!, subject, warmEmailDocument(lines.filter(Boolean).join('\n'), face?.club ?? null), { ...face?.sendOpts, kind: 'league_payment_receipt' });
  if (result.status === 'provider_error') throw new Error('send failed');
}

async function sendReceipt(op: OnlineForEmail): Promise<void> {
  const facts = await loadTeamPayFacts(op.team_id!);
  if (!facts) return;
  const face = await systemMailFace({
    id: facts.org.id, name: facts.org.name, logoUrl: facts.org.logoUrl ?? null,
    themePreset: facts.org.themePreset ?? null, themePrimary: facts.org.themePrimary ?? null, themeAccent: facts.org.themeAccent ?? null,
  });
  const receiptNo = receiptLabel(op.receipt_no ?? '');
  const payLink = teamPayUrl(appUrl(), { orgSlug: facts.org.slug, tournamentSlug: facts.tournament.slug, teamId: facts.teamId });
  const test = !op.livemode;
  const lines = [
    warmEmailHeading(escapeHtml(E.receiptNumber(receiptNo))),
    warmEmailParagraph(escapeHtml(E.receiptThanks(facts.org.name, null))),
    warmEmailParagraph(escapeHtml(E.receiptLine([facts.teamName, facts.tournament.name, facts.divisionName ?? '', SCOPE_LINE[op.scope]], money(Number(op.base_amount))))),
    op.fee_payer === 'family' && Number(op.fee_amount) > 0 ? warmEmailParagraph(escapeHtml(E.receiptFee(money(Number(op.fee_amount))))) : '',
    ...totalLines(op),
  ];
  // A payment can land after the organizer switched the event to "Not tracked here": the receipt then names no balance.
  const balance = tournamentTracksPayments(facts.tournament.settings) ? facts.options?.choices.find(c => c.scope === 'balance') : undefined;
  if (balance) {
    lines.push(warmEmailParagraph(escapeHtml(E.receiptBalance(money(balance.fee.baseCents / 100), balance.dueDate ? formatStoredDate(balance.dueDate) : null))));
    if (payLink && !facts.refusal) lines.push(warmEmailButton(E.payBalance, payLink));
  } else if (payLink) {
    lines.push(warmEmailButton(E.viewReceipt, payLink));
  }
  lines.push(warmEmailSmall(escapeHtml(E.questions(facts.org.name, face?.contact ?? null))));
  if (test) lines.push(warmEmailSmall(escapeHtml(E.testNote)));
  const subject = `${test ? E.testPrefix : ''}${E.receiptSubject(receiptNo, facts.org.name)}`;
  const result = await sendEmail(op.payer_email!, subject, warmEmailDocument(lines.filter(Boolean).join('\n'), face?.club ?? null), { ...face?.sendOpts, kind: 'team_payment_receipt', orgId: facts.org.id });
  if (result.status === 'provider_error') throw new Error('send failed');
}

/**
 * The team's refund email — called once, when the refund is first recorded (the database functions answer `already` after).
 * 12c: the one refund block (lib/online-refund-block.ts), dated by the REFUND, never by the send (the F3 class), and the
 * record's "Family emailed" stamped. `extra` carries the part-refund lines a team's part refund adds (Part 4).
 */
export async function sendRefundEmail(refundId: string, extra?: { lead?: string; lines?: string[] }): Promise<void> {
  try {
    const { data: r } = await supabaseAdmin.from('online_payment_refunds')
      .select('online_payment_id, amount, fee_refunded, note, created_at, stripe_created_at, stripe_refund_id, part_refund, partial_reason').eq('id', refundId).maybeSingle();
    if (!r) return;
    const { data } = await supabaseAdmin.from('online_payments').select(ONLINE_EMAIL_COLUMNS).eq('id', r.online_payment_id as string).maybeSingle();
    const op = data as OnlineForEmail | null;
    if (!op?.payer_email || !op.team_id) return;
    const facts = await loadTeamPayFacts(op.team_id);
    if (!facts) return;
    const face = await systemMailFace({
      id: facts.org.id, name: facts.org.name, logoUrl: facts.org.logoUrl ?? null,
      themePreset: facts.org.themePreset ?? null, themePrimary: facts.org.themePrimary ?? null, themeAccent: facts.org.themeAccent ?? null,
    });
    const test = !op.livemode;
    const block: RefundBlockInput = {
      refundCents: Math.round(Number(r.amount) * 100), bank: op.rail === 'bank_debit', cardBrand: op.card_brand, cardLast4: op.card_last4,
      bankLast4: op.bank_last4, refundedAt: ((r.stripe_created_at as string | null) ?? r.created_at) as string, reference: (r.stripe_refund_id as string | null) ?? null,
      receiptNo: op.receipt_no, paidOn: op.paid_on, feeBackCents: Math.round(Number(r.fee_refunded) * 100),
      feeKeptCents: op.fee_payer === 'family' && Number(r.fee_refunded) === 0 ? Math.round(Number(op.fee_amount) * 100) : 0,
    };
    // 12c words §1.5: a team's PART refund names what changed (its reason, the entry now) and what is left to pay. The
    // team's figures are read after the booking, so the entry is already lowered (lowerEntry) and the balance unmoved.
    const part = !!r.part_refund;
    const partLines: string[] = [];
    if (part) {
      if (r.partial_reason) partLines.push(E.refundReason(facts.org.name, r.partial_reason as string));
    }
    const after: string[] = [];
    if (part && facts.fee.totalFeeAmount != null) {
      after.push(E.refundEntryNow(money(Number(facts.fee.totalFeeAmount))));
      const balance = Math.round((Number(facts.fee.totalFeeAmount) - facts.totalPaid) * 100) / 100;
      after.push(balance > 0
        ? E.refundBalanceNow(money(balance), facts.fee.totalFeeDueDate ? formatStoredDate(facts.fee.totalFeeDueDate) : null)
        : E.refundPaidInFull(facts.teamName));
    }
    const lead = extra?.lead ?? (part
      ? E.refundLeadPart(money(Number(r.amount)), facts.teamName, SCOPE_WORDS.scope[op.scope], facts.tournament.name)
      : E.refundLead(facts.teamName, facts.tournament.name));
    const lines = [
      `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(REFUND_BLOCK_WORDS.preheader(money(Number(r.amount)), block.bank))}</div>`,
      warmEmailHeading(escapeHtml(lead)),
      ...[...partLines, ...(extra?.lines ?? [])].map(l => warmEmailParagraph(escapeHtml(l))),
      refundBlockHtml(block),
      ...after.map(l => warmEmailParagraph(escapeHtml(l))),
    ];
    if (r.note) lines.push(warmEmailParagraph(escapeHtml(r.note as string)));
    lines.push(warmEmailSmall(escapeHtml(E.refundQuestions(face?.contact ?? null) || E.refundQuestionsClub(facts.org.name))));
    if (test) lines.push(warmEmailSmall(escapeHtml(E.testNote)));
    const subject = `${test ? E.testPrefix : ''}${E.refundSubject(facts.org.name)}`;
    const result = await sendEmail(op.payer_email, subject, warmEmailDocument(lines.join('\n'), face?.club ?? null), { ...face?.sendOpts, kind: 'team_payment_refund', orgId: facts.org.id });
    await stampRefundEmailed([refundId], result.status !== 'provider_error');
  } catch (err) {
    console.error('[online-payment-receipt] the refund email was not sent:', err instanceof Error ? err.message : String(err));
    await stampRefundEmailed([refundId], false).catch(() => null);
  }
}

/**
 * "Email the pay link" (copy §15): the team's link, to the team's contact, in the club's name. Only while the team can pay
 * online now; stamps "Pay link sent" on the record. The amount is the fee schedule's, never the processing fee.
 */
export async function sendTeamPayLink(teamId: string): Promise<{ sentTo: string; sentAt: string } | { error: string }> {
  const facts = await loadTeamPayFacts(teamId);
  if (!facts) return { error: 'That team couldn’t be found.' };
  const refusal = refusalMessage(facts);
  if (refusal) return { error: refusal };
  if (!facts.teamEmail) return { error: 'This team has no email address.' };
  const payLink = teamPayUrl(appUrl(), { orgSlug: facts.org.slug, tournamentSlug: facts.tournament.slug, teamId });
  if (!payLink) return { error: 'Pay links aren’t set up on this server.' };
  const face = await systemMailFace({
    id: facts.org.id, name: facts.org.name, logoUrl: facts.org.logoUrl ?? null,
    themePreset: facts.org.themePreset ?? null, themePrimary: facts.org.themePrimary ?? null, themeAccent: facts.org.themeAccent ?? null,
  });
  const owed = (facts.fee.totalFeeAmount ?? 0) - facts.totalPaid;
  const how = ((facts.tournament.settings ?? {}) as { payment_instructions?: string }).payment_instructions?.trim() || null;
  const html = warmEmailDocument([
    warmEmailParagraph(escapeHtml(E.linkBody(facts.org.name, facts.teamName, facts.divisionName))),
    warmEmailParagraph(escapeHtml(E.linkAmount(money(owed)))),
    warmEmailButton(facts.totalPaid > 0 ? E.payBalance : E.payNow, payLink),
    how ? warmEmailParagraph(escapeHtml(E.otherWays(how))) : '',
  ].filter(Boolean).join('\n'), face?.club ?? null);
  const result = await sendEmail(facts.teamEmail, E.linkSubject(facts.teamName, facts.tournament.name), html, { ...face?.sendOpts, kind: 'team_pay_link', orgId: facts.org.id });
  if (result.status === 'provider_error') return { error: 'Couldn’t send the pay link. Try again.' };
  const sentAt = new Date().toISOString();
  await supabaseAdmin.from('teams').update({ pay_link_sent_at: sentAt }).eq('id', teamId);
  return { sentTo: facts.teamEmail, sentAt };
}

/**
 * "Email the pay link", house league (Stage 12b, copy §4): the sign-up's link, to the family, in the club's name — one
 * email for every child still owing. Only while the family can pay online now; stamps "Pay link sent" on each owing
 * child. `raised` words it as a price raise (Part 5). The amount is what is owing, never the processing fee.
 */
export async function sendLeaguePayLink(
  registrationId: string,
  raised?: { child: string; from: string; to: string; diff: string } | null,
  refunded?: { child: string; childFirst: string; owing: string; blockHtml: string } | null,
  opts: { bulk?: boolean } = {},
): Promise<{ sentTo: string; sentAt: string } | { error: string; disputeLost?: true }> {
  const facts = await loadLeaguePayFacts(registrationId);
  if (!facts) return { error: 'That registration couldn’t be found.' };
  // 12d-1 Part 4 (words §1.5): "Email families who owe" leaves out a family with any child still owing after a lost card
  // dispute — it took its money back through its bank, and hears from a person, not a reminder. On the server, so a lost
  // SIBLING is caught too (the bulk send picks one child per sign-up). A desk member's single send is their own choice.
  if (opts.bulk && facts.shares.length && await anyLostDispute(facts.shares.map(s => s.registrationId))) {
    return { error: DISPUTE_WORDS.bulkWhy, disputeLost: true };
  }
  if (facts.refusal === 'clearing') {
    // 12c Part 6 (words §3.2): every child still owing is on a bank debit on its way.
    return { error: REGS_WORDS.payLink.clearingLink(childList(facts.children.filter(c => c.clearingCents > 0).map(c => `${c.firstName} ${c.lastName}`))) };
  }
  if (facts.refusal) return { error: facts.refusal === 'switch_off' || facts.refusal === 'not_taking_payments' ? 'The club isn’t taking card payments right now.' : 'There’s nothing owing to send a pay link for.' };
  if (!facts.guardianEmail) return { error: 'This family has no email address.' };
  const payLink = leaguePayUrl(appUrl(), { orgSlug: facts.org.slug, seasonSlug: facts.season.slug, registrationId });
  if (!payLink) return { error: 'Pay links aren’t set up on this server.' };
  const face = await systemMailFace({
    id: facts.org.id, name: facts.org.name, logoUrl: facts.org.logoUrl ?? null,
    themePreset: facts.org.themePreset ?? null, themePrimary: facts.org.themePrimary ?? null, themeAccent: facts.org.themeAccent ?? null,
  });
  const L = LW.linkEmail;
  const names = childList(facts.shares.map(s => s.description.split(' · ')[0].split(' ')[0]));
  const { data: anchor } = await supabaseAdmin.from('league_registrations').select('signup_ref').eq('id', registrationId).maybeSingle();
  const reference = (anchor?.signup_ref as string | null) ?? registrationReference(registrationId);
  const how = facts.season.howToPay?.trim() || null;
  const html = warmEmailDocument([
    warmEmailParagraph(escapeHtml(refunded ? LW.linkEmailRefunded(facts.org.name, refunded.child, facts.season.name, refunded.childFirst, refunded.owing)
      : raised ? L.bodyRaised(raised.child, facts.season.name, raised.from, raised.to, raised.diff) : L.body(facts.org.name, names, facts.season.name))),
    refunded ? refunded.blockHtml : warmEmailParagraph(escapeHtml(L.amount(money(facts.owingCents / 100)))),
    warmEmailButton(L.button, payLink),
    how ? warmEmailParagraph(escapeHtml(L.otherWays(how))) : '',
    warmEmailSmall(escapeHtml(L.reference(reference))),
    // Transactional family mail (money owed): it names the club and says why it arrives after an unsubscribe.
    transactionalFamilyFooterHtml({ orgName: facts.org.name, teamName: facts.season.name, noticeKind: 'Payment notices', about: 'a registration fee', replyLine: face?.contact ? `Questions: ${face.contact}.` : null }),
  ].filter(Boolean).join('\n'), face?.club ?? null);
  const result = await sendEmail(facts.guardianEmail, L.subject(names, facts.season.name), html, { ...face?.sendOpts, kind: 'league_pay_link' });
  if (result.status === 'provider_error') return { error: 'Couldn’t send the pay link. Try again.' };
  const sentAt = new Date().toISOString();
  await supabaseAdmin.from('league_registrations').update({ pay_link_sent_at: sentAt }).in('id', facts.shares.map(s => s.registrationId));
  return { sentTo: facts.guardianEmail, sentAt };
}

/** A card dispute lost (and not won back since) on a payment for any of these children. Small: a family's children. */
async function anyLostDispute(registrationIds: readonly string[]): Promise<boolean> {
  const { data: items } = await supabaseAdmin.from('online_payment_items').select('online_payment_id').in('registration_id', [...registrationIds]);
  const payIds = [...new Set(((items ?? []) as Array<{ online_payment_id: string }>).map(i => i.online_payment_id))];
  if (!payIds.length) return false;
  const { count } = await supabaseAdmin.from('online_payment_disputes').select('id', { count: 'exact', head: true })
    .in('online_payment_id', payIds).eq('status', 'lost').not('lost_booked_at', 'is', null).is('won_back_at', null);
  return (count ?? 0) > 0;
}

/**
 * The team's pay link for an email that offers Pay now (the acceptance email, the balance reminder): only while the
 * team can pay online at this moment, else null and the email is exactly today's (A6).
 */
export async function teamPayNowLink(teamId: string): Promise<{ url: string; paidSome: boolean } | null> {
  try {
    const facts = await loadTeamPayFacts(teamId);
    if (!facts || facts.refusal) return null;
    const url = teamPayUrl(appUrl(), { orgSlug: facts.org.slug, tournamentSlug: facts.tournament.slug, teamId });
    return url ? { url, paidSome: facts.totalPaid > 0 } : null;
  } catch {
    return null; // an email never fails over its Pay button
  }
}
