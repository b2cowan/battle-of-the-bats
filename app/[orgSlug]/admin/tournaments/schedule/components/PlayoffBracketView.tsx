'use client';
/**
 * THE SCHEDULE'S BRACKET VIEW — one division's playoffs, read the public bracket's way (Tournament admin redesign
 * Stage 3, S6 + S7 / A38 + A43, ruled 2026-10-09).
 *
 *   · Its heading: "U11 playoffs" over its format ("Single elimination · the top 4 of the round robin"), with Edit
 *     bracket the white button above what it acts on (a phone: full width under the bracket).
 *   · A coin toss still owed for its seeds is said HERE, where the seeds wait: the amber note naming the tie and the
 *     games waiting on it, with Record the toss (S7). The waiting game says so once, in its when line.
 *   · Every bracket game shows, whatever the Filter (a played semifinal no longer reads "No playoff bracket yet").
 *     A Search (or a Filter) lists the games it matches in round bands instead (1 October).
 *   · A desk draws the diagram (BracketColumns); a phone reads the rounds as bands in one frame — the day's row, the
 *     winner bold and checked — with the diagram one tap away (Show as diagram: today's zoom frame).
 *   · Split pools and tiers keep one diagram per bracket, named; the champion card ends the division's TOP bracket.
 */
import { Fragment, useState } from 'react';
import { Pencil, Trophy } from 'lucide-react';
import type { Division, Game, Team, Venue } from '@/lib/types';
import { formatPoolName } from '@/lib/utils';
import { groupGamesByBracketId, displayRoundTitle } from '@/lib/playoff-bracket';
import { playoffFormatLabel } from '@/lib/playoff-picture';
import { bracketChampion, bracketSides, playedCount, type BracketChampion } from '@/lib/bracket-reading';
import { gamesWaitingOnToss, type PendingToss } from '@/lib/coin-toss';
import type { ScheduleState } from '@/lib/schedule-day';
import { BRACKET_WORDS as B, COIN_TOSS_WORDS as CT, SCHEDULE_DAY_WORDS as W, bracketWhen } from '@/lib/schedule-words';
import { ClubRow, ClubRowBand, ClubRowFrame, ClubRowList } from '@/components/admin/kit/club/RepKit';
import { CoinTossNote } from '@/components/admin/CoinTossRecorder';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import BracketColumns, { buildBracketColumns, type BracketColumn } from './BracketColumns';
import { ScheduleGameRow } from './ScheduleDayList';
import sd from './ScheduleDay.module.css';
import bv from './BracketView.module.css';

/** Which of the division's pools a playoff game belongs to: its slot names the pool ("1st Pool A"), or it is fed by
 *  (or sits in the same bracket as) a game that does. */
function inferGamePool(game: Game, allGames: Game[], pools: { name: string }[]): string | null {
  for (const pool of pools) {
    const tag = `Pool ${pool.name.replace(/^Pool\s+/i, '').trim()}`;
    if (game.homePlaceholder?.includes(tag) || game.awayPlaceholder?.includes(tag)) return pool.name;
  }
  // "Winner SF1" → that game's pool (matched within the bracket, since codes repeat across pools).
  const ph = game.homePlaceholder || game.awayPlaceholder || '';
  const winnerCode = ph.match(/(?:Winner|Loser) ([\w-]+)/)?.[1];
  if (winnerCode) {
    const source = allGames.find(g => g.bracketCode === winnerCode && g.isPlayoff && g.id !== game.id
      && (game.bracketId ? g.bracketId === game.bracketId : true));
    if (source) return inferGamePool(source, allGames, pools);
  }
  // A hand-added round with no slot: any game of the same bracket that names a pool.
  if (game.bracketId) {
    for (const sibling of allGames) {
      if (sibling.id === game.id || sibling.bracketId !== game.bracketId || !sibling.isPlayoff) continue;
      for (const pool of pools) {
        const tag = `Pool ${pool.name.replace(/^Pool\s+/i, '').trim()}`;
        if (sibling.homePlaceholder?.includes(tag) || sibling.awayPlaceholder?.includes(tag)) return pool.name;
      }
    }
  }
  return null;
}

const hasSplitPoolGames = (games: Game[], pools: { name: string }[]) => pools.length >= 2 && games.some(g =>
  pools.some(p => {
    const tag = `Pool ${p.name.replace(/^Pool\s+/i, '').trim()}`;
    return g.homePlaceholder?.includes(tag) || g.awayPlaceholder?.includes(tag);
  }));

/** One bracket inside the division: its name (split pools, tiers), its games, its champion card. */
interface BracketGroup { key: string; title: string | null; games: Game[]; champion: BracketChampion | null }

export default function PlayoffBracketView({
  games, divisionGames, teams, divisions, division, venues, stateOf, fromRoundRobin, tosses, onRecordToss,
  canEdit, editLabel, onEditBracket, onOpen, focus,
}: {
  /** The division's bracket games — every one, whatever the Filter. */
  games: Game[];
  /** Every game of the division (the champion rule reads the top tier's final among them). */
  divisionGames: Game[];
  teams: Team[];
  divisions: Division[];
  division: Division | undefined;
  venues: Venue[];
  stateOf: (g: Game) => ScheduleState;
  /** The playoffs follow a round robin ("the top 4 of the round robin"); else a playoffs-only event ("4 teams"). */
  fromRoundRobin: boolean;
  /** This division's coin tosses still owed. */
  tosses: PendingToss[];
  onRecordToss: (toss: PendingToss) => void;
  canEdit: boolean;
  /** "Edit bracket", or "Build bracket" before there is one. */
  editLabel: string;
  onEditBracket: () => void;
  onOpen: (g: Game) => void;
  /** A Search or Filter is on: the ids it matches (listed in round bands). */
  focus: ReadonlySet<string> | null;
}) {
  const isPhone = useIsPhone();
  const [diagramOnPhone, setDiagramOnPhone] = useState(false);
  const waiting = gamesWaitingOnToss(tosses);
  const ctx = { teams, divisions, venues };
  const cfg = division?.playoffConfig;
  const caption = division ? B.caption(playoffFormatLabel(cfg), cfg?.teamsQualifying ?? 0, fromRoundRobin) : '';

  // The division's brackets: per pool (split pools), per tier (each its own bracket id), or one.
  const pools = division?.pools ?? [];
  const groups: BracketGroup[] = [];
  if (division && games.length > 0) {
    const champion = (groupGames: Game[], top: boolean) => bracketChampion(division, divisionGames, groupGames, teams, top);
    if (hasSplitPoolGames(games, pools)) {
      pools.forEach((pool, i) => {
        const poolGames = games.filter(g => inferGamePool(g, games, pools) === pool.name);
        if (poolGames.length > 0) groups.push({ key: pool.id, title: `${formatPoolName(pool.name)} playoffs`, games: poolGames, champion: champion(poolGames, i === 0) });
      });
      const other = games.filter(g => inferGamePool(g, games, pools) === null);
      if (other.length > 0) groups.push({ key: 'other', title: 'Other', games: other, champion: null });
    } else {
      const byBracket = groupGamesByBracketId(games);
      if (byBracket.length > 1) {
        byBracket.forEach((grp, i) => groups.push({ key: grp.key, title: grp.label || `Bracket ${i + 1}`, games: grp.games, champion: champion(grp.games, i === 0) }));
      } else {
        groups.push({ key: 'one', title: null, games, champion: champion(games, true) });
      }
    }
  }

  const listForm = focus !== null || (isPhone && !diagramOnPhone);
  const editButton = canEdit ? (
    <button type="button" className="btn btn-outline btn-data" onClick={onEditBracket}>
      <Pencil size={14} aria-hidden /> {editLabel}
    </button>
  ) : null;

  /** A bracket's rounds as bands; a division with more than one bracket names it in each band ("Pool A playoffs ·
   *  Semifinals"), so the frame stays one list of bands. */
  const rounds = (columns: BracketColumn[], champion: BracketChampion | null, prefix: string | null) => (
    <>
      {columns.map(col => {
        const listed = (col.games as Game[]).filter(g => focus === null || focus.has(g.id));
        if (listed.length === 0) return null;
        const title = [prefix, displayRoundTitle(col.title)].filter(Boolean).join(' · ');
        return (
          <ClubRowList key={col.key} inset label={title}>
            <ClubRowBand count={B.played(playedCount(col.games as Game[]), col.games.length)}>{title}</ClubRowBand>
            {listed.map(g => (
              <ScheduleGameRow
                key={g.id}
                ctx={ctx}
                g={g}
                state={stateOf(g)}
                onOpen={onOpen}
                lead={bracketWhen(g.date, g.time) || undefined}
                sides={bracketSides(g, teams)}
                tail={waiting.has(g.id) ? CT.waits : undefined}
              />
            ))}
          </ClubRowList>
        );
      })}
      {champion && focus === null && (
        <ClubRowList inset label={B.champion}>
          <ClubRowBand>{B.champion}</ClubRowBand>
          <ClubRow
            mark={<Trophy size={16} className={bv.championMark} aria-hidden />}
            title={champion.kind === 'decided' ? champion.team : B.championWaiting}
            caption={champion.kind === 'decided' ? champion.caption : champion.either ? B.championEither(champion.either[0], champion.either[1]) : undefined}
          />
        </ClubRowList>
      )}
    </>
  );

  return (
    <div className={sd.list}>
      {division && (
        <div className={bv.head}>
          <div className={bv.headText}>
            <span className={bv.title}>{W.bracketTitle(division.name)}</span>
            {caption && <span className={bv.caption}>{caption}</span>}
          </div>
          {!isPhone && editButton && <div className={bv.headActions}>{editButton}</div>}
        </div>
      )}

      {tosses.map(t => (
        <div key={t.groupKey} className={bv.tossNote}><CoinTossNote toss={t} flush onRecord={onRecordToss} /></div>
      ))}

      {games.length === 0 ? (
        <div className={bv.empty}>
          <Trophy size={36} aria-hidden />
          <b>{B.emptyTitle}</b>
          <p>{B.emptyBody}</p>
        </div>
      ) : (
        <>
          {isPhone && focus === null && (
            <div className={bv.switch}>
              <button type="button" className="btn btn-outline btn-data" onClick={() => setDiagramOnPhone(d => !d)}>
                {diagramOnPhone ? B.showList : B.showDiagram}
              </button>
            </div>
          )}
          {listForm ? (
            <ClubRowFrame>
              {groups.map(grp => (
                <Fragment key={grp.key}>{rounds(buildBracketColumns(grp.games), grp.champion, groups.length > 1 ? grp.title : null)}</Fragment>
              ))}
            </ClubRowFrame>
          ) : (
            groups.map(grp => (
              <div key={grp.key} className={bv.group}>
                {grp.title && groups.length > 1 && <div className={bv.groupTitle}><Trophy size={15} aria-hidden />{grp.title}</div>}
                <BracketColumns
                  columns={buildBracketColumns(grp.games)}
                  teams={teams}
                  venues={venues}
                  stateOf={stateOf}
                  waiting={waiting}
                  champion={grp.champion}
                  onOpen={onOpen}
                />
              </div>
            ))
          )}
        </>
      )}

      {isPhone && editButton && <div className={`${bv.headActions} ${bv.editUnder}`}>{editButton}</div>}
    </div>
  );
}
