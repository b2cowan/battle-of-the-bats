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
  clearTryoutOffer,
} from '@/lib/db';
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

  // The `?feeSuggestion=1` fee pre-fill was removed with the accept drawer (owner 2026-08-26):
  // a per-player amount depends on the roster size, which does not exist yet at accept time.
  return NextResponse.json({ registration });
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

  if (newStatus === 'accepted') {
    // No fees, no roster fields here (owner ruling 2026-08-26). Accepting gets the player a roster
    // place and nothing more; their number/position/jersey are set on the Roster page and their
    // dues from "Set dues for all players", once the roster size — which the amount depends on —
    // is actually known.
    try {
      const { registration, player } = await acceptTryoutAndAddToRoster(reg.id);
      // ⚠ NO WELCOME EMAIL — see the ruling comment at the bottom of this handler.
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

  // ⚠ NO FAMILY-FACING SIDE EFFECT, on this surface or the coach decision board (owner ruling
  // 2026-08-26, binding). A rep offer is a custom letter the family SIGNS — frequently
  // conditional, frequently negotiated — and a generic platform email cannot stand in for it,
  // so the old opt-in switch was a mis-tap risk with no upside. The family self-serve
  // Accept/Decline loop went with it: the reply token only ever travelled inside the offer
  // email. The one thing left is hygiene — wipe any token the retired loop left on the row.
  // Plan: docs/projects/active/COACH_TRYOUT_EMAIL_REMOVAL_PLAN.md.
  if (newStatus !== 'offered') await clearTryoutOffer(registration.id);

  return NextResponse.json({ registration });
}, { route: '/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/[regId]' });
