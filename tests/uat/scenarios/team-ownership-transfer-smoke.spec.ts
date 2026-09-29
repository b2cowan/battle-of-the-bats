import { expect, test, type Page } from '@playwright/test'
import { readdirSync, readFileSync } from 'fs'
import path from 'path'

import { supabaseAdmin } from '../../../lib/supabase-admin'

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A COACH'S OWN TEAM MOVES INTO A CLUB, WHOLE — and its head coach can open it there
 * (Club Tier Stage 2, B04 / Ask 2; owner ruling 2026-09-28).
 *
 * The old smoke had a FieldLogicHQ operator press Complete Transfer, then checked the ~17 tables
 * migration 067 moved — so it passed while the head coach was refused on every membership-gated
 * screen (the staff memberships stayed behind) and ~48 newer tables were orphaned. This one:
 *   1. the coach asks (seeded), the CLUB OWNER approves on Rep Teams › Bring in a coach's team,
 *      typing the team's name — the second yes moves the team, with no operator step;
 *   2. every table the move function lists in `c_moves` holds NOTHING in the coach's old org
 *      (read from the migration itself, so the smoke follows the gate as the list grows);
 *   3. the team's head coach signs in and opens Overview, Roster, Money, Practices and Staff in
 *      the club — each renders, none refuses.
 * Needs the Club fixture (UAT_REP_CLUB_*, `seed-club-fixture.mjs`). Both people sign in FRESH — never
 * the shared saved sessions, whose refresh tokens another runner may be rotating at the same time.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const REPO = path.join(__dirname, '../../..')
const SMOKE_COACH_PASSWORD = 'devpass123'

type SmokeState = {
  clubId: string
  clubSlug: string
  coachEmail: string
  coachUserId: string
  linkId: string
  repTeamId: string
  teamName: string
  teamWorkspaceId: string
  workspaceOrgId: string
}

let state: SmokeState | null = null

/** The move function's own list of tables it empties from the coach's org (the gate's source). */
function movedTables(): string[] {
  const dir = path.join(REPO, 'supabase/migrations')
  const file = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
    .filter(f => /create\s+or\s+replace\s+function\s+public\.move_team_into_club\s*\(/i.test(readFileSync(path.join(dir, f), 'utf8')))
    .pop()
  if (!file) throw new Error('No migration defines move_team_into_club.')
  const sql = readFileSync(path.join(dir, file), 'utf8').split(/\r?\n/).map(l => l.replace(/--.*$/, '')).join('\n')
  const m = sql.match(/c_moves\s+constant\s+text\[\]\s*:=\s*array\[([\s\S]*?)\];/i)
  if (!m) throw new Error('The move function lost its c_moves array.')
  return [...m[1].matchAll(/'([a-z0-9_]+)'/g)].map(x => x[1])
}

/** A Supabase write that must land — the error, named. */
async function must<T>(what: string, run: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<NonNullable<T>> {
  const { data, error } = await run
  if (error) throw new Error(`${what}: ${error.message}`)
  if (data == null) throw new Error(`${what}: no row`)
  return data
}

/**
 * A standalone Premium portal, written row by row — the rows `provisionStandaloneTeamWorkspace`
 * writes (the shadow org, the owner, the team and its live season, the head coach's membership and
 * season row, the workspace, its entitlement, the team ledger). Not imported: that module reaches
 * `server-only` through lib/coach-membership, which Playwright cannot load (the old smoke died on
 * it at collection). If the provisioner changes shape, change this block.
 */
async function provisionWorkspace(p: { ownerUserId: string; teamName: string; slug: string }) {
  const now = new Date().toISOString()
  const org = await must('organization', supabaseAdmin.from('organizations').insert({
    name: `${p.teamName} Coaches Portal`, slug: p.slug, plan_id: 'team', account_kind: 'team_workspace',
    team_workspace_status: 'active', is_discoverable: false, subscription_status: 'active',
  }).select('id').single())
  await must('owner membership', supabaseAdmin.from('organization_members').insert({
    organization_id: org.id, user_id: p.ownerUserId, role: 'owner', status: 'active', accepted_at: now,
  }).select('id').single())
  const team = await must('team', supabaseAdmin.from('rep_teams').insert({
    org_id: org.id, name: p.teamName, slug: p.slug, sport: 'softball', division: 'U13',
  }).select('id').single())
  const year = await must('season', supabaseAdmin.from('rep_program_years').insert({
    org_id: org.id, team_id: team.id, name: `${new Date().getFullYear()} Season`, year: new Date().getFullYear(),
    status: 'active', tryout_open: false,
  }).select('id').single())
  await must('head coach membership', supabaseAdmin.from('rep_team_staff_memberships').insert({
    org_id: org.id, team_id: team.id, user_id: p.ownerUserId, coach_role: 'head_coach', status: 'active',
  }).select('id').single())
  await must('head coach season row', supabaseAdmin.from('rep_team_coaches').insert({
    org_id: org.id, team_id: team.id, program_year_id: year.id, user_id: p.ownerUserId, coach_role: 'head_coach',
  }).select('id').single())
  const workspace = await must('workspace', supabaseAdmin.from('team_workspaces').insert({
    workspace_org_id: org.id, rep_team_id: team.id, active_program_year_id: year.id, primary_owner_user_id: p.ownerUserId,
    source: 'platform_admin', workspace_state: 'independent', billing_mode: 'platform_override',
    billing_owner_user_id: p.ownerUserId, subscription_status: 'active',
  }).select('id').single())
  await must('entitlement', supabaseAdmin.from('team_entitlements').insert({
    team_workspace_id: workspace.id, org_id: org.id, rep_team_id: team.id, source: 'platform_override', status: 'active',
  }).select('id').single())
  await must('team ledger', supabaseAdmin.from('accounting_ledgers').insert({
    org_id: org.id, entity_type: 'team', entity_id: team.id, name: p.teamName,
  }).select('id').single())
  return { orgId: org.id as string, teamId: team.id as string, workspaceId: workspace.id as string }
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/auth/login')
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.locator('#login-submit').click()
  await expect.poll(() => !new URL(page.url()).pathname.startsWith('/auth/login'), { timeout: 45_000 }).toBe(true)
}

test.describe.serial('a coach’s own team moves into a club, whole', () => {
  test.beforeAll(async () => {
    const clubSlug = process.env.UAT_REP_CLUB_ORG_SLUG
    test.skip(!clubSlug, 'UAT_REP_CLUB_* not set — the Club fixture is optional')
    const { data: club, error: clubError } = await supabaseAdmin
      .from('organizations').select('id, slug').eq('slug', clubSlug!).maybeSingle()
    if (clubError) throw clubError
    if (!club) throw new Error(`Club fixture ${clubSlug} was not found — run scripts/seed-club-fixture.mjs.`)

    const suffix = `move-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const coachEmail = `team-move-smoke-${suffix}@dev.local`
    const { data: coachUser, error: coachUserError } = await supabaseAdmin.auth.admin.createUser({
      email: coachEmail, email_confirm: true, password: SMOKE_COACH_PASSWORD,
    })
    if (coachUserError) throw coachUserError
    const coachUserId = coachUser.user!.id

    const teamName = `Team Move Smoke ${suffix}`
    const provisioned = await provisionWorkspace({ ownerUserId: coachUserId, teamName, slug: `team-move-smoke-${suffix}` })
    const orgId = provisioned.orgId
    const teamId = provisioned.teamId

    // Tables 067 never moved — the ones the head coach's screens read.
    const seeds = await Promise.all([
      supabaseAdmin.from('rep_team_places').insert({ org_id: orgId, team_id: teamId, name: 'Smoke Park' }),
      supabaseAdmin.from('rep_team_tags').insert({ org_id: orgId, team_id: teamId, kind: 'focus', name: 'Smoke focus' }),
      supabaseAdmin.from('rep_team_opponents').insert({ org_id: orgId, team_id: teamId, display_name: 'Smoke Rivals', normalized_name: 'smoke rivals' }),
    ])
    for (const s of seeds) if (s.error) throw s.error

    // The coach has asked (their yes recorded); the club answers.
    const { data: link, error: linkError } = await supabaseAdmin
      .from('team_org_links')
      .insert({
        team_workspace_id: provisioned.workspaceId,
        rep_team_id: teamId,
        linked_org_id: club.id,
        status: 'ownership_pending',
        link_type: 'ownership',
        sharing_level: 'full_org_owned',
        requested_by_user_id: coachUserId,
        approved_by_team_user_id: coachUserId,
      })
      .select('id')
      .single()
    if (linkError) throw linkError

    state = {
      clubId: club.id, clubSlug: club.slug, coachEmail, coachUserId, linkId: link.id, repTeamId: teamId,
      teamName, teamWorkspaceId: provisioned.workspaceId, workspaceOrgId: orgId,
    }
  })

  test.afterAll(async () => {
    if (!state) return
    await supabaseAdmin.from('chat_rooms').delete().eq('ref_sub_id', state.repTeamId)
    await supabaseAdmin.from('accounting_ledgers').delete().eq('entity_type', 'team').eq('entity_id', state.repTeamId)
    await supabaseAdmin.from('rep_teams').delete().eq('id', state.repTeamId)
    await supabaseAdmin.from('organization_members').delete().eq('organization_id', state.clubId).eq('user_id', state.coachUserId)
    await supabaseAdmin.from('organizations').delete().eq('id', state.workspaceOrgId)
    await supabaseAdmin.auth.admin.deleteUser(state.coachUserId)
  })

  test('the club owner approves, and the whole team moves in', async ({ browser }) => {
    const s = state!
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await ctx.newPage()
    await signIn(page, process.env.UAT_REP_CLUB_OWNER_EMAIL!, process.env.UAT_REP_CLUB_OWNER_PASSWORD!)
    await page.goto(`/${s.clubSlug}/admin/rep-teams/bring-in`)

    const card = page.locator('article').filter({ hasText: `${s.teamName} wants to join` })
    await expect(card).toBeVisible({ timeout: 45_000 })
    // What the club reads BEFORE it agrees (J4-037): the cost, the coach's own plan, what moves.
    await expect(card).toContainText('What it costs the club')
    await expect(card).toContainText('won’t be charged for their own Coaches Portal again')
    await expect(card).toContainText('can’t be undone')

    await card.getByRole('button', { name: `Approve and bring in ${s.teamName}` }).click()
    const dialog = page.getByRole('dialog', { name: `Bring ${s.teamName} into` })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Team name').fill(s.teamName.toLowerCase())
    await dialog.getByRole('button', { name: `Bring in ${s.teamName}` }).click()
    await expect(page.getByText(`${s.teamName} is now one of your teams.`)).toBeVisible({ timeout: 45_000 })
    await ctx.close()

    // The team, its season, its staff — in the club.
    const [{ data: team }, { data: link }, { data: workspace }, { data: seat }, { data: oldSeat }] = await Promise.all([
      supabaseAdmin.from('rep_teams').select('org_id').eq('id', s.repTeamId).single(),
      supabaseAdmin.from('team_org_links').select('status').eq('id', s.linkId).single(),
      supabaseAdmin.from('team_workspaces').select('workspace_state, stripe_subscription_id').eq('id', s.teamWorkspaceId).single(),
      supabaseAdmin.from('organization_members').select('role, status').eq('organization_id', s.clubId).eq('user_id', s.coachUserId).maybeSingle(),
      supabaseAdmin.from('organization_members').select('status').eq('organization_id', s.workspaceOrgId).eq('user_id', s.coachUserId).maybeSingle(),
    ])
    expect(team?.org_id).toBe(s.clubId)
    expect(link?.status).toBe('org_owned')
    expect(workspace?.workspace_state).toBe('org_owned')
    expect(workspace?.stripe_subscription_id).toBeNull()
    expect(seat).toMatchObject({ role: 'coach', status: 'active' })
    expect(oldSeat?.status).toBe('suspended')

    const { data: membership } = await supabaseAdmin
      .from('rep_team_staff_memberships').select('org_id, coach_role, status')
      .eq('team_id', s.repTeamId).eq('user_id', s.coachUserId).single()
    expect(membership).toMatchObject({ org_id: s.clubId, coach_role: 'head_coach', status: 'active' })

    // Nothing of the team is left in the coach's old org — every table the move lists.
    const leftBehind: string[] = []
    for (const table of movedTables()) {
      const { count, error } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true }).eq('org_id', s.workspaceOrgId)
      if (error) throw new Error(`${table}: ${error.message}`)
      if ((count ?? 0) > 0) leftBehind.push(`${table} (${count})`)
    }
    expect(leftBehind, 'left in the coach’s old org').toEqual([])

    // The staff are told, in the club (their bell lives there now) — best-effort, so poll briefly.
    await expect.poll(async () => {
      const { count } = await supabaseAdmin.from('notifications').select('*', { count: 'exact', head: true })
        .eq('user_id', s.coachUserId).eq('org_id', s.clubId).eq('event_type', 'team_move_answered')
      return count ?? 0
    }, { timeout: 15_000 }).toBe(1)
    for (const table of ['rep_team_places', 'rep_team_tags', 'rep_team_opponents']) {
      const { count } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true }).eq('org_id', s.clubId).eq('team_id', s.repTeamId)
      expect(count, `${table} moved`).toBe(1)
    }
  })

  test('the head coach opens the team in the club — Overview, Roster, Money, Practices, Staff', async ({ browser }) => {
    const s = state!
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await ctx.newPage()
    await signIn(page, s.coachEmail, SMOKE_COACH_PASSWORD)

    const base = `/${s.clubSlug}/coaches/teams/${s.repTeamId}`
    for (const [screen, suffix] of [
      ['Overview', ''], ['Roster', '/roster'], ['Money', '/accounting'], ['Practices', '/practice'], ['Staff', '/staff'],
    ] as const) {
      const response = await page.goto(`${base}${suffix}`)
      expect(response?.status(), `${screen} answered`).toBeLessThan(400)
      await expect(page.locator('h1').first(), `${screen} rendered its title`).toBeVisible({ timeout: 45_000 })
      expect(new URL(page.url()).pathname, `${screen} stayed on the team`).toContain(`/coaches/teams/${s.repTeamId}`)
      await expect(page.getByText(/You are not assigned to this team|isn’t turned on for you|Forbidden/), `${screen} refused nothing`).toHaveCount(0)
    }
    await ctx.close()
  })
})
