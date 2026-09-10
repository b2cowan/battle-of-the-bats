'use client';
/**
 * THE SPONSOR'S ROOM — the system's one TWO-ZONE room (List · Room · Question Phase B, 2026-09-02;
 * the ruled mockup is artifact `11607f0a` §2, "The sponsor's room"). A sponsor owns two lists at
 * once — the cheques that arrived and the families the money is credited to — and burying either
 * behind Edit hides the room's headline fact. So both are zones, side by side on a desktop and
 * stacked on a phone. The shell is `RoomShell`, owned by the panel; this module is the body, the
 * Questions the room asks (the cheque correction, the Edit-sponsorship sheet, the pledge sheet),
 * and the chip the row and the header share.
 *
 * ⚠⚠ THE CREDIT SPLIT IS LIVE IN THE ROOM, AND SAVES WITH ITS OWN BUTTON. Its writes go through
 * the payout-floor guards (SP-1) and re-figure every family's credit on every arrival, so a
 * per-keystroke save would replay the whole history and fire the floor on every digit typed. The
 * zone edits in place, says what it would refuse BEFORE the button (the §118 dead-Save), and
 * saves once. Because it is the split's one editor now, the Edit-sponsorship sheet lost its
 * copy — a record has ONE editor per field.
 *
 * ⚠ MONEY never has a form here. Record opens the one conversation locked to the sponsor; a
 * cheque is corrected through its own Question and undone from its row. Status is nowhere a
 * control — it is DERIVED from the two figures (`sponsorStanding`).
 *
 * ⚖ The promise-in-hand case HANDS OFF, both ways (owner, §121 walk 2026-08-29 + Phase B): the
 * pledge sheet's "Record it instead" carries the typed name and amount into the conversation, and
 * the conversation's "This is a promise — nothing arrived yet" carries them back here.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import styles from '../../../../coaches.module.css';
import QuestionShell from '@/components/coaches/QuestionShell';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { useLatestRef } from '@/components/coaches/useLatestRef';
import TagSearchCombobox, { MONEY_TAG_MANAGE } from '@/components/coaches/TagSearchCombobox';
import SponsorCreditPlanEditor, { type SponsorCreditPlanRow } from '@/components/coaches/SponsorCreditPlanEditor';
import { tournamentToday, formatStoredDate } from '@/lib/timezone';
import { moneyMovedMaxDate } from '@/lib/money-date-guards';
import { writeFailure } from '@/lib/coach-sandbox-refusal';
import {
  DUES_PAYMENT_METHOD_LABEL,
  type BudgetCategoryWithItems, type DuesPaymentMethod, type RepTeamTag,
} from '@/lib/types';
import {
  RAISING_FOR_NUDGE, SPONSOR_STANDING_LABEL, type CreditUnit, type SponsorStanding,
} from '@/lib/coach-fundraising';
import RaisingForField, { storedRaisingFor } from '@/components/coaches/RaisingForField';
import type { BudgetItemSelection } from '@/components/accounting/BudgetItemPicker';
import {
  accruedByFamilyFromRounds, deriveAllArrivalCredits, sharesFromRows, stillToCome, creditPlanProblem,
  type CreditPlanShare,
} from '@/lib/sponsor-arrivals';
import { fmt } from '@/lib/coach-money-summary';
import { TagChips } from './TagChips';
import type { Fundraiser, RoomRecord, SponsorArrival } from './types';

const METHODS = Object.keys(DUES_PAYMENT_METHOD_LABEL) as DuesPaymentMethod[];

/** The expected-by fact, once money is still to come: the short date for a tile, and whether it
 *  has passed (Q13's whole vocabulary). Null when nothing is owed or no date was promised. */
export function expectedClause(expectedBy: string | null, remaining: number) {
  if (!expectedBy || remaining <= 0.005) return null;
  return { short: formatStoredDate(expectedBy, { withYear: false }), past: expectedBy < tournamentToday() };
}

/** The sponsor's chip — DERIVED from the money (`sponsorStanding`), the same on its row and in
 *  its room's header. Never the stored status: that flips on the first cheque. */
export function SponsorStatusChip({ standing }: { standing: SponsorStanding }) {
  const cls = standing === 'received' ? styles.badgeApproved : standing === 'part' ? styles.badgeDraft : styles.badgePending;
  return <span className={`${styles.badge} ${cls}`}>{SPONSOR_STANDING_LABEL[standing]}</span>;
}

/** The plan as the editor holds it — strings for the boxes, from the stored rows. */
function planRows(record: RoomRecord): SponsorCreditPlanRow[] {
  return record.plan.map(p => ({
    playerId: p.playerId,
    value: String(p.value),
    unit: (p.unit === 'amount' ? 'amount' : 'percent') as CreditUnit,
  }));
}

function sameShares(a: readonly CreditPlanShare[], b: readonly CreditPlanShare[]): boolean {
  return a.length === b.length
    && a.every(s => b.some(t => t.playerId === s.playerId && t.value === s.value && t.unit === s.unit));
}

/**
 * Replay the arrivals through a plan and name every family whose credit would fall below what is
 * already paid out in cash — the refusal the payout floor WOULD send, shown before the button.
 * One derivation for the two doors that can shrink a credit: the live split and a pledge change.
 */
function foreseeableRefusals(
  record: RoomRecord,
  shares: readonly CreditPlanShare[],
  pledged: number | null,
  roster: { id: string; name: string }[],
): { playerId: string; exposure: number; name: string }[] {
  const projected = accruedByFamilyFromRounds(deriveAllArrivalCredits({
    plan: shares,
    pledged,
    arrivalAmounts: record.arrivals.map(a => a.amount),
  }));
  return record.exposureByFamily
    .filter(f => (projected.get(f.playerId) ?? 0) < f.exposure - 0.005)
    .map(f => ({
      ...f,
      name: record.plan.find(p => p.playerId === f.playerId)?.playerName
        ?? roster.find(p => p.id === f.playerId)?.name
        ?? 'this family',
    }));
}

/* Same voice as payoutFloorMessage (owner wording 2026-09-01) — the foreseeable note and the
   server's 409 must read as one rule. */
function RefusalLines({ refusals }: { refusals: { playerId: string; exposure: number; name: string }[] }) {
  return (
    <>
      {refusals.map(f => (
        <p key={f.playerId} className={styles.errorText} style={{ fontSize: 'var(--type-support)' }}>
          The team has already paid {fmt(f.exposure)} back to {f.name}&rsquo;s family — this change would make that more than they were ever owed. Remove the payout first.
        </p>
      ))}
    </>
  );
}

/**
 * The room's body: the two zones. Owns two writes — Remove on a cheque, and the split's Save — and
 * hands the cheque Edit up as a Question the panel opens.
 */
/** The sponsor's quiet facts — its note and tags — for the shell's action row (§135 walk). Needs
 *  only the record itself, so the panel can draw it before the room's own read has landed. */
export function sponsorFacts(s: Fundraiser, moneyTags: RepTeamTag[]): ReactNode {
  /* ⚠ RAISING FOR JOINS THE FACTS (mig 285) — the sponsor half of the drive room's own line, and
     the reason the row can never be empty any more: a legacy sponsor with no description and no
     tags still has the one thing worth saying, which is that nobody has told it where its money
     belongs. ⚠ EVERY NAMED WORD SPEAKS, the standard one included — an earlier draft of this
     comment claimed otherwise and the code never did it; see the drive room's twin. The word alone
     here, the shelf too on the stated Record door. */
  const raising = s.budgetItemName
    ? <>Raising for <strong>{s.budgetItemName}</strong></>
    : <span className={styles.mutedInline}>{RAISING_FOR_NUDGE.sponsor}</span>;
  return (
    <>
      {raising}
      {s.description && <> · {s.description}</>}
      <TagChips tagIds={s.tagIds} moneyTags={moneyTags} />
    </>
  );
}

export function SponsorRoomBody({
  orgSlug,
  teamId,
  sponsor,
  record,
  error,
  roster,
  defaultCreditPercent,
  moneyTags,
  canWriteMoney,
  onChanged,
  onBusyChange,
  onDirtyChange,
  onFailure,
  onEditArrival,
}: {
  orgSlug: string;
  teamId: string;
  sponsor: Fundraiser;
  record: RoomRecord | null;
  error: string;
  roster: { id: string; name: string }[];
  defaultCreditPercent: number;
  moneyTags: RepTeamTag[];
  canWriteMoney: boolean;
  onChanged: () => void;
  onBusyChange: (busy: boolean) => void;
  /** The split has unsaved changes — the room's close and its walk ask before discarding. */
  onDirtyChange: (dirty: boolean) => void;
  onFailure: (message: string) => void;
  onEditArrival: (arrival: SponsorArrival) => void;
}) {
  const confirmDialog = useConfirm();
  const [removingId, setRemovingId] = useState<string | null>(null);
  /* The split zone's save reports here, not to the room: the room hears ONE busy value per body,
     derived from both writers, so neither's "done" can clear the other's gate (`/review`,
     2026-09-02). The cleanup releases it through the LATEST callback when the body unmounts. */
  const [zoneBusy, setZoneBusy] = useState(false);
  const busyRef = useLatestRef(onBusyChange);
  const busy = removingId !== null || zoneBusy;
  useEffect(() => { busyRef.current(busy); }, [busy, busyRef]);
  useEffect(() => () => busyRef.current(false), [busyRef]);

  /**
   * ⚠⚠ IT IS "REMOVE", NOT "UNDO" (owner ruling, §135 walk 2026-09-03). The portal had one word
   * doing two jobs on adjacent screens: a club installment's **Undo** is one tap, no question,
   * nothing destroyed — it voids a transfer that stays in the audit trail — while this one deletes
   * a cheque and claws family credits back behind a named-consequence confirm. Same word, two
   * promises. The word now tracks the guard: **Undo** = one tap and one tap back; **Remove** = it
   * asks, because money or a family's credit moves. The drive room's entry door was already
   * "Remove" for exactly this act, so this also ends a same-act-two-words split.
   */
  async function removeArrival(a: SponsorArrival) {
    if (!record) return;
    const lastOne = record.arrivals.length === 1;
    const ok = await confirmDialog({
      title: 'Remove this cheque?',
      message: `Removes the ${fmt(a.amount)} that arrived ${a.receivedDate ? formatStoredDate(a.receivedDate) : 'undated'} from the team’s books`
        + (a.credited > 0.005 ? `, and takes back the ${fmt(a.credited)} credited to families from it` : '')
        + (lastOne ? '. This is the last arrival, so the sponsor returns to a pledge.' : '.'),
      confirmText: `Remove ${fmt(a.amount)}`,
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    setRemovingId(a.entryId);
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${sponsor.id}/arrivals/${a.entryId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        onFailure(writeFailure(res, await res.json().catch(() => ({})), 'That cheque could not be removed.'));
        return;
      }
      onChanged();
    } finally {
      setRemovingId(null);
    }
  }

  if (error) return <p className={styles.errorText} role="alert">{error}</p>;
  if (!record) return <p className={styles.mutedInline}>Loading…</p>;

  const remaining = stillToCome(sponsor.pledgedAmount, sponsor.totalRaised);

  return (
    <>
      <div className={styles.roomZones}>
        {/* ── Zone one: the cheques ──────────────────────────────────────────────────────── */}
        <section className={styles.roomZone} aria-label="Cheques">
          <h4 className={styles.roomZoneLabel}>Cheques</h4>
          {record.arrivals.length === 0 ? (
            <p className={styles.mutedInline} style={{ margin: 0 }}>
              Nothing has arrived yet{remaining > 0.005 && <> — {fmt(remaining)} still to come</>}.
            </p>
          ) : (
            <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
              <table className={styles.table} aria-label="Cheques">
                <thead>
                  <tr>
                    <th className={styles.th}>Arrived</th>
                    <th className={`${styles.th} ${styles.thNum}`}>Amount</th>
                    <th className={`${styles.th} ${styles.thNum}`}>Credited</th>
                    <th className={styles.th} aria-label="Row actions" />
                  </tr>
                </thead>
                <tbody>
                  {record.arrivals.map(a => (
                    <tr key={a.entryId} className={styles.tr}>
                      <td className={`${styles.td} ${styles.cardStackCell}`} data-label="Arrived">
                        {/* ⚠⚠ THE METHOD IS NOT DRAWN HERE (owner, §135 walk 2026-09-03). It read
                            "Jun 14, 2026 · by e-transfer" under a panel headed CHEQUES — the label
                            and its own rows disagreeing — and it was the only thing making this
                            cell wrap to two lines, which is what made the panel look starved of
                            width. It is still recorded, still edited on the row's own Edit door,
                            and still exported; it is just not a fact this list has to carry. */}
                        {a.receivedDate ? formatStoredDate(a.receivedDate) : <span className={styles.mutedInline}>—</span>}
                        {a.notes && <span className={styles.listRowSub}>{a.notes}</span>}
                      </td>
                      <td className={`${styles.td} ${styles.tdNum}`} data-label="Amount" style={{ fontWeight: 700 }}>
                        {fmt(a.amount)}
                      </td>
                      <td className={`${styles.td} ${styles.tdNum}`} data-label="Credited">
                        {a.credited > 0.005
                          ? <span style={{ color: 'var(--home-plum)', fontWeight: 600 }}>{fmt(a.credited)}</span>
                          : <span className={styles.mutedInline}>—</span>}
                      </td>
                      <td className={`${styles.td} ${styles.cardActionCell}`}>
                        {canWriteMoney && (
                          <span className={styles.listRowActions}>
                            <button
                              type="button"
                              className={`${styles.btnGhost} ${styles.compactAction}`}
                              onClick={() => onEditArrival(a)}
                              aria-label={`Edit the ${fmt(a.amount)} arrival`}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className={`${styles.btnGhost} ${styles.compactAction}`}
                              style={{ color: 'var(--danger)' }}
                              disabled={removingId === a.entryId}
                              onClick={() => void removeArrival(a)}
                              aria-label={`Remove the ${fmt(a.amount)} cheque`}
                            >
                              {removingId === a.entryId ? '…' : 'Remove'}
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {remaining > 0.005 && (
                <p className={styles.mutedInline} style={{ margin: '0.5rem 0 0', fontSize: 'var(--type-support)' }}>
                  {fmt(remaining)} still to come.
                </p>
              )}
            </div>
          )}
        </section>

        {/* ── Zone two: the credit split, LIVE ──────────────────────────────────────────── */}
        <section className={styles.roomZone} aria-label="Credited to players">
          <h4 className={styles.roomZoneLabel}>Credited to players</h4>
          {canWriteMoney ? (
            <CreditPlanZone
              orgSlug={orgSlug}
              teamId={teamId}
              sponsor={sponsor}
              record={record}
              roster={roster}
              defaultCreditPercent={defaultCreditPercent}
              onChanged={onChanged}
              onBusyChange={setZoneBusy}
              onDirtyChange={onDirtyChange}
              onFailure={onFailure}
            />
          ) : record.plan.length === 0 ? (
            <p className={styles.mutedInline} style={{ margin: 0 }}>Nobody in particular — the whole sponsorship stays with the team.</p>
          ) : (
            <ul className={styles.roomZoneList}>
              {record.plan.map(p => (
                <li key={p.playerId}>
                  <span>{p.playerName ?? 'A family'}</span>
                  <strong>{p.unit === 'percent' ? `${p.value}%` : fmt(p.value)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

/**
 * The split's live editor. Value-settled: the draft is compared to the STORED plan every render,
 * so a save is "done" when the room reads the new plan back — never when the request returns
 * (the discarded-reload lesson). Cancel drops the draft; Prev/Next remounts this keyed by record.
 */
function CreditPlanZone({
  orgSlug,
  teamId,
  sponsor,
  record,
  roster,
  defaultCreditPercent,
  onChanged,
  onBusyChange,
  onDirtyChange,
  onFailure,
}: {
  orgSlug: string;
  teamId: string;
  sponsor: Fundraiser;
  record: RoomRecord;
  roster: { id: string; name: string }[];
  defaultCreditPercent: number;
  onChanged: () => void;
  onBusyChange: (busy: boolean) => void;
  onDirtyChange: (dirty: boolean) => void;
  /** A refused save, raised to where it survives this zone unmounting under it. */
  onFailure: (message: string) => void;
}) {
  const [draft, setDraft] = useState<SponsorCreditPlanRow[] | null>(null);
  /* The split as it was LAST SAVED, until the room reads it back: the settle target between the
     request returning and the reload landing, so "Save split" is not offered twice for one change
     and the way out asks about nothing that is already on the server (`/review`, 2026-09-02). */
  const [savedShares, setSavedShares] = useState<CreditPlanShare[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  /* The derivations are memoised because the editor re-renders this zone per keystroke, and the
     refusal check replays every arrival — the panels' own convention for a form-bearing surface. */
  const stored = useMemo(() => planRows(record), [record]);
  const storedShares = useMemo(() => sharesFromRows(stored), [stored]);
  const rows = draft ?? stored;
  const shares = useMemo(() => sharesFromRows(rows), [rows]);
  const dirty = draft !== null
    && !sameShares(shares, storedShares)
    && !(savedShares !== null && sameShares(shares, savedShares));
  const problem = creditPlanProblem(shares, sponsor.pledgedAmount);
  /**
   * ⚠⚠ A HALF-BUILT ROW HAS TO SAY SO (owner, §135 walk 2026-09-03).
   *
   * The split is compared as SHARES, and a share needs both a family and an amount above zero —
   * so a row holding a family and a 0 is filtered out before the comparison and the split reads as
   * unchanged. That is the right answer for the Save button (there is genuinely nothing to save)
   * and it made the screen lie: the coach picks "Kai Test", the row sits there reading *Kai Test ·
   * 0 · %* — which is indistinguishable from a finished row that means zero — and no Save appears,
   * with nothing on screen saying why. Escaping then loses the row silently.
   *
   * ⚠ THE FIX IS TO NAME IT, NOT TO ARM SAVE. Offering Save would offer a write that does nothing,
   * and warning on the way out would send the coach back to a form whose Save is still absent —
   * both answer the symptom at the wrong end. Saying which row is unfinished answers it where it
   * happens, and doubles as the reason Save has not appeared.
   */
  /* ⚠ ANY row that will not become a share, not just a half-filled one — the freshly added
     "Pick a family… · 0" is the first state the coach reaches, and it needs the explanation as
     much as the deceptive "Kai Test · 0" does. The test is deliberately the SAME condition
     `sharesFromRows` filters on, so the line can never disagree with what actually saves. */
  const unfinished = rows.filter(r => !(r.playerId && Number(r.value) > 0));
  const refusals = useMemo(
    () => (dirty && !problem ? foreseeableRefusals(record, shares, sponsor.pledgedAmount, roster) : []),
    [dirty, problem, record, shares, sponsor.pledgedAmount, roster],
  );
  const refused = refusals.length > 0;

  /* The dirty report reaches the room (its close and walk ask before discarding), and clears when
     this zone unmounts under it — the latest callback, never a stale one. It is reported TWICE on
     purpose: synchronously in the change handler, so an Escape that follows a keystroke in the same
     breath finds the gate already up, and from the derived value, so a save that settles (the room
     reads the new split back) lowers it without a handler ever running. */
  const dirtyRef = useLatestRef(onDirtyChange);
  useEffect(() => { dirtyRef.current(dirty); }, [dirty, dirtyRef]);
  useEffect(() => () => dirtyRef.current(false), [dirtyRef]);
  const busyRef = useLatestRef(onBusyChange);
  useEffect(() => { busyRef.current(saving); }, [saving, busyRef]);
  useEffect(() => () => busyRef.current(false), [busyRef]);

  async function save() {
    if (problem || refused || !dirty) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${sponsor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creditPlan: shares }),
      });
      if (!res.ok) throw new Error(writeFailure(res, await res.json().catch(() => ({})), 'The split could not be saved.'));
      setSavedShares(shares);
      onChanged();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'The split could not be saved.';
      setError(message);
      onFailure(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SponsorCreditPlanEditor
        rows={rows}
        onChange={next => {
          setDraft(next);
          setError('');
          const nextShares = sharesFromRows(next);
          dirtyRef.current(!sameShares(nextShares, storedShares) && !(savedShares !== null && sameShares(nextShares, savedShares)));
        }}
        families={roster}
        defaultShare={String(defaultCreditPercent)}
        problem={problem}
      />
      {refused && <RefusalLines refusals={refusals} />}
      {unfinished.length > 0 && (
        <p className={styles.formHint} style={{ marginTop: '0.4rem' }}>
          {unfinished.length === 1 ? 'One line isn’t finished' : `${unfinished.length} lines aren’t finished`}
          {' '}— a family needs a share above zero to be credited. Set an amount, or drop the line
          with its <strong>×</strong>. Unfinished lines are not saved.
        </p>
      )}
      {error && <p className={styles.errorText} style={{ fontSize: 'var(--type-support)' }}>{error}</p>}
      {record.arrivals.length > 0 && !dirty && unfinished.length === 0 && (
        <p className={styles.formHint} style={{ marginTop: '0.4rem' }}>
          Each cheque already earned its share; changing the split re-figures every credit.
        </p>
      )}
      {dirty && (
        <div className={styles.roomZoneFoot}>
          <button type="button" className={styles.btnGhost} disabled={saving} onClick={() => { setDraft(null); setError(''); }}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={saving || !!problem || refused}
            title={refused ? 'Remove the payout first — the note above says why this can’t save.' : undefined}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : 'Save split'}
          </button>
        </div>
      )}
    </>
  );
}

/**
 * THE CHEQUE CORRECTION — a compact Question: amount, the day it arrived, how it came, a note.
 * The parity drive entries already had (D4 of the mockup). The server REPLAYS every credit and
 * asks the payout floor first; its refusal is read here, in the question that asked.
 */
export function ArrivalQuestion({
  orgSlug,
  teamId,
  sponsorId,
  arrival,
  onSaved,
  onClose,
  tabActive,
}: {
  orgSlug: string;
  teamId: string;
  sponsorId: string;
  arrival: SponsorArrival;
  onSaved: () => void;
  onClose: () => void;
  tabActive: boolean;
}) {
  const storedMethod = (arrival.method as DuesPaymentMethod | null) ?? '';
  const [amount, setAmount] = useState(String(arrival.amount));
  const [date, setDate] = useState(arrival.receivedDate ?? '');
  const [method, setMethod] = useState<DuesPaymentMethod | ''>(storedMethod);
  const [notes, setNotes] = useState(arrival.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dirty = amount !== String(arrival.amount)
    || date !== (arrival.receivedDate ?? '')
    || method !== storedMethod
    || notes !== (arrival.notes ?? '');
  const close = useDiscardGuard({ dirty, close: onClose, noun: 'change to this cheque' });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (isNaN(n) || n <= 0) { setError('Enter an amount greater than zero.'); return; }
    if (!date) { setError('Enter the date the money arrived.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${sponsorId}/arrivals/${arrival.entryId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          // Only what changed travels — an untouched field is never re-stated to the server.
          body: JSON.stringify({
            ...(n !== arrival.amount ? { amount: n } : {}),
            ...(date !== (arrival.receivedDate ?? '') ? { receivedDate: date } : {}),
            ...(method !== storedMethod ? { method: method || null } : {}),
            ...(notes !== (arrival.notes ?? '') ? { notes: notes.trim() || null } : {}),
          }),
        },
      );
      if (!res.ok) throw new Error(writeFailure(res, await res.json().catch(() => ({})), 'Save failed'));
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setSaving(false);
    }
  }

  return (
    <QuestionShell
      open={tabActive}
      onClose={() => { void close(); }}
      ariaLabel={`Edit the ${fmt(arrival.amount)} arrival`}
      title="Edit cheque"
      busy={saving}
      leaveGuard={{ dirty, tabActive, message: "You haven't saved this cheque correction. Leave without saving it?" }}
    >
      <form onSubmit={save}>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="arrival-amount">Amount *</label>
            <input
              id="arrival-amount"
              className={styles.input}
              type="number" min={0} step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              autoFocus
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="arrival-date">Date received *</label>
            <input
              id="arrival-date"
              className={styles.input}
              type="date" max={moneyMovedMaxDate()}
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="arrival-method">How did it arrive?</label>
            <select id="arrival-method" className={styles.select} value={method} onChange={e => setMethod(e.target.value as DuesPaymentMethod | '')}>
              <option value="">— not recorded —</option>
              {METHODS.map(m => <option key={m} value={m}>{DUES_PAYMENT_METHOD_LABEL[m]}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="arrival-notes">Notes</label>
            {/* ⚠ CAPPED (§135 walk, 2026-09-03). Free text with no ceiling in the form OR the
                column: a pasted paragraph rendered in full under the arrival's date. */}
            <input id="arrival-notes" className={styles.input} type="text" maxLength={80} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
          </div>
          <p className={`${styles.formHint} ${styles.formHintConsequence} ${styles.formGridFull}`}>
            The books entry follows the new figure and date, and every family&apos;s credit from this sponsor is re-figured against the split.
          </p>
          {error && <p className={`${styles.errorText} ${styles.formGridFull}`}>{error}</p>}
        </div>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnGhost} onClick={() => { void close(); }} disabled={saving}>Cancel</button>
          <button type="submit" className={styles.btnPrimary} disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </QuestionShell>
  );
}

/**
 * EDIT SPONSORSHIP — the agreement editor: name, notes, the pledged amount, expected-by, tags.
 * ⚠ THE CREDIT SPLIT IS NOT HERE (Phase B): it is live in the room, and a record has one editor
 * per field. ⚠ NO DELETE HERE EITHER — the guarded delete is the room foot's. A pledge change
 * still re-figures dollar shares against the new promise, so it asks the floor the same way the
 * split does, with the STORED split, and dead-Saves on a foreseeable refusal (§118).
 */
export function EditSponsorshipSheet({
  orgSlug,
  teamId,
  sponsor,
  record,
  roster,
  categories,
  moneyTags,
  onCreateTag,
  onManageChanged,
  onSaved,
  onClose,
  tabActive,
}: {
  orgSlug: string;
  teamId: string;
  sponsor: Fundraiser;
  record: RoomRecord | null;
  roster: { id: string; name: string }[];
  /** The team's budget taxonomy, for the "Raising for" picker (mig 285). */
  categories: BudgetCategoryWithItems[];
  moneyTags: RepTeamTag[];
  onCreateTag: (name: string) => Promise<RepTeamTag | null>;
  onManageChanged: () => void;
  onSaved: () => void;
  onClose: () => void;
  tabActive: boolean;
}) {
  const storedPledged = sponsor.pledgedAmount != null ? String(sponsor.pledgedAmount) : '';
  const [name, setName] = useState(sponsor.name);
  const [notes, setNotes] = useState(sponsor.description ?? '');
  const [pledged, setPledged] = useState(storedPledged);
  const [expected, setExpected] = useState(sponsor.expectedBy ?? '');
  const [tags, setTags] = useState<string[]>(sponsor.tagIds);
  /* The record's OWN word, never a default — the same rule the drive's sheet is under: an edit
     sheet pre-fills what is true, so a legacy sponsor opens with the field empty and its nudge
     still showing. */
  const [raisingFor, setRaisingFor] = useState<BudgetItemSelection | null>(storedRaisingFor(sponsor));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const storedShares = useMemo(() => (record ? sharesFromRows(planRows(record)) : []), [record]);
  const pledgedNumber = Number(pledged) || null;
  const problem = creditPlanProblem(storedShares, pledgedNumber);
  const pledgeMoved = pledged !== storedPledged;
  const refusals = useMemo(
    () => (record && pledgeMoved && !problem ? foreseeableRefusals(record, storedShares, pledgedNumber, roster) : []),
    [record, pledgeMoved, problem, storedShares, pledgedNumber, roster],
  );
  const refused = refusals.length > 0;

  const dirty = name !== sponsor.name
    || notes !== (sponsor.description ?? '')
    || pledgeMoved
    || expected !== (sponsor.expectedBy ?? '')
    || (raisingFor?.itemId ?? null) !== sponsor.budgetItemId
    || tags.length !== sponsor.tagIds.length
    || tags.some(id => !sponsor.tagIds.includes(id));
  const close = useDiscardGuard({ dirty, close: onClose, noun: 'change to the sponsor' });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('The sponsor needs a name.'); return; }
    const amount = Number(pledged);
    if (isNaN(amount) || amount <= 0) { setError('A sponsor needs an amount greater than zero.'); return; }
    if (problem) { setError(problem); return; }
    if (refused) return; // the dead button's belt — Enter still submits the form
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${sponsor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: notes.trim() || null,
          pledgedAmount: amount,
          expectedBy: expected || null,
          tagIds: tags,
          budgetItemId: raisingFor?.itemId ?? null,
        }),
      });
      if (!res.ok) throw new Error(writeFailure(res, await res.json().catch(() => ({})), 'Save failed'));
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setSaving(false);
    }
  }

  return (
    <QuestionShell
      open={tabActive}
      onClose={() => { void close(); }}
      ariaLabel={`Edit ${sponsor.name}`}
      title="Edit sponsorship"
      busy={saving}
      scroll
      leaveGuard={{ dirty, tabActive, message: 'You have unsaved changes to this sponsor. Leave without saving them?' }}
    >
      <form onSubmit={save}>
        <div className={styles.formGrid}>
          <div className={`${styles.field} ${styles.formGridFull}`}>
            {/* "Sponsor", matching the pledge sheet — one field, one name on the sibling forms. */}
            <label className={styles.label}>Sponsor or grant *</label>
            <input className={styles.input} value={name} onChange={e => setName(e.target.value)} required />
          </div>
          {/* ⚠⚠ THIS FIELD *IS* THE SPONSOR-VERSUS-GRANT DISTINCTION (owner ruling 2026-09-08), and
              it is why no switch was added. A grant and a sponsor behave identically — a promise,
              then money arriving, optionally crediting families — and the only consequence of the
              difference is which Sponsorship line it reports against. A separate type control would
              be a second place to say one thing. */}
          <RaisingForField
            kind="sponsor"
            categories={categories}
            value={raisingFor}
            onChange={setRaisingFor}
            orgSlug={orgSlug}
            teamId={teamId}
          />
          <div className={`${styles.field} ${styles.formGridFull}`}>
            <label className={styles.label}>Notes</label>
            {/* ⚠⚠ CAPPED, AND THE CAP IS WHAT LETS THE NOTE SHARE THE DOORS' ROW (§135 walk,
                2026-09-03). It is the room's facts line now, clamped to one line beside Edit and
                Record — uncapped free text there would be a paragraph behind an ellipsis. 140 is
                a sentence about a sponsor ("Season sponsor — banner at the diamond"), which is
                what every real one has been. */}
            <textarea className={styles.textarea} maxLength={140} value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Pledged amount *</label>
            <input className={styles.input} type="number" min={0} step="0.01" value={pledged} onChange={e => setPledged(e.target.value)} />
            <p className={styles.formHint}>
              {sponsor.totalRaised > 0.005
                ? `${fmt(sponsor.totalRaised)} has arrived — dollar shares re-figure against the new promise.`
                : 'Nothing has arrived yet — changing the promise moves no money.'}
            </p>
            {problem && <p className={styles.errorText} style={{ fontSize: 'var(--type-support)' }}>{problem}</p>}
            {refused && <RefusalLines refusals={refusals} />}
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Expected by</label>
            <input className={styles.input} type="date" value={expected} onChange={e => setExpected(e.target.value)} />
          </div>
          <div className={`${styles.field} ${styles.formGridFull}`}>
            <label className={styles.label}>Tags</label>
            <TagSearchCombobox library={moneyTags} selectedIds={tags} onChange={setTags} onCreate={onCreateTag} placeholder="Type to find or create a money tag…" manage={{ ...MONEY_TAG_MANAGE, teamId, basePath: `/api/coaches/${orgSlug}/teams/${teamId}/expense-tags` }} onManageChanged={onManageChanged} />
          </div>
          <p className={`${styles.formHint} ${styles.formGridFull}`}>
            Who is credited, and how much, is set in the room — under <strong>Credited to players</strong>.
          </p>
        </div>
        {error && <p className={styles.errorText} style={{ marginTop: '0.75rem' }}>{error}</p>}
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnGhost} onClick={() => { void close(); }} disabled={saving}>Cancel</button>
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={saving || refused}
            title={refused ? 'Remove the payout first — the note above says why this can’t save.' : undefined}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </QuestionShell>
  );
}

/* ⚰⚰ `PledgeSheet` WAS DELETED HERE (owner ruling, §135 walk 2026-09-03) — 179 lines of a
   second form asking the Record conversation's questions in its own words.

   It existed because the promise was not an ANSWER: it hid inside "a sponsor came through" →
   "this is a promise", so it needed somewhere else to go, and that somewhere had to re-ask the
   sponsor's name, the amount, the credit split and the tags. Two forms, two save paths, and they
   had already drifted — this one capped its note at 140 characters after the §135 walk while the
   conversation's own sponsor form did not.

   The promise is a row in "Not paid yet" now, beside the bill, and the form is the conversation's.
   "+ Pledge" opens that same conversation with the answer STATED; picking it inside Record leaves
   every other answer a tap away. What went with it: this component, the cross-panel
   `requestPledge`/`pledgeNonce`/`pledgeCarry` wire, the "Record it instead" link and its reverse
   hand-off, and the stated band that had been added hours earlier to make the tab-switch legible —
   a bandage on the jump this removes. */
