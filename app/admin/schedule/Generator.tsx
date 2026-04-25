'use client';
import { useState } from 'react';
import { Sparkles, Calendar, Clock, MapPin, Check, X, RefreshCw, AlertCircle } from 'lucide-react';
import { Team, AgeGroup, Diamond, Game } from '@/lib/types';
import { saveGame } from '@/lib/db';
import styles from './schedule-admin.module.css';

interface GeneratorProps {
  tournamentId: string;
  ageGroups: AgeGroup[];
  teams: Team[];
  diamonds: Diamond[];
  onComplete: () => void;
  onCancel: () => void;
}

export default function ScheduleGenerator({ tournamentId, ageGroups, teams, diamonds, onComplete, onCancel }: GeneratorProps) {
  const [selectedGroupId, setSelectedGroupId] = useState(ageGroups[0]?.id || '');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [gameLength, setGameLength] = useState(90); // minutes
  const [breakLength, setBreakLength] = useState(15); // minutes
  const [selectedDiamonds, setSelectedDiamonds] = useState<Set<string>>(new Set(diamonds.map(d => d.id)));
  
  const [generatedGames, setGeneratedGames] = useState<Omit<Game, 'id'>[]>([]);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setError(null);
    if (!startDate) { setError('Please select a start date'); return; }
    
    const groupTeams = teams.filter(t => t.ageGroupId === selectedGroupId);
    if (groupTeams.length < 2) { setError('Need at least 2 teams to generate a schedule'); return; }
    
    const diamondList = diamonds.filter(d => selectedDiamonds.has(d.id));
    if (diamondList.length === 0) { setError('Select at least one diamond'); return; }

    // Round Robin Logic
    // For n teams, there are n-1 rounds (if n is even) or n rounds (if n is odd)
    const teamsPool = [...groupTeams];
    if (teamsPool.length % 2 !== 0) {
      teamsPool.push({ id: 'BYE', name: 'BYE' } as any);
    }
    
    const n = teamsPool.length;
    const rounds = n - 1;
    const gamesPerRound = n / 2;
    const matchups: { home: Team, away: Team }[] = [];

    // Circle Method for Round Robin
    for (let round = 0; round < rounds; round++) {
      for (let i = 0; i < gamesPerRound; i++) {
        const home = teamsPool[i];
        const away = teamsPool[n - 1 - i];
        if (home.id !== 'BYE' && away.id !== 'BYE') {
          matchups.push({ home, away });
        }
      }
      // Rotate teams (keep index 0 fixed)
      teamsPool.splice(1, 0, teamsPool.pop()!);
    }

    // Assign to time slots and diamonds
    const newGames: Omit<Game, 'id'>[] = [];
    let currentSlotStart = new Date(`${startDate}T${startTime}`);
    let gamesInCurrentSlot = 0;
    
    matchups.forEach((match, idx) => {
      const diamondIdx = gamesInCurrentSlot % diamondList.length;
      const diamond = diamondList[diamondIdx];
      
      const timeStr = currentSlotStart.toTimeString().slice(0, 5);
      
      newGames.push({
        tournamentId,
        ageGroupId: selectedGroupId,
        homeTeamId: match.home.id,
        awayTeamId: match.away.id,
        date: startDate,
        time: timeStr,
        location: diamond.name,
        diamondId: diamond.id,
        status: 'scheduled'
      });

      gamesInCurrentSlot++;
      
      // If we've used all diamonds, move to next time slot
      if (gamesInCurrentSlot >= diamondList.length) {
        gamesInCurrentSlot = 0;
        currentSlotStart = new Date(currentSlotStart.getTime() + (gameLength + breakLength) * 60000);
      }
    });

    setGeneratedGames(newGames);
  }

  async function commit() {
    setCommitting(true);
    try {
      // Save games sequentially to avoid Supabase burst limits
      for (const g of generatedGames) {
        await saveGame(g);
      }
      onComplete();
    } catch (e: any) {
      setError(`Failed to save games: ${e.message}`);
    } finally {
      setCommitting(false);
    }
  }

  function toggleDiamond(id: string) {
    const next = new Set(selectedDiamonds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDiamonds(next);
  }

  return (
    <div className={styles.generatorOverlay}>
      <div className={styles.generatorModal}>
        <div className={styles.generatorHeader}>
          <h3><Sparkles size={18} /> Schedule Generator</h3>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}><X size={18} /></button>
        </div>

        {generatedGames.length === 0 ? (
          <div className={styles.generatorForm}>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Division</label>
                <select className="form-select" value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)}>
                  {ageGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
            </div>

            <div className="form-row form-row-3">
              <div className="form-group">
                <label className="form-label">First Game Time</label>
                <input type="time" className="form-input" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Game Duration (min)</label>
                <input type="number" className="form-input" value={gameLength} onChange={e => setGameLength(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">Turnover (min)</label>
                <input type="number" className="form-input" value={breakLength} onChange={e => setBreakLength(Number(e.target.value))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Available Diamonds</label>
              <div className={styles.diamondGrid}>
                {diamonds.map(d => (
                  <label key={d.id} className={styles.diamondCheck}>
                    <input type="checkbox" checked={selectedDiamonds.has(d.id)} onChange={() => toggleDiamond(d.id)} />
                    {d.name}
                  </label>
                ))}
              </div>
            </div>

            {error && <div className={styles.errorBanner}><AlertCircle size={16} /> {error}</div>}

            <button className="btn btn-primary btn-lg" onClick={generate} style={{ width: '100%', marginTop: '1rem' }}>
              Generate Round Robin Draft
            </button>
          </div>
        ) : (
          <div className={styles.generatorPreview}>
            <div className={styles.previewStats}>
              <span>Generated <strong>{generatedGames.length}</strong> games for <strong>{ageGroups.find(g => g.id === selectedGroupId)?.name}</strong></span>
              <button className="btn btn-ghost btn-sm" onClick={() => setGeneratedGames([])}><RefreshCw size={14} /> Start Over</button>
            </div>
            
            <div className={styles.previewTableWrap}>
              <table>
                <thead>
                  <tr><th>Time</th><th>Matchup</th><th>Diamond</th></tr>
                </thead>
                <tbody>
                  {generatedGames.map((g, i) => (
                    <tr key={i}>
                      <td>{g.time}</td>
                      <td>{teams.find(t => t.id === g.homeTeamId)?.name} vs {teams.find(t => t.id === g.awayTeamId)?.name}</td>
                      <td>{g.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && <div className={styles.errorBanner}><AlertCircle size={16} /> {error}</div>}

            <div className={styles.previewFooter}>
              <button className="btn btn-ghost" onClick={() => setGeneratedGames([])} disabled={committing}>Cancel</button>
              <button className="btn btn-primary" onClick={commit} disabled={committing}>
                {committing ? <><RefreshCw className="spin" size={14} /> Saving Games…</> : <><Check size={14} /> Commit Schedule</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
