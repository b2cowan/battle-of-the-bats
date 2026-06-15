import { updateGame as updateGameRecord } from './db';
import { getEffectiveScoreFinalization } from './tournament-score-policy';
import { notifyFansForGame } from './fan-notify';
import type { Game, GameStatus, OrgRole, ScoreSubmissionSource } from './types';
import { supabaseAdmin } from './supabase-admin';

export type TournamentScoreGame = {
  tournamentId: string;
  status: GameStatus;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  /** How the current result was entered; 'forfeit' marks a (possibly pending) forfeit. */
  scoreSubmissionSource?: ScoreSubmissionSource | null;
};

export type ScoreActor = {
  userId: string;
  email?: string | null;
  role: OrgRole;
  orgRequireScoreFinalization?: boolean;
};

type SubmitScoreInput = {
  gameId: string;
  game?: TournamentScoreGame;
  homeScore: unknown;
  awayScore: unknown;
  actor: ScoreActor;
  source: Exclude<ScoreSubmissionSource, 'system' | 'forfeit'>;
  allowFinalizedEdit?: boolean;
};

type SubmitForfeitInput = {
  gameId: string;
  game?: TournamentScoreGame;
  /** The team that showed up and advances. */
  winningSide: 'home' | 'away';
  actor: ScoreActor;
};

/** Nominal forfeit margin — cosmetic only; RF/RA/RD exclude forfeits in tie-breakers. */
const FORFEIT_SCORE = 1;

type StatusCode = 400 | 404 | 409 | 500;

type UpdateGameForScoring = (
  id: string,
  game: Partial<Game>,
  options?: { admin?: boolean },
) => Promise<void>;

export type TournamentScoringServiceDependencies = {
  loadGame: (gameId: string) => Promise<TournamentScoreGame>;
  updateGame: UpdateGameForScoring;
  getEffectiveScoreFinalization: (
    tournamentId: string,
    orgRequireScoreFinalization: boolean,
  ) => Promise<boolean>;
  now?: () => string;
  /**
   * Side-effect hook fired after a score is persisted. The production singleton
   * wires this to the anonymous fan push fan-out (lib/fan-notify). Optional so
   * unit tests can construct the service without triggering real notifications.
   */
  onScored?: (gameId: string, status: GameStatus) => void;
};

export class TournamentScoringError extends Error {
  status: StatusCode;

  constructor(message: string, status: StatusCode) {
    super(message);
    this.name = 'TournamentScoringError';
    this.status = status;
  }
}

function toGameStatus(value: unknown): GameStatus {
  if (value === 'submitted' || value === 'completed' || value === 'cancelled' || value === 'forfeit') return value;
  return 'scheduled';
}

function parseScore(value: unknown) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new TournamentScoringError('Scores must be non-negative whole numbers.', 400);
  }
  return value;
}

async function loadTournamentScoreGameFromDb(gameId: string): Promise<TournamentScoreGame> {
  const { data, error } = await supabaseAdmin
    .from('games')
    .select('tournament_id, status, home_team_id, away_team_id, score_submission_source')
    .eq('id', gameId)
    .maybeSingle();

  if (error) throw new TournamentScoringError(error.message, 500);
  if (!data) throw new TournamentScoringError('Game not found.', 404);

  return {
    tournamentId: data.tournament_id as string,
    status: toGameStatus(data.status),
    homeTeamId: (data.home_team_id as string | null) ?? null,
    awayTeamId: (data.away_team_id as string | null) ?? null,
    scoreSubmissionSource: (data.score_submission_source as ScoreSubmissionSource | null) ?? null,
  };
}

export function createTournamentScoringService(deps: TournamentScoringServiceDependencies) {
  async function loadTournamentScoreGame(gameId: string): Promise<TournamentScoreGame> {
    return deps.loadGame(gameId);
  }

  async function submitTournamentScore(input: SubmitScoreInput) {
    const game = input.game ?? await deps.loadGame(input.gameId);
    if (game.status === 'cancelled') {
      throw new TournamentScoringError('This game has been cancelled and cannot be scored.', 409);
    }
    if (game.status === 'completed' && !input.allowFinalizedEdit) {
      throw new TournamentScoringError('This score has already been finalized.', 409);
    }

    const homeScore = parseScore(input.homeScore);
    const awayScore = parseScore(input.awayScore);

    const requiresFinalization = await deps.getEffectiveScoreFinalization(
      game.tournamentId,
      input.actor.orgRequireScoreFinalization ?? false,
    );
    const status: GameStatus =
      requiresFinalization && (input.actor.role === 'official' || input.actor.role === 'staff')
        ? 'submitted'
        : 'completed';

    await deps.updateGame(input.gameId, {
      homeScore,
      awayScore,
      status,
      scoreSubmittedByUserId: input.actor.userId,
      scoreSubmittedByEmail: input.actor.email ?? null,
      scoreSubmittedAt: deps.now ? deps.now() : new Date().toISOString(),
      scoreSubmissionSource: input.source,
    }, { admin: true });

    // Fan score-alert fan-out (fire-and-forget; covers scorekeeper/official/admin).
    deps.onScored?.(input.gameId, status);

    return { status };
  }

  async function submitForfeit(input: SubmitForfeitInput) {
    const game = input.game ?? await deps.loadGame(input.gameId);
    if (game.status === 'cancelled') {
      throw new TournamentScoringError('This game has been cancelled and cannot be forfeited.', 409);
    }
    if (game.status === 'completed') {
      throw new TournamentScoringError('This game is already finalized.', 409);
    }
    if (!game.homeTeamId || !game.awayTeamId) {
      throw new TournamentScoringError('Both teams must be set before a game can be forfeited.', 409);
    }

    // A forfeit rides the SAME approval rule as a score: when the org requires
    // finalization and a field volunteer (official/staff) records it, it lands as
    // a PENDING forfeit (status 'submitted', source 'forfeit') and does NOT advance
    // the bracket until an owner/admin approves it via finalize. An admin's own
    // forfeit — or any forfeit in an org that doesn't require finalization — is
    // final immediately (status 'forfeit').
    const requiresFinalization = await deps.getEffectiveScoreFinalization(
      game.tournamentId,
      input.actor.orgRequireScoreFinalization ?? false,
    );
    const pending = requiresFinalization
      && (input.actor.role === 'official' || input.actor.role === 'staff');
    const status: GameStatus = pending ? 'submitted' : 'forfeit';

    await deps.updateGame(input.gameId, {
      homeScore: input.winningSide === 'home' ? FORFEIT_SCORE : 0,
      awayScore: input.winningSide === 'away' ? FORFEIT_SCORE : 0,
      status,
      scoreSubmittedByUserId: input.actor.userId,
      scoreSubmittedByEmail: input.actor.email ?? null,
      scoreSubmittedAt: deps.now ? deps.now() : new Date().toISOString(),
      // 'forfeit' source marks this result a forfeit through BOTH lifecycle states,
      // so finalize knows a pending forfeit promotes to status 'forfeit' (not 'completed').
      scoreSubmissionSource: 'forfeit',
    }, { admin: true });

    deps.onScored?.(input.gameId, status);

    return { status, pending };
  }

  async function finalizeTournamentScore(gameId: string, game?: TournamentScoreGame) {
    const scoreGame = game ?? await deps.loadGame(gameId);
    if (scoreGame.status === 'submitted') {
      // A pending forfeit promotes to the terminal 'forfeit' status (not 'completed'),
      // so it advances the bracket but stays excluded from RF/RA/RD in tie-breakers.
      const nextStatus: GameStatus =
        scoreGame.scoreSubmissionSource === 'forfeit' ? 'forfeit' : 'completed';
      await deps.updateGame(gameId, { status: nextStatus }, { admin: true });
      return { status: nextStatus };
    }
    return { status: scoreGame.status };
  }

  async function revertTournamentScore(gameId: string) {
    await deps.updateGame(gameId, {
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
      scoreSubmittedByUserId: null,
      scoreSubmittedByEmail: null,
      scoreSubmittedAt: null,
      scoreSubmissionSource: null,
    }, { admin: true });

    return { status: 'scheduled' as const };
  }

  return {
    loadTournamentScoreGame,
    submitTournamentScore,
    submitForfeit,
    finalizeTournamentScore,
    revertTournamentScore,
  };
}

const tournamentScoringService = createTournamentScoringService({
  loadGame: loadTournamentScoreGameFromDb,
  updateGame: updateGameRecord,
  getEffectiveScoreFinalization,
  onScored: (gameId, status) => { void notifyFansForGame(gameId, status); },
});

export const loadTournamentScoreGame = tournamentScoringService.loadTournamentScoreGame;
export const submitTournamentScore = tournamentScoringService.submitTournamentScore;
export const submitForfeit = tournamentScoringService.submitForfeit;
export const finalizeTournamentScore = tournamentScoringService.finalizeTournamentScore;
export const revertTournamentScore = tournamentScoringService.revertTournamentScore;
