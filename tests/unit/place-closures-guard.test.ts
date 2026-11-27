import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Club Website Stage 2, Session 2A (mig 539): CLOSE A PLACE'S SHAPE. The database half is proved by
 * scripts/club-website-stage2-closure-check.sql (rolled back, on dev); this guard pins the shapes that make it true and
 * keep it true when someone edits the step later.
 */
const ROOT = join(import.meta.dirname, '..', '..');
const MIG = readFileSync(join(ROOT, 'supabase/migrations/539_a_closed_place_closes_for_every_program.sql'), 'utf8');
const SERVER = readFileSync(join(ROOT, 'lib/place-closures-server.ts'), 'utf8');
const PURE = readFileSync(join(ROOT, 'lib/place-closures.ts'), 'utf8');

const MIG_DIR = join(ROOT, 'supabase/migrations');
const MIGS = readdirSync(MIG_DIR).filter(n => n.endsWith('.sql')).sort();
const bodyIn = (sql: string, name: string) =>
  new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$;`).exec(sql)?.[1] ?? null;
/** The function's NEWEST definition (mig 549 replaced the press; a later migration that replaces it again is read here). */
const fnBody = (name: string) => {
  for (const n of [...MIGS].reverse()) {
    const body = bodyIn(readFileSync(join(MIG_DIR, n), 'utf8'), name);
    if (body) return body;
  }
  assert.fail(`${name} is defined in a migration`);
};
/** The migrations that define the press (539, then 549's replacement): the only ones that may turn the quiet link on. */
const PRESS_MIGS = MIGS.filter(n => bodyIn(readFileSync(join(MIG_DIR, n), 'utf8'), 'org_place_closure_press'));

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.(ts|tsx|mjs)$/.test(name) && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

describe('the press is one step, all or nothing', () => {
  const press = fnBody('org_place_closure_press');
  const firstWrite = press.indexOf('INSERT INTO org_place_closures');

  it('decides every refusal BEFORE its first write, so a refusal anywhere writes nothing anywhere', () => {
    assert.ok(firstWrite > 0);
    const refusals = [...press.matchAll(/RETURN QUERY SELECT '(\w+)'::text/g)];
    assert.ok(refusals.length >= 7, 'invalid, past, not_found, finished, draft, changed are all refusals');
    for (const r of refusals) assert.ok(r.index! < firstWrite, `the '${r[1]}' refusal comes before the first write`);
    assert.match(press.slice(firstWrite), /RAISE EXCEPTION/, 'after the first write a failure raises (the call rolls back whole)');
    assert.doesNotMatch(press.slice(firstWrite), /RETURN QUERY SELECT '/, 'no refusal is returned after a write');
  });

  it('never calls the Rainout\'s step, which RETURNS its refusals (one season written, the next refused)', () => {
    assert.doesNotMatch(press, /league_rainout_press/);
  });

  it('locks every division one at a time in id order (the send\'s lock), then the rows, before it checks', () => {
    assert.match(press, /array_agg\(DISTINCT g\.division_id ORDER BY g\.division_id\)[\s\S]*?FOREACH v_div IN ARRAY v_divs LOOP\s+PERFORM pg_advisory_xact_lock\(hashtextextended\('league_schedule:' \|\| v_div::text, 0\)\);/);
    const locks = press.indexOf("hashtextextended('league_schedule:'");
    assert.ok(locks < press.indexOf('FROM league_games g WHERE g.id = ANY (v_all_league) ORDER BY g.id FOR UPDATE'));
    assert.ok(press.indexOf('ORDER BY ev.id FOR UPDATE') < press.indexOf("RETURN QUERY SELECT 'draft'"), 'rows locked before the checks');
  });

  it('a retried press runs once: the key\'s lock, then the key\'s rows answer the replay', () => {
    assert.match(press, /pg_advisory_xact_lock\(hashtextextended\('place_closure_press:' \|\| p_press_key::text, 0\)\);\s+IF EXISTS \(SELECT 1 FROM org_place_closures c WHERE c\.press_key = p_press_key\)/);
    assert.match(MIG, /CONSTRAINT org_place_closures_press_once UNIQUE \(press_key, press_seq\)/);
    assert.match(MIG, /CREATE UNIQUE INDEX IF NOT EXISTS league_rainouts_closure_day_uq\s+ON public\.league_rainouts \(closure_id, season_id, day\) WHERE closure_id IS NOT NULL/);
  });

  it('K6 · a scored game is never touched: house league only `scheduled`; rep unscored', () => {
    assert.match(press, /WHERE g\.status <> 'scheduled'/);
    assert.match(press, /OR ev\.team_score IS NOT NULL OR ev\.opponent_score IS NOT NULL OR ev\.result IS NOT NULL/);
  });

  it('nothing moves a tournament game: the press never writes `games`, and skips a club tournament\'s rep copy', () => {
    assert.doesNotMatch(press, /(UPDATE|INSERT INTO|DELETE FROM)\s+(public\.)?games\b/);
    assert.match(press, /ev\.source_tournament_game_id IS NOT NULL/);
  });

  it('M8 · several diamonds of one place in one press: each (place, diamond) once, never a whole place beside its diamond', () => {
    assert.match(press, /count\(DISTINCT \(pl->>'v'\) \|\| ':' \|\| coalesce\(pl->>'f', ''\)\) FROM jsonb_array_elements\(v_places\) pl\) <> v_np/);
    assert.match(press, /WHERE wp->>'f' IS NULL AND dp->>'f' IS NOT NULL\) THEN\s+RETURN QUERY SELECT 'invalid'/);
    assert.doesNotMatch(press, /count\(DISTINCT pl->>'v'\)/, "mig 539's one-entry-per-place rule is gone");
  });

  it('D1 · a rep game is marked by every closure of the press it is at; a house league game belongs to the first', () => {
    assert.match(press, /JOIN org_place_closures c ON c\.press_key = p_press_key\s+AND place_closure_match\(/);
    assert.match(press, /FROM jsonb_array_elements\(v_mark_pairs\) x JOIN rep_team_events ev/);
    assert.match(press, /ORDER BY c\.press_seq LIMIT 1\) m\s+WHERE g\.id = ANY \(v_league\);/, 'the Rainout record is still the first closure');
  });

  it('T2 (mig 551) · a game a closure still showing already marks is marked again, its coach already told, locked with the rest', () => {
    // Found before the locks and locked in the same id-ordered statement as the ticked games, then read again under them.
    assert.match(press, /PERFORM 1 FROM rep_team_events ev\s+WHERE ev\.id = ANY \(v_all_rep \|\| v_already\) AND ev\.event_type IN \('league_game', 'tournament_game'\) ORDER BY ev\.id FOR UPDATE;/);
    assert.ok(press.indexOf('INTO v_already_stamps') > press.indexOf('ORDER BY ev.id FOR UPDATE'), 'its stamps are read under the lock');
    // A standing mark, as `markSpent` reads it: the closure showing, the game where and when it was marked.
    for (const col of ['marked_org_venue_id', 'marked_facility_id', 'marked_place_id', 'marked_location']) {
      assert.match(press, new RegExp(`m\\.${col} IS NOT DISTINCT FROM ev\\.`));
    }
    assert.match(press, /oc\.reopened_at IS NULL AND oc\.ends_at > now\(\)/);
    // Its marks arrive stamped, so the send after the press (which emails any mark without one) skips its coach.
    assert.match(press, /marked_place_id, marked_location, coach_emailed_at\)[\s\S]*?\(v_already_stamps->>\(ev\.id::text\)\)::timestamptz/);
    assert.match(press, /WHERE ev\.id = ANY \(v_marked\);/);
  });

  it('Reopen moves no game (K11 A): it only stamps the closure', () => {
    const reopen = fnBody('org_place_closure_reopen');
    assert.doesNotMatch(reopen, /league_games|rep_team_events|games\b/);
    assert.match(reopen, /UPDATE org_place_closures c SET reopened_at = now\(\), reopened_by = p_actor/);
  });
});

describe('"Link both" is not news (K7)', () => {
  const recorder = fnBody('league_games_record_change');

  it('the recorder keeps mig 409\'s published-division rule and adds the one link rule, by the shared name match', () => {
    assert.match(recorder, /SELECT d\.schedule_published_at INTO v_published FROM league_divisions d WHERE d\.id = NEW\.division_id/);
    assert.match(recorder, /v_link\s+:= coalesce\(current_setting\('league\.quiet_link', true\), ''\) = 'on'\s+AND OLD\.org_venue_id IS NULL AND OLD\.org_venue_facility_id IS NULL\s+AND NEW\.org_venue_id IS NOT NULL AND NEW\.org_venue_facility_id IS NULL\s+AND NEW\.location IS NOT DISTINCT FROM OLD\.location\s+AND place_name_in_typed\(/);
    assert.match(recorder, /v_where := NOT v_link AND \(/);
  });

  it('only the closure press turns the quiet link on, around its own link step only, and nothing else in the product does', () => {
    const press = fnBody('org_place_closure_press');
    assert.match(press, /PERFORM set_config\('league\.quiet_link', 'on', true\);\s+UPDATE league_games g SET org_venue_id = \(e->>'venueId'\)::uuid, updated_at = now\(\)\s+FROM jsonb_array_elements\(p_links\) e WHERE e->>'kind' = 'league' AND g\.id = \(e->>'id'\)::uuid;\s+PERFORM set_config\('league\.quiet_link', 'off', true\);/);
    const others = sources(join(ROOT, 'app')).concat(sources(join(ROOT, 'lib')), sources(join(ROOT, 'scripts')))
      .filter(p => readFileSync(p, 'utf8').includes('quiet_link') && !p.endsWith('league-game-changes.ts'));
    assert.deepEqual(others, []);
    const migs = MIGS.filter(n => !PRESS_MIGS.includes(n))
      .filter(n => readFileSync(join(MIG_DIR, n), 'utf8').includes("set_config('league.quiet_link', 'on'"));
    assert.deepEqual(migs, []);
    assert.ok(PRESS_MIGS.includes('539_a_closed_place_closes_for_every_program.sql'));
  });

  it('the send reads the quiet link from the held rows themselves (no second read that could fail or disagree)', () => {
    const pure = readFileSync(join(ROOT, 'lib/league-game-changes.ts'), 'utf8');
    assert.match(pure, /const before = heard && linked \? \{ \.\.\.heard, venueId: linked \} : heard;/);
    assert.doesNotMatch(readFileSync(join(ROOT, 'lib/league-game-changes-server.ts'), 'utf8'), /org_venues/);
  });
});

describe('one matching rule in two languages', () => {
  it('the database\'s match and the window\'s match have the same branches', () => {
    const sql = fnBody('place_closure_match');
    assert.match(sql, /WHEN p_scope = 'all' THEN 'linked'/);
    assert.match(sql, /WHEN g_venue IS NOT NULL AND g_venue = p_venue THEN\s+CASE WHEN p_facility IS NULL OR g_facility = p_facility THEN 'linked'\s+WHEN g_facility IS NULL THEN 'maybe'\s+ELSE NULL END/);
    assert.match(sql, /WHEN g_venue IS NULL AND place_name_in_typed\(p_name, g_typed\) THEN 'maybe'/);
    assert.match(PURE, /if \(p\.scope === 'all'\) return 'linked';\s+if \(g\.venueId\) \{\s+if \(g\.venueId !== p\.venueId\) return null;\s+if \(!p\.facilityId \|\| g\.facilityId === p\.facilityId\) return 'linked';\s+return g\.facilityId \? null : 'maybe';/);
    assert.match(fnBody('place_name_in_typed'), /position\(lower\(btrim\(p_name\)\) IN lower\(p_typed\)\) > 0/);
  });

  it('a rep game\'s typed text is read the same way by the press and the window', () => {
    assert.equal((fnBody('org_place_closure_press').match(/concat_ws\(' · ', ev\.location, tp\.name\)/g) ?? []).length, 4, 'checked, already marked (T2), linked, marked: the same text');
    assert.match(PURE, /parts\.join\(' · '\)/);
  });
});

describe('what reaches a public page', () => {
  it('the strip reads its closures through the place-words-only columns and mapper', () => {
    assert.match(SERVER, /from\('org_place_closures'\)\s+\.select\(STRIP_CLOSURE_COLUMNS\)/);
    assert.match(SERVER, /return rows\.map\(r => stripClosureOf\(r, diamondParks\)\);/);
    // S2's "all diamonds": the facilities' KINDS only, for the wholly closed parks (no facility name reaches the strip).
    assert.match(SERVER, /from\('org_venue_facilities'\)\.select\('org_venue_id, facility_type'\)/);
    // A failed kinds read costs the words "all diamonds", never the strip (/review: it would have dropped every closure).
    assert.match(SERVER, /\.order\('id'\)\.range\(a, b\)\)\.catch\(\(\) => \[\]\) : \[\];/);
  });

  it('a mark and a closure reason are read for ids the caller already decided may be shown, never by club or team', () => {
    assert.match(SERVER, /export async function standingRepMarks\(orgId: string, eventIds: readonly string\[\]\)/);
    assert.match(SERVER, /export async function leagueClosureReasons\(orgId: string, gameIds: readonly string\[\]\)/);
    const marks = SERVER.slice(SERVER.indexOf('export async function standingRepMarks'), SERVER.indexOf('// ── Why a house league game'));
    assert.match(marks, /\.eq\('org_id', orgId\)\.in\('event_id', c\)/, 'the club is a fence on the ids');
    assert.doesNotMatch(marks, /\.eq\('(team_id|season_id)'/, 'never selected by team or season');
  });

  it('the new records are the service role\'s only', () => {
    for (const t of ['org_place_closures', 'rep_event_closure_marks']) {
      assert.match(MIG, new RegExp(`ALTER TABLE public\\.${t} ENABLE ROW LEVEL SECURITY;\\s+REVOKE ALL ON TABLE public\\.${t} FROM anon, authenticated;`));
    }
  });
});

describe('no new background job: a closure ends by its own dates', () => {
  it('the migration schedules nothing', () => {
    assert.doesNotMatch(MIG, /cron\.schedule/);
  });

  it('no cron route reads a closure', () => {
    const cron = sources(join(ROOT, 'app')).filter(p => /[\\/]cron[\\/]/.test(p));
    assert.deepEqual(cron.filter(p => /org_place_closures|place-closures/.test(readFileSync(p, 'utf8'))), []);
  });
});
