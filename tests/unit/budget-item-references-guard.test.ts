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

  /**
   * ⚠⚠ THE CATEGORY TRAVELS WITH THE ITEM, and this is the half a reader is most likely to miss.
   *
   * Every one of these tables stores the category BESIDE the item, derived from the item at save
   * time so the report's two levels cannot disagree about one row — and Budget vs. Actual then
   * prefers that stored category over the item's own when it places a cost. A fold across categories
   * that moved only the item column would leave those records filed under the heading the folded
   * word used to live under: all the money still there, and none of it lining up with the plan.
   *
   * That is the original bug — a link the mover forgot — one column to the right. So the columns are
   * named in the same list, and checked against the same committed schema.
   */
  const columns = JSON.parse(readFileSync(
    join(process.cwd(), 'docs/agents/db/schema-snapshots/schema-dump-columns-dev.json'),
    'utf8',
  )) as Array<{ table_name: string; column_name: string }>;
  const columnKeys = new Set(columns.map(c => `${c.table_name}.${c.column_name}`));

  test('every reference names a category column that exists on that table', () => {
    const missing = BUDGET_ITEM_REFERENCES
      .flatMap(r => [
        `${r.table}.${r.categoryColumn}`,
        ...(r.categoryNameColumn ? [`${r.table}.${r.categoryNameColumn}`] : []),
      ])
      .filter(key => !columnKeys.has(key));

    assert.deepEqual(missing, [],
      'BUDGET_ITEM_REFERENCES names a category column that is not on that table. The fold writes '
      + 'that column alongside the item so a cross-category merge re-files the records under the '
      + 'surviving word\'s heading — a name that no longer exists means the update silently writes '
      + 'nothing, or errors, on a path a coach was told moved their records.');
  });

  /**
   * ⚠⚠ AND THE OTHER DIRECTION, WHICH IS THE ONE THAT ACTUALLY CATCHES THINGS (/simplify, altitude
   * lens, 2026-08-17).
   *
   * The check above only proves the strings already written into the list still resolve. That is
   * *validating*, and validating is what the original bug survived: nobody had written the third
   * table down, so nothing checked it. The foreign-key test at the top of this file is
   * **generative** — it reads the schema and fails when something exists that the list does not
   * name — and that is why it works.
   *
   * So this asks the schema the same question one column over: on a table that already points at a
   * budget word, is there a category link the list has NOT claimed? A second category column
   * arriving on a covered table would otherwise slip past every check here, and the fold would
   * quietly leave it pointing at the folded word's old heading — the original bug, in the one place
   * the list had stopped looking.
   */
  test('no reference table has a category link the list has not claimed', () => {
    const categoryFks = snapshot.filter(r =>
      r.constraint_type === 'FOREIGN KEY' && r.foreign_table === 'budget_categories');
    /* ⚠ THE CANARY FIRST. "Nothing unclaimed" is also what an empty search returns, and a check
       that passes over no data reads exactly like a check that passed. Every one of these tables
       has a category foreign key today. */
    const onReferenceTables = categoryFks
      .filter(f => BUDGET_ITEM_REFERENCES.some(r => r.table === f.table_name));
    assert.ok(onReferenceTables.length >= BUDGET_ITEM_REFERENCES.length,
      `expected a category foreign key on each of the ${BUDGET_ITEM_REFERENCES.length} reference `
      + `tables, found ${onReferenceTables.length} — the snapshot may have failed to load, which `
      + 'would make the check below pass over nothing.');

    const unclaimed = BUDGET_ITEM_REFERENCES.flatMap(ref => {
      const claimed = new Set([ref.categoryColumn, ref.categoryNameColumn].filter(Boolean));
      /* Two ways a table records a heading, and both are live: a foreign key to `budget_categories`,
         and the free-text `category` name that predates the taxonomy and is still written today. */
      const links = [
        ...categoryFks.filter(f => f.table_name === ref.table).map(f => f.column_name),
        ...columns.filter(c => c.table_name === ref.table && c.column_name === 'category')
          .map(c => c.column_name),
      ];
      return links.filter(col => !claimed.has(col)).map(col => `${ref.table}.${col}`);
    });

    assert.deepEqual([...new Set(unclaimed)], [],
      'A table that points at budget_items has a category column BUDGET_ITEM_REFERENCES does not '
      + 'name. Every record stores its heading beside its item, and Budget vs. Actual reads the '
      + 'stored one — so a fold that does not move this column leaves those records filed under the '
      + 'heading the folded word used to live under: all the money present, none of it lining up '
      + 'with the plan. Add it as categoryColumn (or categoryNameColumn for a free-text name) in '
      + 'the SAME change that adds the column.');
  });

  test('the columns snapshot loaded — every table above actually appears in it', () => {
    // The same canary as below, for the second snapshot: an empty or reshaped columns dump would
    // make both checks above pass over nothing at all.
    const absent = BUDGET_ITEM_REFERENCES
      .map(r => r.table)
      .filter(t => !columns.some(c => c.table_name === t));
    assert.deepEqual(absent, [],
      'A table in BUDGET_ITEM_REFERENCES has no columns in the dev columns snapshot — the snapshot '
      + 'may have failed to load, which would make the category-column checks pass over nothing.');
  });

  test('the four known references are all present', () => {
    // A canary: if the snapshot ever loads empty or the shape changes, the tests above would pass
    // vacuously and report a clean build over no data at all.
    assert.ok(incoming.length >= 4,
      `expected at least 4 foreign keys into budget_items, found ${incoming.length} — the snapshot `
      + 'may have failed to load, which would make every check above pass over nothing.');
  });
});
