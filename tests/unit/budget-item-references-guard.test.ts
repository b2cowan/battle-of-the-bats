import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BUDGET_ITEM_REFERENCES } from '../../lib/coach-budget-items.ts';

/**
 * ⚠⚠ THE GUARD THAT EXISTS BECAUSE THE LIST WENT STALE ONCE, SILENTLY.
 *
 * Every foreign key into `budget_items` is `ON DELETE SET NULL`. That is right for a genuine
 * deletion — a record keeps its money and the missing word reads as the honest gap it is — and it
 * means anything that MERGES or REMOVES a word has to re-point or refuse first, or the money
 * survives with its classification quietly gone.
 *
 * The publish route was written when two such tables existed. It named them both in a careful
 * comment about re-pointing before deleting, and was never revisited when `rep_team_money_in`
 * arrived with migration 243 — so every income and refund filed against an absorbed word lost its
 * item, on a path that reported success. `org_budget_lines` was the fourth, safe only because
 * nothing happened to point at it yet.
 *
 * Prose could not have caught that, and neither could a reviewer reading the route: the fact lives
 * in the SCHEMA, and the schema is committed. So this test reads it.
 *
 * ⚠ It reads the DEV snapshot because that is where a new table appears first — the whole point is
 * to fail in the same change that adds the foreign key, not one release later when prod catches up.
 */
describe('budget_items references — the list of what points at a word', () => {
  const snapshot = JSON.parse(readFileSync(
    join(process.cwd(), 'docs/agents/db/schema-snapshots/schema-dump-constraints-dev.json'),
    'utf8',
  )) as Array<{
    table_name: string;
    column_name: string;
    constraint_type: string;
    foreign_table: string | null;
    delete_rule: string | null;
  }>;

  const incoming = snapshot.filter(r =>
    r.constraint_type === 'FOREIGN KEY' && r.foreign_table === 'budget_items');

  test('every foreign key into budget_items is covered by BUDGET_ITEM_REFERENCES', () => {
    const covered = new Set(BUDGET_ITEM_REFERENCES.map(r => `${r.table}.${r.column}`));
    const missing = incoming
      .map(r => `${r.table_name}.${r.column_name}`)
      .filter(key => !covered.has(key));

    assert.deepEqual(missing, [],
      'A table now points at budget_items and no guard counts it. Every delete/merge path reads '
      + 'BUDGET_ITEM_REFERENCES in lib/coach-budget-items.ts — add it there (with the words a coach '
      + 'would call those records) in the SAME change that adds the foreign key. Skipping this is '
      + 'how rep_team_money_in spent a release losing its item on every publish.');
  });

  test('the list names nothing that has stopped pointing at budget_items', () => {
    const live = new Set(incoming.map(r => `${r.table_name}.${r.column_name}`));
    const stale = BUDGET_ITEM_REFERENCES
      .map(r => `${r.table}.${r.column}`)
      .filter(key => !live.has(key));

    assert.deepEqual(stale, [],
      'BUDGET_ITEM_REFERENCES names a table/column that no longer has a foreign key to '
      + 'budget_items. Counting a dead column costs a query on every guard and quietly reports zero, '
      + 'which reads exactly like "nothing is filed against this".');
  });

  test('each one is ON DELETE SET NULL — the reason the guards have to exist', () => {
    /* If a future foreign key arrives as RESTRICT or CASCADE the guards are not wrong, but the
       reasoning around them is, and every comment saying "the delete does not fail" stops being
       true. Fail here so the change is deliberate rather than discovered. */
    const surprising = incoming
      .filter(r => r.delete_rule !== 'SET NULL')
      .map(r => `${r.table_name}.${r.column_name} is ON DELETE ${r.delete_rule}`);

    assert.deepEqual(surprising, [],
      'A foreign key into budget_items no longer uses ON DELETE SET NULL. The guards and their '
      + 'comments are all written around that behaviour — re-read them before changing this.');
  });

  test('the four known references are all present', () => {
    // A canary: if the snapshot ever loads empty or the shape changes, the tests above would pass
    // vacuously and report a clean build over no data at all.
    assert.ok(incoming.length >= 4,
      `expected at least 4 foreign keys into budget_items, found ${incoming.length} — the snapshot `
      + 'may have failed to load, which would make every check above pass over nothing.');
  });
});
