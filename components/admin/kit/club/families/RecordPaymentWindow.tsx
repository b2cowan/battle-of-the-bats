'use client';
/**
 * RECORD A PAYMENT (Club Tier Stage 5c, P2 — owner Asks 26–28, 2026-10-19; hub K4MPu4ni53Ct7yrDcmWJd9 v121 → Stage 5c →
 * P2). The kit's medium window (640), raised over the family's record. A payment the club received, put where it
 * belongs: a house-league fee in the club's books now, rep dues with the team, whose head coach records them.
 *
 *   the statement — what the window does, before any field (the one club send window's frame);
 *   Amount received, then the joined band, two figures — Placed · Left to place (the amount is said once, in its field:
 *     /design D1);
 *   one line per child who owes, pre-placed in the record's order up to each balance — a house-league line a whole-fee
 *     tick, a rep line an amount and, in a few words, which coach records it. A line that cannot go shows its reason in
 *     quiet ink and takes nothing; more than a child owes is explained, not refused;
 *   Date received (never after today), How (the coach's list), Note (a cheque number travels here);
 *   the foot — its sentence at the left says, child by child, what pressing does (who is told is said ONCE, here:
 *     /design D2); Cancel and the lime act, worded by what it does. Money left to place is the standing reason in the
 *     act's place, the act absent (the 10-12 rule).
 * The server validates every line against a fresh plan before writing anything, and says exactly what it did.
 * ⚠ The words are /marketing's (lib/families-words.ts).
 */
import { useMemo, useState } from 'react';
import { Check, Send } from 'lucide-react';
import KitDialog, { DialogCancel } from '../KitDialog';
import ck from '../ClubKit.module.css';
import { repKit } from '../RepKit';
import { Statement } from '../schedules/ScheduleParts';
import { DayField, FormError, MethodField, TextField, jsonInit, money, moneyFetch, moneyKit, parseAmount, refusalText } from '../money/MoneyKit';
import MoneySummaryBand from '@/components/coaches/MoneySummaryBand';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { tournamentToday } from '@/lib/timezone';
import type { DuesPaymentMethod } from '@/lib/types';
import { FAMILY_PAYMENT_WORDS as W } from '@/lib/families-words';
import { HANDOFF_NOTE_MAX, placement, prePlace, type PaymentLine, type PaymentPlan } from '@/lib/families-payment-plan';
import fam from './Families.module.css';

const cents = (c: number) => money(c / 100);
const toCents = (text: string) => { const n = parseAmount(text); return n == null ? 0 : Math.round(n * 100); };
const asText = (c: number) => (c > 0 ? (c / 100).toFixed(2) : '');

export default function RecordPaymentWindow({ q, personId, familyName, plan, onClose, onDone, onChanged }: {
  /** `orgSlug=…` */
  q: string;
  personId: string;
  familyName: string;
  plan: PaymentPlan;
  onClose: () => void;
  /** It landed: the record's notice says what was done, and the record re-reads. */
  onDone: (said: string) => void;
  /** The record changed under the window (a refusal that names it): re-read behind it. */
  onChanged: () => void;
}) {
  const isPhone = useIsPhone();
  const today = tournamentToday();
  const open = useMemo(() => plan.lines.filter(l => !l.reason), [plan]);
  const [amountText, setAmountText] = useState('');
  // Each line's money as typed: a rep line's amount, a fee's tick (the whole fee or nothing).
  const [lineText, setLineText] = useState<Record<string, string>>({});
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  // Once the reader places a line by hand, a new amount no longer re-places them (Left to place says the difference).
  const [handPlaced, setHandPlaced] = useState(false);
  const [receivedDate, setReceivedDate] = useState(today);
  const [method, setMethod] = useState<DuesPaymentMethod | ''>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const amountCents = toCents(amountText);
  function typeAmount(text: string) {
    setAmountText(text);
    if (handPlaced) return;
    const placed = prePlace(plan.lines, toCents(text));
    setLineText(Object.fromEntries(open.filter(l => l.kind === 'rep').map(l => [l.key, asText(placed[l.key] ?? 0)])));
    setTicked(Object.fromEntries(open.filter(l => l.kind === 'league').map(l => [l.key, (placed[l.key] ?? 0) > 0])));
  }

  const placed = useMemo(() => Object.fromEntries(open.map(l => [l.key,
    l.kind === 'league' ? (ticked[l.key] ? l.feeCents : 0) : toCents(lineText[l.key] ?? '')])) as Record<string, number>,
  [open, ticked, lineText]);
  const { placedCents, leftCents, children } = placement(amountCents, placed);
  const going = open.filter(l => (placed[l.key] ?? 0) > 0);
  const fees = going.filter(l => l.kind === 'league');
  const sends = going.filter((l): l is Extract<PaymentLine, { kind: 'rep' }> => l.kind === 'rep');
  const dateBad = !!receivedDate && receivedDate > today;
  const typed = amountText.trim() !== '' || note.trim() !== '';

  const standing = amountCents === 0 || placedCents === 0 ? W.nothingYet
    : leftCents > 0 ? W.leftReason(cents(leftCents))
    : leftCents < 0 ? W.overPlaced(cents(-leftCents))
    : null;
  const sentence = [
    ...fees.map(l => W.footFee(l.childName)),
    ...sends.map(l => W.footSend(l.childName, cents(placed[l.key]), l.coaches)),
  ].join(' ');
  const coachCount = new Set(sends.flatMap(l => l.coaches)).size;
  const act = fees.length && sends.length ? W.actRecordAndSend : fees.length ? W.actRecord : W.actSend(coachCount);
  const canAct = !standing && !dateBad && !!receivedDate;

  async function record() {
    if (busy || !canAct) return;
    setBusy(true); setError('');
    try {
      const r = await moneyFetch<{ said?: string; error?: string; code?: string; done?: string }>(
        // org-slug-ok: `q` IS the org ("orgSlug=…", passed down from the Families tab).
        `/api/admin/families/${encodeURIComponent(personId)}/payment?${q}`,
        jsonInit('POST', {
          amountCents, receivedDate, method: method || null, note: note.trim() || null,
          lines: going.map(l => ({ key: l.key, cents: placed[l.key] })),
        }),
      );
      if (r.ok) { onDone(r.data.said ?? ''); return; }
      setError(refusalText(r.data, W.failed));
      // A refusal that means the record moved under the window (or part of the press landed): re-read behind it.
      if (r.status === 409 || r.data?.done) onChanged();
    } catch {
      setError(W.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KitDialog
      kind="form"
      size="medium"
      raised
      eyebrow={familyName}
      title={W.title}
      onClose={onClose}
      busy={busy}
      dirty={typed}
      footerStart={<p className={fam.payFoot}>{standing ?? sentence}</p>}
      footer={(
        <>
          <DialogCancel>{W.cancel}</DialogCancel>
          {canAct && (
            <button type="button" className="btn btn-lime" onClick={() => void record()} disabled={busy}>
              {busy ? W.working : act}
            </button>
          )}
        </>
      )}
    >
      <Statement lead={W.statement} />
      <FormError>{error}</FormError>
      <label className={ck.field} htmlFor="pay-amount">
        <span className={ck.label}>{W.amount}<span className={repKit.req} aria-hidden>*</span></span>
        <input id="pay-amount" className={`${ck.input} ${fam.payAmount}`} inputMode="decimal" placeholder="$0.00"
          value={amountText} onChange={e => typeAmount(e.target.value)} />
      </label>
      <div className={moneyKit.windowBand}>
        <MoneySummaryBand
          ariaLabel={`${W.placed} · ${W.leftToPlace}`}
          tiles={[
            { key: 'placed', label: W.placed, figure: cents(placedCents), caption: isPhone || !children ? undefined : W.placedCaption(children) },
            { key: 'left', label: W.leftToPlace, figure: cents(Math.max(0, leftCents)) },
          ]}
        />
      </div>
      <ul className={fam.place} aria-label={W.linesLabel}>
        {plan.lines.map(l => (
          <PlaceLine key={l.key} line={l} short={isPhone} value={l.kind === 'league' ? !!ticked[l.key] : lineText[l.key] ?? ''}
            placedCents={placed[l.key] ?? 0}
            onChange={v => {
              setHandPlaced(true);
              if (l.kind === 'league') setTicked(t => ({ ...t, [l.key]: v === true }));
              else setLineText(t => ({ ...t, [l.key]: String(v) }));
            }} />
        ))}
      </ul>
      <div className={moneyKit.pair}>
        <div>
          <DayField id="pay-date" label={W.date} value={receivedDate} onChange={setReceivedDate} max={today} />
          {dateBad && <p className={fam.payDateBad} role="alert">{W.dateFuture}</p>}
        </div>
        <MethodField id="pay-how" label={W.how} value={method} onChange={setMethod} required={false} />
      </div>
      <TextField id="pay-note" label={W.note} value={note} onChange={setNote} maxLength={HANDOFF_NOTE_MAX}
        hint={W.noteHint(sends.map(l => l.childName))} />
    </KitDialog>
  );
}

/** One child who owes: who, what is owed, the input (or why there is none), and where it goes. */
function PlaceLine({ line: l, short, value, placedCents, onChange }: {
  line: PaymentLine; short: boolean; value: string | boolean; placedCents: number; onChange: (v: string | boolean) => void;
}) {
  const what = l.kind === 'league'
    ? W.leagueWhat(l.where, cents(l.feeCents), short)
    : `${W.repWhat(l.teamName, l.year, cents(l.balanceCents), short)}${l.pendingCents > 0 ? ` · ${W.alreadySent(cents(l.pendingCents))}` : ''}`;
  const over = l.kind === 'rep' && !l.reason && placedCents > l.balanceCents ? W.over(cents(placedCents - l.balanceCents), l.childName) : null;
  return (
    <li className={`${fam.pl}${l.reason ? ` ${fam.plOff}` : ''}`}>
      <div>
        <div className={fam.plWho}>{l.childName}</div>
        <div className={fam.plWhat}>{what}</div>
      </div>
      {l.reason ? <span /> : l.kind === 'league' ? (
        <label className={fam.plTick}>
          <input type="checkbox" checked={value === true} onChange={e => onChange(e.target.checked)} aria-label={W.wholeFeeLabel(l.childName)} />
          <span aria-hidden>{W.wholeFee}</span>
        </label>
      ) : (
        <input className={`${ck.input} ${fam.plAmount}`} inputMode="decimal" placeholder="$0.00" value={String(value)}
          aria-label={W.repAmountLabel(l.childName)} onChange={e => onChange(e.target.value)} />
      )}
      <div className={`${fam.plGoes}${l.reason || over ? ` ${fam.plGoesDim}` : ''}`}>
        {l.reason ? l.reason
          : over ? over
          : l.kind === 'league' ? <><Check size={14} aria-hidden />{W.leagueGoes}</>
          : <><Send size={14} aria-hidden />{W.repGoes(l.coaches, short)}</>}
      </div>
    </li>
  );
}
