import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { escapeHtml, sendEmail } from './email';
import { systemMailFace } from './club-email-context';
import { warmEmailDocument, warmEmailHeading, warmEmailParagraph, warmEmailSmall } from './email-envelope-warm';
import { REFUND_BLOCK_WORDS as B, ONLINE_EMAIL_WORDS as E, money } from './online-payment-words';
import { LEAGUE_PAY_WORDS as LW, childList } from './league-pay-words';
import { transactionalFamilyFooterHtml } from './family-mail-footer';
import { refundBlockHtml, type RefundBlockInput } from './online-refund-block';
import { getOrganizationBySlugForServer } from './server-organizations';
import type { Organization } from './types';

async function orgById(orgId: string): Promise<Organization | null> {
  const { data } = await supabaseAdmin.from('organizations').select('slug').eq('id', orgId).maybeSingle();
  return data?.slug ? getOrganizationBySlugForServer(data.slug as string) : null;
}

/**
 * A HOUSE-LEAGUE CARD REFUND, TOLD TO THE FAMILY (Club Tier Stage 12c Part 3; plan §0g rulings 3 and 6; words
 * docs/projects/active/CLUB_TIER_STAGE12C_REFUND_VISIBLE_COPY.md §4). One email per act, in the club's name, with the one
 * refund block (lib/online-refund-block.ts): the "couldn't go on this registration" door's refund, a price correction's, a
 * refund made in Stripe, and "still enrolled → keep". The ending's refund rides in the ending's own email
 * (`leagueRefundMail`, below). Sent only for a refund Stripe accepted (booked) — never for one we couldn't confirm, never to
 * the family for a failed one (ruling 6) — and stamped `family_emailed_at` / `family_email_failed_at` for the record.
 */

type RefundRow = {
  id: string; online_payment_id: string; online_payment_item_id: string | null; amount: number; fee_refunded: number; status: string;
  booked_at: string | null; partial_reason: string | null; note: string | null; created_at: string; stripe_refund_id: string | null;
};
type ItemRow = { id: string; registration_id: string | null; description: string; amount: number; fee_share: number; land_error: string | null };
type PayRow = {
  id: string; org_id: string; season_id: string | null; rail: string; card_brand: string | null; card_last4: string | null; bank_last4: string | null;
  receipt_no: number | null; paid_on: string | null; fee_payer: string; livemode: boolean; payer_email: string | null;
};

export type LeagueRefundMail = {
  /** The block's HTML, for the ending email (and the pay link sent from "still enrolled"). */
  blockHtml: string;
  /** What went back (fee included), the rail, and the base refunded (fee excluded). */
  refundCents: number;
  bank: boolean;
  baseCents: number;
  whole: boolean;
  children: Array<{ regId: string | null; name: string; first: string; baseCents: number }>;
  reason: string | null;
  note: string | null;
  landError: string | null;
  seasonId: string | null;
  orgId: string;
  payerEmail: string | null;
  livemode: boolean;
  refundIds: string[];
};

const cents = (n: number) => Math.round(Number(n) * 100);

/**
 * The facts every refund email of one payment's refunds reads (one or more refund rows of ONE payment — a split refund made
 * in Stripe is a row per child with one Stripe id). Null when nothing can be told: no refund Stripe accepted.
 */
export async function leagueRefundMail(refundIds: string[]): Promise<LeagueRefundMail | null> {
  if (!refundIds.length) return null;
  const { data: rs } = await supabaseAdmin.from('online_payment_refunds')
    .select('id, online_payment_id, online_payment_item_id, amount, fee_refunded, status, booked_at, partial_reason, note, created_at, stripe_refund_id')
    .in('id', refundIds);
  const refunds = ((rs ?? []) as RefundRow[]).filter(r => r.booked_at && r.status !== 'failed' && r.status !== 'canceled');
  if (!refunds.length) return null;
  const payId = refunds[0].online_payment_id;
  if (refunds.some(r => r.online_payment_id !== payId)) throw new Error('One refund email is one payment’s refunds.');
  const [{ data: p }, { data: its }] = await Promise.all([
    supabaseAdmin.from('online_payments')
      .select('id, org_id, season_id, rail, card_brand, card_last4, bank_last4, receipt_no, paid_on, fee_payer, livemode, payer_email')
      .eq('id', payId).maybeSingle(),
    supabaseAdmin.from('online_payment_items').select('id, registration_id, description, amount, fee_share, land_error')
      .in('id', refunds.map(r => r.online_payment_item_id).filter((x): x is string => !!x)),
  ]);
  const pay = p as PayRow | null;
  if (!pay) return null;
  const items = new Map(((its ?? []) as ItemRow[]).map(i => [i.id, i]));
  const regIds = [...items.values()].map(i => i.registration_id).filter((x): x is string => !!x);
  const { data: regRows } = regIds.length
    ? await supabaseAdmin.from('league_registrations').select('id, player_first_name, player_last_name').in('id', regIds)
    : { data: [] };
  const regs = new Map(((regRows ?? []) as Array<{ id: string; player_first_name: string; player_last_name: string }>).map(r => [r.id, r]));

  const children = refunds.map(r => {
    const item = r.online_payment_item_id ? items.get(r.online_payment_item_id) : undefined;
    const reg = item?.registration_id ? regs.get(item.registration_id) : undefined;
    const name = reg ? `${reg.player_first_name} ${reg.player_last_name}` : (item?.description ?? '').split(' · ')[0];
    return { regId: item?.registration_id ?? null, name, first: reg?.player_first_name ?? name.split(' ')[0], baseCents: cents(r.amount) - cents(r.fee_refunded), item };
  });
  const familyPaidFee = pay.fee_payer === 'family';
  const feeBack = refunds.reduce((n, r) => n + cents(r.fee_refunded), 0);
  const feeShare = children.reduce((n, c) => n + cents(c.item?.fee_share ?? 0), 0);
  const input: RefundBlockInput = {
    refundCents: refunds.reduce((n, r) => n + cents(r.amount), 0),
    children: children.map(c => ({ name: c.name, cents: c.baseCents })),
    bank: pay.rail === 'bank_debit', cardBrand: pay.card_brand, cardLast4: pay.card_last4, bankLast4: pay.bank_last4,
    refundedAt: refunds.map(r => r.created_at).sort()[0], reference: refunds[0].stripe_refund_id,
    receiptNo: pay.receipt_no, paidOn: pay.paid_on,
    feeBackCents: feeBack, feeKeptCents: familyPaidFee && feeBack === 0 ? feeShare : 0,
  };
  const baseCents = children.reduce((n, c) => n + c.baseCents, 0);
  return {
    blockHtml: refundBlockHtml(input), refundCents: input.refundCents, bank: input.bank, baseCents,
    whole: children.every(c => c.item && c.baseCents >= cents(c.item.amount)),
    children: children.map(({ regId, name, first, baseCents: b }) => ({ regId, name, first, baseCents: b })),
    reason: refunds.find(r => r.partial_reason)?.partial_reason ?? null,
    note: refunds.find(r => r.note)?.note ?? null,
    landError: children[0]?.item?.land_error ?? null,
    seasonId: pay.season_id, orgId: pay.org_id, payerEmail: pay.payer_email, livemode: pay.livemode,
    refundIds: refunds.map(r => r.id),
  };
}

/** Stamps what the record's "Family emailed" reads. */
export async function stampRefundEmailed(refundIds: string[], sent: boolean): Promise<void> {
  if (!refundIds.length) return;
  const at = new Date().toISOString();
  await supabaseAdmin.from('online_payment_refunds')
    .update(sent ? { family_emailed_at: at, family_email_failed_at: null } : { family_emailed_at: null, family_email_failed_at: at })
    .in('id', refundIds);
}

/** Claims a refund's one email (so two deliveries of one Stripe event send one); the send then stamps the outcome. */
export async function claimRefundEmail(refundId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from('online_payment_refunds')
    .update({ family_emailed_at: new Date().toISOString() })
    .eq('id', refundId).is('family_emailed_at', null).is('family_email_failed_at', null)
    .select('id').maybeSingle();
  return !!data;
}

/**
 * The ending email's refund (words §4 "variants that ride inside other emails"): "We refunded your payment." (or "…{amount}
 * of your payment."), the club's reason, the block, and what the club keeps of the rest. Escaped HTML for
 * `EndedMoneyLine { answer: 'card' }`. Null when nothing Stripe accepted can be told.
 */
export async function leagueEndingRefundHtml(refundIds: string[], kept: { cents: number; reason: string } | null): Promise<{ html: string; refundIds: string[] } | null> {
  const mail = await leagueRefundMail(refundIds);
  if (!mail) return null;
  const org = await orgById(mail.orgId);
  const M = LW.endMail;
  const p = (t: string) => `<p>${escapeHtml(t)}</p>`;
  const html = [
    p(mail.whole && !kept ? M.refundLead : M.refundLeadPart(money(mail.baseCents / 100))),
    mail.reason && org ? p(LW.refundEmail.reason(org.name, mail.reason)) : '',
    mail.blockHtml,
    kept && kept.cents > 0 ? p(M.keptRest(money(kept.cents / 100), kept.reason)) : '',
  ].filter(Boolean).join('\n    ');
  return { html, refundIds: mail.refundIds };
}

/** A refund made in Stripe on THIS child that still waits for "what now?" (no answer yet), with its base. */
export async function stillEnrolledRefund(regId: string, refundId: string): Promise<{ id: string; baseCents: number } | null> {
  const { data } = await supabaseAdmin.from('online_payment_refunds')
    .select('id, amount, fee_refunded, origin, family_answer, online_payment_items!inner(registration_id)')
    .eq('id', refundId).maybeSingle();
  if (!data || data.origin !== 'stripe_dashboard' || data.family_answer) return null;
  const item = (Array.isArray(data.online_payment_items) ? data.online_payment_items[0] : data.online_payment_items) as { registration_id: string | null };
  if (item?.registration_id !== regId) return null;
  return { id: data.id as string, baseCents: cents(data.amount as number) - cents(data.fee_refunded as number) };
}

/** Keeps the desk's answer on the refund — the "still enrolled" notice's resolver reads it. */
export async function answerStillEnrolled(refundIds: string[], answer: 'withdraw' | 'link' | 'keep', actorId: string): Promise<void> {
  if (!refundIds.length) return;
  await supabaseAdmin.from('online_payment_refunds')
    .update({ family_answer: answer, family_answer_by: actorId, family_answer_at: new Date().toISOString() })
    .in('id', refundIds).is('family_answer', null);
}

export type LeagueRefundVariant =
  | { kind: 'door' }
  | { kind: 'price'; from: string; to: string }
  | { kind: 'stripe' }
  | { kind: 'keep'; owing: string };

/** The family's refund email (words §4). Never throws: a refund email that can't go is stamped, never a failed refund. */
export async function sendLeagueRefundEmail(refundIds: string[], variant: LeagueRefundVariant): Promise<void> {
  let mail: LeagueRefundMail | null = null;
  try {
    mail = await leagueRefundMail(refundIds);
    if (!mail?.seasonId) return;
    const [org, { data: season }, { data: anchor }] = await Promise.all([
      orgById(mail.orgId),
      supabaseAdmin.from('league_seasons').select('name').eq('id', mail.seasonId).maybeSingle(),
      mail.children[0]?.regId
        ? supabaseAdmin.from('league_registrations').select('guardian_email').eq('id', mail.children[0].regId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const to = ((anchor?.guardian_email as string | null) ?? mail.payerEmail ?? '').trim();
    if (!org || !to) { await stampRefundEmailed(mail.refundIds, false); return; }
    const face = await systemMailFace(org);
    const seasonName = (season?.name as string | null) ?? '';
    const R = LW.refundEmail;
    const amount = money(mail.baseCents / 100);
    const one = mail.children.length === 1 ? mail.children[0] : null;
    const names = childList(mail.children.map(c => c.first));
    const lead = variant.kind === 'door' && one ? R.leadNeverBooked(one.name, seasonName)
      : one ? (mail.whole && variant.kind !== 'price' ? R.lead(one.name, seasonName) : R.leadPart(amount, one.name, seasonName))
        : mail.whole ? R.leadMany(names, seasonName) : R.leadManyPart(amount, names, seasonName);
    const test = !mail.livemode;
    const lines = [
      // The inbox's preview line (words `refundEmail.preheader`).
      `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(B.preheader(money(mail.refundCents / 100), mail.bank))}</div>`,
      warmEmailHeading(escapeHtml(lead)),
      variant.kind === 'door' && one ? warmEmailParagraph(escapeHtml((R.why[mail.landError ?? ''] ?? R.why.other)(one.name))) : '',
      variant.kind === 'price' ? warmEmailParagraph(escapeHtml(R.priceChanged(variant.from, variant.to))) : '',
      mail.reason ? warmEmailParagraph(escapeHtml(R.reason(org.name, mail.reason))) : '',
      mail.blockHtml,
      variant.kind === 'keep' && one ? warmEmailParagraph(escapeHtml(R.stillEnrolled(one.first, variant.owing))) : '',
      mail.note ? warmEmailParagraph(escapeHtml(mail.note)) : '',
      warmEmailSmall(escapeHtml(E.refundQuestions(face?.contact ?? null) || E.refundQuestionsClub(org.name))),
      test ? warmEmailSmall(escapeHtml(E.testNote)) : '',
      transactionalFamilyFooterHtml({ orgName: org.name, teamName: seasonName, noticeKind: 'Payment notices', about: 'a refund of a registration fee', replyLine: null }),
    ];
    const subject = `${test ? E.testPrefix : ''}${R.subject(org.name)}`;
    const result = await sendEmail(to, subject, warmEmailDocument(lines.filter(Boolean).join('\n'), face?.club ?? null), face?.sendOpts ?? {});
    await stampRefundEmailed(mail.refundIds, result.status !== 'provider_error');
  } catch (err) {
    console.error('[online-refund-email] the refund email was not sent:', err instanceof Error ? err.message : String(err));
    if (mail) await stampRefundEmailed(mail.refundIds, false).catch(() => null);
  }
}
