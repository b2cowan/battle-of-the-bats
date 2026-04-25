'use client';
import { useState, useEffect } from 'react';
import { Users, ChevronDown, ChevronUp, User } from 'lucide-react';
import { getTeams, getAgeGroups, getTournaments } from '@/lib/db';
import { Team, AgeGroup, Tournament } from '@/lib/types';
import YearSelector from '@/components/YearSelector';
import styles from './teams.module.css';

export default function TeamsPage() {
  const [teams, setTeams]         = useState<Team[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [activeGroup, setActiveGroup] = useState<string>('all');
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());

  useEffect(() => {
    async function init() {
      const ts = await getTournaments();
      setTournaments(ts);
      const active = ts.find(t => t.isActive);
      setSelectedTournament(active ?? ts[0] ?? null);
    }
    init();
  }, []);

  useEffect(() => {
    if (!selectedTournament) return;
    async function fetchTeams() {
      setTeams(await getTeams(selectedTournament!.id));
      setAgeGroups(await getAgeGroups(selectedTournament!.id));
    }
    fetchTeams();
  }, [selectedTournament]);

  const filtered = activeGroup === 'all' ? teams : teams.filter(t => t.ageGroupId === activeGroup);
  const getGroupName = (id: string) => ageGroups.find(g => g.id === id)?.name ?? '—';

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
            onSelect={t => { setSelectedTournament(t); setActiveGroup('all'); }}
          />

          <div className="tabs" style={{ marginBottom: '1.5rem' }}>
            <button className={`tab-btn ${activeGroup === 'all' ? 'active' : ''}`}
              onClick={() => setActiveGroup('all')} id="teams-tab-all">All</button>
            {ageGroups.map(g => (
              <button key={g.id}
                className={`tab-btn ${activeGroup === g.id ? 'active' : ''}`}
                onClick={() => setActiveGroup(g.id)}
                id={`teams-tab-${g.name}`}>{g.name}</button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <Users size={48} />
              <p>No teams registered yet.</p>
            </div>
          ) : (
            <div className={styles.teamGrid}>
              {filtered.map(team => (
                <div key={team.id} className={`card ${styles.teamCard}`}>
                  <div className={styles.teamHeader}>
                    <div className={styles.teamAvatar}>
                      {team.name.charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.teamInfo}>
                      <h3 className={styles.teamName}>{team.name}</h3>
                      <div className={styles.teamMeta}>
                        <span className="badge badge-purple">{getGroupName(team.ageGroupId)}</span>
                        {team.coach && <span className={styles.coach}>Coach: {team.coach}</span>}
                      </div>
                    </div>
                  </div>


                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
