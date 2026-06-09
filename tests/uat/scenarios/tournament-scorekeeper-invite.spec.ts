import { expect, test } from '@playwright/test'

import { supabaseAdmin } from '../../../lib/supabase-admin'

const SCOREKEEPER_PASSWORD = 'devpass123'

type InviteSmokeState = {
  actionLink: string
  gameId: string
  homeTeamName: string
  memberId: string
  orgSlug: string
  scorekeeperEmail: string
  tournamentId: string
  userId: string
}

let state: InviteSmokeState | null = null

function todayString() {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

function getActionLink(data: unknown) {
  return (data as { properties?: { action_link?: string | null } }).properties?.action_link ?? null
}

function expectState() {
  if (!state) throw new Error('Scorekeeper invite smoke state was not initialized.')
  return state
}

async function createAssignedGame(input: {
  orgId: string
  suffix: string
}) {
  const today = todayString()
  const { data: tournament, error: tournamentError } = await supabaseAdmin
    .from('tournaments')
    .insert({
      org_id: input.orgId,
      year: new Date().getFullYear(),
      name: `UAT Scorekeeper Invite ${input.suffix}`,
      slug: `uat-scorekeeper-invite-${input.suffix}`,
      status: 'active',
      is_active: true,
      start_date: today,
      end_date: today,
      require_score_finalization: true,
    })
    .select('id')
    .single()

  if (tournamentError) throw tournamentError

  const { data: diamond, error: diamondError } = await supabaseAdmin
    .from('diamonds')
    .insert({
      tournament_id: tournament.id,
      name: 'Invite Diamond',
      address: 'UAT Park',
    })
    .select('id')
    .single()

  if (diamondError) throw diamondError

  const { data: division, error: divisionError } = await supabaseAdmin
    .from('divisions')
    .insert({
      tournament_id: tournament.id,
      name: 'UAT Invite Division',
      display_order: 1,
      schedule_visibility: 'published_teams',
    })
    .select('id')
    .single()

  if (divisionError) throw divisionError

  const homeTeamName = `UAT Invite Home ${input.suffix}`
  const awayTeamName = `UAT Invite Away ${input.suffix}`
  const { data: teams, error: teamsError } = await supabaseAdmin
    .from('teams')
    .insert([
      {
        tournament_id: tournament.id,
        division_id: division.id,
        name: homeTeamName,
        coach: 'Home Coach',
        email: `invite-home-${input.suffix}@example.test`,
        status: 'accepted',
        payment_status: 'paid',
      },
      {
        tournament_id: tournament.id,
        division_id: division.id,
        name: awayTeamName,
        coach: 'Away Coach',
        email: `invite-away-${input.suffix}@example.test`,
        status: 'accepted',
        payment_status: 'paid',
      },
    ])
    .select('id, name')

  if (teamsError) throw teamsError
  if (!teams || teams.length !== 2) throw new Error('Invite smoke teams were not created.')

  const homeTeam = teams.find(team => team.name === homeTeamName)
  const awayTeam = teams.find(team => team.name === awayTeamName)
  if (!homeTeam || !awayTeam) throw new Error('Invite smoke teams could not be resolved.')

  const { data: game, error: gameError } = await supabaseAdmin
    .from('games')
    .insert({
      tournament_id: tournament.id,
      division_id: division.id,
      home_team_id: homeTeam.id,
      away_team_id: awayTeam.id,
      game_date: today,
      game_time: '11:00',
      location: 'Invite Diamond',
      diamond_id: diamond.id,
      status: 'scheduled',
      is_playoff: false,
    })
    .select('id')
    .single()

  if (gameError) throw gameError

  return {
    gameId: game.id,
    homeTeamName,
    tournamentId: tournament.id,
  }
}

async function readGame(gameId: string) {
  const { data, error } = await supabaseAdmin
    .from('games')
    .select('status, home_score, away_score, score_submitted_by_email, score_submission_source')
    .eq('id', gameId)
    .single()

  if (error) throw error
  return data
}

test.describe.serial('Tournament scorekeeper invite UAT', () => {
  test.setTimeout(180_000)

  test.beforeAll(async () => {
    const orgSlug = process.env.UAT_ORG_SLUG ?? 'uat-test-org'
    const baseUrl = process.env.UAT_BASE_URL ?? 'http://localhost:3000'
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, slug')
      .eq('slug', orgSlug)
      .maybeSingle()

    if (orgError) throw orgError
    if (!org) throw new Error(`UAT organization ${orgSlug} was not found.`)

    const suffix = `invite-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    const scorekeeperEmail = `uat-scorekeeper-${suffix}@example.test`
    const redirectTo = `${baseUrl}/auth/callback?next=${encodeURIComponent(`/auth/accept-invite?org=${orgSlug}`)}`

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: scorekeeperEmail,
      options: { redirectTo },
    })

    if (linkError || !linkData) throw linkError ?? new Error('Invite link was not generated.')

    const actionLink = getActionLink(linkData)
    if (!actionLink) throw new Error('Invite link did not include an action link.')
    if (!linkData.user?.id) throw new Error('Invite link did not include a user id.')

    const game = await createAssignedGame({
      orgId: org.id,
      suffix,
    })

    const { data: member, error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: linkData.user.id,
        role: 'official',
        status: 'invited',
        invited_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (memberError) throw memberError

    const { error: assignmentError } = await supabaseAdmin
      .from('org_member_tournament_assignments')
      .insert({
        org_member_id: member.id,
        tournament_id: game.tournamentId,
      })

    if (assignmentError) throw assignmentError

    state = {
      actionLink,
      gameId: game.gameId,
      homeTeamName: game.homeTeamName,
      memberId: member.id,
      orgSlug,
      scorekeeperEmail,
      tournamentId: game.tournamentId,
      userId: linkData.user.id,
    }
  })

  test.afterAll(async () => {
    if (!state) return

    await supabaseAdmin.from('tournaments').delete().eq('id', state.tournamentId)
    await supabaseAdmin.from('organization_members').delete().eq('id', state.memberId)
    await supabaseAdmin.auth.admin.deleteUser(state.userId)
  })

  test('invited scorekeeper accepts access, lands in Scorekeeper View, and submits first score', async ({ browser }) => {
    const smoke = expectState()
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto(smoke.actionLink, { waitUntil: 'domcontentloaded', timeout: 60_000 })

    await expect(page.getByRole('heading', { name: 'Set Up Scorekeeper Access' })).toBeVisible({ timeout: 45_000 })
    await expect(page.getByText('Create a password to open the scorekeeper workspace')).toBeVisible()

    await page.locator('#accept-first-name').fill('Invite Smoke')
    await page.locator('#accept-last-name').fill('Scorekeeper')
    await page.locator('#accept-password').fill(SCOREKEEPER_PASSWORD)
    await page.getByRole('button', { name: 'Create Password & Open Scorekeeper' }).click()

    await expect(page).toHaveURL(new RegExp(`/${smoke.orgSlug}/scorekeeper`), { timeout: 45_000 })
    await expect(page.getByRole('heading', { name: 'Field scores' })).toBeVisible({ timeout: 20_000 })

    const gameCard = page.getByRole('button', { name: new RegExp(smoke.homeTeamName) })
    await expect(gameCard).toBeVisible({ timeout: 20_000 })
    await gameCard.click()

    const scoreSheet = page.locator('form').filter({ hasText: 'Enter Score' })
    await scoreSheet.getByRole('spinbutton').nth(0).fill('6')
    await scoreSheet.getByRole('spinbutton').nth(1).fill('5')
    await scoreSheet.getByRole('button', { name: /Submit for Review/ }).click()

    await expect(page.getByText('Score sent for review')).toBeVisible({ timeout: 10_000 })

    await expect.poll(async () => {
      const game = await readGame(smoke.gameId)
      return {
        awayScore: game.away_score,
        email: game.score_submitted_by_email,
        homeScore: game.home_score,
        source: game.score_submission_source,
        status: game.status,
      }
    }, { timeout: 10_000 }).toEqual({
      awayScore: 5,
      email: smoke.scorekeeperEmail,
      homeScore: 6,
      source: 'scorekeeper',
      status: 'submitted',
    })

    await context.close()
  })
})
