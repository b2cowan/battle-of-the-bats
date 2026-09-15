'use client';
import { useMemo, useRef, useState } from 'react';
import { aimSentence } from '@/lib/measurable-definition';
import { formatShortDate } from '@/lib/measurable-format';
import type { RepTeamMeasurableType } from '@/lib/types';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import css from './DevelopmentSession.module.css';
import { claimEscape } from './escapeOwnership';

/**
 * ═══ THE ADD-A-TEST FIELD — the session plan's last row (development lifecycle re-evaluation
 * stage 2, owner ruling C11, 2026-09-15: "the plan is a list you build, not a list you prune") ═══
 *
 * The tag fields' grammar (One Tag Idiom), for the metric library: a search box whose dropdown
 * lists the library — grouped Tests · Skills, in the Metrics tab's order, never re-sorted — narrowed
 * as the coach types; a pick adds the row to tonight's plan and the field stays put for the next;
 * "+ New test…" is the list's LAST row, the way "Manage tags…" is on every tag picker (the door to
 * the library sits where the coach is already thinking about it). Each row carries when it last ran
 * ("last run 26 Aug" · "never run") — the answer to *what haven't we measured lately?* where the
 * coach is choosing. A metric already on the plan stays in the list, ticked and quiet, so the coach
 * sees why it is not offered; it is not a row the keyboard visits.
 *
 * ⚠ Deliberately NOT a mode of `TagSearchCombobox`: that component is a tag's — chips for the chosen,
 * org/own dots, "+ Create", adopt rows, the manage drawer and a library refresh from a path — and
 * every one of those would need switching off here, while the rows need a kind, a unit and a
 * caption it has no place for. What IS shared is the dropdown's chrome (`.tagComboDropdown` and its
 * option classes — one look, one place to change it) and its behaviours: opens on focus, closes on
 * blur, Escape closes the list before it reaches the sheet (`escapeOwnership`). Not shared: the
 * flip-up — this field sits above "Who's here?" in a pane that scrolls, so the list always opens
 * downward. It shows about eight rows before it scrolls (`.addMenu`) — a little taller than a tag
 * list, because a metric row is a sentence, not a word.
 */
export default function MetricPickerCombobox({
  types, chosenIds, lastRun, onPick, onDefineNew, disabled = false,
}: {
  /** Active definitions, in library order. */
  types: RepTeamMeasurableType[];
  /** Tonight's plan — rows already on it render ticked and quiet. */
  chosenIds: ReadonlySet<string>;
  /** Per metric id: the date it was last on a session's plan, or null ("never run"). */
  lastRun: Record<string, string | null>;
  onPick: (id: string) => void;
  /** The door — the whole definition sheet, stacked (stage 1's precedent; a saved test joins the plan). */
  onDefineNew: () => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = query.trim().toLowerCase();
  // Library order, narrowed by the typed letters; the chosen stay in place (rendered quiet).
  const matches = useMemo(() => types.filter(t => !q || t.name.toLowerCase().includes(q)), [types, q]);
  const tests = matches.filter(t => t.kind !== 'skill');
  const skills = matches.filter(t => t.kind === 'skill');
  // The keyboard visits the offered rows only — tests, then skills, then the door.
  const offered = useMemo(() => [...tests, ...skills].filter(t => !chosenIds.has(t.id)), [tests, skills, chosenIds]);
  const doorIdx = offered.length;
  const optionCount = doorIdx + 1;

  // Always below the field: the sheet's pane scrolls to hold the list, and "Who's here?" sits under
  // it — flipping up (the tag fields' rule for a field at a modal's foot) would cover the plan itself.
  function openDropdown() { setOpen(true); }
  function pick(id: string) {
    onPick(id);
    setQuery('');
    setActiveIdx(-1);
    inputRef.current?.focus();
  }
  function define() {
    setOpen(false);
    setActiveIdx(-1);
    setQuery('');
    onDefineNew();
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) openDropdown();
      setActiveIdx(i => Math.min(i + 1, optionCount - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < offered.length) pick(offered[activeIdx].id);
      else if (activeIdx === doorIdx) define();
      else if (offered.length === 1 && q) pick(offered[0].id); // one match left: Enter takes it
    } else if (e.key === 'Escape' && open) {
      /* Only while the list is open — a closed field lets Escape reach the sheet (`escapeOwnership.ts`). */
      claimEscape(e);
      setOpen(false);
    }
  }

  const caption = (t: RepTeamMeasurableType) => {
    if (chosenIds.has(t.id)) return '✓ tonight';
    const d = lastRun[t.id];
    return d ? `last run ${formatShortDate(d)}` : 'never run';
  };
  // A row's place in the keyboard order (−1 for a chosen row, which it never visits).
  const idxOf = (t: RepTeamMeasurableType) => offered.findIndex(o => o.id === t.id);

  const renderGroup = (label: string, rows: RepTeamMeasurableType[]) => rows.length === 0 ? null : (
    <div key={label} role="group" aria-label={label}>
      <div className={css.addGroup}>{label}</div>
      {rows.map(t => {
        const chosen = chosenIds.has(t.id);
        const i = idxOf(t);
        const detail = t.kind === 'skill' ? 'skill' : `${t.unit} · ${aimSentence(t)}`;
        return chosen ? (
          <div key={t.id} className={`${styles.tagComboOpt} ${css.addOpt} ${css.addOptHave}`} aria-disabled="true">
            <span className={css.addOptName}>{t.name} <small>· {detail}</small></span>
            <span className={css.addOptLast}>{caption(t)}</span>
          </div>
        ) : (
          <button
            type="button"
            key={t.id}
            className={`${styles.tagComboOpt} ${css.addOpt} ${i === activeIdx ? styles.tagComboOptActive : ''}`}
            onMouseDown={e => e.preventDefault()}
            onClick={() => pick(t.id)}
          >
            <span className={css.addOptName}>{t.name} <small>· {detail}</small></span>
            <span className={css.addOptLast}>{caption(t)}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    /* While the list is open this subtree owns Escape, so the sheet's own Escape stands down. */
    <div className={styles.tagCombo} data-escape-owner={open ? '' : undefined}>
      <input
        ref={inputRef}
        className={styles.input}
        value={query}
        placeholder="+ Add a test or skill…"
        aria-label="Add a test or skill to tonight’s plan"
        autoComplete="off"
        disabled={disabled}
        onChange={e => { setQuery(e.target.value); openDropdown(); setActiveIdx(-1); }}
        onFocus={openDropdown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
      />
      {open && (
        <div className={`${styles.tagComboDropdown} ${css.addMenu}`}>
          {renderGroup(q ? `Tests · matching “${query.trim()}”` : 'Tests', tests)}
          {renderGroup(q ? `Skills · matching “${query.trim()}”` : 'Skills', skills)}
          {matches.length === 0 && <div className={styles.tagComboEmpty}>Nothing in the library matches “{query.trim()}”</div>}
          {/* The door — the list's last row, as on every tag field. */}
          <button
            type="button"
            className={`${styles.tagComboOpt} ${styles.tagComboManage} ${css.addDoor} ${activeIdx === doorIdx ? styles.tagComboOptActive : ''}`}
            onMouseDown={e => e.preventDefault()}
            onClick={define}
          >
            + New test…
          </button>
        </div>
      )}
    </div>
  );
}
