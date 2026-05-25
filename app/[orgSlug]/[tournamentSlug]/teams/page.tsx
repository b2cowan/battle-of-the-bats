'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Search } from 'lucide-react';
import { useParams } from 'next/navigation';
import { getDivisionPref, setDivisionPref } from '@/lib/division-cookie';
import { isPublicPageEnabled } from '@/lib/public-pages';
import { Team, Division, Tournament } from '@/lib/types';
import YearSelector from '@/components/YearSelector';
import styles from '../../teams/teams.module.css';
import { fetchPublicTournamentData } from '@/lib/public-tournament-client';

export default function TeamsPage() {
  const params         = useParams();
  const orgSlug        = params.orgSlug as string;
  const tournamentSlug = params.tournamentSlug as string;

  const [teams, setTeams]           = useState<Team[]>([]);
  const [divisions, setDivisions]   = useState<Division[]>([]);
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [activeGroup, setActiveGroup] = useState<string>('all');
  const [search, setSearch]         = useState('');

  useEffect(() => {
    async function init() {
      const data = await fetchPublicTournamentData(orgSlug, tournamentSlug, 'teams');
      const current = data?.tournament ?? null;
      setAllTournaments(data?.tournaments ?? []);
      setSelectedTournament(current);
      setTeams(data?.teams ?? []);
      const groups = data?.divisions ?? [];
      setDivisions(groups);
      const pref = getDivisionPref(orgSlug);
      const preferred = pref ? groups.find(g => g.name === pref) : null;
      if (preferred) setActiveGroup(preferred.id);
    }
    init();
  }, [orgSlug, tournamentSlug]);

  const filtered = (activeGroup === 'all' ? teams : teams.filter(t => t.divisionId === activeGroup))
    .filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  const countByGroup = Object.fromEntries(divisions.map(g => [g.id, teams.filter(t => t.divisionId === g.id).length]));
  const totalCount = teams.length;

  if (selectedTournament && !isPublicPageEnabled(selectedTournament, 'teams')) {
    return (
      <div className="page-content">
        <div className="section">
          <div className="container">
            <div className="empty-state">
              <Users size={48} />
              <p>Teams are not available for this tournament.</p>
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
          <span className="eyebrow"><Users size={12} /> Teams</span>
          <h1 className="display-lg">Registered Teams</h1>
          <p className="text-muted">Browse participating teams by age division.</p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          <YearSelector
            tournaments={allTournaments}
            orgSlug={orgSlug}
            currentTournamentSlug={tournamentSlug}
            currentPage="teams"
          />

          <div className={styles.searchRow}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search teams..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className="tabs" style={{ marginBottom: '1.5rem' }}>
            <button className={`tab-btn ${activeGroup === 'all' ? 'active' : ''}`}
              onClick={() => setActiveGroup('all')} id="teams-tab-all">
              All <span className={styles.tabCount}>{totalCount}</span>
            </button>
            {divisions.map(g => (
              <button key={g.id}
                className={`tab-btn ${activeGroup === g.id ? 'active' : ''}`}
                onClick={() => { setActiveGroup(g.id); setDivisionPref(orgSlug, g.name); }}
                id={`teams-tab-${g.name}`}>
                {g.name} <span className={styles.tabCount}>{countByGroup[g.id] || 0}</span>
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <Users size={48} />
              <p>No teams registered yet.</p>
            </div>
          ) : (
            <div className={styles.divisionLayout}>
              {divisions.filter(g => activeGroup === 'all' || g.id === activeGroup).map(group => {
                const groupTeams = filtered.filter(t => t.divisionId === group.id);
                if (groupTeams.length === 0) return null;

                const groupPools = (group.poolCount || 0) >= 2 ? (group.pools || []) : [];
                const poolIds = groupPools.map(p => p.id);

                const poolGroups: { name: string, teams: Team[] }[] = [];

                if (groupPools.length >= 2) {
                  groupPools.forEach(p => {
                    const teamsInPool = groupTeams.filter(t => t.poolId === p.id);
                    if (teamsInPool.length > 0) {
                      poolGroups.push({ name: p.name, teams: teamsInPool });
                    }
                  });
                  const unassigned = groupTeams.filter(t => !t.poolId || !poolIds.includes(t.poolId));
                  if (unassigned.length > 0) {
                    poolGroups.push({ name: 'Awaiting Assignment', teams: unassigned });
                  }
                } else {
                  poolGroups.push({ name: '', teams: groupTeams });
                }

                return (
                  <div key={group.id} className={styles.groupSection}>
                    <h2 className={styles.groupTitle}>{group.name}</h2>

                    <div className={styles.poolGrid}>
                      {poolGroups.map(pg => (
                        <div key={pg.name} className={styles.poolCard}>
                          {pg.name && (
                            <h3 className={styles.poolName}>
                              {pg.name.replace(/^Pool\s+/i, '').trim()} Pool
                            </h3>
                          )}
                          <div className={styles.teamList}>
                            {pg.teams.map(team => {
                              const cleanName = team.name.replace(/\s*\(.*?\)\s*/g, '').trim();
                              return (
                                <div key={team.id} className={styles.teamRow}>
                                  <div className={styles.teamMain}>
                                    <div>
                                      <h4 className={styles.teamName}>{cleanName}</h4>
                                      {team.coach && <span className={styles.coach}>Coach: {team.coach}</span>}
                                    </div>
                                  </div>
                                  <Link href={`/${orgSlug}/${tournamentSlug}/teams/${team.id}`} className={styles.viewLink}>Profile →</Link>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
