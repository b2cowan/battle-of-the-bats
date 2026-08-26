import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getRepTeam,
  getCoachingAssignmentsForUser,
  getActiveRepProgramYear,
  getRepTryoutRegistration,
  acceptTryoutAndAddToRoster,
  TryoutAcceptError,
  getRepRosterPlayers,
  rosterPlayerDependencies,
  undoTryoutAcceptance,
} from '@/lib/db';
import { denyUnless, redactRosterPlayer } from '@/lib/coach-capabilities';
import { withObservability } from '@/lib/observability';
import type { RepProgramYear } from '@/lib/types';

type Resolved =
  | { ok: false; res: Response }
  | { ok: true; orgId: string; team: Awaited<ReturnType<typeof getRepTeam>>; programYear: RepProgramYear; assignment: Awaited<ReturnType<typeof getCoachingAssignmentsForUser>>[number] };

// Any assigned coach with the tryouts grant can add a player to the roster (this route lives inside
// the Premium Coaches Portal — roster is already Premium). The fee-access reasoning that used to sit
// here went with the fees themselves (owner 2026-08-26).
async function resolveCoach(orgSlug: string, teamId: string): Promise<Resolved> {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { ok: false, res: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { ok: false, res: forbidden() };
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) return { ok: false, res: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { ok: false, res: forbidden() };
  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) return { ok: false, res: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  return { ok: true, orgId: ctx.org.id, team, programYear, assignment };
}

/**
 * Add an offered candidate to the roster. One tap, no drawer, no fees (owner ruling 2026-08-26).
 *
 * ⚠ FEES DELIBERATELY DO NOT HAPPEN HERE, and the reason is a domain fact rather than a
 * simplification: what a family owes depends on how many players end up on the roster, so a
 * per-player amount cannot be known at the moment a player is added to it. Dues are set afterwards
 * from the Dues screen's "Set dues for all players", which is the same generator the Budget Plan
 * uses. The old drawer's remaining fields (number, position, jersey size) live on the Roster page,
 * where a coach fills them for everyone in one pass. Do not reintroduce a fee step here.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const r = await resolveCoach(orgSlug, teamId);
  if (!r.ok) return r.res;
  const denied = denyUnless(r.assignment.capabilities.tryouts, 'Only the head coach manages tryouts.');
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const registrationId = typeof body.registrationId === 'string' ? body.registrationId : '';

  const reg = await getRepTryoutRegistration(registrationId);
  if (!reg || reg.programYearId !== r.programYear.id) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  // Fast-fail on a stale state (the RPC guards this atomically too under a row lock).
  if (reg.status !== 'offered') {
    return NextResponse.json({ error: 'not_offered', message: 'This candidate is no longer awaiting acceptance.' }, { status: 409 });
  }

  try {
    const { registration, player } = await acceptTryoutAndAddToRoster(reg.id);
    // ⚠ NO WELCOME EMAIL. Rostering a player is the record of a conversation the coach has
    // already had — and by the time it happens the family has signed a letter this platform did
    // not write. A "Welcome to the Team!" from FieldLogicHQ arriving after that is at best noise
    // and at worst contradicts it (owner ruling 2026-08-26). Do not reinstate behind a switch.
    // Redact on the way out like every other roster read. `tryouts` and `rosterPii` are independent
    // grants, so a tryouts-only assistant reached this with an unredacted player attached. Harmless
    // today — the row was just created from registration fields they already see, and medical /
    // emergency / notes columns are still null — but this route was the one roster response in the
    // portal that shipped the raw shape, and it would leak silently the moment the accept RPC starts
    // copying more across. (/review 2026-07-31)
    return NextResponse.json({
      registrationId: registration.id,
      status: registration.status,
      player: redactRosterPlayer(player, r.assignment.capabilities),
    });
  } catch (e) {
    if (e instanceof TryoutAcceptError) {
      const status = e.code === 'not_found' ? 404 : e.code === 'not_offered' ? 409 : 400;
      return NextResponse.json({ error: e.message }, { status });
    }
    throw e;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-decisions/accept' });

/**
 * Undo an acceptance — take the player back off the roster and return them to Offering.
 *
 * ⚠⚠ THE GUARD IS THE FEATURE. Accepting used to be a one-way door: the board refused to touch an
 * accepted candidate and releasing them from the roster did not put them back, so a mis-tap was
 * permanent. Making it reversible is easy; making it SAFE is the work — twenty tables cascade off a
 * roster player, so a bare delete would quietly erase dues payments, attendance, lineups, awards and
 * a season of development records while reporting success. So: free while the player is fresh
 * (the mis-tap case, which is the one this exists for), refused the moment anything has attached to
 * them, and the refusal NAMES what is in the way rather than saying "cannot".
 */
export const DELETE = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const r = await resolveCoach(orgSlug, teamId);
  if (!r.ok) return r.res;
  const denied = denyUnless(r.assignment.capabilities.tryouts, 'Only the head coach manages tryouts.');
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const registrationId = typeof body.registrationId === 'string' ? body.registrationId : '';

  const reg = await getRepTryoutRegistration(registrationId);
  // IDOR: the candidate must belong to THIS team's active program year.
  if (!reg || reg.programYearId !== r.programYear.id) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (reg.status !== 'accepted') {
    return NextResponse.json(
      { error: 'not_accepted', message: 'This candidate is not on the roster, so there is nothing to undo.' },
      { status: 409 },
    );
  }

  // ⚠ EVERY roster row linked to this registration, not the first one. `tryout_registration_id`
  // carries no unique constraint, and the delete below removes ALL matches — so checking a single
  // `.find()` would inspect one row and delete several, which is a guard that does not cover its
  // own action (/review 2026-08-26). No live path creates a second link today; this closes the
  // structural mismatch rather than a reachable bug.
  const players = (await getRepRosterPlayers(r.programYear.id))
    .filter(p => p.tryoutRegistrationId === reg.id);

  // Absent = a previous undo got half-way; fall through and just revert the status (see
  // undoTryoutAcceptance's ordering note).
  const blockers = [...new Set((await Promise.all(players.map(p => rosterPlayerDependencies(p.id)))).flat())];
  if (blockers.length > 0) {
    const list = blockers.length === 1
      ? blockers[0]
      : `${blockers.slice(0, -1).join(', ')} and ${blockers[blockers.length - 1]}`;
    return NextResponse.json({
      error: 'has_history',
      message: `${reg.playerFirstName} already has ${list} on this team, and undoing here would delete it. `
             + `Remove them from the Roster page instead, which keeps that history.`,
    }, { status: 409 });
  }

  const registration = await undoTryoutAcceptance(reg.id);
  return NextResponse.json({ registrationId: registration.id, status: registration.status });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-decisions/accept' });
