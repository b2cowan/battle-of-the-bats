import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CLOSE_WORDS as W, canClosePlace, closeSummary, defaultTicks, linkTargets, placesWord, previewSentences, seesEveryProgram,
  type CloseLeagueGame, type CloseRepGame, type CloseSource,
} from '../../lib/place-closure-window.ts';
import { stripSentence, type ClosedPlace } from '../../lib/place-closures.ts';
import { COACH_MAIL, renderCoachClosureEmail } from '../../lib/place-closure-mail-words.ts';
import { formatShortWeekdayDate } from '../../lib/timezone.ts';

/**
 * Club Website Stage 2, Session 2B: Close a place's window plan and words (the drawing's tabs 2, 3 and 7; plan §10), and
 * the rep coach's email in /legal's fixed words. Kestrel Bay, Sat, Nov 28, 2026 (Toronto: 12:30 p.m. = 17:30Z).
 */
const lions: ClosedPlace = { scope: 'place', venueId: 'lions', facilityId: null, name: 'Lions Park' };
const d2: ClosedPlace = { scope: 'diamond', venueId: 'lions', facilityId: 'd2', name: 'Lions Park', facilityName: 'Diamond 2' };
const harbour: ClosedPlace = { scope: 'place', venueId: 'harbour', facilityId: null, name: 'Harbourview Park' };
const every: ClosedPlace = { scope: 'all', venueId: null, facilityId: null, name: null };
const DAY = '2026-11-28';

const lg = (id: string, o: Partial<CloseLeagueGame> = {}): CloseLeagueGame => ({
  id, seasonId: 's1', divisionId: 'u11', published: true, homeTeamId: `${id}h`, awayTeamId: `${id}a`, home: 'Foxes', away: 'Ospreys',
  scheduledAt: '2026-11-28T14:00:00Z', field: 'Diamond 1', venueId: 'lions', typed: null, linkedToPlace: true, place: 0, match: 'linked', started: false,
  seen: '2026-11-20T00:00:00Z', ...o,
});
const rp = (id: string, o: Partial<CloseRepGame> = {}): CloseRepGame => ({
  id, teamId: 'ospreys', teamName: 'U13 Ospreys', opponent: 'Marlow Heights', startsAt: '2026-11-28T17:30:00Z', field: 'Diamond 1', venueId: 'lions',
  typed: null, linkedToPlace: true, place: 0, match: 'linked', started: false, seen: '2026-11-20T00:00:00Z', ...o,
});
const source = (o: Partial<CloseSource> = {}): CloseSource => ({
  today: DAY, places: [lions], seasons: [{ id: 's1', name: '2026 House League', divisions: [{ id: 'u11', name: 'U11', published: true }, { id: 'u15', name: 'U15', published: true }] }],
  league: [], rep: [], repHidden: false, tournaments: [], practices: 0, families: [], repReach: {}, ...o,
});

describe('K1 · who closes a place', () => {
  it('the Rainout\'s people: owner, admin, house league admin — and every place at once only for an owner or an admin', () => {
    for (const r of ['owner', 'admin', 'league_admin'] as const) assert.equal(canClosePlace(r), true, r);
    for (const r of ['staff', 'coach', 'treasurer', 'league_registrar', 'official'] as const) assert.equal(canClosePlace(r), false, r);
    assert.equal(seesEveryProgram('league_admin'), false);
    assert.equal(seesEveryProgram('admin'), true);
  });
});

describe('what is ticked when the window opens (K6, K7)', () => {
  it('a game on the place, still to start, in a published division; never a typed, started or draft one', () => {
    const src = source({
      league: [lg('on'), lg('typed', { match: 'maybe', linkedToPlace: false, typed: 'lions park d1' }), lg('started', { started: true }), lg('draft', { published: false })],
      rep: [rp('rep'), rp('rep-typed', { match: 'maybe', linkedToPlace: false, typed: 'Lions Pk' }), rp('rep-started', { started: true })],
    });
    assert.deepEqual([...defaultTicks(src)].sort(), ['on', 'rep']);
  });
});

describe('the counts are the send\'s own: one email per family per division, the rep coach per team', () => {
  it('two divisions are two sends; a family in both is emailed twice; the rep team counts once', () => {
    const a = lg('a', { divisionId: 'u11', homeTeamId: 't1', awayTeamId: 't2' });
    const b = lg('b', { divisionId: 'u15', homeTeamId: 't3', awayTeamId: 't4' });
    const src = source({
      league: [a, b], rep: [rp('r1'), rp('r2', { startsAt: '2026-11-28T19:00:00Z' })],
      families: [['t1'], ['t2', 't3'], ['t4'], ['elsewhere']], repReach: { ospreys: 'head' },
    });
    const s = closeSummary(src, new Set(['a', 'b', 'r1', 'r2']));
    assert.equal(s.games, 4);
    assert.equal(s.divisions, 2);
    assert.equal(s.families, 3);
    assert.equal(s.emails, 4);
    assert.equal(s.multi, 1);
    assert.deepEqual(s.repTeams, [{ teamId: 'ospreys', name: 'U13 Ospreys', reach: 'head' }]);
  });
  it('a draft division\'s game is never counted, even when ticked', () => {
    const src = source({ league: [lg('d', { published: false })], families: [['dh']] });
    assert.equal(closeSummary(src, new Set(['d'])).games, 0);
  });
});

describe('"Link both" (K7)', () => {
  const typedA = lg('ta', { match: 'maybe', linkedToPlace: false, typed: 'Lions Park — Diamond 2' });
  const typedB = lg('tb', { match: 'maybe', linkedToPlace: false, typed: 'lions park d1' });
  const onPlaceNoDiamond = lg('pd', { match: 'maybe', linkedToPlace: true, typed: null });
  it('links every typed game listed when none is ticked, only the ticked ones when some are, never one already on a place', () => {
    const src = source({ league: [typedA, typedB, onPlaceNoDiamond] });
    assert.deepEqual(linkTargets(src, new Set()).map(l => l.id), ['ta', 'tb']);
    assert.deepEqual(linkTargets(src, new Set(['tb'])), [{ kind: 'league', id: 'tb', venueId: 'lions' }]);
  });
  it('a house league admin never links a rep game (they never see the typed rep games, K1)', () => {
    const src = source({ repHidden: true, rep: [rp('r', { match: 'maybe', linkedToPlace: false, typed: 'Lions Park' })] });
    assert.deepEqual(linkTargets(src, new Set()), []);
  });
  it('the link\'s words', () => {
    assert.equal(W.linkLabel(2, false, [lions]), 'Link both to Lions Park');
    assert.equal(W.linkLabel(5, true, [lions]), 'Link all 5 ticked to Lions Park');
    assert.equal(W.linkHelp, 'So they match next time. Families aren’t told: the game is where it was.');
  });
});

describe('the drawing\'s words (tab 2)', () => {
  const src = source({
    league: [lg('a', { divisionId: 'u11', homeTeamId: 't1', awayTeamId: 't2' }), lg('b', { divisionId: 'u15', homeTeamId: 't3', awayTeamId: 't4' })],
    rep: [rp('r')], families: Array.from({ length: 58 }, (_, i) => [['t1', 't2', 't3', 't4'][i % 4]]), repReach: { ospreys: 'head' },
  });
  it('the phone\'s summary and button', () => {
    const s = closeSummary(src, new Set(['a', 'b', 'r']));
    assert.equal(W.sumPhone({ ...s, games: 5 }), '5 games. 58 families emailed in 2 sends, and 1 rep coach.');
    assert.equal(W.go([lions], 58, true), 'Close Lions Park, email 58');
    assert.equal(W.go([lions], 58, false), 'Close Lions Park and email 58 families');
    assert.equal(W.go([{ ...lions, name: 'Pinecrest Park' }], 0, true), 'Close Pinecrest Park');
    assert.equal(W.go([d2], 27, true), 'Close Diamond 2, email 27');
    assert.equal(W.go([lions, harbour], 112, true), 'Close both, email 112');
    assert.equal(W.sumCap, 'Doesn’t count toward today’s 3.');
  });
  it('the groups, the empty states and the foot', () => {
    assert.equal(W.whatsAt([lions]), 'What’s at Lions Park that day');
    assert.equal(W.leagueCount('2026 House League', 4, 8), '2026 House League · 4 games · 8 teams');
    assert.equal(W.repCount(1), 'marked for the coach · 1 game');
    assert.equal(W.repNote('head'), 'Marked, not moved. Its head coach is emailed and sets the new date.');
    assert.match(W.repNote('others'), /Its coaches are emailed/);
    assert.match(W.repNote('none'), /no coach to email/);
    assert.equal(W.typedCount([lions], 2), 'may be Lions Park · 2 games');
    assert.equal(W.typedLine('Lions Park — Diamond 2'), 'Typed: “Lions Park — Diamond 2”');
    assert.equal(W.started, 'Started');
    assert.equal(W.tournamentAt(4, [lions], true), '4 games on Lions Park’s diamonds today');
    assert.equal(W.tournamentUnlinked(true), 'Plays today. Its diamonds aren’t linked to your places, so its games aren’t counted here.');
    assert.equal(W.empty([{ ...lions, name: 'Pinecrest Park' }], DAY), 'Nothing is scheduled at Pinecrest Park on Sat, Nov 28. Closing it still tells families on your site.');
    assert.equal(W.noPlacesTitle, 'Your club has no places yet.');
    assert.equal(W.footPhone, 'Nothing changes until you press.');
    assert.equal(W.notNow, 'Not now');
    assert.equal(W.bandSeason(true), 'This season’s places today');
  });
  it('the site\'s preview carries the strip\'s fixed sentence (K16) and never the admin\'s line', () => {
    const w = W.site(previewSentences([lions], DAY, DAY, DAY), DAY);
    assert.equal(`${w.lead}${w.said}${w.rest}`, 'Your site says “Lions Park is closed today.” at once, until the end of Sat, Nov 28.');
    assert.equal(W.lineHint.includes('It isn’t shown on your site.'), true);
  });
});

describe('the strip\'s sentence (K3, K16; 2C puts it on the site)', () => {
  const say = formatShortWeekdayDate;
  const c = (p: ClosedPlace, first: string, last = first) => ({ scope: p.scope, placeName: p.name, facilityName: p.facilityName ?? null, firstDay: first, lastDay: last });
  it('today, tomorrow, through a later day, one diamond, every field', () => {
    assert.equal(stripSentence(c(lions, DAY), DAY, say), 'Lions Park is closed today.');
    assert.equal(stripSentence(c(lions, DAY), '2026-11-27', say), 'Lions Park is closed tomorrow (Sat, Nov 28).');
    assert.equal(stripSentence(c(lions, DAY, '2026-11-29'), DAY, say), 'Lions Park is closed through Sun, Nov 29.');
    assert.equal(stripSentence(c(d2, DAY), DAY, say), 'Diamond 2 at Lions Park is closed today.');
    assert.equal(stripSentence(c(every, DAY), DAY, say), 'All our fields are closed today.');
  });
  it('carries no count, division or person — place words and days only', () => {
    const s = stripSentence(c(lions, DAY, '2026-11-29'), '2026-11-27', say);
    assert.doesNotMatch(s, /\d+ (games?|teams?|families)|U\d+|Division/);
  });
});

describe('the result and Reopen (tab 3)', () => {
  it('the drawn sentences', () => {
    assert.equal(W.doneTitle([lions]), 'Lions Park closed');
    assert.equal(W.doneLeague(4, 'postponed', 58, [{ name: 'U11', emails: 31 }, { name: 'U15', emails: 27 }], 8),
      '4 house league games postponed. 58 emails sent (U11 31, U15 27). The 8 teams’ coaches have a copy.');
    assert.equal(W.doneRep(1, [{ name: 'U13 Ospreys', reach: 'head', sent: true }]), '1 rep game marked. The U13 Ospreys’ head coach was emailed.');
    assert.equal(W.doneRep(1, [{ name: 'U13 Ospreys', reach: 'none', sent: false }]),
      '1 rep game marked. The U13 Ospreys have no coach to email, so let the team know yourself.');
    assert.equal(W.doneTyped(2), '2 games with a typed place weren’t changed.');
    assert.equal(W.seeTyped(2), 'See the 2 games');
    assert.equal(W.doneTournament('Kestrel Bay Winter Classic', 4, [lions]), 'Kestrel Bay Winter Classic: its 4 games at Lions Park aren’t moved yet.');
    assert.equal(W.reopenTitle('Lions Park'), 'Reopen Lions Park?');
    assert.equal(W.reopenGo(1), 'Reopen and email 1 coach');
    assert.equal(W.reopenKeep, 'Keep it closed');
    assert.equal(W.reopened('Lions Park'), 'Lions Park reopened');
    assert.equal(W.reopenedStill(4), '4 games still need new dates.');
    assert.equal(W.rainDelayLine('Kestrel Bay', 'Lions Park', DAY, DAY), 'Kestrel Bay closed Lions Park today. Its diamonds are picked below.');
  });
  it('the place\'s words', () => {
    assert.equal(placesWord([d2]), 'Diamond 2 at Lions Park');
    assert.equal(placesWord([every]), 'all our fields');
    assert.equal(placesWord([lions, harbour]), 'Lions Park and Harbourview Park');
  });
});

describe('K10 · the rep coach\'s email, in /legal\'s fixed words (tab 7)', () => {
  const game = { startsAt: '2026-11-28T17:30:00Z', opponent: 'Marlow Heights', closure: { scope: 'place' as const, placeName: 'Lions Park', facilityName: null, firstDay: DAY, lastDay: DAY } };
  const club = 'Kestrel Bay Softball Association';
  const mail = renderCoachClosureEmail({
    kind: 'closed', club, sender: { name: 'Dana Reyes', role: 'admin' }, recipient: { firstName: 'Sam', head: true },
    team: 'U13 Ospreys', games: [game],
  });
  it('the drawn subject and body', () => {
    assert.equal(mail.subject, 'Lions Park is closed: U13 Ospreys game needs a new date');
    assert.equal(COACH_MAIL.body(club, [game]),
      'Kestrel Bay Softball Association closed Lions Park on Sat, Nov 28. Your game there that day, against Marlow Heights at 12:30 p.m., '
      + 'needs a new date. It is marked on your team’s schedule and nothing was moved. Give it a new date, or cancel it.');
  });
  it('From "{Club} via FieldLogicHQ"; who sent it, why, the reply line, the removal line, the foot', () => {
    assert.equal(mail.fromName, 'Kestrel Bay Softball Association via FieldLogicHQ');
    assert.match(mail.text, /Dana Reyes \(Admin, Kestrel Bay Softball Association\) sent this\. Reply to this email to reach Dana Reyes\./);
    assert.match(mail.text, /You get it because you’re head coach of U13 Ospreys\./);
    assert.match(mail.text, /Not right for you\? Reply and tell Dana Reyes\./);
    assert.match(mail.text, /Sent through FieldLogicHQ, the software Kestrel Bay Softball Association uses\./);
  });
  it('carries no link, no button, no unsubscribe and no free text (a service message: /legal)', () => {
    assert.doesNotMatch(mail.html, /<a\b|href=|unsubscribe/i);
    assert.doesNotMatch(mail.text, /https?:\/\/|unsubscribe/i);
  });
  it('no head coach on file: the other coaches, with their own reason', () => {
    const other = renderCoachClosureEmail({ kind: 'closed', club, sender: { name: 'Dana Reyes', role: 'admin' }, recipient: { firstName: null, head: false }, team: 'U13 Ospreys', games: [game] });
    assert.match(other.text, /^Hi,/);
    assert.match(other.text, /You get it because you coach U13 Ospreys and it has no head coach on file\./);
  });
  it('an admin with no name on file: the reply line names their role, never the club (the reply reaches them)', () => {
    const m = renderCoachClosureEmail({ kind: 'closed', club, sender: { name: null, role: 'admin' }, recipient: { firstName: 'Sam', head: true }, team: 'U13 Ospreys', games: [game] });
    assert.match(m.text, /Kestrel Bay Softball Association sent this\. Reply to this email to reach the admin at Kestrel Bay Softball Association who sent it\./);
    assert.match(m.text, /Not right for you\? Reply and tell them\./);
    assert.doesNotMatch(m.text, /reach Kestrel Bay Softball Association\./);
  });
  it('two games for one team are one email listing both', () => {
    const second = { ...game, startsAt: '2026-11-28T19:00:00Z', opponent: 'Whitecliff' };
    assert.equal(COACH_MAIL.subject('U13 Ospreys', [game, second]), 'Lions Park is closed: U13 Ospreys games need new dates');
    assert.match(COACH_MAIL.body(club, [game, second]), /Your 2 games there need new dates: against Marlow Heights at 12:30 p\.m\. and against Whitecliff at 2:00 p\.m\./);
  });
  it('K11 · Reopen\'s one line, in the same email', () => {
    const r = renderCoachClosureEmail({ kind: 'reopened', club, sender: { name: 'Dana Reyes', role: 'admin' }, recipient: { firstName: 'Sam', head: true }, team: 'U13 Ospreys', games: [game] });
    assert.match(r.text, /Kestrel Bay Softball Association reopened Lions Park\. Your game on Sat, Nov 28 at 12:30 p\.m\. wasn’t moved\. Keep it or move it\./);
    assert.match(r.text, /Reply to this email to reach Dana Reyes\./);
    assert.doesNotMatch(r.html, /<a\b|href=/i);
  });
});
