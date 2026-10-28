import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * House League 9d-2b (mig 409): NO WRITE TO A PUBLISHED DIVISION'S GAME GOES UNRECORDED. The record is a trigger on
 * `league_games`, so every writer records its change in its own statement without knowing to (the build prompt's
 * "inside the same transaction as the game write — never a second call that can fail alone"). This guard pins the
 * shape that makes it true: both triggers exist, and nothing in the app writes the change record or `moved_from`
 * itself (a hand-written row could disagree with the trigger; a hand-written `moved_from` would say the wrong "Was").
 */
const ROOT = join(import.meta.dirname, '..', '..');
const MIG = readFileSync(join(ROOT, 'supabase/migrations/409_a_divisions_schedule_is_a_draft_until_it_is_published.sql'), 'utf8');

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.(ts|tsx|mjs)$/.test(name) && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}
const APP = ['app', 'lib', 'components', 'scripts'].flatMap(d => sources(join(ROOT, d)));

describe('a published division\'s game changes are recorded by the database, never by hand', () => {
  it('mig 409 puts the recorder on every insert and update of a game', () => {
    assert.match(MIG, /CREATE TRIGGER league_games_record_change_upd\s+BEFORE UPDATE ON public\.league_games/);
    assert.match(MIG, /CREATE TRIGGER league_games_record_change_ins\s+AFTER INSERT ON public\.league_games/);
    assert.match(MIG, /SELECT d\.schedule_published_at INTO v_published FROM league_divisions d WHERE d\.id = NEW\.division_id/);
  });

  it('no app code inserts or updates league_game_changes (the trigger writes; the SQL functions send and undo)', () => {
    const bad = APP.filter(p => /from\(\s*['"]league_game_changes['"]\s*\)\s*\.(insert|update|upsert)/.test(readFileSync(p, 'utf8')));
    assert.deepEqual(bad, []);
  });

  it('no app code writes moved_from (the trigger keeps the date families heard)', () => {
    const bad = APP.filter(p => /\bmoved_from\s*:/.test(readFileSync(p, 'utf8')));
    assert.deepEqual(bad, []);
  });

  it('every send goes through the one claim, which locks the division and claims exactly what the sender saw', () => {
    assert.match(MIG, /FUNCTION public\.league_division_changes_send[\s\S]*?pg_advisory_xact_lock\(hashtextextended\('league_schedule:'/);
    assert.match(MIG, /FUNCTION public\.league_games_generate_save[\s\S]*?pg_advisory_xact_lock\(hashtextextended\('league_schedule:'/);
  });
});
