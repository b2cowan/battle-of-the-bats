import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden, repGroupScopeGuard } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import {
  getRepTeam,
  getRepProgramYear,
  getRepTeamEventById,
  updateRepTeamEvent,
  deleteRepTeamEvent,
  deleteRepTeamEventsByRecurrenceParent,
} from '@/lib/db';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

async function resolveEvent(ctx: NonNullable<Awaited<ReturnType<typeof getAuthContextWithRole>>>, teamId: string, yearId: string, eventId: string) {
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  const groupErr = repGroupScopeGuard(ctx, team.groupId);
  if (groupErr) return { error: groupErr };

  const programYear = await getRepProgramYear(yearId);
  if (!programYear || programYear.teamId !== team.id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };

  const event = await getRepTeamEventById(eventId);
  if (!event || event.programYearId !== programYear.id) return { error: NextResponse.json({ error: 'Event not found' }, { status: 404 }) };

  return { team, programYear, event };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ teamId: string; yearId: string; eventId: string }> },
) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  const { teamId, yearId, eventId } = await params;
  const resolved = await resolveEvent(ctx!, teamId, yearId, eventId);
  if ('error' in resolved) return resolved.error;

  const body = await req.json();
  const fields: Parameters<typeof updateRepTeamEvent>[1] = {};

  if (body.name !== undefined)        fields.name = body.name?.trim() || undefined;
  if (body.description !== undefined) fields.description = body.description?.trim() || null;
  if (body.startsAt !== undefined)    fields.startsAt = body.startsAt;
  if (body.endsAt !== undefined)      fields.endsAt = body.endsAt || null;
  if (body.location !== undefined)    fields.location = body.location?.trim() || null;
  if (body.opponent !== undefined)    fields.opponent = body.opponent?.trim() || null;
  if (body.homeAway !== undefined)    fields.homeAway = body.homeAway || null;
  if (body.homeScore !== undefined)   fields.homeScore = body.homeScore != null ? Number(body.homeScore) : null;
  if (body.awayScore !== undefined)   fields.awayScore = body.awayScore != null ? Number(body.awayScore) : null;
  if (body.result !== undefined) {
    const r = body.result;
    if (r !== null && !['win', 'loss', 'tie'].includes(r)) {
      return NextResponse.json({ error: 'result must be win, loss, tie, or null' }, { status: 400 });
    }
    fields.result = r;
  }

  const updated = await updateRepTeamEvent(eventId, fields);
  return NextResponse.json({ event: updated });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ teamId: string; yearId: string; eventId: string }> },
) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  const { teamId, yearId, eventId } = await params;
  const resolved = await resolveEvent(ctx!, teamId, yearId, eventId);
  if ('error' in resolved) return resolved.error;
  const { event } = resolved;

  const url = new URL(req.url);
  const scope = url.searchParams.get('scope') ?? 'one';

  if (event.isRecurring && scope !== 'one') {
    const anchorId = event.recurrenceParentId ?? eventId;
    if (scope === 'all') {
      await deleteRepTeamEventsByRecurrenceParent(anchorId);
      await deleteRepTeamEvent(anchorId);
    } else if (scope === 'remaining') {
      await deleteRepTeamEventsByRecurrenceParent(anchorId, event.startsAt);
      if (event.recurrenceParentId) await deleteRepTeamEvent(eventId);
    } else {
      return NextResponse.json({ error: 'scope must be one, remaining, or all' }, { status: 400 });
    }
  } else {
    await deleteRepTeamEvent(eventId);
  }

  return NextResponse.json({ ok: true });
}
