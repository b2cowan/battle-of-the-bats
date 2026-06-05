'use client';

import { useEffect, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase-browser';
import { formatPoolName, formatTime } from '@/lib/utils';
import type { Game, Team } from '@/lib/types';
import type { BracketNode } from '@/lib/types/bracket';
import { bracketRoundInfo, displayBracketRefs, displayRoundTitle } from '@/lib/playoff-bracket';

// ── layout constants ───────────────────────────────────────────────────────────

const ROUND_WIDTH    = 260;
const NODE_HEIGHT    = 104;
const NODE_GAP       = 24;
const NODE_WIDTH     = 220;
const CONNECTOR_STUB = 40;
const V_PAD          = 32;

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
  const groups = new Map<string, { title: string; rank: number; games: Game[] }>();
  for (const g of games) {
    let info = bracketRoundInfo(g.bracketCode ?? '');
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

function makeNode(game: Game, round: number, position: number, teams: Team[]): BracketNode {
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

function buildNodes(cols: { title: string; games: Game[] }[], teams: Team[]): BracketNode[] {
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
          fill:        'var(--surface)',
          stroke:      node.isLive ? 'var(--primary)' : 'rgba(var(--primary-rgb), 0.45)',
          strokeWidth: '1',
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
  fromX, fromY, toX, toY, active, kind,
}: {
  fromX: number; fromY: number;
  toX: number; toY: number;
  active: boolean;
  kind?: 'winner' | 'loser';
}) {
  const midX = fromX + CONNECTOR_STUB;
  const d    = `M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`;
  // Winner advances → green; loser drops to the losers bracket → amber (dashed).
  // Falls back to the org primary when the path direction is unknown (single elim).
  const baseStroke =
    kind === 'loser'  ? 'rgba(var(--warning-rgb), 0.4)'
    : kind === 'winner' ? 'rgba(var(--success-rgb), 0.4)'
    : 'rgba(var(--primary-rgb), 0.3)';
  const activeStroke =
    kind === 'loser'  ? 'rgba(var(--warning-rgb), 0.95)'
    : kind === 'winner' ? 'var(--success)'
    : 'var(--primary)';
  return (
    <g>
      <path d={d} fill="none" strokeDasharray={kind === 'loser' ? '5 4' : undefined}
        style={{ stroke: baseStroke, strokeWidth: '1' }} />
      {active && (
        <path d={d} fill="none" strokeDasharray={kind === 'loser' ? '5 4' : '8 4'}
          className="animate-data-flow"
          style={{ stroke: activeStroke, strokeWidth: '1.5' }} />
      )}
    </g>
  );
}

// ── main component ────────────────────────────────────────────────────────────

interface LogicSyncBracketProps {
  games: Game[];
  teams: Team[];
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
    const maxFirstCol = columns.length > 0 ? columns[0].games.length : 1;
    const totalH = maxFirstCol * (NODE_HEIGHT + NODE_GAP);
    columns.forEach((col, ci) => {
      const x = ci * ROUND_WIDTH + 20;
      columnLabels.push({ key: `c-${ci}`, title: displayRoundTitle(col.title), x: x + NODE_WIDTH / 2, y: V_PAD - 12 });
      col.games.forEach((g, pi) => positions.set(g.id, { x, y: nodeY(pi, col.games.length, totalH) }));
    });
    svgWidth = (columns.length - 1) * ROUND_WIDTH + NODE_WIDTH + 40;
    svgHeight = totalH + V_PAD * 2;
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    // outer: clips overflow and enables horizontal scroll
    // inner: width:fit-content + margin:auto centers when it fits the viewport,
    //        and naturally left-aligns when the scroll kicks in
    <div className="py-4">
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
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ width: 'fit-content', margin: '0 auto' }}>
      <svg
        width={svgWidth}
        height={svgHeight}
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
        {columnLabels.map(l => (
          <text
            key={`lbl-${l.key}`}
            x={l.x}
            y={l.y}
            fontSize="10"
            fontWeight="700"
            textAnchor="middle"
            style={{
              fill:        'var(--white-45)',
              fontFamily:  'var(--font-display)',
              letterSpacing: '0.1em',
            }}
          >
            {l.title.toUpperCase()}
          </text>
        ))}

        {/* ── connectors (behind nodes) ──
              Double elimination / placement / consolation follow the actual
              Winner/Loser references (a game's loser-drop line is correct by data);
              single elimination uses simple round-to-round halving. ── */}
        {isDoubleElim
          ? columns.flatMap(col => col.games.flatMap(g => {
              const tgt = positions.get(g.id);
              if (!tgt) return [];
              return [g.homePlaceholder, g.awayPlaceholder].flatMap((ph, side) => {
                const m = (ph || '').match(/^(Winner|Loser)\s+(.+)$/);
                if (!m) return [];
                const kind = m[1].toLowerCase() as 'winner' | 'loser';
                const srcNode = nodeByCode.get(m[2].toUpperCase());
                const sp = srcNode ? positions.get(srcNode.id) : undefined;
                if (!srcNode || !sp) return [];
                return [(
                  <ConnectorPath
                    key={`dc-${g.id}-${side}`}
                    fromX={sp.x + NODE_WIDTH}
                    fromY={sp.y + NODE_HEIGHT / 2}
                    toX={tgt.x}
                    toY={tgt.y + NODE_HEIGHT / 2}
                    active={srcNode.winnerId !== null}
                    kind={kind}
                  />
                )];
              });
            }))
          : !hasMultiBracket && columns.map((col, ci) => {
              const nextCol = columns[ci + 1];
              if (!nextCol) return null;
              return col.games.map((g, pi) => {
                const targetPos = Math.floor(pi / 2);
                const tg = nextCol.games[targetPos];
                if (!tg) return null;
                const sp = positions.get(g.id);
                const tp = positions.get(tg.id);
                if (!sp || !tp) return null;
                const srcNode = nodeByCode.get((g.bracketCode || '').toUpperCase());
                return (
                  <ConnectorPath
                    key={`c-${ci}-${pi}`}
                    fromX={sp.x + NODE_WIDTH}
                    fromY={sp.y + NODE_HEIGHT / 2}
                    toX={tp.x}
                    toY={tp.y + NODE_HEIGHT / 2}
                    active={srcNode?.winnerId != null}
                  />
                );
              });
            })}

        {/* ── match nodes ── */}
        {columns.flatMap(col =>
          col.games.map(g => {
            const node = nodes.find(n => n.id === g.id);
            const pos = positions.get(g.id);
            if (!node || !pos) return null;
            const nodeMatchesTeam = !!highlightTeamId && (
              node.homeTeam?.id === highlightTeamId || node.awayTeam?.id === highlightTeamId
            );
            return (
              <MatchNode
                key={node.id}
                node={node}
                x={pos.x}
                y={pos.y}
                isHighlighted={!highlightTeamId || nodeMatchesTeam}
                showHighlightRing={nodeMatchesTeam}
                requireFinalization={requireFinalization}
              />
            );
          })
        )}
      </svg>
      </div>
      </div>
    </div>
  );
}
