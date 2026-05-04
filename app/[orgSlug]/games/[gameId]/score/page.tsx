'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { finalizeGame } from './actions';

interface GameRow {
  id: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  game_time: string;
  bracket_code: string | null;
  home_placeholder: string | null;
  away_placeholder: string | null;
  home_team: { id: string; name: string } | null;
  away_team: { id: string; name: string } | null;
  age_groups: { name: string } | null;
}

const PERIODS = ['1', '2', 'OT'];

export default function TacticalHUD() {
  const { orgSlug, gameId } = useParams<{ orgSlug: string; gameId: string }>();

  const [game, setGame] = useState<GameRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const pendingRef = useRef({ home: 0, away: 0 });

  const [periodIdx, setPeriodIdx] = useState(0);
  const [finalized, setFinalized] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('games')
      .select(`
        id, home_score, away_score, status, game_time, bracket_code,
        home_placeholder, away_placeholder,
        home_team:teams!home_team_id(id, name),
        away_team:teams!away_team_id(id, name),
        age_groups(name)
      `)
      .eq('id', gameId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const row = data as unknown as GameRow;
        setGame(row);
        const h = row.home_score ?? 0;
        const a = row.away_score ?? 0;
        setHomeScore(h);
        setAwayScore(a);
        pendingRef.current = { home: h, away: a };
        if (row.status === 'completed') setFinalized(true);
        setLoading(false);
      });
  }, [gameId]);

  function handleScore(side: 'home' | 'away', delta: number) {
    if (finalized || finalizing) return;

    if (side === 'home') {
      pendingRef.current.home = Math.max(0, pendingRef.current.home + delta);
      setHomeScore(pendingRef.current.home);
    } else {
      pendingRef.current.away = Math.max(0, pendingRef.current.away + delta);
      setAwayScore(pendingRef.current.away);
    }

    const { home, away } = pendingRef.current;
    createClient()
      .from('games')
      .update({ home_score: home, away_score: away })
      .eq('id', gameId)
      .then(({ error }) => {
        if (error) console.error('Score write failed:', error);
      });
  }

  async function handleFinal() {
    if (finalized || finalizing) return;
    const { home, away } = pendingRef.current;
    const homeName = game?.home_team?.name ?? game?.home_placeholder ?? 'Home';
    const awayName = game?.away_team?.name ?? game?.away_placeholder ?? 'Away';
    const confirmed = window.confirm(
      `Mark game FINAL?\n\n${homeName}  ${home}  —  ${away}  ${awayName}\n\nThis will record the result and advance the bracket.`
    );
    if (!confirmed) return;

    setFinalizing(true);
    setSaveError('');
    try {
      await finalizeGame(gameId, home, away);
      setFinalized(true);
    } catch {
      setSaveError('Save failed — check connection and try again.');
      setFinalizing(false);
    }
  }

  const homeName = game?.home_team?.name ?? game?.home_placeholder ?? '—';
  const awayName = game?.away_team?.name ?? game?.away_placeholder ?? '—';
  const division = game?.age_groups?.name ?? '';
  const round = game?.bracket_code ?? '';
  const gameTime = game?.game_time ? game.game_time.slice(0, 5) : '';

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="font-mono text-xs text-white/30 uppercase tracking-widest animate-pulse">Loading…</span>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
        <span className="font-mono text-xs text-white/30 uppercase tracking-widest">Game not found</span>
        <a href={`/${orgSlug}/admin/results`} className="font-mono text-xs text-logic-lime uppercase tracking-widest border border-logic-lime px-4 py-2">
          ← Back to Results
        </a>
      </div>
    );
  }

  return (
    <div
      className="font-mono"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: '#000',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* Identity strip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <span className="text-hud-xs text-white/50 uppercase tracking-widest">
          {[division, round].filter(Boolean).join(' · ')}
        </span>
        {!finalized ? (
          <span className="text-hud-xs text-logic-lime animate-pulse-lime">● LIVE</span>
        ) : (
          <span className="text-hud-xs text-white/40 uppercase tracking-widest">FINAL</span>
        )}
        <span className="text-hud-xs text-white/50">{gameTime}</span>
      </div>

      {/* Score columns */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Home */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 0.5rem' }}>
            <div className="text-hud-xs text-white/40 uppercase tracking-widest" style={{ marginBottom: '0.5rem', textAlign: 'center', lineHeight: 1.3 }}>
              {homeName}
            </div>
            <div
              className="text-score-lg text-logic-lime tabular-nums"
              style={{ fontWeight: 700, lineHeight: 1 }}
            >
              {homeScore}
            </div>
          </div>

          <button
            onPointerDown={() => handleScore('home', 1)}
            disabled={finalized || finalizing}
            aria-label="Add point for home team"
            style={{
              height: '9rem',
              minHeight: '144px',
              background: finalized ? 'rgba(255,255,255,0.03)' : 'rgba(30,58,138,0.2)',
              borderTop: `1px solid ${finalized ? 'rgba(255,255,255,0.08)' : '#1E3A8A'}`,
              borderLeft: 'none',
              borderRight: 'none',
              borderBottom: 'none',
              color: finalized ? 'rgba(255,255,255,0.2)' : '#D9F99D',
              fontSize: '2rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: finalized ? 'default' : 'pointer',
              WebkitTapHighlightColor: 'transparent',
              transition: 'background 0.1s',
            }}
            onPointerEnter={e => { if (!finalized) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(30,58,138,0.5)'; }}
            onPointerLeave={e => { if (!finalized) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(30,58,138,0.2)'; }}
          >
            + 1
          </button>

          <button
            onPointerDown={() => handleScore('home', -1)}
            disabled={finalized || finalizing || homeScore === 0}
            aria-label="Undo point for home team"
            style={{
              height: '4rem',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              borderLeft: 'none',
              borderRight: 'none',
              borderBottom: 'none',
              color: (finalized || homeScore === 0) ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.35)',
              fontSize: '0.625rem',
              letterSpacing: '0.1em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: (finalized || homeScore === 0) ? 'default' : 'pointer',
              background: 'transparent',
              WebkitTapHighlightColor: 'transparent',
              transition: 'color 0.1s',
            }}
          >
            UNDO
          </button>
        </div>

        {/* Away */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 0.5rem' }}>
            <div className="text-hud-xs text-white/40 uppercase tracking-widest" style={{ marginBottom: '0.5rem', textAlign: 'center', lineHeight: 1.3 }}>
              {awayName}
            </div>
            <div
              className="text-score-lg text-logic-lime tabular-nums"
              style={{ fontWeight: 700, lineHeight: 1 }}
            >
              {awayScore}
            </div>
          </div>

          <button
            onPointerDown={() => handleScore('away', 1)}
            disabled={finalized || finalizing}
            aria-label="Add point for away team"
            style={{
              height: '9rem',
              minHeight: '144px',
              background: finalized ? 'rgba(255,255,255,0.03)' : 'rgba(30,58,138,0.2)',
              borderTop: `1px solid ${finalized ? 'rgba(255,255,255,0.08)' : '#1E3A8A'}`,
              borderLeft: 'none',
              borderRight: 'none',
              borderBottom: 'none',
              color: finalized ? 'rgba(255,255,255,0.2)' : '#D9F99D',
              fontSize: '2rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: finalized ? 'default' : 'pointer',
              WebkitTapHighlightColor: 'transparent',
              transition: 'background 0.1s',
            }}
            onPointerEnter={e => { if (!finalized) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(30,58,138,0.5)'; }}
            onPointerLeave={e => { if (!finalized) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(30,58,138,0.2)'; }}
          >
            + 1
          </button>

          <button
            onPointerDown={() => handleScore('away', -1)}
            disabled={finalized || finalizing || awayScore === 0}
            aria-label="Undo point for away team"
            style={{
              height: '4rem',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              borderLeft: 'none',
              borderRight: 'none',
              borderBottom: 'none',
              color: (finalized || awayScore === 0) ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.35)',
              fontSize: '0.625rem',
              letterSpacing: '0.1em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: (finalized || awayScore === 0) ? 'default' : 'pointer',
              background: 'transparent',
              WebkitTapHighlightColor: 'transparent',
              transition: 'color 0.1s',
            }}
          >
            UNDO
          </button>
        </div>
      </div>

      {/* Bottom controls */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={() => !finalized && setPeriodIdx(i => (i + 1) % PERIODS.length)}
          disabled={finalized}
          aria-label="Advance period"
          style={{
            fontFamily: 'inherit',
            fontSize: '0.625rem',
            letterSpacing: '0.1em',
            color: finalized ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.45)',
            border: `1px solid ${finalized ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)'}`,
            padding: '0.5rem 1rem',
            background: 'transparent',
            cursor: finalized ? 'default' : 'pointer',
            textTransform: 'uppercase' as const,
          }}
        >
          PERIOD {PERIODS[periodIdx]}
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
          {saveError && (
            <span style={{ fontSize: '0.625rem', letterSpacing: '0.05em', color: '#F87171' }}>{saveError}</span>
          )}
          {finalized ? (
            <span className="text-hud-xs text-logic-lime uppercase tracking-widest" style={{ padding: '0.5rem 1.5rem', border: '1px solid #D9F99D' }}>
              ✓ SAVED
            </span>
          ) : (
            <button
              onClick={handleFinal}
              disabled={finalizing}
              aria-label="Mark game as final"
              style={{
                fontFamily: 'inherit',
                fontSize: '0.625rem',
                letterSpacing: '0.1em',
                color: finalizing ? 'rgba(217,249,157,0.4)' : '#D9F99D',
                border: `1px solid ${finalizing ? 'rgba(217,249,157,0.3)' : '#D9F99D'}`,
                padding: '0.5rem 1.5rem',
                background: 'transparent',
                cursor: finalizing ? 'default' : 'pointer',
                textTransform: 'uppercase' as const,
                transition: 'opacity 0.1s',
              }}
            >
              {finalizing ? 'SAVING…' : 'FINAL'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
