import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { billingTestLoader } from './_billing-test-loader.ts';
import { publishedCompetitionData } from '../../lib/public-standings.ts';
import type { PublicTournamentPageData } from '../../lib/public-tournament-data.ts';
import type { Division, Game, Tournament } from '../../lib/types.ts';
import type { DivisionStandingRow } from '../../lib/tie-breakers.ts';

// Reuse the repo's TSX loader: React renders the shipped body, with only its feed/follow/bracket boundaries adapted.
const load = billingTestLoader({
  'next/navigation': { useRouter: () => ({ refresh() {} }) },
  '@/lib/use-public-pathname': { useOrgHref: () => (path: string) => `/club${path}` },
  '@/lib/follow': { useFollowedTeam: () => ({ followedTeamId: null }), isTournamentInProgress: () => false },
  '@/lib/hooks/usePublicTournamentLive': { usePublicTournamentLive() {} },
  '@/components/bracket/TieredBracket': { TieredBracket: () => createElement('div', { 'data-retained-bracket': 'yes' }) },
});
const Body = (load('components/public/PublicStandings.tsx') as { default: ComponentType<{
  orgSlug: string; tournamentSlug: string; isPreview?: boolean; initialData: PublicTournamentPageData;
}> }).default;
const row = (id: string, name: string, poolId?: string): DivisionStandingRow => ({
  teamId: id, teamName: name, poolId, gp: 3, w: 2, l: 1, t: 0, pts: 4, rf: 18, ra: 6, rd: 8, rdRaw: 12,
  runDiffCap: 7, needsCoinToss: false, coinTossGroupKey: null, hasPendingGame: true,
});
const division = { id: 'd', name: 'U11', scheduleVisibility: 'published', pools: [], playoffConfig: { teamsQualifying: 1 } } as unknown as Division;
function fixture(): PublicTournamentPageData {
  return {
    organization: { id: 'o', name: 'Club', slug: 'club', requireScoreFinalization: true, contactEmail: 'hidden@example.test' },
    tournament: { id: 't', slug: 'cup', name: 'Cup', status: 'active' } as Tournament,
    tournaments: [], pageEnabled: true, divisions: [division], games: [], teams: [], venues: [], resources: [], rules: [], registrationFields: [],
    standingsByDivision: { d: [row('winner', 'Engine’s first team'), row('second', 'Other team (Coach)')] },
  };
}
const render = (initialData = fixture(), isPreview = true) => renderToStaticMarkup(createElement(Body, {
  orgSlug: 'club', tournamentSlug: 'cup', initialData, isPreview,
}));

describe('the real Standings body’s initial render', () => {
  it('keeps the engine’s order, true/capped differential and quiet team marks in the table-first body', () => {
    const html = render();
    assert.ok(html.indexOf('Engine’s first team') < html.indexOf('Other team'));
    assert.match(html, /\+12/);
    assert.match(html, /\(\+8\)/);
    assert.match(html, /aria-label="First place"/);
    assert.match(html, /aria-label="In a playoff spot"/);
    assert.match(html, /aria-label="Includes an unofficial score"/);
    assert.ok(html.indexOf('<table') < html.indexOf('How the table is ranked'));
    assert.match(html, /aria-expanded="false"/);
    assert.doesNotMatch(html, /Recent Scores|MyTeamCard|<a\b|data-followed|hidden@example/);
  });
  it('shows each pool separately, with one ranking disclosure for the division', () => {
    const data = fixture();
    data.divisions = [{ ...division, pools: [
      { id: 'a', divisionId: 'd', name: 'A', order: 0 }, { id: 'b', divisionId: 'd', name: 'B', order: 1 },
    ] }];
    data.standingsByDivision.d = [row('a1', 'Pool A team', 'a'), row('b1', 'Pool B team', 'b')];
    const html = render(data);
    assert.match(html, /Standings · A Pool/);
    assert.match(html, /Standings · B Pool/);
    assert.equal((html.match(/<table\b/g) ?? []).length, 2);
    assert.equal((html.match(/How the table is ranked/g) ?? []).length, 1);
  });
  it('links to Playoffs without a bracket, and never exposes a door in the admin preview or exhibition', () => {
    const data = fixture();
    data.games = [{ id: 'playoff', divisionId: 'd', isPlayoff: true }] as Game[];
    const html = render(data, false);
    assert.doesNotMatch(html, /data-retained-bracket|data-sandbox-tour="playoff-bracket"/);
    assert.match(html, /href="\/club\/cup\/playoffs"/);
    assert.doesNotMatch(render(data), /The playoff bracket/);
    data.tournament = { ...data.tournament!, settings: { format: 'exhibition' } };
    assert.doesNotMatch(render(data, false), /data-retained-bracket|Top 1|The playoff bracket/);
  });
  it('renders empty and withdrawn states without hidden names, counts or seed information', () => {
    const data = fixture();
    data.divisions = [{ ...division, name: 'Hidden division', scheduleVisibility: 'unpublished' }];
    const html = render(publishedCompetitionData(data));
    assert.match(html, /No standings yet/);
    assert.doesNotMatch(html, /Hidden division|Engine’s first team|Top 1|data-standings-counts|<select/);
    data.pageEnabled = false;
    assert.match(render(data), /Standings unavailable/);
    assert.doesNotMatch(render(data), /Hidden division|Engine’s first team|<table/);
  });
});
