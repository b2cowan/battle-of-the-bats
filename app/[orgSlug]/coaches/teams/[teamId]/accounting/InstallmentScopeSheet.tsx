'use client';
import { useMemo, useRef, useState } from 'react';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import {
  planScopedInstallmentEdit, planScopedInstallmentDelete, describeScopedOutcome,
} from '@/lib/payable-scope-edit';
import {
  scopeChoiceIsMeaningful, installmentsInScope, ALL_EDIT_SCOPES, EDIT_SCOPE_COPY,
  type AppliedInstallment, type CommitmentStanding, type EditScope,
} from '@/lib/payable-standing';
import { formatStoredDate } from '@/lib/timezone';
import DateField from './DateField';
// ⚠ ONE MONEY FORMATTER FOR THE PAIR (`/simplify`, 2026-08-20). The editor and this sheet are one
// feature in one directory; a third copy of the same one-liner is a third place to update when the
// rounding or the grouping changes. The pure scope module keeps its OWN copy deliberately — a
// dependency-free lib module must never import from a React component to do arithmetic, which is
// the same rule `lib/payable-standing.ts` and `lib/expense-ledger.ts` state in their own headers.
import { fmt } from './InstallmentPlanEditor';
import styles from './budget/budget.module.css';
import shared from '../../../coaches.module.css';

/**
 * Change or remove ONE scheduled payment in a series, and say how far that should reach
 * (Payables Rebuild P4, scope rules S1–S7).
 *
 * ⚠⚠ THE SENTENCE AND THE WRITE ARE THE SAME DECISION. Everything this sheet shows — which
 * payments a scope reaches, where money already recorded ends up, and whether the change has to be
 * refused — comes from `lib/payable-scope-edit`, which the route runs again on the server. Two
 * copies of that arithmetic is how a screen ends up promising one outcome and the save delivering
 * another; this project has already paid for that once, in the collapse-the-split defect.
 *
 * ⚠ S4 — THE QUESTION IS NOT ASKED WHEN IT HAS ONE ANSWER. On a bill where five of six pieces are
 * settled, all three scopes resolve to the same single row; a three-way question with one possible
 * outcome makes a careful feature feel bureaucratic and trains coaches to click past the one that
 * matters. The picker is simply absent, and the sheet saves directly.
 *
 * ⚠⚠ NOTHING IS GREYED OUT ON A SETTLED PAYMENT (S2, owner ruling 2026-08-16). "This payment only"
 * still edits one and the books follow. If this sheet ever starts disabling a settled row, a live
 * ruling has been reversed and QA §27 Part C has been un-done.
 */
export default function InstallmentScopeSheet({
  orgSlug, teamId, expenseId, description, standing, installment, mode, onClose, onSaved,
}: {
  orgSlug: string;
  teamId: string;
  expenseId: string;
  description: string;
  standing: CommitmentStanding;
  installment: AppliedInstallment;
  mode: 'edit' | 'remove';
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [amount, setAmount] = useState(String(installment.amount));
  const [dueDate, setDueDate] = useState(installment.dueDate);
  const [scope, setScope] = useState<EditScope>('this');
  const [busy, setBusy] = useState(false);
  const committingRef = useRef(false);
  const [error, setError] = useState('');

  useOverlayOpen(true);

  const count = standing.installments.length;
  /* What each option would actually reach, worked out ONCE for all three (`/simplify`, efficiency
     lens, 2026-08-20). It was a helper called twice per option inside the render — the number and
     then again to pick "payment" vs "payments" — which re-walked the installments nine times per
     keystroke once `scopeChoiceIsMeaningful`'s own three calls are counted. ⚠ The counts still come
     from S1's own function, so an option can never advertise a reach the write would not take. */
  const reach = useMemo(
    () => new Map(ALL_EDIT_SCOPES.map(s => [s, installmentsInScope(standing, installment.id, s).length])),
    [standing, installment.id],
  );
  const asks = scopeChoiceIsMeaningful(standing, installment.id);
  /* ⚠ A stale picker must not be able to widen a change beyond what the coach can see — when the
     question is not asked, the scope IS "this", both here and at the route. */
  const effective: EditScope = asks ? scope : 'this';

  /**
   * ⚠⚠ ONLY WHAT THE COACH ACTUALLY CHANGED IS SENT (`/review`, correctness lens, 2026-08-20).
   *
   * Both fields open PRE-FILLED from the installment, and sending them unconditionally made a
   * date-only edit rewrite money: `amount` is SET across the whole scope (unlike the date, which
   * SHIFTS), so a coach opening payment 1 of a $200 / $300 / $250 series to push the schedule two
   * weeks later under "this and later" silently flattened payments 2 and 3 to $200 each — the
   * bill's total dropping from $750 to $600 with no over-payment to trip the guard and nothing in
   * the confirmation sentence mentioning amounts at all.
   *
   * An untouched field is now simply absent, which the scope module already reads as "leave it".
   */
  const changed = useMemo(() => {
    const typed = parseFloat(amount);
    const rounded = Number.isFinite(typed) ? Math.round(typed * 100) / 100 : null;
    return {
      ...(rounded !== null && Math.round(installment.amount * 100) !== Math.round(rounded * 100)
        ? { amount: rounded } : {}),
      ...(dueDate && dueDate !== installment.dueDate ? { dueDate } : {}),
    };
  }, [amount, dueDate, installment.amount, installment.dueDate]);

  const outcome = useMemo(() => (
    mode === 'remove'
      ? planScopedInstallmentDelete(standing, installment.id, effective)
      : planScopedInstallmentEdit(standing, installment.id, effective, changed)
  ), [mode, standing, installment.id, effective, changed]);

  const sentence = describeScopedOutcome(outcome, mode === 'remove' ? 'remove' : 'change');

  async function commit() {
    /* ⚠ BELT TO `busy`'s BRACES — the pattern `GenerateInstallmentsModal` already carries, and for
       the same reason: a second click can land before React has committed the disabled attribute.
       On a DELETE the second request 404s (the id is gone), showing the coach a failure after a
       success; on a PATCH it re-derives against fresh state and writes nothing, but says so
       confusingly. A ref is the only thing that closes the window. */
    if (committingRef.current) return;
    committingRef.current = true;
    setBusy(true);
    setError('');
    try {
      const base = `/api/coaches/${orgSlug}/teams/${teamId}/expenses/${expenseId}/installments/${installment.id}`;
      const res = mode === 'remove'
        ? await fetch(`${base}?scope=${effective}`, { method: 'DELETE' })
        : await fetch(base, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            // ⚠ The SAME object the outcome above was computed from — a body that said more than
            // the preview did is how a screen promises one thing and the save does another.
            body: JSON.stringify({ scope: effective, ...changed }),
          });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not save that');
      await onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save that');
    } finally {
      // Released when the request ends — the window the latch exists for is the in-flight one.
      committingRef.current = false;
      setBusy(false);
    }
  }

  const nothingToDo = mode === 'edit' && outcome.touched.length === 0;

  return (
    <div className={shared.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) (onClose)?.(); }}>
      <div className={shared.modal} style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <CoachModalHeader
          title={mode === 'remove' ? 'Remove a payment' : 'Change a payment'}
          subtitle={`${description} — ${count > 1 ? `installment ${installment.installmentNumber} of ${count}` : 'one payment'}`}
          onClose={onClose}
        />

        <div className={shared.formGrid}>
          {mode === 'edit' ? (
            <>
              <div className={shared.field}>
                <label className={shared.label}>Amount ($)</label>
                <input
                  className={shared.input} type="number" min="0.01" step="0.01"
                  value={amount} onChange={e => setAmount(e.target.value)}
                />
              </div>
              <div className={shared.field}>
                <label className={shared.label}>Due date</label>
                <DateField value={dueDate} ariaLabel="Due date" onChange={setDueDate} />
                {/* ⚠ S5 — under a bulk scope this is a SHIFT, not a set, and a coach has to be told
                    before they press Save. Moving one payment a week later on a monthly series
                    moves the rest a week later; stacking them all on one day is nonsense. */}
                {effective !== 'this' && dueDate !== installment.dueDate && (
                  <p className={shared.formHint}>
                    The later payments move by the same number of days — they do not all land on
                    this date.
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className={`${shared.formHint} ${shared.formGridFull}`}>
              {fmt(installment.amount)}, due {formatStoredDate(installment.dueDate)}
              {installment.applied > 0
                ? ` — ${fmt(installment.applied)} has been recorded against it, and re-applies to what is left.`
                : '.'}
            </p>
          )}

          {/* ── How far should this reach? ────────────────────────────────────────────────── */}
          {asks && (
            <fieldset className={shared.formGridFull} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className={shared.label}>How far should this go?</legend>
              {ALL_EDIT_SCOPES.map(s => {
                const n = reach.get(s) ?? 0;
                return (
                  <label key={s} className={`${styles.basisCard} ${effective === s ? styles.basisCardOn : ''}`}>
                    <input
                      type="radio" name="installment-scope" className={styles.basisRadio}
                      checked={effective === s} onChange={() => setScope(s)}
                    />
                    <span className={styles.basisName}>{EDIT_SCOPE_COPY[s].label}</span>
                    <span className={styles.basisValue}>
                      {n}<small>{n === 1 ? 'payment' : 'payments'}</small>
                    </span>
                    <span className={styles.basisMath}>{EDIT_SCOPE_COPY[s].detail}</span>
                  </label>
                );
              })}
              {/* ⚠ S1, said out loud rather than shown as a disabled row. A bulk scope never
                  touches settled money, and a coach who cannot see WHY a paid payment is untouched
                  will assume the feature missed it. */}
              {standing.installments.some(i => i.state === 'settled') && (
                <p className={shared.formHint}>
                  Payments already settled are never changed by the last two — that money has left
                  the account. To correct one, open it and choose <strong>This payment only</strong>.
                </p>
              )}
            </fieldset>
          )}

          {/* ⚠⚠ THE OUTCOME, BEFORE THE BUTTON — S6's "the sentence names every installment it
              touched". A refusal takes the danger colour and the action goes with it; a plain
              outcome is a statement the coach reads past. */}
          {outcome.refusal ? (
            <p className={`${styles.reconStrip} ${styles.reconOver} ${shared.formGridFull}`}>
              <span aria-hidden className={styles.reconMark}>!</span>
              <span>{outcome.refusal}</span>
            </p>
          ) : sentence ? (
            <p className={`${styles.reconStrip} ${styles.reconMatch} ${shared.formGridFull}`}>
              <span aria-hidden className={styles.reconMark}>✓</span>
              <span>{sentence}</span>
            </p>
          ) : null}

          {error && <p className={`${shared.errorText} ${shared.formGridFull}`}>{error}</p>}
        </div>

        <div className={shared.modalFooter}>
          <button type="button" className={shared.btnGhost} onClick={onClose}>Cancel</button>
          <button
            type="button"
            className={mode === 'remove' ? shared.btnDanger : shared.btnPrimary}
            disabled={busy || !!outcome.refusal || nothingToDo}
            onClick={commit}
          >
            {busy ? 'Saving…' : mode === 'remove' ? 'Remove it' : 'Save the change'}
          </button>
        </div>
      </div>
    </div>
  );
}
