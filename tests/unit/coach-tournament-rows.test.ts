import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  bandTournamentRows,
  finishFromStandings,
  registrationChip,
  tournamentRowFace,
  OWN_CLUB_TOURNAMENT_HOST,
  WAITING_ON_ORGANIZER,
  type TournamentRowEntry,
} from '../../lib/coach-tournament-rows.ts';
import { tournamentRoadBack } from '../../lib/coach-tournament-games.ts';

/**
 * Club Tier Stage 7d (drawing 6, Asks 8 + 12): ONE row for the coach's three Tournaments lists — the paid
 * team list, the free team list and the free account hub. Their words come from `tournamentRowFace`
 * alone, so the portals and the phone/computer faces cannot drift.
 */

const TODAY = '2026-10-22';
const entry = (over: Partial<TournamentRowEntry> & { status?: string; start?: string; end?: string; tStatus?: string } = {}): TournamentRowEntry => ({
  registration: { id: over.registration?.id ?? 'r1', name: '15U AAA', status: over.status ?? 'accepted' },
  tournament: { name: 'Guelph Fall Classic', startDate: over.start ?? '2026-11-06', endDate: over.end ?? '2026-11-08', status: over.tStatus ?? 'active' },
  org: { name: 'Guelph Minor Ball' },
  ourTeam: over.ourTeam,
  finish: over.finish,
});

describe('a row says one thing per slot', () => {
  it('an undecided entry: "Waiting on them", the date leading, the host in the caption', () => {
    const face = tournamentRowFace(entry({ status: 'pending' }), TODAY);
    assert.deepEqual(face, {
      band: 'coming',
      title: 'Guelph Fall Classic',
      lead: 'Nov 6–8',
      caption: 'Guelph Minor Ball',
      chip: { label: WAITING_ON_ORGANIZER, tone: 'waiting' },
    });
  });

  it('an accepted entry still ahead: "Accepted"; during the event the lifecycle chip says so', () => {
    assert.deepEqual(tournamentRowFace(entry(), TODAY).chip, { label: 'Accepted', tone: 'ok' });
    assert.deepEqual(tournamentRowFace(entry({ start: '2026-10-21', end: '2026-10-23' }), TODAY).chip, { label: 'Live', tone: 'live' });
    assert.deepEqual(tournamentRowFace(entry({ start: '2026-10-22', end: '2026-10-23' }), TODAY).chip, { label: 'Game day', tone: 'live' });
  });

  it('a finished accepted entry: no chip; the caption ends with the finish when there is one', () => {
    const done = { start: '2026-10-17', end: '2026-10-19', tStatus: 'completed' };
    const withFinish = tournamentRowFace(entry({ ...done, ourTeam: true, finish: { rank: 2, of: 4 } }), TODAY);
    assert.equal(withFinish.band, 'finished');
    assert.equal(withFinish.chip, null);
    assert.equal(withFinish.caption, `${OWN_CLUB_TOURNAMENT_HOST} · 2nd of 4`);
    // Absent otherwise — no placeholder, no dash.
    assert.equal(tournamentRowFace(entry({ ...done }), TODAY).caption, 'Guelph Minor Ball');
  });

  it('dates behind the coach move a row to Finished even before the organizer closes the event', () => {
    assert.equal(tournamentRowFace(entry({ start: '2026-10-10', end: '2026-10-12', tStatus: 'active' }), TODAY).band, 'finished');
  });

  it('a turned-away entry reads quiet in both bands', () => {
    assert.deepEqual(tournamentRowFace(entry({ status: 'rejected' }), TODAY).chip, { label: 'Not accepted', tone: 'mute' });
  });

  it('the record title chip and the row chip are one vocabulary', () => {
    assert.deepEqual(registrationChip('pending'), { label: WAITING_ON_ORGANIZER, tone: 'waiting' });
    assert.deepEqual(registrationChip('accepted'), { label: 'Accepted', tone: 'ok' });
  });
});

describe('bands', () => {
  it('Coming up soonest first, Finished most recent first', () => {
    const rows = [
      entry({ registration: { id: 'old', name: 'x', status: 'accepted' }, start: '2026-06-01', end: '2026-06-02', tStatus: 'completed' }),
      entry({ registration: { id: 'later', name: 'x', status: 'accepted' }, start: '2027-01-15', end: '2027-01-17' }),
      entry({ registration: { id: 'recent', name: 'x', status: 'accepted' }, start: '2026-10-17', end: '2026-10-19', tStatus: 'completed' }),
      entry({ registration: { id: 'soon', name: 'x', status: 'pending' }, start: '2026-11-06', end: '2026-11-08' }),
    ];
    const { coming, finished } = bandTournamentRows(rows, TODAY);
    assert.deepEqual(coming.map(r => r.registration.id), ['soon', 'later']);
    assert.deepEqual(finished.map(r => r.registration.id), ['recent', 'old']);
  });
});

describe('the finish', () => {
  const rows = [
    { teamId: 'a', poolId: 'p1', gp: 3 }, { teamId: 'b', poolId: 'p2', gp: 3 },
    { teamId: 'c', poolId: 'p1', gp: 3 }, { teamId: 'd', poolId: 'p2', gp: 3 },
  ];
  it('ranks within the pool when the division is pooled', () => {
    assert.deepEqual(finishFromStandings(rows, 'c'), { rank: 2, of: 2 });
  });
  it('nothing for a team with no standings game', () => {
    assert.equal(finishFromStandings([{ teamId: 'a', gp: 0 }], 'a'), null);
  });
  it('nothing while the team sits in a tie still waiting on a coin toss', () => {
    const rows = [{ teamId: 'a', gp: 3 }, { teamId: 'b', gp: 3, needsCoinToss: true }, { teamId: 'c', gp: 3, needsCoinToss: true }];
    assert.equal(finishFromStandings(rows, 'b'), null);
    assert.deepEqual(finishFromStandings(rows, 'a'), { rank: 1, of: 3 });
  });
});

describe('the game-changed notifications still land on the games', () => {
  it('the record keeps the #schedule anchor the bell and push links name', () => {
    const record = readFileSync('components/coaches/CoachTournamentRecord.tsx', 'utf8');
    assert.match(record, /<section id="schedule"/);
    for (const file of ['lib/schedule-change-notices.ts', 'app/api/admin/schedule-publish/route.ts']) {
      assert.match(readFileSync(file, 'utf8'), /#schedule/);
    }
  });
});

describe('the three lists render the one row', () => {
  const lists = [
    'app/[orgSlug]/coaches/teams/[teamId]/tournaments/page.tsx',
    'app/coaches/team/[basicTeamId]/tournaments/page.tsx',
    'app/coaches/tournaments/page.tsx',
  ];
  for (const file of lists) {
    it(file, () => {
      const src = readFileSync(file, 'utf8');
      assert.match(src, /<CoachTournamentRows/);
      assert.doesNotMatch(src, /CoachRegistrationCard/);
    });
  }
  it('the row component takes its words from tournamentRowFace alone', () => {
    const src = readFileSync('components/coaches/CoachTournamentRows.tsx', 'utf8');
    assert.match(src, /tournamentRowFace\(entry, today\)/);
    assert.match(src, /<CoachRow\b/);
  });
});

describe('the finish is not money, and the money stays redacted', () => {
  it('the history route still nulls amountDue for a money-off coach after the finish is attached', () => {
    const route = readFileSync('app/api/coaches/[orgSlug]/teams/[teamId]/tournament-history/route.ts', 'utf8');
    assert.ok(route.indexOf('attachTournamentFinishes') < route.indexOf('amountDue: null'));
    assert.match(route, /isMoneyRedactedForTeam\(assignments, teamId\)/);
  });
  it('the finish read carries no fee field', () => {
    const finish = readFileSync('lib/coach-tournament-finish.ts', 'utf8');
    assert.doesNotMatch(finish, /amount|fee_|total_paid|deposit/i);
  });
});

describe('the road back from a Schedule game (drawing 8)', () => {
  const games = [{ id: 'g1', registrationId: 'reg-1', tournamentName: 'UAT Rep Club Invitational 2026' }];
  it('opens the coach\'s own tournament page in the portal', () => {
    assert.deepEqual(tournamentRoadBack('g1', games, true, '/club/coaches/teams/t1'), {
      tournamentName: 'UAT Rep Club Invitational 2026',
      recordHref: '/club/coaches/teams/t1/tournaments/reg-1',
    });
  });
  it('no door for a coach without Tournaments — a note, never a dead row', () => {
    assert.equal(tournamentRoadBack('g1', games, false, '/b')?.recordHref, null);
  });
  it('absent for a game the team list does not read, or a non-mirror', () => {
    assert.equal(tournamentRoadBack('elsewhere', games, true, '/b'), null);
    assert.equal(tournamentRoadBack(null, games, true, '/b'), null);
  });
});
