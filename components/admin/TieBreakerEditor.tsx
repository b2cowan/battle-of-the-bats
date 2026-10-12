'use client';

/**
 * THE TIE-BREAKER LIST — Event settings (tournament-wide) and a division's record (its own order) both render it. On
 * the portal's reorder standard since the Tournament admin redesign's Stage 5 addendum (A73, owner 2026-10-12): each
 * row's handle is its number — drag it (hold it on a phone), or tap it for Move up · Move down · Remove · Cancel. The ×
 * on every row and the 19px drag-only grip (no way to reorder on a phone) went with the old look. The ones not in the
 * list are Add chips; Coin Toss is the final decider and holds the last place (it can be removed, never moved). At least
 * one tie-breaker always stays: a list of one has no handle, so nothing removes it. Also hosts the "max run
 * differential per game" cap, so the two controls live together.
 *
 * The tie-breakers keep their own names (Head-to-Head, Run Diff …): they are the standings' column words.
 */

import { arrayMove } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { ClubRow, ClubRowList } from '@/components/admin/kit/club/RepKit';
import { ReorderList, ReorderRow } from '@/components/admin/tournament/ReorderList';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import {
  BREAKER_LABELS,
  BREAKER_DESCRIPTIONS,
  availableTieBreakers,
  MAX_RUN_DIFF_CAP,
  type TieBreaker,
} from '@/lib/tie-breakers';
import styles from './TieBreakerEditor.module.css';

/** Move 'coin' (terminal breaker) to the last slot if present. Order-preserving otherwise. */
function pinCoinLast(list: TieBreaker[]): TieBreaker[] {
  if (!list.includes('coin')) return list;
  return [...list.filter(b => b !== 'coin'), 'coin'];
}

const COIN_HOLDS: readonly string[] = ['coin'];

interface TieBreakerEditorProps {
  /** Active, ordered breaker list (may be a subset). */
  value: TieBreaker[];
  onChange: (next: TieBreaker[]) => void;
  /** Run-diff cap as a raw input string ('' = unset). Parent parses on save. */
  cap: string;
  onCapChange: (raw: string) => void;
  /** Override the cap help text (e.g. per-division "inherit" wording). */
  capHelp?: React.ReactNode;
  capLabel?: string;
  disabled?: boolean;
  /** Unique-per-mount id so the cap's label finds its field when two lists share a page. */
  idPrefix?: string;
  /** The list sits in a full-screen window on a phone (a division's record): the handle's menu sheet goes over it. */
  overWindow?: boolean;
}

export default function TieBreakerEditor({
  value,
  onChange,
  cap,
  onCapChange,
  capHelp,
  capLabel = 'Max run differential per game',
  disabled = false,
  idPrefix = 'tb',
  overWindow = false,
}: TieBreakerEditorProps) {
  // Coin Toss is terminal, so it is always pinned to the last slot (the list's `fixed`: it never moves, and nothing
  // moves past it). Every change re-pins, so the saved order always ends with Coin Toss when present.
  const items = pinCoinLast(value);

  function move(from: number, to: number) {
    onChange(pinCoinLast(arrayMove(items, from, to)));
  }

  function remove(index: number) {
    if (items.length <= 1) return; // always keep at least one breaker
    onChange(items.filter((_, i) => i !== index));
  }

  function add(b: TieBreaker) {
    if (items.includes(b)) return;
    onChange(pinCoinLast([...items, b]));
  }

  const available = availableTieBreakers(items);
  const hasCoin = items.includes('coin');

  return (
    <div className={styles.wrap}>
      {/* Inset: the card (or the division's window) paints the ground; the outline is the list's own. */}
      <div className={styles.outline}>
      <ClubRowList inset label="Tie-breakers, in order">
        <ReorderList
          ids={items}
          names={items.map(b => BREAKER_LABELS[b])}
          onMove={move}
          onRemove={disabled ? undefined : remove}
          fixed={hasCoin ? COIN_HOLDS : undefined}
          disabled={disabled}
          overWindow={overWindow}
        >
          {items.map(b => (
            <ReorderRow key={b} id={b} number>
              {({ handle, itemRef, itemStyle }) => (
                <ClubRow title={BREAKER_LABELS[b]} grip={handle} itemRef={itemRef} itemStyle={itemStyle} />
              )}
            </ReorderRow>
          ))}
        </ReorderList>
      </ClubRowList>
      </div>

      {available.length > 0 && !disabled && (
        <div className={styles.addRow}>
          <span className={ck.label}>Add</span>
          {available.map(b => (
            <button
              key={b}
              type="button"
              className={styles.addChip}
              onClick={() => add(b)}
              title={BREAKER_DESCRIPTIONS[b]}
            >
              <Plus size={13} aria-hidden /> {BREAKER_LABELS[b]}
            </button>
          ))}
        </div>
      )}

      {hasCoin && <p className={ck.hint}>Coin Toss is the final decider — it always stays last.</p>}
      <p className={ck.hint}>If 3+ teams are tied, Head-to-Head is automatically skipped.</p>

      <div className={`${ck.field} ${styles.cap}`}>
        <label className={ck.label} htmlFor={`${idPrefix}-runDiffCap`}>{capLabel}</label>
        <input
          id={`${idPrefix}-runDiffCap`}
          type="number"
          min={0}
          max={MAX_RUN_DIFF_CAP}
          inputMode="numeric"
          className={`${ck.input} ${styles.capInput}`}
          value={cap}
          onChange={e => onCapChange(e.target.value)}
          disabled={disabled}
          placeholder="0"
        />
        <p className={ck.hint}>
          {capHelp ?? '0 or blank = no cap. Caps the Run Diff column only — Runs For / Against keep the real totals.'}
        </p>
      </div>
    </div>
  );
}
