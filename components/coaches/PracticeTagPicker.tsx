'use client';
import { useMemo } from 'react';
import TagPicker, { type PickableTag } from './TagPicker';
import type { TagManageConfig } from './TagSearchCombobox';

/**
 * `TagPicker` for the places a record's tag storage is mid-migration: a practice plan's staff and
 * equipment fields (mig 266) and a drill's kit (mig 272). Every OTHER `TagPicker` caller stores
 * ids and only ids; this one also has to keep reading records saved before the real library
 * existed, without silently rewriting them.
 *
 * ⚠ **Read-resolve, write-whole — never partial-write.** A record saved under the old free-text
 * field pre-selects here by matching each NAME against the team's current library
 * (case-insensitive, display only) — nothing is written back just from opening it. The coach's
 * first real edit (pick, remove, or mint) saves the FULL resolved set as real ids, at which point
 * this record has fully moved over; the legacy field is left as whatever it already was; on the
 * next load `legacyNames` no longer contributes anything new because the resolved names are
 * already in `ids`.
 *
 * A legacy name with NO match in the library renders as a one-press ADOPT row inside the
 * dropdown (One Tag Idiom P3 — it was a chip strip under the field until the strips folded into
 * the dropdown): a single explicit press mints it — the same "+ Create" deliberateness every
 * other tag gets, just entered from a different door.
 */
export default function PracticeTagPicker({
  label, all, ids, legacyNames, onChange, onCreate, disabled, emptyHint,
  manage, onManageChanged,
}: {
  label: string;
  all: readonly PickableTag[];
  ids: readonly string[];
  /** Free text from a record saved before this field had a real library. */
  legacyNames?: readonly string[];
  onChange: (nextIds: string[]) => void;
  onCreate?: (name: string) => Promise<PickableTag | null>;
  disabled?: boolean;
  emptyHint?: string;
  /** The manage door + drawer (One Tag Idiom Q2). */
  manage?: TagManageConfig;
  onManageChanged?: () => void;
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
    <TagPicker
      label={label} all={all} selected={resolvedIds} onChange={onChange}
      onCreate={onCreate} disabled={disabled} emptyHint={emptyHint}
      adoptNames={disabled ? undefined : unmatchedLegacy}
      onAdopt={async name => {
        if (!onCreate) return;
        const made = await onCreate(name);
        if (made) onChange([...resolvedIds, made.id]);
      }}
      manage={manage}
      onManageChanged={onManageChanged}
    />
  );
}
