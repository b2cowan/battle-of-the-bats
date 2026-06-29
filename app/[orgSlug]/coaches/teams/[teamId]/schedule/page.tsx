'use client';
import { use, useState, useEffect, useCallback } from 'react';
import { Calendar, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, CircleSlash, Clock3, Plus, Save, X, Trophy, Swords, Shield, Dumbbell, Users, GripVertical } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { useCoaches } from '@/lib/coaches-context';
import { useOrg } from '@/lib/org-context';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import UnsavedChangesGuard from '@/components/coaches/UnsavedChangesGuard';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import { analyzeLineup } from '@/lib/lineup-analysis';
import { generateBestLineup, type PositionPolicy, type FillMode } from '@/lib/lineup-generator';
import {
  downloadXLSX, generateCSV, downloadCSVBlob, downloadICS,
  buildFilename, serializeRows, serializeHeaders, DEFAULT_PDF_SETTINGS,
  downloadLineupPoster, downloadBattingOrderCard, buildPositionLegend,
  type ExportColumnDef, type ICSEventInput, type OrgPdfSettings, type LineupPosterPlayer,
} from '@/lib/export';
import ExportMenu from '@/components/admin/ExportMenu';
import { MapPin, Check, Video, FileText, Link2, ExternalLink, StickyNote } from 'lucide-react';
import { isValidResourceUrl, MAX_EVENT_RESOURCES } from '@/lib/rep-event-resources';
import styles from '../../../coaches.module.css';
import type {
  RepAttendanceStatus,
  RepLineupMode,
  RepRosterPlayer,
  RepTeamEvent,
  RepTeamEventAttendance,
  RepTeamLineup,
  RepTeamLineupEntry,
  RepTeamLineupTemplate,
  RepEventType,
  RepEventResource,
} from '@/lib/types';

// ── Export definition ─────────────────────────────────────────────────────────

const SCHEDULE_EXPORT_COLS: ExportColumnDef[] = [
  { label: 'Date',       key: 'date',      format: 'date' },
  { label: 'Time',       key: 'time',      format: 'text' },
  { label: 'Arrival',    key: 'arrival',   format: 'text' },
  { label: 'Event Type', key: 'eventType', format: 'text' },
  { label: 'Name',       key: 'name',      format: 'text' },
  { label: 'Opponent',   key: 'opponent',  format: 'text' },
  { label: 'Location',   key: 'location',  format: 'text' },
  { label: 'Address',    key: 'address',   format: 'text' },
  { label: 'Field',      key: 'field',     format: 'text' },
  { label: 'Uniform',    key: 'uniform',   format: 'text' },
  { label: 'Home/Away',  key: 'homeAway',  format: 'text' },
];

// ── Constants ──────────────────────────────────────────────────────────────────

const EVENT_COLORS: Record<RepEventType, string> = {
  external_tournament: '#f97316',
  tournament_game:     '#f59e0b',
  scrimmage:           '#3b82f6',
  league_game:         '#22c55e',
  practice:            '#a855f7',
  team_event:          '#6b7280',
};

const EVENT_LABELS: Record<RepEventType, string> = {
  external_tournament: 'Tournament',
  tournament_game:     'Game (Tournament)',
  scrimmage:           'Scrimmage',
  league_game:         'League Game',
  practice:            'Practice',
  team_event:          'Team Event',
};

const EVENT_ICONS: Record<RepEventType, React.ElementType> = {
  external_tournament: Trophy,
  tournament_game:     Trophy,
  scrimmage:           Swords,
  league_game:         Shield,
  practice:            Dumbbell,
  team_event:          Users,
};

// Attendance statuses, ordered present → not-present → unset. Drives BOTH the per-player icon
// control and the metric/filter chips (label used by the chips; control is icon-only).
const ATTENDANCE_OPTIONS: {
  value: RepAttendanceStatus;
  label: string;
  icon: React.ElementType;
}[] = [
  { value: 'attending', label: 'In', icon: CheckCircle2 },
  { value: 'late', label: 'Late', icon: Clock3 },
  { value: 'absent', label: 'Out', icon: CircleSlash },
  { value: 'unknown', label: 'No reply', icon: CircleHelp },
];

// Add-event menu order. Tournament games nest visually under Tournament so a coach sees the
// relationship (a game slot belongs to a tournament) right where they create one.
const ADD_MENU: { type: RepEventType; nested?: boolean }[] = [
  { type: 'external_tournament' },
  { type: 'tournament_game', nested: true },
  { type: 'scrimmage' },
  { type: 'league_game' },
  { type: 'practice' },
  { type: 'team_event' },
];

const GAME_EVENT_TYPES: RepEventType[] = ['league_game', 'tournament_game', 'scrimmage'];
const LINEUP_POSITIONS = ['', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'DH', 'EH', 'Bench'];
// Canonical order for the playing-time summary columns
const POSITION_ORDER = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'DH', 'EH'];

// Lime "heat" intensity for a usage count (more innings → stronger tint). Token-safe via
// the logic-lime rgb channel; capped so white text stays legible.
function heatStyle(count: number) {
  if (!count) return undefined;
  return { background: `rgba(var(--logic-lime-rgb), ${Math.min(0.55, 0.1 + count * 0.09)})` };
}
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Which event types capture an opponent + home/away, and which can recur. Pure functions of
// the type so the form, the open helpers, and save can all share one source of truth.
const needsOpponent = (t: RepEventType) => GAME_EVENT_TYPES.includes(t);
// Event types that can be set to repeat weekly: practices, league games, generic team events.
const RECURRABLE_TYPES: RepEventType[] = ['practice', 'league_game', 'team_event'];
const needsRecurrence = (t: RepEventType) => RECURRABLE_TYPES.includes(t);

// Prefix used to auto-name an event. Games derive "{prefix} vs {opponent}"; other types use it
// as a friendly default when the coach leaves the name blank.
const EVENT_NAME_PREFIX: Record<RepEventType, string> = {
  external_tournament: 'Tournament',
  tournament_game: 'Tournament Game',
  scrimmage: 'Scrimmage',
  league_game: 'League Game',
  practice: 'Practice',
  team_event: 'Team Event',
};

/** Auto-derived name for a game type from its opponent ('' when not a game / no opponent yet). */
function deriveGameName(type: RepEventType, opponent: string): string {
  const opp = opponent.trim();
  return needsOpponent(type) && opp ? `${EVENT_NAME_PREFIX[type]} vs ${opp}` : '';
}

const HOME_AWAY_CHOICES: { value: string; label: string }[] = [
  { value: 'home', label: 'Home' },
  { value: 'away', label: 'Away' },
  { value: 'neutral', label: 'Neutral' },
];

/** Add hours to a `datetime-local` string ("YYYY-MM-DDThh:mm"), returning the same format. */
function addHoursLocal(dtLocal: string, hours: number): string {
  const d = new Date(dtLocal);
  if (Number.isNaN(d.getTime())) return '';
  d.setHours(d.getHours() + hours);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Default start time for a brand-new event: the viewed day at 6:00 PM (round, :00 minutes). */
const DEFAULT_EVENT_HOUR = '18:00';

type ViewMode = 'list' | 'week' | 'month';

interface EventForm {
  eventType: RepEventType;
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  locationAddress: string;
  arrivalTime: string;
  fieldNumber: string;
  uniform: string;
  resources: RepEventResource[];
  opponent: string;
  homeAway: string;
  parentEventId: string;
  isRecurring: boolean;
  dayOfWeek: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
}

interface AttendancePlayerRow {
  player: RepRosterPlayer;
  status: RepAttendanceStatus;
  note: string;
}

interface LineupPlayerRow {
  player: RepRosterPlayer;
  battingOrder: string;
  starter: boolean;
  inningPositions: Record<string, string>;
  notes: string;
}

const BLANK_FORM: EventForm = {
  eventType: 'practice',
  name: '',
  description: '',
  startsAt: '',
  endsAt: '',
  location: '',
  locationAddress: '',
  arrivalTime: '',
  fieldNumber: '',
  uniform: '',
  resources: [],
  opponent: '',
  homeAway: '',
  parentEventId: '',
  isRecurring: false,
  dayOfWeek: '1',
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Google Maps deep link for a place/address. The lightweight `?q=` form 302-redirects straight
// to the result; the heavier `/maps/search/?api=1` web-app URL can open to a blank, perpetually
// loading tab (fresh tab with no Google session / a consent gate), so we use `?q=` here.
function mapsHref(query: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}`;
}

// Pick a recognizable icon for a resource link from its URL (video / map / doc / generic).
function resourceIcon(url: string): React.ElementType {
  const u = url.toLowerCase();
  if (/youtube\.com|youtu\.be|vimeo\.com/.test(u)) return Video;
  if (/maps\.google|google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/.test(u)) return MapPin;
  if (/docs\.google|drive\.google|sheets\.google|\.pdf(\?|$)|notion\.so|dropbox\.com/.test(u)) return FileText;
  return Link2;
}

// Per-type placeholder hints for the resource-link rows.
function resourceHint(type: RepEventType): { label: string; url: string } {
  switch (type) {
    case 'external_tournament': return { label: 'e.g. Tournament rules', url: 'https://… rules or schedule' };
    case 'practice':            return { label: 'e.g. Drill video', url: 'https://youtube.com/…' };
    case 'team_event':          return { label: 'e.g. Event flyer', url: 'https://…' };
    default:                    return needsOpponent(type)
      ? { label: 'e.g. Field map', url: 'https://maps.google.com/…' }
      : { label: 'e.g. Rules', url: 'https://…' };
  }
}

// "HH:mm" (24h, as stored for arrival_time) → friendly 12-hour clock ("5:15 PM").
function fmtClock(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;
  const h = Number(m[1]); const mins = m[2];
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mins} ${period}`;
}

function isoFromInputs(date: string, time: string) {
  return `${date}T${time}`;
}

// ISO/stored datetime → a `datetime-local` input value (YYYY-MM-DDTHH:mm, local).
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  if (/[zZ]|[+-]\d\d:?\d\d$/.test(iso)) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.slice(0, 16);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  return iso.slice(0, 16);
}

function eventToForm(e: RepTeamEvent): EventForm {
  return {
    ...BLANK_FORM,
    eventType: e.eventType,
    name: e.name ?? '',
    description: e.description ?? '',
    startsAt: toLocalInput(e.startsAt),
    endsAt: toLocalInput(e.endsAt),
    location: e.location ?? '',
    locationAddress: e.locationAddress ?? '',
    arrivalTime: e.arrivalTime ?? '',
    fieldNumber: e.fieldNumber ?? '',
    uniform: e.uniform ?? '',
    resources: (e.resources ?? []).map(r => ({ ...r })),
    opponent: e.opponent ?? '',
    homeAway: e.homeAway ?? '',
    parentEventId: e.parentEventId ?? '',
    isRecurring: false, // edit a single occurrence's details; recurrence isn't re-editable here
  };
}

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function weekKey(iso: string) {
  const d = new Date(iso);
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

// ── Multi-day tournament spanning ───────────────────────────────────────────────
// A tournament container (external_tournament) occupies every day from its start date
// through its end date inclusive; every other event occupies only its start day.
function dayStr(iso: string) { return iso.slice(0, 10); }

// Whole days between two YYYY-MM-DD keys (UTC anchored so DST never shifts the count).
function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

function shortDate(dayKey: string) {
  return new Date(`${dayKey}T00:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

function tournamentSpan(e: RepTeamEvent): { start: string; end: string; days: number } | null {
  if (e.eventType !== 'external_tournament' || !e.startsAt) return null;
  const start = dayStr(e.startsAt);
  const end = e.endsAt && dayStr(e.endsAt) >= start ? dayStr(e.endsAt) : start;
  return { start, end, days: daysBetween(start, end) + 1 };
}

function eventOnDay(e: RepTeamEvent, dayKey: string): boolean {
  if (!e.startsAt) return false;
  const span = tournamentSpan(e);
  if (span) return dayKey >= span.start && dayKey <= span.end;
  return dayStr(e.startsAt) === dayKey;
}

// Order a single day's events: all-day tournaments first, then by start time.
function sortDayEvents(list: RepTeamEvent[]): RepTeamEvent[] {
  return [...list].sort((a, b) => {
    const at = a.eventType === 'external_tournament' ? 0 : 1;
    const bt = b.eventType === 'external_tournament' ? 0 : 1;
    if (at !== bt) return at - bt;
    return (a.startsAt ?? '').localeCompare(b.startsAt ?? '');
  });
}

// ── Components ────────────────────────────────────────────────────────────────

function playerDisplayName(player: RepRosterPlayer) {
  return [player.playerNumber ? `#${player.playerNumber}` : '', player.playerFirstName, player.playerLastName]
    .filter(Boolean)
    .join(' ');
}

function isLineupEvent(event: RepTeamEvent | null) {
  return event ? GAME_EVENT_TYPES.includes(event.eventType) : false;
}

function sortLineupRows(rows: LineupPlayerRow[]) {
  return [...rows].sort((a, b) => {
    const aOrder = Number(a.battingOrder) || 999;
    const bOrder = Number(b.battingOrder) || 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    if (a.starter !== b.starter) return a.starter ? -1 : 1;
    return playerDisplayName(a.player).localeCompare(playerDisplayName(b.player));
  });
}

// Batting order = the row's position in the (drag-ordered) list — no manual numbers,
// so a coach can't type the same slot twice. everyone_bats: all bat 1..N; nine_player:
// starters bat 1..9 in order, bench get no slot.
function renumberBattingOrder(rows: LineupPlayerRow[], mode: RepLineupMode): LineupPlayerRow[] {
  let n = 0;
  return rows.map(r => {
    if (mode === 'everyone_bats') return { ...r, starter: true, battingOrder: String(++n) };
    if (r.starter && n < 9) return { ...r, battingOrder: String(++n) };
    return { ...r, battingOrder: '' };
  });
}

function buildLineupRows(
  players: RepRosterPlayer[],
  entries: RepTeamLineupEntry[],
  mode: RepLineupMode,
) {
  const entriesByPlayer = new Map(entries.map(entry => [entry.playerId, entry]));
  return players.map((player, index) => {
    const existing = entriesByPlayer.get(player.id);
    return {
      player,
      battingOrder: existing?.battingOrder ? String(existing.battingOrder) : mode === 'everyone_bats' ? String(index + 1) : index < 9 ? String(index + 1) : '',
      starter: existing?.starter ?? (mode === 'everyone_bats' ? true : index < 9),
      inningPositions: existing?.inningPositions ?? {},
      notes: existing?.notes ?? '',
    };
  });
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

// One drag-sortable lineup row. Batting order = drag position (auto-numbered), so duplicate
// slot numbers are impossible. Lives in this module so it shares styles + helpers.
function SortableLineupRow({
  row, battingNumber, mode, inningCount, onStarterToggle, onPositionChange,
}: {
  row: LineupPlayerRow;
  battingNumber: string;
  mode: RepLineupMode;
  inningCount: number;
  onStarterToggle: (playerId: string, checked: boolean) => void;
  onPositionChange: (playerId: string, inning: number, value: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.player.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <tr ref={setNodeRef} style={style}>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <button
            type="button"
            aria-label={`Drag to reorder ${playerDisplayName(row.player)} in the batting order`}
            {...attributes}
            {...listeners}
            style={{ background: 'none', border: 'none', padding: 2, lineHeight: 0, cursor: 'grab', color: 'rgba(255,255,255,0.35)', touchAction: 'none' }}
          >
            <GripVertical size={14} />
          </button>
          <span style={{ minWidth: '1.2ch', textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: battingNumber ? 'var(--white-90)' : 'rgba(255,255,255,0.3)' }}>
            {battingNumber || '–'}
          </span>
        </div>
      </td>
      {mode === 'nine_player' && (
        <td>
          <input
            type="checkbox"
            checked={row.starter}
            onChange={e => onStarterToggle(row.player.id, e.target.checked)}
            aria-label={`Starter for ${playerDisplayName(row.player)}`}
          />
        </td>
      )}
      <td className={styles.lineupPlayerCell}>
        <span>{playerDisplayName(row.player)}</span>
      </td>
      {Array.from({ length: inningCount }, (_, index) => {
        const inning = index + 1;
        return (
          <td key={inning}>
            <select
              className={styles.lineupPositionSelect}
              value={row.inningPositions[String(inning)] ?? ''}
              onChange={e => onPositionChange(row.player.id, inning, e.target.value)}
              aria-label={`Inning ${inning} position for ${playerDisplayName(row.player)}`}
            >
              {LINEUP_POSITIONS.map(position => (
                <option key={position || 'blank'} value={position}>{position || '-'}</option>
              ))}
            </select>
          </td>
        );
      })}
    </tr>
  );
}

function EventChip({ event, onClick, dayKey }: { event: RepTeamEvent; onClick: () => void; dayKey?: string }) {
  const color = EVENT_COLORS[event.eventType];
  const Icon = EVENT_ICONS[event.eventType];
  const cancelled = event.status === 'cancelled';
  // Lead text (the slot that normally shows the start time). Tournaments are all-day and may
  // run multiple days, so they read as a date range (list view) or "Day n/N" (a specific
  // calendar day) instead of a misleading clock time.
  const span = tournamentSpan(event);
  let lead: string;
  if (span) {
    lead = dayKey
      ? (span.days > 1 ? `Day ${daysBetween(span.start, dayKey) + 1}/${span.days}` : 'All day')
      : (span.days > 1 ? `${shortDate(span.start)}–${shortDate(span.end)}` : shortDate(span.start));
  } else {
    lead = event.startsAt ? fmtTime(event.startsAt) : '';
  }
  // Opponent safety-net: games auto-name "League Game vs Lady Jays" (opponent already in the name),
  // so only append "vs/@ {opp}" when the opponent is set but NOT already in the name.
  const opp = event.opponent?.trim();
  const showOpp = !!opp && !event.name.toLowerCase().includes(opp.toLowerCase());
  const oppSuffix = showOpp ? ` · ${event.homeAway === 'away' ? '@' : 'vs'} ${opp}` : '';
  // Final score (team-relative: your team first) for a played game.
  const hasScore = !span && event.teamScore != null && event.opponentScore != null;
  return (
    <button
      className={styles.eventChip}
      style={{ borderLeftColor: color, ...(cancelled ? { opacity: 0.55 } : {}) }}
      onClick={onClick}
    >
      <Icon size={12} style={{ color, flexShrink: 0 }} />
      <span className={styles.eventChipTime}>{lead}</span>
      <span className={styles.eventChipName} style={cancelled ? { textDecoration: 'line-through' } : undefined}>
        {event.name}{oppSuffix && <span className={styles.eventChipOpp}>{oppSuffix}</span>}
      </span>
      <span className={styles.eventChipTrail}>
        {cancelled ? (
          <span className={styles.eventChipResult} style={{ color: '#f59e0b' }}>CANCELLED</span>
        ) : (
          <>
            {hasScore && <span className={styles.eventChipScore}>{event.teamScore}–{event.opponentScore}</span>}
            {!span && event.result && (
              <span className={styles.eventChipResult} style={{
                color: event.result === 'win' ? '#22c55e' : event.result === 'loss' ? '#ef4444' : '#f59e0b',
              }}>
                {event.result.toUpperCase()}
              </span>
            )}
          </>
        )}
      </span>
    </button>
  );
}

// Season-record categories + their default inclusion. Owner-decided default = League + Tournament
// count, Scrimmage excluded; the coach can toggle each and the choice is remembered per team.
const WLT_CATS: { key: RepEventType; label: string }[] = [
  { key: 'league_game', label: 'League' },
  { key: 'tournament_game', label: 'Tournament' },
  { key: 'scrimmage', label: 'Scrimmage' },
];
const WLT_DEFAULT: Record<string, boolean> = { league_game: true, tournament_game: true, scrimmage: false };

function tallyResults(list: RepTeamEvent[]) {
  return {
    w: list.filter(e => e.result === 'win').length,
    l: list.filter(e => e.result === 'loss').length,
    t: list.filter(e => e.result === 'tie').length,
  };
}

function WLTWidget({ events, teamId }: { events: RepTeamEvent[]; teamId: string }) {
  const storageKey = `flhq.coachWlt.${teamId}`;
  const [included, setIncluded] = useState<Record<string, boolean>>(WLT_DEFAULT);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  // Remembered choice loads after mount (avoids an SSR/hydration mismatch); defaults stand until then.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setIncluded({ ...WLT_DEFAULT, ...JSON.parse(raw) });
    } catch { /* ignore unreadable storage */ }
  }, [storageKey]);

  function toggle(key: string) {
    setIncluded(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  // Any finalized, non-cancelled game across the three game types is a candidate; the widget only
  // appears once at least one exists (so the toggles are discoverable even if a category is off).
  const candidates = events.filter(e => GAME_EVENT_TYPES.includes(e.eventType) && e.result && e.status !== 'cancelled');
  if (!candidates.length) return null;

  const { w, l, t } = tallyResults(candidates.filter(e => included[e.eventType]));

  // Scope caption — states exactly what the number counts, so a "0–0" beside a visible WIN
  // (e.g. a scrimmage that's excluded by default) never reads as broken.
  const activeLabels = WLT_CATS.filter(c => included[c.key]).map(c => c.label);
  const scope = activeLabels.length === 0
    ? 'No categories selected'
    : activeLabels.length === WLT_CATS.length
      ? 'All games'
      : activeLabels.join(' + ');

  return (
    <div className={styles.wltWidget}>
      <span className={styles.wltLabel}>Season Record</span>
      <div className={styles.wltMain}>
        <div className={styles.wltRow}>
          <span className={styles.wltW}>{w}<small>W</small></span>
          <span className={styles.wltSep}>–</span>
          <span className={styles.wltL}>{l}<small>L</small></span>
          {t > 0 && <><span className={styles.wltSep}>–</span><span className={styles.wltT}>{t}<small>T</small></span></>}
        </div>
        <span className={styles.wltScope}>{scope}</span>
      </div>
      <div className={styles.wltControls}>
        <span className={styles.wltCountLabel}>Counting:</span>
        <div className={styles.wltToggles} role="group" aria-label="Include in season record">
          {WLT_CATS.map(c => (
            <button
              key={c.key}
              type="button"
              aria-pressed={!!included[c.key]}
              className={`${styles.wltToggle} ${included[c.key] ? styles.wltToggleActive : ''}`}
              onClick={() => toggle(c.key)}
            >
              {included[c.key] && <Check size={12} aria-hidden />}
              {c.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.wltBreakdownToggle}
          onClick={() => setBreakdownOpen(o => !o)}
          aria-expanded={breakdownOpen}
        >
          {breakdownOpen ? 'Hide breakdown' : 'Breakdown'}
        </button>
      </div>
      {breakdownOpen && (
        <div className={styles.wltBreakdown}>
          {WLT_CATS.map(c => {
            const cat = tallyResults(candidates.filter(e => e.eventType === c.key));
            const total = cat.w + cat.l + cat.t;
            const on = !!included[c.key];
            return (
              <div key={c.key} className={styles.wltBreakdownRow} data-on={on ? 'true' : 'false'}>
                <span className={styles.wltBreakdownLabel}>
                  <span className={styles.wltBreakdownDot} aria-hidden />
                  {c.label}
                </span>
                <span className={styles.wltBreakdownVal}>{total ? `${cat.w}–${cat.l}${cat.t ? `–${cat.t}` : ''}` : '—'}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CoachesSchedulePage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  const { assignments, loading: ctxLoading } = useCoaches();
  const { currentOrg } = useOrg();
  // Sport vocabulary (period word, position legend) routes through the Sport Pack.
  // The coach portal is softball/baseball today; a team-sport field would feed this later.
  const sportPack = getSportPack(DEFAULT_SPORT);

  const [events, setEvents] = useState<RepTeamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [view, setView] = useState<ViewMode>('list');
  const [cursorDate, setCursorDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [selectedEvent, setSelectedEvent] = useState<RepTeamEvent | null>(null);
  const [slideTab, setSlideTab] = useState<'attendance' | 'lineup' | 'result'>('attendance');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  // Whether the event being edited belongs to a recurring series (drives the "this / future / all"
  // save scope chooser) and whether that chooser is currently shown.
  const [editingRecurring, setEditingRecurring] = useState(false);
  const [editScopeOpen, setEditScopeOpen] = useState(false);
  const [formBaseline, setFormBaseline] = useState('');
  const [addTypeMenuOpen, setAddTypeMenuOpen] = useState(false);
  const [form, setForm] = useState<EventForm>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ eventId: string; isRecurring: boolean } | null>(null);
  const [attendanceRows, setAttendanceRows] = useState<AttendancePlayerRow[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceDirty, setAttendanceDirty] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  // Attendance metric-filter ('all' or a status) + which rows have their note input expanded.
  const [attendanceFilter, setAttendanceFilter] = useState<RepAttendanceStatus | 'all'>('all');
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [lineupMode, setLineupMode] = useState<RepLineupMode>('everyone_bats');
  const [lineupInningCount, setLineupInningCount] = useState(sportPack.defaultPeriodCount);
  const [lineupNotes, setLineupNotes] = useState('');
  const [lineupRows, setLineupRows] = useState<LineupPlayerRow[]>([]);
  const [autoFillOpen, setAutoFillOpen] = useState(false);
  const [lineupPdfOpen, setLineupPdfOpen] = useState(false);
  const [pdfIncludeNotes, setPdfIncludeNotes] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templates, setTemplates] = useState<RepTeamLineupTemplate[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateError, setTemplateError] = useState('');
  const [lineupNotice, setLineupNotice] = useState('');
  const [autoPolicy, setAutoPolicy] = useState<PositionPolicy>('balanced');
  const [autoFillMode, setAutoFillMode] = useState<FillMode>('empty');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const confirm = useConfirm();
  const lineupSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [lineupLoading, setLineupLoading] = useState(false);
  const [lineupSaving, setLineupSaving] = useState(false);
  const [lineupDirty, setLineupDirty] = useState(false);
  const [lineupError, setLineupError] = useState('');
  const [pdfSettings, setPdfSettings] = useState<OrgPdfSettings | null>(null);

  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const assignment = assignments.find(a => a.teamId === teamId);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setEvents(data.events ?? []);
    } catch (e: unknown) {
      setError(errorMessage(e, 'Failed to load events'));
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => {
    void Promise.resolve().then(fetchEvents);
  }, [fetchEvents]);

  useEffect(() => {
    fetch(`/api/admin/org/pdf-settings?orgSlug=${orgSlug}`)
      .then(r => r.ok ? r.json() : {})
      .then(d => setPdfSettings(d as OrgPdfSettings))
      .catch(() => setPdfSettings(null));
  }, [orgSlug]);

  // Saved lineup templates are team + active-program-year scoped (not per event) — load once.
  const reloadTemplates = useCallback(async () => {
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/lineup-templates`);
      if (!res.ok) return;
      const data = await res.json();
      setTemplates(data.templates ?? []);
    } catch { /* non-blocking — templates are optional */ }
  }, [orgSlug, teamId]);

  useEffect(() => { void Promise.resolve().then(reloadTemplates); }, [reloadTemplates]);

  useEffect(() => {
    if (!selectedEvent) {
      return;
    }

    let cancelled = false;
    const eventId = selectedEvent.id;

    async function fetchAttendance() {
      setAttendanceLoading(true);
      setLineupLoading(isLineupEvent(selectedEvent));
      setAttendanceError('');
      setLineupError('');
      setAttendanceDirty(false);
      setLineupDirty(false);
      try {
        const lineupCapable = isLineupEvent(selectedEvent);
        const res = await fetch(
          lineupCapable
            ? `/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/lineup`
            : `/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/attendance`,
        );
        if (!res.ok) {
          const d = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(d.error ?? 'Failed to load event details');
        }
        const data: {
          players?: RepRosterPlayer[];
          attendance?: RepTeamEventAttendance[];
          lineup?: RepTeamLineup | null;
          entries?: RepTeamLineupEntry[];
        } = await res.json();
        if (cancelled) return;

        const players = data.players ?? [];
        const attendanceByPlayer = new Map((data.attendance ?? []).map(row => [row.playerId, row]));
        setAttendanceRows(players.map(player => {
          const existing = attendanceByPlayer.get(player.id);
          return {
            player,
            status: existing?.status ?? 'unknown',
            note: existing?.note ?? '',
          };
        }));
        if (lineupCapable) {
          const mode = data.lineup?.lineupMode ?? 'everyone_bats';
          setLineupMode(mode);
          setLineupInningCount(data.lineup?.inningCount ?? sportPack.defaultPeriodCount);
          setLineupNotes(data.lineup?.notes ?? '');
          setLineupRows(renumberBattingOrder(sortLineupRows(buildLineupRows(players, data.entries ?? [], mode)), mode));
        } else {
          setLineupRows([]);
        }
      } catch (e: unknown) {
        if (!cancelled) setAttendanceError(errorMessage(e, 'Failed to load attendance'));
      } finally {
        if (!cancelled) setAttendanceLoading(false);
        if (!cancelled) setLineupLoading(false);
      }
    }

    fetchAttendance();
    return () => { cancelled = true; };
  }, [orgSlug, selectedEvent, teamId, sportPack.defaultPeriodCount]);

  // ── Add event ───────────────────────────────────────────────────────────────

  function openAddForm(type: RepEventType, overrides?: Partial<EventForm>) {
    setAddTypeMenuOpen(false);
    // Pre-seed a sensible start (viewed day at 6:00 PM, :00 minutes) and a 2-hour end, so the
    // native time picker never defaults to the current minute and "Ends" starts populated.
    const defaultStart = `${cursorDate}T${DEFAULT_EVENT_HOUR}`;
    // Games default to "Home" so the printout "@/vs" and the win/loss side are never left blank.
    // `overrides` (e.g. a tournament game-slot's parent + name) are folded into the baseline too,
    // so a pre-seeded form doesn't read as "unsaved" before the coach touches anything.
    const blank = {
      ...BLANK_FORM,
      eventType: type,
      homeAway: needsOpponent(type) ? 'home' : '',
      startsAt: defaultStart,
      endsAt: addHoursLocal(defaultStart, 2),
      ...overrides,
    };
    setForm(blank);
    setFormBaseline(JSON.stringify(blank));
    setEditingEventId(null);
    setEditingRecurring(false);
    setEditScopeOpen(false);
    setSaveError('');
    setShowAddForm(true);
  }

  // Change the event type inside the form without losing shared fields: reset only the
  // type-specific bits (opponent/home-away, recurrence). The name is left alone (it auto-names
  // from the opponent at save time if the coach left it blank).
  function changeEventType(next: RepEventType) {
    setForm(f => {
      const out: EventForm = { ...f, eventType: next };
      if (!needsOpponent(next)) { out.opponent = ''; out.homeAway = ''; out.uniform = ''; }
      else if (!out.homeAway) { out.homeAway = 'home'; }
      if (!needsRecurrence(next)) { out.isRecurring = false; }
      if (next !== 'tournament_game') { out.parentEventId = ''; }
      return out;
    });
  }

  // Attach a new tournament game to a parent tournament. Pre-fills the game's date to the
  // tournament's start day (keeping any time the coach already set) so a game-slot lands inside
  // its tournament's span instead of on today's date.
  function selectParentTournament(id: string) {
    setForm(f => {
      if (!id) return { ...f, parentEventId: '' };
      const t = events.find(e => e.id === id);
      const next: EventForm = { ...f, parentEventId: id };
      if (t?.startsAt) {
        const time = f.startsAt.slice(11, 16) || DEFAULT_EVENT_HOUR;
        next.startsAt = `${dayStr(t.startsAt)}T${time}`;
        next.endsAt = addHoursLocal(next.startsAt, 2);
      }
      return next;
    });
  }

  // Resource-link row editing.
  function addResource() {
    setForm(f => f.resources.length >= MAX_EVENT_RESOURCES ? f : { ...f, resources: [...f.resources, { type: 'link', label: '', url: '' }] });
  }
  function updateResource(index: number, patch: Partial<RepEventResource>) {
    setForm(f => ({ ...f, resources: f.resources.map((r, i) => i === index ? { ...r, ...patch } : r) }));
  }
  function removeResource(index: number) {
    setForm(f => ({ ...f, resources: f.resources.filter((_, i) => i !== index) }));
  }

  /** Name to persist: the coach's text, or a friendly default so a blank name never blocks a save. */
  function eventNameForSave(f: EventForm): string {
    return f.name.trim() || deriveGameName(f.eventType, f.opponent) || EVENT_NAME_PREFIX[f.eventType];
  }

  // Changing the start keeps the end 2 hours later, unless the coach has set a custom end.
  function setStartsAt(value: string) {
    setForm(f => {
      const prevAutoEnd = f.startsAt ? addHoursLocal(f.startsAt, 2) : '';
      const endIsAuto = f.endsAt === '' || f.endsAt === prevAutoEnd;
      return { ...f, startsAt: value, endsAt: endIsAuto && value ? addHoursLocal(value, 2) : f.endsAt };
    });
  }

  function openEditForm(event: RepTeamEvent) {
    const f = eventToForm(event);
    setForm(f);
    setFormBaseline(JSON.stringify(f));
    setEditingEventId(event.id);
    setEditingRecurring(event.isRecurring);
    setEditScopeOpen(false);
    setSaveError('');
    closeSelectedEvent();
    setShowAddForm(true);
  }

  const formDirty = showAddForm && JSON.stringify(form) !== formBaseline;
  // Event-form view helpers (drive the per-type sections + the Save guard).
  const recurringSeries = needsRecurrence(form.eventType) && form.isRecurring;
  // Tournament-game attachment: the active (non-cancelled) tournaments a new game can hang under.
  const tournamentOptions = events
    .filter(e => e.eventType === 'external_tournament' && e.status !== 'cancelled')
    .sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''));
  // Recent locations this team has already used — a free, zero-infra suggestion list so a coach
  // can reuse a regular field in one tap (most-recent first, de-duped by name, capped). Each
  // carries its remembered address so a chip refills both the name and the map address.
  const recentLocations = (() => {
    const seen = new Set<string>();
    const out: { name: string; address: string }[] = [];
    for (const e of [...events].sort((a, b) => (b.startsAt ?? '').localeCompare(a.startsAt ?? ''))) {
      const name = e.location?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name, address: e.locationAddress?.trim() ?? '' });
      if (out.length >= 12) break;
    }
    return out;
  })();
  const addingTournamentGame = form.eventType === 'tournament_game' && !editingEventId;
  // Block saving an orphaned game slot: a new tournament game must have a parent. (A parent set
  // via the in-detail "+ Add game" shortcut counts even if its tournament is cancelled and so
  // absent from the picker, so this keys off the actual parent, not the options list.)
  const tournamentParentMissing = addingTournamentGame && !form.parentEventId;
  const formHasStart = recurringSeries
    ? Boolean(form.startTime && form.startDate && form.endDate)
    : Boolean(form.startsAt);
  // A resource row blocks save only if it has content but is incomplete/has a bad URL; fully-empty
  // rows are fine (dropped on save).
  const resourcesInvalid = form.resources.some(r => {
    const has = r.label.trim() || r.url.trim();
    return has && (!r.label.trim() || !isValidResourceUrl(r.url));
  });
  const recurrencePreview = recurringSeries && form.startDate && form.startTime
    ? `Adds a ${EVENT_LABELS[form.eventType].toLowerCase()} every ${DAYS_OF_WEEK[Number(form.dayOfWeek)] ?? ''}${form.endDate ? ` from ${form.startDate} through ${form.endDate}` : ` starting ${form.startDate}`} at ${form.startTime}.`
    : '';

  // Tabs for the event slide-over (keeps it short instead of one long stack)
  const isGameEvent = !!selectedEvent &&
    ['league_game', 'tournament_game', 'scrimmage'].includes(selectedEvent.eventType);
  const slideTabs: { key: 'attendance' | 'lineup' | 'result'; label: string }[] = [{ key: 'attendance', label: 'Attendance' }];
  if (isLineupEvent(selectedEvent)) slideTabs.push({ key: 'lineup', label: 'Lineup' });
  if (isGameEvent) slideTabs.push({ key: 'result', label: 'Result' });
  const activeSlideTab = slideTabs.some(t => t.key === slideTab) ? slideTab : 'attendance';

  // Compact one-line summary for the slide-over header (replaces the tall label/value list).
  // Tournaments (multi-day containers) show a date range and no clock time; "@" = away.
  const isTournamentContainer = selectedEvent?.eventType === 'external_tournament';
  const matchupSep = selectedEvent?.homeAway === 'away' ? '@' : 'vs';
  const eventMeta = selectedEvent ? [
    selectedEvent.startsAt
      ? (isTournamentContainer && selectedEvent.endsAt
          ? `${fmtDate(selectedEvent.startsAt)} – ${fmtDate(selectedEvent.endsAt)}`
          : fmtDate(selectedEvent.startsAt))
      : null,
    (!isTournamentContainer && selectedEvent.startsAt)
      ? `${fmtTime(selectedEvent.startsAt)}${selectedEvent.endsAt ? ` – ${fmtTime(selectedEvent.endsAt)}` : ''}`
      : null,
    selectedEvent.arrivalTime ? `Arrive ${fmtClock(selectedEvent.arrivalTime)}` : null,
    selectedEvent.opponent ? `${matchupSep} ${selectedEvent.opponent}${selectedEvent.homeAway === 'neutral' ? ' (neutral)' : ''}` : null,
    selectedEvent.isRecurring ? 'Repeats weekly' : null,
  ].filter(Boolean) as string[] : [];
  // Location is rendered separately as a tappable Google Maps link (reusing the shared helper),
  // with the optional field/diamond # appended to the label (the maps query stays the location).
  const locationLabel = selectedEvent
    ? [selectedEvent.location, selectedEvent.fieldNumber].filter(Boolean).join(' · ')
    : '';

  // Lineup checks + fair-play tally (pure; recomputed as the grid changes)
  const lineupAnalysis = analyzeLineup(
    lineupRows.map(r => ({ playerId: r.player.id, inningPositions: r.inningPositions })),
    lineupInningCount,
  );
  const fairPlayByPlayer = new Map(lineupAnalysis.fairPlay.map(f => [f.playerId, f]));
  const summaryPositions = POSITION_ORDER.filter(pos => lineupAnalysis.fairPlay.some(f => (f.positionCounts[pos] ?? 0) > 0));
  const benchVals = lineupAnalysis.fairPlay.map(f => f.benched);
  const benchMin = benchVals.length ? Math.min(...benchVals) : 0;
  const benchMax = benchVals.length ? Math.max(...benchVals) : 0;

  // Shared per-player "on field" gauge (used by both the desktop grid and mobile chips)
  function onFieldGauge(fp?: { onField: number; benched: number; consecutiveBench: boolean }) {
    const onF = fp?.onField ?? 0;
    const pct = lineupInningCount ? Math.round((onF / lineupInningCount) * 100) : 0;
    return (
      <span className={styles.lineupGauge}>
        <span className={styles.lineupGaugeTrack}>
          <span className={styles.lineupGaugeFill} data-warn={fp?.consecutiveBench ? 'true' : undefined} style={{ width: `${pct}%` }} />
        </span>
        <span className={styles.lineupGaugeCap}>{onF}/{lineupInningCount} · sits {fp?.benched ?? 0}</span>
      </span>
    );
  }

  function clearLineup() {
    setLineupRows(rows => rows.map(r => ({ ...r, inningPositions: {} })));
    setLineupDirty(true);
    setLineupNotice('');
  }

  async function handleAutoFill() {
    // No silent overwrite: regenerating a grid with assignments asks first.
    if (autoFillMode === 'regenerate') {
      const hasAny = lineupRows.some(r => Object.values(r.inningPositions).some(Boolean));
      if (hasAny && !(await confirm({
        title: 'Regenerate lineup?',
        message: 'This replaces the positions currently in the grid. Continue?',
        confirmText: 'Regenerate',
        cancelText: 'Keep current',
        tone: 'warning',
      }))) return;
    }
    // In 9-player mode only the starters take the field; bench players sit every inning.
    const fielders = lineupMode === 'nine_player' ? lineupRows.filter(r => r.starter) : lineupRows;
    const benchOnly = lineupMode === 'nine_player' ? lineupRows.filter(r => !r.starter) : [];

    const generated = generateBestLineup({
      players: fielders.map(r => ({
        playerId: r.player.id,
        primaryPosition: r.player.primaryPosition,
        secondaryPosition: r.player.secondaryPosition,
        inningPositions: r.inningPositions,
      })),
      inningCount: lineupInningCount,
      policy: autoPolicy,
      fillMode: autoFillMode,
    });

    const benchAllInnings: Record<string, string> = {};
    for (let inn = 1; inn <= lineupInningCount; inn++) benchAllInnings[String(inn)] = 'Bench';

    setLineupRows(rows => rows.map(r => {
      if (lineupMode === 'nine_player' && benchOnly.some(b => b.player.id === r.player.id)) {
        return { ...r, inningPositions: autoFillMode === 'empty' ? { ...benchAllInnings, ...r.inningPositions } : benchAllInnings };
      }
      return { ...r, inningPositions: generated.get(r.player.id) ?? r.inningPositions };
    }));
    setLineupDirty(true);
    setLineupNotice('');
    setAutoFillOpen(false);
  }

  // The current grid as a reusable template payload (mirrors the lineup save shape, minus notes).
  function lineupTemplatePayload() {
    return lineupRows.map(row => ({
      playerId: row.player.id,
      battingOrder: lineupMode === 'nine_player' && !row.starter ? null : (Number(row.battingOrder) || null),
      starter: lineupMode === 'nine_player' ? row.starter : true,
      inningPositions: row.inningPositions,
    }));
  }

  async function handleSaveTemplate() {
    const name = newTemplateName.trim();
    if (!name || lineupRows.length === 0) return;
    setTemplateSaving(true);
    setTemplateError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/lineup-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, lineupMode, inningCount: lineupInningCount, entries: lineupTemplatePayload() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Could not save template');
      }
      setNewTemplateName('');
      await reloadTemplates();
      setLineupNotice(`Saved “${name}” as a template.`);
      setTemplatesOpen(false);
    } catch (e: unknown) {
      setTemplateError(errorMessage(e, 'Could not save template'));
    } finally {
      setTemplateSaving(false);
    }
  }

  // Load a template into the editable grid (unsaved). Maps by current roster player_id and
  // silently skips players no longer rostered; players not in the template reset to blank.
  async function applyTemplate(t: RepTeamLineupTemplate) {
    const hasAny = lineupRows.some(r => Object.values(r.inningPositions).some(Boolean));
    if (hasAny && !(await confirm({
      title: 'Start from template?',
      message: `Replace the current lineup with “${t.name}”? Unsaved changes will be lost.`,
      confirmText: 'Load template',
      cancelText: 'Keep current',
      tone: 'warning',
    }))) return;

    const byId = new Map(t.entries.map(e => [e.playerId, e]));
    const rosterIds = new Set(lineupRows.map(r => r.player.id));
    const skipped = t.entries.filter(e => !rosterIds.has(e.playerId)).length;

    setLineupMode(t.lineupMode);
    setLineupInningCount(t.inningCount);
    setLineupRows(rows => renumberBattingOrder(sortLineupRows(rows.map(row => {
      const e = byId.get(row.player.id);
      if (e) {
        return {
          ...row,
          starter: e.starter,
          battingOrder: e.battingOrder != null ? String(e.battingOrder) : '',
          inningPositions: { ...e.inningPositions },
        };
      }
      // Current-roster player who wasn't in the template → blank slot.
      return { ...row, starter: t.lineupMode === 'everyone_bats', battingOrder: '', inningPositions: {} };
    })), t.lineupMode));
    setLineupDirty(true);
    setTemplatesOpen(false);
    setLineupNotice(skipped > 0
      ? `Loaded “${t.name}” — skipped ${skipped} player${skipped === 1 ? '' : 's'} no longer on the roster.`
      : `Loaded “${t.name}” — review and save when ready.`);
  }

  async function handleDeleteTemplate(t: RepTeamLineupTemplate) {
    if (!(await confirm({
      title: 'Delete template?',
      message: `Delete the saved template “${t.name}”? This can't be undone.`,
      confirmText: 'Delete',
      cancelText: 'Keep',
      tone: 'warning',
    }))) return;
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/lineup-templates/${t.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Could not delete template');
      }
      await reloadTemplates();
    } catch (e: unknown) {
      setTemplateError(errorMessage(e, 'Could not delete template'));
    }
  }

  function handleLineupDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLineupRows(rows => {
      const oldIndex = rows.findIndex(r => r.player.id === active.id);
      const newIndex = rows.findIndex(r => r.player.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return rows;
      return renumberBattingOrder(arrayMove(rows, oldIndex, newIndex), lineupMode);
    });
    setLineupDirty(true);
  }

  function handleLineupStarterToggle(playerId: string, checked: boolean) {
    setLineupRows(rows => renumberBattingOrder(
      rows.map(r => r.player.id === playerId ? { ...r, starter: checked } : r),
      lineupMode,
    ));
    setLineupDirty(true);
  }

  function openEvent(event: RepTeamEvent) {
    setSlideTab('attendance');
    setAttendanceFilter('all');
    setExpandedNotes(new Set());
    setSelectedEvent(event);
  }

  function toggleNote(playerId: string) {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId); else next.add(playerId);
      return next;
    });
  }

  async function requestCloseForm() {
    if (formDirty && !(await confirm({
      title: 'Discard changes?',
      message: 'You have unsaved changes to this event. Discard them?',
      confirmText: 'Discard',
      cancelText: 'Keep editing',
      tone: 'danger',
    }))) return;
    setShowAddForm(false);
    setEditingEventId(null);
    setEditingRecurring(false);
    setEditScopeOpen(false);
  }

  // scope 'one' = just this occurrence; 'remaining' = this + future; 'all' = the whole series.
  async function handleUpdate(scope: 'one' | 'remaining' | 'all' = 'one') {
    if (!editingEventId) return;
    setSaveError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${editingEventId}?scope=${scope}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: eventNameForSave(form),
          description: form.description.trim() || null,
          startsAt: form.startsAt || null,
          endsAt: form.endsAt || null,
          location: form.location.trim() || null,
          locationAddress: form.locationAddress.trim() || null,
          arrivalTime: form.arrivalTime || null,
          fieldNumber: form.fieldNumber.trim() || null,
          uniform: form.uniform.trim() || null,
          resources: form.resources,
          opponent: form.opponent.trim() || null,
          homeAway: form.homeAway || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Save failed');
      }
      setShowAddForm(false);
      setEditingEventId(null);
      setEditingRecurring(false);
      setEditScopeOpen(false);
      await fetchEvents();
    } catch (e: unknown) {
      setSaveError(errorMessage(e, 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (editingEventId) {
      // A recurring edit must always go through the scope chooser (this / future / all), never
      // silently save one occurrence — guard here too, not only on the button.
      if (editingRecurring) { setEditScopeOpen(true); return; }
      return handleUpdate('one');
    }
    setSaveError('');
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        eventType: form.eventType,
        name: eventNameForSave(form),
        description: form.description.trim() || null,
        location: form.location.trim() || null,
        locationAddress: form.locationAddress.trim() || null,
        arrivalTime: form.arrivalTime || null,
        fieldNumber: form.fieldNumber.trim() || null,
        uniform: form.uniform.trim() || null,
        resources: form.resources,
        opponent: form.opponent.trim() || null,
        homeAway: form.homeAway || null,
        parentEventId: form.parentEventId || null,
      };

      if (needsRecurrence(form.eventType) && form.isRecurring) {
        body.isRecurring = true;
        body.recurrenceRule = {
          dayOfWeek: Number(form.dayOfWeek),
          startDate: form.startDate,
          endDate: form.endDate,
          startTime: form.startTime,
          endTime: form.endTime || null,
        };
      } else {
        if (!form.startsAt || (!form.isRecurring && form.eventType === 'practice' && !form.startTime)) {
          const d = form.startDate || form.startsAt?.slice(0, 10);
          const t = form.startTime || form.startsAt?.slice(11, 16);
          body.startsAt = d && t ? isoFromInputs(d, t) : form.startsAt;
        } else {
          body.startsAt = form.startsAt;
        }
        body.endsAt = form.endsAt || null;
      }

      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Save failed');
      }
      setShowAddForm(false);
      await fetchEvents();
    } catch (e: unknown) {
      setSaveError(errorMessage(e, 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  // ── Score entry ─────────────────────────────────────────────────────────────

  const [scoreForm, setScoreForm] = useState<{ teamScore: string; opponentScore: string; result: string } | null>(null);

  function closeSelectedEvent() {
    setSelectedEvent(null);
    setScoreForm(null);
    setSaveError('');
    setLineupRows([]);
    setLineupError('');
    setLineupDirty(false);
    setAutoFillOpen(false);
    setLineupPdfOpen(false);
    setPdfIncludeNotes(false);
    setTemplatesOpen(false);
    setTemplateError('');
    setNewTemplateName('');
    setLineupNotice('');
  }

  // Closing the event panel with unsaved attendance/lineup edits asks first.
  async function requestCloseSlideOver() {
    if ((attendanceDirty || lineupDirty) && !(await confirm({
      title: 'Discard changes?',
      message: 'You have unsaved attendance or lineup changes. Discard them?',
      confirmText: 'Discard',
      cancelText: 'Keep editing',
      tone: 'danger',
    }))) return;
    closeSelectedEvent();
  }

  async function handleScoreSave() {
    if (!selectedEvent || !scoreForm) return;
    setSaving(true);
    try {
      const ts = Number(scoreForm.teamScore);
      const os = Number(scoreForm.opponentScore);
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${selectedEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamScore: ts,
          opponentScore: os,
          result: scoreForm.result || (ts > os ? 'win' : ts < os ? 'loss' : 'tie'),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      const { event: updated } = await res.json();
      setSelectedEvent(updated);
      setScoreForm(null);
      await fetchEvents();
    } catch (e: unknown) {
      setSaveError(errorMessage(e, 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  // ── Cancel / restore ─────────────────────────────────────────────────────────
  // A cancelled event stays on the schedule (dimmed + badged) rather than being deleted —
  // parity with the free Basic portal, and the honest way to handle a called-off practice/game.

  async function handleToggleCancel() {
    if (!selectedEvent) return;
    const nextStatus = selectedEvent.status === 'cancelled' ? 'scheduled' : 'cancelled';
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${selectedEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Update failed');
      const { event: updated } = await res.json();
      setSelectedEvent(updated);
      await fetchEvents();
    } catch (e: unknown) {
      setSaveError(errorMessage(e, 'Update failed'));
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete(eventId: string, scope: 'one' | 'remaining' | 'all') {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}?scope=${scope}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Delete failed');
      setDeleteConfirm(null);
      setSelectedEvent(null);
      await fetchEvents();
    } catch (e: unknown) {
      setSaveError(errorMessage(e, 'Delete failed'));
    } finally {
      setSaving(false);
    }
  }

  // ── Export ──────────────────────────────────────────────────────────────────

  function setPlayerAttendance(playerId: string, patch: Partial<Pick<AttendancePlayerRow, 'status' | 'note'>>) {
    setAttendanceRows(rows => rows.map(row => (
      row.player.id === playerId ? { ...row, ...patch } : row
    )));
    setAttendanceDirty(true);
  }

  function setAllAttendance(status: RepAttendanceStatus) {
    setAttendanceRows(rows => rows.map(row => ({ ...row, status })));
    setAttendanceDirty(true);
    setAttendanceFilter('all'); // a status filter would empty out after a bulk set — show the result
  }

  async function handleAttendanceSave() {
    if (!selectedEvent) return;
    setAttendanceSaving(true);
    setAttendanceError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${selectedEvent.id}/attendance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: attendanceRows.map(row => ({
            playerId: row.player.id,
            status: row.status,
            note: row.note,
          })),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Attendance save failed');
      }
      setAttendanceDirty(false);
    } catch (e: unknown) {
      setAttendanceError(errorMessage(e, 'Attendance save failed'));
    } finally {
      setAttendanceSaving(false);
    }
  }

  function updateLineupPosition(playerId: string, inning: number, position: string) {
    setLineupRows(rows => rows.map(row => (
      row.player.id === playerId
        ? {
          ...row,
          inningPositions: {
            ...row.inningPositions,
            [String(inning)]: position,
          },
        }
        : row
    )));
    setLineupDirty(true);
  }

  function handleLineupModeChange(mode: RepLineupMode) {
    setLineupMode(mode);
    setLineupRows(rows => renumberBattingOrder(
      rows.map((row, index) => mode === 'everyone_bats' ? { ...row, starter: true } : { ...row, starter: index < 9 }),
      mode,
    ));
    setLineupDirty(true);
  }

  async function handleLineupSave() {
    if (!selectedEvent) return;
    setLineupSaving(true);
    setLineupError('');
    try {
      const rows = lineupRows.map(row => ({
        playerId: row.player.id,
        battingOrder: lineupMode === 'nine_player' && !row.starter ? null : row.battingOrder,
        starter: lineupMode === 'nine_player' ? row.starter : true,
        inningPositions: row.inningPositions,
        notes: row.notes,
      }));
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${selectedEvent.id}/lineup`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineupMode,
          inningCount: lineupInningCount,
          notes: lineupNotes,
          entries: rows,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Lineup save failed');
      }
      const data: { entries?: RepTeamLineupEntry[]; lineup?: RepTeamLineup } = await res.json();
      setLineupDirty(false);
      setLineupNotice('');
      if (data.entries) {
        const loadedMode = data.lineup?.lineupMode ?? lineupMode;
        setLineupRows(renumberBattingOrder(sortLineupRows(buildLineupRows(lineupRows.map(row => row.player), data.entries, loadedMode)), loadedMode));
      }
    } catch (e: unknown) {
      setLineupError(errorMessage(e, 'Lineup save failed'));
    } finally {
      setLineupSaving(false);
    }
  }

  // Shared poster/card content — the live grid as a printable lineup payload. Sorted so
  // batters lead (blank batting order sorts last → 9-player subs trail). Blank cells stay
  // blank (empty boxes on the poster); Bench prints "BN".
  function buildPosterOptions() {
    if (!selectedEvent || lineupRows.length === 0) return null;
    const settings: OrgPdfSettings = {
      ...DEFAULT_PDF_SETTINGS,
      ...(pdfSettings && Object.keys(pdfSettings).length > 0 ? pdfSettings : {}),
    };
    const players: LineupPosterPlayer[] = sortLineupRows(lineupRows).map(row => {
      const isSub = lineupMode === 'nine_player' && !row.starter;
      return {
        battingOrder: isSub ? '' : row.battingOrder,
        name: playerDisplayName(row.player),
        isSub,
        inningPositions: row.inningPositions,
      };
    });
    return {
      teamName: assignment?.teamName ?? teamId,
      opponent: selectedEvent.opponent,
      homeAway: selectedEvent.homeAway,        // 'away' → "@", else "vs"
      dateLabel: selectedEvent.startsAt ? `${fmtDate(selectedEvent.startsAt)} · ${fmtTime(selectedEvent.startsAt)}` : '',
      eventName: selectedEvent.name,
      inningCount: lineupInningCount,
      players,
      // Legend mirrors the actual lineup-cell vocabulary (incl. EH); Bench is added by the
      // builder. LINEUP_POSITIONS is the source of what a coach can put in a cell.
      legend: buildPositionLegend(LINEUP_POSITIONS.filter(p => p && p !== 'Bench')),
      includeNotes: pdfIncludeNotes,           // print the lineup notes at the foot of the poster
      notes: lineupNotes,
      accentColor: settings.accentColor,
      showBranding: settings.showBranding,
    };
  }

  async function handleLineupPoster() {
    if (!selectedEvent) return;
    const opts = buildPosterOptions();
    if (!opts) return;
    setLineupPdfOpen(false);
    await downloadLineupPoster(
      buildFilename({ org: currentOrg?.slug ?? orgSlug, dataset: 'lineup', scope: selectedEvent.name || opts.teamName }, 'pdf'),
      opts,
    );
  }

  async function handleBattingCard() {
    if (!selectedEvent) return;
    const opts = buildPosterOptions();
    if (!opts) return;
    setLineupPdfOpen(false);
    await downloadBattingOrderCard(
      buildFilename({ org: currentOrg?.slug ?? orgSlug, dataset: 'batting-order', scope: selectedEvent.name || opts.teamName }, 'pdf'),
      opts,
    );
  }

  function buildExportRows() {
    return events.map(e => ({
      date:      e.startsAt ? e.startsAt.slice(0, 10) : '',
      time:      e.startsAt ? new Date(e.startsAt).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true }) : '',
      arrival:   e.arrivalTime ? fmtClock(e.arrivalTime) : '',
      eventType: EVENT_LABELS[e.eventType] ?? e.eventType,
      name:      e.name,
      opponent:  e.opponent ?? '',
      location:  e.location ?? '',
      address:   e.locationAddress ?? '',
      field:     e.fieldNumber ?? '',
      uniform:   e.uniform ?? '',
      homeAway:  e.homeAway ?? '',
    }));
  }

  function handleExportXLSX() {
    const rows = buildExportRows();
    const headers = serializeHeaders(SCHEDULE_EXPORT_COLS);
    const data    = serializeRows(rows, SCHEDULE_EXPORT_COLS);
    const filename = buildFilename(
      { org: currentOrg?.slug, dataset: 'schedule', scope: assignment?.teamName },
      'xlsx',
    );
    downloadXLSX(filename, headers, data, 'Schedule');
  }

  function handleExportCSV() {
    const rows = buildExportRows();
    const headers = serializeHeaders(SCHEDULE_EXPORT_COLS);
    const data    = serializeRows(rows, SCHEDULE_EXPORT_COLS);
    const filename = buildFilename(
      { org: currentOrg?.slug, dataset: 'schedule', scope: assignment?.teamName },
      'csv',
    );
    downloadCSVBlob(filename, generateCSV(headers, data));
  }

  async function handleExportICS() {
    const icsEvents: ICSEventInput[] = events
      .filter(e => e.startsAt)
      .map(e => {
        // Game-day detail rides the calendar entry: field/diamond joins the location, while
        // arrival + uniform lead the description so they sync to a coach's/parent's phone.
        const prefixLines = [
          e.arrivalTime ? `Arrive by ${fmtClock(e.arrivalTime)}` : null,
          e.uniform ? `Uniform: ${e.uniform}` : null,
        ].filter(Boolean);
        const description = [prefixLines.join('\n'), e.description ?? ''].filter(Boolean).join('\n\n') || undefined;
        return {
          gameId:    e.id,
          title:     e.opponent ? `${e.name} vs ${e.opponent}` : e.name,
          date:      e.startsAt!.slice(0, 10),
          time:      new Date(e.startsAt!).toTimeString().slice(0, 5),
          durationHours: e.endsAt
            ? Math.max(0.5, (new Date(e.endsAt).getTime() - new Date(e.startsAt!).getTime()) / 3600000)
            : 2,
          location:  [[e.location, e.fieldNumber].filter(Boolean).join(' · '), e.locationAddress].filter(Boolean).join(', ') || undefined,
          description,
        };
      });
    const filename = buildFilename(
      { org: currentOrg?.slug, dataset: 'schedule', scope: assignment?.teamName },
      'ics',
    );
    await downloadICS(filename, icsEvents);
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  if (ctxLoading) return <div className={styles.loadingState}>Loading schedule…</div>;
  if (!assignment) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  // Group events for month/week views
  const eventsByMonth: Record<string, RepTeamEvent[]> = {};
  const eventsByWeek: Record<string, RepTeamEvent[]> = {};
  for (const e of events) {
    if (!e.startsAt) continue;
    const mk = monthKey(e.startsAt);
    const wk = weekKey(e.startsAt);
    (eventsByMonth[mk] ??= []).push(e);
    (eventsByWeek[wk] ??= []).push(e);
  }

  // Navigator helpers for month/week
  function navigate(dir: -1 | 1) {
    const d = new Date(cursorDate + 'T00:00:00');
    if (view === 'month') {
      d.setMonth(d.getMonth() + dir);
    } else {
      d.setDate(d.getDate() + dir * 7);
    }
    setCursorDate(d.toISOString().slice(0, 10));
  }

  const curMonth = cursorDate.slice(0, 7);
  const curWeek  = weekKey(cursorDate + 'T00:00:00');

  function renderListView() {
    if (!events.length) {
      return (
        <CoachEmptyState
          icon={<Calendar size={22} aria-hidden />}
          eyebrow="Schedule"
          headline="No events scheduled yet"
          description="Add games, practices, meetings, and tournaments to your team calendar. Events are visible to you and your org admin."
          primaryAction={{
            label: 'Add Event',
            icon: <Plus size={15} aria-hidden />,
            onClick: () => setAddTypeMenuOpen(true),
          }}
        />
      );
    }
    const grouped: Record<string, RepTeamEvent[]> = {};
    for (const e of events) {
      const mk = monthKey(e.startsAt);
      (grouped[mk] ??= []).push(e);
    }
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([mk, evts]) => {
      const label = new Date(mk + '-01').toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
      return (
        <div key={mk} className={styles.calMonthGroup}>
          <div className={styles.calMonthLabel}>{label}</div>
          <div className={styles.calEventList}>
            {evts.map(e => (
              <EventChip key={e.id} event={e} onClick={() => openEvent(e)} />
            ))}
          </div>
        </div>
      );
    });
  }

  function renderWeekView() {
    const weekStart = new Date(curWeek + 'T00:00:00');
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
    return (
      <div className={styles.calWeekGrid}>
        {days.map(day => {
          const key = day.toISOString().slice(0, 10);
          const dayEvents = sortDayEvents(events.filter(e => eventOnDay(e, key)));
          return (
            <div key={key} className={styles.calWeekDay}>
              <div className={styles.calWeekDayLabel}>
                {day.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <div className={styles.calWeekDayEvents}>
                {dayEvents.length === 0
                  ? <span className={styles.calWeekEmpty}>—</span>
                  : dayEvents.map(e => (
                    <EventChip key={e.id} event={e} onClick={() => openEvent(e)} dayKey={key} />
                  ))
                }
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderMonthView() {
    const [yr, mo] = curMonth.split('-').map(Number);
    const firstDay = new Date(yr, mo - 1, 1);
    const lastDay  = new Date(yr, mo, 0);
    const startPad = firstDay.getDay();
    const cells: (Date | null)[] = [
      ...Array(startPad).fill(null),
      ...Array.from({ length: lastDay.getDate() }, (_, i) => new Date(yr, mo - 1, i + 1)),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div className={styles.calMonthGrid}>
        {DAYS_OF_WEEK.map(d => (
          <div key={d} className={styles.calMonthHeader}>{d.slice(0, 3)}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} className={styles.calMonthCell} />;
          const key = day.toISOString().slice(0, 10);
          const dayEvents = sortDayEvents(events.filter(e => eventOnDay(e, key)));
          const isToday = key === new Date().toISOString().slice(0, 10);
          return (
            <div key={key} className={`${styles.calMonthCell} ${isToday ? styles.calMonthCellToday : ''}`}>
              <span className={styles.calMonthDayNum}>{day.getDate()}</span>
              <div className={styles.calMonthDayEvents}>
                {dayEvents.slice(0, 3).map(e => {
                  // Multi-day tournament: continuation days get a "›" lead so the span reads as one run.
                  const span = tournamentSpan(e);
                  const isCont = !!span && key > span.start;
                  const label = span && span.days > 1 ? `${isCont ? '› ' : ''}${e.name}` : e.name;
                  const title = span
                    ? `${e.name} (${shortDate(span.start)}–${shortDate(span.end)})${e.status === 'cancelled' ? ' · cancelled' : ''}`
                    : (e.status === 'cancelled' ? `${e.name} (cancelled)` : e.name);
                  return (
                    <button
                      key={e.id}
                      className={styles.calMonthEventDot}
                      style={{ background: EVENT_COLORS[e.eventType], ...(e.status === 'cancelled' ? { opacity: 0.55, textDecoration: 'line-through' } : {}) }}
                      title={title}
                      onClick={() => openEvent(e)}
                    >
                      {label.slice(0, 14)}
                    </button>
                  );
                })}
                {dayEvents.length > 3 && (
                  <span className={styles.calMonthMoreDots}>+{dayEvents.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }


  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><Calendar size={22} /></div>
          <div>
            <nav className={styles.breadcrumb}>
              <Link href={`/${orgSlug}/coaches`}>Portal</Link>
              <span>/</span>
              <Link href={base}>{assignment.teamName}</Link>
              <span>/</span>
              <span>Schedule</span>
            </nav>
            <h1 className={styles.pageTitle}>Team Calendar</h1>
            <p className={styles.pageSub}>{assignment.programYearName}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Export */}
          <ExportMenu
            formats={['xlsx', 'csv', 'ics']}
            onExportXLSX={handleExportXLSX}
            onExportCSV={handleExportCSV}
            onExportICS={handleExportICS}
            disabled={events.length === 0}
          />
          {/* View toggle */}
          <div className={styles.viewToggle}>
            {(['list', 'week', 'month'] as ViewMode[]).map(v => (
              <button
                key={v}
                className={`${styles.viewToggleBtn} ${view === v ? styles.viewToggleBtnActive : ''}`}
                onClick={() => setView(v)}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          {/* Add event — coach-portal primary actions are btn-lime (CP-1), not the
              shared blueprint-blue .btnPrimary used by in-modal save buttons. */}
          <div className={styles.addEventWrap}>
            <button
              className="btn btn-lime"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', padding: '0.34rem 0.8rem' }}
              onClick={() => setAddTypeMenuOpen(v => !v)}
            >
              <Plus size={13} /> Add Event
            </button>
            {addTypeMenuOpen && (
              <div className={styles.addEventMenu}>
                {ADD_MENU.map(({ type, nested }) => {
                  const Icon = EVENT_ICONS[type];
                  return (
                    <button
                      key={type}
                      className={`${styles.addEventMenuItem}${nested ? ` ${styles.addEventMenuSubItem}` : ''}`}
                      onClick={() => openAddForm(type)}
                    >
                      <Icon size={14} style={{ color: EVENT_COLORS[type] }} />
                      {EVENT_LABELS[type]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* W/L/T widget */}
      <WLTWidget events={events} teamId={teamId} />

      {/* Navigator for week/month */}
      {view !== 'list' && (
        <div className={styles.calNav}>
          <button className={styles.calNavBtn} onClick={() => navigate(-1)}><ChevronLeft size={16} /></button>
          <span className={styles.calNavLabel}>
            {view === 'month'
              ? new Date(curMonth + '-01').toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
              : (() => {
                const start = new Date(curWeek + 'T00:00:00');
                const end = new Date(curWeek + 'T00:00:00');
                end.setDate(end.getDate() + 6);
                return `${start.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`;
              })()
            }
          </span>
          <button className={styles.calNavBtn} onClick={() => navigate(1)}><ChevronRight size={16} /></button>
        </div>
      )}

      {/* Calendar body */}
      {loading
        ? <div className={styles.loadingState}>Loading events…</div>
        : error
          ? <p className={styles.errorText}>{error}</p>
          : view === 'list'  ? renderListView()
          : view === 'week'  ? renderWeekView()
          : renderMonthView()
      }

      {/* ── Detail slide-over ─────────────────────────────────────────────── */}
      {selectedEvent && (
        <div className={`${styles.modalOverlay} ${styles.slideOverScrim}`} onClick={requestCloseSlideOver}>
          <div className={`${styles.slideOver}${activeSlideTab === 'lineup' ? ` ${styles.slideOverWide}` : ''}`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {(() => { const Icon = EVENT_ICONS[selectedEvent.eventType]; return <Icon size={16} style={{ color: EVENT_COLORS[selectedEvent.eventType] }} />; })()}
                <span className={styles.eventTypePill} style={{ background: EVENT_COLORS[selectedEvent.eventType] + '22', color: EVENT_COLORS[selectedEvent.eventType] }}>
                  {EVENT_LABELS[selectedEvent.eventType]}
                </span>
                {selectedEvent.status === 'cancelled' && (
                  <span className={styles.eventTypePill} style={{ background: '#f59e0b22', color: '#f59e0b' }}>Cancelled</span>
                )}
              </div>
              <button className={styles.modalCloseBtn} onClick={requestCloseSlideOver}>
                <X size={18} />
              </button>
            </div>
            <h2 className={styles.slideOverTitle}>{selectedEvent.name}</h2>

            {eventMeta.length > 0 && (
              <p className={styles.slideOverMeta}>{eventMeta.join('  ·  ')}</p>
            )}
            {(locationLabel || selectedEvent.uniform) && (
              <p className={styles.slideOverMeta}>
                {locationLabel && (
                  (selectedEvent.locationAddress || selectedEvent.location) ? (
                    <a
                      href={mapsHref(selectedEvent.locationAddress || selectedEvent.location || locationLabel)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.slideOverMapLink}
                      title={selectedEvent.locationAddress ? `Open ${selectedEvent.locationAddress} in Google Maps` : `Search ${locationLabel} in Google Maps`}
                      onClick={e => {
                        // Open the map explicitly rather than relying on the anchor default —
                        // inside the modal the plain new-tab navigation was landing on about:blank.
                        e.preventDefault();
                        e.stopPropagation();
                        window.open(
                          mapsHref(selectedEvent.locationAddress || selectedEvent.location || locationLabel),
                          '_blank',
                          'noopener,noreferrer',
                        );
                      }}
                    >
                      <MapPin size={13} aria-hidden />{locationLabel}
                    </a>
                  ) : (
                    /* only a field/diamond # with no place name or address — nothing useful to map */
                    <span>{locationLabel}</span>
                  )
                )}
                {locationLabel && selectedEvent.uniform ? '  ·  ' : ''}
                {selectedEvent.uniform && <span>Uniform: {selectedEvent.uniform}</span>}
              </p>
            )}
            {selectedEvent.description && (
              <p className={styles.slideOverNotes}>{selectedEvent.description}</p>
            )}

            {selectedEvent.resources && selectedEvent.resources.length > 0 && (
              <div className={styles.resourceList}>
                {selectedEvent.resources.map((r, i) => {
                  const RIcon = resourceIcon(r.url);
                  return (
                    <button
                      key={i}
                      type="button"
                      className={styles.resourceLink}
                      title={r.url}
                      onClick={() => window.open(r.url, '_blank', 'noopener,noreferrer')}
                    >
                      <RIcon size={14} aria-hidden />
                      <span className={styles.resourceLinkLabel}>{r.label}</span>
                      <ExternalLink size={12} aria-hidden style={{ opacity: 0.5, flexShrink: 0 }} />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Actions — Edit (+ tournament Add game) lead; Cancel/Delete grouped to the right so
                the destructive pair is separated from the everyday action. Kept above the tabs. */}
            <div className={styles.slideOverActions}>
              {!deleteConfirm ? (
                <>
                  <button className={styles.btnSecondary} disabled={saving} onClick={() => openEditForm(selectedEvent)}>
                    Edit details
                  </button>
                  {selectedEvent.eventType === 'external_tournament' && (
                    <button className={styles.btnSecondary} disabled={saving} onClick={() => {
                      const ev = selectedEvent;
                      setSelectedEvent(null);
                      // Seed the game on the tournament's start day so it lands inside the span.
                      const start = `${ev.startsAt ? dayStr(ev.startsAt) : cursorDate}T${DEFAULT_EVENT_HOUR}`;
                      openAddForm('tournament_game', {
                        parentEventId: ev.id,
                        name: `${ev.name} – Game`,
                        startsAt: start,
                        endsAt: addHoursLocal(start, 2),
                      });
                    }}>
                      + Add game
                    </button>
                  )}
                  <div className={styles.slideOverActionsRight}>
                    <button className={styles.btnGhost} disabled={saving} onClick={handleToggleCancel}>
                      {selectedEvent.status === 'cancelled' ? 'Restore event' : 'Cancel event'}
                    </button>
                    <button className={styles.btnDanger} onClick={() => setDeleteConfirm({ eventId: selectedEvent.id, isRecurring: selectedEvent.isRecurring })}>
                      Delete
                    </button>
                  </div>
                </>
              ) : (
                <div className={styles.deleteConfirm}>
                  <p className={styles.deleteConfirmMsg}>
                    {deleteConfirm.isRecurring ? 'Delete this recurring practice:' : `Delete "${selectedEvent.name}"?`}
                  </p>
                  <div className={styles.deleteConfirmBtns}>
                    {deleteConfirm.isRecurring ? (
                      <>
                        <button className={styles.btnDanger} disabled={saving} onClick={() => handleDelete(deleteConfirm.eventId, 'one')}>This only</button>
                        <button className={styles.btnDanger} disabled={saving} onClick={() => handleDelete(deleteConfirm.eventId, 'remaining')}>This &amp; future</button>
                        <button className={styles.btnDanger} disabled={saving} onClick={() => handleDelete(deleteConfirm.eventId, 'all')}>All</button>
                      </>
                    ) : (
                      <button className={styles.btnDanger} disabled={saving} onClick={() => handleDelete(deleteConfirm.eventId, 'one')}>Confirm delete</button>
                    )}
                    <button className={styles.btnGhost} onClick={() => setDeleteConfirm(null)}>Cancel</button>
                  </div>
                  {saveError && <p className={styles.errorText}>{saveError}</p>}
                </div>
              )}
            </div>

            {slideTabs.length > 1 && (
              <div className={styles.slideTabs} role="tablist">
                {slideTabs.map(t => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={activeSlideTab === t.key}
                    className={`${styles.slideTab} ${activeSlideTab === t.key ? styles.slideTabActive : ''}`}
                    onClick={() => setSlideTab(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {activeSlideTab === 'attendance' && (() => {
            const filteredRows = attendanceFilter === 'all'
              ? attendanceRows
              : attendanceRows.filter(row => row.status === attendanceFilter);
            return (
            <div className={styles.attendanceSection}>
              <div className={styles.attendanceHeader}>
                <h3 className={styles.attendanceTitle}>Attendance</h3>
                <div className={styles.attendanceBulkActions}>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    disabled={attendanceLoading || attendanceRows.length === 0}
                    onClick={() => setAllAttendance('attending')}
                  >
                    <CheckCircle2 size={14} /> All in
                  </button>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    disabled={attendanceLoading || attendanceRows.length === 0}
                    onClick={() => setAllAttendance('unknown')}
                  >
                    <CircleHelp size={14} /> Reset
                  </button>
                </div>
              </div>

              {/* Metric chips that double as filters — counts are always visible; tap to focus. */}
              {attendanceRows.length > 0 && (
                <div className={styles.attendanceFilters} role="group" aria-label="Filter attendance by status">
                  <button
                    type="button"
                    aria-pressed={attendanceFilter === 'all'}
                    className={`${styles.attFilter} ${attendanceFilter === 'all' ? styles.attFilterActiveAll : ''}`}
                    onClick={() => setAttendanceFilter('all')}
                  >
                    All <span className={styles.attFilterCount}>{attendanceRows.length}</span>
                  </button>
                  {ATTENDANCE_OPTIONS.map(option => {
                    const Icon = option.icon;
                    const count = attendanceRows.filter(row => row.status === option.value).length;
                    const active = attendanceFilter === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        data-status={option.value}
                        aria-pressed={active}
                        className={`${styles.attFilter} ${active ? styles.attFilterActive : ''}`}
                        onClick={() => setAttendanceFilter(active ? 'all' : option.value)}
                      >
                        <Icon size={13} /> {option.label} <span className={styles.attFilterCount}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {attendanceLoading ? (
                <div className={styles.attendanceEmpty}>Loading attendance...</div>
              ) : attendanceRows.length === 0 ? (
                <div className={styles.attendanceEmpty}>Add active players to the roster before marking attendance.</div>
              ) : filteredRows.length === 0 ? (
                <div className={styles.attendanceEmpty}>No players in this group.</div>
              ) : (
                <div className={styles.attendanceList}>
                  {filteredRows.map(row => {
                    const noteOpen = expandedNotes.has(row.player.id);
                    return (
                    <div key={row.player.id} className={styles.attendanceRow}>
                      <span className={styles.attendancePlayerName}>{playerDisplayName(row.player)}</span>
                      <div className={styles.attendanceStatusGroup} role="group" aria-label={`Attendance for ${playerDisplayName(row.player)}`}>
                        {ATTENDANCE_OPTIONS.map(option => {
                          const Icon = option.icon;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={row.status === option.value}
                              aria-label={option.label}
                              title={option.label}
                              className={`${styles.attendanceStatusBtn} ${row.status === option.value ? styles.attendanceStatusBtnActive : ''}`}
                              data-status={option.value}
                              onClick={() => setPlayerAttendance(row.player.id, { status: option.value })}
                            >
                              <Icon size={15} />
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        className={styles.attendanceNoteToggle}
                        data-has={row.note ? 'true' : undefined}
                        aria-label={`${noteOpen ? 'Hide' : 'Add'} note for ${playerDisplayName(row.player)}`}
                        aria-expanded={noteOpen}
                        title={row.note ? 'Edit note' : 'Add note'}
                        onClick={() => toggleNote(row.player.id)}
                      >
                        <StickyNote size={15} />
                      </button>
                      {noteOpen && (
                        <input
                          className={styles.attendanceNoteInput}
                          value={row.note}
                          onChange={e => setPlayerAttendance(row.player.id, { note: e.target.value })}
                          placeholder="Note (e.g. leaving early)"
                          aria-label={`Attendance note for ${playerDisplayName(row.player)}`}
                          maxLength={500}
                        />
                      )}
                    </div>
                    );
                  })}
                </div>
              )}

              <div className={styles.attendanceFooter}>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  disabled={!attendanceDirty || attendanceSaving || attendanceLoading}
                  onClick={handleAttendanceSave}
                >
                  <Save size={14} /> {attendanceSaving ? 'Saving...' : 'Save attendance'}
                </button>
                {attendanceDirty && <span className={styles.attendanceUnsaved}>Unsaved changes</span>}
              </div>
              {attendanceError && <p className={styles.errorText}>{attendanceError}</p>}
            </div>
            );
            })()}

            {activeSlideTab === 'lineup' && isLineupEvent(selectedEvent) && (
              <div className={styles.lineupSection}>
                <div className={styles.lineupHeader}>
                  <div>
                    <h3 className={styles.attendanceTitle}>Lineup</h3>
                    <p className={styles.attendanceSummary}>
                      {lineupMode === 'nine_player'
                        ? `${lineupRows.filter(row => row.starter).length} starters, ${lineupRows.filter(row => !row.starter).length} bench`
                        : `${lineupRows.length} hitters`}
                    </p>
                  </div>
                  <div className={styles.lineupControls}>
                    <label className={styles.lineupControlLabel}>
                      <span>Format</span>
                      <select
                        className={styles.select}
                        aria-label="Lineup format"
                        value={lineupMode}
                        onChange={e => handleLineupModeChange(e.target.value as RepLineupMode)}
                      >
                        <option value="everyone_bats">Everyone bats</option>
                        <option value="nine_player">9 player ball</option>
                      </select>
                    </label>
                    <label className={styles.lineupControlLabel}>
                      <span>Innings</span>
                      <select
                        className={styles.select}
                        aria-label="Lineup innings"
                        value={lineupInningCount}
                        onChange={e => { setLineupInningCount(Number(e.target.value)); setLineupDirty(true); }}
                      >
                        {Array.from({ length: 12 }, (_, index) => index + 1).map(count => (
                          <option key={count} value={count}>{count}</option>
                        ))}
                      </select>
                    </label>
                    <div className={styles.lineupAutoWrap}>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        disabled={lineupRows.length === 0}
                        onClick={() => setAutoFillOpen(v => !v)}
                      >
                        Auto-fill ▾
                      </button>
                      {autoFillOpen && (
                        <div className={styles.lineupAutoMenu}>
                          <label className={styles.lineupControlLabel}>
                            <span>Positions</span>
                            <select className={styles.select} value={autoPolicy} onChange={e => setAutoPolicy(e.target.value as PositionPolicy)}>
                              <option value="competitive">Competitive — best positions</option>
                              <option value="balanced">Balanced — primary + secondary</option>
                              <option value="development">Development — rotate everywhere</option>
                            </select>
                          </label>
                          <label className={styles.lineupControlLabel}>
                            <span>Fill</span>
                            <select className={styles.select} value={autoFillMode} onChange={e => setAutoFillMode(e.target.value as FillMode)}>
                              <option value="empty">Fill empty spots only</option>
                              <option value="regenerate">Regenerate all</option>
                            </select>
                          </label>
                          <p className={styles.lineupAutoNote}>
                            Even bench rotation &amp; no back-to-back sits always apply. It&apos;s a starting point — tweak after.
                          </p>
                          <button type="button" className={styles.btnPrimary} onClick={handleAutoFill}>Generate</button>
                        </div>
                      )}
                    </div>
                    <div className={styles.lineupAutoWrap}>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        disabled={lineupRows.length === 0}
                        onClick={() => { setTemplatesOpen(v => !v); setTemplateError(''); }}
                        aria-expanded={templatesOpen}
                      >
                        Templates ▾
                      </button>
                      {templatesOpen && (
                        <div className={styles.lineupAutoMenu}>
                          <div className={styles.lineupTemplateSection}>
                            <span className={styles.lineupTemplateHead}>Start from a saved template</span>
                            {templates.length === 0 ? (
                              <p className={styles.lineupAutoNote}>No saved templates yet — build a lineup, then save it below.</p>
                            ) : (
                              <ul className={styles.lineupTemplateList}>
                                {templates.map(t => (
                                  <li key={t.id} className={styles.lineupTemplateRow}>
                                    <button type="button" className={styles.lineupTemplateLoad} onClick={() => applyTemplate(t)}>
                                      <strong>{t.name}</strong>
                                      <span>{t.lineupMode === 'nine_player' ? '9 player ball' : 'Everyone bats'} · {t.inningCount} {sportPack.periodLabelPlural.toLowerCase()}</span>
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.lineupTemplateDelete}
                                      aria-label={`Delete template ${t.name}`}
                                      title="Delete template"
                                      onClick={() => handleDeleteTemplate(t)}
                                    >
                                      <X size={14} />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div className={styles.lineupTemplateSection}>
                            <span className={styles.lineupTemplateHead}>Save current lineup as a template</span>
                            <input
                              className={styles.input}
                              value={newTemplateName}
                              onChange={e => setNewTemplateName(e.target.value)}
                              placeholder="e.g. Gold medal game"
                              maxLength={80}
                              aria-label="New template name"
                            />
                            <button
                              type="button"
                              className={styles.btnPrimary}
                              disabled={!newTemplateName.trim() || templateSaving || lineupRows.length === 0}
                              onClick={handleSaveTemplate}
                            >
                              {templateSaving ? 'Saving…' : 'Save as template'}
                            </button>
                            {templateError && <p className={styles.errorText}>{templateError}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {lineupRows.length > 0 && (
                  <div className={styles.lineupInsights}>
                    {lineupNotice && <p className={styles.lineupNotice}>{lineupNotice}</p>}
                    <p className={styles.lineupHint}>
                      Batting order follows your{' '}
                      <Link href={`/${orgSlug}/coaches/teams/${teamId}/roster`}>roster order</Link>
                      {' '}— drag to reorder there.
                    </p>
                    {lineupAnalysis.hasConflicts && (
                      <p className={styles.lineupWarn}>
                        ⚠ Position clash: {lineupAnalysis.conflicts.map(c => `two at ${c.position} in inning ${c.inning}`).join(' · ')}
                      </p>
                    )}
                    {lineupAnalysis.benchSpread && (lineupAnalysis.benchSpread.max - lineupAnalysis.benchSpread.min) > 1 && (
                      <p className={styles.lineupWarn}>
                        ⚠ Uneven bench time — players sit between {lineupAnalysis.benchSpread.min} and {lineupAnalysis.benchSpread.max} innings.
                      </p>
                    )}
                  </div>
                )}

                {lineupLoading ? (
                  <div className={styles.attendanceEmpty}>Loading lineup...</div>
                ) : lineupRows.length === 0 ? (
                  <div className={styles.attendanceEmpty}>Add active players to the roster before creating a lineup.</div>
                ) : (
                  <DndContext sensors={lineupSensors} collisionDetection={closestCenter} onDragEnd={handleLineupDragEnd}>
                    <div className={styles.lineupTableWrap}>
                      <table className={styles.lineupTable}>
                        <thead>
                          <tr>
                            <th>Bat</th>
                            {lineupMode === 'nine_player' && <th>Start</th>}
                            <th>Player</th>
                            {Array.from({ length: lineupInningCount }, (_, index) => {
                              const inning = index + 1;
                              const clash = lineupAnalysis.conflictInnings.has(inning);
                              return (
                                <th key={inning} style={clash ? { color: 'var(--danger)' } : undefined} title={clash ? 'Two players share a position this inning' : undefined}>
                                  {inning}{clash ? ' ⚠' : ''}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          <SortableContext items={lineupRows.map(r => r.player.id)} strategy={verticalListSortingStrategy}>
                            {lineupRows.map(row => (
                              <SortableLineupRow
                                key={row.player.id}
                                row={row}
                                battingNumber={row.battingOrder}
                                mode={lineupMode}
                                inningCount={lineupInningCount}
                                onStarterToggle={handleLineupStarterToggle}
                                onPositionChange={updateLineupPosition}
                              />
                            ))}
                          </SortableContext>
                        </tbody>
                      </table>
                    </div>
                  </DndContext>
                )}

                <textarea
                  className={styles.textarea}
                  rows={2}
                  value={lineupNotes}
                  onChange={e => { setLineupNotes(e.target.value); setLineupDirty(true); }}
                  placeholder="Lineup notes (opponent scouting, reminders) — can be printed on the dugout poster"
                  maxLength={1000}
                />

                {lineupRows.length > 0 && (
                  <div className={styles.lineupSummary}>
                    <button type="button" className={styles.lineupSummaryToggle} onClick={() => setSummaryOpen(v => !v)} aria-expanded={summaryOpen}>
                      {summaryOpen ? '▾' : '▸'} Playing-time summary
                    </button>
                    {summaryOpen && (
                      <div className={styles.lineupSummaryBody}>
                        {/* Shared team fairness verdict */}
                        <div className={styles.lineupFairness}>
                          Bench: {benchMin === benchMax ? `${benchMin}` : `${benchMin}–${benchMax}`} {benchMax === 1 ? 'inning' : 'innings'} each
                          <span className={`${styles.lineupFairPill} ${benchMax - benchMin > 1 ? styles.lineupFairPillWarn : ''}`}>
                            {benchMax - benchMin > 1 ? 'Uneven' : 'Balanced'}
                          </span>
                        </div>

                        {/* Desktop: heat grid */}
                        <div className={styles.lineupSummaryDesktop}>
                          <div className={styles.lineupSummaryWrap}>
                            <table className={styles.lineupSummaryTable}>
                              <thead>
                                <tr>
                                  <th>Player</th>
                                  <th title="Innings on the field vs benched">On field</th>
                                  {summaryPositions.map(pos => <th key={pos}>{pos}</th>)}
                                </tr>
                              </thead>
                              <tbody>
                                {lineupRows.map(row => {
                                  const fp = fairPlayByPlayer.get(row.player.id);
                                  return (
                                    <tr key={row.player.id}>
                                      <td className={styles.lineupSummaryName}>{playerDisplayName(row.player)}</td>
                                      <td>{onFieldGauge(fp)}</td>
                                      {summaryPositions.map(pos => {
                                        const n = fp?.positionCounts[pos] ?? 0;
                                        return <td key={pos} className={styles.lineupHeatCell} style={heatStyle(n)}>{n || <span className={styles.lineupZero}>·</span>}</td>;
                                      })}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Mobile: per-player chips */}
                        <div className={styles.lineupSummaryMobile}>
                          {lineupRows.map(row => {
                            const fp = fairPlayByPlayer.get(row.player.id);
                            const played = summaryPositions.filter(pos => (fp?.positionCounts[pos] ?? 0) > 0);
                            return (
                              <div key={row.player.id} className={styles.lineupChipRow}>
                                <span className={styles.lineupChipName}>{playerDisplayName(row.player)}</span>
                                {onFieldGauge(fp)}
                                <span className={styles.lineupChips}>
                                  {played.map(pos => (
                                    <span key={pos} className={styles.lineupChip} style={heatStyle(fp!.positionCounts[pos])}>{pos}×{fp!.positionCounts[pos]}</span>
                                  ))}
                                  {played.length === 0 && <span className={styles.lineupZero}>—</span>}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.attendanceFooter}>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    disabled={!lineupDirty || lineupSaving || lineupLoading || lineupRows.length === 0}
                    onClick={handleLineupSave}
                  >
                    <Save size={14} /> {lineupSaving ? 'Saving...' : 'Save lineup'}
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    disabled={lineupRows.length === 0}
                    onClick={clearLineup}
                  >
                    Clear
                  </button>
                  <div className={styles.lineupPdfWrap}>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      disabled={lineupRows.length === 0}
                      onClick={() => setLineupPdfOpen(v => !v)}
                      aria-expanded={lineupPdfOpen}
                    >
                      Print ▾
                    </button>
                    {lineupPdfOpen && (
                      <div className={styles.lineupPdfMenu}>
                        <button type="button" className={styles.lineupPdfItem} onClick={handleLineupPoster}>
                          <strong>Dugout poster</strong>
                          <span>Positions by {sportPack.periodLabel.toLowerCase()} — blank boxes to pen in at the field</span>
                        </button>
                        <button type="button" className={styles.lineupPdfItem} onClick={handleBattingCard}>
                          <strong>Batting order card</strong>
                          <span>Large-type order for the scorekeeper or dugout</span>
                        </button>
                        {lineupNotes.trim() && (
                          <label className={styles.lineupPdfNotesToggle}>
                            <input
                              type="checkbox"
                              checked={pdfIncludeNotes}
                              onChange={e => setPdfIncludeNotes(e.target.checked)}
                            />
                            <span>Print lineup notes on the poster</span>
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                  {lineupDirty && <span className={styles.attendanceUnsaved}>Unsaved changes</span>}
                </div>
                {lineupError && <p className={styles.errorText}>{lineupError}</p>}
              </div>
            )}

            {/* Result */}
            {activeSlideTab === 'result' && (selectedEvent.eventType === 'league_game' || selectedEvent.eventType === 'tournament_game' || selectedEvent.eventType === 'scrimmage') && (
              <div className={styles.scoreSection}>
                {selectedEvent.teamScore != null ? (
                  <div className={styles.scoreDisplay}>
                    <span className={styles.scoreNum} style={{ color: '#22c55e' }}>{selectedEvent.teamScore}</span>
                    <span className={styles.scoreSep}>–</span>
                    <span className={styles.scoreNum} style={{ color: '#ef4444' }}>{selectedEvent.opponentScore}</span>
                    {selectedEvent.result && (
                      <span className={styles.resultBadge} style={{
                        color: selectedEvent.result === 'win' ? '#22c55e' : selectedEvent.result === 'loss' ? '#ef4444' : '#f59e0b',
                      }}>
                        {selectedEvent.result.toUpperCase()}
                      </span>
                    )}
                    <button className={styles.btnGhost} onClick={() => setScoreForm({ teamScore: String(selectedEvent.teamScore ?? ''), opponentScore: String(selectedEvent.opponentScore ?? ''), result: selectedEvent.result ?? '' })}>
                      Edit score
                    </button>
                  </div>
                ) : (
                  <button className={styles.btnSecondary} onClick={() => setScoreForm({ teamScore: '', opponentScore: '', result: '' })}>
                    Enter score
                  </button>
                )}
                {scoreForm && (
                  <div className={styles.scoreForm}>
                    <div className={styles.scoreFormRow}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.72rem', color: 'var(--white-45)' }}>
                        Your team
                        <input className={styles.input} style={{ width: '5rem' }} type="number" min={0} value={scoreForm.teamScore} onChange={e => setScoreForm(s => s && ({ ...s, teamScore: e.target.value }))} />
                      </label>
                      <span style={{ alignSelf: 'flex-end', paddingBottom: '0.5rem' }}>–</span>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.72rem', color: 'var(--white-45)' }}>
                        Opponent
                        <input className={styles.input} style={{ width: '5rem' }} type="number" min={0} value={scoreForm.opponentScore} onChange={e => setScoreForm(s => s && ({ ...s, opponentScore: e.target.value }))} />
                      </label>
                      <select className={styles.select} style={{ width: '8rem', alignSelf: 'flex-end' }} value={scoreForm.result} onChange={e => setScoreForm(s => s && ({ ...s, result: e.target.value }))}>
                        <option value="">Auto</option>
                        <option value="win">Win</option>
                        <option value="loss">Loss</option>
                        <option value="tie">Tie</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className={styles.btnPrimary} disabled={saving || scoreForm.teamScore.trim() === '' || scoreForm.opponentScore.trim() === ''} onClick={handleScoreSave}>Save</button>
                      <button className={styles.btnGhost} onClick={() => setScoreForm(null)}>Cancel</button>
                    </div>
                    {saveError && <p className={styles.errorText}>{saveError}</p>}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Warn before leaving with unsaved event / attendance / lineup edits */}
      <UnsavedChangesGuard active={formDirty || attendanceDirty || lineupDirty} />

      {/* ── Add / edit event modal ─────────────────────────────────────────── */}
      {showAddForm && (
        <div className={styles.modalOverlay} onClick={requestCloseForm}>
          <div className={`${styles.modal} ${styles.eventFormModal}`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{editingEventId ? 'Edit' : 'Add'} {EVENT_LABELS[form.eventType]}</h3>
              <button className={styles.modalCloseBtn} onClick={requestCloseForm}><X size={16} /></button>
            </div>

            <div className={styles.formBody}>
              {/* Type — changeable on add (keeps shared fields); fixed once an event exists. */}
              {!editingEventId && (
                <div className={styles.field}>
                  <label className={styles.label}>Event type</label>
                  <select className={styles.select} value={form.eventType} onChange={e => changeEventType(e.target.value as RepEventType)}>
                    {(Object.keys(EVENT_LABELS) as RepEventType[]).map(t => (
                      <option key={t} value={t}>{EVENT_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Name — headline; auto-fills from the opponent for games. */}
              <div className={styles.field}>
                <label className={styles.label}>Name</label>
                <input
                  className={styles.input}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={needsOpponent(form.eventType) ? `${EVENT_NAME_PREFIX[form.eventType]} vs opponent` : `${EVENT_NAME_PREFIX[form.eventType]} name`}
                />
                {needsOpponent(form.eventType) && (
                  <p className={styles.formHint}>Leave blank to name it from the opponent (e.g. &ldquo;Scrimmage vs Lady Jays&rdquo;).</p>
                )}
              </div>

              {/* TOURNAMENT — a tournament game must belong to a tournament, so a coach can't
                  create an orphaned, parent-less game slot. */}
              {addingTournamentGame && (
                <section className={styles.formSection}>
                  <h4 className={styles.formSectionTitle}>Tournament</h4>
                  {tournamentOptions.length === 0 ? (
                    <div className={styles.field}>
                      <p className={styles.formHint}>
                        A tournament game belongs to a tournament, and you haven&apos;t added one yet.
                      </p>
                      <button type="button" className={styles.btnSecondary} onClick={() => changeEventType('external_tournament')}>
                        Create a tournament first
                      </button>
                    </div>
                  ) : (
                    <div className={styles.field}>
                      <label className={styles.label}>Which tournament?</label>
                      <select className={styles.select} value={form.parentEventId} onChange={e => selectParentTournament(e.target.value)}>
                        <option value="">Select a tournament…</option>
                        {tournamentOptions.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name}{t.startsAt ? ` (${shortDate(dayStr(t.startsAt))})` : ''}
                          </option>
                        ))}
                      </select>
                      <p className={styles.formHint}>The game shows under this tournament&apos;s days — never as a loose slot.</p>
                    </div>
                  )}
                </section>
              )}

              {/* Editing an existing tournament game: show which tournament it belongs to. */}
              {form.eventType === 'tournament_game' && editingEventId && (
                <section className={styles.formSection}>
                  <h4 className={styles.formSectionTitle}>Tournament</h4>
                  <p className={styles.formHint}>
                    Part of {events.find(e => e.id === form.parentEventId)?.name ?? 'a tournament'}.
                  </p>
                </section>
              )}

              {/* WHEN */}
              <section className={styles.formSection}>
                <h4 className={styles.formSectionTitle}>When</h4>
                {needsRecurrence(form.eventType) && !editingEventId && (
                  <label className={styles.formCheck}>
                    <input type="checkbox" checked={form.isRecurring} onChange={e => setForm(f => ({ ...f, isRecurring: e.target.checked }))} />
                    <span>Repeat weekly</span>
                  </label>
                )}
                {form.eventType === 'external_tournament' ? (
                  <>
                    <div className={styles.field}>
                      <label className={styles.label}>Start date</label>
                      <input className={styles.input} type="date" value={form.startsAt.slice(0, 10)} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value ? `${e.target.value}T00:00` : '' }))} />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>End date</label>
                      <input className={styles.input} type="date" value={form.endsAt.slice(0, 10)} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value ? `${e.target.value}T00:00` : '' }))} />
                    </div>
                  </>
                ) : recurringSeries ? (
                  <>
                    <div className={styles.formSectionGrid}>
                      <div className={styles.field}>
                        <label className={styles.label}>Day of week</label>
                        <select className={styles.select} value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: e.target.value }))}>
                          {DAYS_OF_WEEK.map((d, i) => <option key={i} value={i}>{d}</option>)}
                        </select>
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Start time</label>
                        <input className={styles.input} type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>End time</label>
                        <input className={styles.input} type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Arrival time <span className={styles.labelOptional}>optional</span></label>
                        <input className={styles.input} type="time" value={form.arrivalTime} onChange={e => setForm(f => ({ ...f, arrivalTime: e.target.value }))} />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>First date</label>
                        <input className={styles.input} type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Last date</label>
                        <input className={styles.input} type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                      </div>
                    </div>
                    {recurrencePreview && <p className={styles.formHint}>{recurrencePreview}</p>}
                  </>
                ) : (
                  <>
                    <div className={styles.field}>
                      <label className={styles.label}>Starts</label>
                      <input className={styles.input} type="datetime-local" value={form.startsAt} onChange={e => setStartsAt(e.target.value)} />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Ends</label>
                      <input className={styles.input} type="datetime-local" value={form.endsAt} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))} />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Arrival / call time <span className={styles.labelOptional}>optional</span></label>
                      <input className={styles.input} type="time" value={form.arrivalTime} onChange={e => setForm(f => ({ ...f, arrivalTime: e.target.value }))} />
                      <p className={styles.formHint}>A &ldquo;be there by&rdquo; time before the start — shows on the event and the calendar export.</p>
                    </div>
                  </>
                )}
              </section>

              {/* WHERE — place NAME + field/diamond # side by side, an optional street ADDRESS
                  (powers the map link) below, and tap-to-fill "recent" chips that refill both. */}
              <section className={styles.formSection}>
                <h4 className={styles.formSectionTitle}>Where</h4>
                <div className={styles.formSectionGrid}>
                  <div className={styles.field}>
                    <label className={styles.label}>Location</label>
                    <input
                      className={styles.input}
                      value={form.location}
                      onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                      placeholder="e.g. Sherwood Park"
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Field / Diamond # <span className={styles.labelOptional}>optional</span></label>
                    <input
                      className={styles.input}
                      value={form.fieldNumber}
                      onChange={e => setForm(f => ({ ...f, fieldNumber: e.target.value }))}
                      placeholder="e.g. Diamond 2"
                    />
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Address <span className={styles.labelOptional}>optional</span></label>
                  <input
                    className={styles.input}
                    value={form.locationAddress}
                    onChange={e => setForm(f => ({ ...f, locationAddress: e.target.value }))}
                    placeholder="Street address — powers the “open in Maps” link"
                  />
                </div>
                {recentLocations.length > 0 && (
                  <div className={styles.locationChips}>
                    <span className={styles.locationChipsLabel}>Recent:</span>
                    {recentLocations.slice(0, 6).map(loc => (
                      <button
                        key={loc.name}
                        type="button"
                        className={`${styles.locationChip} ${form.location.trim().toLowerCase() === loc.name.toLowerCase() ? styles.locationChipActive : ''}`}
                        onClick={() => setForm(f => ({ ...f, location: loc.name, locationAddress: loc.address }))}
                        title={loc.address || undefined}
                      >
                        {loc.name}
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {/* WHO — games only */}
              {needsOpponent(form.eventType) && (
                <section className={styles.formSection}>
                  <h4 className={styles.formSectionTitle}>Who</h4>
                  <div className={styles.field}>
                    <label className={styles.label}>Opponent</label>
                    <input className={styles.input} value={form.opponent} onChange={e => setForm(f => ({ ...f, opponent: e.target.value }))} placeholder="Team name" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Home / Away</label>
                    <div className={styles.segChoice} role="group" aria-label="Home or away">
                      {HOME_AWAY_CHOICES.map(c => (
                        <button
                          key={c.value}
                          type="button"
                          className={`${styles.segBtn} ${form.homeAway === c.value ? styles.segBtnActive : ''}`}
                          onClick={() => setForm(f => ({ ...f, homeAway: c.value }))}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                    <p className={styles.formHint}>Sets your dugout printout (&ldquo;@&rdquo; vs &ldquo;vs&rdquo;) and which side your win/loss counts on.</p>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Uniform <span className={styles.labelOptional}>optional</span></label>
                    <input
                      className={styles.input}
                      value={form.uniform}
                      onChange={e => setForm(f => ({ ...f, uniform: e.target.value }))}
                      placeholder="e.g. Home whites"
                    />
                  </div>
                </section>
              )}

              {/* LINKS / RESOURCES — labelled URLs (drill video, rules, field map, flyer). */}
              <section className={styles.formSection}>
                <h4 className={styles.formSectionTitle}>Links <span className={styles.labelOptional}>optional</span></h4>
                {form.resources.length === 0 && (
                  <p className={styles.formHint}>Attach labelled links — a drill video, rules page, field map, or doc. They open in a new tab.</p>
                )}
                {form.resources.map((r, i) => {
                  const hint = resourceHint(form.eventType);
                  const badUrl = r.url.trim() !== '' && !isValidResourceUrl(r.url);
                  return (
                    <div key={i} className={styles.resourceRow}>
                      <input
                        className={styles.input}
                        value={r.label}
                        onChange={e => updateResource(i, { label: e.target.value })}
                        placeholder={hint.label}
                        maxLength={120}
                        aria-label="Link label"
                      />
                      <input
                        className={styles.input}
                        style={badUrl ? { borderColor: 'var(--danger)' } : undefined}
                        value={r.url}
                        onChange={e => updateResource(i, { url: e.target.value })}
                        placeholder={hint.url}
                        inputMode="url"
                        aria-label="Link URL"
                      />
                      <button type="button" className={styles.resourceRemove} onClick={() => removeResource(i)} aria-label="Remove link">
                        <X size={15} />
                      </button>
                    </div>
                  );
                })}
                {resourcesInvalid && <p className={styles.errorText}>Each link needs a label and a valid web address (http/https).</p>}
                {form.resources.length < MAX_EVENT_RESOURCES ? (
                  <button type="button" className={styles.btnSecondary} onClick={addResource}>+ Add link</button>
                ) : (
                  <p className={styles.formHint}>Up to {MAX_EVENT_RESOURCES} links per event.</p>
                )}
              </section>

              {/* NOTES */}
              <div className={styles.field}>
                <label className={styles.label}>Notes</label>
                <textarea className={styles.textarea} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Anything the team should know" />
              </div>
            </div>

            {saveError && <p className={styles.errorText} style={{ marginTop: '0.75rem' }}>{saveError}</p>}

            {/* Editing one occurrence of a repeating series → choose how far the change reaches. */}
            {editScopeOpen ? (
              <div className={styles.editScope}>
                <p className={styles.editScopeMsg}>Apply your changes to:</p>
                <div className={styles.editScopeBtns}>
                  <button className={styles.btnSecondary} disabled={saving} onClick={() => handleUpdate('one')}>This event only</button>
                  <button className={styles.btnSecondary} disabled={saving} onClick={() => handleUpdate('remaining')}>This &amp; future</button>
                  <button className={styles.btnSecondary} disabled={saving} onClick={() => handleUpdate('all')}>All events</button>
                  <button className={styles.btnGhost} disabled={saving} onClick={() => setEditScopeOpen(false)}>Back</button>
                </div>
                <p className={styles.formHint}>Repeating series — &ldquo;This &amp; future&rdquo; and &ldquo;All&rdquo; keep each event&apos;s own date and shift the rest.</p>
                {saveError && <p className={styles.errorText}>{saveError}</p>}
              </div>
            ) : (
              <div className={styles.modalFooter}>
                <button className={styles.btnGhost} onClick={requestCloseForm}>Cancel</button>
                <button
                  className={styles.btnPrimary}
                  disabled={saving || !formHasStart || tournamentParentMissing || resourcesInvalid}
                  onClick={editingEventId && editingRecurring ? () => setEditScopeOpen(true) : handleSave}
                >
                  {saving ? 'Saving…' : editingEventId ? 'Save changes' : 'Save'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
