/**
 * THE PAID DOORS, BOTH GATE STATES (On-sale pages S2, 2026-11-19; plan docs/projects/active/CLUB_ON_SALE_PAGES_PLAN.md
 * S2, traps A to D). Dev's rows have every plan on sale (owner ruling 2026-10-30), so the closed state is proved here with
 * the gate mocked as production holds it. The pages and the plan step are the shipped TSX rendered by React
 * (tests/unit/_billing-test-loader.ts); the gate, the session and navigation are the only inputs mocked. The money path
 * itself (checkout → webhook → the wait) is exercised on dev in Stripe test mode, not here.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { billingTestLoader } from './_billing-test-loader.ts';
import { readCode } from './_source-code.ts';
import {
  PAID_DOOR_PLANS, START_DOOR_PATH, WAITING_WORKSPACE, paidDoorOpen, paidDoorPick, parseStartPaidPlan, parseStartPricing,
  readStartDoor, startPlanSetupDecision, trialDaysAfterHistory, type StartPlanOffer,
} from '../../lib/start-door.ts';
import { planTrialLine } from '../../lib/plan-trial-line.ts';
import { PLAN_BILLING_WORDS } from '../../lib/plan-billing-words.ts';
import { gatedPlanSentence, GATED_PLAN_INTEREST_LINE, PLAN_AVAILABILITY_LINE } from '../../lib/plan-config.ts';
import { LEGAL_PAGES_PUBLISHED } from '../../lib/legal-pages-switch.ts';

/** Production until the flip, and dev's rows. */
const PRODUCTION = { tournament: false, team: false, tournament_plus: false, league: true, club: true, club_large: true };
const ALL_OPEN = { tournament: false, team: false, tournament_plus: false, league: false, club: false, club_large: false };
const AVAILABILITY = 'Available to organizations in Canada, outside Québec for now. Prices are in Canadian dollars.';

const decode = (html: string) => html
  .replaceAll('&#x27;', "'").replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
const text = (html: string) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');

class Redirected extends Error {
  to: string;
  constructor(to: string) { super(`redirect ${to}`); this.to = to; }
}

/** A start page, signed out, with the door open or closed. */
function loaderFor(open: boolean, extra: Record<string, unknown> = {}) {
  return billingTestLoader({
    '@/lib/supabase-server': { createClient: async () => ({}), getAuthUserCached: async () => null },
    '@/lib/two-step-session': { getSignedInUser: async () => null },
    '@/lib/platform-auth': { isPlatformAdminEmail: async () => false },
    '@/lib/start-plan-server': { isPaidDoorOpen: async () => open, paidDoorRedirect: async () => null },
    '@/lib/start-door-server': { startStepViewer: async () => null },
    '@/lib/plan-gating-server': { isCoachesPortalPurchasable: async () => true, getPlanGatingMap: async () => (open ? ALL_OPEN : PRODUCTION) },
    'next/navigation': {
      redirect: (to: string) => { throw new Redirected(to); },
      useRouter: () => ({ push() {}, refresh() {}, replace() {} }),
      useSearchParams: () => new URLSearchParams(),
      usePathname: () => '/',
    },
    ...extra,
  });
}

async function renderPage(file: string, open: boolean, searchParams: Record<string, string> = {}, extra: Record<string, unknown> = {}) {
  const page = (loaderFor(open, extra)(file) as { default: (p: unknown) => Promise<ReactElement> }).default;
  return text(renderToStaticMarkup(await page({ searchParams: Promise.resolve(searchParams) })));
}

describe('the door rules (lib/start-door.ts), in both gate states', () => {
  it('a paid door opens with its plan: Start a club with EITHER Club band, Start a league season with League Plus', () => {
    assert.equal(paidDoorOpen(PRODUCTION, 'club'), false);
    assert.equal(paidDoorOpen(PRODUCTION, 'league'), false);
    assert.equal(paidDoorOpen(ALL_OPEN, 'club'), true);
    assert.equal(paidDoorOpen(ALL_OPEN, 'league'), true);
    assert.equal(paidDoorOpen({ ...PRODUCTION, club_large: false }, 'club'), true, 'Club · Association alone opens the club door');
    assert.equal(paidDoorOpen({ ...PRODUCTION, club: false }, 'league'), false, 'Club opening never opens League Plus');
    assert.equal(paidDoorOpen({}, 'club'), false, 'a plan missing from the gate reads as closed');
  });

  it('each paid door sells only its own plans, and a pick it cannot sell reads as none', () => {
    assert.deepEqual(PAID_DOOR_PLANS, { club: ['club', 'club_large'], league: ['league'] });
    assert.deepEqual(paidDoorPick('club', parseStartPricing('club_large', 'annual')), { plan: 'club_large', billing: 'annual' });
    assert.equal(paidDoorPick('club', parseStartPricing('league', 'monthly')), null);
    assert.equal(paidDoorPick('league', parseStartPricing('tournament_plus', 'monthly')), null);
    assert.equal(paidDoorPick('club', parseStartPricing('tournament', undefined)), null);
    assert.equal(parseStartPaidPlan('tournament_plus'), null);
    assert.equal(parseStartPaidPlan('club_large'), 'club_large');
  });

  it('the account remembers a paid door with its pick (screens only), and Home names the club door', () => {
    assert.deepEqual(readStartDoor({ start: { door: 'club', plan: 'club', billing: 'annual' } }), { door: 'club', pricing: { plan: 'club', billing: 'annual' } });
    assert.deepEqual(readStartDoor({ start: { door: 'club', plan: 'tournament_plus', billing: 'annual' } }), { door: 'club' });
    assert.deepEqual(readStartDoor({ start: { door: 'league', plan: 'league', billing: 'monthly' } }), { door: 'league', pricing: { plan: 'league', billing: 'monthly' } });
    assert.equal(START_DOOR_PATH.club, '/start/club');
    assert.deepEqual(WAITING_WORKSPACE.club, { kind: 'organization', badge: 'Not named yet', title: 'Your club', action: 'Name your club' });
  });
});

describe('trap B — the trial the plan step shows is the one checkout gives', () => {
  it('one rule: the configured trial for a first purchase, none for a returning customer', () => {
    assert.equal(trialDaysAfterHistory(90, false), 90);
    assert.equal(trialDaysAfterHistory(90, true), 0);
    assert.equal(trialDaysAfterHistory(0, false), 0);
  });

  it('checkout and the plan step both ask it; the step never reads the code value for its trial line', () => {
    const checkout = readCode('app/api/billing/create-checkout/route.ts');
    assert.match(checkout, /const trialDays = trialDaysAfterHistory\(mergedConfig\.trialDays, returning\);/);
    const server = readCode('lib/start-plan-server.ts');
    assert.match(server, /getPlanConfigOverrides\(\),/);
    assert.match(server, /trialDaysAfterHistory\(overrides\[plan\]\.trialDays, returning\)/, 'the override checkout reads, not PLAN_CONFIG');
    const step = readCode('app/[orgSlug]/admin/onboarding/PaidPlanStep.tsx');
    assert.doesNotMatch(step, /planTrialLine\(config\.trialDays|planTrialLine\(PLAN_CONFIG/);
  });

  const offer = (trialDays: number | null, returning: boolean | null = trialDays === null ? null : trialDays === 0): StartPlanOffer => ({
    door: 'club', startPlan: 'club', cards: [{ plan: 'club', trialDays, returning }, { plan: 'club_large', trialDays, returning }],
  });
  function renderStep(o: StartPlanOffer, pricing: unknown = null) {
    const load = billingTestLoader({ '@/components/legal/LegalLinksProvider': { useLegalLinks: () => null } });
    const Step = (load('app/[orgSlug]/admin/onboarding/PaidPlanStep.tsx') as { default: (p: Record<string, unknown>) => ReactElement }).default;
    return text(renderToStaticMarkup(createElement(Step, {
      orgName: 'Milton Minor Baseball Association', offer: o, pricing, loading: null, error: '', onChoose() {},
    })));
  }

  it('a first purchase: both cards state the server\'s trial and offer the trial button', () => {
    const page = renderStep(offer(90));
    assert.ok(page.includes('How many teams will have a Premium Coaches Portal?'));
    assert.ok(page.includes('Rep, select, all-star: whatever your club calls them. House league teams are unlimited.'));
    assert.equal(page.split(planTrialLine(90)).length - 1, 2, 'the trial sentence on each card');
    assert.ok(page.includes('Start your Club trial') && page.includes('Start your Club · Association trial'));
    assert.ok(page.includes('Premium Coaches Portal for every coach on up to 15 teams, no per-team fee'));
    assert.ok(page.includes('Unlimited house league teams'));
    assert.ok(page.includes('Premium Coaches Portal for every coach on 16 to 30 teams'));
  });

  it('a returning customer is told before checkout there is no second trial, and no button promises one', () => {
    const page = renderStep(offer(0));
    assert.ok(!page.includes('-day trial'), 'no trial sentence');
    assert.ok(page.includes(PLAN_BILLING_WORDS.clubUpgrade.noTrial));
    assert.ok(!page.includes('trial</') && !/Start your Club trial/.test(page));
    assert.ok(page.includes('Start Club') && page.includes('Start Club · Association'));
  });

  it('an unread history claims nothing either way, on the card or the button', () => {
    const page = renderStep(offer(null));
    assert.ok(!page.includes('-day trial') && !page.includes(PLAN_BILLING_WORDS.clubUpgrade.noTrial));
    assert.ok(!/Start your Club trial/.test(page) && page.includes('Start Club'));
  });

  it('a plan whose trial is set to none never tells a new club it had a subscription before (/review)', () => {
    const page = renderStep(offer(0, false));
    assert.ok(!page.includes(PLAN_BILLING_WORDS.clubUpgrade.noTrial) && !page.includes('-day trial'));
  });

  it('the pricing page\'s pick leads; League Plus is one card under its own heading', () => {
    const picked = renderStep(offer(90), { plan: 'club_large', billing: 'annual' });
    assert.ok(picked.includes('You picked Club · Association, billed annually on the pricing page.'));
    assert.ok(picked.indexOf('Club · Association') < picked.indexOf('on up to 15 teams'), 'the pick comes first');
    const league = renderStep({ door: 'league', startPlan: 'league', cards: [{ plan: 'league', trialDays: 30, returning: false }] });
    assert.ok(league.includes('Start League Plus') && league.includes(planTrialLine(30)));
    assert.ok(league.includes('starts on League Plus. You manage it in Plan & billing.'));
  });
});

describe('trap A — the return from Stripe waits for the plan, never opens New tournament', () => {
  const org = { id: 'org-1', planId: 'tournament', stripeSubscriptionId: null };
  const paid = { orgId: 'org-1', status: 'complete', subscriptionId: 'sub_1' };

  it('says no payment at once for a checkout that is not this organization\'s completed one', () => {
    assert.equal(startPlanSetupDecision({ ...paid, orgId: 'org-2' }, org), 'no_payment');
    assert.equal(startPlanSetupDecision({ ...paid, status: 'open' }, org), 'no_payment');
    assert.equal(startPlanSetupDecision({ ...paid, subscriptionId: null }, org), 'no_payment');
  });

  it('waits while the organization still reads Tournament, and is ready once THIS subscription and a paid plan land', () => {
    assert.equal(startPlanSetupDecision(paid, org), 'setting_up');
    assert.equal(startPlanSetupDecision(paid, { ...org, planId: 'club', stripeSubscriptionId: 'sub_other' }), 'setting_up');
    assert.equal(startPlanSetupDecision(paid, { ...org, planId: 'club', stripeSubscriptionId: 'sub_1' }), 'ready');
    assert.equal(startPlanSetupDecision(paid, { ...org, planId: 'league', stripeSubscriptionId: 'sub_1' }), 'ready');
  });

  it('a door\'s checkout returns to the wait with Stripe\'s session, and backing out returns to the same plan step', () => {
    const server = readCode('lib/start-plan-server.ts');
    assert.match(server, /return `\/\$\{orgSlug\}\/admin\/onboarding\?setup=1&door=\$\{door\}&session_id=\{CHECKOUT_SESSION_ID\}`;/);
    assert.match(server, /return `\/\$\{orgSlug\}\/admin\/onboarding\?choosePlan=1`;/);
    const checkout = readCode('app/api/billing/create-checkout/route.ts');
    assert.match(checkout, /success_url: doorCheckout \? `\$\{appUrl\}\$\{successReturnTo\}` : appendSuccess/, 'no success=1 on a door return');
    assert.match(checkout, /cancel_url: `\$\{appUrl\}\$\{cancelReturnTo\}`/);
  });

  it('the onboarding page shows the wait on that return, and the New tournament window never opens on it', () => {
    const page = readCode('app/[orgSlug]/admin/onboarding/page.tsx');
    assert.match(page, /planChoiceRequired \|\|\s*setupReturn \|\|/, 'the New tournament effect stops on a door return');
    assert.match(page, /if \(setupReturn && currentOrg\.planId === 'tournament'\) \{/);
    const wait = readCode('app/[orgSlug]/admin/onboarding/StartPlanSetup.tsx');
    assert.match(wait, /window\.location\.replace\(`\/\$\{orgSlug\}\/admin\/onboarding`\)/, 'a full request, so the layouts read the new plan');
    assert.ok(wait.includes('Payment received. This takes a few seconds.') && wait.includes('We can’t find that payment'));
  });
});

describe('the abandoned checkout resumes on its own plan step', () => {
  it('the organization remembers the plan it came to buy, read only while it is still free', () => {
    const create = readCode('app/api/org/create/route.ts');
    assert.match(create, /\.update\(\{ start_plan: startPlan \}\)/);
    const server = readCode('lib/start-plan-server.ts');
    assert.match(server, /if \(org\.ownPlanId !== 'tournament'\) return null;/);
    const page = readCode('app/[orgSlug]/admin/onboarding/page.tsx');
    assert.match(page, /\) : paidOffer \? \(\s*<PaidPlanStep/, 'the plan step is the door\'s when the organization has one');
    assert.match(page, /if \(!startOfferRead\) return null;/, 'a club buyer never sees Run a tournament\'s cards first');
    assert.match(page, /if \(startOfferFailed\) \{/, 'a failed read is said, never read as "no door" (/review)');
  });

  it('a signed-in owner lands on that plan step (no tournament, no plan chosen → choosePlan)', () => {
    assert.match(readCode('lib/user-contexts.ts'), /: `\/\$\{slug\}\/admin\/onboarding\?choosePlan=1`;/);
  });
});

describe('trap C — Québec and the US are said on step 1, before anything is made', () => {
  it('both paid doors carry the ruled availability line where step 1\'s small print sits', () => {
    const form = readCode('app/(consumer)/start/StartDoorForm.tsx');
    // One sentence, shared since S3 with the /pricing bands and home's price rows (`PLAN_AVAILABILITY_LINE`).
    assert.ok(form.includes('PLAN_AVAILABILITY_LINE as AVAILABILITY_LINE'));
    assert.equal(PLAN_AVAILABILITY_LINE, AVAILABILITY);
    assert.equal((form.match(/accountSmallPrint: AVAILABILITY_LINE,/g) ?? []).length, 2);
    assert.ok(readCode('docs/agents/strategy/BUSINESS_DECISIONS.md').includes(AVAILABILITY), 'one spelling with the ruling (Ask 9)');
  });
});

describe('trap D — who the doors send elsewhere', () => {
  it('the page gates run before step 2: owners to their organization, invitations to Home, a Premium coach to their portal', () => {
    const server = readCode('lib/start-plan-server.ts');
    assert.match(server, /if \(isStaff\) return '\/platform-admin';\s*if \(inRealOrg\) \{\s*return \(await ownedOrganizationDoorDestination\(user\.id\)\) \?\? getAuthDestination\(\);\s*\}\s*if \(liveInvitation\) return '\/discover';\s*if \(portal\) return `\/\$\{portal\.orgSlug\}\/coaches\/billing`;/);
    assert.match(server, /door === 'club' \? getActiveOwnedTeamWorkspace/, 'only Start a club turns a coach away (their team would be stranded)');
    assert.match(server, /if \(owned\.plan_id === 'tournament' && \(await readStartPlan\(owned\.id\)\)\) return startPlanCancelPath\(owned\.slug\);/);
    for (const file of ['app/(consumer)/start/club/page.tsx', 'app/(consumer)/start/league/page.tsx']) {
      assert.match(readCode(file), /const elsewhere = await paidDoorRedirect\(\{ id: user\.id, email: user\.email \}, '(club|league)'\);\s*if \(elsewhere\) redirect\(elsewhere\);/, file);
    }
  });

  it('the server holds the same lines when the page is bypassed', () => {
    const create = readCode('app/api/org/create/route.ts');
    assert.match(create, /if \(await userBelongsToOtherRealOrg\(user\.id\)\) \{/);
    assert.match(create, /if \(!\(await isPaidDoorOpen\(paidDoor\)\)\) \{/);
    assert.match(create, /code: 'start_club_in_place',/);
  });
});

describe('no comp on a paid door (Ask 14; the Founding Season itself was removed, Stage 2b)', () => {
  it('no organization a paid door makes is granted a comp, and no door locks an offer', () => {
    assert.doesNotMatch(readCode('app/api/org/create/route.ts'), /Founding|foundingSeasonOfferFor|comp_period/);
    assert.doesNotMatch(readCode('app/api/auth/signup/route.ts'), /Founding|lockStartDoorOrUndo/);
  });
});

describe('a sale without the Terms fails visibly (`/legal` S2 review)', () => {
  it('checkout refuses the three paid-door plans on a live key while the legal pages are off', () => {
    assert.match(readCode('app/api/billing/create-checkout/route.ts'),
      /if \(isStartPaidPlan\(planKey\) && legalPagesMode\(\) === 'off' && !stripeKeyIsTest\(process\.env\.STRIPE_SECRET_KEY\)\) \{/);
  });

  it('the legal pages cannot be switched off while the paid doors exist', () => {
    const doorsExist = readCode('app/(consumer)/start/StartPaidDoorForm.tsx').length > 0;
    assert.ok(doorsExist);
    assert.equal(LEGAL_PAGES_PUBLISHED, true, 'the paid doors take money: switching the Terms off would sell with no tick and no record');
  });
});

describe('the start pages, rendered in both gate states', () => {
  it('/start/club closed is S1\'s interest page, word for word', async () => {
    const page = await renderPage('app/(consumer)/start/club/page.tsx', false);
    assert.ok(page.includes('Explore Club'));
    assert.ok(page.includes(`${gatedPlanSentence('club')} ${GATED_PLAN_INTEREST_LINE}`));
    assert.ok(!page.includes('Create account'));
  });

  it('/start/club open, signed out, is step 1 of Start a club', async () => {
    const page = await renderPage('app/(consumer)/start/club/page.tsx', true, { plan: 'club', billing: 'monthly' });
    assert.ok(page.includes('Start a club'));
    assert.ok(page.includes('Create your account, name your club, then choose Club or Club · Association.'));
    assert.ok(page.includes('Club, billed monthly') && page.includes('after naming your club'));
    assert.ok(page.includes(AVAILABILITY));
    assert.ok(page.includes('Account') && page.includes('Club') && page.includes('Plan'));
    assert.ok(!page.includes('Express interest'));
  });

  it('/start/league: League Plus open is its start; closed is the interest page', async () => {
    const open = await renderPage('app/(consumer)/start/league/page.tsx', true);
    assert.ok(open.includes('Create your account, name your league, then start League Plus.'));
    assert.ok(open.includes(AVAILABILITY) && !open.includes('up to 8 teams'));
    const closed = await renderPage('app/(consumer)/start/league/page.tsx', false);
    assert.ok(closed.includes(`${gatedPlanSentence('league')} ${GATED_PLAN_INTEREST_LINE}`));
  });

  it('/start shows Start a club and the League Plus card only while their plan is on sale', async () => {
    const open = await renderPage('app/(consumer)/start/page.tsx', true);
    assert.ok(open.includes('Start a club') && open.includes('Start a league season'));
    // No Free / Paid pill on any door (owner 2026-11-19): the price talk lives in the card's sentence.
    assert.ok(!open.includes('Paid plan') && !open.includes('Free plan'));
    const closed = await renderPage('app/(consumer)/start/page.tsx', false);
    assert.ok(!closed.includes('Start a club') && !closed.includes('Start a league season') && !closed.includes('Paid plan'));
  });
});
