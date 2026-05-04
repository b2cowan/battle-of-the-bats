'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { cn } from '@/lib/utils';

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'SCORE_UPDATE' | 'GAME_COMPLETE' | 'TEAM_REGISTERED' | 'SYSTEM';
  message: string;
}

export function LiveEventLog({ tournamentId }: { tournamentId: string }) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (!tournamentId) return;

    const channel = supabase
      .channel(`org-events-${tournamentId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `tournament_id=eq.${tournamentId}` },
        (payload) => {
          const prev = payload.old;
          const next = payload.new;

          // Score changed
          if (prev.home_score !== next.home_score || prev.away_score !== next.away_score) {
            const entry: LogEntry = {
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              type: 'SCORE_UPDATE',
              message: `GAME_ID:${String(next.id).slice(0, 8)} · HOME ${next.home_score ?? 0} – ${next.away_score ?? 0} AWAY`,
            };
            setEntries(prev => [entry, ...prev].slice(0, 50));
          }

          // Game completed
          if (prev.status !== 'completed' && next.status === 'completed') {
            const entry: LogEntry = {
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              type: 'GAME_COMPLETE',
              message: `GAME_ID:${String(next.id).slice(0, 8)} · FINAL ${next.home_score ?? 0}–${next.away_score ?? 0}`,
            };
            setEntries(prev => [entry, ...prev].slice(0, 50));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'teams', filter: `tournament_id=eq.${tournamentId}` },
        (payload) => {
          const entry: LogEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            type: 'TEAM_REGISTERED',
            message: `NEW_TEAM · ${payload.new.name} · AGE_GROUP:${String(payload.new.age_group_id ?? '').slice(0, 8)}`,
          };
          setEntries(prev => [entry, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tournamentId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
      {entries.length === 0 && (
        <div className="text-data-gray/50">// Awaiting system events...</div>
      )}
      {entries.map(entry => (
        <div key={entry.id} className="flex gap-3 items-start animate-hud-boot">
          <span className="text-blueprint-light shrink-0">
            {new Date(entry.timestamp).toLocaleTimeString('en-CA', { hour12: false })}
          </span>
          <span className={cn(
            'shrink-0 font-bold',
            (entry.type === 'SCORE_UPDATE' || entry.type === 'GAME_COMPLETE') && 'text-logic-lime',
            entry.type === 'TEAM_REGISTERED' && 'text-blueprint-light',
            entry.type === 'SYSTEM' && 'text-data-gray',
          )}>
            [{entry.type}]
          </span>
          <span className="text-fl-text/70">{entry.message}</span>
        </div>
      ))}
    </div>
  );
}
