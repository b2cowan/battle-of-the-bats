import { expect, test } from '@playwright/test'

import { supabaseAdmin } from '../../../lib/supabase-admin'
import { provisionStandaloneTeamWorkspace } from '../../../lib/team-workspace-provisioning'

const SMOKE_COACH_PASSWORD = 'devpass123'

type SmokeState = {
  coachEmail: string
  coachUserId: string
  eventId: string
  eventName: string
  playerIds: Record<string, string>
  repTeamId: string
  teamWorkspaceId: string
  workspaceOrgId: string
  workspaceSlug: string
}

let state: SmokeState | null = null

test.describe.serial('standalone Team lineup smoke', () => {
  test.beforeAll(async () => {
    const suffix = `lineup-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    const coachEmail = `team-lineup-smoke-${suffix}@dev.local`
    const { data: coachUser, error: coachUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email: coachEmail,
        email_confirm: true,
        password: SMOKE_COACH_PASSWORD,
      })

    if (coachUserError) throw coachUserError
    if (!coachUser.user?.id) throw new Error('Smoke coach user was not created.')

    const teamName = `Team Lineup Smoke ${suffix}`
    const workspaceSlug = `team-lineup-smoke-${suffix}`
    const provisioned = await provisionStandaloneTeamWorkspace({
      actorEmail: coachEmail,
      actorUserId: coachUser.user.id,
      ageGroup: 'U15',
      billingMode: 'platform_override',
      entitlementSource: 'platform_override',
      eventSource: 'platform_admin',
      ownerEmail: coachEmail,
      ownerUserId: coachUser.user.id,
      seasonName: `Lineup Smoke ${new Date().getFullYear()}`,
      seasonYear: new Date().getFullYear(),
      source: 'platform_admin',
      sport: 'softball',
      teamName,
      teamSlug: workspaceSlug,
      workspaceName: teamName,
      workspaceSlug,
    })

    const rosterRows = Array.from({ length: 10 }, (_, index) => {
      const number = String(index + 1)
      return {
        program_year_id: provisioned.programYear.id,
        team_id: provisioned.team.id,
        org_id: provisioned.org.id,
        player_first_name: `Player${number}`,
        player_last_name: 'Lineup',
        player_number: number,
        primary_position: index === 0 ? 'P' : index === 1 ? 'C' : 'OF',
        secondary_position: index === 9 ? 'RF' : null,
        guardian_first_name: `Guardian${number}`,
        guardian_last_name: 'Lineup',
        guardian_email: `lineup-${number}-${suffix}@example.test`,
        status: 'active',
        source: 'admin_manual',
      }
    })

    const { data: players, error: playersError } = await supabaseAdmin
      .from('rep_roster_players')
      .insert(rosterRows)
      .select('id, player_number')

    if (playersError) throw playersError
    if (!players || players.length !== 10) throw new Error('Smoke roster players were not created.')

    const eventName = `Lineup Game ${suffix}`
    const { data: event, error: eventError } = await supabaseAdmin
      .from('rep_team_events')
      .insert({
        program_year_id: provisioned.programYear.id,
        team_id: provisioned.team.id,
        org_id: provisioned.org.id,
        event_type: 'league_game',
        name: eventName,
        starts_at: new Date(Date.now() + 86_400_000).toISOString(),
        opponent: 'Smoke Opponent',
        location: 'Diamond 2',
      })
      .select('id')
      .single()

    if (eventError) throw eventError

    state = {
      coachEmail,
      coachUserId: coachUser.user.id,
      eventId: event.id as string,
      eventName,
      playerIds: Object.fromEntries(players.map(player => [String(player.player_number), player.id as string])),
      repTeamId: provisioned.team.id,
      teamWorkspaceId: provisioned.teamWorkspaceId,
      workspaceOrgId: provisioned.org.id,
      workspaceSlug: provisioned.org.slug,
    }
  })

  test.afterAll(async () => {
    if (!state) return

    await supabaseAdmin.from('organizations').delete().eq('id', state.workspaceOrgId)
    await supabaseAdmin.auth.admin.deleteUser(state.coachUserId)
  })

  test('coach saves 9 player ball and everyone bats lineups', async ({ browser }) => {
    if (!state) throw new Error('Smoke state was not initialized.')

    const coachContext = await browser.newContext()
    const coachPage = await coachContext.newPage()

    await coachPage.goto('/auth/login')
    await coachPage.locator('#login-email').fill(state.coachEmail)
    await coachPage.locator('#login-password').fill(SMOKE_COACH_PASSWORD)
    await coachPage.locator('#login-submit').click()
    await coachPage.waitForURL((url) => !url.pathname.startsWith('/auth/login'), {
      timeout: 90_000,
    })

    await coachPage.goto(`/${state.workspaceSlug}/coaches/teams/${state.repTeamId}`)
    await expect(coachPage.getByText('Season setup')).toBeVisible({
      timeout: 30_000,
    })
    await expect(coachPage.getByRole('heading', { name: '5 of 7 complete' })).toBeVisible()
    await expect(coachPage.getByText('Prepare game lineups')).toBeVisible()

    await coachPage.goto(`/${state.workspaceSlug}/coaches/teams/${state.repTeamId}/schedule`)
    await expect(coachPage.getByRole('heading', { name: 'Team Calendar' })).toBeVisible({
      timeout: 30_000,
    })
    await coachPage.getByRole('button', { name: new RegExp(state.eventName) }).click()
    await expect(coachPage.getByRole('heading', { name: state.eventName })).toBeVisible({
      timeout: 30_000,
    })
    await expect(coachPage.getByLabel('Lineup format')).toHaveValue('everyone_bats', {
      timeout: 30_000,
    })
    await expect(coachPage.getByLabel('Inning 1 position for #10 Player10 Lineup')).toBeVisible({
      timeout: 30_000,
    })

    await coachPage.getByLabel('Lineup format').selectOption('nine_player')
    await coachPage.getByLabel('Lineup innings').selectOption('3')
    await expect(coachPage.getByLabel('Lineup format')).toHaveValue('nine_player')
    await expect(coachPage.getByLabel('Lineup innings')).toHaveValue('3')
    await expect(coachPage.getByLabel('Starter for #10 Player10 Lineup')).toBeVisible()
    await expect(coachPage.getByLabel('Inning 4 position for #1 Player1 Lineup')).toHaveCount(0)
    await coachPage.getByLabel('Inning 1 position for #1 Player1 Lineup').selectOption('P')
    await coachPage.getByLabel('Inning 2 position for #10 Player10 Lineup').selectOption('RF')
    await coachPage.getByRole('button', { name: 'Save lineup' }).click()
    await expect(coachPage.getByText('Unsaved changes')).not.toBeVisible({ timeout: 15_000 })

    const { data: ninePlayerLineup, error: ninePlayerError } = await supabaseAdmin
      .from('rep_team_lineups')
      .select('id, lineup_mode, inning_count')
      .eq('event_id', state.eventId)
      .single()
    if (ninePlayerError) throw ninePlayerError

    expect(ninePlayerLineup.lineup_mode).toBe('nine_player')
    expect(ninePlayerLineup.inning_count).toBe(3)

    const { data: ninePlayerEntries, error: ninePlayerEntriesError } = await supabaseAdmin
      .from('rep_team_lineup_entries')
      .select('player_id, batting_order, starter, inning_positions')
      .eq('lineup_id', ninePlayerLineup.id)
    if (ninePlayerEntriesError) throw ninePlayerEntriesError

    const ninePlayerBench = (ninePlayerEntries ?? []).find(entry => entry.player_id === state!.playerIds['10'])
    expect(ninePlayerBench?.starter).toBe(false)
    expect(ninePlayerBench?.batting_order).toBeNull()
    expect((ninePlayerBench?.inning_positions as Record<string, string> | null)?.['2']).toBe('RF')

    await coachPage.getByLabel('Lineup format').selectOption('everyone_bats')
    await coachPage.getByRole('button', { name: 'Save lineup' }).click()
    await expect(coachPage.getByText('Unsaved changes')).not.toBeVisible({ timeout: 15_000 })

    const { data: everyoneLineup, error: everyoneError } = await supabaseAdmin
      .from('rep_team_lineups')
      .select('id, lineup_mode')
      .eq('event_id', state.eventId)
      .single()
    if (everyoneError) throw everyoneError

    expect(everyoneLineup.lineup_mode).toBe('everyone_bats')

    const { data: everyoneEntries, error: everyoneEntriesError } = await supabaseAdmin
      .from('rep_team_lineup_entries')
      .select('player_id, batting_order, starter')
      .eq('lineup_id', everyoneLineup.id)
    if (everyoneEntriesError) throw everyoneEntriesError

    const everyoneBench = (everyoneEntries ?? []).find(entry => entry.player_id === state!.playerIds['10'])
    expect(everyoneBench?.starter).toBe(true)
    expect(everyoneBench?.batting_order).toBe(10)

    await coachContext.close()
  })
})
