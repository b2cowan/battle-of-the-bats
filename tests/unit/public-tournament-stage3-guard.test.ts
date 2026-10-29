import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';

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
    for (const file of ['PublicDisclosure', 'PublicSchedule.module.css']) assert.ok(schedule.includes(file));
    assert.match(schedule, /from '@\/lib\/public-schedule'/);
    assert.match(readCode('components/public/PublicGameRow.tsx'), /if \(schedule\)/);
    assert.match(readCode('components/public/PublicLiveCard.tsx'), /topLine &&/);
    assert.match(readCode('components/public/PublicDisclosure.tsx'), /aria-expanded=\{expanded\}/);
    assert.match(readCode('components/public/PublicDisclosure.module.css'), /min-width: 1024px/);
    assert.match(readCode('components/public/PublicSchedule.module.css'), /\.schedule/);
  });

  it('preview rows have no destinations or maps, and cannot poll public data over initialData', () => {
    const schedule = readCode('components/public/PublicSchedule.tsx');
    assert.match(schedule, /isPreview \? undefined : orgHref/);
    assert.match(schedule, /isPreview \? null : directionsHref/);
    assert.match(schedule, /enabled: !isPreview && isTournamentInProgress/);
    assert.match(schedule, /if \(initialData\) return/);
  });

  it('My games and calendar use the existing display-mode class, never a script-based visibility check', () => {
    const schedule = readCode('components/public/PublicSchedule.tsx');
    assert.equal((schedule.match(/className=\{parts.appOnly\}/g) ?? []).length, 2);
    assert.doesNotMatch(schedule, /matchMedia|navigator\.standalone/);
  });

  it('a development mount replay cannot erase a deep link after its URL was cleaned', () => {
    const schedule = readCode('components/public/PublicSchedule.tsx');
    assert.match(schedule, /pendingHighlight = useRef<string \| null \| undefined>\(undefined\)/);
    assert.match(schedule, /if \(pendingHighlight.current === undefined\) \{/);
  });
});
