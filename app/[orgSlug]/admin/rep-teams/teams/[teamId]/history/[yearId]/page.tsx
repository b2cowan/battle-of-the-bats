'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { Archive, ChevronRight } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import styles from '../../../../rep-teams.module.css';
import type { RepTeam, RepProgramYear, RepRosterPlayer, RepTeamEvent } from '@/lib/types';

interface EnrichedCoach {
  id: string;
  userId: string;
  coachRole: string;
  displayName: string | null;
  email: string;
}

type Tab = 'roster' | 'schedule' | 'coaches' | 'documents';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', active: 'Active', completed: 'Completed', archived: 'Archived',
};
const STATUS_CSS: Record<string, string> = {
  draft: styles.badgeDraft, active: styles.badgeActive,
  completed: styles.badgeCompleted, archived: styles.badgeArchived,
};

const EVENT_TYPE_LABEL: Record<string, string> = {
  practice: 'Practice', league_game: 'Game', scrimmage: 'Scrimmage',
  external_tournament: 'Tournament', team_event: 'Team Event', other: 'Other',
};

const RESULT_COLOR: Record<string, string> = {
  win: '#4ade80', loss: '#f87171', tie: 'var(--white-50)',
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function PastYearDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string; yearId: string }>;
}) {
  const params = use(paramsPromise);
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const base = `/${currentOrg?.slug ?? ''}/admin`;

  const [tab, setTab] = useState<Tab>('roster');
  const [team, setTeam] = useState<RepTeam | null>(null);
  const [programYear, setProgramYear] = useState<RepProgramYear | null>(null);
  const [roster, setRoster] = useState<RepRosterPlayer[]>([]);
  const [events, setEvents] = useState<RepTeamEvent[]>([]);
  const [coaches, setCoaches] = useState<EnrichedCoach[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setFetching(true);
    setError('');
    try {
      const [pyRes, rosterRes, eventsRes, coachesRes] = await Promise.all([
        fetch(`/api/admin/rep-teams/teams/${params.teamId}/program-years/${params.yearId}`),
        fetch(`/api/admin/rep-teams/teams/${params.teamId}/program-years/${params.yearId}/roster`),
        fetch(`/api/admin/rep-teams/teams/${params.teamId}/program-years/${params.yearId}/events`),
        fetch(`/api/admin/rep-teams/teams/${params.teamId}/program-years/${params.yearId}/coaches`),
      ]);

      const pyData = await pyRes.json();
      if (!pyRes.ok) throw new Error(pyData.error ?? 'Failed to load program year');

      const [rosterData, eventsData, coachesData] = await Promise.all([
        rosterRes.json(),
        eventsRes.json(),
        coachesRes.json(),
      ]);

      setTeam(pyData.team);
      setProgramYear(pyData.programYear);
      setRoster(rosterData.players ?? []);
      setEvents(eventsData.events ?? []);
      setCoaches(coachesData.coaches ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load.');
    } finally {
      setFetching(false);
    }
  }, [params.teamId, params.yearId]);

  useEffect(() => { if (currentOrg) load(); }, [currentOrg, load]);

  if (loading || fetching) return <p className={styles.muted}>Loading…</p>;

  if (!userRole || !hasCapability(userRole, userCapabilities, 'module_rep_teams')) {
    return (
      <div className={styles.accessDenied}>
        <Archive size={32} />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have access to the Rep Teams module.</p>
      </div>
    );
  }

  if (!team || !programYear) return <p className={styles.muted}>Program year not found.</p>;

  const isReadOnly = programYear.status === 'completed' || programYear.status === 'archived';
  if (!isReadOnly) {
    return (
      <p className={styles.muted}>
        This program year is still active.{' '}
        <Link href={`${base}/rep-teams/teams/${params.teamId}/program-years/${params.yearId}`}>
          View active year →
        </Link>
      </p>
    );
  }

  const gameEvents = events.filter(e =>
    e.eventType === 'league_game' || e.eventType === 'scrimmage' || e.eventType === 'external_tournament',
  );
  const wins = gameEvents.filter(e => e.result === 'win').length;
  const losses = gameEvents.filter(e => e.result === 'loss').length;
  const ties = gameEvents.filter(e => e.result === 'tie').length;

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href={`${base}/rep-teams`}>Rep Teams</Link>
        <span><ChevronRight size={12} /></span>
        <Link href={`${base}/rep-teams/teams/${params.teamId}`}>{team.name}</Link>
        <span><ChevronRight size={12} /></span>
        <Link href={`${base}/rep-teams/teams/${params.teamId}/history`}>History</Link>
        <span><ChevronRight size={12} /></span>
        <span>{programYear.name}</span>
      </div>

      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          {team.color && (
            <span className={styles.colorSwatch} style={{ background: team.color, width: 20, height: 20 }} />
          )}
          <div>
            <h1 className={styles.pageTitle}>{programYear.name}</h1>
            <p className={styles.pageSub}>
              {team.name} · {programYear.year}
              <span
                className={`${styles.badge} ${STATUS_CSS[programYear.status] ?? ''}`}
                style={{ marginLeft: '0.5rem' }}
              >
                {STATUS_LABEL[programYear.status] ?? programYear.status}
              </span>
            </p>
          </div>
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--white-35)', alignSelf: 'center' }}>
          Read-only archive
        </span>
      </div>

      {error && <p style={{ color: '#f87171', marginBottom: '1rem' }}>{error}</p>}

      {/* Quick stats */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{roster.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--white-40)' }}>Players</div>
        </div>
        <div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{coaches.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--white-40)' }}>Coaches</div>
        </div>
        {gameEvents.length > 0 && (
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>
              {wins}W – {losses}L – {ties}T
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--white-40)' }}>Record</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className={styles.tabs} style={{ marginBottom: '1.5rem' }}>
        {(['roster', 'schedule', 'coaches', 'documents'] as Tab[]).map(t => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'roster' ? 'Roster' : t === 'schedule' ? 'Schedule & Results' : t === 'coaches' ? 'Coaches' : 'Documents'}
          </button>
        ))}
      </div>

      {/* Roster tab */}
      {tab === 'roster' && (
        roster.length === 0 ? (
          <div className={styles.emptyState}><p>No roster players recorded for this season.</p></div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>#</th>
                  <th className={styles.th}>Player</th>
                  <th className={styles.th}>Guardian</th>
                  <th className={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {roster.map(p => (
                  <tr key={p.id} className={styles.tr}>
                    <td className={styles.td} style={{ color: 'var(--white-40)', width: '2.5rem' }}>
                      {p.playerNumber ?? '—'}
                    </td>
                    <td className={styles.td}>
                      {p.playerFirstName} {p.playerLastName}
                    </td>
                    <td className={styles.td} style={{ color: 'var(--white-50)' }}>
                      {p.guardianFirstName || p.guardianLastName
                        ? `${p.guardianFirstName ?? ''} ${p.guardianLastName ?? ''}`.trim()
                        : '—'}
                    </td>
                    <td className={styles.td}>
                      <span className={`${styles.badge} ${p.status === 'active' ? styles.badgeActive : styles.badgeArchived}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Schedule & Results tab */}
      {tab === 'schedule' && (
        events.length === 0 ? (
          <div className={styles.emptyState}><p>No events recorded for this season.</p></div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Date</th>
                  <th className={styles.th}>Type</th>
                  <th className={styles.th}>Name</th>
                  <th className={styles.th}>Opponent</th>
                  <th className={styles.th}>Result</th>
                </tr>
              </thead>
              <tbody>
                {events
                  .slice()
                  .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
                  .map(e => (
                    <tr key={e.id} className={styles.tr}>
                      <td className={styles.td} style={{ color: 'var(--white-50)', whiteSpace: 'nowrap' }}>
                        {fmtDate(e.startsAt)}
                      </td>
                      <td className={styles.td} style={{ color: 'var(--white-40)', fontSize: '0.78rem' }}>
                        {EVENT_TYPE_LABEL[e.eventType] ?? e.eventType}
                      </td>
                      <td className={styles.td}>{e.name}</td>
                      <td className={styles.td} style={{ color: 'var(--white-50)' }}>
                        {e.opponent ?? '—'}
                      </td>
                      <td className={styles.td}>
                        {e.result ? (
                          <span style={{ color: RESULT_COLOR[e.result] ?? 'inherit', fontWeight: 600, textTransform: 'capitalize' }}>
                            {e.result}
                            {e.homeScore != null && e.awayScore != null && ` (${e.homeScore}–${e.awayScore})`}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Coaches tab */}
      {tab === 'coaches' && (
        coaches.length === 0 ? (
          <div className={styles.emptyState}><p>No coaches recorded for this season.</p></div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Name</th>
                  <th className={styles.th}>Role</th>
                  <th className={styles.th}>Email</th>
                </tr>
              </thead>
              <tbody>
                {coaches.map(c => (
                  <tr key={c.id} className={styles.tr}>
                    <td className={styles.td}>{c.displayName ?? c.email}</td>
                    <td className={styles.td} style={{ color: 'var(--white-50)', fontSize: '0.78rem' }}>
                      {c.coachRole === 'head_coach' ? 'Head Coach' : 'Assistant Coach'}
                    </td>
                    <td className={styles.td} style={{ color: 'var(--white-40)', fontSize: '0.78rem' }}>
                      {c.email}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Documents tab */}
      {tab === 'documents' && (
        <div className={styles.emptyState} style={{ textAlign: 'left' }}>
          <p style={{ marginBottom: '0.75rem', color: 'var(--white-60)' }}>
            Player documents are stored per-player and accessible from the roster page.
          </p>
          <p>
            <Link
              href={`${base}/rep-teams/documents`}
              style={{ color: '#a78bfa', fontSize: '0.85rem' }}
            >
              View document templates →
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
