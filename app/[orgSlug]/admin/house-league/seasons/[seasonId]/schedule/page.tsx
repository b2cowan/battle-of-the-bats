'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, Calendar, CalendarClock, Clock, MoreHorizontal, Plus, X, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { useOrg } from '@/lib/org-context';
import { ORG_TIME_ZONE, formatInOrgZone, orgWeekKey, utcToZonedInputs, tournamentToday } from '@/lib/timezone';
import { isFreeFloorLeague } from '@/lib/free-floor';
import { useHouseLeagueAccess, useSeasonAccess } from '@/components/admin/kit/useHouseLeagueSeasons';
import { fieldNounFor } from '@/lib/sports';
import FeedbackModal from '@/components/FeedbackModal';
import HelpCallout from '@/components/help/HelpCallout';
import WhereField, { WhereLine } from '@/components/venue/WhereField';
import { useClashCheck } from '@/components/venue/useClashCheck';
import { EMPTY_WHERE, clubVenueOptions, pickedVenueKinds, whereLibraryBody, whereOfLibraryRow, type WhereValue } from '@/lib/where-field';
import { clashLine, leagueRefusalLine, leagueSeriesLine } from '@/lib/venue-clash-words';
import { permitAfterSave, permitLine, permitSeriesLine, type PermitOutside } from '@/lib/permit-words';
import type { ClashFinding } from '@/lib/venue-clash';
import {
  downloadXLSX, generateCSV, downloadCSVBlob, downloadICSFromInstants, houseLeagueCalendarEntries,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
} from '@/lib/export';
import { CoachToolbarMenu, CoachToolbarMenuHeading, CoachToolbarMenuItem, CoachToolbarMenuSeparator } from '@/components/coaches/CoachToolbarMenu';
import tb from '@/components/admin/tournament/AdminToolbar.module.css';
import HouseLeagueTimeWindow from '@/components/admin/kit/club/league/time/HouseLeagueTimeWindow';
import HouseLeagueTimeLine, { showTimeLine, useBuildsSchedules } from '@/components/admin/kit/club/league/time/HouseLeagueTimeLine';
import { LEAGUE_TIME_WORDS, type LeagueTime, type LeagueUse } from '@/lib/league-time';
import PracticeTimeWindow from '@/components/admin/kit/club/league/time/PracticeTimeWindow';
import PracticeWindow from '@/components/admin/kit/club/league/practices/PracticeWindow';
import { PRACTICE_TIME_WORDS, PRACTICE_WINDOW_WORDS } from '@/lib/league-practice-time';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { RecordDelete, useDeferredLoad } from '@/components/admin/kit/club/RepKit';
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

interface GameForm {
  homeTeamId: string;
  awayTeamId: string;
  scheduledDate: string;
  scheduledTime: string;
  endTime: string;
  where: WhereValue;
  status: LeagueGameStatus;
  homeScore: string;
  awayScore: string;
  notes: string;
}

interface GenerateConfig {
  startDate: string;
  gamesPerWeek: number;
  gameTime: string;
  where: WhereValue;
}

interface PracticeForm {
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

interface HealthConflict {
  kind: 'game' | 'practice';
  id: string;
  label: string | null;
  startsAt: string | null;
  fieldLabel: string | null;
  partnerKind: 'game' | 'practice';
  partnerLabel: string | null;
  partnerStartsAt: string | null;
  matchedOn: 'facility' | 'venue' | 'text';
}

interface ScheduleHealth {
  conflicts: HealthConflict[];
  uncheckedCount: number;
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

function isoToTimeInput(iso: string): string {
  return utcToZonedInputs(iso).time;
}

// ⚠ A game files under the week of its day IN THE ORG'S ZONE (`orgWeekKey`, Club Tier Stage 6b, Ask 8): this page kept its
// own key on the device's clock, and its label read the key's midnight in UTC — so the heading named the Sunday before
// ("Week of October 18" over a week that starts Monday the 19th) and a Sunday game after 8 p.m. on a UTC device filed
// into the next week.
function weekLabel(key: string): string {
  return `Week of ${formatInOrgZone(`${key}T12:00:00Z`, { month: 'long', day: 'numeric', year: 'numeric' })}`;
}

const STATUS_LABELS: Record<LeagueGameStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
};

const STATUS_CLASS: Record<LeagueGameStatus, string> = {
  scheduled: styles.gameStatusScheduled,
  completed: styles.gameStatusCompleted,
  postponed: styles.gameStatusPostponed,
  cancelled: styles.gameStatusCancelled,
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

/** One live-check answer per date (`/venue-check`). */
interface LeagueCheckResult {
  date: string;
  refusal: {
    partnerLabel: string; partnerKind: 'game' | 'practice';
    partnerStartsAt: string | null; partnerEndsAt: string | null; matchedOn: 'facility' | 'venue';
  } | null;
  crossProgram: ClashFinding[];
  /** The date OUTSIDE a permit the club holds at that venue (Club Tier Stage 10a, Ask 3), else null. */
  permit?: PermitOutside | null;
}
const readLeagueCheck = (json: unknown): LeagueCheckResult[] => {
  const results = (json as { results?: unknown } | null)?.results;
  return Array.isArray(results) ? results as LeagueCheckResult[] : [];
};
/** What Create compares with the line on screen: the cross-program findings, and a refusal. */
const countLeagueCheck = (r: LeagueCheckResult[]) => r.reduce((n, x) => n + x.crossProgram.length + (x.refusal ? 1 : 0), 0);

/**
 * House league's window line (specimen 3, Asks 4–5): the league's own refusal in red under the field, before
 * Create (Create greyed) — what it refuses is unchanged — and another program's booking in amber, never blocking.
 * The check runs as soon as a date, a time and one of the club's venues are set, and again on any change; Create
 * asks once more first (the hook's one rule). The words are `lib/venue-clash-words.ts`'s.
 */
function useLeagueLine(opts: {
  checkPath: string;
  sport: string | null | undefined;
  where: WhereValue;
  /** The club's venues — the picked one's facilities give the line its noun ("can't share a field"). */
  venues: readonly ClubVenueOption[];
  kind: 'game' | 'practice';
  /** One booking… */
  occurrence?: { date: string; startTime: string; endTime: string } | null;
  /** …or a practice series (expanded on the server by the save's own generator)… */
  series?: { dayOfWeek: number; startDate: string; endDate: string; startTime: string; endTime: string } | null;
  /** …or the dates an edit of a series reaches (Stage 11b Part 4). */
  occurrences?: { date: string; startTime: string; endTime: string }[] | null;
  excludeGameId?: string | null;
  /** The practices an edit moves: never a clash with themselves. */
  excludePracticeIds?: string[] | null;
  teamId?: string | null;
}) {
  const { checkPath, sport, where, venues, kind, occurrence, series, occurrences, excludeGameId, excludePracticeIds, teamId } = opts;
  const ready = where.source === 'club' && !!where.orgVenueId && (
    series ? !!(series.startDate && series.endDate && series.startTime && series.endTime)
      : occurrences ? occurrences.length > 0 && occurrences.every(o => o.date && o.startTime)
        : !!(occurrence?.date && occurrence.startTime)
  );
  const { result, checking, lineIsCurrent } = useClashCheck(
    ready ? {
      path: checkPath,
      body: {
        kind, orgVenueId: where.orgVenueId, orgVenueFacilityId: where.orgVenueFacilityId,
        ...(series ? { series } : { occurrences: occurrences ?? [occurrence] }),
        excludeGameId: excludeGameId ?? null, excludePracticeIds: excludePracticeIds ?? [], teamId: teamId ?? null,
      },
    } : null,
    readLeagueCheck,
    countLeagueCheck,
  );

  const ctx = {
    sport, venueName: where.location, facilityName: where.orgVenueFacilityId ? where.fieldNumber : null,
    kinds: pickedVenueKinds(where, venues),
  };
  const refusalAt = (result ?? []).find(r => r.refusal);
  const refusal = refusalAt?.refusal
    ? leagueRefusalLine({
        sport, kinds: ctx.kinds, matchedOn: refusalAt.refusal.matchedOn, venueName: ctx.venueName, facilityName: ctx.facilityName,
        partnerLabel: refusalAt.refusal.partnerLabel, partnerKind: refusalAt.refusal.partnerKind, proposedKind: kind,
        startIso: refusalAt.refusal.partnerStartsAt, endIso: refusalAt.refusal.partnerEndsAt,
        date: series || occurrences ? refusalAt.date : null,
      })
    : null;
  const cross = result?.some(r => r.crossProgram.length)
    ? (series || occurrences
        ? leagueSeriesLine(result.map(r => ({ date: r.date, findings: r.crossProgram })), ctx)
        : clashLine(result[0]?.crossProgram ?? [], ctx))
    : null;
  // The permit's quiet line (Stage 10a, Ask 3): under the league's own and the amber line, never merged, never a refusal.
  const permits = (result ?? []).map(r => r.permit ?? null);
  const outside = permits.some(Boolean)
    ? (series || occurrences ? permitSeriesLine(permits, (result ?? []).map(r => r.date), sport, { nameTheDates: true }) : permitLine(permits[0], sport))
    : '';
  return {
    refused: !!refusal,
    line: refusal || cross || outside ? (
      <>
        {refusal && <WhereLine tone="refuse" lead={refusal.lead} rest={refusal.rest} />}
        {cross && <WhereLine tone={cross.tone} lead={cross.lead} rest={cross.rest} />}
        {outside && <WhereLine tone="quiet" mark="clock" rest={outside} />}
      </>
    ) : null,
    checking,
    lineIsCurrent,
  };
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

// ── Game Modal (create + edit) ────────────────────────────────────────────────

function GameModal({
  game,
  teams,
  venues,
  sport,
  checkPath,
  orgSlug,
  canManage,
  saving,
  onSave,
  onDelete,
  onClose,
}: {
  game: LeagueGame | null;
  teams: LeagueTeam[];
  venues: ClubVenueOption[];
  /** The season's sport — the facility's word. */
  sport: string | null | undefined;
  /** The window's live check (`/venue-check`). */
  checkPath: string;
  orgSlug: string;
  canManage: boolean;
  saving: boolean;
  onSave: (form: GameForm) => Promise<void>;
  /** Asks, then deletes the game — the question is the page's, on top of this window. */
  onDelete: (game: LeagueGame) => void;
  onClose: () => void;
}) {
  const B = useKitButtons(LEGACY_BUTTONS);
  const [form, setForm] = useState<GameForm>(() => {
    if (game) {
      return {
        homeTeamId:    game.homeTeamId,
        awayTeamId:    game.awayTeamId,
        scheduledDate: game.scheduledAt ? isoToDateInput(game.scheduledAt) : '',
        scheduledTime: game.scheduledAt ? isoToTimeInput(game.scheduledAt) : '',
        endTime:       game.endsAt ? isoToTimeInput(game.endsAt) : '',
        where:         whereOfLibraryRow(game, venues),
        status:        game.status,
        homeScore:     game.homeScore != null ? String(game.homeScore) : '',
        awayScore:     game.awayScore != null ? String(game.awayScore) : '',
        notes:         game.notes ?? '',
      };
    }
    return {
      homeTeamId: teams[0]?.id ?? '',
      awayTeamId: teams[1]?.id ?? '',
      scheduledDate: '', scheduledTime: '18:00', endTime: '',
      where: EMPTY_WHERE, status: 'scheduled',
      homeScore: '', awayScore: '', notes: '',
    };
  });

  function set(k: keyof GameForm, v: string) { setForm(f => ({ ...f, [k]: v })); }

  // The line under the field (Club Tier Stage 6a): the league's own refusal before Create, another program's
  // booking in amber. A cancelled or postponed game holds no slot, so it is never checked.
  const holdsSlot = form.status !== 'cancelled' && form.status !== 'postponed';
  const { refused, line, checking, lineIsCurrent } = useLeagueLine({
    checkPath, sport, where: form.where, venues, kind: 'game',
    occurrence: holdsSlot ? { date: form.scheduledDate, startTime: form.scheduledTime, endTime: form.endTime } : null,
    excludeGameId: game?.id ?? null,
  });

  const isCreate = !game;
  const showScores = form.status === 'completed';
  const homeTeam = teams.find(t => t.id === form.homeTeamId);
  const awayTeam = teams.find(t => t.id === form.awayTeamId);

  return (
    <div className={styles.modalOverlay} onPointerDown={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label={isCreate ? 'Add game' : 'Edit game'}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{isCreate ? 'Add game' : 'Edit game'}</h2>
          <button className={styles.modalCloseBtn} onClick={onClose} disabled={saving}><X size={18} /></button>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label}>Home team</label>
            <select className={styles.select} value={form.homeTeamId} onChange={e => set('homeTeamId', e.target.value)} disabled={!canManage}>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Away team</label>
            <select className={styles.select} value={form.awayTeamId} onChange={e => set('awayTeamId', e.target.value)} disabled={!canManage}>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Date</label>
            <DateInput className={styles.input} value={form.scheduledDate} onChange={v => set('scheduledDate', v)} disabled={!canManage} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Time</label>
            <TimeInput className={styles.input} value={form.scheduledTime} onChange={v => set('scheduledTime', v)} disabled={!canManage} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>End time <span style={{ fontWeight: 400, opacity: 0.5 }}>(optional)</span></label>
            <TimeInput className={styles.input} value={form.endTime} onChange={v => set('endTime', v)} disabled={!canManage} />
          </div>
        </div>

        <div className={styles.formGrid}>
          <LeagueWhere
            idPrefix="hl-game"
            venues={venues}
            sport={sport}
            value={form.where}
            onChange={w => setForm(f => ({ ...f, where: w }))}
            orgSlug={orgSlug}
            canManage={canManage}
            disabled={!canManage}
            line={line}
          />
          <div className={styles.field}>
            <label className={styles.label}>Status</label>
            <select className={styles.select} value={form.status} onChange={e => set('status', e.target.value as LeagueGameStatus)} disabled={!canManage}>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="postponed">Postponed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {showScores && (
          <div className={styles.formGrid} style={{ marginTop: '0.25rem' }}>
            <div className={styles.field}>
              <label className={styles.label}>{homeTeam?.name ?? 'Home'} score</label>
              <input type="number" min={0} className={styles.input} value={form.homeScore} onChange={e => set('homeScore', e.target.value)} disabled={!canManage} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>{awayTeam?.name ?? 'Away'} score</label>
              <input type="number" min={0} className={styles.input} value={form.awayScore} onChange={e => set('awayScore', e.target.value)} disabled={!canManage} />
            </div>
          </div>
        )}

        <div className={styles.field} style={{ marginTop: '0.25rem' }}>
          <label className={styles.label}>Notes <span style={{ fontWeight: 400, opacity: 0.5 }}>(optional)</span></label>
          <textarea className={styles.textarea} value={form.notes} onChange={e => set('notes', e.target.value)} disabled={!canManage} rows={2} />
        </div>

        {/* Delete ends the body, alone, red, and asks first (owner, 2026-10-09, §288 W9) — a rare door never takes the
            foot, which stays the form's. Calling a game off is Status → Cancelled; Delete is for a game that should
            never have been on the schedule. Not on Add Game: there is nothing to delete yet. */}
        {game && canManage && (
          <div style={{ marginTop: '0.75rem' }}>
            <RecordDelete onClick={() => onDelete(game)} disabled={saving}>Delete this game</RecordDelete>
          </div>
        )}

        {/* The foot is the form's: Cancel and the one save (owner, 2026-10-09 — the portal's create-form pair; the ×
            above also closes). ⚰ "Cancel Game" is gone: it only set Status to Cancelled, which the Status field above
            already does, and it sat beside this Cancel meaning the opposite. A reader who can't change the game has
            no foot — the × is the way out, as on every record window. */}
        {canManage && (
          <div className={styles.modalFooter}>
            <button style={B.secondary} onClick={onClose} disabled={saving}>Cancel</button>
            <button
              style={refused ? { ...B.primary, ...REFUSED_LOOK } : B.primary}
              onClick={async () => { if (await lineIsCurrent()) await onSave(form); }}
              disabled={saving || refused || checking}
            >
              {saving ? 'Saving…' : isCreate ? 'Create game' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

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
  venues,
  sport,
  checkPath,
  orgSlug,
  saving,
  editing,
  onSave,
  onClose,
}: {
  team: LeagueTeam;
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
  const title = editing ? PRACTICE_WINDOW_WORDS.editTitle(team.name) : `Add practice — ${team.name}`;

  function set(k: keyof PracticeForm, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }));
  }

  // The line under the field (Club Tier Stage 6a): a series is checked date by date — the same dates the save will
  // write — and its refusal names the date; another program's booking names its dates in amber. An edit checks the
  // dates it reaches, leaving out the practices it moves.
  const { refused, line, checking, lineIsCurrent } = useLeagueLine({
    checkPath, sport, where: form.where, venues, kind: 'practice', teamId: team.id,
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
            disabled={saving || refused || checking}
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

export default function SchedulePage() {
  const { orgSlug, seasonId } = useParams<{ orgSlug: string; seasonId: string }>();
  const { currentOrg } = useOrg();
  // Admin Design Continuity slice 2: the kit's patch over each hand-set style while the switch is on.
  const kx = useKitStyle();
  const B = useKitButtons(LEGACY_BUTTONS);
  // J3-012: every /api/admin fetch must carry the org slug so the server resolves the URL's org.
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';

  const [season, setSeason] = useState<SeasonInfo | null>(null);
  const [venues, setVenues] = useState<OrgVenue[]>([]);
  const [health, setHealth] = useState<ScheduleHealth | null>(null);
  const [divisions, setDivisions] = useState<LeagueDivision[]>([]);
  const [selectedDivId, setSelectedDivId] = useState('');
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [games, setGames] = useState<LeagueGame[]>([]);
  const [practices, setPractices] = useState<LeaguePractice[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [viewMode, setViewMode] = useState<'week' | 'list' | 'practices'>('week');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showGenerate, setShowGenerate] = useState(false);
  const [gameModalOpen, setGameModalOpen] = useState(false);
  const [activeGame, setActiveGame] = useState<LeagueGame | null>(null);

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
  const openLeagueTime = () => { setTimeOn(null); setBackToPractice(false); setTimeOpen(true); };
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

  // Season-wide clash + unchecked counts — games AND practices, every division.
  const loadHealth = useCallback(async () => {
    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/schedule/health${orgQuery}`);
    if (res.ok) setHealth(await res.json());
  }, [seasonId, orgQuery]);

  const loadTeamsAndGames = useCallback(async (divId: string) => {
    const orgParam = orgQuery ? orgQuery.replace('?', '&') : '';
    const [teamsRes, gamesRes] = await Promise.all([
      fetch(`/api/admin/house-league/seasons/${seasonId}/teams?divisionId=${divId}${orgParam}`),
      fetch(`/api/admin/house-league/seasons/${seasonId}/schedule?divisionId=${divId}${orgParam}`),
    ]);
    const newTeams = teamsRes.ok ? ((await teamsRes.json()).teams ?? []) : [];
    setTeams(newTeams);
    setSelectedTeamId(t => t || (newTeams[0]?.id ?? ''));
    if (gamesRes.ok) setGames((await gamesRes.json()).games ?? []);
  }, [seasonId, orgQuery]);

  const loadPractices = useCallback(async (teamId: string) => {
    const orgParam = orgQuery ? orgQuery.replace('?', '&') : '';
    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/practices?teamId=${teamId}${orgParam}`);
    if (res.ok) setPractices((await res.json()).practices ?? []);
  }, [seasonId, orgQuery]);

  useEffect(() => {
    setLoading(true);
    loadSeasonAndDivisions().finally(() => setLoading(false));
  }, [loadSeasonAndDivisions]);

  useEffect(() => { void loadVenues(); }, [loadVenues]);
  useEffect(() => { void loadHealth(); }, [loadHealth]);

  useEffect(() => {
    if (selectedDivId) {
      setSelectedTeamId('');
      loadTeamsAndGames(selectedDivId);
    }
  }, [selectedDivId, loadTeamsAndGames]);

  useEffect(() => {
    if (viewMode === 'practices' && selectedTeamId) {
      void loadPractices(selectedTeamId);
    }
  }, [viewMode, selectedTeamId, loadPractices]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const selectedDiv = divisions.find(d => d.id === selectedDivId);
  const teamMap = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);

  // Sport-neutral surface noun ("Diamond" / "Court" / "Field") — never hard-coded.
  const noun = fieldNounFor(season?.sport);
  // The club's venues as the Venue field offers them (Club Tier Stage 6a), and the windows' live check.
  const clubVenues = useMemo(() => clubVenueOptions(venues), [venues]);
  const checkPath = `/api/admin/house-league/seasons/${seasonId}/venue-check${orgQuery}`;
  const conflictKeys = useMemo(
    () => new Set((health?.conflicts ?? []).map(c => `${c.kind}:${c.id}`)),
    [health],
  );

  const weekGroups = useMemo(() => {
    const map = new Map<string, LeagueGame[]>();
    const unscheduled: LeagueGame[] = [];
    for (const g of games) {
      if (!g.scheduledAt) { unscheduled.push(g); continue; }
      const key = orgWeekKey(g.scheduledAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    }
    const sorted = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
    if (unscheduled.length) sorted.push(['unscheduled', unscheduled]);
    return sorted;
  }, [games]);

  const practiceWeekGroups = useMemo(() => {
    const map = new Map<string, LeaguePractice[]>();
    const unscheduled: LeaguePractice[] = [];
    for (const p of practices) {
      if (!p.scheduledAt) { unscheduled.push(p); continue; }
      const key = orgWeekKey(p.scheduledAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    const sorted = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
    if (unscheduled.length) sorted.push(['unscheduled', unscheduled]);
    return sorted;
  }, [practices]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function showError(title: string, message: string) {
    setFeedback({ isOpen: true, title, message, type: 'danger' });
  }

  function openCreate() { setActiveGame(null); setGameModalOpen(true); }
  function openEdit(g: LeagueGame) { setActiveGame(g); setGameModalOpen(true); }

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
    await loadTeamsAndGames(selectedDivId);
    await loadHealth();
  }

  // ── Game CRUD ──────────────────────────────────────────────────────────────

  async function handleSaveGame(form: GameForm) {
    setSaving(true);
    const isCreate = !activeGame;
    const url = isCreate
      ? `/api/admin/house-league/seasons/${seasonId}/schedule${orgQuery}`
      : `/api/admin/house-league/seasons/${seasonId}/schedule/${activeGame!.id}${orgQuery}`;
    const method = isCreate ? 'POST' : 'PATCH';

    const body: Record<string, unknown> = {
      divisionId:    selectedDivId,
      homeTeamId:    form.homeTeamId,
      awayTeamId:    form.awayTeamId,
      scheduledDate: form.scheduledDate || undefined,
      scheduledTime: form.scheduledTime || undefined,
      endTime:       form.endTime || null,
      ...whereLibraryBody(form.where),
      status:        form.status,
      notes:         form.notes || null,
    };

    if (form.status === 'completed') {
      body.homeScore = form.homeScore !== '' ? Number(form.homeScore) : null;
      body.awayScore = form.awayScore !== '' ? Number(form.awayScore) : null;
    }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      showError(
        res.status === 409 ? `That ${noun.toLowerCase()} is already booked` : 'Could not save game',
        data.error ?? 'Unknown error',
      );
      return;
    }
    const data = await res.json();
    setGameModalOpen(false);
    if (Array.isArray(data.warnings) && data.warnings.length) {
      setFeedback({ isOpen: true, title: 'Saved — possible clash', message: data.warnings[0], type: 'info' });
    }
    await loadTeamsAndGames(selectedDivId);
    await loadHealth();
  }

  // The question opens on top of Edit Game; Keep it leaves the window as it was.
  function askDeleteGame(g: LeagueGame) {
    const name = `${teamMap.get(g.homeTeamId)?.name ?? 'Home'} vs ${teamMap.get(g.awayTeamId)?.name ?? 'Away'}`;
    const scored = g.status === 'completed' && g.homeScore != null && g.awayScore != null;
    setFeedback({
      isOpen: true,
      title: `Delete ${name}?`,
      message: `It leaves the schedule and the public page for good.${scored ? ' Its score comes out of the standings.' : ''}`
        + ' To call a game off but keep it listed, set Status to Cancelled instead.',
      type: 'danger',
      confirmText: 'Delete',
      cancelText: 'Keep it',
      onConfirm: () => { void deleteGame(g); },
    });
  }

  async function deleteGame(g: LeagueGame) {
    setSaving(true);
    let res: Response;
    // ⚠ A dropped connection must not leave `saving` on: the window's ×, Save and Delete all wait on it (/review).
    try {
      res = await fetch(`/api/admin/house-league/seasons/${seasonId}/schedule/${g.id}${orgQuery}`, { method: 'DELETE' });
    } catch {
      showError('Could not delete game', 'The connection dropped. Check it and try again.');
      return;
    } finally {
      setSaving(false);
    }
    // A 404 is a game someone else already deleted — what was asked for, so the window closes on the fresh list
    // rather than holding a game that no longer exists.
    if (!res.ok && res.status !== 404) {
      showError('Could not delete game', (await res.json().catch(() => ({}))).error ?? 'Unknown error');
      return;
    }
    setGameModalOpen(false);
    setActiveGame(null);
    await loadTeamsAndGames(selectedDivId);
    await loadHealth();
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
      void loadPractices(selectedTeamId);
      return;
    }
    setEditingPractice(null);
    if (Array.isArray(data?.warnings) && data.warnings.length) {
      setFeedback({ isOpen: true, title: PRACTICE_WINDOW_WORDS.saved(data.count ?? 1), message: `Possible clash: ${data.warnings[0]}`, type: 'info' });
    }
    await loadPractices(selectedTeamId);
    await loadHealth();
  }

  async function handleSavePractice(form: PracticeForm) {
    if (editingPractice) return handleEditPractice(form);
    setSaving(true);
    const body: Record<string, unknown> = {
      teamId:     selectedTeamId,
      divisionId: selectedDivId || null,
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
    await loadPractices(selectedTeamId);
    await loadHealth();
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
    await loadPractices(selectedTeamId);
    await loadHealth();
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  function buildGameExportRows() {
    return games.map(g => {
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

  function handleExportXLSX() {
    const rows     = buildGameExportRows();
    const headers  = serializeHeaders(SCHEDULE_EXPORT_COLS);
    const data     = serializeRows(rows, SCHEDULE_EXPORT_COLS);
    const filename = buildFilename(
      { org: currentOrg?.slug, dataset: 'hl-schedule', scope: season?.name },
      'xlsx',
    );
    downloadXLSX(filename, headers, data, 'Schedule');
  }

  function handleExportCSV() {
    const rows     = buildGameExportRows();
    const headers  = serializeHeaders(SCHEDULE_EXPORT_COLS);
    const data     = serializeRows(rows, SCHEDULE_EXPORT_COLS);
    const filename = buildFilename(
      { org: currentOrg?.slug, dataset: 'hl-schedule', scope: season?.name },
      'csv',
    );
    downloadCSVBlob(filename, generateCSV(headers, data));
  }

  // From the instant, never a universal date beside a zoned clock — see `lib/export/schedule-calendar`.
  async function handleExportICS() {
    const filename = buildFilename(
      { org: currentOrg?.slug, dataset: 'hl-schedule', scope: season?.name },
      'ics',
    );
    await downloadICSFromInstants(
      filename,
      houseLeagueCalendarEntries(games, id => teamMap.get(id)?.name),
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
        setViewMode('practices');
        if (selectedTeamId) void loadPractices(selectedTeamId);
        void loadHealth();
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

  return (
    <>
    <div className={styles.page}>
      {/* Header — today's as `legacy` while the switch is off. On the kit (F3) the season's name (the
          subtitle) is the way up, in the leading corner. */}
      <AdminPageHeader
        eyebrow="House league"
        title="Schedule"
        backTo={{ href: backHref, label: season?.name ?? 'Season' }}
      />

      {/* The time line (Stage 11b Part 3): where this division's time comes from, and the door to House league's time. */}
      {leagueTime && selectedDivId && showTimeLine(leagueTime, buildsSchedules) && (
        <HouseLeagueTimeLine time={leagueTime} divisionId={selectedDivId}
          divisionName={divisions.find(d => d.id === selectedDivId)?.name ?? ''} onOpen={openLeagueTime} />
      )}

      {/* Toolbar */}
      <div className={styles.scheduleToolbar}>
        {divisions.length > 1 && (
          <>
            <select
              className={styles.divSelect}
              value={selectedDivId}
              onChange={e => setSelectedDivId(e.target.value)}
            >
              {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <div className={styles.toolbarSep} />
          </>
        )}

        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewToggleBtn} ${viewMode === 'week' ? styles.viewToggleBtnActive : ''}`}
            onClick={() => setViewMode('week')}
          >
            Week
          </button>
          <button
            className={`${styles.viewToggleBtn} ${viewMode === 'list' ? styles.viewToggleBtnActive : ''}`}
            onClick={() => setViewMode('list')}
          >
            List
          </button>
          <button
            className={`${styles.viewToggleBtn} ${viewMode === 'practices' ? styles.viewToggleBtnActive : ''}`}
            onClick={() => setViewMode('practices')}
          >
            Practices
          </button>
        </div>

        {viewMode !== 'practices' && canManage && (
          <>
            <div className={styles.toolbarSep} />
            {teams.length >= 2 && (
              <button style={B.secondary} onClick={() => setShowGenerate(true)}>
                <Wand2 size={14} style={{ marginRight: 4 }} />
                Generate schedule
              </button>
            )}
            <button style={B.secondary} onClick={openCreate}>
              <Plus size={14} style={{ marginRight: 4 }} />
              Add game
            </button>
          </>
        )}

        {viewMode === 'practices' && (
          <>
            {teams.length > 0 && (
              <>
                <div className={styles.toolbarSep} />
                <select
                  className={styles.divSelect}
                  value={selectedTeamId}
                  onChange={e => setSelectedTeamId(e.target.value)}
                >
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </>
            )}
            {canManage && selectedTeamId && (
              <>
                <div className={styles.toolbarSep} />
                <button style={B.secondary} onClick={() => setShowPracticeModal(true)}>
                  <Plus size={14} style={{ marginRight: 4 }} />
                  Add practice
                </button>
              </>
            )}
          </>
        )}

        {/* Tools ⋯ at the toolbar's right end (Stage 11b Part 3; ruled 9d-2, card 7): House league's time, then Export as
            a flat group — where 9d-2a's toolbar rebuild puts it, so that rebuild never moves it. Export shows where it
            showed before (not on Practices), and keeps its free-floor case: exports are a paid-League capability, so the
            free League Starter floor reads why instead. NOTE: exports are 100% client-side today (no server route). If a
            server export route is ever added for house-league it MUST guard isFreeFloorLeague(org) → 403. */}
        <div style={{ marginLeft: 'auto' }}>
          <CoachToolbarMenu label={LEAGUE_TIME_WORDS.tools} icon={<MoreHorizontal size={18} className={tb.toolsGlyph} aria-hidden />}
            collapseOnPhone bareOnPhone drawerOnPhone drawerTitle={LEAGUE_TIME_WORDS.tools} triggerClassName={tb.tool}>
            <CoachToolbarMenuItem icon={<Clock size={15} aria-hidden />} label={LEAGUE_TIME_WORDS.title} onSelect={openLeagueTime} />
            {/* Practice time (Part 4): the league's runners on a live season, for the division picked. */}
            {canManage && selectedDiv && (
              <CoachToolbarMenuItem icon={<CalendarClock size={15} aria-hidden />} label={PRACTICE_TIME_WORDS.title} onSelect={() => setPracticeTimeOpen(true)} />
            )}
            {viewMode !== 'practices' && <>
              <CoachToolbarMenuSeparator />
              <CoachToolbarMenuHeading>{LEAGUE_TIME_WORDS.exportHeading}</CoachToolbarMenuHeading>
              {currentOrg && isFreeFloorLeague(currentOrg)
                ? <CoachToolbarMenuItem disabled label={LEAGUE_TIME_WORDS.exportsLocked}
                    hint={LEAGUE_TIME_WORDS.exportsLockedHint} onSelect={() => {}} />
                : <>
                    <CoachToolbarMenuItem label={LEAGUE_TIME_WORDS.excel} disabled={games.length === 0} onSelect={() => void handleExportXLSX()} />
                    <CoachToolbarMenuItem label={LEAGUE_TIME_WORDS.csv} disabled={games.length === 0} onSelect={() => void handleExportCSV()} />
                    <CoachToolbarMenuItem label={LEAGUE_TIME_WORDS.calendar} disabled={games.length === 0} onSelect={() => void handleExportICS()} />
                  </>}
            </>}
          </CoachToolbarMenu>
        </div>
      </div>

      {/* Schedule health — clashes + what could not be checked (games AND practices) */}
      {health && health.conflicts.length > 0 && (
        <div style={kx({
          border: '1px solid rgba(var(--warning-rgb),0.35)', background: 'rgba(var(--warning-rgb),0.07)',
          borderRadius: '2px', padding: '0.7rem 0.9rem', marginBottom: '0.9rem',
        }, { borderRadius: '8px' })}>
          <div style={kx({ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--warning)', fontWeight: 700, fontSize: '0.82rem' }, { color: 'var(--badge-warning-ink)' })}>
            <AlertTriangle size={15} />
            {health.conflicts.length === 1
              ? `1 booking shares a ${noun.toLowerCase()} with another at the same time`
              : `${health.conflicts.length} bookings share a ${noun.toLowerCase()} with another at the same time`}
          </div>
          <ul style={{ margin: '0.45rem 0 0', paddingLeft: '1.4rem', fontSize: '0.8rem', color: 'var(--white-60)' }}>
            {health.conflicts.slice(0, 4).map((c, i) => {
              const dt = c.startsAt ? formatDateTime(c.startsAt) : null;
              return (
                <li key={i} style={{ marginBottom: '0.15rem' }}>
                  {c.label ?? c.kind}{dt ? ` · ${dt.date} ${dt.time}` : ''} overlaps {c.partnerLabel ?? c.partnerKind}
                  {c.fieldLabel ? ` on ${c.fieldLabel}` : ''}
                  {c.matchedOn === 'text' ? ' (both use the same typed location — may be different places)' : ''}
                </li>
              );
            })}
            {health.conflicts.length > 4 && (
              <li style={{ opacity: 0.6 }}>…and {health.conflicts.length - 4} more</li>
            )}
          </ul>
        </div>
      )}
      {health && health.uncheckedCount > 0 && (
        <p style={kx({ fontSize: '0.78rem', color: 'var(--white-45)', margin: '0 0 0.9rem' }, KIT_INK.tertiary)}>
          {health.uncheckedCount} scheduled {health.uncheckedCount === 1 ? 'booking has' : 'bookings have'} no {noun.toLowerCase()} set
          — {health.uncheckedCount === 1 ? 'it is' : 'they are'} not being checked for double-bookings.
        </p>
      )}

      {/* Empty state (games views) */}
      {viewMode !== 'practices' && games.length === 0 && (
        <div className={styles.emptyState}>
          {teams.length >= 2 && canManage ? (
            <HelpCallout
              variant="info"
              title="No games scheduled yet"
              body="Generate your schedule by selecting the number of rounds and time slots — the generator creates a round-robin where every team plays every other team once. Games can be edited individually after generation, or added manually one at a time."
            />
          ) : (
            <p>
              {teams.length < 2
                ? 'Create at least 2 teams before generating a schedule.'
                : 'No games scheduled yet.'}
            </p>
          )}
        </div>
      )}

      {/* Week view */}
      {viewMode === 'week' && games.length > 0 && (
        <>
          {weekGroups.map(([key, weekGames]) => (
            <div key={key} className={styles.weekGroup}>
              <div className={styles.weekLabel}>
                {key === 'unscheduled' ? 'Unscheduled' : weekLabel(key)}
              </div>
              <div className={styles.weekGames}>
                {weekGames.map(g => {
                  const home = teamMap.get(g.homeTeamId);
                  const away = teamMap.get(g.awayTeamId);
                  const dt = g.scheduledAt ? formatDateTime(g.scheduledAt) : null;
                  return (
                    <div
                      key={g.id}
                      className={`${styles.gameCard} ${g.status === 'cancelled' ? styles.gameCardCancelled : ''}`}
                      onClick={() => openEdit(g)}
                    >
                      <div className={styles.gameCardTeams}>
                        {home?.color && <span className={styles.teamDot} style={{ background: home.color }} />}
                        <span className={styles.gameTeamName}>{home?.name ?? '—'}</span>
                        <span className={styles.gameVs}>vs</span>
                        {away?.color && <span className={styles.teamDot} style={{ background: away.color }} />}
                        <span className={styles.gameTeamName}>{away?.name ?? '—'}</span>
                      </div>
                      {g.status === 'completed' && g.homeScore != null && g.awayScore != null && (
                        <div className={styles.gameScore}>
                          {g.homeScore} – {g.awayScore}
                        </div>
                      )}
                      {dt && (
                        <div className={styles.gameCardMeta}>
                          <span>{dt.date}</span>
                          <span>{dt.time}</span>
                          {g.location && <span>{g.location}</span>}
                        </div>
                      )}
                      <div className={styles.gameCardFooter}>
                        <span className={`${styles.statusBadge} ${STATUS_CLASS[g.status]}`}>
                          {STATUS_LABELS[g.status]}
                        </span>
                        {conflictKeys.has(`game:${g.id}`) && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--warning)' }}>
                            <AlertTriangle size={11} /> Double-booked
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {/* List view */}
      {viewMode === 'list' && games.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.scheduleTable}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Home</th>
                <th>Away</th>
                <th>Location</th>
                <th>Score</th>
                <th>Status</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {games.map(g => {
                const home = teamMap.get(g.homeTeamId);
                const away = teamMap.get(g.awayTeamId);
                const dt = g.scheduledAt ? formatDateTime(g.scheduledAt) : null;
                return (
                  <tr key={g.id} className={g.status === 'cancelled' ? styles.gameCancelled : undefined}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {dt ? `${dt.date} ${dt.time}` : <span style={{ opacity: 0.4 }}>—</span>}
                    </td>
                    <td>
                      {home?.color && <span className={styles.teamDot} style={{ background: home.color }} />}
                      {home?.name ?? '—'}
                    </td>
                    <td>
                      {away?.color && <span className={styles.teamDot} style={{ background: away.color }} />}
                      {away?.name ?? '—'}
                    </td>
                    <td>
                      {g.location ?? <span style={{ opacity: 0.4 }}>—</span>}
                      {conflictKeys.has(`game:${g.id}`) && (
                        <span title="Another booking shares this surface at the same time" style={{ marginLeft: '0.35rem', color: 'var(--warning)', verticalAlign: 'middle', display: 'inline-flex' }}>
                          <AlertTriangle size={12} />
                        </span>
                      )}
                    </td>
                    <td className={styles.scoreCell}>
                      {g.status === 'completed' && g.homeScore != null
                        ? `${g.homeScore} – ${g.awayScore}`
                        : <span style={{ opacity: 0.3, fontWeight: 400 }}>—</span>}
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${STATUS_CLASS[g.status]}`}>
                        {STATUS_LABELS[g.status]}
                      </span>
                    </td>
                    {canManage && (
                      <td>
                        <button className={styles.iconBtn} onClick={() => openEdit(g)} style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}>
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Practices view */}
      {viewMode === 'practices' && (
        <>
          {teams.length === 0 && (
            <div className={styles.emptyState}>
              <p>No teams in this division yet. Create teams before scheduling practices.</p>
            </div>
          )}

          {teams.length > 0 && practices.length === 0 && (
            <div className={styles.emptyState}>
              <p>
                {canManage
                  ? 'No practices scheduled for this team. Use "Add practice" to get started.'
                  : 'No practices scheduled yet.'}
              </p>
            </div>
          )}

          {practices.length > 0 && practiceWeekGroups.map(([key, weekPractices]) => (
            <div key={key} className={styles.weekGroup}>
              <div className={styles.weekLabel}>
                {key === 'unscheduled' ? 'Unscheduled' : weekLabel(key)}
              </div>
              <div className={styles.weekGames}>
                {weekPractices.map(p => {
                  const team = teamMap.get(p.teamId);
                  const dt = p.scheduledAt ? formatDateTime(p.scheduledAt) : null;
                  const endDt = p.endsAt ? formatDateTime(p.endsAt) : null;
                  // Every practice opens its window, read first (Part 4, h2); its doors are the window's.
                  return (
                    <div
                      key={p.id}
                      className={`${styles.practiceCard} ${p.status === 'cancelled' ? styles.gameCardCancelled : ''}`}
                      style={{ cursor: 'pointer' }}
                      role="button"
                      tabIndex={0}
                      onClick={() => setOpenPractice(p)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenPractice(p); } }}
                    >
                      <div className={styles.practiceCardHeader}>
                        {team?.color && <span className={styles.teamDot} style={{ background: team.color }} />}
                        <span className={styles.gameTeamName}>{team?.name ?? 'Unknown team'}</span>
                        {p.recurrenceGroupId && (
                          <span className={styles.recurrenceBadge}>↻ Series</span>
                        )}
                      </div>
                      {dt && (
                        <div className={styles.gameCardMeta}>
                          <span>{dt.date}</span>
                          <span>{dt.time}{endDt ? ` – ${endDt.time}` : ''}</span>
                          {p.location && <span>{p.location}</span>}
                          {p.clubScheduleSlotId && <span>{PRACTICE_WINDOW_WORDS.fromCard(p.fromSchedule)}</span>}
                        </div>
                      )}
                      {p.notes && (
                        <div style={kx({ fontSize: '0.72rem', color: 'var(--white-35)', marginTop: '0.3rem', fontStyle: 'italic' }, KIT_INK.tertiary)}>
                          {p.notes}
                        </div>
                      )}
                      <div className={styles.gameCardFooter}>
                        <span className={`${styles.statusBadge} ${p.status === 'cancelled' ? styles.gameStatusCancelled : styles.practiceBadge}`}>
                          {p.status === 'cancelled' ? 'Cancelled' : 'Practice'}
                        </span>
                        {conflictKeys.has(`practice:${p.id}`) && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--warning)' }}>
                            <AlertTriangle size={11} /> Double-booked
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Generate modal */}
      {showGenerate && selectedDiv && (
        <GenerateModal
          divisionName={selectedDiv.name}
          teams={teams}
          venues={clubVenues}
          sport={season?.sport}
          orgSlug={orgSlug}
          saving={saving}
          onPreview={handlePreview}
          onSave={handleGenerateSave}
          onClose={() => setShowGenerate(false)}
        />
      )}

      {/* Game create/edit modal */}
      {gameModalOpen && (
        <GameModal
          game={activeGame}
          teams={teams}
          venues={clubVenues}
          sport={season?.sport}
          checkPath={checkPath}
          orgSlug={orgSlug}
          canManage={canManage}
          saving={saving}
          onSave={handleSaveGame}
          onDelete={askDeleteGame}
          onClose={() => setGameModalOpen(false)}
        />
      )}

      {/* Practice create modal */}
      {showPracticeModal && selectedTeamId && teamMap.get(selectedTeamId) && (
        <PracticeModal
          team={teamMap.get(selectedTeamId)!}
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
          divisionName={selectedDiv?.name ?? ''} teamPractices={practices} canRun={canManage}
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

      {/* A hand-booked practice's form, opened to edit */}
      {editingPractice && teamMap.get(editingPractice.practice.teamId) && (
        <PracticeModal
          team={teamMap.get(editingPractice.practice.teamId)!}
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
