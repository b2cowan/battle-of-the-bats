import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as config from '../../lib/plan-config.ts';
import { billingTestLoader } from './_billing-test-loader.ts';

/** Change config at the boundary: every actual upsell must follow it without editing a screen. */
function fixture(founding: boolean, checkoutOpen: boolean) {
  const facts = {
    ...config,
    PLAN_CONFIG: { ...config.PLAN_CONFIG, team: { ...config.PLAN_CONFIG.team, label: 'Future coach plan', monthlyPrice: 57 } },
    isFoundingSeasonPromoActive: () => founding,
  };
  return billingTestLoader({
    '@/lib/plan-config': facts, './plan-config': facts,
    '@/lib/plan-gating-server': { getPlanGatingMap: async () => ({ team: !checkoutOpen }) },
    'next/navigation': { useRouter: () => ({ refresh() {}, push() {} }) },
  });
}

describe('coach upsells follow the shared plan facts and approved destinations', () => {
  for (const founding of [false, true]) for (const checkoutOpen of [false, true]) {
    it(`footer: founding=${founding}, checkout=${checkoutOpen}; retains the support note and source/team`, async () => {
      const load = fixture(founding, checkoutOpen);
      const { default: Shelf } = load('components/coaches/ScopeShelf.tsx') as {
        default: (props: { basicTeamId: string; section: string; note: string }) => Promise<ReactNode>;
      };
      const html = renderToStaticMarkup(await Shelf({ basicTeamId: 'team 1', section: 'overview', note: 'Your saved Premium work comes back.' }));
      assert.match(html, /Future coach plan/);
      assert.match(html, /\$57 CAD \/ month per team/);
      assert.doesNotMatch(html, /\$29|Premium Coaches Portal/);
      assert.match(html, /Your saved Premium work comes back\./);
      if (founding) assert.ok(html.includes(config.FOUNDING_SEASON_END_LABEL));
      assert.ok(html.includes(checkoutOpen
        ? '/coaches/start?source=coach_footer_overview&amp;basicTeamId=team%201'
        : '/for-coaches?source=coach_footer_overview'));
      assert.ok(html.includes(checkoutOpen ? 'Upgrade to Premium' : 'See everything it includes'));
    });
    it(`Explore: founding=${founding}, checkout=${checkoutOpen}; real markup follows config/registry`, () => {
      const load = fixture(founding, checkoutOpen);
      const { default: Explore } = load('components/coaches/CoachExploreCatalog.tsx') as {
        default: ComponentType<{ basicTeamId: string; activatedFeatures: string[]; checkoutOpen: boolean }>;
      };
      const html = renderToStaticMarkup(createElement(Explore, { basicTeamId: 'team 1', activatedFeatures: [], checkoutOpen }));
      assert.match(html, /aria-label="Upgrade to the Future coach plan"/);
      assert.match(html, /\$57 CAD \/ month/);
      assert.match(html, /per team/);
      assert.doesNotMatch(html, /\$29|Premium Coaches Portal/);
      assert.match(html, /Assistant coaches with their own sign-in/);
      if (founding) assert.ok(html.includes(config.FOUNDING_SEASON_END_LABEL));
      assert.ok(html.includes(checkoutOpen
        ? '/coaches/start?source=coach_explore&amp;basicTeamId=team%201'
        : '/for-coaches?source=coach_explore'));
      assert.ok(html.includes(checkoutOpen ? 'Upgrade to Premium' : 'See everything it includes'));
    });
  }
  for (const founding of [false, true]) it(`post-event: founding=${founding}; config price, existing checkout`, () => {
    const { default: Ceiling } = fixture(founding, true)('components/coaches/ScopeCeilingInterest.tsx') as {
      default: ComponentType<{ basicTeamId: string; checkoutOpen: boolean }>;
    };
    const html = renderToStaticMarkup(createElement(Ceiling, { basicTeamId: 'team 1', checkoutOpen: true }));
    assert.match(html, /Future coach plan/);
    assert.match(html, /\$57 CAD \/ month per team/);
    assert.ok(html.includes('/coaches/start?source=coach_scope_ceiling&amp;basicTeamId=team%201'));
    if (founding) assert.ok(html.includes(config.FOUNDING_SEASON_END_LABEL));
    assert.doesNotMatch(html, /\$29|Premium Coaches Portal/);
  });
  it('the gated sign-up uses the config plan name without introducing a price', () => {
    const { default: Interest } = fixture(false, false)('components/coaches/CoachStartInterest.tsx') as {
      default: ComponentType;
    };
    const html = renderToStaticMarkup(createElement(Interest));
    assert.match(html, /<h1[^>]*>Future coach plan<\/h1>/);
    assert.doesNotMatch(html, /Premium Coaches Portal|\$\d/);
  });
});
