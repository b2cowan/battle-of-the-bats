'use client';
/**
 * NEW VENUE — the four things every "add a venue" asks (Club Tier Stage 6, specimen 7: Name · Address · its facilities ·
 * Note), with the tournament's count (Tournament admin redesign Stage 5, E1 and E5; hub v45). One sheet, two doors: the
 * New tournament window's venue step ("A new venue" / "A venue that isn't the club's") and Venues & facilities' Add a
 * venue. Over the window it opens from (`raised`), so Cancel goes back to the list with the ticks kept.
 *
 *   Name *        ← required
 *   Address       ← one line, as the library's (the first run's street / city / province / postal is gone)
 *   How many *    ← − [ 2 ] + on its own row (the /design review, #10), 1…30
 *   Kind          ← the sport's word first (Diamonds for softball and baseball); only a mixed-use park changes it
 *   ▌Named Diamond 1 and Diamond 2. You can rename them on Venues & facilities.
 *   Note
 *
 * It asks; nothing is written here. The host decides what "Add venue" does — the wizard queues the venue for its one
 * create step, Venues & facilities saves it at once.
 */
import { useState } from 'react';
import { Info, Minus, Plus } from 'lucide-react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { Callout, repKit } from '@/components/admin/kit/club/RepKit';
import { FormError, TextField } from '@/components/admin/kit/club/money/MoneyKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { NEW_VENUE_WORDS as W } from '@/lib/tournament-setup-words';
import {
  FACILITY_KINDS, MAX_FACILITY_COUNT, clampFacilityCount, facilityKindLabel, facilityNames, facilityNoun,
} from '@/lib/venue-facilities';
import type { FacilityType } from '@/lib/types';
import styles from './NewVenueSheet.module.css';

export type NewVenueDraft = {
  name: string;
  address: string;
  notes: string;
  count: number;
  facilityType: Exclude<FacilityType, 'other'>;
};

export default function NewVenueSheet({
  defaultKind,
  initialName = '',
  identity = W.identity,
  raised = true,
  busy = false,
  error = '',
  onCancel,
  onAdd,
}: {
  /** The tournament's sport's kind — the Kind dropdown opens on it. */
  defaultKind: Exclude<FacilityType, 'other'>;
  /** What was typed in the search before "A new venue" was chosen. */
  initialName?: string;
  /** The line under the title: where the venue goes. */
  identity?: string;
  /** Over another window (the wizard, Add a venue); false when it is the page's own window. */
  raised?: boolean;
  /** The host is saving (Venues & facilities). */
  busy?: boolean;
  /** The host's refusal, beside the button. */
  error?: string;
  onCancel: () => void;
  onAdd: (draft: NewVenueDraft) => void;
}) {
  const [draft, setDraft] = useState<NewVenueDraft>({
    name: initialName.trim(), address: '', notes: '', count: 1, facilityType: defaultKind,
  });
  const [mistake, setMistake] = useState('');
  const [countText, setCountText] = useState('1');
  const names = facilityNames(draft.count, draft.facilityType);
  const one = facilityNoun(draft.facilityType, 1);
  const setCount = (n: unknown) => {
    const count = clampFacilityCount(n);
    setDraft(d => ({ ...d, count }));
    setCountText(String(count));
  };

  function add() {
    if (busy) return;
    if (!draft.name.trim()) { setMistake(W.nameRequired); return; }
    setMistake('');
    onAdd({ ...draft, name: draft.name.trim(), address: draft.address.trim(), notes: draft.notes.trim(), count: clampFacilityCount(draft.count) });
  }

  return (
    <KitDialog
      kind="form"
      raised={raised}
      title={W.title}
      identity={identity}
      onClose={onCancel}
      busy={busy}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>{W.cancel}</button>
          <button type="button" className="btn btn-lime" onClick={add} disabled={busy}>{W.add}</button>
        </>
      )}
    >
      <FormError>{mistake || error}</FormError>
      <TextField id="new-venue-name" label={W.name} required value={draft.name} maxLength={120}
        onChange={v => setDraft(d => ({ ...d, name: v }))} />
      <TextField id="new-venue-address" label={W.address} value={draft.address} maxLength={200} hint={W.addressHint}
        onChange={v => setDraft(d => ({ ...d, address: v }))} />
      <div className={ck.field}>
        <label className={ck.label} htmlFor="new-venue-count">{W.howMany}<span className={repKit.req} aria-hidden>*</span></label>
        <div className={styles.count}>
          <button type="button" className={`btn btn-outline ${styles.countButton}`} disabled={draft.count <= 1}
            aria-label={W.fewer(one)} onClick={() => setCount(draft.count - 1)}>
            <Minus size={16} aria-hidden />
          </button>
          <input id="new-venue-count" type="number" inputMode="numeric" min={1} max={MAX_FACILITY_COUNT}
            className={`${ck.input} ${styles.countInput}`} value={countText}
            onChange={e => {
              const text = e.target.value;
              setCountText(text);
              if (text.trim() !== '') setDraft(d => ({ ...d, count: clampFacilityCount(text) }));
            }}
            onBlur={() => setCount(countText)} />
          <button type="button" className={`btn btn-outline ${styles.countButton}`} disabled={draft.count >= MAX_FACILITY_COUNT}
            aria-label={W.more(one)} onClick={() => setCount(draft.count + 1)}>
            <Plus size={16} aria-hidden />
          </button>
        </div>
      </div>
      <label className={ck.field} htmlFor="new-venue-kind">
        <span className={ck.label}>{W.kind}</span>
        <select id="new-venue-kind" className={ck.select} value={draft.facilityType}
          onChange={e => setDraft(d => ({ ...d, facilityType: e.target.value as NewVenueDraft['facilityType'] }))}>
          {FACILITY_KINDS.map(k => <option key={k} value={k}>{facilityKindLabel(k)}</option>)}
        </select>
      </label>
      <div className={styles.named}>
        <Callout role="note" flush icon={<Info size={16} aria-hidden />}>{W.named(names)}</Callout>
      </div>
      <TextField id="new-venue-note" label={W.note} value={draft.notes} maxLength={500} placeholder={W.notePlaceholder}
        onChange={v => setDraft(d => ({ ...d, notes: v }))} />
    </KitDialog>
  );
}
