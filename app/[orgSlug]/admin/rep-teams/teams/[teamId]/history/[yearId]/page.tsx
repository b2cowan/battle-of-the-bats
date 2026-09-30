'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { Archive } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import { hasDecidedGames, rosterCountOf, seasonRecordOf } from '@/lib/team-season-figures';
import { SCRIMMAGE_LABEL } from '@/lib/coach-schedule-vocab';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
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
  practice: 'Practice', league_game: 'Game', tournament_game: 'Game (Tournament)',
  external_tournament: 'Tournament', team_event: 'Team Event', other: 'Other',
};
/** A scrimmage is a Game with the box ticked (mig 306) — the word comes from the box, not the kind. */
function eventTypeLabel(e: { eventType: string; isScrimmage: boolean }): string {
  return e.isScrimmage ? SCRIMMAGE_LABEL : (EVENT_TYPE_LABEL[e.eventType] ?? e.eventType);
}

const RESULT_COLOR: Record<string, string> = {
  win: 'var(--success-light)', loss: 'var(--danger-light)', tie: 'var(--white-50)',
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// The faint inks this page repeats — the tertiary ink (the dark ramp's 40% missed AA on the kit's ground).
const statLabel = { fontSize: '0.75rem', color: 'var(--text-tertiary)' };
const faintCell = { color: 'var(--text-tertiary)', fontSize: '0.78rem' };
const numberCell = { color: 'var(--text-tertiary)', width: '2.5rem' };

export default function PastYearDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string; yearId: string }>;
}) {
  const params = use(paramsPromise);
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  const orgParam = currentOrg?.slug ? `&orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
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
        fetch(`/api/admin/rep-teams/teams/${params.teamId}/program-years/${params.yearId}${orgQuery}`),
        fetch(`/api/admin/rep-teams/teams/${params.teamId}/program-years/${params.yearId}/roster${orgQuery}`),
        fetch(`/api/admin/rep-teams/teams/${params.teamId}/program-years/${params.yearId}/events${orgQuery}`),
        fetch(`/api/admin/rep-teams/teams/${params.teamId}/program-years/${params.yearId}/coaches${orgQuery}`),
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
  }, [params.teamId, params.yearId, orgQuery]);

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
        This season is still live.{' '}
        <Link href={`${base}/rep-teams/teams/${params.teamId}`}>
          Open the team →
        </Link>
      </p>
    );
  }

  // THE RECORD RULE (lib/team-season-figures.ts, Club Tier B08) — the same function the history
  // list, the board and the schedule read. This page used `countsTowardRecord` alone, so a CANCELLED
  // game that still carried a score counted here and not one click away on the list.
  const { w: wins, l: losses, t: ties } = seasonRecordOf(events);
  const hasRecord = hasDecidedGames({ w: wins, l: losses, t: ties });

  const readOnlyNote = (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', alignSelf: 'center' }}>
          Read-only archive
        </span>
  );

  return (
    <div className={styles.page}>
      {/* Header — the way up is the team's History; the eyebrow names the team, the status is a chip
          beside the title, and the year is a chip only where the season's name does not already carry it
          (F3). "Read-only archive" stays at the header's end. */}
      <AdminPageHeader
        crumbs={[{ href: `${base}/rep-teams`, label: 'Rep Teams' }, { href: `${base}/rep-teams/teams/${params.teamId}`, label: team.name }]}
        title={programYear.name}
        titleChips={<>
          <span className={`${styles.badge} ${STATUS_CSS[programYear.status] ?? ''}`}>
            {STATUS_LABEL[programYear.status] ?? programYear.status}
          </span>
          {!programYear.name.includes(String(programYear.year)) && (
            <span className={`${styles.badge} ${styles.badgeDraft}`}>{programYear.year}</span>
          )}
        </>}
        backTo={{ href: `${base}/rep-teams/teams/${params.teamId}/history`, label: 'History' }}
        actions={readOnlyNote}
      />

      {error && <p style={{ color: 'var(--danger-light)', marginBottom: '1rem' }}>{error}</p>}

      {/* Quick stats */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{rosterCountOf(roster)}</div>
          <div style={statLabel}>Players</div>
        </div>
        <div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{coaches.length}</div>
          <div style={statLabel}>Coaches</div>
        </div>
        {hasRecord && (
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>
              {wins}W – {losses}L – {ties}T
            </div>
            <div style={statLabel}>Record</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
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
                    <td className={styles.td} style={numberCell}>
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
                      <td className={styles.td} style={faintCell}>
                        {eventTypeLabel(e)}
                      </td>
                      <td className={styles.td}>{e.name}</td>
                      <td className={styles.td} style={{ color: 'var(--white-50)' }}>
                        {e.opponent ?? '—'}
                      </td>
                      <td className={styles.td}>
                        {e.result ? (
                          <span style={{ color: RESULT_COLOR[e.result] ?? 'inherit', fontWeight: 600, textTransform: 'capitalize' }}>
                            {e.result}
                            {e.teamScore != null && e.opponentScore != null && ` (${e.teamScore}–${e.opponentScore})`}
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
                    <td className={styles.td} style={faintCell}>
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
              style={{ color: 'var(--home-olive)', fontSize: '0.85rem' }}
            >
              View document templates →
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
