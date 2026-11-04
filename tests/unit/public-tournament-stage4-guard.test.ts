import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { between, cssRule, filesUnder, readCode, readSource, sourceExists } from './_source-code.ts';
import { publicFrameGame } from '../../lib/public-teams.ts';
import type { Game } from '../../lib/types.ts';

const STANDINGS_PAGE = 'app/[orgSlug]/[tournamentSlug]/standings/page.tsx';
/** The old client wrapper — the server page renders PublicStandings directly since Stage 8 Part 3a. */
const STANDINGS_CLIENT = 'app/[orgSlug]/[tournamentSlug]/standings/StandingsPageClient.tsx';
const PLAYOFFS_PAGE = 'app/[orgSlug]/[tournamentSlug]/playoffs/page.tsx';
const PREVIEW = 'app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/[section]/page.tsx';

/** Follow the rendered public components, not just a direct bracket import (Part 1 delegates to the old body). */
function bracketOwners(file: string, visited = new Set<string>()): Set<string> {
  if (visited.has(file)) return new Set();
  visited.add(file);
  const code = readCode(file);
  const owners = new Set<string>();
  if (/<TieredBracket\b/.test(code)) owners.add(file);
  for (const match of code.matchAll(/import (\w+) from ['"]([^'"]+)['"]/g)) {
    const [, name, from] = match;
    if (!new RegExp(`<${name}\\b`).test(code)) continue;
    const child = from.startsWith('@/components/public/') ? from.slice(2) + '.tsx'
      : from.startsWith('./') ? file.slice(0, file.lastIndexOf('/') + 1) + from.slice(2) + '.tsx' : null;
    if (child && filesUnder('components/public', '.tsx').includes(child)) {
      for (const owner of bracketOwners(child, visited)) owners.add(owner);
    }
  }
  return owners;
}

describe('Stage 4 Part 1: Standings and Playoffs each have one body (Stage 8 Parts 3a and 3c)', () => {
  it('Standings and Playoffs render only the new body, straight from the server page, after the forward', () => {
    const server = readCode(STANDINGS_PAGE);
    assert.match(server, /return <PublicStandings orgSlug=\{orgSlug\} tournamentSlug=\{tournamentSlug\} \/>/);
    assert.doesNotMatch(server, /isPublicFrameOn|frameOn/);
    const page = readCode(PLAYOFFS_PAGE);
    assert.doesNotMatch(page, /isPublicFrameOn|frameOn|legacyBody|getOrganizationBySlug|PlayoffPicture\.module|schedule\.module/);
    const forward = page.indexOf("await forwardToOwnAddress(orgSlug, `/${tournamentSlug}/playoffs`)");
    const read = page.indexOf("getPublicTournamentPageData(orgSlug, tournamentSlug, 'playoffs')");
    assert.ok(forward > -1 && read > forward, 'the forward runs before the read');
    assert.match(page, /if \(!initialData\?\.tournament\) notFound\(\);\s*return <PublicPlayoffs orgSlug=\{orgSlug\} tournamentSlug=\{tournamentSlug\} initialData=\{initialData\}/);
    assert.equal((page.match(/return </g) ?? []).length, 1, 'one body');
    assert.doesNotMatch(readCode('components/public/PublicPlayoffs.tsx'), /legacyBody|children/);
  });
  it('the old Standings and Playoffs bodies and their styles are gone', () => {
    for (const path of ['components/public/StandingsContent.tsx', STANDINGS_CLIENT, 'app/[orgSlug]/standings/standings.module.css',
      'components/public/PlayoffPicture.module.css', 'app/[orgSlug]/schedule/schedule.module.css']) {
      assert.ok(!sourceExists(path), `${path} is back`);
    }
  });
  it('exactly one frame-on page owns the bracket, now on Playoffs with both doors pointing there', () => {
    const standings = bracketOwners('components/public/PublicStandings.tsx');
    const playoffs = bracketOwners('components/public/PublicPlayoffs.tsx');
    assert.equal(Number(standings.size > 0) + Number(playoffs.size > 0), 1, 'never both or neither');
    assert.equal(standings.size, 0);
    assert.deepEqual([...playoffs], ['components/public/PublicPlayoffs.tsx']);
    assert.doesNotMatch(readCode(PLAYOFFS_PAGE), /<TieredBracket\b/);
    assert.match(readCode('lib/public-schedule.ts'), /SCHEDULE_BRACKET_DOOR = \{ path: 'playoffs', label: 'The playoff bracket' \}/);
    assert.match(readCode('components/public/PublicSchedule.tsx'), /hasPublicPlayoffBracket\(tournament, divisions, games\)/);
  });
  it('admin preview renders the new Standings body without adding a Playoffs section', () => {
    const preview = readCode(PREVIEW);
    const standings = between(preview, "if (section === 'standings')", "if (section === 'teams')");
    assert.match(standings, /return <PublicStandings[^;]+isPreview initialData=\{publishedCompetitionData\(initialData\)\}/);
    assert.doesNotMatch(standings, /isPublicFrameOn|frameOn/);
    const sections = preview.match(/const VALID_SECTIONS = new Set\(\[([^\]]+)\]/)![1];
    assert.doesNotMatch(sections, /playoffs/);
    assert.match(readCode('components/public/TournamentTopTabs.tsx'), /hasBracket/);
  });
});

describe('Stage 4 Part 2: the table-first body follows the revised drawing', () => {
  const body = readCode('components/public/PublicStandings.tsx');
  const css = readSource('components/public/PublicStandings.module.css');
  it('uses a separate, server-filtered preview feed and the old feed retains its fallback', () => {
    const data = readCode('lib/public-tournament-data.ts');
    assert.match(body, /fetchPublicTournamentData\(orgSlug, tournamentSlug, 'standings-preview'\)/);
    assert.match(data, /section === 'standings-preview' \? 'standings' : section/);
    assert.match(data, /if \(section === 'standings-preview' \|\| section === 'playoffs'\) \{[\s\S]*?const published = publishedCompetitionData\(\{[\s\S]*?return \{ \.\.\.published, games: published\.games\.map\(publicFrameGame\) \};/);
    assert.doesNotMatch(data, /section === 'standings'/, 'the plain standings section is gone');
    // PRIVACY (Stage 8 Part 3c /review): those games reach the browser, so the scrub must actually remove the private fields.
    const game = { id: 'g', notes: 'PRIVATE_NOTE', scoreSubmittedByEmail: 'keeper@example.com', scoreSubmittedByUserId: 'u1',
      scoreSubmittedAt: '2026-11-04T10:00:00Z', scoreSubmissionSource: 'scorekeeper', homeScore: 4, awayScore: 2 } as unknown as Game;
    const scrubbed = publicFrameGame(game);
    for (const key of ['notes', 'scoreSubmittedByEmail', 'scoreSubmittedByUserId', 'scoreSubmittedAt', 'scoreSubmissionSource']) {
      assert.ok(!(key in scrubbed), `${key} reaches the browser`);
    }
    assert.equal(scrubbed.homeScore, 4, 'the game facts stay');
    assert.equal(game.notes, 'PRIVATE_NOTE', 'the server copy is untouched');
    assert.match(readCode('app/api/public/tournament-data/route.ts'), /'standings-preview'/);
    assert.match(body, /enabled: !isPreview && isTournamentInProgress/);
    assert.match(body, /setFetched\(next\)/);
  });
  it('puts the table before the single ranking disclosure and the Playoffs door, with no bracket', () => {
    assert.ok(body.indexOf('<table ') < body.indexOf('<PublicDisclosure'));
    assert.ok(body.indexOf('<PublicDisclosure') < body.indexOf('<PublicDoorRow'));
    assert.equal((body.match(/<PublicDisclosure/g) ?? []).length, 1);
    assert.doesNotMatch(body, /Recent Scores|MyTeamCard|TieredBracket|YearSelector|<StandingsContent/);
    assert.match(body, /showPlayoffsDoor = !isPreview && hasPublicPlayoffBracket/);
    assert.match(body, /<PublicDisclosure title="How the table is ranked"/);
  });
  it('pins only the Team column, fixes it at 150 px on a phone, and supplies an opaque ground to every row cell', () => {
    assert.match(cssRule(css, '.table .teamCol'), /position: sticky; left: 0/);
    assert.match(cssRule(css, '.table .teamCol'), /width: 150px; min-width: 150px; max-width: 150px/);
    assert.match(cssRule(css, '.table'), /width: 376px;/);
    assert.doesNotMatch(cssRule(css, '.table .ptsCol'), /position: sticky/);
    assert.match(cssRule(css, '.table .ptsCol'), /width: 40px/);
    assert.match(cssRule(css, '.table th, .table td'), /background: var\(--club-card\)/);
    assert.match(cssRule(css, '.table th, .table td'), /font: inherit; letter-spacing: normal; text-transform: none/);
    assert.match(cssRule(css, '.table tr[data-top] > *'), /background: var\(--club-ground\)/);
    assert.match(cssRule(css, '.differential'), /flex-wrap: wrap/);
  });
  it('a followed-team mark is installed-app only; the preview has neither follow marks nor destinations', () => {
    assert.match(css, /@media \(display-mode: standalone\) \{\s*\.table tr\[data-followed\] > \.teamCol \{ box-shadow:/);
    assert.equal((css.match(/data-followed/g) ?? []).length, 1);
    assert.match(body, /data-followed=\{!isPreview && row.teamId === followedTeamId/);
    assert.doesNotMatch(body, /<Link|highlightTeamId=|selectTeamGames|matchMedia/);
  });
});

describe('Stage 4 Part 3: a live, published-only Playoffs body', () => {
  it('uses the bracket visibility gate for its own feed, not the format-hidden Standings or Schedule page', () => {
    const data = readCode('lib/public-tournament-data.ts');
    assert.match(data, /section === 'playoffs' \? isPublicBracketVisible\(tournament\)/);
    assert.match(readCode('app/api/public/tournament-data/route.ts'), /'playoffs'/);
    const body = readCode('components/public/PublicPlayoffs.tsx');
    assert.match(body, /section: 'playoffs'/);
    assert.match(body, /setData\(next\); setClock\(new Date\(\)\)/);
    assert.match(body, /competitionShellSignature\(next\) !== competitionShellSignature\(data\)\) router.refresh\(\)/);
    assert.match(body, /getDivisionPref\(orgSlug\)/);
    assert.doesNotMatch(body, /followedTeamId|readFollowed|ScoreTicker|TodaysResultsLine|Full Bracket|Playoff schedule/);
  });
  it('reuses the game-card and seeding builders; the bracket anchor follows the move', () => {
    const body = readCode('components/public/PublicPlayoffs.tsx');
    assert.match(body, /<PublicLiveCard/);
    assert.match(body, /buildPlayoffPicture\(/);
    assert.match(body, /<PublicDisclosure title="How seeding works"/);
    assert.match(body, /data-sandbox-tour="playoff-bracket"/);
    assert.match(body, /requireFinalization=\{requireFinalization\} now=\{clock\} \/>/);
    assert.ok(body.indexOf('<PublicLiveCard') < body.indexOf('<TieredBracket'));
  });
  it('draws only the public bracket: the old SVG bracket, its styles and its types are gone (Stage 8 Part 3c)', () => {
    const tiered = readCode('components/bracket/TieredBracket.tsx');
    assert.match(tiered, /publicBracketSections\(games, teams, pools\)\.map/);
    assert.match(tiered, /<PublicBracket games=\{section\.games\}/);
    assert.doesNotMatch(tiered, /publicFrame|LogicSyncBracket|bracketHasPools|inferGamePool|SectionHeader/);
    for (const path of ['components/bracket/LogicSyncBracket.tsx', 'components/bracket/LogicSyncBracket.module.css', 'lib/types/bracket.ts']) {
      assert.ok(!sourceExists(path), `${path} is back`);
    }
    assert.doesNotMatch(readCode('lib/playoff-bracket.ts'), /export function inferGamePool\b/);
    const preview = readCode('components/bracket/PublicBracket.tsx');
    assert.match(preview, /publicBracketRounds\(games\)/);
    assert.match(preview, /publicGameDetailView\(game/);
    assert.match(preview, /aria-modal=\{expanded \|\| undefined\}/);
    assert.match(preview, /event.key === 'Escape'/);
    assert.doesNotMatch(preview, /supabase|truncName|slice\(0, 20\)/);
  });
});
