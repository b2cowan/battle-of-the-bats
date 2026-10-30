import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createHash } from 'node:crypto';
import { readCode, readSource } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * PUBLIC TOURNAMENT PAGES — STAGE 3, PART 1: THE SWITCH REACHES THE SCHEDULE (2026-10-28).
 * Plan: docs/projects/active/PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md §9; build prompt PUBLIC_TOURNAMENT_STAGE3_BUILD_PROMPT.md.
 * Rulings: Ask 17 (the ticker leaves the Schedule and a game's page), Ask 15, the installed-app-only rulings.
 *
 *   · the Schedule's server page asks the one switch and tells the client; the client's old body is untouched;
 *   · today's ScheduleContent knows nothing of the frame, so with the switch off the Schedule is what it was;
 *   · every new Stage 3 part renders only under the switch (the later parts add their lines here).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const SCHEDULE_PAGE = 'app/[orgSlug]/[tournamentSlug]/schedule/page.tsx';
const SCHEDULE_CLIENT = 'app/[orgSlug]/[tournamentSlug]/schedule/SchedulePageClient.tsx';

describe('the switch reaches the Schedule', () => {
  it('the server page asks the one helper and tells the client', () => {
    const page = readCode(SCHEDULE_PAGE);
    assert.match(page, /const frameOn = await isPublicFrameOn\(\);/);
    assert.match(page, /<SchedulePageClient frameOn=\{frameOn\} \/>/);
  });

  it('the client still renders today\'s body, and that body does not know the frame exists', () => {
    assert.match(readCode(SCHEDULE_CLIENT), /<ScheduleContent\b/);
    const old = readCode('components/public/ScheduleContent.tsx');
    assert.doesNotMatch(old, /isPublicFrameOn|PUBLIC_FRAME|data-public-frame/);
  });

  it('only the preview switch renders the new Schedule, including the admin twin', () => {
    assert.match(readCode(SCHEDULE_CLIENT), /if \(frameOn\) return <PublicSchedule/);
    const preview = readCode('app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/[section]/page.tsx');
    assert.match(preview, /const frameOn = await isPublicFrameOn\(\)/);
    assert.match(preview, /if \(frameOn\) return <PublicSchedule[^;]+isPreview initialData=\{initialData\}/);
    assert.match(preview, /<ScheduleContent/);
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

describe('the game page and desktop (Part 3) stay behind the switch', () => {
  const file = 'app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/page.tsx';
  it('the new game body follows the published-only lookup and the server switch', () => {
    const page = readCode(file);
    assert.match(page, /getPublicTournamentPageData\(orgSlug, tournamentSlug, 'schedule'\)/);
    assert.ok(page.indexOf('if (!game) notFound();') < page.indexOf('if (frameOn) return <PublicGameDetails'));
    assert.match(page, /const frameOn = await isPublicFrameOn\(\);/);
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
  it('the switch-off game body remains byte-for-byte the Part 2 body', () => {
    const page = readSource(file);
    const legacy = page.slice(page.indexOf('  const division = data.divisions.find'));
    assert.equal(createHash('sha256').update(legacy).digest('hex'), '5144af23d99e8476aa1043d918ad0488ea638b4ae3e58e8aa19667559b701d14');
  });
  it('metadata and OG use new names/rounds only in their preview branches', () => {
    assert.match(readCode(file), /if \(await isPublicFrameOn\(\)\) \{/);
    const og = readCode('app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx');
    assert.match(og, /await isPublicFrameOn\(\) \? publicGameDetailView/);
    assert.match(og, /view\?\.round \?\?/);
  });
  it('Up next belongs to game day only, and no day folds its finished games away', () => {
    const schedule = readCode('components/public/PublicSchedule.tsx');
    assert.match(schedule, /renderGames\(dated, true, date === today\)/);
    assert.doesNotMatch(schedule, /Earlier today|PublicDisclosure/);
    assert.match(schedule, /upNextToday && !upNextShown && state === 'upcoming' && \(gameStartMs\(g\) \?\? 0\) > clock\.getTime\(\)/);
    assert.match(schedule, /groupPoolPlayoffs\(input, selection\.poolTags\)/);
  });
  it('the 30-second refresher tracks state/removal only for the new body', () => {
    const refresh = readCode('components/public/GameDetailLiveRefresher.tsx');
    assert.match(refresh, /intervalMs = 30_000/);
    assert.match(refresh, /requireFinalization !== undefined\) signature = publicGameRefreshSignature\(game \?\? null, requireFinalization\)/);
    assert.match(refresh, /else if \(game\) signature = `\$\{game\.homeScore/);
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
