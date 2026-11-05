/**
 * Plans end at the renewal date, Stage 1 Part B — the screens. The owner's billing page while a cancel waits (the real shared
 * body, rendered), and the operator record's doors (read from source, like the console's other guards). The server half is
 * tests/unit/plan-ending.test.ts; the owner's request contracts are in plan-billing-actions.test.ts.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { billingTestLoader } from './_billing-test-loader.ts';
import { PLAN_BILLING_PROFILES, planCancellationImpact } from '../../lib/plan-billing-profile.ts';
import { PLAN_CONFIG } from '../../lib/plan-config.ts';
import { PLAN_BILLING_WORDS as W } from '../../lib/plan-billing-words.ts';
import type { BillingSnapshot, BillingRead, BillingEnding } from '../../lib/plan-billing-data.ts';
import type { BillingBodyViewProps } from '../../components/billing/BillingBody.tsx';
import type { OrgPlan } from '../../lib/types.ts';
import { readCode } from './_source-code.ts';

const { BillingBodyView } = billingTestLoader()('components/billing/BillingBody.tsx') as { BillingBodyView: ComponentType<BillingBodyViewProps> };
const ready = <T>(data: T): BillingRead<T> => ({ status: 'ready', data });
const ENDS = '2027-03-01T05:00:00Z';

function page(key: OrgPlan, ending: BillingEnding | null, canManageBilling = true): string {
  const profile = PLAN_BILLING_PROFILES[key];
  const snapshot: BillingSnapshot = {
    org: { id: 'org-a', slug: 'club-a', name: 'Falcons', planId: key, ownPlanId: key, enabledAddons: [], subscriptionStatus: 'active', subscriptionPeriod: 'monthly', currentPeriodEnd: ENDS, teamLimit: 15, tournamentLimit: 1 } as unknown as BillingSnapshot['org'],
    canManageBilling, usage: ready({ teams: { count: 9, limit: 15 }, tournament_slots: { count: 1, limit: 3 }, staff_seats: { count: 2, limit: 10 }, officials: 0 }),
    freeTime: ready({ freeTime: null, portal: null, foundingThrough: null, overLimitAfter: false }),
    founding: ready({ isFoundingSeason: false, compUntil: null }),
    gating: ready({ tournament: false, tournament_plus: false, team: false, league: false, club: false, club_large: false }),
    cancellation: ready({ currentPlan: key, ...planCancellationImpact(profile, [], 9), activeTeams: 9, activeTournamentCount: 0, tournaments: [], cancelled: null, ending }),
    move: ready({ live: true, scheduledMove: null }),
  };
  const noop = () => {};
  const actions = { busy: null, cycle: 'monthly' as const, setCycle: noop, portal: noop, card: noop, reactivate: noop, keep: noop, keepPlan: noop, changePick: noop, cancel: noop, change: noop, details: noop, choose: noop, retry: noop };
  return renderToStaticMarkup(createElement(BillingBodyView, { snapshot, profile, ownProfile: profile, actions }))
    .replaceAll('&#x27;', "'").replaceAll('&amp;', '&');
}
const waiting = (endsAt = ENDS, heldMovePlan: OrgPlan | null = null): BillingEnding => ({ waits: true, endsOn: endsAt, pending: { endsAt, heldMovePlan, kind: 'cancellation', move: null } });
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe('the owner billing page while a cancel waits (Stage 0 rulings 1–3, 7)', () => {
  it('the plan card says Ending and the date, with Keep {Plan} as ONE lime button at every width; no renewal line', () => {
    const html = page('tournament_plus', waiting());
    assert.match(html, />Ending</);
    assert.match(html, /Ends on March 1, 2027, the last day you paid for\./);
    assert.equal(count(html, 'Keep Tournament Plus'), 2, 'the lime button and the change-plan line (the sentence-end link is gone)');
    assert.doesNotMatch(html, /Renews March/);
  });

  it('the change doors are ABSENT, prices stay readable, one line says why; Reduce or cancel is hidden', () => {
    const html = page('tournament_plus', waiting());
    assert.ok(html.includes(W.cancel.endingRefusal('tournament_plus', ENDS)));
    assert.doesNotMatch(html, /Downgrade to Tournament|Upgrade to|Move to |Contact us to move/);
    assert.ok(html.includes(PLAN_CONFIG.tournament.label) && html.includes('Free'), 'the table still reads');
    assert.doesNotMatch(html, /Reduce or cancel|billing-cancel-btn/);
  });

  it('a Premium coach sees the same line with Keep Premium, and no Start my club door', () => {
    const html = page('team', waiting());
    assert.match(html, /Ends on March 1, 2027/);
    assert.equal(count(html, 'Keep Premium'), 2);
    assert.ok(!html.includes(W.clubUpgrade.start));
  });

  it('a cheaper move the cancel set aside is named under the line (G1)', () => {
    const html = page('club_large', waiting(ENDS, 'club'));
    assert.match(html, /If you keep it, you renew as Club, the move you chose\./);
    assert.match(html, /Keep Club · Association/);
  });

  it('one date on the page for an evening-Eastern end (G4: …T02:00Z is the day before in Toronto)', () => {
    assert.match(page('tournament_plus', waiting('2027-03-01T02:00:00Z')), /Ends on February 28, 2027/);
  });

  it('a non-owner who types the URL sees the locked card and no Keep', () => {
    const html = page('tournament_plus', waiting(), false);
    assert.match(html, /Only Falcons’ owner/);
    assert.doesNotMatch(html, /Keep Tournament Plus|Ends on/);
  });
});

describe('Reduce or cancel before a cancel: words that are true at the click', () => {
  it('a paying plan says it ends on its date, and the door names the plan, not a suspension', () => {
    const html = page('tournament_plus', { waits: true, endsOn: ENDS, pending: null });
    assert.match(html, /Cancelling ends Falcons’ plan on March 1, 2027, the end of the period you paid for\./);
    assert.match(html, /Cancel Tournament Plus…/);
    assert.doesNotMatch(html, /Cancel and suspend|Cancelling suspends/);
  });
  it('no paid period: today’s immediate words stay (they are still true)', () => {
    assert.match(page('tournament_plus', { waits: false, endsOn: null, pending: null }), /Cancel and suspend Falcons…/);
  });
  it('a subscription with no date on record offers no door, rather than promising a date or saying "now"', () => {
    const html = page('tournament_plus', { waits: true, endsOn: null, pending: null });
    assert.match(html, /We couldn’t load the renewal date/);
    assert.doesNotMatch(html, /billing-cancel-btn/);
  });
});

describe('the Keep door and the wait callout (source)', () => {
  const css = readCode('components/billing/Billing.module.css');
  it('the lime button shows at every width (no sentence-end link); full width at the 44px tap floor on a phone', () => {
    assert.match(css, /\.keepButton\.keepButton \{ display: inline-flex;/);
    assert.doesNotMatch(css, /\.keepLink/);
    assert.match(css, /@media \(max-width: 640px\) \{\s*\.keepButton\.keepButton \{[^}]*width: 100%; min-height: var\(--tap-min, 44px\)/);
  });
  it('a wait is the white callout with an amber left edge — PageNotice gains no amber tone', () => {
    assert.match(css, /\.waitCallout \{[^}]*background: var\(--card-bg\);[^}]*border-left: 3px solid var\(--warning\)/);
    assert.doesNotMatch(readCode('components/shared/PageNotice.tsx'), /'warn'|amber/);
  });
});

describe('the operator record while a cancel waits (source)', () => {
  const record = readCode('app/platform-admin/orgs/[id]/ClubRecord.tsx');
  const page = readCode('app/platform-admin/orgs/[id]/page.tsx');
  const fn = (name: string) => {
    const start = record.indexOf(`function ${name}(`);
    assert.ok(start >= 0, name);
    return record.slice(start, record.indexOf('\n}\n', start));
  };
  it('the record reads the waiting cancel, and a failed read holds the Cancel door back instead of guessing', () => {
    assert.match(page, /readPendingEnding\(id\)/);
    assert.match(page, /endingReadFailed: waiting\.failed/);
    assert.match(record, /&& !props\.ending && !props\.endingReadFailed/);
  });
  it('the callout offers Keep and End now only to a billing operator', () => {
    assert.match(record, /\{can\.billing && \([\s\S]{0,200}kind: 'keepPlan'[\s\S]{0,200}kind: 'endPlanNow'/);
  });
  it('Cancel waits for the date and drops "cannot be put back"; End now is a quiet red link inside it', () => {
    const cancel = fn('CancelWindow');
    assert.match(cancel, /'Cancel at the period end'/);
    assert.match(cancel, /Reaches Stripe\. Can be kept until/);
    assert.match(cancel, /End it today instead…/);
    assert.match(cancel, /notifyOwner: notify/);
    assert.doesNotMatch(cancel, /askWhy=\{false\}/);
  });
  it('End now is its own red window, typed Why required, the ruled sentence, and the endNow flag', () => {
    const endNow = fn('EndPlanNowWindow');
    assert.match(endNow, /danger/);
    assert.match(endNow, /Ends immediately\. No refund\. This cannot be put back\./);
    assert.match(endNow, /endNow: true/);
    assert.match(endNow, /This finishes it today instead/);
    assert.doesNotMatch(endNow, /askWhy=\{false\}/);
  });
  it('Keep the plan withdraws through the console DELETE with a typed Why', () => {
    const keep = fn('KeepPlanWindow');
    assert.match(keep, /'DELETE', \{ reason, notifyOwner: notify \}/);
    // Part C (G6 b): the owner hears of an operator's keep only when ticked — off by default, like Cancel's tick.
    assert.match(keep, /useState\(false\)[\s\S]*Email the owner that the plan renews on/);
    assert.doesNotMatch(keep, /askWhy=\{false\}|danger/);
  });
  it('a mock subscription id is not said to reach Stripe (lead 8: the old `!!id` read a mock as real)', () => {
    assert.match(record, /hasStripe=\{!!org\.stripeSubscriptionId\?\.startsWith\('sub_'\)\}/);
    assert.doesNotMatch(record, /hasStripe=\{!!org\.stripeSubscriptionId\}/);
  });
  it('a trial says it ends with the trial, not "the period you paid for" (review)', () => {
    assert.match(W.cancel.waitBody('Falcons', ['the pay page'], ENDS, 30, true), /when your trial ends/);
    assert.doesNotMatch(W.cancel.waitBody('Falcons', ['the pay page'], ENDS, 30, true), /paid for/);
    assert.match(W.cancel.waitBody('Falcons', ['the pay page'], ENDS, 30), /the end of the period you paid for/);
    assert.match(W.cancel.premiumWaitBody(ENDS, 30, true), /when your trial ends/);
  });
  it('the operator hears about a move that could not be put back in staff words, not the owner’s (review)', () => {
    assert.doesNotMatch(W.cancel.moveNotRestoredStaff('Club', 'Tournament Plus', ENDS), /Your plan/);
    assert.match(W.cancel.moveNotRestoredStaff('Club', 'Tournament Plus', ENDS), /they can choose it again/);
    assert.match(readCode('app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts'), /moveNotRestoredStaff/);
  });
});

// Plans end at the renewal date, Stage 2 Part B: the owner's page while a MOVE to the free plan waits (Stage 0 drawing
// "Moves to the free plan"; owner rulings 2026-11-04 — Move to Club absent, band colours as drawn, the gone words).
describe('the owner billing page while a move to the free plan waits (Stage 2 Part B)', () => {
  const T = (id: string, name: string) => ({ id, name });
  const moving = (move: Partial<NonNullable<NonNullable<BillingEnding['pending']>['move']>> = {}): BillingEnding => ({
    waits: true, endsOn: ENDS, pending: { endsAt: ENDS, heldMovePlan: null, kind: 'downgrade', move: {
      targetPlan: 'tournament', kept: [T('t-1', 'Spring Classic 2027')], archived: [T('t-2', 'Fall Invitational 2026')],
      fellBack: false, choose: true, keepIds: ['t-1'], since: '2026-10-20T12:00:00Z', ...move,
    } },
  });

  it('the plan card keeps Active and says the move, with ONE lime Keep button; no Ending chip, no renewal line', () => {
    const html = page('tournament_plus', moving());
    assert.ok(html.includes(W.plan.scheduled('Tournament', ENDS)), 'Moves to Tournament on March 1, 2027.');
    assert.doesNotMatch(html, />Ending</);
    assert.doesNotMatch(html, /Ends on March|Renews March/);
    assert.match(html, /btn btn-lime[^"]*"[^>]*>Keep Tournament Plus</);
  });

  it('the band names what stays and what goes, a tournament made before the date too, with the Change door', () => {
    const html = page('tournament_plus', moving());
    assert.match(html, /id="billing-move-band"/);
    assert.match(html, /On March 1, 2027/);
    assert.match(html, /You keep <strong>Spring Classic 2027<\/strong>\. Fall Invitational 2026 is archived then and kept for 90 days, so it can come back\. So is any other tournament you make before then\./);
    assert.ok(html.includes(W.downgrade.band.change));
    assert.match(html, /class="waitCallout moveBandFrame moveBand" id="billing-move-band"/, 'olive, not amber: it says what stays, it is not a warning');
  });

  it('no choice to make: no door (absent, not disabled)', () => {
    const html = page('tournament_plus', moving({ archived: [], choose: false }));
    assert.ok(!html.includes(W.downgrade.band.change));
    assert.match(html, /Any other tournament you make before then is archived then and kept for 90 days/);
  });

  it('the kept one gone, with a choice: the amber re-ask names the newest, without claiming why it went', () => {
    const html = page('tournament_plus', moving({ kept: [T('t-3', 'Winter Cup 2027')], archived: [T('t-2', 'Fall Invitational 2026')], fellBack: true }));
    assert.match(html, /class="waitCallout moveBandFrame " id="billing-move-band"/, 'the wait callout keeps its amber edge');
    assert.match(html, /The tournament you chose to keep is no longer a draft or active event, so choose the one you keep\. If you don’t choose by March 1, we keep Winter Cup 2027, your newest\./);
    assert.ok(html.includes(W.downgrade.band.choose));
    assert.doesNotMatch(html, /was deleted/);
  });

  it('every change door is ABSENT — Move to Club included — the Tournament row shows "From", and one line says why', () => {
    const html = page('tournament_plus', moving());
    assert.ok(html.includes(W.downgrade.waitingRefusal('tournament_plus', 'tournament', ENDS)));
    assert.doesNotMatch(html, /Downgrade to Tournament|Upgrade to|Move to Club|Contact us to move/);
    assert.ok(html.includes(W.plan.scheduledFrom(ENDS)));
  });

  it('Reduce or cancel STAYS while a move waits (a cancel replaces it — ruling 4)', () => {
    const html = page('tournament_plus', moving());
    assert.match(html, /Reduce or cancel/);
    assert.match(html, /billing-cancel-btn/);
  });
});

describe('the windows over a waiting move (source)', () => {
  const body = readCode('components/billing/BillingBody.tsx');
  it('the Downgrade window says its date, and with no paid period says it moves at the click', () => {
    assert.match(body, /W\.downgrade\.whenOn\(movesOn, ownProfile\.config\.label, trialing\)/);
    assert.match(W.downgrade.whenOn('2027-03-01T05:00:00Z', 'Tournament Plus', true), /when your trial ends/);
    assert.doesNotMatch(W.downgrade.whenOn('2027-03-01T05:00:00Z', 'Tournament Plus', true), /paid for|credited/, 'a trial paid for nothing');
    assert.match(body, /W\.downgrade\.noPeriod\(org\.name\)/);
    assert.match(body, /W\.downgrade\.confirmOn\(movesOn\)/);
    // The foot no longer repeats the date the button carries: it says what the button waits for, then what was chosen.
    assert.doesNotMatch(body, /movesFooter/);
    assert.match(body, /W\.downgrade\.pickNeeded/);
    assert.match(body, /W\.downgrade\.pickedFoot\(keptNames\)/);
    assert.match(body, /W\.downgrade\.rest\(downgrade\.retentionDays, movesOn, restNames\)/, 'the sentence after the choices is dated');
    assert.match(body, /moveDateLong\(movesOn\)/, 'Online payments stop on the date, not today');
    assert.match(body, /disabled=\{busy !== null \|\| moveDateMissing/, 'a missing date offers no confirm');
  });
  it('the success notice is a wait ("moves on {date}"), never "your plan is now"', () => {
    assert.match(body, /downgrade && result\.outcome === 'scheduled'\) \{\s*setNotice\(\{ tone: 'good', text: W\.move\.scheduled\(/);
  });
  it('Keep over a move says the move is called off; Cancel over a move says it replaces it', () => {
    assert.match(body, /W\.downgrade\.keepMoveOff\(/);
    assert.match(body, /W\.cancel\.replacesMove\(/);
  });
  it('Change which tournament you keep is a 520px form window over a fresh read, saved through its own route', () => {
    assert.match(body, /<KitDialog kind="form" title=\{P\.title\}/);
    assert.match(body, /post\('\/api\/billing\/downgrade\/preflight', \{ targetPlan: waitingMove\.move\.targetPlan \}\)/);
    assert.match(body, /post\('\/api\/billing\/downgrade\/pick', \{ keepTournamentIds: ids \}\)/);
  });
});

describe('the operator record says a waiting move as a move (source)', () => {
  const record = readCode('app/platform-admin/orgs/[id]/ClubRecord.tsx');
  it('the line, the band cell, the overdue callout, End now and Finish all branch on the kind', () => {
    assert.match(record, /<strong>Moving to \{props\.ending\.movesTo\}/);
    assert.match(record, /props\.ending\.movesTo \? 'Moves' : 'Ends'/);
    assert.match(record, /should have moved to/);
    assert.match(record, /Ending it now replaces that move\./);
    assert.match(record, /It is not suspended\./);
  });
  it('the record page passes the kind and the target', () => {
    const page_ = readCode('app/platform-admin/orgs/[id]/page.tsx');
    assert.match(page_, /movesTo: waiting\.intent\.intentType === 'downgrade' \? planLabel\(moveTargetOf\(waiting\.intent\)\) : null/);
  });
});
