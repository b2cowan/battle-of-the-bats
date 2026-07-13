'use client';
import { useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { RepTeamTag } from '@/lib/types';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * ADO-style tag picker (Coach Tags & Player Awards, Phase 3). A search box + type-ahead dropdown
 * filtered against an already-loaded library (zero per-keystroke API calls); only the SELECTED tags
 * render as chips, so a large money-tag library never floods the form. Colour distinguishes an
 * org-shared tag (blue, teamId === null) from the team's own (lime), with a one-line legend.
 *
 * Reusable for any tag kind. `onCreate` performs the create request and returns the new tag (or
 * null on failure); a null result just leaves the box unchanged (the caller surfaces its own error).
 */
export default function TagSearchCombobox({
  library,
  selectedIds,
  onChange,
  onCreate,
  countById,
  placeholder = 'Type to find or create a tag…',
  disabled = false,
  showLegend = true,
}: {
  library: RepTeamTag[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onCreate?: (name: string) => Promise<RepTeamTag | null>;
  countById?: Record<string, number>;
  placeholder?: string;
  disabled?: boolean;
  showLegend?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(library.map(t => [t.id, t])), [library]);
  const q = query.trim().toLowerCase();

  const matches = useMemo(
    () => library
      .filter(t => !selectedIds.includes(t.id) && t.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 8),
    [library, selectedIds, q],
  );
  const exact = library.some(t => t.name.toLowerCase() === q);
  const canCreate = !!onCreate && q.length > 0 && !exact;
  const optionCount = matches.length + (canCreate ? 1 : 0);

  function selectTag(id: string) {
    onChange([...selectedIds, id]);
    setQuery('');
    setActiveIdx(-1);
    inputRef.current?.focus();
  }

  function removeTag(id: string) {
    onChange(selectedIds.filter(x => x !== id));
  }

  async function createTag() {
    if (!onCreate || !q || creating) return;
    setCreating(true);
    try {
      const tag = await onCreate(query.trim());
      if (tag) {
        onChange([...selectedIds, tag.id]);
        setQuery('');
        setActiveIdx(-1);
        inputRef.current?.focus();
      }
    } finally {
      setCreating(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIdx(i => Math.min(i + 1, optionCount - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < matches.length) selectTag(matches[activeIdx].id);
      else if (activeIdx === matches.length && canCreate) createTag();
      else {
        // No highlight: pick an exact match if there is one, otherwise create.
        const m = library.find(t => t.name.toLowerCase() === q);
        if (m && !selectedIds.includes(m.id)) selectTag(m.id);
        else if (canCreate) createTag();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const selected = selectedIds.map(id => byId.get(id)).filter((t): t is RepTeamTag => !!t);

  return (
    <div className={styles.tagCombo}>
      {selected.length > 0 && (
        <div className={styles.tagComboChips}>
          {selected.map(tag => {
            const isOrg = tag.teamId === null;
            return (
              <span key={tag.id} className={`${styles.tagComboChip} ${isOrg ? styles.tagComboChipOrg : ''}`}>
                {tag.name}
                {!disabled && (
                  <button type="button" className={styles.tagComboChipX} aria-label={`Remove ${tag.name}`} onClick={() => removeTag(tag.id)}>
                    <X size={11} />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {!disabled && (
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            className={styles.input}
            value={query}
            placeholder={placeholder}
            autoComplete="off"
            onChange={e => { setQuery(e.target.value); setOpen(true); setActiveIdx(-1); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKeyDown}
          />
          {open && (query.length > 0 || matches.length > 0) && (
            <div className={styles.tagComboDropdown}>
              {matches.map((t, i) => {
                const isOrg = t.teamId === null;
                const n = countById?.[t.id];
                return (
                  <button
                    type="button"
                    key={t.id}
                    className={`${styles.tagComboOpt} ${i === activeIdx ? styles.tagComboOptActive : ''}`}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => selectTag(t.id)}
                  >
                    <span className={styles.tagComboOptName}>
                      <span className={`${styles.tagComboDot} ${isOrg ? styles.tagComboDotOrg : styles.tagComboDotOwn}`} />
                      {t.name}
                    </span>
                    {n != null && <span className={styles.tagComboCount}>{n} tagged</span>}
                  </button>
                );
              })}
              {canCreate && (
                <button
                  type="button"
                  className={`${styles.tagComboOpt} ${styles.tagComboCreate} ${activeIdx === matches.length ? styles.tagComboOptActive : ''}`}
                  onMouseDown={e => e.preventDefault()}
                  onClick={createTag}
                >
                  {creating ? 'Creating…' : `+ Create “${query.trim()}”`}
                </button>
              )}
              {matches.length === 0 && !canCreate && (
                <div className={styles.tagComboEmpty}>No matching tags</div>
              )}
            </div>
          )}
        </div>
      )}

      {showLegend && library.some(t => t.teamId === null) && (
        <div className={styles.tagComboLegend}>
          <span className={styles.tagComboLegendItem}>
            <span className={styles.tagComboLegendDot} style={{ background: 'rgba(var(--blueprint-blue-rgb),0.55)', border: '1px solid rgba(var(--blueprint-blue-rgb),0.7)' }} />
            <span>Shared by your organization</span>
          </span>
          <span className={styles.tagComboLegendItem}>
            <span className={styles.tagComboLegendDot} style={{ background: 'rgba(var(--logic-lime-rgb),0.55)', border: '1px solid rgba(var(--logic-lime-rgb),0.7)' }} />
            <span>Your team&rsquo;s own</span>
          </span>
        </div>
      )}
    </div>
  );
}
