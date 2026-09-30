'use client';
/**
 * THE GAME-DAY BOARD — Tournament admin redesign Stage 1 (G2 · G3 · G8), built to hub v5
 * (https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM, Stage 1 tab), ruled 2026-09-29.
 *
 *   [top note — only for a step the lists can't say]            (the page renders it, above)
 *   ┌ To finalize 2 ─────────────── one frame, four lists, in the order of the organizer's day,
 *   │ Needs a score 6                each hidden when empty; each heading carries its count once
 *   │ Playing now 1                  and the rows say nothing about their state (the heading does).
 *   │ Up next 3                      Every row opens THAT game in Results, its score editor open (G3).
 *   └───────────────────────────────
 *   Running late?  (the kit's door card → today's rain-delay window; the plan lock with the plan's name)
 *   The event so far  (games final · teams arrived · one line per division, the champion on its line)
 *   Schedule health  (a row that expands in place — the down chevron)
 *   Customize this board
 *
 * On a phone the lists are ONE white frame with band rows (the portal's S.7 phone form, owner
 * 2026-09-29: "do we need the gap between these on the phone?"); at a desk they take a wide column
 * and the door, the summary and health a narrow one (the summary first there, as drawn).
 *
 * The parts are the kit's, never a second recipe: the row list is the admin's restatement of the
 * portal's `CoachRowList` (`ClubRow*` in the club kit), the cards are the coach kit's `CoachCard` /
 * `CoachDoorCard` (as the Club hub renders them). Customize shows and hides the parts (owner
 * 2026-09-29: "show/hide the parts"); the order is the day's and does not move.
 */
import { useState, type ReactNode } from 'react';
import { ChevronDown, Lock, Trophy } from 'lucide-react';
import { CoachCard, CoachDoorCard, CoachEyebrow, CoachFigure } from '@/components/coaches/kit';
import { ClubRow, ClubRowBand, ClubRowFrame, ClubRowList, RepChip } from '@/components/admin/kit/club/RepKit';
import { GAME_DAY_LIST, GAME_DAY_WORDS, gameWhen } from '@/lib/game-day-words';
import { tournamentToday } from '@/lib/timezone';
import styles from './GameDayBoard.module.css';

type BoardGame = {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  date: string | null;
  time: string | null;
  location: string | null;
  divisionName: string | null;
  isPlayoff: boolean;
  /** A playoff game's own round ("Semifinal"); null for a pool game. */
  round: string | null;
};

type BoardDivision = {
  id: string;
  name: string;
  poolTotal: number;
  poolCompleted: number;
  playoffStarted: boolean;
  latestRound: string | null;
  nextRound: string | null;
  /** The next round as the division line says it: one game by its own name, several by the group's. */
  nextRoundLabel: string | null;
  /** A game of that round is inside its play window now. */
  nextRoundLive: boolean;
};

export type GameDayStats = {
  totalGames: number;
  completed: number;
  /** Every game in a terminal state (completed OR forfeit) — drives "ready to finalize". */
  resolved: number;
  inProgress: number;
  completedPct: number;
  poolGamesTotal: number;
  poolGamesCompleted: number;
  playoffStarted: boolean;
  playoffGamesTotal: number;
  playoffGamesCompleted: number;
  /** Playoff games in a terminal state (completed OR forfeit). */
  playoffResolved: number;
  byDivision: BoardDivision[];
  toFinalizeGames: BoardGame[];
  toFinalizeTotal: number;
  liveGames: BoardGame[];
  liveGamesTotal: number;
  upNextGames: BoardGame[];
  upNextTotal: number;
  needsScoreGames: BoardGame[];
  needsScoreTotal: number;
  /** Unplayed games from today on — the rain-delay tool has something to move. */
  hasGamesToShift: boolean;
};

export const EMPTY_GAME_DAY: GameDayStats = {
  totalGames: 0, completed: 0, resolved: 0, inProgress: 0, completedPct: 0,
  poolGamesTotal: 0, poolGamesCompleted: 0,
  playoffStarted: false, playoffGamesTotal: 0, playoffGamesCompleted: 0, playoffResolved: 0,
  byDivision: [],
  toFinalizeGames: [], toFinalizeTotal: 0,
  liveGames: [], liveGamesTotal: 0,
  upNextGames: [], upNextTotal: 0,
  needsScoreGames: [], needsScoreTotal: 0,
  hasGamesToShift: false,
};

/** The board's parts Customize shows and hides — in the day's order, which Customize never changes. */
export type GameDayPartId = 'toFinalize' | 'needsScore' | 'playingNow' | 'upNext' | 'rainDelay' | 'summary' | 'gdScheduleHealth';
export const GAME_DAY_PARTS: ReadonlyArray<{ id: GameDayPartId; label: string }> = [
  { id: 'toFinalize', label: GAME_DAY_LIST.toFinalize },
  { id: 'needsScore', label: GAME_DAY_LIST.needsScore },
  { id: 'playingNow', label: GAME_DAY_LIST.playingNow },
  { id: 'upNext', label: GAME_DAY_LIST.upNext },
  { id: 'rainDelay', label: GAME_DAY_WORDS.doorTitle },
  { id: 'summary', label: GAME_DAY_WORDS.summaryTitle },
  { id: 'gdScheduleHealth', label: GAME_DAY_WORDS.healthTitle },
];

type Champion = { divisionId: string; divisionName: string; championTeamName: string };
type Health = { score: number; tone: 'good' | 'warning' | 'danger'; issueCount: number; timedGames: number };

/** The top note (G2): the kit's card with its accent edge — not an alert — for a step the lists can't
 *  say. No counts (the list headings carry them) and no button. */
export function BoardNote({ children }: { children: ReactNode }) {
  return (
    <CoachCard accent role="note" className={styles.note}>
      <p>{children}</p>
    </CoachCard>
  );
}

/** "Customize this board" — a quiet link at an active board's foot (G1 moved it out of the title band). */
export function CustomizeLink({ onClick }: { onClick: () => void }) {
  return <button type="button" className={styles.quietLink} onClick={onClick}>{GAME_DAY_WORDS.customize}</button>;
}

/** One game row: the day (when it isn't today) and time lead, the teams, where, the score, the door. */
function BoardRow({ game, href, today, withScore }: { game: BoardGame; href: string; today: string; withScore: boolean }) {
  const when = gameWhen(game.date, game.time, today);
  const caption = [game.location, game.divisionName, game.round].filter(Boolean).join(' · ');
  const score = withScore && game.homeScore != null && game.awayScore != null ? `${game.awayScore}–${game.homeScore}` : null;
  return (
    <ClubRow
      as="link"
      href={href}
      lead={when || undefined}
      title={`${game.awayTeamName} @ ${game.homeTeamName}`}
      caption={caption || undefined}
      trail={score ? <span className={styles.score}>{score}</span> : undefined}
      chevron
    />
  );
}

/** One of the four lists: its band (the words and the count, once), its rows, and a door to the rest. */
function BoardList({
  label, games, total, withScore, today, gameHref, moreHref, showEmpty, 'data-sandbox-tour': tourAnchor,
}: {
  label: string;
  games: BoardGame[];
  total: number;
  withScore: boolean;
  today: string;
  gameHref: (id: string) => string;
  moreHref: string;
  /** Customize shows a list's place even while it has nothing in it. */
  showEmpty: boolean;
  'data-sandbox-tour'?: string;
}) {
  const count = Math.max(total, games.length);
  if (count === 0 && !showEmpty) return null;
  const more = count - games.length;
  return (
    <ClubRowList inset label={label} data-sandbox-tour={tourAnchor}>
      <ClubRowBand count={count}>{label}</ClubRowBand>
      {games.map(g => <BoardRow key={g.id} game={g} href={gameHref(g.id)} today={today} withScore={withScore} />)}
      {more > 0 && <ClubRow as="link" href={moreHref} title={GAME_DAY_WORDS.moreRows(more)} chevron />}
      {count === 0 && <ClubRow title={<span className={styles.emptyRow}>{GAME_DAY_WORDS.nothingHere}</span>} />}
    </ClubRowList>
  );
}

/** A division's line in the summary: the champion once there is one; the pools while any pool game is
 *  still open; then the round still to play (or on now). */
function divisionLine(d: BoardDivision, champ: Champion | undefined): ReactNode {
  if (champ) {
    return <span className={styles.champ}><Trophy size={13} aria-hidden /> {champ.championTeamName}</span>;
  }
  if (d.poolTotal > 0 && d.poolCompleted < d.poolTotal) return GAME_DAY_WORDS.poolGamesFinal(d.poolCompleted, d.poolTotal);
  if (d.playoffStarted) {
    if (!d.nextRoundLabel) return GAME_DAY_WORDS.playoffsDone;
    return d.nextRoundLive ? GAME_DAY_WORDS.roundOnNow(d.nextRoundLabel) : GAME_DAY_WORDS.roundToPlay(d.nextRoundLabel);
  }
  return d.poolTotal > 0 ? GAME_DAY_WORDS.poolGamesFinal(d.poolCompleted, d.poolTotal) : GAME_DAY_WORDS.noGamesYet;
}

export default function GameDayBoard({
  base, planHref, gd, arrived, champions, health, healthBody, canRainDelay, locked, visible, customizing, onCustomize,
}: {
  /** `/{org}/admin/tournaments` */
  base: string;
  /** Plan & billing with the Tournament Plus panel open (the locked door's destination). */
  planHref: string;
  gd: GameDayStats;
  arrived: { checkedIn: number; accepted: number };
  champions: Champion[];
  health: Health;
  /** Schedule health's panel body, opened in place under its row (the page's, shared with the
   *  before-the-event board's panel). */
  healthBody: ReactNode;
  canRainDelay: boolean;
  /** A completed event is read-only: nothing to delay. */
  locked: boolean;
  visible: (id: GameDayPartId) => boolean;
  customizing: boolean;
  /** Opens Customize; null while it is open. */
  onCustomize: (() => void) | null;
}) {
  const [healthOpen, setHealthOpen] = useState(false);
  const today = tournamentToday();
  const gameHref = (id: string) => `${base}/results?gameId=${encodeURIComponent(id)}`;
  const needsYou = `${base}/results`;
  const allGames = `${base}/results?view=all`;
  const listProps = { today, gameHref, showEmpty: customizing };

  const lists = (
    <ClubRowFrame>
      {visible('toFinalize') && (
        <BoardList {...listProps} label={GAME_DAY_LIST.toFinalize} games={gd.toFinalizeGames} total={gd.toFinalizeTotal} withScore moreHref={needsYou} />
      )}
      {visible('needsScore') && (
        <BoardList {...listProps} label={GAME_DAY_LIST.needsScore} games={gd.needsScoreGames} total={gd.needsScoreTotal} withScore={false} moreHref={needsYou} />
      )}
      {visible('playingNow') && (
        // The demo tour's "Watch a score land" step rings this list (it renders only while a game is live).
        <BoardList {...listProps} label={GAME_DAY_LIST.playingNow} games={gd.liveGames} total={gd.liveGamesTotal} withScore moreHref={needsYou} data-sandbox-tour="now-playing" />
      )}
      {visible('upNext') && (
        <BoardList {...listProps} label={GAME_DAY_LIST.upNext} games={gd.upNextGames} total={gd.upNextTotal} withScore={false} moreHref={allGames} />
      )}
    </ClubRowFrame>
  );
  const anyList = customizing || (['toFinalize', 'needsScore', 'playingNow', 'upNext'] as const).some(id => {
    if (!visible(id)) return false;
    const n = id === 'toFinalize' ? gd.toFinalizeTotal : id === 'needsScore' ? gd.needsScoreTotal : id === 'playingNow' ? gd.liveGamesTotal : gd.upNextTotal;
    return n > 0;
  });

  // The rain-delay door: while the event has unplayed games from today on and is not locked. On the
  // Tournament plan it keeps its place with the lock and the plan's name, and opens what Plus includes.
  const door = visible('rainDelay') && gd.hasGamesToShift && !locked ? (
    canRainDelay ? (
      <CoachDoorCard href={`${base}/schedule?tool=rain-delay`} className={styles.door}>
        <CoachEyebrow arrow>{GAME_DAY_WORDS.doorEyebrow}</CoachEyebrow>
        <span className={styles.doorTitle}>{GAME_DAY_WORDS.doorTitle}</span>
        <span className={styles.doorLine}>{GAME_DAY_WORDS.doorLine}</span>
      </CoachDoorCard>
    ) : (
      <CoachDoorCard href={planHref} className={styles.door}>
        <CoachEyebrow chip={<RepChip><Lock size={10} aria-hidden /> {GAME_DAY_WORDS.doorLockedPlan}</RepChip>}>
          {GAME_DAY_WORDS.doorEyebrow}
        </CoachEyebrow>
        <span className={styles.doorTitle}>{GAME_DAY_WORDS.doorTitle}</span>
        <span className={styles.doorLine}>{GAME_DAY_WORDS.doorLockedLine}</span>
      </CoachDoorCard>
    )
  ) : null;

  const summary = visible('summary') && (gd.totalGames > 0 || arrived.accepted > 0 || gd.byDivision.length > 0) ? (
    <CoachCard className={styles.summary}>
      <h2 className={styles.cardTitle}>{GAME_DAY_WORDS.summaryTitle}</h2>
      {(gd.totalGames > 0 || arrived.accepted > 0) && (
        <div className={styles.figs}>
          {gd.totalGames > 0 && (
            <div>
              <CoachFigure>{gd.resolved} / {gd.totalGames}</CoachFigure>
              <span className={styles.figLabel}>{GAME_DAY_WORDS.gamesFinal}</span>
            </div>
          )}
          {arrived.accepted > 0 && (
            <div>
              <CoachFigure>{arrived.checkedIn} / {arrived.accepted}</CoachFigure>
              <span className={styles.figLabel}>{GAME_DAY_WORDS.teamsArrived}</span>
            </div>
          )}
        </div>
      )}
      {gd.byDivision.length > 0 && (
        <ul className={styles.divLines}>
          {gd.byDivision.map(d => (
            <li key={d.id} className={styles.divLine}>
              <b>{d.name}</b>
              <span>{divisionLine(d, champions.find(c => c.divisionId === d.id))}</span>
            </li>
          ))}
        </ul>
      )}
    </CoachCard>
  ) : null;

  const healthCaption = health.timedGames > 0
    ? GAME_DAY_WORDS.healthCaption(health.tone, health.issueCount)
    : GAME_DAY_WORDS.healthNotBuilt;
  const healthRow = visible('gdScheduleHealth') ? (
    // The demo tour's "Break the schedule" step rings this row (and the schedule's own panel).
    <div className={styles.health} data-sandbox-tour="schedule-health">
      <button type="button" className={styles.healthRow} aria-expanded={healthOpen} onClick={() => setHealthOpen(o => !o)}>
        <span className={styles.healthScore} data-tone={health.timedGames > 0 ? health.tone : undefined}>
          {health.timedGames > 0 ? health.score : '—'}
        </span>
        <span className={styles.healthText}>
          <span className={styles.healthTitle}>{GAME_DAY_WORDS.healthTitle}</span>
          <span className={styles.healthCaption}>{healthCaption}</span>
        </span>
        <ChevronDown size={16} className={styles.healthChevron} aria-hidden />
      </button>
      {healthOpen && <div className={styles.healthBody}>{healthBody}</div>}
    </div>
  ) : null;

  return (
    <div className={styles.board}>
      {anyList && <div className={styles.lists}>{lists}</div>}
      <div className={styles.side}>
        {door}
        {summary}
        {healthRow}
        {onCustomize && <CustomizeLink onClick={onCustomize} />}
      </div>
    </div>
  );
}
