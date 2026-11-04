/**
 * Club Tier Stage 14 S2 — the child record (`org_children`, mig 435). A SOURCE scan: the rules themselves run in the
 * database and are proved by tests/sql/org-children-fixture.sql (dev, rolled back); this pins the app's side of them.
 *
 * 1. The Families book counts children by the STORED child, on both kinds of row, and no longer rebuilds them from
 *    continuity links at read time (two homes for "which rows are one child" would drift — the database keeps it now).
 * 2. The migration does not touch the money-adjacent sign-up functions: the house-league placement RPC and the tryout
 *    accept RPC are covered by the insert trigger, so their locking and their duplicate refusal stay exactly as shipped
 *    (build prompt S2-2's "watch").
 * 3. One child per entry is the trigger's job: no app writer mints org_children rows itself.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { between, filesUnder, readCode, readSource } from './_source-code.ts';

describe('the Families book reads the stored child', () => {
  const src = readCode('lib/families-read.ts');
  it('both the roster read and the house-league read select child_id', () => {
    assert.match(src, /orgRows<any>\('rep_roster_players',\s*'id, child_id,/);
    assert.match(src, /orgRows<any>\('league_registrations',\s*'id, child_id,/);
  });
  it('no read-time union over continuity links is left', () => {
    assert.doesNotMatch(src, /rep_player_continuity_links/);
    assert.doesNotMatch(src, /unionFind/);
  });
  it('a child is keyed by its child, on every kind of row, with no guessed fallback key', () => {
    assert.doesNotMatch(src, /childKey: `league:\$\{r\.id\}`/);
    assert.doesNotMatch(readCode('lib/families-export.ts'), /children\.set\(`league:\$\{r\.id\}`/);
    assert.doesNotMatch(src, /`(rep|league):\$\{r\.id\}`/);
  });
});

describe('the migration leaves the money-adjacent sign-up functions alone', () => {
  const sql = readSource('supabase/migrations/435_a_child_is_one_record_across_seasons.sql');
  it('does not re-create the house-league placement or the tryout accept', () => {
    assert.doesNotMatch(sql, /function\s+public\.league_registration_place/i);
    assert.doesNotMatch(sql, /function\s+public\.accept_tryout_and_create_dues/i);
  });
  it('the insert trigger runs with the server\'s rights (two old anon insert policies still exist on the sign-ups)', () => {
    const header = between(sql, 'create or replace function public.org_child_for_entry()', 'as $$');
    assert.match(header, /security definer/);
  });
});

describe('only the database mints a child', () => {
  it('no app code inserts into org_children', () => {
    const offenders = ['lib', 'app', 'components']
      .flatMap(dir => [...filesUnder(dir, '.ts'), ...filesUnder(dir, '.tsx')])
      .filter(rel => /from\('org_children'\)[\s\S]{0,80}\.(insert|upsert)\(/.test(readCode(rel)));
    assert.deepEqual(offenders, [], 'A child is minted by org_child_for_entry or joined by a fact / a person\'s yes — never written from the app.');
  });
});
