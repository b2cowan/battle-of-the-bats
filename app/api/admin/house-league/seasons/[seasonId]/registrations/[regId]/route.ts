import { closeChildPayPages, openChildPayPages } from '@/lib/online-pay-pages';
import { NextResponse } from 'next/server';
import { getAuthContextWithRole, forbidden } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { canMarkLeagueFeePaid, endLeagueRegistration, writeLeagueMoney, type EndMoney, type LeagueMoneyMove, type LeagueMoneyRefusal } from '@/lib/league-fee-paid';
import { END_WORDS, MONEY_REFUSAL, REGS_WORDS } from '@/lib/house-league-money-words';
import { moveRefused } from '@/lib/club-money-route';
import { getLeagueSeasonById, mapLeagueRegistration } from '@/lib/db';
import { changeLeagueDivision, moveLeagueRegistration } from '@/lib/league-registration-place';
import { leaguePrice, priceFromBody, registrationOwes } from '@/lib/league-price';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { divisionInSeason, teamsInSeason } from '@/lib/league-season-scope';
import { placePlayer } from '@/lib/house-league-teams';
import {
  leagueAdminApprovedHtml,
  leagueAdminWaitlistedHtml,
  leagueWaitlistPromotedHtml,
  leagueRegistrationDeclinedHtml,
  leagueSpotReleasedHtml,
  leagueRegistrationWithdrawnHtml,
  type EndedMoneyLine,
} from '@/lib/email';
import { loadRegistrationMoneyLines } from '@/lib/league-money-read';
import { formatLeagueMoney, receivedOf } from '@/lib/league-money';
import { possessive } from '@/lib/utils';
import { clearSettled } from '@/lib/needs-attention';
import { sendTransactionalEmail } from '@/lib/platform-email-templates';
import { systemMailFace } from '@/lib/club-email-context';
import type { LeagueRegistrationStatus } from '@/lib/types';
import { orgDayKey, tournamentToday } from '@/lib/timezone';
import { withObservability } from '@/lib/observability';
import { leagueMailPay } from '@/lib/league-pay-view';
import { sendLeaguePayLink } from '@/lib/online-payment-receipt';
import { answerStillEnrolled, leagueEndingRefundHtml, leagueRefundMail, sendLeagueRefundEmail, stampRefundEmailed, stillEnrolledRefund } from '@/lib/online-refund-email';
import type { EmailKind } from '@/lib/email-kinds';
import { leagueCardShares, refundLeagueToCard, resolveLeagueRefundAnotherWay } from '@/lib/online-payment-landing';
import { clubTakesCards, loadRegistrationDebits, returnedCardRefunds, unrecordedCardShares, isRegClearing } from '@/lib/league-pay-facts';
import { onlinePaymentsOn } from '@/lib/online-payments-switch';


async function fetchReg(regId: string, seasonId: string) {
  const { data } = await supabaseAdmin
    .from('league_registrations')
    .select('*')
    .eq('id', regId)
    .eq('season_id', seasonId)
    .single();
  return data ? mapLeagueRegistration(data) : null;
}

/** The waitlist moved up (inside the same locked database step that freed the spot, mig 362): tell that family. */
function emailPromoted(
  org: Parameters<typeof systemMailFace>[0] & { slug: string; name: string },
  season: { name: string; slug: string; registrationFee: number | null; howToPay: string | null },
  seasonId: string,
  promotedId: string,
): void {
  void (async () => {
    try {
      const next = await fetchReg(promotedId, seasonId);
      if (!next) return;
      let divisionName = 'your division';
      if (next.divisionId) {
        const { data: div } = await supabaseAdmin.from('league_divisions').select('name').eq('id', next.divisionId).single();
        if (div) divisionName = div.name;
      }
      // 12b: Pay now by card while the club takes card payments (the promoted child is accepted, so now owes).
      const [face, online] = await Promise.all([systemMailFace(org), leagueMailPay(next.id)]);
      await sendTransactionalEmail({
        key: 'league_waitlist_promoted',
        to: next.guardianEmail,
        vars: {
          guardianFirstName: next.guardianFirstName,
          playerFirstName:   next.playerFirstName,
          playerLastName:    next.playerLastName,
          seasonName:        season.name,
          divisionName,
        },
        defaultSubject: `A spot opened: ${next.playerFirstName} is accepted — ${season.name}`,
        // Q4: the promotion carries the price this child signed up at and the club's how-to-pay words.
        defaultHtml: leagueWaitlistPromotedHtml({
          playerFirstName:  next.playerFirstName,
          playerLastName:   next.playerLastName,
          guardianFirstName: next.guardianFirstName,
          seasonName:       season.name,
          divisionName,
          registrationId:   next.id,
          reference:        next.signupRef,
          fee:              registrationOwes(next, season),
          howToPay:         season.howToPay,
          clubName:         org.name,
          statusPath:       `/${org.slug}/league/${season.slug}/status`,
          face,
          online,
        }),
        family: face ? { face, reason: `${next.playerFirstName} was signed up for ${season.name}` } : undefined,
      });
    } catch (e) { console.error('[email] leagueWaitlistPromotedHtml failed', e); }
  })();
}

/** A division's price for a child who signed up on `registeredAt` (the club's day): the early bird still applies. */
async function divisionPriceFor(
  divisionId: string,
  season: { registrationFee: number | null; earlyBirdUntil: string | null },
  registeredAt: string,
): Promise<number | null> {
  const { data: div, error } = await supabaseAdmin.from('league_divisions').select('price, early_price').eq('id', divisionId).maybeSingle();
  if (error) throw error;
  if (!div) return null;
  const price = leaguePrice(
    { price: div.price != null ? Number(div.price) : null, earlyPrice: div.early_price != null ? Number(div.early_price) : null },
    season, orgDayKey(registeredAt),
  );
  return price?.amount ?? null;
}

const text = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

/** A money press as the screens send it. Null when it is not one of the shapes (nothing is guessed). */
function readMoneyMove(raw: unknown): LeagueMoneyMove | null {
  const m = (raw ?? {}) as Record<string, unknown>;
  const method = m.method == null || m.method === '' ? null : String(m.method);
  if (m.kind === 'receive' && typeof m.day === 'string') return { kind: 'receive', day: m.day, method };
  if (m.kind === 'undo') return { kind: 'undo', entryId: typeof m.entryId === 'string' ? m.entryId : null };
  if (m.kind === 'price') {
    const price = priceFromBody(m.price);
    if (!price || 'error' in price || price.value == null) return null;
    return { kind: 'price', price: price.value, reason: text(m.reason, 200) ?? '', day: typeof m.day === 'string' ? m.day : null, method };
  }
  return null;
}

/** What happened to the money on an ending, as the window sends it. Undefined when not sent; null when malformed. */
function readEndMoney(raw: unknown): EndMoney | null | undefined {
  if (raw == null) return undefined;
  const m = raw as Record<string, unknown>;
  if (m.answer === 'refunded' && typeof m.day === 'string') {
    return { answer: 'refunded', day: m.day, method: m.method == null || m.method === '' ? null : String(m.method), reason: text(m.reason, 200) };
  }
  if (m.answer === 'kept') return { answer: 'kept', reason: text(m.reason, 200) ?? '' };
  return null;
}

/** 12b: an ending that refunds to the card — all of it (A2's box may give the fee share back) or part, with a reason. */
type CardEnd = { amount: number | null; feeIncluded: boolean; partialReason: string | null; note: string | null };
/** 12c Part 6: the ending window's answer for a bank debit still clearing (words §3.3). */
type ClearAnswer = { choice: 'send_back' | 'keep'; feeBack: boolean; reason: string | null };
function readClearAnswer(raw: unknown): ClearAnswer | null {
  const m = (raw ?? {}) as Record<string, unknown>;
  if (m.choice !== 'send_back' && m.choice !== 'keep') return null;
  const reason = text(m.reason, 200);
  if (m.choice === 'keep' && !reason) return null;
  return { choice: m.choice, feeBack: m.choice === 'send_back' && m.feeBack === true, reason: m.choice === 'keep' ? reason : null };
}

function readCardEnd(raw: unknown): CardEnd | null {
  const m = (raw ?? {}) as Record<string, unknown>;
  if (m.answer !== 'card') return null;
  const amount = typeof m.amount === 'number' && Number.isFinite(m.amount) && m.amount > 0 ? Math.round(m.amount * 100) / 100 : null;
  return { amount, feeIncluded: m.feeIncluded === true && amount == null, partialReason: text(m.partialReason, 500), note: text(m.note, 1000) };
}

/**
 * Refund a child's card payments (12b Part 5): all of what is left on each share, or part of the newest share. Stops at
 * the first refusal and says so; what went back before it is booked and stays.
 */
async function refundChildToCard(
  regId: string, actorId: string, reason: 'club_ended' | 'family_left' | 'price_corrected', end: CardEnd,
): Promise<{ refundedCents: number; error: string | null; pending: boolean; refundIds: string[] }> {
  // The launch switch, first (every online-payments door reads it): off, no refund reaches Stripe from here.
  if (!onlinePaymentsOn()) return { refundedCents: 0, error: 'Online payments aren’t available right now. Refund another way.', pending: false, refundIds: [] };
  const shares = await leagueCardShares(regId);
  if (!shares.length) return { refundedCents: 0, error: 'There’s no card payment left to refund.', pending: false, refundIds: [] };
  const plan = end.amount != null
    ? [{ share: shares[0], amount: end.amount }]
    : shares.map(share => ({ share, amount: null as number | null }));
  if (end.amount != null && Math.round(end.amount * 100) > shares[0].leftCents) {
    return { refundedCents: 0, error: `A refund to the card is at most ${formatLeagueMoney(shares[0].leftCents / 100)}.`, pending: false, refundIds: [] };
  }
  let refundedCents = 0;
  const refundIds: string[] = [];
  const said = (why: string) => (refundedCents > 0 ? `Refunded ${formatLeagueMoney(refundedCents / 100)} to the card, then: ${why} Open it again to finish.` : why);
  for (const { share, amount } of plan) {
    try {
      const r = await refundLeagueToCard({
        itemId: share.itemId, amount, feeIncluded: end.feeIncluded && share.untouched, reason,
        partialReason: amount != null ? end.partialReason : null, note: end.note, actorId,
      });
      if (r.state === 'failed') return { refundedCents, error: said(r.message ?? 'The refund didn’t go through, so nothing was changed. Try again.'), pending: false, refundIds };
      // In flight (Stripe unreachable) or unbooked: the act that follows waits — it would read money still received.
      if (!r.booked) return { refundedCents, error: said(r.message ?? 'The refund is on its way to the card. Finish once it shows on the row.'), pending: true, refundIds };
      refundedCents += r.amountCents;
      refundIds.push(r.refundId);
    } catch (e) {
      return { refundedCents, error: said(e instanceof Error ? e.message : 'The refund didn’t go through. Try again.'), pending: false, refundIds };
    }
  }
  return { refundedCents, error: null, pending: false, refundIds };
}

/** A refusal from the money writer or the ending, in the copy's words (§16). */
function moneyRefusal(
  refusal: LeagueMoneyRefusal,
  reg: { playerFirstName: string; playerLastName: string; feeAmount: number | null },
  season: { registrationFee: number | null },
  ending = false,
): Response {
  const name = `${reg.playerFirstName} ${reg.playerLastName}`;
  const amount = formatLeagueMoney(registrationOwes(reg, season) ?? 0);
  const words: Record<LeagueMoneyRefusal, [number, string]> = {
    ended: [409, MONEY_REFUSAL.ended(name)],
    not_accepted: [409, MONEY_REFUSAL.notAccepted(name)],
    already_received: [409, (registrationOwes(reg, season) ?? 0) > 0 ? MONEY_REFUSAL.alreadyReceived(name) : MONEY_REFUSAL.free(name)],
    amount: [400, MONEY_REFUSAL.amount],
    over: [409, MONEY_REFUSAL.changed],
    changed: [409, MONEY_REFUSAL.changed],
    nothing_received: [409, MONEY_REFUSAL.nothingToUndo(name)],
    refunded: [409, MONEY_REFUSAL.refundedUndo],
    card: [409, MONEY_REFUSAL.card],
    same: [400, MONEY_REFUSAL.priceSame],
    reason: [400, ending ? MONEY_REFUSAL.keptReason(amount) : MONEY_REFUSAL.priceReason],
    money: [409, MONEY_REFUSAL.money(amount)],
    date: [400, MONEY_REFUSAL.date],
    future: [400, ending ? MONEY_REFUSAL.futureRefund : MONEY_REFUSAL.futurePayment],
    method: [400, MONEY_REFUSAL.method],
    before_payment: [400, MONEY_REFUSAL.beforePayment],
  };
  const [status, error] = words[refusal];
  return NextResponse.json({ error, code: refusal }, { status });
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ seasonId: string; regId: string }> },) => {
  const orgSlug = new URL(_req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'read');
  if (err) return err;

  const { seasonId, regId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const reg = await fetchReg(regId, seasonId);
  if (!reg) return NextResponse.json({ error: 'Registration not found' }, { status: 404 });

  // 12b: the child's card shares still refundable (the ending window's "Refund to the card", the price correction's).
  const cardShares = await leagueCardShares(regId);
  // 12d-1 (ask 12): the family's open pay pages, for Mark received's notice (who opened it, for what, and when).
  const openPages = await openChildPayPages(regId);
  return NextResponse.json({ registration: reg, cardShares, openPages, today: tournamentToday() });
}, { route: '/api/admin/house-league/seasons/[seasonId]/registrations/[regId]' });

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string; regId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'read');
  if (err) return err;

  const { seasonId, regId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const reg = await fetchReg(regId, seasonId);
  if (!reg) return NextResponse.json({ error: 'Registration not found' }, { status: 404 });

  const body = await req.json();

  // ── the pay link (12b copy §5) ─────────────────────────────────────────────────
  // "Email the pay link": the desk (A13's house-league variant — whoever takes fees). One email for the sign-up's owing
  // children; refused, in words, when the club isn't taking card payments or nothing is owing.
  if (body.payLink === true) {
    if (!canMarkLeagueFeePaid(ctx!)) return forbidden();
    // 12d-1 Part 4: the bulk "Email families who owe" says so, and a family after a lost card dispute is left out.
    const sent = await sendLeaguePayLink(regId, null, null, { bulk: body.bulk === true });
    if ('error' in sent) return NextResponse.json({ error: sent.error, code: 'disputeLost' in sent ? 'dispute_lost' : 'pay_link' }, { status: 409 });
    const updated = await fetchReg(regId, seasonId);
    return NextResponse.json({ registration: updated, sentTo: sent.sentTo });
  }

  // ── a card payment that couldn't go on this registration (12b copy §7) ──────────
  // The Needs-attention item's door: back to the card in full, the processing fee with it when the club declined (A2).
  if (typeof body.refundCard === 'string') {
    if (!canMarkLeagueFeePaid(ctx!)) return forbidden();
    if (!onlinePaymentsOn()) return NextResponse.json({ error: 'Online payments aren’t available right now. Refund it in Stripe.', code: 'card_refund' }, { status: 409 });
    const stuck = (await unrecordedCardShares([regId]))[regId] ?? [];
    const share = stuck.find(x => x.itemId === body.refundCard);
    if (!share) return NextResponse.json({ error: 'That card payment is already refunded or recorded.', code: 'card_refund' }, { status: 409 });
    try {
      const r = await refundLeagueToCard({
        itemId: share.itemId, amount: null, feeIncluded: reg.status === 'declined',
        reason: reg.status === 'declined' ? 'club_ended' : 'family_left', partialReason: null, note: null, actorId: ctx!.user.id,
      });
      if (r.state === 'failed') return NextResponse.json({ error: r.message ?? 'The refund didn’t go through. Try again.', code: 'card_refund' }, { status: 409 });
      // 12c ruling 3/6: the family is told once Stripe accepted it (booked), in the club's name, with the refund block.
      if (r.booked) void sendLeagueRefundEmail([r.refundId], { kind: 'door' });
      const updated = await fetchReg(regId, seasonId);
      return NextResponse.json({ registration: updated, refundedCents: r.amountCents });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'The refund didn’t go through. Try again.', code: 'card_refund' }, { status: 409 });
    }
  }

  // ── a child still enrolled after a refund made in Stripe: what now? (12c words §5) ──
  // "Email the pay link" (the refund block, then Pay now) or "Keep {child} enrolled" (the refund email, "still registered and
  // owes …"). Withdraw is the ending below, carrying `stripeRefundIds`. The answer is kept on the refund and clears its notice.
  if (body.enrolledAnswer && typeof body.enrolledAnswer === 'object') {
    if (!canMarkLeagueFeePaid(ctx!)) return forbidden();
    const { refundId, answer } = body.enrolledAnswer as { refundId?: unknown; answer?: unknown };
    if (typeof refundId !== 'string' || (answer !== 'link' && answer !== 'keep')) return NextResponse.json({ error: MONEY_REFUSAL.changed, code: 'bad_answer' }, { status: 400 });
    const asked = await stillEnrolledRefund(regId, refundId);
    if (!asked) return NextResponse.json({ error: 'That refund is already answered.', code: 'answered' }, { status: 409 });
    const owing = formatLeagueMoney(asked.baseCents / 100);
    if (answer === 'link') {
      const block = await leagueRefundMail([refundId]);
      const sent = await sendLeaguePayLink(regId, null, block ? { child: `${reg.playerFirstName} ${reg.playerLastName}`, childFirst: reg.playerFirstName, owing, blockHtml: block.blockHtml } : null);
      if ('error' in sent) return NextResponse.json({ error: sent.error, code: 'pay_link' }, { status: 409 });
      await stampRefundEmailed([refundId], true);
    } else {
      await sendLeagueRefundEmail([refundId], { kind: 'keep', owing });
    }
    await answerStillEnrolled([refundId], answer, ctx!.user.id);
    await clearSettled({ orgIds: [ctx!.org.id], kinds: ['card_refund_still_enrolled'] });
    const updated = await fetchReg(regId, seasonId);
    return NextResponse.json({ registration: updated, sentTo: reg.guardianEmail });
  }

  // ── a card refund that came back, sent another way (12b copy §7) ────────────────
  if (typeof body.refundAnotherWay === 'string') {
    if (!canMarkLeagueFeePaid(ctx!)) return forbidden();
    const returned = (await returnedCardRefunds([regId]))[regId] ?? [];
    if (!returned.some(r => r.refundId === body.refundAnotherWay)) {
      return NextResponse.json({ error: 'That refund is already recorded.', code: 'card_refund' }, { status: 409 });
    }
    await resolveLeagueRefundAnotherWay(body.refundAnotherWay, ctx!.user.id);
    const updated = await fetchReg(regId, seasonId);
    return NextResponse.json({ registration: updated });
  }

  // ── money ────────────────────────────────────────────────────────────────────
  // ONE write, shared with the family record's Record a payment (Club Tier Stage 5c Part A; rebuilt 9b-2 — lib/league-fee-paid.ts):
  // received (a day and how), undo, a corrected price. The fiscal year's lock and the line live there. It stays open on a
  // finished season (Q16). An ending's money answer rides with its status (below); only a status-less body is a money press.
  let priceRefundNotice: (() => void) | null = null;
  if ('money' in body && !('status' in body)) {
    if (!canMarkLeagueFeePaid(ctx!)) return forbidden();
    const move: LeagueMoneyMove | null = readMoneyMove(body.money);
    if (!move) return NextResponse.json({ error: MONEY_REFUSAL.changed, code: 'bad_money' }, { status: 400 });
    // 12c Part 6 (words §3.2): a bank debit on its way is the payment; a stale window or a batch is told so.
    if (move.kind === 'receive' && await isRegClearing(regId)) {
      return NextResponse.json({ error: REGS_WORDS.payLink.clearingReceive(`${reg.playerFirstName} ${reg.playerLastName}`), code: 'clearing' }, { status: 409 });
    }
    // 12b (drawn b6): a lower price on a card-paid child refunds the difference to the card FIRST (so the correction
    // then finds nothing over the new price to refund by hand); a higher one emails the family a pay link for the rest.
    const cardPrice = move.kind === 'price' && (body.money as Record<string, unknown>).card === true;
    let cardRefunded: string | null = null;
    if (cardPrice && move.kind === 'price') {
      const received = receivedOf((await loadRegistrationMoneyLines([regId])).get(regId) ?? []);
      const diff = Math.round((received - move.price) * 100) / 100;
      if (diff > 0) {
        // The writer's own refusals, checked BEFORE the card is refunded (/review 2026-10-25): never money out for a
        // correction that is then refused.
        if (!move.reason?.trim()) return moneyRefusal('reason', reg, season);
        if (reg.status === 'declined' || reg.status === 'withdrawn') return moneyRefusal('ended', reg, season);
        if (move.price < 0) return moneyRefusal('amount', reg, season);
        if (move.price === registrationOwes(reg, season)) return moneyRefusal('same', reg, season);
        const refunded = await refundChildToCard(regId, ctx!.user.id, 'price_corrected', { amount: diff, feeIncluded: false, partialReason: move.reason, note: null });
        if (refunded.error) return NextResponse.json({ error: refunded.error, code: 'card_refund' }, { status: 409 });
        cardRefunded = formatLeagueMoney(diff);
        // Told only once the correction is written (below), with the refund block (12c words §4).
        const priceWords = { kind: 'price' as const, from: formatLeagueMoney(registrationOwes(reg, season) ?? received), to: formatLeagueMoney(move.price) };
        priceRefundNotice = () => void sendLeagueRefundEmail(refunded.refundIds, priceWords);
      }
    }
    const before = registrationOwes(reg, season);
    const wrote = await writeLeagueMoney(ctx!, { seasonId, regId }, move);
    if (cardRefunded && ('refused' in wrote || 'refusal' in wrote)) {
      return NextResponse.json({ error: `Refunded ${cardRefunded} to the card, but the price didn’t change. Open it again to finish.`, code: 'card_refund_then_changed' }, { status: 409 });
    }
    if ('refused' in wrote) return moveRefused(wrote.refused);
    if ('refusal' in wrote) return moneyRefusal(wrote.refusal, reg, season);
    priceRefundNotice?.();
    // 12d-1 (ask 12): marked received by hand, so the family's open pay pages close (they can't pay twice).
    const pagesClosed = move.kind === 'receive' ? await closeChildPayPages([regId], 'Mark received') : 0;
    // A raised price while the club takes card payments: the family is emailed a pay link for the difference (b6).
    if (cardPrice && move.kind === 'price' && before != null && move.price > before) {
      await sendLeaguePayLink(regId, {
        child: `${reg.playerFirstName} ${reg.playerLastName}`, from: formatLeagueMoney(before), to: formatLeagueMoney(move.price),
        diff: formatLeagueMoney(Math.round((move.price - before) * 100) / 100),
      }).catch(() => null);
    }
    const updated = await fetchReg(regId, seasonId);
    return NextResponse.json({ registration: updated, pagesClosed });
  }

  // ── adminNotes only ──────────────────────────────────────────────────────────
  if ('adminNotes' in body && !('status' in body) && !('divisionId' in body) && !('teamId' in body)) {
    const refused = houseLeagueRefusal(ctx, 'register', season);
    if (refused) return refused;
    await supabaseAdmin
      .from('league_registrations')
      .update({ admin_notes: body.adminNotes ?? null, updated_at: new Date().toISOString() })
      .eq('id', regId);
    const updated = await fetchReg(regId, seasonId);
    return NextResponse.json({ registration: updated });
  }

  // ── divisionId / teamId reassignment ────────────────────────────────────────
  if ('divisionId' in body || 'teamId' in body) {
    // Placing a player is running the league (divisions, teams), not working the desk: the registrar reads it (Q17).
    const refused = houseLeagueRefusal(ctx, 'run', season);
    if (refused) return refused;
    // Ownership: null clears; anything else must be this season's division / team (plan I01).
    if (body.divisionId != null && !(await divisionInSeason(seasonId, body.divisionId))) {
      return NextResponse.json({ error: 'Division not found' }, { status: 404 });
    }
    if (body.teamId != null && !(await teamsInSeason(seasonId, [body.teamId]))) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }
    // A new division is a placement (Part 3, mig 362): a child holding a spot needs one there, a waitlisted child joins
    // the end of the new line, and a spot freed in the old division goes to its first waiting child.
    let promotedId: string | null = null;
    let keptPrice = false;
    if ('divisionId' in body) {
      // "Use {division}'s price" (9b-2): the new division's price for the day this child signed up, worked out here, never
      // taken from the request. A child who has paid keeps theirs (the database refuses the change and says so).
      const price = body.reprice === true && body.divisionId ? await divisionPriceFor(body.divisionId, season, reg.registeredAt) : null;
      const moved = await changeLeagueDivision(ctx!.org.id, seasonId, regId, body.divisionId ?? null, season.autoPromoteWaitlist, price, ctx!.user.id);
      if ('refusal' in moved) {
        if (moved.refusal === 'full') {
          const { data: div } = await supabaseAdmin.from('league_divisions').select('name').eq('id', body.divisionId).single();
          return NextResponse.json({ error: `${div?.name ?? 'That division'} is full. Add to the waitlist instead.`, code: 'division_full' }, { status: 409 });
        }
        if (moved.refusal === 'no_division') {
          return NextResponse.json({ error: 'A waitlisted registration needs a division' }, { status: 422 });
        }
        return NextResponse.json({ error: 'Division not found' }, { status: 404 });
      }
      promotedId = moved.promotedId;
      keptPrice = moved.keptPrice;
    }
    if ('teamId' in body) {
      // 9c: a team changes only through the one placement function (mig 377), so a published division's move is held and
      // emailed on Teams & draft, never made silently here.
      const placed = await placePlayer(ctx!.org.id, seasonId, regId, body.teamId ?? null, false, ctx!.user.id);
      if ('refusal' in placed) {
        const words = placed.refusal === 'published'
          ? 'This division is published. Move players on Teams & draft, where the family is told.'
          : placed.refusal === 'not_accepted' ? 'Only an accepted player is put on a team.' : 'Team not found';
        return NextResponse.json({ error: words, code: placed.refusal }, { status: 409 });
      }
    }
    if (promotedId) emailPromoted(ctx!.org, season, seasonId, promotedId);
    const updated = await fetchReg(regId, seasonId);
    const promoted = promotedId ? await fetchReg(promotedId, seasonId) : null;
    return NextResponse.json({ registration: updated, ...(promoted ? { promoted } : {}), ...(keptPrice ? { keptPrice } : {}) });
  }

  // ── status change ────────────────────────────────────────────────────────────
  if (!('status' in body)) {
    return NextResponse.json({ error: 'No recognized fields to update' }, { status: 400 });
  }
  const statusRefused = houseLeagueRefusal(ctx, 'register', season);
  if (statusRefused) return statusRefused;

  const newStatus = body.status as LeagueRegistrationStatus;
  const VALID: LeagueRegistrationStatus[] = ['pending_review', 'active', 'waitlisted', 'declined', 'withdrawn'];
  if (!VALID.includes(newStatus)) {
    return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
  }

  const adminNotes = typeof body.adminNotes === 'string' ? body.adminNotes : undefined;
  const divisionId = reg.divisionId;

  // Helper for email params
  const emailBase = {
    playerFirstName: reg.playerFirstName,
    playerLastName:  reg.playerLastName,
    guardianFirstName: reg.guardianFirstName,
    seasonName:      season.name,
    divisionName:    '', // filled per-branch
    registrationId:  reg.id,
    reference:       reg.signupRef,
    statusPath:      `/${ctx!.org.slug}/league/${season.slug}/status`,
  };

  // The club's face (The public face, warm: S3b): read at most once for this request, worn by every email below. A face that
  // cannot be read is a plainer email, never a missed one.
  let faceRead: ReturnType<typeof systemMailFace> | null = null;
  const faceOnce = () => (faceRead ??= systemMailFace(ctx!.org));
  const familyOf = (face: Awaited<ReturnType<typeof systemMailFace>>, playerFirstName: string) =>
    face ? { face, reason: `${playerFirstName} was signed up for ${season.name}` } : undefined;

  // Resolve division name for emails
  let divisionName = 'your division';
  if (divisionId) {
    const { data: div } = await supabaseAdmin
      .from('league_divisions')
      .select('name')
      .eq('id', divisionId)
      .single();
    if (div) divisionName = div.name;
  }

  // ── → active / pending_review / waitlisted: one locked move (Part 3, mig 362) ───────────────────
  // Accepting a waitlisted child needs a free spot; staff are refused, never silently over-fill.
  if (newStatus === 'active' || newStatus === 'pending_review' || newStatus === 'waitlisted') {
    if (newStatus === 'waitlisted' && !divisionId) {
      return NextResponse.json({ error: 'Cannot waitlist a registration with no division' }, { status: 422 });
    }
    // With the season's auto-promote, a child who held a spot going to the waitlist frees it for the first child waiting.
    const result = await moveLeagueRegistration(ctx!.org.id, seasonId, regId, newStatus, adminNotes ?? null, season.autoPromoteWaitlist);
    if ('refusal' in result) {
      if (result.refusal === 'full') {
        return NextResponse.json({ error: `${divisionName} is full. Add to the waitlist instead.`, code: 'division_full' }, { status: 409 });
      }
      if (result.refusal === 'duplicate') {
        return NextResponse.json({ error: `${reg.playerFirstName} ${reg.playerLastName} already has a registration this season.`, code: 'duplicate' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Cannot waitlist a registration with no division' }, { status: 422 });
    }
    // One email per real change, decided under the lock (a double-click on Accept sends one).
    const changed = result.moved.changed;
    if (result.moved.promotedId) emailPromoted(ctx!.org, season, seasonId, result.moved.promotedId);

    if (changed && newStatus === 'active') {
      void (async () => {
        try {
          // 12b: Pay now by card while the club takes card payments.
          const [face, online] = await Promise.all([faceOnce(), leagueMailPay(regId)]);
          await sendTransactionalEmail({
            key: 'league_registration_approved',
            to: reg.guardianEmail,
            vars: {
              guardianFirstName: reg.guardianFirstName,
              playerFirstName:   reg.playerFirstName,
              playerLastName:    reg.playerLastName,
              seasonName:        season.name,
              divisionName,
            },
            // The family reads "accepted" (9b·12); the email now states the price and how to pay.
            defaultSubject: `${reg.playerFirstName} is accepted — ${season.name}`,
            defaultHtml: leagueAdminApprovedHtml({
              ...emailBase, divisionName, face,
              fee: registrationOwes(reg, season), howToPay: season.howToPay, clubName: ctx!.org.name, online,
            }),
            family: familyOf(face, reg.playerFirstName),
          });
        } catch (e) { console.error('[email] leagueAdminApprovedHtml failed', e); }
      })();
    }

    if (changed && newStatus === 'waitlisted') {
      const newPos = result.moved.waitlistPosition!;
      void (async () => {
        try {
          const face = await faceOnce();
          await sendTransactionalEmail({
            key: 'league_registration_waitlisted',
            to: reg.guardianEmail,
            vars: {
              guardianFirstName: reg.guardianFirstName,
              playerFirstName:   reg.playerFirstName,
              playerLastName:    reg.playerLastName,
              seasonName:        season.name,
              divisionName,
              waitlistPosition:  newPos,
            },
            defaultSubject: `${reg.playerFirstName} is on the waitlist — ${season.name}`,
            defaultHtml: leagueAdminWaitlistedHtml({ ...emailBase, divisionName, waitlistPosition: newPos, face }),
            family: familyOf(face, reg.playerFirstName),
          });
        } catch (e) { console.error('[email] leagueAdminWaitlistedHtml failed', e); }
      })();
    }

    const updated = await fetchReg(regId, seasonId);
    const promoted = result.moved.promotedId ? await fetchReg(result.moved.promotedId, seasonId) : null;
    return NextResponse.json(promoted ? { registration: updated, promoted } : { registration: updated });
  }

  // ── → declined / withdrawn / the spot released ──────────────────────────────────
  // One locked step (mig 368): when money was received the window's answer is required — refunded (its own line out,
  // beside the payment) or kept with a reason — then the registration ends, its waitlist gap closes and, when it held a spot
  // and the season auto-promotes, that spot goes to the first child waiting. Nothing is voided (Q6). A refund is money,
  // so it needs the fee right as well as the desk's.
  if (newStatus === 'declined' || newStatus === 'withdrawn') {
    const released = newStatus === 'withdrawn' && body.released === true;
    // 12b: Refund to the card (all, or part with a reason): Stripe and the book first, as one act; the ending then reads
    // what is left — nothing, or the part the club keeps (with the partial refund's reason).
    const cardEnd = readCardEnd(body.money);
    let cardMail: EndedMoneyLine | null = null;
    let cardRefundIds: string[] = [];
    let cardRefundedCents = 0;
    // 12c: "Withdraw {child}" from a refund made in Stripe — the ending's email carries that refund's block (one email).
    const stripeAsked = Array.isArray(body.stripeRefundIds)
      ? (await Promise.all((body.stripeRefundIds as unknown[]).filter((x): x is string => typeof x === 'string').map(id => stillEnrolledRefund(regId, id))))
        .filter((x): x is NonNullable<typeof x> => !!x)
      : [];
    if (cardEnd) {
      if (!canMarkLeagueFeePaid(ctx!)) return forbidden();
      const refunded = await refundChildToCard(regId, ctx!.user.id, newStatus === 'declined' ? 'club_ended' : 'family_left', cardEnd);
      // Any refusal, in flight or part-done: the ending waits, and the window says what already went back.
      if (refunded.error) return NextResponse.json({ error: refunded.error, code: refunded.pending ? 'card_refund_pending' : 'card_refund' }, { status: 409 });
      cardRefundedCents = refunded.refundedCents;
      const left = receivedOf((await loadRegistrationMoneyLines([regId])).get(regId) ?? []);
      body.money = left > 0 ? { answer: 'kept', reason: cardEnd.partialReason ?? 'Kept by the club' } : null;
      // 12c words §4: the ending email says "We refunded your payment." with the refund block — the refund's own date and
      // reference, never "the $X you paid on {today}" (F3) — and what the club keeps of the rest.
      const block = await leagueEndingRefundHtml(refunded.refundIds, left > 0 ? { cents: Math.round(left * 100), reason: cardEnd.partialReason ?? 'Kept by the club' } : null)
        .catch(() => null);
      cardRefundIds = block?.refundIds ?? [];
      cardMail = block ? { answer: 'card', html: block.html } : { answer: 'refunded', amount: refunded.refundedCents / 100, day: tournamentToday(), method: 'online_card' };
    }
    const money = readEndMoney(body.money);
    if (money === null) return NextResponse.json({ error: MONEY_REFUSAL.changed, code: 'bad_money' }, { status: 400 });
    if (money?.answer === 'refunded' && !canMarkLeagueFeePaid(ctx!)) return forbidden();
    const familyNote = newStatus === 'withdrawn' && !released ? null : text(body.familyNote, 2000);
    // 12c Part 6 (words §3.3): a bank debit still clearing — nothing is in the book yet, so the window's answer is stored
    // and carried out when it clears. Sending it back is money: the fee right, and payouts still connected (§7.7).
    const clearDebit = (await loadRegistrationDebits(ctx!.org.id, [regId]))[regId];
    const clearAsk = clearDebit?.state === 'clearing' ? readClearAnswer(body.clear) : null;
    if (clearDebit?.state === 'clearing') {
      if (!clearAsk) return NextResponse.json({ error: END_WORDS.clear.footChoose(formatLeagueMoney(clearDebit.shareCents / 100)), code: 'clear_choice' }, { status: 409 });
      if (clearAsk.choice === 'send_back') {
        if (!canMarkLeagueFeePaid(ctx!)) return forbidden();
        if (!(await clubTakesCards(ctx!.org))) return NextResponse.json({ error: END_WORDS.clear.disconnected, code: 'clear_disconnected' }, { status: 409 });
      }
    }
    // 12c Part 6 (review of the whole): the answer for the clearing debit is stored FIRST — a debit that lands in between
    // then finds it — and taken back if the ending is refused, so the family is never emailed an answer that isn't stored.
    let decisionId: string | null = null;
    if (clearDebit && clearAsk) {
      const { data: stored, error: decisionError } = await supabaseAdmin.from('online_payment_clear_decisions').insert({
        org_id: ctx!.org.id, online_payment_id: clearDebit.onlinePaymentId, online_payment_item_id: clearDebit.itemId,
        choice: clearAsk.choice, fee_back: clearAsk.feeBack, reason: clearAsk.reason, decided_by: ctx!.user.id,
      }).select('id').maybeSingle();
      if (decisionError) return NextResponse.json({ error: 'Couldn’t save what happens when the debit clears. Try again.', code: 'clear_save' }, { status: 500 });
      decisionId = (stored?.id as string | undefined) ?? null;
    }
    const ended = await endLeagueRegistration(ctx!, { seasonId, regId }, {
      status: newStatus, notes: adminNotes ?? null, promote: season.autoPromoteWaitlist, released, money: money ?? null,
    });
    if (decisionId && ('refused' in ended || 'refusal' in ended)) {
      await supabaseAdmin.from('online_payment_clear_decisions').delete().eq('id', decisionId).is('outcome', null);
    }
    if (cardMail && ('refused' in ended || 'refusal' in ended)) {
      return NextResponse.json({
        error: `Refunded ${formatLeagueMoney(cardRefundedCents / 100)} to the card, but the registration changed meanwhile and didn’t end. Open it again to finish.`,
        code: 'card_refund_then_changed',
      }, { status: 409 });
    }
    if ('refused' in ended) return moveRefused(ended.refused);
    if ('refusal' in ended) return moneyRefusal(ended.refusal, reg, season, true);
    // A family's ask to withdraw this child is answered: its Needs-attention notice clears now (it also clears on read).
    await clearSettled({ orgIds: [ctx!.org.id], kinds: ['house_league_withdraw_request'] });

    // What the family is told about their money: the refund line just written, or the fee the club keeps.
    let mailMoney: EndedMoneyLine | null = cardMail;
    if (clearDebit && clearAsk) {
      mailMoney = clearAsk.choice === 'send_back'
        ? { answer: 'clearBack', total: clearDebit.totalCents / 100, back: (clearDebit.shareCents + (clearAsk.feeBack ? clearDebit.feeShareCents : 0)) / 100 }
        : { answer: 'clearKept', base: clearDebit.shareCents / 100, reason: clearAsk.reason ?? '', club: ctx!.org.name };
    }
    if (money && !cardMail) {
      const lines = (await loadRegistrationMoneyLines([regId])).get(regId) ?? [];
      const refund = ended.refundEntryId ? lines.find(l => l.id === ended.refundEntryId) : null;
      if (refund) mailMoney = { answer: 'refunded', amount: refund.amount, day: refund.day, method: refund.method };
      else if (money.answer === 'kept' && receivedOf(lines) > 0) mailMoney = { answer: 'kept', amount: receivedOf(lines), reason: money.reason };
    }
    if (!cardMail && stripeAsked.length) {
      const lines = (await loadRegistrationMoneyLines([regId])).get(regId) ?? [];
      const keptCents = money?.answer === 'kept' ? Math.round(receivedOf(lines) * 100) : 0;
      const block = await leagueEndingRefundHtml(stripeAsked.map(a => a.id), keptCents > 0 && money?.answer === 'kept' ? { cents: keptCents, reason: money.reason } : null).catch(() => null);
      if (block) { mailMoney = { answer: 'card', html: block.html }; cardRefundIds = block.refundIds; }
      await answerStillEnrolled(stripeAsked.map(a => a.id), 'withdraw', ctx!.user.id);
    }

    // Decline and Release always tell the family; a Withdraw only when money moved (owner 2026-10-25, plan §0e).
    if (newStatus === 'declined' || released || mailMoney) {
      void (async () => {
        try {
          const face = await faceOnce();
          const mail: { key: Extract<EmailKind, 'league_spot_released' | 'league_registration_declined' | 'league_registration_withdrawn'>; subject: string; html: string } = released
            ? {
              key: 'league_spot_released',
              subject: `${possessive(reg.playerFirstName)} spot was released — ${season.name}`,
              html: leagueSpotReleasedHtml({ ...emailBase, divisionName, face, fee: registrationOwes(reg, season), note: familyNote, money: mailMoney }),
            }
            : newStatus === 'declined'
              ? {
                key: 'league_registration_declined',
                subject: `Registration update — ${season.name}`,
                html: leagueRegistrationDeclinedHtml({ ...emailBase, divisionName, face, note: familyNote, money: mailMoney }),
              }
              : {
                key: 'league_registration_withdrawn',
                subject: `Registration update — ${season.name}`,
                html: leagueRegistrationWithdrawnHtml({ ...emailBase, divisionName, face, money: mailMoney! }),
              };
          await sendTransactionalEmail({
            key: mail.key,
            to: reg.guardianEmail,
            vars: {
              guardianFirstName: reg.guardianFirstName,
              playerFirstName:   reg.playerFirstName,
              playerLastName:    reg.playerLastName,
              seasonName:        season.name,
              divisionName,
            },
            defaultSubject: mail.subject,
            defaultHtml: mail.html,
            family: familyOf(face, reg.playerFirstName),
          });
          // The record's "Family emailed" for the card refund this email carried.
          await stampRefundEmailed(cardRefundIds, true);
        } catch (e) {
          console.error('[email] house-league ending email failed', e);
          await stampRefundEmailed(cardRefundIds, false).catch(() => null);
        }
      })();
    }

    const updated = await fetchReg(regId, seasonId);
    if (ended.promotedId) emailPromoted(ctx!.org, season, seasonId, ended.promotedId);
    const promoted = ended.promotedId ? await fetchReg(ended.promotedId, seasonId) : null;
    return NextResponse.json(promoted ? { registration: updated, promoted } : { registration: updated });
  }
  return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
}, { route: '/api/admin/house-league/seasons/[seasonId]/registrations/[regId]' });
