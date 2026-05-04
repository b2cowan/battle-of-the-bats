'use client';

import { useEffect, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase-browser';
import { HudSkeleton } from '@/components/ui/HudSkeleton';
import type { Game, Team } from '@/lib/types';
import type { BracketNode } from '@/lib/types/bracket';

// ── layout constants ───────────────────────────────────────────────────────────

const ROUND_WIDTH    = 240;
const NODE_HEIGHT    = 80;
const NODE_GAP       = 24;
const NODE_WIDTH     = 200;
const CONNECTOR_STUB = 40;
const V_PAD          = 32;

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

function makeNode(game: Game, round: number, position: number, teams: Team[]): BracketNode {
  const resolveName = (id: string, placeholder: string | undefined) =>
    isReal(id) ? (teams.find(t => t.id === id)?.name ?? placeholder ?? 'TBD') : (placeholder ?? 'TBD');

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

// ── SVG sub-components ────────────────────────────────────────────────────────

function MatchNode({ node, x, y }: { node: BracketNode; x: number; y: number }) {
  const isHomeWin  = node.winnerId === node.homeTeam?.id;
  const isAwayWin  = node.winnerId === node.awayTeam?.id;
  const border     = node.isLive ? '#D9F99D' : '#1E3A8A';
  const glowFilter = node.isLive ? 'url(#glow-lime)' : undefined;

  return (
    <g transform={`translate(${x},${y})`}>
      {/* card background */}
      <rect
        width={NODE_WIDTH} height={NODE_HEIGHT}
        fill="#111827" stroke={border} strokeWidth="1"
        filter={glowFilter}
      />
      {/* divider */}
      <line x1="0" y1={NODE_HEIGHT / 2} x2={NODE_WIDTH} y2={NODE_HEIGHT / 2}
        stroke="#1E3A8A" strokeWidth="1" />

      {/* home team name */}
      <text x="10" y="24"
        fill={isHomeWin ? '#D9F99D' : '#F1F5F9'}
        fontFamily="'IBM Plex Mono', monospace" fontSize="11" fontWeight="700">
        {(node.homeTeam?.name ?? 'TBD').slice(0, 20)}
      </text>
      {node.homeScore !== null && (
        <text x={NODE_WIDTH - 10} y="24"
          fill="#D9F99D" fontFamily="'IBM Plex Mono', monospace"
          fontSize="13" fontWeight="700" textAnchor="end">
          {node.homeScore}
        </text>
      )}

      {/* away team name */}
      <text x="10" y={NODE_HEIGHT - 14}
        fill={isAwayWin ? '#D9F99D' : '#F1F5F9'}
        fontFamily="'IBM Plex Mono', monospace" fontSize="11" fontWeight="700">
        {(node.awayTeam?.name ?? 'TBD').slice(0, 20)}
      </text>
      {node.awayScore !== null && (
        <text x={NODE_WIDTH - 10} y={NODE_HEIGHT - 14}
          fill="#D9F99D" fontFamily="'IBM Plex Mono', monospace"
          fontSize="13" fontWeight="700" textAnchor="end">
          {node.awayScore}
        </text>
      )}

      {/* bracket code badge (on divider) */}
      <rect x="8" y={NODE_HEIGHT / 2 - 6} width="30" height="12"
        fill="rgba(30,58,138,0.25)" stroke="rgba(30,58,138,0.5)" strokeWidth="0.5" />
      <text x="23" y={NODE_HEIGHT / 2 + 4}
        fill="#94A3B8" fontFamily="'IBM Plex Mono', monospace"
        fontSize="6.5" fontWeight="700" textAnchor="middle" letterSpacing="0.08em">
        {node.bracketCode.toUpperCase()}
      </text>

      {/* LIVE badge — only while isLive */}
      {node.isLive && (
        <g>
          <rect x={NODE_WIDTH - 38} y="3" width="34" height="13"
            fill="rgba(217,249,157,0.12)" stroke="#D9F99D" strokeWidth="0.5" />
          <text x={NODE_WIDTH - 21} y="12.5"
            fill="#D9F99D" fontFamily="'IBM Plex Mono', monospace"
            fontSize="7" fontWeight="700" textAnchor="middle" letterSpacing="0.12em">
            LIVE
          </text>
        </g>
      )}
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
      <path d={d} stroke="#1E3A8A" strokeWidth="1" fill="none" opacity="0.5" />
      {active && (
        <path d={d}
          stroke="#D9F99D" strokeWidth="1.5" fill="none"
          strokeDasharray="8 4"
          className="animate-data-flow"
        />
      )}
    </g>
  );
}

// ── main component ────────────────────────────────────────────────────────────

interface LogicSyncBracketProps {
  games: Game[];
  teams: Team[];
  tournamentId: string;
}

export function LogicSyncBracket({ games, teams, tournamentId }: LogicSyncBracketProps) {
  const supabase   = createClient();
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

    const channel = supabase
      .channel(`bracket-${tournamentId}`)
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
                ? { ...n, homeScore: hs, awayScore: as, winnerId, isLive: true }
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
  }, [tournamentId, supabase]);

  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Trophy size={48} className="mb-4 opacity-20 text-data-gray" />
        <p className="font-mono text-xs text-data-gray/50 uppercase tracking-widest">
          No playoff games scheduled yet.
        </p>
      </div>
    );
  }

  if (nodes.length === 0) {
    return <HudSkeleton message="COMPUTING BRACKET MATRIX..." rows={4} />;
  }

  // ── SVG layout dimensions ─────────────────────────────────────────────────

  const maxFirstCol = columns.length > 0 ? columns[0].games.length : 1;
  const totalH      = maxFirstCol * (NODE_HEIGHT + NODE_GAP);
  const svgHeight   = totalH + V_PAD * 2;
  const svgWidth    = columns.length * ROUND_WIDTH + NODE_WIDTH + 60;

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
      className="py-4"
    >
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="block"
      >
        {/* ── glow filters ── */}
        <defs>
          <filter id="glow-lime" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-blue" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
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
            fill="#94A3B8"
            fontFamily="'IBM Plex Mono', monospace"
            fontSize="9"
            fontWeight="700"
            textAnchor="middle"
            letterSpacing="0.1em"
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
            return (
              <MatchNode
                key={node.id}
                node={node}
                x={ci * ROUND_WIDTH + 20}
                y={nodeY(pi, col.games.length, totalH)}
              />
            );
          })
        )}
      </svg>
    </div>
  );
}
