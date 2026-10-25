import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { escapeHtml, sendEmail } from './email';
import { systemMailFace } from './club-email-context';
import { warmEmailButton, warmEmailDocument, warmEmailHeading, warmEmailParagraph, warmEmailSmall } from './email-envelope-warm';
import { formatStoredDate } from './timezone';
import { loadTeamPayFacts } from './team-pay-facts';
import { refusalMessage } from './team-pay-view';
import { teamPayUrl } from './team-pay-link';
import { ONLINE_EMAIL_WORDS as E, SCOPE_LINE, cardLabel, money, receiptLabel } from './online-payment-words';

/**
 * The payer's emails (Club Tier Stage 12a, copy §14 and §17): one receipt per payment and one email per refund, from our
 * email stack in the CLUB's name with the club's contact as reply-to. Stripe's own receipt is never asked for (no
 * `receipt_email`, `lib/stripe-connect.ts`). A test-mode payment says so in the subject and the body.
 */

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? '';

type OnlineForEmail = {
  id: string; org_id: string; team_id: string | null; scope: 'deposit' | 'balance' | 'full'; payer_email: string | null;
  base_amount: number; fee_amount: number; total_amount: number; fee_payer: 'family' | 'club'; livemode: boolean;
  card_brand: string | null; card_last4: string | null; receipt_no: number | null; paid_on: string | null;
};
const ONLINE_EMAIL_COLUMNS =
  'id, org_id, team_id, scope, payer_email, base_amount, fee_amount, total_amount, fee_payer, livemode, card_brand, card_last4, receipt_no, paid_on';

/** Claims the receipt (so two webhook deliveries send one), then sends it; a failed send releases the claim for a retry. */
export async function sendOnlineReceiptOnce(onlinePaymentId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from('online_payments')
    .update({ receipt_emailed_at: new Date().toISOString() })
    .eq('id', onlinePaymentId)
    .is('receipt_emailed_at', null)
    .in('status', ['paid', 'refunded'])
    .select(ONLINE_EMAIL_COLUMNS)
    .maybeSingle();
  const op = data as OnlineForEmail | null;
  if (!op?.payer_email || !op.team_id) return;
  try {
    await sendReceipt(op);
  } catch (err) {
    await supabaseAdmin.from('online_payments').update({ receipt_emailed_at: null }).eq('id', op.id);
    console.error('[online-payment-receipt] the receipt was not sent:', err instanceof Error ? err.message : String(err));
  }
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
    warmEmailParagraph(escapeHtml(E.receiptTotal(money(Number(op.total_amount)), cardLabel(op.card_brand, op.card_last4), formatStoredDate(op.paid_on)))),
  ];
  const balance = facts.options?.choices.find(c => c.scope === 'balance');
  if (balance) {
    lines.push(warmEmailParagraph(escapeHtml(E.receiptBalance(money(balance.fee.baseCents / 100), balance.dueDate ? formatStoredDate(balance.dueDate) : null))));
    if (payLink && !facts.refusal) lines.push(warmEmailButton(E.payBalance, payLink));
  } else if (payLink) {
    lines.push(warmEmailButton(E.viewReceipt, payLink));
  }
  lines.push(warmEmailSmall(escapeHtml(E.questions(facts.org.name, face?.contact ?? null))));
  if (test) lines.push(warmEmailSmall(escapeHtml(E.testNote)));
  const subject = `${test ? E.testPrefix : ''}${E.receiptSubject(receiptNo, facts.org.name)}`;
  const result = await sendEmail(op.payer_email!, subject, warmEmailDocument(lines.filter(Boolean).join('\n'), face?.club ?? null), face?.sendOpts ?? {});
  if (result.status === 'provider_error') throw new Error('send failed');
}

/** The refund email — called once, on the refund's first landing (the database function answers `already` after). */
export async function sendRefundEmail(refundId: string): Promise<void> {
  try {
    const { data: r } = await supabaseAdmin.from('online_payment_refunds').select('online_payment_id, amount, fee_refunded, note').eq('id', refundId).maybeSingle();
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
    const today = new Date().toISOString();
    const lines = [
      warmEmailHeading(escapeHtml(E.refundLead(facts.teamName, facts.tournament.name))),
      warmEmailParagraph(escapeHtml(E.refundAmount(money(Number(r.amount)), cardLabel(op.card_brand, op.card_last4), formatStoredDate(today)))),
    ];
    if (op.fee_payer === 'family' && Number(op.fee_amount) > 0) {
      lines.push(warmEmailParagraph(escapeHtml(Number(r.fee_refunded) > 0 ? E.refundFeeIncluded(money(Number(op.fee_amount))) : E.refundFeeKept(money(Number(op.fee_amount))))));
    }
    if (r.note) lines.push(warmEmailParagraph(escapeHtml(r.note as string)));
    const q = E.refundQuestions(face?.contact ?? null);
    if (q) lines.push(warmEmailSmall(escapeHtml(q)));
    if (test) lines.push(warmEmailSmall(escapeHtml(E.testNote)));
    const subject = `${test ? E.testPrefix : ''}${E.refundSubject(facts.org.name)}`;
    await sendEmail(op.payer_email, subject, warmEmailDocument(lines.join('\n'), face?.club ?? null), face?.sendOpts ?? {});
  } catch (err) {
    console.error('[online-payment-receipt] the refund email was not sent:', err instanceof Error ? err.message : String(err));
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
  const result = await sendEmail(facts.teamEmail, E.linkSubject(facts.teamName, facts.tournament.name), html, face?.sendOpts ?? {});
  if (result.status === 'provider_error') return { error: 'Couldn’t send the pay link. Try again.' };
  const sentAt = new Date().toISOString();
  await supabaseAdmin.from('teams').update({ pay_link_sent_at: sentAt }).eq('id', teamId);
  return { sentTo: facts.teamEmail, sentAt };
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
