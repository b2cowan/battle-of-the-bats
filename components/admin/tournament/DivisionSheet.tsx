'use client';
/**
 * A DIVISION'S WINDOW — the New tournament window's Divisions step (walk §290 finding: round 2 ruled 2026-10-11, round 3
 * 2026-10-12; sheet https://claude.ai/artifact/L7ddaLNLxucvkZN1vgCLBz). NewVenueSheet's shape: the kit's form window,
 * raised over the setup window, full screen with ← on a phone — never a second window kind, never a half-height sheet (a
 * form covers the screen; a half sheet is a menu — the drawer-layers ruling, §3.10.8).
 *
 *   A phone only, from a division's row (the form table's one full-screen row): titled with its name, its summary under
 *   it ("8 teams · up to age 13"). NO FOOT — ← and the phone's Back close it (the record windows lost a Done beside ← on
 *   2026-10-09). Edits apply as typed; nothing saves until "Create the draft". The host holds it open on a cleared name
 *   ("Give the division a name."). Its fields end with "Remove this division" (round 3, Ask 2).
 *
 * Round 3 retired the ADD window ("New division"): a division is added by its name in the step's own field, or by one
 * of the nine suggestions, and its arrow or this window holds the rest (Ask 3).
 *
 * `DivisionFields` is also the desk's in-place form under a row's arrow (Teams it holds stays in the row there).
 */
import { Trash2 } from 'lucide-react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { FormError, TextField } from '@/components/admin/kit/club/money/MoneyKit';
import { RecordAction } from '@/components/admin/kit/club/RepKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { CREATE_WORDS as W } from '@/lib/tournament-setup-words';
import { poolLetter, type SetupDivision } from '@/lib/tournament-setup-divisions';
import styles from './DivisionSheet.module.css';

type Patch = Partial<SetupDivision>;

/** A division's own fields, ending with its rare door. */
export function DivisionFields({ idPrefix, division: d, onChange, onRemove, withTeams = false, mistake = null }: {
  idPrefix: string;
  division: SetupDivision;
  onChange: (patch: Patch) => void;
  /** "Remove this division" — the record's rare door, at the end of its body (ink: nothing is saved yet, and a
   *  suggestion comes back), never a mark on its row (round 3, Ask 2). */
  onRemove: () => void;
  /** Teams it holds — the window's; at a desk it sits in the row. */
  withTeams?: boolean;
  /** The row's red line (a desk's in-place form; a window says it at its top). */
  mistake?: string | null;
}) {
  return (
    <div className={styles.fields}>
      <TextField id={`${idPrefix}-name`} label={W.divisionName} required value={d.name} maxLength={60}
        onChange={name => onChange({ name })} />
      <div className={styles.pair}>
        <label className={ck.field} htmlFor={`${idPrefix}-min`}>
          <span className={ck.label}>{W.youngest}</span>
          <input id={`${idPrefix}-min`} className={ck.input} type="number" inputMode="numeric" min={0} value={d.minAge}
            placeholder={W.anyAge} onChange={e => onChange({ minAge: e.target.value })} />
        </label>
        <label className={ck.field} htmlFor={`${idPrefix}-max`}>
          <span className={ck.label}>{W.oldest}</span>
          <input id={`${idPrefix}-max`} className={ck.input} type="number" inputMode="numeric" min={0} value={d.maxAge}
            placeholder={W.anyAge} onChange={e => onChange({ maxAge: e.target.value })} />
        </label>
      </div>
      {withTeams && (
        <label className={ck.field} htmlFor={`${idPrefix}-cap`}>
          <span className={ck.label}>{W.maxTeams}</span>
          <input id={`${idPrefix}-cap`} className={ck.input} type="number" inputMode="numeric" min={1} value={d.capacity}
            onChange={e => onChange({ capacity: e.target.value })} />
        </label>
      )}
      <label className={styles.checkLine}>
        <input type="checkbox" checked={d.usePools} onChange={e => onChange({ usePools: e.target.checked })} />
        <span>{W.usePools}</span>
      </label>
      {d.usePools && (
        <>
          <div className={styles.pools}>
            <label className={ck.field} htmlFor={`${idPrefix}-pools`}>
              <span className={ck.label}>{W.poolCount}</span>
              <select id={`${idPrefix}-pools`} className={ck.select} value={d.poolCount}
                onChange={e => {
                  const n = Number(e.target.value);
                  onChange({ poolCount: n, poolNames: Array.from({ length: n }, (_, i) => d.poolNames[i] || W.poolName(poolLetter(i))) });
                }}>
                {[2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            {Array.from({ length: d.poolCount }, (_, i) => (
              <label key={i} className={ck.field} htmlFor={`${idPrefix}-pool-${i}`}>
                <span className={ck.label}>{W.poolName(poolLetter(i))}</span>
                <input id={`${idPrefix}-pool-${i}`} className={ck.input} value={d.poolNames[i] ?? ''} maxLength={40}
                  onChange={e => { const names = [...d.poolNames]; names[i] = e.target.value; onChange({ poolNames: names }); }} />
              </label>
            ))}
          </div>
          <label className={styles.checkLine}>
            <input type="checkbox" checked={d.requiresPoolSelection} onChange={e => onChange({ requiresPoolSelection: e.target.checked })} />
            <span>{W.registrantPicks}</span>
          </label>
        </>
      )}
      {mistake && <FormError inPlace>{mistake}</FormError>}
      <div className={styles.recordEnd}>
        <RecordAction icon={<Trash2 size={13} aria-hidden />} onClick={onRemove}>{W.removeDoor}</RecordAction>
      </div>
    </div>
  );
}

export default function DivisionSheet({ division: d, mistake = null, onChange, onClose, onRemove, withTeams = true }: {
  division: SetupDivision;
  /** The division's team count field. Off on an invite-only event: it has no spots (the free tournament tier, 2026-10-16). */
  withTeams?: boolean;
  /** Why it can't be left as it is (a cleared name; Next's mistake) — said at the window's top. */
  mistake?: string | null;
  onChange: (patch: Patch) => void;
  /** ←, the phone's Back and Escape: the host closes it, or holds it with a mistake. */
  onClose: () => void;
  /** "Remove this division": the host takes it out of the list and closes the window. */
  onRemove: () => void;
}) {
  // A record: it opens on its panel, never the name — a tap on a division must not raise a phone's keyboard. While
  // the name is cleared the title keeps the name the window opened with.
  return (
    <KitDialog
      kind="form"
      raised
      record
      title={d.name.trim() || d.openedName?.trim() || W.divisionName}
      identity={W.divisionLine(withTeams ? d.capacity : '', d.minAge, d.maxAge)}
      onClose={onClose}
    >
      {mistake && <FormError inPlace>{mistake}</FormError>}
      <DivisionFields idPrefix={`${d.id}-window`} division={d} onChange={onChange} onRemove={onRemove} withTeams={withTeams} />
    </KitDialog>
  );
}
