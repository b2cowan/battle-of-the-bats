'use client';
import { useState, useMemo } from 'react';
import { Sparkles, Check, X, RefreshCw, AlertCircle, Plus, Trash2, Info } from 'lucide-react';
import { Team, AgeGroup, Diamond, Game, Tournament } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import styles from './schedule-admin.module.css';

interface DateSlot {
  date: string;
  startTime: string;
  endTime: string;
}

// Extends Game with slot metadata so commit() can resolve real slot IDs after ensure
interface SlotGame extends Omit<Game, 'id'> {
  homePoolId: string;
  homeSlotNumber: number;
  awayPoolId: string;
  awaySlotNumber: number;
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
  const [gameLength, setGameLength] = useState(90);
  const [breakLength, setBreakLength] = useState(15);
  const [gamesPerTeam, setGamesPerTeam] = useState(3);
  const [selectedDiamonds, setSelectedDiamonds] = useState<Set<string>>(new Set(diamonds.map(d => d.id)));
  const [dateSlots, setDateSlots] = useState<DateSlot[]>([
    { date: tournament.startDate || '', startTime: '09:00', endTime: '20:30' }
  ]);

  const [generationMode, setGenerationMode] = useState<'team' | 'slot'>('team');
  const [slotCountOverride, setSlotCountOverride] = useState<Record<string, number>>({});

  const [generatedGames, setGeneratedGames] = useState<Omit<Game, 'id'>[]>([]);
  const [generatedSlotGames, setGeneratedSlotGames] = useState<SlotGame[]>([]);
  const [committing, setCommitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPreview = generatedGames.length > 0 || generatedSlotGames.length > 0;
  const previewCount = generatedGames.length || generatedSlotGames.length;

  const availableDates = useMemo(() => {
    if (!tournament.startDate || !tournament.endDate) return [];
    const start = new Date(tournament.startDate + 'T12:00:00');
    const end = new Date(tournament.endDate + 'T12:00:00');
    const dates = [];
    const curr = new Date(start);
    while (curr <= end) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  }, [tournament.startDate, tournament.endDate]);

  const currentGroup = useMemo(() => ageGroups.find(g => g.id === selectedGroupId), [ageGroups, selectedGroupId]);
  const poolList = useMemo(() => (currentGroup?.pools?.length || 0) >= 1 ? currentGroup!.pools! : [], [currentGroup]);

  function defaultSlotCount(poolId: string): number {
    if (slotCountOverride[poolId] !== undefined) return slotCountOverride[poolId];
    const cap = currentGroup?.capacity || 0;
    const count = poolList.length || 1;
    return Math.floor(cap / count) || 4;
  }

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

  function buildTimeSlots(diamondList: Diamond[]) {
    const totalSlots: { date: string; time: string; diamond: Diamond }[] = [];
    const sortedDates = [...dateSlots].sort((a, b) => a.date.localeCompare(b.date));
    const roundTo5 = (d: Date) => { const ms = 1000 * 60 * 5; return new Date(Math.ceil(d.getTime() / ms) * ms); };

    sortedDates.forEach(slot => {
      let current = roundTo5(new Date(`${slot.date}T${slot.startTime}`));
      const end = new Date(`${slot.date}T${slot.endTime}`);
      while (current.getTime() + gameLength * 60000 <= end.getTime()) {
        const timeStr = current.toTimeString().slice(0, 5);
        diamondList.forEach(diamond => totalSlots.push({ date: slot.date, time: timeStr, diamond }));
        current = roundTo5(new Date(current.getTime() + (gameLength + breakLength) * 60000));
      }
    });
    return totalSlots;
  }

  function generate() {
    setError(null);
    if (dateSlots.some(s => !s.date)) { setError('Please select a date for all slots'); return; }
    const diamondList = diamonds.filter(d => selectedDiamonds.has(d.id));
    if (diamondList.length === 0) { setError('Select at least one diamond'); return; }

    if (generationMode === 'slot') {
      generateSlots(diamondList);
    } else {
      generateTeams(diamondList);
    }
  }

  function generateTeams(diamondList: Diamond[]) {
    const groupTeams = teams.filter(t => t.ageGroupId === selectedGroupId);
    if (groupTeams.length < 2) { setError('Need at least 2 teams to generate a schedule'); return; }

    const pools: Record<string, Team[]> = {};
    const usePools = (currentGroup?.poolCount || 0) >= 2;
    groupTeams.forEach(t => {
      const poolRecord = usePools ? currentGroup?.pools?.find(p => p.id === t.poolId) : null;
      const poolKey = poolRecord ? poolRecord.id : 'Default';
      if (!pools[poolKey]) pools[poolKey] = [];
      pools[poolKey].push(t);
    });

    const allMatchups: { home: Team; away: Team }[] = [];
    Object.values(pools).forEach(poolTeams => {
      if (poolTeams.length < 2) return;
      const teamsPool = [...poolTeams];
      if (teamsPool.length % 2 !== 0) teamsPool.push({ id: 'BYE', name: 'BYE' } as any);
      const n = teamsPool.length;
      const roundsToGenerate = Math.min(gamesPerTeam, n - 1);
      for (let round = 0; round < roundsToGenerate; round++) {
        for (let i = 0; i < n / 2; i++) {
          const home = teamsPool[i];
          const away = teamsPool[n - 1 - i];
          if (home.id !== 'BYE' && away.id !== 'BYE') allMatchups.push({ home, away });
        }
        teamsPool.splice(1, 0, teamsPool.pop()!);
      }
    });

    if (allMatchups.length === 0) { setError('No matchups could be generated. Check your pool assignments.'); return; }

    const totalSlots = buildTimeSlots(diamondList);
    if (totalSlots.length < allMatchups.length) {
      setError(`Not enough time slots to schedule ${allMatchups.length} games. Need ${allMatchups.length} slots, but only have ${totalSlots.length} available.`);
      return;
    }

    const newGames: Omit<Game, 'id'>[] = [];
    const busyTeams: Record<string, Set<string>> = {};
    const availableSlots = [...totalSlots];

    for (const match of allMatchups) {
      let assigned = false;
      for (let i = 0; i < availableSlots.length; i++) {
        const slot = availableSlots[i];
        const timeKey = `${slot.date}T${slot.time}`;
        if (!busyTeams[timeKey]) busyTeams[timeKey] = new Set();
        if (!busyTeams[timeKey].has(match.home.id) && !busyTeams[timeKey].has(match.away.id)) {
          newGames.push({
            tournamentId: tournament.id,
            ageGroupId: selectedGroupId,
            homeTeamId: match.home.id,
            awayTeamId: match.away.id,
            date: slot.date,
            time: slot.time,
            location: slot.diamond.name,
            diamondId: slot.diamond.id,
            status: 'scheduled',
          });
          busyTeams[timeKey].add(match.home.id);
          busyTeams[timeKey].add(match.away.id);
          availableSlots.splice(i, 1);
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        setError(`Conflict detected: Could not find a free time slot for ${match.home.name} vs ${match.away.name} without double-booking a team. Try adding more dates or diamonds.`);
        return;
      }
    }

    setGeneratedSlotGames([]);
    setGeneratedGames(newGames);
  }

  function generateSlots(diamondList: Diamond[]) {
    if (poolList.length === 0) {
      setError('Slot-based scheduling requires at least one pool to be configured. Go to Division Settings and add pools first.');
      return;
    }

    const allMatchups: { homePoolId: string; homeSlotNum: number; awayPoolId: string; awaySlotNum: number }[] = [];

    poolList.forEach(pool => {
      const count = defaultSlotCount(pool.id);
      if (count < 2) return;
      const nums = Array.from({ length: count }, (_, i) => i + 1);
      if (nums.length % 2 !== 0) nums.push(0); // 0 = BYE
      const n = nums.length;
      const roundsToGenerate = Math.min(gamesPerTeam, n - 1);
      const rotation = [...nums];
      for (let round = 0; round < roundsToGenerate; round++) {
        for (let i = 0; i < n / 2; i++) {
          const home = rotation[i];
          const away = rotation[n - 1 - i];
          if (home !== 0 && away !== 0) allMatchups.push({ homePoolId: pool.id, homeSlotNum: home, awayPoolId: pool.id, awaySlotNum: away });
        }
        rotation.splice(1, 0, rotation.pop()!);
      }
    });

    if (allMatchups.length === 0) { setError('No matchups could be generated. Check slot counts per pool (minimum 2).'); return; }

    const totalSlots = buildTimeSlots(diamondList);
    if (totalSlots.length < allMatchups.length) {
      setError(`Not enough time slots for ${allMatchups.length} games. Need ${allMatchups.length} slots but have ${totalSlots.length}.`);
      return;
    }

    const newGames: SlotGame[] = [];
    const busy: Record<string, Set<string>> = {};
    const availableSlots = [...totalSlots];

    for (const match of allMatchups) {
      let assigned = false;
      for (let i = 0; i < availableSlots.length; i++) {
        const slot = availableSlots[i];
        const timeKey = `${slot.date}T${slot.time}`;
        if (!busy[timeKey]) busy[timeKey] = new Set();
        const homeKey = `${match.homePoolId}-${match.homeSlotNum}`;
        const awayKey = `${match.awayPoolId}-${match.awaySlotNum}`;
        if (!busy[timeKey].has(homeKey) && !busy[timeKey].has(awayKey)) {
          const homePool = poolList.find(p => p.id === match.homePoolId);
          const homeName = `${homePool?.name ?? 'Pool'} Team ${match.homeSlotNum}`;
          const awayName = `${homePool?.name ?? 'Pool'} Team ${match.awaySlotNum}`;
          newGames.push({
            tournamentId: tournament.id,
            ageGroupId: selectedGroupId,
            homeTeamId: '',
            awayTeamId: '',
            date: slot.date,
            time: slot.time,
            location: slot.diamond.name,
            diamondId: slot.diamond.id,
            status: 'scheduled',
            homePlaceholder: homeName,
            awayPlaceholder: awayName,
            homePoolId: match.homePoolId,
            homeSlotNumber: match.homeSlotNum,
            awayPoolId: match.awayPoolId,
            awaySlotNumber: match.awaySlotNum,
          });
          busy[timeKey].add(homeKey);
          busy[timeKey].add(awayKey);
          availableSlots.splice(i, 1);
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        const homePool = poolList.find(p => p.id === match.homePoolId);
        setError(`Conflict: no free slot for ${homePool?.name ?? 'Pool'} Team ${match.homeSlotNum} vs Team ${match.awaySlotNum}. Add more dates or diamonds.`);
        return;
      }
    }

    setGeneratedGames([]);
    setGeneratedSlotGames(newGames);
  }

  async function commit() {
    setShowConfirm(false);
    if (generationMode === 'slot') {
      await commitSlots();
    } else {
      await commitTeams();
    }
  }

  async function commitTeams() {
    setCommitting(true);
    try {
      await fetch('/api/admin/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-division-games', ageGroupId: selectedGroupId }),
      });
      const res = await fetch('/api/admin/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk-save', games: generatedGames, tournamentId: tournament.id, ageGroupId: selectedGroupId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save games');
      onComplete();
    } catch (e: any) {
      setError(`Failed to save games: ${e.message}`);
    } finally {
      setCommitting(false);
    }
  }

  async function commitSlots() {
    setCommitting(true);
    try {
      // 1. Clear existing games for this division
      await fetch('/api/admin/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-division-games', ageGroupId: selectedGroupId }),
      });

      // 2. Ensure slot records exist (idempotent — slots pre-exist from pool config), get back their IDs
      const ensureRes = await fetch('/api/admin/pool-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ensure',
          tournamentId: tournament.id,
          ageGroupId: selectedGroupId,
          pools: poolList.map(pool => ({
            poolId: pool.id,
            slotCount: defaultSlotCount(pool.id),
            namePrefix: pool.name,
          })),
        }),
      });
      if (!ensureRes.ok) throw new Error((await ensureRes.json()).error || 'Failed to create slot records');
      const { slots } = await ensureRes.json();

      // 3. Build slot lookup: "poolId-slotNumber" → { id, displayName }
      const slotMap: Record<string, { id: string; displayName: string }> = {};
      (slots as any[]).forEach(s => { slotMap[`${s.poolId}-${s.slotNumber}`] = { id: s.id, displayName: s.displayName }; });

      // 4. Build game rows with resolved slot IDs
      const gameRows = generatedSlotGames.map(g => {
        const homeSlot = slotMap[`${g.homePoolId}-${g.homeSlotNumber}`];
        const awaySlot = slotMap[`${g.awayPoolId}-${g.awaySlotNumber}`];
        return {
          tournamentId: tournament.id,
          ageGroupId: selectedGroupId,
          homeTeamId: null,
          awayTeamId: null,
          date: g.date,
          time: g.time,
          location: g.location,
          diamondId: g.diamondId,
          status: 'scheduled',
          homeSlotId: homeSlot?.id ?? null,
          awaySlotId: awaySlot?.id ?? null,
          homePlaceholder: homeSlot?.displayName ?? g.homePlaceholder,
          awayPlaceholder: awaySlot?.displayName ?? g.awayPlaceholder,
        };
      });

      // 5. Bulk save
      const saveRes = await fetch('/api/admin/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk-save', games: gameRows, tournamentId: tournament.id, ageGroupId: selectedGroupId }),
      });
      if (!saveRes.ok) throw new Error((await saveRes.json()).error || 'Failed to save games');
      onComplete();
    } catch (e: any) {
      setError(`Failed to save schedule: ${e.message}`);
    } finally {
      setCommitting(false);
    }
  }

  function reset() {
    setGeneratedGames([]);
    setGeneratedSlotGames([]);
  }

  function toggleDiamond(id: string) {
    const next = new Set(selectedDiamonds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedDiamonds(next);
  }

  const divisionName = ageGroups.find(g => g.id === selectedGroupId)?.name ?? '';

  return (
    <div className={styles.generatorOverlay}>
      <div className={styles.generatorModal}>
        <div className={styles.generatorHeader}>
          <h3><Sparkles size={18} /> Schedule Generator</h3>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}><X size={18} /></button>
        </div>

        {!hasPreview ? (
          <div className={styles.generatorForm}>

            {/* Mode toggle */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Generation Mode</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${generationMode === 'team' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setGenerationMode('team')}
                >
                  Team-based
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${generationMode === 'slot' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setGenerationMode('slot')}
                >
                  Slot-based
                </button>
              </div>
              {generationMode === 'slot' && (
                <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--white-40)', lineHeight: 1.5 }}>
                  Creates a schedule using placeholder names (e.g. "Pool A Team 1"). Team names appear publicly only once all slots in a pool are assigned.
                </p>
              )}
            </div>

            <div className="form-row form-row-2" style={{ marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label">Division</label>
                <select className="form-select" value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)}>
                  {ageGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Games per {generationMode === 'slot' ? 'Slot' : 'Team'}</label>
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

            {/* Slot count per pool (slot mode only) */}
            {generationMode === 'slot' && (
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Teams per Pool</label>
                {poolList.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', background: 'var(--black-20)', borderRadius: 'var(--radius-sm)', color: 'var(--warning)', fontSize: '0.875rem' }}>
                    <AlertCircle size={14} /> No pools configured for this division. Go to Division Settings and add pools first.
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {poolList.map(pool => (
                      <div key={pool.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: 'var(--white-60)', fontSize: '0.875rem', minWidth: '60px' }}>{pool.name}:</span>
                        <input
                          type="number"
                          className="form-input"
                          style={{ width: '72px' }}
                          min="2"
                          max="16"
                          value={slotCountOverride[pool.id] ?? defaultSlotCount(pool.id)}
                          onChange={e => setSlotCountOverride(prev => ({ ...prev, [pool.id]: Number(e.target.value) }))}
                        />
                        <span style={{ fontSize: '0.8rem', color: 'var(--white-40)' }}>slots</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Available Scheduling Dates
                <button type="button" className="btn btn-ghost btn-sm" onClick={addDateSlot} style={{ color: 'var(--logic-lime)' }}>
                  <Plus size={14} /> Add Date
                </button>
              </label>
              <div className={styles.dateSlotList}>
                {dateSlots.map((slot, idx) => (
                  <div key={idx} className={styles.dateSlotRow}>
                    <div className="form-group" style={{ flex: 2 }}>
                      <select className="form-select" value={slot.date} onChange={e => updateDateSlot(idx, { date: e.target.value })}>
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
              <span>
                Generated <strong>{previewCount}</strong> games for <strong>{divisionName}</strong>
                {generationMode === 'slot' && <span className="badge badge-neutral" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>SLOT SCHEDULE</span>}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={reset}><RefreshCw size={14} /> Start Over</button>
            </div>

            {generationMode === 'slot' && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.75rem 1rem', background: 'var(--white-5)', borderRadius: 'var(--radius-sm)', margin: '0.75rem 0', fontSize: '0.8rem', color: 'var(--white-60)', lineHeight: 1.5 }}>
                <Info size={14} style={{ marginTop: '1px', flexShrink: 0, color: 'var(--blueprint-blue)' }} />
                Team names will appear publicly only once all slots in each pool are assigned via the Slot Assignments tab.
              </div>
            )}

            <div className={styles.previewTableWrap}>
              <table>
                <thead>
                  <tr><th>Date & Time</th><th>Matchup</th><th>Pool</th><th>Diamond</th></tr>
                </thead>
                <tbody>
                  {generationMode === 'slot' ? (
                    generatedSlotGames.map((g, i) => {
                      const pool = poolList.find(p => p.id === g.homePoolId);
                      return (
                        <tr key={i}>
                          <td style={{ fontSize: '0.8rem' }}>
                            {new Date(g.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at <strong>{formatTime(g.time)}</strong>
                          </td>
                          <td>{g.homePlaceholder} vs {g.awayPlaceholder}</td>
                          <td><span className="badge badge-neutral">{pool?.name ?? '—'}</span></td>
                          <td>{g.location}</td>
                        </tr>
                      );
                    })
                  ) : (
                    generatedGames.map((g, i) => {
                      const homeTeam = teams.find(t => t.id === g.homeTeamId);
                      const awayTeam = teams.find(t => t.id === g.awayTeamId);
                      return (
                        <tr key={i}>
                          <td style={{ fontSize: '0.8rem' }}>
                            {new Date(g.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at <strong>{formatTime(g.time)}</strong>
                          </td>
                          <td>{homeTeam?.name} vs {awayTeam?.name}</td>
                          <td>
                            {(() => {
                              const usePools = (currentGroup?.poolCount || 0) >= 2;
                              const poolRecord = usePools ? currentGroup?.pools?.find(p => p.id === homeTeam?.poolId) : null;
                              const name = poolRecord ? poolRecord.name : (usePools ? 'Unassigned' : 'None');
                              return <span className="badge badge-neutral">{name}</span>;
                            })()}
                          </td>
                          <td>{g.location}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {error && <div className={styles.errorBanner}><AlertCircle size={16} /> {error}</div>}

            <div className={styles.previewFooter}>
              <button className="btn btn-ghost" onClick={reset} disabled={committing}>Cancel</button>
              <button className="btn btn-primary" onClick={() => setShowConfirm(true)} disabled={committing}>
                {committing ? <><RefreshCw className="spin" size={14} /> Saving…</> : <><Check size={14} /> Commit Schedule</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {showConfirm && (
        <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setShowConfirm(false)}>
          <div className="modal" style={{ maxWidth: 450, padding: '2rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--white-5)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: 'var(--logic-lime)' }}>
                <AlertCircle size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Commit Schedule?</h3>
              <p style={{ color: 'var(--white-60)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                {generationMode === 'slot'
                  ? <>This will save a slot-based schedule and <strong style={{ color: 'var(--danger)' }}>permanently clear</strong> any existing games for <strong>{divisionName}</strong>. Team names will appear publicly once all slots are assigned.</>
                  : <>This will save the generated schedule and <strong style={{ color: 'var(--danger)' }}>permanently clear</strong> any existing games for the <strong>{divisionName}</strong> division.</>
                }
              </p>
            </div>
            <div className="flex gap-1" style={{ justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={commit}>
                <Check size={14} /> Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
