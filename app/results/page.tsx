'use client';
import { useState, useEffect } from 'react';
import { Trophy, Filter } from 'lucide-react';
import { getGames, getTeams, getAgeGroups, getDiamonds, getTournaments } from '@/lib/db';
import { Game, Team, AgeGroup, Diamond, Tournament } from '@/lib/types';
import LocationLink from '@/components/LocationLink';
import YearSelector from '@/components/YearSelector';
import styles from './results.module.css';

export default function ResultsPage() {
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
    }
    init();
  }, []);

  useEffect(() => {
    if (!selectedTournament) return;
    async function fetchResults() {
      setGames(await getGames(selectedTournament!.id));
      setTeams(await getTeams(selectedTournament!.id));
      setAgeGroups(await getAgeGroups(selectedTournament!.id));
      setDiamonds(await getDiamonds(selectedTournament!.id));
    }
    fetchResults();
  }, [selectedTournament]);

  const getTeamName = (id: string) => teams.find(t => t.id === id)?.name ?? 'TBD';
  const getDiamond  = (id?: string): Diamond | null => id ? diamonds.find(d => d.id === id) ?? null : null;

  const completed = games.filter(g => g.status === 'completed');
  const filtered  = activeGroup === 'all' ? completed : completed.filter(g => g.ageGroupId === activeGroup);

  function formatDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function getWinner(game: Game): 'home' | 'away' | 'tie' | null {
    if (game.homeScore === undefined || game.awayScore === undefined) return null;
    if (game.homeScore > game.awayScore) return 'home';
    if (game.awayScore > game.homeScore) return 'away';
    return 'tie';
  }

  return (
    <div className="page-content">
      <div className={styles.pageHeader}>
        <div className="container">
          <span className="eyebrow"><Trophy size={12} /> Results</span>
          <h1 className="display-lg">Game Results</h1>
          <p className="text-muted">Completed game scores by age group.</p>
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
            <div className="tabs" style={{ flex: 1 }}>
              <button className={`tab-btn ${activeGroup === 'all' ? 'active' : ''}`}
                onClick={() => setActiveGroup('all')} id="results-tab-all">All Groups</button>
              {ageGroups.map(g => (
                <button key={g.id}
                  className={`tab-btn ${activeGroup === g.id ? 'active' : ''}`}
                  onClick={() => setActiveGroup(g.id)}
                  id={`results-tab-${g.name}`}>{g.name}</button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <Trophy size={48} />
              <p>No results posted yet.</p>
            </div>
          ) : (
            <div className={styles.resultsList}>
              {filtered.map(game => {
                const winner = getWinner(game);
                return (
                  <div key={game.id} className={`card ${styles.resultCard}`}>
                    <div className={styles.resultMeta}>
                      <span className="badge badge-success">Final</span>
                      <span className={styles.resultDate}>{formatDate(game.date)}</span>
                      <span className="badge badge-purple">
                        {ageGroups.find(g => g.id === game.ageGroupId)?.name}
                      </span>
                      <LocationLink location={game.location} diamond={getDiamond(game.diamondId)} size="sm" />
                    </div>
                    <div className={styles.scoreRow}>
                      <div className={`${styles.teamScore} ${winner === 'home' ? styles.winner : ''}`}>
                        <span className={styles.scoreName}>{getTeamName(game.homeTeamId)}</span>
                        <span className={styles.score}>{game.homeScore ?? '—'}</span>
                        {winner === 'home' && <Trophy size={14} className={styles.winIcon} />}
                      </div>
                      <div className={styles.scoreDash}>—</div>
                      <div className={`${styles.teamScore} ${styles.away} ${winner === 'away' ? styles.winner : ''}`}>
                        {winner === 'away' && <Trophy size={14} className={styles.winIcon} />}
                        <span className={styles.score}>{game.awayScore ?? '—'}</span>
                        <span className={styles.scoreName}>{getTeamName(game.awayTeamId)}</span>
                      </div>
                    </div>
                    {winner === 'tie' && <div className={styles.tieLabel}>TIE GAME</div>}
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
