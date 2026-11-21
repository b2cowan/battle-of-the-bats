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
  closedPlansGroupTag, availableNowSentence, allProgramPlansOpen, anyProgramPlanOpen, formatPriceAmount,
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

/** The legal pages as production will serve them with S3b: Terms and Privacy published, the data terms not yet. */
const LEGAL_LIVE = {
  termsHref: 'https://www.fieldlogichq.ca/legal/terms', privacyHref: 'https://www.fieldlogichq.ca/legal/privacy',
  termsVersion: '2026-11-17', dataTermsHref: null, subprocessorsHref: null,
};

function loaderFor(gating: Gating, legal: typeof LEGAL_LIVE | { dataTermsHref: string } | null = LEGAL_LIVE) {
  return billingTestLoader({
    '@/lib/legal-links': { resolveLegalLinks: () => (legal ? { ...LEGAL_LIVE, ...legal } : null) },
    '@/lib/app-origin': { canonicalAppOrigin: () => 'https://www.fieldlogichq.ca' },
    // The pricing grid asks the browser who is signed in; a prospect is signed out.
    '@/lib/use-client-signed-in': { useClientSignedIn: () => false },
    '@/lib/plan-gating-server': {
      getPlanGatingMap: async () => gating,
      isCoachesPortalPurchasable: async () => !gating.team,
    },
    '@/lib/plan-config-db': {
      getPlanConfigOverride: async (plan: OrgPlan) => override(plan),
      getPlanConfigOverrides: async () => Object.fromEntries((Object.keys(PLAN_CONFIG) as OrgPlan[]).map(p => [p, override(p)])),
    },
    // Home: an app launch is the only visit that asks who is signed in; a browser visit never does.
    '@/lib/supabase-server': { createClient: async () => ({}) },
    '@/lib/auth-destination': { getAuthDestination: async () => '/discover' },
    '@/lib/two-step-session': { getSignedInUser: async () => null },
  });
}

/** Checkout's trial length per plan: the code values, with Tournament Plus and League Plus overridden so a typed number
 *  would show (the page must say the length checkout will use, never the code's). */
const LEAGUE_TRIAL_DAYS = 21;
function override(plan: OrgPlan) {
  return {
    tournamentLimit: PLAN_CONFIG[plan].tournamentLimit, seatLimit: PLAN_CONFIG[plan].seatLimit,
    trialDays: plan === 'tournament_plus' ? TP_TRIAL_DAYS : plan === 'league' ? LEAGUE_TRIAL_DAYS : PLAN_CONFIG[plan].trialDays,
  };
}

const decode = (html: string) => html
  .replaceAll('&#x27;', "'").replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>')
  .replace(/<!-- -->/g, '');
/** The text a visitor reads (tags out, whitespace collapsed). */
const text = (html: string) => decode(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

async function render(file: string, gating: Gating, legal?: Parameters<typeof loaderFor>[1]): Promise<string> {
  const page = (loaderFor(gating, legal)(file) as { default: (props?: unknown) => Promise<ReactElement> }).default;
  return text(renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) })));
}

/** One of the three open (a partial flip): League Plus on sale, both Club bands still closed. */
const LEAGUE_ONLY: Gating = { ...PRODUCTION, league: false };

const RETIRED = [
  /early[ -]access/i, /in (active )?development/i, /finishing its final workflows/i, /while we finish/i, /next parts of the platform/i,
  /plan ahead and express interest/i, /path into the roadmap/i, /with everything (you|they)[’']ve built/i, /Free right now/,
  /Start Tournament Plus free/, /Most organizations are running/, /\bused by\b/, /\b8am\b/,
];

const PAGES = [
  'app/pricing/page.tsx', 'app/for-clubs/page.tsx', 'app/for-leagues/page.tsx', 'app/for-coaches/page.tsx',
  'app/for-tournament-organizers/page.tsx', 'app/page.tsx',
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
    assert.ok(page.includes('Tournament, Tournament Plus, and the Premium Coaches Portal are available now. Tournament is free, with no credit card required. Club and League Plus are coming soon.'), 'W8');
    // S1's closed page, unchanged by S3: one grid (no bands), the four-door picker, no Club · Association card.
    assert.ok(!page.includes('Running a league or a club') && !page.includes('I run a league or a club.'));
    assert.ok(page.includes('I run a house league season.') && !page.includes('Club · Association trial'));
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

  // ── The open state (on-sale pages S3) ──────────────────────────────────────────────────────────────────────────────
  it('with all three open, the interest form is on no public page (Ask 5, W55)', async () => {
    for (const file of PAGES) {
      const page = await render(file, ALL_OPEN);
      assert.ok(!page.includes('Express interest'), `${file} offers the interest form beside an open plan`);
      assert.ok(!page.includes('coming soon') && !page.includes('Coming soon'), `${file} says a plan is coming`);
    }
  });

  it('/pricing, open: three bands, three picker doors, Club · Association, no bridges for an open plan (W58, W59, W75)', async () => {
    const page = await render('app/pricing/page.tsx', ALL_OPEN);
    for (const heading of ['Running a tournament', 'Running a league or a club', 'Coaching one team']) assert.ok(page.includes(heading), heading);
    for (const label of ['A house league', 'A club with rep teams · up to 15 teams', 'A club with 16 to 30 teams']) assert.ok(page.includes(label), label);
    assert.ok(page.includes('I run a league or a club.') && page.includes('See league and club plans') && !page.includes('I run a house league season.'), 'W59');
    assert.ok(page.includes('Start your Club · Association trial') && page.includes('More than 30 teams?'), 'W4, W5');
    assert.ok(page.includes('Every plan is available now. Tournament is free, with no credit card required.'), 'W8');
    assert.ok(page.includes('Opening your event to registration?') && !page.includes('Running a full house league season?'), 'W75');
    assert.ok(!page.includes('League Plus and Club — what they cover'), 'W13');
    assert.ok(page.includes('How do I buy League Plus, Club, or Club · Association?') && page.includes('Which Club plan do I need?'), 'W15, W20');
    assert.ok(page.includes('Browse all the ways to start'), 'W21');
    // The trial sentence with the length checkout will use (Ask 9), never the code's.
    assert.ok(page.includes(planTrialLine(LEAGUE_TRIAL_DAYS)) && !page.includes(planTrialLine(PLAN_CONFIG.league.trialDays)));
    // The coaches band is Premium only (BUSINESS_DECISIONS 2026-11-19).
    assert.ok(!page.includes('Basic Coaches Portal'));
  });

  it('a partial flip reads right: League Plus open, Club closed', async () => {
    const pricing = await render('app/pricing/page.tsx', LEAGUE_ONLY);
    assert.ok(pricing.includes('Running a league or a club') && pricing.includes('Start your League Plus trial'), 'band 2 renders with its one open plan');
    assert.ok(pricing.includes('See what League Plus includes'), 'W9: the four-door picker, League Plus door to its page');
    assert.ok(pricing.includes(interestButtonLabel(['club'])) && !pricing.includes(interestButtonLabel(['league', 'club'])), 'the interest door offers only Club');
    assert.ok(pricing.includes('Club is coming soon.') && !pricing.includes('Club · Association trial'));
    // The answers that would call an open plan "shown here" or "not yet" are built from the gate (`/review` S3).
    assert.ok(!pricing.includes('Not through self-serve checkout yet.') && !pricing.includes('so your organization can plan ahead'));
    assert.ok(pricing.includes('League Plus is available now.') && !pricing.includes('League Plus and Club — what they cover'));
    const home = await render('app/page.tsx', LEAGUE_ONLY);
    assert.ok(home.includes('Running a league or a club?') && home.includes('I run a house league'), 'W60: the middle door with League Plus’s link');
    assert.ok(home.includes('On the roadmap') && home.includes('I run a club'), 'Club stays on the roadmap row');
    assert.ok(!home.includes('Prices are in Canadian dollars'), 'the price rows wait for all three');
  });

  it('/for-clubs and /for-leagues, open: the trial button, "How the trial works", one button in the last band (W23–W36, W68)', async () => {
    const clubs = await render('app/for-clubs/page.tsx', ALL_OPEN);
    assert.ok(clubs.includes('Start your Club trial') && clubs.includes('Start your Club · Association trial'));
    assert.ok(clubs.includes('How the trial works') && clubs.includes('The trial is for your club’s first paid plan.') && clubs.includes('the plan renews until you cancel'));
    assert.ok(clubs.includes('Pick the Club plan that fits and start today.') && !clubs.includes('Start free with Tournament'), 'W30');
    assert.ok(!clubs.includes('Running a tournament this year?'), 'W28');
    assert.ok(clubs.includes('Do your coaches need their own portal?'), 'W29');
    const leagues = await render('app/for-leagues/page.tsx', ALL_OPEN);
    assert.ok(leagues.includes('Start your League Plus trial') && leagues.includes('How the trial works') && leagues.includes('build your teams'));
    assert.ok(leagues.includes(planTrialLine(LEAGUE_TRIAL_DAYS)), 'the length checkout will use');
    assert.ok(leagues.includes('Running a tournament too? It is in your plan.') && leagues.includes('See what Club includes'), 'W34, W35');
    assert.ok(leagues.includes('Start League Plus today.') && !leagues.includes('Start free with Tournament'), 'W36');
    // Closed: no trial section, no trial button.
    for (const file of ['app/for-clubs/page.tsx', 'app/for-leagues/page.tsx']) {
      const closed = await render(file, PRODUCTION);
      assert.ok(!closed.includes('How the trial works') && !closed.includes('trial'), `${file} closed says no trial`);
    }
  });

  it('home, open: three doors, four role cards, three price rows with one tax line, the hero’s two buttons (W38–W42, W60–W62)', async () => {
    const home = await render('app/page.tsx', ALL_OPEN);
    assert.ok(home.includes('Running a league or a club?') && home.includes('I run a club with rep teams'), 'W60');
    assert.ok(home.includes('League Plus Available now') && home.includes('Club Available now'), 'W40: the plan on the left, its pill on the right');
    assert.ok(home.includes(`Prices are in Canadian dollars, ${BILLING_TAX_WORDS.plusTax}.`), 'W61: one tax line');
    assert.equal(home.split(BILLING_TAX_WORDS.plusTax).length - 1, 1, 'and only one');
    assert.ok(home.includes('Get started') && home.includes('See plans and prices') && !home.includes('Start free'), 'W62');
    assert.ok(home.includes('Tournament organizers, coaches, house leagues and clubs can start today.'), 'W39');
    assert.ok(!home.includes('On the roadmap'));
    // No price on any door (Ask 24 A): the doors section sits before "What's included".
    const doors = home.slice(0, home.indexOf('What\'s included'));
    assert.doesNotMatch(doors, /\$\d/);
    const closed = await render('app/page.tsx', PRODUCTION);
    assert.ok(closed.includes('Start free') && closed.includes('On the roadmap') && !closed.includes('Prices are in Canadian dollars'), 'S1’s closed home');
  });

  it('/for-tournament-organizers: the League Plus cross-sell becomes a link once open (W37)', async () => {
    assert.ok((await render('app/for-tournament-organizers/page.tsx', ALL_OPEN)).includes('See what League Plus includes'));
    assert.ok((await render('app/for-tournament-organizers/page.tsx', PRODUCTION)).includes(interestButtonLabel(['league'])));
  });

  it('/for-coaches: no tag over Premium when it is on sale; its own tag when closed (W73)', async () => {
    const open = await render('app/for-coaches/page.tsx', PRODUCTION);
    assert.ok(!open.includes('Coming soon'));
    const closed = await render('app/for-coaches/page.tsx', PREMIUM_CLOSED);
    assert.ok(closed.includes('Coming soon'));
    assert.ok(closed.includes(GATED_PLAN_INTEREST_LINE));
  });
});

// ── S3b: the selling sections, the home page's "old way" cards, "module" off the marketing pages ─────────────────────
describe('S3b, in both states', () => {
  const CLOSED_GATINGS = [['production', PRODUCTION], ['Premium closed', PREMIUM_CLOSED], ['League Plus only', LEAGUE_ONLY]] as const;

  it('home: four habit cards on production; the registrar and the permit join while League Plus or Club is open (A1–A3)', async () => {
    const closed = await render('app/page.tsx', PRODUCTION);
    assert.ok(closed.includes('The old way') && closed.includes('What it actually replaces') && !closed.includes('Platform highlights'), 'A2');
    for (const tag of ['The phone call after every game', 'The registration inbox', 'The group text', 'The tryout clipboard']) {
      assert.ok(closed.includes(tag), tag);
    }
    assert.ok(!closed.includes("The registrar's spreadsheet") && !closed.includes('The permit in an email thread'), 'A1: closed plans sell nothing');
    for (const gating of [ALL_OPEN, LEAGUE_ONLY, { ...PRODUCTION, club: false }]) {
      const page = await render('app/page.tsx', gating);
      assert.ok(page.includes("The registrar's spreadsheet") && page.includes('The permit in an email thread'), 'A1/A3: either one opens both');
    }
    const premiumClosed = await render('app/page.tsx', PREMIUM_CLOSED);
    assert.ok(!premiumClosed.includes('The group text') && !premiumClosed.includes('The tryout clipboard'), 'each card on its own gate');
    // Claims cut to what ships (owner 2026-08-26: the head coach sees every name; the event pages refresh on a timer).
    assert.ok(!closed.includes('Names stay hidden') && !closed.includes('the moment you enter'));
  });

  it('no "module", no "visibility", no "the org" on the pages S3b touched, in any state', async () => {
    for (const file of ['app/page.tsx', 'app/for-clubs/page.tsx', 'app/for-leagues/page.tsx', 'app/pricing/page.tsx', 'app/demos/page.tsx']) {
      for (const [name, gating] of [['production', PRODUCTION], ['all open', ALL_OPEN]] as const) {
        const page = await render(file, gating);
        assert.doesNotMatch(page, /\bmodules?\b/i, `${file} (${name}) says "module"`);
        assert.doesNotMatch(page, /visibility/i, `${file} (${name}) promises visibility`);
      }
    }
    const clubs = await render('app/for-clubs/page.tsx', PRODUCTION);
    assert.ok(clubs.includes('You run the club.') && !clubs.includes('You run the org.'), 'W65');
    assert.ok(clubs.includes('Four jobs. One platform.'), 'the steps headline');
    assert.ok(clubs.includes('the cash it holds') && clubs.includes("Lineups and the team's own books stay with the coach."), 'card 03');
  });

  // W67 as re-ruled 2026-11-21: each card carries a DRAWING (old way → answer), so neither page says "the product's own
  // screens" any more, and neither sends a reader to a demo for them: no demo shows a house league or the club's books
  // (`/marketing` + `/legal`, the same day). A line under the cards comes back only with a demo that shows those screens.
  it('/for-clubs and /for-leagues: a drawing on each card and no claim about the pictures; W66 and W69 on /for-clubs, both states', async () => {
    const UNTRUE = ["the product's own screens", 'Walk the real screens'];
    // `render` hands back the page's TEXT, so a drawing is counted by its answer label (the two ink words on its right).
    const drawings = (pageText: string, answers: string[]) => answers.filter((label) => pageText.includes(label)).length;
    const CLUB_ANSWERS = ['THE LIVE BRACKET', 'ONE SEASON', 'EVERY TEAM', 'ONE LEDGER'];
    const LEAGUE_ANSWERS = ['ONE LIST', 'THE DRAFT', 'THE STANDINGS', 'ONE MESSAGE'];
    for (const [name, gating] of [['production', PRODUCTION], ['all open', ALL_OPEN]] as const) {
      const clubs = await render('app/for-clubs/page.tsx', gating);
      for (const words of UNTRUE) assert.ok(!clubs.includes(words), `/for-clubs still says or shows "${words}" (${name})`);
      assert.equal(drawings(clubs, CLUB_ANSWERS), 4, `/for-clubs: one drawing on each of the four cards (${name})`);
      assert.ok(clubs.includes("The treasurer's three spreadsheets") && !clubs.includes('Tryouts run on email chains.'), `W66 (${name})`);
      assert.ok(clubs.includes('What each person at your club gets') && clubs.includes('A Premium Coaches Portal for every coach.'), `W69 (${name})`);
      assert.ok(clubs.includes('The plans and prices are on one page.') && !clubs.includes('the trial are on one page'), 'W69: no trial in a both-states line');
      const leagues = await render('app/for-leagues/page.tsx', gating);
      for (const words of UNTRUE) assert.ok(!leagues.includes(words), `/for-leagues still says or shows "${words}" (${name})`);
      assert.equal(drawings(leagues, LEAGUE_ANSWERS), 4, `/for-leagues: one drawing on each of the four steps (${name})`);
    }
    // What a screen reader hears, and the words set inside the drawings: no figure, no plan, and none of the three claims
    // the reads cut (a bare "the bank" reads as a bank feed; an opted-out family is skipped; enrolment is "registration").
    const loaded = loaderFor(PRODUCTION);
    for (const page of ['app/for-clubs/page.tsx', 'app/for-leagues/page.tsx']) {
      const html = renderToStaticMarkup(await (loaded(page) as { default: () => Promise<ReactElement> }).default());
      const pictures = [...html.matchAll(/<svg\b[^>]*viewBox="0 0 800 500"[\s\S]*?<\/svg>/g)].map((m) => m[0]);
      assert.equal(pictures.length, 4, page);
      assert.ok(!html.includes('/marketing/on-sale/'), `${page}: no screenshot is left on the page`);
      for (const svg of pictures) {
        assert.match(svg, /role="img"/, `${page}: a drawing is announced as a picture`);
        assert.match(svg, /aria-label="[^"]{30,}"/, `${page}: a drawing says what it shows`);
        assert.doesNotMatch(svg, /\$\d|League Plus|Premium|included with/, `${page}: no figure or plan inside a drawing`);
        // Read as a visitor reads it: the bank line is set over two <text> lines, so the tags come out first.
        const words = svg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        assert.doesNotMatch(words, /the bank(?! statement)|to every family|SIGN-UP/i, `${page}: a claim the reads cut is back in a drawing`);
      }
    }
  });

  it('W70: the board questions show only while the legal pages are published; the year cost only while the plan is open', async () => {
    for (const [name, gating] of CLOSED_GATINGS) {
      const clubs = await render('app/for-clubs/page.tsx', gating);
      assert.ok(clubs.includes('Questions a board asks') && clubs.includes('Read the Privacy Policy'), `/for-clubs (${name})`);
      assert.ok(clubs.includes('Coaches can paste or upload a roster.'), 'the club answer');
      assert.ok(!clubs.includes('What does a year cost?'), `/for-clubs (${name}): no closed price`);
      assert.ok(clubs.includes("if you cancel, we don't refund the unused part"), '/legal: if you cancel');
      assert.ok(!clubs.includes('ask us for a full copy'), 'the full copy waits for the data terms');
    }
    const open = await render('app/for-clubs/page.tsx', ALL_OPEN);
    assert.ok(open.includes(`Club is ${formatPriceAmount(PLAN_CONFIG.club.annualPrice)} a year or ${formatPriceAmount(PLAN_CONFIG.club.monthlyPrice)} a month, ${BILLING_TAX_WORDS.plusTax}.`), 'answer 6 from PLAN_CONFIG');
    assert.ok(open.includes(`It covers up to ${PLAN_CONFIG.club.teamLimit} teams with a Premium Coaches Portal`) && open.includes(`Club · Association covers up to ${PLAN_CONFIG.club_large.teamLimit}.`));
    const leaguesOpen = await render('app/for-leagues/page.tsx', ALL_OPEN);
    assert.ok(leaguesOpen.includes('What does a year cost?') && leaguesOpen.includes('That covers your seasons and your tournaments.'));
    assert.ok(!leaguesOpen.includes('Coaches can paste or upload a roster.'), 'the league answer');
    // Legal pages off: nothing points at a "not found" page.
    for (const file of ['app/for-clubs/page.tsx', 'app/for-leagues/page.tsx', 'app/pricing/page.tsx']) {
      const off = await render(file, PRODUCTION, null);
      assert.ok(!off.includes('Questions a board asks') && !off.includes('Read the Privacy Policy') && !off.includes('Switching, your board'), file);
    }
    // The data terms published: the full-copy clause joins.
    const withTerms = await render('app/for-clubs/page.tsx', PRODUCTION, { dataTermsHref: 'https://www.fieldlogichq.ca/legal/data-terms' });
    assert.ok(withTerms.includes('You can download your lists as Excel, CSV or PDF, or ask us for a full copy.'));
  });

  it('/pricing: three small headings, the board group holding the first four answers', async () => {
    const page = await render('app/pricing/page.tsx', PRODUCTION);
    const at = (s: string) => page.indexOf(s);
    assert.ok(at('Plans and billing') > -1 && at('Plans and billing') < at("Switching, your board and your families' information"));
    assert.ok(at("Switching, your board and your families' information") < at('Getting started'));
    for (const q of ['Can we switch in the middle of a season?', 'What happens when our treasurer or registrar changes?', "What do you do with our families' information?", 'What if we decide to stop?']) {
      assert.ok(page.includes(q), q);
    }
    assert.ok(!page.includes('Do our volunteers need training?'), 'training stays on the persona pages');
    assert.ok(at('Is this too complex for a volunteer-run organization?') > at('Getting started'), 'drawing tab 2');
  });

  it('W71: /for-coaches copies a link for the club; /demos names the portal a club gives its coaches', async () => {
    const coaches = await render('app/for-coaches/page.tsx', PRODUCTION);
    assert.ok(coaches.includes('Is your club considering the Club plan?') && coaches.includes('Copy a link for your club'));
    const demos = await render('app/demos/page.tsx', PRODUCTION);
    assert.ok(demos.includes('Running a club? This is the portal each of your coaches gets with Club.'));
  });
});

describe('the one answer and the availability words', () => {
  it('isPlanOpen reads the inversion once; a plan missing from the map reads closed', () => {
    assert.equal(isPlanOpen(PRODUCTION, 'club'), false);
    assert.equal(isPlanOpen(PRODUCTION, 'team'), true);
    assert.equal(isPlanOpen({}, 'team'), false);
  });

  it('the group tag: "Coming soon" while either is closed (both wear it since 2026-11-20), none renders nothing (W6)', () => {
    assert.equal(closedPlansGroupTag({ league: true, club: true }), 'Coming soon');
    assert.equal(closedPlansGroupTag({ league: false, club: true }), 'Coming soon');
    assert.equal(closedPlansGroupTag({ league: true, club: false }), 'Coming soon');
    assert.equal(closedPlansGroupTag({ league: false, club: false }), null);
  });

  it('the open layouts switch on all three programme plans; band 2 on any one', () => {
    assert.equal(allProgramPlansOpen(ALL_OPEN), true);
    assert.equal(allProgramPlansOpen(LEAGUE_ONLY), false);
    assert.equal(allProgramPlansOpen({ ...ALL_OPEN, club_large: true }), false, 'Club · Association closed is a partial flip');
    assert.equal(anyProgramPlanOpen(LEAGUE_ONLY), true);
    assert.equal(anyProgramPlanOpen(PRODUCTION), false);
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

