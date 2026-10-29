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
});
