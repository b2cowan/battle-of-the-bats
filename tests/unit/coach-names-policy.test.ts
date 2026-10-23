import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  COACH_NAMES_POLICIES, coachNameListing, coachNamesRoleOf, listingChange, parseCoachNamesPolicy, sanitizeCoachNamesPolicy,
  seatNameListing, type CoachNamesPolicy, type CoachNamesRole, type ListingSeat,
} from '../../lib/coach-names-policy.ts';
import { coachNameRowWords, coachNamesAdminFacts, coachNamesWindow, COACH_NAMES_CHOICES } from '../../lib/coach-names-words.ts';
import { coachListedNotice } from '../../lib/coach-names-notice.ts';
import { STAFF_PRESETS } from '../../lib/coach-capabilities.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * Coach names: the club decides who is listed (mig 352; drawings ruled 2026-10-23). THE RULE, its counts and its words.
 * The wiring (route, shelf, tryout line, notice registration): coach-names-policy-guard.test.ts.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ROLES: CoachNamesRole[] = ['head', 'assistant', 'manager', 'treasurer', 'helper'];

/** The ruled table, written out cell by cell — the rule must equal it for every role and both switch values. */
const TABLE: Record<CoachNamesPolicy, Record<CoachNamesRole, 'own' | 'listed' | 'not'>> = {
  coaches_choose:              { head: 'own',    assistant: 'own',    manager: 'own', treasurer: 'own', helper: 'own' },
  heads_always:                { head: 'listed', assistant: 'own',    manager: 'own', treasurer: 'own', helper: 'own' },
  heads_and_assistants_always: { head: 'listed', assistant: 'listed', manager: 'own', treasurer: 'own', helper: 'own' },
  none:                        { head: 'not',    assistant: 'not',    manager: 'not', treasurer: 'not', helper: 'not' },
};

describe('the rule: every choice × every role × the coach\'s own switch on and off', () => {
  for (const policy of COACH_NAMES_POLICIES) {
    for (const role of ROLES) {
      for (const own of [true, false]) {
        it(`${policy} · ${role} · switch ${own ? 'on' : 'off'}`, () => {
          const cell = TABLE[policy][role];
          const got = coachNameListing(policy, role, own);
          if (cell === 'own') assert.deepEqual(got, { listed: own, ownSwitchApplies: true });
          else assert.deepEqual(got, { listed: cell === 'listed', ownSwitchApplies: false });
        });
      }
    }
  }

  it('four choices exist, and a stored value that is not one of them reads as "Coaches choose" (the fail-closed reading)', () => {
    assert.deepEqual([...COACH_NAMES_POLICIES], ['coaches_choose', 'heads_always', 'heads_and_assistants_always', 'none']);
    for (const bad of [undefined, null, '', 'all', 'NONE', 3]) assert.equal(sanitizeCoachNamesPolicy(bad), 'coaches_choose');
    for (const bad of [undefined, null, '', 'all', 'NONE', 3]) assert.equal(parseCoachNamesPolicy(bad), null);
    assert.equal(parseCoachNamesPolicy('none'), 'none');
  });
});

describe('the role word: the display word, never coach_role', () => {
  const seat = (over: Partial<Parameters<typeof coachNamesRoleOf>[0]>) => ({ coachRole: 'assistant_coach' as const, capabilities: null, staffKind: null, ...over });

  it('a head coach is head; an assistant row with no stored kind falls back to its grant shape (assistant)', () => {
    assert.equal(coachNamesRoleOf(seat({ coachRole: 'head_coach' })), 'head');
    assert.equal(coachNamesRoleOf(seat({})), 'assistant');
  });

  it('a manager or treasurer has coach_role assistant_coach but is NOT an assistant here (the stored kind wins)', () => {
    assert.equal(coachNamesRoleOf(seat({ staffKind: 'manager' })), 'manager');
    assert.equal(coachNamesRoleOf(seat({ staffKind: 'treasurer' })), 'treasurer');
    assert.equal(seatNameListing('heads_and_assistants_always', { ...seat({ staffKind: 'manager' }), showNamePublic: false }).listed, false);
    assert.equal(seatNameListing('heads_and_assistants_always', { ...seat({ staffKind: 'manager' }), showNamePublic: true }).listed, true);
  });

  it('a row with no stored kind and a helper-shaped bundle reads as a helper (existing behaviour, tested)', () => {
    const helper = seat({ capabilities: STAFF_PRESETS.helper });
    assert.equal(coachNamesRoleOf(helper), 'helper');
  });
});

describe('what a change of choice does: the window\'s counts and the notice\'s audience', () => {
  const seats: ListingSeat[] = [
    { teamId: 't1', userId: 'jordan', role: 'head', ownSwitch: true, hasName: true },       // already listed by their own switch
    { teamId: 't2', userId: 'pat', role: 'head', ownSwitch: false, hasName: true },
    { teamId: 't1', userId: 'sam', role: 'assistant', ownSwitch: false, hasName: true },
    { teamId: 't2', userId: 'lee', role: 'assistant', ownSwitch: true, hasName: true },      // already listed by their own switch
    { teamId: 't2', userId: 'dana', role: 'manager', ownSwitch: false, hasName: true },
    { teamId: 't3', userId: 'noname', role: 'head', ownSwitch: false, hasName: false },      // no name on file: never counted
    { teamId: 't3', userId: 'pat', role: 'assistant', ownSwitch: false, hasName: true },     // Pat is a head on t2 and an assistant on t3
  ];

  it('Head coaches always newly lists only the heads who were not already listed, and counts each person once', () => {
    const c = listingChange('coaches_choose', 'heads_always', seats);
    assert.deepEqual(c.newlyListedUserIds, ['pat']);
    assert.equal(c.heads, 1);
    assert.equal(c.assistants, 0);
    assert.equal(c.teams, 1);
    assert.equal(c.noLongerListed, 0);
    assert.equal(c.newlyListedFirstTeam.get('pat'), 't2');
  });

  it('Head and assistant coaches always from Coaches choose adds assistants; a person who is both counts once as a person', () => {
    const c = listingChange('coaches_choose', 'heads_and_assistants_always', seats);
    assert.deepEqual([...c.newlyListedUserIds].sort(), ['pat', 'sam']);
    assert.equal(c.heads, 1);
    assert.equal(c.assistants, 2); // Sam, and Pat on t3
    assert.equal(c.teams, 3);
  });

  it('from Head coaches always to Head and assistant coaches always counts the assistants alone', () => {
    const c = listingChange('heads_always', 'heads_and_assistants_always', seats);
    assert.equal(c.heads, 0);
    assert.deepEqual([...c.newlyListedUserIds].sort(), ['pat', 'sam']);
    assert.equal(c.assistants, 2);
  });

  it('control handed back is NOT "newly listed": from No coach names to Coaches choose, or to a choice that leaves the coach their own switch, no one is counted or told', () => {
    assert.deepEqual(listingChange('none', 'coaches_choose', seats).newlyListedUserIds, []);
    assert.equal(listingChange('none', 'coaches_choose', seats).teams, 0);
    // None -> Head coaches always: the heads the club now lists are newly listed (Jordan too: None had hidden him);
    // Lee, an assistant whose own switch is on, is not (his own switch lists him).
    const c = listingChange('none', 'heads_always', seats);
    assert.deepEqual([...c.newlyListedUserIds].sort(), ['jordan', 'pat']);
    assert.equal(c.assistants, 0);
    assert.equal(c.teams, 2, 'only teams that gained a head the club lists');
  });

  it('hiding names or giving the choice back newly lists no one, so no notice goes (the audience is empty)', () => {
    assert.deepEqual(listingChange('heads_and_assistants_always', 'none', seats).newlyListedUserIds, []);
    assert.deepEqual(listingChange('heads_and_assistants_always', 'coaches_choose', seats).newlyListedUserIds, []);
    assert.deepEqual(listingChange('heads_and_assistants_always', 'heads_always', seats).newlyListedUserIds, []);
  });

  it('No coach names counts who stops being listed: the switch-on coaches and the club-listed heads', () => {
    assert.equal(listingChange('coaches_choose', 'none', seats).noLongerListed, 2); // Jordan and Lee
    assert.equal(listingChange('heads_always', 'none', seats).noLongerListed, 3);   // Jordan, Pat, Lee
  });
});

describe('the words: the five coach states, the admin facts and the two windows', () => {
  it('the coach row, state by state, never a tag or a greyed switch (plain text in the control slot, or the switch)', () => {
    assert.deepEqual(coachNameRowWords({ policy: 'coaches_choose', ownSwitchApplies: true, listedByClub: false }),
      { description: 'Your name and role only.', controlText: null });
    assert.deepEqual(coachNameRowWords({ policy: 'heads_always', ownSwitchApplies: false, listedByClub: true }),
      { description: 'Your club lists every head coach, with your name and role. Nothing else.', controlText: 'Listed by your club' });
    assert.deepEqual(coachNameRowWords({ policy: 'heads_and_assistants_always', ownSwitchApplies: false, listedByClub: true }),
      { description: 'Your club lists every head coach and assistant coach, with your name and role. Nothing else.', controlText: 'Listed by your club' });
    assert.deepEqual(coachNameRowWords({ policy: 'heads_always', ownSwitchApplies: true, listedByClub: false }),
      { description: 'Your club lists every head coach. For other staff it’s your choice. Your name and role only.', controlText: null });
    assert.deepEqual(coachNameRowWords({ policy: 'heads_and_assistants_always', ownSwitchApplies: true, listedByClub: false }),
      { description: 'Your club lists every head coach and assistant coach. For other staff it’s your choice. Your name and role only.', controlText: null });
    assert.deepEqual(coachNameRowWords({ policy: 'none', ownSwitchApplies: false, listedByClub: false }),
      { description: 'Your club isn’t listing coach names on public pages.', controlText: 'Not listed by your club' });
  });

  it('the four choices carry their names in order, and an admin reads plain facts', () => {
    assert.deepEqual(COACH_NAMES_CHOICES.map(c => c.name), ['Coaches choose', 'Head coaches always', 'Head and assistant coaches always', 'No coach names']);
    assert.deepEqual(coachNamesAdminFacts('heads_always'), { listed: 'Every head coach', choose: 'Assistant coaches and other staff' });
    assert.deepEqual(coachNamesAdminFacts('none'), { listed: 'No one', choose: null });
  });

  it('the windows state the REAL counts, singular and plural, and say nothing for a choice that has nothing to ask', () => {
    assert.deepEqual(coachNamesWindow('heads_always', { people: 7, heads: 7, assistants: 0, teams: 7 }), {
      title: 'List every head coach on team pages?',
      body: "7 head coaches on 7 teams will be listed under Coaches on their teams' public pages, with their name and role. Each one gets a notice and can read it in Team settings.",
    });
    assert.deepEqual(coachNamesWindow('heads_always', { people: 1, heads: 1, assistants: 0, teams: 1 })?.body,
      "1 head coach on 1 team will be listed under Coaches on their team's public page, with their name and role. Each one gets a notice and can read it in Team settings.");
    assert.deepEqual(coachNamesWindow('heads_and_assistants_always', { people: 18, heads: 7, assistants: 11, teams: 7 }), {
      title: 'List head and assistant coaches on team pages?',
      body: "7 head coaches and 11 assistant coaches, on 7 teams, will be listed under Coaches on their teams' public pages, with their name and role. Each one gets a notice and can read it in Team settings.",
    });
    // Heads only newly listed under the second "always" choice: the title says so (no assistants to name).
    assert.equal(coachNamesWindow('heads_and_assistants_always', { people: 3, heads: 3, assistants: 0, teams: 3 })?.title, 'List every head coach on team pages?');
    // Going from Head coaches always: the assistants alone.
    assert.deepEqual(coachNamesWindow('heads_and_assistants_always', { people: 11, heads: 0, assistants: 11, teams: 7 })?.title, 'List assistant coaches on team pages?');
    assert.match(coachNamesWindow('heads_and_assistants_always', { people: 11, heads: 0, assistants: 11, teams: 7 })!.body, /^11 assistant coaches on 7 teams will be listed/);
    // Nothing newly listed, or a choice that only takes names away: no window.
    assert.equal(coachNamesWindow('heads_always', { people: 0, heads: 0, assistants: 0, teams: 0 }), null);
    assert.equal(coachNamesWindow('none', { people: 9, heads: 9, assistants: 0, teams: 9 }), null);
    assert.equal(coachNamesWindow('coaches_choose', { people: 9, heads: 9, assistants: 0, teams: 9 }), null);
  });

  it('the notice names the club, the role and the public page, and no team', () => {
    const n = coachListedNotice({ clubName: 'Lakeshore Lynx' });
    assert.equal(n.title, 'Lakeshore Lynx now lists you as a coach');
    assert.equal(n.body, 'Your name and role show under Coaches on your team’s public page. Your club chose this for every team.');
  });
});
