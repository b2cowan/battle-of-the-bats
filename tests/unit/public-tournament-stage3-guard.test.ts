import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { between, readCode, readSource, sourceExists } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * PUBLIC TOURNAMENT PAGES — STAGE 3: THE NEW SCHEDULE AND A GAME'S PAGE (built 2026-10-28 behind the preview switch).
 * Plan: docs/projects/active/PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md §9; build prompt PUBLIC_TOURNAMENT_STAGE3_BUILD_PROMPT.md.
 * Rulings: Ask 17 (the ticker leaves the Schedule and a game's page), Ask 15, the installed-app-only rulings.
 *
 * Stage 8 Part 3b (docs/projects/active/PUBLIC_TOURNAMENT_STAGE8_PLAN.md §13) deleted the old halves: the Schedule, the
 * admin preview's Schedule section and a game's page each render their new body with no switch, and the old bodies, the
 * client wrapper, and the parts only they drew are gone. Part 3c (§14) took the old Schedule sheet's last remnant (the
 * LIVE chip the old Playoffs drew) and the game's share image's switch branch. The switch itself lives on until Part 4.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const SCHEDULE_PAGE = 'app/[orgSlug]/[tournamentSlug]/schedule/page.tsx';
const PREVIEW = 'app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/[section]/page.tsx';

describe('the Schedule has one body', () => {
  it('the server page forwards first, then renders the new Schedule with no switch', () => {
    const page = readCode(SCHEDULE_PAGE);
    assert.ok(page.indexOf('await forwardToOwnAddress(orgSlug, `/${tournamentSlug}/schedule`);') > -1);
    assert.ok(page.indexOf('forwardToOwnAddress(') < page.indexOf('return <PublicSchedule'));
    assert.match(page, /return <PublicSchedule orgSlug=\{orgSlug\} tournamentSlug=\{tournamentSlug\} \/>/);
    assert.doesNotMatch(page, /isPublicFrameOn|frameOn|ScheduleContent|SchedulePageClient/);
  });

  it('the old body, its client wrapper and the parts only it drew stay deleted', () => {
    for (const path of [
      'components/public/ScheduleContent.tsx',
      'app/[orgSlug]/[tournamentSlug]/schedule/SchedulePageClient.tsx',
      'components/YearSelector.tsx', 'components/YearSelector.module.css',
      'components/public/MyTeamCard.tsx', 'components/public/MyTeamCard.module.css',
    ]) {
      assert.ok(!sourceExists(path), `${path} is back`);
    }
  });

  it('the admin preview\'s Schedule section renders the same body over published-only data, with no switch', () => {
    const schedule = between(readCode(PREVIEW), "if (section === 'schedule')", "if (section === 'standings')");
    assert.match(schedule, /games: onlyPublishedGames\(rawGames, divisions\)/);
    assert.match(schedule, /return <PublicSchedule[^;]+isPreview initialData=\{publicTeamsData\(initialData\)\}/);
    assert.doesNotMatch(schedule, /isPublicFrameOn|frameOn|ScheduleContent/);
  });

  it('the old Schedule\'s sheet is gone with its last importer, the old Playoffs (Stage 8 Part 3c)', () => {
    assert.ok(!sourceExists('app/[orgSlug]/schedule/schedule.module.css'), 'the old Schedule sheet is back');
    assert.doesNotMatch(readCode('app/[orgSlug]/[tournamentSlug]/playoffs/page.tsx'), /liveStyles|schedule\.module/);
  });

  it('the new parts and model are used only by the guarded Schedule or explicit shared-part variants', () => {
    const schedule = readCode('components/public/PublicSchedule.tsx');
    assert.ok(schedule.includes('PublicSchedule.module.css'));
    assert.match(schedule, /from '@\/lib\/public-schedule'/);
    assert.match(readCode('components/public/PublicGameRow.tsx'), /if \(schedule\)/);
    assert.match(readCode('components/public/PublicLiveCard.tsx'), /if \(schedule\) return/);
    assert.match(readCode('components/public/PublicSchedule.module.css'), /\.schedule/);
  });

  it('preview rows have no destinations or maps, and cannot poll public data over initialData', () => {
    const schedule = readCode('components/public/PublicSchedule.tsx');
    assert.match(schedule, /isPreview \? undefined : orgHref/);
    assert.doesNotMatch(schedule, /gameDirections|DirectionsLink|resolveGameFieldLabel/);
    assert.match(schedule, /enabled: !isPreview && isTournamentInProgress/);
    assert.match(schedule, /if \(initialData\) return/);
  });

  it('My games and calendar use the existing display-mode class, never a script-based visibility check', () => {
    const schedule = readCode('components/public/PublicSchedule.tsx');
    assert.equal((schedule.match(/parts\.appOnly/g) ?? []).length, 2);
    assert.doesNotMatch(schedule, /matchMedia|navigator\.standalone/);
  });

  it('a development mount replay cannot erase a deep link after its URL was cleaned', () => {
    const schedule = readCode('components/public/PublicSchedule.tsx');
    assert.match(schedule, /pendingHighlight = useRef<string \| null \| undefined>\(undefined\)/);
    assert.match(schedule, /if \(pendingHighlight.current === undefined\) \{/);
  });
});

describe('a game\'s page and desktop (Part 3)', () => {
  const file = 'app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/page.tsx';
  it('the game body follows the published-only lookup, with no switch', () => {
    const page = readCode(file);
    assert.match(page, /getPublicTournamentPageData\(orgSlug, tournamentSlug, 'schedule'\)/);
    assert.ok(page.indexOf('if (!game) notFound();') > -1);
    assert.ok(page.indexOf('if (!game) notFound();') < page.indexOf('return <PublicGameDetails'));
    assert.doesNotMatch(page, /isPublicFrameOn|frameOn/);
    const body = readCode('components/public/PublicGameDetails.tsx');
    assert.match(body, /publicGameDetailView\(game/);
    assert.match(body, /PublicGameDetails.module.css/);
    // Directions is the small control beside the address (symbol alone on a phone), never a full-width primary button (owner 2026-10-29).
    assert.match(body, /<DirectionsLink href/);
    assert.doesNotMatch(body, /<DirectionsLink primary/);
    assert.match(body, /<PublicFactsList/);
    assert.doesNotMatch(body, /TeamFollowStar|from '@\/lib\/follow'/);
    assert.match(body, /view.hasScore && <ShareScoreButton iconOnly/);
  });
  it('the old game body, its helpers, its sheet and the follow star only it drew stay deleted', () => {
    const page = readCode(file);
    assert.doesNotMatch(page, /getStatusBadge|getVenueDisplay|getTeamDisplay|TeamFollowStar|schedule\.module\.css|className=\{styles\./);
    for (const path of ['components/public/TeamFollowStar.tsx', 'components/public/TeamFollowStar.module.css']) {
      assert.ok(!sourceExists(path), `${path} is back`);
    }
  });
  it('the page\'s title, description and share image use the new names and rounds always (the image since Part 3c)', () => {
    const metadata = between(readCode(file), 'export async function generateMetadata', 'export default async function');
    assert.match(metadata, /const view = publicGameDetailView\(game, /);
    assert.doesNotMatch(metadata, /isPublicFrameOn|frameOn/);
    const og = readCode('app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx');
    assert.match(og, /const view = publicGameDetailView\(game, \{ \.\.\.data, requireFinalization \}\);/);
    assert.match(og, /const away = view\.sides\[0\]\.name;/);
    assert.match(og, /const gameType = view\.round;/);
    // The old words' path is gone: no switch, no old status labels or round names, no hand-resolved team names.
    assert.doesNotMatch(og, /isPublicFrameOn|view\?\.|publicGameStatusLabel|bracketRoundLabel|'Pool Play'|function teamName/);
  });
  it('Up next belongs to game day only, and no day folds its finished games away', () => {
    const schedule = readCode('components/public/PublicSchedule.tsx');
    assert.match(schedule, /renderGames\(dated, true, date === today\)/);
    assert.doesNotMatch(schedule, /Earlier today|PublicDisclosure/);
    assert.match(schedule, /upNextToday && !upNextShown && state === 'upcoming' && \(gameStartMs\(g\) \?\? 0\) > clock\.getTime\(\)/);
    assert.match(schedule, /groupPoolPlayoffs\(input, selection\.poolTags\)/);
  });
  it('the 30-second refresher tracks score, state and removal — its old score-only mode left with the old page', () => {
    const refresh = readCode('components/public/GameDetailLiveRefresher.tsx');
    assert.match(refresh, /intervalMs = 30_000/);
    assert.match(refresh, /requireFinalization: boolean;/, 'required: there is no caller without it');
    assert.match(refresh, /fetchPublicTournamentData\(orgSlug, tournamentSlug, 'schedule-preview'\)/);
    assert.match(refresh, /const signature = publicGameRefreshSignature\(data\.games\.find\(g => g\.id === gameId\) \?\? null, requireFinalization\)/);
    assert.doesNotMatch(refresh, /requireFinalization !== undefined|game\.homeScore/);
    assert.match(refresh, /document.visibilityState === 'hidden'/);
    assert.match(refresh, /signature !== signatureRef.current/);
    assert.match(readCode('components/public/PublicGameDetails.tsx'), /requireFinalization=\{requireFinalization\} \/>/);
  });
  it('desktop presentation starts at 1024; installed-app controls keep their display-mode gate', () => {
    for (const css of ['components/public/PublicGameDetails.module.css', 'components/public/PublicSchedule.module.css']) {
      assert.match(readSource(css), /@media \(min-width: 1024px\)/);
    }
    assert.match(readCode('components/public/ShareScoreButton.tsx'), /iconOnly = false/);
    assert.doesNotMatch(readCode('components/public/DirectionsLink.tsx'), /primary/);
  });
});
