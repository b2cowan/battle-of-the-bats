'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, Calendar, ChevronLeft, Plus, X, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { useOrg } from '@/lib/org-context';
import { ORG_TIME_ZONE, utcToZonedInputs, tournamentToday } from '@/lib/timezone';
import { isFreeFloorLeague } from '@/lib/free-floor';
import { hasCapability } from '@/lib/roles';
import { fieldNounFor } from '@/lib/sports';
import FeedbackModal from '@/components/FeedbackModal';
import HelpCallout from '@/components/help/HelpCallout';
import {
  downloadXLSX, generateCSV, downloadCSVBlob, downloadICS,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef, type ICSEventInput,
} from '@/lib/export';
import ExportMenu from '@/components/admin/ExportMenu';
import styles from '../../../house-league.module.css';
import type { LeagueDivision, LeagueTeam, LeagueGame, LeagueGameStatus, LeaguePractice, OrgVenue } from '@/lib/types';

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

interface SeasonInfo { id: string; name: string; sport: string | null; }

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
  venueKey: string;
  location: string;
  status: LeagueGameStatus;
  homeScore: string;
  awayScore: string;
  notes: string;
}

interface GenerateConfig {
  startDate: string;
  gamesPerWeek: number;
  gameTime: string;
  venueKey: string;
  location: string;
}

interface PracticeForm {
  recurring: boolean;
  scheduledDate: string;
  dayOfWeek: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  venueKey: string;
  location: string;
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

function weekKey(iso: string): string {
  const d = new Date(iso);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function weekLabel(key: string): string {
  return `Week of ${new Date(key).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}`;
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

// ── Field picker (org venue library) ──────────────────────────────────────────

/**
 * One dropdown value encodes the whole selection:
 *   ''                       — no field set
 *   `v:<venueId>`            — a venue (no specific surface)
 *   `f:<venueId>:<facId>`    — a specific surface
 *   'text'                   — off-site / typed free text (reveals the text input)
 */
function venueKeyFor(orgVenueId: string | null, orgVenueFacilityId: string | null, location: string | null): string {
  if (orgVenueId && orgVenueFacilityId) return `f:${orgVenueId}:${orgVenueFacilityId}`;
  if (orgVenueId) return `v:${orgVenueId}`;
  return location ? 'text' : '';
}

function decodeVenueKey(key: string): { orgVenueId: string | null; orgVenueFacilityId: string | null; isText: boolean } {
  if (key.startsWith('f:')) {
    const [, venueId, facId] = key.split(':');
    return { orgVenueId: venueId ?? null, orgVenueFacilityId: facId ?? null, isText: false };
  }
  if (key.startsWith('v:')) {
    return { orgVenueId: key.slice(2) || null, orgVenueFacilityId: null, isText: false };
  }
  return { orgVenueId: null, orgVenueFacilityId: null, isText: key === 'text' };
}

/**
 * Picking a real field is the default path; typing text is the explicit
 * "somewhere else" choice — the same demotion the tournament side is getting.
 */
function FieldPicker({
  venues, noun, venueKey, locationText, disabled, orgSlug, canManage,
  onKeyChange, onTextChange,
}: {
  venues: OrgVenue[];
  /** Sport-Pack surface noun, e.g. "Diamond" / "Court". */
  noun: string;
  venueKey: string;
  locationText: string;
  disabled?: boolean;
  orgSlug: string;
  canManage: boolean;
  onKeyChange: (key: string) => void;
  onTextChange: (text: string) => void;
}) {
  const hasLibrary = venues.length > 0;
  return (
    <div className={`${styles.field} ${styles.formGridFull}`}>
      <label className={styles.label}>{noun}</label>
      {hasLibrary ? (
        <>
          <select
            className={styles.select}
            value={venueKey}
            onChange={e => onKeyChange(e.target.value)}
            disabled={disabled}
          >
            <option value="">— No {noun.toLowerCase()} set —</option>
            {venues.map(v => (
              (v.facilities && v.facilities.length > 0) ? (
                <optgroup key={v.id} label={v.name}>
                  <option value={`v:${v.id}`}>{v.name} (any surface)</option>
                  {v.facilities.map(f => (
                    <option key={f.id} value={`f:${v.id}:${f.id}`}>{v.name} — {f.name}</option>
                  ))}
                </optgroup>
              ) : (
                <option key={v.id} value={`v:${v.id}`}>{v.name}</option>
              )
            ))}
            <option value="text">Somewhere else (type it)</option>
          </select>
          {venueKey === 'text' && (
            <input
              className={styles.input}
              style={{ marginTop: '0.4rem' }}
              value={locationText}
              onChange={e => onTextChange(e.target.value)}
              placeholder={`${noun} name or address`}
              disabled={disabled}
            />
          )}
        </>
      ) : (
        <>
          <input
            className={styles.input}
            value={locationText}
            onChange={e => onTextChange(e.target.value)}
            placeholder={`${noun} name or address`}
            disabled={disabled}
          />
          {canManage && (
            <p className={styles.hint}>
              Typed locations can&apos;t be checked for double-bookings.{' '}
              <Link href={`/${orgSlug}/admin/org/venues`} style={{ color: 'var(--logic-lime)' }}>
                Set up your {noun.toLowerCase()}s once
              </Link>{' '}
              to pick them from a list.
            </p>
          )}
        </>
      )}
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

// ── Game Modal (create + edit) ────────────────────────────────────────────────

function GameModal({
  game,
  teams,
  venues,
  noun,
  orgSlug,
  canManage,
  saving,
  onSave,
  onCancel: onCancelGame,
  onClose,
}: {
  game: LeagueGame | null;
  teams: LeagueTeam[];
  venues: OrgVenue[];
  noun: string;
  orgSlug: string;
  canManage: boolean;
  saving: boolean;
  onSave: (form: GameForm) => Promise<void>;
  onCancel: () => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<GameForm>(() => {
    if (game) {
      return {
        homeTeamId:    game.homeTeamId,
        awayTeamId:    game.awayTeamId,
        scheduledDate: game.scheduledAt ? isoToDateInput(game.scheduledAt) : '',
        scheduledTime: game.scheduledAt ? isoToTimeInput(game.scheduledAt) : '',
        endTime:       game.endsAt ? isoToTimeInput(game.endsAt) : '',
        venueKey:      venueKeyFor(game.orgVenueId, game.orgVenueFacilityId, game.location),
        location:      game.location ?? '',
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
      venueKey: '', location: '', status: 'scheduled',
      homeScore: '', awayScore: '', notes: '',
    };
  });

  function set(k: keyof GameForm, v: string) { setForm(f => ({ ...f, [k]: v })); }

  const isCreate = !game;
  const showScores = form.status === 'completed';
  const homeTeam = teams.find(t => t.id === form.homeTeamId);
  const awayTeam = teams.find(t => t.id === form.awayTeamId);

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{isCreate ? 'Add Game' : 'Edit Game'}</h2>
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
            <input type="date" className={styles.input} value={form.scheduledDate} onChange={e => set('scheduledDate', e.target.value)} disabled={!canManage} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Time</label>
            <input type="time" className={styles.input} value={form.scheduledTime} onChange={e => set('scheduledTime', e.target.value)} disabled={!canManage} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>End time <span style={{ fontWeight: 400, opacity: 0.5 }}>(optional)</span></label>
            <input type="time" className={styles.input} value={form.endTime} onChange={e => set('endTime', e.target.value)} disabled={!canManage} />
          </div>
        </div>

        <div className={styles.formGrid}>
          <FieldPicker
            venues={venues}
            noun={noun}
            venueKey={form.venueKey}
            locationText={form.location}
            disabled={!canManage}
            orgSlug={orgSlug}
            canManage={canManage}
            onKeyChange={k => set('venueKey', k)}
            onTextChange={t => set('location', t)}
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

        <div className={styles.modalFooter}>
          {!isCreate && canManage && (
            <button style={BTN_DANGER} onClick={onCancelGame} disabled={saving}>
              Cancel Game
            </button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.6rem' }}>
            <button style={BTN_SECONDARY} onClick={onClose} disabled={saving}>Close</button>
            {canManage && (
              <button style={BTN_PRIMARY} onClick={() => onSave(form)} disabled={saving}>
                {saving ? 'Saving…' : isCreate ? 'Create Game' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Generate Modal ────────────────────────────────────────────────────────────

function GenerateModal({
  divisionName,
  teams,
  venues,
  noun,
  orgSlug,
  saving,
  onPreview,
  onSave,
  onClose,
}: {
  divisionName: string;
  teams: LeagueTeam[];
  venues: OrgVenue[];
  noun: string;
  orgSlug: string;
  saving: boolean;
  onPreview: (cfg: GenerateConfig) => Promise<PreviewGame[]>;
  onSave: (cfg: GenerateConfig) => Promise<void>;
  onClose: () => void;
}) {
  const today = tournamentToday();
  const [config, setConfig] = useState<GenerateConfig>({
    startDate: today, gamesPerWeek: 1, gameTime: '18:00', venueKey: '', location: '',
  });
  const [preview, setPreview] = useState<PreviewGame[] | null>(null);
  const [previewing, setPreviewing] = useState(false);

  function setCfg(k: keyof GenerateConfig, v: string | number) {
    setConfig(c => ({ ...c, [k]: v }));
    setPreview(null);
  }

  async function handlePreview() {
    setPreviewing(true);
    try { setPreview(await onPreview(config)); } finally { setPreviewing(false); }
  }

  const teamMap = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className={`${styles.modal} ${styles.generateModal}`}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Generate Schedule — {divisionName}</h2>
          <button className={styles.modalCloseBtn} onClick={onClose} disabled={saving}><X size={18} /></button>
        </div>

        <p style={{ fontSize: '0.82rem', color: 'var(--white-45)', marginBottom: '1rem' }}>
          Round-robin: {teams.length} teams · {teams.length % 2 === 0 ? teams.length - 1 : teams.length} rounds · every team plays every other team once.
        </p>

        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label}>First game date</label>
            <input type="date" className={styles.input} value={config.startDate} onChange={e => setCfg('startDate', e.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Default game time</label>
            <input type="time" className={styles.input} value={config.gameTime} onChange={e => setCfg('gameTime', e.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Rounds per week</label>
            <input type="number" min={1} max={7} className={styles.input} value={config.gamesPerWeek}
              onChange={e => setCfg('gamesPerWeek', Math.max(1, Number(e.target.value)))} />
            <p className={styles.hint}>How many game nights per week</p>
          </div>
          <FieldPicker
            venues={venues}
            noun={`Default ${noun.toLowerCase()}`}
            venueKey={config.venueKey}
            locationText={config.location}
            orgSlug={orgSlug}
            canManage
            onKeyChange={k => setCfg('venueKey', k)}
            onTextChange={t => setCfg('location', t)}
          />
        </div>

        {!preview && (
          <div style={{ textAlign: 'center', padding: '0.5rem 0 1rem' }}>
            <button style={BTN_SECONDARY} onClick={handlePreview} disabled={previewing || !config.startDate}>
              {previewing ? 'Generating…' : 'Preview Schedule'}
            </button>
          </div>
        )}

        {preview && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--white-40)' }}>
                Preview — {preview.length} games
              </h3>
              <button style={{ ...BTN_SECONDARY, padding: '0.2rem 0.5rem', fontSize: '0.72rem' }} onClick={() => setPreview(null)}>
                Re-configure
              </button>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--white-8)', borderRadius: '2px' }}>
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
          <button style={BTN_SECONDARY} onClick={onClose} disabled={saving}>Cancel</button>
          {preview && (
            <button style={BTN_PRIMARY} onClick={() => onSave(config)} disabled={saving}>
              {saving ? 'Saving…' : `Save ${preview.length} Games`}
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
  noun,
  orgSlug,
  saving,
  onSave,
  onClose,
}: {
  team: LeagueTeam;
  venues: OrgVenue[];
  noun: string;
  orgSlug: string;
  saving: boolean;
  onSave: (form: PracticeForm) => Promise<void>;
  onClose: () => void;
}) {
  const today = tournamentToday();
  const [form, setForm] = useState<PracticeForm>({
    recurring: false,
    scheduledDate: today,
    dayOfWeek: '2',
    startDate: today,
    endDate: today,
    startTime: '18:00',
    endTime: '20:00',
    venueKey: '',
    location: '',
    notes: '',
  });

  function set(k: keyof PracticeForm, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }));
  }

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Add Practice — {team.name}</h2>
          <button className={styles.modalCloseBtn} onClick={onClose} disabled={saving}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            style={{ ...(!form.recurring ? BTN_PRIMARY : BTN_SECONDARY), flex: 1 }}
            onClick={() => set('recurring', false)}
          >
            Single
          </button>
          <button
            style={{ ...(form.recurring ? BTN_PRIMARY : BTN_SECONDARY), flex: 1 }}
            onClick={() => set('recurring', true)}
          >
            Recurring Series
          </button>
        </div>

        <div className={styles.formGrid}>
          {!form.recurring ? (
            <div className={styles.field}>
              <label className={styles.label}>Date</label>
              <input type="date" className={styles.input} value={form.scheduledDate} onChange={e => set('scheduledDate', e.target.value)} />
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
                <input type="date" className={styles.input} value={form.startDate} onChange={e => set('startDate', e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>To date</label>
                <input type="date" className={styles.input} value={form.endDate} onChange={e => set('endDate', e.target.value)} />
              </div>
            </>
          )}
          <div className={styles.field}>
            <label className={styles.label}>Start time</label>
            <input type="time" className={styles.input} value={form.startTime} onChange={e => set('startTime', e.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>End time</label>
            <input type="time" className={styles.input} value={form.endTime} onChange={e => set('endTime', e.target.value)} />
          </div>
        </div>

        <FieldPicker
          venues={venues}
          noun={noun}
          venueKey={form.venueKey}
          locationText={form.location}
          orgSlug={orgSlug}
          canManage
          onKeyChange={k => set('venueKey', k)}
          onTextChange={t => set('location', t)}
        />

        <div className={styles.field}>
          <label className={styles.label}>Notes <span style={{ fontWeight: 400, opacity: 0.5 }}>(optional)</span></label>
          <textarea className={styles.textarea} value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
        </div>

        <div className={styles.modalFooter}>
          <button style={BTN_SECONDARY} onClick={onClose} disabled={saving}>Cancel</button>
          <button style={BTN_PRIMARY} onClick={() => onSave(form)} disabled={saving}>
            {saving ? 'Saving…' : form.recurring ? 'Create Series' : 'Create Practice'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Cancel Practice Modal ─────────────────────────────────────────────────────

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
  const isRecurring = !!practice.recurrenceGroupId;
  const [scope, setScope] = useState<'one' | 'remaining' | 'all'>('one');
  const dt = practice.scheduledAt ? formatDateTime(practice.scheduledAt) : null;

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className={styles.modal} style={{ maxWidth: 420 }}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Cancel Practice</h2>
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
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  cursor: 'pointer', padding: '0.5rem 0.75rem', borderRadius: '2px',
                  border: `1px solid ${scope === s ? 'rgba(var(--danger-rgb),0.35)' : 'var(--white-8)'}`,
                  background: scope === s ? 'rgba(var(--danger-rgb),0.07)' : 'var(--white-03)',
                }}
              >
                <input type="radio" value={s} checked={scope === s} onChange={() => setScope(s)} style={{ accentColor: '#f87171' }} />
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
          <button style={BTN_SECONDARY} onClick={onClose} disabled={saving}>Back</button>
          <button style={BTN_DANGER} onClick={() => onConfirm(scope)} disabled={saving}>
            {saving ? 'Cancelling…' : 'Cancel Practice'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const { orgSlug, seasonId } = useParams<{ orgSlug: string; seasonId: string }>();
  const { currentOrg, userRole, userCapabilities } = useOrg();
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

  const [feedback, setFeedback] = useState<FeedbackState>({ isOpen: false, title: '', message: '', type: 'success' });

  const canManage = userRole === 'owner' || userRole === 'league_admin';
  const hasAccess = hasCapability(userRole ?? 'staff', userCapabilities ?? null, 'module_house_league');

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadSeasonAndDivisions = useCallback(async () => {
    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}${orgQuery}`);
    if (!res.ok) return;
    const { season: s, divisions: divs } = await res.json();
    setSeason({ id: s.id, name: s.name, sport: s.sport ?? null });
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
  const conflictKeys = useMemo(
    () => new Set((health?.conflicts ?? []).map(c => `${c.kind}:${c.id}`)),
    [health],
  );

  const weekGroups = useMemo(() => {
    const map = new Map<string, LeagueGame[]>();
    const unscheduled: LeagueGame[] = [];
    for (const g of games) {
      if (!g.scheduledAt) { unscheduled.push(g); continue; }
      const key = weekKey(g.scheduledAt);
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
      const key = weekKey(p.scheduledAt);
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
        ...venueBody(cfg.venueKey, cfg.location),
      }),
    });
    if (!res.ok) {
      showError('Preview failed', (await res.json()).error ?? 'Unknown error');
      return [];
    }
    return (await res.json()).preview ?? [];
  }

  /** venueKey + typed text → the API's venue fields (text only when nothing is picked). */
  function venueBody(venueKey: string, locationText: string) {
    const sel = decodeVenueKey(venueKey);
    const useText = sel.isText || venues.length === 0;
    return {
      orgVenueId: sel.orgVenueId,
      orgVenueFacilityId: sel.orgVenueFacilityId,
      location: useText ? (locationText.trim() || null) : null,
    };
  }

  async function handleGenerateSave(cfg: GenerateConfig) {
    setSaving(true);
    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/schedule/generate${orgQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        divisionId: selectedDivId, save: true,
        startDate: cfg.startDate, gamesPerWeek: cfg.gamesPerWeek, gameTime: cfg.gameTime,
        ...venueBody(cfg.venueKey, cfg.location),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      showError('Could not save schedule', (await res.json()).error ?? 'Unknown error');
      return;
    }
    const { warnings } = await res.json();
    setShowGenerate(false);
    if (Array.isArray(warnings) && warnings.length) {
      setFeedback({
        isOpen: true, title: `${warnings.length} ${noun.toLowerCase()} clash${warnings.length !== 1 ? 'es' : ''} in the generated schedule`,
        message: `The schedule was saved, but some games share a ${noun.toLowerCase()} at the same time — spread them across times or ${noun.toLowerCase()}s. First: ${warnings[0]}`,
        type: 'info',
      });
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
      ...venueBody(form.venueKey, form.location),
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

  async function handleCancelGame() {
    if (!activeGame) return;
    setSaving(true);
    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/schedule/${activeGame.id}${orgQuery}`, {
      method: 'DELETE',
    });
    setSaving(false);
    if (!res.ok) {
      showError('Could not cancel game', (await res.json()).error ?? 'Unknown error');
      return;
    }
    setGameModalOpen(false);
    await loadTeamsAndGames(selectedDivId);
    await loadHealth();
  }

  // ── Practice CRUD ──────────────────────────────────────────────────────────

  async function handleSavePractice(form: PracticeForm) {
    setSaving(true);
    const body: Record<string, unknown> = {
      teamId:     selectedTeamId,
      divisionId: selectedDivId || null,
      recurring:  form.recurring,
      startTime:  form.startTime,
      endTime:    form.endTime || null,
      ...venueBody(form.venueKey, form.location),
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
        date:     g.scheduledAt ? g.scheduledAt.slice(0, 10) : '',
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

  async function handleExportICS() {
    const icsEvents: ICSEventInput[] = games
      .filter(g => g.scheduledAt)
      .map(g => {
        const home = teamMap.get(g.homeTeamId);
        const away = teamMap.get(g.awayTeamId);
        return {
          gameId:    g.id,
          title:     `${home?.name ?? 'Home'} vs ${away?.name ?? 'Away'}`,
          date:      g.scheduledAt!.slice(0, 10),
          time:      isoToTimeInput(g.scheduledAt!),
          location:  g.location ?? undefined,
          cancelled: g.status === 'cancelled',
        };
      });
    const filename = buildFilename(
      { org: currentOrg?.slug, dataset: 'hl-schedule', scope: season?.name },
      'ics',
    );
    await downloadICS(filename, icsEvents);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <div className={styles.muted}>Loading schedule…</div>;

  if (!hasAccess) {
    return (
      <div className={styles.accessDenied}>
        <Calendar size={32} />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have access to the House League module.</p>
      </div>
    );
  }

  const backHref = `/${orgSlug}/admin/house-league/seasons/${seasonId}`;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <Link href={backHref} style={{ color: 'var(--white-40)', display: 'flex', alignItems: 'center' }}>
            <ChevronLeft size={18} />
          </Link>
          <div className={styles.headerIcon}><Calendar size={22} /></div>
          <div>
            <h1 className={styles.pageTitle}>Schedule</h1>
            {season && <p className={styles.pageSub}>{season.name}</p>}
          </div>
        </div>
      </div>

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
              <button style={BTN_SECONDARY} onClick={() => setShowGenerate(true)}>
                <Wand2 size={14} style={{ marginRight: 4 }} />
                Generate Schedule
              </button>
            )}
            <button style={BTN_SECONDARY} onClick={openCreate}>
              <Plus size={14} style={{ marginRight: 4 }} />
              Add Game
            </button>
          </>
        )}

        {viewMode !== 'practices' && (
          <>
            <div className={styles.toolbarSep} />
            {/* Exports are a paid-League capability. The free League Starter floor hides the menu.
                NOTE: exports are 100% client-side today (no server route). If a server export route
                is ever added for house-league it MUST guard isFreeFloorLeague(org) → 403. */}
            {currentOrg && isFreeFloorLeague(currentOrg) ? (
              <span
                title="Exports are part of League. Upgrade to export your schedule, standings, and registrations."
                style={{ fontFamily: 'var(--font-data)', fontSize: '0.7rem', letterSpacing: '0.04em', color: 'var(--data-gray)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '0.35rem 0.6rem', whiteSpace: 'nowrap' }}
              >
                Exports · League
              </span>
            ) : (
              <ExportMenu
                formats={['xlsx', 'csv', 'ics']}
                onExportXLSX={handleExportXLSX}
                onExportCSV={handleExportCSV}
                onExportICS={handleExportICS}
                disabled={games.length === 0}
              />
            )}
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
                <button style={BTN_SECONDARY} onClick={() => setShowPracticeModal(true)}>
                  <Plus size={14} style={{ marginRight: 4 }} />
                  Add Practice
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Schedule health — clashes + what could not be checked (games AND practices) */}
      {health && health.conflicts.length > 0 && (
        <div style={{
          border: '1px solid rgba(var(--warning-rgb),0.35)', background: 'rgba(var(--warning-rgb),0.07)',
          borderRadius: '2px', padding: '0.7rem 0.9rem', marginBottom: '0.9rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--warning)', fontWeight: 700, fontSize: '0.82rem' }}>
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
        <p style={{ fontSize: '0.78rem', color: 'var(--white-45)', margin: '0 0 0.9rem' }}>
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
                  ? 'No practices scheduled for this team. Use "Add Practice" to get started.'
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
                  const clickable = canManage && p.status !== 'cancelled';
                  return (
                    <div
                      key={p.id}
                      className={`${styles.practiceCard} ${p.status === 'cancelled' ? styles.gameCardCancelled : ''}`}
                      style={{ cursor: clickable ? 'pointer' : 'default' }}
                      onClick={() => { if (clickable) { setActivePractice(p); setShowCancelModal(true); } }}
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
                        </div>
                      )}
                      {p.notes && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--white-35)', marginTop: '0.3rem', fontStyle: 'italic' }}>
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
                        {clickable && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--white-30)' }}>click to cancel</span>
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
          venues={venues}
          noun={noun}
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
          venues={venues}
          noun={noun}
          orgSlug={orgSlug}
          canManage={canManage}
          saving={saving}
          onSave={handleSaveGame}
          onCancel={handleCancelGame}
          onClose={() => setGameModalOpen(false)}
        />
      )}

      {/* Practice create modal */}
      {showPracticeModal && selectedTeamId && teamMap.get(selectedTeamId) && (
        <PracticeModal
          team={teamMap.get(selectedTeamId)!}
          venues={venues}
          noun={noun}
          orgSlug={orgSlug}
          saving={saving}
          onSave={handleSavePractice}
          onClose={() => setShowPracticeModal(false)}
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
        onClose={() => setFeedback(f => ({ ...f, isOpen: false }))}
      />
    </div>
  );
}
