'use client';
/**
 * components/public/ScoreTicker.tsx
 * Broadcast-style score ticker. On game day a strip under the top bar scrolls
 * today's games — LIVE (pulsing) / FINAL / upcoming tip-off time — each linking
 * to the game. Self-gating: it only renders (and reserves `--ticker-h` so page
 * content clears it) when there ARE games today; pre-event/idle days incur no
 * work. Desktop offsets past the left rail. Reduced-motion → static scrollable.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { X, ChevronRight } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useOrgNav } from '@/components/OrgNavContext';
import { usePublicTournamentLive } from '@/lib/hooks/usePublicTournamentLive';
import { fetchPublicTournamentData } from '@/lib/public-tournament-client';
import { formatTime } from '@/lib/utils';
import { isGameLive, DEFAULT_GAME_DURATION_MINUTES } from '@/lib/game-status';
import { tournamentToday } from '@/lib/timezone';
import type { Game, PublicTeam } from '@/lib/types';
import styles from './ScoreTicker.module.css';

function teamShort(id: string | null | undefined, placeholder: string | null | undefined, teams: PublicTeam[]): string {
  const n = teams.find(t => t.id === id)?.name ?? placeholder ?? 'TBD';
  return n.replace(/\s*\([^)]*\)\s*/g, '').trim() || n;
}

export default function ScoreTicker() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) || '';
  const tournamentSlug = (params?.tournamentSlug as string) || '';
  const { tournamentStartDate, tournamentEndDate, tournamentStatus } = useOrgNav();

  const today = tournamentToday();
  const inWindow = !!tournamentStartDate && !!tournamentEndDate &&
    tournamentStatus !== 'completed' && tournamentStatus !== 'cancelled' &&
    today >= tournamentStartDate && today <= tournamentEndDate;
  const active = inWindow && !!orgSlug && !!tournamentSlug;

  const [teams, setTeams] = useState<PublicTeam[]>([]);
  const [games, setGames] = useState<Game[]>([]);

  // Per-tournament minimize preference — persists until the fan restores it.
  const minimizeKey = tournamentSlug ? `flhq-ticker-min-${tournamentSlug}` : '';
  const [minimized, setMinimized] = useState(false);
  useEffect(() => {
    if (!minimizeKey) return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMinimized(localStorage.getItem(minimizeKey) === '1');
    } catch { /* storage unavailable — default to expanded */ }
  }, [minimizeKey]);

  function minimize() {
    setMinimized(true);
    try { localStorage.setItem(minimizeKey, '1'); } catch { /* ignore */ }
  }
  function restore() {
    setMinimized(false);
    try { localStorage.removeItem(minimizeKey); } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void fetchPublicTournamentData(orgSlug, tournamentSlug, 'schedule').then(d => {
      if (cancelled || !d) return;
      setTeams(d.teams ?? []);
      setGames(d.games ?? []);
    });
    return () => { cancelled = true; };
  }, [active, orgSlug, tournamentSlug]);

  usePublicTournamentLive({
    orgSlug,
    tournamentSlug,
    section: 'schedule',
    enabled: active,
    onData: d => { setTeams(d.teams ?? []); setGames(d.games ?? []); },
  });

  const todayGames = useMemo(
    () => games
      .filter(g => g.date === today && g.status !== 'cancelled')
      .sort((a, b) => {
        const aLive = isGameLive(a, a.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES) ? 0 : 1;
        const bLive = isGameLive(b, b.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES) ? 0 : 1;
        if (aLive !== bLive) return aLive - bLive;
        return (a.time ?? '').localeCompare(b.time ?? '');
      }),
    [games, today],
  );

  const show = active && todayGames.length > 0;

  // Reserve space so fixed page chrome (.hero / .page-content top padding) clears
  // the ticker only while it's actually visible — full strip (40px) when expanded,
  // slim restore bar (24px) when minimized.
  useEffect(() => {
    const el = document.documentElement;
    if (show) el.style.setProperty('--ticker-h', minimized ? '24px' : '40px');
    else el.style.removeProperty('--ticker-h');
    return () => { el.style.removeProperty('--ticker-h'); };
  }, [show, minimized]);

  if (!show) return null;

  // Minimized — slim static restore bar in the same position (no motion).
  if (minimized) {
    return (
      <div className={styles.tickerMin}>
        <button type="button" className={styles.restoreBtn} onClick={restore} aria-label="Show live scores ticker">
          <span className={styles.restoreDot} /> Live scores
          <ChevronRight size={13} />
        </button>
      </div>
    );
  }

  const items = todayGames.map(g => {
    const scored = g.homeScore != null && g.awayScore != null;
    return {
      id: g.id,
      href: `/${orgSlug}/${tournamentSlug}/schedule/${g.id}`,
      away: teamShort(g.awayTeamId, g.awayPlaceholder, teams),
      home: teamShort(g.homeTeamId, g.homePlaceholder, teams),
      awayScore: g.awayScore,
      homeScore: g.homeScore,
      scored,
      isLive: isGameLive(g, g.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES),
      isFinal: g.status === 'completed' && scored,
      time: g.time,
    };
  });
  // Duplicate the set so the marquee can loop seamlessly (translateX 0 → -50%).
  const loop = [...items, ...items];

  return (
    <div className={styles.ticker} role="region" aria-label="Today's games">
      <div className={styles.track}>
        {loop.map((it, i) => (
          <Link
            key={`${it.id}-${i}`}
            href={it.href}
            className={styles.item}
            aria-hidden={i >= items.length ? true : undefined}
            tabIndex={i >= items.length ? -1 : undefined}
          >
            {it.isLive && <span className={styles.live}><span className={styles.dot} />LIVE</span>}
            {it.isFinal && <span className={styles.final}>FINAL</span>}
            {!it.scored && !it.isLive && <span className={styles.time}>{it.time ? formatTime(it.time) : 'TBD'}</span>}
            <span className={styles.team}>{it.away}</span>
            {it.scored ? (
              <>
                <span className={styles.score}>{it.awayScore}</span>
                <span className={styles.dash}>–</span>
                <span className={styles.score}>{it.homeScore}</span>
              </>
            ) : (
              <span className={styles.vs}>vs</span>
            )}
            <span className={styles.team}>{it.home}</span>
          </Link>
        ))}
      </div>
      <button type="button" className={styles.dismissBtn} onClick={minimize} aria-label="Hide live scores ticker">
        <X size={14} />
      </button>
    </div>
  );
}
