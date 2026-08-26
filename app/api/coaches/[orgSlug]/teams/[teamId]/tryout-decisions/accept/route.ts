import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getRepTeam,
  getCoachingAssignmentsForUser,
  getActiveRepProgramYear,
  getRepTryoutRegistration,
  acceptTryoutAndAddToRoster,
  TryoutAcceptError,
} from '@/lib/db';
import { deriveStandardDuesSchedule, validateAcceptDues, normalizeAcceptDues } from '@/lib/tryout-fees';
import { denyUnless, redactRosterPlayer } from '@/lib/coach-capabilities';
import { withObservability } from '@/lib/observability';
import type { RepProgramYear } from '@/lib/types';

type Resolved =
  | { ok: false; res: Response }
  | { ok: true; orgId: string; team: Awaited<ReturnType<typeof getRepTeam>>; programYear: RepProgramYear; assignment: Awaited<ReturnType<typeof getCoachingAssignmentsForUser>>[number] };

// Fee-setup follows the coach's EXISTING dues access (OQ3): any assigned coach can set dues on the
// dues page today, so an assigned coach can accept-with-fees here too. No extra gate beyond assignment
// (this route lives inside the Premium Coaches Portal — roster + dues are already Premium, OQ4).
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

/** Prefill for the accept drawer: the candidate's identity/guardian + the team's standard fee schedule. */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const r = await resolveCoach(orgSlug, teamId);
  if (!r.ok) return r.res;
  const denied = denyUnless(r.assignment.capabilities.tryouts, 'Only the head coach manages tryouts.');
  if (denied) return denied;

  const registrationId = new URL(req.url).searchParams.get('registrationId') ?? '';
  const reg = await getRepTryoutRegistration(registrationId);
  // IDOR: the candidate must belong to THIS team's active program year and still be awaiting acceptance.
  if (!reg || reg.programYearId !== r.programYear.id) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (reg.status !== 'offered') {
    return NextResponse.json({ error: 'not_offered', message: 'This candidate is no longer awaiting acceptance.' }, { status: 409 });
  }

  const suggestedDues = await deriveStandardDuesSchedule(r.programYear.id);

  return NextResponse.json({
    registration: {
      id: reg.id,
      playerFirstName: reg.playerFirstName,
      playerLastName: reg.playerLastName,
      playerDateOfBirth: reg.playerDateOfBirth,
      guardianFirstName: reg.guardianFirstName,
      guardianLastName: reg.guardianLastName,
      guardianEmail: reg.guardianEmail,
      guardianPhone: reg.guardianPhone,
      // What the family wrote at registration — visible where the coach acts on it (WI-3).
      playerNotes: reg.playerNotes,
    },
    suggestedDues,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-decisions/accept' });

/** Accept an offered candidate → roster player + optional dues, atomically (mig-169 RPC). */
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

  const roster = body.roster && typeof body.roster === 'object' ? {
    playerNumber:    typeof body.roster.playerNumber === 'string' ? body.roster.playerNumber.trim() || null : null,
    primaryPosition: typeof body.roster.primaryPosition === 'string' ? body.roster.primaryPosition.trim() || null : null,
    jerseySize:      typeof body.roster.jerseySize === 'string' ? body.roster.jerseySize.trim() || null : null,
  } : undefined;

  const duesError = validateAcceptDues(body.dues);
  if (duesError) return NextResponse.json({ error: duesError }, { status: 400 });
  const dues = body.dues ? normalizeAcceptDues(body.dues) : null;

  try {
    const { registration, player } = await acceptTryoutAndAddToRoster(reg.id, { roster, dues });
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
