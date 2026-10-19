'use client';
import { useEffect, useState, useCallback, type CSSProperties } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { Users, Trophy, Megaphone, TrendingUp } from 'lucide-react';
import type { ActivityEvent } from '@/app/api/admin/tournament-activity/route';
import { KIT_INK } from '@/components/admin/kit/kit-inline';

type EnrichedEvent = ActivityEvent & { timeAgo: string };

// Each kind's ink on the kit: registration is an INFO fact; a score and a final are the brand accent (the "done" ink
// used elsewhere on the kit); an announcement takes the quietest ink.
const TYPE_CONFIG = {
  registration:  { icon: Users,      ink: KIT_INK.info,     label: 'Registration' },
  score:         { icon: TrendingUp, ink: KIT_INK.accent,   label: 'Score'        },
  game_complete: { icon: Trophy,     ink: KIT_INK.accent,   label: 'Final'        },
  announcement:  { icon: Megaphone,  ink: KIT_INK.tertiary, label: 'Announcement' },
};

// The feed's look on the kit — its old look retired with the board it sits on (Tournament admin redesign Stage 5): the
// kit's patch folded onto the styles it was laid over, so nothing moved.
const HEADING_STYLE: CSSProperties = { fontSize: 'var(--type-heading)', fontWeight: 700, marginBottom: '1rem', ...KIT_INK.secondary };
const ROW_STYLE: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.6rem 0', borderBottom: '1px solid var(--home-line)' };
const LAST_ROW_STYLE: CSSProperties = { ...ROW_STYLE, borderBottom: 'none' };
const ICON_BOX_STYLE: CSSProperties = { width: 28, height: 28, borderRadius: '2px', background: 'var(--home-olive-soft)', border: '1px solid var(--home-line-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const MESSAGE_STYLE: CSSProperties = { fontSize: '0.82rem', lineHeight: 1.4, ...KIT_INK.secondary };
const TIME_STYLE: CSSProperties = { fontSize: 'var(--type-support)', marginTop: '0.1rem', ...KIT_INK.tertiary };

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

// `className` is the host's frame: it is drawn only when the feed has something in it, so an empty
// feed leaves no empty bordered box behind (F04, J1-099).
export function LiveEventLog({ tournamentId, orgSlug, className }: { tournamentId: string; orgSlug?: string; className?: string }) {
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
          // bracket save). Treat "previous value unknown" as "no change".
          const prevScoreKnown = prev.home_score !== undefined && prev.away_score !== undefined;
          // A reverted score is cleared, not 0 – 0. The history lists only games that carry a score,
          // so a reload shows no line for this game: drop its lines here too rather than log one.
          const scoreCleared = prevScoreKnown
            && (prev.home_score != null || prev.away_score != null)
            && next.home_score == null && next.away_score == null;
          if (scoreCleared) {
            setEvents(list => list.filter(e => e.id !== `gc-${id}` && e.id !== `sc-${id}`));
          } else if (prev.status !== undefined && prev.status !== 'completed' && next.status === 'completed') {
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
      // No live `announcements` binding: that table is not in the realtime publication, and Realtime
      // rejects a binding on an unpublished table — which takes down EVERY binding on the channel, so
      // this feed never updated live on either env until it was removed (2026-09-28, mig 310 review).
      // New announcements still arrive through fetchHistory() on load.
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
    <div className={className}>
      <h2 style={HEADING_STYLE}>
        Recent activity
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0', maxHeight: '320px', overflowY: 'auto' }}>
      {events.map((event, i) => {
        const Icon = TYPE_CONFIG[event.type].icon;
        return (
          // The divider sits between rows only — the last row has none, switch on or off.
          <div key={event.id} style={i < events.length - 1 ? ROW_STYLE : LAST_ROW_STYLE}>
            <div style={ICON_BOX_STYLE}>
              <Icon size={13} style={TYPE_CONFIG[event.type].ink} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={MESSAGE_STYLE}>{event.message}</div>
              <div style={TIME_STYLE}>{event.timeAgo}</div>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
