'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, ChevronDown, ChevronUp, User, Search } from 'lucide-react';
import { useParams } from 'next/navigation';
import { getTeams, getAgeGroups, getOrganizationBySlug, getTournamentsByOrg } from '@/lib/db';
import { Team, AgeGroup, Tournament } from '@/lib/types';
import YearSelector from '@/components/YearSelector';
import styles from './teams.module.css';

export default function TeamsPage() {
  const params   = useParams();
  const orgSlug  = params.orgSlug as string;
  const [teams, setTeams]         = useState<Team[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [activeGroup, setActiveGroup] = useState<string>('all');
  const [search, setSearch]       = useState('');
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());

  useEffect(() => {
    async function init() {
      const org = await getOrganizationBySlug(orgSlug);
      const ts  = org ? await getTournamentsByOrg(org.id) : [];
      setTournaments(ts);
      const active = ts.find(t => t.isActive);
      setSelectedTournament(active ?? ts[0] ?? null);
    }
    init();
  }, [orgSlug]);

  useEffect(() => {
    if (!selectedTournament) return;
    async function fetchTeams() {
      const allTeams = await getTeams(selectedTournament!.id);
      setTeams(allTeams.filter(t => t.status === 'accepted'));
      setAgeGroups(await getAgeGroups(selectedTournament!.id));
    }
    fetchTeams();
  }, [selectedTournament]);

  const filtered = (activeGroup === 'all' ? teams : teams.filter(t => t.ageGroupId === activeGroup))
    .filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  const getGroupName = (id: string) => ageGroups.find(g => g.id === id)?.name ?? '—';
  
  const countByGroup = Object.fromEntries(ageGroups.map(g => [g.id, teams.filter(t => t.ageGroupId === g.id).length]));
  const totalCount = teams.length;

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
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
            tournaments={tournaments}
            selected={selectedTournament}
            onSelect={t => { setSelectedTournament(t); setActiveGroup('all'); setSearch(''); }}
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
            {ageGroups.map(g => (
              <button key={g.id}
                className={`tab-btn ${activeGroup === g.id ? 'active' : ''}`}
                onClick={() => setActiveGroup(g.id)}
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
              {ageGroups.filter(g => activeGroup === 'all' || g.id === activeGroup).map(group => {
                const groupTeams = filtered.filter(t => t.ageGroupId === group.id);
                if (groupTeams.length === 0) return null;

                // 1. Get official pools for this group
                const groupPools = (group.poolCount || 0) >= 2 ? (group.pools || []) : [];
                const poolIds = groupPools.map(p => p.id);
                
                // 2. Group teams by pool_id
                const poolGroups: { name: string, teams: Team[] }[] = [];
                
                if (groupPools.length >= 2) {
                  // Multiple pools: Group by pool_id
                  groupPools.forEach(p => {
                    const teamsInPool = groupTeams.filter(t => t.poolId === p.id);
                    if (teamsInPool.length > 0) {
                      poolGroups.push({ name: p.name, teams: teamsInPool });
                    }
                  });

                  // Add any "Unassigned" teams
                  const unassigned = groupTeams.filter(t => !t.poolId || !poolIds.includes(t.poolId));
                  if (unassigned.length > 0) {
                    poolGroups.push({ name: 'Awaiting Assignment', teams: unassigned });
                  }
                } else {
                  // No pools: Just one group with no header
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
                              // Clean team name (remove anything in brackets like "(Gold)")
                              const cleanName = team.name.replace(/\s*\(.*?\)\s*/g, '').trim();
                              
                              return (
                                <div key={team.id} className={styles.teamRow}>
                                  <div className={styles.teamMain}>
                                    <div>
                                      <h4 className={styles.teamName}>{cleanName}</h4>
                                      {team.coach && <span className={styles.coach}>Coach: {team.coach}</span>}
                                    </div>
                                  </div>
                                  <Link href={`/${orgSlug}/teams/${team.id}`} className={styles.viewLink}>Profile →</Link>
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
