'use client';
import React, { useState, useEffect } from 'react';
import { Trophy, Check, X, Calendar, MapPin, Clock, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { getStandings, getDiamonds, saveGame, getTournament, getGames, deleteGame, getTeams } from '@/lib/db';
import { AgeGroup, Team, Diamond, PlayoffConfig, Game, Tournament } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import BracketBuilder from './components/BracketBuilder';
import builderStyles from './components/BracketBuilder.module.css';
import FeedbackModal from '@/components/FeedbackModal';

interface Props {
  ageGroup: AgeGroup;
  tournamentId: string;
  onClose: () => void;
  onComplete: () => void;
}

export default function PlayoffWizard({ ageGroup, tournamentId, onClose, onComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [feedback, setFeedback] = useState<{isOpen: boolean; title: string; message: string; type: 'primary'|'danger'|'warning'|'success'|'info'}>({isOpen: false, title: '', message: '', type: 'primary'});
  const [config, setConfig] = useState<PlayoffConfig>(() => {
    const defaults: PlayoffConfig = {
      type: 'single',
      crossover: 'standard',
      hasThirdPlace: false,
      teamsQualifying: 4,
      tieBreakers: ['h2h', 'rd', 'rf', 'ra']
    };
    return { ...defaults, ...(ageGroup.playoffConfig || {}) };
  });
  const [activeTab, setActiveTab] = useState<'settings' | 'preview'>('settings');
  const [diamonds, setDiamonds] = useState<Diamond[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [templatePreview, setTemplatePreview] = useState<any[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    getDiamonds(tournamentId).then(setDiamonds);
    getTournament(tournamentId).then(setTournament);
    getTeams(tournamentId).then(all => setTeams(all.filter(t => t.ageGroupId === ageGroup.id && t.status === 'accepted')));
  }, [tournamentId, ageGroup.id]);

  useEffect(() => {
    if (config.crossover === 'standard' && (ageGroup.pools?.length || 0) !== 2) {
      setConfig(prev => ({ ...prev, crossover: 'reseed' }));
    }
  }, [ageGroup.pools?.length]);

  const breakerLabels: Record<string, string> = {
    h2h: 'Head-to-Head',
    rd: 'Run Diff',
    rf: 'Runs For',
    ra: 'Runs Against'
  };

  function moveBreaker(index: number, direction: 'up' | 'down') {
    const newBreakers = [...config.tieBreakers];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newBreakers.length) return;
    
    const temp = newBreakers[index];
    newBreakers[index] = newBreakers[targetIndex];
    newBreakers[targetIndex] = temp;
    setConfig({ ...config, tieBreakers: newBreakers });
  }

  function generatePreview() {
    const games: any[] = [];
    const { crossover, hasThirdPlace, teamsQualifying } = config;
    const pools = ageGroup.pools || [];
    
    // 1. No Crossover (Split Pool Championships)
    if (crossover === 'none' && pools.length >= 2) {
      pools.forEach(pool => {
        const count = Math.min(teamsQualifying, 4); // Usually 2 or 4 per pool
        if (count === 2) {
          games.push({ round: 'Championship', pool: pool.name, home: `1st Pool ${pool.name}`, away: `2nd Pool ${pool.name}`, code: `${pool.name}-FIN` });
        } else {
          games.push({ round: 'Semifinal', pool: pool.name, home: `1st Pool ${pool.name}`, away: `4th Pool ${pool.name}`, code: `${pool.name}-SF1` });
          games.push({ round: 'Semifinal', pool: pool.name, home: `2nd Pool ${pool.name}`, away: `3rd Pool ${pool.name}`, code: `${pool.name}-SF2` });
          games.push({ round: 'Championship', pool: pool.name, home: `Winner ${pool.name}-SF1`, away: `Winner ${pool.name}-SF2`, code: `${pool.name}-FIN` });
          if (hasThirdPlace) {
            games.push({ round: '3rd Place', pool: pool.name, home: `Loser ${pool.name}-SF1`, away: `Loser ${pool.name}-SF2`, code: `${pool.name}-3RD` });
          }
        }
      });
    } 
    // 2. Standard Crossover (A vs B) - Only works for 2 pools
    else if (crossover === 'standard' && pools.length === 2) {
      if (teamsQualifying === 4) {
        games.push({ round: 'Semifinal', home: '1st Pool A', away: '2nd Pool B', code: 'SF1' });
        games.push({ round: 'Semifinal', home: '1st Pool B', away: '2nd Pool A', code: 'SF2' });
        games.push({ round: 'Championship', home: 'Winner SF1', away: 'Winner SF2', code: 'FIN' });
        if (hasThirdPlace) games.push({ round: '3rd Place', home: 'Loser SF1', away: 'Loser SF2', code: '3RD' });
      } else if (teamsQualifying === 8) {
        games.push({ round: 'Quarterfinal', home: '1st Pool A', away: '4th Pool B', code: 'QF1' });
        games.push({ round: 'Quarterfinal', home: '2nd Pool A', away: '3rd Pool B', code: 'QF2' });
        games.push({ round: 'Quarterfinal', home: '2nd Pool B', away: '3rd Pool A', code: 'QF3' });
        games.push({ round: 'Quarterfinal', home: '1st Pool B', away: '4th Pool A', code: 'QF4' });
        games.push({ round: 'Semifinal', home: 'Winner QF1', away: 'Winner QF3', code: 'SF1' });
        games.push({ round: 'Semifinal', home: 'Winner QF2', away: 'Winner QF4', code: 'SF2' });
        games.push({ round: 'Championship', home: 'Winner SF1', away: 'Winner SF2', code: 'FIN' });
        if (hasThirdPlace) games.push({ round: '3rd Place', home: 'Loser SF1', away: 'Loser SF2', code: '3RD' });
      } else {
        // 2 Teams
        games.push({ round: 'Championship', home: '1st Pool A', away: '1st Pool B', code: 'FIN' });
      }
    }
    // 3. Reseed (Global Seeding 1 vs Last) - Default for > 2 pools or 'reseed' logic
    else {
      if (teamsQualifying === 4) {
        games.push({ round: 'Semifinal', home: 'Seed #1', away: 'Seed #4', code: 'SF1' });
        games.push({ round: 'Semifinal', home: 'Seed #2', away: 'Seed #3', code: 'SF2' });
        games.push({ round: 'Championship', home: 'Winner SF1', away: 'Winner SF2', code: 'FIN' });
        if (hasThirdPlace) games.push({ round: '3rd Place', home: 'Loser SF1', away: 'Loser SF2', code: '3RD' });
      } else if (teamsQualifying === 8) {
        for (let i = 1; i <= 4; i++) {
          games.push({ round: 'Quarterfinal', home: `Seed #${i}`, away: `Seed #${9-i}`, code: `QF${i}` });
        }
        games.push({ round: 'Semifinal', home: 'Winner QF1', away: 'Winner QF4', code: 'SF1' });
        games.push({ round: 'Semifinal', home: 'Winner QF2', away: 'Winner QF3', code: 'SF2' });
        games.push({ round: 'Championship', home: 'Winner SF1', away: 'Winner SF2', code: 'FIN' });
        if (hasThirdPlace) games.push({ round: '3rd Place', home: 'Loser SF1', away: 'Loser SF2', code: '3RD' });
      } else {
        // 2 Teams
        games.push({ round: 'Championship', home: 'Seed #1', away: 'Seed #2', code: 'FIN' });
      }
    }

    setTemplatePreview(games.map(g => {
      const existing = preview.find(p => p.code === g.code);
      // Prioritize tournament end date, fallback to today ONLY if we have no tournament info at all
      const tournamentEnd = tournament?.endDate;
      const today = new Date().toISOString().split('T')[0];
      const defaultDate = tournamentEnd || today;

      return { 
        ...g, 
        // If we have an existing date that isn't just a "today" fallback, keep it. 
        // Otherwise, use the tournament end date if available.
        date: (existing?.date && existing.date !== today) ? existing.date : defaultDate, 
        time: existing?.time || '', 
        diamondId: existing?.diamondId || '' 
      };
    }));
  }

  // generatePreview is now triggered explicitly via the "Configure Brackets" button

  async function handleCreate() {
    setShowWarning(true);
  }

  const baseOptions = React.useMemo(() => {
    if (config.crossover === 'standard' && ageGroup.pools && ageGroup.pools.length > 0) {
      const options: string[] = [];
      const numPools = ageGroup.pools.length;
      const perPool = Math.ceil(config.teamsQualifying / numPools);
      const suffix = ['st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th'];
      ageGroup.pools.forEach(pool => {
        for (let i = 1; i <= perPool; i++) {
          options.push(`${i}${suffix[i-1] || 'th'} Pool ${pool.name}`);
        }
      });
      return options;
    }
    const numSeeds = ageGroup.capacity || teams.length || 16;
    return Array.from({length: numSeeds}, (_, i) => `Seed #${i + 1}`);
  }, [config.crossover, config.teamsQualifying, ageGroup.pools, ageGroup.capacity, teams.length]);

  function proceedAfterWarning() {
    setShowWarning(false);
    
    // Check for missing seeds from baseOptions that aren't in any matchup
    const usedSeeds = new Set(preview.flatMap(p => [p.home, p.away]));
    const missingSeeds = baseOptions.filter(opt => !usedSeeds.has(opt));
    
    if (missingSeeds.length > 0) {
      setFeedback({ 
        isOpen: true, 
        title: 'Missing Teams', 
        message: `The following required teams are not scheduled in any matchup: ${missingSeeds.join(', ')}. Please add them to the bracket before generating.`, 
        type: 'warning' 
      });
      return;
    }

    if (preview.some(p => !p.date || !p.diamondId)) {
      setShowConfirm(true);
    } else {
      executeCreate();
    }
  }

  async function executeCreate() {
    setLoading(true);
    setShowConfirm(false);
    try {
      // Delete existing playoff games for this division
      const allGames = await getGames(tournamentId);
      const toDelete = allGames.filter(g => g.ageGroupId === ageGroup.id && g.isPlayoff);
      for (const g of toDelete) {
        await deleteGame(g.id);
      }

      const bracketId = crypto.randomUUID();
      for (const p of preview) {
        await saveGame({
          tournamentId,
          ageGroupId: ageGroup.id,
          homeTeamId: null as any,
          awayTeamId: null as any,
          date: p.date || null,
          time: p.time || null,
          location: diamonds.find(d => d.id === p.diamondId)?.name || 'TBD',
          diamondId: p.diamondId || undefined,
          status: 'scheduled',
          isPlayoff: true,
          bracketId,
          bracketCode: p.code,
          homePlaceholder: p.home,
          awayPlaceholder: p.away,
          notes: null
        });
      }
      onComplete();
    } catch (err) {
      console.error(err);
      setFeedback({ isOpen: true, title: 'Error', message: 'Failed to generate bracket. Please try again.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ padding: 0, display: 'flex', flexDirection: 'column', maxHeight: '95vh', width: '90%', maxWidth: 'none' }}>
        
        {/* Header */}
        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <div className="flex-between">
            <div className="flex gap-3">
              <div className="flex-center" style={{ width: '40px', height: '40px', background: 'var(--purple-faint)', borderRadius: '10px', color: 'var(--purple-light)', border: '1px solid var(--border)' }}>
                <Trophy size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0 }}>Playoff Bracket Generator</h3>
                <p className="text-label" style={{ color: 'var(--purple-light)', marginTop: '0.25rem' }}>{ageGroup.name} Division</p>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '0.5rem' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Area (Scrollable) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Step 1: Configuration */}
            <section>
              <h4 className="text-label" style={{ marginBottom: '1rem', opacity: 0.5 }}>1. Bracket Configuration</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Qualified Teams</label>
                  <select className="form-select" value={config.teamsQualifying} onChange={e => setConfig({...config, teamsQualifying: Number(e.target.value)})}>
                    <option value={2}>Top 2 Teams (Final Only)</option>
                    <option value={4}>Top 4 Teams (SF + Final)</option>
                    <option value={8}>Top 8 Teams (QF + SF + Final)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Crossover Rules</label>
                  <select className="form-select" value={config.crossover} onChange={e => setConfig({...config, crossover: e.target.value as any})}>
                    {(ageGroup.pools?.length || 0) === 2 && <option value="standard">Standard (First A vs. Last B)</option>}
                    <option value="reseed">Top vs Bottom Reseed (Global Seeding)</option>
                    <option value="none">No Crossover (Split Pool Championship)</option>
                  </select>
                </div>
                <div className="form-group" style={{ justifyContent: 'center' }}>
                   <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={config.hasThirdPlace} onChange={e => setConfig({...config, hasThirdPlace: e.target.checked})} style={{ width: '18px', height: '18px', accentColor: 'var(--purple)' }} />
                    <span className="text-sm font-bold">Include 3rd Place / Consolidation Game</span>
                  </label>
                </div>
              </div>
            </section>

            <div className="divider" style={{ margin: '0.5rem 0' }}></div>

            {/* Step 2: Tie-Breakers */}
            <section>
              <h4 className="text-label" style={{ marginBottom: '0.75rem', opacity: 0.5 }}>2. Seeding Hierarchy (Tie-Breakers)</h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '500px' }}>
                {config.tieBreakers.map((b, i) => (
                  <div key={b} className="flex-between" style={{ background: 'var(--surface)', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <div className="flex gap-3 items-center">
                      <span style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 900, 
                        color: 'var(--purple-light)',
                        minWidth: '14px'
                      }}>{i + 1}</span>
                      <span className="font-bold" style={{ fontSize: '0.9rem' }}>{breakerLabels[b]}</span>
                    </div>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-sm" style={{ padding: '0.2rem' }} onClick={() => moveBreaker(i, 'up')} disabled={i === 0}>
                        <ChevronUp size={14} />
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ padding: '0.2rem' }} onClick={() => moveBreaker(i, 'down')} disabled={i === config.tieBreakers.length - 1}>
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-muted mt-3" style={{ fontSize: '0.8rem', fontStyle: 'italic', opacity: 0.7 }}>
                Note: If 3 or more teams are tied, Head-to-Head is automatically skipped.
              </p>

              <div style={{ marginTop: '2rem', padding: '1.25rem', background: 'var(--purple-faint)', borderRadius: 'var(--radius-md)', border: '1px solid var(--purple-10)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 className="font-bold text-sm text-purple-light" style={{ marginBottom: '0.25rem' }}>Configure Brackets</h4>
                  <p className="text-muted text-xs">Generate the initial bracket layout based on your selections above. <br/><strong>Warning:</strong> Clicking this will reset the Custom Builder canvas.</p>
                </div>
                <button className="btn btn-primary" onClick={generatePreview}>Configure Brackets</button>
              </div>
            </section>

            <div className="divider"></div>

            {/* Step 3: Game Slots */}
            <section>
              <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                <h4 className="text-label" style={{ opacity: 0.5 }}>3. Game Slots & Scheduling</h4>
                <span className="badge badge-purple">{preview.length} Games</span>
              </div>

              {templatePreview.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"><Calendar size={32} /></div>
                  <h4 className="display-sm" style={{ marginBottom: '0.5rem' }}>No Matches Generated</h4>
                  <p className="text-muted" style={{ maxWidth: '400px', margin: '0 auto', fontSize: '0.9rem', lineHeight: '1.5' }}>
                    Adjust your bracket configuration above and click <strong>Configure Brackets</strong> to generate the initial playoff schedule structure.
                  </p>
                </div>
              ) : (
                <BracketBuilder 
                  ageGroup={ageGroup} 
                  teams={teams} 
                  diamonds={diamonds} 
                  defaultDate={tournament?.endDate || new Date().toISOString().split('T')[0]} 
                  templatePreview={templatePreview}
                  baseOptions={baseOptions}
                  onPreviewChange={setPreview} 
                />
              )}
            </section>

          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ padding: '1.5rem 2rem', background: 'var(--surface-2)', margin: 0 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={loading || preview.length === 0} style={{ padding: '0.75rem 2rem' }}>
            {loading ? 'Creating...' : <><Check size={18} /> Generate Playoff Bracket</>}
          </button>
        </div>

      </div>

      {/* Missing Info Confirmation Modal */}
      {showConfirm && (
        <div className="modal-overlay" style={{ zIndex: 1000, background: 'rgba(0,0,0,0.8)' }} onClick={e => e.stopPropagation()}>
          <div className="card" style={{ maxWidth: '400px', width: '90%', padding: '2rem', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div className="flex-center mb-6" style={{ width: '60px', height: '60px', background: 'rgba(234, 179, 8, 0.1)', borderRadius: '100%', margin: '0 auto', color: '#fbbf24' }}>
              <AlertCircle size={32} />
            </div>
            <h3 className="display-sm mb-2" style={{ fontSize: '1.25rem' }}>Missing Information</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '2rem' }}>Some games are missing a date or field assignment. Are you sure you want to generate the bracket now?</p>
            <div className="flex gap-3">
              <button className="btn btn-ghost flex-1" onClick={() => setShowConfirm(false)}>Go Back</button>
              <button className="btn btn-primary flex-1" onClick={executeCreate}>Continue Anyway</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Existing Warning Modal */}
      {showWarning && (
        <div className="modal-overlay" style={{ zIndex: 1000, background: 'rgba(0,0,0,0.8)' }} onClick={e => e.stopPropagation()}>
          <div className="card" style={{ maxWidth: '440px', width: '90%', padding: '2.5rem', textAlign: 'center', boxShadow: '0 25px 60px rgba(0,0,0,0.6)', border: '1px solid var(--danger)' }}>
            <div className="flex-center mb-6" style={{ width: '70px', height: '70px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '100%', margin: '0 auto', color: 'var(--danger)' }}>
              <AlertCircle size={36} />
            </div>
            <h3 className="display-sm mb-3" style={{ fontSize: '1.4rem', color: 'var(--white)' }}>Replace Existing Bracket?</h3>
            <p className="text-muted" style={{ fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '2.5rem' }}>
              Generating a new playoff bracket will <strong style={{ color: 'var(--danger)' }}>delete all existing playoff games and scores</strong> for the {ageGroup.name} division. This action cannot be undone.
            </p>
            <div className="flex flex-col gap-3">
              <button className="btn btn-primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={proceedAfterWarning}>
                Yes, Delete and Replace
              </button>
              <button className="btn btn-ghost" onClick={() => setShowWarning(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <FeedbackModal {...feedback} onClose={() => setFeedback(f => ({ ...f, isOpen: false, onConfirm: undefined }))} />
    </div>
  );
}
