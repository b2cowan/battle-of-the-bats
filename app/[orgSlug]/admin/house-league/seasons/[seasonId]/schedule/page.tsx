'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Calendar, CalendarClock, CalendarDays, CalendarRange, Clock, List, MoreHorizontal, Plus, X, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { useOrg } from '@/lib/org-context';
import { ORG_TIME_ZONE, mondayOfDay, orgDayKey, utcToZonedInputs, tournamentToday } from '@/lib/timezone';
import { isFreeFloorLeague } from '@/lib/free-floor';
import { useHouseLeagueAccess, useSeasonAccess } from '@/components/admin/kit/useHouseLeagueSeasons';
import { fieldNounFor } from '@/lib/sports';
import FeedbackModal from '@/components/FeedbackModal';
import WhereField from '@/components/venue/WhereField';
import { EMPTY_WHERE, clubVenueOptions, whereLibraryBody, whereOfLibraryRow, type WhereValue } from '@/lib/where-field';
import { permitAfterSave } from '@/lib/permit-words';
import {
  downloadXLSX, generateCSV, downloadCSVBlob, downloadICSFromInstants, houseLeagueCalendarEntries,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
} from '@/lib/export';
import { pluralize } from '@/lib/utils';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { monthWords } from '@/lib/calendar-recipe';
import { EVENT_COLORS } from '@/lib/coach-schedule-vocab';
import { rangeFor, stepCursor, type CalendarView } from '@/lib/club-calendar-view';
import { GAME_WINDOW_WORDS, SEASON_SCHEDULE_WORDS as W, seasonCalendar, seasonClashes, seasonOpeningDay, type SeasonBooking, type SeasonGameSlot } from '@/lib/league-season-calendar';
import ExportMenu from '@/components/admin/ExportMenu';
import { CoachListToolbar } from '@/components/coaches/kit';
import MultiSelectDropdown from '@/components/coaches/MultiSelectDropdown';
import SingleSelectDropdown from '@/components/coaches/SingleSelectDropdown';
import FilterGroup from '@/components/coaches/FilterGroup';
import { WeekView } from '@/components/admin/kit/club/ClubCalendarViews';
import { CalendarViewSwitch, ScheduleDateNav } from '@/components/coaches/ScheduleCalendarViews';
import { NeedsDateFold, SeasonListView, SeasonMonthView } from '@/components/admin/kit/club/league/schedule/SeasonScheduleViews';
import GameWindow from '@/components/admin/kit/club/league/schedule/GameWindow';
import GenerateGamesWindow from '@/components/admin/kit/club/league/schedule/GenerateGamesWindow';
import PublishScheduleWindow from '@/components/admin/kit/club/league/schedule/PublishScheduleWindow';
import SchedulePublishLine, { showPublishButton, type SchedulePublishing } from '@/components/admin/kit/club/league/schedule/SchedulePublishLine';
import { CHANGES_TO_SEND_WORDS, SCHEDULE_PUBLISH_WORDS } from '@/lib/league-schedule-words';
import ChangesToSendWindow from '@/components/admin/kit/club/league/schedule/ChangesToSendWindow';
import cts from '@/components/admin/kit/club/league/schedule/ChangesToSend.module.css';
import type { ChangeKind, GameSnapshot } from '@/lib/league-game-changes';
import LeagueHealthWindow from '@/components/admin/kit/club/league/schedule/LeagueHealthWindow';
import { PermitWindow } from '@/components/admin/kit/club/PermitWindows';
import type { PermitOutside } from '@/lib/permit-words';
import HealthButton from '@/components/admin/tournament/HealthButton';
import { GAME_DAY_WORDS } from '@/lib/game-day-words';
import { SCHEDULE_DAY_WORDS } from '@/lib/schedule-words';
import {
  buildLeagueScheduleHealth, leagueHealthGameOf, leagueHealthPracticeOf, type LeagueHealthIssue,
} from '@/lib/league-schedule-health';
import { clubSchedulerOn } from '@/lib/club-schedule-gate';
import type { Through } from '@/lib/league-game-generator';
import { useLeagueLine } from '@/components/admin/kit/club/league/schedule/useLeagueLine';
import cal from '@/components/admin/kit/club/ClubCalendar.module.css';
import coach from '@/app/[orgSlug]/coaches/coaches.module.css';
import { CoachToolbarMenu, CoachToolbarMenuHeading, CoachToolbarMenuItem, CoachToolbarMenuSeparator } from '@/components/coaches/CoachToolbarMenu';
import tb from '@/components/admin/tournament/AdminToolbar.module.css';
import HouseLeagueTimeWindow from '@/components/admin/kit/club/league/time/HouseLeagueTimeWindow';
import HouseLeagueTimeLine, { showTimeLine, useBuildsSchedules } from '@/components/admin/kit/club/league/time/HouseLeagueTimeLine';
import { LEAGUE_TIME_WORDS, type LeagueTime, type LeagueUse } from '@/lib/league-time';
import PracticeTimeWindow from '@/components/admin/kit/club/league/time/PracticeTimeWindow';
import PracticeWindow from '@/components/admin/kit/club/league/practices/PracticeWindow';
import { PRACTICE_TIME_WORDS, PRACTICE_WINDOW_WORDS } from '@/lib/league-practice-time';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { LoadFailed, useDeferredLoad, useLatestRead } from '@/components/admin/kit/club/RepKit';
import { useKitButtons, useKitStyle } from '@/components/admin/AdminKitProvider';
import { KIT_INK, KIT_LINE, KIT_SURFACE } from '@/components/admin/kit/kit-inline';
import styles from '../../../house-league.module.css';
import type { ClubVenueOption, LeagueDivision, LeagueTeam, LeagueGame, LeagueGameStatus, LeaguePractice, OrgVenue } from '@/lib/types';
import LoadingState from '@/components/shared/LoadingState';
import DateInput from '@/components/shared/DateInput';
import TimeInput from '@/components/shared/TimeInput';

// ── Export definition ─────────────────────────────────────────────────────────

const SCHEDULE_EXPORT_COLS: ExportColumnDef[] = [
  { label: 'Date',      key: 'date',     format: 'date' },
  { label: 'Time',      key: 'time',     format: 'text' },
  { label: 'Home Team', key: 'homeTeam', format: 'text' },
  { label: 'Away Team', key: 'awayTeam', format: 'text' },
  { label: 'Location',  key: 'location', format: 'text' },
  { label: 'Status',    key: 'status',   format: 'text' },
  { label: 'Score',     key: 'score',    format: 'text' },
];

// ── Types ──────────────────────────────────────────────────────────────────────

interface SeasonInfo { id: string; name: string; sport: string | null; status: string; }

interface PreviewGame {
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt: string;
  location: string | null;
}

interface GenerateConfig {
  startDate: string;
  gamesPerWeek: number;
  gameTime: string;
  where: WhereValue;
}

interface PracticeForm {
  /** The team it is for — chosen on Add (the schedule draws every team's practices together), fixed on an edit. */
  teamId: string;
  recurring: boolean;
  scheduledDate: string;
  dayOfWeek: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  where: WhereValue;
  notes: string;
}

interface FeedbackState {
  isOpen: boolean; title: string; message: string;
  type: 'success' | 'danger' | 'info';
  /** A question rather than a notice: the act, and its two words. */
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): { date: string; time: string } {
  // J3-047: render in the org zone (America/Toronto V1) so every admin sees the same
  // wall-clock that was set, regardless of their browser's timezone.
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-CA', { timeZone: ORG_TIME_ZONE, weekday: 'short', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString('en-CA', { timeZone: ORG_TIME_ZONE, hour: 'numeric', minute: '2-digit', hour12: true }),
  };
}

function isoToDateInput(iso: string): string {
  // J3-047: prefill in the org zone (America/Toronto V1), not UTC/browser-local, so the
  // reschedule form round-trips the wall-clock the admin set (matches zonedWallClockToUtc).
  return utcToZonedInputs(iso).date;
}

const STATUS_LABELS: Record<LeagueGameStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── Where (Club Tier Stage 6a, Ask 13) ────────────────────────────────────────

/*
 * ⚰ `FieldPicker`, `venueKeyFor` and `decodeVenueKey` (→ 2026-10-08, Club Tier Stage 6a, Ask 13): one select of
 * "venue — surface" with "(any surface)" rows and "Somewhere else (type it)". Every form that asks where now wears
 * the ONE Venue field (`components/venue/WhereField.tsx`): Venue (the club's venues, then typed words), then the
 * facility under the season's sport word with "Not set" first — the old "(any surface)". House league's one pick
 * became two; the venue it uses every night is the short second pick. Reading a stored booking back into the field
 * and writing it out (one line of text beside the library links) are the field module's (`lib/where-field.ts`).
 */

/** The Venue field on house league's windows (the old look keeps its own control classes). */
function LeagueWhere({
  venues, sport, value, onChange, orgSlug, canManage, disabled, line, idPrefix,
}: {
  venues: ClubVenueOption[];
  sport: string | null | undefined;
  value: WhereValue;
  onChange: (next: WhereValue) => void;
  orgSlug: string;
  canManage: boolean;
  disabled?: boolean;
  line?: React.ReactNode;
  idPrefix: string;
}) {
  const noun = fieldNounFor(sport);
  const inClub = venues.length > 0;
  return (
    <div className={`${styles.field} ${styles.formGridFull}`}>
      <WhereField
        idPrefix={idPrefix}
        sport={sport}
        value={value}
        onChange={onChange}
        clubVenues={venues}
        inClub={inClub}
        disabled={disabled}
        classes={{ field: styles.field, label: styles.label, input: styles.input, select: styles.select, hint: styles.hint }}
        line={line}
        footHint={!inClub && canManage ? (
          <p className={styles.hint}>
            Typed locations can&apos;t be checked for double-bookings.{' '}
            <Link href={`/${orgSlug}/admin/org/venues`} style={{ color: 'var(--logic-lime)' }}>
              Set up your {noun.toLowerCase()}s once
            </Link>{' '}
            to pick them from a list.
          </p>
        ) : null}
      />
    </div>
  );
}

const BTN_PRIMARY: React.CSSProperties = {
  background: 'var(--logic-lime)', color: '#1a1f2e', border: 'none',
  borderRadius: '2px', padding: '0.4rem 0.85rem', fontSize: '0.82rem', fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
};
const BTN_SECONDARY: React.CSSProperties = {
  background: 'var(--white-5)', color: 'var(--white-70)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: '2px',
  padding: '0.4rem 0.85rem', fontSize: '0.82rem', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
};
const BTN_DANGER: React.CSSProperties = {
  background: 'rgba(var(--danger-rgb),0.1)', color: '#f87171',
  border: '1px solid rgba(var(--danger-rgb),0.25)', borderRadius: '2px',
  padding: '0.4rem 0.85rem', fontSize: '0.82rem', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
};
// The kit's buttons wear these while the Admin Design Continuity switch is on (useKitButtons).
const LEGACY_BUTTONS = { primary: BTN_PRIMARY, secondary: BTN_SECONDARY, danger: BTN_DANGER };
/** Create, greyed while the league refuses the slot (specimen 3): these buttons are styled inline, so `disabled` alone
 *  changes nothing anyone can see. */
const REFUSED_LOOK: React.CSSProperties = { opacity: 0.45, cursor: 'not-allowed' };

// ── Generate Modal ────────────────────────────────────────────────────────────

function GenerateModal({
  divisionName,
  teams,
  venues,
  sport,
  orgSlug,
  saving,
  onPreview,
  onSave,
  onClose,
}: {
  divisionName: string;
  teams: LeagueTeam[];
  venues: ClubVenueOption[];
  sport: string | null | undefined;
  orgSlug: string;
  saving: boolean;
  onPreview: (cfg: GenerateConfig) => Promise<PreviewGame[]>;
  onSave: (cfg: GenerateConfig) => Promise<void>;
  onClose: () => void;
}) {
  const B = useKitButtons(LEGACY_BUTTONS);
  const kx = useKitStyle();
  const today = tournamentToday();
  const [config, setConfig] = useState<GenerateConfig>({
    startDate: today, gamesPerWeek: 1, gameTime: '18:00', where: EMPTY_WHERE,
  });
  const [preview, setPreview] = useState<PreviewGame[] | null>(null);
  const [previewing, setPreviewing] = useState(false);

  function setCfg<K extends keyof GenerateConfig>(k: K, v: GenerateConfig[K]) {
    setConfig(c => ({ ...c, [k]: v }));
    setPreview(null);
  }

  async function handlePreview() {
    setPreviewing(true);
    try { setPreview(await onPreview(config)); } finally { setPreviewing(false); }
  }

  const teamMap = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);

  return (
    <div className={styles.modalOverlay} onPointerDown={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className={`${styles.modal} ${styles.generateModal}`}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Generate schedule — {divisionName}</h2>
          <button className={styles.modalCloseBtn} onClick={onClose} disabled={saving}><X size={18} /></button>
        </div>

        <p style={kx({ fontSize: '0.82rem', color: 'var(--white-45)', marginBottom: '1rem' }, KIT_INK.tertiary)}>
          Round-robin: {teams.length} teams · {teams.length % 2 === 0 ? teams.length - 1 : teams.length} rounds · every team plays every other team once.
        </p>

        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label}>First game date</label>
            <DateInput className={styles.input} value={config.startDate} onChange={v => setCfg('startDate', v)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Default game time</label>
            <TimeInput className={styles.input} value={config.gameTime} onChange={v => setCfg('gameTime', v)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Rounds per week</label>
            <input type="number" min={1} max={7} className={styles.input} value={config.gamesPerWeek}
              onChange={e => setCfg('gamesPerWeek', Math.max(1, Number(e.target.value)))} />
            <p className={styles.hint}>How many game nights per week</p>
          </div>
          {/* The generator's default venue — the same Venue field (Ask 13). Its clashes are counted in the
              after-save summary, with the club's other programs too; it never refuses. */}
          <LeagueWhere
            idPrefix="hl-gen"
            venues={venues}
            sport={sport}
            value={config.where}
            onChange={w => setCfg('where', w)}
            orgSlug={orgSlug}
            canManage
          />
        </div>

        {!preview && (
          <div style={{ textAlign: 'center', padding: '0.5rem 0 1rem' }}>
            <button style={B.secondary} onClick={handlePreview} disabled={previewing || !config.startDate}>
              {previewing ? 'Generating…' : 'Preview schedule'}
            </button>
          </div>
        )}

        {preview && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h3 style={kx({ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: 'var(--white-40)' }, { fontFamily: 'var(--font-sans, system-ui, sans-serif)', fontSize: 'var(--type-heading)', letterSpacing: 'normal', textTransform: 'none', color: 'var(--text-primary)' })}>
                Preview — {preview.length} games
              </h3>
              <button style={{ ...B.secondary, padding: '0.2rem 0.5rem', fontSize: '0.72rem' }} onClick={() => setPreview(null)}>
                Re-configure
              </button>
            </div>
            <div style={kx({ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--white-8)', borderRadius: '2px' }, { border: KIT_LINE, borderRadius: '8px' })}>
              <table className={styles.previewTable}>
                <thead>
                  <tr>
                    <th>Round</th>
                    <th>Date</th>
                    <th>Home</th>
                    <th>Away</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((g, i) => {
                    const dt = formatDateTime(g.scheduledAt);
                    return (
                      <tr key={i}>
                        <td><span className={styles.roundBadge}>R{g.round}</span></td>
                        <td style={{ whiteSpace: 'nowrap' }}>{dt.date} · {dt.time}</td>
                        <td>{teamMap.get(g.homeTeamId)?.name ?? g.homeTeamId}</td>
                        <td>{teamMap.get(g.awayTeamId)?.name ?? g.awayTeamId}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className={styles.modalFooter}>
          <button style={B.secondary} onClick={onClose} disabled={saving}>Cancel</button>
          {preview && (
            <button style={B.primary} onClick={() => onSave(config)} disabled={saving}>
              {saving ? 'Saving…' : `Save ${preview.length} games`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Practice Modal ────────────────────────────────────────────────────────────

function PracticeModal({
  team,
  teams,
  venues,
  sport,
  checkPath,
  orgSlug,
  saving,
  editing,
  onSave,
  onClose,
}: {
  /** The practice's team on an edit; null on Add, which asks (`teams`). */
  team: LeagueTeam | null;
  /** Add's choice of team: the division's (9d-2a step 3 — Add › A practice). */
  teams: LeagueTeam[];
  venues: ClubVenueOption[];
  sport: string | null | undefined;
  checkPath: string;
  orgSlug: string;
  saving: boolean;
  /** A hand-booked practice opened to edit (Stage 11b Part 4, h2's pencil): this one, or this one and the rest of its
   *  series — `reach` is each practice it moves and its club day (asked first, so the line checks exactly them). */
  editing?: { practice: LeaguePractice; scope: 'one' | 'rest'; reach: { id: string; date: string }[] } | null;
  onSave: (form: PracticeForm) => Promise<void>;
  onClose: () => void;
}) {
  const B = useKitButtons(LEGACY_BUTTONS);
  const today = tournamentToday();
  const [form, setForm] = useState<PracticeForm>(() => {
    const p = editing?.practice;
    const start = p?.scheduledAt ? utcToZonedInputs(p.scheduledAt) : null;
    const end = p?.endsAt ? utcToZonedInputs(p.endsAt) : null;
    return {
      teamId: team?.id ?? teams[0]?.id ?? '',
      recurring: false,
      scheduledDate: start?.date || today,
      dayOfWeek: '2',
      startDate: today,
      endDate: today,
      startTime: start?.time || '18:00',
      endTime: p ? (end?.time ?? '') : '20:00',
      where: p ? whereOfLibraryRow(p, venues) : EMPTY_WHERE,
      notes: p?.notes ?? '',
    };
  });
  const rest = editing?.scope === 'rest';
  const title = editing && team ? PRACTICE_WINDOW_WORDS.editTitle(team.name) : 'Add practice';

  function set(k: keyof PracticeForm, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }));
  }

  // The line under the field (Club Tier Stage 6a): a series is checked date by date — the same dates the save will
  // write — and its refusal names the date; another program's booking names its dates in amber. An edit checks the
  // dates it reaches, leaving out the practices it moves.
  const { refused, line, checking, lineIsCurrent } = useLeagueLine({
    checkPath, sport, where: form.where, venues, kind: 'practice', teamId: form.teamId,
    series: !editing && form.recurring
      ? { dayOfWeek: Number(form.dayOfWeek), startDate: form.startDate, endDate: form.endDate, startTime: form.startTime, endTime: form.endTime }
      : null,
    occurrence: rest || (!editing && form.recurring) ? null : { date: form.scheduledDate, startTime: form.startTime, endTime: form.endTime },
    occurrences: rest ? editing!.reach.map(r => ({ date: r.date, startTime: form.startTime, endTime: form.endTime })) : null,
    excludePracticeIds: editing ? editing.reach.map(r => r.id) : null,
  });

  return (
    <div className={styles.modalOverlay} onPointerDown={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label={title}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{title}</h2>
          <button className={styles.modalCloseBtn} onClick={onClose} disabled={saving}><X size={18} /></button>
        </div>

        {rest && <p style={{ fontSize: '0.88rem', color: 'var(--white-60)', marginBottom: '1rem' }}>{PRACTICE_WINDOW_WORDS.editRestHint}</p>}

        {!editing && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="hl-practice-team">Team</label>
            <select id="hl-practice-team" className={styles.select} value={form.teamId} onChange={e => set('teamId', e.target.value)}>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}

        {!editing && <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            style={{ ...(!form.recurring ? B.primary : B.secondary), flex: 1 }}
            onClick={() => set('recurring', false)}
          >
            Single
          </button>
          <button
            style={{ ...(form.recurring ? B.primary : B.secondary), flex: 1 }}
            onClick={() => set('recurring', true)}
          >
            Recurring series
          </button>
        </div>}

        <div className={styles.formGrid}>
          {rest ? null : !form.recurring ? (
            <div className={styles.field}>
              <label className={styles.label}>Date</label>
              <DateInput className={styles.input} value={form.scheduledDate} onChange={v => set('scheduledDate', v)} />
            </div>
          ) : (
            <>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label}>Day of week</label>
                <select className={styles.select} value={form.dayOfWeek} onChange={e => set('dayOfWeek', e.target.value)}>
                  {DAY_NAMES.map((n, i) => <option key={i} value={String(i)}>{n}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>From date</label>
                <DateInput className={styles.input} value={form.startDate} onChange={v => set('startDate', v)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>To date</label>
                <DateInput className={styles.input} value={form.endDate} onChange={v => set('endDate', v)} />
              </div>
            </>
          )}
          <div className={styles.field}>
            <label className={styles.label}>Start time</label>
            <TimeInput className={styles.input} value={form.startTime} onChange={v => set('startTime', v)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>End time</label>
            <TimeInput className={styles.input} value={form.endTime} onChange={v => set('endTime', v)} />
          </div>
        </div>

        <LeagueWhere
          idPrefix="hl-practice"
          venues={venues}
          sport={sport}
          value={form.where}
          onChange={w => setForm(f => ({ ...f, where: w }))}
          orgSlug={orgSlug}
          canManage
          line={line}
        />

        <div className={styles.field}>
          <label className={styles.label}>Notes <span style={{ fontWeight: 400, opacity: 0.5 }}>(optional)</span></label>
          <textarea className={styles.textarea} value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
        </div>

        <div className={styles.modalFooter}>
          <button style={B.secondary} onClick={onClose} disabled={saving}>Cancel</button>
          <button
            style={refused ? { ...B.primary, ...REFUSED_LOOK } : B.primary}
            onClick={async () => { if (await lineIsCurrent()) await onSave(form); }}
            disabled={saving || refused || checking || !form.teamId}
          >
            {saving ? 'Saving…' : editing ? PRACTICE_WINDOW_WORDS.save : form.recurring ? 'Create series' : 'Create practice'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Cancel practice modal ─────────────────────────────────────────────────────

function CancelPracticeModal({
  practice,
  teamName,
  saving,
  onConfirm,
  onClose,
}: {
  practice: LeaguePractice;
  teamName: string;
  saving: boolean;
  onConfirm: (scope: 'one' | 'remaining' | 'all') => Promise<void>;
  onClose: () => void;
}) {
  const B = useKitButtons(LEGACY_BUTTONS);
  const kx = useKitStyle();
  const isRecurring = !!practice.recurrenceGroupId;
  const [scope, setScope] = useState<'one' | 'remaining' | 'all'>('one');
  const dt = practice.scheduledAt ? formatDateTime(practice.scheduledAt) : null;

  return (
    <div className={styles.modalOverlay} onPointerDown={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className={styles.modal} style={{ maxWidth: 420 }}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Cancel practice</h2>
          <button className={styles.modalCloseBtn} onClick={onClose} disabled={saving}><X size={18} /></button>
        </div>

        <p style={{ fontSize: '0.88rem', color: 'var(--white-60)', marginBottom: '1rem' }}>
          {teamName}{dt ? ` · ${dt.date} at ${dt.time}` : ''}
        </p>

        {isRecurring && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {(['one', 'remaining', 'all'] as const).map(s => (
              <label
                key={s}
                style={kx({
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  cursor: 'pointer', padding: '0.5rem 0.75rem', borderRadius: '2px',
                  border: `1px solid ${scope === s ? 'rgba(var(--danger-rgb),0.35)' : 'var(--white-8)'}`,
                  background: scope === s ? 'rgba(var(--danger-rgb),0.07)' : 'var(--white-03)',
                }, scope === s
                  ? { borderRadius: '8px', border: '1px solid rgba(var(--danger-rgb),0.35)', background: 'rgba(var(--danger-rgb),0.07)' }
                  : KIT_SURFACE.option)}
              >
                <input type="radio" value={s} checked={scope === s} onChange={() => setScope(s)} style={{ accentColor: 'var(--danger-light)' }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--white-80)' }}>
                  {s === 'one' && 'Cancel this practice only'}
                  {s === 'remaining' && 'Cancel this and all remaining in the series'}
                  {s === 'all' && 'Cancel the entire series'}
                </span>
              </label>
            ))}
          </div>
        )}

        <div className={styles.modalFooter}>
          <button style={B.secondary} onClick={onClose} disabled={saving}>Back</button>
          <button style={B.danger} onClick={() => onConfirm(scope)} disabled={saving}>
            {saving ? 'Cancelling…' : 'Cancel practice'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

/*
 * THE SEASON'S SCHEDULE (House League 9d-2a step 3; ruling 9d2·12, frames b1–b3). List · Week · Month with games and
 * practices together, on the club calendar's own parts — the switch (`CalendarViewSwitch`), the date row
 * (`ScheduleDateNav`), the Week (`WeekView`), the quiet Show pill — and the season's List, Month and "Needs a new date"
 * fold (`SeasonScheduleViews`). The page reads the WHOLE season once (teams, games, practices) and the division is a scope
 * over it: switching is instant, and a clash with another division's booking on the same diamond is still marked.
 *   the toolbar — the division (the scope pill, leading — C4) · the switch · the dates (Week and Month; List is the season,
 *                 R1) · Show · Export · Add · Tools. On a phone the switch is the View drawer's glyph in the title row, Week
 *                 and Month only (on a phone List and Week both stack a week's days).
 *   ⚰ the Practices view (→ 2026-10-27): a third kind of view, where C1 says a view is a span of time. A practice is a
 *     booking in every view and opens its window (h2); Add asks a game or a practice, and a practice asks its team.
 */
const VIEWS: CalendarView[] = ['list', 'week', 'month'];
/** The phone's View drawer — no List: on a phone it is the same stack of day frames as Week. */
const PHONE_VIEWS: CalendarView[] = ['week', 'month'];
const VIEW_WORD: Record<CalendarView, string> = { list: 'List', week: 'Week', month: 'Month' };
const VIEW_GLYPH: Record<CalendarView, React.ElementType> = { list: List, week: CalendarRange, month: CalendarDays };
/** A booking's edge on one division's calendar is its KIND (R4: the kind on a one-team calendar), the coach's two colours. */
const KIND_COLOUR = { game: EVENT_COLORS.league_game, practice: EVENT_COLORS.practice } as const;

export default function SchedulePage() {
  const { orgSlug, seasonId } = useParams<{ orgSlug: string; seasonId: string }>();
  const { currentOrg } = useOrg();
  // Admin Design Continuity slice 2: the kit's patch over each hand-set button while the switch is on.
  const B = useKitButtons(LEGACY_BUTTONS);
  // J3-012: every /api/admin fetch must carry the org slug so the server resolves the URL's org.
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';

  const [season, setSeason] = useState<SeasonInfo | null>(null);
  const [venues, setVenues] = useState<OrgVenue[]>([]);
  /** Schedule health's window (step 6): the header button opens it; it never arrives open. */
  const [healthOpen, setHealthOpen] = useState(false);
  const [divisions, setDivisions] = useState<LeagueDivision[]>([]);
  const [selectedDivId, setSelectedDivId] = useState('');
  // The whole season's (step 3): the division is a scope over them, never a second read.
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [games, setGames] = useState<LeagueGame[]>([]);
  const [practices, setPractices] = useState<LeaguePractice[]>([]);
  /** The season's game time, slot by slot (step 4): "Time from {schedule}" on a game that sits on one. */
  const [gameSlots, setGameSlots] = useState<SeasonGameSlot[]>([]);
  /** Each game's permit answer, by booking key (step 7) — the server sends it only to someone who runs the season. */
  const [gamePermits, setGamePermits] = useState<Record<string, PermitOutside>>({});
  /** "See the permit" (step 7): the permit's window, raised over the game window or Generate's check that opened it. */
  const [permitOpen, setPermitOpen] = useState<string | null>(null);
  const [scheduleRead, setScheduleRead] = useState<'loading' | 'ok' | 'failed'>('loading');
  /** Each published division's line (9d-2b, e1); a division absent from it is a draft. */
  const [publishing, setPublishing] = useState<Record<string, SchedulePublishing>>({});
  /** Publish schedule's window (e2), on the picked division. */
  const [publishOpen, setPublishOpen] = useState(false);
  /** Each game with a change waiting to be sent (9d-2b f1/f2): its net kind, or played since. Runners only. */
  const [changes, setChanges] = useState<Record<string, { kind: ChangeKind | null; played: boolean }>>({});
  const [changesOpen, setChangesOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // The calendar (9d2·12): the view, the cursor's day, and the Show filter (not remembered between visits — the club
  // calendar's 2026-10-01 rule). A desk opens on List, the season (R1); a phone draws Week for it.
  const phone = useIsPhone();
  const [view, setView] = useState<CalendarView>('list');
  const shownView: CalendarView = phone && view === 'list' ? 'week' : view;
  /** The day the admin moved the dates to; until then the season's own opening day (C3, below). */
  const [cursorPick, setCursorPick] = useState<string | null>(null);
  const [show, setShow] = useState<Set<string>>(() => new Set());
  /** Month's day, opened in List (Week on a phone) — scrolled to once that view is drawn. */
  const jumpTo = useRef<string | null>(null);

  /** The free League plan's generator (when and where asked once, 9d2a·B). */
  const [showGenerate, setShowGenerate] = useState(false);
  /** Generate games into the club's time (step 5, c1–c4): the division and choice it opens on. A door to House league's
   *  time closes it, and it opens again on the same choice when that window closes (`backToGenerate`). */
  const [generate, setGenerate] = useState<{ divisionId: string; through: Through } | null>(null);
  const [backToGenerate, setBackToGenerate] = useState<{ divisionId: string; through: Through } | null>(null);
  // A game's window (step 4, b4): the game it reads, by id — after a write the page reads again and the window reads the
  // fresh row — or Add › A game.
  const [gameWindow, setGameWindow] = useState<{ id: string } | 'create' | null>(null);

  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [activePractice, setActivePractice] = useState<LeaguePractice | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  // A practice's window, read first (Part 4, h2), and its pencil's form (a hand-booked practice, this one or the rest).
  const [openPractice, setOpenPractice] = useState<LeaguePractice | null>(null);
  const [editingPractice, setEditingPractice] = useState<{ practice: LeaguePractice; scope: 'one' | 'rest'; reach: { id: string; date: string }[] } | null>(null);

  const [feedback, setFeedback] = useState<FeedbackState>({ isOpen: false, title: '', message: '', type: 'success' });

  // Who may (the one house-league gate, Stage 9a, Q16/Q17): the people who run the league, on a live season; everyone
  // else who opens house league reads. A control a person can't use is absent.
  const canManage = !!useSeasonAccess(season)?.run;
  const hasAccess = !!useHouseLeagueAccess()?.read;

  // House league's time (Club Tier Stage 11b Part 3): the time line reads it; Tools, the line and `?time=1` (the club
  // schedule's "← House league's time" replays the open) open its window.
  const buildsSchedules = useBuildsSchedules();
  const [leagueTime, setLeagueTime] = useState<LeagueTime | null>(null);
  // The window mounts only once the season has loaded, so the server's render and the first client render agree.
  const [timeOpen, setTimeOpen] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('time') === '1');
  // Practice time (Part 4, frame h1): Tools › Practice time. Its "+ Give U12 more time" opens House league's time on that
  // piece (`timeOn`), and Practice time comes back when it closes (`backToPractice`).
  const [practiceTimeOpen, setPracticeTimeOpen] = useState(false);
  const [timeOn, setTimeOn] = useState<LeagueUse | null>(null);
  const [backToPractice, setBackToPractice] = useState(false);
  /** Tools and the time line open House league's time as itself: never on a piece, never back to Practice time (/review). */
  const openLeagueTime = () => { setTimeOn(null); setBackToPractice(false); setBackToGenerate(null); setTimeOpen(true); };
  const loadLeagueTime = useCallback(async () => {
    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/time${orgQuery}`, { cache: 'no-store' }).catch(() => null);
    // A failed re-read keeps the last good line rather than hiding it (/review).
    const data = res?.ok ? await res.json().catch(() => null) : null;
    if (data) setLeagueTime(data as LeagueTime);
  }, [seasonId, orgQuery]);
  useDeferredLoad(!!orgQuery, loadLeagueTime);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('time') !== '1') return;
    // Taken off the address before the window's own Back step stands on it, so a reload doesn't open it again.
    params.delete('time');
    const rest = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
  }, []);

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadSeasonAndDivisions = useCallback(async () => {
    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}${orgQuery}`);
    if (!res.ok) return;
    const { season: s, divisions: divs } = await res.json();
    setSeason({ id: s.id, name: s.name, sport: s.sport ?? null, status: s.status });
    setDivisions(divs ?? []);
    if (divs?.length && !selectedDivId) setSelectedDivId(divs[0].id);
  }, [seasonId, selectedDivId, orgQuery]);

  // The org venue library feeds the field picker. A failed fetch (older plan, no access)
  // degrades to the free-text input — never a blocked form.
  const loadVenues = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/org/venues${orgQuery}`);
      if (!res.ok) { setVenues([]); return; }
      const data = await res.json();
      setVenues(Array.isArray(data) ? data : []);
    } catch { setVenues([]); }
  }, [orgQuery]);

  /** The whole season's teams, games and practices — one read, every division (step 3). A failed read says so; it never
   *  draws an empty season. */
  const beginRead = useLatestRead();
  const loadSchedule = useCallback(async () => {
    const current = beginRead();
    const get = (path: string) => fetch(`/api/admin/house-league/seasons/${seasonId}/${path}${orgQuery}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null)).catch(() => null);
    const [t, g, p] = await Promise.all([get('teams'), get('schedule'), get('practices')]);
    if (!current()) return;
    if (!t || !g || !p) { setScheduleRead(r => (r === 'ok' ? r : 'failed')); return; }
    setTeams(t.teams ?? []);
    setGames(g.games ?? []);
    setGameSlots(g.gameSlots ?? []);
    setGamePermits(g.permits ?? {});
    setPublishing(g.publishing ?? {});
    setChanges(g.changes ?? {});
    setPractices(p.practices ?? []);
    setScheduleRead('ok');
  }, [seasonId, orgQuery, beginRead]);
  useDeferredLoad(!!orgQuery, loadSchedule);
  /** After a write: the season reads again (Schedule health is worked out from it, so it follows). */
  const reload = () => loadSchedule();

  useEffect(() => {
    setLoading(true);
    loadSeasonAndDivisions().finally(() => setLoading(false));
  }, [loadSeasonAndDivisions]);

  useEffect(() => { void loadVenues(); }, [loadVenues]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const selectedDiv = divisions.find(d => d.id === selectedDivId);
  const teamMap = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);
  const teamName = useMemo(() => new Map(teams.map(t => [t.id, t.name])), [teams]);
  /** The division's teams — its games' and its practices' (a practice belongs to its team's division). */
  const divTeams = useMemo(() => teams.filter(t => t.divisionId === selectedDivId), [teams, selectedDivId]);
  const divGames = useMemo(() => games.filter(g => g.divisionId === selectedDivId), [games, selectedDivId]);
  const divPractices = useMemo(() => practices.filter(p => teamMap.get(p.teamId)?.divisionId === selectedDivId), [practices, teamMap, selectedDivId]);

  // Sport-neutral surface noun ("Diamond" / "Court" / "Field") — never hard-coded.
  const noun = fieldNounFor(season?.sport);
  // The club's venues as the Venue field offers them (Club Tier Stage 6a), and the windows' live check.
  const clubVenues = useMemo(() => clubVenueOptions(venues), [venues]);
  const checkPath = `/api/admin/house-league/seasons/${seasonId}/venue-check${orgQuery}`;

  // The season as the calendar's bookings (step 1's `seasonCalendar`): every view draws these. The clashes are the whole
  // season's (`seasonClashes`), so another division's booking on the same facility still marks this one.
  const clashes = useMemo(() => seasonClashes({ games, practices, teamName }), [games, practices, teamName]);
  const calendar = useMemo(() => {
    const venueById = new Map(venues.map(v => [v.id, v]));
    const c = seasonCalendar({
      seasonName: season?.name ?? '', sport: season?.sport ?? null, games: divGames, practices: divPractices, teamName, gameSlots,
      divisionName: new Map(divisions.map(d => [d.id, d.name])),
      placeOf: (venueId, facilityId) => {
        const v = venueById.get(venueId);
        if (!v) return null;
        return { venue: v.name, facility: (facilityId && v.facilities?.find(f => f.id === facilityId)?.name) || null, address: v.address ?? null };
      },
      clashes,
      permits: new Map(Object.entries(gamePermits)),
    });
    // A held change marks its row until it is sent ("Moved · not sent", f1); a game played since says nothing here.
    const heldWords = (b: SeasonBooking) => {
      const c = b.source.kind === 'game' ? changes[b.source.game.id] : undefined;
      return c && !c.played ? CHANGES_TO_SEND_WORDS.marker(c.kind) : null;
    };
    const paint = (b: SeasonBooking): SeasonBooking => ({ ...b, colour: b.kind === 'practice' ? KIND_COLOUR.practice : KIND_COLOUR.game, held: heldWords(b) });
    return { bookings: c.bookings.map(paint), needsDate: c.needsDate.map(paint) };
  }, [season, divGames, divPractices, clashes, teamName, divisions, venues, gameSlots, gamePermits, changes]);

  // Show (9d2·12): empty = both kinds; a choice ON stays listed with 0 so it can always be taken off.
  const shown = calendar.bookings.filter(b => !show.size || show.has(b.kind));
  const showOptions = (['game', 'practice'] as const)
    .map(k => ({ id: k, label: W.showWord[k], count: calendar.bookings.filter(b => b.kind === k).length }))
    .filter(o => o.count > 0 || show.has(o.id));
  const today = tournamentToday();
  // C3 — Week and Month open on today when this week holds something; otherwise on the season's next day with something on
  // it, and a finished season on its last — until the admin moves the dates.
  const cursor = cursorPick ?? seasonOpeningDay(calendar.bookings, today);
  const range = rangeFor(shownView === 'list' ? 'week' : shownView, cursor);
  const inRange = (b: SeasonBooking) => b.day >= range.from && b.day <= range.to;

  /** A health door's jump: counted, so a second door to the same day and view still scrolls. */
  const [jumpTick, setJumpTick] = useState(0);
  useEffect(() => {
    const day = jumpTo.current;
    if (!day || shownView === 'month') return;
    jumpTo.current = null;
    const el = [document.getElementById(`season-week-${mondayOfDay(day)}`), document.getElementById(`cal-day-${day}`)]
      .find(x => x && x.offsetParent !== null);
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [shownView, cursor, jumpTick]);

  // ── Schedule health (step 6, d1–d4) ── the whole season's, worked out from the read the page already holds (games and
  // practices, every division: the clash pool is the season's), so it follows every write with no read of its own.
  const health = useMemo(() => buildLeagueScheduleHealth({
    games: games.map(leagueHealthGameOf),
    practices: practices.map(leagueHealthPracticeOf),
    teams: teams.map(t => ({ id: t.id, name: t.name, divisionId: t.divisionId })),
  }), [games, practices, teams]);
  const healthScore = health.timedGames > 0 ? health.score : null;
  /** A booking by its page key ("league_game:{id}"): the row, its division and its day. */
  const bookingOf = (key: string) => {
    const [kind, id] = key.split(':');
    if (kind === 'league_game') {
      const g = games.find(x => x.id === id);
      return g ? { label: `${teamName.get(g.homeTeamId) ?? 'Home'} vs ${teamName.get(g.awayTeamId) ?? 'Away'}`, divisionId: g.divisionId, at: g.scheduledAt } : null;
    }
    const p = practices.find(x => x.id === id);
    return p ? { label: `${teamName.get(p.teamId) ?? 'Team'} practice`, divisionId: p.divisionId ?? teamMap.get(p.teamId)?.divisionId ?? '', at: p.scheduledAt } : null;
  };
  /** "Show them" / "Show it": the window closes on the issue's division and day, in List (Week on a phone), every kind shown. */
  const showIssue = (issue: LeagueHealthIssue) => {
    const divOf = (teamId: string) => teamMap.get(teamId)?.divisionId ?? '';
    const at = (key: string) => { const b = bookingOf(key); return b?.at ? { divisionId: b.divisionId, day: orgDayKey(b.at) } : null; };
    const target =
      issue.kind === 'short' && issue.cancelled ? at(`league_game:${issue.cancelled.gameId}`)
      : issue.kind === 'clash' ? { divisionId: bookingOf(issue.keys[0])?.divisionId ?? '', day: issue.day }
      : issue.kind === 'twice_in_a_day' ? { divisionId: divOf(issue.teamId), day: issue.day }
      : issue.kind === 'byes_back_to_back' ? { divisionId: divOf(issue.teamId), day: issue.weeks[0] }
      : issue.kind === 'unchecked' ? at(issue.keys[0])
      : null;
    setHealthOpen(false);
    if (!target) return;
    if (target.divisionId) setSelectedDivId(target.divisionId);
    setShow(new Set());
    jumpTo.current = target.day;
    setCursorPick(target.day);
    setView(phone ? 'week' : 'list');
    setJumpTick(n => n + 1);
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  function showError(title: string, message: string) {
    setFeedback({ isOpen: true, title, message, type: 'danger' });
  }

  function openCreate() { setGameWindow('create'); }
  /** The window's game as last read; a game deleted elsewhere closes its window on the next read. */
  const openedGame = gameWindow && gameWindow !== 'create' ? games.find(x => x.id === gameWindow.id) ?? null : null;
  /** A booking opens its own window: a game its game window, a practice its practice window (h2). */
  const openBooking = (b: SeasonBooking) => {
    if (b.source.kind === 'game') setGameWindow({ id: b.source.game.id });
    else setOpenPractice(b.source.practice);
  };
  const pickView = (v: CalendarView) => { jumpTo.current = null; setView(v); };
  const step = (dir: -1 | 1) => { jumpTo.current = null; setCursorPick(stepCursor(shownView, cursor, dir)); };

  // ── Generate schedule ──────────────────────────────────────────────────────

  async function handlePreview(cfg: GenerateConfig): Promise<PreviewGame[]> {
    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/schedule/generate${orgQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        divisionId: selectedDivId, save: false,
        startDate: cfg.startDate, gamesPerWeek: cfg.gamesPerWeek, gameTime: cfg.gameTime,
        ...whereLibraryBody(cfg.where),
      }),
    });
    if (!res.ok) {
      showError('Preview failed', (await res.json()).error ?? 'Unknown error');
      return [];
    }
    return (await res.json()).preview ?? [];
  }

  async function handleGenerateSave(cfg: GenerateConfig) {
    setSaving(true);
    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/schedule/generate${orgQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        divisionId: selectedDivId, save: true,
        startDate: cfg.startDate, gamesPerWeek: cfg.gamesPerWeek, gameTime: cfg.gameTime,
        ...whereLibraryBody(cfg.where),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      showError('Could not save schedule', (await res.json()).error ?? 'Unknown error');
      return;
    }
    const { warnings, crossProgram } = await res.json();
    setShowGenerate(false);
    // Club Tier Stage 10a (Ask 3): the games outside the club's permit there, said after the save — quiet, never a refusal.
    const outside = permitAfterSave(Object.values((crossProgram?.permitLines ?? {}) as Record<string, string>), 'game');
    if (Array.isArray(warnings) && warnings.length) {
      setFeedback({
        isOpen: true, title: `${warnings.length} ${noun.toLowerCase()} clash${warnings.length !== 1 ? 'es' : ''} in the generated schedule`,
        message: `The schedule was saved, but some games share a ${noun.toLowerCase()} at the same time — spread them across times or ${noun.toLowerCase()}s. First: ${warnings[0]}${outside ? ` ${outside.sentence}` : ''}`,
        type: 'info',
      });
    } else if (outside) {
      setFeedback({ isOpen: true, title: outside.title, message: `The schedule was saved. ${outside.sentence}`, type: 'info' });
    }
    await reload();
  }

  // ── Practice CRUD ──────────────────────────────────────────────────────────

  /** h2's pencil saved: this hand-booked practice, or it and the rest of its series (each keeping its date). */
  async function handleEditPractice(form: PracticeForm) {
    if (!editingPractice) return;
    setSaving(true);
    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/practices/${editingPractice.practice.id}${orgQuery}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'edit', scope: editingPractice.scope,
        scheduledDate: form.scheduledDate, startTime: form.startTime, endTime: form.endTime || null,
        ...whereLibraryBody(form.where), notes: form.notes,
      }),
    }).catch(() => null);
    setSaving(false);
    const data = res ? await res.json().catch(() => null) : null;
    if (!res?.ok) {
      showError(res?.status === 409 && !data?.code ? `That ${noun.toLowerCase()} is already booked` : 'Could not save practice', data?.error ?? 'Unknown error');
      // A series that moved part of the way before a failure reads as it now is (/review).
      void loadSchedule();
      return;
    }
    setEditingPractice(null);
    if (Array.isArray(data?.warnings) && data.warnings.length) {
      setFeedback({ isOpen: true, title: PRACTICE_WINDOW_WORDS.saved(data.count ?? 1), message: `Possible clash: ${data.warnings[0]}`, type: 'info' });
    }
    await reload();
  }

  async function handleSavePractice(form: PracticeForm) {
    if (editingPractice) return handleEditPractice(form);
    setSaving(true);
    const body: Record<string, unknown> = {
      teamId:     form.teamId,
      divisionId: teamMap.get(form.teamId)?.divisionId ?? (selectedDivId || null),
      recurring:  form.recurring,
      startTime:  form.startTime,
      endTime:    form.endTime || null,
      ...whereLibraryBody(form.where),
      notes:      form.notes || null,
    };

    if (form.recurring) {
      body.dayOfWeek = Number(form.dayOfWeek);
      body.startDate = form.startDate;
      body.endDate   = form.endDate;
    } else {
      body.scheduledDate = form.scheduledDate;
    }

    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/practices${orgQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      showError(
        res.status === 409 ? `That ${noun.toLowerCase()} is already booked` : 'Could not save practice',
        data.error ?? 'Unknown error',
      );
      return;
    }
    const { count, warnings } = await res.json();
    setShowPracticeModal(false);
    const warningNote = Array.isArray(warnings) && warnings.length
      ? ` Possible clash: ${warnings[0]}`
      : '';
    setFeedback({
      isOpen: true, title: 'Practices created',
      message: `${count} practice${count !== 1 ? 's' : ''} added successfully.${warningNote}`,
      type: warningNote ? 'info' : 'success',
    });
    await reload();
  }

  async function handleCancelPractice(scope: 'one' | 'remaining' | 'all') {
    if (!activePractice) return;
    setSaving(true);
    const res = await fetch(
      `/api/admin/house-league/seasons/${seasonId}/practices/${activePractice.id}${orgQuery}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', scope }),
      },
    );
    setSaving(false);
    if (!res.ok) {
      showError('Could not cancel practice', (await res.json()).error ?? 'Unknown error');
      return;
    }
    setShowCancelModal(false);
    setActivePractice(null);
    await reload();
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  // The division's games, as before (one row a game, home and away, the score): what a convenor sends on. Practices stay
  // out of the file — they were never in it, and a team's practices are its coach's to send.
  function buildGameExportRows() {
    return divGames.map(g => {
      const home = teamMap.get(g.homeTeamId);
      const away = teamMap.get(g.awayTeamId);
      const dt   = g.scheduledAt ? formatDateTime(g.scheduledAt) : null;
      const score = g.status === 'completed' && g.homeScore != null
        ? `${g.homeScore} – ${g.awayScore}`
        : '';
      return {
        // The org-local DAY, the one `dt.time` beside it is read in — the universal slice put every
        // evening game on the next date (the Schedule deep dive's D-1, 2026-09-25).
        date:     g.scheduledAt ? isoToDateInput(g.scheduledAt) : '',
        time:     dt?.time ?? '',
        homeTeam: home?.name ?? '',
        awayTeam: away?.name ?? '',
        location: g.location ?? '',
        status:   STATUS_LABELS[g.status],
        score,
      };
    });
  }

  const exportFile = (ext: string) => buildFilename(
    { org: currentOrg?.slug, dataset: 'hl-schedule', scope: [season?.name, selectedDiv?.name].filter(Boolean).join(' ') },
    ext,
  );

  function handleExportXLSX() {
    const rows     = buildGameExportRows();
    const headers  = serializeHeaders(SCHEDULE_EXPORT_COLS);
    const data     = serializeRows(rows, SCHEDULE_EXPORT_COLS);
    return downloadXLSX(exportFile('xlsx'), headers, data, 'Schedule');
  }

  function handleExportCSV() {
    const rows     = buildGameExportRows();
    const headers  = serializeHeaders(SCHEDULE_EXPORT_COLS);
    const data     = serializeRows(rows, SCHEDULE_EXPORT_COLS);
    downloadCSVBlob(exportFile('csv'), generateCSV(headers, data));
  }

  // From the instant, never a universal date beside a zoned clock — see `lib/export/schedule-calendar`.
  async function handleExportICS() {
    await downloadICSFromInstants(
      exportFile('ics'),
      houseLeagueCalendarEntries(divGames, id => teamMap.get(id)?.name),
      `${season?.name ?? 'House league'} schedule`,
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // House league's time, mounted outside the loading swap: the page reads again when its division is first picked, and
  // a window unmounted by that swap would stand and drop its Back step twice (/review 2026-10-27, ?time=1).
  const timeWindow = timeOpen && season ? (
    <HouseLeagueTimeWindow orgSlug={orgSlug} seasonId={seasonId} seasonName={season.name}
      canDivide={canManage} schedulesHref={buildsSchedules ? `/${orgSlug}/admin/schedules` : null} openOn={timeOn ?? undefined}
      onClose={() => {
        setTimeOpen(false);
        setTimeOn(null);
        if (backToPractice) { setBackToPractice(false); setPracticeTimeOpen(true); }
        if (backToGenerate) { setGenerate(backToGenerate); setBackToGenerate(null); }
      }}
      onChanged={() => void loadLeagueTime()} />
  ) : null;
  // Practice time, mounted beside it for the same reason.
  const practiceTimeWindow = practiceTimeOpen && season && selectedDiv ? (
    <PracticeTimeWindow orgSlug={orgSlug} seasonId={seasonId} seasonName={season.name}
      divisionId={selectedDiv.id} divisionName={selectedDiv.name}
      onClose={() => setPracticeTimeOpen(false)}
      onGiveMore={() => {
        setPracticeTimeOpen(false);
        setBackToPractice(true);
        setTimeOn({ divisionId: selectedDiv.id, kind: 'practices' });
        setTimeOpen(true);
      }}
      onHandedOut={() => {
        setPracticeTimeOpen(false);
        void reload();
        void loadLeagueTime();
      }} />
  ) : null;

  if (loading) return <><LoadingState label="Loading the schedule…" />{timeWindow}{practiceTimeWindow}</>;

  if (!hasAccess) {
    return (
      <div className={styles.accessDenied}>
        <Calendar size={32} />
        <h2>Access restricted</h2>
        <p>You don&apos;t have access to this page.</p>
      </div>
    );
  }

  const backHref = `/${orgSlug}/admin/house-league/seasons/${seasonId}`;
  const divName = selectedDiv?.name ?? '';
  const freeFloor = !!currentOrg && isFreeFloorLeague(currentOrg);
  // ⚖ GENERATE GAMES (step 5): a club with the club's schedule generates into the time it gave house league; the free
  // League plan keeps its own generator exactly as it was (9d2a·B). The route draws the same line.
  const clubTime = !!currentOrg && clubSchedulerOn(currentOrg.planId);
  /** Generate's divisions (9d2·11, "has any games" until 9d-2b publishes): two teams or more and no games yet. */
  const generable = clubTime && canManage && scheduleRead === 'ok'
    ? divisions
      .map(d => ({ id: d.id, name: d.name, teams: teams.filter(t => t.divisionId === d.id) }))
      .filter(d => d.teams.length >= 2 && !games.some(x => x.divisionId === d.id))
    : [];
  /** Absent, never disabled, when no division can be generated (b3). */
  const canGenerate = clubTime ? generable.length > 0 : canManage && divTeams.length >= 2;
  const canGenerateHere = clubTime ? generable.some(d => d.id === selectedDivId) : canGenerate;
  const openGenerate = () => {
    if (!clubTime) { setShowGenerate(true); return; }
    const on = generable.find(d => d.id === selectedDivId) ?? generable[0];
    if (on) setGenerate({ divisionId: on.id, through: 1 });
  };

  // ⚖ PUBLISH SCHEDULE (9d-2b, e1): the division's games are a draft until it is pressed; only once its teams are
  // published (9d2·8). The line says the state; the header holds the button.
  const divLiveGames = divGames.filter(g => g.status !== 'cancelled').length;
  const divPublishing = selectedDivId ? publishing[selectedDivId] : undefined;
  const divTeamsPublished = !!selectedDiv?.teamsPublishedAt;
  const canPublish = showPublishButton({ canRun: canManage, published: !!divPublishing, teamsPublished: divTeamsPublished, games: divLiveGames });
  // Changes to send (f2): the header's button once a published division has a change waiting, its count the amber pill.
  const divHeld = canManage && divPublishing ? divPublishing.held : 0;
  /** A place as a Changes to send row says it: the facility alone when it has one ("Diamond 2"), else the venue or the text. */
  const placeWords = (snap: GameSnapshot) => {
    const v = snap.venueId ? venues.find(x => x.id === snap.venueId) : null;
    const fac = v && snap.facilityId ? v.facilities?.find(f => f.id === snap.facilityId)?.name : null;
    return fac || v?.name || snap.location || '';
  };

  const ViewGlyph = VIEW_GLYPH[shownView];
  const dateNav = shownView === 'list' ? null : <ScheduleDateNav view={shownView} cursor={cursor} onStep={step} />;

  // ⚖ ONE Export (C11): Excel first, then CSV and the calendar file — the division's games. The free League plan reads why
  // it can't, in Tools, as it did (exports are a paid-League capability; 100% client-side today — a server export route
  // added later MUST guard isFreeFloorLeague(org) → 403).
  const exportMenu = freeFloor ? null : (
    <ExportMenu formats={['xlsx', 'csv', 'ics']} disabled={divGames.length === 0}
      holds={{ title: `${divName ? `${divName} · ` : ''}${pluralize(divGames.length, 'game')}` }}
      onExportXLSX={handleExportXLSX} onExportCSV={handleExportCSV} onExportICS={handleExportICS} />
  );
  // Add (b1): "Add to the schedule" — a game, or a practice (which asks its team). The league's runners on a live season.
  const addMenu = canManage && divTeams.length > 0 ? (
    <CoachToolbarMenu label="Add" icon={<Plus size={15} aria-hidden />} variant="primary" drawerOnPhone drawerTitle={W.addTitle}>
      <CoachToolbarMenuHeading>{W.addTitle}</CoachToolbarMenuHeading>
      {divTeams.length >= 2 && <CoachToolbarMenuItem label={W.addGame} onSelect={openCreate} />}
      <CoachToolbarMenuItem label={W.addPractice} onSelect={() => setShowPracticeModal(true)} />
    </CoachToolbarMenu>
  ) : null;
  // Tools ⋯ (Stage 11b Part 3; ruled 9d-2, card 7): House league's time, Practice time, Generate games — and the free plan's
  // locked export.
  const toolsMenu = (
    <CoachToolbarMenu label={LEAGUE_TIME_WORDS.tools} icon={<MoreHorizontal size={18} className={tb.toolsGlyph} aria-hidden />}
      collapseOnPhone bareOnPhone drawerOnPhone drawerTitle={LEAGUE_TIME_WORDS.tools} triggerClassName={tb.tool}>
      <CoachToolbarMenuItem icon={<Clock size={15} aria-hidden />} label={LEAGUE_TIME_WORDS.title} onSelect={openLeagueTime} />
      {/* Practice time (Part 4): the league's runners on a live season, for the division picked. */}
      {canManage && selectedDiv && (
        <CoachToolbarMenuItem icon={<CalendarClock size={15} aria-hidden />} label={PRACTICE_TIME_WORDS.title} onSelect={() => setPracticeTimeOpen(true)} />
      )}
      {canGenerate && <CoachToolbarMenuItem icon={<Wand2 size={15} aria-hidden />} label={W.generate} onSelect={openGenerate} />}
      {freeFloor && <>
        <CoachToolbarMenuSeparator />
        <CoachToolbarMenuHeading>{LEAGUE_TIME_WORDS.exportHeading}</CoachToolbarMenuHeading>
        <CoachToolbarMenuItem disabled label={LEAGUE_TIME_WORDS.exportsLocked} hint={LEAGUE_TIME_WORDS.exportsLockedHint} onSelect={() => {}} />
      </>}
    </CoachToolbarMenu>
  );

  // What the chosen view draws, or why it draws nothing (the settled words, b1–b3).
  const all = calendar.bookings.length + calendar.needsDate.length;
  let body: React.ReactNode;
  if (scheduleRead === 'failed') {
    body = <LoadFailed title="We couldn’t load the schedule." onRetry={() => void loadSchedule()} />;
  } else if (scheduleRead === 'loading') {
    body = <LoadingState label="Loading the schedule…" />;
  } else if (all === 0) {
    body = (
      <div className={styles.emptyState}>
        <p><strong>{W.emptyDivision(divName)}</strong></p>
        <p>{divTeams.length < 2 && canManage ? 'Create at least 2 teams before generating a schedule.' : W.emptyDivisionHint}</p>
      </div>
    );
  } else if (divGames.length === 0 && shownView === 'list') {
    // Edge k: practices but no games — the division's next step is its games.
    body = (
      <>
        <div className={styles.emptyState}>
          <p><strong>{W.noGamesYet(divName)}</strong></p>
          <p>{W.noGamesHint}</p>
          {canGenerateHere && <button style={B.primary} onClick={openGenerate}>{W.generate}</button>}
        </div>
        {shown.length > 0 && <SeasonListView bookings={shown} today={today} sport={season?.sport ?? null} teamName={teamName} onOpen={openBooking} />}
      </>
    );
  } else if (shownView === 'list') {
    body = shown.length === 0
      ? <p className={styles.hint}>{W.nothingMatches}</p>
      : <SeasonListView bookings={shown} today={today} sport={season?.sport ?? null} teamName={teamName} onOpen={openBooking} />;
  } else if (shownView === 'week') {
    const week = shown.filter(inRange);
    body = (
      <>
        <WeekView cursor={cursor} bookings={week} onOpen={b => openBooking(b as SeasonBooking)} multiProgram={false} />
        {week.length === 0 && <p className={styles.hint}>{show.size ? W.nothingMatches : W.emptyWeek}</p>}
      </>
    );
  } else {
    // Month draws a postponed game on the day it had, "· Postponed" (b2); List and Week never draw it as on.
    const month = [...shown, ...calendar.needsDate.filter(b => b.startMs && (!show.size || show.has(b.kind)))]
      .filter(inRange).sort((a, b) => a.startMs - b.startMs);
    body = (
      <>
        <SeasonMonthView cursor={cursor} bookings={month} today={today} onOpen={openBooking}
          onDay={d => { jumpTo.current = d; setCursorPick(d); setView(phone ? 'week' : 'list'); }} />
        {month.length === 0 && <p className={styles.hint}>{show.size ? W.nothingMatches : W.emptyMonth(monthWords(cursor))}</p>}
      </>
    );
  }

  return (
    <>
    <div className={styles.page}>
      {/* Header — today's as `legacy` while the switch is off. On the kit (F3) the season's name (the
          subtitle) is the way up, in the leading corner. On a phone the view's glyph opens the View drawer (Week, Month). */}
      <AdminPageHeader
        eyebrow="House league"
        title="Schedule"
        backTo={{ href: backHref, label: season?.name ?? 'Season' }}
        inlineActions
        actions={<>
          <span className={cal.viewPhone}>
            <CoachToolbarMenu label={`Change view · ${VIEW_WORD[shownView]}`} icon={<ViewGlyph size={20} aria-hidden />} variant="glyph" drawerOnPhone drawerTitle="View">
              {PHONE_VIEWS.map(v => {
                const Glyph = VIEW_GLYPH[v];
                return <CoachToolbarMenuItem key={v} icon={<Glyph size={16} aria-hidden />} label={VIEW_WORD[v]} checked={shownView === v} onSelect={() => pickView(v)} />;
              })}
            </CoachToolbarMenu>
          </span>
          {/* Schedule health (d1): the tournament's button — "—" until a game has a time — once the season has read. */}
          {scheduleRead === 'ok' && (
            <HealthButton
              score={healthScore}
              tone={health.tone}
              issues={health.issues.length}
              title={GAME_DAY_WORDS.healthTitle}
              label={SCHEDULE_DAY_WORDS.healthButtonLabel(healthScore, health.issues.length)}
              onOpen={() => setHealthOpen(true)}
            />
          )}
          {canPublish && scheduleRead === 'ok' && (
            <button type="button" className="btn btn-lime" onClick={() => setPublishOpen(true)}>
              {phone ? SCHEDULE_PUBLISH_WORDS.buttonPhone : SCHEDULE_PUBLISH_WORDS.button}
            </button>
          )}
          {divHeld > 0 && scheduleRead === 'ok' && (
            <button type="button" className="btn btn-lime" onClick={() => setChangesOpen(true)}
              aria-label={`${CHANGES_TO_SEND_WORDS.button}: ${divHeld}`}>
              {CHANGES_TO_SEND_WORDS.button}<span className={cts.count} aria-hidden>{divHeld > 9 ? '9+' : divHeld}</span>
            </button>
          )}
        </>}
      />

      {/* The time line (Stage 11b Part 3): where this division's time comes from, and the door to House league's time. */}
      {leagueTime && selectedDivId && showTimeLine(leagueTime, buildsSchedules) && (
        <HouseLeagueTimeLine time={leagueTime} divisionId={selectedDivId} divisionName={divName} onOpen={openLeagueTime} />
      )}
      {selectedDiv && scheduleRead === 'ok' && divGames.length > 0 && (
        <SchedulePublishLine divisionName={divName} games={divLiveGames} teamsPublished={divTeamsPublished}
          publishing={divPublishing} canRun={canManage} missedHref={`/${orgSlug}/admin/house-league/seasons/${seasonId}/notifications`} />
      )}

      {/* ⚖ ONE LINE (C4): the division leads (the scope), then the switch and — wider than 900 px — the dates; Show right of
          the gap; Export, Add and Tools at the end. */}
      <CoachListToolbar
        actions={<>{exportMenu}{addMenu}{toolsMenu}</>}
        filters={(
          <FilterGroup>
            <MultiSelectDropdown restQuiet label={W.show} options={showOptions} selected={show} onChange={setShow} allLabel={W.showAll} />
          </FilterGroup>
        )}
      >
        {divisions.length > 1 && (
          <SingleSelectDropdown label={W.division} lead value={selectedDivId} onChange={setSelectedDivId}
            options={divisions.map(d => ({ id: d.id, label: d.name }))} />
        )}
        {/* The switch hides on a phone through its wrapper (the club calendar's). */}
        <span className={cal.viewDesk}>
          <CalendarViewSwitch views={VIEWS} value={view} onChange={pickView} label={W.viewLabel} />
        </span>
        {dateNav && <div className={coach.calNavOnLine}>{dateNav}</div>}
      </CoachListToolbar>
      {/* The dates on their own row at 900 px and narrower. */}
      {dateNav && <div className={cal.dateRow}>{dateNav}</div>}

      {/* Postponed games wait above every view until they have a date (9d2·10). */}
      {scheduleRead === 'ok' && <NeedsDateFold bookings={calendar.needsDate} onOpen={openBooking} />}

      {body}

      {/* Generate modal */}
      {showGenerate && selectedDiv && (
        <GenerateModal
          divisionName={selectedDiv.name}
          teams={divTeams}
          venues={clubVenues}
          sport={season?.sport}
          orgSlug={orgSlug}
          saving={saving}
          onPreview={handlePreview}
          onSave={handleGenerateSave}
          onClose={() => setShowGenerate(false)}
        />
      )}

      {/* Generate games into the club's time (step 5, c1–c4). */}
      {generate && season && (
        <GenerateGamesWindow
          seasonName={season.name}
          divisions={generable}
          divisionId={generate.divisionId}
          through={generate.through}
          time={leagueTime}
          /* org-slug-ok: the window adds `orgQuery` (below) to every call it makes */
          api={`/api/admin/house-league/seasons/${seasonId}`}
          orgQuery={orgQuery}
          schedulesHref={buildsSchedules ? `/${orgSlug}/admin/schedules` : null}
          onTimeChanged={loadLeagueTime}
          onOpenTime={(divisionId, through) => {
            setGenerate(null);
            setBackToPractice(false);
            setBackToGenerate({ divisionId, through });
            setTimeOn({ divisionId, kind: 'games' });
            setTimeOpen(true);
          }}
          onSeePermit={setPermitOpen}
          onSaved={(said, permit) => {
            setGenerate(null);
            setFeedback({ isOpen: true, title: said, message: permit ? `${permit.title}. ${permit.sentence}` : '', type: permit ? 'info' : 'success' });
            void reload();
          }}
          onClose={() => setGenerate(null)}
        />
      )}

      {/* Publish schedule (9d-2b, e2): asked once, on the picked division. */}
      {publishOpen && selectedDiv && (
        <PublishScheduleWindow
          division={{ id: selectedDiv.id, name: selectedDiv.name }}
          /* org-slug-ok: the window adds `orgQuery` (below) to every call it makes */
          api={`/api/admin/house-league/seasons/${seasonId}/schedule`}
          orgQuery={orgQuery}
          onDone={r => {
            setPublishOpen(false);
            setFeedback({ isOpen: true, title: r.said, message: '', type: 'success' });
            void reload();
          }}
          onClose={() => setPublishOpen(false)}
        />
      )}

      {/* Changes to send (9d-2b, f2): the division's waiting changes, Undo on each, one Send. */}
      {changesOpen && selectedDiv && (
        <ChangesToSendWindow
          division={{ id: selectedDiv.id, name: selectedDiv.name }}
          /* org-slug-ok: the window adds `orgQuery` (below) to every call it makes */
          api={`/api/admin/house-league/seasons/${seasonId}/schedule`}
          orgQuery={orgQuery}
          titleOf={id => {
            const g = games.find(x => x.id === id);
            return g ? GAME_WINDOW_WORDS.title(teamName.get(g.homeTeamId) ?? GAME_WINDOW_WORDS.home, teamName.get(g.awayTeamId) ?? GAME_WINDOW_WORDS.away) : '';
          }}
          teamName={id => teamName.get(id) ?? ''}
          placeOf={placeWords}
          onSent={said => {
            setChangesOpen(false);
            setFeedback({ isOpen: true, title: said, message: '', type: 'success' });
            void reload();
          }}
          onUndone={() => {
            void reload();
          }}
          onClose={() => setChangesOpen(false)}
        />
      )}

      {/* A game's window, read first (step 4, b4) — or Add › A game. A game edits among its own division's teams. */}
      {gameWindow && (gameWindow === 'create' || openedGame) && (
        <GameWindow
          key={gameWindow === 'create' ? 'create' : gameWindow.id}
          game={openedGame}
          booking={openedGame ? [...calendar.bookings, ...calendar.needsDate].find(b => b.key === `league_game:${openedGame.id}`) ?? null : null}
          divisionId={openedGame?.divisionId ?? selectedDivId}
          divisionName={(openedGame ? divisions.find(d => d.id === openedGame.divisionId)?.name : null) ?? divName}
          published={!!publishing[openedGame?.divisionId ?? selectedDivId]}
          teams={openedGame ? teams.filter(t => t.divisionId === openedGame.divisionId) : divTeams}
          venues={clubVenues}
          sport={season?.sport}
          /* org-slug-ok: the window adds `orgQuery` (below) to every call it makes */
          api={`/api/admin/house-league/seasons/${seasonId}/schedule`}
          orgQuery={orgQuery}
          checkPath={checkPath}
          orgSlug={orgSlug}
          canRun={canManage}
          onSeePermit={setPermitOpen}
          onChanged={reload}
          onCreated={warning => {
            setGameWindow(null);
            if (warning) setFeedback({ isOpen: true, title: 'Saved — possible clash', message: warning, type: 'info' });
            void reload();
          }}
          onDeleted={() => { setGameWindow(null); void reload(); }}
          onClose={() => setGameWindow(null)}
        />
      )}

      {/* "See the permit" (step 7, frames b4, c3, i): Stage 10's permit window as it is, raised over the window that opened
          it, which waits underneath. Only someone who runs the season gets the door, and every one of them (owner, admin,
          league admin) opens the Venue library, so the permit reads for them; a change to it reads the season again. */}
      {permitOpen && (
        <PermitWindow raised key={permitOpen} q={orgQuery.slice(1)} orgSlug={orgSlug} orgName={currentOrg?.name ?? ''}
          permitId={permitOpen} onChanged={reload} onClose={() => setPermitOpen(null)} />
      )}

      {/* Add › A practice: the form asks its team (the division's). */}
      {showPracticeModal && (
        <PracticeModal
          team={null}
          teams={divTeams}
          venues={clubVenues}
          sport={season?.sport}
          checkPath={checkPath}
          orgSlug={orgSlug}
          saving={saving}
          onSave={handleSavePractice}
          onClose={() => setShowPracticeModal(false)}
        />
      )}

      {/* A practice's window, read first (Part 4, h2) */}
      {openPractice && (
        <PracticeWindow practice={openPractice} teamName={teamMap.get(openPractice.teamId)?.name ?? 'Team'}
          divisionName={divisions.find(d => d.id === teamMap.get(openPractice.teamId)?.divisionId)?.name ?? divName}
          teamPractices={practices.filter(x => x.teamId === openPractice.teamId)} canRun={canManage}
          onClose={() => setOpenPractice(null)}
          onEdit={scope => {
            const p = openPractice;
            const day = (x: LeaguePractice) => (x.scheduledAt ? utcToZonedInputs(x.scheduledAt).date : '');
            // The rest of the series: this one and the ones after it that aren't cancelled (the route moves the same).
            const reach = scope === 'rest' && p.recurrenceGroupId && p.scheduledAt
              ? practices.filter(x => x.recurrenceGroupId === p.recurrenceGroupId && x.status !== 'cancelled' && !x.clubScheduleSlotId
                  && x.scheduledAt && x.scheduledAt >= p.scheduledAt!)
                .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!)).map(x => ({ id: x.id, date: day(x) }))
              : [{ id: p.id, date: day(p) }];
            setOpenPractice(null);
            setEditingPractice({ practice: p, scope, reach });
          }}
          onCancel={() => { setActivePractice(openPractice); setOpenPractice(null); setShowCancelModal(true); }}
          onChangePracticeTime={() => { setOpenPractice(null); setPracticeTimeOpen(true); }} />
      )}

      {/* Schedule health's window (d2–d4): the whole season; its doors close it on the schedule or open the game. */}
      {healthOpen && (
        <LeagueHealthWindow
          health={health}
          eyebrow={season?.name ?? ''}
          team={id => teamName.get(id) ?? 'Team'}
          label={key => bookingOf(key)?.label ?? ''}
          place={(venueId, facilityId) => {
            const v = venues.find(x => x.id === venueId);
            const f = facilityId ? v?.facilities?.find(x => x.id === facilityId)?.name : null;
            return [v?.name ?? noun, f].filter(Boolean).join(' · ');
          }}
          divisionName={id => divisions.find(d => d.id === id)?.name ?? ''}
          phone={phone}
          canRun={canManage}
          onShow={showIssue}
          onOpenGame={id => {
            setHealthOpen(false);
            const g = games.find(x => x.id === id);
            if (g) setSelectedDivId(g.divisionId);
            setGameWindow({ id });
          }}
          onClose={() => setHealthOpen(false)}
        />
      )}

      {/* A hand-booked practice's form, opened to edit */}
      {editingPractice && teamMap.get(editingPractice.practice.teamId) && (
        <PracticeModal
          team={teamMap.get(editingPractice.practice.teamId)!}
          teams={[]}
          venues={clubVenues}
          sport={season?.sport}
          checkPath={checkPath}
          orgSlug={orgSlug}
          saving={saving}
          editing={editingPractice}
          onSave={handleSavePractice}
          onClose={() => setEditingPractice(null)}
        />
      )}

      {/* Practice cancel modal */}
      {showCancelModal && activePractice && (
        <CancelPracticeModal
          practice={activePractice}
          teamName={teamMap.get(activePractice.teamId)?.name ?? 'Team'}
          saving={saving}
          onConfirm={handleCancelPractice}
          onClose={() => { setShowCancelModal(false); setActivePractice(null); }}
        />
      )}

      <FeedbackModal
        isOpen={feedback.isOpen}
        title={feedback.title}
        message={feedback.message}
        type={feedback.type}
        onConfirm={feedback.onConfirm}
        confirmText={feedback.confirmText}
        cancelText={feedback.cancelText}
        onClose={() => setFeedback(f => ({ ...f, isOpen: false }))}
      />
    </div>
    {/* Second in both returns, so the loading swap keeps it mounted. */}
    {timeWindow}
    {practiceTimeWindow}
    </>
  );
}
