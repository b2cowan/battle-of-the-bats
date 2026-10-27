'use client';
/**
 * THE DISPUTE BLOCK (Club Tier Stage 12d-1 Part 3; words docs/projects/active/CLUB_TIER_STAGE12D_COPY.md §1.2). One block,
 * both flows: under a house-league record's Fee facts and under a team's payment rows. Everyone who opens the record reads
 * it. Amber and "Answer in Stripe" are the answerer's alone (the person who set up payouts, the only one who can sign in
 * to Stripe) and absent for anyone else; "Copy the facts" for whoever refunds in that flow and the owner. The treasurer
 * reads the facts with no button. Nothing is ever submitted from here (ask 13).
 *
 * "Copy the facts" is ONE labelled button in a desk window and on a phone alike: the words rule it a labelled act, not a
 * reference, so the symbol-alone rule for Copy in a small window does not apply (§1.2, `dispute.button.copy`). The Stripe
 * reference keeps that rule.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Copy } from 'lucide-react';
import { Facts } from './money/MoneyKit';
import { RepChip } from './RepKit';
import { disputeChip, disputeOutcome, isInquiry, type DisputeRecord } from '@/lib/online-payment-dispute';
import { DISPUTE_WORDS as D, PAYOUTS_WORDS, STRIPE_FEE_WORDS, disputeDue, disputeWhyFull, money } from '@/lib/online-payment-words';
import { CARD_REFUND_WORDS } from '@/lib/house-league-money-words';
import { formatStoredDate } from '@/lib/timezone';
import { childList } from '@/lib/league-pay-words';
import css from './DisputeBlock.module.css';

const R = CARD_REFUND_WORDS.record;
const day = (v: string | null | undefined) => (v ? formatStoredDate(v, { withYear: false }) : '—');

/** The block shows while a dispute is open, after a win, and after a loss; a closed inquiry or a prevented dispute moved no
 *  money and shows nothing. */
export const disputeShows = (d: Pick<DisputeRecord, 'status'> | null | undefined): d is DisputeRecord =>
  !!d && (disputeOutcome(d.status) === 'open' || d.status === 'won' || d.status === 'lost');

function useTransient(): [string | null, (s: string) => void] {
  const [said, setSaid] = useState<string | null>(null);
  useEffect(() => {
    if (!said) return;
    const t = window.setTimeout(() => setSaid(null), 2000);
    return () => window.clearTimeout(t);
  }, [said]);
  return [said, setSaid];
}

/** Stripe's reference and its Copy (the house-league record's own shape): the word on a desk, the symbol on a phone. */
function Reference({ value, isPhone }: { value: string; isPhone: boolean }) {
  const [said, setSaid] = useTransient();
  const ref = useRef<HTMLSpanElement>(null);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setSaid('copied'); } catch {
      const node = ref.current; const sel = window.getSelection();
      if (node && sel) { const range = document.createRange(); range.selectNodeContents(node); sel.removeAllRanges(); sel.addRange(range); }
      setSaid('failed');
    }
  }
  return (
    <span className={css.refLine}>
      <span ref={ref} className={css.refValue}>{value}</span>
      {isPhone
        ? <button type="button" className={css.refCopyIcon} aria-label={R.copyAria} onClick={copy}><Copy size={18} aria-hidden /></button>
        : <button type="button" className={css.refCopy} onClick={copy}>{said === 'copied' ? R.copied : R.copy}</button>}
      {isPhone && said === 'copied' && <span className={css.said} role="status">{R.copied}</span>}
      {said === 'failed' && <span className={css.said} role="status">{isPhone ? R.copyFailed : R.copyFailedDesk}</span>}
    </span>
  );
}

export default function DisputeBlock({ d, orgSlug, team, isPhone = false }: {
  d: DisputeRecord; orgSlug: string; team: boolean; isPhone?: boolean;
}) {
  const [opening, setOpening] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const [copied, setCopied] = useTransient();
  const outcome = disputeOutcome(d.status);
  const inquiry = isInquiry(d.status);
  const pastDue = disputeChip(d) === 'notAnswered';
  const amber = d.youAnswer;

  async function answer() {
    setOpening(true);
    setOpenFailed(false);
    try {
      // org-slug-ok: sent in the body
      const res = await fetch('/api/admin/payouts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgSlug, action: 'dashboard' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || typeof json.url !== 'string') throw new Error('not opened');
      window.location.assign(json.url);
    } catch {
      setOpening(false);
      setOpenFailed(true);
    }
  }

  async function copyFacts() {
    try { await navigator.clipboard.writeText(d.factsText); setCopied('copied'); } catch { setCopied('failed'); }
  }

  if (outcome === 'won') {
    return (
      <section className={css.block} aria-label={D.headingWon}>
        <h4 className={css.head}><span>{D.headingWon}</span></h4>
        <p className={css.line}>{D.won(day(d.wonBackAt ?? d.closedAt))}</p>
        {d.paidAgain.map(n => <p key={n} className={css.line}>{D.againAfterOther(n)}</p>)}
      </section>
    );
  }
  if (outcome === 'lost') {
    return (
      <section className={css.block} aria-label={D.headingLost}>
        <h4 className={css.head}>
          <span>{D.headingLost}</span>
          {d.lostBookedAt && <RepChip tone="warn">{D.pillOwingAgain}</RepChip>}
        </h4>
        {d.lostBookedAt && <p className={css.line}>{D.lostLine(day(d.lostBookedAt), String(d.receiptNo ?? ''), d.book, d.owesAgain)}</p>}
      </section>
    );
  }

  const why = disputeWhyFull(d.reason).replace(/^: /, '');
  const rows: Array<readonly [string, ReactNode] | null> = [
    [D.opened, day(d.openedAt)],
    why ? [D.why, why.charAt(0).toUpperCase() + why.slice(1)] : null,
    [D.held, inquiry ? D.heldNone : D.heldValue(money(d.held > 0 ? d.held : d.amount))],
    d.answered
      ? [D.answeredLabel, day(d.answeredAt)]
      : d.dueBy ? [pastDue ? D.wasDueLabel : D.answerByLabel, disputeDue(d.dueBy, { clock: true })] : null,
    d.showFee && d.feePaidFrom === 'club' && d.stripeFee != null ? [D.fee, D.feeFromClub(money(d.stripeFee))] : null,
    // 12d-1 Part 4 (ruling 5): a fee Stripe charged FieldLogicHQ is billed to the club, on the invoice that carries it.
    d.showFee && d.feePaidFrom === 'platform' && d.stripeFee != null
      ? [D.fee, d.feeWhere === 'next' ? STRIPE_FEE_WORDS.disputeFeeNext(money(d.stripeFee)) : STRIPE_FEE_WORDS.disputeFeeOwn(money(d.stripeFee))]
      : null,
    [D.ref, <Reference key="ref" value={d.stripeDisputeId} isPhone={isPhone} />],
  ];
  const heading = inquiry ? D.headingInquiry : D.heading;
  return (
    <section className={`${css.block}${amber ? ` ${css.amber}` : ''}`} aria-label={heading}>
      <h4 className={css.head}>
        <span>{heading}</span>
        {!d.answered && !pastDue && d.dueBy && <RepChip tone={amber ? 'warn' : 'info'}>{D.pillAnswerBy(disputeDue(d.dueBy))}</RepChip>}
      </h4>
      <Facts rows={rows} />
      {d.refundedOn && <p className={css.line}>{D.refunded(day(d.refundedOn))}</p>}
      {d.children.length > 1 && <p className={css.line}>{D.siblings(childList(d.children))}</p>}
      {(d.youAnswer || d.canCopy) && (
        <div className={css.buttons}>
          {d.youAnswer && (
            <button type="button" className="btn btn-primary" onClick={() => void answer()} disabled={opening}>
              {opening ? PAYOUTS_WORDS.opening : D.answer}
            </button>
          )}
          {d.canCopy && (
            <button type="button" className="btn btn-secondary" onClick={() => void copyFacts()} aria-label={D.copyAria}>
              {copied === 'copied' ? D.copied : D.copy}
            </button>
          )}
        </div>
      )}
      {openFailed && <p className={css.err} role="alert">{D.openFailed}</p>}
      {copied === 'failed' && <p className={css.said} role="status">{isPhone ? R.copyFailed : R.copyFailedDesk}</p>}
      {d.canCopy && d.factsList && <p className={css.lead}>{D.factsLead(d.factsList)}</p>}
      {!d.youAnswer && <p className={css.lead}>{D.onlyAnswerer(d.answererName, d.openedEmailedAt ? day(d.openedEmailedAt) : null, team)}</p>}
      {d.canCopy && !inquiry && <p className={css.lead}>{D.noRefund(team)}</p>}
    </section>
  );
}
