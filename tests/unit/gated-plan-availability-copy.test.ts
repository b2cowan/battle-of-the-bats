import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  gatedPlanTag,
  gatedPlanSentence,
  gatedPlanNote,
  closedProgramPlansSentence,
  GATED_PLAN_INTEREST_LINE,
} from '../../lib/plan-config.ts';

/**
 * What a customer reads about a plan that is not open for sign-up (BUSINESS_DECISIONS 2026-09-28; canon
 * in PRICING_PAGE_COPY.md). Every closed plan keeps a date-free "Coming soon" (League Plus joined Club's words
 * 2026-11-20, when it was set to go on sale with Club); nothing says "early access" — that programme was withdrawn
 * 2026-07-28. Before this, each surface typed its own availability line, and the in-app billing shelf
 * said "Coming soon · Early access only" about a parked plan (and a live one) for two months.
 */
describe('closed-plan availability words', () => {
  // ⚖ League Plus goes on sale WITH Club (BUSINESS_DECISIONS 2026-11-06), so its parked words ("Not open yet", "built, but
  // not open for sign-up", 2026-09-28) ended: it says what Club says (owner 2026-11-19; `/marketing`'s sentence 2026-11-20).
  it('League Plus wears Club’s words while closed, its own name in the sentence', () => {
    assert.equal(gatedPlanTag('league'), 'Coming soon');
    assert.equal(gatedPlanSentence('league'), "League Plus is coming soon — it isn't open for sign-up yet.");
    assert.equal(gatedPlanNote('league'), 'Not open for sign-up yet.');
    for (const s of [gatedPlanTag('league'), gatedPlanSentence('league'), gatedPlanNote('league')]) {
      assert.doesNotMatch(s, /built|refine|final|early|not open yet/i);
    }
  });

  it('Club keeps a date-free "Coming soon"', () => {
    assert.equal(gatedPlanTag('club'), 'Coming soon');
    assert.equal(gatedPlanSentence('club'), "Club is coming soon — it isn't open for sign-up yet.");
    assert.equal(gatedPlanNote('club'), 'Not open for sign-up yet.');
  });

  it('never says "early access"', () => {
    const plans = ['tournament', 'team', 'tournament_plus', 'league', 'club', 'club_large'] as const;
    const all = [
      ...plans.flatMap(k => [gatedPlanTag(k), gatedPlanSentence(k), gatedPlanNote(k)]),
      GATED_PLAN_INTEREST_LINE,
      closedProgramPlansSentence({ league: true, club: true }) ?? '',
    ];
    for (const s of all) assert.doesNotMatch(s, /early[ -]access/i);
  });

  it('the combined sentence names only what the LIVE gate says is closed', () => {
    assert.equal(closedProgramPlansSentence({ league: true, club: true }), 'Club and League Plus are coming soon.');
    assert.equal(closedProgramPlansSentence({ league: true, club: false }), 'League Plus is coming soon.');
    assert.equal(closedProgramPlansSentence({ league: false, club: true }), 'Club is coming soon.');
    assert.equal(closedProgramPlansSentence({ league: false, club: false }), null);
  });

  it('no customer surface types the retired availability lines again', () => {
    const surfaces = [
      'app/[orgSlug]/admin/org/billing/page.tsx',
      'components/billing/PlanArticlePanel.tsx',
      'components/billing/BillingBody.tsx',
      'components/billing/PlanMoveDialog.tsx',
      'lib/plan-billing-profile.ts',
      'lib/plan-billing-words.ts',
      'components/PricingSection.tsx',
      'app/pricing/page.tsx',
      'app/page.tsx',
      'app/for-leagues/page.tsx',
      'app/(consumer)/start/league/page.tsx',
      'app/[orgSlug]/admin/AdminHubClient.tsx',
      'components/admin/kit/club/ClubHubKit.tsx',
    ];
    const retired = [
      /Early access only/,
      /Join early access/,
      /in early access/,
      /open for early-access interest/,
      /is opening soon/,
      /in final refinement/,
      /currently being refined/,
      /League Plus and Club are coming soon/,
    ];
    for (const file of surfaces) {
      // Code comments may quote the retired lines as history; only what renders is checked.
      const src = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      for (const re of retired) assert.doesNotMatch(src, re, `${file} still types ${re}`);
    }
  });
});
