import { expect, test } from '@playwright/test'
import path from 'path'

import { supabaseAdmin } from '../../../lib/supabase-admin'
import { provisionStandaloneTeamWorkspace } from '../../../lib/team-workspace-provisioning'

const OWNER_STORAGE = path.join(__dirname, '../.auth/org-owner.json')
const SMOKE_COACH_PASSWORD = 'devpass123'

type SmokeState = {
  coachEmail: string
  coachUserId: string
  eventId: string
  eventName: string
  linkedOrgId: string
  linkedOrgSlug: string
  playerIds: {
    ava: string
    maya: string
    zoe: string
  }
  repTeamId: string
  teamWorkspaceId: string
  workspaceOrgId: string
  workspaceSlug: string
}

let state: SmokeState | null = null

test.describe.serial('standalone Team attendance smoke', () => {
  test.beforeAll(async () => {
    const linkedOrgSlug = process.env.UAT_ORG_SLUG ?? 'uat-test-org'
    const { data: linkedOrg, error: linkedOrgError } = await supabaseAdmin
      .from('organizations')
      .select('id, slug')
      .eq('slug', linkedOrgSlug)
      .maybeSingle()

    if (linkedOrgError) throw linkedOrgError
    if (!linkedOrg) throw new Error(`UAT organization ${linkedOrgSlug} was not found.`)

    const suffix = `attendance-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    const coachEmail = `team-attendance-smoke-${suffix}@dev.local`
    const { data: coachUser, error: coachUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email: coachEmail,
        email_confirm: true,
        password: SMOKE_COACH_PASSWORD,
      })

    if (coachUserError) throw coachUserError
    if (!coachUser.user?.id) throw new Error('Smoke coach user was not created.')

    const teamName = `Team Attendance Smoke ${suffix}`
    const workspaceSlug = `team-attendance-smoke-${suffix}`
    const provisioned = await provisionStandaloneTeamWorkspace({
      actorEmail: coachEmail,
      actorUserId: coachUser.user.id,
      ageGroup: 'U13',
      billingMode: 'platform_override',
      entitlementSource: 'platform_override',
      eventSource: 'platform_admin',
      ownerEmail: coachEmail,
      ownerUserId: coachUser.user.id,
      seasonName: `Attendance Smoke ${new Date().getFullYear()}`,
      seasonYear: new Date().getFullYear(),
      source: 'platform_admin',
      sport: 'softball',
      teamName,
      teamSlug: workspaceSlug,
      workspaceName: teamName,
      workspaceSlug,
    })

    const { data: players, error: playersError } = await supabaseAdmin
      .from('rep_roster_players')
      .insert([
        {
          program_year_id: provisioned.programYear.id,
          team_id: provisioned.team.id,
          org_id: provisioned.org.id,
          player_first_name: 'Ava',
          player_last_name: 'Baker',
          player_number: '7',
          guardian_first_name: 'Avery',
          guardian_last_name: 'Baker',
          guardian_email: `ava-${suffix}@example.test`,
          status: 'active',
          source: 'admin_manual',
        },
        {
          program_year_id: provisioned.programYear.id,
          team_id: provisioned.team.id,
          org_id: provisioned.org.id,
          player_first_name: 'Maya',
          player_last_name: 'Chen',
          player_number: '12',
          guardian_first_name: 'Morgan',
          guardian_last_name: 'Chen',
          guardian_email: `maya-${suffix}@example.test`,
          status: 'active',
          source: 'admin_manual',
        },
        {
          program_year_id: provisioned.programYear.id,
          team_id: provisioned.team.id,
          org_id: provisioned.org.id,
          player_first_name: 'Zoe',
          player_last_name: 'Diaz',
          player_number: '21',
          guardian_first_name: 'Zara',
          guardian_last_name: 'Diaz',
          guardian_email: `zoe-${suffix}@example.test`,
          status: 'active',
          source: 'admin_manual',
        },
      ])
      .select('id, player_first_name')

    if (playersError) throw playersError
    if (!players || players.length !== 3) throw new Error('Smoke roster players were not created.')

    const playerIdByFirstName = new Map(players.map(player => [player.player_first_name as string, player.id as string]))
    const eventName = `Attendance Practice ${suffix}`
    const { data: event, error: eventError } = await supabaseAdmin
      .from('rep_team_events')
      .insert({
        program_year_id: provisioned.programYear.id,
        team_id: provisioned.team.id,
        org_id: provisioned.org.id,
        event_type: 'practice',
        name: eventName,
        starts_at: new Date(Date.now() + 86_400_000).toISOString(),
        location: 'Field 1',
      })
      .select('id')
      .single()

    if (eventError) throw eventError

    const now = new Date().toISOString()
    const { error: linkError } = await supabaseAdmin
      .from('team_org_links')
      .insert({
        team_workspace_id: provisioned.teamWorkspaceId,
        rep_team_id: provisioned.team.id,
        linked_org_id: linkedOrg.id,
        status: 'linked',
        link_type: 'visibility',
        sharing_level: 'basic',
        requested_by_user_id: coachUser.user.id,
        approved_by_team_user_id: coachUser.user.id,
        approved_by_org_user_id: coachUser.user.id,
        billing_mode_after_approval: null,
        updated_at: now,
      })
    if (linkError) throw linkError

    const { error: workspaceLinkError } = await supabaseAdmin
      .from('team_workspaces')
      .update({ workspace_state: 'linked', updated_at: now })
      .eq('id', provisioned.teamWorkspaceId)
    if (workspaceLinkError) throw workspaceLinkError

    const { error: orgLinkError } = await supabaseAdmin
      .from('organizations')
      .update({ team_workspace_status: 'linked' })
      .eq('id', provisioned.org.id)
    if (orgLinkError) throw orgLinkError

    state = {
      coachEmail,
      coachUserId: coachUser.user.id,
      eventId: event.id as string,
      eventName,
      linkedOrgId: linkedOrg.id as string,
      linkedOrgSlug: linkedOrg.slug as string,
      playerIds: {
        ava: playerIdByFirstName.get('Ava')!,
        maya: playerIdByFirstName.get('Maya')!,
        zoe: playerIdByFirstName.get('Zoe')!,
      },
      repTeamId: provisioned.team.id,
      teamWorkspaceId: provisioned.teamWorkspaceId,
      workspaceOrgId: provisioned.org.id,
      workspaceSlug: provisioned.org.slug,
    }
  })

  test.afterAll(async () => {
    if (!state) return

    await supabaseAdmin
      .from('team_org_links')
      .delete()
      .eq('team_workspace_id', state.teamWorkspaceId)
    await supabaseAdmin.from('organizations').delete().eq('id', state.workspaceOrgId)
    await supabaseAdmin.auth.admin.deleteUser(state.coachUserId)
  })

  test('coach marks event attendance and linked org owner cannot read the coach attendance API', async ({ browser }) => {
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

    await coachPage.goto(`/${state.workspaceSlug}/coaches/teams/${state.repTeamId}/schedule`)
    await expect(coachPage.getByRole('heading', { name: 'Team Calendar' })).toBeVisible({
      timeout: 30_000,
    })
    await coachPage.getByRole('button', { name: new RegExp(state.eventName) }).click()
    await expect(coachPage.getByRole('heading', { name: state.eventName })).toBeVisible({
      timeout: 30_000,
    })

    await coachPage.getByRole('group', { name: /#7 Ava Baker/ }).getByRole('button', { name: 'In' }).click()
    await coachPage.getByLabel('Attendance note for #7 Ava Baker').fill('Confirmed by coach')
    await coachPage.getByRole('group', { name: /#12 Maya Chen/ }).getByRole('button', { name: 'Out' }).click()
    await coachPage.getByLabel('Attendance note for #12 Maya Chen').fill('Family conflict')
    await coachPage.getByRole('group', { name: /#21 Zoe Diaz/ }).getByRole('button', { name: 'Late' }).click()
    await coachPage.getByLabel('Attendance note for #21 Zoe Diaz').fill('Arriving after warmup')

    await coachPage.getByRole('button', { name: 'Save attendance' }).click()
    await expect(coachPage.getByText('Unsaved changes')).not.toBeVisible({ timeout: 15_000 })

    await coachPage.reload()
    await expect(coachPage.getByRole('heading', { name: 'Team Calendar' })).toBeVisible({
      timeout: 30_000,
    })
    await coachPage.getByRole('button', { name: new RegExp(state.eventName) }).click()
    await expect(coachPage.getByRole('group', { name: /#7 Ava Baker/ }).getByRole('button', { name: 'In' }))
      .toHaveAttribute('aria-pressed', 'true')
    await expect(coachPage.getByLabel('Attendance note for #12 Maya Chen')).toHaveValue('Family conflict')

    await coachContext.close()

    const { data: attendance, error: attendanceError } = await supabaseAdmin
      .from('rep_team_event_attendance')
      .select('player_id, status, note, org_id, team_id, program_year_id')
      .eq('event_id', state.eventId)

    if (attendanceError) throw attendanceError

    const attendanceByPlayer = new Map((attendance ?? []).map(row => [row.player_id as string, row]))
    expect(attendanceByPlayer.get(state.playerIds.ava)?.status).toBe('attending')
    expect(attendanceByPlayer.get(state.playerIds.ava)?.note).toBe('Confirmed by coach')
    expect(attendanceByPlayer.get(state.playerIds.maya)?.status).toBe('absent')
    expect(attendanceByPlayer.get(state.playerIds.zoe)?.status).toBe('late')
    for (const row of attendance ?? []) {
      expect(row.org_id).toBe(state.workspaceOrgId)
      expect(row.team_id).toBe(state.repTeamId)
    }

    const ownerContext = await browser.newContext({ storageState: OWNER_STORAGE })
    const ownerPage = await ownerContext.newPage()
    const ownerResponse = await ownerPage.goto(
      `/api/coaches/${state.workspaceSlug}/teams/${state.repTeamId}/events/${state.eventId}/attendance`,
    )
    expect(ownerResponse?.status()).toBe(403)
    await ownerContext.close()
  })
})
