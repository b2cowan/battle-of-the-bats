/**
 * seed-qa-day-fixtures.mjs — build the DEV data states the Owner QA Ledger's first sitting needs.
 *
 * The ledger (docs/projects/active/OWNER_QA_LEDGER.md) is re-grouped so one sitting clears the
 * unshipped half of Tier 1. Three of those groups need data that cannot be conjured mid-sitting;
 * this script builds all three, idempotently, and prints the URLs to start from.
 *
 *   --cancel-lab   Group 1A / §1.19 — a THROWAWAY org on the Club plan, with a coach, a
 *                  scorekeeper, an owner, a rep team and three live tournaments. The whole
 *                  section is a before/after on an org you are happy to break; this is that org.
 *   --game-day     Group 1E / §1.15+§1.17+§1.18 — a game inside the live window on the standing
 *                  `toronto blue jays5` fixture, with a saved lineup whose bench histories are
 *                  deliberately UNEVEN (so "longest sitting first" is a real claim, not a
 *                  coincidence) and one pitcher sitting on two innings.
 *   --money       Group 1C / §1.2+§1.3+§2.3 — a throwaway money club with TWO teams: one
 *                  deliberately data-rich and in its second season (months view, phone), one
 *                  deliberately EMPTY (the budget starter's first-run card). Four sign-ins
 *                  covering head coach, money-read, money-off and money-without-contacts.
 *   --practice    QA §89 — six practice plans on QA Money U13, one per shape the printed RUN
 *                  SHEET has to survive: a typical night, a heavy night with two rotations, a
 *                  rotation the coach hasn't finished, twelve customer-named groups, a block
 *                  taller than a page, and a bare-minimum plan. Needs --money to have been run.
 *   --book         Group 1D / §1.12–§1.14 + §1.16 — opponent book lines and observations on
 *                  `toronto blue jays5`, a SECOND SPELLING of one opponent so the merge has
 *                  something to merge, lineups vs one opponent across wins and losses, and a
 *                  two-team club pair on `dev-club-org` for the Club Shared Book.
 *
 * No flag = all three.  Re-running is safe: every row is looked up by a stable name first.
 *
 * ⚠ DEV ONLY. Reads .env.local and refuses to run against the production project.
 *
 * ── What this script deliberately does NOT seed, so you know which empty screens are honest ──
 *   · §1.14's "Their tournament so far" needs a MIRRORED game — the opponent's other results
 *     inside a tournament running on this platform. That means a real platform tournament with a
 *     published division and the team registered in it; a fabricated one would prove nothing.
 *     Those checkboxes will correctly read "absent".
 *   · §1.18's pitching caps are left UNSET on purpose — "before this it showed nothing at all"
 *     is the check, so the fixture must start from nothing. You set the cap during the test.
 *   · §1.16's two sharing switches are left OFF on purpose — turning them on IS steps 1 and 2.
 *
 * Run: node --env-file=.env.local scripts/seed-qa-day-fixtures.mjs [--cancel-lab|--game-day|--money|--book|--practice]
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { insertCommitmentWithRecords, paidOnce } from './lib/seed-commitment-records.mjs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Run with --env-file=.env.local');
  process.exit(1);
}
if (url.includes('qcttcboqysynwcdyghil')) {
  console.error('✗ Refusing to run: that is the PRODUCTION project.');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const argv = process.argv.slice(2);
const only = new Set(argv.filter(a => a.startsWith('--')).map(a => a.slice(2)));
const wants = (name) => only.size === 0 || only.has(name);

const die = (label, error) => { if (error) { console.error(`✗ ${label}: ${error.message}`); process.exit(1); } };
const ok = (m) => console.log(`  ✓ ${m}`);
const note = (m) => console.log(`  · ${m}`);
const head = (m) => console.log(`\n── ${m} ${'─'.repeat(Math.max(0, 74 - m.length))}`);

const DAY = 86_400_000;
/**
 * The calendar day a PERSON is standing in — never the UTC one.
 *
 * ⚠ Found during QA setup 2026-08-07, after this script had already been used for a sitting.
 * `toISOString()` reports UTC, so from 8pm Toronto onwards it returns TOMORROW. The scorekeeper
 * board asks for the browser's local date, so an evening seed silently put the day's games one
 * day into the future — and the board correctly said "No games today" for a fixture whose entire
 * job is to put games there. The failure looked like a broken screen and was a broken fixture.
 *
 * Every date a screen will compare against its own idea of "today" goes through here.
 */
const isoDate = (d) => {
  const t = new Date(d);
  t.setMinutes(t.getMinutes() - t.getTimezoneOffset());
  return t.toISOString().slice(0, 10);
};
const nowIso = new Date().toISOString();

/* ⚖ `paidStamp` (org-noon instants for `expense_paid_at`) RETIRED with the legacy paid columns
   (Payables Rebuild P2): a payment's `paid_date` is a bare `date` column, so the timestamptz
   off-by-one it corrected has nothing left to apply to. */

/** Mirrors lib/coach-opponents.ts normalizeOpponentName — the book's key. Keep in step. */
function normalizeOpponentName(name) {
  if (!name) return '';
  let c = String(name).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
  while (c.startsWith('the ')) c = c.slice(4);
  return c;
}

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

async function ensureUser(email, password, fullName) {
  const existing = await findUserByEmail(email);
  if (existing) { note(`auth user exists ${email}`); return existing; }
  const { data, error } = await db.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: fullName },
  });
  die(`createUser ${email}`, error);
  ok(`auth user created ${email} / ${password}`);
  return data.user;
}

/**
 * @param capabilities per-member overrides, or undefined to leave the role's defaults alone.
 *   `hasCapability` (lib/roles.ts) reads an explicit `false` here before the role default — which
 *   is the ONLY way to make a single-duty volunteer. Every role that can score can also check
 *   teams in (`official` and `staff` both carry both caps; owner/admin carry everything), so a
 *   score-only or gate-only volunteer does not exist by role and must be built on purpose.
 */
async function ensureMember(orgId, userId, role, displayName, capabilities) {
  const patch = { role, status: 'active' };
  if (capabilities !== undefined) patch.capabilities = capabilities;
  const { data: row } = await db.from('organization_members')
    .select('id, role').eq('organization_id', orgId).eq('user_id', userId).maybeSingle();
  if (row) {
    // Reassert on every run: a QA sitting that toggles a capability must not silently change what
    // the next run is testing.
    die('member update', (await db.from('organization_members').update(patch).eq('id', row.id)).error);
    return;
  }
  die('member insert', (await db.from('organization_members').insert({
    organization_id: orgId, user_id: userId, role, status: 'active',
    display_name: displayName, accepted_at: nowIso,
    ...(capabilities !== undefined ? { capabilities } : {}),
  })).error);
  ok(`member ${displayName} → ${role}`);
}

// The schema's fixed position domain, not a sport choice.
const FIELD_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

/**
 * Build a valid inning-by-inning grid: exactly one player per position per inning, everyone else
 * on the bench.
 *
 * ⚠ WHY THIS IS A SHARED HELPER AND NOT THREE INLINE LOOPS. The first draft of this script wrote
 * the grid by hand in each fixture as `i === pitcherIdx ? 'P' : FIELD_POSITIONS[(i + inning) % 9]`,
 * which puts a SECOND player on the mound every inning — the modular rotation lands on 'P' for
 * somebody else too. A console board showing two pitchers is not a fixture, it is a bug the QA
 * session would spend its time on instead of the feature. This builder allocates positions from a
 * pool, so a double-booking is impossible by construction.
 *
 * @param playerCount   roster size
 * @param innings       how many innings the grid covers
 * @param benchByInning inning number → array of player indexes sitting that inning
 * @param pitcherFor    inning number → player index on the mound (must not be benched that inning)
 * @returns array of `{ "1": "P", ... }` objects, one per player, in roster order
 */
function buildInningGrid({ playerCount, innings, benchByInning = {}, pitcherFor = {} }) {
  const grid = Array.from({ length: playerCount }, () => ({}));
  for (let inning = 1; inning <= innings; inning++) {
    const bench = new Set(benchByInning[inning] ?? []);
    const onField = [...Array(playerCount).keys()].filter(i => !bench.has(i));
    if (onField.length > FIELD_POSITIONS.length) {
      throw new Error(`inning ${inning}: ${onField.length} on field but only ${FIELD_POSITIONS.length} positions — bench ${onField.length - FIELD_POSITIONS.length} more`);
    }
    const pool = [...FIELD_POSITIONS];
    const pitcher = pitcherFor[inning];
    if (pitcher != null) {
      if (bench.has(pitcher)) throw new Error(`inning ${inning}: player ${pitcher} is both pitching and benched`);
      grid[pitcher][String(inning)] = 'P';
      pool.splice(pool.indexOf('P'), 1);
    }
    for (const i of onField) {
      if (i === pitcher) continue;
      grid[i][String(inning)] = pool.shift();
    }
    for (const i of bench) grid[i][String(inning)] = 'Bench';
  }
  return grid;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// PART A — §1.19, the cancellation lab
// ═══════════════════════════════════════════════════════════════════════════════════════════
// A dedicated throwaway org, because the section's whole method is "do a thing, cancel, prove
// you can no longer do it, then put it back". Running that on a shared dev org would take the
// coach portal away from every other ledger section mid-sitting.
const LAB = {
  slug: 'qa-cancel-lab',
  name: 'QA Cancel Lab (throwaway)',
  owner: 'qa-lab-owner@dev.local',
  coach: 'qa-lab-coach@dev.local',
  scorer: 'qa-lab-scorer@dev.local',
  // The day-of bottom bars (2026-08-07) turn "which duties do you hold?" into visible chrome —
  // a volunteer sees a tab per duty, so the single-duty case is a DIFFERENT screen, not a subset.
  scorerOnly: 'qa-lab-scorer-only@dev.local',
  gateOnly: 'qa-lab-gate-only@dev.local',
  password: 'devpass123',
};

async function seedCancelLab() {
  head('Part A — §1.19 the cancellation lab');

  const owner = await ensureUser(LAB.owner, LAB.password, 'QA Lab Owner');
  const coach = await ensureUser(LAB.coach, LAB.password, 'QA Lab Coach');
  const scorer = await ensureUser(LAB.scorer, LAB.password, 'QA Lab Scorekeeper');
  const scorerOnly = await ensureUser(LAB.scorerOnly, LAB.password, 'Dana Scorer');
  const gateOnly = await ensureUser(LAB.gateOnly, LAB.password, 'Pat Gate');
  // Every account this script owns. ⚠ Add here when you add one, or the "is this org ours?" guard
  // below reads your own new member as a stranger and refuses to touch the org.
  const ourUserIds = new Set([owner.id, coach.id, scorer.id, scorerOnly.id, gateOnly.id]);

  // ── org ──────────────────────────────────────────────────────────────────────────────────
  // `club` so the whole premium coach portal is entitled (lib/plan-config.ts moduleEntitlements)
  // and the org sits well above a one-tournament plan, which is what step 9's downgrade needs.
  const orgFields = {
    name: LAB.name, plan_id: 'club', subscription_status: 'active',
    is_public: false, is_discoverable: false, account_kind: 'organization',
    theme_preset: 'platform',
  };
  let org = (await db.from('organizations').select('id').eq('slug', LAB.slug).maybeSingle()).data;
  if (!org) {
    const row = { id: randomUUID(), slug: LAB.slug, ...orgFields };
    die('org insert', (await db.from('organizations').insert(row)).error);
    org = row;
    ok(`org created ${LAB.slug}`);
  } else {
    // Prove it is ours before overwriting — a real tenant must never be hijacked by a seeder.
    const { data: foreign } = await db.from('organization_members')
      .select('user_id').eq('organization_id', org.id).limit(50);
    const strangers = (foreign ?? []).filter(m => !ourUserIds.has(m.user_id));
    if (strangers.length) {
      console.error(`✗ Refusing to adopt "${LAB.slug}": it has ${strangers.length} member(s) this script did not create.`);
      process.exit(1);
    }
    // subscription_status is RESET to active on every run — that is the point of a lab you
    // cancel repeatedly. Re-running this script is how you put it back if step 8 goes wrong.
    die('org update', (await db.from('organizations').update(orgFields).eq('id', org.id)).error);
    ok(`org reset to ACTIVE / club (${LAB.slug})`);
  }

  await ensureMember(org.id, owner.id, 'owner', 'QA Lab Owner');
  await ensureMember(org.id, coach.id, 'coach', 'QA Lab Coach');
  // `official` carries submit_scores + check_in_teams (lib/roles.ts) and, with no rows in
  // org_member_tournament_assignments, is unrestricted — so they see every active tournament.
  await ensureMember(org.id, scorer.id, 'official', 'QA Lab Scorekeeper');

  // ── the two SINGLE-DUTY volunteers ───────────────────────────────────────────────────────
  // The day-of shells now show a tab per duty held, so these two see a two-tab bar (their
  // surface + Account) where the dual-duty volunteer above sees three. That two-tab case is the
  // design's weakest and the reason these fixtures exist — the alternative is QA judging it from
  // a description. Each is also a WALL test: the door they lack must refuse them by capability,
  // not merely hide its tab.
  await ensureMember(org.id, scorerOnly.id, 'official', 'Dana Scorer',
    { check_in_teams: false, manage_registrations: false });
  await ensureMember(org.id, gateOnly.id, 'official', 'Pat Gate',
    { submit_scores: false });

  // ── rep team + season ────────────────────────────────────────────────────────────────────
  let team = (await db.from('rep_teams').select('id, name').eq('org_id', org.id).eq('slug', 'qa-lab-u13').maybeSingle()).data;
  if (!team) {
    const ins = await db.from('rep_teams').insert({
      org_id: org.id, name: 'QA Lab U13', slug: 'qa-lab-u13', sport: 'baseball', division: 'U13',
    }).select('id, name').single();
    die('team insert', ins.error);
    team = ins.data;
    ok('rep team created QA Lab U13');
  } else note('rep team exists QA Lab U13');

  const year = new Date().getFullYear();
  let py = (await db.from('rep_program_years').select('id, year')
    .eq('team_id', team.id).eq('status', 'active').maybeSingle()).data;
  if (!py) {
    const ins = await db.from('rep_program_years').insert({
      team_id: team.id, org_id: org.id, name: `${year} Season`, year, status: 'active',
    }).select('id, year').single();
    die('program year insert', ins.error);
    py = ins.data;
    ok(`program year ${year} created`);
  } else note(`program year ${py.year} exists`);

  // capabilities: null = head coach, holds everything — so "open a roster, open attendance,
  // open lineups" in the setup step all genuinely work before the cancel.
  // ⚠ M1 (mig 245): the membership is the access truth; the row is the record/projection. Both.
  die('coach membership', (await db.from('rep_team_staff_memberships').upsert({
    org_id: org.id, team_id: team.id, user_id: coach.id,
    coach_role: 'head_coach', capabilities: null,
    status: 'active', revoked_at: null, revoked_by: null,
  }, { onConflict: 'team_id,user_id' })).error);
  const { data: coachRow } = await db.from('rep_team_coaches')
    .select('id').eq('program_year_id', py.id).eq('user_id', coach.id).maybeSingle();
  if (!coachRow) {
    die('coach assign', (await db.from('rep_team_coaches').insert({
      program_year_id: py.id, team_id: team.id, org_id: org.id,
      user_id: coach.id, coach_role: 'head_coach', capabilities: null,
    })).error);
    ok('head coach assigned');
  } else note('head coach already assigned');

  // ── roster ───────────────────────────────────────────────────────────────────────────────
  const NAMES = ['Avery', 'Blake', 'Casey', 'Devon', 'Emerson', 'Frankie', 'Gray', 'Harper', 'Indigo', 'Jules', 'Kai', 'Logan'];
  let players = (await db.from('rep_roster_players').select('id')
    .eq('program_year_id', py.id).eq('status', 'active').order('display_order')).data ?? [];
  if (!players.length) {
    const ins = await db.from('rep_roster_players').insert(NAMES.map((n, i) => ({
      program_year_id: py.id, team_id: team.id, org_id: org.id,
      player_first_name: n, player_last_name: 'Lab', player_number: String(i + 1),
      status: 'active', source: 'admin_manual', display_order: i,
    }))).select('id');
    die('roster insert', ins.error);
    players = ins.data;
    ok(`roster seeded (${players.length})`);
  } else note(`roster present (${players.length})`);

  // ── a game today, so the coach's "before" half has something real to open ────────────────
  const gStart = new Date(Date.now() + 3 * 3600_000).toISOString();
  const gEnd = new Date(Date.now() + 5 * 3600_000).toISOString();
  let ev = (await db.from('rep_team_events').select('id')
    .eq('program_year_id', py.id).eq('name', 'QA Lab — league game').maybeSingle()).data;
  if (!ev) {
    const ins = await db.from('rep_team_events').insert({
      program_year_id: py.id, team_id: team.id, org_id: org.id,
      event_type: 'league_game', name: 'QA Lab — league game',
      opponent: 'Lab Rovers', home_away: 'home',
      starts_at: gStart, ends_at: gEnd, location: 'Lab Field', field_number: '1',
    }).select('id').single();
    die('lab game insert', ins.error);
    ev = ins.data;
    ok('rep-team game created (today)');
  } else {
    die('lab game refresh', (await db.from('rep_team_events')
      .update({ starts_at: gStart, ends_at: gEnd }).eq('id', ev.id)).error);
    ok('rep-team game re-anchored to today');
  }

  const { data: lu } = await db.from('rep_team_lineups').upsert({
    event_id: ev.id, program_year_id: py.id, team_id: team.id, org_id: org.id,
    lineup_mode: 'everyone_bats', inning_count: 6,
  }, { onConflict: 'event_id' }).select('id').single();
  const { data: hasEntries } = await db.from('rep_team_lineup_entries').select('id').eq('lineup_id', lu.id).limit(1);
  if (!hasEntries?.length) {
    // A plain rotating bench — three sit each inning and the seat moves along the roster.
    const labBench = Object.fromEntries(Array.from({ length: 6 }, (_, n) => [
      n + 1, [0, 1, 2].map(k => (n * 3 + k) % players.length),
    ]));
    const labGrid = buildInningGrid({ playerCount: players.length, innings: 6, benchByInning: labBench });
    die('lab lineup entries', (await db.from('rep_team_lineup_entries').insert(
      players.map((p, i) => ({
        lineup_id: lu.id, player_id: p.id, batting_order: i + 1, starter: true,
        inning_positions: labGrid[i],
      })),
    )).error);
    ok('lineup seeded (so "open lineups" is a real before)');
  } else note('lineup present');

  const { data: hasAtt } = await db.from('rep_team_event_attendance').select('id').eq('event_id', ev.id).limit(1);
  if (!hasAtt?.length) {
    const r = await db.from('rep_team_event_attendance').insert(players.map((p, i) => ({
      event_id: ev.id, player_id: p.id, program_year_id: py.id, team_id: team.id, org_id: org.id,
      status: i < 10 ? 'attending' : i < 11 ? 'late' : 'absent',
    })));
    if (r.error) note(`attendance skipped (${r.error.message})`);
    else ok('attendance seeded');
  } else note('attendance present');

  // ── three tournaments, shaped so step 9 can TELL THE TWO RULES APART ─────────────────────
  // ⚠ This is the whole point of the trio, and a flatter fixture would pass either way.
  //
  // The downgrade used to keep "the most recent seasons" — year DESC, then name A–Z — which
  // inside one year is pure alphabet. So a tournament running RIGHT NOW could be archived in
  // favour of one that finished in the spring, taking a live public site down mid-event. The
  // rule now ranks by what the org is actually using: running now, then upcoming, then draft,
  // then finished.
  //
  // These three make the two rules DISAGREE, so the checkbox has a real answer:
  //   · "April Open"      2026, finished     → old rule keeps it (A before S). New rule archives it.
  //   · "Summer Showdown" 2026, LIVE today   → old rule ARCHIVES it. New rule keeps it. ← the test
  //   · "Fall Invitational" last year, done  → archived either way.
  // Drop the org to a one-tournament plan and the survivor must be **Summer Showdown**.
  const TOURNEYS = [
    // Finished, but alphabetically first in the same year — the decoy the old rule preferred.
    { name: 'QA Lab April Open', slug: 'qa-lab-april-open', year, status: 'completed', start: -60, end: -58 },
    // Running right now, and the one carrying today's games for the scorekeeper.
    // ⚠ Starts TODAY, not yesterday. A tournament whose first day is in the past reads at a glance
    // like a stale fixture — the QA screen shows "started Aug 9" on Aug 10 and the first question
    // becomes "is this seed out of date?" rather than the one the step is asking. Day 1 = today
    // makes the state self-evidently current, and it still lands inside its own window, which is
    // what the keep-the-live-one rule actually reads.
    { name: 'QA Lab Summer Showdown', slug: 'qa-lab-summer-showdown', year, status: 'active', start: 0, end: 2, games: true },
    // Last year, long finished.
    { name: 'QA Lab Fall Invitational', slug: 'qa-lab-fall-invitational', year: year - 1, status: 'completed', start: -400, end: -398 },
  ];
  for (const t of TOURNEYS) {
    let row = (await db.from('tournaments').select('id, status').eq('org_id', org.id).eq('slug', t.slug).maybeSingle()).data;
    const fields = {
      name: t.name, year: t.year, status: t.status, is_active: t.status === 'active',
      start_date: isoDate(Date.now() + t.start * DAY),
      end_date: isoDate(Date.now() + t.end * DAY),
      org_id: org.id, sport: 'baseball',
      list_in_directory: false,
    };
    if (!row) {
      const ins = await db.from('tournaments').insert({ id: randomUUID(), slug: t.slug, ...fields }).select('id').single();
      die(`tournament insert ${t.slug}`, ins.error);
      row = ins.data;
      ok(`tournament created ${t.name} (${t.status}${t.games ? ', live today' : ''})`);
    } else {
      // Status AND dates are reasserted: step 9 archives two of these, and a re-run has to put
      // them back — including un-archiving, or the next run has only one candidate and step 9
      // silently stops testing anything.
      die(`tournament reset ${t.slug}`, (await db.from('tournaments').update(fields).eq('id', row.id)).error);
      ok(`tournament reset ${t.name} → ${t.status}${t.games ? ', live today' : ''}`);
    }
    if (!t.games) continue;

    // One division + four teams + two games TODAY. The scorekeeper screen lists games by
    // game_date on the org's ACTIVE tournaments (app/api/official/.../get-score.ts), so this
    // is the minimum that makes "confirm you can see the day's games" a real before.
    let div = (await db.from('divisions').select('id').eq('tournament_id', row.id).eq('name', 'U13').maybeSingle()).data;
    if (!div) {
      const ins = await db.from('divisions').insert({
        tournament_id: row.id, name: 'U13', display_order: 1, capacity: 8,
      }).select('id').single();
      die('division insert', ins.error);
      div = ins.data;
      ok('division created U13');
    }
    const TEAM_NAMES = ['Lab Rovers', 'Lab Comets', 'Lab Foxes', 'Lab Otters'];
    let tourneyTeams = (await db.from('teams').select('id, name').eq('tournament_id', row.id).order('name')).data ?? [];
    if (tourneyTeams.length < 4) {
      const missing = TEAM_NAMES.filter(n => !tourneyTeams.some(x => x.name === n));
      const ins = await db.from('teams').insert(missing.map(n => ({
        tournament_id: row.id, division_id: div.id, name: n, status: 'accepted',
        payment_status: 'paid', registered_at: nowIso,
      }))).select('id, name');
      die('teams insert', ins.error);
      tourneyTeams = [...tourneyTeams, ...ins.data];
      ok(`tournament teams seeded (${tourneyTeams.length})`);
    }
    // ── the fields the games are played on ─────────────────────────────────────────────────
    // ⚠ Real records, not just a typed location string. The scorekeeper's "All fields" filter is
    // built from the tournament's CONFIGURED fields, so a fixture that only wrote the field name
    // onto each game gave a dropdown with nothing in it — the filter listed nothing and could
    // match nothing, while the cards still read "LAB FIELD 1". Found in QA 2026-08-07.
    const FIELD_NAMES = ['Lab Field 1', 'Lab Field 2'];
    let labFields = (await db.from('diamonds').select('id, name').eq('tournament_id', row.id)).data ?? [];
    const missingFields = FIELD_NAMES.filter(n => !labFields.some(f => f.name === n));
    if (missingFields.length) {
      const ins = await db.from('diamonds').insert(missingFields.map(name => ({
        tournament_id: row.id, name,
      }))).select('id, name');
      die('fields insert', ins.error);
      labFields = [...labFields, ...ins.data];
      ok(`fields seeded (${labFields.length})`);
    }
    const fieldByName = Object.fromEntries(labFields.map(f => [f.name, f.id]));

    const byName = Object.fromEntries(tourneyTeams.map(x => [x.name, x.id]));
    const today = isoDate(Date.now());
    const GAMES = [
      { home: 'Lab Rovers', away: 'Lab Comets', time: '10:00', loc: 'Lab Field 1' },
      { home: 'Lab Foxes', away: 'Lab Otters', time: '13:00', loc: 'Lab Field 2' },
    ];
    for (const g of GAMES) {
      const existing = (await db.from('games').select('id').eq('tournament_id', row.id)
        .eq('home_team_id', byName[g.home]).eq('away_team_id', byName[g.away]).maybeSingle()).data;
      const fieldsG = {
        tournament_id: row.id, division_id: div.id,
        home_team_id: byName[g.home], away_team_id: byName[g.away],
        game_date: today, game_time: g.time, location: g.loc,
        // The link that makes the field filter able to match this game at all.
        diamond_id: fieldByName[g.loc] ?? null,
        status: 'scheduled', home_score: null, away_score: null, is_playoff: false,
      };
      if (!existing) {
        die('game insert', (await db.from('games').insert(fieldsG)).error);
      } else {
        // Re-anchor to today AND clear any score entered during a previous run's "before" half.
        die('game refresh', (await db.from('games').update(fieldsG).eq('id', existing.id)).error);
      }
    }
    ok('two tournament games anchored to TODAY (the scorekeeper\'s before)');
  }

  console.log('');
  console.log(`  Org           /${LAB.slug}`);
  console.log(`  Owner         ${LAB.owner} / ${LAB.password}   → the comeback path, step 7`);
  console.log(`  Coach         ${LAB.coach} / ${LAB.password}   → the portal half, steps 2 + 5`);
  console.log(`  Scorekeeper   ${LAB.scorer} / ${LAB.password}   → steps 3 + 6; BOTH duties (3 tabs)`);
  console.log(`  Score only    ${LAB.scorerOnly} / ${LAB.password}   → 2 tabs; /check-in must WALL`);
  console.log(`  Gate only     ${LAB.gateOnly} / ${LAB.password}   → 2 tabs; /scorekeeper must WALL`);
  console.log(`  Coach portal  /${LAB.slug}/coaches/teams/${team.id}`);
  console.log(`  Scorekeeper   /${LAB.slug}/scorekeeper`);
  console.log(`  Gate check-in /${LAB.slug}/check-in`);
  console.log(`  Billing       /${LAB.slug}/admin/org/billing`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Shared lookup for the two fixtures that ride on the standing QA team
// ═══════════════════════════════════════════════════════════════════════════════════════════
const JAYS_ORG = 'toronto-blue-jays5-coaches-portal';

async function jaysContext() {
  const { data: org } = await db.from('organizations').select('id, slug').eq('slug', JAYS_ORG).maybeSingle();
  if (!org) { console.error(`✗ No org "${JAYS_ORG}" — the standing QA fixture is missing.`); process.exit(1); }
  const { data: team } = await db.from('rep_teams').select('id, name').eq('org_id', org.id).limit(1).maybeSingle();
  const { data: py } = await db.from('rep_program_years').select('id, year')
    .eq('team_id', team.id).eq('status', 'active').order('year', { ascending: false }).limit(1).maybeSingle();
  const { data: players } = await db.from('rep_roster_players').select('id, player_first_name, player_last_name, player_number, lineup_profile')
    .eq('program_year_id', py.id).eq('status', 'active').order('display_order');
  return { org, team, py, players: players ?? [] };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// PART B — Group 1E, the game-day console's live window
// ═══════════════════════════════════════════════════════════════════════════════════════════
async function seedGameDay() {
  head('Part B — Group 1E, the game-day live window');
  const { org, team, py, players } = await jaysContext();
  if (players.length < 10) { console.error('✗ Fixture roster is too small for a bench.'); process.exit(1); }
  note(`${org.slug} / ${team.name} / ${py.year} (${players.length} players)`);

  // Anchored 40 minutes in the past: the console opens LIVE, mid-game, which is the only state
  // where the Note button (§1.17), the bench order (§1.18) and the wake lock all exist at once.
  const start = new Date(Date.now() - 40 * 60_000).toISOString();
  const end = new Date(Date.now() + 100 * 60_000).toISOString();
  const NAME = '[qa] Game day — bench console';

  // "Northgate Knights" on purpose: they carry the fixture's richest history, so §1.15's
  // scouting handoff (the dotted-underlined opponent name) opens onto a book with content.
  let ev = (await db.from('rep_team_events').select('id').eq('program_year_id', py.id).eq('name', NAME).maybeSingle()).data;
  const evFields = {
    starts_at: start, ends_at: end,
    // Scores AND status reset: a previous run's End game would otherwise leave the console
    // opening in read-only recap, and a cancelled game shows no Game day pill at all.
    team_score: null, opponent_score: null, result: null, status: 'scheduled',
  };
  if (!ev) {
    const ins = await db.from('rep_team_events').insert({
      program_year_id: py.id, team_id: team.id, org_id: org.id,
      event_type: 'league_game', name: NAME,
      opponent: 'Northgate Knights', home_away: 'home',
      location: 'Christie Pits', field_number: '1', arrival_time: '17:30', uniform: 'Home whites',
      ...evFields,
    }).select('id').single();
    die('game insert', ins.error);
    ev = ins.data;
    ok('live game created');
  } else {
    // Scores cleared as well as times: a previous run's End game would otherwise leave the
    // console opening in read-only recap and quietly measure the wrong screen.
    die('game refresh', (await db.from('rep_team_events').update(evFields).eq('id', ev.id)).error);
    ok('live game re-anchored to now, score cleared');
  }

  const INNINGS = 6;
  const { data: lu } = await db.from('rep_team_lineups').upsert({
    event_id: ev.id, program_year_id: py.id, team_id: team.id, org_id: org.id,
    lineup_mode: 'everyone_bats', inning_count: INNINGS, rules_override: null,
  }, { onConflict: 'event_id' }).select('id').single();

  // Wipe and rebuild: the bench pattern below is the whole point of the fixture, and a
  // half-edited grid from a previous sitting would make "longest sitting first" untestable.
  die('lineup clear', (await db.from('rep_team_lineup_entries').delete().eq('lineup_id', lu.id)).error);

  // ⚠ The bench streaks are deliberately UNEQUAL. If everyone had sat the same amount, "longest
  // sitting first" would order correctly by accident and §1.18's first check would prove nothing.
  // Reading the roster from the BOTTOM (so the longest sitter is also last in roster order — the
  // tiebreak can then never be mistaken for the sort actually working):
  //   · last player      sits 1,2,3,4  → 4 straight by inning 4, and the red chip
  //   · second-last      sits 2,3,4    → 3 straight
  //   · third-last       sits 3,4      → 2 straight
  // Innings 1–2 need two more seats and innings 5–6 need three, filled from the top of the order
  // so those players carry a streak of 1 — the tie case, which falls back to roster order.
  const L = players.length;
  const benchByInning = {
    1: [L - 1, 4, 5],
    2: [L - 1, L - 2, 6],
    3: [L - 1, L - 2, L - 3],
    4: [L - 1, L - 2, L - 3],
    5: [1, 2, 3],
    6: [1, 2, 7],
  };
  // Three pitchers of two innings each. Player 0 sits on exactly 2 so §1.18's chip has a
  // "2 of 3" to say the moment a season cap is set — and nobody else is silently over it.
  const pitcherFor = { 1: 0, 2: 0, 3: 8, 4: 8, 5: 9, 6: 9 };
  let grid;
  try {
    grid = buildInningGrid({ playerCount: L, innings: INNINGS, benchByInning, pitcherFor });
  } catch (e) {
    console.error(`✗ lineup grid: ${e.message}`);
    process.exit(1);
  }
  die('lineup entries', (await db.from('rep_team_lineup_entries').insert(
    players.map((p, i) => ({
      lineup_id: lu.id, player_id: p.id, batting_order: i + 1, starter: true, inning_positions: grid[i],
    })),
  )).error);
  ok(`lineup rebuilt — bench streaks 4/3/2 by inning 4, ${players[0].player_first_name} pitched innings 1–2`);

  // Caps LEFT UNSET on both the season and the pitcher: §1.18's first pitching check is
  // "before this it showed nothing at all", so the fixture has to start from nothing.
  const { data: pyRow } = await db.from('rep_program_years').select('lineup_settings').eq('id', py.id).maybeSingle();
  const seasonCap = pyRow?.lineup_settings?.pitcherMaxInningsDefault ?? null;
  if (seasonCap != null) {
    note(`⚠ season pitching cap is already set to ${seasonCap} — clear it in Team settings for §1.18's "before"`);
  } else {
    note('season pitching cap is unset (correct starting state for §1.18)');
  }
  const perPlayer = players[0].lineup_profile?.pitcher?.maxInnings ?? null;
  if (perPlayer != null) note(`⚠ ${players[0].player_first_name} carries a personal cap of ${perPlayer} — clear it for the first check`);

  await db.from('rep_team_event_attendance').delete().eq('event_id', ev.id);
  const attRows = players.map((p, i) => ({
    event_id: ev.id, player_id: p.id, program_year_id: py.id, team_id: team.id, org_id: org.id,
    status: i < players.length - 2 ? 'attending' : i === players.length - 2 ? 'late' : 'absent',
  }));
  const attRes = await db.from('rep_team_event_attendance').insert(attRows);
  if (attRes.error) note(`attendance skipped (${attRes.error.message})`);
  else ok('attendance set — one late, one out, the rest in');

  console.log('');
  console.log(`  Console   /${org.slug}/coaches/teams/${team.id}/game/${ev.id}`);
  console.log(`  Window    open until ${new Date(Date.parse(end) + 3 * 3600_000).toLocaleTimeString()} — re-run this script to extend it`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// PART C — Group 1D, the opponent book and the club pair
// ═══════════════════════════════════════════════════════════════════════════════════════════
async function upsertOpponent(teamId, orgId, displayName, summary, updatedBy) {
  const normalized = normalizeOpponentName(displayName);
  const existing = (await db.from('rep_team_opponents').select('id, summary')
    .eq('team_id', teamId).eq('normalized_name', normalized).maybeSingle()).data;
  if (existing) {
    if (summary && !existing.summary) {
      die('opponent summary', (await db.from('rep_team_opponents')
        .update({ summary, last_note_updated_at: nowIso, updated_by: updatedBy }).eq('id', existing.id)).error);
      ok(`book line written on ${displayName}`);
    } else note(`opponent row exists ${displayName}`);
    return existing.id;
  }
  const ins = await db.from('rep_team_opponents').insert({
    team_id: teamId, org_id: orgId, display_name: displayName, normalized_name: normalized,
    summary: summary ?? null, last_note_updated_at: summary ? nowIso : null, updated_by: updatedBy,
  }).select('id').single();
  die(`opponent insert ${displayName}`, ins.error);
  ok(`opponent + book line created ${displayName}`);
  return ins.data.id;
}

async function addObservations(opponentId, teamId, orgId, authorName, rows) {
  const { data: have } = await db.from('rep_team_opponent_observations')
    .select('id').eq('opponent_id', opponentId).limit(1);
  if (have?.length) { note('observations already present'); return; }
  die('observations', (await db.from('rep_team_opponent_observations').insert(
    rows.map(r => ({
      opponent_id: opponentId, team_id: teamId, org_id: orgId,
      event_id: r.eventId ?? null, body: r.body, tag: r.tag ?? null,
      created_by: null, created_by_name: authorName,
    })),
  )).error);
  ok(`${rows.length} observations logged`);
}

async function seedBook() {
  head('Part C — Group 1D, the opponent book');
  const { org, team, py, players } = await jaysContext();
  note(`${org.slug} / ${team.name} / ${py.year}`);

  const { data: games } = await db.from('rep_team_events')
    .select('id, name, opponent, event_type, starts_at, team_score, opponent_score, result')
    .eq('team_id', team.id).not('opponent', 'is', null).order('starts_at');
  const vs = (n) => (games ?? []).filter(g => normalizeOpponentName(g.opponent) === normalizeOpponentName(n));

  // ── Northgate Knights — the deep one: many meetings across two seasons, wins AND losses ──
  const knights = await upsertOpponent(
    team.id, org.id, 'Northgate Knights',
    'They sit their corners deep and dare you to bunt. Their #7 is the only arm that changes speeds — everyone else is one pitch. Run on the first move.',
    null,
  );
  const knightGames = vs('Northgate Knights');
  await addObservations(knights, team.id, org.id, 'Robert Cowan', [
    { body: '#7 tips the change-up — glove drops before the wind-up.', tag: 'Pitching', eventId: knightGames.at(-1)?.id ?? null },
    { body: 'Corners play deep all game. Two bunts got us two runners.', tag: 'Defence' },
    { body: 'They steal on the first move, every time, regardless of count.', tag: 'Baserunning' },
    { body: 'Their bench is loud but the infield goes quiet once they trail.', tag: null },
  ]);

  // ── Durham Diamonds — the honest sparse one: three meetings, all losses, no book line yet ──
  // Deliberately left WITHOUT a summary so §1.12's "an assistant without notes sees it
  // read-only and gets no editor" has an empty-book case to look at, and so the amber
  // "something is written" dot has a row it must NOT appear on.
  await upsertOpponent(team.id, org.id, 'Durham Diamonds', null, null);
  note('Durham Diamonds left with NO book line on purpose (the empty-book case)');

  // ── The second spelling, so §1.13's merge has something real to merge ────────────────────
  // A scored game named differently for the same club. Merging "Knights 12U" into "Northgate
  // Knights" is the check; un-merging it again is the one after.
  const ALIAS_NAME = '[qa] vs Knights 12U';
  const aliasExisting = (await db.from('rep_team_events').select('id')
    .eq('program_year_id', py.id).eq('name', ALIAS_NAME).maybeSingle()).data;
  if (!aliasExisting) {
    die('alias game', (await db.from('rep_team_events').insert({
      program_year_id: py.id, team_id: team.id, org_id: org.id,
      event_type: 'league_game', name: ALIAS_NAME,
      opponent: 'Knights 12U', home_away: 'away',
      starts_at: new Date(Date.now() - 12 * DAY).toISOString(),
      ends_at: new Date(Date.now() - 12 * DAY + 2 * 3600_000).toISOString(),
      location: 'Northgate Park', team_score: 4, opponent_score: 6, result: 'loss',
    })).error);
    ok('second spelling seeded — "Knights 12U", a 4–6 loss (merge fodder for §1.13)');
  } else note('second spelling already present');
  await upsertOpponent(
    team.id, org.id, 'Knights 12U',
    'Same club as Northgate, younger side — they bat their best two at the top rather than 3-4.',
    null,
  );

  // ── Lineups vs Northgate, so §1.13's "What worked" has wins and a loss to contrast ───────
  // Two different pitchers: the fixture's first player starts the WINS, the second starts the
  // LOSSES. Without that contrast the block correctly stays silent and the check proves nothing.
  // ⚠ Take wins AND losses explicitly. Chronological order here is six 2025 wins before the
  // first loss, so a plain `.slice(0, 6)` seeds nothing but wins — and "in both wins X started,
  // in the loss they didn't" then has no loss to contrast and stays silent, which reads in QA as
  // a broken feature rather than a fixture that never set up the case.
  const knightWins = knightGames.filter(g => g.result === 'win').slice(0, 3);
  const knightLosses = knightGames.filter(g => g.result === 'loss').slice(0, 2);
  if (!knightLosses.length) note('⚠ no losses vs Northgate — "What worked" will correctly stay silent');
  let lineupsMade = 0;
  for (const g of [...knightWins, ...knightLosses]) {
    const { data: lu } = await db.from('rep_team_lineups').upsert({
      event_id: g.id, program_year_id: py.id, team_id: team.id, org_id: org.id,
      lineup_mode: 'everyone_bats', inning_count: 6,
    }, { onConflict: 'event_id' }).select('id').single();
    const { data: have } = await db.from('rep_team_lineup_entries').select('id').eq('lineup_id', lu.id).limit(1);
    if (have?.length) continue;
    // The pitcher is the whole point: player 0 starts every WIN, player 1 starts every LOSS, so
    // "in both wins, X started at pitcher; in the loss they didn't" has something true to say.
    const starterIdx = g.result === 'win' ? 0 : 1;
    const bookBench = Object.fromEntries(Array.from({ length: 6 }, (_, n) => [
      n + 1,
      // Three sit each inning, rotating, and never the starting pitcher.
      [0, 1, 2].map(k => (n * 3 + k + 3) % players.length).filter(i => i !== starterIdx),
    ]));
    // Refill any seat the pitcher filter removed, so every inning still benches exactly three.
    for (let n = 1; n <= 6; n++) {
      let cand = (n * 3 + 6) % players.length;
      while (bookBench[n].length < players.length - FIELD_POSITIONS.length) {
        if (cand !== starterIdx && !bookBench[n].includes(cand)) bookBench[n].push(cand);
        cand = (cand + 1) % players.length;
      }
    }
    const bookGrid = buildInningGrid({
      playerCount: players.length, innings: 6, benchByInning: bookBench,
      pitcherFor: Object.fromEntries(Array.from({ length: 6 }, (_, n) => [n + 1, starterIdx])),
    });
    die('book lineup entries', (await db.from('rep_team_lineup_entries').insert(
      players.map((p, i) => ({
        lineup_id: lu.id, player_id: p.id, batting_order: i + 1, starter: true,
        inning_positions: bookGrid[i],
      })),
    )).error);
    lineupsMade += 1;
  }
  if (lineupsMade) ok(`${lineupsMade} lineups saved vs Northgate — a different pitcher in wins vs losses`);
  else note('lineups vs Northgate already present');

  // ── The club pair, for §1.16 ─────────────────────────────────────────────────────────────
  head('Part C — §1.16, the two-team club pair');
  const { data: clubOrg } = await db.from('organizations')
    .select('id, slug, plan_id, club_book_sharing_enabled').eq('slug', 'dev-club-org').maybeSingle();
  if (!clubOrg) { note('✗ dev-club-org missing — skipping the club pair'); return; }
  note(`${clubOrg.slug} (${clubOrg.plan_id}) — club_shared_book needs rank ≥ club; club_large qualifies`);

  const { data: clubTeams } = await db.from('rep_teams').select('id, name, share_club_book').eq('org_id', clubOrg.id).order('name');
  if ((clubTeams ?? []).length < 2) { note('✗ dev-club-org needs two rep teams — skipping'); return; }
  const [teamA, teamB] = clubTeams;

  // Both switches left OFF: turning them on is steps 1 and 2 of §1.16, and a fixture that
  // arrives already sharing skips the half of the section that is actually about the gate.
  die('reset team A switch', (await db.from('rep_teams').update({ share_club_book: false }).eq('id', teamA.id)).error);
  die('reset team B switch', (await db.from('rep_teams').update({ share_club_book: false }).eq('id', teamB.id)).error);
  die('reset org switch', (await db.from('organizations').update({ club_book_sharing_enabled: false }).eq('id', clubOrg.id)).error);
  ok('all three sharing switches reset to OFF (turning them on is the test)');

  // Both teams need content on the SAME opponent name, or there is nothing to see once the
  // switches go on. "Thunder" already appears on team B's schedule; team A gets games too.
  const SHARED = 'Thunder';
  const { data: pyA } = await db.from('rep_program_years').select('id, year')
    .eq('team_id', teamA.id).eq('status', 'active').order('year', { ascending: false }).limit(1).maybeSingle();
  if (pyA) {
    const nameA = '[qa] vs Thunder';
    const existsA = (await db.from('rep_team_events').select('id')
      .eq('program_year_id', pyA.id).eq('name', nameA).maybeSingle()).data;
    if (!existsA) {
      die('club team A game', (await db.from('rep_team_events').insert({
        program_year_id: pyA.id, team_id: teamA.id, org_id: clubOrg.id,
        event_type: 'league_game', name: nameA, opponent: SHARED, home_away: 'home',
        starts_at: new Date(Date.now() - 20 * DAY).toISOString(),
        ends_at: new Date(Date.now() - 20 * DAY + 2 * 3600_000).toISOString(),
        location: 'Club Park', team_score: 5, opponent_score: 2, result: 'win',
      })).error);
      ok(`${teamA.name} given a scored game vs ${SHARED}`);
    } else note(`${teamA.name} already meets ${SHARED}`);
  }

  const oppA = await upsertOpponent(teamA.id, clubOrg.id, SHARED,
    'They only have one pitcher who throws strikes — make him work and the walks come.', null);
  await addObservations(oppA, teamA.id, clubOrg.id, `${teamA.name} coach`, [
    { body: 'Their catcher cannot throw to second. We ran at will.', tag: 'Baserunning' },
    { body: 'Left side of the infield is where the outs are.', tag: 'Hitting' },
    { body: 'They pull the starter at 60 pitches no matter the score.', tag: 'Pitching' },
  ]);

  const oppB = await upsertOpponent(teamB.id, clubOrg.id, SHARED,
    'Big lineup, slow bats. Nobody bunts. Play the outfield deep and dare them to run.', null);
  await addObservations(oppB, teamB.id, clubOrg.id, `${teamB.name} coach`, [
    { body: 'Nobody on their bench takes a walk — attack the zone.', tag: 'Pitching' },
    { body: 'Their #3 is the only one who turns on an inside pitch.', tag: 'Hitting' },
  ]);

  console.log('');
  console.log(`  Book         /${org.slug}/coaches/teams/${team.id}/insights`);
  console.log(`  Club admin   /${clubOrg.slug}/admin/rep-teams  (Shared library → the switch)`);
  console.log(`  Team A       ${teamA.name}`);
  console.log(`  Team B       ${teamB.name}`);
}


// ═══════════════════════════════════════════════════════════════════════════════════════════
// PART D — Group 1C, the money lab
// ═══════════════════════════════════════════════════════════════════════════════════════════
// ⚠ WHY A DEDICATED ORG. Every team on dev that carries real money data is one we must not
// disturb: the coach demo sandbox (`riverdale-ridge`, the shop window a prospect walks into) and
// the owner's standing `toronto blue jays5` fixture, which was deliberately retained by ruling.
// Money QA needs to CHANGE numbers — add lines, pay instalments, import a sheet — so it gets its
// own throwaway club, the same way §1.19 did.
//
// Two teams, because §1.2 and §1.3 want opposite states and one team cannot be both:
//   · U13 — deliberately data-RICH, and in its SECOND season, for the months view and the phone.
//   · U11 — deliberately EMPTY, so the budget starter's first-run card has somewhere to appear.
const MONEY = {
  slug: 'qa-money-lab',
  name: 'QA Money Lab (throwaway)',
  password: 'devpass123',
  people: [
    // capabilities null = head coach, holds everything including money: 'write'.
    { email: 'qa-money-head@dev.local', name: 'QA Money Head Coach', role: 'head_coach', caps: null },
    // ⚠ The repeat-offender leak class: an assistant who may READ money and must never write it.
    { email: 'qa-money-read@dev.local', name: 'QA Money Read-Only', role: 'assistant_coach', caps: { money: 'read' } },
    // Money OFF is the assistant DEFAULT, set explicitly so a later capability edit cannot
    // silently change what this account is testing.
    { email: 'qa-money-off@dev.local', name: 'QA Money Off', role: 'assistant_coach', caps: { money: 'off' } },
    // Money but NOT guardian contacts — the case where family answers must fall back to naming
    // families by their PLAYERS ("Maya and Sam's family") rather than by a guardian.
    { email: 'qa-money-nopii@dev.local', name: 'QA Money No Contacts', role: 'assistant_coach', caps: { money: 'write', rosterPii: false } },
  ],
  // ⚠ DELIBERATELY NOT IN `people`, and on no team. The club half of the item-tier ruling —
  // "Items your teams have added", and Publish to all teams — lives on the ADMIN side of the org,
  // and until 2026-08-16 this lab had no account that could open it, so that half of the walk
  // simply could not be run here. Kept off every team's staff list so the four capability accounts
  // above stay the only thing the coach-side money gates are ever tested with.
  admin: { email: 'qa-money-admin@dev.local', name: 'QA Money Club Admin' },
};

/**
 * A wall clock in the CLUB's zone → the UTC instant it actually is, DST-correct.
 *
 * ⚠ Mirrors `zonedWallClockToUtc` in lib/timezone.ts, which this plain-JS script cannot import.
 * Seeding a time any other way is what produced the mismatch the 2026-08-24 tryout fix corrected —
 * a fixture written one way and read another proves nothing about either.
 */
function orgWallClockToUtc(date, time, timeZone = 'America/Toronto') {
  const pretendUtc = new Date(`${date}T${time}:00Z`);
  const asUtc = new Date(pretendUtc.toLocaleString('en-US', { timeZone: 'UTC' }));
  const asZone = new Date(pretendUtc.toLocaleString('en-US', { timeZone }));
  return new Date(pretendUtc.getTime() + (asUtc.getTime() - asZone.getTime())).toISOString();
}

/** The next Saturday on or after today, plus `extraDays`, as `YYYY-MM-DD`. */
function nextSaturday(extraDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7) + extraDays);
  return isoDate(d);
}

/** Month boundary helpers — every date a month-grid column will be compared against. */
const monthStart = (offset) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return isoDate(d);
};
const dayIn = (offset, day) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  d.setDate(day);
  return isoDate(d);
};

async function seedMoneyLab() {
  head('Part D — Group 1C, the money lab');

  const users = [];
  for (const p of MONEY.people) users.push({ ...p, user: await ensureUser(p.email, MONEY.password, p.name) });
  const adminUser = await ensureUser(MONEY.admin.email, MONEY.password, MONEY.admin.name);
  const ourIds = new Set([...users.map(u => u.user.id), adminUser.id]);

  // ── org ──────────────────────────────────────────────────────────────────────────────────
  const orgFields = {
    name: MONEY.name, plan_id: 'club', subscription_status: 'active',
    is_public: false, is_discoverable: false, account_kind: 'organization', theme_preset: 'platform',
  };
  let org = (await db.from('organizations').select('id').eq('slug', MONEY.slug).maybeSingle()).data;
  if (!org) {
    const row = { id: randomUUID(), slug: MONEY.slug, ...orgFields };
    die('org insert', (await db.from('organizations').insert(row)).error);
    org = row;
    ok(`org created ${MONEY.slug}`);
  } else {
    const { data: foreign } = await db.from('organization_members')
      .select('user_id').eq('organization_id', org.id).limit(50);
    const strangers = (foreign ?? []).filter(m => !ourIds.has(m.user_id));
    if (strangers.length) {
      console.error(`✗ Refusing to adopt "${MONEY.slug}": ${strangers.length} member(s) this script did not create.`);
      process.exit(1);
    }
    die('org update', (await db.from('organizations').update(orgFields).eq('id', org.id)).error);
    ok(`org reset ${MONEY.slug}`);
  }
  for (const u of users) await ensureMember(org.id, u.user.id, 'coach', u.name);
  await ensureMember(org.id, adminUser.id, 'admin', MONEY.admin.name);

  // ── categories/items, looked up by name so the fixture never invents its own taxonomy ─────
  const { data: cats } = await db.from('budget_categories').select('id, name');
  const { data: items } = await db.from('budget_items').select('id, name, category_id');
  const catBy = Object.fromEntries((cats ?? []).map(c => [c.name, c.id]));
  const itemBy = (catName, itemName) => (items ?? []).find(i => i.category_id === catBy[catName] && i.name === itemName)?.id ?? null;

  async function makeTeam(name, slug, division) {
    let team = (await db.from('rep_teams').select('id, name').eq('org_id', org.id).eq('slug', slug).maybeSingle()).data;
    if (!team) {
      const ins = await db.from('rep_teams').insert({
        org_id: org.id, name, slug, sport: 'baseball', division,
      }).select('id, name').single();
      die('team insert', ins.error);
      team = ins.data;
      ok(`team created ${name}`);
    }
    return team;
  }

  async function makeYear(team, year, status) {
    let py = (await db.from('rep_program_years').select('id, year, status')
      .eq('team_id', team.id).eq('year', year).maybeSingle()).data;
    if (!py) {
      const ins = await db.from('rep_program_years').insert({
        team_id: team.id, org_id: org.id, name: `${year} Season`, year, status,
      }).select('id, year, status').single();
      die('program year insert', ins.error);
      py = ins.data;
      ok(`${team.name} ${year} (${status}) created`);
    } else if (py.status !== status) {
      die('year status', (await db.from('rep_program_years').update({ status }).eq('id', py.id)).error);
    }
    return py;
  }

  async function assignStaff(team, py) {
    for (const u of users) {
      // ⚠ M1 (mig 245): membership first (the access truth), then the season row (the record +
      // what the legacy write routes read). A row without a membership is a locked-out fixture.
      die('staff membership', (await db.from('rep_team_staff_memberships').upsert({
        org_id: org.id, team_id: team.id, user_id: u.user.id,
        coach_role: u.role, capabilities: u.caps,
        status: 'active', revoked_at: null, revoked_by: null,
      }, { onConflict: 'team_id,user_id' })).error);
      const has = (await db.from('rep_team_coaches').select('id')
        .eq('program_year_id', py.id).eq('user_id', u.user.id).maybeSingle()).data;
      const row = {
        program_year_id: py.id, team_id: team.id, org_id: org.id,
        user_id: u.user.id, coach_role: u.role, capabilities: u.caps,
      };
      if (has) die('staff update', (await db.from('rep_team_coaches').update(row).eq('id', has.id)).error);
      else die('staff insert', (await db.from('rep_team_coaches').insert(row)).error);
    }
  }

  async function makeRoster(team, py, names) {
    let players = (await db.from('rep_roster_players').select('id, player_first_name')
      .eq('program_year_id', py.id).eq('status', 'active').order('display_order')).data ?? [];
    if (players.length) return players;
    const ins = await db.from('rep_roster_players').insert(names.map((n, i) => ({
      program_year_id: py.id, team_id: team.id, org_id: org.id,
      player_first_name: n, player_last_name: 'Ledger', player_number: String(i + 1),
      status: 'active', source: 'admin_manual', display_order: i,
      // Two SIBLINGS share a guardian, so "what does each family still owe?" has a real
      // one-family-two-players case and a surname that differs from the players'.
      guardian_first_name: i < 2 ? 'Robin' : `G${i}`,
      guardian_last_name: i < 2 ? 'Okafor' : 'Ledger',
      guardian_email: i < 2 ? 'robin.okafor@example.com' : `g${i}@example.com`,
    }))).select('id, player_first_name');
    die('roster insert', ins.error);
    ok(`${team.name} roster seeded (${ins.data.length}, first two are siblings)`);
    return ins.data;
  }

  // ═══ TEAM A — data-rich, second season ═══════════════════════════════════════════════════
  const u13 = await makeTeam('QA Money U13', 'qa-money-u13', 'U13');
  const yr = new Date().getFullYear();
  const prev = await makeYear(u13, yr - 1, 'completed');
  const cur = await makeYear(u13, yr, 'active');
  await assignStaff(u13, cur);
  await assignStaff(u13, prev);
  const roster = await makeRoster(u13, cur, ['Maya', 'Sam', 'Ari', 'Bo', 'Cleo', 'Dez', 'Eli', 'Fay', 'Gus', 'Hana', 'Ira', 'Jo']);

  // ── budget lines, deliberately spread across MONTHS so the grid has columns to fill ──────
  //
  // ⚠⚠ EVERY COST LINE NAMES A CATEGORY *AND* AN ITEM (mig 240, 2026-08-16). Until then four of
  // these six carried no item — two by omission, and two because the name was wrong: there is no
  // "Uniforms" under Team Gear (Uniforms is a TOURNAMENTS item), so that lookup had been silently
  // returning null. The plan and the report are keyed on category+item now, so an item-less line
  // renders as "Not itemized" and the fixture exercises none of the design.
  //
  // ⚠⚠ REPAIRED, NEVER SKIPPED. This block used to bail out the moment any line existed, so a lab
  // seeded before mig 240 would stay pre-240 forever while reporting a clean run. A half-old
  // fixture reporting green is the exact failure the category+item plan's §11.9 exists to end.
  //
  // ⚠ TWO LINES ON ONE ITEM, deliberately (the owner's own screen was two lines under Entry Fees).
  // The plan and the report SUM them into one row reading "Entry Fees · 2 lines · $2,800". Without
  // a second line the lab cannot demonstrate the ruling at all.
  //
  // ⚠ One line is left with NO periods on purpose. An undated line must NOT be smeared across the
  // months (that behaviour changed deliberately) — it is the case the cumulative chart note in the
  // ledger is about. It moved OFF the Admin category on 2026-08-16: Admin is ORG-scoped, so a
  // coach's own planner never offers it and no coach could have created that line.
  const LINES = [
    { cat: 'Tournaments', item: 'Entry Fees',          desc: 'Tournament entry fees',        total: 2400, kind: 'cost', periods: [[-4, 600], [-3, 600], [-2, 600], [-1, 600]] },
    { cat: 'Tournaments', item: 'Entry Fees',          desc: 'Provincials entry — deposit',  total: 400,  kind: 'cost', periods: [[-1, 400]] },
    { cat: 'Team Gear',   item: 'Jerseys',             desc: 'Uniform order',                total: 1800, kind: 'cost', periods: [[-5, 1800]] },
    { cat: 'Facilities',  item: 'Diamond Permits',     desc: 'Diamond permits',              total: 1200, kind: 'cost', periods: [[-4, 300], [-3, 300], [-2, 300], [-1, 300]] },
    { cat: 'Officials',   item: 'Umpire Fees',         desc: 'Umpires',                      total: 900,  kind: 'cost', periods: [[-3, 300], [-2, 300], [-1, 300]] },
    { cat: 'Training',    item: 'Off-Season Training', desc: 'Winter training',              total: 1500, kind: 'cost', periods: [[-6, 500], [-5, 500], [-4, 500]] },
    { cat: 'Fundraising', item: 'Printing',            desc: 'Bottle drive printing',        total: 300,  kind: 'cost', periods: [] },
    // ⚠⚠ THE MONEY-IN LINE, and it is load-bearing for "one row, one source" (money-in plan §4.1):
    // the Spring Bottle Drive's actual is DERIVED onto this row, so the server must refuse a typed
    // income record against it. Without a funding line the guard has nothing to claim, an income
    // entry simply saves, and a tester reads an empty fixture as a defect. It also gives the
    // Fundraising category BOTH halves in the live season, so the by-activity lens has something
    // two-sided to net — the drive's proceeds against the drive's printing.
    { cat: 'Fundraising', item: 'Fundraising drive',   desc: 'Spring bottle drive — team share', total: 2000, kind: 'funding', periods: [] },
  ];
  {
    const { data: existing } = await db.from('rep_budget_lines')
      .select('id, description, category_id, item_id, line_kind')
      .eq('program_year_id', cur.id);
    const byDesc = new Map((existing ?? []).map(l => [l.description, l]));
    let added = 0, repaired = 0;
    for (const [i, l] of LINES.entries()) {
      const itemId = itemBy(l.cat, l.item);
      if (!itemId) die('budget item lookup', { message: `"${l.cat} / ${l.item}" is not in the starting library — the library moved and this fixture has to follow it` });
      const shape = {
        category_id: catBy[l.cat] ?? null, item_id: itemId,
        description: l.desc, total_amount: l.total, line_kind: l.kind, sort_order: i,
      };
      const have = byDesc.get(l.desc);
      if (have) {
        if (have.category_id !== shape.category_id || have.item_id !== itemId || have.line_kind !== l.kind) {
          die('budget line repair', (await db.from('rep_budget_lines').update(shape).eq('id', have.id)).error);
          repaired++;
        }
        continue;
      }
      const ins = await db.from('rep_budget_lines').insert({
        org_id: org.id, team_id: u13.id, program_year_id: cur.id, ...shape,
      }).select('id').single();
      die('budget line', ins.error);
      added++;
      if (l.periods.length) {
        die('budget periods', (await db.from('rep_budget_periods').insert(
          l.periods.map(([m, amt], n) => ({
            budget_line_id: ins.data.id, period_label: monthStart(m).slice(0, 7),
            period_date: monthStart(m), amount: amt, sort_order: n,
          })),
        )).error);
      }
    }
    // The Admin / Miscellaneous line is retired with its periods — see the note above.
    for (const s of (existing ?? []).filter(l => l.description === 'Miscellaneous')) {
      await db.from('rep_budget_periods').delete().eq('budget_line_id', s.id);
      die('retire Admin line', (await db.from('rep_budget_lines').delete().eq('id', s.id)).error);
      repaired++;
    }
    ok(`budget — 7 cost lines / $8,500 (TWO on one item) + 1 funding line / $2,000; ${added} added, ${repaired} repaired`);
  }

  // ── expenses: paid, payable, over-plan and unbudgeted ────────────────────────────────────
  //
  // ⚠⚠ EVERY COST NAMES ITS ITEM (mig 240, 2026-08-16). Until then not one row in this lab carried
  // an item, so every dollar landed in a category bucket and the report's whole payoff — "what item
  // did we get charged for that we never budgeted?" — had nothing to answer with. Same repair rule
  // as the budget lines above: an existing row is UPDATED onto its item, never skipped.
  //
  // ⚠ "Team photo day" is the UNBUDGETED beat, and its shape changed with mig 240. It used to carry
  // no category at all; it now names a real category and item that the plan has no line for, which
  // is what puts it on the report as its own row with a dash where Budgeted would be. A fixture
  // where everything reconciles teaches the opposite of the lesson.
  //
  // ⚠ "Uniform order" is $50 OVER its line, so exactly one row reads over-plan. A sheet where
  // every line comes in under is a sheet that flatters, and the Difference column proves nothing.
  const EXPENSES = [
    { desc: 'Spring Invitational entry', cat: 'Tournaments', item: 'Entry Fees',      amount: 600,  paid: dayIn(-4, 12) },
    { desc: 'Summer Classic entry',      cat: 'Tournaments', item: 'Entry Fees',      amount: 600,  paid: dayIn(-2, 8) },
    { desc: 'Uniform order',             cat: 'Team Gear',   item: 'Jerseys',         amount: 1850, paid: dayIn(-5, 20) },
    { desc: 'Diamond permits — spring',  cat: 'Facilities',  item: 'Diamond Permits', amount: 650,  paid: dayIn(-4, 3) },
    { desc: 'Umpires — midseason',       cat: 'Officials',   item: 'Umpire Fees',     amount: 300,  paid: dayIn(-2, 15) },
    { desc: 'Team photo day',            cat: 'Events',      item: 'Photo Day',       amount: 180,  paid: dayIn(-1, 9) },
  ];
  // A payable with a deposit paid and a balance still owed NEXT month — this is the row the
  // Payment schedule tab's Unpaid default exists for, and the one that creates a shortfall. It
  // shares Entry Fees with the two paid entries, so the item's actual is a deposit plus two costs.
  const PAYABLE = {
    desc: 'Fall Showdown entry', cat: 'Tournaments', item: 'Entry Fees',
    amount: 600, deposit_amount: 200, deposit_due_date: dayIn(-1, 15), deposit_paid_at: dayIn(-1, 14),
    balance_amount: 400, balance_due_date: dayIn(1, 10),
  };
  {
    const { data: existing } = await db.from('rep_team_expenses')
      .select('id, description, category, budget_item_id, budget_category_id')
      .eq('program_year_id', cur.id);
    const byDesc = new Map((existing ?? []).map(e => [e.description, e]));
    let added = 0, repaired = 0;

    const taxonomy = (e) => {
      const itemId = itemBy(e.cat, e.item);
      if (!itemId) die('expense item lookup', { message: `"${e.cat} / ${e.item}" is not in the starting library` });
      return { category: e.cat, budget_category_id: catBy[e.cat] ?? null, budget_item_id: itemId };
    };

    /* ⚠ Payables Rebuild P2: every commitment is seeded WITH its installments and payments — the
       legacy deposit/balance/paid columns are dead and nothing writes them. The repair path stays
       taxonomy-only: it never touches money, so it needs no records logic. */
    for (const e of EXPENSES) {
      const tax = taxonomy(e);
      const have = byDesc.get(e.desc);
      if (have) {
        if (have.budget_item_id !== tax.budget_item_id || have.category !== tax.category) {
          die('expense repair', (await db.from('rep_team_expenses').update(tax).eq('id', have.id)).error);
          repaired++;
        }
        continue;
      }
      await insertCommitmentWithRecords(db, {
        row: {
          program_year_id: cur.id, team_id: u13.id, org_id: org.id,
          expense_type: 'expense', description: e.desc, ...tax,
        },
        ...paidOnce(e.amount, e.paid),
      });
      added++;
    }

    const tax = taxonomy(PAYABLE);
    const havePayable = byDesc.get(PAYABLE.desc);
    if (havePayable) {
      if (havePayable.budget_item_id !== tax.budget_item_id) {
        die('payable repair', (await db.from('rep_team_expenses').update(tax).eq('id', havePayable.id)).error);
        repaired++;
      }
    } else {
      await insertCommitmentWithRecords(db, {
        row: {
          program_year_id: cur.id, team_id: u13.id, org_id: org.id,
          expense_type: 'tournament_payable', description: PAYABLE.desc, ...tax,
        },
        installments: [
          { amount: PAYABLE.deposit_amount, dueDate: PAYABLE.deposit_due_date },
          { amount: PAYABLE.balance_amount, dueDate: PAYABLE.balance_due_date },
        ],
        payments: [{ amount: PAYABLE.deposit_amount, paidDate: PAYABLE.deposit_paid_at, installmentNumber: 1 }],
      });
      added++;
    }
    ok(`expenses — 6 paid (one OVER plan, one UNBUDGETED on Events / Photo Day) + 1 payable; ${added} added, ${repaired} repaired`);
  }

  // ── dues: most paid, two families behind ─────────────────────────────────────────────────
  const { data: haveDues } = await db.from('rep_player_dues_schedules').select('id').eq('program_year_id', cur.id).limit(1);
  if (!haveDues?.length) {
    for (const [i, p] of roster.entries()) {
      const sched = await db.from('rep_player_dues_schedules').insert({
        program_year_id: cur.id, player_id: p.id, team_id: u13.id, org_id: org.id, total_amount: 650,
      }).select('id').single();
      die('dues schedule', sched.error);
      // Three instalments. The last two players (incl. one of the two siblings) are behind, so
      // "what does each family still owe?" has both a family in arrears and a sibling pair.
      const behind = i >= roster.length - 2 || i === 0;
      die('dues installments', (await db.from('rep_player_dues_installments').insert(
        [1, 2, 3].map(n => ({
          schedule_id: sched.data.id, player_id: p.id, installment_number: n,
          amount: n === 3 ? 216.66 : 216.67, due_date: dayIn(-5 + n * 2, 1),
          paid_at: behind && n === 3 ? null : dayIn(-5 + n * 2, 3),
          org_id: org.id, team_id: u13.id,
        })),
      )).error);
      // A paid stamp is only a coverage PROJECTION since mig 232 — the dollars every dues
      // reader shows live in rep_dues_payments. One payment per stamped instalment keeps the
      // fixture's Paid column, Collections tile and chase list telling the seeded story.
      const paidNs = [1, 2, 3].filter(n => !(behind && n === 3));
      if (paidNs.length) {
        die('dues payments', (await db.from('rep_dues_payments').insert(
          paidNs.map(n => ({
            program_year_id: cur.id, player_id: p.id, org_id: org.id, team_id: u13.id,
            amount: n === 3 ? 216.66 : 216.67, received_date: dayIn(-5 + n * 2, 3),
            method: 'etransfer', source: 'recorded',
          })),
        )).error);
      }
    }
    ok(`dues seeded — $650 × ${roster.length} in three instalments (payments backing every stamp); 3 families a payment behind`);
  } else note('dues already present');

  // ── a fundraiser with a leaderboard ──────────────────────────────────────────────────────
  const { data: haveFund } = await db.from('rep_fundraisers').select('id').eq('program_year_id', cur.id).limit(1);
  if (!haveFund?.length) {
    const f = await db.from('rep_fundraisers').insert({
      org_id: org.id, team_id: u13.id, program_year_id: cur.id,
      name: 'Spring Bottle Drive', description: 'Team bottle drive — 40% back to the player.',
      player_rebate_percent: 40, start_date: monthStart(-3), end_date: monthStart(-1), is_active: true,
    }).select('id').single();
    die('fundraiser', f.error);
    die('fundraiser entries', (await db.from('rep_fundraiser_entries').insert(
      roster.slice(0, 8).map((p, i) => ({
        fundraiser_id: f.data.id, org_id: org.id, team_id: u13.id, player_id: p.id,
        amount_raised: 120 - i * 12, rebate_percent: 40, rebate_amount: (120 - i * 12) * 0.4,
      })),
    )).error);
    ok('fundraiser seeded — 8 entries, an uneven leaderboard');
  } else note('fundraiser already present');

  // ── one pending payment request, so Allocations has something to cross-link to ────────────
  const { data: havePr } = await db.from('rep_team_payment_requests').select('id').eq('team_id', u13.id).limit(1);
  if (!havePr?.length) {
    die('payment request', (await db.from('rep_team_payment_requests').insert({
      // ⚠ A request belongs to a SEASON since mig 247 (NOT NULL).
      org_id: org.id, team_id: u13.id, program_year_id: cur.id, request_type: 'charge_to_org',
      amount: 450, description: 'Share of the spring dome block', status: 'pending',
      created_by: users[0].user.id,
    })).error);
    ok('payment request seeded (pending)');
  } else note('payment request already present');

  // ── the PRIOR season, so the months view has a prior-season column ───────────────────────
  //
  // ⚠ THIS IS ALSO THE ARCHIVE LEAK FIXTURE. The U13 is the only team here with a completed season
  // AND a live one, so it is the only place a reader can prove that opening the finished year shows
  // THAT year's money rather than this year's. Its figures are deliberately unlike the live
  // season's, so a leak is recognisable on sight rather than requiring arithmetic.
  //
  // ⚠ The "last season only" category moved from Fundraising to TRAVEL on 2026-08-16, because
  // Fundraising now exists in the live season too (it carries the bottle drive's proceeds and its
  // printing). The beat the ledger asks you to look for is unchanged; only the word is.
  //
  // ⚠ Items here as well (mig 240) — an archived season rendering "Not itemized" rows would make
  // the read-only check unreadable, and the leak check is about recognising figures at a glance.
  const PREV = [
    { cat: 'Tournaments', item: 'Entry Fees',    desc: 'Tournament entry fees',  total: 2100 },
    { cat: 'Team Gear',   item: 'Jerseys',       desc: 'Uniform order',          total: 1600 },
    { cat: 'Travel',      item: 'Accommodation', desc: 'Provincials hotel block', total: 250 },
  ];
  {
    const { data: existingLines } = await db.from('rep_budget_lines')
      .select('id, description, category_id, item_id').eq('program_year_id', prev.id);
    const { data: existingExp } = await db.from('rep_team_expenses')
      .select('id, description, category, budget_item_id').eq('program_year_id', prev.id);
    const lineBy = new Map((existingLines ?? []).map(l => [l.description, l]));
    const expBy = new Map((existingExp ?? []).map(e => [e.description, e]));
    let added = 0, repaired = 0;

    for (const [i, l] of PREV.entries()) {
      const itemId = itemBy(l.cat, l.item);
      if (!itemId) die('prior item lookup', { message: `"${l.cat} / ${l.item}" is not in the starting library` });
      const shape = {
        category_id: catBy[l.cat] ?? null, item_id: itemId,
        description: l.desc, total_amount: l.total, line_kind: 'cost', sort_order: i,
      };
      const haveLine = lineBy.get(l.desc);
      if (haveLine) {
        if (haveLine.item_id !== itemId || haveLine.category_id !== shape.category_id) {
          die('prev line repair', (await db.from('rep_budget_lines').update(shape).eq('id', haveLine.id)).error);
          repaired++;
        }
      } else {
        die('prev budget line', (await db.from('rep_budget_lines').insert({
          org_id: org.id, team_id: u13.id, program_year_id: prev.id, ...shape,
        })).error);
        added++;
      }

      const tax = { category: l.cat, budget_category_id: catBy[l.cat] ?? null, budget_item_id: itemId };
      const haveExp = expBy.get(l.desc);
      if (haveExp) {
        if (haveExp.budget_item_id !== itemId || haveExp.category !== l.cat) {
          die('prev expense repair', (await db.from('rep_team_expenses').update(tax).eq('id', haveExp.id)).error);
          repaired++;
        }
      } else {
        const paidDay = dayIn(-13 + i, 10);
        await insertCommitmentWithRecords(db, {
          row: {
            program_year_id: prev.id, team_id: u13.id, org_id: org.id,
            expense_type: 'expense', description: l.desc, ...tax,
          },
          ...paidOnce(l.total - 50, paidDay),
        });
        added++;
      }
    }
    // The retired Fundraising line and its cost — the category is a live-season one now.
    for (const stale of (existingLines ?? []).filter(l => l.description === 'Bottle drive supplies')) {
      await db.from('rep_budget_periods').delete().eq('budget_line_id', stale.id);
      die('retire prev fundraising line', (await db.from('rep_budget_lines').delete().eq('id', stale.id)).error);
      repaired++;
    }
    for (const stale of (existingExp ?? []).filter(e => e.description === 'Bottle drive supplies')) {
      die('retire prev fundraising cost', (await db.from('rep_team_expenses').delete().eq('id', stale.id)).error);
    }
    ok(`prior season — 3 lines incl. ONE category (Travel) that exists only last season; ${added} added, ${repaired} repaired`);
  }

  // ═══ TEAM B — deliberately EMPTY, for the budget starter ═════════════════════════════════
  const u11 = await makeTeam('QA Money U11', 'qa-money-u11', 'U11');
  const curB = await makeYear(u11, yr, 'active');
  await assignStaff(u11, curB);
  await makeRoster(u11, curB, ['Nia', 'Omar', 'Pia', 'Quinn', 'Rex', 'Sol', 'Tam', 'Uma', 'Vik', 'Wren']);
  const { data: bLines } = await db.from('rep_budget_lines').select('id').eq('program_year_id', curB.id).limit(1);
  const { data: bDues } = await db.from('rep_player_dues_schedules').select('id').eq('program_year_id', curB.id).limit(1);
  if (bLines?.length || bDues?.length) {
    note('⚠ U11 has money data — the starter\'s first-run card needs it EMPTY. Clearing.');
    await db.from('rep_budget_lines').delete().eq('program_year_id', curB.id);
    await db.from('rep_player_dues_schedules').delete().eq('program_year_id', curB.id);
  }
  ok('U11 confirmed EMPTY — no budget, no dues (the starter\'s first-run state)');

  // ═══ TEAM C — season's END: the refunds-review portal (owner ruling 2026-08-13) ═══════════
  // The owner is redesigning the Season Refund Calculator and wants REAL numbers to reason
  // against: budget mostly exhausted, money left over, and fundraising that varies family by
  // family. Everything here is chosen so the refund arithmetic has texture:
  //   · dues $600 × 10, three instalments, ALL past due and all paid (payments behind every
  //     stamp — mig 232), so "collections are done" is true on every screen;
  //   · ONE family overpaid by $50 → an 'overpayment' credit (cash the books actually hold);
  //   · a closed fundraiser, $2,500 raised at 25% back → fundraiser credits from $0 to $170 —
  //     two families raised nothing, one raised $680;
  //   · budget $7,000, paid spending $6,350 — exhausted enough to feel real, ~$1,500-ish of
  //     real cash left when dues + team-kept fundraising are netted against spending.
  const u15 = await makeTeam('QA Season End U15', 'qa-season-end-u15', 'U15');
  const curC = await makeYear(u15, yr, 'active');
  await assignStaff(u15, curC);
  const rosterC = await makeRoster(u15, curC, ['Noor', 'Owen', 'Pax', 'Quil', 'Rhea', 'Sef', 'Tia', 'Umar', 'Vera', 'Wynn']);

  const { data: haveC } = await db.from('rep_player_dues_schedules').select('id').eq('program_year_id', curC.id).limit(1);
  if (!haveC?.length) {
    // Budget — five undated lines totalling $7,000 (the story is the season already spent).
    const LINES_C = [
      { cat: 'Tournaments', desc: 'Tournament entry fees', total: 3000 },
      { cat: 'Facilities',  desc: 'Diamond and dome time', total: 1500 },
      { cat: 'Team Gear',   desc: 'Uniforms and equipment', total: 1200 },
      { cat: 'Officials',   desc: 'Umpires',                total: 800 },
      { cat: 'Training',    desc: 'Winter training block',  total: 500 },
    ];
    for (const [i, l] of LINES_C.entries()) {
      die('C budget line', (await db.from('rep_budget_lines').insert({
        org_id: org.id, team_id: u15.id, program_year_id: curC.id,
        category_id: catBy[l.cat] ?? null, description: l.desc, total_amount: l.total, sort_order: i,
      })).error);
    }
    // Spending — all PAID, $6,350 of the $7,000 plan.
    const SPENT_C = [
      { desc: 'Spring tournament entries', cat: 'Tournaments', amount: 1500, paid: dayIn(-5, 10) },
      { desc: 'Summer tournament entries', cat: 'Tournaments', amount: 1400, paid: dayIn(-3, 9) },
      { desc: 'Diamond and dome time',     cat: 'Facilities',  amount: 1450, paid: dayIn(-4, 6) },
      { desc: 'Uniforms and equipment',    cat: 'Team Gear',   amount: 1100, paid: dayIn(-6, 18) },
      { desc: 'Umpires — season',          cat: 'Officials',   amount: 500,  paid: dayIn(-2, 12) },
      { desc: 'Winter training block',     cat: 'Training',    amount: 400,  paid: dayIn(-7, 15) },
    ];
    for (const e of SPENT_C) {
      await insertCommitmentWithRecords(db, {
        row: {
          program_year_id: curC.id, team_id: u15.id, org_id: org.id,
          expense_type: 'expense', description: e.desc, category: e.cat,
        },
        ...paidOnce(e.amount, e.paid),
      });
    }

    // Dues — $600 in three $200 instalments, every due date in the PAST, everyone fully paid,
    // every stamp backed by a payment (mig 232). Umar's family (index 7) sent $250 for the last
    // one — the $50 excess sits as an overpayment credit, the cash-backed credit type.
    const dueC = [dayIn(-5, 15), dayIn(-3, 15), dayIn(-1, 15)];
    const recvC = [dayIn(-5, 12), dayIn(-3, 12), dayIn(-1, 12)];
    for (const [i, p] of rosterC.entries()) {
      const sched = await db.from('rep_player_dues_schedules').insert({
        program_year_id: curC.id, player_id: p.id, team_id: u15.id, org_id: org.id, total_amount: 600,
      }).select('id').single();
      die('C dues schedule', sched.error);
      die('C dues installments', (await db.from('rep_player_dues_installments').insert(
        [0, 1, 2].map(n => ({
          schedule_id: sched.data.id, player_id: p.id, installment_number: n + 1,
          amount: 200, due_date: dueC[n], paid_at: `${recvC[n]}T17:00:00.000Z`,
          org_id: org.id, team_id: u15.id,
        })),
      )).error);
      die('C dues payments', (await db.from('rep_dues_payments').insert(
        [0, 1, 2].map(n => ({
          program_year_id: curC.id, player_id: p.id, org_id: org.id, team_id: u15.id,
          amount: i === 7 && n === 2 ? 250 : 200, received_date: recvC[n],
          method: 'etransfer', source: 'recorded',
        })),
      )).error);
    }
    die('C overpayment credit', (await db.from('rep_dues_credits').insert({
      program_year_id: curC.id, player_id: rosterC[7].id,
      amount: 50, description: 'Overpayment', credit_type: 'overpayment', credit_date: recvC[2],
    })).error);

    // Fundraiser — closed, 25% back to the player, raised amounts all over the map. The credits
    // are written the authoritative direction (entry first, credit carrying fundraiser_entry_id,
    // then the entry's credit_id back-filled) so the leaderboard and the dues screen agree.
    const RAISED_C = [0, 0, 60, 120, 180, 240, 300, 420, 500, 680];
    const f = await db.from('rep_fundraisers').insert({
      org_id: org.id, team_id: u15.id, program_year_id: curC.id,
      name: 'Cookie Dough Drive', description: 'Season fundraiser — 25% back to the player.',
      player_rebate_percent: 25, start_date: monthStart(-6), end_date: monthStart(-2), is_active: false,
    }).select('id').single();
    die('C fundraiser', f.error);
    for (const [i, p] of rosterC.entries()) {
      if (RAISED_C[i] <= 0) continue;
      const rebate = Math.round(RAISED_C[i] * 25) / 100;
      const entry = await db.from('rep_fundraiser_entries').insert({
        fundraiser_id: f.data.id, org_id: org.id, team_id: u15.id, player_id: p.id,
        amount_raised: RAISED_C[i], rebate_percent: 25, rebate_amount: rebate,
      }).select('id').single();
      die('C fundraiser entry', entry.error);
      const credit = await db.from('rep_dues_credits').insert({
        program_year_id: curC.id, player_id: p.id,
        amount: rebate, description: 'Fundraiser rebate — Cookie Dough Drive',
        credit_type: 'fundraiser', credit_date: monthStart(-2),
        fundraiser_entry_id: entry.data.id,
      }).select('id').single();
      die('C fundraiser credit', credit.error);
      die('C entry credit link', (await db.from('rep_fundraiser_entries')
        .update({ credit_id: credit.data.id }).eq('id', entry.data.id)).error);
    }
    ok('SEASON END U15 seeded — dues settled ($6,050 in incl. one $50 overpay), $6,350 of $7,000 spent, fundraiser credits $0–$170');
  } else note('season-end team already present');

  // ═══ TEAM D — MID-season: credits meet the bills (plan §9.1) ═══════════════════════════════
  // The U15 fixture cannot tell the new credit model from the old one — every family there paid
  // in full BEFORE the drive closed, so all $675 lands in owed-back and nothing exercises the
  // applied / paid-out distinction. This team is the drive-closed-MID-season world, one player
  // per rule the model has to get right:
  //   · Ash   — paid the WHOLE season in cash before the drive closed; their $150 rebate finds
  //             no bill to lower and is owed back (cash-claims-first, the self-correcting rule);
  //   · Blair — on schedule in cash; $250 rebate: #4 reads "Covered by fundraising", #3 asks
  //             $150 to send (last_first application + the cascade);
  //   · Cam   — $100 into instalment #1, behind, no fundraising (part-paid + overdue stays
  //             honest beside the credit rows);
  //   · Drew  — has paid NOTHING but earned an $80 rebate: still a chase target, and every
  //             reminder must ask for the LOWERED amounts, never the gross;
  //   · Em    — paid #1 then stopped; the balance was FORGIVEN (credit_type 'forgiven', $600):
  //             bills read covered, reminders stop, and season's end owes them nothing;
  //   · Fin   — DEPARTED (status 'released') after paying #1–#2, with a $120 rebate: their
  //             owed-back money follows them out (owner Call 8 — it is their money);
  //   · Gio, Hal — plain on-schedule rows, so the ordinary case stays visible.
  const u14 = await makeTeam('QA Mid Season U14', 'qa-mid-season-u14', 'U14');
  const curD = await makeYear(u14, yr, 'active');
  await assignStaff(u14, curD);
  await makeRoster(u14, curD, ['Ash', 'Blair', 'Cam', 'Drew', 'Em', 'Fin', 'Gio', 'Hal']);
  // ⚠ RE-READ INCLUDING INACTIVE PLAYERS. `makeRoster` returns only ACTIVE ones, and this team
  // deliberately has a departed player — so on the second run the list came back one short and
  // every index after it pointed at the wrong family (the seeder crashed on the eighth). The
  // cast list below is index-addressed, so it must read the whole roster, in its own order.
  const rosterD = (await db.from('rep_roster_players').select('id, player_first_name')
    .eq('program_year_id', curD.id).order('display_order')).data ?? [];

  const { data: haveD } = await db.from('rep_player_dues_schedules').select('id').eq('program_year_id', curD.id).limit(1);
  if (!haveD?.length) {
    // Fin departed — and ONLY Fin. Asserted both ways rather than just flipping one row, so a
    // half-finished earlier run can never leave extra players inactive: the seeder's contract is
    // to return the team to a known world, not to apply a delta to whatever it finds.
    // ⚠ The DB CHECK allows only active|inactive ('released' exists in the TS union but not in
    // the constraint — drift, recorded in the plan; do not "fix" it from a seeder).
    die('D depart Fin', (await db.from('rep_roster_players')
      .update({ status: 'inactive' }).eq('id', rosterD[5].id)).error);
    die('D restore the rest', (await db.from('rep_roster_players')
      .update({ status: 'active' })
      .eq('program_year_id', curD.id)
      .neq('id', rosterD[5].id)).error);

    // A modest budget + some paid spending so the Money screens have ground under them.
    for (const [i, l] of [
      { cat: 'Tournaments', desc: 'Tournament entry fees', total: 2600 },
      { cat: 'Facilities',  desc: 'Diamond time',          total: 1400 },
      { cat: 'Team Gear',   desc: 'Uniforms',              total: 1000 },
    ].entries()) {
      die('D budget line', (await db.from('rep_budget_lines').insert({
        org_id: org.id, team_id: u14.id, program_year_id: curD.id,
        category_id: catBy[l.cat] ?? null, description: l.desc, total_amount: l.total, sort_order: i,
      })).error);
    }
    for (const e of [
      { desc: 'Spring tournament entries', cat: 'Tournaments', amount: 1300, paid: dayIn(-3, 8) },
      { desc: 'Diamond time — spring',     cat: 'Facilities',  amount: 700,  paid: dayIn(-2, 14) },
      { desc: 'Uniforms',                  cat: 'Team Gear',   amount: 950,  paid: dayIn(-4, 20) },
    ]) {
      await insertCommitmentWithRecords(db, {
        row: {
          program_year_id: curD.id, team_id: u14.id, org_id: org.id,
          expense_type: 'expense', description: e.desc, category: e.cat,
        },
        ...paidOnce(e.amount, e.paid),
      });
    }

    // Dues — $800 in four $200 instalments: #1–#2 past due, #3–#4 still AHEAD, so credits have
    // real future bills to land on. Cash per the cast above; stamps only where cash covers.
    const dueD  = [dayIn(-3, 15), dayIn(-2, 15), dayIn(1, 15), dayIn(2, 15)];
    const recvD = [dayIn(-3, 12), dayIn(-2, 12)];
    // [player index] → cash payments as [amount, receivedDate][]
    const CASH_D = [
      [[800, recvD[0]]],                        // Ash — whole season, early
      [[200, recvD[0]], [200, recvD[1]]],       // Blair
      [[100, recvD[0]]],                        // Cam — part of #1, then silence
      [],                                       // Drew — nothing
      [[200, recvD[0]]],                        // Em — #1 then stopped (rest forgiven below)
      [[200, recvD[0]], [200, recvD[1]]],       // Fin — paid to departure
      [[200, recvD[0]], [200, recvD[1]]],       // Gio
      [[200, recvD[0]], [200, recvD[1]]],       // Hal
    ];
    for (const [i, p] of rosterD.entries()) {
      const sched = await db.from('rep_player_dues_schedules').insert({
        program_year_id: curD.id, player_id: p.id, team_id: u14.id, org_id: org.id, total_amount: 800,
      }).select('id').single();
      die('D dues schedule', sched.error);
      const cashTotal = CASH_D[i].reduce((s, [a]) => s + a, 0);
      die('D dues installments', (await db.from('rep_player_dues_installments').insert(
        [0, 1, 2, 3].map(n => ({
          schedule_id: sched.data.id, player_id: p.id, installment_number: n + 1,
          amount: 200, due_date: dueD[n],
          // Stamp = full-coverage projection over CASH (mig 232): oldest-first at $200 each.
          paid_at: cashTotal >= (n + 1) * 200 ? `${(CASH_D[i][CASH_D[i].length - 1] ?? [null, recvD[0]])[1]}T17:00:00.000Z` : null,
          org_id: org.id, team_id: u14.id,
        })),
      )).error);
      if (CASH_D[i].length) {
        die('D dues payments', (await db.from('rep_dues_payments').insert(
          CASH_D[i].map(([amount, received]) => ({
            program_year_id: curD.id, player_id: p.id, org_id: org.id, team_id: u14.id,
            amount, received_date: received, method: 'etransfer', source: 'recorded',
          })),
        )).error);
      }
    }

    // Em's forgiveness — debt relief, never owed back, never paid out (mig 233).
    die('D forgiveness', (await db.from('rep_dues_credits').insert({
      program_year_id: curD.id, player_id: rosterD[4].id,
      amount: 600, description: 'Balance forgiven', credit_type: 'forgiven', credit_date: dayIn(-1, 5),
    })).error);

    // Bottle Drive — closed LAST month at 50% back, so its credits land on the open bills.
    const RAISED_D = [300, 500, 0, 160, 0, 240, 0, 0];
    const fd = await db.from('rep_fundraisers').insert({
      org_id: org.id, team_id: u14.id, program_year_id: curD.id,
      name: 'Bottle Drive', description: 'Spring fundraiser — 50% back to the player.',
      player_rebate_percent: 50, start_date: monthStart(-3), end_date: monthStart(-1), is_active: false,
    }).select('id').single();
    die('D fundraiser', fd.error);
    for (const [i, p] of rosterD.entries()) {
      if (RAISED_D[i] <= 0) continue;
      const rebate = Math.round(RAISED_D[i] * 50) / 100;
      const entry = await db.from('rep_fundraiser_entries').insert({
        fundraiser_id: fd.data.id, org_id: org.id, team_id: u14.id, player_id: p.id,
        amount_raised: RAISED_D[i], rebate_percent: 50, rebate_amount: rebate,
      }).select('id').single();
      die('D fundraiser entry', entry.error);
      const credit = await db.from('rep_dues_credits').insert({
        program_year_id: curD.id, player_id: p.id,
        amount: rebate, description: 'Fundraiser rebate — Bottle Drive',
        credit_type: 'fundraiser', credit_date: monthStart(-1),
        fundraiser_entry_id: entry.data.id,
      }).select('id').single();
      die('D fundraiser credit', credit.error);
      die('D entry credit link', (await db.from('rep_fundraiser_entries')
        .update({ credit_id: credit.data.id }).eq('id', entry.data.id)).error);
    }
    // ── Pass 2: money going the other way ──────────────────────────────────────────────────
    // Ash paid the whole season in cash before the drive closed, so their $150 rebate found no
    // bill to lower — the ideal candidate to hand back. HALF of it goes out, deliberately: a
    // partial payout is the case where "the remainder keeps covering bills" is visible, and it
    // leaves owed-back money on the row so the Pay out button is still offered.
    const ashPayout = await db.from('rep_dues_payouts').insert({
      program_year_id: curD.id, player_id: rosterD[0].id, org_id: org.id, team_id: u14.id,
      amount: 75, paid_date: dayIn(0, 3), method: 'etransfer',
      note: 'Half the bottle-drive rebate, by request', source: 'recorded',
    });
    die('D payout', ashPayout.error);

    // Gio's family bought the team pizza: the cost counts in the budget, NO team cash moved,
    // and the team now owes them $120 as a reimbursement credit.
    // ⚠ Created ALREADY PAID and linked to its credit, exactly as the app writes it: the family
    // settled it (so it counts in the budget at once, with no cash entry), and the credit carries
    // expense_id so removing the expense removes the debt it created.
    const pizzaId = await insertCommitmentWithRecords(db, {
      row: {
        program_year_id: curD.id, team_id: u14.id, org_id: org.id,
        expense_type: 'expense', description: 'Team pizza night', category: 'Events',
        budget_category_id: catBy['Events'] ?? null, budget_item_id: itemBy('Events', 'Banquet'),
        paid_by_player_id: rosterD[6].id,
      },
      // ⚠ Its payment carries NO accounting entry, ever — the family's money moved, the team's
      // did not (mig 234); `paidOnce` leaves the entry null, which is exactly right here.
      ...paidOnce(120, dayIn(0, 6)),
    });
    die('D reimbursement credit', (await db.from('rep_dues_credits').insert({
      program_year_id: curD.id, player_id: rosterD[6].id, expense_id: pizzaId,
      amount: 120, description: 'Paid out of pocket — Team pizza night',
      credit_type: 'reimbursement', credit_date: dayIn(0, 6),
    })).error);

    ok('MID SEASON U14 seeded — applied/owed-back/forgiven/departed/paid-out/out-of-pocket all live');
  } else note('mid-season team already present');

  // ⚠⚠ THE OUT-OF-POCKET COST HAS TO NAME AN ITEM (mig 240), because it is one half of the pair
  // the money-back work turns on: a coach describes BOTH "a family paid the vendor directly" and
  // "the team got money back" as *"a parent paid me back"*, and they are opposites — one leaves the
  // team owing that family a credit, the other owes nobody. Testing them against each other means
  // filing MONEY BACK against the same item this cost names, so an item-less cost makes the pair
  // untestable. Repaired outside the block above, which is skipped once the team exists.
  {
    const { data: pizza } = await db.from('rep_team_expenses')
      .select('id, budget_item_id').eq('team_id', u14.id).eq('description', 'Team pizza night').maybeSingle();
    const banquet = itemBy('Events', 'Banquet');
    if (pizza && banquet && pizza.budget_item_id !== banquet) {
      die('pizza item repair', (await db.from('rep_team_expenses')
        .update({ budget_category_id: catBy['Events'] ?? null, budget_item_id: banquet })
        .eq('id', pizza.id)).error);
      ok('out-of-pocket cost repaired onto Events / Banquet — the money-back pair is testable');
    }
  }

  /* ⚖ TWO END-OF-LAB SWEEPS RETIRED (Payables Rebuild P2). The paid-stamp reshape corrected the
     legacy `expense_paid_at` shape, and the backfill derived installments and payments from the
     legacy columns — both of which are dead: nothing writes those columns, every commitment above
     is seeded WITH its records through `insertCommitmentWithRecords`, and a deriver pointed at the
     stale columns would now overwrite real payments with a fiction. This lab is still the fixture
     owner QA §64 is walked against; the records the walk reads are seeded directly. */

  console.log('');
  console.log(`  Org            /${MONEY.slug}`);
  for (const u of users) {
    const label = u.caps === null ? 'head coach — full money' :
      u.caps.money === 'read' ? 'assistant — money READ only' :
      u.caps.money === 'off' ? 'assistant — money OFF' : 'assistant — money write, NO contacts';
    console.log(`  ${u.email.padEnd(30)} ${MONEY.password}   ${label}`);
  }
  console.log(`  ${MONEY.admin.email.padEnd(30)} ${MONEY.password}   ORG ADMIN — on no team (item publishing)`);
  console.log(`  Data-rich team  QA Money U13  → /${MONEY.slug}/coaches/teams/${u13.id}`);
  console.log(`     ·  plan $8,500 across 7 cost lines (TWO on Entry Fees) + $2,000 expected fundraising`);
  console.log(`     ·  spent $4,380, incl. $180 on Events / Photo Day that nobody budgeted`);
  console.log(`     ·  a COMPLETED ${yr - 1} season behind it — the archive leak check`);
  console.log(`  Empty team      QA Money U11  → /${MONEY.slug}/coaches/teams/${u11.id}`);
  console.log(`  Season's end    QA Season End U15 → /${MONEY.slug}/coaches/teams/${u15.id}  (refund review)`);
  console.log(`  Mid-season      QA Mid Season U14 → /${MONEY.slug}/coaches/teams/${u14.id}  (credits meet bills)`);
  console.log(`     ·  Gio's family holds ONE $120 reimbursement credit — the money-back pair's other half`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// PRACTICE RUN SHEETS — the fixture the printed practice plan is judged on (QA §89)
// ═══════════════════════════════════════════════════════════════════════════════════════════
//
// Six practices on QA Money U13, one per case the run-sheet design has to survive. They exist
// because the sheet's failures are all SHAPE failures — a grid that shreds a name, a block that
// runs off the bottom, a rotation that silently disappears — and none of them are visible on a
// tidy three-block practice. Every one of these is a state a real coach can reach.
//
//   1 · a typical night      the everyday case: one rotation, focus areas, fits a page
//   2 · a heavy night        seven blocks, TWO rotations, long prose → pages 2+ and the
//                            honest-arithmetic sentences ("Group A won't reach…")
//   3 · unfinished rotations two ways for a rotation to be half-built — the case that used to
//                            print NOTHING AT ALL for that block
//   4 · twelve groups        the coach's own group names are the widest headings in the product;
//                            the grid has to turn on its side rather than cut one
//   5 · one enormous block   a block taller than a whole page: it cannot move whole to a page it
//                            still won't fit, so it flows — and must not split a sentence
//   6 · the bare minimum     no goal, no equipment, no notes: the facts block must be ABSENT,
//                            not an empty band, and empty notes must cost no vertical space
//
// ⚠ Print each one from Schedule → the practice → "Print the sheet". Sign in as the head coach
// for the full sheet; sign in as `qa-money-off@dev.local` (an assistant, whose defaults include
// schedule but NOT notes) to see the same sheets with "What everyone's working on" ABSENT.
//
// Idempotent: every practice is looked up by name and its plan rewritten in place.
async function seedPracticeSheets() {
  head('Practice run sheets — QA Money U13');

  const org = (await db.from('organizations').select('id, slug').eq('slug', MONEY.slug).maybeSingle()).data;
  if (!org) {
    console.error(`✗ ${MONEY.slug} does not exist yet — run this script with --money first.`);
    process.exit(1);
  }
  const team = (await db.from('rep_teams').select('id, name').eq('org_id', org.id).eq('name', 'QA Money U13').maybeSingle()).data;
  if (!team) {
    console.error('✗ QA Money U13 does not exist yet — run this script with --money first.');
    process.exit(1);
  }
  const year = (await db.from('rep_program_years').select('id, name')
    .eq('team_id', team.id).eq('status', 'active').maybeSingle()).data;
  if (!year) { console.error('✗ QA Money U13 has no active program year.'); process.exit(1); }

  const { data: roster } = await db.from('rep_roster_players')
    .select('id, player_first_name, player_last_name')
    .eq('program_year_id', year.id)
    .eq('status', 'active')
    .order('display_order');
  if (!roster?.length) { console.error('✗ QA Money U13 has no roster.'); process.exit(1); }
  const pid = (n) => roster[n % roster.length].id;
  const some = (from, count) => Array.from({ length: count }, (_, k) => pid(from + k));

  // ── Focus areas, so "What everyone's working on" has something to print ──────────────────
  //
  // ⚠ Deliberately UNEVEN lengths. The section lays a name against wrapped prose, so a fixture
  // where every line is the same width proves nothing about the one that wraps to three.
  // ⚠ Capped at 80 characters by the column itself, so the long line on the sheet comes from a
  // player holding TWO focus areas — which is also how a real roster produces one. Deliberately
  // uneven: a fixture where every line is the same width proves nothing about the one that wraps.
  const FOCUS = [
    [0, 'Backhand pickups — glove out front, working through the ball'],
    [0, 'Two-strike approach: put it in play rather than drive it'],
    [1, 'First-step quickness on steals; read the pitcher\u2019s front heel'],
    [2, 'Changeup command — same arm speed, don\u2019t baby it'],
    [3, 'Tracking fly balls over the shoulder: drop step, run to the spot'],
    [4, 'Bunt placement up the first-base line'],
    [5, 'Staying down on backhand plays'],
    [5, 'Steal jumps against a live catcher, not a coach'],
  ];
  {
    const { data: have } = await db.from('rep_player_development_goals')
      .select('id').eq('team_id', team.id).limit(1);
    if (have?.length) {
      note('focus areas already present — left as they are');
    } else {
      const rows = FOCUS.map(([who, focusArea]) => ({
        org_id: org.id, team_id: team.id, player_id: pid(who),
        focus_area: focusArea, status: 'working',
      }));
      die('focus areas', (await db.from('rep_player_development_goals').insert(rows)).error);
      ok(`${rows.length} focus areas across ${new Set(FOCUS.map(f => f[0])).size} players (two hold two, so one line wraps)`);
    }
  }

  // ── Plan-building helpers ────────────────────────────────────────────────────────────────
  let seq = 0;
  const uid = (p) => `${p}${++seq}`;
  const station = (name, extra = {}) => ({ id: uid('s'), name, ...extra });
  const groups = (names, per) => names.map((name, i) => ({
    id: uid('g'), name, playerIds: some(i * per, per),
  }));
  const rotation = (interval, gs) => ({ intervalMinutes: interval, groups: gs, groupSource: 'manual' });
  const block = (title, minutes, extra = {}) => ({
    id: uid('b'), title, duration: { minutes }, ...extra,
  });

  // "What this practice is about" is a real tag pick (owner ruling 2026-08-01), not free text —
  // so the fixture has to create the same `rep_team_tags` / `rep_team_event_tags` rows the live
  // TagPicker would, rather than embedding a `practiceTypes` string list in the plan jsonb. That
  // legacy field only still exists to keep pre-tags plans matching the focus rail; a fixture
  // written today must not manufacture new plans in the shape it replaced.
  const tagCache = new Map();
  async function focusTagId(tagName) {
    const key = tagName.toLowerCase();
    if (tagCache.has(key)) return tagCache.get(key);
    const existing = (await db.from('rep_team_tags').select('id')
      .eq('team_id', team.id).eq('kind', 'focus').ilike('name', tagName).maybeSingle()).data;
    let id = existing?.id;
    if (!id) {
      const ins = await db.from('rep_team_tags')
        .insert({ org_id: org.id, team_id: team.id, kind: 'focus', name: tagName })
        .select('id').single();
      die(`create focus tag ${tagName}`, ins.error);
      id = ins.data.id;
    }
    tagCache.set(key, id);
    return id;
  }

  /** Create-or-update one practice, stamp its plan, and re-point its focus tags. */
  async function practice(name, { dayOffset, startHour, minutes, location, field, arrive, plan, focusTags }) {
    const start = new Date();
    start.setDate(start.getDate() + dayOffset);
    start.setHours(startHour, 0, 0, 0);
    const end = new Date(start.getTime() + minutes * 60_000);
    const fields = {
      program_year_id: year.id, team_id: team.id, org_id: org.id,
      event_type: 'practice', name,
      starts_at: start.toISOString(), ends_at: end.toISOString(),
      location, field_number: field, arrival_time: arrive,
      practice_plan: plan,
    };
    const existing = (await db.from('rep_team_events').select('id')
      .eq('program_year_id', year.id).eq('name', name).maybeSingle()).data;
    let eventId;
    if (existing) {
      die(`${name} refresh`, (await db.from('rep_team_events').update(fields).eq('id', existing.id)).error);
      ok(`${name} — re-anchored and plan rewritten`);
      eventId = existing.id;
    } else {
      const ins = await db.from('rep_team_events').insert(fields).select('id').single();
      die(`${name} insert`, ins.error);
      ok(`${name} — created`);
      eventId = ins.data.id;
    }
    // Re-run must not accumulate stale links, and a practice never carries a 'game'-kind tag, so
    // clearing every link on the event before re-adding is safe here (unlike the app's own
    // kind-scoped writer, which has a game-tag sibling on the same table to avoid disturbing).
    die(`clear focus tags for ${name}`, (await db.from('rep_team_event_tags').delete().eq('event_id', eventId)).error);
    if (focusTags?.length) {
      const tagIds = await Promise.all(focusTags.map(focusTagId));
      die(`link focus tags for ${name}`, (await db.from('rep_team_event_tags')
        .insert(tagIds.map(tag_id => ({ event_id: eventId, tag_id })))).error);
    }
    return eventId;
  }

  const WHERE = { location: 'Riverdale Park', field: 'Diamond 2', arrive: '5:45 PM' };

  // ── 1 · A TYPICAL NIGHT ──────────────────────────────────────────────────────────────────
  await practice('Practice — a typical night', {
    dayOffset: 2, startHour: 18, minutes: 90, ...WHERE,
    focusTags: ['Hitting', 'Baserunning'],
    plan: {
      version: 1,
      goal: 'Sharper two-strike at-bats; defensive communication loud enough to hear from the fence.',
      equipment: ['Tees (4)', 'Bucket of game balls', 'Cones', 'Stopwatch'],
      blocks: [
        block('Dynamic warm-up & arm care', 10, {
          staff: ['Coach Dana'], playerIds: some(0, 12),
          description: 'Bands before anyone touches a ball. Throwing starts at 30 ft — anyone who pitched Sunday caps at 60 ft, no long toss.',
        }),
        // ⚠ Deliberately empty: an untouched block must cost NO vertical space on the sheet.
        block('Throwing progression', 10, { staff: ['Coach Dana'], playerIds: some(0, 12) }),
        block('Hitting circuit — 3 stations', 30, {
          staff: ['All staff'],
          description: 'Rotate on the whistle, ten minutes a station.',
          coachingPoints: ['Contact point out front on the tee', 'Two-strike approach on front toss'],
          stations: [
            station('Tee work', { description: 'Inside pitch only; top hand drives through.', setup: 'Two tees down the line', equipment: ['Tees (4)'] }),
            station('Front toss', { description: 'Choke up, shorten up, anything close gets a swing.', goal: 'Contact rate over exit speed' }),
            station('Live BP', { description: 'Runners on first; contact swings only.', staff: ['Coach Priya'] }),
          ],
          // 30 min ÷ 10 = three rounds, three stations: every group reaches every station.
          rotation: rotation(10, groups(['Group A', 'Group B', 'Group C'], 4)),
        }),
        block('First-to-third reads', 20, {
          staff: ['Coach Priya'], playerIds: some(0, 12),
          description: 'Live reads off front toss. Freeze on a line drive; on a ground ball read the outfielder’s angle, not the coach.',
        }),
        block('Scrimmage innings', 20, {
          staff: ['All staff'], playerIds: some(0, 12),
          description: 'Situations: runner on 2nd, one out, infield in.',
        }),
      ],
    },
  });

  // ── 2 · A HEAVY NIGHT ────────────────────────────────────────────────────────────────────
  //
  // ⚠ The SECOND rotation is the point: 20 minutes over three stations at a 10-minute interval
  // is TWO rounds, so one group never reaches the third station. The sheet has to say so in a
  // sentence under the grid — that statement is the artifact a plain document cannot produce.
  await practice('Practice — a heavy night', {
    dayOffset: 4, startHour: 18, minutes: 115, ...WHERE,
    focusTags: ['Hitting', 'Baserunning', 'Defense'],
    plan: {
      version: 1,
      goal: 'Two-strike at-bats, and defensive communication loud enough to hear from the fence.',
      equipment: ['Tees (4)', 'Bucket of game balls', 'Soft-toss bucket', 'Cones (12)', 'L-screen', 'Stopwatch', 'Catcher gear ×2', 'First-aid kit'],
      blocks: [
        block('Dynamic warm-up & arm care', 10, {
          staff: ['Coach Dana'], playerIds: some(0, 12),
          description: 'Bands before anyone touches a ball. Throwing starts at 30 ft — anyone who pitched Sunday caps at 60 ft, no long toss.',
          coachingPoints: ['Bands before gloves', 'Nobody skips the last two throws'],
        }),
        block('Throwing progression', 10, {
          staff: ['Coach Dana'], playerIds: some(0, 12),
          description: 'Quick feet into the throw. Watch the arm slot when anyone rushes — one cue tonight, not a rebuild.',
        }),
        block('Hitting circuit — 3 stations', 30, {
          staff: ['All staff'],
          description: 'Rotate on the whistle, ten minutes a station. Every station is a different question, so nobody gets thirty minutes of the same swing.',
          coachingPoints: ['Contact point out front', 'Two-strike approach means shorten up', 'Catchers throw down every third pitch'],
          stations: [
            station('Tee work', { description: 'Inside pitch only, contact point out front, top hand drives through.', setup: 'Two tees down the line', equipment: ['Tees (4)'] }),
            station('Front toss', { description: 'Two-strike approach — choke up, shorten up, anything close gets a swing.', goal: 'Contact rate, not exit speed' }),
            station('Live BP', { description: 'Start runners on first, contact swings only.', staff: ['Coach Priya'], note: 'Chloe and Owen are working steal jumps against a live catcher.' }),
          ],
          rotation: rotation(10, groups(['Group A', 'Group B', 'Group C'], 4)),
        }),
        block('First-to-third reads', 20, {
          staff: ['Coach Priya'], playerIds: some(0, 12),
          description: 'Live reads off front toss. Freeze on a line drive; on a ground ball read the outfielder’s angle, not the coach. Walk it through twice at half speed before it goes live — last time we skipped that and got three runners thrown out standing up.',
        }),
        block('Defensive stations', 20, {
          staff: ['All staff'],
          description: 'Station coaches stay put; the groups move.',
          stations: [
            station('Infield hands', { description: 'Short hops, glove out front, feet doing the work.' }),
            station('Outfield reads', { description: 'Drop step first, run to the spot, glove up late.' }),
            station('Bullpen & catching', { description: 'Fastball command to both corners; catchers frame, no stabbing.', equipment: ['Catcher gear ×2'] }),
          ],
          // Two rounds over three stations — one group will not reach the bullpen tonight.
          rotation: rotation(10, groups(['Group A', 'Group B', 'Group C'], 4)),
        }),
        block('Situational scrimmage', 15, {
          staff: ['All staff'], playerIds: some(0, 12),
          description: 'Runner on second, one out, infield in. I want to HEAR the play called before every pitch. Offense: contact swing — the job is moving the runner.',
        }),
        block('Huddle', 5, {
          staff: ['Coach Dana'], playerIds: some(0, 12),
          description: 'Two sentences per coach, max. Name one thing that got better tonight — about the group, not one kid.',
        }),
      ],
    },
  });

  // ── 3 · UNFINISHED ROTATIONS ─────────────────────────────────────────────────────────────
  //
  // ⚠ THE DEFECT THIS FIXTURE EXISTS FOR: until the run sheet, a rotation the coach had started
  // but not finished printed NOTHING for its block — the screen said what was missing, the paper
  // stayed silent, and the assistant carrying it had no idea a station plan was ever intended.
  //
  // Two ways to be half-built, and they print differently on purpose:
  //   · stations and a length, but the team not split yet → the sentence, and no group lines
  //   · stations and groups, but no length decided        → the sentence AND the group lines
  // The no-length block is LAST because a block with no length does not advance the clock, so
  // everything after it would show the same start time.
  await practice('Practice — a rotation I haven’t finished', {
    dayOffset: 6, startHour: 18, minutes: 75, ...WHERE,
    focusTags: ['Hitting'],
    plan: {
      version: 1,
      goal: 'Get the circuit written before Thursday.',
      equipment: ['Tees (4)', 'Cones'],
      blocks: [
        block('Dynamic warm-up & arm care', 10, {
          staff: ['Coach Dana'], playerIds: some(0, 12), description: 'Bands first.',
        }),
        block('Hitting circuit — team not split yet', 30, {
          staff: ['All staff'],
          description: 'Stations are set; I still have to decide who is in which group.',
          stations: [station('Tee work'), station('Front toss'), station('Live BP')],
          rotation: rotation(null, []),
        }),
        block('First-to-third reads', 20, {
          staff: ['Coach Priya'], playerIds: some(0, 12),
          description: 'Live reads off front toss.',
        }),
        block('Defensive stations — no length decided', null, {
          staff: ['All staff'],
          description: 'Groups are drawn; I haven’t worked out how long this runs.',
          stations: [station('Infield hands'), station('Outfield reads'), station('Bullpen & catching')],
          rotation: rotation(null, groups(['Group A', 'Group B', 'Group C'], 4)),
        }),
      ],
    },
  });

  // ── 4 · TWELVE GROUPS ────────────────────────────────────────────────────────────────────
  //
  // ⚠ Group names are the CUSTOMER'S OWN WORDS — the widest headings anywhere in the product,
  // and the exact shape that cost the roster and the tryout report whole columns earlier in this
  // programme. Twelve long names cannot fit across a portrait page at a readable size, so the
  // grid turns on its side (groups down the left, rounds across) rather than cutting one.
  // MAX_GROUPS is 12, so this is the widest a coach can legally make it.
  await practice('Practice — twelve groups', {
    dayOffset: 8, startHour: 18, minutes: 60, ...WHERE,
    focusTags: ['Skills'],
    plan: {
      version: 1,
      goal: 'Skills carnival — everybody moves, nobody queues.',
      equipment: ['Cones (12)', 'Stopwatch'],
      blocks: [
        block('Warm-up', 10, { staff: ['Coach Dana'], playerIds: some(0, 12), description: 'Two laps, then bands.' }),
        block('Twelve-group carnival', 40, {
          staff: ['All staff'],
          description: 'Every player is their own group tonight — one name each, so the grid has to carry twelve of the coach’s own words.',
          stations: [station('Tee work'), station('Front toss'), station('Ground balls'), station('Baserunning')],
          rotation: rotation(20, groups(
            ['Thunderbolts', 'Renegades', 'Hurricanes', 'Wolfpack', 'Mustangs', 'Cyclones',
              'Titans', 'Rockets', 'Comets', 'Ospreys', 'Badgers', 'Falcons'], 1)),
        }),
        block('Huddle', 10, { staff: ['Coach Dana'], playerIds: some(0, 12), description: 'One thing that got better.' }),
      ],
    },
  });

  // ── 5 · ONE ENORMOUS BLOCK ───────────────────────────────────────────────────────────────
  //
  // ⚠ A block is ATOMIC — one that doesn't fit moves whole to the next page. This one is taller
  // than a whole page, so it CANNOT move whole to a page it still won't fit: it takes a clean
  // page and then flows, breaking only between whole lines. A SENTENCE MUST NEVER SPLIT, and
  // where it continues the gutter must read "cont'd" and the title "(continued)".
  //
  // Built from a station-by-station teardown rather than one giant paragraph, because that is
  // how a plan actually gets long: every field the coach filled in prints.
  const teach = (what, watch, setup) => ({
    description: what, goal: watch, setup,
    coachingPoints: [
      'Call it out loud before the rep so the whole field hears the play.',
      'If the feet are wrong the hands cannot save it — fix the feet first.',
      'Two reps at half speed before anything goes live, every single time.',
      'Nobody moves to the next progression until the group in front is clear.',
    ],
  });
  await practice('Practice — the coach who writes everything down', {
    dayOffset: 10, startHour: 18, minutes: 105, ...WHERE,
    focusTags: ['Defense', 'Hitting'],
    plan: {
      version: 1,
      goal: 'Everything I have been meaning to say, said once, on paper, so the station coaches do not have to ask me.',
      equipment: ['Tees (4)', 'Bucket of game balls', 'L-screen', 'Cones (12)', 'Catcher gear ×2'],
      blocks: [
        block('Dynamic warm-up & arm care', 10, {
          staff: ['Coach Dana'], playerIds: some(0, 12), description: 'Bands first.',
        }),
        block('The whole defensive teardown', 90, {
          rotates: false,     // separate stations, each keeping its own players
          staff: ['All staff'],
          description: 'This is the block I keep meaning to write down properly. Every station below runs for the whole ninety minutes with its own group — nobody rotates, because the point tonight is depth rather than variety. Station coaches: read your own paragraph before we start, and do not improvise the progression.',
          coachingPoints: [
            'Feet before hands, at every station, without exception.',
            'A rep called out loud is worth two done silently.',
            'If a player asks the same question twice, the cue is wrong — change the cue, not the player.',
            'Water break at the halfway whistle whether anyone asks or not.',
            'Nobody throws through pain. Not once, not to finish a drill.',
            'The last five minutes are for cleaning up equipment, not one more rep.',
            'If a group finishes early they help the group beside them; nobody stands.',
            'Anything you change tonight, tell me before you change it.',
          ],
          stations: [
            station('Infield hands', {
              ...teach(
                'Short hops from forty feet, glove out front, working through the ball rather than at it. Start on knees for the first ten so the hands cannot cheat, then up onto the feet for the rest.',
                'The glove arriving late. If it arrives late the ball plays them.',
                'Two buckets, one screen, forty feet apart on the infield grass.'),
              equipment: ['Bucket of game balls', 'Cones (12)'],
              staff: ['Coach Priya'], playerIds: some(0, 3),
            }),
            station('Outfield reads', {
              ...teach(
                'Drop step first, run to the spot, glove up late. Balls over the shoulder both ways, then in front, then the one nobody practises — the ball that dies in front of them on a wet outfield.',
                'Drifting. A drifting outfielder is a fielder who has already given up two steps.',
                'Cones marking the spot, thrower at the warning track.'),
              equipment: ['Bucket of game balls'],
              staff: ['Coach Dana'], playerIds: some(3, 3),
            }),
            station('Bullpen & catching', {
              ...teach(
                'Fastball command to both corners, then the changeup with the same arm speed. Catchers frame rather than stab, and receive the low strike from underneath.',
                'Arm speed dropping on the changeup. It tells the hitter everything.',
                'Full catcher gear, L-screen, one bucket.'),
              equipment: ['Catcher gear ×2', 'L-screen'],
              staff: ['Coach Sam'], playerIds: some(6, 3),
            }),
            station('Framing & blocking', {
              ...teach(
                'Receiving from underneath so the low strike stays a strike, then blocking: chest over the ball, chin down, smother rather than catch. Ten of each, then live from the L-screen.',
                'The glove turning over on the low pitch. It turns a strike into a ball every time.',
                'Full gear, L-screen at thirty feet, one bucket.'),
              equipment: ['Catcher gear ×2', 'L-screen'],
              staff: ['Coach Sam'], playerIds: some(0, 3),
            }),
            station('Rundowns', {
              ...teach(
                'The play nobody practises and everybody botches. Full speed at the runner, one throw, tag on the glove side. Rotate every player through both bases and the runner spot.',
                'Too many throws. One throw ends it; three throws is a run.',
                'Two bases at game distance, helmets on for the runners.'),
              equipment: ['Cones (12)'],
              staff: ['Coach Dana'], playerIds: some(3, 3),
            }),
            station('Situational baserunning', {
              ...teach(
                'First-to-third reads off a live outfielder, then the tag from second, then the delayed steal we have never once executed in a game. Walk every one at half speed before it goes live.',
                'Watching the coach instead of the ball. Read the outfielder’s angle.',
                'Bases at game distance, one coach at third.'),
              equipment: ['Cones (12)', 'Stopwatch'],
              staff: ['Coach Priya'], playerIds: some(9, 3),
            }),
          ],
        }),
        block('Huddle', 5, {
          staff: ['Coach Dana'], playerIds: some(0, 12),
          description: 'Two sentences per coach, max.',
        }),
      ],
    },
  });

  // ── 6 · THE BARE MINIMUM ─────────────────────────────────────────────────────────────────
  //
  // ⚠ No goal, no practice types, no equipment, no notes on any block. The facts block must be
  // ABSENT rather than an empty band (the defect the old sheet had: a dark header row with blank
  // columns), and empty notes must take no vertical space at all.
  await practice('Practice — the bare minimum', {
    dayOffset: 12, startHour: 18, minutes: 60, ...WHERE,
    plan: {
      version: 1,
      blocks: [
        block('Warm-up', 15, { playerIds: some(0, 12) }),
        block('Batting practice', 30, { playerIds: some(0, 12) }),
        block('Conditioning', 15, { playerIds: some(0, 12) }),
      ],
    },
  });

  // ── Tryout sessions, stored as REAL INSTANTS ─────────────────────────────────────────────
  //
  // ⚠⚠ Two of them, because the printed check-in sheet only asks WHICH SESSION when there is more
  // than one — with a single session there is nothing to choose and the sheet prints straight away.
  // A one-session fixture cannot test the chooser at all.
  //
  // ⚠ Written through the wall-clock→UTC conversion the app itself now uses (owner ruling
  // 2026-08-24). Before that fix the app stored the typed clock uncorrected and every screen read
  // it back by slicing, so the two errors cancelled — and the correctly-written demo sandbox
  // displayed FOUR HOURS LATE. These rows are what a coach typing "9:00 a.m." should produce.
  {
    const tryout = (await db.from('rep_tryouts').select('id').eq('program_year_id', year.id).maybeSingle()).data
      ?? (await db.from('rep_tryouts').insert({
        program_year_id: year.id, team_id: team.id, org_id: org.id, is_anonymous: true,
      }).select('id').single()).data;

    const SESSIONS = [
      { label: 'Session 1 — Skills', date: nextSaturday(0), start: '09:00', end: '12:00' },
      { label: 'Session 2 — Games',  date: nextSaturday(7), start: '09:00', end: '12:00' },
    ];
    // Replace rather than accumulate: re-running must not leave a coach eight sessions to choose from.
    die('clear tryout sessions', (await db.from('rep_tryout_sessions').delete().eq('tryout_id', tryout.id)).error);
    die('tryout sessions', (await db.from('rep_tryout_sessions').insert(SESSIONS.map(x => ({
      tryout_id: tryout.id, program_year_id: year.id, team_id: team.id, org_id: org.id,
      starts_at: orgWallClockToUtc(x.date, x.start),
      ends_at: orgWallClockToUtc(x.date, x.end),
      location: 'Riverdale Park', field_number: 'Diamond 3',
      label: x.label, status: 'scheduled',
    })))).error);
    ok(`2 tryout sessions (${SESSIONS[0].date} + ${SESSIONS[1].date}, 9:00 a.m. club time) — the check-in sheet's session chooser needs two`);
  }

  console.log('');
  console.log(`  Team           QA Money U13  → /${MONEY.slug}/coaches/teams/${team.id}/schedule`);
  console.log('  Six practices, next two weeks. Open one → Print the sheet.');
  console.log('     1 · a typical night                    one rotation, focus areas, the everyday page');
  console.log('     2 · a heavy night                      two rotations; one group never reaches the bullpen');
  console.log('     3 · a rotation I haven’t finished      the block that used to print NOTHING');
  console.log('     4 · twelve groups                      the grid turns on its side');
  console.log('     5 · the coach who writes everything…   a block taller than a page');
  console.log('     6 · the bare minimum                   no facts block, no empty notes');
  console.log(`  Head coach ${MONEY.people[0].email} sees focus areas; ${MONEY.people[2].email} (assistant) must NOT.`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
if (wants('cancel-lab')) await seedCancelLab();
if (wants('game-day')) await seedGameDay();
if (wants('book')) await seedBook();
if (wants('money')) await seedMoneyLab();
if (wants('practice')) await seedPracticeSheets();

console.log('\n✓ Done.\n');
console.log('⚠ Restart the dev server before testing — this run added events and lineups.');
console.log('⚠ §1.14\'s "Their tournament so far" is NOT seeded (it needs a real platform tournament');
console.log('  with the team registered in a published division). Those checkboxes read "absent"');
console.log('  for setup reasons, not because the feature is broken.\n');
