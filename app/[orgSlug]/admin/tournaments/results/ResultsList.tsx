'use client';
/**
 * RESULTS' LIST — Tournament admin redesign Stage 1 (G4 · G5, F09's tie), built to hub v5
 * (https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM, Stage 1 tab), ruled 2026-09-29.
 *
 * One frame of banded lists, the game-day board's form: To finalize · Needs a score · Playing now
 * ("Needs you"), then Scheduled · Final on "All games" (owner 2026-09-29: the same bands, every state).
 * The band is the state, so a row never repeats it; only a result the score can't say wears a chip
 * (Tie, Forfeit). Each row is ONE button that opens its score editor in place, inside the frame,
 * outlined while open (the 22px pencil and the bare tick are gone). A To finalize row carries one
 * worded Finalize beside its chevron — olive on white (A12); the lime is the editor's.
 *
 * Replaces the game list's scoring mode (`schedule/components/GameList.tsx` mode="scoring", deleted
 * with it) — the schedule keeps the planning list.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import type { Division, Game, Team, Tournament, Venue } from '@/lib/types';
import { ClubRow, ClubRowBand, ClubRowFrame, ClubRowList, RepChip, RowAction } from '@/components/admin/kit/club/RepKit';
import { GAME_DAY_LIST, GAME_DAY_WORDS, GAME_STATE_WORD, PENDING_FORFEIT, gameWhen } from '@/lib/game-day-words';
import { resolveGameTiming } from '@/lib/schedule-conflict';
import { gameWindowState } from '@/lib/game-live-state';
import { bracketRoundLabel } from '@/lib/playoff-bracket';
import { resolveGameFieldLabel } from '@/lib/venue-label';
import { scoreSubmissionSummary } from '@/lib/tournament-score-audit';
import styles from './results-admin.module.css';

export type ResultsBand = 'toFinalize' | 'needsScore' | 'playingNow' | 'scheduled' | 'final';
/** "Needs you": the games an organizer can act on now. */
export const NEEDS_YOU_BANDS: readonly ResultsBand[] = ['toFinalize', 'needsScore', 'playingNow'];
export const ALL_BANDS: readonly ResultsBand[] = ['toFinalize', 'needsScore', 'playingNow', 'scheduled', 'final'];
const BAND_LABEL: Record<ResultsBand, string> = {
  toFinalize: GAME_DAY_LIST.toFinalize,
  needsScore: GAME_DAY_LIST.needsScore,
  playingNow: GAME_DAY_LIST.playingNow,
  scheduled: GAME_DAY_LIST.scheduled,
  final: GAME_DAY_LIST.final,
};

/**
 * The band a game sits in now; null = cancelled (never listed, as before). The play-window test is
 * the dashboard's shared classifier (`lib/game-live-state`) in the org's zone, so Results and the
 * board agree about what is overdue, live or still to come.
 */
export function bandFor(
  g: Game,
  divisions: Division[],
  tournament: Tournament | null | undefined,
  nowMs: number,
  today: string,
): ResultsBand | null {
  if (g.status === 'submitted') return 'toFinalize';
  if (g.status === 'completed' || g.status === 'forfeit') return 'final';
  if (g.status !== 'scheduled') return null;
  const { durationMinutes } = resolveGameTiming(divisions.find(d => d.id === g.divisionId), tournament, g.durationMinutes);
  const w = gameWindowState({ date: g.date, time: g.time, durationMinutes, nowMs, today });
  return w === 'live' ? 'playingNow' : w === 'overdue' ? 'needsScore' : 'scheduled';
}

/** The one word for a game's state (G5) — what the export's Status column says. */
export function gameStateWord(g: Game, band: ResultsBand | null): string {
  if (g.status === 'cancelled') return 'Cancelled';
  if (band === 'toFinalize') return g.scoreSubmissionSource === 'forfeit' ? PENDING_FORFEIT : GAME_STATE_WORD.pendingReview;
  if (band === 'final') return g.status === 'forfeit' ? GAME_STATE_WORD.forfeit : GAME_STATE_WORD.final;
  if (band === 'needsScore') return GAME_STATE_WORD.needsScore;
  return GAME_DAY_LIST.scheduled;
}

type Ctx = {
  teams: Team[];
  divisions: Division[];
  venues: Venue[];
  today: string;
};

function teamName(ctx: Ctx, id: string | undefined, placeholder?: string) {
  return (id && ctx.teams.find(t => t.id === id)?.name) || placeholder || 'TBD';
}
const isNoShow = (ctx: Ctx, id?: string) => !!id && ctx.teams.find(t => t.id === id)?.checkInStatus === 'no_show';

/** "Maple Field 2 · U13 Boys · Semifinal" — where, which division, which round. */
function whereLine(ctx: Ctx, g: Game) {
  const field = resolveGameFieldLabel(g, ctx.venues) || g.location || '';
  const division = ctx.divisions.find(d => d.id === g.divisionId)?.name ?? '';
  const round = g.isPlayoff ? bracketRoundLabel(g.bracketCode) : '';
  return [field, division, round].filter(Boolean).join(' · ');
}

/** A team's name, with the No-show tag the check-in board set. */
function TeamName({ ctx, id, placeholder }: { ctx: Ctx; id?: string; placeholder?: string }) {
  return (
    <span className={styles.teamName}>
      {isNoShow(ctx, id) && <span className={styles.noShowTag}>No-show</span>}
      {teamName(ctx, id, placeholder)}
    </span>
  );
}

function ResultRow({ ctx, g, band, canFinalize, onOpen, onFinalize, finalizing }: {
  ctx: Ctx;
  g: Game;
  band: ResultsBand;
  canFinalize: boolean;
  onOpen: (id: string) => void;
  onFinalize: (id: string) => void;
  finalizing: boolean;
}) {
  const scored = (band === 'toFinalize' || band === 'final') && g.homeScore != null && g.awayScore != null;
  const tie = scored && g.status !== 'forfeit' && g.homeScore === g.awayScore;
  const awayWon = scored && !tie && (g.awayScore ?? 0) > (g.homeScore ?? 0);
  const homeWon = scored && !tie && (g.homeScore ?? 0) > (g.awayScore ?? 0);
  // Only a result the score can't say wears a word: a forfeit, a tie. The band says the rest.
  const chip = g.status === 'forfeit' || g.scoreSubmissionSource === 'forfeit' ? GAME_STATE_WORD.forfeit : tie ? GAME_STATE_WORD.tie : null;
  const when = gameWhen(g.date, g.time, ctx.today);
  const where = whereLine(ctx, g);
  return (
    <ClubRow
      as="button"
      onClick={() => onOpen(g.id)}
      lead={when || undefined}
      captionFirst
      title={
        <span className={styles.teams}>
          <TeamName ctx={ctx} id={g.awayTeamId} placeholder={g.awayPlaceholder} />
          <span className={styles.teamScore} data-won={awayWon || undefined}>{scored ? g.awayScore : ''}</span>
          <TeamName ctx={ctx} id={g.homeTeamId} placeholder={g.homePlaceholder} />
          <span className={styles.teamScore} data-won={homeWon || undefined}>{scored ? g.homeScore : ''}</span>
        </span>
      }
      caption={where || undefined}
      trail={chip ? <RepChip>{chip}</RepChip> : undefined}
      chevron
      beside={band === 'toFinalize' && canFinalize ? (
        <RowAction onClick={() => onFinalize(g.id)} disabled={finalizing} icon={<Check size={14} aria-hidden />}>
          {GAME_DAY_WORDS.finalize}
        </RowAction>
      ) : undefined}
    />
  );
}

type EditorActions = {
  onSaveScore: (id: string, home: number, away: number) => Promise<void>;
  onForfeit: (id: string, winningSide: 'home' | 'away') => Promise<void>;
  onFinalize: (id: string) => Promise<void>;
  onRevert: (id: string) => void;
};

/**
 * The score editor, open in its row's place inside the frame (G4): 44px steppers either side of a
 * 52px numeral box (the scorekeeper's lesson — steppers must leave the numeral room), a Tie line
 * while the scores are level, and today's actions. The lime is ONE: Save score — or, on a score a
 * scorekeeper submitted and the organizer hasn't changed, Finalize (the board's two taps: the row,
 * then Finalize). Forfeit keeps its red (§245).
 */
function ScoreEditor({ ctx, g, band, canFinalize, actions, onClose }: { ctx: Ctx; g: Game; band: ResultsBand; canFinalize: boolean; actions: EditorActions; onClose: () => void }) {
  const initialAway = g.awayScore != null ? String(g.awayScore) : '';
  const initialHome = g.homeScore != null ? String(g.homeScore) : '';
  const [away, setAway] = useState(initialAway);
  const [home, setHome] = useState(initialHome);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forfeitMode, setForfeitMode] = useState(false);
  const firstInput = useRef<HTMLInputElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { (firstInput.current ?? closeButton.current)?.focus({ preventScroll: true }); }, []);

  // A final result is the finalizer's to change (owner 2026-10-07; the games route refuses anyone else).
  // Without that power the editor reads the result rather than offering controls the server would refuse.
  const locked = band === 'final' && !canFinalize;

  const hasScore = g.status === 'completed' || g.status === 'submitted';
  const canForfeit = !!g.homeTeamId && !!g.awayTeamId && g.status === 'scheduled';
  const edited = away !== initialAway || home !== initialHome;
  // A pending forfeit too: Finalize promotes it to a forfeit, where Save score would record the nominal
  // margin as a played result (and lose the forfeit — its chip, and its exclusion from the tie-breakers).
  const finalizeFirst = band === 'toFinalize' && !edited && canFinalize;
  // Without Finalize, an UNCHANGED waiting score has nothing to save: re-saving it would re-stamp the
  // scorekeeper's name on the audit line as this person's, and on a pending forfeit record the nominal
  // margin as a played result (the hazard above). Save wakes once the score is actually corrected.
  const nothingToSave = band === 'toFinalize' && !edited && !canFinalize;
  const level = away !== '' && home !== '' && Number(away) === Number(home);
  const audit = hasScore ? scoreSubmissionSummary({ source: g.scoreSubmissionSource, email: g.scoreSubmittedByEmail, submittedAt: g.scoreSubmittedAt }) : '';
  const awayName = teamName(ctx, g.awayTeamId, g.awayPlaceholder);
  const homeName = teamName(ctx, g.homeTeamId, g.homePlaceholder);

  async function run(work: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await work();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  }
  function save() {
    if (away === '' || home === '') { setError('Both scores are required.'); return; }
    void run(() => actions.onSaveScore(g.id, Number(home), Number(away)), 'Save failed — please try again.');
  }
  function bump(side: 'away' | 'home', delta: number) {
    const set = side === 'away' ? setAway : setHome;
    set(prev => String(Math.max(0, (parseInt(prev, 10) || 0) + delta)));
  }
  function stepper(side: 'away' | 'home', value: string, name: string) {
    const set = side === 'away' ? setAway : setHome;
    return (
      <span className={styles.stepper}>
        <button type="button" className={styles.stepBtn} onClick={() => bump(side, -1)} aria-label={`One less for ${name}`}><Minus size={18} aria-hidden /></button>
        <input
          ref={side === 'away' ? firstInput : undefined}
          className={styles.stepValue}
          type="text"
          inputMode="numeric"
          value={value}
          placeholder="0"
          aria-label={`${name} score`}
          onChange={e => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) set(v); }}
        />
        <button type="button" className={styles.stepBtn} onClick={() => bump(side, 1)} aria-label={`One more for ${name}`}><Plus size={18} aria-hidden /></button>
      </span>
    );
  }
  function teamLine(side: 'away' | 'home', id: string | undefined, placeholder: string | undefined, value: string, name: string, otherName: string) {
    return (
      <div className={styles.editorTeam}>
        <TeamName ctx={ctx} id={id} placeholder={placeholder} />
        {forfeitMode ? (
          <button
            type="button"
            className={`btn btn-ghost ${styles.editorBtn} ${styles.editorDanger}`}
            disabled={busy}
            title={`${name} forfeited — ${otherName} advances`}
            onClick={() => void run(() => actions.onForfeit(g.id, side === 'away' ? 'home' : 'away'), 'Forfeit failed — please try again.')}
          >
            Forfeited
          </button>
        ) : locked ? (
          <span className={styles.teamScore}>{value}</span>
        ) : stepper(side, value, name)}
      </div>
    );
  }

  const when = [gameWhen(g.date, g.time, ctx.today), whereLine(ctx, g)].filter(Boolean).join(' · ');
  return (
    <li className={styles.editor} data-game-id={g.id} data-row-list-row>
      {when && <div className={styles.editorWhen}>{when}</div>}
      {teamLine('away', g.awayTeamId, g.awayPlaceholder, away, awayName, homeName)}
      {teamLine('home', g.homeTeamId, g.homePlaceholder, home, homeName, awayName)}
      {level && !forfeitMode && !locked && (
        <p className={styles.editorTie}>
          <RepChip>{GAME_STATE_WORD.tie}</RepChip> {g.isPlayoff ? GAME_DAY_WORDS.tiePlayoff : GAME_DAY_WORDS.tiePool}
        </p>
      )}
      {locked ? (
        <div className={styles.editorActions}>
          {/* A forfeit's numbers are a nominal margin, not a score played — name it, as its row does. */}
          {g.status === 'forfeit' && <RepChip>{GAME_STATE_WORD.forfeit}</RepChip>}
          <span className={styles.editorPrompt}>{GAME_DAY_WORDS.finalLocked}</span>
          <button ref={closeButton} type="button" className={`btn btn-ghost ${styles.editorBtn}`} onClick={onClose}>Close</button>
        </div>
      ) : forfeitMode ? (
        <div className={styles.editorActions}>
          <span className={styles.editorPrompt}>Tap the team that forfeited</span>
          <button type="button" className={`btn btn-ghost ${styles.editorBtn}`} onClick={() => setForfeitMode(false)}>Cancel</button>
        </div>
      ) : (
        <div className={styles.editorActions}>
          {finalizeFirst ? (
            <button
              type="button"
              className={`btn btn-lime ${styles.editorBtn} ${styles.editorPrimary}`}
              disabled={busy}
              onClick={() => void run(() => actions.onFinalize(g.id), 'Finalize failed — please try again.')}
            >
              <Check size={15} aria-hidden /> {GAME_DAY_WORDS.finalize}
            </button>
          ) : (
            <button type="button" className={`btn btn-lime ${styles.editorBtn} ${styles.editorPrimary}`} disabled={busy || nothingToSave} onClick={save}>
              {busy ? 'Saving…' : GAME_DAY_WORDS.saveScore}
            </button>
          )}
          {canForfeit && (
            <button type="button" className={`btn btn-ghost ${styles.editorBtn} ${styles.editorDanger}`} disabled={busy} onClick={() => setForfeitMode(true)}>
              {GAME_DAY_WORDS.forfeit}
            </button>
          )}
          {hasScore && (
            <button type="button" className={`btn btn-ghost ${styles.editorBtn} ${styles.editorDanger}`} disabled={busy} onClick={() => actions.onRevert(g.id)}>
              {GAME_DAY_WORDS.revertScore}
            </button>
          )}
          <button type="button" className={`btn btn-ghost ${styles.editorBtn}`} disabled={busy} onClick={onClose}>
            {GAME_DAY_WORDS.discard}
          </button>
        </div>
      )}
      {audit && <p className={styles.editorAudit}>{audit}</p>}
      {error && <p className={styles.editorError} role="alert">{error}</p>}
    </li>
  );
}

export default function ResultsList({
  games, bands, bandOf, teams, divisions, venues, today, openGameId, onOpen, finalizingId, canFinalize, actions, empty,
}: {
  /** Already narrowed by division, stage and search. */
  games: Game[];
  /** The lens: which bands show, in order. */
  bands: readonly ResultsBand[];
  /** Each game's band — judged once per read by the page (`bandFor`), not again here. */
  bandOf: (g: Game) => ResultsBand | null;
  teams: Team[];
  divisions: Division[];
  venues: Venue[];
  today: string;
  openGameId: string | null;
  onOpen: (id: string | null) => void;
  finalizingId: string | null;
  /** Holds `seal_tournaments`: finalizes a pending score, and changes a final one. */
  canFinalize: boolean;
  actions: EditorActions & { onRowFinalize: (id: string) => void };
  /** What to say when no band has a game. */
  empty: ReactNode;
}) {
  const ctx: Ctx = { teams, divisions, venues, today };
  const byBand = new Map<ResultsBand, Game[]>();
  for (const g of games) {
    const band = bandOf(g);
    if (!band || !bands.includes(band)) continue;
    const list = byBand.get(band) ?? [];
    list.push(g);
    byBand.set(band, list);
  }
  const start = (g: Game) => `${g.date || '9999'} ${g.time || '99:99'}`;
  for (const [band, list] of byBand) {
    // Oldest first — except Final, where the newest result is the one being checked.
    list.sort((a, b) => (band === 'final' ? start(b).localeCompare(start(a)) : start(a).localeCompare(start(b))));
  }
  const shown = bands.filter(b => (byBand.get(b)?.length ?? 0) > 0);
  if (shown.length === 0) return <>{empty}</>;

  return (
    <ClubRowFrame>
      {shown.map(band => {
        const list = byBand.get(band)!;
        return (
          <ClubRowList key={band} inset label={BAND_LABEL[band]}>
            <ClubRowBand count={list.length}>{BAND_LABEL[band]}</ClubRowBand>
            {list.map(g => g.id === openGameId ? (
              <ScoreEditor key={g.id} ctx={ctx} g={g} band={band} canFinalize={canFinalize} actions={actions} onClose={() => onOpen(null)} />
            ) : (
              <ResultRow
                key={g.id}
                ctx={ctx}
                g={g}
                band={band}
                canFinalize={canFinalize}
                onOpen={onOpen}
                onFinalize={actions.onRowFinalize}
                finalizing={finalizingId === g.id}
              />
            ))}
          </ClubRowList>
        );
      })}
    </ClubRowFrame>
  );
}
