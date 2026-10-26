'use client';
/**
 * THE "TO THE CARD" BLOCK (Club Tier Stage 12c Part 2; words docs/projects/active/CLUB_TIER_STAGE12C_REFUND_VISIBLE_COPY.md
 * §2). One block per card refund under the record's Fee facts, newest first: the amount and how it splits, who refunded it
 * and when, where it stands (reached the card · pending · came back), Stripe's reference with Copy, the payment it came
 * from, and the family's email. Everyone who can open the record reads it; only the desk (owner, club admin, league admin,
 * registrar — `canDesk`) gets the button on a refund the card sent back (§0f: the treasurer never refunds).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Copy } from 'lucide-react';
import { Facts } from '../../money/MoneyKit';
import { RepChip } from '../../RepKit';
import { CARD_REFUND_WORDS } from '@/lib/house-league-money-words';
import { formatLeagueMoney } from '@/lib/league-money';
import { awaitsAnswer, clockOf, isBank, refundBase, refundState, refundTarget, type CardRefund } from '@/lib/league-card-refunds';
import { endedKind, regDay } from '@/lib/house-league-registrations';
import { leagueUnrecordedWhy } from '@/lib/online-payment-words';
import { possessive } from '@/lib/utils';
import type { LeagueRegistration } from '@/lib/types';
import css from './Registrations.module.css';

const W = CARD_REFUND_WORDS.record;

/** Stripe's reference and its Copy: the word on a desk, the symbol alone (44px) on a phone. Copied fades; a refused copy
 *  selects the reference so a long press (or Ctrl+C) still takes it. */
function Reference({ value, isPhone }: { value: string; isPhone: boolean }) {
  const [said, setSaid] = useState<'copied' | 'failed' | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (said !== 'copied') return;
    const t = window.setTimeout(() => setSaid(null), 2000);
    return () => window.clearTimeout(t);
  }, [said]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setSaid('copied');
    } catch {
      const node = ref.current;
      const sel = window.getSelection();
      if (node && sel) { const range = document.createRange(); range.selectNodeContents(node); sel.removeAllRanges(); sel.addRange(range); }
      setSaid('failed');
    }
  }
  return (
    <span className={css.refLine}>
      <span ref={ref} className={css.refValue}>{value}</span>
      {isPhone
        ? <button type="button" className={css.refCopyIcon} aria-label={W.copyAria} onClick={copy}><Copy size={18} aria-hidden /></button>
        : <button type="button" className={css.refCopy} onClick={copy}>{said === 'copied' ? W.copied : W.copy}</button>}
      {isPhone && said === 'copied' && <span className={css.refSaid} role="status">{W.copied}</span>}
      {said === 'failed' && <span className={css.refSaid} role="status">{isPhone ? W.copyFailed : W.copyFailedDesk}</span>}
    </span>
  );
}

const withSub = (value: ReactNode, sub: string | null): ReactNode =>
  (sub ? <>{value}<span className={css.factSub}>{sub}</span></> : value);

export default function CardRefundBlock({
  refunds, reg, childName, kept, today, isPhone, canDesk, focus, onAnotherWay,
}: {
  /** This child's card refunds that happened, newest first. */
  refunds: readonly CardRefund[];
  reg: LeagueRegistration;
  childName: string;
  /** What the club kept on an ending that refunded part (the record's Fee state). */
  kept: number | null;
  today: string;
  isPhone: boolean;
  canDesk: boolean;
  /** Opened from a notice about a refund the card sent back: the first block scrolls into view. */
  focus: boolean;
  onAnotherWay: (refundId: string) => void;
}) {
  const first = useRef<HTMLElement>(null);
  useEffect(() => { if (focus) first.current?.scrollIntoView({ block: 'nearest' }); }, [focus]);
  const money = formatLeagueMoney;
  const day = (iso: string | null | undefined) => regDay(iso ?? null, today);
  const email = reg.guardianEmail.trim();

  return (
    <>
      {refunds.map((r, i) => {
        const s = refundState(r);
        const bank = isBank(r);
        const base = refundBase(r);
        const part = r.feeBack === 0 && base < r.share;
        const stripe = r.origin === 'stripe_dashboard';
        const feeRow = r.familyPaidFee && r.shareFee > 0 ? (() => {
          const why = r.feeBack > 0
            ? (stripe ? W.feeWhy.whole : r.reason === 'club_ended' ? W.feeWhy.declined : W.feeWhy.included)
            : (r.reason === 'family_left' && !part ? W.feeWhy.keptAsked : W.feeWhy.keptPart);
          return [W.fee, withSub(why, r.feeBack > 0 && !isPhone ? W.feeBook : null)] as const;
        })() : null;
        const amountSub = stripe && r.feeBack > 0 ? W.amountWhole
          : r.feeBack > 0 ? W.amountSplit(money(base), money(r.feeBack))
            : part ? W.amountPart(money(r.share)) : null;
        const ended = reg.status === 'declined' || reg.status === 'withdrawn';
        const paid = r.paidAt ?? r.createdAt;
        const why = !r.inBook && !r.entryId ? (
          r.landError === 'ended' && ended && reg.endedAt
            ? (endedKind(reg) === 'released'
              ? W.whyReleased(day(paid), clockOf(paid), possessive(childName), clockOf(reg.endedAt))
              : W.whyEnded(day(paid), clockOf(paid), reg.status === 'declined' ? 'declined' : 'withdrew', childName, clockOf(reg.endedAt)))
            : W.whyOther(day(paid), clockOf(paid), leagueUnrecordedWhy(r.landError ?? ''), bank)
        ) : null;
        const emailed = awaitsAnswer(r) && !r.emailedAt ? W.emailedWaits
          : s === 'failed' ? W.emailedNotFailed
          : s === 'anotherWay' ? W.emailedAnotherWay
            : r.emailedAt ? W.emailedSent(email || '—', day(r.emailedAt))
              : r.emailFailedAt ? W.emailedFailed(day(r.emailFailedAt))
                : !email ? W.emailedNone : null;

        const rows = [
          [W.amount, s === 'anotherWay'
            ? W.anotherAmount(money(r.amount), r.resolvedBy ?? '—', day(r.succeededAt))
            : withSub(W.amountValue(money(r.amount), refundTarget(r)), amountSub)] as const,
          feeRow,
          s === 'anotherWay' ? [W.before, W.beforeFailed(r.reference ?? '—', day(r.failedAt))] as const : null,
          stripe
            ? [W.by, withSub(W.byStripe(day(r.createdAt), clockOf(r.createdAt)), W.byStripeSub(clockOf(r.createdAt)))] as const
            : [W.by, W.byValue(r.by ?? '—', day(r.createdAt), clockOf(r.createdAt))] as const,
          s === 'refunded' && r.succeededAt
            ? [W.reached(bank), withSub(W.reachedValue(day(r.succeededAt), clockOf(r.succeededAt)), W.reachedSub(bank))] as const : null,
          s === 'pending' ? [W.status, W.statusValue(day(r.createdAt), clockOf(r.createdAt), bank)] as const : null,
          s === 'failed' ? [W.what, W.whatValue(day(r.createdAt), day(r.failedAt), bank)] as const : null,
          r.reference && s !== 'anotherWay' ? [W.ref, <Reference key="ref" value={r.reference} isPhone={isPhone} />] as const : null,
          [W.paidWith, W.paidWithValue(r.receiptNo, day(r.paidAt))] as const,
          r.partialReason ? [W.reason, r.partialReason] as const : null,
          i === 0 && kept != null && kept > 0 ? [W.kept, money(kept)] as const : null,
          stripe && reg.endMoney === 'kept' ? [W.before, W.beforeKept(reg.endMoneyReason ?? '')] as const : null,
          why ? [W.why, why] as const : null,
          why && !isPhone ? [W.book, W.bookValue(r.feeBack > 0 ? money(r.feeBack) : null)] as const : null,
          emailed ? [W.emailed, emailed] as const : null,
        ];
        return (
          <section key={r.id} ref={i === 0 ? first : undefined} className={css.cardRefund} aria-label={s === 'anotherWay' ? W.headingAnother : W.heading(bank)}>
            <h4 className={css.cardRefundHead}>
              <span>{s === 'anotherWay' ? W.headingAnother : W.heading(bank)}</span>
              <RepChip tone={s === 'failed' ? 'warn' : s === 'pending' ? 'info' : 'good'}>
                {s === 'failed' ? W.pill.failed(bank) : s === 'pending' ? W.pill.pending : W.pill.refunded}
              </RepChip>
              {stripe && <RepChip>{W.tagStripe}</RepChip>}
            </h4>
            <Facts rows={rows} />
            {s === 'failed' && canDesk && (
              <button type="button" className={`btn btn-secondary ${css.cardRefundButton}`} onClick={() => onAnotherWay(r.id)}>{W.button}</button>
            )}
          </section>
        );
      })}
    </>
  );
}
