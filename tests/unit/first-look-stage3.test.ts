/**
 * THE FIRST LOOK, STAGE 3 — the first screen inside (owner rulings 2026-10-19 Asks 4, 5b, 9; gate G1–G6 ruled
 * 2026-10-20, drawn at https://claude.ai/artifact/CtzAZMhmvnJZQxMTtn5xjj; plan docs/projects/archive/FIRST_LOOK_SIGNUP_PLAN.md).
 * The rules are exercised directly where they are pure; the wiring is pinned by source scans.
 */
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { filesUnder, readCode } from './_source-code.ts';
import { PLAN_CONFIG, formatPlanPeriodPrice, pickedPlanLabel } from '../../lib/plan-config.ts';
import { PAID_DOOR_PLANS, START_PATH_FOR_PLAN, parseStartPricing, runATournamentPick } from '../../lib/start-door.ts';

/** Every plan card in PricingSection's PLANS list, as `{ key, ctaHref }`, read from the source. */
function pricingCards(): { key: string; ctaHref: string }[] {
  const src = readCode('components/PricingSection.tsx');
  const start = src.indexOf('const PLANS: Plan[] = [');
  const list = src.slice(start, src.indexOf('\n];', start));
  return list.split(/\n  \{\n/).slice(1).map(block => ({
    key: /^\s*key: '([a-z_]+)'/m.exec(block)?.[1] ?? '',
    ctaHref: /^\s*ctaHref: '([^']+)'/m.exec(block)?.[1] ?? '',
  }));
}

describe('3a — the plan step (Ask 4, F07, F08; G3–G6)', () => {
  const step = readCode('app/[orgSlug]/admin/onboarding/PlanStep.tsx');

  it('G6 (rewritten in On-sale pages S2): every org plan card points at a door that sells it, whatever the gate says', () => {
    // The old guard read the code's copy of the gate (PLAN_CONFIG.gatingStatus), which production's live rows override:
    // a plan opened in platform admin would have sent its button to Run a tournament with this still green. Now the
    // card's link must be the door that sells its plan in BOTH gate states, and a closed card renders no link at all.
    const cards = pricingCards();
    assert.deepEqual(cards.map(c => c.key), ['tournament', 'tournament_plus', 'league', 'club', 'club_large'], 'the scan read every card');
    for (const card of cards) {
      const plan = card.key as keyof typeof START_PATH_FOR_PLAN;
      assert.equal(card.ctaHref, START_PATH_FOR_PLAN[plan], `${card.key}'s button opens the door that sells it`);
      const door = card.ctaHref === '/start/club' ? 'club' : card.ctaHref === '/start/league' ? 'league' : null;
      if (door) assert.ok((PAID_DOOR_PLANS[door] as readonly string[]).includes(card.key), `${card.ctaHref} sells ${card.key}`);
      else assert.ok(card.key === 'tournament' || card.key === 'tournament_plus', `Run a tournament sells only the two tournament plans, not ${card.key}`);
    }
    // Club · Association has its own card since on-sale pages S3 (W4); its door is Start a club's.
    assert.equal(START_PATH_FOR_PLAN.club_large, '/start/club');
    assert.match(readCode('components/PricingSection.tsx'), /\{isGated \? \(\s*<EarlyAccessModalTrigger/, 'a gated card renders no start link');
  });

  it('G4: the free pick is carried from the pricing page and named without a billing period', () => {
    assert.equal(pickedPlanLabel('tournament'), 'Tournament (free)');
    assert.equal(pickedPlanLabel('tournament_plus', 'annual'), 'Tournament Plus, billed annually');
    assert.equal(pickedPlanLabel('tournament_plus'), 'Tournament Plus, billed monthly');
    const free = parseStartPricing('tournament', 'monthly')!;
    assert.equal(pickedPlanLabel(free.plan, free.billing), 'Tournament (free)', 'whatever billing was sent');
    const ps = readCode('components/PricingSection.tsx');
    assert.match(ps, /if \(plan\.key === 'team'\) return plan\.ctaHref;\s*return withStartPricing\(plan\.ctaHref, parseStartPricing\(plan\.key, billing\)\);/);
    const form = readCode('app/(consumer)/start/StartDoorForm.tsx');
    assert.match(form, /const shownPick = copy\.pick\?\.of\(pricing\) \?\? null;/);
    assert.match(form, /pick: \{ of: runATournamentPick, confirmedAfter: 'your organization' \},/, 'Run a tournament names only its own two picks');
    assert.match(form, /\{shownPick && \(/, 'step 1 never names a pick the plan step would drop (F08)');
    assert.match(form, /<strong>\{pickedPlanLabel\(shownPick\.plan, shownPick\.billing\)\}<\/strong>, from/);
  });

  it('two choices only, the pick first and lit; one heading, said once', () => {
    assert.match(step, /type PlanStepChoice = 'tournament_plus' \| 'tournament';/);
    assert.match(step, /const pick = runATournamentPick\(pricing\);/, 'a pick it does not offer is no pick');
    assert.equal(runATournamentPick({ plan: 'club', billing: 'annual' }), null);
    assert.deepEqual(runATournamentPick({ plan: 'tournament' }), { plan: 'tournament' });
    // the free choice (a new organization's own plan) holds both buttons and says when it fails (/review)
    const choose = readCode('app/[orgSlug]/admin/onboarding/page.tsx');
    assert.match(choose, /if \(planKey === activePlan\) \{\s*setPlanLoading\(planKey\);\s*try \{/);
    assert.match(step, /\{first === 'tournament' \? <>\{freeCard\}\{plusCard\}<\/> : <>\{plusCard\}\{freeCard\}<\/>\}/, 'the pick comes first');
    assert.match(step, /<PlanStartButton lead=\{plan === first\}/, 'the one lime');
    assert.match(readCode('app/[orgSlug]/admin/onboarding/PlanStepParts.tsx'), /className=\{`\$\{lead \? accountForm\.primary : accountForm\.secondary\} \$\{styles\.start\}`\}/);
    assert.match(step, /title="How do you want to start\?"/);
    assert.doesNotMatch(step, /League Plus|'league'|'club'/);
    const page = readCode('app/[orgSlug]/admin/onboarding/page.tsx');
    assert.doesNotMatch(page, /renderPlanChooser\(true\)/, 'the required step never renders the marketing cards');
    // a Club owner still gets the club setup kit, before any plan step
    assert.match(page, /return userRole === 'owner' && isClubPlan\(currentOrg\?\.planId\) \? <ClubSetupKit \/> : <OnboardingPageLegacy \/>;/);
  });

  it('G5: every figure from plan-config; the price follows the choice', () => {
    assert.equal(formatPlanPeriodPrice('tournament_plus', 'monthly'), `$${PLAN_CONFIG.tournament_plus.monthlyPrice}/month`);
    assert.equal(formatPlanPeriodPrice('tournament_plus', 'annual'), `$${PLAN_CONFIG.tournament_plus.annualPrice}/year`);
    assert.match(step, /const monthly = formatPlanPeriodPrice\('tournament_plus', 'monthly'\);/);
    assert.match(step, /const plusPrice = billing === 'annual' \? annual : monthly;/);
    assert.match(step, /const plusNote = billing === 'annual' \? formatAnnualSavings\('tournament_plus'\) : null;/);
    assert.match(step, /\{ value: 'monthly', label: monthly \},/);
    assert.doesNotMatch(step, /\$\d{2,}/, 'no typed price');
  });

  it('G3: the bare first-run frame, two up from 900px wide, the 420px column below', () => {
    const css = readCode('app/[orgSlug]/admin/onboarding/PlanStep.module.css');
    assert.match(css, /\.column \{\s*width: 100%;\s*max-width: 420px;/);
    assert.match(css, /@media \(min-width: 900px\) \{\s*\.column \{ max-width: 900px;/);
    assert.match(step, /<ComparePlansLink \/>/);
    assert.match(readCode('app/[orgSlug]/admin/onboarding/PlanStepParts.tsx'), /<a href="\/pricing" target="_blank" rel="noopener noreferrer"/, 'Compare every plan opens the pricing page in a new tab');
  });
});

describe('3b — the welcome and checkout complete (Ask 5b, F06, F17; G1, G2)', () => {
  const card = readCode('components/consumer/CoachWelcomeCard.tsx');
  const complete = readCode('app/coaches/checkout/complete/page.tsx');
  const poll = readCode('app/coaches/checkout/complete/CheckoutProvisioning.tsx');

  it('G1: one welcome, with no dates sentence: the comped-coach welcome and its Founding rule are gone', () => {
    // /coaches/welcome was reached only through the Founding comp path; it is deleted, and so is the rule behind it.
    assert.equal(existsSync(join(process.cwd(), 'app/coaches/welcome/page.tsx')), false, 'the comped welcome page is gone');
    assert.equal(existsSync(join(process.cwd(), 'lib/founding-season.ts')), false, 'the Founding rule is gone');
    assert.doesNotMatch(card + complete, /[Ff]ounding|FOUNDING_SEASON/);
    // one welcome: the paid coach gets no second sentence; one lime, no arrow; the pill and the fine line are gone
    assert.doesNotMatch(card, /sub=\{foundingComp/);
    assert.match(card, /<Link href=\{href\} className=\{accountForm\.primary\}>Open your team<\/Link>/);
    assert.doesNotMatch(card, /→|promoPill|Opens your portal/);
    assert.match(complete, /<PremiumWelcome team=\{state\.team\}/);
  });

  it('G2: no payment at once; paid and waiting polls; ready IS the paid welcome with the portal’s ?success=1', () => {
    assert.match(complete, /if \(!sessionId\?\.startsWith\('cs_'\)\) return \{ kind: 'no_payment' \};/);
    assert.match(complete, /if \(\(error as \{ type\?: string \}\)\?\.type === 'StripeInvalidRequestError'\) return \{ kind: 'no_payment' \};/);
    // a COMPLETED checkout is a payment made, settled or not (a clearing bank debit waits, never "can't find") (/review)
    assert.match(complete, /if \(!checkout \|\| session\.status !== 'complete' \|\| !subscriptionId\) return \{ kind: 'no_payment' \};/);
    assert.doesNotMatch(complete, /payment_status/);
    assert.match(complete, /title="We can't find that payment" sub="If you've just paid, your portal link is on its way to your email\."/);
    assert.match(complete, /<PremiumWelcome team=\{state\.team\} href=\{`\/\$\{state\.orgSlug\}\/coaches\?success=1`\}/);
    assert.doesNotMatch(complete, /redirect\(/, 'the card turns into the welcome instead of redirecting past it');
    assert.match(poll, /const POLL_MS = 2500;/);
    assert.match(poll, /const MAX_ATTEMPTS = 20;/);
    assert.match(poll, /<WaitLine>Payment received\. This takes a few seconds\.<\/WaitLine>/);
    assert.match(poll, /title="Still setting up your portal"/);
    assert.doesNotMatch(poll, /Loader2|straight in/, 'the one loading line, no spinner; no "straight in" promise');
  });

  it('a server file takes the form’s classes from the stylesheet, never the client module’s re-export (caught in walk §355)', () => {
    // AccountForm.tsx is 'use client': a server component that reads its `accountForm` export gets a client reference,
    // not the class map, so every class renders bare (the welcome and checkout complete did, until the walk).
    const offenders: string[] = [];
    for (const rel of [...filesUnder('app', '.tsx'), ...filesUnder('components', '.tsx')]) {
      const src = readCode(rel);
      if (/^\s*['"]use client['"]/.test(src)) continue;
      if (/import \{[^}]*\baccountForm\b[^}]*\} from '@\/components\/auth\/AccountForm'/.test(src)) offenders.push(rel);
    }
    assert.deepEqual(offenders, [], `import accountForm from '@/components/auth/AccountForm.module.css' instead`);
  });

  it('both routes in the app’s warm frame, never the marketing chrome', () => {
    assert.match(readCode('lib/consumer-routes.ts'), /WARM_JOURNEY_PREFIXES = \[[^\]]*'\/coaches\/checkout'/);
    assert.match(readCode('app/coaches/checkout/layout.tsx'), /return <CoachJourneyChrome>\{children\}<\/CoachJourneyChrome>;/);
    assert.match(card, /<StartColumn pageClassName=\{pageClassName\}>/, 'the one start column; the optional class is only the paid doors’ first-run frame (S2)');
  });
});

describe('3c — a fan’s Home (Ask 9, F18)', () => {
  it('one quiet line under the empty sentence, to /start, and only when Home is empty', () => {
    const home = readCode('components/consumer/HomePersonalization.tsx');
    const empty = home.slice(home.indexOf('{signedInEmpty && ('));
    assert.match(empty, /^\{signedInEmpty && \(\s*<>\s*<p className=\{styles\.quietEmpty\}>[\s\S]*?<\/p>[^<]*<Link href="\/start" className=\{styles\.startLine\}>Want to run your own\? Start a team or a tournament<\/Link>/);
    assert.match(home, /const signedInEmpty =\s*loaded && signedIn && !waiting &&/, 'never beside a waiting workspace');
    assert.match(readCode('components/consumer/HomePersonalization.module.css'), /\.startLine \{[^}]*min-height: 44px;/);
  });
});
