'use client';
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { GripVertical, Plus, Shuffle, Trash2 } from 'lucide-react';
import {
  MAX_GROUPS, drawGroups, groupLabel, movePlayerToGroup, newPracticePlanId, unplacedPlayers,
  type DrawMode, type PracticeGroup, type PracticeRotation,
} from '@/lib/rep-practice-plan';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import { CoachToolbarMenu, CoachToolbarMenuItem, CoachToolbarMenuSeparator } from '@/components/coaches/CoachToolbarMenu';
import { useDialogFloor } from '@/components/coaches/useDialogFloor';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * The GROUPS ROOM — where a rotating block's groups are drawn and arranged (practices
 * re-evaluation, stage 3 revision; owner rulings D9 · D10 · D11 · D12, 2026-09-16, drawn on the
 * hub as "B · the Groups room" and "B · after Done").
 *
 * The block itself only READS its groups back (one quiet line each, under the grid) with one
 * door, "Edit groups ›", into here. Inside: the draw as a two-way switch (how many groups ·
 * players per group) with the number beside it and the pool named; a dashed "Not in a group"
 * column; one column per group (its name, its players as chips, a bin); "+ Add a group"; Done.
 *
 * ⚠ **A chip moves two ways, and the tap is the one that must always work** (D10). Drag a chip
 * onto another column with a mouse, or press-and-hold on a phone; OR press the chip — it is the
 * portal's own action menu (`CoachToolbarMenu`, `variant="chip"`) listing the other groups and
 * "Not in a group". The menu is the whole path on a phone and for a keyboard; drag is a
 * convenience on top of it. Drag activates only after six pixels of mouse travel or a quarter
 * second's press, so a tap is never a lift and a scroll is never a drag; once a drag has begun
 * the kit swallows the click that would otherwise open the menu on the drop.
 *
 * ⚠ **A drop lands in ROSTER order, never where the chip was let go** (`movePlayerToGroup`) — no
 * list anywhere in the practice may imply a ranking (§4). Nothing here sorts by ability; the draw
 * never did (D21) and the room does not either.
 *
 * ⚠ **The pool is computed, never stored** (`unplacedPlayers`: roster minus the groups). It is
 * where a binned group's players reappear — the bin used to drop them out of the rotation with
 * nothing naming them, the one place D21's "named, never silently dropped" was not kept.
 *
 * Every change writes straight through to the plan (the coach-editing model: editing surfaces
 * autosave). Done only closes.
 */

/** The dnd-kit id of the pool column — every other droppable id is a group's own id. */
const POOL = 'pool';

const DRAW_GROUP_SIZES = [2, 3, 4, 5, 6, 7, 8];

type DrawChoice = { mode: DrawMode; n: number };

export type PracticeGroupsRoomProps = {
  blockTitle: string;
  rotation: PracticeRotation;
  /** The NAMED stations — the draw's default count: one group per station. */
  stationCount: number;
  /** Tonight's roster in ROSTER order — the pool column and every drop are sorted by it. */
  roster: readonly { id: string }[];
  /** Ids that have NOT replied yes — dashed chips, and the pool column's caption. Empty when
   *  attendance is unknown (then nobody is singled out). */
  notReplied: ReadonlySet<string>;
  /** Only players who replied yes enter a draw (D21); with no attendance known the whole roster
   *  does. */
  drawPool: readonly { id: string }[];
  attendanceKnown: boolean;
  nameOf: (playerId: string) => string;
  onSetRotation: (patch: Partial<PracticeRotation>) => void;
  onClose: () => void;
};

export default function PracticeGroupsRoom({
  blockTitle, rotation, stationCount, roster, notReplied, drawPool, attendanceKnown, nameOf, onSetRotation, onClose,
}: PracticeGroupsRoomProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFloor(true, panelRef, { onClose });

  const rosterOrder = useMemo(() => roster.map(p => p.id), [roster]);
  const unplaced = useMemo(() => unplacedPlayers(roster, rotation.groups), [roster, rotation.groups]);
  const groups = rotation.groups;

  /* The draw's one value — the count, said one of two ways. Null = follow the station count,
     which is the sensible default (one group per station); once the coach picks it is theirs. */
  const [choice, setChoice] = useState<DrawChoice | null>(null);
  const draw: DrawChoice = choice ?? { mode: 'groups', n: Math.max(2, Math.min(stationCount, MAX_GROUPS)) };
  const groupCounts = Array.from({ length: MAX_GROUPS - 1 }, (_, i) => i + 2);
  const counts = draw.mode === 'groups' ? groupCounts : DRAW_GROUP_SIZES;
  const setMode = (mode: DrawMode) => {
    if (mode === draw.mode) return;
    // Switching the WAY keeps a number that makes sense in the new way, else the nearest one.
    const options = mode === 'groups' ? groupCounts : DRAW_GROUP_SIZES;
    setChoice({ mode, n: options.includes(draw.n) ? draw.n : options[Math.min(options.length - 1, 1)] });
  };

  /* A moved chip re-mounts in its new column, so the button that had focus is gone; the chip
     takes focus again where it landed (a keyboard coach moving several names stays in the room
     rather than falling to the page body — the menu's own "and then where?" rule). */
  const [settled, setSettled] = useState<{ playerId: string; at: number } | null>(null);
  const move = (playerId: string, groupId: string | null) => {
    const next = movePlayerToGroup(rotation, playerId, groupId, rosterOrder);
    if (next === rotation) return;
    onSetRotation({ groups: next.groups, groupSource: next.groupSource });
    setSettled({ playerId, at: Date.now() });
  };

  /* Drag: a mouse after six pixels, a finger after a quarter-second hold (a scroll moves sooner
     and cancels it). The lifted chip is drawn in an overlay portaled to the body so the modal's
     scrolling pane cannot clip it. */
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
  );
  const [lifted, setLifted] = useState<string | null>(null);
  const onDragStart = (e: DragStartEvent) => setLifted(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setLifted(null);
    if (!e.over) return;
    move(String(e.active.id), e.over.id === POOL ? null : String(e.over.id));
  };

  const addGroup = () => onSetRotation({
    groups: [...groups, { id: newPracticePlanId(), name: groupLabel(groups.length), playerIds: [] }],
    groupSource: 'manual',
  });
  const removeGroup = (groupId: string) => onSetRotation({ groups: groups.filter(g => g.id !== groupId) });
  const renameGroup = (groupId: string, name: string) =>
    onSetRotation({ groups: groups.map(g => (g.id === groupId ? { ...g, name } : g)) });

  const notRepliedUnplaced = unplaced.filter(p => notReplied.has(p.id)).length;

  return (
    <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Groups — ${blockTitle}`}
        className={`${styles.modal} ${styles.modalWide} ${styles.modalScrollBody} ${styles.ppGroupsRoom}`}>
        <CoachModalHeader onClose={onClose} closeAriaLabel="Close" title="Groups" />

        <div className={`${styles.scrollPane} ${styles.ppGroupsBody}`}>
          {/* ── The draw: the way as a switch, the number beside it, the pool named, the button.
              Deliberately dumb — a shuffle and a deal (D21); press again to re-draw. ── */}
          <div className={styles.ppDrawRow}>
            <span className={styles.ppDrawWay} role="group" aria-label="How to draw the groups">
              <button type="button" className={styles.ppQuickChip} aria-pressed={draw.mode === 'groups'}
                data-on={draw.mode === 'groups' ? 'on' : undefined} onClick={() => setMode('groups')}>How many groups</button>
              <button type="button" className={styles.ppQuickChip} aria-pressed={draw.mode === 'perGroup'}
                data-on={draw.mode === 'perGroup' ? 'on' : undefined} onClick={() => setMode('perGroup')}>Players per group</button>
            </span>
            <select className={`${styles.input} ${styles.ppDrawSelect}`} value={draw.n}
              aria-label={draw.mode === 'groups' ? 'How many groups' : 'Players per group'}
              onChange={e => setChoice({ mode: draw.mode, n: Number(e.target.value) })}>
              {counts.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className={styles.ppRotQuiet}>from {attendanceKnown ? 'who replied' : 'the whole roster'}</span>
            <button type="button" className={styles.ppDrawBtn} disabled={drawPool.length === 0}
              onClick={() => onSetRotation({ groups: drawGroups(drawPool.map(p => p.id), draw.mode, draw.n), groupSource: 'random' })}>
              <Shuffle size={13} aria-hidden /> {rotation.groupSource === 'random' ? 'Draw again' : 'Draw'}
            </button>
          </div>

          <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setLifted(null)}>
            <div className={styles.ppGroupCols} data-lifting={lifted ? 'on' : undefined}>
              {/* The pool — where everyone starts, where a binned group lands, the way OUT of a group. */}
              <GroupColumn id={POOL} pool head={<span className={styles.ppGroupPoolName}>Not in a group</span>}
                foot={notRepliedUnplaced > 0
                  ? <span className={styles.ppGroupColHint}>{notRepliedUnplaced === 1 ? "1 hasn't" : `${notRepliedUnplaced} haven't`} replied yes</span>
                  : null}>
                {unplaced.length === 0 && <span className={styles.ppRailNone}>nobody</span>}
                {unplaced.map(p => (
                  <PlayerChip key={p.id} playerId={p.id} name={nameOf(p.id)} inGroup={null} groups={groups}
                    noReply={notReplied.has(p.id)} onMove={move} settled={settled} />
                ))}
              </GroupColumn>
              {groups.map(group => (
                <GroupColumn key={group.id} id={group.id}
                  head={
                    <input className={`${styles.input} ${styles.ppGroupName}`} value={group.name} maxLength={60}
                      aria-label="Group name" onChange={e => renameGroup(group.id, e.target.value)} />
                  }
                  foot={
                    <button type="button" className={styles.ppIconBtn} aria-label={`Remove ${group.name}`}
                      onClick={() => removeGroup(group.id)}><Trash2 size={14} /></button>
                  }>
                  {group.playerIds.length === 0 && <span className={styles.ppRailNone}>nobody yet</span>}
                  {group.playerIds.map(pid => (
                    <PlayerChip key={pid} playerId={pid} name={nameOf(pid)} inGroup={group.id} groups={groups}
                      noReply={notReplied.has(pid)} onMove={move} settled={settled} />
                  ))}
                </GroupColumn>
              ))}
            </div>
            {typeof document !== 'undefined' && createPortal(
              <DragOverlay dropAnimation={null} zIndex={1200}>
                {lifted && (
                  <span className={`${styles.ppChip} ${styles.ppGroupChipLifted}`}>
                    <GripVertical size={13} aria-hidden /> {nameOf(lifted)}
                  </span>
                )}
              </DragOverlay>,
              document.body,
            )}
          </DndContext>
        </div>

        <div className={styles.modalFooter}>
          {groups.length < MAX_GROUPS ? (
            <button type="button" className={styles.ppAddInline} onClick={addGroup}>
              <Plus size={13} aria-hidden /> Add a group
            </button>
          ) : <span />}
          <button type="button" className={styles.btnPrimary} onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

/** A column is a drop target — the row under the pointer says so (`data-over`), and while any
 *  chip is lifted every column shows its edge (`data-lifting` on the grid). */
function GroupColumn({ id, pool = false, head, foot, children }: {
  id: string;
  pool?: boolean;
  head: ReactNode;
  foot: ReactNode;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${styles.ppGroupCol}${pool ? ` ${styles.ppGroupColPool}` : ''}`}
      data-over={isOver ? 'on' : undefined}>
      <div className={styles.ppGroupColHead}>{head}</div>
      <div className={styles.ppGroupChips}>{children}</div>
      {foot && <div className={styles.ppGroupColFoot}>{foot}</div>}
    </div>
  );
}

/**
 * One player: the chip is the menu's trigger (the tap path) AND the drag handle (the mouse path).
 * The drag listeners sit on a wrapper around the menu's own button so the menu keeps ownership of
 * its trigger; a lift that never activates leaves the click to the button, and one that does is
 * swallowed by the kit. With nowhere to move to — no groups yet and the chip already in the pool —
 * it is a plain pill: a control that exists only to refuse should not exist.
 */
function PlayerChip({ playerId, name, inGroup, groups, noReply, onMove, settled }: {
  playerId: string;
  name: string;
  inGroup: string | null;
  groups: readonly PracticeGroup[];
  noReply: boolean;
  onMove: (playerId: string, groupId: string | null) => void;
  /** The chip that just landed, and when — it takes focus where it now stands. */
  settled: { playerId: string; at: number } | null;
}) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: playerId, data: { from: inGroup } });
  const wrapRef = useRef<HTMLSpanElement>(null);
  const landedAt = settled?.playerId === playerId ? settled.at : null;
  /* Before paint, so it wins the menu's one-frame focus rescue (which yields to anything that
     has already claimed focus) rather than racing it. */
  useLayoutEffect(() => {
    if (landedAt === null) return;
    wrapRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }, [landedAt]);
  const others = groups.filter(g => g.id !== inGroup);
  const destinations = others.length + (inGroup ? 1 : 0);
  if (destinations === 0) {
    return <span className={styles.ppChip} data-reply={noReply ? 'no' : undefined}>{name}</span>;
  }
  return (
    <span ref={el => { setNodeRef(el); wrapRef.current = el; }} {...listeners} className={styles.ppGroupChip}
      data-reply={noReply ? 'no' : undefined} data-lifted={isDragging ? 'on' : undefined}>
      <CoachToolbarMenu label={name} variant="chip" icon={<GripVertical size={13} aria-hidden />}>
        {others.map(g => (
          <CoachToolbarMenuItem key={g.id} label={`Move to ${g.name || 'the unnamed group'}`} onSelect={() => onMove(playerId, g.id)} />
        ))}
        {inGroup && others.length > 0 && <CoachToolbarMenuSeparator />}
        {inGroup && <CoachToolbarMenuItem label="Not in a group" onSelect={() => onMove(playerId, null)} />}
      </CoachToolbarMenu>
    </span>
  );
}
