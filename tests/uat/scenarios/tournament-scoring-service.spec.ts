import { expect, test } from '@playwright/test'

import {
  createTournamentScoringService,
  TournamentScoringError,
  type TournamentScoreGame,
} from '../../../lib/tournament-scoring-service'
import type { Game, OrgRole } from '../../../lib/types'

type UpdateCall = {
  id: string
  game: Partial<Game>
  options?: { admin?: boolean }
}

type PolicyCall = {
  tournamentId: string
  orgRequireScoreFinalization: boolean
}

const NOW = '2026-05-23T12:34:56.000Z'

function createHarness(input: {
  game?: TournamentScoreGame
  requiresFinalization?: boolean
} = {}) {
  const game = input.game ?? { tournamentId: 'tournament-1', status: 'scheduled' as const }
  const updates: UpdateCall[] = []
  const policyCalls: PolicyCall[] = []

  const service = createTournamentScoringService({
    loadGame: async (gameId) => {
      expect(gameId).toBe('game-1')
      return game
    },
    updateGame: async (id, update, options) => {
      updates.push({ id, game: update, options })
    },
    getEffectiveScoreFinalization: async (tournamentId, orgRequireScoreFinalization) => {
      policyCalls.push({ tournamentId, orgRequireScoreFinalization })
      return input.requiresFinalization ?? orgRequireScoreFinalization
    },
    now: () => NOW,
  })

  return { policyCalls, service, updates }
}

function actor(role: OrgRole = 'official', overrides: Partial<Parameters<ReturnType<typeof createHarness>['service']['submitTournamentScore']>[0]['actor']> = {}) {
  return {
    userId: 'user-1',
    email: 'scorekeeper@example.test',
    role,
    orgRequireScoreFinalization: false,
    ...overrides,
  }
}

test.describe('tournament scoring service', () => {
  test('submits scorekeeper scores as pending review when finalization is required', async () => {
    const { policyCalls, service, updates } = createHarness({ requiresFinalization: true })

    await expect(service.submitTournamentScore({
      gameId: 'game-1',
      homeScore: 7,
      awayScore: 4,
      actor: actor('official'),
      source: 'scorekeeper',
    })).resolves.toEqual({ status: 'submitted' })

    expect(policyCalls).toEqual([
      { tournamentId: 'tournament-1', orgRequireScoreFinalization: false },
    ])
    expect(updates).toEqual([
      {
        id: 'game-1',
        game: {
          homeScore: 7,
          awayScore: 4,
          status: 'submitted',
          scoreSubmittedByUserId: 'user-1',
          scoreSubmittedByEmail: 'scorekeeper@example.test',
          scoreSubmittedAt: NOW,
          scoreSubmissionSource: 'scorekeeper',
        },
        options: { admin: true },
      },
    ])
  })

  test('finalizes scorekeeper scores immediately when finalization is disabled', async () => {
    const { service, updates } = createHarness({ requiresFinalization: false })

    await expect(service.submitTournamentScore({
      gameId: 'game-1',
      homeScore: 3,
      awayScore: 2,
      actor: actor('official'),
      source: 'scorekeeper',
    })).resolves.toEqual({ status: 'completed' })

    expect(updates[0].game.status).toBe('completed')
  })

  test('admin results submissions complete even when field submissions require review', async () => {
    const { service, updates } = createHarness({ requiresFinalization: true })

    await expect(service.submitTournamentScore({
      gameId: 'game-1',
      homeScore: 8,
      awayScore: 4,
      actor: actor('admin', { email: 'admin@example.test' }),
      source: 'admin_results',
    })).resolves.toEqual({ status: 'completed' })

    expect(updates[0].game).toMatchObject({
      homeScore: 8,
      awayScore: 4,
      status: 'completed',
      scoreSubmittedByEmail: 'admin@example.test',
      scoreSubmissionSource: 'admin_results',
    })
  })

  test('rejects invalid, cancelled, and finalized scorekeeper submissions before writing', async () => {
    const invalid = createHarness()
    await expect(invalid.service.submitTournamentScore({
      gameId: 'game-1',
      homeScore: 7.5,
      awayScore: 4,
      actor: actor(),
      source: 'scorekeeper',
    })).rejects.toMatchObject({
      status: 400,
      message: 'Scores must be non-negative whole numbers.',
    } satisfies Partial<TournamentScoringError>)
    expect(invalid.updates).toHaveLength(0)

    const cancelled = createHarness({ game: { tournamentId: 'tournament-1', status: 'cancelled' } })
    await expect(cancelled.service.submitTournamentScore({
      gameId: 'game-1',
      homeScore: 7,
      awayScore: 4,
      actor: actor(),
      source: 'scorekeeper',
    })).rejects.toMatchObject({
      status: 409,
      message: 'This game has been cancelled and cannot be scored.',
    } satisfies Partial<TournamentScoringError>)
    expect(cancelled.updates).toHaveLength(0)

    const finalized = createHarness({ game: { tournamentId: 'tournament-1', status: 'completed' } })
    await expect(finalized.service.submitTournamentScore({
      gameId: 'game-1',
      homeScore: 7,
      awayScore: 4,
      actor: actor(),
      source: 'scorekeeper',
    })).rejects.toMatchObject({
      status: 409,
      message: 'This score has already been finalized.',
    } satisfies Partial<TournamentScoringError>)
    expect(finalized.updates).toHaveLength(0)
  })

  test('allows admin corrections to finalized scores when explicitly enabled', async () => {
    const { service, updates } = createHarness({
      game: { tournamentId: 'tournament-1', status: 'completed' },
      requiresFinalization: true,
    })

    await expect(service.submitTournamentScore({
      gameId: 'game-1',
      homeScore: 8,
      awayScore: 4,
      actor: actor('admin'),
      source: 'admin_results',
      allowFinalizedEdit: true,
    })).resolves.toEqual({ status: 'completed' })

    expect(updates[0].game).toMatchObject({
      homeScore: 8,
      awayScore: 4,
      status: 'completed',
      scoreSubmissionSource: 'admin_results',
    })
  })

  test('finalizes submitted scores and leaves other statuses unchanged', async () => {
    const submitted = createHarness({ game: { tournamentId: 'tournament-1', status: 'submitted' } })
    await expect(submitted.service.finalizeTournamentScore('game-1')).resolves.toEqual({ status: 'completed' })
    expect(submitted.updates).toEqual([
      {
        id: 'game-1',
        game: { status: 'completed' },
        options: { admin: true },
      },
    ])

    const scheduled = createHarness({ game: { tournamentId: 'tournament-1', status: 'scheduled' } })
    await expect(scheduled.service.finalizeTournamentScore('game-1')).resolves.toEqual({ status: 'scheduled' })
    expect(scheduled.updates).toHaveLength(0)
  })

  test('reverts scores and clears audit metadata', async () => {
    const { service, updates } = createHarness()

    await expect(service.revertTournamentScore('game-1')).resolves.toEqual({ status: 'scheduled' })

    expect(updates).toEqual([
      {
        id: 'game-1',
        game: {
          status: 'scheduled',
          homeScore: null,
          awayScore: null,
          scoreSubmittedByUserId: null,
          scoreSubmittedByEmail: null,
          scoreSubmittedAt: null,
          scoreSubmissionSource: null,
        },
        options: { admin: true },
      },
    ])
  })
})
