'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Calendar, ChevronLeft, Plus, X, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import FeedbackModal from '@/components/FeedbackModal';
import HelpCallout from '@/components/help/HelpCallout';
import styles from '../../../house-league.module.css';
import type { LeagueDivision, LeagueTeam, LeagueGame, LeagueGameStatus, LeaguePractice } from '@/lib/types';

// ── Types ──────────────────────────────────────────────────────────────────────

interface SeasonInfo { id: string; name: string; }

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
  location: string;
  notes: string;
}

interface FeedbackState {
  isOpen: boolean; title: string; message: string;
  type: 'success' | 'danger' | 'info';
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true }),
  };
}

function isoToDateInput(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function isoToTimeInput(iso: string): string {
  return new Date(iso).toTimeString().slice(0, 5);
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

const BTN_PRIMARY: React.CSSProperties = {
  background: 'var(--logic-lime, #a3e635)', color: '#1a1f2e', border: 'none',
  borderRadius: 7, padding: '0.4rem 0.85rem', fontSize: '0.82rem', fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
};
const BTN_SECONDARY: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7,
  padding: '0.4rem 0.85rem', fontSize: '0.82rem', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
};
const BTN_DANGER: React.CSSProperties = {
  background: 'rgba(239,68,68,0.1)', color: '#f87171',
  border: '1px solid rgba(239,68,68,0.25)', borderRadius: 7,
  padding: '0.4rem 0.85rem', fontSize: '0.82rem', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
};

// ── Game Modal (create + edit) ────────────────────────────────────────────────

function GameModal({
  game,
  teams,
  canManage,
  saving,
  onSave,
  onCancel: onCancelGame,
  onClose,
}: {
  game: LeagueGame | null;
  teams: LeagueTeam[];
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
      scheduledDate: '', scheduledTime: '18:00',
      location: '', status: 'scheduled',
      homeScore: '', awayScore: '', notes: '',
    };
  });

  function set(k: keyof GameForm, v: string) { setForm(f => ({ ...f, [k]: v })); }

  const isCreate = !game;
  const showScores = form.status === 'completed';
  const homeTeam = teams.find(t => t.id === form.homeTeamId);
  const awayTeam = teams.find(t => t.id === form.awayTeamId);

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{isCreate ? 'Add Game' : 'Edit Game'}</h2>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={18} /></button>
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
        </div>

        <div className={styles.formGrid}>
          <div className={`${styles.field} ${styles.formGridFull}`}>
            <label className={styles.label}>Location</label>
            <input className={styles.input} value={form.location} onChange={e => set('location', e.target.value)} placeholder="Diamond name or address" disabled={!canManage} />
          </div>
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
            <button style={BTN_SECONDARY} onClick={onClose}>Close</button>
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
  saving,
  onPreview,
  onSave,
  onClose,
}: {
  divisionName: string;
  teams: LeagueTeam[];
  saving: boolean;
  onPreview: (cfg: GenerateConfig) => Promise<PreviewGame[]>;
  onSave: (cfg: GenerateConfig) => Promise<void>;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [config, setConfig] = useState<GenerateConfig>({
    startDate: today, gamesPerWeek: 1, gameTime: '18:00', location: '',
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
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`${styles.modal} ${styles.generateModal}`}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Generate Schedule — {divisionName}</h2>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', marginBottom: '1rem' }}>
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
          <div className={styles.field}>
            <label className={styles.label}>Default location</label>
            <input className={styles.input} value={config.location} onChange={e => setCfg('location', e.target.value)} placeholder="Optional" />
          </div>
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
              <h3 style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)' }}>
                Preview — {preview.length} games
              </h3>
              <button style={{ ...BTN_SECONDARY, padding: '0.2rem 0.5rem', fontSize: '0.72rem' }} onClick={() => setPreview(null)}>
                Re-configure
              </button>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8 }}>
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
          <button style={BTN_SECONDARY} onClick={onClose}>Cancel</button>
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
  saving,
  onSave,
  onClose,
}: {
  team: LeagueTeam;
  saving: boolean;
  onSave: (form: PracticeForm) => Promise<void>;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<PracticeForm>({
    recurring: false,
    scheduledDate: today,
    dayOfWeek: '2',
    startDate: today,
    endDate: today,
    startTime: '18:00',
    endTime: '20:00',
    location: '',
    notes: '',
  });

  function set(k: keyof PracticeForm, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }));
  }

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Add Practice — {team.name}</h2>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={18} /></button>
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

        <div className={styles.field}>
          <label className={styles.label}>Location <span style={{ fontWeight: 400, opacity: 0.5 }}>(optional)</span></label>
          <input className={styles.input} value={form.location} onChange={e => set('location', e.target.value)} placeholder="Field name or address" />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Notes <span style={{ fontWeight: 400, opacity: 0.5 }}>(optional)</span></label>
          <textarea className={styles.textarea} value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
        </div>

        <div className={styles.modalFooter}>
          <button style={BTN_SECONDARY} onClick={onClose}>Cancel</button>
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
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} style={{ maxWidth: 420 }}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Cancel Practice</h2>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.55)', marginBottom: '1rem' }}>
          {teamName}{dt ? ` · ${dt.date} at ${dt.time}` : ''}
        </p>

        {isRecurring && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {(['one', 'remaining', 'all'] as const).map(s => (
              <label
                key={s}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  cursor: 'pointer', padding: '0.5rem 0.75rem', borderRadius: 7,
                  border: `1px solid ${scope === s ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  background: scope === s ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.02)',
                }}
              >
                <input type="radio" value={s} checked={scope === s} onChange={() => setScope(s)} style={{ accentColor: '#f87171' }} />
                <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)' }}>
                  {s === 'one' && 'Cancel this practice only'}
                  {s === 'remaining' && 'Cancel this and all remaining in the series'}
                  {s === 'all' && 'Cancel the entire series'}
                </span>
              </label>
            ))}
          </div>
        )}

        <div className={styles.modalFooter}>
          <button style={BTN_SECONDARY} onClick={onClose}>Back</button>
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
  const { userRole, userCapabilities } = useOrg();

  const [season, setSeason] = useState<SeasonInfo | null>(null);
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
    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}`);
    if (!res.ok) return;
    const { season: s, divisions: divs } = await res.json();
    setSeason({ id: s.id, name: s.name });
    setDivisions(divs ?? []);
    if (divs?.length && !selectedDivId) setSelectedDivId(divs[0].id);
  }, [seasonId, selectedDivId]);

  const loadTeamsAndGames = useCallback(async (divId: string) => {
    const [teamsRes, gamesRes] = await Promise.all([
      fetch(`/api/admin/house-league/seasons/${seasonId}/teams?divisionId=${divId}`),
      fetch(`/api/admin/house-league/seasons/${seasonId}/schedule?divisionId=${divId}`),
    ]);
    const newTeams = teamsRes.ok ? ((await teamsRes.json()).teams ?? []) : [];
    setTeams(newTeams);
    setSelectedTeamId(t => t || (newTeams[0]?.id ?? ''));
    if (gamesRes.ok) setGames((await gamesRes.json()).games ?? []);
  }, [seasonId]);

  const loadPractices = useCallback(async (teamId: string) => {
    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/practices?teamId=${teamId}`);
    if (res.ok) setPractices((await res.json()).practices ?? []);
  }, [seasonId]);

  useEffect(() => {
    setLoading(true);
    loadSeasonAndDivisions().finally(() => setLoading(false));
  }, [loadSeasonAndDivisions]);

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
    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/schedule/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ divisionId: selectedDivId, save: false, ...cfg }),
    });
    if (!res.ok) {
      showError('Preview failed', (await res.json()).error ?? 'Unknown error');
      return [];
    }
    return (await res.json()).preview ?? [];
  }

  async function handleGenerateSave(cfg: GenerateConfig) {
    setSaving(true);
    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/schedule/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ divisionId: selectedDivId, save: true, ...cfg }),
    });
    setSaving(false);
    if (!res.ok) {
      showError('Could not save schedule', (await res.json()).error ?? 'Unknown error');
      return;
    }
    setShowGenerate(false);
    await loadTeamsAndGames(selectedDivId);
  }

  // ── Game CRUD ──────────────────────────────────────────────────────────────

  async function handleSaveGame(form: GameForm) {
    setSaving(true);
    const isCreate = !activeGame;
    const url = isCreate
      ? `/api/admin/house-league/seasons/${seasonId}/schedule`
      : `/api/admin/house-league/seasons/${seasonId}/schedule/${activeGame!.id}`;
    const method = isCreate ? 'POST' : 'PATCH';

    const body: Record<string, unknown> = {
      divisionId:    selectedDivId,
      homeTeamId:    form.homeTeamId,
      awayTeamId:    form.awayTeamId,
      scheduledDate: form.scheduledDate || undefined,
      scheduledTime: form.scheduledTime || undefined,
      location:      form.location || null,
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
      showError('Could not save game', (await res.json()).error ?? 'Unknown error');
      return;
    }
    setGameModalOpen(false);
    await loadTeamsAndGames(selectedDivId);
  }

  async function handleCancelGame() {
    if (!activeGame) return;
    setSaving(true);
    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/schedule/${activeGame.id}`, {
      method: 'DELETE',
    });
    setSaving(false);
    if (!res.ok) {
      showError('Could not cancel game', (await res.json()).error ?? 'Unknown error');
      return;
    }
    setGameModalOpen(false);
    await loadTeamsAndGames(selectedDivId);
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
      location:   form.location || null,
      notes:      form.notes || null,
    };

    if (form.recurring) {
      body.dayOfWeek = Number(form.dayOfWeek);
      body.startDate = form.startDate;
      body.endDate   = form.endDate;
    } else {
      body.scheduledDate = form.scheduledDate;
    }

    const res = await fetch(`/api/admin/house-league/seasons/${seasonId}/practices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      showError('Could not save practice', (await res.json()).error ?? 'Unknown error');
      return;
    }
    const { count } = await res.json();
    setShowPracticeModal(false);
    setFeedback({
      isOpen: true, title: 'Practices created',
      message: `${count} practice${count !== 1 ? 's' : ''} added successfully.`,
      type: 'success',
    });
    await loadPractices(selectedTeamId);
  }

  async function handleCancelPractice(scope: 'one' | 'remaining' | 'all') {
    if (!activePractice) return;
    setSaving(true);
    const res = await fetch(
      `/api/admin/house-league/seasons/${seasonId}/practices/${activePractice.id}`,
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
          <Link href={backHref} style={{ color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center' }}>
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
                    <td>{g.location ?? <span style={{ opacity: 0.4 }}>—</span>}</td>
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
                        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.3rem', fontStyle: 'italic' }}>
                          {p.notes}
                        </div>
                      )}
                      <div className={styles.gameCardFooter}>
                        <span className={`${styles.statusBadge} ${p.status === 'cancelled' ? styles.gameStatusCancelled : styles.practiceBadge}`}>
                          {p.status === 'cancelled' ? 'Cancelled' : 'Practice'}
                        </span>
                        {clickable && (
                          <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)' }}>click to cancel</span>
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
