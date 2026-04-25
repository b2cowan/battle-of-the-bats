'use client';
import { useState, useMemo } from 'react';
import { Sparkles, Calendar, Clock, MapPin, Check, X, RefreshCw, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Team, AgeGroup, Diamond, Game, Tournament } from '@/lib/types';
import { saveGame } from '@/lib/db';
import styles from './schedule-admin.module.css';

interface DateSlot {
  date: string;
  startTime: string;
  endTime: string;
}

interface GeneratorProps {
  tournament: Tournament;
  ageGroups: AgeGroup[];
  teams: Team[];
  diamonds: Diamond[];
  onComplete: () => void;
  onCancel: () => void;
}

export default function ScheduleGenerator({ tournament, ageGroups, teams, diamonds, onComplete, onCancel }: GeneratorProps) {
  const [selectedGroupId, setSelectedGroupId] = useState(ageGroups[0]?.id || '');
  const [gameLength, setGameLength] = useState(90); // minutes
  const [breakLength, setBreakLength] = useState(15); // minutes
  const [gamesPerTeam, setGamesPerTeam] = useState(3);
  const [selectedDiamonds, setSelectedDiamonds] = useState<Set<string>>(new Set(diamonds.map(d => d.id)));
  
  const [dateSlots, setDateSlots] = useState<DateSlot[]>([
    { date: tournament.startDate || '', startTime: '09:00', endTime: '20:30' }
  ]);

  const [generatedGames, setGeneratedGames] = useState<Omit<Game, 'id'>[]>([]);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableDates = useMemo(() => {
    if (!tournament.startDate || !tournament.endDate) return [];
    const start = new Date(tournament.startDate + 'T12:00:00');
    const end = new Date(tournament.endDate + 'T12:00:00');
    const dates = [];
    let curr = new Date(start);
    while (curr <= end) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  }, [tournament.startDate, tournament.endDate]);

  function addDateSlot() {
    let nextDate = '';
    if (availableDates.length > 0) {
      nextDate = availableDates.find(d => !dateSlots.some(s => s.date === d)) || availableDates[0];
    }
    setDateSlots([...dateSlots, { date: nextDate, startTime: '09:00', endTime: '20:30' }]);
  }

  function removeDateSlot(idx: number) {
    if (dateSlots.length <= 1) return;
    setDateSlots(dateSlots.filter((_, i) => i !== idx));
  }

  function updateDateSlot(idx: number, updates: Partial<DateSlot>) {
    const next = [...dateSlots];
    next[idx] = { ...next[idx], ...updates };
    setDateSlots(next);
  }

  function generate() {
    setError(null);
    if (dateSlots.some(s => !s.date)) { setError('Please select a date for all slots'); return; }
    
    const groupTeams = teams.filter(t => t.ageGroupId === selectedGroupId);
    if (groupTeams.length < 2) { setError('Need at least 2 teams to generate a schedule'); return; }
    
    const diamondList = diamonds.filter(d => selectedDiamonds.has(d.id));
    if (diamondList.length === 0) { setError('Select at least one diamond'); return; }

    // 1. Group teams by pool
    const pools: Record<string, Team[]> = {};
    groupTeams.forEach(t => {
      const p = t.pool || 'Default';
      if (!pools[p]) pools[p] = [];
      pools[p].push(t);
    });

    const allMatchups: { home: Team, away: Team }[] = [];

    // 2. Generate Round Robin Matchups for each pool
    Object.values(pools).forEach(poolTeams => {
      if (poolTeams.length < 2) return;

      const teamsPool = [...poolTeams];
      if (teamsPool.length % 2 !== 0) {
        teamsPool.push({ id: 'BYE', name: 'BYE' } as any);
      }
      
      const n = teamsPool.length;
      const totalRounds = n - 1;
      const roundsToGenerate = Math.min(gamesPerTeam, totalRounds);
      const gamesPerRound = n / 2;

      for (let round = 0; round < roundsToGenerate; round++) {
        for (let i = 0; i < gamesPerRound; i++) {
          const home = teamsPool[i];
          const away = teamsPool[n - 1 - i];
          if (home.id !== 'BYE' && away.id !== 'BYE') {
            allMatchups.push({ home, away });
          }
        }
        // Rotate
        teamsPool.splice(1, 0, teamsPool.pop()!);
      }
    });

    if (allMatchups.length === 0) {
      setError('No matchups could be generated. Check your pool assignments.');
      return;
    }

    // 3. Generate Available Time Slots
    const totalSlots: { date: string, time: string, diamond: Diamond }[] = [];
    const sortedDates = [...dateSlots].sort((a, b) => a.date.localeCompare(b.date));

    sortedDates.forEach(slot => {
      let current = new Date(`${slot.date}T${slot.startTime}`);
      const end = new Date(`${slot.date}T${slot.endTime}`);
      while (current.getTime() + (gameLength * 60000) <= end.getTime()) {
        const timeStr = current.toTimeString().slice(0, 5);
        diamondList.forEach(diamond => {
          totalSlots.push({ date: slot.date, time: timeStr, diamond });
        });
        current = new Date(current.getTime() + (gameLength + breakLength) * 60000);
      }
    });

    if (totalSlots.length < allMatchups.length) {
      setError(`Not enough time slots to schedule ${allMatchups.length} games. Need ${allMatchups.length} slots, but only have ${totalSlots.length} available.`);
      return;
    }

    // 4. Assign Matchups to Slots
    const newGames: Omit<Game, 'id'>[] = allMatchups.map((match, idx) => {
      const slot = totalSlots[idx];
      return {
        tournamentId: tournament.id,
        ageGroupId: selectedGroupId,
        homeTeamId: match.home.id,
        awayTeamId: match.away.id,
        date: slot.date,
        time: slot.time,
        location: slot.diamond.name,
        diamondId: slot.diamond.id,
        status: 'scheduled'
      };
    });

    setGeneratedGames(newGames);
  }

  async function commit() {
    setCommitting(true);
    try {
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
            <div className="form-row form-row-2" style={{ marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label">Division</label>
                <select className="form-select" value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)}>
                  {ageGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Games per Team</label>
                <input 
                  type="number" 
                  className="form-input" 
                  min="1" 
                  max="10" 
                  value={gamesPerTeam} 
                  onChange={e => setGamesPerTeam(Number(e.target.value))} 
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Available Scheduling Dates
                <button type="button" className="btn btn-ghost btn-sm" onClick={addDateSlot} style={{ color: 'var(--purple-light)' }}>
                  <Plus size={14} /> Add Date
                </button>
              </label>
              
              <div className={styles.dateSlotList}>
                {dateSlots.map((slot, idx) => (
                  <div key={idx} className={styles.dateSlotRow}>
                    <div className="form-group" style={{ flex: 2 }}>
                      <select 
                        className="form-select" 
                        value={slot.date} 
                        onChange={e => updateDateSlot(idx, { date: e.target.value })}
                      >
                        <option value="">Select Date...</option>
                        {availableDates.map(d => (
                          <option key={d} value={d}>{new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <input type="time" className="form-input" value={slot.startTime} onChange={e => updateDateSlot(idx, { startTime: e.target.value })} />
                    </div>
                    <div style={{ alignSelf: 'center', color: 'var(--white-20)' }}>to</div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <input type="time" className="form-input" value={slot.endTime} onChange={e => updateDateSlot(idx, { endTime: e.target.value })} />
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeDateSlot(idx)} disabled={dateSlots.length === 1}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-row form-row-2" style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Game Duration (min)</label>
                <input type="number" className="form-input" value={gameLength} onChange={e => setGameLength(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">Turnover Time (min)</label>
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
                  <tr><th>Date & Time</th><th>Matchup</th><th>Pool</th><th>Diamond</th></tr>
                </thead>
                <tbody>
                  {generatedGames.map((g, i) => {
                    const homeTeam = teams.find(t => t.id === g.homeTeamId);
                    const awayTeam = teams.find(t => t.id === g.awayTeamId);
                    return (
                      <tr key={i}>
                        <td style={{ fontSize: '0.8rem' }}>
                          {new Date(g.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at <strong>{g.time}</strong>
                        </td>
                        <td>{homeTeam?.name} vs {awayTeam?.name}</td>
                        <td><span className="badge badge-neutral">{homeTeam?.pool || 'Default'}</span></td>
                        <td>{g.location}</td>
                      </tr>
                    );
                  })}
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
