/**
 * WHAT "SCORE SUBMITTED" SAYS — the one wording every sender of `score_submitted` calls (Notifications read at a glance,
 * Stage 5; plan docs/projects/archive/NOTIFICATION_MESSAGE_ROWS_PLAN.md, owner rulings 2026-11-15 Q1–Q4, "as recommended").
 *
 * Three senders (Field scores; Results' score entry; Results' forfeit) each built their own words, and none said which game
 * or what score — only who entered it, and the same words whether the score was final or waiting for an admin's approval.
 * The one line now carries the game, the score, its state and who entered it; the opened notice draws the rows.
 *
 *   · Q1 the line reads the visiting team first, as the public pages and the fans' "Final:" push do:
 *     "Hawks 4, Ridge 12U 6 · Final · entered by kim@example.com". A bracket slot with no team yet is said in the
 *     bracket's own words (the caller resolves them). The address stays (Stage 4 Q5).
 *   · Q2 rows: Game (the matchup, the division as the quiet detail) · Score · Status · Entered by.
 *   · Q3 a forfeit names the teams ("Ridge 12U wins by forfeit vs Hawks"), never the stored 1–0; titles unchanged.
 *   · Q4 a correction of a final result says "corrected by" and gains a Was row; a re-entry of a held score reads as new.
 *
 * Pure (the test reads the words straight from here); the reads and the send are `lib/score-notice-server.ts`.
 */
import { FACT_LABELS as L, factRow, noticeFacts, type NoticeFacts } from './notification-facts';

/** The game as the notice names it: each side already in words (the team, else the bracket's slot words). */
export interface ScoreNoticeGame {
  away: string;
  home: string;
  division?: string | null;
}

/** A result as it reads: a score, or a forfeit with its winning side. */
export type ScoreNoticeResult =
  | { kind: 'score'; awayScore: number; homeScore: number }
  | { kind: 'forfeit'; winner: 'home' | 'away' };

export interface ScoreNoticeInput {
  game: ScoreNoticeGame;
  result: ScoreNoticeResult;
  /** Held for an admin's approval (the event asks for review and a volunteer or staff member entered it). */
  held: boolean;
  /** Who entered it: the address on their account. Blank = no "entered by" part and no row (nothing invented). */
  enteredBy?: string | null;
  /** The result this one replaced when the game was already final (Q4). */
  was?: ScoreNoticeResult | null;
}

/** [marketing] */
export const SCORE_NOTICE_WORDS = {
  title: 'Score submitted',
  forfeitHeldTitle: 'Forfeit pending approval',
  forfeitTitle: 'Game forfeited',
  final: 'Final',
  held: 'Waiting for approval',
  unnamed: 'TBD',
  enteredBy: (who: string) => `entered by ${who}`,
  correctedBy: (who: string) => `corrected by ${who}`,
  corrected: 'corrected',
  matchup: (away: string, home: string) => `${away} vs ${home}`,
  wonByForfeit: (winner: string, loser: string) => `${winner} wins by forfeit vs ${loser}`,
  byForfeit: (winner: string) => `${winner} by forfeit`,
} as const;
const W = SCORE_NOTICE_WORDS;

const side = (name: string | null | undefined) => name?.trim() || W.unnamed;

/** "Hawks 4, Ridge 12U 6", or "Ridge 12U by forfeit" — the Score and Was rows. */
function resultWords(game: ScoreNoticeGame, r: ScoreNoticeResult): string {
  const away = side(game.away), home = side(game.home);
  if (r.kind === 'forfeit') return W.byForfeit(r.winner === 'home' ? home : away);
  return `${away} ${r.awayScore}, ${home} ${r.homeScore}`;
}

/**
 * The result a game already holds, as a correction's Was row reads it (Q4): only a FINAL result counts — completed, or a
 * forfeit. A held one (status 'submitted', a pending forfeit included), a scheduled game and a half-written score have
 * none, so a re-entry of a held score reads as new.
 */
export function standingResult(g: {
  status: string; homeScore: number | null; awayScore: number | null; source?: string | null;
}): ScoreNoticeResult | null {
  if (g.status !== 'completed' && g.status !== 'forfeit') return null;
  if (g.homeScore == null || g.awayScore == null) return null;
  return g.status === 'forfeit' || g.source === 'forfeit'
    ? { kind: 'forfeit', winner: g.homeScore > g.awayScore ? 'home' : 'away' }
    : { kind: 'score', awayScore: g.awayScore, homeScore: g.homeScore };
}

export function scoreNotice(p: ScoreNoticeInput): { title: string; body: string; facts: NoticeFacts } {
  const away = side(p.game.away), home = side(p.game.home);
  const status = p.held ? W.held : W.final;
  const who = p.enteredBy?.trim() || null;
  const corrected = !!p.was;
  const r = p.result;
  const lead = r.kind === 'forfeit'
    ? W.wonByForfeit(r.winner === 'home' ? home : away, r.winner === 'home' ? away : home)
    : resultWords(p.game, r);
  const by = who ? (corrected ? W.correctedBy(who) : W.enteredBy(who)) : (corrected ? W.corrected : null);
  const title = r.kind === 'forfeit' ? (p.held ? W.forfeitHeldTitle : W.forfeitTitle) : W.title;
  return {
    title,
    body: [lead, status, by].filter(Boolean).join(' · '),
    facts: noticeFacts([
      factRow(L.game, W.matchup(away, home), { detail: p.game.division }),
      factRow(L.score, resultWords(p.game, r), { lead: true }),
      factRow(L.was, p.was ? resultWords(p.game, p.was) : null),
      factRow(L.status, status),
      factRow(L.enteredBy, who),
    ]),
  };
}
