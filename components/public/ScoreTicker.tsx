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
import { formatTime } from '@/lib/utils';
import { isGameLive, DEFAULT_GAME_DURATION_MINUTES } from '@/lib/game-status';
import { bracketRoundLabel } from '@/lib/playoff-bracket';
import { useTodaysTournamentGames, teamShort, isPendingPlayoffSlot } from '@/lib/hooks/useTodaysTournamentGames';
import styles from './ScoreTicker.module.css';

/** Today's frame only. Under the new frame (Public tournament pages Stage 1, lib/public-frame.ts) the layout mounts
 *  TodaysResultsLine instead; this strip retires when Stage 8 turns the frame on for everyone. */
export default function ScoreTicker() {
  const { tournamentSlug, teams, todayGames: games, gameHref } = useTodaysTournamentGames();
  // Touch-hold pauses the marquee — the finger-down equivalent of the existing
  // hover/focus pause (CSS alone can't persist a hold across pointer events).
  const [touching, setTouching] = useState(false);
  const stopTouch = () => setTouching(false);

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

  const todayGames = useMemo(
    () => [...games]
      .sort((a, b) => {
        const aLive = isGameLive(a, a.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES) ? 0 : 1;
        const bLive = isGameLive(b, b.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES) ? 0 : 1;
        if (aLive !== bLive) return aLive - bLive;
        return (a.time ?? '').localeCompare(b.time ?? '');
      }),
    [games],
  );

  const show = todayGames.length > 0;

  // Reserve space so fixed page chrome (.hero / .page-content top padding) clears
  // the ticker only while it's actually visible — full strip (40px) when expanded,
  // slim restore bar (24px) when minimized.
  //
  // `data-ticker` is the same idiom one level up: an attribute on <html> announcing that this
  // strip is on screen NAMING TODAY'S SCORES, so chrome above it can stand down rather than say
  // the same thing twice. Set only when expanded — minimized, the strip is a "Live scores" button
  // with no score in it, so anything that deferred to it should come back.
  useEffect(() => {
    const el = document.documentElement;
    if (show) el.style.setProperty('--ticker-h', minimized ? '24px' : '40px');
    else el.style.removeProperty('--ticker-h');
    if (show && !minimized) el.dataset.ticker = 'scores';
    else delete el.dataset.ticker;
    return () => {
      el.style.removeProperty('--ticker-h');
      delete el.dataset.ticker;
    };
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
    const pending = isPendingPlayoffSlot(g);
    return {
      id: g.id,
      href: gameHref(g.id),
      away: teamShort(g.awayTeamId, g.awayPlaceholder, teams),
      home: teamShort(g.homeTeamId, g.homePlaceholder, teams),
      awayScore: g.awayScore,
      homeScore: g.homeScore,
      scored,
      pending,
      round: pending ? bracketRoundLabel(g.bracketCode) : null,
      isLive: !pending && isGameLive(g, g.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES),
      isFinal: g.status === 'completed' && scored,
      time: g.time,
    };
  });
  // Duplicate the set so the marquee can loop seamlessly (translateX 0 → -50%).
  const loop = [...items, ...items];

  return (
    <div
      className={styles.ticker}
      role="region"
      aria-label="Today's games"
      data-touching={touching ? 'true' : undefined}
      onPointerDown={() => setTouching(true)}
      onPointerUp={stopTouch}
      onPointerCancel={stopTouch}
      onPointerLeave={stopTouch}
    >
      <div className={styles.track}>
        {loop.map((it, i) => (
          <Link
            key={`${it.id}-${i}`}
            href={it.href}
            className={styles.item}
            aria-hidden={i >= items.length ? true : undefined}
            tabIndex={i >= items.length ? -1 : undefined}
          >
            {it.pending ? (
              <>
                <span className={styles.team}>{it.round}</span>
                <span className={styles.dash}>·</span>
                <span className={styles.time}>{it.time ? formatTime(it.time) : 'TBD'}</span>
              </>
            ) : (
              <>
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
              </>
            )}
          </Link>
        ))}
      </div>
      <button type="button" className={styles.dismissBtn} onClick={minimize} aria-label="Hide live scores ticker">
        <X size={14} />
      </button>
    </div>
  );
}
