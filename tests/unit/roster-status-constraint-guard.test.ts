/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **THE ROSTER STATUS TYPE AND THE DATABASE MUST AGREE.**
 *
 * ⚠⚠ THE BUG THIS FILE EXISTS FOR, found while designing call-ups (mig 309, 2026-09-22):
 *
 *     lib/types.ts    export type RepRosterStatus = 'active' | 'inactive' | 'released'
 *     live database   CHECK (status IN ('active', 'inactive'))
 *
 * `'released'` was in the type from the beginning and the constraint never allowed it. So the value
 * could be RENDERED and never WRITTEN: the closed-season page carried a branch printing "Left
 * during the season", and the admin program-year page listed it as a known status, for a state no
 * row could ever hold. Nothing failed. Typecheck cannot see it — one side is a TypeScript union and
 * the other is a string inside SQL. No test touched it. It sat there for a year.
 *
 * That is a cheap bug on its own (two dead branches) and an expensive shape in general: the same
 * mistake made the other way — a value the DATABASE allows and the type does not — hands every
 * reader an unhandled case, and the readers here are the roster, dues, lineups, the archive and the
 * season report.
 *
 * So this reads BOTH SIDES out of their real sources — the union out of `lib/types.ts`, the check
 * constraint out of the committed dev schema snapshot — and asserts they are the same set. It needs
 * no database, runs in milliseconds, and fails the moment someone widens one side alone.
 *
 * ⚠ The snapshot is the evidence, not the migration files: this repo's own rule is that a drifted
 * database makes migration files misleading, so "what the database actually allows" is only ever
 * read from `information_schema` or the snapshots refreshed from it.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '..', '..');
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');

/** The union in `lib/types.ts`, as a set of literals. */
function typeValues(): Set<string> {
  const src = read('lib/types.ts');
  const m = src.match(/export type RepRosterStatus = ([^;]+);/);
  assert.ok(m, 'RepRosterStatus is gone from lib/types.ts — if it was renamed, update this test; if it was deleted, every roster status read is now untyped.');
  /**
   * ⚠⚠ **EVERY QUOTED LITERAL, NOT JUST `[a-z_]` ONES — and the narrow version could reproduce the
   * very bug this file was written to prevent.** `/'([a-z_]+)'/` silently DROPS any future member
   * that is not lower-snake — `'call-up'`, `'callup2'`, `'Released'` — so such a value would appear
   * in neither direction's comparison and both assertions would pass while the type named something
   * the database refuses. Found by `/review`.
   *
   * The union is then cross-checked against the raw text, so a literal this scan cannot see fails
   * loudly instead of vanishing.
   */
  const values = [...m![1].matchAll(/'([^']+)'/g)].map(x => x[1]);
  assert.ok(values.length > 0, 'RepRosterStatus parsed to no literals — the scan is broken, so its green means nothing.');
  assert.equal(
    values.length, (m![1].match(/'/g) ?? []).length / 2,
    `RepRosterStatus has quoted literals this scan did not capture — it reads ${JSON.stringify(m![1])}. `
    + 'A member the scan cannot see is a member neither direction below can check, which is exactly '
    + 'how \'released\' survived.',
  );
  return new Set(values);
}

/**
 * The live CHECK constraint, out of the committed DEV snapshot.
 *
 * ⚠ Dev, deliberately. Dev is the schema this code is written against; prod is allowed to be behind
 * between a migration and its promote, and keeping the two in step is `check:migrations`' job, not
 * this file's. Asserting against prod here would make every unpromoted migration look like a type
 * error and teach people to skip the test.
 */
function constraintValues(): Set<string> {
  const dumps = read('docs/agents/db/schema-snapshots/schema_dumps.json');
  // ⚠ `dev.rls` carries CHECK constraints as well as row-level-security rows — the dump groups
  // "everything that is a rule rather than a column" under that one key.
  const parsed: { dev?: { rls?: unknown[] } } = JSON.parse(dumps);
  const rows = (parsed.dev?.rls ?? []) as { kind?: string; table_name?: string; detail?: string; check_clause?: string | null }[];
  assert.ok(rows.length > 0, 'The dev rules list in schema_dumps.json is empty — the snapshot shape changed, so this guard is reading nothing.');
  const row = rows.find(r =>
    r.kind === 'CHECK'
    && r.table_name === 'rep_roster_players'
    && r.detail === 'rep_roster_players_status_check');
  assert.ok(
    row?.check_clause,
    'No `rep_roster_players_status_check` in the dev snapshot. Either the constraint was dropped — '
    + 'in which case the status column now accepts ANY string and this guarantee is gone — or the '
    + 'snapshots are stale (`npm run refresh:snapshots`).',
  );
  const values = [...row!.check_clause!.matchAll(/'([a-z_]+)'::text/g)].map(x => x[1]);
  assert.ok(values.length > 0, 'The check clause parsed to no literals — the scan is broken, so its green means nothing.');
  return new Set(values);
}

describe('roster status — the type and the database describe the same set', () => {
  it('every value the type allows, the database accepts', () => {
    const inType = [...typeValues()].sort();
    const inDb = constraintValues();
    const unwritable = inType.filter(v => !inDb.has(v));
    assert.deepEqual(
      unwritable, [],
      `RepRosterStatus allows ${unwritable.join(', ')}, which the database REFUSES. This is the `
      + "'released' bug exactly: the product can render a state no row can ever hold, and any code "
      + 'that tries to write one gets a constraint violation at runtime. Add the value to the check '
      + 'constraint in a NEW migration (never by editing an applied one), or take it out of the type.',
    );
  });

  it('every value the database accepts, the type names', () => {
    const inType = typeValues();
    const inDb = [...constraintValues()].sort();
    const unhandled = inDb.filter(v => !inType.has(v));
    assert.deepEqual(
      unhandled, [],
      `The database accepts ${unhandled.join(', ')}, which RepRosterStatus does not name. This is `
      + 'the more expensive direction: rows can hold a status every reader — the roster, dues, '
      + 'lineups, the archive, the season report — treats as impossible, and TypeScript will not '
      + 'warn any of them. Add it to the union and handle it.',
    );
  });

  it("'callup' is on both sides (mig 309)", () => {
    assert.ok(typeValues().has('callup'), "RepRosterStatus no longer has 'callup' — every call-up in the database is now an unnamed status.");
    assert.ok(constraintValues().has('callup'), "The database no longer accepts 'callup' — calling a player up will fail with a constraint violation.");
  });

  it("'released' is gone from both sides", () => {
    assert.ok(!typeValues().has('released'), "'released' is back in RepRosterStatus. It was never writable — see this file's header. If a real released state is wanted, it needs a migration first.");
  });
});
