import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import {
  getRepTeam,
  getRepProgramYear,
  getRepTryoutRegistration,
  updateRepTryoutRegistrationStatus,
  acceptTryoutAndAddToRoster,
} from '@/lib/db';
import { sendEmail, tryoutOfferHtml, tryoutAcceptedHtml, tryoutDeclinedHtml } from '@/lib/email';
import type { RepTryoutRegistrationStatus } from '@/lib/types';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

const VALID_TRANSITIONS: Record<RepTryoutRegistrationStatus, RepTryoutRegistrationStatus[]> = {
  pending_review: ['offered', 'declined', 'withdrawn'],
  offered:        ['accepted', 'declined', 'withdrawn'],
  accepted:       ['withdrawn'],
  declined:       [],
  withdrawn:      [],
};

export async function GET(
  _req: Request,
  { params }: { params: { teamId: string; yearId: string; regId: string } },
) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  const team = await getRepTeam(params.teamId);
  if (!team || team.orgId !== ctx!.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const programYear = await getRepProgramYear(params.yearId);
  if (!programYear || programYear.teamId !== team.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const registration = await getRepTryoutRegistration(params.regId);
  if (!registration || registration.programYearId !== programYear.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ registration });
}

export async function PATCH(
  req: Request,
  { params }: { params: { teamId: string; yearId: string; regId: string } },
) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  const team = await getRepTeam(params.teamId);
  if (!team || team.orgId !== ctx!.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const programYear = await getRepProgramYear(params.yearId);
  if (!programYear || programYear.teamId !== team.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const reg = await getRepTryoutRegistration(params.regId);
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
    const { registration, player } = await acceptTryoutAndAddToRoster(reg.id);
    sendEmail(
      reg.guardianEmail,
      `${team.name} — Welcome to the Team!`,
      tryoutAcceptedHtml(emailParams),
    ).catch(e => console.error('[email] tryout accepted:', e));
    return NextResponse.json({ registration, player });
  }

  const registration = await updateRepTryoutRegistrationStatus(
    reg.id,
    newStatus,
    body.adminNotes !== undefined ? body.adminNotes : reg.adminNotes,
  );

  if (newStatus === 'offered') {
    sendEmail(
      reg.guardianEmail,
      `${team.name} — Offer Extended`,
      tryoutOfferHtml(emailParams),
    ).catch(e => console.error('[email] tryout offer:', e));
  } else if (newStatus === 'declined') {
    sendEmail(
      reg.guardianEmail,
      `${team.name} — Tryout Update`,
      tryoutDeclinedHtml(emailParams),
    ).catch(e => console.error('[email] tryout declined:', e));
  }

  return NextResponse.json({ registration });
}
