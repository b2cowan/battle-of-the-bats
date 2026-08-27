'use client';
import { useMemo } from 'react';
import TagPicker, { type PickableTag } from './TagPicker';
import styles from '../../app/[orgSlug]/coaches/coaches.module.css';

/**
 * `TagPicker` for the one place a plan's tag storage is mid-migration: a practice plan's staff and
 * equipment fields (mig 266). Every OTHER `TagPicker` caller stores ids and only ids; this one also
 * has to keep reading plans saved before the real library existed, without silently rewriting them.
 *
 * ⚠ **Read-resolve, write-whole — never partial-write.** A plan saved under the old free-text field
 * pre-selects here by matching each NAME against the team's current library (case-insensitive,
 * display only) — nothing is written back just from opening the plan. The coach's first real edit
 * (pick, remove, or mint) saves the FULL resolved set as real ids, at which point this plan has
 * fully moved over; the legacy field is left as whatever it already was; on the next load
 * `legacyNames` no longer contributes anything new because the resolved names are already in `ids`.
 *
 * A legacy name with NO match in the library (nobody has picked "Adam" as a real tag yet, on any
 * plan) renders as its own inert chip with one job: a single explicit press that mints it — the
 * same "+ New tag" deliberateness every other tag gets, just entered from a different door.
 */
export default function PracticeTagPicker({
  label, all, ids, legacyNames, onChange, onCreate, disabled, emptyHint,
}: {
  label: string;
  all: readonly PickableTag[];
  ids: readonly string[];
  /** Free text from a plan saved before this field had a real library. */
  legacyNames?: readonly string[];
  onChange: (nextIds: string[]) => void;
  onCreate?: (name: string) => Promise<PickableTag | null>;
  disabled?: boolean;
  emptyHint?: string;
}) {
  const resolvedIds = useMemo(() => {
    const known = new Set(ids);
    const byName = new Map(all.map(t => [t.name.toLowerCase(), t] as const));
    for (const name of legacyNames ?? []) {
      const match = byName.get(name.trim().toLowerCase());
      if (match) known.add(match.id);
    }
    return [...known];
  }, [all, ids, legacyNames]);

  const unmatchedLegacy = useMemo(() => {
    if (!legacyNames?.length) return [];
    const byName = new Set(all.map(t => t.name.toLowerCase()));
    const already = new Set(resolvedIds.map(id => all.find(t => t.id === id)?.name.toLowerCase()));
    return legacyNames.filter(n => {
      const key = n.trim().toLowerCase();
      return key && !byName.has(key) && !already.has(key);
    });
  }, [all, legacyNames, resolvedIds]);

  return (
    <div className={styles.ppFieldRow}>
      <TagPicker
        label={label} all={all} selected={resolvedIds} onChange={onChange}
        onCreate={onCreate} disabled={disabled} emptyHint={emptyHint}
      />
      {!disabled && unmatchedLegacy.length > 0 && (
        <div className={styles.ppSuggestWrap}>
          {unmatchedLegacy.map(name => (
            <button
              key={name}
              type="button"
              className={styles.tagCreateChip}
              // A legacy name typed before this library existed — one press moves it in, the same
              // deliberate act as any other new tag, just started from an old plan instead of a blank field.
              onClick={async () => {
                if (!onCreate) return;
                const made = await onCreate(name);
                if (made) onChange([...resolvedIds, made.id]);
              }}
            >
              + Add “{name}” to your {label.toLowerCase()} list
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
