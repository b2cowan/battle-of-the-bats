'use client';
import { use, useState, useEffect, useCallback } from 'react';
import { Calendar, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, CircleSlash, Clock3, Plus, Save, X, Trophy, Swords, Shield, Dumbbell, Users } from 'lucide-react';
import Link from 'next/link';
import { useCoaches } from '@/lib/coaches-context';
import { useOrg } from '@/lib/org-context';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import {
  downloadXLSX, generateCSV, downloadCSVBlob, downloadICS,
  buildFilename, serializeRows, serializeHeaders, downloadPDF, DEFAULT_PDF_SETTINGS,
  type ExportColumnDef, type ICSEventInput, type OrgPdfSettings,
} from '@/lib/export';
import ExportMenu from '@/components/admin/ExportMenu';
import styles from '../../../coaches.module.css';
import type {
  RepAttendanceStatus,
  RepLineupMode,
  RepRosterPlayer,
  RepTeamEvent,
  RepTeamEventAttendance,
  RepTeamLineup,
  RepTeamLineupEntry,
  RepEventType,
} from '@/lib/types';

// ── Export definition ─────────────────────────────────────────────────────────

const SCHEDULE_EXPORT_COLS: ExportColumnDef[] = [
  { label: 'Date',       key: 'date',      format: 'date' },
  { label: 'Time',       key: 'time',      format: 'text' },
  { label: 'Event Type', key: 'eventType', format: 'text' },
  { label: 'Name',       key: 'name',      format: 'text' },
  { label: 'Opponent',   key: 'opponent',  format: 'text' },
  { label: 'Location',   key: 'location',  format: 'text' },
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

const ATTENDANCE_OPTIONS: {
  value: RepAttendanceStatus;
  label: string;
  icon: React.ElementType;
}[] = [
  { value: 'unknown', label: 'Unknown', icon: CircleHelp },
  { value: 'attending', label: 'In', icon: CheckCircle2 },
  { value: 'absent', label: 'Out', icon: CircleSlash },
  { value: 'late', label: 'Late', icon: Clock3 },
];

const GAME_EVENT_TYPES: RepEventType[] = ['league_game', 'tournament_game', 'scrimmage'];
const LINEUP_POSITIONS = ['', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'DH', 'EH', 'Bench'];
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type ViewMode = 'list' | 'week' | 'month';

interface EventForm {
  eventType: RepEventType;
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
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

function isoFromInputs(date: string, time: string) {
  return `${date}T${time}`;
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

function EventChip({ event, onClick }: { event: RepTeamEvent; onClick: () => void }) {
  const color = EVENT_COLORS[event.eventType];
  const Icon = EVENT_ICONS[event.eventType];
  return (
    <button
      className={styles.eventChip}
      style={{ borderLeftColor: color }}
      onClick={onClick}
    >
      <Icon size={12} style={{ color, flexShrink: 0 }} />
      <span className={styles.eventChipTime}>
        {event.startsAt ? fmtTime(event.startsAt) : ''}
      </span>
      <span className={styles.eventChipName}>{event.name}</span>
      {event.result && (
        <span className={styles.eventChipResult} style={{
          color: event.result === 'win' ? '#22c55e' : event.result === 'loss' ? '#ef4444' : '#f59e0b',
        }}>
          {event.result.toUpperCase()}
        </span>
      )}
    </button>
  );
}

function WLTWidget({ events }: { events: RepTeamEvent[] }) {
  const games = events.filter(e => e.eventType === 'league_game' && e.result);
  const w = games.filter(e => e.result === 'win').length;
  const l = games.filter(e => e.result === 'loss').length;
  const t = games.filter(e => e.result === 'tie').length;
  if (!games.length) return null;
  return (
    <div className={styles.wltWidget}>
      <span className={styles.wltLabel}>Season Record</span>
      <div className={styles.wltRow}>
        <span className={styles.wltW}>{w}<small>W</small></span>
        <span className={styles.wltSep}>–</span>
        <span className={styles.wltL}>{l}<small>L</small></span>
        {t > 0 && <><span className={styles.wltSep}>–</span><span className={styles.wltT}>{t}<small>T</small></span></>}
      </div>
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

  const [events, setEvents] = useState<RepTeamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [view, setView] = useState<ViewMode>('list');
  const [cursorDate, setCursorDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [selectedEvent, setSelectedEvent] = useState<RepTeamEvent | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
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
  const [lineupMode, setLineupMode] = useState<RepLineupMode>('everyone_bats');
  const [lineupInningCount, setLineupInningCount] = useState(7);
  const [lineupNotes, setLineupNotes] = useState('');
  const [lineupRows, setLineupRows] = useState<LineupPlayerRow[]>([]);
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
    fetch('/api/admin/org/pdf-settings')
      .then(r => r.ok ? r.json() : {})
      .then(d => setPdfSettings(d as OrgPdfSettings))
      .catch(() => setPdfSettings(null));
  }, []);

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
          setLineupInningCount(data.lineup?.inningCount ?? 7);
          setLineupNotes(data.lineup?.notes ?? '');
          setLineupRows(buildLineupRows(players, data.entries ?? [], mode));
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
  }, [orgSlug, selectedEvent, teamId]);

  // ── Add event ───────────────────────────────────────────────────────────────

  function openAddForm(type: RepEventType) {
    setAddTypeMenuOpen(false);
    setForm({ ...BLANK_FORM, eventType: type });
    setSaveError('');
    setShowAddForm(true);
  }

  async function handleSave() {
    setSaveError('');
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        eventType: form.eventType,
        name: form.name.trim(),
        description: form.description.trim() || null,
        location: form.location.trim() || null,
        opponent: form.opponent.trim() || null,
        homeAway: form.homeAway || null,
        parentEventId: form.parentEventId || null,
      };

      if (form.eventType === 'practice' && form.isRecurring) {
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

  const [scoreForm, setScoreForm] = useState<{ homeScore: string; awayScore: string; result: string } | null>(null);

  function closeSelectedEvent() {
    setSelectedEvent(null);
    setScoreForm(null);
    setSaveError('');
    setLineupRows([]);
    setLineupError('');
    setLineupDirty(false);
  }

  async function handleScoreSave() {
    if (!selectedEvent || !scoreForm) return;
    setSaving(true);
    try {
      const hs = Number(scoreForm.homeScore);
      const as = Number(scoreForm.awayScore);
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${selectedEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeScore: hs,
          awayScore: as,
          result: scoreForm.result || (hs > as ? 'win' : hs < as ? 'loss' : 'tie'),
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

  function updateLineupRow(playerId: string, patch: Partial<LineupPlayerRow>) {
    setLineupRows(rows => rows.map(row => (
      row.player.id === playerId ? { ...row, ...patch } : row
    )));
    setLineupDirty(true);
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
    setLineupRows(rows => rows.map((row, index) => (
      mode === 'everyone_bats'
        ? { ...row, starter: true, battingOrder: row.battingOrder || String(index + 1) }
        : { ...row, starter: index < 9, battingOrder: index < 9 ? row.battingOrder || String(index + 1) : '' }
    )));
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
      if (data.entries) {
        setLineupRows(buildLineupRows(lineupRows.map(row => row.player), data.entries, data.lineup?.lineupMode ?? lineupMode));
      }
    } catch (e: unknown) {
      setLineupError(errorMessage(e, 'Lineup save failed'));
    } finally {
      setLineupSaving(false);
    }
  }

  async function handleLineupPDF() {
    if (!selectedEvent || lineupRows.length === 0) return;
    const settings: OrgPdfSettings = {
      ...DEFAULT_PDF_SETTINGS,
      ...(pdfSettings && Object.keys(pdfSettings).length > 0 ? pdfSettings : {}),
      orientation: 'landscape',
      reportDensity: 'compact',
    };
    const inningHeaders = Array.from({ length: lineupInningCount }, (_, index) => `${index + 1}`);
    const headers = ['Bat', 'Player', 'Role', ...inningHeaders, 'Notes'];
    const rows = sortLineupRows(lineupRows).map(row => [
      lineupMode === 'nine_player' && !row.starter ? '' : row.battingOrder,
      playerDisplayName(row.player),
      lineupMode === 'nine_player' ? row.starter ? 'Starter' : 'Bench' : 'Hitter',
      ...inningHeaders.map(inning => row.inningPositions[inning] || ''),
      row.notes,
    ]);
    const teamName = assignment?.teamName ?? teamId;
    await downloadPDF(
      buildFilename({ org: currentOrg?.slug ?? orgSlug, dataset: 'lineup', scope: selectedEvent.name || teamName }, 'pdf'),
      lineupMode === 'nine_player' ? '9 Player Ball Lineup' : 'Everyone Bats Lineup',
      `${teamName} - ${selectedEvent.name} - ${fmtDate(selectedEvent.startsAt)}`,
      headers,
      rows,
      settings,
    );
  }

  function buildExportRows() {
    return events.map(e => ({
      date:      e.startsAt ? e.startsAt.slice(0, 10) : '',
      time:      e.startsAt ? new Date(e.startsAt).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true }) : '',
      eventType: EVENT_LABELS[e.eventType] ?? e.eventType,
      name:      e.name,
      opponent:  e.opponent ?? '',
      location:  e.location ?? '',
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
      .map(e => ({
        gameId:    e.id,
        title:     e.opponent
          ? `${e.name} vs ${e.opponent}`
          : e.name,
        date:      e.startsAt!.slice(0, 10),
        time:      new Date(e.startsAt!).toTimeString().slice(0, 5),
        durationHours: e.endsAt
          ? Math.max(0.5, (new Date(e.endsAt).getTime() - new Date(e.startsAt!).getTime()) / 3600000)
          : 2,
        location:  e.location ?? undefined,
        description: e.description ?? undefined,
      }));
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
              <EventChip key={e.id} event={e} onClick={() => setSelectedEvent(e)} />
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
          const dayEvents = events.filter(e => e.startsAt?.slice(0, 10) === key);
          return (
            <div key={key} className={styles.calWeekDay}>
              <div className={styles.calWeekDayLabel}>
                {day.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <div className={styles.calWeekDayEvents}>
                {dayEvents.length === 0
                  ? <span className={styles.calWeekEmpty}>—</span>
                  : dayEvents.map(e => (
                    <EventChip key={e.id} event={e} onClick={() => setSelectedEvent(e)} />
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
          const dayEvents = events.filter(e => e.startsAt?.slice(0, 10) === key);
          const isToday = key === new Date().toISOString().slice(0, 10);
          return (
            <div key={key} className={`${styles.calMonthCell} ${isToday ? styles.calMonthCellToday : ''}`}>
              <span className={styles.calMonthDayNum}>{day.getDate()}</span>
              <div className={styles.calMonthDayEvents}>
                {dayEvents.slice(0, 3).map(e => (
                  <button
                    key={e.id}
                    className={styles.calMonthEventDot}
                    style={{ background: EVENT_COLORS[e.eventType] }}
                    title={e.name}
                    onClick={() => setSelectedEvent(e)}
                  >
                    {e.name.slice(0, 14)}
                  </button>
                ))}
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

  const needsOpponent = (t: RepEventType) => ['tournament_game', 'scrimmage', 'league_game'].includes(t);
  const needsRecurrence = (t: RepEventType) => t === 'practice';

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
            <button className="btn btn-lime" onClick={() => setAddTypeMenuOpen(v => !v)}>
              <Plus size={15} /> Add Event
            </button>
            {addTypeMenuOpen && (
              <div className={styles.addEventMenu}>
                {(Object.keys(EVENT_LABELS) as RepEventType[]).map(t => {
                  const Icon = EVENT_ICONS[t];
                  return (
                    <button key={t} className={styles.addEventMenuItem} onClick={() => openAddForm(t)}>
                      <Icon size={14} style={{ color: EVENT_COLORS[t] }} />
                      {EVENT_LABELS[t]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* W/L/T widget */}
      <WLTWidget events={events} />

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
        <div className={styles.modalOverlay} onClick={closeSelectedEvent}>
          <div className={styles.slideOver} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {(() => { const Icon = EVENT_ICONS[selectedEvent.eventType]; return <Icon size={16} style={{ color: EVENT_COLORS[selectedEvent.eventType] }} />; })()}
                <span className={styles.eventTypePill} style={{ background: EVENT_COLORS[selectedEvent.eventType] + '22', color: EVENT_COLORS[selectedEvent.eventType] }}>
                  {EVENT_LABELS[selectedEvent.eventType]}
                </span>
              </div>
              <button className={styles.modalCloseBtn} onClick={closeSelectedEvent}>
                <X size={18} />
              </button>
            </div>
            <h2 className={styles.slideOverTitle}>{selectedEvent.name}</h2>

            <dl className={styles.slideOverDetails}>
              {selectedEvent.startsAt && (
                <>
                  <dt>Date</dt>
                  <dd>{fmtDate(selectedEvent.startsAt)}</dd>
                  <dt>Time</dt>
                  <dd>{fmtTime(selectedEvent.startsAt)}{selectedEvent.endsAt ? ` – ${fmtTime(selectedEvent.endsAt)}` : ''}</dd>
                </>
              )}
              {selectedEvent.location && <><dt>Location</dt><dd>{selectedEvent.location}</dd></>}
              {selectedEvent.opponent && <><dt>Opponent</dt><dd>{selectedEvent.opponent}</dd></>}
              {selectedEvent.homeAway && <><dt>Home/Away</dt><dd style={{ textTransform: 'capitalize' }}>{selectedEvent.homeAway}</dd></>}
              {selectedEvent.description && <><dt>Notes</dt><dd>{selectedEvent.description}</dd></>}
              {selectedEvent.isRecurring && <><dt>Recurring</dt><dd>Yes (weekly practice)</dd></>}
            </dl>

            <div className={styles.attendanceSection}>
              <div className={styles.attendanceHeader}>
                <div>
                  <h3 className={styles.attendanceTitle}>Attendance</h3>
                  <p className={styles.attendanceSummary}>
                    {attendanceRows.length
                      ? `${attendanceRows.filter(row => row.status === 'attending').length} in, ${attendanceRows.filter(row => row.status === 'absent').length} out, ${attendanceRows.filter(row => row.status === 'late').length} late`
                      : 'No active players available'}
                  </p>
                </div>
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

              {attendanceLoading ? (
                <div className={styles.attendanceEmpty}>Loading attendance...</div>
              ) : attendanceRows.length === 0 ? (
                <div className={styles.attendanceEmpty}>Add active players to the roster before marking attendance.</div>
              ) : (
                <div className={styles.attendanceList}>
                  {attendanceRows.map(row => (
                    <div key={row.player.id} className={styles.attendanceRow}>
                      <div className={styles.attendancePlayer}>
                        <span className={styles.attendancePlayerName}>{playerDisplayName(row.player)}</span>
                      </div>
                      <div className={styles.attendanceStatusGroup} role="group" aria-label={`Attendance for ${playerDisplayName(row.player)}`}>
                        {ATTENDANCE_OPTIONS.map(option => {
                          const Icon = option.icon;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={row.status === option.value}
                              className={`${styles.attendanceStatusBtn} ${row.status === option.value ? styles.attendanceStatusBtnActive : ''}`}
                              data-status={option.value}
                              onClick={() => setPlayerAttendance(row.player.id, { status: option.value })}
                            >
                              <Icon size={13} />
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                      <input
                        className={styles.attendanceNoteInput}
                        value={row.note}
                        onChange={e => setPlayerAttendance(row.player.id, { note: e.target.value })}
                        placeholder="Note"
                        aria-label={`Attendance note for ${playerDisplayName(row.player)}`}
                        maxLength={500}
                      />
                    </div>
                  ))}
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

            {isLineupEvent(selectedEvent) && (
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
                  </div>
                </div>

                {lineupLoading ? (
                  <div className={styles.attendanceEmpty}>Loading lineup...</div>
                ) : lineupRows.length === 0 ? (
                  <div className={styles.attendanceEmpty}>Add active players to the roster before creating a lineup.</div>
                ) : (
                  <div className={styles.lineupTableWrap}>
                    <table className={styles.lineupTable}>
                      <thead>
                        <tr>
                          <th>Bat</th>
                          {lineupMode === 'nine_player' && <th>Start</th>}
                          <th>Player</th>
                          {Array.from({ length: lineupInningCount }, (_, index) => (
                            <th key={index + 1}>{index + 1}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortLineupRows(lineupRows).map(row => (
                          <tr key={row.player.id}>
                            <td>
                              <input
                                className={styles.lineupOrderInput}
                                type="number"
                                min={1}
                                max={99}
                                value={lineupMode === 'nine_player' && !row.starter ? '' : row.battingOrder}
                                disabled={lineupMode === 'nine_player' && !row.starter}
                                onChange={e => updateLineupRow(row.player.id, { battingOrder: e.target.value })}
                                aria-label={`Batting order for ${playerDisplayName(row.player)}`}
                              />
                            </td>
                            {lineupMode === 'nine_player' && (
                              <td>
                                <input
                                  type="checkbox"
                                  checked={row.starter}
                                  onChange={e => updateLineupRow(row.player.id, {
                                    starter: e.target.checked,
                                    battingOrder: e.target.checked && !row.battingOrder
                                      ? String(Math.min(lineupRows.filter(r => r.starter).length + 1, 9))
                                      : row.battingOrder,
                                  })}
                                  aria-label={`Starter for ${playerDisplayName(row.player)}`}
                                />
                              </td>
                            )}
                            <td className={styles.lineupPlayerCell}>
                              <span>{playerDisplayName(row.player)}</span>
                              {(row.player.primaryPosition || row.player.secondaryPosition) && (
                                <small>{[row.player.primaryPosition, row.player.secondaryPosition].filter(Boolean).join(' / ')}</small>
                              )}
                            </td>
                            {Array.from({ length: lineupInningCount }, (_, index) => {
                              const inning = index + 1;
                              return (
                                <td key={inning}>
                                  <select
                                    className={styles.lineupPositionSelect}
                                    value={row.inningPositions[String(inning)] ?? ''}
                                    onChange={e => updateLineupPosition(row.player.id, inning, e.target.value)}
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <textarea
                  className={styles.textarea}
                  rows={2}
                  value={lineupNotes}
                  onChange={e => { setLineupNotes(e.target.value); setLineupDirty(true); }}
                  placeholder="Lineup notes"
                  maxLength={1000}
                />

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
                    className={styles.btnGhost}
                    disabled={lineupRows.length === 0}
                    onClick={handleLineupPDF}
                  >
                    Lineup PDF
                  </button>
                  {lineupDirty && <span className={styles.attendanceUnsaved}>Unsaved changes</span>}
                </div>
                {lineupError && <p className={styles.errorText}>{lineupError}</p>}
              </div>
            )}

            {/* Score */}
            {(selectedEvent.eventType === 'league_game' || selectedEvent.eventType === 'tournament_game' || selectedEvent.eventType === 'scrimmage') && (
              <div className={styles.scoreSection}>
                {selectedEvent.homeScore != null ? (
                  <div className={styles.scoreDisplay}>
                    <span className={styles.scoreNum} style={{ color: '#22c55e' }}>{selectedEvent.homeScore}</span>
                    <span className={styles.scoreSep}>–</span>
                    <span className={styles.scoreNum} style={{ color: '#ef4444' }}>{selectedEvent.awayScore}</span>
                    {selectedEvent.result && (
                      <span className={styles.resultBadge} style={{
                        color: selectedEvent.result === 'win' ? '#22c55e' : selectedEvent.result === 'loss' ? '#ef4444' : '#f59e0b',
                      }}>
                        {selectedEvent.result.toUpperCase()}
                      </span>
                    )}
                    <button className={styles.btnGhost} onClick={() => setScoreForm({ homeScore: String(selectedEvent.homeScore ?? ''), awayScore: String(selectedEvent.awayScore ?? ''), result: selectedEvent.result ?? '' })}>
                      Edit score
                    </button>
                  </div>
                ) : (
                  <button className={styles.btnSecondary} onClick={() => setScoreForm({ homeScore: '', awayScore: '', result: '' })}>
                    Enter score
                  </button>
                )}
                {scoreForm && (
                  <div className={styles.scoreForm}>
                    <div className={styles.scoreFormRow}>
                      <input className={styles.input} style={{ width: '5rem' }} type="number" min={0} placeholder="Home" value={scoreForm.homeScore} onChange={e => setScoreForm(s => s && ({ ...s, homeScore: e.target.value }))} />
                      <span>–</span>
                      <input className={styles.input} style={{ width: '5rem' }} type="number" min={0} placeholder="Away" value={scoreForm.awayScore} onChange={e => setScoreForm(s => s && ({ ...s, awayScore: e.target.value }))} />
                      <select className={styles.select} style={{ width: '8rem' }} value={scoreForm.result} onChange={e => setScoreForm(s => s && ({ ...s, result: e.target.value }))}>
                        <option value="">Auto</option>
                        <option value="win">Win</option>
                        <option value="loss">Loss</option>
                        <option value="tie">Tie</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className={styles.btnPrimary} disabled={saving} onClick={handleScoreSave}>Save</button>
                      <button className={styles.btnGhost} onClick={() => setScoreForm(null)}>Cancel</button>
                    </div>
                    {saveError && <p className={styles.errorText}>{saveError}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Add game slot for tournaments */}
            {selectedEvent.eventType === 'external_tournament' && (
              <div style={{ marginTop: '1rem' }}>
                <button className={styles.btnSecondary} onClick={() => {
                  setSelectedEvent(null);
                  openAddForm('tournament_game');
                  setForm(f => ({ ...f, parentEventId: selectedEvent.id, name: `${selectedEvent.name} – Game` }));
                }}>
                  + Add Game Slot
                </button>
              </div>
            )}

            {/* Delete */}
            <div className={styles.slideOverActions}>
              {!deleteConfirm ? (
                <button className={styles.btnDanger} onClick={() => setDeleteConfirm({ eventId: selectedEvent.id, isRecurring: selectedEvent.isRecurring })}>
                  Delete
                </button>
              ) : (
                <div className={styles.deleteConfirm}>
                  <p className={styles.deleteConfirmMsg}>
                    {deleteConfirm.isRecurring
                      ? 'Delete this recurring practice:'
                      : `Delete "${selectedEvent.name}"?`
                    }
                  </p>
                  <div className={styles.deleteConfirmBtns}>
                    {deleteConfirm.isRecurring ? (
                      <>
                        <button className={styles.btnDanger} disabled={saving} onClick={() => handleDelete(deleteConfirm.eventId, 'one')}>This only</button>
                        <button className={styles.btnDanger} disabled={saving} onClick={() => handleDelete(deleteConfirm.eventId, 'remaining')}>This & future</button>
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
          </div>
        </div>
      )}

      {/* ── Add event modal ────────────────────────────────────────────────── */}
      {showAddForm && (
        <div className={styles.modalOverlay} onClick={() => setShowAddForm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Add {EVENT_LABELS[form.eventType]}</h3>
              <button className={styles.modalCloseBtn} onClick={() => setShowAddForm(false)}><X size={16} /></button>
            </div>

            <div className={styles.formGrid}>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label}>Name *</label>
                <input className={styles.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={`${EVENT_LABELS[form.eventType]} name`} />
              </div>

              {needsRecurrence(form.eventType) && (
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>
                    <input type="checkbox" checked={form.isRecurring} onChange={e => setForm(f => ({ ...f, isRecurring: e.target.checked }))} style={{ marginRight: '0.4rem' }} />
                    Recurring (weekly)
                  </label>
                </div>
              )}

              {form.eventType === 'practice' && form.isRecurring ? (
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>Day of Week *</label>
                    <select className={styles.select} value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: e.target.value }))}>
                      {DAYS_OF_WEEK.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Start Time *</label>
                    <input className={styles.input} type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>End Time</label>
                    <input className={styles.input} type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Start Date *</label>
                    <input className={styles.input} type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>End Date *</label>
                    <input className={styles.input} type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>Start *</label>
                    <input className={styles.input} type="datetime-local" value={form.startsAt} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>End</label>
                    <input className={styles.input} type="datetime-local" value={form.endsAt} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))} />
                  </div>
                </>
              )}

              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label}>Location</label>
                <input className={styles.input} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Field, arena, etc." />
              </div>

              {needsOpponent(form.eventType) && (
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>Opponent</label>
                    <input className={styles.input} value={form.opponent} onChange={e => setForm(f => ({ ...f, opponent: e.target.value }))} placeholder="Team name" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Home / Away</label>
                    <select className={styles.select} value={form.homeAway} onChange={e => setForm(f => ({ ...f, homeAway: e.target.value }))}>
                      <option value="">—</option>
                      <option value="home">Home</option>
                      <option value="away">Away</option>
                      <option value="neutral">Neutral</option>
                    </select>
                  </div>
                </>
              )}

              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label}>Notes</label>
                <textarea className={styles.textarea} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
              </div>
            </div>

            {saveError && <p className={styles.errorText} style={{ marginTop: '0.75rem' }}>{saveError}</p>}

            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={() => setShowAddForm(false)}>Cancel</button>
              <button className={styles.btnPrimary} disabled={saving || !form.name.trim()} onClick={handleSave}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
