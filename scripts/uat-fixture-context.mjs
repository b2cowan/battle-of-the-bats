/**
 * Resolve the UAT coach fixture from the DEV database, by LOOKUP rather than by hard-coded id.
 *
 * ⚠ WHY THIS EXISTS. The per-feature layout probes each pinned the team as a literal UUID and took
 * the practice id from a `PROBE_EVENT_ID` env var, guarded by `test.skip(!EVENT)`. Two failure
 * modes followed, and both are silent:
 *   · reseeding the fixture changes the ids, so a pinned UUID rots into "team not found";
 *   · a missing env var SKIPS the probe, and a skip reads as green. One of those probes was
 *     already guarding nothing.
 *
 * This resolves the same rows the seeder writes, using the same lookup order, so there is nothing
 * to keep in sync by hand. When something is missing it THROWS with the repair command — a check
 * that cannot see its fixture must fail, never pass quietly.
 *
 * ⚠ IT ALSO WRITES, in exactly one place: the probe GAME is re-anchored to "now" when it has drifted
 * out of its live window, because the Game-Day console does not exist outside one. See the block at
 * the bottom for why a stale game is worse than a missing one.
 *
 * DEV ONLY. It reads `.env.local`, which points at the dev project, and refuses prod outright.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(here, '..', '.env.local'), quiet: true });

const PROD_REF = 'qcttcboqysynwcdyghil';
const REPAIR = 'node scripts/seed-uat-coach-fixture.mjs';

class FixtureError extends Error {
  constructor(what, repair = REPAIR) {
    super(`${what}\n  Repair: ${repair}`);
    this.name = 'FixtureError';
  }
}

/**
 * How far either side of "now" the probe game's start may sit before it is re-anchored.
 *
 * ⚠ This is DELIBERATELY NARROWER than the real live window (`gameDayWindow()` in
 * `lib/coach-game-day.ts`, which opens ~2h before and lingers ~3h after). It is not a copy of that
 * predicate and must not be maintained as one — a `.mjs` script cannot import the TypeScript source,
 * and a hand-kept duplicate of a window that decides whether a door exists would be a liability.
 * Staying well inside the real window means the console is unambiguously LIVE when the sweep opens
 * it, however the real predicate is tuned later.
 */
const GAME_MAX_AGE_MS = 3 * 60 * 60_000;   // started at most 3h ago
const GAME_MAX_LEAD_MS = 30 * 60_000;      // starts at most 30m from now

/**
 * @returns {Promise<{orgSlug:string, orgId:string, teamId:string, programYearId:string,
 *                    practiceEventId:string, gameEventId:string, fundraiserId:string,
 *                    sponsorId:string, finishedTeamId:string, finishedYearId:string,
 *                    baseUrl:string}>}
 */
export async function resolveUatContext() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const orgSlug = process.env.UAT_ORG_SLUG;

  if (!url || !key || !orgSlug) {
    throw new FixtureError(
      'Missing env: needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, UAT_ORG_SLUG in .env.local.',
      'populate .env.local from docs/agents/ops/ setup notes',
    );
  }
  if (url.includes(PROD_REF)) {
    throw new FixtureError('Refusing to run: NEXT_PUBLIC_SUPABASE_URL points at PRODUCTION.', 'point .env.local at dev');
  }

  const db = createClient(url, key);

  // ⚠ Every select below checks `error` before trusting an empty result. A supabase-js select that
  // errors returns no rows, and reading that as "zero rows" is exactly how an earlier session
  // mis-diagnosed this fixture twice (see the seeder's header).
  const org = await db.from('organizations').select('id, slug').eq('slug', orgSlug).maybeSingle();
  if (org.error) throw new FixtureError(`organizations lookup failed: ${org.error.message}`);
  if (!org.data) throw new FixtureError(`No organization with slug "${orgSlug}".`);

  const team = await db.from('rep_teams').select('id, name').eq('org_id', org.data.id).limit(1).maybeSingle();
  if (team.error) throw new FixtureError(`rep_teams lookup failed: ${team.error.message}`);
  if (!team.data) throw new FixtureError(`No rep team in org "${orgSlug}".`);

  const py = await db.from('rep_program_years')
    .select('id, year').eq('team_id', team.data.id).eq('status', 'active')
    .order('year', { ascending: false }).limit(1).maybeSingle();
  if (py.error) throw new FixtureError(`rep_program_years lookup failed: ${py.error.message}`);
  if (!py.data) throw new FixtureError(`Team "${team.data.name}" has no ACTIVE program year.`);

  // The seeder names its practice exactly this; resolving by name keeps the two in step without
  // an env var handoff.
  const ev = await db.from('rep_team_events')
    .select('id').eq('program_year_id', py.data.id).eq('name', 'UAT probe practice').maybeSingle();
  if (ev.error) throw new FixtureError(`rep_team_events lookup failed: ${ev.error.message}`);
  if (!ev.data) throw new FixtureError('No "UAT probe practice" event on the active program year.');

  // ── The probe GAME, kept live ──────────────────────────────────────────────────────────────
  // ⚠ THIS RESOLVER WRITES. That is unusual for a lookup and is the point: the Game-Day console
  // has no door outside a live window, so a game seeded yesterday resolves to the read-only recap
  // instead. The sweep would then render a real screen, measure it happily, and report green —
  // having never opened the console at all. That is the same failure shape as a probe that skips
  // itself when its fixture is missing: a check reporting on a screen it did not see.
  //
  // Re-anchoring is idempotent, touches only this one named fixture row, and only fires when the
  // game has actually drifted out of range.
  const game = await db.from('rep_team_events')
    .select('id, starts_at, ends_at').eq('program_year_id', py.data.id).eq('name', 'UAT probe game').maybeSingle();
  if (game.error) throw new FixtureError(`probe game lookup failed: ${game.error.message}`);
  if (!game.data) throw new FixtureError('No "UAT probe game" event on the active program year.');

  const startedAt = Date.parse(game.data.starts_at);
  const drift = Date.now() - startedAt;
  if (!Number.isFinite(startedAt) || drift > GAME_MAX_AGE_MS || drift < -GAME_MAX_LEAD_MS) {
    const upd = await db.from('rep_team_events').update({
      starts_at: new Date(Date.now() - 30 * 60_000).toISOString(),
      ends_at: new Date(Date.now() + 90 * 60_000).toISOString(),
    }).eq('id', game.data.id);
    if (upd.error) throw new FixtureError(`could not re-anchor the probe game: ${upd.error.message}`);
    console.log('  · probe game re-anchored to now (it had drifted out of its live window)');
  }

  // One fundraiser on the live season — the Money hub's Fundraisers tab drills into it
  // (`?section=fundraisers&fundraiser=`), and a drill-in with no id to open would sweep the LIST
  // twice and report green on a screen nobody looked at.
  const fr = await db.from('rep_fundraisers')
    .select('id').eq('program_year_id', py.data.id).eq('kind', 'fundraiser')
    .order('created_at').limit(1).maybeSingle();
  if (fr.error) throw new FixtureError(`rep_fundraisers lookup failed: ${fr.error.message}`);
  if (!fr.data) throw new FixtureError('No fundraiser on the active program year.');

  // ⚠ A SPONSOR DRAWS A DIFFERENT SCREEN, and nothing automated had ever opened one. The drill-in
  // for a drive is a six-column leaderboard; a sponsor replaces it with a one-row record, its own
  // title chips and a status hint — none of which the `coach-fundraiser` screen can measure,
  // because a drive never renders them. Resolved by KIND rather than by taking the second row:
  // "whatever is second" is how a fixture reshuffle silently sweeps the same screen twice.
  const sp = await db.from('rep_fundraisers')
    .select('id').eq('program_year_id', py.data.id).eq('kind', 'sponsor')
    .order('created_at').limit(1).maybeSingle();
  if (sp.error) throw new FixtureError(`sponsor lookup failed: ${sp.error.message}`);
  if (!sp.data) throw new FixtureError('No SPONSOR on the active program year — the sponsor screen cannot be swept.');

  /**
   * ⚠⚠ THE BETWEEN-SEASONS TEAM — the fixture gap that hid three rounds of defects (closed
   * 2026-08-16, P2). Until this existed the rendered sweep's world had NO completed season, so
   * Season's End, the compare list and every "this season has finished" state were invisible to it.
   * A separate TEAM rather than a second season, because the state worth rendering is a team with
   * no live year at all — which the main fixture team cannot be without losing every other screen.
   */
  const pastTeam = await db.from('rep_teams')
    .select('id, name').eq('org_id', org.data.id).eq('name', 'UAT Between Seasons').maybeSingle();
  if (pastTeam.error) throw new FixtureError(`between-seasons team lookup failed: ${pastTeam.error.message}`);
  if (!pastTeam.data) throw new FixtureError('No "UAT Between Seasons" team — the finished-season screens cannot be swept.');

  const pastYear = await db.from('rep_program_years')
    .select('id, year, status').eq('team_id', pastTeam.data.id)
    .order('year', { ascending: false }).limit(1).maybeSingle();
  if (pastYear.error) throw new FixtureError(`finished season lookup failed: ${pastYear.error.message}`);
  if (!pastYear.data) throw new FixtureError('The between-seasons team has no program year.');
  // ⚠ A live year here would silently turn every finished-season screen into a live one, and the
  // sweep would render them happily. The state is the point, so it is asserted rather than assumed.
  if (pastYear.data.status !== 'completed' && pastYear.data.status !== 'archived') {
    throw new FixtureError(
      `"UAT Between Seasons" has a ${pastYear.data.status} year — it must have NO live season, or `
      + 'the finished-season screens render as live ones and the sweep measures the wrong thing.',
    );
  }

  return {
    orgSlug: org.data.slug,
    orgId: org.data.id,
    teamId: team.data.id,
    programYearId: py.data.id,
    practiceEventId: ev.data.id,
    gameEventId: game.data.id,
    fundraiserId: fr.data.id,
    sponsorId: sp.data.id,
    /** A team whose WORKING season has finished — Season's End, the compare list, read-only records. */
    finishedTeamId: pastTeam.data.id,
    finishedYearId: pastYear.data.id,
    baseUrl: process.env.UAT_BASE_URL ?? 'http://localhost:3000',
  };
}
