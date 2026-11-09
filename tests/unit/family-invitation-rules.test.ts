import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { teamsReached, isLiveLeagueSeasonStatus, type TeamEntry } from '../../lib/family-link-reach.ts';
import {
  ageOn, connectables, emailDecision, emailMatches, guardianAgeBand, invitationState, maskEmail, placementDecision,
  type AddressChildState, type ChildAddressFacts, type InvitationRow, type PlacedSignup,
} from '../../lib/family-invitation-rules.ts';
import { beforeYouJoinWords, guardianConsentText, GUARDIAN_CONSENT_DRAFT_NOTICE, GUARDIAN_CONSENT_VERSION, namesList } from '../../lib/family-guardian-consent.ts';
import { readCode, readSource } from './_source-code.ts';

/**
 * SIGNED-IN FAMILY ACCOUNTS STAGE 4a — Parts 2 and 3 (plan SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md Stage 4, RULED 2026-11-08 all 15
 * asks A + O1/O2; build prompt SIGNED_IN_FAMILY_STAGE4_BUILD_PROMPT.md). What a connection reaches (the child, on every team in
 * the club) and the invitation rules, pure. The database half is tests/sql/family-invitation-fixture.sql (S4A FIXTURE OK 10/10).
 */

const rep = (id: string, teamId: string, status = 'active', created = '2027-01-01'): TeamEntry =>
  ({ id, kind: 'rep', teamId, published: true, seasonStatus: status, seasonYear: 2027, seasonCreatedAt: created });
const league = (id: string, teamId: string, status = 'registration_closed', published = true, created = '2027-02-01'): TeamEntry =>
  ({ id, kind: 'league', teamId, published, seasonStatus: status, seasonYear: 2027, seasonCreatedAt: created });

describe('Part 2 — a connection reaches the child on every team it is live on', () => {
  it('a child on a rep team and a house-league team reaches both', () => {
    const out = teamsReached([rep('r1', 'repA'), league('l1', 'otters')]);
    assert.deepEqual(out.map(t => `${t.kind}:${t.teamId}:${t.entryId}`), ['rep:repA:r1', 'league:otters:l1']);
  });
  it('a house-league team reaches only once its division is PUBLISHED (the draft board sets the team first)', () => {
    assert.deepEqual(teamsReached([league('l1', 'otters', 'registration_closed', false)]), []);
  });
  it('a house-league season is live in its registration statuses and closed when completed or archived', () => {
    for (const s of ['draft', 'registration_open', 'registration_closed', 'active']) assert.equal(isLiveLeagueSeasonStatus(s), true, s);
    for (const s of ['completed', 'archived', null]) assert.equal(isLiveLeagueSeasonStatus(s), false, String(s));
    assert.deepEqual(teamsReached([league('l1', 'otters', 'completed')]), []);
  });
  it('a closed rep season stops reaching; a roll reaches the new season', () => {
    assert.deepEqual(teamsReached([rep('r26', 'repA', 'completed')]), []);
    assert.deepEqual(teamsReached([rep('r26', 'repA', 'completed', '2026-01-01'), rep('r27', 'repA', 'active')]).map(t => t.entryId), ['r27']);
  });
  it('a moved child reaches the new team and not the old (the sign-up carries one team)', () => {
    assert.deepEqual(teamsReached([league('l1', 'falcons')]).map(t => t.teamId), ['falcons']);
  });
  it('the read feeds the rule only accepted, placed sign-ups and never a call-up; nothing filters on the link’s team', () => {
    const src = readCode('lib/family-access.ts');
    const read = src.slice(src.indexOf('async function readChildTeamEntries'));
    assert.match(read, /\.neq\('status', 'callup'\)/);
    assert.match(read, /from\('league_registrations'\)[\s\S]*?\.eq\('status', 'active'\)\.not\('team_id', 'is', null\)/);
    assert.match(read, /league_divisions\(teams_published_at\)/);
    // A withdrawn sign-up is not 'active', so it is never read: it stops reaching.
    const user = src.slice(src.indexOf('export async function getVerifiedLinkForUserTeam'), src.indexOf('export async function reachingLinks'));
    assert.doesNotMatch(user, /\.eq\('rep_team_id'/, 'the link for a user on a team is the CHILD’s reach, wherever the link was made');
  });
  it('a link naming no team reaches nothing through the rep-team door (a link in another org has no entry on the team)', () => {
    assert.match(readCode('lib/family-access.ts'), /if \(!l\.repTeamId\) continue;/);
  });
});

describe('Part 3 — who is invited at placement', () => {
  const base: ChildAddressFacts = { tierOn: true, band: 'minor', connected: false, endedBefore: false, otherLiveGuardians: 0 };
  it('invites by default', () => assert.equal(placementDecision(base), 'invite'));
  it('nothing while the tier is off', () => assert.equal(placementDecision({ ...base, tierOn: false }), 'none'));
  it('nothing for a player 18 or older', () => assert.equal(placementDecision({ ...base, band: 'adult' }), 'none'));
  it('nothing for an address that left or was removed (an ended link blocks the automatic invitation)', () =>
    assert.equal(placementDecision({ ...base, endedBefore: true }), 'none'));
  it('nothing for a child already at two guardians', () => assert.equal(placementDecision({ ...base, otherLiveGuardians: 2 }), 'none'));
  it('already connected wins over everything but the tier and the age', () => {
    assert.equal(placementDecision({ ...base, connected: true, endedBefore: true }), 'already_connected');
    assert.equal(placementDecision({ ...base, connected: true, band: 'adult' }), 'none');
  });
  it('one email: the panel when any child invites, the one-liner when one is connected, else nothing', () => {
    assert.equal(emailDecision(['none', 'invite', 'already_connected']), 'invite');
    assert.equal(emailDecision(['none', 'already_connected']), 'already_connected');
    assert.equal(emailDecision(['none']), 'none');
    assert.equal(emailDecision([]), 'none');
  });
  it('the stopped address needs no send-path check: no send path reads second_parent_stops', () => {
    assert.doesNotMatch(readCode('lib/family-invitation.ts'), /second_parent_stops/);
    assert.doesNotMatch(readCode('lib/family-invitation-rules.ts'), /second_parent_stops/);
  });
});

describe('Part 3 — the age band (ruling 12: no question; from the date of birth and the province)', () => {
  it('counts whole years without a Date', () => {
    assert.equal(ageOn('2009-11-08', '2027-11-08'), 18);
    assert.equal(ageOn('2009-11-09', '2027-11-08'), 17);
  });
  it('18 or older is adult; no date of birth is unknown (treated as a minor)', () => {
    assert.equal(guardianAgeBand({ dateOfBirth: '2008-01-01', province: 'ON', today: '2026-11-08' }).band, 'adult');
    assert.equal(guardianAgeBand({ dateOfBirth: null, province: 'ON', today: '2026-11-08' }).band, 'unknown');
  });
  it('Quebec, or an unknown province, takes the under-14 rule; elsewhere a 12-year-old is a minor', () => {
    assert.equal(guardianAgeBand({ dateOfBirth: '2014-06-01', province: 'QC', today: '2026-11-08' }).band, 'under_14');
    const unknown = guardianAgeBand({ dateOfBirth: '2014-06-01', province: null, today: '2026-11-08' });
    assert.deepEqual(unknown, { band: 'under_14', provinceKnown: false });
    assert.equal(guardianAgeBand({ dateOfBirth: '2014-06-01', province: 'ON', today: '2026-11-08' }).band, 'minor');
  });
});

describe('Part 3 — what one acceptance connects (ruling 3)', () => {
  const s = (registrationId: string, childId: string, name: string, first: string | null, second: string | null): PlacedSignup =>
    ({ registrationId, childId, childFirstName: name, dateOfBirth: '2017-05-05', firstEmail: first, secondEmail: second });
  const none = new Map<string, AddressChildState>();
  const minor = () => 'minor' as const;

  it('three siblings on two teams: one acceptance connects all three, first parent on each', () => {
    const placed = [
      s('a', 'leo', 'Leo', 'priya@example.com', 'sam@example.com'),   // Otters
      s('b', 'ava', 'Ava', 'Priya@Example.com ', null),               // Otters
      s('c', 'maya', 'Maya', 'priya@example.com', null),              // Falcons
      s('d', 'zed', 'Zed', 'other@example.com', null),                // another family
    ];
    const { connect } = connectables({ email: 'priya@example.com', placed, rep: null, state: none, bandOf: minor, reconnects: false });
    assert.deepEqual(connect.map(c => `${c.firstName}:${c.invitedAs}`), ['Leo:first_parent', 'Ava:first_parent', 'Maya:first_parent']);
  });
  it('a second parent is connected as second_parent (only that connection a stop may end)', () => {
    const placed = [s('a', 'leo', 'Leo', 'priya@example.com', 'sam@example.com')];
    const { connect } = connectables({ email: 'sam@example.com', placed, rep: null, state: none, bandOf: minor, reconnects: false });
    assert.equal(connect[0].invitedAs, 'second_parent');
  });
  it('an address on no sign-up connects nothing (an invitation reaches only an address on the child’s sign-up)', () => {
    const placed = [s('a', 'leo', 'Leo', 'priya@example.com', null)];
    assert.deepEqual(connectables({ email: 'stranger@example.com', placed, rep: null, state: none, bandOf: minor, reconnects: false }).connect, []);
  });
  it('an ended child is skipped unless the club’s Send again reconnects; an adult and a full child are skipped', () => {
    const placed = [s('a', 'leo', 'Leo', 'priya@example.com', null), s('b', 'ava', 'Ava', 'priya@example.com', null), s('c', 'maya', 'Maya', 'priya@example.com', null)];
    const state = new Map<string, AddressChildState>([
      ['leo', { childId: 'leo', liveStatus: null, endedBefore: true, otherLiveGuardians: 0 }],
      ['maya', { childId: 'maya', liveStatus: null, endedBefore: false, otherLiveGuardians: 2 }],
    ]);
    const bandOf = (dob: string | null) => (dob === 'adult' ? 'adult' as const : 'minor' as const);
    const plain = connectables({ email: 'priya@example.com', placed, rep: null, state, bandOf, reconnects: false });
    assert.deepEqual(plain.connect.map(c => c.childId), ['ava']);
    assert.deepEqual(plain.skipped.map(k => `${k.childId}:${k.reason}`).sort(), ['leo:ended', 'maya:cap']);
    assert.deepEqual(connectables({ email: 'priya@example.com', placed, rep: null, state, bandOf, reconnects: true }).connect.map(c => c.childId), ['leo', 'ava']);
  });
  it('a rep invitation connects the rep player and the address’s house-league children too', () => {
    const placed = [s('a', 'leo', 'Leo', 'priya@example.com', null)];
    const { connect } = connectables({
      email: 'priya@example.com', placed, state: none, bandOf: minor, reconnects: false,
      rep: { childId: 'kai', firstName: 'Kai', entryId: 'entry-kai', dateOfBirth: '2015-01-01' },
    });
    assert.deepEqual(connect.map(c => `${c.firstName}:${c.invitedAs}:${c.repEntryId}`), ['Leo:first_parent:null', 'Kai:rep_coach:entry-kai']);
  });
  it('an old unverified link of the address is upgraded, not duplicated; a verified one is already connected', () => {
    const placed = [s('a', 'leo', 'Leo', 'priya@example.com', null), s('b', 'ava', 'Ava', 'priya@example.com', null)];
    const state = new Map<string, AddressChildState>([
      ['leo', { childId: 'leo', liveStatus: 'invited', endedBefore: false, otherLiveGuardians: 2 }],
      ['ava', { childId: 'ava', liveStatus: 'verified', endedBefore: false, otherLiveGuardians: 0 }],
    ]);
    const out = connectables({ email: 'priya@example.com', placed, rep: null, state, bandOf: minor, reconnects: false });
    assert.deepEqual(out.connect.map(c => `${c.childId}:${c.upgrade}`), ['leo:true']);
    assert.deepEqual(out.skipped.map(k => `${k.childId}:${k.reason}`), ['ava:already_connected']);
  });
});

describe('Part 3 — an invitation’s state, and the email it is for', () => {
  const now = '2026-11-08T12:00:00.000Z';
  const inv = (over: Partial<InvitationRow> = {}): InvitationRow => ({
    email: 'priya@example.com', expiresAt: '2026-12-08T12:00:00.000Z', usedAt: null, usedByUserId: null, cancelledAt: null, replacedBy: null, ...over,
  });
  it('open, then expired or replaced (one answer for both)', () => {
    assert.equal(invitationState(inv(), now, null), 'open');
    assert.equal(invitationState(inv({ expiresAt: '2026-11-01T00:00:00.000Z' }), now, null), 'expired_or_replaced');
    assert.equal(invitationState(inv({ replacedBy: 'newer' }), now, null), 'expired_or_replaced');
  });
  it('used by you is joined; used by anyone else, cancelled or unknown no longer works (never saying why)', () => {
    assert.equal(invitationState(inv({ usedAt: now, usedByUserId: 'u1' }), now, 'u1'), 'joined');
    assert.equal(invitationState(inv({ usedAt: now, usedByUserId: 'u1' }), now, 'u2'), 'no_longer_works');
    assert.equal(invitationState(inv({ cancelledAt: now }), now, 'u1'), 'no_longer_works');
    assert.equal(invitationState(null, now, null), 'no_longer_works');
  });
  it('a different email is refused (ruling 5); case and spaces do not matter', () => {
    assert.equal(emailMatches('priya@example.com', ' Priya@Example.com'), true);
    assert.equal(emailMatches('priya@example.com', 'dana@example.com'), false);
    assert.equal(emailMatches('priya@example.com', null), false);
  });
  it('the address is shown partly hidden', () => {
    assert.equal(maskEmail('priya.shah@example.com'), 'p••••••@example.com');
    assert.equal(maskEmail('dana@example.com'), 'd•••@example.com');
  });
  it('the coach’s approval queue is gone: no pending_approval is written, no approve path exists', () => {
    assert.doesNotMatch(readCode('lib/family-guardian.ts'), /approveGuardianLink|claimGuardianInvite|inviteCoGuardian/);
    assert.doesNotMatch(readCode('lib/family-invitation.ts'), /status: 'pending_approval'/);
    assert.doesNotMatch(readCode('app/api/coaches/[orgSlug]/teams/[teamId]/guardians/route.ts'), /'approve'/);
  });
  it('the token never signs anyone in: the accept path reads the session, never creates one from the token', () => {
    const route = readCode('app/api/family/claim/[token]/route.ts');
    assert.match(route, /supabase\.auth\.getUser\(\)/);
    assert.doesNotMatch(route, /signIn|setSession|generateLink|verifyOtp/);
    assert.doesNotMatch(readCode('lib/family-invitation.ts'), /signIn|setSession|generateLink|verifyOtp/);
  });
  it('a stop ends only a second-parent connection (mig 453)', () => {
    const sql = readSource('supabase/migrations/453_a_family_joins_the_child_on_every_team.sql');
    const stop = sql.slice(sql.indexOf('create or replace function public.second_parent_stop('));
    assert.match(stop.slice(0, stop.indexOf('$function$;')), /invited_as = 'second_parent'/);
  });
});

describe('the consent words are /legal draft 0.1 (a), and the record stores them', () => {
  it('one child and several children', () => {
    const one = beforeYouJoinWords('Riverdale Minor Ball League', ['Aarav']);
    assert.equal(one.guardianBox, 'I’m Aarav’s parent or legal guardian.');
    assert.equal(one.intro, 'Riverdale Minor Ball League already has Aarav’s sign-up. Joining lets you see Aarav’s team, practices and games here, and your sign-up.');
    assert.equal(one.button, 'Join Aarav’s team');
    const many = beforeYouJoinWords('Riverdale', ['Leo', 'Ava', 'Maya']);
    assert.equal(many.guardianBox, 'I’m the parent or legal guardian of Leo, Ava and Maya.');
    assert.equal(many.pageTitle, 'Join your children’s teams');
    assert.equal(namesList(['Leo', 'Ava']), 'Leo and Ava');
  });
  it('the stored text leads with the version, carries both boxes, never an age band', () => {
    const text = guardianConsentText(beforeYouJoinWords('Riverdale', ['Leo']));
    assert.ok(text.startsWith(GUARDIAN_CONSENT_VERSION));
    assert.match(text, /\[x\] I’m Leo’s parent or legal guardian\./);
    assert.doesNotMatch(text, /under 1[34]|age band|18 or older/i);
  });
  it('the draft notice claims no review under way', () => {
    assert.equal(GUARDIAN_CONSENT_DRAFT_NOTICE, 'Draft wording — not final.');
    assert.doesNotMatch(readCode('lib/family-guardian-consent.ts'), /privacy advisor/);
  });
});
