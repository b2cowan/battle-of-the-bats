import crypto from 'crypto'
import { expect, test, type Browser } from '@playwright/test'
import path from 'path'

import { supabaseAdmin } from '../../../lib/supabase-admin'

const PLATFORM_ADMIN_STORAGE = path.join(__dirname, '../.auth/platform-admin.json')
const SMOKE_COACH_PASSWORD = 'devpass123'

type MockBillingOverride = boolean | null

type SmokeState = {
  coachEmail: string
  coachUserId: string
  repTeamId: string
  teamWorkspaceId: string
  workspaceOrgId: string
  workspaceSlug: string
}

let previousMockOverride: MockBillingOverride = null
const states: SmokeState[] = []
const sourceTournamentIds: string[] = []
const createdCoachUserIds = new Set<string>()

function futureDate(daysFromNow: number) {
  const date = new Date(Date.now() + daysFromNow * 86_400_000)
  return date.toISOString().slice(0, 10)
}

function createClaimToken() {
  return crypto.randomBytes(32).toString('base64url')
}

function hashClaimToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

async function setMockBilling(browser: Browser, value: MockBillingOverride) {
  const context = await browser.newContext({ storageState: PLATFORM_ADMIN_STORAGE })
  const response = await context.request.post('/api/dev/mock-billing', {
    data: { enabled: value },
  })
  expect(response.ok()).toBe(true)
  await context.close()
}

test.describe.serial('standalone Team direct checkout smoke', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: PLATFORM_ADMIN_STORAGE })
    const current = await context.request.get('/api/dev/mock-billing')
    expect(current.ok()).toBe(true)
    const currentJson = await current.json() as { override?: MockBillingOverride }
    previousMockOverride = currentJson.override ?? null

    const enable = await context.request.post('/api/dev/mock-billing', {
      data: { enabled: true },
    })
    expect(enable.ok()).toBe(true)
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    await setMockBilling(browser, previousMockOverride)

    for (const smoke of states) {
      await supabaseAdmin.from('organizations').delete().eq('id', smoke.workspaceOrgId)
      createdCoachUserIds.add(smoke.coachUserId)
    }
    if (sourceTournamentIds.length) {
      await supabaseAdmin.from('tournaments').delete().in('id', sourceTournamentIds)
    }
    for (const userId of createdCoachUserIds) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
    }
  })

  test('coach direct checkout creates Team workspace and enforces one free-tier tournament slot', async ({ browser }) => {
    const suffix = `direct-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    const coachEmail = `team-direct-smoke-${suffix}@dev.local`
    const workspaceSlug = `team-direct-smoke-${suffix}`
    const teamName = `Team Direct Smoke ${suffix}`

    const { data: coachUser, error: coachUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email: coachEmail,
        email_confirm: true,
        password: SMOKE_COACH_PASSWORD,
      })

    if (coachUserError) throw coachUserError
    if (!coachUser.user?.id) throw new Error('Smoke coach user was not created.')
    createdCoachUserIds.add(coachUser.user.id)

    const coachContext = await browser.newContext()
    const coachPage = await coachContext.newPage()

    await coachPage.goto('/auth/login')
    await coachPage.locator('#login-email').fill(coachEmail)
    await coachPage.locator('#login-password').fill(SMOKE_COACH_PASSWORD)
    await coachPage.locator('#login-submit').click()
    await coachPage.waitForURL((url) => !url.pathname.startsWith('/auth/login'), {
      timeout: 90_000,
    })

    const checkout = await coachPage.request.post('/api/billing/create-team-checkout', {
      data: {
        teamName,
        workspaceName: `${teamName} Workspace`,
        teamSlug: workspaceSlug,
        workspaceSlug,
        sport: 'softball',
        division: 'U13',
        seasonName: `${teamName} ${new Date().getFullYear()}`,
        seasonYear: new Date().getFullYear(),
        billingCycle: 'annual',
        returnTo: '/team?billing=annual',
      },
    })
    expect(checkout.ok()).toBe(true)

    const checkoutJson = await checkout.json() as {
      applied?: boolean
      orgSlug?: string
      repTeamId?: string
      teamWorkspaceId?: string
      url?: string
    }
    expect(checkoutJson.applied).toBe(true)
    expect(checkoutJson.orgSlug).toBe(workspaceSlug)
    expect(checkoutJson.repTeamId).toBeTruthy()
    expect(checkoutJson.teamWorkspaceId).toBeTruthy()

    await coachPage.goto(checkoutJson.url ?? `/${workspaceSlug}/coaches?success=1`)
    await expect(coachPage.getByText('Checkout is complete and your team workspace is active.')).toBeVisible({
      timeout: 30_000,
    })

    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('team_workspaces')
      .select('id, workspace_org_id, rep_team_id, workspace_state, billing_mode, billing_owner_user_id, subscription_status, source')
      .eq('id', checkoutJson.teamWorkspaceId)
      .single()
    if (workspaceError) throw workspaceError

    expect(workspace.workspace_state).toBe('independent')
    expect(workspace.billing_mode).toBe('team_direct')
    expect(workspace.billing_owner_user_id).toBe(coachUser.user.id)
    expect(workspace.subscription_status).toBe('active')
    expect(workspace.source).toBe('direct_signup')

    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, slug, account_kind, plan_id, subscription_status, tournament_limit, team_workspace_status')
      .eq('id', workspace.workspace_org_id)
      .single()
    if (orgError) throw orgError

    expect(org.slug).toBe(workspaceSlug)
    expect(org.account_kind).toBe('team_workspace')
    expect(org.plan_id).toBe('team')
    expect(org.subscription_status).toBe('active')
    expect(org.tournament_limit).toBe(1)
    expect(org.team_workspace_status).toBe('active')

    const { data: entitlement, error: entitlementError } = await supabaseAdmin
      .from('team_entitlements')
      .select('source, status, org_id, rep_team_id')
      .eq('team_workspace_id', workspace.id)
      .single()
    if (entitlementError) throw entitlementError

    expect(entitlement.source).toBe('team_plan')
    expect(entitlement.status).toBe('active')
    expect(entitlement.org_id).toBe(workspace.workspace_org_id)
    expect(entitlement.rep_team_id).toBe(workspace.rep_team_id)

    states.push({
      coachEmail,
      coachUserId: coachUser.user.id,
      repTeamId: workspace.rep_team_id,
      teamWorkspaceId: workspace.id,
      workspaceOrgId: workspace.workspace_org_id,
      workspaceSlug,
    })

    const firstTournament = await coachPage.request.post(`/api/admin/setup-tournament?orgSlug=${workspaceSlug}`, {
      data: {
        tournament: {
          name: `Local Round Robin ${suffix}`,
          slug: `local-round-robin-${suffix}`,
          year: new Date().getFullYear(),
          startDate: futureDate(14),
          endDate: futureDate(14),
        },
        divisions: [],
      },
    })
    expect(firstTournament.ok()).toBe(true)

    const secondTournament = await coachPage.request.post(`/api/admin/setup-tournament?orgSlug=${workspaceSlug}`, {
      data: {
        tournament: {
          name: `Second Local Event ${suffix}`,
          slug: `second-local-event-${suffix}`,
          year: new Date().getFullYear(),
          startDate: futureDate(21),
          endDate: futureDate(21),
        },
        divisions: [],
      },
    })
    expect(secondTournament.status()).toBe(403)
    await expect(secondTournament.json()).resolves.toMatchObject({
      error: expect.stringContaining('1 tournament slot'),
    })

    await coachContext.close()
  })

  test('tournament claim checkout creates a sourced Team workspace and marks the claim used', async ({ browser }) => {
    const suffix = `claim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    const linkedOrgSlug = process.env.UAT_ORG_SLUG ?? 'uat-test-org'
    const coachEmail = `team-claim-smoke-${suffix}@dev.local`
    const workspaceSlug = `team-claim-smoke-${suffix}`
    const tournamentName = `Claim Source Tournament ${suffix}`
    const teamName = `Claim Source Team ${suffix}`

    const { data: linkedOrg, error: linkedOrgError } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', linkedOrgSlug)
      .maybeSingle()
    if (linkedOrgError) throw linkedOrgError
    if (!linkedOrg) throw new Error(`UAT organization ${linkedOrgSlug} was not found.`)

    const { data: tournament, error: tournamentError } = await supabaseAdmin
      .from('tournaments')
      .insert({
        org_id: linkedOrg.id,
        name: tournamentName,
        slug: `claim-source-${suffix}`,
        year: new Date().getFullYear(),
        status: 'draft',
        is_active: false,
        start_date: futureDate(30),
        end_date: futureDate(31),
      })
      .select('id')
      .single()
    if (tournamentError) throw tournamentError
    sourceTournamentIds.push(tournament.id)

    const { data: division, error: divisionError } = await supabaseAdmin
      .from('divisions')
      .insert({
        tournament_id: tournament.id,
        name: 'U13',
        display_order: 1,
        capacity: 8,
        pool_count: 0,
        pool_names: '',
        requires_pool_selection: false,
      })
      .select('id')
      .single()
    if (divisionError) throw divisionError

    const { data: tournamentTeam, error: tournamentTeamError } = await supabaseAdmin
      .from('teams')
      .insert({
        tournament_id: tournament.id,
        division_id: division.id,
        name: teamName,
        coach: 'Claim Coach',
        email: coachEmail,
        status: 'accepted',
      })
      .select('id')
      .single()
    if (tournamentTeamError) throw tournamentTeamError

    const claimToken = createClaimToken()
    const { data: claim, error: claimError } = await supabaseAdmin
      .from('team_workspace_claims')
      .insert({
        tournament_id: tournament.id,
        tournament_team_id: tournamentTeam.id,
        contact_email: coachEmail,
        claim_token_hash: hashClaimToken(claimToken),
        status: 'available',
        expires_at: new Date(Date.now() + 90 * 86_400_000).toISOString(),
      })
      .select('id')
      .single()
    if (claimError) throw claimError

    const { data: coachUser, error: coachUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email: coachEmail,
        email_confirm: true,
        password: SMOKE_COACH_PASSWORD,
      })
    if (coachUserError) throw coachUserError
    if (!coachUser.user?.id) throw new Error('Smoke coach user was not created.')
    createdCoachUserIds.add(coachUser.user.id)

    const coachContext = await browser.newContext()
    const coachPage = await coachContext.newPage()

    await coachPage.goto('/auth/login')
    await coachPage.locator('#login-email').fill(coachEmail)
    await coachPage.locator('#login-password').fill(SMOKE_COACH_PASSWORD)
    await coachPage.locator('#login-submit').click()
    await coachPage.waitForURL((url) => !url.pathname.startsWith('/auth/login'), {
      timeout: 90_000,
    })

    const checkout = await coachPage.request.post('/api/billing/create-team-checkout', {
      data: {
        teamName,
        workspaceName: `${teamName} Workspace`,
        teamSlug: workspaceSlug,
        workspaceSlug,
        sport: 'softball',
        division: 'U13',
        seasonName: `${teamName} ${new Date().getFullYear()}`,
        seasonYear: new Date().getFullYear(),
        billingCycle: 'annual',
        returnTo: `/team/claim/${claimToken}?billing=annual`,
        claimToken,
      },
    })
    expect(checkout.ok()).toBe(true)

    const checkoutJson = await checkout.json() as {
      applied?: boolean
      orgSlug?: string
      teamWorkspaceId?: string
      url?: string
    }
    expect(checkoutJson.applied).toBe(true)
    expect(checkoutJson.orgSlug).toBe(workspaceSlug)
    expect(checkoutJson.teamWorkspaceId).toBeTruthy()

    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('team_workspaces')
      .select('id, workspace_org_id, rep_team_id, source, source_tournament_id, source_tournament_team_id, billing_mode')
      .eq('id', checkoutJson.teamWorkspaceId)
      .single()
    if (workspaceError) throw workspaceError

    expect(workspace.source).toBe('tournament_claim')
    expect(workspace.source_tournament_id).toBe(tournament.id)
    expect(workspace.source_tournament_team_id).toBe(tournamentTeam.id)
    expect(workspace.billing_mode).toBe('team_direct')

    const { data: claimRow, error: claimLookupError } = await supabaseAdmin
      .from('team_workspace_claims')
      .select('status, team_workspace_id, claimed_by_user_id')
      .eq('id', claim.id)
      .single()
    if (claimLookupError) throw claimLookupError

    expect(claimRow.status).toBe('claimed')
    expect(claimRow.team_workspace_id).toBe(workspace.id)
    expect(claimRow.claimed_by_user_id).toBe(coachUser.user.id)

    states.push({
      coachEmail,
      coachUserId: coachUser.user.id,
      repTeamId: workspace.rep_team_id,
      teamWorkspaceId: workspace.id,
      workspaceOrgId: workspace.workspace_org_id,
      workspaceSlug,
    })

    await coachContext.close()
  })
})
