import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { leagueEntries } from '../../lib/family-league-entries.ts';
import { FAMILY_HOME_WORDS as W, nameList } from '../../lib/family-home-words.ts';
import { signCoachCalendarToken, verifyCoachCalendarToken, coachFeedUrl } from '../../lib/coach-calendar-link.ts';
import { between, functionBody, readCode, readSource } from './_source-code.ts';
import type { FeedTeamEvent } from '../../lib/export/team-feed-words.ts';

/**
 * Signed-in family accounts Stage 4a, Parts 6–8 (build prompt docs/projects/active/SIGNED_IN_FAMILY_STAGE4_BUILD_PROMPT.md;
 * drawing tabs 3–8; /legal draft GUARDIAN_CONSENT_STAGE4.md v0.1 (b), (d), (e)). Real output where the code is pure; the
 * source where the rule is "this path never does X" (Part 9 guards a, e, g).
 */

const ev = (over: Partial<FeedTeamEvent> & { id: string; startsAt: string }): FeedTeamEvent => ({
  name: 'Practice', eventType: 'practice', opponent: null, homeAway: null, endsAt: null, arrivalTime: null,
  location: 'Riverdale Park', locationAddress: null, fieldNumber: null, status: 'scheduled', ...over,
});

describe('Part 6 — a house-league team’s schedule as the family reads it', () => {
  const NOW = Date.parse('2027-04-16T12:00:00Z');
  const list = leagueEntries([
    ev({ id: 'g2', startsAt: '2027-04-24T14:30:00Z', eventType: 'league_game', name: 'Herons', opponent: 'Herons', homeAway: 'home' }),
    ev({ id: 'p0', startsAt: '2027-04-10T13:00:00Z' }),
    ev({ id: 'g1', startsAt: '2027-04-12T14:30:00Z', eventType: 'league_game', name: 'Owls', opponent: 'Owls', homeAway: 'away' }),
    ev({ id: 'p1', startsAt: '2027-04-17T13:00:00Z', status: 'cancelled' }),
    ev({ id: 'p2', startsAt: '2027-04-17T15:00:00Z' }),
    ev({ id: 'x', startsAt: null as unknown as string }),
  ], NOW);

  it('in time order, an undated event left out', () => {
    assert.deepEqual(list.map(e => e.id), ['p0', 'g1', 'p1', 'p2', 'g2']);
  });
  it('Up next is the first event still to come that is not cancelled — exactly one', () => {
    assert.deepEqual(list.filter(e => e.isNextUp).map(e => e.id), ['p2']);
  });
  it('a past GAME reads as done; a practice never does; no score is ever carried (4a)', () => {
    assert.equal(list.find(e => e.id === 'g1')!.completed, true);
    assert.equal(list.find(e => e.id === 'p0')!.completed, false);
    assert.ok(list.every(e => !e.hasScore && e.teamScore === null && e.opponentScore === null && e.result === null));
  });
  it('a cancelled event is kept and marked', () => {
    assert.equal(list.find(e => e.id === 'p1')!.status, 'cancelled');
  });
});

describe('Part 6 — the /legal words, verbatim (draft b, d, e)', () => {
  it('(b) the privacy line', () => {
    assert.equal(W.team.privacy(['Aarav'], 'Riverdale Minor Ball League'),
      'Other families can’t see you or Aarav here. Aarav’s coaches and Riverdale Minor Ball League see the name, email and phone on the sign-up.');
  });
  it('(e) Leave, first parent', () => {
    assert.equal(W.leave.title('Aarav'), 'Leave Aarav’s team?');
    assert.equal(W.leave.first(['Otters'], 'Aarav', 'Riverdale Minor Ball League'),
      'You’ll stop seeing the Otters here, and your calendar link stops showing its games. Riverdale Minor Ball League will still email you about Aarav’s sign-up. You can join again only if Riverdale Minor Ball League sends you a new invitation.');
  });
  it('(e) Leave, second parent (names the Stop line)', () => {
    assert.equal(W.leave.second(['Otters'], 'Aarav', 'Riverdale Minor Ball League', 'Stop these emails'),
      'You’ll stop seeing the Otters here, and your calendar link stops showing its games. Riverdale Minor Ball League may still email you about Aarav’s sign-up. To stop those too, use Stop these emails at the bottom of one. You can join again only if Riverdale Minor Ball League sends you a new invitation.');
  });
  it('(d) the stop page, for an address that joined as the second parent', () => {
    assert.equal(W.stopJoined(['Aarav'], 'Riverdale Minor Ball League'),
      'You’ve joined Aarav’s team in the app. Stopping removes you from it, and your calendar link stops showing its games. Riverdale Minor Ball League won’t email this address about a sign-up someone else added it to, and can’t add it again.');
  });
  it('the drawn lines: joined note, connected line, removed line, the in-app foot', () => {
    assert.equal(W.team.joinedTitle(['Aarav']), 'You’ve joined Aarav’s team');
    assert.equal(W.team.connected('Aarav', ['dev.shah@example.com (invited)']), 'Connected to Aarav: you, and dev.shah@example.com (invited)');
    assert.equal(W.family.removed('Aarav', 'Riverdale Minor Ball League', 'info@riverdaleminor.example'),
      'You’re no longer connected to Aarav. If you think that’s wrong, contact Riverdale Minor Ball League at info@riverdaleminor.example.');
    assert.equal(W.inApp.seeing(['Aarav']), 'You’re seeing this because you’re signed in as Aarav’s parent.');
    assert.equal(nameList(['Leo', 'Ava', 'Maya']), 'Leo, Ava and Maya');
    assert.equal(W.signupRow.toPay(4000), '$40.00 to pay');
  });
});

describe('Part 7 — one calendar address per parent', () => {
  const SECRET = 'x'.repeat(40);
  const ID = '0b6f8e2a-4c1d-4f3e-9a7b-2d5c6e8f9a01';
  it('the address is signed in its OWN domain: a family token never verifies as a coach’s, nor a coach’s as a family’s', () => {
    const fam = signCoachCalendarToken(ID, 0, SECRET, 'family-calendar');
    assert.deepEqual(verifyCoachCalendarToken(fam, SECRET, 'family-calendar'), { membershipId: ID, generation: 0 });
    assert.equal(verifyCoachCalendarToken(fam, SECRET, 'coach-calendar'), null);
    assert.equal(verifyCoachCalendarToken(signCoachCalendarToken(ID, 0, SECRET), SECRET, 'family-calendar'), null);
  });
  it('an https address under the family feed route (as built)', () => {
    const url = coachFeedUrl('https://www.fieldlogichq.ca', signCoachCalendarToken(ID, 0, SECRET, 'family-calendar'), 'family-calendar');
    assert.match(url, /^https:\/\/www\.fieldlogichq\.ca\/api\/family\/calendar\/[A-Za-z0-9_-]{22}\.0\.[A-Za-z0-9_-]{22}\.ics$/);
  });
  const cal = readCode('lib/family-calendar.ts');
  it('a stopped address, or the tier off, answers an EMPTY calendar (never a revived one, never an error)', () => {
    const read = functionBody(cal, 'readFamilyFeed');
    assert.match(read, /if \(feed\.stopped_at \|\| !GUARDIAN_TIER_ENABLED\) return \{ kind: 'calendar', calendarName, entries: \[\] \}/);
  });
  it('it serves what the parent reaches NOW, titled by team (the family reader of the feed recipe), never by child', () => {
    const read = functionBody(cal, 'readFamilyFeed');
    assert.match(read, /getFamilyReach\(feed\.user_id\)/);
    assert.match(read, /teamFeedEntries\(\{ teamName: s\.teamName, sport: s\.sport, reader: 'family', events: s\.entries \}\)/);
    assert.ok(!/firstName|first_name|player/i.test(read), 'the feed reads no child field');
    assert.equal(W.calendar.feedName, 'Your family’s teams');
  });
  it('Stop ends the live address at once; making one again makes a new row', () => {
    assert.match(functionBody(cal, 'stopFamilyFeed'), /update\(\{ stopped_at: /);
    assert.match(functionBody(cal, 'makeFamilyFeed'), /crypto\.randomUUID\(\)/);
  });
  it('the per-link mint on the team route is gone (one address per parent)', () => {
    assert.ok(!/export const POST/.test(readCode('app/api/family/teams/[teamId]/route.ts')));
    assert.ok(!/ensureFamilyCalendarToken/.test(readCode('lib/family-access.ts')));
  });
});

describe('guard (a) — with the tier off nothing changes: every new door answers 404, every read attaches nothing', () => {
  const PAGES = [
    'app/(consumer)/family/page.tsx',
    'app/(consumer)/family/teams/[teamId]/page.tsx',
    'app/(consumer)/family/children/[childId]/page.tsx',
    'app/(consumer)/family/signup/[registrationId]/page.tsx',
  ];
  for (const f of PAGES) {
    it(`${f} 404s first`, () => {
      assert.match(readCode(f), /if \(!GUARDIAN_TIER_ENABLED\) notFound\(\);/);
    });
  }
  const ROUTES = [
    'app/api/family/calendar/route.ts',
    'app/api/family/me/route.ts',
    'app/api/family/children/[childId]/leave/route.ts',
    'app/api/family/signup-invitation/route.ts',
  ];
  for (const f of ROUTES) {
    it(`${f} 404s first`, () => {
      assert.match(readCode(f), /if \(!GUARDIAN_TIER_ENABLED\) return NextResponse\.json\(\{ error: 'not_found' \}, \{ status: 404 \}\);/);
    });
  }
  it('the record window’s statuses, the join window’s names, the stop page’s (d) and the emailed page’s way back: nothing', () => {
    assert.match(between(readCode('lib/family-registration-status.ts'), 'function withFamilyAppStatuses<', 'export async function sendFamilyInvitationAgain'), /if \(!GUARDIAN_TIER_ENABLED \|\| regs\.length === 0\) return \[\.\.\.regs\];/);
    assert.match(functionBody(readCode('lib/children-duplicates-read.ts'), 'withConnectedParents'), /if \(!GUARDIAN_TIER_ENABLED \|\| proposals\.length === 0\) return proposals;/);
    assert.match(functionBody(readCode('app/second-parent-stop/page.tsx'), 'joinedAsSecondParent'), /if \(!GUARDIAN_TIER_ENABLED\) return \[\];/);
    assert.match(functionBody(readCode('lib/family-home.ts'), 'placedOnSignup'), /if \(!GUARDIAN_TIER_ENABLED \|\| !isLiveLeagueSeasonStatus\(seasonStatus\)\) return \[\];/);
    assert.match(functionBody(readCode('lib/family-home.ts'), 'buildFamilyHome'), /if \(!GUARDIAN_TIER_ENABLED\) return/);
  });
  it('the Send again / Remove a parent branch of the registration route refuses with the tier off', () => {
    const route = readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts');
    const branch = between(route, 'body.familySendAgain === \'first\'', 'typeof body.refundCard === \'string\'');
    assert.match(branch, /if \(!GUARDIAN_TIER_ENABLED\) return NextResponse\.json\(\{ error: 'Not found' \}, \{ status: 404 \}\);/);
    assert.match(branch, /houseLeagueRefusal\(ctx, 'register', season\)/);
  });
  it('the account menu asks for "Your family" only when it opens, only for the customer menu, and draws it only on an answer', () => {
    const menu = readCode('components/shared/AccountMenu.tsx');
    assert.match(menu, /if \(next && showAccount && !familyAsked\.current\)/);
    assert.match(menu, /\{showAccount && familyHref && \(/);
  });
});

describe('guard (g) — no family payload carries teammates (drawing tab 3: never the roster, other children, other families)', () => {
  const home = readSource('lib/family-home.ts');
  const fields = (name: string) => {
    const m = new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`).exec(home);
    assert.ok(m, name);
    return [...m![1].matchAll(/^\s{2}(\w+)\??:/gm)].map(x => x[1]);
  };
  it('the team card names the team, its next event and the account’s OWN children — an allow-list', () => {
    assert.deepEqual(fields('FamilyTeamCard'),
      ['kind', 'teamId', 'orgId', 'teamName', 'divisionName', 'seasonLine', 'children', 'childIds', 'nextUp', 'href']);
  });
  it('a child is its id, link, club and FIRST name — nothing else of the record', () => {
    assert.deepEqual(fields('FamilyChild'), ['childId', 'linkId', 'orgId', 'firstName', 'invitedAs', 'teams']);
    assert.match(home, /from\('org_children'\)\.select\('id, first_name'\)/);
  });
  it('the family reader never reads a roster; the schedule reader reads team events only', () => {
    const code = readCode('lib/family-home.ts');
    assert.ok(!/rep_roster_players|league_team_players/.test(code));
    assert.ok(!/medical|emergency/.test(code.replace(/\/\/.*$/gm, '')));
    assert.ok(!/rep_roster_players/.test(readCode('lib/family-team-schedule.ts')));
  });
  it('a schedule entry has no player field (the allow-list DTO is unchanged)', () => {
    const view = readSource('lib/family-view.ts');
    const entry = between(view, 'export interface FamilyScheduleEntry {', 'export interface FamilyTeamView');
    assert.ok(!/player|child|guardian/i.test(entry.replace(/\/\*[\s\S]*?\*\//g, '')));
  });
});

describe('ruling 7 — neither parent removes the other; the club removes', () => {
  it('Leave ends ONLY the signed-in account’s own link (ended_by parent, scoped to the user)', () => {
    const leave = readCode('app/api/family/children/[childId]/leave/route.ts');
    assert.match(leave, /endFamilyLink\(\{ by: 'parent', linkId: child\.linkId, userId: user\.id \}\)/);
    assert.match(functionBody(readCode('lib/family-invitation.ts'), 'endFamilyLink'), /params\.by === 'parent' \? q\.eq\('user_id', params\.userId\)/);
  });
  it('the family pages have no door that ends someone else’s link', () => {
    for (const f of ['app/(consumer)/family/children/[childId]/page.tsx', 'app/(consumer)/family/children/[childId]/LeaveButton.tsx']) {
      assert.ok(!/linkId/.test(readCode(f)), f);
    }
  });
  it('the club’s Remove ends a VERIFIED link of THIS registration’s child only, ended_by club (guard e: it blocks the automatic invitation)', () => {
    const remove = functionBody(readCode('lib/family-registration-status.ts'), 'removeFamilyParent');
    assert.match(remove, /\.eq\('child_id', childId\)\.eq\('status', 'verified'\)/);
    assert.match(remove, /endFamilyLink\(\{ by: 'club', linkId: params\.linkId, orgId: params\.orgId \}\)/);
  });
  it('Send again re-sends the placement email to ONE address, reconnecting (ruling 9)', () => {
    assert.match(functionBody(readCode('lib/family-registration-status.ts'), 'sendFamilyInvitationAgain'),
      /resendPlacementInvitation\(\{ orgId: params\.orgId, email, sentByUserId: params\.sentByUserId, reconnects: true \}\)/);
  });
});

describe('Part 6.5–6.6 — Your sign-up inside the app, and the emailed page’s way back', () => {
  it('the in-app page is found by the connection (an address ON the sign-up), and rebuilds the CURRENT link on the server', () => {
    const home = readCode('lib/family-home.ts');
    assert.match(functionBody(home, 'readFamilySignups'),
      /normalizeGuardianEmail\(r\.guardian_email\) === l\.invitedEmail \|\| normalizeGuardianEmail\(r\.guardian_email_2\) === l\.invitedEmail/);
    assert.match(functionBody(home, 'familySignupFor'), /currentSignupToken\(registrationId, \{ linkVersion: Number\(/);
    const page = readCode('app/(consumer)/family/signup/[registrationId]/page.tsx');
    assert.match(page, /footLine=\{W\.inApp\.seeing\(mine\.children\)\}/);
  });
  it('the way back’s "Email me an invitation" sends to the FIRST address on the sign-up only, and answers the same always', () => {
    const route = readCode('app/api/family/signup-invitation/route.ts');
    assert.match(route, /select\('org_id, guardian_email'\)/);
    assert.ok(!/guardian_email_2/.test(route));
    assert.equal((route.match(/return NextResponse\.json\(\{ ok: true \}\)/g) ?? []).length, 2);
  });
  it('guard (f) — neither door signs anyone in', () => {
    for (const f of ['app/api/family/signup-invitation/route.ts', 'app/(consumer)/family/signup/[registrationId]/page.tsx']) {
      assert.ok(!/signInWith|setSession|verifyOtp|generateLink/.test(readCode(f)), f);
    }
  });
});
