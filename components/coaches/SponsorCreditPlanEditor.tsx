'use client';
/**
 * The credit-family rows (owner ruling Q16, 2026-08-28) — ONE editor for the three doors that
 * take a sponsor's credit plan: the create modal, the sponsor settings sheet, and the recording
 * conversation's sponsor branch.
 *
 * Extracted 2026-08-29 for two reasons at once: the row shipped three times (the drift the
 * shared-component-beats-shared-class rule exists to stop), and its first layout crammed three
 * controls into a strip built for one — the owner met it squished on the §120 walk's first
 * screen. The geometry lives in the module CSS beside this file; the rules live here:
 *
 *  · one empty row is the INVITATION (never zero rows, never an add button on an empty list);
 *  · "+ Add another family" appears only once the last row has a family — the single-family
 *    case looks exactly as it always did;
 *  · a family can be credited once: picked families leave the other rows' dropdowns;
 *  · the cap message (shares past the sponsorship) renders here, under the rows it judges.
 *
 * ⚖ THE ARRANGEMENT LINE (Sponsorship Applies To, owner rulings D1–D8, 2026-09-21) — drawn by
 * `ArrangementLine` below, under every row that has a family. It states where this family's share
 * of the sponsor's money will land — "Applies to the team default — credits reduce the last
 * payment first · Change" — and Change opens that family's own dated payments as checkboxes, in
 * place. The rules the line keeps:
 *  · the ORDINARY pledge looks as it did: no dollars, no bills, only the stated default, until
 *    the coach opens the door (the 08-31 ruling retired landing ARITHMETIC from the pledge form;
 *    a choice is not arithmetic, and the default path must stay unchanged to the eye);
 *  · a family with no dues schedule gets a sentence pointing at Player Dues and no door (D6);
 *  · the picker shows a payment's date and amount as FACTS of the schedule, never a computed
 *    split — where the money lands is derived server-side and read in the family's drawer;
 *  · when the schedule was re-run after the arrangement, the cue asks for a look: "Keep these"
 *    marks the row `keepArrangement` (a save restamps it), "Change" reopens the picker (D4).
 * It draws here because this is the one component both doors share — a second copy of the line
 * is how the pledge form and the sponsor's room start disagreeing about what an arrangement is.
 *
 * The CALLER owns the state (each door's discard guard measures it its own way) and whatever
 * extra warnings it computes (the settings sheet's payout-floor names, for example) render
 * after this component, not inside it.
 */
import { useEffect, useState, type ReactNode } from 'react';
import styles from '../../app/[orgSlug]/coaches/coaches.module.css';
import own from './SponsorCreditPlanEditor.module.css';
import type { CreditUnit } from '@/lib/coach-fundraising';
import { creditModeMidSentence, type CreditApplicationMode } from '@/lib/dues-credits';
import { formatStoredDate } from '@/lib/timezone';
import { fmt } from '@/lib/coach-money-summary';
import type { FamilyPaymentScheduleLite } from '@/lib/coach-family-schedules';
import type { ArrangedPayment } from '@/lib/sponsor-arrivals';

export type { FamilyPaymentScheduleLite } from '@/lib/coach-family-schedules';

export interface SponsorCreditPlanRow {
  playerId: string;
  value: string;
  unit: CreditUnit;
  /** The arrangement's positions (installment numbers); absent/null = the team default. */
  appliesTo?: number[] | null;
  /** The coach pressed "Keep these" on the re-run cue — the save restamps the arrangement. */
  keepArrangement?: boolean;
}

/** What the record knows about a family's STORED arrangement — the room passes this; the pledge
 *  form, which has no record yet, does not. */
export interface StoredArrangement {
  arrangedAt: string | null;
  /** The schedule was re-run after this was arranged (D4). */
  needsCheck: boolean;
  /** The positions with the date each had when arranged — what the cue reads back. */
  asArranged: ArrangedPayment[] | null;
}

const shortDate = (d: string) => formatStoredDate(d, { withYear: false });

/**
 * The arrangement line for ONE credited family: the stated default, the picker when opened, the
 * named payments read back as dates, the D6 sentence, the D4 cue. Pure over its props — the row
 * list above owns which line is open and patches the row it belongs to.
 */
function ArrangementLine({
  row, familyName, schedule, schedulesLoaded, creditMode, stored, open, onOpen, onClose, onPatch,
}: {
  row: SponsorCreditPlanRow;
  familyName: string;
  schedule: FamilyPaymentScheduleLite | null;
  /** False while the schedules read is in flight — the line states the default with no door. */
  schedulesLoaded: boolean;
  creditMode: CreditApplicationMode | null;
  stored: StoredArrangement | null;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPatch: (part: Partial<SponsorCreditPlanRow>) => void;
}) {
  const named = (row.appliesTo ?? []).filter(n => Number.isInteger(n) && n >= 1);
  const defaultWords = creditMode ? <> — {creditModeMidSentence(creditMode)}</> : null;
  const hasSchedule = !!schedule?.installments.length;

  // D6: no schedule → the sentence, and no door.
  if (schedulesLoaded && !hasSchedule) {
    return (
      <p className={own.applies}>
        <span>Applies to <b>the team default</b> — {familyName} has no dues schedule yet. Set it up on <b>Player Dues</b> to name payments.</span>
      </p>
    );
  }

  /* The list, drawn UNDER the line while it is open — the line keeps reading the choice back as
     the coach ticks ("Applies to Oct 1 · Dec 1"), and there is no Done: Save split and Cancel close
     it, and the line's own door reads Hide meanwhile (owner, first walk 2026-09-21: "Done then
     Save is an unnecessary second step"). */
  const picker = open && schedule ? (
    <div className={own.picker} role="group" aria-label={`Payments ${familyName}’s share applies to`}>
      <div className={own.pickerHead}>
        <b>Tick the payments this share covers</b>
        {/* An EDIT like any tick, not a close: the list stays open, the line reads "the team default",
            and Save split is still the one step that keeps it (owner, first walk 2026-09-21: a
            button that closed the list AND left Save standing read as a leftover). */}
        <button type="button" className={styles.linkBtn} onClick={() => onPatch({ appliesTo: null, keepArrangement: false })}>
          Use the team default
        </button>
      </div>
      {schedule.installments.map(inst => {
        const on = named.includes(inst.n);
        return (
          <label key={inst.n} className={`${own.pay} ${on ? own.payOn : ''}`}>
            <input
              type="checkbox"
              checked={on}
              onChange={e => {
                const next = e.target.checked
                  ? [...new Set([...named, inst.n])].sort((a, b) => a - b)
                  : named.filter(n => n !== inst.n);
                onPatch({ appliesTo: next.length ? next : null, keepArrangement: false });
              }}
            />
            <span className={own.payN}>#{inst.n}</span>
            <span className={own.payDate}>{formatStoredDate(inst.dueDate)}</span>
            <span className={own.payAmt}>{fmt(inst.amount)}</span>
          </label>
        );
      })}
      <p className={styles.formHint} style={{ padding: '0.5rem 0.75rem 0.6rem' }}>
        Cash the family has already sent still lands first. Whatever this sponsorship can’t place on these payments follows the team default{defaultWords}.
      </p>
    </div>
  ) : null;

  const changeDoor = hasSchedule && !row.keepArrangement
    ? <span className={own.door}><span className={own.dot} aria-hidden>·</span><button type="button" className={styles.linkBtn} onClick={open ? onClose : onOpen}>{open ? 'Hide' : 'Change'}</button></span>
    : null;

  if (named.length === 0) {
    return (
      <>
        <p className={own.applies}>
          <span>Applies to <b>the team default</b>{defaultWords}</span>
          {changeDoor}
        </p>
        {picker}
      </>
    );
  }

  // Named payments: read back as dates from the CURRENT schedule (the coach's choice), with the
  // stored stamp when the record has one, and what they were arranged AS when the cue is up.
  const byN = new Map((schedule?.installments ?? []).map(x => [x.n, x]));
  const dates = named.map(n => { const i = byN.get(n); return i ? shortDate(i.dueDate) : `#${n}`; }).join(' · ');
  const wasNamed = stored?.needsCheck && stored.asArranged ? stored.asArranged.map(p => shortDate(p.dueDate)).join(' · ') : null;
  return (
    <>
      <p className={own.applies}>
        <span>
          Applies to <b>{dates}</b>
          {stored?.arrangedAt && <> — arranged {formatStoredDate(stored.arrangedAt)}</>}
          {wasNamed && wasNamed !== dates && <> as {wasNamed}</>}
        </span>
        {changeDoor}
      </p>
      {picker}
      {stored?.needsCheck && !row.keepArrangement && schedule?.lastRunAt && (
        <p className={own.cue} role="status">
          <span><b>The dues schedule was re-run {formatStoredDate(schedule.lastRunAt)}</b>, after this was arranged — check the payments.</span>
          <button type="button" className={styles.linkBtn} onClick={() => onPatch({ keepArrangement: true })}>Keep these</button>
          <span className={own.dot} aria-hidden>·</span>
          <button type="button" className={styles.linkBtn} onClick={onOpen}>Change</button>
        </p>
      )}
      {row.keepArrangement && (
        <p className={own.applies}><span>Kept — save the split to confirm these payments.</span></p>
      )}
    </>
  );
}

export default function SponsorCreditPlanEditor({
  rows,
  onChange,
  families,
  defaultShare = '0',
  problem = null,
  schedules,
  creditMode,
  arranged,
  settleKey,
  notes,
  foot,
}: {
  rows: SponsorCreditPlanRow[];
  onChange: (next: SponsorCreditPlanRow[]) => void;
  /** Every creditable family, normalized by the caller — id + display name. */
  families: { id: string; name: string }[];
  /** Pre-fill for a fresh row's share (the team default percent, where the door has one). */
  defaultShare?: string;
  /** The cap sentence (creditPlanProblem) — rendered under the rows it judges, or null. */
  problem?: string | null;
  /** playerId → that family's current payment schedule. `undefined`/`null` while loading (the
   *  line states the default with no door); a family absent from the map has no schedule (D6). */
  schedules?: ReadonlyMap<string, FamilyPaymentScheduleLite> | null;
  /** The team's setting, for the line's wording. */
  creditMode?: CreditApplicationMode | null;
  /** playerId → the stored arrangement's stamp and cue (the room only). */
  arranged?: ReadonlyMap<string, StoredArrangement> | null;
  /** Bump it when the caller settles the rows — a save, a cancel — and the open picker closes.
   *  The editor cannot tell a save from a keystroke by watching `rows`, and a picker left open
   *  after Save split read as "did that take?" (owner, first walk 2026-09-21). */
  settleKey?: number | string;
  /** The caller's notes — refusals, the unfinished-line sentence, an error, a hint — drawn under
   *  the rows and ABOVE the closing row, so a refusal sits above the button it kills (§118). */
  notes?: ReactNode;
  /** The caller's closing controls (the room's Cancel · Save split), seated on the SAME row as
   *  "+ Add another family" — link left, buttons right (owner, first walk 2026-09-21: "it should be
   *  beside add another family, not under it"). Absent on the pledge form, whose Save is the modal's. */
  foot?: ReactNode;
}) {
  // One empty row is the invitation — a caller may hand us an empty array on first render.
  const drawn: SponsorCreditPlanRow[] = rows.length
    ? rows
    : [{ playerId: '', value: defaultShare, unit: 'percent' as CreditUnit }];

  const patch = (i: number, part: Partial<SponsorCreditPlanRow>) =>
    onChange(drawn.map((r, j) => (j === i ? { ...r, ...part } : r)));

  /** Which FAMILY's payment picker is open — at most one at a time; the line is the closed state.
   *  Keyed by family, never by row index: a caller that swaps the rows wholesale (the room's Cancel
   *  reverts the draft without remounting this) would otherwise leave the picker open on whoever
   *  now sits at that index (/review 2026-09-21). */
  const [openFor, setOpenFor] = useState<string | null>(null);
  useEffect(() => { setOpenFor(null); }, [settleKey]);
  const nameById = new Map(families.map(f => [f.id, f.name]));

  return (
    <>
      {drawn.map((row, i) => (
        <div key={i} className={own.rowGroup}>
          <div className={own.row}>
            <select
              className={`${styles.select} ${own.family}`}
              value={row.playerId}
              aria-label={`Credited family ${i + 1}`}
              onChange={e => { if (openFor === row.playerId) setOpenFor(null); patch(i, { playerId: e.target.value, appliesTo: null, keepArrangement: false }); }}
            >
              <option value="">{i === 0 ? 'Nobody in particular' : 'Pick a family…'}</option>
              {families
                .filter(f => f.id === row.playerId || !drawn.some(r => r.playerId === f.id))
                .map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <div className={own.share}>
              {/* ⚠ The number and its $/% pills are ATTACHED (the unitField idiom): the pills
                  deliberately have no left border of their own — the input's edge is it — so they
                  must never stand free of it (they shipped borderless for a morning that way,
                  owner-caught on the §120 walk). */}
              <div className={styles.unitField}>
                <input
                  className={`${styles.input} ${own.shareValue}`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={row.value}
                  aria-label={`Family ${i + 1} share`}
                  onChange={e => patch(i, { value: e.target.value })}
                  placeholder="0"
                />
                <div className={styles.unitPick} role="group" aria-label="Share unit">
                  {(['amount', 'percent'] as CreditUnit[]).map(u => (
                    <button
                      key={u}
                      type="button"
                      aria-pressed={row.unit === u}
                      className={`${styles.unitBtn} ${row.unit === u ? styles.unitBtnOn : ''}`}
                      onClick={() => patch(i, { unit: u })}
                    >
                      {u === 'amount' ? '$' : '%'}
                    </button>
                  ))}
                </div>
              </div>
              {drawn.length > 1 && (
                <button
                  type="button"
                  className={styles.btnGhost}
                  onClick={() => { onChange(drawn.filter((_, j) => j !== i)); if (openFor === row.playerId) setOpenFor(null); }}
                  aria-label={`Remove family ${i + 1}`}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          {row.playerId && (
            <ArrangementLine
              row={row}
              familyName={nameById.get(row.playerId) ?? 'This family'}
              schedule={schedules?.get(row.playerId) ?? null}
              schedulesLoaded={!!schedules}
              creditMode={creditMode ?? null}
              stored={arranged?.get(row.playerId) ?? null}
              open={openFor === row.playerId}
              onOpen={() => setOpenFor(row.playerId)}
              onClose={() => setOpenFor(null)}
              onPatch={part => patch(i, part)}
            />
          )}
        </div>
      ))}
      {problem && (
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--danger)' }}>{problem}</p>
      )}
      {notes}
      {(drawn[drawn.length - 1]?.playerId || foot) && (
        <div className={own.addRow}>
          {drawn[drawn.length - 1]?.playerId ? (
            <button
              type="button"
              className={`${styles.linkBtn} ${own.addBtn}`}
              onClick={() => onChange([...drawn, { playerId: '', value: defaultShare, unit: 'percent' as CreditUnit }])}
            >
              + Add another family
            </button>
          ) : <span />}
          {foot && <div className={own.foot}>{foot}</div>}
        </div>
      )}
    </>
  );
}
