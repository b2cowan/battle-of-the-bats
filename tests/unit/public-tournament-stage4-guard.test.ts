import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { cssRule, filesUnder, readCode, readSource } from './_source-code.ts';

const STANDINGS_PAGE = 'app/[orgSlug]/[tournamentSlug]/standings/page.tsx';
const STANDINGS_CLIENT = 'app/[orgSlug]/[tournamentSlug]/standings/StandingsPageClient.tsx';
const PLAYOFFS_PAGE = 'app/[orgSlug]/[tournamentSlug]/playoffs/page.tsx';
const PREVIEW = 'app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/[section]/page.tsx';
const digest = (text: string) => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');

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

describe('Stage 4 Part 1: both pages have one server-decided preview branch', () => {
  it('the Standings server asks the switch and both clients preserve their legacy fallback', () => {
    assert.match(readCode(STANDINGS_PAGE), /const frameOn = await isPublicFrameOn\(\);/);
    assert.match(readCode(STANDINGS_PAGE), /<StandingsPageClient frameOn=\{frameOn\} \/>/);
    assert.match(readCode(STANDINGS_CLIENT), /if \(frameOn\) return <PublicStandings/);
    assert.match(readCode(STANDINGS_CLIENT), /<StandingsContent\b/);
    const page = readCode(PLAYOFFS_PAGE);
    assert.match(page, /const frameOn = await isPublicFrameOn\(\);/);
    assert.match(page, /if \(frameOn\) \{[\s\S]*getPublicTournamentPageData\(orgSlug, tournamentSlug, 'playoffs'\)/);
    assert.match(page, /return <PublicPlayoffs[^;]+initialData=\{initialData\}/);
    assert.ok(page.indexOf('return <PublicPlayoffs') < page.indexOf('const org = await getOrganizationBySlug'));
    assert.match(page, /return legacyBody;/);
    assert.doesNotMatch(readCode('components/public/PublicPlayoffs.tsx'), /legacyBody|children/);
  });
  it('the old Standings source and Playoffs JSX are byte-for-byte preserved', () => {
    assert.equal(digest(readSource('components/public/StandingsContent.tsx')), 'fd1bd4d471c4b00690fca96251a804d85e457d17ecc086338a31441762ba13e3');
    const page = readSource(PLAYOFFS_PAGE).replace(/\r\n/g, '\n');
    const start = page.indexOf('  const legacyBody = ') + '  const legacyBody = '.length;
    const end = page.indexOf('\n  return legacyBody;', start);
    assert.equal(digest(page.slice(start, end)), '5dfaa54531b4faa0b213e21eea8ff62ffc0f13e26be58d34fd18d58dd09324d6');
  });
  it('exactly one frame-on page owns the bracket, now on Playoffs with both doors pointing there', () => {
    const standings = bracketOwners('components/public/PublicStandings.tsx');
    const playoffs = bracketOwners('components/public/PublicPlayoffs.tsx');
    assert.equal(Number(standings.size > 0) + Number(playoffs.size > 0), 1, 'never both or neither');
    assert.equal(standings.size, 0);
    assert.deepEqual([...playoffs], ['components/public/PublicPlayoffs.tsx']);
    assert.doesNotMatch(readCode(PLAYOFFS_PAGE), /<TieredBracket\b/);
    assert.match(readCode('lib/public-schedule.ts'), /SCHEDULE_BRACKET_DOOR = \{ path: 'playoffs', label: 'The bracket', sub: 'On the Playoffs tab' \}/);
    assert.match(readCode('components/public/PublicSchedule.tsx'), /hasPublicPlayoffBracket\(tournament, divisions, games\)/);
  });
  it('admin preview adopts the Standings branch without adding a Playoffs section', () => {
    const preview = readCode(PREVIEW);
    assert.match(preview, /if \(frameOn\) return <PublicStandings[^;]+isPreview initialData=\{publishedCompetitionData\(initialData\)\}/);
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
    assert.match(data, /return section === 'standings-preview' \|\| section === 'playoffs' \? publishedCompetitionData\(data\) : data;/);
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
  it('pins both ends, fixes Team at 150 px on a phone, and supplies an opaque ground to every row cell', () => {
    assert.match(cssRule(css, '.table .teamCol'), /position: sticky; left: 0/);
    assert.match(cssRule(css, '.table .teamCol'), /width: 150px; min-width: 150px; max-width: 150px/);
    assert.match(cssRule(css, '.table'), /width: 462px;/);
    assert.match(cssRule(css, '.table .ptsCol'), /position: sticky; right: 0/);
    assert.match(cssRule(css, '.table .ptsCol'), /width: 52px/);
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
    assert.match(body, /publicFrame now=\{clock\}/);
    assert.ok(body.indexOf('<PublicLiveCard') < body.indexOf('<TieredBracket'));
  });
  it('keeps all legacy bracket styles and renderer choices behind the opt-in', () => {
    const tiered = readCode('components/bracket/TieredBracket.tsx');
    assert.match(tiered, /publicFrame = false/);
    assert.match(tiered, /if \(publicFrame\) return/);
    assert.ok(tiered.indexOf('<PublicBracket') < tiered.indexOf('const bracketHasPools'));
    assert.match(tiered, /return <LogicSyncBracket games=\{games\}/);
    const preview = readCode('components/bracket/PublicBracket.tsx');
    assert.match(preview, /publicBracketRounds\(games\)/);
    assert.match(preview, /publicGameDetailView\(game/);
    assert.match(preview, /aria-modal=\{expanded \|\| undefined\}/);
    assert.match(preview, /event.key === 'Escape'/);
    assert.doesNotMatch(preview, /supabase|truncName|slice\(0, 20\)/);
  });
});
