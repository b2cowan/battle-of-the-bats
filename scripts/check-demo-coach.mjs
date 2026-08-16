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
 *   3. OFF-SEASON has open books: every budget line on a real category so budget-vs-actual can
 *      match it, spending logged against four of six lines, one deliberately unbudgeted expense,
 *      an unpaid payable balance ahead, $225 overdue from one family, two practice plans (one
 *      rotating) and a testing session with honest blanks for the two who missed it;
 *   4. SEASON START is two weeks in: opening day a fortnight back, three games played and the
 *      rest ahead, NO past game left unscored, exactly one saved lineup, and attendance taken
 *      for every event that has happened and none that hasn't;
 *   5. MID-SEASON is alive: 14-3-1 from the app's own result rule, a game THIS Saturday with no
 *      lineup, the attendance dip, the playing-time outlier, $240 overdue across two families,
 *      one unsigned waiver;
 *   6. SEASON'S END is genuinely closed: `completed` status, 26 finalized games at 18-6-2 with
 *      the streak and the one-run games Wrapped needs, the reused winning batting order, awards,
 *      and 9-of-12 family recap views — and NO active year on that team;
 *   7. the one contact rule: every guardian address in the world is `@example.com`.
 *
 * Exit code 0 = presentable. Non-zero = do not point anyone at it.
 *
 * Run: node --env-file=.env.local scripts/check-demo-coach.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { getDemoOrgByKind, DEMO_COACH_SHOWCASE } from '../lib/demo-org.ts';
import { moneySectionHref } from '../lib/coach-money-links.ts';
import {
  DEMO_COACH_TEAMS, SPLIT_OPINION, orgDateWithOffset,
  OFFSEASON_BUDGET_LINES, OFFSEASON_FUNDING_LINES, OFFSEASON_DUES, OFFSEASON_TESTING_ABSENT, OFFSEASON_MEASURABLE_TYPES,
  SEASON_START_DUES, resolveOffSeasonState, resolveSeasonStartState,
  MIDSEASON_BUDGET_LINES, MIDSEASON_SHOWCASE_ROSTER_INDEX, MIDSEASON_FUNDRAISER, MIDSEASON_SPONSOR,
  MIDSEASON_CLUB_MONEY,
  MIDSEASON_DUES, resolveMidSeasonState,
  SEASON_START_BUDGET_LINES,
} from '../lib/demo-coach.ts';

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
/**
 * NOT SEEDED HERE is a skip, not a failure — exit code 3 (see `check-demos.mjs`).
 *
 * This check joined the routine verification sweep on 2026-08-05, so it now runs on machines that
 * have never seeded a demo: a contributor's laptop, a fresh clone, a branch nobody has pointed at
 * a database. Failing there would teach everyone to ignore a red build, which costs more than the
 * check is worth. A demo that exists and is WRONG is still a hard failure.
 */
if (!org) {
  console.log('  – no coach demo in this database — skipping (seed it with scripts/seed-demo-coach.mjs)');
  process.exit(3);
}
check(org.plan_id === 'club' && org.subscription_status === 'active', 'plan carries the rep-teams module (club, active)');
check(org.is_discoverable === false, 'excluded from /discover');
check(org.is_public === false, 'no public org pages');

const { data: members } = await db.from('organization_members')
  .select('role, status, user_id').eq('organization_id', org.id);
check(members?.length === 1 && members[0].role === 'coach' && members[0].status === 'active',
  'exactly one member, role coach — the demo session cannot see admin surfaces');

// ── helpers ──────────────────────────────────────────────────────────────────────────────────
async function programYears(teamId) {
  return (await db.from('rep_program_years').select('id, year, status, tryout_open').eq('team_id', teamId)).data ?? [];
}
const exampleOnly = (rows, field) => rows.find(r => r[field] && !r[field].endsWith('@example.com'));

/** Instalments past their due date with nothing paid against them — ONE definition of "overdue",
 *  because three sections assert on it and a demo that disagrees with itself about who owes money
 *  is worse than one that says nothing. */
const overdueInstallments = (rows) => (rows ?? []).filter(i => !i.paid_at && i.due_date < today);

/** Events with their org-calendar date attached — the shape the timing assertions below work on. */
const datedEvents = (rows) => (rows ?? [])
  .map(e => ({ ...e, date: orgDateWithOffset(new Date(e.starts_at), 0) }));

/**
 * Attendance exists for everything that has happened and nothing that hasn't.
 *
 * This is the staleness tripwire as much as a data check: if the nightly re-anchor stops running,
 * events drift into the past carrying no attendance, and the demo starts showing sessions nobody
 * apparently turned up to. Both season-shaped teams assert it, through one definition of the
 * past/future boundary so the two can never disagree about which side "today" falls on.
 */
async function checkAttendanceMatchesTiming(programYearId, events, label) {
  const { data: attendance } = await db.from('rep_team_event_attendance')
    .select('event_id').eq('program_year_id', programYearId);
  const taken = new Set((attendance ?? []).map(a => a.event_id));
  // `<= today`, matching the seed's own `happened` rule exactly. Splitting on `<` would leave an
  // event dated TODAY asserted by neither half — a hole that opens roughly one night in seven,
  // on precisely the row most likely to be mid-transition.
  const past = events.filter(e => e.date <= today);
  const ahead = events.filter(e => e.date > today);
  // ⚠ One deliberate exemption, for exactly one day: an UNRESULTED game dated TODAY. On Saturdays
  // `offsetToSaturday` is 0, so both season teams' anchor game ("a game THIS Saturday, no lineup,
  // no result") is dated today — game-day-before-first-pitch, the single most compelling state the
  // demo has, and the seed deliberately writes it no attendance. The `<= today` boundary read that
  // as a lapsed register, so this check went red every Saturday on EVERY environment and healed
  // itself every Sunday (found 2026-08-08, the first Saturday after the production launch). The
  // staleness tripwire survives intact: if the re-anchor stalls, tomorrow that same game is a PAST
  // unresulted game — no exemption — and the sibling "no game sits in the past without a result"
  // check fires alongside this one. (`result` is only selected on the game-bearing call sites; a
  // practices-only caller short-circuits on event_type before ever reading it.)
  const isGameDayBeforeFirstPitch = e =>
    e.event_type === 'league_game' && e.result == null && e.date === today;
  check(past.length > 0 && past.every(e => taken.has(e.id) || isGameDayBeforeFirstPitch(e)),
    `attendance was taken at all ${past.length} ${label} that have happened`);
  check(ahead.every(e => !taken.has(e.id)),
    `and at none of the ${ahead.length} still ahead — nothing is invented`);
}

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
      .select('id, evaluator_name, revoked_at, expires_at, token_hash').eq('program_year_id', py.id);
    // Count SHAREABLE links the way the product's own Evaluators card does — excluding `self:`
    // rows. Opening the scorer lazily creates the signed-in coach's own scoring identity (a
    // GET-side find-or-create in …/tryout-self-score), so the demo grows a fourth, legitimate
    // "Jordan Blake" row the first time anyone walks in. Counting it here made this check read
    // "not presentable" over a world a prospect sees as perfectly coherent (found 2026-08-11
    // after a day of false alarms).
    const links = (evals ?? []).filter(e => !String(e.token_hash).startsWith('self:'));
    check(links.length === 3 && links.every(e => !e.revoked_at && new Date(e.expires_at) > now),
      'three shareable evaluator links, live and unexpired (self-scoring rows excluded)');

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

// ── 3. off-season ────────────────────────────────────────────────────────────────────────────
console.log('\nOff-season — Riverdale Ridge 14U');
{
  const teamId = DEMO_COACH_TEAMS.offSeason.id;
  const state = resolveOffSeasonState(now);
  const years = await programYears(teamId);
  const py = years.find(y => y.status === 'active');
  check(!!py && years.length === 1 && py?.year === thisYear + 1,
    `one active program year, and it is NEXT season (${thisYear + 1}) — a team building the year it hasn't played`);
  if (py) {
    // The budget half. A line with no category never matches an actual, so this is the assertion
    // that keeps the moment's landing screen from quietly becoming a page of "Uncategorized".
    const { data: allLines } = await db.from('rep_budget_lines')
      // ⚠ `item_id` is load-bearing below, not padding: without it the "no typed income on a
      // derived row" check compares against a set of undefineds and passes vacuously.
      .select('id, total_amount, category_id, item_id, line_kind, budget_categories(name, scope)').eq('program_year_id', py.id);
    // Costs and money in are separate kinds and separate assertions, because they roll up into
    // separate SECTIONS of the report (mig 243) — lumping them would weaken both rules.
    // Both money-in kinds — a sponsorship line is money in, not a cost (mig 237).
    const isFunding = (k) => k === 'funding' || k === 'sponsorship';
    const lines = (allLines ?? []).filter(l => !isFunding(l.line_kind));
    const fundingLines = (allLines ?? []).filter(l => isFunding(l.line_kind));
    check(lines.length === OFFSEASON_BUDGET_LINES.length && lines.every(l => l.category_id),
      `${lines.length} cost lines, every one on a real category (budget-vs-actual matches by category NAME)`);
    // Org-only categories are invisible to the coach's own budget planner and refused by its write
    // path — a line on one is a state no coach could have created, which the demo must never show.
    check(lines.every(l => ['team', 'both'].includes(l.budget_categories?.scope)),
      'every category is one a COACH could actually have picked (team-scoped, not an admin-only one)');
    const budgetTotal = lines.reduce((s, l) => s + Number(l.total_amount), 0);
    check(budgetTotal === OFFSEASON_BUDGET_LINES.reduce((s, l) => s + l.total, 0),
      `the plan totals $${budgetTotal.toLocaleString()}`);
    // The shop window must show what the product gained: a budget that subtracts the money the
    // team expects to raise, so a prospect sees dues set on what players actually fund.
    const fundingTotal = fundingLines.reduce((s, l) => s + Number(l.total_amount), 0);
    /* ⚠ A MONEY-IN LINE CARRIES A CATEGORY NOW (mig 243), and this assertion used to demand the
       opposite. Without one it lands in the report's "No category / Not itemized" bucket — the
       state a pre-243 world is correctly left in, and precisely the wrong thing for a shop window
       to show, because the Revenue section would have nothing named in it. */
    check(fundingLines.length === OFFSEASON_FUNDING_LINES.length
      && fundingTotal === OFFSEASON_FUNDING_LINES.reduce((s, l) => s + l.total, 0)
      && fundingLines.every(l => l.category_id),
      `expected fundraising of $${fundingTotal.toLocaleString()} is budgeted, on a real category (stored positive — the kind carries the sign)`);

    // Every line, funding included — the phasing rule is the planner's and applies to both kinds,
    // and the nightly re-anchor re-derives them all by sort_order without caring which is which.
    const { data: periods } = await db.from('rep_budget_periods')
      .select('budget_line_id, amount, period_date').in('budget_line_id', (allLines ?? []).map(l => l.id));
    const perLine = new Map();
    for (const p of periods ?? []) perLine.set(p.budget_line_id, (perLine.get(p.budget_line_id) ?? 0) + Number(p.amount));
    check((allLines ?? []).every(l => Math.abs((perLine.get(l.id) ?? 0) - Number(l.total_amount)) < 0.02),
      'every line is phased across months and each phasing sums back to its line (the planner\'s own ±$0.02 rule)');
    check((periods ?? []).some(p => p.period_date?.slice(0, 7) === today.slice(0, 7)),
      'the phasing covers THIS month — the month grid opens on a column that means something');

    // The actual half, matched the way the report matches it: category name, case-insensitive.
    const categoryNames = new Set((lines ?? []).map(l => l.budget_categories?.name?.toLowerCase()).filter(Boolean));
    const { data: expenses } = await db.from('rep_team_expenses')
      .select('description, category, budget_item_id, amount, expense_type, expense_paid_at, balance_amount, balance_due_date, balance_paid_at')
      .eq('program_year_id', py.id);
    check(expenses?.length === state.expenses.length, `${expenses?.length} expenses logged against the plan`);
    const matched = (expenses ?? []).filter(e => categoryNames.has((e.category ?? '').toLowerCase()));
    const unbudgetedCost = (expenses ?? []).find(e => !categoryNames.has((e.category ?? '').toLowerCase()));
    check(matched.length === (expenses ?? []).length - 1,
      'all but one expense matches a budget line by category — and exactly one does not, on purpose');
    /* ⚠ AND EVERY ONE OF THEM NAMES AN ITEM (mig 240). A category alone puts the money under a
       heading and no further — the report groups on category + item, so a world seeded without
       items shows a dash beside every row on the screen a prospect is most likely to open. */
    check((expenses ?? []).every(e => e.budget_item_id),
      'every 14U cost names a budget item, so the report reads item by item');
    /* ⚠ AND THE UNBUDGETED ONE STILL NAMES ONE — which is the whole improvement. The team photo is
       filed as Events / Photo Day, a category this plan never mentions, so it appears as its own
       flagged "not budgeted" row rather than as an unclassified line in a list at the foot. */
    check(!!unbudgetedCost?.budget_item_id,
      'the deliberately unbudgeted cost still names its item — it appears as its own flagged row');
    check(!!unbudgetedCost && Number(unbudgetedCost.amount) > 0,
      `the unbudgeted one is real money ("${unbudgetedCost?.description}", $${unbudgetedCost?.amount})`);
    const payable = (expenses ?? []).find(e => e.expense_type === 'tournament_payable');
    check(!!payable && !payable.balance_paid_at && payable.balance_due_date > today,
      'a tournament balance is still owed, and it falls due AHEAD of today');
    const spent = (expenses ?? []).reduce((s, e) =>
      s + (e.expense_paid_at ? Number(e.amount) : 0), 0);
    check(spent > 0 && spent < budgetTotal,
      `money is spent but the budget holds ($${spent.toLocaleString()} of $${budgetTotal.toLocaleString()})`);

    /* ── Money IN, and money BACK (mig 243) ────────────────────────────────────────────────────
       ⚠⚠ BOTH, AND THE PAIR IS THE POINT. A prospect who only ever meets income learns that money
       arriving is one thing, and the whole release exists because it is not: a refunded entry
       means the team SPENT LESS, not that it EARNED. The refund is what makes the report
       demonstrate its own rule, so a world carrying only the income entry is a world that has
       quietly lost the harder half of the feature — which is exactly the drift this file exists
       to catch. */
    const { data: arrivals } = await db.from('rep_team_money_in')
      .select('entry_kind, amount, received_date, budget_item_id, budget_category_id, budget_items(name), budget_categories(name)')
      .eq('program_year_id', py.id);
    const income = (arrivals ?? []).filter(a => a.entry_kind === 'income');
    const back = (arrivals ?? []).filter(a => a.entry_kind === 'money_back');
    check(income.length > 0 && income.every(a => a.budget_item_id),
      `${income.length} income entry logged, on a real category + item — the Revenue section has a named row`);
    check(back.length > 0 && back.every(a => a.budget_item_id),
      `${back.length} money-back entry logged — the prospect meets the refund rule, not just income`);
    /* ⚠ THE REFUND MUST POINT AT AN ITEM THE TEAM ACTUALLY SPENT ON, or it nets into a row with
       nothing behind it and reads as a negative — honest, but the wrong story for a shop window. */
    const backItem = back[0]?.budget_item_id;
    check((expenses ?? []).some(e => e.budget_item_id === backItem),
      'the refund points at an item this team really paid for, so it nets into a row that exists');
    check((arrivals ?? []).every(a => Number(a.amount) > 0),
      'every arrival is stored POSITIVE — the kind carries the sign, never the amount');
    /* ⚠ AND NOT ON A ROW THE FUNDRAISERS ALREADY ANSWER FOR (one row, one source). The write path
       refuses a typed income there; a seeded world must never hold a state the product rejects. */
    const derivedItemIds = new Set(fundingLines.map(l => l.item_id).filter(Boolean));
    check(income.every(a => !derivedItemIds.has(a.budget_item_id)),
      'no typed income sits on a row whose actual comes from a fundraiser — the seed cannot hold a refused state');
    check((arrivals ?? []).every(a => a.received_date <= today),
      'every arrival is dated on or before today — nothing has arrived from the future');

    // Dues: two settled instalments and one family behind.
    const { data: installments } = await db.from('rep_player_dues_installments')
      .select('amount, due_date, paid_at, player_id').eq('team_id', teamId);
    const overdue = overdueInstallments(installments);
    const overdueTotal = overdue.reduce((s, i) => s + Number(i.amount), 0);
    check(overdueTotal === OFFSEASON_DUES.installmentAmount && new Set(overdue.map(i => i.player_id)).size === 1,
      `$${OFFSEASON_DUES.installmentAmount} overdue from exactly one family`,
      `$${overdueTotal} across ${new Set(overdue.map(i => i.player_id)).size}`);
    check((installments ?? []).filter(i => i.paid_at).length > 0
      && (installments ?? []).every(i => !i.paid_at || i.paid_at.slice(0, 10) <= today),
      'nothing was paid in the future');

    // The sessions, the plans, and the one that rotates.
    const { data: events } = await db.from('rep_team_events')
      .select('id, name, starts_at, event_type, practice_plan').eq('program_year_id', py.id);
    check((events ?? []).every(e => e.event_type === 'practice'),
      `${events?.length} events, all of them practices — nobody plays anybody in the off-season`);
    await checkAttendanceMatchesTiming(py.id, datedEvents(events), 'sessions');

    const planned = (events ?? []).filter(e => e.practice_plan);
    check(planned.length === 2, 'two practice plans are written', `got ${planned.length}`);
    const rotating = planned.find(e => (e.practice_plan.blocks ?? [])
      .some(b => b.rotation?.groups?.length >= 3 && (b.stations ?? []).length >= 3));
    check(!!rotating, 'one of them is a real circuit — three stations, three groups on a clock');
    check(planned.some(e => orgDateWithOffset(new Date(e.starts_at), 0) > today),
      'one plan is for a session still AHEAD — there is something to walk into and run');

    // Development: the winter's coaching, and a testing session that leaves honest blanks.
    const { data: goals } = await db.from('rep_player_development_goals').select('id, status').eq('team_id', teamId);
    check((goals ?? []).length >= 4 && (goals ?? []).some(g => g.status === 'achieved'),
      `${goals?.length} focus areas on the go, at least one already achieved`);
    const { data: sessions } = await db.from('rep_team_evaluation_sessions')
      .select('id, session_date, event_id').eq('program_year_id', py.id);
    check(sessions?.length === 1 && !!sessions[0].event_id,
      'one testing session, hung off the practice it was actually run at');
    const { data: roster } = await db.from('rep_roster_players')
      .select('id, guardian_email, player_number').eq('program_year_id', py.id).eq('status', 'active');
    const { data: readings } = await db.from('rep_player_measurables')
      .select('player_id, measurable_type_id, unit').eq('session_id', sessions?.[0]?.id ?? '');
    const tested = new Set((readings ?? []).map(r => r.player_id)).size;
    check(tested === (roster?.length ?? 0) - OFFSEASON_TESTING_ABSENT.length,
      `${tested} of ${roster?.length} players were tested — the ${OFFSEASON_TESTING_ABSENT.length} who missed have no row, not a zero`);
    check(new Set((readings ?? []).map(r => r.measurable_type_id)).size === OFFSEASON_MEASURABLE_TYPES.length,
      `all ${OFFSEASON_MEASURABLE_TYPES.length} tests were run`);
    check(!exampleOnly(roster ?? [], 'guardian_email'), 'every 14U guardian address is unreachable example.com');
  }
}

// ── 4. season start ──────────────────────────────────────────────────────────────────────────
console.log('\nSeason start — Riverdale Ridge 10U');
{
  const teamId = DEMO_COACH_TEAMS.seasonStart.id;
  const state = resolveSeasonStartState(now);
  const years = await programYears(teamId);
  const py = years.find(y => y.status === 'active');
  check(!!py && years.length === 1 && py?.year === thisYear, `one active program year (${thisYear})`);
  if (py) {
    const { data: events } = await db.from('rep_team_events')
      .select('id, event_type, starts_at, result, team_score, opponent_score').eq('program_year_id', py.id);
    const dated = datedEvents(events);
    const games = dated.filter(e => e.event_type === 'league_game');
    const played = games.filter(g => g.result != null);
    const ahead = games.filter(g => g.result == null);
    check(played.length === 3 && ahead.length >= 10,
      `${played.length} games played and ${ahead.length} still ahead — the year is laid out, not lived`);
    check(played.every(g => g.date < today) && played.every(g => g.team_score != null),
      'every played game is behind us AND carries its score');
    // The defect this moment is most likely to grow: a scheduled game slipping into the past with
    // no result, which reads as a coach who forgot to write it up.
    check(!ahead.some(g => g.date < today), 'no game sits in the past without a result');
    check(state.openingDate < today && games.some(g => g.date === state.openingDate),
      `opening day is ${state.openingDate} — a fortnight back, on a Saturday`);

    const { data: lineups } = await db.from('rep_team_lineups').select('id, event_id').eq('program_year_id', py.id);
    check(lineups?.length === 1, 'exactly ONE saved lineup — the opener\'s; the rest is still the coach\'s to write');
    const openerId = games.find(g => g.date === state.openingDate)?.id;
    check(lineups?.[0]?.event_id === openerId, 'and it belongs to the opening game');
    const { data: entries } = await db.from('rep_team_lineup_entries')
      .select('player_id, inning_positions, batting_order').eq('lineup_id', lineups?.[0]?.id ?? '');
    const fieldInnings = (entries ?? []).map(e =>
      Object.values(e.inning_positions ?? {}).filter(p => p && p !== 'Bench').length);
    check(fieldInnings.length === 12 && Math.min(...fieldInnings) >= 4,
      'everyone in the opener fielded at least four of six innings — this team is not the cautionary tale');

    await checkAttendanceMatchesTiming(py.id, dated, 'events');

    const { data: roster } = await db.from('rep_roster_players')
      .select('id, guardian_email, player_number, primary_position').eq('program_year_id', py.id).eq('status', 'active');
    check(roster?.length === 12 && roster.every(r => r.player_number && r.primary_position),
      'a complete roster: twelve players, every one with a number and a position');
    check(!exampleOnly(roster ?? [], 'guardian_email'), 'every 10U guardian address is unreachable example.com');

    /* Phase 3 — the first bills of a young season. The point of this team's books is the CONTRAST
       with the 12U's: a complete plan, barely spent against. Asserted as "some, and less than
       half", because a fixed dollar figure would just restate the world module at it. */
    const { data: spend } = await db.from('rep_team_expenses')
      .select('amount, expense_paid_at').eq('program_year_id', py.id);
    const spent = (spend ?? []).reduce((s, e) => s + Number(e.amount), 0);
    const planned = SEASON_START_BUDGET_LINES.reduce((s, l) => s + l.total, 0);
    check((spend ?? []).length === state.expenses.length && spent > 0 && spent < planned / 2,
      `the 10U has started spending but is well under plan ($${spent} of $${planned})`);
    check((spend ?? []).every(e => e.expense_paid_at && orgDateWithOffset(new Date(e.expense_paid_at), 0) <= today),
      'no 10U bill is dated in the future');

    const { data: installments } = await db.from('rep_player_dues_installments')
      .select('amount, due_date, paid_at, player_id').eq('team_id', teamId);
    const outstanding = overdueInstallments(installments);
    check(outstanding.length === 1 && Number(outstanding[0].amount) === SEASON_START_DUES.installmentAmount,
      'dues are mostly current — one family, one instalment behind');
  }
}

// ── 5. mid-season ────────────────────────────────────────────────────────────────────────────
console.log('\nMid-season — Riverdale Ridge 12U');
{
  const teamId = DEMO_COACH_TEAMS.midSeason.id;
  const state = resolveMidSeasonState(new Date());
  const years = await programYears(teamId);
  const py = years.find(y => y.status === 'active');
  check(!!py && years.length === 1 && py?.year === thisYear, `one active program year (${thisYear})`);
  if (py) {
    const { data: events } = await db.from('rep_team_events')
      .select('id, event_type, starts_at, result, team_score, opponent_score, opponent, practice_plan').eq('program_year_id', py.id);
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
    const overdue = overdueInstallments(installments);
    const overdueTotal = overdue.reduce((s, i) => s + Number(i.amount), 0);
    check(overdueTotal === 240 && new Set(overdue.map(i => i.player_id)).size === 2,
      '$240 overdue across exactly two families', `$${overdueTotal} across ${new Set(overdue.map(i => i.player_id)).size}`);

    /* ── The Bottle Drive: fundraising lowering a family's bill ────────────────────────────────
       Added 2026-08-14 with the season settlement sheet. Three things are pinned, and each is a
       way the story could rot without a single page failing to render:

         1. the drive is CLOSED and dated behind today — an OPEN drive has issued nothing, so the
            dues screen would show no credit at all and the tour's sentence would be about a thing
            that hasn't happened yet. It is also what the nightly re-anchor is now shifting;
         2. one family's last instalment is covered OUTRIGHT — "Covered by fundraising" is the
            single screen this whole moment exists to show, and it needs a rebate that exactly
            equals a bill;
         3. NO rebate reaches an overdue family. A credit landing on Dmitri's or Imani's open bill
            would clear it from the side and take the $240 story down with it — which is precisely
            why the entry list excludes them, and why that exclusion is asserted rather than
            trusted. */
    const { data: drives } = await db.from('rep_fundraisers')
      .select('id, name, end_date, is_active, player_rebate_percent, kind, sponsor_status')
      .eq('program_year_id', py.id);
    const drive = (drives ?? []).find(f => f.name === MIDSEASON_FUNDRAISER.name);
    check(!!drive && !drive.is_active && drive.end_date < today,
      `the ${MIDSEASON_FUNDRAISER.name} is closed and behind us — so its rebates are real credits`,
      drive ? `end ${drive.end_date}, active ${drive.is_active}` : 'no drive found');

    if (drive) {
      const { data: entries } = await db.from('rep_fundraiser_entries')
        .select('player_id, amount_raised, rebate_amount, credit_id').eq('fundraiser_id', drive.id);
      const { data: credits } = await db.from('rep_dues_credits')
        .select('player_id, amount, credit_type, credit_date').eq('program_year_id', py.id);
      check((entries ?? []).length === MIDSEASON_FUNDRAISER.entries.length
        && (entries ?? []).every(e => e.credit_id),
        `${MIDSEASON_FUNDRAISER.entries.length} families raised, each with its rebate credit linked`,
        `${(entries ?? []).length} entries, ${(entries ?? []).filter(e => e.credit_id).length} linked`);
      check((credits ?? []).every(c => c.credit_date <= today),
        'every rebate credit is dated on or before today (the re-anchor moves them with the bills)');
      const covered = (entries ?? []).some(e => Number(e.rebate_amount) === MIDSEASON_DUES.installmentAmount);
      check(covered,
        `one family's rebate covers a whole $${MIDSEASON_DUES.installmentAmount} instalment — the "Covered by fundraising" row`);
      const overdueIds = new Set(overdue.map(i => i.player_id));
      check(!(entries ?? []).some(e => overdueIds.has(e.player_id)),
        'no rebate lands on an overdue family — the $240 story is not cleared from the side');
    }

    /* ── The sponsor: the OTHER kind of money coming in ────────────────────────────────────────
       Added 2026-08-15 with the sponsorships follow-ups. Sponsorships shipped and the shop window
       did not follow — a prospect met a Fundraising tab that could only show a bottle drive, so
       the product had gained a distinction the demo could not say. A reseed that drops it would
       break nothing on screen, which is exactly why it is pinned here.

       ⚠ TWO OF THESE THREE ASSERTIONS PROTECT THE TOUR, NOT THE SPONSOR. A sponsor attributed to
       a family writes a dues credit onto that family's bill; the 12U's bills carry the $240-across-
       two-families story and the $90-of-$120 part-paid row, both narrated by name. So "no player"
       and "no credit" are not descriptions of how it happens to be seeded — they are the condition
       under which this sponsor is safe to exist at all. */
    const sponsor = (drives ?? []).find(f => f.name === MIDSEASON_SPONSOR.name);
    check(!!sponsor && sponsor.kind === 'sponsor' && sponsor.sponsor_status === 'received',
      `${MIDSEASON_SPONSOR.name} is a RECEIVED sponsor — money that has actually arrived, not a pledge`,
      sponsor ? `kind ${sponsor.kind}, status ${sponsor.sponsor_status}` : 'no sponsor found');
    if (sponsor) {
      const { data: sponsorEntries } = await db.from('rep_fundraiser_entries')
        .select('player_id, amount_raised, rebate_amount, credit_id').eq('fundraiser_id', sponsor.id);
      const rows = sponsorEntries ?? [];
      check(rows.length === 1 && Number(rows[0].amount_raised) === MIDSEASON_SPONSOR.amount,
        `it is ONE arrival of $${MIDSEASON_SPONSOR.amount} — a sponsor is its single entry, never a roster of them`,
        `${rows.length} entries`);
      check(rows.every(e => e.player_id === null && Number(e.rebate_amount) === 0 && !e.credit_id),
        'it is CLUB-WIDE and credits nobody — so it cannot clear the overdue bills the tour narrates');
    }

    /* The money WITH THE CLUB — the two tabs only a club-run team has, and the two this world
       showed EMPTY until 2026-08-16. A prospect on the Club plan is shopping for exactly this
       relationship, so "the screens render" is not the bar: they have to have something in them. */
    const { data: splits } = await db.from('rep_allocation_splits')
      .select('id, amount, notes, rep_cost_allocations ( description )').eq('team_id', teamId);
    const split = (splits ?? [])[0];
    check((splits ?? []).length === 1
       && split?.rep_cost_allocations?.description === MIDSEASON_CLUB_MONEY.allocation.description
       && Number(split.amount) === MIDSEASON_CLUB_MONEY.allocation.teamShare,
      `the club has billed the 12U $${MIDSEASON_CLUB_MONEY.allocation.teamShare} — Org Allocations is not an empty screen`,
      split ? `${(splits ?? []).length} split(s), $${split.amount}` : 'no allocation split found');

    if (split) {
      const { data: insts } = await db.from('rep_allocation_installments')
        .select('amount, due_date, paid_at').eq('split_id', split.id);
      const rows2 = insts ?? [];
      const paid = rows2.filter(i => i.paid_at);
      check(rows2.length === MIDSEASON_CLUB_MONEY.allocation.installments.length && paid.length === 2,
        'it is part paid — two instalments settled, one still ahead, which is what a mid-season team actually looks like',
        `${rows2.length} instalments, ${paid.length} paid`);
      /* ⚠ THE ONE THAT MUST NOT DRIFT. The demo carries exactly one honest problem — the overdue
         families the guided tour narrates by name. An overdue club instalment on a neighbouring tab
         competes with it for the prospect's attention. */
      check(!rows2.some(i => !i.paid_at && i.due_date < today),
        'and NOTHING here is overdue — the demo keeps its one red thing on Player Dues, where the tour points');
    }

    const { data: reqs } = await db.from('rep_team_payment_requests')
      .select('request_type, amount, status').eq('team_id', teamId);
    const rq = reqs ?? [];
    check(rq.length === MIDSEASON_CLUB_MONEY.requests.length
       && rq.some(r => r.request_type === 'charge_to_org' && r.status === 'approved')
       && rq.some(r => r.request_type === 'payment_to_org' && r.status === 'pending'),
      'Payments shows money moving BOTH ways — one reimbursement approved, one payment awaiting the club',
      `${rq.length} request(s): ${rq.map(r => `${r.request_type}/${r.status}`).join(', ')}`);
    check(!rq.some(r => r.status === 'denied'),
      'and none of them is DECLINED — a club refusing this coach is a sour note in a shop window');

    const { data: roster } = await db.from('rep_roster_players')
      .select('id, guardian_email').eq('program_year_id', py.id).eq('status', 'active');
    const { data: waivers } = await db.from('rep_player_documents')
      .select('player_id').eq('team_id', teamId).eq('document_type', 'waiver');
    const signed = new Set((waivers ?? []).map(x => x.player_id));
    const unsigned = (roster ?? []).filter(r => !signed.has(r.id));
    check(roster?.length === 12 && unsigned.length === 1, '12 on the roster, exactly one waiver unsigned');

    /**
     * THREE practices are written up — two behind us, and one on this week's Thursday.
     *
     * ⚠ THIS ASSERTION USED TO READ "two … both already behind us", AND WENT STALE THE MOMENT THE
     * OWNER RULED OTHERWISE (2026-08-15, COACH_NAV_AND_PRACTICE_PLANS_PLAN.md §5). Seeding plans
     * on past practices only was right while a plan was invisible unless you opened the practice.
     * The new Practice plans hub changed that: a prospect clicking that door met "Coming up" with
     * every practice marked **No plan** and a "Needs a plan · 3" chip — the shop window's loudest
     * read being that the coach is behind. So a third plan went onto an upcoming practice. The
     * world module was updated; this check was not, and only a re-seed could reveal that.
     *
     * ⚠ DO NOT ASSERT "exactly one upcoming". P-THU-0 is ahead Sunday→Wednesday and behind
     * Thursday→Saturday (the 12U has no practices past this week), so an upcoming-count assertion
     * would pass for half the week and fail for the other half — a check that depends on the day
     * you run it is worse than no check. Two-or-more behind us is true every day.
     *
     * Still safe for the Overview: `resolveOverviewAnchor` reads the next event's TYPE, never
     * whether it carries a plan, so Saturday's unset lineup stays that team's one thing.
     */
    const plannedPractices = (events ?? []).filter(e => e.practice_plan)
      .map(e => orgDateWithOffset(new Date(e.starts_at), 0));
    check(plannedPractices.length === 3 && plannedPractices.filter(d => d < today).length >= 2,
      'three practices are written up, at least two of them behind us');
    check(!exampleOnly(roster ?? [], 'guardian_email'), 'every 12U guardian address is unreachable example.com');

    /* The 12U was the only team with practices and NO attendance-timing assertion — and it is the
       team most exposed to it: its Tuesday/Thursday practices sit in the current week, so one
       crosses into the past mid-week, every week. That is the exact gap the re-anchor's attendance
       backfill was written to close, and until now nothing would have caught it regressing here. */
    await checkAttendanceMatchesTiming(py.id, datedEvents(events), 'events');

    /* ── Phase 3: the books, and the two rows the guided tour addresses by name ──────────────
       Until 2026-08-05 this team showed a full plan and $0.00 spent — a season 18 games old with
       no expense ever logged, which is the one thing a money screen must never look like. The
       matching is what makes it work: budget-vs-actual pairs an expense to a line by CATEGORY
       NAME, so a line without a category files every dollar as unbudgeted. Both halves are
       asserted, because either one alone leaves the report empty. */
    const { data: budgetLines } = await db.from('rep_budget_lines')
      .select('description, total_amount, category_id').eq('program_year_id', py.id);
    check((budgetLines ?? []).length === MIDSEASON_BUDGET_LINES.length
      && (budgetLines ?? []).every(l => l.category_id),
      'every 12U budget line hangs off a real category (or the report files the season as unbudgeted)');

    const { data: spend } = await db.from('rep_team_expenses')
      .select('description, category, budget_item_id, amount, expense_paid_at').eq('program_year_id', py.id);
    check((spend ?? []).length === state.expenses.length,
      `${state.expenses.length} expenses logged against the 12U's season`, `found ${(spend ?? []).length}`);
    // Every 12U cost names its item (mig 240) — this is the team whose Budget vs. Actual a
    // prospect is most likely to open, and its rows now carry real actuals rather than dashes.
    // ⚠ Two entry fees and two diamond rentals SUM into one row each, which is the ruling this
    // world exists to demonstrate: six costs, four rows.
    check((spend ?? []).every(e => e.budget_item_id),
      'every 12U cost names its budget item — the report reads item by item');
    check((spend ?? []).every(e => e.expense_paid_at && orgDateWithOffset(new Date(e.expense_paid_at), 0) <= today),
      'no 12U bill is dated in the future');

    // The one deliberate anomaly: Facilities is OVER plan, and it is the only line that is.
    // A demo whose every line comes in under budget teaches a prospect the report flatters them.
    const plannedByCategory = new Map(MIDSEASON_BUDGET_LINES.map(l => [l.category.toLowerCase(), l.total]));
    const spentByCategory = new Map();
    for (const e of spend ?? []) {
      const key = String(e.category ?? '').toLowerCase();
      spentByCategory.set(key, (spentByCategory.get(key) ?? 0) + Number(e.amount));
    }
    const over = [...plannedByCategory].filter(([cat, planned]) => (spentByCategory.get(cat) ?? 0) > planned);
    check(over.length === 1 && over[0][0] === 'facilities',
      'exactly one 12U category is over plan, and it is Facilities',
      over.length ? over.map(([c]) => c).join(', ') : 'every line came in under');
    check([...spentByCategory.keys()].every(cat => plannedByCategory.has(cat)),
      'every 12U expense lands on a category the plan names (the unbudgeted beat belongs to the 14U)');

    /* The guided tour's "read what a parent gets" step addresses ONE player's page directly, so
       that row's id must survive a reseed — and it must still be the player the step BEFORE it
       names, or the tour tells two stories about two different children. */
    const showcase = (roster ?? []).find(r => r.id === DEMO_COACH_SHOWCASE.midSeasonPlayerId);
    check(!!showcase, 'the guided tour\'s showcase player exists at its fixed id');
    const { data: showcaseRow } = await db.from('rep_roster_players')
      .select('display_order').eq('id', DEMO_COACH_SHOWCASE.midSeasonPlayerId).maybeSingle();
    check(showcaseRow?.display_order === MIDSEASON_SHOWCASE_ROSTER_INDEX,
      'the showcase player is still the playing-time outlier the previous step names');
  }
}

// ── 6. season's end ──────────────────────────────────────────────────────────────────────────
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
  console.log(`   Off-season:   ${moneySectionHref(`/${demoOrg.slug}/coaches/teams/${DEMO_COACH_TEAMS.offSeason.id}`, 'budget-vs-actual')}`);
  console.log(`   Season start: /${demoOrg.slug}/coaches/teams/${DEMO_COACH_TEAMS.seasonStart.id}/schedule`);
  console.log(`   Mid-season:   ${demoOrg.landingPath}`);
  console.log(`   Season's End: /${demoOrg.slug}/coaches/teams/${DEMO_COACH_TEAMS.seasonsEnd.id}/season-end`);
  process.exit(0);
}
