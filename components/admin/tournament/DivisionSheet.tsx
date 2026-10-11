'use client';
/**
 * A DIVISION'S WINDOW — the New tournament window's Divisions step (walk §290 finding, ruled 2026-10-11, Asks 3 and 4;
 * sheet https://claude.ai/artifact/L7ddaLNLxucvkZN1vgCLBz). NewVenueSheet's shape: the kit's form window, raised over the
 * setup window (centred with its scrim at a desk, full screen with ← on a phone) — never a second window kind, never a
 * half-height sheet (a form covers the screen; a half sheet is a menu — the drawer-layers ruling, §3.10.8).
 *
 *   ADD (both widths), from "Add a division": "New division", the whole division — name, ages, Teams it holds, pools.
 *     A name that starts with an age group ("U12", "U12 Girls") fills Oldest while Oldest is untouched. Cancel, ← and
 *     Escape keep every tick in the list; "Add division" refuses a blank name or one already listed, otherwise the host
 *     puts it at the end of the list, ticked (one flat list, no headings — owner, 2026-10-11). It asks; the host decides
 *     what Add does.
 *   EDIT (a phone only), from a ticked division's row (the form table's one full-screen row): titled with its name, its
 *     summary under it ("8 teams · up to age 13"). NO FOOT — ← and the phone's Back close it (the record windows lost a
 *     Done beside ← on 2026-10-09). Edits apply as typed; nothing saves until "Create the draft". The host holds it open
 *     on a cleared name ("Give the division a name.").
 *
 * `DivisionFields` is also the desk's in-place form under a row's arrow (Teams it holds stays in the row there).
 */
import { useRef, useState } from 'react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { FormError, TextField } from '@/components/admin/kit/club/money/MoneyKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { CREATE_WORDS as W } from '@/lib/tournament-setup-words';
import {
  addDivisionRefusal, poolLetter, setupDivision, starterAges, type SetupDivision,
} from '@/lib/tournament-setup-divisions';
import styles from './DivisionSheet.module.css';

type Patch = Partial<SetupDivision>;

/** A division's own fields — today's fields and words. */
export function DivisionFields({ idPrefix, division: d, onChange, withTeams = false, mistake = null }: {
  idPrefix: string;
  division: SetupDivision;
  onChange: (patch: Patch) => void;
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
    </div>
  );
}

type AddProps = {
  mode: 'add';
  /** Every listed division, ticked or not — a name already listed is refused. */
  listed: readonly SetupDivision[];
  onCancel: () => void;
  /** The division, ticked — the host gives it its id and puts it at the end of the list. */
  onAdd: (division: SetupDivision) => void;
};
type EditProps = {
  mode: 'edit';
  division: SetupDivision;
  /** Why it can't be left as it is (a cleared name; Next's mistake) — said at the window's top. */
  mistake?: string | null;
  onChange: (patch: Patch) => void;
  /** ←, the phone's Back and Escape: the host closes it, or holds it with a mistake. */
  onClose: () => void;
};

export default function DivisionSheet(props: AddProps | EditProps) {
  return props.mode === 'add' ? <AddDivision {...props} /> : <EditDivision {...props} />;
}

function AddDivision({ listed, onCancel, onAdd }: AddProps) {
  const [draft, setDraft] = useState<SetupDivision>(() => setupDivision('', '', { ticked: true }));
  const [refusal, setRefusal] = useState('');
  /** Which ages the organizer has typed into — a name fills only the ones still untouched. */
  const touched = useRef({ minAge: false, maxAge: false });

  function change(patch: Patch) {
    if (patch.minAge !== undefined) touched.current.minAge = true;
    if (patch.maxAge !== undefined) touched.current.maxAge = true;
    setDraft(d => {
      const next = { ...d, ...patch };
      // "U12" fills Oldest while Oldest is untouched — and follows the name: renamed "Varsity", it empties again.
      if (patch.name !== undefined) {
        const ages = starterAges(patch.name);
        if (!touched.current.maxAge) next.maxAge = ages.maxAge;
        if (!touched.current.minAge) next.minAge = ages.minAge;
      }
      return next;
    });
  }

  function add() {
    const why = addDivisionRefusal(listed, draft.name);
    if (why) { setRefusal(why); return; }
    onAdd({ ...draft, name: draft.name.trim() });
  }

  return (
    <KitDialog
      kind="form"
      raised
      title={W.newDivision}
      identity={W.newDivisionLine}
      onClose={onCancel}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onCancel}>{W.cancel}</button>
          <button type="button" className="btn btn-lime" onClick={add}>{W.addDivisionButton}</button>
        </>
      )}
    >
      <FormError>{refusal}</FormError>
      <DivisionFields idPrefix="new-division" division={draft} onChange={change} withTeams />
    </KitDialog>
  );
}

function EditDivision({ division: d, mistake = null, onChange, onClose }: EditProps) {
  // A record: it opens on its panel, never the name — a tap on a division must not raise a phone's keyboard. While
  // the name is cleared the title keeps the name the window opened with.
  return (
    <KitDialog
      kind="form"
      raised
      record
      title={d.name.trim() || d.openedName?.trim() || W.divisionName}
      identity={W.divisionLine(d.capacity, d.minAge, d.maxAge)}
      onClose={onClose}
    >
      {mistake && <FormError inPlace>{mistake}</FormError>}
      <DivisionFields idPrefix={`${d.id}-window`} division={d} onChange={onChange} withTeams />
    </KitDialog>
  );
}
