/**
 * Seed the Coach Sandbox — Riverdale Ridge Baseball, three teams frozen at three moments of a
 * season (`COACH_SANDBOX_SEASON_PHASES_PLAN.md`, Phase 1).
 *
 * Everything fictional comes from `lib/demo-coach.ts` (the world) anchored by the clock; this
 * script only materializes rows. Design mirrors `seed-demo-tournament.mjs`:
 *
 *   · **Idempotent, stable ids.** The org, the coach user, the three teams (FIXED ids from
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
import { getDemoOrgByKind } from '../lib/demo-org.ts';
import {
  DEMO_COACH_ORG_NAME, DEMO_COACH_DISPLAY_NAME, DEMO_COACH_TEAMS, DEMO_HOME_DIAMOND,
  MIDSEASON_ROSTER, SEASONS_END_ROSTER, TRYOUT_RETURNING, TRYOUT_CANDIDATES,
  DEMO_TRYOUT_RUBRIC, DEMO_EVALUATORS, SPLIT_OPINION, tryoutScoreFor, TRYOUT_DESCRIPTION,
  MIDSEASON_LINEUP_GRID, MIDSEASON_INNING_COUNT, MIDSEASON_LINEUP_SETTINGS,
  midseasonPitcherProfile, MIDSEASON_DUES, MIDSEASON_BUDGET_LINES,
  MIDSEASON_UNSIGNED_WAIVER_INDEX, MIDSEASON_DEVELOPMENT_GOALS,
  SEASONS_END_LINEUPS, SEASONS_END_BATTING_ORDERS, SEASONS_END_AWARD_TYPES, SEASONS_END_AWARDS,
  SEASONS_END_FAMILY, SEASONS_END_DUES, SEASONS_END_BUDGET_LINES,
  resolveTryoutDayState, resolveMidSeasonState, resolveSeasonsEndState,
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

/** Insert a roster from the world module; returns ids by roster index. */
async function insertRoster(team, pyId, roster) {
  const rows = roster.map((p, i) => ({
    id: randomUUID(), program_year_id: pyId, team_id: team.id, org_id: org.id,
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

/** Materialize games + practices from a world state; returns event ids by game key. */
async function insertSeasonEvents(team, pyId, state) {
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
      event_type: 'practice', name: 'Team practice',
      starts_at: p.startsAtIso, ends_at: p.endsAtIso,
      location: DEMO_HOME_DIAMOND, status: 'scheduled',
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
// 12U — MID-SEASON
// ─────────────────────────────────────────────────────────────────────────────────────────────
{
  const team = DEMO_COACH_TEAMS.midSeason;
  const state = resolveMidSeasonState(now);
  await upsertTeam(team);
  const pyId = await ensureProgramYear(team, state.year, state.yearName, {
    status: 'active', tryout_open: false,
    lineup_settings: MIDSEASON_LINEUP_SETTINGS,
    budget_amount: MIDSEASON_BUDGET_LINES.reduce((s, l) => s + l.total, 0),
  });
  await ensureHeadCoach(team, pyId);
  await wipeProgramYearChildren(team.id, pyId);
  const playerIds = await insertRoster(team, pyId, MIDSEASON_ROSTER);

  const eventIdByKey = await insertSeasonEvents(team, pyId, state);
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

  // Dues: $480 in four, everyone owes the final future installment; two families sit overdue.
  const dueOffsets = [-70, -40, -10, 20];
  for (let i = 0; i < playerIds.length; i++) {
    const scheduleId = randomUUID();
    die('insert dues schedule', (await db.from('rep_player_dues_schedules').insert({
      id: scheduleId, program_year_id: pyId, player_id: playerIds[i],
      team_id: team.id, org_id: org.id, total_amount: MIDSEASON_DUES.totalAmount,
    })).error);
    const overdue = MIDSEASON_DUES.overdueRosterIndexes.includes(i);
    await insertAll('rep_player_dues_installments', dueOffsets.map((offset, n) => {
      const dueDate = orgDateWithOffset(now, offset);
      const isPast = offset < 0;
      const unpaid = n === 3 || (overdue && n === 2); // final is future for all; overdue pair also missed #3
      return {
        schedule_id: scheduleId, player_id: playerIds[i], installment_number: n + 1,
        amount: MIDSEASON_DUES.installmentAmount, due_date: dueDate,
        paid_at: !unpaid && isPast ? `${orgDateWithOffset(now, offset - 3)}T17:00:00.000Z` : null,
        org_id: org.id, team_id: team.id, source: 'manual',
      };
    }));
  }

  const budgetRows = MIDSEASON_BUDGET_LINES.map((line, i) => ({
    id: randomUUID(), org_id: org.id, team_id: team.id, program_year_id: pyId,
    description: line.description, total_amount: line.total, sort_order: i,
  }));
  await insertAll('rep_budget_lines', budgetRows);

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

  console.log(`✓ 12U mid-season — ${state.games.length - 1} decided games (14-3-1), game Saturday ${state.saturdayDate}, dues + budget + waivers in`);
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
  const seasonStart = state.games[0].date;
  for (const pid of playerIds) {
    const scheduleId = randomUUID();
    die('insert 13U dues schedule', (await db.from('rep_player_dues_schedules').insert({
      id: scheduleId, program_year_id: pyId, player_id: pid,
      team_id: team.id, org_id: org.id, total_amount: SEASONS_END_DUES.totalAmount,
    })).error);
    await insertAll('rep_player_dues_installments', [0, 1, 2, 3].map(n => {
      const dueDate = `${state.year}-0${5 + n}-01`;
      return {
        schedule_id: scheduleId, player_id: pid, installment_number: n + 1,
        amount: SEASONS_END_DUES.installmentAmount, due_date: dueDate,
        paid_at: `${state.year}-0${5 + n}-03T17:00:00.000Z`,
        org_id: org.id, team_id: team.id, source: 'manual',
      };
    }));
  }
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
console.log(`   Mid-season:  ${demoOrg.landingPath}`);
console.log(`   Season's End: /${demoOrg.slug}/coaches/teams/${DEMO_COACH_TEAMS.seasonsEnd.id}/season-end`);
console.log(`\n   Re-running this script IS the re-anchor: dates follow today, rows are diff-stable.`);
