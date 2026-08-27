import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getRepTeam,
  getCoachingAssignmentsForUser,
  getActiveRepProgramYear,
  getRepTryout,
  getRepTryoutCheckinList,
  createRepTryoutRegistration,
  updateRepTryoutCheckin,
  getRepProgramYears,
  getPriorContinuityIdentities,
} from '@/lib/db';
import { matchPriorIdentities, type ContinuityKind } from '@/lib/continuity-match';
import { isCalendarDate } from '@/lib/timezone';
import { splitTypedName } from '@/lib/coach-roster-name';
import { denyUnless } from '@/lib/coach-capabilities';
import { withObservability } from '@/lib/observability';
import type { RepProgramYear } from '@/lib/types';

type Resolved =
  | { ok: false; res: Response }
  | { ok: true; orgId: string; teamId: string; programYear: RepProgramYear; assignment: Awaited<ReturnType<typeof getCoachingAssignmentsForUser>>[number] };

/**
 * Which of this year's candidates were here before, and in which season (Chunk F, D-F1).
 * Keyed by registration id; absent = first time. `kind` distinguishes "tried out and didn't
 * make it" from "was on the roster", because those are different conversations with a family.
 */
export interface ReturningCandidateMarker {
  priorProgramYearId: string;
  priorProgramYearName: string;
  kind: ContinuityKind;
  confidence: 'high' | 'possible';
}

async function resolveReturningCandidates(
  teamId: string,
  programYearId: string,
  candidates: { id: string; playerFirstName: string; playerLastName: string | null;
    playerDateOfBirth: string | null; guardianEmail: string | null }[],
): Promise<Record<string, ReturningCandidateMarker>> {
  if (candidates.length === 0) return {};
  const years = await getRepProgramYears(teamId);
  const { identities } = await getPriorContinuityIdentities(teamId, programYearId, years);
  if (identities.length === 0) return {};

  const yearName = new Map(years.map(y => [y.id, y.name]));
  const out: Record<string, ReturningCandidateMarker> = {};
  for (const c of candidates) {
    const [best] = matchPriorIdentities(
      {
        kind: 'registration', id: c.id, programYearId,
        firstName: c.playerFirstName, lastName: c.playerLastName,
        dateOfBirth: c.playerDateOfBirth, guardianEmail: c.guardianEmail,
      },
      identities,
    );
    if (!best) continue;
    out[c.id] = {
      priorProgramYearId: best.prior.programYearId,
      priorProgramYearName: yearName.get(best.prior.programYearId) ?? 'a past season',
      kind: best.prior.kind,
      confidence: best.confidence,
    };
  }
  return out;
}

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
  return { ok: true, orgId: ctx.org.id, teamId, programYear, assignment };
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const r = await resolveCoach(orgSlug, teamId);
  if (!r.ok) return r.res;
  const denied = denyUnless(r.assignment.capabilities.tryouts, 'Only the head coach manages tryouts.');
  if (denied) return denied;

  const [tryout, candidates] = await Promise.all([
    getRepTryout(r.programYear.id),
    getRepTryoutCheckinList(r.programYear.id),
  ]);

  // Chunk F (D-F1): "have we seen this person before?" — the moment past-season tryout records
  // exist to serve. Reuses the SAME matcher the Decision Board's continuity scan runs on, so a
  // returning candidate is recognised identically in both places. Never gated separately: the
  // caller already cleared `tryouts` above, and the marker carries no evaluation content — just
  // which season to go and read.
  const returningByCandidate = await resolveReturningCandidates(teamId, r.programYear.id, candidates);

  return NextResponse.json({ isAnonymous: tryout?.isAnonymous ?? true, candidates, returning: returningByCandidate });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-candidates' });

/** Trim + cap one optional text field. `''` for anything that isn't a usable string. */
function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/**
 * ONE "Guardian name" box on the coach's form, TWO NOT NULL columns underneath.
 *
 * The club-admin door asks for first and last separately and the record keeps them apart, but at a
 * check-in desk that is two taps for one fact — the approved form (Option B, 2026-08-26) asks once.
 * `splitTypedName` is the shared rule — first token, then everything else, so "Sarah Van Der Berg"
 * keeps its surname whole and a single word is a first name with an empty last name (exactly what
 * this path has always written). ⚠ Note the repo also holds the OPPOSITE convention for a legacy
 * back-compat path; see that helper's warning. The caps stay here because they are this table's.
 */
function splitGuardianName(full: string): { first: string; last: string } {
  const { first, last } = splitTypedName(full);
  return { first: first.slice(0, 80), last: last.slice(0, 80) };
}

/**
 * Add a player to the tryout — a walk-up at the desk, or (the commoner case, and the reason the
 * button stopped saying "Add walk-up") a coach entering a squad they took registrations for
 * outside FieldLogicHQ.
 *
 * ⚠ THE FIELD LIST HERE IS THE POINT OF THE 2026-08-26 CHANGE. It used to take a name and an
 * email, which left the coach — the person actually running the tryout — with a thinner door into
 * the record than either the public form or the club-admin screen, and BROKE THREE SHIPPED
 * FEATURES for anyone who used it: the printed check-in sheet's Age column (computed from date of
 * birth) printed blank, the decision board's "no email on file — reach them by phone" flag pointed
 * at a phone number there was nowhere to record, and the board's "family's note" could never
 * exist. Confident returning-player matching also needs the birth date. Do not narrow this back.
 *
 * Checked in on add — whoever the coach is typing is standing in front of them or has already been
 * accounted for.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const r = await resolveCoach(orgSlug, teamId);
  if (!r.ok) return r.res;
  const denied = denyUnless(r.assignment.capabilities.tryouts, 'Only the head coach manages tryouts.');
  if (denied) return denied;

  const body = await req.json();
  const first = text(body.playerFirstName, 80);
  const last = text(body.playerLastName, 80);
  if (!first) return NextResponse.json({ errors: { playerFirstName: 'Player first name is required' } }, { status: 400 });

  const guardianEmail = text(body.guardianEmail, 200);
  if (guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail)) {
    return NextResponse.json({ errors: { guardianEmail: 'Enter a valid email address' } }, { status: 400 });
  }

  // ⚠ Validated HERE rather than left to Postgres. The column is `date`; a malformed string is a
  // driver error, which reaches the coach as "Failed to add" with no clue which box is wrong.
  // `isCalendarDate` checks the shape AND that it is a real day, so 2015-02-30 is caught too.
  const dob = text(body.playerDateOfBirth, 10);
  if (dob && !isCalendarDate(dob)) {
    return NextResponse.json({ errors: { playerDateOfBirth: 'Enter the date as YYYY-MM-DD' } }, { status: 400 });
  }

  const guardian = splitGuardianName(text(body.guardianName, 160));
  // ⚠ NULL ≠ '' on this column (mig 265), and THIS DOOR NEVER WRITES NULL. The distinction is
  // "was anybody asked": the public form and the club-admin screen do not carry this field at all,
  // so their rows are NULL; this form does carry it, so a blank here is a real answer — asked, left
  // blank — and must be stored as ''. Coalescing it to NULL (as this line first did) made the empty
  // string unreachable and quietly turned a documented distinction into one the data can never show.
  const lastSeasonTeam = text(body.lastSeasonTeam, 120);

  const registration = await createRepTryoutRegistration({
    programYearId: r.programYear.id,
    teamId: r.teamId,
    orgId: r.orgId,
    playerFirstName: first,
    playerLastName: last,
    playerDateOfBirth: dob || null,
    playerNotes: text(body.playerNotes, 500) || null,
    lastSeasonTeam,
    // Both NOT NULL: a coach who skipped the contact fields writes empty strings, as this path
    // always has. The club-admin screen fills them in later.
    guardianFirstName: guardian.first,
    guardianLastName: guardian.last,
    guardianEmail,
    guardianPhone: text(body.guardianPhone, 30) || null,
  });
  await updateRepTryoutCheckin(registration.id, { isCheckedIn: true });

  return NextResponse.json({ ok: true }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-candidates' });
