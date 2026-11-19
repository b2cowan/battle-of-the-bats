/**
 * Every public plan page, rendered in BOTH gate states (on-sale pages S1, 2026-11-18). Dev's rows have every plan on
 * sale (owner ruling 2026-10-30), so dev cannot show the closed state from its rows: the closed state is proved here
 * with the gate mocked as production holds it, and walked on dev with the plan-gates toggle's "show as closed".
 *
 * The page code is the shipped TSX, rendered by React (tests/unit/_billing-test-loader.ts adapts only CSS modules,
 * next/link and the modules overridden below). The gate and checkout's trial length are the only inputs mocked.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { billingTestLoader } from './_billing-test-loader.ts';
import {
  PLAN_CONFIG, gatedPlanSentence, GATED_PLAN_INTEREST_LINE, isPlanOpen, interestButtonLabel,
  closedPlansGroupTag, availableNowSentence,
} from '../../lib/plan-config.ts';
import { BILLING_TAX_WORDS } from '../../lib/billing-tax.ts';
import { planTrialLine, clubTrialLine } from '../../lib/plan-trial-line.ts';
import type { OrgPlan } from '../../lib/types.ts';

type Gating = Record<OrgPlan, boolean>;
/** Production until the flip: the three programme plans closed, everything else on sale. */
const PRODUCTION: Gating = { tournament: false, team: false, tournament_plus: false, league: true, club: true, club_large: true };
/** Dev's rows (all on sale). */
const ALL_OPEN: Gating = { tournament: false, team: false, tournament_plus: false, league: false, club: false, club_large: false };
/** Premium closed too (the code's branch for a re-closed coach checkout). */
const PREMIUM_CLOSED: Gating = { ...PRODUCTION, team: true };

const TP_TRIAL_DAYS = 14;

function loaderFor(gating: Gating) {
  return billingTestLoader({
    // The pricing grid asks the browser who is signed in; a prospect is signed out.
    '@/lib/use-client-signed-in': { useClientSignedIn: () => false },
    '@/lib/plan-gating-server': {
      getPlanGatingMap: async () => gating,
      isCoachesPortalPurchasable: async () => !gating.team,
    },
    '@/lib/plan-config-db': {
      getPlanConfigOverride: async (plan: OrgPlan) => ({
        tournamentLimit: PLAN_CONFIG[plan].tournamentLimit, seatLimit: PLAN_CONFIG[plan].seatLimit,
        trialDays: plan === 'tournament_plus' ? TP_TRIAL_DAYS : PLAN_CONFIG[plan].trialDays,
      }),
    },
  });
}

const decode = (html: string) => html
  .replaceAll('&#x27;', "'").replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>')
  .replace(/<!-- -->/g, '');
/** The text a visitor reads (tags out, whitespace collapsed). */
const text = (html: string) => decode(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

async function render(file: string, gating: Gating): Promise<string> {
  const page = (loaderFor(gating)(file) as { default: () => Promise<ReactElement> }).default;
  return text(renderToStaticMarkup(await page()));
}

const RETIRED = [
  /early[ -]access/i, /in (active )?development/i, /finishing its final workflows/i, /while we finish/i, /next parts of the platform/i,
  /plan ahead and express interest/i, /path into the roadmap/i, /with everything (you|they)[’']ve built/i, /Free right now/,
  /Start Tournament Plus free/, /Most organizations are running/, /\bused by\b/, /\b8am\b/,
];

const PAGES = [
  'app/pricing/page.tsx', 'app/for-clubs/page.tsx', 'app/for-leagues/page.tsx', 'app/for-coaches/page.tsx',
  'app/for-tournament-organizers/page.tsx',
];

describe('the public plan pages, closed (as production) and open (as dev)', () => {
  for (const file of PAGES) {
    for (const [name, gating] of [['production', PRODUCTION], ['all open', ALL_OPEN], ['Premium closed', PREMIUM_CLOSED]] as const) {
      it(`${file} (${name}) types no retired framing`, async () => {
        const page = await render(file, gating);
        for (const re of RETIRED) assert.doesNotMatch(page, re, `${file} (${name}) says ${re}`);
      });
    }
  }

  it('/pricing, closed: the hero, the bridges, the strip and the bottom say each plan’s one sentence (W6, W8, W11, W12, W21)', async () => {
    const page = await render('app/pricing/page.tsx', PRODUCTION);
    assert.ok(page.includes('Tournament, Tournament Plus, and the Premium Coaches Portal are available now. Tournament is free, with no credit card required. Club is coming soon, and League Plus is built but not open for sign-up.'), 'W8');
    assert.ok(page.includes(`${gatedPlanSentence('league')} ${GATED_PLAN_INTEREST_LINE}`), 'W11');
    assert.ok(page.includes(`${gatedPlanSentence('club')} ${GATED_PLAN_INTEREST_LINE}`), 'W12');
    assert.ok(page.includes(interestButtonLabel(['league', 'club'])), 'the interest door stays while closed');
    assert.ok(page.includes('If your organization moves to Club later, you won\'t be charged for the portal again.'), 'W22');
  });

  it('/pricing and /for-tournament-organizers: "Start Tournament Plus" with Tournament Plus’s trial sentence, tax inside (W73, Asks 8 + 31)', async () => {
    const sentence = `${TP_TRIAL_DAYS}-day trial — you add a payment method at checkout, and you’re first charged, ${BILLING_TAX_WORDS.plusTax}, when the trial ends.`;
    assert.equal(planTrialLine(TP_TRIAL_DAYS), sentence);
    for (const file of ['app/pricing/page.tsx', 'app/for-tournament-organizers/page.tsx']) {
      const page = await render(file, PRODUCTION);
      assert.ok(page.includes('Start Tournament Plus'), file);
      assert.ok(page.includes(sentence), `${file} says the trial with checkout's length`);
    }
  });

  it('/pricing: the three answers claim no customers, and the sports answer names only the offered sports (W72)', async () => {
    const page = await render('app/pricing/page.tsx', PRODUCTION);
    assert.ok(page.includes('FieldLogicHQ is built for associations where the "tech person" is whoever stepped up at the last AGM.'));
    assert.ok(page.includes('Yes, for softball and baseball.'));
    assert.doesNotMatch(page, /hockey|soccer/i);
  });

  it('/for-clubs, closed: the canon sentence, the tag from the helper, the bring-in fact (W23, W25, W29, W30)', async () => {
    const page = await render('app/for-clubs/page.tsx', PRODUCTION);
    assert.ok(page.includes('Coming soon — it isn\'t open for sign-up yet.'), 'W23');
    assert.ok(page.includes(`${gatedPlanSentence('club')} ${GATED_PLAN_INTEREST_LINE}`), 'W25');
    assert.ok(page.includes('a coach with a standalone portal won’t be charged for it again'), 'W29');
    assert.ok(page.includes(`${GATED_PLAN_INTEREST_LINE} Running a tournament now? Start free today.`), 'W30');
    assert.ok(page.includes('See the Coaches Portal'), 'the Coaches Portal cross-sell follows the Premium gate');
  });

  it('/for-leagues, closed: the Coaches Portal cross-sell reads the Premium gate; the clock is one form (W35, W36, W74)', async () => {
    const open = await render('app/for-leagues/page.tsx', PRODUCTION);
    assert.ok(open.includes('See the Coaches Portal'), 'Premium on sale → the link');
    assert.ok(!open.includes(interestButtonLabel(['team'])));
    const closed = await render('app/for-leagues/page.tsx', PREMIUM_CLOSED);
    assert.ok(closed.includes(interestButtonLabel(['team'])), 'Premium closed → the interest door');
    assert.ok(open.includes(`${GATED_PLAN_INTEREST_LINE} Running a tournament now? Start free today.`), 'W36');
    assert.ok(open.includes('8:00 a.m. on a Saturday'), 'W74');
  });

  it('/for-coaches: no tag over Premium when it is on sale; its own tag when closed (W73)', async () => {
    const open = await render('app/for-coaches/page.tsx', PRODUCTION);
    assert.ok(!open.includes('Coming soon'));
    const closed = await render('app/for-coaches/page.tsx', PREMIUM_CLOSED);
    assert.ok(closed.includes('Coming soon'));
    assert.ok(closed.includes(GATED_PLAN_INTEREST_LINE));
  });
});

describe('the one answer and the availability words', () => {
  it('isPlanOpen reads the inversion once; a plan missing from the map reads closed', () => {
    assert.equal(isPlanOpen(PRODUCTION, 'club'), false);
    assert.equal(isPlanOpen(PRODUCTION, 'team'), true);
    assert.equal(isPlanOpen({}, 'team'), false);
  });

  it('the group tag: one closed plan wears its own, two wear the group heading, none renders nothing (W6)', () => {
    assert.equal(closedPlansGroupTag({ league: true, club: true }), 'Not open yet');
    assert.equal(closedPlansGroupTag({ league: false, club: true }), 'Coming soon');
    assert.equal(closedPlansGroupTag({ league: true, club: false }), 'Not open yet');
    assert.equal(closedPlansGroupTag({ league: false, club: false }), null);
  });

  it('the available-now sentence lists only open plans, from the gate', () => {
    const three: OrgPlan[] = ['tournament', 'tournament_plus', 'team'];
    assert.equal(availableNowSentence(PRODUCTION, three), 'Tournament, Tournament Plus, and the Premium Coaches Portal are available now.');
    assert.equal(availableNowSentence(PREMIUM_CLOSED, three), 'Tournament and Tournament Plus are available now.');
    assert.equal(availableNowSentence(PREMIUM_CLOSED, ['team']), null);
  });

  it('the interest button names the plans it covers', () => {
    assert.equal(interestButtonLabel(), 'Express interest');
    assert.equal(interestButtonLabel(['league', 'club']), 'Express interest in League Plus or Club');
    assert.equal(interestButtonLabel(['team']), 'Express interest in the Coaches Portal');
  });

  it('the trial sentence is one function for every plan (Club keeps its name for its callers)', () => {
    assert.equal(clubTrialLine(), planTrialLine(PLAN_CONFIG.club.trialDays));
    assert.ok(planTrialLine(30).includes(`, ${BILLING_TAX_WORDS.plusTax}, when the trial ends.`), 'Ask 8 (b)');
    assert.doesNotMatch(planTrialLine(30), /free/i);
  });

  it('Premium’s code value agrees with production (Ask 18); the other three stay closed until after the flip', () => {
    assert.equal(PLAN_CONFIG.team.gatingStatus, 'live');
    for (const plan of ['league', 'club', 'club_large'] as const) assert.equal(PLAN_CONFIG[plan].gatingStatus, 'early_access');
  });
});

describe('the gate reader: dev’s "show as closed", never touching the rows', () => {
  async function readWith(cookie: string | undefined, rows: Array<{ plan_key: string; gating_status: string }>) {
    const before = { toggle: process.env.NEXT_PUBLIC_DEV_PLAN_GATES_TOGGLE, gates: process.env.NEXT_PUBLIC_PLAN_GATES };
    process.env.NEXT_PUBLIC_DEV_PLAN_GATES_TOGGLE = 'true';
    delete process.env.NEXT_PUBLIC_PLAN_GATES;
    let connected = false;
    try {
      const mod = billingTestLoader({
        'next/headers': { cookies: async () => ({ get: () => (cookie ? { value: cookie } : undefined) }) },
        'next/server': { connection: async () => { connected = true; } },
        './supabase-admin': { supabaseAdmin: { from: () => ({ select: async () => ({ data: rows, error: null }) }) } },
      })('lib/plan-gating-server.ts') as { getPlanGatingMap: () => Promise<Gating> };
      const map = await mod.getPlanGatingMap();
      return { map, connected };
    } finally {
      if (before.toggle === undefined) delete process.env.NEXT_PUBLIC_DEV_PLAN_GATES_TOGGLE; else process.env.NEXT_PUBLIC_DEV_PLAN_GATES_TOGGLE = before.toggle;
      if (before.gates === undefined) delete process.env.NEXT_PUBLIC_PLAN_GATES; else process.env.NEXT_PUBLIC_PLAN_GATES = before.gates;
    }
  }
  const devRows = (['tournament', 'team', 'tournament_plus', 'league', 'club', 'club_large'] as const).map(plan_key => ({ plan_key, gating_status: 'live' }));

  it('follows the rows by default, and asks for a request first', async () => {
    const { map, connected } = await readWith(undefined, devRows);
    assert.deepEqual(map, ALL_OPEN);
    assert.equal(connected, true);
  });

  it('"show as closed" reads production’s closed state over dev’s all-live rows', async () => {
    const { map } = await readWith('closed', devRows);
    assert.deepEqual(map, PRODUCTION);
  });

  it('"all live" still opens everything', async () => {
    const { map } = await readWith('live', [{ plan_key: 'club', gating_status: 'early_access' }]);
    assert.deepEqual(map, ALL_OPEN);
  });
});

describe('the house-league cap prompt reads the live gate (W57)', () => {
  function label(gating: Gating | null): string {
    const { LeagueUpgradeCta } = billingTestLoader({ '@/lib/use-plan-gating': { usePlanGating: () => gating } })(
      'components/admin/LeagueCapUpgrade.tsx',
    ) as { LeagueUpgradeCta: (p: object) => ReactElement };
    return text(renderToStaticMarkup(createElement(LeagueUpgradeCta, {})));
  }
  it('closed, or not yet known → the interest door; open → the upgrade words', () => {
    assert.ok(label(PRODUCTION).includes('Express interest in League Plus →'));
    assert.ok(label(null).includes('Express interest in League Plus →'));
    assert.ok(label(ALL_OPEN).includes('Upgrade to League Plus →'));
  });
});
