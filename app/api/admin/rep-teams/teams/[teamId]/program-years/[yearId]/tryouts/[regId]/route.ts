import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden, repGroupScopeGuard } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import {
  getRepTeam,
  getRepProgramYear,
  getRepTryoutRegistration,
  updateRepTryoutRegistrationStatus,
  acceptTryoutAndAddToRoster,
  TryoutAcceptError,
} from '@/lib/db';
import { deriveStandardDuesSchedule, validateAcceptDues, normalizeAcceptDues } from '@/lib/tryout-fees';
import { applyTryoutDecisionSideEffects } from '@/lib/tryout-notifications';
import { tryoutAcceptedHtml } from '@/lib/email';
import { sendTransactionalEmail } from '@/lib/platform-email-templates';
import type { RepTryoutRegistrationStatus } from '@/lib/types';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

const VALID_TRANSITIONS: Record<RepTryoutRegistrationStatus, RepTryoutRegistrationStatus[]> = {
  pending_review: ['offered', 'waitlisted', 'declined', 'withdrawn'],
  offered:        ['accepted', 'waitlisted', 'declined', 'withdrawn'],
  waitlisted:     ['offered', 'declined', 'withdrawn'],
  accepted:       ['withdrawn'],
  declined:       [],
  withdrawn:      [],
};

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ teamId: string; yearId: string; regId: string }> },) => {
  const orgSlug = new URL(_req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  const { teamId, yearId, regId } = await params;
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx!.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const groupErr = repGroupScopeGuard(ctx!, team.groupId);
  if (groupErr) return groupErr;

  const programYear = await getRepProgramYear(yearId);
  if (!programYear || programYear.teamId !== team.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const registration = await getRepTryoutRegistration(regId);
  if (!registration || registration.programYearId !== programYear.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // The accept drawer opens with `?feeSuggestion=1` to pre-fill the team's standard fee schedule
  // (derived from prevailing roster dues — no fee-template exists in the schema).
  const wantFee = new URL(_req.url).searchParams.get('feeSuggestion') === '1';
  const suggestedDues = wantFee ? await deriveStandardDuesSchedule(programYear.id) : undefined;

  return NextResponse.json({ registration, suggestedDues });
}, { route: '/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/[regId]' });

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ teamId: string; yearId: string; regId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  const { teamId, yearId, regId } = await params;
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx!.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const groupErr = repGroupScopeGuard(ctx!, team.groupId);
  if (groupErr) return groupErr;

  const programYear = await getRepProgramYear(yearId);
  if (!programYear || programYear.teamId !== team.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const reg = await getRepTryoutRegistration(regId);
  if (!reg || reg.programYearId !== programYear.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json();
  const contactEmail = ctx!.org.contactEmail ?? undefined;

  // Notes-only update (no status change)
  if (body.status === undefined && body.adminNotes !== undefined) {
    const registration = await updateRepTryoutRegistrationStatus(reg.id, reg.status, body.adminNotes);
    return NextResponse.json({ registration });
  }

  if (body.status === undefined) {
    return NextResponse.json({ registration: reg });
  }

  const newStatus = body.status as RepTryoutRegistrationStatus;
  const allowed = VALID_TRANSITIONS[reg.status] ?? [];
  if (!allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `Cannot transition from '${reg.status}' to '${newStatus}'` },
      { status: 422 },
    );
  }

  const emailParams = {
    guardianFirstName: reg.guardianFirstName,
    playerFirstName: reg.playerFirstName,
    playerLastName: reg.playerLastName,
    teamName: team.name,
    yearName: programYear.name,
    contactEmail,
  };

  if (newStatus === 'accepted') {
    // Optional roster fields + optional dues schedule ride along on the accept (Phase 2B.4). The
    // upgraded accept is atomic (mig-169 RPC): roster + status + dues all-or-nothing.
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
      sendTransactionalEmail({
        key: 'tryout_offer_accepted',
        to: reg.guardianEmail,
        vars: {
          guardianFirstName: emailParams.guardianFirstName,
          playerFirstName: emailParams.playerFirstName,
          playerLastName: emailParams.playerLastName,
          teamName: emailParams.teamName,
          yearName: emailParams.yearName,
        },
        defaultSubject: `${team.name} — Welcome to the Team!`,
        defaultHtml: tryoutAcceptedHtml(emailParams),
      }).catch(e => console.error('[email] tryout accepted:', e));
      return NextResponse.json({ registration, player });
    } catch (e) {
      if (e instanceof TryoutAcceptError) {
        const status = e.code === 'not_found' ? 404 : e.code === 'not_offered' ? 409 : 400;
        return NextResponse.json({ error: e.message }, { status });
      }
      throw e;
    }
  }

  const registration = await updateRepTryoutRegistrationStatus(
    reg.id,
    newStatus,
    body.adminNotes !== undefined ? body.adminNotes : reg.adminNotes,
  );

  // Family-facing side effects (offer link + branded offer/waitlist/release emails) — shared with the
  // coach decision board so both surfaces behave identically (Phase 2B.5).
  await applyTryoutDecisionSideEffects({
    reg: registration,
    newStatus,
    teamName: team.name,
    yearName: programYear.name,
    orgName: ctx!.org.name,
    orgLogoUrl: ctx!.org.logoUrl ?? undefined,
    contactEmail,
  });

  return NextResponse.json({ registration });
}, { route: '/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/[regId]' });
