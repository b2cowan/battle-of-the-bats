'use client';
/**
 * components/public/GameDetailLiveRefresher.tsx
 * Keeps the server-rendered game-detail page live without duplicating its UI:
 * polls the public schedule data on game day and calls router.refresh() only
 * when this game's score/status actually changes. Renders nothing.
 */
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { fetchPublicTournamentData } from '@/lib/public-tournament-client';

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  gameId: string;
  /** "homeScore:awayScore:status" computed server-side at render time. */
  initialSignature: string;
  /** Gate — only poll while the tournament is in progress. */
  enabled: boolean;
  intervalMs?: number;
}

export default function GameDetailLiveRefresher({
  orgSlug,
  tournamentSlug,
  gameId,
  initialSignature,
  enabled,
  intervalMs = 30_000,
}: Props) {
  const router = useRouter();
  const signatureRef = useRef(initialSignature);

  useEffect(() => {
    signatureRef.current = initialSignature;
  }, [initialSignature]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof document === 'undefined') return;
    let cancelled = false;

    async function tick() {
      if (document.visibilityState === 'hidden') return;
      try {
        const data = await fetchPublicTournamentData(orgSlug, tournamentSlug, 'schedule');
        const game = data?.games.find(g => g.id === gameId);
        if (!game) return;
        const signature = `${game.homeScore ?? ''}:${game.awayScore ?? ''}:${game.status}`;
        if (!cancelled && signature !== signatureRef.current) {
          signatureRef.current = signature;
          router.refresh();
        }
      } catch {
        /* transient — retry next tick */
      }
    }

    const intervalId = window.setInterval(tick, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [orgSlug, tournamentSlug, gameId, enabled, intervalMs, router]);

  return null;
}
