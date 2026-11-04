import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { looseEndSentence, MOVE_TO, movesFrom, moveWords, rareDoor, type MoveFacts, type StatusMove } from '../../lib/house-league-status-words.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 9a, PART 4 — THE SEASON'S PAGE AND EVERY STATUS CHANGE ASKING (owner 9a·4, Q16, S1·b; frames B, C, D;
 * words HOUSE_LEAGUE_STAGE9A_COPY.md §3–§5).
 *   1. The windows' words: what changes for families, the loose ends (warn, never block), the foot, the verbs.
 *   2. Every door is a move the server allows, and no other.
 *   3. The page: renders from the one gate (a finished season and the registrar read, with no write controls), the
 *      checklist leads a draft, the rare doors end the body, the dead fee switch is written nowhere.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const TODAY = '2026-10-24';
const F: MoveFacts = {
  seasonName: 'Dev House League 2026', seasonStartDate: '2026-05-31', seasonEndDate: '2026-08-30', registrationCloseAt: '2026-05-15',
  autoApproveUnderCapacity: true, pendingReviewCount: 1, waitlistCount: 0, unpaidFeeCount: 4,
};

describe('1 · the windows’ words (copy §4)', () => {
  it('the title names the season on a desk and "the season" on a phone; the button’s verb is the title’s', () => {
    const w = moveWords('complete', F, TODAY);
    assert.equal(w.title, 'Complete Dev House League 2026?');
    assert.equal(w.phoneTitle, 'Complete the season?');
    assert.equal(w.button, 'Complete season');
    assert.equal(w.foot, 'You can reopen it from Past seasons.');
  });
  it('Complete keeps Money and Email families open and says so; its loose ends are one amber sentence', () => {
    const w = moveWords('complete', F, TODAY);
    assert.ok(w.changes.includes('Money stays open: you can still mark fees received and record refunds.'));
    assert.ok(w.changes.includes('You can still email its families.'));
    assert.deepEqual(w.looseEnds, ['1 registration is still waiting for review, and 4 players still owe fees.']);
  });
  it('completing before the last day warns, never blocks', () => {
    const w = moveWords('complete', { ...F, seasonEndDate: '2026-12-30', pendingReviewCount: 0, unpaidFeeCount: 0 }, TODAY);
    assert.deepEqual(w.looseEnds, ['Its end date, Dec 30, 2026, is still ahead.']);
  });
  it('Open registration says how new registrations are taken, by the season’s own setting', () => {
    assert.ok(moveWords('open', F, TODAY).changes.some(c => c.startsWith('New registrations are approved while a division has room')));
    assert.ok(moveWords('open', { ...F, autoApproveUnderCapacity: false }, TODAY).changes.some(c => c.startsWith('New registrations wait for your review')));
  });
  it('Reopen until… asks for the new close date instead of warning about the old one (9b-1 Part 4, S2·b)', () => {
    assert.deepEqual(moveWords('reopenRegistration', F, TODAY).looseEnds, []);
    assert.match(moveWords('reopenRegistration', F, TODAY).lead, /stays open until the date you pick/);
    const win = readCode('components/admin/kit/club/league/SeasonStatusWindow.tsx');
    assert.match(win, /Close date/);
    assert.match(win, /registrationCloseAt: `\$\{until\}T23:59:00Z`/, 'the form runs to the end of the picked day');
  });
  it('every window says families are not emailed (no status change sends one)', () => {
    for (const m of Object.keys(MOVE_TO) as StatusMove[]) {
      assert.ok(moveWords(m, F, TODAY).changes.some(c => /are not emailed/.test(c)), m);
    }
  });
  it('the loose-end sentence joins only what is there', () => {
    assert.equal(looseEndSentence([]), null);
    assert.equal(looseEndSentence(['a']), 'a.');
    assert.equal(looseEndSentence(['a', 'b', 'c']), 'a, b, and c.');
  });
  it('the rare door: "This season ended {date}." once it has, "Done with this season?" before', () => {
    assert.equal(rareDoor('complete', F, TODAY).sentence, 'This season ended Aug 30.');
    assert.equal(rareDoor('complete', { seasonEndDate: '2026-12-30' }, TODAY).sentence, 'Done with this season?');
    assert.equal(rareDoor('reopen', F, TODAY).link, 'Reopen the season…');
  });
});

describe('1b · finished, honestly (House League 9f-1; words HOUSE_LEAGUE_STAGE9F_COPY.md §1–§3, §6.2)', () => {
  const reopen = (over: Partial<MoveFacts> = {}) => moveWords('reopen', { ...F, ...over }, TODAY);
  it('Complete says ratings are erased, after the public-site line and before "not emailed" (9f·7)', () => {
    const c = moveWords('complete', F, TODAY).changes;
    const at = (line: string) => c.indexOf(line);
    assert.ok(at('Player ratings are erased.') > at('Your public site lists it under Past seasons, and its schedule and standings stay up.'));
    assert.equal(c[c.length - 1], 'Families are not emailed.');
    assert.equal(c[c.length - 2], 'Player ratings are erased.');
  });
  it('Reopen names the public site by the dates: Ended {date} once its last day has passed, else Playing now (9f·3)', () => {
    assert.ok(reopen().changes.includes('Your public site lists it as Ended Aug 30 until you complete it again.'));
    assert.ok(reopen({ seasonEndDate: '2026-12-30' }).changes.includes('Your public site lists it as Playing now.'));
    assert.ok(reopen({ seasonEndDate: null }).changes.includes('Your public site lists it as Playing now.'));
    // The window reads the site's own tag, so it never promises another word or date than the site then shows.
    assert.ok(reopen({ seasonStartDate: '2025-05-31', seasonEndDate: '2025-08-28' }).changes
      .includes('Your public site lists it as Ended Aug 28, 2025 until you complete it again.'), 'last year’s season carries its year');
    assert.ok(reopen({ seasonStartDate: '2027-01-05', seasonEndDate: '2027-03-30' }).changes
      .includes('Your public site lists it as Starts Jan 5, 2027.'), 'a first day still ahead');
    assert.ok(reopen().changes.every(l => !/Final standings/.test(l)), '"Final" never names a running season');
  });
  it('Reopen says ratings do not come back, and names the newer seasons as not changed (9f·7)', () => {
    assert.ok(reopen().changes.includes('Player ratings were erased when it finished. They don’t come back.'));
    const newer = (names: string[]) => reopen({ reopen: { newer: names, blockedBy: null } }).changes;
    assert.ok(!newer([]).some(l => /not changed/.test(l)));
    assert.ok(newer(['Draft Test 2028']).includes('Draft Test 2028 is not changed.'));
    assert.ok(newer(['Draft Test 2028', 'Fall Ball 2028']).includes('Draft Test 2028 and Fall Ball 2028 are not changed.'));
    assert.ok(newer(['A', 'B', 'C']).includes('Your 3 newer seasons are not changed.'));
    const c = newer(['Draft Test 2028']);
    assert.equal(c[c.length - 1], 'Families are not emailed.', '"not emailed" stays last');
  });
  it('Reopen on the free League plan is refused before the tap: the holder named, no Reopen button (9f·5, §6.2)', () => {
    const w = reopen({ reopen: { newer: [], blockedBy: { name: 'Fall Ball 2027', status: 'active' } } });
    assert.deepEqual(w.refused, [
      'Your free League plan runs one season at a time, and Fall Ball 2027 isn’t finished. Complete it first, then you can reopen this one.',
      'League Plus runs several seasons and age groups side by side.',
    ]);
    assert.deepEqual(w.changes, []);
    const draft = reopen({ reopen: { newer: [], blockedBy: { name: 'Draft Test 2028', status: 'draft' } } });
    assert.equal(draft.refused?.[0], 'Your free League plan runs one season at a time, and Draft Test 2028 is still getting ready.');
    assert.equal(reopen().refused, undefined);
    const win = readCode('components/admin/kit/club/league/SeasonStatusWindow.tsx');
    // The refused window's only button is Close (never Cancel, nothing is asked), and it never draws the primary.
    assert.match(win, /if \(w\.refused\) \{[\s\S]*?footer=\{<button type="button" className="btn btn-outline" onClick=\{onClose\}>Close<\/button>\}/);
  });
  it('Archive is retired: no move, no door, no window word (9f·4)', () => {
    assert.ok(!('archive' in MOVE_TO));
    assert.deepEqual(movesFrom('completed'), ['reopen']);
    assert.deepEqual(movesFrom('archived'), ['reopen'], 'a season archived before 9f-1 reads exactly as a completed one');
    const words = readCode('lib/house-league-status-words.ts');
    assert.doesNotMatch(words, /Archive the season|Archive season|Archiving…|has been archived|Finished and settled/);
    const route = readCode('app/api/admin/house-league/seasons/[seasonId]/route.ts');
    assert.match(route, /completed:\s*\['active'\],/, 'nothing moves INTO archived');
    assert.match(route, /archived:\s*\['active'\],/, 'a legacy archived season keeps its way back');
    assert.doesNotMatch(route, /Archive it instead/);
  });
});

describe('2 · every door is a move the server allows (and Reopen registration only before play)', () => {
  const route = readCode('app/api/admin/house-league/seasons/[seasonId]/route.ts');
  const table = /const ALLOWED_TRANSITIONS[^=]*=\s*\{([\s\S]*?)\};/.exec(route)?.[1] ?? '';
  const allowed = (from: string) => {
    const m = new RegExp(`${from}:\\s*\\[([^\\]]*)\\]`).exec(table);
    return m ? [...m[1].matchAll(/'(\w+)'/g)].map(x => x[1]) : [];
  };
  for (const from of ['draft', 'registration_open', 'registration_closed', 'active', 'completed', 'archived']) {
    it(`${from}: the page’s doors and the server’s table agree`, () => {
      // An opened season its close date closed (9b-1 Part 4) adds Start season; its Reopen until… changes the date alone.
      const doors = [...movesFrom(from), ...movesFrom(from, 'closedByDate')].map(m => MOVE_TO[m]).filter(to => to !== from);
      assert.deepEqual([...new Set(doors)].sort(), allowed(from).sort());
    });
  }
  it('no door reopens registration once the season is playing', () => {
    assert.ok(!movesFrom('active').includes('reopenRegistration'));
  });
});

describe('3 · the season’s page', () => {
  const page = readCode('app/[orgSlug]/admin/house-league/seasons/[seasonId]/page.tsx');
  it('renders from the one gate, with the season: a finished season and the registrar get no write controls (Q16, Q17)', () => {
    assert.match(page, /useHouseLeagueAccess\(detail\?\.season \?\? null\)/);
    assert.match(page, /const canRun = !!access\?\.run;/);
    assert.match(page, /const canMove = !!access\?\.changeStatus;/);
    assert.doesNotMatch(page, /userRole|hasCapability|'league_admin'/);
  });
  it('a finished season says it once, quietly, on every page — from the season layout, never a page’s own copy', () => {
    assert.match(readCode('app/[orgSlug]/admin/house-league/seasons/[seasonId]/layout.tsx'), /<SeasonLockLine \/>/);
    const lock = readCode('components/admin/kit/club/league/SeasonLockLine.tsx');
    for (const page of ['overview', 'teams', 'schedule', 'standings', 'registrations', 'money']) {
      assert.match(lock, new RegExp(`\\b${page}: `), `${page} has no lock line`);
    }
    assert.doesNotMatch(lock, /notifications:/, 'Email families stays open: no lock line (owner 2026-10-24)');
    assert.match(lock, /registrations: 'This season is finished\. Registrations are locked, and you can still mark fees received\.'/);
    assert.doesNotMatch(page, /This season is finished/, 'the page grew its own copy of the line');
  });
  it('a draft leads with its checklist; Open registration is absent until the required steps are done (9a·4, 9b·1)', () => {
    assert.match(page, /title="Before you open registration"/);
    assert.match(page, /canMove && checklistLeft\(steps\)\.length === 0\s*\? <button[^>]*onClick=\{\(\) => setMove\('open'\)\}>Open registration<\/button>/);
    assert.match(page, /const steps = seasonChecklist\(season, divisions\);/, 'the same checklist the server refuses Open registration with');
  });
  it('every status change opens the window; nothing on the page PATCHes a status itself', () => {
    assert.match(page, /<SeasonStatusWindow/);
    assert.doesNotMatch(page, /method: 'PATCH'/);
    const win = readCode('components/admin/kit/club/league/SeasonStatusWindow.tsx');
    assert.match(win, /footerStart=\{<span className=\{repKit\.footNote\}>\{w\.foot\}<\/span>\}/, 'the foot: sentence left');
    assert.match(win, /kind="form"/, 'a phone gets the full-screen window');
  });
  it('Complete and Reopen are rare doors ending the body; Close / Reopen registration sit on the Registration block', () => {
    assert.match(page, /\(\['complete', 'reopen'\] as const\)\.filter\(m => moves\.includes\(m\)/);
    assert.match(page, /reopen: detail\.reopen,/, 'the Reopen window gets the newer seasons and the free plan’s holder');
    assert.match(page, /<RegistrationBlock[^>]*door=\{regDoor\}/);
  });
  it('the figures band is one joined band of four, without today’s money figure (9b-2)', () => {
    assert.match(page, /<div className=\{s\.band\} role="group" aria-label="This season">/);
    assert.doesNotMatch(page, /Outstanding|still owing|Fees still owing/i);
  });
  it('the Status strip, the "U10" chip and the five pill-links per division are gone', () => {
    assert.doesNotMatch(page, /lifecycleBar|divisionBadge|divisionLinks|NEXT_TRANSITION/);
  });
});

describe('3b · the dead "Auto-generate fee entries" switch is written nowhere (S1·b)', () => {
  for (const f of [
    'app/api/admin/house-league/seasons/route.ts',
    'app/api/admin/house-league/seasons/[seasonId]/route.ts',
    'app/[orgSlug]/admin/onboarding/page.tsx',
    'app/[orgSlug]/admin/house-league/seasons/[seasonId]/page.tsx',
    'components/admin/kit/club/league/SeasonRecordBlocks.tsx',
    'components/admin/kit/club/CreateLeagueSeasonDialog.tsx',
  ]) {
    it(f, () => assert.doesNotMatch(readCode(f), /autoGenerateFees|auto_generate_fees:/));
  }
});
