'use client';
import { useId, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import styles from '../../app/[orgSlug]/coaches/coaches.module.css';

/**
 * The ONE tag picker — drills, plan templates, practice plans and a player's focus area.
 *
 * ⚠ **A NEW TAG IS ONLY MINTED ON AN EXPLICIT ACT** (owner ruling 2026-08-01). Typing SEARCHES the
 * team's existing tags; creating a new one takes a second, deliberate press on a clearly-labelled
 * "+ New tag" row. That friction is the entire point: the vocabulary must grow by decision, not by
 * typo. Free text is exactly what this replaced, and it shipped a live defect where two spellings of
 * one word split a library in half.
 *
 * ⚠ **Nothing is ever seeded or suggested from a fixed list.** Every tag here is one this club or
 * this coach typed. A supplied "Hitting / Fielding / Pitching" set would be one sport talking to a
 * platform that serves many — the rule binds the placeholder text as much as the data.
 *
 * ⚠ **`single` mode is for a FOCUS AREA, and the asymmetry is deliberate.** A focus area is FREE
 * TEXT FIRST — "loading their back hip" — and carries ONE grouping tag purely so the rail can match
 * it to tonight's practice. Drills, templates and plans carry several. Do not "make them
 * consistent": a focus area is more specific than a plan tag by design.
 */

export interface PickableTag {
  id: string;
  name: string;
  /** null = a club-wide shared tag. A coach may use it but never rename or retire it. */
  teamId?: string | null;
}

export default function TagPicker({
  all, selected, onChange, onCreate, disabled, single, label, emptyHint,
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
}) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const listId = useId();

  const chosen = useMemo(
    () => selected.map(id => all.find(t => t.id === id)).filter((t): t is PickableTag => !!t),
    [all, selected],
  );

  const q = query.trim();
  const offered = useMemo(() => {
    const taken = new Set(selected);
    const needle = q.toLowerCase();
    return all
      .filter(t => !taken.has(t.id))
      .filter(t => !needle || t.name.toLowerCase().includes(needle))
      // Shared tags lead, then the team's own, each A–Z — the same order the drill picker uses, so
      // a coach sees the club's word before their own variation of it.
      .sort((a, b) => {
        const shared = Number((b.teamId ?? null) === null) - Number((a.teamId ?? null) === null);
        return shared !== 0 ? shared : a.name.localeCompare(b.name);
      })
      .slice(0, 12);
  }, [all, selected, q]);

  // An exact (case-insensitive) match must NOT offer "+ New tag" — that is how a coach ends up with
  // two spellings, which is the whole failure this control exists to prevent.
  const exists = !!q && all.some(t => t.name.toLowerCase() === q.toLowerCase());
  const canCreate = !!onCreate && !!q && !exists && !disabled;

  function pick(id: string) {
    if (disabled) return;
    onChange(single ? [id] : [...selected, id]);
    setQuery('');
  }

  function remove(id: string) {
    if (disabled) return;
    onChange(selected.filter(x => x !== id));
  }

  async function create() {
    if (!onCreate || !q || busy) return;
    setBusy(true);
    try {
      const made = await onCreate(q);
      if (made) pick(made.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.ppField}>
      {label && <span className={styles.ppFieldLabel}>{label}</span>}

      <div className={styles.tagPick} data-disabled={disabled ? 'on' : undefined}>
        {chosen.map(t => (
          <span key={t.id} className={styles.tagChip}>
            {t.name}
            {!disabled && (
              <button type="button" onClick={() => remove(t.id)} aria-label={`Remove ${t.name}`}>
                <X size={11} aria-hidden />
              </button>
            )}
          </span>
        ))}
        {!disabled && (!single || chosen.length === 0) && (
          <input
            className={styles.tagPickInput}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={chosen.length ? 'Add a tag…' : 'Search your tags…'}
            aria-label="Search or add a tag"
            aria-describedby={listId}
          />
        )}
      </div>

      {!disabled && (
        <div id={listId} className={styles.ppSuggestWrap}>
          {offered.map(t => (
            <button key={t.id} type="button" className={styles.ppSuggestChip} onClick={() => pick(t.id)}>
              {t.name}
            </button>
          ))}
          {canCreate && (
            <button type="button" className={styles.tagCreateChip} onClick={create} disabled={busy}>
              + New tag “{q}”
            </button>
          )}
          {!offered.length && !canCreate && (
            <span className={styles.formHint}>
              {q
                ? (exists ? 'Already on this one.' : 'No tags match that.')
                : (emptyHint ?? 'No tags yet — type a word to make your first one.')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
