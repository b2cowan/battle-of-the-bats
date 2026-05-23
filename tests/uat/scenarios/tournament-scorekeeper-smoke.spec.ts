import { expect, test } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

import { supabaseAdmin } from '../../../lib/supabase-admin'

const OWNER_STORAGE = path.join(__dirname, '../.auth/org-owner.json')
const SCOREKEEPER_PASSWORD = 'devpass123'

type SmokeTournament = {
  ageGroupId: string
  awayTeamName: string
  gameId: string
  homeTeamName: string
  tournamentId: string
}

type SmokeState = {
  orgId: string
  orgSlug: string
  scorekeeperEmail: string
  scorekeeperMemberId: string
  scorekeeperUserId: string
  review: SmokeTournament
  final: SmokeTournament
}

let state: SmokeState | null = null

function todayString() {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

function expectState(): SmokeState {
  if (!state) throw new Error('Scorekeeper smoke state was not initialized.')
  return state
}

async function createSmokeTournament(input: {
  orgId: string
  suffix: string
  label: string
  requireScoreFinalization: boolean
}): Promise<SmokeTournament> {
  const today = todayString()
  const { data: tournament, error: tournamentError } = await supabaseAdmin
    .from('tournaments')
    .insert({
      org_id: input.orgId,
      year: new Date().getFullYear(),
      name: `UAT Scorekeeper ${input.label} ${input.suffix}`,
      slug: `uat-scorekeeper-${input.label.toLowerCase()}-${input.suffix}`,
      status: 'active',
      is_active: true,
      start_date: today,
      end_date: today,
      require_score_finalization: input.requireScoreFinalization,
    })
    .select('id')
    .single()

  if (tournamentError) throw tournamentError

  const { data: diamond, error: diamondError } = await supabaseAdmin
    .from('diamonds')
    .insert({
      tournament_id: tournament.id,
      name: `Diamond ${input.label}`,
      address: 'UAT Park',
    })
    .select('id')
    .single()

  if (diamondError) throw diamondError

  const { data: ageGroup, error: ageGroupError } = await supabaseAdmin
    .from('age_groups')
    .insert({
      tournament_id: tournament.id,
      name: `UAT ${input.label}`,
      display_order: 1,
      schedule_visibility: 'published_teams',
    })
    .select('id')
    .single()

  if (ageGroupError) throw ageGroupError

  const homeTeamName = `UAT ${input.label} Home ${input.suffix}`
  const awayTeamName = `UAT ${input.label} Away ${input.suffix}`
  const { data: teams, error: teamsError } = await supabaseAdmin
    .from('teams')
    .insert([
      {
        tournament_id: tournament.id,
        age_group_id: ageGroup.id,
        name: homeTeamName,
        coach: 'Home Coach',
        email: `home-${input.label}-${input.suffix}@example.test`,
        players: [],
        status: 'accepted',
        payment_status: 'paid',
      },
      {
        tournament_id: tournament.id,
        age_group_id: ageGroup.id,
        name: awayTeamName,
        coach: 'Away Coach',
        email: `away-${input.label}-${input.suffix}@example.test`,
        players: [],
        status: 'accepted',
        payment_status: 'paid',
      },
    ])
    .select('id, name')

  if (teamsError) throw teamsError
  if (!teams || teams.length !== 2) throw new Error('Smoke teams were not created.')

  const homeTeam = teams.find(team => team.name === homeTeamName)
  const awayTeam = teams.find(team => team.name === awayTeamName)
  if (!homeTeam || !awayTeam) throw new Error('Smoke teams could not be resolved.')

  const { data: game, error: gameError } = await supabaseAdmin
    .from('games')
    .insert({
      tournament_id: tournament.id,
      age_group_id: ageGroup.id,
      home_team_id: homeTeam.id,
      away_team_id: awayTeam.id,
      game_date: today,
      game_time: input.requireScoreFinalization ? '09:00' : '10:00',
      location: `Diamond ${input.label}`,
      diamond_id: diamond.id,
      status: 'scheduled',
      is_playoff: false,
    })
    .select('id')
    .single()

  if (gameError) throw gameError

  return {
    ageGroupId: ageGroup.id,
    awayTeamName,
    gameId: game.id,
    homeTeamName,
    tournamentId: tournament.id,
  }
}

async function readGame(gameId: string) {
  const { data, error } = await supabaseAdmin
    .from('games')
    .select(`
      id,
      status,
      home_score,
      away_score,
      score_submitted_by_user_id,
      score_submitted_by_email,
      score_submitted_at,
      score_submission_source
    `)
    .eq('id', gameId)
    .single()

  if (error) throw error
  return data
}

async function loginScorekeeper(page: import('@playwright/test').Page, smoke: SmokeState) {
  await page.goto('/auth/login')
  await page.locator('#login-email').fill(smoke.scorekeeperEmail)
  await page.locator('#login-password').fill(SCOREKEEPER_PASSWORD)
  await page.locator('#login-submit').click()
  await Promise.race([
    page.waitForURL(url => !url.pathname.startsWith('/auth/login'), { timeout: 45_000 }),
    page.getByText(`Logged in as ${smoke.scorekeeperEmail}`).waitFor({ state: 'visible', timeout: 45_000 }),
  ])
  await page.goto(`/${smoke.orgSlug}/scorekeeper`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await expect(page.getByRole('heading', { name: 'Field scores' })).toBeVisible({ timeout: 20_000 })
}

test.describe.serial('Tournament scorekeeper UAT smoke', () => {
  test.setTimeout(180_000)

  test.beforeAll(async () => {
    const orgSlug = process.env.UAT_ORG_SLUG ?? 'uat-test-org'
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, slug')
      .eq('slug', orgSlug)
      .maybeSingle()

    if (orgError) throw orgError
    if (!org) throw new Error(`UAT organization ${orgSlug} was not found.`)

    const suffix = `scorekeeper-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    const scorekeeperEmail = `uat-${suffix}@example.test`

    const { data: scorekeeperUser, error: scorekeeperUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email: scorekeeperEmail,
        email_confirm: true,
        password: SCOREKEEPER_PASSWORD,
      })

    if (scorekeeperUserError) throw scorekeeperUserError
    if (!scorekeeperUser.user?.id) throw new Error('Smoke scorekeeper user was not created.')

    const { data: member, error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: scorekeeperUser.user.id,
        role: 'official',
        invited_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
        status: 'active',
        display_name: 'UAT Scorekeeper Smoke',
      })
      .select('id')
      .single()

    if (memberError) throw memberError

    const review = await createSmokeTournament({
      orgId: org.id,
      suffix,
      label: 'Review',
      requireScoreFinalization: true,
    })
    const final = await createSmokeTournament({
      orgId: org.id,
      suffix,
      label: 'Final',
      requireScoreFinalization: false,
    })

    const { error: assignmentError } = await supabaseAdmin
      .from('org_member_tournament_assignments')
      .insert([
        { org_member_id: member.id, tournament_id: review.tournamentId },
        { org_member_id: member.id, tournament_id: final.tournamentId },
      ])

    if (assignmentError) throw assignmentError

    state = {
      orgId: org.id,
      orgSlug,
      scorekeeperEmail,
      scorekeeperMemberId: member.id,
      scorekeeperUserId: scorekeeperUser.user.id,
      review,
      final,
    }
  })

  test.afterAll(async () => {
    if (!state) return

    await supabaseAdmin.from('tournaments').delete().in('id', [
      state.review.tournamentId,
      state.final.tournamentId,
    ])
    await supabaseAdmin
      .from('organization_members')
      .delete()
      .eq('id', state.scorekeeperMemberId)
    await supabaseAdmin.auth.admin.deleteUser(state.scorekeeperUserId)
  })

  test('scorekeeper submit, admin review, export, correction, and revert', async ({ browser }) => {
    const smoke = expectState()

    const scorekeeperContext = await browser.newContext()
    const scorekeeperPage = await scorekeeperContext.newPage()
    await loginScorekeeper(scorekeeperPage, smoke)

    const reviewCard = scorekeeperPage.getByRole('button', {
      name: new RegExp(smoke.review.homeTeamName),
    })
    await expect(reviewCard).toBeVisible({ timeout: 20_000 })
    await reviewCard.click()

    const scoreSheet = scorekeeperPage.locator('form').filter({ hasText: 'Enter Score' })
    await scoreSheet.getByRole('spinbutton').nth(0).fill('7')
    await scoreSheet.getByRole('spinbutton').nth(1).fill('4')
    await scoreSheet.getByRole('button', { name: /Submit for Review/ }).click()
    await expect(scorekeeperPage.getByText('Score sent for review')).toBeVisible({ timeout: 10_000 })

    await expect.poll(async () => {
      const game = await readGame(smoke.review.gameId)
      return {
        awayScore: game.away_score,
        email: game.score_submitted_by_email,
        homeScore: game.home_score,
        source: game.score_submission_source,
        status: game.status,
        userId: game.score_submitted_by_user_id,
      }
    }, { timeout: 10_000 }).toEqual({
      awayScore: 4,
      email: smoke.scorekeeperEmail,
      homeScore: 7,
      source: 'scorekeeper',
      status: 'submitted',
      userId: smoke.scorekeeperUserId,
    })

    const finalResponse = await scorekeeperPage.evaluate(async ({ gameId, orgSlug }) => {
      const response = await fetch(`/api/scorekeeper/${orgSlug}/score`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: gameId, homeScore: 3, awayScore: 2 }),
      })
      return { body: await response.json(), status: response.status }
    }, { gameId: smoke.final.gameId, orgSlug: smoke.orgSlug })

    expect(finalResponse.status).toBe(200)
    expect(finalResponse.body.status).toBe('completed')
    await expect.poll(async () => {
      const game = await readGame(smoke.final.gameId)
      return {
        source: game.score_submission_source,
        status: game.status,
      }
    }, { timeout: 10_000 }).toEqual({
      source: 'scorekeeper',
      status: 'completed',
    })

    const ownerContext = await browser.newContext({ storageState: OWNER_STORAGE })
    await ownerContext.addInitScript(({ key, tournamentId }) => {
      window.localStorage.setItem(key, tournamentId)
    }, {
      key: `botb_admin_tournament_id:${smoke.orgSlug}`,
      tournamentId: smoke.review.tournamentId,
    })
    const ownerPage = await ownerContext.newPage()

    await ownerPage.goto(`/${smoke.orgSlug}/admin/tournaments/results`)
    await expect(ownerPage.getByRole('heading', { name: 'Results & Scoring' })).toBeVisible({ timeout: 30_000 })
    await expect(ownerPage.getByText(smoke.review.homeTeamName)).toBeVisible({ timeout: 20_000 })
    await ownerPage.getByText(smoke.review.homeTeamName).first().click()
    await expect(ownerPage.getByText('Score submission')).toBeVisible({ timeout: 10_000 })
    await expect(ownerPage.getByText(smoke.scorekeeperEmail)).toBeVisible()

    await ownerPage.getByLabel('More export formats').click()
    const downloadPromise = ownerPage.waitForEvent('download')
    await ownerPage.getByRole('menuitem', { name: /CSV/ }).click()
    const download = await downloadPromise
    const downloadPath = await download.path()
    if (!downloadPath) throw new Error('CSV download did not produce a local path.')
    const csv = await fs.readFile(downloadPath, 'utf8')
    expect(csv).toContain('Submitted By')
    expect(csv).toContain('Submitted At')
    expect(csv).toContain('Submission Source')
    expect(csv).toContain(smoke.scorekeeperEmail)
    expect(csv).toContain('Scorekeeper')

    await ownerPage.getByRole('button', { name: /Finalize/ }).click()
    await expect.poll(async () => (await readGame(smoke.review.gameId)).status, { timeout: 10_000 })
      .toBe('completed')

    await scorekeeperPage.reload()
    await scorekeeperPage.getByRole('button', { name: /Final/ }).click()
    const finalizedReviewCard = scorekeeperPage.getByRole('button', {
      name: new RegExp(smoke.review.homeTeamName),
    })
    await expect(finalizedReviewCard.getByText('Final score locked')).toBeVisible({ timeout: 10_000 })
    const finalizedConflict = await scorekeeperPage.evaluate(async ({ gameId, orgSlug }) => {
      const response = await fetch(`/api/scorekeeper/${orgSlug}/score`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: gameId, homeScore: 8, awayScore: 4 }),
      })
      return { body: await response.json(), status: response.status }
    }, { gameId: smoke.review.gameId, orgSlug: smoke.orgSlug })
    expect(finalizedConflict.status).toBe(409)
    expect(finalizedConflict.body.error).toContain('already been finalized')

    const adminCorrection = await ownerPage.evaluate(async ({ gameId, orgSlug }) => {
      const response = await fetch(`/api/admin/games?orgSlug=${orgSlug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit-score',
          id: gameId,
          homeScore: 8,
          awayScore: 4,
        }),
      })
      return { body: await response.json(), status: response.status }
    }, { gameId: smoke.review.gameId, orgSlug: smoke.orgSlug })
    expect(adminCorrection.status).toBe(200)

    await expect.poll(async () => {
      const game = await readGame(smoke.review.gameId)
      return {
        awayScore: game.away_score,
        homeScore: game.home_score,
        source: game.score_submission_source,
        status: game.status,
      }
    }, { timeout: 10_000 }).toEqual({
      awayScore: 4,
      homeScore: 8,
      source: 'admin_results',
      status: 'completed',
    })

    const adminRevert = await ownerPage.evaluate(async ({ gameId, orgSlug }) => {
      const response = await fetch(`/api/admin/games?orgSlug=${orgSlug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revert-score', id: gameId }),
      })
      return { body: await response.json(), status: response.status }
    }, { gameId: smoke.review.gameId, orgSlug: smoke.orgSlug })
    expect(adminRevert.status).toBe(200)

    await expect.poll(async () => {
      const game = await readGame(smoke.review.gameId)
      return {
        awayScore: game.away_score,
        email: game.score_submitted_by_email,
        homeScore: game.home_score,
        source: game.score_submission_source,
        status: game.status,
        submittedAt: game.score_submitted_at,
        userId: game.score_submitted_by_user_id,
      }
    }, { timeout: 10_000 }).toEqual({
      awayScore: null,
      email: null,
      homeScore: null,
      source: null,
      status: 'scheduled',
      submittedAt: null,
      userId: null,
    })

    await ownerContext.close()
    await scorekeeperContext.close()
  })
})
