import { expect, test } from '@playwright/test'
import path from 'path'
import Stripe from 'stripe'

import { supabaseAdmin } from '../../../lib/supabase-admin'
import { provisionStandaloneTeamWorkspace } from '../../../lib/team-workspace-provisioning'

const OWNER_STORAGE = path.join(__dirname, '../.auth/org-owner.json')

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

type SmokeState = {
  coachEmail: string
  coachUserId: string
  linkedOrgId: string
  linkedOrgSlug: string
  linkId: string
  repTeamId: string
  teamName: string
  teamWorkspaceId: string
  workspaceOrgId: string
  workspaceSlug: string
}

let state: SmokeState | null = null

async function poll<T>(
  fn: () => Promise<T | null>,
  timeoutMs = 90_000,
  intervalMs = 2_000,
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

test.describe.serial('standalone Team org billing Stripe smoke', () => {
  test.setTimeout(180_000)

  test.beforeAll(async () => {
    if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
      throw new Error('Real Stripe smoke requires STRIPE_SECRET_KEY=sk_test_...')
    }
    if (!process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')) {
      throw new Error('Real Stripe smoke requires STRIPE_WEBHOOK_SECRET=whsec_...')
    }

    const linkedOrgSlug = process.env.UAT_ORG_SLUG ?? 'uat-test-org'
    const { data: linkedOrg, error: linkedOrgError } = await supabaseAdmin
      .from('organizations')
      .select('id, slug, account_kind, plan_id, is_discoverable')
      .eq('slug', linkedOrgSlug)
      .maybeSingle()

    if (linkedOrgError) throw linkedOrgError
    if (!linkedOrg) throw new Error(`UAT organization ${linkedOrgSlug} was not found.`)

    expect(linkedOrg.account_kind ?? 'organization').not.toBe('team_workspace')
    expect(linkedOrg.plan_id).not.toBe('team')
    expect(linkedOrg.is_discoverable ?? true).toBe(true)

    const suffix = `stripe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    const coachEmail = `team-billing-smoke-${suffix}@dev.local`
    const { data: coachUser, error: coachUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email: coachEmail,
        email_confirm: true,
        password: 'devpass123',
      })

    if (coachUserError) throw coachUserError
    if (!coachUser.user?.id) throw new Error('Smoke coach user was not created.')

    const teamName = `Team Billing Stripe Smoke ${suffix}`
    const workspaceSlug = `team-billing-smoke-${suffix}`
    const provisioned = await provisionStandaloneTeamWorkspace({
      actorEmail: coachEmail,
      actorUserId: coachUser.user.id,
      division: 'U13',
      billingMode: 'platform_override',
      entitlementSource: 'platform_override',
      eventSource: 'platform_admin',
      ownerEmail: coachEmail,
      ownerUserId: coachUser.user.id,
      seasonName: `Stripe Smoke ${new Date().getFullYear()}`,
      seasonYear: new Date().getFullYear(),
      source: 'platform_admin',
      sport: 'softball',
      teamName,
      teamSlug: workspaceSlug,
      workspaceName: teamName,
      workspaceSlug,
    })

    const now = new Date().toISOString()
    const { data: link, error: linkError } = await supabaseAdmin
      .from('team_org_links')
      .insert({
        team_workspace_id: provisioned.teamWorkspaceId,
        rep_team_id: provisioned.team.id,
        linked_org_id: linkedOrg.id,
        status: 'linked',
        link_type: 'billing',
        sharing_level: 'basic',
        requested_by_user_id: coachUser.user.id,
        approved_by_team_user_id: coachUser.user.id,
        approved_by_org_user_id: null,
        billing_mode_after_approval: 'org_team_addon',
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
      repTeamId: provisioned.team.id,
      teamName,
      teamWorkspaceId: provisioned.teamWorkspaceId,
      workspaceOrgId: provisioned.org.id,
      workspaceSlug: provisioned.org.slug,
    }
  })

  test.afterAll(async () => {
    if (state?.teamWorkspaceId) {
      const { data: workspace } = await supabaseAdmin
        .from('team_workspaces')
        .select('stripe_subscription_id')
        .eq('id', state.teamWorkspaceId)
        .maybeSingle()

      const subscriptionId = workspace?.stripe_subscription_id as string | null | undefined
      if (subscriptionId?.startsWith('sub_')) {
        await stripe.subscriptions.cancel(subscriptionId).catch(() => undefined)
      }
    }

    if (state?.workspaceOrgId) {
      await supabaseAdmin.from('organizations').delete().eq('id', state.workspaceOrgId)
    }
    if (state?.coachUserId) {
      await supabaseAdmin.auth.admin.deleteUser(state.coachUserId)
    }
  })

  test('org owner completes real Stripe checkout for org Team add-on', async ({ browser }) => {
    if (!state) throw new Error('Smoke state was not initialized.')

    const ownerContext = await browser.newContext({ storageState: OWNER_STORAGE })
    const ownerPage = await ownerContext.newPage()

    await ownerPage.goto(`/${state.linkedOrgSlug}/admin/org/team-links`)
    await expect(ownerPage.getByRole('heading', { name: 'Team Links' })).toBeVisible({
      timeout: 30_000,
    })

    const card = ownerPage.locator('article').filter({ hasText: state.teamName })
    await expect(card.getByText('Coach requested org billing')).toBeVisible({ timeout: 30_000 })
    await card.getByRole('button', { name: 'Approve Annual' }).click()

    await ownerPage.waitForURL(/checkout\.stripe\.com/, { timeout: 45_000 })

    const cardLabel = ownerPage.getByText('Card', { exact: true }).first()
    const cardLabelBox = await cardLabel.boundingBox()
    if (!cardLabelBox) throw new Error('Stripe card payment method was not visible.')
    await ownerPage.mouse.click(
      cardLabelBox.x + cardLabelBox.width / 2,
      cardLabelBox.y + cardLabelBox.height / 2,
    )

    await ownerPage.getByLabel(/Card number/i).fill('4242424242424242')
    await ownerPage.getByLabel(/Expiration/i).fill('1234')
    await ownerPage.getByRole('textbox', { name: /^CVC$/i }).fill('123')

    const nameField = ownerPage.getByLabel(/Cardholder name|Name on card|Full name/i)
    if (await nameField.count()) {
      await nameField.first().fill('FieldLogicHQ Smoke')
    }

    await ownerPage.locator('[data-testid="hosted-payment-submit-button"]').click()
    await ownerPage.waitForURL(new RegExp(`/${state.linkedOrgSlug}/admin/org/team-links`), {
      timeout: 90_000,
    })

    const workspace = await poll(async () => {
      const { data, error } = await supabaseAdmin
        .from('team_workspaces')
        .select('billing_mode, billing_owner_org_id, workspace_state, stripe_subscription_id, subscription_status')
        .eq('id', state!.teamWorkspaceId)
        .maybeSingle()
      if (error) throw error
      if (
        data?.billing_mode === 'org_team_addon' &&
        data.billing_owner_org_id === state!.linkedOrgId &&
        data.workspace_state === 'linked' &&
        typeof data.stripe_subscription_id === 'string' &&
        data.stripe_subscription_id.startsWith('sub_')
      ) {
        return data
      }
      return null
    })

    expect(workspace.subscription_status).toMatch(/active|trialing/)

    const { data: link, error: linkError } = await supabaseAdmin
      .from('team_org_links')
      .select('status, link_type, sharing_level, billing_mode_after_approval, approved_by_org_user_id, approved_by_team_user_id')
      .eq('id', state.linkId)
      .single()

    if (linkError) throw linkError
    expect(link.status).toBe('linked')
    expect(link.link_type).toBe('billing')
    expect(link.sharing_level).toBe('basic')
    expect(link.billing_mode_after_approval).toBe('org_team_addon')
    expect(link.approved_by_team_user_id).toBe(state.coachUserId)
    expect(link.approved_by_org_user_id).toBeTruthy()

    const { data: entitlements, error: entitlementError } = await supabaseAdmin
      .from('team_entitlements')
      .select('org_id, source, status')
      .eq('team_workspace_id', state.teamWorkspaceId)
      .eq('source', 'org_team_addon')
      .in('status', ['active', 'trialing', 'past_due'])

    if (entitlementError) throw entitlementError
    const addOnOrgIds = new Set((entitlements ?? []).map(row => row.org_id as string))
    expect(addOnOrgIds.has(state.workspaceOrgId)).toBe(true)
    expect(addOnOrgIds.has(state.linkedOrgId)).toBe(true)

    await ownerContext.close()
  })
})
