'use client';
import { useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, DragOverlay, MeasuringStrategy, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { ChevronRight, ChevronUp, GripVertical, MoreHorizontal, Plus, Shuffle, Trash2 } from 'lucide-react';
import {
  MAX_GROUPS, drawGroups, groupLabel, movePlayerToGroup, newPracticePlanId, unplacedPlayers,
  type DrawMode, type PracticeGroup, type PracticeRotation,
} from '@/lib/rep-practice-plan';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import { CoachToolbarMenu, CoachToolbarMenuItem, CoachToolbarMenuSeparator } from '@/components/coaches/CoachToolbarMenu';
import { useDialogFloor } from '@/components/coaches/useDialogFloor';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
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
 *
 * ON A PHONE (practice plans on a phone · owner rulings G1–G3 = A, 2026-09-24 — the room spent its
 * top on the draw and each group on a name box, so the third group started under the bar), decided
 * in JS because the SHAPE differs: **G1** once groups exist the draw folds to one line — "⤮ 3 groups
 * · from who replied · Change ›" — that opens today's controls in place and never redraws by itself;
 * **G2** a group's head is its name and count ("Group A · 4") with a ⋯ for Rename (the name becomes
 * a box in place) and Delete (its players go to Not in a group, no question — nothing is lost);
 * **G3** the chips drop their ⠿ dots (the stylesheet, so no chip listens for the width). The desk
 * keeps every control it has.
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

  /* WHO the draw deals from (owner, §227 walk 2026-09-23 — revising D21's "only who replied yes"):
     a team that doesn't track attendance here has a handful of stray replies, and "who replied"
     would deal a draw of three. So once replies exist the coach can say "the whole team"; with
     none, the whole team is the only pool and the line says so. D21's real rule is untouched —
     nobody is dropped silently: a no-reply player still wears the dashed chip wherever they land.
     Local to this visit on purpose: a draw is a one-off act, not a setting. */
  const [poolChoice, setPoolChoice] = useState<'replied' | 'team'>('replied');
  const fromTeam = !attendanceKnown || poolChoice === 'team';
  const pool = fromTeam ? roster : drawPool;

  /* ── The phone's shape (G1 · G2). One listener for the room, never one per chip. ── */
  const phone = useIsPhone();
  const drawId = useId();
  // G1: folded by default once groups exist; a block with none opens with the draw showing.
  const [drawOpen, setDrawOpen] = useState(false);
  const showDraw = !phone || groups.length === 0 || drawOpen;
  // G2: the one group whose name is a box right now, and where focus goes when a head changes
  // shape under it (the ⋯ that was pressed is gone) — the menu's "and then where?" rule.
  const [renaming, setRenaming] = useState<string | null>(null);
  const [refocus, setRefocus] = useState<{ groupId: string | null; at: number } | null>(null);
  useLayoutEffect(() => {
    if (!refocus) return;
    const target = refocus.groupId === null ? null
      : panelRef.current?.querySelector<HTMLElement>(`[data-group-more="${refocus.groupId}"] button`);
    (target ?? panelRef.current)?.focus({ preventScroll: true });
  }, [refocus]);
  const deleteGroup = (groupId: string) => {
    const at = groups.findIndex(g => g.id === groupId);
    const neighbour = groups[at + 1] ?? groups[at - 1] ?? null;
    removeGroup(groupId);
    setRefocus(r => ({ groupId: neighbour?.id ?? null, at: (r?.at ?? 0) + 1 }));
  };
  // Enter / Escape hand focus back to the ⋯; leaving the box by tapping elsewhere keeps the tap's own
  // target — pulling focus back to the ⋯ would steal it from whatever the coach just pressed.
  const endRename = (groupId: string, refocusMore: boolean) => {
    setRenaming(null);
    if (refocusMore) setRefocus(r => ({ groupId, at: (r?.at ?? 0) + 1 }));
  };

  return (
    <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Groups — ${blockTitle}`}
        className={`${styles.modal} ${styles.modalWide} ${styles.modalScrollBody} ${styles.ppGroupsRoom}`}>
        <CoachModalHeader onClose={onClose} closeAriaLabel="Close" title="Groups" />

        <div className={`${styles.scrollPane} ${styles.ppGroupsBody}`}>
          {/* ── The draw: the way as a switch, the number beside it, the pool named, the button.
              Deliberately dumb — a shuffle and a deal (D21); press again to re-draw.
              On a phone, once groups exist, it folds to one line (G1): the line only opens and closes
              the controls — it never draws, so a stray tap cannot reshuffle anyone. ── */}
          {phone && groups.length > 0 && (
            <button type="button" className={styles.ppDrawSummary} aria-expanded={drawOpen} aria-controls={drawId}
              onClick={() => setDrawOpen(v => !v)}>
              <Shuffle size={14} aria-hidden />
              <b>{groups.length} {groups.length === 1 ? 'group' : 'groups'}</b>
              <span>· from {fromTeam ? 'the whole team' : 'who replied'}</span>
              <span className={styles.ppDrawSummaryDoor}>
                {drawOpen ? <>Close <ChevronUp size={14} aria-hidden /></> : <>Change <ChevronRight size={14} aria-hidden /></>}
              </span>
            </button>
          )}
          {showDraw && (
          <div id={drawId} className={styles.ppDrawRow}>
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
            {attendanceKnown ? (
              <select className={`${styles.input} ${styles.ppDrawSelect}`} value={poolChoice}
                aria-label="Draw from" onChange={e => setPoolChoice(e.target.value === 'team' ? 'team' : 'replied')}>
                <option value="replied">Who replied</option>
                <option value="team">Whole team</option>
              </select>
            ) : (
              <span className={styles.ppRotQuiet}>from the whole team</span>
            )}
            <button type="button" className={styles.ppDrawBtn} disabled={pool.length === 0}
              onClick={() => onSetRotation({ groups: drawGroups(pool.map(p => p.id), draw.mode, draw.n), groupSource: 'random' })}>
              <Shuffle size={13} aria-hidden /> {rotation.groupSource === 'random' ? 'Draw again' : 'Draw'}
            </button>
          </div>
          )}

          <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setLifted(null)}
            /* The pool column mounts MID-drag (everyone placed) and pushes the groups down — the
               droppables must be re-measured during the drag, not snapshotted at the lift. */
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}>
            <div className={styles.ppGroupCols} data-lifting={lifted ? 'on' : undefined}>
              {/* The pool — where everyone starts, where a binned group lands, the way OUT of a group.
                  ABSENT when everyone is placed (owner, §227 walk 2026-09-23): an empty dashed tile
                  saying "nobody" is a row of nothing. While a chip is HELD it comes back in its own
                  place above the first group, so there is always somewhere to drop a player out —
                  the owner's call over a floating target (the groups slide down on the lift, as
                  they sit whenever the pool has someone in it). The chip's menu is the other way. */}
              {(unplaced.length > 0 || lifted) && (
                <GroupColumn id={POOL} pool
                  /* On a phone the no-reply count rides the name, as a group's count does (G2's head) —
                     a foot row for one caption was a row of nothing. */
                  head={
                    <span className={styles.ppGroupPoolName}>
                      Not in a group
                      {phone && notRepliedUnplaced > 0 && (
                        <span className={styles.ppGroupHeadingCount}>&nbsp;· {notRepliedUnplaced === 1 ? "1 hasn't" : `${notRepliedUnplaced} haven't`} replied yes</span>
                      )}
                    </span>
                  }
                  foot={!phone && notRepliedUnplaced > 0
                    ? <span className={styles.ppGroupColHint}>{notRepliedUnplaced === 1 ? "1 hasn't" : `${notRepliedUnplaced} haven't`} replied yes</span>
                    : null}>
                  {unplaced.length === 0 && <span className={styles.ppGroupColHint}>Drop here to take them out of their group</span>}
                  {unplaced.map(p => (
                    <PlayerChip key={p.id} playerId={p.id} name={nameOf(p.id)} inGroup={null} groups={groups}
                      noReply={notReplied.has(p.id)} onMove={move} settled={settled} />
                  ))}
                </GroupColumn>
              )}
              {groups.map(group => (
                <GroupColumn key={group.id} id={group.id}
                  /* The bin rides the name's row (owner, §227 walk) — a whole foot row for one icon
                     was a row of nothing on a phone. On a phone the head is the name and its count
                     with a ⋯ (G2); the box appears only while renaming. */
                  head={phone ? (
                    <PhoneGroupHead group={group} renaming={renaming === group.id}
                      onRename={name => renameGroup(group.id, name)}
                      onStartRename={() => setRenaming(group.id)}
                      onEndRename={refocusMore => endRename(group.id, refocusMore)}
                      onDelete={() => deleteGroup(group.id)} />
                  ) : (
                    <>
                      <input className={`${styles.input} ${styles.ppGroupName}`} value={group.name} maxLength={60}
                        aria-label="Group name" onChange={e => renameGroup(group.id, e.target.value)} />
                      <button type="button" className={styles.ppIconBtn} aria-label={`Remove ${group.name}`}
                        onClick={() => removeGroup(group.id)}><Trash2 size={14} /></button>
                    </>
                  )}
                  foot={null}>
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

        {/* ⚠ No "Done" on a phone (§231 walk, owner 2026-09-25 — "remove the done from the group
            screen"): it only closed the room, which the head's ← and the back gesture already do; the
            groups save as they change. A desk keeps it beside its ×. On a phone the foot is
            "+ Add a group" alone, pinned LEFT so it never lands where a thumb used to find Done — and
            a room at its limit has no foot. */}
        {(!phone || groups.length < MAX_GROUPS) && (
          <div className={styles.modalFooter}>
            {groups.length < MAX_GROUPS ? (
              <button type="button" className={styles.ppAddInline} onClick={addGroup}>
                <Plus size={13} aria-hidden /> Add a group
              </button>
            ) : <span />}
            {!phone && <button type="button" className={styles.btnPrimary} onClick={onClose}>Done</button>}
          </div>
        )}
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
 * A group's head on a phone (G2): its name and how many are in it, and a ⋯ holding Rename and
 * Delete. Rename turns the name into a box IN PLACE — every keystroke writes, as the desk's box
 * does — and Enter, Escape or leaving the box ends it (`data-escape-owner`: the room's floor leaves
 * that Escape to the box rather than closing the room). The box takes focus before paint, so it
 * wins the menu's one-frame focus rescue rather than racing it.
 */
function PhoneGroupHead({ group, renaming, onRename, onStartRename, onEndRename, onDelete }: {
  group: PracticeGroup;
  renaming: boolean;
  onRename: (name: string) => void;
  onStartRename: () => void;
  /** `true` from Enter / Escape (focus returns to the ⋯); `false` from leaving the box. */
  onEndRename: (refocusMore: boolean) => void;
  onDelete: () => void;
}) {
  const boxRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (!renaming) return;
    boxRef.current?.focus({ preventScroll: true });
    boxRef.current?.select();
  }, [renaming]);
  const label = group.name || 'Unnamed group';
  if (renaming) {
    return (
      <input ref={boxRef} className={`${styles.input} ${styles.ppGroupName}`} value={group.name} maxLength={60}
        aria-label="Group name" data-escape-owner="" enterKeyHint="done"
        onChange={e => onRename(e.target.value)}
        onBlur={() => onEndRename(false)}
        onKeyDown={e => {
          if (e.key !== 'Enter' && e.key !== 'Escape') return;
          e.preventDefault();
          onEndRename(true);
        }} />
    );
  }
  return (
    <>
      <span className={styles.ppGroupHeading}>
        {label}<span className={styles.ppGroupHeadingCount}>&nbsp;· {group.playerIds.length}</span>
      </span>
      <span className={styles.ppGroupMore} data-group-more={group.id}>
        <CoachToolbarMenu label={`${label}: rename or delete`} variant="glyph" icon={<MoreHorizontal size={18} aria-hidden />}>
          <CoachToolbarMenuItem label={`Rename ${label}`} onSelect={onStartRename} />
          <CoachToolbarMenuItem label={`Delete ${label}`} onSelect={onDelete} />
        </CoachToolbarMenu>
      </span>
    </>
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
      <CoachToolbarMenu label={name} variant="chip" triggerClassName={styles.ppGroupChipTrigger}
        icon={<GripVertical size={13} aria-hidden className={styles.ppGroupGrip} />}>
        {others.map(g => (
          <CoachToolbarMenuItem key={g.id} label={`Move to ${g.name || 'the unnamed group'}`} onSelect={() => onMove(playerId, g.id)} />
        ))}
        {inGroup && others.length > 0 && <CoachToolbarMenuSeparator />}
        {inGroup && <CoachToolbarMenuItem label="Not in a group" onSelect={() => onMove(playerId, null)} />}
      </CoachToolbarMenu>
    </span>
  );
}
