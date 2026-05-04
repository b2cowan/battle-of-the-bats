'use client';

import { useEffect, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase-browser';
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

// ── SVG sub-components — use org CSS variables, not FieldLogic tokens ────────

function MatchNode({ node, x, y }: { node: BracketNode; x: number; y: number }) {
  const isHomeWin = node.winnerId === node.homeTeam?.id;
  const isAwayWin = node.winnerId === node.awayTeam?.id;

  return (
    <g transform={`translate(${x},${y})`}>
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
      {/* divider */}
      <line x1="0" y1={NODE_HEIGHT / 2} x2={NODE_WIDTH} y2={NODE_HEIGHT / 2}
        style={{ stroke: 'rgba(var(--primary-rgb), 0.2)', strokeWidth: '1' }} />

      {/* home team name */}
      <text x="10" y="24" fontSize="11" fontWeight="700"
        style={{
          fill:       isHomeWin ? 'var(--primary-light)' : 'rgba(255,255,255,0.9)',
          fontFamily: 'var(--font-sans)',
        }}>
        {(node.homeTeam?.name ?? 'TBD').slice(0, 20)}
      </text>
      {node.homeScore !== null && (
        <text x={NODE_WIDTH - 10} y="24"
          fontSize="14" fontWeight="900" textAnchor="end"
          style={{ fill: 'var(--primary-light)', fontFamily: 'var(--font-display)' }}>
          {node.homeScore}
        </text>
      )}

      {/* away team name */}
      <text x="10" y={NODE_HEIGHT - 14} fontSize="11" fontWeight="700"
        style={{
          fill:       isAwayWin ? 'var(--primary-light)' : 'rgba(255,255,255,0.9)',
          fontFamily: 'var(--font-sans)',
        }}>
        {(node.awayTeam?.name ?? 'TBD').slice(0, 20)}
      </text>
      {node.awayScore !== null && (
        <text x={NODE_WIDTH - 10} y={NODE_HEIGHT - 14}
          fontSize="14" fontWeight="900" textAnchor="end"
          style={{ fill: 'var(--primary-light)', fontFamily: 'var(--font-display)' }}>
          {node.awayScore}
        </text>
      )}

      {/* bracket code badge (sits on the divider line) */}
      <rect x="8" y={NODE_HEIGHT / 2 - 7} width="32" height="13" rx={3}
        style={{
          fill:        'rgba(var(--primary-rgb), 0.15)',
          stroke:      'rgba(var(--primary-rgb), 0.35)',
          strokeWidth: '0.5',
        }} />
      <text x="24" y={NODE_HEIGHT / 2 + 3.5}
        fontSize="6.5" fontWeight="700" textAnchor="middle"
        style={{ fill: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-sans)', letterSpacing: '0.06em' }}>
        {node.bracketCode.toUpperCase()}
      </text>

      {/* LIVE badge — visible for 5s after a Realtime score update */}
      {node.isLive && (
        <g>
          <rect x={NODE_WIDTH - 38} y="4" width="33" height="13" rx={3}
            style={{
              fill:        'rgba(var(--primary-rgb), 0.2)',
              stroke:      'var(--primary)',
              strokeWidth: '0.5',
            }} />
          <text x={NODE_WIDTH - 21.5} y="13.5"
            fontSize="7" fontWeight="700" textAnchor="middle"
            style={{ fill: 'var(--primary-light)', fontFamily: 'var(--font-sans)', letterSpacing: '0.1em' }}>
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
}

export function LogicSyncBracket({ games, teams, tournamentId }: LogicSyncBracketProps) {
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
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }} className="py-4">
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
    </div>
  );
}
