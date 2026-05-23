import { expect, test } from '@playwright/test'
import path from 'path'

import { supabaseAdmin } from '../../../lib/supabase-admin'
import { provisionStandaloneTeamWorkspace } from '../../../lib/team-workspace-provisioning'

const OWNER_STORAGE = path.join(__dirname, '../.auth/org-owner.json')
const SMOKE_COACH_PASSWORD = 'devpass123'

type SmokeState = {
  coachEmail: string
  coachUserId: string
  linkedOrgId: string
  linkedOrgSlug: string
  linkId: string | null
  repTeamId: string
  teamName: string
  teamWorkspaceId: string
  workspaceOrgId: string
  workspaceSlug: string
}

let state: SmokeState | null = null
let inviteState: SmokeState | null = null

test.describe.serial('standalone Team org-link smoke', () => {
  test.beforeAll(async () => {
    const linkedOrgSlug = process.env.UAT_ORG_SLUG ?? 'uat-test-org'
    const { data: linkedOrg, error: linkedOrgError } = await supabaseAdmin
      .from('organizations')
      .select('id, slug, account_kind, plan_id, is_discoverable')
      .eq('slug', linkedOrgSlug)
      .maybeSingle()

    if (linkedOrgError) {
      throw linkedOrgError
    }
    if (!linkedOrg) {
      throw new Error(`UAT organization ${linkedOrgSlug} was not found.`)
    }

    expect(linkedOrg.account_kind ?? 'organization').not.toBe('team_workspace')
    expect(linkedOrg.plan_id).not.toBe('team')
    expect(linkedOrg.is_discoverable ?? true).toBe(true)
    const linkedOrgRecord = linkedOrg

    async function createSmokeWorkspace(label: 'link' | 'invite'): Promise<SmokeState> {
      const suffix = `${label}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
      const coachEmail = `team-${label}-smoke-${suffix}@dev.local`
      const { data: coachUser, error: coachUserError } =
        await supabaseAdmin.auth.admin.createUser({
          email: coachEmail,
          email_confirm: true,
          password: SMOKE_COACH_PASSWORD,
        })

      if (coachUserError) {
        throw coachUserError
      }
      if (!coachUser.user?.id) {
        throw new Error('Smoke coach user was not created.')
      }

      const teamName = label === 'link'
        ? `Team Link Smoke ${suffix}`
        : `Team Invite Smoke ${suffix}`
      const workspaceSlug = `team-${label}-smoke-${suffix}`
      const provisioned = await provisionStandaloneTeamWorkspace({
        actorEmail: coachEmail,
        actorUserId: coachUser.user.id,
        ageGroup: 'U13',
        billingMode: 'platform_override',
        entitlementSource: 'platform_override',
        eventSource: 'platform_admin',
        ownerEmail: coachEmail,
        ownerUserId: coachUser.user.id,
        seasonName: `Smoke ${new Date().getFullYear()}`,
        seasonYear: new Date().getFullYear(),
        source: 'platform_admin',
        sport: 'softball',
        teamName,
        teamSlug: workspaceSlug,
        workspaceName: teamName,
        workspaceSlug,
      })

      return {
        coachEmail,
        coachUserId: coachUser.user.id,
        linkedOrgId: linkedOrgRecord.id,
        linkedOrgSlug: linkedOrgRecord.slug,
        linkId: null,
        repTeamId: provisioned.team.id,
        teamName,
        teamWorkspaceId: provisioned.teamWorkspaceId,
        workspaceOrgId: provisioned.org.id,
        workspaceSlug: provisioned.org.slug,
      }
    }

    state = await createSmokeWorkspace('link')
    inviteState = await createSmokeWorkspace('invite')
  })

  test.afterAll(async () => {
    for (const item of [state, inviteState]) {
      if (item?.workspaceOrgId) {
        await supabaseAdmin.from('organizations').delete().eq('id', item.workspaceOrgId)
      }
      if (item?.coachUserId) {
        await supabaseAdmin.auth.admin.deleteUser(item.coachUserId)
      }
    }
  })

  test('coach requests a Basic org link and org owner approves it', async ({ browser }) => {
    if (!state) {
      throw new Error('Smoke state was not initialized.')
    }

    const coachContext = await browser.newContext()
    const coachPage = await coachContext.newPage()

    await coachPage.goto('/auth/login')
    await coachPage.locator('#login-email').fill(state.coachEmail)
    await coachPage.locator('#login-password').fill(SMOKE_COACH_PASSWORD)
    await coachPage.locator('#login-submit').click()
    await coachPage.waitForURL((url) => !url.pathname.startsWith('/auth/login'), {
      timeout: 90_000,
    })

    await coachPage.goto(`/${state.workspaceSlug}/coaches/link-org`)
    await expect(coachPage.getByRole('heading', { name: 'Link Organization' })).toBeVisible({
      timeout: 30_000,
    })
    await coachPage.getByLabel('Organization slug or contact email').fill(state.linkedOrgSlug)
    await coachPage.getByRole('button', { name: 'Send Request' }).click()
    await expect(
      coachPage.getByText('Organization link request sent for review.'),
    ).toBeVisible({ timeout: 15_000 })

    const { data: requestedLink, error: requestedLinkError } = await supabaseAdmin
      .from('team_org_links')
      .select('*')
      .eq('team_workspace_id', state.teamWorkspaceId)
      .eq('linked_org_id', state.linkedOrgId)
      .maybeSingle()

    if (requestedLinkError) {
      throw requestedLinkError
    }
    if (!requestedLink) {
      throw new Error('Team org link request was not created.')
    }

    expect(requestedLink.billing_mode_after_approval).toBeNull()
    expect(requestedLink.link_type).toBe('visibility')
    expect(requestedLink.sharing_level).toBe('basic')
    expect(requestedLink.status).toBe('requested')
    state.linkId = requestedLink.id

    await coachContext.close()

    const ownerContext = await browser.newContext({ storageState: OWNER_STORAGE })
    const ownerPage = await ownerContext.newPage()

    await ownerPage.goto(`/${state.linkedOrgSlug}/admin/org/team-links`)
    await expect(ownerPage.getByRole('heading', { name: 'Team Links' })).toBeVisible({
      timeout: 30_000,
    })
    await expect(ownerPage.getByText(state.teamName, { exact: true })).toBeVisible({
      timeout: 30_000,
    })
    await ownerPage.getByRole('button', { name: 'Approve Link' }).click()
    await expect(ownerPage.getByText('Team link approved.')).toBeVisible({ timeout: 15_000 })

    await ownerContext.close()

    const { data: approvedLink, error: approvedLinkError } = await supabaseAdmin
      .from('team_org_links')
      .select('*')
      .eq('id', state.linkId)
      .single()

    if (approvedLinkError) {
      throw approvedLinkError
    }

    expect(approvedLink.billing_mode_after_approval).toBeNull()
    expect(approvedLink.link_type).toBe('visibility')
    expect(approvedLink.sharing_level).toBe('basic')
    expect(approvedLink.status).toBe('linked')

    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('team_workspaces')
      .select('billing_mode, workspace_state')
      .eq('id', state.teamWorkspaceId)
      .single()

    if (workspaceError) {
      throw workspaceError
    }

    expect(workspace.billing_mode).toBe('platform_override')
    expect(workspace.workspace_state).toBe('linked')

    const { data: workspaceOrg, error: workspaceOrgError } = await supabaseAdmin
      .from('organizations')
      .select('account_kind, plan_id, team_workspace_status')
      .eq('id', state.workspaceOrgId)
      .single()

    if (workspaceOrgError) {
      throw workspaceOrgError
    }

    expect(workspaceOrg.account_kind).toBe('team_workspace')
    expect(workspaceOrg.plan_id).toBe('team')
    expect(workspaceOrg.team_workspace_status).toBe('linked')

    const { count: linkedOrgEntitlements, error: linkedOrgEntitlementsError } =
      await supabaseAdmin
        .from('team_entitlements')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', state.linkedOrgId)
        .eq('rep_team_id', state.repTeamId)

    if (linkedOrgEntitlementsError) {
      throw linkedOrgEntitlementsError
    }

    expect(linkedOrgEntitlements ?? 0).toBe(0)
  })

  test('org owner invites a Team workspace and the coach accepts it', async ({ browser }) => {
    if (!inviteState) {
      throw new Error('Invite smoke state was not initialized.')
    }

    const ownerContext = await browser.newContext({ storageState: OWNER_STORAGE })
    const ownerPage = await ownerContext.newPage()

    await ownerPage.goto(`/${inviteState.linkedOrgSlug}/admin/org/team-links`)
    await expect(ownerPage.getByRole('heading', { name: 'Team Links' })).toBeVisible({
      timeout: 30_000,
    })
    await ownerPage.getByLabel('Team workspace slug or primary coach email').fill(inviteState.workspaceSlug)
    await ownerPage.getByRole('button', { name: 'Send Invite' }).click()
    await expect(ownerPage.getByText('Team link invitation sent.')).toBeVisible({ timeout: 15_000 })

    await ownerContext.close()

    const { data: invitedLink, error: invitedLinkError } = await supabaseAdmin
      .from('team_org_links')
      .select('*')
      .eq('team_workspace_id', inviteState.teamWorkspaceId)
      .eq('linked_org_id', inviteState.linkedOrgId)
      .maybeSingle()

    if (invitedLinkError) {
      throw invitedLinkError
    }
    if (!invitedLink) {
      throw new Error('Team org link invitation was not created.')
    }

    expect(invitedLink.billing_mode_after_approval).toBeNull()
    expect(invitedLink.link_type).toBe('visibility')
    expect(invitedLink.sharing_level).toBe('basic')
    expect(invitedLink.status).toBe('invited')
    inviteState.linkId = invitedLink.id

    const coachContext = await browser.newContext()
    const coachPage = await coachContext.newPage()

    await coachPage.goto('/auth/login')
    await coachPage.locator('#login-email').fill(inviteState.coachEmail)
    await coachPage.locator('#login-password').fill(SMOKE_COACH_PASSWORD)
    await coachPage.locator('#login-submit').click()
    await coachPage.waitForURL((url) => !url.pathname.startsWith('/auth/login'), {
      timeout: 90_000,
    })

    await coachPage.goto(`/${inviteState.workspaceSlug}/coaches/link-org`)
    await expect(coachPage.getByRole('heading', { name: 'Link Organization' })).toBeVisible({
      timeout: 30_000,
    })
    await expect(coachPage.getByText('This organization invited your Team workspace to connect.')).toBeVisible({
      timeout: 30_000,
    })
    await coachPage.getByRole('button', { name: 'Accept Invitation' }).click()
    await expect(coachPage.getByText('Team invitation accepted.')).toBeVisible({ timeout: 15_000 })

    await coachContext.close()

    const { data: acceptedLink, error: acceptedLinkError } = await supabaseAdmin
      .from('team_org_links')
      .select('*')
      .eq('id', inviteState.linkId)
      .single()

    if (acceptedLinkError) {
      throw acceptedLinkError
    }

    expect(acceptedLink.billing_mode_after_approval).toBeNull()
    expect(acceptedLink.link_type).toBe('visibility')
    expect(acceptedLink.sharing_level).toBe('basic')
    expect(acceptedLink.status).toBe('linked')

    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('team_workspaces')
      .select('billing_mode, workspace_state')
      .eq('id', inviteState.teamWorkspaceId)
      .single()

    if (workspaceError) {
      throw workspaceError
    }

    expect(workspace.billing_mode).toBe('platform_override')
    expect(workspace.workspace_state).toBe('linked')

    const { count: linkedOrgEntitlements, error: linkedOrgEntitlementsError } =
      await supabaseAdmin
        .from('team_entitlements')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', inviteState.linkedOrgId)
        .eq('rep_team_id', inviteState.repTeamId)

    if (linkedOrgEntitlementsError) {
      throw linkedOrgEntitlementsError
    }

    expect(linkedOrgEntitlements ?? 0).toBe(0)
  })
})
