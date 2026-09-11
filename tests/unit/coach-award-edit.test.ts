/**
 * Awards One Tag Idiom, Part A (plan `COACH_AWARDS_ONE_TAG_IDIOM_PLAN.md`) — a given award can
 * now be edited and removed where it was given, not just deleted from a separate report page.
 * Structural rules a live-DB test can't reach without a fixture; this pins them by source.
 *
 * R0 (owner ruling, from the mockup): the edit form carries NO "Remove this award" control — one
 * job per control, delete stays the row's own trash icon with its own confirm.
 *
 * "Which game an award is for" is deliberately NOT editable (plan's architectural decisions) — a
 * wrong game is remove-and-re-give, same as a tag on the wrong event. Pinned by absence: the
 * PATCH route never writes an `event_id` field, and its request body never sends `eventId`.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p: string) => fs.readFileSync(path.join(REPO, p), 'utf8');

const modal = read('components/coaches/GiveAwardModal.tsx');
const awardsRoute = read('app/api/coaches/[orgSlug]/teams/[teamId]/awards/route.ts');
const awardIdRoute = read('app/api/coaches/[orgSlug]/teams/[teamId]/awards/[awardId]/route.ts');
const scheduleAwardSection = (() => {
  const page = read('app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx');
  // NOT `indexOf('Awards given')` — an earlier comment ("...the slide-over's \"Awards given\"
  // section...") contains that same phrase and would anchor the slice hundreds of lines too
  // early. The JSX heading is unique.
  const start = page.indexOf('>Awards given</h4>');
  return page.slice(start, start + 3000);
})();
const reportPanel = read('app/[orgSlug]/coaches/teams/[teamId]/history/awards/panel.tsx');

describe('GiveAwardModal — edit mode', () => {
  it('R0: never renders a "Remove this award" control — delete stays the row\'s own icon', () => {
    assert.doesNotMatch(modal, /Remove this award/i);
  });

  it('supports an `editing` prop and titles the form "Edit award" when it is set', () => {
    assert.match(modal, /editing\?:\s*RepPlayerAward/);
    assert.match(modal, /editing\s*\?\s*'Edit award'\s*:\s*'Give an award'/);
  });

  it('PATCHes the existing award id when editing, instead of POSTing a new one', () => {
    assert.match(modal, /`\$\{base\}\/\$\{editing\.id\}`/);
    assert.match(modal, /method:\s*'PATCH'/);
  });

  it('never sends eventId in the edit PATCH body — which game an award is for is not editable', () => {
    const patchCallStart = modal.indexOf("method: 'PATCH'");
    const patchBody = modal.slice(patchCallStart, patchCallStart + 400);
    assert.doesNotMatch(patchBody, /eventId/);
  });
});

describe('the award PATCH route — R5 once per occasion, and no editable game', () => {
  it('exports PATCH and never writes an event_id/eventId field', () => {
    assert.match(awardIdRoute, /export const PATCH/);
    assert.doesNotMatch(awardIdRoute, /fields\.eventId/);
  });

  it('checks findRepPlayerAwardCollision before writing, excluding the row being edited', () => {
    assert.match(awardIdRoute, /findRepPlayerAwardCollision\(/);
    assert.match(awardIdRoute, /findRepPlayerAwardCollision\(\s*[\s\S]{0,200}awardId,\s*\)/);
  });

  it('answers a collision with 409, not a silent success', () => {
    const collisionBlock = awardIdRoute.slice(awardIdRoute.indexOf('if (collision)'), awardIdRoute.indexOf('if (collision)') + 700);
    assert.match(collisionBlock, /status:\s*409/);
  });
});

describe('the award POST route — R5 applies to giving a new award too', () => {
  it('checks findRepPlayerAwardCollision before creating', () => {
    assert.match(awardsRoute, /findRepPlayerAwardCollision\(/);
    const collisionIdx = awardsRoute.indexOf('findRepPlayerAwardCollision(');
    const createIdx = awardsRoute.indexOf('createRepPlayerAward(');
    assert.ok(collisionIdx > -1 && createIdx > -1 && collisionIdx < createIdx,
      'the collision check must run BEFORE the award is created, not after');
  });
});

describe('the schedule game drawer — awards given get their own controls', () => {
  it('renders an Edit and a Remove control per award row, not plain text', () => {
    assert.match(scheduleAwardSection, /<Pencil size=\{14\}/);
    assert.match(scheduleAwardSection, /<Trash2 size=\{14\}/);
  });

  it('Edit opens the modal in edit mode against that specific row', () => {
    assert.match(scheduleAwardSection, /setEditingAward\(a\);\s*setGiveAwardOpen\(true\)/);
  });
});

describe('the season report page — Edit sits beside the existing Print and Remove', () => {
  it('renders Pencil, Printer and Trash2 on each history row', () => {
    const tableStart = reportPanel.indexOf('Full history');
    const table = reportPanel.slice(tableStart, tableStart + 3200);
    assert.match(table, /<Pencil size=\{13\}/);
    assert.match(table, /<Printer size=\{13\}/);
    assert.match(table, /<Trash2 size=\{13\}/);
  });
});
