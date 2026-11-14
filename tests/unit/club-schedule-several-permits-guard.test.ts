import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, functionBody, readCode, readSource } from './_source-code.ts';

/**
 * ⚖ A SCHEDULE ON SEVERAL PERMITS, Session A (build prompt CLUB_SCHEDULE_SEVERAL_PERMITS_BUILD_PROMPT.md, guard 1; mig 487):
 * NO READER OF A SCHEDULE'S PERMIT USES A SINGLE COLUMN. Each row of time remembers the permit it came from
 * (`org_time_blocks.from_permit_id`); the schedule's permits are the distinct permits behind its rows
 * (`schedulePermitIds`), and a slot is priced by its row's permit (`readPrices(…, rowPermits)` → `weightOf(facility,
 * permit)`). `club_schedules.started_from_permit_id` stays for ONE release as a written fallback, read only inside the
 * three helpers that own it; `bill_permit_id` is the fallback PRICE permit (`pricePermitOf`). A new reader that goes back
 * to one column fails here — that is the decision point, not a tidy-up.
 */
const CODE = [...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx'), ...filesUnder('lib', '.ts'), ...filesUnder('components', '.tsx')]
  .filter(f => !f.endsWith('.test.ts'));
const server = readCode('lib/club-schedule-server.ts');

/** Every call of `name(` in the code, its arguments split at the top level (a nested call kept whole). */
function callsOf(code: string, name: string): string[][] {
  const out: string[][] = [];
  for (let i = code.indexOf(`${name}(`); i >= 0; i = code.indexOf(`${name}(`, i + 1)) {
    let depth = 0, arg = '';
    const args: string[] = [];
    for (let j = i + name.length; j < code.length; j++) {
      const c = code[j];
      if (c === '(' || c === '[' || c === '{') { depth++; if (depth === 1) continue; }
      if (c === ')' || c === ']' || c === '}') { depth--; if (depth === 0) { args.push(arg.trim()); break; } }
      if (c === ',' && depth === 1) { args.push(arg.trim()); arg = ''; continue; }
      arg += c;
    }
    out.push(args.filter(Boolean));
  }
  return out;
}

describe('a schedule on several permits — no reader of a schedule\'s permit uses a single column', () => {
  it('started_from_permit_id is read only by the server module\'s fallback helpers and the permit\'s "used by"', () => {
    const readers = CODE.filter(f => /started_from_permit_id/.test(readCode(f))).sort();
    assert.deepEqual(readers, ['lib/club-schedule-server.ts', 'lib/permit-server.ts'],
      'a new reader of the start link alone — read the schedule\'s rows (schedulePermitIds) instead');
    // Inside the server module: the row's type and columns, the two fallback helpers, and the view's own field.
    const uses = server.match(/started_from_permit_id/g) ?? [];
    assert.equal(uses.length, 8, `the server module reads the start link ${uses.length} times — each new read is a decision`);
    assert.match(functionBody(server, 'schedulePermitIds'), /return ids\.length \? ids : row\.started_from_permit_id \? \[row\.started_from_permit_id\] : \[\];/,
      'the rows first; the start link only when no row names a permit');
    assert.match(server, /export const pricePermitOf = \(row: Pick<ScheduleRow, 'bill_permit_id' \| 'started_from_permit_id'>\): string \| null =>\s*row\.bill_permit_id \?\? row\.started_from_permit_id;/);
  });

  it('"bill_permit_id ?? started_from_permit_id" lives in pricePermitOf alone', () => {
    const hits = CODE.filter(f => /bill_permit_id \?\? [\w.]*started_from_permit_id/.test(readCode(f)));
    assert.deepEqual(hits, ['lib/club-schedule-server.ts']);
    assert.equal((server.match(/bill_permit_id \?\? row\.started_from_permit_id/g) ?? []).length, 1);
  });

  it('every price read outside the server module passes the rows\' permits — or reads a saved schedule through schedulePrices', () => {
    for (const f of CODE.filter(x => x !== 'lib/club-schedule-server.ts')) {
      const code = readCode(f);
      for (const args of callsOf(code, 'readPrices')) {
        assert.ok(args.length >= 3, `${f}: readPrices(${args.join(', ')}) prices one permit's way — pass the rows' permits`);
      }
    }
    // A slot's weight is its row's permit's share: every weightOf call outside the engine names the permit.
    for (const f of CODE.filter(x => !/club-schedule-(engine|server)\.ts$/.test(x))) {
      for (const args of callsOf(readCode(f), 'prices.weightOf')) {
        assert.equal(args.length, 2, `${f}: prices.weightOf(${args.join(', ')}) weighs a slot without its row's permit`);
      }
    }
    for (const f of ['lib/club-schedule-send.ts', 'lib/club-schedule-coach.ts']) {
      assert.match(readCode(f), /schedulePrices\(orgId, loaded\)/, `${f} reads a saved schedule's prices from its rows`);
    }
  });

  it('the schedule\'s permits come from its rows: the top line, Outside the permit, "used by" and the delete guard', () => {
    assert.match(server, /const fromIds = schedulePermitIds\(row, loaded\.time\.blocks\);/, 'the top line');
    assert.match(readCode('app/api/admin/schedules/[scheduleId]/route.ts'), /const permitIds = schedulePermitIds\(loaded\.row, loaded\.time\.blocks\);/, 'Outside the permit');
    assert.match(readCode('lib/permit-dates-off.ts'), /permitIds: readonly string\[\]; slots: readonly ScheduleSlotPlace\[\];/, 'every permit, not one');
    const handing = functionBody(readCode('lib/permit-server.ts'), 'schedulesHandingOut');
    assert.match(handing, /\.eq\('from_permit_id', permitId\)/, 'a permit any row came from is "used" and can\'t be deleted');
  });

  it('each row\'s permit goes to the save, and the save keeps it (mig 487)', () => {
    // Not sent keeps the stored permit; null (a typed row) clears it — the API must tell them apart, or an older tab's save wipes every row's permit.
    assert.match(server, /\.\.\.\(b\.permitId === undefined \? \{\} : \{ permitId: b\.permitId \}\),/, 'timePayload omits the key when the request never said');
    assert.match(functionBody(server, 'readTimeBody'), /const permitId = raw\.permitId === undefined \? undefined : isUuid\(raw\.permitId\) \? raw\.permitId : null;/,
      'a request that leaves permitId out stays undefined, not null');
    assert.match(server, /\.select\('id, org_venue_id, from_permit_id, /, 'readScheduleTime reads it back');
    const mig = readSource('supabase/migrations/487_each_row_of_time_remembers_its_permit.sql');
    assert.match(mig, /from_permit_id = case when v_block \? 'permitId' then nullif\(v_block->>'permitId', ''\)::uuid else from_permit_id end,/,
      'an update without the key keeps the row\'s permit (an older client\'s save)');
    assert.match(mig, /nullif\(v_block->>'permitId', ''\)::uuid\)/, 'an insert writes it');
    assert.match(readCode('components/admin/kit/club/schedules/NewScheduleWindow.tsx'), /permitId: r\.permitId \?\? null,/, 'the form sends each row\'s permit');
  });

  it('the overlap rule is pure: no React, no database', () => {
    const rows = readCode('lib/club-schedule-permit-rows.ts');
    assert.doesNotMatch(rows, /from 'react'|supabase|server-only/);
  });
});
