import { escapeHtml } from './email';
import { warmEmailButton, warmEmailDocument, warmEmailParagraph, warmEmailSmall } from './email-envelope-warm';
import { emailFactsPanel } from './online-refund-block';
import { isInquiry } from './online-payment-dispute';
import { DISPUTE_EMAIL_WORDS as M, DISPUTE_WORDS as DW, ONLINE_EMAIL_WORDS as E, disputeDue, disputeWhyFull, money } from './online-payment-words';

/**
 * THE EMAIL TO THE PERSON WHO ANSWERS, WHEN A CARD DISPUTE OPENS (Club Tier Stage 12d-1 Part 3; words
 * CLUB_TIER_STAGE12D_COPY.md §1.6). FieldLogicHQ's own envelope, not the club's identity: it is the platform telling the
 * club's owner, the only one who can sign in to Stripe. No "Answer in Stripe" button: Stripe's dashboard needs a fresh
 * sign-in, so the button opens the record, which has the door and the facts to copy.
 *
 * The words' fee line ("We pass it on to you {invoiceWhere}") is replaced by owner ruling 6 (2026-10-27): the sandbox
 * showed a card dispute's fee taken from the club's own Stripe balance, so it is never invoiced; the sentence prints only
 * when Stripe reports the figure.
 */
export function disputeOpenedEmailHtml(p: {
  club: string; payer: string; forWhom: string; record: string | null; receiptNo: string; day: string; status: string;
  reason: string | null; held: number; dueBy: string | null; stripeFee: number | null; link: string; test: boolean;
}): { subject: string; html: string } {
  const inquiry = isInquiry(p.status);
  const dueFull = disputeDue(p.dueBy, { clock: true, year: true });
  const why = M.whySentence(disputeWhyFull(p.reason));
  const subject = `${p.test ? E.testPrefix : ''}${inquiry ? M.subjectInquiry(p.club) : M.subject(p.club)}`;
  const html = warmEmailDocument([
    dueFull ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(M.preheader(dueFull))}</div>` : '',
    warmEmailParagraph(escapeHtml(inquiry
      ? M.leadInquiry(p.payer, p.forWhom, p.receiptNo, p.day, why)
      : M.lead(p.payer, p.forWhom, p.receiptNo, p.day, why))),
    emailFactsPanel([
      [M.held, inquiry ? M.heldNone : money(p.held)],
      ...(dueFull ? [[M.answerBy, dueFull] as const] : []),
    ]),
    warmEmailParagraph(escapeHtml(M.act(p.record))),
    !inquiry && p.stripeFee != null ? warmEmailParagraph(escapeHtml(DW.feeFromClub(money(p.stripeFee)))) : '',
    warmEmailButton(M.button(p.record), p.link),
    warmEmailSmall(escapeHtml(M.noChange)),
    p.test ? warmEmailSmall(escapeHtml(E.testNote)) : '',
  ].filter(Boolean).join('\n'));
  return { subject, html };
}

/** §1.6 email 2: three days before the answer is due, only while it is unanswered (the daily job). The same envelope. */
export function disputeReminderEmailHtml(p: {
  club: string; forWhom: string; record: string | null; receiptNo: string; dueBy: string; link: string; test: boolean;
}): { subject: string; html: string } {
  const subject = `${p.test ? E.testPrefix : ''}${M.reminder.subject(disputeDue(p.dueBy), p.club)}`;
  const html = warmEmailDocument([
    warmEmailParagraph(escapeHtml(M.reminder.lead(p.receiptNo, p.forWhom, disputeDue(p.dueBy, { clock: true, year: true })))),
    warmEmailParagraph(escapeHtml(M.reminder.after)),
    warmEmailButton(M.button(p.record), p.link),
    p.test ? warmEmailSmall(escapeHtml(E.testNote)) : '',
  ].filter(Boolean).join('\n'));
  return { subject, html };
}
