'use client';
/**
 * THE SCHEDULE'S GRID (Club Tier Stage 11a, part B — hub Stages 10 + 11, specimens 6 "A week of the winter dome", 7
 * "Adjust by hand", 10, 14 step 3; Asks 12, 13, 27; plan §5.4).
 *
 * ⚖ 6c SPECIMEN 4'S LAYOUT, NOT THE TIMELINE'S AXES (P11-01, Ask 12): a row per facility, a column per day (Monday first,
 * C2 — or, for a schedule held on one weekday, that weekday's dates, seven at a time, Ask 27), each day's slots in clock
 * order. Every slot is on the page: an OPEN one dashed; one a booking already holds drawn as that booking, hatched; a
 * locked one with its padlock; a clash with 6a's amber flag; a day with no time held "—" (C7); today's column "Today · …".
 * A slot chip: the time as a range on its first line (R9), the team on its second, the team's colour as its edge (R4).
 *
 * ⚖ AN ASKED SUNDAY (Stage 11d part B, /design D1): a slot a waiting ask counts keeps its team's chip, ringed, with Hand
 * back's OWN glyph in its corner (`slotAskGlyph`) — the ring alone already means "moved, not yet sent", and a status is
 * never colour only. Its name says "hand-back asked" and which team asked (a shared slot asked by one of its teams).
 *
 * ⚖ THE TIMELINE'S BEHAVIOUR (Ask 13): drag a team onto an open slot (a move) or onto another team's (a swap). The
 * dashed preview reads green where the slot is free, amber where a booking or a rule would be broken (it still drops),
 * red only for the schedule's own rule — a team twice at once — which says why and springs back. A drop hands the page
 * the move; the page asks WHICH WEEKS (This week only · This & later weeks · Every week) and ends in the Undo notice.
 * A keyboard reaches every move through the slot's own window (Change team, Swap with…, Clear, Lock).
 */
import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragMoveEvent, type DragStartEvent } from '@dnd-kit/core';
import { AlertTriangle, Lock, Undo2 } from 'lucide-react';
import { dayHeading } from '@/lib/calendar-recipe';
import { SCHEDULE_SCREEN_WORDS as W } from '@/lib/club-schedule-words';
import { HAND_BACK_WORDS as H } from '@/lib/club-hand-back-words';
import { joinWithAnd } from '@/lib/utils';
import { cellKey, dropVerdict, heldWords, placeKey, slotTime, slotsByCell, type DropKind, type PlaceRow, type ScheduleAsk, type ScheduleView, type SharingRead, type SlotView } from '@/lib/club-schedule-view';
import sch from './Schedules.module.css';

export interface GridDrop { from: SlotView; to: SlotView; teamId: string; at: { left: number; top: number } }

interface Preview { key: string; kind: DropKind; reason: string; left: number; top: number }

export default function ScheduleGrid({
  view, days, rows, canDrag, dim, moved, asked, today, nameOf, colourOf, groupOf, sharing, onOpen, onDrop, onRefused,
}: {
  view: ScheduleView;
  days: readonly string[];
  rows: readonly PlaceRow[];
  /** Dragging is a computer's (§5.9): absent at phone width, and on a schedule a reader can't change. */
  canDrag: boolean;
  /** A slot outside the Team filter or Clashes only: dimmed, never hidden (C9's spirit). */
  dim: (s: SlotView) => boolean;
  /** Slots changed in this visit — ringed in amber until the next send. */
  moved: ReadonlySet<string>;
  /** The Sundays a waiting ask counts, by slot id (`askedSlots`) — ringed with Hand back's glyph (D1). */
  asked: ReadonlyMap<string, ScheduleAsk>;
  today: string;
  nameOf: (teamId: string) => string;
  colourOf: (teamId: string) => string;
  groupOf: (teamId: string) => string | null;
  /** The schedule's sharing rules read against its teams — a slot's room (Stage 11c). */
  sharing: SharingRead;
  onOpen: (s: SlotView) => void;
  onDrop: (d: GridDrop) => void;
  /** A refused drop's reason, for the page to say (a screen reader hears it; the tip said it while dragging). */
  onRefused: (reason: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [dragging, setDragging] = useState<{ slot: SlotView; teamId: string } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  /** The slot the last verdict was for (a ref, so a handler the drag library kept still reads it). */
  const verdictKey = useRef<string | null>(null);
  const byKey = useMemo(() => new Map(view.slots.map(s => [s.key, s])), [view.slots]);
  // Each cell's slots, found once per read — a drag re-renders every cell as the pointer crosses them.
  const byCell = useMemo(() => slotsByCell(view.slots), [view.slots]);
  const placeOf = useMemo(() => {
    const out = new Map<string, string>();
    for (const p of view.places) {
      out.set(placeKey(p.venueId, null), p.venueName);
      for (const fac of p.facilities) out.set(placeKey(p.venueId, fac.id), fac.name);
    }
    return (x: SlotView) => out.get(placeKey(x.venueId, x.facilityId)) ?? '';
  }, [view.places]);

  const verdictFor = (fromKey: string, teamId: string, toKey: string) => {
    const from = byKey.get(fromKey), to = byKey.get(toKey);
    if (!from || !to) return { kind: 'none' as DropKind, reason: '' };
    return dropVerdict({ slots: view.slots, from, to, teamId, sharing, settings: view.schedule.settings, nameOf, placeOf, groupOf });
  };
  const parse = (id: string | number) => { const [key, teamId] = String(id).split('::'); return { key, teamId }; };

  const onStart = (e: DragStartEvent) => {
    const { key, teamId } = parse(e.active.id);
    const slot = byKey.get(key);
    verdictKey.current = null;
    if (slot) setDragging({ slot, teamId });
  };
  const onMove = (e: DragMoveEvent) => {
    if (!e.over) { verdictKey.current = null; setPreview(null); return; }
    const toKey = String(e.over.id);
    // A verdict only when the pointer reaches another slot — a drag fires a move event every frame.
    if (verdictKey.current === toKey) return;
    verdictKey.current = toKey;
    const { key, teamId } = parse(e.active.id);
    const v = verdictFor(key, teamId, toKey);
    const rect = e.over.rect;
    setPreview({ key: toKey, kind: v.kind, reason: v.reason, left: rect.left, top: rect.top });
  };
  const onEnd = (e: DragEndEvent) => {
    setDragging(null);
    setPreview(null);
    if (!e.over) return;
    const { key, teamId } = parse(e.active.id);
    const from = byKey.get(key), to = byKey.get(String(e.over.id));
    if (!from || !to) return;
    const v = verdictFor(key, teamId, to.key);
    // Refused: nothing is sent and the chip springs back where it was (the Timeline's A37).
    if (v.kind === 'bad') { onRefused(v.reason); return; }
    if (v.kind === 'none') return;
    onDrop({ from, to, teamId, at: { left: e.over.rect.left, top: e.over.rect.top + e.over.rect.height } });
  };

  const cols = `7.25rem repeat(${days.length}, minmax(0, 1fr))`;
  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onStart} onDragMove={onMove} onDragEnd={onEnd}
      onDragCancel={() => { setDragging(null); setPreview(null); }}>
      <div className={sch.grid} style={{ gridTemplateColumns: cols }} role="grid" aria-label="The schedule, a week at a time">
        <div className={sch.gh} role="columnheader">{W.facilityHead}</div>
        {days.map(d => (
          <div key={d} className={`${sch.gh}${d === today ? ` ${sch.ghToday}` : ''}`} role="columnheader">{dayHeading(d, today)}</div>
        ))}
        {rows.map(r => (
          <RowCells key={r.key} row={r} days={days} byCell={byCell} canDrag={canDrag} dim={dim} moved={moved} asked={asked}
            preview={preview} draggingKey={dragging?.slot.key ?? null} nameOf={nameOf} colourOf={colourOf} placeOf={placeOf} onOpen={onOpen} />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className={sch.dragGhost} style={{ '--tc': colourOf(dragging.teamId) } as CSSProperties}>
            {slotTime(dragging.slot)} · {nameOf(dragging.teamId)}
          </div>
        )}
      </DragOverlay>
      {preview && preview.kind !== 'none' && (
        <div className={`${sch.dropTip}${preview.kind === 'bad' ? ` ${sch.dropTipBad}` : ''}`} style={{ left: preview.left, top: Math.max(4, preview.top - 34) }} aria-hidden>
          {(() => { const to = byKey.get(preview.key); return to && preview.kind !== 'bad' ? `${dayHeading(to.day, '')} · ${slotTime(to)} · ${placeOf(to)} · ${preview.reason}` : preview.reason; })()}
        </div>
      )}
    </DndContext>
  );
}

function RowCells({ row, days, byCell, canDrag, dim, moved, asked, preview, draggingKey, nameOf, colourOf, placeOf, onOpen }: {
  row: PlaceRow; days: readonly string[]; byCell: ReadonlyMap<string, SlotView[]>; canDrag: boolean;
  dim: (s: SlotView) => boolean; moved: ReadonlySet<string>; asked: ReadonlyMap<string, ScheduleAsk>; preview: Preview | null; draggingKey: string | null;
  nameOf: (id: string) => string; colourOf: (id: string) => string; placeOf: (s: SlotView) => string; onOpen: (s: SlotView) => void;
}) {
  return (
    <>
      <div className={sch.fc} role="rowheader">{row.name}{row.facilityId && <small>{row.venueName}</small>}</div>
      {days.map(d => {
        const list = byCell.get(cellKey(row.key, d)) ?? [];
        if (!list.length) return <div key={d} className={`${sch.cc} ${sch.ccNone}`} role="gridcell">{W.noTime}</div>;
        return (
          <div key={d} className={sch.cc} role="gridcell">
            {list.map(s => (
              <SlotChip key={s.key} s={s} canDrag={canDrag} dimmed={dim(s)} moved={moved.has(s.key)} ask={asked.get(s.id) ?? null}
                over={preview?.key === s.key ? preview.kind : null} dragging={draggingKey === s.key}
                nameOf={nameOf} colourOf={colourOf} placeOf={placeOf} onOpen={onOpen} />
            ))}
          </div>
        );
      })}
    </>
  );
}

function SlotChip({ s, canDrag, dimmed, moved, ask, over, dragging, nameOf, colourOf, placeOf, onOpen }: {
  s: SlotView; canDrag: boolean; dimmed: boolean; moved: boolean; ask: ScheduleAsk | null; over: DropKind | null; dragging: boolean;
  nameOf: (id: string) => string; colourOf: (id: string) => string; placeOf: (s: SlotView) => string; onOpen: (s: SlotView) => void;
}) {
  const { setNodeRef: dropRef } = useDroppable({ id: s.key, disabled: !canDrag });
  const one = s.teamIds.length === 1 ? s.teamIds[0] : null;
  const drag = useDraggable({ id: `${s.key}::${one ?? ''}`, disabled: !canDrag || !one });
  const held = !s.teamIds.length && !!s.heldBy;
  const open = !s.teamIds.length && !s.heldBy;
  const handed = open && s.handedBack?.teamId ? nameOf(s.handedBack.teamId) : null;
  // A shared slot (Stage 11c): its names stacked and its edge in each team's colour, in equal parts.
  const shared = s.teamIds.length > 1;
  const who = s.teamIds.length ? joinWithAnd(s.teamIds.map(nameOf))
    : held ? heldWords(s.heldBy!)
    : handed ? W.handedBackSlot(handed)
    : W.openSlot;
  const edge = shared
    ? `linear-gradient(to bottom, ${s.teamIds.map((t, i) => `${colourOf(t)} ${(i * 100) / s.teamIds.length}% ${((i + 1) * 100) / s.teamIds.length}%`).join(', ')})`
    : undefined;
  const overCls = over === 'free' ? sch.slotOver : over === 'warn' ? sch.slotOverWarn : over === 'bad' ? sch.slotOverBad : '';
  const cls = [
    sch.slot, open ? sch.slotOpen : '', held ? sch.slotHeld : '', shared ? sch.slotShared : '', s.clash ? sch.slotClash : '', moved ? sch.slotMoved : '',
    ask ? sch.slotAsked : '', handed ? sch.slotHanded : '', dragging ? sch.slotDragging : '', overCls,
  ].filter(Boolean).join(' ');
  const label = `${slotTime(s)}, ${placeOf(s)}: ${who}${shared ? `, ${W.slotShared}` : ''}${s.locked ? ', locked' : ''}${s.clash ? ', clashes with a booking' : ''}${ask ? `, ${H.pill.toLowerCase()} by ${ask.teamName}` : ''}`;
  return (
    <button
      ref={el => { dropRef(el); drag.setNodeRef(el); }}
      type="button"
      className={cls}
      style={{ '--tc': one ? colourOf(one) : undefined, '--edge': edge, opacity: dimmed ? 0.35 : undefined } as CSSProperties}
      onClick={() => onOpen(s)}
      aria-haspopup="dialog"
      aria-label={label}
      data-slot-chip
      {...(canDrag && one ? drag.listeners : {})}
    >
      {(s.locked || s.clash) && (
        <span className={sch.slotIcons} aria-hidden>
          {s.clash && <AlertTriangle size={12} className={sch.flagIcon} />}
          {s.locked && <Lock size={11} />}
        </span>
      )}
      <span className={sch.slotTime}>{slotTime(s)}</span>
      {shared
        ? <span className={sch.slotWho}>{s.teamIds.map(t => <span key={t} className={sch.slotName}>{nameOf(t)}</span>)}</span>
        : <span className={sch.slotWho}>{who}</span>}
      {ask && <Undo2 size={12} className={sch.slotAskGlyph} aria-hidden />}
    </button>
  );
}
