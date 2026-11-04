import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { tournamentFrameTabContent, visibleTournamentTabs } from '../../lib/tournament-page-tabs.ts';
import { billingTestLoader as componentLoader } from './_billing-test-loader.ts';
import { readCode } from './_source-code.ts';

const facts = {
  announcementCount: 0, ruleCount: 0, resourceCount: 0, registrationCta: null,
  championsCrownedAt: '2026-10-31T12:00:00Z', divisions: [{ scheduleVisibility: 'published' as const }],
};
describe('Stage 6 review: one live/preview tab computation, with current publication taking precedence', () => {
  it('requires a crown stamp and a nonempty, fully published division list', () => {
    assert.equal(tournamentFrameTabContent(facts).hasChampion, true);
    assert.equal(tournamentFrameTabContent({ ...facts, championsCrownedAt: null }).hasChampion, false);
    assert.equal(tournamentFrameTabContent({ ...facts, divisions: [] }).hasChampion, false);
    assert.equal(tournamentFrameTabContent({ ...facts, divisions: [{ scheduleVisibility: 'unpublished' }] }).hasChampion, false);
    assert.equal(tournamentFrameTabContent({ ...facts, divisions: [{}] }).hasChampion, false);
  });
  it('keeps News/Rules/resource-only and Register/waitlist facts independent', () => {
    assert.deepEqual(tournamentFrameTabContent({ ...facts, announcementCount: 1, resourceCount: 1, registrationCta: 'waitlist' }),
      { hasNews: true, hasRules: true, registrationOpen: true, hasChampion: true });
    assert.equal(tournamentFrameTabContent({ ...facts, registrationCta: 'register' }).registrationOpen, true);
    assert.equal(tournamentFrameTabContent(facts).registrationOpen, false);
  });
  it('never inserts an organizer-hidden Register even if an input fact is stale', () => {
    const rows = visibleTournamentTabs(['register'], false, { ...tournamentFrameTabContent(facts), registrationOpen: true });
    assert.ok(rows.every(row => row.key !== 'register'));
  });
});

describe('Stage 6 review: navigation agrees before effects or a saved context exist', () => {
  it('server-renders the same tab keys in the band row, rail and footer', () => {
    const load = componentLoader({
      'next/navigation': { useParams: () => ({ orgSlug: 'club', tournamentSlug: 'cup' }) },
      '@/lib/use-public-pathname': { useOrgHref: () => (path = '') => `/club${path}`, usePublicPathname: () => '/club/cup/champions' },
      // Stage 8 Part 3d: the tab facts left the nav context; any surface that still reached for one there fails here.
      '@/components/OrgNavContext': { useOrgNav: () => new Proxy({ logoUrl: null, orgName: '', orgHomeHref: null, tournamentName: null } as Record<string, unknown>, {
        get(ctx, key) {
          if (typeof key === 'string' && !(key in ctx)) throw new Error(`reads ${key} from the nav context`);
          return ctx[key as string];
        },
      }) },
      '@/components/public/DesktopMyTeamRailCard': { __esModule: true, default: () => null },
      '@/components/public/PublicAppOnly': { __esModule: true, default: () => null },
      '@/components/marketing/BuiltOnCredit': { __esModule: true, default: () => null },
    });
    const shared = { hiddenPages: ['rules'], hasBracket: true, frameContent: { hasNews: false, hasRules: true, registrationOpen: true, hasChampion: true } };
    const render = (file: string, props: Record<string, unknown>) => {
      const { default: Component } = load(`components/public/${file}.tsx`) as { default: ComponentType<Record<string, unknown>> };
      return renderToStaticMarkup(createElement(Component, props));
    };
    const keys = (html: string) => [...html.matchAll(/href="([^"#]+)"/g)].map(m => m[1].split('/').at(-1))
      .filter(key => ['champions', 'news', 'schedule', 'standings', 'playoffs', 'teams', 'rules', 'register'].includes(key!));
    const top = keys(render('TournamentTopTabs', { ...shared, skin: 'frame' }));
    const rail = keys(render('TournamentSideRail', shared));
    const footer = keys(render('TournamentFooter', { ...shared, name: 'Cup', contactEmail: null, host: null, showCredit: false }));
    assert.deepEqual(top, ['champions', 'schedule', 'standings', 'playoffs', 'teams', 'register']);
    assert.deepEqual(rail, top);
    assert.deepEqual(footer, top);
    const live = readCode('app/[orgSlug]/[tournamentSlug]/layout.tsx');
    assert.match(live, /<TournamentSideRail hiddenPages=\{navHiddenPages\} hasBracket=\{hasPublicBracket\}\s+frameContent=\{frameContent\}/);
  });
});
