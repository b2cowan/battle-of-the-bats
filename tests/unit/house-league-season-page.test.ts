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
    assert.ok(w.changes.includes('Money stays open: you can still mark fees received.'));
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
  it('Reopen registration warns when the close date has already passed', () => {
    assert.match(moveWords('reopenRegistration', F, TODAY).looseEnds[0], /^Your close date, May 15, 2026, has already passed\./);
    assert.deepEqual(moveWords('reopenRegistration', { ...F, registrationCloseAt: '2026-12-01' }, TODAY).looseEnds, []);
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
    assert.equal(rareDoor('archive', F, TODAY).link, 'Archive the season…');
    assert.equal(rareDoor('reopen', F, TODAY).link, 'Reopen the season…');
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
      assert.deepEqual(movesFrom(from).map(m => MOVE_TO[m]).sort(), allowed(from).sort());
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
  it('a finished season says it once, quietly', () => {
    assert.match(page, /access\?\.finished && \(\s*<p className=\{s\.lockLine\}>This season is finished, so this page is locked\. Money stays open for late fees\.<\/p>/);
  });
  it('a draft leads with its checklist; Open registration is absent until the three steps are done (9a·4)', () => {
    assert.match(page, /title="Before you open registration"/);
    assert.match(page, /canMove && steps\.every\(st => st\.done\)\s*\? <button[^>]*onClick=\{\(\) => setMove\('open'\)\}>Open registration<\/button>/);
  });
  it('every status change opens the window; nothing on the page PATCHes a status itself', () => {
    assert.match(page, /<SeasonStatusWindow/);
    assert.doesNotMatch(page, /method: 'PATCH'/);
    const win = readCode('components/admin/kit/club/league/SeasonStatusWindow.tsx');
    assert.match(win, /footerStart=\{<span className=\{repKit\.footNote\}>\{w\.foot\}<\/span>\}/, 'the foot: sentence left');
    assert.match(win, /kind="form"/, 'a phone gets the full-screen window');
  });
  it('Complete, Archive and Reopen are rare doors ending the body; Close / Reopen registration sit on the Registration block', () => {
    assert.match(page, /\(\['complete', 'archive', 'reopen'\] as const\)\.filter\(m => moves\.includes\(m\)\)/);
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
