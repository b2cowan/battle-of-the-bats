/**
 * Club Website Stage 2, Session 2C — what families and coaches see of a closed place (drawing tabs 4–6, asks K3, K4, K9,
 * K12, K16, K17; https://claude.ai/artifact/N332KzJg8NgFJb4oZvJhwM). The pure half: the strip's box in every drawn state,
 * the mark's fixed words, and the home's band. The screen half (every surface shows the mark; the strip carries place
 * words only and never reaches a tournament page) is pinned at the bottom against the source.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { closureStrip, CLOSURE_STRIP_MAX_LINES, noticeSmallLine } from '../../lib/club-notice.ts';
import { MARK_WORDS, markPlaceWords, type StripClosure } from '../../lib/place-closures.ts';
import { homeGamesView } from '../../lib/club-games-home.ts';
import type { ClubGameRow } from '../../lib/club-games-read';

const ROOT = join(import.meta.dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

// Eastern is UTC−5 in November. Sat, Nov 28 is the drawing's day.
const at = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00-05:00`).toISOString();
const midnightAfter = (day: string) => at(new Date(Date.parse(`${day}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10), '00:00');
const closure = (o: Partial<StripClosure> = {}): StripClosure => ({
  scope: 'place', placeName: 'Lions Park', facilityName: null, firstDay: '2026-11-28', lastDay: '2026-11-28',
  showsFrom: at('2026-11-28', '07:10'), endsAt: midnightAfter('2026-11-28'), ...o,
});

describe('K3 · K4 · K16 · the strip: a line per closed place, then the notice\'s own small line', () => {
  it('the morning of: "Lions Park is closed today." · "Posted 7:10 a.m. by the club · ends tonight"', () => {
    assert.deepEqual(closureStrip([closure()], at('2026-11-28', '07:20')), {
      lines: [{ sentence: 'Lions Park is closed today.', endsAt: midnightAfter('2026-11-28') }],
      smallLine: 'Posted 7:10 a.m. by the club · ends tonight',
    });
  });

  it('the evening before: "closed tomorrow (Sat, Nov 28)", posted at 8:40 p.m., and no "ends" (the sentence says the day)', () => {
    const c = closure({ showsFrom: at('2026-11-27', '20:40') });
    const strip = closureStrip([c], at('2026-11-27', '20:45'))!;
    assert.deepEqual(strip.lines.map(l => l.sentence), ['Lions Park is closed tomorrow (Sat, Nov 28).']);
    assert.equal(strip.smallLine, 'Posted 8:40 p.m. by the club');
    // The same closure next morning reads as the drawing's 7:00 a.m. screen.
    assert.equal(closureStrip([c], at('2026-11-28', '07:00'))!.smallLine, 'Posted Fri, Nov 27 at 8:40 p.m. by the club · ends tonight');
  });

  it('two places: one box, in the order closed; "Posted 7:10 a.m. and 7:25 a.m. by the club · both end tonight"', () => {
    const strip = closureStrip([
      closure(),
      closure({ scope: 'diamond', placeName: 'Alder Fields', facilityName: 'Diamond 2', showsFrom: at('2026-11-28', '07:25') }),
    ], at('2026-11-28', '07:30'))!;
    assert.deepEqual(strip.lines.map(l => l.sentence), ['Lions Park is closed today.', 'Diamond 2 at Alder Fields is closed today.']);
    assert.equal(strip.smallLine, 'Posted 7:10 a.m. and 7:25 a.m. by the club · both end tonight');
  });

  it('Until a later day: "closed through Sun, Nov 29" on Saturday, "closed today" on Sunday, gone on Monday', () => {
    const c = closure({ lastDay: '2026-11-29', endsAt: midnightAfter('2026-11-29') });
    assert.deepEqual(closureStrip([c], at('2026-11-28', '08:00'))!.lines.map(l => l.sentence), ['Lions Park is closed through Sun, Nov 29.']);
    assert.equal(closureStrip([c], at('2026-11-28', '08:00'))!.smallLine, 'Posted 7:10 a.m. by the club');
    assert.deepEqual(closureStrip([c], at('2026-11-29', '08:00'))!.lines.map(l => l.sentence), ['Lions Park is closed today.']);
    assert.equal(closureStrip([c], at('2026-11-30', '00:00')), null, 'midnight after Until: no strip, no job');
  });

  it('every place: "All our fields are closed today."', () => {
    assert.deepEqual(closureStrip([closure({ scope: 'all', placeName: null })], at('2026-11-28', '09:00'))!.lines.map(l => l.sentence),
      ['All our fields are closed today.']);
  });

  it('nothing showing is no strip; the same sentence twice is one line', () => {
    assert.equal(closureStrip([], at('2026-11-28', '09:00')), null);
    const strip = closureStrip([closure(), closure({ showsFrom: at('2026-11-28', '07:40') })], at('2026-11-28', '09:00'))!;
    assert.equal(strip.lines.length, 1);
    assert.equal(strip.smallLine, 'Posted 7:10 a.m. and 7:40 a.m. by the club · ends tonight');
  });

  it('past four lines it keeps three and says how many more; three posting times read "Posted by the club"', () => {
    const names = ['Lions Park', 'Alder Fields', 'Pinecrest Park', 'Harbourview Park', 'Northshore Park'];
    const strip = closureStrip(names.map((n, i) => closure({ placeName: n, showsFrom: at('2026-11-28', `07:1${i}`) })), at('2026-11-28', '09:00'))!;
    assert.equal(strip.lines.length, CLOSURE_STRIP_MAX_LINES);
    assert.equal(strip.lines[3].sentence, 'And 2 more places are closed.');
    assert.equal(strip.smallLine, 'Posted by the club · all end tonight');
  });

  it('the notice\'s own small line is unchanged by sharing its "Posted" words', () => {
    assert.equal(noticeSmallLine({ postedAt: at('2026-11-24', '18:02'), endsAt: at('2026-12-06', '00:00') }, at('2026-11-28', '07:20')),
      'Posted Tue, Nov 24 at 6:02 p.m. by the club · ends Sat, Dec 5 at midnight');
  });

  it('carries no count, division, person or admin line (K16): its whole shape', () => {
    const strip = closureStrip([closure()], at('2026-11-28', '07:20'))!;
    assert.deepEqual(Object.keys(strip).sort(), ['lines', 'smallLine']);
    assert.deepEqual(Object.keys(strip.lines[0]).sort(), ['endsAt', 'sentence']);
  });
});

describe('K9 · the rep mark\'s fixed words', () => {
  it('the drawing\'s words, on every surface', () => {
    const m = { place: 'Lions Park', day: 'Sat, Nov 28' };
    assert.equal(MARK_WORDS.pill, 'Place closed');
    assert.equal(MARK_WORDS.line(m), 'Lions Park closed · waits for a new date');
    assert.equal(MARK_WORDS.coachPill, 'Needs a new date', 'the coach reads what to do; families read why');
    assert.equal(MARK_WORDS.sheetTitle, 'Needs a new date');
    assert.equal(MARK_WORDS.sheetNote('Kestrel Bay Softball Association', m),
      'From Kestrel Bay Softball Association · Lions Park closed on Sat, Nov 28. Give this game a new date with Edit, or cancel it.');
  });
  it('the place\'s words: one diamond, a place, every place', () => {
    assert.equal(markPlaceWords({ scope: 'diamond', placeName: 'Lions Park', facilityName: 'Diamond 2' }), 'Diamond 2 at Lions Park');
    assert.equal(markPlaceWords({ scope: 'place', placeName: 'Lions Park', facilityName: null }), 'Lions Park');
    assert.equal(markPlaceWords({ scope: 'all', placeName: null, facilityName: null }), 'All our fields');
  });
});

describe('K9 · the club home: a marked rep game is "Not being played today", with "Place closed"', () => {
  const TODAY = '2026-11-28';
  const rep: ClubGameRow = {
    key: 'r1', program: 'rep', day: TODAY, startsAt: at(TODAY, '12:30'), endsAt: null, group: 'Kestrel Bay U13 Ospreys',
    groupOrder: 0, home: 'Kestrel Bay U13 Ospreys', away: 'Marlow Heights', homeAway: 'home', place: 'Lions Park · Diamond 1',
    address: null, state: 'placeClosed', score: null, movedTo: null, closedPlace: 'Lions Park', path: '/teams/u13-ospreys',
    seasonName: null, seasonSlug: null, decided: false,
  };
  it('it sits in the off band, never Later today', () => {
    const v = homeGamesView({ today: TODAY, rows: [rep], tournaments: [] }, Date.parse(at(TODAY, '07:20')))!;
    const off = v.bands.find(b => b.key === 'off');
    assert.ok(off, 'the off band shows');
    assert.equal(off!.items.length, 1);
    assert.equal(v.bands.find(b => b.key === 'later'), undefined);
  });
});

// ── The screen half (2C step 4) ──────────────────────────────────────────────────────────────────────────────────────

describe('every surface that can show a marked rep game shows the mark', () => {
  it('the mark rides the schedule entry, read beside the rule that decides who may see the team\'s games', () => {
    const view = read('lib/family-view.ts');
    assert.match(view, / {2}mark: MarkWords \| null;/);
    assert.match(view, /const marks = await repMarkWords\(org\.id, rows\s+\.filter\(r => COACH_GAME_EVENT_TYPES\.includes\(r\.event_type\) && r\.status !== 'cancelled' && !entryState\(r, now\)\.completed\)/);
    assert.match(view, /toEntry\(row, nextUpId, now, marks\[row\.id\] \?\? null\)/);
    assert.match(read('lib/family-league-entries.ts'), /mark: null,/);
  });
  it('the public team page, the family schedule and the family home draw it from the entry', () => {
    const row = read('components/public/RepTeamPublicSchedule.tsx');
    assert.match(row, /const mark = entry\.mark;/);
    assert.match(row, /MARK_WORDS\.line\(mark\)/);
    assert.match(row, /MARK_WORDS\.pill/);
    const client = read('app/(consumer)/family/teams/[teamId]/FamilyTeamClient.tsx');
    assert.match(client, /const mark = entry\.mark;/);
    assert.match(client, /MARK_WORDS\.line\(mark\)/);
    assert.match(client, /\{a\?\.pill \?\? markChip \?\? directionsLink\}/);
    assert.match(client, /\{a\?\.pill \?\? markChip\}/);
    assert.match(read('app/(consumer)/family/page.tsx'), /\{t\.nextUp\.mark && <div className=\{styles\.rowMark\}>\{MARK_WORDS\.line\(t\.nextUp\.mark\)\}/);
  });
  it('the club home, inside the rep rule\'s own module (the read imports exactly its list)', () => {
    const batch = read('lib/public-team-schedule.ts');
    assert.match(batch, /repMarkWords\(params\.org\.id, entries\.map\(\(\{ entry \}\) => entry\.id\)\)/);
    assert.match(batch, /entry: \{ \.\.\.entry, mark: markShown\(marks\[entry\.id\], entry\) \}/);
    const readCode = read('lib/club-games-read.ts');
    assert.match(readCode, /: closedPlace \? 'placeClosed'/);
    assert.match(readCode, /r\.state !== 'placeClosed'\);/, 'a closed game keeps no check window open');
    assert.match(read('components/public/ClubGamesPart.tsx'), /MARK_WORDS\.line\(\{ place: row\.closedPlace \}\)/);
    assert.match(read('components/public/PublicGameRow.tsx'), /placeClosed: MARK_WORDS\.pill/);
  });
  it('the coach\'s schedule chip and the game sheet', () => {
    const route = read('app/api/coaches/[orgSlug]/teams/[teamId]/events/route.ts');
    assert.match(route, /repMarkWords\(ctx\.org\.id, events\.map\(e => e\.id\)\)/);
    assert.match(route, /^ {4}closureMarks,$/m);
    const views = read('components/coaches/ScheduleCalendarViews.tsx');
    assert.match(views, /placeClosed=\{!!decor\.closureMarks\?\.\[event\.id\]\}/);
    assert.match(views, /className=\{styles\.eventChipClosed\} title=\{MARK_WORDS\.chipTitle\}>\{MARK_WORDS\.coachPill\}/);
    const sheet = read('components/coaches/ScheduleEventSheet.tsx');
    assert.match(sheet, /MARK_WORDS\.sheetNote\(clubName, closureMark\)/);
    assert.match(sheet, /\{titleBlock\}\{whenLine\}\{closedBlock\}/);
    assert.match(read('app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx'), /closureMark=\{closureMarks\[selectedEvent\.id\] \?\? null\}/);
  });
  it('the mark is read only by ids, through one door', () => {
    const server = read('lib/place-closures-server.ts');
    assert.match(server, /export async function repMarkWords\(orgId: string, eventIds: readonly string\[\]\)/);
    assert.match(server, /standingRepMarks\(orgId, eventIds\)/);
  });
});

describe('the strip: place words only, every club page, never a tournament\'s', () => {
  it('the frame\'s one loader reads it behind the notice\'s own gate, a failed read is no strip', () => {
    const data = read('lib/club-frame-data.ts');
    assert.match(data, /clubSiteOn \? closuresShowing\(org\.id, new Date\(nowIso\)\)\.catch\(\(\) => \[\]\) : Promise\.resolve\(\[\]\)/);
    assert.match(data, /closures: closureStrip\(closures, nowIso\)/);
  });
  it('it sits above the notice, inside the frame a tournament page never wears (K12)', () => {
    const frame = read('components/public/ClubFrame.tsx');
    const strip = frame.indexOf('{club.closures && <ClubClosureStrip strip={club.closures} />}');
    const notice = frame.indexOf('{club.notice && <ClubNoticeBanner notice={club.notice} />}');
    const wears = frame.indexOf('if (!preview && !wears) return');
    assert.ok(strip > 0 && notice > strip, 'the strip first, then the club\'s own notice (K4)');
    assert.ok(wears > 0 && wears < strip, 'a page that wears no club frame (a tournament\'s) returns before the strip');
  });
  it('the strip component draws sentences and the small line, nothing else: no link, no control, no motion', () => {
    const c = read('components/public/ClubClosureStrip.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(c, /<a\b|<Link\b|<button\b|href=|onClick|animation|transition/);
    assert.match(c, /\{l\.sentence\}/);
    assert.match(c, /\{strip\.smallLine\}/);
  });
});

describe('K17 · "Needs a new date" at the top of the public house league schedule while a postponement is fresh', () => {
  it('reads the sent postponements of the last 7 days, and draws the one section in one of two places', () => {
    const server = read('lib/league-game-changes-server.ts');
    assert.match(server, /export const NEEDS_DATE_ON_TOP_DAYS = 7;/);
    assert.match(server, /\.eq\('season_id', seasonId\)\.eq\('kind', 'postponed'\)\.gte\('sent_at', since\)/);
    const page = read('app/[orgSlug]/league/[seasonSlug]/schedule/page.tsx');
    const top = page.indexOf('{needsDateOnTop && needsDateSection}');
    const earlier = page.indexOf('{earlier.length > 0 && (');
    const foot = page.indexOf('{!needsDateOnTop && needsDateSection}');
    assert.ok(top > 0 && top < earlier && earlier < foot);
  });
});

describe('/review: a game played anyway reads as its score, never "Place closed", on every surface', () => {
  it('the one rule, on the entry', async () => {
    const src = read('lib/family-view.ts');
    assert.match(src, /mark: markShown\(mark, \{ live, completed, hasScore: scored \}\)/);
    assert.match(src, /return mark && !e\.live && !e\.completed && !e\.hasScore \? mark : null;/);
  });
});
