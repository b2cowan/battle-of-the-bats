'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  Building2, Users, Trophy, CalendarDays, UserCheck, Shield,
  Lock, RefreshCw, Trash2, CheckCircle, AlertCircle, Loader, Zap,
} from 'lucide-react';
import styles from './dev.module.css';

interface Status {
  orgs: number;
  orgId: string | null;
  orgSlug: string | null;
  platformUsers: number;
  tournaments: number;
  leagueSeasons: number;
  repTeams: number;
  orgUsers: number;
}

interface SeedResult {
  ok: boolean;
  log?: string[];
  error?: string;
}

const CREDENTIALS = [
  { email: 'owner@dev.local',        role: 'Org Owner'        },
  { email: 'admin@dev.local',        role: 'Org Admin'        },
  { email: 'staff@dev.local',        role: 'Staff'            },
  { email: 'coach@dev.local',        role: 'Coach'            },
  { email: 'league-admin@dev.local', role: 'League Admin'     },
  { email: 'treasurer@dev.local',    role: 'Treasurer'        },
  { email: 'platform@dev.local',     role: 'Platform Admin'   },
];

function StatusPill({ count, label }: { count: number; label: string }) {
  return (
    <span className={count > 0 ? styles.pillHas : styles.pillEmpty}>
      {count} {label}
    </span>
  );
}

function SeedCard({
  icon: Icon,
  title,
  description,
  creates,
  locked,
  lockReason,
  statusBadges,
  onSeed,
  busy,
  result,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  creates: string;
  locked: boolean;
  lockReason?: string;
  statusBadges: React.ReactNode;
  onSeed: () => void;
  busy: boolean;
  result: SeedResult | null;
}) {
  return (
    <div className={`${styles.card} ${locked ? styles.cardLocked : ''}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardIcon}>
          <Icon size={18} />
        </div>
        <div className={styles.cardMeta}>
          <div className={styles.cardTitle}>{title}</div>
          <div className={styles.cardDesc}>{description}</div>
        </div>
        {locked ? (
          <div className={styles.lockWrap} title={lockReason}>
            <Lock size={14} />
          </div>
        ) : (
          <button className={styles.seedBtn} onClick={onSeed} disabled={busy}>
            {busy ? <Loader size={13} className={styles.spin} /> : 'Seed'}
          </button>
        )}
      </div>
      <div className={styles.cardFooter}>
        <div className={styles.creates}>Creates: {creates}</div>
        <div className={styles.badges}>{statusBadges}</div>
      </div>
      {locked && lockReason && (
        <div className={styles.lockMsg}><Lock size={11} /> {lockReason}</div>
      )}
      {result && (
        <div className={result.ok ? styles.logOk : styles.logErr}>
          {result.ok
            ? <CheckCircle size={12} />
            : <AlertCircle size={12} />
          }
          <div className={styles.logLines}>
            {result.error && <div>{result.error}</div>}
            {result.log?.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

function readPlanGatesCookie(): 'live' | 'enforced' {
  if (typeof document === 'undefined') return 'enforced';
  const match = document.cookie.match(/dev_plan_gates=([^;]+)/);
  return (match?.[1] === 'live') ? 'live' : 'enforced';
}

export default function DevDashboard() {
  const [status, setStatus]   = useState<Status | null>(null);
  const [busy,   setBusy]     = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, SeedResult | null>>({});
  const [wiping,      setWiping]      = useState(false);
  const [wipeConfirm, setWipeConfirm] = useState(false);
  const [wipeResult,  setWipeResult]  = useState<SeedResult | null>(null);
  const [planGatesMode, setPlanGatesMode] = useState<'live' | 'enforced'>('enforced');
  const [planGatesBusy, setPlanGatesBusy] = useState(false);

  useEffect(() => { setPlanGatesMode(readPlanGatesCookie()); }, []);

  const fetchStatus = useCallback(async () => {
    const res = await fetch('/api/dev/seed/status');
    if (res.ok) setStatus(await res.json());
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  async function seed(key: string, endpoint: string) {
    setBusy(b => ({ ...b, [key]: true }));
    setResults(r => ({ ...r, [key]: null }));
    try {
      const res  = await fetch(endpoint, { method: 'POST' });
      const data = await res.json() as SeedResult;
      setResults(r => ({ ...r, [key]: data }));
      await fetchStatus();
    } catch {
      setResults(r => ({ ...r, [key]: { ok: false, error: 'Network error' } }));
    } finally {
      setBusy(b => ({ ...b, [key]: false }));
    }
  }

  async function togglePlanGates() {
    const next = planGatesMode === 'live' ? 'enforced' : 'live';
    setPlanGatesBusy(true);
    try {
      await fetch('/api/dev/set-plan-gates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: next }),
      });
      setPlanGatesMode(next);
    } finally {
      setPlanGatesBusy(false);
    }
  }

  async function handleWipe() {
    setWiping(true);
    setWipeConfirm(false);
    setWipeResult(null);
    try {
      const res  = await fetch('/api/dev/seed/wipe', { method: 'POST' });
      const data = await res.json() as SeedResult;
      setWipeResult(data);
      setResults({});
      await fetchStatus();
    } catch {
      setWipeResult({ ok: false, error: 'Network error' });
    } finally {
      setWiping(false);
    }
  }

  const hasOrg    = (status?.orgs ?? 0) > 0;
  const hasRepTeam = (status?.repTeams ?? 0) > 0;

  const CARDS = [
    {
      key:         'platform-user',
      endpoint:    '/api/dev/seed/platform-user',
      icon:        Shield,
      title:       'Platform Admin',
      description: 'A FieldLogicHQ staff account with access to /platform-admin',
      creates:     'platform@dev.local (platform admin)',
      locked:      false,
      lockReason:  undefined,
      badges:      <StatusPill count={status?.platformUsers ?? 0} label="platform users" />,
    },
    {
      key:         'org',
      endpoint:    '/api/dev/seed/org',
      icon:        Building2,
      title:       'Org + Owner',
      description: 'Creates the dev-test-org organisation with an owner account',
      creates:     'dev-test-org, owner@dev.local (owner)',
      locked:      false,
      lockReason:  undefined,
      badges:      <StatusPill count={status?.orgs ?? 0} label="orgs" />,
    },
    {
      key:         'users',
      endpoint:    '/api/dev/seed/users',
      icon:        Users,
      title:       'User Set',
      description: 'One account per org role — covers all permission levels',
      creates:     'admin / staff / coach / league-admin / treasurer @dev.local',
      locked:      !hasOrg,
      lockReason:  'Seed Org + Owner first',
      badges:      <StatusPill count={status?.orgUsers ?? 0} label="non-owner members" />,
    },
    {
      key:         'tournament',
      endpoint:    '/api/dev/seed/tournament',
      icon:        Trophy,
      title:       'Tournament',
      description: 'A full active tournament with two age groups, teams, and a round-robin schedule',
      creates:     '1 tournament, 2 age groups, 8 teams, 12 games',
      locked:      !hasOrg,
      lockReason:  'Seed Org + Owner first',
      badges:      <StatusPill count={status?.tournaments ?? 0} label="tournaments" />,
    },
    {
      key:         'house-league',
      endpoint:    '/api/dev/seed/house-league',
      icon:        CalendarDays,
      title:       'House League Season',
      description: 'An active recreational season with divisions, teams, games, and sample registrations',
      creates:     '1 season, 2 divisions, 6 teams, 6 games, 2 registrations',
      locked:      !hasOrg,
      lockReason:  'Seed Org + Owner first',
      badges:      <StatusPill count={status?.leagueSeasons ?? 0} label="seasons" />,
    },
    {
      key:         'rep-team',
      endpoint:    '/api/dev/seed/rep-team',
      icon:        UserCheck,
      title:       'Rep Team',
      description: 'A competitive team program with roster players, a coach, and upcoming events',
      creates:     '1 team, 1 program year, 3 players, 1 coach link, 2 events',
      locked:      !hasOrg,
      lockReason:  'Seed Org + Owner first',
      badges:      <StatusPill count={status?.repTeams ?? 0} label="rep teams" />,
    },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerBadge}>DEV TOOLS</div>
        <h1 className={styles.title}>Seed Dashboard</h1>
        <button className={styles.refreshBtn} onClick={fetchStatus} title="Refresh status">
          <RefreshCw size={14} />
        </button>
      </header>

      {/* Credentials */}
      <div className={styles.credBox}>
        <div className={styles.credLabel}>All seed accounts — password: <code>devpass123</code></div>
        <div className={styles.credGrid}>
          {CREDENTIALS.map(c => (
            <div key={c.email} className={styles.credRow}>
              <code className={styles.credEmail}>{c.email}</code>
              <span className={styles.credRole}>{c.role}</span>
            </div>
          ))}
        </div>
        {status?.orgSlug && (
          <div className={styles.credOrg}>
            Org slug: <code>/dev-test-org/admin</code>
          </div>
        )}
      </div>

      {/* Seed cards */}
      <div className={styles.cards}>
        {CARDS.map(card => (
          <SeedCard
            key={card.key}
            icon={card.icon}
            title={card.title}
            description={card.description}
            creates={card.creates}
            locked={card.locked}
            lockReason={card.lockReason}
            statusBadges={card.badges}
            onSeed={() => seed(card.key, card.endpoint)}
            busy={busy[card.key] ?? false}
            result={results[card.key] ?? null}
          />
        ))}
      </div>

      {/* Plan gates toggle */}
      <div style={{
        border: '1px solid rgba(255,255,0,0.2)',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap' as const,
      }}>
        <Zap size={15} style={{ color: 'rgba(255,255,0,0.6)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f0f0f0', marginBottom: '0.2rem' }}>
            Plan Gates
          </div>
          <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>
            {planGatesMode === 'live'
              ? 'All plans treated as live — checkout CTAs visible on pricing page.'
              : 'Gates enforced — League and Club show early-access CTAs.'}
          </div>
        </div>
        <button
          onClick={togglePlanGates}
          disabled={planGatesBusy}
          style={{
            flexShrink: 0,
            fontFamily: 'var(--font-data, monospace)',
            fontSize: '0.65rem',
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase' as const,
            padding: '0.35rem 0.85rem',
            background: planGatesMode === 'live'
              ? 'rgba(255,255,0,0.1)'
              : 'rgba(255,255,255,0.05)',
            border: planGatesMode === 'live'
              ? '1px solid rgba(255,255,0,0.45)'
              : '1px solid rgba(255,255,255,0.15)',
            color: planGatesMode === 'live' ? '#ffff00' : 'rgba(255,255,255,0.5)',
            borderRadius: '5px',
            cursor: planGatesBusy ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          {planGatesBusy
            ? <Loader size={13} className={styles.spin} />
            : planGatesMode === 'live' ? 'Enforce Gates' : 'All Live'}
        </button>
      </div>

      {/* Danger zone */}
      <div className={styles.danger}>
        <div className={styles.dangerLabel}>Danger Zone</div>
        {wipeConfirm ? (
          <div className={styles.wipeConfirm}>
            <span className={styles.dangerDesc}>This deletes all orgs, users, and data. Cannot be undone.</span>
            <button className={styles.wipeBtn} onClick={handleWipe} disabled={wiping}>
              {wiping ? <Loader size={14} className={styles.spin} /> : <Trash2 size={14} />}
              {wiping ? 'Wiping…' : 'Yes, wipe everything'}
            </button>
            <button className={styles.wipeCancelBtn} onClick={() => setWipeConfirm(false)} disabled={wiping}>
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button className={styles.wipeBtn} onClick={() => setWipeConfirm(true)} disabled={wiping}>
              <Trash2 size={14} />
              Wipe Everything
            </button>
            <span className={styles.dangerDesc}>Deletes all orgs, all auth users, and all data.</span>
          </>
        )}
        {wipeResult && (
          <div className={wipeResult.ok ? styles.logOk : styles.logErr} style={{ marginTop: '0.5rem' }}>
            {wipeResult.ok ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
            <div className={styles.logLines}>
              {wipeResult.error && <div>{wipeResult.error}</div>}
              {wipeResult.log?.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
