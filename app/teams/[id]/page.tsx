'use client';
import { useState, useEffect } from 'react';
import { use } from 'react';
import { Users, CheckCircle, Clock, CreditCard, AlertTriangle, Mail, MapPin } from 'lucide-react';
import { formatTime } from '@/lib/utils';
import styles from './team-profile.module.css';

interface TeamProfile {
  id: string;
  team_name: string;
  coach_name: string;
  email: string;
  age_group_name: string;
  tournament_name: string;
  status: 'pending' | 'accepted' | 'rejected' | 'waitlist';
  payment_status: 'pending' | 'paid';
  pool: string;
}

interface Game {
  id: string;
  home_team_name: string;
  away_team_name: string;
  home_score: number | null;
  away_score: number | null;
  date: string;
  time: string;
  location: string;
  status: string;
}

export default function TeamProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [team, setTeam]       = useState<TeamProfile | null>(null);
  const [games, setGames]   = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [rRes, gRes] = await Promise.all([
          fetch(`/api/registrations/${id}`),
          fetch(`/api/public/stats?teamId=${id}`)
        ]);
        
        if (!rRes.ok) throw new Error('Not found');
        
        const rData = await rRes.json();
        const gData = await gRes.json();
        
        setTeam(rData);
        setGames(gData.games || []);
      } catch (e: any) {
        setError('Team not found.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return (
    <div className="page-content">
      <div className="section"><div className="container">
        <div className="empty-state"><Users size={40} /><p>Loading…</p></div>
      </div></div>
    </div>
  );

  if (error || !team) return (
    <div className="page-content">
      <div className="section"><div className="container">
        <div className="empty-state"><AlertTriangle size={40} /><p>{error || 'Team not found.'}</p></div>
      </div></div>
    </div>
  );

  const stats = games.reduce((acc, g) => {
    if (g.home_score === null || g.away_score === null) return acc;
    const isHome = g.home_team_name === team.team_name;
    const myScore = isHome ? g.home_score : g.away_score;
    const oppScore = isHome ? g.away_score : g.home_score;
    
    if (myScore > oppScore) acc.w++;
    else if (myScore < oppScore) acc.l++;
    else acc.t++;
    
    acc.ra += oppScore;
    return acc;
  }, { w: 0, l: 0, t: 0, ra: 0 });

  return (
    <div className="page-content">
      <div className={styles.pageHeader}>
        <div className="container">
          <div className="flex items-center gap-2 mb-4">
            <span className="badge badge-purple">{team.age_group_name}</span>
            {team.pool && <span className="badge">Pool {team.pool}</span>}
          </div>
          <h1 className="display-lg">{team.team_name}</h1>
          <p className="text-muted">{team.tournament_name}</p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          <div className={styles.profileLayout}>
            
            {/* Stats Sidebar */}
            <div className={styles.statsSidebar}>
              <div className={`card ${styles.statsCard}`}>
                <h3 className={styles.cardTitle}>Record</h3>
                <div className={styles.recordDisplay}>
                  <div className={styles.recordMain}>{stats.w}-{stats.l}-{stats.t}</div>
                  <div className={styles.recordSub}>{stats.ra} Runs Allowed</div>
                </div>
              </div>

              <div className={`card ${styles.infoCard}`}>
                <h3 className={styles.cardTitle}>Information</h3>
                <div className={styles.infoList}>
                  <div className={styles.infoItem}>
                    <label>Coach</label>
                    <strong>{team.coach_name}</strong>
                  </div>
                  <div className={styles.infoItem}>
                    <label>Division</label>
                    <strong>{team.age_group_name}</strong>
                  </div>
                  {team.pool && (
                    <div className={styles.infoItem}>
                      <label>Pool</label>
                      <strong>{team.pool}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Schedule & Results */}
            <div className={styles.mainContent}>
              <div className={`card ${styles.scheduleCard}`}>
                <h3 className={styles.cardTitle}>Schedule & Results</h3>
                {games.length === 0 ? (
                  <div className={styles.emptyGames}>
                    <Clock size={32} style={{ opacity: 0.3 }} />
                    <p>No games scheduled yet.</p>
                  </div>
                ) : (
                  <div className={styles.gameList}>
                    {games.map(g => {
                      const isHome = g.home_team_name === team.team_name;
                      const opponent = isHome ? g.away_team_name : g.home_team_name;
                      const hasResult = g.home_score !== null;
                      const myScore = isHome ? g.home_score : g.away_score;
                      const oppScore = isHome ? g.away_score : g.home_score;
                      const won = hasResult && myScore! > oppScore!;
                      const lost = hasResult && myScore! < oppScore!;
                      const tied = hasResult && myScore! === oppScore!;

                      return (
                        <div key={g.id} className={styles.gameRow}>
                          <div className={styles.gameDate}>
                            <strong>{new Date(g.date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</strong>
                            <span>{formatTime(g.time)}</span>
                          </div>
                          
                          <div className={styles.gameMatchup}>
                            <div className={styles.opponentWrap}>
                              <span className={styles.vs}>{isHome ? 'vs' : 'at'}</span>
                              <span className={styles.opponentName}>{opponent}</span>
                            </div>
                            <div className={styles.location}>
                              <MapPin size={12} /> {g.location}
                            </div>
                          </div>

                          <div className={styles.gameResult}>
                            {hasResult ? (
                              <div className={styles.resultBadge}>
                                <span className={won ? styles.resW : lost ? styles.resL : styles.resT}>
                                  {won ? 'W' : lost ? 'L' : 'T'}
                                </span>
                                <strong>{myScore} - {oppScore}</strong>
                              </div>
                            ) : (
                              <span className={styles.upcomingBadge}>Upcoming</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
