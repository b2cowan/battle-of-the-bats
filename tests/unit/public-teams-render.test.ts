import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { billingTestLoader } from './_billing-test-loader.ts';
import { publicTeamsData } from '../../lib/public-teams.ts';
import type { PublicTournamentPageData } from '../../lib/public-tournament-data.ts';
import type { Division, Game, PublicTeam, Tournament } from '../../lib/types.ts';
import type { DivisionStandingRow } from '../../lib/tie-breakers.ts';

const load = billingTestLoader({
  'next/navigation': { useRouter: () => ({ refresh() {} }) },
  '@/lib/use-public-pathname': { useOrgHref: () => (path: string) => `/club${path}` },
  '@/lib/follow': { isTournamentInProgress: () => false, useFollowedTeam: () => ({ followedTeamId: 'c', follow() {} }),
    useAccountFollowedTeamIds: () => new Set(['b']), unfollowTeamEverywhere() {} },
  '@/lib/hooks/usePublicTournamentLive': { usePublicTournamentLive() {} },
  './UnfollowConfirmSheet': { __esModule: true, default: () => null },
});
const Body = (load('components/public/PublicTeams.tsx') as { default: ComponentType<{
  orgSlug: string; tournamentSlug: string; isPreview?: boolean; initialData?: PublicTournamentPageData; initialNow?: string;
}> }).default;
function fixture(): PublicTournamentPageData {
  const teams = ['Alpha Rapids', 'Beta Sharks', 'Greater Riverdale Northern Lights Select Black (Johnstone)'].map((name, index) => ({
    id: ['a', 'b', 'c'][index], name, tournamentId: 't', divisionId: 'd', coach: '', status: 'accepted',
  })) as PublicTeam[];
  return { organization: { id: 'o', name: 'Club', slug: 'club', requireScoreFinalization: true },
    tournament: { id: 't', name: 'Cup', status: 'active' } as Tournament, tournaments: [], pageEnabled: true,
    divisions: [{ id: 'd', name: 'U11', scheduleVisibility: 'published', pools: [] } as unknown as Division], teams,
    games: [{ id: 'live', tournamentId: 't', divisionId: 'd', homeTeamId: 'a', awayTeamId: 'b', date: '2026-10-30', time: '10:00', status: 'scheduled', location: '' } as Game],
    standingsByDivision: { d: teams.map((t, index) => ({ teamId: t.id, teamName: t.name, w: 2 - index, l: index, t: 0 })) as DivisionStandingRow[] },
    venues: [], resources: [], rules: [], registrationFields: [] };
}
const render = (initialData = fixture(), isPreview = false) => renderToStaticMarkup(createElement(Body, {
  orgSlug: 'club', tournamentSlug: 'cup', initialData, initialNow: '2026-10-30T14:15:00Z', isPreview,
}));

describe('the real preview Teams body', () => {
  it('hides records and places when Standings is off while retaining each next game', () => {
    const data = fixture(); data.tournament!.publicHiddenPages = ['standings'];
    const filtered = publicTeamsData(data);
    assert.deepEqual(filtered.standingsByDivision, {});
    const html = render(filtered);
    assert.doesNotMatch(html, /2-0-0|0-2-0|1st|3rd|0-0-0/);
    assert.match(html, /Live now/);
  });
  it('renders All divisions, a division count and ranked rows despite following the last team', () => {
    const html = render();
    assert.match(html, /data-public-teams="ready"/);
    assert.match(html, /<option value="" selected="">All divisions<\/option>/);
    assert.match(html, /<h2[^>]*>U11<\/h2><span>3 teams<\/span>/);
    assert.deepEqual([...html.matchAll(/data-public-team-row="([^"]+)"/g)].map(m => m[1]), ['a', 'b', 'c']);
    assert.equal((html.match(/href="\/club\/cup\/teams\//g) ?? []).length, 3);
    assert.match(html, /2-0-0 · 1st · <span[^>]*>Live now<\/span> vs Beta Sharks/);
    assert.match(html, /0-2-0 · 3rd · no games scheduled yet/);
  });
  it('keeps the full base name and qualifier on separate lines without points, avatar or coach', () => {
    const html = render();
    assert.match(html, /<strong>Greater Riverdale Northern Lights Select Black<\/strong><small>Johnstone<\/small>/);
    assert.doesNotMatch(html, /PTS|teamAvatar|coach|Pool play complete|Following /);
  });
  it('draws the separate app-only stars with stable names and merged account/device pressed state', () => {
    const html = render();
    assert.equal((html.match(/class="appOnly starWrap"/g) ?? []).length, 3);
    assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 2);
    assert.equal((html.match(/aria-label="Follow /g) ?? []).length, 3);
    assert.match(html, /<\/a><span class="appOnly starWrap"><button/);
  });
  it('the admin preview has readable rows, no working links, stars or follow marks', () => {
    const html = render(fixture(), true);
    assert.equal((html.match(/data-public-team-row=/g) ?? []).length, 3);
    assert.doesNotMatch(html, /href=|aria-pressed|aria-label="Follow |starWrap|data-followed/);
  });
  it('empty and all-held-back responses contain no filters or team counts', () => {
    const empty = fixture(); empty.teams = []; empty.standingsByDivision = {};
    let html = render(empty);
    assert.match(html, /No teams yet/);
    assert.doesNotMatch(html, /<select|<input|data-public-team-row=|[0-9] teams/);
    const hidden = fixture(); hidden.divisions[0].scheduleVisibility = 'unpublished';
    html = render(publicTeamsData(hidden));
    assert.match(html, /The schedule isn&#x27;t published yet/);
    assert.doesNotMatch(html, /<select|<input|U11|Alpha|Beta|data-public-team-row=|[0-9] teams/);
  });
  it('keeps Teams unavailable and the quiet initial loading state', () => {
    const hidden = fixture(); hidden.pageEnabled = false;
    assert.match(render(hidden), /Teams unavailable/);
    assert.doesNotMatch(render(hidden), /<select|data-public-team-row=/);
    const html = renderToStaticMarkup(createElement(Body, { orgSlug: 'club', tournamentSlug: 'cup' }));
    assert.match(html, /Loading teams…/);
    assert.doesNotMatch(html, /<select|data-public-team-row=/);
  });
});
