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
 * Read-only for now — drag-to-move is D2.2, the mobile carousel is D2.3.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, CalendarDays, Plus, Minus, Check } from 'lucide-react';
import { DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, pointerWithin, type DragEndEvent, type DragMoveEvent } from '@dnd-kit/core';
import type { Game, Division, Venue, Tournament, Team } from '@/lib/types';
import { resolveGameTiming, buildConflictMap, checkVenueConflict, timeToMinutes, minutesToTime, type ConflictInfo, type ConflictGame } from '@/lib/schedule-conflict';
import { teamAvatarHue } from '@/lib/team-color';
import { formatTime } from '@/lib/utils';
import BottomSheet from '@/components/admin/BottomSheet';
import styles from './ScheduleTimeline.module.css';

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
  const h = Math.floor(min / 60);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${ampm}`;
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

/** One game block. Draggable (D2.2) when `draggable`; tappable (mobile) when `onSelect`;
 * otherwise static (ghosts, read-only). */
function TimelineBlock({ g, ghost, display, draggable, showConflicts, onSelect }: {
  g: Game; ghost: boolean; display: BlockDisplay; draggable: boolean; showConflicts: boolean;
  onSelect?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: g.id, disabled: !draggable });
  const style: CSSProperties = {
    top: display.top,
    height: display.height,
    ['--accent' as string]: display.accent,
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    zIndex: isDragging ? 50 : undefined,
  };
  // Keyboard a11y: Enter/Space opens the reschedule sheet. On desktop the block is
  // pointer-draggable (no onClick, to keep click≠drag); on mobile it's a tap target.
  const interactiveProps = onSelect
    ? {
        onKeyDown: (e: ReactKeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); }
        },
        ...(draggable ? {} : { onClick: onSelect, tabIndex: 0, role: 'button' as const }),
      }
    : {};
  return (
    <div
      ref={setNodeRef}
      className={`${styles.block} ${ghost ? styles.ghost : ''} ${draggable ? styles.draggable : ''} ${onSelect ? styles.selectable : ''} ${isDragging ? styles.dragging : ''}`}
      data-conflict={showConflicts && !ghost && display.info ? display.info.kind : undefined}
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
        {showConflicts && !ghost && display.info && <AlertTriangle size={11} className={styles.blockWarn} aria-hidden />}
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
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
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

/** Mobile reschedule/place sheet — field picker + 15-min time stepper + live
 * conflict status (warn-and-allow), with a one-tap "next free slot" shortcut. */
function RescheduleSheet({
  game, mode, day, facilities, conflictGames, divisions, tournament, away, home, onClose, onSave,
}: {
  game: Game;
  mode: 'move' | 'place';
  day: string;
  facilities: Col[];
  conflictGames: ConflictGame[];
  divisions: Division[];
  tournament: Tournament | null;
  away: string;
  home: string;
  onClose: () => void;
  onSave: (target: { date: string; time: string; venueId: string; venueFacilityId: string }) => void;
}) {
  const initialField =
    facilities.find(f =>
      (game.venueFacilityId && f.facilityId === game.venueFacilityId) ||
      (!game.venueFacilityId && !!game.venueId && f.venueId === game.venueId))?.key
    ?? facilities[0]?.key ?? '';
  const [fieldKey, setFieldKey] = useState(initialField);
  const [timeMin, setTimeMin] = useState<number>(() => {
    const t = game.time ? timeToMinutes(game.time) : NaN;
    return Number.isNaN(t) ? 9 * 60 : t;
  });

  const selected = facilities.find(f => f.key === fieldKey) ?? null;

  const conflict = useMemo(() => {
    if (!selected) return null;
    return checkVenueConflict({
      proposedGame: {
        id: game.id,
        gameDate: day,
        startTime: minutesToTime(timeMin),
        status: game.status ?? null,
        venueId: selected.venueId || null,
        venueFacilityId: selected.facilityId || null,
        scheduleFacilityLaneId: null,
        divisionId: game.divisionId ?? null,
      },
      allGames: conflictGames,
      divisions,
      tournament,
    });
  }, [selected, timeMin, game, day, conflictGames, divisions, tournament]);

  const step = (delta: number) => setTimeMin(t => Math.max(0, Math.min(24 * 60 - 15, t + delta)));

  function save() {
    if (!selected) return;
    onSave({ date: day, time: minutesToTime(timeMin), venueId: selected.venueId, venueFacilityId: selected.facilityId });
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={`${mode === 'place' ? 'Place' : 'Reschedule'} · ${away} vs ${home}`}
      footer={
        <div className={styles.sheetFooter}>
          <button type="button" className={styles.sheetCancel} onClick={onClose}>Cancel</button>
          <button type="button" className={styles.sheetSave} onClick={save} disabled={!selected}>
            {mode === 'place' ? 'Place game' : 'Save'}
          </button>
        </div>
      }
    >
      <div className={styles.sheetSection}>
        <span className={styles.sheetLabel}>Start time</span>
        <div className={styles.stepper}>
          <button type="button" className={styles.stepBtn} onClick={() => step(-15)} aria-label="15 minutes earlier"><Minus size={18} /></button>
          <span className={styles.stepValue}>{formatTime(minutesToTime(timeMin))}</span>
          <button type="button" className={styles.stepBtn} onClick={() => step(15)} aria-label="15 minutes later"><Plus size={18} /></button>
        </div>
      </div>

      <div className={styles.sheetSection}>
        <span className={styles.sheetLabel}>Field</span>
        {facilities.length === 0 ? (
          <p className={styles.sheetEmpty}>No fields yet — add a venue first.</p>
        ) : (
          <div className={styles.fieldList}>
            {facilities.map(f => (
              <button key={f.key} type="button" className={styles.fieldOption} data-on={f.key === fieldKey ? 'true' : 'false'} onClick={() => setFieldKey(f.key)}>
                <span className={styles.fieldOptionName}>{f.venue}{f.facility ? ` · ${f.facility}` : ''}</span>
                {f.key === fieldKey && <Check size={15} aria-hidden />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.sheetStatus} data-kind={conflict ? conflict.kind : 'free'}>
        <span className={styles.sheetStatusLine}>
          {!conflict ? (
            <><Check size={15} aria-hidden /> Free slot — no conflicts here.</>
          ) : conflict.kind === 'overlap' ? (
            <><AlertTriangle size={15} aria-hidden /> Overlaps {conflict.conflictingDivisionName} at {formatTime(conflict.conflictingGame.startTime || '')}.</>
          ) : (
            <><AlertTriangle size={15} aria-hidden /> Within the travel buffer after the previous game.</>
          )}
        </span>
        {conflict && conflict.availableAt && (
          <button type="button" className={styles.useFreeBtn} onClick={() => setTimeMin(timeToMinutes(conflict.availableAt))}>
            Use next free slot ({formatTime(conflict.availableAt)})
          </button>
        )}
      </div>
    </BottomSheet>
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
  onCreateVenue,
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
  /** Persist a drag-to-move / drag-to-place (D2.2). Omit (or locked) → read-only grid. */
  onMove?: (gameId: string, target: { date: string; time: string; venueId: string; venueFacilityId: string }) => void | Promise<void>;
  /** Open the create-venue flow (for the "+ Field" menu). */
  onCreateVenue?: () => void;
}) {
  const divById = useMemo(() => new Map(divisions.map(d => [d.id, d])), [divisions]);
  // Pool is for block COLOR only (not selection) — derived from the teams' pool.
  const teamPoolMap = useMemo(() => new Map(teams.map(t => [t.id, t.poolId || ''])), [teams]);
  const gamePoolId = (g: Game) => g.isPlayoff ? '' : (teamPoolMap.get(g.homeTeamId) || teamPoolMap.get(g.awayTeamId) || '');
  const inScope = (g: Game) => selection === null || selection.has(g.divisionId || '');
  const teamName = (id?: string | null, ph?: string | null) =>
    (id ? teams.find(t => t.id === id)?.name : null) || ph || 'TBD';

  const days = useMemo(
    () => Array.from(new Set(games.map(g => g.date).filter(Boolean) as string[])).sort(),
    [games],
  );
  const todayISO = new Date().toISOString().split('T')[0];
  const [day, setDay] = useState<string>(() => (days.includes(todayISO) ? todayISO : days[0] ?? todayISO));
  const [extraColumns, setExtraColumns] = useState<Set<string>>(new Set());
  const [showConflicts, setShowConflicts] = useState(true);
  const isMobile = useIsMobile(768);
  const [activeFieldIdx, setActiveFieldIdx] = useState(0); // mobile: which field column is shown
  const [sheetGame, setSheetGame] = useState<Game | null>(null); // mobile: game being moved/placed
  const touchStartX = useRef<number | null>(null);
  // Live drop preview while dragging (D2.4): where the block would land + the verdict.
  const [dragPreview, setDragPreview] = useState<{ colKey: string; top: number; height: number; kind: 'free' | 'buffer' | 'overlap'; time: string } | null>(null);
  // "Now" line — current time in minutes, ticked each minute.
  const [nowMin, setNowMin] = useState(() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); });
  useEffect(() => {
    const id = setInterval(() => { const d = new Date(); setNowMin(d.getHours() * 60 + d.getMinutes()); }, 60000);
    return () => clearInterval(id);
  }, []);
  // Reset the mobile field pager when the day or stage changes.
  useEffect(() => { setActiveFieldIdx(0); }, [day, stage]);
  // Snap to the new stage's first date (or today if within it) whenever the stage
  // flips — even if the old date happens to be valid in both stages.
  useEffect(() => {
    if (days.length > 0) setDay(days.includes(todayISO) ? todayISO : days[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);
  // Guard: if the current day falls out of the available set (e.g. data refresh), snap back.
  useEffect(() => {
    if (days.length > 0 && !days.includes(day)) setDay(days.includes(todayISO) ? todayISO : days[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  // Lightweight conflict shape for ALL games — shared by the conflict map and the
  // mobile reschedule sheet's live check.
  const conflictGames = useMemo<ConflictGame[]>(() => games.map(g => ({
    id: g.id,
    gameDate: g.date ?? null,
    startTime: g.time ?? null,
    status: g.status ?? null,
    venueId: g.venueId ?? null,
    venueFacilityId: g.venueFacilityId ?? null,
    scheduleFacilityLaneId: g.scheduleFacilityLaneId ?? null,
    divisionId: g.divisionId ?? null,
    isPlayoff: g.isPlayoff ?? false,
  })), [games]);

  // Conflict map over ALL games (global) — always on, even in single-division scope.
  const conflictMap = useMemo<Map<string, ConflictInfo>>(() => {
    if (!tournament) return new Map();
    return buildConflictMap(conflictGames, divisions, tournament);
  }, [conflictGames, divisions, tournament]);

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
  const focusedGames = useMemo(
    () => dayGames.filter(inScope),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dayGames, selection],
  );

  // Columns: facilities used by the visible games (placed, with a time + facility).
  const columns = useMemo<Col[]>(() => {
    const map = new Map<string, Col>();
    (selection === null ? dayGames : focusedGames).forEach(g => {
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
    [games, selection, day],
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
    if (selection === null || !showConflicts) return [];
    const focusedIds = new Set(focusedGames.map(g => g.id));
    return dayGames.filter(g => {
      if (focusedIds.has(g.id) || !g.time) return false;
      const f = facilityOf(g);
      return !!f && colKeys.has(f.key);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, showConflicts, focusedGames, dayGames, colKeys]);

  // Time axis bounds derived from the day's placed blocks (padded, rounded to the hour).
  const axis = useMemo(() => {
    let minStart = Infinity;
    let maxEnd = -Infinity;
    [...focusedGames, ...ghostGames].forEach(g => {
      const s = toMin(g.time);
      if (s == null) return;
      const t = resolveGameTiming(divById.get(g.divisionId || ''), tournament, g.isPlayoff);
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
  // Conflict summary for in-scope games on this day → drives the toolbar count, the
  // severity colour (overlap = danger, buffer = warning), and the legend.
  const { conflictCount, hasOverlap, hasBuffer } = useMemo(() => {
    let count = 0, o = false, b = false;
    for (const g of focusedGames) {
      const k = conflictMap.get(g.id)?.kind;
      if (!k) continue;
      count++;
      if (k === 'overlap') o = true; else b = true;
    }
    return { conflictCount: count, hasOverlap: o, hasBuffer: b };
  }, [focusedGames, conflictMap]);
  const conflictSeverity: 'overlap' | 'buffer' | 'none' = hasOverlap ? 'overlap' : hasBuffer ? 'buffer' : 'none';
  // Tournament-level travel buffer (for the legend headline). Per-block tooltips use
  // the game's own division-resolved buffer, which may differ.
  const tournamentBuffer = useMemo(() => resolveGameTiming(null, tournament).bufferMinutes, [tournament]);

  const scopeSummary = useMemo(() => {
    if (selection === null) return 'All divisions';
    if (selection.size === 0) return 'None selected';
    if (selection.size === 1) return divById.get(Array.from(selection)[0])?.name ?? 'Division';
    return `${selection.size} divisions`;
  }, [selection, divById]);

  const blockDisplay = (g: Game, ghost: boolean): BlockDisplay | null => {
    const s = toMin(g.time);
    if (s == null) return null;
    const t = resolveGameTiming(divById.get(g.divisionId || ''), tournament, g.isPlayoff);
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
    const away = g.bracketCode ? (g.awayPlaceholder || 'TBD') : teamName(g.awayTeamId, g.awayPlaceholder);
    const home = g.bracketCode ? (g.homePlaceholder || 'TBD') : teamName(g.homeTeamId, g.homePlaceholder);
    const label = (div?.name || '') + (pool ? ` · ${pool.name}` : g.bracketCode ? ` · ${g.bracketCode}` : '');
    const conflictNote = !ghost && info
      ? info.kind === 'overlap'
        ? ' — ⚠ Overlaps another booking at this field'
        : ` — ⚠ Starts within the ${t.bufferMinutes}-min travel buffer after the previous game (tournament setting)`
      : '';
    const title = `${div?.name ?? ''}${pool ? ` · ${pool.name}` : ''} · ${formatTime(g.time || '')}${ghost ? ' (other division)' : ''}${conflictNote}`;
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
    const t = resolveGameTiming(divById.get(g.divisionId || ''), tournament, g.isPlayoff);
    const result = checkVenueConflict({
      proposedGame: {
        id: g.id, gameDate: day, startTime: minToTime(newStart), status: g.status ?? null,
        venueId: targetCol.venueId || null, venueFacilityId: targetCol.facilityId || null,
        scheduleFacilityLaneId: null, divisionId: g.divisionId ?? null, isPlayoff: g.isPlayoff ?? false,
      },
      allGames: conflictGames, divisions, tournament,
    });
    const kind = result ? result.kind : 'free';
    const top = (newStart - axis.start) * PX_PER_MIN;
    const height = Math.max(30, t.durationMinutes * PX_PER_MIN);
    setDragPreview(prev =>
      prev && prev.colKey === targetCol.key && prev.top === top && prev.kind === kind
        ? prev
        : { colKey: targetCol.key, top, height, kind, time: minToTime(newStart) });
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
    onMove(g.id, { date: day, time: minToTime(newStart), venueId: targetCol.venueId, venueFacilityId: targetCol.facilityId });
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
      {/* ── controls ── */}
      <div className={styles.controls}>
        <div className={styles.controlsLeft}>
          <div className={styles.scopeLabel}>
            <CalendarDays size={13} aria-hidden />
            <span>{scopeSummary}</span>
          </div>

          <button
            type="button"
            className={styles.conflictToggle}
            data-on={showConflicts ? 'true' : 'false'}
            data-severity={conflictSeverity}
            onClick={() => setShowConflicts(v => !v)}
            aria-pressed={showConflicts}
            title={conflictCount > 0
              ? `${conflictCount} game${conflictCount === 1 ? '' : 's'} flagged${hasOverlap ? ' · overlap' : ''}${hasBuffer ? ` · within the ${tournamentBuffer}-min travel buffer` : ''} — click to ${showConflicts ? 'hide' : 'show'}`
              : 'No conflicts on this day'}
          >
            <AlertTriangle size={13} aria-hidden />
            <span>Conflicts</span>
            {conflictCount > 0 && <span className={styles.conflictCount}>{conflictCount}</span>}
          </button>
        </div>

        <div className={styles.dayNav}>
          <button
            type="button"
            className={styles.dayBtn}
            onClick={() => {
              const i = days.indexOf(day);
              if (i > 0) setDay(days[i - 1]);
            }}
            disabled={days.indexOf(day) <= 0}
            aria-label="Previous day"
          >
            <ChevronLeft size={16} />
          </button>
          <span className={styles.dayLabel}>{dayLabel(day)}</span>
          <button
            type="button"
            className={styles.dayBtn}
            onClick={() => {
              const i = days.indexOf(day);
              if (i >= 0 && i < days.length - 1) setDay(days[i + 1]);
            }}
            disabled={days.indexOf(day) >= days.length - 1}
            aria-label="Next day"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ── conflict legend — explains the colour code when clashes are visible ── */}
      {showConflicts && (hasOverlap || hasBuffer) && (
        <div className={styles.conflictLegend}>
          {hasOverlap && (
            <span className={styles.legendItem} data-kind="overlap">
              <span className={styles.legendSwatch} aria-hidden />
              Overlapping booking at the same field — needs a different slot
            </span>
          )}
          {hasBuffer && (
            <span className={styles.legendItem} data-kind="buffer">
              <span className={styles.legendSwatch} aria-hidden />
              Within the {tournamentBuffer}-min travel buffer between games (tournament setting) — allowed, just tight
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
                  const away = g.bracketCode ? (g.awayPlaceholder || 'TBD') : teamName(g.awayTeamId, g.awayPlaceholder);
                  const home = g.bracketCode ? (g.homePlaceholder || 'TBD') : teamName(g.homeTeamId, g.homePlaceholder);
                  const dn = divById.get(g.divisionId || '')?.name ?? '';
                  const sub = `${dn}${g.bracketCode ? ` · ${g.bracketCode}` : ''}${g.time ? ` · ${formatTime(g.time)}` : ''}`;
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
                      {ghostGames.filter(g => facilityOf(g)?.key === activeCol.key).map(g => { const d = blockDisplay(g, true); return d ? <TimelineBlock key={g.id} g={g} ghost display={d} draggable={false} showConflicts={showConflicts} /> : null; })}
                      {placedFocused.filter(g => facilityOf(g)?.key === activeCol.key).map(g => { const d = blockDisplay(g, false); return d ? <TimelineBlock key={g.id} g={g} ghost={false} display={d} draggable={false} showConflicts={showConflicts} onSelect={onMove ? () => setSheetGame(g) : undefined} /> : null; })}
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
                const away = g.bracketCode ? (g.awayPlaceholder || 'TBD') : teamName(g.awayTeamId, g.awayPlaceholder);
                const home = g.bracketCode ? (g.homePlaceholder || 'TBD') : teamName(g.homeTeamId, g.homePlaceholder);
                const dn = divById.get(g.divisionId || '')?.name ?? '';
                const sub = `${dn}${g.bracketCode ? ` · ${g.bracketCode}` : ''}${g.time ? ` · ${formatTime(g.time)}` : ''}`;
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
                        </div>
                      )}
                      {colGhosts.map(g => { const d = blockDisplay(g, true); return d ? <TimelineBlock key={g.id} g={g} ghost display={d} draggable={false} showConflicts={showConflicts} /> : null; })}
                      {colFocused.map(g => { const d = blockDisplay(g, false); return d ? <TimelineBlock key={g.id} g={g} ghost={false} display={d} draggable={!!onMove} showConflicts={showConflicts} onSelect={onMove ? () => setSheetGame(g) : undefined} /> : null; })}
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
              <div className={styles.gridHint}>Add a field, then drag an unscheduled game onto it to set its venue and time.</div>
            )}
          </div>
        )}
      </DndContext>
      )}

      {/* ── mobile reschedule / place sheet ── */}
      {sheetGame && onMove && (
        <RescheduleSheet
          game={sheetGame}
          mode={(!sheetGame.venueId && !sheetGame.venueFacilityId) ? 'place' : 'move'}
          day={day}
          facilities={Array.from(facilityCatalog.values()).sort((a, b) => `${a.venue}${a.facility}`.localeCompare(`${b.venue}${b.facility}`))}
          conflictGames={conflictGames}
          divisions={divisions}
          tournament={tournament}
          away={sheetGame.bracketCode ? (sheetGame.awayPlaceholder || 'TBD') : teamName(sheetGame.awayTeamId, sheetGame.awayPlaceholder)}
          home={sheetGame.bracketCode ? (sheetGame.homePlaceholder || 'TBD') : teamName(sheetGame.homeTeamId, sheetGame.homePlaceholder)}
          onClose={() => setSheetGame(null)}
          onSave={target => { onMove(sheetGame.id, target); setSheetGame(null); }}
        />
      )}
    </div>
  );
}
