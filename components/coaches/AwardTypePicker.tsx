'use client';
import { useRef, useState, type ReactNode } from 'react';
import AwardIconPicker from '@/components/coaches/AwardIconPicker';
import TagManagerDrawer from '@/components/coaches/TagManagerDrawer';
import { AWARD_TAG_MANAGE, type ComboTag } from '@/components/coaches/TagSearchCombobox';
import { claimEscape } from '@/components/coaches/escapeOwnership';
import type { RepTeamAwardType } from '@/lib/types';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * THE AWARD PICKER — the chip row a coach picks an award from, with "+ New" and the award-type
 * library's door beside it. One component because two surfaces pick an award: "Give an award"
 * (and its edit mode, on the desktop) and the award's own sheet on a phone, which edits the award
 * where it is read (coaching from a phone §14.13, owner 2026-09-25). A picker-HOSTED library needs
 * the host's WHOLE library — create, rename, merge, retire — so the door travels with the chips
 * rather than staying behind in one of the two forms (R1 of Awards Join the One Tag Idiom: the
 * door lives beside "+ New", where every other tag library's door lives; R3: the chip row STAYS
 * the picker — a curated list of a few awards with icons is tapped, not searched).
 *
 * The library comes from the host and flows back through `onLibraryChanged`: a create here, or a
 * rename / merge / retire in the drawer, asks the host to re-read award-types, and the fresh list
 * arrives as the `awardTypes` prop — no second fetch of its own.
 *
 * ⚠⚠ A HOOK THAT HANDS BACK TWO PIECES, BECAUSE THEY MUST LIVE IN TWO PLACES. `chips` goes in the
 * form; `overlays` (the icon chooser and the library drawer) goes OUTSIDE the host's panel, as a
 * sibling. The award sheet stands on `useDialogFloor`, which answers every key whose target is
 * INSIDE its panel: a drawer nested in the sheet's DOM would have its Escape close the sheet as
 * well, and its Tab wrapped into the sheet's controls. A sibling's keys never reach the floor. The
 * Give window always kept the drawer outside its overlay for the same reason.
 */
export function useAwardTypePicker({
  orgSlug,
  teamId,
  awardTypes,
  value,
  onChange,
  keepType,
  onLibraryChanged,
}: {
  orgSlug: string;
  teamId: string;
  /** The team's whole award-type library, retired ones included (the drawer manages them). */
  awardTypes: RepTeamAwardType[];
  /** The chosen type's id, or '' for none yet. */
  value: string;
  onChange: (typeId: string) => void;
  /** The award's own type when EDITING — kept in the row even if it has since been retired, so an
   *  edit never refuses to show what the award already is (the route keeps it the same way). */
  keepType?: RepTeamAwardType | null;
  /** A type was created here, or the library changed in the drawer — the host re-reads it. */
  onLibraryChanged: () => void;
}): { chips: ReactNode; overlays: ReactNode } {
  const [creatingType, setCreatingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeEmoji, setNewTypeEmoji] = useState<string | null>('🏅');
  const [createTypeError, setCreateTypeError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  // Where focus lands when the create row closes — it unmounts under the keyboard's focus, and a
  // focus left on <body> is outside the award sheet's Tab trap (/review, 2026-09-25).
  const newBtnRef = useRef<HTMLButtonElement>(null);
  function closeCreateRow() {
    setCreatingType(false);
    requestAnimationFrame(() => newBtnRef.current?.focus());
  }

  // The active library, PLUS the chosen type even if it has since been retired — an edit must
  // never refuse to show the award's own type just because it fell out of the picker for NEW
  // awards (same "keep what it already has" rule the route enforces).
  // ⚠ The award's OWN type (`keepType`) stays in the row for the whole edit, not only while it is
  // chosen — tap a different award and the original is still there to tap back to.
  function withCurrentType(library: RepTeamAwardType[]): RepTeamAwardType[] {
    const shown = library.filter(t => t.isActive);
    for (const id of new Set([value, keepType?.id])) {
      if (!id || shown.some(t => t.id === id)) continue;
      const retired = library.find(t => t.id === id) ?? (keepType?.id === id ? keepType : undefined);
      if (retired) shown.push(retired);
    }
    return shown;
  }
  // A type created HERE shows at once, before the host's re-read brings it back in `awardTypes`.
  // Everything else is DERIVED from the prop each render — a rename / merge / retire in the drawer
  // calls the host's refetch and the fresh library flows back down, with no second GET of its own
  // and no effect copying the prop into state (the set-state-in-effect lint the Give window carried).
  const [created, setCreated] = useState<RepTeamAwardType[]>([]);
  const localTypes = withCurrentType([...awardTypes, ...created.filter(c => !awardTypes.some(t => t.id === c.id))]);

  async function handleCreateType() {
    const name = newTypeName.trim();
    if (!name) return;
    setCreateTypeError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/award-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, emoji: newTypeEmoji }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? 'Could not create award type');
      setCreated(prev => [...prev, d.awardType]);
      onChange(d.awardType.id);
      setNewTypeName('');
      setNewTypeEmoji('🏅');
      closeCreateRow();
      onLibraryChanged();
    } catch (e: unknown) {
      // Shown right beside the +New row it belongs to (below), NOT a shared error at the bottom of
      // the form — the Give window scrolls internally (max-height: 90vh), and a coach on a shorter
      // viewport never saw new content appended past the Note field with nothing prompting them to
      // scroll for it. A duplicate name silently "doing nothing" was reported as exactly that
      // (2026-09-12).
      setCreateTypeError(e instanceof Error ? e.message : 'Could not create award type');
    }
  }

  const chips = (
    <>
      <div className={styles.tagChips} role="group" aria-label="Award">
        {localTypes.map(t => (
          <button
            key={t.id}
            type="button"
            aria-pressed={value === t.id}
            className={`${styles.tagChip} ${value === t.id ? styles.tagChipActive : ''}`}
            onClick={() => onChange(t.id)}
          >
            {t.emoji ? `${t.emoji} ` : ''}{t.name}
          </button>
        ))}
        <button ref={newBtnRef} type="button" className={styles.tagChipCreate} onClick={() => { setCreateTypeError(''); setCreatingType(v => !v); }}>
          + New
        </button>
      </div>
      <button type="button" className={styles.tagManageLink} onClick={() => setManageOpen(true)}>
        {AWARD_TAG_MANAGE.door}
      </button>
      {creatingType && (
        <>
          <div className={styles.tagPickerRow} style={{ marginTop: '0.5rem' }}>
            <button type="button" className={styles.awardEmojiPickBtn} onClick={() => setPickerOpen(true)}>
              {newTypeEmoji || '🏅'}
            </button>
            <input
              className={styles.input}
              value={newTypeName}
              maxLength={40}
              placeholder="New award name"
              onChange={e => setNewTypeName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newTypeName.trim()) void handleCreateType();
                // Escape puts the row away — and ONLY the row: claimed, so the award sheet around it
                // does not close as well.
                if (e.key === 'Escape') { claimEscape(e); closeCreateRow(); }
              }}
            />
            <button className={styles.btnSecondary} disabled={!newTypeName.trim()} onClick={handleCreateType}>Add</button>
          </div>
          {createTypeError && <p className={styles.errorText} style={{ marginTop: '0.4rem' }}>{createTypeError}</p>}
        </>
      )}
    </>
  );

  const overlays = (
    <>
      {pickerOpen && (
        <AwardIconPicker
          value={newTypeEmoji}
          onClose={() => setPickerOpen(false)}
          onSelect={emoji => { setNewTypeEmoji(emoji); setPickerOpen(false); }}
        />
      )}
      {manageOpen && (
        <TagManagerDrawer
          teamId={teamId}
          tags={awardTypes as ComboTag[]}
          title={AWARD_TAG_MANAGE.title}
          itemNoun={AWARD_TAG_MANAGE.itemNoun}
          countNoun={AWARD_TAG_MANAGE.countNoun}
          basePath={`/api/coaches/${orgSlug}/teams/${teamId}/award-types`}
          policy={{ icon: true, inUseRemove: 'merge-or-retire' }}
          onClose={() => setManageOpen(false)}
          onChanged={onLibraryChanged}
        />
      )}
    </>
  );

  return { chips, overlays };
}
