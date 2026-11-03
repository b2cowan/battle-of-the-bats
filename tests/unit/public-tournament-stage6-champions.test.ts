import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { billingTestLoader as componentLoader } from './_billing-test-loader.ts';
import { readCode } from './_source-code.ts';
import { visibleTournamentTabs } from '../../lib/tournament-page-tabs.ts';
import type { Division, Game, Team, Tournament } from '../../lib/types.ts';

const { onlyPublishedGames } = componentLoader({ './supabase-admin': {}, './db': {} })('lib/public-games.ts') as {
  onlyPublishedGames: (games: Game[], divisions: Division[]) => Game[];
};
function fixture(kind: 'one' | 'several' | 'none' | 'partial' | 'held' | 'submitted' = 'one') {
  const divisions = ['one', 'none', 'submitted'].includes(kind) ? ['a'] : ['a', 'b'];
  const teams = divisions.flatMap(id => [
    { id: `${id}1`, name: id === 'b' && kind === 'held' ? 'HELD_BACK_WINNER' : `Winner ${id}`, divisionId: id, status: 'accepted', email: 'PRIVATE_EMAIL', adminNotes: 'PRIVATE_NOTE' },
    { id: `${id}2`, name: `Runner-up ${id}`, divisionId: id, status: 'accepted' },
  ]) as Team[];
  return {
    tournament: { id: 't', year: 2026, slug: 'cup', sport: 'baseball', isActive: true, name: 'The Classic', status: 'active',
      publicHiddenPages: [], settings: { format: 'round_robin_playoffs' } } as Tournament,
    divisions: divisions.map((id, index) => ({ id, name: id, order: index, scheduleVisibility: kind === 'held' && id === 'b' ? 'unpublished' : 'published' })) as Division[],
    teams,
    games: divisions.map(id => ({ id: `final-${id}`, divisionId: id, isPlayoff: true, bracketId: id, bracketCode: 'FIN',
      homeTeamId: `${id}1`, awayTeamId: `${id}2`, homeScore: kind === 'none' ? null : 7, awayScore: kind === 'none' ? null : 4,
      status: kind === 'submitted' ? 'submitted' : kind === 'none' || (kind === 'partial' && id === 'b') ? 'scheduled' : 'completed',
      date: '2000-01-01', notes: 'PRIVATE_GAME_NOTE',
    })) as Game[],
  };
}
type Fixture = ReturnType<typeof fixture>;

function loader(data: Fixture, frameOn = true) {
  const db = {
    getOrganizationBySlug: async () => ({ id: 'org', name: 'Club', subscriptionStatus: 'active' }),
    getPublicTournamentBySlug: async () => data.tournament,
    getGames: async () => data.games, getTeams: async () => data.teams, getDivisions: async () => data.divisions,
  };
  const unused = Object.fromEntries(['ScheduleContent', 'PublicSchedule', 'StandingsContent', 'PublicStandings',
    'TeamsContent', 'PublicTeams', 'NewsContent', 'RulesContent', 'PublicRules', 'RegisterContent']
    .map(name => [`@/components/public/${name}`, { __esModule: true, default: () => null }]));
  return componentLoader({
    ...unused,
    '@/lib/db': db,
    '@/lib/public-games': { onlyPublishedGames, getPublicStandingsByDivision: async () => ({}) },
    '@/lib/club-forward': { forwardToOwnAddress: async () => {} },
    '@/lib/public-frame-server': { isPublicFrameOn: async () => frameOn, publicTournamentContactEmail: async () => null },
    '@/lib/tournament-preview': { getTournamentPreviewContext: async () => ({ org: { id: 'org' }, tournament: data.tournament }) },
    '@/lib/org-links': { orgLinks: async () => (path: string) => `/club${path}` },
    '@/lib/public-tournament-data': { toPublicTeam: (team: Team) => team,
      getPublicTournamentPageData: async () => ({ ...data, games: onlyPublishedGames(data.games, data.divisions), organization: { name: 'Club' } }) },
    '@/lib/public-standings': {}, '@/lib/public-teams': {},
    '@/lib/use-club-public-origin': { useClubPublicOrigin: () => '' },
    'next/navigation': { notFound: () => { throw new Error('not found'); } },
    'next/og': { ImageResponse: class { html: string; constructor(node: ReactNode) { this.html = renderToStaticMarkup(node); } } },
  });
}
async function renderPage(data: Fixture, preview = false, frameOn = true) {
  const path = preview ? 'app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/[section]/page.tsx'
    : 'app/[orgSlug]/[tournamentSlug]/champions/page.tsx';
  const { default: Page } = loader(data, frameOn)(path) as {
    default: (props: { params: Promise<{ orgSlug: string; tournamentSlug: string; section: string }> }) => Promise<ReactNode>;
  };
  return renderToStaticMarkup(await Page({ params: Promise.resolve({ orgSlug: 'club', tournamentSlug: 'cup', section: 'champions' }) }));
}
async function renderImage(data: Fixture, frameOn = true) {
  const { default: Image } = loader(data, frameOn)('app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx') as {
    default: (props: { params: Promise<{ orgSlug: string; tournamentSlug: string }> }) => Promise<{ html: string }>;
  };
  return (await Image({ params: Promise.resolve({ orgSlug: 'club', tournamentSlug: 'cup' }) })).html;
}

describe('Stage 6 Part 3: the live and preview Champions readers use the existing final-results gates', () => {
  for (const preview of [false, true]) {
    for (const kind of ['one', 'several', 'none', 'partial', 'held', 'submitted'] as const) {
      it(`${preview ? 'preview' : 'live'}: ${kind}`, async () => {
        const html = await renderPage(fixture(kind), preview);
        if (kind === 'one' || kind === 'several') {
          assert.match(html, /Winner a/);
          assert.match(html, /Beat Runner-up a 7–4 in the championship/);
          assert.equal((html.match(/<article/g) ?? []).length, kind === 'one' ? 1 : 2);
          assert.match(html, /The playoff bracket/);
          assert.match(html, /Final standings/);
        } else {
          assert.match(html, /No champions crowned yet/);
          assert.doesNotMatch(html, /Winner a|Winner b|HELD_BACK_WINNER|<article/);
        }
        assert.doesNotMatch(html, /PRIVATE_/);
        if (preview) assert.doesNotMatch(html, /<a /);
        assert.doesNotMatch(html, /Share results/);
      });
    }
    it(`${preview ? 'preview' : 'live'}: Standings-hidden suppresses every champion`, async () => {
      const data = fixture(); data.tournament.publicHiddenPages = ['standings'];
      const html = await renderPage(data, preview);
      assert.match(html, /Final results unavailable/);
      assert.doesNotMatch(html, /Winner a|Share results|<article/);
    });
  }
  it('keeps the switch-off recap, with no share button (owner 2026-11-01)', async () => {
    const html = await renderPage(fixture(), false, false);
    assert.match(html, /class="hero"/);
    assert.match(html, /the final results are in/);
    assert.doesNotMatch(html, /Share results/);
  });
  for (const preview of [false, true]) {
    it(`withholds the ${preview ? 'preview' : 'live'} recap even if an unpublished division has no games`, async () => {
      const data = fixture();
      data.divisions.push({ id: 'empty-held', name: 'Empty held division', order: 1, scheduleVisibility: 'unpublished' } as Division);
      const html = await renderPage(data, preview);
      assert.match(html, /No champions crowned yet/);
      assert.doesNotMatch(html, /Winner a|<article/);
    });
  }
  it('keeps tier winners in the shared cards without promoting the Silver winner to the headline', async () => {
    const data = fixture();
    const gold = { ...data.games[0], bracketId: 'gold', bracketLabel: 'Gold' };
    data.games = [gold, { ...gold, id: 'silver-final', bracketId: 'silver', bracketLabel: 'Silver', homeTeamId: 'a2', awayTeamId: 'a1' }];
    const html = await renderPage(data);
    assert.match(html, /Gold · Champion/); assert.match(html, /Silver Champion/);
    assert.equal((html.match(/<article/g) ?? []).length, 2);
    assert.doesNotMatch(html, /Share results/);
  });
  it('retains the club forward and leaves the legacy JSX below the frame return', () => {
    const page = readCode('app/[orgSlug]/[tournamentSlug]/champions/page.tsx');
    assert.match(page, /await forwardToOwnAddress\(orgSlug, `\/\$\{tournamentSlug\}\/champions`\)/);
    assert.ok(page.indexOf('if (frameOn) {') < page.indexOf('const heroTitle'));
  });
});

describe('the inherited tournament share image follows the frame-on Champions reveal', () => {
  it('shows decided champions using the existing image', async () => {
    assert.match(await renderImage(fixture('several')), /Winner a/);
  });
  for (const kind of ['none', 'partial', 'held', 'submitted'] as const) {
    it(`suppresses all champion names for ${kind}`, async () => {
      assert.doesNotMatch(await renderImage(fixture(kind)), /Winner a|Winner b|HELD_BACK_WINNER/);
    });
  }
  it('suppresses champions when the organizer hides Standings', async () => {
    const data = fixture(); data.tournament.publicHiddenPages = ['standings'];
    assert.doesNotMatch(await renderImage(data), /Winner a/);
  });
  it('preserves the switch-off image, including its existing partial-results behaviour', async () => {
    assert.match(await renderImage(fixture('partial'), false), /Winner a/);
  });
});

describe('Register tabs follow the existing registration CTA; the form and page stay separate', () => {
  const { getRegistrationState } = componentLoader()('lib/registration-state.ts') as {
    getRegistrationState: (t: Pick<Tournament, 'status' | 'startDate' | 'endDate'>, d: Division[], teams: Team[]) => { cta: string | null };
  };
  const open = { status: 'active' as const, startDate: '9999-12-31', endDate: '9999-12-31' };
  const division = { id: 'a', capacity: 1, isClosed: false } as Division;
  for (const state of ['open', 'waitlist', 'closed', 'started', 'completed', 'not-open'] as const) {
    it(`uses the live CTA for ${state}`, () => {
      const info = getRegistrationState({ ...open,
        status: state === 'completed' ? 'completed' : state === 'not-open' ? 'draft' : 'active',
        startDate: state === 'started' ? '2000-01-01' : open.startDate,
      }, [{ ...division, isClosed: state === 'closed' }], state === 'waitlist' ? [{ divisionId: 'a' } as Team] : []);
      const tabs = visibleTournamentTabs([], false, { hasNews: false, hasRules: false, hasChampion: false, registrationOpen: info.cta !== null });
      assert.equal(tabs.some(tab => tab.key === 'register'), state === 'open' || state === 'waitlist');
      assert.ok(!visibleTournamentTabs([], false).some(tab => tab.key === 'register'));
    });
  }
  it('live and preview layouts use the same CTA and skip hidden/invite-only registration reads', () => {
    // The preview reads them through the one shared read (Stage 1a Part 3), handed the same skip-when-hidden rule.
    assert.match(readCode('app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/layout.tsx'),
      /register: hiddenPages\.includes\('register'\) \|\| runsInviteOnlyEvents\(org\.planId\)/);
    for (const path of ['app/[orgSlug]/[tournamentSlug]/layout.tsx', 'lib/public-frame-server.ts']) {
      const source = readCode(path);
      assert.match(source, /(?:registerHidden|skip\.register) \? Promise.resolve\(null\) : getTeams/);
      assert.match(source, /tournamentFrameTabContent\(/);
      assert.match(source, /registrationCta: (?:registerCta|registration\?\.cta \?\? null)/);
    }
    assert.doesNotMatch(readCode('app/[orgSlug]/[tournamentSlug]/register/page.tsx'), /isPublicFrameOn|frameContent/);
  });
});

describe('the measured free-event promotion repair applies only inside the preview frame', () => {
  it('measures the actual banner and cleans up without changing switch-off geometry', () => {
    const banner = readCode('components/marketing/TournamentAcquisitionBanner.tsx');
    assert.match(banner, /if \(!banner \|\| !document.querySelector\('\[data-public-frame\]'\)\) return/);
    assert.match(banner, /new ResizeObserver\(publish\)/);
    assert.match(banner, /observer.disconnect\(\); root.style.removeProperty\('--public-growth-banner-h'\)/);
    const frame = readCode('components/public/TournamentFrame.module.css');
    assert.match(frame, /:global\(html\):has\(\.frame\) :global\(\[data-growth-banner\]\) button \{\s*width: 44px; height: 44px;/);
    assert.match(frame, /var\(--public-growth-banner-h, 160px\)/);
  });
});
