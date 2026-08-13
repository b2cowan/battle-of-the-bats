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
 * Run: node --env-file=.env.local scripts/seed-qa-day-fixtures.mjs [--cancel-lab|--game-day|--book]
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

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
};

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
  const ourIds = new Set(users.map(u => u.user.id));

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
  // ⚠ One line is left with NO periods on purpose. An undated line must NOT be smeared across
  // the months (that behaviour changed deliberately) — it is the case the cumulative chart note
  // in the ledger is about, and without one here the check cannot be made.
  const LINES = [
    { cat: 'Tournaments', item: 'Entry Fees',      desc: 'Tournament entry fees', total: 2400, periods: [[-4, 600], [-3, 600], [-2, 600], [-1, 600]] },
    { cat: 'Team Gear',   item: 'Uniforms',        desc: 'Uniform order',         total: 1800, periods: [[-5, 1800]] },
    { cat: 'Facilities',  item: 'Diamond Permits', desc: 'Diamond permits',       total: 1200, periods: [[-4, 300], [-3, 300], [-2, 300], [-1, 300]] },
    { cat: 'Officials',   item: null,              desc: 'Umpires',               total: 900,  periods: [[-3, 300], [-2, 300], [-1, 300]] },
    { cat: 'Training',    item: null,              desc: 'Winter training',       total: 1500, periods: [[-6, 500], [-5, 500], [-4, 500]] },
    { cat: 'Admin',       item: null,              desc: 'Miscellaneous',         total: 300,  periods: [] },
  ];
  const { data: haveLines } = await db.from('rep_budget_lines').select('id').eq('program_year_id', cur.id).limit(1);
  if (!haveLines?.length) {
    for (const [i, l] of LINES.entries()) {
      const ins = await db.from('rep_budget_lines').insert({
        org_id: org.id, team_id: u13.id, program_year_id: cur.id,
        category_id: catBy[l.cat] ?? null, item_id: l.item ? itemBy(l.cat, l.item) : null,
        description: l.desc, total_amount: l.total, sort_order: i,
      }).select('id').single();
      die('budget line', ins.error);
      if (l.periods.length) {
        die('budget periods', (await db.from('rep_budget_periods').insert(
          l.periods.map(([m, amt], n) => ({
            budget_line_id: ins.data.id, period_label: monthStart(m).slice(0, 7),
            period_date: monthStart(m), amount: amt, sort_order: n,
          })),
        )).error);
      }
    }
    ok(`budget seeded — 6 lines / $8,100, five phased across months, ONE deliberately undated`);
  } else note('budget lines already present');

  // ── expenses: paid, payable, over-plan and unbudgeted ────────────────────────────────────
  // ⚠ The "Team photos" row has NO category on purpose — an unbudgeted spend is what makes the
  // report earn its keep, and a fixture where everything reconciles teaches the opposite lesson.
  // ⚠ "Uniform order" is $50 OVER its line, so exactly one row reads over-plan. A sheet where
  // every line comes in under is a sheet that flatters, and the Difference column proves nothing.
  const EXPENSES = [
    { desc: 'Spring Invitational entry', cat: 'Tournaments', amount: 600,  paid: dayIn(-4, 12) },
    { desc: 'Summer Classic entry',      cat: 'Tournaments', amount: 600,  paid: dayIn(-2, 8) },
    { desc: 'Uniform order',             cat: 'Team Gear',   amount: 1850, paid: dayIn(-5, 20) },
    { desc: 'Diamond permits — spring',  cat: 'Facilities',  amount: 650,  paid: dayIn(-4, 3) },
    { desc: 'Umpires — midseason',       cat: 'Officials',   amount: 300,  paid: dayIn(-2, 15) },
    { desc: 'Team photo day',            cat: null,          amount: 180,  paid: dayIn(-1, 9) },
  ];
  const { data: haveExp } = await db.from('rep_team_expenses').select('id').eq('program_year_id', cur.id).limit(1);
  if (!haveExp?.length) {
    die('expenses', (await db.from('rep_team_expenses').insert(EXPENSES.map(e => ({
      program_year_id: cur.id, team_id: u13.id, org_id: org.id,
      expense_type: 'expense', description: e.desc, category: e.cat,
      amount: e.amount, expense_paid_at: e.paid,
    })))).error);
    // A payable with a deposit paid and a balance still owed NEXT month — this is the row the
    // Payment schedule tab's Unpaid default exists for, and the one that creates a shortfall.
    die('payable', (await db.from('rep_team_expenses').insert({
      program_year_id: cur.id, team_id: u13.id, org_id: org.id,
      expense_type: 'tournament_payable', description: 'Fall Showdown entry', category: 'Tournaments',
      amount: 600, deposit_amount: 200, deposit_due_date: dayIn(-1, 15), deposit_paid_at: dayIn(-1, 14),
      balance_amount: 400, balance_due_date: dayIn(1, 10),
    })).error);
    ok('expenses seeded — 6 paid (one OVER plan, one UNBUDGETED) + 1 payable with a balance due next month');
  } else note('expenses already present');

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
    }
    ok(`dues seeded — $650 × ${roster.length} in three instalments; 3 families a payment behind`);
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
      org_id: org.id, team_id: u13.id, request_type: 'charge_to_org',
      amount: 450, description: 'Share of the spring dome block', status: 'pending',
      created_by: users[0].user.id,
    })).error);
    ok('payment request seeded (pending)');
  } else note('payment request already present');

  // ── the PRIOR season, so the months view has a prior-season column ───────────────────────
  const { data: havePrev } = await db.from('rep_budget_lines').select('id').eq('program_year_id', prev.id).limit(1);
  if (!havePrev?.length) {
    // ⚠ One of these categories (Fundraising Costs) appears ONLY last season — that is what
    // produces the "last season only" group the ledger asks you to look for.
    const PREV = [
      { cat: 'Tournaments', desc: 'Tournament entry fees', total: 2100 },
      { cat: 'Team Gear', desc: 'Uniform order', total: 1600 },
      { cat: 'Fundraising Costs', desc: 'Bottle drive supplies', total: 250 },
    ];
    for (const [i, l] of PREV.entries()) {
      die('prev budget line', (await db.from('rep_budget_lines').insert({
        org_id: org.id, team_id: u13.id, program_year_id: prev.id,
        category_id: catBy[l.cat] ?? null, description: l.desc, total_amount: l.total, sort_order: i,
      })).error);
    }
    die('prev expenses', (await db.from('rep_team_expenses').insert(PREV.map((l, i) => ({
      program_year_id: prev.id, team_id: u13.id, org_id: org.id,
      expense_type: 'expense', description: l.desc, category: l.cat,
      amount: l.total - 50, expense_paid_at: dayIn(-13 + i, 10),
    })))).error);
    ok('prior season seeded — 3 lines incl. ONE category that exists only last season');
  } else note('prior season already present');

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

  console.log('');
  console.log(`  Org            /${MONEY.slug}`);
  for (const u of users) {
    const label = u.caps === null ? 'head coach — full money' :
      u.caps.money === 'read' ? 'assistant — money READ only' :
      u.caps.money === 'off' ? 'assistant — money OFF' : 'assistant — money write, NO contacts';
    console.log(`  ${u.email.padEnd(30)} ${MONEY.password}   ${label}`);
  }
  console.log(`  Data-rich team  QA Money U13  → /${MONEY.slug}/coaches/teams/${u13.id}`);
  console.log(`  Empty team      QA Money U11  → /${MONEY.slug}/coaches/teams/${u11.id}`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
if (wants('cancel-lab')) await seedCancelLab();
if (wants('game-day')) await seedGameDay();
if (wants('book')) await seedBook();
if (wants('money')) await seedMoneyLab();

console.log('\n✓ Done.\n');
console.log('⚠ Restart the dev server before testing — this run added events and lineups.');
console.log('⚠ §1.14\'s "Their tournament so far" is NOT seeded (it needs a real platform tournament');
console.log('  with the team registered in a published division). Those checkboxes read "absent"');
console.log('  for setup reasons, not because the feature is broken.\n');
