'use client';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { Users, Trophy, Megaphone, TrendingUp } from 'lucide-react';
import type { ActivityEvent } from '@/app/api/admin/tournament-activity/route';

type EnrichedEvent = ActivityEvent & { timeAgo: string };

const TYPE_CONFIG = {
  registration:  { icon: Users,      color: 'var(--blueprint-blue)',  label: 'Registration' },
  score:         { icon: TrendingUp,  color: 'var(--logic-lime)',      label: 'Score'        },
  game_complete: { icon: Trophy,      color: 'var(--logic-lime)',      label: 'Final'        },
  announcement:  { icon: Megaphone,   color: 'rgba(148,163,184,0.7)',  label: 'Announcement' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function LiveEventLog({ tournamentId, orgSlug }: { tournamentId: string; orgSlug?: string }) {
  const [events, setEvents] = useState<EnrichedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';
      const res = await fetch(`/api/admin/tournament-activity?tournamentId=${tournamentId}&limit=30${orgParam}`);
      if (res.ok) setEvents(await res.json());
    } finally {
      setLoading(false);
    }
  }, [tournamentId, orgSlug]);

  useEffect(() => { void fetchHistory(); }, [fetchHistory]);

  useEffect(() => {
    if (!tournamentId) return;

    const channel = supabase
      .channel(`activity-${tournamentId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `tournament_id=eq.${tournamentId}` },
        (payload) => {
          const prev = payload.old as Record<string, unknown>;
          const next = payload.new as Record<string, unknown>;
          const id = String(next.id);
          const home = next.home_score ?? 0;
          const away = next.away_score ?? 0;
          const now = new Date().toISOString();

          // `prev` (realtime `old`) only carries previous column values when `games` has
          // REPLICA IDENTITY FULL (migration 132). Without it Postgres logs only the PK, so
          // prev.status / prev.*_score arrive `undefined` and every comparison reads as a
          // change — logging a false "Score updated: 0 – 0" on every game write (e.g. a
          // bracket save). Treat "previous value unknown" as "no change". Mirrors the guard
          // in components/live-logic/LiveLogicProvider.tsx.
          const prevScoreKnown = prev.home_score !== undefined && prev.away_score !== undefined;
          if (prev.status !== undefined && prev.status !== 'completed' && next.status === 'completed') {
            prepend({ id: `gc-${id}`, type: 'game_complete', message: `Game final: ${home} – ${away}`, timestamp: now, timeAgo: 'just now' });
          } else if (prevScoreKnown && (prev.home_score !== next.home_score || prev.away_score !== next.away_score)) {
            prepend({ id: `sc-${id}`, type: 'score', message: `Score updated: ${home} – ${away}`, timestamp: now, timeAgo: 'just now' });
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'teams', filter: `tournament_id=eq.${tournamentId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const name = String(row.name ?? 'Unknown team');
          prepend({ id: `reg-${String(row.id)}`, type: 'registration', message: `${name} registered`, timestamp: new Date().toISOString(), timeAgo: 'just now' });
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcements', filter: `tournament_id=eq.${tournamentId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          prepend({ id: `ann-${String(row.id)}`, type: 'announcement', message: `Announcement posted: "${String(row.title ?? '')}"`, timestamp: new Date().toISOString(), timeAgo: 'just now' });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tournamentId]); // eslint-disable-line react-hooks/exhaustive-deps

  function prepend(event: EnrichedEvent) {
    setEvents(prev => [event, ...prev.filter(e => e.id !== event.id)].slice(0, 50));
  }

  if (loading || events.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-data)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--logic-lime)', marginBottom: '1rem' }}>
        Recent Activity
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0', maxHeight: '320px', overflowY: 'auto' }}>
      {events.map((event, i) => {
        const cfg = TYPE_CONFIG[event.type];
        const Icon = cfg.icon;
        return (
          <div
            key={event.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '0.6rem 0',
              borderBottom: i < events.length - 1 ? '1px solid var(--white-5)' : 'none',
            }}
          >
            <div style={{ width: 28, height: 28, borderRadius: '2px', background: 'var(--white-5)', border: '1px solid var(--white-8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={13} style={{ color: cfg.color }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--white-75)', lineHeight: 1.4 }}>{event.message}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--white-30)', marginTop: '0.1rem' }}>{event.timeAgo}</div>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
