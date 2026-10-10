'use client';
/**
 * ORDER, TWO WAYS — Tournament admin redesign Stage 5 (E6, A54; hub v45, ruled as drawn 2026-10-10). Rules' sections,
 * their links and files, and Registration questions keep an order families read in. Order is a rare job:
 *
 *   at a desk   each row drags by a handle (`SortableRows` + `SortableRow`, the kit row's `grip`), which saves on drop;
 *   anywhere    Tools → Reorder is a MODE of the same list: each row's chevron gives way to Move up / Move down
 *               (`MoveButtons`, 44px on a phone), and the title band's tools give way to Done. Each move saves.
 *
 * The keyboard sensor moves a dragged row with the arrows; Move up / Move down are the touch screen's way (A54: a phone
 * never drags a 16px handle).
 */
import { useId, type ReactNode, type CSSProperties, type Ref } from 'react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { ORDER_WORDS as W } from '@/lib/tournament-settings-words';
import styles from './OrderParts.module.css';

/** The list's drag context: `onMove(from, to)` when a row is dropped somewhere new. */
export function SortableRows({ ids, onMove, children }: { ids: readonly string[]; onMove: (from: number, to: number) => void; children: ReactNode }) {
  // A stable id (two lists on one page; the library's own counter can differ between server and browser), and its two
  // screen-reader nodes in the page's body: rendered in place they would land inside the <ul> as non-<li> children.
  const id = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) onMove(from, to);
  };
  return (
    <DndContext id={id} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}
      accessibility={{ container: typeof document === 'undefined' ? undefined : document.body }}>
      <SortableContext items={[...ids]} strategy={verticalListSortingStrategy}>{children}</SortableContext>
    </DndContext>
  );
}

export type SortBits = { grip: ReactNode; itemRef: Ref<HTMLLIElement>; itemStyle: CSSProperties };

/** One row of a `SortableRows` list: hands the kit row its handle, its ref and its moving style. */
export function SortableRow({ id, name, disabled = false, children }: {
  id: string;
  /** The row's name, for the handle's accessible name. */
  name: string;
  disabled?: boolean;
  children: (bits: SortBits) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return children({
    grip: (
      <button type="button" className={styles.grip} aria-label={W.drag(name)} disabled={disabled} {...attributes} {...listeners}>
        <GripVertical size={16} aria-hidden />
      </button>
    ),
    itemRef: setNodeRef,
    itemStyle: {
      transform: CSS.Transform.toString(transform),
      transition,
      position: 'relative',
      zIndex: isDragging ? 2 : undefined,
      opacity: isDragging ? 0.7 : undefined,
    },
  });
}

/** Reorder mode's pair, beside a row: the first row has no Up, the last no Down (shown, unavailable). */
export function MoveButtons({ index, count, name, onMove, disabled = false }: {
  index: number;
  count: number;
  name: string;
  onMove: (from: number, to: number) => void;
  disabled?: boolean;
}) {
  return (
    <span className={styles.moves}>
      <button type="button" className={styles.move} aria-label={W.up(name)} disabled={disabled || index === 0}
        onClick={() => onMove(index, index - 1)}>
        <ChevronUp size={18} aria-hidden />
      </button>
      <button type="button" className={styles.move} aria-label={W.down(name)} disabled={disabled || index === count - 1}
        onClick={() => onMove(index, index + 1)}>
        <ChevronDown size={18} aria-hidden />
      </button>
    </span>
  );
}

/** A list moved one place: the new order. */
export function moved<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
