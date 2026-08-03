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
 * @returns {Promise<{orgSlug:string, orgId:string, teamId:string, programYearId:string,
 *                    practiceEventId:string, baseUrl:string}>}
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

  return {
    orgSlug: org.data.slug,
    orgId: org.data.id,
    teamId: team.data.id,
    programYearId: py.data.id,
    practiceEventId: ev.data.id,
    baseUrl: process.env.UAT_BASE_URL ?? 'http://localhost:3000',
  };
}
