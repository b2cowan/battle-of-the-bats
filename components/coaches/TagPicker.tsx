'use client';
import TagSearchCombobox, { type ComboTag, type TagManageConfig } from './TagSearchCombobox';
import styles from '../../app/[orgSlug]/coaches/coaches.module.css';

/**
 * The practice-side face of THE tag picker — drills, plan templates, practice plans and a
 * player's focus area, now rendered by `TagSearchCombobox` (One Tag Idiom P3, owner-ruled
 * 2026-09-01: one picker, one grammar, every library). This file keeps the field shape these
 * surfaces were built with (label above, hint below) and the lighter `PickableTag` type; the
 * behaviour is the shared combobox, unforked.
 *
 * ⚠ **WHAT CHANGED, DELIBERATELY (P3):** the always-on suggestion strip under the field folded
 * into the on-focus dropdown — three strips on one station were the cost, a tablet keyboard
 * covering half the screen the other — and selected chips wear the team's OWN colour (olive),
 * ending the blue-selected collision with "the club's" (one colour law: olive = yours, blue =
 * the club's). Ordering unified to the combobox's A-Z with the shared dot carrying the
 * distinction (the old shared-tags-first sort retired with the strip that needed it).
 *
 * ⚠ **A NEW TAG IS ONLY MINTED ON AN EXPLICIT ACT** (owner ruling 2026-08-01) — the combobox's
 * "+ Create" second press. Nothing is ever seeded or suggested from a fixed list: every tag here
 * is one this club or this coach typed.
 *
 * ⚠ **`single` mode is for a FOCUS AREA, and the asymmetry is deliberate.** A focus area is FREE
 * TEXT FIRST — "loading their back hip" — and carries ONE grouping tag purely so the rail can
 * match it to tonight's practice. Drills, templates and plans carry several. Do not "make them
 * consistent": a focus area is more specific than a plan tag by design.
 */

export interface PickableTag {
  id: string;
  name: string;
  /** null = a club-wide shared tag. A coach may use it but never rename or retire it. */
  teamId?: string | null;
}

export default function TagPicker({
  all, selected, onChange, onCreate, disabled, single, label, emptyHint, placeholder,
  adoptNames, onAdopt, manage, onManageChanged,
}: {
  all: readonly PickableTag[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
  /** Omit to forbid minting entirely — which is what a read-only or assistant view passes. */
  onCreate?: (name: string) => Promise<PickableTag | null>;
  disabled?: boolean;
  single?: boolean;
  label?: string;
  emptyHint?: string;
  placeholder?: string;
  /** Legacy free-text names with no library match — one-press adopt rows in the dropdown. */
  adoptNames?: readonly string[];
  onAdopt?: (name: string) => void | Promise<void>;
  /** The manage door + drawer (One Tag Idiom Q2 — every picker carries one quiet door). */
  manage?: TagManageConfig;
  onManageChanged?: () => void;
}) {
  return (
    <div className={styles.ppField}>
      {label && <span className={styles.ppFieldLabel}>{label}</span>}
      <TagSearchCombobox
        library={all as readonly ComboTag[]}
        selectedIds={[...selected]}
        onChange={onChange}
        onCreate={onCreate as ((name: string) => Promise<ComboTag | null>) | undefined}
        disabled={disabled}
        single={single}
        placeholder={placeholder ?? (selected.length ? 'Add a tag…' : 'Search your tags…')}
        adoptNames={adoptNames}
        onAdopt={onAdopt}
        manage={manage}
        onManageChanged={onManageChanged}
      />
      {!disabled && all.length === 0 && (
        <span className={styles.formHint}>
          {emptyHint ?? 'No tags yet — type a word to make your first one.'}
        </span>
      )}
    </div>
  );
}
