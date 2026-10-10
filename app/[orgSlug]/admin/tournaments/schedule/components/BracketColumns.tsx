'use client';
/**
 * THE BRACKET DIAGRAM — round columns wired by the measured connectors, read the public bracket's way (Tournament admin
 * redesign Stage 3, S6 / A38, ruled 2026-10-09).
 *
 * Each card: its when line (day, time, field, round — and the state the score can't say), then the two sides: the
 * team once known with the slot it came from under it ("Seed 1", "Semifinal 1 winner"), the score once played, and
 * the winner in plain ink, bold, with a check (lib/bracket-reading.ts — the champion rule's `isDecided`). A card is
 * the button that opens the game (S2); the pencil and the trash can on every card are gone (Edit bracket and the
 * game window hold them). The champion closes the diagram: "Decided by the final" until it is, then the finished
 * board's sentence.
 *
 * Without `teams` it is the playoff generator's preview: the slots only, nothing to open.
 *
 * Single elimination, double elimination (the shared seed round, then the winners bracket over the losers bracket,
 * the grand final last) and consolation all lay out as ordered columns (`bracketRoundInfo` / `computeBracketColumns`).
 */
import { useRef, type ReactNode } from 'react';
import { Check, ChevronRight, Trophy } from 'lucide-react';
import type { Game, Venue } from '@/lib/types';
import { bracketGameLabel, bracketRoundInfo, computeBracketColumns, displayBracketRefs, displayRoundTitle } from '@/lib/playoff-bracket';
import { bracketSides, type BracketChampion, type BracketSide } from '@/lib/bracket-reading';
import { resolveGameFieldLabel } from '@/lib/venue-label';
import { BRACKET_WORDS as B, COIN_TOSS_WORDS as CT, bracketWhen, slotWords } from '@/lib/schedule-words';
import type { ScheduleState } from '@/lib/schedule-day';
import BracketConnectors from './BracketConnectors';
import BracketZoomFrame from './BracketZoomFrame';
import { stateChip } from './ScheduleDayList';
import bv from './BracketView.module.css';

const NO_BREAK = String.fromCharCode(0xa0);

/** The slice of a game the diagram reads — a saved game, or a generator preview row mapped to one. */
export type BracketGame = Pick<Game, 'id'> & Partial<Game>;
export interface BracketColumn { key: string; title: string; games: BracketGame[] }

/**
 * Group games into ordered round columns via the shared bracketRoundInfo(), so single elimination, double
 * elimination (winners/losers/grand final) and consolation all render as ordered columns. Connectors are inferred
 * from the Winner/Loser placeholders, so they follow any format.
 */
export function buildBracketColumns(games: BracketGame[]): BracketColumn[] {
  const sortByCode = (a: BracketGame, b: BracketGame) => {
    if (/^FIN/i.test(a.bracketCode || '') && /^3RD/i.test(b.bracketCode || '')) return -1;
    if (/^3RD/i.test(a.bracketCode || '') && /^FIN/i.test(b.bracketCode || '')) return 1;
    return (a.bracketCode || '').localeCompare(b.bracketCode || '');
  };
  const colMap = computeBracketColumns(games);
  const groups = new Map<string, { key: string; title: string; rank: number; games: BracketGame[] }>();
  for (const g of games) {
    let info = colMap.get(g.id) || bracketRoundInfo(g.bracketCode || '');
    // The "if necessary" reset is its own column just right of the Grand Final.
    if ((g.bracketCode || '').toUpperCase() === 'GF2') {
      info = { key: 'GF2', title: 'Grand Final Game 2 (If Necessary)', rank: 501 };
    }
    let grp = groups.get(info.key);
    if (!grp) { grp = { key: info.key, title: info.title, rank: info.rank, games: [] }; groups.set(info.key, grp); }
    grp.games.push(g);
  }
  return [...groups.values()]
    .sort((a, b) => a.rank - b.rank)
    .map(grp => ({ key: grp.key, title: grp.title, games: grp.games.sort(sortByCode) }));
}

/** The slots only — the generator's preview, before there are teams. */
function slotSides(g: BracketGame): { away: BracketSide; home: BracketSide } {
  const slot = (ph?: string | null): BracketSide => ({
    name: slotWords(displayBracketRefs(ph)) || 'TBD', slot: null, score: null, won: false, known: false,
  });
  return { away: slot(g.awayPlaceholder), home: slot(g.homePlaceholder) };
}

function Side({ side }: { side: BracketSide }) {
  return (
    <div className={bv.side} data-won={side.won || undefined}>
      <span className={bv.team}>
        <span className={bv.name}>
          {side.name}
          {side.won && <Check size={14} className={bv.check} aria-label="won" />}
        </span>
        {side.slot && <span className={bv.slot}>{side.slot}</span>}
      </span>
      <span className={bv.score}>{side.score ?? ''}</span>
    </div>
  );
}

export function ChampionCard({ champion }: { champion: BracketChampion }) {
  return champion.kind === 'decided' ? (
    <div className={bv.champion}>
      <Trophy size={18} aria-hidden />
      <b>{champion.team}</b>
      <span>{champion.caption}</span>
    </div>
  ) : (
    <div className={bv.champion} data-waiting>
      <Trophy size={18} aria-hidden />
      <b>{B.championWaiting}</b>
      {champion.either && <span>{B.championEither(champion.either[0], champion.either[1])}</span>}
    </div>
  );
}

export default function BracketColumns({ columns, teams, venues, stateOf, waiting, champion, onOpen }: {
  columns: BracketColumn[];
  /** The bracket read with its teams, scores and winners. Absent: the generator's preview (the slots only). */
  teams?: readonly { id: string; name: string }[];
  /** Resolves a game's field label live (instead of the stored snapshot) — the diamond, as the public bracket names it. */
  venues?: Venue[];
  /** The state the score can't say, as the day's chip ("Playing now"). */
  stateOf?: (g: Game) => ScheduleState;
  /** Games whose slots wait on a coin toss. */
  waiting?: ReadonlySet<string>;
  /** The champion at the diagram's end; null or absent draws none. */
  champion?: BracketChampion | null;
  /** A card opens its game. Absent (the preview): the cards are not buttons. */
  onOpen?: (g: Game) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const connectorMatchups = columns.flatMap(c => c.games).map(g => ({
    id: g.id,
    code: g.bracketCode || '',
    home: { label: g.homePlaceholder || '' },
    away: { label: g.awayPlaceholder || '' },
  }));
  const gfFinalCols = columns.filter(c => c.key === 'GF' || c.key === 'GF2');
  const finalCol = columns.find(c => c.title === 'Finals') ?? columns[columns.length - 1];
  const finalGameIds = new Set<string>(
    (gfFinalCols.length ? gfFinalCols.flatMap(c => c.games) : (finalCol?.games ?? [])).map(g => g.id),
  );

  // Double elimination → a shared SEED round (round 1) first, then the bracket FORKS into the winners bracket (top)
  // and losers bracket (bottom), with the grand final on the far right, so every feed flows forward.
  const isDoubleElim = columns.some(c => /^LB\d/.test(c.key || ''));
  const indexed = columns.map((col, idx) => ({ col, idx }));
  const wbRound = (key: string) => { const m = /^WB(\d+)$/.exec(key || ''); return m ? parseInt(m[1], 10) : null; };
  const seedCols = indexed.filter(({ col }) => wbRound(col.key) === 1);
  const winnersCols = indexed.filter(({ col }) => (wbRound(col.key) ?? 0) >= 2);
  const losersCols = indexed.filter(({ col }) => /^LB\d/.test(col.key || ''));
  const gfCols = indexed.filter(({ col }) => col.key === 'GF' || col.key === 'GF2');
  const hasLoserPath = connectorMatchups.some(m => /^loser\s/i.test(m.home.label) || /^loser\s/i.test(m.away.label));

  const card = (g: BracketGame) => {
    const full = g as Game;
    const sides = teams ? bracketSides(full, teams) : slotSides(g);
    const field = (venues ? resolveGameFieldLabel(full, venues) : g.location) || '';
    const round = g.bracketCode ? bracketGameLabel(g.bracketCode) : '';
    // The when line breaks only between its parts, never inside one ("Semifinal" / "1").
    const when = [bracketWhen(g.date, g.time), field, round, waiting?.has(g.id) ? CT.waits : ''].filter(Boolean)
      .map(part => part.replace(/ /g, NO_BREAK)).join(' · ');
    const chip = stateOf ? stateChip(full, stateOf(full)) : null;
    const body: ReactNode = (
      <>
        <span className={bv.when}>{when}{chip}</span>
        {onOpen && <ChevronRight size={16} className={bv.go} aria-hidden />}
        <Side side={sides.home} />
        <span className={bv.divider} aria-hidden />
        <Side side={sides.away} />
      </>
    );
    const final = finalGameIds.has(g.id) || undefined;
    return onOpen ? (
      <button
        key={g.id}
        type="button"
        className={bv.card}
        data-matchup-id={g.id}
        data-final={final}
        aria-haspopup="dialog"
        aria-label={B.cardLabel(round || B.champion, sides.home.name, sides.away.name)}
        onClick={() => onOpen(full)}
      >
        {body}
      </button>
    ) : (
      <div key={g.id} className={bv.card} data-matchup-id={g.id} data-final={final}>{body}</div>
    );
  };

  const renderColumn = ({ col, idx }: { col: BracketColumn; idx: number }) => {
    const isFinals = col.title === 'Finals' || col.key === 'GF';
    return (
      <div key={idx} className={bv.column}>
        <div className={bv.roundTitle}>{displayRoundTitle(col.title)}</div>
        <div className={`${bv.games}${isFinals ? ` ${bv.gamesFinal}` : ''}`}>{col.games.map(card)}</div>
      </div>
    );
  };
  const championColumn = champion ? (
    <div className={bv.column}>
      <div className={bv.roundTitle}>{B.champion}</div>
      <div className={`${bv.games} ${bv.gamesFinal}`}><ChampionCard champion={champion} /></div>
    </div>
  ) : null;

  return (
    <div className={bv.wrap}>
      {hasLoserPath && (
        <div className={bv.legend}>
          <span><i aria-hidden /> {B.winnerAdvances}</span>
          <span><i className={bv.loss} aria-hidden /> {B.loserDrops}</span>
        </div>
      )}
      <BracketZoomFrame fitKey={columns.map(c => `${c.key}:${c.games.length}`).join('|')}>
        {(zoom: number) => (
          <div ref={canvasRef} className={`${bv.canvas}${isDoubleElim ? ` ${bv.canvasTiered}` : ''}`}>
            <BracketConnectors canvasRef={canvasRef} matchups={connectorMatchups} finalIds={finalGameIds} scale={zoom} />
            {isDoubleElim ? (
              <>
                {seedCols.length > 0 && <div className={bv.section}>{seedCols.map(renderColumn)}</div>}
                <div className={bv.split}>
                  {winnersCols.length > 0 && (
                    <div className={bv.section}>
                      <div className={bv.tierLabel}><Trophy size={11} aria-hidden /> {B.winnersBracket}</div>
                      <div className={bv.row}>{winnersCols.map(renderColumn)}</div>
                    </div>
                  )}
                  <div className={bv.section}>
                    <div className={bv.tierLabel}>{B.losersBracket}</div>
                    <div className={bv.row}>{losersCols.map(renderColumn)}</div>
                  </div>
                </div>
                {(gfCols.length > 0 || championColumn) && (
                  <div className={bv.section}><div className={bv.row}>{gfCols.map(renderColumn)}{championColumn}</div></div>
                )}
              </>
            ) : (
              <>
                {columns.map((col, idx) => renderColumn({ col, idx }))}
                {championColumn}
              </>
            )}
          </div>
        )}
      </BracketZoomFrame>
    </div>
  );
}
