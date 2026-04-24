'use client';
import { useState, useEffect } from 'react';
import { Calendar, Clock, Filter } from 'lucide-react';
import { getGames, getTeams, getAgeGroups, getDiamonds, getTournaments } from '@/lib/db';
import { Game, Team, AgeGroup, Diamond, Tournament } from '@/lib/types';
import LocationLink from '@/components/LocationLink';
import YearSelector from '@/components/YearSelector';
import styles from './schedule.module.css';

export default function SchedulePage() {
  const [games, setGames]         = useState<Game[]>([]);
  const [teams, setTeams]         = useState<Team[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [diamonds, setDiamonds]   = useState<Diamond[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [activeGroup, setActiveGroup] = useState<string>('all');

  useEffect(() => {
    async function init() {
      const ts = await getTournaments();
      setTournaments(ts);
      const active = ts.find(t => t.isActive);
      setSelectedTournament(active ?? ts[0] ?? null);
      setAgeGroups(await getAgeGroups());
      setDiamonds(await getDiamonds());
    }
    init();
  }, []);

  useEffect(() => {
    if (!selectedTournament) return;
    async function fetchGames() {
      setGames(await getGames(selectedTournament!.id));
      setTeams(await getTeams(selectedTournament!.id));
    }
    fetchGames();
  }, [selectedTournament]);

  const getTeamName = (id: string) => teams.find(t => t.id === id)?.name ?? 'TBD';
  const getDiamond  = (id?: string) => id ? diamonds.find(d => d.id === id) ?? null : null;

  const filtered = activeGroup === 'all'
    ? games.filter(g => g.status === 'scheduled')
    : games.filter(g => g.ageGroupId === activeGroup && g.status === 'scheduled');

  function formatDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-CA', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  const byDate: Record<string, Game[]> = {};
  filtered.forEach(g => {
    if (!byDate[g.date]) byDate[g.date] = [];
    byDate[g.date].push(g);
  });
  const sortedDates = Object.keys(byDate).sort();

  return (
    <div className="page-content">
      <div className={styles.pageHeader}>
        <div className="container">
          <span className="eyebrow"><Calendar size={12} /> Schedule</span>
          <h1 className="display-lg">Tournament Schedule</h1>
          <p className="text-muted">View upcoming games by age group. All times are local.</p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          <YearSelector
            tournaments={tournaments}
            selected={selectedTournament}
            onSelect={t => { setSelectedTournament(t); setActiveGroup('all'); }}
          />

          <div className="flex gap-2 mb-2" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <Filter size={16} style={{ color: 'var(--purple-light)' }} />
            <div className="tabs" style={{ flex: 1, minWidth: 200 }}>
              <button className={`tab-btn ${activeGroup === 'all' ? 'active' : ''}`}
                onClick={() => setActiveGroup('all')} id="schedule-tab-all">All Groups</button>
              {ageGroups.map(g => (
                <button key={g.id}
                  className={`tab-btn ${activeGroup === g.id ? 'active' : ''}`}
                  onClick={() => setActiveGroup(g.id)}
                  id={`schedule-tab-${g.name}`}>{g.name}</button>
              ))}
            </div>
          </div>

          {sortedDates.length === 0 ? (
            <div className="empty-state">
              <Calendar size={48} />
              <p>No scheduled games found. Check back soon!</p>
            </div>
          ) : (
            sortedDates.map(date => (
              <div key={date} className={styles.dateGroup}>
                <div className={styles.dateLabel}>
                  <Calendar size={14} />
                  {formatDate(date)}
                </div>
                <div className={styles.gamesList}>
                  {byDate[date].map(game => (
                    <div key={game.id} className={`card ${styles.gameRow}`}>
                      <div className={styles.gameTime}>
                        <Clock size={13} />
                        {game.time}
                      </div>
                      <div className={styles.teams}>
                        <span className={styles.teamA}>{getTeamName(game.homeTeamId)}</span>
                        <span className={styles.vsChip}>VS</span>
                        <span className={styles.teamB}>{getTeamName(game.awayTeamId)}</span>
                      </div>
                      <div className={styles.gameMeta}>
                        <span className="badge badge-purple">
                          {ageGroups.find(g => g.id === game.ageGroupId)?.name ?? ''}
                        </span>
                        <LocationLink location={game.location} diamond={getDiamond(game.diamondId)} size="sm" />
                      </div>
                      {game.notes && <p className={styles.gameNotes}>{game.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
