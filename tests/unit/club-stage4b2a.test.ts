import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  tournamentHomeStatus,
  TOURNAMENT_STATUS_WORD,
  teamGridOneColumn,
  clubTeamBands,
  teamRowDivision,
  clubHomeTournaments,
  orderOpenNow,
} from '../../lib/club-site-home.ts';
import { teamPageParts, teamMetaLine, splitPublicSchedule } from '../../lib/club-team-page.ts';
import { orgSectionsFor } from '../../lib/org-public-sections.ts';
import { clubHomeSectionsFor } from '../../lib/club-site-sections.ts';

/** A club that never opened the editor (Stage 4c-1's default order), on a plan that carries every program. */
const clubHomeSections = (has: Parameters<typeof clubHomeSectionsFor>[0]) =>
  clubHomeSectionsFor(has, { order: undefined, hidden: undefined }, { teams: true, league: true, tournaments: true });
import { clubTeamsAddress, type PublicClubAccessOrg } from '../../lib/public-club-access.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE YEAR-ROUND CLUB (Club Tier Stage 4b-2a; drawings ruled 2026-10-19, End states 1–3). The pure rules behind a
 * club's home, its Teams page and tab, and the team page's recipe. The wiring is pinned by club-stage4b2a-guard.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

describe('the home: one fixed order, and a program the club does not run is absent (Ask 3A)', () => {
  const none = { openNow: 0, teams: 0, league: false, tournaments: 0, about: false };

  it('rep only, a tryout open: Open now → Teams → About; no Tournaments, no House league', () => {
    assert.deepEqual(clubHomeSections({ ...none, openNow: 1, teams: 8, about: true }), ['openNow', 'teams', 'about']);
  });
  it('rep only, nothing open: Open now is absent and the teams move up', () => {
    assert.deepEqual(clubHomeSections({ ...none, teams: 8, about: true }), ['teams', 'about']);
  });
  it('rep + house league + a tournament: the whole ruled order', () => {
    assert.deepEqual(
      clubHomeSections({ openNow: 2, teams: 5, league: true, tournaments: 1, about: true }),
      ['openNow', 'teams', 'league', 'tournaments', 'about'],
    );
  });
  it('no about text: no About card', () => {
    assert.deepEqual(clubHomeSections({ ...none, teams: 2 }), ['teams']);
  });
  it('a club with nothing to show yet: nothing, never a "check back soon"', () => {
    assert.deepEqual(clubHomeSections(none), []);
  });
});

describe('Open now: nearest deadline first', () => {
  it('rows with a deadline come first, earliest first; rows without keep their order after them', () => {
    const rows = [
      { key: 'tryout-a', deadline: null },
      { key: 'league-late', deadline: '2026-11-30' },
      { key: 'tryout-b', deadline: null },
      { key: 'league-soon', deadline: '2026-10-31' },
    ];
    assert.deepEqual(orderOpenNow(rows).map(r => r.key), ['league-soon', 'league-late', 'tryout-a', 'tryout-b']);
  });
});

describe('a tournament says what is true (S4-03)', () => {
  // 2026-10-20 is a Tuesday; that weekend is Fri 23 · Sat 24 · Sun 25.
  const TUE = '2026-10-20';
  const t = (startDate?: string, endDate?: string, status: 'active' | 'completed' | 'archived' | 'draft' = 'active') =>
    ({ status, startDate, endDate });

  it('Live now only while the dates include today', () => {
    assert.equal(tournamentHomeStatus(t('2026-10-19', '2026-10-21'), TUE, false), 'live');
    assert.equal(tournamentHomeStatus(t(TUE, TUE), TUE, false), 'live');
    assert.equal(tournamentHomeStatus(t('2026-10-21', '2026-10-22'), TUE, false), null);
  });
  it('Finished when its dates are behind it, or the organizer completed it', () => {
    assert.equal(tournamentHomeStatus(t('2026-10-17', '2026-10-19'), TUE, false), 'finished');
    assert.equal(tournamentHomeStatus(t('2026-11-07', '2026-11-08', 'completed'), TUE, false), 'finished');
  });
  it('This weekend when it starts on the coming Friday, Saturday or Sunday', () => {
    assert.equal(tournamentHomeStatus(t('2026-10-24', '2026-10-25'), TUE, false), 'thisWeekend');
    assert.equal(tournamentHomeStatus(t('2026-10-23', '2026-10-25'), TUE, true), 'thisWeekend');
    assert.equal(tournamentHomeStatus(t('2026-10-25', '2026-10-25'), '2026-10-24', false), 'thisWeekend');
  });
  it('a weekday start this week is not "this weekend"; next weekend is not either', () => {
    assert.equal(tournamentHomeStatus(t('2026-10-22', '2026-10-22'), TUE, false), null);
    assert.equal(tournamentHomeStatus(t('2026-10-31', '2026-11-01'), TUE, false), null);
    assert.equal(tournamentHomeStatus(t('2026-10-30', '2026-11-01'), '2026-10-25', false), null);
  });
  it('Registration open before it starts, when its sign-up is open', () => {
    assert.equal(tournamentHomeStatus(t('2027-06-13', '2027-06-15'), TUE, true), 'registrationOpen');
    assert.equal(tournamentHomeStatus(t('2027-06-13', '2027-06-15'), TUE, false), null);
  });
  it('one phrase per meaning, sentence case', () => {
    assert.deepEqual(TOURNAMENT_STATUS_WORD, {
      live: 'Live now', thisWeekend: 'This weekend', registrationOpen: 'Registration open', finished: 'Finished',
    });
  });
});

describe('the home lists running and coming tournaments, then ones that just finished', () => {
  const TUE = '2026-10-20';
  const t = (name: string, status: string, startDate: string, endDate: string) => ({ name, status, startDate, endDate });
  it('coming soonest first, then finished latest first; a month-old finish, a draft and an archive are not listed', () => {
    const list = clubHomeTournaments([
      t('june', 'active', '2027-06-13', '2027-06-15'),
      t('old', 'completed', '2026-09-01', '2026-09-02'),
      t('just-done', 'active', '2026-10-17', '2026-10-19'),
      t('now', 'active', '2026-10-19', '2026-10-21'),
      t('earlier-done', 'completed', '2026-10-03', '2026-10-04'),
      t('draft', 'draft', '2026-11-01', '2026-11-01'),
      t('archived', 'archived', '2026-10-10', '2026-10-11'),
      t('never-closed', 'active', '2026-08-01', '2026-08-02'), // its organizer never marked it completed
    ], TUE);
    assert.deepEqual(list.map(x => x.name), ['now', 'june', 'just-done', 'earlier-done']);
  });
});

describe('the home team grid (DC-01): one column when a name will not fit half the width', () => {
  it('short names keep two columns', () => {
    assert.equal(teamGridOneColumn(['15U AAA', '13U AAA']), false);
    assert.equal(teamGridOneColumn(['Girls U15 Navy']), false); // 14 characters: still fits
  });
  it('one long name sends its group to one column', () => {
    assert.equal(teamGridOneColumn(['U13 Elite', 'Girls U13 Elite Gold']), true);
  });
});

describe('the club’s own groups (Ask 4A)', () => {
  const groups = [
    { id: 'g-aa', name: 'AA', displayOrder: 1 },
    { id: 'g-aaa', name: 'AAA', displayOrder: 0 },
  ];
  const team = (name: string, groupId: string | null) => ({ name, groupId });

  it('bands follow the club’s group order; teams sort by name, numbers as numbers', () => {
    const bands = clubTeamBands([team('9U AA', 'g-aa'), team('15U AAA', 'g-aaa'), team('11U AA', 'g-aa'), team('13U AAA', 'g-aaa')], groups);
    assert.deepEqual(bands.map(b => [b.name, b.teams.map(t => t.name)]), [
      ['AAA', ['13U AAA', '15U AAA']],
      ['AA', ['9U AA', '11U AA']],
    ]);
  });
  it('a club that never set groups gets one list with no band', () => {
    const bands = clubTeamBands([team('12U', null), team('10U', null)], []);
    assert.deepEqual(bands.map(b => [b.name, b.teams.map(t => t.name)]), [[null, ['10U', '12U']]]);
  });
  it('teams outside every group, beside grouped ones, come last under "Other teams"', () => {
    const bands = clubTeamBands([team('Development', null), team('15U AAA', 'g-aaa')], groups);
    assert.deepEqual(bands.map(b => b.name), ['AAA', 'Other teams']);
  });
  it('a group with no teams has no band', () => {
    assert.deepEqual(clubTeamBands([team('15U AAA', 'g-aaa')], groups).map(b => b.name), ['AAA']);
  });
  it('the division shows under a name only when the band and the name do not already say it', () => {
    assert.equal(teamRowDivision('Provincial AAA', 'AAA', '15U AAA'), null);
    assert.equal(teamRowDivision('15U', 'Senior', '15U AA'), null);
    assert.equal(teamRowDivision('Provincial AA', 'A', 'Lynx Blue'), 'Provincial AA');
    assert.equal(teamRowDivision('U13', 'Girls', 'Harbourview Gold'), 'U13');
    assert.equal(teamRowDivision(null, 'AAA', '15U AAA'), null);
  });
});

describe('the tab row: Home · Teams · House league · Past tournaments (Ask 9A)', () => {
  it('Teams is second when the club lists a team', () => {
    assert.deepEqual(orgSectionsFor({ league: true, archives: true, teams: true }).map(s => s.label),
      ['Home', 'Teams', 'House league', 'Past tournaments']);
  });
  it('a club that lists no team has no Teams tab', () => {
    assert.deepEqual(orgSectionsFor({ league: true, archives: false, teams: false }).map(s => s.label), ['Home', 'House league']);
  });
  it('a rep-only club: Home · Teams', () => {
    assert.deepEqual(orgSectionsFor({ league: false, archives: false, teams: true }).map(s => s.key), ['', 'teams']);
  });
});

describe('what /{club}/teams is', () => {
  const org = (over: Partial<PublicClubAccessOrg> = {}): PublicClubAccessOrg =>
    ({ isPublic: true, subscriptionStatus: 'active', planId: 'club', enabledAddons: [], freeFloor: null, accountKind: 'organization', ...over }) as PublicClubAccessOrg;

  it('a club whose plan carries rep teams and a public site: the Teams page', () => {
    assert.equal(clubTeamsAddress(org()), 'teams-page');
    assert.equal(clubTeamsAddress(org({ planId: 'club_large' })), 'teams-page');
  });
  it('an org with no rep teams keeps the shortcut into its running tournament (printed QR codes)', () => {
    assert.equal(clubTeamsAddress(org({ planId: 'league' })), 'shortcut');
    assert.equal(clubTeamsAddress(org({ planId: 'tournament_plus' })), 'shortcut');
    assert.equal(clubTeamsAddress(org({ planId: 'tournament' })), 'shortcut');
  });
  it('a standalone coaches-portal team has no club Teams page', () => {
    assert.equal(clubTeamsAddress(org({ planId: 'team', accountKind: 'team_workspace' })), 'shortcut');
  });
});

describe('the team page recipe (End state 3): a part with nothing to show is absent', () => {
  it('tryouts open, schedule public, about written: door → schedule → about', () => {
    assert.deepEqual(teamPageParts({ archived: false, tryoutOpen: true, schedule: true, about: true }), ['tryoutDoor', 'schedule', 'about']);
  });
  it('a quiet team says so in one sentence, and has no schedule when the coach has not chosen Public link', () => {
    assert.deepEqual(teamPageParts({ archived: false, tryoutOpen: false, schedule: false, about: true }), ['tryoutQuiet', 'about']);
  });
  it('no about text: no About card', () => {
    assert.deepEqual(teamPageParts({ archived: false, tryoutOpen: true, schedule: false, about: false }), ['tryoutDoor']);
  });
  it('an archived team: concluded, no tryout part at all', () => {
    assert.deepEqual(teamPageParts({ archived: true, tryoutOpen: false, schedule: false, about: true }), ['concluded', 'about']);
  });
  it('division and season under the name; either alone; nothing when neither', () => {
    assert.equal(teamMetaLine('Provincial AAA', 2026), 'Provincial AAA · 2026 season');
    assert.equal(teamMetaLine(null, 2026), '2026 season');
    assert.equal(teamMetaLine('15U', null), '15U');
    assert.equal(teamMetaLine(null, null), null);
  });
});

describe('the schedule: earlier this season above Up next, then the next few, then the rest on demand', () => {
  const NOW = Date.parse('2026-10-20T16:00:00Z');
  const e = (id: string, startsAt: string) => ({ id, startsAt });
  const entries = [
    e('past1', '2026-10-01T23:00:00Z'), e('past2', '2026-10-10T23:00:00Z'),
    e('n1', '2026-10-22T23:00:00Z'), e('n2', '2026-10-25T12:00:00Z'), e('n3', '2026-10-31T17:00:00Z'),
    e('n4', '2026-11-01T12:00:00Z'), e('n5', '2026-11-07T15:00:00Z'), e('n6', '2026-11-08T13:00:00Z'),
  ];
  it('splits at now, four shown', () => {
    const s = splitPublicSchedule(entries, NOW);
    assert.deepEqual(s.earlier.map(x => x.id), ['past1', 'past2']);
    assert.deepEqual(s.upcoming.map(x => x.id), ['n1', 'n2', 'n3', 'n4']);
    assert.deepEqual(s.later.map(x => x.id), ['n5', 'n6']);
  });
  it('a game in progress stays in view until it ends', () => {
    const live = { id: 'live', startsAt: '2026-10-20T15:00:00Z', endsAt: '2026-10-20T17:00:00Z' };
    const s = splitPublicSchedule([...entries, live], NOW);
    assert.deepEqual(s.upcoming.map(x => x.id), ['live', 'n1', 'n2', 'n3']);
    assert.ok(!s.earlier.some(x => x.id === 'live'));
  });
  it('a season with nothing played yet has no earlier fold', () => {
    assert.equal(splitPublicSchedule(entries.slice(2), NOW).earlier.length, 0);
  });
  it('a season that is all played has nothing upcoming', () => {
    const s = splitPublicSchedule(entries.slice(0, 2), NOW);
    assert.deepEqual([s.earlier.length, s.upcoming.length, s.later.length], [2, 0, 0]);
  });
});
