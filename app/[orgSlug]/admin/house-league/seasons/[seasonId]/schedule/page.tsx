'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Calendar, ChevronLeft, Plus, X, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import FeedbackModal from '@/components/FeedbackModal';
import styles from '../../../house-league.module.css';
import type { LeagueDivision, LeagueTeam, LeagueGame, LeagueGameStatus } from '@/lib/types';

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

// Returns the Monday of the week containing the given date (YYYY-MM-DD key)
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
  scheduled:  'Scheduled',
  completed:  'Completed',
  postponed:  'Postponed',
  cancelled:  'Cancelled',
};

const STATUS_CLASS: Record<LeagueGameStatus, string> = {
  scheduled: styles.gameStatusScheduled,
  completed: styles.gameStatusCompleted,
  postponed: styles.gameStatusPostponed,
  cancelled: styles.gameStatusCancelled,
};

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
  game: LeagueGame | null; // null = create mode
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const { orgSlug, seasonId } = useParams<{ orgSlug: string; seasonId: string }>();
  const { userRole, userCapabilities } = useOrg();

  const [season, setSeason] = useState<SeasonInfo | null>(null);
  const [divisions, setDivisions] = useState<LeagueDivision[]>([]);
  const [selectedDivId, setSelectedDivId] = useState('');
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [games, setGames] = useState<LeagueGame[]>([]);
  const [viewMode, setViewMode] = useState<'week' | 'list'>('week');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showGenerate, setShowGenerate] = useState(false);
  const [editGame, setEditGame] = useState<LeagueGame | null | 'create'>('create' as any);
  const [gameModalOpen, setGameModalOpen] = useState(false);
  const [activeGame, setActiveGame] = useState<LeagueGame | null>(null);

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
    if (teamsRes.ok) setTeams((await teamsRes.json()).teams ?? []);
    if (gamesRes.ok) setGames((await gamesRes.json()).games ?? []);
  }, [seasonId]);

  useEffect(() => {
    setLoading(true);
    loadSeasonAndDivisions().finally(() => setLoading(false));
  }, [loadSeasonAndDivisions]);

  useEffect(() => {
    if (selectedDivId) loadTeamsAndGames(selectedDivId);
  }, [selectedDivId, loadTeamsAndGames]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const selectedDiv = divisions.find(d => d.id === selectedDivId);
  const teamMap = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);

  // Week view grouping
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
        </div>

        {canManage && (
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
      </div>

      {/* Empty state */}
      {games.length === 0 && (
        <div className={styles.emptyState}>
          <p>
            {teams.length < 2
              ? 'Create at least 2 teams before generating a schedule.'
              : canManage
                ? 'No games scheduled yet. Use "Generate Schedule" or "Add Game" to get started.'
                : 'No games scheduled yet.'}
          </p>
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
