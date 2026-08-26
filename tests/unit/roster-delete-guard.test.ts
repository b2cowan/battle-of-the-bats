/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **THE UNDO GUARD MUST ACTUALLY BE ABLE TO ASK ITS QUESTION.**
 *
 * Undoing a tryout acceptance deletes a `rep_roster_players` row. Twenty tables reference that
 * table and almost every one is `ON DELETE CASCADE`, so the delete would silently take dues
 * payments, attendance, lineups, awards, development records, documents and family links with it.
 * `rosterPlayerDependencies()` is the guard that refuses when any of those exist.
 *
 * ⚠⚠ THE BUG THIS FILE EXISTS FOR (/review, 2026-08-26). The first version of that guard assumed
 * every child table names its foreign key `player_id`. **`rep_player_tryout_baselines` calls it
 * `roster_player_id` and has no `player_id` column at all** — so PostgREST rejected that filter on
 * every single call, for every player. Because a failed check is (correctly) treated as a BLOCKER,
 * Undo refused 100% of the time: the feature was dead on arrival, and nothing noticed. Typecheck
 * could not see it — the table and column are strings. No existing test touched it. It would have
 * reached a coach as "Undo never works", or, with a fail-OPEN guard, as silent data loss.
 *
 * So this reads the guard's own list out of `lib/db.ts` and checks every table/column pair against
 * the committed dev schema snapshot. It is a SOURCE + SNAPSHOT scan, deliberately: it needs no
 * database, runs in milliseconds, and fails the build the moment someone adds an entry whose column
 * is guessed rather than checked.
 *
 * ⚠ SCOPE LIMIT, so this is not mistaken for more than it is: it proves each pair EXISTS. It does
 * not prove the list is COMPLETE — that is what `cascadesNotGuarded` below is for, and that half is
 * a hand-maintained acknowledgement rather than a derivation, because whether a cascade matters to
 * a coach is a judgement (a game moment that goes null is not a lost record; a dues payment is).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '..', '..');
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');

interface SnapshotColumn { table_name: string; column_name: string }
const SNAPSHOT: SnapshotColumn[] = JSON.parse(
  read('docs/agents/db/schema-snapshots/schema-dump-columns-dev.json'),
);

const columnsOf = (table: string) =>
  new Set(SNAPSHOT.filter(c => c.table_name === table).map(c => c.column_name));

/** The guard's list, read out of the source rather than duplicated here — a copy would drift. */
function guardEntries(): { table: string; column: string }[] {
  const src = read('lib/db.ts');
  const start = src.indexOf('const ROSTER_PLAYER_DEPENDENTS');
  assert.ok(start > -1, 'ROSTER_PLAYER_DEPENDENTS is gone from lib/db.ts — if the guard was renamed, update this test; if it was DELETED, the undo is unguarded and that is the emergency.');
  const end = src.indexOf('];', start);
  const block = src.slice(start, end);
  const out: { table: string; column: string }[] = [];
  const re = /table:\s*'([a-z_]+)',\s*column:\s*'([a-z_]+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) out.push({ table: m[1], column: m[2] });
  return out;
}

describe('undo guard — every dependency query can actually run', () => {
  const entries = guardEntries();

  it('parses the guard list (a desynchronised scan fails, it does not silently pass)', () => {
    assert.ok(
      entries.length >= 14,
      `Only parsed ${entries.length} guard entries. Either the list shrank — which means fewer ` +
      'child tables are protected from a cascading delete — or its shape changed and this scan is ' +
      'now blind. Both need a human.',
    );
  });

  for (const { table, column } of entries) {
    it(`${table}.${column} exists`, () => {
      const cols = columnsOf(table);
      assert.ok(cols.size > 0, `Table ${table} is not in the schema snapshot. Refresh snapshots, or the guard is querying a table that does not exist — which errors, which blocks every undo.`);
      assert.ok(
        cols.has(column),
        `${table} has no column "${column}" (it has: ${[...cols].join(', ')}). The guard's query ` +
        'would ERROR on every call, and because a failed check counts as a blocker, undo would ' +
        'refuse forever. Check the column against the schema — do NOT assume it is player_id.',
      );
    });
  }

  /**
   * The continuity link is checked by a hand-written `.or()` rather than the loop, because the
   * roster player is referenced by TWO columns through a composite key. It is the record of a coach
   * confirming that this year's player is last year's player, so losing it silently is the worst
   * outcome on the list — assert its columns too.
   */
  it('the continuity-link special case names real columns', () => {
    const cols = columnsOf('rep_player_continuity_links');
    for (const c of ['current_roster_id', 'prior_roster_id']) {
      assert.ok(cols.has(c), `rep_player_continuity_links has no "${c}" — the hand-written .or() in rosterPlayerDependencies would error, blocking every undo.`);
    }
    const src = read('lib/db.ts');
    assert.match(
      src, /current_roster_id\.eq\.\$\{playerId\},prior_roster_id\.eq\.\$\{playerId\}/,
      'The continuity-link check no longer covers BOTH sides of the link. A roster player sits on ' +
      'either side depending on which season you are standing in; checking one is checking half.',
    );
  });
});

describe('undo guard — completeness is acknowledged, not assumed', () => {
  /**
   * Tables that cascade off rep_roster_players and are deliberately NOT guarded, with the reason.
   * A cascade absent from BOTH the guard and this list fails the test below — the point is that a
   * new child table cannot appear without somebody deciding which side it belongs on.
   */
  const cascadesNotGuarded: Record<string, string> = {
    // SET NULL, not CASCADE — the row survives, it just loses a pointer.
    rep_team_game_moments: 'ON DELETE SET NULL by design — a player leaving must not erase the coach\'s memory of the night.',
    rep_team_expenses:     'paid_by_player_id is SET NULL — loses a provenance pointer, not the expense.',
    // Reached only THROUGH a guarded parent.
    rep_team_lineups:      'lineup ENTRIES are guarded; the lineup itself is not player-scoped.',
    rep_fundraisers:       'fundraiser ENTRIES are guarded; the drive itself is not player-scoped.',
    rep_document_templates:'player DOCUMENTS are guarded; the template is org-scoped.',
    rep_allocation_installments: 'club allocations are team-scoped, not player-scoped.',
  };

  it('every table that references rep_roster_players is either guarded or explained', () => {
    const dir = join(REPO, 'supabase', 'migrations');
    const referencing = new Set<string>();
    for (const file of readdirSync(dir).filter(f => f.endsWith('.sql'))) {
      const sql = readFileSync(join(dir, file), 'utf8');
      if (!/rep_roster_players/.test(sql)) continue;
      // Walk CREATE TABLE blocks and record the table when its body references the roster table.
      const re = /CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?([a-z_]+)\s*\(([\s\S]*?)\n\);/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(sql)) !== null) {
        if (/REFERENCES\s+(?:public\.)?rep_roster_players/.test(m[2])) referencing.add(m[1]);
      }
    }

    assert.ok(referencing.size > 5, `Only found ${referencing.size} tables referencing rep_roster_players — the migration scan is not working, so its green means nothing.`);

    const guarded = new Set(guardEntries().map(e => e.table));
    guarded.add('rep_player_continuity_links'); // the hand-written special case above
    const unaccounted = [...referencing].filter(t => !guarded.has(t) && !(t in cascadesNotGuarded));

    assert.deepEqual(
      unaccounted, [],
      `These tables hang off rep_roster_players but are neither guarded nor listed as deliberate ` +
      `exceptions: ${unaccounted.join(', ')}. Deleting a roster player would take their rows with ` +
      'it. Decide which side each belongs on — do not delete this assertion to make it pass.',
    );
  });
});
