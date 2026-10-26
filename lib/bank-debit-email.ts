import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { escapeHtml, sendEmail } from './email';
import { systemMailFace } from './club-email-context';
import { warmEmailButton, warmEmailDocument, warmEmailParagraph, warmEmailSmall } from './email-envelope-warm';
import { formatStoredDate } from './timezone';
import { loadTeamPayFacts } from './team-pay-facts';
import { teamPayUrl } from './team-pay-link';
import { loadLeaguePayFacts } from './league-pay-facts';
import { leaguePayUrl } from './league-pay-link';
import { childList } from './league-pay-words';
import { transactionalFamilyFooterHtml } from './family-mail-footer';
import { emailFactsPanel } from './online-refund-block';
import { tournamentTracksPayments } from './tournament-payments-tracked';
import { BANK_DEBIT_EMAIL_WORDS as D, BANK_DEBIT_WORDS as B, DEBIT_NOTICE_WORDS as DW, ONLINE_EMAIL_WORDS as E, PAY_WORDS as P, money, reasonFull } from './online-payment-words';
import { possessive } from './utils';
import type { Organization } from './types';

/**
 * A BANK DEBIT'S EMAILS TO THE PAYER (Club Tier Stage 12c Part 5; words CLUB_TIER_STAGE12C_PARTREFUND_BANKDEBIT_COPY.md
 * §2.4). "It started" (not a receipt: the receipt is the ordinary one, sent when the debit clears) and "it didn't go
 * through" (nothing was taken, the place is still held, Pay now). Sent once each: the database's clearing and returned
 * moves answer true only the first time. Money mail, so like a receipt it reaches a family who unsubscribed from
 * announcements, with the shared footer saying why. A team's version says the team, a family's names the children.
 */

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? '';

type DebitRow = {
  id: string; flow: 'tournament_team' | 'league_signup'; team_id: string | null; payer_email: string | null;
  total_amount: number; base_amount: number; livemode: boolean; bank_last4: string | null; clearing_at: string | null;
  returned_at: string | null; reversed_at: string | null; return_reason: string | null; receipt_no: number | null; created_at: string;
};

type DebitContext = {
  op: DebitRow; org: Organization; who: string; season: string;
  /** "…spot is held." (the start) and "…spot is still held." (returned); a team's say "place". */
  held: string; stillHeld: string;
  payLink: string | null; canPayAgain: boolean; howToPay: string | null;
};

async function debitContext(onlinePaymentId: string): Promise<DebitContext | null> {
  const { data } = await supabaseAdmin.from('online_payments')
    .select('id, flow, team_id, payer_email, total_amount, base_amount, livemode, bank_last4, clearing_at, returned_at, reversed_at, return_reason, receipt_no, created_at')
    .eq('id', onlinePaymentId).maybeSingle();
  const op = data as DebitRow | null;
  if (!op?.payer_email) return null;
  if (op.flow === 'tournament_team' && op.team_id) {
    const facts = await loadTeamPayFacts(op.team_id);
    if (!facts) return null;
    return {
      op, org: facts.org as Organization, who: facts.teamName, season: facts.tournament.name,
      held: B.holdTeam(possessive(facts.teamName)), stillHeld: D.returnedHeldTeam(possessive(facts.teamName)),
      payLink: teamPayUrl(appUrl(), { orgSlug: facts.org.slug, tournamentSlug: facts.tournament.slug, teamId: facts.teamId }),
      canPayAgain: !facts.refusal,
      howToPay: tournamentTracksPayments(facts.tournament.settings) ? String((facts.tournament.settings as { payment_instructions?: string } | null)?.payment_instructions ?? '').trim() || null : null,
    };
  }
  const { data: items } = await supabaseAdmin.from('online_payment_items')
    .select('registration_id, description').eq('online_payment_id', op.id).order('created_at');
  const rows = (items ?? []) as Array<{ registration_id: string | null; description: string }>;
  const anchor = rows.find(r => r.registration_id)?.registration_id;
  const facts = anchor ? await loadLeaguePayFacts(anchor) : null;
  if (!facts || !anchor) return null;
  const firstName = new Map(facts.children.map(ch => [ch.registrationId, ch.firstName]));
  const firsts = rows.map(r => (r.registration_id && firstName.get(r.registration_id)) || r.description.split(' · ')[0]).filter(Boolean);
  return {
    op, org: facts.org, who: childList(firsts), season: facts.season.name,
    held: firsts.length === 1 ? B.holdChild(possessive(firsts[0])) : B.holdChildren(childList(firsts)),
    stillHeld: firsts.length === 1 ? D.returnedHeldChild(possessive(firsts[0])) : D.returnedHeldChildren(childList(firsts)),
    payLink: leaguePayUrl(appUrl(), { orgSlug: facts.org.slug, seasonSlug: facts.season.slug, registrationId: anchor }),
    canPayAgain: !facts.refusal,
    howToPay: facts.season.howToPay?.trim() || null,
  };
}

/** The body lines, then the closing line (the started email's "Wrong account, or a question?", else the receipt's questions). */
async function send(c: DebitContext, subject: string, lines: string[], closing: 'contact' | 'questions', preheader?: string): Promise<void> {
  const face = await systemMailFace({
    id: c.org.id, name: c.org.name, logoUrl: c.org.logoUrl ?? null,
    themePreset: c.org.themePreset ?? null, themePrimary: c.org.themePrimary ?? null, themeAccent: c.org.themeAccent ?? null,
  });
  const test = !c.op.livemode;
  const html = warmEmailDocument([
    // The inbox's preview line, hidden in the body (the refund email's own way, lib/online-payment-receipt.ts).
    preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>` : '',
    ...lines,
    warmEmailSmall(escapeHtml(closing === 'contact' ? B.contact(c.org.name, face?.contact ?? null) : E.questions(c.org.name, face?.contact ?? null))),
    test ? warmEmailSmall(escapeHtml(E.testNote)) : '',
    transactionalFamilyFooterHtml({ orgName: c.org.name, teamName: c.season, noticeKind: 'Payment notices', about: 'a payment', replyLine: null }),
  ].filter(Boolean).join('\n'), face?.club ?? null);
  const result = await sendEmail(c.op.payer_email!, `${test ? E.testPrefix : ''}${subject}`, html, face?.sendOpts ?? {});
  if (result.status === 'provider_error') throw new Error('send failed');
}

/** "Your bank debit has started" — once, when the debit is first recorded clearing. A failed send is logged, never thrown. */
export async function sendDebitStartedEmail(onlinePaymentId: string): Promise<void> {
  try {
    const c = await debitContext(onlinePaymentId);
    if (!c) return;
    const total = money(Number(c.op.total_amount));
    const started = formatStoredDate(c.op.clearing_at ?? c.op.created_at);
    await send(c, D.startedSubject(c.org.name), [
      warmEmailParagraph(escapeHtml(D.startedLead(c.who, c.season))),
      emailFactsPanel([
        [D.amount, total],
        ...(c.op.bank_last4 ? [[D.from, D.fromValue(c.op.bank_last4)] as const] : []),
        [D.started, started],
      ]),
      warmEmailParagraph(escapeHtml(D.notReceipt)),
      warmEmailParagraph(escapeHtml(D.takes)),
      warmEmailParagraph(escapeHtml(c.held)),
    ], 'contact', D.startedPreheader(total, c.op.bank_last4));
  } catch (err) {
    console.error('[bank-debit-email] the debit-started email was not sent:', err instanceof Error ? err.message : String(err));
  }
}

/** "Your bank debit didn't go through" — once, when the debit is first recorded returned: nothing taken, still held, Pay now. */
export async function sendDebitReturnedEmail(onlinePaymentId: string): Promise<void> {
  try {
    const c = await debitContext(onlinePaymentId);
    if (!c) return;
    const total = money(Number(c.op.total_amount));
    await send(c, D.returnedSubject, [
      warmEmailParagraph(escapeHtml(D.returnedLead(total, c.who, formatStoredDate(c.op.returned_at), reasonFull(c.op.return_reason)))),
      warmEmailParagraph(escapeHtml(D.returnedNothing)),
      warmEmailParagraph(escapeHtml(c.stillHeld)),
      c.payLink && c.canPayAgain ? warmEmailButton(D.payNow, c.payLink) : '',
      c.howToPay ? warmEmailParagraph(escapeHtml(P.otherWays(c.howToPay))) : '',
    ], 'questions');
  } catch (err) {
    console.error('[bank-debit-email] the debit-returned email was not sent:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * "A payment to {club} was returned" (12c Part 6, words §2.4 email 4) — once, when the bank reverses a debit that had
 * cleared: the receipt no longer counts, what is owing again, Pay now.
 */
export async function sendDebitReversedEmail(onlinePaymentId: string): Promise<void> {
  try {
    const c = await debitContext(onlinePaymentId);
    if (!c) return;
    const total = money(Number(c.op.total_amount));
    const why = reasonFull(c.op.return_reason);
    await send(c, D.reversedSubject(c.org.name), [
      warmEmailParagraph(escapeHtml(D.reversedLead(total, c.org.name, formatStoredDate(c.op.reversed_at)))),
      why ? warmEmailParagraph(escapeHtml(D.reversedReason(why))) : '',
      warmEmailParagraph(escapeHtml(D.reversedOwes(String(c.op.receipt_no ?? ''), DW.owingAgain(money(Number(c.op.base_amount)))))),
      c.payLink && c.canPayAgain ? warmEmailButton(D.payNow, c.payLink) : '',
    ], 'questions');
  } catch (err) {
    console.error('[bank-debit-email] the debit-reversed email was not sent:', err instanceof Error ? err.message : String(err));
  }
}
