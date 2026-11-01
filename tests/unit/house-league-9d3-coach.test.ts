import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { coachCopyWords, coachToldLine, coachToldWords, COACH_TOLD_WORDS } from '../../lib/league-practice-tell.ts';
import { coachFeedUrl, signCoachCalendarToken, verifyCoachCalendarToken } from '../../lib/coach-calendar-link.ts';
import { SUBSCRIBE_WORDS as W } from '../../lib/calendar-subscribe-words.ts';
import { readCode } from './_source-code.ts';

/**
 * HOUSE LEAGUE STAGE 9d-3, SESSION 2 — THE COACH'S SIDE (Parts 5–6; rulings 9d3·4, 9d3·5; words
 * HOUSE_LEAGUE_STAGE9D3_COPY.md sections D, E, F). The line under the coach's Schedule heading, the coaches' one copy of
 * the first send, and the coach's own Subscribe — a link signed in its OWN domain, a feed that stops into an empty calendar,
 * and a removal or a new person that kills the link (mig 420).
 * (Kept apart from league-practice-tell.test.ts so a commit of this session never carries another session's hunk there.)
 */

const sql = (name: string) => readFileSync(join(process.cwd(), 'supabase', 'migrations', name), 'utf8');
const SECRET = 'x'.repeat(40);
const ROW = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const AT = '2026-06-16T22:00:00.000Z';

describe('the coach\'s line under the Schedule heading (copy section E, frame b2)', () => {
  it('told, untold and changed read the copy\'s words, the day in the club\'s zone', () => {
    assert.equal(coachToldWords({ kind: 'told', at: AT }), 'Families were told these practice times on Tue, Jun 16.');
    assert.equal(coachToldWords({ kind: 'untold' }), 'Families haven’t been told these practice times yet. A club admin or league admin sends them.');
    assert.equal(coachToldWords({ kind: 'changed', at: AT }), 'Families were told different times on Tue, Jun 16. They haven’t been sent these times yet.');
    assert.equal(COACH_TOLD_WORDS.never, 'No practices yet. Nobody has handed any out.');
  });
  it('a line only says what is true of what the coach can see', () => {
    assert.deepEqual(coachToldLine({ state: 'told', toldAt: AT, listed: 3, everHad: true }), { kind: 'told', at: AT });
    // The season's last practice has passed: nothing listed, nothing to say "these" about.
    assert.equal(coachToldLine({ state: 'told', toldAt: AT, listed: 0, everHad: true }), null);
    assert.deepEqual(coachToldLine({ state: 'untold', toldAt: null, listed: 2, everHad: true }), { kind: 'untold' });
    // Every told practice was taken away: families still think there are practices.
    // ...and with nothing listed "these times" would point at nothing, so the line says they were taken away.
    assert.deepEqual(coachToldLine({ state: 'changed', toldAt: AT, listed: 0, everHad: true }), { kind: 'changed', at: AT, emptied: true });
    assert.deepEqual(coachToldLine({ state: 'changed', toldAt: AT, listed: 2, everHad: true }), { kind: 'changed', at: AT });
    assert.equal(coachToldWords({ kind: 'changed', at: AT, emptied: true }), 'Families were told practice times on Tue, Jun 16. Those practices have since been taken away, and families haven’t been told.');
    // "Nobody has handed any out" only when it is true.
    assert.deepEqual(coachToldLine({ state: 'none', toldAt: null, listed: 0, everHad: false }), { kind: 'never' });
    assert.equal(coachToldLine({ state: 'none', toldAt: null, listed: 0, everHad: true }), null);
    assert.equal(coachToldLine({ state: 'none', toldAt: null, listed: 1, everHad: true }), null);
  });
  it('the page reads the told state with the Tell step\'s own rule, a live season only, and says "No practices yet." once', () => {
    const coach = readCode('lib/house-league-coach.ts');
    assert.match(coach, /view === 'open' \? readTellOf\(card\.orgId, teamId\)/);
    assert.match(coach, /readPracticesNow\(orgId, \[teamId\]\), readTold\(\[teamId\]\)/);
    assert.match(coach, /tellStateOf\(now\.get\(teamId\) \?\? \[\], row, Date\.now\(\)\)/);
    const schedule = readCode('app/[orgSlug]/league/[seasonSlug]/team/[teamId]/CoachSchedule.tsx');
    assert.ok(schedule.includes("practices.length === 0 && toldLine?.kind !== 'never'"));
  });
});

describe('the coaches\' one copy of the first send (copy section D)', () => {
  it('the words: subject, greeting, counts with their singulars, the team page link, the foot', () => {
    const w = coachCopyWords({ club: 'Riverdale', team: 'Twins', season: '2026 Season', firstName: ' Pat ', families: 12, dates: 9, path: '/r/league/s/team/t' });
    assert.equal(w.subject, 'Twins families were sent their practice times');
    assert.equal(w.greeting, 'Hi Pat,');
    assert.deepEqual(w.paragraphs, ['Riverdale emailed 12 Twins families their practice times today. The email lists all 9 dates, and the same dates are on your team page.']);
    assert.deepEqual(w.link, { label: 'Open Twins’ team page →', path: '/r/league/s/team/t' });
    assert.equal(w.foot, 'You’re getting this because you coach Twins in 2026 Season.');
    // A late first reach (every listed date has passed) never reads "all 0 dates".
    const late = coachCopyWords({ club: 'Riverdale', team: 'Twins', season: '2026 Season', firstName: null, families: 1, dates: 0, path: '/p' });
    assert.ok(!/\b0 dates\b/.test(late.paragraphs[0]));
    assert.match(late.paragraphs[0], /emailed 1 Twins family their practice times/);
    const one = coachCopyWords({ club: 'Riverdale', team: 'Reds', season: 'S', firstName: null, families: 1, dates: 1, path: '/' });
    assert.equal(one.greeting, 'Hi,');
    assert.equal(one.paragraphs[0], 'Riverdale emailed 1 Reds family their practice times today. The email lists the date, and the same date is on your team page.');
  });
  it('claimed once per team — only a team THIS send told — before any email; accepted coaches only; its own file', () => {
    const copy = readCode('lib/league-practice-coach-copy.ts');
    const claim = copy.indexOf(".is('coaches_copied_at', null)");
    assert.ok(claim > 0 && copy.indexOf(".eq('notice_id', p.noticeId)") < claim, 'the claim names the send and the unclaimed');
    assert.ok(claim < copy.indexOf('sendEmail('), 'claimed before it is sent');
    assert.match(copy, /\.eq\('kind', 'first'\)/);
    assert.match(copy, /\.is\('removed_at', null\)\.not\('accepted_at', 'is', null\)\.not\('user_id', 'is', null\)/);
    assert.ok(!/guardian/i.test(copy), 'no guardian-shaped name beside a raw sendEmail (family-email guard)');
    const server = readCode('lib/league-practice-tell-server.ts');
    assert.equal((server.match(/await copyCoachesOnFirstTell\(/g) ?? []).length, 2, 'after the press and after "Send again"');
    const m415 = sql('415_families_are_told_their_practice_times.sql');
  // The backfill (rows told before the column existed count as copied) runs only in the run that ADDS the column.
  assert.match(m415, /IF NOT EXISTS \(SELECT 1 FROM information_schema\.columns[\s\S]*?column_name = 'coaches_copied_at'\) THEN\s+ALTER TABLE public\.league_team_practices_told ADD COLUMN coaches_copied_at timestamptz;\s+UPDATE public\.league_team_practices_told SET coaches_copied_at = told_at;/);
  });
});

describe('the coach\'s Subscribe (9d3·5, copy section F)', () => {
  it('a house-league token is signed in its own domain: never a rep token, never the reverse; the rep\'s is unchanged', () => {
    const league = signCoachCalendarToken(ROW, 2, SECRET, 'league-coach-calendar');
    const rep = signCoachCalendarToken(ROW, 2, SECRET);
    assert.notEqual(league, rep);
    assert.deepEqual(verifyCoachCalendarToken(league, SECRET, 'league-coach-calendar'), { membershipId: ROW, generation: 2 });
    assert.equal(verifyCoachCalendarToken(league, SECRET), null);
    assert.equal(verifyCoachCalendarToken(rep, SECRET, 'league-coach-calendar'), null);
    assert.equal(coachFeedUrl('https://x.ca/', 'T', 'league-coach-calendar'), 'https://x.ca/api/calendar/league-coach/T.ics');
    assert.equal(coachFeedUrl('https://x.ca/', 'T'), 'https://x.ca/api/calendar/coach/T.ics');
  });
  it('removal and a new person on the row kill the link (mig 420)', () => {
    const m = sql('420_a_house_league_coach_subscribes_to_the_schedule.sql');
    assert.match(m, /BEFORE UPDATE OF removed_at, user_id ON public\.league_team_coaches/);
    assert.match(m, /old\.removed_at IS NULL AND new\.removed_at IS NOT NULL/);
    assert.match(m, /old\.user_id IS NOT NULL AND new\.user_id IS DISTINCT FROM old\.user_id/);
    assert.match(m, /new\.calendar_link_generation := old\.calendar_link_generation \+ 1/);
  });
  it('the feed: a stopped link is an empty calendar, only a forged one is the counted 404, a live season only, private', () => {
    const route = readCode('app/api/calendar/league-coach/[token]/route.ts');
    assert.match(route, /case 'stopped':\s*return calendarResponse\(\{ calendarName: answer\.calendarName, entries: \[\]/);
    assert.equal((route.match(/refusedFeedResponse\(req\)/g) ?? []).length, 1);
    assert.ok(!route.includes('PUBLIC_FEED_CACHE'));
    const feed = readCode('lib/league-coach-calendar.ts');
    assert.match(feed, /verifyCoachCalendarToken\(token, secret, LEAGUE_COACH_DOMAIN\)/);
    assert.match(feed, /link\.generation !== named\.generation/);
    assert.match(feed, /if \(view !== 'open'\) return \{ kind: 'stopped', calendarName \}/);
    assert.match(feed, /if \(shouldRecordCalendarRead\(link\.lastReadOn, today\)\)/);
    // Games as last SENT, only once the schedule is published; never a plan gate (none is ruled).
    const coach = readCode('lib/house-league-coach.ts');
    assert.match(coach, /p\.divisionId && p\.schedulePublished \? readGamesAsSent\(/);
    assert.match(coach, /games: asLastSent\(games, held\)/);
    assert.ok(!/orgPlanCarries|plan-config|module_families/.test(feed));
  });
  it('the link route: the signed-in coach\'s own live seat, Reset a compare-and-set on the generation shown', () => {
    const route = readCode('app/api/league/[orgSlug]/[seasonSlug]/team/[teamId]/calendar-link/route.ts');
    assert.match(route, /getOwnLeagueCoachLink\(user\.id, teamId\)/);
    assert.match(route, /houseLeagueCoachAccess\(\[link\], user\.id, teamId, team\.season\) !== 'open'/);
    assert.match(route, /typeof body\.generation === 'number' \? body\.generation : null/);
  assert.match(route, /const after = shown !== null && shown === own\.link\.generation \? await resetLeagueCoachLink\(own\.link\.id, shown\) : null;/);
  });
  it('one new sentence; the button is the word at a desk and the named mark on a phone, on the Schedule line, a live season only', () => {
    assert.equal(W.whatsInLeagueCoach('U9', true), 'This season’s games and practices. Cancelled events stay, marked.');
    assert.equal(W.whatsInLeagueCoach('U9', false), 'This season’s games and practices. Cancelled events stay, marked. A game appears once U9’s schedule is published, and a change to a game appears once the league admin sends it.');
    assert.equal(W.coachButtonLabel, 'Subscribe in your calendar app');
    const page = readCode('app/[orgSlug]/league/[seasonSlug]/team/[teamId]/page.tsx');
    const head = page.slice(page.indexOf('id="coach-schedule"'), page.indexOf('<CoachSchedule'));
    assert.match(head, /view === 'open' && \(\s*<CoachSubscribe /);
    const button = readCode('app/[orgSlug]/league/[seasonSlug]/team/[teamId]/CoachSubscribe.tsx');
    assert.match(button, /aria-label=\{W\.coachButtonLabel\}/);
    assert.match(button, /<ConfirmProvider>/, 'Reset asks first: this page has no portal providing the question');
    assert.ok(!/download|\.ics|ExportButton|Toolbar/i.test(button), 'no download, no toolbar');
    // The window carries the portal's whole stylesheet: loaded on the tap, as the rep's Export button does.
    assert.match(button, /const CoachCalendarSubscribe = dynamic\(\(\) => import\('@\/components\/coaches\/CoachCalendarSubscribe'\), \{ ssr: false \}\);/);
  });
  it('the club\'s skin gives the shared window the four tokens it reads (a club page defines none of them otherwise)', () => {
    const frame = readCode('components/public/ClubFrame.module.css');
    for (const t of ['--home-scrim', '--home-line', '--home-olive', '--home-olive-soft']) assert.ok(frame.includes(`${t}:`), t);
  });
});
