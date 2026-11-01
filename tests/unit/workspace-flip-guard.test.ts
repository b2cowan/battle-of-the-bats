/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE WORKSPACE FLIP — NOTHING PORTAL-ISH SURVIVES ON A CLUB THAT WAS A COACHES PORTAL
 * (Plan & billing Stage 4b, Part 1; plan §6; owner ruling 2026-10-30: the workspace BECOMES the club, in place).
 *
 * A coach's standalone Coaches Portal wears a permanent tag (`account_kind='team_workspace'`, plan `team`) that about a
 * hundred files read, and its billing records sit on the Coaches Portal kind. Flipping the plan alone changes none of them.
 * The flip (`flip_workspace_into_club`, mig 414) must reset ALL of it, or the club keeps portal behaviour — and a later
 * Club cancellation would run the portal's retention window and send the portal's email. Two layers:
 *
 *   1. THE RPC'S OWN TEXT (the newest migration that defines it) — what it sets, what it refuses, what it leaves alone,
 *      pinned against the TypeScript constants it must agree with (the club plans, the workspace-only grants, the tournament
 *      bundle, the free-time grant type) and against the app wrapper's refusal list.
 *   2. A WORKSPACE FIXTURE with the flip's column set applied (the assignments are READ OUT OF THE SQL, never retyped here):
 *      every portal test that can be loaded says "not a portal", the billing link is the admin one, the directory clauses
 *      pass, the portal's cancel branch and a late old-price event find nothing to match.
 *   + THE CENSUS: every production file that reads the portal tag or the workspace row (by ANY column — widened in Part 4,
 *     when 22 readers by org, team or owner were found outside it) is on an allowlist with a reason. A new one fails — that is
 *     the decision point: does a flipped club behave correctly there?
 *
 * Nothing here talks to a database. The RPC itself has not run anywhere (mig 414 is not applied); its behaviour on real rows
 * is the dev walk's to prove.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { readCode, readSource } from './_source-code.ts';
import { isTeamWorkspaceOrg } from '../../lib/team-workspace-kind.ts';
import { isTeamWorkspaceRelation } from '../../lib/org-membership-policy.ts';
import { freeTimeBlockOf } from '../../lib/free-time.ts';
import { getBillingHref, billingUrlOrgFromRow } from '../../lib/billing-urls.ts';
import { isClubPlan } from '../../lib/module-entitlements.ts';
import { PLAN_CONFIG } from '../../lib/plan-config.ts';
import { WORKSPACE_ONLY_GRANTS } from '../../lib/coach-capabilities.ts';
import { TOURNAMENT_BUNDLE } from '../../lib/coach-tournament-grant.ts';
import { PORTAL_FREE_TIME_GRANT_TYPE } from '../../lib/portal-free-time.ts';
import { flipWorkspaceIntoClub } from '../../lib/workspace-flip.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const MIGRATIONS = 'supabase/migrations';
const FUNCTION_NAME = 'flip_workspace_into_club';

// ── The RPC's text ──────────────────────────────────────────────────────────────────────────────────

function newestDefinition(): { file: string; sql: string } {
  const files = readdirSync(path.join(REPO, MIGRATIONS)).filter(f => f.endsWith('.sql')).sort();
  let found: { file: string; sql: string } | null = null;
  for (const f of files) {
    const raw = readFileSync(path.join(REPO, MIGRATIONS, f), 'utf8').replace(/\r\n/g, '\n');
    const sql = raw.split('\n').map(l => l.replace(/--.*$/, '')).join('\n');
    if (new RegExp(`create (or replace )?function public\\.${FUNCTION_NAME}\\(`, 'i').test(sql)) found = { file: f, sql };
  }
  assert.ok(found, `no migration defines ${FUNCTION_NAME}`);
  return found;
}
const RPC = newestDefinition();
const SQL = RPC.sql;

/** The statement `update public.<table> ... ;` that starts at the first match, as text. */
function updateOf(table: string, nth = 0): string {
  const re = new RegExp(`update public\\.${table}\\b[\\s\\S]*?;`, 'gi');
  const all = SQL.match(re) ?? [];
  assert.ok(all[nth], `the flip no longer updates ${table}`);
  return all[nth];
}

/** `set a = x, b = y` → { a: 'x', b: 'y' } (a plain `col = literal-or-param` list, as written). */
function assignments(statement: string): Record<string, string> {
  const set = statement.match(/\bset\b([\s\S]*?)\bwhere\b/i)?.[1] ?? '';
  const out: Record<string, string> = {};
  // Split on commas that are not inside parentheses.
  let depth = 0; let cur = ''; const parts: string[] = [];
  for (const ch of set) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  for (const p of parts) {
    const m = p.match(/^\s*([a-z_]+)\s*=\s*([\s\S]+?)\s*$/i);
    if (m) out[m[1]] = m[2].replace(/\s+/g, ' ');
  }
  return out;
}

const constArray = (name: string): string[] => {
  const m = SQL.match(new RegExp(`${name}\\s+constant\\s+text\\[\\]\\s*:=\\s*array\\[([\\s\\S]*?)\\]`, 'i'));
  assert.ok(m, `${name} is gone from the RPC`);
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
};

describe('1 · the RPC (mig 414)', () => {
  it('is one security-definer function, service role only, in one transaction', () => {
    assert.match(RPC.file, /^\d{3}_/);
    assert.match(SQL, /security definer/i);
    assert.match(SQL, /revoke all on function public\.flip_workspace_into_club\([^)]*\) from public, anon, authenticated/i);
    assert.match(SQL, /grant execute on function public\.flip_workspace_into_club\([^)]*\) to service_role/i);
    assert.match(SQL, /^\s*begin;/im);
    assert.match(SQL, /^\s*commit;/im);
    assert.doesNotMatch(SQL, /delete from public\.team_workspaces/i, 'the workspace row is tombstoned, never deleted');
  });

  it('agrees with the TypeScript it was written beside', () => {
    const plans = Object.keys(PLAN_CONFIG).filter(isClubPlan).sort();
    assert.deepEqual(constArray('c_club_plans').sort(), plans, 'the club plans');
    assert.deepEqual(constArray('c_workspace_grants').sort(), [...WORKSPACE_ONLY_GRANTS].sort(), 'WORKSPACE_ONLY_GRANTS');
    assert.deepEqual(constArray('c_tournament_bundle'), [...TOURNAMENT_BUNDLE], 'TOURNAMENT_BUNDLE');
    assert.match(SQL, new RegExp(`c_free_time_grant_type constant text := '${PORTAL_FREE_TIME_GRANT_TYPE}'`));
  });

  it('refuses by name, and every name is one the app wrapper turns into an answer (and the reverse)', () => {
    const inSql = [...new Set([...SQL.matchAll(/raise exception '(workspace_flip_[a-z_]+)'/g)].map(m => m[1]))].sort();
    const wrapper = readCode('lib/workspace-flip.ts');
    const inApp = [...new Set([...wrapper.matchAll(/\b(workspace_flip_[a-z_]+)\b/g)].map(m => m[1]))].sort();
    assert.deepEqual(inApp, inSql);
    assert.deepEqual(inSql, [
      'workspace_flip_holds_other_teams', 'workspace_flip_not_a_club_plan', 'workspace_flip_not_a_workspace',
      'workspace_flip_not_settled', 'workspace_flip_org_not_found', 'workspace_flip_plan_mismatch', 'workspace_flip_workspace_closed',
    ]);
  });

  it('is gated on a settled Club subscription BEFORE its first write, and is idempotent before any gate', () => {
    const firstWrite = SQL.search(/\bupdate public\./i);
    const settled = SQL.indexOf("subscription_status not in ('active', 'trialing')");
    assert.ok(settled > 0 && settled < firstWrite, 'the settled-subscription gate precedes every write');
    assert.match(SQL, /stripe_subscription_id is null/i);
    const already = SQL.indexOf("'alreadyFlipped', true");
    assert.ok(already > 0 && already < settled, 'an already-flipped org returns before the gates and writes nothing');
    assert.match(SQL, /from public\.team_workspaces where workspace_org_id = p_org_id for update/i);
    assert.match(SQL, /from public\.organizations where id = p_org_id for update/i);
    assert.equal((SQL.match(/insert into public\.org_audit_log/gi) ?? []).length, 1, 'one org_audit_log row');
    assert.match(SQL, /v_teams > 1/, 'a workspace holding more than one team is refused, so a surprise is visible');
  });

  it('turns the organization into a club, and leaves alone what must stay', () => {
    const set = assignments(updateOf('organizations'));
    assert.equal(set.account_kind, "'organization'");
    assert.equal(set.team_workspace_status, 'null');
    assert.equal(set.plan_id, 'p_plan');
    assert.match(set.tournament_limit, /p_tournament_limit/);
    assert.match(set.name, /v_name/);
    assert.equal(set.billing_suspended_at, 'null');
    assert.equal(set.billing_suspension_reason, 'null');
    for (const kept of ['slug', 'team_limit', 'free_floor', 'is_discoverable', 'is_public', 'stripe_customer_id', 'stripe_subscription_id', 'subscription_status', 'subscription_period', 'current_period_end']) {
      assert.ok(!(kept in set), `the flip must not write organizations.${kept}`);
    }
  });

  it('tombstones the workspace row with its Stripe ids NULL — the line that keeps a Club cancellation out of the portal', () => {
    const set = assignments(updateOf('team_workspaces'));
    assert.equal(set.workspace_state, "'org_owned'");
    assert.equal(set.billing_mode, "'club_included'");
    assert.equal(set.stripe_customer_id, 'null');
    assert.equal(set.stripe_subscription_id, 'null');
    assert.equal(set.billing_owner_org_id, 'v_org.id', 'billed to the club itself (the lead book counts it as paying through this)');
    for (const kept of ['rep_team_id', 'primary_owner_user_id', 'workspace_org_id', 'free_time_given_at']) {
      assert.ok(!(kept in set), `the tombstone keeps team_workspaces.${kept}`);
    }
  });

  it('ends the entitlement, the staff-given free time, and the open links; strips the workspace-only grants everywhere', () => {
    const ent = assignments(updateOf('team_entitlements'));
    assert.equal(ent.status, "'cancelled'");
    assert.match(updateOf('team_entitlements'), /status in \('active', 'trialing', 'past_due'\)/, 'a positive filter: the codebase spells the ended status both ways');
    assert.match(SQL, /revoked_at = v_now/);
    assert.match(SQL, /\(expires_at is null or expires_at > v_now\)/, 'a free-time grant with no end date is still running');
    assert.match(SQL, /'revoke_override'/);
    assert.equal(assignments(updateOf('team_org_links')).status, "'revoked'");
    for (const table of ['rep_team_staff_memberships', 'rep_team_coaches']) {
      assert.match(updateOf(table), /'tournaments', false, 'registerTournaments', false/, table);
    }
    assert.match(updateOf('assistant_invite_tokens'), /'tournaments', false, 'registerTournaments', false/);
    assert.match(updateOf('assistant_invite_tokens'), /status in \('pending', 'pending_approval'\)/);
    const members = updateOf('organization_members');
    assert.match(members, /role = 'coach'/, 'only the coach-role map the projection wrote; an owner or admin is never touched');
    assert.match(members, /capabilities - c_tournament_bundle/);
  });
});

// ── A workspace fixture, flipped ────────────────────────────────────────────────────────────────────

type OrgRow = {
  id: string; slug: string; name: string; account_kind: string; team_workspace_status: string | null; plan_id: string;
  tournament_limit: number; team_limit: number | null; free_floor: string | null; is_discoverable: boolean; is_public: boolean;
  subscription_status: string; stripe_subscription_id: string | null; billing_suspended_at: string | null;
};
type WorkspaceRow = {
  id: string; workspace_org_id: string; workspace_state: string; billing_mode: string; stripe_customer_id: string | null;
  stripe_subscription_id: string | null; billing_owner_org_id: string | null; rep_team_id: string; primary_owner_user_id: string;
};

function workspaceOrg(over: Partial<OrgRow> = {}): OrgRow {
  return {
    id: 'org-1', slug: 'hawks', name: 'Hawks Coaches Portal', account_kind: 'team_workspace', team_workspace_status: 'active', plan_id: 'team',
    tournament_limit: 1, team_limit: null, free_floor: null, is_discoverable: false, is_public: true,
    subscription_status: 'active', stripe_subscription_id: 'sub_old', billing_suspended_at: null, ...over,
  };
}
const workspaceRow = (over: Partial<WorkspaceRow> = {}): WorkspaceRow => ({
  id: 'ws-1', workspace_org_id: 'org-1', workspace_state: 'independent', billing_mode: 'team_direct', stripe_customer_id: 'cus_1',
  stripe_subscription_id: 'sub_old', billing_owner_org_id: null, rep_team_id: 'team-1', primary_owner_user_id: 'user-1', ...over,
});

/** Applies the RPC's two UPDATEs to a fixture by reading the assignments out of the SQL itself. */
function applyFlip(org: OrgRow, ws: WorkspaceRow, plan: string, clubName: string | null): { org: OrgRow; ws: WorkspaceRow } {
  const literal = (v: string): unknown => {
    if (v === 'null') return null;
    if (v === 'true') return true;
    if (v === 'false') return false;
    const q = v.match(/^'(.*)'$/); if (q) return q[1];
    if (v === 'p_plan') return plan;
    if (v === 'v_now') return 'now';
    if (v === 'v_org.id') return org.id;
    if (/p_tournament_limit/.test(v)) return PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG].tournamentLimit;
    if (/v_name/.test(v)) return clubName?.trim() || org.name;
    throw new Error(`unhandled assignment value: ${v}`);
  };
  const apply = <T extends object>(row: T, stmt: string): T => {
    const next = { ...row } as Record<string, unknown>;
    for (const [col, v] of Object.entries(assignments(stmt))) next[col] = literal(v);
    return next as unknown as T;
  };
  return { org: apply(org, updateOf('organizations')), ws: apply(ws, updateOf('team_workspaces')) };
}

const FIXTURES: Array<[string, OrgRow, WorkspaceRow, string]> = [
  ['a paying coach (Premium swapped to Club on one subscription)', workspaceOrg({ plan_id: 'club', subscription_status: 'active', stripe_subscription_id: 'sub_1' }), workspaceRow({ stripe_subscription_id: 'sub_1' }), 'club'],
  ['a free-time coach who started the Club trial (stored canceled until the Club subscription wrote its status)', workspaceOrg({ plan_id: 'club', subscription_status: 'trialing', stripe_subscription_id: 'sub_2' }), workspaceRow({ billing_mode: 'platform_override', stripe_subscription_id: null, stripe_customer_id: null }), 'club'],
  ['a coach on the larger band', workspaceOrg({ plan_id: 'club_large', subscription_status: 'active', stripe_subscription_id: 'sub_3' }), workspaceRow({ stripe_subscription_id: 'sub_3' }), 'club_large'],
];

/** The portal tests that can be loaded here, asked of one org-shaped row. */
function portalVerdicts(o: OrgRow): Record<string, boolean> {
  const block = freeTimeBlockOf({ name: o.name, planId: o.plan_id as never, accountKind: o.account_kind }, { switchOn: true, staffIsMember: false, isDemo: false });
  return {
    isTeamWorkspaceOrg: isTeamWorkspaceOrg({ accountKind: o.account_kind, planId: o.plan_id }),
    isTeamWorkspaceRelation: isTeamWorkspaceRelation({ account_kind: o.account_kind, plan_id: o.plan_id }),
    freeTimeBlockOf_portal: block?.kind === 'portal',
  };
}

describe('2 · a flipped workspace is a club everywhere a portal test is asked', () => {
  for (const [label, org, ws, plan] of FIXTURES) {
    it(label, () => {
      const before = portalVerdicts(org);
      assert.ok(Object.values(before).every(Boolean), `the fixture is a portal before the flip: ${JSON.stringify(before)}`);
      assert.equal(getBillingHref(billingUrlOrgFromRow(org)), '/hawks/coaches/billing');

      const after = applyFlip(org, ws, plan, '  Hawks Hockey Club ');
      assert.deepEqual(Object.values(portalVerdicts(after.org)), [false, false, false], JSON.stringify(portalVerdicts(after.org)));

      // The billing link is the club's.
      assert.equal(getBillingHref(billingUrlOrgFromRow(after.org)), '/hawks/admin/org/billing');
      // The name the coach typed (trimmed); the address does not move.
      assert.equal(after.org.name, 'Hawks Hockey Club');
      assert.equal(after.org.slug, 'hawks');
      // Not written: the limits, the floor, the discoverable switch.
      assert.equal(after.org.team_limit, null);
      assert.equal(after.org.free_floor, null);
      assert.equal(after.org.is_discoverable, false, 'stays hidden until the coach opts in (owner, 2026-10-30)');
      assert.equal(after.org.tournament_limit, PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG].tournamentLimit);
      assert.equal(after.org.team_workspace_status, null);
      // The workspace row is a tombstone that names no subscription and no customer; the team and owner stay.
      assert.equal(after.ws.workspace_state, 'org_owned');
      assert.equal(after.ws.billing_mode, 'club_included');
      assert.equal(after.ws.stripe_subscription_id, null);
      assert.equal(after.ws.stripe_customer_id, null);
      assert.equal(after.ws.rep_team_id, 'team-1');
      assert.equal(after.ws.primary_owner_user_id, 'user-1');
      assert.equal(after.ws.billing_owner_org_id, after.org.id);
    });
  }

  it('an empty club name keeps today\'s', () => {
    const [, org, ws, plan] = FIXTURES[0];
    assert.equal(applyFlip(org, ws, plan, '   ').org.name, org.name);
    assert.equal(applyFlip(org, ws, plan, null).org.name, org.name);
  });

  it('the directory clauses, the retention window and the cancellation preflight read the live tag, so they turn Club', () => {
    // Read from source (those modules are server-only and cannot load here), evaluated against the flipped fixture.
    const directory = readCode('lib/directory.ts');
    assert.match(directory, /\.neq\('account_kind', 'team_workspace'\)\s*\.neq\('plan_id', 'team'\)/);
    const [, org, ws, plan] = FIXTURES[0];
    const flipped = applyFlip(org, ws, plan, null).org;
    assert.ok(flipped.account_kind !== 'team_workspace' && flipped.plan_id !== 'team', 'the two directory clauses pass');
    const retention = readCode('lib/billing-retention.ts');
    assert.match(retention, /return isTeamWorkspaceOrg\(org\) \? COACHES_PORTAL_RETENTION_DAYS : BILLING_RETENTION_DAYS;/);
    assert.match(retention, /const teamWorkspace = isTeamWorkspaceOrg\(org\);/);
  });

  it('a Club cancellation and a late old-price event find no workspace: the portal branch cannot match the tombstone', () => {
    const [, org, ws, plan] = FIXTURES[0];
    const after = applyFlip(org, ws, plan, null);
    // The portal branch looks a workspace up by subscription id, and (since this build) excludes a tombstone. Evaluate the
    // filters the source actually carries against the flipped row.
    const sync = readCode('lib/team-checkout.ts');
    const lookup = sync.slice(sync.indexOf('export async function syncTeamWorkspaceSubscription'));
    const body = lookup.slice(0, lookup.indexOf('.maybeSingle()'));
    assert.match(body, /\.eq\('stripe_subscription_id', params\.stripeSubscriptionId\)/);
    assert.match(body, /\.neq\('workspace_state', 'org_owned'\)/);
    const stillMatches = (subId: string) => after.ws.stripe_subscription_id === subId && after.ws.workspace_state !== 'org_owned';
    assert.equal(stillMatches('sub_1'), false, 'the Club subscription (the same id as the old Premium one for a paying coach)');
    assert.equal(stillMatches('sub_old'), false, 'a replayed event for the old Premium subscription');
    // Even a stray id written back onto the tombstone does not revive the branch.
    const stray = { ...after.ws, stripe_subscription_id: 'sub_1' };
    assert.equal(stray.stripe_subscription_id === 'sub_1' && stray.workspace_state !== 'org_owned', false);
    // The webhook enters the portal's retention and email ONLY when that sync matched; otherwise the Club path runs.
    const webhook = readCode('app/api/billing/webhook/route.ts');
    const deleted = webhook.slice(webhook.indexOf("case 'customer.subscription.deleted'"));
    assert.ok(deleted.indexOf('syncTeamWorkspaceSubscription') < deleted.indexOf('if (syncedTeamWorkspace)'));
    assert.ok(deleted.indexOf('if (syncedTeamWorkspace)') < deleted.indexOf('applyCoachesPortalStripeRetention'));
    // The next-season choice writer cannot put an id back on a tombstone either.
    const setup = readCode('lib/billing-setup.ts');
    assert.match(setup, /\.eq\('id', params\.teamWorkspaceId\)\s*\.neq\('workspace_state', 'org_owned'\)/);
  });

  it('the six hand-copied portal tests are now the one function, and agree for every fixture', () => {
    for (const f of ['lib/api-auth.ts', 'lib/db.ts', 'lib/free-time.ts', 'lib/org-membership-policy.ts', 'lib/team-org-links.ts', 'lib/founding-season-desk.ts']) {
      const code = readCode(f);
      assert.match(code, /isTeamWorkspaceOrg\b/, `${f} asks the one function`);
      assert.match(code, /from '(\.|@\/lib)\/team-workspace-kind'/, `${f} imports the pure module`);
      assert.doesNotMatch(code, /(account_kind|accountKind)\)?\s*(as [A-Za-z]+\)?\s*)?===\s*'team_workspace'\s*\|\|/, `${f} still carries the hand-copied OR`);
    }
    const kinds = [undefined, null, 'organization', 'team_workspace'];
    const plans = [undefined, null, 'tournament', 'team', 'club', 'club_large'];
    for (const k of kinds) for (const p of plans) {
      const want = isTeamWorkspaceOrg({ accountKind: k, planId: p });
      assert.equal(isTeamWorkspaceRelation({ account_kind: k, plan_id: p }), want, `relation ${k}/${p}`);
      assert.equal(isTeamWorkspaceRelation([{ account_kind: k, plan_id: p }]), want, `relation (array) ${k}/${p}`);
      const block = freeTimeBlockOf({ name: 'x', planId: (p ?? 'tournament') as never, accountKind: k ?? null }, { switchOn: true, staffIsMember: false, isDemo: false });
      const wantBlock = isTeamWorkspaceOrg({ accountKind: k ?? null, planId: p ?? 'tournament' });
      assert.equal(block?.kind === 'portal', wantBlock, `freeTimeBlockOf ${k}/${p}`);
    }
  });
});

// ── The hook ────────────────────────────────────────────────────────────────────────────────────────

describe('3 · every entry that can put a workspace on Club meets the one hook', () => {
  it('the hook lives inside applyPlanChangeSideEffects and runs on every call', () => {
    const move = readCode('lib/plan-move.ts');
    const fn = move.slice(move.indexOf('export async function applyPlanChangeSideEffects'), move.indexOf('export type MoveResult'));
    assert.match(fn, /await flipWorkspaceIntoClub\(\{ orgId: p\.orgId, plan: p\.toPlan, actor: p\.actor, clubName: p\.clubName \}\)/);
    assert.match(fn, /return \{ clearedTeamLimit, revokedComps, workspaceFlip \}/);
    assert.doesNotMatch(fn.slice(0, fn.indexOf('flipWorkspaceIntoClub')), /fromPlan === 'team'/, 'a retried event arrives with the plan already written: never gate on the old plan');
  });

  it('the move apply, the webhook, the operator route and the mock checkout all call it', () => {
    assert.match(readCode('lib/plan-move.ts'), /await applyPlanChangeSideEffects\(\{ orgId: org\.id, fromPlan: ownPlanOf\(org\), toPlan, actor: opts\.actor, clubName \}\)/);
    assert.match(readCode('app/api/billing/webhook/route.ts'), /await applyPlanChangeSideEffects\(\{/);
    assert.match(readCode('lib/operator-plan-change.ts'), /sideEffects = await applyPlanChangeSideEffects\(\{/);
    const checkout = readCode('app/api/billing/create-checkout/route.ts');
    const mock = checkout.slice(checkout.indexOf('if (shouldApplyDirectly)'));
    assert.ok(mock.indexOf('.update({\n        plan_id: planKey') < mock.indexOf('applyPlanChangeSideEffects'), 'after the mock plan write');
    assert.match(mock, /await applyPlanChangeSideEffects\(\{ orgId: auth\.org\.id,/);
  });

  it('is safe when there is nothing to do: a non-Club plan answers without touching the database', async () => {
    for (const plan of ['tournament', 'tournament_plus', 'league', 'team']) {
      assert.deepEqual(await flipWorkspaceIntoClub({ orgId: 'o', plan, actor: 'test' }), { status: 'skipped', reason: 'not_a_club_plan' });
    }
  });

  it('an ordinary club (no workspace row) never reaches the RPC', () => {
    const w = readCode('lib/workspace-flip.ts');
    assert.ok(w.indexOf(".from('team_workspaces')") < w.indexOf(".rpc('flip_workspace_into_club'"));
    assert.match(w, /if \(!workspace\) return \{ status: 'skipped', reason: 'not_a_workspace' \}/);
    assert.doesNotMatch(w, /stripe\./i, 'no Stripe call lives in the flip');
  });
});

// ── The census ──────────────────────────────────────────────────────────────────────────────────────

// `harmless-read` matches the tombstone but uses only what stays true after the flip (the team, the owner, the shadow) and
// behaves no differently for a club. `known-gap` matches it AND misbehaves; each is a reported finding awaiting the owner, and
// the last test in this block fails the day one is fixed, so the entry is removed rather than left to excuse the next reader.
type Klass = 'live-row' | 'portal-only' | 'tombstone-aware' | 'harmless-read' | 'definition' | 'dev' | 'known-gap';

const LIVE = 'reads the organization row fresh on each request (or a row the caller just read); both halves of the portal test turn false at the flip, so it behaves as a club afterwards';

/** Files that need their own sentence. Everything else that reads the tag is `live-row`, below. */
const SPECIAL: Record<string, [Klass, string]> = {
  'lib/team-workspace-kind.ts': ['definition', 'the one definition of the portal test'],
  'lib/team-workspace-entitlements.ts': ['live-row', 'the entitlement mapper; re-exports the one definition'],
  'lib/team-workspace-provisioning.ts': ['portal-only', 'CREATES a workspace organization (account_kind team_workspace, status active); a club is never created here'],
  'lib/team-checkout.ts': ['tombstone-aware', 'portal checkout and syncTeamWorkspaceSubscription, which excludes a tombstone (this build); the reactivation guard rejects a flipped org'],
  'lib/team-org-billing.ts': ['portal-only', 'the org_team_addon billing mode (a club adding a team); keyed on the workspace, never on a club that was one'],
  'lib/portal-keep-premium.ts': ['portal-only', 'free-team Keep Premium: matches the workspace by its Stripe id, which is NULL on a tombstone, so it finds nothing'],
  'app/coaches/checkout/complete/page.tsx': ['portal-only', 'the Team checkout return page: finds the workspace by the subscription it just bought'],
  'app/api/coaches/[orgSlug]/team-links/route.ts': ['portal-only', 'refuses a non-portal; a flipped club is refused, as intended'],
  'lib/host-own-team.ts': ['portal-only', 'returns null for a non-portal; a flipped club has no coach-portal team to host'],
  'lib/team-ownership-transfer.ts': ['portal-only', 'the coach bridge (joining SOMEONE ELSE\'S club); a tombstone (org_owned) is dropped from its lookups'],
  'lib/team-org-links.ts': ['portal-only', 'the team-link lookups; a tombstone (org_owned) is dropped; its portal test is the one function'],
  'lib/billing-setup.ts': ['tombstone-aware', 'recordNextSeasonChoice never writes Stripe ids onto a tombstone (this build)'],
  'lib/lead-book.ts': ['tombstone-aware', 'counts a workspace as paying through billing_owner_org_id, which the flip sets to the club itself'],
  'lib/console-money-store.ts': ['tombstone-aware', 'matches workspaces by Stripe customer id, which the flip NULLs'],
  'app/api/platform-admin/find/route.ts': ['tombstone-aware', 'finds a workspace by Stripe id, which the flip NULLs; the club is found through its own organization'],
  'lib/platform-story.ts': ['live-row', 'reads free_time_given_at and the migration summary for the Story: history, not behaviour'],
  'lib/operator-plan-change.ts': ['tombstone-aware', 'refuses a plan change only while billing_mode is platform_override; a tombstone is club_included'],
  'lib/workspace-upgrade.ts': ['live-row', 'Stage 4b Part 2: decides whether a Club checkout is a Coaches Portal becoming the club (the portal test is the one function; a club buying a band is not asked for a name); Part 3: clubUpgradeStateOf reads the tag on BOTH sides of the flip and calls it "became" only with the tombstone too'],
  'lib/workspace-upgrade-status.ts': ['live-row', 'Stage 4b Part 2: the "has it become the club yet" read; it reads the organization and its workspace row fresh, on both sides of the flip'],
  'app/api/dev/seed/status/route.ts': ['dev', 'seed tooling'],
  'app/api/dev/seed/users/route.ts': ['dev', 'seed tooling'],
  'lib/free-time-writes.ts': ['live-row', 'portal free-time writes guarded by billing_mode platform_override, which the tombstone is not'],

  // ── Part 4 (2026-10-31): readers of the workspace ROW by something other than its Stripe id ──────────────────────────────
  // The census used to count a `team_workspaces` file only when it also named `stripe_subscription_id`. The flip keeps the row
  // (a tombstone whose workspace_org_id IS the club), so a lookup by org, team or owner finds it; these were invisible until now.
  'lib/workspace-flip.ts': ['definition', 'the flip\'s own wrapper: finds the workspace row first, so an ordinary club never reaches the RPC (block 3 pins it)'],
  'app/api/billing/choose-next-season/route.ts': ['portal-only', 'refuses 403 before its workspace read for any plan the Founding comp does not apply to, and every Club plan is one (D6)'],
  'app/api/coaches/[orgSlug]/teams/[teamId]/seasons/route.ts': ['portal-only', 'its season rollover is behind orgManagesOwnSeasons (lib/season-doors.ts), which asks the one portal test; a club runs seasons from admin'],
  'lib/rep-season-rollover.ts': ['portal-only', 'writes active_program_year_id on the workspace id its portal-gated caller passes; the club admin route passes none'],
  'app/api/dev/seed/team-workspace/route.ts': ['dev', 'seed tooling'],
  'app/platform-admin/customer-users/people-rows.ts': ['tombstone-aware', 'counts a portal only through portalsInForce, which needs a running team_entitlements row; the flip cancels them'],
  'lib/coach-team-page.ts': ['tombstone-aware', 'getActivePremiumPortal and the upgrade filter go through portalsInForce / workspacesInForce (cancelled entitlements)'],
  'lib/portal-in-force-server.ts': ['tombstone-aware', 'the in-force read itself: a workspace is in force only with an active, trialing or past_due entitlement'],
  'lib/team-workspace-owned.ts': ['tombstone-aware', 'finds the owner\'s workspaces, then keeps only those in force, so a flipped club owner does not "already own a portal"'],
  'lib/registrable-teams-server.ts': ['tombstone-aware', 'portalsInForce, and its standalone test excludes workspace_state org_owned'],
  'lib/portal-free-time-reminders.ts': ['tombstone-aware', 'selects and claims only billing_mode platform_override, so no free-time reminder reaches a flipped club (free_time_given_at survives)'],
  'lib/portal-free-time-server.ts': ['tombstone-aware', 'every read requires billing_mode platform_override and an unrevoked grant; the flip revokes the grant'],
  'lib/portal-free-time-give.ts': ['tombstone-aware', 'reads org_owned as "moved into a club", which blocks a further portal give ("give the club free time instead")'],
  'lib/founding-season.ts': ['tombstone-aware', 'the reactivation read needs billing_mode platform_override; a comp on the org is revoked by applyPlanChangeSideEffects before the flip runs'],
  'lib/portal-free-time-tab.ts': ['harmless-read', 'the staff console lists the tombstone as "in a club, and the club pays for it", which is true; its record read runs only for account_kind team_workspace'],
  'lib/basic-coach-teams.ts': ['harmless-read', 'resolveBasicCoachTeamIdForWorkspace takes a workspace its caller already holds and returns at once when the free-team shadow exists (a flipped portal keeps it); the history merge\'s own by-team lookup is getTeamWorkspaceForRepTeam, not these reads'],
  'lib/chat-resolvers.ts': ['harmless-read', 'uses the workspace id and rep team only to reach the team\'s staff and claimed tournaments'],
  'lib/coach-registration-access.ts': ['harmless-read', 'maps a registration to its rep team and shadow; access is the coaching assignment, not the portal'],
  'lib/coach-upgrade-migration.ts': ['harmless-read', 'writes migration_summary on the workspace id its caller passes; the read is in retryCoachUpgradeMigration, whose only caller is the retry route below, which skips workspace_state org_owned'],
  'lib/staff-own-club.ts': ['harmless-read', 'billing_owner_org_id is the club itself after the flip, so it only confirms "this is your own club" (it narrows, never widens)'],
  // Found as gaps by this census and fixed in Part 4 (owner yes 2026-10-31): the flip keeps migration_summary on the tombstone, so
  // without the filter an unacknowledged "Welcome to Premium" banner, and its retry, carried on into the club's team page.
  'app/api/coaches/[orgSlug]/teams/[teamId]/upgrade-summary/route.ts': ['tombstone-aware', 'the banner\'s read skips workspace_state org_owned, so a club never shows the portal\'s "Welcome to Premium" record'],
  'app/api/coaches/[orgSlug]/teams/[teamId]/upgrade-summary/retry/route.ts': ['tombstone-aware', 'the banner\'s retry skips workspace_state org_owned, so nothing re-copies from the free team into a club'],
};

/** Every other production file that reads the tag: the list the scan found on 2026-10-30, each opened or read by the census helper. */
const LIVE_ROW_FILES: string[] = [
  'app/api/admin/email/send/route.ts',
  'app/api/admin/org/free-time/route.ts',
  'app/api/admin/org/team-links/route.ts',
  'app/api/admin/teams/our-teams/route.ts',
  'app/api/billing/cancel/confirm/route.ts',
  'app/api/billing/create-checkout/route.ts',
  'app/api/billing/portal/route.ts',
  'app/api/billing/webhook/route.ts',
  'app/api/coaches/[orgSlug]/assignments/route.ts',
  'app/api/coaches/[orgSlug]/teams/[teamId]/hosted-tournaments/route.ts',
  'app/api/coaches/[orgSlug]/teams/[teamId]/money-summary/route.ts',
  'app/api/coaches/[orgSlug]/teams/[teamId]/pdf-settings/route.ts',
  'app/api/coaches/[orgSlug]/teams/[teamId]/register/route.ts',
  'app/api/coaches/[orgSlug]/teams/[teamId]/route.ts',
  'app/api/coaches/[orgSlug]/teams/[teamId]/staff/invite/route.ts',
  'app/api/coaches/[orgSlug]/teams/[teamId]/staff/invites/[inviteId]/route.ts',
  'app/api/coaches/[orgSlug]/teams/[teamId]/staff/[coachId]/route.ts',
  'app/api/coaches/[orgSlug]/teams/[teamId]/tournament-games/route.ts',
  'app/api/coaches/[orgSlug]/teams/[teamId]/tournament-history/route.ts',
  'app/api/platform-admin/bulk-operations/route.ts',
  'app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts',
  'app/coaches/tournaments/[teamId]/page.tsx',
  'app/coaches/welcome/page.tsx',
  'app/platform-admin/dev-tools/page.tsx',
  'app/platform-admin/orgs/page.tsx',
  'app/platform-admin/orgs/[id]/page.tsx',
  'app/[orgSlug]/admin/accounting/layout.tsx',
  'app/[orgSlug]/admin/AdminTitleManager.tsx',
  'app/[orgSlug]/admin/families/layout.tsx',
  'app/[orgSlug]/admin/org/billing/page.tsx',
  'app/[orgSlug]/admin/org/layout.tsx',
  'app/[orgSlug]/admin/org/page.tsx',
  'app/[orgSlug]/admin/org/settings/pdf/page.tsx',
  'app/[orgSlug]/admin/rep-teams/layout.tsx',
  'app/[orgSlug]/admin/tournaments/dashboard/page.tsx',
  'app/[orgSlug]/admin/tournaments/registrations/page.tsx',
  'app/[orgSlug]/coaches/layout.tsx',
  'app/[orgSlug]/coaches/link-org/page.tsx',
  'app/[orgSlug]/coaches/page.tsx',
  'app/[orgSlug]/coaches/teams/[teamId]/layout.tsx',
  'app/[orgSlug]/coaches/teams/[teamId]/page.tsx',
  'app/[orgSlug]/coaches/teams/[teamId]/tournaments/page.tsx',
  'lib/admin-kit-nav.ts',
  'lib/api-auth.ts',
  'lib/billing-retention.ts',
  'lib/billing-urls.ts',
  'lib/club-payees.ts',
  'lib/coach-billing-access.ts',
  'lib/coach-calendar-feed.ts',
  'lib/coach-membership.ts',
  'lib/coach-portal-plan.ts',
  'lib/coach-portal-request.ts',
  'lib/coach-team-read.ts',
  'lib/db.ts',
  'lib/directory.ts',
  'lib/email-sender.ts',
  'lib/family-access.ts',
  'lib/founding-season-desk.ts',
  'lib/free-time.ts',
  'lib/invite-acceptance.ts',
  'lib/org-membership-policy.ts',
  'lib/platform-people-lookup.ts',
  'lib/platform-stripe-fees.ts',
  'lib/public-club-access.ts',
  'lib/public-team-schedule.ts',
  'lib/season-doors.ts',
  'lib/server-organizations.ts',
  'lib/team-payee-scope.ts',
  'lib/team-payees.ts',
  'lib/team-plan-coverage.ts',
  'lib/tournament-guidance.ts',
  'lib/types.ts',
  'lib/user-contexts.ts',
  'components/admin/kit/club/AuditLogKit.tsx',
  'components/admin/kit/club/BillingKit.tsx',
  'components/admin/kit/club/MembersKit.tsx',
  'components/admin/kit/useAdminKitNav.ts',
  'components/coaches/CoachesBottomNav.tsx',
  'components/coaches/CoachesSidebar.tsx',
  'components/coaches/CoachStaffSheet.tsx',
  'components/help/HelpDrawer.tsx',
];

const ALLOWED: Record<string, [Klass, string]> = { ...Object.fromEntries(LIVE_ROW_FILES.map(f => [f, ['live-row', LIVE] as [Klass, string]])), ...SPECIAL };

const TAG = /\b(account_kind|accountKind|isTeamWorkspaceOrg|isTeamWorkspaceOrgRow|isTeamWorkspaceRelation|team_workspace_status|teamWorkspaceStatus)\b/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(path.join(REPO, dir))) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const rel = `${dir}/${name}`;
    if (statSync(path.join(REPO, rel)).isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}

describe('4 · the census: every reader of the portal tag is accounted for', () => {
  const sources = [...walk('app'), ...walk('lib'), ...walk('components'), 'proxy.ts'];

  it('finds the source at all (guards against a vacuous pass)', () => {
    assert.ok(sources.length > 500, `only ${sources.length} source files found`);
  });

  it('no file reads the portal tag, or the workspace row, unless it is on the list with a reason', () => {
    // ANY read of the workspace table counts, not only one that names its Stripe id (Part 4): the tombstone is still found by
    // its organization, its team and its owner. Plan-only tests (`plan_id === 'team'`) are deliberately NOT counted: both the
    // webhook and the flip write the Club plan, so they turn false at the flip, and the plan is compared in hundreds of places.
    const readers = sources.filter(f => {
      const code = readCode(f);
      return TAG.test(code) || /\bteam_workspaces\b/.test(code);
    });
    const unlisted = readers.filter(f => !(f in ALLOWED));
    assert.deepEqual(unlisted, [], `A file now reads the Coaches Portal tag or the workspace row. Decide how a club that was a portal
behaves there (the flip resets organizations.account_kind and keeps the workspace row as a tombstone: org_owned, club_included,
Stripe ids NULL, entitlements cancelled), then add it to LIVE_ROW_FILES or SPECIAL with the reason:\n  ${unlisted.join('\n  ')}`);
    const stale = Object.keys(ALLOWED).filter(f => !readers.includes(f));
    assert.deepEqual(stale, [], `These entries no longer read the tag; remove them:\n  ${stale.join('\n  ')}`);
  });

  it('no NEW hand-copied portal test appears (the known ones are listed, each equivalent to the one function today)', () => {
    // account_kind-only tests (not the OR) are live-row reads and listed above. The OR is the drift risk: it is copied by hand.
    const KNOWN_COPIES = new Set([
      'app/[orgSlug]/coaches/link-org/page.tsx', 'app/[orgSlug]/coaches/page.tsx', 'app/[orgSlug]/coaches/teams/[teamId]/page.tsx',
      'lib/team-workspace-kind.ts',
    ]);
    const copies = sources.filter(f => /(account_kind|accountKind)\)?\s*(as [A-Za-z]+\)?\s*)?===\s*'team_workspace'\s*\|\|/.test(readCode(f)));
    const fresh = copies.filter(f => !KNOWN_COPIES.has(f));
    assert.deepEqual(fresh, [], `A new hand-copied "account kind OR plan team" test. Use isTeamWorkspaceOrg (lib/team-workspace-kind.ts):\n  ${fresh.join('\n  ')}`);
  });

  it('no known gap is waiting, and the two this census found stay fixed', () => {
    const gaps = Object.entries(ALLOWED).filter(([, [k]]) => k === 'known-gap').map(([f]) => f);
    assert.deepEqual(gaps, [], 'a new known gap needs the owner, not an allowlist line');
    // The flip leaves migration_summary on the tombstone, so these two reads are what keeps the portal's banner off a club.
    for (const f of ['app/api/coaches/[orgSlug]/teams/[teamId]/upgrade-summary/route.ts', 'app/api/coaches/[orgSlug]/teams/[teamId]/upgrade-summary/retry/route.ts']) {
      assert.match(readCode(f), /\.eq\('rep_team_id', teamId\)\s*\.neq\('workspace_state', 'org_owned'\)/, f);
    }
  });

  it('the only documented leftovers of the old identity test are cosmetic wording in the staff console', () => {
    // plan_id === 'team' used as "this was a portal when the comp was given": history text that can read wrong once the portal
    // became a club. Reported in the Part 1 hand-off; not behaviour.
    assert.match(readCode('lib/free-time-story.ts'), /org\.plan_id === 'team' \? 'Given at checkout'/);
    assert.match(readSource('app/platform-admin/orgs/[id]/ClubRecord.tsx'), /org\.planId === 'team' \? 'checkout' : 'sign-up'/);
  });
});
