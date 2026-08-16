import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * M1 MEMBERSHIPS FOR UAT FIXTURES — "the team is the account" (owner ruling 2026-08-16, mig 245).
 *
 * ⚠ **WHY THIS EXISTS.** Access truth moved from `rep_team_coaches` (a per-SEASON row) to
 * `rep_team_staff_memberships` (a per-TEAM row). Eleven scenario fixtures still minted only the
 * season row, so every coach they created 403'd at the first membership-gated route — and a UAT
 * spec that fails at sign-in fails for a reason that has nothing to do with what it is testing,
 * which is the slowest kind of red to diagnose.
 *
 * ⚠ **IT PROJECTS RATHER THAN DUPLICATES, deliberately.** Each fixture already declares its coaches
 * — who they are, what role, which grants — in its `rep_team_coaches` inserts. Asking every spec to
 * restate all of that a second time is eleven chances to write it down differently, and the
 * difference would be invisible: the season row governs the write routes, the membership governs
 * the read gate, so a mismatched pair produces a coach who can save something they cannot see.
 * Reading the rows back means a spec that adds a fourth coach gets its membership for free, and can
 * never disagree with itself.
 *
 * ⚠ Call it AFTER the last `rep_team_coaches` insert in `beforeAll`, and call `clearMemberships`
 * in the fixture's cleanup BEFORE the team row goes (the FK would otherwise leave the team
 * undeletable, which surfaces as the teardown assertion rather than as anything to do with staff).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * ⚠ THE PRODUCTION REF, CHECKED HERE TOO. The two seed scripts that write memberships each refuse
 * the prod project outright (`scripts/seed-uat-coach-fixture.mjs`, `scripts/uat-fixture-context.mjs`)
 * — this helper trusted whatever client its caller handed it, which made it the one membership
 * writer in the repo with no guard of its own. It deletes and upserts staff rows; a spec run with a
 * mis-set `.env.local` is exactly the accident the other two are paranoid about.
 */
const PROD_REF = 'qcttcboqysynwcdyghil';

function refuseProduction(): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  if (url.includes(PROD_REF)) {
    throw new Error(
      'coach-membership fixture: refusing to run — NEXT_PUBLIC_SUPABASE_URL points at PRODUCTION. '
      + 'Point .env.local at the dev project before running UAT specs.',
    );
  }
}

interface SeasonStaffRow {
  user_id: string;
  coach_role: 'head_coach' | 'assistant_coach';
  capabilities: Record<string, unknown> | null;
  org_id: string;
}

/**
 * Give every coach who holds a season row on this team an ACTIVE membership carrying the same role
 * and grants. Idempotent (upsert on the `(team_id, user_id)` unique key), so a fixture that reruns
 * or that seeds two seasons converges rather than colliding.
 *
 * ⚠ When one person holds rows on several seasons, the NEWEST wins — a membership is what they hold
 * NOW, and the current grant is the honest one everywhere (the ruling that replaced Chunk F's
 * governing rule 1). Rows are read newest-first for exactly that reason.
 */
export async function grantMembershipsFromSeasonRows(
  admin: SupabaseClient,
  teamId: string,
): Promise<void> {
  refuseProduction();
  const { data, error } = await admin
    .from('rep_team_coaches')
    .select('user_id, coach_role, capabilities, org_id')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as SeasonStaffRow[];
  if (rows.length === 0) {
    throw new Error(
      `grantMembershipsFromSeasonRows: team ${teamId} has no rep_team_coaches rows to project. `
      + 'Call this AFTER the fixture has inserted its coaches, or the specs will 403 at sign-in.',
    );
  }

  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.user_id)) continue;   // newest row wins — see the note above
    seen.add(row.user_id);
    const { error: upsertErr } = await admin.from('rep_team_staff_memberships').upsert({
      org_id: row.org_id,
      team_id: teamId,
      user_id: row.user_id,
      coach_role: row.coach_role,
      capabilities: row.capabilities,
      status: 'active',
      revoked_at: null,
      revoked_by: null,
    }, { onConflict: 'team_id,user_id' });
    if (upsertErr) throw upsertErr;
  }
}

/** Drop a team's memberships — call in cleanup BEFORE the team row is deleted. */
export async function clearMemberships(admin: SupabaseClient, teamId: string): Promise<void> {
  refuseProduction();
  await admin.from('rep_team_staff_memberships').delete().eq('team_id', teamId);
}
