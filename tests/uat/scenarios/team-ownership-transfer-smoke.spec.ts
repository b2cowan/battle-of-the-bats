import { expect, test } from '@playwright/test'
import path from 'path'

import { supabaseAdmin } from '../../../lib/supabase-admin'
import { provisionStandaloneTeamWorkspace } from '../../../lib/team-workspace-provisioning'

const PLATFORM_ADMIN_STORAGE = path.join(__dirname, '../.auth/platform-admin.json')
const SMOKE_COACH_PASSWORD = 'devpass123'

type SmokeState = {
  coachEmail: string
  coachUserId: string
  linkedOrgId: string
  linkedOrgSlug: string
  linkId: string
  originalLinkedOrgAddons: string[]
  repTeamId: string
  teamLedgerId: string | null
  teamName: string
  teamWorkspaceId: string
  workspaceOrgId: string
  workspaceSlug: string
}

let state: SmokeState | null = null

async function poll<T>(
  fn: () => Promise<T | null>,
  timeoutMs = 60_000,
  intervalMs = 1_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  let last: T | null = null
  while (Date.now() < deadline) {
    last = await fn()
    if (last) return last
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
  throw new Error(`Timed out waiting for expected state. Last value: ${JSON.stringify(last)}`)
}

test.describe.serial('standalone Team ownership transfer smoke', () => {
  test.beforeAll(async () => {
    const linkedOrgSlug = process.env.UAT_ORG_SLUG ?? 'uat-test-org'
    const { data: linkedOrg, error: linkedOrgError } = await supabaseAdmin
      .from('organizations')
      .select('id, slug, plan_id, account_kind, enabled_addons')
      .eq('slug', linkedOrgSlug)
      .maybeSingle()

    if (linkedOrgError) throw linkedOrgError
    if (!linkedOrg) throw new Error(`UAT organization ${linkedOrgSlug} was not found.`)
    expect(linkedOrg.account_kind ?? 'organization').not.toBe('team_workspace')
    expect(linkedOrg.plan_id).not.toBe('team')

    const originalLinkedOrgAddons = Array.isArray(linkedOrg.enabled_addons)
      ? linkedOrg.enabled_addons as string[]
      : []
    if (linkedOrg.plan_id !== 'club' && !originalLinkedOrgAddons.includes('module_rep_teams')) {
      const { error: addonError } = await supabaseAdmin
        .from('organizations')
        .update({ enabled_addons: [...originalLinkedOrgAddons, 'module_rep_teams'] })
        .eq('id', linkedOrg.id)
      if (addonError) throw addonError
    }

    const suffix = `owner-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    const coachEmail = `team-owner-smoke-${suffix}@dev.local`
    const { data: coachUser, error: coachUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email: coachEmail,
        email_confirm: true,
        password: SMOKE_COACH_PASSWORD,
      })

    if (coachUserError) throw coachUserError
    if (!coachUser.user?.id) throw new Error('Smoke coach user was not created.')

    const teamName = `Team Ownership Smoke ${suffix}`
    const workspaceSlug = `team-owner-smoke-${suffix}`
    const provisioned = await provisionStandaloneTeamWorkspace({
      actorEmail: coachEmail,
      actorUserId: coachUser.user.id,
      ageGroup: 'U13',
      billingMode: 'platform_override',
      entitlementSource: 'platform_override',
      eventSource: 'platform_admin',
      ownerEmail: coachEmail,
      ownerUserId: coachUser.user.id,
      seasonName: `Ownership Smoke ${new Date().getFullYear()}`,
      seasonYear: new Date().getFullYear(),
      source: 'platform_admin',
      sport: 'softball',
      teamName,
      teamSlug: workspaceSlug,
      workspaceName: teamName,
      workspaceSlug,
    })

    const { data: ledger, error: ledgerError } = await supabaseAdmin
      .from('accounting_ledgers')
      .select('id')
      .eq('org_id', provisioned.org.id)
      .eq('entity_type', 'team')
      .eq('entity_id', provisioned.team.id)
      .maybeSingle()
    if (ledgerError) throw ledgerError

    const now = new Date().toISOString()
    const { data: link, error: linkError } = await supabaseAdmin
      .from('team_org_links')
      .insert({
        team_workspace_id: provisioned.teamWorkspaceId,
        rep_team_id: provisioned.team.id,
        linked_org_id: linkedOrg.id,
        status: 'ownership_pending',
        link_type: 'ownership',
        sharing_level: 'full_org_owned',
        requested_by_user_id: coachUser.user.id,
        approved_by_team_user_id: coachUser.user.id,
        approved_by_org_user_id: coachUser.user.id,
        billing_mode_after_approval: null,
        updated_at: now,
      })
      .select('id')
      .single()

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
      linkedOrgId: linkedOrg.id,
      linkedOrgSlug: linkedOrg.slug,
      linkId: link.id,
      originalLinkedOrgAddons,
      repTeamId: provisioned.team.id,
      teamLedgerId: ledger?.id ?? null,
      teamName,
      teamWorkspaceId: provisioned.teamWorkspaceId,
      workspaceOrgId: provisioned.org.id,
      workspaceSlug: provisioned.org.slug,
    }
  })

  test.afterAll(async () => {
    if (!state) return

    await supabaseAdmin
      .from('accounting_ledgers')
      .delete()
      .eq('entity_type', 'team')
      .eq('entity_id', state.repTeamId)
    await supabaseAdmin.from('rep_teams').delete().eq('id', state.repTeamId)
    await supabaseAdmin
      .from('organization_members')
      .delete()
      .eq('organization_id', state.linkedOrgId)
      .eq('user_id', state.coachUserId)
    await supabaseAdmin
      .from('organizations')
      .update({ enabled_addons: state.originalLinkedOrgAddons })
      .eq('id', state.linkedOrgId)
    await supabaseAdmin.from('organizations').delete().eq('id', state.workspaceOrgId)
    await supabaseAdmin.auth.admin.deleteUser(state.coachUserId)
  })

  test('platform admin completes a mutually approved ownership transfer', async ({ browser }) => {
    if (!state) throw new Error('Smoke state was not initialized.')

    const platformContext = await browser.newContext({ storageState: PLATFORM_ADMIN_STORAGE })
    const platformPage = await platformContext.newPage()

    await platformPage.goto(`/platform-admin/orgs/${state.linkedOrgId}`)
    const transferCard = platformPage.locator('article').filter({ hasText: state.teamName })
    await expect(transferCard).toBeVisible({
      timeout: 30_000,
    })

    await transferCard
      .getByPlaceholder('Reason for completing this ownership transfer')
      .fill('UAT ownership transfer smoke')
    await transferCard.getByRole('button', { name: 'Complete Transfer' }).click()

    const workspace = await poll(async () => {
      const { data, error } = await supabaseAdmin
        .from('team_workspaces')
        .select('workspace_state, billing_mode, billing_owner_org_id, stripe_subscription_id')
        .eq('id', state!.teamWorkspaceId)
        .maybeSingle()
      if (error) throw error
      if (
        data?.workspace_state === 'org_owned' &&
        data.billing_mode === 'club_included' &&
        data.billing_owner_org_id === state!.linkedOrgId
      ) {
        return data
      }
      return null
    })

    expect(workspace.stripe_subscription_id).toBeNull()

    const { data: link, error: linkError } = await supabaseAdmin
      .from('team_org_links')
      .select('status, link_type, sharing_level, billing_mode_after_approval')
      .eq('id', state.linkId)
      .single()
    if (linkError) throw linkError

    expect(link.status).toBe('org_owned')
    expect(link.link_type).toBe('ownership')
    expect(link.sharing_level).toBe('full_org_owned')
    expect(link.billing_mode_after_approval).toBe('club_included')

    const { data: team, error: teamError } = await supabaseAdmin
      .from('rep_teams')
      .select('org_id, group_id')
      .eq('id', state.repTeamId)
      .single()
    if (teamError) throw teamError

    expect(team.org_id).toBe(state.linkedOrgId)
    expect(team.group_id).toBeNull()

    const { data: ledger, error: ledgerAfterError } = await supabaseAdmin
      .from('accounting_ledgers')
      .select('org_id')
      .eq('entity_type', 'team')
      .eq('entity_id', state.repTeamId)
      .maybeSingle()
    if (ledgerAfterError) throw ledgerAfterError

    expect(ledger?.org_id).toBe(state.linkedOrgId)

    const { data: coachMembership, error: coachMembershipError } = await supabaseAdmin
      .from('organization_members')
      .select('role, status, accepted_at')
      .eq('organization_id', state.linkedOrgId)
      .eq('user_id', state.coachUserId)
      .maybeSingle()
    if (coachMembershipError) throw coachMembershipError

    expect(coachMembership?.role).toBe('coach')
    expect(coachMembership?.status).toBe('active')
    expect(coachMembership?.accepted_at).toBeTruthy()

    const { data: workspaceMembership, error: workspaceMembershipError } = await supabaseAdmin
      .from('organization_members')
      .select('status')
      .eq('organization_id', state.workspaceOrgId)
      .eq('user_id', state.coachUserId)
      .maybeSingle()
    if (workspaceMembershipError) throw workspaceMembershipError

    expect(workspaceMembership?.status).toBe('suspended')

    const { count: activeEntitlements, error: entitlementError } = await supabaseAdmin
      .from('team_entitlements')
      .select('*', { count: 'exact', head: true })
      .eq('team_workspace_id', state.teamWorkspaceId)
      .in('status', ['active', 'trialing', 'past_due'])
    if (entitlementError) throw entitlementError

    expect(activeEntitlements ?? 0).toBe(0)

    const { data: workspaceOrg, error: workspaceOrgError } = await supabaseAdmin
      .from('organizations')
      .select('team_workspace_status, subscription_status')
      .eq('id', state.workspaceOrgId)
      .single()
    if (workspaceOrgError) throw workspaceOrgError

    expect(workspaceOrg.team_workspace_status).toBe('org_owned')
    expect(workspaceOrg.subscription_status).toBe('canceled')

    await platformContext.close()
  })
})
