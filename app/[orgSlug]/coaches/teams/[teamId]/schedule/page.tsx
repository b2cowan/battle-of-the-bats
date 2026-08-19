'use client';
import { use, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ArrowLeft, Calendar, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, CircleSlash, Plus, Upload, X, Trophy, TriangleAlert } from 'lucide-react';
import { EVENT_ICONS, EVENT_COLORS } from '@/components/coaches/eventTypeMark';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { useOrg } from '@/lib/org-context';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import { useHelpDrawer } from '@/components/help/help-drawer-context';
import UnsavedChangesGuard from '@/components/coaches/UnsavedChangesGuard';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import { canManageSchedule } from '@/lib/coach-capabilities';
import { insightsSectionHref } from '@/lib/coach-insights-links';
import {
  downloadXLSX, generateCSV, downloadCSVBlob, downloadICS,
  buildFilename, serializeRows, serializeHeaders,
  type ExportColumnDef, type ICSEventInput,
} from '@/lib/export';
import ExportMenu from '@/components/admin/ExportMenu';
import { MapPin, Check, Video, FileText, Link2, ExternalLink, StickyNote, ClipboardList } from 'lucide-react';
import { isValidResourceUrl, MAX_EVENT_RESOURCES } from '@/lib/rep-event-resources';
import { summarizePracticePlan } from '@/lib/rep-practice-plan';
import { buildPostgameDraft, postgameDraftHref } from '@/lib/postgame-draft';
import { playerDisplayName } from '@/lib/coach-roster-name';
import ShareGameLinkRow from '@/components/coaches/ShareGameLinkRow';
import TagManagerModal from '@/components/coaches/TagManagerModal';
import GiveAwardModal from '@/components/coaches/GiveAwardModal';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import CoachFormDisclosure from '@/components/coaches/CoachFormDisclosure';
import type { CoachScheduleTournamentGame } from '@/lib/basic-coach-teams';
import {
  COACH_GAME_EVENT_TYPES, isMirroredEvent, opponentSuffix,
  diffSeenTimes, readSeenTimes, writeSeenTimes, acknowledgeSeen,
  findDuplicateSelfEntries, readDismissedDuplicates, dismissDuplicate,
  type MovedGame, type DuplicateGamePair,
} from '@/lib/coach-tournament-games';
import styles from '../../../coaches.module.css';
import { gameDayEntryHref } from '@/lib/coach-game-day';
import { ATTENDANCE_OPTIONS } from '@/components/coaches/attendanceOptions';
import OpponentScoutingPanel from '@/components/coaches/OpponentScoutingPanel';
import { normalizeOpponentName, recordChip, type OpponentBookEntry } from '@/lib/coach-opponents';
import { tournamentToday, formatInOrgZone, orgDayKey, utcToZonedInputs } from '@/lib/timezone';
import {
  EVENT_LABELS, EVENT_NAME_PREFIX, HOME_AWAY_CHOICES,
  needsOpponent, needsRecurrence, RECURRABLE_TYPES, deriveGameName,
} from '@/lib/coach-schedule-vocab';
import { generateWeeklyOccurrences, type RecurrenceOccurrenceInput } from '@/lib/coach-recurrence';
import ScheduleImportSheet from '@/components/coaches/ScheduleImportSheet';
import { useDiscardGuard, snapshotEqual } from '@/components/coaches/useDiscardGuard';
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

// ⚠ `EVENT_COLORS` and `EVENT_ICONS` MOVED OUT on 2026-08-18, to
// `components/coaches/eventTypeMark.tsx`. The closed-season page needed the same marks for its
// Results shelf, and a second copy would have drifted on exactly the axis a coach reads fastest.
// The win/loss/tie result hues below stay here — they are about an OUTCOME, not an event type.

/** Win/loss/tie badge colour (reuses the semantic status tokens; tie falls through to warning). */
function resultColor(result: string): string {
  return result === 'win' ? 'var(--success)' : result === 'loss' ? 'var(--danger)' : 'var(--warning)';
}

/** The played-game scoreline + W/L/T badge. One fragment, shared by the editable (self-entered)
 *  and read-only (organizer-owned) score lines so they can never drift apart visually. */
function scoreline(event: RepTeamEvent) {
  return (
    <>
      <span className={styles.eventScoreValue}>{event.teamScore} – {event.opponentScore}</span>
      {event.result && (
        <span className={styles.resultBadge} style={{ color: resultColor(event.result) }}>
          {event.result.toUpperCase()}
        </span>
      )}
    </>
  );
}

// Attendance statuses, ordered present → not-present → unset. Drives BOTH the per-player icon
// control and the metric/filter chips (label used by the chips; control is icon-only).
// Value + word + icon + order now live in ONE shared module (components/coaches/attendanceOptions)
// because the Game-Day console's Who's here sheet renders the identical rows — two hand-kept
// copies of four rows is how one screen's control quietly stops matching the other's.

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

// Event-type picker order (colored pills that replace the type <select>). Tournament games are
// created through their parent Tournament, so they aren't a top-level pill — the picker only
// carries one if the form is *already* that type (opened via the nested add-menu / editing).
const EVENT_TYPE_PILLS: RepEventType[] = ['external_tournament', 'league_game', 'scrimmage', 'practice', 'team_event'];

const GAME_EVENT_TYPES = COACH_GAME_EVENT_TYPES as RepEventType[];

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// The event-type vocabulary (labels, name prefixes, which types take an opponent, which can
// recur, home/away) moved to `lib/coach-schedule-vocab` in Chunk C — the export writes it, the
// importer reads it back, and the recurrence writer names each game from its own opponent, so all
// three have to agree on one copy (H2 rule 4).

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

// Chunk C (C0): every schedule surface reads the stored instant in the ORG'S timezone, never the
// device's. A game starts when it starts — a coach travelling, or a family watching from another
// province, must see the game's local start time. `new Date(iso).toLocaleTimeString()` renders in
// whatever zone the device happens to be in, which is how a 6:00 PM game read back 2:00 PM.
function fmtDate(iso: string) {
  return formatInOrgZone(iso, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(iso: string) {
  return formatInOrgZone(iso, { hour: 'numeric', minute: '2-digit', hour12: true });
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

/** Form inputs → the wall-clock string the API takes. The server resolves it to a real instant in
 *  the ORG'S zone (C0), so the client never has to know the offset. */
function isoFromInputs(date: string, time: string) {
  return `${date}T${time}`;
}

/**
 * A stored instant → a `datetime-local` input value, IN THE ORG'S ZONE.
 *
 * The exact inverse of the write path, and that pairing is what makes the round trip stable: open
 * an event, change nothing, save, and the time is identical. Before C0 this converted to the
 * DEVICE'S zone while the write treated the same string as the org's — so every re-save shifted
 * the event by another offset, compounding each time.
 */
function toLocalInput(iso: string | null | undefined): string {
  const { date, time } = utcToZonedInputs(iso);
  return date ? `${date}T${time}` : '';
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
/** The calendar day an event falls on IN THE ORG'S ZONE. Slicing the raw string instead reads the
 *  UTC day, which is a different date for every event after 8 PM Eastern (C0). */
function dayStr(iso: string) { return orgDayKey(iso); }

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

// WI-2B: a REAL tournament game projected onto the calendar — read-only, gold accent, links to the
// public game page (never opens the event editor). Mirrors TryoutChip; games flow through none of the
// editor / attendance / lineup / save paths. `dayKey` present in day-scoped views (week/month) → show
// the time only; the flat list shows the date too.
function TournamentGameChip({ game, dayKey }: { game: CoachScheduleTournamentGame; dayKey?: string }) {
  const lead = dayKey
    ? (game.timeLabel ?? (game.phase === 'live' ? 'Live' : 'TBD'))
    : [game.dateLabel, game.timeLabel].filter(Boolean).join(' · ');
  const inner = (
    <>
      <Trophy size={12} style={{ color: 'var(--warning)', flexShrink: 0 }} aria-hidden />
      <span className={styles.eventChipTime}>{lead}</span>
      <span className={styles.eventChipName}>
        vs {game.opponentName}<span className={styles.eventChipOpp}> · </span>
        <span className={styles.tournamentChipTag}>Tournament</span>
      </span>
      <span className={styles.eventChipTrail}>
        {game.phase === 'live' ? (
          <span className={styles.eventChipResult} style={{ color: 'var(--danger)' }}>
            <span className={styles.tournamentLiveDot} aria-hidden />{game.myScore ?? 0}–{game.oppScore ?? 0}
          </span>
        ) : game.phase === 'final' ? (
          <>
            <span className={styles.eventChipScore}>{game.myScore}–{game.oppScore}</span>
            {game.result && (
              <span className={styles.eventChipResult} style={{ color: resultColor(game.result) }}>{game.result.toUpperCase()}</span>
            )}
          </>
        ) : null}
      </span>
    </>
  );
  return game.href ? (
    <Link href={game.href} className={`${styles.eventChip} ${styles.tournamentChip}`} title="Open the live game page">{inner}</Link>
  ) : (
    <div className={`${styles.eventChip} ${styles.tournamentChip}`} style={{ cursor: 'default' }}>{inner}</div>
  );
}

function EventChip({ event, onClick, dayKey, mismatch, awardCount, moved, bookRecord, gameDayHref }: { event: RepTeamEvent; onClick: () => void; dayKey?: string; mismatch?: boolean; awardCount?: number; moved?: boolean; bookRecord?: string | null; gameDayHref?: string | null }) {
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
    // Day-scoped views (week/month/day-sheet) already carry the date as their column/header, so
    // show only the time there. The flat LIST view has just a month header, so prefix the day
    // ("Mar 15 · 2:00 p.m.") — otherwise a coach can't tell which day an event falls on.
    lead = event.startsAt
      ? (dayKey ? fmtTime(event.startsAt) : `${shortDate(dayStr(event.startsAt))} · ${fmtTime(event.startsAt)}`)
      : '';
  }
  // Opponent safety-net: games auto-name "League Game vs Lady Jays" (opponent already in the name),
  // so only append "vs/@ {opp}" when the opponent is set but NOT already in the name. One shared
  // rule (lib/coach-tournament-games) — the Attendance page names events the same way.
  const oppSuffix = opponentSuffix(event);
  // Final score (team-relative: your team first) for a played game.
  const hasScore = !span && event.teamScore != null && event.opponentScore != null;
  // The row stays ONE interactive element (it opens the drawer); the Game day action is a
  // SIBLING link beside it, never a control nested inside the button — invalid HTML and a
  // mis-tap magnet on a phone. Outside the live window the sibling simply isn't there.
  const chip = (
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
        {/* Batch 4: the organizer rescheduled this since the coach last looked here. Their lineup
            and attendance came with it — this only exists so they know the time changed. */}
        {moved && !cancelled && (
          <span className={styles.eventChipMoved} title="The organizer moved this game">Moved</span>
        )}
        {mismatch && !cancelled && (
          <TriangleAlert size={12} style={{ color: 'var(--warning)', flexShrink: 0 }} aria-label="Lineup and attendance don't match" />
        )}
        {/* Scouting Book glance: your record vs this opponent, upcoming games only (the
            caller passes null once a score exists — the trail slot is the score's then). */}
        {bookRecord && !cancelled && (
          <span className={styles.scoutRecChip} data-tone="even" title={`Your record vs ${event.opponent}`}>{bookRecord}</span>
        )}
        {cancelled ? (
          <span className={styles.eventChipResult} style={{ color: 'var(--warning)' }}>CANCELLED</span>
        ) : (
          <>
            {!!awardCount && (
              <span className={styles.eventChipResult} title={`${awardCount} award${awardCount === 1 ? '' : 's'} given`} style={{ color: 'var(--logic-lime)' }}>
                🏆 {awardCount}
              </span>
            )}
            {hasScore && <span className={styles.eventChipScore}>{event.teamScore}–{event.opponentScore}</span>}
            {!span && event.result && (
              <span className={styles.eventChipResult} style={{ color: resultColor(event.result) }}>
                {event.result.toUpperCase()}
              </span>
            )}
          </>
        )}
      </span>
    </button>
  );
  if (!gameDayHref) return chip;
  return (
    <div className={styles.eventChipRow}>
      {chip}
      <Link href={gameDayHref} className={styles.gdEntryBtn}>Game day</Link>
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
  // Sport vocabulary (period word, position legend, field positions the auto-fill assigns)
  // routes through this team's Sport Pack. Falls back to the default sport until the coaching
  // assignment loads (both offered sports today are diamond, so the fallback is harmless).
  const sportPack = getSportPack(assignments.find(a => a.teamId === teamId)?.teamSport ?? DEFAULT_SPORT);

  const [events, setEvents] = useState<RepTeamEvent[]>([]);
  // Deep-link: /schedule?event=<id>&tab=lineup opens that game straight into its builder (the
  // Lineups front door and the Overview "Build lineup" button link here). One-shot per mount.
  const deepLinkHandledRef = useRef(false);
  const [tryoutSessions, setTryoutSessions] = useState<RepTryoutSession[]>([]);
  // WI-2B: the rep team's real tournament games. Batch 4 mirrors every DATED one into a real event
  // (so attendance/lineups work), so what this list still uniquely carries is the undated bracket
  // slots — plus the public game links. Anything already held as a mirrored event is filtered out
  // below so nothing renders twice.
  const [tournamentGames, setTournamentGames] = useState<CoachScheduleTournamentGame[]>([]);
  // Batch 4: mirrored games the organizer has moved since THIS DEVICE last showed them, and the
  // coach's own hand-entered games that look like a duplicate of a mirrored one.
  const [movedGames, setMovedGames] = useState<MovedGame[]>([]);
  /** Moved games the coach has opened during THIS view — their chip retires immediately rather
   *  than lingering until the next refetch. */
  const [acknowledgedMoves, setAcknowledgedMoves] = useState<Set<string>>(new Set());
  const [dismissedDupes, setDismissedDupes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [view, setView] = useState<ViewMode>('list');
  const [cursorDate, setCursorDate] = useState(() => tournamentToday());

  const [selectedEvent, setSelectedEvent] = useState<RepTeamEvent | null>(null);
  // Mobile month view: a tapped day with >1 event opens this bottom-sheet day list (a single
  // event opens its detail directly). Desktop keeps the in-cell text chips, so this stays null.
  const [daySheet, setDaySheet] = useState<{ dateKey: string; events: RepTeamEvent[] } | null>(null);
  const [slideTab, setSlideTab] = useState<'attendance' | 'lineup' | 'scouting'>('attendance');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  // Whether the event being edited belongs to a recurring series (drives the "this / future / all"
  // save scope chooser) and whether that chooser is currently shown.
  const [editingRecurring, setEditingRecurring] = useState(false);
  /** Batch 4: the event being edited is an organizer-owned mirrored tournament game. */
  const [editingMirrored, setEditingMirrored] = useState(false);
  const [editScopeOpen, setEditScopeOpen] = useState(false);
  /** ONE structured baseline for the whole event form — the fields AND the recurrence preview's
   *  per-date edits. One mapping per form, per the Chunk A discard-guard contract. */
  const [formBaseline, setFormBaseline] = useState<unknown>(null);
  const [addTypeMenuOpen, setAddTypeMenuOpen] = useState(false);
  /** Chunk C (P1 #7) — the schedule importer. */
  const [importOpen, setImportOpen] = useState(false);
  const [importToast, setImportToast] = useState('');
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
  const { openHelp } = useHelpDrawer();

  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  // Which SEASON is on screen — the team's LIVE one, always. `page.capabilities` are that
  // season's. ⚠ `page.canWrite()` is GONE (2026-08-18): it folded read-only into every write
  // flag, and a closed season no longer renders this screen at all.
  const page = useCoachSeasonPage(orgSlug, teamId);

  // Opponent Scouting Book roll-up (one fetch, no N+1): powers the record chip on upcoming
  // game rows and the Scouting tab's availability. Non-fatal — a failed load just means no
  // chips this visit. The map is keyed by the book's normalized names AND every merged-away
  // alias (P2): an aliased spelling's events fold into the owner server-side, but the event
  // string a row renders from still normalizes to the alias — without the alias keys, the
  // chip would vanish from exactly the rows a merge was meant to unify.
  // ⚠ The archive suppression is DELETED (2026-08-18) — the book is a live-season INSTRUMENT
  // (owner ruling 2026-08-04, untouched), and this screen is no longer rendered for a season that
  // has ended, so there is no frozen season left to hide it from. The flag stays because it still
  // gates BOTH the roll-up fetch and the tab computation together, which is what stops a tab
  // opening onto a panel whose data never loads.
  const scoutingAvailable = true;
  const [bookByKey, setBookByKey] = useState<Map<string, OpponentBookEntry>>(new Map());
  const loadBook = useCallback(async () => {
    // CLEAR, not just skip: a coach can flip live → archived season on this same mount
    // (?year= re-render, no remount), and a populated map would keep painting record
    // chips onto the frozen calendar.
    if (!scoutingAvailable) { setBookByKey(new Map()); return; }
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/opponents`);
      if (!res.ok) return;
      const data = await res.json();
      const map = new Map<string, OpponentBookEntry>();
      for (const e of (data.opponents ?? []) as OpponentBookEntry[]) {
        map.set(e.key, e);
        for (const alias of e.aliasKeys ?? []) map.set(alias, e);
      }
      setBookByKey(map);
    } catch { /* chips are a convenience, never a blocker */ }
  }, [orgSlug, teamId, scoutingAvailable]);
  useEffect(() => { loadBook(); }, [loadBook]);
  /** Record chip text for a game row: prior meetings only, upcoming games only (the trail
   *  slot is the score's once one exists). Empty map in an archive ⇒ always null there. */
  const bookRecordFor = useCallback((e: RepTeamEvent): string | null => {
    if (!COACH_GAME_EVENT_TYPES.includes(e.eventType) || !e.opponent) return null;
    if (e.teamScore != null || e.status === 'cancelled') return null;
    const entry = bookByKey.get(normalizeOpponentName(e.opponent));
    if (!entry || entry.meetings.length === 0) return null;
    const r = entry.record;
    if (r.wins + r.losses + r.ties === 0) return null;
    return recordChip(r);
  }, [bookByKey]);
  /**
   * Game-Day Mode entry (P1): a game row grows a `Game day` action inside its live window —
   * ABSENT outside the window (never disabled), absent on cancelled rows (the predicate checks
   * type + status), and absent in an archived season: the console is a live-season INSTRUMENT
   * (same ruling as the scouting book above), so a frozen calendar never offers a bench to run.
   *
   * Clock snapshot, taken once per mount (render must stay pure): the action appears on the
   * visit that falls inside the window; the server guard, not this affordance, enforces it.
   * Memoized as a per-event map — the list view renders the whole season's rows, and the
   * window arithmetic (Intl timezone math when an arrival time is set) must not be re-paid
   * per game row on every unrelated re-render.
   */
  const [gameDayNowMs] = useState(() => Date.now());
  const gameDayHrefById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of events) {
      const href = gameDayEntryHref(orgSlug, teamId, e, gameDayNowMs);
      if (href) map.set(e.id, href);
    }
    return map;
  }, [events, orgSlug, teamId, gameDayNowMs]);
  const assignment = assignments.find(a => a.teamId === teamId);
  // An assistant who reaches this page read-only must not be handed an "Add Event" button. Fails
  // CLOSED while the assignment resolves — the empty state only renders past the !assignment guard.
  const canAddEvents = (page.capabilities ? canManageSchedule(page.capabilities) : false);
  // `label` is required here — this object also goes straight to openHelp() from the empty state,
  // where there is no HelpButton label to fall back to.
  const scheduleHelpRequest = {
    module: 'coaches' as const,
    // "Share game link" is reached from a game in this schedule, so its guide belongs on
    // this page's "?" rather than only in the family section on Roster.
    // 'recipe-announcements' carries the postgame "Draft the family email" action, which the
    // coach meets HERE (under a saved score) rather than on the Email families screen — so the
    // Schedule's own "?" has to reach it, or the only explanation lives behind a door they had
    // no reason to open.
    sectionIds: ['recipe-premium-schedule', 'recipe-game-day-details', 'premium-share-game-link', 'recipe-announcements'],
    label: 'Schedule',
    fullGuideHref: `/${orgSlug}/coaches/help#recipe-premium-schedule`,
  };

  // ⚠ THE PINNED MASTHEAD IS SERVER-RENDERED BY THE TEAM LAYOUT, AND A LAYOUT DOES NOT RE-RENDER
  // ON CLIENT NAVIGATION. That is what makes it free on every page after the first — and it is
  // also why changing the schedule here would otherwise leave the bar announcing "Game day —
  // Lions, 6:30" for a game the coach just cancelled, for the rest of their session. Every reload
  // after the initial mount means something changed, so it asks the router to re-render the
  // server layout too (client state is preserved — this is a data refresh, not a remount).
  // /review 2026-08-02.
  const router = useRouter();
  const firstLoadRef = useRef(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    if (firstLoadRef.current) firstLoadRef.current = false;
    else router.refresh();
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const nextEvents: RepTeamEvent[] = data.events ?? [];
      setEvents(nextEvents);
      // Batch 4: compare the mirrored games against what this device last showed the coach. A
      // reschedule keeps their lineup and attendance (those attach to the game, not its time
      // slot) — this is purely so they KNOW. First sight is recorded silently; a flagged move
      // stays up until the coach opens the game.
      const { moved, nextSeen } = diffSeenTimes(nextEvents, readSeenTimes(teamId));
      setMovedGames(moved);
      setAcknowledgedMoves(new Set());
      writeSeenTimes(teamId, nextSeen);
      setDismissedDupes(readDismissedDuplicates(teamId));
      setMismatchIds(new Set<string>(data.lineupMismatchEventIds ?? []));
      setTeamTags(data.tags ?? []);
      setTagsByEventId(data.tagsByEventId ?? {});
      setAwardCountByEventId(data.awardCountByEventId ?? {});
      // Tryout sessions are projected onto the calendar as read-only markers. Non-fatal: if this
      // fails the schedule still works, tryout dates just won't show.
      // Tryout markers + real tournament games are both optional read-only overlays keyed only on
      // org/team — fetch them concurrently (one round-trip, not two) and apply each independently.
      const [tryoutRes, gamesRes] = await Promise.allSettled([
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/tryout-sessions`),
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/tournament-games`),
      ]);
      if (tryoutRes.status === 'fulfilled' && tryoutRes.value.ok) {
        try { setTryoutSessions((await tryoutRes.value.json()).sessions ?? []); } catch { /* optional */ }
      }
      if (gamesRes.status === 'fulfilled' && gamesRes.value.ok) {
        try { setTournamentGames((await gamesRes.value.json()).games ?? []); } catch { /* optional */ }
      }
    } catch (e: unknown) {
      setError(errorMessage(e, 'Failed to load events'));
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId, router]);

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

  // ── Batch 4 derived collections ─────────────────────────────────────────────
  // Every DATED tournament game is now a real event on this calendar, so the read-only chip must
  // only render what could NOT be mirrored — an unresolved bracket slot with no start time.
  // Filtering on the mirrored ids (rather than "has a date") also keeps a game visible as a chip
  // in the window between the organizer scheduling it and the next sync landing.
  // Memoised, and declared HERE with the other hooks (above this component's early returns —
  // hooks must run in the same order every render): this component also owns the event FORM's
  // state, so without memos every keystroke while editing would rebuild all four.
  const unmirroredGames = useMemo(() => {
    const mirroredSourceIds = new Set(
      events.map(e => e.sourceTournamentGameId).filter(Boolean) as string[],
    );
    return tournamentGames.filter(g => !mirroredSourceIds.has(g.id));
  }, [events, tournamentGames]);
  const movedEventIds = useMemo(
    () => new Set(movedGames.map(m => m.eventId).filter(id => !acknowledgedMoves.has(id))),
    [movedGames, acknowledgedMoves],
  );
  // The coach's own hand-entered copies of games that now arrive automatically — derived from
  // `events` rather than mirrored into state, so the two can never fall out of step. "Keep both"
  // is remembered, and a pair drops out the moment either side stops existing.
  const duplicatePairs = useMemo(() => findDuplicateSelfEntries(events), [events]);
  const liveDuplicates = useMemo(
    () => duplicatePairs.filter(p => !dismissedDupes.has(p.key)),
    [duplicatePairs, dismissedDupes],
  );

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
      // ?tab=scouting deep-links (the Opponents card's meeting rows, shared links). If the
      // event turns out to have no Scouting tab, activeSlideTab falls back to Attendance.
      if (sp.get('tab') === 'scouting') setSlideTab('scouting');
    } catch { /* ignore malformed params */ }
  }, [loading, events]);

  // Nav-hide + body-scroll-lock while a full-screen modal (detail, add/edit, or the day-list
  // sheet) is open — folded onto the shared CoachesOverlayProvider (Coach Portal Batch 1,
  // Phase 1.2-1.6 sweep) so this page's lock travels with the same lifecycle as every other
  // sheet-owning surface instead of a bespoke local effect.
  const anyModalOpen = !!selectedEvent || showAddForm || !!daySheet;
  useOverlayOpen(anyModalOpen);

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
    setOccurrenceOpponents({});
    setRemovedDates(new Set());
    setFormBaseline({ form: blank, occurrenceOpponents: {}, removed: [] });
    setEditingEventId(null);
    setEditingMirrored(false);
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
    setOccurrenceOpponents({});
    setRemovedDates(new Set());
    setFormBaseline({ form: f, occurrenceOpponents: {}, removed: [] });
    setEditingEventId(event.id);
    // Batch 4: editing a mirrored tournament game opens the form in restricted mode — the
    // organizer's facts render as context, only the coach's own fields are editable.
    setEditingMirrored(isMirroredEvent(event));
    setEditingRecurring(event.isRecurring);
    setEditScopeOpen(false);
    setSaveError('');
    closeSelectedEvent();
    setShowAddForm(true);
  }

  // Event-form view helpers (drive the per-type sections + the Save guard).
  const recurringSeries = needsRecurrence(form.eventType) && form.isRecurring;

  // ── Recurrence preview (Chunk C, P1 #6) ─────────────────────────────────────
  // "Repeat weekly" used to take ONE opponent and stamp it onto every game it created, so a
  // 12-game round robin was MORE work through the feature than without it. The fix is not a
  // twelfth opponent field — it is showing the occurrences before any of them exist. The dates
  // come from the shared generator the commit route also runs, so the two can never disagree.
  const recurrenceDates = useMemo(
    () => (recurringSeries
      ? generateWeeklyOccurrences({
          dayOfWeek: Number(form.dayOfWeek),
          startDate: form.startDate,
          endDate: form.endDate,
        })
      : []),
    [recurringSeries, form.dayOfWeek, form.startDate, form.endDate],
  );
  /** Per-date opponent, keyed by date. A date absent from `removedDates` is committed. */
  const [occurrenceOpponents, setOccurrenceOpponents] = useState<Record<string, string>>({});
  const [removedDates, setRemovedDates] = useState<Set<string>>(new Set());
  const keptDates = recurrenceDates.filter(d => !removedDates.has(d));
  const recurrenceIsGame = needsOpponent(form.eventType);

  // The dirty baseline covers the occurrence edits too — nine typed opponents and a deleted bye
  // week are exactly the work the discard guard exists to protect (Chunk A rule 4).
  const formSnapshot = { form, occurrenceOpponents, removed: [...removedDates].sort() };
  const formDirty = showAddForm && !snapshotEqual(formSnapshot, formBaseline);
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
  // A series with every date removed has nothing to write — the button must not offer to add 0.
  const formHasStart = recurringSeries
    ? Boolean(form.startTime && form.startDate && form.endDate && keptDates.length)
    : Boolean(form.startsAt);
  // A resource row blocks save only if it has content but is incomplete/has a bad URL; fully-empty
  // rows are fine (dropped on save).
  const resourcesInvalid = form.resources.some(r => {
    const has = r.label.trim() || r.url.trim();
    return has && (!r.label.trim() || !isValidResourceUrl(r.url));
  });
  const recurrenceNoun = EVENT_LABELS[form.eventType].toLowerCase();

  // Drives the "Add details (optional)" disclosure (Batch 2, P0 #8). `hasEventDetails` is read on
  // mount only, so editing an event that already carries any of these opens the group; the summary
  // keeps a collapsed group honest about what's inside — especially a link error that blocks Save.
  const eventDetailCount = [
    form.fieldNumber.trim(), form.locationAddress.trim(), form.uniform.trim(),
    form.name.trim(), form.description.trim(),
  ].filter(Boolean).length + (form.tagIds.length ? 1 : 0) + (form.resources.length ? 1 : 0);
  const hasEventDetails = eventDetailCount > 0;
  const eventDetailsSummary = resourcesInvalid
    ? 'Links need fixing'
    : eventDetailCount > 0 ? `${eventDetailCount} set` : undefined;

  // Tabs for the event slide-over (keeps it short instead of one long stack)
  const isGameEvent = !!selectedEvent &&
    ['league_game', 'tournament_game', 'scrimmage'].includes(selectedEvent.eventType);
  // Batch 4: a MIRRORED tournament game. The organizer owns its time, opponent, venue, score,
  // result and whether it happened; the coach owns arrival time, uniform, field, notes, links,
  // tags — and attendance + the lineup, which is the entire point. The API enforces the same
  // split, so hiding these controls is honesty, not the guard.
  const mirroredGame = isMirroredEvent(selectedEvent);
  const selectedMoved = selectedEvent
    ? movedGames.find(m => m.eventId === selectedEvent.id) ?? null
    : null;
  /** The public game page for a mirrored game, when the tournament is publicly visible. */
  const mirroredGameHref = selectedEvent?.sourceTournamentGameId
    ? tournamentGames.find(g => g.id === selectedEvent.sourceTournamentGameId)?.href ?? null
    : null;
  /**
   * Chunk D 3.1 — the postgame family email, offered at the one moment the coach is already
   * here: a game with a final score saved.
   *
   * Deliberately NOT offered when the coach cannot send announcements — a door that opens onto
   * a screen they are gated out of is worse than no door (the label-keyed nav gate's lesson) —
   * and `canWrite` folds in the archive rule, so a FINISHED season never offers to message a
   * team that no longer exists (D-F7). Never offered on a cancelled game. Skipping it costs
   * nothing: families are never told a postgame email exists, so one that is never written is
   * not one that is missing.
   */
  const postgameDraftHrefForSelected = useMemo(() => {
    if (!selectedEvent || !isGameEvent) return null;
    if (selectedEvent.status === 'cancelled') return null;
    if (selectedEvent.teamScore == null || selectedEvent.opponentScore == null) return null;
    // ⚠ The read-only half of this condition is gone with the finished-season branches
    // (2026-08-18); what is left is the grant that decides whether a draft can be sent at all.
    if (!page.capabilities?.announcementsSend) return null;

    // ⚠ A PLAYED game is still `status: 'scheduled'` — the platform has no 'completed' status,
    // it marks a game finished by giving it a result or a score. So "later on the clock" is
    // NOT the same as "hasn't happened". A coach backfilling both halves of a Saturday
    // double-header on Sunday night would otherwise have game 1's draft announce game 2 as
    // "next up", which already happened. Same "is it over" rule the family surfaces use.
    const after = new Date(selectedEvent.startsAt).getTime();
    const notYetPlayed = (e: RepTeamEvent) =>
      e.result == null && e.teamScore == null && e.opponentScore == null;
    const next = events
      .filter(e => e.status !== 'cancelled' && notYetPlayed(e) && new Date(e.startsAt).getTime() > after)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0] ?? null;

    return postgameDraftHref(base, buildPostgameDraft({
      teamName: page.teamName,
      game: {
        opponent: selectedEvent.opponent,
        homeAway: selectedEvent.homeAway,
        teamScore: selectedEvent.teamScore,
        opponentScore: selectedEvent.opponentScore,
      },
      nextEvent: next && {
        eventType: next.eventType,
        name: next.name,
        opponent: next.opponent,
        homeAway: next.homeAway,
        startsAt: next.startsAt,
        location: next.location,
        fieldNumber: next.fieldNumber,
      },
    }));
  }, [selectedEvent, isGameEvent, page.capabilities, page.teamName, events, base]);

  const slideTabs: { key: 'attendance' | 'lineup' | 'scouting'; label: string }[] = [{ key: 'attendance', label: 'Attendance' }];
  if (isLineupEvent(selectedEvent)) slideTabs.push({ key: 'lineup', label: 'Lineup' });
  // Scouting Book glance (owner-approved 2026-08-04): games with a real opponent name only —
  // a TBD bracket slot gets no tab, never a dead end. Read gates on `schedule`, which is
  // everyone who can open this page, so no extra capability check here. Archive absence
  // rides `scoutingAvailable`, the same flag that gates the roll-up fetch.
  const scoutingKey = selectedEvent && isGameEvent && selectedEvent.opponent && scoutingAvailable
    ? normalizeOpponentName(selectedEvent.opponent)
    : '';
  if (scoutingKey) slideTabs.push({ key: 'scouting', label: 'Scouting' });
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
    // Opening a moved game IS the acknowledgement — the coach has now seen the new time, so this
    // device stops flagging it. The row's "Moved" chip has to clear in the same breath: writing
    // only to storage would leave it on the calendar until some unrelated action refetched.
    // `selectedMoved` reads from a snapshot taken here, so the detail line still shows this time.
    if (isMirroredEvent(event) && movedGames.some(m => m.eventId === event.id)) {
      acknowledgeSeen(teamId, event.id, event.startsAt);
      setAcknowledgedMoves(prev => new Set(prev).add(event.id));
    }
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

  // Chunk C (C5): the guard was hand-rolled with the one phrase the discard-guard contract bans
  // ("You have unsaved changes to this event"). It now runs on the shared primitive with copy that
  // NAMES what is at stake — "9 opponents and a removed date" is judgeable in a second, one-handed,
  // which "unsaved changes" never is.
  const typedOpponentCount = keptDates.filter(d => (occurrenceOpponents[d] ?? '').trim()).length;
  const discardDetail = recurringSeries && recurrenceDates.length
    ? [
        `${keptDates.length} ${EVENT_LABELS[form.eventType].toLowerCase()}${keptDates.length === 1 ? '' : 's'}`,
        typedOpponentCount ? `${typedOpponentCount} opponent${typedOpponentCount === 1 ? '' : 's'}` : '',
        removedDates.size ? `${removedDates.size} removed date${removedDates.size === 1 ? '' : 's'}` : '',
      ].filter(Boolean).join(', ')
    : undefined;

  const requestDiscardForm = useDiscardGuard({
    dirty: formDirty,
    close: closeAddForm,
    noun: editingEventId ? 'change' : EVENT_LABELS[form.eventType].toLowerCase(),
    detail: discardDetail,
  });

  function closeAddForm() {
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
      // Batch 4: on a MIRRORED tournament game only the coach-owned fields are sent. The route
      // rejects an organizer-owned field with a 409 (and the next sync would overwrite it anyway),
      // so sending the whole form would fail a save whose visible fields were all legitimate.
      const coachOwned = {
        description: form.description.trim() || null,
        arrivalTime: form.arrivalTime || null,
        fieldNumber: form.fieldNumber.trim() || null,
        uniform: form.uniform.trim() || null,
        resources: form.resources,
        tagIds: needsOpponent(form.eventType) ? validFormTagIds : undefined,
      };
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${editingEventId}?scope=${scope}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingMirrored ? coachOwned : {
          ...coachOwned,
          name: eventNameForSave(form),
          startsAt: form.startsAt || null,
          endsAt: form.endsAt || null,
          location: form.location.trim() || null,
          locationAddress: form.locationAddress.trim() || null,
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

  /**
   * Batch 4 — remove the coach's own hand-entered copy of a game that now arrives from the
   * tournament automatically. Their copy may carry real attendance and a real lineup, so the
   * confirm counts them out loud before anything is deleted; nothing here touches the mirrored
   * game (which isn't theirs to delete anyway).
   */
  async function handleRemoveDuplicate(pair: DuplicateGamePair) {
    const own = events.find(e => e.id === pair.ownId);
    // `saving` is set BEFORE the count fetch below, not after the confirm: the counts take a round
    // trip, and an un-disabled button in that window lets a second click open a second confirm —
    // which hijacks the shared dialog's single resolver slot and leaves the first click hung.
    if (!own || saving) return;
    setSaving(true);
    // Count what goes with it, so the confirm can be specific rather than vaguely ominous.
    let attendanceCount = 0;
    let hasLineup = false;
    try {
      const [attRes, lineupRes] = await Promise.allSettled([
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${pair.ownId}/attendance`),
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${pair.ownId}/lineup`),
      ]);
      if (attRes.status === 'fulfilled' && attRes.value.ok) {
        const d = await attRes.value.json();
        attendanceCount = ((d.attendance ?? []) as RepTeamEventAttendance[])
          .filter(a => a.status !== 'unknown').length;
      }
      if (lineupRes.status === 'fulfilled' && lineupRes.value.ok) {
        const d = await lineupRes.value.json();
        hasLineup = Boolean(d.lineup);
      }
    } catch { /* the confirm just stays general — never block the action on a count */ }

    const carried = [
      attendanceCount > 0 ? `its attendance (${attendanceCount} player${attendanceCount === 1 ? '' : 's'})` : null,
      hasLineup ? 'its saved lineup' : null,
    ].filter(Boolean);
    const tail = 'The tournament’s version stays, and you can take attendance and build the lineup on that one instead.';
    const message = carried.length > 0
      ? `${carried.join(' and ')} ${carried.length > 1 ? 'go' : 'goes'} with it. ${tail}`
      : tail;

    try {
      if (!(await confirm({
        title: `Remove your copy of “${own.name}”?`,
        message,
        confirmText: 'Remove it',
        cancelText: 'Cancel',
        tone: 'danger',
      }))) return;
      await deleteEventRequest(pair.ownId, 'one');
      await fetchEvents();
    } catch (e: unknown) {
      // Surfaced on the page (beside the duplicate notice), not in the slide-over.
      setError(errorMessage(e, 'Could not remove the event'));
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
        // Chunk C (P1 #6): send the rows the coach actually reviewed — each with its own opponent,
        // and without any date they removed. The route regenerates from the same rule and refuses
        // a date it can't produce, so a stale client can never write an unreviewed occurrence.
        body.occurrences = keptDates.map<RecurrenceOccurrenceInput>(date => ({
          date,
          opponent: recurrenceIsGame ? (occurrenceOpponents[date]?.trim() || null) : null,
          homeAway: recurrenceIsGame ? (form.homeAway || null) : null,
        }));
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
      // The book's record vs this opponent just changed; refresh the roll-up so the
      // capture door + chips reflect tonight's result. Non-blocking convenience.
      loadBook();
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

  /** DELETE one event. Shared by the slide-over's Delete and the duplicate-game "Remove my copy"
   *  flow, which surface the error in different places. Refreshing is the CALLER's job — the
   *  slide-over must close the instant the delete succeeds, not sit open through a full refetch. */
  async function deleteEventRequest(eventId: string, scope: 'one' | 'remaining' | 'all') {
    const res = await fetch(
      `/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}?scope=${scope}`,
      { method: 'DELETE' },
    );
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Delete failed');
  }

  async function handleDelete(eventId: string, scope: 'one' | 'remaining' | 'all') {
    setSaving(true);
    try {
      // Closing happens only on success — a failure must leave the slide-over up, since that is
      // where `saveError` renders — and immediately, with the refresh trailing behind it.
      await deleteEventRequest(eventId, scope);
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
  if (!page.hasAccess) {
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
    if (!events.length && !tryoutSessions.length && !unmirroredGames.length) {
      return (
        <CoachEmptyState
          icon={<Calendar size={22} aria-hidden />}
          eyebrow="Schedule"
          headline="No events scheduled yet"
          description="One calendar for games, practices, meetings and tournaments — with arrival times, field numbers and a tap-to-open map on each one."
          payoff="It's what the rest of the portal builds on: lineups attach to these games, attendance is taken from them, your Overview shows the next one, and families see the same dates you do."
          blocker={canAddEvents
            ? undefined
            : 'Adding events needs schedule access — ask your head coach to turn it on.'}
          primaryAction={canAddEvents ? {
            label: 'Add Event',
            icon: <Plus size={15} aria-hidden />,
            onClick: () => setAddTypeMenuOpen(true),
          } : undefined}
          secondaryAction={{
            label: 'How the schedule works',
            icon: <CircleHelp size={15} aria-hidden />,
            onClick: () => openHelp(scheduleHelpRequest),
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
    // WI-2B: group the real tournament games by month too, so they list alongside self-entered
    // events. A game with no date yet (an unresolved bracket slot) has no month — collect those
    // separately so the list view still shows them (a trailing "To be scheduled" group) rather than
    // silently dropping them, matching the free-portal Schedule.
    const gamesByMonth: Record<string, CoachScheduleTournamentGame[]> = {};
    const tbdGames: CoachScheduleTournamentGame[] = [];
    for (const g of unmirroredGames) {
      const mk = (g.gameDate ?? '').slice(0, 7);
      if (mk) (gamesByMonth[mk] ??= []).push(g);
      else tbdGames.push(g);
    }
    const months = Array.from(
      new Set([...Object.keys(grouped), ...Object.keys(tryByMonth), ...Object.keys(gamesByMonth)]),
    ).sort((a, b) => a.localeCompare(b));
    const monthGroups = months.map(mk => {
      const label = new Date(mk + '-01T00:00:00').toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
      const trys = (tryByMonth[mk] ?? []).slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      const games = (gamesByMonth[mk] ?? []).slice().sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''));
      return (
        <div key={mk} className={styles.calMonthGroup}>
          <div className={styles.calMonthLabel}>{label}</div>
          <div className={styles.calEventList}>
            {(grouped[mk] ?? []).map(e => (
              <EventChip key={e.id} event={e} onClick={() => openEvent(e)} mismatch={mismatchIds.has(e.id)} awardCount={awardCountByEventId[e.id]} moved={movedEventIds.has(e.id)} bookRecord={bookRecordFor(e)} gameDayHref={gameDayHrefById.get(e.id) ?? null} />
            ))}
            {games.map(g => (
              <TournamentGameChip key={`g-${g.id}`} game={g} />
            ))}
            {trys.map(s => (
              <TryoutChip key={s.id} session={s} href={`${base}/tryouts`} />
            ))}
          </div>
        </div>
      );
    });
    return (
      <>
        {monthGroups}
        {tbdGames.length > 0 && (
          <div key="tbd" className={styles.calMonthGroup}>
            <div className={styles.calMonthLabel}>To be scheduled</div>
            <div className={styles.calEventList}>
              {tbdGames.map(g => (
                <TournamentGameChip key={`g-${g.id}`} game={g} />
              ))}
            </div>
          </div>
        )}
      </>
    );
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
          const dayGames = unmirroredGames
            .filter(g => g.gameDate === key)
            .sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''));
          return (
            <div key={key} className={styles.calWeekDay}>
              <div className={styles.calWeekDayLabel}>
                {day.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <div className={styles.calWeekDayEvents}>
                {dayEvents.length === 0 && dayTryouts.length === 0 && dayGames.length === 0
                  ? <span className={styles.calWeekEmpty}>—</span>
                  : (
                    <>
                      {dayEvents.map(e => (
                        <EventChip key={e.id} event={e} onClick={() => openEvent(e)} dayKey={key} mismatch={mismatchIds.has(e.id)} awardCount={awardCountByEventId[e.id]} moved={movedEventIds.has(e.id)} bookRecord={bookRecordFor(e)} gameDayHref={gameDayHrefById.get(e.id) ?? null} />
                      ))}
                      {dayGames.map(g => (
                        <TournamentGameChip key={`g-${g.id}`} game={g} dayKey={key} />
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
          // Built from calendar parts, so read back from calendar parts — `toISOString()` on a
          // locally-constructed Date reads the UTC day and can name the wrong cell (C0).
          const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
          const dayEvents = sortDayEvents(events.filter(e => eventOnDay(e, key)));
          const dayTryouts = tryoutSessions.filter(s => s.startsAt.slice(0, 10) === key);
          const dayGames = unmirroredGames.filter(g => g.gameDate === key);
          const isToday = key === tournamentToday();
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
                {dayGames.slice(0, 2).map(g => {
                  const label = g.phase === 'live' ? `● ${g.opponentName}` : g.phase === 'final' ? `${g.myScore}–${g.oppScore} ${g.opponentName}` : `vs ${g.opponentName}`;
                  const title = `${g.dateLabel}${g.timeLabel ? ` · ${g.timeLabel}` : ''} · vs ${g.opponentName}${g.tournamentName ? ` · ${g.tournamentName}` : ''}`;
                  return g.href ? (
                    <Link key={`g-${g.id}`} href={g.href} className={`${styles.calMonthEventDot} ${styles.tournamentMonthDot}`} title={title}>
                      {label.slice(0, 14)}
                    </Link>
                  ) : (
                    <span key={`g-${g.id}`} className={`${styles.calMonthEventDot} ${styles.tournamentMonthDot}`} title={title} style={{ cursor: 'default' }}>
                      {label.slice(0, 14)}
                    </span>
                  );
                })}
                {/* Cap tournament-game dots like events do, so a busy pool-play day can't overflow the
                    cell (Week/List views show the full set). */}
                {dayGames.length > 2 && (
                  <span className={`${styles.calMonthEventDot} ${styles.tournamentMonthDot}`} style={{ cursor: 'default' }} title="Switch to Week or List to see all games">
                    +{dayGames.length - 2} game{dayGames.length - 2 === 1 ? '' : 's'}
                  </span>
                )}
                {dayTryouts.length > 0 && (
                  <Link
                    href={`${base}/tryouts`}
                    className={styles.calMonthEventDot}
                    style={{ background: 'transparent', border: '1px dashed var(--home-line-strong, rgba(255,255,255,0.4))', color: 'var(--home-ink-soft, rgba(255,255,255,0.75))' }}
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

  // Page-header ruling 2026-08-11: header actions, extracted so the CoachPageHeader call stays
  // scannable (same shape as the Money panels' headerActions consts).
  const scheduleHeaderActions = (
    <>
      {/* Chunk C (P1 #7). Sits beside Export deliberately: the pair is one idea — a schedule
          goes out and comes back, and the importer reads the exporter's own columns. Gated on
          the same grant as Add Event; a read-only assistant sees neither. */}
      {canAddEvents && (
        <button
          className={styles.btnSecondary}
          onClick={() => { setImportToast(''); setImportOpen(true); }}
          aria-label="Import"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
        >
          <Upload size={13} aria-hidden /> <span className={styles.headerBtnLabel}>Import</span>
        </button>
      )}
      <ExportMenu
        formats={['xlsx', 'csv', 'ics']}
        onExportXLSX={handleExportXLSX}
        onExportCSV={handleExportCSV}
        onExportICS={handleExportICS}
        disabled={events.length === 0}
      />
      {/* Add event — coach-portal primary actions are btn-lime (CP-1), not the
          shared blueprint-blue .btnPrimary used by in-modal save buttons. The primary
          keeps its words at every width. Gated on the same grant as the empty state's
          CTA: without it the events POST 403s, so this was a button that could only
          ever fail — and once the empty state started saying "adding events needs
          schedule access", leaving it here contradicted that outright. */}
      {canAddEvents && (
        <div className={styles.addEventWrap}>
          <button
            className="btn btn-lime"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', padding: '0.34rem 0.8rem' }}
            onClick={() => setAddTypeMenuOpen(v => !v)}
          >
            <Plus size={13} aria-hidden /> Add Event
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
      )}
    </>
  );

  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      {/* Header (page-header ruling 2026-08-11): "Schedule" — the name the nav already uses;
          "Team Calendar" said "team" (the masthead's job) and disagreed with its own menu item.
          Actions right, "?" in its fixed corner; the view switcher rides the views below. */}
      <CoachPageHeader
        icon={Calendar}
        title="Schedule"
        actions={scheduleHeaderActions}
        helpLabel="Schedule"
        help={scheduleHelpRequest}
      />

      {/* List | Week | Month — a view switcher is not an action: it rides the body it switches
          (ruling 2026-08-11), exactly where Roster's List/Depth-chart toggle already lives. */}
      <div className={styles.listToolbar}>
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
      </div>

      {/* Navigator for week/month */}
      {view !== 'list' && (
        <div className={styles.calNav}>
          <button className={styles.calNavBtn} onClick={() => navigate(-1)}><ChevronLeft size={16} /></button>
          <span className={styles.calNavLabel}>
            {view === 'month'
              ? new Date(curMonth + '-01T00:00:00').toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
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

      {/* Batch 4 — the hand-entered duplicates. Coaches worked around the missing tools by typing
          their tournament games in themselves; now the real ones arrive automatically, those teams
          have two rows for one game and BOTH count toward the record. We name the collision and
          offer a one-tap fix — never a silent merge, because their copy may hold real attendance
          and a real lineup. "Keep both" is a genuine answer and is remembered. */}
      {!loading && liveDuplicates.length > 0 && (
        <div className={styles.dupeNotice} role="status">
          {liveDuplicates.slice(0, 1).map(pair => {
            const mirror = events.find(e => e.id === pair.mirrorId);
            const own = events.find(e => e.id === pair.ownId);
            if (!mirror || !own) return null;
            return (
              <div key={pair.key} className={styles.dupeNoticeBody}>
                <p className={styles.dupeNoticeHead}>
                  This game now comes from {mirror.name} automatically
                </p>
                <p className={styles.dupeNoticeText}>
                  You also added &ldquo;{own.name}&rdquo; yourself on {fmtDate(own.startsAt)}. Keeping both counts it twice in your record.
                  {liveDuplicates.length > 1 && ` (${liveDuplicates.length - 1} more like this.)`}
                </p>
                <div className={styles.dupeNoticeActions}>
                  <button type="button" className={styles.btnPrimary} disabled={saving} onClick={() => void handleRemoveDuplicate(pair)}>Remove my copy</button>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => { dismissDuplicate(teamId, pair.key); setDismissedDupes(readDismissedDuplicates(teamId)); }}
                  >
                    Keep both
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* What an import just did — above the calendar it changed, not adrift at the page foot. */}
      {importToast && (
        <p className={styles.importResult} role="status">{importToast}</p>
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
                <EventChip key={e.id} event={e} dayKey={daySheet.dateKey} onClick={() => openEvent(e)} mismatch={mismatchIds.has(e.id)} awardCount={awardCountByEventId[e.id]} moved={movedEventIds.has(e.id)} bookRecord={bookRecordFor(e)} gameDayHref={gameDayHrefById.get(e.id) ?? null} />
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
                <span className={styles.eventTypePill} style={{ background: `color-mix(in srgb, ${EVENT_COLORS[selectedEvent.eventType]} 13.333%, transparent)`, color: EVENT_COLORS[selectedEvent.eventType] }}>
                  {EVENT_LABELS[selectedEvent.eventType]}
                </span>
                {selectedEvent.status === 'cancelled' && (
                  <span className={styles.eventTypePill} style={{ background: 'color-mix(in srgb, var(--warning) 13.333%, transparent)', color: 'var(--warning)' }}>Cancelled</span>
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

            {/* Batch 4 — where this game came from. Its time, opponent, venue and score are the
                organizer's; attendance and the lineup below are entirely the coach's. */}
            {mirroredGame && (
              <div className={`${styles.infoBanner} ${styles.sourceNote}`}>
                <Trophy size={13} aria-hidden style={{ flexShrink: 0 }} />
                <span>
                  From <strong>{selectedEvent.name}</strong> · organizer’s schedule
                  {mirroredGameHref && (
                    <>
                      {' '}
                      <a href={mirroredGameHref} target="_blank" rel="noopener noreferrer" className={styles.sourceNoteLink}>
                        View on the tournament page <ExternalLink size={11} aria-hidden />
                      </a>
                    </>
                  )}
                </span>
              </div>
            )}

            {/* The organizer moved it since this device last showed it. Nothing was lost — the
                point is that the coach knows. Attendance is only worth re-checking when the DAY
                changed; a clock nudge doesn't invalidate anyone's reply. */}
            {selectedMoved && (
              <div className={`${styles.infoBanner} ${styles.movedNote}`} role="status">
                <strong>Moved from {fmtDate(selectedMoved.previous)} · {fmtTime(selectedMoved.previous)}.</strong>{' '}
                Your lineup and attendance moved with it — nothing to rebuild.
                {selectedMoved.dayChanged && (
                  <span className={styles.movedNoteWarn}> Attendance was taken for the old time — worth re-checking.</span>
                )}
              </div>
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
                tab. W/L/T is always derived from the two numbers (no manual override).
                On a MIRRORED game the score is the organizer's: shown, never editable (the API
                refuses it, and the next sync would overwrite a local edit anyway). */}
            {isGameEvent && mirroredGame && (
              <div className={styles.eventScoreLine}>
                {selectedEvent.teamScore != null ? (
                  <div className={styles.eventScore}>{scoreline(selectedEvent)}</div>
                ) : (
                  <p className={styles.formHint}>The final score arrives from the tournament once it’s posted.</p>
                )}
              </div>
            )}
            {isGameEvent && !mirroredGame && (
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
                          <span className={styles.resultBadge} style={{ alignSelf: 'flex-end', paddingBottom: '0.5rem', color: resultColor(r) }}>
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
                    {scoreline(selectedEvent)}
                    <button className={styles.eventScoreEdit} onClick={() => setScoreForm({ teamScore: String(selectedEvent.teamScore ?? ''), opponentScore: String(selectedEvent.opponentScore ?? '') })}>
                      Edit score
                    </button>
                    {/* The Scouting Book's capture door — a quiet link at the one moment every
                        coach reliably visits after every game (score entry), never a modal
                        (owner ruling). The tab itself is the capture sheet. */}
                    {scoutingKey && activeSlideTab !== 'scouting' && (
                      <button type="button" className={styles.scoutToastDoor} onClick={() => setSlideTab('scouting')}>
                        Add to the book on {selectedEvent.opponent} ›
                      </button>
                    )}
                  </div>
                ) : (
                  <button className={styles.eventScoreAdd} onClick={() => setScoreForm({ teamScore: '', opponentScore: '' })}>
                    + Add final score
                  </button>
                )}
              </div>
            )}

            {/* Chunk D 3.1 — "score entered → family email written". The highest-frequency
                moment in the chunk: the coach was already here. Shown for a mirrored game too
                (the organizer owns the score; the coach still owns telling their families). */}
            {postgameDraftHrefForSelected && !scoreForm && (
              <div className={styles.postgameDraft}>
                <div className={styles.postgameDraftText}>
                  <strong>Draft the family email</strong>
                  <span>Result and what&apos;s next, pre-written. You edit it before anything sends.</span>
                </div>
                <Link href={postgameDraftHrefForSelected} className={styles.postgameDraftBtn}>
                  Draft <ChevronRight size={14} aria-hidden />
                </Link>
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
                    {/* A rosterless team gets a reason, not a blank player picker (Chunk E WI-7). */}
                    {awardPlayers.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--white-55)' }}>🏆 Add players to your roster first — then you can give awards.</p>
                    ) : (
                      <button className={styles.btnSecondary} onClick={() => setGiveAwardOpen(true)}>🏆 Give an award</button>
                    )}
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

            {/* ── Practice plan (Practice Plans 1a) ──
                A SUMMARY plus a door, never the editor: the plan is written on its own drill-in
                where the focus rail and the rotation grid have room. Read rides `schedule` (this
                whole slide-over already does); writing is head-coach-only and the builder says so.
                The links section above is left completely alone — some coaches will keep their
                own document forever, and that is a legitimate outcome (D2).

                ⚠ The archive suppression here is DELETED (2026-08-18), and what it protected still
                holds: the practice-plan routes resolve the team's ACTIVE program year, so from a
                closed season "Open the plan →" errored and "Plan this practice →" invited a write
                into a finished season. This screen is no longer rendered for a closed season at
                all, so there is nothing left to hide — and READING a past plan has its own home,
                the practices shelf on the closed-season page, which reaches a year-aware read
                route rather than this one. */}
            {selectedEvent.eventType === 'practice' && (
              <div className={styles.formSection} style={{ marginTop: '0.75rem' }}>
                <h4 className={styles.formSectionTitle}>Practice plan</h4>
                {selectedEvent.practicePlan ? (
                  <>
                    <p className={styles.formHint}>
                      {summarizePracticePlan(selectedEvent.practicePlan)}
                      {selectedEvent.practicePlan.goal ? ` — ${selectedEvent.practicePlan.goal}` : ''}
                    </p>
                    <div className={styles.ppToolbar} style={{ marginBottom: 0 }}>
                      <Link href={`${base}/practice/${selectedEvent.id}/run`} className={styles.btnSecondary}>
                        Run practice →
                      </Link>
                      <Link href={`${base}/practice/${selectedEvent.id}`} className={styles.btnSecondary}>
                        Open the plan →
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <p className={styles.formHint}>
                      No plan yet — set out the blocks, stations and groups for this practice.
                    </p>
                    <Link href={`${base}/practice/${selectedEvent.id}`} className={styles.btnSecondary}>
                      Plan this practice →
                    </Link>
                  </>
                )}
              </div>
            )}

            {/* ── Share game link (Chunk D 1.8) ──
                Games only. Owner ruling #16: sharing ONE game is always its own deliberate act,
                separate from the team's Schedule visibility setting — which is why this is a
                per-event control and not something the visibility dropdown implies.
                Absent in an archive along with every other action below (Chunk F). */}
            {isGameEvent && canAddEvents && (
              <ShareGameLinkRow
                orgSlug={orgSlug}
                teamId={teamId}
                eventId={selectedEvent.id}
                initialShared={!!selectedEvent.familySharedAt}
              />
            )}

            {/* Actions — Edit (+ tournament Add game) lead; Cancel/Delete grouped to the right so
                the destructive pair is separated from the everyday action. Kept above the tabs.
                ⚠ Absent entirely in an archive (Chunk F): the server already refuses these for a
                past season, but a record that draws Edit / Cancel / Delete and then errors is
                worse than one that simply doesn't offer them. */}
            {canAddEvents && (
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
                  {/* A mirrored game isn't the coach's to cancel or delete — and it wouldn't
                      stick: the next sync would restore it from the organizer's schedule, minus
                      the attendance and lineup a delete would have cascaded away. */}
                  {mirroredGame ? (
                    <span className={styles.slideOverActionsRight}>
                      <span className={styles.formHint}>Only {selectedEvent.name} can cancel or remove this game.</span>
                    </span>
                  ) : (
                    <div className={styles.slideOverActionsRight}>
                      <button className={styles.btnGhost} disabled={saving} onClick={handleToggleCancel}>
                        {selectedEvent.status === 'cancelled' ? 'Restore event' : 'Cancel event'}
                      </button>
                      <button className={styles.btnDanger} onClick={() => setDeleteConfirm({ eventId: selectedEvent.id, isRecurring: selectedEvent.isRecurring })}>
                        Delete
                      </button>
                    </div>
                  )}
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
            )}

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

            {activeSlideTab === 'scouting' && scoutingKey && selectedEvent && (
              <OpponentScoutingPanel
                orgSlug={orgSlug}
                teamId={teamId}
                eventId={selectedEvent.id}
                opponentName={selectedEvent.opponent!}
                mirrored={isMirroredEvent(selectedEvent)}
              />
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
                  {/* Batch 4 (f8-2): the season report and the place attendance is recorded had
                      no link between them in either direction. This is the return trip. */}
                  <Link href={insightsSectionHref(base, 'attendance')} className={styles.btnGhost}>
                    Season attendance
                  </Link>
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

      {/* ── Schedule import (Chunk C, P1 #7) ───────────────────────────────── */}
      {importOpen && (
        <ScheduleImportSheet
          orgSlug={orgSlug}
          teamId={teamId}
          // Resolved to the ORG'S calendar day + clock here, because that is the day the coach's
          // spreadsheet means. A raw UTC slice would put every evening game on the wrong date and
          // so match the wrong row (C0).
          existing={events.map(e => {
            const zoned = utcToZonedInputs(e.startsAt);
            return {
              id: e.id,
              eventType: e.eventType,
              day: zoned.date,
              time: zoned.time,
              opponent: e.opponent ?? null,
              name: e.name,
              location: e.location ?? null,
              isMirrored: isMirroredEvent(e),
            };
          })}
          onClose={() => setImportOpen(false)}
          onImported={({ created, updated }) => {
            setImportOpen(false);
            setImportToast(
              [created ? `${created} added` : '', updated ? `${updated} updated` : '']
                .filter(Boolean).join(' · ') || 'Schedule updated',
            );
            void fetchEvents();
          }}
        />
      )}

      {/* ── Add / edit event modal ─────────────────────────────────────────── */}
      {showAddForm && (
        <div className={`${styles.modalOverlay} ${styles.sheetOnMobile}`} onClick={requestDiscardForm}>
          <div className={`${styles.modal} ${styles.eventFormModal} ${styles.modalFlushFooter}`} onClick={e => e.stopPropagation()}>
            <CoachModalHeader title={<>{editingEventId ? 'Edit' : 'Add'} {EVENT_LABELS[form.eventType]}</>} onClose={requestDiscardForm} />

            <div className={styles.formBody}>
              {/* Legend for the per-field <span className={styles.labelRequired}>*</span> markers below —
                  most fields on this form are optional, so only the few that block Save are flagged. */}
              <p className={styles.formHint}><span className={styles.labelRequired}>*</span> Required</p>

              {/* Type — changeable on add (keeps shared fields); fixed once an event exists. */}
              {!editingEventId && (
                <div className={styles.field}>
                  <label className={styles.label}>Event type</label>
                  <div className={styles.eventTypePicker} role="group" aria-label="Event type">
                    {(form.eventType === 'tournament_game' ? [...EVENT_TYPE_PILLS, 'tournament_game' as RepEventType] : EVENT_TYPE_PILLS).map(t => {
                      const active = form.eventType === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          className={`${styles.eventTypeOption} ${active ? styles.eventTypeOptionActive : ''}`}
                          style={active ? { borderColor: EVENT_COLORS[t], background: `color-mix(in srgb, ${EVENT_COLORS[t]} 10%, transparent)` } : undefined}
                          aria-pressed={active}
                          onClick={() => changeEventType(t)}
                        >
                          <span className={styles.eventTypeDot} style={{ background: EVENT_COLORS[t] }} />
                          {EVENT_LABELS[t]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TOURNAMENT — a tournament game must belong to a tournament, so a coach can't
                  create an orphaned, parent-less game slot. */}
              {addingTournamentGame && (
                <section className={styles.formSection}>
                  <h4 className={styles.formSectionTitle}>Tournament</h4>
                  {/* WI-2B: real FieldLogicHQ tournament games now appear on the schedule on their own,
                      so this hand-entered slot is for a tournament run somewhere else. */}
                  <p className={styles.formHint} style={{ marginTop: 0 }}>
                    Games from a FieldLogicHQ tournament show up on your schedule automatically — add one
                    here only for a tournament run somewhere else.
                  </p>
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
              {form.eventType === 'tournament_game' && editingEventId && !editingMirrored && (
                <section className={styles.formSection}>
                  <h4 className={styles.formSectionTitle}>Tournament</h4>
                  <p className={styles.formHint}>
                    Part of {events.find(e => e.id === form.parentEventId)?.name ?? 'a tournament'}.
                  </p>
                </section>
              )}

              {/* Batch 4 — RESTRICTED MODE for a mirrored tournament game. The organizer's facts
                  render as context, never as fields: a coach must not be able to make their own
                  calendar disagree with the tournament they're playing in, and the next sync would
                  overwrite an edit anyway. Arrival time sits here (not in the details fold) because
                  it is THE thing a coach sets on a tournament game. */}
              {editingMirrored ? (
                <>
                  <section className={styles.formSection}>
                    <h4 className={styles.formSectionTitle}>From the organizer</h4>
                    <p className={styles.formHint} style={{ marginTop: 0 }}>
                      Time, opponent and venue come from {form.name || 'the tournament'} and update themselves.
                    </p>
                    <dl className={styles.sourceFacts}>
                      <div><dt>When</dt><dd>{form.startsAt ? `${fmtDate(form.startsAt)} · ${fmtTime(form.startsAt)}` : 'To be scheduled'}</dd></div>
                      {form.opponent && (
                        <div><dt>Opponent</dt><dd>{form.opponent}{form.homeAway ? ` (${form.homeAway})` : ''}</dd></div>
                      )}
                      {form.location && <div><dt>Where</dt><dd>{form.location}</dd></div>}
                    </dl>
                  </section>
                  <section className={styles.formSection}>
                    <h4 className={styles.formSectionTitle}>Your game-day plan</h4>
                    <div className={styles.field}>
                      <label className={styles.label}>Arrival / call time</label>
                      <input className={styles.input} type="time" value={form.arrivalTime} onChange={e => setForm(f => ({ ...f, arrivalTime: e.target.value }))} />
                      <p className={styles.formHint}>A &ldquo;be there by&rdquo; time before the start — shows on the event and the calendar export.</p>
                    </div>
                  </section>
                </>
              ) : (
              <>
              {/* WHEN */}
              <section className={styles.formSection}>
                <h4 className={styles.formSectionTitle}>When</h4>
                {/* Repeat-weekly lives here (above the date layout), NOT inside a branch — toggling it
                    flips `recurringSeries`, which swaps the date layout below; keeping the checkbox in
                    one stable slot means it never remounts (no lost focus) as that swap happens. */}
                {needsRecurrence(form.eventType) && !editingEventId && (
                  <label className={styles.formCheck}>
                    <input type="checkbox" checked={form.isRecurring} onChange={e => setForm(f => ({ ...f, isRecurring: e.target.checked }))} />
                    <span>Repeat weekly</span>
                  </label>
                )}
                {form.eventType === 'external_tournament' ? (
                  <div className={styles.formSectionGrid}>
                    <div className={styles.field}>
                      <label className={styles.label}>Start date <span className={styles.labelRequired}>*</span></label>
                      <input className={styles.input} type="date" value={form.startsAt.slice(0, 10)} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value ? `${e.target.value}T00:00` : '' }))} />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>End date</label>
                      <input className={styles.input} type="date" value={form.endsAt.slice(0, 10)} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value ? `${e.target.value}T00:00` : '' }))} />
                    </div>
                  </div>
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
                    {/* Chunk C (P1 #6) — the occurrences, as rows, BEFORE any of them exist.
                        This replaced a one-line summary that was honest about the dates and
                        silent about the fact that one opponent was about to be stamped onto
                        every game. A recurring series and an imported file are the same shape:
                        a set of proposed events reviewed before commit. */}
                    {recurrenceDates.length > 0 && (
                      <div className={styles.occList}>
                        <div className={styles.occHead}>
                          <p className={styles.occCount}>
                            {keptDates.length} {recurrenceNoun}{keptDates.length === 1 ? '' : 's'}
                          </p>
                          <p className={styles.formHint}>
                            {recurrenceIsGame
                              ? 'Add an opponent to each. Nothing is saved until you tap Add.'
                              : 'Nothing is saved until you tap Add.'}
                          </p>
                        </div>
                        {recurrenceDates.map(date => {
                          const removed = removedDates.has(date);
                          return (
                            <div key={date} className={styles.occRow} data-removed={removed || undefined}>
                              <span className={styles.occDate}>{shortDate(date)}</span>
                              {removed ? (
                                <span className={styles.occRemoved}>Removed</span>
                              ) : recurrenceIsGame ? (
                                <input
                                  className={styles.input}
                                  placeholder="Opponent"
                                  aria-label={`Opponent on ${shortDate(date)}`}
                                  value={occurrenceOpponents[date] ?? ''}
                                  onChange={e => setOccurrenceOpponents(o => ({ ...o, [date]: e.target.value }))}
                                />
                              ) : (
                                <span className={styles.occPlain}>{fmtClock(form.startTime) || '—'}</span>
                              )}
                              <button
                                type="button"
                                className={styles.occAction}
                                aria-label={removed ? `Put ${shortDate(date)} back` : `Remove ${shortDate(date)}`}
                                onClick={() => setRemovedDates(prev => {
                                  const next = new Set(prev);
                                  if (removed) next.delete(date); else next.add(date);
                                  return next;
                                })}
                              >
                                {removed ? '↩' : '✕'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className={styles.formSectionGrid}>
                      <div className={styles.field}>
                        <label className={styles.label}>Starts <span className={styles.labelRequired}>*</span></label>
                        <input className={styles.input} type="datetime-local" value={form.startsAt} onChange={e => setStartsAt(e.target.value)} />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Ends</label>
                        <input className={styles.input} type="datetime-local" value={form.endsAt} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))} />
                      </div>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Arrival / call time</label>
                      <input className={styles.input} type="time" value={form.arrivalTime} onChange={e => setForm(f => ({ ...f, arrivalTime: e.target.value }))} />
                      <p className={styles.formHint}>A &ldquo;be there by&rdquo; time before the start — shows on the event and the calendar export.</p>
                    </div>
                  </>
                )}
              </section>

              {/* WHERE — the place NAME plus tap-to-fill "recent" chips. The field/diamond # and
                  street address moved into "Add details" (Batch 2, P0 #8): they matter on game day
                  but they don't belong in the four things every event needs. */}
              <section className={styles.formSection}>
                <h4 className={styles.formSectionTitle}>Where</h4>
                <div className={styles.field}>
                  <label className={styles.label}>Location</label>
                  <input
                    className={styles.input}
                    value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="e.g. Sherwood Park"
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
                </section>
              )}
              </>
              )}

              {/* EVERYTHING OPTIONAL — one disclosure instead of four always-open sections
                  (Batch 2, P0 #8). Children stay mounted while collapsed, so link validation still
                  runs and `resourcesInvalid` still blocks Save; the toggle's summary says so, since
                  a disabled Save with no visible reason is worse than a longer form. `defaultOpen`
                  is mount-only, so editing an event that already carries any of these opens the
                  group once and never fights the coach's own toggle afterwards. */}
              <CoachFormDisclosure
                label="Add details (optional)"
                title="Details"
                meta={eventDetailsSummary}
                defaultOpen={hasEventDetails}
              >
                <div className={styles.formSectionGrid}>
                  <div className={styles.field}>
                    <label className={styles.label}>Field / Diamond #</label>
                    <input
                      className={styles.input}
                      value={form.fieldNumber}
                      onChange={e => setForm(f => ({ ...f, fieldNumber: e.target.value }))}
                      placeholder="e.g. Diamond 2"
                    />
                  </div>
                  {needsOpponent(form.eventType) && (
                    <div className={styles.field}>
                      <label className={styles.label}>Uniform</label>
                      <input
                        className={styles.input}
                        value={form.uniform}
                        onChange={e => setForm(f => ({ ...f, uniform: e.target.value }))}
                        placeholder="e.g. Home whites"
                      />
                    </div>
                  )}
                </div>
                {/* Address is part of WHERE, which the organizer owns on a mirrored game. */}
                {!editingMirrored && (
                  <div className={styles.field}>
                    <label className={styles.label}>Address</label>
                    <input
                      className={styles.input}
                      value={form.locationAddress}
                      onChange={e => setForm(f => ({ ...f, locationAddress: e.target.value }))}
                      placeholder="Street address — powers the “open in Maps” link"
                    />
                  </div>
                )}

                {/* TAGS — a coach's own vocabulary ("Rivalry", "Top in the province"); games only.
                    Autocomplete-or-create: type to filter existing tags, tap to toggle, or create a
                    brand-new one on the spot. Pays off later in Season Review's "vs tag" report. */}
                {needsOpponent(form.eventType) && (
                  <section className={styles.formSubGroup}>
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
                <section className={styles.formSubGroup}>
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
                    type + opponent, so a custom label is an optional override, not a title field.
                    A mirrored game is named for its tournament and keeps that name. */}
                {!editingMirrored && (
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
                )}

                {/* NOTES */}
                <div className={styles.field}>
                  <label className={styles.label}>Notes</label>
                  <textarea className={styles.textarea} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Anything the team should know" />
                </div>
              </CoachFormDisclosure>
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
                <button className={styles.btnGhost} onClick={requestDiscardForm}>Cancel</button>
                <button
                  className={styles.btnPrimary}
                  disabled={saving || !formHasStart || tournamentParentMissing || resourcesInvalid}
                  onClick={editingEventId && editingRecurring ? () => setEditScopeOpen(true) : handleSave}
                >
                  {saving
                    ? 'Saving…'
                    : editingEventId
                      ? 'Save changes'
                      // Name the real count: a removed bye week means eleven, not twelve.
                      : recurringSeries && keptDates.length
                        ? `Add ${keptDates.length} ${recurrenceNoun}${keptDates.length === 1 ? '' : 's'}`
                        : 'Save Event'}
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
