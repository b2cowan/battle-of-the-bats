'use client';

/**
 * ScheduleTimeline (D2.1) — read-only venue × time grid: facilities across the
 * columns, time down the rows, each game a positioned block. Cross-division.
 *
 * Two scope modes (the scope control):
 *  - All divisions: every facility column + every division's games.
 *  - Single division: only that division's games AND only the facilities it uses;
 *    BUT conflict detection still runs over ALL games, so a clash with a foreign
 *    division on a shown facility is surfaced as a faded "ghost" block.
 *
 * Moving (Tournament admin redesign Stage 3, S4 — A36, A37): every game of the day is on the grid, whatever the
 * Filter (it highlights; a drop must see what is taken). A drag lands on a 15-minute grid; a drop that would put two
 * games of the tournament on one diamond turns the band red with its reason and springs back (the rule is
 * `lib/tournament-overlap.ts`, the server's own). Played games don't drag. On a phone a tap opens the move sheet.
 * The page asks a published game's question and ends every move in the notice with Undo.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, Plus } from 'lucide-react';
import { DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, pointerWithin, type DragEndEvent, type DragMoveEvent } from '@dnd-kit/core';
import type { Game, Division, Venue, Tournament, Team } from '@/lib/types';
import { resolveGameTiming, checkVenueConflict, toConflictGame, turnoverSide, type ConflictInfo, type ConflictResult } from '@/lib/schedule-conflict';
import { isRefusedOverlap, overlapOtherName, overlapOtherTimes, overlapPool, type OverlapGame } from '@/lib/tournament-overlap';
import { MOVE_WORDS as M, slotWords } from '@/lib/schedule-words';
import { bracketGameLabel } from '@/lib/playoff-bracket';
import { teamAvatarHue } from '@/lib/team-color';
import { formatTime, formatHour } from '@/lib/utils';
import { fieldNounFor } from '@/lib/sports';
import MoveSheet, { type MoveTarget } from './MoveSheet';
import styles from './ScheduleTimeline.module.css';
import { tournamentToday } from '@/lib/timezone';
import { useDismissable } from '@/lib/overlay-hooks';

/** SSR-safe `max-width` media-query hook — drives the touch (single-field) layout. */
function useIsMobile(maxWidth = 768): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [maxWidth]);
  return mobile;
}

const PX_PER_MIN = 1.15;
const SNAP = 15; // minutes — dragged blocks land on a 15-minute grid

function toMin(time?: string | null): number | null {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h)) return null;
  return h * 60 + (m || 0);
}

function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function hourLabel(min: number): string {
  return formatHour(Math.floor(min / 60));
}

function dayLabel(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

type Col = { key: string; venue: string; facility: string; venueId: string; facilityId: string };

type BlockDisplay = {
  top: number; height: number; accent: string; label: string; time: string;
  away: string; home: string; info: ConflictInfo | undefined; title: string;
};

/** One game block. Draggable (D2.2) when `draggable`; a click opens the game (`onOpen`, Stage 3 S2) — the drag
 * sensor waits for 5px, so a click is never a drag. On a phone a tap opens the reschedule sheet (`onSelect`) when
 * there is one, else the game. Ghosts are static. */
function TimelineBlock({ g, ghost, display, draggable, onSelect, onOpen }: {
  g: Game; ghost: boolean; display: BlockDisplay; draggable: boolean;
  onSelect?: () => void;
  onOpen?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: g.id, disabled: !draggable });
  const style: CSSProperties = {
    top: display.top,
    height: display.height,
    ['--accent' as string]: display.accent,
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    zIndex: isDragging ? 50 : undefined,
  };
  // Enter/Space does what a click does. A draggable block already carries the drag's button role and tab stop.
  const tap = draggable ? onOpen : (onSelect ?? onOpen);
  const interactiveProps = tap
    ? {
        onKeyDown: (e: ReactKeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(); }
        },
        onClick: tap,
        ...(draggable ? {} : { tabIndex: 0, role: 'button' as const }),
      }
    : {};
  return (
    <div
      ref={setNodeRef}
      className={`${styles.block} ${ghost ? styles.ghost : ''} ${draggable ? styles.draggable : ''} ${tap ? styles.selectable : ''} ${isDragging ? styles.dragging : ''}`}
      data-conflict={!ghost && display.info ? display.info.kind : undefined}
      data-status={g.status}
      style={style}
      title={display.title}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
      {...interactiveProps}
    >
      <div className={styles.blockTop}>
        <span className={styles.blockTime}>{display.time}</span>
        <span className={styles.blockDiv}>{display.label}</span>
        {!ghost && display.info && <AlertTriangle size={11} className={styles.blockWarn} aria-hidden />}
      </div>
      {display.height > 44 && (
        <div className={styles.blockTeams}>
          <span>{display.away}</span>
          <span className={styles.vs}>vs</span>
          <span>{display.home}</span>
        </div>
      )}
    </div>
  );
}

/** A facility column body — a drop target for game blocks. */
function DroppableCol({ colKey, axisHeight, hourLines, axisStart, children }: {
  colKey: string; axisHeight: number; hourLines: number[]; axisStart: number; children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: colKey });
  return (
    <div ref={setNodeRef} className={`${styles.colBody} ${isOver ? styles.colBodyOver : ''}`} style={{ height: axisHeight }}>
      {hourLines.map(m => (
        <div key={m} className={styles.gridLine} style={{ top: (m - axisStart) * PX_PER_MIN }} />
      ))}
      {children}
    </div>
  );
}

/** A card for an unscheduled game (no field). Draggable on desktop (drag onto a
 * column); on mobile pass `onSelect` to make it a tap target (opens the place sheet). */
function TrayCard({ g, label, sub, onSelect }: { g: Game; label: string; sub: string; onSelect?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: g.id, disabled: !!onSelect });
  if (onSelect) {
    return (
      <button type="button" className={`${styles.trayCard} ${styles.trayCardTap}`} onClick={onSelect}>
        <span className={styles.trayCardLabel}>{label}</span>
        <span className={styles.trayCardSub}>{sub}</span>
      </button>
    );
  }
  const style: CSSProperties = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    zIndex: isDragging ? 60 : undefined,
    opacity: isDragging ? 0.9 : undefined,
  };
  return (
    <div ref={setNodeRef} className={styles.trayCard} style={style} {...listeners} {...attributes}>
      <span className={styles.trayCardLabel}>{label}</span>
      <span className={styles.trayCardSub}>{sub}</span>
    </div>
  );
}

/** "+ Field" menu — add an existing facility as an empty column, or create a venue. */
function AddFieldMenu({ options, onAdd, onCreate }: {
  options: Col[]; onAdd: (key: string) => void; onCreate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismissable(open, ref, () => setOpen(false)); // also gains Escape-to-close
  return (
    <div className={styles.addFieldWrap} ref={ref}>
      <button type="button" className={styles.addFieldBtn} onClick={() => setOpen(o => !o)} title="Add a field column">
        <Plus size={14} aria-hidden /> Field
      </button>
      {open && (
        <div className={styles.addFieldMenu}>
          {options.length === 0 && <div className={styles.addFieldEmpty}>All fields shown</div>}
          {options.map(c => (
            <button key={c.key} type="button" className={styles.addFieldItem} onClick={() => { onAdd(c.key); setOpen(false); }}>
              {c.venue}{c.facility ? ` · ${c.facility}` : ''}
            </button>
          ))}
          {onCreate && (
            <button type="button" className={`${styles.addFieldItem} ${styles.addFieldCreate}`} onClick={() => { onCreate(); setOpen(false); }}>
              + Create venue…
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ScheduleTimeline({
  games,
  venues,
  divisions,
  teams,
  tournament,
  selection,
  stage,
  onMove,
  onOpen,
  onCreateVenue,
  zeroVenuePrompt,
  day,
  focus,
  eventDays,
  today: todayProp,
  tellsFor,
  conflictMap,
}: {
  games: Game[];
  venues: Venue[];
  divisions: Division[];
  teams: Team[];
  tournament: Tournament | null;
  /** Scope from the shared picker: a Set of division ids, or null = all. */
  selection: Set<string> | null;
  /** Current stage — flipping it snaps the day to the new stage's first date. */
  stage: string;
  /** Move a game — a drop, or the phone's sheet (which has already said who it tells). Omit (or locked) → read-only. */
  onMove?: (gameId: string, to: MoveTarget, how: 'drop' | 'sheet') => void | Promise<void>;
  /** Open a game's window (a click on its block, Stage 3 S2). */
  onOpen?: (g: Game) => void;
  /** Open the create-venue flow (for the "+ Field" menu). */
  onCreateVenue?: () => void;
  /** Rendered instead of the add-a-field hint when the tournament has ZERO venues —
   *  the setup prompt that stops typed-only schedules at the source (Phase 2). */
  zeroVenuePrompt?: ReactNode;
  /** The day shown — the page leads it (the schedule's day row, Stage 3 S1), so the screen has one way to change it. */
  day: string;
  /** The page's Filter and Search: the games it matches stand out, the rest stay on the grid faded (S4). */
  focus?: (g: Game) => boolean;
  /** The event's days (the move sheet's Day field) and today, when the page leads. */
  eventDays?: string[];
  today?: string;
  /** A published game on a plan with alerts: the move sheet's lime says it tells both teams. */
  tellsFor?: (g: Game) => boolean;
  /** The page's clash map (walk §294: one map for every view's chip, Filter and colour). */
  conflictMap: Map<string, ConflictInfo>;
}) {
  const divById = useMemo(() => new Map(divisions.map(d => [d.id, d])), [divisions]);
  // Pool is for block COLOR only (not selection) — derived from the teams' pool.
  const teamPoolMap = useMemo(() => new Map(teams.map(t => [t.id, t.poolId || ''])), [teams]);
  const gamePoolId = (g: Game) => g.isPlayoff ? '' : (teamPoolMap.get(g.homeTeamId) || teamPoolMap.get(g.awayTeamId) || '');
  const inScope = (g: Game) => (focus ? focus(g) : selection === null || selection.has(g.divisionId || ''));
  const narrowed = !!focus || selection !== null;
  const teamName = (id?: string | null, ph?: string | null) =>
    (id ? teams.find(t => t.id === id)?.name : null) || ph || 'TBD';

  const days = useMemo(
    () => Array.from(new Set(games.map(g => g.date).filter(Boolean) as string[])).sort(),
    [games],
  );
  const todayISO = tournamentToday();
  const [extraColumns, setExtraColumns] = useState<Set<string>>(new Set());
  const isMobile = useIsMobile(768);
  const [activeFieldIdx, setActiveFieldIdx] = useState(0); // mobile: which field column is shown
  const [sheetGame, setSheetGame] = useState<Game | null>(null); // mobile: game being moved/placed
  const touchStartX = useRef<number | null>(null);
  // Live drop preview while dragging (D2.4): where the block would land + the verdict.
  const [dragPreview, setDragPreview] = useState<{ colKey: string; top: number; height: number; kind: 'free' | 'buffer' | 'overlap'; time: string; reason?: string } | null>(null);
  // The last refused drop's reason, for a screen reader (the band said it while dragging).
  const [refusedNote, setRefusedNote] = useState('');
  // "Now" line — current time in minutes, ticked each minute.
  const [nowMin, setNowMin] = useState(() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); });
  useEffect(() => {
    const id = setInterval(() => { const d = new Date(); setNowMin(d.getHours() * 60 + d.getMinutes()); }, 60000);
    return () => clearInterval(id);
  }, []);
  // Reset the mobile field pager when the day or stage changes.
  useEffect(() => { setActiveFieldIdx(0); }, [day, stage]);

  // Lightweight conflict shape for ALL games — the drop's live check (the clash map itself is the page's).
  const conflictGames = useMemo<OverlapGame[]>(() => overlapPool(games, teams), [games, teams]);

  const facilityOf = (g: Game): Col | null => {
    if (!g.venueId && !g.venueFacilityId) return null;
    const venue = venues.find(v => v.id === g.venueId);
    if (g.venueFacilityId) {
      const fac = venue?.facilities?.find(f => f.id === g.venueFacilityId);
      return { key: g.venueFacilityId, venue: venue?.name ?? 'Venue', facility: fac?.name ?? '', venueId: g.venueId ?? '', facilityId: g.venueFacilityId };
    }
    if (venue) return { key: venue.id, venue: venue.name, facility: '', venueId: venue.id, facilityId: '' };
    return null;
  };

  // All facilities (for the "+ Field" menu + resolving user-added columns).
  const facilityCatalog = useMemo(() => {
    const m = new Map<string, Col>();
    venues.forEach(v => {
      if (v.facilities?.length) v.facilities.forEach(f => m.set(f.id, { key: f.id, venue: v.name, facility: f.name, venueId: v.id, facilityId: f.id }));
      else m.set(v.id, { key: v.id, venue: v.name, facility: '', venueId: v.id, facilityId: '' });
    });
    return m;
  }, [venues]);

  const dayGames = useMemo(() => games.filter(g => g.date === day), [games, day]);
  // `focus` is the page's Search and Filter: it must re-run with them (it was missing here, so the Timeline kept every game
  // in focus whatever was typed, §294). The page builds it fresh each render; a filter of one day's games is cheap.
  const focusedGames = useMemo(
    () => dayGames.filter(inScope),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dayGames, selection, focus],
  );

  // Columns: facilities used by the visible games (placed, with a time + facility).
  const columns = useMemo<Col[]>(() => {
    const map = new Map<string, Col>();
    dayGames.forEach(g => {
      if (!g.time) return;
      const f = facilityOf(g);
      if (f && !map.has(f.key)) map.set(f.key, f);
    });
    extraColumns.forEach(key => {
      if (!map.has(key)) { const c = facilityCatalog.get(key); if (c) map.set(key, c); }
    });
    return Array.from(map.values()).sort((a, b) =>
      `${a.venue}${a.facility}`.localeCompare(`${b.venue}${b.facility}`),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayGames, focusedGames, selection, venues, extraColumns, facilityCatalog]);

  const colKeys = useMemo(() => new Set(columns.map(c => c.key)), [columns]);

  // Unscheduled games (in scope, no field) → the draggable tray. Scoped to the
  // viewed day for games that already have a date; date-less games always show.
  const unplacedGames = useMemo(
    () => games.filter(g => inScope(g) && !g.venueFacilityId && !g.venueId && (!g.date || g.date === day)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [games, selection, day, focus],
  );
  const availableFields = useMemo(() => {
    const shown = new Set(columns.map(c => c.key));
    return Array.from(facilityCatalog.values()).filter(c => !shown.has(c.key));
  }, [columns, facilityCatalog]);

  // Ghost ("busy") blocks (single-division scope): EVERY other-division game already
  // booked on a shown facility — not just the ones that currently clash — so you can
  // see the venue's full occupancy and pick a free slot before dragging (Outlook-style).
  // Gated on the Conflicts toggle; in all-divisions scope every game is already shown.
  const ghostGames = useMemo<Game[]>(() => {
    if (!narrowed) return [];
    const focusedIds = new Set(focusedGames.map(g => g.id));
    return dayGames.filter(g => {
      if (focusedIds.has(g.id) || !g.time) return false;
      const f = facilityOf(g);
      return !!f && colKeys.has(f.key);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrowed, focusedGames, dayGames, colKeys]);

  // Time axis bounds derived from the day's placed blocks (padded, rounded to the hour).
  const axis = useMemo(() => {
    let minStart = Infinity;
    let maxEnd = -Infinity;
    [...focusedGames, ...ghostGames].forEach(g => {
      const s = toMin(g.time);
      if (s == null) return;
      const t = resolveGameTiming(divById.get(g.divisionId || ''), tournament, g.durationMinutes);
      minStart = Math.min(minStart, s);
      maxEnd = Math.max(maxEnd, s + t.durationMinutes + t.bufferMinutes);
    });
    // Comfortable day window (8 AM–8 PM) so games can be dragged to any reasonable
    // slot, expanding only if real games fall outside it.
    const start = Number.isFinite(minStart) ? Math.min(8 * 60, Math.floor((minStart - 30) / 60) * 60) : 8 * 60;
    const end = Number.isFinite(maxEnd) ? Math.max(20 * 60, Math.ceil((maxEnd + 30) / 60) * 60) : 20 * 60;
    return { start, end };
  }, [focusedGames, ghostGames, divById, tournament]);

  const axisHeight = (axis.end - axis.start) * PX_PER_MIN;
  const hourLines: number[] = [];
  for (let m = axis.start; m <= axis.end; m += 60) hourLines.push(m);

  const placedFocused = focusedGames.filter(g => g.time && facilityOf(g) && colKeys.has(facilityOf(g)!.key));
  // Which kinds of clash the in-scope games show today → the legend's lines. The colours are always on: the Conflicts
  // toggle and its row are gone (owner, 2026-10-12, §294 — not in the drawing, and a warning is not worth a switch).
  const hasOverlap = focusedGames.some(g => conflictMap.get(g.id)?.kind === 'overlap');
  const hasBuffer = focusedGames.some(g => conflictMap.get(g.id)?.kind === 'buffer');
  // The tournament's turnover (the generator's word for the gap between games on one diamond), for the legend.
  // A block's hover names its pair's own turnover (the earlier game's), which may differ.
  const tournamentBuffer = useMemo(() => resolveGameTiming(null, tournament).bufferMinutes, [tournament]);
  const fieldWord = fieldNounFor(tournament?.sport).toLowerCase();

  const blockDisplay = (g: Game, ghost: boolean): BlockDisplay | null => {
    const s = toMin(g.time);
    if (s == null) return null;
    const t = resolveGameTiming(divById.get(g.divisionId || ''), tournament, g.durationMinutes);
    const top = (s - axis.start) * PX_PER_MIN;
    const height = Math.max(30, t.durationMinutes * PX_PER_MIN);
    const div = divById.get(g.divisionId || '');
    const gpid = gamePoolId(g);
    const pool = gpid ? div?.pools?.find(p => p.id === gpid) : null;
    // Colour by the division's hue, offset per-pool so pools within a division
    // are visually distinct (teamColor of "Pool A"/"Pool B" lands ~1° apart).
    const baseHue = teamAvatarHue(div?.name || g.divisionId || 'div');
    const poolIdx = pool && div?.pools ? div.pools.findIndex(p => p.id === gpid) : -1;
    const accent = `hsl(${(baseHue + (poolIdx >= 0 ? poolIdx * 65 : 0)) % 360}, 60%, 50%)`;
    const info = conflictMap.get(g.id);
    const away = teamName(g.awayTeamId, slotWords(g.awayPlaceholder));
    const home = teamName(g.homeTeamId, slotWords(g.homePlaceholder));
    const label = (div?.name || '') + (pool ? ` · ${pool.name}` : g.bracketCode ? ` · ${bracketGameLabel(g.bracketCode)}` : '');
    // Both games of a tight pair are flagged, each told about the other side — one rule with the game window's line.
    const partner = !ghost && info?.kind === 'buffer' ? games.find(x => x.id === info.partnerId) : undefined;
    const side = partner ? turnoverSide(toConflictGame(g), toConflictGame(partner), divisions, tournament) : null;
    const conflictNote = !ghost && info
      ? info.kind === 'overlap'
        ? ` — ⚠ Overlaps another game on this ${fieldWord}`
        : side?.partnerLater
          ? ` — ⚠ The next game on this ${fieldWord} starts at ${formatTime(side.partnerStart)}, inside the ${side.turnover}-minute turnover`
          : ` — ⚠ Starts inside the ${side?.turnover ?? t.bufferMinutes}-minute turnover after the game before it on this ${fieldWord}`
      : '';
    // A grey block is a game the page's Search or Filter leaves out (the page never narrows by division here).
    const title = `${div?.name ?? ''}${pool ? ` · ${pool.name}` : ''} · ${formatTime(g.time || '')}${ghost ? ' (outside the filter)' : ''}${conflictNote}`;
    return { top, height, accent, label, time: formatTime(g.time || ''), away, home, info, title };
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Live drop preview: as the block is dragged, compute the prospective slot + its
  // conflict verdict and stash it so the hovered column can render a colour band.
  function handleDragMove(event: DragMoveEvent) {
    if (!onMove) return;
    const { active, over } = event;
    const g = focusedGames.find(x => x.id === active.id) || unplacedGames.find(x => x.id === active.id);
    if (!g || !over) { setDragPreview(null); return; }
    const targetCol = columns.find(c => c.key === over.id);
    if (!targetCol) { setDragPreview(null); return; }
    const activeRect = active.rect.current.translated;
    const overRect = over.rect;
    let newStart = activeRect && overRect
      ? axis.start + (activeRect.top - overRect.top) / PX_PER_MIN
      : (toMin(g.time) ?? axis.start);
    newStart = Math.round(newStart / SNAP) * SNAP;
    newStart = Math.max(0, Math.min(24 * 60 - SNAP, newStart));
    const t = resolveGameTiming(divById.get(g.divisionId || ''), tournament, g.durationMinutes);
    const verdict = dropVerdict(g, targetCol, newStart);
    const top = (newStart - axis.start) * PX_PER_MIN;
    const height = Math.max(30, t.durationMinutes * PX_PER_MIN);
    setDragPreview(prev =>
      prev && prev.colKey === targetCol.key && prev.top === top && prev.kind === verdict.kind
        ? prev
        : { colKey: targetCol.key, top, height, kind: verdict.kind, time: minToTime(newStart), reason: verdict.reason });
  }

  /** A drop's verdict by the tournament's one rule (A37): refused (red, with its reason), a short gap, or free. */
  function dropVerdict(g: Game, col: Col, start: number): { kind: 'free' | 'buffer' | 'overlap'; reason?: string } {
    const result: ConflictResult | null = checkVenueConflict({
      proposedGame: {
        id: g.id, gameDate: day, startTime: minToTime(start), status: 'scheduled',
        venueId: col.venueId || null, venueFacilityId: col.facilityId || null,
        scheduleFacilityLaneId: null, divisionId: g.divisionId ?? null, durationMinutes: g.durationMinutes ?? null,
      },
      allGames: conflictGames, divisions, tournament,
    });
    if (!result) return { kind: 'free' };
    if (!isRefusedOverlap(result)) return { kind: 'buffer' };
    const other = result.conflictingGame as OverlapGame;
    return {
      kind: 'overlap',
      reason: M.dropRefused(col.facility || col.venue, overlapOtherName(other, divisions), overlapOtherTimes(other, divisions, tournament).end),
    };
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragPreview(null);
    if (!onMove) return;
    const { active, over, delta } = event;
    const g = focusedGames.find(x => x.id === active.id) || unplacedGames.find(x => x.id === active.id);
    if (!g || !over) return;
    const targetCol = columns.find(c => c.key === over.id);
    if (!targetCol) return;
    // Drop position → start time. The dragged element's rect vs the column works
    // for tray cards too; fall back to delta for in-grid moves.
    const activeRect = active.rect.current.translated;
    const overRect = over.rect;
    let newStart = activeRect && overRect
      ? axis.start + (activeRect.top - overRect.top) / PX_PER_MIN
      : (toMin(g.time) ?? axis.start) + delta.y / PX_PER_MIN;
    newStart = Math.round(newStart / SNAP) * SNAP;
    newStart = Math.max(0, Math.min(24 * 60 - SNAP, newStart));
    const cur = facilityOf(g);
    if (cur && newStart === toMin(g.time) && targetCol.key === cur.key) return; // no-op
    // Refused: nothing is sent and the block springs back where it was (A37).
    const verdict = dropVerdict(g, targetCol, newStart);
    if (verdict.kind === 'overlap') { setRefusedNote(verdict.reason ?? ''); return; }
    setRefusedNote('');
    onMove(g.id, {
      date: day, time: minToTime(newStart),
      venueId: targetCol.venueId || null, venueFacilityId: targetCol.facilityId || null, location: null,
    }, 'drop');
  }

  // ── mobile field pager ──
  const fieldIdx = Math.min(activeFieldIdx, Math.max(0, columns.length - 1));
  const activeCol = columns[fieldIdx] ?? null;
  const goField = (dir: 1 | -1) => setActiveFieldIdx(() => Math.min(columns.length - 1, Math.max(0, fieldIdx + dir)));

  // "Now" line — only when viewing today and within the visible axis window.
  const showNow = day === todayISO && nowMin >= axis.start && nowMin <= axis.end;
  const nowTop = (nowMin - axis.start) * PX_PER_MIN;

  return (
    <div className={styles.timeline} data-mobile={isMobile ? 'true' : undefined}>
      {/* A refused drop's reason, for a screen reader only (visually hidden; outside the flow, so it adds no gap). */}
      <p className={styles.liveNote} aria-live="polite">{refusedNote}</p>

      {/* ── conflict legend — explains the colour code, only while a clash is on screen ── */}
      {(hasOverlap || hasBuffer) && (
        <div className={styles.conflictLegend}>
          {hasOverlap && (
            <span className={styles.legendItem} data-kind="overlap">
              <span className={styles.legendSwatch} aria-hidden />{' '}
              Two games at once on one {fieldWord} — needs a different slot
            </span>
          )}
          {hasBuffer && (
            <span className={styles.legendItem} data-kind="buffer">
              <span className={styles.legendSwatch} aria-hidden />
              Inside the {tournamentBuffer}-minute turnover between games on one {fieldWord} — allowed, just tight
            </span>
          )}
        </div>
      )}

      {/* ── tray + grid ── */}
      {isMobile ? (
        /* ── mobile: tap-to-place tray + single-field pager ── */
        <>
          {unplacedGames.length > 0 && (
            <div className={styles.tray}>
              <span className={styles.trayTitle}>Unscheduled · {unplacedGames.length}</span>
              <div className={styles.trayScroll}>
                {unplacedGames.map(g => {
                  const away = teamName(g.awayTeamId, slotWords(g.awayPlaceholder));
                  const home = teamName(g.homeTeamId, slotWords(g.homePlaceholder));
                  const dn = divById.get(g.divisionId || '')?.name ?? '';
                  const sub = `${dn}${g.bracketCode ? ` · ${bracketGameLabel(g.bracketCode)}` : ''}${g.time ? ` · ${formatTime(g.time)}` : ''}`;
                  return <TrayCard key={g.id} g={g} label={`${away} vs ${home}`} sub={sub} onSelect={onMove ? () => setSheetGame(g) : undefined} />;
                })}
              </div>
            </div>
          )}

          {columns.length === 0 ? (
            unplacedGames.length === 0 ? (
              <div className={styles.empty}>No games scheduled on {dayLabel(day)}{selection !== null ? ' for this selection' : ''}.</div>
            ) : (
              <div className={styles.empty}>{onMove ? 'Tap an unscheduled game above to place it on a field.' : 'No fields in use yet.'}</div>
            )
          ) : activeCol ? (
            <div className={styles.mobileField}>
              <div className={styles.fieldPager}>
                <button type="button" className={styles.dayBtn} onClick={() => goField(-1)} disabled={fieldIdx <= 0} aria-label="Previous field"><ChevronLeft size={16} /></button>
                <div className={styles.fieldPagerLabel}>
                  <span className={styles.colVenue}>{activeCol.venue}</span>
                  <span className={styles.colFacility}>{activeCol.facility ? `${activeCol.facility} · ` : ''}{fieldIdx + 1} / {columns.length}</span>
                </div>
                <button type="button" className={styles.dayBtn} onClick={() => goField(1)} disabled={fieldIdx >= columns.length - 1} aria-label="Next field"><ChevronRight size={16} /></button>
                {onMove && (
                  <AddFieldMenu
                    options={availableFields}
                    onAdd={key => setExtraColumns(prev => { const n = new Set(prev); n.add(key); return n; })}
                    onCreate={onCreateVenue}
                  />
                )}
              </div>

              <div
                className={styles.gridScroll}
                onTouchStart={e => { touchStartX.current = e.touches[0]?.clientX ?? null; }}
                onTouchEnd={e => {
                  if (touchStartX.current == null) return;
                  const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
                  touchStartX.current = null;
                  if (Math.abs(dx) > 50) goField(dx < 0 ? 1 : -1); // swipe left → next field
                }}
              >
                <div className={styles.grid}>
                  <div className={styles.gutter}>
                    <div className={styles.gutterBody} style={{ height: axisHeight }}>
                      {hourLines.map(m => (
                        <div key={m} className={styles.hourLabel} style={{ top: (m - axis.start) * PX_PER_MIN }}>{hourLabel(m)}</div>
                      ))}
                      {showNow && <div className={styles.nowLabel} style={{ top: nowTop }}>now</div>}
                    </div>
                  </div>
                  <div className={styles.col}>
                    <div className={styles.colBody} style={{ height: axisHeight }}>
                      {hourLines.map(m => <div key={m} className={styles.gridLine} style={{ top: (m - axis.start) * PX_PER_MIN }} />)}
                      {showNow && <div className={styles.nowLine} style={{ top: nowTop }} />}
                      {ghostGames.filter(g => facilityOf(g)?.key === activeCol.key).map(g => { const d = blockDisplay(g, true); return d ? <TimelineBlock key={g.id} g={g} ghost display={d} draggable={false} /> : null; })}
                      {placedFocused.filter(g => facilityOf(g)?.key === activeCol.key).map(g => { const d = blockDisplay(g, false); return d ? <TimelineBlock key={g.id} g={g} ghost={false} display={d} draggable={false} onSelect={onMove && g.status === 'scheduled' ? () => setSheetGame(g) : undefined} onOpen={onOpen ? () => onOpen(g) : undefined} /> : null; })}
                    </div>
                  </div>
                </div>
              </div>
              {onMove && <p className={styles.mobileHint}>Tap a game to change its time or field · swipe to switch fields.</p>}
            </div>
          ) : null}
        </>
      ) : (
      /* ── desktop: drag grid ── */
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragMove={handleDragMove} onDragEnd={handleDragEnd} onDragCancel={() => setDragPreview(null)}>
        {unplacedGames.length > 0 && (
          <div className={styles.tray}>
            <span className={styles.trayTitle}>Unscheduled · {unplacedGames.length}</span>
            <div className={styles.trayScroll}>
              {unplacedGames.map(g => {
                const away = teamName(g.awayTeamId, slotWords(g.awayPlaceholder));
                const home = teamName(g.homeTeamId, slotWords(g.homePlaceholder));
                const dn = divById.get(g.divisionId || '')?.name ?? '';
                const sub = `${dn}${g.bracketCode ? ` · ${bracketGameLabel(g.bracketCode)}` : ''}${g.time ? ` · ${formatTime(g.time)}` : ''}`;
                return <TrayCard key={g.id} g={g} label={`${away} vs ${home}`} sub={sub} />;
              })}
            </div>
          </div>
        )}

        {columns.length === 0 && unplacedGames.length === 0 ? (
          <div className={styles.empty}>No games scheduled on {dayLabel(day)}{selection !== null ? ' for this selection' : ''}.</div>
        ) : (
          <div className={styles.gridScroll}>
            <div className={styles.grid}>
              {/* time gutter */}
              <div className={styles.gutter}>
                <div className={styles.gutterHead} />
                <div className={styles.gutterBody} style={{ height: axisHeight }}>
                  {hourLines.map(m => (
                    <div key={m} className={styles.hourLabel} style={{ top: (m - axis.start) * PX_PER_MIN }}>
                      {hourLabel(m)}
                    </div>
                  ))}
                  {showNow && <div className={styles.nowLabel} style={{ top: nowTop }}>now</div>}
                </div>
              </div>

              {/* facility columns */}
              {columns.map(col => {
                const colFocused = placedFocused.filter(g => facilityOf(g)?.key === col.key);
                const colGhosts = ghostGames.filter(g => facilityOf(g)?.key === col.key);
                return (
                  <div key={col.key} className={styles.col}>
                    <div className={styles.colHead}>
                      <span className={styles.colVenue}>{col.venue}</span>
                      {col.facility && <span className={styles.colFacility}>{col.facility}</span>}
                    </div>
                    <DroppableCol colKey={col.key} axisHeight={axisHeight} hourLines={hourLines} axisStart={axis.start}>
                      {showNow && <div className={styles.nowLine} style={{ top: nowTop }} />}
                      {dragPreview && dragPreview.colKey === col.key && (
                        <div className={styles.dropPreview} data-kind={dragPreview.kind} style={{ top: dragPreview.top, height: dragPreview.height }}>
                          <span className={styles.dropPreviewTime}>{formatTime(dragPreview.time)}</span>
                          {dragPreview.reason && <span className={styles.dropPreviewReason}>{dragPreview.reason}</span>}
                        </div>
                      )}
                      {colGhosts.map(g => { const d = blockDisplay(g, true); return d ? <TimelineBlock key={g.id} g={g} ghost display={d} draggable={false} /> : null; })}
                      {colFocused.map(g => { const d = blockDisplay(g, false); return d ? <TimelineBlock key={g.id} g={g} ghost={false} display={d} draggable={!!onMove && g.status === 'scheduled'} onSelect={onMove && g.status === 'scheduled' ? () => setSheetGame(g) : undefined} onOpen={onOpen ? () => onOpen(g) : undefined} /> : null; })}
                    </DroppableCol>
                  </div>
                );
              })}

              {/* add-field column — always available when editable */}
              {onMove && (
                <div className={styles.addFieldCol}>
                  <div className={styles.colHead}>
                    <AddFieldMenu
                      options={availableFields}
                      onAdd={key => setExtraColumns(prev => { const n = new Set(prev); n.add(key); return n; })}
                      onCreate={onCreateVenue}
                    />
                  </div>
                </div>
              )}
            </div>
            {columns.length === 0 && (
              venues.length === 0 && zeroVenuePrompt ? (
                <div style={{ maxWidth: 460, margin: '0.75rem auto 0' }}>{zeroVenuePrompt}</div>
              ) : (
                <div className={styles.gridHint}>Add a field, then drag an unscheduled game onto it to set its venue and time.</div>
              )
            )}
          </div>
        )}
      </DndContext>
      )}

      {/* ── the phone's move sheet (S4) ── */}
      {sheetGame && onMove && (
        <MoveSheet
          game={sheetGame}
          games={games}
          teams={teams}
          divisions={divisions}
          venues={venues}
          tournament={tournament}
          days={eventDays ?? days}
          today={todayProp ?? todayISO}
          tells={tellsFor?.(sheetGame) ?? false}
          onClose={() => setSheetGame(null)}
          onMove={to => { void onMove(sheetGame.id, to, 'sheet'); setSheetGame(null); }}
        />
      )}
    </div>
  );
}
