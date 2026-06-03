import { updateGame as updateGameRecord } from './db';
import { getEffectiveScoreFinalization } from './tournament-score-policy';
import { notifyFansForGame } from './fan-notify';
import type { Game, GameStatus, OrgRole, ScoreSubmissionSource } from './types';
import { supabaseAdmin } from './supabase-admin';

export type TournamentScoreGame = {
  tournamentId: string;
  status: GameStatus;
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
  source: Exclude<ScoreSubmissionSource, 'system'>;
  allowFinalizedEdit?: boolean;
};

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
  if (value === 'submitted' || value === 'completed' || value === 'cancelled') return value;
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
    .select('tournament_id, status')
    .eq('id', gameId)
    .maybeSingle();

  if (error) throw new TournamentScoringError(error.message, 500);
  if (!data) throw new TournamentScoringError('Game not found.', 404);

  return {
    tournamentId: data.tournament_id as string,
    status: toGameStatus(data.status),
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

  async function finalizeTournamentScore(gameId: string, game?: TournamentScoreGame) {
    const scoreGame = game ?? await deps.loadGame(gameId);
    if (scoreGame.status === 'submitted') {
      await deps.updateGame(gameId, { status: 'completed' }, { admin: true });
    }
    return { status: scoreGame.status === 'submitted' ? 'completed' as const : scoreGame.status };
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
export const finalizeTournamentScore = tournamentScoringService.finalizeTournamentScore;
export const revertTournamentScore = tournamentScoringService.revertTournamentScore;
