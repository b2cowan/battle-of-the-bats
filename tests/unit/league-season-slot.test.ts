/**
 * ONE HOUSE-LEAGUE SEASON AT A TIME (House League 9f·5, owner 2026-11-04; build 9f-1 Part 5; words
 * HOUSE_LEAGUE_STAGE9F_COPY.md §6). The tournament's same rule is pinned in `tournament-one-at-a-time.test.ts`.
 *
 * On the free League plan only a LIVE season holds the one slot: getting ready, registration open or closed, or running.
 * A finished season doesn't: it stays on the club's site while next year's is set up. Before 9f-1 every season not
 * archived held it (so last year's completed season blocked next year's), and Reopen skipped the limit entirely. These
 * assertions pin the rule in its one home (`lib/league-season-slot.ts`), the words that say it, and that Create season,
 * the Reopen PATCH and the Reopen window all read it — a check that counts "not archived" again would quietly put the old
 * rule back at one door.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { holdsSlot, needsFreeSlot, slotBlocker, SLOT_STATUSES, type SlotHolder } from '../../lib/league-season-slot.ts';
import { houseLeagueSeasonCap, leagueCapHit, reopenRefusal, REOPEN_CAP_ERROR, seasonCapBody } from '../../lib/free-floor.ts';

describe('what holds the free League plan’s slot', () => {
  it('the four live statuses hold it; a finished season holds nothing', () => {
    assert.deepEqual([...SLOT_STATUSES], ['draft', 'registration_open', 'registration_closed', 'active']);
    for (const s of SLOT_STATUSES) assert.equal(holdsSlot(s), true, s);
    assert.equal(holdsSlot('completed'), false, 'a finished season stays on the site and holds nothing');
    assert.equal(holdsSlot('archived'), false, 'an archived season reads as a completed one');
    assert.equal(holdsSlot(null), false);
  });

  it('only Reopen needs a free slot; every forward move keeps the one it holds, and Complete frees it', () => {
    assert.equal(needsFreeSlot('completed', 'active'), true, 'Reopen');
    assert.equal(needsFreeSlot('archived', 'active'), true, 'Reopen of a legacy archived season');
    assert.equal(needsFreeSlot('draft', 'registration_open'), false);
    assert.equal(needsFreeSlot('registration_open', 'registration_closed'), false);
    assert.equal(needsFreeSlot('registration_closed', 'registration_open'), false);
    assert.equal(needsFreeSlot('registration_closed', 'active'), false);
    assert.equal(needsFreeSlot('active', 'completed'), false);
  });

  it('the blocker is the most under-way holder, and only when the plan is full', () => {
    const h = (status: SlotHolder['status'], name = status): SlotHolder => ({ id: name, name, status });
    assert.equal(slotBlocker([], 1), null);
    assert.equal(slotBlocker([h('active')], 1)?.name, 'active');
    assert.equal(slotBlocker([h('active')], Infinity), null, 'a paid plan is never blocked');
    assert.equal(slotBlocker([h('active')], 2), null);
  });

  it('no plan value moves: the free League plan still runs one season', () => {
    assert.equal(houseLeagueSeasonCap({ freeFloor: 'league_starter' }), 1);
    assert.equal(houseLeagueSeasonCap({ freeFloor: null }), Infinity);
  });
});

describe('every limit check reads the one count', () => {
  const read = readCode('lib/league-season-slot.ts');
  it('the holders are read by the four statuses, never "not archived"', () => {
    assert.match(read, /\.in\('status', \[\.\.\.SLOT_STATUSES\]\)/);
    assert.match(read, /\.sort\(\(a, b\) => ORDER\[a\.status\] - ORDER\[b\.status\]\)/, 'running first: the one a refusal names');
  });
  it('Create season counts the holders and names the blocker in its 403', () => {
    const route = readCode('app/api/admin/house-league/seasons/route.ts');
    assert.match(route, /const holders = await readSlotHolders\(supabaseAdmin, ctx!\.org\.id\);/);
    assert.match(route, /leagueCapHit\('league_season', slotBlocker\(holders, seasonCap\)\), \{ status: 403 \}/);
    assert.doesNotMatch(route, /neq\('status', 'archived'\)/);
  });
  it('the status PATCH refuses a Reopen that would make two live seasons, with the same count', () => {
    const route = readCode('app/api/admin/house-league/seasons/[seasonId]/route.ts');
    assert.match(route, /if \(cap < Infinity && needsFreeSlot\(season\.status, newStatus\)\) \{\s*if \(\(await readSlotHolders\(supabaseAdmin, ctx!\.org\.id, seasonId\)\)\.length >= cap\) \{\s*return NextResponse\.json\(\{ error: REOPEN_CAP_ERROR \}, \{ status: 422 \}\);/);
  });
  it('the season GET carries the Reopen facts on a finished season, from the same holders', () => {
    const route = readCode('app/api/admin/house-league/seasons/[seasonId]/route.ts');
    assert.match(route, /\.\.\.\(isFinishedLeagueSeason\(season\) \? \{ reopen: await reopenFacts\(season, ctx!\.org\) \} : \{\}\)/);
    assert.match(route, /readSlotHolders\(supabaseAdmin, org\.id, season\.id\)/);
    assert.match(route, /const blocker = slotBlocker\(holders, cap\);/);
  });
  it('the Create season window passes the holder through to the refusal', () => {
    assert.match(readCode('components/admin/kit/club/CreateLeagueSeasonDialog.tsx'), /onCapHit\(data\.capHit, data\.holder\)/);
    assert.match(readCode('app/[orgSlug]/admin/house-league/page.tsx'), /<LeagueCapUpgradeModal capHit=\{capHit\.kind\} holder=\{capHit\.holder\}/);
    assert.match(readCode('components/admin/LeagueCapUpgrade.tsx'), /capHit === 'league_season' \? seasonCapBody\(holder\) : CAP_BODY\[capHit\]/);
  });
});

describe('the words (copy §6)', () => {
  it('Create season: named for a running or open holder, a getting-ready holder, else the fallback (§6.1)', () => {
    assert.equal(seasonCapBody({ name: 'Fall Ball 2027', status: 'active' }),
      'Your free League plan runs one season at a time, and Fall Ball 2027 holds it. Once you complete it, you can start the next. It stays on your site. League Plus runs several seasons and age groups side by side.');
    assert.equal(seasonCapBody({ name: 'Fall Ball 2027', status: 'registration_open' }), seasonCapBody({ name: 'Fall Ball 2027', status: 'active' }));
    assert.equal(seasonCapBody({ name: 'Draft Test 2028', status: 'draft' }),
      'Your free League plan runs one season at a time, and Draft Test 2028 holds it while it’s getting ready. League Plus runs several seasons and age groups side by side.');
    assert.equal(seasonCapBody(null),
      'Your free League plan runs one season at a time, and a finished one stays on your site. Complete your current season to start the next. League Plus runs several seasons and age groups side by side.');
    assert.match(readCode('components/admin/LeagueCapUpgrade.tsx'), /league_season: 'One season at a time on your free plan'/);
  });
  it('the 403 carries the generic error and the holder (§6.1)', () => {
    assert.deepEqual(leagueCapHit('league_season', { name: 'Fall Ball 2027', status: 'active' }), {
      error: 'Your free League plan runs one season at a time, and a finished one stays on your site. Complete your current season to start the next, or upgrade to League Plus to run several seasons.',
      capHit: 'league_season',
      holder: { name: 'Fall Ball 2027', status: 'active' },
    });
    assert.equal('holder' in leagueCapHit('league_season'), false);
  });
  it('Reopen: the window’s refusal and the route’s error (§6.2)', () => {
    assert.deepEqual(reopenRefusal({ name: 'Fall Ball 2027', status: 'active' }), [
      'Your free League plan runs one season at a time, and Fall Ball 2027 isn’t finished. Complete it first, then you can reopen this one.',
      'League Plus runs several seasons and age groups side by side.',
    ]);
    assert.equal(reopenRefusal({ name: 'Draft Test 2028', status: 'draft' })[0],
      'Your free League plan runs one season at a time, and Draft Test 2028 is still getting ready.');
    assert.equal(REOPEN_CAP_ERROR, 'Your free League plan runs one season at a time. Complete your current season before you reopen this one.');
  });
  it('the retired words are gone: "one active season", "multiple seasons"', () => {
    for (const f of ['lib/free-floor.ts', 'components/admin/LeagueCapUpgrade.tsx']) {
      assert.doesNotMatch(readCode(f), /one active season|One season on your free plan|run multiple seasons/, f);
    }
  });
});
