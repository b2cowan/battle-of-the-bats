'use client';

/**
 * Shared drag-and-drop tie-breaker editor used by Event Settings (tournament-wide)
 * and the Divisions modal (per-division override). Organizers can reorder by drag,
 * remove a breaker (✕), and add inactive ones (including Coin Toss). Also hosts the
 * "max run differential per game" cap input so the two controls live together.
 *
 * Mirrors the @dnd-kit pattern in components/coaches/RosterEditor.tsx.
 */

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, Plus } from 'lucide-react';
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
  /** Unique-per-mount id so multiple DndContexts on a page don't collide. */
  idPrefix?: string;
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
}: TieBreakerEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Coin Toss is terminal, so it is always pinned to the last slot and not draggable.
  // The editor operates on this pinned view of `value`; every change re-pins, so the
  // saved order always ends with Coin Toss when present.
  const items = pinCoinLast(value);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.indexOf(active.id as TieBreaker);
    const newIndex = items.indexOf(over.id as TieBreaker);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(pinCoinLast(arrayMove(items, oldIndex, newIndex)));
  }

  function remove(b: TieBreaker) {
    if (items.length <= 1) return; // always keep at least one breaker
    onChange(items.filter(x => x !== b));
  }

  function add(b: TieBreaker) {
    if (items.includes(b)) return;
    onChange(pinCoinLast([...items, b]));
  }

  const available = availableTieBreakers(items);
  const hasCoin = items.includes('coin');

  return (
    <div className={styles.wrap}>
      <DndContext
        id={`${idPrefix}-tiebreaker-dnd`}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <ul className={styles.list}>
            {items.map((b, i) => (
              <SortableRow
                key={b}
                breaker={b}
                index={i}
                canRemove={items.length > 1}
                disabled={disabled}
                pinned={b === 'coin'}
                onRemove={() => remove(b)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {available.length > 0 && !disabled && (
        <div className={styles.addRow}>
          <span className={styles.addLabel}>Add</span>
          {available.map(b => (
            <button
              key={b}
              type="button"
              className={styles.addChip}
              onClick={() => add(b)}
              title={BREAKER_DESCRIPTIONS[b]}
            >
              <Plus size={12} aria-hidden /> {BREAKER_LABELS[b]}
            </button>
          ))}
        </div>
      )}

      {hasCoin && (
        <p className={styles.note}>Coin Toss is the final decider — it always stays last.</p>
      )}
      <p className={styles.note}>If 3+ teams are tied, Head-to-Head is automatically skipped.</p>

      <div className={styles.capGroup}>
        <label className={styles.capLabel} htmlFor={`${idPrefix}-runDiffCap`}>{capLabel}</label>
        <input
          id={`${idPrefix}-runDiffCap`}
          type="number"
          min={0}
          max={MAX_RUN_DIFF_CAP}
          inputMode="numeric"
          className={styles.capInput}
          value={cap}
          onChange={e => onCapChange(e.target.value)}
          disabled={disabled}
          placeholder="0"
        />
        <span className={styles.capHelp}>
          {capHelp ?? '0 or blank = no cap. Caps the Run Diff column only — Runs For / Against keep the real totals.'}
        </span>
      </div>
    </div>
  );
}

function SortableRow({
  breaker,
  index,
  canRemove,
  disabled,
  pinned,
  onRemove,
}: {
  breaker: TieBreaker;
  index: number;
  canRemove: boolean;
  disabled: boolean;
  pinned: boolean;
  onRemove: () => void;
}) {
  // Pinned rows (Coin Toss) cannot be dragged — they stay last.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: breaker,
    disabled: disabled || pinned,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className={styles.row}>
      <button
        type="button"
        className={styles.handle}
        aria-label={pinned ? 'Fixed position (final)' : 'Drag to reorder'}
        disabled={disabled || pinned}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} aria-hidden />
      </button>
      <span className={styles.rank}>{index + 1}</span>
      <span className={styles.label}>{BREAKER_LABELS[breaker]}</span>
      {breaker === 'coin' && <span className={styles.finalTag}>final</span>}
      {canRemove && !disabled && (
        <button
          type="button"
          className={styles.remove}
          aria-label={`Remove ${BREAKER_LABELS[breaker]}`}
          onClick={onRemove}
        >
          <X size={14} aria-hidden />
        </button>
      )}
    </li>
  );
}
