import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, readSource } from './_source-code.ts';

/**
 * ⚖ ADD TIME IS A SECOND SCHEDULE, SHOWN AS ONE (plan CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md §8 Phase 8; mig 491; storage
 * ruled B 2026-11-17). An added part IS a `club_schedules` row (`part_of_schedule_id`), so every reader of the table that
 * is not one row by id must decide what a part is to it: HIDDEN (`.is('part_of_schedule_id', null)`), ROLLED UP (reads the
 * link and folds the part into its parent), or right as itself — said in a `parts-ok:` comment with the reason. A new
 * reader that does none of these fails here: that is the decision point (the census of 2026-11-17 is the precedent).
 */
const FILES = [
  ...filesUnder('lib', '.ts'), ...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx'), ...filesUnder('components', '.tsx'),
  ...filesUnder('scripts', '.mjs'),
].filter(f => !f.endsWith('.test.ts'));

/** Each `.from('club_schedules')` with the lines just before it and its statement (to the next `;`). */
function readersOf(file: string): { at: number; text: string }[] {
  const src = readSource(file);
  const out: { at: number; text: string }[] = [];
  const re = /\.from\((['"])club_schedules\1\)/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const lineStart = src.lastIndexOf('\n', m.index);
    let before = lineStart;
    for (let k = 0; k < 3 && before > 0; k++) before = src.lastIndexOf('\n', before - 1);
    const end = src.indexOf(';', m.index);
    out.push({ at: src.slice(0, m.index).split('\n').length, text: src.slice(Math.max(0, before), end < 0 ? m.index + 600 : end) });
  }
  return out;
}

const DECIDED = [
  /\.eq\(\s*['"]id['"]/, /\.in\(\s*['"]id['"]/,           // one row (or a few) by id
  /part_of_schedule_id/,                                   // hidden, or read to be folded in
  /parts-ok:/,                                             // right as itself, with the reason
  /\.insert\(/, /\.update\(/, /\.delete\(/,                // a write names its row (or the whole org)
];

describe('every list of schedules decides what an added part is', () => {
  it('no reader of club_schedules leaves a part to show up as a schedule of its own', () => {
    const open = FILES.flatMap(f => readersOf(f).filter(r => !DECIDED.some(d => d.test(r.text))).map(r => `${f}:${r.at}`));
    assert.deepEqual(open, [], 'hide the part (.is(\'part_of_schedule_id\', null)), fold it into its parent, or say why it is right as itself (parts-ok:)');
  });

  it('the Schedules list folds each part into the schedule it was added to', () => {
    const src = readSource('lib/club-schedule-server.ts');
    const list = src.slice(src.indexOf('export async function scheduleList'), src.indexOf('// ── The writers'));
    assert.match(list, /const rows = all\.filter\(r => !r\.part_of_schedule_id\)/, 'a part is never a row of the list');
    assert.match(list, /family\.has\(s\.schedule_id\)/, 'its slots count with its parent\'s');
    assert.match(list, /parts\.some\(x => x\.state !== 'final' \|\| x\.changed_since_sent\)/, 'an unsent part, or a sent part with changes waiting (Session 3), reads as Changed since sent');
  });

  it('New schedule\'s "start from" picker never offers a part', () => {
    assert.match(readSource('app/api/admin/schedules/route.ts'), /\.is\('part_of_schedule_id', null\)\.order\('starts_on'/);
  });

  it('Find the time counts the asker\'s whole family as its own time', () => {
    assert.match(readSource('lib/permit-free-time-server.ts'), /s\.family_id === opts\.scheduleId/);
    assert.match(readSource('app/api/admin/schedules/free-time/route.ts'), /part_of_schedule_id as string \| null\) \?\? \(data\.id as string\)/);
  });

  it('a part\'s address opens the family\'s page, and the page reads the parts', () => {
    const route = readSource('app/api/admin/schedules/[scheduleId]/route.ts');
    assert.match(route, /first\?\.row\.part_of_schedule_id \? await loadSchedule\(r\.ctx\.org\.id, first\.row\.part_of_schedule_id\)/);
    assert.match(route, /parts: family\.parts/);
  });

  it('a draft, a save and a hand edit each check the rest of the family', () => {
    const gen = readSource('app/api/admin/schedules/generate/route.ts');
    assert.match(gen, /familyOthers\(orgId, loaded\.row\)/);
    assert.match(gen, /buildEngineInput\([^)]*family \}\)/);
    const route = readSource('app/api/admin/schedules/[scheduleId]/route.ts');
    assert.match(route, /draftToSave\(req, prices, assignments, kept, keep, await familyOthers\(orgId, loaded\.row\)\)/);
    assert.match(route, /familyTeamTwice\(/);
    assert.match(route, /team_not_in_part/);
  });
});
