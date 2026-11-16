/**
 * seed-notification-rows-walk.mjs  (DEV ONLY)
 *
 * The fixture for the one walk of "Notifications that read at a glance" (plan
 * docs/projects/archive/NOTIFICATION_MESSAGE_ROWS_PLAN.md, Stage 6). It puts one real notice of every kind that now opens
 * as labelled rows into two bells, so the walk opens each one instead of waiting for the product to send it:
 *
 *   · the UAT Rep Club's OWNER  (uat-club-owner@uat-rep-club.local)  — the money, club, house-league and moved-games notices
 *   · the UAT COACH             (uat-coach@uat-test-org.local, a coach of the same club) — the coach-portal notices
 *
 * Every notice is built by the SAME words code the senders call (lib/*words*.ts and friends), never typed by hand, so what the
 * walk shows is what the product sends. The three it does NOT seed are the score notices (Stage 5), which the walk makes by
 * entering real scores. Two extras: a notice stored with the old paragraph only (it must keep its paragraph) and one stored
 * with the first bespoke shape (`metadata.timeChange`; it must still open as rows).
 *
 * What it does NOT reproduce: each money notice's "needs attention" buttons and its settled line (those hang off the real
 * sender's own subject keys); the walk says so. The rows, the one line, the next step and the folds are all real.
 *
 * Idempotent: tagged metadata.seed = 'notif-rows-walk'; it deletes its own earlier rows for those two people first.
 * Remove:  delete from notifications where metadata->>'seed' = 'notif-rows-walk'
 * Run:     node scripts/seed-notification-rows-walk.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import '../tests/ts-resolver.mjs';

const env = readFileSync('.env.local', 'utf8');
const get = k => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const url = get('NEXT_PUBLIC_SUPABASE_URL');
const key = get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !key) { console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local.'); process.exit(1); }
// ⚠ The production refusal (the same one the sibling seeds carry). `.env.local` is the DEV project; production is this ref.
if (url.includes('qcttcboqysynwcdyghil')) { console.error('✗ Refusing to run: that is the PRODUCTION project.'); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

const L = async p => import(p);
const { NOTIFICATION_EVENT_LABELS } = await L('../lib/notification-labels.ts');
const { DEBIT_NOTICE_WORDS: DW, DISPUTE_WORDS: D, LEAGUE_ONLINE_NOTICE_WORDS: LW, OVER_WORDS: OW, notRecordedNotice, refundFailedNotice } = await L('../lib/online-payment-words.ts');
const { CLUB_MONEY_NOTICE } = await L('../lib/club-money-words.ts');
const { SCHEDULE_NOTICES } = await L('../lib/club-schedule-words.ts');
const { FAMILY_HANDOFF_COACH_WORDS } = await L('../lib/families-words.ts');
const { HAND_BACK_WORDS: H } = await L('../lib/club-hand-back-words.ts');
const { LEAGUE_ADMIN_NOTICE, NO_LEAGUE_COUNTS } = await L('../lib/club-schedule-league-words.ts');
const { coachBellWords } = await L('../lib/family-availability-words.ts');
const { formatInsightDigest } = await L('../lib/insight-findings.ts');
const { championsNotice } = await L('../lib/champions.ts');
const { signupNotice } = await L('../lib/league-signup.ts');
const { ASK_WORDS } = await L('../lib/house-league-money-words.ts');
const { staffApprovalNotice } = await L('../lib/coach-capabilities.ts');
const { practicePlanSentMessage } = await L('../lib/practice-plan-send.ts');
const { clubSeasonNotice } = await L('../lib/club-season-notice.ts');
const { timeChangeAsFacts } = await L('../lib/league-time-notice.ts');
const { scoreNotice } = await L('../lib/score-notice.ts');

const OWNER_EMAIL = 'uat-club-owner@uat-rep-club.local';
const COACH_EMAIL = 'uat-coach@uat-test-org.local';
const SLUG = 'uat-rep-club';

const { data: org } = await sb.from('organizations').select('id,slug,name').eq('slug', SLUG).single();
if (!org) throw new Error(`no ${SLUG} organization on this database`);
const { data: users } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
const owner = users.users.find(u => u.email === OWNER_EMAIL);
const coach = users.users.find(u => u.email === COACH_EMAIL);
if (!owner || !coach) throw new Error('the UAT club owner or the UAT coach account is missing');
const { data: team } = await sb.from('rep_teams').select('id').eq('org_id', org.id).eq('slug', 'uat-test-team').maybeSingle();
const teamLink = team ? `/${SLUG}/coaches/teams/${team.id}` : `/${SLUG}/coaches`;

await sb.from('notifications').delete().in('user_id', [owner.id, coach.id]).eq('org_id', org.id).contains('metadata', { seed: 'notif-rows-walk' });

const MIN = 60_000;
let n = 0;
const rows = [];
/** `who`: owner | coach. `n` is a notice from the words code ({ title?, body, facts? }). */
function add(who, kind, notice, link, extraMeta = {}) {
  const user = who === 'owner' ? owner : coach;
  rows.push({
    user_id: user.id, org_id: org.id, event_type: kind,
    title: notice.title ?? NOTIFICATION_EVENT_LABELS[kind] ?? kind,
    body: notice.body ?? null, link,
    created_at: new Date(Date.now() - (5 + n++ * 7) * MIN).toISOString(), read_at: null,
    metadata: { seed: 'notif-rows-walk', ...(notice.facts ? { facts: notice.facts } : {}), ...extraMeta },
  });
}
const admin = `/${SLUG}/admin`;
const team12 = { team: 'Ridge 12U' };
const kids = { children: 'Henry', one: true };

// ── The club owner's bell ────────────────────────────────────────────────────────────────────────────────────────────
add('owner', 'debit_returned', DW.returned({ who: kids, total: '$450.00', last4: '6789', day: 'Nov 8', reason: 'insufficient_funds', emailed: true }), admin);
add('owner', 'debit_returned', DW.returned({ who: team12, total: '$450.00', last4: null, day: 'Nov 8', reason: null, emailed: false }), admin);
add('owner', 'debit_reversed', DW.reversed({ who: kids, receiptNo: '1042', total: '$450.00', day: 'Nov 8', owed: '$450.00', emailed: true }), admin);
add('owner', 'card_disputed', D.item({ payer: 'Pat Doe', receiptNo: '1042', amount: '$450.00', reason: 'fraudulent', held: '$450.00', inquiry: false, due: 'Nov 20 at 11:59 p.m.', dueDay: 'Nov 20', answers: null }), admin);
add('owner', 'card_dispute_lost', D.lostNotice({ who: team12, receiptNo: '1042', amount: '$450.00', day: 'Nov 8', owed: '$450.00' }), admin);
add('owner', 'card_refund_failed', refundFailedNotice({ amount: '$150.00', bank: false, card: 'Visa •••• 4242', bankLast4: null, whose: team12, sent: true }), admin);
add('owner', 'card_refund_still_enrolled', LW.enrolled({ amount: '$150.00', to: 'Visa •••• 4242', day: 'Nov 8', childFirst: 'Henry', owing: '$150.00' }), admin);
add('owner', 'card_refund_whose', LW.whose({ children: ['Henry', 'Sam', 'Ella'], total: '$450.00', receiptNo: '1042' }), admin);
add('owner', 'online_payment_not_recorded', notRecordedNotice({ amount: '$150.00', bank: false, day: 'Nov 8', payer: 'Pat Doe', forWhat: 'Henry Doe', reason: 'the registration isn’t accepted', team: false }), admin);
add('owner', 'online_payment_over', OW.notice({ amount: '$450.00', receiptNo: '1042', day: 'Nov 8', extra: '$50.00', bank: false, whole: false }), admin);
add('owner', 'club_payment_not_received', FAMILY_HANDOFF_COACH_WORDS.admin({ team: 'Ridge 12U', child: 'Henry', amount: '$150.00', method: 'E-Transfer', receivedDay: 'Nov 8' }), admin);
add('owner', 'club_hand_back_asked', H.bellAsked({ teamName: 'Ridge 12U', count: 4, cents: 43_200, scheduleName: 'Winter dome', first: '2026-11-08', last: '2026-11-29' }), admin);
add('owner', 'club_hand_back_unasked', H.bellUnasked({ name: 'Riley Chen', count: 4, scheduleName: 'Winter dome', first: '2026-11-08', cents: 43_200 }), admin);
add('owner', 'club_schedule_league_changes', LEAGUE_ADMIN_NOTICE.notice({
  scheduleName: 'Winter dome', divisions: ['U10', 'U12'], ...NO_LEAGUE_COUNTS, moved: 3, gamesMoved: 9, gamesNeedDate: 1, gamesWaiting: 9,
  gameLines: Array.from({ length: 9 }, (_, i) => `U12 · Sun, Nov ${15 + i}: Field 2 → Field 4`),
}), admin);
add('owner', 'house_league_time_given', { title: 'The club gave house league time', ...(() => {
  const facts = timeChangeAsFacts({ schedule: 'Winter dome', season: 'Spring 2027', grows: true, blocks: [
    { label: 'Gives', hours: '2 hours a week', range: 'Mar 13 – Apr 3', lines: ['Sat · 11:00 a.m.–12:00 p.m. · Diamond A', 'Sat · 12:00–1:00 p.m. · Diamond B'] }] });
  return { body: 'Winter dome gives house league 2 hours a week, Mar 13 – Apr 3.', facts };
})() }, admin);
add('owner', 'champions_crowned', championsNotice(Array.from({ length: 3 }, (_, i) => ({ division: `U${10 + i}`, champion: `Team ${i + 1}`, runnerUp: null }))), admin);
const kid = (firstName, status) => ({ firstName, lastName: 'Kim', status });
add('owner', 'house_league_registration_new', signupNotice([kid('Henry', 'active'), kid('Ava', 'waitlisted'), kid('Sam', 'pending_review')], 'Grace Kim', 'Summer 2027'), admin);
add('owner', 'house_league_registration_new', signupNotice([kid('Henry', 'active')], 'Grace Kim', 'Summer 2027', 'entered'), admin);
add('owner', 'house_league_withdraw_request', ASK_WORDS.notice('Ava Kim', 'Grace Kim', 'Summer 2027', 'Ava broke her wrist — we’ll be back in the fall.'), admin);
add('owner', 'assistant_coach_approval_requested', staffApprovalNotice({ email: 'Pat.Lee+coach@Example.com', teamName: 'Ridge 12U', invitedByName: 'Sam Lee', staffKind: 'assistant' }), admin);
// Three scores on one day fold into one bundle, which opens as its members' one-line bodies, never rows.
const game = { away: 'Hawks', home: 'Ridge 12U', division: 'U13' };
for (const [a, h] of [[4, 6], [2, 2], [7, 1]]) add('owner', 'score_submitted', scoreNotice({ game, result: { kind: 'score', awayScore: a, homeScore: h }, held: false, enteredBy: 'kim@example.com' }), admin);
// Two older notices that must still open: the old paragraph only, and the first bespoke shape.
add('owner', 'payment_received', { title: 'Payment received', body: 'Pat Doe paid $450.00 by e-transfer for Henry Doe. Receipt 1042, recorded Nov 6.' }, admin);
add('owner', 'house_league_time_given', {
  title: 'The club gave house league time (sent before the change)', body: 'Winter dome gives house league 1 hour a week, Mar 13 – Apr 3.',
}, admin, { timeChange: { schedule: 'Winter dome', season: 'Spring 2027', grows: false, blocks: [{ label: 'Gives', hours: '1 hour a week', range: 'Mar 13 – Apr 3', lines: ['Sat · 11:00 a.m.–12:00 p.m. · Diamond A'] }] } });

// ── The coach's bell ─────────────────────────────────────────────────────────────────────────────────────────────────
add('coach', 'team_money_sent', CLUB_MONEY_NOTICE.sent({ teamName: 'Ridge 12U', amount: 216, what: 'Winter dome, 2 of 4', sentOn: '2026-11-08', how: 'E-Transfer 4471' }), teamLink);
add('coach', 'club_bill_arrived', SCHEDULE_NOTICES.bill({ orgName: 'Riverdale', teamName: 'Ridge 12U', cents: 86_400, scheduleName: 'Winter dome', first: { installmentNumber: 1, amount: 216, dueDate: '2026-11-15' }, payments: 4 }), teamLink);
add('coach', 'club_schedule_review', SCHEDULE_NOTICES.review({ orgName: 'Riverdale', scheduleName: 'Winter dome', teamName: 'Ridge 12U', slots: 8, billCents: 86_400, replyBy: '2026-11-20' }), teamLink);
add('coach', 'club_hand_back_answered', H.bellAnswered({ answer: 'accepted', late: false, scheduleName: 'Winter dome', count: 4, creditCents: 43_200, payCents: 10_800, teamName: 'Ridge 12U',
  moves: [{ dueDate: '2027-02-01', fromCents: 86_400, toCents: 43_200 }, { dueDate: '2026-12-01', fromCents: 43_200, toCents: 0 }] }), teamLink);
add('coach', 'club_hand_back_answered', H.bellAnswered({ answer: 'declined', late: false, scheduleName: 'Winter dome', count: 4, reason: 'We can’t re-sell those dates.' }), teamLink);
const bell = over => ({ child: 'Maya', answer: 'attending', prior: 'absent', parent: 'Dana', hasNote: false, count: '11 of 14 in · 2 out · 1 maybe', eventLabel: 'Sat vs Lakeshore', eventDay: 'Sat, Nov 8', ...over });
add('coach', 'family_availability_response', coachBellWords({ kind: 'event', items: [bell({}), bell({ child: 'Leo', answer: 'absent', prior: null, hasNote: true }), bell({ child: 'Sam', answer: 'maybe', prior: 'attending' })] }), teamLink);
add('coach', 'family_availability_response', coachBellWords({ kind: 'event', items: ['Maya', 'Leo', 'Sam', 'Ava', 'Ben', 'Cal', 'Dee', 'Eli'].map(child => bell({ child })) }), teamLink);
add('coach', 'family_availability_response', coachBellWords({ kind: 'family', items: [bell({ answer: 'absent', prior: 'attending' }), bell({ answer: 'absent', prior: null, eventDay: 'Sat, Nov 15', hasNote: true })] }), teamLink);
add('coach', 'coach_insights_digest', formatInsightDigest([
  { tier: 'good-news', tone: 'good', report: 'results', text: 'Won 4 of your last 5.' },
  { tier: 'attendance', tone: 'warn', report: 'attendance', text: 'Maya Chen has made 5 of 9 tracked sessions this season.' },
]), teamLink);
const plan = (myLabels, arriveLabel = '5:45 p.m.') => practicePlanSentMessage({ dayLabel: 'Tuesday', startLabel: '6:00 p.m.', arriveLabel, myLabels });
add('coach', 'practice_plan_sent', plan(['Close control', 'Footwork ladder']), teamLink);
add('coach', 'practice_plan_sent', plan(['Close control', 'Footwork ladder', 'Rondo', 'Wall passing', 'Finishing', 'Cool-down']), teamLink);
const carried = { players: 14, budgetPlan: true, feePlan: true, openingBalance: false };
add('coach', 'club_season_changed', clubSeasonNotice({ clubName: 'Northfield', teamName: 'Ridge 12U', action: 'started', seasonName: '2027 Season', previousSeasonName: '2026 Season', carried }), teamLink);
add('coach', 'club_season_changed', clubSeasonNotice({ clubName: 'Northfield', teamName: 'Ridge 12U', action: 'started', seasonName: '2027 Season', previousSeasonName: null, carried: null, tryoutsOpen: true }), teamLink);

const { error } = await sb.from('notifications').insert(rows);
if (error) throw error;
console.log(`seeded ${rows.length} notices: ${rows.filter(r => r.user_id === owner.id).length} for ${OWNER_EMAIL}, ${rows.filter(r => r.user_id === coach.id).length} for ${COACH_EMAIL} (org ${SLUG})`);
