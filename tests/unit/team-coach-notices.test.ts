import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  planTeamCoachNotices, holdsFreeTeam, TEAM_COACH_WORDS, teamCoachRecordLink, clip, noticeMoney, possessive,
  registrationNoticeWords, type TeamCoachNoticeFacts, type TeamCoachNoticeContext,
} from '../../lib/team-coach-notice-plan.ts';
import {
  TEAM_COACH_BELL, orgBell, bellQuery, bellBody, bellReadFilter, bellFromRequest, rowBelongsToBell,
} from '../../lib/notification-bell-scope.ts';
import {
  TEAM_COACH_EVENTS, NOTIFICATION_CATEGORY, NOTIFICATION_SECTIONS, PUSH_DEFAULT_ON_EVENTS, isTeamCoachEvent,
} from '../../lib/notification-labels.ts';
import { EVENT_ICONS, notificationDestination } from '../../lib/notification-view.ts';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { readCode } from './_source-code.ts';
import { CHAT_PAUSED } from '../../lib/chat-pause.ts';

const REPO = path.join(import.meta.dirname, '..', '..');

/** Every .ts/.tsx under a repo-relative directory, repo-relative. */
function listTs(dir: string): string[] {
  return (readdirSync(path.join(REPO, dir), { recursive: true }) as string[])
    .filter(f => /\.tsx?$/.test(f) && !f.includes('node_modules'))
    .map(f => path.join(dir, f));
}

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A FREE COACH'S BELL (owner rulings 2026-10-13, Free coach header parity — plan
 * docs/projects/active/FREE_COACH_HEADER_PARITY_PLAN.md, build prompt B1–B4).
 *
 *   1. WHO. Every active account on a genuinely free team linked to the registration (A5), once each;
 *      never a Premium team's free shadow, a paused account, a demo club, or the person who acted.
 *   2. TWO BELLS THAT NEVER OVERLAP (B1/B3). A free coach's notice is filed under the HOST club, so a
 *      club's bell must leave every such kind out — or a person who is also that club's staff reads a
 *      coach notice in the admin bell — and the free coach's bell reads ONLY those kinds, from every club.
 *      The server's read and the browser's live count answer from one rule.
 *   3. BELL ONLY. These kinds never ride notify() (it would email the coach a second time), never push
 *      by default, and never appear as a club's preference row. The payment reminder is the one that
 *      waits under Needs attention (B4).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const HOST = 'org-host';
const DEMO = 'org-demo';

function facts(over: Partial<TeamCoachNoticeFacts> = {}): TeamCoachNoticeFacts {
  return {
    registrations: [{ id: 'reg-1', name: 'Ottawa crazy pants', tournament_id: 't-1' }],
    tournaments: [{ id: 't-1', name: 'U13 Battle of the Bats 2027', org_id: HOST, start_date: '2027-07-02', end_date: '2027-07-04' }],
    clubs: [{ id: HOST, name: 'Milton Softball Organization' }],
    links: [{ tournament_team_id: 'reg-1', basic_coach_team_id: 'free-1' }],
    freeTeams: [{ id: 'free-1', team_workspace_id: null }],
    members: [
      { basic_coach_team_id: 'free-1', user_id: 'coach-a', status: 'active' },
      { basic_coach_team_id: 'free-1', user_id: 'coach-b', status: 'active' },
    ],
    unpaused: null,
    demoOrgIds: new Set(),
    ...over,
  };
}

const accepted = TEAM_COACH_WORDS.accepted;

describe('who hears a free coach’s notice (A5)', () => {
  it('every active coach on the linked free team, filed under the HOST club', () => {
    const rows = planTeamCoachNotices(facts(), 'team_coach_accepted', accepted);
    assert.deepEqual(rows.map(r => r.user_id).sort(), ['coach-a', 'coach-b']);
    for (const r of rows) {
      assert.equal(r.org_id, HOST);
      assert.equal(r.event_type, 'team_coach_accepted');
      assert.equal(r.title, 'Milton Softball Organization accepted Ottawa crazy pants');
      assert.equal(r.body, 'U13 Battle of the Bats 2027 · Jul 2–4, 2027');
      assert.equal(r.link, teamCoachRecordLink('reg-1'));
      assert.deepEqual(r.metadata, { registrationId: 'reg-1', tournamentId: 't-1' });
    }
  });

  it('a person on two linked free teams gets ONE row for the registration', () => {
    const rows = planTeamCoachNotices(facts({
      links: [
        { tournament_team_id: 'reg-1', basic_coach_team_id: 'free-1' },
        { tournament_team_id: 'reg-1', basic_coach_team_id: 'free-2' },
      ],
      freeTeams: [{ id: 'free-1', team_workspace_id: null }, { id: 'free-2', team_workspace_id: null }],
      members: [
        { basic_coach_team_id: 'free-1', user_id: 'coach-a', status: 'active' },
        { basic_coach_team_id: 'free-2', user_id: 'coach-a', status: 'active' },
      ],
    }), 'team_coach_accepted', accepted);
    assert.equal(rows.length, 1);
  });

  it('one row per registration when a person coaches two teams in the same event', () => {
    const rows = planTeamCoachNotices(facts({
      registrations: [
        { id: 'reg-1', name: 'Ottawa A', tournament_id: 't-1' },
        { id: 'reg-2', name: 'Ottawa B', tournament_id: 't-1' },
      ],
      links: [
        { tournament_team_id: 'reg-1', basic_coach_team_id: 'free-1' },
        { tournament_team_id: 'reg-2', basic_coach_team_id: 'free-2' },
      ],
      freeTeams: [{ id: 'free-1', team_workspace_id: null }, { id: 'free-2', team_workspace_id: null }],
      members: [
        { basic_coach_team_id: 'free-1', user_id: 'coach-a', status: 'active' },
        { basic_coach_team_id: 'free-2', user_id: 'coach-a', status: 'active' },
      ],
    }), 'team_coach_accepted', accepted);
    assert.deepEqual(rows.map(r => r.title).sort(), [
      'Milton Softball Organization accepted Ottawa A',
      'Milton Softball Organization accepted Ottawa B',
    ]);
  });

  it('an inactive member hears nothing', () => {
    const rows = planTeamCoachNotices(facts({
      members: [
        { basic_coach_team_id: 'free-1', user_id: 'coach-a', status: 'active' },
        { basic_coach_team_id: 'free-1', user_id: 'gone', status: 'removed' },
      ],
    }), 'team_coach_accepted', accepted);
    assert.deepEqual(rows.map(r => r.user_id), ['coach-a']);
  });

  it('a paused account hears nothing; a failed pause lookup delivers (fail-open, as notify())', () => {
    const paused = planTeamCoachNotices(facts({ unpaused: new Set(['coach-b']) }), 'team_coach_accepted', accepted);
    assert.deepEqual(paused.map(r => r.user_id), ['coach-b']);
    const unknown = planTeamCoachNotices(facts({ unpaused: null }), 'team_coach_accepted', accepted);
    assert.equal(unknown.length, 2);
  });

  it('a Premium team’s free shadow is skipped — its coaches read the paid portal, whose bell never shows these', () => {
    const rows = planTeamCoachNotices(facts({ freeTeams: [{ id: 'free-1', team_workspace_id: 'ws-1' }] }), 'team_coach_accepted', accepted);
    assert.equal(rows.length, 0);
  });

  it('a demo club notifies no one', () => {
    const rows = planTeamCoachNotices(facts({
      tournaments: [{ id: 't-1', name: 'Demo Cup', org_id: DEMO }],
      demoOrgIds: new Set([DEMO]),
    }), 'team_coach_accepted', accepted);
    assert.equal(rows.length, 0);
  });

  it('nobody is told about their own action', () => {
    const rows = planTeamCoachNotices(facts(), 'team_coach_accepted', accepted, ['coach-a']);
    assert.deepEqual(rows.map(r => r.user_id), ['coach-b']);
  });

  it('a registration nobody’s free team is linked to is skipped without writing words', () => {
    let composed = 0;
    const rows = planTeamCoachNotices(facts({ links: [] }), 'team_coach_accepted', c => { composed++; return accepted(c); });
    assert.equal(rows.length, 0);
    assert.equal(composed, 0);
  });

  it('the words may skip a registration (null)', () => {
    assert.equal(planTeamCoachNotices(facts(), 'team_coach_accepted', () => null).length, 0);
  });

  it('a club’s invitation reaches only a person with a seat on a genuinely free team (A8)', () => {
    assert.equal(holdsFreeTeam([{ basic_coach_team_id: 'free-1', status: 'active' }], [{ id: 'free-1', team_workspace_id: null }]), true);
    assert.equal(holdsFreeTeam([{ basic_coach_team_id: 'free-1', status: 'active' }], [{ id: 'free-1', team_workspace_id: 'ws' }]), false);
    assert.equal(holdsFreeTeam([{ basic_coach_team_id: 'free-1', status: 'removed' }], [{ id: 'free-1', team_workspace_id: null }]), false);
  });
});

describe('two bells that never overlap (B1/B3)', () => {
  it('a club’s bell excludes every free-coach kind and chat; the free bell reads only the free-coach kinds, every club', () => {
    const club = bellReadFilter(orgBell(HOST)!);
    assert.equal(club.orgId, HOST);
    assert.equal(club.only, null);
    for (const kind of TEAM_COACH_EVENTS) assert.ok(club.exclude.includes(kind), `${kind} excluded from a club bell`);
    assert.ok(club.exclude.includes('chat_message'));

    const free = bellReadFilter(TEAM_COACH_BELL);
    assert.equal(free.orgId, null, 'the free bell reads every host club');
    assert.deepEqual(free.only, [...TEAM_COACH_EVENTS]);
  });

  it('the live count answers from the same rule as the server', () => {
    const coachRow = { org_id: HOST, event_type: 'team_coach_accepted' };
    const clubRow = { org_id: HOST, event_type: 'registration_new' };
    // An org-staff member who is also a free coach: the club bell never counts the coach notice...
    assert.equal(rowBelongsToBell(orgBell(HOST)!, coachRow), false);
    assert.equal(rowBelongsToBell(orgBell(HOST)!, clubRow), true);
    // ...and the free bell never counts the club's rows, but counts a coach notice from ANY club.
    assert.equal(rowBelongsToBell(TEAM_COACH_BELL, clubRow), false);
    assert.equal(rowBelongsToBell(TEAM_COACH_BELL, { org_id: 'another-club', event_type: 'team_coach_game_changed' }), true);
    assert.equal(rowBelongsToBell(orgBell('another-club')!, clubRow), false);
  });

  it('a request names its bell: the scope wins, an org id is a club bell, neither reads nothing', () => {
    assert.equal(bellFromRequest('team-coach', 'x'), TEAM_COACH_BELL);
    assert.equal(bellFromRequest(null, HOST), `org:${HOST}`);
    assert.equal(bellFromRequest(null, null), null);
    assert.equal(bellFromRequest('something-else', ''), null);
    assert.equal(bellQuery(TEAM_COACH_BELL), 'scope=team-coach');
    assert.equal(bellQuery(orgBell(HOST)!), `orgId=${HOST}`);
    assert.deepEqual(bellBody(TEAM_COACH_BELL), { scope: 'team-coach' });
    assert.deepEqual(bellBody(orgBell(HOST)!), { orgId: HOST });
  });

  it('the route reads, counts and marks all read through the one bell rule — no raw org filter left', () => {
    const code = readCode('app/api/notifications/route.ts');
    assert.match(code, /bellReadFilter\(bell\)/);
    assert.equal((code.match(/scopeToBell\(/g) ?? []).length, 3, 'the count, the list and Mark all read');
    assert.equal((code.match(/\.eq\('org_id'/g) ?? []).length, 1, 'the org filter lives in the one helper only');
  });

  it('no second reader of the notifications table — a new one would skip the bell rule', () => {
    // The bell route reads through `bellReadFilter`; the two writers insert; lib/db.ts's dedupe check is keyed by
    // org AND event type, so it can never mix the two bells. A new file here must read through the rule too.
    const touching = ['app', 'lib', 'components'].flatMap(dir => listTs(dir))
      .filter(f => /from\('notifications'\)/.test(readCode(f)))
      .map(f => f.replace(/\\/g, '/'))
      .sort();
    assert.deepEqual(touching, [
      'app/api/notifications/route.ts',
      'lib/db.ts',
      // Needs attention clears itself (2026-10-16): a reader's pass reads through `bellReadFilter`; a settle step's
      // sweep names its own kinds, none of them a free coach's; the doors read the reader's own row by kind.
      'lib/needs-attention.ts',
      'lib/notify.ts',
      'lib/team-coach-notices.ts',
    ]);
  });

  it('every bell hook reads through a BellSource, never a bare org id', () => {
    assert.match(readCode('lib/use-notification-unread.ts'), /rowBelongsToBell\(bell,/);
    assert.match(readCode('components/notifications/useNotificationFeed.ts'), /bellQuery\(bell\)/);
    assert.match(readCode('components/notifications/useNotificationFeed.ts'), /\.\.\.bellBody\(bell\)/);
  });
});

describe('bell only (B4 and the no-double-email rule)', () => {
  it('none of the free-coach kinds pushes by default or is a club preference row', () => {
    const sectioned = new Set(NOTIFICATION_SECTIONS.flatMap(s => s.eventTypes as string[]));
    for (const kind of TEAM_COACH_EVENTS) {
      assert.equal(PUSH_DEFAULT_ON_EVENTS.has(kind), false, `${kind} never pushes by default`);
      assert.equal(sectioned.has(kind), false, `${kind} is not a club preference row`);
      assert.ok(EVENT_ICONS[kind], `${kind} has its own icon`);
      assert.equal(isTeamCoachEvent(kind), true);
    }
  });

  it('the payment reminder waits under Needs attention; the rest is news', () => {
    for (const kind of TEAM_COACH_EVENTS) {
      assert.equal(NOTIFICATION_CATEGORY[kind], kind === 'team_coach_payment_reminder' ? 'act' : 'know', kind);
    }
  });

  it('the writer never routes these through notify() — that would email the coach twice', () => {
    const code = readCode('lib/team-coach-notices.ts');
    assert.doesNotMatch(code, /from '\.\/notify'|notify\(\{/);
    assert.match(code, /from\('notifications'\)\.insert/);
  });

  it('every sender writes its notice', () => {
    const senders: Array<[string, RegExp]> = [
      ['app/api/admin/teams/route.ts', /announceTeamPaid\([\s\S]*eventType: 'team_coach_accepted'[\s\S]*eventType: 'team_coach_declined'/],
      // The payment bell moved with the email and the host's bell to one place (mig 345): every door that completes a fee asks it.
      ['lib/team-payment-notices.ts', /eventType: 'team_coach_payment_recorded'/],
      ['app/api/admin/tournaments/[tournamentId]/registrations/payments/route.ts', /announceTeamPaid\(/],
      ['app/api/admin/tournaments/[tournamentId]/registrations/bulk/route.ts', /team_coach_accepted[\s\S]*team_coach_declined[\s\S]*team_coach_payment_recorded/],
      ['app/api/admin/tournaments/[tournamentId]/registrations/payment-reminders/route.ts', /team_coach_payment_reminder/],
      ['app/api/admin/schedule-publish/route.ts', /team_coach_schedule_published/],
      ['lib/schedule-change-notices.ts', /team_coach_game_changed/],
      ['app/api/admin/communications/route.ts', /team_coach_announcement/],
      ['app/api/admin/tournaments/route.ts', /team_coach_results_posted/],
      ['app/api/admin/rep-teams/teams/[teamId]/coaches/route.ts', /notifyInvitedFreeCoach\(/],
      ['app/api/register/route.ts', /team_coach_registered/],
    ];
    for (const [file, pattern] of senders) assert.match(readCode(file), pattern, file);
  });

  it('A6: the acceptance notice sits OUTSIDE the host’s email switch', () => {
    const body = readCode('app/api/admin/teams/route.ts');
    const pushIdx = body.indexOf('bellAccepted.push(current.id)');
    const blockIdx = body.indexOf("coachEmailBlock(bulkCoachSettings, 'acceptance', current)");
    assert.ok(pushIdx > 0 && blockIdx > 0 && pushIdx < blockIdx, 'collected before, not inside, the email check');
  });
});

describe('the public form tells the rest of the team (registered / waitlisted)', () => {
  const pending = registrationNoticeWords('pending');

  it('an entry on the waitlist gets the waitlist words; anything else, the registered words', () => {
    assert.equal(registrationNoticeWords('waitlist'), TEAM_COACH_WORDS.waitlisted);
    assert.equal(pending, TEAM_COACH_WORDS.registered);
  });

  it('the co-coaches hear it; the coach who pressed Submit does not', () => {
    const rows = planTeamCoachNotices(facts(), 'team_coach_registered', pending, ['coach-a']);
    assert.deepEqual(rows.map(r => r.user_id), ['coach-b']);
    assert.equal(rows[0].title, 'Ottawa crazy pants is registered for U13 Battle of the Bats 2027');
    assert.equal(rows[0].body, 'Sent to Milton Softball Organization for review');
    assert.equal(rows[0].link, teamCoachRecordLink('reg-1'));
  });

  it('an entry filed under no team, or a brand-new team only its submitter is on, tells nobody', () => {
    assert.deepEqual(planTeamCoachNotices(facts({ links: [] }), 'team_coach_registered', pending, ['coach-a']), []);
    const onlySubmitter = facts({ members: [{ basic_coach_team_id: 'free-1', user_id: 'coach-a', status: 'active' }] });
    assert.deepEqual(planTeamCoachNotices(onlySubmitter, 'team_coach_registered', pending, ['coach-a']), []);
  });

  it('the route writes it only after the link held, on the final status, outside the email switch', () => {
    const code = readCode('app/api/register/route.ts');
    const call = code.indexOf("eventType: 'team_coach_registered'");
    assert.ok(call > 0, 'the route writes the notice');
    // The submitter is the one excluded, and only a link that did not throw names them.
    assert.match(code, /await linkTournamentRegistrationToBasicCoachTeam\(\{[\s\S]*?\}\);\s*linkedCoachId = signedInCoach\.id;/);
    assert.match(code, /linkedCoachId && notifyTeamCoaches\(\{[\s\S]*?compose: registrationNoticeWords\(finalStatus\),\s*excludeUserIds: \[linkedCoachId\],/);
    assert.ok(code.lastIndexOf("finalStatus = 'waitlist'") < call, 'after the slot claim can turn the entry into a waitlist entry');
    // A6: the email switch's own block closes before the call (brace-matched, so moving the call inside it fails).
    const emailSwitch = code.indexOf("if (coachEmailEnabled(tournament.settings, 'confirmation'))");
    assert.ok(emailSwitch > 0, 'the email switch is still there');
    let depth = 0, switchClosed = -1;
    for (let i = code.indexOf('{', emailSwitch); i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}' && --depth === 0) { switchClosed = i; break; }
    }
    assert.ok(switchClosed > 0 && switchClosed < call, 'A6: not inside the email switch');
  });
});

describe('the words (hub screen 3)', () => {
  const ctx: TeamCoachNoticeContext = {
    registrationId: 'reg-1', teamName: 'Riverside Reds', tournamentId: 't-1', tournamentName: 'Battle of the Bats',
    tournamentDates: 'Jul 2–4, 2027', orgId: HOST, clubName: 'Milton Softball Organization',
  };

  it('a game change names the team, in the push’s own words', () => {
    const n = TEAM_COACH_WORDS.gameChanged(ctx, { title: 'Your 10:00 a.m. vs Burlington Bandits moved', body: 'Now 11:30 a.m. at Field 3 · Battle of the Bats' });
    assert.equal(n.title, 'Riverside Reds’ 10:00 a.m. vs Burlington Bandits moved');
    assert.equal(n.body, 'Now 11:30 a.m. at Field 3 · Battle of the Bats');
    assert.equal(possessive('Riverside U13'), 'Riverside U13’s');
  });

  it('a payment says the amount when it is known, and never "$0.00"', () => {
    assert.equal(TEAM_COACH_WORDS.paymentRecorded(ctx, 450).title, 'Milton Softball Organization recorded the $450.00 fee for Riverside Reds');
    assert.equal(TEAM_COACH_WORDS.paymentRecorded(ctx, Number.NaN).title, 'Milton Softball Organization recorded Riverside Reds’ fee as paid');
    assert.equal(noticeMoney(0), null);
  });

  it('an announcement carries its message, cut at a word', () => {
    assert.equal(TEAM_COACH_WORDS.announcement(ctx, 'Hotel block', 'Closes May 1.').body, 'Closes May 1.');
    const long = clip('word '.repeat(200), 50);
    assert.ok(long.endsWith('…') && long.length <= 51 && !/wor…$/.test(long));
  });

  it('an invitation opens Home, where it is answered', () => {
    const n = TEAM_COACH_WORDS.invitation('UAT Rep Club', '15U AAA');
    assert.equal(n.title, 'UAT Rep Club invited you to coach 15U AAA');
    assert.equal(n.link, '/discover');
  });

  it('the opened notice names the free portal’s pages', () => {
    assert.equal(notificationDestination('/coaches/tournaments/reg-1#schedule', 'coach'), 'Open the tournament');
    assert.equal(notificationDestination('/coaches/team/free-1/chat', 'coach'), CHAT_PAUSED ? null : 'Open Chat');
    assert.equal(notificationDestination('/discover', 'coach'), 'Open Home');
  });
});
