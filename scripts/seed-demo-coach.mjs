/**
 * Seed the Coach Sandbox — Riverdale Ridge Baseball, five teams frozen at five moments of a
 * season (`COACH_SANDBOX_SEASON_PHASES_PLAN.md`).
 *
 * Everything fictional comes from `lib/demo-coach.ts` (the world) anchored by the clock; this
 * script only materializes rows. Design mirrors `seed-demo-tournament.mjs`:
 *
 *   · **Idempotent, stable ids.** The org, the coach user, the five teams (FIXED ids from
 *     `lib/demo-org.ts`) and each team's program year are reused across runs; every child row
 *     (events, roster, tryouts, dues, budgets, lineups, …) is wiped and rebuilt from the world
 *     module. Re-running IS the re-anchor.
 *   · **Season's End through the real lifecycle.** The 13U year is held `active` while its
 *     season is written, then moved `active → completed` — the exact transition the product's
 *     own season-close performs. No state is written that the app cannot reach.
 *   · **Unreachable people only.** Every guardian/coach address is `@example.com`; the coach
 *     account gets a random discarded password (the sandbox door mints sessions server-side).
 *   · **Org-role blast radius.** The demo coach is an org member with role `coach`, not owner —
 *     the shared demo session cannot see any admin surface even before the write block.
 *
 * ⚠ Refuses to run against the production project unless `--allow-prod` is passed. Creating the
 * production demo org is an explicit release step with the owner, never a side effect.
 *
 * Run: node --env-file=.env.local scripts/seed-demo-coach.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { getDemoOrgByKind, DEMO_COACH_SHOWCASE } from '../lib/demo-org.ts';
import { moneySectionHref } from '../lib/coach-money-links.ts';
import {
  DEMO_COACH_ORG_NAME, DEMO_COACH_DISPLAY_NAME, DEMO_COACH_TEAMS, DEMO_HOME_DIAMOND,
  DEMO_DUES_SETTINGS,
  MIDSEASON_ROSTER, SEASONS_END_ROSTER, TRYOUT_RETURNING, TRYOUT_CANDIDATES,
  DEMO_TRYOUT_RUBRIC, DEMO_EVALUATORS, SPLIT_OPINION, tryoutScoreFor, TRYOUT_DESCRIPTION,
  MIDSEASON_LINEUP_GRID, MIDSEASON_INNING_COUNT, MIDSEASON_LINEUP_SETTINGS,
  midseasonPitcherProfile, MIDSEASON_DUES, MIDSEASON_FUNDRAISER, MIDSEASON_BUDGET_LINES, MIDSEASON_SEASON_ESTIMATE,
  MIDSEASON_UNSIGNED_WAIVER_INDEX, MIDSEASON_DEVELOPMENT_GOALS, MIDSEASON_PRACTICE_PLANS,
  MIDSEASON_SHOWCASE_ROSTER_INDEX,
  SEASONS_END_LINEUPS, SEASONS_END_BATTING_ORDERS, SEASONS_END_AWARD_TYPES, SEASONS_END_AWARDS,
  SEASONS_END_FAMILY, SEASONS_END_DUES, SEASONS_END_BUDGET_LINES,
  OFFSEASON_ROSTER, OFFSEASON_BUDGET_LINES, OFFSEASON_FUNDING_LINES, OFFSEASON_DUES,
  OFFSEASON_DEVELOPMENT_GOALS, OFFSEASON_MEASURABLE_TYPES, OFFSEASON_TESTING_ABSENT,
  OFFSEASON_PRACTICE_PLANS, offseasonMeasurableValue, demoPaidStampIso,
  SEASON_START_ROSTER, SEASON_START_BUDGET_LINES, SEASON_START_DUES,
  SEASON_START_LINEUP_GRID, SEASON_START_LINEUP_SETTINGS, SEASON_START_BATTING_ORDER,
  resolveTryoutDayState, resolveMidSeasonState, resolveSeasonsEndState,
  resolveOffSeasonState, resolveSeasonStartState,
  demoGuardianEmail, orgDateWithOffset,
} from '../lib/demo-coach.ts';

const PROD_PROJECT_REF = 'qcttcboqysynwcdyghil';
const allowProd = process.argv.includes('--allow-prod');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (supabaseUrl.includes(PROD_PROJECT_REF) && !allowProd) {
  console.error('❌ Refusing to run: this is the PRODUCTION Supabase project.');
  console.error('   Creating the production coach demo org is a release step to be done with the owner.');
  process.exit(1);
}

const db = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const demoOrg = getDemoOrgByKind('coach');
if (!demoOrg) { console.error('❌ No coach demo org registered in lib/demo-org.ts'); process.exit(1); }

const now = new Date();
const nowIso = now.toISOString();

function die(label, error) {
  if (error) { console.error(`❌ ${label}:`, error.message); process.exit(1); }
}

/** Chunked insert — attendance alone is ~500 rows. */
async function insertAll(table, rows) {
  for (let i = 0; i < rows.length; i += 400) {
    die(`insert ${table}`, (await db.from(table).insert(rows.slice(i, i + 400))).error);
  }
}

// ── 1. the one demo coach ────────────────────────────────────────────────────────────────────
async function findUserByEmail(email) {
  for (let page = 1; page <= 40; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    die('listUsers', error);
    const hit = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

let coach = await findUserByEmail(demoOrg.organizerEmail);
if (!coach) {
  const { data, error } = await db.auth.admin.createUser({
    email: demoOrg.organizerEmail,
    // Random and discarded — the sandbox door mints sessions server-side; nothing signs in with
    // a password, so a known one would be a liability with no compensating use.
    password: randomBytes(24).toString('hex'),
    email_confirm: true,
    user_metadata: { full_name: DEMO_COACH_DISPLAY_NAME, is_demo_account: true },
  });
  die('createUser', error);
  coach = data.user;
  console.log(`created demo coach ${demoOrg.organizerEmail}`);
} else {
  console.log(`demo coach exists ${demoOrg.organizerEmail}`);
}

// ── 2. the demo organization ─────────────────────────────────────────────────────────────────
// plan `club` carries the rep-teams module, so a head coach sees the whole premium portal
// (`lib/plan-config.ts` moduleEntitlements). Not public, never discoverable.
const orgFields = {
  name: DEMO_COACH_ORG_NAME,
  plan_id: 'club',
  subscription_status: 'active',
  is_public: false,
  is_discoverable: false,
  theme_preset: 'platform',
};

let org = (await db.from('organizations').select('id').eq('slug', demoOrg.slug).maybeSingle()).data;
if (!org) {
  const row = { id: randomUUID(), slug: demoOrg.slug, ...orgFields };
  die('insert org', (await db.from('organizations').insert(row)).error);
  org = row;
  console.log(`created org ${demoOrg.slug}`);
} else {
  // An existing row is adopted and OVERWRITTEN — so first prove it is ours and not a real
  // tenant that somehow holds the slug (the slug is refused at signup, but a row that predates
  // that guard, or was created by hand, must never be silently hijacked into a demo). Ours has
  // no members beyond the demo coach; a real org always has its owner.
  const { data: foreign } = await db.from('organization_members')
    .select('user_id').eq('organization_id', org.id).neq('user_id', coach.id).limit(1);
  if (foreign?.length) {
    console.error(`❌ Refusing to adopt org "${demoOrg.slug}": it has members that are not the demo coach.`);
    console.error('   That is a real organization holding the demo slug — resolve by hand before seeding.');
    process.exit(1);
  }
  die('update org', (await db.from('organizations').update(orgFields).eq('id', org.id)).error);
  console.log(`org exists ${demoOrg.slug} (verified ours; fields reasserted)`);
}

// ── 3. membership — role `coach`, deliberately NOT owner ─────────────────────────────────────
const membership = (await db.from('organization_members')
  .select('id, role, status').eq('organization_id', org.id).eq('user_id', coach.id).maybeSingle()).data;
if (!membership) {
  die('insert membership', (await db.from('organization_members').insert({
    organization_id: org.id, user_id: coach.id,
    role: 'coach', status: 'active', display_name: DEMO_COACH_DISPLAY_NAME, accepted_at: nowIso,
  })).error);
  console.log('linked demo coach as org member (role coach)');
} else if (membership.role !== 'coach' || membership.status !== 'active') {
  die('repair membership', (await db.from('organization_members')
    .update({ role: 'coach', status: 'active' }).eq('id', membership.id)).error);
}

// ── 4. teams (fixed ids) + program years ─────────────────────────────────────────────────────
async function upsertTeam(def) {
  const fields = { org_id: org.id, name: def.name, slug: def.slug, division: def.division, sport: 'baseball', color: def.color, is_archived: false };
  const existing = (await db.from('rep_teams').select('id').eq('id', def.id).maybeSingle()).data;
  if (!existing) {
    die(`insert team ${def.slug}`, (await db.from('rep_teams').insert({ id: def.id, ...fields })).error);
    console.log(`created team ${def.name}`);
  } else {
    die(`update team ${def.slug}`, (await db.from('rep_teams').update(fields).eq('id', def.id)).error);
  }
}

/**
 * Ensure the team's ONE program year for `year` exists with the given fields, and remove any
 * other year (with all its data) left behind by an earlier seed cycle — the tryout team's year
 * label rolls over every January, and stale siblings would confuse the active-year resolver.
 */
async function ensureProgramYear(team, year, name, fields) {
  // The two team-wide dues settings ride EVERY demo year, so the Money group in Team settings
  // shows a stated choice on whichever moment a prospect lands in — and so no caller can forget
  // them. A caller may still override by passing its own value in `fields`.
  fields = { ...DEMO_DUES_SETTINGS, ...fields };
  const all = (await db.from('rep_program_years').select('id, year').eq('team_id', team.id)).data ?? [];
  let keeper = all.find(py => py.year === year) ?? null;
  for (const py of all) {
    if (keeper && py.id === keeper.id) continue;
    await wipeProgramYearChildren(team.id, py.id);
    die('delete stale program year', (await db.from('rep_program_years').delete().eq('id', py.id)).error);
    console.log(`  removed stale ${team.slug} program year ${py.year}`);
  }
  if (!keeper) {
    const row = { id: randomUUID(), team_id: team.id, org_id: org.id, name, year, ...fields };
    die('insert program year', (await db.from('rep_program_years').insert(row)).error);
    keeper = row;
  } else {
    die('update program year', (await db.from('rep_program_years').update({ name, ...fields }).eq('id', keeper.id)).error);
  }
  return keeper.id;
}

/** Head-coach assignment on a program year — season-scoped, which is what archive access rides on. */
async function ensureHeadCoach(team, programYearId) {
  const existing = (await db.from('rep_team_coaches')
    .select('id').eq('program_year_id', programYearId).eq('user_id', coach.id).maybeSingle()).data;
  if (!existing) {
    die('insert coach row', (await db.from('rep_team_coaches').insert({
      program_year_id: programYearId, team_id: team.id, org_id: org.id,
      user_id: coach.id, coach_role: 'head_coach', capabilities: null,
    })).error);
  }
}

/** Wipe every child row of a program year (and the team-scoped tables the year's data owns).
 *
 *  Deliberately broader than what the seed itself creates: "re-running IS the re-anchor" only
 *  holds if a reseed returns the team to a KNOWN state, so every rep_* child a QA pass or a
 *  service-role script could have written is cleared too. A table that does not exist in this
 *  environment yet (dev-only migrations) is skipped, not fatal — the seed must run anywhere. */
async function wipeProgramYearChildren(teamId, pyId) {
  const del = async (table, filter) => {
    const { error } = await filter(db.from(table).delete());
    if (error && /does not exist|42P01/i.test(error.message ?? '')) return; // not migrated here
    die(`wipe ${table}`, error);
  };

  // Tryouts (scores → sessions/links → rubric → workspace → registrations)
  await del('rep_tryout_scores', q => q.eq('program_year_id', pyId));
  await del('rep_tryout_evaluator_sessions', q => q.eq('program_year_id', pyId));
  await del('rep_tryout_sessions', q => q.eq('program_year_id', pyId));
  await del('rep_tryout_rubrics', q => q.eq('program_year_id', pyId));
  await del('rep_tryouts', q => q.eq('program_year_id', pyId));
  await del('rep_tryout_registrations', q => q.eq('program_year_id', pyId));

  // Family engagement (views → links; links are team-scoped)
  await del('family_recap_views', q => q.eq('program_year_id', pyId));
  await del('family_links', q => q.eq('rep_team_id', teamId));

  // Awards (reference events — go first), team-scoped
  await del('rep_player_awards', q => q.eq('team_id', teamId));
  await del('rep_team_award_types', q => q.eq('team_id', teamId));

  // Lineups (entries via lineup ids)
  const lineupIds = ((await db.from('rep_team_lineups').select('id').eq('program_year_id', pyId)).data ?? []).map(l => l.id);
  if (lineupIds.length) {
    await del('rep_team_lineup_entries', q => q.in('lineup_id', lineupIds));
    await del('rep_team_lineups', q => q.eq('program_year_id', pyId));
  }

  // Events + attendance
  await del('rep_team_event_attendance', q => q.eq('program_year_id', pyId));
  await del('rep_team_events', q => q.eq('program_year_id', pyId));

  // Money
  const scheduleIds = ((await db.from('rep_player_dues_schedules').select('id').eq('program_year_id', pyId)).data ?? []).map(s => s.id);
  if (scheduleIds.length) await del('rep_player_dues_installments', q => q.in('schedule_id', scheduleIds));
  // Payment FACTS (mig 232) — season-scoped like credits, so the installment delete above never
  // touches them; left behind they would re-cover the NEXT seed's installments at random.
  await del('rep_dues_payments', q => q.eq('program_year_id', pyId));
  // Payouts (mig 234) — same shape, same reason: a payout left behind would go on suppressing
  // the next seed's credits, quietly putting a demo family's bills back up.
  await del('rep_dues_payouts', q => q.eq('program_year_id', pyId));
  await del('rep_player_dues_schedules', q => q.eq('program_year_id', pyId));
  const lineIds = ((await db.from('rep_budget_lines').select('id').eq('program_year_id', pyId)).data ?? []).map(l => l.id);
  if (lineIds.length) await del('rep_budget_periods', q => q.in('budget_line_id', lineIds));
  await del('rep_budget_lines', q => q.eq('program_year_id', pyId));

  // Documents + development (team-scoped)
  await del('rep_player_documents', q => q.eq('team_id', teamId));
  await del('rep_document_templates', q => q.eq('team_id', teamId));
  await del('rep_player_development_goals', q => q.eq('team_id', teamId));

  // Everything else a coach (or a QA session) can write under a team — the seed creates none of
  // these, but a reseed must still return the team to the world module's state. Children before
  // parents where an FK could bite (measurables → types, opponent obs/aliases → opponents).
  await del('rep_player_measurables', q => q.eq('team_id', teamId));
  await del('rep_team_measurable_types', q => q.eq('team_id', teamId));
  await del('rep_team_evaluation_sessions', q => q.eq('team_id', teamId));
  await del('rep_player_tryout_baselines', q => q.eq('team_id', teamId));
  await del('rep_player_continuity_links', q => q.eq('team_id', teamId));
  await del('rep_team_expenses', q => q.eq('team_id', teamId));
  await del('rep_dues_credits', q => q.eq('program_year_id', pyId));
  await del('rep_season_surplus', q => q.eq('program_year_id', pyId));
  await del('rep_fundraisers', q => q.eq('team_id', teamId));
  await del('rep_allocation_splits', q => q.eq('team_id', teamId));
  await del('rep_allocation_installments', q => q.eq('team_id', teamId));
  await del('rep_team_payment_requests', q => q.eq('team_id', teamId));
  await del('rep_team_lineup_templates', q => q.eq('team_id', teamId));
  await del('rep_team_plan_templates', q => q.eq('team_id', teamId));
  await del('rep_team_drills', q => q.eq('team_id', teamId));
  await del('rep_team_announcements', q => q.eq('team_id', teamId));
  await del('rep_team_tags', q => q.eq('team_id', teamId));
  await del('rep_team_opponent_observations', q => q.eq('team_id', teamId));
  await del('rep_team_opponent_aliases', q => q.eq('team_id', teamId));
  await del('rep_team_opponents', q => q.eq('team_id', teamId));
  await del('assistant_invite_tokens', q => q.eq('team_id', teamId));

  // Roster last — everything above referenced it
  await del('rep_roster_players', q => q.eq('program_year_id', pyId));
}

/**
 * A team's per-player dues: one schedule each, then its instalments.
 *
 * All four teams that collect dues wanted the same twelve lines with a different rule for which
 * instalments are paid, so the rule is the only thing that varies — `isPaid(rosterIndex, n)`.
 * Written out per team, the shared shape (the schedule row, the 1-based numbering, the org/team
 * denormalization the DB requires and does not default) had four places to drift.
 *
 * `dueDates` and `paidDates` are parallel arrays: what the season's calendar says, and when the
 * money actually arrived (a few days early). A team that pays on the nose can pass the same array
 * twice.
 */
async function seedDues(team, pyId, playerIds, { totalAmount, installmentAmount, dueDates, paidDates, isPaid, partPaid }) {
  for (let i = 0; i < playerIds.length; i++) {
    // The part-paid family's target instalment must NOT be stamped — its dollars arrive as
    // partial payments below, and the whole point is the "$90 of $120" chip.
    const paidHere = (n) =>
      partPaid && i === partPaid.rosterIndex && n === partPaid.installmentIndex ? false : isPaid(i, n);
    const scheduleId = randomUUID();
    die(`insert dues schedule ${team.slug}`, (await db.from('rep_player_dues_schedules').insert({
      id: scheduleId, program_year_id: pyId, player_id: playerIds[i],
      team_id: team.id, org_id: org.id, total_amount: totalAmount,
    })).error);
    await insertAll('rep_player_dues_installments', dueDates.map((dueDate, n) => ({
      schedule_id: scheduleId, player_id: playerIds[i], installment_number: n + 1,
      amount: installmentAmount, due_date: dueDate,
      paid_at: paidHere(n) ? `${paidDates[n]}T17:00:00.000Z` : null,
      org_id: org.id, team_id: team.id, source: 'manual',
    })));
    // A paid stamp is only a coverage PROJECTION since mig 232 — the dollars live in
    // rep_dues_payments, and every dues reader (Paid column, Collections tile, month-grid
    // Actual, never-paid chase) reads THEM. One e-transfer per stamped installment, received
    // the day the world says it was paid, keeps the demo's story and its books identical.
    const paidRows = [...dueDates.keys()].filter(n => paidHere(n));
    if (paidRows.length) {
      await insertAll('rep_dues_payments', paidRows.map(n => ({
        program_year_id: pyId, player_id: playerIds[i],
        org_id: org.id, team_id: team.id,
        amount: installmentAmount, received_date: paidDates[n],
        method: 'etransfer', source: 'recorded',
        created_at: `${paidDates[n]}T17:00:00.000Z`,
      })));
    }
    // The part-paid family's small e-transfers — money that sums UNDER the target instalment,
    // so its row reads "$X of $Y" and stays that way through re-anchors (received_date rides
    // the nightly shift like every other payment).
    if (partPaid && i === partPaid.rosterIndex) {
      await insertAll('rep_dues_payments', partPaid.splits.map((amt, k) => ({
        program_year_id: pyId, player_id: playerIds[i],
        org_id: org.id, team_id: team.id,
        amount: amt, received_date: partPaid.splitDates[k],
        method: 'etransfer', source: 'recorded',
        created_at: `${partPaid.splitDates[k]}T17:00:00.000Z`,
      })));
    }
  }
}

/** Insert a roster from the world module; returns ids by roster index. */
/**
 * The "actual" half of budget-vs-actual, for any team that has spent anything.
 *
 * Shared by three moments since Phase 3 (the 14U's winter, the 12U's season, the 10U's first
 * bills). Kept in ONE place because the paid stamps here and the nightly re-anchor's restatement
 * of them must agree exactly — two spellings of the same instant would make a steady day rewrite
 * every row, and the job's whole contract is that it doesn't.
 */
async function insertDemoExpenses(team, pyId, expenses) {
  await insertAll('rep_team_expenses', expenses.map(e => ({
    program_year_id: pyId, team_id: team.id, org_id: org.id,
    expense_type: e.type, description: e.description, category: e.category,
    amount: e.amount, notes: e.notes ?? null,
    expense_paid_at: e.paidDate ? demoPaidStampIso(e.paidDate) : null,
    deposit_amount: e.deposit?.amount ?? null,
    deposit_due_date: e.deposit?.dueDate ?? null,
    deposit_paid_at: e.deposit?.paidDate ? demoPaidStampIso(e.deposit.paidDate) : null,
    balance_amount: e.balance?.amount ?? null,
    balance_due_date: e.balance?.dueDate ?? null,
    balance_paid_at: e.balance?.paidDate ? demoPaidStampIso(e.balance.paidDate) : null,
    payee_payer: 'Riverdale Ridge Baseball Club',
    created_by: coach.id,
  })));
}

/**
 * ⚠ ONE roster row in the whole demo world carries a FIXED id: the 12U's playing-time outlier.
 * The guided tour's "read what a parent gets" step addresses that player's page directly, so the
 * id has to survive a reseed exactly as the team ids do (`DEMO_COACH_SHOWCASE`). Everyone else is
 * generated, because nothing points at them.
 */
function rosterIdFor(team, index) {
  const isShowcase = team.id === DEMO_COACH_TEAMS.midSeason.id
    && index === MIDSEASON_SHOWCASE_ROSTER_INDEX;
  return isShowcase ? DEMO_COACH_SHOWCASE.midSeasonPlayerId : randomUUID();
}

async function insertRoster(team, pyId, roster) {
  const rows = roster.map((p, i) => ({
    id: rosterIdFor(team, i), program_year_id: pyId, team_id: team.id, org_id: org.id,
    player_first_name: p.first, player_last_name: p.last, player_number: p.number,
    primary_position: p.primary, secondary_position: p.secondary,
    bats: p.bats, throws: p.throws,
    guardian_first_name: guardianFirstFor(p),
    guardian_last_name: p.last,
    guardian_email: demoGuardianEmail(p.last),
    status: 'active', source: 'admin_manual', display_order: i,
    lineup_profile: midProfileFor(team, i),
  }));
  await insertAll('rep_roster_players', rows);
  return rows.map(r => r.id);
}
const GUARDIAN_FIRSTS = ['Sasha', 'Morgan', 'Priya', 'Daniel', 'Renee', 'Tomas', 'Ada', 'Noel', 'Farah', 'Gil', 'Vera', 'Omar', 'Lise'];
function guardianFirstFor(p) {
  return GUARDIAN_FIRSTS[(p.first.length * 3 + p.last.length) % GUARDIAN_FIRSTS.length];
}
function midProfileFor(team, i) {
  return team.id === DEMO_COACH_TEAMS.midSeason.id ? midseasonPitcherProfile(i) : null;
}

const budgetCategoryIds = await platformBudgetCategoryIds();

/**
 * The PLATFORM's own budget categories (the rows with no org — every tenant sees them), keyed by
 * name. Budget-vs-actual matches an expense to a line by CATEGORY NAME, so the demo's lines have
 * to hang off real categories or the moment lands on a page that files every dollar as unbudgeted.
 * Looked up rather than created: inventing a taxonomy for the demo would be a state no coach's
 * own club could reach.
 */
async function platformBudgetCategoryIds() {
  // ⚠ Scoped exactly as the coach's own picker scopes it
  // (`app/api/coaches/[orgSlug]/budget-items/route.ts`): org-only categories are admin tools, and
  // that route's write path REFUSES them. Filtering here means a demo line on an unreachable
  // category fails this script loudly instead of shipping a budget a coach could never have built.
  const { data, error } = await db.from('budget_categories')
    .select('id, name').is('org_id', null).in('scope', ['team', 'both']);
  die('load budget categories', error);
  const byName = new Map((data ?? []).map(c => [c.name.toLowerCase(), c.id]));
  const required = [...new Set([
    ...OFFSEASON_BUDGET_LINES.map(l => l.category),
    ...SEASON_START_BUDGET_LINES.map(l => l.category),
    ...MIDSEASON_BUDGET_LINES.map(l => l.category),
  ])];
  const missing = required.filter(name => !byName.has(name.toLowerCase()));
  if (missing.length) {
    console.error(`❌ Budget categories not available to a TEAM: ${missing.join(', ')}`);
    console.error('   The demo budgets name real, coach-reachable categories on purpose. A name that');
    console.error("   resolves only at org scope would seed a line the coach's own planner refuses.");
    process.exit(1);
  }
  return byName;
}

/** Turn a world practice plan into the product's own `practice_plan` jsonb, resolving the roster
 *  indexes the module carries (a plan is the one place a practice names people). */
function materializePracticePlan(plan, playerIds) {
  const ids = indexes => (indexes ?? []).map(i => playerIds[i]).filter(Boolean);
  return {
    version: 1,
    goal: plan.goal,
    practiceTypes: [...plan.practiceTypes],
    equipment: [...plan.equipment],
    blocks: plan.blocks.map(block => {
      const out = {
        id: block.id,
        title: block.title,
        duration: block.restOfPractice
          ? { minutes: null, restOfPractice: true }
          : { minutes: block.minutes },
      };
      if (block.description) out.description = block.description;
      if (block.goal) out.goal = block.goal;
      if (block.coachingPoints) out.coachingPoints = [...block.coachingPoints];
      if (block.staff) out.staff = [...block.staff];
      if (block.stations) {
        // People live at exactly ONE level (lib/types.ts): a rotating block carries its players in
        // the rotation's groups and nowhere else, so no surface can show two answers to "who's here".
        out.stations = block.stations.map(s => ({ ...s }));
        out.rotation = {
          intervalMinutes: block.rotation.intervalMinutes,
          groupSource: 'manual',
          groups: block.rotation.groups.map(g => ({ id: g.id, name: g.name, playerIds: ids(g.playerIndexes) })),
        };
      } else {
        out.playerIds = block.playerIndexes ? ids(block.playerIndexes) : [...playerIds];
      }
      return out;
    }),
  };
}

/** Materialize games + practices from a world state; returns event ids by game key.
 *  `plansByPracticeKey` attaches an already-materialized practice plan to named practices. */
async function insertSeasonEvents(team, pyId, state, plansByPracticeKey = new Map()) {
  const eventIdByKey = new Map();
  const rows = [];
  for (const g of state.games) {
    const id = randomUUID();
    eventIdByKey.set(g.key, id);
    rows.push({
      id, program_year_id: pyId, team_id: team.id, org_id: org.id,
      event_type: 'league_game', name: `${g.homeAway === 'home' ? 'vs' : 'at'} ${g.opponent}`,
      starts_at: g.startsAtIso, ends_at: g.endsAtIso,
      location: g.homeAway === 'home' ? DEMO_HOME_DIAMOND : `${g.opponent.split(' ')[0]} Park`,
      opponent: g.opponent, home_away: g.homeAway,
      result: g.result, team_score: g.teamScore, opponent_score: g.opponentScore,
      status: 'scheduled', arrival_time: g.time === '09:00' ? '08:15' : null,
    });
  }
  for (const p of state.practices) {
    const id = randomUUID();
    eventIdByKey.set(p.key, id);
    rows.push({
      id, program_year_id: pyId, team_id: team.id, org_id: org.id,
      event_type: 'practice', name: p.name ?? 'Team practice',
      starts_at: p.startsAtIso, ends_at: p.endsAtIso,
      location: DEMO_HOME_DIAMOND, status: 'scheduled',
      practice_plan: plansByPracticeKey.get(p.key) ?? null,
    });
  }
  await insertAll('rep_team_events', rows);
  return eventIdByKey;
}

/** Attendance for practices that happened (world-defined dips) and past games (near-full). */
async function insertAttendance(team, pyId, state, eventIdByKey, playerIds) {
  const rows = [];
  for (const p of state.practices) {
    if (!p.happened) continue; // a practice still ahead has no attendance yet
    playerIds.forEach((pid, i) => rows.push({
      event_id: eventIdByKey.get(p.key), player_id: pid,
      program_year_id: pyId, team_id: team.id, org_id: org.id,
      status: p.absent.includes(i) ? 'absent' : p.late.includes(i) ? 'late' : 'attending',
    }));
  }
  state.games.filter(g => g.result != null).forEach((g, gi) => {
    playerIds.forEach((pid, i) => rows.push({
      event_id: eventIdByKey.get(g.key), player_id: pid,
      program_year_id: pyId, team_id: team.id, org_id: org.id,
      status: gi % 4 === 2 && i === (gi * 5) % playerIds.length ? 'absent' : 'attending',
    }));
  });
  await insertAll('rep_team_event_attendance', rows);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 11U — TRYOUT DAY
// ─────────────────────────────────────────────────────────────────────────────────────────────
{
  const team = DEMO_COACH_TEAMS.tryoutDay;
  const state = resolveTryoutDayState(now);
  await upsertTeam(team);
  const pyId = await ensureProgramYear(team, state.year, state.yearName, {
    status: 'active', tryout_open: true, tryout_description: TRYOUT_DESCRIPTION,
  });
  await ensureHeadCoach(team, pyId);
  await wipeProgramYearChildren(team.id, pyId);
  await insertRoster(team, pyId, TRYOUT_RETURNING);

  const tryoutId = randomUUID();
  die('insert tryout', (await db.from('rep_tryouts').insert({
    id: tryoutId, program_year_id: pyId, team_id: team.id, org_id: org.id, is_anonymous: true,
  })).error);
  die('insert rubric', (await db.from('rep_tryout_rubrics').insert({
    tryout_id: tryoutId, program_year_id: pyId, team_id: team.id, org_id: org.id,
    name: DEMO_TRYOUT_RUBRIC.name, scale_max: DEMO_TRYOUT_RUBRIC.scaleMax,
    categories: DEMO_TRYOUT_RUBRIC.categories,
  })).error);
  await insertAll('rep_tryout_sessions', state.sessions.map(s => ({
    tryout_id: tryoutId, program_year_id: pyId, team_id: team.id, org_id: org.id,
    starts_at: s.startsAtIso, ends_at: s.endsAtIso,
    location: DEMO_HOME_DIAMOND, label: s.label, status: 'scheduled',
  })));

  const registrationRows = TRYOUT_CANDIDATES.map((c, i) => ({
    id: randomUUID(), program_year_id: pyId, team_id: team.id, org_id: org.id,
    player_first_name: c.first, player_last_name: c.last,
    guardian_first_name: c.guardianFirst, guardian_last_name: c.guardianLast,
    guardian_email: demoGuardianEmail(c.last),
    status: 'pending_review', submitted_at: state.submittedAtIso[i],
    consent_data_collection: true, consent_email_comms: true, consent_eligibility: true,
    consent_at: state.submittedAtIso[i],
    bib_number: String(c.bib),
    is_checked_in: c.checkedIn, checked_in_at: c.checkedIn ? state.checkedInAtIso : null,
  }));
  await insertAll('rep_tryout_registrations', registrationRows);
  const registrationIdByBib = new Map(TRYOUT_CANDIDATES.map((c, i) => [c.bib, registrationRows[i].id]));

  const evaluatorIds = [];
  for (const evaluator of DEMO_EVALUATORS) {
    const id = randomUUID();
    evaluatorIds.push(id);
    die('insert evaluator session', (await db.from('rep_tryout_evaluator_sessions').insert({
      id, tryout_id: tryoutId, program_year_id: pyId, team_id: team.id, org_id: org.id,
      evaluator_name: evaluator.name,
      // A real (random, discarded) token — the hash is valid but no one holds the raw link.
      token_hash: createHash('sha256').update(randomBytes(32).toString('base64url')).digest('hex'),
      expires_at: state.evaluatorExpiryIso,
    })).error);
  }

  const scoreRows = [];
  DEMO_EVALUATORS.forEach((evaluator, e) => {
    TRYOUT_CANDIDATES.slice(0, evaluator.scoredCount).forEach(candidate => {
      DEMO_TRYOUT_RUBRIC.categories.forEach((category, catIndex) => {
        const isSplit = candidate.bib === SPLIT_OPINION.bib && category.key === SPLIT_OPINION.category && e < 2;
        scoreRows.push({
          evaluator_session_id: evaluatorIds[e], registration_id: registrationIdByBib.get(candidate.bib),
          tryout_id: tryoutId, program_year_id: pyId, team_id: team.id, org_id: org.id,
          category_key: category.key,
          score: tryoutScoreFor(e, candidate.bib, catIndex),
          note: isSplit ? SPLIT_OPINION.notes[e] : null,
        });
      });
    });
  });
  await insertAll('rep_tryout_scores', scoreRows);
  console.log(`✓ 11U tryout day — ${TRYOUT_CANDIDATES.length} candidates, ${scoreRows.length} scores, sessions today`);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 14U — OFF-SEASON (the books are open, the season isn't)
// ─────────────────────────────────────────────────────────────────────────────────────────────
{
  const team = DEMO_COACH_TEAMS.offSeason;
  const state = resolveOffSeasonState(now);
  await upsertTeam(team);
  // NEXT season's year: an off-season team has rolled over and is building the year it hasn't
  // played yet — which is exactly why its Money screens are the moment's landing place.
  const pyId = await ensureProgramYear(team, state.year, state.yearName, {
    status: 'active', tryout_open: false,
    budget_amount: OFFSEASON_BUDGET_LINES.reduce((s, l) => s + l.total, 0),
  });
  await ensureHeadCoach(team, pyId);
  await wipeProgramYearChildren(team.id, pyId);
  const playerIds = await insertRoster(team, pyId, OFFSEASON_ROSTER);

  const plansByPracticeKey = new Map(OFFSEASON_PRACTICE_PLANS.map(plan =>
    [plan.practiceKey, materializePracticePlan(plan, playerIds)]));
  const eventIdByKey = await insertSeasonEvents(team, pyId, state, plansByPracticeKey);
  await insertAttendance(team, pyId, state, eventIdByKey, playerIds);

  // The budget plan: real platform categories, each line phased across four months so the report
  // this moment lands on has a month grid rather than one undated lump.
  // Ids are minted here, so lines and their phasing are two batched writes rather than twelve.
  const budgetLineRows = [
    ...OFFSEASON_BUDGET_LINES.map((line, i) => ({
      id: randomUUID(), org_id: org.id, team_id: team.id, program_year_id: pyId,
      category_id: budgetCategoryIds.get(line.category.toLowerCase()),
      description: line.description, total_amount: line.total, line_kind: 'cost', sort_order: i,
    })),
    // Money coming IN — stored positive, displayed negative, no category (see the constant).
    ...OFFSEASON_FUNDING_LINES.map((line, i) => ({
      id: randomUUID(), org_id: org.id, team_id: team.id, program_year_id: pyId,
      category_id: null,
      description: line.description, total_amount: line.total, line_kind: 'funding',
      sort_order: OFFSEASON_BUDGET_LINES.length + i,
    })),
  ];
  await insertAll('rep_budget_lines', budgetLineRows);
  // Periods must sum to their line within $0.02 (the planner enforces it); quarters divide every
  // one of these totals exactly, so the demo never sits on that tolerance.
  await insertAll('rep_budget_periods', budgetLineRows.flatMap(row =>
    state.budgetPeriodDates.map((date, n) => ({
      budget_line_id: row.id, period_label: date.slice(0, 7), period_date: date,
      amount: row.total_amount / state.budgetPeriodDates.length, sort_order: n,
    }))));

  // What has actually been spent — the "actual" half of the report, one row deliberately on a
  // category with no budget line so the unbudgeted section has something honest to say.
  await insertDemoExpenses(team, pyId, state.expenses);

  // Dues: two instalments settled, two ahead — and one family a payment behind.
  await seedDues(team, pyId, playerIds, {
    totalAmount: OFFSEASON_DUES.totalAmount,
    installmentAmount: OFFSEASON_DUES.installmentAmount,
    dueDates: state.duesDueDates, paidDates: state.duesPaidDates,
    isPaid: (i, n) => n <= 1 && !(n === 1 && i === OFFSEASON_DUES.overdueRosterIndex),
  });

  await insertAll('rep_player_development_goals', OFFSEASON_DEVELOPMENT_GOALS.map(goal => ({
    org_id: org.id, team_id: team.id, player_id: playerIds[goal.rosterIndex],
    focus_area: goal.focusArea, note: goal.note, status: goal.status, created_by: coach.id,
  })));

  // The winter's testing session: the coach's own test library, one session hung off the practice
  // it was run at, and readings for everyone who was there. The two who missed get no row at all —
  // an honest blank is the product's rule, never a fabricated zero.
  const typeIds = [];
  for (let i = 0; i < OFFSEASON_MEASURABLE_TYPES.length; i++) {
    const id = randomUUID();
    typeIds.push(id);
    die('insert measurable type', (await db.from('rep_team_measurable_types').insert({
      id, org_id: org.id, team_id: team.id,
      name: OFFSEASON_MEASURABLE_TYPES[i].name, unit: OFFSEASON_MEASURABLE_TYPES[i].unit,
      sort_order: i, is_active: true, created_by: coach.id,
    })).error);
  }
  const sessionId = randomUUID();
  die('insert evaluation session', (await db.from('rep_team_evaluation_sessions').insert({
    id: sessionId, org_id: org.id, team_id: team.id, program_year_id: pyId,
    session_date: state.testingSessionDate,
    event_id: eventIdByKey.get(state.testingSessionPracticeKey) ?? null,
    note: 'Post-holiday testing', created_by: coach.id,
  })).error);
  const readings = [];
  playerIds.forEach((pid, i) => {
    if (OFFSEASON_TESTING_ABSENT.includes(i)) return;
    OFFSEASON_MEASURABLE_TYPES.forEach((type, t) => readings.push({
      org_id: org.id, team_id: team.id, player_id: pid,
      measurable_type_id: typeIds[t], value: offseasonMeasurableValue(i, t),
      unit: type.unit, recorded_on: state.testingSessionDate,
      session_id: sessionId, created_by: coach.id,
    }));
  });
  await insertAll('rep_player_measurables', readings);

  console.log(`✓ 14U off-season — budget ${OFFSEASON_BUDGET_LINES.length} lines, ${state.expenses.length} expenses logged, dues 2 of 4 in (one overdue), ${state.practices.length} sessions, 2 plans, ${readings.length} test readings`);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 10U — SEASON START (two weeks in, the year laid out ahead)
// ─────────────────────────────────────────────────────────────────────────────────────────────
{
  const team = DEMO_COACH_TEAMS.seasonStart;
  const state = resolveSeasonStartState(now);
  await upsertTeam(team);
  const pyId = await ensureProgramYear(team, state.year, state.yearName, {
    status: 'active', tryout_open: false,
    lineup_settings: SEASON_START_LINEUP_SETTINGS,
    budget_amount: SEASON_START_BUDGET_LINES.reduce((s, l) => s + l.total, 0),
  });
  await ensureHeadCoach(team, pyId);
  await wipeProgramYearChildren(team.id, pyId);
  const playerIds = await insertRoster(team, pyId, SEASON_START_ROSTER);

  const eventIdByKey = await insertSeasonEvents(team, pyId, state);
  await insertAttendance(team, pyId, state, eventIdByKey, playerIds);

  // Exactly ONE saved lineup — the opener's. Everything after it is still the coach's to write,
  // which is what "two weeks in" has to feel like.
  const opener = state.games.find(g => g.key === state.lineupGameKey);
  const lineupId = randomUUID();
  die('insert 10U lineup', (await db.from('rep_team_lineups').insert({
    id: lineupId, event_id: eventIdByKey.get(opener.key),
    program_year_id: pyId, team_id: team.id, org_id: org.id,
    lineup_mode: 'everyone_bats', inning_count: SEASON_START_LINEUP_GRID.length,
  })).error);
  await insertAll('rep_team_lineup_entries', SEASON_START_BATTING_ORDER.map((rosterIndex, pos) => ({
    lineup_id: lineupId, player_id: playerIds[rosterIndex], batting_order: pos + 1, starter: true,
    inning_positions: Object.fromEntries(
      SEASON_START_LINEUP_GRID.map((inning, idx) => [String(idx + 1), inning[rosterIndex]])),
  })));

  await insertAll('rep_budget_lines', SEASON_START_BUDGET_LINES.map((line, i) => ({
    org_id: org.id, team_id: team.id, program_year_id: pyId,
    category_id: budgetCategoryIds.get(line.category.toLowerCase()),
    description: line.description, total_amount: line.total, sort_order: i,
  })));
  // The plan is complete; the spending has barely started. That contrast IS this moment's books.
  await insertDemoExpenses(team, pyId, state.expenses);

  // Dues mostly current: everyone but one family has paid the first instalment; the rest are ahead.
  await seedDues(team, pyId, playerIds, {
    totalAmount: SEASON_START_DUES.totalAmount,
    installmentAmount: SEASON_START_DUES.installmentAmount,
    dueDates: state.duesDueDates, paidDates: state.duesPaidDates,
    isPaid: (i, n) => n === 0 && i !== SEASON_START_DUES.unpaidFirstRosterIndex,
  });

  const played = state.games.filter(g => g.result != null).length;
  console.log(`✓ 10U season start — opening day ${state.openingDate}, ${played} played of ${state.games.length} games, ${state.practices.length} practices, 1 saved lineup, dues 1 of 4 in`);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 12U — MID-SEASON
// ─────────────────────────────────────────────────────────────────────────────────────────────
{
  const team = DEMO_COACH_TEAMS.midSeason;
  const state = resolveMidSeasonState(now);
  await upsertTeam(team);
  const pyId = await ensureProgramYear(team, state.year, state.yearName, {
    status: 'active', tryout_open: false,
    lineup_settings: MIDSEASON_LINEUP_SETTINGS,
    // ⚠ NOT the sum of the lines — see MIDSEASON_SEASON_ESTIMATE for why this one team differs.
    budget_amount: MIDSEASON_SEASON_ESTIMATE,
  });
  await ensureHeadCoach(team, pyId);
  await wipeProgramYearChildren(team.id, pyId);
  const playerIds = await insertRoster(team, pyId, MIDSEASON_ROSTER);

  const eventIdByKey = await insertSeasonEvents(team, pyId, state, new Map(
    MIDSEASON_PRACTICE_PLANS.map(plan => [plan.practiceKey, materializePracticePlan(plan, playerIds)])));
  await insertAttendance(team, pyId, state, eventIdByKey, playerIds);

  // Lineups for the newest six decided games — the playing-time and arm-care record.
  for (const g of state.games) {
    if (g.lineupOrder == null) continue;
    const lineupId = randomUUID();
    die('insert lineup', (await db.from('rep_team_lineups').insert({
      id: lineupId, event_id: eventIdByKey.get(g.key),
      program_year_id: pyId, team_id: team.id, org_id: org.id,
      lineup_mode: 'everyone_bats', inning_count: MIDSEASON_INNING_COUNT,
    })).error);
    await insertAll('rep_team_lineup_entries', playerIds.map((pid, i) => ({
      lineup_id: lineupId, player_id: pid, batting_order: i + 1, starter: true,
      inning_positions: Object.fromEntries(
        MIDSEASON_LINEUP_GRID.map((inning, idx) => [String(idx + 1), inning[i]])),
    })));
  }

  // Dues: $480 in four, everyone owes the final future instalment; two families sit overdue.
  const dueOffsets = [-70, -40, -10, 20];
  await seedDues(team, pyId, playerIds, {
    totalAmount: MIDSEASON_DUES.totalAmount,
    installmentAmount: MIDSEASON_DUES.installmentAmount,
    dueDates: dueOffsets.map(offset => orgDateWithOffset(now, offset)),
    paidDates: dueOffsets.map(offset => orgDateWithOffset(now, offset - 3)),
    // The final instalment is future for everyone; the overdue pair also missed #3.
    isPaid: (i, n) => dueOffsets[n] < 0
      && !(n === 3 || (n === 2 && MIDSEASON_DUES.overdueRosterIndexes.includes(i))),
    // The payment-record showcase (owner ruling 2026-08-13): one family's instalment #3 sits at
    // $90 of $120 across three small e-transfers — a third money story beside current + overdue.
    partPaid: {
      ...MIDSEASON_DUES.partPaid,
      splitDates: MIDSEASON_DUES.partPaid.splitOffsets.map(offset => orgDateWithOffset(now, offset)),
    },
  });

  // The Bottle Drive — CLOSED, so its rebates are real credits sitting on real bills. This is the
  // demo's one showing of fundraising lowering a family's dues, which is the most sympathetic
  // thing this product does and which the sandbox could not show at all before 2026-08-14.
  // ⚠ Written the authoritative direction (entry first, credit carrying fundraiser_entry_id, then
  // the entry's credit_id back-filled) so the leaderboard and the dues screen agree.
  {
    const fundraiserId = randomUUID();
    die('insert 12U fundraiser', (await db.from('rep_fundraisers').insert({
      id: fundraiserId, org_id: org.id, team_id: team.id, program_year_id: pyId,
      name: MIDSEASON_FUNDRAISER.name, description: MIDSEASON_FUNDRAISER.description,
      player_rebate_percent: MIDSEASON_FUNDRAISER.rebatePercent,
      start_date: orgDateWithOffset(now, MIDSEASON_FUNDRAISER.startOffset),
      end_date: orgDateWithOffset(now, MIDSEASON_FUNDRAISER.endOffset),
      is_active: false,
    })).error);
    for (const entry of MIDSEASON_FUNDRAISER.entries) {
      const rebate = Math.round(entry.raised * MIDSEASON_FUNDRAISER.rebatePercent) / 100;
      const entryId = randomUUID();
      die('insert 12U fundraiser entry', (await db.from('rep_fundraiser_entries').insert({
        id: entryId, fundraiser_id: fundraiserId, org_id: org.id, team_id: team.id,
        player_id: playerIds[entry.rosterIndex],
        amount_raised: entry.raised, rebate_percent: MIDSEASON_FUNDRAISER.rebatePercent,
        rebate_amount: rebate,
      })).error);
      const creditId = randomUUID();
      die('insert 12U fundraiser credit', (await db.from('rep_dues_credits').insert({
        id: creditId, program_year_id: pyId, player_id: playerIds[entry.rosterIndex],
        amount: rebate, description: `Fundraiser rebate — ${MIDSEASON_FUNDRAISER.name}`,
        credit_type: 'fundraiser',
        credit_date: orgDateWithOffset(now, MIDSEASON_FUNDRAISER.endOffset),
        fundraiser_entry_id: entryId,
      })).error);
      die('link 12U entry credit', (await db.from('rep_fundraiser_entries')
        .update({ credit_id: creditId }).eq('id', entryId)).error);
    }
  }

  // The plan, on real platform categories — without them budget-vs-actual has nothing to match a
  // logged expense to, and files the whole season as unbudgeted (the state this moment shipped in
  // until 2026-08-05). Undated on purpose: unlike the 14U, this team's story is the season it has
  // already spent, not the months it planned to spend it across.
  const budgetRows = MIDSEASON_BUDGET_LINES.map((line, i) => ({
    id: randomUUID(), org_id: org.id, team_id: team.id, program_year_id: pyId,
    category_id: budgetCategoryIds.get(line.category.toLowerCase()),
    description: line.description, total_amount: line.total, sort_order: i,
  }));
  await insertAll('rep_budget_lines', budgetRows);
  await insertDemoExpenses(team, pyId, state.expenses);

  // Waivers: a published template, signed by everyone except one — the beat the roster tells.
  const templateId = randomUUID();
  die('insert waiver template', (await db.from('rep_document_templates').insert({
    id: templateId, org_id: org.id, team_id: team.id,
    name: `Season Waiver & Consent ${state.year}`, document_type: 'waiver',
    storage_path: `${org.id}/teams/${team.id}/templates/demo-waiver.pdf`,
    file_name: 'season-waiver.pdf', file_size: 48213, is_active: true,
  })).error);
  await insertAll('rep_player_documents', playerIds
    .map((pid, i) => ({ pid, i }))
    .filter(({ i }) => i !== MIDSEASON_UNSIGNED_WAIVER_INDEX)
    .map(({ pid, i }) => ({
      player_id: pid, team_id: team.id, org_id: org.id, document_type: 'waiver',
      storage_path: `${org.id}/teams/${team.id}/players/${pid}/demo-signed-waiver.pdf`,
      file_name: `signed-waiver-${MIDSEASON_ROSTER[i].last.toLowerCase()}.pdf`,
      file_size: 51200, template_id: templateId,
    })));

  await insertAll('rep_player_development_goals', MIDSEASON_DEVELOPMENT_GOALS.map(goal => ({
    org_id: org.id, team_id: team.id, player_id: playerIds[goal.rosterIndex],
    focus_area: goal.focusArea, note: goal.note, status: 'working', created_by: coach.id,
  })));

  console.log(`✓ 12U mid-season — ${state.games.length - 1} decided games (14-3-1), game Saturday ${state.saturdayDate}, dues + budget + waivers in, ${MIDSEASON_PRACTICE_PLANS.length} past practices written up`);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 13U — SEASON'S END (closed through the real lifecycle: active → completed)
// ─────────────────────────────────────────────────────────────────────────────────────────────
{
  const team = DEMO_COACH_TEAMS.seasonsEnd;
  const state = resolveSeasonsEndState(now);
  await upsertTeam(team);
  // Held ACTIVE while the season is written — the same order of operations a real year lives.
  const pyId = await ensureProgramYear(team, state.year, state.yearName, {
    status: 'active', tryout_open: false,
    lineup_settings: MIDSEASON_LINEUP_SETTINGS,
    budget_amount: SEASONS_END_BUDGET_LINES.reduce((s, l) => s + l.total, 0),
  });
  await ensureHeadCoach(team, pyId);
  await wipeProgramYearChildren(team.id, pyId);
  const playerIds = await insertRoster(team, pyId, SEASONS_END_ROSTER);

  const eventIdByKey = await insertSeasonEvents(team, pyId, state);
  await insertAttendance(team, pyId, state, eventIdByKey, playerIds);

  // Saved lineups: order A three times (all wins, all scored) → Wrapped's lineup fact is TRUE.
  for (const saved of SEASONS_END_LINEUPS) {
    const g = state.games[saved.gameIndex];
    const order = SEASONS_END_BATTING_ORDERS[saved.order];
    const lineupId = randomUUID();
    die('insert 13U lineup', (await db.from('rep_team_lineups').insert({
      id: lineupId, event_id: eventIdByKey.get(g.key),
      program_year_id: pyId, team_id: team.id, org_id: org.id,
      lineup_mode: 'everyone_bats', inning_count: MIDSEASON_INNING_COUNT,
    })).error);
    await insertAll('rep_team_lineup_entries', order.map((rosterIndex, pos) => ({
      lineup_id: lineupId, player_id: playerIds[rosterIndex], batting_order: pos + 1, starter: true,
      inning_positions: Object.fromEntries(
        MIDSEASON_LINEUP_GRID.map((inning, idx) => [String(idx + 1), inning[rosterIndex]])),
    })));
  }

  // Money: fully paid year — the archive's Money door shows a finished, settled story.
  await seedDues(team, pyId, playerIds, {
    totalAmount: SEASONS_END_DUES.totalAmount,
    installmentAmount: SEASONS_END_DUES.installmentAmount,
    dueDates: [0, 1, 2, 3].map(n => `${state.year}-0${5 + n}-01`),
    paidDates: [0, 1, 2, 3].map(n => `${state.year}-0${5 + n}-03`),
    isPaid: () => true, // a closed season owes nothing
  });
  await insertAll('rep_budget_lines', SEASONS_END_BUDGET_LINES.map((line, i) => ({
    org_id: org.id, team_id: team.id, program_year_id: pyId,
    description: line.description, total_amount: line.total, sort_order: i,
  })));

  // Awards — Player of the Game through the year, Most Improved at the banquet.
  const awardTypeIds = [];
  for (let i = 0; i < SEASONS_END_AWARD_TYPES.length; i++) {
    const id = randomUUID();
    awardTypeIds.push(id);
    die('insert award type', (await db.from('rep_team_award_types').insert({
      id, org_id: org.id, team_id: team.id,
      name: SEASONS_END_AWARD_TYPES[i].name, emoji: SEASONS_END_AWARD_TYPES[i].emoji, sort_order: i,
    })).error);
  }
  await insertAll('rep_player_awards', SEASONS_END_AWARDS.map(a => ({
    org_id: org.id, team_id: team.id, player_id: playerIds[a.rosterIndex],
    award_type_id: awardTypeIds[a.typeIndex],
    event_id: a.gameIndex != null ? eventIdByKey.get(state.games[a.gameIndex].key) : null,
    awarded_at: a.gameIndex != null ? state.games[a.gameIndex].date : state.games.at(-1).date,
    note: a.note, created_by: coach.id,
  })));

  // Family engagement: 12 verified guardian links, 9 of whom opened the recap.
  const linkRows = playerIds.slice(0, SEASONS_END_FAMILY.verifiedLinks).map((pid, i) => ({
    id: randomUUID(), org_id: org.id, rep_team_id: team.id,
    role: 'guardian', status: 'verified', player_id: pid,
    invited_email: demoGuardianEmail(SEASONS_END_ROSTER[i].last),
    relationship: 'parent',
    // The stamps the real approval path writes alongside 'verified' — the row must look like
    // one the product produced, not merely pass the status filter.
    verified_via: 'coach_approved',
    approved_at: `${state.year}-05-10T14:00:00.000Z`,
  }));
  await insertAll('family_links', linkRows);
  await insertAll('family_recap_views', linkRows.slice(0, SEASONS_END_FAMILY.recapViews).map(link => ({
    org_id: org.id, rep_team_id: team.id, program_year_id: pyId, link_id: link.id,
  })));

  // The close — the REAL lifecycle transition the product performs, nothing hand-written.
  die('close 13U season', (await db.from('rep_program_years')
    .update({ status: 'completed' }).eq('id', pyId)).error);
  console.log(`✓ 13U season's end — 26 games (18-6-2), awards, family recap, year ${state.year} CLOSED (active → completed)`);
}

// ── report ───────────────────────────────────────────────────────────────────────────────────
console.log(`\n✅ Seeded the Coach Sandbox — ${DEMO_COACH_ORG_NAME}`);
console.log(`   Org: ${demoOrg.slug} · plan club · role coach · not public, not discoverable`);
console.log(`   Coach: ${demoOrg.organizerEmail} (${DEMO_COACH_DISPLAY_NAME})`);
console.log(`   Tryout day:  /${demoOrg.slug}/coaches/teams/${DEMO_COACH_TEAMS.tryoutDay.id}/tryouts/score`);
console.log(`   Off-season:  ${moneySectionHref(`/${demoOrg.slug}/coaches/teams/${DEMO_COACH_TEAMS.offSeason.id}`, 'budget-vs-actual')}`);
console.log(`   Season start: /${demoOrg.slug}/coaches/teams/${DEMO_COACH_TEAMS.seasonStart.id}/schedule`);
console.log(`   Mid-season:  ${demoOrg.landingPath}`);
console.log(`   Season's End: /${demoOrg.slug}/coaches/teams/${DEMO_COACH_TEAMS.seasonsEnd.id}/season-end`);
console.log(`\n   Re-running this script IS the re-anchor: dates follow today, rows are diff-stable.`);
