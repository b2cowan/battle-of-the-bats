/**
 * THE FUNDRAISING TAB'S SEASON FIGURES — and the reason this file exists at all.
 *
 * ⚠⚠ `rollUpFundraising` HAD NO TEST, AND ITS `sponsorPledged` BRANCH WAS UNREACHABLE. It summed
 * `totalRaised` for sponsors whose stored `sponsor_status` was not yet `received` — but that column
 * flips on the FIRST cheque (mig 268; the whole reason `sponsorStanding` is derived rather than
 * read), so any row landing in that branch had received nothing and contributed 0. The tab's
 * "· $X pledged" caption could therefore never render: dead copy claiming to report the outstanding
 * promise on a screen that had never shown it, one nav level below a Money-hub rail printing the
 * real figure under the same word.
 *
 * Every case below would have caught it. The two that matter most are marked ⚠.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rollUpFundraising } from '../../lib/coach-fundraising';

/** A drive: no promise, money is whatever was logged against it. */
const drive = (totalRaised: number, teamNet: number, totalCredits: number) =>
  ({ kind: 'fundraiser' as const, sponsorStatus: null, totalRaised, teamNet, totalCredits });

/** A sponsor. `sponsorStatus` follows the money: 'received' from the first cheque onward. */
const sponsor = (pledgedAmount: number | null, arrived: number, teamNet = 0, totalCredits = 0) => ({
  kind: 'sponsor' as const,
  sponsorStatus: (arrived > 0 ? 'received' : 'pledged') as 'received' | 'pledged',
  pledgedAmount,
  totalRaised: arrived,
  teamNet,
  totalCredits,
});

describe('rollUpFundraising — what a season raised', () => {
  it('an empty season is all zeros, not NaN', () => {
    const r = rollUpFundraising([]);
    assert.deepEqual(r, {
      fundraiserRaised: 0, fundraiserCount: 0,
      sponsorReceived: 0, sponsorPledged: 0, sponsorsAwaiting: 0, sponsorCount: 0,
      teamKeeps: 0, creditedToFamilies: 0,
    });
  });

  it('drives sum their logged money and are counted apart from sponsors', () => {
    const r = rollUpFundraising([drive(600, 400, 200), drive(400, 300, 100)]);
    assert.equal(r.fundraiserRaised, 1000);
    assert.equal(r.fundraiserCount, 2);
    assert.equal(r.sponsorCount, 0);
    assert.equal(r.teamKeeps, 700);
    assert.equal(r.creditedToFamilies, 300);
  });

  it('⚠ a promise with nothing arrived is STILL TO COME, and is not raised', () => {
    // The regression case. Before the fix this sponsor contributed its `totalRaised` (0) to
    // `sponsorPledged`, so the figure read $0.00 and its caption never rendered.
    const r = rollUpFundraising([sponsor(500, 0)]);
    assert.equal(r.sponsorReceived, 0);
    assert.equal(r.sponsorPledged, 500);
    assert.equal(r.sponsorsAwaiting, 1);
    // A pledge has kept the team nothing and credited nobody — the realised invariant.
    assert.equal(r.teamKeeps, 0);
    assert.equal(r.creditedToFamilies, 0);
  });

  it('⚠ a PART-paid sponsor is on both sides of the line at once', () => {
    // The case the old else-branch could not reach at all: the first cheque flips the status, so
    // the row skipped `sponsorPledged` entirely and the outstanding $250 was reported nowhere.
    const r = rollUpFundraising([sponsor(500, 250, 150, 100)]);
    assert.equal(r.sponsorReceived, 250, 'what arrived is raised');
    assert.equal(r.sponsorPledged, 250, 'what is left is still to come');
    assert.equal(r.sponsorsAwaiting, 1);
    assert.equal(r.teamKeeps, 150, 'arrivals keep and credit as they land');
    assert.equal(r.creditedToFamilies, 100);
  });

  it('a promise kept in full leaves nothing to come, and the tile can hide', () => {
    const r = rollUpFundraising([sponsor(500, 500, 500, 0)]);
    assert.equal(r.sponsorReceived, 500);
    assert.equal(r.sponsorPledged, 0);
    assert.equal(r.sponsorsAwaiting, 0);
  });

  it('over-payment never reads as negative money owed', () => {
    // `stillToCome` floors at zero — a sponsor who sent more than promised is generous, not a debt.
    const r = rollUpFundraising([sponsor(500, 600, 600, 0)]);
    assert.equal(r.sponsorPledged, 0);
    assert.equal(r.sponsorsAwaiting, 0);
    assert.equal(r.sponsorReceived, 600);
  });

  it('a sponsor recorded with no promise is raised money with nothing outstanding', () => {
    const r = rollUpFundraising([sponsor(null, 300, 300, 0)]);
    assert.equal(r.sponsorReceived, 300);
    assert.equal(r.sponsorPledged, 0);
    assert.equal(r.sponsorsAwaiting, 0);
  });

  it('counts the sponsors AWAITING, not the sponsors — the figure and its caption are one walk', () => {
    const r = rollUpFundraising([
      sponsor(500, 0),          // nothing in    → awaiting
      sponsor(500, 250, 250),   // half in       → awaiting
      sponsor(500, 500, 500),   // promise kept  → not awaiting
      sponsor(null, 100, 100),  // no promise    → not awaiting
    ]);
    assert.equal(r.sponsorCount, 4);
    assert.equal(r.sponsorsAwaiting, 2);
    assert.equal(r.sponsorPledged, 750);
  });

  it('mixes both kinds without either leaking into the other', () => {
    const r = rollUpFundraising([drive(1240, 900, 340), sponsor(1300, 800, 290, 510)]);
    assert.equal(r.fundraiserRaised, 1240);
    assert.equal(r.sponsorReceived, 800);
    assert.equal(r.sponsorPledged, 500);
    assert.equal(r.fundraiserCount, 1);
    assert.equal(r.sponsorCount, 1);
    // The band's headline is the two raised figures added — stated here so a change to either
    // half cannot quietly move the total the tab leads with.
    assert.equal(r.fundraiserRaised + r.sponsorReceived, 2040);
    assert.equal(r.teamKeeps, 1190);
    assert.equal(r.creditedToFamilies, 850);
    // Team keeps + credited = raised. The split is the whole model, and it must tie.
    assert.equal(r.teamKeeps + r.creditedToFamilies, r.fundraiserRaised + r.sponsorReceived);
  });

  it('sums in a way that does not drift on repeating cents', () => {
    // Three thirds of a dollar: float addition gives 0.9999999999999999 without the rounding.
    const r = rollUpFundraising([drive(0.33, 0.33, 0), drive(0.33, 0.33, 0), drive(0.34, 0.34, 0)]);
    assert.equal(r.fundraiserRaised, 1);
    assert.equal(r.teamKeeps, 1);
  });
});
