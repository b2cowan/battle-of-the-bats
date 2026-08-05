/**
 * Verify the Coach Sandbox is in the state a prospect should find it in.
 *
 * The coach demo's smoke test AND staleness detector, sibling to `check-demo-sandbox.mjs`.
 * A sandbox that has quietly gone stale still renders — it just shows a tryout that was
 * "yesterday", which is worse than showing nothing. It asserts, against the live database:
 *
 *   1. the demo org exists, carries the rep-teams module, is excluded from discovery, and the
 *      demo coach is an org member with role `coach` (never owner);
 *   2. TRYOUT DAY is today: sessions today, evaluators live, partial scores, the split opinion;
 *   3. MID-SEASON is alive: 14-3-1 from the app's own result rule, a game THIS Saturday with no
 *      lineup, the attendance dip, the playing-time outlier, $240 overdue across two families,
 *      one unsigned waiver;
 *   4. SEASON'S END is genuinely closed: `completed` status, 26 finalized games at 18-6-2 with
 *      the streak and the one-run games Wrapped needs, the reused winning batting order, awards,
 *      and 9-of-12 family recap views — and NO active year on that team;
 *   5. the one contact rule: every guardian address in the world is `@example.com`.
 *
 * Exit code 0 = presentable. Non-zero = do not point anyone at it.
 *
 * Run: node --env-file=.env.local scripts/check-demo-coach.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { getDemoOrgByKind } from '../lib/demo-org.ts';
import { DEMO_COACH_TEAMS, SPLIT_OPINION, orgDateWithOffset } from '../lib/demo-coach.ts';

const failures = [];
const ok = (label) => console.log(`  ✓ ${label}`);
function check(condition, label, detail) {
  if (condition) { ok(label); return true; }
  failures.push(detail ? `${label} — ${detail}` : label);
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  return false;
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const demoOrg = getDemoOrgByKind('coach');
if (!demoOrg) { console.error('No coach demo org registered in lib/demo-org.ts'); process.exit(1); }

const now = new Date();
const today = orgDateWithOffset(now, 0);
const thisYear = Number(today.slice(0, 4));

// ── 1. org + hygiene ─────────────────────────────────────────────────────────────────────────
console.log('\nOrg & hygiene');
const org = (await db.from('organizations')
  .select('id, plan_id, subscription_status, is_public, is_discoverable')
  .eq('slug', demoOrg.slug).maybeSingle()).data;
if (!check(!!org, 'the demo org exists')) { report(); }
check(org.plan_id === 'club' && org.subscription_status === 'active', 'plan carries the rep-teams module (club, active)');
check(org.is_discoverable === false, 'excluded from /discover');
check(org.is_public === false, 'no public org pages');

const { data: members } = await db.from('organization_members')
  .select('role, status, user_id').eq('organization_id', org.id);
check(members?.length === 1 && members[0].role === 'coach' && members[0].status === 'active',
  'exactly one member, role coach — the demo session cannot see admin surfaces');
const coachUserId = members?.[0]?.user_id;

// ── helpers ──────────────────────────────────────────────────────────────────────────────────
async function programYears(teamId) {
  return (await db.from('rep_program_years').select('id, year, status, tryout_open').eq('team_id', teamId)).data ?? [];
}
const exampleOnly = (rows, field) => rows.find(r => r[field] && !r[field].endsWith('@example.com'));

// ── 2. tryout day ────────────────────────────────────────────────────────────────────────────
console.log('\nTryout day — Riverdale Ridge 11U');
{
  const teamId = DEMO_COACH_TEAMS.tryoutDay.id;
  const years = await programYears(teamId);
  const py = years.find(y => y.status === 'active');
  check(!!py && years.length === 1, 'one program year, active');
  if (py) {
    check(py.year === thisYear + 1 && py.tryout_open === true, `trying out for NEXT season (${thisYear + 1}), tryout open`);
    const { data: sessions } = await db.from('rep_tryout_sessions').select('starts_at').eq('program_year_id', py.id);
    const todayCount = (sessions ?? []).filter(s => orgDateWithOffset(new Date(s.starts_at), 0) === today).length;
    check(todayCount >= 2, 'at least two sessions are TODAY (the anchor)', `today=${todayCount}`);

    const { data: regs } = await db.from('rep_tryout_registrations')
      .select('id, status, is_checked_in, bib_number, guardian_email').eq('program_year_id', py.id);
    check(regs?.length === 28, '28 candidates registered', `got ${regs?.length}`);
    check(regs.every(r => r.status === 'pending_review'), 'no offers decided yet — the decision is still the coach\'s to make');
    check(regs.filter(r => r.is_checked_in).length === 24, '24 checked in with bibs');
    check(!exampleOnly(regs, 'guardian_email'), 'every guardian address is unreachable example.com');

    const { data: evals } = await db.from('rep_tryout_evaluator_sessions')
      .select('id, evaluator_name, revoked_at, expires_at').eq('program_year_id', py.id);
    check(evals?.length === 3 && evals.every(e => !e.revoked_at && new Date(e.expires_at) > now),
      'three evaluator links, live and unexpired');

    const { data: scores } = await db.from('rep_tryout_scores')
      .select('score, category_key, registration_id, evaluator_session_id').eq('program_year_id', py.id);
    check(scores?.length === 205, 'scores are partial and mid-flight (205 = two evaluators, third not started)', `got ${scores?.length}`);
    const splitReg = regs.find(r => r.bib_number === String(SPLIT_OPINION.bib));
    const splitScores = (scores ?? []).filter(s => s.registration_id === splitReg?.id && s.category_key === SPLIT_OPINION.category)
      .map(s => s.score).sort((a, b) => a - b);
    check(splitScores.length === 2 && splitScores[0] === 2 && splitScores[1] === 5,
      `the split opinion exists (bib ${SPLIT_OPINION.bib} ${SPLIT_OPINION.category}: 2 vs 5)`);
  }
}

// ── 3. mid-season ────────────────────────────────────────────────────────────────────────────
console.log('\nMid-season — Riverdale Ridge 12U');
{
  const teamId = DEMO_COACH_TEAMS.midSeason.id;
  const years = await programYears(teamId);
  const py = years.find(y => y.status === 'active');
  check(!!py && years.length === 1 && py?.year === thisYear, `one active program year (${thisYear})`);
  if (py) {
    const { data: events } = await db.from('rep_team_events')
      .select('id, event_type, starts_at, result, team_score, opponent_score, opponent').eq('program_year_id', py.id);
    const games = (events ?? []).filter(e => e.event_type === 'league_game');
    // The app's own record rule: result column, league/tournament games only.
    const w = games.filter(g => g.result === 'win').length;
    const l = games.filter(g => g.result === 'loss').length;
    const t = games.filter(g => g.result === 'tie').length;
    check(w === 14 && l === 3 && t === 1, `the record reads 14-3-1 by the app's own rule`, `got ${w}-${l}-${t}`);

    const upcoming = games.filter(g => g.result == null);
    const satDate = upcoming[0] ? orgDateWithOffset(new Date(upcoming[0].starts_at), 0) : null;
    const dow = satDate ? new Date(`${satDate}T12:00:00Z`).getUTCDay() : null;
    check(upcoming.length === 1 && dow === 6 && satDate >= today,
      'exactly one game ahead, and it is THIS Saturday (dates re-anchored)', `date=${satDate}`);

    const { data: satLineup } = upcoming[0]
      ? await db.from('rep_team_lineups').select('id').eq('event_id', upcoming[0].id)
      : { data: [] };
    check((satLineup ?? []).length === 0, "Saturday's lineup is NOT set — the Overview's one thing");

    const { data: lineups } = await db.from('rep_team_lineups').select('id').eq('program_year_id', py.id);
    check((lineups ?? []).length >= 3, `${lineups?.length} saved lineups — playing-time and arm-care have a record`);
    if (lineups?.length) {
      const { data: entries } = await db.from('rep_team_lineup_entries')
        .select('player_id, inning_positions').in('lineup_id', lineups.map(x => x.id));
      const field = new Map(); let pitcherAtCap = false;
      for (const e of entries ?? []) {
        let f = 0, p = 0;
        for (const pos of Object.values(e.inning_positions ?? {})) {
          if (pos && pos !== 'Bench') f++;
          if (pos === 'P') p++;
        }
        field.set(e.player_id, (field.get(e.player_id) ?? 0) + f);
        if (p >= 3) pitcherAtCap = true;
      }
      const shares = [...field.values()];
      const avg = shares.reduce((s, x) => s + x, 0) / shares.length;
      check(Math.min(...shares) < avg * 0.85, 'the playing-time outlier is real (one player >15% below average)');
      check(pitcherAtCap, 'a pitcher sits AT the arm-care cap (3 innings)');
    }

    // The attendance dip: the most recent past Tuesday practice runs under 80%.
    const practices = (events ?? []).filter(e => e.event_type === 'practice')
      .map(e => ({ ...e, date: orgDateWithOffset(new Date(e.starts_at), 0) }))
      .filter(e => e.date <= today)
      .sort((a, b) => b.date.localeCompare(a.date));
    const lastTue = practices.find(p => new Date(`${p.date}T12:00:00Z`).getUTCDay() === 2);
    if (lastTue) {
      const { data: att } = await db.from('rep_team_event_attendance').select('status').eq('event_id', lastTue.id);
      const rate = (att ?? []).filter(a => a.status === 'attending').length / Math.max(1, att?.length ?? 0);
      check(rate < 0.8, `the Tuesday attendance dip is visible (${Math.round(rate * 100)}%)`);
    } else {
      check(false, 'a past Tuesday practice exists');
    }

    const { data: installments } = await db.from('rep_player_dues_installments')
      .select('amount, due_date, paid_at, player_id').eq('team_id', teamId);
    const overdue = (installments ?? []).filter(i => !i.paid_at && i.due_date < today);
    const overdueTotal = overdue.reduce((s, i) => s + Number(i.amount), 0);
    check(overdueTotal === 240 && new Set(overdue.map(i => i.player_id)).size === 2,
      '$240 overdue across exactly two families', `$${overdueTotal} across ${new Set(overdue.map(i => i.player_id)).size}`);

    const { data: roster } = await db.from('rep_roster_players')
      .select('id, guardian_email').eq('program_year_id', py.id).eq('status', 'active');
    const { data: waivers } = await db.from('rep_player_documents')
      .select('player_id').eq('team_id', teamId).eq('document_type', 'waiver');
    const signed = new Set((waivers ?? []).map(x => x.player_id));
    const unsigned = (roster ?? []).filter(r => !signed.has(r.id));
    check(roster?.length === 12 && unsigned.length === 1, '12 on the roster, exactly one waiver unsigned');
    check(!exampleOnly(roster ?? [], 'guardian_email'), 'every 12U guardian address is unreachable example.com');
  }
}

// ── 4. season's end ──────────────────────────────────────────────────────────────────────────
console.log("\nSeason's End — Riverdale Ridge 13U");
{
  const teamId = DEMO_COACH_TEAMS.seasonsEnd.id;
  const years = await programYears(teamId);
  const py = years.find(y => y.status === 'completed');
  check(!!py && py?.year === thisYear - 1, `the ${thisYear - 1} year is CLOSED (completed)`);
  check(!years.some(y => y.status === 'active' || y.status === 'draft'),
    'no open year on this team — the portal resolves straight to the archive');
  if (py) {
    const { data: events } = await db.from('rep_team_events')
      .select('id, event_type, starts_at, result, team_score, opponent_score').eq('program_year_id', py.id);
    const games = (events ?? []).filter(e => e.event_type === 'league_game');
    const w = games.filter(g => g.result === 'win').length;
    const l = games.filter(g => g.result === 'loss').length;
    const t = games.filter(g => g.result === 'tie').length;
    check(games.length === 26 && w === 18 && l === 6 && t === 2, 'a full 26-game season at 18-6-2');
    check(games.every(g => g.result && g.team_score != null && g.opponent_score != null),
      'every game finalized and scored — nothing dangles in the archive');

    const ordered = games.slice().sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    let streak = 0, best = 0;
    for (const g of ordered) { streak = g.result === 'win' ? streak + 1 : 0; best = Math.max(best, streak); }
    check(best >= 5, `a ${best}-game win streak for Wrapped to brag about`);
    const oneRun = games.filter(g => g.result !== 'tie' && Math.abs(g.team_score - g.opponent_score) === 1).length;
    check(oneRun >= 4, `${oneRun} one-run games — "closest game" has a story`);

    const { data: lineups } = await db.from('rep_team_lineups').select('id, event_id').eq('program_year_id', py.id);
    const { data: entries } = await db.from('rep_team_lineup_entries')
      .select('lineup_id, player_id, batting_order').in('lineup_id', (lineups ?? []).map(x => x.id));
    const orderKey = (lid) => (entries ?? []).filter(e => e.lineup_id === lid)
      .sort((a, b) => a.batting_order - b.batting_order).map(e => e.player_id).join('|');
    const counts = new Map();
    for (const lu of lineups ?? []) counts.set(orderKey(lu.id), [...(counts.get(orderKey(lu.id)) ?? []), lu.event_id]);
    const reused = [...counts.values()].find(ids => ids.length >= 3);
    const gameById = new Map(games.map(g => [g.id, g]));
    check(!!reused && reused.every(id => gameById.get(id)?.result === 'win'),
      'a batting order reused 3+ times, all wins — the Wrapped lineup fact is TRUE');

    const { data: awards } = await db.from('rep_player_awards').select('id').eq('team_id', teamId);
    check((awards ?? []).length >= 6, `${awards?.length} awards on the season`);

    const { data: links } = await db.from('family_links')
      .select('id, status, invited_email').eq('rep_team_id', teamId);
    const { data: views } = await db.from('family_recap_views').select('id').eq('program_year_id', py.id);
    check((links ?? []).filter(x => x.status === 'verified').length === 12 && (views ?? []).length === 9,
      '12 verified families, 9 opened the recap');
    check(!exampleOnly(links ?? [], 'invited_email'), 'every family link address is unreachable example.com');

    const { data: due } = await db.from('rep_player_dues_installments')
      .select('paid_at').eq('team_id', teamId).is('paid_at', null);
    check((due ?? []).length === 0, 'the money story is settled — every installment paid');
  }
}

report();

function report() {
  if (failures.length) {
    console.log(`\n❌ ${failures.length} failure(s):`);
    for (const f of failures) console.log(`   · ${f}`);
    process.exit(1);
  }
  console.log('\n✅ The coach sandbox is presentable.');
  console.log(`   Tryout day:   /${demoOrg.slug}/coaches/teams/${DEMO_COACH_TEAMS.tryoutDay.id}/tryouts/score`);
  console.log(`   Mid-season:   ${demoOrg.landingPath}`);
  console.log(`   Season's End: /${demoOrg.slug}/coaches/teams/${DEMO_COACH_TEAMS.seasonsEnd.id}/season-end`);
  process.exit(0);
}
