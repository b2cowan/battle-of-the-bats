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
 * in PRICING_PAGE_COPY.md). League Plus is parked, so it never says "soon"; Club has a release under way
 * and keeps a date-free "Coming soon"; nothing says "early access" — that programme was withdrawn
 * 2026-07-28. Before this, each surface typed its own availability line, and the in-app billing shelf
 * said "Coming soon · Early access only" about a parked plan (and a live one) for two months.
 */
describe('closed-plan availability words', () => {
  it('League Plus carries no imminence', () => {
    assert.equal(gatedPlanTag('league'), 'Not open yet');
    assert.equal(gatedPlanSentence('league'), 'League Plus is built, but not open for sign-up.');
    assert.equal(gatedPlanNote('league'), 'Built, but not open for sign-up.');
    for (const s of [gatedPlanTag('league'), gatedPlanSentence('league'), gatedPlanNote('league')]) {
      assert.doesNotMatch(s, /soon|refine|final|early/i);
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
    assert.equal(
      closedProgramPlansSentence({ league: true, club: true }),
      'Club is coming soon, and League Plus is built but not open for sign-up.',
    );
    assert.equal(closedProgramPlansSentence({ league: true, club: false }), 'League Plus is built but not open for sign-up.');
    assert.equal(closedProgramPlansSentence({ league: false, club: true }), 'Club is coming soon.');
    assert.equal(closedProgramPlansSentence({ league: false, club: false }), null);
  });

  it('no customer surface types the retired availability lines again', () => {
    const surfaces = [
      'app/[orgSlug]/admin/org/billing/page.tsx',
      'components/billing/PlanArticlePanel.tsx',
      'components/PricingSection.tsx',
      'app/pricing/page.tsx',
      'app/page.tsx',
      'app/for-leagues/page.tsx',
      'app/(consumer)/start/league/page.tsx',
      'app/platform/house-league/page.tsx',
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
