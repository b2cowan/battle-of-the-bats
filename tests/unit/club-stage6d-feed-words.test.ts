import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { composeICSFromInstants, FEED_REFRESH_HOURS } from '../../lib/export/ics.ts';
import {
  arrivalNote,
  teamCalendarName,
  teamFeedEntries,
  unmirroredOrganizerGames,
  type FeedOrganizerGame,
  type FeedTeamEvent,
  type FeedTryoutDay,
} from '../../lib/export/team-feed-words.ts';
import { coachScheduleCalendarEntries, type CoachCalendarEvent } from '../../lib/export/schedule-calendar.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE WORDS EVERY TEAM CALENDAR WRITES — the feed recipe F1–F10 (Club Tier Stage 6d, ruled 2026-10-11; the table
 * standard's §11.4). One module (`lib/export/team-feed-words.ts`) writes every entry of the coach's feed, the public
 * team feed, the connected family's feed AND the coach's calendar download; this is its table test.
 *
 * ⚠ ZONE-FREE BY CONSTRUCTION, AND RUN THAT WAY (as the D-1 test is). Every assertion reads a UTC instant, a DATE value
 * or a club-zone string, and the golden file below must come out BYTE-IDENTICAL apart from DTSTAMP whatever zone the
 * runner sits in — the download's day shift (D-1) lived in the device's zone. Run it under two when it changes:
 *   TZ=America/Toronto   node --import ./tests/ts-resolver.mjs --test tests/unit/club-stage6d-feed-words.test.ts
 *   TZ=America/Vancouver node --import ./tests/ts-resolver.mjs --test tests/unit/club-stage6d-feed-words.test.ts
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const TEAM = '13U AAA';

function ev(over: Partial<FeedTeamEvent> = {}): FeedTeamEvent {
  return {
    id: 'ev', name: 'vs Oakridge Hawks', eventType: 'league_game', opponent: 'Oakridge Hawks', homeAway: 'home',
    // Thu Oct 15 2026, 6:30 p.m. in Toronto.
    startsAt: '2026-10-15T22:30:00.000Z', endsAt: null, arrivalTime: null,
    location: 'Kinsmen Park', locationAddress: '15 Main St', fieldNumber: '1', status: 'scheduled',
    uniform: null, description: null, sourceTournamentGameId: null,
    ...over,
  };
}

const SEASON: FeedTeamEvent[] = [
  ev({ id: 'practice', eventType: 'practice', name: 'Practice', opponent: null, homeAway: null,
    startsAt: '2026-10-13T22:00:00.000Z', fieldNumber: '2', arrivalTime: '17:30' }),
  ev({ id: 'home', arrivalTime: '5:45 PM' }),
  ev({ id: 'away', name: '@ Ridgeview Owls', opponent: 'Ridgeview Owls', homeAway: 'away',
    startsAt: '2026-10-24T14:00:00.000Z', location: 'Fairhaven Park', locationAddress: '44 Lakeview Ave',
    arrivalTime: '09:15', uniform: 'Grey road', description: 'Bring the pitch counter.' }),
  ev({ id: 'neutral', name: 'vs Lions', opponent: 'Lions', homeAway: 'neutral', startsAt: '2026-10-25T14:00:00.000Z' }),
  // Fri Oct 16, 7:00 p.m. in Toronto — cancelled.
  ev({ id: 'cancelled', name: '@ Ridgeview Owls', opponent: 'Ridgeview Owls', homeAway: 'away',
    startsAt: '2026-10-16T23:00:00.000Z', status: 'cancelled' }),
  ev({ id: 'named', eventType: 'team_event', name: 'Team photo day', opponent: null, homeAway: null,
    startsAt: '2026-11-01T21:00:00.000Z', fieldNumber: null }),
  // An outside tournament: Sat Oct 17 – Sun Oct 18 in Toronto (its end lands on the 19th in UTC).
  ev({ id: 'tourney', eventType: 'external_tournament', name: 'Burlington Fall Classic', opponent: null, homeAway: null,
    startsAt: '2026-10-17T12:00:00.000Z', endsAt: '2026-10-19T01:30:00.000Z', location: 'Burlington', locationAddress: null, fieldNumber: null }),
  // Mon Oct 19, 10:45 p.m. in Toronto — the universal date is already the 20th (D-1's case).
  ev({ id: 'evening', eventType: 'practice', name: 'Practice', opponent: null, homeAway: null,
    startsAt: '2026-10-20T02:45:00.000Z', endsAt: '2026-10-20T04:15:00.000Z' }),
];

function byUid(entries: ReturnType<typeof teamFeedEntries>) {
  return new Map(entries.map(e => [e.uid, e]));
}

async function compose(entries: Parameters<typeof composeICSFromInstants>[0], name = teamCalendarName(TEAM, 'UAT Rep Club')) {
  const ics = await composeICSFromInstants(entries, name);
  assert.ok(ics, 'the calendar composes');
  return ics.replace(/\r\n/g, '\n');
}

describe('F1 · the team leads the title', () => {
  const e = byUid(teamFeedEntries({ teamName: TEAM, sport: 'baseball', reader: 'family', events: SEASON }));
  it('practice', () => assert.equal(e.get('practice')?.title, '13U AAA · Practice'));
  it('home → vs', () => assert.equal(e.get('home')?.title, '13U AAA vs Oakridge Hawks'));
  it('away → @', () => assert.equal(e.get('away')?.title, '13U AAA @ Ridgeview Owls'));
  it('neutral → vs', () => assert.equal(e.get('neutral')?.title, '13U AAA vs Lions'));
  it('anything else by its name', () => assert.equal(e.get('named')?.title, '13U AAA · Team photo day'));
  it('an outside tournament by its name', () => assert.equal(e.get('tourney')?.title, '13U AAA · Burlington Fall Classic'));
});

describe('F2 · a cancelled event is kept and marked', () => {
  it('"Cancelled · " leads the title, STATUS:CANCELLED, free time', async () => {
    const ics = await compose(teamFeedEntries({ teamName: TEAM, sport: 'baseball', reader: 'family', events: SEASON }));
    const block = ics.split('BEGIN:VEVENT').find(b => b.includes('UID:cancelled@')) ?? '';
    assert.match(block, /^SUMMARY:Cancelled · 13U AAA @ Ridgeview Owls$/m);
    assert.match(block, /^STATUS:CANCELLED$/m);
    assert.match(block, /^TRANSP:TRANSPARENT$/m);
  });
  it('a scheduled one is confirmed and busy', async () => {
    const ics = await compose(teamFeedEntries({ teamName: TEAM, sport: 'baseball', reader: 'family', events: SEASON }));
    const block = ics.split('BEGIN:VEVENT').find(b => b.includes('UID:home@')) ?? '';
    assert.match(block, /^STATUS:CONFIRMED$/m);
    assert.doesNotMatch(block, /TRANSP/);
  });
});

describe('F4 · when', () => {
  it('no end entered: a game two hours, a practice an hour and a half', async () => {
    const ics = await compose(teamFeedEntries({ teamName: TEAM, sport: 'baseball', reader: 'family', events: SEASON }));
    const block = (uid: string) => ics.split('BEGIN:VEVENT').find(b => b.includes(`UID:${uid}@`)) ?? '';
    assert.match(block('home'), /^DURATION:PT2H$/m);
    assert.match(block('practice'), /^DURATION:PT1H30M$/m);
  });
  it('an outside tournament is ALL DAY across its club-local days (end exclusive)', async () => {
    const ics = await compose(teamFeedEntries({ teamName: TEAM, sport: 'baseball', reader: 'family', events: SEASON }));
    const block = ics.split('BEGIN:VEVENT').find(b => b.includes('UID:tourney@')) ?? '';
    assert.match(block, /^DTSTART;VALUE=DATE:20261017$/m);
    assert.match(block, /^DTEND;VALUE=DATE:20261019$/m, 'Sat and Sun — never the UTC 19th as a third day');
    assert.doesNotMatch(block, /DURATION/);
  });
  it('an evening event after 8 p.m. Eastern keeps its instant, so it lands on its own day (D-1)', async () => {
    const ics = await compose(teamFeedEntries({ teamName: TEAM, sport: 'baseball', reader: 'family', events: SEASON }));
    const block = ics.split('BEGIN:VEVENT').find(b => b.includes('UID:evening@')) ?? '';
    assert.match(block, /^DTSTART:20261020T024500Z$/m);
    assert.match(block, /^DTEND:20261020T041500Z$/m);
  });
});

describe('F5 · where', () => {
  it('"Venue · Facility, street address", the facility in the sport\'s word', () => {
    const e = byUid(teamFeedEntries({ teamName: TEAM, sport: 'baseball', reader: 'family', events: SEASON }));
    assert.equal(e.get('practice')?.location, 'Kinsmen Park · Diamond 2, 15 Main St');
    assert.equal(e.get('named')?.location, 'Kinsmen Park, 15 Main St', 'no facility, no dangling dot');
  });
});

describe('F6 · notes', () => {
  it('arrival in the house clock with the zone, from either stored form', () => {
    assert.equal(arrivalNote('17:30'), 'Arrive by 5:30 p.m. (Eastern time)');
    assert.equal(arrivalNote('5:45 PM'), 'Arrive by 5:45 p.m. (Eastern time)');
    assert.equal(arrivalNote('09:15'), 'Arrive by 9:15 a.m. (Eastern time)');
    assert.equal(arrivalNote('30 min before'), 'Arrive by 30 min before', 'a coach\'s own words keep no zone');
    assert.equal(arrivalNote(null), null);
  });
  it('a family\'s entry carries arrival only — never uniform or the coach\'s notes', () => {
    const e = byUid(teamFeedEntries({ teamName: TEAM, sport: 'baseball', reader: 'family', events: SEASON }));
    assert.equal(e.get('away')?.description, 'Arrive by 9:15 a.m. (Eastern time)');
  });
  it('a coach\'s entry keeps a game name the coach typed, never a bare matchup that contradicts the title', () => {
    const e = byUid(teamFeedEntries({ teamName: TEAM, sport: null, reader: 'coach', events: [
      ev({ id: 'old', name: 'vs Northgate', opponent: 'Northgate', homeAway: 'away' }),
      ev({ id: 'typed', name: 'Semi-final', opponent: 'Lions' }),
    ] }));
    assert.equal(e.get('old')?.title, '13U AAA @ Northgate');
    assert.equal(e.get('old')?.description, undefined, 'no "vs Northgate" under an "@" title');
    assert.equal(e.get('typed')?.description, 'Semi-final');
  });

  it('a coach\'s entry adds uniform and the event\'s notes', () => {
    const e = byUid(teamFeedEntries({ teamName: TEAM, sport: 'baseball', reader: 'coach', events: SEASON }));
    assert.equal(e.get('away')?.description, 'Arrive by 9:15 a.m. (Eastern time)\nUniform: Grey road\nBring the pitch counter.');
  });
});

describe('F7 · a link back', () => {
  it('each entry carries the caller\'s link; none without one', () => {
    const linked = teamFeedEntries({ teamName: TEAM, sport: null, reader: 'family', events: [ev()], linkFor: () => 'https://x/team' });
    assert.equal(linked[0].url, 'https://x/team');
    assert.equal(teamFeedEntries({ teamName: TEAM, sport: null, reader: 'family', events: [ev()] })[0].url, undefined);
  });
});

describe('F8 · the calendar is named, even when empty, with a four-hour hint', () => {
  it('an empty feed still names itself and carries the hint (a stopped link\'s answer)', async () => {
    const ics = await compose([]);
    assert.match(ics, /^X-WR-CALNAME:13U AAA · UAT Rep Club$/m);
    assert.match(ics, /^REFRESH-INTERVAL;VALUE=DURATION:PT4H$/m);
    assert.match(ics, /^X-PUBLISHED-TTL:PT4H$/m);
    assert.doesNotMatch(ics, /BEGIN:VEVENT/);
  });
  it('four hours, never one — the library\'s own one-hour line is replaced, not doubled', async () => {
    assert.equal(FEED_REFRESH_HOURS, 4);
    const ics = await compose(teamFeedEntries({ teamName: TEAM, sport: null, reader: 'family', events: [ev()] }));
    assert.doesNotMatch(ics, /PT1H\n/);
    assert.equal(ics.match(/X-PUBLISHED-TTL/g)?.length, 1);
  });
  it('the name is the team and the club', () => {
    assert.equal(teamCalendarName('13U AAA', 'UAT Rep Club'), '13U AAA · UAT Rep Club');
    assert.equal(teamCalendarName('13U AAA', null), '13U AAA');
  });
});

describe('F10 · each entry keeps the event\'s id as its identity', () => {
  it('the same UID on every read, so a calendar moves a block rather than adding a second', () => {
    const a = teamFeedEntries({ teamName: TEAM, sport: null, reader: 'family', events: [ev({ startsAt: '2026-10-15T22:30:00.000Z' })] });
    const b = teamFeedEntries({ teamName: TEAM, sport: null, reader: 'family', events: [ev({ startsAt: '2026-10-16T22:30:00.000Z' })] });
    assert.equal(a[0].uid, b[0].uid);
  });
});

describe('the coach\'s extras — tryout days and the organizer\'s games (Ask 2, S6D-05)', () => {
  const tryout: FeedTryoutDay = {
    id: 't1', startsAt: '2026-10-19T22:00:00.000Z', endsAt: '2026-10-20T00:00:00.000Z',
    location: 'Kinsmen Park', locationAddress: null, fieldNumber: '1', label: '2027 team', status: 'scheduled',
  };
  const game = (over: Partial<FeedOrganizerGame> = {}): FeedOrganizerGame => ({
    id: 'g1', startsAt: '2026-10-31T14:00:00.000Z', gameDate: '2026-10-31', timeLabel: '10:00 a.m.',
    opponentName: 'Milton Bats', homeAway: 'away', location: 'Milton Park', status: 'scheduled',
    tournamentName: 'UAT Fall Invitational', ...over,
  });

  it('a coach\'s feed: "13U AAA · Tryouts" and "13U AAA @ Milton Bats" with the tournament in the notes', () => {
    const e = byUid(teamFeedEntries({
      teamName: TEAM, sport: 'baseball', reader: 'coach', events: SEASON, tryoutDays: [tryout], organizerGames: [game()],
    }));
    assert.equal(e.get('tryout-t1')?.title, '13U AAA · Tryouts');
    assert.equal(e.get('game-g1')?.title, '13U AAA @ Milton Bats');
    assert.equal(e.get('game-g1')?.description, 'UAT Fall Invitational');
  });

  it('a family\'s feed never carries them, even if handed them', () => {
    const e = byUid(teamFeedEntries({
      teamName: TEAM, sport: 'baseball', reader: 'family', events: SEASON, tryoutDays: [tryout], organizerGames: [game()],
    }));
    assert.equal(e.has('tryout-t1'), false);
    assert.equal(e.has('game-g1'), false);
  });

  it('an organizer\'s game already on the list is not written twice (the overlay\'s own de-duplication)', () => {
    const copied = ev({ id: 'mirror', sourceTournamentGameId: 'g1' });
    assert.deepEqual(unmirroredOrganizerGames([copied], [game(), game({ id: 'g2' })]).map(g => g.id), ['g2']);
    const e = byUid(teamFeedEntries({ teamName: TEAM, sport: null, reader: 'coach', events: [copied], organizerGames: [game()] }));
    assert.equal(e.has('game-g1'), false);
  });

  it('an organizer\'s game with a date and no clock is that day, not midnight; with no date, or postponed, it is left out', () => {
    const e = byUid(teamFeedEntries({
      teamName: TEAM, sport: null, reader: 'coach', events: [],
      organizerGames: [
        game({ id: 'noclock', timeLabel: null, startsAt: '2026-11-01T04:00:00.000Z', gameDate: '2026-11-01' }),
        game({ id: 'nodate', startsAt: null, gameDate: null }),
        game({ id: 'postponed', status: 'postponed' }),
      ],
    }));
    assert.deepEqual(e.get('game-noclock')?.allDay, { start: '2026-11-01', end: '2026-11-01' });
    assert.equal(e.has('game-nodate'), false);
    assert.equal(e.has('game-postponed'), false);
  });

  it('the coach\'s DOWNLOAD carries them too, and D-1\'s evening case stays on its own day', async () => {
    const ics = await compose(coachScheduleCalendarEntries(SEASON.map(e => ({ ...e, isScrimmage: false })) as CoachCalendarEvent[], {
      teamName: TEAM, sport: 'baseball', tryoutDays: [tryout], organizerGames: [game()],
    }));
    assert.match(ics, /^SUMMARY:13U AAA · Tryouts$/m);
    assert.match(ics, /^SUMMARY:13U AAA @ Milton Bats$/m);
    assert.match(ics, /^DTSTART:20261020T024500Z$/m);
    assert.doesNotMatch(ics, /^DTSTART:20261021T024500Z$/m);
  });
});

/**
 * THE GOLDEN FILE — the whole family feed for the season above, byte for byte apart from DTSTAMP (the moment of
 * composing). It must come out identical in Toronto and in Vancouver: nothing in it may read the runner's zone.
 */
const GOLDEN = `BEGIN:VCALENDAR
VERSION:2.0
CALSCALE:GREGORIAN
PRODID:-//FieldLogicHQ//Schedule//EN
METHOD:PUBLISH
X-WR-CALNAME:13U AAA · UAT Rep Club
REFRESH-INTERVAL;VALUE=DURATION:PT4H
X-PUBLISHED-TTL:PT4H
BEGIN:VEVENT
UID:practice@fieldlogichq.ca
SUMMARY:13U AAA · Practice
DTSTAMP:—
DTSTART:20261013T220000Z
DESCRIPTION:Arrive by 5:30 p.m. (Eastern time)
LOCATION:Kinsmen Park · Diamond 2\\, 15 Main St
STATUS:CONFIRMED
DURATION:PT1H30M
END:VEVENT
BEGIN:VEVENT
UID:home@fieldlogichq.ca
SUMMARY:13U AAA vs Oakridge Hawks
DTSTAMP:—
DTSTART:20261015T223000Z
DESCRIPTION:Arrive by 5:45 p.m. (Eastern time)
LOCATION:Kinsmen Park · Diamond 1\\, 15 Main St
STATUS:CONFIRMED
DURATION:PT2H
END:VEVENT
BEGIN:VEVENT
UID:cancelled@fieldlogichq.ca
SUMMARY:Cancelled · 13U AAA @ Ridgeview Owls
DTSTAMP:—
DTSTART:20261016T230000Z
LOCATION:Kinsmen Park · Diamond 1\\, 15 Main St
STATUS:CANCELLED
TRANSP:TRANSPARENT
DURATION:PT2H
END:VEVENT
BEGIN:VEVENT
UID:tourney@fieldlogichq.ca
SUMMARY:13U AAA · Burlington Fall Classic
DTSTAMP:—
DTSTART;VALUE=DATE:20261017
DTEND;VALUE=DATE:20261019
LOCATION:Burlington
STATUS:CONFIRMED
END:VEVENT
BEGIN:VEVENT
UID:evening@fieldlogichq.ca
SUMMARY:13U AAA · Practice
DTSTAMP:—
DTSTART:20261020T024500Z
DTEND:20261020T041500Z
LOCATION:Kinsmen Park · Diamond 1\\, 15 Main St
STATUS:CONFIRMED
END:VEVENT
BEGIN:VEVENT
UID:away@fieldlogichq.ca
SUMMARY:13U AAA @ Ridgeview Owls
DTSTAMP:—
DTSTART:20261024T140000Z
DESCRIPTION:Arrive by 9:15 a.m. (Eastern time)
LOCATION:Fairhaven Park · Diamond 1\\, 44 Lakeview Ave
STATUS:CONFIRMED
DURATION:PT2H
END:VEVENT
BEGIN:VEVENT
UID:neutral@fieldlogichq.ca
SUMMARY:13U AAA vs Lions
DTSTAMP:—
DTSTART:20261025T140000Z
LOCATION:Kinsmen Park · Diamond 1\\, 15 Main St
STATUS:CONFIRMED
DURATION:PT2H
END:VEVENT
BEGIN:VEVENT
UID:named@fieldlogichq.ca
SUMMARY:13U AAA · Team photo day
DTSTAMP:—
DTSTART:20261101T210000Z
LOCATION:Kinsmen Park\\, 15 Main St
STATUS:CONFIRMED
DURATION:PT2H
END:VEVENT
END:VCALENDAR
`;

describe('the golden family feed — byte-identical in every zone, apart from DTSTAMP', () => {
  it(`matches (TZ=${process.env.TZ ?? 'unset'})`, async () => {
    const ics = await compose(teamFeedEntries({ teamName: TEAM, sport: 'baseball', reader: 'family', events: SEASON }));
    assert.equal(ics.replace(/^DTSTAMP:.*$/gm, 'DTSTAMP:—'), GOLDEN);
  });
});
