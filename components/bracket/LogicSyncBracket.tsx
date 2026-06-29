'use client';

import { useEffect, useRef, useState } from 'react';
import { Trophy, Minus, Plus, Maximize } from 'lucide-react';
import { createClient } from '@/lib/supabase-browser';
import { formatPoolName, formatTime } from '@/lib/utils';
import type { Game, PublicTeam } from '@/lib/types';
import type { BracketNode } from '@/lib/types/bracket';
import { bracketRoundInfo, computeBracketColumns, displayBracketRefs, displayRoundTitle } from '@/lib/playoff-bracket';
import styles from './LogicSyncBracket.module.css';

// draw-day reveal timing
const REVEAL_COL_STEP = 120;  // ms added per round column, left to right
const REVEAL_ROW_STEP = 50;   // ms added per node down a column
const REVEAL_MAX_DELAY = 900;  // cap so large brackets don't drag
const REVEAL_TOTAL_MS = REVEAL_MAX_DELAY + 600; // last node delay + its anim + buffer

// ── layout constants ───────────────────────────────────────────────────────────

const ROUND_WIDTH = 260;
const NODE_HEIGHT = 104;
const NODE_GAP    = 24;
const NODE_WIDTH  = 220;
const V_PAD       = 32;

// ── meta strip layout constants ────────────────────────────────────────────────
const META_H      = 18;   // height of the top date/status strip
const HOME_TEXT_Y = 38;   // baseline of home team text
const DIVIDER_Y   = 60;   // center divider line y
const AWAY_TEXT_Y = 82;   // baseline of away team text

// ── column builder ───────────────────────────────────────────────────────────
// Groups games into round columns via the shared bracketRoundInfo() so single
// elimination, double elimination (winners/losers/grand final), and consolation
// all render as ordered round columns.

function sortByCode(a: Game, b: Game): number {
  if (/^FIN/i.test(a.bracketCode ?? '') && /^3RD/i.test(b.bracketCode ?? '')) return -1;
  if (/^3RD/i.test(a.bracketCode ?? '') && /^FIN/i.test(b.bracketCode ?? '')) return 1;
  return (a.bracketCode ?? '').localeCompare(b.bracketCode ?? '');
}

function buildColumns(games: Game[]): { title: string; games: Game[] }[] {
  const colMap = computeBracketColumns(games);
  const groups = new Map<string, { title: string; rank: number; games: Game[] }>();
  for (const g of games) {
    let info = colMap.get(g.id) || bracketRoundInfo(g.bracketCode ?? '');
    // The "if necessary" reset is its own column just right of the Grand Final.
    if ((g.bracketCode ?? '').toUpperCase() === 'GF2') {
      info = { key: 'GF2', title: 'Grand Final Game 2 (If Necessary)', rank: 501 };
    }
    let grp = groups.get(info.key);
    if (!grp) { grp = { title: info.title, rank: info.rank, games: [] }; groups.set(info.key, grp); }
    grp.games.push(g);
  }
  return [...groups.values()]
    .sort((a, b) => a.rank - b.rank)
    .map(grp => ({ title: grp.title, games: grp.games.sort(sortByCode) }));
}

// ── node factory ──────────────────────────────────────────────────────────────

const NIL_UUID = '00000000-0000-0000-0000-000000000000';
const isReal = (id: string) => !!id && id !== NIL_UUID;

// "1st Pool Gold"   → "1st Gold Pool"
// "1st Pool Pool B" → "1st B Pool"   (fixes double-Pool from raw DB pool names)
// "Winner SF1"      → "Winner SF1"   (passthrough)
function cleanPlaceholder(text: string): string {
  const m = text.match(/^(\d+(?:st|nd|rd|th))\s+Pool\s+(.+)$/i);
  if (!m) return text;
  return `${m[1]} ${formatPoolName(m[2])}`;
}

function makeNode(game: Game, round: number, position: number, teams: PublicTeam[]): BracketNode {
  const resolveName = (id: string, placeholder: string | undefined) =>
    isReal(id)
      ? (teams.find(t => t.id === id)?.name ?? (displayBracketRefs(placeholder) || 'TBD'))
      : cleanPlaceholder(displayBracketRefs(placeholder ?? 'TBD'));

  const homeName = resolveName(game.homeTeamId, game.homePlaceholder);
  const awayName = resolveName(game.awayTeamId, game.awayPlaceholder);
  const hs = game.homeScore ?? null;
  const as = game.awayScore ?? null;

  const winnerId =
    hs !== null && as !== null && hs !== as && isReal(game.homeTeamId) && isReal(game.awayTeamId)
      ? hs > as ? game.homeTeamId : game.awayTeamId
      : null;

  return {
    id: game.id,
    round,
    position,
    homeTeam: { id: game.homeTeamId, name: homeName },
    awayTeam: { id: game.awayTeamId, name: awayName },
    homeScore: hs,
    awayScore: as,
    winnerId,
    bracketCode: game.bracketCode ?? '',
    isLive: false,
    date: game.date ?? '',
    time: game.time ?? '',
    status: (game.status ?? 'scheduled') as BracketNode['status'],
  };
}

function buildNodes(cols: { title: string; games: Game[] }[], teams: PublicTeam[]): BracketNode[] {
  return cols.flatMap((col, ci) => col.games.map((g, pi) => makeNode(g, ci, pi, teams)));
}

// ── SVG Y-position ────────────────────────────────────────────────────────────

function nodeY(position: number, colCount: number, totalH: number): number {
  const slotH = colCount > 0 ? totalH / colCount : totalH;
  return V_PAD + position * slotH + slotH / 2 - NODE_HEIGHT / 2;
}

// ── SVG trophy icon (mirrors lucide Trophy at small scale) ───────────────────

function TrophyIcon({ x, y, size = 12, color = 'var(--primary-light)' }: {
  x: number; y: number; size?: number; color?: string;
}) {
  const scale = size / 24;
  const s: React.CSSProperties = { fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" style={s} />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" style={s} />
      <path d="M4 22h16" style={s} />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" style={s} />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" style={s} />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" style={s} />
    </g>
  );
}

// ── SVG sub-components — use org CSS variables, not FieldLogic tokens ────────

function MatchNode({
  node, x, y, isHighlighted = true, showHighlightRing = false, requireFinalization = true,
}: {
  node: BracketNode; x: number; y: number;
  isHighlighted?: boolean;
  showHighlightRing?: boolean;
  requireFinalization?: boolean;
}) {
  // guard against null === null when both winnerId and teamId are null
  const isHomeWin = node.winnerId !== null && node.winnerId === node.homeTeam?.id;
  const isAwayWin = node.winnerId !== null && node.winnerId === node.awayTeam?.id;

  const homeScoreColor = node.winnerId
    ? (isHomeWin ? 'var(--primary-light)' : 'var(--white-35)')
    : 'var(--primary-light)';
  const awayScoreColor = node.winnerId
    ? (isAwayWin ? 'var(--primary-light)' : 'var(--white-35)')
    : 'var(--primary-light)';

  // date/time meta
  const dateText = node.date
    ? new Date(node.date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
    : '';
  const timeText = node.time ? formatTime(node.time) : '';
  const metaText = [dateText, timeText].filter(Boolean).join(' · ');

  // status badge
  const statusLabel =
    node.status === 'completed' ? 'Final'
    : node.status === 'submitted' ? (requireFinalization ? 'Pending' : 'Final')
    : node.status === 'cancelled' ? 'Cancelled'
    : null;
  const statusColor =
    statusLabel === 'Final'     ? 'var(--success)'
    : statusLabel === 'Pending'   ? 'var(--warning)'
    : statusLabel === 'Cancelled' ? 'var(--white-35)'
    : null;

  // team name truncation (shorter when trophy icon precedes)
  const homeName = (node.homeTeam?.name ?? 'TBD').slice(0, isHomeWin ? 17 : 20);
  const awayName = (node.awayTeam?.name ?? 'TBD').slice(0, isAwayWin ? 17 : 20);
  const TROPHY_W = 14; // horizontal space reserved for the trophy icon

  return (
    <g
      transform={`translate(${x},${y})`}
      style={{
        opacity: isHighlighted ? 1 : 0.25,
        filter:  isHighlighted ? undefined : 'saturate(0)',
        transition: 'opacity 0.2s, filter 0.2s',
      }}
    >
      {/* card background */}
      <rect
        width={NODE_WIDTH} height={NODE_HEIGHT} rx={8}
        style={{
          fill:        'var(--bracket-card, var(--surface))',
          stroke:      node.isLive ? 'var(--primary)' : 'rgba(var(--primary-rgb), 0.85)',
          strokeWidth: node.isLive ? '1' : '1.25',
          filter:      node.isLive ? 'url(#glow-primary)' : undefined,
        }}
      />
      {/* meta strip background */}
      <rect width={NODE_WIDTH} height={META_H} rx={8}
        style={{ fill: 'rgba(var(--primary-rgb), 0.08)' }} />
      <rect width={NODE_WIDTH} y={META_H / 2} height={META_H / 2}
        style={{ fill: 'rgba(var(--primary-rgb), 0.08)' }} />

      {/* meta: date · time */}
      {metaText && (
        <text x="9" y={META_H - 4} fontSize="8.5"
          style={{ fill: 'var(--white-45)', fontFamily: 'var(--font-sans)' }}>
          {metaText}
        </text>
      )}
      {/* meta: status badge */}
      {statusLabel && (
        <text x={NODE_WIDTH - 9} y={META_H - 4} fontSize="8.5" fontWeight="700" textAnchor="end"
          style={{ fill: statusColor ?? undefined, fontFamily: 'var(--font-sans)' }}>
          {statusLabel}
        </text>
      )}

      {/* meta separator */}
      <line x1="0" y1={META_H} x2={NODE_WIDTH} y2={META_H}
        style={{ stroke: 'rgba(var(--primary-rgb), 0.15)', strokeWidth: '0.5' }} />

      {/* highlight ring when team is selected */}
      {showHighlightRing && (
        <rect
          width={NODE_WIDTH} height={NODE_HEIGHT} rx={8}
          style={{ fill: 'none', stroke: 'var(--primary-light)', strokeWidth: '2' }}
        />
      )}

      {/* center divider */}
      <line x1="0" y1={DIVIDER_Y} x2={NODE_WIDTH} y2={DIVIDER_Y}
        style={{ stroke: 'rgba(var(--primary-rgb), 0.2)', strokeWidth: '1' }} />

      {/* home team name */}
      {isHomeWin && <TrophyIcon x={9} y={HOME_TEXT_Y - 10} size={12} />}
      <text x={isHomeWin ? 9 + TROPHY_W : 10} y={HOME_TEXT_Y} fontSize="11" fontWeight="700"
        style={{
          fill:       isHomeWin ? 'var(--primary-light)' : 'var(--white-90)',
          fontFamily: 'var(--font-sans)',
        }}>
        {homeName}
      </text>
      {node.homeScore !== null && (
        <text x={NODE_WIDTH - 10} y={HOME_TEXT_Y}
          fontSize="14" fontWeight="900" textAnchor="end"
          style={{ fill: homeScoreColor, fontFamily: 'var(--font-display)' }}>
          {node.homeScore}
        </text>
      )}

      {/* away team name */}
      {isAwayWin && <TrophyIcon x={9} y={AWAY_TEXT_Y - 10} size={12} />}
      <text x={isAwayWin ? 9 + TROPHY_W : 10} y={AWAY_TEXT_Y} fontSize="11" fontWeight="700"
        style={{
          fill:       isAwayWin ? 'var(--primary-light)' : 'var(--white-90)',
          fontFamily: 'var(--font-sans)',
        }}>
        {awayName}
      </text>
      {node.awayScore !== null && (
        <text x={NODE_WIDTH - 10} y={AWAY_TEXT_Y}
          fontSize="14" fontWeight="900" textAnchor="end"
          style={{ fill: awayScoreColor, fontFamily: 'var(--font-display)' }}>
          {node.awayScore}
        </text>
      )}

      {/* bracket code badge (sits on the center divider) */}
      <rect x="8" y={DIVIDER_Y - 7} width="32" height="13" rx={3}
        style={{
          fill:        'rgba(var(--primary-rgb), 0.15)',
          stroke:      'rgba(var(--primary-rgb), 0.35)',
          strokeWidth: '0.5',
        }} />
      <text x="24" y={DIVIDER_Y + 3.5}
        fontSize="6.5" fontWeight="700" textAnchor="middle"
        style={{ fill: 'var(--white-45)', fontFamily: 'var(--font-sans)', letterSpacing: '0.06em' }}>
        {displayBracketRefs(node.bracketCode.toUpperCase())}
      </text>
    </g>
  );
}

function ConnectorPath({
  fromX, fromY, toX, toY, active, kind, dropDown = false, revealDelay,
}: {
  fromX: number; fromY: number;
  toX: number; toY: number;
  active: boolean;
  kind?: 'winner' | 'loser';
  /** True for WB-loser→LB cross-band connectors: exits the source going downward
   *  first (the curve reads as "falls to the losers bracket") rather than the
   *  standard horizontal-first S-curve used for within-band progression. */
  dropDown?: boolean;
  /** When set (draw-day reveal playing), the connector fades in after this delay. */
  revealDelay?: number;
}) {
  let d: string;
  if (dropDown) {
    // Vertical-first bezier: exit straight down from the bottom of the WB node,
    // then sweep right to arrive horizontally at the LB node. This makes the
    // "loser drops down" topology immediately readable.
    const vy = Math.max(24, Math.abs(toY - fromY) / 2);
    const hx = Math.max(16, Math.abs(toX - fromX) / 3);
    d = `M ${fromX} ${fromY} C ${fromX} ${fromY + vy}, ${toX - hx} ${toY}, ${toX} ${toY}`;
  } else {
    // Horizontal S-curve: the standard bracket connector — exits horizontally
    // from the right edge of the source and arrives horizontally at the target.
    const dx = Math.max(20, Math.abs(toX - fromX) / 2);
    d = `M ${fromX} ${fromY} C ${fromX + dx} ${fromY}, ${toX - dx} ${toY}, ${toX} ${toY}`;
  }
  // Winner advances → green; loser drops to the losers bracket → amber (dashed).
  // Falls back to the org primary when the path direction is unknown (single elim).
  const baseStroke =
    kind === 'loser'  ? 'rgba(var(--warning-rgb), 0.35)'
    : kind === 'winner' ? 'rgba(var(--success-rgb), 0.35)'
    : 'rgba(var(--primary-rgb), 0.25)';
  const activeStroke =
    kind === 'loser'  ? 'rgba(var(--warning-rgb), 0.9)'
    : kind === 'winner' ? 'var(--success)'
    : 'var(--primary)';
  return (
    <g
      className={revealDelay != null ? styles.revealConnector : undefined}
      style={revealDelay != null ? ({ ['--d']: `${revealDelay}ms` } as React.CSSProperties) : undefined}
    >
      <path d={d} fill="none" strokeDasharray={kind === 'loser' ? '5 4' : undefined}
        style={{ stroke: baseStroke, strokeWidth: '1.5' }} />
      {active && (
        <path d={d} fill="none" strokeDasharray={kind === 'loser' ? '5 4' : '8 4'}
          className="animate-data-flow"
          style={{ stroke: activeStroke, strokeWidth: '2' }} />
      )}
    </g>
  );
}

// ── horizontal pan / scroll affordance ─────────────────────────────────────────
// A bracket is frequently wider than the viewport, and a tall double-elim fork
// pushes the native horizontal scrollbar below the fold (unreachable without
// scrolling the page past the bracket). So mouse users get click-drag-to-pan
// (grab cursor) and soft edge fades cue the hidden content; touch/trackpad keep
// their native momentum scrolling untouched.
function BracketScroller({ children }: { children: React.ReactNode }) {
  const ref      = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const drag     = useRef({ active: false, startX: 0, startScroll: 0, moved: false });
  const [overflow, setOverflow] = useState(false);
  const [atStart, setAtStart]   = useState(true);
  const [atEnd, setAtEnd]       = useState(false);
  const [grabbing, setGrabbing] = useState(false);

  function measure() {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setOverflow(max > 1);
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft >= max - 1);
  }

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (innerRef.current) ro.observe(innerRef.current); // catch late data widening the bracket
    return () => ro.disconnect();
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || !overflow || e.pointerType !== 'mouse' || e.button !== 0) return;
    drag.current = { active: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false };
    setGrabbing(true);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || !drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    if (!drag.current.moved && Math.abs(dx) > 3) {
      drag.current.moved = true;
      try { el.setPointerCapture(e.pointerId); } catch { /* capture is best-effort */ }
    }
    if (drag.current.moved) el.scrollLeft = drag.current.startScroll - dx;
  }
  function endDrag() {
    drag.current.active = false;
    setGrabbing(false);
  }
  // Swallow the click that ends a pan so a drag-pan never reads as a tap.
  function onClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    if (drag.current.moved) { e.stopPropagation(); drag.current.moved = false; }
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={ref}
        onScroll={measure}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        style={{
          overflowX: 'auto',
          overscrollBehaviorX: 'contain',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          cursor: overflow ? (grabbing ? 'grabbing' : 'grab') : undefined,
        }}
      >
        <div ref={innerRef} style={{ width: 'fit-content', margin: '0 auto' }}>
          {children}
        </div>
      </div>
      {overflow && !atStart && <ScrollEdge side="left" />}
      {overflow && !atEnd   && <ScrollEdge side="right" />}
    </div>
  );
}

function ScrollEdge({ side }: { side: 'left' | 'right' }) {
  const isLeft = side === 'left';
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left:  isLeft ? 0 : 'auto',
        right: isLeft ? 'auto' : 0,
        width: 44,
        pointerEvents: 'none',
        background: `linear-gradient(to ${side}, transparent, var(--surface) 88%)`,
      }}
    />
  );
}

// ── main component ────────────────────────────────────────────────────────────

interface LogicSyncBracketProps {
  games: Game[];
  teams: PublicTeam[];
  tournamentId: string;
  highlightTeamId?: string;
  requireFinalization?: boolean;
}

export function LogicSyncBracket({ games, teams, tournamentId, highlightTeamId, requireFinalization = true }: LogicSyncBracketProps) {
  // stable client ref — createClient() from @supabase/ssr creates a new instance on every
  // render, so calling it at component body level and including it in useEffect deps causes
  // infinite re-subscription loops. useRef ensures one instance per component mount.
  const supabase   = useRef(createClient()).current;
  const liveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [columns, setColumns] = useState<{ title: string; games: Game[] }[]>([]);
  const [nodes, setNodes]     = useState<BracketNode[]>([]);

  // Draw-day reveal — plays a one-time staggered entrance the first time a fan
  // opens a SEEDED, PRE-PLAY bracket this browser session. Evaluated once on the
  // first node build (revealEvaluated guard) so realtime score updates can never
  // re-trigger it; gated per-tournament via sessionStorage so it plays once even
  // across the Schedule and Standings surfaces (both render this component).
  const revealEvaluated     = useRef(false);
  const [revealPlaying, setRevealPlaying] = useState(false);

  // Zoom — SVG-native: scale the rendered size, keep the viewBox (crisp vectors).
  // Defaults to Fit so fans see the whole bracket; the control / pinch zooms in.
  const zoomContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef(1);
  const [zoom, setZoom] = useState(1);
  const didFitRef = useRef(false);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  const computeFitZoom = (): number | null => {
    const c = zoomContainerRef.current;
    const s = svgRef.current;
    if (!c || !s) return null;
    const naturalW = s.getBoundingClientRect().width / (zoomRef.current || 1);
    const avail = c.clientWidth - 8;
    if (naturalW <= 4 || avail <= 0) return null;
    return Math.max(0.4, Math.min(1, avail / naturalW));
  };
  const stepZoom = (dir: 1 | -1) => setZoom(z => {
    const steps = [0.4, 0.5, 0.65, 0.8, 1, 1.25, 1.5];
    if (dir === 1) return steps.find(s => s > z + 0.001) ?? z;
    const below = steps.filter(s => s < z - 0.001);
    return below.length ? below[below.length - 1] : z;
  });
  // Default to Fit once the bracket (re)builds; never re-fits on score polls
  // (keyed on node COUNT, which is stable across live updates).
  useEffect(() => {
    if (nodes.length === 0) return;
    didFitRef.current = false;
    const measure = () => {
      if (didFitRef.current) return;
      const f = computeFitZoom();
      if (f == null) return;
      didFitRef.current = true;
      setZoom(f);
    };
    const id = requestAnimationFrame(measure);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro && zoomContainerRef.current) ro.observe(zoomContainerRef.current);
    return () => { cancelAnimationFrame(id); ro?.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length]);

  useEffect(() => {
    if (revealEvaluated.current || nodes.length === 0) return;
    revealEvaluated.current = true;

    // reduced motion → no entrance, bracket is simply present
    if (typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    // pre-play: nothing started or scored yet (otherwise it isn't "draw day")
    const prePlay = nodes.every(n =>
      n.homeScore === null && n.awayScore === null
      && (n.status === 'scheduled' || n.status === 'cancelled'));
    if (!prePlay) return;

    // seeded: at least one real team placed (don't animate an all-TBD shell)
    const seeded = nodes.some(n => isReal(n.homeTeam?.id ?? '') || isReal(n.awayTeam?.id ?? ''));
    if (!seeded) return;

    // once per session per tournament
    try {
      const key = `bracket-reveal-${tournamentId}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch { /* sessionStorage unavailable — still play once this mount */ }

    setRevealPlaying(true);
  }, [nodes, tournamentId]);

  // End the reveal after it finishes. Keyed on revealPlaying (not nodes) so a
  // realtime update mid-animation can't clear the timer.
  useEffect(() => {
    if (!revealPlaying) return;
    const t = setTimeout(() => setRevealPlaying(false), REVEAL_TOTAL_MS);
    return () => clearTimeout(t);
  }, [revealPlaying]);

  // rebuild from props whenever upstream data changes
  useEffect(() => {
    const cols = buildColumns(games);
    setColumns(cols);
    setNodes(buildNodes(cols, teams));
  }, [games, teams]);

  // Realtime subscription — score updates pulse the LIVE badge
  useEffect(() => {
    if (!tournamentId) return;

    // unique suffix prevents "already joined" errors when the component remounts
    // (React StrictMode double-invokes effects; the old channel may still be joining
    // when the second effect runs, causing Supabase to throw on .on() calls)
    const chName  = `bracket-${tournamentId}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(chName)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `tournament_id=eq.${tournamentId}` },
        (payload) => {
          const g = payload.new as {
            id: string;
            home_score: number | null;
            away_score: number | null;
            home_team_id: string;
            away_team_id: string;
            status: string;
          };

          const hs = g.home_score ?? null;
          const as = g.away_score ?? null;
          const winnerId =
            hs !== null && as !== null && hs !== as &&
            isReal(g.home_team_id) && isReal(g.away_team_id)
              ? hs > as ? g.home_team_id : g.away_team_id
              : null;

          setNodes(prev =>
            prev.map(n =>
              n.id === g.id
                ? { ...n, homeScore: hs, awayScore: as, winnerId, isLive: true, status: g.status as BracketNode['status'] }
                : n
            )
          );

          if (liveTimers.current[g.id]) clearTimeout(liveTimers.current[g.id]);
          liveTimers.current[g.id] = setTimeout(() => {
            setNodes(prev => prev.map(n => n.id === g.id ? { ...n, isLive: false } : n));
            delete liveTimers.current[g.id];
          }, 5000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      Object.values(liveTimers.current).forEach(clearTimeout);
      liveTimers.current = {};
    };
  }, [tournamentId]); // supabase is stable via useRef — intentionally omitted from deps

  if (games.length === 0) {
    return (
      <div className="empty-state">
        <Trophy size={48} />
        <p>No playoff games scheduled yet. Check back soon!</p>
      </div>
    );
  }

  if (nodes.length === 0) return null;

  // Champion — the decided final's winner drives the spotlight banner. For double
  // elimination that is the grand-final reset (if played) or the grand final.
  const hasMultiBracket = nodes.some(n => /^(WB|LB|GF|CON|PL)/i.test(n.bracketCode));
  const finalNode =
    nodes.find(n => n.bracketCode.toUpperCase() === 'GF2' && n.winnerId) ||
    nodes.find(n => n.bracketCode.toUpperCase() === 'GF' && n.winnerId) ||
    nodes.find(n => /^FIN/i.test(n.bracketCode) && n.winnerId);
  const championName = finalNode
    ? ((finalNode.winnerId === finalNode.homeTeam?.id ? finalNode.homeTeam?.name : finalNode.awayTeam?.name) ?? null)
    : null;

  // ── SVG layout ────────────────────────────────────────────────────────────
  // Single elimination is one row of round columns. Double elimination uses a
  // FORK layout: a shared Seed round (round 1) on the left, then winners bracket
  // on top / losers bracket on the bottom, with the grand final (+ its "if
  // necessary" reset) on the far right — so every feed flows forward. Each node
  // gets an absolute {x,y}; connectors then follow the actual Winner/Loser
  // references (format-agnostic) and are coloured by which path they carry.
  const isDoubleElim = nodes.some(n => /^(WB|LB|GF)/i.test(n.bracketCode));
  const nodeByCode = new Map(nodes.map(n => [n.bracketCode.toUpperCase(), n]));
  const positions = new Map<string, { x: number; y: number }>();
  const columnLabels: { key: string; title: string; x: number; y: number }[] = [];

  const tierY = (pos: number, count: number, top: number, bandH: number) =>
    top + (bandH / count) * pos + (bandH / count) / 2 - NODE_HEIGHT / 2;

  let svgWidth = NODE_WIDTH + 40;
  let svgHeight = NODE_HEIGHT + V_PAD * 2;

  if (isDoubleElim) {
    const sectionOf = (col: { games: Game[] }) => {
      const code = (col.games[0]?.bracketCode || '').toUpperCase();
      if (code.startsWith('LB')) return 'L';
      if (code.startsWith('GF')) return 'GF';
      return 'W';
    };
    const wbRoundOf = (col: { games: Game[] }) => {
      const m = (col.games[0]?.bracketCode || '').toUpperCase().match(/^WB(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    };
    const wbAllCols = columns.filter(c => sectionOf(c) === 'W');
    const lbCols = columns.filter(c => sectionOf(c) === 'L');
    const gfCols = columns.filter(c => sectionOf(c) === 'GF');
    // Winners round 1 is the shared SEED column; everything else forks off it.
    const seedCols = wbAllCols.filter(c => wbRoundOf(c) === 1);
    const wbCols = wbAllCols.filter(c => wbRoundOf(c) !== 1);

    const wbBandH = Math.max(1, wbCols[0]?.games.length ?? 1) * (NODE_HEIGHT + NODE_GAP);
    const lbBandH = Math.max(1, lbCols[0]?.games.length ?? 1) * (NODE_HEIGHT + NODE_GAP);
    const TIER_GAP = NODE_HEIGHT;
    const wbTop = V_PAD;
    const lbTop = V_PAD + wbBandH + TIER_GAP;
    const forkBottom = lbTop + lbBandH;
    const forkMid = (wbTop + forkBottom) / 2;
    const colOffset = seedCols.length;                 // shift the fork right past the seed column
    const mainColCount = colOffset + Math.max(wbCols.length, lbCols.length);

    // Seed column — spread across the full fork height, vertically centred.
    seedCols.forEach((col) => {
      const x = 20;
      columnLabels.push({ key: 'seed', title: 'Seed Round', x: x + NODE_WIDTH / 2, y: wbTop - 12 });
      col.games.forEach((g, pi) => positions.set(g.id, { x, y: tierY(pi, col.games.length, wbTop, forkBottom - wbTop) }));
    });

    const placeCols = (cols: typeof columns, top: number, bandH: number) => cols.forEach((col, i) => {
      const x = (colOffset + i) * ROUND_WIDTH + 20;
      columnLabels.push({ key: `${top}-${i}`, title: displayRoundTitle(col.title), x: x + NODE_WIDTH / 2, y: top - 12 });
      col.games.forEach((g, pi) => positions.set(g.id, { x, y: tierY(pi, col.games.length, top, bandH) }));
    });
    placeCols(wbCols, wbTop, wbBandH);
    placeCols(lbCols, lbTop, lbBandH);

    const gfMid = forkMid;
    gfCols.forEach((col, gi) => {
      const x = (mainColCount + gi) * ROUND_WIDTH + 20;
      columnLabels.push({ key: `gf-${gi}`, title: displayRoundTitle(col.title), x: x + NODE_WIDTH / 2, y: wbTop - 12 });
      col.games.forEach((g, pi) => positions.set(g.id, { x, y: gfMid - NODE_HEIGHT / 2 + pi * (NODE_HEIGHT + NODE_GAP) }));
    });

    let maxX = 0; let maxY = 0;
    positions.forEach(p => { maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
    svgWidth = maxX + NODE_WIDTH + 40;
    svgHeight = maxY + NODE_HEIGHT + V_PAD;
  } else {
    // Size the column height by the LARGEST round, not the first one. A standard
    // bracket's first round IS the largest, but an irregular/tiered bracket can have
    // a play-in round (1 game) feeding a bigger Semifinal round (2 games) — sizing
    // off the first column then squeezes the larger column so its cards overlap.
    const maxCol = columns.reduce((m, c) => Math.max(m, c.games.length), 1);
    const totalH = maxCol * (NODE_HEIGHT + NODE_GAP);
    columns.forEach((col, ci) => {
      const x = ci * ROUND_WIDTH + 20;
      columnLabels.push({ key: `c-${ci}`, title: displayRoundTitle(col.title), x: x + NODE_WIDTH / 2, y: V_PAD - 12 });
      col.games.forEach((g, pi) => positions.set(g.id, { x, y: nodeY(pi, col.games.length, totalH) }));
    });
    svgWidth = (columns.length - 1) * ROUND_WIDTH + NODE_WIDTH + 40;
    svgHeight = totalH + V_PAD * 2;
  }

  // ── draw-day reveal stagger ─────────────────────────────────────────────────
  // Per-node entrance delay, ordered by visual position: bucket nodes by their x
  // (round column), rank columns left→right, then stagger top→bottom within each.
  // Only populated while the reveal is playing — empty map = no animation.
  const revealDelay = new Map<string, number>();
  const colRankByX = new Map<number, number>();
  if (revealPlaying) {
    const xs = [...new Set([...positions.values()].map(p => p.x))].sort((a, b) => a - b);
    xs.forEach((x, i) => colRankByX.set(x, i));
    const byX = new Map<number, { id: string; y: number }[]>();
    positions.forEach((p, id) => {
      const arr = byX.get(p.x) ?? [];
      arr.push({ id, y: p.y });
      byX.set(p.x, arr);
    });
    byX.forEach((arr, x) => {
      const colRank = colRankByX.get(x) ?? 0;
      arr.sort((a, b) => a.y - b.y).forEach(({ id }, i) => {
        revealDelay.set(id, Math.min(colRank * REVEAL_COL_STEP + i * REVEAL_ROW_STEP, REVEAL_MAX_DELAY));
      });
    });
  }
  // A connector fades in just after both its endpoint cards have landed.
  const connectorDelay = (fromId?: string, toId?: string): number | undefined => {
    if (!revealPlaying) return undefined;
    const a = fromId ? revealDelay.get(fromId) : undefined;
    const b = toId ? revealDelay.get(toId) : undefined;
    return Math.max(a ?? 0, b ?? 0) + 150;
  };
  // A round header sits just ahead of its column's cards (label.x = colX + NODE_WIDTH/2).
  const labelDelay = (labelX: number): number | undefined => {
    if (!revealPlaying) return undefined;
    return Math.min((colRankByX.get(labelX - NODE_WIDTH / 2) ?? 0) * REVEAL_COL_STEP, REVEAL_MAX_DELAY);
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    // outer: clips overflow and enables horizontal scroll
    // inner: width:fit-content + margin:auto centers when it fits the viewport,
    //        and naturally left-aligns when the scroll kicks in
    <div className="py-4" ref={zoomContainerRef}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm, 6px)', padding: 2 }}>
          <button type="button" onClick={() => stepZoom(-1)} aria-label="Zoom out" title="Zoom out" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 26, background: 'transparent', border: 'none', color: 'var(--white-60)', borderRadius: 4, cursor: 'pointer' }}><Minus size={15} /></button>
          <button type="button" onClick={() => setZoom(1)} title="Reset to 100%" style={{ minWidth: 46, textAlign: 'center', background: 'transparent', border: 'none', color: 'var(--white-80)', fontFamily: 'var(--font-data)', fontSize: '0.72rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', cursor: 'pointer' }}>{Math.round(zoom * 100)}%</button>
          <button type="button" onClick={() => stepZoom(1)} aria-label="Zoom in" title="Zoom in" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 26, background: 'transparent', border: 'none', color: 'var(--white-60)', borderRadius: 4, cursor: 'pointer' }}><Plus size={15} /></button>
          <button type="button" onClick={() => { const f = computeFitZoom(); if (f != null) setZoom(f); }} aria-label="Fit bracket" title="Fit bracket" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 26, background: 'transparent', border: 'none', color: 'var(--white-60)', borderRadius: 4, cursor: 'pointer' }}><Maximize size={15} /></button>
        </div>
      </div>
      {championName && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            width: 'fit-content',
            margin: '0 auto 1rem',
            padding: '0.7rem 1.1rem',
            border: '1px solid rgba(var(--warning-rgb), 0.4)',
            borderRadius: 'var(--radius-md)',
            background:
              'linear-gradient(135deg, rgba(var(--warning-rgb), 0.16), transparent 72%), var(--surface)',
            boxShadow: 'var(--highlight-top)',
          }}
        >
          <Trophy size={20} style={{ color: 'var(--warning)', flexShrink: 0, filter: 'drop-shadow(0 0 10px rgba(var(--warning-rgb), 0.4))' }} />
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
            <span style={{ fontFamily: 'var(--font-data)', fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--warning)' }}>
              Champion
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 900, color: 'var(--white)' }}>
              {championName}
            </span>
          </span>
        </div>
      )}
      <BracketScroller>
      <svg
        ref={svgRef}
        width={svgWidth * zoom}
        height={svgHeight * zoom}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ display: 'block' }}
      >
        {/* ── glow filter — uses primary color blur for live nodes ── */}
        <defs>
          <filter id="glow-primary" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── round header labels ── */}
        {columnLabels.map(l => {
          const d = labelDelay(l.x);
          return (
          <text
            key={`lbl-${l.key}`}
            x={l.x}
            y={l.y}
            fontSize="10"
            fontWeight="700"
            textAnchor="middle"
            className={d != null ? styles.revealLabel : undefined}
            style={{
              fill:        'var(--white-45)',
              fontFamily:  'var(--font-display)',
              letterSpacing: '0.1em',
              ...(d != null ? { ['--d']: `${d}ms` } as React.CSSProperties : {}),
            }}
          >
            {l.title.toUpperCase()}
          </text>
          );
        })}

        {/* ── connectors (behind nodes) ──
              ALL formats follow the actual Winner/Loser references (format-agnostic),
              so a renamed/legacy or otherwise irregular bracket traces correctly —
              not just round-to-round halving. All connectors use cubic bezier curves.
              Cross-band WB-loser→LB connectors exit from the node's bottom-center
              (dropDown=true) so the path reads as "loser falls to the losers bracket";
              within-band connections use the standard horizontal S-curve. ── */}
        {isDoubleElim
          ? columns.flatMap(col => col.games.flatMap(g => {
              const tgt = positions.get(g.id);
              if (!tgt) return [];
              return [g.homePlaceholder, g.awayPlaceholder].flatMap((ph, side) => {
                const m = (ph || '').match(/^(Winner|Loser)\s+(.+)$/);
                if (!m) return [];
                const kind    = m[1].toLowerCase() as 'winner' | 'loser';
                const srcCode = m[2].toUpperCase();
                const srcNode = nodeByCode.get(srcCode);
                const sp      = srcNode ? positions.get(srcNode.id) : undefined;
                if (!srcNode || !sp) return [];
                // A WB-loser reference (Loser WB…) is a cross-band drop from the
                // winners tier into the losers tier.  Exit from the bottom-center
                // of the source node so the curve reads as a downward drop.
                const isCrossBand = kind === 'loser' && /^WB\d/i.test(srcCode);
                const fromX = isCrossBand ? sp.x + NODE_WIDTH / 2 : sp.x + NODE_WIDTH;
                const fromY = isCrossBand ? sp.y + NODE_HEIGHT     : sp.y + NODE_HEIGHT / 2;
                return [(
                  <ConnectorPath
                    key={`dc-${g.id}-${side}`}
                    fromX={fromX}
                    fromY={fromY}
                    toX={tgt.x}
                    toY={tgt.y + NODE_HEIGHT / 2}
                    active={srcNode.winnerId !== null}
                    kind={kind}
                    dropDown={isCrossBand}
                    revealDelay={connectorDelay(srcNode.id, g.id)}
                  />
                )];
              });
            }))
          : !hasMultiBracket && columns.flatMap(col => col.games.flatMap(g => {
              const tgt = positions.get(g.id);
              if (!tgt) return [];
              // Follow the real Winner/Loser wiring (not round-to-round halving) so a
              // renamed/legacy or otherwise irregular single-elim bracket still traces
              // correctly. Neutral colour preserved (no `kind`) — only accuracy changes.
              return [g.homePlaceholder, g.awayPlaceholder].flatMap((ph, side) => {
                const m = (ph || '').match(/^(Winner|Loser)\s+(.+)$/);
                if (!m) return [];
                const srcNode = nodeByCode.get(m[2].toUpperCase());
                const sp = srcNode ? positions.get(srcNode.id) : undefined;
                if (!srcNode || !sp) return [];
                return [(
                  <ConnectorPath
                    key={`c-${g.id}-${side}`}
                    fromX={sp.x + NODE_WIDTH}
                    fromY={sp.y + NODE_HEIGHT / 2}
                    toX={tgt.x}
                    toY={tgt.y + NODE_HEIGHT / 2}
                    active={srcNode.winnerId !== null}
                    revealDelay={connectorDelay(srcNode.id, g.id)}
                  />
                )];
              });
            }))}

        {/* ── match nodes ── */}
        {columns.flatMap(col =>
          col.games.map(g => {
            const node = nodes.find(n => n.id === g.id);
            const pos = positions.get(g.id);
            if (!node || !pos) return null;
            const nodeMatchesTeam = !!highlightTeamId && (
              node.homeTeam?.id === highlightTeamId || node.awayTeam?.id === highlightTeamId
            );
            const d = revealDelay.get(g.id);
            const matchNode = (
              <MatchNode
                node={node}
                x={pos.x}
                y={pos.y}
                isHighlighted={!highlightTeamId || nodeMatchesTeam}
                showHighlightRing={nodeMatchesTeam}
                requireFinalization={requireFinalization}
              />
            );
            // While the draw-day reveal plays, wrap each card in a group that
            // animates its staggered entrance (the wrapper's transform/opacity
            // composes with MatchNode's positioning transform).
            return d != null ? (
              <g
                key={node.id}
                className={styles.revealNode}
                style={{ ['--d']: `${d}ms` } as React.CSSProperties}
              >
                {matchNode}
              </g>
            ) : (
              <g key={node.id}>{matchNode}</g>
            );
          })
        )}
      </svg>
      </BracketScroller>
    </div>
  );
}
