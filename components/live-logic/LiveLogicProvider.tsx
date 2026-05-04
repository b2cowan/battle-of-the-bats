'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { useTournament } from '@/lib/tournament-context';

export interface LiveLogicEvent {
  id: string;
  type: 'SCORE_UPDATE' | 'GAME_COMPLETE' | 'TEAM_REGISTERED' | 'SYSTEM';
  title: string;
  detail: string;
  timestamp: Date;
}

const LiveLogicContext = createContext<{
  events: LiveLogicEvent[];
  dismiss: (id: string) => void;
}>({ events: [], dismiss: () => {} });

export function LiveLogicProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<LiveLogicEvent[]>([]);
  const { currentTournament } = useTournament();
  const supabase = createClient();

  const push = useCallback((event: Omit<LiveLogicEvent, 'id' | 'timestamp'>) => {
    const entry: LiveLogicEvent = { ...event, id: crypto.randomUUID(), timestamp: new Date() };
    setEvents(prev => [entry, ...prev].slice(0, 8));
    setTimeout(() => setEvents(prev => prev.filter(e => e.id !== entry.id)), 6000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  }, []);

  useEffect(() => {
    const tournamentId = currentTournament?.id;
    if (!tournamentId) return;

    const channel = supabase
      .channel(`live-logic-${tournamentId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `tournament_id=eq.${tournamentId}` },
        ({ old: prev, new: next }) => {
          const scoreChanged =
            prev.home_score !== next.home_score || prev.away_score !== next.away_score;
          const justCompleted = prev.status !== 'completed' && next.status === 'completed';

          if (justCompleted) {
            // completed games get one GAME_COMPLETE notification that already shows the score
            push({
              type: 'GAME_COMPLETE',
              title: `FINAL · GAME_${String(next.id ?? '').slice(0, 6).toUpperCase()}`,
              detail: `Score: ${next.home_score ?? 0}–${next.away_score ?? 0}`,
            });
          } else if (scoreChanged) {
            // score edited on an already-completed game (status stays completed)
            push({
              type: 'SCORE_UPDATE',
              title: `GAME_${String(next.id ?? '').slice(0, 6).toUpperCase()}`,
              detail: `HOME ${next.home_score ?? 0} – ${next.away_score ?? 0} AWAY`,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'teams', filter: `tournament_id=eq.${tournamentId}` },
        ({ new: next }) => {
          push({
            type: 'TEAM_REGISTERED',
            title: 'NEW TEAM REGISTERED',
            detail: next.name ?? 'Unknown team',
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentTournament?.id, push]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <LiveLogicContext.Provider value={{ events, dismiss }}>
      {children}
    </LiveLogicContext.Provider>
  );
}

export function useLiveLogic() {
  return useContext(LiveLogicContext);
}
