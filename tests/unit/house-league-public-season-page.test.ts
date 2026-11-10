import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { nextSeasonDoor, seasonDatesLine } from '../../lib/house-league-season.ts';
import { seasonPageShape } from '../../lib/league-registration-state.ts';
import { STANDINGS_WORDS } from '../../lib/league-standings.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * HOUSE LEAGUE §0k — THE SEASON'S PUBLIC PAGE ONCE REGISTRATION CLOSES (owner P1–P5, 2026-11-04; words
 * HOUSE_LEAGUE_PUBLIC_SEASON_PAGE_COPY.md, accepted W1–W7 2026-11-04). The page stopped describing a purchase from the
 * day registration closes: one dates line, each age group's top three, the next season's card on an old season's page.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const TODAY = '2026-11-04';
const PAGE = 'app/[orgSlug]/league/[seasonSlug]/page.tsx';

describe('1 · which shape the page takes (P1)', () => {
  const reg = (status: string, open: string | null = null, close: string | null = null) =>
    ({ status, registrationOpenAt: open, registrationCloseAt: close });
  const NOW = '2026-11-04T12:00';
  it('the sign-up shape while it opens soon or takes sign-ups', () => {
    assert.equal(seasonPageShape(reg('registration_open'), NOW), 'signup');
    assert.equal(seasonPageShape(reg('registration_open', '2026-10-01', '2026-12-01'), NOW), 'signup');
    assert.equal(seasonPageShape(reg('registration_open', '2026-12-01', '2027-01-01'), NOW), 'signup', 'opens ahead');
  });
  it('the season shape from the day registration closes — by the club or by its date — through finished', () => {
    assert.equal(seasonPageShape(reg('registration_open', '2026-09-01', '2026-11-03'), NOW), 'season', 'close date passed');
    assert.equal(seasonPageShape(reg('registration_closed'), NOW), 'season');
    for (const s of ['active', 'completed', 'archived']) assert.equal(seasonPageShape(reg(s), NOW), 'season', s);
  });
});

describe('2 · the line under the title (copy §1, W1, W2)', () => {
  const line = (status: string, start: string | null, end: string | null) =>
    seasonDatesLine({ status, seasonStartDate: start, seasonEndDate: end }, TODAY);
  it('a finished season: concluded, then the dates it ran', () => {
    assert.equal(line('completed', '2026-05-02', '2026-10-25'), 'This season has concluded. It ran May 2 to October 25, 2026.');
    assert.equal(line('archived', '2025-05-02', '2025-10-25'), 'This season has concluded. It ran May 2 to October 25, 2025.');
    assert.equal(line('completed', '2026-05-02', '2026-05-02'), 'This season has concluded. It ran May 2, 2026.');
    assert.equal(line('completed', '2026-05-02', null), 'This season has concluded. It started May 2, 2026.');
    assert.equal(line('completed', null, '2026-10-25'), 'This season has concluded. It ended October 25, 2026.');
    assert.equal(line('completed', null, null), 'This season has concluded.');
    // Finished always reads "It ran", even with dates still ahead of today.
    assert.equal(line('completed', '2027-05-02', '2027-10-25'), 'This season has concluded. It ran May 2 to October 25, 2027.');
  });
  it('Runs / Ran by the end day against today, not the status; the end day itself still runs', () => {
    assert.equal(line('registration_closed', '2027-05-02', '2027-10-25'), 'Runs May 2 to October 25, 2027.');
    assert.equal(line('active', '2026-05-02', '2026-11-04'), 'Runs May 2 to November 4, 2026.');
    assert.equal(line('active', '2026-05-02', '2026-10-25'), 'Ran May 2 to October 25, 2026.');
    assert.equal(line('registration_closed', '2026-05-02', '2026-10-25'), 'Ran May 2 to October 25, 2026.', 'stuck on closed');
  });
  it('the year once when both days share it; each day keeps its own across a new year', () => {
    assert.equal(line('active', '2026-10-25', '2027-03-14'), 'Runs October 25, 2026 to March 14, 2027.');
    assert.equal(line('active', '2025-10-25', '2026-03-14'), 'Ran October 25, 2025 to March 14, 2026.');
  });
  it('a one-day season reads once', () => {
    assert.equal(line('registration_closed', '2027-05-02', '2027-05-02'), 'Runs May 2, 2027.');
    assert.equal(line('active', '2026-05-02', '2026-05-02'), 'Ran May 2, 2026.');
  });
  it('one day missing (W2); neither day: no line', () => {
    assert.equal(line('registration_closed', '2027-05-02', null), 'Starts May 2, 2027.');
    assert.equal(line('active', '2026-05-02', null), 'Started May 2, 2026.');
    assert.equal(line('active', '2026-11-04', null), 'Started November 4, 2026.', 'the first day itself has started');
    assert.equal(line('active', null, '2026-12-20'), 'Runs until December 20, 2026.');
    assert.equal(line('active', null, '2026-10-25'), null, 'the chip already says Ended Oct 25');
    assert.equal(line('active', null, null), null);
    assert.equal(line('registration_closed', null, null), null);
  });
  it('a stored timestamp reads as its day; a season whose close date passed reads like any closed one', () => {
    assert.equal(line('active', '2026-05-02T00:00:00+00:00', '2026-10-25T00:00:00+00:00'), 'Ran May 2 to October 25, 2026.');
    assert.equal(line('registration_open', '2027-05-02', '2027-10-25'), 'Runs May 2 to October 25, 2027.');
  });
});

describe('3 · the next-season card (P3; copy §4, W6)', () => {
  type S = { id: string; name: string; slug: string; status: string; seasonStartDate: string | null;
    seasonEndDate: string | null; registrationOpenAt: string | null; registrationCloseAt: string | null; createdAt: string };
  const s = (id: string, status: string, start: string | null, extra: Partial<S> = {}): S => ({
    id, name: id, slug: id.toLowerCase().replace(/\s+/g, '-'), status, seasonStartDate: start, seasonEndDate: null,
    registrationOpenAt: null, registrationCloseAt: null, createdAt: '2026-01-01T00:00:00Z', ...extra,
  });
  const ended = s('Summer 2026', 'active', '2026-05-02', { seasonEndDate: '2026-10-25' });
  const finished = s('Summer 2026', 'completed', '2026-05-02', { seasonEndDate: '2026-10-25' });
  const playing = s('Summer 2026', 'active', '2026-05-02', { seasonEndDate: '2026-12-20' });
  const fall = s('Fall 2026', 'registration_open', '2026-12-01', { registrationCloseAt: '2027-01-09' });
  const winter = s('Winter Skills 2027', 'registration_open', '2027-01-15');
  const spring = s('Spring Skills 2027', 'registration_open', '2027-03-15');
  const summer = s('Summer 2027', 'registration_open', '2027-05-01');
  const fall27 = s('Fall 2027', 'registration_open', '2027-09-01');

  it('only on an old season’s page: ended or finished, never one being played', () => {
    assert.equal(nextSeasonDoor(playing, [playing, fall], TODAY), null);
    assert.equal(nextSeasonDoor(ended, [ended, fall], TODAY)?.kind, 'one');
    assert.equal(nextSeasonDoor(finished, [finished, fall], TODAY)?.kind, 'one');
    // Past its last day whatever its status: a club that never moved it on from "Registration closed" (/review 2026-11-04).
    const stuck = s('Summer 2026', 'registration_closed', '2026-05-02', { seasonEndDate: '2026-10-25' });
    assert.equal(nextSeasonDoor(stuck, [stuck, fall], TODAY)?.kind, 'one');
    const closedAhead = s('Summer 2026', 'registration_closed', '2026-05-02', { seasonEndDate: '2026-12-20' });
    assert.equal(nextSeasonDoor(closedAhead, [closedAhead, fall], TODAY), null);
  });
  it('one season: its name, its registration line, its page', () => {
    const door = nextSeasonDoor(finished, [finished, fall], TODAY);
    assert.ok(door && door.kind === 'one');
    assert.equal(door.head, 'Fall 2026 · Registration open');
    assert.match(door.line ?? '', /^Registration closes Jan 9/);
    assert.equal(door.button, 'See Fall 2026 →');
    assert.equal(door.season.slug, 'fall-2026');
    // No close day: no line (W3).
    const open = nextSeasonDoor(finished, [finished, winter], TODAY);
    assert.ok(open && open.kind === 'one');
    assert.equal(open.line, null);
  });
  it('counts only newer seasons taking sign-ups today: not a draft, not one opening later, not an older one', () => {
    const later = s('Later 2027', 'registration_open', '2027-06-01', { registrationOpenAt: '2027-02-01' });
    const draft = s('Draft 2027', 'draft', '2027-07-01');
    const closed = s('Closed 2027', 'registration_closed', '2027-08-01');
    const older = s('Spring 2026', 'registration_open', '2026-03-01');
    assert.equal(nextSeasonDoor(finished, [finished, later, draft, closed, older], TODAY), null);
  });
  it('two or more: named newest first, linked to the House league page; past three, "· {n} more"', () => {
    const two = nextSeasonDoor(finished, [finished, fall, winter], TODAY);
    assert.deepEqual(two, { kind: 'many', head: 'Taking sign-ups now', line: 'Winter Skills 2027 · Fall 2026', button: 'See the house league →' });
    const five = nextSeasonDoor(finished, [fall, winter, spring, summer, fall27, finished], TODAY);
    assert.equal(five?.line, 'Fall 2027 · Summer 2027 · Spring Skills 2027 · 2 more');
  });
});

describe('4 · the words the cards use (copy §2, §5)', () => {
  it('the foot counts the rows not shown', () => {
    assert.equal(STANDINGS_WORDS.card.more(1), '1 more team');
    assert.equal(STANDINGS_WORDS.card.more(3), '3 more teams');
  });
  it('Full table, with the age group for a screen reader', () => {
    assert.equal(STANDINGS_WORDS.card.link, 'Full table');
    assert.equal(STANDINGS_WORDS.card.linkFor('U11'), 'for U11');
  });
});

describe('5 · the page draws the two shapes', () => {
  const page = readCode(PAGE);
  const seasonAt = page.indexOf("seasonPageShape(season) === 'season'");
  it('the season shape returns before anything of the sign-up shape: no price, no spots, no grey box, no Register', () => {
    assert.ok(seasonAt > 0);
    const seasonShape = page.slice(seasonAt, page.indexOf('const divisions: DivisionWithCount[]'));
    assert.doesNotMatch(seasonShape, /spots filled|priceRange|Register now|regLine|Season dates|formatDate|offer|earlyRange|leaguePrice|activeCount/);
    const signupShape = page.slice(page.indexOf('const divisions: DivisionWithCount[]'));
    for (const kept of [/spots filled/, /Register now/, /\{rangeLine\(offer && earlyRange \? earlyRange : priceRange\)\}/, /\{signedUp\}/]) {
      assert.match(signupShape, kept);
    }
  });
  it('the top three: listed = standings on and published; band from standingsTitle; first three rows; the empty card', () => {
    assert.match(page, /rawDivisions\.filter\(d => d\.showStandings && d\.schedulePublishedAt\)/);
    assert.match(page, /Promise\.all\(listed\.map\(d => computeStandings\(d\.id, season\.sport\)\)\)/);
    assert.match(page, /\{anyScored && \(/);
    assert.match(page, /\{standingsTitle\(season\.status\)\}/);
    assert.match(page, /t\.rows\.slice\(0, 3\)/);
    assert.match(page, /aria-labelledby=\{headId\}/);
    assert.match(page, /<p className=\{kit\.cardText\}>\{W\.coach\.none\}<\/p>/);
    assert.match(page, /className=\{kit\.srOnly\}> \{W\.card\.linkFor\(d\.name\)\}<\/span> <span aria-hidden>→<\/span>/);
    // DC-02: first place by weight alone, no row tint.
    assert.match(page, /place === 1 \? ` \$\{column\.standLead\}`/);
  });
  it('Schedule leads when there is no table; the next-season card is an aside above the title', () => {
    assert.match(page, /anyScored \? kit\.btnSecondary : kit\.btnPrimary/);
    assert.match(page, /<aside className=\{`\$\{kit\.door\} \$\{column\.nextDoor\}`\} aria-label=\{NEXT_SEASON_WORDS\.region\}>/);
    assert.ok(page.indexOf('<aside', seasonAt) < page.indexOf('<h1', seasonAt), 'the card sits above the h1');
  });
  it('"Already signed up? Email me my link" in both shapes (P4)', () => {
    assert.equal(page.match(/\{signedUp\}/g)?.length, 2);
  });
  it('the sign-up shape carries the play links: Schedule once published, Standings with the first score, quiet buttons above the age groups', () => {
    const signupShape = page.slice(page.indexOf('const divisions: DivisionWithCount[]'));
    // The same two tests the season shape uses, so the two pages never disagree about when a table exists.
    assert.match(signupShape, /const hasSchedule = rawDivisions\.some\(d => d\.schedulePublishedAt\)/);
    assert.match(signupShape, /rawDivisions\.filter\(d => d\.showStandings && d\.schedulePublishedAt\)/);
    assert.match(signupShape, /playTables\.some\(t => t\.scored\)/);
    assert.match(signupShape, /\{hasSchedule && \(/);
    assert.match(signupShape, /\{hasStandings && \(/);
    assert.match(signupShape, /\{W\.title\}/);
    // Above the age groups, both secondary: Register now stays the one filled button.
    assert.ok(signupShape.indexOf('{hasSchedule && (') < signupShape.indexOf('id="season-divisions"'), 'the row sits above Divisions');
    assert.doesNotMatch(signupShape.slice(signupShape.indexOf('{hasSchedule && (') , signupShape.indexOf('id="season-divisions"')), /btnPrimary/);
    // The old bottom Schedule button (before registration opens) is gone: the row is the one place.
    assert.equal(signupShape.match(/\/schedule`\)/g)?.length, 1);
  });
  it('no champion, no winner, no "Top three" on the page (copy §6)', () => {
    assert.doesNotMatch(page, /[Cc]hampion|[Ww]inner|Top 3|Top three|Leaderboard|signups/);
  });
});
