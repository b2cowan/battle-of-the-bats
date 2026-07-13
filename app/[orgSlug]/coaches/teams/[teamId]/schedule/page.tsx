'use client';
import { use, useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Calendar, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, CircleSlash, Clock3, Plus, X, Trophy, Swords, Shield, Dumbbell, Users, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useCoaches } from '@/lib/coaches-context';
import { useOrg } from '@/lib/org-context';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import UnsavedChangesGuard from '@/components/coaches/UnsavedChangesGuard';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import {
  downloadXLSX, generateCSV, downloadCSVBlob, downloadICS,
  buildFilename, serializeRows, serializeHeaders,
  type ExportColumnDef, type ICSEventInput,
} from '@/lib/export';
import ExportMenu from '@/components/admin/ExportMenu';
import { MapPin, Check, Video, FileText, Link2, ExternalLink, StickyNote, ClipboardList } from 'lucide-react';
import { isValidResourceUrl, MAX_EVENT_RESOURCES } from '@/lib/rep-event-resources';
import { playerDisplayName } from '@/lib/coach-roster-name';
import TagManagerModal from '@/components/coaches/TagManagerModal';
import GiveAwardModal from '@/components/coaches/GiveAwardModal';
import styles from '../../../coaches.module.css';
import type {
  RepAttendanceStatus,
  RepLineupMode,
  RepRosterPlayer,
  RepTeamEvent,
  RepTeamEventAttendance,
  RepTryoutSession,
  RepTeamLineup,
  RepTeamLineupEntry,
  RepProgramYear,
  RepEventType,
  RepEventResource,
  RepTeamTag,
  RepTeamAwardType,
  RepPlayerAward,
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

// Quick status → {label, icon} lookup for the per-player status badge.
const ATTENDANCE_BY_VALUE = Object.fromEntries(
  ATTENDANCE_OPTIONS.map(o => [o.value, o]),
) as Record<RepAttendanceStatus, (typeof ATTENDANCE_OPTIONS)[number]>;

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
  tagIds: string[];
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
  tagIds: [],
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


// A tryout session projected onto the calendar — read-only, visually distinct from a game (dashed,
// clipboard, "Tryout" label), links to the Tryouts tab rather than opening the event editor.
function TryoutChip({ session, href }: { session: RepTryoutSession; href: string }) {
  const start = new Date(session.startsAt.slice(0, 19)); // wall-clock, no TZ shift
  const time = isNaN(start.getTime()) ? '' : start.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
  const place = [session.label, session.location, session.fieldNumber && `Field ${session.fieldNumber}`].filter(Boolean).join(' · ');
  return (
    <Link href={href} className={`${styles.eventChip} ${styles.tryoutChip}`} title="Tryout — opens your Tryouts tab">
      <span className={styles.eventChipTime}>{time}</span>
      <span className={styles.eventChipName}>
        <ClipboardList size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} aria-hidden />
        Tryout{place ? <span className={styles.eventChipOpp}> · {place}</span> : null}
      </span>
    </Link>
  );
}

function EventChip({ event, onClick, dayKey, mismatch, awardCount }: { event: RepTeamEvent; onClick: () => void; dayKey?: string; mismatch?: boolean; awardCount?: number }) {
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
        {mismatch && !cancelled && (
          <TriangleAlert size={12} style={{ color: '#f59e0b', flexShrink: 0 }} aria-label="Lineup and attendance don't match" />
        )}
        {cancelled ? (
          <span className={styles.eventChipResult} style={{ color: '#f59e0b' }}>CANCELLED</span>
        ) : (
          <>
            {!!awardCount && (
              <span className={styles.eventChipResult} title={`${awardCount} award${awardCount === 1 ? '' : 's'} given`} style={{ color: 'var(--logic-lime)' }}>
                🏆 {awardCount}
              </span>
            )}
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CoachesSchedulePage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  const { assignments, loading: ctxLoading } = useCoaches();
  const { currentOrg } = useOrg();
  // Sport vocabulary (period word, position legend, field positions the auto-fill assigns)
  // routes through this team's Sport Pack. Falls back to the default sport until the coaching
  // assignment loads (both offered sports today are diamond, so the fallback is harmless).
  const sportPack = getSportPack(assignments.find(a => a.teamId === teamId)?.teamSport ?? DEFAULT_SPORT);

  const [events, setEvents] = useState<RepTeamEvent[]>([]);
  // Deep-link: /schedule?event=<id>&tab=lineup opens that game straight into its builder (the
  // Lineups front door and the Overview "Build lineup" button link here). One-shot per mount.
  const deepLinkHandledRef = useRef(false);
  const [tryoutSessions, setTryoutSessions] = useState<RepTryoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [view, setView] = useState<ViewMode>('list');
  const [cursorDate, setCursorDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [selectedEvent, setSelectedEvent] = useState<RepTeamEvent | null>(null);
  // Mobile month view: a tapped day with >1 event opens this bottom-sheet day list (a single
  // event opens its detail directly). Desktop keeps the in-cell text chips, so this stays null.
  const [daySheet, setDaySheet] = useState<{ dateKey: string; events: RepTeamEvent[] } | null>(null);
  const [slideTab, setSlideTab] = useState<'attendance' | 'lineup'>('attendance');
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
  // Which player's RSVP editor is open (one at a time). null = all collapsed.
  const [rsvpEditId, setRsvpEditId] = useState<string | null>(null);
  // The schedule shows a READ-ONLY lineup peek (the editable builder lives on the Lineups page).
  // These hold the loaded lineup just for that preview.
  const [lineupMode, setLineupMode] = useState<RepLineupMode>('everyone_bats');
  const [lineupInningCount, setLineupInningCount] = useState(sportPack.defaultPeriodCount);
  const [lineupRows, setLineupRows] = useState<LineupPlayerRow[]>([]);
  // Player ids that are actually in the SAVED lineup — used to flag attendance ↔ lineup drift.
  const [lineupEntryIds, setLineupEntryIds] = useState<Set<string>>(new Set());
  // Game event ids whose saved lineup disagrees with attendance (server-computed) — badges the list.
  const [mismatchIds, setMismatchIds] = useState<Set<string>>(new Set());
  const [lineupLoading, setLineupLoading] = useState(false);
  // Coach Tags (Phase 1, game tags only): the team's tag library + which tags each event already
  // carries, both returned alongside the events fetch (no per-event round trip).
  const [teamTags, setTeamTags] = useState<RepTeamTag[]>([]);
  const [tagsByEventId, setTagsByEventId] = useState<Record<string, string[]>>({});
  const [tagInput, setTagInput] = useState('');
  const [tagCreating, setTagCreating] = useState(false);
  const [tagError, setTagError] = useState('');
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  // Player Awards (Phase 2): the team's award-type library, every award given this season
  // (filtered client-side per event for the slide-over), a minimal PII-free player list for the
  // give-award picker, and per-event counts for the schedule list's trophy badge.
  const [awardTypes, setAwardTypes] = useState<RepTeamAwardType[]>([]);
  const [teamAwards, setTeamAwards] = useState<RepPlayerAward[]>([]);
  const [awardPlayers, setAwardPlayers] = useState<{ id: string; name: string; number: string | null }[]>([]);
  const [awardCountByEventId, setAwardCountByEventId] = useState<Record<string, number>>({});
  const [giveAwardOpen, setGiveAwardOpen] = useState(false);
  const confirm = useConfirm();

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
      setMismatchIds(new Set<string>(data.lineupMismatchEventIds ?? []));
      setTeamTags(data.tags ?? []);
      setTagsByEventId(data.tagsByEventId ?? {});
      setAwardCountByEventId(data.awardCountByEventId ?? {});
      // Tryout sessions are projected onto the calendar as read-only markers. Non-fatal: if this
      // fails the schedule still works, tryout dates just won't show.
      try {
        const tRes = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/tryout-sessions`);
        if (tRes.ok) { const tData = await tRes.json(); setTryoutSessions(tData.sessions ?? []); }
      } catch { /* ignore — tryout markers are optional */ }
    } catch (e: unknown) {
      setError(errorMessage(e, 'Failed to load events'));
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId]);

  // Player Awards data — separate from fetchEvents (own endpoints), but loaded alongside it so
  // the give-award picker and the slide-over's "Awards given" section are ready without a
  // second round trip when a coach opens a game.
  const fetchAwardData = useCallback(async () => {
    try {
      const [typesRes, awardsRes] = await Promise.all([
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/award-types`),
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/awards`),
      ]);
      if (typesRes.ok) setAwardTypes((await typesRes.json()).awardTypes ?? []);
      if (awardsRes.ok) {
        const awardsData = await awardsRes.json();
        setTeamAwards(awardsData.awards ?? []);
        setAwardPlayers(awardsData.players ?? []);
      }
    } catch { /* non-fatal — the schedule still works without award data */ }
  }, [orgSlug, teamId]);

  useEffect(() => {
    void Promise.resolve().then(fetchEvents);
    void Promise.resolve().then(fetchAwardData);
  }, [fetchEvents, fetchAwardData]);

  // Tag ids on the open form that still exist in the library — recomputed on every render (not
  // synced into state) so a Tag Manager delete/merge while the form is open can never leave a
  // selected chip silently pointing at a vanished tag, without a setState-in-effect anti-pattern.
  const validFormTagIds = form.tagIds.filter(id => teamTags.some(t => t.id === id));

  // Open a deep-linked event once events have loaded (client-only param read — no Suspense needed).
  // Runs once; the coach can freely close or switch events afterwards.
  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    if (loading || events.length === 0) return;
    deepLinkHandledRef.current = true;
    try {
      const sp = new URLSearchParams(window.location.search);
      const eventId = sp.get('event');
      if (!eventId) return;
      const ev = events.find(e => e.id === eventId);
      if (!ev) return;
      openEvent(ev);
      if (sp.get('tab') === 'lineup') setSlideTab('lineup');
    } catch { /* ignore malformed params */ }
  }, [loading, events]);

  // Lock background scroll while a full-screen modal (detail or add/edit) is open on
  // mobile, so only the modal scrolls.
  const anyModalOpen = !!selectedEvent || showAddForm || !!daySheet;
  useEffect(() => {
    if (!anyModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [anyModalOpen]);

  const attendanceSig = () => JSON.stringify(attendanceRows.map(r => [r.player.id, r.status, r.note]));
  const attendanceSigRef = useRef('');
  useEffect(() => { attendanceSigRef.current = attendanceSig(); }, [attendanceRows]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save attendance ~0.7s after the last change (a status tap is meant to stick).
  useEffect(() => {
    if (!attendanceDirty || attendanceSaving || !selectedEvent || attendanceLoading || attendanceRows.length === 0) return;
    const t = setTimeout(() => { void handleAttendanceSave(); }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceDirty, attendanceSaving, attendanceRows]);

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
      setAttendanceDirty(false);
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
          programYear?: RepProgramYear | null;
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
          // Players marked Out (absent) are left out of the lineup; they appear under "Not playing".
          const absentIds = new Set((data.attendance ?? []).filter(a => a.status === 'absent').map(a => a.playerId));
          const playingPlayers = players.filter(p => !absentIds.has(p.id));
          setLineupMode(mode);
          setLineupInningCount(data.lineup?.inningCount ?? sportPack.defaultPeriodCount);
          setLineupRows(renumberBattingOrder(sortLineupRows(buildLineupRows(playingPlayers, data.entries ?? [], mode)), mode));
          setLineupEntryIds(new Set((data.entries ?? []).map(e => e.playerId)));
        } else {
          setLineupRows([]);
          setLineupEntryIds(new Set());
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
      if (!needsOpponent(next)) { out.opponent = ''; out.homeAway = ''; out.uniform = ''; out.tagIds = []; }
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

  // ── Game tags (autocomplete-or-create) ───────────────────────────────────────

  function toggleFormTag(tagId: string) {
    setForm(f => ({
      ...f,
      tagIds: f.tagIds.includes(tagId) ? f.tagIds.filter(id => id !== tagId) : [...f.tagIds, tagId],
    }));
  }

  async function createAndApplyTag(name: string) {
    setTagError('');
    setTagCreating(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Could not create tag');
      }
      const { tag } = await res.json();
      setTeamTags(t => [...t, tag]);
      setForm(f => ({ ...f, tagIds: [...f.tagIds, tag.id] }));
      setTagInput('');
    } catch (e: unknown) {
      setTagError(errorMessage(e, 'Could not create tag'));
    } finally {
      setTagCreating(false);
    }
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
    const f = { ...eventToForm(event), tagIds: tagsByEventId[event.id] ?? [] };
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
  const slideTabs: { key: 'attendance' | 'lineup'; label: string }[] = [{ key: 'attendance', label: 'Attendance' }];
  if (isLineupEvent(selectedEvent)) slideTabs.push({ key: 'lineup', label: 'Lineup' });
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

  // Attendance ↔ lineup mismatch for the open game (top-section warning). Only when a lineup exists.
  const lineupMismatch = (() => {
    if (!selectedEvent || !isLineupEvent(selectedEvent) || lineupEntryIds.size === 0) return null;
    const coming = attendanceRows
      .filter(r => (r.status === 'attending' || r.status === 'late') && !lineupEntryIds.has(r.player.id))
      .map(r => playerDisplayName(r.player));
    const out = attendanceRows
      .filter(r => r.status === 'absent' && lineupEntryIds.has(r.player.id))
      .map(r => playerDisplayName(r.player));
    return coming.length > 0 || out.length > 0 ? { coming, out } : null;
  })();













  function openEvent(event: RepTeamEvent) {
    setSlideTab('attendance');
    setAttendanceFilter('all');
    setRsvpEditId(null);
    setDaySheet(null);
    setSelectedEvent(event);
    // Defensive: a stale true here would pop GiveAwardModal back open on the newly-opened
    // event, uninvited (not reachable via normal clicks today since the modal blocks
    // interaction with the slide-over underneath it, but cheap to guard against directly).
    setGiveAwardOpen(false);
  }

  // "+N more" in a month cell (and any future day tap): a single event opens its detail
  // straight away; several open a day list (bottom-sheet) so the coach can pick one.
  function openDay(dateKey: string, dayEvents: RepTeamEvent[]) {
    if (dayEvents.length === 0) return;
    if (dayEvents.length === 1) { openEvent(dayEvents[0]); return; }
    setDaySheet({ dateKey, events: dayEvents });
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
          tagIds: needsOpponent(form.eventType) ? validFormTagIds : undefined,
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
      // Tags apply to a specific one-off game only — never sent on a recurring series create
      // (a coach tags an occurrence later, from its own edit form).
      if (needsOpponent(form.eventType) && !(needsRecurrence(form.eventType) && form.isRecurring)) {
        body.tagIds = validFormTagIds;
      }

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

  const [scoreForm, setScoreForm] = useState<{ teamScore: string; opponentScore: string } | null>(null);

  function closeSelectedEvent() {
    setSelectedEvent(null);
    setScoreForm(null);
    setSaveError('');
    setLineupRows([]);
    setLineupEntryIds(new Set());
    setGiveAwardOpen(false);
  }

  // Auto-save means closing should FLUSH any pending edits, not prompt to discard. Only if a
  // flush genuinely fails do we ask before closing (so the coach doesn't lose work silently).
  async function requestCloseSlideOver() {
    let ok = true;
    if (attendanceDirty) ok = (await handleAttendanceSave()) && ok;
    if (!ok && !(await confirm({
      title: 'Changes not saved',
      message: 'We couldn’t save your latest changes. Close anyway and discard them?',
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
          // Result is always derived from the score — no manual override. A stored W/L/T that
          // contradicts the numbers would silently corrupt the Season Record.
          result: ts > os ? 'win' : ts < os ? 'loss' : 'tie',
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

  async function handleAttendanceSave(): Promise<boolean> {
    if (!selectedEvent) return true;
    const sigAtSave = attendanceSig();
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
      if (attendanceSigRef.current === sigAtSave) setAttendanceDirty(false);
      return true;
    } catch (e: unknown) {
      setAttendanceError(errorMessage(e, 'Attendance save failed'));
      return false;
    } finally {
      setAttendanceSaving(false);
    }
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
    if (!events.length && !tryoutSessions.length) {
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
    const tryByMonth: Record<string, RepTryoutSession[]> = {};
    for (const s of tryoutSessions) {
      const mk = s.startsAt.slice(0, 7); // wall-clock YYYY-MM (consistent with the week/month day slice)
      (tryByMonth[mk] ??= []).push(s);
    }
    const months = Array.from(new Set([...Object.keys(grouped), ...Object.keys(tryByMonth)])).sort((a, b) => a.localeCompare(b));
    return months.map(mk => {
      const label = new Date(mk + '-01').toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
      const trys = (tryByMonth[mk] ?? []).slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      return (
        <div key={mk} className={styles.calMonthGroup}>
          <div className={styles.calMonthLabel}>{label}</div>
          <div className={styles.calEventList}>
            {(grouped[mk] ?? []).map(e => (
              <EventChip key={e.id} event={e} onClick={() => openEvent(e)} mismatch={mismatchIds.has(e.id)} awardCount={awardCountByEventId[e.id]} />
            ))}
            {trys.map(s => (
              <TryoutChip key={s.id} session={s} href={`${base}/tryouts`} />
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
          const dayTryouts = tryoutSessions.filter(s => s.startsAt.slice(0, 10) === key);
          return (
            <div key={key} className={styles.calWeekDay}>
              <div className={styles.calWeekDayLabel}>
                {day.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <div className={styles.calWeekDayEvents}>
                {dayEvents.length === 0 && dayTryouts.length === 0
                  ? <span className={styles.calWeekEmpty}>—</span>
                  : (
                    <>
                      {dayEvents.map(e => (
                        <EventChip key={e.id} event={e} onClick={() => openEvent(e)} dayKey={key} mismatch={mismatchIds.has(e.id)} awardCount={awardCountByEventId[e.id]} />
                      ))}
                      {dayTryouts.map(s => (
                        <TryoutChip key={s.id} session={s} href={`${base}/tryouts`} />
                      ))}
                    </>
                  )
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
          const dayTryouts = tryoutSessions.filter(s => s.startsAt.slice(0, 10) === key);
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
                  <button
                    type="button"
                    className={styles.calMonthMoreDots}
                    onClick={() => openDay(key, dayEvents)}
                  >
                    +{dayEvents.length - 3} more
                  </button>
                )}
                {dayTryouts.length > 0 && (
                  <Link
                    href={`${base}/tryouts`}
                    className={styles.calMonthEventDot}
                    style={{ background: 'transparent', border: '1px dashed rgba(255,255,255,0.4)', color: 'rgba(255,255,255,0.75)' }}
                    title="Tryout"
                  >
                    Tryout
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }


  return (
    <div className={`${styles.page}${view !== 'list' ? ` ${styles.pageWide}` : ''}`}>
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
        <div className={styles.scheduleToolbar}>
          {/* View toggle (left) */}
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
          {/* Export + Add (right) */}
          <div className={styles.scheduleToolbarActions}>
            <ExportMenu
              formats={['xlsx', 'csv', 'ics']}
              onExportXLSX={handleExportXLSX}
              onExportCSV={handleExportCSV}
              onExportICS={handleExportICS}
              disabled={events.length === 0}
            />
          {/* Add event — coach-portal primary actions are btn-lime (CP-1), not the
              shared blueprint-blue .btnPrimary used by in-modal save buttons. */}
          <div className={styles.addEventWrap}>
            <button
              className={`btn btn-lime ${styles.addEventBtn}`}
              aria-label="Add event"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', padding: '0.34rem 0.8rem' }}
              onClick={() => setAddTypeMenuOpen(v => !v)}
            >
              <Plus size={13} /> <span className={styles.addEventLabel}>Add Event</span>
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
      </div>

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

      {/* ── Day list (mobile month-cell tap) ──────────────────────────────── */}
      {daySheet && (
        <div className={`${styles.modalOverlay} ${styles.daySheetOverlay}`} onClick={() => setDaySheet(null)}>
          <div className={styles.daySheet} onClick={e => e.stopPropagation()}>
            <div className={styles.daySheetHeader}>
              <h2 className={styles.daySheetTitle}>
                {new Date(`${daySheet.dateKey}T00:00:00`).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h2>
              <button className={styles.modalCloseBtn} aria-label="Close" onClick={() => setDaySheet(null)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.calEventList}>
              {sortDayEvents(daySheet.events).map(e => (
                <EventChip key={e.id} event={e} dayKey={daySheet.dateKey} onClick={() => openEvent(e)} mismatch={mismatchIds.has(e.id)} awardCount={awardCountByEventId[e.id]} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Detail slide-over ─────────────────────────────────────────────── */}
      {selectedEvent && (
        <div className={`${styles.modalOverlay} ${styles.slideOverScrim}`} onClick={requestCloseSlideOver}>
          <div className={`${styles.slideOver}${activeSlideTab === 'lineup' ? ` ${styles.slideOverWide}` : ''}`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <button className={styles.modalBackBtn} aria-label="Back" onClick={requestCloseSlideOver}><ArrowLeft size={20} /></button>
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

            {/* Final score — the headline fact of a played game lives in the header, not behind a
                tab. W/L/T is always derived from the two numbers (no manual override). */}
            {isGameEvent && (
              <div className={styles.eventScoreLine}>
                {scoreForm ? (
                  <div className={styles.scoreForm}>
                    <div className={styles.scoreFormRow}>
                      <label className={styles.scoreFieldLabel}>
                        <span>Your team</span>
                        <input className={styles.input} style={{ width: '4.5rem' }} type="number" min={0} inputMode="numeric" autoFocus value={scoreForm.teamScore} onChange={e => setScoreForm(s => s && ({ ...s, teamScore: e.target.value }))} />
                      </label>
                      <span className={styles.scoreFormSep}>–</span>
                      <label className={styles.scoreFieldLabel}>
                        <span>Opponent</span>
                        <input className={styles.input} style={{ width: '4.5rem' }} type="number" min={0} inputMode="numeric" value={scoreForm.opponentScore} onChange={e => setScoreForm(s => s && ({ ...s, opponentScore: e.target.value }))} />
                      </label>
                      {(() => {
                        const t = scoreForm.teamScore.trim(), o = scoreForm.opponentScore.trim();
                        if (t === '' || o === '') return null;
                        const r = Number(t) > Number(o) ? 'win' : Number(t) < Number(o) ? 'loss' : 'tie';
                        return (
                          <span className={styles.resultBadge} style={{ alignSelf: 'flex-end', paddingBottom: '0.5rem', color: r === 'win' ? '#22c55e' : r === 'loss' ? '#ef4444' : '#f59e0b' }}>
                            {r.toUpperCase()}
                          </span>
                        );
                      })()}
                    </div>
                    <div className={styles.scoreFormActions}>
                      <button className={styles.btnPrimary} disabled={saving || scoreForm.teamScore.trim() === '' || scoreForm.opponentScore.trim() === ''} onClick={handleScoreSave}>Save</button>
                      <button className={styles.btnGhost} onClick={() => setScoreForm(null)}>Cancel</button>
                    </div>
                    {saveError && <p className={styles.errorText}>{saveError}</p>}
                  </div>
                ) : selectedEvent.teamScore != null ? (
                  <div className={styles.eventScore}>
                    <span className={styles.eventScoreValue}>{selectedEvent.teamScore} – {selectedEvent.opponentScore}</span>
                    {selectedEvent.result && (
                      <span className={styles.resultBadge} style={{ color: selectedEvent.result === 'win' ? '#22c55e' : selectedEvent.result === 'loss' ? '#ef4444' : '#f59e0b' }}>
                        {selectedEvent.result.toUpperCase()}
                      </span>
                    )}
                    <button className={styles.eventScoreEdit} onClick={() => setScoreForm({ teamScore: String(selectedEvent.teamScore ?? ''), opponentScore: String(selectedEvent.opponentScore ?? '') })}>
                      Edit score
                    </button>
                  </div>
                ) : (
                  <button className={styles.eventScoreAdd} onClick={() => setScoreForm({ teamScore: '', opponentScore: '' })}>
                    + Add final score
                  </button>
                )}
              </div>
            )}

            {/* Applied tags — read-only here; the picker/manager live in "Edit details". */}
            {(tagsByEventId[selectedEvent.id] ?? []).length > 0 && (
              <div className={styles.lineupChips}>
                {(tagsByEventId[selectedEvent.id] ?? []).map(tagId => {
                  const tag = teamTags.find(t => t.id === tagId);
                  return tag ? <span key={tagId} className={styles.lineupChip}>{tag.name}</span> : null;
                })}
              </div>
            )}

            {/* Awards given — the "same visit" give-award moment (Coach Tags & Player Awards
                Phase 2). Gated on a final score, same as the tags/score UI above it. */}
            {isGameEvent && (
              <div className={styles.formSection} style={{ marginTop: '0.75rem' }}>
                <h4 className={styles.formSectionTitle}>Awards given</h4>
                {selectedEvent.status === 'cancelled' ? (
                  <p className={styles.formHint}>This game was cancelled.</p>
                ) : selectedEvent.teamScore == null || selectedEvent.opponentScore == null ? (
                  <p className={styles.formHint}>Enter a final score to unlock awards for this game.</p>
                ) : (
                  <>
                    {teamAwards.filter(a => a.eventId === selectedEvent.id).length === 0 ? (
                      <p className={styles.formHint}>No awards given for this game yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.6rem' }}>
                        {teamAwards.filter(a => a.eventId === selectedEvent.id).map(a => (
                          <div key={a.id} style={{ fontSize: '0.85rem', color: 'var(--white-90)' }}>
                            {a.awardType?.emoji ? `${a.awardType.emoji} ` : ''}{a.awardType?.name ?? 'Award'} — {a.playerName}
                          </div>
                        ))}
                      </div>
                    )}
                    <button className={styles.btnSecondary} onClick={() => setGiveAwardOpen(true)}>🏆 Give an award</button>
                  </>
                )}
              </div>
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

            {lineupMismatch && (
              <div className={styles.lineupPeekWarn} role="status">
                {lineupMismatch.coming.length > 0 && (
                  <p>⚠ Marked in but not in the lineup: {lineupMismatch.coming.join(', ')}.</p>
                )}
                {lineupMismatch.out.length > 0 && (
                  <p>⚠ In the lineup but marked Out: {lineupMismatch.out.join(', ')}.</p>
                )}
                <span>
                  Fix the attendance below, or{' '}
                  <Link href={`${base}/lineups/${selectedEvent!.id}`} style={{ textDecoration: 'underline', color: 'var(--white-80)' }}>edit the lineup →</Link>
                </span>
              </div>
            )}

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
                        aria-label={`${option.label}: ${count}`}
                        title={option.label}
                        className={`${styles.attFilter} ${active ? styles.attFilterActive : ''}`}
                        onClick={() => setAttendanceFilter(active ? 'all' : option.value)}
                      >
                        <Icon size={14} /> <span className={styles.attFilterCount}>{count}</span>
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
                    const cur = ATTENDANCE_BY_VALUE[row.status] ?? ATTENDANCE_BY_VALUE.unknown;
                    const StatusIcon = cur.icon;
                    const isSet = row.status !== 'unknown';
                    const editing = rsvpEditId === row.player.id;
                    return (
                    <div key={row.player.id} className={styles.attendanceRow} data-editing={editing ? 'true' : undefined}>
                      <span className={styles.attendancePlayerName}>{playerDisplayName(row.player)}</span>
                      {/* Current status — same icon + colour as the filter chips. */}
                      <span className={styles.attendanceStatusBadge} data-status={row.status} title={cur.label}>
                        <StatusIcon size={14} />
                        <span className={styles.attendanceStatusBadgeLabel}>{cur.label}</span>
                      </span>
                      {row.note && !editing && (
                        <span className={styles.attendanceNoteFlag} title={row.note} aria-label="Has a note">
                          <StickyNote size={13} />
                        </span>
                      )}
                      <button
                        type="button"
                        className={styles.rsvpBtn}
                        aria-expanded={editing}
                        aria-label={`${isSet ? 'Edit' : 'Set'} attendance for ${playerDisplayName(row.player)}`}
                        onClick={() => setRsvpEditId(editing ? null : row.player.id)}
                      >
                        {isSet ? 'Edit RSVP' : 'RSVP'}
                      </button>
                      {editing && (
                        <div className={styles.rsvpEditor}>
                          <div className={styles.rsvpOptions} role="group" aria-label={`Set attendance for ${playerDisplayName(row.player)}`}>
                            {ATTENDANCE_OPTIONS.map(option => {
                              const Icon = option.icon;
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  data-status={option.value}
                                  aria-pressed={row.status === option.value}
                                  className={`${styles.rsvpOption} ${row.status === option.value ? styles.rsvpOptionActive : ''}`}
                                  onClick={() => setPlayerAttendance(row.player.id, { status: option.value })}
                                >
                                  <Icon size={16} /> {option.label}
                                </button>
                              );
                            })}
                          </div>
                          <input
                            className={styles.attendanceNoteInput}
                            value={row.note}
                            onChange={e => setPlayerAttendance(row.player.id, { note: e.target.value })}
                            placeholder="Note (e.g. leaving early)"
                            aria-label={`Attendance note for ${playerDisplayName(row.player)}`}
                            maxLength={500}
                          />
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}

              {attendanceRows.length > 0 && (
                <div className={styles.attendanceFooter}>
                  <span className={styles.saveStatus} aria-live="polite">
                    {attendanceError
                      ? <button type="button" className={styles.saveRetry} onClick={handleAttendanceSave}>Couldn’t save · Retry</button>
                      : (attendanceSaving || attendanceDirty)
                        ? 'Saving…'
                        : <><Check size={13} /> Saved</>}
                  </span>
                </div>
              )}
            </div>
            );
            })()}

            {activeSlideTab === 'lineup' && isLineupEvent(selectedEvent) && (
              <div className={styles.lineupSection}>
                {(() => {
                  const editHref = `${base}/lineups/${selectedEvent!.id}`;
                  const hasLineup = lineupRows.some(r => Object.values(r.inningPositions).some(Boolean));
                  const battingRows = sortLineupRows(lineupRows).filter(r => lineupMode === 'nine_player' ? r.starter : true);
                  const modeLabel = lineupMode === 'nine_player' ? '9 player ball' : 'Everyone bats';
                  return (
                    <>
                      <div className={styles.lineupPeekHeader}>
                        <div>
                          <h3 className={styles.attendanceTitle}>Lineup</h3>
                          <p className={styles.attendanceSummary}>
                            {hasLineup ? 'A quick look — build and edit on the Lineups page.' : 'No lineup set for this game yet.'}
                          </p>
                        </div>
                        <span className={styles.lineupFrontChip} data-tone={hasLineup ? 'ok' : 'warn'}>
                          {hasLineup ? <><CheckCircle2 size={13} aria-hidden /> Lineup set</> : <><CircleSlash size={13} aria-hidden /> Not set</>}
                        </span>
                      </div>

                      {lineupLoading ? (
                        <div className={styles.attendanceEmpty}>Loading lineup…</div>
                      ) : !hasLineup ? (
                        <div className={styles.lineupPeekEmpty}>
                          <p>Build the batting order and field positions on the full Lineups page.</p>
                          <Link href={editHref} className="btn btn-lime btn-sm">Build lineup →</Link>
                        </div>
                      ) : (
                        <>
                          <div className={styles.lineupPeekStats}>
                            <div><b>{battingRows.length}</b><span>{lineupMode === 'nine_player' ? 'Starters' : 'Batting'}</span></div>
                            <div><b>{lineupInningCount}</b><span>{sportPack.periodLabelPlural}</span></div>
                            <div><b>{modeLabel}</b><span>Format</span></div>
                          </div>

                          <p className={styles.sectionKicker} style={{ marginTop: '1rem' }}>Batting order</p>
                          <ol className={styles.lineupPeekOrder}>
                            {battingRows.map(r => (
                              <li key={r.player.id}>
                                <span className={styles.lineupPeekBat}>{r.battingOrder || '–'}</span>
                                <span className={styles.lineupPeekName}>{playerDisplayName(r.player)}</span>
                                {r.inningPositions['1'] && <span className={styles.lineupPeekPos}>{r.inningPositions['1']}</span>}
                              </li>
                            ))}
                          </ol>

                          <div className={styles.lineupPeekFooter}>
                            <Link href={editHref} className="btn btn-lime btn-sm">Edit in Lineups →</Link>
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Warn before leaving with unsaved event / attendance / lineup edits */}
      <UnsavedChangesGuard active={formDirty || attendanceDirty} />

      {/* ── Add / edit event modal ─────────────────────────────────────────── */}
      {showAddForm && (
        <div className={`${styles.modalOverlay} ${styles.sheetOnMobile}`} onClick={requestCloseForm}>
          <div className={`${styles.modal} ${styles.eventFormModal}`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <button className={styles.modalBackBtn} aria-label="Back" onClick={requestCloseForm}><ArrowLeft size={20} /></button>
              <h3 className={styles.modalTitle}>{editingEventId ? 'Edit' : 'Add'} {EVENT_LABELS[form.eventType]}</h3>
              <button className={styles.modalCloseBtn} onClick={requestCloseForm}><X size={16} /></button>
            </div>

            <div className={styles.formBody}>
              {/* Legend for the per-field <span className={styles.labelRequired}>*</span> markers below —
                  most fields on this form are optional, so only the few that block Save are flagged. */}
              <p className={styles.formHint}><span className={styles.labelRequired}>*</span> Required</p>

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
                      <label className={styles.label}>Which tournament? <span className={styles.labelRequired}>*</span></label>
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
                      <label className={styles.label}>Start date <span className={styles.labelRequired}>*</span></label>
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
                        <label className={styles.label}>Start time <span className={styles.labelRequired}>*</span></label>
                        <input className={styles.input} type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>End time</label>
                        <input className={styles.input} type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Arrival time</label>
                        <input className={styles.input} type="time" value={form.arrivalTime} onChange={e => setForm(f => ({ ...f, arrivalTime: e.target.value }))} />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>First date <span className={styles.labelRequired}>*</span></label>
                        <input className={styles.input} type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Last date <span className={styles.labelRequired}>*</span></label>
                        <input className={styles.input} type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                      </div>
                    </div>
                    {recurrencePreview && <p className={styles.formHint}>{recurrencePreview}</p>}
                  </>
                ) : (
                  <>
                    <div className={styles.field}>
                      <label className={styles.label}>Starts <span className={styles.labelRequired}>*</span></label>
                      <input className={styles.input} type="datetime-local" value={form.startsAt} onChange={e => setStartsAt(e.target.value)} />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Ends</label>
                      <input className={styles.input} type="datetime-local" value={form.endsAt} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))} />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Arrival / call time</label>
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
                    <label className={styles.label}>Field / Diamond #</label>
                    <input
                      className={styles.input}
                      value={form.fieldNumber}
                      onChange={e => setForm(f => ({ ...f, fieldNumber: e.target.value }))}
                      placeholder="e.g. Diamond 2"
                    />
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Address</label>
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
                    <label className={styles.label}>Uniform</label>
                    <input
                      className={styles.input}
                      value={form.uniform}
                      onChange={e => setForm(f => ({ ...f, uniform: e.target.value }))}
                      placeholder="e.g. Home whites"
                    />
                  </div>
                </section>
              )}

              {/* TAGS — a coach's own vocabulary ("Rivalry", "Top in the province"); games only.
                  Autocomplete-or-create: type to filter existing tags, tap to toggle, or create a
                  brand-new one on the spot. Pays off later in Season Review's "vs tag" report. */}
              {needsOpponent(form.eventType) && (
                <section className={styles.formSection}>
                  <h4 className={styles.formSectionTitle}>Tags</h4>
                  <div className={styles.tagPickerRow}>
                    <input
                      className={styles.input}
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      placeholder="e.g. Rivalry, Top in the province"
                      maxLength={40}
                      onKeyDown={e => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        const q = tagInput.trim();
                        if (!q) return;
                        const match = teamTags.find(t => t.name.toLowerCase() === q.toLowerCase());
                        if (match) toggleFormTag(match.id);
                        else void createAndApplyTag(q);
                      }}
                    />
                  </div>
                  <div className={styles.tagChips}>
                    {teamTags
                      .filter(t => !tagInput.trim() || t.name.toLowerCase().includes(tagInput.trim().toLowerCase()))
                      .map(t => (
                        <button
                          key={t.id}
                          type="button"
                          className={`${styles.tagChip} ${form.tagIds.includes(t.id) ? styles.tagChipActive : ''}`}
                          onClick={() => toggleFormTag(t.id)}
                        >
                          {t.name}
                        </button>
                      ))}
                    {tagInput.trim() && !teamTags.some(t => t.name.toLowerCase() === tagInput.trim().toLowerCase()) && (
                      <button
                        type="button"
                        className={styles.tagChipCreate}
                        disabled={tagCreating}
                        onClick={() => void createAndApplyTag(tagInput.trim())}
                      >
                        + Create &ldquo;{tagInput.trim()}&rdquo;
                      </button>
                    )}
                  </div>
                  {tagError && <p className={styles.errorText}>{tagError}</p>}
                  {teamTags.length > 0 && (
                    <button type="button" className={styles.tagManageLink} onClick={() => setTagManagerOpen(true)}>
                      Manage tags
                    </button>
                  )}
                </section>
              )}

              {/* LINKS / RESOURCES — labelled URLs (drill video, rules, field map, flyer). */}
              <section className={styles.formSection}>
                <h4 className={styles.formSectionTitle}>Links</h4>
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

              {/* NAME — demoted from the headline: games (and the rest) auto-name from their
                  type + opponent, so a custom label is an optional override, not a title field. */}
              <div className={styles.field}>
                <label className={styles.label}>Name</label>
                <input
                  className={styles.input}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={needsOpponent(form.eventType) ? `Auto: ${EVENT_NAME_PREFIX[form.eventType]} vs opponent` : `Auto: ${EVENT_NAME_PREFIX[form.eventType]}`}
                />
                <p className={styles.formHint}>
                  {needsOpponent(form.eventType)
                    ? 'Leave blank to name it from the opponent (e.g. “Scrimmage vs Lady Jays”).'
                    : 'Leave blank to use the default name.'}
                </p>
              </div>

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

      {tagManagerOpen && (
        <TagManagerModal
          orgSlug={orgSlug}
          teamId={teamId}
          /* Only the team's OWN tags are manageable here — org-shared tags (teamId null, added to
             the library in Phase 3) are curated by the org admin, not editable from a team. */
          tags={teamTags.filter(t => t.teamId !== null)}
          onClose={() => setTagManagerOpen(false)}
          onChanged={() => { void fetchEvents(); }}
        />
      )}

      {giveAwardOpen && selectedEvent && (
        <GiveAwardModal
          orgSlug={orgSlug}
          teamId={teamId}
          players={awardPlayers}
          awardTypes={awardTypes}
          eventContext={{ id: selectedEvent.id, label: `vs ${selectedEvent.opponent ?? 'opponent'} — ${shortDate(selectedEvent.startsAt.slice(0, 10))}` }}
          onClose={() => setGiveAwardOpen(false)}
          onChanged={() => { void fetchAwardData(); }}
        />
      )}

    </div>
  );
}
