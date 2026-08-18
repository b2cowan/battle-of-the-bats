import { NextResponse } from 'next/server';
import { resolveCoachHistoryReadFromRequest } from '@/lib/coach-team-read';
import { getRepRosterPlayers } from '@/lib/db';
import { denyUnless, hasRecordAccess } from '@/lib/coach-capabilities';
import { withObservability } from '@/lib/observability';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * "The roster" — WHO WAS ON THE TEAM that season, for its own closed-season page
 * (COACH_SEASON_CLOSE_AND_ARCHIVE_PLAN §3.3, owner-approved 2026-08-18; the mockups are the spec).
 *
 * ⚠⚠ **A HISTORY ENDPOINT.** The three questions `HISTORY_ENDPOINTS` demands:
 *
 *   1. **Record or instrument? RECORD.** Who played that year is a settled fact. The roster PAGE,
 *      by contrast, is an instrument — it adds, edits, removes and imports players, opens each
 *      profile, and owns dues, documents and development — and it stays on the working season.
 *      This route lists names and numbers, has no write verb, and cannot be acted on.
 *   2. **Does the whole subtree carry the year? YES, because there is no subtree.** No row opens a
 *      player profile. That is deliberate and not a simplification: a profile is the busiest
 *      instrument in the portal (dues, documents, development, guardians, medical), and a record
 *      must not be an entrance to one. `coach-finished-season-surfaces.test.ts` holds the caller
 *      to the flatness this route cannot enforce.
 *   3. **Could the coach tell which season they are reading? YES, STRUCTURALLY.** Its only
 *      year-passing caller is the closed-season page, which titles itself with that season's name.
 *      This matters more here than anywhere else on the page: a roster is the one shelf that looks
 *      identical from year to year, so a coach reading the wrong one would have no way to notice.
 *
 * ⚠⚠ **NOT ONE FIELD OF GUARDIAN OR MEDICAL DATA LEAVES THIS ROUTE.** The row it reads carries
 * guardian names, emails and phone numbers, medical notes, emergency contacts and admin notes —
 * every one of them behind its own grant on the live roster, and none of them anything to do with
 * remembering who played. Player names are baseline (owner ruling 2026-08-03), which is why record
 * access alone is the gate; that ruling covers NAMES and stops there. The projection below is the
 * whole answer, and adding a field to it is a decision about a minor's private data, not a tidy-up.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;

  const resolved = await resolveCoachHistoryReadFromRequest(req, orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { programYear, capabilities, isReadOnly } = resolved;

  const denied = denyUnless(
    hasRecordAccess(capabilities),
    'You do not have access to this season’s roster.',
  );
  if (denied) return denied;

  const players = await getRepRosterPlayers(programYear.id);

  /**
   * ⚠ **EVERY NAME, INCLUDING THE ONES WHO LEFT — and the row says which.** A player released in
   * March still played for this team, and quietly dropping them would rewrite the season, which is
   * the one thing an archive must never do. It is also the ONE difference between this shelf and
   * the rollover's idea of a roster (that carries `active` only, correctly: it is choosing who
   * comes back, not recording who was here).
   *
   * ⚠ The status rides out so the PAGE can label the difference rather than presenting fourteen
   * names as one squad. Nothing here filters on it.
   */
  return NextResponse.json({
    season: { programYearId: programYear.id, name: programYear.name, isReadOnly },
    players: players
      .map(p => ({
        playerId: p.id,
        firstName: p.playerFirstName,
        lastName: p.playerLastName,
        number: p.playerNumber,
        primaryPosition: p.primaryPosition,
        status: p.status,
      }))
      /**
       * ⚠ By NUMBER where there is one, then by name — the order a coach reads a roster in, and
       * stable across visits. A list that arrives in whatever order the database returned makes
       * two readings of the same finished season look like two different teams.
       */
      .sort((a, b) => {
        const an = a.number ? Number(a.number) : Number.NaN;
        const bn = b.number ? Number(b.number) : Number.NaN;
        const aHas = Number.isFinite(an);
        const bHas = Number.isFinite(bn);
        if (aHas && bHas && an !== bn) return an - bn;
        if (aHas !== bHas) return aHas ? -1 : 1;
        return `${a.firstName} ${a.lastName ?? ''}`.localeCompare(`${b.firstName} ${b.lastName ?? ''}`);
      }),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/season-roster' });
