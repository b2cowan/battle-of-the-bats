import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { billingTestLoader } from './_billing-test-loader.ts';
import { publishedCompetitionData } from '../../lib/public-standings.ts';
import type { PublicTournamentPageData } from '../../lib/public-tournament-data.ts';
import type { Division, Game, PublicTeam, Tournament } from '../../lib/types.ts';
import type { DivisionStandingRow } from '../../lib/tie-breakers.ts';

const load = billingTestLoader({
  'next/navigation': { useRouter: () => ({ refresh() {} }) },
  '@/lib/use-public-pathname': { useOrgHref: () => (path: string) => `/club${path}` },
  '@/lib/follow': { isTournamentInProgress: () => false },
  '@/lib/hooks/usePublicTournamentLive': { usePublicTournamentLive() {} },
  './LogicSyncBracket': { LogicSyncBracket: () => createElement('div', { 'data-legacy-bracket': true }) },
});
const Body = (load('components/public/PublicPlayoffs.tsx') as { default: ComponentType<{
  orgSlug: string; tournamentSlug: string; initialData: PublicTournamentPageData; initialNow: string;
}> }).default;
const now = '2026-10-30T14:15:00Z';
const game = (patch: Partial<Game>): Game => ({ id: '', tournamentId: 't', divisionId: 'd', homeTeamId: 'a', awayTeamId: 'b',
  date: '2026-10-29', time: '10:00', location: 'Diamond 2', status: 'completed', isPlayoff: true, homeScore: 6, awayScore: 3, ...patch });
function fixture(): PublicTournamentPageData {
  const teams = ['Alpha Rapids', 'Beta Sharks', 'Cedar Cyclones', 'Delta Marauders'].map((name, index) => ({
    id: ['a', 'b', 'c', 'd'][index], tournamentId: 't', divisionId: 'd', name, status: 'accepted', coach: '',
  })) as PublicTeam[];
  const rows = teams.map((team, index) => ({ teamId: team.id, teamName: team.name, gp: 3, w: 3 - index, l: index, t: 0,
    pts: 6 - 2 * index, rf: 20 - index, ra: 5 + index, rd: 10 - index, rdRaw: 10 - index,
    runDiffCap: null, needsCoinToss: false, coinTossGroupKey: null, hasPendingGame: false })) as DivisionStandingRow[];
  return { organization: { id: 'o', name: 'Club', slug: 'club', requireScoreFinalization: true },
    tournament: { id: 't', name: 'Cup', slug: 'cup', status: 'active' } as Tournament, tournaments: [], pageEnabled: true,
    divisions: [{ id: 'd', name: 'U11', scheduleVisibility: 'published', pools: [], playoffConfig: { teamsQualifying: 2, format: 'single' } } as unknown as Division],
    teams, games: [game({ id: 'sf1', bracketCode: 'SF1' }), game({ id: 'sf2', bracketCode: 'SF2', homeTeamId: 'c', awayTeamId: 'd' }),
      game({ id: 'fin', bracketCode: 'FIN', homeTeamId: 'a', awayTeamId: 'c', homePlaceholder: 'Winner SF1', awayPlaceholder: 'Winner SF2',
        date: '2026-10-30', time: '10:00', status: 'scheduled', homeScore: 3, awayScore: 2 })],
    venues: [], resources: [], rules: [], registrationFields: [], standingsByDivision: { d: rows } };
}
const render = (initialData = fixture()) => renderToStaticMarkup(createElement(Body, { orgSlug: 'club', tournamentSlug: 'cup', initialData, initialNow: now }));

describe('the real Playoffs body and preview bracket', () => {
  it('puts the live game before its readable bracket and the collapsed seeding explanation', () => {
    const html = render();
    assert.match(html, /data-public-playoffs="live"/);
    assert.ok(html.indexOf('data-public-playoff-game="fin"') < html.indexOf('data-sandbox-tour="playoff-bracket"'));
    assert.ok(html.indexOf('data-sandbox-tour="playoff-bracket"') < html.indexOf('How seeding works'));
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, /Directions to Diamond 2/);
    assert.match(html, /The winner takes the title/);
    assert.match(html, /Best offence/); assert.match(html, /Stingiest defence/); assert.match(html, /Playoff cut line/);
    assert.doesNotMatch(html, /Best offense|Stingiest defense|data-legacy-bracket|Full Bracket/);
    assert.equal((html.match(/data-bracket-game=/g) ?? []).length, 3);
    assert.doesNotMatch(html, /aria-label="Full screen"/, 'four-team brackets fit without controls');
  });
  it('shows No score yet in both the live card and bracket without inventing scores', () => {
    const data = fixture(); Object.assign(data.games[2], { homeScore: null, awayScore: null });
    const html = render(data);
    assert.ok((html.match(/No score yet/g) ?? []).length >= 2);
    const card = html.slice(html.indexOf('data-public-playoff-game="fin"'), html.indexOf('</article>'));
    assert.doesNotMatch(card, /<b>0<\/b>/);
  });
  it('keeps an upcoming championship with an unresolved side in fan words', () => {
    const data = fixture(); data.games[1].status = 'submitted';
    Object.assign(data.games[2], { time: '16:00', homeScore: null, awayScore: null, awayTeamId: '' });
    const html = render(data);
    assert.match(html, /data-public-playoffs="upcoming"/);
    assert.match(html, /Semifinal 2 winner/);
    assert.match(html, /Up next/);
    assert.doesNotMatch(html, /Winner of SF2|data-public-playoffs="champion"/);
  });
  it('replaces next-game content with the shared champion card only when all playoffs are terminal', () => {
    const data = fixture(); Object.assign(data.games[2], { status: 'completed', homeScore: 4, awayScore: 2 });
    const html = render(data);
    assert.match(html, /data-public-playoffs="champion"/);
    assert.match(html, /Beat Cedar Cyclones 4–2 in the championship/);
    assert.doesNotMatch(html, /data-public-playoff-game=|Up next/);
  });
  it('keeps full long names and all seven links in an eight-team bracket with zoom/full-screen controls', () => {
    const data = fixture(); data.tournament!.settings = { format: 'playoff_only' };
    data.teams[0].name = 'Hamilton-Wentworth Girls Fastpitch Development';
    data.games = ['QF1', 'QF2', 'QF3', 'QF4', 'SF1', 'SF2', 'FIN'].map((code, index) => game({ id: code, bracketCode: code,
      status: 'scheduled', date: '2026-10-31', time: '10:00', homeScore: null, awayScore: null,
      homeTeamId: index < 4 ? 'a' : '', awayTeamId: index < 4 ? 'b' : '',
      homePlaceholder: 'Winner SF1', awayPlaceholder: 'Winner SF2' }));
    const html = render(data);
    assert.match(html, /Hamilton-Wentworth Girls Fastpitch Development/);
    assert.match(html, /aria-label="Zoom in"/); assert.match(html, /aria-label="Fit bracket"/); assert.match(html, /aria-label="Full screen"/);
    assert.equal((html.match(/data-bracket-game=/g) ?? []).length, 7);
    assert.doesNotMatch(html, /data-legacy-bracket|Standings unavailable/);
  });
  it('has no held-back division, team, seed or next game in the unavailable and empty states', () => {
    const data = fixture(); data.divisions[0].scheduleVisibility = 'unpublished';
    const html = render(publishedCompetitionData(data));
    assert.match(html, /The bracket isn&#x27;t set yet/);
    assert.doesNotMatch(html, /Alpha Rapids|U11|data-bracket-game|data-public-playoff-game/);
    data.pageEnabled = false;
    assert.match(render(data), /Playoff Picture unavailable/);
    assert.doesNotMatch(render(data), /Alpha Rapids|U11|data-bracket-game/);
  });
});
