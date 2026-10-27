'use client';
/**
 * MARK RECEIVED (Club Tier Stage 9b-2, Part 3; copy §3): one registration, or the ticked ones. The kit's form window,
 * medium. ⚖ THE AMOUNT IS SHOWN, NEVER TYPED (plan §0e): Mark received always records the whole balance still owing, so
 * the window asks only for the Date received (today, never after) and How (the product's one method list, empty = Not
 * recorded). A batch is one date and one way for all of them; the screen loops the single-row press, in order, and says
 * the result. A closed fiscal year refuses the batch whole on its first line — every line is dated the same — and nothing
 * was recorded (§2.2).
 */
import { useEffect, useState } from 'react';
import KitDialog, { DialogCancel } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { repKit } from '../../RepKit';
import { DayField, FormError, MethodField, moneyKit } from '../../money/MoneyKit';
import { BULK_WORDS, RECV_WORDS } from '@/lib/house-league-money-words';
import { formatLeagueMoney } from '@/lib/league-money';
import { PAY_OPEN_WORDS, money } from '@/lib/online-payment-words';
import type { OpenPayPage } from '@/lib/online-pay-pages';
import { receiveDayError, regDay, type Refusal } from '@/lib/house-league-registrations';
import type { DuesPaymentMethod, LeagueRegistration } from '@/lib/types';
import { patchRegistration } from './api';

/** One registration to receive on: what it owes, and (after a part payment) what came in already. */
export interface ReceiveTarget {
  reg: LeagueRegistration;
  name: string;
  division: string;
  /** The balance still owing: the amount this press records. */
  owing: number;
  price: number;
  received: number;
  lastDay: string | null;
}

export interface ReceiveOutcome {
  done: string[];
  refused: { id: string; refusal: Refusal }[];
  /** 12d-1: one child received, and its family's open pay page closed — the screen says this instead (words §2.1). */
  said?: string;
}

export default function ReceiveWindow({
  seasonName, targets, today, orgQuery, seasonId, raised, onClose, onChanged, onDone,
}: {
  seasonName: string;
  targets: readonly ReceiveTarget[];
  /** The club's day. */
  today: string;
  orgQuery: string;
  seasonId: string;
  raised: boolean;
  onClose: () => void;
  /** The money moved under the window (a refusal that says so): read again behind it. */
  onChanged: () => void;
  onDone: (outcome: ReceiveOutcome) => void;
}) {
  const [day, setDay] = useState(today);
  const [method, setMethod] = useState<DuesPaymentMethod | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // 12d-1 (ask 12): a pay page the family left open — read for one child (the drawn window); a batch still closes them.
  const [open, setOpen] = useState<{ pages: OpenPayPage[]; today: string } | null>(null);
  const soleId = targets.length === 1 ? targets[0]?.reg.id ?? null : null;
  useEffect(() => {
    if (!soleId) return;
    let live = true;
    fetch(`/api/admin/house-league/seasons/${seasonId}/registrations/${soleId}${orgQuery}`, { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (live && d && Array.isArray(d.openPages)) setOpen({ pages: d.openPages as OpenPayPage[], today: String(d.today ?? today) }); })
      .catch(() => null);
    return () => { live = false; };
  }, [soleId, seasonId, orgQuery, today]);

  const many = targets.length > 1;
  const one = targets[0];
  // The screen hands over the targets it opened on, so a read-again never empties this list; if one ever did, draw nothing.
  if (!one) return null;
  const total = targets.reduce((n, t) => n + Math.round(t.owing * 100), 0) / 100;

  async function go() {
    if (busy) return;
    const dayError = receiveDayError(day, today);
    if (dayError) { setError(dayError); return; }
    setBusy(true); setError('');
    const out: ReceiveOutcome = { done: [], refused: [] };
    for (const t of targets) {
      const r = await patchRegistration(orgQuery, seasonId, t.reg.id, { money: { kind: 'receive', day, method: method || null } });
      if (r.ok) {
        out.done.push(t.reg.id);
        if (!many && (r.pagesClosed ?? 0) > 0) out.said = PAY_OPEN_WORDS.doneToast(formatLeagueMoney(t.owing), t.name, (r.pagesClosed ?? 0) > 1);
        continue;
      }
      // A closed fiscal year refuses every line the same way: stop at the first, and say nothing was recorded.
      if (r.code === 'year_closed' && out.done.length === 0) {
        setError(many ? BULK_WORDS.closedBatch(r.error) : r.error);
        setBusy(false);
        return;
      }
      if (!many) { setError(r.error); setBusy(false); onChanged(); return; }
      out.refused.push({ id: t.reg.id, refusal: r });
    }
    setBusy(false);
    onDone(out);
  }

  const lastPart = one && one.received > 0 && one.lastDay
    ? RECV_WORDS.hintPart(formatLeagueMoney(one.price), formatLeagueMoney(one.received), regDay(one.lastDay, today))
    : null;

  return (
    <KitDialog
      kind="form"
      size="medium"
      raised={raised}
      eyebrow={many ? seasonName : RECV_WORDS.eyebrow(seasonName, one.division)}
      title={many ? RECV_WORDS.bulk.title(targets.length) : RECV_WORDS.title(one.name)}
      onClose={onClose}
      busy={busy}
      footerStart={<span>{many ? RECV_WORDS.bulk.foot(targets.length, formatLeagueMoney(total)) : RECV_WORDS.foot(formatLeagueMoney(one.owing))}</span>}
      footer={(
        <>
          <DialogCancel>{RECV_WORDS.cancel}</DialogCancel>
          <button type="button" className="btn btn-lime" onClick={() => void go()} disabled={busy}>
            {busy ? RECV_WORDS.working : many ? RECV_WORDS.bulk.submit(targets.length) : RECV_WORDS.submit}
          </button>
        </>
      )}
    >
      <FormError>{error}</FormError>
      {open && open.pages.length > 0 && (
        <p className={ck.notice} role="note">
          {open.pages.length > 1
            ? PAY_OPEN_WORDS.noticeMany(open.pages.length, one.reg.playerFirstName)
            : PAY_OPEN_WORDS.notice(open.pages[0].openedBy, money(open.pages[0].amountCents / 100), open.pages[0].openedAt, open.today, true)}
        </p>
      )}
      <div className={ck.field}>
        <span className={ck.label}>{many ? RECV_WORDS.bulk.totalLabel : RECV_WORDS.amountLabel}</span>
        <div className={repKit.readonlyValue}>
          {many ? RECV_WORDS.bulk.total(formatLeagueMoney(total), targets.length) : formatLeagueMoney(one.owing)}
        </div>
        <p className={ck.hint}>{many ? RECV_WORDS.bulk.hint : lastPart ?? RECV_WORDS.hint}</p>
      </div>
      <div className={moneyKit.pair}>
        <DayField id="regs-recv-day" label={RECV_WORDS.dateLabel} value={day} onChange={setDay} max={today} />
        <MethodField id="regs-recv-how" label={RECV_WORDS.howLabel} value={method} onChange={setMethod} required={false} emptyLabel={RECV_WORDS.howNone} />
      </div>
    </KitDialog>
  );
}
