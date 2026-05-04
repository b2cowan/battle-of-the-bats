'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { getGames, getTeams, getDiamonds, getAgeGroups, updateGame, getOrganizationBySlug, getTournamentsByOrg } from '@/lib/db';
import type { Game, Team, Diamond, AgeGroup } from '@/lib/types';
import { formatTime } from '@/lib/utils';

type ScoreState = 'idle' | 'entering' | 'saving';

interface GameCard {
  game: Game;
  homeName: string;
  awayName: string;
  diamond: Diamond | null;
  divisionName: string;
}

export default function OfficialScorePage() {
  const params  = useParams();
  const orgSlug = params.orgSlug as string;

  const [cards, setCards]                         = useState<GameCard[]>([]);
  const [loading, setLoading]                     = useState(true);
  const [requireFinalization, setRequireFinalization] = useState(false);

  // Filters
  const [diamonds, setDiamonds]     = useState<Diamond[]>([]);
  const [ageGroups, setAgeGroups]   = useState<AgeGroup[]>([]);
  const [filterDiamond, setFilterDiamond] = useState('');
  const [filterDivision, setFilterDivision] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);

  // Score entry
  const [editing, setEditing]   = useState<Game | null>(null);
  const [scoreState, setScoreState] = useState<ScoreState>('idle');
  const [home, setHome]         = useState('');
  const [away, setAway]         = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const supabase = createClient();

  const today = new Date().toISOString().split('T')[0];

  const loadGames = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const org = await getOrganizationBySlug(orgSlug);
      if (!org) throw new Error('Organization not found');

      setRequireFinalization(org.requireScoreFinalization ?? false);

      const tournaments = await getTournamentsByOrg(org.id);
      const activeTournament = tournaments.find(t => t.isActive) ?? tournaments[0] ?? null;
      if (!activeTournament) {
        setCards([]);
        setLoading(false);
        return;
      }

      const [allGames, allTeams, allDiamonds, allGroups] = await Promise.all([
        getGames(activeTournament.id),
        getTeams(activeTournament.id),
        getDiamonds(activeTournament.id),
        getAgeGroups(activeTournament.id),
      ]);

      setDiamonds(allDiamonds);
      setAgeGroups(allGroups);

      const todayGames = allGames.filter(g => g.date === today);

      const built: GameCard[] = todayGames.map(g => ({
        game: g,
        homeName: allTeams.find(t => t.id === g.homeTeamId)?.name ?? g.homePlaceholder ?? 'TBD',
        awayName: allTeams.find(t => t.id === g.awayTeamId)?.name ?? g.awayPlaceholder ?? 'TBD',
        diamond: allDiamonds.find(d => d.id === g.diamondId) ?? null,
        divisionName: allGroups.find(gr => gr.id === g.ageGroupId)?.name ?? '—',
      }));

      built.sort((a, b) => (a.game.time ?? '').localeCompare(b.game.time ?? ''));
      setCards(built);
    } catch (err: any) {
      setErrorMsg('Unable to load games. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, today]);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  // Realtime: detect finalization by admin or any score change
  useEffect(() => {
    if (cards.length === 0) return;

    const tournamentId = cards[0]?.game.tournamentId;
    if (!tournamentId) return;

    const channel = supabase
      .channel(`official-games-${tournamentId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `tournament_id=eq.${tournamentId}` },
        (payload) => {
          setCards(prev => prev.map(c =>
            c.game.id === payload.new.id
              ? {
                  ...c,
                  game: {
                    ...c.game,
                    homeScore: payload.new.home_score,
                    awayScore: payload.new.away_score,
                    status:    payload.new.status,
                  },
                }
              : c
          ));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [cards.length, supabase]);

  function openEdit(game: Game) {
    // Block editing if game is completed (finalized or auto-final)
    if (game.status === 'completed') return;
    setEditing(game);
    setHome(game.homeScore !== null && game.homeScore !== undefined ? String(game.homeScore) : '');
    setAway(game.awayScore !== null && game.awayScore !== undefined ? String(game.awayScore) : '');
    setShowErrors(false);
    setScoreState('entering');
  }

  async function handleSubmit() {
    if (home === '' || away === '') {
      setShowErrors(true);
      return;
    }
    if (!editing) return;
    setScoreState('saving');
    try {
      const newStatus = requireFinalization ? 'submitted' : 'completed';
      await updateGame(editing.id, {
        homeScore: Number(home),
        awayScore: Number(away),
        status: newStatus as any,
      });
      setEditing(null);
      setScoreState('idle');
    } catch {
      setErrorMsg('Failed to save score. Please try again.');
      setScoreState('entering');
    }
  }

  // Filtered view
  const visible = cards.filter(c => {
    if (filterDiamond && c.game.diamondId !== filterDiamond) return false;
    if (filterDivision && c.game.ageGroupId !== filterDivision) return false;
    if (!showCompleted && c.game.status === 'completed') return false;
    return true;
  });

  const pendingCount   = cards.filter(c => c.game.status === 'scheduled').length;
  const submittedCount = cards.filter(c => c.game.status === 'submitted').length;

  function gameCardBg(status: Game['status']) {
    if (status === 'completed') return 'rgba(30,58,138,0.08)';
    if (status === 'submitted') return 'rgba(245,158,11,0.06)';
    return '#111827';
  }

  function gameCardBorder(status: Game['status']) {
    if (status === 'completed') return '1px solid rgba(30,58,138,0.3)';
    if (status === 'submitted') return '1px solid rgba(245,158,11,0.4)';
    return '1px solid #1E3A8A';
  }

  function statusPill(game: Game) {
    if (game.status === 'completed') {
      return (
        <span style={{ fontFamily: 'var(--font-data)', fontSize: '0.65rem', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase', color: '#D9F99D',
          border: '1px solid rgba(217,249,157,0.4)', padding: '2px 6px' }}>
          Finalized
        </span>
      );
    }
    if (game.status === 'submitted') {
      return (
        <span style={{ fontFamily: 'var(--font-data)', fontSize: '0.65rem', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase', color: '#F59E0B',
          border: '1px solid rgba(245,158,11,0.4)', padding: '2px 6px' }}>
          Pending Review
        </span>
      );
    }
    return null;
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'var(--font-data)', color: '#D9F99D', fontSize: '0.75rem',
        letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D9F99D',
          display: 'inline-block', animation: 'pulse-lime 2s infinite' }} />
        Retrieving field assignments...
      </div>
    );
  }

  if (errorMsg && cards.length === 0) {
    return (
      <div style={{ padding: '2rem' }}>
        <p style={{ fontFamily: 'var(--font-data)', color: '#94A3B8', fontSize: '0.875rem' }}>{errorMsg}</p>
        <button onClick={loadGames}
          style={{ marginTop: '1rem', fontFamily: 'var(--font-data)', fontSize: '0.7rem',
            textTransform: 'uppercase', letterSpacing: '0.1em', color: '#F1F5F9',
            border: '1px solid rgba(30,58,138,0.5)', background: 'transparent',
            padding: '0.5rem 1rem', cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      {/* Status bar */}
      <div style={{ fontFamily: 'var(--font-data)', fontSize: '0.7rem', letterSpacing: '0.1em',
        textTransform: 'uppercase', color: '#94A3B8', marginBottom: '1.25rem',
        display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <span>{pendingCount} to score</span>
        {submittedCount > 0 && (
          <span style={{ color: '#F59E0B' }}>{submittedCount} pending review</span>
        )}
        <span style={{ color: '#94A3B8' }}>
          {today}
        </span>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {diamonds.length > 1 && (
          <select
            value={filterDiamond}
            onChange={e => setFilterDiamond(e.target.value)}
            style={{ fontFamily: 'var(--font-data)', fontSize: '0.7rem', background: '#111827',
              border: '1px solid rgba(30,58,138,0.5)', color: '#F1F5F9', padding: '0.4rem 0.6rem',
              letterSpacing: '0.05em' }}
          >
            <option value="">All Diamonds</option>
            {diamonds.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
        {ageGroups.length > 1 && (
          <select
            value={filterDivision}
            onChange={e => setFilterDivision(e.target.value)}
            style={{ fontFamily: 'var(--font-data)', fontSize: '0.7rem', background: '#111827',
              border: '1px solid rgba(30,58,138,0.5)', color: '#F1F5F9', padding: '0.4rem 0.6rem',
              letterSpacing: '0.05em' }}
          >
            <option value="">All Divisions</option>
            {ageGroups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer',
          fontFamily: 'var(--font-data)', fontSize: '0.7rem', color: '#94A3B8',
          letterSpacing: '0.05em' }}>
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={e => setShowCompleted(e.target.checked)}
            style={{ accentColor: '#1E3A8A' }}
          />
          Show finalized
        </label>
      </div>

      {/* Game cards */}
      {visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', fontFamily: 'var(--font-data)',
          color: '#94A3B8', fontSize: '0.8rem', letterSpacing: '0.05em' }}>
          {cards.length === 0
            ? 'No games scheduled for today.'
            : 'No games match the current filters.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {visible.map(({ game, homeName, awayName, diamond, divisionName }) => {
            const isFinalized = game.status === 'completed';
            const isSubmitted = game.status === 'submitted';
            const isEditable  = !isFinalized;

            return (
              <div
                key={game.id}
                onClick={() => isEditable && openEdit(game)}
                style={{
                  background: gameCardBg(game.status),
                  border: gameCardBorder(game.status),
                  padding: '1rem',
                  cursor: isEditable ? 'pointer' : 'default',
                  transition: 'border-color 0.15s',
                }}
              >
                {/* Meta row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: '0.75rem' }}>
                  <div style={{ fontFamily: 'var(--font-data)', fontSize: '0.65rem',
                    color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {formatTime(game.time)}{diamond ? ` · ${diamond.name}` : ''} · {divisionName}
                  </div>
                  {statusPill(game)}
                </div>

                {/* Score row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '0.5rem' }}>
                  {/* Home */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-data)', fontSize: '1rem', fontWeight: 700,
                      color: '#F1F5F9', lineHeight: 1.2 }}>{homeName}</div>
                    {(isFinalized || isSubmitted) && (
                      <div style={{ fontFamily: 'var(--font-data)', fontSize: '2rem', fontWeight: 700,
                        color: '#D9F99D', lineHeight: 1 }}>{game.homeScore ?? '—'}</div>
                    )}
                  </div>

                  {/* VS / dash */}
                  <div style={{ fontFamily: 'var(--font-data)', fontSize: '0.75rem',
                    color: '#94A3B8', fontWeight: 700, letterSpacing: '0.1em', textAlign: 'center' }}>
                    {isFinalized || isSubmitted ? '—' : 'vs'}
                  </div>

                  {/* Away */}
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontFamily: 'var(--font-data)', fontSize: '1rem', fontWeight: 700,
                      color: '#F1F5F9', lineHeight: 1.2 }}>{awayName}</div>
                    {(isFinalized || isSubmitted) && (
                      <div style={{ fontFamily: 'var(--font-data)', fontSize: '2rem', fontWeight: 700,
                        color: '#D9F99D', lineHeight: 1 }}>{game.awayScore ?? '—'}</div>
                    )}
                  </div>
                </div>

                {/* Tap prompt */}
                {!isFinalized && !isSubmitted && (
                  <div style={{ marginTop: '0.75rem', textAlign: 'center', fontFamily: 'var(--font-data)',
                    fontSize: '0.65rem', color: '#94A3B8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Tap to enter score
                  </div>
                )}
                {isFinalized && (
                  <div style={{ marginTop: '0.5rem', textAlign: 'center', fontFamily: 'var(--font-data)',
                    fontSize: '0.65rem', color: '#94A3B8', letterSpacing: '0.08em' }}>
                    This score has been finalized by an administrator.
                  </div>
                )}
                {isSubmitted && (
                  <div style={{ marginTop: '0.5rem', textAlign: 'center', fontFamily: 'var(--font-data)',
                    fontSize: '0.65rem', color: '#F59E0B', letterSpacing: '0.08em' }}>
                    Tap to correct score before admin finalizes.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Score entry overlay */}
      {editing && scoreState !== 'idle' && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem', zIndex: 999 }}
          onClick={() => { setEditing(null); setScoreState('idle'); }}
        >
          <div
            style={{ background: '#111827', border: '1px solid #1E3A8A', padding: '1.5rem',
              width: '100%', maxWidth: 380 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="hud-label" style={{ marginBottom: '1.25rem' }}>Enter Score</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 24px 1fr', gap: '0.75rem',
              alignItems: 'center', marginBottom: '1.5rem' }}>
              {/* Home input */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-data)', fontSize: '0.7rem', color: '#94A3B8',
                  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  {cards.find(c => c.game.id === editing.id)?.homeName ?? 'Home'}
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={home}
                  onChange={e => { if (e.target.value === '' || /^\d+$/.test(e.target.value)) setHome(e.target.value); }}
                  autoFocus
                  placeholder="0"
                  style={{
                    width: '100%', textAlign: 'center',
                    fontFamily: 'var(--font-data)', fontSize: '2.5rem', fontWeight: 700,
                    background: 'transparent', color: '#D9F99D',
                    border: showErrors && home === '' ? '1px solid #ef4444' : '1px solid rgba(30,58,138,0.6)',
                    padding: '0.5rem', outline: 'none',
                  }}
                />
              </div>
              <div style={{ fontFamily: 'var(--font-data)', color: '#94A3B8', textAlign: 'center', fontWeight: 700 }}>—</div>
              {/* Away input */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-data)', fontSize: '0.7rem', color: '#94A3B8',
                  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  {cards.find(c => c.game.id === editing.id)?.awayName ?? 'Away'}
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={away}
                  onChange={e => { if (e.target.value === '' || /^\d+$/.test(e.target.value)) setAway(e.target.value); }}
                  placeholder="0"
                  style={{
                    width: '100%', textAlign: 'center',
                    fontFamily: 'var(--font-data)', fontSize: '2.5rem', fontWeight: 700,
                    background: 'transparent', color: '#D9F99D',
                    border: showErrors && away === '' ? '1px solid #ef4444' : '1px solid rgba(30,58,138,0.6)',
                    padding: '0.5rem', outline: 'none',
                  }}
                />
              </div>
            </div>

            {showErrors && (home === '' || away === '') && (
              <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.75rem', color: '#ef4444',
                marginBottom: '1rem', textAlign: 'center' }}>
                Both scores are required.
              </p>
            )}
            {errorMsg && (
              <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.75rem', color: '#ef4444',
                marginBottom: '1rem', textAlign: 'center' }}>
                {errorMsg}
              </p>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => { setEditing(null); setScoreState('idle'); setErrorMsg(''); }}
                disabled={scoreState === 'saving'}
                style={{ flex: 1, fontFamily: 'var(--font-data)', fontSize: '0.7rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  background: 'transparent', color: '#94A3B8',
                  border: '1px solid rgba(30,58,138,0.4)', padding: '0.75rem',
                  cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={scoreState === 'saving'}
                style={{ flex: 2, fontFamily: 'var(--font-data)', fontSize: '0.75rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  background: '#D9F99D', color: '#0A0A0A',
                  border: 'none', padding: '0.75rem',
                  cursor: scoreState === 'saving' ? 'not-allowed' : 'pointer',
                  opacity: scoreState === 'saving' ? 0.7 : 1 }}
              >
                {scoreState === 'saving' ? 'Saving…' : 'Submit Score'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
