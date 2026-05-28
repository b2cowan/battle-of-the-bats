'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Copy, Info, Users, Calendar, Trophy, DollarSign, TrendingUp, Zap, Flag } from 'lucide-react';
import Link from 'next/link';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { LiveEventLog } from '@/components/admin/LiveEventLog';
import styles from './dashboard.module.css';

type DivisionStat = {
  id: string;
  name: string;
  capacity: number | null;
  accepted: number;
  pending: number;
  waitlist: number;
};

type PaymentCounts = {
  paid: number;
  depositPaid: number;
  pending: number;
  pastDue: number;
  noSchedule: number;
};

type GameDayDivisionStat = {
  id: string;
  name: string;
  poolTotal: number;
  poolCompleted: number;
  playoffStarted: boolean;
  latestRound: string | null;
  nextRound: string | null;
};

type GameDayStats = {
  totalGames: number;
  completed: number;
  inProgress: number;
  completedPct: number;
  poolGamesTotal: number;
  poolGamesCompleted: number;
  playoffStarted: boolean;
  playoffGamesTotal: number;
  playoffGamesCompleted: number;
  byDivision: GameDayDivisionStat[];
};

type DashboardStats = {
  divisions: number;
  teams: number;
  scheduled: number;
  completed: number;
  announcements: number;
  isTournamentDay: boolean;
  gameDay: GameDayStats;
  publishChecklist: PublishChecklist;
  registration: {
    totalCapacity: number;
    totalAccepted: number;
    totalPending: number;
    totalWaitlist: number;
    byDivision: DivisionStat[];
  };
  payment: {
    hasFeeSchedule: boolean;
    totalExpected: number;
    totalCollected: number;
    counts: PaymentCounts;
  };
};

type PublishChecklist = {
  hasDates: boolean;
  hasDivisions: boolean;
  hasPublicContact: boolean;
  hasOpenDivision: boolean;
  hasBranding: boolean;
  hasVenues: boolean;
  hasRules: boolean;
  hasFees: boolean;
  hasGameTiming: boolean;
  hasTieBreakers: boolean;
  ready: boolean;
};

const EMPTY_GAME_DAY: GameDayStats = {
  totalGames: 0, completed: 0, inProgress: 0, completedPct: 0,
  poolGamesTotal: 0, poolGamesCompleted: 0,
  playoffStarted: false, playoffGamesTotal: 0, playoffGamesCompleted: 0,
  byDivision: [],
};

const EMPTY_STATS: DashboardStats = {
  divisions: 0,
  teams: 0,
  scheduled: 0,
  completed: 0,
  announcements: 0,
  isTournamentDay: false,
  gameDay: EMPTY_GAME_DAY,
  publishChecklist: {
    hasDates: false,
    hasDivisions: false,
    hasPublicContact: false,
    hasOpenDivision: false,
    hasBranding: false,
    hasVenues: false,
    hasRules: false,
    hasFees: false,
    hasGameTiming: false,
    hasTieBreakers: false,
    ready: false,
  },
  registration: { totalCapacity: 0, totalAccepted: 0, totalPending: 0, totalWaitlist: 0, byDivision: [] },
  payment: { hasFeeSchedule: false, totalExpected: 0, totalCollected: 0, counts: { paid: 0, depositPaid: 0, pending: 0, pastDue: 0, noSchedule: 0 } },
};

function fmt(n: number) {
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
}

function fmtDateRange(start?: string, end?: string): string | null {
  if (!start) return null;
  const p = (d: string) => { const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day); };
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const full: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  if (!end || end === start) return p(start).toLocaleDateString('en-CA', full);
  const s = p(start), e = p(end);
  return s.getFullYear() === e.getFullYear()
    ? `${s.toLocaleDateString('en-CA', opts)} – ${e.toLocaleDateString('en-CA', full)}`
    : `${s.toLocaleDateString('en-CA', full)} – ${e.toLocaleDateString('en-CA', full)}`;
}

function GaugeBar({ value, max, danger }: { value: number; max: number; danger?: boolean }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color = danger ? 'var(--danger-light)' : pct >= 100 ? 'var(--logic-lime)' : pct >= 75 ? '#f6c453' : 'var(--blueprint-blue)';
  return (
    <div className={styles.gaugeWrap}>
      <div className={styles.gaugeTrack}>
        <div className={styles.gaugeFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={styles.gaugePct} style={{ color }}>{pct}%</span>
    </div>
  );
}

export default function AdminDashboard() {
  const { currentTournament, refresh: refreshTournaments } = useTournament();
  const { currentOrg, userRole } = useOrg();
  const router = useRouter();
  const base = `/${currentOrg?.slug ?? 'milton-bats'}/admin/tournaments`;
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  const orgParam = currentOrg?.slug ? `&orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [statsError, setStatsError] = useState('');
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState('');
  const [showActivateConfirm, setShowActivateConfirm] = useState(false);
  const [showOptionalItems, setShowOptionalItems] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiveError, setArchiveError] = useState('');

  async function handleActivate() {
    if (!currentTournament?.id || activating) return;
    setActivating(true);
    setActivateError('');
    setShowActivateConfirm(false);
    try {
      const res = await fetch(`/api/admin/tournaments${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-status', id: currentTournament.id, data: { status: 'active' } }),
      });
      const json = await res.json().catch(() => null) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? 'Failed to activate tournament.');
      await refreshTournaments();
      router.refresh();
    } catch (err) {
      setActivateError(err instanceof Error ? err.message : 'Failed to activate tournament.');
    } finally {
      setActivating(false);
    }
  }

  async function handleArchive() {
    if (!currentTournament?.id || archiving) return;
    setArchiving(true);
    setArchiveError('');
    setShowArchiveConfirm(false);
    try {
      const res = await fetch(`/api/admin/tournaments${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-status', id: currentTournament.id, data: { status: 'archived' } }),
      });
      const json = await res.json().catch(() => null) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? 'Failed to archive tournament.');
      await refreshTournaments();
      router.refresh();
    } catch (err) {
      setArchiveError(err instanceof Error ? err.message : 'Failed to archive tournament.');
    } finally {
      setArchiving(false);
    }
  }

  useEffect(() => {
    const tournamentId = currentTournament?.id;
    if (!tournamentId) return;
    const controller = new AbortController();
    async function fetchStats(id: string) {
      try {
        const res = await fetch(`/api/admin/tournament-dashboard?tournamentId=${encodeURIComponent(id)}${orgParam}`, { signal: controller.signal });
        const data = await res.json().catch(() => null) as Partial<DashboardStats> & { error?: string } | null;
        if (!res.ok) throw new Error(data?.error ?? 'Unable to load dashboard stats.');
        setStats({
          divisions:       data?.divisions       ?? 0,
          teams:           data?.teams           ?? 0,
          scheduled:       data?.scheduled       ?? 0,
          completed:       data?.completed       ?? 0,
          announcements:   data?.announcements   ?? 0,
          isTournamentDay: data?.isTournamentDay ?? false,
          gameDay:         data?.gameDay         ?? EMPTY_GAME_DAY,
          publishChecklist: {
            hasDates:         data?.publishChecklist?.hasDates         ?? false,
            hasDivisions:     data?.publishChecklist?.hasDivisions     ?? false,
            hasPublicContact: data?.publishChecklist?.hasPublicContact ?? false,
            hasOpenDivision:  data?.publishChecklist?.hasOpenDivision  ?? false,
            hasBranding:      data?.publishChecklist?.hasBranding      ?? false,
            hasVenues:        data?.publishChecklist?.hasVenues        ?? false,
            hasRules:         data?.publishChecklist?.hasRules         ?? false,
            hasFees:          data?.publishChecklist?.hasFees          ?? false,
            hasGameTiming:    data?.publishChecklist?.hasGameTiming    ?? false,
            hasTieBreakers:   data?.publishChecklist?.hasTieBreakers   ?? false,
            ready:            data?.publishChecklist?.ready            ?? false,
          },
          registration: data?.registration ?? EMPTY_STATS.registration,
          payment:      data?.payment      ?? EMPTY_STATS.payment,
        });
        setStatsError('');
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setStats(EMPTY_STATS);
        setStatsError(err instanceof Error ? err.message : 'Unable to load dashboard stats.');
      }
    }
    void fetchStats(tournamentId);
    return () => controller.abort();
  }, [currentTournament?.id, orgParam]);

  // ── Populate-from state (draft dashboard only) ───────────────────────────
  type OtherTournament = { id: string; name: string; year: number | null; status: string | null };
  const [otherTournaments, setOtherTournaments] = useState<OtherTournament[]>([]);
  const [populateOpen, setPopulateOpen] = useState(false);
  const [populateSelected, setPopulateSelected] = useState<OtherTournament | null>(null);
  const [populateStep, setPopulateStep] = useState<'pick' | 'confirm'>('pick');
  const [populateWorking, setPopulateWorking] = useState(false);
  const [populateError, setPopulateError] = useState('');
  const [populateDone, setPopulateDone] = useState(false);

  const canClone = Boolean(currentOrg && hasPlanFeature(currentOrg.planId, 'tournament_cloning'));
  const cloneUpgradeCopy = requiresTournamentPlusCopy('tournament_cloning');

  useEffect(() => {
    const tournamentId = currentTournament?.id;
    if (!tournamentId) return;
    fetch(`/api/admin/tournaments${orgQuery}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((data: unknown) => {
        if (!Array.isArray(data)) return;
        const others = (data as Array<{ id: string; name: string; year: number | null; status: string | null }>)
          .filter(t => t.id !== tournamentId && t.status !== 'archived')
          .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
        setOtherTournaments(others);
      })
      .catch(() => {});
  }, [currentTournament?.id, orgQuery]);

  async function handlePopulateConfirm() {
    if (!populateSelected || !currentTournament?.id) return;
    setPopulateWorking(true);
    setPopulateError('');
    try {
      const res = await fetch(
        `/api/admin/tournaments/${encodeURIComponent(currentTournament.id)}/populate-from${orgQuery}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceTournamentId: populateSelected.id }),
        },
      );
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to populate tournament.');
      setPopulateDone(true);
      await refreshTournaments();
      router.refresh();
    } catch (err) {
      setPopulateError(err instanceof Error ? err.message : 'Failed to populate tournament.');
    } finally {
      setPopulateWorking(false);
    }
  }

  function openPopulateModal() {
    setPopulateSelected(null);
    setPopulateStep('pick');
    setPopulateError('');
    setPopulateDone(false);
    setPopulateOpen(true);
  }

  const status        = currentTournament?.status ?? 'draft';
  const isDraft       = status === 'draft';
  const isActive      = status === 'active';
  const isCompleted   = status === 'completed';
  const isLive        = isActive || isCompleted;

  const statusColor = { active: 'var(--logic-lime)', draft: 'var(--white-60)', completed: '#f6c453', archived: 'rgba(148,163,184,0.4)' }[status] ?? 'var(--white-60)';
  const visibleStats  = currentTournament?.id ? stats : EMPTY_STATS;
  const checklist     = visibleStats.publishChecklist;
  const reg           = visibleStats.registration;
  const pay           = visibleStats.payment;
  const gd            = visibleStats.gameDay;
  const isTournamentDay = visibleStats.isTournamentDay;

  // Live stats: full picture
  const liveCards = [
    { label: 'Teams',     value: visibleStats.teams,     icon: Users,    key: 'teams'    },
    { label: 'Scheduled', value: visibleStats.scheduled, icon: Calendar, key: 'schedule' },
    { label: 'Completed', value: visibleStats.completed, icon: Trophy,   key: 'results'  },
  ];

  const checklistItems = [
    { key: 'dates',         done: checklist.hasDates,        label: 'Tournament dates',                            desc: 'Set a start and end date so teams know when the event runs.',     href: `${base}/settings/event`, action: 'Edit dates'     },
    { key: 'divisions',     done: checklist.hasDivisions,    label: 'At least one division',                       desc: 'Create the divisions teams can register for.',                     href: `${base}/divisions`,      action: 'Add divisions'  },
    { key: 'open-division', done: checklist.hasOpenDivision, label: 'Registration open for at least one division', desc: 'Open a division when you are ready for teams to register.',        href: `${base}/divisions`,      action: 'Open divisions' },
    { key: 'fees',          done: checklist.hasFees,         label: 'Fee approach confirmed',                      desc: 'Confirm how registration fees work — or mark the event as free.', href: `${base}/settings/event`, action: 'Configure fees' },
  ];
  const completedCount = checklistItems.filter(i => i.done).length;

  const optionalItems = [
    { key: 'contact',      done: checklist.hasPublicContact, label: 'Contact email',     desc: checklist.hasPublicContact ? 'A contact email is set for this tournament.' : 'Defaults to your org contact email. Override with a tournament-specific address.',                    href: `${base}/settings/event`, action: 'Review contact →'   },
    { key: 'game-timing',  done: checklist.hasGameTiming,    label: 'Game timing',       desc: checklist.hasGameTiming    ? 'Game timing is configured for this tournament.' : 'Defaults to 90 min games / 15 min buffer, tournament-wide. Customize before building the schedule.', href: `${base}/settings/event`, action: 'Configure timing →' },
    { key: 'tie-breakers', done: checklist.hasTieBreakers,   label: 'Tie-breaker rules', desc: checklist.hasTieBreakers   ? 'Tie-breaker rules are configured for this tournament.' : 'Defaults to H2H → Run Diff → Runs For → Runs Against. Customize before playoffs.',          href: `${base}/settings/event`, action: 'Configure rules →'  },
    { key: 'venues',       done: checklist.hasVenues,        label: 'Venues & fields',   desc: checklist.hasVenues        ? 'Playing fields are set up for this tournament.' : 'Add your playing fields so teams know where to show up.',                                          href: `${base}/venues`,         action: 'Add venues →'       },
    { key: 'rules',        done: checklist.hasRules,         label: 'Rules & resources', desc: checklist.hasRules         ? 'Tournament rules and documents are published.' : 'Upload rulebooks or documents teams need before the tournament.',                                   href: `${base}/rules`,          action: 'Add rules →'        },
    { key: 'branding',     done: checklist.hasBranding,      label: 'Public page',       desc: checklist.hasBranding      ? 'Your public tournament page is live and customized.' : 'Control visibility and public presentation of your tournament page.',                        href: `${base}/branding`,       action: 'Manage page →'      },
  ];
  const optionalDoneCount = optionalItems.filter(i => i.done).length;

  return (
    <div className={styles.page}>
      <header className="flex items-center justify-between border-b border-blueprint-blue/60 pb-4 mb-5">
        <div>
          <div className="hud-label mb-1">{currentOrg?.name ?? 'Admin'}</div>
          <h1 className="font-mono font-bold text-xl uppercase tracking-tight" style={{ color: 'var(--logic-lime)' }}>
            {currentTournament?.name ?? currentOrg?.name ?? 'Admin'}
          </h1>
          {fmtDateRange(currentTournament?.startDate, currentTournament?.endDate) && (
            <div className="hud-label mt-1" style={{ color: 'var(--white-50)', textTransform: 'none', letterSpacing: 'normal' }}>
              {fmtDateRange(currentTournament?.startDate, currentTournament?.endDate)}
            </div>
          )}
        </div>
        <div>
          <span className="font-mono text-xs font-bold" style={{ color: statusColor }}>
            {status.toUpperCase()}
          </span>
        </div>
      </header>

      {currentTournament?.id && statsError && (
        <div className="mb-4 text-xs" style={{ color: 'var(--data-gray)' }}>Dashboard counts are unavailable right now.</div>
      )}

      {/* ── DRAFT DASHBOARD ─────────────────────────────── */}
      {isDraft && !currentTournament?.id && (
        <div style={{ padding: '2rem 0', color: 'var(--data-gray)', fontSize: '0.85rem' }}>
          No tournament selected. Choose a tournament from the selector above to view its dashboard.
        </div>
      )}

      {isDraft && currentTournament?.id && (
        <>
          {/* Clone from past tournament — shown only when other tournaments exist */}
          {otherTournaments.length > 0 && (
            <div style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', border: '1px solid var(--border-2)', borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', background: 'var(--white-03)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                  <Copy size={14} style={{ color: 'var(--logic-lime)' }} />
                  <strong style={{ fontSize: '0.88rem' }}>Clone from a past tournament</strong>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--white-50)', margin: 0 }}>
                  Replace this draft's setup with divisions, venues, contacts, and branding from a previous event.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-data"
                style={{ flexShrink: 0 }}
                onClick={openPopulateModal}
              >
                Clone setup
              </button>
            </div>
          )}

          {/* Launch checklist */}
          <section className={styles.publishChecklist}>
            <div className={styles.checklistHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Draft Launch Checklist</h2>
                <p>
                  Complete these items before activating registration and the public tournament page.{' '}
                  <span style={{ color: completedCount === checklistItems.length ? 'var(--logic-lime)' : 'var(--white-40)', fontWeight: 600 }}>
                    {completedCount} / {checklistItems.length} required complete
                  </span>
                </p>
              </div>
            </div>

            <div className={styles.checklistGrid}>
              {checklistItems.map(item => {
                const Icon = item.done ? CheckCircle2 : AlertCircle;
                return (
                  <Link key={item.key} href={item.href} className={`${styles.checklistItem} ${item.done ? styles.checklistDone : ''}`}>
                    <div className={styles.checklistIcon}><Icon size={18} /></div>
                    <div className={styles.checklistBody}>
                      <strong>{item.label}</strong>
                      <span>{item.desc}</span>
                      <em>{item.done ? 'Complete' : item.action}</em>
                    </div>
                  </Link>
                );
              })}

              {/* Optional setup toggle */}
              <button
                type="button"
                onClick={() => setShowOptionalItems(open => !open)}
                className={styles.optionalToggle}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Info size={13} />
                  Optional setup
                  {optionalDoneCount > 0 && (
                    <span style={{ color: 'var(--logic-lime)', marginLeft: '0.15rem' }}>
                      — {optionalDoneCount} of {optionalItems.length} complete
                    </span>
                  )}
                </span>
                {showOptionalItems ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showOptionalItems && optionalItems.map(item => (
                <Link key={item.key} href={item.href} className={`${styles.checklistNudge} ${item.done ? styles.nudgeDone : ''}`}>
                  <div className={styles.checklistIcon}>
                    {item.done ? <CheckCircle2 size={18} /> : <Info size={18} />}
                  </div>
                  <div className={styles.checklistBody}>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {item.label}
                      <span className={styles.nudgeTag}>Optional</span>
                    </strong>
                    <span>{item.desc}</span>
                    <em style={{ color: item.done ? 'var(--logic-lime)' : 'var(--data-gray)' }}>
                      {item.done ? 'Complete' : item.action}
                    </em>
                  </div>
                </Link>
              ))}
            </div>

            {activateError && (
              <div className={styles.checklistFooter}>
                <span style={{ color: 'var(--danger-light)', fontSize: '0.8rem' }}>{activateError}</span>
              </div>
            )}

            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-lime btn-data"
                onClick={() => setShowActivateConfirm(true)}
                disabled={activating || !checklist.ready}
                title={!checklist.ready ? 'Complete all required items before activating' : undefined}
              >
                {activating ? 'Activating…' : 'Activate tournament →'}
              </button>
            </div>
          </section>

        </>
      )}

      {/* ── LIVE DASHBOARD (active) ──────────────────────── */}
      {isActive && currentTournament?.id && (
        <>
          <div className={styles.statsGrid}>
            {liveCards.map(card => (
              <Link key={card.label} href={`${base}/${card.key}`} className={`card ${styles.statCard}`} id={`dashboard-${card.label.toLowerCase().replace(/\s/g, '-')}`}>
                <div className={styles.statIcon}><card.icon size={22} /></div>
                <div>
                  <div className={styles.statNum}>{card.value}</div>
                  <div className={styles.statLabel}>{card.label}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* ── TOURNAMENT DAY: game-day metrics ────────── */}
          {isTournamentDay ? (
            <div className={styles.analyticsGrid}>
              {/* Overall progress panel */}
              <section className={styles.analyticsPanel}>
                <div className={styles.panelHeader}>
                  <Zap size={16} style={{ color: 'var(--logic-lime)' }} />
                  <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Games Progress</h2>
                  <Link href={`${base}/results`} className={styles.panelLink}>Enter scores →</Link>
                </div>
                {gd.totalGames > 0 ? (
                  <>
                    <div className={styles.mainGauge}>
                      <div className={styles.gaugeFigures}>
                        <span className={styles.gaugeMain}>{gd.completed}</span>
                        <span className={styles.gaugeOf}>/ {gd.totalGames}</span>
                        <span className={styles.gaugeLabel}>games complete</span>
                      </div>
                      <GaugeBar value={gd.completed} max={gd.totalGames} />
                    </div>
                    <div className={styles.subStats}>
                      {gd.inProgress > 0 && (
                        <span className={styles.subStat}>
                          <span className="badge badge-warning">{gd.inProgress}</span> In review
                        </span>
                      )}
                      {gd.poolGamesTotal > 0 && (
                        <span className={styles.subStat}>
                          <span className="badge badge-neutral">{gd.poolGamesCompleted}/{gd.poolGamesTotal}</span> Pool games
                        </span>
                      )}
                      {gd.playoffStarted && (
                        <span className={styles.subStat}>
                          <span className="badge badge-primary">{gd.playoffGamesCompleted}/{gd.playoffGamesTotal}</span> Playoff games
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className={styles.emptyPanel}>
                    <span>No games scheduled yet.</span>
                    <Link href={`${base}/schedule`} className={styles.panelLink}>Build schedule →</Link>
                  </div>
                )}
              </section>

              {/* By-division panel */}
              {gd.byDivision.length > 0 && (
                <section className={styles.analyticsPanel}>
                  <div className={styles.panelHeader}>
                    <Flag size={16} style={{ color: 'var(--logic-lime)' }} />
                    <h2 className={styles.sectionTitle} style={{ margin: 0 }}>By Division</h2>
                  </div>
                  <div className={styles.divisionTable}>
                    {gd.byDivision.map(d => {
                      const poolPct = d.poolTotal > 0 ? Math.round((d.poolCompleted / d.poolTotal) * 100) : 0;
                      return (
                        <div key={d.id} className={styles.divisionRow}>
                          <span className={styles.divisionName}>{d.name}</span>
                          <span className={styles.divisionCount}>
                            {d.playoffStarted
                              ? (d.latestRound ?? 'Playoffs')
                              : `${d.poolCompleted}/${d.poolTotal}`}
                          </span>
                          <div className={styles.gaugeWrap}>
                            <div className={styles.gaugeTrack}>
                              <div
                                className={styles.gaugeFill}
                                style={{
                                  width: `${d.playoffStarted ? 100 : poolPct}%`,
                                  background: d.playoffStarted ? '#f6c453' : poolPct >= 100 ? 'var(--logic-lime)' : 'var(--blueprint-blue)',
                                }}
                              />
                            </div>
                            <span className={styles.gaugePct} style={{ color: d.playoffStarted ? '#f6c453' : 'var(--data-gray)' }}>
                              {d.playoffStarted ? (d.nextRound ? `→ ${d.nextRound}` : 'Done') : `${poolPct}%`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {gd.playoffStarted && (
                    <div className={styles.subStats} style={{ marginTop: '0.5rem' }}>
                      <span className={styles.subStat} style={{ color: '#f6c453' }}>
                        <Trophy size={12} /> Playoffs underway
                      </span>
                    </div>
                  )}
                </section>
              )}
            </div>
          ) : (
            /* ── PRE/POST TOURNAMENT DAY: registration + payment ── */
            <div className={styles.analyticsGrid}>
              {/* Registration panel */}
              <section className={styles.analyticsPanel}>
                <div className={styles.panelHeader}>
                  <Users size={16} style={{ color: 'var(--logic-lime)' }} />
                  <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Registration</h2>
                  <Link href={`${base}/teams`} className={styles.panelLink}>View teams →</Link>
                </div>
                {reg.totalCapacity > 0 ? (
                  <div className={styles.mainGauge}>
                    <div className={styles.gaugeFigures}>
                      <span className={styles.gaugeMain}>{reg.totalAccepted}</span>
                      <span className={styles.gaugeOf}>/ {reg.totalCapacity}</span>
                      <span className={styles.gaugeLabel}>accepted</span>
                    </div>
                    <GaugeBar value={reg.totalAccepted} max={reg.totalCapacity} />
                  </div>
                ) : (
                  <div className={styles.mainGauge}>
                    <span className={styles.gaugeMain}>{reg.totalAccepted}</span>
                    <span className={styles.gaugeLabel}>teams accepted (no capacity set)</span>
                  </div>
                )}
                {(reg.totalPending > 0 || reg.totalWaitlist > 0) && (
                  <div className={styles.subStats}>
                    {reg.totalPending  > 0 && <span className={styles.subStat}><span className="badge badge-warning">{reg.totalPending}</span> Pending</span>}
                    {reg.totalWaitlist > 0 && <span className={styles.subStat}><span className="badge badge-neutral">{reg.totalWaitlist}</span> Waitlist</span>}
                  </div>
                )}
                {reg.byDivision.length > 1 && (
                  <div className={styles.divisionTable}>
                    {reg.byDivision.map(d => (
                      <div key={d.id} className={styles.divisionRow}>
                        <span className={styles.divisionName}>{d.name}</span>
                        <span className={styles.divisionCount}>{d.accepted}{d.capacity ? `/${d.capacity}` : ''}</span>
                        {d.capacity && <GaugeBar value={d.accepted} max={d.capacity} danger={d.accepted >= d.capacity} />}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Payment panel */}
              <section className={styles.analyticsPanel}>
                <div className={styles.panelHeader}>
                  <DollarSign size={16} style={{ color: 'var(--logic-lime)' }} />
                  <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Payments</h2>
                  <Link href={`${base}/teams`} className={styles.panelLink}>View teams →</Link>
                </div>
                {pay.hasFeeSchedule ? (
                  <>
                    <div className={styles.mainGauge}>
                      <div className={styles.gaugeFigures}>
                        <span className={styles.gaugeMain}>{fmt(pay.totalCollected)}</span>
                        <span className={styles.gaugeOf}>/ {fmt(pay.totalExpected)}</span>
                        <span className={styles.gaugeLabel}>collected</span>
                      </div>
                      <GaugeBar value={pay.totalCollected} max={pay.totalExpected} />
                    </div>
                    {(pay.totalExpected - pay.totalCollected) > 0 && (
                      <div className={styles.outstandingRow}>
                        <TrendingUp size={13} style={{ color: '#f6c453' }} />
                        <span>{fmt(pay.totalExpected - pay.totalCollected)} outstanding</span>
                      </div>
                    )}
                    <div className={styles.paymentBreakdown}>
                      {pay.counts.paid        > 0 && <div className={styles.payRow}><span className="badge badge-success">{pay.counts.paid}</span><span>Paid in full</span></div>}
                      {pay.counts.depositPaid > 0 && <div className={styles.payRow}><span className="badge badge-primary">{pay.counts.depositPaid}</span><span>Deposit paid</span></div>}
                      {pay.counts.pending     > 0 && <div className={styles.payRow}><span className="badge badge-warning">{pay.counts.pending}</span><span>Pending</span></div>}
                      {pay.counts.pastDue     > 0 && <div className={styles.payRow}><span className="badge badge-danger">{pay.counts.pastDue}</span><span>Past due</span></div>}
                    </div>
                  </>
                ) : (
                  <div className={styles.emptyPanel}>
                    <span>No fee schedule configured.</span>
                    <Link href={`${base}/manage`} className={styles.panelLink}>Set up fees →</Link>
                  </div>
                )}
              </section>
            </div>
          )}

          <div className={styles.recentEvents}>
            <LiveEventLog tournamentId={currentTournament.id} orgSlug={currentOrg?.slug} />
          </div>
        </>
      )}

      {/* ── COMPLETED DASHBOARD ──────────────────────────── */}
      {isCompleted && currentTournament?.id && (
        <>
          <div className={styles.statsGrid}>
            {liveCards.map(card => (
              <Link key={card.label} href={`${base}/${card.key}`} className={`card ${styles.statCard}`} id={`dashboard-${card.label.toLowerCase().replace(/\s/g, '-')}`}>
                <div className={styles.statIcon}><card.icon size={22} /></div>
                <div>
                  <div className={styles.statNum}>{card.value}</div>
                  <div className={styles.statLabel}>{card.label}</div>
                </div>
              </Link>
            ))}
          </div>

          <div className={styles.analyticsGrid}>
            <section className={styles.analyticsPanel}>
              <div className={styles.panelHeader}>
                <Users size={16} style={{ color: 'var(--logic-lime)' }} />
                <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Final Registration</h2>
                <Link href={`${base}/teams`} className={styles.panelLink}>View teams →</Link>
              </div>
              <div className={styles.mainGauge}>
                <div className={styles.gaugeFigures}>
                  <span className={styles.gaugeMain}>{reg.totalAccepted}</span>
                  {reg.totalCapacity > 0 && <><span className={styles.gaugeOf}>/ {reg.totalCapacity}</span></>}
                  <span className={styles.gaugeLabel}>teams</span>
                </div>
                {reg.totalCapacity > 0 && <GaugeBar value={reg.totalAccepted} max={reg.totalCapacity} />}
              </div>
              {reg.byDivision.length > 1 && (
                <div className={styles.divisionTable}>
                  {reg.byDivision.map(d => (
                    <div key={d.id} className={styles.divisionRow}>
                      <span className={styles.divisionName}>{d.name}</span>
                      <span className={styles.divisionCount}>{d.accepted}{d.capacity ? `/${d.capacity}` : ''}</span>
                      {d.capacity && <GaugeBar value={d.accepted} max={d.capacity} danger={false} />}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className={styles.analyticsPanel}>
              <div className={styles.panelHeader}>
                <DollarSign size={16} style={{ color: '#f6c453' }} />
                <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Final Payments</h2>
                <Link href={`${base}/teams`} className={styles.panelLink}>View teams →</Link>
              </div>
              {pay.hasFeeSchedule ? (
                <>
                  <div className={styles.mainGauge}>
                    <div className={styles.gaugeFigures}>
                      <span className={styles.gaugeMain}>{fmt(pay.totalCollected)}</span>
                      <span className={styles.gaugeOf}>/ {fmt(pay.totalExpected)}</span>
                      <span className={styles.gaugeLabel}>collected</span>
                    </div>
                    <GaugeBar value={pay.totalCollected} max={pay.totalExpected} />
                  </div>
                  {(pay.totalExpected - pay.totalCollected) > 0 && (
                    <div className={styles.outstandingRow}>
                      <TrendingUp size={13} style={{ color: '#f6c453' }} />
                      <span>{fmt(pay.totalExpected - pay.totalCollected)} still outstanding</span>
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.emptyPanel}><span>No fee schedule was configured.</span></div>
              )}
            </section>
          </div>

          {/* Wrap-up summary card */}
          <div className={styles.wrapUpCard}>
            <div className={styles.wrapUpIcon}><Trophy size={22} /></div>
            <div className={styles.wrapUpBody}>
              <h2>Tournament Complete</h2>
              <p>
                {visibleStats.teams} team{visibleStats.teams !== 1 ? 's' : ''} registered
                {visibleStats.completed > 0 ? ` · ${visibleStats.completed} games completed` : ''}
                {pay.hasFeeSchedule && pay.totalExpected > 0 ? ` · ${fmt(pay.totalCollected)} collected` : ''}
              </p>
            </div>
            <Link href={`${base}/results`} className={styles.panelLink} style={{ flexShrink: 0 }}>
              View results →
            </Link>
          </div>

          {/* Archive button — owner only */}
          {userRole === 'owner' && (
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              {archiveError && (
                <span style={{ fontSize: '0.8rem', color: 'var(--danger-light)', marginRight: '0.75rem', alignSelf: 'center' }}>{archiveError}</span>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-data"
                style={{ color: 'var(--white-40)', borderColor: 'var(--border-2)' }}
                onClick={() => { setArchiveError(''); setShowArchiveConfirm(true); }}
                disabled={archiving}
              >
                {archiving ? 'Archiving…' : 'Archive Tournament'}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── ARCHIVED ────────────────────────────────────── */}
      {status === 'archived' && (
        <div style={{ padding: '2rem 0', color: 'var(--data-gray)', fontSize: '0.85rem' }}>
          This tournament is archived. View historical results in{' '}
          <Link href={`${base}/archives`} style={{ color: 'var(--blueprint-blue)' }}>Past Tournaments</Link>.
        </div>
      )}

      {/* ── POPULATE-FROM MODAL ──────────────────────────── */}
      {populateOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}>
          <div className="modal" style={{ maxWidth: 500, width: '100%', padding: '1.75rem' }} onClick={e => e.stopPropagation()}>

            {/* ── PICK step ── */}
            {populateStep === 'pick' && (
              <>
                <div className="modal-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Copy size={17} style={{ color: 'var(--logic-lime)' }} />
                    <h3 style={{ margin: 0 }}>Clone setup from a past tournament</h3>
                  </div>
                  <button className="btn btn-ghost btn-data" onClick={() => setPopulateOpen(false)}>✕</button>
                </div>

                {!canClone ? (
                  <div style={{ padding: '0.5rem 0 1rem' }}>
                    <div className="alert alert-warning">{cloneUpgradeCopy}</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '1rem 0' }}>
                    {otherTournaments.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { setPopulateSelected(t); setPopulateStep('confirm'); }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '0.65rem 0.9rem',
                          border: `1px solid ${populateSelected?.id === t.id ? 'var(--logic-lime)' : 'var(--border-2)'}`,
                          borderRadius: 0,
                          background: 'var(--white-03)',
                          cursor: 'pointer', textAlign: 'left', color: 'inherit',
                        }}
                      >
                        <span>
                          <span style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem' }}>{t.name}</span>
                          {t.year && <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--white-40)' }}>{t.year} · {t.status ?? ''}</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="modal-footer">
                  <button className="btn btn-ghost btn-data" onClick={() => setPopulateOpen(false)}>Cancel</button>
                </div>
              </>
            )}

            {/* ── CONFIRM step ── */}
            {populateStep === 'confirm' && populateSelected && !populateDone && (
              <>
                <div className="modal-header">
                  <h3 style={{ margin: 0 }}>Replace setup with {populateSelected.name}?</h3>
                  <button className="btn btn-ghost btn-data" onClick={() => setPopulateOpen(false)}>✕</button>
                </div>
                <div style={{ margin: '1rem 0', fontSize: '0.875rem', color: 'var(--white-70)', lineHeight: 1.6 }}>
                  <p style={{ margin: '0 0 0.75rem' }}>
                    This will <strong>replace</strong> the current setup of <strong>{currentTournament?.name}</strong> with data from <strong>{populateSelected.name}</strong>:
                  </p>
                  <ul style={{ margin: '0 0 0.75rem', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <li>Divisions, pools, and slot placeholders</li>
                    <li>Venues and contacts</li>
                    <li>Branding and fee schedule</li>
                    <li>Rules, resources, and registration questions</li>
                  </ul>
                  <p style={{ margin: 0, color: 'var(--white-50)' }}>
                    Your tournament name, URL, and dates are not changed. Registrations and scores are never copied. <strong>This cannot be undone.</strong>
                  </p>
                </div>
                {populateError && (
                  <div className="alert alert-danger" style={{ marginBottom: '0.75rem', fontSize: '0.82rem' }}>{populateError}</div>
                )}
                <div className="modal-footer">
                  <button className="btn btn-ghost btn-data" onClick={() => setPopulateStep('pick')} disabled={populateWorking}>Back</button>
                  <button className="btn btn-danger btn-data" onClick={handlePopulateConfirm} disabled={populateWorking}>
                    {populateWorking ? 'Applying…' : 'Yes, replace setup'}
                  </button>
                </div>
              </>
            )}

            {/* ── SUCCESS step ── */}
            {populateDone && (
              <>
                <div className="modal-header">
                  <h3 style={{ margin: 0 }}>Setup replaced</h3>
                </div>
                <p style={{ margin: '1rem 0', fontSize: '0.875rem', color: 'var(--white-70)' }}>
                  <strong>{currentTournament?.name}</strong>'s setup has been updated from <strong>{populateSelected?.name}</strong>. Review your divisions and checklist to confirm everything looks right.
                </p>
                <div className="modal-footer">
                  <button className="btn btn-primary btn-data" onClick={() => setPopulateOpen(false)}>Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── ARCHIVE CONFIRMATION MODAL ───────────────────── */}
      {showArchiveConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}>
          <div className="modal" style={{ maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Archive this tournament?</h3>
              <button className="btn btn-ghost btn-data" onClick={() => setShowArchiveConfirm(false)}>✕</button>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--data-gray)', margin: '0 0 0.75rem' }}>
              Archiving seals this tournament permanently. Archived tournaments are read-only and appear under Past Tournaments. <strong>This cannot be undone.</strong>
            </p>
            {archiveError && (
              <p style={{ fontSize: '0.8rem', color: 'var(--danger-light)', margin: '0 0 0.5rem' }}>{archiveError}</p>
            )}
            <div className="modal-footer">
              <button className="btn btn-ghost btn-data" onClick={() => setShowArchiveConfirm(false)} disabled={archiving}>
                Cancel
              </button>
              <button className="btn btn-danger btn-data" onClick={handleArchive} disabled={archiving}>
                {archiving ? 'Archiving…' : 'Archive Tournament'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIVATE CONFIRMATION MODAL ──────────────────── */}
      {showActivateConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}>
          <div className="modal" style={{ maxWidth: 420, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Activate tournament?</h3>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--data-gray)', margin: '0 0 0.5rem' }}>
              This will make the public tournament page live and open registration to teams. You can deactivate it later from the Manage page if needed.
            </p>
            {currentTournament?.slug && (
              <p style={{ fontSize: '0.8rem', color: 'var(--white-40)', margin: '0 0 0.5rem', wordBreak: 'break-all' }}>
                Public URL:{' '}
                <span style={{ color: 'var(--white-60)', fontFamily: 'monospace' }}>
                  {typeof window !== 'undefined' ? window.location.origin : ''}/{currentOrg?.slug}/tournaments/{currentTournament.slug}
                </span>
              </p>
            )}
            {activateError && (
              <p style={{ fontSize: '0.8rem', color: 'var(--danger-light)', margin: '0 0 0.5rem' }}>{activateError}</p>
            )}
            <div className="modal-footer">
              <button className="btn btn-ghost btn-data" onClick={() => { setShowActivateConfirm(false); setActivateError(''); }} disabled={activating}>
                Cancel
              </button>
              <button className="btn btn-lime btn-data" onClick={handleActivate} disabled={activating}>
                {activating ? 'Activating…' : 'Yes, activate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
