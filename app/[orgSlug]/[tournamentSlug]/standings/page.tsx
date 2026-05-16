'use client';
import { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';
import { useParams } from 'next/navigation';
import { getAgeGroups, getStandings, getOrganizationBySlug, getTournamentsByOrg } from '@/lib/db';
import { getAgPref, setAgPref } from '@/lib/age-group-cookie';
import { isPublicPageEnabled } from '@/lib/public-pages';
import { AgeGroup, Tournament } from '@/lib/types';
import YearSelector from '@/components/YearSelector';
import { formatPoolName } from '@/lib/utils';
import styles from '../../standings/standings.module.css';

export default function StandingsPage() {
  const params         = useParams();
  const orgSlug        = params.orgSlug as string;
  const tournamentSlug = params.tournamentSlug as string;

  const [ageGroups, setAgeGroups]         = useState<AgeGroup[]>([]);
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [activeGroup, setActiveGroup]     = useState<string>('');
  const [standings, setStandings]         = useState<any[]>([]);

  useEffect(() => {
    async function init() {
      const org = await getOrganizationBySlug(orgSlug);
      const ts  = org ? await getTournamentsByOrg(org.id) : [];
      setAllTournaments(ts.filter(t => t.status !== 'archived'));
      const current = ts.find(t => t.slug === tournamentSlug) ?? null;
      setSelectedTournament(current);
      const groups = await getAgeGroups(current?.id);
      setAgeGroups(groups);
      if (groups.length > 0) {
        const pref = getAgPref(orgSlug);
        const preferred = pref ? groups.find(g => g.name === pref) : null;
        setActiveGroup((preferred ?? groups[0]).id);
      }
    }
    init();
  }, [orgSlug, tournamentSlug]);

  useEffect(() => {
    if (!selectedTournament || !activeGroup) return;
    async function fetchStandings() {
      const group   = ageGroups.find(g => g.id === activeGroup);
      const results = await getStandings(activeGroup, group?.playoffConfig);
      setStandings(results.map(s => ({ ...s, id: s.teamId, name: s.teamName })));
    }
    fetchStandings();
  }, [activeGroup, selectedTournament, ageGroups]);

  const currentGroup = ageGroups.find(g => g.id === activeGroup);
  const pools        = currentGroup?.pools || [];

  if (selectedTournament && !isPublicPageEnabled(selectedTournament, 'standings')) {
    return (
      <div className="page-content">
        <div className="section">
          <div className="container">
            <div className="empty-state">
              <Trophy size={48} />
              <p>Standings are not available for this tournament.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className={styles.pageHeader}>
        <div className="container">
          <span className="eyebrow"><Trophy size={12} /> Standings</span>
          <h1 className="display-lg">Pool Standings</h1>
          <p className="text-muted">Current standings by pool and division.</p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          <YearSelector
            tournaments={allTournaments}
            orgSlug={orgSlug}
            currentTournamentSlug={tournamentSlug}
            currentPage="standings"
          />

          <div className="tabs" style={{ padding: '0.375rem 0.75rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {ageGroups.map(g => (
                <button
                  key={g.id}
                  className={`tab-btn ${activeGroup === g.id ? 'active' : ''}`}
                  onClick={() => { setActiveGroup(g.id); setAgPref(orgSlug, g.name); }}
                  id={`standings-tab-${g.name}`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          {activeGroup && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {(pools.length >= 2 ? pools : [{ id: 'default', name: 'All Teams' }]).map(pool => {
                const poolStandings = pools.length >= 2
                  ? standings.filter(s => s.poolId === pool.id)
                  : standings;

                if (poolStandings.length === 0) return null;

                return (
                  <div key={pool.id} className={styles.summarySection} style={{ margin: 0 }}>
                    <div className={styles.summaryHeader}>
                      <div className="flex-between" style={{ width: '100%' }}>
                        <div className="flex gap-2">
                          <Trophy size={18} style={{ color: 'var(--primary-light)' }} />
                          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                            Standings{pools.length >= 2 ? ` — ${formatPoolName(pool.name)}` : ''}
                          </h2>
                        </div>
                        <div className={styles.rulesInfo} title="Tie-Breaker Hierarchy">
                          Tie Breaker: {(currentGroup?.playoffConfig?.tieBreakers || ['h2h', 'rd', 'rf', 'ra']).map(b => b.toUpperCase()).join(' → ')}
                        </div>
                      </div>
                    </div>

                    <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                      <table className={styles.standingsTable}>
                        <thead>
                          <tr>
                            <th className={styles.stickyCol}>Team</th>
                            <th style={{ textAlign: 'center' }}>W</th>
                            <th style={{ textAlign: 'center' }}>L</th>
                            <th style={{ textAlign: 'center' }}>T</th>
                            <th style={{ textAlign: 'center' }}>RF</th>
                            <th style={{ textAlign: 'center' }}>RA</th>
                            <th style={{ textAlign: 'center' }}>RD</th>
                            <th style={{ textAlign: 'center' }}>PTS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {poolStandings.map((team, idx) => {
                            const gamesStarted = poolStandings.some(s => s.gp > 0);
                            const isFirst      = idx === 0 && gamesStarted;
                            return (
                              <tr key={team.id} className={isFirst ? styles.topRow : ''}>
                                <td className={styles.stickyCol}>
                                  <div className={styles.teamCell}>
                                    {isFirst && <Trophy size={14} style={{ color: 'var(--warning)' }} />}
                                    {team.name}{team.hasPendingGame ? ' *' : ''}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center' }} className={styles.statValue}>{team.w}</td>
                                <td style={{ textAlign: 'center' }} className={styles.statValue}>{team.l}</td>
                                <td style={{ textAlign: 'center' }} className={styles.statValue}>{team.t}</td>
                                <td style={{ textAlign: 'center' }}>{team.rf}</td>
                                <td style={{ textAlign: 'center' }}>{team.ra}</td>
                                <td style={{ textAlign: 'center', color: team.rd > 0 ? 'var(--success)' : team.rd < 0 ? 'var(--danger)' : 'inherit' }}>
                                  {team.rd > 0 ? `+${team.rd}` : team.rd}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <span className="badge badge-primary">{team.pts}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {poolStandings.some(s => s.hasPendingGame) && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--white-40)', padding: '0.5rem 1rem 0.75rem', margin: 0 }}>
                        * Standings include scores pending admin finalization. Stats may change.
                      </p>
                    )}
                  </div>
                );
              })}

              {standings.length === 0 && (
                <div className="empty-state">
                  <Trophy size={48} />
                  <p>No standings available yet. Check back once games are underway.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
