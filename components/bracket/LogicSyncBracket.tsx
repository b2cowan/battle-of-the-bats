'use client';

import { useEffect, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase-browser';
import { formatPoolName, formatTime } from '@/lib/utils';
import type { Game, Team } from '@/lib/types';
import type { BracketNode } from '@/lib/types/bracket';

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

// ── column builder (mirrors schedule/page.tsx bracketPriority + buildBracketColumns) ──

const ROUND_DEFS = [
  { title: 'Quarterfinals', pattern: /^QF/i },
  { title: 'Semifinals',    pattern: /^SF/i },
  { title: 'Finals',        pattern: /^(FIN|IF|3RD)$/i },
];

function sortByCode(a: Game, b: Game): number {
  if (/^FIN/i.test(a.bracketCode ?? '') && /^3RD/i.test(b.bracketCode ?? '')) return -1;
  if (/^3RD/i.test(a.bracketCode ?? '') && /^FIN/i.test(b.bracketCode ?? '')) return 1;
  return (a.bracketCode ?? '').localeCompare(b.bracketCode ?? '');
}

function buildColumns(games: Game[]): { title: string; games: Game[] }[] {
  const cols = ROUND_DEFS
    .map(r => ({
      title: r.title,
      games: games.filter(g => r.pattern.test(g.bracketCode ?? '')).sort(sortByCode),
    }))
    .filter(c => c.games.length > 0);

  const matchedIds = new Set(cols.flatMap(c => c.games.map(g => g.id)));
  const custom = games.filter(g => !matchedIds.has(g.id));
  if (custom.length > 0) {
    const byCode: Record<string, Game[]> = {};
    custom.forEach(g => {
      const k = g.bracketCode ?? 'EXTRA';
      (byCode[k] = byCode[k] ?? []).push(g);
    });
    Object.entries(byCode).forEach(([code, gs]) =>
      cols.push({ title: code, games: gs.sort(sortByCode) })
    );
  }
  return cols;
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
      ? (teams.find(t => t.id === id)?.name ?? placeholder ?? 'TBD')
      : cleanPlaceholder(placeholder ?? 'TBD');

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
    ? (isHomeWin ? 'var(--primary-light)' : 'rgba(255,255,255,0.35)')
    : 'var(--primary-light)';
  const awayScoreColor = node.winnerId
    ? (isAwayWin ? 'var(--primary-light)' : 'rgba(255,255,255,0.35)')
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
    statusLabel === 'Final'     ? '#4ade80'
    : statusLabel === 'Pending'   ? '#fbbf24'
    : statusLabel === 'Cancelled' ? 'rgba(255,255,255,0.35)'
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
          style={{ fill: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-sans)' }}>
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
          fill:       isHomeWin ? 'var(--primary-light)' : 'rgba(255,255,255,0.9)',
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
          fill:       isAwayWin ? 'var(--primary-light)' : 'rgba(255,255,255,0.9)',
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
        style={{ fill: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-sans)', letterSpacing: '0.06em' }}>
        {node.bracketCode.toUpperCase()}
      </text>
    </g>
  );
}

function ConnectorPath({
  fromX, fromY, toX, toY, active,
}: {
  fromX: number; fromY: number;
  toX: number; toY: number;
  active: boolean;
}) {
  const midX = fromX + CONNECTOR_STUB;
  const d    = `M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`;
  return (
    <g>
      <path d={d} fill="none"
        style={{ stroke: 'rgba(var(--primary-rgb), 0.3)', strokeWidth: '1' }} />
      {active && (
        <path d={d} fill="none" strokeDasharray="8 4"
          className="animate-data-flow"
          style={{ stroke: 'var(--primary)', strokeWidth: '1.5' }} />
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

  // Champion — the decided final's winner drives the spotlight banner.
  const finalNode = nodes.find(n => /^FIN/i.test(n.bracketCode) && n.winnerId);
  const championName = finalNode
    ? ((finalNode.winnerId === finalNode.homeTeam?.id ? finalNode.homeTeam?.name : finalNode.awayTeam?.name) ?? null)
    : null;

  // ── SVG layout dimensions ─────────────────────────────────────────────────

  const maxFirstCol = columns.length > 0 ? columns[0].games.length : 1;
  const totalH      = maxFirstCol * (NODE_HEIGHT + NODE_GAP);
  const svgHeight   = totalH + V_PAD * 2;
  // last node ends at (cols-1)*ROUND_WIDTH + 20 (left pad) + NODE_WIDTH; add 20px right pad
  const svgWidth    = (columns.length - 1) * ROUND_WIDTH + NODE_WIDTH + 40;

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
        {columns.map((col, ci) => (
          <text
            key={`lbl-${ci}`}
            x={ci * ROUND_WIDTH + NODE_WIDTH / 2 + 20}
            y={V_PAD - 12}
            fontSize="10"
            fontWeight="700"
            textAnchor="middle"
            style={{
              fill:        'rgba(255,255,255,0.45)',
              fontFamily:  'var(--font-display)',
              letterSpacing: '0.1em',
            }}
          >
            {col.title.toUpperCase()}
          </text>
        ))}

        {/* ── connectors (behind nodes) ── */}
        {columns.map((col, ci) => {
          const nextCol = columns[ci + 1];
          if (!nextCol) return null;
          return col.games.map((_, pi) => {
            const targetPos = Math.floor(pi / 2);
            if (targetPos >= nextCol.games.length) return null;
            const src = nodes.find(n => n.round === ci     && n.position === pi);
            const tgt = nodes.find(n => n.round === ci + 1 && n.position === targetPos);
            if (!src || !tgt) return null;
            return (
              <ConnectorPath
                key={`c-${ci}-${pi}`}
                fromX={ci * ROUND_WIDTH + 20 + NODE_WIDTH}
                fromY={nodeY(pi, col.games.length, totalH) + NODE_HEIGHT / 2}
                toX={(ci + 1) * ROUND_WIDTH + 20}
                toY={nodeY(targetPos, nextCol.games.length, totalH) + NODE_HEIGHT / 2}
                active={src.winnerId !== null}
              />
            );
          });
        })}

        {/* ── match nodes ── */}
        {columns.map((col, ci) =>
          col.games.map((_, pi) => {
            const node = nodes.find(n => n.round === ci && n.position === pi);
            if (!node) return null;
            const nodeMatchesTeam = !!highlightTeamId && (
              node.homeTeam?.id === highlightTeamId || node.awayTeam?.id === highlightTeamId
            );
            return (
              <MatchNode
                key={node.id}
                node={node}
                x={ci * ROUND_WIDTH + 20}
                y={nodeY(pi, col.games.length, totalH)}
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
