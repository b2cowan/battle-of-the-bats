/**
 * Club Tier Stage 13d, Session A — house league's time handed between people (build prompt
 * docs/projects/active/CLUB_TIER_STAGE13D_BUILD_PROMPT.md, "Session A guards").
 *
 *   · the bell's recipients (owner, admin, league admin; the sender out; one per season); its email copy off by default
 *   · "Ask for time": present by gate (a league admin asks; an owner or an admin gives), once per season, again after 7 days
 *   · the This morning card's gate (owners and admins, Accounting or not; nobody else) and its door
 *   · "given" counts only time no other season has divided (13d-7 A), two overlapping seasons
 *   · the retired "Club time" tile (13d-6 A) stays unbuilt
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ASK_AGAIN_DAYS, TIME_HANDOFF_WORDS as W, canAskAgain, readTimeChangeFacts, timeAskDoor, timeAskHref,
} from '../../lib/league-time-handoff.ts';
import { seasonHoldsSlot } from '../../lib/league-time.ts';
import { readNoticeFacts } from '../../lib/notification-facts.ts';
import { houseLeagueAccess } from '../../lib/house-league-access.ts';
import { NOTIFICATION_CATEGORY, NOTIFICATION_EVENT_LABELS, NOTIFICATION_SECTIONS, PUSH_DEFAULT_ON_EVENTS } from '../../lib/notification-labels.ts';
import { notificationDestination } from '../../lib/notification-view.ts';
import { readCode, functionBody } from './_source-code.ts';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-20T15:00:00Z');

describe('the time-given bell (A1, 13d-1 A)', () => {
  it('names the schedule, the season, the week’s hours and the dates, and says what to do', () => {
    const body = W.bell.body({
      schedule: 'Saturdays at Kinsmen, December 2026', season: '2026 Fall House League', grows: true,
      given: { minutes: 120, detail: 'Sat · 9:00–11:00 a.m. · Kinsmen Park', lines: ['Sat · 9:00–11:00 a.m. · Kinsmen Park'], firstDay: '2026-12-05', lastDay: '2026-12-19' }, taken: null,
    });
    assert.equal(body, '“Saturdays at Kinsmen, December 2026” gives 2 hours a week to 2026 Fall House League.');
    assert.equal(W.bell.givenTitle, 'The club gave house league time');
  });
  it('a send that takes more than it gives says it took time back', () => {
    const body = W.bell.body({
      schedule: 'Winter dome', season: 'Winter 2027', grows: false, given: null,
      taken: { minutes: 60, detail: 'Sun · 6:00–7:00 p.m. · Dome', lines: ['Sun · 6:00–7:00 p.m. · Dome'], firstDay: '2027-01-10', lastDay: '2027-01-10' },
    });
    assert.equal(body, '“Winter dome” takes back 1 hour a week from Winter 2027.');
  });
  it('opens as labelled rows: season, schedule, then what it gives (and takes back) with each slot on its own line', () => {
    const given = { minutes: 120, detail: 'a; b', lines: ['Sat · 11:00 a.m.–12:00 p.m. · Diamond A', 'Sat · 12:00–1:00 p.m. · Diamond B'], firstDay: '2027-03-13', lastDay: '2027-04-03' };
    const taken = { minutes: 60, detail: 'c', lines: ['Sun · 6:00–7:00 p.m. · Dome'], firstDay: '2027-01-10', lastDay: '2027-01-10' };
    const facts = W.bell.facts({ schedule: 'House league Saturdays, spring 2027', season: '2027 Spring House League', grows: true, given, taken });
    // The shared shape (Notifications read at a glance, Stage 2): Season, Schedule, then the hours as the bold lead, the
    // dates as the quieter detail, the slots as a list under the row; the next step only when the week grew.
    assert.deepEqual(facts.rows.map(r => [r.label, r.value, r.lead ?? false, r.detail ?? '', r.list?.lines.length ?? 0]), [
      ['Season', '2027 Spring House League', false, '', 0],
      ['Schedule', 'House league Saturdays, spring 2027', false, '', 0],
      ['Gives', '2 hours a week', true, 'Mar 13 – Apr 3', 2],
      ['Takes back', '1 hour a week', true, 'Jan 10', 1],
    ]);
    assert.equal(facts.next, 'Divide it into games and practices.');
    // Gives first when the week grew; Takes back first when it shrank, and no next step.
    const shrank = W.bell.facts({ schedule: 's', season: 'x', grows: false, given, taken });
    assert.deepEqual(shrank.rows.slice(2).map(r => r.label), ['Takes back', 'Gives']);
    assert.equal(shrank.next, undefined);
    // It round-trips through the notification's metadata as the shared shape.
    assert.deepEqual(readNoticeFacts({ facts: JSON.parse(JSON.stringify(facts)) }), facts);
    // A notice sent on Nov 14 with the first, bespoke shape (`timeChange`) still opens as the same rows.
    const legacy = { schedule: 'House league Saturdays, spring 2027', season: '2027 Spring House League', grows: true, blocks: [
      { label: 'Gives', hours: '2 hours a week', range: 'Mar 13 – Apr 3', lines: given.lines },
      { label: 'Takes back', hours: '1 hour a week', range: 'Jan 10', lines: taken.lines },
    ] };
    assert.deepEqual(readTimeChangeFacts({ timeChange: legacy }), facts);
    // A notice from before either layout (or junk) reads as null and keeps its paragraph.
    assert.equal(readTimeChangeFacts({ seasonId: 's1' }), null);
    assert.equal(readTimeChangeFacts({ timeChange: { schedule: 's', season: 'x', grows: true, blocks: [{ label: 'Gives' }] } }), null);
    assert.equal(readTimeChangeFacts(null), null);
    // The reader draws the shared shape for any kind, the bespoke one for this kind only; the notice stores the shared one.
    assert.match(readCode('components/notifications/NotificationMessage.tsx'), /readNoticeFacts\(lead\.metadata\) \?\? \(lead\.eventType === 'house_league_time_given' \? readTimeChangeFacts\(lead\.metadata\) : null\)/);
    assert.match(readCode('lib/league-time-handoff-server.ts'), /facts: W\.bell\.facts\(/);
  });
  it('goes to whoever runs house league, the sender left out, one notify per told season; its door opens House league’s time', () => {
    const src = readCode('lib/league-time-handoff-server.ts');
    // The one list that hears about moved games, shared with the house-league half (lib/notify-recipients.ts).
    assert.match(readCode('lib/notify-recipients.ts'), /export async function houseLeagueRunnerUserIds[\s\S]*?\.in\('role', \[\.\.\.LEAGUE_RUNNER_ROLES\]\)/);
    assert.match(readCode('lib/club-schedule-send.ts'), /const userIds = await houseLeagueRunnerUserIds\(org\.id\);/);
    assert.match(src, /usesOf\(p\.orgId, \[\.\.\.given, \.\.\.taken\]\.map\(s => s\.id\)\), houseLeagueRunnerUserIds\(p\.orgId\),/);
    assert.match(src, /const userIds = runners\.filter\(id => id !== p\.senderId\);\s*if \(!userIds\.length\) return \{ told: null \};/, 'nobody left to tell: no bell and no WHO IS TOLD line');
    assert.match(src, /eventType: 'house_league_time_given', userIds: told\.userIds, excludeUserIds: \[p\.senderId\]/);
    assert.match(src, /await Promise\.all\(told\.seasons\.map\(s => notify\(\{/, 'one bell per told season');
    assert.match(src, /link: `\/\$\{p\.orgSlug\}\/admin\/house-league\/seasons\/\$\{s\.seasonId\}\/schedule\?time=1`/);
    assert.equal(notificationDestination('/hb/admin/house-league/seasons/s1/schedule?time=1', 'admin'), 'Open House league’s time');
    // The ask's bell opens where time is given.
    assert.equal(notificationDestination('/hb/admin/schedules', 'admin'), 'Open Schedules');
    assert.equal(notificationDestination('/hb/admin/schedules?new=1&permit=p1', 'admin'), 'Open New schedule');
    assert.equal(notificationDestination('/hb/admin/permits', 'admin'), 'Open Permits');
  });
  it('grows or shrinks by the TOTAL hours (ten Tuesdays given, one taken back is a gain); a move is no bell; a grown season stops asking', () => {
    const src = readCode('lib/league-time-handoff-server.ts');
    assert.match(src, /const net = total\(mineG\) - total\(mineT\);\s*if \(net === 0\) continue;/);
    assert.match(src, /from\('league_season_time_asks'\)\.delete\(\)\.eq\('org_id', p\.orgId\)\.in\('season_id', answered\)/);
    // A failed bell never keeps an answered ask: the clear is outside the bells' try.
    const tell = src.slice(src.indexOf('export async function tellTimeGiven'), src.indexOf('// ── The ask'));
    assert.ok(tell.indexOf("from('league_season_time_asks').delete()") > tell.indexOf('} catch (e) {'));
  });
  it('is a bell only: no email default, no push default, a "know" kind in house league’s settings', () => {
    const notify = readCode('lib/notify.ts');
    assert.match(notify, /email: eventType === 'payment_failed' && \(role === 'owner' \|\| role === 'admin'\)/, 'only payment_failed emails by default');
    for (const t of ['house_league_time_given', 'house_league_time_asked'] as const) {
      assert.ok(NOTIFICATION_EVENT_LABELS[t]);
      assert.equal(PUSH_DEFAULT_ON_EVENTS.has(t), false);
      assert.equal(NOTIFICATION_CATEGORY[t], 'know');
      assert.ok(NOTIFICATION_SECTIONS.find(s => s.label === 'House league')?.eventTypes.includes(t));
    }
  });
  it('fires at Finalize and at Send the changes after the step, and the send log keeps the baseline', () => {
    const send = readCode('lib/club-schedule-send.ts');
    const server = readCode('lib/league-time-handoff-server.ts');
    assert.match(server, /if \(p\.kind !== 'final' && !\(p\.kind === 'changes' && p\.state === 'final'\)\) return null;/);
    // Each member's database step lives in stepFor (839645c5c); the telling is the caller's, after every step has landed.
    const stepFor = functionBody(send, 'stepFor');
    assert.match(stepFor, /rpc\('club_schedule_finalize_priced'/, 'Finalize is a step');
    assert.match(stepFor, /rpc\('club_schedule_apply_changes_priced'/, 'Send the changes is a step');
    assert.doesNotMatch(stepFor, /tellTimeGiven/, 'nobody is told from inside a step');
    const run = functionBody(send, 'sendSchedule');
    const lastStep = run.lastIndexOf('await stepFor('), tellAt = run.indexOf('await tellTimeGiven(');
    assert.ok(lastStep > 0, 'the steps are run');
    assert.ok(tellAt > lastStep && tellAt > run.lastIndexOf('landed.push('), 'told after the steps');
    assert.equal((run.match(/tellTimeGiven\(/g) ?? []).length, 1, 'one telling in the whole send');
    assert.match(run, /for \(const l of landed\) \{(?:(?!\bfor \()[\s\S])*?if \(l\.preview\.timeHandoff\) \{\s*await tellTimeGiven\([^;]*sendId: l\.sendId, handoff: l\.preview\.timeHandoff/, 'only a member whose step landed is told of');
    // The baseline comes from the schedule itself, never from the bell's read (a failed read costs a bell, not the baseline).
    assert.match(send, /\.\.\.\(l\.kind === 'final' \|\| l\.kind === 'changes' \? \{ league_slot_ids: heldHouseLeagueSlotIds\(l\.loaded\.slots\) \} : \{\}\),/);
  });
});

describe('WHO IS TOLD gains a house league line (A2)', () => {
  it('names the league admins by name only (never an email), and the hours, or owners and admins by a bell', () => {
    assert.match(readCode('lib/league-time-handoff-server.ts'), /await boardNames\(p\.orgId, \['league_admin'\]\)/);
    assert.equal(`${W.whoTold.title} · ${W.whoTold.who(['Jules Moreau'])}: ${W.whoTold.what(120, 0)}`, 'House league · Jules Moreau, league admin: 2 hours a week to divide');
    assert.equal(W.whoTold.who(['A', 'B']), 'A and B, league admins');
    assert.equal(`${W.whoTold.title}: ${W.whoTold.who([])}, ${W.whoTold.byBell}`, 'House league: owners and admins, by notification, not email');
    assert.equal(W.whoTold.how, 'Told by notification, not email');
  });
  it('is held off for a send that gives house league nothing', () => {
    const send = readCode('lib/club-schedule-send.ts');
    assert.match(send, /leagueTime: timeHandoff\?\.told\?\.line \?\? subs\.find\(s => s\.preview\.leagueTime\)\?\.preview\.leagueTime \?\? null,/);
    const win = readCode('components/admin/kit/club/schedules/SendWindow.tsx');
    assert.match(win, /\{leagueTime && \(\(\) => \{/);
  });
});

describe('the ask is server-only (/review 2026-11-13: a season row is public past draft)', () => {
  it('lives in its own table with RLS on and nothing to anon or authenticated, never on league_seasons', () => {
    const mig = readCode('supabase/migrations/486_a_season_asks_the_club_for_time.sql');
    assert.match(mig, /create table if not exists public\.league_season_time_asks/);
    assert.match(mig, /alter table public\.league_season_time_asks enable row level security;/);
    assert.match(mig, /revoke all on public\.league_season_time_asks from anon, authenticated;/);
    assert.doesNotMatch(mig, /alter table public\.league_seasons add column/);
  });
  it('the button never says "Try again" when the time has already come', () => {
    const control = readCode('components/admin/kit/club/league/time/AskForTime.tsx');
    assert.match(control, /if \(data\?\.code === 'given'\) \{ setGiven\(true\); return; \}/);
  });
});

describe('"Ask for time" (A3, A6)', () => {
  it('asks once, and again 7 days after', () => {
    assert.equal(ASK_AGAIN_DAYS, 7);
    assert.equal(canAskAgain(null, NOW), true);
    assert.equal(canAskAgain(new Date(NOW - 6 * DAY).toISOString(), NOW), false);
    assert.equal(canAskAgain(new Date(NOW - 7 * DAY).toISOString(), NOW), true);
  });
  it('says what happened, in the drawing’s words', () => {
    assert.equal(W.ask.button, 'Ask for time');
    assert.equal(W.ask.asking, 'Asking…');
    assert.equal(W.ask.failed, 'The ask didn’t go. Try again.');
    assert.equal(`${W.ask.asked('2026-11-13T15:00:00Z')} ${W.ask.seen}`, 'Asked Nov 13. The owner and admins see it on their Overview.');
  });
  it('only a league admin asks: an owner or an admin gives time, and the season must run (one gate field)', () => {
    const route = readCode('app/api/admin/house-league/seasons/[seasonId]/time-ask/route.ts');
    assert.match(route, /houseLeagueRefusal\(ctx, 'askForTime', season\)/);
    const org = (planId: string) => ({ id: 'o', planId, moduleEntitlements: null }) as never;
    const who = (role: string) => ({ role, capabilities: null, repGroupIds: null }) as never;
    const live = { status: 'registration_open' }, draft = { status: 'draft' }, done = { status: 'completed' };
    assert.equal(houseLeagueAccess(who('league_admin'), org('club'), live).askForTime, true);
    assert.equal(houseLeagueAccess(who('league_admin'), org('club'), draft).askForTime, true, 'a getting-ready season asks too (13d-7)');
    assert.equal(houseLeagueAccess(who('league_admin'), org('club'), done).askForTime, false);
    for (const r of ['owner', 'admin', 'league_registrar', 'treasurer']) assert.equal(houseLeagueAccess(who(r), org('club'), live).askForTime, false, r);
    for (const mount of ['app/[orgSlug]/admin/house-league/seasons/[seasonId]/page.tsx', 'app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx']) {
      assert.match(readCode(mount), /askForTime/, `${mount} reads the one field`);
    }
    const server = readCode('lib/league-time-handoff-server.ts');
    // A conditional write: two presses (or two league admins) ask once; a season with time is refused.
    assert.match(server, /if \(first\.error\.code !== '23505'\) throw first\.error;/, 'the season is the key: two presses make one row');
    assert.match(server, /\.eq\('season_id', p\.season\.id\)\.lte\('asked_at', cutoff\)/, 'asking again only where the ask is 7 days old');
    assert.match(server, /if \(\(await seasonTimeFacts\(p\.orgId, p\.season\)\)\.given\) return \{ ok: false, status: 409, code: 'given' \};/);
    assert.match(server, /const cutoff = new Date\(now - ASK_AGAIN_DAYS \* DAY_MS\)\.toISOString\(\);/, 'the 7-day rule has one home');
  });
  it('the owner gets one bell when it is asked, never the asker', () => {
    const server = readCode('lib/league-time-handoff-server.ts');
    assert.match(server, /const \[owners, door\] = await Promise\.all\(\[orgOwnerUserIds\(p\.orgId\), askDoor\(p\.orgId\)\]\);/);
    assert.match(server, /eventType: 'house_league_time_asked', userIds: owners, excludeUserIds: \[p\.actorId\]/);
  });
  it('names nobody on the league admin’s screens (C6 A)', () => {
    const control = readCode('components/admin/kit/club/league/time/AskForTime.tsx');
    assert.doesNotMatch(control, /time_asked_by|askedBy|owner’s name|ownerName/);
  });
  it('is a full-width 44 px control on a phone', () => {
    const css = readCode('components/admin/kit/club/league/time/AskForTime.module.css');
    assert.match(css, /@media \(max-width: 640px\) \{[\s\S]*\.button \{ width: 100%; min-height: 44px;/);
  });
});

describe('"given" counts only time no other season has divided (13d-7 A)', () => {
  const fall = { id: 'fall', startDate: '2026-09-01', endDate: '2026-12-31' };
  const winter = { id: 'winter', startDate: '2026-12-01', endDate: '2027-03-31' };
  const draft = { id: 'draft', startDate: null, endDate: null };
  it('two overlapping seasons: the one that divided a slot keeps it; the other reads it as not its own', () => {
    assert.equal(seasonHoldsSlot(fall, '2026-12-12', 'fall'), true);
    assert.equal(seasonHoldsSlot(winter, '2026-12-12', 'fall'), false);
  });
  it('undivided time in both seasons’ dates is both seasons’ until one divides it (ruled)', () => {
    assert.equal(seasonHoldsSlot(fall, '2026-12-12', null), true);
    assert.equal(seasonHoldsSlot(winter, '2026-12-12', null), true);
  });
  it('a season’s own dates still bound it; a draft with no dates takes every day but not another season’s divided slots', () => {
    assert.equal(seasonHoldsSlot(winter, '2026-11-14', null), false);
    assert.equal(seasonHoldsSlot(draft, '2026-11-14', null), true);
    assert.equal(seasonHoldsSlot(draft, '2026-11-14', 'fall'), false);
  });
  it('House league’s time draws the same rule', () => {
    assert.match(readCode('lib/league-time-server.ts'), /const mine = rows\.filter\(r => seasonHoldsSlot\(holder, /);
  });
  it('the count reads the same rule, both halves from the one definition of house league’s time', () => {
    const src = readCode('lib/league-time-server.ts');
    assert.match(src, /let others = liveHouseLeagueSlots\(orgId, 'id, league_slot_uses!inner\(season_id\)', head\)\.neq\('league_slot_uses\.season_id', season\.id\);/);
    assert.match(src, /return Math\.max\(0, \(a\.count \?\? 0\) - \(b\.count \?\? 0\)\);/);
  });
});

describe('This morning: "House league asks for time" (A4)', () => {
  it('reads seasons asking, live, with no time — the season line’s own count', () => {
    const server = readCode('lib/league-time-handoff-server.ts');
    assert.match(server, /\.from\('league_season_time_asks'\)\s*\.select\('asked_at, league_seasons!inner\(/);
    assert.match(server, /\.not\('league_seasons\.status', 'in', FINISHED\)/);
    assert.match(server, /const waiting = asking\.filter\(\(_, i\) => !facts\[i\]\.given\);/);
    // The season line, the ask and the card read one answer.
    assert.match(readCode('app/api/admin/house-league/seasons/[seasonId]/route.ts'), /seasonTimeFacts\(ctx!\.org\.id, season\)/);
  });
  it('goes to owners and admins only (the schedule builders), Accounting or not', () => {
    const route = readCode('app/api/admin/club-brief/route.ts');
    assert.match(route, /if \(canOpenClubSchedules\(\{ planId: org\.planId, role: ctx\.role \}\)\) \{\s*reads\.push\(\(async \(\) => \{\s*try \{ timeAsks = await readTimeAsksCard/);
    const block = route.slice(route.indexOf('let timeAsks'), route.indexOf('const [shape]'));
    assert.doesNotMatch(block, /accounting|Accounting\b|canMoveClubMoney/, 'giving time isn’t money');
    const hub = readCode('components/admin/kit/club/ClubHubKit.tsx');
    assert.match(hub, /if \(asks\?\.seasons\.length\) \{/, 'absent at zero');
    assert.doesNotMatch(hub, /Dismiss[^\n]*time-asks|time-asks[^\n]*Dismiss/);
  });
  it('its line and its door, per the drawing', () => {
    const asked = new Date(NOW - 7 * DAY).toISOString();
    assert.equal(W.card.sub([{ name: '2026 Fall House League', askedAt: '2026-11-18T15:00:00Z' }], false, NOW), '2026 Fall House League · asked Nov 18 by its league admin');
    assert.equal(W.card.sub([{ name: '2026 Fall House League', askedAt: '2026-11-11T15:00:00Z' }], false, NOW), '2026 Fall House League · asked 9 days ago by its league admin');
    assert.equal(W.card.sub([{ name: 'Fall', askedAt: '2026-11-18T15:00:00Z' }], true, NOW), 'Fall · asked Nov 18 · add a permit to give time');
    assert.equal(W.card.sub([{ name: 'A', askedAt: asked }, { name: 'B', askedAt: '2026-11-18T15:00:00Z' }], false, NOW), '2 seasons · oldest asked 7 days ago');
    assert.deepEqual(timeAskDoor({ permitIds: [], schedules: 0 }), { kind: 'permits' });
    assert.deepEqual(timeAskDoor({ permitIds: ['p1'], schedules: 0 }), { kind: 'new', permitId: 'p1' });
    assert.deepEqual(timeAskDoor({ permitIds: ['p1'], schedules: 2 }), { kind: 'schedules' });
    assert.deepEqual(timeAskDoor({ permitIds: ['p1', 'p2'], schedules: 0 }), { kind: 'schedules' });
    assert.equal(timeAskHref('/hb/admin', { kind: 'new', permitId: 'p1' }), '/hb/admin/schedules?new=1&permit=p1');
    assert.equal(timeAskHref('/hb/admin', { kind: 'permits' }), '/hb/admin/permits');
  });
});

describe('the retired tile (13d-6 A)', () => {
  it('no "Club time" tile, and no placeholder note for one', () => {
    const src = readCode('lib/league-morning.ts');
    assert.doesNotMatch(src, /13d's hand-off/);
  });
});
