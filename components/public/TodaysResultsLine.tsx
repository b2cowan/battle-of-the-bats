'use client';
/**
 * components/public/TodaysResultsLine.tsx
 * Today's games, one at a time — the new frame's ticker (Public tournament pages Stage 1, behind the preview switch,
 * lib/public-frame.ts). Owner ruling 2026-10-28 (build prompt Part 4 step 2): option F's behaviour in option D's look.
 *
 * One still 44 px line under the tab row. Each game fades in, holds, and fades out; the state word is one of three —
 * Live, Final, or the start time of a game later today. On opening it goes through the day once, then rests on the
 * newest result; a result that lands while the page is open fades in marked New and rests there. Nothing moves the rest
 * of the time. A finger, a pointer or keyboard focus on the line holds it; tapping opens the game shown. The × is the
 * only control: it hides the line for the rest of that day on that device (the next game day it is back). Reduced
 * motion shows the newest result, still. Scores are mostly entered after games, which is why the reel leads with
 * results rather than animating live scores.
 *
 * The followed team's game is not left out: the reel is the day's, and the My Team dock is the family's.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { formatTime } from '@/lib/utils';
import { publicGameStatus, isGameUpcoming, DEFAULT_GAME_DURATION_MINUTES } from '@/lib/game-status';
import { bracketRoundLabel } from '@/lib/playoff-bracket';
import { useTodaysTournamentGames, teamShort, isPendingPlayoffSlot } from '@/lib/hooks/useTodaysTournamentGames';
import styles from './TodaysResultsLine.module.css';

const HOLD_MS = 5000;
const FADE_MS = 400; // the CSS transition on .game
const RESULTS_KEPT = 8; // a busy day keeps the latest results; the rest are on the Schedule
const NEXT_KEPT = 3;

type LineGame = {
  id: string;
  href: string;
  kind: 'live' | 'final' | 'later';
  time: string | null;
  away: string;
  home: string;
  awayScore: number | null;
  homeScore: number | null;
  /** A playoff slot whose teams are not known yet: its round is shown in place of the teams. */
  round: string | null;
  winner: 'away' | 'home' | null;
};

/** The state word: Live, Final, or a later game's start time (a game with no time is never "later" — it has no start). */
function wordFor(g: LineGame): string {
  return g.kind === 'live' ? 'Live' : g.kind === 'final' ? 'Final' : formatTime(g.time ?? '');
}

function lineLabel(g: LineGame): string {
  const word = wordFor(g);
  if (g.round) return `${word}: ${g.round}`;
  const scored = g.awayScore != null && g.homeScore != null;
  return scored
    ? `${word}: ${g.away} ${g.awayScore}, ${g.home} ${g.homeScore}`
    : `${word}: ${g.away} vs ${g.home}`;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export default function TodaysResultsLine() {
  const { tournamentSlug, today, teams, todayGames, requireFinalization, gameHref } = useTodaysTournamentGames();

  // Re-sort once a minute so a game that starts moves from its time to Live without waiting for a score.
  const [clock, setClock] = useState(0);
  useEffect(() => {
    if (todayGames.length === 0) return;
    const t = setInterval(() => setClock(c => c + 1), 60_000);
    return () => clearInterval(t);
  }, [todayGames.length]);

  // Today's results, newest first; then every game on now; then the next to start. A score waiting for the organizer's
  // confirmation is not in the reel (the state words are three); it joins as Final once confirmed.
  const reel = useMemo<LineGame[]>(() => {
    void clock;
    const now = new Date();
    const results: LineGame[] = [];
    const live: LineGame[] = [];
    const later: LineGame[] = [];
    for (const g of todayGames) {
      const pending = isPendingPlayoffSlot(g);
      const state = publicGameStatus(g, g.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES, requireFinalization, now);
      const scored = g.homeScore != null && g.awayScore != null;
      const base = {
        id: g.id,
        href: gameHref(g.id),
        time: g.time || null,
        away: teamShort(g.awayTeamId, g.awayPlaceholder, teams),
        home: teamShort(g.homeTeamId, g.homePlaceholder, teams),
        awayScore: scored ? g.awayScore ?? null : null,
        homeScore: scored ? g.homeScore ?? null : null,
        round: pending ? bracketRoundLabel(g.bracketCode) : null,
      };
      if (state === 'final' && scored && !pending) {
        const winner = g.awayScore! > g.homeScore! ? 'away' : g.homeScore! > g.awayScore! ? 'home' : null;
        results.push({ ...base, kind: 'final', winner });
      } else if (state === 'live' && !pending) {
        live.push({ ...base, kind: 'live', winner: null });
      } else if (state === 'upcoming' && isGameUpcoming(g, now)) {
        later.push({ ...base, kind: 'later', awayScore: null, homeScore: null, winner: null });
      }
    }
    const byTime = (a: LineGame, b: LineGame) => (a.time ?? '').localeCompare(b.time ?? '');
    return [
      ...results.sort((a, b) => byTime(b, a)).slice(0, RESULTS_KEPT),
      ...live.sort(byTime),
      ...later.sort(byTime).slice(0, NEXT_KEPT),
    ];
    // gameHref is rebuilt each render from stable inputs; the games and teams are what change the reel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayGames, teams, requireFinalization, clock]);

  // The × — hidden for the rest of the tournament's day on this device. `undefined` until storage is read, so the line
  // never draws and then vanishes.
  const hideKey = tournamentSlug ? `flhq-results-line-hidden-${tournamentSlug}` : '';
  const [hiddenOn, setHiddenOn] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!hideKey) return;
    let stored: string | null = null;
    try { stored = localStorage.getItem(hideKey); } catch { /* storage unavailable: show the line */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHiddenOn(stored);
  }, [hideKey]);
  function hide() {
    setHiddenOn(today);
    try { localStorage.setItem(hideKey, today); } catch { /* ignore */ }
  }

  const show = reel.length > 0 && hiddenOn !== undefined && hiddenOn !== today;

  // ── The reel ────────────────────────────────────────────────────────────────────────────────────────────────────
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [mode, setMode] = useState<'cycle' | 'rest'>('rest');
  const [out, setOut] = useState(false);
  const [newId, setNewId] = useState<string | null>(null);
  const [pointerHeld, setPointerHeld] = useState(false);
  const [focusHeld, setFocusHeld] = useState(false);
  const held = pointerHeld || focusHeld;

  const reelRef = useRef(reel);
  useEffect(() => { reelRef.current = reel; }, [reel]);
  const seenResults = useRef<Set<string> | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function goTo(id: string) {
    setNewId(n => (n === id ? n : null));
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    if (prefersReducedMotion()) { setOut(false); setCurrentId(id); return; }
    setOut(true);
    fadeTimer.current = setTimeout(() => { setCurrentId(id); setOut(false); }, FADE_MS);
  }
  useEffect(() => () => { if (fadeTimer.current) clearTimeout(fadeTimer.current); }, []);

  // The first pass, once there is something to show; then a result that lands while the page is open.
  useEffect(() => {
    if (!show) return;
    const resultIds = reel.filter(g => g.kind === 'final').map(g => g.id);
    if (seenResults.current === null) {
      seenResults.current = new Set(resultIds);
      setCurrentId(reel[0].id);
      setMode(!prefersReducedMotion() && reel.length > 1 ? 'cycle' : 'rest');
      return;
    }
    const arrived = resultIds.filter(id => !seenResults.current!.has(id));
    arrived.forEach(id => seenResults.current!.add(id));
    if (arrived.length > 0) {
      setMode('rest');
      setNewId(arrived[0]);
      goTo(arrived[0]);
    }
  }, [show, reel]);

  // One step of the pass: hold, then the next game; after the last, rest on the newest.
  useEffect(() => {
    if (!show || mode !== 'cycle' || held || out || !currentId) return;
    const t = setTimeout(() => {
      const list = reelRef.current;
      const i = list.findIndex(g => g.id === currentId);
      if (i >= 0 && i + 1 < list.length) goTo(list[i + 1].id);
      else { setMode('rest'); if (list[0]) goTo(list[0].id); }
    }, HOLD_MS);
    return () => clearTimeout(t);
  }, [show, mode, held, out, currentId]);

  // Reserve the line's height for chrome that rides under the pinned rows, as today's ticker does.
  useEffect(() => {
    const el = document.documentElement;
    if (show) {
      el.style.setProperty('--ticker-h', '45px'); // 44 px line + its hairline
      el.dataset.ticker = 'scores';
    } else {
      el.style.removeProperty('--ticker-h');
      delete el.dataset.ticker;
    }
    return () => {
      el.style.removeProperty('--ticker-h');
      delete el.dataset.ticker;
    };
  }, [show]);

  if (!show) return null;
  const g = reel.find(x => x.id === currentId) ?? reel[0];
  const scored = g.awayScore != null && g.homeScore != null;

  return (
    <div
      className={styles.line}
      role="region"
      aria-label="Today's games"
      onPointerEnter={() => setPointerHeld(true)}
      onPointerLeave={() => setPointerHeld(false)}
      onPointerCancel={() => setPointerHeld(false)}
    >
      <Link
        href={g.href}
        className={`${styles.game}${out ? ` ${styles.out}` : ''}`}
        aria-label={lineLabel(g)}
        onFocus={e => setFocusHeld(e.currentTarget.matches(':focus-visible'))}
        onBlur={() => setFocusHeld(false)}
      >
        <span className={g.kind === 'live' ? `${styles.word} ${styles.live}` : styles.word}>
          {g.kind === 'live' && <span className={styles.dot} aria-hidden="true" />}
          {wordFor(g)}
        </span>
        {g.id === newId && <span className={styles.new}>New</span>}
        <span className={styles.sep} aria-hidden="true">·</span>
        {g.round ? (
          <span className={styles.team}>{g.round}</span>
        ) : (
          <>
            <span className={g.winner === 'home' ? `${styles.team} ${styles.lost}` : styles.team}>{g.away}</span>
            {scored
              ? <span className={styles.score}>{g.awayScore}–{g.homeScore}</span>
              : <span className={styles.vs}>vs</span>}
            <span className={g.winner === 'away' ? `${styles.team} ${styles.lost}` : styles.team}>{g.home}</span>
          </>
        )}
      </Link>
      <button type="button" className={styles.close} onClick={hide} aria-label="Hide today's games">
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
